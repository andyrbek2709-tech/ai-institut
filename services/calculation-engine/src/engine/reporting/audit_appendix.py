"""Build audit appendix from execution data."""

import logging
from typing import Dict, Any, List, Optional

from .models import ReportContext

logger = logging.getLogger(__name__)


class AuditAppendixBuilder:
    """Builds comprehensive audit appendix from execution and validation data."""

    @staticmethod
    def build_appendix_content(context: ReportContext) -> Dict[str, Any]:
        """
        Build complete audit appendix content.

        Args:
            context: ReportContext with audit data

        Returns:
            Dictionary with appendix sections
        """

        return {
            "execution_summary": AuditAppendixBuilder._build_execution_summary(context),
            "validation_trace": AuditAppendixBuilder._build_validation_trace(context),
            "execution_traces": AuditAppendixBuilder._build_execution_traces(context),
            "failure_analysis": AuditAppendixBuilder._build_failure_analysis(context),
            "rules_applied": AuditAppendixBuilder._build_rules_applied(context),
        }

    @staticmethod
    def _build_execution_summary(context: ReportContext) -> Dict[str, Any]:
        """Build execution summary section."""

        num_formulas = len(context.formulas)
        num_validations = len(context.validation_results)
        num_passed = sum(1 for v in context.validation_results if v.status == "passed")
        num_failed = sum(1 for v in context.validation_results if v.status == "failed")

        return {
            "calculation_id": context.calculation_id,
            "template": context.template_type.value,
            "timestamp": context.timestamp,
            "status": context.validation_status,
            "formulas_executed": num_formulas,
            "validation_rules_applied": num_validations,
            "validation_passed": num_passed,
            "validation_failed": num_failed,
            "calculation_time_ms": context.calculation_time_ms,
        }

    @staticmethod
    def _build_validation_trace(context: ReportContext) -> List[Dict[str, Any]]:
        """Build validation trace (all validation rules and results)."""

        trace = []

        for validation in context.validation_results:
            trace.append(
                {
                    "rule_id": validation.rule_id,
                    "rule_name": validation.rule_name,
                    "status": validation.status,
                    "severity": validation.severity,
                    "message": validation.message,
                    "engineering_notes": validation.engineering_notes or "",
                    "actual_value": validation.actual_value,
                    "expected_condition": validation.expected_condition,
                }
            )

        return trace

    @staticmethod
    def _build_execution_traces(context: ReportContext) -> List[Dict[str, Any]]:
        """Build execution traces (formula execution details)."""

        traces = []

        for trace in context.execution_traces:
            traces.append(
                {
                    "formula_id": trace.formula_id,
                    "expression": trace.expression,
                    "inputs_used": trace.inputs_used,
                    "output": trace.output,
                    "unit": trace.unit,
                    "duration_ms": trace.duration_ms,
                    "status": trace.status,
                    "error": trace.error,
                }
            )

        return traces

    @staticmethod
    def _build_failure_analysis(context: ReportContext) -> Optional[Dict[str, Any]]:
        """Build failure analysis section."""

        if not context.failure_analysis:
            return None

        return {
            "num_failures": context.failure_analysis.num_failures,
            "failed_rules": context.failure_analysis.failed_rules,
            "failures": context.failure_analysis.failures,
            "summary": context.failure_analysis.summary_text,
        }

    @staticmethod
    def _build_rules_applied(context: ReportContext) -> Dict[str, Any]:
        """Build rules applied section (engineering rules)."""

        rules_by_type = {
            "range_checks": [],
            "plausibility_checks": [],
            "safety_checks": [],
            "other_checks": [],
        }

        for validation in context.validation_results:
            rule_id = validation.rule_id.lower()

            if "range" in rule_id:
                rules_by_type["range_checks"].append(validation.rule_name)
            elif "physical" in rule_id or "plausibility" in rule_id:
                rules_by_type["plausibility_checks"].append(validation.rule_name)
            elif "safety" in rule_id:
                rules_by_type["safety_checks"].append(validation.rule_name)
            else:
                rules_by_type["other_checks"].append(validation.rule_name)

        return {rule_type: list(set(rules)) for rule_type, rules in rules_by_type.items()}
