import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from app.audit_log import log_field_event
from app.database import supabase
from app.routes.reports import get_current_user_id
from app.services.docx_renderer import generate_docx
from app.services.json_renderer import generate_json
from app.services.pdf_renderer import generate_pdf

router = APIRouter(prefix="/api/reports", tags=["export"])
logger = logging.getLogger(__name__)


@router.post("/{report_id}/export")
async def export_report(
    report_id: str,
    format: Literal["pdf", "docx", "json"] = "pdf",
    user_id: str = Depends(get_current_user_id),
) -> Response:
    # Ownership check + full report fetch in one query
    report_result = (
        supabase.table("reports")
        .select("*")
        .eq("id", report_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not report_result.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report = report_result.data

    # Fetch fields ordered by field_index
    fields_result = (
        supabase.table("report_fields")
        .select("*")
        .eq("report_id", report_id)
        .order("field_index")
        .execute()
    )
    fields = fields_result.data or []

    # Approval gate — Decision 6: hard backend enforcement
    unapproved = [f["field_id"] for f in fields if f["status"] not in ("approved", "failed")]
    if unapproved:
        listed = ", ".join(unapproved[:5])
        suffix = "…" if len(unapproved) > 5 else ""
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{len(unapproved)} field(s) not yet approved: {listed}{suffix}",
        )

    # Route to renderer
    if format == "pdf":
        content = await generate_pdf(report, fields)
        media_type = "application/pdf"
        filename = f"report-{report_id}.pdf"

    elif format == "docx":
        content = generate_docx(report, fields)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"report-{report_id}.docx"

    else:  # json
        audit_result = (
            supabase.table("audit_log")
            .select("*")
            .eq("report_id", report_id)
            .order("created_at")
            .execute()
        )
        content = generate_json(report, fields, audit_result.data or [])
        media_type = "application/json"
        filename = f"report-{report_id}.json"

    # Append export event to audit log
    await log_field_event(
        db=supabase,
        report_id=report_id,
        field_id="_export",
        event_type="exported",
        strategy="export",
        inputs_snapshot={"format": format},
        output_value=None,
        model=None,
    )

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
