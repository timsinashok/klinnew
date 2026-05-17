"""SQLAlchemy engine + session for the Neon-backed workflow store.

We persist coordinator-driven workflow state (submissions, ingests, edits,
dispositions, demographics) server-side so multiple browsers / devices
share the same view of a study. Studies + the protocol-uploaded splash
flag still live in localStorage — they're per-browser walkthrough state,
not collaborative.

No auth in v0; every write attributes to owner='demo'. A user_id column
exists on every row so Clerk slots in later without a migration.
"""
from __future__ import annotations

import logging
import os
from contextlib import contextmanager
from typing import Iterator

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()

# Neon hands out URLs like postgresql://user:pwd@ep-...neon.tech/dbname?sslmode=require.
# SQLAlchemy 2.0 / psycopg 3 wants postgresql+psycopg://.
def _normalize(url: str) -> str:
    if not url:
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url:
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


_engine = None
_SessionLocal = None


def _engine_or_none():
    """Lazily build the engine on first use so the API can still boot
    without a DATABASE_URL (the persistence endpoints just 503 in that
    case). Useful for local development without Neon configured."""
    global _engine, _SessionLocal
    if _engine is not None:
        return _engine
    url = _normalize(DATABASE_URL)
    if not url:
        return None
    _engine = create_engine(url, pool_pre_ping=True, pool_size=4, max_overflow=4)
    _SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)
    return _engine


def is_configured() -> bool:
    return _engine_or_none() is not None


@contextmanager
def session() -> Iterator[Session]:
    eng = _engine_or_none()
    if eng is None or _SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL not configured — workflow persistence is offline."
        )
    s: Session = _SessionLocal()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()


def init_schema() -> None:
    """Create tables if missing. Idempotent — safe to call on every boot."""
    from api.models import Base

    eng = _engine_or_none()
    if eng is None:
        logger.warning("DATABASE_URL not set; skipping schema init.")
        return
    Base.metadata.create_all(eng)
    logger.info("DB schema ready.")
