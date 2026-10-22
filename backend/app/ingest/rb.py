"""Regulation Bureau export: CSV, dd-mm-yyyy dates, permanent_id mostly filled."""

import csv
from datetime import datetime
from pathlib import Path

from .common import NormalizedCase, clean, clean_district, lookup

CATEGORY = {"Fee Refund": "fee_refund", "Faculty Shortage": "faculty_shortage",
            "Infrastructure Deficiency": "infrastructure", "Admission Irregularity": "admission_irregularity",
            "Withholding of Certificates": "certificate_withholding",
            "Ragging - Administrative Lapse": "ragging_admin", "Others": "other"}
STATUS = {"Pending": "pending", "Under Process": "under_process", "Transferred": "transferred",
          "Escalated": "escalated", "Disposed": "disposed"}


def parse(path: Path) -> list[NormalizedCase]:
    with open(path, newline="") as f:
        return [NormalizedCase(
            case_id=clean(row["case_no"]),
            source_bureau="RB",
            permanent_id=clean(row["permanent_id"]),
            raw_institution_name=clean(row["institution_name"]),
            raw_address=clean(row["address"]),
            district=clean_district(row["district"]),
            region=clean(row["region"]),
            category=CATEGORY.get(clean(row["category"]), "other"),
            description=clean(row["description"]),
            received_date=datetime.strptime(row["received_on"].strip(), "%d-%m-%Y").date(),
            status=lookup(STATUS, row["status"], "RB status"),
            assigned_officer=clean(row["officer"]),
            last_action=clean(row["last_action"]),
            next_action=clean(row["next_action"]),
            complainant_name=clean(row["complainant"]),
        ) for row in csv.DictReader(f)]
