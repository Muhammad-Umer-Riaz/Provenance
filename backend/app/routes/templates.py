from fastapi import APIRouter

from app.templates.loader import get_loaded_templates
from app.templates.schemas import IntakeFieldSchema

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/")
async def list_templates():
    templates = get_loaded_templates()
    return {
        "templates": [
            {
                "template_id": t.template.id,
                "version": t.template.version,
                "name": t.template.name,
                "description": t.template.description,
                "intake": {
                    field_id: _serialize_intake_field(schema)
                    for field_id, schema in t.intake.items()
                },
            }
            for t in templates
        ]
    }


def _serialize_intake_field(schema: IntakeFieldSchema) -> dict:
    return {
        k: v
        for k, v in schema.model_dump().items()
        if v is not None
    }
