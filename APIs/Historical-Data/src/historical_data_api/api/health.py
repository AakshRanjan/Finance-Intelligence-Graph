from fastapi import APIRouter, Depends

from historical_data_api.api.deps import get_repository
from historical_data_api.schemas.results import HealthResponse
from historical_data_api.services.bars import BarRepository

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(repo: BarRepository = Depends(get_repository)) -> HealthResponse:
    await repo.ping()
    return HealthResponse()
