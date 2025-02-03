# 🛠️ JiraChat (RAG-Powered)

### A smart AI-powered chatbot that allows users to query their Jira projects using **Retrieval-Augmented Generation (RAG)** and function calling.

## 🚀 Features
- **Natural Language Queries**: Ask questions about your Jira projects, issues, and tasks.
- **Hybrid Search**: Uses **vector embeddings (Pinecone)** for semantic search and **function calling** for direct Jira API queries when keyword-based retrieval is more effective.
- **Secure User Authentication**: Powered by **Supabase Auth**.
- **Data Privacy & Security**: Jira API keys and user-specific domain details are securely stored in **AWS Secrets Manager**.
- **Standalone Web App**: No need for integrations with external platforms—access your chatbot through a simple web interface.

---

## 🏗️ Tech Stack
| Component | Technology |
|-----------|------------|
| **LLM** | [Cohere](https://cohere.com/) |
| **Vector Database** | [Pinecone](https://www.pinecone.io/) |
| **Data Source** | [Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/) |
| **Authentication & Backend** | [Supabase (PostgreSQL)](https://supabase.com/) |
| **Secrets Management** | [AWS Secrets Manager](https://aws.amazon.com/secrets-manager/) |
| **Frontend** | [React](https://react.dev/) |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) |

---

## 🔍 How It Works

1. **User Authentication**: Logs in via Supabase.
2. **Retrieves User Data**: Fetches stored Jira API key and domain from AWS Secrets Manager.
3. **Processes Queries**:
   - Uses **Pinecone** to retrieve similar Jira tickets/issues via vector embeddings.
   - If needed, calls Jira REST API directly using **LLM function calling** for better keyword-based results.
4. **Returns Intelligent Responses**: The chatbot generates summarized, context-aware responses based on retrieved Jira data.

---

## 🛡️ Security Considerations
- **API Keys Protection**: All user secrets are stored securely in **AWS Secrets Manager**.
- **Role-Based Access Control**: Users can only query Jira projects they have access to.
- **Rate Limiting**: To prevent API abuse, consider adding request limits.

---

## 📌 To-Do List
- [ ] Implement caching to reduce API calls.
- [ ] Improve UI/UX of the chatbot.
- [ ] Add support for multiple Jira accounts per user.
- [ ] Enable integration with Slack/Teams for direct Jira queries.
- [ ] Deploy to Production (Coming Soon..)

---

