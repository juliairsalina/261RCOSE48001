# Team - Powerpuff Girls

#### Capstone Design Project 2026 | Korea University, College of Informatics

**Members:** Emira Syazwani, Julia Irsalina, Nur Mushira     
**Advisor:** Prof. 이숙윤     
**Mentor:** 이세현, UrbaneLab

---

## Reeracify

#### AI-powered resume optimization platform that helps job seekers improve resumes, generate tailored cover letters, evaluate ATS compatibility, and discover relevant job opportunities — all in one place.
---

## Table of Contents

* [Live Demo](#live-demo)
* [Project Overview](#project-overview)
* [Key Contributions](#key-contributions)
* [AI Agents](#ai-agents)
* [System Workflow](#system-workflow)
* [RAG-Based Resume Retrieval](#rag-based-resume-retrieval)
* [System Architecture](#system-architecture)
* [Local Development](#local-development)
* [Features](#features)
* [Sample Outputs](#sample-outputs)
* [Future Work](#future-work)
* [Project Resources](#project-resources)
* [Main API Routes](#main-api-routes)


## Live Demo

🌐 https://reeracify.vercel.app

Scan the QR code to access the platform.

<p align="center">
  <img src="./pic/qr_code.png" alt="QR Code" width="380"/>
</p>


---

## Project Overview

Finding a job often requires using multiple tools:

- Writing resumes in Word or Google Docs
- Using AI tools to improve resume content
- Checking ATS scores on separate platforms
- Creating cover letters manually
- Searching job postings across multiple websites

Reeracify combines these tasks into a single platform.

Users can upload a resume, analyze ATS compatibility, receive rewrite suggestions, generate cover letters, and discover matching jobs through one workflow.

---

## Key Contributions

| Contribution | Description |
|-------------|-------------|
| Multi-Agent AI Workflow | 8 specialized AI agents coordinated using LangGraph |
| RAG-Based Evaluation | Retrieves only relevant resume content for focused analysis |
| Direct Editing | Edit resumes and cover letters directly within the platform |
| Global Job Discovery | Supports job search across 11 countries |
| Multilingual Support | Supports resumes and job descriptions in multiple languages |

---

## AI Agents

| No. | Agent             | Responsibility                                                                                                                                                                                                                                                               |
| --- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Resume Parser     | Extracts structured JSON from raw resume text using a six-step process: detect sections → identify entries → determine boundaries → associate bullets → map to schema → emit JSON. It also handles imperfect formatting and flattens skills into individual strings.         |
| 2   | Candidate Profile | Infers target roles, skills, and generates job search queries.                                                                                                                                                                                                               |
| 3   | Job Discovery     | Searches Adzuna, scores, and ranks matching job opportunities.                                                                                                                                                                                                               |
| 4   | Job Analyzer      | Extracts structured requirements from job descriptions.                                                                                                                                                                                                                      |
| 5   | RAG Retriever     | Retrieves relevant resume chunks using pgvector cosine search.                                                                                                                                                                                                               |
| 6   | ATS Evaluator     | Calculates a GPT-driven ATS score from six dimensions: required skills, role relevance, experience fit, preferred skills, semantic similarity, and education fit. It also returns matched/missing requirements, transferable skills, reasoning, and improvement suggestions. |
| 7   | Rewrite Agent     | Suggests targeted resume improvements without inventing experience.                                                                                                                                                                                                          |
| 8   | Cover Letter      | Writes a 250–400 word personalised cover letter.                                                                                                                                                                                                                             |

---

## System Workflow

<p align="center">
  <img src="./pic/Flow.png" alt="System Workflow" width="650"/>
</p>


### Workflow Steps

1. Upload Resume (PDF/DOCX)
2. Parse Resume into Structured JSON
3. Analyze Job Description
4. Retrieve Relevant Resume Context using RAG
5. Evaluate ATS Compatibility
6. Generate Cover Letter
7. Generate Rewrite Suggestions
8. Edit Resume Directly
9. Export Final Resume

---

## RAG-Based Resume Retrieval

<p align="center">
  <img src="./pic/RAG.png" alt="RAG Pipeline" width="650"/>
</p>

Instead of sending the entire resume to the AI model every time, Reeracify:

1. Splits resumes into chunks
2. Converts chunks into embeddings
3. Stores embeddings in pgvector
4. Retrieves only the most relevant chunks based on job requirements
5. Uses retrieved content for ATS evaluation, cover letter generation, and rewrite suggestions

### Benefits

- Faster processing
- Reduced token usage
- More focused evaluation
- Better scalability for long resumes

---

## System Architecture

<p align="center">
  <img src="./pic/Architecture.png" alt="System Architecture" width="650"/>
</p>

Reeracify uses a LangGraph-based multi-agent workflow integrated with OpenAI models and Supabase vector storage to support ATS evaluation, rewrite generation, cover letter generation, and job discovery.


| Layer | Technology |
|---------|---------|
| Frontend | Next.js, React, Tailwind |
| Backend | FastAPI |
| AI | GPT-5, LangGraph, LangChain |
| Database | Supabase, pgvector |
| Deployment | Vercel, Render |

---

## Local Development

This guide will help you set up the project for local development.

---

### Prerequisites

Make sure Python, pip, Node.js `18.0` or higher, and pnpm or npm are installed on your system before starting.

---

### Step 1: Clone the Repository

Clone the project repository:

```bash
git clone https://github.com/your-username/reeracify.git
```

Go to the project folder:

```bash
cd reeracify
```

> Replace `your-username` with the actual GitHub username or organization name.

---

### Step 2: Set Up Supabase

Reeracify uses Supabase for PostgreSQL storage, file storage, and vector search.

Required Supabase setup:

1. Enable the `vector` extension in Supabase.
2. Run the database schema from `app/db/schema.sql`.
3. Create the `match_resume_chunks` RPC function for resume chunk similarity search.
4. Create a Supabase Storage bucket named `resumes`.

---

### Step 3: Install Backend Dependencies

Go to the backend folder:

```bash
cd backend
```

Install the required Python dependencies:

```bash
pip install -r requirements.txt
```
---

### Step 4: Install Frontend Dependencies

Go to the frontend folder:

```bash
cd frontend
```

Install the project dependencies:

```bash
pnpm install
```

Or using npm:

```bash
npm install
```
---

### Step 5: Set Up  Environment Variables
#### Create a `.env` file inside the `backend` folder:

```env
# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=GPT-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
SUPABASE_BUCKET=resumes

# Job Search
# Options:
#   cascade    (recommended) — JSearch first, OpenAI web search fallback
#   jsearch    — JSearch only (requires JSEARCH_API_KEY)
#   openai_web — OpenAI web_search_preview only (uses OPENAI_API_KEY)
#   dummy      — hardcoded test data
JOB_SEARCH_PROVIDER=cascade
JSEARCH_API_KEY=
JSEARCH_COUNTRY=kr
JSEARCH_LANGUAGE=en

# LangSmith optional
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=career-application-agent

# App
APP_ENV=development
```

#### Create a `.env.local` file inside the `frontend` folder:

```env
# Local development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_PREPROCESS_API_URL=http://localhost:8000

# Production Render
# Set these in Vercel environment variables instead
# NEXT_PUBLIC_API_BASE_URL=https://reeracify-backend.onrender.com
# NEXT_PUBLIC_PREPROCESS_API_URL=https://reeracify-backend.onrender.com
```

---

### Step 6: Run the Backend Server

From the `backend` folder, start the backend server:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The backend API will be available at:

```text
http://localhost:8000
```

---

### Step 7: Run the Frontend Server

Open a new terminal window.

From the `frontend` folder, start the frontend development server:

```bash
cd frontend
pnpm dev
```

Or using npm:

```bash
cd frontend
npm run dev
```

The frontend application will be available at:

```text
http://localhost:3000
```

---

### Useful Local URLs

| Service           | URL                          |
| ----------------- | ---------------------------- |
| Frontend App      | `http://localhost:3000`      |
| Backend API       | `http://localhost:8000`      |
| API Documentation | `http://localhost:8000/docs` |

---

### Important Notes

Do not commit your real environment files to GitHub.

Make sure these files are included in `.gitignore`:

```gitignore
backend/.env
frontend/.env.local
.env
.env.local
```

The `SUPABASE_SERVICE_ROLE_KEY` should only be used in the backend and must not be exposed in frontend code.

---

# Features

## ATS Analysis

<p align="center">
  <img src="./pic/ATS.png" alt="ATS Analysis" width="650"/>
</p>

- Resume-job compatibility scoring
- ATS score (0–100)
- Strength and weakness analysis
- Improvement recommendations

---

## AI Rewrite Suggestions

<p align="center">
  <img src="./pic/Rewrite_Agent.png" alt="Rewrite Suggestions" width="650"/>
</p>

- ATS-focused rewrite recommendations
- Keyword enhancement
- One-click approve/reject workflow
- Live resume preview updates

↓

Embedding Generation

↓

## Cover Letter Generator

<p align="center">
  <img src="./pic/CoverLetter_Agent.png" alt="Cover Letter Generator" width="650"/>
</p>

- Generates tailored cover letters
- Uses resume content and job requirements
- Editable before download

---

## Job Discovery

<p align="center">
  <img src="./pic/job.png" alt="Job Discovery" width="650"/>
</p>

- Career profile generation
- Job recommendations
- Support for 11 countries
- Resume-job fit evaluation

---

## Direct Editing

Users can edit:

- Resume sections
- Bullet points
- Skills
- Work experience
- Generated cover letters

without switching to external tools such as Word or Google Docs.

---

## Global Support

Reeracify supports multilingual resumes.

<p align="center">
  <img src="./pic/Korean_Resume.png" alt="Korean Resume Analysis" width="650"/>
</p>


Example of a Korean-language resume successfully analyzed by Reeracify.

---

## Sample Outputs

### Improved Resume


<p align="center">
  <img src="./pic/sample_resume.png" alt="Improved Resume" width="650"/>
</p>

Example of a resume improved using Reeracify's ATS evaluation and rewrite workflow.

---

### Generated Cover Letter

<p align="center">
  <img src="./pic/cover_letter.png" alt="Generated Cover Letter" width="650"/>
</p>

Cover letter automatically generated based on the candidate's resume and target job description.

---

## Future Work

- Improve ATS evaluation consistency and reliability
- Evaluate performance using more diverse resumes
- Develop recruiter-focused features for candidate screening and talent discovery

---

## Project Resources

Frontend:
https://reeracify.vercel.app

Backend API:
https://reeracify-backend.onrender.com

API Documentation:
https://reeracify-backend.onrender.com/docs

---

## Main API Routes

| Feature                    | Endpoint                                             |
| -------------------------- | ---------------------------------------------------- |
| Upload Resume              | `/resumes/upload`                                    |
| Generate Candidate Profile | `/resumes/{resume_id}/candidate-profile`             |
| Discover Jobs              | `/jobs/discover`                                     |
| Analyze Job                | `/jobs/{job_post_id}/analyze`                        |
| Create Application         | `/applications/create`                               |
| Retrieve RAG Context       | `/applications/{application_id}/retrieve-context`    |
| Evaluate ATS Score         | `/applications/{application_id}/evaluate`            |
| Get Rewrite Suggestions    | `/applications/{application_id}/rewrite-suggestions` |
| Export Resume              | `/applications/{application_id}/export-resume`       |
| Generate Cover Letter      | `/applications/{application_id}/cover-letter`        |
| Health Check               | `/health`                                            |

