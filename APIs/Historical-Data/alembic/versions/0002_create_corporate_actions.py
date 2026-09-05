"""create dividends, earnings, and splits hypertables

Revision ID: 0002_create_corporate_actions
Revises: 0001_create_bars
Create Date: 2026-09-05
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0002_create_corporate_actions"
down_revision: Union[str, None] = "0001_create_bars"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE dividends (
            symbol TEXT NOT NULL,
            ts DATE NOT NULL,
            record_date DATE,
            payment_date DATE,
            declaration_date DATE,
            adj_dividend DOUBLE PRECISION NOT NULL,
            dividend DOUBLE PRECISION NOT NULL,
            dividend_yield DOUBLE PRECISION NOT NULL,
            frequency TEXT NOT NULL,
            PRIMARY KEY (symbol, ts)
        )
        """
    )
    op.execute(
        """
        SELECT create_hypertable(
            'dividends',
            'ts',
            chunk_time_interval => INTERVAL '5 years',
            if_not_exists => TRUE
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_dividends_symbol_ts ON dividends (symbol, ts DESC)"
    )
    op.execute(
        """
        CREATE TABLE earnings (
            symbol TEXT NOT NULL,
            ts DATE NOT NULL,
            eps_actual DOUBLE PRECISION,
            eps_estimated DOUBLE PRECISION,
            revenue_actual DOUBLE PRECISION,
            revenue_estimated DOUBLE PRECISION,
            last_updated DATE NOT NULL,
            PRIMARY KEY (symbol, ts)
        )
        """
    )
    op.execute(
        """
        SELECT create_hypertable(
            'earnings',
            'ts',
            chunk_time_interval => INTERVAL '5 years',
            if_not_exists => TRUE
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_earnings_symbol_ts ON earnings (symbol, ts DESC)"
    )
    op.execute(
        """
        CREATE TABLE splits (
            symbol TEXT NOT NULL,
            ts DATE NOT NULL,
            numerator INTEGER NOT NULL,
            denominator INTEGER NOT NULL,
            split_type TEXT NOT NULL,
            PRIMARY KEY (symbol, ts)
        )
        """
    )
    op.execute(
        """
        SELECT create_hypertable(
            'splits',
            'ts',
            chunk_time_interval => INTERVAL '5 years',
            if_not_exists => TRUE
        )
        """
    )
    op.execute(
        "CREATE INDEX ix_splits_symbol_ts ON splits (symbol, ts DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS splits")
    op.execute("DROP TABLE IF EXISTS earnings")
    op.execute("DROP TABLE IF EXISTS dividends")
