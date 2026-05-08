"""Dependency injection container."""
from pathlib import Path
from src.templates import TemplateRegistry, TemplateLoader
from src.engine import Runner

_template_registry: TemplateRegistry | None = None
_runner: Runner | None = None


def initialize_container(template_dir: Path = Path("src/templates/data")):
    """Initialize dependency container."""
    global _template_registry, _runner

    # Initialize template registry
    _template_registry = TemplateRegistry()

    # Load templates from YAML
    loader = TemplateLoader(template_dir)
    templates = loader.load_all_templates()
    for template in templates.values():
        _template_registry.register(template)

    # Initialize runner
    _runner = Runner()


def get_template_registry() -> TemplateRegistry:
    """Get template registry instance."""
    global _template_registry
    if _template_registry is None:
        initialize_container()
    return _template_registry


def get_runner() -> Runner:
    """Get runner instance."""
    global _runner
    if _runner is None:
        initialize_container()
    return _runner
