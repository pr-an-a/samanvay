"""New action on a case, with the pre-action check: clashes with linked cases at other bureaus are shown
before anything is saved. Nothing is blocked outright; the officer coordinates, sends anyway with a reason
(audited), or cancels."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import audit
from ..auth import OFFICER_ROLES, require_roles
from ..db import get_db
from ..clash import ACTIONS, BUREAU_NAMES, CONFIG
from ..models import AuditAction, CaseLink, User
from ..privacy import case_out
from ..schemas import ActionIn, CaseEventOut, CoordinateIn, NoteOut
from ..services_actions import can_act, record_action, run_check, validate
from .cases import get_case_or_404
from .notes import add_note

router = APIRouter(prefix="/cases/{case_pk}/actions", tags=["actions"])


@router.get("/kinds")
def kinds(case_pk: int, user: User = Depends(require_roles(*OFFICER_ROLES))) -> dict:
    """What the form offers, and the (demo) settings behind the check."""
    return {"actions": [{"kind": k, "label": v[0]} for k, v in ACTIONS.items()], "settings": CONFIG}


@router.post("/check")
def check(case_pk: int, body: ActionIn, db: Session = Depends(get_db), user: User = Depends(require_roles(*OFFICER_ROLES))):
    """Run the clash rules. Saves nothing."""
    case = get_case_or_404(db, case_pk)
    can_act(user, case)
    clashes, linked = run_check(db, case, body)
    return {"clashes": clashes, "checked": [{"case_id": l.case_id, "bureau": l.bureau} for l in linked]}


@router.post("", status_code=201)
def send(case_pk: int, body: ActionIn, db: Session = Depends(get_db), user: User = Depends(require_roles(*OFFICER_ROLES))):
    """Record the action. If the check finds clashes, a reason is required and is written to the audit log."""
    case = get_case_or_404(db, case_pk)
    can_act(user, case)
    clashes, linked = run_check(db, case, body)
    reason = (body.override_reason or "").strip()
    if clashes and len(reason) < 5:
        raise HTTPException(409, detail={"message": "Another bureau's case clashes with this action: coordinate, or give a reason to send anyway",
                                         "clashes": clashes})
    event = record_action(db, case, user, body, clashes, reason or None)
    db.commit()
    db.refresh(event)
    return {"case": case_out(case, user), "event": CaseEventOut.model_validate(event), "clashes": clashes,
            "checked": [{"case_id": l.case_id, "bureau": l.bureau} for l in linked]}


@router.post("/coordinate", response_model=NoteOut, status_code=201)
def coordinate(case_pk: int, body: CoordinateIn, db: Session = Depends(get_db),
               user: User = Depends(require_roles(*OFFICER_ROLES))):
    """The officer chose to coordinate instead of sending: post the note (which rings the other bureau's bell)
    and record that a clash was prevented. The action itself is not sent."""
    case = get_case_or_404(db, case_pk)
    can_act(user, case)
    link = db.get(CaseLink, body.link_id)
    if link is None or case.id not in (link.case_a_id, link.case_b_id):
        raise HTTPException(404, "That match does not involve this case")
    note = add_note(db, link, user, body.body)
    other = link.case_b if link.case_a_id == case.id else link.case_a
    label = ACTIONS.get(body.kind, (body.kind,))[0].lower()
    audit.record(db, user, AuditAction.clash_prevented,
                 f"Held a request to {label} on {case.case_id} and coordinated with the {BUREAU_NAMES[other.source_bureau]}",
                 f"{case.case_id}, {other.case_id}", case_pk=case.id, link_id=link.id, remarks=body.body)
    db.commit()
    db.refresh(note)
    return note
