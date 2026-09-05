from __future__ import annotations

import asyncio
import time
from collections import deque
from collections.abc import Awaitable, Callable
from typing import Protocol


class RateLimiter(Protocol):
    async def acquire(self) -> None: ...


class SlidingWindowRateLimiter:
    """Allow at most ``calls_per_min`` acquires in any rolling 60s window."""

    def __init__(
        self,
        calls_per_min: int,
        *,
        clock: Callable[[], float] | None = None,
        sleep: Callable[[float], Awaitable[None]] | None = None,
        window_s: float = 60.0,
    ) -> None:
        if calls_per_min < 1:
            raise ValueError("calls_per_min must be >= 1")
        self._max = calls_per_min
        self._window_s = window_s
        self._clock = clock or time.monotonic
        self._sleep = sleep or asyncio.sleep
        self._times: deque[float] = deque()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            while True:
                now = self._clock()
                cutoff = now - self._window_s
                while self._times and self._times[0] <= cutoff:
                    self._times.popleft()
                if len(self._times) < self._max:
                    self._times.append(now)
                    return
                wait = self._times[0] + self._window_s - now
                if wait > 0:
                    await self._sleep(wait)
