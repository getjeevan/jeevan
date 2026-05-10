#!/bin/bash
# Creates the PostgreSQL user + database that Coder needs.
# Auto-detects whether PostgreSQL is running natively or in Docker.
#
# Usage:  sudo bash setup/init-coder-db.sh
set -e

PG_USER="coder"
PG_PASS="coderpass"
PG_DB="coder"

log() { echo "[init-coder-db] $*"; }

# ── Detect PostgreSQL location ────────────────────────────────────────────────
PG_CONTAINER=""
PG_NATIVE=false

# Check for a running postgres container (any name containing 'postgres')
if command -v docker &>/dev/null; then
  PG_CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1 || true)
fi

# Check for native postgres (system user exists)
if id postgres &>/dev/null 2>&1; then
  PG_NATIVE=true
fi

if [ -n "$PG_CONTAINER" ]; then
  log "Found PostgreSQL in Docker container: ${PG_CONTAINER}"
  psql_cmd() { docker exec -i "$PG_CONTAINER" psql -U postgres "$@"; }
elif $PG_NATIVE; then
  log "Found native PostgreSQL (system user: postgres)"
  psql_cmd() { sudo -u postgres psql "$@"; }
else
  log "ERROR: Cannot find PostgreSQL — not in Docker and no system 'postgres' user."
  log "Is PostgreSQL running? Try: docker ps | grep -i postgres"
  exit 1
fi

# ── Create user ───────────────────────────────────────────────────────────────
log "Checking if user '${PG_USER}' exists..."
EXISTS=$(psql_cmd -tAc "SELECT 1 FROM pg_roles WHERE rolname='${PG_USER}'" 2>/dev/null || echo "")
if [ -z "$EXISTS" ]; then
  log "Creating user '${PG_USER}'..."
  psql_cmd -c "CREATE USER ${PG_USER} WITH PASSWORD '${PG_PASS}';"
  log "User created."
else
  log "User '${PG_USER}' already exists — skipping."
fi

# ── Create database ───────────────────────────────────────────────────────────
log "Checking if database '${PG_DB}' exists..."
DB_EXISTS=$(psql_cmd -tAc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" 2>/dev/null || echo "")
if [ -z "$DB_EXISTS" ]; then
  log "Creating database '${PG_DB}'..."
  psql_cmd -c "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};"
  log "Database created."
else
  log "Database '${PG_DB}' already exists — skipping."
fi

# ── Grant privileges ──────────────────────────────────────────────────────────
psql_cmd -c "GRANT ALL PRIVILEGES ON DATABASE ${PG_DB} TO ${PG_USER};" 2>/dev/null || true

log "Done. Coder connection string:"
log "  postgresql://${PG_USER}:${PG_PASS}@localhost:5432/${PG_DB}"
