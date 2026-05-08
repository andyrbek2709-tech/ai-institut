"""Failure analysis system - categorizes and explains failures."""
from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum
from pint import Quantity
import logging

from src.engine.validation_framework import ValidationResult, FailureCategory
from src.engine.semantic_metadata import VariableSemantics

logger = logging.getLogger(__name__)


@dataclass
class FailureAnalysis:
    """Analysis of a calculation failure."""

    failure_id: str
    category: str
    severity: str
    output_name: str
    message: str
    root_cause: str
    probable_causes: list[str]
    affected_variables: list[str]
    mitigation_suggestions: list[str]
    debug_steps: list[str]
    reference_docs: list[str]
    confidence: float

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "failure_id": self.failure_id,
            "category": self.category,
            "severity": self.severity,
            "output_name": self.output_name,
            "message": self.message,
            "root_cause": self.root_cause,
            "probable_causes": self.probable_causes,
            "affected_variables": self.affected_variables,
            "mitigation_suggestions": self.mitigation_suggestions,
            "debug_steps": self.debug_steps,
            "reference_docs": self.reference_docs,
            "confidence": self.confidence,
        }


class FailureAnalyzer:
    """Analyzes calculation failures and provides detailed analysis."""

    def __init__(self):
        """Initialize failure analyzer."""
        self.logger = logger

    def analyze(
        self,
        validation_failures: list[ValidationResult],
        variables: dict[str, Quantity],
        semantics_map: dict[str, VariableSemantics],
    ) -> list[FailureAnalysis]:
        """
        Analyze validation failures comprehensively.

        Args:
            validation_failures: List of validation failures
            variables: All variables in calculation
            semantics_map: Map of variable_id -> VariableSemantics

        Returns:
            List of FailureAnalysis objects
        """
        analyses = []
        failure_count = 0

        for failure in validation_failures:
            if failure.status == "passed":
                continue

            failure_count += 1
            analysis = self._analyze_single_failure(
                failure, variables, semantics_map, failure_count
            )
            analyses.append(analysis)

        return analyses

    def _analyze_single_failure(
        self,
        failure: ValidationResult,
        variables: dict[str, Quantity],
        semantics_map: dict[str, VariableSemantics],
        failure_count: int,
    ) -> FailureAnalysis:
        """Analyze single failure in detail."""
        semantics = semantics_map.get(failure.output_name)

        # Categorize failure
        category = self._categorize_failure(failure, semantics)

        # Determine root cause
        root_cause = self._determine_root_cause(failure, variables, semantics)

        # Find probable causes (from rule + semantic analysis)
        probable_causes = list(failure.probable_causes) if failure.probable_causes else []
        semantic_causes = self._find_semantic_causes(failure, variables, semantics)
        probable_causes.extend(semantic_causes)
        probable_causes = list(dict.fromkeys(probable_causes))[:5]  # Deduplicate, max 5

        # Generate mitigation suggestions
        mitigations = list(failure.mitigations) if failure.mitigations else []
        semantic_mitigations = self._generate_mitigations(failure, category, semantics)
        mitigations.extend(semantic_mitigations)
        mitigations = list(dict.fromkeys(mitigations))[:5]  # Deduplicate, max 5

        # Generate debug steps
        debug_steps = self._generate_debug_steps(failure, variables, semantics)

        # Find reference docs
        reference_docs = self._find_reference_docs(category, semantics)

        return FailureAnalysis(
            failure_id=f"f_{failure_count:03d}",
            category=category,
            severity=failure.severity.value,
            output_name=failure.output_name,
            message=failure.message,
            root_cause=root_cause,
            probable_causes=probable_causes,
            affected_variables=[failure.output_name],
            mitigation_suggestions=mitigations,
            debug_steps=debug_steps,
            reference_docs=reference_docs,
            confidence=0.85,
        )

    def _categorize_failure(
        self,
        failure: ValidationResult,
        semantics: Optional[VariableSemantics],
    ) -> str:
        """Categorize failure into standard categories."""
        rule_id = failure.rule_id.lower()

        # Check rule ID for category hints
        if any(x in rule_id for x in ["physical", "plausible", "implausible"]):
            return "physical_implausibility"
        elif any(x in rule_id for x in ["safety", "factor", "margin"]):
            return "safety_violation"
        elif "constraint" in rule_id:
            return "engineering_constraint"
        elif any(x in rule_id for x in ["stability", "instability", "convergence"]):
            return "numerical_instability"
        elif any(x in rule_id for x in ["range", "bound", "limit"]):
            return "range_violation"

        # Check semantic information
        if semantics:
            if "efficiency" in semantics.id.lower():
                return "physical_implausibility"
            elif "stress" in semantics.id.lower() or "pressure" in semantics.id.lower():
                return "engineering_constraint"

        return "domain_rule"

    def _determine_root_cause(
        self,
        failure: ValidationResult,
        variables: dict[str, Quantity],
        semantics: Optional[VariableSemantics],
    ) -> str:
        """Determine root cause of failure."""
        if not semantics:
            return (
                f"Validation rule '{failure.rule_name}' failed. "
                f"Check that {failure.output_name} meets condition: "
                f"{failure.expected_condition}"
            )

        # Analyze actual value vs expected
        try:
            actual_str = str(failure.actual_value).split()[0]
            actual_float = float(actual_str)
            min_val, max_val = semantics.expected_range

            if actual_float < min_val:
                return (
                    f"{semantics.name} is {actual_float:.2f} {semantics.expected_unit}, "
                    f"which is below the expected minimum of {min_val}. "
                    f"This indicates one of the following: "
                    f"(1) Input values are too low, "
                    f"(2) Calculation formula has an error, or "
                    f"(3) Physical assumptions are violated."
                )
            elif actual_float > max_val:
                return (
                    f"{semantics.name} is {actual_float:.2f} {semantics.expected_unit}, "
                    f"which exceeds the expected maximum of {max_val}. "
                    f"This indicates one of the following: "
                    f"(1) Input values are too high, "
                    f"(2) Design is inadequate, or "
                    f"(3) Calculation formula has an error."
                )
        except (ValueError, AttributeError):
            pass

        return (
            f"{semantics.name} violates constraint: {failure.expected_condition}. "
            f"Review input assumptions and calculation methodology."
        )

    def _find_semantic_causes(
        self,
        failure: ValidationResult,
        variables: dict[str, Quantity],
        semantics: Optional[VariableSemantics],
    ) -> list[str]:
        """Find probable causes from semantic analysis."""
        causes = []

        if not semantics:
            return causes

        # Add semantic failure modes
        causes.extend(semantics.failure_modes[:2])

        # Analyze input values
        for related_id in semantics.related_variables:
            if related_id in variables:
                related_var = variables[related_id]
                causes.append(
                    f"Incorrect value for {related_id}: {related_var.magnitude:.2f} {related_var.units}"
                )

        # Material/process dependent analysis
        if semantics.material_dependent:
            causes.append("Material selection may be incorrect")
        if semantics.temperature_dependent:
            causes.append("Temperature conditions may not match assumptions")
        if semantics.pressure_dependent:
            causes.append("Pressure conditions may exceed design limits")

        return causes[:3]

    def _generate_mitigations(
        self,
        failure: ValidationResult,
        category: str,
        semantics: Optional[VariableSemantics],
    ) -> list[str]:
        """Generate mitigation suggestions."""
        mitigations = []

        if category == "physical_implausibility":
            mitigations.extend([
                "Review calculation formula for correctness",
                "Verify input units and conversions",
                "Check against reference calculations or standards",
                "Reconsider physical model assumptions",
            ])

        elif category == "safety_violation":
            mitigations.extend([
                "Increase design margin or safety factor",
                "Review material selection",
                "Consider alternative design approach",
                "Consult engineering standards (ASME, ISO, etc.)",
            ])

        elif category == "engineering_constraint":
            mitigations.extend([
                "Adjust input parameters",
                "Review design constraints",
                "Verify against regulatory requirements",
                "Consider optimizing design variables",
            ])

        elif category == "numerical_instability":
            mitigations.extend([
                "Check for division by zero or near-zero values",
                "Verify input value ranges",
                "Consider alternative numerical approaches",
                "Increase precision if available",
            ])

        else:  # range_violation or domain_rule
            mitigations.extend([
                f"Ensure {failure.output_name} is within expected range",
                "Review input assumptions",
                "Verify calculation methodology",
                "Consult engineering guidelines",
            ])

        if semantics and semantics.related_variables:
            mitigations.append(
                f"Adjust parameters: {', '.join(semantics.related_variables[:3])}"
            )

        return mitigations[:5]

    def _generate_debug_steps(
        self,
        failure: ValidationResult,
        variables: dict[str, Quantity],
        semantics: Optional[VariableSemantics],
    ) -> list[str]:
        """Generate step-by-step debug procedure."""
        steps = []

        steps.append(
            f"Step 1: Verify input values are physically plausible and in expected ranges"
        )

        if semantics and semantics.related_variables:
            step_vars = ", ".join(semantics.related_variables[:3])
            steps.append(f"Step 2: Check {step_vars} for correctness")

        steps.append(
            f"Step 3: Confirm {failure.output_name} calculation matches documented formula"
        )

        steps.append(
            f"Step 4: Verify units throughout calculation ({semantics.expected_unit if semantics else 'N/A'})"
        )

        if failure.expected_condition:
            steps.append(
                f"Step 5: Validate against constraint: {failure.expected_condition}"
            )

        return steps[:4]

    def _find_reference_docs(
        self,
        category: str,
        semantics: Optional[VariableSemantics],
    ) -> list[str]:
        """Find reference documentation."""
        docs = []

        # Category-specific docs
        if category == "physical_implausibility":
            docs.append("First Law of Thermodynamics (conservation of energy)")
            docs.append("Second Law of Thermodynamics (entropy)")

        elif category == "safety_violation":
            if semantics and "piping" in semantics.discipline.value:
                docs.extend([
                    "ASME B31.1 - Power Piping Code",
                    "ASME B31.3 - Process Piping Code",
                ])

        elif category == "engineering_constraint":
            if semantics:
                docs.extend([
                    f"Engineering standards for {semantics.discipline.value}",
                    "Design guidelines and best practices",
                ])

        # Semantic docs
        if semantics:
            docs.extend(semantics.constraints[:2])

        return docs[:3]
