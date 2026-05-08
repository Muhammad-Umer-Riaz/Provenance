import asyncio
import re
from typing import Any, Callable, Optional

from langsmith import traceable
from pydantic import BaseModel

from app.templates.schemas import FieldSchema


class NarrativeOutput(BaseModel):
    text: str


_SIMPLE_TOKEN_RE = re.compile(r"^\w+$")
_INTAKE_PREFIX_RE = re.compile(r"^intake\.")


def _render_prompt(
    prompt_template: str,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
    evaluate_fn: Callable,
) -> str:
    """
    Replace {{token}} placeholders in the prompt string.

    Resolution order:
      1. intake.field_name  → intake_data[field_name]
      2. simple identifier  → context lookup (falls back to intake_data)
      3. expression         → evaluate_fn(expr, context, intake_data, ...)
    """
    def replacer(m: re.Match) -> str:
        token = m.group(1).strip()

        # intake.field_name
        if _INTAKE_PREFIX_RE.match(token):
            field_name = token[len("intake."):]
            val = intake_data.get(field_name)
            return str(val) if val is not None else ""

        # Plain identifier — try context first, then intake
        if _SIMPLE_TOKEN_RE.match(token):
            if token in context:
                val = context[token]
                return str(val) if val is not None else ""
            if token in intake_data:
                val = intake_data[token]
                return str(val) if val is not None else ""

        # Expression (contains operators, function calls, etc.)
        try:
            result = evaluate_fn(token, context, intake_data, lookup_sources, sla_thresholds)
            return str(result) if result is not None else ""
        except Exception:
            return f"{{{{{token}}}}}"  # leave unresolved token as-is on failure

    return re.sub(r"\{\{([^}]+)\}\}", replacer, prompt_template)


def _build_system_prompt(field: FieldSchema) -> str:
    parts = [
        "You are a professional technical writer producing content for an industrial "
        "procurement report.",
        "Write only the requested text — no preamble, no meta-commentary, no labels.",
    ]
    if field.exemplars:
        parts.append("Style exemplar(s):")
        for ex in field.exemplars:
            parts.append(f'"{ex}"')
    return "\n".join(parts)


@traceable(run_type="llm", name="narrative_llm")
async def execute_narrative_llm(
    field: FieldSchema,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
    openai_client: Any,
    model: str,
    evaluate_fn: Optional[Callable] = None,
    max_retries: int = 3,
) -> str:
    """Render the prompt, call OpenRouter, retry on failure."""
    from app.strategies.calculator import evaluate_expression
    _eval = evaluate_fn or evaluate_expression

    rendered = _render_prompt(
        field.prompt,
        context,
        intake_data,
        lookup_sources,
        sla_thresholds,
        _eval,
    )
    system = _build_system_prompt(field)

    for attempt in range(max_retries):
        try:
            resp = await openai_client.beta.chat.completions.parse(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": rendered},
                ],
                response_format=NarrativeOutput,
                max_tokens=field.max_tokens or 200,
            )
            text = resp.choices[0].message.parsed.text.strip()
            if text:
                return text
        except Exception:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2**attempt)

    raise RuntimeError(f"narrative_llm failed for field '{field.id}' after {max_retries} retries")
