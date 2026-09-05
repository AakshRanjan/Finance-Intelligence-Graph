from __future__ import annotations

import os
from collections.abc import Iterator

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
def test_dividends_crud_roundtrip(client: TestClient) -> None:
    symbol = "TEST.DIVIDENDS"
    client.delete(
        f"/v1/dividends/{symbol}",
        params={"from": "2020-01-01", "to": "2030-01-01"},
    )
    payload = [
        {
            "symbol": "WRONG",
            "date": "2026-08-10",
            "recordDate": "2026-08-10",
            "paymentDate": "2026-08-13",
            "declarationDate": "2026-07-30",
            "adjDividend": 0.27,
            "dividend": 0.27,
            "yield": 0.34,
            "frequency": "Quarterly",
        },
        {
            "symbol": "WRONG",
            "date": "1995-02-13",
            "recordDate": "1995-02-17",
            "paymentDate": "1995-03-10",
            "declarationDate": "",
            "adjDividend": 0.00107143,
            "dividend": 0.12,
            "yield": 1.09,
            "frequency": "Quarterly",
        },
    ]
    put = client.put(f"/v1/dividends/{symbol}", json=payload)
    assert put.status_code == 200
    assert put.json() == {"symbol": symbol, "count": 2}

    put_again = client.put(f"/v1/dividends/{symbol}", json=payload)
    assert put_again.status_code == 200
    assert put_again.json()["count"] == 2

    fetched = client.get(
        f"/v1/dividends/{symbol}",
        params={"from": "1995-01-01", "to": "2026-12-31"},
    )
    assert fetched.status_code == 200
    rows = fetched.json()
    assert len(rows) == 2
    assert rows[0]["symbol"] == symbol
    assert rows[0]["date"] == "1995-02-13"
    assert rows[0]["declarationDate"] is None
    assert rows[0]["yield"] == 1.09
    assert "ts" not in rows[0]
    assert "dividend_yield" not in rows[0]
    assert rows[1]["date"] == "2026-08-10"
    assert rows[1]["declarationDate"] == "2026-07-30"
    assert rows[1]["adjDividend"] == 0.27

    ranged = client.get(
        f"/v1/dividends/{symbol}",
        params={"from": "2026-01-01", "to": "2026-12-31"},
    )
    assert [row["date"] for row in ranged.json()] == ["2026-08-10"]

    missing_range = client.delete(f"/v1/dividends/{symbol}")
    assert missing_range.status_code == 422

    deleted = client.delete(
        f"/v1/dividends/{symbol}",
        params={"from": "2026-01-01", "to": "2026-12-31"},
    )
    assert deleted.status_code == 200
    assert deleted.json() == {"symbol": symbol, "deleted": 1}
    remaining = client.get(f"/v1/dividends/{symbol}").json()
    assert len(remaining) == 1
    assert remaining[0]["date"] == "1995-02-13"

    client.delete(
        f"/v1/dividends/{symbol}",
        params={"from": "1990-01-01", "to": "2030-01-01"},
    )
    assert client.get(f"/v1/dividends/{symbol}").json() == []


@pytest.mark.integration
def test_earnings_crud_roundtrip(client: TestClient) -> None:
    symbol = "TEST.EARNINGS"
    client.delete(
        f"/v1/earnings/{symbol}",
        params={"from": "2020-01-01", "to": "2030-01-01"},
    )
    payload = [
        {
            "symbol": symbol,
            "date": "2026-06-27",
            "epsActual": 1.57,
            "epsEstimated": 1.55,
            "revenueActual": 94036000000,
            "revenueEstimated": 89341030490,
            "lastUpdated": "2026-08-02",
        },
        {
            "symbol": symbol,
            "date": "2026-03-28",
            "epsActual": None,
            "epsEstimated": 1.4,
            "revenueActual": None,
            "revenueEstimated": 80000000000,
            "lastUpdated": "2026-08-02",
        },
    ]
    put = client.put(f"/v1/earnings/{symbol}", json=payload)
    assert put.status_code == 200
    assert put.json()["count"] == 2

    revised = [
        {
            **payload[1],
            "epsActual": 1.65,
            "revenueActual": 85000000000,
            "lastUpdated": "2026-09-01",
        }
    ]
    assert client.put(f"/v1/earnings/{symbol}", json=revised).status_code == 200

    fetched = client.get(
        f"/v1/earnings/{symbol}",
        params={"from": "2026-01-01", "to": "2026-12-31"},
    )
    assert fetched.status_code == 200
    rows = fetched.json()
    assert len(rows) == 2
    assert rows[0]["date"] == "2026-03-28"
    assert rows[0]["epsActual"] == 1.65
    assert rows[0]["lastUpdated"] == "2026-09-01"
    assert rows[1]["revenueActual"] == 94036000000

    deleted = client.delete(
        f"/v1/earnings/{symbol}",
        params={"from": "2026-01-01", "to": "2026-12-31"},
    )
    assert deleted.json()["deleted"] == 2
    assert client.get(f"/v1/earnings/{symbol}").json() == []


@pytest.mark.integration
def test_splits_crud_roundtrip(client: TestClient) -> None:
    symbol = "TEST.SPLITS"
    client.delete(
        f"/v1/splits/{symbol}",
        params={"from": "2010-01-01", "to": "2030-01-01"},
    )
    payload = [
        {
            "symbol": symbol,
            "date": "2020-08-31",
            "numerator": 4,
            "denominator": 1,
            "splitType": "stock-split",
        },
        {
            "symbol": symbol,
            "date": "2014-06-09",
            "numerator": 7,
            "denominator": 1,
            "splitType": "stock-split",
        },
    ]
    put = client.put(f"/v1/splits/{symbol}", json=payload)
    assert put.status_code == 200
    assert put.json()["count"] == 2

    assert client.put(f"/v1/splits/{symbol}", json=payload).status_code == 200

    fetched = client.get(f"/v1/splits/{symbol}")
    assert fetched.status_code == 200
    rows = fetched.json()
    assert [row["date"] for row in rows] == ["2014-06-09", "2020-08-31"]
    assert rows[1]["numerator"] == 4
    assert rows[1]["splitType"] == "stock-split"
    assert "ts" not in rows[0]

    deleted = client.delete(
        f"/v1/splits/{symbol}",
        params={"from": "2020-01-01", "to": "2020-12-31"},
    )
    assert deleted.json()["deleted"] == 1
    remaining = client.get(f"/v1/splits/{symbol}").json()
    assert len(remaining) == 1
    assert remaining[0]["date"] == "2014-06-09"

    client.delete(
        f"/v1/splits/{symbol}",
        params={"from": "2010-01-01", "to": "2030-01-01"},
    )
    assert client.get(f"/v1/splits/{symbol}").json() == []
