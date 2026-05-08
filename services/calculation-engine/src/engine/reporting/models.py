"""Data models for engineering report generation."""

from dataclasses import dataclass, field
from typing import Optional, Dict, List, Any
from enum import Enum


class ReportTemplateType(str, Enum):
    """Available report template types."""
    PIPING = "piping"
    STRUCTURAL = "structural"
    THERMAL = "thermal"
    GENERIC = "generic"


class SectionType(str, Enum):
    """Standard report sections."""
    TITLE = "title"
    NORMATIVE_REFERENCES = "normative_references"
    ASSUMPTIONS = "assumptions"
    INPUTS = "inputs"
    FORMULAS = "formulas"
    RESULTS = "results"
    VALIDATION = "validation"
    WARNINGS = "warnings"
    AUDIT_APPENDIX = "audit_appendix"
    SYSTEM_INFO = "system_info"


@dataclass
class InputVariable:
    """Represents a single input variable in report context."""
    name: str
    label: str
    description: str
    value: float
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    default_value: Optional[float] = None


@dataclass
class OutputVariable:
    """Represents a single output/result variable."""
    name: str
    label: str
    description: str
    value: float
    unit: Optional[str] = None
    is_critical: bool = False  # True if exceeds design limits


@dataclass
class RenderedFormula:
    """Formula with rendering information."""
    formula_id: str
    name: str
    description: str

    # Formula representations
    expression: str  # Original expression
    latex_formula: str  # LaTeX version
    text_formula: str  # Readable text version

    # Variables in formula
    variables: Dict[str, Any]  # {var_name: {"value": ..., "unit": ...}}
    variable_definitions: str  # Formatted variable definitions

    # Calculation
    calculation_steps: List[str]  # Step-by-step breakdown
    output_value: float
    output_unit: Optional[str]

    # Metadata
    engineering_notes: Optional[str] = None
    source_reference: Optional[str] = None  # e.g., "ASME B31.4, Eq. 2.3"


@dataclass
class ValidationResultSummary:
    """Summary of validation rule result."""
    rule_id: str
    rule_name: str
    status: str  # "passed", "failed", "warning"
    severity: str  # "info", "warning", "error", "failure"
    message: str
    engineering_notes: Optional[str] = None
    actual_value: Optional[str] = None
    expected_condition: Optional[str] = None


@dataclass
class ExecutionTraceSummary:
    """Summary of formula execution trace."""
    formula_id: str
    expression: str
    inputs_used: Dict[str, float]
    output: float
    unit: Optional[str]
    duration_ms: float
    status: str
    error: Optional[str] = None


@dataclass
class FailureAnalysisSummary:
    """Summary of failure analysis."""
    num_failures: int
    failed_rules: List[str]
    failures: List[Dict[str, Any]]
    summary_text: str


@dataclass
class ReportContext:
    """Complete context for report generation."""

    # Identification
    calculation_id: str
    template_type: ReportTemplateType
    timestamp: str  # ISO format

    # Title & metadata
    title: str
    description: Optional[str] = None

    # Content sections
    normative_references: List[str] = field(default_factory=list)
    assumptions: List[str] = field(default_factory=list)

    # Inputs
    inputs: Dict[str, InputVariable] = field(default_factory=dict)

    # Formulas
    formulas: List[RenderedFormula] = field(default_factory=list)

    # Results
    results: Dict[str, OutputVariable] = field(default_factory=dict)

    # Validation
    validation_results: List[ValidationResultSummary] = field(default_factory=list)
    validation_status: str = "success"  # "success", "warning", "error"

    # Warnings
    warnings: List[str] = field(default_factory=list)

    # Engineering data
    execution_traces: List[ExecutionTraceSummary] = field(default_factory=list)
    failure_analysis: Optional[FailureAnalysisSummary] = None
    audit_trail: Optional[Dict[str, Any]] = None

    # Metadata for template rendering
    disciplines: List[str] = field(default_factory=list)  # e.g., ["piping", "pressure"]
    tags: List[str] = field(default_factory=list)  # e.g., ["pipeline", "stress"]

    # System info
    calculation_engine_version: str = "0.3.0"
    calculation_time_ms: Optional[float] = None


@dataclass
class ReportTemplate:
    """Base class for report templates."""

    template_id: str
    template_name: str
    supported_disciplines: List[str]

    # Section order
    sections: List[SectionType] = field(default_factory=list)

    def select_sections(self, context: ReportContext) -> List[SectionType]:
        """Determine which sections to include based on context."""
        return self.sections

    def get_section_title(self, section_type: SectionType) -> str:
        """Get localized title for section."""
        titles = {
            SectionType.TITLE: "Title Page",
            SectionType.NORMATIVE_REFERENCES: "Normative References",
            SectionType.ASSUMPTIONS: "Assumptions",
            SectionType.INPUTS: "Input Data",
            SectionType.FORMULAS: "Formulas & Calculations",
            SectionType.RESULTS: "Results",
            SectionType.VALIDATION: "Validation Results",
            SectionType.WARNINGS: "Engineering Warnings",
            SectionType.AUDIT_APPENDIX: "Appendix A: Calculation Audit Trail",
            SectionType.SYSTEM_INFO: "Appendix B: System Information",
        }
        return titles.get(section_type, str(section_type))


@dataclass
class ReportMetadata:
    """Metadata about generated report."""
    report_id: str
    calculation_id: str
    template_type: str
    version: str = "1.0"
    generated: str = ""  # ISO timestamp
    hash: str = ""  # SHA256 of report content
    engine_version: str = "0.3.0"
    file_size_bytes: Optional[int] = None


class ReportStatus(str, Enum):
    """Report generation status."""
    GENERATED = "generated"
    CACHED = "cached"
    ERROR = "error"


@dataclass
class ReportGenerationResponse:
    """Response from report generation endpoint."""
    report_id: str
    status: ReportStatus
    download_url: Optional[str] = None
    metadata: Optional[ReportMetadata] = None
    error_message: Optional[str] = None
