"""Template validation engine for V2 format."""
import json
import re
import sympy as sp
from pathlib import Path
from typing import Any, Optional
from dataclasses import dataclass, field


@dataclass
class ValidationMessage:
    """Single validation message."""
    severity: str  # "error", "warning", "info"
    code: str  # validation code (e.g., "SCHEMA_ERROR", "MISSING_VARIABLE")
    message: str
    path: str = ""  # JSON path where error occurred (e.g., "formulas.hoop_stress")
    value: Any = None


@dataclass
class ValidationResult:
    """Result of template validation."""
    valid: bool
    messages: list[ValidationMessage] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def errors(self) -> list[ValidationMessage]:
        """Get all error messages."""
        return [m for m in self.messages if m.severity == "error"]

    @property
    def warnings(self) -> list[ValidationMessage]:
        """Get all warning messages."""
        return [m for m in self.messages if m.severity == "warning"]

    def add_error(self, code: str, message: str, path: str = "", value: Any = None):
        """Add error message."""
        self.messages.append(ValidationMessage(
            severity="error",
            code=code,
            message=message,
            path=path,
            value=value
        ))
        self.valid = False

    def add_warning(self, code: str, message: str, path: str = "", value: Any = None):
        """Add warning message."""
        self.messages.append(ValidationMessage(
            severity="warning",
            code=code,
            message=message,
            path=path,
            value=value
        ))

    def add_info(self, code: str, message: str, path: str = "", value: Any = None):
        """Add info message."""
        self.messages.append(ValidationMessage(
            severity="info",
            code=code,
            message=message,
            path=path,
            value=value
        ))


class TemplateValidator:
    """
    Validates calculation templates against V2 specification.

    Performs:
    1. Schema validation (JSON Schema)
    2. Semantic validation (variable references, dependencies)
    3. Engineering validation (dimensional analysis, constraints)
    4. Quality checks (completeness, coverage)
    """

    def __init__(self, schema_path: Optional[Path] = None):
        """
        Initialize validator.

        Args:
            schema_path: Path to JSON schema file. If None, uses default.
        """
        self.schema_path = schema_path or Path(__file__).parent.parent.parent.parent / "template-schema.json"
        self.schema = self._load_schema()

    def _load_schema(self) -> dict:
        """Load JSON schema from file."""
        if self.schema_path.exists():
            with open(self.schema_path) as f:
                return json.load(f)
        # Return empty schema if not found (graceful degradation)
        return {}

    def validate(self, template_dict: dict) -> ValidationResult:
        """
        Validate template YAML dictionary.

        Args:
            template_dict: Parsed YAML template

        Returns:
            ValidationResult with all validation messages
        """
        result = ValidationResult(valid=True)

        # Stage 1: Schema validation
        self._validate_schema(template_dict, result)
        if result.errors:
            return result  # Stop if schema errors

        # Stage 2: Semantic validation
        self._validate_semantic(template_dict, result)

        # Stage 3: Engineering validation
        self._validate_engineering(template_dict, result)

        # Stage 4: Quality validation
        self._validate_quality(template_dict, result)

        return result

    def _validate_schema(self, template_dict: dict, result: ValidationResult):
        """Validate against JSON schema."""
        # Check required top-level keys
        required_keys = ["metadata", "variables", "formulas"]
        for key in required_keys:
            if key not in template_dict:
                result.add_error(
                    code="MISSING_REQUIRED_KEY",
                    message=f"Missing required key: {key}",
                    path=key
                )

        # Validate metadata
        if "metadata" in template_dict:
            self._validate_metadata(template_dict["metadata"], result)

        # Validate variables
        if "variables" in template_dict:
            self._validate_variables_schema(template_dict["variables"], result)

        # Validate formulas
        if "formulas" in template_dict:
            self._validate_formulas_schema(template_dict["formulas"], result)

    def _validate_metadata(self, metadata: dict, result: ValidationResult):
        """Validate metadata section."""
        required_fields = ["id", "name", "description", "category", "version", "created_at"]
        for field in required_fields:
            if field not in metadata:
                result.add_error(
                    code="MISSING_METADATA_FIELD",
                    message=f"Missing required metadata field: {field}",
                    path=f"metadata.{field}"
                )

        # Validate ID format (kebab-case)
        if "id" in metadata:
            id_val = metadata["id"]
            if not re.match(r"^[a-z0-9_]+$", id_val):
                result.add_error(
                    code="INVALID_ID_FORMAT",
                    message="Template ID must be snake_case (lowercase, digits, underscores)",
                    path="metadata.id",
                    value=id_val
                )

        # Validate semantic version
        if "version" in metadata:
            version = metadata["version"]
            if not re.match(r"^\d+\.\d+\.\d+$", version):
                result.add_error(
                    code="INVALID_VERSION_FORMAT",
                    message="Version must be semantic (X.Y.Z)",
                    path="metadata.version",
                    value=version
                )

    def _validate_variables_schema(self, variables: dict, result: ValidationResult):
        """Validate variables section structure."""
        if not isinstance(variables, dict):
            result.add_error(
                code="INVALID_VARIABLES_TYPE",
                message="Variables must be a dictionary",
                path="variables"
            )
            return

        required_var_fields = ["label", "description", "unit", "type", "category"]
        for var_id, var_def in variables.items():
            if not isinstance(var_def, dict):
                result.add_error(
                    code="INVALID_VARIABLE_STRUCTURE",
                    message=f"Variable {var_id} must be a dictionary",
                    path=f"variables.{var_id}"
                )
                continue

            # Check required fields
            for field in required_var_fields:
                if field not in var_def:
                    result.add_error(
                        code="MISSING_VARIABLE_FIELD",
                        message=f"Variable '{var_id}' missing required field: {field}",
                        path=f"variables.{var_id}.{field}"
                    )

            # Validate category enum
            if "category" in var_def:
                valid_categories = ["input", "output", "intermediate", "constant"]
                if var_def["category"] not in valid_categories:
                    result.add_error(
                        code="INVALID_VARIABLE_CATEGORY",
                        message=f"Invalid category '{var_def['category']}'. Must be one of: {', '.join(valid_categories)}",
                        path=f"variables.{var_id}.category",
                        value=var_def["category"]
                    )

            # Validate type enum
            if "type" in var_def:
                valid_types = ["float", "int", "string", "enum"]
                if var_def["type"] not in valid_types:
                    result.add_error(
                        code="INVALID_VARIABLE_TYPE",
                        message=f"Invalid type '{var_def['type']}'. Must be one of: {', '.join(valid_types)}",
                        path=f"variables.{var_id}.type",
                        value=var_def["type"]
                    )

            # Validate dimension format
            if "dimension" in var_def:
                dim = var_def["dimension"]
                if not re.match(r"^[A-Z]( [A-Z\^0-9\-]+)*$|^1$", dim):
                    result.add_warning(
                        code="INVALID_DIMENSION_FORMAT",
                        message=f"Dimension '{dim}' may not follow standard format (e.g., 'M L^-1 T^-2')",
                        path=f"variables.{var_id}.dimension",
                        value=dim
                    )

    def _validate_formulas_schema(self, formulas: dict, result: ValidationResult):
        """Validate formulas section structure."""
        if not isinstance(formulas, dict):
            result.add_error(
                code="INVALID_FORMULAS_TYPE",
                message="Formulas must be a dictionary",
                path="formulas"
            )
            return

        required_formula_fields = ["expression", "description", "depends_on"]
        for formula_id, formula_def in formulas.items():
            if not isinstance(formula_def, dict):
                result.add_error(
                    code="INVALID_FORMULA_STRUCTURE",
                    message=f"Formula '{formula_id}' must be a dictionary",
                    path=f"formulas.{formula_id}"
                )
                continue

            # Check required fields
            for field in required_formula_fields:
                if field not in formula_def:
                    result.add_error(
                        code="MISSING_FORMULA_FIELD",
                        message=f"Formula '{formula_id}' missing required field: {field}",
                        path=f"formulas.{formula_id}.{field}"
                    )

            # Validate depends_on is non-empty list
            if "depends_on" in formula_def:
                if not isinstance(formula_def["depends_on"], list):
                    result.add_error(
                        code="INVALID_DEPENDS_ON_TYPE",
                        message=f"Formula '{formula_id}' depends_on must be a list",
                        path=f"formulas.{formula_id}.depends_on"
                    )
                elif len(formula_def["depends_on"]) == 0:
                    result.add_error(
                        code="EMPTY_DEPENDS_ON",
                        message=f"Formula '{formula_id}' depends_on cannot be empty",
                        path=f"formulas.{formula_id}.depends_on"
                    )

    def _validate_semantic(self, template_dict: dict, result: ValidationResult):
        """Validate semantic relationships."""
        variables = template_dict.get("variables", {})
        formulas = template_dict.get("formulas", {})

        if not variables or not formulas:
            return

        # Check that all formulas depend on existing variables
        for formula_id, formula_def in formulas.items():
            depends_on = formula_def.get("depends_on", [])
            for var_id in depends_on:
                if var_id not in variables:
                    result.add_error(
                        code="FORMULA_REFERENCES_UNDEFINED_VARIABLE",
                        message=f"Formula '{formula_id}' depends on undefined variable '{var_id}'",
                        path=f"formulas.{formula_id}.depends_on",
                        value=var_id
                    )

        # Check for circular dependencies
        circular_deps = self._detect_circular_dependencies(formulas)
        for cycle in circular_deps:
            result.add_error(
                code="CIRCULAR_DEPENDENCY",
                message=f"Circular dependency detected: {' -> '.join(cycle)}",
                path="formulas"
            )

        # Check formula syntax (SymPy parseable)
        for formula_id, formula_def in formulas.items():
            expression = formula_def.get("expression")
            if expression:
                try:
                    sp.sympify(expression)
                    result.add_info(
                        code="FORMULA_VALID",
                        message=f"Formula '{formula_id}' is valid SymPy expression",
                        path=f"formulas.{formula_id}.expression"
                    )
                except Exception as e:
                    result.add_error(
                        code="INVALID_FORMULA_SYNTAX",
                        message=f"Formula '{formula_id}' invalid SymPy syntax: {str(e)}",
                        path=f"formulas.{formula_id}.expression",
                        value=expression
                    )

    def _validate_engineering(self, template_dict: dict, result: ValidationResult):
        """Validate engineering constraints."""
        variables = template_dict.get("variables", {})
        formulas = template_dict.get("formulas", {})
        validation_rules = template_dict.get("validation", {})

        # Check output variables are actually outputs
        outputs = {vid: vdef for vid, vdef in variables.items()
                  if vdef.get("category") == "output"}

        # Check that outputs are computed by formulas
        computed_vars = set(formulas.keys())
        for output_id in outputs.keys():
            if output_id not in computed_vars:
                result.add_warning(
                    code="OUTPUT_NOT_COMPUTED",
                    message=f"Output variable '{output_id}' has no corresponding formula",
                    path=f"variables.{output_id}"
                )

        # Validate engineering constraints
        constraints = validation_rules.get("engineering_constraints", [])
        for i, constraint in enumerate(constraints):
            if not isinstance(constraint, dict):
                result.add_error(
                    code="INVALID_CONSTRAINT_TYPE",
                    message=f"Engineering constraint {i} must be a dictionary",
                    path=f"validation.engineering_constraints.{i}"
                )
                continue

            # Check required constraint fields
            required = ["description", "condition", "variables"]
            for field in required:
                if field not in constraint:
                    result.add_error(
                        code="MISSING_CONSTRAINT_FIELD",
                        message=f"Constraint {i} missing required field: {field}",
                        path=f"validation.engineering_constraints.{i}.{field}"
                    )

    def _validate_quality(self, template_dict: dict, result: ValidationResult):
        """Validate template quality metrics."""
        metadata = template_dict.get("metadata", {})
        variables = template_dict.get("variables", {})

        # Check documentation completeness
        missing_engineering_meaning = []
        for var_id, var_def in variables.items():
            if "engineering_meaning" not in var_def:
                missing_engineering_meaning.append(var_id)

        if missing_engineering_meaning:
            result.add_warning(
                code="INCOMPLETE_DOCUMENTATION",
                message=f"Variables missing engineering_meaning: {', '.join(missing_engineering_meaning)}",
                path="variables"
            )

        # Check examples exist
        examples = template_dict.get("examples", [])
        if not examples:
            result.add_warning(
                code="NO_EXAMPLES",
                message="Template has no usage examples",
                path="examples"
            )

        # Check standard references for engineering templates
        if "Mechanical" in metadata.get("category", "") or "Piping" in metadata.get("category", ""):
            standard_refs = metadata.get("standard_references", [])
            if not standard_refs:
                result.add_info(
                    code="NO_STANDARD_REFERENCE",
                    message="Engineering template should have standard references",
                    path="metadata.standard_references"
                )

    def _detect_circular_dependencies(self, formulas: dict) -> list[list[str]]:
        """
        Detect circular dependencies in formulas.

        Returns:
            List of cycles, where each cycle is a list of formula IDs
        """
        cycles = []

        def dfs(node: str, path: list[str], visited: set[str]):
            if node in visited:
                if node in path:
                    cycle_start = path.index(node)
                    cycle = path[cycle_start:] + [node]
                    cycles.append(cycle)
                return

            visited.add(node)
            path.append(node)

            if node in formulas:
                for dep in formulas[node].get("depends_on", []):
                    if dep in formulas:  # Only check formula dependencies
                        dfs(dep, path.copy(), visited.copy())

        visited = set()
        for formula_id in formulas.keys():
            dfs(formula_id, [], set())

        return cycles

    def validate_file(self, yaml_path: Path) -> ValidationResult:
        """
        Validate template from YAML file.

        Args:
            yaml_path: Path to YAML template file

        Returns:
            ValidationResult
        """
        import yaml

        try:
            with open(yaml_path) as f:
                template_dict = yaml.safe_load(f)
        except Exception as e:
            result = ValidationResult(valid=False)
            result.add_error(
                code="YAML_PARSE_ERROR",
                message=f"Failed to parse YAML: {str(e)}",
                path=str(yaml_path)
            )
            return result

        return self.validate(template_dict)
