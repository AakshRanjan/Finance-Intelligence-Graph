from __future__ import annotations

from datetime import date

import asyncpg
from fmp_sdk import Dividend, Earning, Split


class CorporateActionsRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def upsert_dividends(self, rows: list[Dividend]) -> int:
        if not rows:
            return 0
        records = [
            (
                row.symbol,
                row.date,
                row.record_date,
                row.payment_date,
                row.declaration_date,
                row.adj_dividend,
                row.dividend,
                row.yield_,
                row.frequency,
            )
            for row in rows
        ]
        async with self._pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO dividends (
                    symbol, ts, record_date, payment_date, declaration_date,
                    adj_dividend, dividend, dividend_yield, frequency
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (symbol, ts) DO UPDATE SET
                    record_date = EXCLUDED.record_date,
                    payment_date = EXCLUDED.payment_date,
                    declaration_date = EXCLUDED.declaration_date,
                    adj_dividend = EXCLUDED.adj_dividend,
                    dividend = EXCLUDED.dividend,
                    dividend_yield = EXCLUDED.dividend_yield,
                    frequency = EXCLUDED.frequency
                """,
                records,
            )
        return len(records)

    async def get_dividends(
        self,
        symbol: str,
        from_: date | None,
        to: date | None,
        limit: int,
    ) -> list[Dividend]:
        rows = await self._get_range(
            "dividends",
            """
            SELECT symbol, ts, record_date, payment_date, declaration_date,
                   adj_dividend, dividend, dividend_yield, frequency
            FROM dividends
            """,
            symbol,
            from_,
            to,
            limit,
        )
        return [_dividend_from_row(row) for row in rows]

    async def delete_dividends(self, symbol: str, from_: date, to: date) -> int:
        return await self._delete_range("dividends", symbol, from_, to)

    async def upsert_earnings(self, rows: list[Earning]) -> int:
        if not rows:
            return 0
        records = [
            (
                row.symbol,
                row.date,
                row.eps_actual,
                row.eps_estimated,
                row.revenue_actual,
                row.revenue_estimated,
                row.last_updated,
            )
            for row in rows
        ]
        async with self._pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO earnings (
                    symbol, ts, eps_actual, eps_estimated,
                    revenue_actual, revenue_estimated, last_updated
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (symbol, ts) DO UPDATE SET
                    eps_actual = EXCLUDED.eps_actual,
                    eps_estimated = EXCLUDED.eps_estimated,
                    revenue_actual = EXCLUDED.revenue_actual,
                    revenue_estimated = EXCLUDED.revenue_estimated,
                    last_updated = EXCLUDED.last_updated
                """,
                records,
            )
        return len(records)

    async def get_earnings(
        self,
        symbol: str,
        from_: date | None,
        to: date | None,
        limit: int,
    ) -> list[Earning]:
        rows = await self._get_range(
            "earnings",
            """
            SELECT symbol, ts, eps_actual, eps_estimated,
                   revenue_actual, revenue_estimated, last_updated
            FROM earnings
            """,
            symbol,
            from_,
            to,
            limit,
        )
        return [_earning_from_row(row) for row in rows]

    async def delete_earnings(self, symbol: str, from_: date, to: date) -> int:
        return await self._delete_range("earnings", symbol, from_, to)

    async def upsert_splits(self, rows: list[Split]) -> int:
        if not rows:
            return 0
        records = [
            (
                row.symbol,
                row.date,
                row.numerator,
                row.denominator,
                row.split_type,
            )
            for row in rows
        ]
        async with self._pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO splits (
                    symbol, ts, numerator, denominator, split_type
                )
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (symbol, ts) DO UPDATE SET
                    numerator = EXCLUDED.numerator,
                    denominator = EXCLUDED.denominator,
                    split_type = EXCLUDED.split_type
                """,
                records,
            )
        return len(records)

    async def get_splits(
        self,
        symbol: str,
        from_: date | None,
        to: date | None,
        limit: int,
    ) -> list[Split]:
        rows = await self._get_range(
            "splits",
            """
            SELECT symbol, ts, numerator, denominator, split_type
            FROM splits
            """,
            symbol,
            from_,
            to,
            limit,
        )
        return [_split_from_row(row) for row in rows]

    async def delete_splits(self, symbol: str, from_: date, to: date) -> int:
        return await self._delete_range("splits", symbol, from_, to)

    async def _get_range(
        self,
        table: str,
        select_sql: str,
        symbol: str,
        from_: date | None,
        to: date | None,
        limit: int,
    ) -> list[asyncpg.Record]:
        _assert_table(table)
        clauses = ["symbol = $1"]
        args: list[object] = [symbol]
        if from_ is not None:
            args.append(from_)
            clauses.append(f"ts >= ${len(args)}")
        if to is not None:
            args.append(to)
            clauses.append(f"ts <= ${len(args)}")
        args.append(limit)
        query = f"""
            {select_sql.strip()}
            WHERE {' AND '.join(clauses)}
            ORDER BY ts ASC
            LIMIT ${len(args)}
        """
        async with self._pool.acquire() as conn:
            return await conn.fetch(query, *args)

    async def _delete_range(
        self,
        table: str,
        symbol: str,
        from_: date,
        to: date,
    ) -> int:
        _assert_table(table)
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                f"""
                DELETE FROM {table}
                WHERE symbol = $1 AND ts >= $2 AND ts <= $3
                """,
                symbol,
                from_,
                to,
            )
        return _rowcount(result)


_TABLES = frozenset({"dividends", "earnings", "splits"})


def _assert_table(table: str) -> None:
    if table not in _TABLES:
        raise ValueError(f"unknown table {table}")


def _dividend_from_row(row: asyncpg.Record) -> Dividend:
    payload = dict(row)
    payload["date"] = payload.pop("ts")
    payload["yield"] = payload.pop("dividend_yield")
    return Dividend.model_validate(payload)


def _earning_from_row(row: asyncpg.Record) -> Earning:
    payload = dict(row)
    payload["date"] = payload.pop("ts")
    return Earning.model_validate(payload)


def _split_from_row(row: asyncpg.Record) -> Split:
    payload = dict(row)
    payload["date"] = payload.pop("ts")
    return Split.model_validate(payload)


def _rowcount(status: str) -> int:
    parts = status.split()
    if len(parts) == 2 and parts[1].isdigit():
        return int(parts[1])
    return 0
