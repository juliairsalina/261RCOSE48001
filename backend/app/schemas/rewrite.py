from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RewriteSuggestion(BaseModel):
    section: str = Field(description="Resume section being rewritten")
    original_text: str = Field(description="Original text from the resume")
    suggested_text: str = Field(description="Improved text suggestion")
    reason: str = Field(description="Explanation of why this improvement helps")


class RewriteSuggestionsResponse(BaseModel):
    application_id: str
    suggestions: list[RewriteSuggestion]
    total: int


class RewriteApprovalRequest(BaseModel):
    status: Literal["approved", "rejected"]
