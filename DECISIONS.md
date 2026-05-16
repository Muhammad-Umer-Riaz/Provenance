# Architectural Decisions

This document records the key design choices made in building Provenance, the alternatives that were considered, and the reasoning behind each decision. The goal is to make the engineering trade-offs explicit rather than leaving them implicit in the code.

---

## 1. Strategy Declared Per Field, Not Per Section

**Options considered:** Per-section strategy (one strategy assigned to an entire section), per-field strategy (each field declares exactly one strategy)

**Chosen:** Per-field strategy

**Why:**

Sections contain mixed field types. Section 2 (Audit Scorecard) contains an `extractor` table, a `calculator` composite score, a `classifier` verdict, and a `narrative_llm` paragraph — all in the same section. Assigning one strategy per section would force the worst-case strategy (`narrative_llm`) across the entire section, losing determinism for every field that does not need it. The strategy taxonomy only works cleanly if routing is resolved at field granularity.

**Trade-off:** Per-field strategy means the orchestrator must read and process each field as an independent unit, which adds orchestration complexity compared to per-section routing. A per-section model would be simpler to implement but cannot produce the correct output mix.

---

## 2. LLM Share Kept to ~25% of the Report

**Options considered:** One large prompt generates the entire report, section-level LLM calls, field-level LLM only where prose is genuinely needed

**Chosen:** Field-level LLM only where prose is genuinely needed (~25% of fields)

**Why:**

Most of a typical industrial report is structurally identical across instances — boilerplate scope statements, passthrough table data, deterministic calculations. These fields do not require an LLM. Maximising determinism maximises reproducibility, auditability, and cost efficiency. An LLM is expensive, slow, and non-deterministic; it earns its place only where no deterministic alternative produces acceptable output — which is roughly the narrative paragraphs (~25% of the report by field count).

**Trade-off:** Mapping every field to the right strategy requires upfront design effort and discipline. A single-prompt approach is faster to prototype but is less trustworthy, more expensive to run, harder to audit, and makes per-field evaluation impossible.

---

## 3. `classifier` Output Gates Downstream `narrative_llm` Inputs

**Options considered:** `narrative_llm` fields receive raw numeric inputs only and infer the verdict themselves; `classifier` output is passed as an explicit input to downstream `narrative_llm` fields; `classifier` and `narrative_llm` run independently with no connection

**Chosen:** `classifier` output is a required input to downstream `narrative_llm` fields

**Why:**

Without the classifier output as an explicit input, the `narrative_llm` field must independently infer the verdict from raw scores. This creates two failure modes: the model may assert the wrong verdict in its prose, or it may assert verdict-inconsistent language even when it infers correctly. Passing the classifier output as an explicit input constrains what the model is allowed to assert — the verdict is not up for re-interpretation in the narrative. This is the `classifier → narrative_llm` chain: score → verdict → conditions → narrative all chain off the classifier result.

**Trade-off:** This creates an execution order dependency. The orchestrator must execute all `classifier` fields before the `narrative_llm` fields that reference their outputs. This adds scheduling complexity but is the only model that guarantees narrative-verdict consistency.

---

## 4. `calculator` Fields Are Fully Deterministic — No LLM Call

**Options considered:** Use an LLM to compute scores and dates (flexible, handles ambiguous inputs), use a rule engine, use pure deterministic expression evaluation in Python

**Chosen:** Pure deterministic expression evaluation

**Why:**

Composite score, risk priority, and next review date must be reproducible across runs and auditable. An LLM call for these fields would introduce non-determinism (model updates can change outputs even at temperature=0) and would make the values unverifiable. These fields are also inputs to downstream `classifier` and `narrative_llm` fields — non-determinism in a `calculator` field propagates uncertainty into all downstream fields that depend on it.

**Trade-off:** Expression evaluation requires a safe evaluator (not Python's raw `eval()`) to prevent injection. The expression vocabulary is constrained to a defined set of operations and field references. This is more complex to implement than a free-form Python eval but is the correct security boundary.

---

## 5. Audit Log Is Append-Only and Immutable

**Options considered:** Mutable log (rows can be updated or deleted), append-only log (only inserts; edits create new rows), no log (rely on current field state only)

**Chosen:** Append-only, immutable

**Why:**

Industrial and quality-controlled environments require full provenance. The audit log must be able to answer: "What was the original generated value? Who changed it? When? What did they change it to?" A mutable log cannot reliably answer these questions. An append-only log where each regeneration and each human edit creates a new row preserves the full history and makes the current state of a field the result of a queryable event sequence.

**Trade-off:** A field with many regenerations accumulates many audit rows. Reading the current value of a field requires selecting the most recent row. This is a standard event-sourcing pattern and is acceptable at the scale of a single report session.

---

## 6. Report Cannot Export Until All Required Fields Are `approved`

**Options considered:** Export any time (user manages their own review), export with a warning if draft fields exist, hard gate (export blocked by backend until all required fields are `approved`)

**Chosen:** Hard gate enforced by the backend

**Why:**

In a regulated procurement or engineering environment, an accidentally exported draft report could be acted upon. The approval gate is a system-level guarantee, not a UX suggestion — it is enforced in the backend (not just the frontend button state) and cannot be bypassed. It forces the engineer to explicitly approve every required field, creating a reviewable record that every value in the exported document was seen and accepted by a human.

**Trade-off:** Strict gating increases friction. If a field repeatedly fails to generate, the report is blocked. The escape valves are per-field retry, per-field regeneration from the review UI, and the `direct_input` strategy (engineer types the value manually).

---

## 7. Image Handling Is `direct_input` in v1

**Options considered:** LLM reads uploaded images and writes interpretation (multimodal), engineer writes interpretation directly (`direct_input`), images excluded entirely from v1

**Chosen:** `direct_input` — engineer writes their own interpretation; images are not passed to the LLM

**Why:**

Multimodal LLM calls on uploaded images are expensive, add latency, and introduce failure modes specific to image quality, format support, and visual hallucination. In v1, the engineer who conducted the site visit or audit has direct knowledge of what the images show. Having them write the interpretation as `direct_input` prose is more accurate, faster, and auditable. The architecture explicitly reserves the `grounded_llm` and multimodal path for v2.

**Trade-off:** Engineers must write image-related prose manually. This is the same overhead they have in the current manual process. The benefit (automatic multimodal interpretation) is deferred, not eliminated.

---

## 8. YAML-Only Template Authoring in v1

**Options considered:** Visual drag-and-drop template editor, form-based template editor, YAML-only in IDE

**Chosen:** YAML-only

**Why:**

A visual template editor is a significant engineering effort that would consume the development budget needed for the generation engine, review UI, and eval framework — the actual differentiators of this project. The target user for Provenance v1 is an engineer comfortable editing YAML in an IDE. YAML-only keeps scope tractable and forces the template schema to be well-defined — a prerequisite for any future visual editor.

**Trade-off:** Engineers must understand the YAML schema and strategy vocabulary to author new templates. This is addressed by the template authoring guide in Module 9. A visual editor is the natural v2 extension once the schema is stable and validated across multiple templates.

---

## 9. Templates Are Versioned; Reports Pin to a Specific Template Version

**Options considered:** Templates are mutable (editing the YAML retroactively affects all reports), templates are versioned (each report records the template version it was generated against)

**Chosen:** Versioned templates; reports pin to the version used at generation time

**Why:**

If a template YAML is updated — adding a field, changing a prompt, adjusting thresholds — existing reports generated against the old template must remain renderable and auditable. A report from Q1 2026 generated against template v1.0 cannot be re-rendered against template v1.2 without invalidating its audit trail and potentially changing the visible output. Version pinning is the correct default for any system operating in regulated or quality-controlled contexts.

**Trade-off:** Template versioning requires storing template snapshots alongside the template ID and referencing the pinned version from each report record. A mutable template is simpler to implement but makes historical reports unreliable.

---

## 10. Generation Is Async and Resumable; Per-Field Failure Does Not Abort the Report

**Options considered:** Synchronous sequential generation (blocking request, all fields or nothing), async all-or-nothing (non-blocking but aborts on any single failure), async per-field isolated (each field is an independent task; failures retry individually)

**Chosen:** Async per-field isolated

**Why:**

A 20-field report with one failed `narrative_llm` call should not require the entire report to be regenerated from scratch. Per-field isolation means the failed field retries (up to N attempts) while the remaining 19 fields complete normally. Supabase Realtime progress events keep the UI informed of each field's individual state. This design also enables per-field regeneration from the review UI without triggering a full report re-run.

**Trade-off:** Per-field isolation requires the orchestrator to track individual field state (pending / generating / completed / failed / retrying) and overall report completion. This is significantly more complex than a sequential all-or-nothing approach but is the only model that gives a useful user experience for long-running multi-field generation.

---

## 11. Stack Locked to Mirror DocChat

**Options considered:** New stack (Next.js, different backend, dedicated vector DB), partial reuse (same backend, different frontend), full stack reuse (FastAPI + React + Supabase + OpenRouter + LangSmith + Docker + EC2)

**Chosen:** Full stack reuse mirroring DocChat

**Why:**

Cognitive efficiency — every infrastructure decision made for DocChat carries over directly. There is no new deployment target to learn, no new database to configure, no new auth provider to integrate. The engineering budget stays in the application layer (the generation engine, the review UI, the eval framework) rather than the infrastructure layer. Supabase Realtime, which DocChat used for ingestion status, maps directly to generation progress streaming in Provenance.

**Trade-off:** Some DocChat stack choices (pgvector in Supabase) carry over even though Provenance has no vector search requirement in v1. These are dormant but not harmful. If the `grounded_llm` strategy is implemented in v2, pgvector is already available.

---

## 12. SQR Is the Primary Demo Template for v1

**Options considered:** Generic document template (invoices, contracts), HR-focused template (performance reviews), procurement-focused SQR, engineering-focused template (test reports, inspection reports)

**Chosen:** Supplier Qualification Report (SQR)

**Why:**

The SQR domain is universal across manufacturing, engineering, and operations companies — any hiring manager in these industries recognises the problem instantly. The SQR has rich field-level variety that exercises all v1 strategies: `lookup` boilerplate keyed on commodity type, `extractor` table data, `calculator` composite score and risk priority, `classifier` verdict and risk tier, `narrative_llm` paragraphs. The `classifier → narrative_llm` chain (score → verdict → conditions → narrative) is more architecturally interesting than a pure narrative system. The domain also connects directly to the Procurement Intelligence E2E portfolio project, reinforcing a coherent domain focus across projects.

**Trade-off:** A domain-specific template is more legible to procurement and operations hiring managers than a generic template but may feel niche to AI engineers without industrial context. The README frames the project around the engineering patterns, not the procurement domain.

---

## 13. Two Templates Ship With the Repo — SQR Full + SAT Full (revised 16 May 2026)

**Original decision (superseded):** Three templates — SQR full + NCR skeleton + SAT skeleton.

**Revised decision:** Two templates — SQR full + SAT full. NCR removed from Module 9 scope. See Decision 29 for the full rationale.

**Why the revision:**

A skeleton YAML with no prompts, no lookup dictionaries, and no validation rules does not prove the engine generalises — it proves only that fields can be listed. A reader who clones the repo and sees an 80%-empty YAML learns nothing about the orchestration, the prompt design, or the strategy mix. The "platform not tool" claim requires a second template that actually runs: intake form renders, generation executes, review UI works, export produces a document.

The SAT template (Site Acceptance Test) is built to full production quality — complete prompts, lookup dictionaries, validation rules, and a design document covering the full hypothetical implementation path. This is more compelling than two skeleton files. The NCR template remains documented as a future template with its strategy assignments described in Decision 29.

**Trade-off:** Two full templates instead of three means the NCR pattern is not demonstrated in running code. This is acceptable because: (1) the SAT template exercises a genuinely different strategy mix from the SQR; (2) the design document at `.agents/plans/9.sat-template.md` demonstrates the engineering thought process for what a third template would require; (3) the Templates page retains a skeleton NCR card as a visible signal of the planned roadmap.

---

## 14. PDF Export: Playwright/Chromium over WeasyPrint

**Options considered:** WeasyPrint, Playwright/Chromium headless browser, wkhtmltopdf (deprecated), ReportLab (programmatic, no HTML input)

**Chosen:** Playwright/Chromium

**Why:**

The review UI already renders the report as HTML in the centre pane. A headless Chromium instance renders the exact same HTML and produces a PDF that is a pixel-perfect match to what the engineer reviewed and approved. There is no separate PDF template to maintain — the HTML/CSS used for the review UI centre pane *is* the PDF template. Any styling change in the UI is automatically reflected in the export.

WeasyPrint requires system libraries (libcairo, libpango, libgdk-pixbuf) in the Docker image and does not always reproduce CSS faithfully; layouts that render correctly in a browser can differ in WeasyPrint. This creates a gap between what the engineer approved in the review UI and what appears in the exported PDF — a gap that undermines the approval gate.

**Trade-off:** The Playwright package with a Chromium binary adds approximately 150 MB to the Docker image. PDF generation spawns a browser process per export request, which is heavier than WeasyPrint's in-process rendering. At portfolio scale (low concurrent export requests) this is acceptable. python-docx remains the DOCX renderer — a headless browser cannot produce DOCX output.

**Windows implementation note:** On Windows, uvicorn runs on a `SelectorEventLoop` which does not support `asyncio.create_subprocess_exec` (required internally by Playwright). The PDF renderer must run Playwright in a dedicated thread with an explicit `asyncio.ProactorEventLoop()` via `ThreadPoolExecutor` + `loop.run_in_executor`. Calling `asyncio.run()` from a thread is insufficient because it respects the global loop policy, which may still be `SelectorEventLoop`. This is a Windows-only concern; Linux (Docker) uses the default `ProactorEventLoop` and does not require the thread workaround.

---

## 15. Per-Field Model Routing for LLM Strategy Fields

**Options considered:** Single model for all LLM fields (classifier and narrative_llm use the same model), per-field model routing (classifier uses a cheap fast model; narrative_llm uses a stronger model)

**Chosen:** Per-field model routing

**Why:**

`classifier` fields produce a constrained enum output (e.g. Approved / Conditional / Rejected) from a numeric input with explicit threshold rules. This is a simple mapping task — a small, fast, cheap model handles it correctly, and the constrained output schema limits hallucination risk regardless of model capability. `narrative_llm` fields produce multi-sentence professional prose that is the visible quality signal of the report; this is where model capability directly affects the output a human reads and approves.

Routing the cheap model to `classifier` and the stronger model to `narrative_llm` optimises quality-per-cost: narrative quality improves where it matters most, while classification cost stays minimal. The orchestrator already dispatches each field to its strategy handler — extending that dispatch to carry a model identifier is a natural fit, not a separate routing layer.

Default configuration: `classifier` → `openai/gpt-4o-mini`, `narrative_llm` → `anthropic/claude-haiku-4-5` (both via OpenRouter). Both are overridable via environment variables.

**Trade-off:** Two models mean two cost envelopes in LangSmith traces and two different response time profiles. Each strategy handler that calls an LLM (`classifier.py`, `narrative_llm.py`) needs to resolve its target model from config. A single model is simpler to configure and trace. The `.env.example` must document both model variables clearly to avoid silent misconfiguration.

---

## 16. Four-Tier Qualification Verdict

**Options considered:** Three tiers (Approved / Conditional / Rejected), four tiers with Probationary between Conditional and Rejected, four tiers with Preferred above Approved

**Chosen:** Four tiers — Preferred / Conditional / Probationary / Rejected — with thresholds ≥4.0 / ≥3.5 / ≥2.5 / <2.5 on the 1–5 composite score scale

**Why:**

The three-tier system collapses meaningfully different procurement actions into a single bucket. A score of 3.05 and a score of 3.90 both produce "Conditional" but require entirely different procurement responses — one is close to full approval, the other is close to rejection. Probationary adds a distinct state: existing purchase orders may continue, but no new orders without sign-off, and a 90-day remediation window is imposed. Preferred distinguishes strong suppliers (≥4.0) and signals strategic source candidacy, which matters for sourcing decisions beyond the qualification gate. Every tier maps to a concrete procurement action, which is reflected in the `approval_conditions_blocks` lookup and the `recommendation` narrative prompt.

**Trade-off:** Four verdict paths require four `approval_conditions_blocks` lookup entries, four branches in the `next_review_date` calculator, and a more complex `points_to_next_tier` expression. All downstream logic must handle four states instead of three. The `previous_verdict` intake field also enumerates all four tiers, so historical reports using the old three-tier system would need mapping if backfilled.

---

## 17. SLA Thresholds — Template Defaults with Per-Evaluation Intake Overrides

**Options considered:** Hardcoded literals in calculator expressions, template-level configurable block only, template defaults with per-evaluation intake override fields

**Chosen:** `sla_thresholds` block in the template YAML sets defaults; five optional intake fields (`otd_pass_target`, `defect_pass_target`, etc.) allow the evaluator to override the pass threshold per evaluation; watch thresholds remain template-only

**Why:**

Different suppliers operate under different contractual SLA terms. A standard logistics contract might require OTD ≥90%; a premium-tier contract might require ≥95%. Applying the same template-level threshold to every evaluation produces incorrect Pass/Watch/Breach classifications when the contractual bar differs. The evaluator knows the contractual pass target; the watch threshold is an internal early-warning signal, not a contractual term, and does not need per-evaluation customisation. Five `effective_pass` calculator fields resolve to the intake override if provided, otherwise fall back to the template default — keeping the rest of the computation chain unchanged.

**Trade-off:** Five additional intake fields add form length. Evaluators who do not know their contractual SLA or leave the fields blank will silently inherit the template defaults, which may not reflect their actual contract. Label text showing the default value (`blank = 90% default`) mitigates this. The watch threshold is not overridable per-evaluation, which means the watch zone width changes implicitly when a pass threshold is customised.

---

## 18. Qualification Type and Previous Period Context

**Options considered:** Single qualification type with no history fields, qualification type enum with previous verdict and score only, full previous-period context including performance metrics

**Chosen:** `qualification_type` enum (Initial qualification / Re-qualification / For-cause review), with optional `previous_verdict`, `previous_composite_score`, and three optional previous-period performance metrics (`prev_otd_rate_pct`, `prev_defect_rate_pct`, `prev_invoice_accuracy_pct`)

**Why:**

Re-qualification narratives are structurally different from initial qualifications. Without previous context, the LLM cannot produce a meaningful trend sentence — "improved from 3.4 to 3.8" vs. "first assessment at 3.8" are different reports. The three previous-period performance metrics (OTD, defect rate, invoice accuracy) enable trend direction calculator fields (`otd_trend`, `defect_trend`, `invoice_trend`) that feed the performance narrative. NCR count and NCR close time are excluded because point-in-time comparisons on those metrics carry less trend signal than rate-based metrics. All previous-period fields are conditional on `qualification_type != 'Initial qualification'` so the intake form stays clean for first-time qualifications.

**Trade-off:** Previous data is manually entered by the evaluator — there is no supplier registry or automatic history lookup in v1. The evaluator must retrieve the previous verdict and scores from the prior report before starting the form. A `suppliers` table with report history linkage is the v2 path to auto-population; the current schema supports this migration (supplier name is in `intake_data`, which can be used as a lookup key when a `suppliers` table is added).

---

## 19. Pre-Computed Calculator Fields for Complex Prompt Expressions

**Options considered:** Inline expressions evaluated mid-string inside `narrative_llm` prompt templates (e.g. `{{min(audit_scores, by=weighted_score).criterion}}`), pre-computed named `calculator` fields referenced by simple `{{field_id}}` tokens in prompts

**Chosen:** Pre-computed named `calculator` fields

**Why:**

Inline expressions inside prompt strings require the template engine to parse and evaluate arbitrary expressions mid-string at prompt-build time. They cannot be independently tracked in the audit log, are evaluated redundantly when referenced more than once in the same prompt, and make prompts harder to read. Named calculator fields (`lowest_criterion_name`, `otd_effective_pass`, `breach_count`, etc.) are computed once, stored as discrete `report_fields` rows, appear in the audit log with their own strategy, inputs, and output, and are referenced in prompts as simple tokens. This keeps prompt strings as readable lists of named values and extends the audit trail to every intermediate computation.

**Trade-off:** Each pre-computed field adds a row to `report_fields` and an entry to the audit log. A report with many pre-computed calculator fields has a longer audit trail. This is a feature, not overhead — the additional entries make the computation chain fully traceable. The only cost is slightly more YAML verbosity.

---

## 21. Risk Register: Structured Category Column + Free-Text Description

**Options considered:** Single free-text `risk_item` field for the full risk description; dropdown of categories only (no description field); separate `risk_category` enum column plus `risk_item` free-text description column

**Chosen:** `risk_category` enum (11 standard supply chain categories + "Other") as the first column, followed by a free-text `risk_item` description column

**Why:**

A purely free-text `risk_item` gives the narrative_llm no structural signal about the type of exposure — "only one supplier for valves" and "currency exposure on USD invoices" are both strings with no shared vocabulary. With `risk_category`, the LLM receives `[Single-source dependency]: only one certified supplier for valve assembly` in the prompt, allowing it to frame the risk type explicitly ("a single-source dependency risk that...") without guessing from prose. The category also enables downstream analytics in Module 7 eval and future trend reports: risk type distribution across evaluations becomes queryable at SQL level. Free text alone cannot support that aggregation.

**Why not category-only:** Risk categories are too broad for a meaningful narrative or CAR reference. The evaluator must be able to describe the specific instance ("only one approved supplier" vs. "supplier has exclusive IP rights"). Both fields are required.

**Trade-off:** The YAML template and frontend both define the 11 category values independently (no single source of truth). Acceptable at v1 scale; a `template.columns[n].values` API read could synchronise them in v2. Also adds a column to the risk register table, making Step 5 wider — mitigated by the table's horizontal scroll wrapper.

The 11 categories: Single-source dependency, Financial instability, Geopolitical / country risk, Quality capability gap, Capacity constraint, Lead time variability, IP / data security, Regulatory / compliance, Currency / FX exposure, Force majeure, Other.

---

## 20. Rule-Based Classifier When Explicit Threshold Rules Are Provided

**Options considered:** Always call LLM for `classifier` fields (consistent with the strategy name), use rule engine when `rules:` are defined in the YAML and LLM only as fallback, always use rule engine (no LLM for any classifier)

**Chosen:** Rule-based evaluation when the field definition includes explicit `rules:`; LLM-based (gpt-4o-mini) only when no rules are defined

**Why:**

Both SQR classifiers (`qualification_verdict`, `overall_risk_tier`) define explicit threshold rules in the YAML. These are deterministic mappings — a composite score of 3.8 always produces "Conditional" given the defined thresholds. Calling an LLM for a deterministic mapping introduces non-determinism, latency, and cost with no quality benefit. The `classifier` strategy handler inspects the field definition at runtime: if `rules:` is present, it evaluates them in order and returns the first match; if absent, it delegates to the LLM with a constrained output schema. This preserves the strategy's flexibility for templates that genuinely need classification (e.g. categorising free-text input into an enum) while keeping the SQR template fully deterministic for its classification fields.

**Trade-off:** The strategy handler has two code paths. The rule evaluator must handle the same expression syntax as `calculator.py` for condition strings. Reusing the calculator's expression engine for rule conditions avoids duplicating the evaluator but creates a dependency between two strategy handlers.

---

## 22. Draft Persistence: localStorage + Lazy Backend Creation

**Options considered:** Create backend draft record on wizard mount (eager), create on first "Next" click (lazy), store only in localStorage and never create a backend record until submit

**Chosen:** localStorage persistence for immediate resilience + lazy backend draft creation on first step-1 "Next" click

**Why:**

Eager backend creation (on mount) creates a phantom empty record every time the wizard opens — even on tab switches, accidental navigations, and testing sessions. After moderate use this produces dozens of empty `draft` rows that pollute the Reports list. Lazy creation defers the backend write until the user has passed step-1 validation, meaning a report record is only created when real data exists.

localStorage persistence (`draft:{template_id}` key storing `{ id, intake_data }`) gives instant form resilience: a browser refresh mid-wizard restores the form without a round-trip. The draft ID is stored alongside the form data so the same backend record is reused on return — one record per template slot per browser profile, not one per wizard open.

On submit, localStorage is cleared for that template slot. On edit (opening an existing report from the Reports list), localStorage is bypassed entirely — edit mode reads from the report's server-side `intake_data` and writes directly to its existing ID.

**Trade-off:** If a user clears their localStorage they lose in-progress form data for any draft that has not yet completed step 1 (no backend record exists yet). Post-step-1 drafts survive because the backend record is the source of truth once the ID is established. A hybrid approach (POST on step 1, localStorage as cache) is the chosen design.

---

## 23. Strategy Bar Labels: Plain-English Buckets over Technical Names

**Options considered:** Show technical strategy names in legend (template_fill, extractor, narrative_llm, etc.), show human-readable per-strategy labels (Template text, Carry-through, AI narrative, etc.), bucket into three plain-English categories

**Chosen:** Three plain-English buckets — "You fill in" / "Auto-generated" / "AI writes"

**Why:**

The Templates page is the first thing a user sees before starting a report. Technical strategy names (`template_fill`, `extractor`, `classifier`) are implementation vocabulary — they describe the engine's routing, not the engineer's experience. The engineer cares about one question: "How much work is this form?" The three-bucket model answers that directly:

- "You fill in" (direct_input + extractor) = fields requiring engineer input
- "Auto-generated" (lookup + calculator + template_fill + classifier) = deterministic, no engineer effort
- "AI writes" (narrative_llm + grounded_llm + hybrid) = LLM-drafted prose, reviewed in Module 5

The proportional colour bar is preserved because the ratio conveys at a glance that most of the report is auto-generated (useful for setting expectations). Only the legend labels change from technical to user-facing.

**Trade-off:** Bucketing loses the granularity distinguishing `lookup` from `calculator` from `template_fill` — all map to "Auto-generated." For a power user or template author, this is less informative. The technical breakdown remains accessible via the YAML template file for anyone who needs it; the Templates page is not the right surface for engine internals.

---

## 24. Report Edit Flow: Navigation State over URL Parameters

**Options considered:** `/reports/:id/edit` dedicated route, navigate to `/reports/new` with report data in `location.state`, open an edit modal on the Reports list page

**Chosen:** Navigate to `/reports/new` with `editReport: { id, intake_data }` in `location.state`

**Why:**

The intake wizard is the correct editing surface — it already knows how to render all five steps, validate all fields, and PATCH the backend. Creating a dedicated `/reports/:id/edit` route would duplicate the wizard rendering with a slightly different data-loading pattern. Passing the report data via `location.state` reuses the entire wizard component with a single `isEditMode` flag controlling three behaviours: skip localStorage read, set `draftIdRef` to the existing report ID immediately, and display "editing" instead of "draft" in the breadcrumb badge.

The edit session autosaves to the existing backend record (not a new one) via the existing PATCH endpoint. On submit, the report's `intake_data` is updated and status transitions to `generating` — identical to the new-draft submit path.

**Trade-off:** If the user navigates away from the edit view using the browser back button, `location.state` is lost and the session cannot be resumed (unlike new drafts which have localStorage). This is acceptable — edits to an already-created report are short sessions, not multi-day drafts.

---

## 25. File Download: File System Access API over Blob URL + anchor.click()

**Options considered:** `fetch → res.blob() → URL.createObjectURL → a.download → a.click()` (original), `fetch → FileReader data URL → a.download → a.click()`, `showSaveFilePicker → fetch → FileSystemWritableFileStream.write()` with blob URL fallback

**Chosen:** `showSaveFilePicker` as primary path (Chrome/Edge 86+); blob URL `a.click()` as fallback (Firefox, Safari)

**Why:**

Chrome's transient user-activation token expires approximately one second after a user gesture. The export flow requires three `await` calls before the download can be initiated — `supabase.auth.getSession()`, `fetch()` (which blocks for several seconds while Playwright generates the PDF), and `res.blob()`. By the time `a.click()` is called, the activation token has expired. Without it, Chrome ignores the `download` attribute on the anchor, treats the click as a navigation to the blob URL, and records a UUID-named phantom entry in `chrome://downloads` without writing any file to disk. Confirmed on Chrome 124+.

`showSaveFilePicker` is called as the first operation in `exportReport()`, before any `await`, so the activation token is still valid. Chrome shows a native OS save dialog; the user confirms a save location; then the backend fetch and file write proceed. The file system write goes through `FileSystemWritableFileStream`, which does not require user activation.

The blob URL path is retained as a fallback for Firefox and Safari, where the user-gesture restriction on `download` attribute does not apply and the existing approach works correctly.

**Trade-off:** The primary path changes the UX: instead of the file landing silently in the Downloads folder, Chrome shows a native save dialog and the user must confirm a location. This is a deliberate trade-off — the alternative is a broken download with UUID filenames. The dialog also makes the save location explicit.

**Note on Playwright-controlled Chrome:** `navigator.webdriver` is hidden by Playwright (set to `false`), so automated browser detection is not possible. In a Playwright Chrome tab, `showSaveFilePicker` opens a native OS dialog that is not visible to the user and the Promise stalls. To test exports manually, use a normal browser tab at `localhost:5173` — do not use the Playwright-controlled tab.

---

## 26. Validation Context: Intake Lists + Simpleeval Builtins

**Problem discovered (15 May 2026):** Post-release Playwright stress test showed all 6 validation rules evaluating as failed, regardless of report data. Two root causes:

**Root cause A — simpleeval missing builtins.** `EvalWithCompoundTypes` does not include `len`, `sum`, `all`, `any`, `min`, `max` in its default `functions` dict. Every validation rule using these (5 of 6 rules) threw a `NameError` at eval time, was caught by the broad `except Exception`, logged as a warning, and resolved to `passed=False`.

**Root cause B — `corrective_actions` absent from validation context.** The orchestrator's shadow augmentation (line: `self.context[field.source] = result`) was gated on `field.computed_columns` being truthy. `car_table` has no computed columns, so `corrective_actions` was never added to the context dict. Rules referencing it (`verdict_car_consistency`, `overdue_car_date_check`, `high_risk_car_coverage`) always threw `NameError`.

**Fix A:** Added `_EXTRA_FUNCTIONS = {len, sum, all, any, min, max, abs, round, int, float, str, bool}` and a `_make_evaluator()` helper in `validator.py` that applies them to both the rule evaluator and the message interpolator.

**Fix B:** Removed the `and field.computed_columns` guard from the shadow augmentation in `orchestrator.py`. Every extractor table now shadows its result under the source name regardless of whether it has computed columns. This is the correct behaviour — the source name is what downstream expressions (calculators and validation rules alike) reference, not the field ID.

**Options considered for Fix B:** (1) Pass `intake_data` to `run_validation_rules` and merge it into the validator context. (2) Fix shadow augmentation in orchestrator. (3) Manually list required intake keys in the validator.

**Chosen:** Option 2 — fix shadow augmentation. The validation context should be the same context the orchestrator uses for downstream field calculations. Fixing the shadow condition makes validation and downstream calculators consistent with no special-casing in the validator.

**Trade-off:** All extractor table sources now appear in context under two keys — `field.id` (the processed result) and `field.source` (same value, shadowed). This is intentional and already existed for extractors with computed columns; the fix just makes it unconditional.

---

## 27. Module 8 — Dedicated Prompt Quality Iteration Phase

**Context (16 May 2026):** Module 7 eval baseline revealed mean groundedness 3.17 (threshold 3.5). Two fields scored below 2.5 — `scorecard_summary` (2.0) and `risk_narrative` (2.2) — and two more sat between 3.0 and 3.5 — `car_summary` (3.27) and `recommendation` (3.33). This was identified as a meaningful, measurable engineering problem warranting its own tracked module rather than being treated as a minor patch to Module 7.

**Options considered:**

1. Fix prompts inline within Module 7, no separate tracking
2. Defer prompt improvement to a future iteration with no firm exit criterion
3. Create a dedicated module with a quantitative exit criterion, versioned prompt history, and decision documentation for each YAML change

**Chosen:** Option 3 — Module 8: LLM Narrative Quality, inserted between the eval framework (Module 7) and additional templates (Module 9).

**Why:**

The eval framework exists precisely to drive prompt iteration. Treating prompt changes as a minor patch conflates measurement with remediation — they are distinct engineering phases. A dedicated module with a documented exit criterion (mean groundedness ≥ 3.5, no individual field below 3.0) and versioned prompt history (`eval/PROMPT_HISTORY.md`) makes the improvement loop visible and reproducible. For a portfolio project this distinction matters: a reader can see baseline scores, the prompts at v1.0, the specific changes made, and the resulting v1.1 scores — a clear before/after story.

Sequencing Module 8 before additional templates (now Module 9) is correct because any new template will inherit the same `narrative_llm` prompt patterns. Getting those patterns right in the SQR first means Module 9 starts with validated conventions rather than replicating the v1.0 weaknesses into two more templates.

**Exit criterion rationale:**

Mean ≥ 3.5 is the existing eval threshold — keeping the exit criterion consistent with the eval script avoids maintaining two separate quality bars. The per-field floor of 3.0 prevents a scenario where high scores on `executive_summary` (4.4) mask a field still at 2.0. Both conditions must hold simultaneously for the module to close.

**Scope decision — structural data changes allowed via YAML template only:**

The root cause for the weak fields is not wording but missing data: `scorecard_summary` receives aggregates when it needs individual criterion rows; `risk_narrative` uses pre-computed shadow fields when it should enumerate rows directly; `car_summary` receives counts when it should receive row-level CAR data. Fixing these requires extending what the prompt receives — more `{{field}}` interpolations referencing row-level data — which is a YAML template change, not an orchestrator or Python code change. Code changes are out of scope for this module.

**Trade-off:** Extending prompt context with row-level data increases token consumption per `narrative_llm` call. At the scale of one report (a few hundred tokens per narrative field) this is negligible. The more significant trade-off is that each YAML change must be documented here in DECISIONS.md before being applied — this is the existing CLAUDE.md requirement and is the mechanism that makes the iteration loop traceable.

---

## 28. Prompt v1.1 — Specific Changes per Narrative Field

**Context (16 May 2026):** Baseline eval showed mean groundedness 3.17. This decision documents the four specific prompt changes that constitute v1.1, per the scope rule in Decision 27 (YAML template changes only; each change documented before application).

**Diagnosis per field:**

`scorecard_summary` (groundedness 2.0): The v1.0 prompt provides only aggregates — `composite_score`, `qualification_verdict`, `lowest_criterion_name` — with no per-criterion row data. The LLM writes general impressions rather than anchoring sentences to specific criterion scores and weights.

`risk_narrative` (groundedness 2.2): The v1.0 prompt feeds row 0 with category, item, and priority score but omits `likelihood` and `impact` separately. More critically, there is no explicit instruction preventing the LLM from inferring supply consequences or outcomes beyond what the `mitigation` field states. The LLM adds plausible-sounding but un-grounded context.

`car_summary` (groundedness 3.27): The v1.0 prompt provides aggregate counts (`count(corrective_actions, status='Open')`, `overdue_car_count`) resolved to numbers. The LLM cannot name specific CARs, owners, or due dates — it speaks in generalities that the judge cannot trace to the input.

`recommendation` (groundedness 3.33): The v1.0 prompt injects `{{approval_conditions_blocks[qualification_verdict]}}` — a 3–4 sentence boilerplate paragraph from the lookup dictionary. The LLM echoes this language, which the judge correctly scores as un-grounded (the text is not derived from field values, it is pre-written prose injected verbatim).

**Changes chosen:**

*scorecard_summary v1.1:* Feed all 6 audit scorecard rows explicitly via `{{scorecard_table[0..5].criterion}}`, `{{scorecard_table[N].score}}`, `{{scorecard_table[N].weight}}`, `{{scorecard_table[N].weighted_score}}`. Add instruction: "Reference criterion names from the table. Do not invent scores or weights not listed above." Increase `max_tokens` 150 → 180 to allow the LLM to reference specific criteria by name.

*risk_narrative v1.1:* Add `likelihood` and `impact` separately to Risk 1 (`{{risk_register[0].likelihood}}`, `{{risk_register[0].impact}}`). Add explicit constraint: "State the specific risk item and report the mitigation text exactly as written above — do not add consequences, timelines, or supply impacts not stated in the mitigation field." Keep `second_risk_*` shadow fields for Risk 2 (they carry fallback values for single-risk cases). `max_tokens` unchanged at 150.

*car_summary v1.1:* Add up to 3 CAR rows by indexed access: `{{corrective_actions[0..2].car_id}}`, `.action_item`, `.owner`, `.due_date`, `.status`. Instruct: "Skip any CAR line where the ID shows '—' — it means fewer than that many CARs exist." Increase `max_tokens` 150 → 160.

*recommendation v1.1:* Remove the `Conditions (if any): {{approval_conditions_blocks[qualification_verdict]}}` line. The conditions block is already in the report body (Section 5 `approval_conditions` field via lookup strategy); including it again in the recommendation prompt is redundant and injects pre-written text the judge cannot trace to a field value. `max_tokens` unchanged at 160.

**Fields not changed:** `performance_narrative` (3.87) and `executive_summary` (4.40) — both above threshold. Changing working prompts risks regression.

**Token interpolation mechanism confirmed:** `_render_prompt()` in `narrative_llm.py` uses a three-tier resolver — `intake.field`, plain identifier, expression evaluation. Indexed table access (`table[N].column`) falls to the expression evaluator via `evaluate_expression()`. Failed index lookups are caught and render as `"—"`. All proposed token references are within the existing mechanism; no code changes required.

**Trade-off:** Hardcoding 6 scorecard rows (indices 0–5) assumes the SQR template always has exactly 6 audit criteria. This holds for the v1.0 template and all 15 test cases. A future template with a different row count would need a matching prompt update — acceptable given that templates are versioned (Decision 9). CAR row access (indices 0–2) uses `"—"` fallback for missing rows; this is adequate for v1.1 and can be refined with calculator shadow fields in v1.2 if needed.

---

## 29. Module 9 Scope — SAT Full Template, NCR as Future Work, v2 Image Design

**Context (16 May 2026):** After completing the SQR template and the Module 8 prompt quality iteration, the decision was made to replace the original Module 9 plan (two YAML skeletons + authoring guide) with a single production-quality SAT template plus a comprehensive design document.

**Why SAT over NCR as the second template:**

The SAT (Site Acceptance Test) template was chosen because it exercises two architectural patterns that are visible differentiators for the portfolio:

1. **Measurement-analytics table** — engineer fills a structured test-results table (test ID, parameter, spec min/max, measured value, unit); a `calculator` computed column determines pass/fail per row; a `narrative_llm` analytical paragraph draws specific conclusions from those rows by name and value. This is the "SPLIT table" pattern from the Beneq process engineering domain — user fills structured data, LLM draws insights — distinct from the SQR's verdict-narrative chain.

2. **Image-annotation pattern (v1)** — engineer fills structured numeric fields from instrument readout (measurement type, headline value, unit) plus a free-text observation describing what a figure shows; `narrative_llm` synthesises these into a technical paragraph. The image file itself is not passed to the LLM in v1; the structured inputs and engineer observation are the grounding. This is Option A+B from the design document (§5.5 of the Beneq project brief). v2 would add direct image upload and a vision model call.

**Strategy mix comparison (SAT vs SQR):**

| Strategy | SQR share | SAT share | Why different |
|---|---|---|---|
| `lookup` | ~20% | ~35% | Equipment acceptance language is more boilerplate-heavy than procurement scope statements |
| `extractor` | ~30% | ~30% | Similar — both have structured tables as the data backbone |
| `calculator` | ~20% | ~15% | SQR has more computed intermediates; SAT verdict is simpler (pass_count / fail_count) |
| `narrative_llm` | ~25% | ~15% | SAT prose sections are shorter and more constrained; less analytical latitude than SQR narrative |
| `direct_input` | ~5% | ~5% | Engineer observation field in SAT; equivalent to SQR's remediation notes |

**NCR template — future work rationale:**

The NCR (Non-Conformance Report) template would use a `classifier` chain (defect severity → escalation path), a `hybrid` corrective action table (engineer entries + LLM-proposed gaps from root cause), and SLA `calculator` fields for response deadlines. This is a meaningfully different pattern from both SQR and SAT. It is retained as a visible skeleton card on the Templates page to signal the roadmap, but is not implemented in v1 because: (a) the SAT already proves the platform generalises; (b) the NCR's `hybrid` strategy is not yet implemented in the engine; (c) shipping two full templates is more compelling than three partial ones.

**v2 image design (documented, not implemented):**

The v2 image-annotation extension requires:
- New intake field type: `image` — `type: image` in the YAML schema, renders as a file upload component (react-dropzone) in the intake form
- Supabase Storage integration — uploaded image stored as a blob, URL stored in `intake_data`
- Review UI: image displayed alongside its annotation fields in a side-by-side layout
- `image_narrative` strategy (new) — vision model call with the image URL + structured fields; output is a grounded analytical paragraph. Uses a multimodal model (e.g. `claude-3-5-sonnet` via OpenRouter) with the same structured output schema as `narrative_llm`
- Audit log: image URL + model + vision output stored per field event

This is fully specified in `.agents/plans/9.sat-template.md` §12 and is the natural v2 extension once the core system is deployed and validated.

**Templates page — skeleton card copy:**

Both skeleton cards remain visible. Updated descriptions:
- SAT: "Measurement-analytics template for equipment commissioning. Engineer fills structured test-results table; results narrative draws analytical conclusions from per-test pass/fail data. v1 image-annotation pattern: measurement type + headline values + engineer observation → LLM synthesis. v2: image upload + vision model integration."
- NCR: "Defect-severity classifier gates the escalation-path narrative and corrective action conditions. Hybrid CAR table: engineer-entered items plus LLM-proposed gaps derived from root cause analysis. SLA calculator fields enforce response and closure deadlines."

