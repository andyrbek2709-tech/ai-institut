"""Calculations API endpoints."""
from fastapi import APIRouter, HTTPException
from src.schemas import CalculationRequest
from src.core.container import get_template_registry, get_runner

router = APIRouter(prefix="/calculate", tags=["calculations"])


@router.post("")
async def calculate(request: CalculationRequest):
    """
    Execute a calculation.

    Args:
        request: CalculationRequest with template_id and inputs

    Returns:
        CalculationResult
    """
    registry = get_template_registry()
    runner = get_runner()

    # Get template
    template = registry.get(request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Run calculation
    result = runner.run(template, request.inputs)

    return result.model_dump()


@router.post("/validate")
async def validate(request: CalculationRequest):
    """
    Validate inputs without executing calculation.

    Args:
        request: CalculationRequest with template_id and inputs

    Returns:
        Validation result
    """
    registry = get_template_registry()

    # Get template
    template = registry.get(request.template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Validate inputs
    from src.engine.validator import Validator

    validator = Validator()
    input_dict = {inp.name: inp.value for inp in request.inputs}
    validation = validator.validate_inputs(template.variables, input_dict)

    return {
        "valid": validation["valid"],
        "errors": validation["errors"],
        "warnings": validation["warnings"],
    }
