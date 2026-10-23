"""Data for the video-demo screens: the Without/With picture and the stress test."""

import json
from difflib import SequenceMatcher

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import stress
from ..auth import get_current_user
from ..db import get_db
from ..matcher import TextIndex, profile, score_pair
from ..models import Bureau, Case, CaseLink, CaseStatus, LinkStatus
from .demo import REPO

router = APIRouter(tags=["demo"], dependencies=[Depends(get_current_user)])
DEMO_RB_CASE = "RB/2026/0150"
FILLERS = 3  # unmatched cases per inbox, so each side has about six


def card(c: Case, pair: str | None = None, incoming: bool = False) -> dict:
    return {"case_id": c.case_id, "college": c.raw_institution_name, "district": c.district, "category": c.category,
            "status": c.status, "received_date": c.received_date, "pair": pair, "incoming": incoming}


def pair_label(tier: str) -> str:
    return "Same AICTE ID" if tier == "id" else "Matched without AICTE ID"


def name_similarity(link: CaseLink) -> float:
    return SequenceMatcher(None, link.case_a.raw_institution_name.lower(), link.case_b.raw_institution_name.lower()).ratio()


@router.get("/demo/without-with")
def without_with(db: Session = Depends(get_db)) -> dict:
    """Two bureau inboxes with three matching pairs. The demo pair is the prepared complaint against its real RB case;
    the other two are real matches from the data, one with and one without an AICTE ID, picked for the biggest
    difference in spelling. Nothing is invented: every pair is something the matcher finds."""
    demo_rb = db.scalar(select(Case).where(Case.case_id == DEMO_RB_CASE))
    if demo_rb is None:
        raise HTTPException(404, "Demo case not found: reseed the data")
    demo = {k: v for k, v in json.loads((REPO / "data" / "demo_complaint.json").read_text()).items() if not k.startswith("_")}
    incoming = Case(
        id=-1, case_id="New complaint", source_bureau="PGRC", institution_id=None, raw_institution_name=demo["raw_institution_name"],
        raw_address=demo["raw_address"], district=demo["district"], region=demo["region"], category=demo["category"],
        description=demo["description"], status="pending", received_date=demo_rb.received_date)
    scores = score_pair(profile(incoming), profile(demo_rb), TextIndex([incoming, demo_rb]))
    pairs = [{"key": "A", "label": pair_label(scores["match_tier"]), "tier": scores["match_tier"], "strength": scores["final_confidence"]}]
    rb, pg = [card(demo_rb, "A")], [card(incoming, "A", incoming=True)]

    links = [l for l in db.scalars(select(CaseLink).where(CaseLink.status != LinkStatus.rejected.value).order_by(CaseLink.id))
             if {l.case_a.source_bureau, l.case_b.source_bureau} == {Bureau.RB.value, Bureau.PGRC.value}
             and DEMO_RB_CASE not in (l.case_a.case_id, l.case_b.case_id)]
    for tier, key in (("entity", "B"), ("id", "C")):
        pool = sorted((l for l in links if l.scores["match_tier"] == tier), key=lambda l: (name_similarity(l), l.id))
        if pool:
            l = pool[0]
            a, b = (l.case_a, l.case_b) if l.case_a.source_bureau == Bureau.RB.value else (l.case_b, l.case_a)
            rb.append(card(a, key))
            pg.append(card(b, key))
            pairs.append({"key": key, "label": pair_label(tier), "tier": tier, "strength": l.scores["final_confidence"]})

    # Unmatched filler cases: open cases with no link of any kind, so nothing here is hidden from the matcher.
    linked = {cid for l in db.scalars(select(CaseLink)) for cid in (l.case_a_id, l.case_b_id)}
    def fillers(bureau: Bureau) -> list[Case]:
        q = (select(Case).where(Case.source_bureau == bureau.value, Case.status != CaseStatus.disposed.value,
                                Case.institution_id.is_not(None)).order_by(Case.id))
        return [c for c in db.scalars(q) if c.id not in linked][:FILLERS]
    # Interleave so the matching rows sit at different heights on each side and the lines cross.
    rb_order = [rb[0], *fillers(Bureau.RB)[:1], *rb[1:2], *fillers(Bureau.RB)[1:2], *rb[2:], *fillers(Bureau.RB)[2:]]
    pg_fill = [card(c) for c in fillers(Bureau.PGRC)]
    pg_order = [*pg_fill[:1], *pg[1:2], *pg[:1], *pg_fill[1:2], *pg_fill[2:], *pg[2:]]
    return {"rb": [r if isinstance(r, dict) else card(r) for r in rb_order],
            "pgrc": pg_order, "pairs": pairs}


@router.get("/demo/stress-test")
def stress_test(db: Session = Depends(get_db)) -> dict:
    """Runs the real matcher on every name variant (see app/stress.py). Nothing is stored."""
    base = db.scalar(select(Case).where(Case.case_id == stress.CASE_ID))
    if base is None:
        raise HTTPException(404, "Stress-test case not found: reseed the data")
    return stress.run(base)
