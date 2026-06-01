from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, Field


class ATSRank(str, Enum):
    high = "상"
    medium = "중"
    low = "하"


class ATSEvidence(BaseModel):
    claim: str
    resume_evidence: str


class ATSResult(BaseModel):
    score: int = Field(ge=0, le=100, description="Overall ATS match score 0-100")
    rank: ATSRank
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    improvement_priority: list[str] = Field(
        default_factory=list,
        description="Ordered list of areas to improve for better match",
    )
    evidence: list[ATSEvidence] = Field(default_factory=list)
