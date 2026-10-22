import json

import pytest
from sqlalchemy import func, select

from app.db import SessionLocal
from app.models import Case
from tests.conftest import REPO

DEMO = json.loads((REPO / "data" / "demo_complaint.json").read_text())


def case_count() -> int:
    with SessionLocal() as db:
        return db.scalar(select(func.count(Case.id)))


def login(client, user_id: int) -> dict:
    token = client.post("/auth/login", json={"user_id": user_id}).json()["token"]
    return {"Authorization": f"Bearer {token}"}


def test_same_user_can_have_several_sessions(client):
    laptop_a, laptop_b = login(client, 2), login(client, 2)
    assert laptop_a != laptop_b
    # Signing in on laptop B must not sign laptop A out.
    for h in (laptop_a, laptop_b, laptop_a):
        r = client.get("/auth/me", headers=h)
        assert r.status_code == 200 and r.json()["role"] == "PGRC_OFFICER"


def test_rejected_sign_in_stores_nothing(client):
    before = case_count()
    r = client.post("/cases", headers={"Authorization": "Bearer not-a-real-token"}, json=DEMO)
    assert r.status_code == 401
    assert case_count() == before


def test_failed_matching_leaves_no_half_saved_case(client, monkeypatch):
    def boom(*args, **kwargs):
        raise RuntimeError("matcher crashed")

    monkeypatch.setattr("app.routers.cases.match_case", boom)
    before = case_count()
    with pytest.raises(RuntimeError):
        client.post("/cases", headers=login(client, 2), json=DEMO)
    assert case_count() == before
