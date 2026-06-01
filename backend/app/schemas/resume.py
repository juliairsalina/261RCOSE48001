from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class EducationEntry(BaseModel):
    institution: str
    degree: str
    field_of_study: str = ""
    start_date: str = ""
    end_date: str = ""
    gpa: Optional[str] = None
    description: str = ""


class WorkExperienceEntry(BaseModel):
    company: str
    title: str
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    is_current: bool = False
    bullets: list[str] = Field(default_factory=list)
    description: str = ""


class ProjectEntry(BaseModel):
    name: str
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    url: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: list[str] = Field(default_factory=list)


class ResumeJSON(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    education: list[EducationEntry] = Field(default_factory=list)
    work_experience: list[WorkExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    achievements: list[str] = Field(default_factory=list)


class ResumeUploadResponse(BaseModel):
    resume_id: str
    user_id: str
    file_url: str
    file_name: str
    file_type: str
    raw_text_length: int
    parsed_json: ResumeJSON
    chunks_stored: int
    message: str = "Resume uploaded and processed successfully"


class ResumeRow(BaseModel):
    id: str
    user_id: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_type: Optional[str] = None
    raw_text: Optional[str] = None
    parsed_json: Optional[dict[str, Any]] = None
    created_at: Optional[datetime] = None
