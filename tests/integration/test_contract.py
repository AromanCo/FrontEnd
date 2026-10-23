"""Frontend M1-B payloads against an isolated in-process FastAPI test backend.

Run from the adjacent Backend directory with its virtual environment:
.venv/bin/pytest ../FrontEnd/tests/integration/test_contract.py -q
"""
import os
import sys
import tempfile
from http.cookies import SimpleCookie
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


def _is_nonempty(value):
    return isinstance(value, str) and bool(value)


def _are_distinct(first, second):
    return first != second


def _body_excludes_secret(body, secret):
    return secret not in body


def _client_has_session_cookie(client):
    try:
        return bool(client.cookies.get("aroman_session"))
    except KeyError:
        return False


def test_m2_auth_login_session_logout_contract():
    origin = "http://localhost:3000"
    mobile = "09127776655"
    normalized_mobile = "+989127776655"
    provider = get_sms_provider()
    assert isinstance(provider, FakeSMS)
    previous_message_count = len(provider.messages)

    with TestClient(app) as client:
        assert client.get("/api/v1/auth/session").status_code == 401

        challenge = client.post(
            "/api/v1/auth/challenges",
            json={"mobile": mobile},
            headers={"Origin": origin},
        )
        assert challenge.status_code == 202
        assert challenge.headers.get("access-control-allow-origin") == origin
        assert challenge.headers.get("access-control-allow-credentials") == "true"
        assert len(provider.messages) == previous_message_count + 1
        sent_mobile, code = provider.messages[-1]
        assert sent_mobile == normalized_mobile
        assert _is_nonempty(code), "FakeSMS did not record an OTP"
        assert _body_excludes_secret(challenge.text, code), "Challenge response disclosed an OTP"

        verified = client.post(
            "/api/v1/auth/verify",
            json={"mobile": mobile, "code": code},
            headers={"Origin": origin},
        )
        assert verified.status_code == 200
        verification_body = verified.json()
        user_id = verification_body.get("user_id")
        verification_csrf = verification_body.get("csrf_token")
        assert _is_nonempty(user_id), "Verification response omitted user_id"
        assert _is_nonempty(verification_csrf), "Verification response omitted CSRF token"
        session_cookie = verified.cookies.get("aroman_session")
        assert _is_nonempty(session_cookie), "Verification response omitted session cookie"

        parsed_cookie = SimpleCookie()
        parsed_cookie.load(verified.headers.get("set-cookie", ""))
        assert "aroman_session" in parsed_cookie, "Session cookie attributes were not returned"
        cookie = parsed_cookie["aroman_session"]
        assert cookie["httponly"], "Session cookie must be HttpOnly"
        assert cookie["samesite"].lower() == "lax", "Session cookie must use SameSite=Lax"
        assert cookie["path"] == "/api/v1", "Session cookie must be scoped to /api/v1"

        active_session = client.get("/api/v1/auth/session")
        assert active_session.status_code == 200
        assert active_session.json().get("user_id") == user_id
        current_user = client.get("/api/v1/users/me")
        assert current_user.status_code == 200
        assert current_user.json().get("mobile_e164") == normalized_mobile
        assert current_user.json().get("role") == "customer"

        csrf_response = client.get("/api/v1/auth/csrf", headers={"Origin": origin})
        assert csrf_response.status_code == 200
        fresh_csrf = csrf_response.json().get("csrf_token")
        assert _is_nonempty(fresh_csrf), "CSRF rotation response omitted token"
        assert _are_distinct(fresh_csrf, verification_csrf), "CSRF token was not rotated"

        logout_path = "/api/v1/auth/session"
        assert client.delete(logout_path, headers={"Origin": origin}).status_code == 403
        assert (
            client.delete(
                logout_path,
                headers={"Origin": origin, "X-CSRF-Token": verification_csrf},
            ).status_code
            == 403
        )
        assert client.get("/api/v1/auth/session").status_code == 200

        logged_out = client.delete(
            logout_path,
            headers={"Origin": origin, "X-CSRF-Token": fresh_csrf},
        )
        assert logged_out.status_code == 204
        assert not _client_has_session_cookie(client), "Logout did not remove the session cookie"

        assert client.get("/api/v1/auth/session").status_code == 401
        assert client.get("/api/v1/users/me").status_code == 401
        assert client.get("/api/v1/fragrance-concepts").status_code == 401
        replay = client.get(
            "/api/v1/auth/session",
            headers={"Cookie": f"aroman_session={session_cookie}"},
        )
        assert replay.status_code == 401
