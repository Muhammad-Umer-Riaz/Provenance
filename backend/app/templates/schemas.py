from pydantic import BaseModel
from typing import Any, Optional


class TemplateMeta(BaseModel):
    id: str
    version: str
    name: str
    description: str


class TemplateSchema(BaseModel):
    template: TemplateMeta
    intake: dict[str, Any]
    sections: list[Any]
    lookup_sources: Optional[dict[str, Any]] = None
    validation_rules: Optional[list[Any]] = None
