from __future__ import annotations

import json
from typing import Any, Optional

from openai import AsyncOpenAI

from app.config import settings

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    """Return a singleton AsyncOpenAI client."""
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


async def chat_completion(
    messages: list[dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    response_format: Optional[dict[str, Any]] = None,
) -> str:
    """Call OpenAI chat completion and return the content string."""
    client = get_client()
    resolved_model = model or settings.openai_model

    kwargs: dict[str, Any] = {
        "model": resolved_model,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format

    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content
    return content or ""


async def get_embedding(text: str) -> list[float]:
    """Generate an embedding vector for the given text."""
    client = get_client()
    text = text.replace("\n", " ").strip()
    response = await client.embeddings.create(
        model=settings.openai_embedding_model,
        input=text,
    )
    return response.data[0].embedding
