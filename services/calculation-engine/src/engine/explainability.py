"""Calculation explainability system - explains steps to engineers."""
from dataclasses import dataclass, field
from typing import Optional, Any
from datetime import datetime
from pint import Quantity
import logging

from src.engine.validation_framework import ValidationResult
from src.engine.semantic_metadata import VariableSemantics, FormulaSemanticsMetadata
from src.engine.execution_graph import ExecutionTrace, ExecutionPlan

logger = logging.getLogger(__name__)


@dataclass
class ExecutionExplanation:
    """Explains a single formula execution step."""

    formula_id: str
    formula_text: str
    name: str
    description: str
    step_order: int
    reason_for_step: str
    inputs_used: dict[str, str]  # input_name -> display value + unit
    output_produced: str  # display value + unit
    execution_time_ms: float
    depends_on: list[str]
    depended_by: list[str]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "formula_id": self.formula_id,
            "formula_text": self.formula_text,
            "name": self.name,
            "description": self.description,
            "step_order": self.step_order,
            "reason_for_step": self.reason_for_step,
            "inputs_used": self.inputs_used,
            "output_produced": self.output_produced,
            "execution_time_ms": self.execution_time_ms,
            "depends_on": self.depends_on,
            "depended_by": self.depended_by,
        }


@dataclass
class ValidationExplanation:
    """Explains a validation result to engineer."""

    rule_id: str
    rule_name: str
    variable_name: str
    status: str  # "passed", "warning", "failed"
    severity: str
    message: str
    engineering_notes: str
    actual_value: str
    expected_condition: str
    why_it_matters: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "variable_name": self.variable_name,
            "status": self.status,
            "severity": self.severity,
            "message": self.message,
            "engineering_notes": self.engineering_notes,
            "actual_value": self.actual_value,
            "expected_condition": self.expected_condition,
            "why_it_matters": self.why_it_matters,
        }


@dataclass
class FailureExplanation:
    """Explains a calculation failure to engineer."""

    failure_id: str
    failure_type: str
    message: str
    root_cause: str
    probable_causes: list[str]
    affected_variables: list[str]
    mitigation_suggestions: list[str]
    debug_hints: list[str]
    confidence: float

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "failure_id": self.failure_id,
            "failure_type": self.failure_type,
            "message": self.message,
            "root_cause": self.root_cause,
            "probable_causes": self.probable_causes,
            "affected_variables": self.affected_variables,
            "mitigation_suggestions": self.mitigation_suggestions,
            "debug_hints": self.debug_hints,
            "confidence": self.confidence,
        }


class ExplainabilityEngine:
    """Generates human-readable explanations of calculations."""

    def __init__(self):
        """Initialize explainability engine."""
        self.logger = logger

    def explain_execution(
        self,
        execution_plan: ExecutionPlan,
        traces: list[ExecutionTrace],
        semantics_map: dict[str, FormulaSemanticsMetadata],
    ) -> list[ExecutionExplanation]:
        """
        Generate execution explanations.

        Args:
            execution_plan: Execution plan with formula order
            traces: Execution traces from run
            semantics_map: Map of formula_id -> FormulaSemanticsMetadata

        Returns:
            List of ExecutionExplanation objects
        """
        explanations = []

        # Create map of traces by formula_id for quick lookup
        traces_by_formula = {trace.formula_id: trace for trace in traces}

        # Iterate in execution order
        for step_order, formula_id in enumerate(execution_plan.formula_order, 1):
            trace = traces_by_formula.get(formula_id)
            semantics = semantics_map.get(formula_id)

            if not trace:
                self.logger.warning(f"No trace found for formula {formula_id}")
                continue

            # Format inputs for display
            inputs_display = {}
            for input_name, input_value in trace.inputs_used.items():
                if isinstance(input_value, Quantity):
                    inputs_display[input_name] = (
                        f"{input_value.magnitude:.4g} {input_value.units}"
                    )
                else:
                    inputs_display[input_name] = str(input_value)

            # Format output for display
            if isinstance(trace.output, Quantity):
                output_display = f"{trace.output.magnitude:.4g} {trace.output.units}"
            else:
                output_display = str(trace.output)

            # Build dependencies
            depends_on = execution_plan.dependencies.get(formula_id, set())
            depended_by = execution_plan.dependents.get(formula_id, set())

            # Create explanation
            explanation = ExecutionExplanation(
                formula_id=formula_id,
                formula_text=trace.expression,
                name=semantics.name if semantics else formula_id,
                description=semantics.description if semantics else "Formula execution",
                step_order=step_order,
                reason_for_step=semantics.engineering_meaning
                if semantics
                else "Calculation step",
                inputs_used=inputs_display,
                output_produced=output_display,
                execution_time_ms=trace.duration_ms,
                depends_on=list(depends_on),
                depended_by=list(depended_by),
            )

            explanations.append(explanation)

        return explanations

    def explain_validation(
        self,
        validation_results: list[ValidationResult],
        semantics_map: dict[str, VariableSemantics],
    ) -> list[ValidationExplanation]:
        """
        Generate validation explanations.

        Args:
            validation_results: Results from validation
            semantics_map: Map of variable_id -> VariableSemantics

        Returns:
            List of ValidationExplanation objects
        """
        explanations = []

        for result in validation_results:
            semantics = semantics_map.get(result.output_name)

            # Determine status text
            status = "passed" if result.status == "passed" else "failed"

            # Generate "why it matters" text
            if semantics:
                why_it_matters = (
                    f"This check ensures {result.output_name} "
                    f"({semantics.name}) is physically plausible "
                    f"and consistent with engineering practice. "
                    f"{semantics.engineering_notes}"
                )
            else:
                why_it_matters = "This check validates engineering correctness."

            explanation = ValidationExplanation(
                rule_id=result.rule_id,
                rule_name=result.rule_name,
                variable_name=result.output_name,
                status=status,
                severity=result.severity.value,
                message=result.message,
                engineering_notes=result.engineering_notes,
                actual_value=result.actual_value or "N/A",
                expected_condition=result.expected_condition or "N/A",
                why_it_matters=why_it_matters,
            )

            explanations.append(explanation)

        return explanations

    def explain_failures(
        self,
        validation_results: list[ValidationResult],
        variables: dict[str, Quantity],
        semantics_map: dict[str, VariableSemantics],
    ) -> list[FailureExplanation]:
        """
        Generate failure explanations.

        Args:
            validation_results: Validation failures
            variables: All variables in calculation
            semantics_map: Map of variable_id -> VariableSemantics

        Returns:
            List of FailureExplanation objects
        """
        explanations = []
        failure_count = 0

        for result in validation_results:
            if result.status != "failed":
                continue

            failure_count += 1
            semantics = semantics_map.get(result.output_name)

            # Determine failure type
            failure_type = self._categorize_failure(result)

            # Build root cause description
            root_cause = self._determine_root_cause(
                result, variables, semantics
            )

            # Generate debug hints
            debug_hints = self._generate_debug_hints(
                result, variables, semantics
            )

            explanation = FailureExplanation(
                failure_id=f"f_{failure_count:03d}",
                failure_type=failure_type,
                message=result.message,
                root_cause=root_cause,
                probable_causes=result.probable_causes or [],
                affected_variables=[result.output_name],
                mitigation_suggestions=result.mitigations or [],
                debug_hints=debug_hints,
                confidence=0.9,
            )

            explanations.append(explanation)

        return explanations

    def _categorize_failure(self, result: ValidationResult) -> str:
        """Categorize failure type."""
        rule_id = result.rule_id.lower()

        if "physical" in rule_id or "plausible" in rule_id:
            return "physical_implausibility"
        elif "safety" in rule_id or "factor" in rule_id:
            return "safety_violation"
        elif "constraint" in rule_id:
            return "engineering_constraint"
        elif "stability" in rule_id:
            return "numerical_instability"
        elif "range" in rule_id:
            return "range_violation"
        else:
            return "engineering_constraint"

    def _determine_root_cause(
        self,
        result: ValidationResult,
        variables: dict[str, Quantity],
        semantics: Optional[VariableSemantics],
    ) -> str:
        """Determine root cause of failure."""
        if semantics:
            return (
                f"The {semantics.name} calculated as "
                f"{result.actual_value} violates the constraint: "
                f"{result.expected_condition}. "
                f"This typically indicates {semantics.failure_modes[0] if semantics.failure_modes else 'an issue'} "
                f"or incorrect input assumptions."
            )
        else:
            return f"Validation rule {result.rule_id} failed: {result.message}"

    def _generate_debug_hints(
        self,
        result: ValidationResult,
        variables: dict[str, Quantity],
        semantics: Optional[VariableSemantics],
    ) -> list[str]:
        """Generate debugging hints."""
        hints = []

        if result.status == "failed":
            hints.append(
                f"Verify actual value {result.actual_value} "
                f"against expected condition: {result.expected_condition}"
            )

            if semantics:
                hints.append(
                    f"Check input values for {', '.join(semantics.related_variables)}"
                )

                if result.actual_value:
                    try:
                        actual_float = float(
                            str(result.actual_value).split()[0]
                        )
                        min_val, max_val = semantics.expected_range
                        if actual_float < min_val:
                            hints.append(
                                f"{semantics.name} is below expected range. "
                                f"Check for unit conversion errors or negative inputs."
                            )
                        elif actual_float > max_val:
                            hints.append(
                                f"{semantics.name} is above expected range. "
                                f"Review input values and calculation logic."
                            )
                    except (ValueError, IndexError):
                        pass

            hints.extend(
                [
                    "Review calculation template for formula errors",
                    f"Verify units match expected: {semantics.expected_unit if semantics else 'N/A'}",
                    "Check input assumptions and validity",
                ]
            )

        return hints[:3]  # Return top 3 hints

    def generate_summary(
        self,
        execution_explanations: list[ExecutionExplanation],
        validation_explanations: list[ValidationExplanation],
        failure_explanations: list[FailureExplanation],
    ) -> dict[str, Any]:
        """
        Generate summary of all explanations.

        Returns:
            Dictionary with summary information
        """
        passed = sum(1 for e in validation_explanations if e.status == "passed")
        failed = sum(1 for e in validation_explanations if e.status == "failed")
        warnings = sum(
            1 for e in validation_explanations if e.severity == "warning"
        )

        return {
            "execution_steps": len(execution_explanations),
            "validations_run": len(validation_explanations),
            "validations_passed": passed,
            "validations_failed": failed,
            "warnings": warnings,
            "failures_detected": len(failure_explanations),
            "overall_status": "success" if failed == 0 else "failure",
        }
