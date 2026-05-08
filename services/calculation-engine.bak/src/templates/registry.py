"""Template registry - in-memory storage for calculation templates."""
from typing import Optional
from src.schemas import CalcTemplate


class TemplateRegistry:
    """In-memory registry of calculation templates."""

    def __init__(self):
        """Initialize empty registry."""
        self._templates: dict[str, CalcTemplate] = {}
        self._categories: dict[str, list[str]] = {}

    def register(self, template: CalcTemplate) -> None:
        """
        Register a template.

        Args:
            template: CalcTemplate instance
        """
        self._templates[template.id] = template

        # Index by category
        if template.category not in self._categories:
            self._categories[template.category] = []
        self._categories[template.category].append(template.id)

    def get(self, template_id: str) -> Optional[CalcTemplate]:
        """Get template by ID."""
        return self._templates.get(template_id)

    def list_all(self) -> list[CalcTemplate]:
        """Get all templates."""
        return list(self._templates.values())

    def list_by_category(self, category: str) -> list[CalcTemplate]:
        """Get templates in category."""
        template_ids = self._categories.get(category, [])
        return [self._templates[tid] for tid in template_ids]

    def list_categories(self) -> list[str]:
        """Get all category names."""
        return sorted(self._categories.keys())

    def search(self, query: str) -> list[CalcTemplate]:
        """
        Search templates by name or description.

        Args:
            query: Search query string

        Returns:
            Matching templates
        """
        query_lower = query.lower()
        results = []
        for template in self._templates.values():
            if (
                query_lower in template.name.lower()
                or query_lower in template.description.lower()
            ):
                results.append(template)
        return results
