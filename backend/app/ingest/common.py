"""Shared shape and helpers for source adapters.

Adapters map each bureau's export into NormalizedCase. They normalise *fields* (dates,
categories, statuses, regions, whitespace) but keep the institution name and address
verbatim: reconciling those is the matcher's job, and the raw text is evidence it must show.
"""

from dataclasses import dataclass
from datetime import date

CATEGORIES = {"fee_refund", "faculty_shortage", "infrastructure", "admission_irregularity",
              "certificate_withholding", "ragging_admin", "other"}
STATUSES = {"pending", "under_process", "transferred", "escalated", "disposed"}
REGION_BY_CODE = {"NRO": "Northern", "NWRO": "North-Western", "WRO": "Western", "CRO": "Central",
                  "ERO": "Eastern", "SERO": "South-Eastern", "SRO": "Southern", "SWRO": "South-Western"}


@dataclass
class NormalizedCase:
    case_id: str
    source_bureau: str
    permanent_id: str | None
    raw_institution_name: str
    raw_address: str | None
    district: str | None
    region: str | None
    category: str
    description: str
    received_date: date
    status: str
    assigned_officer: str | None
    last_action: str | None
    next_action: str | None
    complainant_name: str | None


def clean(value) -> str | None:
    """Collapse whitespace; empty or missing -> None."""
    if value is None:
        return None
    text = " ".join(str(value).split())
    return text or None


def clean_district(value) -> str | None:
    text = clean(value)
    return text.title() if text and text.isupper() else text


def lookup(mapping: dict[str, str], value, field: str) -> str:
    key = clean(value)
    if key not in mapping:
        raise ValueError(f"unknown {field}: {value!r}")
    return mapping[key]
