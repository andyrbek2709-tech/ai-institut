"""Calculation runner - orchestrates evaluation and validation."""
from typing import Any
from src.schemas import CalcTemplate, CalcInput, CalculationResult
from src.engine.evaluator import Evaluator
from src.engine.validator import Validator
from src.engine.unit_converter import UnitConverter


class Runner:
    """Orchestrates calculation execution."""

    def __init__(self):
        """Initialize runner components."""
        self.evaluator = Evaluator()
        self.validator = Validator()
        self.unit_converter = UnitConverter()

    def run(
        self,
        template: CalcTemplate,
        inputs: list[CalcInput],
    ) -> CalculationResult:
        """
        Execute calculation with given template and inputs.

        Args:
            template: Calculation template
            inputs: List of input values

        Returns:
            CalculationResult with results or errors
        """
        # Convert inputs to dict, normalize units
        input_dict = {}
        warnings = []

        for inp in inputs:
            if inp.unit and inp.unit != "":
                # Try to normalize unit
                result = self.unit_converter.convert(inp.value, inp.unit, inp.unit)
                if not result["success"]:
                    warnings.append(f"Invalid unit {inp.unit} for {inp.name}")
            input_dict[inp.name] = inp.value

        # Validate inputs
        validation = self.validator.validate_inputs(template.variables, input_dict)
        if not validation["valid"]:
            return CalculationResult(
                template_id=template.id,
                status="error",
                results={},
                warnings=validation["warnings"],
                metadata={"validation_errors": validation["errors"]},
            )

        # Evaluate formula
        eval_result = self.evaluator.evaluate(template.formula, input_dict)
        if eval_result["status"] == "error":
            return CalculationResult(
                template_id=template.id,
                status="error",
                results={},
                warnings=warnings,
                metadata={"evaluation_error": eval_result["error"]},
            )

        # Build results
        results = {}
        for output_var in template.outputs:
            if output_var == "result":
                results[output_var] = eval_result["value"]
            else:
                # For future multi-output support
                results[output_var] = None

        return CalculationResult(
            template_id=template.id,
            status="success",
            results=results,
            warnings=warnings,
            metadata={
                "formula": template.formula,
                "inputs": input_dict,
            },
        )
