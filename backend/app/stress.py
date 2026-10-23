"""Stress test: the real matcher against many ways a complainant might write one college's name.

Nothing here is stored. Each variant becomes a throwaway complaint that is scored against the other
bureau's real case with the same function the live matcher uses (matcher.score_pair), then compared
with two simpler approaches: matching on the AICTE permanent ID only, and matching on the exact name
after tidying case and punctuation. The variants were written once, before running, and are never
trimmed to flatter the result.
"""

import re
from datetime import date

from .matcher import CONFIG, TextIndex, profile, score_pair
from .models import Case

# The college under test: the Regulation Bureau case that the Grievance Cell complaints below are about.
CASE_ID = "RB/2026/0138"
COMPLAINT_ADDRESS = "Survey No. 253, Lakeview Rd, Teestapara"

# (what is different, name as the complainant wrote it, district given?)
VARIANTS: list[tuple[str, str, bool]] = [
    ("All capitals", "SHRI MEGHA SARASWATI INSTITUTE OF TECHNOLOGY", True),
    ("Trailing full stop", "Shri Megha Saraswati Institute of Technology.", True),
    ("Honorific spelt Sri", "Sri Megha Saraswati Institute of Technology", True),
    ("Honorific dropped", "Megha Saraswati Institute of Technology", True),
    ("Wrong honorific", "Smt. Megha Saraswati Institute of Technology", True),
    ("Spelling: Saraswathi", "Shri Megha Saraswathi Institute of Technology", True),
    ("Spelling: Mega", "Shri Mega Saraswati Inst. of Tech.", True),
    ("Abbreviation: Inst", "Shri Megha Saraswati Inst of Technology", True),
    ("Abbreviations: Instt, Tech", "Shri Megha Saraswati Instt. of Tech", True),
    ("Honorific dropped, abbreviated", "Megha Saraswati Inst. of Tech.", True),
    ("Merged words", "Shri MeghaSaraswati Institute of Technology", True),
    ("Honorific merged in", "ShriMegha Saraswati Institute of Technology", True),
    ("Initials with dots", "S.M.S. Institute of Technology", True),
    ("Initials, abbreviated", "S.M.S. Inst. of Tech.", True),
    ("Initials without dots", "SMS Inst of Technology", True),
    ("First name as initial", "M. Saraswati Inst. of Technology", True),
    ("Correct name, district missing", "Shri Megha Saraswati Institute of Technology", False),
    ("Typo, district missing", "Shri Megha Saraswati Institute of Technolgy", False),
    ("Abbreviated, district missing", "Sri Megha Saraswati Inst. of Tech.", False),
    ("'College' instead of 'Institute'", "Shri Megha Saraswati College of Technology", True),
]


def normalise_name(name: str) -> str:
    """What a simple exact-name search would do: ignore case, punctuation and extra spaces. Nothing smarter."""
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", name.lower()).split())


def throwaway_complaint(base: Case, name: str, district: bool) -> Case:
    """A new Grievance Cell complaint about `base`'s college: no AICTE ID, same region. Never added to a session."""
    return Case(id=-1, case_id="new complaint", source_bureau="PGRC", institution_id=None, raw_institution_name=name,
                raw_address=COMPLAINT_ADDRESS, district=base.district if district else None, region=base.region,
                category=base.category, description=base.description, status="pending", received_date=date.today())


def run(base: Case) -> dict:
    threshold = CONFIG["link_threshold"]
    mine = profile(base)
    rows = []
    for what, name, has_district in VARIANTS:
        c = throwaway_complaint(base, name, has_district)
        s = score_pair(profile(c), mine, TextIndex([c, base]))
        strength = s["final_confidence"] if s else 0.0
        rows.append({
            "what": what, "name": name, "district_given": has_district,
            "strength": strength, "samanvay": strength >= threshold,
            "id_only": bool(c.institution_id and c.institution_id == base.institution_id),
            "exact_name": normalise_name(name) == normalise_name(base.raw_institution_name),
            "reasons": s["reasons"][:3] if s else [],
        })
    return {
        "college": base.raw_institution_name, "other_case": base.case_id, "other_bureau": base.source_bureau,
        "threshold": threshold, "variants": rows,
        "totals": {"total": len(rows), **{k: sum(r[k] for r in rows) for k in ("samanvay", "exact_name", "id_only")}},
    }
