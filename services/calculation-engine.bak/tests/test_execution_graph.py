"""Tests for FormulaExecutionGraph."""
import pytest
from src.engine.execution_graph import FormulaExecutionGraph, ExecutionTrace


class TestExecutionGraphBasics:
    """Test basic graph construction and operations."""

    @pytest.fixture
    def simple_template(self):
        """Single formula template."""
        return {
            "metadata": {
                "id": "simple_stress",
                "name": "Simple Stress",
                "version": "1.0.0",
                "category": "mechanical",
            },
            "variables": {
                "pressure": {
                    "category": "input",
                    "label": "Pressure",
                    "unit": "MPa",
                },
                "stress": {
                    "category": "output",
                    "label": "Stress",
                    "unit": "MPa",
                },
            },
            "formulas": {
                "calculate_stress": {
                    "expression": "pressure * 2",
                    "description": "Simple stress calc",
                    "depends_on": ["pressure"],
                    "outputs": ["stress"],
                    "unit": "MPa",
                }
            },
        }

    @pytest.fixture
    def chain_template(self):
        """Linear dependency chain: A -> B -> C."""
        return {
            "metadata": {
                "id": "chain_stress",
                "name": "Chain Stress",
                "version": "1.0.0",
            },
            "variables": {
                "x": {"category": "input", "label": "X"},
                "y": {"category": "intermediate", "label": "Y"},
                "z": {"category": "output", "label": "Z"},
            },
            "formulas": {
                "step_a": {
                    "expression": "x + 1",
                    "description": "Step A",
                    "depends_on": ["x"],
                    "outputs": ["y"],
                },
                "step_b": {
                    "expression": "y * 2",
                    "description": "Step B",
                    "depends_on": ["y"],
                    "outputs": ["z"],
                },
            },
        }

    @pytest.fixture
    def branching_template(self):
        """Branching dependencies: A->C, B->C."""
        return {
            "metadata": {"id": "branching"},
            "variables": {
                "a": {"category": "input"},
                "b": {"category": "input"},
                "c": {"category": "output"},
            },
            "formulas": {
                "sum_ab": {
                    "expression": "a + b",
                    "description": "Sum",
                    "depends_on": ["a", "b"],
                    "outputs": ["c"],
                },
            },
        }

    def test_simple_graph_creation(self, simple_template):
        """Test creating a simple graph with one formula."""
        graph = FormulaExecutionGraph(simple_template)

        assert graph.is_executable()
        assert len(graph.formula_nodes) == 1
        assert "calculate_stress" in graph.formula_nodes
        assert graph.get_cycles() == []

    def test_execution_order_single_formula(self, simple_template):
        """Test topological sort for single formula."""
        graph = FormulaExecutionGraph(simple_template)
        order = graph.get_execution_order()

        assert order == ["calculate_stress"]

    def test_execution_order_chain(self, chain_template):
        """Test topological sort for chain A->B->C."""
        graph = FormulaExecutionGraph(chain_template)
        order = graph.get_execution_order()

        # step_a must come before step_b
        assert order.index("step_a") < order.index("step_b")
        assert len(order) == 2

    def test_execution_order_branching(self, branching_template):
        """Test topological sort for branching."""
        graph = FormulaExecutionGraph(branching_template)
        order = graph.get_execution_order()

        assert len(order) == 1
        assert "sum_ab" in order

    def test_required_inputs(self, chain_template):
        """Test identification of required input variables."""
        graph = FormulaExecutionGraph(chain_template)
        plan = graph.plan_execution()

        assert "x" in plan.required_inputs
        assert "y" not in plan.required_inputs  # y is computed
        assert "z" not in plan.required_inputs  # z is computed

    def test_intermediate_identification(self, chain_template):
        """Test identification of intermediate variables."""
        graph = FormulaExecutionGraph(chain_template)
        plan = graph.plan_execution()

        assert "step_a" in plan.intermediate_formulas
        assert "step_b" not in plan.intermediate_formulas  # Produces output

    def test_output_identification(self, chain_template):
        """Test identification of output formulas."""
        graph = FormulaExecutionGraph(chain_template)
        plan = graph.plan_execution()

        assert "step_b" in plan.output_formulas

    def test_dependencies(self, chain_template):
        """Test dependency analysis."""
        graph = FormulaExecutionGraph(chain_template)

        # step_b depends on step_a
        deps = graph.get_dependencies("step_b")
        assert "step_a" in deps

        # step_a has no dependencies
        deps = graph.get_dependencies("step_a")
        assert len(deps) == 0

    def test_dependents(self, chain_template):
        """Test dependent analysis."""
        graph = FormulaExecutionGraph(chain_template)

        # step_a has step_b depending on it
        deps = graph.get_dependents("step_a")
        assert "step_b" in deps

        # step_b has no dependents
        deps = graph.get_dependents("step_b")
        assert len(deps) == 0


class TestCircularDependencies:
    """Test circular dependency detection."""

    @pytest.fixture
    def circular_template(self):
        """Template with circular dependency: A -> B -> A."""
        return {
            "metadata": {"id": "circular"},
            "variables": {
                "a": {"category": "output"},
                "b": {"category": "output"},
            },
            "formulas": {
                "formula_a": {
                    "expression": "b + 1",
                    "description": "Depends on B",
                    "depends_on": ["b"],
                    "outputs": ["a"],
                },
                "formula_b": {
                    "expression": "a + 1",
                    "description": "Depends on A",
                    "depends_on": ["a"],
                    "outputs": ["b"],
                },
            },
        }

    @pytest.fixture
    def self_loop_template(self):
        """Template with self-loop: A -> A."""
        return {
            "metadata": {"id": "self_loop"},
            "variables": {
                "x": {"category": "output"},
            },
            "formulas": {
                "recursive": {
                    "expression": "x * 2",
                    "description": "Self-referencing",
                    "depends_on": ["x"],
                    "outputs": ["x"],
                },
            },
        }

    def test_circular_detection(self, circular_template):
        """Test detection of A->B->A cycle."""
        graph = FormulaExecutionGraph(circular_template)

        assert not graph.is_executable()
        cycles = graph.get_cycles()
        assert len(cycles) > 0

    def test_self_loop_detection(self, self_loop_template):
        """Test detection of self-loop."""
        graph = FormulaExecutionGraph(self_loop_template)

        assert not graph.is_executable()
        cycles = graph.get_cycles()
        assert len(cycles) > 0

    def test_execution_order_raises_on_circular(self, circular_template):
        """Test that get_execution_order raises ValueError for circular deps."""
        graph = FormulaExecutionGraph(circular_template)

        with pytest.raises(ValueError, match="circular dependencies"):
            graph.get_execution_order()

    def test_plan_marks_non_executable(self, circular_template):
        """Test that plan marks graph as non-executable."""
        graph = FormulaExecutionGraph(circular_template)
        plan = graph.plan_execution()

        assert not plan.is_executable


class TestExecutionPlanning:
    """Test execution plan generation."""

    @pytest.fixture
    def complex_template(self):
        """More complex template with multiple branches."""
        return {
            "metadata": {"id": "complex"},
            "variables": {
                "p": {"category": "input"},
                "d": {"category": "input"},
                "t": {"category": "input"},
                "stress1": {"category": "intermediate"},
                "stress2": {"category": "intermediate"},
                "avg_stress": {"category": "output"},
            },
            "formulas": {
                "calc_stress1": {
                    "expression": "(p * d) / (2 * t)",
                    "description": "Hoop stress",
                    "depends_on": ["p", "d", "t"],
                    "outputs": ["stress1"],
                },
                "calc_stress2": {
                    "expression": "p / 2",
                    "description": "Axial stress",
                    "depends_on": ["p"],
                    "outputs": ["stress2"],
                },
                "avg_formula": {
                    "expression": "(stress1 + stress2) / 2",
                    "description": "Average",
                    "depends_on": ["stress1", "stress2"],
                    "outputs": ["avg_stress"],
                },
            },
        }

    def test_plan_creation(self, complex_template):
        """Test execution plan creation."""
        graph = FormulaExecutionGraph(complex_template)
        plan = graph.plan_execution()

        assert plan.is_executable
        assert len(plan.formula_order) == 3

        # calc_stress1 and calc_stress2 must come before avg_formula
        avg_idx = plan.formula_order.index("avg_formula")
        stress1_idx = plan.formula_order.index("calc_stress1")
        stress2_idx = plan.formula_order.index("calc_stress2")

        assert stress1_idx < avg_idx
        assert stress2_idx < avg_idx

    def test_required_inputs_complex(self, complex_template):
        """Test required input identification."""
        graph = FormulaExecutionGraph(complex_template)
        plan = graph.plan_execution()

        assert plan.required_inputs == {"p", "d", "t"}

    def test_lazy_evaluation(self, complex_template):
        """Test lazy evaluation (only compute what's needed)."""
        graph = FormulaExecutionGraph(complex_template)

        # Only need stress1, not avg_stress
        required = graph.get_required_for_output(["stress1"])

        # Must include calc_stress1
        assert "calc_stress1" in required
        # Must NOT include avg_formula (not needed for stress1)
        assert "avg_formula" not in required

    def test_lazy_evaluation_transitive(self, complex_template):
        """Test lazy evaluation with transitive dependencies."""
        graph = FormulaExecutionGraph(complex_template)

        # To compute avg_stress, need stress1 and stress2
        required = graph.get_required_for_output(["avg_stress"])

        assert "calc_stress1" in required
        assert "calc_stress2" in required
        assert "avg_formula" in required


class TestExecutionTracing:
    """Test execution trace collection."""

    @pytest.fixture
    def simple_template(self):
        return {
            "metadata": {"id": "trace_test"},
            "variables": {
                "x": {"category": "input"},
                "y": {"category": "output"},
            },
            "formulas": {
                "compute_y": {
                    "expression": "x * 2",
                    "description": "Double",
                    "depends_on": ["x"],
                    "outputs": ["y"],
                },
            },
        }

    def test_add_trace(self, simple_template):
        """Test adding execution trace."""
        graph = FormulaExecutionGraph(simple_template)

        trace = ExecutionTrace(
            formula_id="compute_y",
            expression="x * 2",
            inputs_used={"x": 10},
            output=20.0,
            unit="units",
            duration_ms=1.5
        )

        graph.add_trace("compute_y", trace)

        retrieved = graph.get_trace("compute_y")
        assert retrieved is not None
        assert retrieved.output == 20.0
        assert retrieved.duration_ms == 1.5

    def test_get_all_traces_ordered(self, simple_template):
        """Test getting all traces in execution order."""
        graph = FormulaExecutionGraph(simple_template)

        trace = ExecutionTrace(
            formula_id="compute_y",
            expression="x * 2",
            inputs_used={"x": 10},
            output=20.0
        )

        graph.add_trace("compute_y", trace)

        all_traces = graph.get_all_traces()
        assert len(all_traces) == 1
        assert all_traces[0].formula_id == "compute_y"

    def test_clear_traces(self, simple_template):
        """Test clearing execution traces."""
        graph = FormulaExecutionGraph(simple_template)

        trace = ExecutionTrace(
            formula_id="compute_y",
            expression="x * 2",
            inputs_used={"x": 10},
            output=20.0
        )

        graph.add_trace("compute_y", trace)
        assert graph.get_trace("compute_y") is not None

        graph.clear_traces()
        assert graph.get_trace("compute_y") is None


class TestStatistics:
    """Test graph statistics."""

    @pytest.fixture
    def template_with_stats(self):
        return {
            "metadata": {"id": "stats"},
            "variables": {
                "a": {"category": "input"},
                "b": {"category": "input"},
                "x": {"category": "intermediate"},
                "y": {"category": "intermediate"},
                "z": {"category": "output"},
            },
            "formulas": {
                "step1": {
                    "expression": "a + b",
                    "description": "",
                    "depends_on": ["a", "b"],
                    "outputs": ["x"],
                },
                "step2": {
                    "expression": "x * 2",
                    "description": "",
                    "depends_on": ["x"],
                    "outputs": ["y"],
                },
                "step3": {
                    "expression": "y + 1",
                    "description": "",
                    "depends_on": ["y"],
                    "outputs": ["z"],
                },
            },
        }

    def test_statistics(self, template_with_stats):
        """Test statistics collection."""
        graph = FormulaExecutionGraph(template_with_stats)
        stats = graph.get_statistics()

        assert stats["total_formulas"] == 3
        assert stats["is_executable"] is True
        assert stats["num_inputs"] == 2
        assert stats["num_intermediate"] == 2
        assert stats["num_outputs"] == 1
        assert stats["num_cycles"] == 0
        assert stats["max_depth"] >= 0


class TestVisualization:
    """Test visualization/mermaid output."""

    @pytest.fixture
    def simple_template(self):
        return {
            "metadata": {"id": "viz"},
            "variables": {
                "x": {"category": "input"},
                "y": {"category": "output"},
            },
            "formulas": {
                "compute": {
                    "expression": "x * 2",
                    "description": "Double input",
                    "depends_on": ["x"],
                    "outputs": ["y"],
                },
            },
        }

    def test_mermaid_output(self, simple_template):
        """Test Mermaid diagram generation."""
        graph = FormulaExecutionGraph(simple_template)
        mermaid = graph.visualize_mermaid()

        assert "graph TD" in mermaid
        assert "compute" in mermaid
        assert "-->" in mermaid or "compute" in mermaid  # At least node exists


class TestEdgeCases:
    """Test edge cases."""

    def test_empty_template(self):
        """Test graph with no formulas."""
        template = {
            "metadata": {"id": "empty"},
            "variables": {},
            "formulas": {},
        }

        graph = FormulaExecutionGraph(template)
        assert graph.is_executable()
        assert len(graph.formula_nodes) == 0
        assert graph.get_execution_order() == []

    def test_formula_no_outputs(self):
        """Test formula with no outputs field."""
        template = {
            "metadata": {"id": "no_outputs"},
            "variables": {
                "x": {"category": "input"},
                "y": {"category": "output"},
            },
            "formulas": {
                "compute": {
                    "expression": "x * 2",
                    "description": "Double",
                    "depends_on": ["x"],
                    # No "outputs" field
                },
            },
        }

        graph = FormulaExecutionGraph(template)
        assert graph.is_executable()

    def test_formula_empty_depends_on(self):
        """Test formula with empty depends_on."""
        template = {
            "metadata": {"id": "empty_deps"},
            "variables": {
                "const": {"category": "constant"},
            },
            "formulas": {
                "constant_formula": {
                    "expression": "3.14159",
                    "description": "Pi",
                    "depends_on": [],  # No dependencies
                    "outputs": ["const"],
                },
            },
        }

        graph = FormulaExecutionGraph(template)
        assert graph.is_executable()
        order = graph.get_execution_order()
        assert "constant_formula" in order
