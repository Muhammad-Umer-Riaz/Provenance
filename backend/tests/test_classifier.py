import pytest

from app.strategies.calculator import evaluate_expression
from app.strategies.classifier import execute_classifier
from app.templates.schemas import ClassifierRuleSchema, FieldSchema

EMPTY: dict = {}


def _verdict_field() -> FieldSchema:
    return FieldSchema(
        id="qualification_verdict",
        type="field",
        strategy="classifier",
        input="composite_score",
        rules=[
            ClassifierRuleSchema(condition="composite_score >= 4.0", output="Preferred"),
            ClassifierRuleSchema(condition="composite_score >= 3.5", output="Conditional"),
            ClassifierRuleSchema(condition="composite_score >= 2.5", output="Probationary"),
            ClassifierRuleSchema(condition="composite_score < 2.5",  output="Rejected"),
        ],
    )


def _risk_tier_field() -> FieldSchema:
    return FieldSchema(
        id="overall_risk_tier",
        type="field",
        strategy="classifier",
        input="max(risk_register[*].priority_score)",
        rules=[
            ClassifierRuleSchema(condition="max_priority >= 15", output="High"),
            ClassifierRuleSchema(condition="max_priority >= 8",  output="Medium"),
            ClassifierRuleSchema(condition="max_priority < 8",   output="Low"),
        ],
    )


# ── Qualification verdict ──────────────────────────────────────────────────────

@pytest.mark.parametrize("score,expected", [
    (4.2,  "Preferred"),
    (4.0,  "Preferred"),
    (3.9,  "Conditional"),
    (3.5,  "Conditional"),
    (3.49, "Probationary"),
    (2.5,  "Probationary"),
    (2.49, "Rejected"),
    (1.0,  "Rejected"),
])
async def test_qualification_verdict(score, expected):
    field = _verdict_field()
    ctx = {"composite_score": score}
    result = await execute_classifier(
        field=field,
        context=ctx,
        intake_data=EMPTY,
        lookup_sources=EMPTY,
        sla_thresholds=EMPTY,
        evaluate_fn=evaluate_expression,
    )
    assert result == expected


# ── Overall risk tier ──────────────────────────────────────────────────────────

@pytest.mark.parametrize("max_priority,expected", [
    (20, "High"),
    (15, "High"),
    (14, "Medium"),
    (8,  "Medium"),
    (7,  "Low"),
    (1,  "Low"),
])
async def test_risk_tier(max_priority, expected):
    field = _risk_tier_field()
    # Risk register with priority_score already computed
    risk_register = [{"priority_score": max_priority}]
    intake = {"risk_register": risk_register}
    result = await execute_classifier(
        field=field,
        context=EMPTY,
        intake_data=intake,
        lookup_sources=EMPTY,
        sla_thresholds=EMPTY,
        evaluate_fn=evaluate_expression,
    )
    assert result == expected
