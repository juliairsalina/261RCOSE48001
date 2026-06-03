from __future__ import annotations

import json
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException, UploadFile

from app.config import settings
from app.schemas.candidate import CandidateProfileResponse
from app.schemas.resume import ResumeJSON, ResumeUploadResponse
from app.services import openai_client, supabase_client
from app.services.document_parser import extract_text
from app.services.embedding_service import generate_embeddings_batch
from app.services.vector_store import store_resume_chunks
from app.agents.resume_parser_agent import RESUME_PARSER_SYSTEM_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_EXTENSIONS = {"pdf", "docx"}

CANDIDATE_PROFILE_SYSTEM_PROMPT = """You are a career advisor. Analyze the candidate's parsed resume JSON and generate a structured candidate profile.

Return a valid JSON object with exactly these keys:
- target_roles: list of 3-5 job titles the candidate is most suited for
- seniority_level: one of "junior", "mid-level", "senior", "lead", "principal", "executive"
- core_skills: list of top 10-15 technical and soft skills
- domain_interests: list of 3-5 industry domains or interest areas inferred from experience
- strongest_experiences: list of 3-5 strongest experience highlights (short phrases)
- preferred_job_keywords: list of 10-15 keywords for job searching

Return only valid JSON. Do not add markdown or extra text."""


def _get_file_extension(filename: str) -> str:
    parts = filename.rsplit(".", 1)
    return parts[-1].lower() if len(parts) == 2 else ""


@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(
    file: UploadFile,
    user_id: Annotated[str, Form()],
) -> ResumeUploadResponse:
    """Upload a resume PDF or DOCX, extract text, parse it, and store embeddings.

    Steps:
    1. Validate file type and size.
    2. Extract text using document_parser.
    3. Upload original file to Supabase Storage.
    4. Insert resume row in DB.
    5. Parse resume JSON via GPT-4o.
    6. Split text into chunks and generate embeddings.
    7. Store chunks in resume_chunks table.
    """
    # ── Validate file ──────────────────────────────────────────────────────
    filename = file.filename or "resume"
    ext = _get_file_extension(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Only PDF and DOCX are allowed.",
        )

    file_bytes = await file.read()
    max_bytes = settings.max_file_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size is {settings.max_file_size_mb} MB.",
        )

    content_type = file.content_type or (
        "application/pdf" if ext == "pdf"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )

    # ── Extract text ───────────────────────────────────────────────────────
    try:
        raw_text = extract_text(file_bytes, ext)
    except Exception as exc:
        logger.exception("Failed to extract text from file: %s", exc)
        raise HTTPException(status_code=422, detail=f"Could not extract text from file: {exc}")

    if not raw_text.strip():
        raise HTTPException(status_code=422, detail="Extracted text is empty. The file may be scanned or corrupt.")

    # ── Ensure user row exists (satisfies FK) ─────────────────────────────
    supabase_client.ensure_user(user_id)

    # ── Upload file to Supabase Storage (non-fatal) ───────────────────────
    storage_path = f"{user_id}/{uuid.uuid4()}/{filename}"
    file_url = ""
    try:
        file_url = supabase_client.upload_file(
            bucket=settings.supabase_bucket,
            path=storage_path,
            file_bytes=file_bytes,
            content_type=content_type,
        )
    except Exception as exc:
        logger.warning("File storage upload failed (non-fatal): %s", exc)

    # ── Insert resume row ──────────────────────────────────────────────────
    db = supabase_client.get_client()
    try:
        resume_insert = (
            db.table("resumes")
            .insert(
                {
                    "user_id": user_id,
                    "file_url": file_url,
                    "file_name": filename,
                    "file_type": ext,
                    "raw_text": raw_text,
                }
            )
            .execute()
        )
        resume_id: str = resume_insert.data[0]["id"]
    except Exception as exc:
        logger.exception("Failed to insert resume row: %s", exc)
        raise HTTPException(status_code=500, detail=f"Database insert failed: {exc}")

    # ── Parse resume JSON via GPT-4o ───────────────────────────────────────
    parse_status = "ok"
    try:
        messages = [
            {"role": "system", "content": RESUME_PARSER_SYSTEM_PROMPT},
            {"role": "user", "content": f"Parse this resume:\n\n{raw_text}"},
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        parsed_dict: dict = json.loads(raw_response)
        parsed_json = ResumeJSON(**parsed_dict)
    except Exception as exc:
        logger.exception("Failed to parse resume JSON: %s", exc)
        parse_status = "failed"
        parsed_dict = {}
        parsed_json = ResumeJSON()

    # Save parsed_json back to DB
    try:
        db.table("resumes").update({"parsed_json": parsed_dict}).eq("id", resume_id).execute()
    except Exception as exc:
        logger.warning("Failed to save parsed_json: %s", exc)

    # ── Chunk and embed ────────────────────────────────────────────────────
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    chunks = splitter.split_text(raw_text)

    chunks_stored = 0
    chunks_ok = True
    if chunks:
        try:
            embeddings = await generate_embeddings_batch(chunks)
            chunks_with_embeddings = [
                {
                    "chunk_text": chunk,
                    "section": "general",
                    "embedding": embedding,
                }
                for chunk, embedding in zip(chunks, embeddings)
            ]
            store_resume_chunks(
                resume_id=resume_id,
                user_id=user_id,
                chunks_with_embeddings=chunks_with_embeddings,
            )
            chunks_stored = len(chunks_with_embeddings)
        except Exception as exc:
            logger.warning("Failed to store resume chunks: %s", exc)
            chunks_ok = False

    return ResumeUploadResponse(
        resume_id=resume_id,
        user_id=user_id,
        file_url=file_url,
        file_name=filename,
        file_type=ext,
        raw_text_length=len(raw_text),
        parsed_json=parsed_json,
        chunks_stored=chunks_stored,
        parse_status=parse_status,
        chunks_ok=chunks_ok,
    )


@router.post("/{resume_id}/candidate-profile", response_model=CandidateProfileResponse)
async def create_candidate_profile(
    resume_id: str,
    user_id: Annotated[str, Form()],
) -> CandidateProfileResponse:
    """Generate a candidate profile from a previously uploaded resume.

    Loads parsed_json from the resume row, calls GPT-4o to generate a
    structured profile with search queries, and saves to candidate_profiles.
    """
    db = supabase_client.get_client()

    # Load resume
    try:
        result = (
            db.table("resumes")
            .select("id, parsed_json, user_id")
            .eq("id", resume_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Resume not found: {exc}")

    if not result.data:
        raise HTTPException(status_code=404, detail="Resume not found.")

    parsed_json: dict = result.data.get("parsed_json") or {}
    if not parsed_json:
        raise HTTPException(
            status_code=422,
            detail="Resume has not been parsed yet. Upload the resume first.",
        )

    # Call GPT to generate profile
    try:
        messages = [
            {"role": "system", "content": CANDIDATE_PROFILE_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Generate a candidate profile from this resume:\n\n{json.dumps(parsed_json, ensure_ascii=False)}",
            },
        ]
        raw_response = await openai_client.chat_completion(
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        profile: dict = json.loads(raw_response)
    except Exception as exc:
        logger.exception("Failed to generate candidate profile: %s", exc)
        raise HTTPException(status_code=500, detail=f"Profile generation failed: {exc}")

    # Save to candidate_profiles
    try:
        insert_result = (
            db.table("candidate_profiles")
            .insert(
                {
                    "user_id": user_id,
                    "resume_id": resume_id,
                    "profile_json": profile,
                }
            )
            .execute()
        )
        profile_id: str = insert_result.data[0]["id"] if insert_result.data else ""
        created_at = insert_result.data[0].get("created_at") if insert_result.data else None
    except Exception as exc:
        logger.exception("Failed to save candidate profile: %s", exc)
        raise HTTPException(status_code=500, detail=f"Database insert failed: {exc}")

    from app.schemas.candidate import CandidateProfile
    return CandidateProfileResponse(
        profile_id=profile_id,
        user_id=user_id,
        resume_id=resume_id,
        profile=CandidateProfile(**profile),
        created_at=created_at,
    )
