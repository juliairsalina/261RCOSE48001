from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

ATS_EVALUATOR_SYSTEM_PROMPT = """You are an ATS (Applicant Tracking System) expert evaluator.

Given the job requirements, candidate's resume JSON, and retrieved resume context, produce a detailed evaluation.

Return a valid JSON object with exactly these keys:
- strengths: list of 3-5 specific strengths the candidate demonstrates for this role
- weaknesses: list of 3-5 specific gaps or weaknesses relative to the job
- improvement_priority: ordered list of 3-5 areas the candidate should prioritize to improve their match
- evidence: list of objects with "claim" (a statement about the candidate) and "resume_evidence" (direct quote or reference from resume that supports it)

The score and rank will be calculated separately. Focus on qualitative analysis.
Return only valid JSON. Do not add markdown or extra text."""


def _normalise(text: str) -> str:
    return text.lower().strip()


def _flatten_skills(skills: object) -> list[str]:
    """Convert skills field (str list, dict list, or dict) to a flat list of strings."""
    if not skills:
        return []
    if isinstance(skills, dict):
        result: list[str] = []
        for v in skills.values():
            result.extend(_flatten_skills(v))
        return result
    if isinstance(skills, list):
        out: list[str] = []
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
    return [str(skills)]


def _compute_ats_score(
    resume_json: dict[str, Any],
    job_json: dict[str, Any],
) -> tuple[int, list[str], list[str]]:
    """Calculate a deterministic ATS score (0-100).

    Job-based scoring (no floors — missing skills actively hurt):
      - Required skills match:         40 pts  (pure ratio, 0 if nothing matches)
      - Preferred skills match:        20 pts  (pure ratio)
      - Responsibility/exp match:      20 pts  (phrase-level: ≥50% of meaningful
                                                words in a responsibility must appear
                                                in resume to count as matched)
      - Keyword alignment:             10 pts  (pure ratio)
      - Resume depth (bullet count):  10 pts  (1 pt/bullet, cap 10)

    General evaluation (no job posting): scores resume completeness/depth.
    """
    requirements = job_json.get("extracted_requirements") or {}
    job_description = (job_json.get("job_description") or "").strip()
    is_placeholder = "general resume evaluation" in job_description.lower()

    # Flatten resume content into a single searchable string
    resume_skills = [_normalise(s) for s in _flatten_skills(resume_json.get("skills", []))]
    work_experience = resume_json.get("work_experience", [])
    projects = resume_json.get("projects", [])

    leadership = resume_json.get("leadership", [])
    achievements = resume_json.get("achievements", [])
    certifications = resume_json.get("certifications", [])

    resume_text = " ".join(resume_skills)
    all_bullets: list[str] = []
    for exp in work_experience:
        for b in exp.get("bullets", []):
            resume_text += " " + b.lower()
            all_bullets.append(b)
        resume_text += " " + (exp.get("description") or "").lower()
    for proj in projects:
        for b in proj.get("bullets", []):
            resume_text += " " + b.lower()
            all_bullets.append(b)
        resume_text += " " + (proj.get("description") or "").lower()
        for tech in proj.get("technologies", []):
            resume_text += " " + tech.lower()
    for item in leadership:
        for b in item.get("bullets", []):
            resume_text += " " + b.lower()
            all_bullets.append(b)
        resume_text += " " + (item.get("description") or "").lower()
        resume_text += " " + (item.get("title") or "").lower()
        resume_text += " " + (item.get("organization") or "").lower()
    for ach in achievements:
        resume_text += " " + (ach.get("title") or "").lower()
        resume_text += " " + (ach.get("description") or "").lower()
    for cert in certifications:
        resume_text += " " + (cert.get("name") or "").lower()
        resume_text += " " + (cert.get("issuer") or "").lower()

    has_requirements = bool(
        requirements.get("required_skills") or
        requirements.get("preferred_skills") or
        requirements.get("keywords")
    )

    # ── No job posting: score resume completeness/depth ──────────────────
    if is_placeholder or not has_requirements:
        skill_count = len(resume_skills)
        exp_count = len(work_experience)
        proj_count = len(projects)
        bullet_count = len(all_bullets)
        has_contact = bool(resume_json.get("name") and resume_json.get("email"))
        has_education = bool(resume_json.get("education"))

        # No free points — each component earned from zero
        skill_score  = min(30, skill_count * 2)   # 2 pts/skill, need 15 for max
        exp_score    = min(25, exp_count * 8)      # 8 pts/role, need 3 for max
        bullet_score = min(20, bullet_count)       # 1 pt/bullet, need 20 for max
        proj_score   = min(15, proj_count * 5)     # 5 pts/project, need 3 for max
        base_score   = (5 if has_contact else 0) + (5 if has_education else 0)

        total = min(100, skill_score + exp_score + bullet_score + proj_score + base_score)
        return total, resume_skills[:10], []

    # ── Job-based scoring (strict — no floors) ───────────────────────────

    # Required skills: 40 pts
    required_skills = [_normalise(s) for s in requirements.get("required_skills", [])]
    if required_skills:
        matched_required = [s for s in required_skills if s in resume_text]
        required_score = int(len(matched_required) / len(required_skills) * 40)
    else:
        matched_required = []
        required_score = 15  # job didn't list any → partial neutral credit

    # Preferred skills: 20 pts
    preferred_skills = [_normalise(s) for s in requirements.get("preferred_skills", [])]
    if preferred_skills:
        matched_preferred = [s for s in preferred_skills if s in resume_text]
        preferred_score = int(len(matched_preferred) / len(preferred_skills) * 20)
    else:
        matched_preferred = []
        preferred_score = 8  # job didn't list any → partial neutral credit

    # Responsibilities: 20 pts
    # A responsibility counts as matched only when ≥50% of its meaningful words
    # (length > 3) appear in the resume — prevents single common words from scoring.
    responsibilities = [_normalise(r) for r in requirements.get("responsibilities", [])]
    if responsibilities:
        resp_matched = 0
        for r in responsibilities:
            meaningful = [w for w in r.split() if len(w) > 3]
            if not meaningful:
                continue
            hit_ratio = sum(1 for w in meaningful if w in resume_text) / len(meaningful)
            if hit_ratio >= 0.5:
                resp_matched += 1
        resp_score = int(resp_matched / len(responsibilities) * 20)
    else:
        resp_score = 8  # job didn't list any → partial neutral credit

    # Keywords: 10 pts
    keywords = [_normalise(k) for k in requirements.get("keywords", [])]
    if keywords:
        matched_keywords = [k for k in keywords if k in resume_text]
        keyword_score = int(len(matched_keywords) / len(keywords) * 10)
    else:
        matched_keywords = []
        keyword_score = 4  # job didn't list any → partial neutral credit

    # Resume depth: 10 pts (1 pt per bullet, capped at 10)
    depth_score = min(10, len(all_bullets))

    total = min(100, required_score + preferred_score + resp_score + keyword_score + depth_score)

    matched_all = list(set(matched_required + matched_preferred))
    missing_all = [s for s in required_skills if s not in resume_text]

    return total, matched_all, missing_all


def _score_to_rank(score: int) -> str:
    if score >= 80:
        return "상"
    if score >= 55:
        return "중"
    return "하"


async def evaluate_ats_node(state: AgentState) -> AgentState:
    """LangGraph node: evaluate ATS match between resume and job.

    Computes a deterministic score, calls GPT for qualitative analysis,
    saves to ats_evaluations, and updates state.
    """
    resume_json = state.get("resume_json")
    job_json = state.get("job_json")
    retrieved_context = state.get("retrieved_context") or []
    application_id = state.get("application_id")
    new_errors: list[str] = []

    if not resume_json:
        new_errors.append("evaluate_ats_node: resume_json is missing from state")
        return {"errors": new_errors}

    if not job_json:
        new_errors.append("evaluate_ats_node: job_json is missing from state")
        return {"errors": new_errors}

    try:
        # 1. Compute deterministic score
        score, matched_skills, missing_skills = _compute_ats_score(resume_json, job_json)
        rank = _score_to_rank(score)

        # 2. Build context string from retrieved chunks
        context_text = "\n".join(
            c.get("chunk_text", "") for c in retrieved_context[:5]
        ) if retrieved_context else "No additional context retrieved."

        # 3. Call GPT for qualitative analysis
        messages = [
            {"role": "system", "content": ATS_EVALUATOR_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"ATS Score: {score}/100 (Rank: {rank})\n"
                    f"Matched Skills: {', '.join(matched_skills[:10])}\n"
                    f"Missing Skills: {', '.join(missing_skills[:10])}\n\n"
                    f"Job Requirements:\n{json.dumps(job_json.get('extracted_requirements', {}), ensure_ascii=False)}\n\n"
                    f"Resume JSON:\n{json.dumps(resume_json, ensure_ascii=False)[:3000]}\n\n"
                    f"Retrieved Resume Context:\n{context_text[:1500]}"
                ),
            },
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        gpt_result: dict = json.loads(raw_response)

        ats_result = {
            "score": score,
            "rank": rank,
            "matched_skills": matched_skills,
            "missing_skills": missing_skills,
            "strengths": gpt_result.get("strengths", []),
            "weaknesses": gpt_result.get("weaknesses", []),
            "improvement_priority": gpt_result.get("improvement_priority", []),
            "evidence": gpt_result.get("evidence", []),
        }

        # 4. Save to ats_evaluations
        if application_id:
            db = supabase_client.get_client()
            db.table("ats_evaluations").insert(
                {
                    "application_id": application_id,
                    "score": score,
                    "rank": rank,
                    "matched_skills": matched_skills,
                    "missing_skills": missing_skills,
                    "strengths": ats_result["strengths"],
                    "weaknesses": ats_result["weaknesses"],
                    "evidence": ats_result["evidence"],
                }
            ).execute()

        return {"ats_result": ats_result, "errors": new_errors}

    except Exception as exc:
        logger.exception("evaluate_ats_node failed: %s", exc)
        new_errors.append(f"evaluate_ats_node error: {exc}")
        return {"errors": new_errors}
