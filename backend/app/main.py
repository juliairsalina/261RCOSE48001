from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import applications, cover_letters, jobs, resumes, rewrites
from app.config import settings

app = FastAPI(
    title="Career Application AI Agent",
    version="0.1.0",
    description="AI-powered career application assistant with resume parsing, ATS evaluation, and intelligent rewriting.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(rewrites.router, prefix="/rewrite-suggestions", tags=["rewrites"])
app.include_router(cover_letters.router, prefix="/cover-letters", tags=["cover-letters"])


@app.on_event("startup")
async def startup_event() -> None:
    os.environ["LANGCHAIN_TRACING_V2"] = str(settings.langchain_tracing_v2).lower()
    if settings.langchain_api_key:
        os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
    if settings.langchain_project:
        os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok"}
