import pandas as pd

from engine.finding import Finding
from engine.registry import rule

RESPONSE_RANK = {"CR": 4, "PR": 3, "SD": 2, "PD": 1, "NE": 0}
CITATION_BOR = (
    "RECIST 1.1 § 4.3.5 (Best Overall Response cannot exceed the best per-visit "
    "Overall Response, subject to confirmation rules)"
)
CITATION_CR = (
    "RECIST 1.1 § 4.3.3 (Overall CR requires all targets resolved AND all non-targets "
    "absent AND no new lesions)"
)


def _evidence_rows(df: pd.DataFrame, mask: pd.Series) -> list[dict]:
    sub = df.loc[mask]
    return sub.astype(object).where(sub.notna(), None).to_dict(orient="records")


@rule("BOR_CONSISTENCY")
def bor_consistency(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []
    best_rows = rs[rs["RSTESTCD"] == "BESTRESP"]

    for _, best in best_rows.iterrows():
        usubjid = best["USUBJID"]
        bor = best["RSORRES"]
        bor_rank = RESPONSE_RANK.get(bor, -1)
        if bor_rank < 0:
            continue

        per_visit = rs[
            (rs["USUBJID"] == usubjid) & (rs["RSTESTCD"] == "OVRLRESP")
        ].sort_values("VISITNUM")
        if per_visit.empty:
            continue

        per_visit_responses = [
            (r["VISIT"], r["RSORRES"], RESPONSE_RANK.get(r["RSORRES"], -1))
            for _, r in per_visit.iterrows()
        ]
        max_rank = max(rank for _, _, rank in per_visit_responses)
        if bor_rank <= max_rank:
            continue

        findings.append(
            Finding(
                rule_id="BOR_CONSISTENCY",
                severity="HIGH",
                usubjid=usubjid,
                visit=best["VISIT"],
                message=(
                    f"Best Overall Response = {bor} but the per-visit Overall "
                    f"Response sequence is "
                    f"{', '.join(r for _, r, _ in per_visit_responses)}. "
                    f"BOR cannot exceed the best per-visit response."
                ),
                template_id="TIMELINE_MISMATCH",
                template_params={
                    "claimed_bor": bor,
                    "per_visit": [
                        {"visit": v, "response": r}
                        for v, r, _ in per_visit_responses
                    ],
                    "claim": "BOR",
                    "flagged_visit": best["VISIT"],
                },
                evidence_rows={
                    "RS": _evidence_rows(
                        rs,
                        (rs["USUBJID"] == usubjid)
                        & (rs["RSTESTCD"].isin(["OVRLRESP", "BESTRESP"])),
                    ),
                },
                citation=CITATION_BOR,
            )
        )

    return findings


@rule("CR_NONTARGET")
def cr_nontarget(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []

    cr_visits = rs[(rs["RSTESTCD"] == "OVRLRESP") & (rs["RSORRES"] == "CR")]

    for _, cr_row in cr_visits.iterrows():
        usubjid = cr_row["USUBJID"]
        visit = cr_row["VISIT"]

        ntrgresp = rs[
            (rs["USUBJID"] == usubjid)
            & (rs["VISIT"] == visit)
            & (rs["RSTESTCD"] == "NTRGRESP")
        ]
        nt_response = ntrgresp.iloc[0]["RSORRES"] if not ntrgresp.empty else None

        nt_present = tr[
            (tr["USUBJID"] == usubjid)
            & (tr["VISIT"] == visit)
            & (tr["TRTESTCD"] == "TUMSTATE")
            & (tr["TRSTRESC"].isin(["PRESENT", "EQUIVOCAL"]))
        ]

        nt_ok = (nt_response == "CR") and nt_present.empty
        if nt_ok:
            continue

        per_visit = rs[
            (rs["USUBJID"] == usubjid) & (rs["RSTESTCD"] == "OVRLRESP")
        ].sort_values("VISITNUM")

        findings.append(
            Finding(
                rule_id="CR_NONTARGET",
                severity="HIGH",
                usubjid=usubjid,
                visit=visit,
                message=(
                    f"Overall Response = CR at {visit} but non-target lesions are "
                    f"still present (NTRGRESP={nt_response!r}, "
                    f"{len(nt_present)} non-target(s) still PRESENT)."
                ),
                template_id="TIMELINE_MISMATCH",
                template_params={
                    "ntrgresp": nt_response,
                    "non_target_present_ids": nt_present["TRLNKID"].astype(str).tolist(),
                    "per_visit": [
                        {"visit": r["VISIT"], "response": r["RSORRES"]}
                        for _, r in per_visit.iterrows()
                    ],
                    "claim": "OVRLRESP=CR",
                    "flagged_visit": visit,
                },
                evidence_rows={
                    "RS": _evidence_rows(
                        rs,
                        (rs["USUBJID"] == usubjid)
                        & (rs["VISIT"] == visit)
                        & (rs["RSTESTCD"].isin(["OVRLRESP", "NTRGRESP", "TRGRESP"])),
                    ),
                    "TR": _evidence_rows(
                        tr,
                        (tr["USUBJID"] == usubjid)
                        & (tr["VISIT"] == visit)
                        & (tr["TRTESTCD"] == "TUMSTATE"),
                    ),
                },
                citation=CITATION_CR,
            )
        )

    return findings
