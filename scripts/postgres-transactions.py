"""Pinned Backend transaction contract against the runner's disposable PostgreSQL 17."""

import os
import secrets
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from queue import Queue
from urllib.parse import urlsplit

from fastapi.testclient import TestClient
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session

from aroman.authentication.api import digest
from aroman.core.config import get_settings
from aroman.core.db import get_engine, utcnow
from aroman.main import app
from aroman.models import AuthSession, ConceptNote, FragranceConcept, FragranceNote, User

PATH = "/api/v1/fragrance-concepts"
TIMEOUT = 15
engine = get_engine()


def check_isolation():
    url = urlsplit(os.environ["DATABASE_URL"])
    assert os.environ["AROMAN_TEST_DB_MODE"] == "transactions"
    assert engine.dialect.name == "postgresql" and url.scheme == "postgresql+psycopg"
    assert url.hostname == "127.0.0.1" and url.username == os.environ["AROMAN_TEST_DB_USER"]
    assert url.path == "/" + os.environ["AROMAN_TEST_DB_NAME"]
    assert url.path.startswith("/aroman_test_")
    with engine.connect() as db:
        assert db.scalar(text("SELECT current_database()")) == os.environ["AROMAN_TEST_DB_NAME"]
        assert db.scalar(text("SELECT current_user")) == os.environ["AROMAN_TEST_DB_USER"]
        assert db.scalar(text("SHOW server_version_num"))[:2] == "17"
        assert db.scalar(text("SELECT count(*) FROM fragrance_concepts")) == 0


def account(index):
    settings = get_settings()
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    with Session(engine) as db:
        user = User(mobile_e164=f"+98910000{index:05d}")
        db.add(user)
        db.flush()
        db.add(AuthSession(user_id=user.id, token_digest=digest(token, settings.session_pepper),
                           csrf_digest=digest(csrf, settings.session_pepper),
                           expires_at=utcnow() + timedelta(hours=1)))
        user_id = user.id
        db.commit()
        return user_id, token, csrf


def request(identity, method, path, body=None):
    _, token, csrf = identity
    # Each call owns an HTTP request context and the Backend provides a new DB session.
    with TestClient(app, raise_server_exceptions=False) as client:
        return client.request(method, path, json=body,
                              headers={"X-CSRF-Token": csrf, "Origin": "http://localhost:3000",
                                       "Cookie": f"aroman_session={token}"})


def expect(response, code):
    assert response.status_code == code, (response.status_code, response.text)
    return response.json() if code != 204 else None


def selection(ids, name, offset=0):
    return {"name": name, "notes": [
        {"note_id": str(ids[offset]), "layer": "top", "position": 0},
        {"note_id": str(ids[offset + 1]), "layer": "heart", "position": 0},
        {"note_id": str(ids[offset + 2]), "layer": "heart", "position": 1},
    ]}


def canonical(value):
    return value["name"], tuple(sorted((n["note_id"], n["layer"], n["position"]) for n in value["notes"]))


def verify_record(identity, concept_id, expected):
    actual = expect(request(identity, "GET", f"{PATH}/{concept_id}"), 200)
    assert canonical(actual) == canonical(expected), (actual, expected)
    with Session(engine) as db:
        row = db.get(FragranceConcept, uuid.UUID(concept_id))
        assert row is not None and row.owner_id == identity[0]
        db_notes = tuple(sorted((str(n.note_id), n.layer, n.position) for n in row.notes))
        assert (row.name, db_notes) == canonical(expected)


def integrity():
    with engine.connect() as db:
        assert db.scalar(text("SELECT count(*) FROM concept_notes n LEFT JOIN fragrance_concepts c ON c.id=n.concept_id WHERE c.id IS NULL")) == 0
        assert db.scalar(text("SELECT count(*) FROM concept_notes n LEFT JOIN fragrance_notes f ON f.id=n.note_id WHERE f.id IS NULL")) == 0
        assert db.scalar(text("SELECT count(*) FROM concept_notes WHERE layer NOT IN ('top','heart','base') OR position < 0")) == 0
        assert db.scalar(text("SELECT count(*) FROM (SELECT concept_id,note_id,count(*) n FROM concept_notes GROUP BY 1,2 HAVING count(*)>1) s")) == 0
        assert db.scalar(text("SELECT count(*) FROM (SELECT concept_id,layer,position,count(*) n FROM concept_notes GROUP BY 1,2,3 HAVING count(*)>1) s")) == 0
        assert db.scalar(text("SELECT count(*) FROM (SELECT concept_id,layer FROM concept_notes GROUP BY 1,2 HAVING min(position)<>0 OR max(position)<>count(*)-1) s")) == 0


def concurrent_updates(owner, concept_id, first, second):
    entered = Queue()
    def observe(conn, cursor, statement, parameters, context, executemany):
        if "FOR UPDATE OF fragrance_concepts" in statement and "fragrance_concepts.id" in statement:
            entered.put(conn.connection.driver_connection.info.backend_pid)

    event.listen(engine, "before_cursor_execute", observe)
    try:
        with Session(engine) as holder:
            holder.execute(text("SET LOCAL lock_timeout = '12s'"))
            holder.execute(text("SELECT id FROM fragrance_concepts WHERE id=:id FOR UPDATE"), {"id": uuid.UUID(concept_id)})
            with ThreadPoolExecutor(max_workers=2) as pool:
                try:
                    a = pool.submit(request, owner, "PUT", f"{PATH}/{concept_id}", first)
                    b = pool.submit(request, owner, "PUT", f"{PATH}/{concept_id}", second)
                    pids = {entered.get(timeout=TIMEOUT), entered.get(timeout=TIMEOUT)}
                    assert len(pids) == 2, "Updates did not use independent connections"
                    holder_pid = holder.scalar(text("SELECT pg_backend_pid()"))
                    deadline = time.monotonic() + TIMEOUT
                    with engine.connect() as monitor:
                        while True:
                            blocked = monitor.execute(text("SELECT pid, pg_blocking_pids(pid) FROM pg_stat_activity WHERE pid = ANY(:pids)"), {"pids": list(pids)}).all()
                            if (len(blocked) == 2
                                    and all(blockers and set(blockers) <= pids | {holder_pid}
                                            for _, blockers in blocked)
                                    and any(holder_pid in blockers for _, blockers in blocked)):
                                break
                            assert time.monotonic() < deadline, ("Both updates did not block on the row lock", blocked)
                    assert not a.done() and not b.done()
                    holder.commit()
                    expect(a.result(timeout=TIMEOUT), 200)
                    expect(b.result(timeout=TIMEOUT), 200)
                finally:
                    holder.rollback()
    finally:
        event.remove(engine, "before_cursor_execute", observe)
    actual = expect(request(owner, "GET", f"{PATH}/{concept_id}"), 200)
    assert canonical(actual) in {canonical(first), canonical(second)}
    verify_record(owner, concept_id, actual)
    print("PASS concurrent full-replacement updates serialize and retain one complete state")


def rollback_cases(owner, concept_id, ids):
    before = expect(request(owner, "GET", f"{PATH}/{concept_id}"), 200)
    malformed = {"name": "invalid", "notes": [
        {"note_id": str(ids[0]), "layer": "top", "position": 0},
        {"note_id": str(ids[1]), "layer": "top", "position": 0}]}
    expect(request(owner, "PUT", f"{PATH}/{concept_id}", malformed), 422)
    verify_record(owner, concept_id, before)
    # This passes schema validation and is rejected after clear() has flushed.
    unknown = {"name": "unknown note", "notes": [
        {"note_id": str(uuid.uuid4()), "layer": "top", "position": 0}]}
    expect(request(owner, "PUT", f"{PATH}/{concept_id}", unknown), 422)
    verify_record(owner, concept_id, before)

    # The trigger exists only in this generated database. It rejects an INSERT after
    # the Backend has flushed the DELETE of the previous associations.
    with engine.begin() as db:
        db.execute(text("CREATE FUNCTION test_reject_concept_note() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test insert failure'; END $$"))
        db.execute(text("CREATE TRIGGER test_reject_concept_note BEFORE INSERT ON concept_notes FOR EACH ROW EXECUTE FUNCTION test_reject_concept_note()"))
    try:
        payload = selection(ids, "must roll back", 6)
        expect(request(owner, "PUT", f"{PATH}/{concept_id}", payload), 503)
        verify_record(owner, concept_id, before)
    finally:
        with engine.begin() as db:
            db.execute(text("DROP TRIGGER test_reject_concept_note ON concept_notes"))
            db.execute(text("DROP FUNCTION test_reject_concept_note()"))
    print("PASS validation rejection and PostgreSQL insert failure roll back associations")


def ownership(owner, outsider, concept_id, ids):
    before = expect(request(owner, "GET", f"{PATH}/{concept_id}"), 200)
    gate = threading.Barrier(4, timeout=TIMEOUT)
    operations = [("GET", None), ("PUT", selection(ids, "foreign", 9)),
                  ("POST", None), ("DELETE", None)]
    def attempt(method, body):
        gate.wait()
        suffix = "/duplicate" if method == "POST" else ""
        return request(outsider, method, f"{PATH}/{concept_id}{suffix}", body)
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(attempt, method, body) for method, body in operations]
        for future in futures:
            expect(future.result(timeout=TIMEOUT), 404)
    assert expect(request(outsider, "GET", PATH), 200) == []
    verify_record(owner, concept_id, before)
    print("PASS simultaneous foreign read, update, duplicate and delete are denied")


def duplicate_update_race(owner, concept_id, ids):
    before = expect(request(owner, "GET", f"{PATH}/{concept_id}"), 200)
    after = selection(ids, "after duplicate race", 9)
    gate = threading.Barrier(2, timeout=TIMEOUT)
    def run(method, suffix, body):
        gate.wait()
        return request(owner, method, f"{PATH}/{concept_id}{suffix}", body)
    with ThreadPoolExecutor(max_workers=2) as pool:
        copy_future = pool.submit(run, "POST", "/duplicate", None)
        update_future = pool.submit(run, "PUT", "", after)
        copy = expect(copy_future.result(timeout=TIMEOUT), 201)
        expect(update_future.result(timeout=TIMEOUT), 200)
    assert copy["id"] != concept_id
    assert tuple(sorted((n["note_id"], n["layer"], n["position"]) for n in copy["notes"])) in {
        canonical(before)[1], canonical(after)[1]}
    verify_record(owner, concept_id, after)
    verify_record(owner, copy["id"], copy)
    print("PASS duplicate/update race copies one complete locked source state")


def main():
    check_isolation()
    owner, outsider = account(1), account(2)
    with Session(engine) as db:
        ids = list(db.scalars(select(FragranceNote.id).order_by(FragranceNote.slug).limit(12)))
    assert len(ids) == 12
    initial = selection(ids, "initial")
    created = expect(request(owner, "POST", PATH, initial), 201)
    concept_id = created["id"]
    verify_record(owner, concept_id, initial)
    # Accepted creates are intentionally non-idempotent.
    repeated = expect(request(owner, "POST", PATH, initial), 201)
    assert repeated["id"] != concept_id
    assert len(expect(request(owner, "GET", PATH), 200)) == 2
    print("PASS repeated accepted creates produce distinct records")
    concurrent_updates(owner, concept_id, selection(ids, "first", 3), selection(ids, "second", 6))
    rollback_cases(owner, concept_id, ids)
    duplicate_update_race(owner, concept_id, ids)
    ownership(owner, outsider, concept_id, ids)
    integrity()
    print("POSTGRES TRANSACTIONS PASS: relationships and uniqueness intact")


if __name__ == "__main__":
    main()
