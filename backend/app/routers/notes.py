"""Coordination notes: short messages between the bureaus of a confirmed match. Append-only (no edit, no delete)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import audit
from ..auth import OFFICER_ROLES, get_current_user, require_roles
from ..db import get_db
from ..models import AuditAction, CaseLink, CoordinationNote, LinkStatus, Role, User
from ..schemas import NoteIn, NoteOut
from ..summary import BUREAU_NAMES

router = APIRouter(prefix="/links/{link_id}/notes", tags=["notes"])


def get_link_or_404(db: Session, link_id: int) -> CaseLink:
    link = db.get(CaseLink, link_id)
    if link is None:
        raise HTTPException(404, "Link not found")
    return link


def add_note(db: Session, link: CaseLink, user: User, text: str) -> CoordinationNote:
    """Append a note, audit it and ring the other bureau's bell. The caller commits."""
    if link.status != LinkStatus.confirmed.value:
        raise HTTPException(409, "Notes can only be posted once an officer has confirmed the match")
    involved = {link.case_a.source_bureau, link.case_b.source_bureau}
    if user.role != Role.ADMIN.value and user.bureau not in involved:
        raise HTTPException(403, "Only the bureaus involved in this match (and the Administrator) can post notes")
    note = CoordinationNote(link_id=link.id, author=user.name, bureau=user.bureau or "ADMIN", body=text)
    db.add(note)
    pair = f"{link.case_a.case_id}, {link.case_b.case_id}"
    audit.record(db, user, AuditAction.note_posted, f"Left a coordination note on {pair}", pair, link_id=link.id, remarks=text)
    audit.notify_note(db, link, user, BUREAU_NAMES[note.bureau])
    return note


@router.get("", response_model=list[NoteOut])
def list_notes(link_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    get_link_or_404(db, link_id)
    return db.scalars(select(CoordinationNote).where(CoordinationNote.link_id == link_id)
                      .order_by(CoordinationNote.timestamp, CoordinationNote.id)).all()


@router.post("", response_model=NoteOut, status_code=201)
def post_note(link_id: int, body: NoteIn, db: Session = Depends(get_db),
              user: User = Depends(require_roles(*OFFICER_ROLES))):
    link = get_link_or_404(db, link_id)
    note = add_note(db, link, user, body.body)
    db.commit()
    db.refresh(note)
    return note
