import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import data, run, stats, translate

app = FastAPI(title="Klin Oncology Consistency Engine")

# Local dev origins always allowed; production Vercel deploys are matched via
# the regex. Set FRONTEND_ORIGIN in the Render env to lock to a single domain
# once the production URL is stable.
LOCAL_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
extra = os.environ.get("FRONTEND_ORIGIN", "").strip()
if extra:
    LOCAL_ORIGINS.append(extra)

app.add_middleware(
    CORSMiddleware,
    allow_origins=LOCAL_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app$",
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
