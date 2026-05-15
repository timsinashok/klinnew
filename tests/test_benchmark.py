from pathlib import Path

import pandas as pd
import pytest

from benchmark import evaluate
from engine import rules  # noqa: F401
from engine.loader import load_csvs
from engine.registry import run_all

DATA = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def report():
    tu, tr, rs = load_csvs(DATA / "tu.csv", DATA / "tr.csv", DATA / "rs.csv")
    findings = run_all(tu, tr, rs)
    findings_dicts = [f.to_dict() for f in findings]
    truth = pd.read_csv(DATA / "ground_truth.csv")
    return evaluate(findings_dicts, truth)


def test_full_recall(report):
    assert report["recall"] == 1.0, report["missing"]
    assert report["covered_count"] == 11


def test_no_false_positives(report):
    assert report["false_positives"] == []


def test_every_truth_error_mapped(report):
    for err, rule_ids in report["per_error"].items():
        assert rule_ids, f"{err} not caught by any rule"
