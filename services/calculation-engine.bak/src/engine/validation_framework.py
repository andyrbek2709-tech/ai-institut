"""Engineering validation framework for semantic correctness checking."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional, Callable
from datetime import datetime
from pint import Quantity
import logging

logger = logging.getLogger(__name__)


class SeverityLevel(str, Enum):
    """Validation result severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    FAILURE = "failure"


class FailureCategory(str, Enum):
    """Categories of calculation failures."""
    PHYSICAL_IMPLAUSIBILITY = "physical_implausibility"
    ENGINEERING_CONSTRAINT = "engineering_constraint"
    SAFETY_VIOLATION = "safety_violation"
    NUMERICAL_INSTABILITY = "numerical_instability"
    INPUT_ERROR = "input_error"
    FORMULA_ERROR = "formula_error"
    UNIT_ERROR = "unit_error"
    DOMAIN_RULE = "domain_rule"


@dataclass
class ValidationResult:
    """Result of a single validation check."""
    rule_id: str
    rule_name: str
    output_name: str
    status: str  # "passed", "failed", "warning"
    severity: SeverityLevel
    message: str
    engineering_notes: str = ""
    actual_value: Optional[str] = None
    expected_condition: Optional[str] = None
    probable_causes: list[str] = field(default_factory=list)
    mitigations: list[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary for serialization."""
        return {
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "output_name": self.output_name,
            "status": self.status,
            "severity": self.severity.value,
            "message": self.message,
            "engineering_notes": self.engineering_notes,
            "actual_value": self.actual_value,
            "expected_condition": self.expected_condition,
            "probable_causes": self.probable_causes,
            "mitigations": self.mitigations,
            "timestamp": self.timestamp.isoformat(),
        }


class ValidationRule(ABC):
    """Base class for engineering validation rules."""

    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        applies_to: str,
        severity: SeverityLevel,
        message: str,
        engineering_notes: str = "",
        probable_causes: Optional[list[str]] = None,
        mitigations: Optional[list[str]] = None,
    ):
        """
        Initialize validation rule.

        Args:
            rule_id: Unique rule identifier
            rule_name: Human-readable rule name
            applies_to: Which output this rule applies to
            severity: Severity level (INFO, WARNING, ERROR, FAILURE)
            message: User message when rule fails
            engineering_notes: Engineering context
            probable_causes: List of probable causes if rule fails
            mitigations: Mitigation suggestions
        """
        self.rule_id = rule_id
        self.rule_name = rule_name
        self.applies_to = applies_to
        self.severity = severity
        self.message = message
        self.engineering_notes = engineering_notes
        self.probable_causes = probable_causes or []
        self.mitigations = mitigations or []

    @abstractmethod
    def evaluate(
        self,
        output_name: str,
        output_value: Quantity,
        variables: dict[str, Quantity],
    ) -> Optional[ValidationResult]:
        """
        Evaluate rule against output.

        Returns:
            ValidationResult if rule fails, None if passes.
        """
        pass

    def _format_value(self, value: Any) -> str:
        """Format value for display."""
        if isinstance(value, Quantity):
            return f"{value.magnitude:.2f} {value.units}"
        return str(value)


class PhysicalPlausibilityRule(ValidationRule):
    """Validates that output is physically plausible."""

    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        applies_to: str,
        check_func: Callable[[float], bool],
        expected_condition: str,
        message: str = "Output violates physical law",
        severity: SeverityLevel = SeverityLevel.ERROR,
        **kwargs,
    ):
        """
        Initialize physical plausibility rule.

        Args:
            rule_id: Unique rule ID
            rule_name: Human-readable name
            applies_to: Which output applies to
            check_func: Function that returns True if valid (value: float) -> bool
            expected_condition: String describing valid condition (for user message)
            message: User message
            severity: Severity level
        """
        super().__init__(
            rule_id=rule_id,
            rule_name=rule_name,
            applies_to=applies_to,
            severity=severity,
            message=message,
            **kwargs,
        )
        self.check_func = check_func
        self.expected_condition = expected_condition

    def evaluate(
        self,
        output_name: str,
        output_value: Quantity,
        variables: dict[str, Quantity],
    ) -> Optional[ValidationResult]:
        """Evaluate physical plausibility."""
        if output_name != self.applies_to:
            return None

        try:
            is_valid = self.check_func(output_value.magnitude)
            if is_valid:
                return None

            return ValidationResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                output_name=output_name,
                status="failed",
                severity=self.severity,
                message=self.message,
                engineering_notes=self.engineering_notes,
                actual_value=self._format_value(output_value),
                expected_condition=self.expected_condition,
                probable_causes=self.probable_causes,
                mitigations=self.mitigations,
            )
        except Exception as e:
            logger.error(f"Error evaluating rule {self.rule_id}: {e}")
            return None


class RangeCheckRule(ValidationRule):
    """Validates that output is within expected range."""

    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        applies_to: str,
        min_value: Optional[float] = None,
        max_value: Optional[float] = None,
        message: str = "Output outside expected range",
        **kwargs,
    ):
        """
        Initialize range check rule.

        Args:
            rule_id: Unique rule ID
            rule_name: Human-readable name
            applies_to: Which output applies to
            min_value: Minimum acceptable value (or None for no minimum)
            max_value: Maximum acceptable value (or None for no maximum)
            message: User message
        """
        super().__init__(
            rule_id=rule_id,
            rule_name=rule_name,
            applies_to=applies_to,
            message=message,
            **kwargs,
        )
        self.min_value = min_value
        self.max_value = max_value

    def evaluate(
        self,
        output_name: str,
        output_value: Quantity,
        variables: dict[str, Quantity],
    ) -> Optional[ValidationResult]:
        """Evaluate range."""
        if output_name != self.applies_to:
            return None

        magnitude = output_value.magnitude

        # Check minimum
        if self.min_value is not None and magnitude < self.min_value:
            return ValidationResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                output_name=output_name,
                status="failed",
                severity=self.severity,
                message=self.message,
                engineering_notes=self.engineering_notes,
                actual_value=self._format_value(output_value),
                expected_condition=f">= {self.min_value}",
                probable_causes=self.probable_causes,
                mitigations=self.mitigations,
            )

        # Check maximum
        if self.max_value is not None and magnitude > self.max_value:
            return ValidationResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                output_name=output_name,
                status="failed",
                severity=self.severity,
                message=self.message,
                engineering_notes=self.engineering_notes,
                actual_value=self._format_value(output_value),
                expected_condition=f"<= {self.max_value}",
                probable_causes=self.probable_causes,
                mitigations=self.mitigations,
            )

        return None


class EngineeringConstraintRule(ValidationRule):
    """Validates custom engineering constraint."""

    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        applies_to: str,
        constraint_func: Callable[[dict[str, Quantity]], bool],
        expected_condition: str,
        message: str = "Engineering constraint violated",
        **kwargs,
    ):
        """
        Initialize constraint rule.

        Args:
            rule_id: Unique rule ID
            rule_name: Human-readable name
            applies_to: Which output applies to
            constraint_func: Function checking constraint (variables dict) -> bool
            expected_condition: Description of constraint
            message: User message
        """
        super().__init__(
            rule_id=rule_id,
            rule_name=rule_name,
            applies_to=applies_to,
            message=message,
            **kwargs,
        )
        self.constraint_func = constraint_func
        self.expected_condition = expected_condition

    def evaluate(
        self,
        output_name: str,
        output_value: Quantity,
        variables: dict[str, Quantity],
    ) -> Optional[ValidationResult]:
        """Evaluate constraint."""
        if output_name != self.applies_to:
            return None

        try:
            is_satisfied = self.constraint_func(variables)
            if is_satisfied:
                return None

            return ValidationResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                output_name=output_name,
                status="failed",
                severity=self.severity,
                message=self.message,
                engineering_notes=self.engineering_notes,
                actual_value=self._format_value(output_value),
                expected_condition=self.expected_condition,
                probable_causes=self.probable_causes,
                mitigations=self.mitigations,
            )
        except Exception as e:
            logger.error(f"Error evaluating constraint {self.rule_id}: {e}")
            return None


class SafetyFactorRule(ValidationRule):
    """Validates that safety factor meets minimum."""

    def __init__(
        self,
        rule_id: str,
        rule_name: str,
        applies_to: str,
        minimum_safety_factor: float,
        message: str = "Safety factor below minimum",
        **kwargs,
    ):
        """
        Initialize safety factor rule.

        Args:
            rule_id: Unique rule ID
            rule_name: Human-readable name
            applies_to: Which output (typically safety_factor)
            minimum_safety_factor: Minimum required safety factor
            message: User message
        """
        super().__init__(
            rule_id=rule_id,
            rule_name=rule_name,
            applies_to=applies_to,
            message=message,
            **kwargs,
        )
        self.minimum = minimum_safety_factor

    def evaluate(
        self,
        output_name: str,
        output_value: Quantity,
        variables: dict[str, Quantity],
    ) -> Optional[ValidationResult]:
        """Evaluate safety factor."""
        if output_name != self.applies_to:
            return None

        magnitude = output_value.magnitude

        if magnitude < self.minimum:
            return ValidationResult(
                rule_id=self.rule_id,
                rule_name=self.rule_name,
                output_name=output_name,
                status="failed",
                severity=self.severity,
                message=self.message,
                engineering_notes=self.engineering_notes,
                actual_value=self._format_value(output_value),
                expected_condition=f">= {self.minimum}",
                probable_causes=self.probable_causes,
                mitigations=self.mitigations,
            )

        return None


class EngineeringValidationEngine:
    """Evaluates all validation rules for calculation."""

    def __init__(self):
        """Initialize validation engine."""
        self.rules: list[ValidationRule] = []
        self.logger = logger

    def add_rule(self, rule: ValidationRule) -> None:
        """Add validation rule."""
        self.rules.append(rule)

    def add_rules(self, rules: list[ValidationRule]) -> None:
        """Add multiple validation rules."""
        self.rules.extend(rules)

    def validate(
        self,
        output_name: str,
        output_value: Quantity,
        variables: dict[str, Quantity],
    ) -> list[ValidationResult]:
        """
        Validate output against all applicable rules.

        Args:
            output_name: Name of output variable
            output_value: Output value with units
            variables: All variables (for constraint checks)

        Returns:
            List of ValidationResult objects (empty if all pass)
        """
        results = []

        for rule in self.rules:
            try:
                result = rule.evaluate(output_name, output_value, variables)
                if result is not None:
                    results.append(result)
            except Exception as e:
                self.logger.error(f"Error evaluating rule {rule.rule_id}: {e}")

        return results

    def validate_all_outputs(
        self,
        outputs: dict[str, Quantity],
        variables: dict[str, Quantity],
    ) -> dict[str, list[ValidationResult]]:
        """
        Validate all outputs.

        Args:
            outputs: dict of output_name -> Quantity
            variables: All variables

        Returns:
            dict of output_name -> list of ValidationResults
        """
        all_results = {}

        for output_name, output_value in outputs.items():
            results = self.validate(output_name, output_value, variables)
            if results:
                all_results[output_name] = results

        return all_results

    def get_failure_summary(
        self,
        results: dict[str, list[ValidationResult]],
    ) -> dict[str, int]:
        """
        Get summary of validation failures.

        Returns:
            dict of severity -> count
        """
        summary = {
            "passed": 0,
            "info": 0,
            "warning": 0,
            "error": 0,
            "failure": 0,
        }

        for output_results in results.values():
            for result in output_results:
                summary[result.severity.value] += 1

        return summary
