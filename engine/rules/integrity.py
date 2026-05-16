import pandas as pd

from engine.finding import Finding, Lineage, lineage_from_row, rows_to_records
from engine.registry import rule

CITATION = "SDTM IG: TR.TRLNKID must reference an identified lesion in TU.TULNKID"
CITATION_DUP = (
    "Klin convention: the same TULNKID for a subject must denote one lesion identity "
    "(same TULOC, TUORRES)."
)


@rule("TU-TR-001", severity="Warning", layer="Cross-domain")
def tu_tr_ghost_lesion(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tu, tr = data["tu"], data["tr"]
    findings: list[Finding] = []

    tr_keyed = tr[tr["TRLNKID"].astype(str).str.len() > 0]

    for usubjid, sub in tr_keyed.groupby("USUBJID"):
        valid = set(tu.loc[tu["USUBJID"] == usubjid, "TULNKID"].astype(str))
        bad = sub[~sub["TRLNKID"].astype(str).isin(valid)]
        if bad.empty:
            continue

        for (ghost_id, visit), rows in bad.groupby(["TRLNKID", "VISIT"]):
            first = rows.iloc[0]
            findings.append(
                Finding(
                    rule_id="TU-TR-001",
                    severity="Warning",
                    subject_id=usubjid,
                    visit=visit,
                    domain="TR",
                    variable="TRLNKID",
                    lineage=lineage_from_row(first),
                    evidence_rows={
                        "TR": rows_to_records(rows),
                        "TU": rows_to_records(tu[tu["USUBJID"] == usubjid]),
                    },
                    raw_message=(
                        f"TR references lesion {ghost_id} at {visit}, but no TU "
                        f"record with TULNKID={ghost_id} exists for {usubjid}."
                    ),
                    template_id="GHOST_REFERENCE",
                    template_params={
                        "ghost_id": ghost_id,
                        "tu_ids": sorted(valid),
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
                    citation=CITATION,
                )
            )

    return findings


@rule("TU-002", severity="Warning", layer="Within-domain")
def tu_duplicate_identity(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tu = data["tu"]
    findings: list[Finding] = []

    for (usubjid, lnkid), rows in tu.groupby(["USUBJID", "TULNKID"]):
        if len(rows) <= 1:
            continue
        identities = rows[["TULOC", "TUORRES"]].drop_duplicates()
        if len(identities) <= 1:
            continue

        first = rows.iloc[0]
        locs = sorted(set(rows["TULOC"].astype(str)))
        findings.append(
            Finding(
                rule_id="TU-002",
                severity="Warning",
                subject_id=usubjid,
                visit=first.get("VISIT") or None,
                domain="TU",
                variable="TULNKID/TULOC",
                lineage=lineage_from_row(first),
                evidence_rows={"TU": rows_to_records(rows)},
                raw_message=(
                    f"Lesion {lnkid} is listed with conflicting identities "
                    f"({' vs '.join(locs)}) for {usubjid}."
                ),
                template_id="DUPLICATE_IDENTITY",
                template_params={
                    "lesion_id": lnkid,
                    "conflicting_locations": locs,
                    "row_count": int(len(rows)),
                },
                citation=CITATION_DUP,
            )
        )

    return findings
