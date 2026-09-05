from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_CORS_ORIGINS = "http://localhost:5173,http://localhost:8080"


class ApiSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    cors_origins: str = _DEFAULT_CORS_ORIGINS

    def cors_origin_list(self) -> list[str]:
        return parse_cors_origins(self.cors_origins)


def parse_cors_origins(raw: str) -> list[str]:
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


@lru_cache
def get_api_settings() -> ApiSettings:
    return ApiSettings()
