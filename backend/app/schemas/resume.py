from __future__ import annotations

from datetime import datetime
from typing import Any, Optional, Union
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


def _coerce_str(v: Any) -> str:
    """Coerce list→joined string, anything else→str."""
    if isinstance(v, list):
        return " ".join(str(x) for x in v)
    return str(v) if v is not None else ""


class EducationEntry(BaseModel):
    model_config = {"extra": "allow"}
    institution: str = ""
    degree: str = ""
    field_of_study: str = ""
    start_date: str = ""
    end_date: str = ""
    gpa: Optional[str] = None
    description: str = ""

    @field_validator("description", "institution", "degree", "field_of_study", mode="before")
    @classmethod
    def coerce_str_fields(cls, v: Any) -> str:
        return _coerce_str(v)


class WorkExperienceEntry(BaseModel):
    model_config = {"extra": "allow"}
    company: str = ""
    title: str = ""
    location: str = ""
    start_date: str = ""
    end_date: str = ""
    is_current: bool = False
    bullets: list[str] = Field(default_factory=list)
    description: str = ""

    @field_validator("description", "company", "title", "location", mode="before")
    @classmethod
    def coerce_str_fields(cls, v: Any) -> str:
        return _coerce_str(v)

    @field_validator("bullets", mode="before")
    @classmethod
    def coerce_bullets(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [str(x) for x in v]


class ProjectEntry(BaseModel):
    model_config = {"extra": "allow"}
    name: str = ""
    description: str = ""
    technologies: list[str] = Field(default_factory=list)
    url: str = ""
    start_date: str = ""
    end_date: str = ""
    bullets: list[str] = Field(default_factory=list)

    @field_validator("description", "name", "url", mode="before")
    @classmethod
    def coerce_str_fields(cls, v: Any) -> str:
        return _coerce_str(v)

    @field_validator("bullets", "technologies", mode="before")
    @classmethod
    def coerce_list_fields(cls, v: Any) -> list[str]:
        if not isinstance(v, list):
            return []
        return [str(x) for x in v]


class ResumeJSON(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    email: str = ""
    phone: str = ""
    education: list[EducationEntry] = Field(default_factory=list)
    work_experience: list[WorkExperienceEntry] = Field(default_factory=list)
    projects: list[ProjectEntry] = Field(default_factory=list)
    skills: Any = Field(default_factory=list)
    languages: Any = Field(default_factory=list)
    certifications: Any = Field(default_factory=list)
    achievements: Any = Field(default_factory=list)

    @field_validator("phone", mode="before")
    @classmethod
    def coerce_phone(cls, v: Any) -> str:
        if isinstance(v, list):
            return ", ".join(str(x) for x in v)
        return str(v) if v is not None else ""


class ResumeUploadResponse(BaseModel):
    resume_id: str
    user_id: str
    file_url: str
    file_name: str
    file_type: str
    raw_text_length: int
    parsed_json: ResumeJSON
    chunks_stored: int
    parse_status: str = "ok"   # "ok" | "failed"
    chunks_ok: bool = True
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
