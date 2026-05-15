import re

import pandas as pd

from engine.finding import Finding, lineage_from_row, rows_to_records
from engine.registry import rule

LESION_ID_RE = re.compile(r"^(T|NT|NEW)\d{2}$")
CITATION = "Klin convention: lesion IDs must follow T01/NT01/NEW01."
CITATION_NUMERIC = (
    "SDTM IG: TR diameter records must have a numeric TRSTRESN and a unit TRSTRESU."
)


@rule("TU-001", severity="Critical", layer="Basic")
def tu_lesion_id_format(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tu = data["tu"]
    findings: list[Finding] = []

    for _, row in tu.iterrows():
        lnkid = str(row.get("TULNKID") or "").strip()
        if lnkid and LESION_ID_RE.match(lnkid):
            continue

        findings.append(
            Finding(
                rule_id="TU-001",
                severity="Critical",
                subject_id=row["USUBJID"],
                visit=row.get("VISIT") or None,
                domain="TU",
                variable="TULNKID",
                lineage=lineage_from_row(row),
                evidence_rows={"TU": rows_to_records(pd.DataFrame([row]))},
                raw_message=(
                    f"TULNKID {lnkid!r} does not follow the T01/NT01/NEW01 "
                    f"convention."
                ),
                template_id="BASIC_FIELD",
                template_params={
                    "value": lnkid,
                    "pattern": "T01 / NT01 / NEW01",
                },
                citation=CITATION,
            )
        )

    return findings


@rule("TR-001", severity="Critical", layer="Basic")
def tr_diameter_numeric_with_unit(
    data: dict[str, pd.DataFrame],
) -> list[Finding]:
    tr = data["tr"]
    findings: list[Finding] = []

    diam = tr[tr["TRTESTCD"] == "DIAMETER"]
    for _, row in diam.iterrows():
        value = pd.to_numeric(row.get("TRSTRESN"), errors="coerce")
        unit = str(row.get("TRSTRESU") or "").strip()
        if pd.notna(value) and unit:
            continue

        findings.append(
            Finding(
                rule_id="TR-001",
                severity="Critical",
                subject_id=row["USUBJID"],
                visit=row.get("VISIT") or None,
                domain="TR",
                variable="TRSTRESN/TRSTRESU",
                lineage=lineage_from_row(row),
                evidence_rows={"TR": rows_to_records(pd.DataFrame([row]))},
                raw_message=(
                    f"Diameter record for lesion {row.get('TRLNKID')} is missing "
                    f"a numeric value or unit (TRSTRESN={value!r}, TRSTRESU={unit!r})."
                ),
                template_id="BASIC_FIELD",
                template_params={"value": str(value), "unit": unit},
                citation=CITATION_NUMERIC,
            )
        )

    return findings
