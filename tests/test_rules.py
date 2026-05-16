from pathlib import Path

import pytest

from engine import rules  # noqa: F401  (registers rules)
from engine.loader import load_data
from engine.registry import RULES, run_all

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def findings():
    return run_all(load_data(DATA_DIR))


def _by_rule(findings, rule_id):
    return [f for f in findings if f.rule_id == rule_id]


def test_all_rules_registered():
    expected = {
        "TU-001", "TU-002", "TU-TR-001",
        "TR-001", "TR-002", "TR-003", "LARGE_DROP", "VISIT_WINDOW",
        "TR-RS-001", "TR-RS-003", "TU/TR-RS-002",
        "DM-001", "DM-002", "LB-ADLB-001",
    }
    assert expected <= set(RULES.keys())


def test_severity_rebanding(findings):
    by_rule = {f.rule_id: f for f in findings}
    # Critical-by-policy
    for crit in ("TR-RS-001", "TR-RS-003", "TU/TR-RS-002", "LB-ADLB-001"):
        if crit in by_rule:
            assert by_rule[crit].severity == "Critical", crit
    # Warning-by-policy (the rebanded ones)
    for warn in ("TU-002", "TU-TR-001", "TR-003", "LARGE_DROP", "VISIT_WINDOW"):
        if warn in by_rule:
            assert by_rule[warn].severity == "Warning", warn


def test_lb_adlb_001_catches_subj003_week16(findings):
    fs = _by_rule(findings, "LB-ADLB-001")
    assert [(f.subject_id, f.visit) for f in fs] == [("SUBJ003", "Week 16")]
    f = fs[0]
    assert f.template_params["total"] == 0.8
    assert f.template_params["direct"] == 1.8


def test_dm_eligibility_silent_on_clean_dataset(findings):
    # All 5 subjects are 18+ and consent precedes screening, so DM rules
    # are silent against this seed dataset.
    assert _by_rule(findings, "DM-001") == []
    assert _by_rule(findings, "DM-002") == []


def test_tu_002_catches_subj005(findings):
    fs = _by_rule(findings, "TU-002")
    assert [(f.subject_id, f.template_params["lesion_id"]) for f in fs] == [
        ("SUBJ005", "T01")
    ]


def test_tu_tr_001(findings):
    fs = _by_rule(findings, "TU-TR-001")
    keys = {(f.subject_id, f.visit, f.template_params["ghost_id"]) for f in fs}
    assert keys == {("SUBJ003", "Week 16", "T03")}


def test_tr_rs_001(findings):
    fs = _by_rule(findings, "TR-RS-001")
    pairs = {(f.subject_id, f.visit) for f in fs}
    assert pairs == {("SUBJ001", "Week 16")}
    f = fs[0]
    assert f.template_params["baseline_sum"] == 63.0
    assert f.template_params["current_sum"] == 56.5


def test_tu_tr_rs_002(findings):
    fs = _by_rule(findings, "TU/TR-RS-002")
    assert [(f.subject_id, f.visit) for f in fs] == [("SUBJ002", "Week 24")]


def test_tr_rs_003(findings):
    fs = _by_rule(findings, "TR-RS-003")
    assert [(f.subject_id, f.visit) for f in fs] == [("SUBJ004", "Week 32")]


def test_tr_003_only_baseline_deviation(findings):
    fs = _by_rule(findings, "TR-003")
    assert [(f.subject_id, f.visit) for f in fs] == [("SUBJ002", "Week 32")]


def test_large_drop(findings):
    fs = _by_rule(findings, "LARGE_DROP")
    assert [(f.subject_id, f.visit) for f in fs] == [("SUBJ003", "Week 24")]


def test_visit_window(findings):
    fs = _by_rule(findings, "VISIT_WINDOW")
    assert [(f.subject_id, f.visit) for f in fs] == [("SUBJ001", "Week 40")]


def test_tr_002_three_standardizations(findings):
    fs = _by_rule(findings, "TR-002")
    keys = {(f.subject_id, f.visit, f.template_params["field"]) for f in fs}
    assert keys == {
        ("SUBJ001", "Baseline", "assessment_method_raw"),
        ("SUBJ001", "Week 16", "target_lesion_response_raw"),
        ("SUBJ003", "Week 8", "measurement_unit_raw"),
    }


def test_tu_001_and_tr_001_silent(findings):
    assert _by_rule(findings, "TU-001") == []
    assert _by_rule(findings, "TR-001") == []


def test_lineage_populated_for_every_finding(findings):
    for f in findings:
        assert f.lineage.form, f"{f.rule_id} missing form"
        assert f.lineage.field, f"{f.rule_id} missing field"
        assert f.lineage.source_doc, f"{f.rule_id} missing source_doc"


def test_subj001_clean_except_seeded(findings):
    seeded_subj001_rules = {"TR-RS-001", "TR-002", "VISIT_WINDOW"}
    for f in findings:
        if f.subject_id == "SUBJ001":
            assert f.rule_id in seeded_subj001_rules, (
                f"unexpected SUBJ001 finding from {f.rule_id} at {f.visit}"
            )
