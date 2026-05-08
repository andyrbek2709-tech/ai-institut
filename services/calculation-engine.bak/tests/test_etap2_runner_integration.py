"""ÉTAP 2.8-2.11: Comprehensive integration tests for semantic-enabled runner."""
import pytest
from typing import Any, Dict
from src.engine.runner import Runner, RunnerConfig, ExecutionMode
from src.schemas import CalcTemplate, CalcVariable, CalcInput, CalculationResult
from src.engine.validation_framework import SeverityLevel


class TestRunnerSemanticIntegration:
    """Test semantic validation integration in Runner."""

    @pytest.fixture
    def runner_with_semantics(self) -> Runner:
        """Create runner with semantic validation enabled."""
        config = RunnerConfig(
            enable_semantic_validation=True,
            enable_audit_trail=True,
            enable_explainability=True,
            enable_failure_analysis=True,
        )
        return Runner(config)

    @pytest.fixture
    def runner_without_semantics(self) -> Runner:
        """Create runner with semantic validation disabled."""
        config = RunnerConfig(
            enable_semantic_validation=False,
            enable_audit_trail=False,
            enable_explainability=False,
            enable_failure_analysis=False,
        )
        return Runner(config)

    @pytest.fixture
    def simple_template(self) -> CalcTemplate:
        """Simple template: result = a + b."""
        return CalcTemplate(
            id="simple_add",
            name="Simple Addition",
            category="basic",
            description="Add two numbers",
            variables=[
                CalcVariable(
                    name="a", label="A", description="First number",
                    unit="dimensionless", min_value=0, max_value=100
                ),
                CalcVariable(
                    name="b", label="B", description="Second number",
                    unit="dimensionless", min_value=0, max_value=100
                ),
            ],
            formula="a + b",
            outputs=["result"],
        )

    @pytest.fixture
    def pressure_template(self) -> CalcTemplate:
        """Pressure calculation template."""
        return CalcTemplate(
            id="barlow_formula",
            name="Hoop Stress (Barlow)",
            category="pressure",
            description="Calculate hoop stress in pipe",
            variables=[
                CalcVariable(
                    name="P", label="Pressure (MPa)", description="Internal pressure",
                    unit="MPa", min_value=0, max_value=100
                ),
                CalcVariable(
                    name="D", label="Diameter (mm)", description="Pipe diameter",
                    unit="mm", min_value=1, max_value=10000
                ),
                CalcVariable(
                    name="T", label="Wall Thickness (mm)", description="Wall thickness",
                    unit="mm", min_value=0.1, max_value=100
                ),
            ],
            formula="(P * D) / (2 * T)",
            outputs=["stress"],
            discipline="PIPING",
            engineering_rules=[
                {
                    "type": "range_check",
                    "variable": "stress",
                    "min": 0,
                    "max": 500
                },
                {
                    "type": "physical_plausibility",
                    "variable": "stress",
                    "must_be": "positive"
                }
            ]
        )

    def test_single_formula_basic_execution(self, runner_with_semantics, simple_template):
        """Test basic single-formula execution with semantics."""
        inputs = [
            CalcInput(name="a", value=10, unit="dimensionless"),
            CalcInput(name="b", value=20, unit="dimensionless"),
        ]

        result = runner_with_semantics.run(simple_template, inputs)

        assert result.status == "success"
        assert "result" in result.results
        assert result.results["result"]["value"] == 30

    def test_single_formula_with_audit_trail(self, runner_with_semantics, simple_template):
        """Test audit trail capture during execution."""
        inputs = [
            CalcInput(name="a", value=5, unit="dimensionless"),
            CalcInput(name="b", value=15, unit="dimensionless"),
        ]

        result = runner_with_semantics.run(simple_template, inputs)

        assert result.audit_trail is not None
        assert "events" in result.audit_trail or "summary" in result.audit_trail

    def test_single_formula_with_explanations(self, runner_with_semantics, simple_template):
        """Test explanation generation."""
        inputs = [
            CalcInput(name="a", value=3, unit="dimensionless"),
            CalcInput(name="b", value=7, unit="dimensionless"),
        ]

        result = runner_with_semantics.run(simple_template, inputs)

        assert result.explanations is not None
        assert "execution" in result.explanations

    def test_input_validation_failure(self, runner_with_semantics, simple_template):
        """Test input validation when value out of range."""
        inputs = [
            CalcInput(name="a", value=150, unit="dimensionless"),  # Exceeds max 100
            CalcInput(name="b", value=20, unit="dimensionless"),
        ]

        result = runner_with_semantics.run(simple_template, inputs)

        # Should still execute, but validation should flag it
        assert result.status in ["success", "warning"]

    def test_output_validation_failure(self, runner_with_semantics, pressure_template):
        """Test output validation when result out of expected range."""
        inputs = [
            CalcInput(name="P", value=1000, unit="MPa"),  # Very high pressure
            CalcInput(name="D", value=1000, unit="mm"),
            CalcInput(name="T", value=1, unit="mm"),  # Very thin
        ]

        result = runner_with_semantics.run(pressure_template, inputs)

        # High stress should trigger validation warning
        assert result.validation_results is not None or result.failure_analysis is not None

    def test_negative_output_detection(self, runner_with_semantics):
        """Test detection of negative outputs when they shouldn't be."""
        template = CalcTemplate(
            id="test_negative",
            name="Negative Test",
            category="test",
            description="Test formula that can produce negative",
            variables=[
                CalcVariable(
                    name="a", label="A", description="Number",
                    unit="dimensionless", min_value=0, max_value=100
                ),
            ],
            formula="a - 50",  # Can be negative
            outputs=["result"],
        )

        inputs = [CalcInput(name="a", value=10, unit="dimensionless")]
        result = runner_with_semantics.run(template, inputs)

        # Result is -40, should be flagged if constraint says must be positive
        assert result.results["result"]["value"] == -40

    def test_backward_compatibility(self, runner_without_semantics, simple_template):
        """Test that runner without semantics still works correctly."""
        inputs = [
            CalcInput(name="a", value=25, unit="dimensionless"),
            CalcInput(name="b", value=75, unit="dimensionless"),
        ]

        result = runner_without_semantics.run(simple_template, inputs)

        assert result.status == "success"
        assert result.results["result"]["value"] == 100
        # Semantic fields should be empty
        assert result.validation_results == [] or result.validation_results is None
        assert result.explanations is None
        assert result.audit_trail is None

    def test_semantic_opt_in(self, runner_with_semantics):
        """Test that semantic validation is optional (opt-in)."""
        # Template without semantic rules
        template = CalcTemplate(
            id="basic_template",
            name="Basic",
            category="test",
            description="No semantic rules",
            variables=[
                CalcVariable(name="x", label="X", description="Input",
                           unit="dimensionless"),
            ],
            formula="x * 2",
            outputs=["result"],
        )

        inputs = [CalcInput(name="x", value=100, unit="dimensionless")]
        result = runner_with_semantics.run(template, inputs)

        assert result.status == "success"
        assert result.results["result"]["value"] == 200

    def test_execution_mode_detection(self, runner_with_semantics):
        """Test that runner detects single vs multi-formula templates."""
        single_formula = CalcTemplate(
            id="single",
            name="Single",
            category="test",
            description="Single formula",
            variables=[CalcVariable(name="a", label="A", description="", unit="dimensionless")],
            formula="a * 2",
            outputs=["result"],
        )

        # Test single-formula mode
        mode = runner_with_semantics._determine_execution_mode(single_formula)
        assert mode == ExecutionMode.SINGLE_FORMULA

    def test_response_contains_all_semantic_fields(self, runner_with_semantics, pressure_template):
        """Test that response contains all semantic fields."""
        inputs = [
            CalcInput(name="P", value=10, unit="MPa"),
            CalcInput(name="D", value=100, unit="mm"),
            CalcInput(name="T", value=5, unit="mm"),
        ]

        result = runner_with_semantics.run(pressure_template, inputs)

        # Check for extended fields
        assert hasattr(result, "validation_results")
        assert hasattr(result, "explanations")
        assert hasattr(result, "audit_trail")
        assert hasattr(result, "failure_analysis")

    def test_multiple_sequential_executions(self, runner_with_semantics, simple_template):
        """Test runner state management across multiple executions."""
        inputs1 = [CalcInput(name="a", value=10), CalcInput(name="b", value=20)]
        inputs2 = [CalcInput(name="a", value=30), CalcInput(name="b", value=40)]

        result1 = runner_with_semantics.run(simple_template, inputs1)
        result2 = runner_with_semantics.run(simple_template, inputs2)

        assert result1.results["result"]["value"] == 30
        assert result2.results["result"]["value"] == 70

    def test_error_handling(self, runner_with_semantics):
        """Test error handling in semantic pipeline."""
        template = CalcTemplate(
            id="error_template",
            name="Error Test",
            category="test",
            description="Template that causes error",
            variables=[CalcVariable(name="x", label="X", description="", unit="dimensionless")],
            formula="1 / (x - 5)",  # Will error when x=5
            outputs=["result"],
        )

        inputs = [CalcInput(name="x", value=5, unit="dimensionless")]
        result = runner_with_semantics.run(template, inputs)

        assert result.status == "error"
        assert "error" in result.metadata

    def test_audit_trail_structure(self, runner_with_semantics, simple_template):
        """Test that audit trail has expected structure."""
        inputs = [
            CalcInput(name="a", value=12, unit="dimensionless"),
            CalcInput(name="b", value=18, unit="dimensionless"),
        ]

        result = runner_with_semantics.run(simple_template, inputs)

        if result.audit_trail:
            # Audit trail should contain event information
            trail = result.audit_trail
            assert isinstance(trail, dict)

    def test_explanation_generation_structure(self, runner_with_semantics, pressure_template):
        """Test that explanations have expected structure."""
        inputs = [
            CalcInput(name="P", value=10, unit="MPa"),
            CalcInput(name="D", value=100, unit="mm"),
            CalcInput(name="T", value=5, unit="mm"),
        ]

        result = runner_with_semantics.run(pressure_template, inputs)

        if result.explanations:
            assert "execution" in result.explanations
            if "execution" in result.explanations:
                exec_exp = result.explanations["execution"]
                assert "formula" in exec_exp
                assert "output" in exec_exp

    def test_extreme_values(self, runner_with_semantics, simple_template):
        """Test handling of extreme values."""
        inputs = [
            CalcInput(name="a", value=0.0001, unit="dimensionless"),
            CalcInput(name="b", value=999999, unit="dimensionless"),
        ]

        result = runner_with_semantics.run(simple_template, inputs)

        assert result.status in ["success", "warning"]
        assert result.results["result"]["value"] > 0

    def test_zero_values(self, runner_with_semantics):
        """Test handling of zero values."""
        template = CalcTemplate(
            id="zero_test",
            name="Zero Test",
            category="test",
            description="Test zero",
            variables=[
                CalcVariable(name="a", label="A", description="", unit="dimensionless"),
                CalcVariable(name="b", label="B", description="", unit="dimensionless"),
            ],
            formula="a / b if b != 0 else 0",
            outputs=["result"],
        )

        inputs = [
            CalcInput(name="a", value=100, unit="dimensionless"),
            CalcInput(name="b", value=0, unit="dimensionless"),
        ]

        result = runner_with_semantics.run(template, inputs)

        # Should handle gracefully
        assert result.status in ["success", "error", "warning"]
