from __future__ import annotations

import asyncio
from typing import Any

import aiohttp
from fmp_sdk.exception import _RetryableHTTPError
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)


class RetrySession:
    """Thin aiohttp.ClientSession wrapper with tenacity retries."""

    def __init__(
        self,
        *,
        session: aiohttp.ClientSession | None = None,
        max_attempts: int = 5,
        retry_statuses: frozenset[int] = frozenset({429, 500, 502, 503, 504}),
        wait_multiplier: float = 1.0,
        wait_max: float = 60.0,
        **session_kwargs: Any,
    ) -> None:
        self._external_session = session
        self._session = session
        self._session_kwargs = session_kwargs
        self._owns_session = session is None
        self._max_attempts = max_attempts
        self._retry_statuses = retry_statuses
        self._wait_multiplier = wait_multiplier
        self._wait_max = wait_max

    def _ensure_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(**self._session_kwargs)
            self._owns_session = True
        return self._session

    async def __aenter__(self) -> RetrySession:
        self._ensure_session()
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        if (
            self._owns_session
            and self._session is not None
            and not self._session.closed
        ):
            await self._session.close()
            self._session = None

    async def request(
        self, method: str, url: str, **kwargs: Any
    ) -> aiohttp.ClientResponse:
        session = self._ensure_session()

        try:
            async for attempt in AsyncRetrying(
                stop=stop_after_attempt(self._max_attempts),
                wait=wait_exponential(
                    multiplier=self._wait_multiplier,
                    max=self._wait_max,
                ),
                retry=retry_if_exception_type(
                    (
                        aiohttp.ClientConnectionError,
                        aiohttp.ServerTimeoutError,
                        asyncio.TimeoutError,
                        _RetryableHTTPError,
                    )
                ),
                reraise=True,
            ):
                with attempt:
                    response = await session.request(method, url, **kwargs)
                    if response.status in self._retry_statuses:
                        await response.read()
                        response.release()
                        raise _RetryableHTTPError(response)
                    return response
        except _RetryableHTTPError as exc:
            response = exc.response
            raise aiohttp.ClientResponseError(
                request_info=response.request_info,
                history=response.history,
                status=response.status,
                message=response.reason or "",
                headers=response.headers,
            ) from exc

        raise RuntimeError(
            "RetrySession.request completed without a response"
        )  # pragma: no cover

    async def get(self, url: str, **kwargs: Any) -> aiohttp.ClientResponse:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs: Any) -> aiohttp.ClientResponse:
        return await self.request("POST", url, **kwargs)

    async def patch(self, url: str, **kwargs: Any) -> aiohttp.ClientResponse:
        return await self.request("PATCH", url, **kwargs)

    async def delete(self, url: str, **kwargs: Any) -> aiohttp.ClientResponse:
        return await self.request("DELETE", url, **kwargs)
