from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from fmp_sdk.models import FMPBaseModel


class HistoricalPriceEodLight(FMPBaseModel):
    """Row from GET /stable/historical-price-eod/light."""

    symbol: str
    date: date
    price: float
    volume: float


class HistoricalPriceEodFull(FMPBaseModel):
    """Row from GET /stable/historical-price-eod/full."""

    symbol: str
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    change: float
    change_percent: float = Field(alias="changePercent")
    vwap: float


class HistoricalPriceEodAdjusted(FMPBaseModel):
    """Row from non-split-adjusted and dividend-adjusted EOD endpoints."""

    symbol: str
    date: date
    adj_open: float = Field(alias="adjOpen")
    adj_high: float = Field(alias="adjHigh")
    adj_low: float = Field(alias="adjLow")
    adj_close: float = Field(alias="adjClose")
    volume: float


class HistoricalChartBar(FMPBaseModel):
    """Row from GET /stable/historical-chart/{interval}."""

    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
