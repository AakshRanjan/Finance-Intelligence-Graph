from datetime import date, datetime

from fmp_sdk import HistoricalChartBar, HistoricalPriceEodFull

from historical_data_ingest.ingest import (
    chart_to_write,
    eod_to_write,
    parse_datasets,
    parse_symbols,
)


def test_parse_symbols_normalizes_and_dedupes() -> None:
    assert parse_symbols("aapl, MSFT, aapl") == ["AAPL", "MSFT"]


def test_parse_datasets() -> None:
    assert parse_datasets("eod,intraday") == ["eod", "intraday"]


def test_eod_to_write_keeps_fmp_date() -> None:
    bar = HistoricalPriceEodFull(
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
    payload = eod_to_write(bar)
    dumped = payload.model_dump(mode="json", by_alias=True)
    assert dumped["date"] == "2026-01-02"
    assert "ts" not in dumped
    assert dumped["changePercent"] == 1.0
    assert dumped["symbol"] == "AAPL"


def test_chart_to_write_stamps_symbol_and_interval() -> None:
    bar = HistoricalChartBar(
        date=datetime(2026, 1, 2, 14, 30),
        open=1.0,
        high=2.0,
        low=0.5,
        close=1.5,
        volume=10.0,
    )
    payload = chart_to_write(bar, "AAPL", "1min")
    dumped = payload.model_dump(mode="json", by_alias=True)
    assert dumped["date"].startswith("2026-01-02T14:30:00")
    assert dumped["close"] == 1.5
    assert dumped["symbol"] == "AAPL"
    assert dumped["interval"] == "1min"
