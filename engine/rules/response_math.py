import pandas as pd

from engine.finding import Finding
from engine.registry import rule

PR_DECREASE_THRESHOLD = 0.30
PD_INCREASE_PCT = 0.20
PD_INCREASE_ABS = 5.0
CITATION_PR = "RECIST 1.1 § 4.3.1 (PR: ≥30% decrease in sum of diameters from baseline)"
CITATION_PD = (
    "RECIST 1.1 § 4.3.1 (PD: ≥20% AND ≥5mm increase in sum from nadir, "
    "OR unequivocal new lesion)"
)


def _baseline_visitnum(df: pd.DataFrame, usubjid: str) -> float | None:
    sub = df[df["USUBJID"] == usubjid]
    if sub.empty:
        return None
    return float(sub["VISITNUM"].min())


def _subject_has_nodal_target(tr: pd.DataFrame, usubjid: str) -> bool:
    sub = tr[(tr["USUBJID"] == usubjid) & (tr["TRTESTCD"] == "SAXIS")]
    return not sub.empty


def _sumdiam_by_visit(tr: pd.DataFrame, usubjid: str) -> dict[str, float]:
    sub = tr[
        (tr["USUBJID"] == usubjid)
        & (tr["TRTESTCD"] == "SUMDIAM")
    ]
    out: dict[str, float] = {}
    for _, row in sub.iterrows():
        val = pd.to_numeric(row["TRSTRESC"], errors="coerce")
        if pd.notna(val):
            out[row["VISIT"]] = float(val)
    return out


def _evidence_rows(df: pd.DataFrame, mask: pd.Series) -> list[dict]:
    return df.loc[mask].astype(object).where(df.loc[mask].notna(), None).to_dict(
        orient="records"
    )


@rule("PR_THRESHOLD")
def pr_threshold(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []
    pr_rows = rs[(rs["RSTESTCD"] == "TRGRESP") & (rs["RSORRES"] == "PR")]

    for _, pr in pr_rows.iterrows():
        usubjid = pr["USUBJID"]
        visit = pr["VISIT"]

        if _subject_has_nodal_target(tr, usubjid):
            continue

        sums = _sumdiam_by_visit(tr, usubjid)
        baseline_v = tr[
            (tr["USUBJID"] == usubjid) & (tr["TRTESTCD"] == "SUMDIAM")
        ].sort_values("VISITNUM").iloc[0]["VISIT"] if usubjid in tr["USUBJID"].values else None

        if baseline_v is None or baseline_v not in sums or visit not in sums:
            continue

        baseline = sums[baseline_v]
        current = sums[visit]
        if baseline == 0:
            continue
        pct_decrease = (baseline - current) / baseline
        if pct_decrease >= PR_DECREASE_THRESHOLD:
            continue

        tr_evidence_mask = (
            (tr["USUBJID"] == usubjid)
            & (tr["TRTESTCD"] == "SUMDIAM")
        )
        rs_evidence_mask = (
            (rs["USUBJID"] == usubjid)
            & (rs["VISIT"] == visit)
            & (rs["RSTESTCD"].isin(["TRGRESP", "OVRLRESP"]))
        )

        findings.append(
            Finding(
                rule_id="PR_THRESHOLD",
                severity="HIGH",
                usubjid=usubjid,
                visit=visit,
                message=(
                    f"PR claimed at {visit} but sum of diameters decreased only "
                    f"{pct_decrease * 100:.1f}% from baseline "
                    f"({baseline:g}mm → {current:g}mm). PR requires ≥30% decrease."
                ),
                template_id="RESPONSE_THRESHOLD",
                template_params={
                    "baseline_sum": baseline,
                    "current_sum": current,
                    "pct_decrease": pct_decrease,
                    "threshold": PR_DECREASE_THRESHOLD,
                    "claimed_response": "PR",
                    "sums_by_visit": sums,
                    "flagged_visit": visit,
                    "baseline_visit": baseline_v,
                },
                evidence_rows={
                    "TR": _evidence_rows(tr, tr_evidence_mask),
                    "RS": _evidence_rows(rs, rs_evidence_mask),
                },
                citation=CITATION_PR,
            )
        )

    return findings


def _new_lesion_in_tu_at_visit(tu: pd.DataFrame, usubjid: str, visit: str) -> bool:
    sub = tu[
        (tu["USUBJID"] == usubjid)
        & (tu["TUSTRESC"] == "NEW")
        & (tu["VISIT"] == visit)
    ]
    return not sub.empty


@rule("PD_THRESHOLD")
def pd_threshold(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []
    pd_rows = rs[(rs["RSTESTCD"] == "TRGRESP") & (rs["RSORRES"] == "PD")]

    for _, pd_row in pd_rows.iterrows():
        usubjid = pd_row["USUBJID"]
        visit = pd_row["VISIT"]
        visitnum = pd_row["VISITNUM"]

        sub_sums = tr[
            (tr["USUBJID"] == usubjid) & (tr["TRTESTCD"] == "SUMDIAM")
        ].sort_values("VISITNUM")
        if sub_sums.empty:
            continue

        prior_and_current = sub_sums[sub_sums["VISITNUM"] <= visitnum]
        if prior_and_current.empty:
            continue

        current_row = prior_and_current[prior_and_current["VISIT"] == visit]
        if current_row.empty:
            continue
        current = float(current_row.iloc[0]["TRSTRESN"])

        nadir_val = float(prior_and_current["TRSTRESN"].min())

        if _new_lesion_in_tu_at_visit(tu, usubjid, visit):
            continue

        if nadir_val == 0:
            continue
        pct_increase = (current - nadir_val) / nadir_val
        abs_increase = current - nadir_val
        if pct_increase >= PD_INCREASE_PCT and abs_increase >= PD_INCREASE_ABS:
            continue

        sums_by_visit = {
            r["VISIT"]: float(r["TRSTRESN"])
            for _, r in sub_sums.iterrows()
            if pd.notna(r["TRSTRESN"])
        }
        nadir_visit = prior_and_current.loc[
            prior_and_current["TRSTRESN"].idxmin(), "VISIT"
        ]

        findings.append(
            Finding(
                rule_id="PD_THRESHOLD",
                severity="HIGH",
                usubjid=usubjid,
                visit=visit,
                message=(
                    f"PD claimed at {visit} but sum increased only "
                    f"{pct_increase * 100:.1f}% / {abs_increase:.1f}mm from nadir "
                    f"({nadir_val:g}mm at {nadir_visit} → {current:g}mm) and no new "
                    f"lesion is recorded in TU. PD requires ≥20% AND ≥5mm, or a new lesion."
                ),
                template_id="RESPONSE_THRESHOLD",
                template_params={
                    "nadir_sum": nadir_val,
                    "current_sum": current,
                    "pct_increase": pct_increase,
                    "abs_increase": abs_increase,
                    "pct_threshold": PD_INCREASE_PCT,
                    "abs_threshold": PD_INCREASE_ABS,
                    "claimed_response": "PD",
                    "sums_by_visit": sums_by_visit,
                    "flagged_visit": visit,
                    "nadir_visit": nadir_visit,
                },
                evidence_rows={
                    "TR": _evidence_rows(
                        tr,
                        (tr["USUBJID"] == usubjid) & (tr["TRTESTCD"] == "SUMDIAM"),
                    ),
                    "RS": _evidence_rows(
                        rs,
                        (rs["USUBJID"] == usubjid)
                        & (rs["VISIT"] == visit)
                        & (rs["RSTESTCD"].isin(["TRGRESP", "OVRLRESP"])),
                    ),
                },
                citation=CITATION_PD,
            )
        )

    return findings
