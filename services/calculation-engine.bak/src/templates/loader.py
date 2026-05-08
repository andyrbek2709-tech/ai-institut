"""Template loader for YAML-based templates."""
from pathlib import Path
from typing import Any
import yaml

from src.schemas import CalcTemplate, CalcVariable


class TemplateLoader:
    """Loads calculation templates from YAML files."""

    def __init__(self, template_dir: Path):
        """
        Initialize loader.

        Args:
            template_dir: Directory containing template YAML files
        """
        self.template_dir = template_dir
        self.templates = {}

    def load_template(self, template_id: str, path: Path) -> CalcTemplate:
        """
        Load template from YAML file.

        Args:
            template_id: Unique template ID
            path: Path to YAML file

        Returns:
            CalcTemplate instance
        """
        with open(path) as f:
            data = yaml.safe_load(f)

        # Parse variables
        variables = []
        for var_data in data.get("variables", []):
            variables.append(CalcVariable(**var_data))

        # Create template
        template = CalcTemplate(
            id=template_id,
            name=data["name"],
            category=data["category"],
            description=data["description"],
            variables=variables,
            formula=data["formula"],
            outputs=data.get("outputs", ["result"]),
            normative_reference=data.get("normative_reference", ""),
            tags=data.get("tags", []),
        )

        self.templates[template_id] = template
        return template

    def load_all_templates(self) -> dict[str, CalcTemplate]:
        """Load all templates from directory."""
        templates = {}
        if self.template_dir.exists():
            for yaml_file in self.template_dir.glob("**/*.yaml"):
                template_id = yaml_file.stem
                template = self.load_template(template_id, yaml_file)
                templates[template_id] = template
        return templates

    def get_template(self, template_id: str) -> CalcTemplate | None:
        """Get template by ID."""
        return self.templates.get(template_id)
