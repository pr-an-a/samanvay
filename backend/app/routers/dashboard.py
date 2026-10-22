from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Bureau, Case, CaseLink, CaseStatus, LinkStatus
from ..services import is_open, is_overdue

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
    status_counts = Counter(c.status for c in cases)
    return {
        "as_of": today.isoformat(),
        "total_cases": len(cases),
        "by_status": {s.value: status_counts.get(s.value, 0) for s in CaseStatus},
        "bureau_workload": [{"bureau": b.value, **by_bureau.get(b.value, {"total": 0, "open": 0, "overdue": 0})}
                            for b in Bureau],
        "ageing_open": {name: ageing.get(name, 0) for name, _, _ in AGEING_BUCKETS},
        "sla": {"open": len(open_cases), "overdue": len(overdue), "within_sla": len(open_cases) - len(overdue),
                "note": "SLA days are configurable demo values, not official AICTE rules."},
        "overlaps": {s.value: links.get(s.value, 0) for s in LinkStatus},
        "by_region": [{"region": r, **v} for r, v in sorted(by_region.items())],
    }
