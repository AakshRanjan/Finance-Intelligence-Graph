from __future__ import annotations

import pytest

from historical_data_ingest.rate_limit import SlidingWindowRateLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def __call__(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


@pytest.mark.asyncio
async def test_sliding_window_waits_when_capacity_reached() -> None:
    clock = FakeClock()
    limiter = SlidingWindowRateLimiter(2, clock=clock, sleep=clock.sleep)
    await limiter.acquire()
    await limiter.acquire()
    await limiter.acquire()
    assert clock.sleeps == [60.0]
    assert clock.now == 60.0


@pytest.mark.asyncio
async def test_sliding_window_allows_after_window_expires() -> None:
    clock = FakeClock()
    limiter = SlidingWindowRateLimiter(1, clock=clock, sleep=clock.sleep)
    await limiter.acquire()
    clock.now = 60.0
    await limiter.acquire()
    assert clock.sleeps == []
