"""
End-to-end orchestrator smoke test.

Runs the full ReportOrchestrator against the SQR template with a known intake
fixture and asserts all deterministic field values. Narrative LLM fields are
mocked to return placeholder text — set OPENROUTER_API_KEY and remove the mock
to test live LLM output.
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.orchestrator import ReportOrchestrator


async def test_orchestrator_deterministic_fields(sqr_template, sample_intake):
    # Mock narrative_llm so the test runs without an API key
    with patch(
        "app.orchestrator.execute_narrative_llm",
        new=AsyncMock(return_value="[generated narrative]"),
    ):
        orch = ReportOrchestrator(sqr_template, sample_intake, "test-001")
        ctx = await orch.generate()

    # ── Section 1 ────────────────────────────────────────────────────────────
    assert "issue_date" in ctx
    assert ctx["issue_date"]  # non-empty date string
    assert ctx["qualification_scope"].startswith("This qualification covers")

    # ── Section 2 ────────────────────────────────────────────────────────────
    # 0.25×4 + 0.25×3 + 0.20×4 + 0.15×5 + 0.10×3 + 0.05×4 = 3.80
    assert abs(ctx["composite_score"] - 3.80) < 0.001
    assert ctx["qualification_verdict"] == "Conditional"   # 3.80 >= 3.5, < 4.0
    assert ctx["lowest_criterion_name"] == "Sustainability & compliance"
    # points_to_next_tier = round(4.0 - 3.80, 2) = 0.20
    assert abs(ctx["points_to_next_tier"] - 0.20) < 0.001
    # points_above_floor = round(3.80 - 3.5, 2) = 0.30
    assert abs(ctx["points_above_floor"] - 0.30) < 0.001

    # ── Section 3 ────────────────────────────────────────────────────────────
    assert ctx["otd_effective_pass"] == 90          # None or 90
    assert ctx["otd_sla_status"] == "Watch"         # 88.5 >= 85 but < 90
    assert ctx["defect_sla_status"] == "Pass"       # 1.2 <= 1.5
    assert ctx["invoice_sla_status"] == "Pass"      # 96.0 >= 95
    assert ctx["ncr_count_sla_status"] == "Watch"   # 3 > 2, <= 4
    assert ctx["ncr_close_sla_status"] == "Watch"   # 18 <= 21 (not Breach)
    assert ctx["otd_trend"] == "improving"          # 88.5 > 85.0 prev
    assert ctx["defect_trend"] == "improving"       # 1.2 < 2.0 prev (lower = better)
    assert ctx["invoice_trend"] == "improving"      # 96.0 > 94.0 prev

    # ── Section 4 ────────────────────────────────────────────────────────────
    # max(4×5=20, 3×3=9) = 20 >= 15 → High
    assert ctx["overall_risk_tier"] == "High"
    assert ctx["second_risk_item"] == "Currency exposure EUR/USD"
    assert ctx["second_risk_priority"] == 9         # 3 × 3

    # ── Section 5 ────────────────────────────────────────────────────────────
    assert ctx["overdue_car_count"] == 0
    # approval_conditions renders because verdict != 'Preferred'
    assert "Conditional approval" in ctx["approval_conditions"]

    # ── Section 6 ────────────────────────────────────────────────────────────
    assert ctx["breach_count"] == 0                 # no Breach statuses in this fixture
    assert "next_review_date" in ctx                # Conditional → today + 6 months
    assert ctx["executive_summary"] == "[generated narrative]"
