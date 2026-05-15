# CLAUDE.md — SDTM Cross-Domain Inconsistency Engine

This file is project memory for Claude Code. Read it before starting any session.

## Project overview

We are building an SDTM data-quality engine that finds cross-domain and medical-logic inconsistencies in oncology trial data (RECIST 1.1 response assessment). The product is aimed at pharma sponsors and CROs as a tool that lets clinical data managers adjudicate findings in seconds rather than minutes — by always showing the underlying evidence and the rule citation alongside each finding.

This is not Pinnacle21 — that tool reports SDTM-conformance errors. We catch *logical and medical* inconsistencies that survive Pinnacle21 and the EDC's edit checks.

**Scope for v0:** three SDTM domains (TU, TR, RS), ~8 deterministic rules, a benchmark against a 5-patient synthetic dataset with 11 seeded errors, plus a React frontend for the demo.

## Current status

Done (in claude.ai before this handoff):
- eCRF spec for the two source forms (Tumor Assessment Form, Response Evaluation Form) with eCRF→SDTM mapping
- Synthetic SDTM data: 5 patients, 20 TU rows, 79 TR rows, 53 RS rows
- Ground truth: 11 seeded errors across 4 categories, with rule citations
- Architecture decision: deterministic rule engine as the trusted core, with a clearly-bounded LLM anomaly-detection sidecar for the long tail
- UI direction: per-finding drill-down with chart + evidence rows + RECIST citation, ~5 visualization templates total

Next (this is your job, Claude Code):
1. Scaffold the project (Python engine + FastAPI + React)
2. Build the engine and the 8 rules
3. Run against the synthetic data, hit 11/11 on ground truth
4. Build the React frontend with the 5 templates
5. Wire benchmark report into the UI

## Architecture

```
SDTM input (TU, TR, RS CSVs)
      |
      v
  Rule engine (Python, deterministic)
      |
      v
  Finding objects (typed, with template + params + evidence_rows)
      |
      v
  FastAPI (POST /run -> List[Finding])
      |
      v
  React frontend (template per finding type)
```

The LLM anomaly-detection layer is **out of scope for v0**. Architect for it as a separate engine path that produces `NOVEL` findings rendered by an LLM template, but do not build it yet. The deterministic engine alone should catch all 11 seeded errors.

## Core principles (enforce these, do not drift)

1. **Rule-wise, not error-wise.** A rule produces N findings across the dataset. Never write `check_err_002()`; write `check_pr_threshold()` and let it fire on every visit where PR is claimed below 30% decrease.

2. **Findings carry evidence.** Every `Finding` includes the actual rows (from TU/TR/RS) that triggered it, not just a message. The UI uses these directly — no extra queries.

3. **Predefined templates, not LLM-rendered.** Each rule declares `template_id` (e.g. `"RESPONSE_THRESHOLD"`) and `template_params`. The React frontend has a fixed registry of template components. This is a regulated-domain product: validated, reproducible output matters more than flexibility. LLM is reserved for the future NOVEL path only.

4. **Engine runnable standalone.** The Python engine works as a CLI (`python -m engine.run --tu tu.csv --tr tr.csv --rs rs.csv --out findings.json`). The FastAPI layer wraps it. The React app calls FastAPI. Never entangle engine logic with API or UI code.

5. **Benchmark is first-class.** Every run can optionally consume `ground_truth.csv` and produce a precision/recall report. This is how we know the engine works.

## Project layout

```
engine/
  __init__.py
  loader.py           # load_csvs(tu_path, tr_path, rs_path) -> (DataFrame, DataFrame, DataFrame)
  finding.py          # @dataclass Finding(rule_id, severity, usubjid, visit, message, template_id, template_params, evidence_rows)
  registry.py         # @rule decorator + RULES dict
  rules/
    __init__.py
    counts.py         # max 5 targets, max 2 per organ
    measurability.py  # lymph node short axis ≥15mm, non-target shouldn't have LDIAM
    response_math.py  # PR/PD/CR threshold checks (the gold mine)
    integrity.py      # ghost TRLNKID, NEWLPRES vs TU, NEW at baseline
    bor.py            # BOR consistency with per-visit history
  run.py              # entry: load → run all rules → return List[Finding] → optionally write JSON

api/
  main.py             # FastAPI app
  routes/
    run.py            # POST /run (multipart 3 CSVs) → findings
    benchmark.py      # POST /benchmark (4th CSV: ground truth) → precision/recall

frontend/
  package.json        # Vite + React + Tailwind
  src/
    App.tsx
    components/
      UploadPage.tsx
      FindingsList.tsx
      FindingCard.tsx
      DrillDown.tsx
      templates/
        ResponseThresholdTemplate.tsx  # chart with PR/PD thresholds
        LesionCountTemplate.tsx        # grouped bar by organ
        GhostReferenceTemplate.tsx     # set-diff between TU and TR IDs
        TimelineMismatchTemplate.tsx   # per-visit response timeline (for BOR + NEWLPRES)
        MeasurabilityTemplate.tsx      # single-value comparison vs threshold

tests/
  test_rules.py        # one test per rule; assert it produces the expected findings on the synthetic data
  test_benchmark.py    # 11/11 on ground truth

data/
  tu.csv               # provided
  tr.csv               # provided
  rs.csv               # provided
  ground_truth.csv     # provided

benchmark.py           # CLI: python benchmark.py --findings out.json --truth data/ground_truth.csv
```

## The Finding dataclass (the contract)

```python
from dataclasses import dataclass, field
from typing import Any, Literal

Severity = Literal["LOW", "MEDIUM", "HIGH"]

@dataclass
class Finding:
    rule_id: str                       # e.g. "PR_THRESHOLD"
    severity: Severity
    usubjid: str
    visit: str | None                  # may be None for subject-level findings (e.g. BOR)
    message: str                       # plain-language, template-filled
    template_id: str                   # e.g. "RESPONSE_THRESHOLD" — picks the React component
    template_params: dict[str, Any]    # whatever that template needs to render
    evidence_rows: dict[str, list[dict]]  # {"TR": [...rows...], "RS": [...rows...]}
    citation: str                      # e.g. "RECIST 1.1 § 11.3.5"
```

## The 8 rules to implement

| ID                 | Severity | Template                | Catches |
|--------------------|----------|-------------------------|---------|
| `PR_THRESHOLD`     | HIGH     | RESPONSE_THRESHOLD      | ERR-002, ERR-003 |
| `PD_THRESHOLD`     | HIGH     | RESPONSE_THRESHOLD      | ERR-011 |
| `CR_NONTARGET`     | HIGH     | TIMELINE_MISMATCH       | ERR-006 |
| `BOR_CONSISTENCY`  | HIGH     | TIMELINE_MISMATCH       | ERR-004 |
| `MAX_TARGETS`      | HIGH     | LESION_COUNT            | ERR-007 (the count-of-5 portion) |
| `MAX_PER_ORGAN`    | HIGH     | LESION_COUNT            | ERR-007 (the per-organ portion) |
| `LN_MEASURABILITY` | MEDIUM   | MEASURABILITY           | ERR-005 |
| `NONTARGET_LDIAM`  | MEDIUM   | MEASURABILITY           | ERR-001 |
| `NEWLPRES_VS_TU`   | HIGH     | TIMELINE_MISMATCH       | ERR-008 |
| `GHOST_TRLNKID`    | HIGH     | GHOST_REFERENCE         | ERR-010 |
| `NEW_AT_BASELINE`  | HIGH     | MEASURABILITY (single row callout) | ERR-009 |

That's 11 rules covering 11 errors (some errors are caught by two related rules; benchmark just needs each error_id mapped to at least one rule).

## The 5 visualization templates

1. **RESPONSE_THRESHOLD** — line chart of SUMDIAM across visits with horizontal threshold lines (baseline, PR threshold = baseline × 0.7, PD threshold = nadir × 1.2). Misclassified points highlighted red. Used for PR/PD findings.

2. **LESION_COUNT** — horizontal bar per organ showing count vs limit; over-limit bars in red. Below: the TU rows that put it over. Used for max-target / per-organ findings.

3. **GHOST_REFERENCE** — two-column set comparison. Left: TU lesion IDs for the subject. Right: TR lesion IDs at the visit. Orphaned IDs highlighted. Used for missing-reference findings.

4. **TIMELINE_MISMATCH** — horizontal timeline of per-visit responses with the disputed claim called out. Used for BOR, NEWLPRES, and CR-with-non-target-present findings.

5. **MEASURABILITY** — single-number comparison (actual vs threshold) with the TU+TR rows below. Used for lymph-node short-axis, non-target measurement, NEW-at-baseline findings.

## Data already on disk

The 5-patient synthetic dataset and the inconsistency walkthrough are in `data/` (drop them in when you start). Files: `tu.csv`, `tr.csv`, `rs.csv`, `ground_truth.csv`, `inconsistency_walkthrough.md`, `ecrf_design.md`, `generate_sdtm_data.py`.

## Tech stack — pinned choices

- **Engine:** Python 3.11+, pandas, dataclasses, pytest
- **API:** FastAPI + uvicorn, no auth in v0
- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS, Recharts for the line chart in RESPONSE_THRESHOLD
- **No database in v0.** Stateless: upload → run → return findings. Persistence is v1.

## Suggested first sessions

**Session 1 — engine skeleton.** Scaffold the directory. Implement `loader.py`, `finding.py`, `registry.py`. Implement two rules end-to-end: `PR_THRESHOLD` and `GHOST_TRLNKID`. Run against the synthetic CSVs. Verify findings for ERR-002, ERR-003, ERR-010.

**Session 2 — the rest of the rules.** Implement the remaining 9 rules. Run `pytest`. Run `benchmark.py`. Goal: 11/11 on ground truth, 0 false positives on Patient 01.

**Session 3 — FastAPI + React skeleton.** Wrap the engine in FastAPI. Scaffold the React app with upload page, findings list, and a placeholder drill-down. Connect them end-to-end with the synthetic data baked in as default.

**Session 4 — the 5 templates.** Build each template component. The RESPONSE_THRESHOLD template (chart with thresholds) is the hardest; reference the mockup we already designed in claude.ai for the visual target.

**Session 5 — polish.** Severity coloring, filter sidebar, benchmark tab, demo-mode toggle that auto-loads the synthetic data.

## What NOT to do (anti-goals)

- Do not introduce an LLM into the deterministic path. Anomaly detection is a separate future engine.
- Do not invent new SDTM variable names. Use the exact CDISC names: `TULNKID`, `TRLNKID`, `RSORRES`, `RSTESTCD`, etc.
- Do not hardcode patient IDs anywhere in the engine. The engine must work on any conforming dataset.
- Do not skip the benchmark step. After every meaningful change, re-run benchmark.py.
- Do not over-format React components. Match the design system in the mockup: flat, clean, monospace for data values, red only for severity/incorrectness.

## References

- RECIST 1.1: Eisenhauer et al., *Eur J Cancer* 45 (2009) 228–247
- SDTM IG (Implementation Guide), CDISC: https://www.cdisc.org/standards/foundational/sdtm
- The inconsistency walkthrough in `data/inconsistency_walkthrough.md` explains every seeded error in plain language with the corresponding RECIST citation

## When in doubt

Read `data/inconsistency_walkthrough.md`. It is the project's clinical-logic spec. If a rule's behavior is unclear, that doc tells you what should happen.