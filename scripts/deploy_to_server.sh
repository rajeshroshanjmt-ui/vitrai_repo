#!/usr/bin/env bash
set -euo pipefail

# Minimal deploy script run on the remote host. Designed to be safe and idempotent.
# Usage: deploy_to_server.sh [-n]
# Options:
#   -n  non-interactive (no prompts)

NONINTERACTIVE=0
# hmr helper flags accumulate for later invocation
HMR_ARGS=()
while getopts ":nH:p:P:w:" opt; do
  case ${opt} in
    n) NONINTERACTIVE=1 ;;
    H) HMR_ARGS+=("-h" "$OPTARG") ;;      # public host
    p) HMR_ARGS+=("-p" "$OPTARG") ;;      # client port
    P) HMR_ARGS+=("-P" "$OPTARG") ;;      # protocol (ws/wss)
    w) HMR_ARGS+=("-w" "$OPTARG") ;;      # path
    *) echo "Usage: $0 [-n] [-H host] [-p port] [-P protocol] [-w path]"; exit 1 ;;
  esac
done

# if we have the helper script available, source it now
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/hmr_env.sh" ]; then
  echo "Loading HMR environment helper"
  # shellcheck disable=SC1090
  source "$SCRIPT_DIR/hmr_env.sh" "${HMR_ARGS[@]}" || true
fi

APP_DIR="${APP_DIR:-/home/ubuntu/app}"
BACKEND_DIR="$APP_DIR/backend"

# If backend was copied directly into $APP_DIR (no nested 'backend' folder),
# fall back to using $APP_DIR itself when it contains expected backend files.
if [ ! -d "$BACKEND_DIR" ]; then
  if [ -f "$APP_DIR/main.py" ] || [ -f "$APP_DIR/requirements.txt" ]; then
    BACKEND_DIR="$APP_DIR"
  fi
fi

echo "Using app dir: $APP_DIR"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "Error: backend directory not found at $BACKEND_DIR"
  exit 2
fi

cd "$BACKEND_DIR"

if [ -f requirements.txt ]; then
  if ! command -v python3 >/dev/null 2>&1; then
    echo "python3 not found on remote host; skipping venv/setup"
  else
    echo "Setting up virtualenv and installing requirements"
    python3 -m venv .venv || true
    # shellcheck disable=SC1091
    if [ -f .venv/bin/activate ]; then
      source .venv/bin/activate
      pip install --upgrade pip setuptools || true
      pip install -r requirements.txt || true
    else
      echo "virtualenv not available or not created; skipping venv setup"
    fi
  fi
fi

# If there's a docker-compose at the app root, try to bring services up
if [ -f "$APP_DIR/docker-compose.yml" ]; then
  if command -v docker >/dev/null 2>&1; then
    echo "Detected docker-compose.yml at $APP_DIR. Running docker compose up -d --build"
    docker compose -f "$APP_DIR/docker-compose.yml" pull || true
    docker compose -f "$APP_DIR/docker-compose.yml" up -d --build || true

    # optionally pull Ollama models after bringing the stack up
    # set DO_PULL_OLLAMA=1 in the environment or pass via SSH to enable
    if [ "${DO_PULL_OLLAMA:-0}" != "0" ]; then
      if docker ps --format '{{.Names}}' | grep -q '^vetrai-ollama'; then
        LLM_MODEL="${OLLAMA_LLM_MODEL:-llama3.2}"
        EMBED_MODEL="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"
        echo "Pulling Ollama models ($LLM_MODEL, $EMBED_MODEL)" 1>&2
        docker exec vetrai-ollama-1 ollama pull "$LLM_MODEL" || true
        docker exec vetrai-ollama-1 ollama pull "$EMBED_MODEL" || true
      else
        echo "Ollama container not detected; skipping model pulls" 1>&2
      fi
    fi
  else
    echo "Docker not found; skipping docker-compose steps"
  fi
fi

echo "Deploy finished."
