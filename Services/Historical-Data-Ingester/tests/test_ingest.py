from __future__ import annotations

from datetime import date, timedelta
from json import loads
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fmp_sdk import Dividend, Earning, HistoricalPriceEodFull, Split

from historical_data_ingest.config import IngestSettings
from historical_data_ingest.ingest import (
    SymbolJob,
    ingest_symbol,
    parse_symbols,
    run_ingest,
    wait_for_health,
)


def _settings() -> IngestSettings:
    return IngestSettings(
        fmp_api_key="test",
        api_base_url="http://api:8000",
        ingest_concurrency=1,
        health_timeout_s=1,
    )


def _dividend() -> Dividend:
    return Dividend(
        symbol="AAPL",
        date=date(2026, 8, 10),
        recordDate=date(2026, 8, 10),
        paymentDate=date(2026, 8, 13),
        declarationDate=date(2026, 7, 30),
        adjDividend=0.27,
        dividend=0.27,
        yield_=0.34,
        frequency="Quarterly",
    )


def _earning() -> Earning:
    return Earning(
        symbol="AAPL",
        date=date(2026, 1, 29),
        epsActual=2.4,
        epsEstimated=2.35,
        revenueActual=100.0,
        revenueEstimated=99.0,
        lastUpdated=date(2026, 1, 30),
    )


def _split() -> Split:
    return Split(
        symbol="AAPL",
        date=date(2020, 8, 31),
        numerator=4,
        denominator=1,
        splitType="forward",
    )


def _eod_bar(day: date | None = None) -> HistoricalPriceEodFull:
    return HistoricalPriceEodFull(
        symbol="AAPL",
        date=day or date(2026, 1, 2),
        open=1.0,
        high=2.0,
        low=0.5,
        close=1.5,
        volume=100.0,
        change=0.1,
        changePercent=1.0,
        vwap=1.2,
    )


def _date_range(start: date, end: date) -> list[date]:
    return [start + timedelta(days=offset) for offset in range((end - start).days + 1)]


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
        "GET /v1/eod/AAPL/coverage",
    ]
    chart.historical_price_eod_full.assert_awaited_once_with(
        from_="2026-01-01", to="2026-01-15"
    )
    session.corporate_actions.assert_not_called()


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
async def test_ingest_symbol_fetches_missing_intervals_in_chunk() -> None:
    start = date(2026, 1, 1)
    end = date(2026, 1, 20)
    covered = ["2026-01-05", "2026-01-10"]
    calls: list[tuple[str, str]] = []

    async def fetch(*, from_: str, to: str) -> list[HistoricalPriceEodFull]:
        calls.append((from_, to))
        return [_eod_bar()]

    chart = MagicMock()
    chart.historical_price_eod_full = fetch
    session = MagicMock()
    session.chart.return_value = chart

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
    assert count == 3
    assert calls == [
        ("2026-01-01", "2026-01-04"),
        ("2026-01-06", "2026-01-09"),
        ("2026-01-11", "2026-01-20"),
    ]


@pytest.mark.asyncio
async def test_ingest_symbol_refetches_leftover_gap_after_truncated_fmp() -> None:
    start = date(2026, 1, 1)
    end = date(2026, 1, 15)
    covered: set[str] = set()
    calls: list[tuple[str, str]] = []

    async def fetch(*, from_: str, to: str) -> list[HistoricalPriceEodFull]:
        calls.append((from_, to))
        from_date = date.fromisoformat(from_)
        to_date = date.fromisoformat(to)
        if from_date == start and to_date == end:
            to_date = start + timedelta(days=4)
        return [_eod_bar(day) for day in _date_range(from_date, to_date)]

    chart = MagicMock()
    chart.historical_price_eod_full = fetch
    session = MagicMock()
    session.chart.return_value = chart

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(
                200, json={"symbol": "AAPL", "dates": sorted(covered)}
            )
        for item in loads(request.content):
            covered.add(str(item["date"])[:10])
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
    assert count == 2
    assert calls == [
        ("2026-01-01", "2026-01-15"),
        ("2026-01-06", "2026-01-15"),
    ]
    assert covered == {day.isoformat() for day in _date_range(start, end)}


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


@pytest.mark.asyncio
async def test_ingest_symbol_puts_corporate_actions() -> None:
    actions = MagicMock()
    actions.dividends = AsyncMock(return_value=[_dividend()])
    actions.earnings = AsyncMock(return_value=[_earning()])
    actions.splits = AsyncMock(return_value=[_split()])
    session = MagicMock()
    session.corporate_actions.return_value = actions

    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(f"{request.method} {request.url.path}")
        return httpx.Response(200, json={"symbol": "AAPL", "count": 1})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            [(date(2026, 1, 1), date(2026, 1, 15))],
            ["dividends", "earnings", "splits"],
            "1min",
        )
    assert failed is None
    assert count == 3
    assert methods == [
        "PUT /v1/dividends/AAPL",
        "PUT /v1/earnings/AAPL",
        "PUT /v1/splits/AAPL",
    ]
    session.chart.assert_not_called()
    session.corporate_actions.assert_called_once_with("AAPL")
    actions.dividends.assert_awaited_once_with()
    actions.earnings.assert_awaited_once_with()
    actions.splits.assert_awaited_once_with()


@pytest.mark.asyncio
async def test_ingest_symbol_fetches_corporate_actions_once_across_windows() -> None:
    chart = MagicMock()
    chart.historical_price_eod_full = AsyncMock(return_value=[_eod_bar()])
    actions = MagicMock()
    actions.dividends = AsyncMock(return_value=[_dividend()])
    session = MagicMock()
    session.chart.return_value = chart
    session.corporate_actions.return_value = actions

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={"symbol": "AAPL", "dates": []})
        return httpx.Response(200, json={"symbol": "AAPL", "count": 1})

    windows = [
        (date(2026, 1, 1), date(2026, 1, 15)),
        (date(2026, 1, 16), date(2026, 1, 31)),
    ]
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            windows,
            ["eod", "dividends"],
            "1min",
        )
    assert failed is None
    assert count == 3
    assert chart.historical_price_eod_full.await_count == 2
    actions.dividends.assert_awaited_once_with()
    session.corporate_actions.assert_called_once_with("AAPL")


@pytest.mark.asyncio
async def test_ingest_symbol_skips_empty_corporate_actions() -> None:
    actions = MagicMock()
    actions.dividends = AsyncMock(return_value=[])
    actions.earnings = AsyncMock(return_value=[])
    actions.splits = AsyncMock(return_value=[])
    session = MagicMock()
    session.corporate_actions.return_value = actions

    methods: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(f"{request.method} {request.url.path}")
        return httpx.Response(200, json={"symbol": "AAPL", "count": 0})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            [(date(2026, 1, 1), date(2026, 1, 15))],
            ["dividends", "earnings", "splits"],
            "1min",
        )
    assert failed is None
    assert count == 0
    assert methods == []


@pytest.mark.asyncio
async def test_ingest_symbol_bar_only_skips_corporate_actions() -> None:
    chart = MagicMock()
    chart.historical_price_eod_full = AsyncMock(return_value=[_eod_bar()])
    session = MagicMock()
    session.chart.return_value = chart

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={"symbol": "AAPL", "dates": []})
        return httpx.Response(200, json={"symbol": "AAPL", "count": 1})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            [(date(2026, 1, 1), date(2026, 1, 15))],
            ["eod"],
            "1min",
        )
    assert failed is None
    assert count == 1
    session.corporate_actions.assert_not_called()


@pytest.mark.asyncio
async def test_ingest_symbol_acquires_fmp_and_local_limiters() -> None:
    chart = MagicMock()
    chart.historical_price_eod_full = AsyncMock(return_value=[_eod_bar()])
    actions = MagicMock()
    actions.dividends = AsyncMock(return_value=[_dividend()])
    session = MagicMock()
    session.chart.return_value = chart
    session.corporate_actions.return_value = actions
    fmp_limiter = MagicMock()
    fmp_limiter.acquire = AsyncMock()
    local_limiter = MagicMock()
    local_limiter.acquire = AsyncMock()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(200, json={"symbol": "AAPL", "dates": []})
        return httpx.Response(200, json={"symbol": "AAPL", "count": 1})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        count, failed = await ingest_symbol(
            session,
            client,
            _settings(),
            "AAPL",
            [(date(2026, 1, 1), date(2026, 1, 15))],
            ["eod", "dividends"],
            "1min",
            fmp_limiter,
            local_limiter,
        )
    assert failed is None
    assert count == 2
    assert fmp_limiter.acquire.await_count == 2
    assert local_limiter.acquire.await_count == 4
    chart.historical_price_eod_full.assert_awaited_once()
    actions.dividends.assert_awaited_once()


@pytest.mark.asyncio
async def test_run_ingest_uses_per_symbol_lookback() -> None:
    charts: dict[str, MagicMock] = {}

    def get_chart(symbol: str) -> MagicMock:
        chart = charts.get(symbol)
        if chart is None:
            chart = MagicMock()
            chart.historical_price_eod_full = AsyncMock(return_value=[_eod_bar()])
            charts[symbol] = chart
        return chart

    session = MagicMock()
    session.chart.side_effect = get_chart
    session_cm = MagicMock()
    session_cm.__aenter__ = AsyncMock(return_value=session)
    session_cm.__aexit__ = AsyncMock(return_value=False)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/health":
            return httpx.Response(200, json={"status": "ok"})
        if request.method == "GET":
            return httpx.Response(200, json={"symbol": "X", "dates": []})
        return httpx.Response(200, json={"symbol": "X", "count": 1})

    jobs = [
        SymbolJob(
            symbol="AAPL",
            lookback="2d",
            chunk_size="7d",
            datasets=["eod"],
            interval="1min",
        ),
        SymbolJob(
            symbol="MSFT",
            lookback="4d",
            chunk_size="7d",
            datasets=["eod"],
            interval="1min",
        ),
    ]
    transport = httpx.MockTransport(handler)
    limiter = MagicMock()
    limiter.acquire = AsyncMock()
    local_limiter = MagicMock()
    local_limiter.acquire = AsyncMock()
    with patch(
        "historical_data_ingest.ingest.FMPSession", return_value=session_cm
    ), patch(
        "historical_data_ingest.ingest.httpx.AsyncClient",
        return_value=httpx.AsyncClient(transport=transport),
    ):
        total = await run_ingest(
            _settings(),
            jobs,
            limiter,
            local_limiter,
            today=date(2026, 1, 10),
        )
    assert total == 2
    charts["AAPL"].historical_price_eod_full.assert_awaited_once_with(
        from_="2026-01-08", to="2026-01-10"
    )
    charts["MSFT"].historical_price_eod_full.assert_awaited_once_with(
        from_="2026-01-06", to="2026-01-10"
    )
