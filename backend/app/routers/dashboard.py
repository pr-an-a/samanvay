from collections import Counter
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Bureau, Case, CaseLink, CaseStatus, Institution, LinkStatus
from ..services import is_open, is_overdue, utc_naive

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_user)])

AGEING_BUCKETS = [("0-15", 0, 15), ("16-30", 16, 30), ("31-60", 31, 60), ("60+", 61, None)]


def bucket(age: int) -> str:
    return next(name for name, lo, hi in AGEING_BUCKETS if age >= lo and (hi is None or age <= hi))


@router.get("/stats")
def stats(db: Session = Depends(get_db)) -> dict:
    today = date.today()
    cases = list(db.scalars(select(Case)))
    open_cases = [c for c in cases if is_open(c)]
    overdue = [c for c in open_cases if is_overdue(c, today)]

    def group(key) -> list[dict]:
        rows = {}
        for c in cases:
            r = rows.setdefault(key(c), {"total": 0, "open": 0, "overdue": 0})
            r["total"] += 1
            r["open"] += is_open(c)
            r["overdue"] += is_overdue(c, today)
        return rows

    by_bureau = group(lambda c: c.source_bureau)
    by_region = group(lambda c: c.region or "Unknown")
    ageing = Counter(bucket((today - c.received_date).days) for c in open_cases)
    links = Counter(db.scalars(select(CaseLink.status)))
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    coordinated = sum(1 for t in db.scalars(select(CaseLink.reviewed_at).where(CaseLink.status == LinkStatus.confirmed.value))
                      if t and utc_naive(t) >= month_start)
    status_counts = Counter(c.status for c in cases)
    return {
        "as_of": today.isoformat(),
        "total_cases": len(cases),
        "by_status": {s.value: status_counts.get(s.value, 0) for s in CaseStatus},
        "bureau_workload": [{"bureau": b.value, **by_bureau.get(b.value, {"total": 0, "open": 0, "overdue": 0})}
                            for b in Bureau],
        "ageing_open": {name: ageing.get(name, 0) for name, _, _ in AGEING_BUCKETS},
        "sla": {"open": len(open_cases), "overdue": len(overdue), "within_sla": len(open_cases) - len(overdue),
                "note": "SLA values are demo settings, not official AICTE timelines."},
        "overlaps": {s.value: links.get(s.value, 0) for s in LinkStatus},
        "coordinated_this_month": coordinated,
        "by_region": [{"region": r, **v} for r, v in sorted(by_region.items())],
    }


@router.get("/coordination")
def coordination(limit: int = 8, db: Session = Depends(get_db)) -> list[dict]:
    """Colleges where two bureaus are both still active: links (not rejected) whose two cases are open.
    Links that still need an officer's check come first, then the strongest matches."""
    links = [l for l in db.scalars(select(CaseLink).where(CaseLink.status != LinkStatus.rejected.value))
             if is_open(l.case_a) and is_open(l.case_b)]
    links.sort(key=lambda l: (l.status != LinkStatus.suggested.value, -l.scores["final_confidence"], -l.id))
    out = []
    for l in links[:limit]:
        registered = next((c for c in (l.case_a, l.case_b) if c.institution_id), None)
        inst = db.get(Institution, registered.institution_id) if registered else None
        name = inst.name if inst else max((l.case_a.raw_institution_name, l.case_b.raw_institution_name), key=len)
        out.append({
            "link_id": l.id, "status": l.status, "match_strength": l.scores["final_confidence"],
            "college_name": name, "institution_id": inst.id if inst else None,
            "district": l.case_a.district or l.case_b.district, "region": l.case_a.region,
            "cases": [{"id": c.id, "case_id": c.case_id, "source_bureau": c.source_bureau, "status": c.status,
                       "last_action": c.last_action, "received_date": c.received_date.isoformat()}
                      for c in (l.case_a, l.case_b)],
        })
    return out
