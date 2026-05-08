import pint
from typing import Dict, Tuple


class UnitConverter:
    def __init__(self):
        self.ureg = pint.UnitRegistry()
        self._setup_custom_units()

    def _setup_custom_units(self):
        """Setup engineering-specific units"""
        # Pressure
        self.ureg.define("bar = 100000 * pascal")
        self.ureg.define("psi = 6.89476 * kPa")
        self.ureg.define("ksi = 1000 * psi")

        # Length
        self.ureg.define("inch = 25.4 * mm")
        self.ureg.define("foot = 12 * inch")

        # Stress
        self.ureg.define("MPa = 1 * newton / millimeter**2")
        self.ureg.define("ksi = psi")

    def convert(self, value: float, from_unit: str, to_unit: str) -> float:
        """Convert value from one unit to another"""
        try:
            q = value * self.ureg(from_unit)
            return float(q.to(to_unit).magnitude)
        except Exception as e:
            raise ValueError(f"Conversion error: {str(e)}")

    def is_valid_unit(self, unit: str) -> bool:
        """Check if unit is valid"""
        try:
            self.ureg(unit)
            return True
        except Exception:
            return False

    def get_unit_dimension(self, unit: str) -> str:
        """Get dimension of unit (e.g., 'pressure', 'length')"""
        try:
            q = self.ureg(unit)
            return str(q.dimensionality)
        except Exception:
            return ""


# Global instance
unit_converter = UnitConverter()
