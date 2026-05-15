from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import benchmark, run

app = FastAPI(title="SDTM Inconsistency Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(run.router)
app.include_router(benchmark.router)


@app.get("/health")
def health():
    return {"ok": True}
