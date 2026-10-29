"""Check the disposable exploration SQLite database and demonstrative seed."""
import os
import sys
from urllib.parse import urlsplit

from sqlalchemy import inspect, text
from aroman.core.db import get_engine

EXPECTED_MIGRATION = "a4b01"

def main():
    phase = sys.argv[1]
    assert phase in {"before", "after"}
    url = urlsplit(os.environ["DATABASE_URL"])
    assert url.scheme == "sqlite" and url.path == os.environ["DATABASE_URL"].removeprefix("sqlite://"), "Unexpected database URL"
    assert url.path.endswith("/exploration.sqlite3") and "/aroman-exploration-real-stack-" in url.path
    engine = get_engine()
    assert engine.dialect.name == "sqlite"
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
        if phase == "before":
            assert not tables, f"Disposable database is not empty: {sorted(tables)}"
        else:
            assert connection.scalar(text("SELECT version_num FROM alembic_version")) == EXPECTED_MIGRATION
            expected = {"fragrance_families": 6, "fragrance_notes": 24, "brands": 3, "products": 3, "product_variants": 3, "fragrance_concepts": 0}
            for table, count in expected.items():
                assert connection.scalar(text(f"SELECT count(*) FROM {table}")) == count, f"Unexpected {table} seed count"
            for table in ("fragrance_families", "fragrance_notes", "brands", "products", "product_variants"):
                assert connection.scalar(text(f"SELECT count(*) FROM {table} WHERE is_demo = 1")) == expected[table], f"Non-demonstrative records in {table}"
            assert connection.scalar(text("SELECT count(*) FROM products WHERE slug = 'aroman-garden-demo'")) == 1
            assert connection.scalar(text("SELECT count(*) FROM fragrance_notes WHERE slug = 'rose'")) == 1
    print(f"EXPLORATION DATABASE PASS: {phase}; migration {EXPECTED_MIGRATION}; synthetic catalog invariants verified")

if __name__ == "__main__":
    main()
