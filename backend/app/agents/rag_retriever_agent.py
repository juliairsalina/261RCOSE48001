from __future__ import annotations

import logging
from typing import Any

from app.agents.state import AgentState
from app.services import supabase_client
from app.services.embedding_service import generate_embedding
from app.services.vector_store import retrieve_similar_chunks

logger = logging.getLogger(__name__)


def _build_retrieval_query(job_json: dict[str, Any]) -> str:
    """Build a retrieval query string from job requirements.

    Combines required_skills, keywords, and responsibilities from the
    extracted_requirements to form a dense query for embedding.
    """
    requirements = job_json.get("extracted_requirements", {})
    if not requirements and isinstance(job_json, dict):
        # Fallback: use role_title and job_description snippet
        role = job_json.get("role_title", "")
        desc = job_json.get("job_description", "")[:500]
        return f"{role} {desc}".strip()

    parts: list[str] = []

    required_skills: list[str] = requirements.get("required_skills", [])
    if required_skills:
        parts.append("Required skills: " + ", ".join(required_skills))

    keywords: list[str] = requirements.get("keywords", [])
    if keywords:
        parts.append("Keywords: " + ", ".join(keywords))

    responsibilities: list[str] = requirements.get("responsibilities", [])
    if responsibilities:
        parts.append("Responsibilities: " + ". ".join(responsibilities[:3]))

    qualifications: list[str] = requirements.get("qualifications", [])
    if qualifications:
        parts.append("Qualifications: " + ". ".join(qualifications[:2]))

    return " | ".join(parts) if parts else job_json.get("role_title", "")


async def retrieve_resume_context_node(state: AgentState) -> AgentState:
    """LangGraph node: retrieve relevant resume chunks using RAG.

    Builds a query from job requirements, generates an embedding, and calls
    pgvector cosine similarity search via Supabase RPC. Saves results to
    retrieved_contexts and updates state.
    """
    job_json = state.get("job_json")
    resume_id = state.get("resume_id")
    application_id = state.get("application_id")
    errors: list[str] = list(state.get("errors", []))

    if not job_json:
        errors.append("retrieve_resume_context_node: job_json is missing from state")
        return {**state, "errors": errors}

    if not resume_id:
        errors.append("retrieve_resume_context_node: resume_id is missing from state")
        return {**state, "errors": errors}

    try:
        # 1. Build retrieval query
        query = _build_retrieval_query(job_json)
        logger.info("RAG retrieval query: %s", query[:200])

        # 2. Generate embedding for query
        query_embedding = await generate_embedding(query)

        # 3. Call vector store for similar chunks
        chunks = retrieve_similar_chunks(
            resume_id=resume_id,
            query_embedding=query_embedding,
            top_k=5,
        )

        # 4. Save to retrieved_contexts
        if application_id and chunks:
            db = supabase_client.get_client()
            chunk_ids = [c.get("id") for c in chunks if c.get("id")]
            retrieved_texts = [
                {"chunk_text": c.get("chunk_text", ""), "section": c.get("section", ""), "similarity": c.get("similarity", 0.0)}
                for c in chunks
            ]
            db.table("retrieved_contexts").insert(
                {
                    "application_id": application_id,
                    "resume_chunk_ids": chunk_ids,
                    "retrieved_text": retrieved_texts,
                    "query": query,
                }
            ).execute()

        return {**state, "retrieved_context": chunks, "errors": errors}

    except Exception as exc:
        logger.exception("retrieve_resume_context_node failed: %s", exc)
        errors.append(f"retrieve_resume_context_node error: {exc}")
        return {**state, "errors": errors}
