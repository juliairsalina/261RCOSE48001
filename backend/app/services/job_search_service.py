from __future__ import annotations

# ── Job Search Provider Interface ──────────────────────────────────────────
#
# To add a new provider (e.g. JSearch, Reed, Jooble):
#   1. Create a subclass of JobSearchProvider.
#   2. Implement the search() method — return normalized job dicts.
#   3. Register it in _PROVIDERS below.
#   4. Set JOB_SEARCH_PROVIDER=<your_key> in .env.
#
# The rest of the codebase only calls search_jobs() — provider is transparent.
# ───────────────────────────────────────────────────────────────────────────

import logging
from abc import ABC, abstractmethod
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

# ── Shared dummy data (used when no API credentials are configured) ─────────

DUMMY_JOBS: list[dict[str, Any]] = [
    {
        "source": "dummy",
        "job_url": "https://example.com/jobs/ai-backend-engineer",
        "company_name": "TechCorp Inc.",
        "role_title": "AI Backend Engineer",
        "location": "San Francisco, CA",
        "job_description": (
            "We are looking for an AI Backend Engineer to build intelligent services. "
            "Requirements: Python, FastAPI, PostgreSQL, OpenAI API, LangChain. "
            "Nice to have: Docker, Kubernetes, pgvector, LangGraph. "
            "Responsibilities: Build AI pipelines, REST APIs, collaborate with ML team."
        ),
    },
    {
        "source": "dummy",
        "job_url": "https://example.com/jobs/ml-engineer",
        "company_name": "DataFlow Systems",
        "role_title": "Machine Learning Engineer",
        "location": "Remote",
        "job_description": (
            "DataFlow Systems is hiring an ML Engineer with Python and NLP expertise. "
            "Requirements: Python, scikit-learn, PyTorch, SQL, REST APIs. "
            "Nice to have: Spark, Airflow, Hugging Face, vector databases. "
            "We offer remote-first culture and competitive salary."
        ),
    },
    {
        "source": "dummy",
        "job_url": "https://example.com/jobs/fullstack-ai",
        "company_name": "Innovate AI",
        "role_title": "Full Stack AI Engineer",
        "location": "New York, NY",
        "job_description": (
            "Join Innovate AI as a Full Stack AI Engineer building AI-powered products. "
            "Requirements: Python, React, TypeScript, PostgreSQL, OpenAI API. "
            "Nice to have: LangChain, LangGraph, AWS, Docker. "
            "Responsibilities: Feature development, system design, AI integration."
        ),
    },
]


# ── Abstract base class ─────────────────────────────────────────────────────

class JobSearchProvider(ABC):
    """Base class for all job search provider integrations.

    All providers must return normalized job dicts with these keys:
        source, job_url, company_name, role_title, location, job_description
    """

    @abstractmethod
    async def search(
        self,
        queries: list[str],
        location: str = "",
        job_type: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Search for jobs and return normalized job dicts."""


# ── Dummy provider ──────────────────────────────────────────────────────────

class DummyProvider(JobSearchProvider):
    """Returns hardcoded dummy jobs. Used when no API credentials are configured."""

    async def search(
        self,
        queries: list[str],
        location: str = "",
        job_type: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        return DUMMY_JOBS[:limit]


# ── JSearch provider ────────────────────────────────────────────────────────

class JSearchProvider(JobSearchProvider):
    """Job search via the JSearch API on RapidAPI — https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch"""

    _BASE_URL = "https://jsearch.p.rapidapi.com/search"

    @staticmethod
    def _normalize(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "source": "jsearch",
            "job_url": item.get("job_apply_link") or item.get("job_google_link", ""),
            "company_name": item.get("employer_name", ""),
            "role_title": item.get("job_title", ""),
            "location": ", ".join(
                filter(None, [item.get("job_city"), item.get("job_country")])
            ),
            "job_description": item.get("job_description", ""),
        }

    async def search(
        self,
        queries: list[str],
        location: str = "",
        job_type: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        import httpx

        if not settings.jsearch_api_key:
            logger.warning("JSearch API key missing — falling back to dummy jobs.")
            return DUMMY_JOBS[:limit]

        headers = {
            "X-RapidAPI-Key": settings.jsearch_api_key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        }
        results_per_query = max(1, limit // max(len(queries), 1))
        seen: set[str] = set()
        all_results: list[dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            for query in queries:
                if len(all_results) >= limit:
                    break
                params: dict[str, Any] = {
                    "query": f"{query} {location}".strip(),
                    "num_pages": 1,
                    "page": 1,
                    "language": settings.jsearch_language,
                    "country": settings.jsearch_country,
                }
                if job_type:
                    params["employment_types"] = job_type.upper()
                try:
                    resp = await client.get(self._BASE_URL, headers=headers, params=params)
                    resp.raise_for_status()
                    for item in resp.json().get("data", []):
                        normalized = self._normalize(item)
                        job_url = normalized["job_url"]
                        if job_url and job_url not in seen:
                            seen.add(job_url)
                            all_results.append(normalized)
                        if len(all_results) >= limit:
                            break
                except httpx.HTTPError as exc:
                    logger.warning("JSearch request failed for query '%s': %s", query, exc)
                    continue

        return all_results[:limit]


# ── OpenAI web search provider (MCP web_search_preview) ────────────────────

class OpenAIWebSearchProvider(JobSearchProvider):
    """Job search via OpenAI Responses API with built-in web_search_preview tool.

    Uses OpenAI's MCP-based web search to find real, current job postings
    without requiring a separate job board API key.
    """

    async def search(
        self,
        queries: list[str],
        location: str = "",
        job_type: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        import json
        import re

        from app.services.openai_client import get_client

        client = get_client()
        results: list[dict[str, Any]] = []
        seen: set[str] = set()

        for query in queries[:4]:
            if len(results) >= limit:
                break

            search_query = " ".join(filter(None, [query, location, job_type])).strip()

            prompt = (
                f'Search the web for current job openings matching: "{search_query}"\n\n'
                "Find 3-5 real, currently open job postings from company career pages or job boards "
                "(LinkedIn, Indeed, Glassdoor, company sites). "
                "For each job return a JSON object with these exact keys:\n"
                "- company_name: the hiring company\n"
                "- role_title: exact job title\n"
                "- location: city/country or Remote\n"
                "- job_url: direct URL to the job posting\n"
                "- job_description: 2-3 sentences covering key requirements and responsibilities\n\n"
                "Return ONLY a valid JSON array. No markdown, no explanation."
            )

            try:
                response = await client.responses.create(
                    model="gpt-4o",
                    tools=[{"type": "web_search_preview"}],
                    input=prompt,
                )

                # Extract text content from response output
                text = ""
                for item in response.output:
                    if hasattr(item, "content"):
                        for block in item.content:
                            if hasattr(block, "text"):
                                text += block.text

                # Parse JSON array from response
                match = re.search(r"\[.*?\]", text, re.DOTALL)
                if not match:
                    logger.warning("OpenAI web search: no JSON array in response for query '%s'", query)
                    continue

                jobs: list[dict] = json.loads(match.group())
                for job in jobs:
                    url = job.get("job_url", "")
                    if url and url not in seen:
                        seen.add(url)
                        results.append({
                            "source": "openai_web_search",
                            "job_url": url,
                            "company_name": job.get("company_name", ""),
                            "role_title": job.get("role_title", ""),
                            "location": job.get("location", ""),
                            "job_description": job.get("job_description", ""),
                        })

            except Exception as exc:
                logger.warning("OpenAI web search failed for query '%s': %s", query, exc)
                continue

        return results[:limit]


# ── Provider registry ───────────────────────────────────────────────────────
# Register new providers here. Key = value of JOB_SEARCH_PROVIDER in .env.

_PROVIDERS: dict[str, type[JobSearchProvider]] = {
    "jsearch": JSearchProvider,
    "openai_web": OpenAIWebSearchProvider,
    "dummy": DummyProvider,
}


def get_provider() -> JobSearchProvider:
    """Instantiate and return the provider configured in JOB_SEARCH_PROVIDER."""
    key = (settings.job_search_provider or "jsearch").lower()
    provider_class = _PROVIDERS.get(key)
    if provider_class is None:
        logger.warning("Unknown JOB_SEARCH_PROVIDER '%s' — falling back to DummyProvider.", key)
        return DummyProvider()
    return provider_class()


# ── Public API ──────────────────────────────────────────────────────────────

def _flatten_skills_from_dict(skills: object) -> list[str]:
    """Flatten skills field (list of str, list of dicts, or dict) to flat list."""
    if not skills:
        return []
    if isinstance(skills, str):
        return [skills]
    if isinstance(skills, dict):
        out: list[str] = []
        for v in skills.values():
            out.extend(_flatten_skills_from_dict(v))
        return out
    if isinstance(skills, list):
        out = []
        for s in skills:
            if isinstance(s, str):
                out.append(s)
            elif isinstance(s, dict):
                for v in s.values():
                    if isinstance(v, str):
                        out.append(v)
                    elif isinstance(v, list):
                        out.extend(str(x) for x in v if x)
        return out
    return []


async def search_jobs(
    queries: list[str],
    location: str = "",
    job_type: str = "",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search jobs using the configured provider.

    Returns normalized dicts: source, job_url, company_name, role_title,
    location, job_description.
    """
    return await get_provider().search(queries, location=location, job_type=job_type, limit=limit)
