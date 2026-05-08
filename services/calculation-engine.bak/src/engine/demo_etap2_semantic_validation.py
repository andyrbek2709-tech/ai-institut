"""Demo of ÉTAP 2 semantic validation, explainability, and audit trail."""
from pint import Quantity
from src.engine.validation_framework import (
    EngineeringValidationEngine,
    PhysicalPlausibilityRule,
    RangeCheckRule,
    SafetyFactorRule,
    SeverityLevel,
)
from src.engine.semantic_metadata import (
    SemanticMetadataRegistry,
    PIPING_STRESS_SEMANTICS,
    PIPING_EFFICIENCY_SEMANTICS,
    PIPING_PRESSURE_SEMANTICS,
    PIPING_WALL_THICKNESS_SEMANTICS,
    BARLOW_FORMULA_SEMANTICS,
)
from src.engine.unit_manager import UnitManager
from src.engine.explainability import ExplainabilityEngine
from src.engine.audit_trail import EngineeringAuditTrail, AuditLogger
from src.engine.failure_analysis import FailureAnalyzer
from src.engine.execution_graph import ExecutionPlan, ExecutionTrace, FormulaNode
import json
import uuid
from datetime import datetime


def demo_stress_validation():
    """Demo 1: Hoop stress validation with physical plausibility checks."""
    print("\n" + "=" * 80)
    print("DEMO 1: Hoop Stress Validation with Physical Plausibility Checks")
    print("=" * 80)

    # Setup
    unit_manager = UnitManager()
    validation_engine = EngineeringValidationEngine()
    semantics_registry = SemanticMetadataRegistry()

    # Register semantic metadata
    semantics_registry.register_variable(PIPING_STRESS_SEMANTICS)
    semantics_registry.register_formula(BARLOW_FORMULA_SEMANTICS)

    # Add validation rules
    # Rule 1: Stress must be positive
    stress_positive_rule = PhysicalPlausibilityRule(
        rule_id="stress_positive",
        rule_name="Stress must be positive",
        applies_to="stress",
        check_func=lambda x: x >= 0,
        expected_condition="stress >= 0 MPa",
        message="Stress cannot be negative (indicates model error)",
        severity=SeverityLevel.ERROR,
        engineering_notes="Negative stress is physically impossible in compression-only design",
        probable_causes=[
            "Formula reversal (compression instead of tension)",
            "Input value has wrong sign",
        ],
        mitigations=[
            "Review formula in template",
            "Check input values",
        ],
    )

    # Rule 2: Stress must not exceed yield strength (simplified to 300 MPa)
    stress_plausible_rule = PhysicalPlausibilityRule(
        rule_id="stress_plausible",
        rule_name="Stress within material limits",
        applies_to="stress",
        check_func=lambda x: x <= 300,
        expected_condition="stress <= 300 MPa",
        message="Stress exceeds material yield strength (simplified limit)",
        severity=SeverityLevel.FAILURE,
        engineering_notes="Exceeding yield strength causes permanent deformation",
        probable_causes=[
            "Insufficient wall thickness",
            "Excessive pressure",
            "Incorrect material selection",
        ],
        mitigations=[
            "Increase wall thickness",
            "Reduce operating pressure",
            "Use material with higher yield strength",
        ],
    )

    validation_engine.add_rules([stress_positive_rule, stress_plausible_rule])

    # Test case 1: Valid stress
    print("\n--- Test Case 1: Valid Stress (100 MPa) ---")
    stress_1 = unit_manager.create_quantity(100, "MPa")
    variables_1 = {
        "pressure": unit_manager.create_quantity(10, "MPa"),
        "diameter": unit_manager.create_quantity(100, "mm"),
        "thickness": unit_manager.create_quantity(5, "mm"),
    }

    results_1 = validation_engine.validate("stress", stress_1, variables_1)
    print(f"Stress: {stress_1}")
    print(f"Validation results: {len(results_1)} issues found")
    for result in results_1:
        print(f"  - {result.rule_name}: {result.status}")

    # Test case 2: Invalid stress (negative)
    print("\n--- Test Case 2: Invalid Stress (Negative) ---")
    stress_2 = unit_manager.create_quantity(-50, "MPa")
    results_2 = validation_engine.validate("stress", stress_2, variables_1)
    print(f"Stress: {stress_2}")
    print(f"Validation results: {len(results_2)} issues found")
    for result in results_2:
        print(f"  - {result.rule_name}: {result.message}")
        print(f"    Expected: {result.expected_condition}")
        print(f"    Notes: {result.engineering_notes}")

    # Test case 3: Invalid stress (exceeds yield)
    print("\n--- Test Case 3: Invalid Stress (Exceeds Yield) ---")
    stress_3 = unit_manager.create_quantity(450, "MPa")
    results_3 = validation_engine.validate("stress", stress_3, variables_1)
    print(f"Stress: {stress_3}")
    print(f"Validation results: {len(results_3)} issues found")
    for result in results_3:
        print(f"  - {result.rule_name}: {result.message}")
        print(f"    Probable causes: {result.probable_causes}")
        print(f"    Mitigations: {result.mitigations}")


def demo_efficiency_validation():
    """Demo 2: Efficiency validation (cannot exceed 1.0)."""
    print("\n" + "=" * 80)
    print("DEMO 2: Efficiency Validation (Cannot Exceed 100%)")
    print("=" * 80)

    unit_manager = UnitManager()
    validation_engine = EngineeringValidationEngine()
    semantics_registry = SemanticMetadataRegistry()

    # Register metadata
    semantics_registry.register_variable(PIPING_EFFICIENCY_SEMANTICS)

    # Rule: Efficiency must be <= 1.0 (violates thermodynamic law if > 1.0)
    efficiency_rule = RangeCheckRule(
        rule_id="efficiency_valid",
        rule_name="Efficiency must be between 0 and 1.0",
        applies_to="efficiency",
        min_value=0.0,
        max_value=1.0,
        message="Efficiency exceeds 100% - violates thermodynamic law",
        severity=SeverityLevel.ERROR,
        engineering_notes="Efficiency > 1.0 is impossible. First Law of Thermodynamics violation.",
        probable_causes=[
            "Formula reversal (actual/theoretical instead of theoretical/actual)",
            "Unit mismatch (energy vs. power)",
            "Measurement error in inputs",
        ],
        mitigations=[
            "Review formula in template",
            "Verify input units",
            "Check calculation against reference",
        ],
    )

    validation_engine.add_rule(efficiency_rule)

    # Test cases
    print("\n--- Test Case 1: Valid Efficiency (0.85) ---")
    efficiency_1 = unit_manager.create_quantity(0.85, "dimensionless")
    results_1 = validation_engine.validate("efficiency", efficiency_1, {})
    print(f"Efficiency: {efficiency_1}")
    print(f"Status: {'PASS' if not results_1 else 'FAIL'}")

    print("\n--- Test Case 2: Invalid Efficiency (1.25) ---")
    efficiency_2 = unit_manager.create_quantity(1.25, "dimensionless")
    results_2 = validation_engine.validate("efficiency", efficiency_2, {})
    print(f"Efficiency: {efficiency_2}")
    for result in results_2:
        print(f"Status: FAIL")
        print(f"Message: {result.message}")
        print(f"Notes: {result.engineering_notes}")
        print(f"Probable causes: {result.probable_causes}")


def demo_audit_trail():
    """Demo 3: Audit trail capturing all events."""
    print("\n" + "=" * 80)
    print("DEMO 3: Engineering Audit Trail")
    print("=" * 80)

    unit_manager = UnitManager()

    # Create audit trail
    trail = EngineeringAuditTrail(
        calculation_id=f"calc_{uuid.uuid4().hex[:8]}",
        template_id="pipe_stress_analysis",
        started_at=datetime.utcnow(),
        user_id="engineer@example.com",
    )

    logger = AuditLogger(trail)

    # Log input variables
    pressure = unit_manager.create_quantity(10, "MPa")
    logger.log_input(
        "internal_pressure",
        pressure,
        expected_range=(0, 100),
        expected_unit="MPa",
        engineering_meaning="Gauge pressure inside pipe",
    )

    diameter = unit_manager.create_quantity(100, "mm")
    logger.log_input(
        "outer_diameter",
        diameter,
        expected_range=(10, 2000),
        expected_unit="mm",
        engineering_meaning="Outside diameter of pipe",
    )

    # Log formula execution
    stress_result = unit_manager.create_quantity(100, "MPa")
    logger.log_formula_execution(
        formula_id="stress_calc",
        formula_text="(pressure * diameter) / (2 * thickness)",
        inputs_used={"pressure": pressure, "diameter": diameter},
        output=stress_result,
        output_unit="MPa",
        duration_ms=2.5,
    )

    # Log validation
    logger.log_validation_result(
        rule_id="stress_positive",
        rule_name="Stress must be positive",
        applies_to="stress",
        status="passed",
        message="Stress is positive",
        severity="info",
    )

    logger.log_validation_result(
        rule_id="stress_plausible",
        rule_name="Stress within material limits",
        applies_to="stress",
        status="passed",
        message="Stress within acceptable range",
        severity="info",
    )

    # Complete
    logger.log_calculation_completed()

    # Generate report
    print("\n--- Audit Trail Report ---")
    print(trail.generate_report())

    # JSON export
    print("\n--- JSON Summary ---")
    print(json.dumps(trail.to_dict(), indent=2, default=str)[:500] + "...")


def demo_explainability():
    """Demo 4: Calculation explainability."""
    print("\n" + "=" * 80)
    print("DEMO 4: Calculation Explainability")
    print("=" * 80)

    semantics_registry = SemanticMetadataRegistry()
    semantics_registry.register_variable(PIPING_STRESS_SEMANTICS)
    semantics_registry.register_formula(BARLOW_FORMULA_SEMANTICS)

    engine = ExplainabilityEngine()

    # Create mock execution data
    unit_manager = UnitManager()
    trace = ExecutionTrace(
        formula_id="stress_calc",
        expression="(pressure * diameter) / (2 * thickness)",
        inputs_used={
            "pressure": unit_manager.create_quantity(10, "MPa"),
            "diameter": unit_manager.create_quantity(100, "mm"),
            "thickness": unit_manager.create_quantity(5, "mm"),
        },
        output=100.0,
        unit="MPa",
        duration_ms=2.5,
    )

    plan = ExecutionPlan(
        formula_order=["stress_calc"],
        dependencies={"stress_calc": set()},
        dependents={"stress_calc": set()},
        required_inputs={"pressure", "diameter", "thickness"},
        intermediate_formulas=set(),
        output_formulas={"stress_calc"},
    )

    # Generate explanations
    explanations = engine.explain_execution(
        plan, [trace], {"stress_calc": BARLOW_FORMULA_SEMANTICS}
    )

    print("\n--- Execution Explanations ---")
    for exp in explanations:
        print(f"\nFormula: {exp.formula_text}")
        print(f"Name: {exp.name}")
        print(f"Description: {exp.description}")
        print(f"Step {exp.step_order}: {exp.reason_for_step}")
        print(f"Inputs: {exp.inputs_used}")
        print(f"Output: {exp.output_produced}")


def demo_failure_analysis():
    """Demo 5: Failure analysis."""
    print("\n" + "=" * 80)
    print("DEMO 5: Failure Analysis")
    print("=" * 80)

    from src.engine.validation_framework import ValidationResult

    analyzer = FailureAnalyzer()
    semantics_registry = SemanticMetadataRegistry()
    semantics_registry.register_variable(PIPING_STRESS_SEMANTICS)

    # Create mock failure
    failure = ValidationResult(
        rule_id="stress_plausible",
        rule_name="Stress within material limits",
        output_name="stress",
        status="failed",
        severity=SeverityLevel.FAILURE,
        message="Stress exceeds material yield strength",
        engineering_notes="Exceeding yield causes permanent deformation",
        actual_value="450 MPa",
        expected_condition="stress <= 300 MPa",
        probable_causes=[
            "Insufficient wall thickness",
            "Excessive pressure",
        ],
        mitigations=[
            "Increase wall thickness",
            "Reduce operating pressure",
        ],
    )

    unit_manager = UnitManager()
    variables = {
        "pressure": unit_manager.create_quantity(20, "MPa"),
        "diameter": unit_manager.create_quantity(100, "mm"),
        "thickness": unit_manager.create_quantity(2, "mm"),
    }

    # Analyze
    analyses = analyzer.analyze([failure], variables, semantics_registry.variables)

    print("\n--- Failure Analysis ---")
    for analysis in analyses:
        print(f"Failure ID: {analysis.failure_id}")
        print(f"Category: {analysis.category}")
        print(f"Message: {analysis.message}")
        print(f"Root Cause: {analysis.root_cause}")
        print(f"Probable Causes:")
        for cause in analysis.probable_causes:
            print(f"  - {cause}")
        print(f"Mitigations:")
        for mit in analysis.mitigation_suggestions:
            print(f"  - {mit}")
        print(f"Debug Steps:")
        for i, step in enumerate(analysis.debug_steps, 1):
            print(f"  {i}. {step}")


if __name__ == "__main__":
    demo_stress_validation()
    demo_efficiency_validation()
    demo_audit_trail()
    demo_explainability()
    demo_failure_analysis()

    print("\n" + "=" * 80)
    print("ÉTAP 2 DEMOS COMPLETE")
    print("=" * 80)
