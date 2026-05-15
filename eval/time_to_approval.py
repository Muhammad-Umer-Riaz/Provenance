"""
Time-to-approval analysis against a real Supabase audit_log.

Usage (from repo root, with backend venv active):
    python eval/time_to_approval.py --report-id <UUID>
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
# Must come before importing app.database (which triggers settings load)
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))

from app.database import supabase  # noqa: E402

RESULTS_DIR = ROOT / "eval" / "results"


def main() -> None:
    parser = argparse.ArgumentParser(description="Time-to-approval analysis from audit log")
    parser.add_argument("--report-id", required=True, metavar="UUID", help="Report UUID to analyse")
    args = parser.parse_args()

    report_id: str = args.report_id
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    rows = (
        supabase.table("audit_log")
        .select("*")
        .eq("report_id", report_id)
        .neq("field_id", "_export")
        .order("created_at")
        .execute()
        .data
    )

    if not rows:
        print(f"No audit_log rows found for report_id={report_id}")
        sys.exit(1)

    per_field: dict[str, dict] = {}
    for row in rows:
        fid = row["field_id"]
        et = row["event_type"]
        if fid not in per_field:
            per_field[fid] = {"generated": 0, "regenerated": 0, "edited": 0, "approved": False}
        if et == "generated":
            per_field[fid]["generated"] += 1
        elif et == "regenerated":
            per_field[fid]["regenerated"] += 1
        elif et == "edited":
            per_field[fid]["edited"] += 1
        elif et == "approved":
            per_field[fid]["approved"] = True

    for d in per_field.values():
        d["total_generations"] = d["generated"] + d["regenerated"]
        d["first_pass"] = d["regenerated"] == 0 and d["edited"] == 0 and d["approved"]

    total_fields = len(per_field)
    approved_fields = sum(1 for d in per_field.values() if d["approved"])
    first_pass_fields = sum(1 for d in per_field.values() if d["first_pass"])
    total_regens = sum(d["regenerated"] for d in per_field.values())
    total_edits = sum(d["edited"] for d in per_field.values())

    first_pass_rate = round(first_pass_fields / approved_fields, 4) if approved_fields else 0.0
    mean_regens = round(total_regens / total_fields, 3) if total_fields else 0.0
    mean_edits = round(total_edits / total_fields, 3) if total_fields else 0.0

    result = {
        "report_id": report_id,
        "run_at": datetime.now().isoformat(),
        "aggregate": {
            "total_fields": total_fields,
            "approved_fields": approved_fields,
            "first_pass_rate": first_pass_rate,
            "mean_regenerations_per_field": mean_regens,
            "mean_edits_per_field": mean_edits,
        },
        "per_field": {
            fid: {
                "total_generations": d["total_generations"],
                "edited": d["edited"],
                "approved": d["approved"],
                "first_pass": d["first_pass"],
            }
            for fid, d in per_field.items()
        },
    }

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = RESULTS_DIR / f"time_to_approval_{report_id[:8]}_{ts}.json"
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(f"Results → {out_path}")
    print(f"  Total fields       : {total_fields}")
    print(f"  Approved fields    : {approved_fields}")
    print(f"  First-pass rate    : {first_pass_rate:.1%}")
    print(f"  Mean regenerations : {mean_regens}")
    print(f"  Mean edits         : {mean_edits}")


if __name__ == "__main__":
    main()
