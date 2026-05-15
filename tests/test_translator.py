"""Translator tests: deterministic fallback must always work; LLM path is
optional and only exercised when ANTHROPIC_API_KEY is set.
"""

from pathlib import Path

import pytest

from engine import rules  # noqa: F401
from engine.loader import load_data
from engine.registry import run_all
import translator.translate as translate_mod
from translator.translate import clear_cache, translate, translate_all

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# SDTM variable names that must NEVER appear in coordinator-facing text.
FORBIDDEN_TERMS = [
    "TUSTRESC", "TRSTRESN", "TRSTRESC", "RSORRES", "RSSTRESC",
    "TULNKID", "TRLNKID", "RSLNKGRP", "TRTESTCD", "RSTESTCD",
    "TUMETHOD", "TRMETHOD",
]


@pytest.fixture(scope="module")
def raw_findings():
    return run_all(load_data(DATA_DIR))


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_cache()


def test_fallback_path_without_api_key(monkeypatch, raw_findings):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = translate_all(list(raw_findings), enable_llm=True)
    assert len(out) == len(raw_findings)
    for f in out:
        assert f.user_message, f"{f.rule_id} missing user_message"
        assert f.suggested_actions, f"{f.rule_id} missing suggested_actions"
        assert f.translator_source == "template"


def test_no_sdtm_variable_names_leak(monkeypatch, raw_findings):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = translate_all(list(raw_findings), enable_llm=False)
    for f in out:
        haystack = (f.user_message + " " + " ".join(f.suggested_actions)).upper()
        for term in FORBIDDEN_TERMS:
            assert term not in haystack, (
                f"{f.rule_id} leaked SDTM term {term!r} in coordinator text"
            )


def test_explicit_disable_uses_template_even_with_key(monkeypatch, raw_findings):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key-for-test")
    out = translate_all(list(raw_findings), enable_llm=False)
    for f in out:
        assert f.translator_source == "template"


def test_llm_failure_falls_back_to_template(monkeypatch, raw_findings):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "fake-key-for-test")

    def boom(*a, **kw):
        raise translate_mod.llm.LLMUnavailable("simulated")

    monkeypatch.setattr(translate_mod.llm, "call_llm", boom)
    f = translate(raw_findings[0], enable_llm=True)
    assert f.translator_source == "template"
    assert f.user_message


def test_lineage_form_referenced_in_message(monkeypatch, raw_findings):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    out = translate_all(list(raw_findings), enable_llm=False)
    # At least one finding's translated message should name the eCRF form.
    forms_in_messages = {
        f.lineage.form for f in out if f.lineage.form and f.lineage.form in f.user_message
    }
    assert forms_in_messages, "no finding mentions its eCRF form by name"


def test_cache_returns_same_object_on_second_call(raw_findings):
    f = raw_findings[0]
    translate(f, enable_llm=False)
    first_msg = f.user_message
    f.user_message = "ZAPPED"
    translate(f, enable_llm=False)
    assert f.user_message == first_msg
