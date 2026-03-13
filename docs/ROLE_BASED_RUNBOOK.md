# Vetrai Role-Based Runbook (As of March 8, 2026)

This runbook defines operating procedures for each role in the Vetrai platform so teams can create, validate, release, and operate Chatflows, Agentflows, Multi-Agent workflows, Assistants, RAG, and tool-integrated executions reliably.

## 1) Role Map and Permissions

- `admin`
- `editor`
- `viewer`

Core capability summary:

- Flow create/edit/publish: `admin`, `editor`
- Flow execute/logs/usage read: `admin`, `editor`, `viewer`
- Document ingestion: `admin`, `editor`
- Assistants create/edit/delete: `admin`, `editor`
- Assistants read: `admin`, `editor`, `viewer`
- DLQ and audit ops: `admin`

## 2) Shared Daily Start Checklist (All Roles)

1. Confirm stack health:
   - `GET /api/health`
   - `GET /api/health/ready`
   - `GET http://localhost:8001/health/ready`
2. Confirm queue baseline from usage snapshot:
   - `GET /api/flows/usage`
3. Confirm no critical execution backlog:
   - `GET /api/flows/logs?limit=50`
4. If preparing release, run baseline checks:
   - `scripts/quick_check.ps1`
   - `scripts/tenant_isolation_check.ps1`
   - `scripts/slo_gate_check.ps1`

## 3) Platform Admin Runbook

## Daily

1. Verify tenant access and role integrity.
2. Review `GET /api/flows/usage` for queue depth and monthly quota trends.
3. Review latest failed runs in `GET /api/flows/logs`.
4. Review audits:
   - `GET /api/flows/audit`
   - `GET /api/agent/tasks/audit`

## Weekly

1. Validate DLQ is empty or explained:
   - `GET /api/flows/dlq/execution`
   - `GET /api/flows/dlq/ingestion`
2. Replay safe DLQ jobs if root cause is fixed:
   - `POST /api/flows/dlq/{execution|ingestion}/replay`
3. Confirm SLO trend compliance from dashboards/usage endpoint.

## Release Gate Sign-Off

1. Require green checks from:
   - `smoke_test.ps1`
   - `quick_check.ps1`
   - `tenant_isolation_check.ps1`
   - `slo_gate_check.ps1`
2. Confirm no unresolved P1 integration defects.
3. Approve release only if audit and isolation gates pass.

## Incident Response

1. Identify blast radius by tenant, flow ID, and execution IDs.
2. Check readiness and queue depth first.
3. Inspect logs and failed execution payload patterns.
4. Isolate whether failure is UI/API contract, queueing, runtime, provider, or vector dependency.
5. Trigger rollback to prior published flow version when needed.

## 4) Flow Builder Runbook (Chatflow, Agentflow, Multi-Agent, Assistants)

## Build Workflow

1. Create or select flow in UI:
   - Chatflow: `/chatflows` and `/canvas/:id`
   - Agentflow/Multi-Agent: `/agentflows` and `/v2/agentcanvas/:id`
2. Add nodes and edges.
3. Configure model provider and tool nodes.
4. Save draft frequently.
5. Publish only after validation runs.

## Assistants Workflow

1. Create assistant (`CUSTOM`, `OPENAI`, or `AZURE`) in Assistants UI.
2. Configure instructions, model, and credentials.
3. Attach tools/docstores where needed.
4. Save and test in preview.
5. Reuse assistant config in flows.

## RAG and Tools Workflow

1. Create document store.
2. Add loaders and preview chunks.
3. Configure vector store + embeddings.
4. Insert/update vector data.
5. Connect retriever/tool components in the flow.
6. Validate retrieval/tool outputs in execution logs.

## Build Validation Checklist

1. Flow saves and reloads without node schema loss.
2. Publish succeeds.
3. Execute succeeds with expected response.
4. Execution logs show `completed` and no tool/model errors.
5. Error behavior is user-readable when failure is forced.

## 5) QA Engineer Runbook

## Daily Verification

1. Run fast checks:
   - `scripts/quick_check.ps1`
2. Run isolation regression:
   - `scripts/tenant_isolation_check.ps1`
3. Run SLO gate:
   - `scripts/slo_gate_check.ps1`

## Pre-Release E2E Matrix

1. Auth and token issuance.
2. Chatflow create -> save -> publish -> execute.
3. Agentflow create -> save -> publish -> execute.
4. Multi-agent v2 flow execute with tool calls.
5. Document ingest -> wait -> execute with retrieval.
6. Assistant-backed flow execution.
7. Error-path checks:
   - publish missing
   - ingestion in progress (`409`)
   - provider/tool credential missing

## Defect Triage Rules

1. Classify as contract, runtime, data, infra, or UX-state defect.
2. Attach flow ID, execution ID, tenant ID, timestamps, API payload and response.
3. Mark blockers that fail release gates as P1.

## 6) App Integrator Runbook (Portal / Service Integration)

## Initial Integration

1. Obtain JWT with tenant and role.
2. Use flow lifecycle APIs:
   - `POST /api/flows/create`
   - `PUT /api/flows/{flow_id}/draft`
   - `POST /api/flows/{flow_id}/publish`
3. Execute from app service:
   - `POST /api/flows/{flow_id}/execute`
4. Poll result:
   - `GET /api/flows/logs`

## Integration Guardrails

1. Always call published flows in production paths.
2. Use `wait_for_ingestion=true` unless asynchronous execution is explicitly required.
3. Pass explicit `llm_provider` and `llm_model` when deterministic provider behavior is required.
4. Add retries with backoff for transient `5xx` and provider timeouts.
5. Log request IDs/execution IDs for traceability.

## Assistant Integration

1. Manage assistant configs through:
   - `GET /api/assistants`
   - `POST /api/assistants`
   - `PUT /api/assistants/{assistant_id}`
2. Keep execution path flow-centric using `POST /api/flows/{flow_id}/execute`.

## 7) Operations / SRE Runbook

## Monitoring

1. Monitor health/readiness for backend and worker.
2. Monitor queue depth from `GET /api/flows/usage`.
3. Monitor execution failure rate and latency from logs/usage metrics.
4. Track DLQ count as a leading indicator of runtime regression.

## On-Call Triage Order

1. Health endpoints.
2. Redis queue depth.
3. Postgres availability.
4. Qdrant and model provider status.
5. Worker error patterns.

## Recovery Actions

1. Restart degraded services.
2. Drain or replay DLQ jobs only after fix confirmation.
3. Validate with smoke test after recovery.
4. Communicate tenant impact and closure time.

## 8) Handoff Artifacts Required Per Change

1. Flow IDs changed.
2. Published version IDs.
3. Test evidence from required scripts.
4. Known limitations and rollback instructions.
5. Audit references for high-risk operations.

## 9) Definition of Done (Runbook Compliance)

1. Role owner completed role checklist.
2. Required gates passed.
3. No unresolved P1 defects.
4. Audit and tenant-isolation checks passed.
5. Release notes include execution and rollback guidance.
