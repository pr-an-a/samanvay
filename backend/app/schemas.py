from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .ingest.common import CATEGORIES, REGION_BY_CODE
from .models import Bureau, CaseStatus


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
    complainant_masked: bool = False


class CaseCreate(BaseModel):
    """A new complaint. Officers file for their own bureau; ADMIN must name the bureau."""
    source_bureau: Bureau | None = None
    raw_institution_name: str = Field(min_length=3)
    raw_address: str | None = None
    district: str | None = None
    region: str
    category: str
    description: str = Field(min_length=5)
    received_date: date | None = None
    permanent_id: str | None = None
    complainant_name: str | None = None

    @field_validator("region")
    @classmethod
    def known_region(cls, v: str) -> str:
        if v not in REGION_BY_CODE.values():
            raise ValueError(f"region must be one of {sorted(REGION_BY_CODE.values())}")
        return v

    @field_validator("category")
    @classmethod
    def known_category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"category must be one of {sorted(CATEGORIES)}")
        return v


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
    kind: str | None = None
    asking_for: str | None = None


class CaseLinkOut(ORM):
    id: int
    case_a: CaseOut
    case_b: CaseOut
    scores: dict
    status: str
    reviewed_by: int | None
    reviewer_name: str | None = None
    reviewed_at: datetime | None
    created_at: datetime


class CaseCreateOut(BaseModel):
    case: CaseOut
    alert_title: str | None
    overlap_alerts: list[CaseLinkOut]


class TimelineEntry(BaseModel):
    timestamp: datetime
    case_pk: int
    case_id: str
    case_bureau: str
    actor: str
    actor_bureau: str
    action: str
    remarks: str | None
    via_confirmed_link: bool
    kind: str | None = None
    asking_for: str | None = None


class LinkReviewIn(BaseModel):
    remarks: str | None = None


class SLARuleOut(ORM):
    id: int
    bureau: str
    category: str
    days: int


class ActionIn(BaseModel):
    """A new action on a case. `asking_for` is what the officer is asking the college (or another bureau) for."""
    kind: str
    asking_for: str | None = Field(default=None, max_length=300)
    transfer_to: str | None = None
    remarks: str | None = Field(default=None, max_length=500)
    override_reason: str | None = Field(default=None, max_length=500)


class CoordinateIn(BaseModel):
    link_id: int
    body: str = Field(min_length=1, max_length=500)
    kind: str


class NoteIn(BaseModel):
    body: str = Field(min_length=1, max_length=500)

    @field_validator("body")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("A note cannot be empty")
        return v


class NoteOut(ORM):
    id: int
    link_id: int
    author: str
    bureau: str
    body: str
    timestamp: datetime


class InstitutionDetail(InstitutionOut):
    summary: str
    cases: list[CaseOut]
    notes: list[NoteOut]
    timeline: list[TimelineEntry]
    links: list[CaseLinkOut]
