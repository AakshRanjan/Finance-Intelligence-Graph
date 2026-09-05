from __future__ import annotations

import asyncio
import logging
from typing import Annotated

import typer
from fmp_sdk import ChartInterval

from historical_data_ingest.config import get_ingest_settings
from historical_data_ingest.ingest import parse_datasets, parse_symbols, run_ingest

ALLOWED_INTERVALS: tuple[ChartInterval, ...] = (
    "1min",
    "5min",
    "15min",
    "30min",
    "1hour",
    "4hour",
)


def ingest(
    symbols: Annotated[str, typer.Option(help="Comma-separated ticker list")],
    lookback: Annotated[str, typer.Option(help="How far back, e.g. 365d or 2y")],
    chunk_size: Annotated[
        str,
        typer.Option("--chunk-size", help="FMP date window per request, e.g. 30d"),
    ],
    datasets: Annotated[
        str,
        typer.Option(help="Comma-separated: eod, intraday"),
    ] = "eod,intraday",
    interval: Annotated[
        str,
        typer.Option(help="Intraday interval"),
    ] = "1min",
) -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    if interval not in ALLOWED_INTERVALS:
        raise typer.BadParameter(
            f"interval must be one of {', '.join(ALLOWED_INTERVALS)}",
            param_hint="--interval",
        )
    settings = get_ingest_settings()
    asyncio.run(
        run_ingest(
            settings,
            parse_symbols(symbols),
            lookback,
            chunk_size,
            parse_datasets(datasets),
            interval,  # type: ignore[arg-type]
        )
    )


def app() -> None:
    typer.run(ingest)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
