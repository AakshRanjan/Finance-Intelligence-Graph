from datetime import date, timedelta

import pytest

from historical_data_ingest.chunking import (
    iter_chunks,
    lookback_range,
    missing_date_ranges,
    parse_duration,
)


def test_parse_duration_units() -> None:
    assert parse_duration("7d") == timedelta(days=7)
    assert parse_duration("2w") == timedelta(weeks=2)
    assert parse_duration("1m") == timedelta(days=30)
    assert parse_duration("1y") == timedelta(days=365)


def test_parse_duration_rejects_invalid() -> None:
    with pytest.raises(ValueError):
        parse_duration("30")
    with pytest.raises(ValueError):
        parse_duration("0d")
    with pytest.raises(ValueError):
        parse_duration("two-days")


def test_lookback_range() -> None:
    today = date(2026, 9, 3)
    start, end = lookback_range("10d", today=today)
    assert end == today
    assert start == date(2026, 8, 24)


def test_iter_chunks_even_windows() -> None:
    windows = list(
        iter_chunks(date(2026, 1, 1), date(2026, 1, 30), timedelta(days=10))
    )
    assert windows == [
        (date(2026, 1, 1), date(2026, 1, 10)),
        (date(2026, 1, 11), date(2026, 1, 20)),
        (date(2026, 1, 21), date(2026, 1, 30)),
    ]


def test_iter_chunks_short_last_window() -> None:
    windows = list(
        iter_chunks(date(2026, 1, 1), date(2026, 1, 12), timedelta(days=10))
    )
    assert windows == [
        (date(2026, 1, 1), date(2026, 1, 10)),
        (date(2026, 1, 11), date(2026, 1, 12)),
    ]


def test_missing_date_ranges_none_present() -> None:
    assert missing_date_ranges(
        date(2026, 1, 1), date(2026, 1, 3), set()
    ) == [(date(2026, 1, 1), date(2026, 1, 3))]


def test_missing_date_ranges_all_present() -> None:
    existing = {date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 3)}
    assert missing_date_ranges(date(2026, 1, 1), date(2026, 1, 3), existing) == []


def test_missing_date_ranges_holes_in_the_middle() -> None:
    existing = {date(2026, 1, 3)}
    assert missing_date_ranges(date(2026, 1, 1), date(2026, 1, 5), existing) == [
        (date(2026, 1, 1), date(2026, 1, 2)),
        (date(2026, 1, 4), date(2026, 1, 5)),
    ]
