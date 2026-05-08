import asyncio
import re
from typing import Any, Callable, Optional

from langsmith import traceable
from pydantic import BaseModel

from app.templates.schemas import FieldSchema


class ClassifierOutput(BaseModel):
    label: str
    confidence: float = 1.0


def _extract_rule_var(condition: str) -> str:
    """Extract the leading identifier from a rule condition string."""
    match = re.match(r"^\s*(\w+)", condition)
    return match.group(1) if match else "_input"


@traceable(run_type="tool", name="classifier")
async def execute_classifier(
    field: FieldSchema,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
    evaluate_fn: Callable,
    openai_client: Optional[Any] = None,
) -> str:
    """
    Two execution paths (AD-020):
      - Rule-based: when field.rules is present — evaluate thresholds deterministically.
      - LLM fallback: when field.rules is None — call gpt-4o-mini via OpenRouter.
    """
    if field.rules:
        return _rule_based(field, context, intake_data, lookup_sources, sla_thresholds, evaluate_fn)
    return await _llm_classify(field, context, intake_data, lookup_sources, sla_thresholds, evaluate_fn, openai_client)


def _rule_based(
    field: FieldSchema,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
    evaluate_fn: Callable,
) -> str:
    # Evaluate the input expression to get the raw value
    input_val = evaluate_fn(
        field.input, context, intake_data, lookup_sources, sla_thresholds
    )

    # Infer the variable name the rule conditions reference
    rule_var = _extract_rule_var(field.rules[0].condition)

    # Build rule context: full context + input value under the inferred name
    rule_ctx = {**context, rule_var: input_val}

    for rule in field.rules:
        matched = evaluate_fn(
            rule.condition, rule_ctx, intake_data, lookup_sources, sla_thresholds
        )
        if matched:
            return rule.output

    raise ValueError(
        f"No matching rule for field '{field.id}' with input_val={input_val!r}"
    )


async def _llm_classify(
    field: FieldSchema,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
    evaluate_fn: Callable,
    openai_client: Any,
) -> str:
    from app.config import settings

    input_val = evaluate_fn(
        field.input, context, intake_data, lookup_sources, sla_thresholds
    )

    prompt = (
        f"Classify the following value into one of the allowed labels.\n"
        f"Input: {input_val}\n"
        f"Field definition: {field.model_dump()}"
    )

    max_retries = 3
    for attempt in range(max_retries):
        try:
            resp = await openai_client.beta.chat.completions.parse(
                model=settings.classifier_model,
                messages=[
                    {"role": "system", "content": "You are a precise classifier. Return only a label."},
                    {"role": "user", "content": prompt},
                ],
                response_format=ClassifierOutput,
                max_tokens=50,
            )
            return resp.choices[0].message.parsed.label
        except Exception:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2**attempt)
