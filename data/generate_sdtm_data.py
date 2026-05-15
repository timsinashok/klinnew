#!/usr/bin/env python3
"""
Generate synthetic SDTM TU, TR, RS data for v0 demo of the
cross-domain logical-check engine.

5 patients (SITE01-0001 through SITE01-0005).
11 seeded inconsistencies spanning:
  - intra-domain obvious
  - intra-domain non-obvious (RECIST 1.1 rules)
  - cross-domain obvious
  - cross-domain non-obvious (medical logic)

Outputs (to ./sdtm/):
  tu.csv             — Tumor Identification
  tr.csv             — Tumor Results (measurements)
  rs.csv             — Disease Response (per-visit + Best Overall Response)
  ground_truth.csv   — every seeded error, with category/severity/check
"""

import csv
from pathlib import Path

STUDY = "DEMO-ONC-001"
OUT = Path(__file__).parent / "sdtm"
OUT.mkdir(exist_ok=True)

tu_rows, tr_rows, rs_rows, errors = [], [], [], []
_tu_seq, _tr_seq, _rs_seq = {}, {}, {}


def _next(d, k):
    d[k] = d.get(k, 0) + 1
    return d[k]


def add_tu(usubjid, tulnkid, tustresc, tuloc, visit, visitnum, tudtc, method="CT"):
    tu_rows.append({
        "STUDYID": STUDY, "DOMAIN": "TU", "USUBJID": usubjid,
        "TUSEQ": _next(_tu_seq, usubjid),
        "TULNKID": tulnkid,
        "TUTESTCD": "TUMIDENT", "TUTEST": "Tumor Identification",
        "TUORRES": tustresc, "TUSTRESC": tustresc,
        "TULOC": tuloc, "TUMETHOD": method,
        "VISIT": visit, "VISITNUM": visitnum, "TUDTC": tudtc,
    })


def add_tr(usubjid, trlnkid, trtestcd, trorres, trorresu, visit, visitnum, trdtc, method="CT"):
    test_map = {"LDIAM": "Longest Diameter", "SAXIS": "Short Axis",
                "SUMDIAM": "Sum of Diameters", "TUMSTATE": "Tumor State"}
    tr_rows.append({
        "STUDYID": STUDY, "DOMAIN": "TR", "USUBJID": usubjid,
        "TRSEQ": _next(_tr_seq, usubjid),
        "TRLNKID": trlnkid,
        "TRTESTCD": trtestcd, "TRTEST": test_map.get(trtestcd, ""),
        "TRORRES": str(trorres), "TRSTRESC": str(trorres),
        "TRORRESU": trorresu, "TRMETHOD": method,
        "VISIT": visit, "VISITNUM": visitnum, "TRDTC": trdtc,
    })


def add_rs(usubjid, rstestcd, rsorres, visit, visitnum, rsdtc):
    test_map = {"TRGRESP": "Target Response", "NTRGRESP": "Non-Target Response",
                "NEWLPRES": "New Lesions Present", "OVRLRESP": "Overall Response",
                "BESTRESP": "Best Overall Response"}
    rs_rows.append({
        "STUDYID": STUDY, "DOMAIN": "RS", "USUBJID": usubjid,
        "RSSEQ": _next(_rs_seq, usubjid),
        "RSTESTCD": rstestcd, "RSTEST": test_map.get(rstestcd, ""),
        "RSORRES": rsorres, "RSSTRESC": rsorres,
        "VISIT": visit, "VISITNUM": visitnum, "RSDTC": rsdtc,
    })


def add_visit_response(usubjid, visit, visitnum, dtc, trg, ntrg, newl, ovrl):
    add_rs(usubjid, "TRGRESP",  trg,  visit, visitnum, dtc)
    add_rs(usubjid, "NTRGRESP", ntrg, visit, visitnum, dtc)
    add_rs(usubjid, "NEWLPRES", newl, visit, visitnum, dtc)
    add_rs(usubjid, "OVRLRESP", ovrl, visit, visitnum, dtc)


def add_error(eid, usubjid, visit, category, severity, description, check):
    errors.append({
        "ERROR_ID": eid, "USUBJID": usubjid, "VISIT_AFFECTED": visit,
        "CATEGORY": category, "SEVERITY": severity,
        "DESCRIPTION": description, "EXPECTED_CHECK": check,
    })


# =============================================================================
# Patient 01 — SITE01-0001 — CLEAN (control, no errors)
# =============================================================================
p = "SITE01-0001"
add_tu(p, "L1",  "TARGET",     "LIVER",      "SCREENING", 1, "2024-01-15")
add_tu(p, "L2",  "TARGET",     "LUNG",       "SCREENING", 1, "2024-01-15")
add_tu(p, "NT1", "NON-TARGET", "PERITONEUM", "SCREENING", 1, "2024-01-15")
# Baseline: sum = 52
add_tr(p, "L1",  "LDIAM",    30,        "mm", "SCREENING", 1, "2024-01-15")
add_tr(p, "L2",  "LDIAM",    22,        "mm", "SCREENING", 1, "2024-01-15")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "SCREENING", 1, "2024-01-15")
add_tr(p, "",    "SUMDIAM",  52,        "mm", "SCREENING", 1, "2024-01-15")
# C2D1: sum = 40 (-23%) → SD
add_tr(p, "L1",  "LDIAM",    25,        "mm", "C2D1", 2, "2024-03-12")
add_tr(p, "L2",  "LDIAM",    15,        "mm", "C2D1", 2, "2024-03-12")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C2D1", 2, "2024-03-12")
add_tr(p, "",    "SUMDIAM",  40,        "mm", "C2D1", 2, "2024-03-12")
add_visit_response(p, "C2D1", 2, "2024-03-12", "SD", "Non-CR/Non-PD", "N", "SD")
# C4D1: sum = 32 (-38%) → PR
add_tr(p, "L1",  "LDIAM",    20,        "mm", "C4D1", 3, "2024-05-07")
add_tr(p, "L2",  "LDIAM",    12,        "mm", "C4D1", 3, "2024-05-07")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C4D1", 3, "2024-05-07")
add_tr(p, "",    "SUMDIAM",  32,        "mm", "C4D1", 3, "2024-05-07")
add_visit_response(p, "C4D1", 3, "2024-05-07", "PR", "Non-CR/Non-PD", "N", "PR")
# C6D1: sum = 30 (-42%) → PR (maintained)
add_tr(p, "L1",  "LDIAM",    18,        "mm", "C6D1", 4, "2024-07-02")
add_tr(p, "L2",  "LDIAM",    12,        "mm", "C6D1", 4, "2024-07-02")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C6D1", 4, "2024-07-02")
add_tr(p, "",    "SUMDIAM",  30,        "mm", "C6D1", 4, "2024-07-02")
add_visit_response(p, "C6D1", 4, "2024-07-02", "PR", "Non-CR/Non-PD", "N", "PR")
add_rs(p, "BESTRESP", "PR", "END OF STUDY", 99, "2024-07-02")
# NO ERRORS for Patient 01

# =============================================================================
# Patient 02 — SITE01-0002 — False PR x2, BOR mismatch, non-target measurement
# =============================================================================
p = "SITE01-0002"
add_tu(p, "L1",  "TARGET",     "LIVER",      "SCREENING", 1, "2024-02-01")
add_tu(p, "L2",  "TARGET",     "LUNG",       "SCREENING", 1, "2024-02-01")
add_tu(p, "NT1", "NON-TARGET", "LYMPH NODE", "SCREENING", 1, "2024-02-01")
# Baseline: sum = 75. ERR-001: NT1 has a numeric LDIAM (non-targets are qualitative).
add_tr(p, "L1",  "LDIAM",    40,        "mm", "SCREENING", 1, "2024-02-01")
add_tr(p, "L2",  "LDIAM",    35,        "mm", "SCREENING", 1, "2024-02-01")
add_tr(p, "NT1", "LDIAM",    15,        "mm", "SCREENING", 1, "2024-02-01")  # ❌ ERR-001
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "SCREENING", 1, "2024-02-01")
add_tr(p, "",    "SUMDIAM",  75,        "mm", "SCREENING", 1, "2024-02-01")
# C2D1: sum = 60 (-20%). RS says PR — wrong (need ≥30%).
add_tr(p, "L1",  "LDIAM",    33,        "mm", "C2D1", 2, "2024-03-28")
add_tr(p, "L2",  "LDIAM",    27,        "mm", "C2D1", 2, "2024-03-28")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C2D1", 2, "2024-03-28")
add_tr(p, "",    "SUMDIAM",  60,        "mm", "C2D1", 2, "2024-03-28")
add_visit_response(p, "C2D1", 2, "2024-03-28", "PR", "Non-CR/Non-PD", "N", "PR")  # ❌ ERR-002
# C4D1: sum = 55 (-27%). RS says PR — still wrong.
add_tr(p, "L1",  "LDIAM",    30,        "mm", "C4D1", 3, "2024-05-23")
add_tr(p, "L2",  "LDIAM",    25,        "mm", "C4D1", 3, "2024-05-23")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C4D1", 3, "2024-05-23")
add_tr(p, "",    "SUMDIAM",  55,        "mm", "C4D1", 3, "2024-05-23")
add_visit_response(p, "C4D1", 3, "2024-05-23", "PR", "Non-CR/Non-PD", "N", "PR")  # ❌ ERR-003
# C6D1: sum = 50 (-33%). Legit PR.
add_tr(p, "L1",  "LDIAM",    27,        "mm", "C6D1", 4, "2024-07-18")
add_tr(p, "L2",  "LDIAM",    23,        "mm", "C6D1", 4, "2024-07-18")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C6D1", 4, "2024-07-18")
add_tr(p, "",    "SUMDIAM",  50,        "mm", "C6D1", 4, "2024-07-18")
add_visit_response(p, "C6D1", 4, "2024-07-18", "PR", "Non-CR/Non-PD", "N", "PR")
# BOR = CR — wrong (no visit ever recorded CR).
add_rs(p, "BESTRESP", "CR", "END OF STUDY", 99, "2024-07-18")  # ❌ ERR-004

add_error("ERR-001", p, "SCREENING", "intra-domain non-obvious", "MEDIUM",
          "Non-target lesion NT1 has a numeric Longest Diameter (15mm) recorded in TR. Per RECIST 1.1, non-targets are assessed qualitatively only (PRESENT/ABSENT/EQUIVOCAL).",
          "Non-target lesions must not have LDIAM/SAXIS records")
add_error("ERR-002", p, "C2D1", "cross-domain non-obvious", "HIGH",
          "RS Target Response = PR at C2D1. Sum of diameters: 75 → 60 = 20% decrease. PR requires ≥30% decrease from baseline. Correct response: SD.",
          "PR requires sum-of-diameters decrease ≥30% from baseline")
add_error("ERR-003", p, "C4D1", "cross-domain non-obvious", "HIGH",
          "RS Target Response = PR at C4D1. Sum of diameters: 75 → 55 = 27% decrease. Still below the 30% threshold for PR. Correct response: SD.",
          "PR requires sum-of-diameters decrease ≥30% from baseline")
add_error("ERR-004", p, "END OF STUDY", "cross-visit non-obvious", "HIGH",
          "Best Overall Response = CR, but the per-visit Overall Response sequence is SD, PR, PR, PR — no visit ever recorded CR. BOR cannot exceed the best per-visit response.",
          "BOR must equal the best per-visit Overall Response (with confirmation rules)")

# =============================================================================
# Patient 03 — SITE01-0003 — Lymph node measurability error, false CR
# =============================================================================
p = "SITE01-0003"
add_tu(p, "L1",  "TARGET",     "LYMPH NODE", "SCREENING", 1, "2024-02-15")
add_tu(p, "NT1", "NON-TARGET", "LIVER",      "SCREENING", 1, "2024-02-15")
# Baseline: ERR-005 — lymph node short axis 12mm < 15mm threshold for measurability
add_tr(p, "L1",  "SAXIS",    12,        "mm", "SCREENING", 1, "2024-02-15")  # ❌ ERR-005
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "SCREENING", 1, "2024-02-15")
add_tr(p, "",    "SUMDIAM",  12,        "mm", "SCREENING", 1, "2024-02-15")
# C2D1: short axis 9mm
add_tr(p, "L1",  "SAXIS",    9,         "mm", "C2D1", 2, "2024-04-11")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C2D1", 2, "2024-04-11")
add_tr(p, "",    "SUMDIAM",  9,         "mm", "C2D1", 2, "2024-04-11")
add_visit_response(p, "C2D1", 2, "2024-04-11", "PR", "Non-CR/Non-PD", "N", "PR")
# C4D1: short axis 7mm (target CR for LN), BUT non-target still PRESENT. RS=CR is wrong.
add_tr(p, "L1",  "SAXIS",    7,         "mm", "C4D1", 3, "2024-06-06")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C4D1", 3, "2024-06-06")
add_tr(p, "",    "SUMDIAM",  7,         "mm", "C4D1", 3, "2024-06-06")
add_visit_response(p, "C4D1", 3, "2024-06-06", "CR", "Non-CR/Non-PD", "N", "CR")  # ❌ ERR-006
add_rs(p, "BESTRESP", "CR", "END OF STUDY", 99, "2024-06-06")

add_error("ERR-005", p, "SCREENING", "intra-domain non-obvious", "MEDIUM",
          "Target lymph node L1 has baseline short axis = 12mm. RECIST 1.1 requires lymph nodes selected as targets to have short axis ≥15mm to be measurable.",
          "Lymph-node target baseline short axis must be ≥15mm")
add_error("ERR-006", p, "C4D1", "cross-domain non-obvious", "HIGH",
          "Overall Response = CR at C4D1, but Non-Target Response = Non-CR/Non-PD (NT1 still PRESENT in TR). RECIST 1.1 CR requires ALL target and non-target lesions to be absent.",
          "Overall CR requires Non-Target Response = CR (all non-targets absent or, for nodal non-targets, <10mm)")

# =============================================================================
# Patient 04 — SITE01-0004 — >5 targets, >2 per organ, NEWLPRES mismatch
# =============================================================================
p = "SITE01-0004"
add_tu(p, "L1",  "TARGET",     "LIVER",      "SCREENING", 1, "2024-03-01")
add_tu(p, "L2",  "TARGET",     "LIVER",      "SCREENING", 1, "2024-03-01")
add_tu(p, "L3",  "TARGET",     "LIVER",      "SCREENING", 1, "2024-03-01")  # ❌ part of ERR-007
add_tu(p, "L4",  "TARGET",     "LUNG",       "SCREENING", 1, "2024-03-01")
add_tu(p, "L5",  "TARGET",     "LUNG",       "SCREENING", 1, "2024-03-01")
add_tu(p, "L6",  "TARGET",     "ADRENAL",    "SCREENING", 1, "2024-03-01")  # ❌ part of ERR-007
add_tu(p, "NT1", "NON-TARGET", "PERITONEUM", "SCREENING", 1, "2024-03-01")
# Baseline measurements
for lnk, val in [("L1", 25), ("L2", 30), ("L3", 20), ("L4", 18), ("L5", 15), ("L6", 12)]:
    add_tr(p, lnk, "LDIAM", val, "mm", "SCREENING", 1, "2024-03-01")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "", "SCREENING", 1, "2024-03-01")
add_tr(p, "",    "SUMDIAM",  120, "mm", "SCREENING", 1, "2024-03-01")
# C2D1: SD (minor growth)
for lnk, val in [("L1", 26), ("L2", 31), ("L3", 22), ("L4", 18), ("L5", 16), ("L6", 12)]:
    add_tr(p, lnk, "LDIAM", val, "mm", "C2D1", 2, "2024-04-25")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "", "C2D1", 2, "2024-04-25")
add_tr(p, "",    "SUMDIAM",  125, "mm", "C2D1", 2, "2024-04-25")
add_visit_response(p, "C2D1", 2, "2024-04-25", "SD", "Non-CR/Non-PD", "N", "SD")
# C4D1: NEW lesion (L7, brain) appears in TU. RS says NEWLPRES=N — mismatch.
add_tu(p, "L7", "NEW", "BRAIN", "C4D1", 3, "2024-06-20")
for lnk, val in [("L1", 27), ("L2", 32), ("L3", 23), ("L4", 18), ("L5", 16), ("L6", 12)]:
    add_tr(p, lnk, "LDIAM", val, "mm", "C4D1", 3, "2024-06-20")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "", "C4D1", 3, "2024-06-20")
add_tr(p, "",    "SUMDIAM",  128, "mm", "C4D1", 3, "2024-06-20")
add_visit_response(p, "C4D1", 3, "2024-06-20", "SD", "Non-CR/Non-PD", "N", "SD")  # ❌ ERR-008
add_rs(p, "BESTRESP", "SD", "END OF STUDY", 99, "2024-06-20")

add_error("ERR-007", p, "SCREENING", "intra-domain non-obvious", "HIGH",
          "Subject has 6 target lesions at baseline (L1–L6), exceeding the RECIST 1.1 maximum of 5 per subject. Additionally, 3 target lesions (L1, L2, L3) are in the LIVER, exceeding the maximum of 2 per organ.",
          "≤5 target lesions per subject; ≤2 per organ")
add_error("ERR-008", p, "C4D1", "cross-domain obvious", "HIGH",
          "RS records New Lesions Present = N at C4D1, but TU contains TUSTRESC=NEW for L7 (brain) at C4D1. NEWLPRES must agree with TU.",
          "RS.NEWLPRES at a visit must equal Y iff TU contains TUSTRESC=NEW at that visit")

# =============================================================================
# Patient 05 — SITE01-0005 — Ghost lesion, NEW at baseline, false PD
# =============================================================================
p = "SITE01-0005"
add_tu(p, "L1",  "TARGET",     "LUNG",       "SCREENING", 1, "2024-03-15")
add_tu(p, "L2",  "TARGET",     "LIVER",      "SCREENING", 1, "2024-03-15")
add_tu(p, "NT1", "NON-TARGET", "LYMPH NODE", "SCREENING", 1, "2024-03-15")
# ERR-009: NEW lesion recorded at SCREENING (impossible by definition)
add_tu(p, "L3", "NEW", "PERITONEUM", "SCREENING", 1, "2024-03-15")  # ❌ ERR-009
# Baseline
add_tr(p, "L1",  "LDIAM",    25,        "mm", "SCREENING", 1, "2024-03-15")
add_tr(p, "L2",  "LDIAM",    20,        "mm", "SCREENING", 1, "2024-03-15")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "SCREENING", 1, "2024-03-15")
add_tr(p, "",    "SUMDIAM",  45,        "mm", "SCREENING", 1, "2024-03-15")
# C2D1: SD (nadir at 43)
add_tr(p, "L1",  "LDIAM",    23,        "mm", "C2D1", 2, "2024-05-10")
add_tr(p, "L2",  "LDIAM",    20,        "mm", "C2D1", 2, "2024-05-10")
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C2D1", 2, "2024-05-10")
add_tr(p, "",    "SUMDIAM",  43,        "mm", "C2D1", 2, "2024-05-10")
add_visit_response(p, "C2D1", 2, "2024-05-10", "SD", "Non-CR/Non-PD", "N", "SD")
# C4D1: sum=46, +7% from nadir, no new lesion. RS=PD is wrong.
# ERR-010: TR record for L4 — L4 not in TU (ghost reference)
add_tr(p, "L1",  "LDIAM",    24,        "mm", "C4D1", 3, "2024-07-05")
add_tr(p, "L2",  "LDIAM",    22,        "mm", "C4D1", 3, "2024-07-05")
add_tr(p, "L4",  "LDIAM",    14,        "mm", "C4D1", 3, "2024-07-05")  # ❌ ERR-010
add_tr(p, "NT1", "TUMSTATE", "PRESENT", "",   "C4D1", 3, "2024-07-05")
add_tr(p, "",    "SUMDIAM",  46,        "mm", "C4D1", 3, "2024-07-05")
add_visit_response(p, "C4D1", 3, "2024-07-05", "PD", "Non-CR/Non-PD", "N", "PD")  # ❌ ERR-011
add_rs(p, "BESTRESP", "PD", "END OF STUDY", 99, "2024-07-05")

add_error("ERR-009", p, "SCREENING", "intra-domain non-obvious", "HIGH",
          "TU records TUSTRESC=NEW for L3 at SCREENING. By definition, 'NEW' lesions can only be identified after baseline; at SCREENING all lesions should be TARGET or NON-TARGET.",
          "TU.TUSTRESC=NEW requires VISITNUM > baseline visit")
add_error("ERR-010", p, "C4D1", "cross-domain obvious", "HIGH",
          "TR contains a measurement with TRLNKID=L4 at C4D1, but no lesion with TULNKID=L4 exists in TU for this subject. Either the TU entry is missing or the TR record references the wrong lesion ID.",
          "Every TR.TRLNKID must resolve to an existing TU.TULNKID for the same subject")
add_error("ERR-011", p, "C4D1", "cross-domain non-obvious", "HIGH",
          "RS Target Response = PD at C4D1. Sum of diameters: nadir 43 → 46 = 7% increase (3mm absolute). PD requires ≥20% increase from nadir AND ≥5mm absolute increase, OR an unequivocal new lesion. Neither criterion met.",
          "PD requires ≥20% AND ≥5mm increase from nadir, OR a new lesion")


# =============================================================================
# Write CSVs
# =============================================================================
def write_csv(path, rows, fieldnames):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


write_csv(OUT / "tu.csv", tu_rows, [
    "STUDYID", "DOMAIN", "USUBJID", "TUSEQ", "TULNKID",
    "TUTESTCD", "TUTEST", "TUORRES", "TUSTRESC",
    "TULOC", "TUMETHOD", "VISIT", "VISITNUM", "TUDTC",
])
write_csv(OUT / "tr.csv", tr_rows, [
    "STUDYID", "DOMAIN", "USUBJID", "TRSEQ", "TRLNKID",
    "TRTESTCD", "TRTEST", "TRORRES", "TRSTRESC", "TRORRESU",
    "TRMETHOD", "VISIT", "VISITNUM", "TRDTC",
])
write_csv(OUT / "rs.csv", rs_rows, [
    "STUDYID", "DOMAIN", "USUBJID", "RSSEQ",
    "RSTESTCD", "RSTEST", "RSORRES", "RSSTRESC",
    "VISIT", "VISITNUM", "RSDTC",
])
write_csv(OUT / "ground_truth.csv", errors, [
    "ERROR_ID", "USUBJID", "VISIT_AFFECTED", "CATEGORY",
    "SEVERITY", "DESCRIPTION", "EXPECTED_CHECK",
])

print(f"TU rows: {len(tu_rows)}")
print(f"TR rows: {len(tr_rows)}")
print(f"RS rows: {len(rs_rows)}")
print(f"Seeded errors: {len(errors)}")
print(f"Files written to: {OUT.resolve()}")
