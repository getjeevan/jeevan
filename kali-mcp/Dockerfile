FROM kalilinux/kali-rolling:latest

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ripgrep \
    nodejs \
    npm \
    python3 \
    python3-pip \
    nmap \
    netcat-traditional \
    net-tools \
    wget \
    unzip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Pre-install MCP servers globally so npx doesn't need to fetch them each time
RUN npm install -g \
    @modelcontextprotocol/server-filesystem \
    @modelcontextprotocol/server-brave-search

# Create non-root user (Claude Code requires non-root)
RUN useradd -m -s /bin/bash claude && \
    mkdir -p /home/claude/.claude

WORKDIR /workspace
RUN chown -R claude:claude /workspace /home/claude

USER claude
ENV PATH="/home/claude/.local/bin:/usr/local/bin:$PATH"

# Claude Code reads MCP config from ~/.claude.json
COPY --chown=claude:claude claude.json /home/claude/.claude.json

CMD ["bash"]
