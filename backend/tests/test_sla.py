from datetime import date, timedelta

from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Alert, Case, SLARule
from app.sla import run_sla_check, sla_state

TODAY = date(2026, 10, 22)


def case(status="under_process", due_in=None):
    return Case(status=status, expected_disposal_date=None if due_in is None else TODAY + timedelta(days=due_in))


def test_sla_state_rules():
    assert sla_state(case(due_in=-1), TODAY, 3) == "overdue"
    assert sla_state(case(due_in=-90), TODAY, 3) == "overdue"
    assert sla_state(case(due_in=0), TODAY, 3) == "due_soon"  # due today is not yet overdue
    assert sla_state(case(due_in=3), TODAY, 3) == "due_soon"  # edge of the window
    assert sla_state(case(due_in=4), TODAY, 3) is None
    assert sla_state(case(status="disposed", due_in=-10), TODAY, 3) is None  # closed cases are never flagged
    assert sla_state(case(status="escalated", due_in=-10), TODAY, 3) == "overdue"
    assert sla_state(case(due_in=None), TODAY, 3) is None


def test_check_flags_cases_and_alerts_only_once(client):
    with SessionLocal() as db:
        first = run_sla_check(db)
        open_cases = [c for c in db.scalars(select(Case)) if c.status != "disposed"]
        assert first["checked"] == len(open_cases)
        assert first["overdue"] == sum(c.expected_disposal_date < date.today() for c in open_cases)
        assert all(c.sla_state == sla_state(c, date.today()) for c in open_cases)
        alerts = db.scalar(select(func.count(Alert.id)).where(Alert.kind.in_(["due_soon", "overdue"])))

        second = run_sla_check(db)
        assert second["new_alerts"] == 0  # nothing changed, so no duplicate alerts
        assert db.scalar(select(func.count(Alert.id)).where(Alert.kind.in_(["due_soon", "overdue"]))) == alerts


def test_check_uses_the_configurable_sla_rules(client):
    with SessionLocal() as db:
        run_sla_check(db)
        rule = db.scalar(select(SLARule).where(SLARule.bureau == "RB", SLARule.category == "fee_refund"))
        target = db.scalar(select(Case).where(Case.source_bureau == "RB", Case.category == "fee_refund",
                                              Case.status != "disposed"))
        original = rule.days
        try:
            rule.days = 1000  # a demo setting change: nothing in this group should be overdue now
            db.commit()
            run_sla_check(db)
            db.refresh(target)
            assert target.expected_disposal_date == target.received_date + timedelta(days=1000)
            assert target.sla_state is None
        finally:
            rule.days = original
            db.commit()
            run_sla_check(db)


def test_new_overdue_case_rings_only_its_own_bureau(client, headers):
    for who in ("PGRC", "RB"):
        client.post("/notifications/seen", headers=headers[who])
    with SessionLocal() as db:
        c = db.scalar(select(Case).where(Case.source_bureau == "PGRC", Case.status != "disposed", Case.sla_state.is_(None)))
        c.received_date -= timedelta(days=400)  # push it well past its due date
        db.commit()
        pk = c.id
    r = client.post("/sla/check", headers=headers["PGRC"])
    assert r.status_code == 200 and r.json()["new_alerts"] >= 1 and "not official" in r.json()["note"]

    mine = client.get("/notifications", headers=headers["PGRC"]).json()
    assert mine["unseen"] >= 1
    assert any(i["case_pk"] == pk and i["kind"] == "overdue" and i["new"] for i in mine["items"])
    theirs = client.get("/notifications", headers=headers["RB"]).json()
    assert not any(i["case_pk"] == pk for i in theirs["items"])

    client.post("/notifications/seen", headers=headers["PGRC"])
    assert client.get("/notifications", headers=headers["PGRC"]).json()["unseen"] == 0


def test_background_job_is_scheduled_and_runs(client, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app, scheduled_sla_check
    from app.sla import last_check

    monkeypatch.setenv("SAMANVAY_SCHEDULER", "1")
    with TestClient(app):
        job = app.state.scheduler.get_job("sla_check")
        assert job is not None and job.trigger.interval.total_seconds() == 5 * 60
    last_check["at"] = None
    scheduled_sla_check()  # what the scheduler calls every few minutes
    assert last_check["at"] is not None and last_check["result"]["checked"] > 0
