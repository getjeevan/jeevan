#!/bin/bash
set -e

echo "[kali-mcp] Starting MCP server..."
cd /app
exec node mcp-server.mjs
