from typing import Dict, List, Tuple, Any


def validate_variables(
    variables: Dict[str, float],
    definitions: List[Any],
    rules: Dict[str, str]
) -> Tuple[bool, List[str]]:
    """
    Validate input variables against definitions and rules.
    Returns: (is_valid, error_messages)
    """
    errors = []

    # Check required fields
    for definition in definitions:
        if definition.required and definition.name not in variables:
            errors.append(f"Required field missing: {definition.name}")

    # Check value ranges
    for definition in definitions:
        if definition.name in variables:
            value = variables[definition.name]

            if definition.min_value is not None and value < definition.min_value:
                errors.append(
                    f"{definition.name}: value {value} below minimum {definition.min_value}"
                )

            if definition.max_value is not None and value > definition.max_value:
                errors.append(
                    f"{definition.name}: value {value} exceeds maximum {definition.max_value}"
                )

    # Check custom rules
    for var_name, rule in rules.items():
        if var_name in variables:
            # Rule format: "rule_type:params"
            # Example: "positive", "range:0-100"
            is_valid = _evaluate_rule(var_name, variables[var_name], rule)
            if not is_valid:
                errors.append(f"{var_name}: validation rule failed: {rule}")

    return len(errors) == 0, errors


def _evaluate_rule(var_name: str, value: float, rule: str) -> bool:
    """Evaluate single validation rule"""
    if rule == "positive":
        return value > 0
    elif rule == "non_negative":
        return value >= 0
    elif rule.startswith("range:"):
        parts = rule.split(":")[1].split("-")
        try:
            min_val, max_val = float(parts[0]), float(parts[1])
            return min_val <= value <= max_val
        except Exception:
            return False
    return True
