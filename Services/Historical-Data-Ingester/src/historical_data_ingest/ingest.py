from __future__ import annotations

import asyncio
import logging
import time
from datetime import date

import aiohttp
import httpx
from fmp_sdk import (
    ChartInterval,
    FMPSession,
    HistoricalChartBar,
    HistoricalPriceEodFull,
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

logger = logging.getLogger(__name__)

DATASETS = ("eod", "intraday")


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


def parse_datasets(raw: str) -> list[str]:
    datasets = [part.strip().lower() for part in raw.split(",") if part.strip()]
    unknown = [item for item in datasets if item not in DATASETS]
    if unknown:
        raise ValueError(f"unknown datasets {unknown}; expected eod and/or intraday")
    if not datasets:
        raise ValueError("at least one dataset is required")
    return list(dict.fromkeys(datasets))


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


async def ingest_symbol(
    session: FMPSession,
    client: httpx.AsyncClient,
    settings: IngestSettings,
    symbol: str,
    windows: list[tuple[date, date]],
    datasets: list[str],
    interval: ChartInterval,
) -> tuple[int, str | None]:
    upserted = 0
    chart = session.chart(symbol)
    try:
        for start, end in windows:
            if "eod" in datasets:
                existing = await get_eod_coverage(
                    client, settings.api_base_url, symbol, start, end
                )
                missing = missing_date_ranges(start, end, existing)
                if not missing:
                    logger.info(
                        "skip existing eod symbol=%s from=%s to=%s",
                        symbol,
                        start.isoformat(),
                        end.isoformat(),
                    )
                for from_date, to_date in missing:
                    from_ = from_date.isoformat()
                    to = to_date.isoformat()
                    bars = await chart.historical_price_eod_full(from_=from_, to=to)
                    payload = [eod_to_write(bar) for bar in bars]
                    if payload:
                        count = await put_eod(
                            client, settings.api_base_url, symbol, payload
                        )
                        upserted += count
                        logger.info(
                            "put eod symbol=%s from=%s to=%s count=%s status=200",
                            symbol,
                            from_,
                            to,
                            count,
                        )
                    else:
                        logger.info(
                            "skip empty eod symbol=%s from=%s to=%s",
                            symbol,
                            from_,
                            to,
                        )
            if "intraday" in datasets:
                existing = await get_intraday_coverage(
                    client,
                    settings.api_base_url,
                    symbol,
                    interval,
                    start,
                    end,
                )
                missing = missing_date_ranges(start, end, existing)
                if not missing:
                    logger.info(
                        "skip existing intraday symbol=%s interval=%s from=%s to=%s",
                        symbol,
                        interval,
                        start.isoformat(),
                        end.isoformat(),
                    )
                for from_date, to_date in missing:
                    from_ = from_date.isoformat()
                    to = to_date.isoformat()
                    bars = await chart.historical_chart(
                        interval, from_=from_, to=to
                    )
                    payload = [
                        chart_to_write(bar, symbol, interval) for bar in bars
                    ]
                    if payload:
                        count = await put_intraday(
                            client,
                            settings.api_base_url,
                            symbol,
                            interval,
                            payload,
                        )
                        upserted += count
                        logger.info(
                            "put intraday symbol=%s interval=%s from=%s to=%s count=%s status=200",
                            symbol,
                            interval,
                            from_,
                            to,
                            count,
                        )
                    else:
                        logger.info(
                            "skip empty intraday symbol=%s from=%s to=%s",
                            symbol,
                            from_,
                            to,
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


async def run_ingest(
    settings: IngestSettings,
    symbols: list[str],
    lookback: str,
    chunk_size: str,
    datasets: list[str],
    interval: ChartInterval,
    *,
    today: date | None = None,
) -> int:
    start, end = lookback_range(lookback, today=today)
    windows = list(iter_chunks(start, end, parse_duration(chunk_size)))
    logger.info(
        "ingest start symbols=%s lookback=%s chunk_size=%s windows=%s datasets=%s interval=%s",
        symbols,
        lookback,
        chunk_size,
        len(windows),
        datasets,
        interval,
    )
    semaphore = asyncio.Semaphore(settings.ingest_concurrency)
    failed: list[str] = []
    total = 0

    async def bounded(symbol: str) -> tuple[int, str | None]:
        async with semaphore:
            return await ingest_symbol(
                session, client, settings, symbol, windows, datasets, interval
            )

    async with FMPSession(settings.fmp_api_key) as session:
        async with httpx.AsyncClient(timeout=60.0) as client:
            await wait_for_health(
                client, settings.api_base_url, settings.health_timeout_s
            )
            results = await asyncio.gather(*(bounded(symbol) for symbol in symbols))

    for count, failed_symbol in results:
        total += count
        if failed_symbol is not None:
            failed.append(failed_symbol)

    if failed:
        logger.error("ingest completed with failures symbols=%s", failed)
        raise SystemExit(1)
    logger.info("ingest completed upserted=%s", total)
    return total
