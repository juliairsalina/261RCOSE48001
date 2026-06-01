from __future__ import annotations

import httpx

from app.config import settings

DUMMY_JOBS: list[dict] = [
    {
        "source": "dummy",
        "job_url": "https://example.com/jobs/software-engineer-1",
        "company_name": "TechCorp Inc.",
        "role_title": "Software Engineer",
        "location": "San Francisco, CA",
        "job_description": (
            "We are looking for a skilled Software Engineer to join our growing team. "
            "You will design, build, and maintain efficient, reusable, and reliable code. "
            "Requirements: Python, FastAPI, PostgreSQL, Docker, REST APIs. "
            "Nice to have: Kubernetes, AWS, Redis, GraphQL. "
            "Responsibilities: Build backend services, review code, collaborate with product team."
        ),
    },
    {
        "source": "dummy",
        "job_url": "https://example.com/jobs/backend-developer-2",
        "company_name": "DataFlow Systems",
        "role_title": "Backend Developer",
        "location": "Remote",
        "job_description": (
            "DataFlow Systems is hiring a Backend Developer with strong Python skills. "
            "You will build scalable data pipelines and APIs for our analytics platform. "
            "Requirements: Python, Django or FastAPI, PostgreSQL, Redis, message queues (Kafka/RabbitMQ). "
            "Nice to have: Spark, Airflow, ML pipeline experience. "
            "We offer competitive salary, remote-first culture, and generous equity."
        ),
    },
    {
        "source": "dummy",
        "job_url": "https://example.com/jobs/fullstack-engineer-3",
        "company_name": "Innovate AI",
        "role_title": "Full Stack Engineer",
        "location": "New York, NY",
        "job_description": (
            "Join Innovate AI as a Full Stack Engineer to build AI-powered products. "
            "Work across the stack: React frontend, Python/FastAPI backend, cloud infrastructure. "
            "Requirements: Python, React, TypeScript, PostgreSQL, REST APIs, Git. "
            "Nice to have: OpenAI API, LangChain, vector databases, AWS. "
            "Responsibilities: Feature development, system design, mentoring junior engineers."
        ),
    },
]


def _build_adzuna_url(query: str, location: str, page: int = 1, results_per_page: int = 10) -> str:
    country = "us"
    app_id = settings.adzuna_app_id
    app_key = settings.adzuna_app_key
    base = f"https://api.adzuna.com/v1/api/jobs/{country}/search/{page}"
    params = (
        f"?app_id={app_id}&app_key={app_key}"
        f"&results_per_page={results_per_page}"
        f"&what={query.replace(' ', '+')}"
    )
    if location:
        params += f"&where={location.replace(' ', '+')}"
    return base + params


def _normalize_adzuna_result(result: dict) -> dict:
    return {
        "source": "adzuna",
        "job_url": result.get("redirect_url", ""),
        "company_name": result.get("company", {}).get("display_name", ""),
        "role_title": result.get("title", ""),
        "location": result.get("location", {}).get("display_name", ""),
        "job_description": result.get("description", ""),
    }


async def search_jobs(
    queries: list[str],
    location: str = "",
    job_type: str = "",
    limit: int = 20,
) -> list[dict]:
    """Search for jobs using the Adzuna API or return dummy jobs if API credentials are missing.

    Each result is normalized to:
        {source, job_url, company_name, role_title, location, job_description}

    Args:
        queries: List of search query strings.
        location: Optional location filter.
        job_type: Optional job type (e.g. full-time, remote). Currently informational.
        limit: Maximum total number of results to return.

    Returns:
        List of normalized job dicts.
    """
    if not settings.adzuna_app_id or not settings.adzuna_app_key:
        # Return dummy jobs for testing when API credentials are absent
        return DUMMY_JOBS[:limit]

    results_per_query = max(1, limit // max(len(queries), 1))
    seen_urls: set[str] = set()
    all_results: list[dict] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for query in queries:
            if len(all_results) >= limit:
                break
            url = _build_adzuna_url(query, location, results_per_page=results_per_query)
            try:
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                for item in data.get("results", []):
                    normalized = _normalize_adzuna_result(item)
                    job_url = normalized["job_url"]
                    if job_url and job_url not in seen_urls:
                        seen_urls.add(job_url)
                        all_results.append(normalized)
                    if len(all_results) >= limit:
                        break
            except httpx.HTTPError:
                # Skip failed queries and continue with remaining
                continue

    return all_results[:limit]
