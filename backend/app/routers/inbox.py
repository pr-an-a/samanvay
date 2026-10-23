"""The coordination inbox: what needs this officer's attention across bureaus. Derived on the fly from the data,
so a task disappears by itself once the thing it asks for is done."""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import AuditAction, AuditLog, CaseLink, CoordinationNote, LinkStatus, Role, User
from ..services import is_overdue, utc_naive
from ..summary import BUREAU_NAMES

router = APIRouter(prefix="/inbox", tags=["inbox"])
RECENT_DAYS = 14  # how long "clash prevented" stays in the inbox
MAX_NEW_MATCHES = 12


def college_of(link: CaseLink) -> str:
    registered = next((c.institution for c in (link.case_a, link.case_b) if c.institution), None)
    return registered.name if registered else max(link.case_a.raw_institution_name, link.case_b.raw_institution_name, key=len)


def institution_id(link: CaseLink) -> int | None:
    return next((c.institution_id for c in (link.case_a, link.case_b) if c.institution_id), None)


@router.get("")
def inbox(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    admin = user.role == Role.ADMIN.value
    mine = lambda link: admin or user.bureau in (link.case_a.source_bureau, link.case_b.source_bureau)  # noqa: E731
    my_case = lambda link: next((c for c in (link.case_a, link.case_b) if c.source_bureau == user.bureau), link.case_a)  # noqa: E731
    other_name = lambda link: " and ".join(BUREAU_NAMES[b] for b in sorted({link.case_a.source_bureau, link.case_b.source_bureau} - {user.bureau}))  # noqa: E731
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = date.today()
    tasks: list[dict] = []

    def add(kind, priority, link, title, detail, when, case_pk=None):
        c = my_case(link)
        tasks.append({"key": f"{kind}-{link.id}", "kind": kind, "priority": priority, "link_id": link.id, "case_pk": case_pk or c.id,
                      "institution_id": institution_id(link), "college": college_of(link),
                      "bureaus": [link.case_a.source_bureau, link.case_b.source_bureau], "title": title, "detail": detail,
                      "when": when})

    links = [l for l in db.scalars(select(CaseLink).order_by(CaseLink.created_at.desc(), CaseLink.id.desc())) if mine(l)]
    # Notes waiting for a reply: the latest note on a confirmed match came from someone else.
    for link in (l for l in links if l.status == LinkStatus.confirmed.value):
        last = db.scalar(select(CoordinationNote).where(CoordinationNote.link_id == link.id)
                         .order_by(CoordinationNote.timestamp.desc(), CoordinationNote.id.desc()))
        if last and (admin or last.bureau != user.bureau):
            who = "The Administrator" if last.bureau == "ADMIN" else f"The {BUREAU_NAMES[last.bureau]}"
            add("note_waiting", 0, link, f"{who} left a note: waiting for a reply", f"“{last.body}”", last.timestamp)
        late = [c for c in (link.case_a, link.case_b) if is_overdue(c, today) and (admin or c.source_bureau == user.bureau)]
        if late:
            c = late[0]
            add("overdue_linked", 2, link, f"{c.case_id} is overdue, and it is linked with another bureau's case",
                f"{other_name(link) or 'Other bureau'} has a case on the same college. Agree next steps before acting. Time limits are demo settings.",
                datetime.combine(c.expected_disposal_date, datetime.min.time()), case_pk=c.id)
    # Clashes prevented lately (an audit record), for the bureaus involved.
    since = now - timedelta(days=RECENT_DAYS)
    for e in db.scalars(select(AuditLog).where(AuditLog.action == AuditAction.clash_prevented.value, AuditLog.timestamp >= since)
                        .order_by(AuditLog.timestamp.desc())):
        link = db.get(CaseLink, e.link_id) if e.link_id else None
        if link and mine(link):
            add("clash_prevented", 1, link, "A clash was prevented", f"{e.actor_name}: {e.summary[0].lower()}{e.summary[1:]}.", e.timestamp)
    # New same-college matches that still need a check.
    new = [l for l in links if l.status == LinkStatus.suggested.value]
    for link in new[:MAX_NEW_MATCHES]:
        add("new_match", 3, link, "Possibly the same college: check it",
            f"{BUREAU_NAMES[link.case_a.source_bureau]} {link.case_a.case_id} and {BUREAU_NAMES[link.case_b.source_bureau]} {link.case_b.case_id}. "
            f"Match strength {round(link.scores['final_confidence'] * 100)}%.", link.created_at)
    tasks.sort(key=lambda t: (t["priority"], -utc_naive(t["when"]).timestamp()))
    counts = {k: sum(t["kind"] == k for t in tasks) for k in ("note_waiting", "clash_prevented", "overdue_linked", "new_match")}
    counts["new_match"] = len(new)  # the list is capped; the count is not
    return {"tasks": tasks, "counts": counts, "more_matches": max(0, len(new) - MAX_NEW_MATCHES)}
