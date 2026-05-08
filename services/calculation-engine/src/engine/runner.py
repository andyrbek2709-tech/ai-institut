"""Calculation runner - orchestrates evaluation with unit-aware execution."""
import time
from typing import Any, Optional, Dict
from dataclasses import dataclass
from enum import Enum

from src.schemas import CalcTemplate, CalcInput, CalculationResult
from src.engine.execution_graph import FormulaExecutionGraph, ExecutionPlan, ExecutionTrace
from src.engine.pint_safe_executor import PintAwareSafeFormulaExecutor
from src.engine.unit_manager import UnitManager, InvalidUnitError
from pint import Quantity


class ExecutionMode(str, Enum):
    """Execution mode for runner."""
    SINGLE_FORMULA = "single_formula"  # Legacy: single formula
    GRAPH_BASED = "graph_based"  # New: multi-formula DAG


@dataclass
class RunnerConfig:
    """Configuration for runner execution."""
    executor_timeout_ms: int = 1000
    enable_unit_tracking: bool = True
    enable_dimensional_checks: bool = True


class Runner:
    """
    Unit-aware calculation runner with support for single and multi-formula templates.

    Execution modes:
    - SINGLE_FORMULA: Legacy single-formula template (backward compatible)
    - GRAPH_BASED: New multi-formula DAG execution with unit propagation
    """

    def __init__(self, config: Optional[RunnerConfig] = None):
        """Initialize runner with configuration."""
        self.config = config or RunnerConfig()
        self.executor = PintAwareSafeFormulaExecutor(self.config.executor_timeout_ms)
        self.unit_manager = UnitManager()
        self.execution_traces = []

    def run(
        self,
        template: CalcTemplate,
        inputs: list[CalcInput],
    ) -> CalculationResult:
        """
        Execute calculation with given template and inputs.

        Automatically selects execution mode (SINGLE_FORMULA or GRAPH_BASED)
        based on template structure.

        Args:
            template: Calculation template
            inputs: List of input values

        Returns:
            CalculationResult with results or errors
        """
        start_time = time.time()

        # Determine execution mode
        mode = self._determine_execution_mode(template)

        try:
            if mode == ExecutionMode.SINGLE_FORMULA:
                return self._execute_single_formula(template, inputs, start_time)
            else:
                return self._execute_with_graph(template, inputs, start_time)
        except Exception as e:
            return CalculationResult(
                template_id=template.id,
                status="error",
                results={},
                warnings=[],
                metadata={"error": str(e)},
            )

    def _determine_execution_mode(self, template: CalcTemplate) -> ExecutionMode:
        """Determine which execution mode to use."""
        # Check if template is YAML/dict based (multi-formula)
        if isinstance(template, dict):
            if "formulas" in template and len(template.get("formulas", {})) > 1:
                return ExecutionMode.GRAPH_BASED

        return ExecutionMode.SINGLE_FORMULA

    def _execute_single_formula(
        self,
        template: CalcTemplate,
        inputs: list[CalcInput],
        start_time: float
    ) -> CalculationResult:
        """Execute single-formula template (backward compatible)."""
        warnings = []
        metadata = {}

        # Build input variables as Quantities if unit tracking enabled
        variables = {}
        input_dict = {}

        for inp in inputs:
            input_dict[inp.name] = inp.value

            if self.config.enable_unit_tracking and inp.unit:
                try:
                    qty = self.unit_manager.create_quantity(inp.value, inp.unit)
                    variables[inp.name] = qty
                except InvalidUnitError as e:
                    warnings.append(f"Invalid unit for {inp.name}: {str(e)}")
                    variables[inp.name] = inp.value
            else:
                variables[inp.name] = inp.value

        # Get formula string
        formula = template.formula if hasattr(template, 'formula') else ""

        # Execute with unit-aware executor
        if variables and any(isinstance(v, Quantity) for v in variables.values()):
            # We have at least one Quantity - use unit-aware execution
            exec_result = self.executor.execute_with_units(
                formula,
                variables,
                formula_id=template.id
            )
        else:
            # Fall back to safe executor without units
            from src.engine.safe_executor import SafeFormulaExecutor
            safe_exec = SafeFormulaExecutor(self.config.executor_timeout_ms)
            exec_result = safe_exec.execute(
                formula,
                input_dict,
                formula_id=template.id
            )

        if not exec_result.is_success():
            return CalculationResult(
                template_id=template.id,
                status="error",
                results={},
                warnings=warnings,
                metadata={
                    "error": exec_result.error_message,
                    "error_code": exec_result.error_code
                },
            )

        # Build results
        results = {}
        outputs = template.outputs if hasattr(template, 'outputs') else ["result"]
        for output_var in outputs:
            if output_var == "result":
                results[output_var] = {
                    "value": exec_result.value,
                    "unit": exec_result.unit
                }
            else:
                results[output_var] = None

        # Store trace
        trace = ExecutionTrace(
            formula_id=template.id,
            expression=formula,
            inputs_used=input_dict,
            output=exec_result.value,
            unit=exec_result.unit,
            duration_ms=exec_result.duration_ms,
            status="success",
            input_units={k: (str(v.units) if isinstance(v, Quantity) else None)
                        for k, v in variables.items()},
            output_unit=exec_result.unit
        )
        self.execution_traces.append(trace)

        return CalculationResult(
            template_id=template.id,
            status="success",
            results=results,
            warnings=warnings,
            metadata={
                "formula": formula,
                "inputs": input_dict,
                "execution_time_ms": (time.time() - start_time) * 1000,
                "execution_traces": [1]  # Number of formulas executed
            },
        )

    def _execute_with_graph(
        self,
        template: Dict[str, Any],
        inputs: list[CalcInput],
        start_time: float
    ) -> CalculationResult:
        """Execute multi-formula template with DAG execution."""
        warnings = []
        metadata = {}
        results = {}

        try:
            # Build execution graph
            graph = FormulaExecutionGraph(template)

            # Check executability
            plan = graph.plan_execution()
            if not plan.is_executable:
                return CalculationResult(
                    template_id=template.get("metadata", {}).get("id", "unknown"),
                    status="error",
                    results={},
                    warnings=warnings,
                    metadata={"error": "Graph has circular dependencies"},
                )

            # Build input variables as Quantities
            input_dict = {}
            variables = {}

            for inp in inputs:
                for var_id, var_def in template.get("variables", {}).items():
                    if var_def.get("label") == inp.name or var_id == inp.name:
                        input_dict[var_id] = inp.value

                        if self.config.enable_unit_tracking and inp.unit:
                            try:
                                qty = self.unit_manager.create_quantity(inp.value, inp.unit)
                                variables[var_id] = qty
                            except InvalidUnitError as e:
                                warnings.append(f"Invalid unit for {inp.name}: {str(e)}")
                                variables[var_id] = inp.value
                        else:
                            variables[var_id] = inp.value
                        break

            # Execute formulas in topological order
            for formula_id in plan.formula_order:
                node = graph.formula_nodes[formula_id]
                formula_def = template.get("formulas", {}).get(formula_id, {})

                # Collect inputs for this formula
                formula_inputs = {}
                for var_id in node.depends_on:
                    if var_id in variables:
                        formula_inputs[var_id] = variables[var_id]

                # Execute formula
                formula_expr = node.expression
                formula_start = time.time()

                if formula_inputs and any(isinstance(v, Quantity) for v in formula_inputs.values()):
                    exec_result = self.executor.execute_with_units(
                        formula_expr,
                        formula_inputs,
                        formula_id=formula_id
                    )
                else:
                    from src.engine.safe_executor import SafeFormulaExecutor
                    safe_exec = SafeFormulaExecutor(self.config.executor_timeout_ms)
                    exec_result = safe_exec.execute(
                        formula_expr,
                        {k: (v.magnitude if isinstance(v, Quantity) else v)
                         for k, v in formula_inputs.items()},
                        formula_id=formula_id
                    )

                formula_duration = (time.time() - formula_start) * 1000

                if not exec_result.is_success():
                    warnings.append(f"Formula {formula_id} failed: {exec_result.error_message}")
                    continue

                # Store result
                output_vars = node.outputs or []
                for output_var in output_vars:
                    variables[output_var] = exec_result.value

                    # Record trace
                    trace = ExecutionTrace(
                        formula_id=formula_id,
                        expression=formula_expr,
                        inputs_used={k: (v.magnitude if isinstance(v, Quantity) else v)
                                   for k, v in formula_inputs.items()},
                        output=exec_result.value,
                        unit=exec_result.unit,
                        duration_ms=formula_duration,
                        status="success"
                    )
                    graph.add_trace(formula_id, trace)
                    self.execution_traces.append(trace)

            # Build final results from output variables
            for var_id, var_def in template.get("variables", {}).items():
                if var_def.get("category") == "output" and var_id in variables:
                    results[var_id] = {
                        "value": (variables[var_id].magnitude
                                 if isinstance(variables[var_id], Quantity)
                                 else variables[var_id]),
                        "unit": (str(variables[var_id].units)
                                if isinstance(variables[var_id], Quantity)
                                else var_def.get("unit"))
                    }

        except Exception as e:
            warnings.append(f"Graph execution error: {str(e)}")

        return CalculationResult(
            template_id=template.get("metadata", {}).get("id", "unknown"),
            status="success" if results else "error",
            results=results,
            warnings=warnings,
            metadata={
                "execution_time_ms": (time.time() - start_time) * 1000,
                "execution_traces": len(self.execution_traces)
            },
        )

    def get_execution_traces(self) -> list[ExecutionTrace]:
        """Get all execution traces from last run."""
        return self.execution_traces.copy()
