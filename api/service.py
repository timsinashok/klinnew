"""Engine-facing service helpers shared by API routes."""

import io
import math
from pathlib import Path

import pandas as pd

from engine import rules  # noqa: F401  (registers rules)
from engine.loader import load_csvs
from engine.registry import run_all

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _json_safe(obj):
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    if isinstance(obj, float) and math.isnan(obj):
        return None
    return obj


async def _to_df(upload) -> pd.DataFrame:
    raw = await upload.read()
    return pd.read_csv(io.BytesIO(raw), dtype=str, keep_default_na=False)


def _prepare(tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame):
    for df in (tu, tr, rs):
        if "VISITNUM" in df.columns:
            df["VISITNUM"] = pd.to_numeric(df["VISITNUM"], errors="coerce")
    tr["TRSTRESN"] = pd.to_numeric(tr["TRSTRESC"], errors="coerce")
    return tu, tr, rs


async def run_findings_from_uploads(tu_file, tr_file, rs_file) -> list[dict]:
    tu = await _to_df(tu_file)
    tr = await _to_df(tr_file)
    rs = await _to_df(rs_file)
    tu, tr, rs = _prepare(tu, tr, rs)
    findings = run_all(tu, tr, rs)
    return [_json_safe(f.to_dict()) for f in findings]


def run_findings_from_demo() -> list[dict]:
    tu, tr, rs = load_csvs(DATA_DIR / "tu.csv", DATA_DIR / "tr.csv", DATA_DIR / "rs.csv")
    findings = run_all(tu, tr, rs)
    return [_json_safe(f.to_dict()) for f in findings]
