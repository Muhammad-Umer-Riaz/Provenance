"""
Field accuracy eval for the SQR generation engine.

Usage:
    python eval/field_accuracy.py [--skip-llm] [--case CASE_ID]

Prerequisites:
    - backend venv must be active
    - OPENROUTER_API_KEY must be set in backend/.env
"""

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, patch

from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / "backend" / ".env")
sys.path.insert(0, str(ROOT / "backend"))

import yaml

from app.orchestrator import ReportOrchestrator
from app.templates.schemas import TemplateSchema
from app.validator import run_validation_rules

TEMPLATE_PATH = ROOT / "templates" / "supplier-qualification-report.yaml"
TEST_SET_PATH = ROOT / "eval" / "test_sets" / "sqr_cases.json"
RESULTS_DIR = ROOT / "eval" / "results"

NARRATIVE_FIELD_IDS = [
    "scorecard_summary",
    "performance_narrative",
    "risk_narrative",
    "car_summary",
    "executive_summary",
    "recommendation",
]

GROUNDEDNESS_THRESHOLD = 3.5


def load_template() -> TemplateSchema:
    return TemplateSchema(**yaml.safe_load(TEMPLATE_PATH.read_text(encoding="utf-8")))


def load_cases(case_filter: str | None) -> list[dict]:
    cases = json.loads(TEST_SET_PATH.read_text(encoding="utf-8"))
    if case_filter:
        cases = [c for c in cases if c["id"] == case_filter]
        if not cases:
            print(f"ERROR: case '{case_filter}' not found in test set")
            sys.exit(1)
    return cases


async def run_case(
    template: TemplateSchema,
    case: dict,
    skip_llm: bool,
) -> dict:
    intake = case["intake"]
    if skip_llm:
        with patch(
            "app.orchestrator.execute_narrative_llm",
            new=AsyncMock(return_value="[mock narrative]"),
        ):
            ctx = await ReportOrchestrator(template, intake, case["id"]).generate()
    else:
        ctx = await ReportOrchestrator(template, intake, case["id"]).generate()
    return ctx


def check_deterministic(ctx: dict, expected: dict) -> list[dict]:
    failures = []
    for field_id, expected_val in expected.items():
        actual = ctx.get(field_id)
        if isinstance(expected_val, float):
            passed = actual is not None and abs(float(actual) - expected_val) < 0.001
        else:
            passed = actual == expected_val
        if not passed:
            failures.append({
                "field": field_id,
                "expected": expected_val,
                "actual": actual,
            })
    return failures


def check_warnings(
    template: TemplateSchema,
    ctx: dict,
    expected_warnings: list[str] | None,
) -> dict | None:
    if expected_warnings is None:
        return None
    results = run_validation_rules(template, ctx)
    fired_ids = {r["id"] for r in results if not r["passed"]}
    expected_ids = set(expected_warnings)
    if fired_ids == expected_ids:
        return {"passed": True, "fired": sorted(fired_ids), "expected": sorted(expected_ids)}
    return {
        "passed": False,
        "fired": sorted(fired_ids),
        "expected": sorted(expected_ids),
        "unexpected": sorted(fired_ids - expected_ids),
        "missing": sorted(expected_ids - fired_ids),
    }


def _judge_field_context(field_id: str, intake: dict, ctx: dict) -> str:
    """Return a field-specific input summary for the judge, including row-level tables where relevant."""
    base = (
        f"Supplier: {intake.get('supplier_name')}, "
        f"Score: {ctx.get('composite_score')}, "
        f"Verdict: {ctx.get('qualification_verdict')}\n"
        f"Risk tier: {ctx.get('overall_risk_tier')}, "
        f"SLA breaches: {ctx.get('breach_count')}"
    )
    if field_id == "scorecard_summary":
        rows = intake.get("audit_scores", [])
        table = "\n".join(
            f"  {r.get('criterion')}: score {r.get('score')}/5, weight {r.get('weight')}, "
            f"weighted {round(r.get('score', 0) * r.get('weight', 0), 2)}"
            for r in rows
        )
        return f"{base}\nAudit scorecard:\n{table}"
    if field_id == "risk_narrative":
        rows = intake.get("risk_register", [])
        table = "\n".join(
            f"  [{r.get('risk_category')}] {r.get('risk_item')} "
            f"(L{r.get('likelihood')}×I{r.get('impact')}=P{r.get('likelihood',0)*r.get('impact',0)}): "
            f"{r.get('mitigation', '')}"
            for r in rows
        )
        return f"{base}\nRisk register:\n{table}"
    if field_id == "car_summary":
        rows = intake.get("corrective_actions", [])
        table = "\n".join(
            f"  {r.get('car_id')}: {r.get('action_item')} (owner: {r.get('owner')}, "
            f"due: {r.get('due_date')}, status: {r.get('status')})"
            for r in rows
        )
        return f"{base}\nCorrective actions:\n{table}"
    return base


def call_llm_judge(
    field_id: str,
    intake: dict,
    ctx: dict,
) -> dict:
    import os
    import httpx

    api_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not api_key:
        return {"groundedness": 0, "factual_consistency": 0, "reason": "OPENROUTER_API_KEY not set"}

    field_text = ctx.get(field_id) or ""
    field_context = _judge_field_context(field_id, intake, ctx)
    prompt = (
        f"You are evaluating a generated field in a Supplier Qualification Report.\n\n"
        f"Field: {field_id}\n"
        f"{field_context}\n"
        f"Generated text: {field_text}\n\n"
        f"Score 1–5 on:\n"
        f"- groundedness: every claim traces to the provided inputs above\n"
        f"- factual_consistency: text aligns with computed values (score, verdict, SLA statuses)\n\n"
        f'Respond with JSON only: {{"groundedness": int, "factual_consistency": int, "reason": str}}'
    )

    try:
        response = httpx.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "anthropic/claude-haiku-4-5",
                "messages": [{"role": "user", "content": prompt}],
                "response_format": {"type": "json_object"},
                "max_tokens": 200,
                "temperature": 0,
            },
            timeout=30,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
            content = content.strip()
        return json.loads(content)
    except Exception as e:
        return {"groundedness": 0, "factual_consistency": 0, "reason": f"Judge error: {e}"}


def main() -> None:
    parser = argparse.ArgumentParser(description="SQR field accuracy eval")
    parser.add_argument("--skip-llm", action="store_true", help="Mock all narrative_llm calls")
    parser.add_argument("--case", metavar="CASE_ID", help="Run a single case by ID")
    args = parser.parse_args()

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    template = load_template()
    cases = load_cases(args.case)
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    det_failures: list[dict] = []
    det_total = 0
    warn_failures: list[dict] = []
    warn_total = 0
    narrative_scores: dict[str, list[dict]] = {fid: [] for fid in NARRATIVE_FIELD_IDS}
    per_case_timing: dict[str, float] = {}

    print(f"\nEval run {run_id}  |  {len(cases)} case(s)  |  skip_llm={args.skip_llm}\n")

    for case in cases:
        case_id = case["id"]
        intake = case["intake"]
        expected = case.get("expected", {})
        expected_warnings = case.get("expected_warnings")

        print(f"  {case_id} ...", end="", flush=True)
        t0 = time.perf_counter()
        ctx = asyncio.run(run_case(template, case, args.skip_llm))
        elapsed = round(time.perf_counter() - t0, 2)
        per_case_timing[case_id] = elapsed

        # Deterministic check
        failures = check_deterministic(ctx, expected)
        det_total += len(expected)
        det_failures.extend([{"case": case_id, **f} for f in failures])

        # Validation warnings check
        warn_result = check_warnings(template, ctx, expected_warnings)
        if warn_result is not None:
            warn_total += 1
            if not warn_result["passed"]:
                warn_failures.append({"case": case_id, **warn_result})

        # LLM judge
        if not args.skip_llm:
            for fid in NARRATIVE_FIELD_IDS:
                if fid == "car_summary" and len(intake.get("corrective_actions", [])) == 0:
                    continue
                if ctx.get(fid):
                    scores = call_llm_judge(fid, intake, ctx)
                    narrative_scores[fid].append(scores)

        status = "PASS" if not failures else f"FAIL({len(failures)})"
        print(f" {status}  [{elapsed}s]")

    # Aggregate results
    det_pass_count = det_total - len(det_failures)
    det_pass_rate = round(det_pass_count / det_total, 4) if det_total else 0.0

    warn_pass_count = warn_total - len(warn_failures)
    warn_pass_rate = round(warn_pass_count / warn_total, 4) if warn_total else None

    narrative_result: dict = {}
    threshold_passed = True

    if not args.skip_llm:
        per_field: dict[str, dict] = {}
        all_groundedness: list[float] = []
        all_factual: list[float] = []

        for fid, scores_list in narrative_scores.items():
            if not scores_list:
                continue
            g_vals = [s["groundedness"] for s in scores_list if isinstance(s.get("groundedness"), (int, float))]
            f_vals = [s["factual_consistency"] for s in scores_list if isinstance(s.get("factual_consistency"), (int, float))]
            if g_vals:
                mean_g = round(sum(g_vals) / len(g_vals), 2)
                mean_f = round(sum(f_vals) / len(f_vals), 2) if f_vals else None
                per_field[fid] = {"mean_groundedness": mean_g, "mean_factual_consistency": mean_f}
                all_groundedness.extend(g_vals)
                all_factual.extend(f_vals)

        mean_groundedness = round(sum(all_groundedness) / len(all_groundedness), 2) if all_groundedness else None
        mean_factual = round(sum(all_factual) / len(all_factual), 2) if all_factual else None

        if mean_groundedness is not None and mean_groundedness < GROUNDEDNESS_THRESHOLD:
            threshold_passed = False

        narrative_result = {
            "threshold": GROUNDEDNESS_THRESHOLD,
            "passed_threshold": threshold_passed,
            "mean_groundedness": mean_groundedness,
            "mean_factual_consistency": mean_factual,
            "per_field": per_field,
        }

    result = {
        "run_id": run_id,
        "template_version": template.template.version,
        "skip_llm": args.skip_llm,
        "cases_run": len(cases),
        "total_elapsed_s": round(sum(per_case_timing.values()), 2),
        "deterministic": {
            "pass_rate": det_pass_rate,
            "failures": det_failures,
        },
        "validation_warnings": {
            "cases_checked": warn_total,
            "pass_rate": warn_pass_rate,
            "failures": warn_failures,
        },
        **({"narrative": narrative_result} if not args.skip_llm else {}),
        "per_case_timing_s": per_case_timing,
    }

    out_path = RESULTS_DIR / f"field_accuracy_{run_id}.json"
    out_path.write_text(json.dumps(result, indent=2, default=str), encoding="utf-8")

    print(f"\nResults -> {out_path}")
    print(f"  Deterministic pass rate : {det_pass_rate:.1%}  ({det_pass_count}/{det_total} fields)")
    if warn_total:
        print(f"  Validation warnings     : {warn_pass_rate:.1%}  ({warn_pass_count}/{warn_total} cases)")
    if not args.skip_llm and narrative_result:
        g = narrative_result.get("mean_groundedness")
        print(f"  Mean groundedness       : {g}  (threshold {GROUNDEDNESS_THRESHOLD})")
        print(f"  Threshold passed        : {threshold_passed}")

    if det_failures:
        print("\nDeterministic failures:")
        for f in det_failures:
            print(f"  {f['case']}.{f['field']}: expected={f['expected']!r}  actual={f['actual']!r}")

    if det_pass_rate < 0.90:
        print(f"\nFAIL: deterministic pass rate {det_pass_rate:.1%} < 90% minimum")
        sys.exit(1)

    if not args.skip_llm and not threshold_passed:
        g = narrative_result.get("mean_groundedness")
        print(f"\nFAIL: mean groundedness {g} < {GROUNDEDNESS_THRESHOLD} threshold")
        sys.exit(1)

    print("\nPASS")


if __name__ == "__main__":
    main()
