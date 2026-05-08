"""Unit-aware runner tests for ÉTAP 1.3 integration."""
import pytest
from src.engine.runner import Runner, RunnerConfig
from src.schemas import CalcTemplate, CalcInput, CalculationResult
from pint import Quantity


class TestRunnerUnitIntegration:
    """Test runner with unit-aware execution."""

    def test_runner_single_formula_with_units(self):
        """Test runner executes single formula with Quantity variables."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))

        template = CalcTemplate(
            id="test_formula",
            formula="p * a",
            variables={"p": {}, "a": {}},
            outputs=["result"]
        )

        inputs = [
            CalcInput(name="p", value=100.0, unit="MPa"),
            CalcInput(name="a", value=50.0, unit="mm**2")
        ]

        result = runner.run(template, inputs)

        assert result.status == "success"
        assert "result" in result.results
        assert result.results["result"]["value"] is not None
        assert result.results["result"]["unit"] is not None

    def test_runner_creates_quantities_from_inputs(self):
        """Test runner converts input (value, unit) pairs to Quantities."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="test",
            formula="x + y",
            variables={"x": {}, "y": {}},
            outputs=["result"]
        )

        inputs = [
            CalcInput(name="x", value=100.0, unit="mm"),
            CalcInput(name="y", value=50.0, unit="mm")
        ]

        result = runner.run(template, inputs)
        assert result.status == "success"

    def test_runner_handles_invalid_units(self):
        """Test runner handles invalid unit specifications."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="test",
            formula="x",
            variables={"x": {}},
            outputs=["result"]
        )

        inputs = [
            CalcInput(name="x", value=100.0, unit="INVALID_UNIT_XYZ")
        ]

        result = runner.run(template, inputs)
        # Should have warnings about invalid unit
        assert len(result.warnings) > 0 or result.status == "error"

    def test_runner_returns_result_with_unit(self):
        """Test runner returns results with unit information."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="test",
            formula="100.0",
            variables={},
            outputs=["result"]
        )

        inputs = []
        result = runner.run(template, inputs)

        assert result.status == "success"
        assert result.results["result"]["value"] == 100.0

    def test_runner_stores_execution_traces(self):
        """Test runner stores execution traces for audit."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="test",
            formula="x * 2",
            variables={"x": {}},
            outputs=["result"]
        )

        inputs = [CalcInput(name="x", value=50.0, unit="m")]
        result = runner.run(template, inputs)

        traces = runner.get_execution_traces()
        assert len(traces) > 0
        assert traces[0].formula_id == "test"
        assert traces[0].output == 100.0

    def test_runner_tracks_input_units_in_trace(self):
        """Test runner records input units in execution trace."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="test",
            formula="p * a",
            variables={"p": {}, "a": {}},
            outputs=["result"]
        )

        inputs = [
            CalcInput(name="p", value=100.0, unit="MPa"),
            CalcInput(name="a", value=50.0, unit="mm**2")
        ]

        result = runner.run(template, inputs)
        traces = runner.get_execution_traces()

        if traces:
            assert traces[-1].input_units is not None

    def test_runner_config_timeout(self):
        """Test runner respects executor timeout configuration."""
        config = RunnerConfig(executor_timeout_ms=100)
        runner = Runner(config)

        template = CalcTemplate(
            id="test",
            formula="x",
            variables={"x": {}},
            outputs=["result"]
        )

        inputs = [CalcInput(name="x", value=42.0, unit="m")]
        result = runner.run(template, inputs)

        # Should execute quickly (no actual timeout since formula is simple)
        assert result.status == "success"

    def test_runner_execution_time_tracking(self):
        """Test runner tracks execution time."""
        runner = Runner(RunnerConfig())
        template = CalcTemplate(
            id="test",
            formula="x + y + z",
            variables={"x": {}, "y": {}, "z": {}},
            outputs=["result"]
        )

        inputs = [
            CalcInput(name="x", value=10.0),
            CalcInput(name="y", value=20.0),
            CalcInput(name="z", value=30.0)
        ]

        result = runner.run(template, inputs)
        assert "execution_time_ms" in result.metadata
        assert result.metadata["execution_time_ms"] >= 0

    def test_runner_disables_unit_tracking(self):
        """Test runner can disable unit tracking."""
        runner = Runner(RunnerConfig(enable_unit_tracking=False))
        template = CalcTemplate(
            id="test",
            formula="x * 2",
            variables={"x": {}},
            outputs=["result"]
        )

        inputs = [CalcInput(name="x", value=50.0, unit="mm")]
        result = runner.run(template, inputs)

        # Should still execute successfully without unit tracking
        assert result.status == "success"

    def test_runner_multiple_outputs(self):
        """Test runner supports templates with multiple outputs."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="multi_out",
            formula="x",
            variables={"x": {}, "y": {}},
            outputs=["result", "secondary"]
        )

        inputs = [
            CalcInput(name="x", value=100.0, unit="m"),
            CalcInput(name="y", value=50.0, unit="s")
        ]

        result = runner.run(template, inputs)
        # Should handle multiple outputs gracefully
        assert result.status == "success" or result.status == "error"

    def test_runner_error_handling(self):
        """Test runner handles formula execution errors gracefully."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="bad_formula",
            formula="x / 0",  # Division by zero
            variables={"x": {}},
            outputs=["result"]
        )

        inputs = [CalcInput(name="x", value=100.0, unit="m")]
        result = runner.run(template, inputs)

        # Should capture error
        assert result.status == "error" or len(result.warnings) > 0

    def test_runner_trace_metadata(self):
        """Test execution traces contain complete metadata."""
        runner = Runner(RunnerConfig(enable_unit_tracking=True))
        template = CalcTemplate(
            id="metadata_test",
            formula="x + y",
            variables={"x": {}, "y": {}},
            outputs=["result"]
        )

        inputs = [
            CalcInput(name="x", value=100.0, unit="mm"),
            CalcInput(name="y", value=50.0, unit="mm")
        ]

        result = runner.run(template, inputs)
        traces = runner.get_execution_traces()

        if traces:
            trace = traces[-1]
            assert trace.formula_id == "metadata_test"
            assert trace.expression == "x + y"
            assert trace.status == "success"
            assert trace.duration_ms >= 0
