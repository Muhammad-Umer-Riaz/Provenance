import json
import logging
from collections import defaultdict
from html import escape
from typing import Any

from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

VERDICT_COLOURS: dict[str, str] = {
    "Preferred": "#10b981",
    "Conditional": "#f59e0b",
    "Probationary": "#f97316",
    "Rejected": "#ef4444",
}

_ACRONYMS = {"car", "otd", "ncr", "sla", "llm", "sqr", "id", "duns", "vat"}


def _fmt(id_: str) -> str:
    return " ".join(
        w.upper() if w.lower() in _ACRONYMS else w.capitalize()
        for w in id_.split("_")
    )


def _parse_value(raw: str | None) -> Any:
    if not raw:
        return None
    t = raw.strip()
    if t.startswith("[") or t.startswith("{"):
        try:
            return json.loads(t)
        except json.JSONDecodeError:
            pass
    return raw


def _render_table(rows: list[dict]) -> str:
    if not rows:
        return "<p class='empty'>(empty table)</p>"
    keys = [k for k in rows[0] if k != "id"]
    header = "".join(f"<th>{escape(_fmt(k))}</th>" for k in keys)
    body = ""
    for row in rows:
        cells = ""
        for k in keys:
            val = row.get(k)
            cell_text = ", ".join(str(v) for v in val) if isinstance(val, list) else str(val if val is not None else "")
            cells += f"<td>{escape(cell_text)}</td>"
        body += f"<tr>{cells}</tr>"
    return f"<table><thead><tr>{header}</tr></thead><tbody>{body}</tbody></table>"


def _render_dict(obj: dict) -> str:
    rows = ""
    for k, v in obj.items():
        if v is None or v == "":
            continue
        val = ", ".join(str(i) for i in v) if isinstance(v, list) else str(v)
        rows += f"<tr><td class='dk'>{escape(_fmt(k))}</td><td>{escape(val)}</td></tr>"
    return f"<table class='dt'>{rows}</table>" if rows else ""


def _build_html(report: dict, fields: list[dict]) -> str:
    intake = report.get("intake_data") or {}
    supplier = escape(str(intake.get("supplier_name", "—")))
    score = report.get("score")
    score_str = f"{score:.2f}" if score is not None else "—"
    verdict = report.get("verdict") or "—"
    colour = VERDICT_COLOURS.get(verdict, "#64748b")
    evaluator = escape(str(intake.get("evaluator_name", "—")))
    period = escape(str(intake.get("review_period", "—")))

    sections: dict[str, list[dict]] = defaultdict(list)
    for f in sorted(fields, key=lambda x: x.get("field_index", 0)):
        sections[f["section_id"]].append(f)

    sections_html = ""
    for section_id, sec_fields in sections.items():
        rows_html = ""
        for f in sec_fields:
            label = _fmt(f["field_id"])
            strategy = f.get("strategy", "")
            parsed = _parse_value(f.get("value"))
            if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                value_html = _render_table(parsed)
            elif isinstance(parsed, dict):
                value_html = _render_dict(parsed) or "<p class='empty'>—</p>"
            elif parsed:
                value_html = f"<p class='fv'>{escape(str(parsed))}</p>"
            else:
                value_html = "<p class='fv empty'>—</p>"
            rows_html += f"""
            <div class="fr">
              <div class="fl">{escape(label)}<span class="st">{escape(strategy)}</span></div>
              <div class="fvw">{value_html}</div>
            </div>"""
        sections_html += f"""
        <section class="rs">
          <h2>§ {escape(_fmt(section_id))}</h2>
          {rows_html}
        </section>"""

    css = """
        @page { size: A4; margin: 20mm 22mm 22mm 22mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; line-height: 1.5; }
        .rh { border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 20px; }
        .sn { font-size: 20px; font-weight: 700; margin: 0 0 6px; }
        .hm { display: flex; align-items: center; gap: 10px; color: #64748b; font-size: 10px; }
        .vb { border-radius: 3px; padding: 2px 7px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #fff; }
        .sc { font-family: monospace; font-size: 11px; font-weight: 600; }
        .rs { page-break-inside: avoid; margin-bottom: 22px; }
        .rs h2 { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin: 0 0 10px; }
        .fr { display: flex; gap: 10px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
        .fr:last-child { border-bottom: none; }
        .fl { min-width: 170px; max-width: 170px; font-size: 10px; font-weight: 600; color: #475569; padding-top: 1px; }
        .st { display: block; font-family: monospace; font-size: 8px; color: #94a3b8; font-weight: 400; margin-top: 1px; }
        .fvw { flex: 1; }
        p.fv { margin: 0; color: #334155; }
        p.empty { color: #94a3b8; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { text-align: left; font-weight: 600; color: #64748b; padding: 3px 6px 3px 0; border-bottom: 1px solid #e2e8f0; }
        td { padding: 2px 6px 2px 0; vertical-align: top; border-bottom: 1px solid #f8fafc; }
        table.dt td.dk { font-weight: 600; color: #475569; min-width: 130px; }
    """

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>{css}</style></head>
<body>
  <div class="rh">
    <h1 class="sn">{supplier}</h1>
    <div class="hm">
      <span class="vb" style="background:{colour}">{escape(verdict)}</span>
      <span class="sc">{score_str} / 5.00</span>
      <span>{evaluator}</span>
      <span>{period}</span>
    </div>
  </div>
  {sections_html}
</body>
</html>"""


async def generate_pdf(report: dict, fields: list[dict]) -> bytes:
    html = _build_html(report, fields)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html, wait_until="load")
        pdf_bytes = await page.pdf(
            format="A4",
            print_background=True,
            margin={"top": "20mm", "right": "22mm", "bottom": "22mm", "left": "22mm"},
        )
        await browser.close()
    return pdf_bytes
