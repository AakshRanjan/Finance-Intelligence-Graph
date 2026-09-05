from __future__ import annotations

import os
from collections.abc import Iterator
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from historical_data_api.core.config import get_api_settings


def _database_url() -> str | None:
    return os.environ.get("DATABASE_URL")


@pytest.fixture
def client() -> Iterator[TestClient]:
    url = _database_url()
    if not url:
        pytest.skip("DATABASE_URL is not set")
    get_api_settings.cache_clear()
    os.environ["DATABASE_URL"] = url
    from historical_data_api.main import app

    with TestClient(app) as test_client:
        yield test_client
    get_api_settings.cache_clear()


@pytest.mark.integration
def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.integration
def test_eod_crud_roundtrip(client: TestClient) -> None:
    symbol = "TEST.EOD"
    client.delete(
        f"/v1/eod/{symbol}",
        params={"from": "2020-01-01", "to": "2030-01-01"},
    )
    payload = [
        {
            "symbol": symbol,
            "date": "2026-01-02",
            "open": 1.0,
            "high": 2.0,
            "low": 0.5,
            "close": 1.5,
            "volume": 100.0,
            "change": 0.1,
            "changePercent": 1.0,
            "vwap": 1.2,
        }
    ]
    put = client.put(f"/v1/eod/{symbol}", json=payload)
    assert put.status_code == 200
    assert put.json()["count"] == 1

    put_again = client.put(f"/v1/eod/{symbol}", json=payload)
    assert put_again.status_code == 200

    fetched = client.get(
        f"/v1/eod/{symbol}",
        params={"from": "2026-01-01", "to": "2026-01-03"},
    )
    assert fetched.status_code == 200
    rows = fetched.json()
    assert len(rows) == 1
    assert rows[0]["date"] == "2026-01-02"
    assert rows[0]["close"] == 1.5
    assert "ts" not in rows[0]

    patched = client.patch(
        f"/v1/eod/{symbol}",
        json=[{"date": "2026-01-02", "close": 9.0}],
    )
    assert patched.status_code == 200
    after = client.get(f"/v1/eod/{symbol}").json()
    assert after[0]["close"] == 9.0

    missing = client.patch(
        f"/v1/eod/{symbol}",
        json=[{"date": "1999-01-01", "close": 1.0}],
    )
    assert missing.status_code == 404

    deleted = client.delete(
        f"/v1/eod/{symbol}",
        params={"from": "2026-01-01", "to": "2026-01-03"},
    )
    assert deleted.status_code == 200
    assert deleted.json()["deleted"] == 1
    assert client.get(f"/v1/eod/{symbol}").json() == []


@pytest.mark.integration
def test_intraday_crud_roundtrip(client: TestClient) -> None:
    symbol = "TEST.INTRADAY"
    ts = datetime(2026, 1, 2, 15, 0, tzinfo=timezone.utc).isoformat()
    client.delete(
        f"/v1/intraday/{symbol}",
        params={
            "interval": "1min",
            "from": "2020-01-01T00:00:00Z",
            "to": "2030-01-01T00:00:00Z",
        },
    )
    payload = [
        {
            "symbol": symbol,
            "interval": "1min",
            "date": ts,
            "open": 1.0,
            "high": 2.0,
            "low": 0.5,
            "close": 1.5,
            "volume": 10.0,
        }
    ]
    put = client.put(
        f"/v1/intraday/{symbol}",
        params={"interval": "1min"},
        json=payload,
    )
    assert put.status_code == 200
    rows = client.get(
        f"/v1/intraday/{symbol}",
        params={"interval": "1min"},
    ).json()
    assert len(rows) == 1
    patched = client.patch(
        f"/v1/intraday/{symbol}",
        params={"interval": "1min"},
        json=[{"date": ts, "volume": 99.0}],
    )
    assert patched.status_code == 200
    deleted = client.delete(
        f"/v1/intraday/{symbol}",
        params={
            "interval": "1min",
            "from": "2026-01-02T00:00:00Z",
            "to": "2026-01-03T00:00:00Z",
        },
    )
    assert deleted.json()["deleted"] == 1


@pytest.mark.integration
def test_delete_requires_range(client: TestClient) -> None:
    response = client.delete("/v1/eod/AAPL")
    assert response.status_code == 422


@pytest.mark.integration
def test_symbols_catalog(client: TestClient) -> None:
    eod_symbol = "TEST.SYMBOLS.EOD"
    intra_symbol = "TEST.SYMBOLS.INTRA"
    both_symbol = "TEST.SYMBOLS.BOTH"
    ts = datetime(2026, 1, 2, 15, 0, tzinfo=timezone.utc).isoformat()

    client.delete(
        f"/v1/eod/{eod_symbol}",
        params={"from": "2020-01-01", "to": "2030-01-01"},
    )
    client.delete(
        f"/v1/eod/{both_symbol}",
        params={"from": "2020-01-01", "to": "2030-01-01"},
    )
    for symbol in (intra_symbol, both_symbol):
        for interval in ("1min", "5min"):
            client.delete(
                f"/v1/intraday/{symbol}",
                params={
                    "interval": interval,
                    "from": "2020-01-01T00:00:00Z",
                    "to": "2030-01-01T00:00:00Z",
                },
            )

    eod_bar = {
        "date": "2026-01-02",
        "open": 1.0,
        "high": 2.0,
        "low": 0.5,
        "close": 1.5,
        "volume": 100.0,
    }
    intra_bar = {
        "date": ts,
        "open": 1.0,
        "high": 2.0,
        "low": 0.5,
        "close": 1.5,
        "volume": 10.0,
    }

    assert client.put(
        f"/v1/eod/{eod_symbol}",
        json=[{**eod_bar, "symbol": eod_symbol}],
    ).status_code == 200
    assert client.put(
        f"/v1/intraday/{intra_symbol}",
        params={"interval": "1min"},
        json=[{**intra_bar, "symbol": intra_symbol, "interval": "1min"}],
    ).status_code == 200
    assert client.put(
        f"/v1/eod/{both_symbol}",
        json=[{**eod_bar, "symbol": both_symbol}],
    ).status_code == 200
    assert client.put(
        f"/v1/intraday/{both_symbol}",
        params={"interval": "1min"},
        json=[{**intra_bar, "symbol": both_symbol, "interval": "1min"}],
    ).status_code == 200
    assert client.put(
        f"/v1/intraday/{both_symbol}",
        params={"interval": "5min"},
        json=[{**intra_bar, "symbol": both_symbol, "interval": "5min"}],
    ).status_code == 200

    response = client.get("/v1/symbols")
    assert response.status_code == 200
    items = {item["symbol"]: item for item in response.json()["items"]}

    assert items[eod_symbol]["eod"] is True
    assert items[eod_symbol]["intraday_intervals"] == []
    assert items[intra_symbol]["eod"] is False
    assert items[intra_symbol]["intraday_intervals"] == ["1min"]
    assert items[both_symbol]["eod"] is True
    assert items[both_symbol]["intraday_intervals"] == ["1min", "5min"]


@pytest.mark.integration
def test_cors_preflight(client: TestClient) -> None:
    response = client.options(
        "/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


@pytest.mark.integration
def test_eod_coverage(client: TestClient) -> None:
    symbol = "TEST.EOD.COVERAGE"
    client.delete(
        f"/v1/eod/{symbol}",
        params={"from": "2020-01-01", "to": "2030-01-01"},
    )
    empty = client.get(
        f"/v1/eod/{symbol}/coverage",
        params={"from": "2026-01-01", "to": "2026-01-03"},
    )
    assert empty.status_code == 200
    assert empty.json() == {"symbol": symbol, "dates": [], "interval": None}

    payload = [
        {
            "symbol": symbol,
            "date": "2026-01-02",
            "open": 1.0,
            "high": 2.0,
            "low": 0.5,
            "close": 1.5,
            "volume": 100.0,
        }
    ]
    assert client.put(f"/v1/eod/{symbol}", json=payload).status_code == 200
    covered = client.get(
        f"/v1/eod/{symbol}/coverage",
        params={"from": "2026-01-01", "to": "2026-01-03"},
    )
    assert covered.status_code == 200
    assert covered.json()["dates"] == ["2026-01-02"]


@pytest.mark.integration
def test_intraday_coverage(client: TestClient) -> None:
    symbol = "TEST.INTRADAY.COVERAGE"
    ts = datetime(2026, 1, 2, 15, 0, tzinfo=timezone.utc).isoformat()
    client.delete(
        f"/v1/intraday/{symbol}",
        params={
            "interval": "1min",
            "from": "2020-01-01T00:00:00Z",
            "to": "2030-01-01T00:00:00Z",
        },
    )
    empty = client.get(
        f"/v1/intraday/{symbol}/coverage",
        params={"interval": "1min", "from": "2026-01-01", "to": "2026-01-03"},
    )
    assert empty.status_code == 200
    assert empty.json() == {
        "symbol": symbol,
        "interval": "1min",
        "dates": [],
    }

    payload = [
        {
            "symbol": symbol,
            "interval": "1min",
            "date": ts,
            "open": 1.0,
            "high": 2.0,
            "low": 0.5,
            "close": 1.5,
            "volume": 10.0,
        }
    ]
    assert client.put(
        f"/v1/intraday/{symbol}",
        params={"interval": "1min"},
        json=payload,
    ).status_code == 200
    covered = client.get(
        f"/v1/intraday/{symbol}/coverage",
        params={"interval": "1min", "from": "2026-01-01", "to": "2026-01-03"},
    )
    assert covered.status_code == 200
    assert covered.json()["dates"] == ["2026-01-02"]
    other_interval = client.get(
        f"/v1/intraday/{symbol}/coverage",
        params={"interval": "5min", "from": "2026-01-01", "to": "2026-01-03"},
    )
    assert other_interval.json()["dates"] == []
