from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CandidateProfile(BaseModel):
    target_roles: list[str] = Field(
        default_factory=list,
        description="Job titles the candidate is targeting",
    )
    seniority_level: str = Field(
        default="",
        description="e.g. junior, mid-level, senior, lead, principal",
    )
    core_skills: list[str] = Field(
        default_factory=list,
        description="Core technical and soft skills",
    )
    domain_interests: list[str] = Field(
        default_factory=list,
        description="Industry domains or areas of interest",
    )
    strongest_experiences: list[str] = Field(
        default_factory=list,
        description="Top experiences or achievements worth highlighting",
    )
    preferred_job_keywords: list[str] = Field(
        default_factory=list,
        description="Keywords for job matching",
    )
    search_queries: list[str] = Field(
        default_factory=list,
        description="5-8 optimised job search query strings",
    )


class CandidateProfileResponse(BaseModel):
    profile_id: str
    user_id: str
    resume_id: str
    profile: CandidateProfile
    created_at: Optional[datetime] = None
