#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p workspace

echo "Building Kali Linux OS container (this takes ~10-20 min on first run)..."
DOCKER_BUILDKIT=0 docker-compose build

echo ""
echo "Starting Kali OS container in the background..."
docker-compose up -d

echo ""
echo "Kali OS container is running."
echo ""
echo "Connect to it:"
echo "  docker exec -it kali-os bash"
echo ""
echo "Or run a one-off command:"
echo "  docker exec kali-os nmap -sV <target>"
echo ""
echo "To stop:"
echo "  docker-compose down"
echo ""
