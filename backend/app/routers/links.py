from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth import OFFICER_ROLES, get_current_user, require_roles
from ..db import get_db
from .. import audit
from ..models import AuditAction, CaseEvent, CaseLink, LinkStatus, User, utcnow
from ..privacy import link_out
from ..schemas import CaseLinkOut, LinkReviewIn

router = APIRouter(prefix="/links", tags=["links"])


@router.get("", response_model=list[CaseLinkOut])
def list_links(status: LinkStatus | None = None, case_pk: int | None = None, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    q = select(CaseLink).order_by(CaseLink.created_at.desc(), CaseLink.id.desc())
    if status:
        q = q.where(CaseLink.status == status.value)
    if case_pk is not None:
        q = q.where(or_(CaseLink.case_a_id == case_pk, CaseLink.case_b_id == case_pk))
    return [link_out(l, user) for l in db.scalars(q)]


@router.get("/{link_id}", response_model=CaseLinkOut)
def get_link(link_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    link = db.get(CaseLink, link_id)
    if link is None:
        raise HTTPException(404, "Link not found")
    return link_out(link, user)


def review(db: Session, link_id: int, user: User, new_status: LinkStatus, remarks: str | None) -> CaseLink:
    link = db.get(CaseLink, link_id)
    if link is None:
        raise HTTPException(404, "Link not found")
    if link.status != LinkStatus.suggested.value:
        raise HTTPException(409, f"Link already {link.status}")
    link.status = new_status.value
    link.reviewed_by = user.id
    link.reviewed_at = utcnow()
    # Record the decision in both cases' history. Cases themselves are never merged.
    for case, other in ((link.case_a, link.case_b), (link.case_b, link.case_a)):
        db.add(CaseEvent(
            case_id=case.id,
            actor=user.name,
            bureau=user.bureau or "ADMIN",
            action=f"Overlap with {other.case_id} {new_status.value}",
            remarks=remarks,
        ))
    pair = f"{link.case_a.case_id}, {link.case_b.case_id}"
    if new_status == LinkStatus.confirmed:
        audit.record(db, user, AuditAction.link_confirmed, f"Confirmed {pair} as the same college", pair,
                     link_id=link.id, remarks=remarks)
    else:
        audit.record(db, user, AuditAction.link_rejected, f"Marked {pair} as different colleges", pair,
                     link_id=link.id, remarks=remarks)
    db.commit()
    db.refresh(link)
    return link


@router.post("/{link_id}/confirm", response_model=CaseLinkOut)
def confirm_link(
    link_id: int,
    body: LinkReviewIn | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*OFFICER_ROLES)),
):
    return link_out(review(db, link_id, user, LinkStatus.confirmed, body.remarks if body else None), user)


@router.post("/{link_id}/reject", response_model=CaseLinkOut)
def reject_link(
    link_id: int,
    body: LinkReviewIn | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*OFFICER_ROLES)),
):
    return link_out(review(db, link_id, user, LinkStatus.rejected, body.remarks if body else None), user)
