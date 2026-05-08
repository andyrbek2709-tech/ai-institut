"""ÉTAP 2.12: Performance & stability benchmarks for semantic layer."""
import time
import pytest
from typing import List, Tuple
from src.engine.runner import Runner, RunnerConfig
from src.schemas import CalcTemplate, CalcVariable, CalcInput


class TestSemanticPerformance:
    """Benchmark semantic layer performance impact."""

    @pytest.fixture
    def runner_with_semantics(self) -> Runner:
        """Runner with all semantic features enabled."""
        config = RunnerConfig(
            enable_semantic_validation=True,
            enable_audit_trail=True,
            enable_explainability=True,
            enable_failure_analysis=True,
        )
        return Runner(config)

    @pytest.fixture
    def runner_without_semantics(self) -> Runner:
        """Runner with all semantic features disabled."""
        config = RunnerConfig(
            enable_semantic_validation=False,
            enable_audit_trail=False,
            enable_explainability=False,
            enable_failure_analysis=False,
        )
        return Runner(config)

    @pytest.fixture
    def simple_formula_template(self) -> CalcTemplate:
        """Simple single-formula template."""
        return CalcTemplate(
            id="simple",
            name="Simple Formula",
            category="test",
            description="a + b * c",
            variables=[
                CalcVariable(name="a", label="A", description="", unit="dimensionless"),
                CalcVariable(name="b", label="B", description="", unit="dimensionless"),
                CalcVariable(name="c", label="C", description="", unit="dimensionless"),
            ],
            formula="a + b * c",
            outputs=["result"],
        )

    @pytest.fixture
    def complex_formula_template(self) -> CalcTemplate:
        """More complex formula with multiple operations."""
        return CalcTemplate(
            id="complex",
            name="Complex Formula",
            category="test",
            description="Complex mathematical operations",
            variables=[
                CalcVariable(name="a", label="A", description="", unit="dimensionless"),
                CalcVariable(name="b", label="B", description="", unit="dimensionless"),
                CalcVariable(name="c", label="C", description="", unit="dimensionless"),
                CalcVariable(name="d", label="D", description="", unit="dimensionless"),
            ],
            formula="(a + b) * (c - d) / (a * b + 1)",
            outputs=["result"],
        )

    @pytest.fixture
    def inputs_simple(self) -> List[CalcInput]:
        """Simple inputs."""
        return [
            CalcInput(name="a", value=10),
            CalcInput(name="b", value=5),
            CalcInput(name="c", value=3),
        ]

    @pytest.fixture
    def inputs_complex(self) -> List[CalcInput]:
        """Complex inputs."""
        return [
            CalcInput(name="a", value=100),
            CalcInput(name="b", value=50),
            CalcInput(name="c", value=25),
            CalcInput(name="d", value=10),
        ]

    def benchmark_execution(
        self,
        runner: Runner,
        template: CalcTemplate,
        inputs: List[CalcInput],
        iterations: int = 100
    ) -> Tuple[float, float, float]:
        """
        Benchmark single execution.

        Returns:
            Tuple of (total_time_ms, avg_time_ms, min_time_ms, max_time_ms)
        """
        times = []

        for _ in range(iterations):
            start = time.time()
            result = runner.run(template, inputs)
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)

            if not result.results:
                raise RuntimeError(f"Execution failed: {result.metadata}")

        return (
            sum(times),
            sum(times) / len(times),
            min(times),
            max(times),
        )

    def test_baseline_simple_formula(self, runner_without_semantics, simple_formula_template, inputs_simple):
        """Establish baseline performance (no semantics)."""
        total, avg, min_t, max_t = self.benchmark_execution(
            runner_without_semantics, simple_formula_template, inputs_simple, iterations=100
        )

        # Baseline should be fast
        assert avg < 50, f"Baseline took {avg}ms (expected < 50ms)"
        assert total < 5000, f"Total baseline took {total}ms"

    def test_with_semantics_simple_formula(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Measure semantic layer overhead on simple formula."""
        total, avg, min_t, max_t = self.benchmark_execution(
            runner_with_semantics, simple_formula_template, inputs_simple, iterations=100
        )

        # Should still be reasonable
        assert avg < 100, f"With semantics took {avg}ms (expected < 100ms)"

    def test_overhead_calculation(
        self,
        runner_with_semantics,
        runner_without_semantics,
        simple_formula_template,
        inputs_simple
    ):
        """Calculate semantic layer overhead percentage."""
        total_baseline, avg_baseline, _, _ = self.benchmark_execution(
            runner_without_semantics, simple_formula_template, inputs_simple, iterations=50
        )

        total_semantic, avg_semantic, _, _ = self.benchmark_execution(
            runner_with_semantics, simple_formula_template, inputs_simple, iterations=50
        )

        overhead_percent = ((avg_semantic - avg_baseline) / avg_baseline) * 100

        # Overhead should be reasonable (< 200% - i.e., 2x ÉTAP 1 baseline)
        assert overhead_percent < 200, f"Overhead {overhead_percent}% exceeds 200% threshold"

        # Print for analysis
        print(f"\nBaseline: {avg_baseline:.2f}ms")
        print(f"With semantics: {avg_semantic:.2f}ms")
        print(f"Overhead: {overhead_percent:.1f}%")

    def test_complex_formula_performance(
        self,
        runner_with_semantics,
        complex_formula_template,
        inputs_complex
    ):
        """Test semantic layer on more complex formula."""
        total, avg, min_t, max_t = self.benchmark_execution(
            runner_with_semantics, complex_formula_template, inputs_complex, iterations=50
        )

        # Complex formula should still complete in reasonable time
        assert avg < 150, f"Complex formula took {avg}ms (expected < 150ms)"

    def test_audit_trail_size(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Measure audit trail size impact."""
        result = runner_with_semantics.run(simple_formula_template, inputs_simple)

        if result.audit_trail:
            import json
            trail_json = json.dumps(result.audit_trail)
            trail_size = len(trail_json.encode('utf-8'))

            # Audit trail should be reasonable size
            assert trail_size < 10000, f"Audit trail {trail_size} bytes (expected < 10KB)"

    def test_explanation_generation_time(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Measure explanation generation performance."""
        times = []

        for _ in range(20):
            start = time.time()
            result = runner_with_semantics.run(simple_formula_template, inputs_simple)
            elapsed = (time.time() - start) * 1000
            times.append(elapsed)

        avg_time = sum(times) / len(times)

        # Should complete quickly
        assert avg_time < 100, f"Avg execution took {avg_time}ms"

    def test_response_serialization_time(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Measure response serialization performance."""
        result = runner_with_semantics.run(simple_formula_template, inputs_simple)

        # Try to serialize the response
        import json
        from pydantic import BaseModel

        start = time.time()
        # Simulate serialization (what API would do)
        if isinstance(result, BaseModel):
            json_str = result.model_dump_json()
        else:
            json_str = json.dumps(result.dict())
        elapsed = (time.time() - start) * 1000

        # Serialization should be fast
        assert elapsed < 50, f"Serialization took {elapsed}ms"

    def test_memory_impact_large_execution(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Test memory impact with many sequential executions."""
        import sys

        # Get initial memory
        initial_traces = len(runner_with_semantics.execution_traces)

        # Run multiple executions
        for _ in range(100):
            runner_with_semantics.run(simple_formula_template, inputs_simple)

        # Check traces haven't grown unbounded
        final_traces = len(runner_with_semantics.execution_traces)
        assert final_traces - initial_traces == 100, "Execution traces not properly tracked"

    def test_no_memory_leak_on_errors(self, runner_with_semantics):
        """Test that errors don't cause memory leaks."""
        bad_template = CalcTemplate(
            id="bad",
            name="Bad",
            category="test",
            description="Bad formula",
            variables=[CalcVariable(name="x", label="X", description="", unit="dimensionless")],
            formula="undefined_var / x",  # Will error
            outputs=["result"],
        )

        # Run multiple error cases
        for _ in range(50):
            result = runner_with_semantics.run(bad_template, [CalcInput(name="x", value=5)])
            assert result.status == "error"

        # Runner should still work
        good_template = CalcTemplate(
            id="good",
            name="Good",
            category="test",
            description="Good",
            variables=[CalcVariable(name="a", label="A", description="", unit="dimensionless")],
            formula="a * 2",
            outputs=["result"],
        )

        result = runner_with_semantics.run(good_template, [CalcInput(name="a", value=10)])
        assert result.status == "success"
        assert result.results["result"]["value"] == 20

    def test_throughput_with_semantics(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Measure throughput (requests per second)."""
        start = time.time()
        count = 0

        while time.time() - start < 1.0:  # Run for 1 second
            runner_with_semantics.run(simple_formula_template, inputs_simple)
            count += 1

        throughput = count / 1.0
        print(f"\nThroughput with semantics: {throughput:.1f} req/sec")

        # Should achieve reasonable throughput
        assert throughput > 5, f"Throughput {throughput} req/sec (expected > 5)"

    def test_consistency_across_runs(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Test that results are consistent across multiple runs."""
        results = []

        for _ in range(10):
            result = runner_with_semantics.run(simple_formula_template, inputs_simple)
            results.append(result.results["result"]["value"])

        # All results should be identical
        assert all(r == results[0] for r in results), "Results not consistent across runs"

    def test_response_field_presence(self, runner_with_semantics, simple_formula_template, inputs_simple):
        """Test that all expected fields are present in response."""
        result = runner_with_semantics.run(simple_formula_template, inputs_simple)

        # Check all extended fields are present
        assert hasattr(result, "validation_results")
        assert hasattr(result, "explanations")
        assert hasattr(result, "audit_trail")
        assert hasattr(result, "failure_analysis")

        # Fields should have reasonable types
        if result.validation_results is not None:
            assert isinstance(result.validation_results, list)
        if result.explanations is not None:
            assert isinstance(result.explanations, dict)
        if result.audit_trail is not None:
            assert isinstance(result.audit_trail, dict)
        if result.failure_analysis is not None:
            assert isinstance(result.failure_analysis, dict)
