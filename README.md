# Reeracify

An AI-powered resume optimization platform that analyzes, rewrites, and evaluates resumes against job postings using LangGraph agents and MCP-powered web search.

**Live:** [reeracify.vercel.app](https://reeracify.vercel.app)  
**Backend:** [reeracify-backend.onrender.com](https://reeracify-backend.onrender.com)

---

## Architecture Overview

```
Frontend (Next.js on Vercel)      Backend (FastAPI on Render)         Storage (Supabase)
┌─────────────────────────┐      ┌──────────────────────────┐         ┌──────────────┐
│ page.js (Home)          │      │ POST /resumes/upload     │         │ Postgres DB  │
│ edit-resume/page.js     │◄────►│ POST /applications/*     │◄───────►│ pgvector     │
│ (5 tabs)                │      │ POST /jobs/search-web    │         │ Storage      │
└─────────────────────────┘      └──────────────────────────┘         └──────────────┘
                                         │
                                         ▼
                                  LangGraph Agents
                                  ├─ resume_parser
                                  ├─ ats_evaluator
                                  ├─ rewrite_agent
                                  ├─ cover_letter_agent
                                  ├─ candidate_profile_agent
                                  └─ job_analyzer_agent
```

### Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | Next.js 15 (App Router), React 18, Tailwind CSS, Lucide Icons |
| **Backend** | FastAPI (async), Python 3.9+, LangGraph, Pydantic v2 |
| **LLM** | OpenAI GPT-5 (text parsing), GPT-4o (analysis, rewrites, cover letters) |
| **Web Search** | OpenAI Responses API with `web_search_preview` MCP tool |
| **Database** | Supabase (Postgres + pgvector for embeddings) |
| **Hosting** | Vercel (frontend), Render (backend) |
| **CI/CD** | GitHub + auto-deploy on commit (Vercel, Render) |

---

## Project Flow

### 1. Resume Upload (Home Page)
User uploads PDF/DOC/DOCX file
- **Backend**: `POST /resumes/upload`
  - Document parser extracts raw text
  - GPT-5 parses into structured JSON (name, email, skills, experience, projects, etc.)
  - Text chunks embedded and stored in pgvector
  - Response includes: `resume_id`, `parsed_json`, `parse_status`, `chunks_ok`
- **Frontend**: Shows parse success/failure, displays parsed name, "Continue" button

### 2. Resume Editor (5 Tabs)
After upload, user lands on `/edit-resume` which displays:
- **Left**: Resume preview (A4 paper, zoomable, clickable highlights)
- **Right**: 5-tab panel (Analysis, Rewrites, Cover Letter, Find Jobs, Profile)

#### Tab 1: Analysis (Default)
- Shows resume level, ATS score, metrics breakdown
- Lists AI suggestions (missing keywords, grammar, weak bullets, improvement priorities)
- Click suggestion → highlight in preview + "Show Rewrite Suggestion" button

**Backend Flow**:
```
POST /applications/create            (link resume ↔ job post)
POST /applications/{id}/retrieve-context   (RAG: fetch resume chunks)
POST /applications/{id}/evaluate     (ats_evaluator_agent)
POST /applications/{id}/rewrite-suggestions  (rewrite_agent)
```

#### Tab 2: Rewrites
- AI-generated bullet point suggestions
- Accept/Reject buttons → updates status in DB
- Clicking a rewrite highlights it in the preview (bidirectional sync)
- Green/strikethrough styling for approved/rejected

#### Tab 3: Cover Letter
- **Generate Cover Letter** button → `POST /applications/{id}/cover-letter`
- Textarea + copy/download as .txt
- Uses `cover_letter_agent` with resume + job context

#### Tab 4: Find Jobs
- Location search box + **Search for Jobs** button
- Calls `POST /jobs/search-web` → OpenAI Responses API with `web_search_preview` MCP tool
- Job cards show: role, company, description snippet, **Evaluate Fit** button
- Click **Evaluate Fit** → creates new application, evaluates, shows ATS score + rewrites for that job

#### Tab 5: Career Profile (NEW)
- **Generate Career Profile** button → `POST /resumes/{id}/candidate-profile`
- Displays AI-generated career intelligence:
  - Seniority level (junior/mid/senior/lead/principal/executive)
  - Target roles (3-5 job titles)
  - Core skills (10-15 top skills)
  - Domain interests (industries/areas)
  - Strongest experiences (highlights)
  - Suggested job search queries (5-8 ready queries)
- **Search Jobs with this Profile** → runs job search + switches to Find Jobs tab

### 3. Download Resume
- User approves/rejects rewrite suggestions
- Clicks **Download** → `POST /applications/{id}/export-resume`
- Backend applies accepted rewrites, generates DOCX, uploads to Storage
- Browser downloads the optimized file

---

## API Endpoints

### Resumes
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/resumes/upload` | POST | Parse uploaded file, embed chunks, return `parsed_json` |
| `/resumes/{id}/candidate-profile` | POST | Generate career profile from parsed resume |

### Applications (Job Evaluation)
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/applications/create` | POST | Link resume to job post |
| `/applications/{id}/retrieve-context` | POST | RAG: fetch relevant resume chunks |
| `/applications/{id}/evaluate` | POST | Score resume vs job requirements |
| `/applications/{id}/rewrite-suggestions` | POST | Generate per-bullet AI suggestions |
| `/applications/{id}/cover-letter` | POST | Generate cover letter |
| `/applications/{id}/export-resume` | POST | Apply accepted rewrites, export DOCX |

### Jobs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/jobs/search-web` | POST | MCP-powered web job search (OpenAI Responses API) |
| `/jobs/{id}/analyze` | POST | Deep job posting analysis *(not exposed in UI yet)* |
| `/job-posts/create` | POST | Create job post from URL |

### Rewrites
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/rewrite-suggestions/{id}` | PATCH | Mark suggestion as approved/rejected |

### Cover Letters
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/cover-letters/{id}` | GET | Fetch cover letter from DB *(not used; stored in memory)* |

---

## Backend Agents

Each agent is a **LangGraph node** that processes state and returns updated state. Nodes are connected in a DAG (directed acyclic graph) where each node reads inputs from `AgentState`, calls LangChain LLMs (via `openai_client`), and writes outputs back to state.

### Agent Node Flow Diagram

```
┌─ START ─────────────────────────────────────────────────────────────┐
│                                                                      │
│  AgentState = {                                                     │
│    user_id, resume_id, resume_json, job_json,                       │
│    ats_result, rewrite_suggestions, cover_letter, errors, ...       │
│  }                                                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │  parse_resume_node      │
                    ├─────────────────────────┤
                    │ IN:  raw_text           │
                    │ OUT: resume_json        │
                    │ GPT: gpt-5 parse        │
                    └─────────────────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  create_candidate_profile_node      │
              ├─────────────────────────────────────┤
              │ IN:  resume_json                    │
              │ OUT: candidate_profile              │
              │      (roles, skills, queries)       │
              │ GPT: gpt-4o analysis                │
              └─────────────────────────────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  discover_jobs_node                 │
              ├─────────────────────────────────────┤
              │ IN:  candidate_profile, location    │
              │ OUT: job_post_ids                   │
              │ Search: web API or jsearch          │
              └─────────────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │  ⏸️ HUMAN PAUSE 1          │
                   │  User selects a job         │
                   │  → selected_job_post_id     │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  analyze_selected_job_node          │
              ├─────────────────────────────────────┤
              │ IN:  selected_job_post_id           │
              │ OUT: job_json                       │
              │      (requirements, description)    │
              │ GPT: gpt-4o extraction              │
              └─────────────────────────────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  research_company_node              │
              ├─────────────────────────────────────┤
              │ IN:  job_json (company name)        │
              │ OUT: company_background             │
              │ MCP: browser automation (optional)  │
              └─────────────────────────────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  retrieve_resume_context_node       │
              ├─────────────────────────────────────┤
              │ IN:  resume_json, job_json          │
              │ OUT: retrieved_context              │
              │      (relevant resume chunks)       │
              │ RAG: pgvector similarity search     │
              └─────────────────────────────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  evaluate_ats_node                  │
              ├─────────────────────────────────────┤
              │ IN:  resume_json, job_json,         │
              │      retrieved_context              │
              │ OUT: ats_result                     │
              │      {score, matched_skills,        │
              │       weaknesses, evidence}         │
              │ GPT: gpt-4o evaluation              │
              └─────────────────────────────────────┘
                                  │
                                  ▼
          ┌───────────────────────────────────────────┐
          │  generate_rewrite_suggestions_node        │
          ├───────────────────────────────────────────┤
          │ IN:  resume_json, ats_result, job_json    │
          │ OUT: rewrite_suggestions                  │
          │      [{original, suggested, reason, id}]  │
          │ GPT: gpt-4o per-bullet rewrites           │
          └───────────────────────────────────────────┘
                                  │
                   ┌──────────────┴──────────────┐
                   │  ⏸️ HUMAN PAUSE 2          │
                   │  User approves/rejects      │
                   │  rewrites (via PATCH API)   │
                   └──────────────┬──────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  export_resume_node                 │
              ├─────────────────────────────────────┤
              │ IN:  resume_json,                   │
              │      approved_rewrites              │
              │ OUT: file_url (DOCX in Storage)     │
              │ Tool: docx_exporter                 │
              └─────────────────────────────────────┘
                                  │
                                  ▼
              ┌─────────────────────────────────────┐
              │  generate_cover_letter_node         │
              ├─────────────────────────────────────┤
              │ IN:  resume_json, job_json,         │
              │      ats_result                     │
              │ OUT: cover_letter (markdown)        │
              │ GPT: gpt-4o composition             │
              └─────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────┐
│ END - Return completed state with all outputs       │
└──────────────────────────────────────────────────────┘
```

### Shared State (AgentState TypedDict)

```python
class AgentState(TypedDict):
    # Core IDs
    user_id: str                          # User identifier
    resume_id: Optional[str]              # Uploaded resume
    candidate_profile_id: Optional[str]   # Generated profile
    application_id: Optional[str]         # Resume ↔ Job link
    
    # Parsed data
    resume_json: Optional[dict]           # ← parse_resume_node
    candidate_profile: Optional[dict]     # ← create_candidate_profile_node
    job_json: Optional[dict]              # ← analyze_selected_job_node
    company_background: Optional[dict]    # ← research_company_node
    
    # Job discovery
    job_post_ids: list[str]               # ← discover_jobs_node
    selected_job_post_id: Optional[str]   # User input
    
    # RAG context
    retrieved_context: Optional[list]     # ← retrieve_resume_context_node
    
    # AI analysis
    ats_result: Optional[dict]            # ← evaluate_ats_node
    rewrite_suggestions: Optional[list]   # ← generate_rewrite_suggestions_node
    approved_rewrites: Optional[list]     # User input (PATCH API)
    cover_letter: Optional[str]           # ← generate_cover_letter_node
    
    # Error tracking
    errors: list[str]                     # Collect all errors
```

### How Nodes Communicate

Each node is an async function with this signature:

```python
async def my_agent_node(state: AgentState) -> AgentState:
    """Read inputs from state, do work, return updated state."""
    
    # 1. Extract inputs from shared state
    resume_json = state.get("resume_json")
    job_json = state.get("job_json")
    
    # 2. Validate inputs
    if not resume_json:
        errors = state.get("errors", [])
        errors.append("my_agent_node: missing resume_json")
        return {**state, "errors": errors}
    
    # 3. Do work (call LLM, compute, etc.)
    result = await openai_client.chat_completion(...)
    
    # 4. Write outputs back to state
    return {
        **state,
        "output_key": result,
        "errors": errors,
    }
```

---

### 1. Resume Parser Agent
**Input**: Raw text from PDF/DOCX  
**Output**: Structured `parsed_json` (name, email, skills, experience, projects, education, languages, certifications, achievements)

**Logic**:
- System prompt with 21 explicit rules (preserve all details, no summarizing, no inventing)
- Strict schema (forbidden fields: `status`, `highlights`, `focus`, `outcomes`, etc.)
- Auto-generates professional summary if missing
- Field validators coerce GPT's varied output formats (lists→strings, etc.)

### 2. ATS Evaluator Agent
**Input**: `parsed_json`, job description (optional), job requirements  
**Output**: ATS score (0-100), matching/missing skills, weak bullets, improvement priorities

**Logic**:
- **No job posting**: Resume quality scoring
  - Contact info (8), education (7), skills (floor 15, +2/skill), experience (floor 10, +8/exp), bullets (floor 5, +2/bullet), projects (floor 5, +5/proj)
- **Job posting**: Match-based scoring
  - Required skills (10 + 30% match), preferred skills (5 + 15% match), responsibilities (5 + 15% match), keyword density (3 + 7% match)
  - Floors ensure encouraging scores for partial matches

### 3. Rewrite Agent
**Input**: `parsed_json`, ATS evaluation result, job context  
**Output**: List of suggestions (one per bullet/project description)

**Structure** (for each suggestion):
```json
{
  "original_text": "Developed REST APIs.",
  "suggested_text": "Built 12+ REST APIs using FastAPI, reducing latency by 30%.",
  "section": "experience",
  "reason": "Add quantifiable impact.",
  "status": "pending"
}
```

### 4. Cover Letter Agent
**Input**: `parsed_json`, job posting, ATS evaluation  
**Output**: Full cover letter markdown

**Logic**: Addresses hiring manager, pulls achievements/skills from resume, highlights job fit, includes call-to-action

### 5. Candidate Profile Agent
**Input**: `parsed_json`  
**Output**: Structured profile

```json
{
  "target_roles": ["Senior Backend Engineer", "Tech Lead"],
  "seniority_level": "mid-level",
  "core_skills": ["Python", "FastAPI", "PostgreSQL", ...],
  "domain_interests": ["fintech", "developer tools"],
  "strongest_experiences": ["Led 3-person team", "Reduced latency by 30%"],
  "preferred_job_keywords": ["Python", "microservices", "REST API", ...],
  "search_queries": ["Python backend engineer remote", ...]
}
```

### 6. Job Analyzer Agent
**Input**: Job posting details  
**Output**: Structured analysis

**Note**: Not exposed in UI yet. Could power a "Learn More" button on job cards.

---

## Data Models

### Resume (Supabase)
```sql
CREATE TABLE resumes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  raw_text TEXT,
  parsed_json JSONB,
  created_at TIMESTAMP
);
```

### Applications
```sql
CREATE TABLE applications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  resume_id UUID REFERENCES resumes,
  job_post_id UUID REFERENCES job_posts,
  created_at TIMESTAMP
);
```

### Rewrite Suggestions
```sql
CREATE TABLE rewrite_suggestions (
  id UUID PRIMARY KEY,
  application_id UUID REFERENCES applications,
  original_text TEXT,
  suggested_text TEXT,
  section TEXT,
  reason TEXT,
  status TEXT ('pending' | 'approved' | 'rejected'),
  created_at TIMESTAMP
);
```

### Candidate Profiles
```sql
CREATE TABLE candidate_profiles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  resume_id UUID REFERENCES resumes,
  profile_json JSONB,
  search_queries TEXT[],
  created_at TIMESTAMP
);
```

---

## Setup & Development

### Prerequisites
- **Backend**: Python 3.9+, Conda (recommended)
- **Frontend**: Node.js 18+, npm/yarn
- **Services**: Supabase account, OpenAI API key

### Backend Setup

1. **Clone and navigate**:
   ```bash
   git clone https://github.com/juliairsalina/reeracify.git
   cd reeracify/backend
   ```

2. **Create Conda environment**:
   ```bash
   conda create -n reeracify python=3.11
   conda activate reeracify
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *Note: Requires `openai>=1.66.0` for Responses API support*

4. **Set environment variables** (`.env`):
   ```bash
   OPENAI_API_KEY=sk-...
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
   JOB_SEARCH_PROVIDER=openai_web  # Default
   ENVIRONMENT=development
   ```

5. **Run dev server**:
   ```bash
   python -m uvicorn app.main:app --reload --port 8000
   ```

   Server runs at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend**:
   ```bash
   cd ../frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set environment variables** (`.env.local`):
   ```bash
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
   NEXT_PUBLIC_PREPROCESS_API_URL=http://localhost:8000
   ```

4. **Run dev server**:
   ```bash
   npm run dev
   ```

   Frontend runs at `http://localhost:3000`

### Connecting Frontend & Backend

Both must be running locally:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

The frontend's `.env.local` points the API calls to `localhost:8000`.

---

## Production Deployment

### Render (Backend)

1. Connect GitHub repo to Render
2. Set **Auto-Deploy** to "On Commit" in Render dashboard
3. Environment variables: copy from `.env` example, set real values
4. Deploy URL: `https://reeracify-backend.onrender.com`

### Vercel (Frontend)

1. Connect GitHub repo to Vercel
2. Auto-deploy on push (default)
3. Set `NEXT_PUBLIC_API_BASE_URL=https://reeracify-backend.onrender.com` in Vercel env vars
4. Deploy URL: `https://reeracify.vercel.app`

---

## Key Features Implemented

✅ **Resume Upload & Parsing**
- Supports PDF, DOC, DOCX
- GPT-5 structured extraction
- pgvector embeddings for RAG

✅ **Resume Preview**
- Live A4 preview with zoom
- Clickable highlights for rewrite suggestions
- Bidirectional sync: click rewrite in panel → highlight in preview

✅ **ATS Evaluation**
- Score 0-100 with encouraging floors
- Metrics: clarity, keyword fit, structure, impact
- Missing keywords, weak bullets, improvement priorities

✅ **AI Rewrite Suggestions**
- Per-bullet suggestions with reasons
- Approve/Reject workflow
- Status tracking in DB

✅ **Cover Letter Generation**
- Context-aware (resume + job posting)
- Editable, downloadable as .txt

✅ **Job Search (MCP-Powered)**
- OpenAI Responses API with `web_search_preview`
- Real job postings from web
- Evaluate each job against resume (separate ATS evaluation)

✅ **Career Profile**
- Target roles, seniority, core skills
- Domain interests, strongest experiences
- Pre-built job search queries
- One-click "Search Jobs with this Profile"

✅ **Resume Export**
- Apply accepted rewrites
- Generate optimized DOCX
- Download to browser

---

## Features Not Yet Exposed

- `POST /jobs/{id}/analyze` — Deep job posting analysis
- `POST /resumes/{id}/candidate-profile` (optional) — Could use search_queries to auto-populate job search
- Job history / session restore (GET endpoints exist, no UI)
- LinkedIn profile import
- Batch resume upload

---

## Troubleshooting

### Backend won't start: `No module named 'pypdf'`
```bash
conda activate reeracify
pip install pypdf
```

### Frontend can't reach backend
- Check backend is running on port 8000
- Verify `.env.local` has `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- Check CORS settings in `backend/app/main.py`

### Resume parse fails silently
- Check `parse_status` in response (may be `"failed"`)
- Check `chunks_ok` (false if embedding storage failed)
- Review OpenAI API key and rate limits

### ATS score always shows 45
- Ensure you're running the latest code
- If no job posting provided, score is resume quality (not fixed 45)
- Check `ats_evaluator_agent.py` has floor-based scoring logic

---

## File Structure

```
reeracify/
├── backend/
│   ├── app/
│   │   ├── agents/               # LangGraph nodes
│   │   │   ├── resume_parser_agent.py
│   │   │   ├── ats_evaluator_agent.py
│   │   │   ├── rewrite_agent.py
│   │   │   ├── cover_letter_agent.py
│   │   │   ├── candidate_profile_agent.py
│   │   │   ├── job_analyzer_agent.py
│   │   │   └── graph.py           # LangGraph workflow
│   │   ├── api/                   # FastAPI routers
│   │   │   ├── resumes.py
│   │   │   ├── applications.py
│   │   │   ├── jobs.py
│   │   │   ├── rewrites.py
│   │   │   ├── cover_letters.py
│   │   │   └── job_posts.py
│   │   ├── services/              # Utilities
│   │   │   ├── document_parser.py
│   │   │   ├── embedding_service.py
│   │   │   ├── job_search_service.py
│   │   │   ├── docx_exporter.py
│   │   │   ├── openai_client.py
│   │   │   ├── supabase_client.py
│   │   │   └── browser_mcp_client.py (optional)
│   │   ├── schemas/               # Pydantic models
│   │   │   ├── resume.py
│   │   │   ├── ats.py
│   │   │   ├── candidate.py
│   │   │   └── ...
│   │   ├── config.py              # Config, API keys
│   │   ├── main.py                # FastAPI app
│   │   └── __init__.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/app/
│   │   ├── page.js                # Home (upload)
│   │   ├── edit-resume/
│   │   │   └── page.js            # Resume editor (5 tabs)
│   │   └── contact/
│   │       └── page.js
│   ├── .env.local                 # Local dev config
│   ├── .env.example
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── package.json
│   └── public/                    # Static assets
├── README.md                       # This file
├── CLAUDE.md                       # Claude Code instructions
└── .gitignore
```

---

## Contributing

1. Create a feature branch from `julia/backend-new`
2. Make changes locally
3. Test both frontend and backend
4. Commit with clear message referencing the session URL
5. Push to branch (auto-deploys on Render/Vercel)
6. Create PR for code review

---

## License

MIT
