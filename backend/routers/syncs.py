from fastapi import APIRouter, HTTPException
from jira import JIRA
import json
import os
from supabase import create_client, Client
from typing import Dict
from datetime import datetime, timedelta
import cohere
import uuid
from pinecone import Pinecone, ServerlessSpec
from typing import List, Dict
from unstructured.partition.html import partition_html
from unstructured.chunking.title import chunk_by_title
from pydantic import BaseModel

router = APIRouter()

# Initialize Cohere client
co = cohere.Client(os.getenv("COHERE_API_KEY"))

# Initialize Pinecone
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

class Vectorstore:
    def __init__(self, raw_documents: List[Dict[str, str]], namespace: str, index_name: str = "jira-documents"):
        self.raw_documents = raw_documents
        self.docs = []
        self.index_name = index_name
        self.namespace = namespace
        self.retrieve_top_k = 10
        self.rerank_top_k = 3
        
        # Create Pinecone index if it doesn't exist
        if self.index_name not in [index.name for index in pc.list_indexes()]:
            pc.create_index(
                name=self.index_name,
                dimension=1024,  # Cohere embed-english-v3.0 dimension
                metric="cosine",
                spec=ServerlessSpec(
                    cloud="aws",
                    region="us-east-1"
                )
            )
        self.index = pc.Index(self.index_name)
        
        self.load_and_chunk()
        self.embed_and_index()
    
    def load_and_chunk(self) -> None:
        """
        Loads the text from the sources and chunks the HTML content.
        """
        print(f"Loading documents for namespace {self.namespace}...")

        self.docs = []
        for project in self.raw_documents:
            for issue in project["issues"]:
                # Skip if both summary and description are None
                if issue["summary"] is None and issue["description"] is None:
                    continue
                    
                self.docs.append({
                    "project": project["project_key"],
                    "issue_key": issue["key"],
                    "summary": issue["summary"] or "",
                    "description": issue["description"] or "",
                    "assignee": issue["assignee"] or "",
                    "status": issue["status"] or "",
                    "parent_id": issue["parent_id"] or "",
                    "issue_type": issue["issue_type"] or "",
                    "comments": issue["comments"]
                })
        
        print(f"Loaded {len(self.docs)} valid documents")
                
    def embed_and_index(self) -> None:
        """
        Embeds the document chunks and indexes them in Pinecone.
        """
        print(f"Embedding and indexing documents for namespace {self.namespace}...")
        if not self.namespace:
            raise ValueError("Namespace cannot be empty")
        
        if not self.docs:
            raise ValueError("No valid documents to embed")
        
        # First, delete all existing vectors in this namespace
        #self.index.delete(delete_all=True, namespace=self.namespace)

        batch_size = 100  # Pinecone recommends batching
        vectors_to_upsert = []
        
        for i, doc in enumerate(self.docs, 1):
            text = f"Project: {doc['project']} Issue Key: {doc['issue_key']} Parent ID: {doc['parent_id']} Assignee: {doc['assignee']} Status: {doc['status']} Issue Type: {doc['issue_type']} Summary: {doc['summary']} Description: {doc['description']}".strip()
            if not text:  # Skip if text is empty
                continue
                
            print(f"Processing document {i} of {len(self.docs)}")
            
            # Get embedding from Cohere
            response = co.embed(
                texts=[text], 
                model="embed-english-v3.0", 
                input_type="search_document"
            )
            
            # Prepare vector for Pinecone
            vector = {
                'id': doc['issue_key'],
                'values': response.embeddings[0],
                'metadata': {
                    'issue_key': doc['issue_key'],
                    'project': doc['project'],
                    'summary': doc['summary'],
                    'description': doc['description'],
                    'assignee': doc['assignee'],
                    'status': doc['status'],
                    'issue_type': doc['issue_type']
                }
            }
            vectors_to_upsert.append(vector)
            
            # Batch upsert when we reach batch_size
            if len(vectors_to_upsert) >= batch_size:
                self.index.upsert(vectors=vectors_to_upsert, namespace=self.namespace)
                vectors_to_upsert = []
        
        # Upsert any remaining vectors
        if vectors_to_upsert:
            self.index.upsert(vectors=vectors_to_upsert, namespace=self.namespace)
            
        print(f"Successfully embedded and indexed {len(self.docs)} documents in namespace {self.namespace}")
        
    def retrieve(self, query: str) -> List[Dict[str, str]]:
        """
        Retrieves document chunks based on the given query.
        """
        if not query.strip():
            return []

        # Get query embedding
        query_emb = co.embed(
            texts=[query], 
            model="embed-english-v3.0", 
            input_type="search_query"
        ).embeddings[0]

        # Query Pinecone
        results = self.index.query(
            vector=query_emb,
            top_k=self.retrieve_top_k,
            include_metadata=True,
            namespace=self.namespace
        )

        # Prepare documents for reranking
        docs_to_rerank = []
        for match in results.matches:
            docs_to_rerank.append({
                "title": match.metadata["summary"],
                "text": match.metadata["description"]
            })

        if not docs_to_rerank:
            return []

        # Rerank results
        rerank_results = co.rerank(
            query=query,
            documents=docs_to_rerank,
            top_n=min(self.rerank_top_k, len(docs_to_rerank)),
            model="rerank-english-v3.0",
            rank_fields=["title", "text"]
        )
        
        # Return reranked results with full metadata
        final_results = []
        for result in rerank_results.results:
            match = results.matches[result.index]
            final_results.append(match.metadata)
            
        return final_results

# Initialize Supabase client
supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY")
)

# Cache for JIRA clients
jira_clients: Dict[str, tuple[JIRA, datetime]] = {}
CACHE_DURATION = timedelta(minutes=30)

async def get_jira_client(user_id: str) -> JIRA:
    """Get a JIRA client instance for a specific user, using cache if available."""
    global jira_clients
    
    # Check cache first
    if user_id in jira_clients:
        client, timestamp = jira_clients[user_id]
        if datetime.now() - timestamp < CACHE_DURATION:
            return client
        
    try:
        # Get user settings
        settings = supabase.table('user_settings').select('*').eq('user_id', user_id).single().execute()
        if not settings.data:
            raise Exception("Jira settings not found")
            
        # Get the Jira token using the new encryption system
        secret = supabase.rpc(
            'get_secret',
            {
                'p_user_id': user_id,
                'p_type': 'jira_token',
                'p_encryption_key': os.getenv('ENCRYPTION_KEY')
            }
        ).execute()
        
        if not secret.data:
            raise Exception("Jira token not found")
            
        # Create JIRA client
        jira = JIRA(
            server=f"https://{settings.data['jira_domain']}",
            basic_auth=(settings.data['jira_email'], secret.data)
        )
        
        # Cache the client
        jira_clients[user_id] = (jira, datetime.now())
        return jira
    except Exception as e:
        raise Exception(f"Failed to initialize Jira client: {str(e)}")

async def fetch_project_data(project_key: str, jira: JIRA):
    """
    Fetches all data for a given project and stores it in a JSON-like structure.
    """
    project_data = {
        "project_key": project_key,
        "issues": []
    }

    # JQL to exclude closed issues
    jql_query = f'project = "{project_key}" AND statusCategory != Done AND created >= -52w ORDER BY created DESC'

    # Pagination setup
    start_at = 0
    max_results = 50

    while True:
        issues = jira.search_issues(jql_query, startAt=start_at, maxResults=max_results)
        if not issues:
            break

        for issue in issues:
            issue_data = {
                "key": issue.key,
                "summary": issue.fields.summary,
                "description": issue.fields.description,
                "assignee": issue.fields.assignee.displayName if issue.fields.assignee else "Unassigned",
                "status": issue.fields.status.name,
                "issue_type": issue.fields.issuetype.name,
                "parent_id": issue.fields.parent.key if hasattr(issue.fields, 'parent') else None,
                "comments": [],
                "attachments": []
            }
            
            # Fetch comments
            comments = issue.fields.comment.comments
            for comment in comments:
                issue_data["comments"].append({
                    "author": comment.author.displayName,
                    "body": comment.body,
                    "created": comment.created
                })

            # Fetch attachments
            attachments = issue.fields.attachment
            for attachment in attachments:
                issue_data["attachments"].append({
                    "filename": attachment.filename,
                    "url": attachment.content
                })

            # Add issue to project data
            project_data["issues"].append(issue_data)

        # Move to the next batch
        start_at += max_results

    return project_data

async def fetch_all_projects(jira: JIRA):
    """
    Fetches all projects and their data.
    """
    all_projects_data = []

    # Get all projects
    projects = jira.projects()

    for project in projects:
        print(f"Fetching data for project: {project.key} - {project.name}")
        project_data = await fetch_project_data(project.key, jira)
        project_data["project_name"] = project.name
        all_projects_data.append(project_data)

    return all_projects_data

class SyncRequest(BaseModel):
    user_id: str

@router.post("/sync")
async def sync(request: SyncRequest):
    print(f"Received sync request for user_id: {request.user_id}")
    try:
        print(f"Starting sync for user_id: {request.user_id}")
        
        # Get user settings from Supabase
        settings_response = supabase.table('user_settings').select('*').eq('user_id', request.user_id).single().execute()
        
        if not settings_response.data:
            print(f"No settings found for user_id: {request.user_id}")
            raise HTTPException(status_code=404, detail="User settings not found. Please save your Jira settings first.")

        settings = settings_response.data
        print(f"Found settings: {settings}")
        
        # Validate required settings
        if not all([settings.get('jira_domain'), settings.get('jira_email')]):
            missing_fields = []
            if not settings.get('jira_domain'): missing_fields.append('Jira domain')
            if not settings.get('jira_email'): missing_fields.append('Jira email')
            print(f"Missing required fields: {missing_fields}")
            raise HTTPException(status_code=400, detail=f"Incomplete Jira settings. Missing: {', '.join(missing_fields)}")

        # Get the Jira token using the new encryption system
        print(f"Fetching Jira token for user: {request.user_id}")
        try:
            secret_response = supabase.rpc(
                'get_secret',
                {
                    'p_user_id': request.user_id,
                    'p_type': 'jira_token',
                    'p_encryption_key': "vEK8b9J/AOr+uzGVGuIFNVtrek/spCCYM3WWQJb6Pas="
                }
            ).execute()
            print(f"Secret response: {secret_response}")
        except Exception as e:
            print(f"Error getting secret: {str(e)}")
            raise
        
        try:
            print("Initializing Jira client")
            # Create JIRA client with the stored credentials
            jira = JIRA(
                server=f"https://{settings['jira_domain']}",
                basic_auth=(settings['jira_email'], secret_response.data)
            )
            print(f"jira token: {settings['jira_email']}")
            print("Successfully initialized Jira client")
        except Exception as e:
            import logging
            logging.error(f"Failed to initialize Jira client: {str(e)}")
            raise HTTPException(status_code=401, detail=f"Failed to connect to Jira. Please verify your credentials: {str(e)}")

        # Fetch all project data
        try:
            print("Fetching project data")
            all_projects_data = await fetch_all_projects(jira)
            print(f"Successfully fetched data for {len(all_projects_data)} projects")
        except Exception as e:
            print(f"Failed to fetch projects: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch Jira projects: {str(e)}")
        
        # Get or create namespace in user_settings
        namespace = settings.get('pinecone_namespace') or request.user_id
        if not settings.get('pinecone_namespace'):
            print(f"Creating new namespace: {namespace}")
            # First sync - save the namespace
            update_response = supabase.table('user_settings').update({
                'pinecone_namespace': namespace
            }).eq('user_id', request.user_id).execute()
            
        try:
            print(f"Initializing vectorstore with namespace: {namespace}")
            # Initialize vectorstore with user's namespace
            vectorstore = Vectorstore(all_projects_data, namespace=namespace)
            print("Successfully initialized vectorstore")
        except Exception as e:
            print(f"Failed to initialize vectorstore: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to store data in vector database: {str(e)}")
        
        return {
            "message": f"Successfully synced data to namespace {namespace}",
            "data": all_projects_data
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error during sync: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error during sync: {str(e)}")

