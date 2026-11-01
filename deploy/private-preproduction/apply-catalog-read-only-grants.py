"""Post-migration allowlist: only the five restricted catalog tables are readable."""

import os

from sqlalchemy import create_engine, text

engine = create_engine(os.environ["DATABASE_URL"], pool_pre_ping=True)
catalog_tables = (
    "brands",
    "fragrance_families",
    "fragrance_notes",
    "products",
    "product_variants",
)
with engine.begin() as connection:
    identity = connection.execute(
        text("SELECT current_user, current_database()")
    ).one()
    if identity != ("aroman_migrator", "aroman"):
        raise RuntimeError("Catalog grants require the dedicated aroman_migrator on aroman")
    connection.execute(
        text("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM aroman_app")
    )
    connection.execute(
        text("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM aroman_app")
    )
    connection.execute(
        text(
            "GRANT SELECT ON TABLE "
            + ", ".join(f"public.{table}" for table in catalog_tables)
            + " TO aroman_app"
        )
    )
