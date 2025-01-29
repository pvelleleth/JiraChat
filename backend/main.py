from fastapi import FastAPI, HTTPException
import os
from pinecone import Pinecone
import cohere
from fastapi.middleware.cors import CORSMiddleware
import dotenv
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List
from jira import JIRA
from datetime import datetime, timedelta

# Load environment variables from .env file
load_dotenv()

# Now you can access your API keys
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
COHERE_API_KEY = os.getenv("COHERE_API_KEY")
JIRA_TOKEN = os.getenv("JIRA_TOKEN")
JIRA_DOMAIN = os.getenv("JIRA_DOMAIN")

app = FastAPI()

# Initialize clients
pc = Pinecone(api_key=PINECONE_API_KEY)
INDEX_NAME = "jira-documents"
co = cohere.Client(api_key=COHERE_API_KEY)
jira = JIRA(
    server=f"https://{JIRA_DOMAIN}",
    basic_auth=(os.getenv("JIRA_EMAIL"), JIRA_TOKEN)
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to the index
index = pc.Index(INDEX_NAME)

class Message(BaseModel):
    role: str
    content: str

class ConversationRequest(BaseModel):
    question: str
    conversation_history: List[Message]

def classify_query(question: str) -> dict:
    """Use Cohere to classify the query type and extract relevant parameters."""
    
    prompt = f"""Analyze the following question about Jira issues and classify what type of search would be most appropriate.
Also extract any relevant parameters mentioned in the query.

Question: "{question}"

Classify into one of these types:
1. TEMPORAL (questions about time periods, dates, recent changes)
2. STATUS_BASED (questions about issue states, progress)
3. SEMANTIC (questions about content, similarity, topics)
4. HYBRID (needs both temporal/status and semantic search)

Output your response in this exact JSON format:
{{
    "type": "TEMPORAL/STATUS_BASED/SEMANTIC/HYBRID",
    "needs_jira_api": true/false,
    "needs_rag": true/false,
    "time_period": "last_week/last_month/etc" or null,
    "status": "status value" or null,
    "jql_components": ["list of relevant JQL conditions"] or []
}}

For example:
Q: "What issues were closed last week?"
{{
    "type": "TEMPORAL",
    "needs_jira_api": true,
    "needs_rag": false,
    "time_period": "last_week",
    "status": "closed",
    "jql_components": ["status = Closed", "resolved >= -1w"]
}}"""

    response = co.chat(
        message=prompt,
        model="command-r-plus",
        temperature=0
    )
    
    # Convert the response to a dictionary
    import json
    try:
        classification = json.loads(response.text)
        return classification
    except:
        # Fallback to RAG if classification fails
        return {
            "type": "SEMANTIC",
            "needs_jira_api": False,
            "needs_rag": True,
            "time_period": None,
            "status": None,
            "jql_components": []
        }

def get_jira_issues(jql_components: List[str]) -> str:
    """Fetch issues from Jira API using JQL."""
    
    # Combine JQL components
    jql = " AND ".join(jql_components)
    
    # Search issues
    issues = jira.search_issues(jql)
    
    # Format results
    results = ""
    for issue in issues:
        results += f"\nProject: {issue.fields.project.key}\n"
        results += f"Issue Key: {issue.key}\n"
        results += f"Summary: {issue.fields.summary}\n"
        results += f"Description: {issue.fields.description or 'No description'}\n"
        results += f"Assignee: {issue.fields.assignee.displayName if issue.fields.assignee else 'Unassigned'}\n"
        results += f"Status: {issue.fields.status.name}\n"
        results += f"Issue Type: {issue.fields.issuetype.name}\n"
        results += "-" * 50 + "\n"
    
    return results

# Generate embeddings using Cohere
def get_embedding(text, model="embed-english-v3.0"):
    response = co.embed(
        texts=[text],
        model=model,
        input_type="search_query",
        truncate="RIGHT"
    )
    return response.embeddings[0]

# Perform semantic search
def semantic_search(query, top_k=30):
    # Generate query embedding
    query_embedding = get_embedding(query)

    # Query the Pinecone index
    search_results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )

    return search_results

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

@app.post("/answer")
def answer(request: ConversationRequest):
    # Classify the query
    classification = classify_query(request.question)
    
    # Initialize context strings
    rag_context = ""
    jira_api_context = ""
    
    # Get RAG results if needed
    if classification["needs_rag"]:
        results = semantic_search(request.question)
        for match in results['matches']:
            metadata = match['metadata']
            rag_context += f"\nProject: {metadata['project']}\n"
            rag_context += f"Issue Key: {metadata['issue_key']}\n"
            rag_context += f"Summary: {metadata['summary']}\n"
            rag_context += f"Description: {metadata['description']}\n"
            rag_context += f"Assignee: {metadata['assignee']}\n"
            rag_context += f"Status: {metadata['status']}\n"
            rag_context += f"Issue Type: {metadata['issue_type']}\n"
            rag_context += "-" * 50 + "\n"
    
    # Get Jira API results if needed
    if classification["needs_jira_api"] and classification["jql_components"]:
        jira_api_context = get_jira_issues(classification["jql_components"])

    # Combine contexts
    combined_context = ""
    if rag_context and jira_api_context:
        combined_context = f"""Information from semantic search:
{rag_context}

Information from Jira API:
{jira_api_context}"""
    elif rag_context:
        combined_context = rag_context
    else:
        combined_context = jira_api_context

    # Create preamble with search results and instructions
    preamble = f"""You are a helpful Jira assistant. Use the following Jira information to help answer questions.
Format your responses in markdown to make them easy to read and understand.
When referring to specific Jira issues, always include their keys.

Query type: {classification["type"]}
Relevant Jira information:
{combined_context}"""

    # Format conversation history for Cohere
    chat_history = []
    for msg in request.conversation_history:
        chat_history.append({
            "role": "user" if msg.role == "user" else "chatbot",
            "message": msg.content
        })

    # Get response from Cohere
    response = co.chat(
        model="command-r-plus",
        preamble=preamble,
        chat_history=chat_history,
        message=request.question,
        temperature=0
    )
    
    return response.text
