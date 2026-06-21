from __future__ import annotations

import json
import logging
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services import openai_client, supabase_client
from app.services.job_search_service import _BROWSER_HEADERS

logger = logging.getLogger(__name__)
router = APIRouter()

JOB_EXTRACTION_PROMPT = """Extract job posting information from the following web page content.

Return a valid JSON object with exactly these keys:
- company_name: the name of the hiring company
- role_title: the job title / position name
- job_description: the full job description text including requirements, responsibilities, qualifications
- location: job location (empty string if not found)

Return only valid JSON. No markdown, no extra text."""


def _strip_html(html: str) -> str:
    clean = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.DOTALL)
    clean = re.sub(r"<style[^>]*>.*?</style>", "", clean, flags=re.DOTALL)
    clean = re.sub(r"<[^>]+>", " ", clean)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:8000]


class JobPostCreateRequest(BaseModel):
    job_url: str = ""
    user_id: str
    company_name: str = ""
    role_title: str = ""
    job_description: str = ""


@router.post("/create")
async def create_job_post(request: JobPostCreateRequest) -> dict:
    """Create a job post record from a URL.

    Fetches the URL, uses GPT to extract company name, role, and description.
    Falls back to user-provided fields if the URL cannot be fetched.
    """
    company_name = request.company_name
    role_title = request.role_title
    job_description = request.job_description
    location = ""

    # Try to scrape and extract from URL
    if request.job_url and not (company_name and role_title and job_description):
        try:
            import httpx

            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(request.job_url, headers=_BROWSER_HEADERS)
                resp.raise_for_status()
                page_text = _strip_html(resp.text)

            raw = await openai_client.chat_completion(
                messages=[
                    {"role": "system", "content": JOB_EXTRACTION_PROMPT},
                    {
                        "role": "user",
                        "content": f"Job URL: {request.job_url}\n\nPage Content:\n{page_text}",
                    },
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            extracted: dict = json.loads(raw)
            company_name = company_name or extracted.get("company_name", "")
            role_title = role_title or extracted.get("role_title", "")
            job_description = job_description or extracted.get("job_description", "")
            location = extracted.get("location", "")

        except Exception as exc:
            logger.warning("Failed to extract job from URL %s: %s", request.job_url, exc)

    # No URL and no description — create a general (no-job) placeholder so the
    # application can still run a resume-only analysis.
    if not job_description:
        job_description = "General resume evaluation — no specific job posting provided."
        company_name = company_name or ""
        role_title = role_title or "General"

    # Ensure user exists (FK)
    supabase_client.ensure_user(request.user_id)

    db = supabase_client.get_client()
    try:
        result = (
            db.table("job_posts")
            .insert(
                {
                    "user_id": request.user_id,
                    "source": "manual",
                    "job_url": request.job_url,
                    "company_name": company_name,
                    "role_title": role_title,
                    "location": location,
                    "job_description": job_description,
                }
            )
            .execute()
        )
        row = result.data[0]
    except Exception as exc:
        logger.exception("Failed to create job post: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to create job post: {exc}")

    return {
        "job_post_id": row["id"],
        "company_name": row.get("company_name", ""),
        "role_title": row.get("role_title", ""),
        "location": row.get("location", ""),
        "job_description": row.get("job_description", ""),
    }
