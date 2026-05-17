"""SQLAlchemy models for the per-study workflow state.

All tables are scoped by (study_id, subject_id) — the same composite key
that namespaces localStorage in the frontend. Demo studies use the same
schema; their study_id is just the demo id ("KLIN-ONC-DEMO-001",
"KLIN-ONC-DEMO-002"). user_id is a stub for now (always 'demo'); when
Clerk lands it'll carry the real subject claim from the JWT.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(128), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    visit: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, default="demo")
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "study_id", "subject_id", "visit", name="uq_submission_study_subject_visit"
        ),
        Index("ix_submission_study_subject", "study_id", "subject_id"),
    )


class Ingest(Base):
    __tablename__ = "ingests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(128), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    visit: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, default="demo")
    ingested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "study_id", "subject_id", "visit", name="uq_ingest_study_subject_visit"
        ),
        Index("ix_ingest_study_subject", "study_id", "subject_id"),
    )


class Edit(Base):
    """Field-level overrides the coordinator makes to the pre-filled eCRF."""

    __tablename__ = "edits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(128), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    visit: Mapped[str] = mapped_column(String(64), nullable=False)
    field: Mapped[str] = mapped_column(String(256), nullable=False)
    value: Mapped[str] = mapped_column(String(2048), nullable=False, default="")
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, default="demo")
    edited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "study_id",
            "subject_id",
            "visit",
            "field",
            name="uq_edit_study_subject_visit_field",
        ),
        Index("ix_edit_study_subject", "study_id", "subject_id"),
    )


class Disposition(Base):
    """Coordinator's action on a finding: resolved / flagged / acknowledged."""

    __tablename__ = "dispositions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(128), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    visit: Mapped[str] = mapped_column(String(64), nullable=False)
    finding_key: Mapped[str] = mapped_column(String(256), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False)  # resolved/flagged/acknowledged
    rationale: Mapped[str] = mapped_column(String(4096), nullable=False, default="")
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, default="demo")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "study_id",
            "subject_id",
            "visit",
            "finding_key",
            name="uq_disposition_finding",
        ),
        Index("ix_disposition_study_subject", "study_id", "subject_id"),
    )


class Demographics(Base):
    """Subject-level demographics + eligibility (one row per study·subject)."""

    __tablename__ = "demographics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    study_id: Mapped[str] = mapped_column(String(128), nullable=False)
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    data: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, default="demo")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "study_id", "subject_id", name="uq_demographics_study_subject"
        ),
    )
