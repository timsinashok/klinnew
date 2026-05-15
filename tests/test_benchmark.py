from pathlib import Path

import pandas as pd
import pytest

from benchmark import evaluate
from engine import rules  # noqa: F401
from engine.loader import load_data
from engine.registry import run_all

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(scope="module")
def report():
    findings = [f.to_dict() for f in run_all(load_data(DATA_DIR))]
    # lineage is a Lineage dataclass; to_dict converts it. Confirm shape:
    for f in findings:
        assert isinstance(f["lineage"], dict)
    truth = pd.read_csv(DATA_DIR / "expected_issues.csv")
    return evaluate(findings, truth)


def test_full_recall(report):
    assert report["recall"] == 1.0, report["missing"]
    assert report["covered_count"] == 11


def test_no_false_positives(report):
    assert report["false_positives"] == []


def test_every_truth_issue_caught(report):
    for issue, rules_caught in report["per_issue"].items():
        assert rules_caught, f"{issue} not caught"
