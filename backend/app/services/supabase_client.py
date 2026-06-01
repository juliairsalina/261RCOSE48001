from __future__ import annotations

from typing import Any, Optional

from app.config import settings

# The supabase package is imported lazily inside get_client() so that this
# module can be imported (and patched in tests) without supabase installed.
_client: Optional[Any] = None


def get_client():
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
        from supabase import create_client
        _client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _client


def upload_file(
    bucket: str,
    path: str,
    file_bytes: bytes,
    content_type: str,
) -> str:
    """Upload a file to Supabase Storage and return its public URL."""
    client = get_client()
    client.storage.from_(bucket).upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return get_public_url(bucket, path)


def get_public_url(bucket: str, path: str) -> str:
    """Return the public URL for a file in Supabase Storage."""
    client = get_client()
    response = client.storage.from_(bucket).get_public_url(path)
    return response
