import json
from datetime import date, timedelta

from tests.conftest import REPO

DEMO = json.loads((REPO / "data" / "demo_complaint.json").read_text())


def test_escalation_queue_is_admin_only_and_respects_threshold(client, headers):
    assert client.get("/sla/escalations", headers=headers["RB"]).status_code == 403
    default = client.get("/sla/escalations", headers=headers["ADMIN"]).json()
    assert default["min_days_overdue"] == 14 and "not official" in default["note"]
    for c in default["cases"]:
        assert c["status"] not in ("disposed", "escalated")
        assert c["days_overdue"] > 14
    days = [c["days_overdue"] for c in default["cases"]]
    assert days == sorted(days, reverse=True)

    loose = client.get("/sla/escalations?min_days_overdue=0", headers=headers["ADMIN"]).json()["cases"]
    strict = client.get("/sla/escalations?min_days_overdue=100", headers=headers["ADMIN"]).json()["cases"]
    assert len(strict) <= len(default["cases"]) <= len(loose)


def test_escalate_records_event_audit_and_status(client, headers):
    queue = client.get("/sla/escalations", headers=headers["ADMIN"]).json()["cases"]
    target = queue[0]
    assert client.post(f"/cases/{target['id']}/escalate", headers=headers["RB"]).status_code == 403

    r = client.post(f"/cases/{target['id']}/escalate", headers=headers["ADMIN"], json={"remarks": "No reply for months"})
    assert r.status_code == 200 and r.json()["case"]["status"] == "escalated"

    events = client.get(f"/cases/{target['id']}/events", headers=headers["ADMIN"]).json()
    assert events[-1]["action"].startswith("Escalated to senior officer") and events[-1]["remarks"] == "No reply for months"
    log = client.get("/audit?action=case_escalated", headers=headers["ADMIN"]).json()
    assert log[0]["case_refs"] == target["case_id"] and log[0]["remarks"] == "No reply for months"
    assert log[0]["actor_role"] == "ADMIN"

    assert client.post(f"/cases/{target['id']}/escalate", headers=headers["ADMIN"]).status_code == 409
    assert target["id"] not in {c["id"] for c in client.get("/sla/escalations", headers=headers["ADMIN"]).json()["cases"]}

    closed = client.get("/cases?status=disposed", headers=headers["ADMIN"]).json()[0]
    assert client.post(f"/cases/{closed['id']}/escalate", headers=headers["ADMIN"]).status_code == 409


def test_audit_log_records_actions_and_filters(client, headers):
    assert client.get("/audit", headers=headers["PGRC"]).status_code == 403

    new = client.post("/cases", headers=headers["PGRC"], json=DEMO).json()
    link = new["overlap_alerts"][0]
    client.post(f"/links/{link['id']}/reject", headers=headers["RB"], json={"remarks": "Different campus"})

    h = headers["ADMIN"]
    registered = client.get("/audit?action=complaint_registered", headers=h).json()
    assert any(e["case_refs"] == new["case"]["case_id"] and e["actor_name"] == "Demo Grievance Cell Officer" for e in registered)
    rejected = client.get("/audit?action=link_rejected", headers=h).json()
    assert rejected[0]["link_id"] == link["id"] and rejected[0]["remarks"] == "Different campus"
    assert all(e["action"] == "link_rejected" for e in rejected)

    today = date.today()
    assert client.get(f"/audit?date_from={today}&date_to={today}", headers=h).json()
    assert client.get(f"/audit?date_to={today - timedelta(days=1)}", headers=h).json() == []

    # Read-only: no way to change or remove entries.
    assert client.delete("/audit", headers=h).status_code == 405
    assert client.post("/audit", headers=h, json={}).status_code == 405
