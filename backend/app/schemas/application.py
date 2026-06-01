from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ApplicationStatus(str, Enum):
    created = "created"
    resume_parsed = "resume_parsed"
    candidate_profile_created = "candidate_profile_created"
    jobs_discovered = "jobs_discovered"
    job_selected = "job_selected"
    job_analyzed = "job_analyzed"
    rag_completed = "rag_completed"
    evaluated = "evaluated"
    rewrite_pending = "rewrite_pending"
    rewrite_approved = "rewrite_approved"
    resume_exported = "resume_exported"
    cover_letter_generated = "cover_letter_generated"
    completed = "completed"


class ApplicationCreateRequest(BaseModel):
    user_id: str
    resume_id: str
    job_post_id: str


class ApplicationRow(BaseModel):
    id: str
    user_id: str
    resume_id: str
    job_post_id: str
    status: ApplicationStatus = ApplicationStatus.created
    created_at: Optional[datetime] = None
