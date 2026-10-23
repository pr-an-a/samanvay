"""Audit log and alert helpers, called by the actions themselves (never by API clients)."""

from sqlalchemy.orm import Session

from .models import Alert, AlertKind, AuditAction, AuditLog, CaseLink, User


def record(db: Session, user: User, action: AuditAction, summary: str, case_refs: str,
           case_pk: int | None = None, link_id: int | None = None, remarks: str | None = None) -> None:
    """Append an audit entry in the caller's transaction."""
    db.add(AuditLog(action=action.value, actor_name=user.name, actor_role=user.role, actor_bureau=user.bureau,
                    summary=summary, case_refs=case_refs, case_pk=case_pk, link_id=link_id, remarks=remarks))


def notify_link(db: Session, link: CaseLink) -> None:
    """A new suggested match: tell both bureaus it needs their check."""
    db.flush()  # link.id and relationships
    a, b = link.case_a, link.case_b
    for mine, other in ((a, b), (b, a)):
        db.add(Alert(kind=AlertKind.needs_check.value, bureau=mine.source_bureau, link_id=link.id,
                     message=f"Your case {mine.case_id} may be about the same college as case {other.case_id}."))


def notify_note(db: Session, link: CaseLink, user: User, author_label: str) -> list[str]:
    """A note on a confirmed match rings the bell of each involved bureau except the author's own."""
    names = [c.institution.name for c in (link.case_a, link.case_b) if c.institution]
    bureaus = {link.case_a.source_bureau, link.case_b.source_bureau} - {user.bureau}
    for bureau in sorted(bureaus):
        mine = link.case_a if link.case_a.source_bureau == bureau else link.case_b
        college = names[0] if names else mine.raw_institution_name
        db.add(Alert(kind=AlertKind.note.value, bureau=bureau, link_id=link.id,
                     message=f"{author_label} left a note on {college}"))
    return sorted(bureaus)
