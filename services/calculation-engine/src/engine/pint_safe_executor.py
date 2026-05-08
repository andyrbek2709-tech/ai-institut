"""Enhanced SafeFormulaExecutor with full Pint unit support."""
import re
import time
import sympy as sp
from typing import Any, Optional, Dict
from dataclasses import dataclass, field
from enum import Enum
from pint import Quantity, UnitRegistry

from .safe_executor import (
    ExecutionStatus, SecurityLevel, ExecutionResult,
    SafeFormulaExecutor, SecurityError, InvalidFormulaError,
    TimeoutError, ExecutionError
)
from .unit_manager import UnitManager, InvalidUnitError
from .dimensional_analysis import DimensionalAnalyzer, DimensionalAnalysisError


class PintAwareSafeFormulaExecutor(SafeFormulaExecutor):
    """
    Enhanced formula executor with full Pint unit integration.

    Extends SafeFormulaExecutor to support unit-aware execution:
    - All inputs become Pint Quantities
    - All intermediate variables preserve units
    - All outputs carry unit information
    - Dimension propagation validated
    - Invalid dimensional math blocked
    """

    def __init__(self, timeout_ms: int = 1000):
        """
        Initialize executor with unit support.

        Args:
            timeout_ms: Execution timeout in milliseconds
        """
        super().__init__(timeout_ms)
        self.unit_manager = UnitManager()
        self.dimensional_analyzer = DimensionalAnalyzer(self.unit_manager)
        self.quantity_cache = {}  # Cache for Quantity objects

    def execute_with_units(
        self,
        formula: str,
        variables: Dict[str, Quantity],
        formula_id: str = "unknown"
    ) -> ExecutionResult:
        """
        Execute formula with unit-aware evaluation.

        Args:
            formula: SymPy-compatible formula string
            variables: Dictionary of {var_name: Quantity}
            formula_id: Formula identifier (for logging)

        Returns:
            ExecutionResult with value as Quantity, unit preserved
        """
        start_time = time.time()

        try:
            # LAYER 1: Input Validation (extended for units)
            self._validate_input(formula)
            self._validate_quantities(variables)

            # LAYER 1.5: Dimensional Analysis
            expr = self._parse_and_check(formula)
            self.dimensional_analyzer.check_dimensional_consistency(expr, variables)

            # LAYER 3: Execute with timeout (Pint-aware)
            result_quantity = self._execute_with_timeout_pint(expr, variables)

            duration_ms = (time.time() - start_time) * 1000
            self.execution_count += 1

            return ExecutionResult(
                status=ExecutionStatus.SUCCESS,
                value=float(result_quantity.magnitude),
                unit=str(result_quantity.units),
                duration_ms=duration_ms,
                formula=formula,
                variables_used={k: float(v.magnitude) for k, v in variables.items()}
            )

        except DimensionalAnalysisError as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.SECURITY_ERROR,
                error_code="DIMENSIONAL_MISMATCH",
                error_message=f"Invalid dimensional math: {str(e)}",
                duration_ms=duration_ms,
                formula=None  # Don't echo formula for security
            )

        except SecurityError as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.SECURITY_ERROR,
                error_code="SECURITY_VIOLATION",
                error_message="Formula evaluation blocked due to security policy",
                duration_ms=duration_ms,
                formula=None
            )

        except TimeoutError as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.TIMEOUT,
                error_code="EXECUTION_TIMEOUT",
                error_message=f"Formula execution exceeded {self.timeout_ms}ms timeout",
                duration_ms=duration_ms
            )

        except InvalidFormulaError as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.INVALID_FORMULA,
                error_code="INVALID_FORMULA",
                error_message="Formula is not valid SymPy expression",
                duration_ms=duration_ms
            )

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ExecutionResult(
                status=ExecutionStatus.EXECUTION_ERROR,
                error_code="EXECUTION_ERROR",
                error_message=f"Formula evaluation failed: {str(e)}",
                duration_ms=duration_ms
            )

    def _validate_quantities(self, variables: Dict[str, Quantity]) -> None:
        """
        Validate that all variables are Pint Quantities.

        Raises:
            SecurityError: If invalid quantity format
        """
        if not variables:
            return

        for var_name, value in variables.items():
            if not isinstance(value, Quantity):
                raise SecurityError(
                    f"Variable '{var_name}' is not a Quantity. "
                    f"Use unit_manager.create_quantity() to create Quantities."
                )

            # Validate that quantity has valid units
            if value.units == "":
                raise SecurityError(f"Variable '{var_name}' has empty units")

    def _execute_with_timeout_pint(
        self,
        expr: sp.Expr,
        variables: Dict[str, Quantity],
        timeout_ms: Optional[int] = None
    ) -> Quantity:
        """
        Execute formula with timeout sandbox, Pint-aware.

        Args:
            expr: Parsed SymPy expression
            variables: Dictionary of {var_name: Quantity}
            timeout_ms: Execution timeout

        Returns:
            Result as Pint Quantity

        Raises:
            TimeoutError: If execution exceeds timeout
            ExecutionError: If execution fails
        """
        import threading

        if timeout_ms is None:
            timeout_ms = self.timeout_ms

        result = [None]
        error = [None]

        def execute_formula():
            try:
                # Substitute Quantity values into expression
                r = expr.subs(variables)

                # Try to convert to float and create Quantity
                if isinstance(r, Quantity):
                    # Already a Quantity (good!)
                    result[0] = r
                elif hasattr(r, 'evalf'):
                    # SymPy numeric evaluation
                    r_float = float(r.evalf())
                    result[0] = Quantity(r_float, "dimensionless")
                else:
                    r_float = float(r)
                    result[0] = Quantity(r_float, "dimensionless")

            except Exception as e:
                error[0] = e

        # Run in thread with timeout
        thread = threading.Thread(target=execute_formula, daemon=True)
        thread.start()
        thread.join(timeout=timeout_ms / 1000.0)

        # Check if thread completed
        if thread.is_alive():
            raise TimeoutError(f"Formula execution exceeded {timeout_ms}ms")

        # Check for execution errors
        if error[0]:
            raise ExecutionError(str(error[0]))

        # Return result
        return result[0]

    def execute_with_unit_strings(
        self,
        formula: str,
        variables_with_units: Dict[str, tuple],  # {var_name: (value, unit_str)}
        formula_id: str = "unknown"
    ) -> ExecutionResult:
        """
        Convenience method: execute with variables as (value, unit) tuples.

        Args:
            formula: SymPy formula string
            variables_with_units: {var_name: (value, unit_str)}
                Example: {"p": (100, "MPa"), "a": (10, "mm**2")}
            formula_id: Formula identifier

        Returns:
            ExecutionResult with unit information
        """
        try:
            # Convert tuples to Quantities
            variables = {}
            for var_name, (value, unit_str) in variables_with_units.items():
                variables[var_name] = self.unit_manager.create_quantity(value, unit_str)

            # Execute with unit support
            return self.execute_with_units(formula, variables, formula_id)

        except InvalidUnitError as e:
            return ExecutionResult(
                status=ExecutionStatus.INVALID_FORMULA,
                error_code="INVALID_UNIT",
                error_message=str(e),
                duration_ms=0.0
            )

    def clear_quantity_cache(self):
        """Clear cached quantities."""
        self.quantity_cache.clear()
        self.clear_cache()  # Also clear parent expression cache

    def get_statistics_extended(self) -> dict:
        """Get extended statistics including units and caching."""
        return {
            **self.get_statistics(),
            "quantity_cache_size": len(self.quantity_cache),
            "unit_registry": str(type(self.unit_manager.ureg))
        }
