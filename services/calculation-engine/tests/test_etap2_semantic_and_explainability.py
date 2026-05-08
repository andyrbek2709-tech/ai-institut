"""Tests for ÉTAP 2 semantic metadata, explainability, and audit trail."""
import pytest
from datetime import datetime
import uuid

from src.engine.unit_manager import UnitManager
from src.engine.semantic_metadata import (
    VariableSemantics,
    FormulaSemanticsMetadata,
    SemanticMetadataRegistry,
    Discipline,
)
from src.engine.explainability import (
    ExplainabilityEngine,
    ExecutionExplanation,
    ValidationExplanation,
)
from src.engine.audit_trail import (
    EngineeringAuditTrail,
    AuditLogger,
    AuditEventType,
)
from src.engine.execution_graph import ExecutionPlan, ExecutionTrace


class TestVariableSemantics:
    """Tests for VariableSemantics."""

    def test_variable_semantics_creation(self):
        """Create variable semantics."""
        semantics = VariableSemantics(
            id="stress",
            name="Hoop Stress",
            engineering_meaning="Circumferential stress in pipe",
            physical_interpretation="Tensile stress around pipe",
            discipline=Discipline.PIPING,
            expected_range=(0, 1000),
            expected_unit="MPa",
            engineering_notes="Must not exceed yield strength",
            failure_modes=["Buckling", "Fracture"],
            related_variables=["pressure", "diameter"],
        )

        assert semantics.id == "stress"
        assert semantics.discipline == Discipline.PIPING
        assert len(semantics.failure_modes) == 2

    def test_variable_semantics_range_check(self):
        """Check if value is in expected range."""
        semantics = VariableSemantics(
            id="efficiency",
            name="Efficiency",
            engineering_meaning="Process efficiency",
            physical_interpretation="Fraction of theoretical work",
            discipline=Discipline.THERMAL,
            expected_range=(0.7, 0.95),
            expected_unit="dimensionless",
            engineering_notes="Typical range",
        )

        assert semantics.is_in_expected_range(0.85) is True
        assert semantics.is_in_expected_range(0.5) is False
        assert semantics.is_in_expected_range(1.1) is False

    def test_variable_semantics_serialization(self):
        """Serialize variable semantics to dictionary."""
        semantics = VariableSemantics(
            id="stress",
            name="Hoop Stress",
            engineering_meaning="Circumferential stress",
            physical_interpretation="Tensile stress",
            discipline=Discipline.PIPING,
            expected_range=(0, 1000),
            expected_unit="MPa",
            engineering_notes="Design note",
        )

        semantics_dict = semantics.to_dict()

        assert semantics_dict["id"] == "stress"
        assert semantics_dict["discipline"] == "piping"
        assert semantics_dict["expected_range"] == (0, 1000)


class TestSemanticMetadataRegistry:
    """Tests for SemanticMetadataRegistry."""

    def test_register_variable_semantics(self):
        """Register variable semantics."""
        registry = SemanticMetadataRegistry()

        semantics = VariableSemantics(
            id="stress",
            name="Stress",
            engineering_meaning="Stress value",
            physical_interpretation="Force per area",
            discipline=Discipline.PIPING,
            expected_range=(0, 1000),
            expected_unit="MPa",
            engineering_notes="Note",
        )

        registry.register_variable(semantics)

        retrieved = registry.get_variable("stress")
        assert retrieved is not None
        assert retrieved.id == "stress"

    def test_get_variables_by_discipline(self):
        """Get variables for specific discipline."""
        registry = SemanticMetadataRegistry()

        piping_var = VariableSemantics(
            id="pressure",
            name="Pressure",
            engineering_meaning="Pressure",
            physical_interpretation="Force per area",
            discipline=Discipline.PIPING,
            expected_range=(0, 100),
            expected_unit="MPa",
            engineering_notes="Note",
        )

        thermal_var = VariableSemantics(
            id="temperature",
            name="Temperature",
            engineering_meaning="Temperature",
            physical_interpretation="Heat measure",
            discipline=Discipline.THERMAL,
            expected_range=(0, 1000),
            expected_unit="K",
            engineering_notes="Note",
        )

        registry.register_variables([piping_var, thermal_var])

        piping_vars = registry.get_variables_by_discipline(Discipline.PIPING)
        assert len(piping_vars) == 1
        assert piping_vars[0].id == "pressure"

    def test_get_related_variables(self):
        """Get variables related to a variable."""
        registry = SemanticMetadataRegistry()

        stress_var = VariableSemantics(
            id="stress",
            name="Stress",
            engineering_meaning="Stress",
            physical_interpretation="Force per area",
            discipline=Discipline.PIPING,
            expected_range=(0, 1000),
            expected_unit="MPa",
            engineering_notes="Note",
            related_variables=["pressure", "diameter", "thickness"],
        )

        pressure_var = VariableSemantics(
            id="pressure",
            name="Pressure",
            engineering_meaning="Pressure",
            physical_interpretation="Force per area",
            discipline=Discipline.PIPING,
            expected_range=(0, 100),
            expected_unit="MPa",
            engineering_notes="Note",
        )

        registry.register_variables([stress_var, pressure_var])

        related = registry.get_related_variables("stress")
        # Only pressure is registered, so only 1 related
        assert len(related) == 1
        assert related[0].id == "pressure"


class TestExplainabilityEngine:
    """Tests for ExplainabilityEngine."""

    def test_explain_execution(self):
        """Generate execution explanations."""
        unit_manager = UnitManager()
        engine = ExplainabilityEngine()

        trace = ExecutionTrace(
            formula_id="stress_calc",
            expression="(P * D) / (2 * T)",
            inputs_used={
                "P": unit_manager.create_quantity(10, "MPa"),
                "D": unit_manager.create_quantity(100, "mm"),
            },
            output=100.0,
            unit="MPa",
            duration_ms=2.5,
        )

        plan = ExecutionPlan(
            formula_order=["stress_calc"],
            dependencies={"stress_calc": set()},
            dependents={"stress_calc": set()},
            required_inputs={"P", "D", "T"},
            intermediate_formulas=set(),
            output_formulas={"stress_calc"},
        )

        semantics_map = {}

        explanations = engine.explain_execution(plan, [trace], semantics_map)

        assert len(explanations) == 1
        assert explanations[0].formula_id == "stress_calc"
        assert explanations[0].step_order == 1

    def test_generate_summary(self):
        """Generate summary of explanations."""
        engine = ExplainabilityEngine()

        execution_exps = []
        validation_exps = []
        failure_exps = []

        summary = engine.generate_summary(execution_exps, validation_exps, failure_exps)

        assert summary["execution_steps"] == 0
        assert summary["validations_run"] == 0
        assert summary["failures_detected"] == 0
        assert summary["overall_status"] == "success"


class TestAuditTrail:
    """Tests for EngineeringAuditTrail."""

    def test_create_audit_trail(self):
        """Create audit trail."""
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
        )

        assert trail.calculation_id == "calc_001"
        assert trail.template_id == "template_001"
        assert trail.formula_count == 0

    def test_audit_trail_adds_entries(self):
        """Add entries to audit trail."""
        from src.engine.audit_trail import AuditTrailEntry

        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
        )

        entry = AuditTrailEntry(
            timestamp=datetime.utcnow(),
            event_type=AuditEventType.FORMULA_EXECUTION,
            details={"formula_id": "f1"},
            severity="info",
        )

        trail.add_entry(entry)

        assert len(trail.entries) == 1
        assert trail.formula_count == 1

    def test_audit_trail_duration(self):
        """Calculate audit trail duration."""
        from datetime import timedelta

        started = datetime.utcnow()
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=started,
            completed_at=started + timedelta(milliseconds=500),
        )

        duration = trail.get_execution_duration_ms()
        assert 400 < duration < 600  # Allow some variance

    def test_audit_trail_serialization(self):
        """Serialize audit trail to dictionary."""
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
        )

        trail_dict = trail.to_dict()

        assert trail_dict["calculation_id"] == "calc_001"
        assert "started_at" in trail_dict
        assert "summary" in trail_dict

    def test_audit_trail_report_generation(self):
        """Generate human-readable audit report."""
        unit_manager = UnitManager()
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
            user_id="test@example.com",
        )

        logger = AuditLogger(trail)

        pressure = unit_manager.create_quantity(10, "MPa")
        logger.log_input(
            "pressure",
            pressure,
            (0, 100),
            "MPa",
            "Internal pressure",
        )

        logger.log_calculation_completed()

        report = trail.generate_report()

        assert "ENGINEERING AUDIT TRAIL" in report
        assert "calc_001" in report
        assert "test@example.com" in report


class TestAuditLogger:
    """Tests for AuditLogger."""

    def test_log_input(self):
        """Log input variable."""
        unit_manager = UnitManager()
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
        )

        logger = AuditLogger(trail)

        pressure = unit_manager.create_quantity(10, "MPa")
        logger.log_input(
            "pressure",
            pressure,
            (0, 100),
            "MPa",
            "Internal pressure",
        )

        assert len(trail.entries) == 1
        assert trail.entries[0].event_type == AuditEventType.INPUT_CAPTURED
        assert "pressure" in trail.input_snapshot

    def test_log_formula_execution(self):
        """Log formula execution."""
        unit_manager = UnitManager()
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
        )

        logger = AuditLogger(trail)

        logger.log_formula_execution(
            formula_id="f1",
            formula_text="a + b",
            inputs_used={"a": unit_manager.create_quantity(1, "unit")},
            output=unit_manager.create_quantity(2, "unit"),
            output_unit="unit",
            duration_ms=1.5,
        )

        assert len(trail.entries) == 1
        assert trail.entries[0].event_type == AuditEventType.FORMULA_EXECUTION
        assert trail.formula_count == 1

    def test_log_validation_result(self):
        """Log validation result."""
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
        )

        logger = AuditLogger(trail)

        logger.log_validation_result(
            rule_id="rule1",
            rule_name="Test rule",
            applies_to="output",
            status="passed",
            message="Passed",
            severity="info",
        )

        assert len(trail.entries) == 1
        assert trail.entries[0].event_type == AuditEventType.VALIDATION_PASSED
        assert trail.validation_passed == 1

    def test_log_calculation_completed(self):
        """Log calculation completion."""
        trail = EngineeringAuditTrail(
            calculation_id="calc_001",
            template_id="template_001",
            started_at=datetime.utcnow(),
        )

        logger = AuditLogger(trail)
        logger.log_calculation_completed()

        assert trail.completed_at is not None
        assert trail.entries[-1].event_type == AuditEventType.CALCULATION_COMPLETED
