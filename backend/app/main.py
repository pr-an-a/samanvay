from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .db import Base, engine
from .routers import alerts, auth, cases, dashboard, institutions, links, meta, reports


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(title="Samanvay", description="SIH26264 prototype — synthetic data only.", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (meta.router, auth.router, cases.router, links.router, institutions.router, alerts.router,
          dashboard.router, reports.router):
    app.include_router(r)
