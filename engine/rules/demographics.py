"""Subject-level eligibility checks driven by the DM domain."""

import pandas as pd

from engine.finding import Finding, lineage_from_row, rows_to_records
from engine.registry import rule

CITATION_AGE = (
    "Protocol § 2.0 Key eligibility — Subjects must be at least 18 years old."
)
CITATION_CONSENT = (
    "Protocol § 2.0 Key eligibility — Informed consent must be on or before "
    "the first screening assessment."
)


def _lineage_for_dm(row: pd.Series):
    # DM rows don't always carry source_field; synthesize from source_ecrf_form.
    from engine.finding import Lineage

    return Lineage(
        form=str(row.get("source_ecrf_form") or "Demographics / Screening"),
        field="eligibility",
        source_doc=str(row.get("source_document_id") or ""),
    )


@rule("DM-001", severity="Critical", layer="Protocol/basic")
def dm_age_minimum(data: dict[str, pd.DataFrame]) -> list[Finding]:
    dm = data.get("dm")
    if dm is None or dm.empty:
        return []
    findings: list[Finding] = []
    for _, row in dm.iterrows():
        age = pd.to_numeric(row.get("AGE"), errors="coerce")
        ageu = str(row.get("AGEU") or "").upper()
        if pd.isna(age) or ageu != "YEARS":
            continue
        if age >= 18:
            continue
        findings.append(
            Finding(
                rule_id="DM-001",
                severity="Critical",
                subject_id=row["USUBJID"],
                visit="Screening",
                domain="DM",
                variable="AGE/AGEU",
                lineage=_lineage_for_dm(row),
                evidence_rows={"DM": rows_to_records(pd.DataFrame([row]))},
                raw_message=(
                    f"Subject {row['USUBJID']} recorded age "
                    f"{float(age):g} {ageu}, below the 18-year minimum."
                ),
                template_id="ELIGIBILITY",
                template_params={
                    "field": "age",
                    "value": float(age),
                    "minimum": 18,
                },
                citation=CITATION_AGE,
            )
        )
    return findings


@rule("DM-002", severity="Critical", layer="Protocol/basic")
def dm_consent_before_screening(
    data: dict[str, pd.DataFrame],
) -> list[Finding]:
    """RFICDTC (informed consent) must precede the screening date.

    The screening date is taken from `ecrf_dm.screening_date` since DM proper
    doesn't carry it as a column.
    """
    dm = data.get("dm")
    ecrf_dm = data.get("ecrf_dm")
    if dm is None or dm.empty or ecrf_dm is None or ecrf_dm.empty:
        return []

    screen_by_subject = {
        row["subject_id"]: row.get("screening_date")
        for _, row in ecrf_dm.iterrows()
    }
    findings: list[Finding] = []
    for _, row in dm.iterrows():
        sid = row["USUBJID"]
        consent = pd.to_datetime(row.get("RFICDTC"), errors="coerce")
        screening = pd.to_datetime(
            screen_by_subject.get(sid), errors="coerce"
        )
        if pd.isna(consent) or pd.isna(screening):
            continue
        if consent <= screening:
            continue
        findings.append(
            Finding(
                rule_id="DM-002",
                severity="Critical",
                subject_id=sid,
                visit="Screening",
                domain="DM",
                variable="RFICDTC/screening_date",
                lineage=_lineage_for_dm(row),
                evidence_rows={"DM": rows_to_records(pd.DataFrame([row]))},
                raw_message=(
                    f"Informed consent ({consent.date()}) was recorded after "
                    f"screening ({screening.date()}) for {sid}."
                ),
                template_id="ELIGIBILITY",
                template_params={
                    "field": "informed_consent_date",
                    "consent_date": str(consent.date()),
                    "screening_date": str(screening.date()),
                },
                citation=CITATION_CONSENT,
            )
        )
    return findings
