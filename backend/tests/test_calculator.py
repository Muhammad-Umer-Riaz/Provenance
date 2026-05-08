import datetime

import pytest
from dateutil.relativedelta import relativedelta

from app.strategies.calculator import evaluate_expression, preprocess, _convert_js_ternary


SLA = {"otd_rate_pct": {"pass": 90, "watch": 85}}
EMPTY = {}


# ── Pre-processor ──────────────────────────────────────────────────────────────

def test_preprocess_js_ternary_single():
    result = _convert_js_ternary("x > 1 ? 'yes' : 'no'")
    assert result == "('yes') if (x > 1) else ('no')"


def test_preprocess_js_ternary_multi_level():
    expr = "x >= 4.0 ? 'Preferred' : x >= 3.5 ? 'Conditional' : x >= 2.5 ? 'Probationary' : 'Rejected'"
    result = _convert_js_ternary(expr)
    # Should produce valid Python — evaluate it
    x = 3.7
    assert eval(result) == "Conditional"  # noqa: S307 — test-only eval


def test_preprocess_js_ternary_no_ternary():
    expr = "x + y"
    assert _convert_js_ternary(expr) == expr


def test_preprocess_js_ternary_string_colon():
    # Colon inside a string literal must NOT split the ternary
    expr = "x ? 'a:b' : 'c'"
    result = _convert_js_ternary(expr)
    assert eval(result, {"x": True}) == "a:b"  # noqa: S307


# ── Arithmetic ─────────────────────────────────────────────────────────────────

def test_arithmetic(sample_intake):
    assert evaluate_expression("4 * 0.25", EMPTY, sample_intake, EMPTY, EMPTY) == 1.0


def test_sum_star_col(sample_intake):
    result = evaluate_expression(
        "sum(audit_scores[*].score * audit_scores[*].weight)",
        EMPTY, sample_intake, EMPTY, EMPTY,
    )
    # 0.25*4 + 0.25*3 + 0.20*4 + 0.15*5 + 0.10*3 + 0.05*4 = 3.80
    assert abs(result - 3.80) < 0.001


# ── Ternary ────────────────────────────────────────────────────────────────────

def test_js_ternary_single(sample_intake):
    ctx = {"composite_score": 3.8}
    result = evaluate_expression(
        "composite_score >= 4.0 ? 'Preferred' : 'Other'",
        ctx, sample_intake, EMPTY, EMPTY,
    )
    assert result == "Other"


def test_js_ternary_multi_level(sample_intake):
    ctx = {"composite_score": 3.8, "qualification_verdict": "Conditional"}
    result = evaluate_expression(
        "qualification_verdict == 'Preferred' ? 0 : "
        "qualification_verdict == 'Conditional' ? round(4.0 - composite_score, 2) : "
        "round(3.5 - composite_score, 2)",
        ctx, sample_intake, EMPTY, EMPTY,
    )
    assert result == 0.20


# ── Null coalescing ────────────────────────────────────────────────────────────

def test_null_coalescing_none(sample_intake):
    # otd_pass_target is None → falls back to sla default 90
    result = evaluate_expression(
        "otd_pass_target or sla_thresholds.otd_rate_pct.pass",
        EMPTY, sample_intake, EMPTY, SLA,
    )
    assert result == 90


def test_null_coalescing_override():
    intake = {"otd_pass_target": 95}
    result = evaluate_expression(
        "otd_pass_target or sla_thresholds.otd_rate_pct.pass",
        EMPTY, intake, EMPTY, SLA,
    )
    assert result == 95


# ── Count ──────────────────────────────────────────────────────────────────────

def test_count_no_filter(sample_intake):
    result = evaluate_expression("count(corrective_actions)", EMPTY, sample_intake, EMPTY, EMPTY)
    assert result == 1


def test_count_with_filter(sample_intake):
    result = evaluate_expression(
        "count(corrective_actions, status='Open')",
        EMPTY, sample_intake, EMPTY, EMPTY,
    )
    assert result == 1


def test_count_no_match(sample_intake):
    result = evaluate_expression(
        "count(corrective_actions, status='Overdue')",
        EMPTY, sample_intake, EMPTY, EMPTY,
    )
    assert result == 0


# ── min_by ─────────────────────────────────────────────────────────────────────

def test_min_by(sample_intake):
    # Add weighted_score to audit_scores so min_by can operate on it
    augmented = [
        {**row, "weighted_score": row["score"] * row["weight"]}
        for row in sample_intake["audit_scores"]
    ]
    intake_aug = {**sample_intake, "audit_scores": augmented}
    result = evaluate_expression(
        "min_by(audit_scores, key='weighted_score').criterion",
        EMPTY, intake_aug, EMPTY, EMPTY,
    )
    # Sustainability & compliance: 0.05 * 4 = 0.20 — lowest weighted score
    assert result == "Sustainability & compliance"


# ── Array index + field access ─────────────────────────────────────────────────

def test_array_index_access(sample_intake):
    result = evaluate_expression(
        "risk_register[1].risk_item",
        EMPTY, sample_intake, EMPTY, EMPTY,
    )
    assert result == "Currency exposure EUR/USD"


# ── Date arithmetic ────────────────────────────────────────────────────────────

def test_date_today(sample_intake):
    result = evaluate_expression("today", EMPTY, sample_intake, EMPTY, EMPTY)
    assert result == datetime.date.today()


def test_date_plus_months(sample_intake):
    result = evaluate_expression("today + 12_months", EMPTY, sample_intake, EMPTY, EMPTY)
    expected = datetime.date.today() + relativedelta(months=12)
    assert result == expected


def test_next_review_date_conditional(sample_intake):
    ctx = {"qualification_verdict": "Conditional"}
    result = evaluate_expression(
        "qualification_verdict == 'Preferred' ? today + 12_months : "
        "qualification_verdict == 'Conditional' ? today + 6_months : today + 3_months",
        ctx, sample_intake, EMPTY, EMPTY,
    )
    expected = datetime.date.today() + relativedelta(months=6)
    assert result == expected


# ── Length and null checks ─────────────────────────────────────────────────────

def test_len(sample_intake):
    result = evaluate_expression("len(risk_register) > 1", EMPTY, sample_intake, EMPTY, EMPTY)
    assert result is True


def test_is_not_none(sample_intake):
    result = evaluate_expression("prev_otd_rate_pct is not None", EMPTY, sample_intake, EMPTY, EMPTY)
    assert result is True


def test_is_none(sample_intake):
    intake = {**sample_intake, "prev_otd_rate_pct": None}
    result = evaluate_expression("prev_otd_rate_pct is not None", EMPTY, intake, EMPTY, EMPTY)
    assert result is False


# ── Breach count ───────────────────────────────────────────────────────────────

def test_breach_count(sample_intake):
    ctx = {
        "otd_sla_status": "Watch",
        "defect_sla_status": "Pass",
        "invoice_sla_status": "Pass",
        "ncr_count_sla_status": "Watch",
        "ncr_close_sla_status": "Breach",
    }
    expr = (
        "(otd_sla_status == 'Breach' ? 1 : 0) + "
        "(defect_sla_status == 'Breach' ? 1 : 0) + "
        "(invoice_sla_status == 'Breach' ? 1 : 0) + "
        "(ncr_count_sla_status == 'Breach' ? 1 : 0) + "
        "(ncr_close_sla_status == 'Breach' ? 1 : 0)"
    )
    assert evaluate_expression(expr, ctx, sample_intake, EMPTY, EMPTY) == 1


# ── Nested dict access ─────────────────────────────────────────────────────────

def test_nested_dict_access(sample_intake):
    result = evaluate_expression(
        "sla_thresholds.otd_rate_pct.pass",
        EMPTY, sample_intake, EMPTY, SLA,
    )
    assert result == 90
