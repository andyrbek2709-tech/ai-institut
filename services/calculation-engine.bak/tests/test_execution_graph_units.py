"""Unit-aware execution graph tests for ÉTAP 1.2 integration."""
import pytest
from src.engine.execution_graph import (
    FormulaExecutionGraph, ExecutionTrace, UnitPropagationValidator, VariableCategory
)


class TestUnitAwareExecutionGraph:
    """Test unit tracking through execution graph."""

    def test_formula_node_unit_metadata(self):
        """Test that FormulaNode captures input/output units."""
        template = {
            "metadata": {"id": "test", "name": "Unit Test"},
            "variables": {
                "pressure": {"category": "input", "unit": "MPa", "description": "Input pressure"},
                "area": {"category": "input", "unit": "mm**2", "description": "Area"},
                "force": {"category": "output", "unit": "N", "description": "Output force"}
            },
            "formulas": {
                "calc_force": {
                    "expression": "pressure * area",
                    "depends_on": ["pressure", "area"],
                    "outputs": ["force"],
                    "description": "Calculate force"
                }
            }
        }

        graph = FormulaExecutionGraph(template)
        node = graph.formula_nodes["calc_force"]

        # Verify unit metadata captured
        assert node.input_units["pressure"] == "MPa"
        assert node.input_units["area"] == "mm**2"
        assert node.output_units["force"] == "N"

    def test_unit_flow_through_chain(self):
        """Test unit tracking through multi-formula dependency chain."""
        template = {
            "metadata": {"id": "test", "name": "Chain Test"},
            "variables": {
                "stress": {"category": "input", "unit": "MPa", "description": "Input stress"},
                "area": {"category": "input", "unit": "mm**2", "description": "Area"},
                "force": {"category": "intermediate", "unit": "N", "description": "Intermediate force"},
                "power": {"category": "output", "unit": "W", "description": "Output power"}
            },
            "formulas": {
                "calc_force": {
                    "expression": "stress * area",
                    "depends_on": ["stress", "area"],
                    "outputs": ["force"],
                    "description": "Force from stress and area"
                },
                "calc_power": {
                    "expression": "force * 1000",
                    "depends_on": ["force"],
                    "outputs": ["power"],
                    "description": "Power (simplified)"
                }
            }
        }

        graph = FormulaExecutionGraph(template)

        # Check force formula units
        force_node = graph.formula_nodes["calc_force"]
        assert force_node.input_units == {"stress": "MPa", "area": "mm**2"}
        assert force_node.output_units == {"force": "N"}

        # Check power formula units
        power_node = graph.formula_nodes["calc_power"]
        assert power_node.input_units == {"force": "N"}
        assert power_node.output_units == {"power": "W"}

    def test_unit_flow_path_tracing(self):
        """Test tracing unit flow through formula dependencies."""
        template = {
            "metadata": {"id": "test", "name": "Path Test"},
            "variables": {
                "a": {"category": "input", "unit": "MPa"},
                "b": {"category": "input", "unit": "mm**2"},
                "c": {"category": "intermediate", "unit": "N"},
                "d": {"category": "output", "unit": "N"}
            },
            "formulas": {
                "f1": {
                    "expression": "a * b",
                    "depends_on": ["a", "b"],
                    "outputs": ["c"],
                    "description": "Intermediate"
                },
                "f2": {
                    "expression": "c * 1",
                    "depends_on": ["c"],
                    "outputs": ["d"],
                    "description": "Output"
                }
            }
        }

        graph = FormulaExecutionGraph(template)

        # Trace unit flow for output formula
        flow = graph.get_unit_flow_path("f2")

        assert flow["formula_id"] == "f2"
        assert flow["input_units"] == {"c": "N"}
        assert flow["output_units"] == {"d": "N"}
        assert "f1" in flow["dependency_units"]
        assert flow["dependency_units"]["f1"] == {"c": "N"}

    def test_unit_propagation_validator_no_issues(self):
        """Test that valid unit propagation passes validation."""
        template = {
            "metadata": {"id": "test", "name": "Valid Units"},
            "variables": {
                "p": {"category": "input", "unit": "MPa"},
                "a": {"category": "input", "unit": "mm**2"},
                "f": {"category": "output", "unit": "N"}
            },
            "formulas": {
                "calc": {
                    "expression": "p * a",
                    "depends_on": ["p", "a"],
                    "outputs": ["f"],
                    "description": "Force calc"
                }
            }
        }

        graph = FormulaExecutionGraph(template)
        validator = UnitPropagationValidator(graph)
        result = validator.validate_unit_propagation()

        assert result["valid"] is True
        assert len(result["issues"]) == 0

    def test_execution_plan_captures_required_input_units(self):
        """Test that execution plan captures required input units."""
        template = {
            "metadata": {"id": "test", "name": "Input Units"},
            "variables": {
                "pressure": {"category": "input", "unit": "MPa"},
                "area": {"category": "input", "unit": "mm**2"},
                "force": {"category": "output", "unit": "N"}
            },
            "formulas": {
                "calc": {
                    "expression": "pressure * area",
                    "depends_on": ["pressure", "area"],
                    "outputs": ["force"],
                    "description": "Test"
                }
            }
        }

        graph = FormulaExecutionGraph(template)
        plan = graph.plan_execution()

        # Verify required input units captured
        assert plan.required_input_units["pressure"] == "MPa"
        assert plan.required_input_units["area"] == "mm**2"
        assert plan.unit_flow_valid is True

    def test_execution_trace_with_unit_metadata(self):
        """Test ExecutionTrace captures unit-aware metadata."""
        trace = ExecutionTrace(
            formula_id="test_formula",
            expression="pressure * area",
            inputs_used={"pressure": 100.0, "area": 50.0},
            output=5000.0,
            unit="N",
            input_units={"pressure": "MPa", "area": "mm**2"},
            output_unit="N",
            dimensional_check="passed",
            unit_conversions=[]
        )

        assert trace.input_units == {"pressure": "MPa", "area": "mm**2"}
        assert trace.output_unit == "N"
        assert trace.dimensional_check == "passed"
        assert trace.unit_conversions == []

    def test_execution_trace_tracks_conversions(self):
        """Test ExecutionTrace tracks unit conversions during execution."""
        trace = ExecutionTrace(
            formula_id="test",
            expression="a + b",
            inputs_used={"a": 1000.0, "b": 1.0},
            output=1001.0,
            unit="mm",
            input_units={"a": "mm", "b": "cm"},
            output_unit="mm",
            dimensional_check="passed",
            unit_conversions=[
                ("b", "cm", "mm")
            ]
        )

        assert len(trace.unit_conversions) == 1
        assert trace.unit_conversions[0] == ("b", "cm", "mm")

    def test_complex_dag_unit_metadata(self):
        """Test unit metadata in complex multi-level DAG."""
        template = {
            "metadata": {"id": "complex", "name": "Complex DAG"},
            "variables": {
                # Inputs
                "stress": {"category": "input", "unit": "MPa"},
                "area": {"category": "input", "unit": "mm**2"},
                "distance": {"category": "input", "unit": "m"},
                # Intermediates
                "force": {"category": "intermediate", "unit": "N"},
                "moment": {"category": "intermediate", "unit": "N*m"},
                # Outputs
                "result": {"category": "output", "unit": "N*m"}
            },
            "formulas": {
                "f_force": {
                    "expression": "stress * area",
                    "depends_on": ["stress", "area"],
                    "outputs": ["force"],
                    "description": "Force from stress"
                },
                "f_moment": {
                    "expression": "force * distance",
                    "depends_on": ["force", "distance"],
                    "outputs": ["moment"],
                    "description": "Moment from force"
                },
                "f_result": {
                    "expression": "moment",
                    "depends_on": ["moment"],
                    "outputs": ["result"],
                    "description": "Final result"
                }
            }
        }

        graph = FormulaExecutionGraph(template)

        # Verify all formulas have correct unit metadata
        assert graph.formula_nodes["f_force"].input_units == {"stress": "MPa", "area": "mm**2"}
        assert graph.formula_nodes["f_force"].output_units == {"force": "N"}

        assert graph.formula_nodes["f_moment"].input_units == {"force": "N", "distance": "m"}
        assert graph.formula_nodes["f_moment"].output_units == {"moment": "N*m"}

        assert graph.formula_nodes["f_result"].input_units == {"moment": "N*m"}
        assert graph.formula_nodes["f_result"].output_units == {"result": "N*m"}

        # Verify execution plan includes unit validation
        plan = graph.plan_execution()
        assert plan.unit_flow_valid is True
        assert len(plan.required_input_units) == 3

    def test_get_required_units_for_formula(self):
        """Test retrieving required units for a specific formula."""
        template = {
            "metadata": {"id": "test", "name": "Required Units"},
            "variables": {
                "p": {"category": "input", "unit": "kPa"},
                "a": {"category": "input", "unit": "cm**2"},
                "f": {"category": "output", "unit": "N"}
            },
            "formulas": {
                "calc": {
                    "expression": "p * a",
                    "depends_on": ["p", "a"],
                    "outputs": ["f"],
                    "description": "Test"
                }
            }
        }

        graph = FormulaExecutionGraph(template)
        validator = UnitPropagationValidator(graph)
        required = validator.get_required_units_for_formula("calc")

        assert required["p"] == "kPa"
        assert required["a"] == "cm**2"

    def test_validate_execution_with_units(self):
        """Test full execution validation with unit constraints."""
        template = {
            "metadata": {"id": "test", "name": "Validate"},
            "variables": {
                "x": {"category": "input", "unit": "m"},
                "y": {"category": "input", "unit": "m"},
                "z": {"category": "output", "unit": "m**2"}
            },
            "formulas": {
                "calc": {
                    "expression": "x * y",
                    "depends_on": ["x", "y"],
                    "outputs": ["z"],
                    "description": "Test"
                }
            }
        }

        graph = FormulaExecutionGraph(template)
        validation = graph.validate_execution_with_units()

        assert validation["valid"] is True
        assert validation["execution_plan"] is not None
        assert len(validation["unit_flow_issues"]) == 0

    def test_unit_metadata_with_no_units(self):
        """Test handling of formulas with no unit information."""
        template = {
            "metadata": {"id": "test", "name": "No Units"},
            "variables": {
                "a": {"category": "input", "description": "No unit"},
                "b": {"category": "input", "description": "No unit"},
                "c": {"category": "output", "description": "No unit"}
            },
            "formulas": {
                "calc": {
                    "expression": "a + b",
                    "depends_on": ["a", "b"],
                    "outputs": ["c"],
                    "description": "Test"
                }
            }
        }

        graph = FormulaExecutionGraph(template)
        node = graph.formula_nodes["calc"]

        # Should have empty unit dicts (not raise errors)
        assert node.input_units == {}
        assert node.output_units == {}

        plan = graph.plan_execution()
        assert plan.unit_flow_valid is True
