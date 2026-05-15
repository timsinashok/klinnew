import pandas as pd

from engine.finding import Finding
from engine.registry import rule

LN_SHORT_AXIS_THRESHOLD = 15.0
CITATION_LN = (
    "RECIST 1.1 § 2.2 (lymph nodes must have short axis ≥15mm to be a measurable target)"
)
CITATION_NT = (
    "RECIST 1.1 § 3.1.2 (non-target lesions are assessed qualitatively: "
    "PRESENT/ABSENT/EQUIVOCAL, never with numeric diameter)"
)


def _evidence_rows(df: pd.DataFrame, mask: pd.Series) -> list[dict]:
    sub = df.loc[mask]
    return sub.astype(object).where(sub.notna(), None).to_dict(orient="records")


@rule("LN_MEASURABILITY")
def ln_measurability(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []

    ln_targets = tu[
        (tu["TUSTRESC"] == "TARGET") & (tu["TULOC"] == "LYMPH NODE")
    ]

    for _, tu_row in ln_targets.iterrows():
        usubjid = tu_row["USUBJID"]
        lnkid = tu_row["TULNKID"]

        baseline_visitnum = tr[tr["USUBJID"] == usubjid]["VISITNUM"].min()

        saxis = tr[
            (tr["USUBJID"] == usubjid)
            & (tr["TRLNKID"] == lnkid)
            & (tr["TRTESTCD"] == "SAXIS")
            & (tr["VISITNUM"] == baseline_visitnum)
        ]
        if saxis.empty:
            continue

        sa_val = float(saxis.iloc[0]["TRSTRESN"])
        if sa_val >= LN_SHORT_AXIS_THRESHOLD:
            continue

        baseline_visit = saxis.iloc[0]["VISIT"]
        findings.append(
            Finding(
                rule_id="LN_MEASURABILITY",
                severity="MEDIUM",
                usubjid=usubjid,
                visit=baseline_visit,
                message=(
                    f"Lymph node target {lnkid} has baseline short axis {sa_val:g}mm "
                    f"(<{LN_SHORT_AXIS_THRESHOLD:g}mm). Per RECIST 1.1 it is not a "
                    f"measurable target."
                ),
                template_id="MEASURABILITY",
                template_params={
                    "actual": sa_val,
                    "threshold": LN_SHORT_AXIS_THRESHOLD,
                    "unit": "mm",
                    "measure": "short axis",
                    "lesion_id": lnkid,
                },
                evidence_rows={
                    "TU": _evidence_rows(
                        tu,
                        (tu["USUBJID"] == usubjid) & (tu["TULNKID"] == lnkid),
                    ),
                    "TR": _evidence_rows(
                        tr,
                        (tr["USUBJID"] == usubjid)
                        & (tr["TRLNKID"] == lnkid)
                        & (tr["TRTESTCD"] == "SAXIS"),
                    ),
                },
                citation=CITATION_LN,
            )
        )

    return findings


@rule("NONTARGET_LDIAM")
def nontarget_ldiam(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []

    nt = tu[tu["TUSTRESC"] == "NON-TARGET"][["USUBJID", "TULNKID"]]
    nt_keys = set(zip(nt["USUBJID"], nt["TULNKID"]))

    numeric_tr = tr[tr["TRTESTCD"].isin(["LDIAM", "SAXIS"])]
    for _, row in numeric_tr.iterrows():
        key = (row["USUBJID"], row["TRLNKID"])
        if key not in nt_keys:
            continue

        findings.append(
            Finding(
                rule_id="NONTARGET_LDIAM",
                severity="MEDIUM",
                usubjid=row["USUBJID"],
                visit=row["VISIT"],
                message=(
                    f"Non-target lesion {row['TRLNKID']} has a numeric "
                    f"{row['TRTESTCD']} ({row['TRORRES']}{row['TRORRESU']}) recorded. "
                    f"Non-targets must be assessed qualitatively only."
                ),
                template_id="MEASURABILITY",
                template_params={
                    "actual": float(row["TRSTRESN"]) if pd.notna(row["TRSTRESN"]) else None,
                    "threshold": None,
                    "unit": row.get("TRORRESU") or "mm",
                    "measure": row["TRTESTCD"],
                    "lesion_id": row["TRLNKID"],
                    "violation": "numeric measurement on non-target",
                },
                evidence_rows={
                    "TU": _evidence_rows(
                        tu,
                        (tu["USUBJID"] == row["USUBJID"])
                        & (tu["TULNKID"] == row["TRLNKID"]),
                    ),
                    "TR": _evidence_rows(
                        tr,
                        (tr["USUBJID"] == row["USUBJID"])
                        & (tr["TRLNKID"] == row["TRLNKID"])
                        & (tr["VISIT"] == row["VISIT"]),
                    ),
                },
                citation=CITATION_NT,
            )
        )

    return findings
