"""Render engineering formulas with SymPy integration."""

import logging
import re
from typing import Dict, Any, List, Optional, Tuple

try:
    from sympy import sympify, latex as sympy_latex
    from sympy.parsing.sympy_parser import parse_expr
    HAS_SYMPY = True
except ImportError:
    HAS_SYMPY = False
    logger = logging.getLogger(__name__)
    logger.warning("SymPy not available - formula rendering will be basic")

logger = logging.getLogger(__name__)


class FormulaRenderer:
    """Renders engineering formulas with variable substitution and LaTeX output."""

    def __init__(self, enable_sympy: bool = True):
        """Initialize formula renderer."""
        self.enable_sympy = enable_sympy and HAS_SYMPY

    def render_formula(
        self,
        formula_expr: str,
        variables: Dict[str, Any],
        output_value: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Render formula with full formatting.

        Args:
            formula_expr: Formula expression (e.g., "(P * (D - 2*t)) / (2 * t * E)")
            variables: Variable values (e.g., {"P": 5.0, "D": 100, "t": 5, "E": 1.0})
            output_value: Final output value (optional)

        Returns:
            Dictionary with:
            - formula_latex: LaTeX representation
            - formula_text: Readable text form
            - variable_definitions: Formatted variable list
            - calculation_steps: Step-by-step calculation
            - final_value: Final result
        """

        result = {
            "formula_latex": "",
            "formula_text": str(formula_expr),
            "variable_definitions": "",
            "calculation_steps": [],
            "final_value": output_value,
        }

        if not formula_expr:
            return result

        try:
            # Convert to LaTeX
            if self.enable_sympy:
                result["formula_latex"] = self._expr_to_latex(formula_expr)
            else:
                result["formula_latex"] = formula_expr

            # Format variable definitions
            result["variable_definitions"] = self._format_variable_definitions(
                variables
            )

            # Generate calculation steps
            if output_value is not None:
                result["calculation_steps"] = self._generate_calculation_steps(
                    formula_expr, variables, output_value
                )

        except Exception as e:
            logger.warning(f"Error rendering formula: {e}")
            # Fallback to basic rendering
            result["formula_latex"] = formula_expr
            result["variable_definitions"] = self._format_variable_definitions(
                variables
            )

        return result

    def _expr_to_latex(self, expr_str: str) -> str:
        """Convert expression string to LaTeX format using SymPy."""

        if not self.enable_sympy:
            return expr_str

        try:
            # Parse expression
            expr = sympify(expr_str)
            # Convert to LaTeX
            latex_str = sympy_latex(expr)
            return latex_str
        except Exception as e:
            logger.warning(f"SymPy conversion failed: {e}, returning original")
            return expr_str

    def _format_variable_definitions(
        self,
        variables: Dict[str, Any],
    ) -> str:
        """Format variable definitions for display in report."""

        if not variables:
            return ""

        lines = []
        for var_name, var_data in variables.items():
            if isinstance(var_data, dict):
                value = var_data.get("value", "?")
                unit = var_data.get("unit", "")
                description = var_data.get("description", "")
            else:
                value = var_data
                unit = ""
                description = ""

            # Format: var_name — description (unit) = value
            parts = [f"{var_name}"]
            if description:
                parts.append(f"— {description}")
            if unit:
                parts.append(f"({unit})")
            parts.append(f"= {value}")

            lines.append(" ".join(parts))

        return "\n".join(lines)

    def _generate_calculation_steps(
        self,
        formula_expr: str,
        variables: Dict[str, Any],
        output_value: float,
    ) -> List[str]:
        """Generate step-by-step calculation breakdown."""

        steps = []

        # Step 1: Original formula
        steps.append(f"Formula: {formula_expr}")

        # Step 2: Variable values
        var_list = []
        for var_name, var_data in variables.items():
            if isinstance(var_data, dict):
                value = var_data.get("value")
            else:
                value = var_data
            var_list.append(f"{var_name} = {value}")

        if var_list:
            steps.append("Where: " + ", ".join(var_list))

        # Step 3: Substitution
        substituted = formula_expr
        for var_name, var_data in variables.items():
            if isinstance(var_data, dict):
                value = var_data.get("value")
            else:
                value = var_data
            # Replace variable with its value
            substituted = substituted.replace(var_name, str(value))

        steps.append(f"Substitution: {substituted}")

        # Step 4: Final result
        steps.append(f"Result: {output_value}")

        return steps

    @staticmethod
    def render_variable_substitution(
        formula_expr: str,
        variables: Dict[str, Any],
        output_value: float,
    ) -> str:
        """
        Render variable substitution display.

        Example output:
        σ_h = (P * (D - 2*t)) / (2 * t * E)
             = (5.0 * (100 - 2*5)) / (2 * 5 * 1.0)
             = (5.0 * 90) / 10
             = 45.0 MPa
        """

        lines = [formula_expr]

        # Build substitution line
        substituted = formula_expr
        for var_name, var_data in variables.items():
            if isinstance(var_data, dict):
                value = var_data.get("value")
            else:
                value = var_data
            # Wrap in parentheses for complex expressions
            if isinstance(value, float) and value < 0:
                substituted = substituted.replace(var_name, f"({value})")
            else:
                substituted = substituted.replace(var_name, str(value))

        lines.append(f"   = {substituted}")

        # Add result line
        lines.append(f"   = {output_value}")

        return "\n".join(lines)

    @staticmethod
    def extract_variables_from_formula(formula_expr: str) -> List[str]:
        """Extract all variable names from formula expression."""

        if not formula_expr:
            return []

        # Simple regex to find all identifiers (variable names)
        variables = re.findall(r"\b[a-zA-Z_]\w*\b", formula_expr)

        # Remove duplicates and common words
        common_words = {"sin", "cos", "tan", "sqrt", "log", "exp", "abs", "pi", "e"}
        variables = [v for v in set(variables) if v not in common_words]

        return sorted(variables)

    @staticmethod
    def format_formula_for_docx(
        formula_latex: str,
        is_display: bool = True,
    ) -> str:
        """Format LaTeX formula for DOCX embedding."""

        # For DOCX, we'll convert LaTeX to MathML format (simplified)
        # In real implementation, would use latex2mathml or similar

        # For now, return LaTeX which python-docx can handle
        return formula_latex
