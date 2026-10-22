"""SLA monitor: flags open cases as "due soon" or "overdue" and raises alerts for their bureau.

All SLA values (per-rule days, due-soon window, escalation threshold) are demo settings,
not official AICTE timelines.
"""

import json
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .ingest.loader import DEFAULT_SLA_DAYS
from .models import Alert, AlertKind, Case, CaseStatus, SLARule, utcnow

SETTINGS_PATH = Path(__file__).with_name("sla_settings.json")
SETTINGS = json.loads(SETTINGS_PATH.read_text())
NOTE = "SLA values are demo settings, not official AICTE timelines."

# Last run, for the "Last checked" line in the UI. Per process; resets when the server restarts.
last_check: dict = {"at": None, "result": None}


def sla_state(case: Case, today: date, due_soon_days: int | None = None) -> str | None:
    """'overdue' if past the due date, 'due_soon' if due within `due_soon_days`, else None.
    Closed (disposed) cases and cases without a due date never get a state."""
    window = SETTINGS["due_soon_days"] if due_soon_days is None else due_soon_days
    if case.status == CaseStatus.disposed.value or case.expected_disposal_date is None:
        return None
    left = (case.expected_disposal_date - today).days
    if left < 0:
        return AlertKind.overdue.value
    if left <= window:
        return AlertKind.due_soon.value
    return None


def days_overdue(case: Case, today: date) -> int:
    return max((today - case.expected_disposal_date).days, 0) if case.expected_disposal_date else 0


def sla_days(db: Session) -> dict[tuple[str, str], int]:
    return {(r.bureau, r.category): r.days for r in db.scalars(select(SLARule))}


def run_sla_check(db: Session, today: date | None = None) -> dict:
    """Recompute due dates from the current SLA rules, update each open case's SLA state and
    raise one alert per case each time it newly becomes due soon or overdue. Safe to run repeatedly."""
    today = today or date.today()
    rules = sla_days(db)
    counts = {"checked": 0, "due_soon": 0, "overdue": 0, "new_alerts": 0, "due_dates_changed": 0}
    for case in db.scalars(select(Case).where(Case.status != CaseStatus.disposed.value)):
        counts["checked"] += 1
        due = case.received_date + timedelta(days=rules.get((case.source_bureau, case.category), DEFAULT_SLA_DAYS))
        if due != case.expected_disposal_date:
            case.expected_disposal_date = due
            counts["due_dates_changed"] += 1
        state = sla_state(case, today)
        if state:
            counts[state] += 1
        if state != case.sla_state:
            case.sla_state, case.sla_state_since = state, utcnow()
            if state:
                when = f"was due {case.expected_disposal_date:%d %b %Y}" if state == "overdue" else f"is due {case.expected_disposal_date:%d %b %Y}"
                db.add(Alert(kind=state, bureau=case.source_bureau, case_id=case.id,
                             message=f"Case {case.case_id} ({case.raw_institution_name}) {when}."))
                counts["new_alerts"] += 1
    # Closed cases lose any SLA flag.
    for case in db.scalars(select(Case).where(Case.status == CaseStatus.disposed.value, Case.sla_state.is_not(None))):
        case.sla_state, case.sla_state_since = None, utcnow()
    db.commit()
    last_check.update(at=datetime.now().astimezone().isoformat(timespec="seconds"), result=counts)
    return counts
