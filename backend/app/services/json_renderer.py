import json
from datetime import datetime, timezone
from typing import Any


def generate_json(report: dict, fields: list[dict], audit_trail: list[dict]) -> bytes:
    payload: dict[str, Any] = {
        "export_version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "report": {
            "id": report.get("id"),
            "template_id": report.get("template_id"),
            "template_version": report.get("template_version"),
            "status": report.get("status"),
            "score": report.get("score"),
            "verdict": report.get("verdict"),
            "intake_data": report.get("intake_data"),
            "validation_warnings": report.get("validation_warnings"),
            "created_at": report.get("created_at"),
            "updated_at": report.get("updated_at"),
        },
        "fields": [
            {
                "field_id": f.get("field_id"),
                "section_id": f.get("section_id"),
                "strategy": f.get("strategy"),
                "status": f.get("status"),
                "value": f.get("value"),
                "original_value": f.get("original_value"),
                "field_index": f.get("field_index"),
            }
            for f in sorted(fields, key=lambda x: x.get("field_index", 0))
        ],
        "audit_trail": [
            {
                "field_id": row.get("field_id"),
                "event_type": row.get("event_type"),
                "strategy": row.get("strategy"),
                "inputs_snapshot": row.get("inputs_snapshot"),
                "output_value": row.get("output_value"),
                "model": row.get("model"),
                "created_at": row.get("created_at"),
            }
            for row in audit_trail
            if row.get("field_id") != "_export"
        ],
    }
    return json.dumps(payload, indent=2, default=str).encode("utf-8")
