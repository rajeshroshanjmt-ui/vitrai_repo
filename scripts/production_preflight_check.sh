#!/usr/bin/env bash
# Production Pre-Flight Deployment Checklist
# Validates environment, services, providers, and network before going live.
#
# Usage:
#   # Local development check
#   ./scripts/production_preflight_check.sh
#
#   # Remote server check via SSH
#   ssh ubuntu@HOST 'bash -s' < scripts/production_preflight_check.sh -- \
#     -b http://localhost/api \
#     -l http://localhost:8001 \
#     -r redis:6379
#
# Options:
#   -b BASE_URL       Backend API base URL (default: http://localhost/api)
#   -l LANGGRAPH_URL  LangGraph health URL (default: http://localhost:8001)
#   -r REDIS_URL      Redis host:port (default: redis:6379)
#   -d DB_CONTEXT     Database connection name or path in docker logs (default: postgres)
#   -q DOCKER         Use 'docker' or 'podman' (default: docker)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost/api}"
LANGGRAPH_URL="${LANGGRAPH_URL:-http://localhost:8001}"
REDIS_URL="${REDIS_URL:-redis:6379}"
DB_CONTEXT="${DB_CONTEXT:-postgres}"
DOCKER_CMD="${DOCKER_CMD:-docker}"
TIMEOUT_SECS=5

# Tracking
CHECKS_PASSED=0
CHECKS_FAILED=0
WARNINGS=0

# Helper functions
log_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((CHECKS_PASSED++))
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
  ((CHECKS_FAILED++))
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARNINGS++))
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_section() {
  echo
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main checks

log_section "Environment Variables"

# Critical env vars for production
CRITICAL_VARS=(
  "JWT_SECRET"
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_DB"
  "REDIS_HOST"
  "REDIS_PORT"
  "DEFAULT_LLM_PROVIDER"
)

for var in "${CRITICAL_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    log_fail "$var is not set"
  else
    log_pass "$var is set"
  fi
done

# Warn on weak JWT secrets
JWT_SECRET="${JWT_SECRET:-}"
if [ ${#JWT_SECRET} -lt 32 ]; then
  log_warn "JWT_SECRET is shorter than 32 characters; consider using a stronger secret"
fi

# Provider-specific env var checks
log_section "LLM Provider Configuration"

DEFAULT_LLM="${DEFAULT_LLM_PROVIDER:-ollama}"
log_info "DEFAULT_LLM_PROVIDER: $DEFAULT_LLM"

if [ "$DEFAULT_LLM" = "openai" ] || [ -n "${OPENAI_API_KEY:-}" ]; then
  if [ -z "${OPENAI_API_KEY:-}" ]; then
    log_fail "OPENAI_API_KEY is required for OpenAI but not set"
  else
    log_pass "OPENAI_API_KEY is set"
  fi
  if [ -z "${OPENAI_MODEL:-}" ]; then
    log_warn "OPENAI_MODEL not set; will use default (gpt-4o-mini)"
  else
    log_pass "OPENAI_MODEL: ${OPENAI_MODEL}"
  fi
fi

if [ "$DEFAULT_LLM" = "anthropic" ] || [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    log_fail "ANTHROPIC_API_KEY is required for Anthropic but not set"
  else
    log_pass "ANTHROPIC_API_KEY is set"
  fi
  if [ -z "${ANTHROPIC_MODEL:-}" ]; then
    log_warn "ANTHROPIC_MODEL not set; will use default"
  else
    log_pass "ANTHROPIC_MODEL: ${ANTHROPIC_MODEL}"
  fi
fi

if [ "$DEFAULT_LLM" = "azure_openai" ] || [ -n "${AZURE_OPENAI_API_KEY:-}" ]; then
  if [ -z "${AZURE_OPENAI_ENDPOINT:-}" ]; then
    log_fail "AZURE_OPENAI_ENDPOINT is required for Azure OpenAI but not set"
  else
    log_pass "AZURE_OPENAI_ENDPOINT is set"
  fi
  if [ -z "${AZURE_OPENAI_DEPLOYMENT:-}" ]; then
    log_fail "AZURE_OPENAI_DEPLOYMENT is required for Azure OpenAI but not set"
  else
    log_pass "AZURE_OPENAI_DEPLOYMENT: ${AZURE_OPENAI_DEPLOYMENT}"
  fi
fi

if [ "$DEFAULT_LLM" = "ollama" ] || [ -n "${OLLAMA_BASE_URL:-}" ]; then
  if [ -z "${OLLAMA_BASE_URL:-}" ]; then
    log_fail "OLLAMA_BASE_URL is required for Ollama but not set"
  else
    log_pass "OLLAMA_BASE_URL: ${OLLAMA_BASE_URL}"
  fi
  if [ -z "${OLLAMA_LLM_MODEL:-}" ]; then
    log_warn "OLLAMA_LLM_MODEL not set; will use default (llama3.2)"
  else
    log_pass "OLLAMA_LLM_MODEL: ${OLLAMA_LLM_MODEL}"
  fi
fi

log_section "Service Connectivity"

# Backend health
log_info "Testing backend health at $BASE_URL/health/ready"
if curl -fsS --max-time "$TIMEOUT_SECS" "$BASE_URL/health/ready" > /dev/null 2>&1; then
  log_pass "Backend is ready"
else
  log_fail "Backend health check failed (URL: $BASE_URL/health/ready)"
fi

# LangGraph health
log_info "Testing LangGraph health at $LANGGRAPH_URL/health/ready"
if curl -fsS --max-time "$TIMEOUT_SECS" "$LANGGRAPH_URL/health/ready" > /dev/null 2>&1; then
  log_pass "LangGraph worker is ready"
else
  log_fail "LangGraph health check failed (URL: $LANGGRAPH_URL/health/ready)"
fi

# Database connectivity (check via docker logs or direct connection)
log_info "Checking database connectivity"
if [ -n "${DATABASE_URL:-}" ]; then
  # Try parsing the connection string
  if echo "$DATABASE_URL" | grep -q "postgresql"; then
    log_pass "PostgreSQL connection string is configured"
  else
    log_warn "DATABASE_URL is set but may not be PostgreSQL"
  fi
else
  log_fail "DATABASE_URL environment variable is not set"
fi

# Redis connectivity
log_info "Checking Redis connectivity at $REDIS_URL"
REDIS_HOST="${REDIS_URL%:*}"
REDIS_PORT="${REDIS_URL#*:}"
if timeout "$TIMEOUT_SECS" bash -c "exec 3<>/dev/tcp/$REDIS_HOST/$REDIS_PORT" 2>/dev/null; then
  log_pass "Redis is reachable at $REDIS_URL"
else
  log_fail "Cannot connect to Redis at $REDIS_URL"
fi

log_section "LLM Provider Connectivity"

# Test Ollama endpoint if configured
if [ -n "${OLLAMA_BASE_URL:-}" ]; then
  log_info "Testing Ollama connectivity at ${OLLAMA_BASE_URL}/api/tags"
  OLLAMA_RESPONSE=$(curl -fsS --max-time "$TIMEOUT_SECS" "${OLLAMA_BASE_URL}/api/tags" 2>/dev/null || echo "")
  if [ -n "$OLLAMA_RESPONSE" ]; then
    log_pass "Ollama /api/tags endpoint responding"
    # Try /v1 as well
    if curl -fsS --max-time 2 "${OLLAMA_BASE_URL}/v1/tags" > /dev/null 2>&1; then
      log_warn "Both /api and /v1 paths exist; /api will be used by default (override with OLLAMA_API_PREFIX=/v1)"
    fi
  else
    # Try /v1 variant
    if curl -fsS --max-time "$TIMEOUT_SECS" "${OLLAMA_BASE_URL}/v1/tags" > /dev/null 2>&1; then
      log_warn "Ollama /api/tags failed but /v1/tags succeeded; make sure OLLAMA_API_PREFIX=/v1 is set"
    else
      log_fail "Ollama is not responding at ${OLLAMA_BASE_URL}"
    fi
  fi

  # Check model availability
  OLLAMA_LLM="${OLLAMA_LLM_MODEL:-llama3.2}"
  OLLAMA_EMBED="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"
  log_info "Checking Ollama model availability ($OLLAMA_LLM, $OLLAMA_EMBED)"
  MODELS=$(curl -fsS --max-time "$TIMEOUT_SECS" "${OLLAMA_BASE_URL}/api/tags" 2>/dev/null | grep -o '"name":"[^"]*"' | cut -d'"' -f4 || echo "")
  if echo "$MODELS" | grep -q "$OLLAMA_LLM"; then
    log_pass "Ollama model $OLLAMA_LLM is available"
  else
    log_warn "Ollama model $OLLAMA_LLM is not available; pull it with: docker exec vetrai-ollama-1 ollama pull $OLLAMA_LLM"
  fi
  if echo "$MODELS" | grep -q "$OLLAMA_EMBED"; then
    log_pass "Ollama embedding model $OLLAMA_EMBED is available"
  else
    log_warn "Ollama embedding model $OLLAMA_EMBED is not available; pull it with: docker exec vetrai-ollama-1 ollama pull $OLLAMA_EMBED"
  fi
fi

# Test OpenAI endpoint if configured
if [ -n "${OPENAI_API_KEY:-}" ]; then
  log_info "Validating OpenAI API configuration"
  OPENAI_ENDPOINT="${OPENAI_BASE_URL:-https://api.openai.com}"
  if [[ "$OPENAI_ENDPOINT" == https://* ]]; then
    log_pass "OpenAI endpoint uses HTTPS"
  else
    log_warn "OpenAI endpoint does not use HTTPS; ensure your network is secure"
  fi
  # Don't actually call the API to avoid quota/cost, just check the endpoint is reachable
  if curl -fsS --max-time 5 -I "${OPENAI_ENDPOINT}/v1/models" -H "Authorization: Bearer ${OPENAI_API_KEY}" > /dev/null 2>&1; then
    log_pass "OpenAI API is reachable and key appears valid"
  else
    log_warn "Could not reach OpenAI API; check network and API key"
  fi
fi

# Test Anthropic endpoint if configured
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  log_info "Validating Anthropic API configuration"
  ANTHROPIC_ENDPOINT="${ANTHROPIC_BASE_URL:-https://api.anthropic.com}"
  if curl -fsS --max-time 5 -I "${ANTHROPIC_ENDPOINT}/v1/messages" \
           -H "x-api-key: ${ANTHROPIC_API_KEY}" > /dev/null 2>&1; then
    log_pass "Anthropic API is reachable and key appears valid"
  else
    log_warn "Could not reach Anthropic API; check network and API key"
  fi
fi

# Test Azure OpenAI if configured
if [ -n "${AZURE_OPENAI_API_KEY:-}" ]; then
  log_info "Validating Azure OpenAI configuration"
  if [ -z "${AZURE_OPENAI_ENDPOINT:-}" ]; then
    log_fail "AZURE_OPENAI_ENDPOINT is not set"
  else
    AZURE_ENDPOINT="${AZURE_OPENAI_ENDPOINT%/}"
    if curl -fsS --max-time 5 -I "${AZURE_ENDPOINT}/openai/deployments" \
             -H "api-key: ${AZURE_OPENAI_API_KEY}" > /dev/null 2>&1; then
      log_pass "Azure OpenAI endpoint is reachable"
    else
      log_warn "Could not reach Azure OpenAI endpoint; check network and API key"
    fi
  fi
fi

log_section "Security & Network"

# Check for HTTPS in production
if [[ "$BASE_URL" == *"https://"* ]]; then
  log_pass "Backend uses HTTPS"
else
  log_warn "Backend is not using HTTPS; ensure it's behind a load balancer with TLS termination in production"
fi

# Check environment
if [ "${APP_ENV:-}" = "production" ]; then
  log_pass "APP_ENV is set to production"
else
  log_warn "APP_ENV is not set to 'production'; make sure this is intentional for this deployment"
fi

# Check sensitive env vars are not logged
if [ -n "${JWT_SECRET:-}" ] && [ "${JWT_SECRET:-}" != "change-me" ]; then
  log_pass "JWT_SECRET appears to be non-default"
else
  log_fail "JWT_SECRET is using default or weak value; set a strong random secret"
fi

log_section "Summary"
echo
echo -e "Passed:  ${GREEN}$CHECKS_PASSED${NC}"
echo -e "Failed:  ${RED}$CHECKS_FAILED${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo

if [ "$CHECKS_FAILED" -gt 0 ]; then
  echo -e "${RED}❌ Deployment blocked: $CHECKS_FAILED critical checks failed.${NC}"
  echo "Fix the issues above and re-run this check."
  exit 1
elif [ "$WARNINGS" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Deployment allowed with $WARNINGS warnings.${NC}"
  echo "Review the warnings above before proceeding to production."
  exit 0
else
  echo -e "${GREEN}✅ All checks passed! Deployment is ready.${NC}"
  exit 0
fi
