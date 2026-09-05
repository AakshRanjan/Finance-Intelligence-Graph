from __future__ import annotations

import os
from pathlib import Path

import asyncpg
from alembic import command
from alembic.config import Config


def project_root() -> Path:
    env_root = os.environ.get("HISTORICAL_DATA_ROOT")
    candidates = []
    if env_root:
        candidates.append(Path(env_root))
    candidates.append(Path.cwd())
    here = Path(__file__).resolve()
    candidates.extend(here.parents)
    for candidate in candidates:
        if (candidate / "alembic.ini").is_file():
            return candidate
    raise FileNotFoundError(
        "alembic.ini not found; set HISTORICAL_DATA_ROOT to the API directory"
    )


def run_migrations(database_url: str) -> None:
    os.environ["DATABASE_URL"] = database_url
    config = Config(str(project_root() / "alembic.ini"))
    command.upgrade(config, "head")


async def create_pool(database_url: str) -> asyncpg.Pool:
    return await asyncpg.create_pool(database_url, min_size=1, max_size=10)
