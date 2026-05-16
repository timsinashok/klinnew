"""Shared helpers for API routes."""

import math
from pathlib import Path

from engine import rules  # noqa: F401  (registers rules)
from engine.finding import Finding
from engine.loader import load_data
from engine.registry import run_all
from translator.translate import translate, translate_all

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

ALLOWED_FILES = {
    "tu.csv",
    "tr.csv",
    "rs.csv",
    "dm.csv",
    "lb.csv",
    "ecrf_baseline.csv",
    "ecrf_followup.csv",
    "ecrf_disease_response.csv",
    "ecrf_dm.csv",
    "ecrf_lb.csv",
    "patient_history.csv",
    "source_evidence.csv",
    "expected_issues.csv",
    "final_issue_log.csv",
    "checks_catalog.csv",
    "study_protocol.csv",
    "protocol_extracted_checks.csv",
    "source_documents.csv",
    "source_document_extraction_map.csv",
    "source_documents_manifest.csv",
}


def _json_safe(obj):
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


def run_engine(*, enable_llm: bool, model: str) -> list[dict]:
    data = load_data(DATA_DIR)
    findings = run_all(data)
    translate_all(findings, enable_llm=enable_llm, model=model)
    return [_json_safe(f.to_dict()) for f in findings]


def translate_one(payload: dict, *, enable_llm: bool, model: str) -> dict:
    """Translate a single finding-shaped dict. Returns the translated dict."""
    lineage = payload.get("lineage") or {}
    finding = Finding(
        rule_id=payload["rule_id"],
        severity=payload["severity"],
        subject_id=payload["subject_id"],
        visit=payload.get("visit"),
        domain=payload.get("domain", ""),
        variable=payload.get("variable", ""),
        lineage=_lineage(lineage),
        evidence_rows=payload.get("evidence_rows") or {},
        raw_message=payload.get("raw_message", ""),
        template_id=payload.get("template_id", ""),
        template_params=payload.get("template_params") or {},
        citation=payload.get("citation", ""),
    )
    translate(finding, enable_llm=enable_llm, model=model)
    return _json_safe(finding.to_dict())


def _lineage(d: dict):
    from engine.finding import Lineage

    return Lineage(
        form=d.get("form", ""),
        field=d.get("field", ""),
        source_doc=d.get("source_doc", ""),
    )


_STUDY = {
    "study_id": "KLIN-ONC-DEMO-001",
    "title": "Phase II Solid Tumour",
    "sponsor": "Klin AI · Synthetic Sponsor",
    "site": "042 · Memorial Cancer Center",
    "criteria": "RECIST 1.1",
    "enrolment_opened": "2026-01-03",
    "enrolment_closed": None,
}

_PLANNED_VISITS = [
    "Baseline",
    "Week 8",
    "Week 16",
    "Week 24",
    "Week 32",
    "Week 40",
    "Week 48",
]


def compute_protocol() -> dict:
    """Returns protocol sections joined with their derived checks."""
    data = load_data(DATA_DIR)
    sections = data.get("study_protocol")
    checks = data.get("protocol_extracted_checks")
    if sections is None or sections.empty:
        return {"sections": [], "checks": []}

    checks_by_id: dict[str, dict] = {}
    if checks is not None and not checks.empty:
        for _, c in checks.iterrows():
            checks_by_id[str(c["check_id"])] = _json_safe(c.to_dict())

    out_sections = []
    for _, row in sections.iterrows():
        ids = [
            s.strip()
            for s in str(row.get("demo_check_ids") or "").split(";")
            if s.strip()
        ]
        out_sections.append(
            {
                "section": row.get("section"),
                "title": row.get("title"),
                "protocol_text": row.get("protocol_text"),
                "data_needed": row.get("data_needed"),
                "domains_impacted": row.get("domains_impacted"),
                "check_ids": ids,
                "checks": [checks_by_id[i] for i in ids if i in checks_by_id],
            }
        )
    return {
        "study_id": "KLIN-ONC-DEMO-001",
        "title": "Phase II Solid Tumour",
        "sections": out_sections,
        "all_checks": [_json_safe(c) for c in checks_by_id.values()],
    }


def compute_sources() -> dict:
    """Returns the 80-doc catalog with extracted text + mapping summary."""
    data = load_data(DATA_DIR)
    docs = data.get("source_documents")
    extr = data.get("source_document_extraction_map")
    eb = data.get("ecrf_baseline")
    ef = data.get("ecrf_followup")
    ed = data.get("ecrf_disease_response")
    edm = data.get("ecrf_dm")
    elb = data.get("ecrf_lb")

    map_by_doc: dict[str, list[dict]] = {}
    if extr is not None and not extr.empty:
        for _, row in extr.iterrows():
            map_by_doc.setdefault(str(row["source_document_id"]), []).append(
                {
                    "file_name": row.get("file_name"),
                    "target_domain": row.get("target_domain"),
                    "target_fields": row.get("target_variables_or_fields"),
                    "source_fields": row.get("source_fields_expected"),
                }
            )

    def _ecrf_consumers(doc_id: str) -> int:
        n = 0
        for d in (eb, ef, ed, edm, elb):
            if d is not None and "source_document_id" in d.columns:
                n += int((d["source_document_id"] == doc_id).sum())
        return n

    out_docs = []
    if docs is not None and not docs.empty:
        for _, row in docs.iterrows():
            did = str(row["source_document_id"])
            out_docs.append(
                {
                    "source_document_id": did,
                    "subject_id": row.get("subject_id"),
                    "visit": row.get("visit"),
                    "document_type": row.get("source_document_type"),
                    "document_date": _json_safe(row.get("document_date")),
                    "page_title": row.get("mock_page_title"),
                    "source_text": row.get("source_text"),
                    "maps_to_domains": row.get("maps_to_domains"),
                    "mappings": map_by_doc.get(did, []),
                    "ecrf_consumer_rows": _ecrf_consumers(did),
                }
            )
    return {"documents": out_docs}


def get_domain(name: str) -> dict:
    """Raw read of a domain frame as records."""
    data = load_data(DATA_DIR)
    df = data.get(name)
    if df is None:
        return {"rows": []}
    return {"rows": [_json_safe(r) for r in df.to_dict(orient="records")]}


def compute_stats() -> dict:
    """Per-subject visit progress + study-level totals.

    Reads the eCRF Tumor-Assessment forms (the system of record for which
    visits actually happened) and groups by subject. Cached implicitly by
    Python pandas at call time; cheap enough to compute fresh.
    """
    data = load_data(DATA_DIR)
    eb = data["ecrf_baseline"]
    ef = data["ecrf_followup"]

    subjects: dict[str, dict] = {}
    for _, row in eb.iterrows():
        sid = row["subject_id"]
        subjects.setdefault(sid, {"visits": set(), "last_date": None})
        subjects[sid]["visits"].add(row["visit"])
        d = str(row.get("assessment_date") or "")
        if d:
            subjects[sid]["last_date"] = max(
                subjects[sid]["last_date"] or "", d
            )
    for _, row in ef.iterrows():
        sid = row["subject_id"]
        subjects.setdefault(sid, {"visits": set(), "last_date": None})
        subjects[sid]["visits"].add(row["visit"])
        d = str(row.get("assessment_date") or "")
        if d:
            subjects[sid]["last_date"] = max(
                subjects[sid]["last_date"] or "", d
            )

    out_subjects = []
    total_visits = 0
    for sid in sorted(subjects):
        s = subjects[sid]
        visits_done = sorted(
            [v for v in s["visits"] if v in _PLANNED_VISITS],
            key=lambda v: _PLANNED_VISITS.index(v),
        )
        latest = visits_done[-1] if visits_done else None
        total_visits += len(visits_done)
        out_subjects.append(
            {
                "subject_id": sid,
                "visits_completed": visits_done,
                "visits_planned": _PLANNED_VISITS,
                "latest_visit": latest,
                "last_visit_date": s["last_date"],
                "status": "Off-study"
                if latest == "Week 48"
                else "Active",
            }
        )

    return {
        "study": _STUDY,
        "subjects": out_subjects,
        "total_subjects": len(out_subjects),
        "total_visits_completed": total_visits,
        "total_visits_planned": len(out_subjects) * len(_PLANNED_VISITS),
    }
