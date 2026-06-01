from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import END, START, StateGraph

from app.agents.ats_evaluator_agent import evaluate_ats_node
from app.agents.candidate_profile_agent import create_candidate_profile_node
from app.agents.cover_letter_agent import generate_cover_letter_node
from app.agents.job_analyzer_agent import analyze_selected_job_node
from app.agents.job_discovery_agent import discover_jobs_node
from app.agents.rag_retriever_agent import retrieve_resume_context_node
from app.agents.resume_parser_agent import parse_resume_node
from app.agents.rewrite_agent import generate_rewrite_suggestions_node
from app.agents.state import AgentState

logger = logging.getLogger(__name__)


async def export_resume_node(state: AgentState) -> AgentState:
    """Placeholder node for resume export step.

    In the full flow the API endpoint handles export by loading approved
    rewrites and calling docx_exporter. This node acts as a pass-through
    in the graph so the graph structure remains complete.
    """
    # The actual export is triggered via the API endpoint:
    # POST /applications/{id}/export-resume
    # which loads approved rewrites and calls docx_exporter.generate_resume_docx
    return state


# ── Build the StateGraph ───────────────────────────────────────────────────

_builder = StateGraph(AgentState)

# Add all nodes
_builder.add_node("parse_resume", parse_resume_node)
_builder.add_node("create_candidate_profile", create_candidate_profile_node)
_builder.add_node("discover_jobs", discover_jobs_node)
_builder.add_node("analyze_selected_job", analyze_selected_job_node)
_builder.add_node("retrieve_resume_context", retrieve_resume_context_node)
_builder.add_node("evaluate_ats", evaluate_ats_node)
_builder.add_node("generate_rewrite_suggestions", generate_rewrite_suggestions_node)
_builder.add_node("export_resume", export_resume_node)
_builder.add_node("generate_cover_letter", generate_cover_letter_node)

# Add edges: linear flow with two human-in-the-loop interrupt points
_builder.add_edge(START, "parse_resume")
_builder.add_edge("parse_resume", "create_candidate_profile")
_builder.add_edge("create_candidate_profile", "discover_jobs")

# HUMAN PAUSE 1: user selects a job from the discovered list
# The graph will interrupt before "analyze_selected_job" and wait for
# the user to set state["selected_job_post_id"] before resuming.
_builder.add_edge("discover_jobs", "analyze_selected_job")

_builder.add_edge("analyze_selected_job", "retrieve_resume_context")
_builder.add_edge("retrieve_resume_context", "evaluate_ats")
_builder.add_edge("evaluate_ats", "generate_rewrite_suggestions")

# HUMAN PAUSE 2: user reviews and approves/rejects rewrite suggestions
# The graph will interrupt before "export_resume" and wait for
# the user to update suggestion statuses before resuming.
_builder.add_edge("generate_rewrite_suggestions", "export_resume")

_builder.add_edge("export_resume", "generate_cover_letter")
_builder.add_edge("generate_cover_letter", END)

# Compile the graph with interrupt points for human-in-the-loop pauses
career_agent_graph = _builder.compile(
    interrupt_before=["analyze_selected_job", "export_resume"]
)


# ── Convenience runner functions ───────────────────────────────────────────

async def run_until_job_selection(state: AgentState) -> dict[str, Any]:
    """Run the graph from START through job discovery.

    Executes: parse_resume → create_candidate_profile → discover_jobs
    Returns the state after discover_jobs completes (graph pauses before
    analyze_selected_job, awaiting user's job selection).

    Args:
        state: Initial AgentState with at minimum user_id and resume_id.

    Returns:
        The accumulated state dict after the first interrupt point.
    """
    result: dict[str, Any] = {}
    async for chunk in career_agent_graph.astream(state):
        result.update(chunk)
    return result


async def run_from_job_selected(state: AgentState) -> dict[str, Any]:
    """Resume the graph after the user has selected a job.

    Executes: analyze_selected_job → retrieve_resume_context → evaluate_ats
              → generate_rewrite_suggestions
    Pauses before export_resume, awaiting user rewrite approvals.

    Args:
        state: AgentState with selected_job_post_id set by the user.

    Returns:
        The accumulated state dict after the second interrupt point.
    """
    result: dict[str, Any] = {}
    async for chunk in career_agent_graph.astream(state):
        result.update(chunk)
    return result


async def run_cover_letter(state: AgentState) -> dict[str, Any]:
    """Run only the cover letter generation node.

    Args:
        state: AgentState with resume_json, job_json, and retrieved_context populated.

    Returns:
        State dict with cover_letter populated.
    """
    updated_state = await generate_cover_letter_node(state)
    return dict(updated_state)
