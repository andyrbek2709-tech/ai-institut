"""Input validation engine."""
from typing import Any
from src.schemas import CalcVariable, ValidationError as ValidationErrorSchema


class Validator:
    """Validates calculation inputs against variable definitions."""

    def validate_inputs(
        self,
        variables: list[CalcVariable],
        inputs: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Validate inputs against variable definitions.

        Returns:
            {valid: bool, errors: list[ValidationError], warnings: list[str]}
        """
        errors = []
        warnings = []

        required_vars = {v.name for v in variables if v.required}
        provided_vars = set(inputs.keys())

        # Check required fields
        missing = required_vars - provided_vars
        for field in missing:
            errors.append({
                "field": field,
                "error": "Required field missing",
                "value": None,
            })

        # Validate each input
        var_map = {v.name: v for v in variables}

        for name, value in inputs.items():
            if name not in var_map:
                warnings.append(f"Unknown field: {name}")
                continue

            var = var_map[name]
            validation_error = self._validate_value(value, var)
            if validation_error:
                errors.append(validation_error)

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    def _validate_value(self, value: Any, var: CalcVariable) -> dict[str, Any] | None:
        """Validate single value against variable definition."""
        # Type check
        if var.data_type == "float":
            try:
                float(value)
            except (ValueError, TypeError):
                return {
                    "field": var.name,
                    "error": f"Expected float, got {type(value).__name__}",
                    "value": value,
                }
        elif var.data_type == "int":
            try:
                int(value)
            except (ValueError, TypeError):
                return {
                    "field": var.name,
                    "error": f"Expected int, got {type(value).__name__}",
                    "value": value,
                }

        # Range check
        if var.data_type in ("float", "int"):
            num_value = float(value)
            if var.min_value is not None and num_value < var.min_value:
                return {
                    "field": var.name,
                    "error": f"Value {num_value} below minimum {var.min_value}",
                    "value": value,
                }
            if var.max_value is not None and num_value > var.max_value:
                return {
                    "field": var.name,
                    "error": f"Value {num_value} above maximum {var.max_value}",
                    "value": value,
                }

        # Choices check
        if var.choices and value not in var.choices:
            return {
                "field": var.name,
                "error": f"Value must be one of {var.choices}",
                "value": value,
            }

        return None
