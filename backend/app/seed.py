"""Reset the database and load demo users, demo SLA rules and the synthetic dataset.

Run from backend/: python -m app.seed [--no-shift]
Regenerate the source files first with: python ../data/generate.py

SLA values are demo settings, not official AICTE timelines.
"""

import argparse
from datetime import datetime, timezone
from pathlib import Path

from .db import Base, SessionLocal, engine
from .ingest.loader import DATA_DIR, load_all
from .matcher import run_all
from .models import SLARule, User

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


def run(shift_to_today: bool = True, data_dir: Path = DATA_DIR) -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add_all(User(name=n, role=r, bureau=b) for n, r, b in USERS)
        db.add_all(SLARule(bureau=b, category=c, days=d) for b in BUREAUS for c, d in SLA_DAYS.items())
        db.flush()
        counts = load_all(db, data_dir, shift_to_today=shift_to_today)
        links = run_all(db)
        # Seeded matches are existing backlog, not news: start every bell at zero. The SLA check is
        # left to the background job or the "Run check now" button, so the demo can show it flagging cases.
        for user in db.query(User):
            user.alerts_seen_at = datetime.now(timezone.utc)
        db.commit()
    print(f"Loaded {len(USERS)} users, {len(BUREAUS) * len(SLA_DAYS)} SLA rules, {counts}")
    print(f"Matcher suggested {links} overlap links (status=suggested, awaiting officer review)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-shift", action="store_true", help="keep generated dates instead of shifting to today")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR, help="directory with the generated source files")
    args = parser.parse_args()
    run(shift_to_today=not args.no_shift, data_dir=args.data_dir)
