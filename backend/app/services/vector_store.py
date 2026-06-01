from __future__ import annotations

# Run this in Supabase SQL editor to create the match function:
# CREATE OR REPLACE FUNCTION match_resume_chunks(
#   query_embedding vector(1536),
#   resume_id_filter uuid,
#   match_count int
# )
# RETURNS TABLE (
#   id uuid, chunk_text text, section text, similarity float
# )
# LANGUAGE sql STABLE
# AS $$
#   SELECT id, chunk_text, section,
#          1 - (embedding <=> query_embedding) AS similarity
#   FROM resume_chunks
#   WHERE resume_id = resume_id_filter
#   ORDER BY embedding <=> query_embedding
#   LIMIT match_count;
# $$;

from typing import Any


def store_resume_chunks(
    resume_id: str,
    user_id: str,
    chunks_with_embeddings: list[dict[str, Any]],
) -> None:
    """Insert resume chunks with embeddings into the resume_chunks table."""
    from app.services.supabase_client import get_client
    client = get_client()
    rows = [
        {
            "resume_id": resume_id,
            "user_id": user_id,
            "chunk_text": chunk["chunk_text"],
            "section": chunk.get("section", "general"),
            "embedding": chunk["embedding"],
        }
        for chunk in chunks_with_embeddings
    ]
    if rows:
        client.table("resume_chunks").insert(rows).execute()


def retrieve_similar_chunks(
    resume_id: str,
    query_embedding: list[float],
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Retrieve the most similar resume chunks via pgvector cosine distance.

    Calls the Supabase RPC function `match_resume_chunks`. See the SQL
    comment at the top of this file for the function definition.

    Returns:
        List of dicts with keys: id, chunk_text, section, similarity.
    """
    from app.services.supabase_client import get_client
    client = get_client()
    response = client.rpc(
        "match_resume_chunks",
        {
            "query_embedding": query_embedding,
            "resume_id_filter": resume_id,
            "match_count": top_k,
        },
    ).execute()
    return response.data or []
