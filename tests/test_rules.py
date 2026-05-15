from pathlib import Path

import pytest

from engine import rules  # noqa: F401
from engine.loader import load_csvs
from engine.registry import RULES, run_all

DATA = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def datasets():
    return load_csvs(DATA / "tu.csv", DATA / "tr.csv", DATA / "rs.csv")


@pytest.fixture(scope="module")
def findings(datasets):
    tu, tr, rs = datasets
    return run_all(tu, tr, rs)


def _by_rule(findings, rule_id):
    return [f for f in findings if f.rule_id == rule_id]


def test_pr_threshold_fires_on_site02(findings):
    fs = _by_rule(findings, "PR_THRESHOLD")
    visits = {(f.usubjid, f.visit) for f in fs}
    assert ("SITE01-0002", "C2D1") in visits
    assert ("SITE01-0002", "C4D1") in visits
    assert all(f.usubjid == "SITE01-0002" for f in fs)


def test_pd_threshold_fires_on_site05(findings):
    fs = _by_rule(findings, "PD_THRESHOLD")
    assert len(fs) == 1
    assert fs[0].usubjid == "SITE01-0005"
    assert fs[0].visit == "C4D1"


def test_ghost_trlnkid(findings):
    fs = _by_rule(findings, "GHOST_TRLNKID")
    assert len(fs) == 1
    assert fs[0].usubjid == "SITE01-0005"
    assert fs[0].template_params["ghost_id"] == "L4"


def test_max_targets(findings):
    fs = _by_rule(findings, "MAX_TARGETS")
    assert [f.usubjid for f in fs] == ["SITE01-0004"]


def test_max_per_organ(findings):
    fs = _by_rule(findings, "MAX_PER_ORGAN")
    assert [(f.usubjid, f.template_params["organ"]) for f in fs] == [
        ("SITE01-0004", "LIVER")
    ]


def test_ln_measurability(findings):
    fs = _by_rule(findings, "LN_MEASURABILITY")
    assert [f.usubjid for f in fs] == ["SITE01-0003"]
    assert fs[0].template_params["actual"] == 12.0


def test_nontarget_ldiam(findings):
    fs = _by_rule(findings, "NONTARGET_LDIAM")
    assert [(f.usubjid, f.visit) for f in fs] == [("SITE01-0002", "SCREENING")]


def test_newlpres_vs_tu(findings):
    fs = _by_rule(findings, "NEWLPRES_VS_TU")
    assert [(f.usubjid, f.visit) for f in fs] == [("SITE01-0004", "C4D1")]


def test_new_at_baseline(findings):
    fs = _by_rule(findings, "NEW_AT_BASELINE")
    assert [(f.usubjid, f.visit) for f in fs] == [("SITE01-0005", "SCREENING")]


def test_bor_consistency(findings):
    fs = _by_rule(findings, "BOR_CONSISTENCY")
    assert [f.usubjid for f in fs] == ["SITE01-0002"]


def test_cr_nontarget(findings):
    fs = _by_rule(findings, "CR_NONTARGET")
    assert [(f.usubjid, f.visit) for f in fs] == [("SITE01-0003", "C4D1")]


def test_no_findings_on_clean_patient(findings):
    assert [f for f in findings if f.usubjid == "SITE01-0001"] == []


def test_all_rules_registered():
    expected = {
        "PR_THRESHOLD", "PD_THRESHOLD", "GHOST_TRLNKID", "MAX_TARGETS",
        "MAX_PER_ORGAN", "LN_MEASURABILITY", "NONTARGET_LDIAM",
        "NEWLPRES_VS_TU", "NEW_AT_BASELINE", "BOR_CONSISTENCY", "CR_NONTARGET",
    }
    assert expected.issubset(RULES.keys())
