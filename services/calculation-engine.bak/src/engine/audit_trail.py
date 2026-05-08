"""Engineering audit trail system - full calculation traceability."""
from dataclasses import dataclass, field
from typing import Any, Optional
from datetime import datetime
from enum import Enum
from pint import Quantity
import logging
import json

logger = logging.getLogger(__name__)


class AuditEventType(str, Enum):
    """Types of audit trail events."""
    CALCULATION_STARTED = "calculation_started"
    INPUT_CAPTURED = "input_captured"
    FORMULA_EXECUTION = "formula_execution"
    VALIDATION_EXECUTED = "validation_executed"
    VALIDATION_PASSED = "validation_passed"
    VALIDATION_FAILED = "validation_failed"
    FAILURE_DETECTED = "failure_detected"
    CALCULATION_COMPLETED = "calculation_completed"
    ERROR_OCCURRED = "error_occurred"


@dataclass
class AuditTrailEntry:
    """Single entry in engineering audit trail."""

    timestamp: datetime
    event_type: AuditEventType
    details: dict[str, Any]
    severity: str  # "info", "warning", "error", "failure"
    user_id: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "details": self.details,
            "severity": self.severity,
            "user_id": self.user_id,
        }


@dataclass
class EngineeringAuditTrail:
    """Complete engineering audit trail for a calculation."""

    calculation_id: str
    template_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    user_id: Optional[str] = None
    entries: list[AuditTrailEntry] = field(default_factory=list)

    # Snapshots
    input_snapshot: dict[str, Any] = field(default_factory=dict)
    output_snapshot: dict[str, Any] = field(default_factory=dict)

    # Summary
    formula_count: int = 0
    validation_rules_run: int = 0
    validation_passed: int = 0
    validation_failed: int = 0
    warnings_issued: int = 0
    errors_encountered: int = 0

    def add_entry(self, entry: AuditTrailEntry) -> None:
        """Add entry to trail."""
        self.entries.append(entry)

        # Update counters
        if entry.event_type == AuditEventType.FORMULA_EXECUTION:
            self.formula_count += 1
        elif entry.event_type == AuditEventType.VALIDATION_EXECUTED:
            self.validation_rules_run += 1
        elif entry.event_type == AuditEventType.VALIDATION_PASSED:
            self.validation_passed += 1
        elif entry.event_type == AuditEventType.VALIDATION_FAILED:
            self.validation_failed += 1
            if entry.severity == "warning":
                self.warnings_issued += 1
        elif entry.event_type == AuditEventType.ERROR_OCCURRED:
            self.errors_encountered += 1

    def get_execution_duration_ms(self) -> float:
        """Get total execution duration in milliseconds."""
        if self.completed_at is None:
            return 0.0
        delta = self.completed_at - self.started_at
        return delta.total_seconds() * 1000

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "calculation_id": self.calculation_id,
            "template_id": self.template_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat()
            if self.completed_at
            else None,
            "user_id": self.user_id,
            "duration_ms": self.get_execution_duration_ms(),
            "input_snapshot": self.input_snapshot,
            "output_snapshot": self.output_snapshot,
            "summary": {
                "formula_count": self.formula_count,
                "validation_rules_run": self.validation_rules_run,
                "validation_passed": self.validation_passed,
                "validation_failed": self.validation_failed,
                "warnings_issued": self.warnings_issued,
                "errors_encountered": self.errors_encountered,
            },
            "entries": [entry.to_dict() for entry in self.entries],
        }

    def generate_report(self) -> str:
        """Generate human-readable audit report."""
        lines = []

        lines.append("=" * 80)
        lines.append("ENGINEERING AUDIT TRAIL REPORT")
        lines.append("=" * 80)
        lines.append("")

        # Header
        lines.append(f"Calculation ID: {self.calculation_id}")
        lines.append(f"Template ID:    {self.template_id}")
        lines.append(f"Started:        {self.started_at.isoformat()}")
        if self.completed_at:
            lines.append(f"Completed:      {self.completed_at.isoformat()}")
            lines.append(f"Duration:       {self.get_execution_duration_ms():.1f} ms")
        if self.user_id:
            lines.append(f"User:           {self.user_id}")
        lines.append("")

        # Summary
        lines.append("EXECUTION SUMMARY")
        lines.append("-" * 80)
        lines.append(f"Formulas Executed:         {self.formula_count}")
        lines.append(f"Validation Rules Run:      {self.validation_rules_run}")
        lines.append(f"Validations Passed:        {self.validation_passed}")
        lines.append(f"Validations Failed:        {self.validation_failed}")
        lines.append(f"Warnings Issued:           {self.warnings_issued}")
        lines.append(f"Errors Encountered:        {self.errors_encountered}")
        lines.append("")

        # Input snapshot
        if self.input_snapshot:
            lines.append("INPUT SNAPSHOT")
            lines.append("-" * 80)
            for input_name, input_value in self.input_snapshot.items():
                lines.append(f"  {input_name}: {input_value}")
            lines.append("")

        # Output snapshot
        if self.output_snapshot:
            lines.append("OUTPUT SNAPSHOT")
            lines.append("-" * 80)
            for output_name, output_value in self.output_snapshot.items():
                lines.append(f"  {output_name}: {output_value}")
            lines.append("")

        # Events
        lines.append("EVENT LOG")
        lines.append("-" * 80)
        for i, entry in enumerate(self.entries, 1):
            lines.append(
                f"{i:3d}. [{entry.timestamp.isoformat()}] "
                f"{entry.event_type.value.upper()} "
                f"({entry.severity.upper()})"
            )
            for key, value in entry.details.items():
                if isinstance(value, dict):
                    lines.append(f"      {key}:")
                    for k, v in value.items():
                        lines.append(f"        {k}: {v}")
                elif isinstance(value, list):
                    lines.append(f"      {key}: [{', '.join(str(v) for v in value)}]")
                else:
                    lines.append(f"      {key}: {value}")

        lines.append("")
        lines.append("=" * 80)

        return "\n".join(lines)


class AuditLogger:
    """Logs events to audit trail."""

    def __init__(self, audit_trail: EngineeringAuditTrail):
        """Initialize audit logger."""
        self.trail = audit_trail
        self.logger = logger

    def log_input(
        self,
        variable_name: str,
        value: Quantity,
        expected_range: tuple[float, float],
        expected_unit: str,
        engineering_meaning: str,
    ) -> None:
        """Log input variable capture."""
        entry = AuditTrailEntry(
            timestamp=datetime.utcnow(),
            event_type=AuditEventType.INPUT_CAPTURED,
            details={
                "variable": variable_name,
                "value": value.magnitude,
                "unit": str(value.units),
                "expected_range": expected_range,
                "expected_unit": expected_unit,
                "engineering_meaning": engineering_meaning,
            },
            severity="info",
        )
        self.trail.add_entry(entry)

        # Update input snapshot
        self.trail.input_snapshot[variable_name] = (
            f"{value.magnitude:.4g} {value.units}"
        )

    def log_formula_execution(
        self,
        formula_id: str,
        formula_text: str,
        inputs_used: dict[str, Any],
        output: Any,
        output_unit: Optional[str],
        duration_ms: float,
    ) -> None:
        """Log formula execution."""
        entry = AuditTrailEntry(
            timestamp=datetime.utcnow(),
            event_type=AuditEventType.FORMULA_EXECUTION,
            details={
                "formula_id": formula_id,
                "formula_text": formula_text,
                "inputs": {
                    k: f"{v.magnitude:.4g} {v.units}"
                    if isinstance(v, Quantity)
                    else str(v)
                    for k, v in inputs_used.items()
                },
                "output": output.magnitude if isinstance(output, Quantity) else output,
                "output_unit": output_unit or str(output.units)
                if isinstance(output, Quantity)
                else None,
                "duration_ms": duration_ms,
            },
            severity="info",
        )
        self.trail.add_entry(entry)

    def log_validation_executed(
        self,
        rule_id: str,
        rule_name: str,
        applies_to: str,
    ) -> None:
        """Log validation rule execution."""
        entry = AuditTrailEntry(
            timestamp=datetime.utcnow(),
            event_type=AuditEventType.VALIDATION_EXECUTED,
            details={
                "rule_id": rule_id,
                "rule_name": rule_name,
                "applies_to": applies_to,
            },
            severity="info",
        )
        self.trail.add_entry(entry)

    def log_validation_result(
        self,
        rule_id: str,
        rule_name: str,
        applies_to: str,
        status: str,
        message: str,
        severity: str,
    ) -> None:
        """Log validation result."""
        if status == "passed":
            event_type = AuditEventType.VALIDATION_PASSED
        else:
            event_type = AuditEventType.VALIDATION_FAILED

        entry = AuditTrailEntry(
            timestamp=datetime.utcnow(),
            event_type=event_type,
            details={
                "rule_id": rule_id,
                "rule_name": rule_name,
                "applies_to": applies_to,
                "status": status,
                "message": message,
            },
            severity=severity,
        )
        self.trail.add_entry(entry)

    def log_failure(
        self,
        failure_id: str,
        failure_type: str,
        affected_variable: str,
        message: str,
        root_cause: str,
    ) -> None:
        """Log failure detection."""
        entry = AuditTrailEntry(
            timestamp=datetime.utcnow(),
            event_type=AuditEventType.FAILURE_DETECTED,
            details={
                "failure_id": failure_id,
                "failure_type": failure_type,
                "affected_variable": affected_variable,
                "message": message,
                "root_cause": root_cause,
            },
            severity="failure",
        )
        self.trail.add_entry(entry)

    def log_error(
        self,
        error_message: str,
        error_type: str,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        """Log error occurrence."""
        entry = AuditTrailEntry(
            timestamp=datetime.utcnow(),
            event_type=AuditEventType.ERROR_OCCURRED,
            details={
                "error_type": error_type,
                "message": error_message,
                "details": details or {},
            },
            severity="error",
        )
        self.trail.add_entry(entry)

    def log_calculation_completed(self) -> None:
        """Log calculation completion."""
        self.trail.completed_at = datetime.utcnow()

        entry = AuditTrailEntry(
            timestamp=self.trail.completed_at,
            event_type=AuditEventType.CALCULATION_COMPLETED,
            details={
                "duration_ms": self.trail.get_execution_duration_ms(),
                "formula_count": self.trail.formula_count,
                "validation_count": self.trail.validation_rules_run,
                "failures": self.trail.validation_failed,
            },
            severity="info",
        )
        self.trail.add_entry(entry)
