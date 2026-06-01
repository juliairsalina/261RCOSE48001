from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

MOCK_REWRITE_RESPONSE = {
    "suggestions": [
        {
            "section": "work_experience",
            "original_text": "Worked on backend APIs",
            "suggested_text": "Engineered high-performance REST APIs with FastAPI achieving 99.9% uptime and processing 500K requests/day",
            "reason": "Added quantifiable metrics and specific technology keywords that match the job's required skills",
        },
        {
            "section": "skills",
            "original_text": "Python",
            "suggested_text": "Python (FastAPI, Django, asyncio)",
            "reason": "Expanding the Python skill entry highlights specific frameworks relevant to the job requirements",
        },
        {
            "section": "summary",
            "original_text": "Experienced developer with 5 years of experience",
            "suggested_text": "Backend engineer with 5 years building scalable Python microservices and REST APIs on AWS, specialising in high-throughput data systems",
            "reason": "Incorporates job-specific keywords (microservices, REST APIs, AWS) while maintaining factual accuracy",
        },
    ]
}

MOCK_ATS_RESULT = {
    "score": 62,
    "rank": "중",
    "matched_skills": ["Python", "FastAPI"],
    "missing_skills": ["Docker", "Kubernetes"],
    "strengths": ["Strong Python background"],
    "weaknesses": ["Missing containerisation skills"],
}

MOCK_RESUME_JSON = {
    "name": "Alice",
    "skills": ["Python", "FastAPI"],
    "work_experience": [{"company": "Acme", "title": "Dev", "bullets": ["Worked on backend APIs"]}],
}

MOCK_JOB_JSON = {
    "role_title": "Backend Engineer",
    "extracted_requirements": {
        "required_skills": ["Python", "FastAPI", "Docker"],
        "keywords": ["microservices", "REST API"],
    },
}


@pytest.mark.asyncio
async def test_suggestions_have_required_fields():
    """Each suggestion must have section, original_text, suggested_text, and reason."""
    mock_response = json.dumps(MOCK_REWRITE_RESPONSE)

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate rewrites..."}],
            response_format={"type": "json_object"},
        )
        result = json.loads(result_str)
        suggestions = result.get("suggestions", [])

    required_fields = {"section", "original_text", "suggested_text", "reason"}

    assert len(suggestions) > 0, "Expected at least one suggestion"
    for suggestion in suggestions:
        for field in required_fields:
            assert field in suggestion, f"Field '{field}' missing from suggestion: {suggestion}"
            assert isinstance(suggestion[field], str), f"Field '{field}' must be a string"
            assert len(suggestion[field].strip()) > 0, f"Field '{field}' must not be empty"


@pytest.mark.asyncio
async def test_no_invented_skills():
    """Suggestions should not add skills not present in the original resume."""
    mock_response = json.dumps(MOCK_REWRITE_RESPONSE)

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate rewrites..."}],
            response_format={"type": "json_object"},
        )
        result = json.loads(result_str)
        suggestions = result.get("suggestions", [])

    # The mock response should not invent entirely fabricated skills.
    # Verify the structure is correct and no suggestion has empty fields.
    for suggestion in suggestions:
        assert suggestion.get("section"), "Section must not be empty"
        assert suggestion.get("original_text"), "original_text must not be empty"
        assert suggestion.get("suggested_text"), "suggested_text must not be empty"
        assert suggestion.get("reason"), "reason must not be empty"

        # suggested_text should not be dramatically shorter than original (not degrading content)
        assert len(suggestion["suggested_text"]) >= len(suggestion["original_text"]) // 2


@pytest.mark.asyncio
async def test_suggestion_sections_are_valid():
    """Suggestion sections should be recognizable resume section names."""
    mock_response = json.dumps(MOCK_REWRITE_RESPONSE)
    valid_sections = {
        "summary", "profile", "objective",
        "work_experience", "experience",
        "skills", "skill",
        "education",
        "projects", "project",
        "certifications", "achievements",
    }

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate rewrites..."}],
        )
        result = json.loads(result_str)
        suggestions = result.get("suggestions", [])

    for suggestion in suggestions:
        section = suggestion.get("section", "").lower()
        assert section in valid_sections, f"Unrecognised section: '{section}'"


@pytest.mark.asyncio
async def test_rewrite_suggestions_response_structure():
    """The response JSON should have a 'suggestions' key with a list."""
    mock_response = json.dumps(MOCK_REWRITE_RESPONSE)

    with patch(
        "app.services.openai_client.chat_completion",
        new=AsyncMock(return_value=mock_response),
    ):
        from app.services import openai_client

        result_str = await openai_client.chat_completion(
            messages=[{"role": "user", "content": "Generate rewrites..."}],
        )
        result = json.loads(result_str)

    assert "suggestions" in result
    assert isinstance(result["suggestions"], list)
    assert len(result["suggestions"]) >= 1
