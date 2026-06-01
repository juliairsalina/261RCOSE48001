from __future__ import annotations

import asyncio
from typing import Sequence

from app.services.openai_client import get_embedding

# Cap concurrent embedding requests to avoid OpenAI rate-limit errors on
# large batches (a resume split into 20+ chunks would otherwise fire all
# requests simultaneously).
_EMBEDDING_CONCURRENCY = 10


async def generate_embedding(text: str) -> list[float]:
    """Generate a single embedding vector for the given text."""
    return await get_embedding(text)


async def generate_embeddings_batch(texts: Sequence[str]) -> list[list[float]]:
    """Generate embeddings for a list of texts with concurrency control."""
    if not texts:
        return []

    semaphore = asyncio.Semaphore(_EMBEDDING_CONCURRENCY)

    async def _embed(text: str) -> list[float]:
        async with semaphore:
            return await get_embedding(text)

    return list(await asyncio.gather(*(_embed(t) for t in texts)))
