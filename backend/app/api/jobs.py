from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.schemas.job import JobDiscoverRequest, JobDiscoverResponse, JobRecommendation
from app.services import openai_client, supabase_client
from app.services.job_search_service import search_jobs

logger = logging.getLogger(__name__)
router = APIRouter()

JOB_ANALYZER_SYSTEM_PROMPT = """You are a job requirements analyst. Extract structured requirements from the job posting.

Return a valid JSON object with exactly these keys:
- required_skills: list of required technical and soft skills
- preferred_skills: list of preferred or nice-to-have skills
- responsibilities: list of key job responsibilities
- qualifications: list of required qualifications (education, years of experience, etc.)
- keywords: list of important keywords and phrases for ATS matching
- seniority_level: one of "entry", "junior", "mid-level", "senior", "lead", "principal", "executive"
- job_type: one of "full-time", "part-time", "contract", "freelance", "internship", "remote"

Return only valid JSON. Do not add markdown or extra text."""


def _normalise_skill(skill: str) -> str:
    return skill.lower().strip()


def _compute_match_score(candidate_profile: dict, job: dict) -> tuple[int, list[str], list[str]]:
    """Compute a match score between candidate and job.

    Returns: (score 0-100, match_reasons, missing_requirements)
    """
    candidate_skills = {_normalise_skill(s) for s in candidate_profile.get("core_skills", [])}
    preferred_keywords = {_normalise_skill(k) for k in candidate_profile.get("preferred_job_keywords", [])}
    target_roles = [r.lower() for r in candidate_profile.get("target_roles", [])]

    job_desc = (job.get("job_description") or "").lower()
    job_title = (job.get("role_title") or "").lower()

    if candidate_skills:
        matched_skills = {s for s in candidate_skills if s in job_desc}
        skills_score = min(60, int((len(matched_skills) / len(candidate_skills)) * 60))
    else:
        matched_skills = set()
        skills_score = 0

    missing_skills = candidate_skills - matched_skills

    title_score = 0
    for role in target_roles:
        role_words = set(role.split())
        title_words = set(job_title.split())
        overlap = role_words & title_words
        if overlap:
            ratio = len(overlap) / max(len(role_words), 1)
            title_score = max(title_score, int(ratio * 20))

    if preferred_keywords:
        matched_keywords = {k for k in preferred_keywords if k in job_desc}
        keyword_score = min(20, int((len(matched_keywords) / len(preferred_keywords)) * 20))
    else:
        matched_keywords = set()
        keyword_score = 0

    total = min(100, skills_score + title_score + keyword_score)

    match_reasons: list[str] = []
    if matched_skills:
        match_reasons.append(f"Matching skills: {', '.join(sorted(matched_skills)[:5])}")
    if title_score > 0:
        match_reasons.append("Role title alignment with target roles")
    if matched_keywords:
        match_reasons.append(f"Keyword match: {', '.join(sorted(matched_keywords)[:5])}")

    missing_reqs = sorted(missing_skills)[:5]
    return total, match_reasons, missing_reqs


def _score_to_confidence(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 55:
        return "medium"
    return "low"


@router.post("/discover", response_model=JobDiscoverResponse)
async def discover_jobs(request: JobDiscoverRequest) -> JobDiscoverResponse:
    """Search for jobs based on candidate profile and return scored recommendations.

    Loads the candidate profile's search queries, searches Adzuna (or returns
    dummy jobs if no API key), scores each result, and persists job_posts +
    job_recommendations rows.
    """
    db = supabase_client.get_client()

    # Load candidate profile
    try:
        profile_result = (
            db.table("candidate_profiles")
            .select("profile_json, search_queries")
            .eq("resume_id", request.resume_id)
            .eq("user_id", request.user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load candidate profile: {exc}")

    if not profile_result.data:
        raise HTTPException(
            status_code=404,
            detail="Candidate profile not found. Run /resumes/{id}/candidate-profile first.",
        )

    profile_data = profile_result.data[0]
    candidate_profile: dict = profile_data.get("profile_json") or {}
    search_queries: list[str] = profile_data.get("search_queries") or candidate_profile.get("search_queries", [])

    # Override or append with user-provided keyword
    if request.keyword:
        search_queries = [f"{request.keyword} {q}" for q in search_queries[:3]] + search_queries[:2]

    if not search_queries:
        raise HTTPException(status_code=422, detail="No search queries available. Generate a candidate profile first.")

    # Search for jobs
    raw_jobs = await search_jobs(
        queries=search_queries,
        location=request.location,
        job_type=request.job_type,
        limit=20,
    )

    recommendations: list[JobRecommendation] = []
    for job in raw_jobs:
        try:
            insert_result = (
                db.table("job_posts")
                .insert(
                    {
                        "user_id": request.user_id,
                        "source": job.get("source", ""),
                        "job_url": job.get("job_url", ""),
                        "company_name": job.get("company_name", ""),
                        "role_title": job.get("role_title", ""),
                        "location": job.get("location", ""),
                        "job_description": job.get("job_description", ""),
                    }
                )
                .execute()
            )
            job_post_id: str = insert_result.data[0]["id"] if insert_result.data else ""
            if not job_post_id:
                continue

            score, match_reasons, missing_reqs = _compute_match_score(candidate_profile, job)
            confidence = _score_to_confidence(score)

            db.table("job_recommendations").insert(
                {
                    "user_id": request.user_id,
                    "resume_id": request.resume_id,
                    "job_post_id": job_post_id,
                    "match_score": score,
                    "confidence_label": confidence,
                    "match_reasons": match_reasons,
                    "missing_requirements": missing_reqs,
                }
            ).execute()

            recommendations.append(
                JobRecommendation(
                    job_post_id=job_post_id,
                    company_name=job.get("company_name", ""),
                    role_title=job.get("role_title", ""),
                    location=job.get("location", ""),
                    job_url=job.get("job_url", ""),
                    match_score=score,
                    confidence_label=confidence,  # type: ignore[arg-type]
                    match_reasons=match_reasons,
                    missing_requirements=missing_reqs,
                )
            )
        except Exception as exc:
            logger.warning("Failed to process job result: %s", exc)
            continue

    recommendations.sort(key=lambda r: r.match_score, reverse=True)

    return JobDiscoverResponse(
        user_id=request.user_id,
        resume_id=request.resume_id,
        total_found=len(recommendations),
        recommendations=recommendations,
    )


class WebJobSearchRequest(BaseModel):
    user_id: str
    resume_id: str
    location: str = ""
    job_type: str = ""


@router.post("/search-web")
async def search_jobs_from_resume(request: WebJobSearchRequest) -> dict:
    """Search the web for relevant jobs based on the candidate's resume.

    Uses OpenAI's web_search_preview MCP tool to find real current job
    postings matching the candidate's skills and experience — no separate
    job board API key required.
    """
    db = supabase_client.get_client()

    # Load resume parsed_json
    try:
        result = (
            db.table("resumes")
            .select("parsed_json, raw_text")
            .eq("id", request.resume_id)
            .eq("user_id", request.user_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Resume not found: {exc}")

    parsed_json: dict = (result.data or {}).get("parsed_json") or {}

    # Try to load candidate profile for target_roles and core_skills
    target_roles: list[str] = []
    core_skills: list[str] = []
    try:
        profile_result = (
            db.table("candidate_profiles")
            .select("profile_json")
            .eq("resume_id", request.resume_id)
            .eq("user_id", request.user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if profile_result.data:
            profile_json: dict = profile_result.data[0].get("profile_json") or {}
            target_roles = profile_json.get("target_roles") or []
            core_skills = profile_json.get("core_skills") or []
    except Exception:
        pass  # fall back to resume-based queries below

    loc = request.location.strip()

    if target_roles:
        # Build one query per target role (up to 4), optionally with location
        queries = []
        for role in target_roles[:4]:
            queries.append(f"{role} {loc}".strip() if loc else role)
    else:
        # Fall back: build queries from resume's work experience + skills
        from app.services.job_search_service import _flatten_skills_from_dict

        skills = _flatten_skills_from_dict(parsed_json.get("skills", []))[:5]
        exp_roles = [
            exp.get("title") or exp.get("role", "")
            for exp in (parsed_json.get("work_experience") or [])
            if exp.get("title") or exp.get("role")
        ][:2]
        latest_role = exp_roles[0] if exp_roles else "software engineer"
        top_skills = ", ".join(skills[:3])
        queries = [
            f"{latest_role} {loc}".strip() if loc else latest_role,
            f"{top_skills} developer {loc}".strip() if top_skills else f"developer {loc}".strip(),
        ]

    queries = [q.strip() for q in queries if q.strip()]

    jobs = await search_jobs(
        queries=queries,
        location=request.location,
        job_type=request.job_type,
        limit=9,
    )

    # Save each job as a job_post row so user can evaluate against it
    saved: list[dict] = []
    for job in jobs:
        try:
            insert = (
                db.table("job_posts")
                .insert({
                    "user_id": request.user_id,
                    "source": job.get("source", "web"),
                    "job_url": job.get("job_url", ""),
                    "company_name": job.get("company_name", ""),
                    "role_title": job.get("role_title", ""),
                    "location": job.get("location", ""),
                    "job_description": job.get("job_description", ""),
                })
                .execute()
            )
            job_post_id = insert.data[0]["id"] if insert.data else None
            if job_post_id:
                saved.append({**job, "job_post_id": job_post_id})
        except Exception as exc:
            logger.warning("Failed to save job post: %s", exc)

    return {
        "resume_id": request.resume_id,
        "queries_used": queries,
        "jobs_found": len(saved),
        "jobs": saved,
    }


class JobAnalyzeRequest(BaseModel):
    user_id: str


@router.post("/{job_post_id}/analyze")
async def analyze_job(job_post_id: str, request: JobAnalyzeRequest) -> dict:
    """Extract structured requirements from a job posting using GPT-4o.

    Loads the job_post from DB, calls GPT to extract requirements, saves
    them back, and returns the extracted_requirements dict.
    """
    db = supabase_client.get_client()

    try:
        result = (
            db.table("job_posts")
            .select("id, company_name, role_title, job_description")
            .eq("id", job_post_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Job post not found: {exc}")

    if not result.data:
        raise HTTPException(status_code=404, detail="Job post not found.")

    job_data = result.data
    job_description = job_data.get("job_description", "")

    if not job_description:
        raise HTTPException(status_code=422, detail="Job post has no description to analyze.")

    try:
        messages = [
            {"role": "system", "content": JOB_ANALYZER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Company: {job_data.get('company_name', '')}\n"
                    f"Role: {job_data.get('role_title', '')}\n\n"
                    f"Job Description:\n{job_description}"
                ),
            },
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        extracted_requirements: dict = json.loads(raw_response)
    except Exception as exc:
        logger.exception("Failed to extract job requirements: %s", exc)
        raise HTTPException(status_code=500, detail=f"GPT extraction failed: {exc}")

    try:
        db.table("job_posts").update(
            {"extracted_requirements": extracted_requirements}
        ).eq("id", job_post_id).execute()
    except Exception as exc:
        logger.warning("Failed to save extracted_requirements: %s", exc)

    return {
        "job_post_id": job_post_id,
        "company_name": job_data.get("company_name", ""),
        "role_title": job_data.get("role_title", ""),
        "extracted_requirements": extracted_requirements,
    }
