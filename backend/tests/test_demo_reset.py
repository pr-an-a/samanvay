from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import AuditLog, Case, CaseLink


def counts():
    with SessionLocal() as db:
        return (db.scalar(select(func.count(Case.id))), db.scalar(select(func.count(CaseLink.id))),
                db.scalar(select(func.count(AuditLog.id))))


def test_reset_only_for_admin_in_demo_mode(client, headers, monkeypatch):
    monkeypatch.setenv("SAMANVAY_DEMO", "0")
    assert client.post("/demo/reset", headers=headers["ADMIN"]).status_code == 403  # not in demo mode
    monkeypatch.setenv("SAMANVAY_DEMO", "1")
    assert client.post("/demo/reset", headers=headers["PGRC"]).status_code == 403  # not an admin
    assert client.get("/sla/settings", headers=headers["PGRC"]).json()["demo_mode"] is True


def test_reset_restores_demo_data_and_keeps_everyone_signed_in(client, headers, monkeypatch):
    monkeypatch.setenv("SAMANVAY_DEMO", "1")
    # Make some changes a rehearsal would leave behind.
    client.post("/sla/check", headers=headers["RB"])
    escalate = client.get("/sla/escalations", headers=headers["ADMIN"]).json()["cases"][0]
    client.post(f"/cases/{escalate['id']}/escalate", headers=headers["ADMIN"])
    assert counts()[2] > 0

    r = client.post("/demo/reset", headers=headers["ADMIN"])
    assert r.status_code == 200 and r.json()["sessions_kept"] >= 4
    assert counts() == (500, 50, 1)  # seeded cases and matches; the audit log holds only the demo college's back-story
    assert client.get(f"/cases/{escalate['id']}", headers=headers["ADMIN"]).json()["status"] != "escalated"
    assert client.get("/sla/settings", headers=headers["ADMIN"]).json()["last_check"] is None

    # Every earlier sign-in still works, as the same demo role.
    for who, role in (("RB", "RB_OFFICER"), ("PGRC", "PGRC_OFFICER"), ("REGIONAL", "REGIONAL"), ("ADMIN", "ADMIN")):
        me = client.get("/auth/me", headers=headers[who])
        assert me.status_code == 200 and me.json()["role"] == role
