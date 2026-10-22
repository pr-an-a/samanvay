from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import SLARule
from ..schemas import SLARuleOut

router = APIRouter(tags=["meta"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/sla-rules", response_model=list[SLARuleOut], dependencies=[Depends(get_current_user)])
def list_sla_rules(db: Session = Depends(get_db)):
    """Demo SLA values only — not official AICTE rules."""
    return db.scalars(select(SLARule).order_by(SLARule.bureau, SLARule.category)).all()
