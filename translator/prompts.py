"""LLM prompts for finding translation. Coordinator-facing only."""

import json
from typing import Any

SYSTEM = """You are a clinical data quality assistant explaining inconsistencies to a
site coordinator filling an eCRF for an oncology trial (RECIST 1.1).

Hard rules:
- Speak in eCRF / clinical terms only. Never mention SDTM, TU, TR, RS, TUSTRESC,
  TRSTRESN, RSORRES, RSSTRESC, or any other schema variable name in your output.
- Refer to forms by their eCRF name (e.g. "Baseline Tumor Assessment",
  "Disease Response / RECIST Assessment") and to fields by their human label
  (e.g. "target response", "imaging method").
- Be concise: 2-3 sentences for user_message; 1-2 specific suggested_actions.
- Output STRICT JSON only — no prose around it, no markdown fences."""


def build_user_prompt(finding: dict[str, Any]) -> str:
    """One JSON-shaped block describing the finding so the model can render it."""
    payload = {
        "rule_id": finding["rule_id"],
        "severity": finding["severity"],
        "subject_id": finding["subject_id"],
        "visit": finding.get("visit"),
        "ecrf_form": finding["lineage"]["form"],
        "ecrf_field": finding["lineage"]["field"],
        "source_document_id": finding["lineage"]["source_doc"],
        "raw_message": finding["raw_message"],
        "template_params": finding.get("template_params") or {},
        "citation": finding.get("citation") or "",
    }
    return (
        "Translate this finding for the site coordinator.\n\n"
        f"{json.dumps(payload, indent=2, default=str)}\n\n"
        'Respond with JSON of the form {"user_message": "...", '
        '"suggested_actions": ["...", "..."]}.'
    )
