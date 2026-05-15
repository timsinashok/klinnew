"""CLI: compare engine findings to a ground-truth CSV.

Maps each rule_id to the set of ERROR_IDs it is responsible for, then computes
recall (truth entries covered by at least one finding) and precision (findings
that match at least one truth entry).
"""

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

RULE_TO_ERRORS: dict[str, set[str]] = {
    "NONTARGET_LDIAM": {"ERR-001"},
    "PR_THRESHOLD": {"ERR-002", "ERR-003"},
    "BOR_CONSISTENCY": {"ERR-004"},
    "LN_MEASURABILITY": {"ERR-005"},
    "CR_NONTARGET": {"ERR-006"},
    "MAX_TARGETS": {"ERR-007"},
    "MAX_PER_ORGAN": {"ERR-007"},
    "NEWLPRES_VS_TU": {"ERR-008"},
    "NEW_AT_BASELINE": {"ERR-009"},
    "GHOST_TRLNKID": {"ERR-010"},
    "PD_THRESHOLD": {"ERR-011"},
}


def _match(finding: dict, truth_row: pd.Series) -> bool:
    if finding["usubjid"] != truth_row["USUBJID"]:
        return False
    if truth_row["ERROR_ID"] not in RULE_TO_ERRORS.get(finding["rule_id"], set()):
        return False
    fv = finding.get("visit")
    if fv is None:
        return True
    return fv == truth_row["VISIT_AFFECTED"]


def evaluate(findings: list[dict], truth: pd.DataFrame) -> dict:
    covered: dict[str, list[dict]] = {}
    for _, t in truth.iterrows():
        covered[t["ERROR_ID"]] = [f for f in findings if _match(f, t)]

    matched_findings = [
        f for f in findings if any(_match(f, t) for _, t in truth.iterrows())
    ]

    recall = sum(1 for v in covered.values() if v) / len(covered) if len(covered) else 0
    precision = len(matched_findings) / len(findings) if findings else 0

    return {
        "total_truth": len(covered),
        "covered_count": sum(1 for v in covered.values() if v),
        "missing": [e for e, v in covered.items() if not v],
        "total_findings": len(findings),
        "matched_findings": len(matched_findings),
        "false_positives": [
            {"rule_id": f["rule_id"], "usubjid": f["usubjid"], "visit": f.get("visit")}
            for f in findings
            if f not in matched_findings
        ],
        "recall": recall,
        "precision": precision,
        "per_error": {e: [f["rule_id"] for f in v] for e, v in covered.items()},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--findings", required=True, type=Path)
    parser.add_argument("--truth", required=True, type=Path)
    args = parser.parse_args(argv)

    findings = json.loads(args.findings.read_text())
    truth = pd.read_csv(args.truth)

    report = evaluate(findings, truth)

    print(f"Recall:    {report['covered_count']}/{report['total_truth']} "
          f"({report['recall'] * 100:.0f}%)")
    print(f"Precision: {report['matched_findings']}/{report['total_findings']} "
          f"({report['precision'] * 100:.0f}%)")
    if report["missing"]:
        print(f"Missing:   {', '.join(report['missing'])}")
    if report["false_positives"]:
        print("False positives:")
        for fp in report["false_positives"]:
            print(f"  {fp['rule_id']:18s} {fp['usubjid']}  {fp['visit']}")
    print("\nPer-error mapping:")
    for err, rules in sorted(report["per_error"].items()):
        rules_str = ", ".join(rules) if rules else "(missing)"
        print(f"  {err}: {rules_str}")

    return 0 if (report["recall"] == 1.0 and not report["false_positives"]) else 1


if __name__ == "__main__":
    sys.exit(main())
