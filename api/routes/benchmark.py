import io

import pandas as pd
from fastapi import APIRouter, File, UploadFile

from api.service import DATA_DIR, run_findings_from_demo, run_findings_from_uploads
from benchmark import evaluate

router = APIRouter()


@router.post("/benchmark")
async def benchmark(
    tu: UploadFile = File(...),
    tr: UploadFile = File(...),
    rs: UploadFile = File(...),
    truth: UploadFile = File(...),
):
    findings = await run_findings_from_uploads(tu, tr, rs)
    truth_raw = await truth.read()
    truth_df = pd.read_csv(io.BytesIO(truth_raw))
    return {"findings": findings, "report": evaluate(findings, truth_df)}


@router.get("/benchmark/demo")
async def benchmark_demo():
    findings = run_findings_from_demo()
    truth_df = pd.read_csv(DATA_DIR / "ground_truth.csv")
    return {"findings": findings, "report": evaluate(findings, truth_df)}
