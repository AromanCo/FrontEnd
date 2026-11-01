#!/bin/sh
# REVIEW ONLY. Mirrors the pinned Backend M6-A13 role bootstrap contract.
set -eu
if ! id -G | tr ' ' '\n' | grep -qx '10001'; then
  echo 'The PostgreSQL initialization process must have supplementary GID 10001 for its assigned secret files.' >&2
  exit 1
fi
MIGRATOR_DB_PASSWORD="$(cat /run/secrets/catalog_migration_password)"
APP_DB_PASSWORD="$(cat /run/secrets/catalog_runtime_password)"
export MIGRATOR_DB_PASSWORD APP_DB_PASSWORD
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 <<'SQL'
\getenv migrator_password MIGRATOR_DB_PASSWORD
\getenv app_password APP_DB_PASSWORD
CREATE ROLE aroman_migrator LOGIN PASSWORD :'migrator_password';
CREATE ROLE aroman_app LOGIN PASSWORD :'app_password';
ALTER DATABASE aroman OWNER TO aroman_migrator;
REVOKE CONNECT ON DATABASE aroman FROM PUBLIC;
GRANT CONNECT ON DATABASE aroman TO aroman_migrator;
GRANT CONNECT ON DATABASE aroman TO aroman_app;
GRANT USAGE ON SCHEMA public TO aroman_app;
ALTER DEFAULT PRIVILEGES FOR ROLE aroman_migrator IN SCHEMA public
  REVOKE ALL ON TABLES FROM aroman_app;
SQL
