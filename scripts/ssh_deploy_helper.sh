#!/usr/bin/env bash
set -euo pipefail

KEY=""
HOST=""
USER="ubuntu"
SRC="./backend"
DEST="/home/${USER}/app"
EXEC_LOCAL_SCRIPT=""

usage(){
  cat <<EOF
Usage: $0 -i <key.pem> -h <host> [options]

Options:
  -i <key>      Path to private key (PEM)
  -h <host>     Remote host (IP or DNS)
  -u <user>     Remote user (default: ubuntu)
  -s <src>      Local source to copy (default: ./backend)
  -d <dest>     Remote destination path (default: /home/<user>/app)
  -x <script>   Stream and execute a local deploy script on remote (e.g. scripts/deploy_to_server.sh)
  -r            Recursive copy (folders)
  -?            Show this help

Examples:
  Copy and do nothing else:
    $0 -i LightsailDefaultKey-us-east-1.pem -h 1.2.3.4 -s ./backend -d /home/ubuntu/app

  Copy and stream a local deploy script:
    $0 -i LightsailDefaultKey-us-east-1.pem -h 1.2.3.4 -x scripts/deploy_to_server.sh

EOF
}

RECURSIVE=true

while getopts ":i:h:u:s:d:x:r?" opt; do
  case ${opt} in
    i) KEY=${OPTARG} ;;
    h) HOST=${OPTARG} ;;
    u) USER=${OPTARG} ;;
    s) SRC=${OPTARG} ;;
    d) DEST=${OPTARG} ;;
    x) EXEC_LOCAL_SCRIPT=${OPTARG} ;;
    r) RECURSIVE=true ;;
    ?) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

if [[ -z "$KEY" || -z "$HOST" ]]; then
  echo "Error: key and host are required."
  usage
  exit 2
fi

if [[ ! -f "$KEY" ]]; then
  echo "Error: key file '$KEY' not found"
  exit 3
fi

chmod 600 "$KEY" || true

echo "Copying '$SRC' -> ${USER}@${HOST}:$DEST"
if [[ "$RECURSIVE" = true ]]; then
  scp -i "$KEY" -r "$SRC" "${USER}@${HOST}:$DEST"
else
  scp -i "$KEY" "$SRC" "${USER}@${HOST}:$DEST"
fi

if [[ -n "$EXEC_LOCAL_SCRIPT" ]]; then
  if [[ ! -f "$EXEC_LOCAL_SCRIPT" ]]; then
    echo "Error: local script '$EXEC_LOCAL_SCRIPT' not found"
    exit 4
  fi
  echo "Streaming and executing '$EXEC_LOCAL_SCRIPT' on ${USER}@${HOST}"
  cat "$EXEC_LOCAL_SCRIPT" | ssh -i "$KEY" "${USER}@${HOST}" 'bash -s' --
fi

echo "Done."
