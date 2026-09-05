from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import asyncpg
from fmp_sdk import ChartInterval
from fmp_sdk.modified import EodBar, EodBarPatch, IntradayBar, IntradayBarPatch

from historical_data_api.schemas.results import SymbolInfo


class RowNotFoundError(LookupError):
    def __init__(self, symbol: str, ts: date | datetime) -> None:
        self.symbol = symbol
        self.ts = ts
        super().__init__(f"no row for {symbol} at {ts}")


class BarRepository:
    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def ping(self) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute("SELECT 1")

    async def list_symbols(self) -> list[SymbolInfo]:
        query = """
            WITH eod AS (
                SELECT DISTINCT symbol FROM eod_bars
            ),
            intraday AS (
                SELECT symbol, array_agg(DISTINCT interval ORDER BY interval) AS intervals
                FROM intraday_bars
                GROUP BY symbol
            )
            SELECT
                COALESCE(e.symbol, i.symbol) AS symbol,
                e.symbol IS NOT NULL AS eod,
                COALESCE(i.intervals, ARRAY[]::text[]) AS intervals
            FROM eod e
            FULL OUTER JOIN intraday i ON e.symbol = i.symbol
            ORDER BY 1
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query)
        return [
            SymbolInfo(
                symbol=row["symbol"],
                eod=bool(row["eod"]),
                intraday_intervals=list(row["intervals"] or []),
            )
            for row in rows
        ]

    async def upsert_eod(self, bars: list[EodBar]) -> int:
        if not bars:
            return 0
        records = [
            (
                bar.symbol,
                bar.date,
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume,
                bar.change,
                bar.change_percent,
                bar.vwap,
            )
            for bar in bars
        ]
        async with self._pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO eod_bars (
                    symbol, ts, open, high, low, close, volume,
                    change, change_percent, vwap
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (symbol, ts) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume,
                    change = EXCLUDED.change,
                    change_percent = EXCLUDED.change_percent,
                    vwap = EXCLUDED.vwap
                """,
                records,
            )
        return len(records)

    async def get_eod(
        self,
        symbol: str,
        from_: date | None,
        to: date | None,
        limit: int,
    ) -> list[EodBar]:
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
            SELECT symbol, ts, open, high, low, close, volume,
                   change, change_percent, vwap
            FROM eod_bars
            WHERE {' AND '.join(clauses)}
            ORDER BY ts ASC
            LIMIT ${len(args)}
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        return [_eod_from_row(row) for row in rows]

    async def patch_eod(self, symbol: str, patches: list[EodBarPatch]) -> int:
        if not patches:
            return 0
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                for patch in patches:
                    assignments, values = _assignments(patch)
                    if not assignments:
                        exists = await conn.fetchval(
                            "SELECT 1 FROM eod_bars WHERE symbol = $1 AND ts = $2",
                            symbol,
                            patch.date,
                        )
                        if exists is None:
                            raise RowNotFoundError(symbol, patch.date)
                        continue
                    values.extend([symbol, patch.date])
                    symbol_idx = len(values) - 1
                    ts_idx = len(values)
                    result = await conn.execute(
                        f"""
                        UPDATE eod_bars
                        SET {", ".join(assignments)}
                        WHERE symbol = ${symbol_idx} AND ts = ${ts_idx}
                        """,
                        *values,
                    )
                    if result == "UPDATE 0":
                        raise RowNotFoundError(symbol, patch.date)
        return len(patches)

    async def eod_coverage(self, symbol: str, from_: date, to: date) -> list[date]:
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT ts
                FROM eod_bars
                WHERE symbol = $1 AND ts >= $2 AND ts <= $3
                ORDER BY ts
                """,
                symbol,
                from_,
                to,
            )
        return [row["ts"] for row in rows]

    async def delete_eod(self, symbol: str, from_: date, to: date) -> int:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                """
                DELETE FROM eod_bars
                WHERE symbol = $1 AND ts >= $2 AND ts <= $3
                """,
                symbol,
                from_,
                to,
            )
        return _rowcount(result)

    async def upsert_intraday(self, bars: list[IntradayBar]) -> int:
        if not bars:
            return 0
        records = [
            (
                bar.symbol,
                bar.interval,
                bar.date,
                bar.open,
                bar.high,
                bar.low,
                bar.close,
                bar.volume,
            )
            for bar in bars
        ]
        async with self._pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO intraday_bars (
                    symbol, interval, ts, open, high, low, close, volume
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (symbol, interval, ts) DO UPDATE SET
                    open = EXCLUDED.open,
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    close = EXCLUDED.close,
                    volume = EXCLUDED.volume
                """,
                records,
            )
        return len(records)

    async def get_intraday(
        self,
        symbol: str,
        interval: ChartInterval,
        from_: datetime | None,
        to: datetime | None,
        limit: int,
    ) -> list[IntradayBar]:
        clauses = ["symbol = $1", "interval = $2"]
        args: list[object] = [symbol, interval]
        if from_ is not None:
            args.append(from_)
            clauses.append(f"ts >= ${len(args)}")
        if to is not None:
            args.append(to)
            clauses.append(f"ts <= ${len(args)}")
        args.append(limit)
        query = f"""
            SELECT symbol, interval, ts, open, high, low, close, volume
            FROM intraday_bars
            WHERE {' AND '.join(clauses)}
            ORDER BY ts ASC
            LIMIT ${len(args)}
        """
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
        return [_intraday_from_row(row) for row in rows]

    async def patch_intraday(
        self,
        symbol: str,
        interval: ChartInterval,
        patches: list[IntradayBarPatch],
    ) -> int:
        if not patches:
            return 0
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                for patch in patches:
                    assignments, values = _assignments(patch)
                    if not assignments:
                        exists = await conn.fetchval(
                            """
                            SELECT 1 FROM intraday_bars
                            WHERE symbol = $1 AND interval = $2 AND ts = $3
                            """,
                            symbol,
                            interval,
                            patch.date,
                        )
                        if exists is None:
                            raise RowNotFoundError(symbol, patch.date)
                        continue
                    values.extend([symbol, interval, patch.date])
                    n = len(values)
                    result = await conn.execute(
                        f"""
                        UPDATE intraday_bars
                        SET {", ".join(assignments)}
                        WHERE symbol = ${n - 2} AND interval = ${n - 1} AND ts = ${n}
                        """,
                        *values,
                    )
                    if result == "UPDATE 0":
                        raise RowNotFoundError(symbol, patch.date)
        return len(patches)

    async def intraday_coverage(
        self,
        symbol: str,
        interval: ChartInterval,
        from_: date,
        to: date,
    ) -> list[date]:
        start = datetime(from_.year, from_.month, from_.day, tzinfo=timezone.utc)
        end_exclusive = datetime(
            to.year, to.month, to.day, tzinfo=timezone.utc
        ) + timedelta(days=1)
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT DISTINCT (ts AT TIME ZONE 'UTC')::date AS day
                FROM intraday_bars
                WHERE symbol = $1 AND interval = $2 AND ts >= $3 AND ts < $4
                ORDER BY 1
                """,
                symbol,
                interval,
                start,
                end_exclusive,
            )
        return [row["day"] for row in rows]

    async def delete_intraday(
        self,
        symbol: str,
        interval: ChartInterval,
        from_: datetime,
        to: datetime,
    ) -> int:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                """
                DELETE FROM intraday_bars
                WHERE symbol = $1 AND interval = $2 AND ts >= $3 AND ts <= $4
                """,
                symbol,
                interval,
                from_,
                to,
            )
        return _rowcount(result)


def _eod_from_row(row: asyncpg.Record) -> EodBar:
    payload = dict(row)
    payload["date"] = payload.pop("ts")
    return EodBar.model_validate(payload)


def _intraday_from_row(row: asyncpg.Record) -> IntradayBar:
    payload = dict(row)
    payload["date"] = payload.pop("ts")
    return IntradayBar.model_validate(payload)


def _assignments(patch: EodBarPatch | IntradayBarPatch) -> tuple[list[str], list[object]]:
    assignments: list[str] = []
    values: list[object] = []
    for field, value in patch.model_dump(exclude={"date"}, exclude_unset=True).items():
        if value is None:
            continue
        values.append(value)
        assignments.append(f"{field} = ${len(values)}")
    return assignments, values


def _rowcount(status: str) -> int:
    parts = status.split()
    if len(parts) == 2 and parts[1].isdigit():
        return int(parts[1])
    return 0
