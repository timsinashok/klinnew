import pandas as pd

from engine.finding import Finding, lineage_from_row, rows_to_records
from engine.registry import rule

CITATION = (
    "RECIST 1.1 § 4.3.2: an unequivocal new lesion implies overall response = PD "
    "and RS.NEWLRESP must indicate new lesions."
)


@rule("TU/TR-RS-002", severity="Critical", layer="Medical logic")
def new_lesion_conflict(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tu, rs = data["tu"], data["rs"]
    findings: list[Finding] = []

    new_rows = tu[tu["TUORRES"] == "NEW"]
    for (usubjid, visit), grp in new_rows.groupby(["USUBJID", "VISIT"]):
        rs_visit = rs[(rs["USUBJID"] == usubjid) & (rs["VISIT"] == visit)]
        if rs_visit.empty:
            continue

        newlresp = rs_visit[rs_visit["RSTESTCD"] == "NEWLRESP"]
        ovrl = rs_visit[rs_visit["RSTESTCD"] == "OVRLRESP"]
        newlresp_value = (
            str(newlresp.iloc[0]["RSSTRESC"]).strip().upper() if not newlresp.empty else ""
        )
        ovrl_value = (
            str(ovrl.iloc[0]["RSSTRESC"]).strip().upper() if not ovrl.empty else ""
        )

        no_new_claimed = newlresp_value in {"NO NEW LESIONS", "NO", "N", ""}
        ovrl_not_pd = ovrl_value and ovrl_value != "PD"

        if not (no_new_claimed or ovrl_not_pd):
            continue

        new_ids = grp["TULNKID"].astype(str).tolist()
        first = grp.iloc[0]
        findings.append(
            Finding(
                rule_id="TU/TR-RS-002",
                severity="Critical",
                subject_id=usubjid,
                visit=visit,
                domain="TU/TR/RS",
                variable="TUORRES/RSORRES",
                lineage=lineage_from_row(first),
                evidence_rows={
                    "TU": rows_to_records(grp),
                    "RS": rows_to_records(rs_visit),
                },
                raw_message=(
                    f"TU records new lesion(s) {', '.join(new_ids)} at {visit}, "
                    f"but RS reports NEWLRESP={newlresp_value!r} and "
                    f"OVRLRESP={ovrl_value!r}. New lesion implies PD."
                ),
                template_id="NEW_LESION_CONFLICT",
                template_params={
                    "new_lesion_ids": new_ids,
                    "rs_newlresp": newlresp_value,
                    "rs_ovrlresp": ovrl_value,
                },
                citation=CITATION,
            )
        )

    return findings
