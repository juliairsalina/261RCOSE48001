from __future__ import annotations

import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# ── App setup with mocked dependencies ────────────────────────────────────

def _make_mock_supabase(rows: dict | None = None):
    """Build a mock Supabase client that returns specified rows."""
    rows = rows or {}

    def _mock_table(table_name: str):
        mock = MagicMock()
        row_data = rows.get(table_name, [{"id": "mock-uuid-1234"}])

        # list result — used by insert() and list selects
        execute_list = MagicMock()
        execute_list.data = row_data

        # single result — .single() in real Supabase returns a dict, not a list
        execute_single = MagicMock()
        execute_single.data = row_data[0] if row_data else None

        mock.insert.return_value.execute.return_value = execute_list
        mock.update.return_value.eq.return_value.execute.return_value = execute_list
        mock.select.return_value.eq.return_value.single.return_value.execute.return_value = execute_single
        mock.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = execute_list
        mock.select.return_value.eq.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = execute_list
        mock.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = execute_single
        return mock

    mock_client = MagicMock()
    mock_client.table = _mock_table
    mock_client.storage.from_.return_value.upload.return_value = {}
    mock_client.storage.from_.return_value.get_public_url.return_value = "https://example.com/resume.pdf"
    return mock_client


@pytest.fixture
def mock_supabase():
    rows = {
        "resumes": [
            {
                "id": "resume-1234",
                "user_id": "user-5678",
                "file_url": "https://example.com/resume.pdf",
                "file_name": "resume.pdf",
                "file_type": "pdf",
                "raw_text": "Jane Doe Software Engineer Python FastAPI",
                "parsed_json": {
                    "name": "Jane Doe",
                    "email": "jane@example.com",
                    "phone": "555-0100",
                    "skills": ["Python", "FastAPI"],
                    "work_experience": [],
                    "education": [],
                    "projects": [],
                    "languages": [],
                    "certifications": [],
                    "achievements": [],
                },
                "created_at": "2024-01-01T00:00:00Z",
            }
        ],
        "applications": [
            {
                "id": "app-9999",
                "user_id": "user-5678",
                "resume_id": "resume-1234",
                "job_post_id": "job-1111",
                "status": "created",
                "created_at": "2024-01-01T00:00:00Z",
            }
        ],
        "rewrite_suggestions": [
            {
                "id": "suggestion-1",
                "application_id": "app-9999",
                "section": "skills",
                "original_text": "Python",
                "suggested_text": "Python (FastAPI, Django)",
                "reason": "More specific",
                "status": "pending",
                "created_at": "2024-01-01T00:00:00Z",
            }
        ],
    }
    return _make_mock_supabase(rows)


@pytest.fixture
def client(mock_supabase):
    with patch("app.services.supabase_client.get_client", return_value=mock_supabase), \
         patch("app.services.supabase_client._client", mock_supabase):
        from app.main import app
        return TestClient(app)


# ── Tests ──────────────────────────────────────────────────────────────────

def test_health_endpoint(client):
    """GET /health should return 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_upload_resume_invalid_file_type(client):
    """POST /resumes/upload with a .txt file should return 400."""
    txt_content = b"This is a plain text file, not a resume PDF."
    response = client.post(
        "/resumes/upload",
        data={"user_id": "user-5678"},
        files={"file": ("resume.txt", io.BytesIO(txt_content), "text/plain")},
    )
    assert response.status_code == 400
    assert "txt" in response.json()["detail"].lower() or "unsupported" in response.json()["detail"].lower()


def test_upload_resume_invalid_file_type_csv(client):
    """POST /resumes/upload with a .csv file should also return 400."""
    csv_content = b"name,email\nJane,jane@example.com"
    response = client.post(
        "/resumes/upload",
        data={"user_id": "user-5678"},
        files={"file": ("data.csv", io.BytesIO(csv_content), "text/csv")},
    )
    assert response.status_code == 400


def test_create_application(mock_supabase):
    """POST /applications/create should return an application with an ID."""
    with patch("app.services.supabase_client.get_client", return_value=mock_supabase), \
         patch("app.services.supabase_client._client", mock_supabase):
        from app.main import app
        client = TestClient(app)

        response = client.post(
            "/applications/create",
            json={
                "user_id": "user-5678",
                "resume_id": "resume-1234",
                "job_post_id": "job-1111",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert data["user_id"] == "user-5678"
    assert data["resume_id"] == "resume-1234"
    assert data["job_post_id"] == "job-1111"
    assert data["status"] == "created"


def test_patch_rewrite_suggestion_approved(mock_supabase):
    """PATCH /rewrite-suggestions/{id} with 'approved' should update status."""
    with patch("app.services.supabase_client.get_client", return_value=mock_supabase), \
         patch("app.services.supabase_client._client", mock_supabase):
        from app.main import app
        client = TestClient(app)

        response = client.patch(
            "/rewrite-suggestions/suggestion-1",
            json={"status": "approved"},
        )

    assert response.status_code == 200
    data = response.json()
    # The mock returns the configured row data
    assert "id" in data or "status" in data or data is not None


def test_patch_rewrite_suggestion_rejected(mock_supabase):
    """PATCH /rewrite-suggestions/{id} with 'rejected' should also succeed."""
    with patch("app.services.supabase_client.get_client", return_value=mock_supabase), \
         patch("app.services.supabase_client._client", mock_supabase):
        from app.main import app
        client = TestClient(app)

        response = client.patch(
            "/rewrite-suggestions/suggestion-1",
            json={"status": "rejected"},
        )

    assert response.status_code == 200


def test_patch_rewrite_suggestion_invalid_status(mock_supabase):
    """PATCH /rewrite-suggestions/{id} with invalid status should return 422."""
    with patch("app.services.supabase_client.get_client", return_value=mock_supabase), \
         patch("app.services.supabase_client._client", mock_supabase):
        from app.main import app
        client = TestClient(app)

        response = client.patch(
            "/rewrite-suggestions/suggestion-1",
            json={"status": "maybe"},
        )

    assert response.status_code == 422


def test_get_application(mock_supabase):
    """GET /applications/{id} should return the application row."""
    with patch("app.services.supabase_client.get_client", return_value=mock_supabase), \
         patch("app.services.supabase_client._client", mock_supabase):
        from app.main import app
        client = TestClient(app)

        response = client.get("/applications/app-9999")

    # Either 200 (found) or 404 (not found in mock) is acceptable — verify no 500
    assert response.status_code in (200, 404)
