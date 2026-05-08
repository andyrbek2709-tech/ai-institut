import yaml
import os
from typing import Dict, List, Optional
from app.schemas.template import Template, TemplateListItem
from pathlib import Path


class TemplateManager:
    def __init__(self, templates_path: str = "templates"):
        self.templates_path = Path(templates_path)
        self.cache = {}

    def load_template(self, template_id: str) -> Template:
        """Load template from YAML file"""
        if template_id in self.cache:
            return self.cache[template_id]

        template_file = self.templates_path / f"{template_id}.yaml"
        if not template_file.exists():
            raise FileNotFoundError(f"Template not found: {template_id}")

        try:
            with open(template_file, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            template = self._parse_template(data)
            self.cache[template_id] = template
            return template
        except Exception as e:
            raise ValueError(f"Failed to load template {template_id}: {str(e)}")

    def list_templates(self) -> List[TemplateListItem]:
        """List all available templates"""
        templates = []
        if not self.templates_path.exists():
            return templates

        for yaml_file in self.templates_path.glob("*.yaml"):
            try:
                template_id = yaml_file.stem
                template = self.load_template(template_id)
                templates.append(TemplateListItem(
                    id=template_id,
                    name=template.metadata.name,
                    description=template.metadata.description,
                    category=template.metadata.category,
                    version=template.metadata.version
                ))
            except Exception:
                continue

        return sorted(templates, key=lambda t: t.category)

    def _parse_template(self, data: Dict) -> Template:
        """Parse YAML template data into Template schema"""
        # Implementation for parsing YAML into Template
        # This is a placeholder - will be enhanced
        return Template(
            metadata=data.get("metadata", {}),
            inputs=data.get("inputs", []),
            outputs=data.get("outputs", []),
            formulas=data.get("formulas", {}),
            validation_rules=data.get("validation_rules", {})
        )


template_manager = TemplateManager()
