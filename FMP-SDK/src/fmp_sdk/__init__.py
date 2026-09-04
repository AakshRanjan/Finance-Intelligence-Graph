from importlib.metadata import PackageNotFoundError, version

from fmp_sdk.FMPSession import FMPSession
from fmp_sdk.chart import (
    Chart,
    HistoricalChartBar,
    HistoricalPriceEodAdjusted,
    HistoricalPriceEodFull,
    HistoricalPriceEodLight,
)
from fmp_sdk.exception import FMPResponseError

try:
    __version__ = version("financialmodelingprep-sdk")
except PackageNotFoundError:
    __version__ = "0.0.0"

__all__ = [
    "Chart",
    "FMPResponseError",
    "FMPSession",
    "HistoricalChartBar",
    "HistoricalPriceEodAdjusted",
    "HistoricalPriceEodFull",
    "HistoricalPriceEodLight",
    "__version__",
]
