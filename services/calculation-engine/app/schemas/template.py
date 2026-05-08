from pydantic import BaseModel
from typing import List, Dict, Optional
from app.schemas.variable import VariableDefinition


class TemplateMetadata(BaseModel):
    name: str
    description: str
    category: str
    version: str
    author: str


class Template(BaseModel):
    metadata: TemplateMetadata
    inputs: List[VariableDefinition]
    outputs: List[VariableDefinition]
    formulas: Dict[str, str]
    validation_rules: Optional[Dict[str, str]] = None


class TemplateListItem(BaseModel):
    id: str
    name: str
    description: str
    category: str
    version: str
