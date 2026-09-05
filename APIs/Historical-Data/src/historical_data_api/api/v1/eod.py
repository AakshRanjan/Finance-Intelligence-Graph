from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fmp_sdk.modified import EodBar, EodBarPatch

from historical_data_api.api.deps import LIMIT, get_repository, normalize_symbol
from historical_data_api.schemas.results import CoverageResult, DeleteResult, WriteResult
from historical_data_api.services.bars import BarRepository

router = APIRouter(prefix="/eod")


@router.get("/{symbol}/coverage", response_model=CoverageResult)
async def get_eod_coverage(
    symbol: str,
    from_: date = Query(alias="from"),
    to: date = Query(),
    repo: BarRepository = Depends(get_repository),
) -> CoverageResult:
    if from_ > to:
        raise HTTPException(status_code=422, detail="from must be on or before to")
    normalized = normalize_symbol(symbol)
    dates = await repo.eod_coverage(normalized, from_, to)
    return CoverageResult(symbol=normalized, dates=dates)


@router.get("/{symbol}", response_model=list[EodBar])
async def get_eod(
    symbol: str,
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = Query(default=None),
    limit: int = LIMIT,
    repo: BarRepository = Depends(get_repository),
) -> list[EodBar]:
    return await repo.get_eod(normalize_symbol(symbol), from_, to, limit)


@router.put("/{symbol}", response_model=WriteResult)
async def put_eod(
    symbol: str,
    bars: list[EodBar],
    repo: BarRepository = Depends(get_repository),
) -> WriteResult:
    normalized = normalize_symbol(symbol)
    stamped = [
        bar.model_copy(update={"symbol": normalized})
        for bar in bars
    ]
    count = await repo.upsert_eod(stamped)
    return WriteResult(symbol=normalized, count=count)


@router.patch("/{symbol}", response_model=WriteResult)
async def patch_eod(
    symbol: str,
    patches: list[EodBarPatch],
    repo: BarRepository = Depends(get_repository),
) -> WriteResult:
    normalized = normalize_symbol(symbol)
    count = await repo.patch_eod(normalized, patches)
    return WriteResult(symbol=normalized, count=count)


@router.delete("/{symbol}", response_model=DeleteResult)
async def delete_eod(
    symbol: str,
    from_: date = Query(alias="from"),
    to: date = Query(),
    repo: BarRepository = Depends(get_repository),
) -> DeleteResult:
    if from_ > to:
        raise HTTPException(status_code=422, detail="from must be on or before to")
    normalized = normalize_symbol(symbol)
    deleted = await repo.delete_eod(normalized, from_, to)
    return DeleteResult(symbol=normalized, deleted=deleted)
