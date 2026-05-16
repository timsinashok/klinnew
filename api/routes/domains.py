from fastapi import APIRouter, HTTPException

from api.service import get_domain

router = APIRouter()

ALLOWED = {"dm", "lb", "tu", "tr", "rs", "ecrf_dm", "ecrf_lb"}


@router.get("/domain/{name}")
def domain(name: str):
    if name not in ALLOWED:
        raise HTTPException(status_code=404, detail="unknown domain")
    return get_domain(name)
