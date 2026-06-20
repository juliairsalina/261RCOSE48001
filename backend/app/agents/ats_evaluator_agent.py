from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

ATS_EVALUATOR_SYSTEM_PROMPT = """You are an ATS and job-resume matching evaluator.

Your task is to evaluate how well a resume matches a job description.

IMPORTANT:
Do not treat cosine similarity as the final score.
Cosine similarity only measures semantic similarity between the resume text and job description text.
A strong candidate does not need to match 100% of the job description.

Use cosine similarity as one signal only, then adjust the final score using realistic hiring logic.

EVALUATION LOGIC:

1. Required Skills Match
   Check whether the resume contains the must-have skills from the job description.
   This should have the highest weight.

2. Preferred Skills Match
   Check whether the resume contains nice-to-have skills.
   These should improve the score but should not overly punish the candidate if missing.

3. Role Relevance
   Check whether the candidate's projects, experience, education, and achievements are relevant to the target role.

4. Experience Level Fit
   Check whether the candidate fits the expected level, such as intern, junior, mid-level, or senior.
   For internship roles, academic projects, hackathons, coursework, and volunteering can count as relevant experience.

5. Semantic Similarity
   Use cosine similarity to understand general text similarity, but do not require 100% similarity.
   A realistic good match may be between 65% and 85%.
   A score above 90% should only happen when the resume strongly matches most required skills and responsibilities.

6. Missing Gaps
   Identify important missing requirements, but separate critical gaps from minor gaps.

7. Transferable Skills
   Give credit for related experience even if the exact keyword is different.
   For example:

* PyTorch experience can partially match deep learning requirements.
* OCR project can partially match computer vision or document AI roles.
* SQL and data cleaning can match data analytics requirements.

SCORING RULES:

Final score should be based on:

* Required skills match: 35%
* Role/project relevance: 25%
* Experience level fit: 15%
* Preferred skills match: 10%
* Semantic similarity: 10%
* Education/domain fit: 5%

Do not output a perfect score unless the resume directly satisfies almost every important job requirement.

Score interpretation:

* 85-100: Strong match
* 70-84: Good match
* 55-69: Partial match
* 40-54: Weak match
* below 40: Poor match

OUTPUT RULES:
Return only valid JSON.
Do not include markdown.
Do not include explanation outside JSON.

Return this JSON structure:

{
"final_match_score": 0,
"match_level": "",
"cosine_similarity_score": 0,
"score_breakdown": {
"required_skills_match": 0,
"role_project_relevance": 0,
"experience_level_fit": 0,
"preferred_skills_match": 0,
"semantic_similarity": 0,
"education_domain_fit": 0
},
"matched_requirements": [],
"missing_critical_requirements": [],
"missing_minor_requirements": [],
"transferable_skills": [],
"reasoning": "",
"improvement_suggestions": []
}"""


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


def _compute_cosine_similarity(retrieved_context: list[dict[str, Any]]) -> float:
    """Estimate cosine similarity from the average of top retrieved chunk similarities."""
    scores = [
        c.get("similarity", 0.0)
        for c in retrieved_context
        if isinstance(c.get("similarity"), (int, float))
    ]
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores) * 100, 1)


def _score_to_rank(score: int) -> str:
    if score >= 85:
        return "상"
    if score >= 55:
        return "중"
    return "하"


def _is_general_evaluation(job_json: dict[str, Any]) -> bool:
    """True when there's no real job posting to match against (link-less evaluation)."""
    job_description = (job_json.get("job_description") or "").lower()
    requirements = job_json.get("extracted_requirements") or {}
    has_requirements = bool(
        requirements.get("required_skills")
        or requirements.get("preferred_skills")
        or requirements.get("keywords")
    )
    return "general resume evaluation" in job_description or not has_requirements


GENERAL_EVALUATION_INSTRUCTIONS = """
NOTE: No specific job posting was provided — this is a general resume quality
evaluation, not a job-match evaluation. There are no job requirements to
compare against, so do NOT return empty missing_critical_requirements /
missing_minor_requirements just because nothing was "missing" from a job
description.

Instead, evaluate the resume on its own merits as a hiring manager would:
- matched_requirements: notable strengths in the resume (skills, experience, achievements)
- missing_critical_requirements / missing_minor_requirements: concrete weaknesses
  in the resume itself — e.g. bullets lacking quantified impact, missing
  certifications or tools relevant to the candidate's apparent target role,
  thin experience depth, no leadership/ownership examples, weak skills section.
- improvement_suggestions: specific, actionable fixes for those weaknesses.

Still return the full JSON structure with a final_match_score representing
overall resume quality/completeness (not job fit)."""


async def evaluate_ats_node(state: AgentState) -> AgentState:
    """LangGraph node: evaluate ATS match between resume and job.

    Computes cosine similarity from RAG retrieval scores, calls GPT for
    full scoring and qualitative analysis, saves to ats_evaluations, and
    updates state.
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
        # 1. Compute cosine similarity from RAG retrieval scores
        cosine_similarity = _compute_cosine_similarity(retrieved_context)

        # 2. Build context string from retrieved chunks
        context_text = (
            "\n".join(c.get("chunk_text", "") for c in retrieved_context[:5])
            if retrieved_context
            else "No additional context retrieved."
        )

        # 3. Call GPT for full evaluation and scoring
        is_general = _is_general_evaluation(job_json)
        user_content = (
            f"Cosine Similarity Score: {cosine_similarity}\n\n"
            f"Job Description:\n{json.dumps(job_json, ensure_ascii=False)[:2000]}\n\n"
            f"Resume JSON:\n{json.dumps(resume_json, ensure_ascii=False)[:3000]}\n\n"
            f"Retrieved Resume Context:\n{context_text[:1500]}"
        )
        if is_general:
            user_content += "\n\n" + GENERAL_EVALUATION_INSTRUCTIONS

        messages = [
            {"role": "system", "content": ATS_EVALUATOR_SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        gpt_result: dict = json.loads(raw_response)

        final_score = int(gpt_result.get("final_match_score", 0))
        match_level = gpt_result.get("match_level", "")
        rank = _score_to_rank(final_score)

        matched_requirements = gpt_result.get("matched_requirements", [])
        missing_critical = gpt_result.get("missing_critical_requirements", [])
        missing_minor = gpt_result.get("missing_minor_requirements", [])
        improvement_suggestions = gpt_result.get("improvement_suggestions", [])
        transferable_skills = gpt_result.get("transferable_skills", [])

        ats_result = {
            "score": final_score,
            "rank": rank,
            "match_level": match_level,
            "cosine_similarity_score": gpt_result.get("cosine_similarity_score", cosine_similarity),
            "score_breakdown": gpt_result.get("score_breakdown", {}),
            # New field names
            "matched_requirements": matched_requirements,
            "missing_critical_requirements": missing_critical,
            "missing_minor_requirements": missing_minor,
            "transferable_skills": transferable_skills,
            "reasoning": gpt_result.get("reasoning", ""),
            "improvement_suggestions": improvement_suggestions,
            # Frontend-compatible aliases
            "matched_skills": matched_requirements,
            "missing_skills": missing_critical + missing_minor,
            "weaknesses": missing_critical + missing_minor,
            "strengths": matched_requirements,
            "improvement_priority": improvement_suggestions,
        }

        # 4. Save to ats_evaluations — replace any previous result for this
        # application so re-evaluations don't accumulate stale rows.
        if application_id:
            db = supabase_client.get_client()
            db.table("ats_evaluations").delete().eq("application_id", application_id).execute()
            db.table("ats_evaluations").insert(
                {
                    "application_id": application_id,
                    "score": final_score,
                    "rank": rank,
                    "matched_skills": matched_requirements,
                    "missing_skills": missing_critical + missing_minor,
                    "strengths": matched_requirements,
                    "weaknesses": missing_critical + missing_minor,
                    "evidence": [],
                }
            ).execute()

        return {"ats_result": ats_result, "errors": new_errors}

    except Exception as exc:
        logger.exception("evaluate_ats_node failed: %s", exc)
        new_errors.append(f"evaluate_ats_node error: {exc}")
        return {"errors": new_errors}
