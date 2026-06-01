from __future__ import annotations

from typing import Optional

from supabase import Client, create_client

from app.config import settings

_client: Optional[Client] = None


def get_client() -> Client:
    """Return a singleton Supabase client."""
    global _client
    if _client is None:
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
