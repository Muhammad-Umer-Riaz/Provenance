# PROGRESS.md

Convention: `[ ]` = Not started  |  `[-]` = In progress  |  `[x]` = Completed  |  `[~]` = Dropped

---

## Module 1: Project Setup & Scaffold

- [ ] Create repo and folder structure
- [ ] Create `CLAUDE.md` (project-specific instructions for Claude Code)
- [ ] Initialize FastAPI backend skeleton (health check endpoint)
- [ ] Initialize React + Vite + Tailwind + shadcn/ui frontend skeleton
- [ ] Set up Supabase project (Postgres + Auth + Realtime + Storage)
- [ ] Write initial Supabase schema migration (templates, reports, report_fields, audit_log tables)
- [ ] Apply RLS policies on all tables
- [ ] Configure environment variables (`.env` pattern, `.env.example`)
- [ ] Implement YAML template file loading and basic validation on startup
- [ ] `git init` and initial commit

---

## Module 2: YAML Template Engine + Strategy Handlers

- [ ] Write YAML template parser with full schema validation
- [ ] Implement `orchestrator.py` — field routing and execution order logic
- [ ] Implement `lookup.py` strategy
- [ ] Implement `extractor.py` strategy
- [ ] Implement `calculator.py` strategy (safe expression evaluator)
- [ ] Implement `template_fill.py` strategy
- [ ] Implement `classifier.py` strategy
- [ ] Implement `narrative_llm.py` strategy (OpenRouter, Pydantic structured output, per-field retry)
- [ ] Wire LangSmith tracing on all field operations
- [ ] Write full SQR YAML template (all 6 sections, all fields, lookup dictionaries, validation_rules)
- [ ] Unit tests for deterministic strategies (calculator, classifier, lookup)

---

## Module 3: Intake Form UI

- [ ] Build field type → component mapping (string, number, integer, date, enum, multi_enum, table)
- [ ] Implement auto-rendered intake form from YAML `intake:` schema
- [ ] Set up react-hook-form + zod with validation schemas derived from YAML definitions
- [ ] Build TanStack Table component for scorecard input (6 rows, score 1–5)
- [ ] Build TanStack Table component for risk register input
- [ ] Build TanStack Table component for CAR input
- [ ] Build multi-select component for certifications (cert-pill display)
- [ ] Wire form submission to POST /reports
- [ ] Build `/templates` browse page
- [ ] Build `/reports/new` route and page

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
