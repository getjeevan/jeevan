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

# Install Claude Code CLI and MCP filesystem server globally
RUN npm install -g \
    @anthropic-ai/claude-code \
    @modelcontextprotocol/server-filesystem

# Create non-root user (Claude Code requires non-root)
RUN useradd -m -s /bin/bash claude && \
    mkdir -p /home/claude

WORKDIR /workspace
RUN chown -R claude:claude /workspace /home/claude

COPY --chown=claude:claude entrypoint.sh /home/claude/entrypoint.sh
RUN chmod +x /home/claude/entrypoint.sh

USER claude
ENV PATH="/home/claude/.local/bin:/usr/local/bin:$PATH"

ENTRYPOINT ["/home/claude/entrypoint.sh"]
CMD ["bash"]
