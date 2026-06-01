from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

MOCK_CHUNKS = [
    {
        "id": "chunk-1",
        "chunk_text": "Developed REST APIs using Python FastAPI and PostgreSQL with 99.9% uptime.",
        "section": "work_experience",
        "similarity": 0.95,
    },
    {
        "id": "chunk-2",
        "chunk_text": "Led migration from monolith to microservices architecture reducing latency by 40%.",
        "section": "work_experience",
        "similarity": 0.87,
    },
    {
        "id": "chunk-3",
        "chunk_text": "Skills: Python, FastAPI, PostgreSQL, Docker, AWS, Kubernetes, React",
        "section": "skills",
        "similarity": 0.82,
    },
]

JOB_JSON_WITH_REQUIREMENTS = {
    "id": "job-1",
    "role_title": "Backend Python Engineer",
    "company_name": "TechCorp",
    "job_description": "We need Python FastAPI engineer with microservices experience",
    "extracted_requirements": {
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
        "preferred_skills": ["Kubernetes", "AWS"],
        "responsibilities": ["Build REST APIs", "Design microservices", "Code review"],
        "qualifications": ["3+ years Python", "Bachelor's degree"],
        "keywords": ["REST API", "microservices", "backend", "cloud"],
        "seniority_level": "mid-level",
        "job_type": "full-time",
    },
}


@pytest.mark.asyncio
async def test_retrieve_chunks_returns_list():
    """Mock Supabase RPC and verify retrieve_similar_chunks returns a list."""
    mock_rpc_response = MagicMock()
    mock_rpc_response.data = MOCK_CHUNKS

    mock_rpc_chain = MagicMock()
    mock_rpc_chain.execute.return_value = mock_rpc_response

    mock_supabase = MagicMock()
    mock_supabase.rpc.return_value = mock_rpc_chain

    with patch("app.services.vector_store.get_client", return_value=mock_supabase):
        from app.services.vector_store import retrieve_similar_chunks

        query_embedding = [0.1] * 1536
        result = retrieve_similar_chunks(
            resume_id="resume-123",
            query_embedding=query_embedding,
            top_k=5,
        )

    assert isinstance(result, list)
    assert len(result) == 3
    for chunk in result:
        assert "chunk_text" in chunk
        assert "section" in chunk
        assert "similarity" in chunk


@pytest.mark.asyncio
async def test_retrieve_chunks_returns_empty_when_no_data():
    """When RPC returns no data, return empty list."""
    mock_rpc_response = MagicMock()
    mock_rpc_response.data = None

    mock_rpc_chain = MagicMock()
    mock_rpc_chain.execute.return_value = mock_rpc_response

    mock_supabase = MagicMock()
    mock_supabase.rpc.return_value = mock_rpc_chain

    with patch("app.services.vector_store.get_client", return_value=mock_supabase):
        from app.services.vector_store import retrieve_similar_chunks

        result = retrieve_similar_chunks(
            resume_id="resume-999",
            query_embedding=[0.0] * 1536,
            top_k=5,
        )

    assert result == []


def test_retrieval_query_built_from_job_requirements():
    """Verify the retrieval query includes skills, keywords, and responsibilities."""
    from app.agents.rag_retriever_agent import _build_retrieval_query

    query = _build_retrieval_query(JOB_JSON_WITH_REQUIREMENTS)

    assert isinstance(query, str)
    assert len(query) > 10

    # Required skills should appear in the query
    query_lower = query.lower()
    assert "python" in query_lower or "fastapi" in query_lower or "postgresql" in query_lower

    # Keywords should appear
    assert "rest api" in query_lower or "microservices" in query_lower or "backend" in query_lower


def test_retrieval_query_fallback_without_requirements():
    """When extracted_requirements is missing, fall back to role_title + job_description."""
    from app.agents.rag_retriever_agent import _build_retrieval_query

    job_without_requirements = {
        "role_title": "Data Engineer",
        "job_description": "Build data pipelines using Spark and Airflow",
        "extracted_requirements": {},
    }

    query = _build_retrieval_query(job_without_requirements)

    assert isinstance(query, str)
    assert len(query) > 0
    # Should contain the role title since requirements are missing
    assert "Data Engineer" in query or "data" in query.lower()


@pytest.mark.asyncio
async def test_rpc_called_with_correct_parameters():
    """Verify the RPC is called with correct parameter names."""
    mock_rpc_response = MagicMock()
    mock_rpc_response.data = []

    mock_rpc_chain = MagicMock()
    mock_rpc_chain.execute.return_value = mock_rpc_response

    mock_supabase = MagicMock()
    mock_supabase.rpc.return_value = mock_rpc_chain

    with patch("app.services.vector_store.get_client", return_value=mock_supabase):
        from app.services.vector_store import retrieve_similar_chunks

        query_embedding = [0.5] * 1536
        retrieve_similar_chunks(
            resume_id="resume-abc",
            query_embedding=query_embedding,
            top_k=3,
        )

    mock_supabase.rpc.assert_called_once_with(
        "match_resume_chunks",
        {
            "query_embedding": query_embedding,
            "resume_id_filter": "resume-abc",
            "match_count": 3,
        },
    )
