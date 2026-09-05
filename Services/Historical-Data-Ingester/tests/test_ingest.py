from __future__ import annotations

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fmp_sdk import HistoricalPriceEodFull

from historical_data_ingest.config import IngestSettings
from historical_data_ingest.ingest import ingest_symbol, parse_symbols, wait_for_health


def _settings() -> IngestSettings:
    return IngestSettings(
        fmp_api_key="test",
        api_base_url="http://api:8000",
        ingest_concurrency=1,
        health_timeout_s=1,
    )


def _eod_bar() -> HistoricalPriceEodFull:
    return HistoricalPriceEodFull(
        symbol="AAPL",
        date=date(2026, 1, 2),
        open=1.0,
        high=2.0,
        low=0.5,
        close=1.5,
        volume=100.0,
        change=0.1,
        changePercent=1.0,
        vwap=1.2,
    )


@pytest.mark.asyncio
async def test_wait_for_health_ok() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/health"
        return httpx.Response(200, json={"status": "ok"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        await wait_for_health(client, "http://api:8000", timeout_s=1)


@pytest.mark.asyncio
async def test_ingest_symbol_puts_eod_chunks() -> None:
    chart = MagicMock()
    chart.historical_price_eod_full = AsyncMock(return_value=[_eod_bar()])
    session = MagicMock()
    session.chart.return_value = chart

    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(f"{request.method} {request.url.path}")
        if request.method == "GET":
            return httpx.Response(200, json={"symbol": "AAPL", "dates": []})
        return httpx.Response(200, json={"symbol": "AAPL", "count": 1})

    transport = httpx.MockTransport(handler)
    windows = [(date(2026, 1, 1), date(2026, 1, 15))]
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            windows,
            ["eod"],
            "1min",
        )
    assert failed is None
    assert count == 1
    assert methods == [
        "GET /v1/eod/AAPL/coverage",
        "PUT /v1/eod/AAPL",
    ]
    chart.historical_price_eod_full.assert_awaited_once_with(
        from_="2026-01-01", to="2026-01-15"
    )


@pytest.mark.asyncio
async def test_ingest_symbol_skips_eod_when_coverage_complete() -> None:
    chart = MagicMock()
    chart.historical_price_eod_full = AsyncMock()
    session = MagicMock()
    session.chart.return_value = chart

    start = date(2026, 1, 1)
    end = date(2026, 1, 15)
    covered = [
        (start + timedelta(days=offset)).isoformat()
        for offset in range((end - start).days + 1)
    ]
    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(f"{request.method} {request.url.path}")
        return httpx.Response(200, json={"symbol": "AAPL", "dates": covered})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            [(start, end)],
            ["eod"],
            "1min",
        )
    assert failed is None
    assert count == 0
    assert methods == ["GET /v1/eod/AAPL/coverage"]
    chart.historical_price_eod_full.assert_not_awaited()


@pytest.mark.asyncio
async def test_ingest_symbol_fetches_only_missing_eod_range() -> None:
    chart = MagicMock()
    chart.historical_price_eod_full = AsyncMock(return_value=[_eod_bar()])
    session = MagicMock()
    session.chart.return_value = chart

    start = date(2026, 1, 1)
    end = date(2026, 1, 15)
    covered = [
        (start + timedelta(days=offset)).isoformat()
        for offset in range(5)
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={"symbol": "AAPL", "dates": covered})
        return httpx.Response(200, json={"symbol": "AAPL", "count": 1})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            [(start, end)],
            ["eod"],
            "1min",
        )
    assert failed is None
    assert count == 1
    chart.historical_price_eod_full.assert_awaited_once_with(
        from_="2026-01-06", to="2026-01-15"
    )


@pytest.mark.asyncio
async def test_ingest_symbol_skips_intraday_when_coverage_complete() -> None:
    chart = MagicMock()
    chart.historical_chart = AsyncMock()
    session = MagicMock()
    session.chart.return_value = chart

    start = date(2026, 1, 1)
    end = date(2026, 1, 3)
    covered = ["2026-01-01", "2026-01-02", "2026-01-03"]
    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(f"{request.method} {request.url.path}")
        assert request.url.params["interval"] == "1min"
        return httpx.Response(
            200,
            json={"symbol": "AAPL", "interval": "1min", "dates": covered},
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            [(start, end)],
            ["intraday"],
            "1min",
        )
    assert failed is None
    assert count == 0
    assert methods == ["GET /v1/intraday/AAPL/coverage"]
    chart.historical_chart.assert_not_awaited()


def test_parse_symbols_requires_value() -> None:
    with pytest.raises(ValueError):
        parse_symbols(" , ")
