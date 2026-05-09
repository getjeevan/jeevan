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

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install MCP filesystem server
RUN npm install -g @modelcontextprotocol/server-filesystem

# Create non-root user for Claude Code (required)
RUN useradd -m -s /bin/bash claude && \
    mkdir -p /home/claude/.claude

WORKDIR /workspace
RUN chown -R claude:claude /workspace /home/claude

USER claude
ENV PATH="/home/claude/.local/bin:/usr/local/bin:$PATH"

# Copy MCP configuration
COPY --chown=claude:claude .claude/ /home/claude/.claude/

CMD ["bash"]
