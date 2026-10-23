import importlib.util
import json
from types import SimpleNamespace

from sqlalchemy import func, select

from app import stress
from app.db import SessionLocal
from app.matcher import CONFIG, TextIndex, profile, score_pair
from app.models import Case
from tests.conftest import REPO


def test_stress_test_runs_the_real_matcher(client, headers):
    assert client.get("/demo/stress-test").status_code == 401
    with SessionLocal() as db:
        before = db.scalar(select(func.count(Case.id)))
    body = client.get("/demo/stress-test", headers=headers["PGRC"]).json()
    rows, t = body["variants"], body["totals"]
    assert 15 <= len(rows) <= 20 and t["total"] == len(rows) == len(stress.VARIANTS)
    assert body["threshold"] == CONFIG["link_threshold"]
    # Totals are counted from the rows, and each flag agrees with the score.
    for key in ("samanvay", "exact_name", "id_only"):
        assert t[key] == sum(r[key] for r in rows)
    assert all(r["samanvay"] == (r["strength"] >= body["threshold"]) for r in rows)
    assert t["id_only"] == 0  # none of the variants carries an AICTE ID
    assert 0 < t["exact_name"] < t["samanvay"] <= t["total"]
    assert any(not r["district_given"] for r in rows)
    # Failures are reported, not filtered out: every row is present, whatever its score.
    assert [r["name"] for r in rows] == [v[1] for v in stress.VARIANTS]
    with SessionLocal() as db:
        assert db.scalar(select(func.count(Case.id))) == before  # nothing was stored


def test_stress_row_matches_a_direct_matcher_call(client, headers):
    body = client.get("/demo/stress-test", headers=headers["RB"]).json()
    with SessionLocal() as db:
        base = db.scalar(select(Case).where(Case.case_id == stress.CASE_ID))
        what, name, has_district = stress.VARIANTS[6]
        c = stress.throwaway_complaint(base, name, has_district)
        direct = score_pair(profile(c), profile(base), TextIndex([c, base]))["final_confidence"]
    assert body["variants"][6]["strength"] == direct


def test_without_with_has_three_real_pairs(client, headers):
    body = client.get("/demo/without-with", headers=headers["PGRC"]).json()
    assert len(body["pairs"]) == 3
    assert {p["label"] for p in body["pairs"]} <= {"Same AICTE ID", "Matched without AICTE ID"}
    assert {p["label"] for p in body["pairs"]} == {"Same AICTE ID", "Matched without AICTE ID"}
    for side in ("rb", "pgrc"):
        assert 5 <= len(body[side]) <= 7
        assert sorted(c["pair"] for c in body[side] if c["pair"]) == ["A", "B", "C"]
        assert all("complainant_name" not in c for c in body[side])
    by_pair = {k: (next(c for c in body["rb"] if c["pair"] == k), next(c for c in body["pgrc"] if c["pair"] == k)) for k in "ABC"}
    assert all(a["college"] != b["college"] for a, b in by_pair.values())  # spelt differently on each side
    assert by_pair["A"][0]["case_id"] == "RB/2026/0150" and by_pair["A"][1]["incoming"]


def test_baseline_counts_are_computed_from_the_pairs():
    spec = importlib.util.spec_from_file_location("evaluate", REPO / "eval" / "evaluate.py")
    ev = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ev)
    c = lambda inst, name: SimpleNamespace(institution_id=inst, raw_institution_name=name)  # noqa: E731
    row = lambda pos, a, b, conf: {"positive": pos, "a": a, "b": b, "conf": conf}  # noqa: E731
    rows = [
        row(True, c(1, "Sri A College"), c(1, "Sri A College"), 1.0),     # all three find it
        row(True, c(None, "Sri A College."), c(None, "SRI A  college"), 0.9),  # exact name and Samanvay
        row(True, c(None, "S.A. College"), c(None, "Sri A College"), 0.85),    # Samanvay only
        row(True, c(None, "Foo"), c(None, "Bar"), 0.2),                  # nobody
        row(False, c(None, "Sri B College"), c(None, "Sri B College"), 0.1),   # exact-name false positive
        row(False, c(None, "X"), c(None, "Y"), 0.9),                     # Samanvay false positive
    ]
    out = ev.baselines(rows, 0.78)
    assert out["overlaps"] == 4 and out["non_overlap_pairs"] == 2
    assert out["methods"] == {"id_only": {"found": 1, "false_positives": 0},
                              "exact_name": {"found": 2, "false_positives": 1},
                              "samanvay": {"found": 3, "false_positives": 1}}


def test_published_results_include_baselines():
    b = json.loads((REPO / "eval" / "results.json").read_text())["baselines"]["seed42"]
    m = b["all"]["methods"]
    assert b["all"]["overlaps"] == 50 and m["samanvay"]["found"] > m["exact_name"]["found"] > m["id_only"]["found"]
