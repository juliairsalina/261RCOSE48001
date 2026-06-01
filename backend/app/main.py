from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import applications, cover_letters, job_posts, jobs, resumes, rewrites
from app.config import settings

logger = logging.getLogger(__name__)

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
app.include_router(job_posts.router, prefix="/job-posts", tags=["job-posts"])
app.include_router(applications.router, prefix="/applications", tags=["applications"])
app.include_router(rewrites.router, prefix="/rewrite-suggestions", tags=["rewrites"])
app.include_router(cover_letters.router, prefix="/cover-letters", tags=["cover-letters"])


@app.on_event("startup")
async def startup_event() -> None:
    # Wire LangSmith tracing env vars from settings
    os.environ["LANGCHAIN_TRACING_V2"] = str(settings.langchain_tracing_v2).lower()
    if settings.langchain_api_key:
        os.environ["LANGCHAIN_API_KEY"] = settings.langchain_api_key
    if settings.langchain_project:
        os.environ["LANGCHAIN_PROJECT"] = settings.langchain_project

    # Validate required keys — log clear warnings so developers notice immediately
    if not settings.openai_api_key:
        logger.warning(
            "OPENAI_API_KEY is not set. All AI features will fail. "
            "Copy backend/.env.example to backend/.env and fill in your key."
        )
    else:
        logger.info("OpenAI API key loaded (model: %s, embedding: %s)",
                    settings.openai_model, settings.openai_embedding_model)

    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning(
            "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. "
            "Database operations will fail."
        )
    else:
        logger.info("Supabase configured (bucket: %s)", settings.supabase_bucket)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Basic liveness check — always returns 200 if the server is up."""
    return {
        "status": "ok",
        "openai_key_set": bool(settings.openai_api_key),
        "openai_model": settings.openai_model,
        "supabase_configured": bool(settings.supabase_url and settings.supabase_service_role_key),
        "app_env": settings.app_env,
    }


@app.get("/health/openai", tags=["health"])
async def health_openai() -> dict:
    """Live OpenAI connectivity check — sends a minimal ping request.

    Use this to confirm your API key works before running the agent.
    Note: this makes a real API call and will count against your quota.
    """
    from app.services.openai_client import ping
    result = await ping()
    return result
