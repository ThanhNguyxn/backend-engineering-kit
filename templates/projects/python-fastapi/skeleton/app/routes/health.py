"""Health check routes."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response."""

    status: Literal["ok", "degraded", "unhealthy"]
    timestamp: datetime
    version: str


class ReadyResponse(BaseModel):
    """Readiness check response."""

    ready: bool


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now(),
        version="0.1.0",
    )


@router.get("/ready", response_model=ReadyResponse)
async def ready() -> ReadyResponse:
    """Readiness check endpoint."""
    # Add dependency checks here (database, cache, etc.)
    return ReadyResponse(ready=True)


@router.get("/live")
async def live() -> dict:
    """Liveness check endpoint."""
    return {"alive": True}
