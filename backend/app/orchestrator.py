from typing import Any, Callable, Optional

from app.config import settings
from app.strategies.calculator import evaluate_expression, execute_calculator
from app.strategies.classifier import execute_classifier
from app.strategies.extractor import execute_extractor_fields, execute_extractor_table
from app.strategies.lookup import execute_lookup
from app.strategies.narrative_llm import execute_narrative_llm
from app.strategies.template_fill import execute_template_fill
from app.templates.schemas import FieldSchema, TemplateSchema


class ReportOrchestrator:
    def __init__(
        self,
        template: TemplateSchema,
        intake_data: dict[str, Any],
        report_id: str,
    ) -> None:
        self.template = template
        self.intake_data = intake_data
        self.report_id = report_id
        self.context: dict[str, Any] = {}
        self._client: Optional[Any] = None

    async def generate(
        self,
        on_field_start: Callable | None = None,
        on_field_complete: Callable | None = None,
    ) -> dict[str, Any]:
        """Process all sections in order, all fields within each section in declaration order."""
        for section in sorted(self.template.sections, key=lambda s: s.order):
            for field in section.content:
                if on_field_start:
                    await on_field_start(field, section)
                result, error = await self._process_field_safe(field)
                if on_field_complete:
                    await on_field_complete(field, section, result, error)
        return self.context

    async def _process_field_safe(self, field: FieldSchema) -> tuple[Any, Exception | None]:
        """Run _process_field with per-field error isolation. Returns (result, error)."""
        try:
            result = await self._process_field(field)
            return result, None
        except Exception as exc:
            self.context[field.id] = field.null_value
            return None, exc

    async def _process_field(self, field: FieldSchema) -> Any:
        # Evaluate condition — skip field if condition is false
        if field.condition is not None:
            try:
                cond_result = evaluate_expression(
                    field.condition,
                    self.context,
                    self.intake_data,
                    self.template.lookup_sources or {},
                    self.template.sla_thresholds or {},
                )
            except Exception:
                cond_result = False
            if not cond_result:
                self.context[field.id] = field.null_value
                return field.null_value

        result = await self._dispatch(field)

        # Apply null_value fallback
        if result is None and field.null_value is not None:
            result = field.null_value

        self.context[field.id] = result

        # Shadow augmented table rows back under the source name so downstream
        # expressions that reference the source table see computed columns too
        if (
            field.strategy == "extractor"
            and field.source
            and field.computed_columns
        ):
            self.context[field.source] = result

        return result

    async def _dispatch(self, field: FieldSchema) -> Any:
        strategy = field.strategy
        lookup_sources = self.template.lookup_sources or {}
        sla_thresholds = self.template.sla_thresholds or {}

        if strategy == "lookup":
            return execute_lookup(field.source, lookup_sources, self._lookup_ctx())

        if strategy == "extractor":
            if field.source:
                return execute_extractor_table(
                    source=field.source,
                    intake_data=self.intake_data,
                    computed_columns=field.computed_columns,
                    sort_by=field.sort_by,
                    evaluate_fn=self._row_eval_fn(),
                )
            return execute_extractor_fields(field.fields or [], self.intake_data)

        if strategy == "calculator":
            return execute_calculator(
                field, self.context, self.intake_data, lookup_sources, sla_thresholds
            )

        if strategy == "template_fill":
            return execute_template_fill(
                field.template,
                self.context,
                self.intake_data,
                self.report_id,
                self.template.template,
            )

        if strategy == "classifier":
            # Classifier-gated lookup: has source but no rules — route to lookup handler
            if field.source and not field.rules:
                return execute_lookup(field.source, lookup_sources, self._lookup_ctx())
            return await execute_classifier(
                field=field,
                context=self.context,
                intake_data=self.intake_data,
                lookup_sources=lookup_sources,
                sla_thresholds=sla_thresholds,
                evaluate_fn=evaluate_expression,
                openai_client=self._get_client(),
            )

        if strategy == "narrative_llm":
            return await execute_narrative_llm(
                field=field,
                context=self.context,
                intake_data=self.intake_data,
                lookup_sources=lookup_sources,
                sla_thresholds=sla_thresholds,
                openai_client=self._get_client(),
                model=settings.narrative_model,
            )

        if strategy == "direct_input":
            return self.intake_data.get(field.id)

        raise ValueError(f"Unknown strategy '{strategy}' on field '{field.id}'")

    def _lookup_ctx(self) -> dict[str, Any]:
        """Merged context for {{token}} interpolation in lookup and template_fill."""
        ctx: dict[str, Any] = {}
        ctx.update(self.intake_data)
        ctx.update(self.context)
        ctx["report_id"] = self.report_id
        ctx["template"] = {
            "version": self.template.template.version,
            "id": self.template.template.id,
        }
        ctx["intake"] = self.intake_data
        return ctx

    def _row_eval_fn(self):
        """Return a partial evaluator for computed_columns (row dict as context)."""
        lookup_sources = self.template.lookup_sources or {}
        sla_thresholds = self.template.sla_thresholds or {}

        def _eval(expression: str, row: dict[str, Any]) -> Any:
            return evaluate_expression(
                expression, row, self.intake_data, lookup_sources, sla_thresholds
            )

        return _eval

    def _get_client(self) -> Any:
        if self._client is None:
            from openai import AsyncOpenAI
            self._client = AsyncOpenAI(
                api_key=settings.openrouter_api_key,
                base_url="https://openrouter.ai/api/v1",
            )
        return self._client
