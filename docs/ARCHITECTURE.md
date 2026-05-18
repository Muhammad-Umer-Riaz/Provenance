# Provenance — Architecture

> This document is the architectural reference for Provenance, an evidence-driven
> report generation tool for industrial operations. It covers the problem framing,
> the generation engine design, the strategy taxonomy that routes each report field
> through the system, the locked stack, the target report domain (Supplier
> Qualification), the v1 YAML template, and the architectural decisions made along
> the way.

---

## 1. Orientation

Provenance is a schema-driven, field-level report generation engine. Every field
in every template declares a generation strategy. The orchestrator reads each
field, routes it to its strategy handler, and writes the result to an immutable
per-field audit log. Most fields are deterministic — boilerplate `lookup`, intake
`extractor`, arithmetic `calculator`, `template_fill` interpolation. The LLM is
invoked only for the ~25% of fields where prose must be synthesised from
structured inputs.

For the product framing — what Provenance is, who it is for, and what is in scope
for v1 — see [`PRD.md`](./PRD.md). This document covers the engine: the strategy taxonomy
(Section 4), the field-level anatomy of the demo template (Section 5), the YAML
pattern (Section 6), and the architectural decisions made along the way
(Section 10).

---

## 2. Why this architecture exists (the inspiration)

This pattern was developed after observing a recurring problem in industrial and
regulated environments: engineers spend significant time writing reports that are
structurally identical across instances — same sections, same table shapes, same
narrative patterns — but are written from scratch every time because the inputs
change. The variation is in the *data*, not the *structure*.

The insight is that once you decompose a report at the field level, most of it does
not require an LLM. Boilerplate clauses, passthrough table data, and deterministic
calculations account for roughly 70–75% of a typical industrial report. The LLM
handles the remaining 20–25% where narrative prose genuinely needs to be synthesised
from structured inputs.

The full strategy taxonomy that encodes this insight is in Section 4.

---

## 3. Target domain: Supplier Qualification Reports

The public portfolio version of Provenance is built around **Supplier Qualification
Reports (SQRs)** — formal procurement documents that assess whether a supplier meets
the criteria for approved-vendor status.

This domain was chosen because:
- It is universal across manufacturing, engineering, and operations companies —
  any hiring manager in these industries recognises the problem instantly.
- It has rich field-level variety: lookup boilerplate (scope statements, regulatory
  clauses), structured tables (audit scorecard, risk register, CAR table), deterministic
  calculations (composite score, risk priority, next review date), classifier logic
  (verdict from score, risk tier from max priority), and LLM narrative (summary
  paragraphs grounded in the numbers).
- It introduces a `classifier → narrative_llm` chain that is architecturally more
  interesting than a pure narrative system — the verdict gates what the LLM is
  permitted to say.
- It connects directly to the author's Procurement Intelligence portfolio project
  (same domain, different layer — that project handles analytics; this one handles
  the reporting output).

---

## 4. Generation strategy taxonomy (the engine)

This is the core of the system. Every field in every template declares exactly one
strategy. The orchestrator reads the strategy and routes accordingly.

| Strategy | What it does | LLM? | Example |
|---|---|---|---|
| `lookup` | Selects a fixed canonical text block from a dictionary keyed on intake fields | No | Scope statement (keyed on commodity type); regulatory disclaimer; signatory block footer |
| `extractor` | Takes a value the user entered in the intake form and places it in the output verbatim, with optional formatting | No | Supplier name, country, DUNS number; all table rows the user filled in |
| `calculator` | Computes a value deterministically from already-filled fields | No | Composite audit score (Σ weight × score); risk priority (likelihood × impact); next review date (from verdict + review schedule lookup) |
| `template_fill` | Renders a fixed string template with `{{intake.field}}` interpolation | No | Report header line "SQR-{{report_id}} · {{supplier_name}} · {{period}}" |
| `direct_input` | Engineer types prose directly during intake; rendered without modification | No | Free-text exception notes; any field the engineer wants full control over |
| `narrative_llm` | LLM with style exemplars writes a paragraph from structured fields as inputs | Yes | Scorecard summary paragraph; performance narrative; risk narrative; executive summary |
| `classifier` | Constrained-output LLM (or rule engine) maps a value to an enum for downstream logic | Yes (small) / No | Qualification verdict (Preferred / Conditional / Probationary / Rejected from composite score); overall risk tier (Low / Medium / High from max priority score) |
| `grounded_llm` | LLM with retrieval against a reference corpus | Yes | Reserved for templates that need cross-document references; unused in SQR v1 |
| `hybrid` | User fills rows manually, LLM proposes additions in `review_required` mode | Yes (selectively) | CAR table — user's actions + AI-proposed gaps based on identified risks |

**Two important implementation notes:**

1. `extractor` does not extract from unstructured text. The user's intake form *is*
   structured data. This strategy is a passthrough. The name may be changed to
   `passthrough` or `user_input` in code for clarity.

2. Strategies are applied **per field, not per section**. A single section mixes
   strategies — a `narrative_llm` paragraph sits next to `extractor` table cells
   and `lookup` boilerplate in the same section. The orchestrator processes each
   field independently.

**`classifier → narrative_llm` chaining** is the key pattern in the SQR template.
The classifier fires first and its output gates downstream behaviour:
- Score → classifier → verdict (Preferred / Conditional / Probationary / Rejected)
- Verdict → determines which `lookup` conditions block appears in Section 5
- Verdict → passed as context to the Section 6 `narrative_llm` calls, constraining
  what the model is allowed to assert

This chain is preserved in the orchestrator's execution order.

---

## 5. Report anatomy — Supplier Qualification Report (6 sections)

This is the field-level breakdown of the SQR template. Strategy assignments
are authoritative for v1.

### Section 1 · Supplier & engagement header
| Field | Strategy |
|---|---|
| Report ID, issue date, review period, evaluator name | `template_fill` |
| Supplier name, country, commodity category, DUNS/VAT | `extractor` |
| Certifications held (multi-select: ISO 9001, ISO 14001, IATF, EN 9100, etc.) | `extractor` |
| Qualification scope statement | `lookup` (keyed on commodity type) |

### Section 2 · Audit scorecard
| Field | Strategy |
|---|---|
| Scoring table (6 criteria × weight × score 1–5) | `extractor` / table |
| Weighted scores per row | `calculator` (weight × score) |
| Composite score | `calculator` (Σ weighted scores) |
| Qualification verdict | `classifier` (4-tier: ≥4.0 → Preferred, ≥3.5 → Conditional, ≥2.5 → Probationary, <2.5 → Rejected) |
| Scorecard summary paragraph | `narrative_llm` (inputs: all scores, lowest criterion, verdict) |

Audit criteria (fixed set for v1):
1. Quality management system (weight 25%)
2. On-time delivery history (weight 25%)
3. Financial stability (weight 20%)
4. Technical / engineering capability (weight 15%)
5. Corrective action responsiveness (weight 10%)
6. Sustainability & compliance (weight 5%)

### Section 3 · Delivery & quality performance
| Field | Strategy |
|---|---|
| Performance metrics table (OTD %, defect rate, invoice accuracy, open NCR count, avg NCR close time) | `extractor` / table |
| SLA compliance flags per metric | `calculator` (compare entered value against threshold; flag breach/watch/pass) |
| Performance narrative paragraph | `narrative_llm` (inputs: all metrics, breach flags, trend direction if prior period entered) |

SLA thresholds (v1 defaults, configurable in template):
- OTD ≥ 90% = pass; 85–89% = watch; < 85% = breach
- Defect rate ≤ 1.5% = pass; 1.5–3% = watch; > 3% = breach
- Invoice accuracy ≥ 95% = pass
- Open NCRs ≤ 2 = pass; 3–4 = watch; > 4 = breach
- NCR close time ≤ 14 days = pass; 15–21 = watch; > 21 = breach

### Section 4 · Risk assessment
| Field | Strategy |
|---|---|
| Risk register table (risk_category enum, risk_item, likelihood 1–5, impact 1–5, owner, mitigation) | `extractor` / table |
| Priority score per row | `calculator` (likelihood × impact) |
| Overall risk tier | `classifier` (max priority ≥ 15 → High, 8–14 → Medium, < 8 → Low) |
| Risk narrative paragraph | `narrative_llm` (inputs: top 2 risks by priority score, their mitigations) |
| Standard risk disclosure clause | `lookup` (fixed regulatory boilerplate) |

### Section 5 · Corrective actions & conditions
| Field | Strategy |
|---|---|
| CAR table (action item, owner, due date, status) | `extractor` / table (hybrid v2: LLM proposes gaps from Section 4 risks) |
| Approval conditions block | `classifier → lookup` (only appears for non-Preferred verdicts; content keyed on verdict) |
| CAR summary paragraph | `narrative_llm` (inputs: CAR count, priority items, earliest due date) |
| Standard CAR follow-up clause | `lookup` (next review trigger boilerplate) |

### Section 6 · Summary & recommendation
| Field | Strategy |
|---|---|
| Executive summary paragraph | `narrative_llm` (inputs: supplier, commodity, composite score, verdict, top risk) |
| Procurement recommendation paragraph | `narrative_llm` (inputs: verdict, conditions if any, CAR count, recommended action) |
| Next review date | `calculator` (Preferred → 12 months, Conditional → 6 months, Probationary/Rejected → 3 months) |
| Approval signatory block, disclaimer, version footer | `lookup` |

---

## 6. YAML template — pattern

The full templates live in the repo at `templates/supplier-qualification-report.yaml`
and `templates/site-acceptance-test.yaml`. The excerpt below shows the
architectural pattern using the SQR audit scorecard section as an example.
In a single section the engine chains four strategies: an `extractor` table
feeds a `calculator` (composite score), the calculator feeds a `classifier`
(verdict), and the classifier output is fed as constraining context into a
`narrative_llm` summary. This is the `classifier → narrative_llm` chain
referenced throughout this document.

```yaml
template:
  id: supplier-qualification-report
  version: 1.0
  name: "Supplier Qualification Report"

  # Intake — the form is auto-rendered from these definitions
  intake:
    audit_scores:
      type: table
      required: true
      label: "Audit scorecard — score each criterion 1 (poor) to 5 (excellent)"
      columns:
        - { name: criterion, type: string,  editable: false }
        - { name: weight,    type: number,  editable: false }
        - { name: score,     type: integer, validation: { min: 1, max: 5 } }
        - { name: notes,     type: string,  required: false }
      default_rows:
        - { criterion: "Quality management system",      weight: 0.25 }
        - { criterion: "On-time delivery history",       weight: 0.25 }
        - { criterion: "Financial stability",            weight: 0.20 }
        # … 3 more criteria

  # One section showing the per-field strategy mix
  sections:
    - id: audit_scorecard
      title: "Audit Scorecard"
      order: 2
      content:

        - type: table
          strategy: extractor
          source: audit_scores
          computed_columns:
            - { name: weighted_score, expression: "score * weight" }

        - type: field
          id: composite_score
          strategy: calculator
          expression: "sum(audit_scores[*].score * audit_scores[*].weight)"

        - type: field
          id: qualification_verdict
          strategy: classifier
          input: composite_score
          rules:
            - { condition: "composite_score >= 4.0", output: "Preferred" }
            - { condition: "composite_score >= 3.5", output: "Conditional" }
            - { condition: "composite_score >= 2.5", output: "Probationary" }
            - { condition: "composite_score <  2.5", output: "Rejected" }

        - type: narrative
          id: scorecard_summary
          strategy: narrative_llm
          prompt: |
            Write a 2–3 sentence scorecard summary paragraph.
            Composite score: {{composite_score}} / 5.00
            Verdict: {{qualification_verdict}}
            Lowest-scoring criterion: {{lowest_criterion_name}}
            Reference criterion names from the table; do not invent scores
            or weights not listed above.
          max_tokens: 180

  # Lookups, validation rules, and SLA thresholds follow the same shape —
  # see the full template files for the complete schema.
  lookup_sources:
    risk_disclosure_clause: >
      Risk assessment conducted in accordance with ISO 31000 principles.

  validation_rules:
    - id: score_weights_sum
      description: "Audit score weights must sum to 1.0"
      check: "sum(audit_scores[*].weight) == 1.0"
      severity: error
```

---

## 7. Stack

```
Frontend:   React + Vite
Backend:    FastAPI (Python)
Database:   Supabase (Postgres + pgvector for future grounded_llm use)
Auth:       Supabase Auth
Storage:    Supabase Storage (uploaded attachments)
Realtime:   Supabase Realtime (generation progress streaming to UI)
LLM:        OpenRouter (GPT-4o-mini default; Claude for harder narrative fields)
Tracing:    LangSmith (trace every field's strategy, inputs, outputs, retries)
Export:     Playwright/Chromium (PDF) + python-docx (DOCX)
Deployment: AWS EC2, Docker Compose, Nginx 
```

**Why React, not Streamlit.** The review UI — three-pane layout, hover-for-provenance,
inline edit with diff, field-level status badges, comments per field — is exactly
the kind of stateful complex interface Streamlit cannot do well. The review UI is
the differentiator; it gets the engineering budget. React + shadcn/ui matches the
existing DocChat stack.

**Frontend table libraries:** TanStack Table or AG Grid Community for the intake
form tables (scorecard, risk register, CAR table). react-hook-form + zod for form
validation (zod schemas derived from the template YAML).

---

## 8. UI structure

```
App
├── /templates          Browse and select a report template
├── /reports/new        Step 1 — Intake form (auto-rendered from YAML)
├── /reports/:id/generate  Step 2 — Generation progress (Supabase Realtime)
├── /reports/:id/review    Step 3 — Review UI (three-pane, field-level)
└── /reports/:id/export    Step 4 — Export (PDF / DOCX / JSON)
```

**Review UI three-pane layout:**
- Left pane: intake data summary (source of truth the engineer entered)
- Centre pane: draft report rendered with field-level status badges
  (draft / edited / approved) and strategy tags visible on hover
- Right pane: field metadata on hover — which strategy fired, what inputs were
  used, model confidence where applicable, regenerate button

Report cannot be exported until every required field is in `approved` status.

---

## 9. Backend structure

```
FastAPI
├── /templates          GET list, GET :id (load + validate YAML)
├── /reports            POST (create), GET :id, PATCH :id
├── /reports/:id/generate   POST (kick off async generation)
├── /reports/:id/fields/:field_id
│   ├── PATCH           (user edit — writes to audit log)
│   └── POST /regenerate (re-run generation for one field)
├── /reports/:id/validate   POST (run all validation_rules)
└── /reports/:id/export     POST (PDF / DOCX / JSON)

Core modules:
├── orchestrator.py     Reads template, routes each field to its strategy handler
├── strategies/
│   ├── lookup.py
│   ├── extractor.py
│   ├── calculator.py
│   ├── template_fill.py
│   ├── classifier.py
│   └── narrative_llm.py
├── validator.py        Runs validation_rules, returns structured results
├── audit_log.py        Immutable append-only log for all field events
└── exporters/
    ├── pdf.py          Playwright/Chromium
    └── docx.py         python-docx
```

---

## 10. Architectural decisions made

This is the summary table. For the full log — options considered, rationale, and
trade-offs for each decision — see [`DECISIONS.md`](./DECISIONS.md).

| # | Decision | Rationale |
|---|---|---|
| AD-001 | Strategy declared per field, not per section | Sections contain mixed field types; per-field routing is the only model that works cleanly |
| AD-002 | LLM share kept to ~25% of report | Maximise determinism; LLM only where prose from structured input adds genuine value |
| AD-003 | `classifier` output gates downstream `narrative_llm` inputs | Prevents model from asserting a verdict-inconsistent narrative |
| AD-004 | `calculator` fields are fully deterministic — no LLM call | Score, priority, next review date must be reproducible and auditable |
| AD-005 | Audit log is append-only and immutable | Regulatory and quality-controlled environments require full provenance |
| AD-006 | Report cannot export until all required fields are `approved` | Forces human review; prevents accidental export of draft fields |
| AD-007 | Image handling is `direct_input` in v1 | Engineer writes interpretation; LLM does not read images. Multimodal deferred to v2. |
| AD-008 | YAML-only template authoring in v1 | No visual editor; engineers edit YAML in IDE. Keeps scope tractable. |
| AD-009 | Templates are versioned; reports pin to a specific template version | Old reports always renderable against their original template |
| AD-010 | Generation is async and resumable; per-field failure does not abort the report | One failed field retries independently; rest of report continues |
| AD-011 | Stack locked to mirror DocChat | FastAPI + React + Supabase + OpenRouter + LangSmith + Docker + EC2. Cognitive efficiency; no new infrastructure to learn. |
| AD-012 | SQR is the primary demo template for v1 | Universal domain, rich field-type variety, `classifier → narrative_llm` chain is architecturally interesting |
| AD-013 | Two full templates ship with the repo — SQR + SAT (revised) | Skeleton templates do not prove the engine generalises; two fully running templates with different strategy mixes do. NCR retained as skeleton card on the Templates page. See Decision 29. |

---

## 11. Build phases

| Phase | Scope |
|---|---|
| 1 — Engine + happy path | Template loader, intake form auto-rendered from YAML, sequential field generation, end-to-end pipeline |
| 2 — Review UI | Three-pane layout, field-level editing and regeneration, status tracking, immutable audit log |
| 3 — Eval framework | Synthetic test sets, field-level accuracy and time-to-approval scripts, prompt iteration with versioned history |
| 4 — Second template | Site Acceptance Test (SAT) — a second production template proving the engine generalises beyond SQR |
| 5 — Deployment | Containerised stack on AWS EC2 behind CloudFront, GitHub Actions CI/CD |

---

## 12. Author background

The author is an Industrial Engineer (MSc, Tampere University, 2025) with a
background in manufacturing operations and supply chain analytics, pivoting into
AI engineering. Provenance is the third in a portfolio of public projects:

- **Agentic-RAG-Chat (DocChat)** — agentic RAG application (FastAPI + React +
  Supabase + pgvector + OpenRouter + LangSmith, deployed on AWS EC2). The primary
  stack reference for this project.
- **Procurement Intelligence E2E** — full Microsoft Fabric pipeline on supply
  chain data. Same procurement domain as the SQR template.

Provenance extends the Agentic-RAG-Chat stack from a query system to a
generation system, applied to a reporting domain the author understands deeply
from industrial engineering experience.
