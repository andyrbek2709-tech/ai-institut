import sympy as sp
from typing import Dict, Any, Tuple
from app.units.converter import unit_converter


class FormulaEvaluator:
    def __init__(self):
        self.cache = {}

    def evaluate(
        self,
        formula: str,
        variables: Dict[str, float],
        output_variables: list = None
    ) -> Tuple[Dict[str, float], Dict[str, Any]]:
        """
        Evaluate formula with given variables.
        Returns: (output_dict, intermediate_results)
        """
        try:
            # Parse formula
            expr = sp.sympify(formula)

            # Substitute variables
            result = float(expr.subs(variables))

            # Prepare output
            outputs = {}
            if output_variables:
                for var in output_variables:
                    outputs[var] = result
            else:
                outputs["result"] = result

            intermediate = {
                "formula_parsed": str(expr),
                "expression_type": type(expr).__name__
            }

            return outputs, intermediate

        except Exception as e:
            raise ValueError(f"Formula evaluation error: {str(e)}")

    def validate_formula(self, formula: str) -> bool:
        """Check if formula is valid"""
        try:
            sp.sympify(formula)
            return True
        except Exception:
            return False


class UnitAwareEvaluator:
    def __init__(self):
        self.evaluator = FormulaEvaluator()
        self.converter = unit_converter

    def evaluate_with_units(
        self,
        formula: str,
        variables: Dict[str, Tuple[float, str]],
        output_unit: str
    ) -> Tuple[float, str]:
        """
        Evaluate formula with unit conversion.
        variables format: {"pressure": (100.0, "MPa"), ...}
        """
        # Extract magnitudes
        magnitudes = {k: v[0] for k, v in variables.items()}

        # Evaluate
        outputs, _ = self.evaluator.evaluate(formula, magnitudes)
        result = list(outputs.values())[0]

        return result, output_unit


evaluator = FormulaEvaluator()
unit_aware_evaluator = UnitAwareEvaluator()
