from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # OpenAI
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    openai_embedding_model: str = "text-embedding-3-small"

    # Supabase
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_bucket: str = "resumes"

    # LangChain / LangSmith
    langchain_tracing_v2: bool = True
    langchain_api_key: str = ""
    langchain_project: str = "career-application-agent"

    # Job Search
    job_search_api_key: str = ""
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
