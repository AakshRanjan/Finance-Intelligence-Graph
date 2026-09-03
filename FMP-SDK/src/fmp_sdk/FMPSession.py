from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING, Any, TypeVar

import aiohttp
from fmp_sdk.exception import FMPResponseError, _RetryableHTTPError
from fmp_sdk.utils.retrySession import RetrySession
from pydantic import TypeAdapter, ValidationError

if TYPE_CHECKING:
    from fmp_sdk.chart.chart import Chart

T = TypeVar("T")


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

    def chart(self, symbol: str | None = None) -> Chart:
        from fmp_sdk.chart.chart import Chart

        return Chart(self, symbol)

    async def get(
        self,
        path: str,
        *,
        response_model: type[T],
        **params: Any,
    ) -> T:
        """GET a stable API path and return a validated pydantic payload."""
        url = f"{self._base_url}/{path.lstrip('/')}"
        query = {key: value for key, value in params.items() if value is not None}
        response = await self._session.get(url, params=query)
        try:
            response.raise_for_status()
            data = await response.json()
        finally:
            response.release()
        try:
            return TypeAdapter(response_model).validate_python(data)
        except ValidationError as exc:
            raise FMPResponseError(path, exc) from exc

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
