"""Shared case logic: search filters (GET /cases and the CSV export), SLA status, new complaints."""

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from .ingest.common import REGION_BY_CODE
from .ingest.loader import DEFAULT_SLA_DAYS
from .models import Bureau, Case, CaseEvent, CaseStatus, Institution, Role, SLARule, User

OVERLAP_ALERT_TITLE = "Potential Overlapping Cases – Coordination Required"
CODE_BY_REGION = {region: code for code, region in REGION_BY_CODE.items()}


@dataclass
class CaseFilters:
    """Query parameters shared by GET /cases and GET /reports/cases.csv."""
    q: str | None = None                 # any of: institution name, permanent ID, case ID
    institution: str | None = None       # raw or registry name, substring
    permanent_id: str | None = None
    case_id: str | None = None
    bureau: Bureau | None = None
    region: str | None = None
    category: str | None = None
    status: CaseStatus | None = None
    received_from: date | None = None
    received_to: date | None = None
    institution_id: int | None = None
    overdue: bool | None = None
    open: bool | None = None


def case_query(f: CaseFilters) -> Select:
    q = select(Case).outerjoin(Institution, Case.institution_id == Institution.id)
    like = lambda s: f"%{s.strip()}%"  # noqa: E731
    if f.q:
        q = q.where(or_(Case.raw_institution_name.ilike(like(f.q)), Institution.name.ilike(like(f.q)),
                        Institution.permanent_id.ilike(like(f.q)), Case.case_id.ilike(like(f.q))))
    if f.institution:
        q = q.where(or_(Case.raw_institution_name.ilike(like(f.institution)), Institution.name.ilike(like(f.institution))))
    if f.permanent_id:
        q = q.where(Institution.permanent_id.ilike(like(f.permanent_id)))
    if f.case_id:
        q = q.where(Case.case_id.ilike(like(f.case_id)))
    if f.bureau:
        q = q.where(Case.source_bureau == f.bureau.value)
    if f.region:
        q = q.where(Case.region == f.region)
    if f.category:
        q = q.where(Case.category == f.category)
    if f.status:
        q = q.where(Case.status == f.status.value)
    if f.received_from:
        q = q.where(Case.received_date >= f.received_from)
    if f.received_to:
        q = q.where(Case.received_date <= f.received_to)
    if f.institution_id is not None:
        q = q.where(Case.institution_id == f.institution_id)
    if f.open is not None:
        q = q.where((Case.status != CaseStatus.disposed.value) if f.open else (Case.status == CaseStatus.disposed.value))
    if f.overdue is not None:
        overdue = (Case.status != CaseStatus.disposed.value) & (Case.expected_disposal_date < date.today())
        q = q.where(overdue if f.overdue else ~overdue)
    return q.order_by(Case.received_date.desc(), Case.id.desc())


def is_open(case: Case) -> bool:
    return case.status != CaseStatus.disposed.value


def is_overdue(case: Case, today: date) -> bool:
    return is_open(case) and case.expected_disposal_date is not None and case.expected_disposal_date < today


def utc_naive(ts: datetime) -> datetime:
    """SQLite hands back naive UTC; freshly created objects may still be aware. Compare them as naive UTC."""
    return ts.astimezone(timezone.utc).replace(tzinfo=None) if ts.tzinfo else ts


def next_case_id(db: Session, bureau: str, region: str, received: date) -> str:
    """Follow each bureau's own numbering: RB/2026/0001, PG-2026-00001, SRO/2026/001."""
    y = received.year
    prefix, width = {"RB": (f"RB/{y}/", 4), "PGRC": (f"PG-{y}-", 5)}.get(bureau) or (f"{CODE_BY_REGION[region]}/{y}/", 3)
    taken = db.scalars(select(Case.case_id).where(Case.case_id.like(prefix + "%")))
    n = max((int(cid[len(prefix):]) for cid in taken if cid[len(prefix):].isdigit()), default=0) + 1
    return f"{prefix}{n:0{width}d}"


def create_case(db: Session, body, user: User) -> Case:
    bureau = body.source_bureau.value if body.source_bureau else user.bureau
    if bureau is None:
        raise HTTPException(422, "source_bureau is required for ADMIN users")
    if user.role != Role.ADMIN.value and bureau != user.bureau:
        raise HTTPException(403, "Officers can only file complaints for their own bureau")
    institution_id = None
    if body.permanent_id:
        inst = db.scalar(select(Institution).where(Institution.permanent_id == body.permanent_id.strip()))
        if inst is None:
            raise HTTPException(422, f"Unknown permanent_id {body.permanent_id}")
        institution_id = inst.id
    received = body.received_date or date.today()
    days = db.scalar(select(SLARule.days).where(SLARule.bureau == bureau, SLARule.category == body.category))
    case = Case(
        case_id=next_case_id(db, bureau, body.region, received), source_bureau=bureau,
        institution_id=institution_id, raw_institution_name=body.raw_institution_name.strip(),
        raw_address=body.raw_address, district=body.district, region=body.region,
        category=body.category, description=body.description, received_date=received,
        status=CaseStatus.pending.value, assigned_officer=user.name,
        last_action="Complaint registered", next_action="Scrutiny of complaint",
        expected_disposal_date=received + timedelta(days=DEFAULT_SLA_DAYS if days is None else days),
        complainant_name=body.complainant_name,
    )
    db.add(case)
    db.flush()
    db.add(CaseEvent(case_id=case.id, actor=user.name, bureau=bureau, action="Complaint registered"))
    db.flush()  # the caller commits, together with any overlap links
    return case
