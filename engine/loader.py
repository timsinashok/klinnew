from pathlib import Path

import pandas as pd

SDTM_FILES = {"tu": "tu.csv", "tr": "tr.csv", "rs": "rs.csv"}
ECRF_FILES = {
    "ecrf_baseline": "ecrf_baseline.csv",
    "ecrf_followup": "ecrf_followup.csv",
    "ecrf_disease_response": "ecrf_disease_response.csv",
}
AUX_FILES = {
    "patient_history": "patient_history.csv",
    "source_evidence": "source_evidence.csv",
}

LINEAGE_COLS = ("source_ecrf_form", "source_field", "source_document_id")


def _read(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, dtype=str, keep_default_na=False)


def load_data(data_dir: str | Path) -> dict[str, pd.DataFrame]:
    """Load every CSV used by the engine. Keeps lineage columns intact.

    Returns a dict keyed by short table name. SDTM tables get TRSTRESN coerced
    to numeric. Production parses additional fields lazily inside each rule.
    """
    root = Path(data_dir)
    out: dict[str, pd.DataFrame] = {}

    for key, fname in {**SDTM_FILES, **ECRF_FILES, **AUX_FILES}.items():
        out[key] = _read(root / fname)

    tr = out["tr"]
    if "TRSTRESN" in tr.columns:
        tr["TRSTRESN"] = pd.to_numeric(tr["TRSTRESN"], errors="coerce")

    return out
