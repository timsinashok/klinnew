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
