from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import date

import aiohttp
import httpx
from fmp_sdk import (
    Chart,
    ChartInterval,
    Dividend,
    Earning,
    FMPSession,
    HistoricalChartBar,
    HistoricalPriceEodFull,
    Split,
)
from fmp_sdk.exception import FMPResponseError
from fmp_sdk.modified import EodBar, IntradayBar

from historical_data_ingest.chunking import (
    iter_chunks,
    lookback_range,
    missing_date_ranges,
    parse_duration,
)
from historical_data_ingest.config import IngestSettings
from historical_data_ingest.rate_limit import RateLimiter

logger = logging.getLogger(__name__)

DATASETS = ("eod", "intraday", "dividends", "earnings", "splits")
BAR_DATASETS = frozenset({"eod", "intraday"})
CORPORATE_DATASETS = ("dividends", "earnings", "splits")
ALLOWED_INTERVALS: tuple[ChartInterval, ...] = (
    "1min",
    "5min",
    "15min",
    "30min",
    "1hour",
    "4hour",
)


@dataclass(frozen=True)
class SymbolJob:
    symbol: str
    lookback: str
    chunk_size: str
    datasets: list[str]
    interval: ChartInterval


def normalize_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not normalized:
        raise ValueError("symbol must be non-empty")
    return normalized


def parse_symbols(raw: str) -> list[str]:
    symbols = [normalize_symbol(part) for part in raw.split(",") if part.strip()]
    if not symbols:
        raise ValueError("at least one symbol is required")
    return list(dict.fromkeys(symbols))


def parse_dataset_list(datasets: list[str]) -> list[str]:
    items = [part.strip().lower() for part in datasets if part.strip()]
    unknown = [item for item in items if item not in DATASETS]
    if unknown:
        raise ValueError(
            f"unknown datasets {unknown}; expected eod, intraday, "
            "dividends, earnings, and/or splits"
        )
    if not items:
        raise ValueError("at least one dataset is required")
    return list(dict.fromkeys(items))


def parse_datasets(raw: str) -> list[str]:
    return parse_dataset_list([part for part in raw.split(",")])


def eod_to_write(bar: HistoricalPriceEodFull) -> EodBar:
    return EodBar.model_validate(bar.model_dump())


def chart_to_write(
    bar: HistoricalChartBar,
    symbol: str,
    interval: ChartInterval,
) -> IntradayBar:
    return IntradayBar.model_validate(
        {**bar.model_dump(), "symbol": symbol, "interval": interval}
    )


async def wait_for_health(
    client: httpx.AsyncClient,
    base_url: str,
    timeout_s: float,
) -> None:
    deadline = time.monotonic() + timeout_s
    health_url = f"{base_url.rstrip('/')}/health"
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            response = await client.get(health_url)
            if response.status_code == 200:
                logger.info("api healthy at %s", health_url)
                return
            last_error = RuntimeError(f"health status {response.status_code}")
        except httpx.HTTPError as exc:
            last_error = exc
        await asyncio.sleep(1)
    raise RuntimeError(f"API not healthy at {health_url}: {last_error}")


def _coverage_dates(payload: dict[str, object]) -> set[date]:
    raw = payload.get("dates", [])
    if not isinstance(raw, list):
        return set()
    return {date.fromisoformat(str(item)) for item in raw}


async def get_eod_coverage(
    client: httpx.AsyncClient,
    base_url: str,
    symbol: str,
    start: date,
    end: date,
) -> set[date]:
    response = await client.get(
        f"{base_url.rstrip('/')}/v1/eod/{symbol}/coverage",
        params={"from": start.isoformat(), "to": end.isoformat()},
    )
    response.raise_for_status()
    return _coverage_dates(response.json())


async def get_intraday_coverage(
    client: httpx.AsyncClient,
    base_url: str,
    symbol: str,
    interval: ChartInterval,
    start: date,
    end: date,
) -> set[date]:
    response = await client.get(
        f"{base_url.rstrip('/')}/v1/intraday/{symbol}/coverage",
        params={
            "interval": interval,
            "from": start.isoformat(),
            "to": end.isoformat(),
        },
    )
    response.raise_for_status()
    return _coverage_dates(response.json())


async def put_eod(
    client: httpx.AsyncClient,
    base_url: str,
    symbol: str,
    bars: list[EodBar],
) -> int:
    response = await client.put(
        f"{base_url.rstrip('/')}/v1/eod/{symbol}",
        json=[bar.model_dump(mode="json", by_alias=True) for bar in bars],
    )
    response.raise_for_status()
    return int(response.json()["count"])


async def put_intraday(
    client: httpx.AsyncClient,
    base_url: str,
    symbol: str,
    interval: ChartInterval,
    bars: list[IntradayBar],
) -> int:
    response = await client.put(
        f"{base_url.rstrip('/')}/v1/intraday/{symbol}",
        params={"interval": interval},
        json=[bar.model_dump(mode="json", by_alias=True) for bar in bars],
    )
    response.raise_for_status()
    return int(response.json()["count"])


async def put_corporate_actions(
    client: httpx.AsyncClient,
    base_url: str,
    dataset: str,
    symbol: str,
    rows: list[Dividend] | list[Earning] | list[Split],
) -> int:
    response = await client.put(
        f"{base_url.rstrip('/')}/v1/{dataset}/{symbol}",
        json=[row.model_dump(mode="json", by_alias=True) for row in rows],
    )
    response.raise_for_status()
    return int(response.json()["count"])


async def _acquire(rate_limiter: RateLimiter | None) -> None:
    if rate_limiter is not None:
        await rate_limiter.acquire()


async def ingest_corporate_actions(
    session: FMPSession,
    client: httpx.AsyncClient,
    settings: IngestSettings,
    symbol: str,
    datasets: list[str],
    rate_limiter: RateLimiter | None = None,
    local_rate_limiter: RateLimiter | None = None,
) -> int:
    upserted = 0
    actions = session.corporate_actions(symbol)
    fetchers = {
        "dividends": actions.dividends,
        "earnings": actions.earnings,
        "splits": actions.splits,
    }
    for dataset in CORPORATE_DATASETS:
        if dataset not in datasets:
            continue
        await _acquire(rate_limiter)
        rows = await fetchers[dataset]()
        if not rows:
            logger.info("skip empty %s symbol=%s", dataset, symbol)
            continue
        await _acquire(local_rate_limiter)
        count = await put_corporate_actions(
            client, settings.api_base_url, dataset, symbol, rows
        )
        upserted += count
        logger.info(
            "put %s symbol=%s count=%s status=200",
            dataset,
            symbol,
            count,
        )
    return upserted


async def ingest_symbol(
    session: FMPSession,
    client: httpx.AsyncClient,
    settings: IngestSettings,
    symbol: str,
    windows: list[tuple[date, date]],
    datasets: list[str],
    interval: ChartInterval,
    rate_limiter: RateLimiter | None = None,
    local_rate_limiter: RateLimiter | None = None,
) -> tuple[int, str | None]:
    upserted = 0
    try:
        if BAR_DATASETS.intersection(datasets):
            chart = session.chart(symbol)
            upserted += await _ingest_bars(
                chart,
                client,
                settings,
                symbol,
                windows,
                datasets,
                interval,
                rate_limiter,
                local_rate_limiter,
            )
        if any(dataset in datasets for dataset in CORPORATE_DATASETS):
            upserted += await ingest_corporate_actions(
                session,
                client,
                settings,
                symbol,
                datasets,
                rate_limiter,
                local_rate_limiter,
            )
    except (
        FMPResponseError,
        httpx.HTTPError,
        aiohttp.ClientError,
        ValueError,
    ) as exc:
        logger.exception("ingest failed symbol=%s error=%s", symbol, exc)
        return upserted, symbol
    return upserted, None


async def _fill_bar_window(
    start: date,
    end: date,
    *,
    get_coverage: Callable[[], Awaitable[set[date]]],
    fetch_bars: Callable[[date, date], Awaitable[list[object]]],
    put_bars: Callable[[list[object]], Awaitable[int]],
    skip_existing: str,
    put_fmt: str,
    empty_fmt: str,
    rate_limiter: RateLimiter | None,
    local_rate_limiter: RateLimiter | None,
) -> int:
    upserted = 0
    attempted: set[tuple[date, date]] = set()
    while True:
        await _acquire(local_rate_limiter)
        existing = await get_coverage()
        missing = missing_date_ranges(start, end, existing)
        remaining = [window for window in missing if window not in attempted]
        if not remaining:
            if not missing and not attempted:
                logger.info(skip_existing)
            return upserted
        wrote = False
        for from_date, to_date in remaining:
            attempted.add((from_date, to_date))
            from_ = from_date.isoformat()
            to = to_date.isoformat()
            await _acquire(rate_limiter)
            bars = await fetch_bars(from_date, to_date)
            if not bars:
                logger.info(empty_fmt, from_, to)
                continue
            await _acquire(local_rate_limiter)
            count = await put_bars(bars)
            upserted += count
            wrote = True
            logger.info(put_fmt, from_, to, count)
        if not wrote:
            return upserted


async def _ingest_bars(
    chart: Chart,
    client: httpx.AsyncClient,
    settings: IngestSettings,
    symbol: str,
    windows: list[tuple[date, date]],
    datasets: list[str],
    interval: ChartInterval,
    rate_limiter: RateLimiter | None = None,
    local_rate_limiter: RateLimiter | None = None,
) -> int:
    upserted = 0
    for start, end in windows:
        if "eod" in datasets:

            async def eod_coverage(
                window_start: date = start,
                window_end: date = end,
            ) -> set[date]:
                return await get_eod_coverage(
                    client,
                    settings.api_base_url,
                    symbol,
                    window_start,
                    window_end,
                )

            async def eod_fetch(from_date: date, to_date: date) -> list[object]:
                bars = await chart.historical_price_eod_full(
                    from_=from_date.isoformat(),
                    to=to_date.isoformat(),
                )
                return [eod_to_write(bar) for bar in bars]

            async def eod_put(payload: list[object]) -> int:
                return await put_eod(
                    client,
                    settings.api_base_url,
                    symbol,
                    payload,  # type: ignore[arg-type]
                )

            upserted += await _fill_bar_window(
                start,
                end,
                get_coverage=eod_coverage,
                fetch_bars=eod_fetch,
                put_bars=eod_put,
                skip_existing=(
                    f"skip existing eod symbol={symbol} from={start.isoformat()} "
                    f"to={end.isoformat()}"
                ),
                put_fmt=(
                    f"put eod symbol={symbol} from=%s to=%s count=%s status=200"
                ),
                empty_fmt=f"skip empty eod symbol={symbol} from=%s to=%s",
                rate_limiter=rate_limiter,
                local_rate_limiter=local_rate_limiter,
            )
        if "intraday" in datasets:

            async def intraday_coverage(
                window_start: date = start,
                window_end: date = end,
            ) -> set[date]:
                return await get_intraday_coverage(
                    client,
                    settings.api_base_url,
                    symbol,
                    interval,
                    window_start,
                    window_end,
                )

            async def intraday_fetch(from_date: date, to_date: date) -> list[object]:
                bars = await chart.historical_chart(
                    interval,
                    from_=from_date.isoformat(),
                    to=to_date.isoformat(),
                )
                return [chart_to_write(bar, symbol, interval) for bar in bars]

            async def intraday_put(payload: list[object]) -> int:
                return await put_intraday(
                    client,
                    settings.api_base_url,
                    symbol,
                    interval,
                    payload,  # type: ignore[arg-type]
                )

            upserted += await _fill_bar_window(
                start,
                end,
                get_coverage=intraday_coverage,
                fetch_bars=intraday_fetch,
                put_bars=intraday_put,
                skip_existing=(
                    f"skip existing intraday symbol={symbol} interval={interval} "
                    f"from={start.isoformat()} to={end.isoformat()}"
                ),
                put_fmt=(
                    f"put intraday symbol={symbol} interval={interval} "
                    f"from=%s to=%s count=%s status=200"
                ),
                empty_fmt=f"skip empty intraday symbol={symbol} from=%s to=%s",
                rate_limiter=rate_limiter,
                local_rate_limiter=local_rate_limiter,
            )
    return upserted


async def run_ingest(
    settings: IngestSettings,
    jobs: Sequence[SymbolJob],
    rate_limiter: RateLimiter,
    local_rate_limiter: RateLimiter,
    *,
    today: date | None = None,
) -> int:
    logger.info(
        "ingest start symbols=%s jobs=%s",
        [job.symbol for job in jobs],
        [
            {
                "symbol": job.symbol,
                "lookback": job.lookback,
                "chunk_size": job.chunk_size,
                "datasets": job.datasets,
                "interval": job.interval,
            }
            for job in jobs
        ],
    )
    semaphore = asyncio.Semaphore(settings.ingest_concurrency)
    failed: list[str] = []
    total = 0

    async def bounded(job: SymbolJob) -> tuple[int, str | None]:
        start, end = lookback_range(job.lookback, today=today)
        windows = list(iter_chunks(start, end, parse_duration(job.chunk_size)))
        async with semaphore:
            return await ingest_symbol(
                session,
                client,
                settings,
                job.symbol,
                windows,
                job.datasets,
                job.interval,
                rate_limiter,
                local_rate_limiter,
            )

    async with FMPSession(settings.fmp_api_key) as session:
        async with httpx.AsyncClient(timeout=60.0) as client:
            await wait_for_health(
                client, settings.api_base_url, settings.health_timeout_s
            )
            results = await asyncio.gather(*(bounded(job) for job in jobs))

    for count, failed_symbol in results:
        total += count
        if failed_symbol is not None:
            failed.append(failed_symbol)

    if failed:
        logger.error("ingest completed with failures symbols=%s", failed)
        raise SystemExit(1)
    logger.info("ingest completed upserted=%s", total)
    return total
