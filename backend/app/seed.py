"""Reset the database and load demo users, demo SLA rules and the synthetic dataset.

Run from backend/: python -m app.seed [--no-shift]
Regenerate the source files first with: python ../data/generate.py

SLA values are demo settings, not official AICTE timelines.
"""

import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import DatabaseError

from .db import Base, SessionLocal, engine
from .ingest.loader import DATA_DIR, load_all
from .matcher import run_all
from .models import AuditAction, AuditLog, AuthToken, Case, CaseEvent, CaseLink, LinkStatus, SLARule, User

# Demo SLA days per category, applied to every bureau (edit per bureau in the sla_rules table).
SLA_DAYS = {"fee_refund": 30, "faculty_shortage": 45, "infrastructure": 60, "admission_irregularity": 30,
            "certificate_withholding": 21, "ragging_admin": 15, "other": 45}
BUREAUS = ["RB", "PGRC", "REGIONAL"]

# Fictional demo users (first names drive the "Good evening, Priya" greeting).
USERS = [
    ("Arjun Mehta", "RB_OFFICER", "RB"),
    ("Priya Nair", "PGRC_OFFICER", "PGRC"),
    ("Kavya Rao", "REGIONAL", "REGIONAL"),
    ("Ravi Sharma", "ADMIN", None),
]


def saved_sessions() -> list[tuple[str, str, str | None]]:
    """Current sign-ins as (token, role, bureau), so they can be carried over a reseed."""
    try:
        with SessionLocal() as db:
            rows = db.execute(select(AuthToken.token, User.role, User.bureau).join(User, AuthToken.user_id == User.id))
            return [tuple(r) for r in rows]
    except DatabaseError:  # first run: no tables yet
        return []


# The demo college for the pre-action check: the Regulation Bureau and the Grievance Cell both have a case on it.
DEMO_RB_CASE, DEMO_PGRC_CASE = "RB/2026/0138", "PG-2026-00169"


def demo_story_prepare(db) -> None:
    """The demo college as the video tells it (run BEFORE the matcher, so the match is real): a student, Ananya,
    complains to the Grievance Cell that her college withholds her original certificates, writing its name with
    a spelling slip and no AICTE ID; the Regulation Bureau already has a case on the same college."""
    pg = db.query(Case).filter_by(case_id=DEMO_PGRC_CASE).one()
    rb = db.query(Case).filter_by(case_id=DEMO_RB_CASE).one()
    pg.raw_institution_name = "Shri Megha Saraswathi Inst. of Tech."
    pg.complainant_name = "Ananya Rao"  # fictional
    pg.category = rb.category = "certificate_withholding"
    pg.description = "Original certificates withheld after course completion; the college has given no written reason."
    rb.description = "Complaint that original certificates of passed-out students are being held back; scrutiny of the college's certificate-release practice."
    db.flush()


def demo_story(db, users: list[User]) -> None:
    """Back-story for the demo college, written as history so the pre-action check triggers reliably:
    the Grievance Cell officer already confirmed the two cases are the same college 10 days ago, and the
    Regulation Bureau asked the college for its certificate register 6 days ago. (Demo data: the confirmation
    is attributed to the demo Grievance Cell officer. The matcher itself never confirms anything.)"""
    rb = db.query(Case).filter_by(case_id=DEMO_RB_CASE).one()
    pg = db.query(Case).filter_by(case_id=DEMO_PGRC_CASE).one()
    officer = next(u for u in users if u.role == "PGRC_OFFICER")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    a, b = sorted((rb, pg), key=lambda c: c.id)
    link = db.query(CaseLink).filter_by(case_a_id=a.id, case_b_id=b.id).one()
    link.status, link.reviewed_by, link.reviewed_at = LinkStatus.confirmed.value, officer.id, now - timedelta(days=10)
    remark = "Same college. Let us coordinate on the certificate complaint."
    for case, other in ((rb, pg), (pg, rb)):
        db.add(CaseEvent(case_id=case.id, actor=officer.name, bureau="PGRC", action=f"Overlap with {other.case_id} confirmed",
                         remarks=remark, timestamp=now - timedelta(days=10)))
    pair = f"{a.case_id}, {b.case_id}"
    db.add(AuditLog(timestamp=now - timedelta(days=10), action=AuditAction.link_confirmed.value, actor_name=officer.name,
                    actor_role=officer.role, actor_bureau="PGRC", summary=f"Confirmed {pair} as the same college",
                    case_refs=pair, link_id=link.id, remarks=remark))
    asked = "Register of original certificates held and fee receipts"
    db.add(CaseEvent(case_id=rb.id, actor="R. Bhatt", bureau="RB", action="Documents requested from institution",
                     kind="request_documents", asking_for=asked, timestamp=now - timedelta(days=6)))
    rb.last_action, rb.next_action = "Documents requested from institution", "Await documents"


def run(shift_to_today: bool = True, data_dir: Path = DATA_DIR, with_demo_story: bool = True) -> dict:
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
        if with_demo_story:
            demo_story_prepare(db)
        links = run_all(db)
        if with_demo_story:
            demo_story(db, users)
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
    parser.add_argument("--bare", action="store_true", help="skip the demo college's back-story (used by the evaluation)")
    parser.add_argument("--data-dir", type=Path, default=DATA_DIR, help="directory with the generated source files")
    args = parser.parse_args()
    summary = run(shift_to_today=not args.no_shift, data_dir=args.data_dir, with_demo_story=not args.bare)
    print(f"Loaded {summary}")
    print(f"Matcher suggested {summary['suggested_links']} overlap links (status=suggested, awaiting officer review)")
