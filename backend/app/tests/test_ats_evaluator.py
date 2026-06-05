from __future__ import annotations


# ── Test data ──────────────────────────────────────────────────────────────

FULL_MATCH_RESUME = {
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS", "Kubernetes", "REST APIs"],
    "work_experience": [
        {
            "company": "Acme Corp",
            "title": "Backend Engineer",
            "bullets": [
                "Built microservices using Python FastAPI",
                "Deployed services to AWS with Docker containers",
                "Managed PostgreSQL databases with 99.9% uptime",
                "Designed REST APIs consumed by 50K users daily",
                "Implemented Kubernetes orchestration reducing costs by 30%",
            ],
        }
    ],
    "projects": [
        {
            "name": "CloudAPI",
            "technologies": ["FastAPI", "PostgreSQL"],
            "bullets": ["Deployed to AWS", "Handled 1M+ requests/day"],
        }
    ],
    "education": [],
    "languages": [],
    "certifications": [],
    "achievements": [],
}

ZERO_MATCH_RESUME = {
    "name": "Bob Smith",
    "email": "bob@example.com",
    "skills": ["Java", "Spring Boot", "Oracle DB"],
    "work_experience": [
        {
            "company": "OldCorp",
            "title": "Java Developer",
            "bullets": ["Maintained legacy Java applications", "Fixed Oracle DB bugs"],
        }
    ],
    "projects": [],
    "education": [],
    "languages": [],
    "certifications": [],
    "achievements": [],
}

FULL_REQUIREMENTS_JOB = {
    "extracted_requirements": {
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
        "preferred_skills": ["Kubernetes", "REST APIs"],
        "responsibilities": ["Build microservices", "Deploy to cloud", "Manage databases"],
        "qualifications": ["3+ years Python"],
        "keywords": ["backend", "API", "cloud", "microservices"],
        "seniority_level": "mid-level",
        "job_type": "full-time",
    }
}

ZERO_REQUIREMENTS_JOB = {
    "extracted_requirements": {
        "required_skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
        "preferred_skills": ["Kubernetes", "REST APIs"],
        "responsibilities": ["Build microservices"],
        "qualifications": ["3+ years Python"],
        "keywords": ["backend", "API"],
        "seniority_level": "mid-level",
        "job_type": "full-time",
    }
}


# ── Tests ──────────────────────────────────────────────────────────────────

def test_ats_score_is_between_0_and_100():
    """ATS score must always be 0-100 regardless of input."""
    from app.agents.ats_evaluator_agent import _compute_ats_score

    test_cases = [
        (FULL_MATCH_RESUME, FULL_REQUIREMENTS_JOB),
        (ZERO_MATCH_RESUME, ZERO_REQUIREMENTS_JOB),
        ({"name": "X", "skills": [], "work_experience": [], "projects": []}, FULL_REQUIREMENTS_JOB),
    ]

    for resume, job in test_cases:
        score, matched, missing = _compute_ats_score(resume, job)
        assert 0 <= score <= 100, f"Score {score} out of range for resume={resume}"
        assert isinstance(matched, list)
        assert isinstance(missing, list)


def test_ats_rank_is_valid():
    """ATS rank must always be one of '상', '중', '하'."""
    from app.agents.ats_evaluator_agent import _compute_ats_score, _score_to_rank

    for resume, job in [(FULL_MATCH_RESUME, FULL_REQUIREMENTS_JOB), (ZERO_MATCH_RESUME, ZERO_REQUIREMENTS_JOB)]:
        score, _, _ = _compute_ats_score(resume, job)
        rank = _score_to_rank(score)
        assert rank in ("상", "중", "하"), f"Invalid rank '{rank}'"


def test_high_skill_match_gives_high_score():
    """Full skill match should score >= 75 (floors removed, so score comes from real matches)."""
    from app.agents.ats_evaluator_agent import _compute_ats_score

    score, matched_skills, missing_skills = _compute_ats_score(FULL_MATCH_RESUME, FULL_REQUIREMENTS_JOB)
    assert score >= 75, f"Expected high score for full skill match, got {score}"
    assert len(matched_skills) >= 3


def test_zero_skill_match_gives_low_score():
    """Zero skill match should score < 40 with no floors inflating it."""
    from app.agents.ats_evaluator_agent import _compute_ats_score

    score, matched_skills, missing_skills = _compute_ats_score(ZERO_MATCH_RESUME, ZERO_REQUIREMENTS_JOB)
    assert score < 40, f"Expected low score for zero skill match, got {score}"


def test_rank_mapping():
    """Test explicit score-to-rank boundaries."""
    from app.agents.ats_evaluator_agent import _score_to_rank

    assert _score_to_rank(80) == "상"
    assert _score_to_rank(90) == "상"
    assert _score_to_rank(100) == "상"
    assert _score_to_rank(79) == "중"
    assert _score_to_rank(60) == "중"
    assert _score_to_rank(55) == "중"
    assert _score_to_rank(54) == "하"
    assert _score_to_rank(40) == "하"
    assert _score_to_rank(0) == "하"


def test_matched_skills_are_subset_of_required():
    """Matched skills should only include skills that appear in resume."""
    from app.agents.ats_evaluator_agent import _compute_ats_score

    score, matched_skills, missing_skills = _compute_ats_score(FULL_MATCH_RESUME, FULL_REQUIREMENTS_JOB)

    # All matched skills should be known skills (lowercased)
    resume_text = " ".join(FULL_MATCH_RESUME.get("skills", [])).lower()
    for exp in FULL_MATCH_RESUME.get("work_experience", []):
        for bullet in exp.get("bullets", []):
            resume_text += " " + bullet.lower()

    for skill in matched_skills:
        assert skill in resume_text, f"Matched skill '{skill}' not found in resume text"


def test_missing_skills_not_in_resume():
    """Missing skills should be skills the resume doesn't mention."""
    from app.agents.ats_evaluator_agent import _compute_ats_score

    score, matched_skills, missing_skills = _compute_ats_score(ZERO_MATCH_RESUME, ZERO_REQUIREMENTS_JOB)

    # Java resume should be missing Python skills
    required = {"python", "fastapi", "postgresql", "docker", "aws"}
    assert any(skill in required for skill in missing_skills), (
        f"Expected some Python/FastAPI skills to be missing, got: {missing_skills}"
    )
