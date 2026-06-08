from __future__ import annotations

from typing import Sequence

from app.services.openai_client import get_embedding, get_embeddings_batch


async def generate_embedding(text: str) -> list[float]:
    """Generate a single embedding vector for the given text."""
    return await get_embedding(text)


async def generate_embeddings_batch(texts: Sequence[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts in a single API call."""
    if not texts:
        return []
    return await get_embeddings_batch(list(texts))
