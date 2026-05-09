# PROGRESS.md

Convention: `[ ]` = Not started  |  `[-]` = In progress  |  `[x]` = Completed  |  `[~]` = Dropped

---

## Module 1: Project Setup & Scaffold

- [x] Create repo and folder structure
- [x] Create `CLAUDE.md` (project-specific instructions for Claude Code)
- [x] Initialize FastAPI backend skeleton (health check endpoint)
- [x] Initialize React + Vite + Tailwind v4 + shadcn/ui frontend skeleton
- [x] Set up Supabase project (Postgres + Auth + Realtime + Storage) — project "Provenance" (jfatwkbebcuqgpawwotp) confirmed active
- [x] Write initial Supabase schema migration (templates, reports, report_fields, audit_log tables)
- [x] Apply RLS policies on all tables (in migration file)
- [x] Configure environment variables (`.env` pattern, `.env.example`)
- [x] Implement YAML template file loading and basic validation on startup
- [x] Link Supabase CLI and push migration — all 4 tables confirmed present; SQR template row seeded
- [x] `git init` and initial commit — committed planning files (fe1de2d)

---

## Module 2: YAML Template Engine + Strategy Handlers

- [x] Write YAML template parser with full schema validation
- [x] Implement `orchestrator.py` — field routing and execution order logic
- [x] Implement `lookup.py` strategy
- [x] Implement `extractor.py` strategy
- [x] Implement `calculator.py` strategy (safe expression evaluator)
- [x] Implement `template_fill.py` strategy
- [x] Implement `classifier.py` strategy
- [x] Implement `narrative_llm.py` strategy (OpenRouter, Pydantic structured output, per-field retry)
- [x] Wire LangSmith tracing on all field operations
- [x] Write full SQR YAML template (all 6 sections, all fields, lookup dictionaries, validation_rules)
- [x] Unit tests for deterministic strategies (calculator, classifier, lookup)

---

## Module 3: Intake Form UI

- [x] Build field type → component mapping (string, number, integer, date, enum, multi_enum, table)
- [x] Implement auto-rendered intake form from YAML `intake:` schema
- [x] Set up react-hook-form + zod with validation schemas derived from YAML definitions
- [x] Build TanStack Table component for scorecard input (6 rows, score 1–5)
- [x] Build risk register as card-per-row layout (replaced table — no horizontal scroll, each field has full room)
- [x] Build TanStack Table component for CAR input with auto-incremented CAR # on row add
- [x] Build multi-select component for certifications (cert-pill display)
- [x] Wire form submission to POST /reports — navigates to `/reports` on success; navigates to failing step with error message if validation blocks
- [x] Build `/templates` browse page
- [x] Build `/reports/new` route and page
- [x] Build `/reports` list page (supplier, template, status badge, created date)
- [x] Validation fully confirmed: end-to-end form → POST → Supabase → /reports list working (9 May 2026)
- [-] Delete report from `/reports` list — not yet started
- [-] Additional Module 3 polish (TBD)

**Bugs fixed during validation:**
- Enum fields showed raw zod type error instead of "Required" (`buildIntakeSchema.ts`)
- Table cell inputs lost focus after one character — root cause: `flexRender` wrapped changing closure references in `React.createElement`, causing unmount/remount on every keystroke. Fixed by calling cell render functions directly instead of through `flexRender`
- Number inputs (Weight, Score, Likelihood, Impact) couldn't enter decimals and had broken spinners — switched to `type="text"` with `inputMode` + input sanitisation
- Date inputs had browser native yyyy=0002 issue — switched to `type="text"` with `YYYY-MM-DD` placeholder
- Commodity category dropdown text clipped — fixed `SelectTrigger` `w-fit` → `w-full` and `SelectContent` width constraint
- Submit blocked silently when audit scores empty — added navigation to failing step with error message
- Backend returning Starlette plain-text 500 for POST (Starlette 0.41 exception handler regression) — replaced `@app.exception_handler(Exception)` with `@app.middleware("http")` wrapper
- Port 8000 permanently broken from session state — switched backend to port 8080, updated `frontend/.env`

---

## Module 4: Generation Pipeline + Audit Log

- [ ] Implement POST /reports/:id/generate (async background task)
- [ ] Build per-field execution loop with isolated failure handling and retry
- [ ] Implement Supabase Realtime events emitted on each field completion (field_id, status, value preview)
- [ ] Implement `validator.py` — runs template `validation_rules` post-generation
- [ ] Implement `audit_log.py` — append-only event recording (field_id, strategy, inputs snapshot, output, timestamp)
- [ ] Build `/reports/:id/generate` progress UI page (live field-by-field status via Realtime)
- [ ] Wire Realtime subscription in frontend progress page

---

## Module 5: Review UI

- [ ] Build three-pane review layout (left: intake summary / centre: draft report / right: field metadata panel)
- [ ] Implement field status badges (draft / edited / approved) with colour coding
- [ ] Add strategy tags visible on hover in centre pane
- [ ] Implement inline field edit with before/after diff display
- [ ] Implement per-field regeneration (POST /reports/:id/fields/:field_id/regenerate)
- [ ] Implement PATCH /reports/:id/fields/:field_id for user edits (writes to audit log)
- [ ] Implement export gate logic (export button enabled only when all required fields are `approved`)
- [ ] Build `/reports/:id/review` route and page

---

## Module 6: Export

- [ ] Implement POST /reports/:id/export endpoint (format: pdf / docx / json)
- [ ] Build WeasyPrint PDF renderer
- [ ] Build python-docx DOCX renderer
- [ ] Build JSON export (full report state: fields, strategies, approval status, audit trail)
- [ ] Build export UI page with format selector and file download
- [ ] Wire export approval gate in backend (block if any required field not `approved`)

---

## Module 7: Eval Framework

- [ ] Design synthetic SQR test set (all 3 verdict outcomes, all risk tiers, validation edge cases)
- [ ] Generate test set (minimum 15 cases, stored as JSON in `eval/test_sets/`)
- [ ] Implement `eval/field_accuracy.py` (deterministic fields: exact match; narrative_llm fields: LLM judge scoring)
- [ ] Implement `eval/time_to_approval.py` (regeneration count + edit count per field before approval)
- [ ] Run baseline eval and store results in `eval/results/`
- [ ] Document baseline scores and prompt iteration notes

---

## Module 8: Additional Templates

- [ ] Design NCR (Non-Conformance Report) template field-level strategy assignments
- [ ] Write NCR YAML skeleton
- [ ] Design SAT (Site Acceptance Test) template field-level strategy assignments
- [ ] Write SAT YAML skeleton
- [ ] Write `docs/template-authoring.md` guide (YAML schema, strategy selection rules, lookup dictionary structure)

---

## Module 9: Production Deployment & Polish

- [ ] Write Dockerfile for FastAPI backend
- [ ] Configure React production build → S3 bucket + CloudFront distribution
- [ ] Set up EC2 t3.small (Docker Compose + Nginx reverse proxy + HTTPS via Certbot)
- [ ] Write GitHub Actions CI/CD pipeline (push to main → build → push to ECR → SSH deploy to EC2)
- [ ] Add rate limiting middleware (slowapi — per-IP limits on generate and export endpoints)
- [ ] Populate `DECISIONS.md` with any remaining build decisions
- [ ] Write `README.md`
- [ ] Record demo walkthrough
