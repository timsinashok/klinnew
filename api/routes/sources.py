import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from api.service import compute_sources

router = APIRouter()

PDF_ROOT = Path(__file__).resolve().parent.parent.parent / "demo_file_uploads" / "subjects"


def _resolve_pdf(source_id: str) -> Path | None:
    """Find the on-disk PDF path for a given source_document_id via the manifest."""
    for d in compute_sources()["documents"]:
        if d["source_document_id"] != source_id:
            continue
        subject = d.get("subject_id")
        visit = d.get("visit")
        # Manifest file_name lives in the mappings rows or we derive from id.
        # The naming convention is stable: <PREFIX>-<SUBJ>-<TOKEN>__<Type>.pdf
        # We just glob the subject·visit directory.
        if not subject or not visit:
            return None
        folder = PDF_ROOT / subject / visit
        if not folder.exists():
            return None
        matches = list(folder.glob(f"{source_id}__*.pdf"))
        if matches:
            return matches[0]
    return None


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


@router.get("/sources/{source_id}/pdf")
def source_pdf(source_id: str):
    pdf = _resolve_pdf(source_id)
    if not pdf or not pdf.exists():
        raise HTTPException(status_code=404, detail="pdf not found")
    return FileResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{pdf.name}"'},
    )


@router.get("/sources/{source_id}/annotations")
def source_annotations(source_id: str):
    pdf = _resolve_pdf(source_id)
    if not pdf:
        raise HTTPException(status_code=404, detail="source not found")
    ann = pdf.with_name(pdf.name + ".annotations.json")
    if not ann.exists():
        # Graceful empty payload for unannotated doc types (PATH / MDNOTE).
        return {
            "pdf": pdf.name,
            "doc_id": source_id,
            "pages": [],
            "annotations": [],
        }
    return json.loads(ann.read_text(encoding="utf-8"))
