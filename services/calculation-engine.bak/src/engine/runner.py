"""Calculation runner - orchestrates evaluation with unit-aware execution and semantic validation."""
import time
import logging
from typing import Any, Optional, Dict
from dataclasses import dataclass
from enum import Enum

from src.schemas import CalcTemplate, CalcInput, CalculationResult
from src.engine.execution_graph import FormulaExecutionGraph, ExecutionPlan, ExecutionTrace
from src.engine.pint_safe_executor import PintAwareSafeFormulaExecutor
from src.engine.unit_manager import UnitManager, InvalidUnitError
from src.engine.validation_framework import (
    EngineeringValidationEngine,
    ValidationRule,
    RangeCheckRule,
    PhysicalPlausibilityRule,
    SafetyFactorRule,
    EngineeringConstraintRule,
    SeverityLevel,
)
from src.engine.semantic_metadata import SemanticMetadataRegistry, FormulaSemanticsMetadata
from src.engine.explainability import ExplainabilityEngine
from src.engine.audit_trail import AuditLogger, AuditEventType
from src.engine.failure_analysis import FailureAnalyzer
from pint import Quantity

logger = logging.getLogger(__name__)


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
    enable_semantic_validation: bool = True
    enable_audit_trail: bool = True
    enable_explainability: bool = True
    enable_failure_analysis: bool = True


class Runner:
    """
    Unit-aware calculation runner with integrated semantic validation.

    Execution pipeline:
    - Input semantic validation
    - Formula execution (single or DAG-based)
    - Output semantic validation
    - Explainability generation
    - Audit trail capture
    - Failure analysis

    Execution modes:
    - SINGLE_FORMULA: Legacy single-formula template (backward compatible)
    - GRAPH_BASED: New multi-formula DAG execution with unit propagation
    """

    def __init__(self, config: Optional[RunnerConfig] = None):
        """Initialize runner with semantic validation systems."""
        self.config = config or RunnerConfig()
        self.executor = PintAwareSafeFormulaExecutor(self.config.executor_timeout_ms)
        self.unit_manager = UnitManager()
        self.execution_traces = []

        # Semantic systems (initialized once for entire runner lifecycle)
        if self.config.enable_semantic_validation:
            self.semantic_registry = SemanticMetadataRegistry()
            self.validation_engine = EngineeringValidationEngine()
        else:
            self.semantic_registry = None
            self.validation_engine = None

        if self.config.enable_explainability:
            self.explainability_engine = ExplainabilityEngine()
        else:
            self.explainability_engine = None

        if self.config.enable_audit_trail:
            self.audit_logger = AuditLogger()
        else:
            self.audit_logger = None

        if self.config.enable_failure_analysis:
            self.failure_analyzer = FailureAnalyzer()
        else:
            self.failure_analyzer = None

    def run(
        self,
        template: CalcTemplate,
        inputs: list[CalcInput],
    ) -> CalculationResult:
        """
        Execute calculation with full semantic pipeline.

        Pipeline:
        1. Input semantic validation
        2. Formula execution (single or DAG)
        3. Output semantic validation
        4. Explainability generation
        5. Audit trail capture
        6. Failure analysis (automatic for failures)

        Args:
            template: Calculation template
            inputs: List of input values

        Returns:
            CalculationResult with results, validation, explanations, audit trail
        """
        start_time = time.time()

        # Start audit trail
        if self.audit_logger:
            self.audit_logger.new_calculation(template_id=template.id)

        # Determine execution mode
        mode = self._determine_execution_mode(template)

        try:
            if mode == ExecutionMode.SINGLE_FORMULA:
                return self._execute_single_formula(template, inputs, start_time)
            else:
                return self._execute_with_graph(template, inputs, start_time)
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Execution error in {template.id}: {error_msg}")

            if self.audit_logger:
                self.audit_logger.log_error(
                    event_type=AuditEventType.ERROR_OCCURRED,
                    message=error_msg
                )

            return CalculationResult(
                template_id=template.id,
                status="error",
                results={},
                warnings=[],
                metadata={"error": error_msg},
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
        """Execute single-formula template with semantic validation."""
        warnings = []
        validation_results = []
        explanations = {}
        audit_trail_data = None
        failure_analysis = None

        # Build input variables as Quantities if unit tracking enabled
        variables = {}
        input_dict = {}

        # Log input capture
        if self.audit_logger:
            self.audit_logger.log_input_captured(
                inputs={inp.name: {"value": inp.value, "unit": inp.unit} for inp in inputs}
            )

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

        # INPUT SEMANTIC VALIDATION
        if self.config.enable_semantic_validation and self.validation_engine:
            input_validation_results = self._validate_inputs(
                template, inputs, variables
            )
            validation_results.extend(input_validation_results)

            # Log validation
            if self.audit_logger:
                for result in input_validation_results:
                    self.audit_logger.log_validation_result(result)

        # Get formula string
        formula = template.formula if hasattr(template, 'formula') else ""

        # Execute with unit-aware executor
        if variables and any(isinstance(v, Quantity) for v in variables.values()):
            exec_result = self.executor.execute_with_units(
                formula,
                variables,
                formula_id=template.id
            )
        else:
            from src.engine.safe_executor import SafeFormulaExecutor
            safe_exec = SafeFormulaExecutor(self.config.executor_timeout_ms)
            exec_result = safe_exec.execute(
                formula,
                input_dict,
                formula_id=template.id
            )

        # Log formula execution
        if self.audit_logger:
            self.audit_logger.log_formula_execution(
                formula_id=template.id,
                expression=formula,
                inputs=input_dict,
                output=exec_result.value,
                duration_ms=exec_result.duration_ms
            )

        if not exec_result.is_success():
            if self.audit_logger:
                self.audit_logger.log_error(
                    event_type=AuditEventType.FORMULA_EXECUTION_FAILED,
                    message=exec_result.error_message
                )

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

        # OUTPUT SEMANTIC VALIDATION
        if self.config.enable_semantic_validation and self.validation_engine:
            output_validation_results = self._validate_outputs(
                template, results, variables
            )
            validation_results.extend(output_validation_results)

            # Log validation
            if self.audit_logger:
                for result in output_validation_results:
                    self.audit_logger.log_validation_result(result)

            # FAILURE ANALYSIS
            if self.config.enable_failure_analysis and self.failure_analyzer:
                failed_validations = [r for r in output_validation_results if r.status == "failed"]
                if failed_validations:
                    failure_analysis = self._analyze_failures(
                        template, failed_validations, exec_result
                    )

                    if self.audit_logger:
                        self.audit_logger.log_failure_detected(
                            failure_analysis=failure_analysis
                        )

        # EXPLAINABILITY GENERATION
        if self.config.enable_explainability and self.explainability_engine:
            explanations = self._generate_explanations(
                template,
                formula,
                input_dict,
                exec_result,
                validation_results,
                failure_analysis
            )

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

        # Finalize audit trail
        if self.audit_logger:
            self.audit_logger.log_completion(
                status="success" if not failure_analysis else "warning"
            )
            audit_trail_data = self.audit_logger.get_trail()

        # Determine overall status
        failed_validations = [r for r in validation_results if r.status == "failed"]
        overall_status = "error" if failed_validations else "success"

        return CalculationResult(
            template_id=template.id,
            status=overall_status,
            results=results,
            warnings=warnings,
            validation_notes=[],  # Extended in ÉTAP 2.9
            # NEW: Semantic information
            validation_results=validation_results if self.config.enable_semantic_validation else [],
            explanations=explanations if self.config.enable_explainability else None,
            audit_trail=audit_trail_data,
            failure_analysis=failure_analysis,
            metadata={
                "formula": formula,
                "inputs": input_dict,
                "execution_time_ms": (time.time() - start_time) * 1000,
                "execution_traces": [1],
                "semantic_validation_enabled": self.config.enable_semantic_validation,
                "audit_trail_enabled": self.config.enable_audit_trail,
            },
        )

    def _execute_with_graph(
        self,
        template: Dict[str, Any],
        inputs: list[CalcInput],
        start_time: float
    ) -> CalculationResult:
        """Execute multi-formula template with DAG execution and semantic validation."""
        warnings = []
        validation_results = []
        explanations = {}
        audit_trail_data = None
        failure_analysis = None
        metadata = {}
        results = {}

        try:
            # Log input capture
            if self.audit_logger:
                self.audit_logger.log_input_captured(
                    inputs={inp.name: {"value": inp.value, "unit": inp.unit} for inp in inputs}
                )

            # Build execution graph
            graph = FormulaExecutionGraph(template)

            # Check executability
            plan = graph.plan_execution()
            if not plan.is_executable:
                if self.audit_logger:
                    self.audit_logger.log_error(
                        event_type=AuditEventType.ERROR_OCCURRED,
                        message="Graph has circular dependencies"
                    )

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

            # INPUT SEMANTIC VALIDATION (for all input variables)
            if self.config.enable_semantic_validation and self.validation_engine:
                # Validate each input variable
                for var_id, value in variables.items():
                    var_def = template.get("variables", {}).get(var_id, {})
                    if var_def.get("category") == "input":
                        # Get semantic metadata
                        semantics = self.semantic_registry.get_semantics(var_id) if self.semantic_registry else None

                        # Apply range checks if defined
                        if var_def.get("min_value") is not None:
                            val = value.magnitude if isinstance(value, Quantity) else value
                            if val < var_def["min_value"]:
                                result = self._create_validation_result(
                                    rule_id=f"range_{var_id}_min",
                                    rule_name=f"Minimum value for {var_id}",
                                    output_name=var_id,
                                    status="failed",
                                    severity=SeverityLevel.WARNING,
                                    message=f"Value {val} below minimum {var_def['min_value']}"
                                )
                                validation_results.append(result)
                                if self.audit_logger:
                                    self.audit_logger.log_validation_result(result)

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

                # Log formula execution
                if self.audit_logger:
                    self.audit_logger.log_formula_execution(
                        formula_id=formula_id,
                        expression=formula_expr,
                        inputs={k: (v.magnitude if isinstance(v, Quantity) else v)
                               for k, v in formula_inputs.items()},
                        output=exec_result.value,
                        duration_ms=formula_duration
                    )

                if not exec_result.is_success():
                    warnings.append(f"Formula {formula_id} failed: {exec_result.error_message}")
                    if self.audit_logger:
                        self.audit_logger.log_error(
                            event_type=AuditEventType.FORMULA_EXECUTION_FAILED,
                            message=f"Formula {formula_id}: {exec_result.error_message}"
                        )
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

            # OUTPUT SEMANTIC VALIDATION
            if self.config.enable_semantic_validation and self.validation_engine:
                for var_id, value in results.items():
                    var_def = template.get("variables", {}).get(var_id, {})

                    # Apply range checks if defined
                    if var_def.get("max_value") is not None:
                        if value["value"] > var_def["max_value"]:
                            result = self._create_validation_result(
                                rule_id=f"range_{var_id}_max",
                                rule_name=f"Maximum value for {var_id}",
                                output_name=var_id,
                                status="failed",
                                severity=SeverityLevel.WARNING,
                                message=f"Value {value['value']} exceeds maximum {var_def['max_value']}"
                            )
                            validation_results.append(result)
                            if self.audit_logger:
                                self.audit_logger.log_validation_result(result)

            # Finalize audit trail
            if self.audit_logger:
                failed_validations = [r for r in validation_results if r.status == "failed"]
                self.audit_logger.log_completion(
                    status="success" if not failed_validations else "warning"
                )
                audit_trail_data = self.audit_logger.get_trail()

        except Exception as e:
            warnings.append(f"Graph execution error: {str(e)}")
            logger.error(f"Graph execution error: {str(e)}")
            if self.audit_logger:
                self.audit_logger.log_error(
                    event_type=AuditEventType.ERROR_OCCURRED,
                    message=str(e)
                )

        # Determine overall status
        failed_validations = [r for r in validation_results if r.status == "failed"]
        overall_status = "success" if results and not failed_validations else ("error" if not results else "warning")

        return CalculationResult(
            template_id=template.get("metadata", {}).get("id", "unknown"),
            status=overall_status,
            results=results,
            warnings=warnings,
            validation_notes=[],
            # NEW: Semantic information
            validation_results=validation_results if self.config.enable_semantic_validation else [],
            explanations=explanations if self.config.enable_explainability else None,
            audit_trail=audit_trail_data,
            failure_analysis=failure_analysis,
            metadata={
                "execution_time_ms": (time.time() - start_time) * 1000,
                "execution_traces": len(self.execution_traces),
                "semantic_validation_enabled": self.config.enable_semantic_validation,
                "audit_trail_enabled": self.config.enable_audit_trail,
            },
        )

    def _validate_inputs(self, template, inputs, variables):
        """Apply input-level semantic validation."""
        results = []
        if not self.validation_engine:
            return results

        for inp in inputs:
            # Lookup semantic metadata
            semantics = self.semantic_registry.get_semantics(inp.name) if self.semantic_registry else None

            # Find variable definition
            var_def = None
            if hasattr(template, 'variables'):
                for v in template.variables:
                    if v.name == inp.name:
                        var_def = v
                        break

            # Apply range checks
            if var_def and hasattr(var_def, 'min_value') and var_def.min_value is not None:
                if inp.value < var_def.min_value:
                    result = self._create_validation_result(
                        rule_id=f"range_{inp.name}_min",
                        rule_name=f"Minimum value for {inp.name}",
                        output_name=inp.name,
                        status="failed",
                        severity=SeverityLevel.WARNING,
                        message=f"Value {inp.value} below minimum {var_def.min_value}"
                    )
                    results.append(result)

        return results

    def _validate_outputs(self, template, results, variables):
        """Apply output-level semantic validation."""
        validation_results = []
        if not self.validation_engine:
            return validation_results

        for output_var, output_data in results.items():
            if output_data is None:
                continue

            value = output_data.get("value")

            # Find variable definition
            var_def = None
            if hasattr(template, 'variables'):
                for v in template.variables:
                    if v.name == output_var:
                        var_def = v
                        break

            # Apply range checks
            if var_def and hasattr(var_def, 'max_value') and var_def.max_value is not None:
                if value > var_def.max_value:
                    result = self._create_validation_result(
                        rule_id=f"range_{output_var}_max",
                        rule_name=f"Maximum value for {output_var}",
                        output_name=output_var,
                        status="failed",
                        severity=SeverityLevel.ERROR,
                        message=f"Value {value} exceeds maximum {var_def.max_value}"
                    )
                    validation_results.append(result)

            # Check for physical plausibility (negative when it shouldn't be)
            if var_def and hasattr(var_def, 'min_value') and var_def.min_value == 0:
                if value < 0:
                    result = self._create_validation_result(
                        rule_id=f"physical_{output_var}_negative",
                        rule_name=f"Physical plausibility for {output_var}",
                        output_name=output_var,
                        status="failed",
                        severity=SeverityLevel.FAILURE,
                        message=f"Value {value} is negative but should be non-negative"
                    )
                    validation_results.append(result)

        return validation_results

    def _analyze_failures(self, template, failed_validations, exec_result):
        """Analyze failures and generate root cause analysis."""
        if not self.failure_analyzer:
            return None

        analysis = {
            "failures": [],
            "summary": f"{len(failed_validations)} validation failures detected"
        }

        for failure in failed_validations:
            analysis_obj = self.failure_analyzer.analyze_failure(
                failure_message=failure.message,
                actual_value=str(failure.actual_value),
                expected=failure.expected_condition or "unknown",
                context={"rule_id": failure.rule_id, "severity": failure.severity.value}
            )
            analysis["failures"].append({
                "rule": failure.rule_name,
                "message": failure.message,
                "category": analysis_obj.category.value if analysis_obj else "unknown",
                "root_causes": analysis_obj.probable_causes if analysis_obj else [],
                "mitigations": analysis_obj.mitigations if analysis_obj else []
            })

        return analysis

    def _generate_explanations(self, template, formula, inputs, exec_result, validation_results, failure_analysis):
        """Generate human-readable explanations."""
        if not self.explainability_engine:
            return {}

        explanations = {
            "execution": {
                "formula": formula,
                "inputs": inputs,
                "output": exec_result.value,
                "unit": exec_result.unit,
                "duration_ms": exec_result.duration_ms,
                "description": f"Calculated {template.id} from {len(inputs)} inputs"
            },
            "validations": []
        }

        for result in validation_results:
            explanations["validations"].append({
                "rule": result.rule_name,
                "status": result.status,
                "message": result.message,
                "engineering_notes": result.engineering_notes
            })

        if failure_analysis:
            explanations["failures"] = failure_analysis

        return explanations

    def _create_validation_result(self, rule_id, rule_name, output_name, status, severity, message):
        """Create a ValidationResult object."""
        from src.engine.validation_framework import ValidationResult
        return ValidationResult(
            rule_id=rule_id,
            rule_name=rule_name,
            output_name=output_name,
            status=status,
            severity=severity,
            message=message,
            engineering_notes="",
            actual_value=None,
            expected_condition=None,
            probable_causes=[],
            mitigations=[]
        )

    def get_execution_traces(self) -> list[ExecutionTrace]:
        """Get all execution traces from last run."""
        return self.execution_traces.copy()
