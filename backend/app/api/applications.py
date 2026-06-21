from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

from app.agents.ats_evaluator_agent import evaluate_ats_node
from app.agents.cover_letter_agent import generate_cover_letter_node
from app.agents.rag_retriever_agent import retrieve_resume_context_node
from app.agents.rewrite_agent import generate_rewrite_suggestions_node
from app.agents.state import AgentState
from app.schemas.application import ApplicationCreateRequest, ApplicationRow, ApplicationStatus
from app.schemas.ats import ATSResult, ATSRank
from app.schemas.cover_letter import CoverLetterResponse
from app.schemas.rewrite import RewriteSuggestionsResponse, RewriteSuggestion
from app.services import supabase_client
from app.services.docx_exporter import generate_resume_docx

logger = logging.getLogger(__name__)
router = APIRouter()


class GenericUserRequest(BaseModel):
    user_id: str


class CoverLetterRequest(BaseModel):
    user_id: str
    word_limit: int | None = None


class ExportResumeRequest(BaseModel):
    user_id: str
    resume_json: dict | None = None  # current live resume from frontend; overrides DB version


def _build_initial_state(user_id: str, resume_id: str, job_post_id: str, application_id: str) -> AgentState:
    return AgentState(
        user_id=user_id,
        resume_id=resume_id,
        candidate_profile_id=None,
        job_post_ids=[job_post_id],
        selected_job_post_id=job_post_id,
        application_id=application_id,
        resume_json=None,
        candidate_profile=None,
        job_json=None,
        retrieved_context=None,
        company_background=None,
        ats_result=None,
        rewrite_suggestions=None,
        approved_rewrites=None,
        cover_letter=None,
        cover_letter_word_limit=None,
        errors=[],
    )


def _resume_json_to_text(resume_json: dict) -> str:
    """Flatten a resume_json dict into plain text for chunking/embedding."""
    parts: list[str] = []

    def add(label: str, value) -> None:
        if not value:
            return
        if isinstance(value, list):
            value = ", ".join(str(v) for v in value)
        parts.append(f"{label}: {value}")

    add("Name", resume_json.get("name"))
    add("Skills", resume_json.get("skills"))
    add("Languages", resume_json.get("languages"))
    add("Certifications", resume_json.get("certifications"))
    add("Achievements", resume_json.get("achievements"))

    for edu in resume_json.get("education", []) or []:
        parts.append(
            f"Education: {edu.get('degree', '')} {edu.get('field_of_study', '')} "
            f"at {edu.get('institution', '')} {edu.get('description', '')}"
        )

    for exp in resume_json.get("work_experience", []) or []:
        bullets = " ".join(exp.get("bullets", []) or [])
        parts.append(
            f"Experience: {exp.get('title', '')} at {exp.get('company', '')} "
            f"{exp.get('description', '')} {bullets}"
        )

    for proj in resume_json.get("projects", []) or []:
        bullets = " ".join(proj.get("bullets", []) or [])
        techs = ", ".join(proj.get("technologies", []) or [])
        parts.append(f"Project: {proj.get('name', '')} {proj.get('description', '')} {bullets} {techs}")

    if resume_json.get("raw_text"):
        parts.append(str(resume_json["raw_text"]))

    return "\n".join(p for p in parts if p.strip())


async def _reembed_resume_chunks(resume_id: str, user_id: str, resume_json: dict) -> None:
    """Re-chunk and re-embed a resume after live edits (e.g. approved rewrites).

    Without this, RAG retrieval keeps using the embeddings generated at
    initial upload, so reevaluation surfaces stale, contradictory context
    alongside the freshly edited resume_json.
    """
    text = _resume_json_to_text(resume_json)
    if not text.strip():
        return

    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError:
        from langchain.text_splitter import RecursiveCharacterTextSplitter

    from app.services.embedding_service import generate_embeddings_batch
    from app.services.vector_store import replace_resume_chunks

    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    chunks = splitter.split_text(text)
    if not chunks:
        return

    try:
        embeddings = await generate_embeddings_batch(chunks)
        chunks_with_embeddings = [
            {"chunk_text": chunk, "section": "general", "embedding": embedding}
            for chunk, embedding in zip(chunks, embeddings)
        ]
        replace_resume_chunks(resume_id=resume_id, user_id=user_id, chunks_with_embeddings=chunks_with_embeddings)
    except Exception as exc:
        logger.warning("Failed to re-embed resume chunks for %s: %s", resume_id, exc)


def _load_resume_json(db, resume_id: str) -> dict:
    result = db.table("resumes").select("parsed_json").eq("id", resume_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Resume not found: {resume_id}")
    return result.data.get("parsed_json") or {}


def _load_job_json(db, job_post_id: str) -> dict:
    result = (
        db.table("job_posts")
        .select("id, company_name, role_title, location, job_description, job_url, extracted_requirements")
        .eq("id", job_post_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail=f"Job post not found: {job_post_id}")
    return result.data


def _update_application_status(db, application_id: str, status: str) -> None:
    db.table("applications").update({"status": status}).eq("id", application_id).execute()


@router.post("/create", response_model=ApplicationRow)
async def create_application(request: ApplicationCreateRequest) -> ApplicationRow:
    """Create a new application record linking a user, resume, and job post."""
    db = supabase_client.get_client()
    try:
        result = (
            db.table("applications")
            .insert(
                {
                    "user_id": request.user_id,
                    "resume_id": request.resume_id,
                    "job_post_id": request.job_post_id,
                    "status": ApplicationStatus.created.value,
                }
            )
            .execute()
        )
        row = result.data[0]
    except Exception as exc:
        logger.exception("Failed to create application: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to create application: {exc}")

    return ApplicationRow(
        id=row["id"],
        user_id=row["user_id"],
        resume_id=row["resume_id"],
        job_post_id=row["job_post_id"],
        status=ApplicationStatus(row["status"]),
        created_at=row.get("created_at"),
    )


@router.get("/{application_id}", response_model=ApplicationRow)
async def get_application(application_id: str) -> ApplicationRow:
    """Return a single application row."""
    db = supabase_client.get_client()
    try:
        result = (
            db.table("applications")
            .select("id, user_id, resume_id, job_post_id, status, created_at")
            .eq("id", application_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Application not found: {exc}")

    if not result.data:
        raise HTTPException(status_code=404, detail="Application not found.")

    row = result.data
    return ApplicationRow(
        id=row["id"],
        user_id=row["user_id"],
        resume_id=row["resume_id"],
        job_post_id=row["job_post_id"],
        status=ApplicationStatus(row["status"]),
        created_at=row.get("created_at"),
    )


@router.post("/{application_id}/retrieve-context")
async def retrieve_context(application_id: str, request: GenericUserRequest) -> dict:
    """Run RAG retrieval to fetch relevant resume chunks for the selected job.

    Updates application status to rag_completed.
    """
    db = supabase_client.get_client()

    # Load application
    try:
        app_result = (
            db.table("applications")
            .select("id, user_id, resume_id, job_post_id")
            .eq("id", application_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Application not found: {exc}")

    app_row = app_result.data
    resume_id = app_row["resume_id"]
    job_post_id = app_row["job_post_id"]

    resume_json = _load_resume_json(db, resume_id)
    job_json = _load_job_json(db, job_post_id)

    state = _build_initial_state(request.user_id, resume_id, job_post_id, application_id)
    state["resume_json"] = resume_json
    state["job_json"] = job_json

    updated_state = await retrieve_resume_context_node(state)

    if updated_state.get("errors"):
        logger.warning("RAG retrieval errors: %s", updated_state["errors"])

    _update_application_status(db, application_id, ApplicationStatus.rag_completed.value)

    retrieved = updated_state.get("retrieved_context") or []
    return {
        "application_id": application_id,
        "chunks_retrieved": len(retrieved),
        "retrieved_chunks": retrieved,
        "errors": updated_state.get("errors", []),
    }


@router.post("/{application_id}/evaluate", response_model=ATSResult)
async def evaluate_application(application_id: str, request: GenericUserRequest) -> ATSResult:
    """Run ATS evaluation for the application.

    Updates application status to evaluated.
    """
    db = supabase_client.get_client()

    try:
        app_result = (
            db.table("applications")
            .select("id, user_id, resume_id, job_post_id")
            .eq("id", application_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Application not found: {exc}")

    app_row = app_result.data
    resume_id = app_row["resume_id"]
    job_post_id = app_row["job_post_id"]

    resume_json = _load_resume_json(db, resume_id)

    # If parsed_json is empty (failed on a previous upload), fall back to raw_text
    if not resume_json:
        raw = db.table("resumes").select("raw_text").eq("id", resume_id).single().execute()
        raw_text = (raw.data or {}).get("raw_text", "") or ""
        resume_json = {"raw_text": raw_text[:4000], "name": "", "skills": [], "work_experience": [], "projects": []}

    job_json = _load_job_json(db, job_post_id)

    # Load any retrieved context
    ctx_result = (
        db.table("retrieved_contexts")
        .select("retrieved_text")
        .eq("application_id", application_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    retrieved_context: list = []
    if ctx_result.data:
        retrieved_context = ctx_result.data[0].get("retrieved_text") or []

    state = _build_initial_state(request.user_id, resume_id, job_post_id, application_id)
    state["resume_json"] = resume_json
    state["job_json"] = job_json
    state["retrieved_context"] = retrieved_context

    updated_state = await evaluate_ats_node(state)

    if updated_state.get("errors"):
        logger.warning("ATS evaluation errors: %s", updated_state["errors"])

    ats = updated_state.get("ats_result")
    if not ats:
        raise HTTPException(status_code=500, detail="ATS evaluation failed.")

    _update_application_status(db, application_id, ApplicationStatus.evaluated.value)

    return ATSResult(
        score=ats["score"],
        rank=ATSRank(ats["rank"]),
        matched_skills=ats.get("matched_skills", []),
        missing_skills=ats.get("missing_skills", []),
        strengths=ats.get("strengths", []),
        weaknesses=ats.get("weaknesses", []),
        improvement_priority=ats.get("improvement_priority", []),
        evidence=[
            {"claim": e.get("claim", ""), "resume_evidence": e.get("resume_evidence", "")}
            for e in ats.get("evidence", [])
        ],
    )


@router.post("/{application_id}/rewrite-suggestions", response_model=RewriteSuggestionsResponse)
async def get_rewrite_suggestions(application_id: str, request: GenericUserRequest) -> RewriteSuggestionsResponse:
    """Generate rewrite suggestions for the application's resume.

    Updates application status to rewrite_pending.
    """
    db = supabase_client.get_client()

    try:
        app_result = (
            db.table("applications")
            .select("id, user_id, resume_id, job_post_id")
            .eq("id", application_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Application not found: {exc}")

    app_row = app_result.data
    resume_id = app_row["resume_id"]
    job_post_id = app_row["job_post_id"]

    resume_json = _load_resume_json(db, resume_id)
    if not resume_json:
        raw = db.table("resumes").select("raw_text").eq("id", resume_id).single().execute()
        raw_text = (raw.data or {}).get("raw_text", "") or ""
        resume_json = {"raw_text": raw_text[:4000], "name": "", "skills": [], "work_experience": [], "projects": []}

    job_json = _load_job_json(db, job_post_id)

    # Load ATS result
    ats_result_db = (
        db.table("ats_evaluations")
        .select("score, rank, matched_skills, missing_skills, strengths, weaknesses, evidence")
        .eq("application_id", application_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    ats_result: dict = {}
    if ats_result_db.data:
        ats_result = ats_result_db.data[0]

    # Load retrieved context
    ctx_result = (
        db.table("retrieved_contexts")
        .select("retrieved_text")
        .eq("application_id", application_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    retrieved_context: list = []
    if ctx_result.data:
        retrieved_context = ctx_result.data[0].get("retrieved_text") or []

    state = _build_initial_state(request.user_id, resume_id, job_post_id, application_id)
    state["resume_json"] = resume_json
    state["job_json"] = job_json
    state["ats_result"] = ats_result
    state["retrieved_context"] = retrieved_context

    updated_state = await generate_rewrite_suggestions_node(state)

    if updated_state.get("errors"):
        logger.warning("Rewrite suggestion errors: %s", updated_state["errors"])

    # Fetch saved suggestions from DB to include their IDs
    saved = (
        db.table("rewrite_suggestions")
        .select("id, section, item_label, original_text, suggested_text, reason, status")
        .eq("application_id", application_id)
        .order("created_at")
        .execute()
    )
    suggestions = [
        RewriteSuggestion(
            id=row["id"],
            section=row.get("section", ""),
            item_label=row.get("item_label", ""),
            original_text=row.get("original_text", ""),
            suggested_text=row.get("suggested_text", ""),
            reason=row.get("reason", ""),
            status=row.get("status", "pending"),
        )
        for row in (saved.data or [])
    ]

    _update_application_status(db, application_id, ApplicationStatus.rewrite_pending.value)

    return RewriteSuggestionsResponse(
        application_id=application_id,
        suggestions=suggestions,
        total=len(suggestions),
    )


@router.post("/{application_id}/analyze")
async def analyze_application(application_id: str, request: ExportResumeRequest) -> StreamingResponse:
    """Run the full analysis pipeline using LangGraph.

    Graph: analyze_job → retrieve_context → research_company → (evaluate_ats ∥ cover_letter) → rewrites

    Streams Server-Sent Events (SSE) so the frontend can show per-step progress:
      {"step": "[STATUS] <message>"}   — agent activity status (≤10 words)
      {"done": true, "result": {...}}  — final payload
      {"error": "..."}                 — on failure

    Accepts an optional resume_json in the request body. When provided it
    overrides the DB version so re-evaluation reflects approved rewrites.
    """
    from app.agents.graph import analysis_graph
    if analysis_graph is None:
        raise HTTPException(status_code=503, detail="LangGraph analysis graph not available.")

    db = supabase_client.get_client()
    try:
        app_result = (
            db.table("applications")
            .select("id, user_id, resume_id, job_post_id")
            .eq("id", application_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Application not found: {exc}")

    app_row = app_result.data
    resume_id = app_row["resume_id"]
    job_post_id = app_row["job_post_id"]

    # Prefer live resume from frontend (includes approved rewrites) over DB version
    resume_json = request.resume_json or _load_resume_json(db, resume_id)
    if not resume_json:
        raw = db.table("resumes").select("raw_text").eq("id", resume_id).single().execute()
        raw_text = (raw.data or {}).get("raw_text", "") or ""
        resume_json = {"raw_text": raw_text[:4000], "name": "", "skills": [], "work_experience": [], "projects": []}

    # When the frontend sends a live (edited) resume, RAG retrieval must see
    # the same edits — re-embed resume_chunks so it doesn't pull stale,
    # pre-edit context for this reevaluation.
    if request.resume_json:
        await _reembed_resume_chunks(resume_id, request.user_id, resume_json)

    job_json = _load_job_json(db, job_post_id)

    initial_state = _build_initial_state(request.user_id, resume_id, job_post_id, application_id)
    initial_state["resume_json"] = resume_json
    initial_state["job_json"] = job_json

    async def event_stream():
        NODE_STATUS: dict[str, str] = {
            "analyze_job": "[STATUS] Extracting job requirements...",
            "retrieve_context": "[STATUS] Retrieving relevant resume sections...",
            "research_company": "[STATUS] Researching company background...",
            "evaluate_ats": "[STATUS] Evaluating ATS score...",
            "generate_cover_letter": "[STATUS] Writing personalized cover letter...",
            "generate_rewrites": "[STATUS] Generating rewrite suggestions...",
        }

        try:
            yield f"data: {json.dumps({'step': '[STATUS] Starting analysis pipeline...'})}\n\n"

            final_state: dict = dict(initial_state)

            # astream() yields {node_name: node_output} per step — reliable state collection.
            # [STATUS] messages are emitted per node using the same node name keys.
            async for chunk in analysis_graph.astream(initial_state):
                for node_name, node_output in chunk.items():
                    if node_name == "__end__":
                        continue
                    if isinstance(node_output, dict):
                        final_state.update(node_output)
                    status = NODE_STATUS.get(node_name)
                    if status:
                        yield f"data: {json.dumps({'step': status})}\n\n"

            ats = final_state.get("ats_result") or {}

            saved = (
                db.table("rewrite_suggestions")
                .select("id, section, item_label, original_text, suggested_text, reason, status")
                .eq("application_id", application_id)
                .order("created_at")
                .execute()
            )
            suggestions = saved.data or []

            cover_letter = final_state.get("cover_letter") or ""
            _update_application_status(db, application_id, ApplicationStatus.rewrite_pending.value)

            result = {
                "application_id": application_id,
                "ats": {
                    "score": ats.get("score", 0),
                    "rank": ats.get("rank", ""),
                    "matched_skills": ats.get("matched_skills", []),
                    "missing_skills": ats.get("missing_skills", []),
                    "strengths": ats.get("strengths", []),
                    "weaknesses": ats.get("weaknesses", []),
                    "improvement_priority": ats.get("improvement_priority", []),
                    "evidence": [
                        {"claim": e.get("claim", ""), "resume_evidence": e.get("resume_evidence", "")}
                        for e in ats.get("evidence", [])
                    ],
                },
                "suggestions": suggestions,
                "cover_letter": cover_letter,
                "errors": final_state.get("errors", []),
            }
            yield f"data: {json.dumps({'done': True, 'result': result})}\n\n"

        except Exception as exc:
            logger.exception("Analysis pipeline failed: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{application_id}/export-resume")
async def export_resume(application_id: str, request: ExportResumeRequest) -> dict:
    """Export the resume as a DOCX file with approved rewrites applied.

    Uses resume_json from the request body when provided (matches the live
    frontend display). Falls back to the DB version if not supplied.
    """
    db = supabase_client.get_client()

    try:
        app_result = (
            db.table("applications")
            .select("id, user_id, resume_id")
            .eq("id", application_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Application not found: {exc}")

    app_row = app_result.data
    resume_id = app_row["resume_id"]

    # Prefer the live resume sent by the frontend over the DB version
    resume_json = request.resume_json or _load_resume_json(db, resume_id)

    # Load approved rewrites
    rewrites_result = (
        db.table("rewrite_suggestions")
        .select("section, item_label, original_text, suggested_text, reason")
        .eq("application_id", application_id)
        .eq("status", "approved")
        .execute()
    )
    approved_rewrites: list[dict] = rewrites_result.data or []

    # Generate DOCX
    try:
        docx_bytes = generate_resume_docx(
            resume_json=resume_json,
            approved_rewrites=approved_rewrites,
        )
    except Exception as exc:
        logger.exception("Failed to generate DOCX: %s", exc)
        raise HTTPException(status_code=500, detail=f"DOCX generation failed: {exc}")

    _update_application_status(db, application_id, ApplicationStatus.resume_exported.value)

    # Stream the file directly — avoids Supabase Storage CORS/auth issues
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename=resume.docx"},
    )


@router.post("/{application_id}/cover-letter", response_model=CoverLetterResponse)
async def generate_cover_letter_endpoint(
    application_id: str, request: CoverLetterRequest
) -> CoverLetterResponse:
    """Generate a personalised cover letter for the application.

    Updates application status to cover_letter_generated.
    """
    db = supabase_client.get_client()

    try:
        app_result = (
            db.table("applications")
            .select("id, user_id, resume_id, job_post_id")
            .eq("id", application_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail=f"Application not found: {exc}")

    app_row = app_result.data
    resume_id = app_row["resume_id"]
    job_post_id = app_row["job_post_id"]

    resume_json = _load_resume_json(db, resume_id)
    if not resume_json:
        raw = db.table("resumes").select("raw_text").eq("id", resume_id).single().execute()
        raw_text = (raw.data or {}).get("raw_text", "") or ""
        resume_json = {"raw_text": raw_text[:4000], "name": "", "skills": [], "work_experience": [], "projects": []}

    job_json = _load_job_json(db, job_post_id)

    # Load retrieved context
    ctx_result = (
        db.table("retrieved_contexts")
        .select("retrieved_text")
        .eq("application_id", application_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    retrieved_context: list = []
    if ctx_result.data:
        retrieved_context = ctx_result.data[0].get("retrieved_text") or []

    state = _build_initial_state(request.user_id, resume_id, job_post_id, application_id)
    state["resume_json"] = resume_json
    state["job_json"] = job_json
    state["retrieved_context"] = retrieved_context
    state["cover_letter_word_limit"] = request.word_limit

    updated_state = await generate_cover_letter_node(state)

    errors = updated_state.get("errors") or []
    if errors:
        logger.warning("Cover letter errors: %s", errors)

    cover_letter_text = updated_state.get("cover_letter", "")
    if not cover_letter_text:
        detail = "; ".join(errors) if errors else "Cover letter generation failed."
        raise HTTPException(status_code=500, detail=detail)

    _update_application_status(db, application_id, ApplicationStatus.cover_letter_generated.value)

    word_count = len(cover_letter_text.split())
    return CoverLetterResponse(
        application_id=application_id,
        content=cover_letter_text,
        word_count=word_count,
    )
