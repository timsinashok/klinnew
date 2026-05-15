# CLAUDE.md — Klin Oncology Consistency Engine

This file is project memory for Claude Code. Read it before starting any session. It supersedes any earlier project briefs.

---

## 1. What we're building

A clinical data consistency engine for oncology trials. It takes eCRF data filled by site coordinators, converts it to SDTM in-memory, runs cross-domain and medical-logic checks, and reports inconsistencies back to the coordinator in eCRF terms — with LLM-generated plain-English explanations and suggested fixes.

The primary user is the **site coordinator (CSR)** filling the eCRF as patient visits happen. Secondary user is the **CDM (Clinical Data Manager)** at the sponsor reviewing aggregated data. Same engine, two surfaces.

The product wedge: existing validators (Pinnacle21 et al.) speak SDTM and live at the sponsor — they catch errors weeks after they happen. We catch them at the site, in real time, in the language the coordinator already speaks.

## 2. Two demos to build

**Demo 1 — "The magic demo" (the headline).** A coordinator-facing eCRF entry experience. The user sees a realistic eCRF with multiple tabs (Baseline / Follow-up / Disease Response), fills in a patient's visit, hits Submit (or "Run consistency check"), and sees errors flagged inline with plain-English messages and one-click actions. Built for emotional impact in a sales meeting.

**Demo 2 — "Data in action" (the technical proof).** Shows the full pipeline as a sequence: eCRF input → mapping → SDTM → checks → translated findings. Each stage is visualizable, with the lineage thread visible throughout. Built for a CTO or technical buyer who needs to understand what's happening under the hood.

Both demos use the same engine. Both use the same synthetic dataset (`/data`). Build the engine once; render it two ways.

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

### Stage 6 — Demo 2: Pipeline ("data in action") (~90 min)

**Goal:** Walk through the 5 stages of the pipeline with real data. Each stage clickable, lineage thread visible.

**Build `routes/PipelineDemo.tsx`:**
- Multi-step layout: 5 panels horizontally (Stages 1-5) or vertical stepper
- Stage 1 (Ingest): show `ecrf_baseline.csv` and `ecrf_followup.csv` for SUBJ001 in a readable table
- Stage 2 (Map): show side-by-side: eCRF row on left, the SDTM TU+TR rows it produced on right, with arrows/highlights showing the mapping. Pick 1-2 hero rows.
- Stage 3 (Normalize): show a before/after for the standardization examples: `"computed tomography"` → `"CT SCAN"`, `"Partial Response"` → `"PR"`
- Stage 4 (Check): show the engine running (visually: animated checks list ticking through), then the resulting findings count
- Stage 5 (Translate): show one finding raw (technical SDTM-language version) vs translated (user_message), demonstrating the LLM rendering
- Lineage indicator: persistent breadcrumb at top showing the subject/visit being followed

**Acceptance:**
- Demo walkable end-to-end in <90 seconds for a viewer
- Each stage shows actual data from the API, not mocked
- The same subject (SUBJ001) is traced through all 5 stages

### Stage 7 — Demo 1: Magic eCRF demo (~120 min)

**Goal:** The headline experience. Coordinator fills eCRF, hits validation, sees inline errors with actions.

**Build `routes/MagicDemo.tsx`:**
- Three tabs: "Baseline" / "Follow-up" / "Disease Response"
- Pre-fill SUBJ001's complete data across all visits (this is the data that contains 2-3 seeded issues for this subject — PR threshold fail at Week 16, plus auto-fixable standardization issues)
- Field-level eCRF form UI: dropdowns for codes, inputs for measurements, date pickers
- Top-right "Run consistency check" button (or auto-run on tab switch)
- After check runs:
  - Inline indicators next to fields with issues (yellow exclamation for Warning, red for Critical, blue for Suggested Change)
  - Click an indicator → drawer/modal with the FindingCard, evidence, ChartTemplate (for response-math findings), and action buttons
  - Actions per severity: Critical → "Flag for investigator review" / "Edit field". Warning → "Acknowledge". Suggested Change → "Auto-fix" (one-click apply)
- Submit button: gated by Critical findings (must be flagged or resolved)
- Right rail summary: count of findings by severity

**Acceptance:**
- Loading SUBJ001 Week 16 Disease Response tab and hitting "Run consistency check" produces:
  1. A red indicator next to the `target_response` field (PR threshold)
  2. A blue indicator on at least one field in Baseline (standardization)
- Clicking the red indicator opens the drilldown showing the chart, the evidence rows, and the translated message
- Clicking "Auto-fix" on the blue indicator updates the form field value

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