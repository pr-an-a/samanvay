from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Case, CaseLink, CoordinationNote, Institution, LinkStatus, User
from ..privacy import case_out, link_out
from ..schemas import InstitutionDetail, InstitutionOut, NoteOut, TimelineEntry
from ..services import utc_naive
from ..summary import college_summary

router = APIRouter(prefix="/institutions", tags=["institutions"])


@router.get("", response_model=list[InstitutionOut], dependencies=[Depends(get_current_user)])
def list_institutions(db: Session = Depends(get_db)):
    return db.scalars(select(Institution).order_by(Institution.name)).all()


def touching(db: Session, case_ids: set[int], status: LinkStatus | None = None) -> list[CaseLink]:
    q = select(CaseLink).where(or_(CaseLink.case_a_id.in_(case_ids), CaseLink.case_b_id.in_(case_ids)))
    if status:
        q = q.where(CaseLink.status == status.value)
    return list(db.scalars(q.order_by(CaseLink.id)))


@router.get("/{inst_id}", response_model=InstitutionDetail)
def institution_detail(inst_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Unified view across bureaus: cases filed against this institution's permanent ID, plus cases an
    officer has *confirmed* as the same institution. Suggested links are listed but not merged in."""
    inst = db.get(Institution, inst_id)
    if inst is None:
        raise HTTPException(404, "Institution not found")
    direct = list(db.scalars(select(Case).where(Case.institution_id == inst_id)))
    member_ids = {c.id for c in direct}
    via_link: set[int] = set()
    frontier = set(member_ids)
    while frontier:  # follow confirmed links transitively
        nxt = set()
        for link in touching(db, frontier, LinkStatus.confirmed):
            for cid in (link.case_a_id, link.case_b_id):
                if cid not in member_ids:
                    member_ids.add(cid)
                    via_link.add(cid)
                    nxt.add(cid)
        frontier = nxt

    cases = sorted((db.get(Case, cid) for cid in member_ids), key=lambda c: (c.received_date, c.id))
    timeline = sorted(
        (TimelineEntry(timestamp=e.timestamp, case_pk=c.id, case_id=c.case_id, case_bureau=c.source_bureau,
                       actor=e.actor, actor_bureau=e.bureau, action=e.action, remarks=e.remarks,
                       via_confirmed_link=c.id in via_link, kind=e.kind, asking_for=e.asking_for)
         for c in cases for e in c.events),
        key=lambda t: (utc_naive(t.timestamp), t.case_pk))
    confirmed = touching(db, member_ids, LinkStatus.confirmed) if member_ids else []
    notes = db.scalars(select(CoordinationNote).where(CoordinationNote.link_id.in_([l.id for l in confirmed]))
                       .order_by(CoordinationNote.timestamp, CoordinationNote.id)) if confirmed else []
    return InstitutionDetail(
        **InstitutionOut.model_validate(inst).model_dump(),
        summary=college_summary(cases, [(t.timestamp, t.action, t.actor_bureau) for t in timeline], date.today()),
        notes=[NoteOut.model_validate(n) for n in notes],
        cases=[case_out(c, user) for c in cases],
        timeline=timeline,
        links=[link_out(l, user) for l in touching(db, member_ids)] if member_ids else [],
    )
