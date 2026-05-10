import ast
import json
import logging
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from app.audit_log import log_field_event
from app.database import supabase
from app.orchestrator import ReportOrchestrator
from app.routes.reports import get_current_user_id
from app.templates.loader import get_loaded_templates

router = APIRouter(prefix="/api/reports", tags=["fields"])
logger = logging.getLogger(__name__)


# ── Models ────────────────────────────────────────────────────────────────────

class FieldUpdate(BaseModel):
    value: str | None = None
    status: str | None = None   # "approved" | "draft"


# ── Helpers ────────────────────────────────────────────────────────────────────

def _verify_report_ownership(report_id: str, user_id: str) -> dict[str, Any]:
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
    return result.data


def _fetch_field(report_id: str, field_id: str) -> dict[str, Any]:
    result = (
        supabase.table("report_fields")
        .select("*")
        .eq("report_id", report_id)
        .eq("field_id", field_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
    return result.data


def _parse_field_value(value: str | None) -> Any:
    """Reconstruct a Python object from a stored field value string."""
    if value is None:
        return None
    # Try JSON first (new format), then Python repr (old format), then raw string
    try:
        return json.loads(value)
    except (ValueError, json.JSONDecodeError):
        try:
            return ast.literal_eval(value)
        except (ValueError, SyntaxError):
            return value


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.patch("/{report_id}/fields/{field_id}", response_model=dict)
async def update_field(
    report_id: str,
    field_id: str,
    body: FieldUpdate,
    user_id: str = Depends(get_current_user_id),
):
    _verify_report_ownership(report_id, user_id)
    field = _fetch_field(report_id, field_id)

    if body.value is not None:
        # User is editing the value
        patch = {"value": body.value, "status": "edited"}
        supabase.table("report_fields").update(patch).eq("report_id", report_id).eq("field_id", field_id).execute()
        await log_field_event(
            db=supabase,
            report_id=report_id,
            field_id=field_id,
            event_type="edited",
            strategy=field["strategy"],
            inputs_snapshot={"previous_value": field.get("value")},
            output_value=body.value,
        )
    elif body.status is not None:
        if body.status == "approved" and field["status"] in ("failed", "pending"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve a field with status '{field['status']}'",
            )
        supabase.table("report_fields").update({"status": body.status}).eq("report_id", report_id).eq("field_id", field_id).execute()
        if body.status == "approved":
            await log_field_event(
                db=supabase,
                report_id=report_id,
                field_id=field_id,
                event_type="approved",
                strategy=field["strategy"],
                inputs_snapshot={},
                output_value=field.get("value"),
            )
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide value or status")

    updated = _fetch_field(report_id, field_id)
    return updated


@router.post("/{report_id}/fields/{field_id}/regenerate", status_code=status.HTTP_202_ACCEPTED)
async def regenerate_field(
    report_id: str,
    field_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    _verify_report_ownership(report_id, user_id)
    field = _fetch_field(report_id, field_id)

    if field["status"] == "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot regenerate a pending field — run full generation first",
        )

    supabase.table("report_fields").update({"status": "generating"}).eq("report_id", report_id).eq("field_id", field_id).execute()
    background_tasks.add_task(_run_single_field_generation, report_id, field_id, user_id)
    return {"status": "generating", "field_id": field_id}


# ── Background task ────────────────────────────────────────────────────────────

async def _run_single_field_generation(report_id: str, field_id: str, user_id: str) -> None:
    try:
        report_row = _verify_report_ownership(report_id, user_id)
        template_text_id = report_row["template"]["template_id"] if report_row.get("template") else ""
        template_version = report_row["template_version"]
        intake_data = report_row["intake_data"]

        template_key = f"{template_text_id}@{template_version}"
        template = next(
            (t for t in get_loaded_templates() if f"{t.template.id}@{t.template.version}" == template_key),
            None,
        )
        if template is None:
            logger.error("Template %s not loaded — aborting regeneration for field %s", template_key, field_id)
            supabase.table("report_fields").update({"status": "failed"}).eq("report_id", report_id).eq("field_id", field_id).execute()
            return

        # Find the target field and its section in the template
        target_field = None
        target_section = None
        for section in template.sections:
            for f in section.content:
                if f.id == field_id:
                    target_field = f
                    target_section = section
                    break
            if target_field:
                break

        if target_field is None:
            logger.error("Field %s not found in template %s", field_id, template_key)
            supabase.table("report_fields").update({"status": "failed"}).eq("report_id", report_id).eq("field_id", field_id).execute()
            return

        # Reconstruct context from all existing field values in DB
        existing_fields = (
            supabase.table("report_fields")
            .select("field_id, value")
            .eq("report_id", report_id)
            .execute()
        )
        context: dict[str, Any] = {}
        for row in (existing_fields.data or []):
            if row["field_id"] != field_id and row.get("value") is not None:
                context[row["field_id"]] = _parse_field_value(row["value"])

        orchestrator = ReportOrchestrator(template, intake_data, report_id)
        result = await orchestrator.dispatch_single(target_field, context)

        if result is not None:
            value = json.dumps(result) if isinstance(result, (list, dict)) else str(result)
        else:
            value = None
        # Preserve existing field_index so section ordering stays correct
        existing_index = _fetch_field(report_id, field_id).get("field_index", 0)
        supabase.table("report_fields").upsert(
            {
                "report_id": report_id,
                "field_id": field_id,
                "section_id": target_section.id,
                "strategy": target_field.strategy,
                "status": "draft",
                "value": value,
                "original_value": value,
                "field_index": existing_index,
            },
            on_conflict="report_id,field_id",
        ).execute()

        await log_field_event(
            db=supabase,
            report_id=report_id,
            field_id=field_id,
            event_type="regenerated",
            strategy=target_field.strategy,
            inputs_snapshot={"context_keys": list(context.keys())},
            output_value=value,
        )

    except HTTPException:
        supabase.table("report_fields").update({"status": "failed"}).eq("report_id", report_id).eq("field_id", field_id).execute()
    except Exception:
        logger.exception("Single-field regeneration failed for field %s on report %s", field_id, report_id)
        supabase.table("report_fields").update({"status": "failed"}).eq("report_id", report_id).eq("field_id", field_id).execute()
