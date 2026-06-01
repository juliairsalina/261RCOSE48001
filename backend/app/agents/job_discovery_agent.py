from __future__ import annotations

import logging
from typing import Any

from app.agents.state import AgentState
from app.services import supabase_client
from app.services.job_search_service import search_jobs

logger = logging.getLogger(__name__)


def _normalise_skill(skill: str) -> str:
    return skill.lower().strip()


def _compute_match_score(
    candidate_profile: dict[str, Any],
    job: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    """Compute a match score (0-100) between the candidate profile and a job.

    Scoring breakdown:
      - Skills overlap:  up to 60 points
      - Title similarity: up to 20 points
      - Keyword overlap:  up to 20 points

    Returns:
        (score, match_reasons, missing_requirements)
    """
    candidate_skills = {_normalise_skill(s) for s in candidate_profile.get("core_skills", [])}
    preferred_keywords = {_normalise_skill(k) for k in candidate_profile.get("preferred_job_keywords", [])}
    target_roles = [r.lower() for r in candidate_profile.get("target_roles", [])]

    job_desc = (job.get("job_description") or "").lower()
    job_title = (job.get("role_title") or "").lower()

    # ── Skills overlap (60 pts max) ──────────────────────────────────────
    if candidate_skills:
        matched_skills = {s for s in candidate_skills if s in job_desc}
        skills_ratio = len(matched_skills) / len(candidate_skills)
        skills_score = min(60, int(skills_ratio * 60))
    else:
        matched_skills = set()
        skills_score = 0

    missing_skills = candidate_skills - matched_skills

    # ── Title similarity (20 pts max) ────────────────────────────────────
    title_score = 0
    for role in target_roles:
        role_words = set(role.split())
        title_words = set(job_title.split())
        overlap = role_words & title_words
        if overlap:
            ratio = len(overlap) / max(len(role_words), 1)
            title_score = max(title_score, int(ratio * 20))

    # ── Keyword overlap (20 pts max) ─────────────────────────────────────
    if preferred_keywords:
        matched_keywords = {k for k in preferred_keywords if k in job_desc}
        keyword_ratio = len(matched_keywords) / len(preferred_keywords)
        keyword_score = min(20, int(keyword_ratio * 20))
    else:
        matched_keywords = set()
        keyword_score = 0

    total = min(100, skills_score + title_score + keyword_score)

    match_reasons: list[str] = []
    if matched_skills:
        match_reasons.append(f"Matching skills: {', '.join(sorted(matched_skills)[:5])}")
    if title_score > 0:
        match_reasons.append(f"Role title alignment with target roles")
    if matched_keywords:
        match_reasons.append(f"Keyword match: {', '.join(sorted(matched_keywords)[:5])}")

    missing_reqs = [s for s in sorted(missing_skills)[:5]] if missing_skills else []

    return total, match_reasons, missing_reqs


def _score_to_confidence(score: int) -> str:
    if score >= 80:
        return "high"
    if score >= 55:
        return "medium"
    return "low"


async def discover_jobs_node(state: AgentState) -> AgentState:
    """LangGraph node: search for jobs and score them against the candidate profile.

    Loads search_queries from candidate_profile, calls job_search_service,
    inserts job_posts rows, scores each job, and saves job_recommendations.
    """
    candidate_profile = state.get("candidate_profile")
    user_id = state["user_id"]
    resume_id = state.get("resume_id", "")
    errors: list[str] = list(state.get("errors", []))

    if not candidate_profile:
        errors.append("discover_jobs_node: candidate_profile is missing from state")
        return {**state, "errors": errors}

    try:
        search_queries: list[str] = candidate_profile.get("search_queries", [])
        if not search_queries:
            errors.append("discover_jobs_node: no search_queries in candidate_profile")
            return {**state, "errors": errors}

        # 1. Search for jobs
        raw_jobs = await search_jobs(queries=search_queries, limit=20)

        db = supabase_client.get_client()
        job_post_ids: list[str] = []

        for job in raw_jobs:
            try:
                # 2. Insert into job_posts
                insert_result = (
                    db.table("job_posts")
                    .insert(
                        {
                            "user_id": user_id,
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

                # 3. Score match
                score, match_reasons, missing_reqs = _compute_match_score(candidate_profile, job)
                confidence = _score_to_confidence(score)

                # 4. Save job_recommendation
                db.table("job_recommendations").insert(
                    {
                        "user_id": user_id,
                        "resume_id": resume_id,
                        "job_post_id": job_post_id,
                        "match_score": score,
                        "confidence_label": confidence,
                        "match_reasons": match_reasons,
                        "missing_requirements": missing_reqs,
                    }
                ).execute()

                job_post_ids.append(job_post_id)

            except Exception as job_exc:
                logger.warning("Failed to process job: %s", job_exc)
                continue

        return {**state, "job_post_ids": job_post_ids, "errors": errors}

    except Exception as exc:
        logger.exception("discover_jobs_node failed: %s", exc)
        errors.append(f"discover_jobs_node error: {exc}")
        return {**state, "errors": errors}
