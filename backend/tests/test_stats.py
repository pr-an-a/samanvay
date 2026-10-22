import csv
import io
from datetime import date

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Case, CaseLink


def test_stats_are_consistent_with_the_data(client, headers):
    s = client.get("/dashboard/stats", headers=headers["RB"]).json()
    today = date.today()
    with SessionLocal() as db:
        cases = list(db.scalars(select(Case)))
        link_counts = dict(db.execute(select(CaseLink.status, func.count()).group_by(CaseLink.status)).all())
    open_cases = [c for c in cases if c.status != "disposed"]
    overdue = [c for c in open_cases if c.expected_disposal_date < today]

    assert s["total_cases"] == len(cases)
    assert sum(s["by_status"].values()) == len(cases)
    assert s["sla"]["open"] == len(open_cases)
    assert s["sla"]["overdue"] == len(overdue)
    assert s["sla"]["within_sla"] == len(open_cases) - len(overdue)
    assert "not official" in s["sla"]["note"]

    assert list(s["ageing_open"]) == ["0-15", "16-30", "31-60", "60+"]
    assert sum(s["ageing_open"].values()) == len(open_cases)
    assert s["ageing_open"]["0-15"] == sum((today - c.received_date).days <= 15 for c in open_cases)
    assert s["ageing_open"]["60+"] == sum((today - c.received_date).days > 60 for c in open_cases)

    assert {b["bureau"] for b in s["bureau_workload"]} == {"RB", "PGRC", "REGIONAL"}
    assert sum(b["total"] for b in s["bureau_workload"]) == len(cases)
    assert sum(b["overdue"] for b in s["bureau_workload"]) == len(overdue)
    assert sum(r["total"] for r in s["by_region"]) == len(cases)
    assert sum(r["open"] for r in s["by_region"]) == len(open_cases)

    assert s["overlaps"] == {k: link_counts.get(k, 0) for k in ("suggested", "confirmed", "rejected")}


def test_overdue_filter_matches_stats(client, headers):
    s = client.get("/dashboard/stats", headers=headers["ADMIN"]).json()
    assert len(client.get("/cases?overdue=true", headers=headers["ADMIN"]).json()) == s["sla"]["overdue"]


def test_search_filters_and_csv_use_same_filters(client, headers):
    h = headers["ADMIN"]
    one = client.get("/cases", headers=h).json()[5]
    assert [c["case_id"] for c in client.get(f"/cases?q={one['case_id']}", headers=h).json()] == [one["case_id"]]

    rb = client.get("/cases?bureau=RB&status=under_process", headers=h).json()
    assert rb and all(c["source_bureau"] == "RB" and c["status"] == "under_process" for c in rb)

    lo, hi = "2026-03-01", "2026-06-30"
    ranged = client.get(f"/cases?received_from={lo}&received_to={hi}", headers=h).json()
    assert ranged and all(lo <= c["received_date"] <= hi for c in ranged)

    with_id = next(c for c in client.get("/cases", headers=h).json() if c["institution_id"])
    inst = client.get(f"/institutions/{with_id['institution_id']}", headers=h).json()
    by_pid = client.get(f"/cases?permanent_id={inst['permanent_id']}", headers=h).json()
    assert by_pid and all(c["institution_id"] == inst["id"] for c in by_pid)

    query = "region=Southern&category=fee_refund"
    api = client.get(f"/cases?{query}", headers=h).json()
    r = client.get(f"/reports/cases.csv?{query}", headers=h)
    assert r.headers["content-type"].startswith("text/csv")
    rows = list(csv.DictReader(io.StringIO(r.text)))
    assert [row["case_id"] for row in rows] == [c["case_id"] for c in api]


def test_open_filter_and_coordination_list(client, headers):
    h = headers["ADMIN"]
    s = client.get("/dashboard/stats", headers=h).json()
    assert len(client.get("/cases?open=true", headers=h).json()) == s["sla"]["open"]
    assert s["coordinated_this_month"] <= s["overlaps"]["confirmed"]

    items = client.get("/dashboard/coordination?limit=50", headers=h).json()
    assert items
    for it in items:
        assert it["status"] != "rejected"
        assert len({c["source_bureau"] for c in it["cases"]}) == 2
        assert all(c["status"] != "disposed" for c in it["cases"])
    needs_check = [it["status"] == "suggested" for it in items]
    assert needs_check == sorted(needs_check, reverse=True)  # needs-check items first
