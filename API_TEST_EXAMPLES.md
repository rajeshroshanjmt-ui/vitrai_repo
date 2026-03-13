# Vetrai API - Manual Testing Examples

All examples use `curl`. Substitute `<token>`, `<tenant_id>`, etc. with actual values.

---

## Environment Variables (Save to .env.test)

```bash
API_BASE="http://localhost/api"
TENANT_ID="test-tenant-001"
TEST_EMAIL="testuser@vetrai.local"
TEST_PASSWORD="TestPassword123"
```

Source in bash:
```bash
source .env.test
```

---

## 1. Authentication Endpoints

### Register a New User

```bash
curl -X POST "$API_BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$TEST_EMAIL'",
    "password": "'$TEST_PASSWORD'",
    "tenant_id": "'$TENANT_ID'",
    "role": "admin"
  }'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

Save the token:
```bash
TOKEN=$(curl -s -X POST "$API_BASE/auth/register" ... | jq -r '.access_token')
```

### Login with Email & Password

```bash
curl -X POST "$API_BASE/auth/token" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "'$TEST_EMAIL'",
    "password": "'$TEST_PASSWORD'",
    "tenant_id": "'$TENANT_ID'"
  }'
```

### Get Current User Info

```bash
curl -X GET "$API_BASE/auth/me" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "email": "testuser@vetrai.local",
  "tenant_id": "test-tenant-001",
  "role": "admin",
  "user_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## 2. Flow Management

### Create a Flow

```bash
curl -X POST "$API_BASE/flows/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My Test Flow",
    "json_definition": {
      "nodes": [],
      "edges": []
    }
  }'
```

**Save the Flow ID:**
```bash
FLOW_ID=$(curl -s -X POST "$API_BASE/flows/create" ... | jq -r '.id')
```

### Save Flow Draft

```bash
curl -X PUT "$API_BASE/flows/$FLOW_ID/draft" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "json_definition": {
      "nodes": [
        {
          "id": "node-1",
          "type": "input",
          "data": {
            "label": "User Message",
            "name": "message"
          }
        }
      ],
      "edges": []
    }
  }'
```

### Publish a Flow

```bash
curl -X POST "$API_BASE/flows/$FLOW_ID/publish" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "version": 1
  }'
```

### List All Flows

```bash
curl -X GET "$API_BASE/flows/list?limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

### Get Single Flow Details

```bash
curl -X GET "$API_BASE/flows/$FLOW_ID" \
  -H "Authorization: Bearer $TOKEN"
```

### Delete a Flow

```bash
curl -X DELETE "$API_BASE/flows/$FLOW_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Flow Execution

### Execute a Flow (Chat)

```bash
curl -X POST "$API_BASE/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "input": {
      "message": "What is 25 * 4?"
    },
    "enable_tools": true,
    "llm_provider": "ollama",
    "llm_model": "llama3.2"
  }'
```

**Expected Response:**
```json
{
  "status": "completed",
  "response_text": "25 times 4 equals 100.",
  "tokens_used": 42,
  "execution_time_ms": 245,
  "tool_output": "calculator=100"
}
```

### Execute with Different LLM Provider

```bash
# Using OpenAI (requires OPENAI_API_KEY set)
curl -X POST "$API_BASE/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "input": {"message": "Hello"},
    "llm_provider": "openai",
    "llm_model": "gpt-4o-mini"
  }'
```

---

## 4. Execution History

### Get All Execution Logs

```bash
curl -X GET "$API_BASE/flows/logs?limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

**Response contains:**
```json
[
  {
    "execution_log_id": "...",
    "flow_id": "...",
    "flow_version": 1,
    "status": "completed",
    "tokens_used": 42,
    "execution_time_ms": 245,
    "response_text": "...",
    "error_message": null,
    "created_at": "2026-03-11T20:15:30.123456+00:00"
  }
]
```

### Delete an Execution

```bash
curl -X DELETE "$API_BASE/flows/logs/$EXECUTION_LOG_ID" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. Document Ingestion (RAG)

### Ingest Documents

```bash
curl -X POST "$API_BASE/flows/$FLOW_ID/documents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "documents": [
      {
        "text": "Vetrai is a multi-tenant AI workflow platform built with FastAPI and LangGraph.",
        "source": "documentation",
        "metadata": {
          "page": 1,
          "section": "intro"
        }
      },
      {
        "text": "Users can create flows, execute them, and monitor performance with audit logs.",
        "source": "features",
        "metadata": {
          "category": "flow-management"
        }
      }
    ]
  }'
```

### Get Ingestion Jobs

```bash
curl -X GET "$API_BASE/flows/$FLOW_ID/ingestions" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 6. Tools Configuration

### Get Current Tool States

```bash
curl -X GET "$API_BASE/flows/tools/state" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "calculator": true,
  "sql_tool": true,
  "retriever": true,
  "http_fetch": false
}
```

### Update Tool States

```bash
curl -X PUT "$API_BASE/flows/tools/state" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "states": {
      "calculator": true,
      "sql_tool": true,
      "http_fetch": true,
      "retriever": true
    }
  }'
```

### Test Calculator Tool

```bash
curl -X POST "$API_BASE/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "input": {
      "tool": "calculator",
      "expression": "2**10 + 3*5"
    },
    "enable_tools": true
  }'
```

### Test SQL Tool

```bash
curl -X POST "$API_BASE/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "input": {
      "tool": "sql_tool",
      "query": "SELECT COUNT(*) as user_count FROM users WHERE tenant_id = '\''test-tenant-001'\''"
    },
    "enable_tools": true
  }'
```

### Test HTTP Fetch Tool

```bash
curl -X POST "$API_BASE/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "input": {
      "tool": "http_fetch",
      "url": "https://api.github.com/zen",
      "method": "GET"
    },
    "enable_tools": true
  }'
```

---

## 7. Usage & Metrics

### Get Token Usage Statistics

```bash
curl -X GET "$API_BASE/flows/usage" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{
  "total_tokens_used": 1234,
  "daily_stats": [
    {
      "date": "2026-03-11",
      "tokens_used": 234,
      "execution_count": 12,
      "avg_execution_time_ms": 245
    }
  ],
  "execution_latencies": {
    "p50": 120,
    "p95": 280,
    "p99": 450
  },
  "queue_depth": {
    "execution_queue": 2,
    "ingest_queue": 0
  },
  "slo": {
    "target_p95_ms": 300,
    "current_p95_ms": 280,
    "status": "passed"
  }
}
```

---

## 8. Audit Logs

### Get Audit Logs (Admin Only)

```bash
curl -X GET "$API_BASE/flows/audit?days=7&action=execute" \
  -H "Authorization: Bearer $TOKEN"
```

**Query Parameters:**
- `days`: Number of days to look back (default: 7)
- `action`: Filter by action (create, update, delete, execute, etc.)
- `resource_type`: Filter by resource type (flow, execution, credential)

**Response:**
```json
[
  {
    "id": "...",
    "tenant_id": "test-tenant-001",
    "actor_user_id": "550e8400-...",
    "actor_email": "testuser@vetrai.local",
    "actor_role": "admin",
    "action": "execute",
    "resource_type": "flow",
    "resource_id": "flow-123",
    "details": {
      "llm_provider": "ollama",
      "tokens_used": 42
    },
    "created_at": "2026-03-11T20:15:30.123456+00:00"
  }
]
```

---

## 9. Agent Guardrails (Advanced)

### Get Agent Task Configuration

```bash
curl -X GET "$API_BASE/agent/tasks/config" \
  -H "Authorization: Bearer $TOKEN"
```

### Evaluate Agent Task (Before Execution)

```bash
curl -X POST "$API_BASE/agent/tasks/evaluate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "task_type": "code_execution",
    "requested_paths": ["/app/src"],
    "tools_required": ["calculator", "http_fetch"],
    "estimated_tokens": 5000,
    "expected_duration_ms": 30000
  }'
```

### Report Agent Task Completion

```bash
curl -X POST "$API_BASE/agent/tasks/report" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "task_id": "...",
    "status": "completed",
    "tokens_used": 4800,
    "duration_ms": 28500,
    "files_changed": 2,
    "bytes_changed": 1024,
    "branch": "feature/test",
    "pr_url": "https://github.com/user/repo/pull/123"
  }'
```

---

## 10. Credentials Management

### Create Credentials

```bash
curl -X POST "$API_BASE/resources/credentials" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "resource_type": "credentials",
    "name": "openai-prod",
    "payload": {
      "type": "openai",
      "api_key": "sk-..."
    }
  }'
```

### List Credentials

```bash
curl -X GET "$API_BASE/resources/credentials" \
  -H "Authorization: Bearer $TOKEN"
```

### Delete Credentials

```bash
curl -X DELETE "$API_BASE/resources/credentials/credential-id" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 11. Dead Letter Queue Management

### List Failed Execution DLQ

```bash
curl -X GET "$API_BASE/flows/dlq/execution" \
  -H "Authorization: Bearer $TOKEN"
```

### Replay DLQ Entry

```bash
curl -X POST "$API_BASE/flows/dlq/execution/replay" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "redis_index": 0,
    "keep_in_dlq": false,
    "target_queue": "execution_queue"
  }'
```

### Delete DLQ Entry

```bash
curl -X DELETE "$API_BASE/flows/dlq/execution/0" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 12. Error Response Examples

### Invalid Credentials
```json
{
  "detail": "Invalid credentials"
}
HTTP 401 Unauthorized
```

### Insufficient Permissions
```json
{
  "detail": "Insufficient role"
}
HTTP 403 Forbidden
```

### Flow Not Found
```json
{
  "detail": "Flow not found"
}
HTTP 404 Not Found
```

### Validation Error
```json
{
  "detail": [
    {
      "type": "value_error.email",
      "loc": ["body", "email"],
      "msg": "invalid email format"
    }
  ]
}
HTTP 422 Unprocessable Entity
```

---

## Testing Workflow (Copy-Paste Friendly)

```bash
#!/bin/bash
set -e

API="http://localhost/api"
EMAIL="test-$(date +%s)@vetrai.local"
PASS="TestPass123"
TENANT="tenant-$(date +%s)"

echo "1. Register..."
TOKEN=$(curl -s -X POST "$API/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"tenant_id\":\"$TENANT\",\"role\":\"admin\"}" | \
  jq -r '.access_token')

echo "Token: $TOKEN"
echo ""

echo "2. Create Flow..."
FLOW=$(curl -s -X POST "$API/flows/create" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Test","json_definition":{}}')

FLOW_ID=$(echo "$FLOW" | jq -r '.id')
echo "Flow ID: $FLOW_ID"
echo ""

echo "3. Execute Flow..."
EXEC=$(curl -s -X POST "$API/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"input":{"message":"Hello"},"enable_tools":true}')

echo "$EXEC" | jq .
echo ""

echo "4. Get Usage..."
curl -s -X GET "$API/flows/usage" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Useful jq Commands

```bash
# Extract token from response
curl ... | jq -r '.access_token'

# Pretty print JSON
curl ... | jq .

# Extract nested field
curl ... | jq '.data[0].execution_log_id'

# Filter array
curl ... | jq '.[] | select(.status=="completed")'

# Count items
curl ... | jq 'length'
```

---

## Performance Benchmarking

```bash
# Test API latency
time curl -X POST "$API/flows/$FLOW_ID/execute" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"input":{"message":"test"}}'

# Load test (requires Apache Bench: ab)
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  "$API/flows/list"
```

---

**Last Updated:** March 11, 2026
**API Version:** 1.0.0
