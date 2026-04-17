#!/usr/bin/env bash
# AWS Lightsail Deployment - Simple Direct Version
# Usage: ./deploy_simple.sh /path/to/key.pem 107.20.229.198

set -euo pipefail

KEY="${1:?SSH key path required}"
HOST="${2:?Host IP required}"
USER="${3:-ubuntu}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "AWS Lightsail Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Host: $HOST"
echo "User: $USER"
echo "Key:  $KEY"
echo ""

# Fix key permissions
chmod 600 "$KEY"

# Test connection
echo "Testing connection..."
if ! ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 \
         "$USER@$HOST" "echo 'Connected'" 2>/dev/null; then
  echo "Failed to connect to $HOST"
  exit 1
fi
echo "✓ Connected"
echo ""

# Run deployment
echo "Starting deployment..."
echo ""
ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "$USER@$HOST" << 'EOF'
set -euo pipefail
cd /home/ubuntu/app

# Configure
export DO_PULL_OLLAMA=1
export VITE_HMR_HOST="107.20.229.198"
export VITE_HMR_CLIENT_PORT=443
export VITE_HMR_PROTOCOL=wss
export VITE_HMR_PATH=/vite-hmr
export OLLAMA_API_PREFIX="/v1"

echo "Step 1: Deploying..."
bash scripts/deploy_to_server.sh -n -H 107.20.229.198 -p 443 -P wss

echo ""
echo "Step 2: Waiting for services..."
sleep 30

echo "Step 3: Running pre-flight checks..."
bash scripts/production_preflight_check.sh \
  -b "http://localhost/api" \
  -l "http://localhost:8001" \
  -r "redis:6379"

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "Access your app at:"
echo "  • Frontend: http://107.20.229.198"
echo "  • API: http://107.20.229.198/api"
echo "  • HMR: wss://107.20.229.198/vite-hmr"
EOF

echo ""
echo "✓ Deployment finished!"
echo ""
echo "Next steps:"
echo "  1. Test the frontend: http://107.20.229.198"
echo "  2. Monitor logs: ssh -i '$KEY' $USER@$HOST docker compose logs -f"
echo ""
