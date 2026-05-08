from fastapi import APIRouter, HTTPException, status
from typing import List
from app.schemas.template import TemplateListItem, Template
from app.templates.loader import template_manager

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=List[TemplateListItem])
async def list_templates():
    """List all available calculation templates"""
    try:
        return template_manager.list_templates()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list templates: {str(e)}"
        )


@router.get("/{template_id}", response_model=Template)
async def get_template(template_id: str):
    """Get specific template definition"""
    try:
        return template_manager.load_template(template_id)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {template_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load template: {str(e)}"
        )
