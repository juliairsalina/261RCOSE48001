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

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Some job boards (e.g. Korean sites like Saramin/JobKorea/Wanted) reject
# requests that don't look like a real browser, returning errors for live
# postings. Spoofing a normal browser UA/Accept-Language avoids treating
# those false blocks as "dead" links.
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
}

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
        country: str = "",
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
        country: str = "",
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
        country: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        if not settings.jsearch_api_key:
            logger.warning("JSearch API key missing — falling back to dummy jobs.")
            return DUMMY_JOBS[:limit]

        resolved_country = (country or settings.jsearch_country).lower()

        # Use the correct language for the country
        _COUNTRY_LANGUAGE = {"kr": "ko", "jp": "ja", "de": "de", "fr": "fr", "cn": "zh"}
        resolved_language = _COUNTRY_LANGUAGE.get(resolved_country, settings.jsearch_language)

        headers = {
            "X-RapidAPI-Key": settings.jsearch_api_key,
            "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        }
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
                    "language": resolved_language,
                    "country": resolved_country,
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

    @staticmethod
    def _extract_jobs_from_text(text: str) -> list[dict]:
        """Extract a JSON array of job objects from model output text."""
        import json
        import re

        # Strip markdown code fences
        cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`").strip()

        # Try the whole cleaned string first
        try:
            parsed = json.loads(cleaned)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass

        # Find the outermost [...] using a greedy match
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass

        return []

    async def search(
        self,
        queries: list[str],
        location: str = "",
        job_type: str = "",
        country: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        from app.services.openai_client import get_client

        # Country-specific job board and language hints injected into the prompt
        _COUNTRY_HINTS: dict[str, str] = {
            "kr": (
                "Search Korean job boards 사람인(saramin.co.kr), 원티드(wanted.co.kr), "
                "잡코리아(jobkorea.co.kr), 링크드인 코리아(linkedin.com/jobs). "
                "Write your search query in Korean. Job titles may appear in English or Korean."
            ),
            "jp": (
                "Search Japanese job boards Rikunabi (rikunabi.com), Mynavi (job.mynavi.jp), "
                "Indeed Japan (jp.indeed.com). Search in Japanese."
            ),
            "my": (
                "Search Malaysian job boards JobStreet Malaysia (jobstreet.com.my), "
                "LinkedIn Malaysia, Hiredly (hiredly.com). Jobs are typically listed in English."
            ),
        }

        client = get_client()
        results: list[dict[str, Any]] = []
        seen: set[str] = set()
        resolved_country = (country or "").lower()
        country_hint = _COUNTRY_HINTS.get(resolved_country, "")

        for query in queries[:4]:
            if len(results) >= limit:
                break

            search_query = " ".join(filter(None, [query, location, job_type])).strip()

            prompt = (
                f'Search the web for current job openings matching: "{search_query}"\n\n'
                + (f"{country_hint}\n\n" if country_hint else "")
                + "Find 3-5 real, currently open job postings from company career pages or job boards "
                "(LinkedIn, Indeed, Glassdoor, company sites). "
                "For each job return a JSON object with these exact keys:\n"
                "- company_name: the hiring company\n"
                "- role_title: exact job title\n"
                "- location: city/country or Remote\n"
                "- job_url: direct URL to the job posting\n"
                "- job_description: 2-3 sentences covering key requirements and responsibilities\n\n"
                "Return ONLY a valid JSON array. No markdown, no explanation."
            )

            text = ""
            try:
                response = await client.responses.create(
                    model="gpt-4o",
                    tools=[{"type": "web_search_preview"}],
                    input=prompt,
                )

                # Extract text from message output items only (skip web_search_call items)
                for item in response.output:
                    if getattr(item, "type", None) == "message":
                        for block in getattr(item, "content", []) or []:
                            if hasattr(block, "text"):
                                text += block.text
                            elif isinstance(block, dict):
                                text += block.get("text", "")

                logger.info(
                    "OpenAI web search raw response for query '%s': %.300s",
                    query,
                    text,
                )

            except Exception as exc:
                logger.warning(
                    "OpenAI Responses API failed for query '%s': %s — trying Chat Completions fallback",
                    query,
                    exc,
                )
                # Fallback: Chat Completions with gpt-4o-search-preview
                try:
                    resp = await client.chat.completions.create(
                        model="gpt-4o-search-preview",
                        web_search_options={},
                        messages=[{"role": "user", "content": prompt}],
                    )
                    text = (resp.choices[0].message.content or "") if resp.choices else ""
                    logger.info(
                        "Chat Completions web search response for query '%s': %.300s",
                        query,
                        text,
                    )
                except Exception as exc2:
                    logger.warning(
                        "Chat Completions web search also failed for query '%s': %s",
                        query,
                        exc2,
                    )
                    continue

            if not text:
                logger.warning("Empty response text for query '%s'", query)
                continue

            jobs: list[dict] = self._extract_jobs_from_text(text)
            if not jobs:
                logger.warning(
                    "Could not extract jobs JSON for query '%s'. Response: %.300s",
                    query,
                    text,
                )
                continue

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

        return results[:limit]


# ── Cascade provider (JSearch → OpenAI fallback) ────────────────────────────

class CascadeProvider(JobSearchProvider):
    """Tries JSearch first. Falls back to OpenAI web search when:
    - The country has poor JSearch coverage (kr, my, th, id, ph, vn, sg)
    - JSearch returns 0 results
    - JSearch API key is missing or quota is exhausted
    """

    # Countries where JSearch has limited job board data — skip straight to OpenAI
    _OPENAI_PREFERRED = {"kr", "my", "th", "id", "ph", "vn"}

    async def search(
        self,
        queries: list[str],
        location: str = "",
        job_type: str = "",
        country: str = "",
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        resolved_country = (country or settings.jsearch_country or "us").lower()

        if resolved_country in self._OPENAI_PREFERRED:
            logger.info(
                "Country '%s' has limited JSearch coverage — using OpenAI web search directly",
                resolved_country,
            )
            return await OpenAIWebSearchProvider().search(
                queries, location=location, job_type=job_type, country=country, limit=limit
            )

        # Try JSearch first
        try:
            results = await JSearchProvider().search(
                queries, location=location, job_type=job_type, country=country, limit=limit
            )
        except Exception as exc:
            logger.warning("JSearch raised an exception: %s — falling back to OpenAI web search", exc)
            results = []

        if results:
            logger.info("JSearch returned %d results for country '%s'", len(results), resolved_country)
            return results

        # JSearch returned nothing — fall back to OpenAI web search
        logger.info(
            "JSearch returned 0 results for country '%s' — falling back to OpenAI web search",
            resolved_country,
        )
        return await OpenAIWebSearchProvider().search(
            queries, location=location, job_type=job_type, country=country, limit=limit
        )


# ── Provider registry ───────────────────────────────────────────────────────
# Register new providers here. Key = value of JOB_SEARCH_PROVIDER in .env.

_PROVIDERS: dict[str, type[JobSearchProvider]] = {
    "jsearch": JSearchProvider,
    "openai_web": OpenAIWebSearchProvider,
    "cascade": CascadeProvider,
    "dummy": DummyProvider,
}


def get_provider() -> JobSearchProvider:
    """Instantiate and return the provider configured in JOB_SEARCH_PROVIDER."""
    key = (settings.job_search_provider or "cascade").lower()
    provider_class = _PROVIDERS.get(key)
    if provider_class is None:
        logger.warning("Unknown JOB_SEARCH_PROVIDER '%s' — falling back to CascadeProvider.", key)
        return CascadeProvider()
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


# Phrases job boards show on a 200 OK page when a posting has actually been
# taken down (client-side "soft 404" — no HTTP error to detect via status alone).
_DEAD_POSTING_PHRASES = (
    "채용공고가 존재하지 않습니다",  # jobkorea.co.kr
    "공고가 마감",  # generic Korean "posting closed"
    "page not found",
    "job has expired",
    "this job is no longer available",
    "posting has been removed",
)


async def _is_url_alive(client: "httpx.AsyncClient", url: str) -> bool:
    """Best-effort liveness check for a job posting URL.

    Treats network errors, timeouts, and 4xx/5xx as dead. Some sites reject
    HEAD requests (405/403), so fall back to a GET before giving up. Also
    scans the body for known "soft 404" phrases since some job boards (e.g.
    jobkorea.co.kr) return 200 OK with a client-side JS alert instead of a
    real HTTP error.
    """
    try:
        resp = await client.head(url, follow_redirects=True)
        if resp.status_code >= 400 and resp.status_code not in (405, 403):
            return False
    except Exception:
        pass

    try:
        resp = await client.get(url, follow_redirects=True)
        if resp.status_code >= 400 and resp.status_code != 403:
            return False
        body_lower = resp.text[:5000].lower()
        return not any(phrase.lower() in body_lower for phrase in _DEAD_POSTING_PHRASES)
    except Exception:
        return False


async def _filter_dead_links(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop jobs whose job_url no longer resolves to a live page.

    LLM web search and stale job board indexes both surface links to
    postings that have since been taken down — this catches those before
    they're shown to the user.
    """
    import asyncio

    if not jobs:
        return jobs

    async with httpx.AsyncClient(timeout=10.0, headers=_BROWSER_HEADERS) as client:
        alive_flags = await asyncio.gather(
            *(_is_url_alive(client, job["job_url"]) for job in jobs),
            return_exceptions=True,
        )

    alive_jobs = []
    for job, alive in zip(jobs, alive_flags):
        if alive is True:
            alive_jobs.append(job)
        else:
            logger.info("Dropping dead job link: %s", job.get("job_url"))
    return alive_jobs


async def search_jobs(
    queries: list[str],
    location: str = "",
    job_type: str = "",
    country: str = "",
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Search jobs using the configured provider.

    Returns normalized dicts: source, job_url, company_name, role_title,
    location, job_description. Dead links (404s, taken-down postings) are
    filtered out before returning.
    """
    results = await get_provider().search(queries, location=location, job_type=job_type, country=country, limit=limit)
    with_urls = [j for j in results if j.get("job_url")]
    without_urls = [j for j in results if not j.get("job_url")]
    return (await _filter_dead_links(with_urls)) + without_urls
