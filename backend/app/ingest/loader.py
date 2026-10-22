"""Load the institution registry and all three bureau exports into the database."""

import csv
import json
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Case, CaseEvent, Institution, SLARule
from . import pgrc, rb, regional
from .common import NormalizedCase

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "sources"
SOURCES = [("rb_cases.csv", rb.parse), ("pgrc_grievances.json", pgrc.parse),
           ("regional_cases.csv", regional.parse)]
DEFAULT_SLA_DAYS = 30


def load_institutions(db: Session, path: Path) -> dict[str, int]:
    with open(path, newline="") as f:
        insts = [Institution(**row) for row in csv.DictReader(f)]
    db.add_all(insts)
    db.flush()
    return {i.permanent_id: i.id for i in insts}


def at(d: date, hour: int) -> datetime:
    return datetime.combine(d, time(hour), tzinfo=timezone.utc)


def load_cases(db: Session, records: list[NormalizedCase], inst_ids: dict[str, int], shift: timedelta) -> None:
    sla = {(r.bureau, r.category): r.days for r in db.scalars(select(SLARule))}
    for r in records:
        received = r.received_date + shift
        case = Case(
            case_id=r.case_id, source_bureau=r.source_bureau,
            institution_id=inst_ids.get(r.permanent_id) if r.permanent_id else None,
            raw_institution_name=r.raw_institution_name, raw_address=r.raw_address,
            district=r.district, region=r.region, category=r.category, description=r.description,
            received_date=received, status=r.status, assigned_officer=r.assigned_officer,
            last_action=r.last_action, next_action=r.next_action,
            expected_disposal_date=received + timedelta(days=sla.get((r.source_bureau, r.category), DEFAULT_SLA_DAYS)),
            complainant_name=r.complainant_name,
        )
        db.add(case)
        db.flush()
        db.add(CaseEvent(case_id=case.id, actor="System", bureau=r.source_bureau,
                         action="Complaint registered", remarks=None, timestamp=at(received, 10)))
        if r.last_action and r.last_action != "Complaint registered":
            acted = min(received + timedelta(days=7), date.today())
            db.add(CaseEvent(case_id=case.id, actor=r.assigned_officer or "Officer", bureau=r.source_bureau,
                             action=r.last_action, remarks=None, timestamp=at(acted, 15)))


def load_all(db: Session, data_dir: Path = DATA_DIR, shift_to_today: bool = True) -> dict[str, int]:
    """Shift moves the generator's reference date to today so SLA status looks the same on any demo day."""
    meta = json.loads((data_dir / "meta.json").read_text())
    shift = date.today() - date.fromisoformat(meta["ref_date"]) if shift_to_today else timedelta(0)
    inst_ids = load_institutions(db, data_dir / "institutions.csv")
    counts = {"institutions": len(inst_ids)}
    for filename, parse in SOURCES:
        records = parse(data_dir / filename)
        load_cases(db, records, inst_ids, shift)
        counts[filename] = len(records)
    db.commit()
    return counts
