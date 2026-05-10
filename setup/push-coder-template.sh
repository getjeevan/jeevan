#!/bin/bash
# Pushes the Docker workspace template into a running Coder instance.
# Run this after `deploy.sh` once Coder is healthy.
#
# Usage:
#   CODER_URL=https://coder.asheindallas.com \
#   CODER_TOKEN=<your-session-token> \
#   bash setup/push-coder-template.sh
#
# Get your session token from:
#   coder login https://coder.asheindallas.com
#   coder tokens create
set -e

CODER_URL="${CODER_URL:-https://coder.asheindallas.com}"
TEMPLATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../coder/template" && pwd)"
TEMPLATE_NAME="docker-dev"

log() { echo "[push-template] $*"; }

# ── Check coder CLI is available ──────────────────────────────────────────────
if ! command -v coder &>/dev/null; then
  log "Installing Coder CLI..."
  curl -fsSL https://coder.com/install.sh | sh
fi

# ── Login ─────────────────────────────────────────────────────────────────────
log "Logging in to ${CODER_URL}..."
if [ -n "$CODER_TOKEN" ]; then
  coder login "$CODER_URL" --token "$CODER_TOKEN"
else
  coder login "$CODER_URL"
fi

# ── Push template ─────────────────────────────────────────────────────────────
log "Pushing template '${TEMPLATE_NAME}' from ${TEMPLATE_DIR}..."

EXISTING=$(coder templates list --output json 2>/dev/null | grep -c "\"name\":\"${TEMPLATE_NAME}\"" || true)

if [ "$EXISTING" -gt 0 ]; then
  log "Template exists — updating..."
  coder templates push "$TEMPLATE_NAME" \
    --directory "$TEMPLATE_DIR" \
    --yes
else
  log "Creating new template..."
  coder templates create "$TEMPLATE_NAME" \
    --directory "$TEMPLATE_DIR" \
    --yes
fi

log ""
log "Template '${TEMPLATE_NAME}' is live."
log "Create your first workspace:"
log "  ${CODER_URL}/templates/${TEMPLATE_NAME}"
