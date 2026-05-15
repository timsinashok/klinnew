# Inconsistency Walkthrough — v0 Demo Data

5 synthetic patients in study `DEMO-ONC-001`. One is clean, four have seeded errors. **11 errors total**, spanning all four categories we discussed:

- **intra-domain obvious** — basic data quality (none seeded; EDC catches these)
- **intra-domain non-obvious** — RECIST 1.1 rules inside one domain (4 seeded)
- **cross-domain obvious** — references that don't resolve, missing reconciliations (2 seeded)
- **cross-domain non-obvious** — medical-logic mismatches across domains (5 seeded)

This is exactly the layer your engine should target. The "obvious" intra-domain checks are already done by the EDC before SDTM mapping, so we skipped them — they're not useful for benchmarking the kind of engine you want to build.

---

## How to read the data

**TU (Tumor Identification)** — one row per lesion per subject. The lesion's identity (TARGET / NON-TARGET / NEW), where it is, and when it was first identified.

**TR (Tumor Results)** — one row per lesion per visit per test. The actual measurements over time (LDIAM, SAXIS, TUMSTATE) plus a derived SUMDIAM row per visit.

**RS (Disease Response)** — one row per response type per visit. Four rows per visit (Target Response, Non-Target Response, New Lesions Present, Overall Response), plus one Best Overall Response row at end of study.

**`TULNKID = TRLNKID`** is the join key. Every TR measurement should resolve to a TU row by `(USUBJID, TULNKID)`.

---

## Patient 01 — SITE01-0001 — CLEAN (control)

**Clinical story:** 2 target lesions (liver 30mm, lung 22mm) + 1 non-target in peritoneum. Patient responds to therapy: sum of diameters goes 52 → 40 → 32 → 30mm across visits. At C4D1 the 38% decrease qualifies for PR; maintained at C6D1. Best Overall Response = PR.

**Errors:** none. Use this patient to validate that your engine doesn't false-positive on clean data.

---

## Patient 02 — SITE01-0002 — Premature PR claim + BOR mismatch + non-target measurement

**Clinical story:** 2 target lesions (liver 40mm, lung 35mm, sum=75) + 1 non-target lymph node. Investigator over-calls the response: claims PR starting at C2D1 even though the sum has only dropped 20%. Real PR (≥30% drop) finally happens at C6D1.

### ERR-001 — Non-target lesion has a numeric measurement
- **Location:** TR, SCREENING visit
- **What's there:** Row with `TRLNKID=NT1, TRTESTCD=LDIAM, TRORRES=15, TRORRESU=mm`
- **Why it's wrong:** NT1 is identified in TU as `TUSTRESC=NON-TARGET`. Per RECIST 1.1, non-targets are tracked qualitatively only — PRESENT, ABSENT, or EQUIVOCAL. They never get a numeric diameter.
- **The check:** *"For any TR row where the linked TU row has TUSTRESC=NON-TARGET, TRTESTCD must be TUMSTATE only."*
- **Severity:** MEDIUM. Doesn't usually change the response judgment, but is a data-collection error and can cascade if the investigator accidentally includes that 15mm in a sum.

### ERR-002 — False PR at C2D1
- **Location:** RS, C2D1
- **What's there:** `TRGRESP=PR, OVRLRESP=PR`
- **Why it's wrong:** Baseline sum = 75mm. C2D1 sum = 60mm. Change = (60−75)/75 = **−20%**. RECIST 1.1 PR criterion is ≥30% decrease from baseline. 20% is SD territory.
- **The check (the gold-mine kind):** *"For every RS row with RSTESTCD=TRGRESP and RSORRES=PR, retrieve the TR SUMDIAM at this visit and at baseline; require (baseline−current)/baseline ≥ 0.30."*
- **Severity:** HIGH. Mis-classifying SD as PR can affect efficacy reporting and dose decisions.

### ERR-003 — False PR at C4D1
- **Location:** RS, C4D1
- **What's there:** `TRGRESP=PR, OVRLRESP=PR`
- **Why it's wrong:** Sum = 55mm. Change = (55−75)/75 = **−27%**. Still below 30%.
- **The check:** same as ERR-002.
- **Severity:** HIGH.
- **Note:** This is the same check firing on a second visit. Your engine should report both occurrences — clinical reviewers want to see each instance, not a dedup'd summary.

### ERR-004 — BOR is better than any per-visit response
- **Location:** RS, END OF STUDY
- **What's there:** `BESTRESP=CR`
- **Why it's wrong:** Pull all `OVRLRESP` rows for this subject in order: SD, PR, PR, PR. The best of these is PR. BOR cannot be CR if no visit ever recorded CR.
- **The check:** *"BESTRESP must equal the best Overall Response observed across visits, subject to RECIST confirmation rules."* (Confirmation rules: PR/CR usually require confirmation at a subsequent visit ≥4 weeks later; PD doesn't.)
- **Severity:** HIGH.

---

## Patient 03 — SITE01-0003 — Lymph node measurability + false CR

**Clinical story:** 1 target lymph node + 1 non-target in liver. The lymph node responds well (short axis 12 → 9 → 7mm). Investigator calls CR at C4D1 when the lymph node has dropped to 7mm, but the non-target in the liver is *still PRESENT*.

### ERR-005 — Lymph node selected as target with sub-threshold short axis
- **Location:** TU + TR, SCREENING
- **What's there:** `TU.TULOC=LYMPH NODE, TUSTRESC=TARGET` paired with `TR.SAXIS=12mm` at baseline.
- **Why it's wrong:** RECIST 1.1 has different measurability thresholds depending on lesion type:
  - Non-nodal lesions: longest diameter ≥10mm to be a measurable target
  - **Lymph nodes: short axis ≥15mm to be a measurable target**
  - Lymph nodes with short axis 10–<15mm are considered non-target only
  - Lymph nodes with short axis <10mm are normal (don't track at all)
- A 12mm lymph node should never have been chosen as a target.
- **The check:** *"For every TU row with TUSTRESC=TARGET and TULOC=LYMPH NODE, the baseline TR row with TRTESTCD=SAXIS must have TRSTRESN ≥ 15."*
- **Severity:** MEDIUM. The protocol violation matters for eligibility/quality; once enrolled, the downstream measurements may still be informative but shouldn't carry the same RECIST weight.

### ERR-006 — Overall CR while a non-target is still present
- **Location:** RS, C4D1
- **What's there:** `OVRLRESP=CR` alongside `NTRGRESP=Non-CR/Non-PD` (and TR shows `NT1 TUMSTATE=PRESENT`).
- **Why it's wrong:** RECIST 1.1 Overall CR requires:
  - All target lesions resolved (or, for nodal targets, short axis <10mm), **AND**
  - All non-target lesions absent (or, for nodal non-targets, <10mm short axis), **AND**
  - No new lesions
- A non-target that's still PRESENT means at best PR, not CR.
- **The check:** *"If RSTESTCD=OVRLRESP and RSORRES=CR at a visit, then at the same visit (a) all TR TUMSTATE values for non-targets must be ABSENT, and (b) RSTESTCD=NTRGRESP must have RSORRES=CR."*
- **Severity:** HIGH.

---

## Patient 04 — SITE01-0004 — RECIST lesion-count caps + new-lesion reconciliation

**Clinical story:** Investigator over-enrolls lesions (6 targets including 3 in liver). Disease is stable through C2D1. At C4D1, imaging picks up a new brain metastasis — TU records it correctly as a NEW lesion, but the response form forgets to flip `NEWLPRES` to Y.

### ERR-007 — Too many target lesions, and too many per organ
- **Location:** TU, SCREENING
- **What's there:** 6 target lesions for this subject (L1–L6). Within those, L1, L2, L3 are all in LIVER.
- **Why it's wrong:** RECIST 1.1 measurable disease rules:
  - **Max 5 target lesions per subject**
  - **Max 2 target lesions per organ**
- Both caps are exceeded.
- **The check:** Two checks really:
  - *"Count of TU rows per (USUBJID, TUSTRESC=TARGET) must be ≤ 5."*
  - *"Count of TU rows per (USUBJID, TUSTRESC=TARGET, TULOC) must be ≤ 2."*
- **Severity:** HIGH. This is a protocol/eligibility-quality issue; over-counting target lesions inflates the baseline sum and can mask response.

### ERR-008 — New lesion in TU but not in RS
- **Location:** TU vs RS, C4D1
- **What's there:** TU has a row `L7, TUSTRESC=NEW, TULOC=BRAIN, VISIT=C4D1`. RS at C4D1 has `NEWLPRES=N`.
- **Why it's wrong:** TU is the system of record for *which lesions exist*. RS.NEWLPRES at any visit must agree with whether TU has a NEW lesion at that visit. Disagreement means either the radiologist's TU record or the investigator's RS judgment is wrong — both need to be reconciled. (Also, the C4D1 Overall Response should be PD due to the new lesion, regardless of size changes — so the OVRLRESP=SD at C4D1 is downstream-wrong, but the primary check is the NEWLPRES mismatch.)
- **The check:** *"For each (USUBJID, VISIT), RS.NEWLPRES must equal 'Y' iff TU contains at least one row with TUSTRESC=NEW and VISIT=this visit."*
- **Severity:** HIGH.

---

## Patient 05 — SITE01-0005 — Ghost lesion, NEW-at-baseline, false PD

**Clinical story:** 2 target lesions, mostly stable through the study. Three different data-quality problems: a NEW lesion was recorded at the screening visit (impossible), a measurement was entered for a lesion that doesn't exist in TU, and the C4D1 response was over-called as PD when the actual numbers didn't qualify.

### ERR-009 — TUSTRESC=NEW at the SCREENING visit
- **Location:** TU, SCREENING
- **What's there:** `L3, TUSTRESC=NEW, VISIT=SCREENING`
- **Why it's wrong:** By definition, "new" lesions are those discovered *after* baseline. At SCREENING, every lesion identified should be classified as TARGET or NON-TARGET. A NEW record at SCREENING is a logical impossibility — usually means the screener mis-coded a baseline lesion.
- **The check:** *"For every TU row with TUSTRESC=NEW, VISITNUM must be greater than the subject's baseline VISITNUM (typically the SCREENING visit's VISITNUM)."*
- **Severity:** HIGH (categorical, not a judgment call).

### ERR-010 — TR references a lesion that doesn't exist in TU
- **Location:** TR, C4D1
- **What's there:** `TRLNKID=L4, TRTESTCD=LDIAM, TRORRES=14` — but TU has no row with `TULNKID=L4` for this subject.
- **Why it's wrong:** Every measurement must trace back to an identified lesion. A ghost reference means either the TU row was forgotten, or the TR row was typed against the wrong lesion ID.
- **The check (this is your simplest cross-domain check):** *"Every distinct (USUBJID, TRLNKID) in TR must appear as a (USUBJID, TULNKID) in TU. SUMDIAM rows (with empty TRLNKID) are exempt."*
- **Severity:** HIGH.

### ERR-011 — False PD at C4D1
- **Location:** RS, C4D1
- **What's there:** `TRGRESP=PD, OVRLRESP=PD`
- **Why it's wrong:** PD criteria per RECIST 1.1 are an OR:
  1. Sum of target diameters increases by **≥20%** from nadir, **AND** the absolute increase is **≥5mm**, OR
  2. Unequivocal new lesion appears, OR
  3. Unequivocal progression of non-target disease (rare to drive PD alone).
- Nadir was C2D1 sum = 43mm. C4D1 sum = 46mm. % change from nadir = 7%. Absolute change = 3mm. Neither criterion 1 condition met. No new lesion in TU. No non-target progression. So PD is unsupported.
- **The check:** *"For every RS row with RSTESTCD=TRGRESP, RSORRES=PD: compute nadir as the minimum SUMDIAM across visits up to and including this one; require (current−nadir)/nadir ≥ 0.20 AND (current−nadir) ≥ 5, OR require a corresponding NEW lesion in TU at this visit."*
- **Severity:** HIGH. False PD can trigger treatment discontinuation, which is a real patient-safety issue.

---

## Summary table

| Error  | Subject       | Visit         | Category                    | Severity | One-liner                                    |
|--------|---------------|---------------|-----------------------------|----------|----------------------------------------------|
| ERR-001| SITE01-0002   | SCREENING     | intra-domain non-obvious    | MEDIUM   | Non-target lesion has a numeric measurement  |
| ERR-002| SITE01-0002   | C2D1          | cross-domain non-obvious    | HIGH     | PR claimed at 20% decrease (need 30%)         |
| ERR-003| SITE01-0002   | C4D1          | cross-domain non-obvious    | HIGH     | PR claimed at 27% decrease (need 30%)         |
| ERR-004| SITE01-0002   | END OF STUDY  | cross-visit non-obvious     | HIGH     | BOR=CR but no visit ever recorded CR          |
| ERR-005| SITE01-0003   | SCREENING     | intra-domain non-obvious    | MEDIUM   | Lymph node target with short axis 12mm (<15) |
| ERR-006| SITE01-0003   | C4D1          | cross-domain non-obvious    | HIGH     | Overall CR while non-target still PRESENT     |
| ERR-007| SITE01-0004   | SCREENING     | intra-domain non-obvious    | HIGH     | 6 targets (>5) and 3 in liver (>2/organ)      |
| ERR-008| SITE01-0004   | C4D1          | cross-domain obvious        | HIGH     | TU has NEW lesion; RS says NEWLPRES=N         |
| ERR-009| SITE01-0005   | SCREENING     | intra-domain non-obvious    | HIGH     | NEW lesion recorded at baseline visit         |
| ERR-010| SITE01-0005   | C4D1          | cross-domain obvious        | HIGH     | TR references L4, no L4 in TU                 |
| ERR-011| SITE01-0005   | C4D1          | cross-domain non-obvious    | HIGH     | PD claimed at 7% / 3mm increase (need 20%/5)  |

## What this tells you about the engine you're building

Looking across the 11 errors, three patterns:

1. **Two-thirds are "math + medical rules"** (ERR-002, 003, 005, 006, 007, 011). They require encoding RECIST 1.1 quantitatively. These are ideal for deterministic rule-checks; an LLM is overkill. Write them as functions.

2. **Three are "data integrity across tables"** (ERR-008, 009, 010). Simple joins and set comparisons. Trivial to implement; high signal-to-noise.

3. **Two are "consistency across time"** (ERR-004, and indirectly ERR-011 which depends on nadir). Need a per-subject sort by VISITNUM and an aggregation.

This is your strongest pitch to Bhuwan: **most of these checks are deterministic and codeable**. The LLM/AI angle becomes most useful for the *long tail* — flagging plausible but unusual patterns the rules don't cover (e.g., target lesion shrinking 70% in one cycle is biologically suspicious even though no RECIST rule fires). Start with the deterministic 11, get the engine reporting cleanly, then layer the AI for residual anomaly detection.
