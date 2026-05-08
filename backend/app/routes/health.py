from fastapi import APIRouter

from app.templates.loader import get_loaded_templates

router = APIRouter()


@router.get("/")
async def root():
    return {"status": "ok", "version": "0.1.0"}


@router.get("/api/health")
async def health():
    templates = get_loaded_templates()
    return {
        "status": "ok",
        "templates_loaded": len(templates),
        "templates": [
            {
                "id": t.template.id,
                "version": t.template.version,
                "name": t.template.name,
            }
            for t in templates
        ],
    }
