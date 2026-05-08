"""Engineering reporting module for DOCX report generation with integrated identity + lifecycle."""

from .models import ReportContext, ReportTemplate, RenderedFormula
from .data_extractor import ReportDataExtractor
from .formula_renderer import FormulaRenderer
from .docx_builder import DocxReportBuilder
from .audit_appendix import AuditAppendixBuilder
from .templates import TemplateRegistry, PipingReportTemplate, GenericReportTemplate
from .pipeline import UnifiedReportingPipeline
from .report_identity import ReportIdentityGenerator, ReportIdentity
from .lifecycle import get_lifecycle_manager
from .lifecycle_persistence import get_persistence_store
from .deterministic_hashing import DeterministicHasher

__all__ = [
    "ReportContext",
    "ReportTemplate",
    "RenderedFormula",
    "ReportDataExtractor",
    "FormulaRenderer",
    "DocxReportBuilder",
    "AuditAppendixBuilder",
    "TemplateRegistry",
    "PipingReportTemplate",
    "GenericReportTemplate",
    "UnifiedReportingPipeline",
    "ReportIdentityGenerator",
    "ReportIdentity",
    "get_lifecycle_manager",
    "get_persistence_store",
    "DeterministicHasher",
]
