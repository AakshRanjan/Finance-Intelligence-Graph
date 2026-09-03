from __future__ import annotations

import asyncio
from typing import Any

import aiohttp
from fmp_sdk.exception import _RetryableHTTPError
from fmp_sdk.utils.retrySession import RetrySession


class FMPSession:
    """Async Financial Modeling Prep client backed by RetrySession."""

    BASE_URL = "https://financialmodelingprep.com/stable"

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = BASE_URL,
        **retry_kwargs: Any,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._session = RetrySession(
            headers={"apikey": api_key},
            **retry_kwargs,
        )

    async def __aenter__(self) -> FMPSession:
        await self._session.__aenter__()
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self._session.__aexit__(*exc)

    async def close(self) -> None:
        await self._session.close()

    async def check_connectivity(self) -> bool:
        """Return True if the FMP API is reachable and accepts the API key."""
        url = f"{self._base_url}/search-symbol"
        try:
            response = await self._session.get(url, params={"query": "AAPL"})
            try:
                return response.status == 200
            finally:
                response.release()
        except (
            aiohttp.ClientError,
            asyncio.TimeoutError,
            _RetryableHTTPError,
        ):
            return False
