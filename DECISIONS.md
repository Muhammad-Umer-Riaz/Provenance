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

**Trade-off:** Engineers must understand the YAML schema and strategy vocabulary to author new templates. This is addressed by the template authoring guide in Module 8. A visual editor is the natural v2 extension once the schema is stable and validated across multiple templates.

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

## 13. Three Templates Ship With the Repo

**Options considered:** One fully polished template (SQR only), two templates (SQR + one other), three templates (SQR full + two skeleton templates)

**Chosen:** Three templates — SQR full + NCR skeleton + SAT skeleton

**Why:**

A single-template system is indistinguishable from a purpose-built SQR tool. Three templates — even if only SQR gets full polish — prove the engine is a general-purpose platform. The two additional skeletons demonstrate different strategy mixes without requiring the full engineering budget of a second fully-polished template: the NCR template uses a different `classifier` chain (defect severity → escalation path); the SAT template demonstrates `calculator` fields for test pass/fail thresholds. The YAML authoring guide in Module 8 is the handoff artefact that makes this claim credible.

**Trade-off:** Writing and validating two additional YAML skeletons adds scope to Module 8. This is deliberately limited to skeleton templates (not full narrative prompts and lookup dictionaries) to keep the scope tractable.

---

## 14. PDF Export: Playwright/Chromium over WeasyPrint

**Options considered:** WeasyPrint, Playwright/Chromium headless browser, wkhtmltopdf (deprecated), ReportLab (programmatic, no HTML input)

**Chosen:** Playwright/Chromium

**Why:**

The review UI already renders the report as HTML in the centre pane. A headless Chromium instance renders the exact same HTML and produces a PDF that is a pixel-perfect match to what the engineer reviewed and approved. There is no separate PDF template to maintain — the HTML/CSS used for the review UI centre pane *is* the PDF template. Any styling change in the UI is automatically reflected in the export.

WeasyPrint requires system libraries (libcairo, libpango, libgdk-pixbuf) in the Docker image and does not always reproduce CSS faithfully; layouts that render correctly in a browser can differ in WeasyPrint. This creates a gap between what the engineer approved in the review UI and what appears in the exported PDF — a gap that undermines the approval gate.

**Trade-off:** The Playwright package with a Chromium binary adds approximately 150 MB to the Docker image. PDF generation spawns a browser process per export request, which is heavier than WeasyPrint's in-process rendering. At portfolio scale (low concurrent export requests) this is acceptable. python-docx remains the DOCX renderer — a headless browser cannot produce DOCX output.

---

## 15. Per-Field Model Routing for LLM Strategy Fields

**Options considered:** Single model for all LLM fields (classifier and narrative_llm use the same model), per-field model routing (classifier uses a cheap fast model; narrative_llm uses a stronger model)

**Chosen:** Per-field model routing

**Why:**

`classifier` fields produce a constrained enum output (e.g. Approved / Conditional / Rejected) from a numeric input with explicit threshold rules. This is a simple mapping task — a small, fast, cheap model handles it correctly, and the constrained output schema limits hallucination risk regardless of model capability. `narrative_llm` fields produce multi-sentence professional prose that is the visible quality signal of the report; this is where model capability directly affects the output a human reads and approves.

Routing the cheap model to `classifier` and the stronger model to `narrative_llm` optimises quality-per-cost: narrative quality improves where it matters most, while classification cost stays minimal. The orchestrator already dispatches each field to its strategy handler — extending that dispatch to carry a model identifier is a natural fit, not a separate routing layer.

Default configuration: `classifier` → `openai/gpt-4o-mini`, `narrative_llm` → `anthropic/claude-haiku-4-5` (both via OpenRouter). Both are overridable via environment variables.

**Trade-off:** Two models mean two cost envelopes in LangSmith traces and two different response time profiles. Each strategy handler that calls an LLM (`classifier.py`, `narrative_llm.py`) needs to resolve its target model from config. A single model is simpler to configure and trace. The `.env.example` must document both model variables clearly to avoid silent misconfiguration.
