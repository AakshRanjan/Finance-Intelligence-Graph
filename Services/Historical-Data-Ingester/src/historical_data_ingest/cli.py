from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Annotated

import typer

from historical_data_ingest.config import get_ingest_settings
from historical_data_ingest.ingest import run_ingest
from historical_data_ingest.rate_limit import SlidingWindowRateLimiter
from historical_data_ingest.yaml_config import load_ingest_yaml, resolved_jobs


def ingest(
    config: Annotated[
        Path,
        typer.Option("--config", help="Path to ingest config.yaml"),
    ] = Path("config.yaml"),
) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    try:
        yaml_cfg = load_ingest_yaml(config)
        jobs = resolved_jobs(yaml_cfg)
    except (FileNotFoundError, ValueError) as exc:
        raise typer.BadParameter(str(exc), param_hint="--config") from exc
    settings = get_ingest_settings()
    fmp_limiter = SlidingWindowRateLimiter(yaml_cfg.num_api_calls_per_min)
    local_limiter = SlidingWindowRateLimiter(yaml_cfg.num_local_api_calls_per_min)
    asyncio.run(run_ingest(settings, jobs, fmp_limiter, local_limiter))


def app() -> None:
    typer.run(ingest)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
