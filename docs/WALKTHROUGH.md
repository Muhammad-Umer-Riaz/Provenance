# Provenance — End-to-end walkthrough

This is the long-form version of the "How it works" section in the [README](../README.md). Every page of the intake, every generation snapshot, and the review surface — captured from `localhost:5173` on a real Supplier Qualification Report run.

The README shows the four hero frames. This document shows the rest of the flow.

---

## 0. Reports dashboard

![Reports list — status filter, template filter, evaluator filter, search by supplier](../Screenshots%20for%20README/Reports%20Page.png)

The dashboard lists every report the signed-in user owns. Status filters on the left (Draft / Generating / In review / Approved / Exported) match the report lifecycle. Each row carries the report ID, supplier subject line, template, computed score, classifier verdict, status, and last-updated time. Row-level security on the database means a user only ever sees their own reports.

---

## 1. Pick a template

![Templates page — SQR is the production template, SAT and NCR are skeleton cards](../Screenshots%20for%20README/Template%20Page.png)

The Templates page is the entry point for a new report. The featured card surfaces the strategy mix *before* the user commits — *1 direct + 8 review + 38 auto* — so they know upfront which fields the engine will fill, which fields the LLM will write (and they'll review), and which one field they'll type directly. SAT and NCR sit below as skeleton cards: same engine, same strategy taxonomy, no code change needed to run them. Recent drafts and reviews show up in the right pane for quick resumption.

---

## 2. Fill the intake — five steps

The intake form is auto-rendered from the template YAML. Every field, every validation rule, every conditional gate is declared in the same file the generation engine reads. There is no hand-coded form anywhere — adding a field to the YAML adds it to the form.

A right-side **Downstream** panel on each step shows what that step's input feeds. This is the architecture made visible to the user: they can see exactly which calculators, classifiers, lookups, and narrative_llm fields depend on what they're about to type.

### Step 1 — Header Info

![Step 1 — supplier identity, scope, optional contact identifiers](../Screenshots%20for%20README/Page%201%20Intake%20Form.png)

Identity, scope, and contact identifiers. The step ribbon at the top tracks progress across all five steps. The progress panel on the right tracks per-section completion as a fraction of required fields. Auto-save runs continuously to the backend — the "autosaved · 1s ago" tag in the top right is the persistence signal.

### Step 2 — Qualification

![Step 2 — qualification type with conditional previous-baseline fields](../Screenshots%20for%20README/Page%202%20Intake%20Form.png)

The qualification type is a 3-way choice: Initial / Re-qualification / For-cause review. Selecting **Re-qualification** unlocks the optional previous-period baseline (previous verdict, previous composite score, previous metrics) — these are conditional fields driven by a YAML `condition:` expression on each field. The Downstream panel for this step lists `S2 qualification summary`, `classifier (verdict!)`, and `narrative_llm (trend analysis)` — the trend-analysis narrative is exactly the field that uses the previous-baseline data.

### Step 3 — Performance & certifications

![Step 3 — performance metrics, certifications multi-select, optional SLA threshold overrides (part 1)](../Screenshots%20for%20README/Page%203.1%20Intake%20Form.png)

Current-period operational metrics: OTD rate, defect rate, invoice accuracy, open NCR count, average NCR close time. Each is a numeric field with template-defined min/max validation.

![Step 3 — multi-select certifications and SLA pass-threshold overrides (part 2)](../Screenshots%20for%20README/Page%203.2%20Intake%20Form.png)

Below the metrics: a certifications multi-select (ISO 9001:2015, IATF 16949, EN 9100, ISO 14001:2015, ISO 45001, ISO 27001, plus "None") and optional SLA pass-threshold overrides. The thresholds default to template-level values; overriding them changes which metrics flip to Watch or Breach in the downstream calculator.

### Step 4 — Audit Scorecard

![Step 4 — 6 weighted criteria with weights summing to 1.00; right pane shows what this step feeds](../Screenshots%20for%20README/Page%204%20Intake%20Form.png)

The scorecard is the heart of the classifier chain. Six weighted criteria — QMS, OTD history, financial stability, technical capability, CAR responsiveness, sustainability — each scored 1–5 with weights summing to 1.00. The footer shows a live preview of the composite score (calculated client-side; the backend recalculates on submit).

The **Downstream** panel for this step is the architecture diagram in miniature: *this step feeds composite_score (calculator) → verdict (classifier) → audit narrative*. That sequence is the `classifier → narrative_llm` chain in flight. Worth dwelling on this step — it's the most architecturally interesting view in the entire intake.

### Step 5 — Risk & CARs

![Step 5 — risk register with category/likelihood/impact/owner; priority computed live (part 1)](../Screenshots%20for%20README/Page%205.1%20Intake%20Form.png)

Material risks identified during the review. Each risk takes a category (single-source dependency / financial / geopolitical / quality / capacity / lead time / IP / regulatory / FX / force majeure / other), a free-text description, likelihood and impact scores 1–5, an owner, and an optional mitigation. The priority badge — `MEDIUM · PRIORITY 12` — is computed live as `likelihood × impact`. At least one risk is required to submit.

![Step 5 — corrective actions table with CAR #, action item, owner, due date, status (part 2)](../Screenshots%20for%20README/Page%205.2%20Intake%20Form.png)

Corrective actions are optional. Each CAR gets an auto-assigned ID (CAR-001, CAR-002, ...), an action description, owner, due date, and status (Open / In progress / Closed / Overdue). The CAR table feeds the `car_summary` narrative_llm field and is also referenced by validation rules (e.g., non-Preferred verdict should have at least one CAR; overdue CARs raise warnings).

---

## 3. Watch generation

On submit, the orchestrator kicks off a per-field execution loop in the background. Each field runs as an independent task: dispatched, validated against its schema, retried up to three times on failure, written to the audit log on completion. Progress streams to the frontend via Supabase Realtime, section by section.

Generation typically completes in 30–60 seconds for a full SQR. Three snapshots show the progression:

### Generate — early (6/47)

![Generate page early — 6 of 47 fields done, only Supplier Header complete, Audit Scorecard in flight](../Screenshots%20for%20README/Generate%20Page%20Early%20%286%20of%2047%29.png)

A few seconds in. Supplier Header is done (4/4 ✓) — those are mostly `template_fill` and `extractor` fields, milliseconds each. Audit Scorecard is at 2/9 — the deterministic scorecard rows (extractor table + computed weighted-score column + calculator composite_score + classifier verdict) are starting to clear. Everything else is still at 0.

### Generate — mid (24/47)

![Generate page mid — 24 of 47 fields done, classifier chain just cleared, Performance narratives in flight](../Screenshots%20for%20README/Generate%20Page%20Mid%20%2824%20of%2047%29.png)

About halfway. Audit Scorecard is now 9/9 — meaning the classifier `verdict` has fired and the `scorecard_summary` narrative_llm field downstream has completed. Performance is at 11/15 with its narrative also running. Risk Assessment, CARs, and Summary are still 0 because they depend on values upstream that are mid-computation. This is the most informative frame for understanding the pipeline — you can see the dependency order in action.

### Generate — late (39/47)

![Generate page late — 39 of 47 fields done, Risk Assessment cleared, Summary section still pending](../Screenshots%20for%20README/Generate%20Page%20Late%20%2839%20of%2047%29.png)

Near completion. Performance, Risk Assessment, and most of Corrective Actions are done. Summary is still 0/5 — those are the report-wide narrative_llm fields (executive_summary, recommendation, etc.) that wait for *every* upstream value to be available before running. The Summary section is intentionally the last thing the LLM writes, because its prompt context includes the verdict, the lowest criterion, the open CAR count, and the highest-priority risk — all values that the previous sections produced.

When the counter hits 47/47, the page auto-redirects to Review.

---

## 4. Review field-by-field

![Review UI — three-pane layout, strategy badges per field, 47/47 approved gate, Validation tab](../Screenshots%20for%20README/Review%20UI%20Page%20All%20Approved.png)

The Review UI is where human-in-the-loop lives.

**Left pane** — intake summary. The data the user entered, for quick reference.

**Centre pane** — the generated report, field by field. Each field shows its strategy as a small badge in the top-right (`template_fill`, `extractor`, `calculator`, `lookup`, `narrative_llm`). Approval status is a green pill on the left of each card.

**Right pane** — metadata for the currently focused field. Strategy, inputs used, model invoked (if any), generation timestamp, and three action buttons: Unapprove, Edit (inline edit with audit-log capture), Regenerate (rerun with optional natural-language guidance).

**Top bar** — `47/47 approved · Export` is the gate. The Export button is disabled until every required field is in `approved` status. The breadcrumb `Intake ✓ → Generate ✓ → Review` tracks the report lifecycle.

**Validation tab** — co-located with Report. The badge counter (`6` in this capture) is the number of validation issues raised by the cross-field rule engine. Clicking the tab surfaces them grouped by severity, each linked to the field they apply to.

Once the gate clears, three export formats are available: PDF (rendered by Playwright/Chromium — pixel-perfect match to the Review centre pane), DOCX (python-docx, native Word styling), and JSON (full report object graph with every field's strategy, inputs, model, timestamp, and complete audit trail).

---

## Where to go from here

- [`README.md`](../README.md) — the entry-point pitch, architecture diagram, strategy taxonomy, eval framework, stack, related work, run-locally setup.
- [`CONTEXT.md`](../CONTEXT.md) — full strategy taxonomy reference and SQR template anatomy.
- [`DECISIONS.md`](../DECISIONS.md) — every major architectural decision with rationale and rejected alternatives.
- [`eval/BASELINE.md`](../eval/BASELINE.md) — frozen baseline run, per-field scores, v1.0 → v1.1 delta.
- [`templates/supplier-qualification-report.yaml`](../templates/supplier-qualification-report.yaml) — the SQR template source you saw rendered above.
- [`templates/site-acceptance-test.yaml`](../templates/site-acceptance-test.yaml) — the SAT template (same engine, different domain).
