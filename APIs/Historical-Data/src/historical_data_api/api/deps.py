from fastapi import HTTPException, Query, Request

from historical_data_api.services.bars import BarRepository
from historical_data_api.services.corporate_actions import CorporateActionsRepository

LIMIT = Query(default=5000, ge=1, le=50_000)


def normalize_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not normalized:
        raise HTTPException(status_code=422, detail="symbol is required")
    return normalized


def get_repository(request: Request) -> BarRepository:
    return BarRepository(request.app.state.pool)


def get_corporate_actions_repository(request: Request) -> CorporateActionsRepository:
    return CorporateActionsRepository(request.app.state.pool)
