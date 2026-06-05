from __future__ import annotations

import pytest


def test_state_initialization():
    """AgentState TypedDict has all required keys defined."""
    from app.agents.state import AgentState

    required_keys = {
        "user_id",
        "resume_id",
        "candidate_profile_id",
        "job_post_ids",
        "selected_job_post_id",
        "application_id",
        "resume_json",
        "candidate_profile",
        "job_json",
        "retrieved_context",
        "ats_result",
        "rewrite_suggestions",
        "approved_rewrites",
        "cover_letter",
        "errors",
    }

    annotations = AgentState.__annotations__
    for key in required_keys:
        assert key in annotations, f"Key '{key}' missing from AgentState"


def test_state_can_be_instantiated_as_dict():
    """AgentState can be used as a regular dict with all fields."""
    from app.agents.state import AgentState

    state: AgentState = {
        "user_id": "user-123",
        "resume_id": "resume-456",
        "candidate_profile_id": None,
        "job_post_ids": [],
        "selected_job_post_id": None,
        "application_id": "app-789",
        "resume_json": None,
        "candidate_profile": None,
        "job_json": None,
        "retrieved_context": None,
        "ats_result": None,
        "rewrite_suggestions": None,
        "approved_rewrites": None,
        "cover_letter": None,
        "errors": [],
    }

    assert state["user_id"] == "user-123"
    assert state["errors"] == []
    assert state["job_post_ids"] == []


def test_analysis_graph_compiled_successfully():
    """Import analysis_graph without raising any errors."""
    pytest.importorskip("langgraph", reason="langgraph not installed")
    from app.agents.graph import analysis_graph

    assert analysis_graph is not None


def test_analysis_graph_has_correct_node_names():
    """Verify analysis_graph contains all expected node names."""
    pytest.importorskip("langgraph", reason="langgraph not installed")
    from app.agents.graph import analysis_graph

    expected_nodes = {
        "analyze_job",
        "retrieve_context",
        "research_company",
        "evaluate_ats",
        "generate_cover_letter",
        "generate_rewrites",
    }

    try:
        graph_nodes = set(analysis_graph.nodes.keys())
    except AttributeError:
        try:
            graph_nodes = set(analysis_graph.graph.nodes.keys())
        except AttributeError:
            pytest.skip("Cannot introspect graph nodes in this LangGraph version")
            return

    for node in expected_nodes:
        assert node in graph_nodes, f"Node '{node}' not found in analysis_graph"
