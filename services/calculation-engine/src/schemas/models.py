"""Pydantic models for calculation API."""
from typing import Any, Optional
from pydantic import BaseModel, Field


class CalcVariable(BaseModel):
    """Calculation variable definition."""

    name: str = Field(..., description="Variable name (e.g., 'pressure')")
    label: str = Field(..., description="Human-readable label")
    description: str = Field(..., description="Detailed description")
    unit: str = Field(..., description="Unit (e.g., 'MPa', 'mm')")
    data_type: str = Field(default="float", description="Data type: float|int|string")
    required: bool = Field(default=True, description="Is required")
    min_value: Optional[float] = Field(None, description="Minimum allowed value")
    max_value: Optional[float] = Field(None, description="Maximum allowed value")
    default_value: Optional[Any] = Field(None, description="Default value")
    choices: Optional[list[str]] = Field(None, description="Valid choices (for categorical)")


class CalcInput(BaseModel):
    """Input value for calculation."""

    name: str = Field(..., description="Variable name")
    value: float | int | str = Field(..., description="Input value")
    unit: Optional[str] = Field(None, description="Override unit for this input")


class CalcTemplate(BaseModel):
    """Calculation template metadata."""

    id: str = Field(..., description="Template ID")
    name: str = Field(..., description="Template name")
    category: str = Field(..., description="Category (e.g., 'pressure', 'stress')")
    description: str = Field(..., description="Template description")
    variables: list[CalcVariable] = Field(..., description="Input variables")
    formula: str = Field(..., description="Calculation formula (SymPy expression)")
    outputs: list[str] = Field(..., description="Output variable names")
    normative_reference: str = Field(default="", description="Standard/code reference")
    tags: list[str] = Field(default_factory=list, description="Classification tags")


class CalculationRequest(BaseModel):
    """Request to perform a calculation."""

    template_id: str = Field(..., description="Template to use")
    inputs: list[CalcInput] = Field(..., description="Input values")
    unit_system: Optional[str] = Field("SI", description="Unit system (SI|US|Mixed)")


class CalculationResult(BaseModel):
    """Result of a calculation."""

    template_id: str = Field(..., description="Template used")
    status: str = Field(..., description="Status: success|error")
    results: dict[str, Any] = Field(default_factory=dict, description="Output values")
    warnings: list[str] = Field(default_factory=list, description="Non-fatal warnings")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Metadata")


class ValidationError(BaseModel):
    """Validation error details."""

    field: str = Field(..., description="Field name")
    error: str = Field(..., description="Error message")
    value: Any = Field(..., description="Invalid value")
