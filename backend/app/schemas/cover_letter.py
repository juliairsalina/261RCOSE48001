from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CoverLetterResponse(BaseModel):
    application_id: str
    content: str
    word_count: Optional[int] = None
    created_at: Optional[datetime] = None
