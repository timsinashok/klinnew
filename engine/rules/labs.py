"""Lab analysis checks. Operates on the LB domain.

LB-ADLB-001 is a deliberately cross-record, ADLB-style check: direct
bilirubin (DBILI) cannot exceed total bilirubin (BILI) for the same subject,
visit, and collection date. It can only be detected when paired LB rows are
combined; no single row fails on its own.
"""

import pandas as pd

from engine.finding import Finding, Lineage, rows_to_records
from engine.registry import rule

CITATION = (
    "Protocol § 6.0 Safety laboratory assessments — Direct bilirubin is a "
    "component of total bilirubin; DBILI > BILI is biologically impossible."
)


@rule("LB-ADLB-001", severity="Critical", layer="Medical analysis")
def bilirubin_coherence(data: dict[str, pd.DataFrame]) -> list[Finding]:
    lb = data.get("lb")
    if lb is None or lb.empty:
        return []

    bili = lb[lb["LBTESTCD"] == "BILI"][
        ["USUBJID", "VISIT", "LBDTC", "LBSTRESN", "LBSTRESU"]
    ].rename(columns={"LBSTRESN": "total", "LBSTRESU": "unit_total"})
    dbili = lb[lb["LBTESTCD"] == "DBILI"][
        ["USUBJID", "VISIT", "LBDTC", "LBSTRESN", "LBSTRESU"]
    ].rename(columns={"LBSTRESN": "direct", "LBSTRESU": "unit_direct"})

    if bili.empty or dbili.empty:
        return []

    merged = pd.merge(bili, dbili, on=["USUBJID", "VISIT", "LBDTC"], how="inner")
    bad = merged[merged["direct"] > merged["total"]]

    findings: list[Finding] = []
    for _, row in bad.iterrows():
        sid = row["USUBJID"]
        visit = row["VISIT"]
        rows_at_visit = lb[
            (lb["USUBJID"] == sid)
            & (lb["VISIT"] == visit)
            & (lb["LBTESTCD"].isin(["BILI", "DBILI"]))
        ]
        first = rows_at_visit.iloc[0]
        lineage = Lineage(
            form=str(first.get("source_ecrf_form") or "Local/Central Lab Results"),
            field="bilirubin",
            source_doc=str(first.get("source_document_id") or ""),
        )
        findings.append(
            Finding(
                rule_id="LB-ADLB-001",
                severity="Critical",
                subject_id=sid,
                visit=visit,
                domain="LB",
                variable="LBTESTCD=BILI/DBILI · LBSTRESN",
                lineage=lineage,
                evidence_rows={"LB": rows_to_records(rows_at_visit)},
                raw_message=(
                    f"Direct bilirubin {float(row['direct']):g} mg/dL exceeds "
                    f"total bilirubin {float(row['total']):g} mg/dL for "
                    f"{sid} at {visit}."
                ),
                template_id="BILIRUBIN_COHERENCE",
                template_params={
                    "total": float(row["total"]),
                    "direct": float(row["direct"]),
                    "unit": str(row.get("unit_total") or "mg/dL"),
                    "collection_date": str(row["LBDTC"]),
                },
                citation=CITATION,
            )
        )
    return findings
