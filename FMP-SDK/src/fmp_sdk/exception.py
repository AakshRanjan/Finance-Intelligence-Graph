from __future__ import annotations

import aiohttp


class _RetryableHTTPError(Exception):
    """Raised internally when an HTTP status should trigger a retry."""

    def __init__(self, response: aiohttp.ClientResponse) -> None:
        self.response = response
        super().__init__(
            f"Retryable HTTP {response.status} for {response.method} {response.url}"
        )
