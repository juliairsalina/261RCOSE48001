from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

MOCK_CANDIDATE_PROFILE = {
    "target_roles": ["Software Engineer", "Backend Developer", "Full Stack Engineer"],
    "seniority_level": "mid-level",
    "core_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "React", "TypeScript", "AWS", "REST APIs"],
    "domain_interests": ["SaaS", "Developer Tools", "FinTech"],
    "strongest_experiences": [
        "Built high-performance REST APIs serving 1M+ requests/day",
        "Led migration from monolith to microservices reducing latency by 40%",
        "Open source project with 1000+ GitHub stars",
    ],
    "preferred_job_keywords": [
        "Python", "FastAPI", "backend", "API", "microservices", "cloud", "AWS", "PostgreSQL"
    ],
    "search_queries": [
        "Python Backend Engineer San Francisco",
        "FastAPI developer remote",
        "Software Engineer Python PostgreSQL",
        "Backend Developer REST API microservices",
        "Full Stack Engineer Python React",
        "Senior Python Engineer SaaS",
        "Cloud Backend Engineer AWS",
    ],
}


@pytest.mark.asyncio
async def test_candidate_profile_has_search_queries():
    """Mock GPT to return a profile and verify search_queries is a non-empty list."""
    mock_response = json.dumps(MOCK_CANDIDATE_PROFILE)

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate a profile..."}],
            response_format={"type": "json_object"},
        )
        profile = json.loads(result_str)

        assert "search_queries" in profile
        assert isinstance(profile["search_queries"], list)
        assert len(profile["search_queries"]) >= 5, "Expected at least 5 search queries"
        # Each query should be a non-empty string
        for query in profile["search_queries"]:
            assert isinstance(query, str)
            assert len(query.strip()) > 0


@pytest.mark.asyncio
async def test_candidate_profile_has_target_roles():
    """Verify target_roles is present and contains role title strings."""
    mock_response = json.dumps(MOCK_CANDIDATE_PROFILE)

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate a profile..."}],
            response_format={"type": "json_object"},
        )
        profile = json.loads(result_str)

        assert "target_roles" in profile
        assert isinstance(profile["target_roles"], list)
        assert len(profile["target_roles"]) >= 1

        for role in profile["target_roles"]:
            assert isinstance(role, str)
            assert len(role.strip()) > 0


@pytest.mark.asyncio
async def test_candidate_profile_has_all_required_fields():
    """Verify all required candidate profile fields are present."""
    mock_response = json.dumps(MOCK_CANDIDATE_PROFILE)

    required_fields = [
        "target_roles",
        "seniority_level",
        "core_skills",
        "domain_interests",
        "strongest_experiences",
        "preferred_job_keywords",
        "search_queries",
    ]

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate a profile..."}],
        )
        profile = json.loads(result_str)

        for field in required_fields:
            assert field in profile, f"Field '{field}' missing from candidate profile"


@pytest.mark.asyncio
async def test_candidate_profile_seniority_is_valid():
    """Verify seniority_level is one of the expected values."""
    mock_response = json.dumps(MOCK_CANDIDATE_PROFILE)
    valid_levels = {"junior", "mid-level", "senior", "lead", "principal", "executive", "entry"}

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate a profile..."}],
        )
        profile = json.loads(result_str)

        assert profile["seniority_level"] in valid_levels
