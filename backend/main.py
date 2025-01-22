from fastapi import FastAPI, HTTPException
import os
from pinecone import Pinecone
import cohere
from fastapi.middleware.cors import CORSMiddleware
import dotenv
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List

# Load environment variables from .env file
load_dotenv()

# Now you can access your API keys
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
COHERE_API_KEY = os.getenv("COHERE_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

app = FastAPI()

pc = Pinecone(api_key=PINECONE_API_KEY)
INDEX_NAME = "jira-documents"
co = cohere.Client(api_key=COHERE_API_KEY)

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
    # Get search results for the current question
    results = semantic_search(request.question)
    
    # Format search results
    search_context = ""
    for match in results['matches']:
        metadata = match['metadata']
        search_context += f"\nProject: {metadata['project']}\n"
        search_context += f"Issue Key: {metadata['issue_key']}\n"
        search_context += f"Summary: {metadata['summary']}\n"
        search_context += f"Description: {metadata['description']}\n"
        search_context += f"Assignee: {metadata['assignee']}\n"
        search_context += f"Status: {metadata['status']}\n"
        search_context += f"Issue Type: {metadata['issue_type']}\n"
        search_context += "-" * 50 + "\n"

    # Create preamble with search results and instructions
    preamble = f"""You are a helpful Jira assistant. Use the following Jira information to help answer questions.
When referring to specific Jira issues, always include their keys.

Relevant Jira information:
{search_context}"""

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
    
    #return response.text[1:-1]
    response2 = co.chat(
        message=f"Please format the response in markdown to make it easy to read and understand. Answer in markdown. Here is the response that needs formatting: {response.text}",
        model="command-r-plus",
        temperature=0
    )
    return response2.text
