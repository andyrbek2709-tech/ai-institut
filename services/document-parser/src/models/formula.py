"""Formula and variable extraction models."""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ExtractedVariable:
    """Variable identified in a formula."""

    variable_id: str
    name: str  # e.g., "Q", "T1", "ΔT"
    latex: Optional[str] = None  # e.g., "\\Delta T"
    subscript: Optional[str] = None
    superscript: Optional[str] = None
    description: Optional[str] = None
    symbol_definition: Optional[str] = None  # where in document it's defined


@dataclass
class ExtractedUnit:
    """Unit extracted for a variable."""

    unit_id: str
    variable_id: str
    unit_text: str  # e.g., "м³/с" or "m3/s"
    pint_representation: Optional[str] = None  # e.g., "meter**3 / second"
    unit_type: Optional[str] = None  # volume, time, temperature, etc.
    is_si: bool = False
    conversion_notes: Optional[str] = None


@dataclass
class ExtractedFormula:
    """Formula extracted from document."""

    formula_id: str  # SHA256(doc_id + raw_text + page)
    document_id: str
    raw_text: str  # verbatim from source: "Q = k * A * (T1 - T2) / d"
    symbolic_expression: str  # SymPy-parseable: "Q = k*A*(T1-T2)/d"
    latex: Optional[str] = None  # rendered LaTeX by SymPy
    variables: List[ExtractedVariable] = field(default_factory=list)
    units: List[ExtractedUnit] = field(default_factory=list)
    source_reference: Optional["FormulaSourceReference"] = None  # type: ignore
    extraction_confidence: float = 0.5  # 0.0–1.0
    review_status: str = "PENDING_REVIEW"  # PENDING_REVIEW, APPROVED, REJECTED
    extraction_method: str = ""  # regex_heuristic, layout_analysis, ocr, manual
    extraction_timestamp: str = ""
    engineering_notes: Optional[str] = None
    dependent_formulas: List[str] = field(default_factory=list)  # formula_ids
