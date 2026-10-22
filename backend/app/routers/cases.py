from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import OFFICER_ROLES, get_current_user, require_roles
from ..db import get_db
from ..matcher import match_case
from ..models import Case, CaseEvent, User
from ..privacy import case_out, link_out
from ..schemas import CaseCreate, CaseCreateOut, CaseEventIn, CaseEventOut, CaseOut
from ..services import OVERLAP_ALERT_TITLE, CaseFilters, case_query, create_case, is_open

router = APIRouter(prefix="/cases", tags=["cases"])


def get_case_or_404(db: Session, case_pk: int) -> Case:
    case = db.get(Case, case_pk)
    if case is None:
        raise HTTPException(404, "Case not found")
    return case


@router.get("", response_model=list[CaseOut])
def list_cases(f: CaseFilters = Depends(), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [case_out(c, user) for c in db.scalars(case_query(f))]


@router.post("", response_model=CaseCreateOut, status_code=201)
def new_case(body: CaseCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*OFFICER_ROLES))):
    """Register a complaint and immediately check it for overlaps with other bureaus' cases."""
    case = create_case(db, body, user)
    links = match_case(db, case)
    # Most useful first: counterparts that are still open, then by confidence.
    links.sort(key=lambda l: (not is_open(l.case_b if l.case_a_id == case.id else l.case_a),
                              -l.scores["final_confidence"]))
    return CaseCreateOut(case=case_out(case, user), alert_title=OVERLAP_ALERT_TITLE if links else None,
                         overlap_alerts=[link_out(l, user) for l in links])


@router.get("/{case_pk}", response_model=CaseOut)
def get_case(case_pk: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return case_out(get_case_or_404(db, case_pk), user)


@router.get("/{case_pk}/events", response_model=list[CaseEventOut], dependencies=[Depends(get_current_user)])
def list_events(case_pk: int, db: Session = Depends(get_db)):
    return get_case_or_404(db, case_pk).events


@router.post("/{case_pk}/events", response_model=CaseEventOut, status_code=201)
def add_event(
    case_pk: int,
    body: CaseEventIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*OFFICER_ROLES)),
):
    case = get_case_or_404(db, case_pk)
    event = CaseEvent(
        case_id=case.id,
        actor=user.name,
        bureau=user.bureau or "ADMIN",
        action=body.action,
        remarks=body.remarks,
    )
    case.last_action = body.action
    db.add(event)
    db.commit()
    db.refresh(event)
    return event
