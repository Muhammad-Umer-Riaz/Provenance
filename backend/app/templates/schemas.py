from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


class IntakeFieldSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str
    required: bool = True
    label: str
    values: Optional[list[str]] = None
    columns: Optional[list[dict[str, Any]]] = None
    default_rows: Optional[list[dict[str, Any]]] = None
    min_rows: Optional[int] = None
    validation: Optional[dict[str, Any]] = None
    condition: Optional[str] = None


class ClassifierRuleSchema(BaseModel):
    condition: str
    output: str


class ComputedColumnSchema(BaseModel):
    name: str
    expression: str
    label: Optional[str] = None
    format: Optional[str] = None


class SortBySchema(BaseModel):
    field: str
    order: str = "asc"


class FieldSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    type: str
    strategy: str
    label: Optional[str] = None
    expression: Optional[str] = None
    format: Optional[str] = None
    null_value: Optional[Any] = None
    condition: Optional[str] = None
    template: Optional[str] = None
    source: Optional[str] = None
    fields: Optional[list[str]] = None
    prompt: Optional[str] = None
    exemplars: Optional[list[str]] = None
    max_tokens: Optional[int] = None
    input: Optional[str] = None
    rules: Optional[list[ClassifierRuleSchema]] = None
    computed_columns: Optional[list[ComputedColumnSchema]] = None
    sort_by: Optional[SortBySchema] = None
    hint: Optional[str] = None


class SectionSchema(BaseModel):
    id: str
    title: str
    order: int
    content: list[FieldSchema]


class ValidationRuleSchema(BaseModel):
    id: str
    description: str
    check: str
    severity: str = "warning"
    message: Optional[str] = None


class TemplateMeta(BaseModel):
    id: str
    version: str
    name: str
    description: str


class TemplateSchema(BaseModel):
    template: TemplateMeta
    intake: dict[str, IntakeFieldSchema]
    sections: list[SectionSchema]
    sla_thresholds: Optional[dict[str, Any]] = None
    lookup_sources: Optional[dict[str, Any]] = None
    validation_rules: Optional[list[ValidationRuleSchema]] = None
