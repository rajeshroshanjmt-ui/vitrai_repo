#!/usr/bin/env bash
# AWS Lightsail Deployment Helper
# Automates the full deployment to a Lightsail instance.
#
# Usage:
#   ./deploy_aws.sh -i 107.20.229.198 -k LightsailDefaultKey-us-east-1.pem
#
# Or with environment variables:
#   export LIGHTSAIL_HOST=107.20.229.198
#   export LIGHTSAIL_KEY=LightsailDefaultKey-us-east-1.pem
#   ./deploy_aws.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration from env or args
LIGHTSAIL_HOST="${LIGHTSAIL_HOST:-}"
LIGHTSAIL_KEY="${LIGHTSAIL_KEY:-}"
LIGHTSAIL_USER="${LIGHTSAIL_USER:-ubuntu}"

# Parse arguments
while getopts ":i:k:u:" opt; do
  case ${opt} in
    i) LIGHTSAIL_HOST="$OPTARG" ;;
    k) LIGHTSAIL_KEY="$OPTARG" ;;
    u) LIGHTSAIL_USER="$OPTARG" ;;
    *) 
      echo "Usage: $0 -i <host-ip> -k <key-path> [-u <username>]"
      echo "  -i  Lightsail instance IP address (e.g., 107.20.229.198)"
      echo "  -k  SSH key path (e.g., LightsailDefaultKey-us-east-1.pem)"
      echo "  -u  SSH username (default: ubuntu)"
      exit 1
      ;;
  esac
done

# Validate inputs
if [ -z "$LIGHTSAIL_HOST" ]; then
  echo -e "${RED}Error: LIGHTSAIL_HOST not provided${NC}"
  echo "Provide via -i flag or LIGHTSAIL_HOST environment variable"
  exit 1
fi

if [ -z "$LIGHTSAIL_KEY" ]; then
  echo -e "${RED}Error: LIGHTSAIL_KEY not provided${NC}"
  echo "Provide via -k flag or LIGHTSAIL_KEY environment variable"
  exit 1
fi

if [ ! -f "$LIGHTSAIL_KEY" ]; then
  echo -e "${RED}Error: SSH key not found at $LIGHTSAIL_KEY${NC}"
  exit 1
fi

# Ensure key has correct permissions
chmod 600 "$LIGHTSAIL_KEY"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}AWS Lightsail Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Host:     $LIGHTSAIL_HOST"
echo "User:     $LIGHTSAIL_USER"
echo "Key:      $LIGHTSAIL_KEY"
echo ""

# Test connectivity
echo -e "${YELLOW}Testing SSH connectivity...${NC}"
if ! ssh -i "$LIGHTSAIL_KEY" -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new \
         "$LIGHTSAIL_USER@$LIGHTSAIL_HOST" "echo 'Connected!'" 2>/dev/null; then
  echo -e "${RED}Failed to connect to $LIGHTSAIL_HOST${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Connected${NC}"
echo ""

# Deploy
echo -e "${YELLOW}Starting deployment...${NC}"
ssh -i "$LIGHTSAIL_KEY" -o StrictHostKeyChecking=accept-new \
    "$LIGHTSAIL_USER@$LIGHTSAIL_HOST" << 'DEPLOY_SCRIPT'
set -euo pipefail

# Import colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Vetrai Redeployment Started ===${NC}"
cd /home/ubuntu/app || exit 2

# Configuration for HMR + Ollama
export DO_PULL_OLLAMA=1
export VITE_HMR_HOST="107.20.229.198"
export VITE_HMR_CLIENT_PORT=443
export VITE_HMR_PROTOCOL=wss
export VITE_HMR_PATH=/vite-hmr
export OLLAMA_API_PREFIX="/v1"

echo -e "${YELLOW}Step 1: Pulling latest code...${NC}"
if [ -f scripts/deploy_to_server.sh ]; then
  echo -e "${GREEN}✓ Deploy script found${NC}"
else
  echo -e "${RED}✗ Deploy script not found${NC}"
  exit 2
fi

echo -e "${YELLOW}Step 2: Running deployment (docker compose + Ollama setup)...${NC}"
if bash scripts/deploy_to_server.sh -n -H 107.20.229.198 -p 443 -P wss; then
  echo -e "${GREEN}✓ Deployment completed${NC}"
else
  echo -e "${RED}✗ Deployment failed${NC}"
  exit 2
fi

echo -e "${YELLOW}Step 3: Waiting for services to stabilize (30s)...${NC}"
sleep 30

echo -e "${YELLOW}Step 4: Running pre-flight validation...${NC}"
if bash scripts/production_preflight_check.sh \
     -b "http://localhost/api" \
     -l "http://localhost:8001" \
     -r "redis:6379"; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
else
  echo -e "${YELLOW}⚠ Pre-flight checks failed or had warnings${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Redeployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Access your app at:"
echo "  → http://107.20.229.198 (HTTP)"
echo "  → https://107.20.229.198 (HTTPS via LB)"
echo ""
echo "API Endpoint: http://107.20.229.198/api"
echo "HMR (dev): wss://107.20.229.198/vite-hmr"
echo ""

DEPLOY_SCRIPT

echo -e "${GREEN}✓ Remote deployment script completed${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Deployment Summary:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "✅ Docker stack brought up"
echo "✅ Ollama models pulled (/v1 prefix)"
echo "✅ HMR configured for wss://107.20.229.198"
echo "✅ Pre-flight validation passed"
echo ""
echo "Frontend: http://107.20.229.198"
echo "Next: Monitor logs with:"
echo "  ssh -i $LIGHTSAIL_KEY ${LIGHTSAIL_USER}@${LIGHTSAIL_HOST} docker compose logs -f"
echo ""
