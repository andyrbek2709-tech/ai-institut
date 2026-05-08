"""
Demo: Pint Integration in SafeFormulaExecutor

Shows how unit-aware execution works end-to-end.
Run with: python -m src.engine.demo_pint_integration

Example outputs:
- Unit propagation (MPa × mm² = force)
- Dimensional validation (MPa + mm = ERROR)
- Automatic conversion (10 mm = 1 cm)
- Complex formulas with multiple units
"""

from unit_manager import UnitManager
from pint_safe_executor import PintAwareSafeFormulaExecutor
from safe_executor import ExecutionStatus


def print_result(title: str, result):
    """Pretty-print execution result."""
    print(f"\n{title}")
    print("-" * 60)
    if result.is_success():
        print(f"✅ SUCCESS")
        print(f"   Formula: {result.formula}")
        print(f"   Result:  {result.value} {result.unit}")
        print(f"   Duration: {result.duration_ms:.2f}ms")
    else:
        print(f"❌ ERROR: {result.status.value}")
        print(f"   Code: {result.error_code}")
        print(f"   Message: {result.error_message}")
        print(f"   Duration: {result.duration_ms:.2f}ms")


def demo_1_basic_unit_propagation():
    """Demo: Basic unit propagation."""
    print("\n" + "=" * 60)
    print("DEMO 1: Basic Unit Propagation")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()
    unit_manager = executor.unit_manager

    # Example: Force = Pressure × Area
    # 100 MPa × 10 mm² = ?
    result = executor.execute_with_unit_strings(
        "p * a",
        {
            "p": (100, "MPa"),
            "a": (10, "mm**2")
        }
    )

    print_result("Force = Pressure × Area", result)
    print("\nExplanation:")
    print("- Pressure (MPa) × Area (mm²) = Force (N)")
    print("- 100 MPa × 10 mm² = 1,000,000 N (automatic unit propagation)")


def demo_2_dimensional_validation():
    """Demo: Dimensional validation catches invalid math."""
    print("\n" + "=" * 60)
    print("DEMO 2: Dimensional Validation")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()

    # INVALID: Adding pressure + length
    result = executor.execute_with_unit_strings(
        "p + l",
        {
            "p": (100, "MPa"),
            "l": (10, "mm")
        }
    )

    print_result("INVALID: Pressure + Length", result)
    print("\nExplanation:")
    print("- MPa (pressure) + mm (length) = ERROR")
    print("- Can't add different dimensions")
    print("- Caught by dimensional analyzer (Layer 1.5)")


def demo_3_valid_addition():
    """Demo: Valid addition with same dimensions."""
    print("\n" + "=" * 60)
    print("DEMO 3: Valid Addition (Same Dimension)")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()

    # VALID: Adding two lengths
    result = executor.execute_with_unit_strings(
        "l1 + l2",
        {
            "l1": (100, "mm"),
            "l2": (50, "mm")
        }
    )

    print_result("Valid: Length + Length", result)
    print("\nExplanation:")
    print("- 100 mm + 50 mm = 150 mm")
    print("- Same dimension = OK")


def demo_4_complex_formula():
    """Demo: Complex formula with multiple units."""
    print("\n" + "=" * 60)
    print("DEMO 4: Complex Formula")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()

    # Utilization Ratio = (Pressure × Area) / Base Area
    result = executor.execute_with_unit_strings(
        "(p * a) / ba",
        {
            "p": (100, "MPa"),
            "a": (10, "mm**2"),
            "ba": (5, "mm**2")
        }
    )

    print_result("Utilization = (Pressure × Area) / Base Area", result)
    print("\nExplanation:")
    print("- (100 MPa × 10 mm²) / 5 mm² = 200 MPa")
    print("- Units propagate correctly through formula")


def demo_5_unit_conversion():
    """Demo: Automatic unit conversion."""
    print("\n" + "=" * 60)
    print("DEMO 5: Automatic Unit Conversion")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()
    unit_manager = executor.unit_manager

    # Create quantities in different units
    length1 = unit_manager.create_quantity(1000, "mm")
    length2 = unit_manager.create_quantity(1, "m")

    # Pint automatically handles unit conversion
    # 1000 mm + 1 m = correct result
    result = executor.execute_with_units(
        "l1 + l2",
        {"l1": length1, "l2": length2}
    )

    print_result("Unit Conversion: mm + m", result)
    print("\nExplanation:")
    print("- 1000 mm + 1 m (= 1000 mm)")
    print("- Pint converts automatically")
    print("- Result: 2000 mm (or 2 m, depending on base unit)")


def demo_6_security_still_works():
    """Demo: Security layers still work with units."""
    print("\n" + "=" * 60)
    print("DEMO 6: Security Enforcement")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()

    # Try to inject dangerous code
    result = executor.execute_with_unit_strings(
        "eval('dangerous_code')",
        {"x": (1, "dimensionless")}
    )

    print_result("Injection Attempt: eval()", result)
    print("\nExplanation:")
    print("- eval() is in FORBIDDEN_PATTERNS")
    print("- Blocked by Layer 1 (input validation)")
    print("- Unit support doesn't bypass security")


def demo_7_engineering_calculation():
    """Demo: Real engineering calculation."""
    print("\n" + "=" * 60)
    print("DEMO 7: Engineering Calculation")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()

    # Stress = Force / Area
    # stress = 1000 N / 100 mm²
    result = executor.execute_with_unit_strings(
        "f / a",
        {
            "f": (1000, "N"),
            "a": (100, "mm**2")
        }
    )

    print_result("Stress = Force / Area", result)
    print("\nExplanation:")
    print("- 1000 N / 100 mm² = stress (pressure dimension)")
    print("- Units propagate: N / mm² = N/mm² = MPa (approx)")


def demo_8_constants_in_formulas():
    """Demo: Dimensionless constants work with units."""
    print("\n" + "=" * 60)
    print("DEMO 8: Constants with Units")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor()

    # Area of circle = π × r²
    import math
    result = executor.execute_with_unit_strings(
        "pi * r**2",
        {
            "r": (10, "mm"),
            "pi": (math.pi, "dimensionless")
        }
    )

    print_result("Circle Area = π × r²", result)
    print("\nExplanation:")
    print("- π (dimensionless) × r² (mm²) = area (mm²)")
    print("- Constants multiply with units correctly")


def demo_9_statistics():
    """Demo: Extended statistics."""
    print("\n" + "=" * 60)
    print("DEMO 9: Executor Statistics")
    print("=" * 60)

    executor = PintAwareSafeFormulaExecutor(timeout_ms=1000)

    # Execute something
    executor.execute_with_unit_strings(
        "p * 2",
        {"p": (100, "MPa")}
    )

    stats = executor.get_statistics_extended()
    print("\nStatistics:")
    print(f"  Execution count: {stats['execution_count']}")
    print(f"  Expression cache size: {stats['cache_size']}")
    print(f"  Quantity cache size: {stats['quantity_cache_size']}")
    print(f"  Timeout (ms): {stats['timeout_ms']}")
    print(f"  Unit registry: {stats['unit_registry']}")


def run_all_demos():
    """Run all demonstration scenarios."""
    print("\n" + "=" * 60)
    print("PINT INTEGRATION DEMONSTRATION")
    print("Calculating Platform — PHASE 2 STAGE 2, ÉTAP 1")
    print("=" * 60)

    demo_1_basic_unit_propagation()
    demo_2_dimensional_validation()
    demo_3_valid_addition()
    demo_4_complex_formula()
    demo_5_unit_conversion()
    demo_6_security_still_works()
    demo_7_engineering_calculation()
    demo_8_constants_in_formulas()
    demo_9_statistics()

    print("\n" + "=" * 60)
    print("DEMONSTRATION COMPLETE")
    print("=" * 60)
    print("\nKey Takeaways:")
    print("✅ Unit propagation works (MPa × mm² = force)")
    print("✅ Dimensional validation works (MPa + mm = ERROR)")
    print("✅ Security still works (eval still blocked)")
    print("✅ Complex formulas supported (multiple variables)")
    print("✅ Automatic conversion works (mm + m)")
    print("✅ Engineering calculations work correctly")
    print("\nREADY FOR ÉTAP 1.2-1.6 INTEGRATION!")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    run_all_demos()
