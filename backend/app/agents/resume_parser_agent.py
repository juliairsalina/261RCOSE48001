from __future__ import annotations

import json
import logging
import re as _re

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

RESUME_PARSER_SYSTEM_PROMPT = """
You are an expert ATS resume parser.

Your task is to extract resume information into structured JSON WITHOUT losing information.

CRITICAL RULES

1. Preserve ALL information from the resume.
2. Preserve ALL bullet points exactly.
3. Preserve ALL project descriptions exactly.
4. Preserve ALL work experience descriptions exactly.
5. Preserve ALL education descriptions exactly.
6. Preserve ALL languages and proficiency levels.
7. Preserve ALL certifications and achievements.
8. Preserve ALL URLs, GitHub links, portfolio links, and LinkedIn links.
9. Preserve ALL dates exactly as written.
10. Do NOT summarize resume content EXCEPT for the "summary" field.
11. Do NOT rewrite.
12. Do NOT shorten.
13. Do NOT infer missing information.
14. Do NOT invent dates.
15. Do NOT replace end dates with "Current" unless the resume explicitly says "Current" or "Present".
16. If information is missing, use empty strings "" or empty arrays [].
17. Return ONLY valid JSON.
18. Every section found in the resume must be represented in the JSON.
19. Leadership refers ONLY to student leadership positions in clubs, societies, committee roles, ambassador roles, club officer positions, volunteer leadership positions, and organizational leadership activities.
20. Achievements refer ONLY to awards, honors, scholarships, competition results, recognitions, distinctions, rankings, prizes, dean's list awards, and notable accomplishments.
21. Certifications refer ONLY to certifications, licenses, examinations, training certificates, and professional credentials.
22. Do NOT place leadership activities into achievements.
23. Do NOT place work experience into achievements.
24. If an item contains a role title, organization, and responsibilities, it should usually be leadership or work_experience, not achievements.
25. Achievements should never consist only of dates.
26. If no achievements are found, return an empty achievements array.
27. Generate a professional summary if the resume does not explicitly contain one.
28. The summary must be 2-4 sentences and based only on information present in the resume.
29. The summary must not invent experience, skills, achievements, or qualifications not found in the resume.
30. Store the generated summary in the "summary" field.
31. Dates must be extracted exactly as written in the resume.
32. Do not infer start dates or end dates from education dates, project dates, or nearby sections.
33. If the exact start date or end date cannot be determined, leave it empty.

Datathon, Hackathon or any competition Classification Rules

- Participation in a datathon, hackathon or any competition should normally be classified as work_experience if the candidate completed technical work, developed a project, conducted research, built a system, or applied skills.
- Winning a datathon or hackathon should be classified as achievements.
- Official certificates earned from training programs, examinations, or professional credentials should be classified as certifications.

CRITICAL SCHEMA RULES

You MUST ONLY use the fields defined in the schema below.

DO NOT create any additional fields.

Forbidden examples:

* status
* highlights
* focus
* focus_areas
* organization
* responsibilities
* context
* outcomes
* results
* repository
* organization_or_course
* dates
* details
* year

Map information into existing schema fields instead.

Examples:

Work experience responsibilities
→ bullets

Work experience summary
→ description

Work experience includes:
- Mentoring programs
- Teaching programs
- Language exchange programs
- Editorial work
- Volunteer work with defined responsibilities
- Research assistantships
- Internships
- Part-time work
- Freelance work
- Datathons
- Hackathons
- Competitions where the candidate completed technical work, projects, research, analysis, development, or implementation tasks
- other experiences where the candidate performed responsibilities or developed skills.

Education highlights
→ description

Education bullet points
→ bullets

Project outcomes
→ bullets

Project results
→ description or bullets

Project repository links
→ url

Language levels
→ proficiency

Leadership responsibilities
→ bullets

Leadership summary
→ description

- Club President
- Committee Member
- Secretary
- Student Ambassador
- Student Representative
- Editor of Student Publication
→ leadership
Mentoring programs, teaching programs, datathons, internships, volunteer work, and operational responsibilities should normally be classified as work_experience unless they are explicitly part of a formal leadership position within an organization.
Any roles that are part of a committee, student organization, club, society, publication board, or leadership structure should be classified as leadership.

Achievement examples:
- Dean's List
- Scholarship Recipient
- Competition Winner
- Best Paper Award
- Top Performer Award
- Gold Medal/ any medal
- Competition Finalist
- Competition Champion
→ achievements

Certification examples:
- AWS Certified Cloud Practitioner
- TOPIK Level 5
- IELTS 7.5
- Google Data Analytics Certificate
→ certifications

Return ONLY the following schema:

{
"name": "",
"email": "",
"phone": "",
"summary": "",

"education": [
{
"institution": "",
"degree": "",
"field_of_study": "",
"start_date": "",
"end_date": "",
"gpa": "",
"description": "",
"bullets": []
}
],

"work_experience": [
{
"company": "",
"title": "",
"location": "",
"start_date": "",
"end_date": "",
"is_current": false,
"description": "",
"bullets": []
}
],

"leadership": [
{
"title": "",
"organization": "",
"start_date": "",
"end_date": "",
"description": "",
"bullets": []
}
],

"projects": [
{
"name": "",
"description": "",
"technologies": [],
"url": "",
"start_date": "",
"end_date": "",
"bullets": []
}
],

"skills": [],

"languages": [
{
"language": "",
"proficiency": ""
}
],

"certifications": [
{
"name": "",
"issuer": "",
"date": "",
"description": ""
}
],

"achievements": [
{
"title": "",
"date": "",
"description": ""
}
]
}
"""


async def _log_agent_run(
    user_id: str,
    application_id: str | None,
    agent_name: str,
    input_json: dict,
    output_json: dict,
    status: str,
    error_message: str | None = None,
) -> None:
    """Insert a record into the agent_runs table."""
    try:
        db = supabase_client.get_client()
        db.table("agent_runs").insert(
            {
                "user_id": user_id,
                "application_id": application_id,
                "agent_name": agent_name,
                "input_json": input_json,
                "output_json": output_json,
                "status": status,
                "error_message": error_message,
            }
        ).execute()
    except Exception as exc:
        logger.warning("Failed to log agent run: %s", exc)


_BULLET_GLYPH_RE = _re.compile(r"^[◆●•▪▫–—‒‐\-\*►▶■→·★✔✓]+\s*")


def _strip_glyphs(text: str) -> str:
    return _BULLET_GLYPH_RE.sub("", text).strip()


def _clean_bullets(parsed: dict) -> dict:
    """Strip PDF bullet glyphs (◆ ● • ► etc.) from bullet string fields."""
    for section in ("work_experience", "projects", "education"):
        for item in parsed.get(section) or []:
            if isinstance(item, dict):
                for key in ("bullets", "responsibilities"):
                    if isinstance(item.get(key), list):
                        item[key] = [_strip_glyphs(b) if isinstance(b, str) else b for b in item[key]]
    return parsed


async def parse_resume_node(state: AgentState) -> AgentState:
    """LangGraph node: parse raw resume text into structured JSON.

    Loads the raw resume text from Supabase, calls GPT-4o to parse it,
    saves the result back to the resumes table, and updates state.
    """
    resume_id = state.get("resume_id")
    user_id = state["user_id"]
    new_errors: list[str] = []

    if not resume_id:
        new_errors.append("parse_resume_node: resume_id is missing from state")
        return {**state, "errors": new_errors}

    try:
        db = supabase_client.get_client()

        # 1. Load raw_text from Supabase
        result = db.table("resumes").select("raw_text").eq("id", resume_id).single().execute()
        raw_text: str = result.data.get("raw_text", "") if result.data else ""

        if not raw_text:
            new_errors.append(f"parse_resume_node: no raw_text found for resume_id={resume_id}")
            return {**state, "errors": new_errors}

        # 2. Call GPT-4o to parse into JSON
        messages = [
            {"role": "system", "content": RESUME_PARSER_SYSTEM_PROMPT},
            {"role": "user", "content": f"Parse this resume:\n\n{raw_text}"},
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        parsed: dict = _clean_bullets(json.loads(raw_response))

        # 3. Save parsed_json back to resumes table
        db.table("resumes").update({"parsed_json": parsed}).eq("id", resume_id).execute()

        # 4. Log agent run
        await _log_agent_run(
            user_id=user_id,
            application_id=state.get("application_id"),
            agent_name="resume_parser",
            input_json={"resume_id": resume_id, "raw_text_length": len(raw_text)},
            output_json={"parsed_keys": list(parsed.keys())},
            status="completed",
        )

        return {**state, "resume_json": parsed, "errors": new_errors}

    except Exception as exc:
        logger.exception("parse_resume_node failed: %s", exc)
        new_errors.append(f"parse_resume_node error: {exc}")
        await _log_agent_run(
            user_id=user_id,
            application_id=state.get("application_id"),
            agent_name="resume_parser",
            input_json={"resume_id": resume_id},
            output_json={},
            status="failed",
            error_message=str(exc),
        )
        return {**state, "errors": new_errors}
