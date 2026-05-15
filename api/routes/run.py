from fastapi import APIRouter, File, UploadFile

from api.service import run_findings_from_demo, run_findings_from_uploads

router = APIRouter()


@router.post("/run")
async def run(
    tu: UploadFile = File(...),
    tr: UploadFile = File(...),
    rs: UploadFile = File(...),
):
    findings = await run_findings_from_uploads(tu, tr, rs)
    return {"findings": findings}


@router.get("/demo")
async def demo():
    return {"findings": run_findings_from_demo()}
