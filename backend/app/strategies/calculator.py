"""
Expression evaluator for the Provenance template engine.

Pre-processor pipeline (applied in order):
  1. today + N_months  →  __today_plus_months(N)
  1b. bare `today`     →  __today()
  2. table[*].field    →  __col(table, 'field')
  3. __col*__col       →  __zip_mul(...)
  4. table[N].field    →  table[N]['field']
  5. sla_thresholds.x.y → __get(sla_thresholds, 'x', 'y')
  6. cond ? then : else → (then) if (cond) else (else)   [JS ternary — always last]
"""

import builtins
import datetime
import functools
import re
from typing import Any

from dateutil.relativedelta import relativedelta
from langsmith import traceable
from simpleeval import EvalWithCompoundTypes

from app.templates.schemas import FieldSchema

# ── Pre-processor helpers ──────────────────────────────────────────────────────

_DATE_OFFSET_RE = re.compile(r"\btoday\s*\+\s*(\d+)_months\b")
_DATE_BARE_RE = re.compile(r"\btoday\b")
_STAR_COL_RE = re.compile(r"(\w+)\[\*\]\.(\w+)")
_ZIP_MUL_RE = re.compile(r"(__col\([^)]+\))\s*\*\s*(__col\([^)]+\))")
_ARRAY_DOT_RE = re.compile(r"(\w+)\[(\d+)\]\.(\w+)")
_NESTED_DICT_RE = re.compile(r"\b(sla_thresholds)\.(\w+)\.(\w+)\b")
# Matches parenthesised groups (no nested parens) that contain a ? — e.g. (x ? 1 : 0)
_PAREN_TERNARY_RE = re.compile(r"\(([^()]*\?[^()]*)\)")


def _convert_date_arithmetic(expr: str) -> str:
    expr = _DATE_OFFSET_RE.sub(lambda m: f"__today_plus_months({m.group(1)})", expr)
    expr = _DATE_BARE_RE.sub("__today()", expr)
    return expr


def _convert_star_cols(expr: str) -> str:
    return _STAR_COL_RE.sub(r"__col(\1, '\2')", expr)


def _convert_zip_mul(expr: str) -> str:
    return _ZIP_MUL_RE.sub(r"__zip_mul(\1, \2)", expr)


def _convert_array_dot(expr: str) -> str:
    return _ARRAY_DOT_RE.sub(r"\1[\2]['\3']", expr)


def _convert_nested_dict(expr: str) -> str:
    return _NESTED_DICT_RE.sub(r"__get(\1, '\2', '\3')", expr)


def _find_ternary_splits(expr: str) -> tuple[int | None, int | None]:
    """Return (q_pos, c_pos) — positions of first top-level ? and its matching :"""
    depth = 0
    in_sq = False
    in_dq = False
    q_pos = None

    for i, ch in enumerate(expr):
        if ch == "'" and not in_dq:
            in_sq = not in_sq
        elif ch == '"' and not in_sq:
            in_dq = not in_dq
        elif in_sq or in_dq:
            continue
        elif ch in ("(", "["):
            depth += 1
        elif ch in (")", "]"):
            depth -= 1
        elif ch == "?" and depth == 0:
            q_pos = i
            break

    if q_pos is None:
        return None, None

    depth = 0
    in_sq = False
    in_dq = False
    for i in range(q_pos + 1, len(expr)):
        ch = expr[i]
        if ch == "'" and not in_dq:
            in_sq = not in_sq
        elif ch == '"' and not in_sq:
            in_dq = not in_dq
        elif in_sq or in_dq:
            continue
        elif ch in ("(", "["):
            depth += 1
        elif ch in (")", "]"):
            depth -= 1
        elif ch == ":" and depth == 0:
            return q_pos, i

    return q_pos, None


def _convert_js_ternary(expr: str) -> str:
    q_pos, c_pos = _find_ternary_splits(expr)
    if q_pos is None or c_pos is None:
        return expr
    cond = expr[:q_pos].strip()
    then = expr[q_pos + 1 : c_pos].strip()
    else_ = _convert_js_ternary(expr[c_pos + 1 :].strip())
    return f"({then}) if ({cond}) else ({else_})"


def _convert_paren_ternaries(expr: str) -> str:
    """
    Convert ternaries that sit inside non-nested parentheses, e.g. (x ? 1 : 0).
    Iterates until stable so nested cases are handled inside-out.
    """
    prev = None
    while prev != expr:
        prev = expr
        expr = _PAREN_TERNARY_RE.sub(
            lambda m: f"({_convert_js_ternary(m.group(1))})", expr
        )
    return expr


def preprocess(expr: str) -> str:
    """Apply the full pre-processor pipeline in the correct order."""
    # Collapse multi-line YAML block scalars (| operator) to a single line
    expr = " ".join(expr.split())
    expr = _convert_date_arithmetic(expr)
    expr = _convert_star_cols(expr)
    expr = _convert_zip_mul(expr)
    expr = _convert_array_dot(expr)
    expr = _convert_nested_dict(expr)
    expr = _convert_paren_ternaries(expr)   # handles (x ? y : z) groups
    expr = _convert_js_ternary(expr)        # handles top-level ternary
    return expr


# ── Custom aggregation functions ───────────────────────────────────────────────

def _agg_count(table_or_list, **kwargs):
    if not kwargs:
        return len(table_or_list)
    result = table_or_list
    for key, val in kwargs.items():
        result = [r for r in result if r.get(key) == val]
    return len(result)


def _agg_min_by(table: list[dict], key: str) -> dict:
    return builtins.min(table, key=lambda r: r[key])


def _agg_get(obj: Any, *keys: str) -> Any:
    return functools.reduce(lambda o, k: o[k], keys, obj)


def _today() -> datetime.date:
    return datetime.date.today()


def _today_plus_months(n: int) -> datetime.date:
    return datetime.date.today() + relativedelta(months=int(n))


CUSTOM_FUNCTIONS: dict[str, Any] = {
    "sum": lambda items: builtins.sum(items),
    "min": lambda items: builtins.min(items),
    "max": lambda items: builtins.max(items),
    "len": builtins.len,
    "round": builtins.round,
    "count": _agg_count,
    "min_by": _agg_min_by,
    "__col": lambda t, f: [r[f] for r in t],
    "__zip_mul": lambda a, b: [x * y for x, y in zip(a, b)],
    "__get": _agg_get,
    "__today": _today,
    "__today_plus_months": _today_plus_months,
}


# ── Evaluation context ─────────────────────────────────────────────────────────

class _PermissiveNames(dict):
    """Returns None for any unresolved name so optional intake fields don't raise NameNotDefined."""
    def __missing__(self, key: str) -> None:
        return None


def build_eval_context(
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
) -> _PermissiveNames:
    names: dict[str, Any] = {}
    names.update(intake_data)
    names.update(context)
    names["sla_thresholds"] = sla_thresholds or {}
    names["lookup_sources"] = lookup_sources or {}
    names["intake"] = intake_data
    return _PermissiveNames(names)


# ── Core evaluator ─────────────────────────────────────────────────────────────

@traceable(run_type="tool", name="evaluate_expression")
def evaluate_expression(
    expression: str,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
) -> Any:
    """Pre-process then safely evaluate an expression string."""
    preprocessed = preprocess(expression.strip())
    names = build_eval_context(context, intake_data, lookup_sources, sla_thresholds)
    ev = EvalWithCompoundTypes(names=names, functions=CUSTOM_FUNCTIONS)
    return ev.eval(preprocessed)


# ── Public strategy entry point ────────────────────────────────────────────────

def execute_calculator(
    field: FieldSchema,
    context: dict[str, Any],
    intake_data: dict[str, Any],
    lookup_sources: dict[str, Any],
    sla_thresholds: dict[str, Any],
) -> Any:
    """Evaluate field.expression, apply formatting, and handle null_value fallback."""
    result = evaluate_expression(
        field.expression,
        context,
        intake_data,
        lookup_sources,
        sla_thresholds,
    )

    if result is None and field.null_value is not None:
        return field.null_value

    if field.format == "YYYY-MM-DD" and hasattr(result, "strftime"):
        return result.strftime("%Y-%m-%d")

    if field.format == "0.00" and isinstance(result, (int, float)):
        return round(float(result), 2)

    return result
