from fastapi import APIRouter

from historical_data_api.api.v1 import eod, intraday, symbols

router = APIRouter()
router.include_router(symbols.router)
router.include_router(eod.router)
router.include_router(intraday.router)
