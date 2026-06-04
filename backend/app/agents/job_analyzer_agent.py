from __future__ import annotations

import json
import logging

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

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


async def analyze_selected_job_node(state: AgentState) -> AgentState:
    """LangGraph node: extract structured requirements from the selected job posting.

    Loads the job post from Supabase, calls GPT-4o to extract structured
    requirements, saves extracted_requirements back to job_posts, and updates state.
    """
    selected_job_post_id = state.get("selected_job_post_id")
    new_errors: list[str] = []

    if not selected_job_post_id:
        new_errors.append("analyze_selected_job_node: selected_job_post_id is missing from state")
        return {**state, "errors": new_errors}

    try:
        db = supabase_client.get_client()

        # 1. Load job post from Supabase
        result = (
            db.table("job_posts")
            .select("id, company_name, role_title, location, job_description, job_url")
            .eq("id", selected_job_post_id)
            .single()
            .execute()
        )

        if not result.data:
            new_errors.append(f"analyze_selected_job_node: job post not found for id={selected_job_post_id}")
            return {**state, "errors": new_errors}

        job_data = result.data
        job_description = job_data.get("job_description", "")
        company_name = job_data.get("company_name", "")
        role_title = job_data.get("role_title", "")

        if not job_description:
            new_errors.append("analyze_selected_job_node: job_description is empty")
            return {**state, "errors": new_errors}

        # Skip extraction for general/placeholder evaluations — no real job to parse.
        # The ATS evaluator detects this via is_placeholder and scores resume quality instead.
        if "general resume evaluation" in job_description.lower():
            job_json = {**job_data, "extracted_requirements": {}}
            return {**state, "job_json": job_json, "errors": new_errors}

        # If requirements were already extracted (e.g. a previous analysis run), reuse them.
        if job_data.get("extracted_requirements"):
            job_json = {**job_data}
            return {**state, "job_json": job_json, "errors": new_errors}

        # 2. Call GPT to extract structured requirements
        messages = [
            {"role": "system", "content": JOB_ANALYZER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Company: {company_name}\n"
                    f"Role: {role_title}\n\n"
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

        # 3. Save extracted_requirements to job_posts
        db.table("job_posts").update(
            {"extracted_requirements": extracted_requirements}
        ).eq("id", selected_job_post_id).execute()

        # Compose full job_json for downstream agents
        job_json = {
            **job_data,
            "extracted_requirements": extracted_requirements,
        }

        return {**state, "job_json": job_json, "errors": new_errors}

    except Exception as exc:
        logger.exception("analyze_selected_job_node failed: %s", exc)
        new_errors.append(f"analyze_selected_job_node error: {exc}")
        return {**state, "errors": new_errors}
