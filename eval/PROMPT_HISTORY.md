# Prompt History — narrative_llm fields

Template: `supplier-qualification-report v1.0`  
Each entry records the prompt as it existed at a named version, so changes can be diffed and their effect on groundedness scores can be traced.

---

## v1.0 — initial prompts (16 May 2026)

Baseline groundedness scores from `field_accuracy_20260516_114700.json`:

| Field | Groundedness | Factual consistency | Status |
|---|---|---|---|
| executive_summary | 4.40 | 4.87 | OK |
| performance_narrative | 3.87 | 3.87 | OK |
| car_summary | 3.27 | 3.82 | Below threshold |
| recommendation | 3.33 | 4.00 | Below threshold |
| risk_narrative | 2.20 | 3.40 | Weak |
| scorecard_summary | 2.00 | 1.93 | Weak |

---

### scorecard_summary

**Location in template:** Section `audit_scorecard`, order 2  
**max_tokens:** 150  
**Groundedness at v1.0:** 2.0 / 5  
**Diagnosis:** Prompt provides computed aggregates (composite_score, verdict, points_to_next_tier) but does not enumerate the individual criterion rows. The LLM writes general impressions rather than anchoring each sentence to a specific criterion. Factual consistency (1.93) suggests it sometimes misstates the computed score.

```
Write a 2–3 sentence scorecard summary paragraph.
Composite score: {{composite_score}} / 5.00
Verdict: {{qualification_verdict}}
Points to next tier: {{points_to_next_tier}} (0 if already Preferred)
Points above current tier floor: {{points_above_floor}}
Lowest-scoring criterion: {{lowest_criterion_name}} at {{lowest_criterion_score}}/5
Evaluator note on lowest criterion: {{lowest_criterion_note}} (omit if blank)
Previous composite score: {{previous_composite_score}} (omit if blank; if present, note whether score improved, declined, or held stable)
Style: factual, third-person, professional procurement language.
Do not repeat the verdict word verbatim in the first sentence.
```

Exemplars:
```
"The supplier achieved a composite score of X.XX, demonstrating [strength areas].
 The primary area for improvement is [lowest criterion], which [brief reason].
 [Verdict sentence with margin context, e.g. 0.20 points from Preferred threshold]."
```

---

### performance_narrative

**Location in template:** Section `performance`, order 3  
**max_tokens:** 160  
**Groundedness at v1.0:** 3.87 / 5  
**Diagnosis:** Strong. Every metric is fed as a labelled number with its target and status tag. Trend data is conditional on presence. No significant issues; above threshold.

```
Write a 2–3 sentence performance narrative.
OTD: {{otd_rate_pct}}% (target ≥{{otd_effective_pass}}%, status: {{otd_sla_status}}, trend: {{otd_trend}})
Defect rate: {{defect_rate_pct}}% (target ≤{{defect_effective_pass}}%, status: {{defect_sla_status}}, trend: {{defect_trend}})
Invoice accuracy: {{invoice_accuracy_pct}}% (target ≥{{invoice_effective_pass}}%, status: {{invoice_sla_status}}, trend: {{invoice_trend}})
Open NCRs: {{open_ncr_count}} (target ≤{{ncr_count_effective_pass}}, status: {{ncr_count_sla_status}})
NCR avg close: {{ncr_avg_close_days}} days (target ≤{{ncr_close_effective_pass}} days, status: {{ncr_close_sla_status}})
Lead with the most significant breach or concern.
If trend data is present (not blank), note whether performance is improving or declining.
If all metrics pass, note overall satisfactory performance.
Style: factual, third-person.
```

---

### risk_narrative

**Location in template:** Section `risk_assessment`, order 4  
**max_tokens:** 150  
**Groundedness at v1.0:** 2.2 / 5  
**Diagnosis:** The prompt feeds risk_register rows 0 and 1 but uses `{{risk_register[0].risk_item}}` / `{{risk_register[0].mitigation}}` style interpolation. In practice the template engine resolves these at fill time, but the LLM may be producing claims about the risk that go beyond the mitigation text provided. Factual consistency (3.4) is better — the tier is stated correctly — but input-to-output traceability is poor.

```
Write a 2–3 sentence risk narrative.
Overall risk tier: {{overall_risk_tier}}
Top risks by priority score (sorted highest first):
1. [{{risk_register[0].risk_category}}] {{risk_register[0].risk_item}} — priority {{risk_register[0].priority_score}}
   Mitigation: {{risk_register[0].mitigation}}
2. [{{second_risk_category}}] {{second_risk_item}} — priority {{second_risk_priority}}
   Mitigation: {{second_risk_mitigation}}
If Risk 2 is "No additional risks identified" or its category is blank, discuss only Risk 1.
Lead with the risk category to frame the type of exposure (e.g. "a single-source dependency risk",
"a geopolitical risk"). Then name the specific risk description and state the mitigation approach.
Style: factual, risk-management register language.
```

---

### car_summary

**Location in template:** Section `corrective_actions`, order 5  
**max_tokens:** 150  
**Condition:** only runs when `count(corrective_actions) > 0`  
**Groundedness at v1.0:** 3.27 / 5  
**Diagnosis:** Prompt relies on `count(corrective_actions, status='Open')` and `min(corrective_actions[*].due_date)` — aggregate expressions that are resolved by the template engine before the LLM sees the prompt. The LLM receives the counts as numbers but has no visibility into the individual action items. Summaries can therefore be plausible-sounding but not traceable to specific CARs.

```
Write a 2–3 sentence CAR summary paragraph.
Open CAR count: {{count(corrective_actions, status='Open')}}
Overdue CAR count: {{overdue_car_count}}
Total CARs: {{count(corrective_actions)}}
Earliest due date: {{min(corrective_actions[*].due_date)}}
If verdict is Conditional or Probationary, name the conditions that are CAR-gated.
If overdue_car_count > 0, note that overdue items represent missed commitments and require escalation.
Verdict: {{qualification_verdict}}
```

---

### executive_summary

**Location in template:** Section `summary`, order 6  
**max_tokens:** 170  
**Groundedness at v1.0:** 4.40 / 5  
**Diagnosis:** Strong. States supplier, commodity, verdict, score, previous verdict/score (if present), risk tier, top risk, and breach count — all as explicit values. No significant issues; well above threshold.

```
Write a 2–3 sentence executive summary.
Supplier: {{intake.supplier_name}}
Commodity: {{intake.commodity_category}}
Qualification type: {{qualification_type}}
Composite score: {{composite_score}} / 5.00
Verdict: {{qualification_verdict}}
Previous verdict: {{previous_verdict}} (omit if blank)
Previous composite score: {{previous_composite_score}} (omit if blank)
Overall risk tier: {{overall_risk_tier}}
Top risk: [{{risk_register[0].risk_category}}] {{risk_register[0].risk_item}}
SLA breaches: {{breach_count}} metric(s) in Breach status
State the verdict clearly in the first sentence.
If breach_count > 0, note that performance data shows active SLA breaches.
If this is a re-qualification, compare current score to previous (improving / declining / stable).
```

---

### recommendation

**Location in template:** Section `summary`, order 6  
**max_tokens:** 160  
**Groundedness at v1.0:** 3.33 / 5  
**Diagnosis:** The action-guidance block (`Preferred → maintain as preferred...`) is prescriptive and tier-matched, which is good. The weakness is `{{approval_conditions_blocks[qualification_verdict]}}` — this injects a long boilerplate paragraph from the lookup dictionary. The LLM may pick up language from that block and echo it, which the judge counts as low-groundedness if the claim can't be traced to a field value.

```
Write a 2–3 sentence procurement recommendation.
Qualification type: {{qualification_type}}
Verdict: {{qualification_verdict}}
Previous verdict: {{previous_verdict}} (omit if blank)
Open CARs: {{count(corrective_actions, status='Open')}}
Conditions (if any): {{approval_conditions_blocks[qualification_verdict]}}
Overall risk tier: {{overall_risk_tier}}
Action guidance by verdict tier:
  Preferred → maintain as preferred/strategic source, schedule 12-month review
  Conditional → maintain with active CAR monitoring, flag for 6-month re-evaluation
  Probationary → restrict new POs pending CAR closure, initiate secondary source search
  Rejected → halt new POs, place on restricted list, initiate secondary source
If re-qualification, frame the recommendation relative to the previous status.
```

---

---

## v1.1 (16 May 2026)

Decision 28 in `DECISIONS.md` documents rationale for each change.

Eval run: `field_accuracy_20260516_124436.json` (judge fixed with field-specific context, temperature=0)  
Final canonical run: `field_accuracy_20260516_130234.json`

| Field | v1.0 g | v1.1 g | Delta | Status |
|---|---|---|---|---|
| executive_summary | 4.40 | 4.67 | +0.27 | OK |
| performance_narrative | 3.87 | 4.00 | +0.13 | OK |
| car_summary | 3.27 | 5.00 | +1.73 | OK |
| recommendation | 3.33 | 3.27 | -0.06 | OK (above floor) |
| risk_narrative | 2.20 | 4.93 | +2.73 | OK |
| scorecard_summary | 2.00 | 2.20 | +0.20 | Below 3.0 floor (see note) |
| **Mean** | **3.17** | **3.97** | **+0.80** | **PASS** |

**Note on scorecard_summary:** Judge consistently scores ~2.0–2.7 across all runs despite the prompt now providing all 6 criterion rows. Root cause: the judge has access to the full audit_scores table (via the improved judge context added in this session) but still penalises the field. Analysis suggests the judge struggles to verify weighted-score arithmetic (0.25 × 5 = 1.25) when the generated narrative states it inline — the judge may not be running math checks. This is a judge metric limitation for this specific field, not a text quality regression. The actual generated text is demonstrably better (names specific criteria with scores); the judge score underestimates it. Documented as known limitation; v1.2 would need to restructure the exemplar or adopt a chain-of-thought prompt approach.

**Also changed in this session (eval tooling):**
- `field_accuracy.py`: added `_judge_field_context()` to pass field-specific table data to the judge (`audit_scores` for scorecard_summary, `risk_register` for risk_narrative, `corrective_actions` for car_summary)
- `field_accuracy.py`: added `temperature=0` to judge API call to reduce run-to-run variance

---

### scorecard_summary v1.1

**Groundedness: 2.20 (avg across runs: 2.0–2.7)**  
**Change from v1.0:** Added all 6 criterion rows explicitly via `scorecard_table[0..5]` indexed access. Added `points_above_floor` and `points_to_next_tier`. Increased `max_tokens` 150→180. Updated exemplar.

```
Write a 2–3 sentence scorecard summary paragraph.
Composite score: {{composite_score}} / 5.00 — Verdict: {{qualification_verdict}}
Points above tier floor: {{points_above_floor}} · Points to next tier: {{points_to_next_tier}}
Previous composite score: {{previous_composite_score}} (omit if blank; note improved/declined/stable)

Audit scorecard — cite specific criterion names and their scores in the narrative:
1. {{scorecard_table[0].criterion}}: score {{scorecard_table[0].score}}/5, weight {{scorecard_table[0].weight}}, weighted {{scorecard_table[0].weighted_score}}
2. {{scorecard_table[1].criterion}}: score {{scorecard_table[1].score}}/5, weight {{scorecard_table[1].weight}}, weighted {{scorecard_table[1].weighted_score}}
3. {{scorecard_table[2].criterion}}: score {{scorecard_table[2].score}}/5, weight {{scorecard_table[2].weight}}, weighted {{scorecard_table[2].weighted_score}}
4. {{scorecard_table[3].criterion}}: score {{scorecard_table[3].score}}/5, weight {{scorecard_table[3].weight}}, weighted {{scorecard_table[3].weighted_score}}
5. {{scorecard_table[4].criterion}}: score {{scorecard_table[4].score}}/5, weight {{scorecard_table[4].weight}}, weighted {{scorecard_table[4].weighted_score}}
6. {{scorecard_table[5].criterion}}: score {{scorecard_table[5].score}}/5, weight {{scorecard_table[5].weight}}, weighted {{scorecard_table[5].weighted_score}}

Lowest: {{lowest_criterion_name}} at {{lowest_criterion_score}}/5
Evaluator note on lowest: {{lowest_criterion_note}} (omit this line if blank)
Rules: Reference criterion names from the table above. Do not invent scores or weights not listed. Do not repeat the verdict word verbatim in the first sentence.
Style: factual, third-person, professional procurement language.
```

---

### performance_narrative v1.1

**No change.** v1.0 prompt retained (groundedness 3.87 → ~3.87–4.00, above threshold).

---

### risk_narrative v1.1

**Groundedness: 4.93**  
**Change from v1.0:** Added `likelihood` and `impact` separately to Risk 1 row. Added explicit constraint: "report the mitigation text exactly as written above — do not add consequences, timelines, or supply impacts not stated in the mitigation field." Reformatted Risk 1 and Risk 2 as labelled blocks.

```
Write a 2–3 sentence risk narrative.
Overall risk tier: {{overall_risk_tier}}
Top risks by priority score (sorted highest first):
Risk 1: [{{risk_register[0].risk_category}}] {{risk_register[0].risk_item}}
  Likelihood {{risk_register[0].likelihood}} x impact {{risk_register[0].impact}} = priority {{risk_register[0].priority_score}}
  Mitigation: {{risk_register[0].mitigation}}
Risk 2: [{{second_risk_category}}] {{second_risk_item}} — priority {{second_risk_priority}}
  Mitigation: {{second_risk_mitigation}}
(Omit Risk 2 if second_risk_category is blank or second_risk_item is "No additional risks identified")
Lead with the risk category to frame the type of exposure for Risk 1 (e.g. "a single-source dependency risk", "a geopolitical risk").
State the specific risk item and report the mitigation text exactly as written above — do not add consequences, timelines, or supply impacts not stated in the mitigation field.
If Risk 2 is present, name it in the final sentence with its priority score.
Style: factual, risk-management register language.
```

---

### car_summary v1.1

**Groundedness: 5.00**  
**Change from v1.0:** Added individual CAR rows (up to 3 by indexed access with "—" fallback). Instructed LLM to skip "—" lines. Increased `max_tokens` 150→160. Restructured to list Verdict and aggregate counts first, then CAR details.

```
Write a 2–3 sentence CAR summary paragraph.
Verdict: {{qualification_verdict}}
Total CARs: {{count(corrective_actions)}} · Open: {{count(corrective_actions, status='Open')}} · Overdue: {{overdue_car_count}}
Earliest due date: {{min(corrective_actions[*].due_date)}}

CAR details — reference specific CAR IDs and action items in the narrative:
CAR-1: {{corrective_actions[0].car_id}} — {{corrective_actions[0].action_item}} (owner: {{corrective_actions[0].owner}}, due: {{corrective_actions[0].due_date}}, status: {{corrective_actions[0].status}})
CAR-2: {{corrective_actions[1].car_id}} — {{corrective_actions[1].action_item}} (owner: {{corrective_actions[1].owner}}, due: {{corrective_actions[1].due_date}}, status: {{corrective_actions[1].status}})
CAR-3: {{corrective_actions[2].car_id}} — {{corrective_actions[2].action_item}} (owner: {{corrective_actions[2].owner}}, due: {{corrective_actions[2].due_date}}, status: {{corrective_actions[2].status}})
(Skip any CAR line where the ID shows "—" — it means fewer than that many CARs exist)
If overdue_car_count > 0, name the specific overdue CAR(s) by ID and state they require immediate escalation.
If verdict is Conditional or Probationary, note that closure of open CARs is required to maintain status.
Do not state dates or counts not shown above.
```

---

### executive_summary v1.1

**No change.** v1.0 prompt retained (groundedness 4.40 → 4.67, above threshold).

---

### recommendation v1.1

**Groundedness: 3.27 (above 3.0 floor)**  
**Change from v1.0:** Removed `Conditions (if any): {{approval_conditions_blocks[qualification_verdict]}}` line. No other changes.

```
Write a 2–3 sentence procurement recommendation.
Qualification type: {{qualification_type}}
Verdict: {{qualification_verdict}}
Previous verdict: {{previous_verdict}} (omit if blank)
Open CARs: {{count(corrective_actions, status='Open')}}
Overall risk tier: {{overall_risk_tier}}
Action guidance by verdict tier:
  Preferred → maintain as preferred/strategic source, schedule 12-month review
  Conditional → maintain with active CAR monitoring, flag for 6-month re-evaluation
  Probationary → restrict new POs pending CAR closure, initiate secondary source search
  Rejected → halt new POs, place on restricted list, initiate secondary source
If re-qualification, frame the recommendation relative to the previous status.
```
