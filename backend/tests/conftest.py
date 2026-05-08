from pathlib import Path

import pytest
import yaml

from app.templates.schemas import TemplateSchema

TEMPLATE_PATH = Path(__file__).parent.parent.parent / "templates" / "supplier-qualification-report.yaml"


@pytest.fixture(scope="session")
def sqr_template() -> TemplateSchema:
    raw = yaml.safe_load(TEMPLATE_PATH.read_text(encoding="utf-8"))
    return TemplateSchema(**raw)


@pytest.fixture
def sample_intake() -> dict:
    return {
        "supplier_name": "Acme Precision Ltd",
        "supplier_country": "Germany",
        "supplier_contact_name": "Hans Mueller",
        "supplier_contact_title": "Quality Manager",
        "commodity_category": "Precision machined components",
        "duns_number": "123456789",
        "certifications_held": ["ISO 9001:2015", "IATF 16949"],
        "review_period": "Q1 2026",
        "evaluator_name": "Jane Smith",
        "qualification_type": "Re-qualification",
        "previous_verdict": "Conditional",
        "previous_composite_score": 3.4,
        "audit_scores": [
            {"criterion": "Quality management system",           "weight": 0.25, "score": 4, "notes": "Well documented"},
            {"criterion": "On-time delivery history",            "weight": 0.25, "score": 3, "notes": "Some delays"},
            {"criterion": "Financial stability",                 "weight": 0.20, "score": 4, "notes": ""},
            {"criterion": "Technical / engineering capability",  "weight": 0.15, "score": 5, "notes": "Excellent"},
            {"criterion": "Corrective action responsiveness",    "weight": 0.10, "score": 3, "notes": ""},
            {"criterion": "Sustainability & compliance",         "weight": 0.05, "score": 4, "notes": ""},
        ],
        "otd_rate_pct": 88.5,
        "defect_rate_pct": 1.2,
        "invoice_accuracy_pct": 96.0,
        "open_ncr_count": 3,
        "ncr_avg_close_days": 18.0,
        "prev_otd_rate_pct": 85.0,
        "prev_defect_rate_pct": 2.0,
        "prev_invoice_accuracy_pct": 94.0,
        "otd_pass_target": None,
        "defect_pass_target": None,
        "invoice_pass_target": None,
        "ncr_count_pass_target": None,
        "ncr_close_pass_target": None,
        "risk_register": [
            {
                "risk_item": "Single-source dependency",
                "likelihood": 4,
                "impact": 5,
                "owner": "Procurement",
                "mitigation": "Qualifying secondary source",
            },
            {
                "risk_item": "Currency exposure EUR/USD",
                "likelihood": 3,
                "impact": 3,
                "owner": "Finance",
                "mitigation": "Forward contracts",
            },
        ],
        "corrective_actions": [
            {
                "car_id": "CAR-001",
                "action_item": "Reduce NCR close time",
                "owner": "QA Manager",
                "due_date": "2026-07-01",
                "status": "Open",
            },
        ],
    }
