# CLAUDE.md — Klin Oncology Consistency Engine

This file is project memory for Claude Code. Read it before starting any session. It supersedes any earlier project briefs.

---

## 1. What we're building

A clinical data consistency engine for oncology trials. It takes eCRF data filled by site coordinators, converts it to SDTM in-memory, runs cross-domain and medical-logic checks, and reports inconsistencies back to the coordinator in eCRF terms — with LLM-generated plain-English explanations and suggested fixes.

The primary user is the **site coordinator (CSR)** filling the eCRF as patient visits happen. Secondary user is the **CDM (Clinical Data Manager)** at the sponsor reviewing aggregated data. Same engine, two surfaces.

The product wedge: existing validators (Pinnacle21 et al.) speak SDTM and live at the sponsor — they catch errors weeks after they happen. We catch them at the site, in real time, in the language the coordinator already speaks.

## 2. Two demos to build

**Demo 1 — Magic eCRF entry (the headline).** A single-visit entry experience. The coordinator opens SUBJ001's Week 16 visit. The form is pre-populated with this visit's data (already entered). Prior visits (Baseline, Week 8) appear as compact context — a horizontal trajectory strip up top, plus prior-visit columns in the lesion measurement table (read-only, muted). The coordinator hits "Run consistency check" (or it auto-runs). Critical issues appear inline: red border on the offending field, red callout immediately below the section explaining the issue in plain English with one-click actions. The Submit button is gated until critical issues are resolved or flagged.

NOT a multi-tab "fill the whole eCRF" experience. NOT a webpage with tables. The aesthetic is professional medical software — clean white surfaces, sentence case throughout, monospace for data values, severity colors used only meaningfully. Reference points: Veeva CDMS, modern healthcare SaaS.

**Demo 2 — Pipeline ("data in action").** A 3-panel walkthrough using SUBJ001 Week 16 as the focused example. Panel 1: eCRF data (the relevant rows as clean tables). Panel 2: conversion to SDTM with lineage arrows visibly connecting eCRF columns to SDTM rows — this is the hero panel. Panel 3: consistency check — 2–3 findings appear with severity badges; click one to see the drill-down with chart and translated message.

Both demos use the same engine, same data, same Finding object. Build the engine once; render it two ways. Skip standardization as a separate visible stage (fold into conversion). Skip ingest as a separate stage (eCRF data just exists). Use all 3 SDTM domains (TU, TR, RS) — they're needed for the cross-domain findings.

## 3. Pipeline architecture

```
┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌──────────┐    ┌────────────┐
│ Stage 1 │ →  │ Stage 2 │ →  │  Stage 3    │ →  │ Stage 4  │ →  │  Stage 5   │
│ Ingest  │    │  Map    │    │ Normalize   │    │  Check   │    │ Translate  │
└─────────┘    └─────────┘    └─────────────┘    └──────────┘    └────────────┘
                    │                                                  ▲
                    └──────────  Lineage thread ───────────────────────┘
```

- **Stage 1: Ingest** — Read eCRF rows in our pre-defined schema. For the demo, we use pre-prepared CSVs (`ecrf_baseline.csv`, `ecrf_followup.csv`, `ecrf_disease_response.csv`). In production, this stage parses EDC exports.
- **Stage 2: Map** — Transform eCRF rows into SDTM TU / TR / RS rows. Emits *lineage* — every SDTM cell knows which eCRF (form, field, source document) produced it. For the demo, the lineage columns (`source_ecrf_form`, `source_field`, `source_document_id`) are already present on the SDTM rows in the dataset, so the mapping step is a *demonstrated* transformation, not a built-from-scratch ETL.
- **Stage 3: Normalize** — Apply CDISC controlled terminology. `"computed tomography"` → `"CT SCAN"`. `"Partial Response"` → `"PR"`. Unit conversion (cm → mm). For the demo, the dataset already shows normalized values; checks at this stage flag where normalization was needed.
- **Stage 4: Check** — Run the deterministic rule engine against the SDTM data. Produces `Finding` objects. This is the engine core.
- **Stage 5: Translate** — Use the LLM to render each finding as a plain-English message + suggested actions, addressed to the coordinator in eCRF terms. Falls back to deterministic template strings if the LLM is unavailable.

Lineage is created at Stage 2 and consumed at Stage 5. It's how a finding produced at the SDTM layer can be expressed in eCRF language ("On the Disease Response form at Week 16, target response = PR…").

## 4. The dataset

Single fictional study `KLIN-ONC-DEMO-001`. Five subjects (`SUBJ001`–`SUBJ005`). Visits: Baseline + Weeks 8/16/24/32/40/48. Assessment via RECIST 1.1.

Files in `/data`:

| File | Rows | What it is |
|---|---|---|
| `source_evidence.csv` | 35 | Radiology reports (ground truth of what the imaging showed) |
| `ecrf_baseline.csv` | 16 | Baseline Tumor Assessment form rows |
| `ecrf_followup.csv` | 92 | Follow-up Tumor Assessment form rows |
| `ecrf_disease_response.csv` | 30 | Disease Response (RECIST) form rows |
| `patient_history.csv` | 15 | Baseline + nadir context per lesion |
| `tu.csv` | 18 | SDTM-mapped Tumor Identification |
| `tr.csv` | 179 | SDTM-mapped Tumor Results |
| `rs.csv` | 120 | SDTM-mapped Disease Response |
| `expected_issues.csv` | 11 | Ground truth: seeded issues with severity, message, suggested action |
| `checks_catalog.csv` | 9 | Rule catalog with layer, scope, severity |

The TU / TR / RS files have **lineage columns** on every row: `source_ecrf_form`, `source_field`, `source_document_id`. This is the architectural feature that makes back-translation possible — don't lose them in the loader.

A column called `demo_issue_tag` exists on eCRF and SDTM rows; it marks records that are part of a seeded issue. **For benchmarking your engine, ignore this column** (it would not exist in production). Use `expected_issues.csv` as ground truth instead. The engine must work without `demo_issue_tag`.

## 5. The 11 seeded issues and 9 check categories

The dataset is designed around 9 check types catching 11 issues. (Some rules catch one issue; some catch two.)

| Check ID | Layer | Scope | Plain-English rule | Severity when failed |
|---|---|---|---|---|
| TU-001 | Basic | TU | Lesion ID must not be blank, follow T01/NT01/NEW01 convention | Critical |
| TU-002 | Within-domain | TU | Same lesion ID must not represent different lesion identities for same subject | Critical |
| TU-TR-001 | Cross-domain | TU↔TR | Every TR lesion ID must exist in TU | Critical |
| TR-001 | Basic | TR | Diameter results must be numeric and have a unit | Critical |
| TR-002 | Standardization | TR | Numeric measurements should be in mm | Suggested Change |
| TR-003 | Cross-visit | TR | Method changes across visits should be verified | Warning |
| TR-RS-001 | Medical logic | TR↔RS | PR must be supported by ≥30% target sum decrease | Critical |
| TU/TR-RS-002 | Medical logic | TU/TR↔RS | New lesion presence must agree with new-lesion response and overall response | Critical |
| (CR vs non-target) | Medical logic | TR↔RS | Overall CR requires all non-targets absent | Critical |

The 11 ground-truth issues span: 5 Critical, 3 Warning, 3 Suggested Change. See `data/expected_issues.csv` for the full list with `subject_id`, `visit`, `domain_or_sheet`, `variable_or_field`, `message`, and `suggested_action`. Your engine's findings must map to these 11 issue IDs for the benchmark to pass.

## 6. Tech stack

- **Engine:** Python 3.11+, pandas, pytest. Pure deterministic logic.
- **Translator (Stage 5):** Anthropic Claude API via `anthropic` SDK. Model: `claude-haiku-4-5` for cost/latency, with optional `claude-sonnet-4-6` toggle for higher-quality demo runs. API key via `ANTHROPIC_API_KEY` env var.
- **API:** FastAPI + uvicorn. No auth in v0. CORS open to localhost.
- **Frontend:** Vite + React 18 + TypeScript + Tailwind CSS. Recharts for the threshold chart in Demo 1. React Router for the two demos.
- **No database in v0.** Stateless: data flows through memory. Persistence is v1.

## 7. Project layout

```
project-root/
├── CLAUDE.md                   (this file)
├── data/                       (synthetic dataset, see Section 4)
├── engine/
│   ├── __init__.py
│   ├── loader.py               # load CSVs → pandas DataFrames
│   ├── finding.py              # @dataclass Finding(rule_id, severity, lineage, evidence, ...)
│   ├── registry.py             # @rule decorator + RULES dict
│   ├── rules/
│   │   ├── __init__.py
│   │   ├── basic.py            # TU-001, TR-001 (field-level)
│   │   ├── integrity.py        # TU-TR-001 (ghost lesion), TU-002 (duplicate ID)
│   │   ├── standardization.py  # TR-002 (mm/cm, term standardization)
│   │   ├── response_math.py    # TR-RS-001 (PR threshold), CR+non-target conflict, PD threshold
│   │   ├── cross_visit.py      # TR-003 (method change), large measurement drop, visit window
│   │   └── new_lesion.py       # TU/TR-RS-002 (new lesion vs response conflict)
│   └── run.py                  # CLI entry: load → run all rules → emit findings.json
├── translator/
│   ├── __init__.py
│   ├── prompts.py              # prompt templates for LLM
│   ├── llm.py                  # Anthropic API client (with retries, timeouts)
│   ├── templater.py            # deterministic fallback strings
│   └── translate.py            # orchestrator: takes Finding → returns translated Finding
├── api/
│   ├── main.py                 # FastAPI app
│   └── routes/
│       ├── run.py              # POST /run — run checks on demo data, return findings
│       ├── translate.py        # POST /translate — translate a finding
│       └── data.py             # GET /data/{filename} — serve the synthetic data to frontend
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       │   ├── Home.tsx               # links to both demos
│       │   ├── MagicDemo.tsx          # Demo 1: eCRF entry experience
│       │   └── PipelineDemo.tsx       # Demo 2: data-in-action stage walkthrough
│       └── components/
│           ├── SeverityBadge.tsx
│           ├── FindingCard.tsx
│           ├── EvidenceTable.tsx
│           ├── ChartTemplate.tsx      # sum-of-diameters trajectory with thresholds
│           ├── ECRFTabs.tsx           # Baseline / Follow-up / Disease Response tabs
│           ├── InlineFlag.tsx         # per-field issue indicator
│           └── PipelineStage.tsx      # one stage in Demo 2
├── tests/
│   ├── test_rules.py            # one test per rule
│   ├── test_benchmark.py        # 11/11 on ground truth
│   └── test_translator.py       # template fallback path always works
├── benchmark.py                 # CLI: compute precision/recall vs expected_issues.csv
└── README.md
```

## 8. Stage-by-stage build plan

This is the build sequence for Claude Code. Each stage is a self-contained session with a clear acceptance test. Don't merge stages — finish one, verify, then start the next.

### Stage 0 — Setup (~30 min)

**Goal:** Repo initialized, data in place, dev environments run.

**Build:**
- Project skeleton matching Section 7 layout (empty files OK)
- `requirements.txt` (`pandas`, `pytest`, `fastapi`, `uvicorn`, `anthropic`, `pydantic`)
- `frontend/package.json` with Vite + React + TS + Tailwind + Recharts + React Router
- `.env.example` with `ANTHROPIC_API_KEY=` and `.gitignore` including `.env`
- All 10 CSVs already in `/data` (don't move them)

**Acceptance:**
- `pytest` runs (zero tests, but no errors)
- `npm run dev` starts the frontend at localhost:5173 with a "Hello" page

### Stage 1 — Engine core + 3 rules (~90 min)

**Goal:** First end-to-end run: load CSVs → execute 3 rules → produce findings JSON.

**Build:**
- `engine/loader.py` — `load_data(data_dir)` returns dict of pandas DataFrames keyed by `tu`, `tr`, `rs`, `ecrf_baseline`, `ecrf_followup`, `ecrf_disease_response`, `patient_history`, `source_evidence`
- `engine/finding.py` — `Finding` dataclass with: `rule_id, severity, subject_id, visit, domain, variable, lineage (form, field, source_doc), evidence_rows, raw_message, template_id, template_params`
- `engine/registry.py` — `@rule(id, severity, layer)` decorator that appends to `RULES`
- `engine/rules/integrity.py` — implement TU-TR-001 (ghost lesion: every TR.TRLNKID must exist in TU for same subject)
- `engine/rules/response_math.py` — implement TR-RS-001 (PR threshold: when RS.RSORRES=PR at a visit, the TR sum-of-diameters at that visit must show ≥30% decrease from baseline)
- `engine/rules/basic.py` — implement TU-001 (TULNKID present + follows T01/NT01/NEW01 pattern)
- `engine/run.py` — CLI: `python -m engine.run --data ./data --out findings.json`

**Acceptance:**
- `python -m engine.run` produces a `findings.json` file
- The file contains findings for at least these issue IDs from `expected_issues.csv`: CRIT-002 (TR lesion T03 not in TU for SUBJ003), CRIT-003 (PR threshold fail SUBJ001 Week 16)
- All findings have non-empty `lineage` fields (form, field, source_doc)
- No findings produced for the clean subjects (verify by spot-check)

### Stage 2 — Complete rule set (~90 min)

**Goal:** Catch 11/11 ground-truth issues. Zero false positives on clean records.

**Build remaining rules:**
- `engine/rules/integrity.py` — TU-002 (duplicate TULNKID with conflicting TULOC/TUORRES within same subject)
- `engine/rules/new_lesion.py` — TU/TR-RS-002 (TU has NEW lesion at a visit AND RS at same visit says no new lesions / response = PR)
- `engine/rules/response_math.py` — CR-vs-non-target rule (RSORRES=CR for overall response BUT a non-target in TR is PRESENT at same visit)
- `engine/rules/standardization.py` — TR-002 (flag rows where `TRORRESU != "mm"` even if `TRSTRESU == "mm"`)
- `engine/rules/cross_visit.py` — TR-003 (TRMETHOD changes across visits for same subject) + large drop (visit-to-visit % change exceeding threshold) + visit window (TRDTC outside expected window)

**Build `benchmark.py`:**
- Load `findings.json` produced by engine
- Load `data/expected_issues.csv`
- Match by `subject_id` + `visit` + `domain_or_sheet`
- Output precision, recall, and a table of (expected ↔ found) matches
- Print false positives and false negatives explicitly

**Acceptance:**
- `python benchmark.py` shows 11 expected, 11 found, 0 false positives
- All severities (Critical / Warning / Suggested Change) represented in the findings
- `pytest tests/test_rules.py` passes — one test per rule asserting it fires on its target issue and not on clean data

### Stage 3 — Stage 5 (LLM translation) (~90 min)

**Goal:** Each finding has a coordinator-friendly message generated by the LLM, with deterministic fallback.

**Build:**
- `translator/prompts.py` — system + user prompt templates. Example structure below.
- `translator/llm.py` — Anthropic API client. Configurable model (`claude-haiku-4-5` default). Timeout 5s. Retry once on transient error. Returns parsed `{user_message, suggested_actions: [...], confidence}`.
- `translator/templater.py` — deterministic template strings per rule_id. Always available, no API needed. Used as fallback or in tests.
- `translator/translate.py` — main entry: takes a `Finding`, attempts LLM call, falls back to template on any error or if `ANTHROPIC_API_KEY` is unset. Returns `Finding` with `user_message` and `suggested_actions` populated.

**Prompt design** (skeleton; tune per rule):
```
System: You are a clinical data quality assistant explaining inconsistencies to a 
site coordinator filling an eCRF for an oncology trial (RECIST 1.1). 
Speak in eCRF/clinical terms only — never mention SDTM, TUSTRESC, RSORRES, 
or any technical schema names. Refer to forms by name and fields by their 
human label. Be concise: 2-3 sentences for the message, 1-2 specific 
suggested actions.

User: 
Issue type: {rule_id}
Severity: {severity}  
Subject: {subject_id}, visit: {visit}
Affected eCRF form: {lineage.form}
Affected field: {lineage.field}  
Evidence: {evidence_rows in plain JSON}
RECIST rule violated (for your reference): {citation}

Output JSON with keys: user_message, suggested_actions (array of strings).
```

**Acceptance:**
- All 11 findings have `user_message` populated
- Each message references the eCRF form name and field by their human label, never SDTM variable names
- Run `pytest tests/test_translator.py` with no API key set → all tests pass (using fallback templates)
- Run with API key set → at least one finding renders differently via LLM than via template (proves LLM path is wired)

### Stage 4 — API layer (~60 min)

**Goal:** Engine reachable over HTTP; frontend can fetch findings and the underlying data.

**Build:**
- `api/main.py` — FastAPI app, CORS for localhost:5173
- `api/routes/run.py` — `POST /api/run` runs the engine against `/data`, returns translated findings as JSON. Optional query params: `enable_llm` (default true), `model` (default `claude-haiku-4-5`).
- `api/routes/data.py` — `GET /api/data/{name}` serves any CSV from `/data` (whitelisted filenames) so the frontend can show raw eCRF and SDTM tables in Demo 2.
- `api/routes/translate.py` — `POST /api/translate` takes a single Finding-like dict, returns the translated version. Used for demo-time re-renders without re-running checks.

**Acceptance:**
- `uvicorn api.main:app --reload` starts cleanly
- `curl -X POST localhost:8000/api/run` returns valid JSON with 11 findings, all translated
- `curl localhost:8000/api/data/tu.csv` returns the TU CSV contents

### Stage 5 — React shared components (~60 min)

**Goal:** Foundation pieces both demos use.

**Build:**
- Vite + React + TS + Tailwind + Recharts + React Router scaffold (probably done in Stage 0; verify)
- `components/SeverityBadge.tsx` — pill, red/amber/blue per severity
- `components/EvidenceTable.tsx` — renders an array of row objects as a monospace table, highlights specific cells
- `components/FindingCard.tsx` — compact card: severity badge, rule_id, subject, visit, user_message, "view details" expansion
- `components/ChartTemplate.tsx` — sum-of-diameters line chart with horizontal threshold lines (Recharts). Used in PR_THRESHOLD and PD_THRESHOLD findings.
- `routes/Home.tsx` — landing page with two buttons: "Magic Demo" / "Pipeline Demo"
- Routing wired up

**Acceptance:**
- Home page loads, both demo routes navigable
- FindingCard renders with mock data
- ChartTemplate renders the SUBJ001 PR-threshold scenario (baseline 63mm, Week 16 56.5mm, threshold line at 44mm) correctly

### Stage 6 — Demo 2: Pipeline (~90 min) — REVISED

**Goal:** 3-panel walkthrough of one patient (SUBJ001 Week 16) showing eCRF → SDTM → findings, with visible lineage.

**Build `routes/PipelineDemo.tsx`:**

- Three large panels stacked vertically. Each has a clear title in 16px / 500 and a "next" affordance.
- **Panel 1 — "eCRF data"**: pull rows from `ecrf_followup.csv` and `ecrf_disease_response.csv` for SUBJ001 Week 16. Render as clean tables with sentence-case headers (`Lesion`, `Location`, `Diameter`, `Method`, `Response`). Monospace for data values. ~6–8 rows total — not a wall.
- **Panel 2 — "Conversion to SDTM"** (the hero): pick 2 eCRF rows (one measurement row, one response row). Show each on the left, with arrows connecting to the TU/TR/RS rows it produces on the right. Visually highlight the `source_ecrf_form` and `source_field` lineage columns on the SDTM side — that's the visible architectural insight.
- **Panel 3 — "Consistency check"**: animated tick-in of 2–3 findings. Each has severity badge + 1-line message. Click the PR-threshold finding → drill-down with the chart-with-threshold visualization (same component as Magic Demo) and the LLM-translated message.
- Persistent breadcrumb at top: `SUBJ001 / Week 16 / 2026-04-25`.
- Do NOT show standardization as a separate panel; mention it briefly inside Panel 2.
- Do NOT show ingestion at all.

**Acceptance:**
- Walkable end-to-end in <60 seconds.
- Lineage arrows visible and labelled in Panel 2.
- All data from `/data` CSVs, not mocked.
- Single subject throughout.

### Stage 7 — Demo 1: Magic eCRF entry (~150 min) — REVISED

**Goal:** A realistic single-visit eCRF entry experience with inline error flagging that catches the inconsistency between this visit's entered data and the patient's prior visits.

**Scenario:**
- The coordinator opens SUBJ001's Week 16 visit. Two form sections: Tumor Assessment, Disease Response.
- The form is pre-filled with the data in `ecrf_followup.csv` and `ecrf_disease_response.csv` for SUBJ001 Week 16 — including the seeded TR-RS-001 issue (Target response = Partial Response, but math doesn't support it).
- The coordinator hits "Run consistency check" (or it auto-runs on page load for demo purposes).
- A critical issue appears inline: red border on the Target Response dropdown, red callout below the Disease Response section with plain-English message and 3 action buttons.

**Visual aesthetic (this is what the engineer build missed):**
- Faux EDC chrome strip at the top (study name + coordinator name).
- Patient context strip: subject ID prominent (`SUBJ001` in 18px monospace), visit name, date, and a compact horizontal visit trajectory showing Baseline → Week 8 → Week 16 (current, highlighted in indigo) → Week 24 (future, muted).
- **Tumor Assessment section**: table with columns for Baseline, Week 8, Week 16. Prior columns read-only and muted. Week 16 column has inputs. Auto-computed "Sum of target diameters: 56.5 mm (baseline 63)" below the table.
- **Disease Response section**: 4 dropdowns in a 2-column grid (Target / Non-target / New lesions / Overall). Target Response dropdown has a red border and a red alert icon beside it. Overall Response also bordered red because it inherits the conflict.
- **Inline issue callout** below Disease Response: red-tinted background, 3 px red border-left, no border-radius on the callout. "Critical" badge in sentence case (NOT "CRITICAL"), rule ID monospaced, 13 px / 500 title, 13 px message body with specific numbers monospaced inline. 3 action buttons: "Change to SD" / "Flag for investigator" / "View trajectory".
- **Footer**: "1 critical issue must be resolved before submission". Submit button visually disabled.
- Severity badge colours: Critical = red (background Red 50, text Red 800, badge accent Red 600). Warning = amber. Suggested Change = blue.
- Clinical aesthetic: white surfaces, 0.5 px borders, sentence case, monospace for all data values (lesion IDs, measurements, codes, dates), generous whitespace.
- NOT a webpage with tables. NOT a generic dashboard. Reference: medical SaaS UI.

**Actions:**
- "View trajectory" opens a drawer with the `ChartTemplate` showing sum-of-diameters across all visits with the 30 % threshold line drawn in (same component as Pipeline Panel 3).
- "Change to SD" updates Target Response and Overall Response to "Stable Disease" and the issue callout shows resolved state.
- "Flag for investigator" turns the callout amber and shows "Flagged for investigator review" with a textarea for rationale; the Submit button becomes enabled with a note that flagged issues will be reviewed.

**Acceptance:**
- Loading the page shows the Week 16 form pre-filled, the inline issue visible after a single click on Run.
- "View trajectory" opens the chart drilldown.
- "Change to SD" updates the dropdowns and clears the issue.
- "Submit visit" is disabled until the critical issue is resolved or flagged.

### Stage 8 — Polish (~60 min)

**Goal:** Demo-ready. Loads fast, looks clean, narrative is clear.

**Build:**
- Loading skeletons during API calls
- Severity colors consistent across both demos
- Brief narrative tooltips at key moments ("This is the lineage thread", "This finding was generated by the LLM")
- A reset button on Magic Demo to re-load clean state
- README with run instructions

**Acceptance:**
- Cold-start to first interactive screen <3 seconds
- Both demos clickable from Home in <5 seconds total
- No console errors

---

## 9. LLM integration (Stage 5) — detailed guidance

The LLM is used **only** for translating findings, not for detecting them. The deterministic engine produces structured Finding objects; the LLM renders them as natural language. This separation is critical.

**Why this matters:**
- The rule engine output is auditable and reproducible (regulatory requirement)
- The LLM never *decides* whether something is an issue — only how to describe it
- A hallucination in the LLM produces a bad explanation, not a bad finding
- We can run completely without the LLM (template fallback) — the product still works

**Prompt principles:**
- The system prompt forbids SDTM terminology in the output
- The user prompt gives the model: rule_id, severity, lineage (form/field), evidence rows, and a citation
- The model returns structured JSON ({user_message, suggested_actions})
- Cap output length: 2-3 sentences for message, 1-2 short suggested actions
- Temperature: 0.2 (some variation in phrasing, but consistent factual content)

**Failure modes to handle:**
- API timeout → use template fallback for this finding
- Malformed JSON output → retry once, then template fallback
- API key missing → all findings use templates (and log a warning at startup)
- Rate limit → exponential backoff, then template fallback

**Caching:**
- Cache LLM outputs keyed by `(rule_id, lineage, evidence_hash)`. Same finding → same message across re-runs.
- In-memory dict is enough for v0; Redis for v1.

## 10. Principles (do not drift)

1. **Rule-wise, not error-wise.** Never write `check_crit_001()`. Write `check_pr_threshold()` and let it fire on every visit where PR is claimed below 30%.

2. **Findings carry lineage and evidence.** Every Finding includes the eCRF form name, field name, source document ID, and the actual rows from TU/TR/RS used to make the decision. The UI uses these directly.

3. **Deterministic core, LLM only at Stage 5.** Never call the LLM during rule evaluation. The check engine is pure Python with no external dependencies. The translator is the only LLM consumer.

4. **Speak the coordinator's language.** User-facing text never mentions SDTM variable names. Always use eCRF form and field labels. The system prompt enforces this; the templater respects it.

5. **Severity drives behavior.** Critical blocks submission. Warning shows banner with acknowledge. Suggested Change offers one-click auto-fix. These mappings are explicit in the UI, not implicit.

6. **No false positives on clean data.** Patient 01 (SUBJ001 through Week 8) and most clean records should produce zero findings. Don't write rules that fire spuriously — better to miss a subtle issue than to cry wolf.

7. **Engine works without the API and without the frontend.** `python -m engine.run --data ./data --out findings.json` must always work. The API and React app are presentation layers around it.

## 11. Out of scope for v0

- Anomaly detection layer (LLM looking for novel patterns the rules don't cover). Architect for it (have a NOVEL finding type with an LLM template) but don't build it.
- Multi-study or multi-customer. Hardcode `KLIN-ONC-DEMO-001`.
- Authentication, RBAC, multi-tenancy.
- EDC integration. The eCRF tabs in Magic Demo simulate an EDC, not connect to one.
- Configurable rules per sponsor. All rules are hardcoded in the engine.
- iRECIST, RECIST 1.2, or any therapeutic area other than oncology.
- Real ALCOA+ audit trail. We log to console; persistence is v1.

## 12. References

- **RECIST 1.1:** Eisenhauer et al., *Eur J Cancer* 45 (2009) 228–247
- **SDTM IG:** CDISC Implementation Guide, current version
- **CDISC controlled terminology:** for TR-002 standardization rule
- **Inconsistency walkthrough:** `data/source_evidence.csv` and `data/expected_issues.csv` together tell the clinical story behind each seeded issue. Read both before writing rules.

## When in doubt

Read `data/expected_issues.csv` — it specifies, in plain English, exactly what each of the 11 findings should look like, including the `message` and `suggested_action` strings. Your engine's output should match the semantics of those fields. Your LLM-translated output should be at least as clear and ideally more personalized.