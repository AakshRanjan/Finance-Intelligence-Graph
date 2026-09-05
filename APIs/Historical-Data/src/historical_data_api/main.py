from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from historical_data_api.api import health
from historical_data_api.api.v1.router import router as v1_router
from historical_data_api.core.config import (
    _DEFAULT_CORS_ORIGINS,
    get_api_settings,
    parse_cors_origins,
)
from historical_data_api.db.session import create_pool, run_migrations
from historical_data_api.services.bars import RowNotFoundError

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_api_settings()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    logger.info("applying database migrations")
    await asyncio.to_thread(run_migrations, settings.database_url)
    app.state.pool = await create_pool(settings.database_url)
    try:
        yield
    finally:
        await app.state.pool.close()


app = FastAPI(title="Historical Data API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_cors_origins(
        os.environ.get("CORS_ORIGINS", _DEFAULT_CORS_ORIGINS)
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RowNotFoundError)
async def row_not_found_handler(
    _request: Request, exc: RowNotFoundError
) -> JSONResponse:
    return JSONResponse(
        status_code=404,
        content={"detail": f"no row for {exc.symbol} at {exc.ts}"},
    )


app.include_router(health.router)
app.include_router(v1_router, prefix="/v1")

__all__ = ["app", "run"]


def run() -> None:
    import uvicorn

    uvicorn.run("historical_data_api.main:app", host="0.0.0.0", port=8000)


if __name__ == "__main__":
    run()
