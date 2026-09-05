from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class IngestSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    fmp_api_key: str
    api_base_url: str = "http://api:8000"
    ingest_concurrency: int = 4
    health_timeout_s: float = 60.0


@lru_cache
def get_ingest_settings() -> IngestSettings:
    return IngestSettings()
