from __future__ import annotations

import json
import logging
import uuid

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
        errors=[],
    )


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
        .select("id, section, original_text, suggested_text, reason, status")
        .eq("application_id", application_id)
        .order("created_at")
        .execute()
    )
    suggestions = [
        RewriteSuggestion(
            id=row["id"],
            section=row.get("section", ""),
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
async def analyze_application(application_id: str, request: GenericUserRequest) -> StreamingResponse:
    """Run the full analysis pipeline using LangGraph.

    Graph: retrieve_context → research_company → (evaluate_ats ∥ cover_letter) → rewrites

    Streams Server-Sent Events (SSE) so the frontend can show per-step progress:
      {"step": "[STATUS] <message>"}   — agent activity status (≤10 words)
      {"done": true, "result": {...}}  — final payload
      {"error": "..."}                 — on failure
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

    resume_json = _load_resume_json(db, resume_id)
    if not resume_json:
        raw = db.table("resumes").select("raw_text").eq("id", resume_id).single().execute()
        raw_text = (raw.data or {}).get("raw_text", "") or ""
        resume_json = {"raw_text": raw_text[:4000], "name": "", "skills": [], "work_experience": [], "projects": []}

    job_json = _load_job_json(db, job_post_id)

    initial_state = _build_initial_state(request.user_id, resume_id, job_post_id, application_id)
    initial_state["resume_json"] = resume_json
    initial_state["job_json"] = job_json

    async def event_stream():
        NODE_STATUS: dict[str, str] = {
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
                .select("id, section, original_text, suggested_text, reason, status")
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
        .select("section, original_text, suggested_text, reason")
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
    application_id: str, request: GenericUserRequest
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

    updated_state = await generate_cover_letter_node(state)

    if updated_state.get("errors"):
        logger.warning("Cover letter errors: %s", updated_state["errors"])

    cover_letter_text = updated_state.get("cover_letter", "")
    if not cover_letter_text:
        raise HTTPException(status_code=500, detail="Cover letter generation failed.")

    _update_application_status(db, application_id, ApplicationStatus.cover_letter_generated.value)

    word_count = len(cover_letter_text.split())
    return CoverLetterResponse(
        application_id=application_id,
        content=cover_letter_text,
        word_count=word_count,
    )
