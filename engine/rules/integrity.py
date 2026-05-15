import pandas as pd

from engine.finding import Finding
from engine.registry import rule

CITATION_GHOST = "SDTM IG: TR.TRLNKID must reference an identified lesion in TU.TULNKID"
CITATION_NEWLPRES = (
    "RECIST 1.1 / SDTM: RS.NEWLPRES at a visit must equal Y iff TU has TUSTRESC=NEW "
    "rows at that visit"
)
CITATION_NEW_BASELINE = (
    "RECIST 1.1 § 4.3.4: NEW lesions are identified after baseline. "
    "TU.TUSTRESC=NEW requires VISITNUM > the subject's baseline VISITNUM."
)


def _evidence_rows(df: pd.DataFrame, mask: pd.Series) -> list[dict]:
    sub = df.loc[mask]
    return sub.astype(object).where(sub.notna(), None).to_dict(orient="records")


@rule("GHOST_TRLNKID")
def ghost_trlnkid(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []

    tr_with_id = tr[tr["TRLNKID"].astype(str).str.len() > 0]

    for usubjid, sub_tr in tr_with_id.groupby("USUBJID"):
        valid_ids = set(tu.loc[tu["USUBJID"] == usubjid, "TULNKID"].astype(str))

        bad = sub_tr[~sub_tr["TRLNKID"].astype(str).isin(valid_ids)]
        if bad.empty:
            continue

        for ghost_id, ghost_rows in bad.groupby("TRLNKID"):
            for visit, vrows in ghost_rows.groupby("VISIT"):
                tr_mask = (
                    (tr["USUBJID"] == usubjid)
                    & (tr["TRLNKID"] == ghost_id)
                    & (tr["VISIT"] == visit)
                )
                findings.append(
                    Finding(
                        rule_id="GHOST_TRLNKID",
                        severity="HIGH",
                        usubjid=usubjid,
                        visit=visit,
                        message=(
                            f"TR references lesion {ghost_id} at {visit}, but no "
                            f"TU row with TULNKID={ghost_id} exists for this subject."
                        ),
                        template_id="GHOST_REFERENCE",
                        template_params={
                            "ghost_id": ghost_id,
                            "tu_ids": sorted(valid_ids),
                            "tr_ids_at_visit": sorted(
                                set(
                                    tr.loc[
                                        (tr["USUBJID"] == usubjid)
                                        & (tr["VISIT"] == visit)
                                        & (tr["TRLNKID"].astype(str).str.len() > 0),
                                        "TRLNKID",
                                    ].astype(str)
                                )
                            ),
                        },
                        evidence_rows={
                            "TR": _evidence_rows(tr, tr_mask),
                            "TU": _evidence_rows(
                                tu, tu["USUBJID"] == usubjid
                            ),
                        },
                        citation=CITATION_GHOST,
                    )
                )

    return findings


@rule("NEWLPRES_VS_TU")
def newlpres_vs_tu(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []

    newlpres = rs[rs["RSTESTCD"] == "NEWLPRES"]
    for _, rs_row in newlpres.iterrows():
        usubjid = rs_row["USUBJID"]
        visit = rs_row["VISIT"]
        claimed = rs_row["RSORRES"].strip().upper()

        tu_new_at_visit = tu[
            (tu["USUBJID"] == usubjid)
            & (tu["TUSTRESC"] == "NEW")
            & (tu["VISIT"] == visit)
        ]
        tu_says_new = not tu_new_at_visit.empty
        rs_says_new = claimed == "Y"

        if tu_says_new == rs_says_new:
            continue

        if tu_says_new and not rs_says_new:
            msg = (
                f"TU records a NEW lesion at {visit} "
                f"({', '.join(tu_new_at_visit['TULNKID'])}) but RS.NEWLPRES=N."
            )
        else:
            msg = (
                f"RS.NEWLPRES=Y at {visit} but no TU row has TUSTRESC=NEW for "
                f"this visit."
            )

        findings.append(
            Finding(
                rule_id="NEWLPRES_VS_TU",
                severity="HIGH",
                usubjid=usubjid,
                visit=visit,
                message=msg,
                template_id="TIMELINE_MISMATCH",
                template_params={
                    "rs_newlpres": claimed,
                    "tu_new_lesions": tu_new_at_visit["TULNKID"].astype(str).tolist(),
                    "flagged_visit": visit,
                    "claim": "NEWLPRES",
                },
                evidence_rows={
                    "RS": _evidence_rows(
                        rs,
                        (rs["USUBJID"] == usubjid)
                        & (rs["VISIT"] == visit)
                        & (rs["RSTESTCD"].isin(["NEWLPRES", "OVRLRESP"])),
                    ),
                    "TU": _evidence_rows(
                        tu, (tu["USUBJID"] == usubjid) & (tu["VISIT"] == visit)
                    ),
                },
                citation=CITATION_NEWLPRES,
            )
        )

    return findings


@rule("NEW_AT_BASELINE")
def new_at_baseline(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []
    new_rows = tu[tu["TUSTRESC"] == "NEW"]

    for _, row in new_rows.iterrows():
        usubjid = row["USUBJID"]
        baseline_visitnum = tu[tu["USUBJID"] == usubjid]["VISITNUM"].min()
        if row["VISITNUM"] > baseline_visitnum:
            continue

        findings.append(
            Finding(
                rule_id="NEW_AT_BASELINE",
                severity="HIGH",
                usubjid=usubjid,
                visit=row["VISIT"],
                message=(
                    f"TU records lesion {row['TULNKID']} as NEW at {row['VISIT']} "
                    f"(baseline visit). NEW lesions are only valid after baseline."
                ),
                template_id="MEASURABILITY",
                template_params={
                    "actual": None,
                    "threshold": None,
                    "lesion_id": row["TULNKID"],
                    "violation": "NEW at baseline visit",
                    "visitnum": float(row["VISITNUM"]),
                    "baseline_visitnum": float(baseline_visitnum),
                },
                evidence_rows={
                    "TU": _evidence_rows(
                        tu,
                        (tu["USUBJID"] == usubjid) & (tu["TULNKID"] == row["TULNKID"]),
                    ),
                },
                citation=CITATION_NEW_BASELINE,
            )
        )

    return findings
