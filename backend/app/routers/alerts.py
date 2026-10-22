from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, aliased

from ..auth import get_current_user
from ..db import get_db
from ..models import Bureau, Case, CaseLink, LinkStatus, User
from ..privacy import link_out
from ..schemas import CaseLinkOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/overlaps", response_model=list[CaseLinkOut])
def overlap_alerts(bureau: Bureau | None = None, region: str | None = None,
                   db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """"Potential Overlapping Cases – Coordination Required": suggested links awaiting review, newest first."""
    a, b = aliased(Case), aliased(Case)
    q = (select(CaseLink).join(a, CaseLink.case_a_id == a.id).join(b, CaseLink.case_b_id == b.id)
         .where(CaseLink.status == LinkStatus.suggested.value)
         .order_by(CaseLink.created_at.desc(), CaseLink.id.desc()))
    if bureau:
        q = q.where(or_(a.source_bureau == bureau.value, b.source_bureau == bureau.value))
    if region:
        q = q.where(a.region == region)  # links never cross regions
    return [link_out(l, user) for l in db.scalars(q)]
