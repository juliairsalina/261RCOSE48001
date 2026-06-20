from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

REWRITE_SYSTEM_PROMPT = """You are a resume ATS expert. Your job is to identify weak bullet points and descriptions that are hurting the candidate's ATS score, and rewrite only those.

STRICT SELECTION RULES — only suggest a rewrite if ALL of these are true:
1. The original text is genuinely weak: vague, missing key job keywords, lacks measurable impact, or uses passive/weak language
2. The rewrite directly incorporates missing skills or keywords from the job requirements
3. The rewrite will concretely increase the ATS match score (e.g. adds a required keyword that was missing)
4. Do NOT rewrite text that is already strong, specific, or keyword-aligned

WHAT TO REWRITE:
- Bullet points or descriptions in work_experience or projects that are vague ("worked on X", "helped with Y", "responsible for Z")
- Leadership descriptions
- Achievement descriptions
- Certification descriptions (only descriptions, not certification names)
- Text missing keywords from the job's required_skills or keywords list
- Weak action verbs with no measurable outcome

WHAT NOT TO REWRITE:
- Already strong bullets with numbers and results
- Text that already contains the required keywords
- Lines that are fine but you could "make slightly better" — skip those
- Skills section, summary, education, certification names

REWRITE RULES:
- Keep the same experience — never fabricate achievements or tools the candidate didn't use
- Add measurable outcomes only if there's existing evidence to support them
- Weave in missing job keywords naturally, not forcefully
- Keep the same approximate length

Return a JSON object with key "suggestions" containing a list. Each object must have:
- section: "work_experience", "projects", "leadership", "achievements" or "certifications" only
- item_label: identifies which entry this belongs to — for work_experience use "company - title", for projects use the project name, for leadership use "title - organization", for achievements/certifications use the title/name. Copy this exactly from the resume data provided.
- original_text: exact original text (copy precisely). If the description is blank/empty, use an empty string "".
- suggested_text: the rewritten version
- reason: one sentence — which specific keyword or weakness this fixes and how it raises the ATS score

If no bullet points genuinely need improvement, return {"suggestions": []}.
Return only valid JSON. No markdown."""


async def generate_rewrite_suggestions_node(state: AgentState) -> AgentState:
    """LangGraph node: generate resume rewrite suggestions based on ATS evaluation.

    Calls GPT with resume, job requirements, and ATS results to produce targeted
    rewrite suggestions. Saves each suggestion to rewrite_suggestions with status=pending.
    """
    ats_result = state.get("ats_result")
    retrieved_context = state.get("retrieved_context") or []
    resume_json = state.get("resume_json")
    job_json = state.get("job_json")
    application_id = state.get("application_id")
    new_errors: list[str] = []

    if not ats_result:
        new_errors.append("generate_rewrite_suggestions_node: ats_result is missing from state")
        return {"errors": new_errors}

    if not resume_json:
        new_errors.append("generate_rewrite_suggestions_node: resume_json is missing from state")
        return {"errors": new_errors}

    if not job_json:
        new_errors.append("generate_rewrite_suggestions_node: job_json is missing from state")
        return {"errors": new_errors}

    try:
        context_text = "\n".join(
            c.get("chunk_text", "") for c in retrieved_context[:5]
        ) if retrieved_context else "No additional context."

        # Only pass experience, project, leadership, achievements, and certifications sections to the model
        resume_subset = {
            "work_experience": resume_json.get("work_experience", []),
            "projects": resume_json.get("projects", []),
            "leadership": resume_json.get("leadership", []),
            "achievements": resume_json.get("achievements", []),
            "certifications": resume_json.get("certifications", []),
        }

        requirements = job_json.get("extracted_requirements") or {}
        required_keywords = (
            requirements.get("required_skills", []) +
            requirements.get("keywords", [])
        )

        messages = [
            {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"ATS Score: {ats_result.get('score', 0)}/100\n"
                    f"Missing keywords (MUST incorporate where naturally possible): {', '.join(ats_result.get('missing_skills', []))}\n"
                    f"All required job keywords: {', '.join(required_keywords[:20])}\n"
                    f"Weaknesses identified: {'; '.join(ats_result.get('weaknesses', []))}\n\n"
                    f"Job title: {job_json.get('role_title', '')}\n\n"
                    f"Resume sections to review:\n{json.dumps(resume_subset, ensure_ascii=False)[:3000]}\n\n"
                    f"Additional context:\n{context_text[:1000]}"
                ),
            },
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        gpt_result: dict = json.loads(raw_response)
        raw_suggestions: list[dict[str, Any]] = gpt_result.get("suggestions", [])

        # Filter to only experience, project, leadership, achievements and certifications suggestions (belt-and-suspenders)
        allowed_sections = {"work_experience", "projects", "leadership", "achievements", "certifications", }
        suggestions = [s for s in raw_suggestions if s.get("section", "") in allowed_sections]

        # Replace any existing suggestions for this application to avoid duplicates
        # on re-evaluation (same application_id used twice).
        if application_id:
            db = supabase_client.get_client()
            db.table("rewrite_suggestions").delete().eq("application_id", application_id).execute()
            for suggestion in suggestions:
                db.table("rewrite_suggestions").insert(
                    {
                        "application_id": application_id,
                        "section": suggestion.get("section", ""),
                        "item_label": suggestion.get("item_label", ""),
                        "original_text": suggestion.get("original_text", ""),
                        "suggested_text": suggestion.get("suggested_text", ""),
                        "reason": suggestion.get("reason", ""),
                        "status": "pending",
                    }
                ).execute()

        return {"rewrite_suggestions": suggestions, "errors": new_errors}

    except Exception as exc:
        logger.exception("generate_rewrite_suggestions_node failed: %s", exc)
        new_errors.append(f"generate_rewrite_suggestions_node error: {exc}")
        return {"errors": new_errors}
