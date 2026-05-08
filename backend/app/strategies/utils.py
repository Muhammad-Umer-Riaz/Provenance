import re
from typing import Any


def interpolate(text: str, context: dict[str, Any]) -> str:
    """Replace {{token}} and {{a.b.c}} placeholders with values from context."""
    def replacer(m: re.Match) -> str:
        key = m.group(1).strip()
        parts = key.split(".")
        val: Any = context
        for part in parts:
            if isinstance(val, dict):
                val = val[part]
            else:
                val = getattr(val, part)
        return str(val) if val is not None else ""

    return re.sub(r"\{\{([^}]+)\}\}", replacer, text)
