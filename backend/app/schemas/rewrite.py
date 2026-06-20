from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class RewriteSuggestion(BaseModel):
    id: str = Field(default="", description="DB row ID for PATCH operations")
    section: str = Field(description="Resume section being rewritten")
    item_label: str = Field(default="", description="Identifies which resume entry this belongs to")
    original_text: str = Field(description="Original text from the resume")
    suggested_text: str = Field(description="Improved text suggestion")
    reason: str = Field(description="Explanation of why this improvement helps")
    status: str = Field(default="pending", description="pending | approved | rejected")


class RewriteSuggestionsResponse(BaseModel):
    application_id: str
    suggestions: list[RewriteSuggestion]
    total: int


class RewriteApprovalRequest(BaseModel):
    status: Literal["approved", "rejected"]
