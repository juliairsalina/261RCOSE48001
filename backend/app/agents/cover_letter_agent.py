from __future__ import annotations

import json
import logging

from app.agents.state import AgentState
from app.services import openai_client, supabase_client
from app.services.company_research_service import get_company_background

logger = logging.getLogger(__name__)

COVER_LETTER_SYSTEM_PROMPT = """You are an expert cover letter writer for job seekers.

Write a compelling, personalised cover letter (250-400 words) that:
- Opens with a strong hook connecting the candidate's background to the role
- Highlights 2-3 most relevant experiences or achievements
- Shows genuine interest in the company and role
- Demonstrates fit with the company's values and culture
- Closes with a clear call to action
- Uses professional but warm language
- Avoids generic phrases ("I am writing to apply for...")
- References specific details from the job description and company background
- Start with "Dear Hiring Manager," and end with a signature like "Sincerely, [Candidate Name]".
- Add Date and address block at the top as well.

Return only the cover letter text, no JSON, no markdown, no subject line."""


async def generate_cover_letter_node(state: AgentState) -> AgentState:
    """LangGraph node: generate a personalised cover letter.

    Loads resume_json, job_json, and retrieved_context from state,
    fetches company background, calls GPT to generate a cover letter,
    saves it to cover_letters, and updates state.
    """
    resume_json = state.get("resume_json")
    job_json = state.get("job_json")
    retrieved_context = state.get("retrieved_context") or []
    application_id = state.get("application_id")
    new_errors: list[str] = []

    if not resume_json:
        new_errors.append("generate_cover_letter_node: resume_json is missing from state")
        return {"errors": new_errors}

    if not job_json:
        new_errors.append("generate_cover_letter_node: job_json is missing from state")
        return {"errors": new_errors}

    try:
        company_name = job_json.get("company_name", "the company")
        role_title = job_json.get("role_title", "the position")
        job_url = job_json.get("job_url", "")
        candidate_name = resume_json.get("name", "the candidate")

        # 1. Get company background (prefer pre-researched data from research_company_node)
        company_background = state.get("company_background") or await get_company_background(company_name, job_url)

        # 2. Build context from retrieved chunks
        context_text = "\n".join(
            c.get("chunk_text", "") for c in retrieved_context[:5]
        ) if retrieved_context else ""

        # 3. Call GPT to generate cover letter
        messages = [
            {"role": "system", "content": COVER_LETTER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Candidate: {candidate_name}\n"
                    f"Role: {role_title} at {company_name}\n\n"
                    f"Job Requirements:\n{json.dumps(job_json.get('extracted_requirements', {}), ensure_ascii=False)}\n\n"
                    f"Company Background:\n{json.dumps(company_background, ensure_ascii=False)}\n\n"
                    f"Candidate's Most Relevant Experience:\n{context_text[:2000]}\n\n"
                    f"Full Resume Summary:\n"
                    f"Skills: {', '.join(str(s) for s in (resume_json.get('skills') or [])[:15])}\n"
                    f"Experience: {len(resume_json.get('work_experience', []))} positions\n"
                    f"Education: {', '.join(e.get('institution', '') for e in resume_json.get('education', []))}\n\n"
                    "Write the cover letter now:"
                ),
            },
        ]
        cover_letter_text = await openai_client.chat_completion(
            messages=messages,
            temperature=0.4,
        )

        # 4. Save to cover_letters table
        if application_id:
            db = supabase_client.get_client()
            db.table("cover_letters").insert(
                {
                    "application_id": application_id,
                    "content": cover_letter_text,
                }
            ).execute()

        return {"cover_letter": cover_letter_text, "errors": new_errors}

    except Exception as exc:
        logger.exception("generate_cover_letter_node failed: %s", exc)
        new_errors.append(f"generate_cover_letter_node error: {exc}")
        return {"errors": new_errors}
