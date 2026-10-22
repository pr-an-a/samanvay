"""Demo helpers for the frontend: the prepared demo complaint and the matcher evaluation summary."""

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user

router = APIRouter(tags=["demo"], dependencies=[Depends(get_current_user)])
REPO = Path(__file__).resolve().parents[3]


def read_json(path: Path) -> dict:
    if not path.exists():
        raise HTTPException(404, f"{path.name} not found")
    return json.loads(path.read_text())


@router.get("/demo/complaint")
def demo_complaint() -> dict:
    """data/demo_complaint.json, minus the _note/_expected_match annotations."""
    return {k: v for k, v in read_json(REPO / "data" / "demo_complaint.json").items() if not k.startswith("_")}


@router.get("/eval/results")
def eval_results() -> dict:
    """eval/results.json, built by eval/build_results.py."""
    return read_json(REPO / "eval" / "results.json")
