from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.cover_letter import CoverLetterResponse
from app.services import supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{application_id}", response_model=CoverLetterResponse)
async def get_cover_letter(application_id: str) -> CoverLetterResponse:
    """Return the generated cover letter for an application.

    Args:
        application_id: UUID of the application.

    Returns:
        CoverLetterResponse with content and metadata.
    """
    db = supabase_client.get_client()

    try:
        result = (
            db.table("cover_letters")
            .select("application_id, content, created_at")
            .eq("application_id", application_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to fetch cover letter: %s", exc)
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail=f"No cover letter found for application: {application_id}",
        )

    row = result.data[0]
    content = row.get("content", "")
    word_count = len(content.split()) if content else 0

    return CoverLetterResponse(
        application_id=row.get("application_id", application_id),
        content=content,
        word_count=word_count,
        created_at=row.get("created_at"),
    )
