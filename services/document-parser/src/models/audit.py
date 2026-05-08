"""Extraction audit trail models."""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class HumanCorrection:
    """Human correction to extracted element."""

    correction_id: str
    timestamp: str  # ISO UTC
    corrector_id: str
    field_corrected: str  # raw_text, symbolic_expression, variable_name, etc.
    original_value: str
    corrected_value: str
    reason: str  # typo, misparse, incomplete, etc.
    notes: Optional[str] = None


@dataclass
class ExtractionAuditEntry:
    """Complete audit trail entry for extraction."""

    entry_id: str
    document_id: str
    formula_id: Optional[str] = None
    stage: str = ""  # ingestion, section_parse, formula_detect, etc.
    timestamp: str = ""  # ISO UTC
    extraction_hash: str = ""  # deterministic hash of this entry
    raw_source_fragment: str = ""  # verbatim text from source
    extracted_structure: dict = field(default_factory=dict)  # what we produced
    normalization_steps: List[str] = field(default_factory=list)  # transformations applied
    validation_steps: List[str] = field(default_factory=list)  # checks performed
    validation_passed: bool = True
    human_corrections: List[HumanCorrection] = field(default_factory=list)
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    review_timestamp: Optional[str] = None
