from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List


class VariableDefinition(BaseModel):
    name: str = Field(..., description="Variable name", min_length=1)
    description: str = Field(..., description="Human-readable description", min_length=1)
    unit: str = Field(..., description="Unit (e.g., 'MPa', 'm', 'kg')", min_length=1)
    type: str = Field(default="float", description="Data type (float, int, string)")
    min_value: Optional[float] = Field(None, description="Minimum allowed value")
    max_value: Optional[float] = Field(None, description="Maximum allowed value")
    required: bool = Field(default=True, description="Whether this variable is required")
    default_value: Optional[float] = Field(None, description="Default value if not provided")

    @validator('type')
    def validate_type(cls, v):
        allowed_types = ['float', 'int', 'string', 'bool']
        if v not in allowed_types:
            raise ValueError(f'Type must be one of {allowed_types}')
        return v


class CalculationInput(BaseModel):
    variables: Dict[str, float] = Field(..., description="Variable values")

    @validator('variables')
    def validate_variables(cls, v):
        if not v:
            raise ValueError('Variables cannot be empty')
        return v


class ValidationWarning(BaseModel):
    field: str = Field(..., description="Field name")
    message: str = Field(..., description="Warning message")
    severity: str = Field(default='info', description="Severity level (info, warning, error)")


class CalculationResult(BaseModel):
    output_variables: Dict[str, float] = Field(..., description="Calculated output variables")
    intermediate_results: Optional[Dict[str, Any]] = Field(None, description="Intermediate calculation results")
    warnings: List[ValidationWarning] = Field(default=[], description="List of warnings")
    execution_time_ms: float = Field(..., ge=0, description="Execution time in milliseconds")

    class Config:
        schema_extra = {
            'example': {
                'output_variables': {'hoop_stress': 125.5, 'safety_factor': 3.58},
                'intermediate_results': None,
                'warnings': [],
                'execution_time_ms': 12.5,
            }
        }


class ValidationResult(BaseModel):
    valid: bool = Field(..., description="Whether validation passed")
    errors: Dict[str, List[str]] = Field(default_factory=dict, description="Validation errors by field")
    warnings: List[ValidationWarning] = Field(default=[], description="Validation warnings")
