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

    # Check that all required keys are in the TypedDict annotations
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


def test_graph_compiled_successfully():
    """Import career_agent_graph without raising any errors."""
    pytest.importorskip("langgraph", reason="langgraph not installed")
    from app.agents.graph import career_agent_graph

    assert career_agent_graph is not None


def test_graph_has_correct_node_names():
    """Verify the graph contains all expected node names."""
    pytest.importorskip("langgraph", reason="langgraph not installed")
    from app.agents.graph import career_agent_graph

    expected_nodes = {
        "parse_resume",
        "create_candidate_profile",
        "discover_jobs",
        "analyze_selected_job",
        "retrieve_resume_context",
        "evaluate_ats",
        "generate_rewrite_suggestions",
        "export_resume",
        "generate_cover_letter",
    }

    # LangGraph compiled graphs expose nodes via .nodes or graph attribute
    try:
        graph_nodes = set(career_agent_graph.nodes.keys())
    except AttributeError:
        # Some versions of LangGraph use a different attribute
        try:
            graph_nodes = set(career_agent_graph.graph.nodes.keys())
        except AttributeError:
            # Skip detailed node check if the internal API differs
            pytest.skip("Cannot introspect graph nodes in this LangGraph version")
            return

    for node in expected_nodes:
        assert node in graph_nodes, f"Node '{node}' not found in graph"


def test_runner_functions_are_callable():
    """Verify the convenience runner functions exist and are callable."""
    pytest.importorskip("langgraph", reason="langgraph not installed")
    import inspect
    from app.agents.graph import run_until_job_selection, run_from_job_selected, run_cover_letter

    assert callable(run_until_job_selection)
    assert callable(run_from_job_selected)
    assert callable(run_cover_letter)

    # All three should be coroutine functions
    assert inspect.iscoroutinefunction(run_until_job_selection)
    assert inspect.iscoroutinefunction(run_from_job_selected)
    assert inspect.iscoroutinefunction(run_cover_letter)
