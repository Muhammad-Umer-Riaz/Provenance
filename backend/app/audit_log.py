import logging
from typing import Any

from supabase import Client

logger = logging.getLogger(__name__)


async def log_field_event(
    db: Client,
    report_id: str,
    field_id: str,
    event_type: str,
    strategy: str,
    inputs_snapshot: dict[str, Any],
    output_value: str | None,
    model: str | None = None,
) -> None:
    """Append one immutable audit event for a field. Never updates — insert only (AD-005)."""
    try:
        db.table("audit_log").insert({
            "report_id": report_id,
            "field_id": field_id,
            "event_type": event_type,
            "strategy": strategy,
            "inputs_snapshot": inputs_snapshot,
            "output_value": output_value,
            "model": model,
        }).execute()
    except Exception:
        logger.exception("audit_log insert failed for field %s on report %s", field_id, report_id)
