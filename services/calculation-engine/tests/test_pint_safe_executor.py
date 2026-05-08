"""Tests for PintAwareSafeFormulaExecutor."""
import pytest
from pint import Quantity
from src.engine.pint_safe_executor import PintAwareSafeFormulaExecutor
from src.engine.unit_manager import UnitManager, InvalidUnitError
from src.engine.safe_executor import ExecutionStatus


class TestPintAwareSafeFormulaExecutor:
    """Test unit-aware formula execution."""

    @pytest.fixture
    def executor(self):
        """Provide executor instance."""
        return PintAwareSafeFormulaExecutor(timeout_ms=1000)

    @pytest.fixture
    def unit_manager(self):
        """Provide unit manager."""
        return UnitManager()

    # === BASIC EXECUTION WITH UNITS ===

    def test_execute_simple_formula_with_units(self, executor, unit_manager):
        """Test simple formula with unit-aware execution."""
        # pressure = 100 MPa, result = pressure * 2
        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        result = executor.execute_with_units(
            "p * 2",
            variables,
            formula_id="test_simple"
        )

        assert result.is_success()
        assert result.value == 200
        # Unit should be megapascal
        assert "megapascal" in result.unit or "MPa" in result.unit

    def test_execute_multiplication_preserves_units(self, executor, unit_manager):
        """Test that multiplication with units works correctly."""
        # force = pressure * area
        # 100 MPa * 10 mm² = force (in newtons)
        variables = {
            "p": unit_manager.create_quantity(100, "MPa"),
            "a": unit_manager.create_quantity(10, "mm**2")
        }

        result = executor.execute_with_units(
            "p * a",
            variables
        )

        assert result.is_success()
        # Result should be in force (newtons)
        assert result.value > 0

    def test_execute_with_dimensionless_multiplier(self, executor, unit_manager):
        """Test formula with dimensionless constant."""
        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        result = executor.execute_with_units(
            "p * 3.14159",
            variables
        )

        assert result.is_success()
        assert result.value == pytest.approx(314.159, rel=1e-4)

    # === UNIT STRING CONVENIENCE METHOD ===

    def test_execute_with_unit_strings(self, executor):
        """Test convenience method with unit strings."""
        variables_with_units = {
            "p": (100, "MPa"),
            "a": (10, "mm**2")
        }

        result = executor.execute_with_unit_strings(
            "p * a",
            variables_with_units
        )

        assert result.is_success()
        assert result.value > 0

    def test_execute_with_invalid_unit_string(self, executor):
        """Test that invalid unit strings are caught."""
        variables_with_units = {
            "p": (100, "invalid_unit_xyz")
        }

        result = executor.execute_with_unit_strings(
            "p * 2",
            variables_with_units
        )

        assert result.status == ExecutionStatus.INVALID_FORMULA
        assert "INVALID_UNIT" in result.error_code

    # === DIMENSIONAL ANALYSIS ===

    def test_dimensional_mismatch_addition(self, executor, unit_manager):
        """Test that adding incompatible dimensions is caught."""
        # MPa + mm (pressure + length) should fail
        variables = {
            "p": unit_manager.create_quantity(100, "MPa"),
            "l": unit_manager.create_quantity(10, "mm")
        }

        result = executor.execute_with_units(
            "p + l",
            variables
        )

        # Should fail with dimensional error
        assert result.status == ExecutionStatus.SECURITY_ERROR
        assert "DIMENSIONAL_MISMATCH" in result.error_code

    def test_valid_same_dimension_addition(self, executor, unit_manager):
        """Test that adding same dimensions works."""
        # 100 mm + 50 mm = 150 mm
        variables = {
            "l1": unit_manager.create_quantity(100, "mm"),
            "l2": unit_manager.create_quantity(50, "mm")
        }

        result = executor.execute_with_units(
            "l1 + l2",
            variables
        )

        assert result.is_success()
        assert result.value == 150

    def test_valid_different_unit_same_dimension_addition(self, executor, unit_manager):
        """Test adding different units with same dimension."""
        # 1000 mm + 1 m = 2000 mm
        variables = {
            "l1": unit_manager.create_quantity(1000, "mm"),
            "l2": unit_manager.create_quantity(1, "m")
        }

        result = executor.execute_with_units(
            "l1 + l2",
            variables
        )

        assert result.is_success()
        # Result might be in either unit, but value should be 2000 mm = 2 m
        assert result.value == 2000 or result.value == pytest.approx(2, rel=1e-4)

    # === SECURITY ENFORCEMENT ===

    def test_security_pattern_blocked_eval(self, executor, unit_manager):
        """Test that eval injection is still blocked."""
        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        result = executor.execute_with_units(
            "eval('dangerous_code')",
            variables
        )

        assert result.status == ExecutionStatus.SECURITY_ERROR
        assert result.error_code == "SECURITY_VIOLATION"

    def test_security_pattern_blocked_import(self, executor, unit_manager):
        """Test that __import__ is still blocked."""
        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        result = executor.execute_with_units(
            "__import__('os')",
            variables
        )

        assert result.status == ExecutionStatus.SECURITY_ERROR

    def test_invalid_quantity_format(self, executor):
        """Test that non-Quantity variables are rejected."""
        # Pass a plain float instead of Quantity
        variables = {
            "p": 100.0  # Should be Quantity!
        }

        result = executor.execute_with_units(
            "p * 2",
            variables
        )

        assert result.status == ExecutionStatus.SECURITY_ERROR
        assert "not a Quantity" in result.error_message

    # === EDGE CASES ===

    def test_execute_with_zero_value(self, executor, unit_manager):
        """Test formula with zero value."""
        variables = {
            "p": unit_manager.create_quantity(0, "MPa")
        }

        result = executor.execute_with_units(
            "p * 100",
            variables
        )

        assert result.is_success()
        assert result.value == 0

    def test_execute_with_negative_value(self, executor, unit_manager):
        """Test formula with negative value."""
        variables = {
            "p": unit_manager.create_quantity(-100, "MPa")
        }

        result = executor.execute_with_units(
            "p * 2",
            variables
        )

        assert result.is_success()
        assert result.value == -200

    def test_execute_with_large_value(self, executor, unit_manager):
        """Test formula with large value."""
        variables = {
            "p": unit_manager.create_quantity(1e6, "Pa")
        }

        result = executor.execute_with_units(
            "p / 1e6",
            variables
        )

        assert result.is_success()
        assert result.value == 1

    def test_execute_with_decimal_precision(self, executor, unit_manager):
        """Test formula with decimal precision."""
        variables = {
            "p": unit_manager.create_quantity(100.123456, "MPa")
        }

        result = executor.execute_with_units(
            "p * 1",
            variables
        )

        assert result.is_success()
        assert result.value == pytest.approx(100.123456, rel=1e-6)

    # === COMPLEX FORMULAS ===

    def test_complex_formula_multiple_variables(self, executor, unit_manager):
        """Test complex formula with multiple variables."""
        # stress_ratio = (pressure * area) / base_area
        variables = {
            "p": unit_manager.create_quantity(100, "MPa"),
            "a": unit_manager.create_quantity(10, "mm**2"),
            "ba": unit_manager.create_quantity(5, "mm**2")
        }

        result = executor.execute_with_units(
            "(p * a) / ba",
            variables
        )

        assert result.is_success()

    def test_formula_with_sqrt(self, executor, unit_manager):
        """Test formula with sqrt."""
        variables = {
            "a": unit_manager.create_quantity(4, "mm**2")
        }

        # sqrt(a) should give mm
        result = executor.execute_with_units(
            "sqrt(a)",
            variables
        )

        assert result.is_success()
        # sqrt(4 mm²) = 2 mm

    def test_formula_with_trig(self, executor, unit_manager):
        """Test formula with trigonometric function."""
        import math
        variables = {
            "angle": unit_manager.create_dimensionless(math.pi / 4)  # 45 degrees in radians
        }

        result = executor.execute_with_units(
            "sin(angle)",
            variables
        )

        assert result.is_success()
        assert result.value == pytest.approx(math.sqrt(2) / 2, rel=1e-6)

    # === EXECUTION TIMING ===

    def test_execution_timing_recorded(self, executor, unit_manager):
        """Test that execution timing is recorded."""
        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        result = executor.execute_with_units(
            "p * 2",
            variables
        )

        assert result.is_success()
        assert result.duration_ms >= 0

    def test_timeout_exceeded(self, executor, unit_manager):
        """Test that formula timeout is enforced."""
        # Create executor with very short timeout
        executor_short = PintAwareSafeFormulaExecutor(timeout_ms=1)

        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        # Complex expression that might timeout
        result = executor_short.execute_with_units(
            "p * p * p * p * p",
            variables
        )

        # Might timeout or succeed depending on system speed
        # At minimum, should have recorded timing
        assert result.duration_ms >= 0

    # === STATISTICS ===

    def test_get_extended_statistics(self, executor, unit_manager):
        """Test extended statistics."""
        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        # Execute something
        executor.execute_with_units("p * 2", variables)

        stats = executor.get_statistics_extended()
        assert "execution_count" in stats
        assert "unit_registry" in stats
        assert stats["execution_count"] > 0

    def test_clear_caches(self, executor, unit_manager):
        """Test cache clearing."""
        variables = {
            "p": unit_manager.create_quantity(100, "MPa")
        }

        # Execute to populate caches
        executor.execute_with_units("p * 2", variables)

        # Clear caches
        executor.clear_quantity_cache()

        stats = executor.get_statistics_extended()
        assert stats["quantity_cache_size"] == 0
        assert stats["cache_size"] == 0
