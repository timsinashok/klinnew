"""Coordinator workflow state — submissions, ingests, edits, dispositions,
demographics. All scoped by (study_id, subject_id) to match the
frontend's localStorage namespace.

The frontend reads localStorage synchronously for instant render and
fires write-through POSTs in the background; on bootstrap it pulls the
full study state from `GET /api/state/{study_id}` and hydrates
localStorage. So the DB is the source of truth, localStorage is the
cache.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from api.db import is_configured, session
from api.models import Demographics, Disposition, Edit, Ingest, Submission

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------


class VisitList(BaseModel):
    visits: list[str]


class EditItem(BaseModel):
    field: str
    value: str = ""


class EditsPayload(BaseModel):
    edits: list[EditItem]


class DispositionItem(BaseModel):
    finding_key: str
    state: str  # "resolved" | "flagged" | "acknowledged"
    rationale: str = ""


class DispositionsPayload(BaseModel):
    dispositions: list[DispositionItem]


class DemographicsPayload(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)


class SubjectState(BaseModel):
    subject_id: str
    submissions: list[str]
    ingests: list[str]
    edits: list[dict[str, Any]]
    dispositions: list[dict[str, Any]]
    demographics: dict[str, Any] | None


class StudyState(BaseModel):
    study_id: str
    subjects: list[SubjectState]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_db() -> None:
    if not is_configured():
        raise HTTPException(
            status_code=503,
            detail="DATABASE_URL not configured — persistence is offline.",
        )


# ---------------------------------------------------------------------------
# Whole-study bootstrap (called once on app load)
# ---------------------------------------------------------------------------


@router.get("/state/health")
def state_health():
    return {"configured": is_configured()}


@router.get("/state/{study_id}", response_model=StudyState)
def get_study_state(study_id: str) -> StudyState:
    _require_db()
    with session() as s:
        subs = s.scalars(
            select(Submission).where(Submission.study_id == study_id)
        ).all()
        ings = s.scalars(select(Ingest).where(Ingest.study_id == study_id)).all()
        eds = s.scalars(select(Edit).where(Edit.study_id == study_id)).all()
        disps = s.scalars(
            select(Disposition).where(Disposition.study_id == study_id)
        ).all()
        dms = s.scalars(
            select(Demographics).where(Demographics.study_id == study_id)
        ).all()

    by_subject: dict[str, dict[str, Any]] = {}
    for row in subs:
        by_subject.setdefault(row.subject_id, _empty_subject_dict(row.subject_id))
        by_subject[row.subject_id]["submissions"].append(row.visit)
    for row in ings:
        by_subject.setdefault(row.subject_id, _empty_subject_dict(row.subject_id))
        by_subject[row.subject_id]["ingests"].append(row.visit)
    for row in eds:
        by_subject.setdefault(row.subject_id, _empty_subject_dict(row.subject_id))
        by_subject[row.subject_id]["edits"].append(
            {"visit": row.visit, "field": row.field, "value": row.value}
        )
    for row in disps:
        by_subject.setdefault(row.subject_id, _empty_subject_dict(row.subject_id))
        by_subject[row.subject_id]["dispositions"].append(
            {
                "visit": row.visit,
                "finding_key": row.finding_key,
                "state": row.state,
                "rationale": row.rationale,
            }
        )
    for row in dms:
        by_subject.setdefault(row.subject_id, _empty_subject_dict(row.subject_id))
        by_subject[row.subject_id]["demographics"] = row.data

    return StudyState(
        study_id=study_id,
        subjects=[SubjectState(**v) for v in by_subject.values()],
    )


def _empty_subject_dict(subject_id: str) -> dict[str, Any]:
    return {
        "subject_id": subject_id,
        "submissions": [],
        "ingests": [],
        "edits": [],
        "dispositions": [],
        "demographics": None,
    }


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------


@router.put("/state/{study_id}/{subject_id}/submissions")
def put_submissions(study_id: str, subject_id: str, body: VisitList):
    _require_db()
    with session() as s:
        s.execute(
            delete(Submission)
            .where(Submission.study_id == study_id)
            .where(Submission.subject_id == subject_id)
        )
        for v in body.visits:
            s.add(Submission(study_id=study_id, subject_id=subject_id, visit=v))
    return {"ok": True, "count": len(body.visits)}


# ---------------------------------------------------------------------------
# Ingests
# ---------------------------------------------------------------------------


@router.put("/state/{study_id}/{subject_id}/ingests")
def put_ingests(study_id: str, subject_id: str, body: VisitList):
    _require_db()
    with session() as s:
        s.execute(
            delete(Ingest)
            .where(Ingest.study_id == study_id)
            .where(Ingest.subject_id == subject_id)
        )
        for v in body.visits:
            s.add(Ingest(study_id=study_id, subject_id=subject_id, visit=v))
    return {"ok": True, "count": len(body.visits)}


# ---------------------------------------------------------------------------
# Edits (field-level overrides)
# ---------------------------------------------------------------------------


@router.put("/state/{study_id}/{subject_id}/edits")
def put_edits(study_id: str, subject_id: str, body: EditsPayload):
    """Replaces the full edit set for this subject. Edits keys are
    `${visit}|${field}` in the frontend; here we split them apart."""
    _require_db()
    with session() as s:
        s.execute(
            delete(Edit)
            .where(Edit.study_id == study_id)
            .where(Edit.subject_id == subject_id)
        )
        for e in body.edits:
            visit, _, field = e.field.partition("|")
            s.add(
                Edit(
                    study_id=study_id,
                    subject_id=subject_id,
                    visit=visit,
                    field=field,
                    value=e.value,
                )
            )
    return {"ok": True, "count": len(body.edits)}


# ---------------------------------------------------------------------------
# Dispositions
# ---------------------------------------------------------------------------


@router.put("/state/{study_id}/{subject_id}/dispositions")
def put_dispositions(study_id: str, subject_id: str, body: DispositionsPayload):
    _require_db()
    with session() as s:
        s.execute(
            delete(Disposition)
            .where(Disposition.study_id == study_id)
            .where(Disposition.subject_id == subject_id)
        )
        for d in body.dispositions:
            visit, _, _ = d.finding_key.partition("|")
            # finding_key is rule_id|subject|visit|field — keep visit in own col.
            parts = d.finding_key.split("|")
            v = parts[2] if len(parts) >= 3 else ""
            s.add(
                Disposition(
                    study_id=study_id,
                    subject_id=subject_id,
                    visit=v,
                    finding_key=d.finding_key,
                    state=d.state,
                    rationale=d.rationale,
                )
            )
    return {"ok": True, "count": len(body.dispositions)}


# ---------------------------------------------------------------------------
# Demographics
# ---------------------------------------------------------------------------


@router.put("/state/{study_id}/{subject_id}/demographics")
def put_demographics(study_id: str, subject_id: str, body: DemographicsPayload):
    _require_db()
    with session() as s:
        existing = s.scalar(
            select(Demographics)
            .where(Demographics.study_id == study_id)
            .where(Demographics.subject_id == subject_id)
        )
        if existing:
            existing.data = body.data
        else:
            s.add(
                Demographics(
                    study_id=study_id, subject_id=subject_id, data=body.data
                )
            )
    return {"ok": True}


# ---------------------------------------------------------------------------
# Reset
# ---------------------------------------------------------------------------


@router.delete("/state/{study_id}")
def delete_study_state(study_id: str):
    _require_db()
    with session() as s:
        for model in (Submission, Ingest, Edit, Disposition, Demographics):
            s.execute(delete(model).where(model.study_id == study_id))
    return {"ok": True}
