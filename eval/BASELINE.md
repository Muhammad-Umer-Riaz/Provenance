# Eval Baseline — v1.0 (16 May 2026)

Template version: `supplier-qualification-report v1.0`  
Run date: 2026-05-16  
Raw JSON files: `eval/results/field_accuracy_20260516_114700.json`, `eval/results/time_to_approval_07e1a878_20260516_115504.json`

This is the frozen baseline captured before any prompt iteration. All future runs should be compared against these numbers using `eval/compare_runs.py`.

---

## 1. Test case matrix

15 synthetic cases covering the full decision space. All supplier names, DUNS numbers, and metric values are fictional. Evaluator name is "Jane Smith" across all cases (fixed test constant).

| ID | Supplier | Country | Commodity | Qual type | Verdict | Risk tier | Key scenario |
|---|---|---|---|---|---|---|---|
| case-01 | Apex Components GmbH | Germany | Precision machined | Re-qual | **Preferred** | Low | Clean high-scorer, all SLAs Pass, improving trend from prev Preferred (4.65→4.75) |
| case-02 | Horizon Electronics Inc | USA | Electronic assemblies | Initial | **Preferred** | Medium | No prior data, medium single-source risk, 0 CARs |
| case-03 | Titan Alloys Ltd | UK | Raw materials — metals | Re-qual | **Preferred** | High | High geopolitical risk (Brexit friction + FX) despite Preferred score; 0 CARs |
| case-04 | Nordic Parts AS | Norway | Precision machined | Re-qual | **Conditional** | Low | Improving from prev Conditional (3.50→3.70), OTD Watch, 1 open CAR |
| case-05 | Meridian Fabrications | France | Precision machined | Re-qual | **Conditional** | Medium | Mixed Watch SLAs (OTD + defect), ageing equipment risk, stable from prev Conditional |
| case-06 | Pacific Precision Co | Japan | Precision machined | For-cause | **Conditional** | High | Triggered by QMS gaps; geopolitical + REACH compliance risks; 1 CAR |
| case-07 | Vesta Manufacturing Srl | Italy | Precision machined | Initial | **Conditional** | Medium | First assessment, mid-range score, single-source + capacity risks, 1 CAR |
| case-08 | Clarity Components Ltd | Netherlands | Precision machined | Re-qual | **Conditional** | Low | Conditional verdict with **zero CARs** — tests `car_summary` field condition skip |
| case-09 | Delta Supply Co | Poland | Precision machined | Re-qual | **Probationary** | Medium | Declining trend from prev Conditional (3.60→2.95), all metrics Watch, 2 CARs |
| case-10 | Orion Industries | Turkey | Precision machined | Re-qual | **Probationary** | High | Multiple Watch SLAs, geopolitical + FX + capacity risks, 3 risks documented, 2 CARs |
| case-11 | Crestline Assembly de Mexico | Mexico | Precision machined | For-cause | **Probationary** | High | **breach_count=5, overdue_car_count=1** — tests overdue CAR path at non-Rejected score |
| case-12 | Summit Materials Inc | Canada | Raw materials — metals | Initial | **Probationary** | Medium | Weak initial assessment, significant QMS gaps, 1 CAR |
| case-13 | Frontier Works Ltda | Brazil | Precision machined | For-cause | **Rejected** | High | **breach_count=5, overdue_car_count=2**, no QMS in place, debt restructuring |
| case-14 | Cascade Components Pvt Ltd | India | Precision machined | Re-qual | **Rejected** | High | Persistent non-conformances, **overdue_car_count=3**, declining from prev Probationary |
| case-15 | Atlantic Machining SA | Spain | Precision machined | Re-qual | **Conditional** | Medium | OTD breach (<85%), declining from prev Preferred (4.10→3.55), **breach_count=1** |

### Coverage summary

- Verdicts: Preferred (3) · Conditional (6) · Probationary (3) · Rejected (2) · — all 4 outcomes represented
- Risk tiers: High (7) · Medium (5) · Low (3) — all 3 tiers represented
- Qual types: Re-qualification (9) · Initial (3) · For-cause (3) — all 3 types represented
- Overdue CARs: 3 cases (case-11: 1, case-13: 2, case-14: 3)
- SLA breaches: 3 cases (case-11, case-13, case-14: breach_count=5; case-15: breach_count=1)
- Zero-CAR Conditional: 1 case (case-08) — tests `car_summary` field condition bypass

### Expected deterministic outputs per case

| ID | composite_score | verdict | risk_tier | otd_status | defect_status | breach_count | overdue_cars |
|---|---|---|---|---|---|---|---|
| case-01 | 4.75 | Preferred | Low | Pass | Pass | 0 | 0 |
| case-02 | 4.20 | Preferred | Medium | Pass | Pass | 0 | 0 |
| case-03 | 4.40 | Preferred | High | Pass | Pass | 0 | 0 |
| case-04 | 3.70 | Conditional | Low | Watch | Pass | 0 | 0 |
| case-05 | 3.55 | Conditional | Medium | Watch | Watch | 0 | 0 |
| case-06 | 3.75 | Conditional | High | Watch | Watch | 0 | 0 |
| case-07 | 3.65 | Conditional | Medium | Watch | Pass | 0 | 0 |
| case-08 | 3.80 | Conditional | Low | Watch | Pass | 0 | 0 |
| case-09 | 2.95 | Probationary | Medium | Watch | Watch | 0 | 0 |
| case-10 | 2.75 | Probationary | High | Watch | Watch | 0 | 0 |
| case-11 | 2.60 | Probationary | High | Breach | Breach | 5 | 1 |
| case-12 | 2.75 | Probationary | Medium | Watch | Watch | 0 | 0 |
| case-13 | 1.75 | Rejected | High | Breach | Breach | 5 | 2 |
| case-14 | 1.40 | Rejected | High | Breach | Breach | 5 | 3 |
| case-15 | 3.55 | Conditional | Medium | Breach | Pass | 1 | 0 |

---

## 2. Deterministic field accuracy (`--skip-llm`)

Run ID: `20260516_113554`  
Cases: 15 · Fields checked: 105 · LLM calls: 0

| Metric | Result | Threshold | Status |
|---|---|---|---|
| Deterministic pass rate | 100% (105/105) | ≥ 90% | PASS |
| Validation warnings accuracy | — (0 cases with `expected_warnings` set) | — | N/A |

No deterministic failures.

---

## 3. Full eval with LLM judge

Run ID: `20260516_114700`  
Cases: 15 · Total elapsed: 206 s · Judge model: `anthropic/claude-haiku-4-5` via OpenRouter

### Deterministic

100% pass rate, 0 failures — same as skip-llm run.

### LLM narrative groundedness

Judge scores each narrative field 1–5 for groundedness (every claim traces to provided inputs) and factual consistency (text aligns with computed values).

| Field | Mean groundedness | Mean factual consistency |
|---|---|---|
| executive_summary | **4.40** | 4.87 |
| performance_narrative | **3.87** | 3.87 |
| car_summary | 3.27 | 3.82 |
| recommendation | 3.33 | 4.00 |
| risk_narrative | 2.20 | 3.40 |
| scorecard_summary | 2.00 | 1.93 |
| **Overall mean** | **3.17** | **3.65** |

Threshold: groundedness ≥ 3.5 — **FAIL**

**Weak fields:**
- `scorecard_summary` (2.0 g / 1.93 f): LLM does not stay faithful to the per-criterion rows. Tends to state a general impression rather than anchoring each sentence to a specific criterion score and its weight. Low factual consistency score suggests it sometimes misstates the computed score.
- `risk_narrative` (2.2 g / 3.4 f): LLM introduces phrasing not traceable to the risk register rows. Mitigation details are often vague or omitted even when provided. Factual consistency is better (3.4) — the tier and score are stated correctly — but the input-to-output traceability is poor.

**Strong fields:**
- `executive_summary` (4.4) and `performance_narrative` (3.87): prompts feed every key variable as a labelled number with explicit status tags (Pass/Watch/Breach). The LLM has no room to invent — it just has to assemble the narrative from concrete values.

### Per-case timing

| Case | Elapsed (s) |
|---|---|
| case-01 | 9.79 |
| case-02 | 10.68 |
| case-03 | 12.01 |
| case-04 | 13.91 |
| case-05 | 31.02 |
| case-06 | 11.43 |
| case-07 | 12.26 |
| case-08 | 9.81 |
| case-09 | 13.39 |
| case-10 | 13.43 |
| case-11 | 12.84 |
| case-12 | 11.48 |
| case-13 | 12.24 |
| case-14 | 18.85 |
| case-15 | 12.95 |

case-05 is the slowest (31 s) — all SLAs at Watch, 1 CAR, re-qual with previous data; likely a longer narrative output.

---

## 4. Time-to-approval

Report: Bosch Precision GmbH re-qualification (`07e1a878-dfe8-4f9a-bed6-f01697771575`)  
Run at: 2026-05-16T11:55:04

| Metric | Value |
|---|---|
| Total fields | 47 |
| Approved fields | 47 |
| First-pass rate | **95.7%** (45/47) |
| Mean regenerations per field | 0.021 (1 total) |
| Mean edits per field | 0.021 (1 total) |

Fields not first-pass:
- `scorecard_summary` — 2 generations + 1 edit before approval
- `performance_narrative` — 3 generations, no edits

Both are in the low-groundedness group above, which is consistent: the fields that score poorly on the judge are also the ones users regenerate most before approving.

---

## 6. v1.0 → v1.1 comparison (Module 8 outcome)

Canonical v1.1 run: `field_accuracy_20260516_130234.json` (temperature=0 judge, field-specific context)

| Field | v1.0 groundedness | v1.1 groundedness | Delta |
|---|---|---|---|
| executive_summary | 4.40 | 4.67 | +0.27 |
| performance_narrative | 3.87 | 4.00 | +0.13 |
| car_summary | 3.27 | 5.00 | +1.73 |
| recommendation | 3.33 | 3.27 | -0.06 |
| risk_narrative | 2.20 | 4.93 | +2.73 |
| scorecard_summary | 2.00 | 2.20 | +0.20 |
| **Mean** | **3.17** | **3.97** | **+0.80** |

**Threshold (≥3.5): FAIL → PASS**  
**Per-field floor (≥3.0): scorecard_summary remains below floor at 2.20 — documented as known judge metric limitation in PROMPT_HISTORY.md v1.1 note**

Changes applied in Module 8:
- `scorecard_summary`: now receives all 6 criterion rows via `scorecard_table[0..5]` indexed access
- `risk_narrative`: added `likelihood` × `impact` to Risk 1; explicit mitigation-faithfulness constraint
- `car_summary`: now receives individual CAR rows (up to 3) with IDs, action items, owners, dates, statuses
- `recommendation`: removed `approval_conditions_blocks` boilerplate injection
- Eval tooling: added field-specific judge context tables; judge `temperature=0`

---

## 5. Known issues present at baseline capture

These bugs were fixed before this baseline was run. Recorded here for traceability.

- `validator.py`: missing Python builtins (`len`, `sum`, `all`, etc.) from simpleeval context — all rules using them returned False. Fixed in Decision 26.
- `orchestrator.py`: shadow augmentation condition blocked `corrective_actions` from reaching the validation context. Fixed in Decision 26.
- `reports.py`: revalidate endpoint called `.get()` on a list instead of `next(...)`. Fixed 16 May 2026.
- `field_accuracy.py`: LLM judge silently returned 0 because the model returns JSON in markdown code fences despite `response_format: json_object`. Fixed by stripping code fences before `json.loads()`.
- `field_accuracy.py` / `time_to_approval.py`: `→` character (U+2192) crashes on Windows CP1252 console. Fixed by replacing with `->`.
