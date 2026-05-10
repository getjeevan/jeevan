terraform {
  required_providers {
    coder = {
      source  = "coder/coder"
      version = "~> 2.0"
    }
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

# ── Coder data ─────────────────────────────────────────────────────────────────
data "coder_workspace" "me" {}
data "coder_workspace_owner" "me" {}

# ── Parameters ────────────────────────────────────────────────────────────────
data "coder_parameter" "github_token" {
  name         = "github_token"
  display_name = "GitHub Token"
  description  = "Personal access token for git push/pull. Create at github.com/settings/tokens (repo scope)."
  type         = "string"
  default      = ""
  mutable      = true
}

data "coder_parameter" "anthropic_api_key" {
  name         = "anthropic_api_key"
  display_name = "Anthropic API Key"
  description  = "API key for Claude Code AI assistant."
  type         = "string"
  default      = ""
  mutable      = true
}

data "coder_parameter" "repo_url" {
  name         = "repo_url"
  display_name = "Git Repository (optional)"
  description  = "Clone this repo into /home/coder/project on workspace start."
  type         = "string"
  default      = ""
  mutable      = true
}

# ── Agent ─────────────────────────────────────────────────────────────────────
resource "coder_agent" "main" {
  arch = "amd64"
  os   = "linux"

  env = {
    GITHUB_TOKEN      = data.coder_parameter.github_token.value
    ANTHROPIC_API_KEY = data.coder_parameter.anthropic_api_key.value
    GIT_AUTHOR_NAME   = data.coder_workspace_owner.me.full_name
    GIT_AUTHOR_EMAIL  = data.coder_workspace_owner.me.email
  }

  startup_script = <<-EOT
    #!/bin/bash
    set -e

    # Configure git identity
    git config --global user.name  "${data.coder_workspace_owner.me.full_name}"
    git config --global user.email "${data.coder_workspace_owner.me.email}"
    git config --global init.defaultBranch main

    # GitHub token: use gh auth login so git + gh CLI both work
    if [ -n "$GITHUB_TOKEN" ]; then
      echo "$GITHUB_TOKEN" | gh auth login --with-token 2>/dev/null || true
      git config --global url."https://oauth2:${data.coder_parameter.github_token.value}@github.com/".insteadOf "https://github.com/"
    fi

    # Clone repo if provided and not already present
    REPO="${data.coder_parameter.repo_url.value}"
    if [ -n "$REPO" ] && [ ! -d /home/coder/project ]; then
      git clone "$REPO" /home/coder/project
    fi

    echo "✅ Workspace ready"
  EOT

  metadata {
    display_name = "CPU Usage"
    key          = "cpu"
    script       = "coder stat cpu"
    interval     = 10
    timeout      = 1
  }

  metadata {
    display_name = "RAM Usage"
    key          = "ram"
    script       = "coder stat mem"
    interval     = 10
    timeout      = 1
  }

  metadata {
    display_name = "Disk"
    key          = "disk"
    script       = "coder stat disk --path /home/coder"
    interval     = 60
    timeout      = 1
  }
}

# ── VS Code in browser (code-server built into Coder) ────────────────────────
resource "coder_app" "vscode" {
  agent_id     = coder_agent.main.id
  slug         = "vscode"
  display_name = "VS Code"
  url          = "http://localhost:13337"
  icon         = "/icon/code.svg"
  subdomain    = false
  share        = "owner"

  healthcheck {
    url       = "http://localhost:13337/healthz"
    interval  = 5
    threshold = 6
  }
}

# ── Workspace image ───────────────────────────────────────────────────────────
resource "docker_image" "workspace" {
  name = "coder-workspace:latest"

  build {
    context    = path.module
    dockerfile = "Dockerfile"
    tag        = ["coder-workspace:latest"]
  }

  keep_locally = true

  triggers = {
    dockerfile_hash = filesha256("${path.module}/Dockerfile")
  }
}

# ── Persistent home volume ────────────────────────────────────────────────────
resource "docker_volume" "home" {
  name = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}-home"

  lifecycle {
    ignore_changes = all
  }
}

# ── Workspace container ───────────────────────────────────────────────────────
resource "docker_container" "workspace" {
  # count=0 when workspace is stopped — Coder tears down the container
  count   = data.coder_workspace.me.start_count
  image   = docker_image.workspace.image_id
  name    = "coder-${data.coder_workspace_owner.me.name}-${data.coder_workspace.me.name}"
  restart = "no"

  # Bootstrap the Coder agent inside the container
  command = ["sh", "-c", coder_agent.main.init_script]

  env = [
    "CODER_AGENT_TOKEN=${coder_agent.main.token}",
    "GITHUB_TOKEN=${data.coder_parameter.github_token.value}",
    "ANTHROPIC_API_KEY=${data.coder_parameter.anthropic_api_key.value}",
  ]

  # Persistent home directory
  volumes {
    container_path = "/home/coder"
    volume_name    = docker_volume.home.name
    read_only      = false
  }

  # Docker socket — lets workspace run docker build/run commands
  volumes {
    container_path = "/var/run/docker.sock"
    host_path      = "/var/run/docker.sock"
    read_only      = false
  }

  # Keep stdout/stderr
  log_driver = "json-file"
  log_opts = {
    "max-size" = "10m"
    "max-file" = "3"
  }
}
