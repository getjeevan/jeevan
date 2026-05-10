#!/bin/bash
# Run once on the on-prem server before first `docker compose up`.
# Creates the PostgreSQL user + database that Coder needs.
#
# Usage:
#   sudo bash setup/init-coder-db.sh
#
# If PostgreSQL is in Docker (container named "postgres"), use:
#   sudo bash setup/init-coder-db.sh --docker
set -e

PG_USER="coder"
PG_PASS="coderpass"
PG_DB="coder"

log() { echo "[init-coder-db] $*"; }

USE_DOCKER=false
for arg in "$@"; do [[ "$arg" == "--docker" ]] && USE_DOCKER=true; done

psql_cmd() {
  if $USE_DOCKER; then
    docker exec -i postgres psql -U postgres "$@"
  else
    sudo -u postgres psql "$@"
  fi
}

log "Checking if user '${PG_USER}' exists..."
EXISTS=$(psql_cmd -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" 2>/dev/null || echo "")

if [ -z "$EXISTS" ]; then
  log "Creating user '${PG_USER}'..."
  psql_cmd -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';"
else
  log "User '${PG_USER}' already exists — skipping."
fi

log "Checking if database '${PG_DB}' exists..."
DB_EXISTS=$(psql_cmd -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" 2>/dev/null || echo "")

if [ -z "$DB_EXISTS" ]; then
  log "Creating database '${PG_DB}' owned by '${PG_USER}'..."
  psql_cmd -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"
else
  log "Database '${PG_DB}' already exists — skipping."
fi

log "Granting privileges..."
psql_cmd -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};"

log "Done. Connection string:"
log "  postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}"
