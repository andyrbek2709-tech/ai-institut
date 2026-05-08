import time
from typing import Dict, Any, List
from app.engine.evaluator import evaluator
from app.schemas.variable import CalculationResult
from app.validators.validation import validate_variables


class CalculationRunner:
    def __init__(self):
        self.evaluator = evaluator

    def run_calculation(
        self,
        formula: str,
        variables: Dict[str, float],
        input_definitions: List[Any],
        output_definitions: List[Any],
        validation_rules: Dict[str, str] = None
    ) -> CalculationResult:
        """Execute calculation with full validation"""
        start_time = time.time()
        warnings = []

        # Validate inputs
        is_valid, validation_errors = validate_variables(
            variables,
            input_definitions,
            validation_rules or {}
        )
        if not is_valid:
            warnings.extend(validation_errors)

        # Evaluate formula
        try:
            outputs, intermediate = self.evaluator.evaluate(
                formula,
                variables,
                [v.name for v in output_definitions]
            )
        except Exception as e:
            raise ValueError(f"Calculation failed: {str(e)}")

        execution_time = (time.time() - start_time) * 1000  # ms

        return CalculationResult(
            output_variables=outputs,
            intermediate_results=intermediate,
            warnings=warnings,
            execution_time_ms=execution_time
        )


runner = CalculationRunner()
