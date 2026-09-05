from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fmp_sdk import Split

from historical_data_api.api.deps import (
    LIMIT,
    get_corporate_actions_repository,
    normalize_symbol,
)
from historical_data_api.schemas.results import DeleteResult, WriteResult
from historical_data_api.services.corporate_actions import CorporateActionsRepository

router = APIRouter(prefix="/splits")


@router.get("/{symbol}", response_model=list[Split])
async def get_splits(
    symbol: str,
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = Query(default=None),
    limit: int = LIMIT,
    repo: CorporateActionsRepository = Depends(get_corporate_actions_repository),
) -> list[Split]:
    return await repo.get_splits(normalize_symbol(symbol), from_, to, limit)


@router.put("/{symbol}", response_model=WriteResult)
async def put_splits(
    symbol: str,
    rows: list[Split],
    repo: CorporateActionsRepository = Depends(get_corporate_actions_repository),
) -> WriteResult:
    normalized = normalize_symbol(symbol)
    stamped = [row.model_copy(update={"symbol": normalized}) for row in rows]
    count = await repo.upsert_splits(stamped)
    return WriteResult(symbol=normalized, count=count)


@router.delete("/{symbol}", response_model=DeleteResult)
async def delete_splits(
    symbol: str,
    from_: date = Query(alias="from"),
    to: date = Query(),
    repo: CorporateActionsRepository = Depends(get_corporate_actions_repository),
) -> DeleteResult:
    if from_ > to:
        raise HTTPException(status_code=422, detail="from must be on or before to")
    normalized = normalize_symbol(symbol)
    deleted = await repo.delete_splits(normalized, from_, to)
    return DeleteResult(symbol=normalized, deleted=deleted)
