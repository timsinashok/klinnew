from fastapi import APIRouter

from api.service import compute_protocol

router = APIRouter()


@router.get("/protocol")
def protocol():
    return compute_protocol()
