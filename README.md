# Klin — Oncology Consistency Engine

An eCRF-first data consistency engine for oncology trials. Catches RECIST 1.1
inconsistencies at the site, in real time, in the language the coordinator
already speaks.

```
eCRF (3 forms)  ──Map──▶  SDTM (TU/TR/RS, with lineage)  ──Check──▶  Findings  ──Translate──▶  Coordinator-facing UI
```

The deterministic rule engine is the trusted core. The LLM (Claude Haiku 4.5)
is used only at the translation stage to render findings in plain English with
suggested actions, with a deterministic templater as fallback.

## Quick start

Prereqs: Python 3.11+, Node 20+, an Anthropic API key (optional but recommended).

```bash
# 1. Python deps
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 2. LLM key (optional)
cp .env.example .env
# edit .env and paste ANTHROPIC_API_KEY=...

# 3. Frontend deps
cd frontend && npm install && cd ..
```

Run the three processes (each in its own terminal):

```bash
# Engine CLI (one-shot)
.venv/bin/python -m engine.run --data ./data --out findings.json

# API
.venv/bin/uvicorn api.main:app --port 8000

# Frontend
cd frontend && npm run dev
```

Open <http://localhost:5173>.

## Demos

- **Magic Demo** (`/magic`) — the headline. Coordinator-facing eCRF entry
  experience for SUBJ001. Run consistency check, see inline indicators with
  one-click actions: auto-fix for suggested changes, acknowledge for warnings,
  flag for critical findings. Submit gated by unresolved criticals.

- **Pipeline Demo** (`/pipeline`) — the technical proof. Walk SUBJ001 through
  five stages (Ingest → Map → Normalize → Check → Translate) with real data
  at every step and the lineage thread visible throughout.

## Engine

All rules live under `engine/rules/`. They produce `Finding` objects with
lineage (`source_ecrf_form`, `source_field`, `source_document_id`) and
evidence rows. The 9 check categories catch 11 seeded issues:

| Rule           | Severity         | Catches    |
|----------------|------------------|------------|
| `TU-001`       | Critical         | sanity     |
| `TU-002`       | Critical         | CRIT-001   |
| `TU-TR-001`    | Critical         | CRIT-002   |
| `TR-001`       | Critical         | sanity     |
| `TR-002`       | Suggested Change | SUG-001/2/3|
| `TR-003`       | Warning          | WARN-001   |
| `LARGE_DROP`   | Warning          | WARN-002   |
| `VISIT_WINDOW` | Warning          | WARN-003   |
| `TR-RS-001`    | Critical         | CRIT-003   |
| `TU/TR-RS-002` | Critical         | CRIT-004   |
| `TR-RS-003`    | Critical         | CRIT-005   |

Validate against the seeded dataset:

```bash
.venv/bin/python -m engine.run --data ./data --out /tmp/findings.json
.venv/bin/python benchmark.py --findings /tmp/findings.json --truth data/expected_issues.csv
.venv/bin/pytest tests/ -q
```

Expected: 11/11 recall, 11/11 precision, all tests green.

## API

FastAPI at `http://localhost:8000`. Routes:

- `GET  /api/health`
- `POST /api/run?enable_llm=true&model=claude-haiku-4-5` — runs the engine and
  returns translated findings.
- `POST /api/translate` — translate a single Finding-shaped payload.
- `GET  /api/data` / `GET /api/data/{name}` — serves the synthetic CSVs.

## Project layout

```
engine/            deterministic rule engine + CLI
translator/        LLM (Anthropic) + deterministic fallback
api/               FastAPI wrapper
frontend/          Vite + React + TS + Tailwind + Recharts + React Router
tests/             pytest (rules, benchmark, translator)
data/              synthetic dataset (10 CSVs, lineage on SDTM rows)
benchmark.py       compare findings to data/expected_issues.csv
```

## Demo script (90 seconds)

1. **Workspace** (`/`) — point at the run-summary tile ("11 findings, 5 Critical
   · 3 Warning · 3 Suggested"). Note the API base, the synthetic-data quick
   links, and the two demo tiles.
2. **Magic Demo** (`/magic`) — already on Disease Response.
   - Click **Run consistency check**. The Week 16 row gets red and blue
     chips next to `target_lesion_response_raw` and `overall_response_raw`.
   - Click the red `TR-RS-001` chip → drawer slides in from the right.
     Read the LLM message, scroll to the SUMDIAM chart with the PR-threshold
     reference line, point at the source document in lineage.
   - Click **Flag for investigator** → the Critical is acknowledged; Submit
     unlocks.
   - Switch to **Baseline** tab. T01 has a blue `TR-002` chip on the Method
     cell. Open the drawer → click **Auto-fix and resolve** → the cell
     rewrites from `computed tomography` to `CT SCAN`.
   - Reload the page — edits and resolutions persist.
3. **Pipeline Demo** (`/pipeline`) — step the left rail Ingest → Map → Normalize
   → Check → Translate. Pause on **Map** to highlight the lineage columns
   (`source_ecrf_form`, `source_field`, `source_document_id`) — this is how
   coordinator-facing translations get back to the right form and field.

## Out of scope (for v0)

- Anomaly detection (LLM looking for novel patterns the rules don't cover) —
  architected for it (NOVEL template id reserved) but not built.
- Authentication, multi-tenancy, server-side persistence (client-side
  localStorage covers per-session state only).
- EDC integration (Magic Demo simulates one).
- Backend re-run with eCRF overrides — edits in the Magic Demo update local
  state and resolve the matching finding, but don't push back through the
  mapper to re-evaluate the engine. Honest v0 behaviour.
- iRECIST or any therapeutic area other than oncology.
