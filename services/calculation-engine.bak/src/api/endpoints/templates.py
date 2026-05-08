"""Templates API endpoints."""
from fastapi import APIRouter, HTTPException
from src.core.container import get_template_registry

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("")
async def list_templates():
    """List all available templates."""
    registry = get_template_registry()
    templates = registry.list_all()
    return {
        "count": len(templates),
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "description": t.description,
                "tags": t.tags,
            }
            for t in templates
        ],
    }


@router.get("/categories")
async def list_categories():
    """List all template categories."""
    registry = get_template_registry()
    categories = registry.list_categories()
    return {
        "categories": [
            {
                "name": cat,
                "count": len(registry.list_by_category(cat)),
            }
            for cat in categories
        ]
    }


@router.get("/{template_id}")
async def get_template(template_id: str):
    """Get template details."""
    registry = get_template_registry()
    template = registry.get(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return {
        "id": template.id,
        "name": template.name,
        "category": template.category,
        "description": template.description,
        "variables": [
            {
                "name": v.name,
                "label": v.label,
                "description": v.description,
                "unit": v.unit,
                "data_type": v.data_type,
                "required": v.required,
                "min_value": v.min_value,
                "max_value": v.max_value,
                "choices": v.choices,
            }
            for v in template.variables
        ],
        "formula": template.formula,
        "outputs": template.outputs,
        "normative_reference": template.normative_reference,
        "tags": template.tags,
    }
