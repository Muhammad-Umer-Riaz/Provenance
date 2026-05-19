# Provenance — Schema-Driven Report Generation Engine

A field-level orchestration system where most fields never call an LLM and every value is traceable to its inputs.

**Live demo:** [https://d4q93waqw2e37.cloudfront.net](https://d4q93waqw2e37.cloudfront.net)

> **Demo account:** `demo@provenance.app` / `testing123` — use this if you'd rather not sign up
> with a personal email. Reports created on this account are visible only to that user (row-level
> security) and may be wiped periodically.
>
> **If the server is offline:** I may have paused the EC2 instance to manage costs. Email me
> at muhammad.umer2149@gmail.com and I'll bring it back up within a day. The codebase
> remains fully functional for local or self-hosted deployment.

---

## Why Provenance

Structured industrial reports — supplier qualifications, site acceptance tests, audit reports, incident postmortems — get rewritten from scratch every time, despite having a stable template underneath. The variation is in the data, not the structure. The author spends judgment on prose and formatting rather than analysis, output drifts across reviewers, and an LLM tool that generates the whole document from one big prompt produces unverifiable text — a real risk in regulated and engineering-driven workflows.

Provenance is an end-to-end AI engineering project built to demonstrate a different orchestration pattern. Every field in every template declares a generation strategy. Most fields are deterministic — boilerplate `lookup`, intake `extractor`, arithmetic `calculator`, `template_fill` interpolation. The LLM is invoked only for the ~25% of fields where prose must be synthesised from structured inputs, and even then its prompt is anchored to specific numeric inputs and gated by a human review step before the report can be exported.

The system was built using spec-driven development with Claude Code as a pair programmer: each module started as a written plan in `.agents/plans/`, ran against a validation checklist, and was committed with a numbered entry in `docs/DECISIONS.md`. The constraint was deliberate — no LangChain, no LangGraph, no managed orchestration framework. Raw OpenAI-compatible SDK calls via OpenRouter, Pydantic for structured output, a custom orchestrator and per-strategy handlers throughout.

One production-quality template ships today — Supplier Qualification — running end-to-end through intake, generation, review, and export. A second template (Site Acceptance Test) has its YAML drafted to demonstrate the engine generalises across report shapes; full productionization (UI integration, eval coverage, demo polish) is planned for v2.

---

## Architecture

```
            YAML template          structured human input
                  │                          │
                  └────────────┬─────────────┘
                               ▼
                       orchestrator.py
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
        lookup           classifier         narrative_llm
       extractor         calculator         direct_input
                       template_fill
                               │
                               ▼
                   per-field audit_log row
                               │
                               ▼
                  validator (cross-field rules)
                               │
                               ▼
                   Review UI (3-pane, field-level)
                               │
                               ▼
                  approved → export (PDF / DOCX / JSON)
```

### Strategy taxonomy

Every field in every template declares exactly one strategy. The orchestrator reads it and routes accordingly.

| Strategy | What it does | Calls LLM? | Where used |
|---|---|---|---|
| `lookup` | Selects a fixed text block from a dictionary keyed on intake fields | No | Approval-conditions blocks (per verdict); regulatory disclaimers |
| `extractor` | Passes a user-entered value or table through verbatim (with optional computed columns) | No | All structured tables — scorecard, risk register, CAR table, test results |
| `calculator` | Computes deterministically from other fields using a safe expression evaluator | No | Composite score, weighted score per row, pass/fail counts |
| `template_fill` | Renders a fixed string with `{{field}}` interpolation | No | Report header line, simple structured prose |
| `direct_input` | Engineer types prose directly during intake; rendered as-is | No | Engineer-authored figure observations, free-text remediation notes |
| `classifier` | Maps a value to an enum that gates downstream logic | Rule-based, no LLM in v1 | `qualification_verdict` from `composite_score`; `test_verdict` from `fail_count` |
| `narrative_llm` | LLM writes a paragraph from structured field inputs, anchored to specific values | Yes | Scorecard summary, performance narrative, risk narrative, executive summary |
| `grounded_llm` | LLM with retrieval against a reference corpus | Reserved for v2 | — |
| `hybrid` | User fills rows; LLM proposes additions in `review_required` mode | Reserved for v2 | — |

Strategies are applied **per field**, not per section. A single section mixes a `narrative_llm` paragraph next to `extractor` table cells and `lookup` boilerplate.

### The classifier → narrative chain

The most architecturally interesting pattern in the engine. A `calculator` produces a composite score from the user's weighted inputs. A rule-based `classifier` maps the score to an enum verdict (Preferred / Conditional / Probationary / Rejected). A downstream `narrative_llm` field then writes prose anchored to specific scorecard rows **and** the verdict — both passed in as labelled prompt inputs. The model has no room to invent a score, a weight, or a verdict.

This is the difference between *"generate a scorecard summary"* and *"summarise these six rows into a paragraph that mentions this verdict."*

---

## Templates Shipped

One template runs end-to-end on the engine today; a second is YAML-drafted to prove the engine generalises across report shapes.

| Template | Fields | Engineer-typed | LLM-written | Auto-generated | Status |
|---|---|---|---|---|---|
| **Supplier Qualification Report** | 47 | 1 | 8 | 38 | Production |
| **Site Acceptance Test** | 24 | 0 | 5 | 19 | YAML drafted — v2 productionization |

"Engineer-typed" counts fields that use the `direct_input` strategy specifically — free-text prose with no template and no LLM. The drafted SAT YAML has none: the engineer's observation prose on each figure is routed through `extractor` (a passthrough) so it can feed into a `narrative_llm` synthesis downstream. Both templates still depend heavily on engineer-entered structured data (audit scores, test results, deviations) — that data passes through `extractor` strategy and is counted under "auto-generated" alongside lookups, calculators, and classifiers.

The Supplier Qualification Report is the production template — 4-tier verdict driven by a weighted audit scorecard, risk register with computed priority scores, CAR table, and six LLM-written narrative paragraphs gated by the verdict classifier. The Site Acceptance Test YAML exercises a different strategy mix to prove the pattern generalises: per-row pass/fail aggregation on a parametric test-results table, a verdict from `fail_count`, and a structured-numerics-plus-engineer-prose pattern for figure narratives. A Non-Conformance Report card sits alongside it as a placeholder showing the Templates page is extensible — the full builds (intake flow, eval coverage, demo polish) are v2 work.

---

## Walkthrough

A four-frame summary of the SQR flow. For the long-form end-to-end — every intake step, all three generation snapshots, and the review surface in detail — see [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md).

### 1. Pick a template

![Templates page — SQR is production-ready; SAT and NCR sit alongside](docs/images/screenshots/Template%20Page.png)

*The featured card surfaces the strategy mix before the user commits — `1 direct + 8 review + 38 auto`. SAT (drafted YAML) and an NCR placeholder card sit below, marking the engine's extensibility — full builds are deferred to v2. Recent drafts and reviews appear in the right pane for quick resumption.*

### 2. Fill the intake

![Audit Scorecard step — six weighted criteria; the Downstream panel shows the classifier chain](docs/images/screenshots/Page%204%20Intake%20Form.png)

*The intake form is auto-rendered from the template YAML — every field, validation rule, and conditional gate comes from the same file the generation engine reads. The right-side **Downstream** panel makes the architecture visible: this step's input feeds composite_score → verdict → audit narrative.*

### 3. Watch generation

![Generate page mid-stream — 24 of 47 fields complete; dependency order visible](docs/images/screenshots/Generate%20Page%20Mid%20%2824%20of%2047%29.png)

*Per-field execution loop running in the background. Most fields resolve in milliseconds — lookups, calculators, classifiers. The LLM is invoked only for the six narrative paragraphs, and those run after their classifier dependencies clear. Per-field progress streams to the frontend via Supabase Realtime.*

### 4. Review field-by-field

![Review UI — three-pane layout, strategy badges, 47/47 approved gate](docs/images/screenshots/Review%20UI%20Page%20All%20Approved.png)

*Three panes: intake summary left, generated report centre, field metadata right. Each field surfaces its strategy as a badge and can be edited inline (diff captured to the audit log) or regenerated with optional natural-language guidance. The `47/47 approved` counter at top is the export gate — enforced server-side, not just the button state.*

---

## Evaluation

A custom eval framework in `eval/` covers deterministic field accuracy and LLM narrative groundedness across 15 synthetic SQR test cases.

| Metric | Result | Target | Status |
|---|---|---|---|
| Deterministic field accuracy | **100%** (105/105) | exact match | ✅ |
| Narrative groundedness (mean) | **3.97** / 5.00 | ≥ 3.50 | ✅ |
| First-pass approval rate | **95.7%** (45/47) | — | — |
| Mean regenerations per field | 0.021 | — | — |
| Mean edits per field | 0.021 | — | — |

**Baseline → v1.1.** The first eval run produced mean groundedness 3.17 — failing the threshold. Two weak fields were named explicitly: `scorecard_summary` (2.00) and `risk_narrative` (2.20). Module 8 applied targeted prompt fixes — per-criterion row anchoring on `scorecard_summary`, explicit likelihood × impact and mitigation-faithfulness constraints on `risk_narrative`, individual CAR row feeding on `car_summary`. Re-run produced mean **3.97** with `risk_narrative` jumping +2.73 and `car_summary` jumping +1.73. Every change is documented per-field with before/after scores in [`eval/PROMPT_HISTORY.md`](eval/PROMPT_HISTORY.md).

One field (`scorecard_summary`) is still at 2.20 against a 3.0 per-field floor. This is documented as a judge-metric limitation: the v1.1 prompt feeds individual criterion rows correctly, but the judge consistently scores summaries that lean on aggregate signals (lowest criterion) as lower-grounded than ones that name every row.

Full results: [`eval/BASELINE.md`](eval/BASELINE.md)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite + Tailwind + shadcn/ui |
| Tables & forms | TanStack Table, react-hook-form, zod |
| Backend | Python 3.11 + FastAPI + Pydantic |
| Expression evaluator | simpleeval (sandboxed eval for `calculator` and validation rules) |
| Database | Supabase — Postgres, Auth, Realtime, Row-Level Security |
| LLM | OpenRouter — GPT-4o-mini (classifier fallback), Claude Haiku 4.5 (narrative + judge) |
| Observability | LangSmith tracing on every field operation |
| Export | Playwright/Chromium (PDF), python-docx (DOCX), native JSON |
| Rate limiting | slowapi (in-memory per-IP) |
| Deployment | AWS — S3 + CloudFront (frontend), ECR + EC2 + Nginx (backend) |
| CI/CD | GitHub Actions — Docker build → ECR push → SSH deploy → S3 upload → CF invalidation |

**Notable choices:**
- **No LLM framework** — no LangChain, no LlamaIndex. Raw OpenAI-compatible SDK via OpenRouter; Pydantic handles structured output validation directly.
- **simpleeval** for `calculator` and `validation_rules` so users can write Python-ish expressions in YAML without granting them `eval()`.
- **Playwright over WeasyPrint** for PDF so the exported file is a pixel-perfect match to the Review UI centre pane. No separate PDF template to drift against.
- **Split deployment** — frontend on S3 + CloudFront, backend on EC2 behind a second CloudFront distribution. Two AWS architectures in one project; rationale in [`docs/DECISIONS.md`](docs/DECISIONS.md) §30.

---

## Repository Structure

```
backend/
├── app/
│   ├── routes/         reports, fields, generation, export, health
│   ├── strategies/     lookup, extractor, calculator, template_fill,
│   │                   classifier, narrative_llm (one file per strategy)
│   ├── templates/      YAML loader + validator
│   ├── orchestrator.py field routing + execution order + dispatch_single
│   ├── validator.py    cross-field validation_rules engine
│   ├── audit_log.py    append-only per-field event log
│   ├── pdf_renderer.py Playwright/Chromium async wrapper
│   └── limiter.py      slowapi instance
└── tests/              pytest suite

frontend/src/
├── components/
│   ├── forms/          IntakeWizard + 5 step components
│   ├── review/         3-pane Review UI components
│   └── ui/             shadcn/ui base
├── pages/              Templates, NewReport, Reports, Generate, Review
├── context/            AuthContext (Supabase Auth)
└── lib/                apiFetch, supabase client

templates/
├── supplier-qualification-report.yaml    6 sections, 47 fields, 6 validation rules
└── site-acceptance-test.yaml             6 sections, 24 fields, 4 validation rules

eval/
├── field_accuracy.py   deterministic exact-match + LLM-judge groundedness
├── time_to_approval.py audit_log regen/edit counts per field
├── compare_runs.py     prompt regression diff utility
├── test_sets/          synthetic SQR + SAT test cases
├── results/            timestamped JSON results
├── BASELINE.md         frozen baseline + v1.0 → v1.1 delta
└── PROMPT_HISTORY.md   per-field prompt iteration log

supabase/migrations/    initial schema + RLS policies
nginx/                  reverse proxy config for EC2
.github/workflows/      deploy.yml (path-filtered CI/CD)
docs/
├── ARCHITECTURE.md     strategy taxonomy, SQR field anatomy, YAML pattern
├── DECISIONS.md        30+ numbered architectural decisions
├── PRD.md              module-by-module product spec
├── STATUS.md           build status, validation results, known issues
├── WALKTHROUGH.md      long-form end-to-end flow
└── images/             screenshots used in README and walkthrough
.agents/plans/          per-module spec files (10 numbered plans)
```

`.agents/` is intentionally public. The numbered plans document the spec-driven workflow used to build each module.

---

## Running Locally

**Prerequisites:** Python 3.11+, Node 20+, a Supabase project, an OpenRouter API key.

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate              # macOS / Linux
# venv\Scripts\activate                Windows
pip install -r requirements.txt
playwright install chromium           # for PDF export
cp .env.example .env                  # fill in Supabase + OpenRouter keys
uvicorn app.main:app --port 8080 --reload

# Frontend — separate terminal
cd frontend
npm install
cp .env.example .env                  # Supabase URL + anon key
npm run dev
```

Apply the database migrations in `supabase/migrations/` to your Supabase project via the SQL editor — RLS policies are included.

Or run both servers at once (Mac/Linux/Git Bash):
```bash
bash start.sh
```

Health check: `GET http://localhost:8080/` returns `{"status": "ok"}`.

---

## Development Methodology

Each module followed the same loop:

1. **Plan** — write a numbered spec in `.agents/plans/` with problem statement, implementation steps, complexity rating, and a validation checklist.
2. **Build** — implement against the spec with Claude Code as a pair programmer (writing code, running browser tests via Playwright MCP, debugging).
3. **Validate** — work through the checklist; browser-test the golden path and edge cases.
4. **Document** — update `docs/STATUS.md` with results; add a numbered entry to `docs/DECISIONS.md` for any architectural choice that required a trade-off.

10 numbered plans live in `.agents/plans/`, one per module. The "no LangChain, no orchestration framework" constraint was deliberate — building the strategy handlers, the per-field dispatch, the audit log, and the validator from scratch makes the internals legible in a way that framework wrappers obscure.

---

## Limitations

Real constraints, documented honestly:

- **Rate limits are in-memory** — slowapi keeps per-IP counters in the FastAPI process; a restart wipes them. Not suitable for production without Redis or a persistent store.
- **Generation can stick mid-flight** — if the background generation task crashes between field operations, the report sits in `generating` status with no automatic recovery. A user has to delete the report and start over.
- **`scorecard_summary` groundedness** — at 2.20 against a 3.0 per-field floor. Output quality is acceptable; the judge metric over-penalises aggregate-anchored summaries. Documented in `eval/PROMPT_HISTORY.md`.
- **`hybrid` and `grounded_llm` strategies** — declared in the taxonomy and reserved for v2; not implemented in v1.
- **YAML-only template authoring** — adding a template means writing a `.yaml` file in an IDE. No visual editor in v1.
- **EC2 free tier** — the t3.micro backend instance may cold-start slowly after periods of inactivity.

---

## Vision — Where This Goes Next

The v1 engine establishes the platform pattern. The natural extensions push it from *"an engine that runs hand-authored YAML templates"* toward *"a platform where anyone can build a regulated report workflow."*

### 1. AI-assisted template creation

The headline v2 direction. Today, adding a new template means writing a YAML file by hand — out of reach for the procurement managers, quality engineers, and operations leads who actually own these report formats. The natural next step is a Template Builder UI that sits *before* the Templates page: a non-developer describes their report in natural language ("I need an incident postmortem with these five sections — the executive summary should be LLM-written, the timeline is structured input, the root-cause section needs an LLM narrative anchored to the contributing factors I'll list"), and the system drafts a YAML template, surfaces which sections it routed to which strategies, and lets the user iterate before saving. The same engine runs the resulting template — no code change. The platform thesis is only fully realised once the engineer is removed from the authoring loop.

### 2. Visual reports — image ingestion with engineer commentary

Industrial reports lean heavily on images: uniformity maps, instrument plots, vibration spectra, microscope captures. Provenance v1 deliberately does not feed the image itself to an LLM — the SAT figure-narrative pattern uses structured numerics plus an engineer observation field instead, to avoid an LLM inventing a measurement from a colour-coded chart. The v2 path is an opt-in `image_narrative` strategy: the engineer uploads the image *and* writes a short interpretive note, the LLM receives both with a vision model call, and the synthesised paragraph is gated by the engineer's observation as the source of truth. Vision-derived claims would carry their own provenance row in the audit log.

### 3. Tabular intake via query agent

Several fields in a real-world SQR or SAT would more naturally come from a spreadsheet or upstream system than from manual entry — supplier scorecards exported from an ERP, test results dumped from instrument software, audit records from a quality-management database. The v2 extension is a structured-data lookup pattern: the user attaches a CSV, XLSX, or live data source to a template, and a query agent populates the intake fields by translating the template's data needs into SQL-like queries against the uploaded table. The intake form remains the surface (so the engineer still reviews and edits), but the form arrives pre-filled, not blank.

Together, these three remove the developer from template authoring, extend the engine to visual data, and replace manual data entry with structured-source lookups. Each one is a multi-week project on its own — the v1 architecture is what makes any of them tractable.

---

## Architectural Decisions

30+ numbered decisions are recorded with rationale, alternatives, and trade-offs in [`docs/DECISIONS.md`](docs/DECISIONS.md). Three worth highlighting:

- **Strategy declared per field, not per section** (AD-001) — sections mix strategies in practice; per-field routing is the only model that works. Section-level routing would force the worst-case strategy (`narrative_llm`) across every field in the section, losing determinism everywhere it isn't needed.

- **LLM share kept to ~25%** (AD-002) — the LLM earns its place only where prose-from-structured-input genuinely adds value. The other ~75% is deterministic. This is what makes the system auditable, reproducible, and cheap.

- **Classifier output gates downstream narrative inputs** (AD-003) — the verdict is computed by the classifier and passed as a labelled input to the `narrative_llm` prompt. The model cannot re-interpret or contradict the computed verdict in its prose. This is the architectural backbone of `classifier → narrative_llm` chaining.

---

## Related Work

A handful of tools exist in adjacent spaces. The architectural difference is worth naming because it determines fit.

**Vertical postmortem tools** — incident.io, Rootly, AlertOps "Agent Chronicle," ilert — pull context automatically from upstream systems (Slack timelines, PagerDuty events, Jira tickets, PR diffs). Their value proposition is *"you don't have to type anything."* That works where upstream context lives in machine-readable form.

**Quality / NCR workflow tools** — Process Street "Cora," Cassidy AI, Tulip "Quality Report Agent" — focus on workflow automation around the report (CAPA routing, approver chains, KPI rollups). Less emphasis on the generation logic, more on the process plumbing.

**Generalist document generation** — Templafy, Siav.AI, Fonic.ai — target enterprise Office 365 environments with locked-down templates and non-technical end users. Templates are managed centrally, not authored as code.

Provenance is structurally different on two axes: it assumes context arrives as **structured human input**, not a Slack scrape, and it exposes **field-level orchestration with per-field provenance**. None of the tools above expose the generation strategy per field, the audit trail per field, or the eval framework per strategy. That makes Provenance a better fit for regulated, engineering-driven workflows — supplier qualification, capital equipment acceptance, materials testing — where the input lives in instrument exports and audit checklists rather than chat logs.

---

## Project Documents

The README is the entry point. For depth:

- [`docs/PRD.md`](docs/PRD.md) — module-by-module product spec and success criteria
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — full strategy taxonomy reference, SQR field anatomy, YAML pattern
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — 30+ architectural decisions with rationale and rejected alternatives
- [`docs/STATUS.md`](docs/STATUS.md) — build status per module, validation results, known issues
- [`docs/WALKTHROUGH.md`](docs/WALKTHROUGH.md) — long-form end-to-end flow
- [`eval/BASELINE.md`](eval/BASELINE.md) — frozen baseline run, per-field scores, v1.0 → v1.1 delta
- [`eval/PROMPT_HISTORY.md`](eval/PROMPT_HISTORY.md) — per-field prompt iteration log

---

## Author

**Muhammad Umer Riaz** — muhammad.umer2149@gmail.com

Industrial Engineer (MSc, Tampere University) with a background in manufacturing operations and supply chain analytics, building AI engineering applications grounded in regulated, engineering-driven domains.

Related public portfolio:
- **Agentic-RAG-Chat (DocChat)** — agentic RAG document intelligence app: [github.com/Muhammad-Umer-Riaz/Agentic-RAG-Chat](https://github.com/Muhammad-Umer-Riaz/Agentic-RAG-Chat)
- **Procurement Intelligence E2E** — full data pipeline on Microsoft Fabric: [github.com/Muhammad-Umer-Riaz/Procurement_Intelligence_E2E_Microsoft_Fabric](https://github.com/Muhammad-Umer-Riaz/Procurement_Intelligence_E2E_Microsoft_Fabric)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
