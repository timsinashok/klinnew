from pathlib import Path

import pandas as pd

SDTM_FILES = {
    "tu": "tu.csv",
    "tr": "tr.csv",
    "rs": "rs.csv",
    "dm": "dm.csv",
    "lb": "lb.csv",
}
ECRF_FILES = {
    "ecrf_baseline": "ecrf_baseline.csv",
    "ecrf_followup": "ecrf_followup.csv",
    "ecrf_disease_response": "ecrf_disease_response.csv",
    "ecrf_dm": "ecrf_dm.csv",
    "ecrf_lb": "ecrf_lb.csv",
}
AUX_FILES = {
    "patient_history": "patient_history.csv",
    "source_evidence": "source_evidence.csv",
}
PROTOCOL_FILES = {
    "study_protocol": "study_protocol.csv",
    "protocol_extracted_checks": "protocol_extracted_checks.csv",
    "checks_catalog": "checks_catalog.csv",
    "source_documents": "source_documents.csv",
    "source_document_extraction_map": "source_document_extraction_map.csv",
    "source_documents_manifest": "source_documents_manifest.csv",
}

LINEAGE_COLS = ("source_ecrf_form", "source_field", "source_document_id")


def _read(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def load_data(data_dir: str | Path) -> dict[str, pd.DataFrame]:
    """Load every CSV used by the engine. Keeps lineage columns intact.

    Returns a dict keyed by short table name. Numeric columns (TR diameters,
    LB results, DM age) are coerced to floats for rule math; raw string
    versions are retained where they exist.
    """
    root = Path(data_dir)
    out: dict[str, pd.DataFrame] = {}

    for key, fname in {
        **SDTM_FILES,
        **ECRF_FILES,
        **AUX_FILES,
        **PROTOCOL_FILES,
    }.items():
        out[key] = _read(root / fname)

    tr = out["tr"]
    if "TRSTRESN" in tr.columns:
        tr["TRSTRESN"] = pd.to_numeric(tr["TRSTRESN"], errors="coerce")

    lb = out["lb"]
    if "LBSTRESN" in lb.columns:
        lb["LBSTRESN"] = pd.to_numeric(lb["LBSTRESN"], errors="coerce")

    dm = out["dm"]
    if "AGE" in dm.columns:
        dm["AGE_NUM"] = pd.to_numeric(dm["AGE"], errors="coerce")

    return out
