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
