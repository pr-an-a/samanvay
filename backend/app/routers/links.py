from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import OFFICER_ROLES, get_current_user, require_roles
from ..db import get_db
from ..models import CaseEvent, CaseLink, LinkStatus, User, utcnow
from ..privacy import link_out
from ..schemas import CaseLinkOut, LinkReviewIn

router = APIRouter(prefix="/links", tags=["links"])


@router.get("", response_model=list[CaseLinkOut])
def list_links(status: LinkStatus | None = None, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    q = select(CaseLink).order_by(CaseLink.created_at.desc(), CaseLink.id.desc())
    if status:
        q = q.where(CaseLink.status == status.value)
    return [link_out(l, user) for l in db.scalars(q)]


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
