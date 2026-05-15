from pathlib import Path

import pandas as pd


def _read(path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    return df


def load_csvs(
    tu_path: str | Path, tr_path: str | Path, rs_path: str | Path
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    tu = _read(tu_path)
    tr = _read(tr_path)
    rs = _read(rs_path)

    for df in (tu, tr, rs):
        if "VISITNUM" in df.columns:
            df["VISITNUM"] = pd.to_numeric(df["VISITNUM"], errors="coerce")

    if "TRSTRESN" not in tr.columns:
        tr["TRSTRESN"] = pd.to_numeric(tr["TRSTRESC"], errors="coerce")
    else:
        tr["TRSTRESN"] = pd.to_numeric(tr["TRSTRESN"], errors="coerce")

    return tu, tr, rs
