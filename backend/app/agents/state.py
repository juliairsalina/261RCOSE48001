from __future__ import annotations

import operator
from typing import Annotated, Optional

from typing_extensions import TypedDict


class AgentState(TypedDict):
    user_id: str
    resume_id: Optional[str]
    candidate_profile_id: Optional[str]
    job_post_ids: list[str]
    selected_job_post_id: Optional[str]
    application_id: Optional[str]
    resume_json: Optional[dict]
    candidate_profile: Optional[dict]
    job_json: Optional[dict]
    retrieved_context: Optional[list]
    company_background: Optional[dict]
    ats_result: Optional[dict]
    rewrite_suggestions: Optional[list]
    approved_rewrites: Optional[list]
    cover_letter: Optional[str]
    # Annotated reducer: parallel branches append their own errors; LangGraph concatenates them
    errors: Annotated[list[str], operator.add]
