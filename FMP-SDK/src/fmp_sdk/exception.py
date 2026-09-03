from __future__ import annotations

import aiohttp
from pydantic import ValidationError


class _RetryableHTTPError(Exception):
    """Raised internally when an HTTP status should trigger a retry."""

    def __init__(self, response: aiohttp.ClientResponse) -> None:
        self.response = response
        super().__init__(
            f"Retryable HTTP {response.status} for {response.method} {response.url}"
        )


class FMPResponseError(Exception):
    """Raised when an FMP JSON payload does not match the expected model."""

    def __init__(self, path: str, error: ValidationError) -> None:
        self.path = path
        self.error = error
        super().__init__(f"Invalid FMP response for {path}: {error}")
