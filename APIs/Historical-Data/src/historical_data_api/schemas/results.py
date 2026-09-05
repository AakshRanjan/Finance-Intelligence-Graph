from __future__ import annotations

from datetime import date
from typing import Literal

from fmp_sdk import ChartInterval
from pydantic import BaseModel, Field


class WriteResult(BaseModel):
    symbol: str
    count: int


class DeleteResult(BaseModel):
    symbol: str
    deleted: int


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


class SymbolInfo(BaseModel):
    symbol: str
    eod: bool
    intraday_intervals: list[ChartInterval] = Field(default_factory=list)


class SymbolCatalog(BaseModel):
    items: list[SymbolInfo]


class CoverageResult(BaseModel):
    symbol: str
    dates: list[date]
    interval: ChartInterval | None = None
