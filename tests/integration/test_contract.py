"""Frontend M1-B payloads against an isolated in-process FastAPI test backend.

Run from the adjacent Backend directory with its virtual environment:
.venv/bin/pytest ../FrontEnd/tests/integration/test_contract.py -q
"""
import os
import sys
import tempfile
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[3] / "Backend"
sys.path.insert(0, str(BACKEND))
_database = tempfile.NamedTemporaryFile(prefix="aroman-frontend-contract-", suffix=".db", delete=False)
_database.close()
os.environ.update({
    "DATABASE_URL": f"sqlite:///{_database.name}",
    "OTP_PEPPER": "frontend-test-otp-pepper-aaaaaaaaaaaaaaaaaaaa",
    "SESSION_PEPPER": "frontend-test-session-pepper-bbbbbbbbbbbbbbb",
    "ENVIRONMENT": "test", "SMS_PROVIDER": "fake", "FAKE_SMS_ENABLED": "true",
    "COOKIE_SECURE": "false",
})

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402
from aroman.authentication.sms import FakeSMS, get_sms_provider  # noqa: E402
from aroman.core.db import get_engine  # noqa: E402
from aroman.main import app  # noqa: E402
from aroman.seed import seed  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def backend():
    config = Config(str(BACKEND / "alembic.ini"))
    command.upgrade(config, "head")
    with Session(get_engine()) as db:
        seed(db)
    yield
    command.downgrade(config, "base")
    os.unlink(_database.name)


def test_m1b_save_reopen_edit_duplicate_delete_contract():
    with TestClient(app) as client:
        notes = client.get("/api/v1/fragrance-notes", params={"limit": 2}).json()
        assert len(notes) == 2
        assert client.get("/api/v1/fragrance-concepts").status_code == 401
        mobile = "۰۹۱۲۳۴۵۶۷۸۹"
        assert client.post("/api/v1/auth/challenges", json={"mobile": mobile}).status_code == 202
        provider = get_sms_provider()
        assert isinstance(provider, FakeSMS)
        code = provider.messages[-1][1]
        verified = client.post("/api/v1/auth/verify", json={"mobile": mobile, "code": code})
        assert verified.status_code == 200
        assert client.get("/api/v1/auth/session").status_code == 200
        csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
        assert csrf != verified.json()["csrf_token"]
        payload = {"name": "باغ من", "notes": [
            {"note_id": notes[0]["id"], "layer": "top", "position": 0},
            {"note_id": notes[1]["id"], "layer": "heart", "position": 0},
        ]}
        headers = {"X-CSRF-Token": csrf}
        created = client.post("/api/v1/fragrance-concepts", json=payload, headers=headers)
        assert created.status_code == 201
        concept_id = created.json()["id"]
        reopened = client.get(f"/api/v1/fragrance-concepts/{concept_id}")
        assert reopened.json()["name"] == payload["name"]
        assert len(reopened.json()["notes"]) == 2
        payload["name"] = "باغ تازه"
        updated = client.put(f"/api/v1/fragrance-concepts/{concept_id}", json=payload, headers=headers)
        assert updated.status_code == 200
        assert client.get(f"/api/v1/fragrance-concepts/{concept_id}").json()["name"] == "باغ تازه"
        copied = client.post(f"/api/v1/fragrance-concepts/{concept_id}/duplicate", headers=headers)
        assert copied.status_code == 201
        assert copied.json()["id"] != concept_id
        assert client.delete(f"/api/v1/fragrance-concepts/{copied.json()['id']}", headers=headers).status_code == 204
        assert client.get(f"/api/v1/fragrance-concepts/{copied.json()['id']}").status_code == 404
