from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class FMPBaseModel(BaseModel):
    """Shared pydantic config for FMP JSON payloads."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")
