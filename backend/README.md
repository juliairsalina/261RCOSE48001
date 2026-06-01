# Career Application AI Agent — Backend

A FastAPI backend that automates the entire career application process using AI agents, RAG-based resume matching, ATS evaluation, and intelligent resume rewriting.

---

## Project Overview

This backend provides an end-to-end AI-powered pipeline that takes a candidate from raw resume upload to a polished, ATS-optimised resume and personalised cover letter — all in a guided, human-in-the-loop workflow.

---

## MVP Features

1. **Resume Upload & Parsing** — Upload PDF or DOCX; GPT-4o extracts structured JSON (name, experience, skills, education, etc.)
2. **Semantic Chunking & Embedding** — LangChain splits resume text; OpenAI embeddings stored in Supabase pgvector
3. **Candidate Profile Generation** — GPT infers target roles, seniority, core skills, and generates 5–8 job search queries
4. **Job Discovery** — Adzuna API search (with realistic dummy fallback); each result scored and ranked for fit
5. **Job Analysis** — GPT extracts structured requirements (required/preferred skills, responsibilities, keywords) from job postings
6. **RAG Retrieval** — Cosine similarity search pulls the most relevant resume chunks for the selected job
7. **ATS Evaluation** — Deterministic scoring (0–100) + GPT qualitative analysis with rank (상/중/하)
8. **Resume Rewrite Suggestions** — GPT generates targeted rewrite suggestions; user approves/rejects each
9. **Resume DOCX Export** — Approved rewrites applied; styled DOCX generated with python-docx and uploaded to Supabase Storage
10. **Cover Letter Generation** — GPT writes a 250–400 word personalised cover letter using all gathered context
11. **LangSmith Tracing** — All agent runs traced via LangSmith for observability and debugging

---

## Architecture

```
Client (Next.js / Mobile)
        |
        v
   FastAPI Backend (app/main.py)
        |
   ┌────┴──────────────────────────────┐
   │  API Routers                       │
   │  /resumes   /jobs   /applications  │
   │  /rewrite-suggestions  /cover-letters│
   └────┬──────────────────────────────┘
        |
   ┌────┴────────────────────────────────────┐
   │  LangGraph Agent Workflow               │
   │                                         │
   │  parse_resume                           │
   │       ↓                                 │
   │  create_candidate_profile               │
   │       ↓                                 │
   │  discover_jobs                          │
   │       ↓ [HUMAN PAUSE: select job]       │
   │  analyze_selected_job                   │
   │       ↓                                 │
   │  retrieve_resume_context (RAG)          │
   │       ↓                                 │
   │  evaluate_ats                           │
   │       ↓                                 │
   │  generate_rewrite_suggestions           │
   │       ↓ [HUMAN PAUSE: approve rewrites] │
   │  export_resume                          │
   │       ↓                                 │
   │  generate_cover_letter                  │
   └────┬────────────────────────────────────┘
        |
   ┌────┴─────────────────────┐
   │  External Services       │
   │  OpenAI GPT-4o           │
   │  Supabase (Postgres +    │
   │    Storage + pgvector)   │
   │  Adzuna Job Search API   │
   │  LangSmith Tracing       │
   └──────────────────────────┘
```

---

## Tech Stack

| Component         | Technology                         |
|-------------------|------------------------------------|
| Web Framework     | FastAPI 0.115+                     |
| AI / LLM          | OpenAI GPT-4o (via openai SDK)     |
| Agent Workflow    | LangGraph 0.2+                     |
| LLM Helpers       | LangChain 0.3+                     |
| Observability     | LangSmith                          |
| Database          | Supabase (PostgreSQL)              |
| Vector Search     | pgvector (1536-dim, ivfflat index) |
| File Storage      | Supabase Storage                   |
| Embeddings        | OpenAI text-embedding-3-small      |
| Job Search        | Adzuna REST API                    |
| Resume Parsing    | pypdf, python-docx                 |
| DOCX Export       | python-docx                        |
| HTTP Client       | httpx (async)                      |
| Validation        | Pydantic v2                        |
| Config            | pydantic-settings                  |
| Testing           | pytest + pytest-asyncio            |

---

## RAG — Retrieval-Augmented Generation

The RAG pipeline ensures GPT evaluations and rewrites are grounded in the candidate's actual resume content:

1. **Indexing** (at upload time): Resume text is split into ~800-token chunks using LangChain's `RecursiveCharacterTextSplitter`. Each chunk is embedded with `text-embedding-3-small` (1536 dimensions) and stored in the `resume_chunks` table with pgvector.

2. **Retrieval** (at evaluation time): A retrieval query is built from the job's `required_skills + keywords + responsibilities`. This query is embedded and used to perform cosine similarity search via a Supabase RPC function (`match_resume_chunks`), returning the top-5 most relevant chunks.

3. **Augmentation**: The retrieved chunks are passed alongside the job requirements to GPT for ATS evaluation, rewrite suggestions, and cover letter generation — ensuring outputs reference real evidence from the resume.

---

## Agent Descriptions

| Agent | File | Responsibility |
|-------|------|----------------|
| Resume Parser | `agents/resume_parser_agent.py` | Extracts structured JSON from raw resume text using GPT-4o |
| Candidate Profile | `agents/candidate_profile_agent.py` | Infers target roles, skills, and generates search queries |
| Job Discovery | `agents/job_discovery_agent.py` | Searches Adzuna, scores and ranks job matches |
| Job Analyzer | `agents/job_analyzer_agent.py` | Extracts structured requirements from job descriptions |
| RAG Retriever | `agents/rag_retriever_agent.py` | Retrieves relevant resume chunks via pgvector cosine search |
| ATS Evaluator | `agents/ats_evaluator_agent.py` | Scores resume vs job (0-100), GPT generates qualitative feedback |
| Rewrite Agent | `agents/rewrite_agent.py` | Suggests targeted resume improvements without inventing experience |
| Cover Letter | `agents/cover_letter_agent.py` | Writes a 250-400 word personalised cover letter |

---

## LangChain vs LangGraph vs LangSmith

**LangChain** provides utility components used throughout the codebase:
- `RecursiveCharacterTextSplitter` for chunking resume text
- Prompt template helpers
- OpenAI wrapper utilities

**LangGraph** orchestrates the multi-step agent workflow as a directed graph (`StateGraph`). It manages:
- State passing between nodes (each node receives and returns `AgentState`)
- Human-in-the-loop interrupts (`interrupt_before=["analyze_selected_job", "export_resume"]`)
- Conditional routing and error propagation

**LangSmith** provides observability:
- Traces every LLM call with inputs, outputs, latency, and token usage
- Enables debugging of agent runs in the LangSmith dashboard
- Configured via `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY`

---

## Supabase Setup

### 1. Enable pgvector

In your Supabase project, go to **SQL Editor** and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Run the Schema

Copy the contents of `app/db/schema.sql` and run it in the Supabase SQL Editor. This creates all tables, constraints, and the ivfflat vector index.

### 3. Create the match_resume_chunks Function

The RAG retriever calls a Supabase RPC function for vector similarity search. Run this in the SQL Editor:

```sql
CREATE OR REPLACE FUNCTION match_resume_chunks(
  query_embedding vector(1536),
  resume_id_filter uuid,
  match_count int
)
RETURNS TABLE (
  id uuid, chunk_text text, section text, similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT id, chunk_text, section,
         1 - (embedding <=> query_embedding) AS similarity
  FROM resume_chunks
  WHERE resume_id = resume_id_filter
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 4. Create Storage Bucket

In Supabase Dashboard → Storage → Create a new bucket named `resumes` (or the value of `SUPABASE_BUCKET`). Set it to public if you want public file URLs.

---

## Environment Variable Setup

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
LANGCHAIN_API_KEY=ls__...          # Optional: for LangSmith tracing
ADZUNA_APP_ID=your_app_id         # Optional: falls back to dummy jobs
ADZUNA_APP_KEY=your_app_key
```

---

## How to Run

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

Interactive API docs: `http://localhost:8000/docs`

---

## How to Run Tests

```bash
cd backend
pytest app/tests/ -v
```

Run a specific test file:

```bash
pytest app/tests/test_ats_evaluator.py -v
```

---

## API Usage Examples

### Upload a Resume

```bash
curl -X POST http://localhost:8000/resumes/upload \
  -F "file=@/path/to/resume.pdf" \
  -F "user_id=user-123"
```

### Generate Candidate Profile

```bash
curl -X POST http://localhost:8000/resumes/{resume_id}/candidate-profile \
  -F "user_id=user-123"
```

### Discover Jobs

```bash
curl -X POST http://localhost:8000/jobs/discover \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123", "resume_id": "resume-456", "location": "San Francisco"}'
```

### Analyze a Job

```bash
curl -X POST http://localhost:8000/jobs/{job_post_id}/analyze \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123"}'
```

### Create an Application

```bash
curl -X POST http://localhost:8000/applications/create \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123", "resume_id": "resume-456", "job_post_id": "job-789"}'
```

### Run RAG Retrieval

```bash
curl -X POST http://localhost:8000/applications/{application_id}/retrieve-context \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123"}'
```

### Evaluate ATS Score

```bash
curl -X POST http://localhost:8000/applications/{application_id}/evaluate \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123"}'
```

### Get Rewrite Suggestions

```bash
curl -X POST http://localhost:8000/applications/{application_id}/rewrite-suggestions \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123"}'
```

### Approve a Rewrite Suggestion

```bash
curl -X PATCH http://localhost:8000/rewrite-suggestions/{suggestion_id} \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

### Export Resume as DOCX

```bash
curl -X POST http://localhost:8000/applications/{application_id}/export-resume \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123"}'
```

### Generate Cover Letter

```bash
curl -X POST http://localhost:8000/applications/{application_id}/cover-letter \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123"}'
```

### Get Cover Letter

```bash
curl http://localhost:8000/cover-letters/{application_id}
```

### Health Check

```bash
curl http://localhost:8000/health
```

---

## Future Work

- **Browser MCP Integration**: Replace placeholder `company_research_service.py` with real Browser MCP calls to extract company background from websites and LinkedIn
- **Multi-language Support**: Extend resume parsing and cover letter generation to support Korean, Japanese, and other languages
- **Resume Template Themes**: Multiple DOCX export templates (minimal, modern, academic)
- **Real-time Progress**: WebSocket endpoint to stream agent progress to the client
- **Application Tracking Dashboard**: Track the status of all applications in a unified view
- **Interview Prep Agent**: Generate tailored interview questions and STAR-method answers from the resume and job requirements
- **Batch Job Discovery**: Schedule periodic job search runs and notify users of new high-match opportunities
- **PDF Export**: In addition to DOCX, generate a styled PDF version of the resume
- **Resume Version History**: Track all rewrite iterations with diff view
- **Feedback Loop**: Collect user feedback on suggestion quality to fine-tune prompts over time
