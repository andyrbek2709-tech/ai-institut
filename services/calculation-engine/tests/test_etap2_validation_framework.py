"""Tests for ÉTAP 2 validation framework."""
import pytest
from datetime import datetime
from pint import Quantity

from src.engine.unit_manager import UnitManager
from src.engine.validation_framework import (
    EngineeringValidationEngine,
    PhysicalPlausibilityRule,
    RangeCheckRule,
    EngineeringConstraintRule,
    SafetyFactorRule,
    SeverityLevel,
    ValidationResult,
)


@pytest.fixture
def unit_manager():
    """Create unit manager."""
    return UnitManager()


@pytest.fixture
def validation_engine():
    """Create validation engine."""
    return EngineeringValidationEngine()


class TestPhysicalPlausibilityRule:
    """Tests for PhysicalPlausibilityRule."""

    def test_rule_passes_when_check_true(self, unit_manager, validation_engine):
        """Rule passes when check function returns True."""
        rule = PhysicalPlausibilityRule(
            rule_id="test_positive",
            rule_name="Value must be positive",
            applies_to="output",
            check_func=lambda x: x > 0,
            expected_condition="output > 0",
        )

        value = unit_manager.create_quantity(10, "MPa")
        result = rule.evaluate("output", value, {})

        assert result is None  # No failure

    def test_rule_fails_when_check_false(self, unit_manager):
        """Rule fails when check function returns False."""
        rule = PhysicalPlausibilityRule(
            rule_id="test_positive",
            rule_name="Value must be positive",
            applies_to="output",
            check_func=lambda x: x > 0,
            expected_condition="output > 0",
            message="Value must be positive",
        )

        value = unit_manager.create_quantity(-10, "MPa")
        result = rule.evaluate("output", value, {})

        assert result is not None
        assert result.status == "failed"
        assert result.message == "Value must be positive"

    def test_rule_ignores_wrong_output(self, unit_manager):
        """Rule ignores outputs that don't apply."""
        rule = PhysicalPlausibilityRule(
            rule_id="test_positive",
            rule_name="Value must be positive",
            applies_to="output_a",
            check_func=lambda x: x > 0,
            expected_condition="output_a > 0",
        )

        value = unit_manager.create_quantity(-10, "MPa")
        result = rule.evaluate("output_b", value, {})

        assert result is None


class TestRangeCheckRule:
    """Tests for RangeCheckRule."""

    def test_range_check_passes_within_bounds(self, unit_manager):
        """Range check passes when value is within bounds."""
        rule = RangeCheckRule(
            rule_id="stress_range",
            rule_name="Stress in range",
            applies_to="stress",
            min_value=0.0,
            max_value=300.0,
        )

        value = unit_manager.create_quantity(150, "MPa")
        result = rule.evaluate("stress", value, {})

        assert result is None

    def test_range_check_fails_below_minimum(self, unit_manager):
        """Range check fails when value is below minimum."""
        rule = RangeCheckRule(
            rule_id="stress_range",
            rule_name="Stress in range",
            applies_to="stress",
            min_value=0.0,
            max_value=300.0,
            message="Stress out of range",
        )

        value = unit_manager.create_quantity(-50, "MPa")
        result = rule.evaluate("stress", value, {})

        assert result is not None
        assert result.status == "failed"

    def test_range_check_fails_above_maximum(self, unit_manager):
        """Range check fails when value is above maximum."""
        rule = RangeCheckRule(
            rule_id="stress_range",
            rule_name="Stress in range",
            applies_to="stress",
            min_value=0.0,
            max_value=300.0,
            message="Stress out of range",
        )

        value = unit_manager.create_quantity(400, "MPa")
        result = rule.evaluate("stress", value, {})

        assert result is not None
        assert result.status == "failed"

    def test_range_check_with_only_minimum(self, unit_manager):
        """Range check with only minimum bound."""
        rule = RangeCheckRule(
            rule_id="test_min",
            rule_name="Minimum check",
            applies_to="output",
            min_value=10.0,
        )

        # Pass: above minimum
        value_pass = unit_manager.create_quantity(20, "unit")
        result_pass = rule.evaluate("output", value_pass, {})
        assert result_pass is None

        # Fail: below minimum
        value_fail = unit_manager.create_quantity(5, "unit")
        result_fail = rule.evaluate("output", value_fail, {})
        assert result_fail is not None


class TestEngineeringConstraintRule:
    """Tests for EngineeringConstraintRule."""

    def test_constraint_passes_when_satisfied(self, unit_manager):
        """Constraint passes when condition is met."""
        def check_constraint(variables):
            thickness = variables.get("thickness")
            diameter = variables.get("diameter")
            if thickness and diameter:
                return thickness.magnitude < diameter.magnitude / 2
            return True

        rule = EngineeringConstraintRule(
            rule_id="thin_wall",
            rule_name="Thin wall assumption",
            applies_to="stress",
            constraint_func=check_constraint,
            expected_condition="thickness < diameter / 2",
        )

        variables = {
            "thickness": unit_manager.create_quantity(5, "mm"),
            "diameter": unit_manager.create_quantity(100, "mm"),
        }

        value = unit_manager.create_quantity(100, "MPa")
        result = rule.evaluate("stress", value, variables)

        assert result is None

    def test_constraint_fails_when_unsatisfied(self, unit_manager):
        """Constraint fails when condition is not met."""
        def check_constraint(variables):
            thickness = variables.get("thickness")
            diameter = variables.get("diameter")
            if thickness and diameter:
                return thickness.magnitude < diameter.magnitude / 2
            return True

        rule = EngineeringConstraintRule(
            rule_id="thin_wall",
            rule_name="Thin wall assumption",
            applies_to="stress",
            constraint_func=check_constraint,
            expected_condition="thickness < diameter / 2",
            message="Not a thin-walled pipe",
        )

        variables = {
            "thickness": unit_manager.create_quantity(60, "mm"),  # Too thick
            "diameter": unit_manager.create_quantity(100, "mm"),
        }

        value = unit_manager.create_quantity(100, "MPa")
        result = rule.evaluate("stress", value, variables)

        assert result is not None
        assert result.status == "failed"


class TestSafetyFactorRule:
    """Tests for SafetyFactorRule."""

    def test_safety_factor_passes_when_adequate(self, unit_manager):
        """Safety factor passes when >= minimum."""
        rule = SafetyFactorRule(
            rule_id="safety_adequate",
            rule_name="Adequate safety factor",
            applies_to="safety_factor",
            minimum_safety_factor=1.5,
        )

        value = unit_manager.create_quantity(2.0, "dimensionless")
        result = rule.evaluate("safety_factor", value, {})

        assert result is None

    def test_safety_factor_fails_when_inadequate(self, unit_manager):
        """Safety factor fails when < minimum."""
        rule = SafetyFactorRule(
            rule_id="safety_adequate",
            rule_name="Adequate safety factor",
            applies_to="safety_factor",
            minimum_safety_factor=1.5,
            message="Safety factor too low",
        )

        value = unit_manager.create_quantity(1.0, "dimensionless")
        result = rule.evaluate("safety_factor", value, {})

        assert result is not None
        assert result.status == "failed"


class TestValidationEngine:
    """Tests for EngineeringValidationEngine."""

    def test_engine_validates_single_output(self, validation_engine, unit_manager):
        """Engine validates single output against all applicable rules."""
        rule1 = RangeCheckRule(
            rule_id="rule1",
            rule_name="Rule 1",
            applies_to="output",
            min_value=0,
            max_value=100,
        )

        rule2 = PhysicalPlausibilityRule(
            rule_id="rule2",
            rule_name="Rule 2",
            applies_to="output",
            check_func=lambda x: x != 50,
            expected_condition="output != 50",
        )

        validation_engine.add_rules([rule1, rule2])

        # Value that passes both
        value_pass = unit_manager.create_quantity(75, "unit")
        results = validation_engine.validate("output", value_pass, {})
        assert len(results) == 0

        # Value that fails rule2
        value_fail = unit_manager.create_quantity(50, "unit")
        results = validation_engine.validate("output", value_fail, {})
        assert len(results) == 1
        assert results[0].rule_id == "rule2"

    def test_engine_validates_multiple_outputs(self, validation_engine, unit_manager):
        """Engine validates multiple outputs separately."""
        rule_stress = RangeCheckRule(
            rule_id="stress_range",
            rule_name="Stress range",
            applies_to="stress",
            min_value=0,
            max_value=300,
        )

        rule_efficiency = RangeCheckRule(
            rule_id="efficiency_range",
            rule_name="Efficiency range",
            applies_to="efficiency",
            min_value=0,
            max_value=1,
        )

        validation_engine.add_rules([rule_stress, rule_efficiency])

        outputs = {
            "stress": unit_manager.create_quantity(100, "MPa"),
            "efficiency": unit_manager.create_quantity(0.85, "dimensionless"),
        }

        variables = {}

        all_results = validation_engine.validate_all_outputs(outputs, variables)

        assert len(all_results) == 0  # All pass

    def test_engine_generates_failure_summary(self, validation_engine, unit_manager):
        """Engine generates summary of validation failures."""
        rule1 = RangeCheckRule(
            rule_id="rule1",
            rule_name="Rule 1",
            applies_to="output",
            min_value=0,
            max_value=100,
        )

        validation_engine.add_rule(rule1)

        value = unit_manager.create_quantity(150, "unit")
        results = validation_engine.validate("output", value, {})

        summary = validation_engine.get_failure_summary({"output": results})

        assert summary["error"] == 0
        assert summary["failure"] == 0
        assert summary["warning"] == 0


class TestValidationResult:
    """Tests for ValidationResult."""

    def test_validation_result_serialization(self):
        """ValidationResult converts to dictionary."""
        result = ValidationResult(
            rule_id="test_rule",
            rule_name="Test Rule",
            output_name="output",
            status="failed",
            severity=SeverityLevel.ERROR,
            message="Test message",
            engineering_notes="Test notes",
            actual_value="100 MPa",
            expected_condition="< 50 MPa",
            probable_causes=["Cause 1", "Cause 2"],
            mitigations=["Fix 1", "Fix 2"],
        )

        result_dict = result.to_dict()

        assert result_dict["rule_id"] == "test_rule"
        assert result_dict["status"] == "failed"
        assert result_dict["severity"] == "error"
        assert result_dict["actual_value"] == "100 MPa"
        assert len(result_dict["probable_causes"]) == 2
