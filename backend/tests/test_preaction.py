import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.clash import CONFIG, Linked, Move, check_action, kind_of
from app.db import SessionLocal
from app.models import Case, CaseEvent
from tests.conftest import REPO

DEMO = json.loads((REPO / "data" / "demo_complaint.json").read_text())
NOW = datetime(2026, 10, 23, 12, 0)
PG_DEMO = "PG-2026-00169"  # the seeded demo college: the Regulation Bureau asked for documents 6 days ago


# --- the rules, alone ---

def move(kind, days_ago, bureau="RB", asking=None):
    return Move(kind, bureau, "Officer", kind or "x", asking, NOW - timedelta(days=days_ago), "RB/1")


def linked(*moves, bureau="RB", is_open=True, status="under_process"):
    return Linked("RB/1", 1, 7, bureau, is_open, status, list(moves))


def types(clashes):
    return [c["type"] for c in clashes]


def test_duplicate_effort_within_the_window_only():
    inside = check_action("seek_reply", "lab report", None, [linked(move("request_documents", 6, asking="Lab report and list"))], NOW, NOW)
    assert types(inside) == ["duplicate_effort"] and inside[0]["other"]["days_ago"] == 6
    assert "asked for much the same" in inside[0]["explanation"]
    assert not check_action("seek_reply", "x", None, [linked(move("seek_reply", CONFIG["duplicate_days"] + 1))], NOW, NOW)
    assert check_action("seek_reply", "x", None, [linked(move("seek_reply", CONFIG["duplicate_days"]))], NOW, NOW)  # edge: inside


def test_duplicate_effort_needs_the_same_kind_of_move():
    other = [linked(move("show_cause", 3))]
    assert not check_action("seek_reply", "x", None, other, NOW, NOW)  # a notice is not a request
    assert types(check_action("show_cause", "x", None, other, NOW, NOW)) == ["duplicate_effort"]
    assert not check_action("close_case", None, None, [linked(move("seek_reply", 1))], NOW, NOW)


def test_closing_conflicts_with_escalation_or_show_cause():
    assert types(check_action("close_case", None, None, [linked(move("show_cause", 5))], NOW, NOW)) == ["conflicting_action"]
    assert types(check_action("close_case", None, None, [linked(move("escalate", 5))], NOW, NOW)) == ["conflicting_action"]
    assert types(check_action("close_case", None, None, [linked(status="escalated")], NOW, NOW)) == ["conflicting_action"]
    assert not check_action("close_case", None, None, [linked(move("show_cause", CONFIG["conflict_days"] + 1))], NOW, NOW)
    assert not check_action("close_case", None, None, [linked(move("show_cause", 5), is_open=False)], NOW, NOW)  # theirs is closed
    assert not check_action("seek_reply", "x", None, [linked(move("escalate", 5))], NOW, NOW)  # only closing conflicts


def test_transfer_to_a_bureau_already_handling_the_college():
    here = [linked(move(None, 40), bureau="RB")]
    c = check_action("transfer", None, "RB", here, NOW, NOW)
    assert types(c) == ["conflicting_action"] and "already has case" in c[0]["explanation"]
    assert not check_action("transfer", None, "REGIONAL", here, NOW, NOW)
    assert not check_action("transfer", None, "RB", [linked(bureau="RB", is_open=False)], NOW, NOW)


def test_waiting_on_each_other_needs_both_cases_quiet():
    quiet = CONFIG["idle_days"]
    both = check_action("seek_reply", "x", None, [linked(move(None, quiet + 9))], NOW - timedelta(days=quiet + 1), NOW)
    assert types(both) == ["waiting_on_each_other"]
    assert not check_action("seek_reply", "x", None, [linked(move(None, quiet + 9))], NOW - timedelta(days=2), NOW)  # mine is active
    assert not check_action("seek_reply", "x", None, [linked(move(None, 2))], NOW - timedelta(days=quiet + 1), NOW)  # theirs is active
    assert not check_action("seek_reply", "x", None, [linked()], NOW - timedelta(days=quiet + 1), NOW)  # they have no record at all


def test_no_linked_cases_means_no_clash_and_order_is_most_serious_first():
    assert check_action("close_case", None, None, [], NOW, NOW) == []
    many = [linked(move("request_documents", 3)), linked(move("show_cause", 3))]
    assert types(check_action("close_case", None, None, many, NOW, NOW)) == ["conflicting_action"]


def test_kind_is_read_from_older_free_text():
    assert kind_of("Reply sought from institution") == "seek_reply"
    assert kind_of("Notice issued to institution") == "show_cause"
    assert kind_of("Transferred to RB") == "transfer" and kind_of("Disposed: institution complied") == "close_case"
    assert kind_of("Complaint registered") is None and kind_of("Anything", "escalate") == "escalate"


# --- through the API, on the seeded demo college ---

def act(client, headers, who, case_pk, **body):
    return client.post(f"/cases/{case_pk}/actions/check", headers=headers[who], json=body)


@pytest.fixture(scope="module")
def pg_pk(client, headers):
    return client.get(f"/cases?q={PG_DEMO}", headers=headers["PGRC"]).json()[0]["id"]


def test_check_finds_the_seeded_duplicate_and_saves_nothing(client, headers, pg_pk):
    before = len(client.get(f"/cases/{pg_pk}/events", headers=headers["PGRC"]).json())
    r = act(client, headers, "PGRC", pg_pk, kind="seek_reply", asking_for="Register of original certificates held and the reason")
    body = r.json()
    assert r.status_code == 200 and types(body["clashes"]) == ["duplicate_effort"]
    other = body["clashes"][0]["other"]
    assert other["bureau"] == "RB" and other["days_ago"] == 6 and "certificates" in other["asking_for"]
    assert body["checked"] == [{"case_id": "RB/2026/0138", "bureau": "RB"}]
    assert len(client.get(f"/cases/{pg_pk}/events", headers=headers["PGRC"]).json()) == before


def test_check_permissions_and_validation(client, headers, pg_pk):
    assert act(client, headers, "RB", pg_pk, kind="seek_reply", asking_for="x y z").status_code == 403  # not their case
    assert act(client, headers, "REGIONAL", pg_pk, kind="close_case").status_code == 403
    assert act(client, headers, "ADMIN", pg_pk, kind="close_case").status_code == 200
    assert act(client, headers, "PGRC", pg_pk, kind="seek_reply").status_code == 422  # must say what is asked
    assert act(client, headers, "PGRC", pg_pk, kind="bogus").status_code == 422
    assert act(client, headers, "PGRC", pg_pk, kind="transfer").status_code == 422  # needs a bureau
    assert act(client, headers, "PGRC", pg_pk, kind="transfer", transfer_to="PGRC").status_code == 422
    assert client.post(f"/cases/{pg_pk}/actions/check", json={"kind": "close_case"}).status_code == 401


def test_coordinating_posts_a_note_rings_the_bell_and_is_audited(client, headers, pg_pk):
    clash = act(client, headers, "PGRC", pg_pk, kind="seek_reply", asking_for="Lab report").json()["clashes"][0]
    n_before = len([i for i in client.get("/notifications", headers=headers["RB"]).json()["items"] if i["kind"] == "note"])
    r = client.post(f"/cases/{pg_pk}/actions/coordinate", headers=headers["PGRC"],
                    json={"link_id": clash["other"]["link_id"], "body": "You asked for the same report. Shall we share it?", "kind": "seek_reply"})
    assert r.status_code == 201 and r.json()["bureau"] == "PGRC"
    notes = [i for i in client.get("/notifications", headers=headers["RB"]).json()["items"] if i["kind"] == "note"]
    assert len(notes) == n_before + 1 and notes[0]["message"].startswith("Grievance Cell left a note on ")
    log = client.get("/audit?action=clash_prevented", headers=headers["ADMIN"]).json()
    assert log and log[0]["actor_name"] == "Priya Nair" and "coordinated with the Regulation Bureau" in log[0]["summary"]
    # the action itself was not sent
    assert not [e for e in client.get(f"/cases/{pg_pk}/events", headers=headers["PGRC"]).json() if e["kind"] == "seek_reply"]
    # the other bureau's inbox now has a note waiting for a reply; ours records the clash that was prevented
    link_id = clash["other"]["link_id"]
    tasks = lambda who: {t["kind"] for t in client.get("/inbox", headers=headers[who]).json()["tasks"] if t["link_id"] == link_id}  # noqa: E731
    assert "note_waiting" in tasks("RB") and "note_waiting" not in tasks("PGRC") and "clash_prevented" in tasks("PGRC")
    assert client.post(f"/cases/{pg_pk}/actions/coordinate", headers=headers["REGIONAL"],
                       json={"link_id": clash["other"]["link_id"], "body": "hi", "kind": "seek_reply"}).status_code == 403


def test_sending_over_a_clash_needs_a_reason_and_is_audited(client, headers, pg_pk):
    body = {"kind": "seek_reply", "asking_for": "Register of original certificates held"}
    r = client.post(f"/cases/{pg_pk}/actions", headers=headers["PGRC"], json=body)
    assert r.status_code == 409 and r.json()["detail"]["clashes"][0]["type"] == "duplicate_effort"
    assert client.post(f"/cases/{pg_pk}/actions", headers=headers["PGRC"], json={**body, "override_reason": "no"}).status_code == 409
    assert not [e for e in client.get(f"/cases/{pg_pk}/events", headers=headers["PGRC"]).json() if e["kind"] == "seek_reply"]

    r = client.post(f"/cases/{pg_pk}/actions", headers=headers["PGRC"],
                    json={**body, "override_reason": "The college has not answered us since 1 October"})
    assert r.status_code == 201 and r.json()["event"]["kind"] == "seek_reply"
    assert r.json()["case"]["last_action"] == "Reply sought from institution"
    audit = client.get("/audit", headers=headers["ADMIN"]).json()
    over = next(e for e in audit if e["action"] == "action_overridden")
    assert over["remarks"] == "The college has not answered us since 1 October" and over["actor_role"] == "PGRC_OFFICER"
    assert any(e["action"] == "action_taken" and e["case_refs"] == PG_DEMO for e in audit)


def test_clash_free_action_is_saved_straight_away(client, headers):
    rb_pk = client.get("/cases?q=RB/2026/0138", headers=headers["RB"]).json()[0]["id"]
    r = client.post(f"/cases/{rb_pk}/actions", headers=headers["RB"], json={"kind": "show_cause", "asking_for": "Explanation for withholding certificates"})
    assert r.status_code == 201 and r.json()["clashes"] == []


def test_closing_or_transferring_clashes_with_the_other_bureau(client, headers, pg_pk):
    close = act(client, headers, "PGRC", pg_pk, kind="close_case").json()  # RB issued a show-cause notice just now
    assert types(close["clashes"]) == ["conflicting_action"]
    assert "show-cause notice" in close["clashes"][0]["explanation"]
    move_ = act(client, headers, "PGRC", pg_pk, kind="transfer", transfer_to="RB").json()
    assert "conflicting_action" in types(move_["clashes"])
    assert "conflicting_action" not in types(act(client, headers, "PGRC", pg_pk, kind="transfer", transfer_to="REGIONAL").json()["clashes"])


def test_waiting_on_each_other_through_the_api(client, headers):
    new = client.post("/cases", headers=headers["PGRC"], json=DEMO).json()
    link = new["overlap_alerts"][0]
    client.post(f"/links/{link['id']}/confirm", headers=headers["RB"])
    pks = [link["case_a"]["id"], link["case_b"]["id"]]
    with SessionLocal() as db:  # make both cases quiet: every event 40 days old
        for e in db.scalars(select(CaseEvent).where(CaseEvent.case_id.in_(pks))):
            e.timestamp = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=40)
        db.commit()
    mine = new["case"]["id"]
    r = act(client, headers, "PGRC", mine, kind="seek_reply", asking_for="Anti-ragging committee report")
    assert types(r.json()["clashes"]) == ["waiting_on_each_other"]
    assert "40" in r.json()["clashes"][0]["explanation"]


def test_inbox_lists_new_matches_and_only_the_users_bureau(client, headers):
    pg = client.get("/inbox", headers=headers["PGRC"]).json()
    assert pg["counts"]["new_match"] > 0 and any(t["kind"] == "new_match" for t in pg["tasks"])
    prio = [t["priority"] for t in pg["tasks"]]
    assert prio == sorted(prio)
    reg = client.get("/inbox", headers=headers["REGIONAL"]).json()
    assert all("REGIONAL" in t["bureaus"] for t in reg["tasks"])
    assert client.get("/inbox").status_code == 401


def test_inbox_new_matches_are_varied_and_explained(client, headers):
    rows = [t for t in client.get("/inbox", headers=headers["ADMIN"]).json()["tasks"] if t["kind"] == "new_match"]
    assert len(rows) >= 3
    first = rows[:2]
    assert {t["tier"] for t in first} == {"entity", "id"}  # one of each kind first, not look-alikes
    assert all(t["names"][0] != t["names"][1] for t in first)  # the picked ones are written differently
    for t in rows:
        assert t["detail"].endswith(".") and 0 < t["strength"] <= 1
    assert len({t["detail"] for t in rows}) > 1
