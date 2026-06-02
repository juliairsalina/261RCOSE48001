# Reeracify

AI-powered resume optimizer. Upload your resume, get an ATS score, AI rewrite suggestions, a tailored cover letter, and matching job listings — all in one place.

**Live app:** [reeracify.vercel.app](https://reeracify.vercel.app)  
**API:** [reeracify-backend.onrender.com](https://reeracify-backend.onrender.com)  
**API Docs:** [reeracify-backend.onrender.com/docs](https://reeracify-backend.onrender.com/docs)

---

## How It Works (Plain English)

```
You upload a resume PDF
        │
        ▼
Backend extracts text → GPT-5 parses into structured JSON → chunks stored in pgvector
        │
        ▼
You land on the 5-tab editor
        │
        ├─ Analysis tab    → RAG retrieves relevant chunks → GPT-4o scores resume (0-100)
        │                    + identifies missing keywords, weak bullets
        │
        ├─ Rewrites tab    → GPT-4o rewrites each bullet point → you approve/reject
        │
        ├─ Cover Letter    → GPT-4o writes a tailored cover letter from resume + job context
        │
        ├─ Find Jobs       → JSearch or OpenAI web search finds real job postings
        │                    → click "Evaluate Fit" → instantly scores your resume vs that job
        │
        └─ Career Profile  → GPT-4o generates: target roles, skills, seniority, search queries
                             → "Search Jobs with this Profile" one-click flow
        │
        ▼
Download optimized DOCX with accepted rewrites applied
```

---

## Cloud Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER BROWSER                               │
│                    Next.js 16 + React 19 (Vercel)                       │
│  ┌──────────────┐    ┌─────────────────────────────────────────────┐    │
│  │  Home Page   │    │         Edit Resume (/edit-resume)          │    │
│  │  (page.js)   │    │  ┌──────────┬─────────┬──────────────────┐  │    │
│  │              │    │  │Analysis  │Rewrites │Cover Letter       │  │    │
│  │ Upload PDF   │    │  ├──────────┼─────────┼──────────────────┤  │    │
│  │ Show level   │    │  │Find Jobs │        Career Profile       │  │    │
│  │ "Continue"   │    │  └──────────┴───────────────────────────┘  │    │
│  └──────┬───────┘    └───────────────────┬─────────────────────────┘    │
└─────────┼─────────────────────────────────┼────────────────────────────┘
          │ HTTPS API calls                 │ HTTPS API calls
          ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Render)                              │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                      API Routers                               │     │
│  │  /resumes/*   /applications/*   /jobs/*   /rewrite-suggestions │     │
│  └───────────────────────────┬────────────────────────────────────┘     │
│                              │                                           │
│  ┌───────────────────────────▼────────────────────────────────────┐     │
│  │                   LangGraph Agents                             │     │
│  │                                                                 │     │
│  │  resume_parser ──► ats_evaluator ──► rewrite_agent             │     │
│  │                                                                 │     │
│  │  candidate_profile_agent    cover_letter_agent                  │     │
│  │                                                                 │     │
│  │  rag_retriever ──► job_analyzer ──► company_research           │     │
│  └───────────────────────────┬────────────────────────────────────┘     │
│                              │                                           │
│  ┌────────────────┐  ┌───────▼──────┐  ┌─────────────────────────┐     │
│  │ document_      │  │ openai_      │  │ job_search_service      │     │
│  │ parser.py      │  │ client.py    │  │ (JSearch / OpenAI web)  │     │
│  │ (pypdf/docx)   │  │ embeddings   │  └─────────────────────────┘     │
│  └────────────────┘  └──────────────┘                                   │
└──────────────┬──────────────────────────────────────────────────────────┘
               │
    ┌──────────┼───────────────────────────┐
    ▼          ▼                           ▼
┌────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│OpenAI  │  │  Supabase (Postgres) │  │  JSearch / RapidAPI  │
│        │  │                      │  │                      │
│ GPT-5  │  │  resumes             │  │  Job search API      │
│ GPT-4o │  │  resume_chunks       │  │  10 countries        │
│ embed  │  │  (pgvector 1536-dim) │  └──────────────────────┘
│ web_   │  │  applications        │
│ search │  │  ats_evaluations     │  ┌──────────────────────┐
└────────┘  │  rewrite_suggestions │  │  Supabase Storage    │
            │  candidate_profiles  │  │                      │
            │  job_posts           │  │  Uploaded PDFs/DOCX  │
            │  cover_letters       │  │  Exported DOCX files │
            └──────────────────────┘  └──────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16, React 19, Tailwind 4 | UI, resume preview, 5-tab editor |
| **Backend** | FastAPI, Python 3.12, Uvicorn | REST API, async request handling |
| **AI / LLM** | OpenAI GPT-5, GPT-4o | Parsing, evaluation, rewrites, cover letters |
| **Embeddings** | OpenAI text-embedding-3-small | Resume chunk vectorization for RAG |
| **Agents** | LangGraph 0.2+, LangChain 0.3+ | Stateful multi-step AI workflows |
| **Database** | Supabase Postgres + pgvector | Structured data + vector similarity search |
| **File Storage** | Supabase Storage | PDF/DOCX uploads and exports |
| **Job Search** | JSearch (RapidAPI) or OpenAI web_search_preview | Real job postings |
| **Observability** | LangSmith | Agent tracing + debugging |
| **Hosting** | Vercel (frontend), Render (backend) | Auto-deploy on git push |
| **File Parsing** | pypdf, python-docx | Extract text from PDF/DOCX |

### What LangChain and LangGraph actually do here

**LangChain** is a toolkit for calling LLMs in a structured way. Instead of writing raw `openai.chat.completions.create(...)` calls everywhere, LangChain provides:
- Prompt templates — reusable prompt structures with variable slots
- Output parsers — convert raw LLM text output into Python dicts/objects
- LLM wrappers — one consistent interface regardless of which model you use

In this project LangChain handles the `chat_completion()` calls inside each agent (system prompt + user message → parsed JSON output).

**LangGraph** is built on top of LangChain and adds **stateful multi-step workflows**. Think of it like a flowchart where each box is an AI agent node:
- You define nodes (functions) and edges (connections between them)
- A shared `AgentState` dict flows through every node — each node reads what it needs and writes its result back
- Nodes can run sequentially, in parallel, or conditionally (e.g. skip company research if no job selected)
- The graph can **pause and wait** for human input (e.g. user picks a job, user approves rewrites) then resume

In this project the full workflow is:
```
parse_resume → candidate_profile → [user picks job] → retrieve_context → ats_evaluate → rewrite → cover_letter
```
Without LangGraph you would have to manually pass data between each step and track state yourself. LangGraph handles all of that.

**LangSmith** is the observability layer — it records every LLM call, input, output, latency, and token count so you can debug exactly what each agent did.

---

## Feature Walkthrough

### 1. Upload Resume → Home Page
- Accepts PDF or DOCX
- Backend extracts text, GPT-5 parses into structured JSON (name, email, skills, experience, projects, education)
- Embeds text chunks into pgvector for later RAG retrieval
- Frontend shows name, "Continue to Edit" button

### 2. Analysis Tab
Evaluates your resume quality (no job) or fit against a job posting.

**How the score works:**

| Mode | Scoring Logic |
|------|--------------|
| No job posting | Contact (8pts) + Education (7pts) + Skills (15+2/skill) + Experience (10+8/each) + Bullets (5+2/each) + Projects (5+5/each) |
| With job posting | Required skills match (40pts) + Preferred skills (20pts) + Responsibilities (15pts) + Keyword density (10pts) + floors to keep scores encouraging |

Score displayed as: `Beginner (하)` / `Intermediate (중)` / `Advanced (상)`

### 3. Rewrites Tab
- GPT-4o rewrites each bullet with added metrics, action verbs, and keywords
- Click any suggestion → highlighted in the resume preview
- Approve ✓ or Reject ✗ — status saved to DB
- Approved rewrites apply when you export

### 4. Cover Letter Tab
- Generates a tailored cover letter using resume + job context
- Edit directly in the textarea
- Copy to clipboard or download as `.txt`

### 5. Find Jobs Tab
- Select country (🇺🇸 US, 🇸🇬 SG, 🇬🇧 UK, 🇨🇦 CA, 🇩🇪 DE, 🇦🇺 AU, 🇳🇱 NL, 🇯🇵 JP, 🇰🇷 KR, 🇮🇳 IN)
- Optional city/remote filter
- Queries built from your Career Profile's `target_roles` (e.g. "Machine Learning Engineer")
- Click **Evaluate Fit** on any job card → instantly runs full ATS evaluation for that job

### 6. Career Profile Tab
- Generates: seniority level, 3-5 target roles, core skills, domain interests, job search queries
- **Search Jobs with this Profile** runs Find Jobs using those target roles as queries

### 7. Download
- Click Download → backend applies approved rewrites, generates DOCX
- Uploaded to Supabase Storage → browser downloads it

---

## API Endpoints

### Resumes
| Method | Path | What it does |
|--------|------|-------------|
| `POST` | `/resumes/upload` | Parse PDF/DOCX, embed chunks, return `resume_id` + `parsed_json` |
| `POST` | `/resumes/{id}/candidate-profile` | Generate career profile (target roles, skills, queries) |

### Applications (the core evaluation flow)
| Method | Path | What it does |
|--------|------|-------------|
| `POST` | `/applications/create` | Link a resume to a job post → returns `application_id` |
| `GET`  | `/applications/{id}` | Fetch application details |
| `POST` | `/applications/{id}/retrieve-context` | RAG: pgvector similarity search, saves chunks |
| `POST` | `/applications/{id}/evaluate` | ATS score 0-100, matched/missing skills, weaknesses |
| `POST` | `/applications/{id}/rewrite-suggestions` | Per-bullet AI rewrites |
| `POST` | `/applications/{id}/cover-letter` | Generate tailored cover letter |
| `POST` | `/applications/{id}/export-resume` | Apply accepted rewrites → DOCX download URL |

### Jobs
| Method | Path | What it does |
|--------|------|-------------|
| `POST` | `/jobs/search-web` | Search real job postings (JSearch or OpenAI web) |
| `POST` | `/jobs/discover` | Discover jobs from candidate profile (alternative flow) |
| `POST` | `/jobs/{id}/analyze` | Deep-extract requirements from a job posting |
| `POST` | `/job-posts/create` | Create a job post from a URL |

### Other
| Method | Path | What it does |
|--------|------|-------------|
| `PATCH` | `/rewrite-suggestions/{id}` | Approve or reject a suggestion |
| `GET`  | `/cover-letters/{id}` | Fetch saved cover letter |
| `GET`  | `/health` | Liveness check |
| `GET`  | `/health/openai` | Test OpenAI API connectivity |

---

## Backend Agents (LangGraph)

Each agent is a **LangGraph node** — an async function that reads from shared `AgentState`, calls an LLM or service, and writes results back to state. The nodes are wired into a DAG (directed acyclic graph).

```
                    resume_parser_agent
                          │
                          ▼
               candidate_profile_agent          ← called by /resumes/{id}/candidate-profile
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
   rag_retriever    job_analyzer    (user picks job)
           │              │
           └──────┬────────┘
                  ▼
           ats_evaluator_agent                   ← called by /applications/{id}/evaluate
                  │
                  ▼
           rewrite_agent                         ← called by /applications/{id}/rewrite-suggestions
                  │
                  ▼
           cover_letter_agent                    ← called by /applications/{id}/cover-letter
```

### Agent Summary

| Agent | Model | Input → Output |
|-------|-------|----------------|
| `resume_parser` | GPT-5 | raw text → structured JSON (name, email, skills, experience…) |
| `candidate_profile` | GPT-4o | parsed JSON → target roles, core skills, search queries |
| `rag_retriever` | pgvector | job description → top N relevant resume chunks |
| `ats_evaluator` | GPT-4o | resume + job + chunks → score 0-100, missing skills, weaknesses |
| `rewrite_agent` | GPT-4o | resume + ATS result → bullet-level rewrites with reasons |
| `cover_letter_agent` | GPT-4o | resume + job + ATS result → full cover letter |
| `job_analyzer` | GPT-4o | job description → required skills, seniority, job type |
| `company_research` | optional MCP | company name → background info |

### Shared State

All nodes read/write a single `AgentState` TypedDict:

```python
{
  "user_id": str,
  "resume_id": str,
  "resume_json": dict,          # parsed resume
  "candidate_profile": dict,    # target roles, skills
  "job_json": dict,             # selected job details
  "retrieved_context": list,    # pgvector search results
  "ats_result": dict,           # score + matched/missing skills
  "rewrite_suggestions": list,  # per-bullet suggestions
  "cover_letter": str,          # generated text
  "errors": list[str],          # non-fatal errors collected
}
```

---

## Database Schema (Supabase)

```
users
  └── resumes (file_url, parsed_json, raw_text)
        └── resume_chunks (text, embedding vector(1536))   ← pgvector RAG
        └── candidate_profiles (profile_json, search_queries)
        └── applications ──────────────────┐
              └── retrieved_contexts        │ links resume ↔ job_post
              └── ats_evaluations           │
              └── rewrite_suggestions       │
              └── cover_letters             │
                                            ▼
                                        job_posts (company, role, description)
                                            └── job_recommendations (match_score)
```

**Key pgvector detail:** Resume chunks use cosine similarity search via the `match_resume_chunks()` RPC function. Embedding model: `text-embedding-3-small` (1536 dimensions).

---

## Setup — Run Locally

### Prerequisites
- Python 3.12
- Node.js 18+
- Supabase project (free tier works)
- OpenAI API key

### 1. Clone
```bash
git clone https://github.com/juliairsalina/reeracify.git
cd reeracify
```

### 2. Backend
```bash
cd backend

# Create virtual environment (recommended: uv)
pip install uv
uv venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env — fill in OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Run
.venv/bin/uvicorn app.main:app --reload --port 8000
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3. Frontend
```bash
cd frontend
npm install

# Configure
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local

# Run
npm run dev
# App available at http://localhost:3000
```

### Environment Variables

**Backend** (`backend/.env`):
```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Job Search (pick one)
JOB_SEARCH_PROVIDER=jsearch        # use "openai_web" if no JSearch key
JSEARCH_API_KEY=your_rapidapi_key  # get free key at rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
JSEARCH_COUNTRY=us

# Optional
OPENAI_MODEL=gpt-5
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
LANGCHAIN_PROJECT=career-application-agent
```

**Frontend** (`frontend/.env.local`):
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Deployment

### Render (Backend)
1. Connect GitHub repo → New Web Service
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add all env vars from `backend/.env` in the Render dashboard
5. Auto-deploys on every push to `julia/backend-new`

### Vercel (Frontend)
1. Import GitHub repo → Framework: Next.js
2. Add env var: `NEXT_PUBLIC_API_BASE_URL=https://reeracify-backend.onrender.com`
3. Auto-deploys on every push

---

## Job Search Providers

The job search is pluggable — set `JOB_SEARCH_PROVIDER` in `.env`:

| Provider | Key | Notes |
|----------|-----|-------|
| `jsearch` | `JSEARCH_API_KEY` | Best quality. Free tier: 200 req/month. [Get key](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) |
| `openai_web` | (uses OPENAI_API_KEY) | No extra key needed. Burns OpenAI tokens (~$0.01/search) |
| `dummy` | none | Returns 3 hardcoded jobs. For testing only |

**Country codes** supported in UI: `us`, `sg`, `gb`, `ca`, `de`, `au`, `nl`, `jp`, `kr`, `in`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `No module named 'pypdf'` | `uv pip install pypdf pycryptodome` |
| Backend 403/429 on job search | JSearch key missing or free tier exhausted. Set `JOB_SEARCH_PROVIDER=openai_web` as fallback |
| OpenAI timeout error | Normal with GPT-5 on long prompts. Retried up to 3x automatically. Try again |
| `Method Not Allowed` (405) | Wrong HTTP method — make sure you're using the UI, not visiting the URL directly |
| Resume parse returns `{}` | Check `OPENAI_API_KEY` is set and valid |
| Jobs found: 0 | Generate Career Profile first (provides `target_roles` for better queries), or try a different country |
| Supabase `Invalid API key` | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` |
| `pyo3_runtime.PanicException` on PDF | Known cryptography C extension conflict. Fixed by `pycryptodome` in requirements |

---

## File Structure

```
reeracify/
├── backend/
│   ├── app/
│   │   ├── agents/                    # LangGraph nodes (8 agents)
│   │   │   ├── resume_parser_agent.py
│   │   │   ├── ats_evaluator_agent.py
│   │   │   ├── rewrite_agent.py
│   │   │   ├── cover_letter_agent.py
│   │   │   ├── candidate_profile_agent.py
│   │   │   ├── job_analyzer_agent.py
│   │   │   ├── rag_retriever_agent.py
│   │   │   └── company_research_agent.py
│   │   ├── api/                       # FastAPI route handlers
│   │   │   ├── resumes.py             # /resumes/*
│   │   │   ├── applications.py        # /applications/*
│   │   │   ├── jobs.py                # /jobs/*
│   │   │   ├── job_posts.py           # /job-posts/*
│   │   │   ├── rewrites.py            # /rewrite-suggestions/*
│   │   │   └── cover_letters.py       # /cover-letters/*
│   │   ├── services/                  # Shared utilities
│   │   │   ├── openai_client.py       # GPT + embeddings wrapper
│   │   │   ├── supabase_client.py     # DB client
│   │   │   ├── job_search_service.py  # JSearch / OpenAI web / dummy
│   │   │   ├── document_parser.py     # PDF/DOCX text extraction
│   │   │   ├── embedding_service.py   # Chunk + embed resume text
│   │   │   ├── vector_store.py        # pgvector storage/retrieval
│   │   │   └── docx_exporter.py       # Generate DOCX with rewrites
│   │   ├── schemas/                   # Pydantic models
│   │   ├── db/schema.sql              # Supabase table definitions
│   │   ├── config.py                  # Settings (pydantic-settings)
│   │   └── main.py                    # FastAPI app + CORS + routers
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/app/
│   │   ├── page.js                    # Home: upload + parse status
│   │   ├── edit-resume/page.js        # 5-tab resume editor (main file)
│   │   ├── contact/page.js
│   │   ├── layout.js
│   │   └── globals.css
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
│
├── README.md
├── AGENTS.md                          # Breaking changes notice for LLM agents
└── CLAUDE.md
```
