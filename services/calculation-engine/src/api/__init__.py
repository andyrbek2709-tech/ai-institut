"""API routers and endpoints."""
from fastapi import APIRouter
from .endpoints import templates, calculations

router = APIRouter(prefix="/api/v1")
router.include_router(templates.router)
router.include_router(calculations.router)
