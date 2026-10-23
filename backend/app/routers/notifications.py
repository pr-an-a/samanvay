from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Alert, AlertKind, LinkStatus, Role, User, utcnow
from ..services import utc_naive
from ..sla import last_check

router = APIRouter(prefix="/notifications", tags=["notifications"])


def current_alerts(db: Session, user: User) -> list[Alert]:
    """Alerts for the user's bureau (all bureaus for ADMIN) that still apply: the case is still in that
    SLA state, or the match still needs a check. Newest first."""
    q = select(Alert).order_by(Alert.created_at.desc(), Alert.id.desc())
    if user.role != Role.ADMIN.value:
        q = q.where(Alert.bureau == user.bureau)
    out = []
    for a in db.scalars(q):
        if a.kind == AlertKind.needs_check.value:
            live = a.link is not None and a.link.status == LinkStatus.suggested.value
        elif a.kind == AlertKind.note.value:
            live = True  # a note is news until the bell is opened; it does not expire
        else:
            live = a.case is not None and a.case.sla_state == a.kind
        if live:
            out.append(a)
    return out


def alert_case(alert: Alert):
    """The case this alert is about, from the alerted bureau's point of view."""
    if alert.case:
        return alert.case
    if alert.link:
        return alert.link.case_a if alert.link.case_a.source_bureau == alert.bureau else alert.link.case_b
    return None


def is_new(alert: Alert, user: User) -> bool:
    return user.alerts_seen_at is None or utc_naive(alert.created_at) > utc_naive(user.alerts_seen_at)


@router.get("")
def notifications(limit: int = 60, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    alerts = current_alerts(db, user)
    counts = {k.value: sum(a.kind == k.value for a in alerts) for k in AlertKind}
    items = []
    for a in alerts[:limit]:
        case = alert_case(a)
        items.append({
            "id": a.id, "kind": a.kind, "bureau": a.bureau, "message": a.message, "created_at": a.created_at,
            "new": is_new(a, user), "case_pk": case.id if case else None, "case_id": case.case_id if case else None,
            "link_id": a.link_id,
        })
    by_bureau: dict[str, dict] = {}
    for a in alerts:
        row = by_bureau.setdefault(a.bureau, {"overdue": 0, "due_soon": 0, "needs_check": 0, "note": 0, "new": 0})
        row[a.kind] += 1
        row["new"] += is_new(a, user)
    return {"unseen": sum(is_new(a, user) for a in alerts), "counts": counts, "by_bureau": by_bureau,
            "items": items, "last_check": last_check["at"]}


@router.post("/seen")
def mark_seen(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    user.alerts_seen_at = utcnow()
    db.commit()
    return {"unseen": 0}
