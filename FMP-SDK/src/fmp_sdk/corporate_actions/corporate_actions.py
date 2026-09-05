from __future__ import annotations

from typing import TYPE_CHECKING

from fmp_sdk.corporate_actions.models import Dividend, Earning, Split

if TYPE_CHECKING:
    from fmp_sdk.FMPSession import FMPSession


def _normalize_symbol(symbol: str | None) -> str | None:
    if symbol is None:
        return None
    normalized = symbol.strip().upper()
    return normalized or None


class CorporateActions:
    """FMP corporate-actions endpoints for one optional bound symbol."""

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

    async def dividends(self, symbol: str | None = None) -> list[Dividend]:
        return await self._session.get(
            "dividends",
            response_model=list[Dividend],
            symbol=self._resolve_symbol(symbol),
        )

    async def earnings(self, symbol: str | None = None) -> list[Earning]:
        return await self._session.get(
            "earnings",
            response_model=list[Earning],
            symbol=self._resolve_symbol(symbol),
        )

    async def splits(self, symbol: str | None = None) -> list[Split]:
        return await self._session.get(
            "splits",
            response_model=list[Split],
            symbol=self._resolve_symbol(symbol),
        )
