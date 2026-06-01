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

from app.services.supabase_client import get_client


def store_resume_chunks(
    resume_id: str,
    user_id: str,
    chunks_with_embeddings: list[dict[str, Any]],
) -> None:
    """Insert resume chunks with embeddings into the resume_chunks table.

    Args:
        resume_id: UUID of the resume.
        user_id: UUID of the user.
        chunks_with_embeddings: List of dicts with keys:
            - chunk_text: str
            - section: str (optional)
            - embedding: list[float]
    """
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
    """Retrieve the most similar resume chunks for a given query embedding.

    Calls the Supabase RPC function `match_resume_chunks` which uses
    pgvector cosine distance to rank chunks. See the SQL comment at the
    top of this file for the function definition.

    Args:
        resume_id: UUID of the resume to search within.
        query_embedding: The query vector (1536 dimensions).
        top_k: Number of chunks to return.

    Returns:
        List of dicts with keys: id, chunk_text, section, similarity.
    """
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
