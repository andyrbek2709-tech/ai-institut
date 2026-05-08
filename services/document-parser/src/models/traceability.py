"""Traceability and lineage models for extraction provenance."""

from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class FormulaSourceReference:
    """Complete source reference for extracted formula."""

    document_id: str
    document_code: str  # e.g., "ГОСТ 21.110-2013"
    page: int
    section: str  # e.g., "3.4.2"
    normative_basis: str  # clause/paragraph e.g., "п. 3.4.2"
    extraction_timestamp: str  # ISO UTC
    extraction_method: str  # regex_heuristic, layout_analysis, ocr, manual
    confidence_metadata: dict = field(default_factory=dict)  # context-specific metadata


@dataclass
class ExtractionLineageStep:
    """Single step in extraction pipeline for a formula."""

    step_id: str
    stage: str  # ingestion, section_parse, formula_detect, variable_extract, etc.
    timestamp: str  # ISO UTC
    input_fragment: str  # what we started with
    output_structure: dict  # what we produced
    transformations: List[str] = field(default_factory=list)  # normalization steps
    validations: List[str] = field(default_factory=list)  # what was checked


@dataclass
class ExtractionLineage:
    """Complete lineage chain for a formula."""

    lineage_id: str
    formula_id: str
    document_id: str
    steps: List[ExtractionLineageStep] = field(default_factory=list)
    source_fragment_hash: str = ""  # SHA256 of raw source
    final_hash: str = ""  # SHA256 of final extracted formula
    lineage_hash: str = ""  # SHA256 of entire lineage
    is_deterministic: bool = True

    def add_step(self, step: ExtractionLineageStep) -> None:
        """Record an extraction step."""
        self.steps.append(step)
