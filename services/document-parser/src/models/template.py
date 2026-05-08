"""Calculation template models."""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional

from .formula import ExtractedFormula, ExtractedVariable
from .document import NormativeReference


class ReviewStatus(str, Enum):
    """Template review status."""

    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class TemplateVariable:
    """Variable in a calculation template."""

    variable_id: str
    name: str
    label: str
    description: str
    unit: str
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    default_value: Optional[float] = None
    is_input: bool = True


@dataclass
class TemplateFormula:
    """Formula in a calculation template."""

    formula_id: str
    name: str
    description: str
    expression: str  # SymPy-compatible
    latex: Optional[str] = None
    variables: List[TemplateVariable] = field(default_factory=list)
    source_reference: Optional[str] = None  # reference to ExtractedFormula


@dataclass
class ExtractionTemplate:
    """Calculation template derived from document extraction."""

    template_id: str
    name: str
    description: str
    source_document_id: str
    source_document_code: str
    formulas: List[TemplateFormula] = field(default_factory=list)
    variables: List[TemplateVariable] = field(default_factory=list)
    normative_references: List[NormativeReference] = field(default_factory=list)
    review_status: ReviewStatus = ReviewStatus.DRAFT
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    review_timestamp: Optional[str] = None
    created_timestamp: str = ""
    created_by: str = "system"
    version: str = "0.1.0"
    tags: List[str] = field(default_factory=list)
