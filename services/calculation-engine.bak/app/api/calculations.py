from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field, validator
from typing import Dict
from app.schemas.variable import CalculationInput, CalculationResult, ValidationResult
from app.core.exceptions import TemplateNotFound, CalculationError, ValidationException
from app.core.logging import get_logger
from app.engine.runner import runner
from app.templates.loader import template_manager

router = APIRouter(prefix="/calculations", tags=["calculations"])
logger = get_logger(__name__)


class CalculationRequest(BaseModel):
    template_id: str = Field(..., description="Template ID", min_length=1)
    variables: Dict[str, float] = Field(..., description="Calculation variables")

    @validator('variables')
    def validate_variables_not_empty(cls, v):
        if not v:
            raise ValueError('Variables dictionary cannot be empty')
        return v


@router.post("/calculate", response_model=CalculationResult, responses={
    200: {"description": "Calculation successful"},
    400: {"description": "Validation error"},
    404: {"description": "Template not found"},
    500: {"description": "Internal server error"},
})
async def calculate(request: CalculationRequest):
    """Execute calculation using template

    Parameters:
    - template_id: ID of the template to use
    - variables: Dictionary of variable names and values

    Returns:
    - CalculationResult with output_variables and metadata
    """
    try:
        logger.info(f'Calculating with template: {request.template_id}')

        # Load template
        try:
            template = template_manager.load_template(request.template_id)
        except FileNotFoundError:
            raise TemplateNotFound(request.template_id)

        # Validate template has formulas
        formulas = template.formulas
        if not formulas:
            raise CalculationError(f"Template {request.template_id} has no formulas")

        main_formula = list(formulas.values())[0]

        # Run calculation
        result = runner.run_calculation(
            formula=main_formula,
            variables=request.variables,
            input_definitions=template.inputs,
            output_definitions=template.outputs,
            validation_rules=template.validation_rules
        )

        logger.info(f'Calculation successful: {request.template_id}')
        return result

    except (TemplateNotFound, CalculationError):
        raise
    except ValueError as e:
        logger.warning(f'Validation error: {str(e)}')
        raise CalculationError(str(e))
    except Exception as e:
        logger.error(f'Unexpected error during calculation: {str(e)}', exc_info=True)
        raise


@router.post("/validate", response_model=ValidationResult, responses={
    200: {"description": "Validation complete"},
    404: {"description": "Template not found"},
    500: {"description": "Internal server error"},
})
async def validate_calculation(request: CalculationRequest):
    """Validate calculation inputs without executing

    Parameters:
    - template_id: ID of the template to validate against
    - variables: Dictionary of variable names and values to validate

    Returns:
    - ValidationResult with valid status and any errors
    """
    try:
        logger.info(f'Validating with template: {request.template_id}')

        try:
            template = template_manager.load_template(request.template_id)
        except FileNotFoundError:
            raise TemplateNotFound(request.template_id)

        from app.validators.validation import validate_variables

        is_valid, errors = validate_variables(
            request.variables,
            template.inputs,
            template.validation_rules or {}
        )

        logger.info(f'Validation result: valid={is_valid}')

        return ValidationResult(
            valid=is_valid,
            errors=errors,
            warnings=[]
        )

    except TemplateNotFound:
        raise
    except Exception as e:
        logger.error(f'Unexpected error during validation: {str(e)}', exc_info=True)
        raise
