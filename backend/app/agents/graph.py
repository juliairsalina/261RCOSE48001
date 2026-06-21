from __future__ import annotations

import logging
from typing import Any, Optional

from app.agents.state import AgentState

logger = logging.getLogger(__name__)


def _build_analysis_graph():
    """Analysis sub-graph: analyze_job → retrieve → (ATS ∥ research → cover letter) → rewrites.

    analyze_job extracts structured requirements from the job description so that
    the ATS evaluator always has required_skills/keywords to match against.

    Sequential chain: analyze_job → retrieve_context
    Fan-out:          retrieve_context → evaluate_ats ∥ research_company
    research_company → generate_cover_letter (only the cover letter needs company background)
    Fan-in:           evaluate_ats + generate_cover_letter merge before generate_rewrites
    """
    from langgraph.graph import END, START, StateGraph

    from app.agents.ats_evaluator_agent import evaluate_ats_node
    from app.agents.company_research_agent import research_company_node
    from app.agents.cover_letter_agent import generate_cover_letter_node
    from app.agents.job_analyzer_agent import analyze_selected_job_node
    from app.agents.rag_retriever_agent import retrieve_resume_context_node
    from app.agents.rewrite_agent import generate_rewrite_suggestions_node

    builder = StateGraph(AgentState)
    builder.add_node("analyze_job", analyze_selected_job_node)
    builder.add_node("retrieve_context", retrieve_resume_context_node)
    builder.add_node("research_company", research_company_node)
    builder.add_node("evaluate_ats", evaluate_ats_node)
    builder.add_node("generate_cover_letter", generate_cover_letter_node)
    builder.add_node("generate_rewrites", generate_rewrite_suggestions_node)

    builder.add_edge(START, "analyze_job")
    builder.add_edge("analyze_job", "retrieve_context")
    # Fan-out: ATS evaluation doesn't need company research, so it no longer
    # waits on it — only the cover letter branch depends on research_company.
    builder.add_edge("retrieve_context", "evaluate_ats")
    builder.add_edge("retrieve_context", "research_company")
    builder.add_edge("research_company", "generate_cover_letter")
    # Fan-in: rewrites wait for both branches
    builder.add_edge("evaluate_ats", "generate_rewrites")
    builder.add_edge("generate_cover_letter", "generate_rewrites")
    builder.add_edge("generate_rewrites", END)

    return builder.compile()


analysis_graph: Optional[Any] = None

try:
    analysis_graph = _build_analysis_graph()
except ImportError:
    logger.warning(
        "langgraph is not installed — graphs are unavailable. "
        "Install requirements to enable the full agent workflow."
    )
