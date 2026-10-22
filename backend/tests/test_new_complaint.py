import json

import pytest

from app.matcher import CONFIG
from tests.conftest import REPO

DEMO = json.loads((REPO / "data" / "demo_complaint.json").read_text())
SCORE_KEYS = {"id_match", "name_similarity", "initials_match", "type_match", "address_similarity",
              "district_match", "region_match", "text_similarity", "category_match", "final_confidence", "reasons"}


def other_side(link, case_id):
    return link["case_b"] if link["case_a"]["case_id"] == case_id else link["case_a"]


@pytest.fixture(scope="module")
def demo_response(client, headers):
    r = client.post("/cases", headers=headers["PGRC"], json=DEMO)
    assert r.status_code == 201, r.text
    return r.json()


def test_demo_complaint_raises_overlap_alert(client, headers, demo_response):
    body = demo_response
    case = body["case"]
    assert case["case_id"].startswith("PG-") and case["status"] == "pending"
    assert case["institution_id"] is None  # never auto-merged into the matched institution
    assert body["alert_title"] == "Potential Overlapping Cases – Coordination Required"

    alerts = body["overlap_alerts"]
    assert alerts, "demo complaint should raise an overlap alert"
    top = alerts[0]
    match = other_side(top, case["case_id"])
    assert match["case_id"] == DEMO["_expected_match"]
    assert match["source_bureau"] == "RB" and match["status"] != "disposed"
    assert top["status"] == "suggested"
    assert SCORE_KEYS <= top["scores"].keys()
    assert top["scores"]["final_confidence"] >= CONFIG["link_threshold"]
    assert top["scores"]["reasons"]

    # It shows up first in the review queue, and in both cases' institution timeline only after confirmation.
    queue = client.get("/alerts/overlaps", headers=headers["RB"]).json()
    assert queue[0]["id"] == top["id"]
    events = client.get(f"/cases/{case['id']}/events", headers=headers["PGRC"]).json()
    assert [e["action"] for e in events] == ["Complaint registered"]


def test_confirmed_link_joins_institution_timeline(client, headers, demo_response):
    link = demo_response["overlap_alerts"][0]
    new_case = demo_response["case"]
    rb_case = other_side(link, new_case["case_id"])
    inst_id = rb_case["institution_id"]

    before = client.get(f"/institutions/{inst_id}", headers=headers["ADMIN"]).json()
    assert new_case["id"] not in {c["id"] for c in before["cases"]}  # suggested != merged

    assert client.post(f"/links/{link['id']}/confirm", headers=headers["RB"]).status_code == 200
    reviewed = client.get(f"/links/{link['id']}", headers=headers["PGRC"]).json()
    assert reviewed["status"] == "confirmed" and reviewed["reviewer_name"] == "Demo Regulation Bureau Officer"
    assert reviewed["reviewed_at"]
    after = client.get(f"/institutions/{inst_id}", headers=headers["ADMIN"]).json()
    assert new_case["id"] in {c["id"] for c in after["cases"]}
    stamps = [t["timestamp"] for t in after["timeline"]]
    assert stamps == sorted(stamps)
    linked = [t for t in after["timeline"] if t["case_pk"] == new_case["id"]]
    assert linked and all(t["via_confirmed_link"] for t in linked)
    assert {"RB", "PGRC"} <= {t["case_bureau"] for t in after["timeline"]}


def test_unrelated_complaint_raises_no_alert(client, headers):
    body = dict(DEMO, raw_institution_name="Zorawar Quillfeather Polytechnic of Arts",
                raw_address="Plot No. 9, Orchard Lane, Godavaripet - 111111")
    r = client.post("/cases", headers=headers["PGRC"], json=body)
    assert r.status_code == 201
    assert r.json()["overlap_alerts"] == [] and r.json()["alert_title"] is None


def test_officer_cannot_file_for_another_bureau(client, headers):
    assert client.post("/cases", headers=headers["RB"], json=DEMO).status_code == 403


def test_admin_must_name_bureau_and_inputs_are_validated(client, headers):
    no_bureau = {k: v for k, v in DEMO.items() if k != "source_bureau"}
    assert client.post("/cases", headers=headers["ADMIN"], json=no_bureau).status_code == 422
    assert client.post("/cases", headers=headers["PGRC"], json=dict(DEMO, category="nonsense")).status_code == 422
    assert client.post("/cases", headers=headers["PGRC"], json=dict(DEMO, permanent_id="SYN-0")).status_code == 422
    assert client.post("/cases", json=DEMO).status_code == 401
