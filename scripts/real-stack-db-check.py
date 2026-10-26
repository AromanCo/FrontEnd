"""Assert the real-stack runner uses its selected disposable database."""

import os
import sys
import time
from urllib.parse import urlsplit

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from aroman.core.db import get_engine


def main():
    phase = sys.argv[1]
    assert phase in {"before", "after"}
    engine = get_engine()
    mode = os.environ["AROMAN_TEST_DB_MODE"]
    url = urlsplit(os.environ["DATABASE_URL"])
    deadline = time.monotonic() + 30
    while True:
        try:
            connection = engine.connect()
            break
        except OperationalError as error:
            if phase != "before" or time.monotonic() >= deadline:
                raise SystemExit(f"Isolated {mode} database connection unavailable: {error.orig}") from None
            time.sleep(0.25)
    with connection:
        if mode in {"postgres", "transactions"}:
            assert engine.dialect.name == "postgresql", "PostgreSQL mode used another dialect"
            assert url.scheme == "postgresql+psycopg" and url.hostname == "127.0.0.1"
            assert url.username == os.environ["AROMAN_TEST_DB_USER"]
            assert url.path == "/" + os.environ["AROMAN_TEST_DB_NAME"]
            version = int(connection.scalar(text("SHOW server_version_num")))
            assert 170000 <= version < 180000, f"Expected PostgreSQL 17, got {version}"
            assert connection.scalar(text("SELECT current_database()")) == os.environ["AROMAN_TEST_DB_NAME"]
            assert connection.scalar(text("SELECT current_user")) == os.environ["AROMAN_TEST_DB_USER"]
        else:
            assert mode == "sqlite" and engine.dialect.name == "sqlite"
            assert url.scheme == "sqlite" and url.path.endswith("/test.sqlite3")
        tables = set(inspect(connection).get_table_names())
        if phase == "before":
            assert not tables, "Test database is not empty"
        else:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == "d9670763b00d"
            assert connection.scalar(text("SELECT count(*) FROM fragrance_families")) == 6
            assert connection.scalar(text("SELECT count(*) FROM fragrance_notes")) == 24
            assert connection.scalar(text("SELECT count(*) FROM fragrance_concepts")) == 0
    print(f"REAL-STACK DATABASE PASS: {mode}, {phase}")


if __name__ == "__main__":
    main()
