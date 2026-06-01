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


# ── Adzuna provider ─────────────────────────────────────────────────────────

class AdzunaProvider(JobSearchProvider):
    """Job search via the Adzuna API — https://developer.adzuna.com"""

    def _build_url(self, query: str, location: str, results_per_page: int) -> str:
        base = "https://api.adzuna.com/v1/api/jobs/us/search/1"
        params = (
            f"?app_id={settings.adzuna_app_id}&app_key={settings.adzuna_app_key}"
            f"&results_per_page={results_per_page}"
            f"&what={query.replace(' ', '+')}"
        )
        if location:
            params += f"&where={location.replace(' ', '+')}"
        return base + params

    @staticmethod
    def _normalize(item: dict[str, Any]) -> dict[str, Any]:
        return {
            "source": "adzuna",
            "job_url": item.get("redirect_url", ""),
            "company_name": item.get("company", {}).get("display_name", ""),
            "role_title": item.get("title", ""),
            "location": item.get("location", {}).get("display_name", ""),
            "job_description": item.get("description", ""),
        }

    async def search(
        self,
        queries: list[str],
        location: str = "",
        job_type: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        import httpx

        if not settings.adzuna_app_id or not settings.adzuna_app_key:
            logger.warning("Adzuna credentials missing — falling back to dummy jobs.")
            return DUMMY_JOBS[:limit]

        results_per_query = max(1, limit // max(len(queries), 1))
        seen: set[str] = set()
        all_results: list[dict[str, Any]] = []

        async with httpx.AsyncClient(timeout=15.0) as client:
            for query in queries:
                if len(all_results) >= limit:
                    break
                url = self._build_url(query, location, results_per_query)
                try:
                    resp = await client.get(url)
                    resp.raise_for_status()
                    for item in resp.json().get("results", []):
                        normalized = self._normalize(item)
                        job_url = normalized["job_url"]
                        if job_url and job_url not in seen:
                            seen.add(job_url)
                            all_results.append(normalized)
                        if len(all_results) >= limit:
                            break
                except httpx.HTTPError as exc:
                    logger.warning("Adzuna request failed for query '%s': %s", query, exc)
                    continue

        return all_results[:limit]


# ── Provider registry ───────────────────────────────────────────────────────
# Register new providers here. Key = value of JOB_SEARCH_PROVIDER in .env.

_PROVIDERS: dict[str, type[JobSearchProvider]] = {
    "adzuna": AdzunaProvider,
    "dummy": DummyProvider,
}


def get_provider() -> JobSearchProvider:
    """Instantiate and return the provider configured in JOB_SEARCH_PROVIDER."""
    key = (settings.job_search_provider or "adzuna").lower()
    provider_class = _PROVIDERS.get(key)
    if provider_class is None:
        logger.warning("Unknown JOB_SEARCH_PROVIDER '%s' — falling back to DummyProvider.", key)
        return DummyProvider()
    return provider_class()


# ── Public API ──────────────────────────────────────────────────────────────

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
