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
- If a skill is missing with no evidence, note it as something the user should consider adding
- Focus only on sections where improvements will meaningfully increase ATS match score

Return a JSON object with key "suggestions" containing a list of objects with exactly these fields:
- section: the resume section being improved (e.g. "summary", "work_experience", "skills", "projects")
- original_text: the exact original text from the resume that should be replaced (quote it precisely)
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
    errors: list[str] = list(state.get("errors", []))

    if not ats_result:
        errors.append("generate_rewrite_suggestions_node: ats_result is missing from state")
        return {**state, "errors": errors}

    if not resume_json:
        errors.append("generate_rewrite_suggestions_node: resume_json is missing from state")
        return {**state, "errors": errors}

    if not job_json:
        errors.append("generate_rewrite_suggestions_node: job_json is missing from state")
        return {**state, "errors": errors}

    try:
        context_text = "\n".join(
            c.get("chunk_text", "") for c in retrieved_context[:5]
        ) if retrieved_context else "No additional context."

        messages = [
            {"role": "system", "content": REWRITE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"ATS Score: {ats_result.get('score', 0)}/100 (Rank: {ats_result.get('rank', 'N/A')})\n"
                    f"Missing Skills: {', '.join(ats_result.get('missing_skills', []))}\n"
                    f"Weaknesses: {'; '.join(ats_result.get('weaknesses', []))}\n\n"
                    f"Job Requirements:\n{json.dumps(job_json.get('extracted_requirements', {}), ensure_ascii=False)}\n\n"
                    f"Current Resume:\n{json.dumps(resume_json, ensure_ascii=False)[:3000]}\n\n"
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
        suggestions: list[dict[str, Any]] = gpt_result.get("suggestions", [])

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

        return {**state, "rewrite_suggestions": suggestions, "errors": errors}

    except Exception as exc:
        logger.exception("generate_rewrite_suggestions_node failed: %s", exc)
        errors.append(f"generate_rewrite_suggestions_node error: {exc}")
        return {**state, "errors": errors}
