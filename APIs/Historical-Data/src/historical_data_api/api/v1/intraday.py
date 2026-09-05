from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fmp_sdk import ChartInterval
from fmp_sdk.modified import IntradayBar, IntradayBarPatch

from historical_data_api.api.deps import LIMIT, get_repository, normalize_symbol
from historical_data_api.schemas.results import CoverageResult, DeleteResult, WriteResult
from historical_data_api.services.bars import BarRepository

router = APIRouter(prefix="/intraday")


@router.get("/{symbol}/coverage", response_model=CoverageResult)
async def get_intraday_coverage(
    symbol: str,
    interval: ChartInterval,
    from_: date = Query(alias="from"),
    to: date = Query(),
    repo: BarRepository = Depends(get_repository),
) -> CoverageResult:
    if from_ > to:
        raise HTTPException(status_code=422, detail="from must be on or before to")
    normalized = normalize_symbol(symbol)
    dates = await repo.intraday_coverage(normalized, interval, from_, to)
    return CoverageResult(symbol=normalized, interval=interval, dates=dates)


@router.get("/{symbol}", response_model=list[IntradayBar])
async def get_intraday(
    symbol: str,
    interval: ChartInterval,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = Query(default=None),
    limit: int = LIMIT,
    repo: BarRepository = Depends(get_repository),
) -> list[IntradayBar]:
    return await repo.get_intraday(
        normalize_symbol(symbol), interval, from_, to, limit
    )


@router.put("/{symbol}", response_model=WriteResult)
async def put_intraday(
    symbol: str,
    bars: list[IntradayBar],
    interval: ChartInterval,
    repo: BarRepository = Depends(get_repository),
) -> WriteResult:
    normalized = normalize_symbol(symbol)
    stamped = [
        bar.model_copy(update={"symbol": normalized, "interval": interval})
        for bar in bars
    ]
    count = await repo.upsert_intraday(stamped)
    return WriteResult(symbol=normalized, count=count)


@router.patch("/{symbol}", response_model=WriteResult)
async def patch_intraday(
    symbol: str,
    patches: list[IntradayBarPatch],
    interval: ChartInterval,
    repo: BarRepository = Depends(get_repository),
) -> WriteResult:
    normalized = normalize_symbol(symbol)
    count = await repo.patch_intraday(normalized, interval, patches)
    return WriteResult(symbol=normalized, count=count)


@router.delete("/{symbol}", response_model=DeleteResult)
async def delete_intraday(
    symbol: str,
    interval: ChartInterval,
    from_: datetime = Query(alias="from"),
    to: datetime = Query(),
    repo: BarRepository = Depends(get_repository),
) -> DeleteResult:
    if from_ > to:
        raise HTTPException(status_code=422, detail="from must be on or before to")
    normalized = normalize_symbol(symbol)
    deleted = await repo.delete_intraday(normalized, interval, from_, to)
    return DeleteResult(symbol=normalized, deleted=deleted)
