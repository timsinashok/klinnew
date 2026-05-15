from fastapi import APIRouter, Query

from api.service import run_engine

router = APIRouter()


@router.post("/run")
@router.get("/run")
def run(
    enable_llm: bool = Query(default=True),
    model: str = Query(default="claude-haiku-4-5"),
):
    findings = run_engine(enable_llm=enable_llm, model=model)
    return {
        "count": len(findings),
        "findings": findings,
        "enable_llm": enable_llm,
        "model": model,
    }
