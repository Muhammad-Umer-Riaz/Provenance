# CLAUDE.md 

## What this project is

Provenance is a schema-driven, field-level report generation engine with a
human-in-the-loop review UI. It takes a YAML template (defining sections, fields,
and per-field generation strategies) plus structured human input and produces a
formatted draft report that the user reviews, edits field-by-field, and approves
before export.

**Domain:** Supplier Qualification Reports — procurement / supply chain
**Owner:** Muhammad Umer Riaz — muhammad.umer2149@gmail.com


## How to orient yourself before doing anything

Read these files in order:
1. `docs/ARCHITECTURE.md` — full architectural background, strategy taxonomy, YAML template,
   report anatomy, and all decisions already made. This is the design source of truth.
2. `docs/DECISIONS.md` — every major design choice with reasoning. Check here before
   proposing any architectural change.
3. `docs/STATUS.md` — what is done, in progress, and not yet started.
4. `templates/supplier-qualification-report.yaml` — the v1 template spec once created.

## User preferences — follow these strictly

**Ask questions before acting on decisions that have downstream effects.**
This includes: schema changes, strategy assignments, new fields, folder structure
changes, naming conventions, new dependencies, and anything architectural.
When in doubt, ask. A short question costs nothing; a wrong assumption wastes a session.

**Specific things to always ask about before touching:**
- Any change to the YAML template
- Any change to the orchestrator routing logic
- New Python or npm dependencies
- Git commits or pushes — always ask first, never assume
- Adding or removing files from the repo
- Anything that affects the audit log schema (it is append-only and immutable)

**Business framing comes first.**
Every technical decision should connect back to a procurement or supply chain use
case. The user has domain knowledge in industrial engineering, manufacturing ops,
and procurement. Do not over-explain domain context back to them.

**Be direct about mistakes.**
If you made an assumption you should have asked about, say so plainly.
Directness is preferred over deflection.

**No summaries at the end of responses.**
Do not write long summaries of what was just done. The user can read the output.
End responses when the work is done.

## Architecture you must understand before writing any code

Provenance is built around a **strategy taxonomy**. Every field in every report
template declares exactly one strategy. The orchestrator reads the strategy and
routes accordingly. Do not invent new strategies or change existing assignments
without a documented decision.

| Strategy | What it does | Calls LLM? |
|---|---|---|
| `lookup` | Selects a fixed text block from a dictionary | No |
| `extractor` | Passes user-entered value through verbatim | No |
| `calculator` | Computes deterministically from other fields | No |
| `template_fill` | Renders a fixed string with `{{field}}` interpolation | No |
| `direct_input` | Engineer types prose directly; rendered as-is | No |
| `narrative_llm` | LLM writes a paragraph from structured field inputs | Yes |
| `classifier` | Maps a value to an enum; gates downstream logic | Yes (small) / No |
| `grounded_llm` | LLM with retrieval against a reference corpus | Yes |
| `hybrid` | User fills rows; LLM proposes additions in review mode | Yes (selectively) |

The `classifier → narrative_llm` chain is the key orchestration pattern in the
Supplier Qualification Report template. The classifier fires first (audit score →
verdict), its output gates the `lookup` conditions block in Section 5, and it is
passed as context to Section 6 `narrative_llm` calls. This execution order must
be preserved.

Full report anatomy and YAML template are in `docs/ARCHITECTURE.md` Section 5 and 6.


## Starting services

```bash
bash start.sh
```

Or individually:

**Backend** (port 8000):
```bash
cd backend
source venv/bin/activate        # Mac/Linux
# source venv/Scripts/activate  # Windows
uvicorn main:app --reload
```

**Frontend** (port 5173):
```bash
cd frontend
npm run dev
```

Verify backend is healthy: `GET http://localhost:8000/` → `{"status": "ok"}`

## Planning

- Save all plans to `.agents/plans/`
- Naming convention: `{sequence}.{plan-name}.md` (e.g. `1.orchestrator-core.md`,
  `2.intake-form.md`, `3.review-ui.md`)
- Plans must be detailed enough to execute without ambiguity
- Each task in the plan must include at least one validation test
- Assess complexity and single-pass feasibility before starting:
  - ✅ **Simple** — single-pass executable, low risk
  - ⚠️ **Medium** — may need iteration, some complexity
  - 🔴 **Complex** — break into sub-plans before executing

## Development flow

1. **Plan** — create a detailed plan, save to `.agents/plans/`
2. **Build** — execute the plan
3. **Validate** — test against the checklist in the plan
4. **Iterate** — fix issues found during validation
5. **Update** — mark tasks done in `docs/STATUS.md`

## Validation

`.agents/validation-framework.md` is the single source of truth for how to validate
features on this project.

**Before implementing any feature:**
- Read the Regression Suite — all items must pass after every change
- Read the relevant module-specific notes for what you are building
- Copy the Per-Feature Checklist Template into your plan and fill it in as
  acceptance criteria

**After completing a feature:**
- Run through your filled-in checklist and mark each item
- Update `docs/STATUS.md` with results, bugs found, and any post-release fixes
- If you discover a new recurring pitfall not in the Known Pitfalls table,
  add it to `.agents/validation-framework.md`

## Git

- Commit messages must not contain any reference to Claude Code, Claude, or AI
  authorship — no `Co-Authored-By: Claude`, no `Generated with Claude Code`,
  no similar attribution of any kind
- Never push to GitHub without explicit instruction from the user
- Never create new files unless explicitly asked

## What NOT to do

- Do not change strategy assignments in the YAML template without a documented
  decision in `docs/DECISIONS.md`
- Do not call an LLM for `calculator`, `extractor`, `lookup`, or `template_fill`
  fields — these are intentionally deterministic
- Do not allow report export until all required fields are in `approved` status —
  this gate is non-negotiable