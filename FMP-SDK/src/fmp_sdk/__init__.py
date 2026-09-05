from importlib.metadata import PackageNotFoundError, version

from fmp_sdk.FMPSession import FMPSession
from fmp_sdk.chart import (
    Chart,
    ChartInterval,
    HistoricalChartBar,
    HistoricalPriceEodAdjusted,
    HistoricalPriceEodFull,
    HistoricalPriceEodLight,
)
from fmp_sdk.corporate_actions import CorporateActions, Dividend, Earning, Split
from fmp_sdk.exception import FMPResponseError

try:
    __version__ = version("financialmodelingprep-sdk")
except PackageNotFoundError:
    __version__ = "0.0.0"

__all__ = [
    "Chart",
    "ChartInterval",
    "CorporateActions",
    "Dividend",
    "Earning",
    "FMPResponseError",
    "FMPSession",
    "HistoricalChartBar",
    "HistoricalPriceEodAdjusted",
    "HistoricalPriceEodFull",
    "HistoricalPriceEodLight",
    "Split",
    "__version__",
]
