"""Extract and structure data from CalculationResult for report generation."""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from src.schemas import CalculationResult
from .models import (
    ReportContext,
    ReportTemplateType,
    InputVariable,
    OutputVariable,
    RenderedFormula,
    ValidationResultSummary,
    ExecutionTraceSummary,
    FailureAnalysisSummary,
)

logger = logging.getLogger(__name__)


class ReportDataExtractor:
    """Extracts and structures data from CalculationResult for report generation."""

    @staticmethod
    def extract_context(
        calculation_result: CalculationResult,
        calculation_id: str,
        template_data: Optional[Dict[str, Any]] = None,
    ) -> ReportContext:
        """
        Transform CalculationResult into ReportContext for template rendering.

        Args:
            calculation_result: Full calculation result from Runner
            calculation_id: Unique ID for this calculation
            template_data: Optional additional template-specific data

        Returns:
            ReportContext ready for DOCX generation
        """
        template_data = template_data or {}

        # Determine template type
        template_type = ReportDataExtractor._determine_template_type(
            calculation_result, template_data
        )

        # Extract sections
        inputs = ReportDataExtractor._extract_inputs(
            calculation_result, template_data
        )
        results = ReportDataExtractor._extract_results(calculation_result)
        formulas = ReportDataExtractor._extract_formulas(
            calculation_result, template_data
        )
        validation_results = ReportDataExtractor._extract_validation_results(
            calculation_result
        )
        execution_traces = ReportDataExtractor._extract_execution_traces(
            calculation_result
        )
        failure_analysis = ReportDataExtractor._extract_failure_analysis(
            calculation_result
        )
        warnings = ReportDataExtractor._extract_warnings(calculation_result)

        # Build context
        context = ReportContext(
            calculation_id=calculation_id,
            template_type=template_type,
            timestamp=datetime.now(timezone.utc).isoformat(),
            title=template_data.get("title", f"Engineering Report - {calculation_id}"),
            description=template_data.get("description"),
            normative_references=template_data.get("normative_references", []),
            assumptions=template_data.get("assumptions", []),
            inputs=inputs,
            formulas=formulas,
            results=results,
            validation_results=validation_results,
            validation_status=calculation_result.status,
            warnings=warnings,
            execution_traces=execution_traces,
            failure_analysis=failure_analysis,
            audit_trail=calculation_result.audit_trail,
            disciplines=template_data.get("disciplines", []),
            tags=template_data.get("tags", []),
            calculation_time_ms=calculation_result.metadata.get("execution_time_ms"),
        )

        return context

    @staticmethod
    def _determine_template_type(
        calculation_result: CalculationResult,
        template_data: Dict[str, Any]
    ) -> ReportTemplateType:
        """Determine which template to use based on calculation metadata."""

        # Explicit template override
        if "template_type" in template_data:
            template_str = template_data["template_type"]
            try:
                return ReportTemplateType[template_str.upper()]
            except KeyError:
                logger.warning(f"Unknown template type: {template_str}, using GENERIC")
                return ReportTemplateType.GENERIC

        # Auto-detect from tags/disciplines
        tags = template_data.get("tags", [])
        disciplines = template_data.get("disciplines", [])

        if "piping" in tags or "piping" in disciplines or "pipeline" in tags:
            return ReportTemplateType.PIPING
        elif "structural" in tags or "structural" in disciplines:
            return ReportTemplateType.STRUCTURAL
        elif "thermal" in tags or "thermal" in disciplines:
            return ReportTemplateType.THERMAL

        return ReportTemplateType.GENERIC

    @staticmethod
    def _extract_inputs(
        calculation_result: CalculationResult,
        template_data: Dict[str, Any],
    ) -> Dict[str, InputVariable]:
        """Extract input variables from calculation result."""

        inputs = {}

        if not hasattr(calculation_result, "metadata") or not calculation_result.metadata:
            return inputs

        input_data = calculation_result.metadata.get("inputs", {})

        # Get variable definitions if available
        variable_defs = template_data.get("variables", {})

        for var_name, var_value in input_data.items():
            var_def = variable_defs.get(var_name, {})

            inputs[var_name] = InputVariable(
                name=var_name,
                label=var_def.get("label", var_name),
                description=var_def.get("description", ""),
                value=var_value if isinstance(var_value, (int, float)) else float(var_value),
                unit=var_def.get("unit"),
                min_value=var_def.get("min_value"),
                max_value=var_def.get("max_value"),
                default_value=var_def.get("default_value"),
            )

        return inputs

    @staticmethod
    def _extract_results(
        calculation_result: CalculationResult,
    ) -> Dict[str, OutputVariable]:
        """Extract results/outputs from calculation result."""

        results = {}

        if not calculation_result.results:
            return results

        for result_name, result_data in calculation_result.results.items():
            if isinstance(result_data, dict):
                value = result_data.get("value", 0)
                unit = result_data.get("unit")
            else:
                value = result_data
                unit = None

            results[result_name] = OutputVariable(
                name=result_name,
                label=result_name.replace("_", " ").title(),
                description="",
                value=float(value) if isinstance(value, (int, float)) else 0,
                unit=unit,
            )

        return results

    @staticmethod
    def _extract_formulas(
        calculation_result: CalculationResult,
        template_data: Dict[str, Any],
    ) -> List[RenderedFormula]:
        """Extract and structure formulas from calculation result."""

        formulas = []

        # Get formula from metadata
        formula_expr = calculation_result.metadata.get("formula", "")

        if not formula_expr:
            return formulas

        # Get formula definition if available
        formula_defs = template_data.get("formulas", {})
        formula_def = formula_defs.get("main", {}) if isinstance(formula_defs, dict) else {}

        # Build rendered formula
        inputs = calculation_result.metadata.get("inputs", {})

        rendered = RenderedFormula(
            formula_id="main",
            name=formula_def.get("name", "Main Formula"),
            description=formula_def.get("description", ""),
            expression=formula_expr,
            latex_formula=formula_def.get("latex", formula_expr),
            text_formula=str(formula_expr),
            variables={k: {"value": v} for k, v in inputs.items()},
            variable_definitions="",  # Will be filled by FormulaRenderer
            calculation_steps=[],  # Will be filled by FormulaRenderer
            output_value=list(calculation_result.results.values())[0].get("value", 0)
            if calculation_result.results else 0,
            output_unit=list(calculation_result.results.values())[0].get("unit")
            if calculation_result.results else None,
            source_reference=formula_def.get("source_reference"),
        )

        formulas.append(rendered)
        return formulas

    @staticmethod
    def _extract_validation_results(
        calculation_result: CalculationResult,
    ) -> List[ValidationResultSummary]:
        """Extract validation results from calculation result."""

        results = []

        if not hasattr(calculation_result, "validation_results"):
            return results

        for validation in calculation_result.validation_results or []:
            summary = ValidationResultSummary(
                rule_id=validation.rule_id,
                rule_name=validation.rule_name,
                status=validation.status,
                severity=validation.severity.value if hasattr(validation.severity, "value") else str(validation.severity),
                message=validation.message,
                engineering_notes=validation.engineering_notes,
                actual_value=str(validation.actual_value) if validation.actual_value is not None else None,
                expected_condition=validation.expected_condition,
            )
            results.append(summary)

        return results

    @staticmethod
    def _extract_execution_traces(
        calculation_result: CalculationResult,
    ) -> List[ExecutionTraceSummary]:
        """Extract execution traces from calculation result."""

        traces = []

        # If there are execution traces in metadata
        if hasattr(calculation_result, "metadata") and calculation_result.metadata:
            # This is a placeholder - actual traces would come from ExecutionTrace objects
            pass

        return traces

    @staticmethod
    def _extract_failure_analysis(
        calculation_result: CalculationResult,
    ) -> Optional[FailureAnalysisSummary]:
        """Extract failure analysis if present."""

        if not hasattr(calculation_result, "failure_analysis") or not calculation_result.failure_analysis:
            return None

        analysis = calculation_result.failure_analysis

        return FailureAnalysisSummary(
            num_failures=len(analysis.get("failures", [])),
            failed_rules=[f["rule"] for f in analysis.get("failures", [])],
            failures=analysis.get("failures", []),
            summary_text=analysis.get("summary", ""),
        )

    @staticmethod
    def _extract_warnings(
        calculation_result: CalculationResult,
    ) -> List[str]:
        """Extract warnings from calculation result."""

        warnings = []

        if hasattr(calculation_result, "warnings") and calculation_result.warnings:
            warnings.extend(calculation_result.warnings)

        # Add warnings from failed validations
        if hasattr(calculation_result, "validation_results") and calculation_result.validation_results:
            for validation in calculation_result.validation_results:
                if validation.status in ("failed", "warning"):
                    warnings.append(validation.message)

        return warnings
