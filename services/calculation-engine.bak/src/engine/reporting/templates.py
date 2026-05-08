"""Report template implementations."""

import logging
from typing import Dict, List, Any, Optional

from .models import ReportTemplate, ReportContext, SectionType

logger = logging.getLogger(__name__)


class PipingReportTemplate(ReportTemplate):
    """Template for piping and pressure calculation reports."""

    def __init__(self):
        """Initialize piping report template."""
        super().__init__(
            template_id="piping",
            template_name="Piping Report",
            supported_disciplines=["pressure", "piping", "pipeline", "stress"],
            sections=[
                SectionType.TITLE,
                SectionType.NORMATIVE_REFERENCES,
                SectionType.ASSUMPTIONS,
                SectionType.INPUTS,
                SectionType.FORMULAS,
                SectionType.RESULTS,
                SectionType.VALIDATION,
                SectionType.WARNINGS,
                SectionType.AUDIT_APPENDIX,
                SectionType.SYSTEM_INFO,
            ],
        )

    def select_sections(self, context: ReportContext) -> List[SectionType]:
        """Select sections for piping report."""
        sections = list(self.sections)

        # Remove audit appendix if no data
        if (
            not context.execution_traces
            and not context.failure_analysis
            and not context.audit_trail
        ):
            sections.remove(SectionType.AUDIT_APPENDIX)

        return sections


class StructuralReportTemplate(ReportTemplate):
    """Template for structural analysis reports."""

    def __init__(self):
        """Initialize structural report template."""
        super().__init__(
            template_id="structural",
            template_name="Structural Analysis Report",
            supported_disciplines=["structural", "strength", "deflection", "stability"],
            sections=[
                SectionType.TITLE,
                SectionType.NORMATIVE_REFERENCES,
                SectionType.ASSUMPTIONS,
                SectionType.INPUTS,
                SectionType.FORMULAS,
                SectionType.RESULTS,
                SectionType.VALIDATION,
                SectionType.WARNINGS,
                SectionType.AUDIT_APPENDIX,
                SectionType.SYSTEM_INFO,
            ],
        )


class ThermalReportTemplate(ReportTemplate):
    """Template for thermal analysis reports."""

    def __init__(self):
        """Initialize thermal report template."""
        super().__init__(
            template_id="thermal",
            template_name="Thermal Analysis Report",
            supported_disciplines=["thermal", "heat_transfer", "temperature", "stresses"],
            sections=[
                SectionType.TITLE,
                SectionType.NORMATIVE_REFERENCES,
                SectionType.ASSUMPTIONS,
                SectionType.INPUTS,
                SectionType.FORMULAS,
                SectionType.RESULTS,
                SectionType.VALIDATION,
                SectionType.WARNINGS,
                SectionType.AUDIT_APPENDIX,
                SectionType.SYSTEM_INFO,
            ],
        )


class GenericReportTemplate(ReportTemplate):
    """Generic engineering report template for any calculation."""

    def __init__(self):
        """Initialize generic report template."""
        super().__init__(
            template_id="generic",
            template_name="Engineering Report",
            supported_disciplines=[],  # Supports all
            sections=[
                SectionType.TITLE,
                SectionType.NORMATIVE_REFERENCES,
                SectionType.ASSUMPTIONS,
                SectionType.INPUTS,
                SectionType.FORMULAS,
                SectionType.RESULTS,
                SectionType.VALIDATION,
                SectionType.WARNINGS,
                SectionType.AUDIT_APPENDIX,
                SectionType.SYSTEM_INFO,
            ],
        )


class TemplateRegistry:
    """Manages available report templates."""

    _templates: Dict[str, ReportTemplate] = {
        "piping": PipingReportTemplate(),
        "structural": StructuralReportTemplate(),
        "thermal": ThermalReportTemplate(),
        "generic": GenericReportTemplate(),
    }

    @classmethod
    def get_template(cls, template_id: str) -> Optional[ReportTemplate]:
        """Get template by ID."""
        return cls._templates.get(template_id.lower())

    @classmethod
    def select_template(cls, context: ReportContext) -> ReportTemplate:
        """
        Select appropriate template based on context.

        Strategy:
        1. Check explicit template_type in context
        2. Check tags/disciplines
        3. Fall back to generic
        """

        # Try explicit template type
        if context.template_type:
            template = cls.get_template(context.template_type.value)
            if template:
                return template

        # Try to match by disciplines/tags
        for discipline in context.disciplines:
            template = cls._find_template_by_discipline(discipline)
            if template:
                return template

        for tag in context.tags:
            template = cls._find_template_by_discipline(tag)
            if template:
                return template

        # Fall back to generic
        return cls._templates["generic"]

    @classmethod
    def _find_template_by_discipline(cls, discipline: str) -> Optional[ReportTemplate]:
        """Find template that supports given discipline."""
        discipline_lower = discipline.lower()

        for template in cls._templates.values():
            if discipline_lower in [d.lower() for d in template.supported_disciplines]:
                return template

        return None

    @classmethod
    def list_templates(cls) -> List[str]:
        """List all available template IDs."""
        return list(cls._templates.keys())

    @classmethod
    def register_template(cls, template: ReportTemplate):
        """Register custom template."""
        cls._templates[template.template_id] = template
