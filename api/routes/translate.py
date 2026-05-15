from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Any

from api.service import translate_one

router = APIRouter()


class LineagePayload(BaseModel):
    form: str = ""
    field: str = ""
    source_doc: str = ""


class FindingPayload(BaseModel):
    rule_id: str
    severity: str
    subject_id: str
    visit: str | None = None
    domain: str = ""
    variable: str = ""
    lineage: LineagePayload = Field(default_factory=LineagePayload)
    evidence_rows: dict[str, list[dict[str, Any]]] = Field(default_factory=dict)
    raw_message: str = ""
    template_id: str = ""
    template_params: dict[str, Any] = Field(default_factory=dict)
    citation: str = ""


@router.post("/translate")
def translate(
    body: FindingPayload,
    enable_llm: bool = Query(default=True),
    model: str = Query(default="claude-haiku-4-5"),
):
    return translate_one(body.model_dump(), enable_llm=enable_llm, model=model)
