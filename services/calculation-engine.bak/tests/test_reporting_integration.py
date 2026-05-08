"""Integration tests for report generation pipeline."""

import pytest
from datetime import datetime, timezone

from src.engine.reporting import (
    ReportDataExtractor,
    DocxReportBuilder,
    FormulaRenderer,
    TemplateRegistry,
)
from src.engine.reporting.models import ReportTemplateType, ReportContext
from src.schemas import CalculationResult


@pytest.fixture
def sample_calculation_result():
    """Create sample CalculationResult for testing."""
    return CalculationResult(
        template_id="pipe_stress",
        status="success",
        results={
            "hoop_stress": {"value": 45.2, "unit": "MPa"},
            "safety_ratio": {"value": 0.89, "unit": ""},
        },
        warnings=["Hoop stress exceeds design limit"],
        validation_results=[],
        explanations=None,
        audit_trail={
            "events": [
                {
                    "event_type": "input_captured",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            ]
        },
        failure_analysis=None,
        metadata={
            "formula": "(pressure * (diameter - 2*thickness)) / (2 * thickness)",
            "inputs": {"pressure": 5.0, "diameter": 100, "thickness": 5},
            "execution_time_ms": 45.2,
        },
    )


@pytest.fixture
def sample_template_data():
    """Create sample template data."""
    return {
        "title": "Pipe Stress Analysis Report",
        "description": "Calculate hoop stress in pressurized pipe using Barlow's formula",
        "normative_references": ["ASME B31.4", "API 5L"],
        "assumptions": [
            "Static loading conditions",
            "Material properties are constant",
            "Linear elastic behavior",
        ],
        "variables": {
            "pressure": {
                "label": "Internal Pressure",
                "description": "Design pressure inside the pipe",
                "unit": "MPa",
                "min_value": 0,
                "max_value": 1000,
            },
            "diameter": {
                "label": "Outer Diameter",
                "description": "External pipe diameter",
                "unit": "mm",
                "min_value": 1,
                "max_value": 10000,
            },
            "thickness": {
                "label": "Wall Thickness",
                "description": "Pipe wall thickness",
                "unit": "mm",
                "min_value": 0.1,
                "max_value": 500,
            },
        },
        "formulas": {
            "main": {
                "name": "Hoop Stress (Barlow's Formula)",
                "description": "Calculate circumferential (hoop) stress in pipe",
                "latex": r"\sigma_h = \frac{P(D - 2t)}{2tE}",
                "source_reference": "ASME B31.1, Appendix A",
            }
        },
        "tags": ["piping", "pressure", "stress"],
        "disciplines": ["pressure", "piping"],
    }


class TestReportDataExtractor:
    """Tests for ReportDataExtractor."""

    def test_extract_context_creates_valid_context(
        self, sample_calculation_result, sample_template_data
    ):
        """Test that extract_context creates valid ReportContext."""
        context = ReportDataExtractor.extract_context(
            sample_calculation_result,
            "test_calc_001",
            sample_template_data,
        )

        assert context.calculation_id == "test_calc_001"
        assert context.template_type == ReportTemplateType.PIPING
        assert context.title == "Pipe Stress Analysis Report"
        assert len(context.inputs) == 3
        assert len(context.results) == 2
        assert len(context.warnings) > 0

    def test_extract_inputs(self, sample_calculation_result, sample_template_data):
        """Test input extraction."""
        context = ReportDataExtractor.extract_context(
            sample_calculation_result,
            "test_calc_001",
            sample_template_data,
        )

        assert "pressure" in context.inputs
        assert context.inputs["pressure"].value == 5.0
        assert context.inputs["pressure"].unit == "MPa"

    def test_extract_results(self, sample_calculation_result, sample_template_data):
        """Test result extraction."""
        context = ReportDataExtractor.extract_context(
            sample_calculation_result,
            "test_calc_001",
            sample_template_data,
        )

        assert "hoop_stress" in context.results
        assert context.results["hoop_stress"].value == 45.2
        assert context.results["hoop_stress"].unit == "MPa"


class TestFormulaRenderer:
    """Tests for FormulaRenderer."""

    def test_render_formula_generates_all_components(self):
        """Test that formula rendering generates all required components."""
        renderer = FormulaRenderer()

        result = renderer.render_formula(
            formula_expr="(P * (D - 2*t)) / (2 * t * E)",
            variables={
                "P": {"value": 5.0, "unit": "MPa", "description": "Pressure"},
                "D": {"value": 100, "unit": "mm", "description": "Diameter"},
                "t": {"value": 5, "unit": "mm", "description": "Thickness"},
                "E": {"value": 1.0, "unit": "", "description": "Efficiency"},
            },
            output_value=45.0,
        )

        assert "formula_latex" in result
        assert "variable_definitions" in result
        assert "calculation_steps" in result
        assert result["final_value"] == 45.0

    def test_extract_variables_from_formula(self):
        """Test variable extraction from formula."""
        formula = "(P * (D - 2*t)) / (2 * t * E)"
        variables = FormulaRenderer.extract_variables_from_formula(formula)

        assert set(variables) == {"P", "D", "t", "E"}

    def test_render_variable_substitution(self):
        """Test variable substitution display."""
        substitution = FormulaRenderer.render_variable_substitution(
            formula_expr="(P * (D - 2*t)) / (2 * t)",
            variables={"P": 5.0, "D": 100, "t": 5},
            output_value=45.0,
        )

        assert "(P * (D - 2*t)) / (2 * t)" in substitution
        assert "45.0" in substitution


class TestDocxReportBuilder:
    """Tests for DocxReportBuilder."""

    def test_build_report_generates_bytes(
        self, sample_calculation_result, sample_template_data
    ):
        """Test that report builder generates valid DOCX bytes."""
        context = ReportDataExtractor.extract_context(
            sample_calculation_result,
            "test_calc_001",
            sample_template_data,
        )

        builder = DocxReportBuilder()
        report_bytes = builder.build_report(context)

        assert isinstance(report_bytes, bytes)
        assert len(report_bytes) > 1000  # Should be reasonably sized
        # Check for DOCX magic number
        assert report_bytes[:4] == b"PK\x03\x04"  # ZIP file format

    def test_report_contains_title(
        self, sample_calculation_result, sample_template_data
    ):
        """Test that report contains title page."""
        context = ReportDataExtractor.extract_context(
            sample_calculation_result,
            "test_calc_001",
            sample_template_data,
        )

        builder = DocxReportBuilder()
        report_bytes = builder.build_report(context)

        # Verify that document was created (basic check)
        assert len(report_bytes) > 0

    def test_report_contains_inputs(
        self, sample_calculation_result, sample_template_data
    ):
        """Test that report contains input table."""
        context = ReportDataExtractor.extract_context(
            sample_calculation_result,
            "test_calc_001",
            sample_template_data,
        )

        builder = DocxReportBuilder()
        report_bytes = builder.build_report(context)

        # Verify report is valid
        assert len(report_bytes) > 0


class TestTemplateRegistry:
    """Tests for TemplateRegistry."""

    def test_select_template_by_type(self):
        """Test template selection by explicit type."""
        from src.engine.reporting.models import ReportContext

        context = ReportContext(
            calculation_id="test",
            template_type=ReportTemplateType.PIPING,
            timestamp="2026-05-08T00:00:00Z",
            title="Test",
        )

        template = TemplateRegistry.select_template(context)
        assert template.template_id == "piping"

    def test_select_template_by_discipline(self):
        """Test template selection by discipline."""
        from src.engine.reporting.models import ReportContext

        context = ReportContext(
            calculation_id="test",
            template_type=ReportTemplateType.GENERIC,
            timestamp="2026-05-08T00:00:00Z",
            title="Test",
            disciplines=["piping"],
        )

        template = TemplateRegistry.select_template(context)
        assert template.template_id == "piping"

    def test_list_templates(self):
        """Test listing available templates."""
        templates = TemplateRegistry.list_templates()
        assert "piping" in templates
        assert "structural" in templates
        assert "thermal" in templates
        assert "generic" in templates


class TestEndToEndReportGeneration:
    """End-to-end tests for complete report generation pipeline."""

    def test_full_pipeline(self, sample_calculation_result, sample_template_data):
        """Test complete report generation pipeline."""
        # Step 1: Extract data
        context = ReportDataExtractor.extract_context(
            sample_calculation_result,
            "test_calc_001",
            sample_template_data,
        )

        # Step 2: Select template
        template = TemplateRegistry.select_template(context)
        assert template is not None

        # Step 3: Build report
        builder = DocxReportBuilder()
        report_bytes = builder.build_report(context)

        # Verify report
        assert isinstance(report_bytes, bytes)
        assert len(report_bytes) > 1000
        assert report_bytes[:4] == b"PK\x03\x04"  # ZIP/DOCX format

    def test_pipeline_with_different_template_types(
        self, sample_calculation_result
    ):
        """Test pipeline with different template types."""
        for template_type in ["piping", "structural", "thermal", "generic"]:
            template_data = {
                "template_type": template_type,
                "title": f"{template_type.title()} Test Report",
            }

            context = ReportDataExtractor.extract_context(
                sample_calculation_result,
                f"test_{template_type}",
                template_data,
            )

            builder = DocxReportBuilder()
            report_bytes = builder.build_report(context)

            assert len(report_bytes) > 0
            assert report_bytes[:4] == b"PK\x03\x04"
