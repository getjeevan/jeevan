#!/bin/bash
# Ensure project-level MCP config exists in /workspace on every start
if [ ! -f /workspace/.mcp.json ]; then
  cat > /workspace/.mcp.json <<'EOF'
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/workspace",
        "/home/claude"
      ]
    }
  }
}
EOF
  echo "[entrypoint] Created /workspace/.mcp.json"
fi

exec "$@"
