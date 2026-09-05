from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import date, timedelta

_DURATION = re.compile(r"^(\d+)([dwmy])$", re.IGNORECASE)


def parse_duration(value: str) -> timedelta:
    match = _DURATION.fullmatch(value.strip())
    if match is None:
        raise ValueError(
            f"invalid duration {value!r}; expected <number><d|w|m|y>, e.g. 30d, 2y"
        )
    amount = int(match.group(1))
    if amount < 1:
        raise ValueError(f"duration amount must be >= 1, got {value!r}")
    unit = match.group(2).lower()
    if unit == "d":
        return timedelta(days=amount)
    if unit == "w":
        return timedelta(weeks=amount)
    if unit == "m":
        return timedelta(days=30 * amount)
    return timedelta(days=365 * amount)


def lookback_range(lookback: str, *, today: date | None = None) -> tuple[date, date]:
    end = today or date.today()
    start = end - parse_duration(lookback)
    return start, end


def iter_chunks(
    start: date,
    end: date,
    chunk: timedelta,
) -> Iterator[tuple[date, date]]:
    if start > end:
        raise ValueError("start date must be on or before end date")
    if chunk.days < 1:
        raise ValueError("chunk-size must be at least 1 day")
    current = start
    while current <= end:
        chunk_end = min(current + chunk - timedelta(days=1), end)
        yield current, chunk_end
        current = chunk_end + timedelta(days=1)


def missing_date_ranges(
    start: date,
    end: date,
    existing: set[date],
) -> list[tuple[date, date]]:
    if start > end:
        raise ValueError("start date must be on or before end date")
    ranges: list[tuple[date, date]] = []
    range_start: date | None = None
    current = start
    while current <= end:
        if current not in existing:
            if range_start is None:
                range_start = current
        elif range_start is not None:
            ranges.append((range_start, current - timedelta(days=1)))
            range_start = None
        current += timedelta(days=1)
    if range_start is not None:
        ranges.append((range_start, end))
    return ranges
