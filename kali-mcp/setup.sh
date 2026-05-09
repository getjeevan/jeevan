#!/bin/bash
set -e

# On-prem Kali + Claude MCP setup script
# Run this on your Docker server as root or a docker-capable user

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Create workspace directory
mkdir -p workspace

# Copy env file if not already present
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env — edit it and set your ANTHROPIC_API_KEY, then re-run this script."
  exit 0
fi

if grep -q "your-key-here" .env; then
  echo "ERROR: Set your ANTHROPIC_API_KEY in .env before running."
  exit 1
fi

# Build and start
DOCKER_BUILDKIT=0 docker-compose up -d --build

echo ""
echo "Kali + Claude MCP container is running."
echo ""
echo "To open an interactive session:"
echo "  docker exec -it kali-claude-mcp bash"
echo ""
echo "Inside the container, start Claude Code:"
echo "  claude"
echo ""
