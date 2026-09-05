from fastapi import APIRouter

from historical_data_api.api.v1 import dividends, earnings, eod, intraday, splits, symbols

router = APIRouter()
router.include_router(symbols.router)
router.include_router(eod.router)
router.include_router(intraday.router)
router.include_router(dividends.router)
router.include_router(earnings.router)
router.include_router(splits.router)
