from __future__ import annotations

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from historical_data_ingest.chunking import parse_duration
from historical_data_ingest.ingest import (
    ALLOWED_INTERVALS,
    SymbolJob,
    normalize_symbol,
    parse_dataset_list,
)


def parse_intervals(value: str | list[str]) -> list[str]:
    items = [value] if isinstance(value, str) else list(value)
    parsed: list[str] = []
    for item in items:
        if not isinstance(item, str):
            raise ValueError("interval values must be strings")
        interval = item.strip()
        if interval not in ALLOWED_INTERVALS:
            raise ValueError(
                f"interval must be one of {', '.join(ALLOWED_INTERVALS)}"
            )
        parsed.append(interval)
    if not parsed:
        raise ValueError("at least one interval is required")
    return list(dict.fromkeys(parsed))


class SymbolJobConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lookback: str
    chunk_size: str
    datasets: list[str]
    interval: list[str]

    @field_validator("lookback", "chunk_size")
    @classmethod
    def _duration(cls, value: str) -> str:
        parse_duration(value)
        return value.strip()

    @field_validator("datasets")
    @classmethod
    def _datasets(cls, value: list[str]) -> list[str]:
        return parse_dataset_list(value)

    @field_validator("interval", mode="before")
    @classmethod
    def _interval(cls, value: object) -> list[str]:
        if isinstance(value, str):
            return parse_intervals(value)
        if isinstance(value, list):
            return parse_intervals(value)
        raise ValueError("interval must be a string or list of strings")


class SymbolJobOverlay(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lookback: str | None = None
    chunk_size: str | None = None
    datasets: list[str] | None = None
    interval: list[str] | None = None

    @field_validator("lookback", "chunk_size")
    @classmethod
    def _duration(cls, value: str | None) -> str | None:
        if value is None:
            return None
        parse_duration(value)
        return value.strip()

    @field_validator("datasets")
    @classmethod
    def _datasets(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return parse_dataset_list(value)

    @field_validator("interval", mode="before")
    @classmethod
    def _interval(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        if isinstance(value, str):
            return parse_intervals(value)
        if isinstance(value, list):
            return parse_intervals(value)
        raise ValueError("interval must be a string or list of strings")


class IngestYamlConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    num_api_calls_per_min: int = Field(gt=0)
    num_local_api_calls_per_min: int = Field(gt=0)
    default: SymbolJobConfig
    symbols: dict[str, SymbolJobOverlay | None]

    @model_validator(mode="after")
    def _symbols_present(self) -> IngestYamlConfig:
        if not self.symbols:
            raise ValueError("at least one symbol is required")
        return self


def load_ingest_yaml(path: Path) -> IngestYamlConfig:
    if not path.is_file():
        raise FileNotFoundError(f"config file not found: {path}")
    try:
        raw = yaml.safe_load(path.read_text())
    except yaml.YAMLError as exc:
        raise ValueError(f"invalid YAML in {path}: {exc}") from exc
    if not isinstance(raw, dict):
        raise ValueError(f"invalid YAML in {path}: expected a mapping")
    try:
        return IngestYamlConfig.model_validate(raw)
    except ValidationError as exc:
        raise ValueError(f"invalid ingest config {path}: {exc}") from exc


def resolved_jobs(config: IngestYamlConfig) -> list[SymbolJob]:
    jobs: list[SymbolJob] = []
    seen: set[tuple[str, str]] = set()
    for raw_symbol, overlay in config.symbols.items():
        symbol = normalize_symbol(raw_symbol)
        overlay = overlay or SymbolJobOverlay()
        lookback = overlay.lookback or config.default.lookback
        chunk_size = overlay.chunk_size or config.default.chunk_size
        datasets = (
            overlay.datasets
            if overlay.datasets is not None
            else config.default.datasets
        )
        intervals = (
            overlay.interval
            if overlay.interval is not None
            else config.default.interval
        )
        for index, interval in enumerate(intervals):
            key = (symbol, interval)
            if key in seen:
                raise ValueError(f"duplicate symbol {symbol} interval {interval}")
            seen.add(key)
            job_datasets = datasets
            if index > 0:
                job_datasets = [item for item in datasets if item == "intraday"]
                if not job_datasets:
                    continue
            jobs.append(
                SymbolJob(
                    symbol=symbol,
                    lookback=lookback,
                    chunk_size=chunk_size,
                    datasets=job_datasets,
                    interval=interval,  # type: ignore[arg-type]
                )
            )
    return jobs
