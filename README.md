# Reeracify

AI-powered resume optimizer. Upload your resume, get an ATS score, AI rewrite suggestions, a tailored cover letter, and matching job listings — all in one place.

**Live app:** [reeracify.vercel.app](https://reeracify.vercel.app)  
**API:** [reeracify-backend.onrender.com](https://reeracify-backend.onrender.com)  
**API Docs:** [reeracify-backend.onrender.com/docs](https://reeracify-backend.onrender.com/docs)

---

## How It Works

![Pipeline](pic/Flow.png)

---

## Cloud Architecture

![Architecture](pic/Architecture.png)


---

## Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | Next.js | 16.2.6 | App router, SSR, SSE streaming client |
| **Frontend** | React | 19.2.4 | UI, inline resume editing |
| **Frontend** | Tailwind CSS | 4.x | Styling |
| **Backend** | FastAPI | 0.115+ | Async REST API, StreamingResponse for SSE |
| **Backend** | Python | 3.11 | Runtime |
| **Backend** | Uvicorn | 0.30+ | ASGI server |
| **AI / LLM** | OpenAI GPT | gpt-5 (default, override via `OPENAI_MODEL` env) | Parsing, scoring, rewrites, cover letters |
| **Embeddings** | text-embedding-3-small | 1536-dim | Chunk vectorization for RAG |
| **Agents** | LangGraph | 0.2+ | Stateful multi-step workflow with fan-out/fan-in |
| **Agents** | LangChain | 0.3+ | LLM wrappers, prompt templates |
| **Observability** | LangSmith | 0.1+ | Agent tracing, token counts, debug |
| **Database** | Supabase Postgres | — | Structured data |
| **Vector Search** | pgvector | 1536-dim cosine | Resume chunk similarity search |
| **File Storage** | Supabase Storage | — | PDF/DOCX uploads, exported files |
| **Job Search** | JSearch (RapidAPI) | — | Real job postings |
| **Job Search** | OpenAI web_search_preview | — | Fallback / KR+MY markets |
| **File Parsing** | pypdf, python-docx | — | Extract text from uploaded files |
| **Hosting** | Vercel | — | Frontend, auto-deploy on push |
| **Hosting** | Render | — | Backend, auto-deploy on push |
| **CI/CD** | GitHub Actions | — | Lint (ruff) + pytest on every push |

---

## LangGraph Analysis Pipeline

The core AI workflow lives in `backend/app/agents/graph.py`. When the frontend calls `POST /applications/{id}/analyze`, LangGraph executes `analysis_graph` and streams Server-Sent Events back.

### Graph Structure

```
START
  │
  ▼
analyze_job ──────────────────── extracts required_skills, preferred_skills,
  │                               responsibilities, keywords, seniority from
  │                               the job description (GPT, JSON mode)
  ▼
retrieve_context ─────────────── pgvector cosine similarity: job description
  │                               as query → top N resume chunks returned
  ▼
research_company ─────────────── gathers company background (optional MCP /
  │                               web scraping; gracefully skipped if unavailable)
  │
  ├──────────────────────────────────────────────────────┐
  ▼                                                      ▼
evaluate_ats                                  generate_cover_letter
  │  GPT-driven weighted score (0–100)          │  tailored letter from
  │  cosine similarity from RAG scores          │  resume + job + context
  │  → ats_result saved to DB                   │  → cover_letter saved to DB
  └──────────────────────────┬───────────────────┘
                             ▼
                     generate_rewrites
                       │  per-bullet suggestions → rewrite_suggestions table
                       ▼
                      END

SSE events emitted at each node:
  {"step": "[STATUS] Extracting job requirements..."}
  {"step": "[STATUS] Retrieving relevant resume sections..."}
  {"step": "[STATUS] Researching company background..."}
  {"step": "[STATUS] Evaluating ATS score..."}
  {"step": "[STATUS] Writing personalized cover letter..."}
  {"step": "[STATUS] Generating rewrite suggestions..."}
  {"done": true, "result": { ats, suggestions, cover_letter, errors }}
```


### Agent Descriptions

| Agent | File | Model | What it does |
|-------|------|-------|-------------|
| `analyze_job` | `job_analyzer_agent.py` | GPT | Extracts `required_skills`, `preferred_skills`, `responsibilities`, `keywords`, `seniority_level`, `job_type` from the raw job description into structured JSON. Always runs first so every downstream node has clean requirements. |
| `retrieve_context` | `rag_retriever_agent.py` | pgvector | Embeds the job description, runs cosine similarity against the user's `resume_chunks` table, returns top N most relevant chunks. These chunks give ATS evaluator and rewrite agent focused context rather than sending the full resume. |
| `research_company` | `company_research_agent.py` | optional | Gathers background on the company (industry, size, culture) via MCP browser tool or web search. Runs as a no-op if tools are unavailable. Result enriches cover letter tone. |
| `evaluate_ats` | `ats_evaluator_agent.py` | GPT | GPT-driven weighted scoring (0–100) across six dimensions: required skills match (35%), role/project relevance (25%), experience level fit (15%), preferred skills match (10%), semantic similarity (10%), education/domain fit (5%). Cosine similarity is derived from RAG retrieval scores and passed as one input signal — not the final score. Returns `matched_requirements`, `missing_critical_requirements`, `missing_minor_requirements`, `transferable_skills`, `reasoning`, and `improvement_suggestions`. Runs in parallel with cover letter. |
| `generate_cover_letter` | `cover_letter_agent.py` | GPT | Writes a tailored cover letter using resume JSON + job requirements + retrieved context. Runs in parallel with ATS evaluation. |
| `generate_rewrites` | `rewrite_agent.py` | GPT | Generates per-bullet rewrite suggestions (original → suggested + reason). Runs after both parallel branches complete. Saved to `rewrite_suggestions` table with `pending` status. |
| `resume_parser` | `resume_parser_agent.py` | GPT | Called separately on upload (not in `analysis_graph`). Uses a structured six-step internal process: detect sections → identify entries → determine boundaries → associate bullets → map to schema → emit JSON. Handles imperfect formatting (multi-column PDFs, missing headers, broken spacing). Enforces entry boundary rules to avoid merging or splitting entries. Flattens skills into individual strings. Extracts all eight sections: `work_experience`, `projects`, `education`, `leadership`, `achievements`, `certifications`, `languages`, `skills`. |
| `candidate_profile` | `candidate_profile_agent.py` | GPT | Called separately via `/resumes/{id}/candidate-profile`. Infers `target_roles`, `core_skills`, `domain_interests`, `seniority_level`, `job_search_queries` from the parsed resume. Powers the Career Profile tab and Find Jobs queries. |

---

## ATS Scoring Logic

The score is computed by GPT using a weighted six-dimension rubric. Cosine similarity (derived from RAG retrieval scores) is passed as one input signal — not used as the final score. This approach rewards transferable skills and realistic hiring fit rather than exact keyword overlap.

### Scoring dimensions

| Evaluation Criteria | Weight | Evaluation Method |
|----------|--------|------------------|
| Required Skills Match | 35% | Evaluates whether the required skills listed in the job description are present in the candidate's resume. |
| Role / Project Relevance | 25% | Evaluates how relevant the candidate's experience, projects, education, and achievements are to the target role. |
| Experience Level Fit | 15% | Evaluates whether the candidate matches the expected level (Intern, Junior, Mid-level, Senior). For internship roles, academic projects, hackathons, and coursework are also considered relevant experience. |
| Preferred Skills Match | 10% | Evaluates whether the candidate possesses preferred or nice-to-have skills. Missing preferred skills do not significantly reduce the score. |
| Semantic Similarity (Cosine Similarity) | 10% | Uses RAG-based cosine similarity as one signal among multiple factors. A similarity score between 65% and 85% is considered a realistic strong match. |
| Education / Domain Fit | 5% | Evaluates the relevance of the candidate's academic background, degree, and domain knowledge to the position. |

**Scoring Philosophy**

Unlike traditional ATS systems that rely primarily on keyword matching, the final score is calculated using a weighted combination of required skills, role relevance, experience level, preferred skills, semantic similarity, and education fit. This approach provides a more realistic assessment of candidate-job compatibility, as real-world applicants rarely match a job description 100%.

### Score interpretation

| Range | Level |
|-------|-------|
| 85–100 | Strong match (상) |
| 70–84 | Good match |
| 55–69 | Partial match (중) |
| 40–54 | Weak match |
| below 40 | Poor match (하) |

### ATS result fields

```
final_match_score          — 0–100
match_level                — "Strong match" / "Good match" / etc.
cosine_similarity_score    — raw semantic similarity (0–100)
score_breakdown            — per-dimension scores
matched_requirements       — skills/requirements the resume satisfies
missing_critical_requirements — must-have gaps
missing_minor_requirements — nice-to-have gaps
transferable_skills        — related experience credited even without exact match
reasoning                  — GPT explanation of the score
improvement_suggestions    — ordered list of actions to improve the match
```

---

## Resume Parser — Supported Sections

The parser (`resume_parser_agent.py`) uses a structured six-step internal process before emitting JSON:

1. Identify all major resume sections
2. Identify all entries within each section
3. Determine the boundary of each entry
4. Associate descriptions and bullet points with the correct entry
5. Map each entry into the correct schema field
6. Emit the final JSON object

The parser is designed to handle imperfect real-world formatting: missing section headers, multi-column PDFs, dates on separate lines, inconsistent spacing, and unusual section names. It infers sections from content meaning when headers are absent, and uses entry boundary rules to avoid merging adjacent entries.

### Entry boundary rule

When a new title, role, project name, company, institution, or date range appears, a new entry begins. Adjacent entries are never merged unless there is strong evidence they belong together.

### Description vs bullets

- **Bullet-style lines** → `bullets` array (wording preserved exactly, bullet symbols stripped)
- **Paragraph-style overview** → `description` field

### Schema sections

| Section | Schema fields | Classification |
|---------|--------------|----------------|
| `work_experience` | company, title, location, start_date, end_date, is_current, description, bullets | Internships, freelance, mentoring, assistantships, datathon/hackathon participation (technical work), volunteer with responsibilities |
| `education` | institution, degree, field_of_study, start_date, end_date, gpa, description, bullets | All formal education |
| `projects` | name, description, technologies, url, start_date, end_date, bullets | Software, data, AI/ML, web, mobile, research, academic, personal builds |
| `leadership` | title, organization, start_date, end_date, description, bullets | Club officers, student ambassadors, committee members, society roles, publication editors, representative roles |
| `achievements` | title, date, description | Awards, scholarships, competition wins, honours, dean's list, medals, rankings |
| `certifications` | name, issuer, date, description | AWS certs, TOPIK, IELTS, professional credentials, training certificates, language exams |
| `languages` | language, proficiency | All human language entries |
| `skills` | `[]` of strings | Individual skill strings — never comma-joined. Grouped skills are flattened while preserving names. |

If the section header and content conflict, classification follows the actual content.

---

## RAG Pipeline

Retrieval-Augmented Generation runs on every resume evaluation.

```
Resume uploaded
      │
      ▼
Split into chunks (LangChain text splitter) → embed each chunk (text-embedding-3-small)
                                              → store in resume_chunks (pgvector)

When Analyze is clicked:
      │
      ▼
[2] retrieve_context node:
    Job requirements → embed → cosine similarity search against resume_chunks
                             → top 5 chunks stored in LangGraph state

      │  (state.retrieved_context available to all downstream nodes)
      ▼

[4a] evaluate_ats      — reads retrieved_context from state for qualitative GPT analysis
[4b] cover_letter      — reads retrieved_context from state for relevant resume passages
[5]  generate_rewrites — reads retrieved_context from state for targeted bullet fixes
```

Why RAG instead of sending the whole resume every time: token efficiency, relevance focus, avoids context window limits on long resumes.

---

## Key Implementation Details

### Streaming SSE (`/applications/{id}/analyze`)

The frontend connects via `fetch()` with a `ReadableStream` reader. The backend returns `StreamingResponse(media_type="text/event-stream")`. Each LangGraph node emits one `{"step": "..."}` event as it starts. Final event: `{"done": true, "result": {...}}`. Error event: `{"error": "..."}`.

This allows the UI to show real-time progress ("Extracting job requirements… Evaluating ATS score…") during the 10–30 second pipeline run.

### Live Rewrite Preview

When the user approves a rewrite suggestion, `approveRewrite()` in the frontend:
1. Calls `PATCH /rewrite-suggestions/{id}` to persist the approval
2. Immediately calls `applyRewriteToResume(rewrite, resumeData)` — a pure function that finds the matching bullet/description in the correct section and replaces `original_text` with `suggested_text`
3. `setResumeData(prev => applyRewriteToResume(rewrite, prev))` — React re-renders the live preview

The resume preview updates instantly without a round-trip.

### DOCX Export with Rewrites

`POST /applications/{id}/export-resume` receives the live `resume_json` from the frontend (matching exactly what's displayed), loads all `approved` rewrites from the DB, and calls `generate_resume_docx(resume_json, approved_rewrites)`. The exporter:
1. Applies rewrites via `_apply_rewrites()` — handles all sections including leadership, achievements, certifications
2. Renders all sections in order with python-docx styling
3. Returns the file as a direct binary response (no Supabase Storage round-trip)

### Job Search — Cascade Provider

`JOB_SEARCH_PROVIDER=cascade` (default): tries JSearch (RapidAPI) first for countries where it has good coverage, falls back to OpenAI `web_search_preview` for KR/MY markets and when `JSEARCH_API_KEY` is not set. `openai_web` skips JSearch entirely.

---

## Feature Walkthrough

### 1. Upload → Parse → Embed
- Accepts PDF or DOCX (max 10 MB)
- Text extraction: `pypdf` for PDF, `python-docx` for DOCX
- GPT parses into structured JSON — all 8 sections extracted, nothing summarized
- Text split into overlapping chunks → embedded → stored in pgvector
- Frontend stores `resume_id`, `user_id`, `parsed_json` in `localStorage`

### 2. Analysis Tab
- Evaluates resume quality (no job) or job fit (with URL)
- Score 0–100 displayed with progress bar
- Rank: `Beginner` / `Intermediate` / `Advanced`
- GPT identifies 3–5 strengths, weaknesses, improvement priorities
- Each suggestion links to a rewrite card in the Rewrites tab

### 3. Rewrites Tab
- GPT-4o rewrites each bullet with added metrics, action verbs, and relevant keywords
- Click a card → that text highlighted in yellow in the resume preview
- **Approve** → preview updates instantly with new text (live state update)
- **Reject** → greyed out
- Approved rewrites are included in DOCX export

### 4. Cover Letter Tab
- Pre-filled from the last `analysis_graph` run on page load
- Editable textarea — make changes before downloading
- Download as `.txt`

### 5. Career Profile Tab
- Generates: seniority level, target roles, core skills, domain interests, strongest experiences
- **Search Jobs with this Profile** → switches to Find Jobs tab and fires search

### 6. Find Jobs Tab
- 11 countries: 🇺🇸🇸🇬🇬🇧🇨🇦🇩🇪🇦🇺🇳🇱🇯🇵🇰🇷🇲🇾🇮🇳
- Optional city / remote filter
- Queries built from `candidate_profile.target_roles` (e.g. "Machine Learning Engineer Seoul")
- **Evaluate Fit** on any job card → creates new application + runs full pipeline for that job

### 7. Download DOCX
- Sends live `resumeData` to backend (matches preview exactly)
- Backend applies approved rewrites + generates styled DOCX
- All sections rendered: Summary, Skills, Education, Experience, Projects, Leadership, Achievements, Certifications, Languages
- Direct browser download, no extra auth needed

---

## API Endpoints

### Resumes
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/resumes/upload` | Parse PDF/DOCX → embed chunks → return `resume_id` + `parsed_json` |
| `POST` | `/resumes/{id}/candidate-profile` | Generate career profile (target roles, skills, queries) |

### Applications (core evaluation flow)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/applications/create` | Link resume + job post → return `application_id` |
| `GET`  | `/applications/{id}` | Fetch application row |
| `POST` | `/applications/{id}/analyze` | **SSE** — full LangGraph pipeline (preferred) |
| `POST` | `/applications/{id}/retrieve-context` | RAG retrieval only |
| `POST` | `/applications/{id}/evaluate` | ATS score only |
| `POST` | `/applications/{id}/rewrite-suggestions` | Generate rewrites only |
| `POST` | `/applications/{id}/cover-letter` | Generate cover letter only |
| `POST` | `/applications/{id}/export-resume` | Apply rewrites → return DOCX binary |

### Jobs
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/jobs/search-web` | Search real job postings |
| `POST` | `/job-posts/create` | Create job post from URL |

### Other
| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/rewrite-suggestions/{id}` | Approve or reject a suggestion |
| `GET`  | `/cover-letters/{id}` | Fetch saved cover letter |
| `GET`  | `/health` | Liveness check |
| `GET`  | `/health/openai` | Test OpenAI API connectivity |

---

## Database Schema (Supabase)

```
users
  └── resumes
  │     ├── raw_text, parsed_json (all sections)
  │     ├── resume_chunks  ← pgvector: text + embedding vector(1536)
  │     └── candidate_profiles
  │
  └── applications  ─── links resume ↔ job_post
        ├── status: created → rag_completed → evaluated → rewrite_pending
        │                   → cover_letter_generated → resume_exported
        ├── retrieved_contexts   (RAG results per application)
        ├── ats_evaluations      (score, rank, matched/missing skills)
        ├── rewrite_suggestions  (original, suggested, reason, status)
        └── cover_letters

job_posts
  ├── company_name, role_title, location, job_url
  ├── job_description (raw text)
  └── extracted_requirements (JSON: required_skills, preferred_skills, …)

agent_runs
  └── logs every agent invocation: input_json, output_json, status, error_message
```

**pgvector detail:** `resume_chunks.embedding` is `vector(1536)`. Similarity search via the `match_resume_chunks(query_embedding, match_count, filter)` RPC with cosine distance.

---

## Setup — Run Locally

### Prerequisites
- Python 3.11+
- Node.js 20+
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

# Install (uv recommended)
pip install uv
uv venv && source .venv/bin/activate

uv pip install -r requirements.txt

# Configure
cp .env.example .env
# Fill in OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# Run
uvicorn app.main:app --reload --port 8000
# Docs: http://localhost:8000/docs
```

### 3. Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8000" > .env.local
npm run dev
# App: http://localhost:3000
```

### Environment Variables

**`backend/.env`:**
```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...

# Job search (pick one)
JOB_SEARCH_PROVIDER=cascade    # cascade | jsearch | openai_web | dummy
JSEARCH_API_KEY=                # optional — get at rapidapi.com
JSEARCH_COUNTRY=kr

# Optional observability
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls-...
LANGCHAIN_PROJECT=reeracify
```

**`frontend/.env.local`:**
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## Deployment

### Render (Backend)
1. New Web Service → connect repo
2. Build: `pip install -r requirements.txt`
3. Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Set all env vars in Render dashboard
5. Auto-deploys on push to `julia/backend-new`

### Vercel (Frontend)
1. Import repo → Framework: Next.js
2. Add: `NEXT_PUBLIC_API_BASE_URL=https://reeracify-backend.onrender.com`
3. Auto-deploys on push

---

## Job Search Providers

| Provider | Key needed | Notes |
|----------|-----------|-------|
| `cascade` | optional `JSEARCH_API_KEY` | Uses JSearch when key present + country supported; falls back to OpenAI web for KR/MY |
| `jsearch` | `JSEARCH_API_KEY` | Best quality. Free tier: 200 req/month |
| `openai_web` | (uses `OPENAI_API_KEY`) | No extra key. Burns ~$0.01/search in OpenAI tokens |
| `dummy` | none | Returns 3 hardcoded jobs. CI/testing only |

---

## CI/CD

GitHub Actions runs on every push to `main` and `julia/backend-new`:

```
Backend job:
  1. Python 3.11 setup
  2. pip install -r requirements.txt ruff
  3. ruff check app/          ← lint
  4. pytest app/tests/ -v     ← 50+ tests

Frontend job:
  1. Node 20 setup
  2. npm install
  3. npm run build            ← type-check + build
```

Tests cover: ATS scoring logic, DOCX export + rewrite application, API endpoints, RAG chunking + embedding, graph compilation, job discovery, candidate profile generation.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `cleanBullet is not defined` | Already fixed — function is defined inside `ResumeDocument` as a local closure. If it recurs, check Next.js version compatibility. |
| `No module named 'pypdf'` | `uv pip install pypdf pycryptodome` |
| Backend 403/429 on job search | JSearch key missing or quota exhausted → set `JOB_SEARCH_PROVIDER=openai_web` |
| Resume parse returns `{}` | Check `OPENAI_API_KEY` is set and valid |
| Jobs found: 0 | Generate Career Profile first (provides `target_roles`), or try a different country |
| Supabase `Invalid API key` | Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` |
| `pyo3_runtime.PanicException` on PDF | Install `pycryptodome` — C extension conflict with old cryptography package |
| ATS score always 90-100 | Fixed — GPT-driven scoring uses realistic hiring logic; scores above 90 require near-complete requirement satisfaction |
