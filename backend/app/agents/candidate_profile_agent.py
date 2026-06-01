from __future__ import annotations

import json
import logging

from app.agents.state import AgentState
from app.services import openai_client, supabase_client

logger = logging.getLogger(__name__)

CANDIDATE_PROFILE_SYSTEM_PROMPT = """You are a career advisor. Analyze the candidate's parsed resume JSON and generate a structured candidate profile.

Return a valid JSON object with exactly these keys:
- target_roles: list of 3-5 job titles the candidate is most suited for
- seniority_level: one of "junior", "mid-level", "senior", "lead", "principal", "executive"
- core_skills: list of top 10-15 technical and soft skills
- domain_interests: list of 3-5 industry domains or interest areas inferred from experience
- strongest_experiences: list of 3-5 strongest experience highlights (short phrases)
- preferred_job_keywords: list of 10-15 keywords for job searching
- search_queries: list of 5-8 optimised job search query strings ready to use in a job board

Return only valid JSON. Do not add markdown or extra text."""


async def create_candidate_profile_node(state: AgentState) -> AgentState:
    """LangGraph node: generate a candidate profile from the parsed resume.

    Uses GPT-4o to produce a structured profile and search queries, then saves
    the result to the candidate_profiles table.
    """
    resume_json = state.get("resume_json")
    user_id = state["user_id"]
    resume_id = state.get("resume_id")
    errors: list[str] = list(state.get("errors", []))

    if not resume_json:
        errors.append("create_candidate_profile_node: resume_json is missing from state")
        return {**state, "errors": errors}

    try:
        # 1. Call GPT-4o to generate candidate profile
        messages = [
            {"role": "system", "content": CANDIDATE_PROFILE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Generate a candidate profile from this resume:\n\n{json.dumps(resume_json, ensure_ascii=False)}",
            },
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        profile: dict = json.loads(raw_response)
        search_queries: list[str] = profile.get("search_queries", [])

        # 2. Save to candidate_profiles table
        db = supabase_client.get_client()
        result = (
            db.table("candidate_profiles")
            .insert(
                {
                    "user_id": user_id,
                    "resume_id": resume_id,
                    "profile_json": profile,
                    "search_queries": search_queries,
                }
            )
            .execute()
        )
        profile_id: str = result.data[0]["id"] if result.data else ""

        return {
            **state,
            "candidate_profile": profile,
            "candidate_profile_id": profile_id,
            "errors": errors,
        }

    except Exception as exc:
        logger.exception("create_candidate_profile_node failed: %s", exc)
        errors.append(f"create_candidate_profile_node error: {exc}")
        return {**state, "errors": errors}
