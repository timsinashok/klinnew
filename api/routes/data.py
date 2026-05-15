from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse

from api.service import ALLOWED_FILES, DATA_DIR

router = APIRouter()


@router.get("/data/{name}")
def get_data(name: str):
    if name not in ALLOWED_FILES:
        raise HTTPException(status_code=404, detail="file not found")
    path = DATA_DIR / name
    if not path.exists():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(path, media_type="text/csv", filename=name)


@router.get("/data")
def list_data():
    return JSONResponse(
        {"files": sorted(f for f in ALLOWED_FILES if (DATA_DIR / f).exists())}
    )
