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
    "ecrf_baseline.csv",
    "ecrf_followup.csv",
    "ecrf_disease_response.csv",
    "patient_history.csv",
    "source_evidence.csv",
    "expected_issues.csv",
    "checks_catalog.csv",
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
