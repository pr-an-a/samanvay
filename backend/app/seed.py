"""Reset the database and load demo users, demo SLA rules and the synthetic dataset.

Run from backend/: python -m app.seed [--no-shift]
Regenerate the source files first with: python ../data/generate.py

SLA days are configurable demo values, not official AICTE rules.
"""

import argparse

from .db import Base, SessionLocal, engine
from .ingest.loader import load_all
from .matcher import run_all
from .models import SLARule, User

# Demo SLA days per category, applied to every bureau (edit per bureau in the sla_rules table).
SLA_DAYS = {"fee_refund": 30, "faculty_shortage": 45, "infrastructure": 60, "admission_irregularity": 30,
            "certificate_withholding": 21, "ragging_admin": 15, "other": 45}
BUREAUS = ["RB", "PGRC", "REGIONAL"]

USERS = [
    ("Demo RB Officer", "RB_OFFICER", "RB"),
    ("Demo PGRC Officer", "PGRC_OFFICER", "PGRC"),
    ("Demo Regional Officer", "REGIONAL", "REGIONAL"),
    ("Demo Admin", "ADMIN", None),
]


def run(shift_to_today: bool = True) -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        db.add_all(User(name=n, role=r, bureau=b) for n, r, b in USERS)
        db.add_all(SLARule(bureau=b, category=c, days=d) for b in BUREAUS for c, d in SLA_DAYS.items())
        db.flush()
        counts = load_all(db, shift_to_today=shift_to_today)
        links = run_all(db)
    print(f"Loaded {len(USERS)} users, {len(BUREAUS) * len(SLA_DAYS)} SLA rules, {counts}")
    print(f"Matcher suggested {links} overlap links (status=suggested, awaiting officer review)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--no-shift", action="store_true", help="keep generated dates instead of shifting to today")
    run(shift_to_today=not parser.parse_args().no_shift)
