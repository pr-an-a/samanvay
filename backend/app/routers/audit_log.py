from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_roles
from ..db import get_db
from ..models import AuditAction, AuditLog, Role


def local_midnight_utc(d: date) -> datetime:
    """Start of day `d` in the server's local time zone, as naive UTC (how timestamps are stored)."""
    return datetime.combine(d, time.min).astimezone().astimezone(timezone.utc).replace(tzinfo=None)


router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(require_roles(Role.ADMIN))])


@router.get("")
def audit_log(action: AuditAction | None = None, date_from: date | None = None, date_to: date | None = None,
              limit: int = 500, db: Session = Depends(get_db)) -> list[dict]:
    """Read-only. Every new complaint, confirm, reject and escalation, newest first."""
    q = select(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc())
    if action:
        q = q.where(AuditLog.action == action.value)
    if date_from:
        q = q.where(AuditLog.timestamp >= local_midnight_utc(date_from))
    if date_to:
        q = q.where(AuditLog.timestamp < local_midnight_utc(date_to + timedelta(days=1)))
    return [{
        "id": e.id, "timestamp": e.timestamp, "action": e.action, "actor_name": e.actor_name,
        "actor_role": e.actor_role, "actor_bureau": e.actor_bureau, "summary": e.summary,
        "case_refs": e.case_refs, "case_pk": e.case_pk, "link_id": e.link_id, "remarks": e.remarks,
    } for e in db.scalars(q.limit(limit))]
