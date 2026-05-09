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

### 3.0 — Core intake wizard (original)

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

### 3.1 — UI overhaul (design implementation)

**Backend additions:**
- [x] `PATCH /api/reports/{id}` — autosave endpoint; accepts partial `intake_data` update and optional status transition to `generating`
- [x] `DELETE /api/reports/{id}` — ownership-verified delete endpoint
- [x] `GET /api/templates/` extended — now returns `strategy_counts`, `section_count`, `field_count` per template (computed from loaded YAML sections)
- [x] `GET /api/reports/` extended — now returns `updated_at`, `score: null`, `verdict: null` per report; orders by `updated_at` desc
- [x] `POST /api/reports/` response extended — now includes `updated_at`, `score`, `verdict`

**Intake wizard redesign:**
- [x] Layout split into main form (flex-1) + right sidebar (w-64) — sidebar always visible
- [x] `IntakeSidebar` component: three stacked panels — THIS STEP (contextual description), PROGRESS (live per-step X/Y field counts), DOWNSTREAM (what this step feeds)
- [x] `FieldGroup` component: `§ 01 / § 02 / § 03` section grouping with tag badges within each step
- [x] Field label redesign: label + `req`/`opt` monospace badge + field ID hint right-aligned — applied to StringField, NumberField, IntegerField, EnumField
- [x] Breadcrumb above step bar: `reports › new › {template_id} › {supplier_name} · draft` — supplier name updates live as user types
- [x] Step progress bar redesigned — numbered circles connected by horizontal lines; completed steps show checkmark; current step filled
- [x] Bottom status bar: `← Back` | contextual status message | `Next: {StepName} →`
- [x] Step-specific status messages: steps 1–3 show "X of Y required filled"; step 4 shows score count + weight sum; step 5 shows risk/CAR count + submit readiness
- [x] `AutosaveIndicator` component: `● autosaved · Xs ago` / `● saving...` with 10s refresh interval
- [x] Step 2 qualification type: replaced EnumField dropdown with three radio-card layout (Initial / Re-qualification / For-cause), each with subtitle
- [x] Step 2 conditional section: info callout box explaining n/a handling
- [x] Step 4 audit scorecard: replaced editable table with inline `ScoreButtons` (1–5 button row per criterion) + weight editable + footer showing ∑ weights and live preview score
- [x] Step 5 risk cards: `RISK_REGISTER[n]` header tag + `HIGH/MEDIUM/LOW · PRIORITY N` badge (auto-calculated from likelihood × impact); X button to remove
- [x] Submit button: green "Submit report →" on step 5; PATCHes existing draft with `status: generating` instead of creating a new POST

**Draft management — localStorage + lazy backend:**
- [x] Removed on-mount draft creation (was creating phantom empty records on every wizard open)
- [x] Backend draft created lazily: only when user clicks "Next" on step 1 (after validation passes)
- [x] Form state persisted to `localStorage` at key `draft:{template_id}` on every field change — survives browser refresh
- [x] Draft ID stored alongside form state in localStorage; restored on wizard re-open so same backend record is reused
- [x] Edit mode: wizard accepts `editReport: { id, intake_data }` via navigation state; skips localStorage entirely; pre-populates form from existing report data; breadcrumb badge shows "editing"
- [x] On submit: localStorage cleared for that template slot

**Templates page redesign:**
- [x] Greeting header: "GOOD MORNING/AFTERNOON/EVENING, {FIRSTNAME}" + "Start a report" heading
- [x] `Jump to ⌘K` button opening `CommandPalette` stub overlay (Ctrl+K / Cmd+K global shortcut; closes on Escape)
- [x] Featured SQR card: template ID + version + PRODUCTION badge; description; "WHAT YOU'LL DO" label with direct/review/auto counts
- [x] `StrategyBar` component: proportional colour bar + plain-English legend bucketed into "You fill in" / "Auto-generated" / "AI writes" (replaces technical strategy name labels)
- [x] START FRESH panel: "Begin new SQR" button + "Continue draft · {supplier_name}" link (reads from localStorage, not backend — no API call)
- [x] YOUR RECENT panel: last 3 non-draft reports with status dot + relative time
- [x] OTHER TEMPLATES section: 2 hardcoded SKELETON cards (NCR Non-Conformance Report, SAT Site Acceptance Test) with disabled Begin buttons
- [x] Footer: strategy count + schema version + "request a new template →"

**Reports page redesign:**
- [x] Full layout: left `FilterSidebar` (w-48) + main content (flex-1)
- [x] `FilterSidebar`: Status filters (All/Draft/Generating/In review/Approved/Exported with counts), Template section (SQR), Evaluator section (derived from `intake_data.evaluator_name`, deduplicated with counts)
- [x] Table columns: ID (`rpt_xxxxxxx` short ref) | SUBJECT (supplier bold + evaluator + country/category) | TPL badge | SCORE (`—` until Module 4) | VERDICT (`—` until Module 4) | STATUS (styled badge) | UPDATED (relative time) | ACTIONS
- [x] Client-side search by supplier name or ref ID
- [x] Pencil (edit) icon: navigates to wizard in edit mode with report's intake_data pre-loaded
- [x] Trash (delete) icon: confirmation dialog → DELETE API → optimistic row removal
- [x] `apiFetch` fixed to handle HTTP 204 No Content (DELETE was silently failing because `res.json()` threw on empty body)

**Polish:**
- [x] App name: "provenance" → "Provenance" across all nav bars
- [x] "sign out" → "Sign out" across all nav bars
- [x] "jump to" → "Jump to" on Templates page
- [x] Warm cream background (`oklch(0.977 0.007 80)`) replacing pure white
- [x] Global h1/h2 CSS moved out of unlayered scope (removed 56px h1 size and broken `--text-h` colour that rendered invisible in OS dark mode); Tailwind utilities now control heading sizes and `--foreground` controls colour
- [x] `text-align: center` on `#root` corrected to `left`
- [x] Filter sidebar section labels (Status, Template, Evaluator) made muted-weight instead of bold

**Bugs fixed during 3.1:**
- Draft explosion: on-mount `POST /api/reports/` ran on every wizard open → dozens of empty draft rows. Fixed by lazy creation on step-1 Next click.
- Ghost h1/h2 text: global CSS set `color: var(--text-h)` which resolves to `#f3f4f6` (near white) when OS prefers dark mode, making headings invisible against light background. Fixed by removing `--text-h` reference entirely.
- Delete row not disappearing: DELETE returns 204 No Content; `apiFetch` called `res.json()` on the empty body → threw → catch block suppressed it → `setReports` filter never ran. Fixed by checking `res.status === 204` before calling `.json()`.
- Backend uvicorn command: `uvicorn main:app` fails because entry point is `app/main.py`; correct command is `uvicorn app.main:app --port 8080 --reload`.

---

## Module 4: Generation Pipeline + Audit Log — [x] COMPLETE

- [x] Implement POST /reports/:id/generate (async background task via FastAPI BackgroundTasks)
- [x] Build per-field execution loop with isolated failure handling — orchestrator `_process_field_safe` wraps each field; one failure does not abort the report
- [x] Implement Supabase Realtime events on each field (pending → generating → draft/failed) via Postgres Changes on `report_fields` (REPLICA IDENTITY FULL)
- [x] Implement `validator.py` — evaluates template `validation_rules` post-generation with simpleeval; results stored as `validation_warnings` JSONB on reports
- [x] Implement `audit_log.py` — append-only insert per field event (field_id, strategy, inputs_snapshot, output_value, model, timestamp)
- [x] Build `/reports/:id/generate` progress UI page — section-grouped expandable cards; live status icons; overall progress bar
- [x] Wire Realtime subscription — field channel (postgres_changes on report_fields) + report channel (status=review triggers auto-redirect to /reports/:id/review)
- [x] Migration: added score (float4), verdict (text), validation_warnings (jsonb) to reports table
- [x] GET /api/reports/:id — new endpoint for generate page initial load
- [x] GET /api/reports/:id/fields — seeds progress page with initial pending rows
- [x] GET /api/reports/ — now returns real score/verdict from DB (was hardcoded null)
- [x] Orchestrator: added on_field_start / on_field_complete callbacks to generate(); existing callers unaffected
- [x] Intake wizard submit: now navigates to /reports/:id/generate instead of /reports
- [x] Supabase publication: added report_fields and reports to supabase_realtime publication (required for Postgres Changes)
- [x] Intake wizard submit: removed status:'generating' from PATCH (generate endpoint owns status transition)
- [x] Idempotency fix: POST /generate skips task only if report_fields rows already exist (not just on status='generating')
- [x] Realtime channel fix: removeExisting() before subscribe to handle React double-mount / stale channels
- [x] GeneratePage race condition fix: re-fetch after subscribing to catch events fired before subscription was ready; useEffect for redirects (not inside state setters)

**Bugs found during validation (all fixed):**
- Supabase tables not in realtime publication → Realtime events never fired. Fixed by `ALTER PUBLICATION supabase_realtime ADD TABLE report_fields, reports`.
- Wizard PATCH set status='generating' before POST /generate → idempotency check blocked task from ever starting. Fixed by removing status from wizard PATCH.
- `navigate()` called inside React state setter updater → "Cannot update component while rendering" crash. Fixed by moving redirect logic to dedicated useEffect hooks.
- Race condition: background task could complete between initial fetch and Realtime subscription setup → page stuck at 0/0. Fixed by re-fetching after subscribing and checking fresh report status.
- Supabase channel reuse error: stale channel from previous render triggered "cannot add postgres_changes callbacks after subscribe()". Fixed by removing existing channel before creating new one.

**Validation results (10 May 2026):**
- V1 ✓ score/verdict/validation_warnings columns confirmed in DB
- V2 ✓ audit_log rows inserted per field (36 draft + 11 failed = 47 total)
- V3 ✓ validator.py produced warnings stored in reports.validation_warnings
- V4 ✓ 46 backend tests pass after orchestrator changes
- V5 ✓ POST /generate returns 202; all 47 fields created; reports.status=review; score=3.9; verdict=Conditional
- V6 ✓ 11 fields failed; remaining 36 continued; report reached review status
- V7 ✓ POST /generate with existing fields returns early without new task
- V8 ✓ Realtime streaming confirmed — progress page showed 12/47 live within seconds
- V9 ✓ Auto-redirect confirmed — page navigated to /reports/:id/review on completion (route stub pending Module 5)
- V10 ✓ validation_warnings populated with 6 rule results
- V11 ✓ Reports list shows score=3.9, verdict=CONDITIONAL on completed report
- V12 ✓ Templates, Reports CRUD, intake wizard all unaffected

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
