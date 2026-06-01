from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

MOCK_ADZUNA_RESPONSE = {
    "results": [
        {
            "redirect_url": "https://www.adzuna.com/jobs/1234567",
            "company": {"display_name": "Acme Technology"},
            "title": "Python Backend Engineer",
            "location": {"display_name": "San Francisco, CA"},
            "description": (
                "We need a Python engineer with FastAPI, PostgreSQL, Docker. "
                "Responsibilities include building REST APIs and microservices."
            ),
        },
        {
            "redirect_url": "https://www.adzuna.com/jobs/7654321",
            "company": {"display_name": "DataPipe Inc"},
            "title": "Senior Software Engineer",
            "location": {"display_name": "Remote"},
            "description": (
                "Looking for experienced engineer. "
                "Required: Python, AWS, Kubernetes, PostgreSQL. "
                "Nice to have: React, TypeScript."
            ),
        },
    ]
}

CANDIDATE_PROFILE = {
    "target_roles": ["Python Backend Engineer", "Software Engineer"],
    "core_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
    "preferred_job_keywords": ["microservices", "REST API", "cloud", "backend"],
    "search_queries": ["Python Backend Engineer San Francisco", "Software Engineer Python AWS"],
}


@pytest.mark.asyncio
async def test_job_search_returns_normalized_results():
    """Mock Adzuna API and verify results are normalized to the expected structure."""
    from unittest.mock import AsyncMock

    mock_response = MagicMock()
    mock_response.json.return_value = MOCK_ADZUNA_RESPONSE
    mock_response.raise_for_status = MagicMock()

    with patch("app.config.settings") as mock_settings:
        mock_settings.adzuna_app_id = "test_app_id"
        mock_settings.adzuna_app_key = "test_app_key"

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=None)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            from app.services.job_search_service import search_jobs

            results = await search_jobs(
                queries=["Python Backend Engineer"],
                location="San Francisco",
                limit=10,
            )

    assert isinstance(results, list)
    for result in results:
        assert "source" in result
        assert "job_url" in result
        assert "company_name" in result
        assert "role_title" in result
        assert "location" in result
        assert "job_description" in result


def test_match_score_range():
    """Verify computed match score is always between 0 and 100."""
    from app.agents.job_discovery_agent import _compute_match_score

    test_cases = [
        # Full match
        (
            {
                "core_skills": ["Python", "FastAPI", "PostgreSQL"],
                "preferred_job_keywords": ["backend", "API"],
                "target_roles": ["Python Backend Engineer"],
            },
            {
                "role_title": "Python Backend Engineer",
                "job_description": "Python FastAPI PostgreSQL backend API developer",
            },
        ),
        # Zero match
        (
            {
                "core_skills": ["Java", "Spring", "Oracle"],
                "preferred_job_keywords": ["enterprise", "J2EE"],
                "target_roles": ["Java Developer"],
            },
            {
                "role_title": "Data Scientist",
                "job_description": "R Python pandas machine learning data analysis",
            },
        ),
        # Empty profile
        (
            {"core_skills": [], "preferred_job_keywords": [], "target_roles": []},
            {"role_title": "Software Engineer", "job_description": "Python Java AWS"},
        ),
    ]

    for profile, job in test_cases:
        score, match_reasons, missing = _compute_match_score(profile, job)
        assert 0 <= score <= 100, f"Score {score} is out of range for profile={profile}"
        assert isinstance(match_reasons, list)
        assert isinstance(missing, list)


def test_confidence_label():
    """Verify confidence label is always one of high/medium/low."""
    from app.agents.job_discovery_agent import _score_to_confidence

    valid_labels = {"high", "medium", "low"}
    for score in range(0, 101, 5):
        label = _score_to_confidence(score)
        assert label in valid_labels, f"Invalid confidence label '{label}' for score {score}"


def test_confidence_label_thresholds():
    """Verify confidence label thresholds match the specification."""
    from app.agents.job_discovery_agent import _score_to_confidence

    assert _score_to_confidence(80) == "high"
    assert _score_to_confidence(90) == "high"
    assert _score_to_confidence(100) == "high"
    assert _score_to_confidence(79) == "medium"
    assert _score_to_confidence(55) == "medium"
    assert _score_to_confidence(54) == "low"
    assert _score_to_confidence(0) == "low"


@pytest.mark.asyncio
async def test_dummy_jobs_returned_when_api_key_missing():
    """When no JSearch API key is set, return the dummy job list."""
    with patch("app.services.job_search_service.settings") as mock_settings:
        mock_settings.job_search_provider = "jsearch"
        mock_settings.jsearch_api_key = ""
        mock_settings.jsearch_country = "kr"
        mock_settings.jsearch_language = "en"

        from app.services.job_search_service import search_jobs, DUMMY_JOBS

        results = await search_jobs(queries=["Python developer"], limit=10)

    assert isinstance(results, list)
    assert len(results) == len(DUMMY_JOBS)
    for result in results:
        assert "source" in result
        assert "company_name" in result
        assert "role_title" in result
        assert "job_description" in result
        assert len(result["job_description"]) > 50
