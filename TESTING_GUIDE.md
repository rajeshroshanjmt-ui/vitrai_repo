# Vetrai Platform - Screen-by-Screen Testing Guide

## Prerequisites
- Docker Compose stack running: `docker compose up -d`
- All 8 services healthy: `docker compose ps`
- Frontend accessible: `http://localhost` or `http://localhost:3000`
- Backend API: `http://localhost/api`

---

## 1. Authentication Screens

### 1.1 Sign In Screen
**URL:** `http://localhost/auth/signin`

**Test Cases:**
- [ ] Page loads with email and password fields
- [ ] SSO buttons visible (Azure, Google, Auth0, GitHub) - appear but not functional
- [ ] "Forgot Password" link visible
- [ ] "Don't have an account?" link goes to register

**Test Login:**
```bash
# Prerequisite: Register a user first
POST /api/auth/register
{
  "email": "testuser@example.com",
  "password": "TestPassword123",
  "tenant_id": "tenant-001",
  "role": "admin"
}
```

Then test sign in:
- [ ] Enter valid email and password → redirects to dashboard
- [ ] Invalid password → "Invalid credentials" error
- [ ] Non-existent email → "Invalid credentials" error
- [ ] Empty fields → validation error
- [ ] JWT token stored in localStorage (`vetrai_access_token`)

### 1.2 Register Screen
**URL:** `http://localhost/auth/register`

**Test Cases:**
- [ ] Email field with validation (must be valid email format)
- [ ] Password field with strength indicator
- [ ] Tenant ID field (text input)
- [ ] Role dropdown (admin, editor, viewer)
- [ ] Submit button creates user and issues JWT

**Test Registration:**
```bash
POST /api/auth/register
{
  "email": "newuser@vetrai.tech",
  "password": "SecurePassword123",
  "tenant_id": "tenant-dev-001",
  "role": "editor"
}
```

Verify:
- [ ] User created in database
- [ ] JWT returned and stored
- [ ] Redirects to dashboard
- [ ] Duplicate registration blocked ("User already exists")

### 1.3 Forgot Password Screen
**URL:** `http://localhost/auth/forgotPassword`

- [ ] Screen renders
- [ ] Email input field visible
- [ ] "Send Reset Link" button (currently stub - no email backend)
- [ ] Note: Full email flow not implemented in this phase

---

## 2. Dashboard Screen

**URL:** `http://localhost/` (after login)

**Test Cases:**
- [ ] Welcome message with username
- [ ] Total flows count displayed
- [ ] Recent executions list
- [ ] Usage metrics visible (tokens used, execution time p95)
- [ ] Quick action buttons (Create Flow, View Executions)
- [ ] Navigation sidebar loads all menu items

**Key Metrics to Verify:**
- [ ] Token usage for current period
- [ ] Execution count by status (completed, failed, pending)
- [ ] Execution time latencies (p50, p95)
- [ ] Queue depth indicators

---

## 3. Flow Management Screens

### 3.1 Chat Flows List
**URL:** `http://localhost/chatflows`

**Test Cases:**
- [ ] List of all flows displays with name, created date, status
- [ ] "Create New Flow" button visible and functional
- [ ] Each flow has action buttons (Edit, Delete, Execute, View Details)
- [ ] Pagination works (if > 10 flows)
- [ ] Search/filter (by name) works

**Test Creating a Flow:**
```bash
POST /api/flows/create
Authorization: Bearer <token>
{
  "name": "Test Chat Flow",
  "json_definition": {
    "nodes": [],
    "edges": []
  }
}
```

Verify:
- [ ] Flow created and appears in list
- [ ] Flow status = "draft"
- [ ] Edit button opens canvas

### 3.2 Chat Flow Canvas
**URL:** `http://localhost/canvas/<flow_id>`

**Test Cases:**
- [ ] Canvas renders with ReactFlow
- [ ] Node palette visible on left (LLM nodes, input nodes, etc.)
- [ ] Drag-and-drop nodes onto canvas
- [ ] Connect nodes with edges
- [ ] Save as Draft button
- [ ] Publish button (requires at least one node)
- [ ] Undo/Redo buttons functional

**Test Draft Saving:**
```bash
PUT /api/flows/<flow_id>/draft
Authorization: Bearer <token>
{
  "json_definition": {
    "nodes": [
      {"id": "node-1", "type": "input", "data": {"label": "User Input"}}
    ],
    "edges": []
  }
}
```

Verify:
- [ ] "Saved" confirmation shows
- [ ] Version increments to v2

**Test Publishing:**
```bash
POST /api/flows/<flow_id>/publish
Authorization: Bearer <token>
{
  "version": 1
}
```

Verify:
- [ ] Flow status changes to "published"
- [ ] Execution becomes available
- [ ] Cannot publish draft without nodes

### 3.3 Agent Flows Canvas
**URL:** `http://localhost/agentflowsv2`

**Test Cases:**
- [ ] Same as Chat Flows but with agent-specific nodes
- [ ] Agent task configuration visible
- [ ] Tool selection (calculator, sql_tool, http_fetch, retriever)
- [ ] Policy guardrails preview
- [ ] Execute button routes to agent executor

---

## 4. Execution & Testing Screens

### 4.1 Execution Screen / Chat Interface
**URL:** `http://localhost/chatbot/<flow_id>`

**Test Cases:**
- [ ] Chat interface loads
- [ ] Message input field visible
- [ ] Send button functional
- [ ] System displays "thinking..." while processing
- [ ] Response appears with execution metadata (tokens, time)

**Test Basic Execution:**
```bash
POST /api/flows/<flow_id>/execute
Authorization: Bearer <token>
{
  "input": {"message": "What is the current time?"},
  "enable_tools": true,
  "llm_provider": "ollama",
  "llm_model": "llama3.2"
}
```

Verify:
- [ ] Execution queued in Redis
- [ ] LangGraph worker picks up job
- [ ] Response returned with:
  - Response text
  - Tokens used
  - Execution time (ms)
  - Status: "completed" or "failed"

**Test Tool Usage:**
- [ ] Calculator: "What is 25 * 4?" → 100
- [ ] Current Time: "What time is it?" → UTC timestamp
- [ ] SQL Tool: "Run: SELECT COUNT(*) FROM users" → table data
- [ ] HTTP Fetch: "GET https://api.example.com" → response body

### 4.2 Execution Details / History
**URL:** `http://localhost/agentexecutions`

**Test Cases:**
- [ ] List of all executions displays
- [ ] Columns: Status, Tokens, Time, Flow, Created Date
- [ ] Click execution → details panel
- [ ] View execution response, error messages
- [ ] Delete button removes execution

**Test Execution Deletion:**
```bash
DELETE /api/flows/logs/<execution_log_id>
Authorization: Bearer <token>
```

Verify:
- [ ] Execution removed from list
- [ ] Audit log entry created with action="delete"
- [ ] UI confirmation/toast shows

### 4.3 Execution Details Page
**URL:** `http://localhost/agentexecutions/<execution_id>`

**Test Cases:**
- [ ] Full execution details visible
- [ ] Request payload shown
- [ ] Response text formatted nicely
- [ ] Tool outputs displayed
- [ ] Execution timeline/metrics
- [ ] Error message visible if failed

---

## 5. Document Management & RAG

### 5.1 Document Upload / Ingestion
**URL:** `http://localhost/chatflows/<flow_id>/documents`

**Test Cases:**
- [ ] Document upload form visible
- [ ] Drag-and-drop or file picker
- [ ] Supported formats: PDF, TXT, JSON
- [ ] File size validation
- [ ] Progress bar during ingestion

**Test Document Ingestion:**
```bash
POST /api/flows/<flow_id>/documents
Authorization: Bearer <token>
{
  "documents": [
    {
      "text": "Vetrai is a multi-tenant AI workflow platform.",
      "source": "documentation",
      "metadata": {"page": 1}
    }
  ]
}
```

Verify:
- [ ] Ingestion job queued
- [ ] Worker chunks document
- [ ] Embeddings generated with Ollama
- [ ] Data stored in Qdrant
- [ ] Ingestion status shows "completed"
- [ ] Tokens used recorded

### 5.2 Vector Store / Document Store
**URL:** `http://localhost/docstore`

**Test Cases:**
- [ ] List of all ingested documents
- [ ] Search by content
- [ ] View document metadata
- [ ] Delete document option
- [ ] Ingestion history

---

## 6. Tools & Settings

### 6.1 Tools Configuration
**URL:** `http://localhost/tools`

**Test Cases:**
- [ ] Tool enable/disable toggles visible
- [ ] calculator: toggle on/off
- [ ] sql_tool: toggle on/off
- [ ] http_fetch: toggle on/off
- [ ] retriever: toggle on/off
- [ ] Changes persist in user preferences

**Test Tool State API:**
```bash
GET /api/flows/tools/state
Authorization: Bearer <token>
```

Returns:
```json
{
  "calculator": true,
  "sql_tool": true,
  "retriever": true,
  "http_fetch": false
}
```

Update:
```bash
PUT /api/flows/tools/state
Authorization: Bearer <token>
{
  "states": {
    "calculator": true,
    "http_fetch": true
  }
}
```

### 6.2 Account Settings
**URL:** `http://localhost/account`

**Test Cases:**
- [ ] User profile visible (email, tenant_id, role)
- [ ] API key generation (if implemented)
- [ ] Password change (future)
- [ ] Session management
- [ ] Logout button

---

## 7. Assistants / AI Providers

### 7.1 Assistants List
**URL:** `http://localhost/assistants`

**Test Cases:**
- [ ] List of available assistant types
- [ ] OpenAI Assistant option
- [ ] Custom Assistant option
- [ ] Create button

### 7.2 Credentials Management
**URL:** `http://localhost/credentials`

**Test Cases:**
- [ ] List stored API credentials
- [ ] Add new credential (OpenAI, Anthropic, etc.)
- [ ] Edit credential
- [ ] Delete credential
- [ ] Masked display of sensitive values

**Test Adding OpenAI Credentials:**
```bash
POST /api/resources/credentials
Authorization: Bearer <token>
{
  "resource_type": "credentials",
  "name": "openai-prod",
  "payload": {
    "type": "openai",
    "api_key": "sk-..."
  }
}
```

---

## 8. Data Management

### 8.1 Datasets
**URL:** `http://localhost/datasets`

**Test Cases:**
- [ ] Create dataset button
- [ ] Upload CSV/JSON file
- [ ] View dataset preview
- [ ] Delete dataset

### 8.2 Evaluations & Evaluators
**URL:** `http://localhost/evaluations` and `/evaluators`

**Test Cases:**
- [ ] Evaluator types visible
- [ ] Create evaluation
- [ ] Run evaluation against executions
- [ ] View results

---

## 9. Audit & Compliance

### 9.1 Audit Logs
**URL:** `http://localhost/audit` (admin only)

**Test Cases:**
- [ ] All actions logged with timestamps
- [ ] Filter by action type (create, update, delete, execute)
- [ ] Filter by resource type (flow, execution, credential)
- [ ] Filter by user/actor
- [ ] Export audit log

**Test Audit API:**
```bash
GET /api/flows/audit?action=execute&days=7
Authorization: Bearer <token>
```

Returns:
```json
[
  {
    "id": "...",
    "actor_email": "user@example.com",
    "action": "execute",
    "resource_type": "flow",
    "resource_id": "flow-123",
    "created_at": "2026-03-11T19:00:00Z"
  }
]
```

---

## 10. Role-Based Access Control Testing

### 10.1 Admin Role Tests
**Login as Admin (role: "admin")**

- [ ] Can create/edit/delete flows
- [ ] Can view all executions
- [ ] Can delete executions
- [ ] Can access audit logs
- [ ] Can manage credentials
- [ ] Can configure tools

**Create admin user:**
```bash
POST /api/auth/register
{
  "email": "admin@vetrai.local",
  "password": "AdminPass123",
  "tenant_id": "tenant-001",
  "role": "admin"
}
```

### 10.2 Editor Role Tests
**Login as Editor (role: "editor")**

- [ ] Can create/edit/delete flows ✅
- [ ] Can execute flows ✅
- [ ] Can view own executions ✅
- [ ] Cannot access audit logs ❌
- [ ] Cannot manage all credentials ❌
- [ ] Cannot delete other's data ❌

### 10.3 Viewer Role Tests
**Login as Viewer (role: "viewer")**

- [ ] Can view flows ✅
- [ ] Can execute flows ✅
- [ ] Cannot create/edit flows ❌
- [ ] Cannot delete flows ❌
- [ ] Can view own executions ✅
- [ ] Cannot delete executions ❌

**Test role enforcement:**
```bash
# Viewer trying to delete (should fail)
DELETE /api/flows/<flow_id>
Authorization: Bearer <viewer_token>
# Response: 403 Forbidden
```

---

## 11. Multi-Tenant Isolation Tests

### 11.1 Tenant A vs Tenant B
**Setup:**
- Register user in tenant-001
- Register different user in tenant-002

**Test Cases:**
- [ ] Tenant A user cannot see Tenant B flows
- [ ] Tenant A user cannot execute Tenant B flows
- [ ] Tenant A user cannot view Tenant B executions
- [ ] Audit logs isolated per tenant
- [ ] Vector DB collections isolated per tenant

**Verify Isolation:**
```bash
# Login as tenant-001 user
GET /api/flows/list
# Should only return flows for tenant-001

# Verify no cross-tenant leakage
# Search database for flows with other tenant_id
SELECT * FROM flows WHERE tenant_id != '<current_tenant_id>'
# Should return 0 rows
```

---

## 12. Performance & Load Testing

### 12.1 Latency Tests
**Target SLO: Execute p95 < 300ms**

```bash
# Measure execution latency
for i in {1..10}; do
  time curl -X POST http://localhost/api/flows/<flow_id>/execute \
    -H "Authorization: Bearer <token>" \
    -H "Content-Type: application/json" \
    -d '{"input": {"message": "test"}}'
done
```

Verify:
- [ ] p50 latency < 100ms
- [ ] p95 latency < 300ms
- [ ] p99 latency < 500ms

### 12.2 Token Usage Metrics
```bash
GET /api/flows/usage
Authorization: Bearer <token>
```

Returns:
- [ ] Total tokens used (daily)
- [ ] Daily trend (last 7 days)
- [ ] p50, p95 execution times
- [ ] Queue depths
- [ ] SLO status

---

## 13. Error Handling Tests

### 13.1 Graceful Error Messages

**Test Missing Fields:**
```bash
POST /api/auth/register
{
  "email": "test@example.com"
  # Missing password
}
# Should return 422 with validation error
```

**Test Invalid JWT:**
```bash
GET /api/flows/list
Authorization: Bearer invalid_token_123
# Should return 401 Unauthorized
```

**Test Flow Not Found:**
```bash
GET /api/flows/nonexistent-id
# Should return 404 Not Found
```

**Test Execution Failure:**
- [ ] Execute with invalid LLM provider → appropriate error
- [ ] Execute with disabled tools → falls back gracefully
- [ ] LLM timeout → returns error with "timeout" message
- [ ] Database connection error → returns 503 Service Unavailable

---

## 14. Docker Health Checks

### 14.1 Service Health Verification
```bash
# Check all services
docker compose ps

# Expected output:
# nginx          - Up, healthy
# frontend       - Up
# backend        - Up, healthy
# langgraph      - Up, healthy
# postgres       - Up, healthy
# redis          - Up, healthy
# qdrant         - Up, healthy
# ollama         - Up, healthy
```

### 14.2 Readiness Endpoints
```bash
# Backend readiness
curl http://localhost/api/health/ready
# Response: {"status": "ok", "checks": {"database": "ok", "redis": "ok"}}

# Frontend check
curl http://localhost/
# Response: HTML (200 OK)
```

---

## 15. Security Tests

### 15.1 Password Security
- [ ] Passwords hashed with bcrypt (not plain text in DB)
- [ ] Weak passwords rejected (< 8 chars)
- [ ] Password reset doesn't expose user info

### 15.2 CORS Security
- [ ] Dev: Requests from localhost:3000 accepted ✅
- [ ] Dev: Requests from other origins return CORS error
- [ ] Prod: Only https://app.vetrai.tech accepted
- [ ] Credentials included in CORS headers

**Test CORS:**
```bash
# From browser console
fetch('http://localhost/api/flows/list', {
  headers: { 'Authorization': 'Bearer <token>' }
})
# Should succeed

# From different origin
curl -H "Origin: http://malicious.com" http://localhost/api/flows/list
# Should be blocked
```

### 15.3 JWT Security
- [ ] JWT contains required claims (sub, tenant_id, role, user_id)
- [ ] JWT expires after TTL (default 720 min)
- [ ] Invalid JWT rejected
- [ ] Token rotation on password change

### 15.4 SQL Injection Prevention
**Test sql_tool with malicious input:**
```bash
POST /api/flows/<flow_id>/execute
{
  "input": {
    "tool": "sql_tool",
    "query": "'; DROP TABLE users; --"
  }
}
# Should fail safely (query validation, not executed)
```

---

## Testing Checklist Summary

- [ ] Authentication (login, register, logout)
- [ ] Flow CRUD (create, edit, publish, delete)
- [ ] Flow Execution (chat interface, tools, RAG)
- [ ] Execution History (view, delete)
- [ ] Document Ingestion (upload, store, retrieve)
- [ ] Tools Configuration (enable/disable)
- [ ] RBAC (admin, editor, viewer)
- [ ] Multi-tenancy (isolation tests)
- [ ] Audit Logging (all actions recorded)
- [ ] Error Handling (graceful failures)
- [ ] Performance (latency SLOs)
- [ ] Security (password, JWT, CORS, SQL injection)
- [ ] Container Health (all 8 services up)
- [ ] Database Connectivity (read/write tests)

---

## Troubleshooting

### Flow not executing
```bash
# Check Redis queue
redis-cli
> LLEN execution_queue
> LPOP execution_queue

# Check LangGraph worker logs
docker logs vetrai-langgraph-1
```

### Ingestion stuck
```bash
# Check ingest queue depth
redis-cli
> LLEN ingest_queue

# Check Qdrant connection
curl http://localhost:6333/health
```

### Audit log not recording
```bash
# Query audit logs
psql -h localhost -U admin -d ai_platform
> SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;
```

### CORS errors
```bash
# Check backend CORS config
echo $APP_ENV  # Should be "development" or "production"

# Verify allowed origins
curl -H "Origin: http://localhost:3000" -v http://localhost/api/health
# Check for Access-Control-Allow-Origin header
```

---

**Last Updated:** March 11, 2026
**Platform Version:** 1.0.0 (Production Ready)
