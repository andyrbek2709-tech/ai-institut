"""Semantic metadata system for engineering variables."""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Any
import logging

logger = logging.getLogger(__name__)


class Discipline(str, Enum):
    """Engineering discipline categories."""
    PIPING = "piping"
    STRUCTURAL = "structural"
    THERMAL = "thermal"
    MECHANICAL = "mechanical"
    HYDRAULIC = "hydraulic"
    ELECTRICAL = "electrical"
    CHEMICAL = "chemical"
    GENERAL = "general"


@dataclass
class VariableSemantics:
    """Engineering meaning and semantics of a variable."""

    id: str
    name: str
    engineering_meaning: str
    physical_interpretation: str
    discipline: Discipline
    expected_range: tuple[float, float]
    expected_unit: str
    engineering_notes: str
    failure_modes: list[str] = field(default_factory=list)
    related_variables: list[str] = field(default_factory=list)
    typical_values: list[float] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    material_dependent: bool = False
    temperature_dependent: bool = False
    pressure_dependent: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "engineering_meaning": self.engineering_meaning,
            "physical_interpretation": self.physical_interpretation,
            "discipline": self.discipline.value,
            "expected_range": self.expected_range,
            "expected_unit": self.expected_unit,
            "engineering_notes": self.engineering_notes,
            "failure_modes": self.failure_modes,
            "related_variables": self.related_variables,
            "typical_values": self.typical_values,
            "constraints": self.constraints,
            "material_dependent": self.material_dependent,
            "temperature_dependent": self.temperature_dependent,
            "pressure_dependent": self.pressure_dependent,
        }

    def is_in_expected_range(self, value: float) -> bool:
        """Check if value is in expected range."""
        min_val, max_val = self.expected_range
        return min_val <= value <= max_val

    def check_constraints(self, value: float) -> bool:
        """Check all constraints on value."""
        # Basic constraints
        min_val, max_val = self.expected_range
        if not (min_val <= value <= max_val):
            return False
        return True


@dataclass
class FormulaSemanticsMetadata:
    """Semantic metadata for a formula."""

    formula_id: str
    name: str
    description: str
    discipline: Discipline
    engineering_meaning: str
    engineering_notes: str
    assumptions: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    related_standards: list[str] = field(default_factory=list)
    historical_accuracy: str = "validated"

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "formula_id": self.formula_id,
            "name": self.name,
            "description": self.description,
            "discipline": self.discipline.value,
            "engineering_meaning": self.engineering_meaning,
            "engineering_notes": self.engineering_notes,
            "assumptions": self.assumptions,
            "limitations": self.limitations,
            "related_standards": self.related_standards,
            "historical_accuracy": self.historical_accuracy,
        }


class SemanticMetadataRegistry:
    """Registry of semantic metadata for variables and formulas."""

    def __init__(self):
        """Initialize metadata registry."""
        self.variables: dict[str, VariableSemantics] = {}
        self.formulas: dict[str, FormulaSemanticsMetadata] = {}

    def register_variable(self, semantics: VariableSemantics) -> None:
        """Register variable semantics."""
        self.variables[semantics.id] = semantics

    def register_variables(self, semantics_list: list[VariableSemantics]) -> None:
        """Register multiple variable semantics."""
        for semantics in semantics_list:
            self.register_variable(semantics)

    def register_formula(self, metadata: FormulaSemanticsMetadata) -> None:
        """Register formula semantics."""
        self.formulas[metadata.formula_id] = metadata

    def register_formulas(
        self, metadata_list: list[FormulaSemanticsMetadata]
    ) -> None:
        """Register multiple formula semantics."""
        for metadata in metadata_list:
            self.register_formula(metadata)

    def get_variable(self, variable_id: str) -> Optional[VariableSemantics]:
        """Get variable semantics."""
        return self.variables.get(variable_id)

    def get_formula(self, formula_id: str) -> Optional[FormulaSemanticsMetadata]:
        """Get formula semantics."""
        return self.formulas.get(formula_id)

    def get_variables_by_discipline(
        self, discipline: Discipline
    ) -> list[VariableSemantics]:
        """Get all variables for a discipline."""
        return [
            v for v in self.variables.values()
            if v.discipline == discipline
        ]

    def get_related_variables(self, variable_id: str) -> list[VariableSemantics]:
        """Get semantically related variables."""
        var = self.get_variable(variable_id)
        if not var:
            return []

        related = []
        for related_id in var.related_variables:
            related_semantics = self.get_variable(related_id)
            if related_semantics:
                related.append(related_semantics)

        return related

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "variables": {
                var_id: semantics.to_dict()
                for var_id, semantics in self.variables.items()
            },
            "formulas": {
                formula_id: metadata.to_dict()
                for formula_id, metadata in self.formulas.items()
            },
        }


# Predefined semantic metadata for common piping variables

PIPING_STRESS_SEMANTICS = VariableSemantics(
    id="stress",
    name="Hoop Stress",
    engineering_meaning="Circumferential stress in pipe wall due to internal pressure",
    physical_interpretation="Tensile stress acting tangentially around pipe circumference",
    discipline=Discipline.PIPING,
    expected_range=(0, 1000),
    expected_unit="MPa",
    engineering_notes="Must not exceed material yield strength. Typically < 2/3 yield for design. Calculated per Barlow's formula.",
    failure_modes=[
        "Elastic instability (buckling)",
        "Plastic instability (necking)",
        "Brittle fracture (low temperature)",
        "Fatigue crack initiation",
    ],
    related_variables=["wall_thickness", "inner_diameter", "internal_pressure", "material_yield_strength"],
    typical_values=[50.0, 100.0, 150.0],
    constraints=[
        "stress >= 0",
        "stress <= yield_strength",
        "stress <= 0.67 * yield_strength (design)",
    ],
    material_dependent=True,
)

PIPING_EFFICIENCY_SEMANTICS = VariableSemantics(
    id="efficiency",
    name="Isentropic Efficiency",
    engineering_meaning="Ratio of actual to isentropic work for thermodynamic process",
    physical_interpretation="Fraction of theoretical maximum work extracted/required",
    discipline=Discipline.THERMAL,
    expected_range=(0.7, 0.95),
    expected_unit="dimensionless",
    engineering_notes="Cannot exceed 1.0 due to thermodynamic law. Typical range 0.7-0.95. Values outside range indicate calculation error.",
    failure_modes=[
        "Calculation error (efficiency > 1.0 is impossible)",
        "Unit mismatch (energy vs. power)",
        "Incorrect process assumptions",
    ],
    related_variables=["pressure_ratio", "inlet_temperature", "outlet_temperature", "process_type"],
    typical_values=[0.75, 0.80, 0.85],
    constraints=[
        "efficiency >= 0",
        "efficiency <= 1.0",
        "efficiency >= 0.5 (design minimum)",
    ],
    temperature_dependent=True,
    pressure_dependent=True,
)

PIPING_PRESSURE_SEMANTICS = VariableSemantics(
    id="internal_pressure",
    name="Internal Pressure",
    engineering_meaning="Gauge pressure inside pipe",
    physical_interpretation="Pressure difference from atmospheric reference",
    discipline=Discipline.PIPING,
    expected_range=(0, 500),
    expected_unit="MPa",
    engineering_notes="Absolute pressure = gauge pressure + atmospheric (0.1 MPa). Negative values indicate vacuum or calculation error.",
    failure_modes=[
        "Input error (negative pressure)",
        "Vacuum system misidentified as pressurized",
        "Unit conversion error",
    ],
    related_variables=["outer_diameter", "wall_thickness", "material"],
    typical_values=[1.0, 5.0, 10.0],
    constraints=[
        "pressure >= 0 (gauge)",
        "pressure <= system_rated_pressure",
    ],
)

PIPING_WALL_THICKNESS_SEMANTICS = VariableSemantics(
    id="wall_thickness",
    name="Pipe Wall Thickness",
    engineering_meaning="Thickness of pipe wall",
    physical_interpretation="Radial distance from inner to outer surface of pipe",
    discipline=Discipline.PIPING,
    expected_range=(0.1, 50),
    expected_unit="mm",
    engineering_notes="Standard pipe sizes recommended. Minimum thickness for corrosion allowance. Negative values indicate measurement error.",
    failure_modes=[
        "Input error (negative or zero thickness)",
        "Unit conversion error (e.g., mm vs. inch)",
        "Corrosion allowance not considered",
    ],
    related_variables=["outer_diameter", "internal_pressure", "material"],
    typical_values=[1.0, 2.0, 5.0],
    constraints=[
        "thickness > 0",
        "thickness < diameter / 2",
        "thickness >= minimum_wall_thickness (corrosion)",
    ],
)

# Predefined formula semantics

BARLOW_FORMULA_SEMANTICS = FormulaSemanticsMetadata(
    formula_id="hoop_stress_barlow",
    name="Barlow's Formula",
    description="Calculate hoop stress in thin-walled cylindrical pressure vessels",
    discipline=Discipline.PIPING,
    engineering_meaning="Circumferential stress from internal pressure in pipe",
    engineering_notes="Valid for thin-walled pipes (thickness < diameter/20). ISO 1891, ASME B31.1/B31.3",
    assumptions=[
        "Pipe is thin-walled (thickness << diameter)",
        "Pressure is uniform and static",
        "Pipe is straight section (no bends/elbows)",
        "Material is isotropic",
    ],
    limitations=[
        "Not valid for thick-walled pipes",
        "Does not account for discontinuity stresses",
        "Assumes elastic analysis",
        "Does not include fatigue effects",
    ],
    related_standards=[
        "ISO 1891:1989 — Seamless steel tubes",
        "ASME B31.1 — Power piping",
        "ASME B31.3 — Process piping",
    ],
    historical_accuracy="validated",
)
