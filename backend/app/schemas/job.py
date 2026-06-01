from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class JobRequirements(BaseModel):
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    qualifications: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)
    seniority_level: str = ""
    job_type: str = ""  # full-time, part-time, contract, remote


class JobPostRow(BaseModel):
    id: str
    user_id: Optional[str] = None
    source: Optional[str] = None
    job_url: Optional[str] = None
    company_name: Optional[str] = None
    role_title: Optional[str] = None
    location: Optional[str] = None
    job_description: Optional[str] = None
    extracted_requirements: Optional[dict[str, Any]] = None
    company_background: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None


class JobRecommendation(BaseModel):
    job_post_id: str
    company_name: str
    role_title: str
    location: str
    job_url: str
    match_score: int = Field(ge=0, le=100)
    confidence_label: Literal["high", "medium", "low"]
    match_reasons: list[str] = Field(default_factory=list)
    missing_requirements: list[str] = Field(default_factory=list)


class JobDiscoverRequest(BaseModel):
    user_id: str
    resume_id: str
    location: str = ""
    job_type: str = ""
    keyword: str = ""


class JobDiscoverResponse(BaseModel):
    user_id: str
    resume_id: str
    total_found: int
    recommendations: list[JobRecommendation]
