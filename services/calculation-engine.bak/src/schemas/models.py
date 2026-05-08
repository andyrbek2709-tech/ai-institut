"""Pydantic models for calculation API with semantic validation support."""
from typing import Any, Optional, Literal
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
    """Calculation template metadata with semantic validation support."""

    id: str = Field(..., description="Template ID")
    name: str = Field(..., description="Template name")
    category: str = Field(..., description="Category (e.g., 'pressure', 'stress')")
    description: str = Field(..., description="Template description")
    variables: list[CalcVariable] = Field(..., description="Input variables")
    formula: str = Field(..., description="Calculation formula (SymPy expression)")
    outputs: list[str] = Field(..., description="Output variable names")
    normative_reference: str = Field(default="", description="Standard/code reference")
    tags: list[str] = Field(default_factory=list, description="Classification tags")

    # ÉTAP 2: Semantic validation & rules
    engineering_rules: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="Engineering validation rules (type, variable, parameters)"
    )
    semantic_metadata: Optional[dict[str, Any]] = Field(
        default=None,
        description="Formula semantic metadata (discipline, standards, meaning)"
    )
    semantic_constraints: Optional[dict[str, Any]] = Field(
        default=None,
        description="Variable constraints and semantic meanings"
    )
    discipline: Optional[str] = Field(
        default=None,
        description="Engineering discipline (PIPING, STRUCTURAL, THERMAL, etc.)"
    )


class CalculationRequest(BaseModel):
    """Request to perform a calculation."""

    template_id: str = Field(..., description="Template to use")
    inputs: list[CalcInput] = Field(..., description="Input values")
    unit_system: Optional[str] = Field("SI", description="Unit system (SI|US|Mixed)")


class CalculationResult(BaseModel):
    """Result of a calculation with semantic validation support."""

    template_id: str = Field(..., description="Template used")
    status: Literal["success", "error", "warning"] = Field(..., description="Execution status")
    results: dict[str, Any] = Field(default_factory=dict, description="Output values with units")
    warnings: list[str] = Field(default_factory=list, description="Non-fatal warnings")
    validation_notes: list[dict[str, Any]] = Field(default_factory=list, description="Engineering validation notes")

    # ÉTAP 2: Semantic validation & explainability
    validation_results: Optional[list[dict[str, Any]]] = Field(
        default=None,
        description="Detailed validation results (rule name, status, severity, message)"
    )
    explanations: Optional[dict[str, Any]] = Field(
        default=None,
        description="Human-readable explanations (execution, validations, failures)"
    )
    audit_trail: Optional[dict[str, Any]] = Field(
        default=None,
        description="Complete audit trail with events and summary"
    )
    failure_analysis: Optional[dict[str, Any]] = Field(
        default=None,
        description="Failure analysis with root causes and mitigations"
    )

    metadata: dict[str, Any] = Field(default_factory=dict, description="Execution metadata")


class ValidationError(BaseModel):
    """Validation error details."""

    field: str = Field(..., description="Field name")
    error: str = Field(..., description="Error message")
    value: Any = Field(..., description="Invalid value")
