from __future__ import annotations

from pathlib import Path

import pytest

from historical_data_ingest.yaml_config import load_ingest_yaml, resolved_jobs

_SAMPLE = Path(__file__).resolve().parents[1] / "config.yaml.sample"

_DEFAULT = """
num_api_calls_per_min: 300
num_local_api_calls_per_min: 600
default:
  lookback: 30d
  chunk_size: 7d
  datasets:
    - eod
    - intraday
  interval: 1min
symbols:
  AAPL:
    lookback: 2y
  MSFT:
  GOOG:
    datasets:
      - eod
      - dividends
"""


def _write(tmp_path: Path, text: str, name: str = "config.yaml") -> Path:
    path = tmp_path / name
    path.write_text(text)
    return path


def test_sample_config_loads() -> None:
    config = load_ingest_yaml(_SAMPLE)
    jobs = {job.symbol: job for job in resolved_jobs(config)}
    assert config.num_api_calls_per_min == 300
    assert config.num_local_api_calls_per_min == 600
    assert jobs["AAPL"].lookback == "2y"
    assert jobs["AAPL"].datasets == [
        "eod",
        "intraday",
        "dividends",
        "earnings",
        "splits",
    ]
    assert jobs["MSFT"].lookback == "30d"
    assert jobs["GOOG"].datasets == ["eod", "dividends"]
    assert jobs["GOOG"].interval == "1min"


def test_empty_overlay_equals_default(tmp_path: Path) -> None:
    path = _write(tmp_path, _DEFAULT)
    jobs = {job.symbol: job for job in resolved_jobs(load_ingest_yaml(path))}
    assert jobs["MSFT"].lookback == "30d"
    assert jobs["MSFT"].chunk_size == "7d"
    assert jobs["MSFT"].datasets == ["eod", "intraday"]
    assert jobs["MSFT"].interval == "1min"


def test_partial_overlay_keeps_default_fields(tmp_path: Path) -> None:
    path = _write(tmp_path, _DEFAULT)
    jobs = {job.symbol: job for job in resolved_jobs(load_ingest_yaml(path))}
    assert jobs["AAPL"].lookback == "2y"
    assert jobs["AAPL"].chunk_size == "7d"
    assert jobs["AAPL"].datasets == ["eod", "intraday"]
    assert jobs["GOOG"].lookback == "30d"
    assert jobs["GOOG"].datasets == ["eod", "dividends"]


def test_unknown_dataset_fails_validation(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        """
num_api_calls_per_min: 10
num_local_api_calls_per_min: 600
default:
  lookback: 30d
  chunk_size: 7d
  datasets: [foo]
  interval: 1min
symbols:
  AAPL:
""",
    )
    with pytest.raises(ValueError, match="unknown datasets"):
        load_ingest_yaml(path)


def test_unknown_interval_fails_validation(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        """
num_api_calls_per_min: 10
num_local_api_calls_per_min: 600
default:
  lookback: 30d
  chunk_size: 7d
  datasets: [eod]
  interval: 2min
symbols:
  AAPL:
""",
    )
    with pytest.raises(ValueError, match="interval must be one of"):
        load_ingest_yaml(path)


def test_zero_rate_limit_fails_validation(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        """
num_api_calls_per_min: 0
num_local_api_calls_per_min: 600
default:
  lookback: 30d
  chunk_size: 7d
  datasets: [eod]
  interval: 1min
symbols:
  AAPL:
""",
    )
    with pytest.raises(ValueError, match="num_api_calls_per_min"):
        load_ingest_yaml(path)


def test_zero_local_rate_limit_fails_validation(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        """
num_api_calls_per_min: 10
num_local_api_calls_per_min: 0
default:
  lookback: 30d
  chunk_size: 7d
  datasets: [eod]
  interval: 1min
symbols:
  AAPL:
""",
    )
    with pytest.raises(ValueError, match="num_local_api_calls_per_min"):
        load_ingest_yaml(path)


def test_missing_config_file(tmp_path: Path) -> None:
    missing = tmp_path / "missing.yaml"
    with pytest.raises(FileNotFoundError, match="config file not found"):
        load_ingest_yaml(missing)


def test_invalid_yaml(tmp_path: Path) -> None:
    path = _write(tmp_path, ":\n  - not yaml")
    with pytest.raises(ValueError, match="invalid YAML"):
        load_ingest_yaml(path)


def test_interval_list_expands_intraday_jobs(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        """
num_api_calls_per_min: 200
num_local_api_calls_per_min: 600
default:
  lookback: 1y
  chunk_size: 7d
  datasets:
    - eod
    - intraday
    - dividends
  interval:
    - 5min
    - 15min
    - 1hour
symbols:
  AAPL:
""",
    )
    jobs = resolved_jobs(load_ingest_yaml(path))
    assert [(job.symbol, job.interval, job.datasets) for job in jobs] == [
        ("AAPL", "5min", ["eod", "intraday", "dividends"]),
        ("AAPL", "15min", ["intraday"]),
        ("AAPL", "1hour", ["intraday"]),
    ]

