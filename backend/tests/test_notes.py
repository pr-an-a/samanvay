import json
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.summary import college_summary
from tests.conftest import REPO

DEMO = json.loads((REPO / "data" / "demo_complaint.json").read_text())
TODAY = date(2026, 10, 23)


@pytest.fixture(scope="module")
def confirmed(client, headers):
    """A freshly registered Grievance Cell complaint, confirmed as the same college as an RB case."""
    new = client.post("/cases", headers=headers["PGRC"], json=DEMO).json()
    link = new["overlap_alerts"][0]
    assert client.post(f"/links/{link['id']}/confirm", headers=headers["RB"]).status_code == 200
    bureaus = {link["case_a"]["source_bureau"], link["case_b"]["source_bureau"]}
    assert bureaus == {"RB", "PGRC"}
    return link


def post(client, headers, who, link_id, body="Show-cause notice issued. Please hold your reply."):
    return client.post(f"/links/{link_id}/notes", headers=headers[who], json={"body": body})


def test_notes_need_a_confirmed_match(client, headers):
    suggested = client.get("/links?status=suggested", headers=headers["RB"]).json()[0]
    assert post(client, headers, "RB", suggested["id"]).status_code == 409
    assert client.get(f"/links/{suggested['id']}/notes", headers=headers["RB"]).json() == []


def test_only_involved_bureaus_and_admin_can_post(client, headers, confirmed):
    assert post(client, headers, "REGIONAL", confirmed["id"]).status_code == 403
    assert client.post(f"/links/{confirmed['id']}/notes", json={"body": "x"}).status_code == 401
    for who in ("RB", "PGRC", "ADMIN"):
        r = post(client, headers, who, confirmed["id"], f"Note from {who}")
        assert r.status_code == 201, r.text
    notes = client.get(f"/links/{confirmed['id']}/notes", headers=headers["REGIONAL"]).json()  # anyone can read
    assert [n["bureau"] for n in notes][-3:] == ["RB", "PGRC", "ADMIN"]
    assert notes[-3]["author"] == "Arjun Mehta"


def test_note_validation_and_append_only(client, headers, confirmed):
    assert post(client, headers, "RB", confirmed["id"], "   ").status_code == 422
    assert post(client, headers, "RB", confirmed["id"], "x" * 501).status_code == 422
    note = post(client, headers, "RB", confirmed["id"], "  trimmed  ").json()
    assert note["body"] == "trimmed"
    url = f"/links/{confirmed['id']}/notes/{note['id']}"
    for method in ("put", "patch", "delete"):
        assert getattr(client, method)(url, headers=headers["ADMIN"]).status_code in (404, 405)
    assert client.delete(f"/links/{confirmed['id']}/notes", headers=headers["ADMIN"]).status_code == 405


def bell(client, headers, who):
    return [i for i in client.get("/notifications", headers=headers[who]).json()["items"] if i["kind"] == "note"]


def test_note_rings_the_other_bureaus_bell_only(client, headers, confirmed):
    client.post("/notifications/seen", headers=headers["RB"])
    before = {who: len(bell(client, headers, who)) for who in ("RB", "PGRC", "REGIONAL")}
    assert post(client, headers, "PGRC", confirmed["id"]).status_code == 201
    after = {who: bell(client, headers, who) for who in ("RB", "PGRC", "REGIONAL")}
    assert len(after["RB"]) == before["RB"] + 1
    assert len(after["PGRC"]) == before["PGRC"]  # the author is not alerted
    assert len(after["REGIONAL"]) == before["REGIONAL"]
    item = after["RB"][0]
    assert item["message"].startswith("Grievance Cell left a note on ") and item["new"]
    assert item["link_id"] == confirmed["id"] and item["bureau"] == "RB"
    assert client.get("/notifications", headers=headers["RB"]).json()["unseen"] >= 1


def test_admin_note_rings_both_bureaus(client, headers, confirmed):
    n_rb, n_pg = len(bell(client, headers, "RB")), len(bell(client, headers, "PGRC"))
    assert post(client, headers, "ADMIN", confirmed["id"]).status_code == 201
    assert len(bell(client, headers, "RB")) == n_rb + 1 and len(bell(client, headers, "PGRC")) == n_pg + 1
    assert bell(client, headers, "RB")[0]["message"].startswith("Administrator left a note on ")


def test_note_is_audited(client, headers, confirmed):
    post(client, headers, "RB", confirmed["id"], "Audit me")
    entry = client.get("/audit?action=note_posted", headers=headers["ADMIN"]).json()[0]
    assert entry["actor_name"] == "Arjun Mehta" and entry["remarks"] == "Audit me" and entry["link_id"] == confirmed["id"]


def test_college_page_shows_notes_and_summary(client, headers, confirmed):
    inst_id = confirmed["case_a"]["institution_id"] or confirmed["case_b"]["institution_id"]
    page = client.get(f"/institutions/{inst_id}", headers=headers["PGRC"]).json()
    assert page["notes"] and {n["link_id"] for n in page["notes"]} == {confirmed["id"]}
    assert page["summary"].startswith("2 bureaus involved · ") and page["summary"].endswith(".")


# --- summary template edge cases (pure function) ---

def case(bureau="RB", status="under_process", days_ago=10):
    return SimpleNamespace(source_bureau=bureau, status=status, received_date=TODAY - timedelta(days=days_ago))


def at(day, hour=9):
    return datetime(2026, 10, day, hour, tzinfo=timezone.utc)


def test_summary_full_sentence():
    cases = [case("RB", days_ago=41), case("PGRC", days_ago=5), case("RB", "disposed", 90), case("PGRC", days_ago=2)]
    events = [(at(1), "Complaint registered", "RB"), (at(8), "Show-cause notice", "RB")]
    assert college_summary(cases, events, TODAY) == (
        "2 bureaus involved · 3 open cases · oldest open 41 days · last action: show-cause notice by Regulation Bureau, 8 Oct.")


def test_summary_one_bureau_one_case_singulars():
    assert college_summary([case("PGRC", days_ago=1)], [(at(22), "Complaint registered", "PGRC")], TODAY) == (
        "1 bureau involved · 1 open case · oldest open 1 day · last action: complaint registered by Grievance Cell, 22 Oct.")
    assert "oldest open today" in college_summary([case(days_ago=0)], [], TODAY)


def test_summary_no_open_cases():
    s = college_summary([case("RB", "disposed", 30), case("PGRC", "disposed", 20)], [(at(5), "Disposed: fee refunded", "RB")], TODAY)
    assert s == "2 bureaus involved · no open cases · last action: closed: fee refunded by Regulation Bureau, 5 Oct."


def test_summary_no_actions_yet():
    assert college_summary([case()], [], TODAY) == "1 bureau involved · 1 open case · oldest open 10 days · no actions yet."


def test_summary_no_cases_and_plain_wording():
    assert college_summary([], [], TODAY) == "No cases on this college yet."
    s = college_summary([case()], [(at(3), "Overlap with PG-2026-00201 confirmed", "ADMIN")], TODAY)
    assert s.endswith("last action: match with case PG-2026-00201 confirmed by Administrator, 3 Oct.")
    s = college_summary([case()], [(at(3), "Transferred to RB", "PGRC")], TODAY)
    assert "transferred to Regulation Bureau by Grievance Cell" in s
    assert "3 Oct 2025" in college_summary([case()], [(datetime(2025, 10, 3, tzinfo=timezone.utc), "Notice", "RB")], TODAY)
