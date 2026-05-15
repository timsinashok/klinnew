from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import data, run, stats, translate

app = FastAPI(title="Klin Oncology Consistency Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(run.router, prefix="/api")
app.include_router(data.router, prefix="/api")
app.include_router(translate.router, prefix="/api")
app.include_router(stats.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}
