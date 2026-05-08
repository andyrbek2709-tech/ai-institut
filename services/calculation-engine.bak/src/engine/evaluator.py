"""Formula evaluator using SymPy."""
from typing import Any
import sympy as sp


class Evaluator:
    """Evaluates mathematical formulas with variable substitution."""

    def __init__(self):
        """Initialize evaluator."""
        self.cache: dict[str, Any] = {}

    def evaluate(self, formula: str, variables: dict[str, float]) -> dict[str, Any]:
        """
        Evaluate formula with given variables.

        Args:
            formula: SymPy-compatible formula string
            variables: Dictionary of {var_name: value}

        Returns:
            Result dictionary with 'value', 'formula', 'variables'
        """
        try:
            expr = sp.sympify(formula)
            result = expr.subs(variables)
            result = float(result)

            return {
                "value": result,
                "formula": formula,
                "variables": variables,
                "status": "success",
            }
        except Exception as e:
            return {
                "value": None,
                "formula": formula,
                "variables": variables,
                "status": "error",
                "error": str(e),
            }

    def validate_formula(self, formula: str) -> dict[str, Any]:
        """
        Validate formula syntax without evaluation.

        Returns:
            {valid: bool, variables: list[str], error: str|None}
        """
        try:
            expr = sp.sympify(formula)
            variables = list(expr.free_symbols)
            return {
                "valid": True,
                "variables": [str(v) for v in variables],
                "error": None,
            }
        except Exception as e:
            return {
                "valid": False,
                "variables": [],
                "error": str(e),
            }
