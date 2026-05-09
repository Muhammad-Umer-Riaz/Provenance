import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.audit_log import log_field_event
from app.database import supabase
from app.orchestrator import ReportOrchestrator
from app.routes.reports import get_current_user_id
from app.templates.loader import get_loaded_templates
from app.templates.schemas import FieldSchema, SectionSchema
from app.validator import run_validation_rules
from app.config import settings

router = APIRouter(prefix="/api/reports", tags=["generation"])
logger = logging.getLogger(__name__)

# Field IDs in the SQR template that map to report-level score and verdict
_SCORE_FIELD_ID = "composite_score"
_VERDICT_FIELD_ID = "qualification_verdict"


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.post("/{report_id}/generate", status_code=status.HTTP_202_ACCEPTED)
async def generate_report(
    report_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    report = _fetch_report(report_id, user_id)

    if report["status"] == "exported":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot regenerate an exported report.",
        )

    if report["status"] == "generating":
        # Only skip if fields are already being processed (task is genuinely running)
        existing = supabase.table("report_fields").select("id", count="exact").eq("report_id", report_id).execute()
        if (existing.count or 0) > 0:
            return {"status": "generating", "report_id": report_id}

    if report["status"] in ("review", "approved"):
        # Clear existing field rows before restarting
        supabase.table("report_fields").delete().eq("report_id", report_id).execute()

    supabase.table("reports").update({"status": "generating"}).eq("id", report_id).execute()

    background_tasks.add_task(_run_generation, report_id, user_id)
    return {"status": "generating", "report_id": report_id}


# ── Background task ────────────────────────────────────────────────────────────

async def _run_generation(report_id: str, user_id: str) -> None:
    try:
        report = _fetch_report(report_id, user_id)
        template_key = f"{report['template_text_id']}@{report['template_version']}"
        template = next(
            (t for t in get_loaded_templates() if f"{t.template.id}@{t.template.version}" == template_key),
            None,
        )
        if template is None:
            logger.error("Template %s not loaded — aborting generation for report %s", template_key, report_id)
            return

        intake_data = report["intake_data"]

        # Pre-insert all fields as pending so the frontend immediately shows the full list
        all_pairs: list[tuple[SectionSchema, FieldSchema]] = [
            (section, field)
            for section in sorted(template.sections, key=lambda s: s.order)
            for field in section.content
        ]
        supabase.table("report_fields").upsert(
            [
                {
                    "report_id": report_id,
                    "field_id": field.id,
                    "section_id": section.id,
                    "strategy": field.strategy,
                    "status": "pending",
                }
                for section, field in all_pairs
            ],
            on_conflict="report_id,field_id",
        ).execute()

        # Callbacks wired into the orchestrator
        async def on_field_start(field: FieldSchema, section: SectionSchema) -> None:
            supabase.table("report_fields").update({"status": "generating"}).eq(
                "report_id", report_id
            ).eq("field_id", field.id).execute()

        async def on_field_complete(
            field: FieldSchema,
            section: SectionSchema,
            result: Any,
            error: Exception | None,
        ) -> None:
            field_status = "failed" if error else "draft"
            value = str(result) if result is not None else None

            supabase.table("report_fields").upsert(
                {
                    "report_id": report_id,
                    "field_id": field.id,
                    "section_id": section.id,
                    "strategy": field.strategy,
                    "status": field_status,
                    "value": value,
                },
                on_conflict="report_id,field_id",
            ).execute()

            model: str | None = None
            if field.strategy == "narrative_llm":
                model = settings.narrative_model
            elif field.strategy == "classifier" and not field.rules:
                model = settings.classifier_model

            await log_field_event(
                db=supabase,
                report_id=report_id,
                field_id=field.id,
                event_type="failed" if error else "generated",
                strategy=field.strategy,
                inputs_snapshot=_build_snapshot(field),
                output_value=value,
                model=model,
            )

        orchestrator = ReportOrchestrator(template, intake_data, report_id)
        context = await orchestrator.generate(
            on_field_start=on_field_start,
            on_field_complete=on_field_complete,
        )

        # Post-generation validation
        validation_results = run_validation_rules(template, context)
        warnings = [r for r in validation_results if not r["passed"]]

        # Extract report-level score and verdict from known field IDs
        raw_score = context.get(_SCORE_FIELD_ID)
        raw_verdict = context.get(_VERDICT_FIELD_ID)
        score: float | None = None
        if raw_score is not None:
            try:
                score = float(raw_score)
            except (TypeError, ValueError):
                pass

        supabase.table("reports").update({
            "status": "review",
            "score": score,
            "verdict": str(raw_verdict) if raw_verdict is not None else None,
            "validation_warnings": warnings,
        }).eq("id", report_id).execute()

    except Exception:
        logger.exception("Generation task failed for report %s", report_id)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fetch_report(report_id: str, user_id: str) -> dict[str, Any]:
    result = (
        supabase.table("reports")
        .select("id, status, intake_data, template_version, template:templates(template_id)")
        .eq("id", report_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    row = result.data
    return {
        "id": row["id"],
        "status": row["status"],
        "intake_data": row["intake_data"],
        "template_version": row["template_version"],
        "template_text_id": row["template"]["template_id"] if row.get("template") else "",
    }


def _build_snapshot(field: FieldSchema) -> dict[str, Any]:
    """Lightweight inputs_snapshot for audit_log — strategy config, not full intake_data."""
    strategy = field.strategy
    if strategy == "lookup":
        return {"source": field.source}
    if strategy == "extractor":
        if field.source:
            return {
                "source": field.source,
                "computed_columns": [c.name for c in (field.computed_columns or [])],
            }
        return {"fields": field.fields or []}
    if strategy == "calculator":
        return {"expression": field.expression}
    if strategy == "template_fill":
        return {"template": field.template}
    if strategy == "classifier":
        if field.rules:
            return {"input": field.input, "rules_count": len(field.rules)}
        return {"input": field.input, "model": settings.classifier_model}
    if strategy == "narrative_llm":
        prompt = (field.prompt or "")[:500]
        return {"prompt_template": prompt, "model": settings.narrative_model}
    if strategy == "direct_input":
        return {"field_id": field.id}
    return {}
