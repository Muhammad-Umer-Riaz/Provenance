from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.database import supabase
from app.templates.loader import get_loaded_templates

router = APIRouter(prefix="/api/reports", tags=["reports"])


# ── Pydantic models ────────────────────────────────────────────────────────────

class ReportCreate(BaseModel):
    template_id: str       # text identifier, e.g. "supplier-qualification-report"
    template_version: str
    intake_data: dict[str, Any]


class ReportResponse(BaseModel):
    id: str
    template_id: str       # text identifier returned to frontend
    template_version: str
    status: str
    intake_data: dict[str, Any]
    created_at: str
    updated_at: str
    score: float | None = None
    verdict: str | None = None
    validation_warnings: list | None = None


class ReportFieldResponse(BaseModel):
    id: str
    report_id: str
    field_id: str
    section_id: str
    strategy: str
    status: str
    value: str | None = None
    metadata: dict[str, Any] = {}
    created_at: str
    updated_at: str


class ReportUpdate(BaseModel):
    intake_data: dict[str, Any]
    status: str | None = None


# ── Auth dependency ────────────────────────────────────────────────────────────

async def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        response = supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    if response.user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return response.user.id


def _lookup_template_uuid(template_text_id: str, version: str) -> str:
    result = (
        supabase.table("templates")
        .select("id")
        .eq("template_id", template_text_id)
        .eq("version", version)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Template '{template_text_id}' v{version} not found in database",
        )
    return result.data["id"]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/", response_model=dict)
async def list_reports(user_id: str = Depends(get_current_user_id)):
    # Join with templates to return the text template_id, not the UUID
    result = (
        supabase.table("reports")
        .select("id, template_version, status, intake_data, created_at, updated_at, score, verdict, template:templates(template_id)")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    rows = []
    for row in (result.data or []):
        rows.append({
            "id": row["id"],
            "template_id": row["template"]["template_id"] if row.get("template") else "",
            "template_version": row["template_version"],
            "status": row["status"],
            "intake_data": row["intake_data"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "score": row.get("score"),
            "verdict": row.get("verdict"),
        })
    return {"reports": rows}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_report(
    body: ReportCreate,
    user_id: str = Depends(get_current_user_id),
):
    try:
        # Validate against loaded templates
        loaded = {t.template.id: t.template.version for t in get_loaded_templates()}
        if body.template_id not in loaded or loaded[body.template_id] != body.template_version:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Template '{body.template_id}' v{body.template_version} not loaded",
            )

        # Resolve UUID FK for the reports table
        template_uuid = _lookup_template_uuid(body.template_id, body.template_version)

        result = (
            supabase.table("reports")
            .insert(
                {
                    "user_id": user_id,
                    "template_id": template_uuid,
                    "template_version": body.template_version,
                    "status": "draft",
                    "intake_data": body.intake_data,
                }
            )
            .execute()
        )
        row = result.data[0]
        return {
            "id": row["id"],
            "template_id": body.template_id,
            "template_version": row["template_version"],
            "status": row["status"],
            "intake_data": row["intake_data"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "score": None,
            "verdict": None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}",
        ) from exc


@router.patch("/{report_id}", response_model=dict)
async def update_report(
    report_id: str,
    body: ReportUpdate,
    user_id: str = Depends(get_current_user_id),
):
    check = (
        supabase.table("reports")
        .select("id, status")
        .eq("id", report_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    patch: dict[str, Any] = {"intake_data": body.intake_data}
    if body.status == "generating":
        patch["status"] = "generating"

    result = (
        supabase.table("reports")
        .update(patch)
        .eq("id", report_id)
        .execute()
    )
    row = result.data[0]
    tpl = (
        supabase.table("templates")
        .select("template_id")
        .eq("id", row["template_id"])
        .single()
        .execute()
    )
    return {
        "id": row["id"],
        "template_id": tpl.data["template_id"],
        "template_version": row["template_version"],
        "status": row["status"],
        "intake_data": row["intake_data"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "score": None,
        "verdict": None,
    }


@router.get("/{report_id}", response_model=dict)
async def get_report(
    report_id: str,
    user_id: str = Depends(get_current_user_id),
):
    result = (
        supabase.table("reports")
        .select("id, template_version, status, intake_data, created_at, updated_at, score, verdict, validation_warnings, template:templates(template_id)")
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
        "template_id": row["template"]["template_id"] if row.get("template") else "",
        "template_version": row["template_version"],
        "status": row["status"],
        "intake_data": row["intake_data"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "score": row.get("score"),
        "verdict": row.get("verdict"),
        "validation_warnings": row.get("validation_warnings", []),
    }


@router.get("/{report_id}/fields", response_model=dict)
async def get_report_fields(
    report_id: str,
    user_id: str = Depends(get_current_user_id),
):
    # Verify ownership via parent report
    check = (
        supabase.table("reports")
        .select("id")
        .eq("id", report_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    result = (
        supabase.table("report_fields")
        .select("*")
        .eq("report_id", report_id)
        .order("field_index")
        .execute()
    )
    return {"fields": result.data or []}


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: str,
    user_id: str = Depends(get_current_user_id),
):
    check = (
        supabase.table("reports")
        .select("id")
        .eq("id", report_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not check.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    supabase.table("reports").delete().eq("id", report_id).execute()
