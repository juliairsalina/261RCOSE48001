from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.schemas.rewrite import RewriteApprovalRequest
from app.services import supabase_client

logger = logging.getLogger(__name__)
router = APIRouter()


@router.patch("/{suggestion_id}")
async def update_rewrite_suggestion(
    suggestion_id: str,
    request: RewriteApprovalRequest,
) -> dict:
    """Update the status of a rewrite suggestion (approve or reject).

    Args:
        suggestion_id: UUID of the rewrite_suggestion row.
        request: Body containing status: "approved" | "rejected".

    Returns:
        The updated rewrite suggestion row.
    """
    db = supabase_client.get_client()

    try:
        result = (
            db.table("rewrite_suggestions")
            .update({"status": request.status})
            .eq("id", suggestion_id)
            .execute()
        )
    except Exception as exc:
        logger.exception("Failed to update rewrite suggestion: %s", exc)
        raise HTTPException(status_code=500, detail=f"Update failed: {exc}")

    if not result.data:
        raise HTTPException(
            status_code=404,
            detail=f"Rewrite suggestion not found: {suggestion_id}",
        )

    row = result.data[0]
    return {
        "id": row.get("id"),
        "application_id": row.get("application_id"),
        "section": row.get("section"),
        "item_label": row.get("item_label"),
        "original_text": row.get("original_text"),
        "suggested_text": row.get("suggested_text"),
        "reason": row.get("reason"),
        "status": row.get("status"),
        "created_at": row.get("created_at"),
    }
