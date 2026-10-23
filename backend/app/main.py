import logging
import os
from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  (registers tables on Base.metadata)
from .db import Base, SessionLocal, engine
from .routers import alerts, audit_log, auth, cases, dashboard, demo, institutions, links, meta, notes, notifications, reports, sla, video, actions, inbox
from .sla import SETTINGS, demo_mode, run_sla_check


log = logging.getLogger("samanvay.sla")


def scheduled_sla_check() -> None:
    try:
        with SessionLocal() as db:
            log.info("SLA check: %s", run_sla_check(db))
    except Exception:  # never let a failed run kill the scheduler
        log.exception("SLA check failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    scheduler = None
    # Automatic checks only outside demo mode (in demo mode the presenter presses "Run check now").
    if os.environ.get("SAMANVAY_SCHEDULER", "1") != "0" and not demo_mode():  # tests switch it off too
        scheduler = BackgroundScheduler()
        scheduler.add_job(scheduled_sla_check, "interval", minutes=SETTINGS["check_interval_minutes"],
                          id="sla_check", max_instances=1, coalesce=True)
        scheduler.start()
    app.state.scheduler = scheduler
    yield
    if scheduler:
        scheduler.shutdown(wait=False)


app = FastAPI(title="Samanvay", description="SIH26264 prototype — synthetic data only.", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (meta.router, auth.router, cases.router, links.router, institutions.router, alerts.router,
          dashboard.router, reports.router, demo.router, notifications.router, sla.router, audit_log.router, notes.router, video.router, actions.router, inbox.router):
    app.include_router(r)
