from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from fmp_sdk.chart.models import ChartInterval, HistoricalChartBar, HistoricalPriceEodFull
from fmp_sdk.models import FMPBaseModel


class EodBar(HistoricalPriceEodFull):
    """FMP EOD full bar with optional extras for stored/partial rows."""

    change: float | None = None
    change_percent: float | None = Field(default=None, alias="changePercent")
    vwap: float | None = None


class IntradayBar(HistoricalChartBar):
    """FMP intraday bar plus symbol and interval for persistence."""

    symbol: str
    interval: ChartInterval


class EodBarPatch(FMPBaseModel):
    """Partial EOD update; `date` is required to locate the row."""

    date: date
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: float | None = None
    change: float | None = None
    change_percent: float | None = Field(default=None, alias="changePercent")
    vwap: float | None = None


class IntradayBarPatch(FMPBaseModel):
    """Partial intraday update; `date` is required to locate the row."""

    date: datetime
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: float | None = None
