from __future__ import annotations

from typing import TYPE_CHECKING, Any, Literal

if TYPE_CHECKING:
    from fmp_sdk.FMPSession import FMPSession

ChartInterval = Literal["1min", "5min", "15min", "30min", "1hour", "4hour"]


def _normalize_symbol(symbol: str | None) -> str | None:
    if symbol is None:
        return None
    normalized = symbol.strip().upper()
    return normalized or None


class Chart:
    """FMP Charts endpoints for one optional bound symbol."""

    def __init__(
        self,
        session: FMPSession,
        symbol: str | None = None,
    ) -> None:
        self._session = session
        self._symbol = _normalize_symbol(symbol)

    def _resolve_symbol(self, symbol: str | None) -> str:
        resolved = _normalize_symbol(symbol) or self._symbol
        if resolved is None:
            raise ValueError("symbol is required")
        return resolved

    def _query(
        self,
        symbol: str | None,
        from_: str | None,
        to: str | None,
    ) -> dict[str, str | None]:
        return {
            "symbol": self._resolve_symbol(symbol),
            "from": from_,
            "to": to,
        }

    async def historical_price_eod_light(
        self,
        symbol: str | None = None,
        *,
        from_: str | None = None,
        to: str | None = None,
    ) -> Any:
        return await self._session.get(
            "historical-price-eod/light",
            **self._query(symbol, from_, to),
        )

    async def historical_price_eod_full(
        self,
        symbol: str | None = None,
        *,
        from_: str | None = None,
        to: str | None = None,
    ) -> Any:
        return await self._session.get(
            "historical-price-eod/full",
            **self._query(symbol, from_, to),
        )

    async def historical_price_eod_non_split_adjusted(
        self,
        symbol: str | None = None,
        *,
        from_: str | None = None,
        to: str | None = None,
    ) -> Any:
        return await self._session.get(
            "historical-price-eod/non-split-adjusted",
            **self._query(symbol, from_, to),
        )

    async def historical_price_eod_dividend_adjusted(
        self,
        symbol: str | None = None,
        *,
        from_: str | None = None,
        to: str | None = None,
    ) -> Any:
        return await self._session.get(
            "historical-price-eod/dividend-adjusted",
            **self._query(symbol, from_, to),
        )

    async def historical_chart(
        self,
        interval: ChartInterval,
        symbol: str | None = None,
        *,
        from_: str | None = None,
        to: str | None = None,
    ) -> Any:
        return await self._session.get(
            f"historical-chart/{interval}",
            **self._query(symbol, from_, to),
        )
