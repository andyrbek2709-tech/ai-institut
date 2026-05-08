from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Optional
from app.schemas.variable import CalculationInput, CalculationResult
from app.engine.runner import runner
from app.templates.loader import template_manager

router = APIRouter(prefix="/calculations", tags=["calculations"])


class CalculationRequest(BaseModel):
    template_id: str
    variables: Dict[str, float]


@router.post("/calculate", response_model=CalculationResult)
async def calculate(request: CalculationRequest):
    """Execute calculation using template"""
    try:
        # Load template
        template = template_manager.load_template(request.template_id)

        # Get main formula (first formula in template)
        formulas = template.formulas
        if not formulas:
            raise ValueError("Template has no formulas")

        main_formula = list(formulas.values())[0]

        # Run calculation
        result = runner.run_calculation(
            formula=main_formula,
            variables=request.variables,
            input_definitions=template.inputs,
            output_definitions=template.outputs,
            validation_rules=template.validation_rules
        )

        return result

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {request.template_id}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Calculation failed: {str(e)}"
        )


@router.post("/validate")
async def validate_calculation(request: CalculationRequest):
    """Validate calculation inputs without executing"""
    try:
        template = template_manager.load_template(request.template_id)

        from app.validators.validation import validate_variables

        is_valid, errors = validate_variables(
            request.variables,
            template.inputs,
            template.validation_rules or {}
        )

        return {
            "valid": is_valid,
            "errors": errors
        }

    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template not found: {request.template_id}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
