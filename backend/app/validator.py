import logging
from typing import Any

from simpleeval import EvalWithCompoundTypes

from app.templates.schemas import TemplateSchema

logger = logging.getLogger(__name__)


def run_validation_rules(template: TemplateSchema, context: dict[str, Any]) -> list[dict[str, Any]]:
    """Evaluate every validation_rule in the template against the generated context."""
    results: list[dict[str, Any]] = []
    evaluator = EvalWithCompoundTypes(names=context)

    for rule in (template.validation_rules or []):
        try:
            passed = bool(evaluator.eval(rule.check))
        except Exception:
            logger.warning("Validation rule %s could not be evaluated", rule.id)
            passed = False

        results.append({
            "id": rule.id,
            "description": rule.description,
            "severity": rule.severity,
            "message": rule.message,
            "passed": passed,
        })

    return results
