from __future__ import annotations

import asyncio

from app.services.openai_client import get_embedding


async def generate_embedding(text: str) -> list[float]:
    """Generate a single embedding vector for the given text."""
    return await get_embedding(text)


async def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts concurrently.

    Uses asyncio.gather for parallel requests. If the batch is large,
    consider chunking to stay within API rate limits.
    """
    if not texts:
        return []
    tasks = [get_embedding(text) for text in texts]
    results = await asyncio.gather(*tasks)
    return list(results)
