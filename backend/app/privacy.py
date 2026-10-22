"""Complainant-name masking. Officers see full names only on their own bureau's cases; ADMIN sees all."""

from .models import Case, CaseLink, Role, User
from .schemas import CaseLinkOut, CaseOut


def mask_name(name: str | None) -> str | None:
    """'Ravi Kumar' -> 'R*** K***'."""
    if not name:
        return name
    return " ".join(f"{word[0]}***" for word in name.split())


def can_see_complainant(user: User, case: Case) -> bool:
    return user.role == Role.ADMIN.value or user.bureau == case.source_bureau


def case_out(case: Case, user: User) -> CaseOut:
    out = CaseOut.model_validate(case)
    if out.complainant_name and not can_see_complainant(user, case):
        out.complainant_name = mask_name(out.complainant_name)
        out.complainant_masked = True
    return out


def link_out(link: CaseLink, user: User) -> CaseLinkOut:
    out = CaseLinkOut.model_validate(link)
    out.case_a, out.case_b = case_out(link.case_a, user), case_out(link.case_b, user)
    out.reviewer_name = link.reviewer.name if link.reviewer else None
    return out
