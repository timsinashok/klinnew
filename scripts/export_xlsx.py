"""Export the demo workbook sheets to CSV under data/.

Idempotent: re-run after the xlsx is refreshed by Klin's team and the
data/ folder catches up. Existing CSVs are overwritten.

Usage:
    .venv/bin/python scripts/export_xlsx.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "data" / "klin_oncology_demo_complete_protocol_dm_lb.xlsx"
SOURCE_PKG = ROOT / "klin_oncology_source_documents_full_package"

# sheet_name -> output csv basename (under data/)
SHEET_TO_CSV: dict[str, str] = {
    # Source data / eCRF
    "Source_Evidence": "source_evidence.csv",
    "eCRF_Baseline": "ecrf_baseline.csv",
    "eCRF_Followup": "ecrf_followup.csv",
    "eCRF_Disease_Response": "ecrf_disease_response.csv",
    "eCRF_DM": "ecrf_dm.csv",
    "eCRF_LB": "ecrf_lb.csv",
    "Patient_History": "patient_history.csv",
    # SDTM domains
    "TU": "tu.csv",
    "TR": "tr.csv",
    "RS": "rs.csv",
    "DM": "dm.csv",
    "LB": "lb.csv",
    # Protocol + checks
    "Study_Protocol": "study_protocol.csv",
    "Protocol_Extracted_Checks": "protocol_extracted_checks.csv",
    "Checks_Catalog": "checks_catalog.csv",
    "Source_Documents_Demo": "source_documents.csv",
    # Ground-truth issue logs
    "Final_Issue_Log": "final_issue_log.csv",
    "Expected_Issue_Log": "expected_issues.csv",
}

EXTRA_COPIES = {
    # Files shipped alongside the xlsx that we want under data/ for the API.
    SOURCE_PKG
    / "source_document_extraction_map.csv": ROOT
    / "data"
    / "source_document_extraction_map.csv",
    SOURCE_PKG
    / "source_documents_manifest.csv": ROOT
    / "data"
    / "source_documents_manifest.csv",
}


def main() -> int:
    if not XLSX.exists():
        raise SystemExit(f"missing xlsx: {XLSX}")

    print(f"reading {XLSX}")
    book = pd.read_excel(XLSX, sheet_name=None)
    out = ROOT / "data"
    out.mkdir(exist_ok=True)

    written = 0
    for sheet, fname in SHEET_TO_CSV.items():
        if sheet not in book:
            print(f"  skip (no sheet): {sheet}")
            continue
        df = book[sheet]
        path = out / fname
        df.to_csv(path, index=False)
        print(f"  wrote {fname:42s} ({len(df)} rows)")
        written += 1

    for src, dst in EXTRA_COPIES.items():
        if src.exists():
            shutil.copyfile(src, dst)
            print(f"  copied {dst.name}")
        else:
            print(f"  skip (missing): {src}")

    print(f"done · {written} sheets written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
