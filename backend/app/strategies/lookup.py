import re
from typing import Any

from langsmith import traceable

from app.strategies.utils import interpolate


def _parse_source(source: str) -> tuple[str, str | None]:
    """
    Parse the source string into (outer_key, context_field_name).

    Plain key:   "risk_disclosure_clause"                  → ("risk_disclosure_clause", None)
    Dict lookup: "qualification_scope_statements[commodity_category]"
                                                           → ("qualification_scope_statements",
                                                              "commodity_category")
    """
    match = re.match(r"^(\w+)\[(\w+)\]$", source.strip())
    if match:
        return match.group(1), match.group(2)
    return source.strip(), None


@traceable(run_type="tool", name="lookup")
def execute_lookup(
    source: str,
    lookup_sources: dict[str, Any],
    context: dict[str, Any],
) -> str:
    """
    Resolve a lookup source string to a text block, then interpolate {{tokens}}.

    Raises LookupError if the key is not found in lookup_sources.
    """
    outer_key, field_key = _parse_source(source)

    if outer_key not in lookup_sources:
        raise LookupError(f"Lookup key '{outer_key}' not found in lookup_sources")

    value = lookup_sources[outer_key]

    if field_key is not None:
        # Dict key lookup: look up value[context[field_key]]
        index_value = context.get(field_key)
        if index_value is None:
            raise LookupError(
                f"Context key '{field_key}' is None — cannot index into '{outer_key}'"
            )
        if not isinstance(value, dict) or index_value not in value:
            raise LookupError(
                f"'{index_value}' not found in lookup_sources['{outer_key}']"
            )
        value = value[index_value]

    return interpolate(str(value), context)
