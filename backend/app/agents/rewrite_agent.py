from __future__ import annotations

import json
import logging
from typing import Any

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

REWRITE_SYSTEM_PROMPT = """You are a resume improvement expert. Based on the ATS evaluation and job requirements, suggest specific improvements to the resume.

Rules:
- Never invent skills or experience the candidate doesn't have
- Improve clarity, impact, and keyword alignment
- Add measurable results where possible based on existing evidence
- ONLY suggest rewrites for work_experience bullet points/descriptions and projects bullet points/descriptions
- Do NOT suggest changes to skills, summary, education, or any other section
- Focus on making experience and project descriptions more impactful and keyword-aligned with the job

Return a JSON object with key "suggestions" containing a list of objects with exactly these fields:
- section: must be either "work_experience" or "projects"
- original_text: the exact original bullet point or description text from the resume (quote it precisely)
- suggested_text: the improved replacement text
- reason: a clear explanation of why this change improves ATS matching or impact

Return only valid JSON. Do not add markdown or extra text."""


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

        # Only pass experience and project sections to the model
        resume_subset = {
            "work_experience": resume_json.get("work_experience", []),
            "projects": resume_json.get("projects", []),
        }

        messages = [
            {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"ATS Score: {ats_result.get('score', 0)}/100 (Rank: {ats_result.get('rank', 'N/A')})\n"
                    f"Missing Skills: {', '.join(ats_result.get('missing_skills', []))}\n"
                    f"Weaknesses: {'; '.join(ats_result.get('weaknesses', []))}\n\n"
                    f"Job Requirements:\n{json.dumps(job_json.get('extracted_requirements', {}), ensure_ascii=False)}\n\n"
                    f"Experience and Projects:\n{json.dumps(resume_subset, ensure_ascii=False)[:3000]}\n\n"
                    f"Retrieved Resume Context:\n{context_text[:1500]}"
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

        # Filter to only experience and project suggestions (belt-and-suspenders)
        allowed_sections = {"work_experience", "projects"}
        suggestions = [s for s in raw_suggestions if s.get("section", "") in allowed_sections]

        # Save each suggestion to rewrite_suggestions table
        if application_id and suggestions:
            db = supabase_client.get_client()
            for suggestion in suggestions:
                db.table("rewrite_suggestions").insert(
                    {
                        "application_id": application_id,
                        "section": suggestion.get("section", ""),
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
