import csv
import io

from app.privacy import mask_name


def test_mask_name():
    assert mask_name("Ravi Kumar") == "R*** K***"
    assert mask_name("Asha") == "A***"
    assert mask_name(None) is None


def named_case(client, headers, bureau):
    cases = client.get(f"/cases?bureau={bureau}", headers=headers["ADMIN"]).json()
    return next(c for c in cases if c["complainant_name"])


def test_other_bureau_sees_masked_own_bureau_sees_full(client, headers):
    rb = named_case(client, headers, "RB")
    as_pgrc = client.get(f"/cases/{rb['id']}", headers=headers["PGRC"]).json()
    assert as_pgrc["complainant_name"] == mask_name(rb["complainant_name"])
    assert as_pgrc["complainant_masked"] is True

    as_rb = client.get(f"/cases/{rb['id']}", headers=headers["RB"]).json()
    assert as_rb["complainant_name"] == rb["complainant_name"] and as_rb["complainant_masked"] is False


def test_admin_sees_full_names(client, headers):
    for bureau in ("RB", "PGRC", "REGIONAL"):
        cases = client.get(f"/cases?bureau={bureau}", headers=headers["ADMIN"]).json()
        assert not any(c["complainant_masked"] for c in cases)
        assert not any(c["complainant_name"] and "***" in c["complainant_name"] for c in cases)


def test_list_masks_exactly_the_other_bureaus(client, headers):
    for c in client.get("/cases", headers=headers["REGIONAL"]).json():
        if c["complainant_name"]:
            assert c["complainant_masked"] == (c["source_bureau"] != "REGIONAL")


def test_masking_applies_to_alerts_and_csv(client, headers):
    for link in client.get("/alerts/overlaps", headers=headers["PGRC"]).json():
        for side in (link["case_a"], link["case_b"]):
            if side["complainant_name"] and side["source_bureau"] != "PGRC":
                assert side["complainant_masked"] and side["complainant_name"].endswith("***")

    rows = list(csv.DictReader(io.StringIO(client.get("/reports/cases.csv?bureau=RB", headers=headers["PGRC"]).text)))
    assert rows and all(not r["complainant_name"] or r["complainant_name"].endswith("***") for r in rows)
