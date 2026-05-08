"""Tests for UnitManager and dimensional analysis."""
import pytest
from pint import Quantity
from src.engine.unit_manager import UnitManager, InvalidUnitError
from src.engine.dimensional_analysis import (
    DimensionalAnalyzer,
    DimensionalAnalysisError
)
import sympy as sp


class TestUnitManager:
    """Test UnitManager functionality."""

    @pytest.fixture
    def unit_manager(self):
        """Provide UnitManager instance."""
        return UnitManager()

    # === BASIC QUANTITY CREATION ===

    def test_create_quantity_basic(self, unit_manager):
        """Test basic quantity creation."""
        qty = unit_manager.create_quantity(100, "MPa")
        assert float(qty.magnitude) == 100
        assert str(qty.units) == "megapascal"

    def test_create_quantity_with_mm(self, unit_manager):
        """Test quantity with millimeters."""
        qty = unit_manager.create_quantity(50, "mm")
        assert float(qty.magnitude) == 50
        assert str(qty.units) == "millimeter"

    def test_create_quantity_newton(self, unit_manager):
        """Test Newton (force) unit."""
        qty = unit_manager.create_quantity(1000, "N")
        assert float(qty.magnitude) == 1000
        assert str(qty.units) == "newton"

    def test_create_quantity_complex_unit(self, unit_manager):
        """Test complex unit (N/mm²)."""
        qty = unit_manager.create_quantity(100, "N/mm**2")
        assert float(qty.magnitude) == 100
        # Pint normalizes to base units internally

    def test_create_quantity_kpa(self, unit_manager):
        """Test kPa unit."""
        qty = unit_manager.create_quantity(200, "kPa")
        assert float(qty.magnitude) == 200

    def test_create_quantity_bar(self, unit_manager):
        """Test bar unit."""
        qty = unit_manager.create_quantity(1.5, "bar")
        assert float(qty.magnitude) == 1.5

    # === INVALID UNITS ===

    def test_create_quantity_invalid_unit(self, unit_manager):
        """Test that invalid unit raises error."""
        with pytest.raises(InvalidUnitError):
            unit_manager.create_quantity(100, "invalid_unit_xyz")

    def test_create_quantity_empty_unit(self, unit_manager):
        """Test that empty unit string raises error."""
        with pytest.raises(ValueError):
            unit_manager.create_quantity(100, "")

    def test_create_quantity_invalid_value(self, unit_manager):
        """Test that non-numeric value raises error."""
        with pytest.raises(ValueError):
            unit_manager.create_quantity("not_a_number", "MPa")

    # === DIMENSIONLESS ===

    def test_create_dimensionless(self, unit_manager):
        """Test dimensionless quantity."""
        qty = unit_manager.create_dimensionless(42)
        assert float(qty.magnitude) == 42
        assert str(qty.dimensionality) == "[dimensionless]"

    def test_create_dimensionless_zero(self, unit_manager):
        """Test dimensionless zero."""
        qty = unit_manager.create_dimensionless(0)
        assert float(qty.magnitude) == 0

    # === UNIT PARSING ===

    def test_parse_unit_string_valid(self, unit_manager):
        """Test valid unit string parsing."""
        is_valid, error = unit_manager.parse_unit_string("MPa")
        assert is_valid
        assert error == ""

    def test_parse_unit_string_complex_valid(self, unit_manager):
        """Test complex unit string parsing."""
        is_valid, error = unit_manager.parse_unit_string("N/mm**2")
        assert is_valid
        assert error == ""

    def test_parse_unit_string_invalid(self, unit_manager):
        """Test invalid unit string."""
        is_valid, error = unit_manager.parse_unit_string("not_a_unit")
        assert not is_valid
        assert "Undefined unit" in error or "Invalid" in error

    def test_parse_unit_string_empty(self, unit_manager):
        """Test empty unit string."""
        is_valid, error = unit_manager.parse_unit_string("")
        assert not is_valid

    # === SERIALIZATION ===

    def test_quantity_to_dict(self, unit_manager):
        """Test quantity to dict conversion."""
        qty = unit_manager.create_quantity(100, "MPa")
        data = unit_manager.quantity_to_dict(qty)
        assert "value" in data
        assert "unit" in data
        assert float(data["value"]) == 100

    def test_dict_to_quantity(self, unit_manager):
        """Test dict to quantity conversion."""
        data = {"value": 50, "unit": "mm"}
        qty = unit_manager.dict_to_quantity(data)
        assert float(qty.magnitude) == 50

    def test_roundtrip_serialization(self, unit_manager):
        """Test that dict→qty→dict preserves value."""
        original_qty = unit_manager.create_quantity(123, "MPa")
        data = unit_manager.quantity_to_dict(original_qty)
        restored_qty = unit_manager.dict_to_quantity(data)
        assert float(original_qty.magnitude) == float(restored_qty.magnitude)

    # === UNIT CONVERSION ===

    def test_convert_mm_to_cm(self, unit_manager):
        """Test converting mm to cm."""
        qty = unit_manager.create_quantity(10, "mm")
        converted = unit_manager.convert_to_unit(qty, "cm")
        assert float(converted.magnitude) == 1.0

    def test_convert_kpa_to_mpa(self, unit_manager):
        """Test converting kPa to MPa."""
        qty = unit_manager.create_quantity(1000, "kPa")
        converted = unit_manager.convert_to_unit(qty, "MPa")
        assert float(converted.magnitude) == 1.0

    def test_convert_bar_to_pa(self, unit_manager):
        """Test converting bar to Pa."""
        qty = unit_manager.create_quantity(1, "bar")
        converted = unit_manager.convert_to_unit(qty, "Pa")
        assert float(converted.magnitude) == 100000

    def test_convert_incompatible_units(self, unit_manager):
        """Test that incompatible unit conversion raises error."""
        qty = unit_manager.create_quantity(100, "MPa")
        with pytest.raises(Exception):  # DimensionalityError
            unit_manager.convert_to_unit(qty, "mm")

    # === DIMENSIONALITY ===

    def test_get_dimensionality_pressure(self, unit_manager):
        """Test dimensionality of pressure."""
        qty = unit_manager.create_quantity(100, "MPa")
        dim = unit_manager.get_dimensionality(qty)
        assert "[pressure]" in dim or "[force]" in dim or "pascal" in str(qty.dimensionality)

    def test_get_dimensionality_length(self, unit_manager):
        """Test dimensionality of length."""
        qty = unit_manager.create_quantity(50, "mm")
        dim = unit_manager.get_dimensionality(qty)
        assert "[length]" in dim

    def test_get_dimensionality_force(self, unit_manager):
        """Test dimensionality of force."""
        qty = unit_manager.create_quantity(1000, "N")
        dim = unit_manager.get_dimensionality(qty)
        assert "[force]" in dim

    def test_get_dimensionality_dimensionless(self, unit_manager):
        """Test dimensionality of dimensionless."""
        qty = unit_manager.create_dimensionless(42)
        dim = unit_manager.get_dimensionality(qty)
        assert "[dimensionless]" in dim

    # === DIMENSIONALITY COMPATIBILITY ===

    def test_compatible_same_dimension(self, unit_manager):
        """Test that same dimensions are compatible."""
        qty1 = unit_manager.create_quantity(100, "MPa")
        qty2 = unit_manager.create_quantity(50, "kPa")
        assert unit_manager.are_dimensionally_compatible(qty1, qty2)

    def test_compatible_different_dimension(self, unit_manager):
        """Test that different dimensions are incompatible."""
        qty1 = unit_manager.create_quantity(100, "MPa")
        qty2 = unit_manager.create_quantity(50, "mm")
        assert not unit_manager.are_dimensionally_compatible(qty1, qty2)

    def test_compatible_both_length(self, unit_manager):
        """Test that different length units are compatible."""
        qty1 = unit_manager.create_quantity(1000, "mm")
        qty2 = unit_manager.create_quantity(1, "m")
        assert unit_manager.are_dimensionally_compatible(qty1, qty2)


class TestDimensionalAnalyzer:
    """Test DimensionalAnalyzer for formula validation."""

    @pytest.fixture
    def setup(self):
        """Provide analyzer and variables."""
        unit_manager = UnitManager()
        analyzer = DimensionalAnalyzer(unit_manager)
        return analyzer, unit_manager

    # === ADDITION CHECKS ===

    def test_check_addition_same_dimension_ok(self, setup):
        """Test that adding same dimensions is OK."""
        analyzer, unit_manager = setup

        # 100 MPa + 50 MPa
        pressure1 = unit_manager.create_quantity(100, "MPa")
        pressure2 = unit_manager.create_quantity(50, "MPa")

        expr = sp.Symbol("p1") + sp.Symbol("p2")
        variables = {"p1": pressure1, "p2": pressure2}

        # Should not raise
        analyzer.check_dimensional_consistency(expr, variables)

    def test_check_addition_different_dimension_error(self, setup):
        """Test that adding different dimensions raises error."""
        analyzer, unit_manager = setup

        # 100 MPa + 10 mm (pressure + length)
        pressure = unit_manager.create_quantity(100, "MPa")
        length = unit_manager.create_quantity(10, "mm")

        expr = sp.Symbol("p") + sp.Symbol("l")
        variables = {"p": pressure, "l": length}

        # Should raise DimensionalAnalysisError
        with pytest.raises(DimensionalAnalysisError):
            analyzer.check_dimensional_consistency(expr, variables)

    def test_check_addition_multiple_terms_mismatch(self, setup):
        """Test addition with multiple terms with mismatch."""
        analyzer, unit_manager = setup

        qty1 = unit_manager.create_quantity(100, "mm")
        qty2 = unit_manager.create_quantity(50, "mm")
        qty3 = unit_manager.create_quantity(10, "MPa")

        # mm + mm + MPa → should fail
        expr = sp.Symbol("a") + sp.Symbol("b") + sp.Symbol("c")
        variables = {"a": qty1, "b": qty2, "c": qty3}

        with pytest.raises(DimensionalAnalysisError):
            analyzer.check_dimensional_consistency(expr, variables)

    # === MULTIPLICATION (always valid dimensionally) ===

    def test_check_multiplication_ok(self, setup):
        """Test multiplication is dimensionally valid."""
        analyzer, unit_manager = setup

        # MPa * mm² = force
        pressure = unit_manager.create_quantity(100, "MPa")
        area = unit_manager.create_quantity(10, "mm**2")

        expr = sp.Symbol("p") * sp.Symbol("a")
        variables = {"p": pressure, "a": area}

        # Should not raise
        analyzer.check_dimensional_consistency(expr, variables)

    def test_check_multiplication_mixed_units_ok(self, setup):
        """Test multiplication with different units is valid."""
        analyzer, unit_manager = setup

        force = unit_manager.create_quantity(1000, "N")
        length = unit_manager.create_quantity(100, "mm")

        expr = sp.Symbol("f") * sp.Symbol("l")
        variables = {"f": force, "l": length}

        # Should not raise (produces work/energy)
        analyzer.check_dimensional_consistency(expr, variables)

    # === CONSTANTS ===

    def test_check_with_constants(self, setup):
        """Test formula with constants."""
        analyzer, unit_manager = setup

        # Constants are dimensionless
        pressure = unit_manager.create_quantity(100, "MPa")

        expr = sp.Symbol("p") * 2  # p * 2 (dimensionless constant)
        variables = {"p": pressure}

        # Should not raise
        analyzer.check_dimensional_consistency(expr, variables)

    # === SIMPLE FORMULAS ===

    def test_check_simple_formula_single_variable(self, setup):
        """Test simple formula with one variable."""
        analyzer, unit_manager = setup

        pressure = unit_manager.create_quantity(100, "MPa")
        expr = sp.Symbol("p")
        variables = {"p": pressure}

        # Single variable is always valid
        analyzer.check_dimensional_consistency(expr, variables)

    def test_check_nested_operations(self, setup):
        """Test nested operations."""
        analyzer, unit_manager = setup

        # (p * a) / 2  should be valid
        pressure = unit_manager.create_quantity(100, "MPa")
        area = unit_manager.create_quantity(10, "mm**2")

        expr = (sp.Symbol("p") * sp.Symbol("a")) / 2
        variables = {"p": pressure, "a": area}

        # Should not raise
        analyzer.check_dimensional_consistency(expr, variables)
