from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..auth import OFFICER_ROLES, get_current_user, require_roles
from ..db import get_db
from ..models import AuditAction, Case, CaseEvent, CaseStatus, Role, SLARule, User
from ..privacy import case_out
from ..sla import NOTE, SETTINGS, days_overdue, last_check, run_sla_check

router = APIRouter(tags=["sla"])


class EscalateIn(BaseModel):
    remarks: str | None = None


@router.get("/sla/settings", dependencies=[Depends(get_current_user)])
def sla_settings(db: Session = Depends(get_db)) -> dict:
    rules = db.scalars(select(SLARule).order_by(SLARule.bureau, SLARule.category))
    return {
        "due_soon_days": SETTINGS["due_soon_days"],
        "escalate_after_days_overdue": SETTINGS["escalate_after_days_overdue"],
        "check_interval_minutes": SETTINGS["check_interval_minutes"],
        "rules": [{"bureau": r.bureau, "category": r.category, "days": r.days} for r in rules],
        "last_check": last_check["at"], "last_result": last_check["result"],
        "note": NOTE,
    }


@router.post("/sla/check", dependencies=[Depends(require_roles(*OFFICER_ROLES))])
def check_now(db: Session = Depends(get_db)) -> dict:
    """The same check the background job runs every few minutes, on demand (for the demo)."""
    return {**run_sla_check(db), "checked_at": last_check["at"], "note": NOTE}


@router.get("/sla/escalations")
def escalation_queue(min_days_overdue: int | None = None, db: Session = Depends(get_db),
                     user: User = Depends(require_roles(Role.ADMIN))) -> dict:
    """Open, not-yet-escalated cases overdue by more than `min_days_overdue` (default from settings)."""
    threshold = SETTINGS["escalate_after_days_overdue"] if min_days_overdue is None else min_days_overdue
    today = date.today()
    cases = [c for c in db.scalars(select(Case).where(Case.status.not_in([CaseStatus.disposed.value, CaseStatus.escalated.value])))
             if days_overdue(c, today) > threshold]
    cases.sort(key=lambda c: -days_overdue(c, today))
    return {
        "min_days_overdue": threshold,
        "note": NOTE,
        "cases": [{**case_out(c, user).model_dump(), "days_overdue": days_overdue(c, today)} for c in cases],
    }


@router.post("/cases/{case_pk}/escalate")
def escalate(case_pk: int, body: EscalateIn | None = None, db: Session = Depends(get_db),
             user: User = Depends(require_roles(Role.ADMIN))) -> dict:
    case = db.get(Case, case_pk)
    if case is None:
        raise HTTPException(404, "Case not found")
    if case.status in (CaseStatus.disposed.value, CaseStatus.escalated.value):
        raise HTTPException(409, f"Case is already {case.status}")
    remarks = body.remarks if body else None
    late = days_overdue(case, date.today())
    action = f"Escalated to senior officer (overdue by {late} days)" if late else "Escalated to senior officer"
    case.status = CaseStatus.escalated.value
    case.last_action, case.next_action = action, "Decision by senior officer"
    db.add(CaseEvent(case_id=case.id, actor=user.name, bureau=user.bureau or "ADMIN", action=action, remarks=remarks))
    audit.record(db, user, AuditAction.case_escalated, f"Escalated case {case.case_id} ({case.raw_institution_name})",
                 case.case_id, case_pk=case.id, remarks=remarks)
    db.commit()
    return {"case": case_out(case, user).model_dump(), "days_overdue": late}
