import logging
from pathlib import Path

import yaml

from app.config import settings
from app.database import supabase
from app.templates.schemas import TemplateSchema

logger = logging.getLogger(__name__)

_templates: dict[str, TemplateSchema] = {}


def load_templates() -> None:
    templates_dir = Path(settings.templates_dir)
    if not templates_dir.exists():
        raise RuntimeError(f"Templates directory not found: {templates_dir.resolve()}")

    yaml_files = list(templates_dir.glob("*.yaml"))
    if not yaml_files:
        raise RuntimeError(f"No templates found in {templates_dir.resolve()}")

    for yaml_file in yaml_files:
        content = yaml_file.read_text(encoding="utf-8")
        try:
            raw = yaml.safe_load(content)
            template = TemplateSchema(**raw)
        except Exception as e:
            raise RuntimeError(f"Failed to load template {yaml_file.name}: {e}") from e

        key = f"{template.template.id}@{template.template.version}"
        _templates[key] = template

        supabase.table("templates").upsert(
            {
                "template_id": template.template.id,
                "version": template.template.version,
                "name": template.template.name,
                "description": template.template.description,
                "yaml_content": content,
            },
            on_conflict="template_id,version",
        ).execute()

        logger.info("Loaded template: %s v%s", template.template.id, template.template.version)

    logger.info("Templates loaded: %d", len(_templates))


def get_loaded_templates() -> list[TemplateSchema]:
    return list(_templates.values())
