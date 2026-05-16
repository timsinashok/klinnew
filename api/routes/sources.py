from fastapi import APIRouter, HTTPException

from api.service import compute_sources

router = APIRouter()


@router.get("/sources")
def sources():
    return compute_sources()


@router.get("/sources/{source_id}")
def source(source_id: str):
    out = compute_sources()
    for d in out["documents"]:
        if d["source_document_id"] == source_id:
            return d
    raise HTTPException(status_code=404, detail="source not found")
