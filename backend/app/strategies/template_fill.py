from typing import Any

from langsmith import traceable

from app.strategies.utils import interpolate
from app.templates.schemas import TemplateMeta


@traceable(run_type="tool", name="template_fill")
def execute_template_fill(
    template_str: str,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    report_id: str,
    template_meta: TemplateMeta,
) -> str:
    """Render a template string with {{token}} substitution from context + metadata."""
    ctx: dict[str, Any] = {}
    ctx.update(intake_data)
    ctx.update(context)
    ctx["report_id"] = report_id
    ctx["template"] = {"version": template_meta.version, "id": template_meta.id}
    ctx["intake"] = intake_data
    return interpolate(template_str, ctx)
