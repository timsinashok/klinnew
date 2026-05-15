"""Orchestrator: take a Finding, populate user_message + suggested_actions.

Tries the LLM first when enabled and the API key is present; falls back to the
deterministic templater on any error or when the LLM is disabled.

Results are cached in-memory keyed by (rule_id, lineage tuple, evidence hash)
so repeated translations of the same finding are free.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover — optional
    pass

from engine.finding import Finding
from translator import llm, templater

logger = logging.getLogger(__name__)

_CACHE: dict[tuple, tuple[str, list[str], str]] = {}


def _cache_key(finding: dict[str, Any]) -> tuple:
    ev = json.dumps(finding.get("evidence_rows") or {}, sort_keys=True, default=str)
    ev_hash = hashlib.sha1(ev.encode()).hexdigest()
    lineage = finding["lineage"]
    return (
        finding["rule_id"],
        finding["subject_id"],
        finding.get("visit") or "",
        lineage["form"],
        lineage["field"],
        lineage["source_doc"],
        ev_hash,
    )


def translate(
    finding: Finding,
    *,
    enable_llm: bool = True,
    model: str = llm.DEFAULT_MODEL,
) -> Finding:
    """Populate `user_message`, `suggested_actions`, `translator_source`."""
    payload = finding.to_dict()
    key = _cache_key(payload)
    if key in _CACHE:
        msg, actions, source = _CACHE[key]
        finding.user_message = msg
        finding.suggested_actions = list(actions)
        finding.translator_source = source
        return finding

    use_llm = enable_llm and os.environ.get("ANTHROPIC_API_KEY")
    if use_llm:
        try:
            msg, actions = llm.call_llm(payload, model=model)
            source = "llm"
        except llm.LLMUnavailable as e:
            logger.info("falling back to template (%s)", e)
            msg, actions = templater.render(payload)
            source = "template"
    else:
        msg, actions = templater.render(payload)
        source = "template"

    finding.user_message = msg
    finding.suggested_actions = actions
    finding.translator_source = source
    _CACHE[key] = (msg, list(actions), source)
    return finding


def translate_all(
    findings: list[Finding],
    *,
    enable_llm: bool = True,
    model: str = llm.DEFAULT_MODEL,
) -> list[Finding]:
    for f in findings:
        translate(f, enable_llm=enable_llm, model=model)
    return findings


def clear_cache() -> None:
    _CACHE.clear()
