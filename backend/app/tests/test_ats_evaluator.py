from __future__ import annotations


# ── Tests ──────────────────────────────────────────────────────────────────
# The ATS evaluator's scoring is now produced entirely by GPT (no local
# deterministic scoring function), so these tests only cover the
# deterministic helpers that remain: rank mapping, cosine similarity
# aggregation, general-evaluation detection, and skill flattening.

def test_rank_mapping():
    """Test explicit score-to-rank boundaries."""
    from app.agents.ats_evaluator_agent import _score_to_rank

    assert _score_to_rank(85) == "상"
    assert _score_to_rank(90) == "상"
    assert _score_to_rank(100) == "상"
    assert _score_to_rank(84) == "중"
    assert _score_to_rank(60) == "중"
    assert _score_to_rank(55) == "중"
    assert _score_to_rank(54) == "하"
    assert _score_to_rank(40) == "하"
    assert _score_to_rank(0) == "하"


def test_compute_cosine_similarity_empty_context():
    """No retrieved context should yield 0 similarity, not an error."""
    from app.agents.ats_evaluator_agent import _compute_cosine_similarity

    assert _compute_cosine_similarity([]) == 0.0


def test_compute_cosine_similarity_averages_scores():
    """Similarity is the average of retrieved chunk similarity scores, as a percentage."""
    from app.agents.ats_evaluator_agent import _compute_cosine_similarity

    context = [{"similarity": 0.8}, {"similarity": 0.6}, {"chunk_text": "no score"}]
    assert _compute_cosine_similarity(context) == 70.0


def test_is_general_evaluation_true_for_placeholder():
    """A placeholder job description with no requirements is a general evaluation."""
    from app.agents.ats_evaluator_agent import _is_general_evaluation

    job_json = {"job_description": "General resume evaluation", "extracted_requirements": {}}
    assert _is_general_evaluation(job_json) is True


def test_is_general_evaluation_false_with_requirements():
    """A real job posting with extracted requirements is not a general evaluation."""
    from app.agents.ats_evaluator_agent import _is_general_evaluation

    job_json = {
        "job_description": "Backend Engineer at Acme",
        "extracted_requirements": {"required_skills": ["Python", "FastAPI"]},
    }
    assert _is_general_evaluation(job_json) is False


def test_flatten_skills_handles_list_and_dict():
    """Skills can be a flat list, a dict of categories, or a single string."""
    from app.agents.ats_evaluator_agent import _flatten_skills

    assert _flatten_skills(["Python", "FastAPI"]) == ["Python", "FastAPI"]
    assert set(_flatten_skills({"languages": ["Python"], "tools": ["Docker"]})) == {"Python", "Docker"}
    assert _flatten_skills("Python") == ["Python"]
