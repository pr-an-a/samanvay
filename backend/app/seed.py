"""Reset the database and load demo users, demo SLA rules and the synthetic dataset.

Run from backend/: python -m app.seed [--no-shift]
Regenerate the source files first with: python ../data/generate.py

SLA values are demo settings, not official AICTE timelines.
"""

import argparse
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import DatabaseError

from .db import Base, SessionLocal, engine
from .ingest.loader import DATA_DIR, load_all
from .matcher import run_all
from .models import AuthToken, SLARule, User

# Demo SLA days per category, applied to every bureau (edit per bureau in the sla_rules table).
SLA_DAYS = {"fee_refund": 30, "faculty_shortage": 45, "infrastructure": 60, "admission_irregularity": 30,
            "certificate_withholding": 21, "ragging_admin": 15, "other": 45}
BUREAUS = ["RB", "PGRC", "REGIONAL"]

USERS = [
    ("Demo Regulation Bureau Officer", "RB_OFFICER", "RB"),
    ("Demo Grievance Cell Officer", "PGRC_OFFICER", "PGRC"),
    ("Demo Regional Office Officer", "REGIONAL", "REGIONAL"),
    ("Demo Admin", "ADMIN", None),
]


def saved_sessions() -> list[tuple[str, str, str | None]]:
    """Current sign-ins as (token, role, bureau), so they can be carried over a reseed."""
    try:
        with SessionLocal() as db:
            rows = db.execute(select(AuthToken.token, User.role, User.bureau).join(User, AuthToken.user_id == User.id))
            return [tuple(r) for r in rows]
    except DatabaseError:  # first run: no tables yet
        return []


def run(shift_to_today: bool = True, data_dir: Path = DATA_DIR) -> dict:
    """Rebuild the demo database. Everyone who is signed in stays signed in (as the same demo role)."""
    sessions = saved_sessions()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        users = [User(name=n, role=r, bureau=b) for n, r, b in USERS]
        db.add_all(users)
        db.add_all(SLARule(bureau=b, category=c, days=d) for b in BUREAUS for c, d in SLA_DAYS.items())
        db.flush()
        counts = load_all(db, data_dir, shift_to_today=shift_to_today)
        by_role = {(u.role, u.bureau): u.id for u in users}
        db.add_all(AuthToken(token=t, user_id=by_role[(role, bureau)]) for t, role, bureau in sessions
                   if (role, bureau) in by_role)
        links = run_all(db)
        # Seeded matches are existing backlog, not news: start every bell at zero. The SLA check is
        # left to the background job or the "Run check now" button, so the demo can show it flagging cases.
        for user in db.query(User):
            user.alerts_seen_at = datetime.now(timezone.utc)
        db.commit()
    return {"users": len(USERS), "sla_rules": len(BUREAUS) * len(SLA_DAYS), **counts,
            "suggested_links": links, "sessions_kept": len(sessions)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-shift", action="store_true", help="keep generated dates instead of shifting to today")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR, help="directory with the generated source files")
    args = parser.parse_args()
    summary = run(shift_to_today=not args.no_shift, data_dir=args.data_dir)
    print(f"Loaded {summary}")
    print(f"Matcher suggested {summary['suggested_links']} overlap links (status=suggested, awaiting officer review)")
