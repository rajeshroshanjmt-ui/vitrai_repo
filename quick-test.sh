#!/bin/bash

# Vetrai Platform - Quick Testing Script
# Run this after: docker compose up -d
# Prerequisites: curl, jq (optional for JSON formatting)

set -e

API_BASE="http://localhost/api"
TENANT_ID="test-tenant-$(date +%s)"
TEST_EMAIL="testuser-$(date +%s)@vetrai.local"
TEST_PASSWORD="TestPassword123"

echo "=================================================="
echo "Vetrai Platform - Quick Test Suite"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
test_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC}: $2"
  else
    echo -e "${RED}✗ FAILED${NC}: $2"
  fi
}

# Function to make API calls
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  local token=$4

  if [ -z "$token" ]; then
    curl -s -X "$method" "$API_BASE$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$API_BASE$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$data"
  fi
}

# ============================================================================
# SECTION 1: Health Checks
# ============================================================================
echo -e "${YELLOW}[1/5] HEALTH CHECKS${NC}"
echo "---"

HEALTH=$(curl -s http://localhost/api/health)
if echo "$HEALTH" | grep -q "ok"; then
  test_result 0 "Backend health check"
else
  test_result 1 "Backend health check"
fi

READY=$(curl -s http://localhost/api/health/ready)
if echo "$READY" | grep -q "database.*ok" && echo "$READY" | grep -q "redis.*ok"; then
  test_result 0 "Backend readiness check"
else
  test_result 1 "Backend readiness check"
fi

echo ""

# ============================================================================
# SECTION 2: Authentication
# ============================================================================
echo -e "${YELLOW}[2/5] AUTHENTICATION TESTS${NC}"
echo "---"

# Test Registration
echo "Registering user: $TEST_EMAIL"
REGISTER_RESPONSE=$(api_call POST "/auth/register" \
  "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"tenant_id\":\"$TENANT_ID\",\"role\":\"admin\"}")

TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  test_result 0 "User registration"
else
  test_result 1 "User registration"
  echo "Response: $REGISTER_RESPONSE"
fi

# Test Login
echo "Logging in with credentials..."
LOGIN_RESPONSE=$(api_call POST "/auth/token" \
  "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"tenant_id\":\"$TENANT_ID\"}")

LOGIN_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -n "$LOGIN_TOKEN" ]; then
  test_result 0 "User login"
  TOKEN=$LOGIN_TOKEN
else
  test_result 1 "User login"
  echo "Response: $LOGIN_RESPONSE"
fi

# Test Get Current User
ME=$(api_call GET "/auth/me" "" "$TOKEN")
if echo "$ME" | grep -q "$TEST_EMAIL"; then
  test_result 0 "Get current user (/auth/me)"
else
  test_result 1 "Get current user (/auth/me)"
fi

echo ""

# ============================================================================
# SECTION 3: Flow Management
# ============================================================================
echo -e "${YELLOW}[3/5] FLOW MANAGEMENT TESTS${NC}"
echo "---"

# Create Flow
echo "Creating test flow..."
CREATE_FLOW=$(api_call POST "/flows/create" \
  "{\"name\":\"Test Flow - $(date)\",\"json_definition\":{}}" \
  "$TOKEN")

FLOW_ID=$(echo "$CREATE_FLOW" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$FLOW_ID" ]; then
  test_result 0 "Create flow"
  echo "  Flow ID: $FLOW_ID"
else
  test_result 1 "Create flow"
  echo "Response: $CREATE_FLOW"
fi

# Save Draft
echo "Saving draft version..."
DRAFT=$(api_call PUT "/flows/$FLOW_ID/draft" \
  "{\"json_definition\":{\"nodes\":[],\"edges\":[]}}" \
  "$TOKEN")

if echo "$DRAFT" | grep -q "ok\|success"; then
  test_result 0 "Save flow draft"
else
  test_result 1 "Save flow draft"
fi

# List Flows
echo "Listing flows..."
FLOWS=$(api_call GET "/flows/list" "" "$TOKEN")

if echo "$FLOWS" | grep -q "$FLOW_ID"; then
  test_result 0 "List flows"
else
  test_result 1 "List flows"
fi

echo ""

# ============================================================================
# SECTION 4: Execution & Tools
# ============================================================================
echo -e "${YELLOW}[4/5] EXECUTION & TOOLS TESTS${NC}"
echo "---"

# Get Tool States
TOOL_STATES=$(api_call GET "/flows/tools/state" "" "$TOKEN")

if echo "$TOOL_STATES" | grep -q "calculator"; then
  test_result 0 "Get tool states"
else
  test_result 1 "Get tool states"
fi

# Update Tool States
TOOL_UPDATE=$(api_call PUT "/flows/tools/state" \
  "{\"states\":{\"calculator\":true,\"sql_tool\":false,\"http_fetch\":false}}" \
  "$TOKEN")

if echo "$TOOL_UPDATE" | grep -q "ok\|updated"; then
  test_result 0 "Update tool states"
else
  test_result 1 "Update tool states"
fi

echo ""

# ============================================================================
# SECTION 5: Audit & Compliance
# ============================================================================
echo -e "${YELLOW}[5/5] AUDIT & COMPLIANCE TESTS${NC}"
echo "---"

# Get Audit Logs
AUDIT=$(api_call GET "/flows/audit?days=1" "" "$TOKEN")

if echo "$AUDIT" | grep -q "create\|register"; then
  test_result 0 "Audit logs recording"
else
  test_result 1 "Audit logs recording"
fi

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
echo "=================================================="
echo -e "${GREEN}Testing Complete!${NC}"
echo "=================================================="
echo ""
echo "Test Credentials Created:"
echo "  Email: $TEST_EMAIL"
echo "  Password: $TEST_PASSWORD"
echo "  Tenant: $TENANT_ID"
echo "  Role: admin"
echo ""
echo "Test Flow Created:"
echo "  Flow ID: $FLOW_ID"
echo ""
echo "Next Steps:"
echo "  1. Open http://localhost in your browser"
echo "  2. Sign in with test credentials above"
echo "  3. Follow TESTING_GUIDE.md for detailed screen-by-screen tests"
echo ""
echo "API Token (for manual testing):"
echo "  $TOKEN"
echo ""
echo "Example API Call:"
echo "  curl -H 'Authorization: Bearer $TOKEN' http://localhost/api/flows/list"
echo ""
