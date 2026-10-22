"""PGRC grievance portal export: JSON, ISO datetimes, "college_name", aicte_id often missing."""

import json
from datetime import datetime
from pathlib import Path

from .common import NormalizedCase, clean, clean_district, lookup

CATEGORY = {"Refund of fees": "fee_refund", "Faculty related": "faculty_shortage",
            "Infrastructure / facilities": "infrastructure", "Admission related": "admission_irregularity",
            "Original certificates not returned": "certificate_withholding",
            "Ragging (administrative action)": "ragging_admin", "Miscellaneous": "other"}
STATUS = {"Open": "pending", "In Progress": "under_process", "Forwarded": "transferred",
          "Escalated": "escalated", "Closed": "disposed"}


def parse(path: Path) -> list[NormalizedCase]:
    records = json.loads(path.read_text())["grievances"]
    return [NormalizedCase(
        case_id=clean(g["registration_no"]),
        source_bureau="PGRC",
        permanent_id=clean(g.get("aicte_id")),
        raw_institution_name=clean(g["college_name"]),
        raw_address=clean(g.get("college_address")),
        district=clean_district(g.get("district")),
        region=clean(g["zone"]).removesuffix(" Zone") if clean(g.get("zone")) else None,
        category=CATEGORY.get(clean(g["grievance_type"]), "other"),
        description=clean(g["grievance_text"]),
        received_date=datetime.fromisoformat(g["submitted_at"]).date(),
        status=lookup(STATUS, g["current_status"], "PGRC status"),
        assigned_officer=clean(g.get("handled_by")),
        last_action=clean(g.get("action_taken")),
        next_action=clean(g.get("next_step")),
        complainant_name=clean(g.get("grievant_name")),
    ) for g in records]
