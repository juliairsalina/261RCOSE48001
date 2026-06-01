from __future__ import annotations

from typing import Any, Optional

from app.config import settings

# The openai package is imported lazily inside functions so this module can
# be imported (and patched in tests) without the package installed.
_client: Optional[Any] = None


def get_client():
    """Return a singleton AsyncOpenAI client."""
    global _client
    if _client is None:
        from openai import AsyncOpenAI
        _client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            max_retries=2,        # built-in retry on transient errors
            timeout=60.0,
        )
    return _client


async def chat_completion(
    messages: list[dict[str, str]],
    model: Optional[str] = None,
    temperature: float = 0.2,
    response_format: Optional[dict[str, Any]] = None,
) -> str:
    """Call OpenAI chat completion and return the content string.

    Raises:
        ValueError: If OPENAI_API_KEY is not configured.
        RuntimeError: On authentication failure, rate limit, or API error.
    """
    if not settings.openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. Add it to backend/.env and restart."
        )

    from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError

    client = get_client()
    resolved_model = model or settings.openai_model

    # o1, o3, and gpt-5 family models only support temperature=1 (the default)
    _no_temp_models = ("o1", "o3", "gpt-5")
    supports_temperature = not any(resolved_model.startswith(m) for m in _no_temp_models)

    kwargs: dict[str, Any] = {
        "model": resolved_model,
        "messages": messages,
    }
    if supports_temperature:
        kwargs["temperature"] = temperature
    if response_format is not None:
        kwargs["response_format"] = response_format

    try:
        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""

    except AuthenticationError as exc:
        raise RuntimeError(
            f"OpenAI authentication failed — check your OPENAI_API_KEY. Detail: {exc}"
        ) from exc
    except RateLimitError as exc:
        raise RuntimeError(
            f"OpenAI rate limit exceeded. Reduce request frequency or upgrade your plan. Detail: {exc}"
        ) from exc
    except APIConnectionError as exc:
        raise RuntimeError(
            f"Could not reach OpenAI API. Check your network connection. Detail: {exc}"
        ) from exc
    except APIStatusError as exc:
        raise RuntimeError(
            f"OpenAI API returned an error (status {exc.status_code}). Detail: {exc.message}"
        ) from exc


async def get_embedding(text: str) -> list[float]:
    """Generate an embedding vector for the given text.

    Raises:
        ValueError: If OPENAI_API_KEY is not configured.
        RuntimeError: On API errors.
    """
    if not settings.openai_api_key:
        raise ValueError(
            "OPENAI_API_KEY is not set. Add it to backend/.env and restart."
        )

    from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError

    client = get_client()
    text = text.replace("\n", " ").strip()

    try:
        response = await client.embeddings.create(
            model=settings.openai_embedding_model,
            input=text,
        )
        return response.data[0].embedding

    except AuthenticationError as exc:
        raise RuntimeError(
            f"OpenAI authentication failed — check your OPENAI_API_KEY. Detail: {exc}"
        ) from exc
    except RateLimitError as exc:
        raise RuntimeError(
            f"OpenAI rate limit exceeded. Detail: {exc}"
        ) from exc
    except APIConnectionError as exc:
        raise RuntimeError(
            f"Could not reach OpenAI API. Detail: {exc}"
        ) from exc
    except APIStatusError as exc:
        raise RuntimeError(
            f"OpenAI API error (status {exc.status_code}). Detail: {exc.message}"
        ) from exc


async def ping() -> dict[str, str]:
    """Send a minimal request to verify the API key and connection work.

    Returns a dict with keys 'status' ('ok' or 'error') and 'detail'.
    Safe to call from the health endpoint — never raises.
    """
    if not settings.openai_api_key:
        return {"status": "error", "detail": "OPENAI_API_KEY is not set"}
    try:
        await chat_completion(
            messages=[{"role": "user", "content": "ping"}],
            model=settings.openai_model,
            temperature=0.0,
        )
        return {"status": "ok", "detail": f"Connected (model: {settings.openai_model})"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}
