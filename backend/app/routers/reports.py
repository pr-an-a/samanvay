import csv
import io
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User
from ..privacy import case_out
from ..services import CaseFilters, case_query, is_overdue

router = APIRouter(prefix="/reports", tags=["reports"])

COLUMNS = ["case_id", "source_bureau", "permanent_id", "raw_institution_name", "registry_name", "district",
           "region", "category", "status", "received_date", "expected_disposal_date", "overdue",
           "assigned_officer", "last_action", "next_action", "complainant_name"]


@router.get("/cases.csv")
def cases_csv(f: CaseFilters = Depends(), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Same filters as GET /cases. Complainant names are masked exactly as in the API."""
    today = date.today()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(COLUMNS)
    for c in db.scalars(case_query(f)):
        out = case_out(c, user)
        inst = c.institution
        w.writerow([c.case_id, c.source_bureau, inst.permanent_id if inst else "", c.raw_institution_name,
                    inst.name if inst else "", c.district or "", c.region or "", c.category, c.status,
                    c.received_date.isoformat(), c.expected_disposal_date.isoformat() if c.expected_disposal_date else "",
                    "yes" if is_overdue(c, today) else "no", c.assigned_officer or "", c.last_action or "",
                    c.next_action or "", out.complainant_name or ""])
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="samanvay_cases_{today}.csv"'})
