"""Tests for template validator."""
import pytest
from pathlib import Path

from src.templates.validator import TemplateValidator, ValidationResult


@pytest.fixture
def validator():
    """Create validator instance."""
    return TemplateValidator()


@pytest.fixture
def valid_template():
    """Valid V2 template."""
    return {
        "metadata": {
            "id": "test_template",
            "name": "Test Template",
            "description": "A simple test template",
            "category": "Test",
            "version": "1.0.0",
            "created_at": "2026-05-08T00:00:00Z"
        },
        "variables": {
            "input_a": {
                "label": "Input A",
                "description": "First input variable",
                "unit": "mm",
                "type": "float",
                "category": "input",
                "engineering_meaning": "The first measurement"
            },
            "output_c": {
                "label": "Output C",
                "description": "Result variable",
                "unit": "mm^2",
                "type": "float",
                "category": "output",
                "engineering_meaning": "The calculated result"
            }
        },
        "formulas": {
            "output_c": {
                "expression": "input_a ** 2",
                "description": "Square the input",
                "depends_on": ["input_a"]
            }
        }
    }


class TestSchemaValidation:
    """Test schema validation."""

    def test_valid_template(self, validator, valid_template):
        """Test validation of valid template."""
        result = validator.validate(valid_template)
        assert result.valid
        assert len(result.errors) == 0

    def test_missing_required_keys(self, validator):
        """Test missing required top-level keys."""
        template = {"metadata": {}}
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "MISSING_REQUIRED_KEY" for m in result.errors)

    def test_missing_metadata_fields(self, validator, valid_template):
        """Test missing metadata fields."""
        template = valid_template.copy()
        template["metadata"] = {"id": "test"}
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "MISSING_METADATA_FIELD" for m in result.errors)

    def test_invalid_id_format(self, validator, valid_template):
        """Test invalid template ID format."""
        template = valid_template.copy()
        template["metadata"]["id"] = "Invalid-ID"
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "INVALID_ID_FORMAT" for m in result.errors)

    def test_invalid_version_format(self, validator, valid_template):
        """Test invalid version format."""
        template = valid_template.copy()
        template["metadata"]["version"] = "1.0"
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "INVALID_VERSION_FORMAT" for m in result.errors)

    def test_invalid_variable_category(self, validator, valid_template):
        """Test invalid variable category."""
        template = valid_template.copy()
        template["variables"]["input_a"]["category"] = "invalid"
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "INVALID_VARIABLE_CATEGORY" for m in result.errors)

    def test_invalid_variable_type(self, validator, valid_template):
        """Test invalid variable type."""
        template = valid_template.copy()
        template["variables"]["input_a"]["type"] = "invalid"
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "INVALID_VARIABLE_TYPE" for m in result.errors)

    def test_missing_variable_required_fields(self, validator, valid_template):
        """Test missing required variable fields."""
        template = valid_template.copy()
        template["variables"]["input_a"] = {"label": "Input"}
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "MISSING_VARIABLE_FIELD" for m in result.errors)

    def test_missing_formula_required_fields(self, validator, valid_template):
        """Test missing required formula fields."""
        template = valid_template.copy()
        template["formulas"]["output_c"] = {"expression": "x + y"}
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "MISSING_FORMULA_FIELD" for m in result.errors)

    def test_empty_depends_on(self, validator, valid_template):
        """Test empty depends_on list."""
        template = valid_template.copy()
        template["formulas"]["output_c"]["depends_on"] = []
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "EMPTY_DEPENDS_ON" for m in result.errors)


class TestSemanticValidation:
    """Test semantic validation."""

    def test_formula_references_undefined_variable(self, validator, valid_template):
        """Test formula referencing undefined variable."""
        template = valid_template.copy()
        template["formulas"]["output_c"]["depends_on"] = ["undefined_var"]
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "FORMULA_REFERENCES_UNDEFINED_VARIABLE" for m in result.errors)

    def test_invalid_formula_syntax(self, validator, valid_template):
        """Test invalid SymPy formula syntax."""
        template = valid_template.copy()
        template["formulas"]["output_c"]["expression"] = "input_a ** )"
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "INVALID_FORMULA_SYNTAX" for m in result.errors)

    def test_valid_formula_syntax(self, validator, valid_template):
        """Test valid SymPy formula syntax."""
        result = validator.validate(valid_template)
        assert result.valid
        assert any(m.code == "FORMULA_VALID" for m in result.messages)

    def test_circular_dependency_self_reference(self, validator, valid_template):
        """Test self-referencing formula (circular dependency)."""
        template = valid_template.copy()
        template["formulas"]["output_c"]["depends_on"] = ["output_c"]
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "CIRCULAR_DEPENDENCY" for m in result.errors)

    def test_circular_dependency_chain(self, validator):
        """Test circular dependency in formula chain."""
        template = {
            "metadata": {
                "id": "circular_test",
                "name": "Circular Test",
                "description": "Test circular dependencies",
                "category": "Test",
                "version": "1.0.0",
                "created_at": "2026-05-08T00:00:00Z"
            },
            "variables": {
                "a": {"label": "A", "description": "A", "unit": "1", "type": "float", "category": "input"},
                "b": {"label": "B", "description": "B", "unit": "1", "type": "float", "category": "intermediate"},
                "c": {"label": "C", "description": "C", "unit": "1", "type": "float", "category": "intermediate"},
            },
            "formulas": {
                "b": {
                    "expression": "c + 1",
                    "description": "B depends on C",
                    "depends_on": ["c"]
                },
                "c": {
                    "expression": "b + 1",
                    "description": "C depends on B",
                    "depends_on": ["b"]
                }
            }
        }
        result = validator.validate(template)
        assert not result.valid
        assert any(m.code == "CIRCULAR_DEPENDENCY" for m in result.errors)


class TestEngineeringValidation:
    """Test engineering constraints validation."""

    def test_output_not_computed(self, validator, valid_template):
        """Test warning for output variable with no formula."""
        template = valid_template.copy()
        template["variables"]["output_d"] = {
            "label": "Output D",
            "description": "Not computed",
            "unit": "1",
            "type": "float",
            "category": "output",
            "engineering_meaning": "Not computed"
        }
        result = validator.validate(template)
        assert any(m.code == "OUTPUT_NOT_COMPUTED" for m in result.warnings)

    def test_missing_engineering_meaning_warning(self, validator, valid_template):
        """Test warning for missing engineering_meaning."""
        template = valid_template.copy()
        del template["variables"]["input_a"]["engineering_meaning"]
        result = validator.validate(template)
        assert any(m.code == "INCOMPLETE_DOCUMENTATION" for m in result.warnings)

    def test_no_examples_warning(self, validator, valid_template):
        """Test warning when no examples provided."""
        result = validator.validate(valid_template)
        assert any(m.code == "NO_EXAMPLES" for m in result.warnings)

    def test_no_standard_reference_info(self, validator, valid_template):
        """Test info message for engineering template without standard reference."""
        template = valid_template.copy()
        template["metadata"]["category"] = "Mechanical/Piping"
        result = validator.validate(template)
        assert any(m.code == "NO_STANDARD_REFERENCE" for m in result.messages)


class TestCircularDependencyDetection:
    """Test circular dependency detection algorithm."""

    def test_no_circular_dependencies(self, validator, valid_template):
        """Test detection with no circular dependencies."""
        formulas = valid_template["formulas"]
        cycles = validator._detect_circular_dependencies(formulas)
        assert len(cycles) == 0

    def test_self_cycle_detection(self, validator):
        """Test detection of self-referencing cycle."""
        formulas = {
            "a": {"depends_on": ["a"]}
        }
        cycles = validator._detect_circular_dependencies(formulas)
        assert len(cycles) > 0
        assert cycles[0] == ["a", "a"]

    def test_two_node_cycle_detection(self, validator):
        """Test detection of two-node cycle."""
        formulas = {
            "a": {"depends_on": ["b"]},
            "b": {"depends_on": ["a"]}
        }
        cycles = validator._detect_circular_dependencies(formulas)
        assert len(cycles) > 0

    def test_three_node_cycle_detection(self, validator):
        """Test detection of three-node cycle."""
        formulas = {
            "a": {"depends_on": ["b"]},
            "b": {"depends_on": ["c"]},
            "c": {"depends_on": ["a"]}
        }
        cycles = validator._detect_circular_dependencies(formulas)
        assert len(cycles) > 0


class TestMessageAccumulation:
    """Test validation message accumulation."""

    def test_multiple_errors_collected(self, validator):
        """Test that all errors are collected, not just first."""
        template = {
            "metadata": {"id": "Invalid-ID"},
            "variables": {},
            "formulas": {}
        }
        result = validator.validate(template)
        assert len(result.errors) > 1

    def test_errors_and_warnings_separated(self, validator, valid_template):
        """Test that errors and warnings are separated."""
        template = valid_template.copy()
        del template["variables"]["input_a"]["engineering_meaning"]
        result = validator.validate(template)
        assert len(result.errors) == 0
        assert len(result.warnings) > 0


class TestValidationResult:
    """Test ValidationResult class."""

    def test_result_valid_by_default(self):
        """Test that result starts as valid."""
        result = ValidationResult(valid=True)
        assert result.valid

    def test_result_becomes_invalid_on_error(self):
        """Test that adding error makes result invalid."""
        result = ValidationResult(valid=True)
        result.add_error("TEST", "Test error")
        assert not result.valid

    def test_errors_property(self):
        """Test errors property filter."""
        result = ValidationResult(valid=False)
        result.add_error("E1", "Error 1")
        result.add_warning("W1", "Warning 1")
        assert len(result.errors) == 1
        assert len(result.warnings) == 1

    def test_message_properties(self):
        """Test that messages maintain properties."""
        result = ValidationResult(valid=True)
        result.add_error("CODE", "Message text", path="path.to.field", value="bad_value")
        msg = result.errors[0]
        assert msg.code == "CODE"
        assert msg.message == "Message text"
        assert msg.path == "path.to.field"
        assert msg.value == "bad_value"
        assert msg.severity == "error"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
