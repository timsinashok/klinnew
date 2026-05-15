import pandas as pd

from engine.finding import Finding, Lineage, rows_to_records
from engine.registry import rule

CANONICAL_METHODS = {"CT SCAN", "MRI", "PET", "PET CT", "ULTRASOUND", "X-RAY"}
CANONICAL_RESPONSES = {
    "CR", "PR", "SD", "PD", "NE", "NON-CR/NON-PD", "NO NEW LESIONS",
}
CITATION = "CDISC controlled terminology: raw eCRF terms must be standardized."


def _emit(
    rule_id: str,
    subject: str,
    visit: str | None,
    form: str,
    field: str,
    source_doc: str,
    raw_value: str,
    canonical: str | None,
    row: pd.Series,
    raw_message: str,
    variable: str,
) -> Finding:
    return Finding(
        rule_id=rule_id,
        severity="Suggested Change",
        subject_id=subject,
        visit=visit,
        domain=f"eCRF_{form.split()[0] if form else 'Unknown'}",
        variable=variable,
        lineage=Lineage(form=form, field=field, source_doc=source_doc),
        evidence_rows={"eCRF": rows_to_records(pd.DataFrame([row]))},
        raw_message=raw_message,
        template_id="STANDARDIZATION",
        template_params={
            "raw_value": raw_value,
            "canonical": canonical,
            "field": field,
        },
        citation=CITATION,
    )


@rule("TR-002", severity="Suggested Change", layer="Standardization")
def standardization(data: dict[str, pd.DataFrame]) -> list[Finding]:
    findings: list[Finding] = []

    eb = data["ecrf_baseline"]
    for _, row in eb.iterrows():
        raw = str(row.get("assessment_method_raw") or "").strip()
        if not raw or raw.upper() in CANONICAL_METHODS:
            continue
        findings.append(
            _emit(
                rule_id="TR-002",
                subject=row["subject_id"],
                visit=row.get("visit") or None,
                form="Baseline Tumor Assessment",
                field="assessment_method_raw",
                source_doc=str(row.get("source_document_id") or ""),
                raw_value=raw,
                canonical="CT SCAN",
                row=row,
                variable="assessment_method_raw / TUMETHOD",
                raw_message=(
                    f"Raw imaging method '{raw}' should be standardized to CT SCAN."
                ),
            )
        )

    ed = data["ecrf_disease_response"]
    for _, row in ed.iterrows():
        raw = str(row.get("target_lesion_response_raw") or "").strip()
        if not raw or raw.upper() in CANONICAL_RESPONSES:
            continue
        canonical = _response_canonical(raw)
        findings.append(
            _emit(
                rule_id="TR-002",
                subject=row["subject_id"],
                visit=row.get("visit") or None,
                form="Disease Response / RECIST Assessment",
                field="target_lesion_response_raw",
                source_doc=str(row.get("source_document_id") or ""),
                raw_value=raw,
                canonical=canonical,
                row=row,
                variable="target_lesion_response_raw / RSSTRESC",
                raw_message=(
                    f"Raw target response '{raw}' should be standardized to {canonical}."
                ),
            )
        )

    ef = data["ecrf_followup"]
    for _, row in ef.iterrows():
        unit = str(row.get("measurement_unit_raw") or "").strip()
        val = pd.to_numeric(row.get("measurement_value"), errors="coerce")
        if pd.isna(val) or not unit or unit.lower() == "mm":
            continue
        converted = float(val) * 10 if unit.lower() == "cm" else None
        canonical = (
            f"{converted:g} mm" if converted is not None else "mm"
        )
        findings.append(
            _emit(
                rule_id="TR-002",
                subject=row["subject_id"],
                visit=row.get("visit") or None,
                form="Follow-up Tumor Assessment",
                field="measurement_unit_raw",
                source_doc=str(row.get("source_document_id") or ""),
                raw_value=f"{val:g} {unit}",
                canonical=canonical,
                row=row,
                variable="measurement_unit_raw / TRSTRESU",
                raw_message=(
                    f"Raw measurement '{val:g} {unit}' should be standardized to "
                    f"{canonical}."
                ),
            )
        )

    return findings


def _response_canonical(raw: str) -> str:
    s = raw.strip().lower()
    table = {
        "complete response": "CR",
        "partial response": "PR",
        "stable disease": "SD",
        "progressive disease": "PD",
        "not evaluable": "NE",
    }
    return table.get(s, raw.upper())
