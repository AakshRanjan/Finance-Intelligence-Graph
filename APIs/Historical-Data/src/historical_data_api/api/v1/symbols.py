from fastapi import APIRouter, Depends

from historical_data_api.api.deps import get_repository
from historical_data_api.schemas.results import SymbolCatalog
from historical_data_api.services.bars import BarRepository

router = APIRouter(tags=["symbols"])


@router.get("/symbols", response_model=SymbolCatalog)
async def list_symbols(
    repo: BarRepository = Depends(get_repository),
) -> SymbolCatalog:
    return SymbolCatalog(items=await repo.list_symbols())
