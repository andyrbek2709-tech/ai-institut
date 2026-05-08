"""Unit conversion using Pint."""
from typing import Any
import pint


class UnitConverter:
    """Handles unit conversions using Pint."""

    def __init__(self):
        """Initialize unit registry."""
        self.ureg = pint.UnitRegistry()
        self._setup_custom_units()

    def _setup_custom_units(self):
        """Add custom units if needed."""
        # Standard units are already in Pint
        pass

    def convert(self, value: float, from_unit: str, to_unit: str) -> dict[str, Any]:
        """
        Convert value from one unit to another.

        Returns:
            {success: bool, value: float, from_unit: str, to_unit: str, error: str|None}
        """
        try:
            quantity = self.ureg.Quantity(value, from_unit)
            converted = quantity.to(to_unit)
            return {
                "success": True,
                "value": float(converted.magnitude),
                "from_unit": from_unit,
                "to_unit": to_unit,
                "error": None,
            }
        except Exception as e:
            return {
                "success": False,
                "value": None,
                "from_unit": from_unit,
                "to_unit": to_unit,
                "error": str(e),
            }

    def are_compatible(self, unit1: str, unit2: str) -> bool:
        """Check if units are convertible."""
        try:
            q1 = self.ureg.Quantity(1, unit1)
            q1.to(unit2)
            return True
        except Exception:
            return False

    def get_unit_dimension(self, unit: str) -> str:
        """Get dimension of unit (e.g., 'pressure', 'length')."""
        try:
            q = self.ureg.Quantity(1, unit)
            return str(q.dimensionality)
        except Exception:
            return "unknown"
