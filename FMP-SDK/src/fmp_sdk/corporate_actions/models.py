from __future__ import annotations

from datetime import date
from typing import Annotated, Any

from pydantic import BeforeValidator, Field

from fmp_sdk.models import FMPBaseModel


def _empty_str_to_none(value: Any) -> Any:
    if value == "":
        return None
    return value


OptionalDate = Annotated[date | None, BeforeValidator(_empty_str_to_none)]


class Dividend(FMPBaseModel):
    """Row from GET /stable/dividends."""

    symbol: str
    date: date
    record_date: OptionalDate = Field(default=None, alias="recordDate")
    payment_date: OptionalDate = Field(default=None, alias="paymentDate")
    declaration_date: OptionalDate = Field(default=None, alias="declarationDate")
    adj_dividend: float = Field(alias="adjDividend")
    dividend: float
    yield_: float = Field(alias="yield")
    frequency: str


class Earning(FMPBaseModel):
    """Row from GET /stable/earnings."""

    symbol: str
    date: date
    eps_actual: float | None = Field(default=None, alias="epsActual")
    eps_estimated: float | None = Field(default=None, alias="epsEstimated")
    revenue_actual: float | None = Field(default=None, alias="revenueActual")
    revenue_estimated: float | None = Field(default=None, alias="revenueEstimated")
    last_updated: date = Field(alias="lastUpdated")


class Split(FMPBaseModel):
    """Row from GET /stable/splits."""

    symbol: str
    date: date
    numerator: int
    denominator: int
    split_type: str = Field(alias="splitType")
