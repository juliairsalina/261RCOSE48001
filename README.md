## Team - Powerpuff Girls

#### Capstone Design Project 2026 | Korea University, College of Informatics

**Members:** Emira Syazwani, Julia Irsalina, Nur Mushira     
**Advisor:** Prof. 이숙윤     
**Mentor:** 이세현, UrbaneLab

---

# Reeracify

### AI-powered resume optimization platform that helps job seekers improve resumes, generate tailored cover letters, evaluate ATS compatibility, and discover relevant job opportunities — all in one place.
---

## Table of Contents

* [Live Demo](#live-demo)
* [Project Overview](#project-overview)
* [Key Contributions](#key-contributions)
* [System Workflow](#system-workflow)
* [RAG-Based Resume Retrieval](#rag-based-resume-retrieval)
* [System Architecture](#system-architecture)
* [Local Development](#local-development)
* [Features](#features)
* [Sample Outputs](#sample-outputs)
* [Future Work](#future-work)
* [Project Resources](#project-resources)
---

## Live Demo

🌐 https://reeracify.vercel.app

Scan the QR code to access the platform.

![QR Code](./pic/qr_code.png)

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

## System Workflow

![Workflow](./pic/Flow.png)

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

![RAG Pipeline](./pic/RAG.png)

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

![Architecture](./pic/Architecture.png)
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

## Prerequisites

Make sure Python, pip, Node.js `18.0` or higher, and pnpm or npm are installed on your system before starting.

---

## Step 1: Install Backend Dependencies

Go to the backend folder:

```bash
cd backend
```

Install the required Python dependencies:

```bash
pip install -r requirements.txt
```

---

## Step 2: Install Frontend Dependencies

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

## Step 3: Set Up Backend Environment Variables

Create a `.env` file inside the `backend` folder:

```env
# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5
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

---

## Step 4: Set Up Frontend Environment Variables

Create a `.env.local` file inside the `frontend` folder:

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

## Step 5: Run the Backend Server

From the `backend` folder, start the backend server:

```bash
uvicorn app.main:app --reload --port 8000
```

The backend API will be available at:

```text
http://localhost:8000
```

---

## Step 6: Run the Frontend Server

From the `frontend` folder, start the frontend development server:

```bash
pnpm dev
```

Or using npm:

```bash
npm run dev
```

The frontend application will be available at:

```text
http://localhost:3000
```

---

## Useful Local URLs

| Service           | URL                          |
| ----------------- | ---------------------------- |
| Frontend App      | `http://localhost:3000`      |
| Backend API       | `http://localhost:8000`      |
| API Documentation | `http://localhost:8000/docs` |

---

## Important Notes

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

![ATS Analysis](./pic/ATS.png)

- Resume-job compatibility scoring
- ATS score (0–100)
- Strength and weakness analysis
- Improvement recommendations

---

## AI Rewrite Suggestions

![Rewrite Suggestions](./pic/Rewrite_Agent.png)

- ATS-focused rewrite recommendations
- Keyword enhancement
- One-click approve/reject workflow
- Live resume preview updates

↓

Embedding Generation

↓

## Cover Letter Generator

![Cover Letter](./pic/CoverLetter_Agent.png)

- Generates tailored cover letters
- Uses resume content and job requirements
- Editable before download

---

## Job Discovery

![Job Discovery](./pic/job.png)

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

![Korean Resume](./pic/Korean_Resume.png)

Example of a Korean-language resume successfully analyzed by Reeracify.

---

## Sample Outputs

### Improved Resume

![Improved Resume](./pic/sample_resume.png)

Example of a resume improved using Reeracify's ATS evaluation and rewrite workflow.

---

### Generated Cover Letter

![Cover Letter](./pic/cover_letter.png)

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
