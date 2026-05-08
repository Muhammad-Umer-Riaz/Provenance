from typing import Any, Callable, Optional

from langsmith import traceable

from app.templates.schemas import ComputedColumnSchema, SortBySchema


@traceable(run_type="tool", name="extractor_fields")
def execute_extractor_fields(
    field_names: list[str],
    intake_data: dict[str, Any],
) -> dict[str, Any]:
    """Return a dict of {field_name: value} for each name in field_names."""
    return {name: intake_data.get(name) for name in field_names}


@traceable(run_type="tool", name="extractor_table")
def execute_extractor_table(
    source: str,
    intake_data: dict[str, Any],
    computed_columns: Optional[list[ComputedColumnSchema]],
    sort_by: Optional[SortBySchema],
    evaluate_fn: Callable[[str, dict[str, Any]], Any],
) -> list[dict[str, Any]]:
    """
    1. Pull rows from intake_data[source].
    2. Add computed_columns per row using evaluate_fn(expr, row).
    3. Apply column.format if present.
    4. Sort by sort_by.field in sort_by.order if sort_by is set.
    5. Return augmented rows (original rows not mutated).
    """
    raw_rows: list[dict[str, Any]] = intake_data.get(source) or []
    rows = [dict(row) for row in raw_rows]  # shallow copy each row

    if computed_columns:
        for row in rows:
            for col in computed_columns:
                result = evaluate_fn(col.expression, row)
                if col.format == "0.00" and isinstance(result, (int, float)):
                    result = round(float(result), 2)
                row[col.name] = result

    if sort_by:
        reverse = sort_by.order.lower() == "desc"
        rows.sort(
            key=lambda r: (r.get(sort_by.field) is None, r.get(sort_by.field)),
            reverse=reverse,
        )

    return rows
