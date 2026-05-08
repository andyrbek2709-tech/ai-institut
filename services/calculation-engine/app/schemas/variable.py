from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class VariableDefinition(BaseModel):
    name: str = Field(..., description="Variable name")
    description: str = Field(..., description="Human-readable description")
    unit: str = Field(..., description="Unit (e.g., 'MPa', 'm', 'kg')")
    type: str = Field(default="float", description="Data type (float, int, string)")
    min_value: Optional[float] = Field(None, description="Minimum allowed value")
    max_value: Optional[float] = Field(None, description="Maximum allowed value")
    required: bool = Field(default=True)
    default_value: Optional[Any] = Field(None)


class CalculationInput(BaseModel):
    variables: Dict[str, float] = Field(..., description="Variable values")


class CalculationResult(BaseModel):
    output_variables: Dict[str, float]
    intermediate_results: Optional[Dict[str, Any]] = None
    warnings: list = []
    execution_time_ms: float
