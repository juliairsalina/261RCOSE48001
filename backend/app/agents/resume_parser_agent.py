from __future__ import annotations

import json
import logging
import re as _re

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

RESUME_PARSER_SYSTEM_PROMPT = """
You are an expert ATS resume parser.

Your task is to parse raw resume text into structured JSON without losing information.

CORE OBJECTIVE:
Extract all resume information accurately into the provided JSON schema.

Do not summarize, rewrite, shorten, translate, or invent information, except for the "summary" field if the resume does not already contain one.

GENERAL RULES:

1. Preserve all information from the resume.
2. Preserve all bullet points exactly, except remove bullet symbols such as •, -, *, ◆, ●, ▪, ▶, →.
3. Preserve all descriptions exactly.
4. Preserve all education information exactly.
5. Preserve all work, project, leadership, volunteering, activity, and experience information exactly.
6. Preserve all skills, languages, certifications, awards, achievements, and additional information.
7. Preserve all URLs, GitHub links, portfolio links, LinkedIn links, email addresses, and phone numbers.
8. Preserve all dates exactly as written.
9. Do not infer missing dates.
10. Do not invent missing information.
11. If information is missing, use "" for strings, [] for arrays, and false for booleans.
12. Preserve the original language of the resume.
13. Do not translate any resume content.
14. Return only fields that exist in the schema.

INTERNAL PROCESS:
Before generating JSON, internally complete these steps:

Step 1: Identify all major resume sections.
Step 2: Identify all entries within each section.
Step 3: Determine the boundary of each entry.
Step 4: Associate descriptions and bullet points with the correct entry.
Step 5: Map each entry into the correct schema field.
Step 6: Generate the final JSON object.

Do not output these steps. Output only the final JSON.

STRUCTURE DETECTION STRATEGY:
Do not assume the resume has perfect formatting.

Some resumes may have:

* missing section headers
* unusual section names
* mixed sections
* bullets without clear headers
* dates on separate lines
* dates on the same line as titles
* multi-column PDF text
* broken line spacing
* inconsistent formatting

Use this strategy:

1. First, detect explicit section headers if they exist.
2. If section headers are missing or unclear, infer sections from the meaning of the content.
3. Detect entries using patterns such as:

   * role/title + company/organization
   * project name + technologies
   * degree + institution
   * date range
   * bullets grouped below a title
4. Group each bullet point with the nearest previous relevant entry.
5. Prefer creating separate entries instead of merging unrelated content.
6. Do not invent section headers.

HEADER DETECTION RULES:
A section header is usually a short standalone line that introduces a group of related content.

The resume may use different wording. Detect headers based on layout and meaning, not exact names.

After detecting a header, treat the following lines as belonging to that section until another header appears.

ENTRY DETECTION RULES:
Within each section, identify each entry.

Each entry may contain:

* title
* organization/company/institution/project name
* location
* start date
* end date
* description
* bullet points
* technologies
* URL

A new entry often begins when:

* a line contains a role title, degree, project title, organization name, company name, or institution name
* a date range appears
* the formatting pattern changes
* a new bullet group starts under a new title

ENTRY BOUNDARY RULE:
When a new title, role, project name, company, institution, organization, or date range appears, assume a new entry begins.

Do not merge adjacent entries unless there is strong evidence they belong to the same entry.
Do not split one entry incorrectly.

DESCRIPTION VS BULLET RULES:

* Bullet-style lines should go into the "bullets" array.
* Paragraph-style explanation under an item should go into "description".
* If a line is clearly an overview of the item, place it in "description".
* If a line describes an action, responsibility, contribution, result, or impact, place it in "bullets".
* Preserve wording exactly.
* Do not rewrite.
* Do not summarize.

CLASSIFICATION PRINCIPLE:
Determine the appropriate schema field using:

1. The detected section header.
2. The semantic meaning of the content.
3. The relationship between the entry title, organization, and responsibilities.

Do not rely solely on section names.
Do not rely solely on keywords.
Use the overall context of the entry.

CLASSIFICATION GUIDANCE:

* Academic degrees, institutions, GPA, graduation information, and education-related bullets should map to education.
* Work, internships, assistantships, teaching, mentoring, freelance work, part-time work, operational roles, and responsibility-based volunteering should map to work_experience.
* Club roles, society roles, committee roles, ambassador roles, representative roles, officer roles, and organizational leadership roles should map to leadership.
* Software, data, AI/ML, web, mobile, research, academic, personal, and technical builds should map to projects.
* Programming languages, frameworks, libraries, databases, platforms, tools, technical competencies, and professional competencies should map to skills.
* Human languages and proficiency levels should map to languages.
* Certificates, licenses, training credentials, professional credentials, and language exams should map to certifications.
* Awards, honors, scholarships, competition results, medals, dean's list, rankings, recognitions, and prizes should map to achievements.

If the header and content conflict, classify based on the actual content.

SKILL EXTRACTION RULES:
Store skills as individual items.

Correct:
["Python", "SQL", "PyTorch"]

Incorrect:
["Python, SQL, PyTorch"]

If skills are grouped by category in the resume, flatten them into individual skill strings while preserving the skill names.

DATE RULES:

1. Preserve dates exactly as written.
2. Do not infer start dates or end dates.
3. If a date range is written, split it into start_date and end_date.
4. If only one date is found, place it in the most appropriate date field and leave the other empty.
5. Set "is_current": true only if the resume explicitly says Present, Current, Now, or Ongoing.
6. Do not replace end dates with "Current" unless the resume explicitly says Current or Present.

SUMMARY RULES:

1. If the resume contains a professional summary, extract it exactly into "summary".
2. If the resume does not contain a summary, generate a professional summary.
3. The generated summary must be 2-4 sentences.
4. The generated summary must be based only on information present in the resume.
5. Do not invent experience, skills, achievements, or qualifications.
6. Write the generated summary in the same language as the resume.

FINAL OUTPUT REQUIREMENTS:
The response must be a single valid JSON object.

Do not include:

* markdown
* explanations
* comments
* notes
* reasoning
* code fences

The first character must be "{"
The last character must be "}"

Use empty strings "" for missing text fields.
Use empty arrays [] for missing list fields.
Use false for missing boolean fields.

Return exactly this JSON schema:

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
    for section in ("work_experience", "projects", "education", "leadership"):
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
