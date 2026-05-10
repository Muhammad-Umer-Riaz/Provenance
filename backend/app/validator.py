import logging
import re
from typing import Any

from simpleeval import EvalWithCompoundTypes

from app.templates.schemas import TemplateSchema

logger = logging.getLogger(__name__)


def _interpolate_message(message: str | None, context: dict[str, Any]) -> str:
    """Replace {{key}} placeholders in a message string with values from context."""
    if not message:
        return ""
    evaluator = EvalWithCompoundTypes(names=context)

    def replacer(m: re.Match) -> str:
        expr = m.group(1).strip()
        try:
            val = evaluator.eval(expr)
            return str(val) if val is not None else "—"
        except Exception:
            return "—"

    return re.sub(r"\{\{([^}]+)\}\}", replacer, message)


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
            "message": _interpolate_message(rule.message, context),
            "passed": passed,
        })

    return results
