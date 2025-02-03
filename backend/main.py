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
import json

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

def classify_query(question: str, conversation_history: List[Message] = None) -> dict:
    """Use Cohere to classify the query type and generate JQL."""
    print("\n=== Query Classification and JQL Generation ===")
    print(f"Input Question: {question}")
    
    # Format conversation history for context
    history_context = ""
    if conversation_history:
        history_context = "Previous conversation:\n"
        for msg in conversation_history:
            role = "User" if msg.role == "user" else "Assistant"
            history_context += f"{role}: {msg.content}\n"
        history_context += "\nCurrent question:"
    
    prompt = f"""You are a Jira query expert. Analyze the following question about Jira issues and:
1. Determine the most appropriate search strategy
2. Generate a JQL query if appropriate

{history_context}
Question: "{question}"

First, classify the query into one of these types:
1. TEMPORAL (questions about time periods, dates, recent changes)
2. STATUS_BASED (questions about issue states, progress)
3. SEMANTIC (questions about content, similarity, topics)
4. HYBRID (needs both temporal/status and semantic search)

Then, if the query would benefit from a JQL search (temporal, status-based, or hybrid queries), generate an appropriate JQL query.
Take into account the conversation history when determining the query type and generating JQL.

Guidelines for JQL:
- Use proper JQL syntax with quotes around values containing spaces
- Use relative dates like -1w, startOfWeek(), endOfWeek() for time-based queries
- Include all relevant conditions (status, priority, project, type, etc.)
- Don't include ORDER BY clauses (they're added automatically)
- Consider context from previous messages when building the query

Output your response in this exact JSON format:
{{
    "type": "TEMPORAL/STATUS_BASED/SEMANTIC/HYBRID",
    "needs_jira_api": true/false (true if JQL would be helpful),
    "needs_rag": true/false (true if semantic search would be helpful),
    "jql": "complete JQL expression" or null
}}

Examples:

Q: "What issues were closed last week?"
{{
    "type": "TEMPORAL",
    "needs_jira_api": true,
    "needs_rag": false,
    "jql": "status = \\"Closed\\" AND resolved >= startOfWeek(-1)"
}}

Q: "Show me all high priority bugs in the Phoenix project"
{{
    "type": "STATUS_BASED",
    "needs_jira_api": true,
    "needs_rag": false,
    "jql": "project = \\"Phoenix\\" AND priority = \\"High\\" AND type = \\"Bug\\""
}}

Q: "Find issues similar to PROJ-123"
{{
    "type": "SEMANTIC",
    "needs_jira_api": false,
    "needs_rag": true,
    "jql": null
}}

Q: "What are the current blockers in our sprint?"
{{
    "type": "STATUS_BASED",
    "needs_jira_api": true,
    "needs_rag": false,
    "jql": "sprint in openSprints() AND priority = \\"Blocker\\""
}}

Q: "What bugs were reported in the last month that mention authentication?"
{{
    "type": "HYBRID",
    "needs_jira_api": true,
    "needs_rag": true,
    "jql": "type = \\"Bug\\" AND created >= startOfMonth(-1)"
}}"""

    response = co.chat(
        message=prompt,
        model="command-r-plus",
        temperature=0
    )
    
    try:
        # Extract JSON from the response text
        start_idx = response.text.find('{')
        end_idx = response.text.rfind('}') + 1
        
        if start_idx == -1 or end_idx == 0:
            raise ValueError("No JSON object found in response")
            
        json_str = response.text[start_idx:end_idx]
        print(f"\nExtracted JSON string: {json_str}")
        
        classification = json.loads(json_str)
        print(f"Classification Result: {json.dumps(classification, indent=2)}")
        return classification
    except Exception as e:
        print(f"Failed to parse classification response: {str(e)}")
        print(f"Raw response: {response.text}")
        return {
            "type": "SEMANTIC",
            "needs_jira_api": False,
            "needs_rag": True,
            "jql": None
        }

def get_jira_issues(jql: str) -> str:
    """Fetch issues from Jira API using JQL."""
    print("\n=== Jira API Search ===")
    print(f"JQL Query: {jql}")
    
    try:
        # Add default ordering if not present
        if "ORDER BY" not in jql.upper():
            jql = f"{jql} ORDER BY updated DESC"
        
        print(f"Final JQL Query: {jql}")
        
        try:
            issues = jira.search_issues(jql, maxResults=50)
            print(f"Found {len(issues)} matching issues")
        except Exception as e:
            print(f"JQL Query failed: {jql}")
            print(f"Error: {str(e)}")
            raise e
        
        # Format results
        if not issues:
            print("No issues found")
            return "No issues found matching the criteria."
            
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
    except Exception as e:
        print(f"Error in get_jira_issues: {str(e)}")
        return f"Error fetching issues: {str(e)}"

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
    print("\n=== Semantic Search ===")
    print(f"Query: {query}")
    
    # Generate query embedding
    query_embedding = get_embedding(query)
    print("Generated query embedding")

    # Query the Pinecone index
    search_results = index.query(
        vector=query_embedding,
        top_k=top_k,
        include_metadata=True
    )
    print(f"Found {len(search_results['matches'])} semantic matches")

    return search_results

@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

@app.post("/answer")
def answer(request: ConversationRequest):
    print("\n========== New Request ==========")
    print(f"Question: {request.question}")
    print(f"Conversation History Length: {len(request.conversation_history)}")
    
    # Classify the query and get JQL, now including conversation history
    classification = classify_query(request.question, request.conversation_history)
    
    # Initialize context strings
    rag_context = ""
    jira_api_context = ""
    
    # Get RAG results if needed
    if classification["needs_rag"]:
        print("\nPerforming semantic search...")
        results = semantic_search(request.question)
        print(f"Processing {len(results['matches'])} semantic search results")
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
    if classification["needs_jira_api"] and classification["jql"]:
        print("\nPerforming Jira API search...")
        jira_api_context = get_jira_issues(classification["jql"])

    # Combine contexts
    print("\n=== Final Context ===")
    combined_context = ""
    if rag_context and jira_api_context:
        print("Using both semantic search and Jira API results")
        combined_context = f"""Information from semantic search:
{rag_context}

Information from Jira API:
{jira_api_context}"""
    elif rag_context:
        print("Using only semantic search results")
        combined_context = rag_context
    else:
        print("Using only Jira API results")
        combined_context = jira_api_context

    # Create preamble with search results and instructions
    preamble = f"""You are a helpful Jira assistant. Use the following Jira information to help answer questions.
Format your responses in markdown format to make them easy to read and understand. Use \n to add newlines.
When referring to specific Jira issues, always include their keys.

Query type: {classification["type"]}
Relevant Jira information:
{combined_context}"""

    print("\n=== Conversation History ===")
    # Format conversation history for Cohere
    chat_history = []
    for msg in request.conversation_history:
        chat_history.append({
            "role": "user" if msg.role == "user" else "chatbot",
            "message": msg.content
        })
        print(f"{msg.role}: {msg.content[:100]}...")

    print("\nSending request to Cohere...")
    # Get response from Cohere
    response = co.chat(
        model="command-r-plus",
        preamble=preamble,
        chat_history=chat_history,
        message=request.question,
        temperature=0
    )
    
    print("\n=== Response Generated ===")
    print(f"Response length: {len(response.text)} characters")
    print("="*30)
    print(response.text)
    
    # Ensure newlines are preserved in the response
    
    return response.text
