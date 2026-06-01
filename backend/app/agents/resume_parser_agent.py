from __future__ import annotations

import json
import logging
from datetime import datetime

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

RESUME_PARSER_SYSTEM_PROMPT = """You are a resume parser. Extract the candidate's information from the raw resume text and return a valid JSON object with these exact keys:
name, email, phone, education, work_experience, projects, skills, languages, certifications, achievements.
Return only valid JSON. Do not add markdown or extra text."""


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


async def parse_resume_node(state: AgentState) -> AgentState:
    """LangGraph node: parse raw resume text into structured JSON.

    Loads the raw resume text from Supabase, calls GPT-4o to parse it,
    saves the result back to the resumes table, and updates state.
    """
    resume_id = state.get("resume_id")
    user_id = state["user_id"]
    errors: list[str] = list(state.get("errors", []))

    if not resume_id:
        errors.append("parse_resume_node: resume_id is missing from state")
        return {**state, "errors": errors}

    try:
        db = supabase_client.get_client()

        # 1. Load raw_text from Supabase
        result = db.table("resumes").select("raw_text").eq("id", resume_id).single().execute()
        raw_text: str = result.data.get("raw_text", "") if result.data else ""

        if not raw_text:
            errors.append(f"parse_resume_node: no raw_text found for resume_id={resume_id}")
            return {**state, "errors": errors}

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
        parsed: dict = json.loads(raw_response)

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

        return {**state, "resume_json": parsed, "errors": errors}

    except Exception as exc:
        logger.exception("parse_resume_node failed: %s", exc)
        errors.append(f"parse_resume_node error: {exc}")
        await _log_agent_run(
            user_id=user_id,
            application_id=state.get("application_id"),
            agent_name="resume_parser",
            input_json={"resume_id": resume_id},
            output_json={},
            status="failed",
            error_message=str(exc),
        )
        return {**state, "errors": errors}
