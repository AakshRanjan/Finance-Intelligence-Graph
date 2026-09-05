"""create eod_bars and intraday_bars hypertables

Revision ID: 0001_create_bars
Revises:
Create Date: 2026-09-03
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0001_create_bars"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
    op.execute(
        """
        CREATE TABLE eod_bars (
            symbol TEXT NOT NULL,
            ts DATE NOT NULL,
            open DOUBLE PRECISION NOT NULL,
            high DOUBLE PRECISION NOT NULL,
            low DOUBLE PRECISION NOT NULL,
            close DOUBLE PRECISION NOT NULL,
            volume DOUBLE PRECISION NOT NULL,
            change DOUBLE PRECISION,
            change_percent DOUBLE PRECISION,
            vwap DOUBLE PRECISION,
            PRIMARY KEY (symbol, ts)
        )
        """
    )
    op.execute("SELECT create_hypertable('eod_bars', 'ts', if_not_exists => TRUE)")
    op.execute(
        "CREATE INDEX ix_eod_bars_symbol_ts ON eod_bars (symbol, ts DESC)"
    )
    op.execute(
        """
        CREATE TABLE intraday_bars (
            symbol TEXT NOT NULL,
            interval TEXT NOT NULL,
            ts TIMESTAMPTZ NOT NULL,
            open DOUBLE PRECISION NOT NULL,
            high DOUBLE PRECISION NOT NULL,
            low DOUBLE PRECISION NOT NULL,
            close DOUBLE PRECISION NOT NULL,
            volume DOUBLE PRECISION NOT NULL,
            PRIMARY KEY (symbol, interval, ts)
        )
        """
    )
    op.execute(
        "SELECT create_hypertable('intraday_bars', 'ts', if_not_exists => TRUE)"
    )
    op.execute(
        """
        CREATE INDEX ix_intraday_bars_symbol_interval_ts
        ON intraday_bars (symbol, interval, ts DESC)
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS intraday_bars")
    op.execute("DROP TABLE IF EXISTS eod_bars")
