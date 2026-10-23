"""The coordination inbox: what needs this officer's attention across bureaus. Derived on the fly from the data,
so a task disappears by itself once the thing it asks for is done."""

from datetime import date, datetime, timedelta, timezone
from difflib import SequenceMatcher

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


def name_alike(link: CaseLink) -> float:
    return SequenceMatcher(None, link.case_a.raw_institution_name.lower(), link.case_b.raw_institution_name.lower()).ratio()


def varied(links: list[CaseLink]) -> list[CaseLink]:
    """New matches, but not twenty look-alike rows: first the match whose two names differ most for each kind
    (with and without an AICTE ID), then a weaker match, then the newest."""
    picked: list[CaseLink] = []
    for pool in ([l for l in links if l.scores.get("match_tier") != "id"], [l for l in links if l.scores.get("match_tier") == "id"],
                 [l for l in links if l.scores["final_confidence"] < 1]):
        pool = [l for l in pool if l not in picked]
        if pool:
            picked.append(min(pool, key=lambda l: (name_alike(l), l.id)))
    return picked + [l for l in links if l not in picked]


def why(link: CaseLink) -> str:
    """One plain sentence about what matched, from the stored score breakdown."""
    s = link.scores
    if s.get("match_tier") == "id":
        return "Same AICTE ID on both cases, with the name written differently."
    bits = []
    if s.get("name_similarity") is not None:
        bits.append(f"names {round(s['name_similarity'] * 100)}% alike")
    elif s.get("initials_match") is not None:
        bits.append("the name matches the initials")
    if s.get("address_similarity") is not None:
        bits.append(f"address {round(s['address_similarity'] * 100)}% alike")
    if s.get("district_match"):
        bits.append("same district")
    return "No AICTE ID, matched on details: " + ", ".join(bits) + "."


@router.get("")
def inbox(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    admin = user.role == Role.ADMIN.value
    mine = lambda link: admin or user.bureau in (link.case_a.source_bureau, link.case_b.source_bureau)  # noqa: E731
    my_case = lambda link: next((c for c in (link.case_a, link.case_b) if c.source_bureau == user.bureau), link.case_a)  # noqa: E731
    other_name = lambda link: " and ".join(BUREAU_NAMES[b] for b in sorted({link.case_a.source_bureau, link.case_b.source_bureau} - {user.bureau}))  # noqa: E731
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = date.today()
    tasks: list[dict] = []

    def add(kind, priority, link, title, detail, when, case_pk=None, **extra):
        c = my_case(link)
        tasks.append({**extra, "key": f"{kind}-{link.id}", "kind": kind, "priority": priority, "link_id": link.id, "case_pk": case_pk or c.id,
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
    for link in varied(new)[:MAX_NEW_MATCHES]:
        names = [link.case_a.raw_institution_name, link.case_b.raw_institution_name]
        add("new_match", 3, link, "Possibly the same college: check it", why(link), link.created_at,
            names=names, tier=link.scores.get("match_tier", "entity"), strength=link.scores["final_confidence"])
    # New matches keep the varied order picked above; everything else is newest first.
    order = {t["key"]: i for i, t in enumerate(tasks)}
    tasks.sort(key=lambda t: (t["priority"], order[t["key"]] if t["kind"] == "new_match" else -utc_naive(t["when"]).timestamp()))
    counts = {k: sum(t["kind"] == k for t in tasks) for k in ("note_waiting", "clash_prevented", "overdue_linked", "new_match")}
    counts["new_match"] = len(new)  # the list is capped; the count is not
    return {"tasks": tasks, "counts": counts, "more_matches": max(0, len(new) - MAX_NEW_MATCHES)}
