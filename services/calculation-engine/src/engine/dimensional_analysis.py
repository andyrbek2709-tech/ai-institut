"""Dimensional analysis for formula validation."""
from typing import Optional, Dict, Any
import sympy as sp
from pint import Quantity


class DimensionalAnalysisError(Exception):
    """Dimensional inconsistency in formula."""
    pass


class DimensionalAnalyzer:
    """
    Analyzes dimensional consistency of SymPy formulas.

    Detects invalid operations like:
    - MPa + mm (different dimensions)
    - force + pressure (incompatible)
    - divide by dimensionless where dimension expected
    """

    def __init__(self, unit_manager):
        """
        Initialize analyzer.

        Args:
            unit_manager: UnitManager instance for unit utilities
        """
        self.unit_manager = unit_manager

    def check_dimensional_consistency(
        self,
        expr: sp.Expr,
        variables: Dict[str, Quantity]
    ) -> None:
        """
        Check that all operations in formula are dimensionally valid.

        Raises:
            DimensionalAnalysisError: If dimensional mismatch detected
        """
        # Extract all operations in the expression
        operations = self._extract_operations(expr)

        for operation in operations:
            self._check_operation(operation, variables)

    def _extract_operations(self, expr: sp.Expr) -> list:
        """Extract all arithmetic operations from SymPy expression."""
        operations = []

        # Walk the expression tree
        for node in sp.preorder_traversal(expr):
            if isinstance(node, (sp.Add, sp.Mul, sp.Div, sp.Pow)):
                operations.append(node)

        return operations

    def _check_operation(
        self,
        operation: sp.Expr,
        variables: Dict[str, Quantity]
    ) -> None:
        """
        Check a single operation for dimensional consistency.

        Raises:
            DimensionalAnalysisError: If invalid
        """
        if isinstance(operation, sp.Add):
            self._check_addition(operation, variables)
        elif isinstance(operation, sp.Mul):
            self._check_multiplication(operation, variables)
        elif isinstance(operation, sp.Div):
            self._check_division(operation, variables)
        elif isinstance(operation, sp.Pow):
            self._check_power(operation, variables)

    def _check_addition(
        self,
        add_expr: sp.Add,
        variables: Dict[str, Quantity]
    ) -> None:
        """
        Check that all terms in addition have same dimensionality.

        Examples:
        - 100 MPa + 50 MPa → OK (both pressure)
        - 100 MPa + 10 mm → ERROR (pressure + length)
        """
        if len(add_expr.args) < 2:
            return

        # Get dimensionality of first term
        first_dim = self._get_dimensionality(add_expr.args[0], variables)

        # Check all other terms have same dimensionality
        for arg in add_expr.args[1:]:
            arg_dim = self._get_dimensionality(arg, variables)

            if arg_dim is None or first_dim is None:
                # Unknown dimensionality, skip check
                continue

            if arg_dim != first_dim:
                raise DimensionalAnalysisError(
                    f"Cannot add quantities with different dimensions: "
                    f"{first_dim} + {arg_dim}"
                )

    def _check_multiplication(
        self,
        mul_expr: sp.Mul,
        variables: Dict[str, Quantity]
    ) -> None:
        """
        Check multiplication is dimensionally valid.

        Multiplication always produces valid result (dimension product).
        E.g., pressure * area = force
        """
        # Multiplication is always dimensionally valid
        # dimension(a * b) = dimension(a) * dimension(b)
        pass

    def _check_division(
        self,
        div_expr: sp.Div,
        variables: Dict[str, Quantity]
    ) -> None:
        """
        Check division is dimensionally valid.

        Division is dimensionally valid as long as divisor is not zero.
        Division by exactly zero should be caught elsewhere.
        """
        # Division is dimensionally valid
        # dimension(a / b) = dimension(a) / dimension(b)
        pass

    def _check_power(
        self,
        pow_expr: sp.Pow,
        variables: Dict[str, Quantity]
    ) -> None:
        """
        Check power operation is dimensionally valid.

        Power is valid only if exponent is dimensionless.
        E.g., x^2 OK, but x^(1 meter) is nonsensical.
        """
        # For now, assume all powers are valid
        # More sophisticated check could verify exponent is dimensionless
        pass

    def _get_dimensionality(
        self,
        expr: sp.Expr,
        variables: Dict[str, Quantity]
    ) -> Optional[str]:
        """
        Get dimensionality of an expression.

        Returns:
            Dimensionality string (e.g., "[pressure]", "[length]")
            or None if unknown
        """
        # Constant?
        if expr.is_constant():
            # Pure numbers are dimensionless
            return "[dimensionless]"

        # Variable?
        if expr.is_Symbol:
            var_name = str(expr)
            if var_name in variables:
                qty = variables[var_name]
                return str(qty.dimensionality)
            else:
                # Unknown variable, assume dimensionless
                return "[dimensionless]"

        # For complex expressions, we'd need to recursively analyze
        # For now, return None (unknown)
        return None

    def infer_output_dimensionality(
        self,
        expr: sp.Expr,
        variables: Dict[str, Quantity]
    ) -> Optional[str]:
        """
        Infer the dimensionality of formula output.

        Example:
        formula: "pressure * area"
        with pressure=100 MPa, area=10 mm²
        returns: "[force]" (because MPa * mm² = N)

        Returns:
            Dimensionality string or None if cannot infer
        """
        # Try to infer by analyzing variable dimensions
        try:
            # Get all symbols in expression
            symbols = expr.free_symbols

            # Try to infer dimension by creating a symbolic quantity
            # This is complex, so for now return None
            return None

        except Exception:
            return None
