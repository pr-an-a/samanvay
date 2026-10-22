from datetime import date, datetime, timezone
from enum import Enum

from sqlalchemy import JSON, CheckConstraint, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Bureau(str, Enum):
    RB = "RB"
    PGRC = "PGRC"
    REGIONAL = "REGIONAL"


class CaseStatus(str, Enum):
    pending = "pending"
    under_process = "under_process"
    transferred = "transferred"
    escalated = "escalated"
    disposed = "disposed"


class LinkStatus(str, Enum):
    suggested = "suggested"
    confirmed = "confirmed"
    rejected = "rejected"


class Role(str, Enum):
    RB_OFFICER = "RB_OFFICER"
    PGRC_OFFICER = "PGRC_OFFICER"
    REGIONAL = "REGIONAL"
    ADMIN = "ADMIN"


class Institution(Base):
    __tablename__ = "institutions"

    id: Mapped[int] = mapped_column(primary_key=True)
    permanent_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str] = mapped_column(String(500))
    district: Mapped[str] = mapped_column(String(100))
    region: Mapped[str] = mapped_column(String(100))

    cases: Mapped[list["Case"]] = relationship(back_populates="institution")


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    source_bureau: Mapped[str] = mapped_column(String(16), index=True)
    # Nullable: complaints often arrive without the institution's permanent ID.
    institution_id: Mapped[int | None] = mapped_column(ForeignKey("institutions.id"), index=True)
    raw_institution_name: Mapped[str] = mapped_column(String(255))
    raw_address: Mapped[str | None] = mapped_column(String(500))
    district: Mapped[str | None] = mapped_column(String(100))
    region: Mapped[str | None] = mapped_column(String(100))
    category: Mapped[str] = mapped_column(String(64))
    description: Mapped[str] = mapped_column(Text)
    received_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(16), default=CaseStatus.pending.value, index=True)
    assigned_officer: Mapped[str | None] = mapped_column(String(100))
    last_action: Mapped[str | None] = mapped_column(String(255))
    next_action: Mapped[str | None] = mapped_column(String(255))
    expected_disposal_date: Mapped[date | None] = mapped_column(Date)
    complainant_name: Mapped[str | None] = mapped_column(String(100))

    institution: Mapped[Institution | None] = relationship(back_populates="cases")
    events: Mapped[list["CaseEvent"]] = relationship(back_populates="case", order_by="CaseEvent.timestamp")


class CaseEvent(Base):
    """Append-only action history. Never update or delete rows."""

    __tablename__ = "case_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    actor: Mapped[str] = mapped_column(String(100))
    bureau: Mapped[str] = mapped_column(String(16))
    action: Mapped[str] = mapped_column(String(100))
    remarks: Mapped[str | None] = mapped_column(Text)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    case: Mapped[Case] = relationship(back_populates="events")


class CaseLink(Base):
    """A suggested overlap between two cases. Only a human sets confirmed/rejected."""

    __tablename__ = "case_links"
    __table_args__ = (
        UniqueConstraint("case_a_id", "case_b_id"),
        CheckConstraint("case_a_id < case_b_id", name="ck_link_ordered"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    case_a_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    case_b_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    scores: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(16), default=LinkStatus.suggested.value, index=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    case_a: Mapped[Case] = relationship(foreign_keys=[case_a_id])
    case_b: Mapped[Case] = relationship(foreign_keys=[case_b_id])
    reviewer: Mapped["User | None"] = relationship()


class SLARule(Base):
    """Configurable demo SLA values — not official AICTE rules."""

    __tablename__ = "sla_rules"
    __table_args__ = (UniqueConstraint("bureau", "category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    bureau: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(64))
    days: Mapped[int]


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(16))
    bureau: Mapped[str | None] = mapped_column(String(16))


class AuthToken(Base):
    """One row per sign-in, so a demo user can be signed in on several devices at once."""

    __tablename__ = "auth_tokens"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship()
