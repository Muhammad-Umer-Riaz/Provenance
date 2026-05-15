"""
Compare two field_accuracy result JSONs.

Usage:
    python eval/compare_runs.py <run1.json> <run2.json>

Useful for measuring the impact of prompt changes across the same 15-case test set.
"""

import json
import sys
from pathlib import Path


def load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def delta_str(a: float | None, b: float | None) -> str:
    if a is None or b is None:
        return "n/a"
    d = b - a
    sign = "+" if d >= 0 else ""
    return f"{a:.2f} → {b:.2f}  ({sign}{d:.2f})"


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python eval/compare_runs.py <run1.json> <run2.json>")
        sys.exit(1)

    r1 = load(sys.argv[1])
    r2 = load(sys.argv[2])

    print(f"\nComparing runs:")
    print(f"  A: {sys.argv[1]}  (run_id={r1.get('run_id')})")
    print(f"  B: {sys.argv[2]}  (run_id={r2.get('run_id')})")
    print()

    # Deterministic
    det1 = r1.get("deterministic", {})
    det2 = r2.get("deterministic", {})
    print(f"Deterministic pass rate  : {delta_str(det1.get('pass_rate'), det2.get('pass_rate'))}")
    new_failures = set(
        f"{f['case']}.{f['field']}" for f in det2.get("failures", [])
    ) - set(f"{f['case']}.{f['field']}" for f in det1.get("failures", []))
    fixed = set(
        f"{f['case']}.{f['field']}" for f in det1.get("failures", [])
    ) - set(f"{f['case']}.{f['field']}" for f in det2.get("failures", []))
    if fixed:
        print(f"  Fixed failures  : {', '.join(sorted(fixed))}")
    if new_failures:
        print(f"  New failures    : {', '.join(sorted(new_failures))}")

    # Validation warnings
    warn1 = r1.get("validation_warnings", {})
    warn2 = r2.get("validation_warnings", {})
    if warn1.get("cases_checked") or warn2.get("cases_checked"):
        print(f"Validation warnings rate : {delta_str(warn1.get('pass_rate'), warn2.get('pass_rate'))}")

    # Narrative
    n1 = r1.get("narrative")
    n2 = r2.get("narrative")
    if n1 or n2:
        if not n1 or not n2:
            print("Narrative: one run has --skip-llm; cannot compare narrative scores")
        else:
            print(f"\nNarrative scores:")
            print(f"  Mean groundedness        : {delta_str(n1.get('mean_groundedness'), n2.get('mean_groundedness'))}")
            print(f"  Mean factual consistency : {delta_str(n1.get('mean_factual_consistency'), n2.get('mean_factual_consistency'))}")

            pf1: dict = n1.get("per_field", {})
            pf2: dict = n2.get("per_field", {})
            all_fields = sorted(set(pf1.keys()) | set(pf2.keys()))
            if all_fields:
                print(f"\n  Per-field groundedness delta:")
                deltas = []
                for fid in all_fields:
                    g1 = pf1.get(fid, {}).get("mean_groundedness")
                    g2 = pf2.get(fid, {}).get("mean_groundedness")
                    d = (g2 - g1) if (g1 is not None and g2 is not None) else None
                    deltas.append((fid, g1, g2, d))
                # Sort by delta descending (biggest gain first)
                deltas.sort(key=lambda x: (x[3] is None, -(x[3] or 0)))
                for fid, g1, g2, d in deltas:
                    marker = "  ← biggest gain" if d is not None and d == max(x[3] for x in deltas if x[3] is not None) else ""
                    print(f"    {fid:<30}: {delta_str(g1, g2)}{marker}")

    # Timing
    t1 = r1.get("total_elapsed_s")
    t2 = r2.get("total_elapsed_s")
    if t1 is not None and t2 is not None:
        print(f"\nTotal elapsed            : {delta_str(t1, t2)} s")


if __name__ == "__main__":
    main()
