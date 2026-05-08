"""Unit management and Pint integration for engineering calculations."""
from typing import Optional, Tuple
from pint import UnitRegistry, Quantity
from pint.errors import UndefinedUnitError, DimensionalityError


class UnitManager:
    """Centralized Pint UnitRegistry and engineering unit utilities."""

    def __init__(self):
        """Initialize UnitRegistry with engineering units."""
        self.ureg = UnitRegistry()
        self._load_engineering_units()

    def _load_engineering_units(self) -> None:
        """Load custom engineering unit definitions."""
        # Standard SI prefixes are automatic (m, k, M, G, etc.)

        # Pressure units
        self.ureg.define("Pa = newton / meter**2")
        self.ureg.define("MPa = 1e6 * Pa")
        self.ureg.define("kPa = 1e3 * Pa")
        self.ureg.define("bar = 1e5 * Pa")

        # Stress (same as pressure)
        self.ureg.define("stress = pascal")

        # Force units (Newton is default)
        # self.ureg.define("N = kilogram * meter / second**2")  # Already defined

        # Area units
        # mm², m² already supported

        # Length
        # mm, cm, m already supported

        # Common engineering combinations
        # N/mm² = MPa (automatic)
        # kN/cm² = 10 MPa (automatic)

    def create_quantity(
        self,
        value: float,
        unit_str: str
    ) -> Quantity:
        """
        Create a Pint Quantity with validation.

        Args:
            value: Numeric value
            unit_str: Unit string (e.g., "MPa", "mm", "N/mm²")

        Returns:
            Pint Quantity object

        Raises:
            InvalidUnitError: If unit string is invalid
            ValueError: If value is not numeric
        """
        try:
            if not isinstance(value, (int, float)):
                raise ValueError(f"Value must be numeric, got {type(value)}")

            # Normalize unit string
            unit_str = unit_str.strip()
            if not unit_str:
                raise ValueError("Unit string cannot be empty")

            # Create quantity
            quantity = self.ureg.Quantity(value, unit_str)
            return quantity

        except UndefinedUnitError as e:
            raise InvalidUnitError(f"Undefined unit: {unit_str}") from e
        except (ValueError, TypeError) as e:
            raise ValueError(f"Invalid quantity: value={value}, unit={unit_str}") from e

    def create_dimensionless(self, value: float) -> Quantity:
        """Create a dimensionless quantity."""
        return self.ureg.Quantity(value, "dimensionless")

    def parse_unit_string(self, unit_str: str) -> Tuple[bool, str]:
        """
        Validate unit string syntax.

        Args:
            unit_str: Unit string to validate

        Returns:
            (is_valid, error_message)
        """
        try:
            unit_str = unit_str.strip()
            if not unit_str:
                return False, "Unit string cannot be empty"

            # Try to create a quantity with unit 1.0 to validate
            _ = self.ureg.Quantity(1.0, unit_str)
            return True, ""

        except UndefinedUnitError:
            return False, f"Undefined unit: {unit_str}"
        except Exception as e:
            return False, f"Invalid unit syntax: {str(e)}"

    def quantity_to_dict(self, quantity: Quantity) -> dict:
        """
        Convert Quantity to dict for JSON serialization.

        Args:
            quantity: Pint Quantity

        Returns:
            {"value": float, "unit": str}
        """
        return {
            "value": float(quantity.magnitude),
            "unit": str(quantity.units)
        }

    def dict_to_quantity(self, data: dict) -> Quantity:
        """
        Convert dict back to Quantity.

        Args:
            data: {"value": float, "unit": str}

        Returns:
            Pint Quantity
        """
        return self.create_quantity(data["value"], data["unit"])

    def convert_to_unit(
        self,
        quantity: Quantity,
        target_unit: str
    ) -> Quantity:
        """
        Convert quantity to target unit.

        Args:
            quantity: Source Quantity
            target_unit: Target unit string (e.g., "cm")

        Returns:
            Quantity in target unit

        Raises:
            DimensionalityError: If units incompatible
        """
        try:
            return quantity.to(target_unit)
        except DimensionalityError as e:
            raise DimensionalityError(
                f"Cannot convert {quantity.units} to {target_unit}"
            ) from e

    def get_dimensionality(self, quantity: Quantity) -> str:
        """Get dimensionality of quantity (e.g., "[force]", "[length]")."""
        return str(quantity.dimensionality)

    def are_dimensionally_compatible(
        self,
        qty1: Quantity,
        qty2: Quantity
    ) -> bool:
        """Check if two quantities have compatible dimensions."""
        return qty1.dimensionality == qty2.dimensionality


class InvalidUnitError(Exception):
    """Unit syntax or definition error."""
    pass


class DimensionalityMismatchError(Exception):
    """Dimensional mismatch in formula operation."""
    pass
