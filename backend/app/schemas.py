from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from .models import CaseStatus


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORM):
    id: int
    name: str
    role: str
    bureau: str | None


class LoginIn(BaseModel):
    user_id: int


class LoginOut(BaseModel):
    token: str
    user: UserOut


class InstitutionOut(ORM):
    id: int
    permanent_id: str
    name: str
    address: str
    district: str
    region: str


class CaseOut(ORM):
    id: int
    case_id: str
    source_bureau: str
    institution_id: int | None
    raw_institution_name: str
    raw_address: str | None
    district: str | None
    region: str | None
    category: str
    description: str
    received_date: date
    status: CaseStatus
    assigned_officer: str | None
    last_action: str | None
    next_action: str | None
    expected_disposal_date: date | None
    complainant_name: str | None


class CaseEventIn(BaseModel):
    action: str
    remarks: str | None = None


class CaseEventOut(ORM):
    id: int
    case_id: int
    actor: str
    bureau: str
    action: str
    remarks: str | None
    timestamp: datetime


class CaseLinkOut(ORM):
    id: int
    case_a: CaseOut
    case_b: CaseOut
    scores: dict
    status: str
    reviewed_by: int | None
    reviewed_at: datetime | None
    created_at: datetime


class LinkReviewIn(BaseModel):
    remarks: str | None = None


class SLARuleOut(ORM):
    id: int
    bureau: str
    category: str
    days: int
