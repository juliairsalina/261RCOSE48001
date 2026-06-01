from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve env files relative to this file: backend/app/config.py → backend/
_BASE_DIR = Path(__file__).resolve().parent.parent
_ENV_EXAMPLE_FILE = _BASE_DIR / ".env.example"  # defaults / template
_ENV_FILE = _BASE_DIR / ".env"                  # real secrets (gitignored)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        # .env.example is loaded first (provides defaults); .env overrides it.
        # If .env doesn't exist pydantic-settings silently skips it.
        env_file=(str(_ENV_EXAMPLE_FILE), str(_ENV_FILE)),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-5"
    openai_embedding_model: str = "text-embedding-3-small"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_anon_key: str = ""          # frontend-safe key (never used by backend logic)
    supabase_bucket: str = "resumes"

    # LangChain / LangSmith
    langchain_tracing_v2: bool = True
    langchain_api_key: str = ""
    langchain_project: str = "career-application-agent"

    # Job Search
    job_search_provider: str = "adzuna"
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""

    # App
    app_env: str = "development"
    max_file_size_mb: int = 10


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
