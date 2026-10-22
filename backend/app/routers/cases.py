from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import OFFICER_ROLES, get_current_user, require_roles
from ..db import get_db
from ..models import Case, CaseEvent, CaseStatus, User
from ..schemas import CaseEventIn, CaseEventOut, CaseOut

router = APIRouter(prefix="/cases", tags=["cases"], dependencies=[Depends(get_current_user)])


def get_case_or_404(db: Session, case_pk: int) -> Case:
    case = db.get(Case, case_pk)
    if case is None:
        raise HTTPException(404, "Case not found")
    return case


@router.get("", response_model=list[CaseOut])
def list_cases(
    bureau: str | None = None,
    status: CaseStatus | None = None,
    region: str | None = None,
    institution_id: int | None = None,
    db: Session = Depends(get_db),
):
    q = select(Case).order_by(Case.received_date.desc())
    if bureau:
        q = q.where(Case.source_bureau == bureau)
    if status:
        q = q.where(Case.status == status.value)
    if region:
        q = q.where(Case.region == region)
    if institution_id is not None:
        q = q.where(Case.institution_id == institution_id)
    return db.scalars(q).all()


@router.get("/{case_pk}", response_model=CaseOut)
def get_case(case_pk: int, db: Session = Depends(get_db)):
    return get_case_or_404(db, case_pk)


@router.get("/{case_pk}/events", response_model=list[CaseEventOut])
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
