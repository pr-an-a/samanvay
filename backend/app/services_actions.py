"""Database side of the pre-action check, and recording an action once it is sent."""

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from . import audit
from .clash import ACTIONS, BUREAU_NAMES, NEEDS_ASKING_FOR, Linked, Move, check_action, kind_of
from .models import AuditAction, Case, CaseEvent, CaseLink, CaseStatus, LinkStatus, Role, User
from .services import is_open, utc_naive

NEXT_ACTION = {"seek_reply": "Await institution reply", "request_documents": "Await documents",
               "show_cause": "Await institution reply to notice", "escalate": "Review by senior officer",
               "transfer": "Handled by receiving bureau", "close_case": None}


def now_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def moves_of(case: Case) -> list[Move]:
    return [Move(kind_of(e.action, e.kind), e.bureau, e.actor, e.action, e.asking_for, utc_naive(e.timestamp), case.case_id)
            for e in case.events]


def linked_cases(db: Session, case: Case) -> list[Linked]:
    """Cases at other bureaus that an officer has confirmed are the same college as `case`."""
    q = select(CaseLink).where(CaseLink.status == LinkStatus.confirmed.value,
                               or_(CaseLink.case_a_id == case.id, CaseLink.case_b_id == case.id))
    out = []
    for link in db.scalars(q):
        other = link.case_b if link.case_a_id == case.id else link.case_a
        if other.source_bureau != case.source_bureau:
            out.append(Linked(other.case_id, other.id, link.id, other.source_bureau, is_open(other), other.status, moves_of(other)))
    return out


def validate(case: Case, body) -> None:
    if case.status == CaseStatus.disposed.value:
        raise HTTPException(409, "This case is already closed")
    if body.kind not in ACTIONS:
        raise HTTPException(422, f"kind must be one of {sorted(ACTIONS)}")
    if body.kind in NEEDS_ASKING_FOR and len((body.asking_for or "").strip()) < 3:
        raise HTTPException(422, "Say what you are asking for")
    if body.kind == "transfer" and (body.transfer_to not in BUREAU_NAMES or body.transfer_to in ("ADMIN", case.source_bureau)):
        raise HTTPException(422, "Choose the bureau to transfer to")


def can_act(user: User, case: Case) -> None:
    if user.role != Role.ADMIN.value and user.bureau != case.source_bureau:
        raise HTTPException(403, "Only the bureau that holds this case (and the Administrator) can act on it")


def run_check(db: Session, case: Case, body) -> tuple[list[dict], list[Linked]]:
    validate(case, body)
    linked = linked_cases(db, case)
    mine_last = max((m.when for m in moves_of(case)), default=None)
    return check_action(body.kind, (body.asking_for or "").strip() or None, body.transfer_to, linked, mine_last, now_naive()), linked


def record_action(db: Session, case: Case, user: User, body, clashes: list[dict], override_reason: str | None) -> CaseEvent:
    label, text = ACTIONS[body.kind]
    asking = (body.asking_for or "").strip() or None
    event = CaseEvent(case_id=case.id, actor=user.name, bureau=user.bureau or "ADMIN", kind=body.kind, asking_for=asking,
                      action=text.format(bureau=body.transfer_to), remarks=(body.remarks or "").strip() or None)
    db.add(event)
    case.last_action = event.action
    case.next_action = NEXT_ACTION[body.kind]
    case.status = {"close_case": CaseStatus.disposed, "transfer": CaseStatus.transferred, "escalate": CaseStatus.escalated}.get(
        body.kind, CaseStatus.under_process if case.status == CaseStatus.pending.value else CaseStatus(case.status)).value
    audit.record(db, user, AuditAction.action_taken, f"{label} on {case.case_id}", case.case_id, case_pk=case.id,
                 remarks=asking or event.remarks)
    if clashes:
        kinds = ", ".join(sorted({c["type"].replace("_", " ") for c in clashes}))
        audit.record(db, user, AuditAction.action_overridden, f"Sent {label.lower()} on {case.case_id} despite a clash check ({kinds})",
                     case.case_id, case_pk=case.id, remarks=override_reason)
    return event
