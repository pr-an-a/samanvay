import os
import tempfile
from pathlib import Path

# Point the app at a throwaway database before anything imports app.db.
_tmp = tempfile.mkdtemp(prefix="samanvay-test-")
os.environ["SAMANVAY_DB"] = f"sqlite:///{_tmp}/test.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import run as seed  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
USER_IDS = {"RB": 1, "PGRC": 2, "REGIONAL": 3, "ADMIN": 4}


@pytest.fixture(scope="session")
def client():
    seed()  # synthetic data + matcher, same as `python -m app.seed`
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def headers(client):
    """headers["PGRC"] -> auth header for the demo PGRC officer, etc."""
    out = {}
    for who, uid in USER_IDS.items():
        token = client.post("/auth/login", json={"user_id": uid}).json()["token"]
        out[who] = {"Authorization": f"Bearer {token}"}
    return out
