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

def classify_query(question: str) -> dict:
    """Use Cohere to classify the query type and generate JQL."""
    print("\n=== Query Classification and JQL Generation ===")
    print(f"Input Question: {question}")
    
    prompt = f"""You are a Jira query expert. Analyze the following question about Jira issues and:
1. Determine the most appropriate search strategy
2. Generate a JQL query if appropriate

Question: "{question}"

First, classify the query into one of these types:
1. TEMPORAL (questions about time periods, dates, recent changes)
2. STATUS_BASED (questions about issue states, progress)
3. SEMANTIC (questions about content, similarity, topics)
4. HYBRID (needs both temporal/status and semantic search)

Then, if the query would benefit from a JQL search (temporal, status-based, or hybrid queries), generate an appropriate JQL query.

Guidelines for JQL:
- Use proper JQL syntax with quotes around values containing spaces
- Use relative dates like -1w, startOfWeek(), endOfWeek() for time-based queries
- Include all relevant conditions (status, priority, project, type, etc.)
- Don't include ORDER BY clauses (they're added automatically)

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

def format_pipe_separated_text_to_table(text: str) -> str:
    """Convert pipe-separated text into a properly formatted markdown table."""
    lines = text.split('\n')
    formatted_lines = []
    max_lengths = {}  # To store the maximum length of each column
    
    # First pass: Split lines and calculate max lengths
    processed_lines = []
    for line in lines:
        # Split by pipe and clean up each cell
        cells = [cell.strip() for cell in line.split('|')]
        # Remove empty cells from start/end
        cells = [cell for cell in cells if cell]
        if cells:
            processed_lines.append(cells)
            # Update max lengths for each column
            for i, cell in enumerate(cells):
                max_lengths[i] = max(max_lengths.get(i, 0), len(cell))
    
    if not processed_lines:
        return text
    
    # Second pass: Format the table with proper spacing
    for i, cells in enumerate(processed_lines):
        # Pad each cell to match the max length of its column
        padded_cells = []
        for j, cell in enumerate(cells):
            if j < len(max_lengths):  # Only process cells that have a corresponding max length
                padded_cells.append(cell.ljust(max_lengths[j]))
        
        # Ensure consistent spacing around the pipe character
        formatted_lines.append(f"| {' | '.join(padded_cells)} |")
        
        # Add separator line after header with exactly three dashes per column
        if i == 0:
            separator = []
            for j in range(len(cells)):
                if j < len(max_lengths):
                    separator.append('-' * 3)  # Use exactly three dashes for each column
            formatted_lines.append(f"| {' | '.join(separator)} |")
    
    return '\n'.join(formatted_lines)

def format_jira_results(issues) -> str:
    """Format Jira issues into a clean markdown table."""
    if not issues:
        return "No issues found matching the criteria."
    
    # Define the columns we want to show
    headers = ["Project", "Issue Key", "Summary", "Status", "Assignee"]
    rows = [headers]  # Start with headers
    
    # Add data rows
    for issue in issues:
        row = [
            issue.fields.project.key,
            issue.key,
            issue.fields.summary,
            issue.fields.status.name,
            issue.fields.assignee.displayName if issue.fields.assignee else "Unassigned"
        ]
        rows.append(row)
    
    # Convert to pipe-separated format with proper spacing
    table_text = '\n'.join(' | '.join(str(cell) for cell in row) for row in rows)
    
    # Format into a proper table
    return format_pipe_separated_text_to_table(table_text)

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
            return format_jira_results(issues)
        except Exception as e:
            print(f"JQL Query failed: {jql}")
            print(f"Error: {str(e)}")
            raise e
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
    
    # Classify the query and get JQL
    classification = classify_query(request.question)
    
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
Format your responses in markdown format to make them easy to read and understand.
When referring to specific Jira issues, always include their keys.

When presenting tabular data, follow these strict markdown table formatting rules:
1. Always use proper markdown table syntax
2. Include exactly one space after and before each | character
3. Use consistent column widths
4. Include a header row and separator row
5. Example format:

| Column 1   | Column 2   | Column 3   |
|------------|------------|------------|
| Data 1     | Data 2     | Data 3     |
| Data 4     | Data 5     | Data 6     |

If you receive pipe-separated text that's not in proper table format, convert it to a proper markdown table.

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

    response_text = response.text
    # Check if the response contains pipe characters and try to format it as a table
    if '|' in response_text:
        response_text = format_pipe_separated_text_to_table(response_text)
    
    return response_text
