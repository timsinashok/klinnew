"""CLI: compare engine findings to data/final_issue_log.csv.

Maps each rule_id to the set of `issue_id`s it is expected to catch.
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

# Final_Issue_Log issue IDs grouped by engine rule.
RULE_TO_ISSUES: dict[str, set[str]] = {
    "TU-001": set(),
    "TR-001": set(),
    "TU-002": {"WARN-TU-001"},
    "TU-TR-001": {"WARN-TUTR-001"},
    "TR-RS-001": {"CRIT-TRRS-001"},
    "TU/TR-RS-002": {"CRIT-TURSS-002"},
    "TR-RS-003": {"CRIT-TRRS-003"},
    "TR-003": {"WARN-TR-001"},
    "LARGE_DROP": {"WARN-TR-002"},
    "VISIT_WINDOW": {"WARN-VISIT-001"},
    "TR-002": {"SUG-STD-001", "SUG-STD-002", "SUG-STD-003"},
    "DM-001": set(),  # sanity — no expected fire on this dataset
    "DM-002": set(),  # sanity
    "LB-ADLB-001": {"CRIT-LB-001"},
}


def _match(finding: dict, truth: pd.Series) -> bool:
    if finding["subject_id"] != truth["subject_id"]:
        return False
    if truth["issue_id"] not in RULE_TO_ISSUES.get(finding["rule_id"], set()):
        return False
    fv = finding.get("visit")
    tv = truth["visit"]
    if fv is None or fv == "":
        return True
    return fv == tv


def evaluate(findings: list[dict], truth: pd.DataFrame) -> dict:
    covered: dict[str, list[dict]] = {}
    for _, t in truth.iterrows():
        covered[t["issue_id"]] = [f for f in findings if _match(f, t)]

    matched = [
        f for f in findings if any(_match(f, t) for _, t in truth.iterrows())
    ]

    n_truth = len(covered)
    recall = sum(1 for v in covered.values() if v) / n_truth if n_truth else 0
    precision = len(matched) / len(findings) if findings else 0

    return {
        "total_truth": n_truth,
        "covered_count": sum(1 for v in covered.values() if v),
        "missing": [e for e, v in covered.items() if not v],
        "total_findings": len(findings),
        "matched_findings": len(matched),
        "false_positives": [
            {
                "rule_id": f["rule_id"],
                "subject_id": f["subject_id"],
                "visit": f.get("visit"),
            }
            for f in findings
            if f not in matched
        ],
        "recall": recall,
        "precision": precision,
        "per_issue": {e: [f["rule_id"] for f in v] for e, v in covered.items()},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--findings", required=True, type=Path)
    parser.add_argument("--truth", required=True, type=Path)
    args = parser.parse_args(argv)

    findings = json.loads(args.findings.read_text())
    truth = pd.read_csv(args.truth)

    r = evaluate(findings, truth)
    print(
        f"Recall:    {r['covered_count']}/{r['total_truth']} "
        f"({r['recall'] * 100:.0f}%)"
    )
    print(
        f"Precision: {r['matched_findings']}/{r['total_findings']} "
        f"({r['precision'] * 100:.0f}%)"
    )
    if r["missing"]:
        print(f"Missing:   {', '.join(r['missing'])}")
    if r["false_positives"]:
        print("False positives:")
        for fp in r["false_positives"]:
            print(f"  {fp['rule_id']:15s} {fp['subject_id']}  {fp['visit']}")
    print("\nPer-issue mapping:")
    for issue, rules_caught in sorted(r["per_issue"].items()):
        s = ", ".join(rules_caught) if rules_caught else "(missing)"
        print(f"  {issue}: {s}")

    return 0 if (r["recall"] == 1.0 and not r["false_positives"]) else 1


if __name__ == "__main__":
    sys.exit(main())
