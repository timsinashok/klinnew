from fastapi import APIRouter

from api.service import compute_stats

router = APIRouter()


@router.get("/stats")
def stats():
    return compute_stats()
