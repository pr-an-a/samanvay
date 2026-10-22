"""Regional Offices export: CSV with terse column names, RO codes, category/status codes, dd-Mon-yyyy."""

import csv
from datetime import date
from pathlib import Path

from .common import REGION_BY_CODE, NormalizedCase, clean, clean_district, lookup

CATEGORY = {"FEE": "fee_refund", "FAC": "faculty_shortage", "INFRA": "infrastructure",
            "ADM": "admission_irregularity", "CERT": "certificate_withholding",
            "RAG": "ragging_admin", "OTH": "other"}
STATUS = {"PEND": "pending", "UP": "under_process", "TRF": "transferred", "ESC": "escalated", "DISP": "disposed"}
MONTHS = {m: n for n, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def parse_date(text: str) -> date:
    # Parsed by hand so it doesn't depend on the machine's locale for month names.
    day, mon, year = text.strip().split("-")
    return date(int(year), MONTHS[mon.title()], int(day))


def parse(path: Path) -> list[NormalizedCase]:
    with open(path, newline="") as f:
        return [NormalizedCase(
            case_id=clean(row["RO_REF"]),
            source_bureau="REGIONAL",
            permanent_id=clean(row["INST_ID"]),
            raw_institution_name=clean(row["INST_NAME"]),
            raw_address=clean(row["ADDR"]),
            district=clean_district(row["DIST"]),
            region=lookup(REGION_BY_CODE, row["RO"], "RO code"),
            category=CATEGORY.get(clean(row["CAT"]), "other"),
            description=clean(row["SUMMARY"]),
            received_date=parse_date(row["RECD_DT"]),
            status=lookup(STATUS, row["STATUS"], "Regional status"),
            assigned_officer=clean(row["DEALING_OFFR"]),
            last_action=clean(row["LAST_ACTN"]),
            next_action=clean(row["NEXT_ACTN"]),
            complainant_name=clean(row["CMPLT_NAME"]),
        ) for row in csv.DictReader(f)]
