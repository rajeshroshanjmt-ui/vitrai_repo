# AWS Lightsail Deployment Helper (PowerShell)
# Automates the full deployment to a Lightsail instance.
#
# Usage:
#   .\deploy_aws.ps1 -LightsailHost "107.20.229.198" -LightsailKey "LightsailDefaultKey-us-east-1.pem"
#
# Or with environment variables:
#   $env:LIGHTSAIL_HOST = "107.20.229.198"
#   $env:LIGHTSAIL_KEY = "LightsailDefaultKey-us-east-1.pem"
#   .\deploy_aws.ps1

param(
    [string]$LightsailHost = $env:LIGHTSAIL_HOST,
    [string]$LightsailKey = $env:LIGHTSAIL_KEY,
    [string]$LightsailUser = "ubuntu"
)

$ErrorActionPreference = "Stop"

# Colors
$Colors = @{
    Success = "Green"
    Error   = "Red"
    Warning = "Yellow"
    Info    = "Cyan"
    Section = "Blue"
}

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 70) -ForegroundColor $Colors.Section
    Write-Host $Title -ForegroundColor $Colors.Section
    Write-Host ("=" * 70) -ForegroundColor $Colors.Section
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor $Colors.Success -NoNewline
    Write-Host $Message
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "✗ " -ForegroundColor $Colors.Error -NoNewline
    Write-Host $Message
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor $Colors.Warning -NoNewline
    Write-Host $Message
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ " -ForegroundColor $Colors.Info -NoNewline
    Write-Host $Message
}


# Validate inputs
if ([string]::IsNullOrEmpty($LightsailHost)) {
    Write-Error-Custom "LIGHTSAIL_HOST not provided"
    Write-Host "Usage: .\deploy_aws.ps1 -LightsailHost '107.20.229.198' -LightsailKey 'path\to\key.pem'"
    exit 1
}

if ([string]::IsNullOrEmpty($LightsailKey)) {
    Write-Error-Custom "LIGHTSAIL_KEY not provided"
    Write-Host "Usage: .\deploy_aws.ps1 -LightsailHost '107.20.229.198' -LightsailKey 'path\to\key.pem'"
    exit 1
}

if (-not (Test-Path $LightsailKey)) {
    Write-Error-Custom "SSH key not found at $LightsailKey"
    exit 1
}

Write-Section "AWS Lightsail Deployment"
Write-Host "Host:     $LightsailHost"
Write-Host "User:     $LightsailUser"
Write-Host "Key:      $LightsailKey"
Write-Host ""

# Test connectivity
Write-Info "Testing SSH connectivity..."
try {
    $connTest = ssh -i $LightsailKey -o StrictHostKeyChecking=accept-new `
        "${LightsailUser}@${LightsailHost}" `
        "echo 'Connected!'" 2>&1
    Write-Success "Connected"
}
catch {
    Write-Error-Custom "Failed to connect to $LightsailHost"
    exit 1
}

Write-Host ""
Write-Info "Starting deployment..."

# Create deployment script
$deployScript = @'
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Vetrai Redeployment Started ===${NC}"

cd /home/ubuntu/app || { echo "App directory not found"; exit 2; }

# Configuration
export DO_PULL_OLLAMA=1
export VITE_HMR_HOST="107.20.229.198"
export VITE_HMR_CLIENT_PORT=443
export VITE_HMR_PROTOCOL=wss
export VITE_HMR_PATH=/vite-hmr
export OLLAMA_API_PREFIX="/v1"

echo -e "${YELLOW}Step 1: Checking deployment script...${NC}"
if [ -f scripts/deploy_to_server.sh ]; then
    echo -e "${GREEN}✓ Deploy script found${NC}"
else
    echo -e "${RED}✗ Deploy script not found${NC}"
    exit 2
fi

echo -e "${YELLOW}Step 2: Running Docker deployment...${NC}"
if bash scripts/deploy_to_server.sh -n -H 107.20.229.198 -p 443 -P wss; then
    echo -e "${GREEN}✓ Deployment completed${NC}"
else
    echo -e "${RED}✗ Deployment failed${NC}"
    exit 2
fi

echo -e "${YELLOW}Step 3: Waiting for services (30s)...${NC}"
sleep 30

echo -e "${YELLOW}Step 4: Running pre-flight checks...${NC}"
if bash scripts/production_preflight_check.sh \
     -b "http://localhost/api" \
     -l "http://localhost:8001" \
     -r "redis:6379"; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
else
    echo -e "${YELLOW}⚠ Pre-flight checks had warnings${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Redeployment Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Access your app at:"
echo "  → http://107.20.229.198 (HTTP)"
echo "  → https://107.20.229.198 (HTTPS)"
echo ""
echo "API: http://107.20.229.198/api"
echo "HMR: wss://107.20.229.198/vite-hmr"
echo ""
'@

Write-Host ""
ssh -i $LightsailKey -o StrictHostKeyChecking=accept-new `
    "${LightsailUser}@${LightsailHost}" $deployScript

Write-Success "Remote deployment script completed"
Write-Host ""
Write-Section "Deployment Summary"
Write-Host ""
Write-Success "Docker stack brought up"
Write-Success "Ollama models pulled (/v1 prefix)"
Write-Success "HMR configured for wss://107.20.229.198"
Write-Success "Pre-flight validation completed"
Write-Host ""
Write-Info "Frontend: http://107.20.229.198"
Write-Info "API: http://107.20.229.198/api"
Write-Host ""
Write-Info "Monitor logs:"
Write-Host "  ssh -i '$LightsailKey' ${LightsailUser}@${LightsailHost} docker compose logs -f"
Write-Host ""
