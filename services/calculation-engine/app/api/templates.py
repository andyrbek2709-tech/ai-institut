from fastapi import APIRouter, Path
from typing import List
from app.schemas.template import TemplateListItem, Template
from app.core.exceptions import TemplateNotFound
from app.core.logging import get_logger
from app.templates.loader import template_manager

router = APIRouter(prefix="/templates", tags=["templates"])
logger = get_logger(__name__)


@router.get("/", response_model=List[TemplateListItem], responses={
    200: {"description": "List of available templates"},
    500: {"description": "Internal server error"},
})
async def list_templates():
    """List all available calculation templates

    Returns:
    - List of TemplateListItem objects with basic template information
    """
    try:
        templates = template_manager.list_templates()
        logger.info(f'Listed {len(templates)} templates')
        return templates
    except Exception as e:
        logger.error(f'Failed to list templates: {str(e)}', exc_info=True)
        raise


@router.get("/{template_id}", response_model=Template, responses={
    200: {"description": "Template definition"},
    404: {"description": "Template not found"},
    500: {"description": "Internal server error"},
})
async def get_template(template_id: str = Path(..., min_length=1, description="Template identifier")):
    """Get specific template definition

    Parameters:
    - template_id: The ID of the template to retrieve

    Returns:
    - Complete Template object with metadata, inputs, outputs, and formulas
    """
    try:
        logger.info(f'Loading template: {template_id}')
        template = template_manager.load_template(template_id)
        logger.info(f'Template loaded successfully: {template_id}')
        return template
    except FileNotFoundError:
        logger.warning(f'Template not found: {template_id}')
        raise TemplateNotFound(template_id)
    except Exception as e:
        logger.error(f'Failed to load template {template_id}: {str(e)}', exc_info=True)
        raise
