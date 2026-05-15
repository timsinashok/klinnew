import pandas as pd

from engine.finding import Finding, lineage_from_row, rows_to_records
from engine.registry import rule

PR_DECREASE_THRESHOLD = 0.30
CITATION = (
    "RECIST 1.1 § 4.3.1 (PR: ≥30% decrease in sum of target diameters from baseline)"
)
CITATION_CR_NT = (
    "RECIST 1.1 § 4.3.3 (Overall CR requires all non-targets absent and NTRGRESP=CR)"
)


def _target_sum_by_visit(
    tr: pd.DataFrame, tu: pd.DataFrame, usubjid: str
) -> dict[str, float]:
    """Sum of TARGET-lesion diameters per visit for one subject.

    Lymph-node targets contribute their short axis if recorded; non-nodal
    targets contribute their longest diameter. Both are stored as
    TRTESTCD=DIAMETER in this dataset.
    """
    targets = set(
        tu.loc[
            (tu["USUBJID"] == usubjid) & (tu["TUORRES"] == "TARGET"), "TULNKID"
        ].astype(str)
    )
    if not targets:
        return {}

    sub = tr[
        (tr["USUBJID"] == usubjid)
        & (tr["TRTESTCD"] == "DIAMETER")
        & (tr["TRLNKID"].astype(str).isin(targets))
    ]
    sums: dict[str, float] = {}
    for visit, vrows in sub.groupby("VISIT"):
        vals = pd.to_numeric(vrows["TRSTRESN"], errors="coerce").dropna()
        if len(vals):
            sums[visit] = float(vals.sum())
    return sums


@rule("TR-RS-001", severity="Critical", layer="Medical logic")
def pr_threshold(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tu, tr, rs = data["tu"], data["tr"], data["rs"]
    findings: list[Finding] = []

    pr_rows = rs[
        (rs["RSTESTCD"] == "TRGRESP") & (rs["RSSTRESC"].str.upper() == "PR")
    ]

    for _, pr in pr_rows.iterrows():
        usubjid = pr["USUBJID"]
        visit = pr["VISIT"]

        sums = _target_sum_by_visit(tr, tu, usubjid)
        if "Baseline" not in sums or visit not in sums:
            continue

        baseline = sums["Baseline"]
        current = sums[visit]
        if baseline <= 0:
            continue
        pct_decrease = (baseline - current) / baseline
        if pct_decrease >= PR_DECREASE_THRESHOLD:
            continue

        tr_evidence = tr[
            (tr["USUBJID"] == usubjid)
            & (tr["TRTESTCD"] == "DIAMETER")
            & (tr["VISIT"].isin(["Baseline", visit]))
        ]
        rs_evidence = rs[
            (rs["USUBJID"] == usubjid)
            & (rs["VISIT"] == visit)
            & (rs["RSTESTCD"].isin(["TRGRESP", "OVRLRESP"]))
        ]

        findings.append(
            Finding(
                rule_id="TR-RS-001",
                severity="Critical",
                subject_id=usubjid,
                visit=visit,
                domain="RS",
                variable="RSORRES",
                lineage=lineage_from_row(pr),
                evidence_rows={
                    "TR": rows_to_records(tr_evidence),
                    "RS": rows_to_records(rs_evidence),
                },
                raw_message=(
                    f"Target response is PR at {visit} but the sum of target "
                    f"diameters decreased from {baseline:g} mm at baseline to "
                    f"{current:g} mm ({pct_decrease * 100:.1f}%). PR requires "
                    f"≥30% decrease."
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
                    "baseline_visit": "Baseline",
                },
                citation=CITATION,
            )
        )

    return findings


@rule("TR-RS-003", severity="Critical", layer="Medical logic")
def cr_vs_non_target(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tu, tr, rs = data["tu"], data["tr"], data["rs"]
    findings: list[Finding] = []

    cr_visits = rs[(rs["RSTESTCD"] == "OVRLRESP") & (rs["RSSTRESC"] == "CR")]
    for _, cr in cr_visits.iterrows():
        usubjid = cr["USUBJID"]
        visit = cr["VISIT"]

        nt = tr[
            (tr["USUBJID"] == usubjid)
            & (tr["VISIT"] == visit)
            & (tr["TRTESTCD"] == "TUMSTATE")
        ]
        nt_target_ids = set(
            tu.loc[
                (tu["USUBJID"] == usubjid) & (tu["TUORRES"] == "NON-TARGET"),
                "TULNKID",
            ].astype(str)
        )
        nt_present = nt[
            (nt["TRLNKID"].astype(str).isin(nt_target_ids))
            & (nt["TRSTRESC"].isin(["PRESENT", "EQUIVOCAL"]))
        ]

        ntrgresp = rs[
            (rs["USUBJID"] == usubjid)
            & (rs["VISIT"] == visit)
            & (rs["RSTESTCD"] == "NTRGRESP")
        ]
        ntrg_value = (
            str(ntrgresp.iloc[0]["RSSTRESC"]).strip().upper()
            if not ntrgresp.empty
            else ""
        )

        if nt_present.empty and ntrg_value == "CR":
            continue
        if nt_present.empty and not ntrg_value:
            continue

        findings.append(
            Finding(
                rule_id="TR-RS-003",
                severity="Critical",
                subject_id=usubjid,
                visit=visit,
                domain="RS/TR",
                variable="RSORRES/TRORRES",
                lineage=lineage_from_row(cr),
                evidence_rows={
                    "RS": rows_to_records(
                        rs[
                            (rs["USUBJID"] == usubjid)
                            & (rs["VISIT"] == visit)
                            & (rs["RSTESTCD"].isin(["OVRLRESP", "NTRGRESP"]))
                        ]
                    ),
                    "TR": rows_to_records(nt),
                },
                raw_message=(
                    f"Overall response at {visit} is CR, but non-target disease "
                    f"is still present (NTRGRESP={ntrg_value!r}, "
                    f"{len(nt_present)} non-target lesion(s) PRESENT)."
                ),
                template_id="CR_NON_TARGET",
                template_params={
                    "ntrgresp": ntrg_value,
                    "non_target_present_ids": nt_present["TRLNKID"].astype(str).tolist(),
                },
                citation=CITATION_CR_NT,
            )
        )

    return findings
