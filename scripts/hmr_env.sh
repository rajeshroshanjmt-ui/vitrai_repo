#!/usr/bin/env bash
# helper to set VITE HMR environment variables for remote deployments (Lightsail, EC2, etc.)
# Usage:
#   source scripts/hmr_env.sh [-h host] [-p port] [-P protocol] [-w path]
#
# Defaults mirror the values expected by vite.config.js, but you can override them
# on the command line or by setting the corresponding environment variables directly.

set -euo pipefail

# defaults
HMR_HOST_DEFAULT="${VITE_HMR_HOST:-localhost}"
HMR_CLIENT_PORT_DEFAULT="${VITE_HMR_CLIENT_PORT:-80}"
HMR_PROTOCOL_DEFAULT="${VITE_HMR_PROTOCOL:-ws}"
HMR_PATH_DEFAULT="${VITE_HMR_PATH:-/vite-hmr}"

usage() {
  cat <<EOF
Sets environment variables used by the frontend's Vite dev server for HMR.

Usage: source scripts/hmr_env.sh [options]

Options:
  -h host       public hostname or IP (overrides VITE_HMR_HOST)
  -p port       client‐visible port (overrides VITE_HMR_CLIENT_PORT)
  -P protocol   ws or wss (overrides VITE_HMR_PROTOCOL)
  -w path       HMR websocket path (overrides VITE_HMR_PATH)

The variables are exported in the current shell, so this script must be
`source`d rather than executed directly:

    source scripts/hmr_env.sh -h app.vetrai.tech -p 443 -P wss

EOF
  return 0
}

while getopts ":h:p:P:w:?" opt; do
  case "${opt}" in
    h) HMR_HOST_DEFAULT="$OPTARG" ;;      # hostname
    p) HMR_CLIENT_PORT_DEFAULT="$OPTARG" ;; # port
    P) HMR_PROTOCOL_DEFAULT="$OPTARG" ;;  # protocol
    w) HMR_PATH_DEFAULT="$OPTARG" ;;     # path
    ?) usage; return 0 ;;
  esac
done

export VITE_HMR_HOST="${HMR_HOST_DEFAULT}"
export VITE_HMR_CLIENT_PORT="${HMR_CLIENT_PORT_DEFAULT}"
export VITE_HMR_PROTOCOL="${HMR_PROTOCOL_DEFAULT}"
export VITE_HMR_PATH="${HMR_PATH_DEFAULT}"

echo "exported VITE_HMR_HOST=$VITE_HMR_HOST"
echo "exported VITE_HMR_CLIENT_PORT=$VITE_HMR_CLIENT_PORT"
echo "exported VITE_HMR_PROTOCOL=$VITE_HMR_PROTOCOL"
echo "exported VITE_HMR_PATH=$VITE_HMR_PATH"
