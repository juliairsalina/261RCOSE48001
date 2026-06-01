from __future__ import annotations

import logging
from typing import Any, Optional

from app.agents.state import AgentState

logger = logging.getLogger(__name__)


async def export_resume_node(state: AgentState) -> AgentState:
    """Placeholder node — actual export is handled by POST /export-resume endpoint."""
    return state


def _build_career_agent_graph():
    """Build and compile the LangGraph StateGraph.

    All langgraph and agent imports are deferred here so the module can be
    imported in environments where langgraph is not installed (unit tests).
    """
    from langgraph.graph import END, START, StateGraph

    from app.agents.ats_evaluator_agent import evaluate_ats_node
    from app.agents.candidate_profile_agent import create_candidate_profile_node
    from app.agents.cover_letter_agent import generate_cover_letter_node
    from app.agents.job_analyzer_agent import analyze_selected_job_node
    from app.agents.job_discovery_agent import discover_jobs_node
    from app.agents.rag_retriever_agent import retrieve_resume_context_node
    from app.agents.resume_parser_agent import parse_resume_node
    from app.agents.rewrite_agent import generate_rewrite_suggestions_node

    builder = StateGraph(AgentState)

    builder.add_node("parse_resume", parse_resume_node)
    builder.add_node("create_candidate_profile", create_candidate_profile_node)
    builder.add_node("discover_jobs", discover_jobs_node)
    builder.add_node("analyze_selected_job", analyze_selected_job_node)
    builder.add_node("retrieve_resume_context", retrieve_resume_context_node)
    builder.add_node("evaluate_ats", evaluate_ats_node)
    builder.add_node("generate_rewrite_suggestions", generate_rewrite_suggestions_node)
    builder.add_node("export_resume", export_resume_node)
    builder.add_node("generate_cover_letter", generate_cover_letter_node)

    builder.add_edge(START, "parse_resume")
    builder.add_edge("parse_resume", "create_candidate_profile")
    builder.add_edge("create_candidate_profile", "discover_jobs")
    # HUMAN PAUSE 1: graph interrupts here; user sets selected_job_post_id
    builder.add_edge("discover_jobs", "analyze_selected_job")
    builder.add_edge("analyze_selected_job", "retrieve_resume_context")
    builder.add_edge("retrieve_resume_context", "evaluate_ats")
    builder.add_edge("evaluate_ats", "generate_rewrite_suggestions")
    # HUMAN PAUSE 2: graph interrupts here; user approves/rejects rewrites
    builder.add_edge("generate_rewrite_suggestions", "export_resume")
    builder.add_edge("export_resume", "generate_cover_letter")
    builder.add_edge("generate_cover_letter", END)

    return builder.compile(
        interrupt_before=["analyze_selected_job", "export_resume"]
    )


# Build at import time if langgraph is available; otherwise None.
career_agent_graph: Optional[Any] = None
try:
    career_agent_graph = _build_career_agent_graph()
except ImportError:
    logger.warning(
        "langgraph is not installed — career_agent_graph is unavailable. "
        "Install requirements to enable the full agent workflow."
    )


# ── Convenience runner functions ───────────────────────────────────────────

async def run_until_job_selection(state: AgentState) -> dict[str, Any]:
    """Run parse_resume → create_candidate_profile → discover_jobs.

    Graph pauses before analyze_selected_job, awaiting user's job selection.
    """
    if career_agent_graph is None:
        raise RuntimeError("langgraph is not installed.")
    result: dict[str, Any] = {}
    async for chunk in career_agent_graph.astream(state):
        result.update(chunk)
    return result


async def run_from_job_selected(state: AgentState) -> dict[str, Any]:
    """Resume after user selects a job.

    Runs analyze_selected_job → … → generate_rewrite_suggestions.
    Pauses before export_resume.
    """
    if career_agent_graph is None:
        raise RuntimeError("langgraph is not installed.")
    result: dict[str, Any] = {}
    async for chunk in career_agent_graph.astream(state):
        result.update(chunk)
    return result


async def run_cover_letter(state: AgentState) -> dict[str, Any]:
    """Run only the cover letter generation node."""
    from app.agents.cover_letter_agent import generate_cover_letter_node
    updated_state = await generate_cover_letter_node(state)
    return dict(updated_state)
