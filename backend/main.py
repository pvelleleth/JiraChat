from fastapi import FastAPI
import os
from pinecone import Pinecone
import cohere
from fastapi.middleware.cors import CORSMiddleware
import dotenv
from dotenv import load_dotenv

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

@app.get("/answer")
def answer(question: str):
    results = semantic_search(question)

    print(f"Top {len(results['matches'])} results for your query:\n")
    for match in results['matches']:
        print(f"Score: {match['score']}")
        print(f"Metadata: {match['metadata']}\n")
        
    context = ""
    for match in results['matches']:
        metadata = match['metadata']
        context += f"\nProject: {metadata['project']}\n"
        context += f"Issue Key: {metadata['issue_key']}\n"
        context += f"Summary: {metadata['summary']}\n"
        context += f"Description: {metadata['description']}\n"
        context += f"Assignee: {metadata['assignee']}\n"
        context += f"Status: {metadata['status']}\n"
        context += f"Issue Type: {metadata['issue_type']}\n"
        context += "-" * 50 + "\n"

    # Ask LLM using retrieved context
    prompt = f"""Based on the following search results, please answer the question: "{question}"

Search Results:
{context}

Answer:"""

    response = co.chat(
        message=prompt,
        model="command-r-plus",
        temperature=0
    )
    prompt2 = f"Make sure to format the answer in a way that is easy to read and understand. Use markdown formatting for lists and other elements. Answer in markdown format. Answer: {response.text}"
    response2 = co.chat(
        message=prompt2,
        model="command-r-plus",
        temperature=0
    )
    return response2.text
