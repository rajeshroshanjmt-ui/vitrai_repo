# Vetrai Product Roadmap (March 2026 - February 2027)

This roadmap turns Vetrai from a stable reference stack into an enterprise-ready AI workflow platform with strong integration quality across Flowise UI, backend APIs, LangGraph runtime, tools, model providers, and RAG infrastructure.

## 1) Product Goals

- Ship a reliable end-to-end flow lifecycle: build, publish, ingest, execute, monitor.
- Eliminate UI/API/runtime contract drift.
- Improve execution reliability and observability under multi-tenant load.
- Expand model and tool capabilities while preserving governance and security.
- Reach production readiness for customer pilots and paid deployments.

## 2) North-Star Metrics

- Flow execution success rate (completed / total): >= 99.5%.
- p95 control-plane execute latency (`POST /api/flows/{id}/execute`): < 300ms.
- p95 first-token latency (runtime): <= 4s for default models.
- RAG retrieval quality (top-k relevance pass rate): >= 85% on benchmark set.
- Incident MTTR for Sev-2 runtime issues: < 60 minutes.
- Release cadence: at least 1 production release every 2 weeks.

## 3) Current Baseline (As of March 8, 2026)

- Phase 1 hardening exists (`docs/PHASE1_PRODUCTION_HARDENING.md`).
- Core queueing and execution path is implemented (`backend/flows.py`, `langgraph/worker.py`).
- Smoke and guardrail scripts are available:
  - `scripts/smoke_test.ps1`
  - `scripts/quick_check.ps1`
  - `scripts/tenant_isolation_check.ps1`
  - `scripts/slo_gate_check.ps1`

## 4) Delivery Plan

## Phase 2: Integration Closure (March 9, 2026 - April 26, 2026)

Objective: close all UI -> API -> LangGraph integration gaps and enforce one API contract.

Deliverables:
- Standardize API envelope for all compatibility endpoints:
  - `{ "success": boolean, "data": object|array|null, "error": string|null }`
- Normalize execution state mapping across layers:
  - `queued`, `running`, `completed`, `failed`
- Add contract tests for:
  - chatflow create/update/load
  - agentflow execute
  - ingestion gate behavior
  - execution result polling
- Add a request/response schema registry for frontend API clients.

Exit criteria:
- 0 open P1 integration defects.
- End-to-end smoke flow passes in CI and local docker without manual patching.

## Phase 3: Runtime Reliability and Orchestration (April 27, 2026 - June 21, 2026)

Objective: make LangGraph execution predictable and debuggable in production.

Deliverables:
- Execution state manager with deterministic transitions and timestamps.
- Structured node-level execution logs and correlation IDs.
- Retry policy standardization for execution and ingestion queues.
- Tool registry with explicit injection and health checks.
- Provider manager for model initialization and fallback policy.

Exit criteria:
- No stuck executions in `queued`/`running` without timeout handling.
- 99.5% successful completion for valid executions in staged load test.

## Phase 4: RAG and Document Intelligence (June 22, 2026 - August 30, 2026)

Objective: strengthen document pipeline reliability and retrieval quality.

Deliverables:
- Robust ingestion pipeline for document parsing, chunking, embedding, and upsert.
- Vector schema validation and migration checks.
- Retrieval evaluation harness with benchmark datasets.
- RAG diagnostics in UI (chunk source visibility, retrieval confidence, query traces).

Exit criteria:
- Ingestion failure rate < 1%.
- Retrieval benchmark meets >= 85% relevance pass rate.

## Phase 5: Enterprise Platform Readiness (August 31, 2026 - November 1, 2026)

Objective: complete enterprise controls required for production tenants.

Deliverables:
- RBAC hardening for control-plane and runtime operations.
- Expanded audit trail coverage for all high-risk actions.
- SSO/SAML maturity and session governance improvements.
- Backup/restore and disaster recovery runbooks validated.

Exit criteria:
- Audit completeness = 100% for guarded actions.
- Tenant isolation gates pass continuously in CI.

## Phase 6: Scale, Ecosystem, and Commercialization (November 2, 2026 - February 28, 2027)

Objective: scale adoption and reduce onboarding friction.

Deliverables:
- Horizontal worker autoscaling strategy.
- Marketplace/template quality program and certification checks.
- Usage analytics and billing-grade metering enhancements.
- Self-serve onboarding and guided setup flows.

Exit criteria:
- 2x throughput capacity from March 2026 baseline.
- New tenant time-to-first-successful-workflow < 30 minutes.

## 5) Workstream Ownership

- Frontend Platform: API contract adoption, state handling, execution UX.
- Backend Platform: contract enforcement, routing, RBAC, audit, tenancy.
- Runtime Team: LangGraph orchestration, queue reliability, provider/tool runtime.
- Data/RAG Team: ingestion, embeddings, vector schema, retrieval quality.
- QA/Release: E2E automation, CI gates, release readiness, defect triage.

## 6) Release Governance

- Release train: bi-weekly, Tuesday UTC.
- Mandatory pre-release gates:
  - health readiness checks
  - smoke test
  - tenant isolation check
  - SLO gate check
- Hotfix SLA:
  - Sev-1: patch in < 24 hours
  - Sev-2: patch in < 72 hours

## 7) Risk Register

- Contract drift between compatibility endpoints and frontend adapters.
- Provider-specific model behavior differences (OpenAI/Ollama/Anthropic/Azure OpenAI).
- Queue backlogs under ingestion spikes.
- Hidden tenancy leaks in new resource surfaces.
- CI instability when external model/runtime dependencies are slow.

Mitigations:
- Contract tests + schema snapshots in CI.
- Fallback providers and timeout/retry defaults.
- Queue depth alerting and backpressure policy.
- Tenant isolation regression suite as non-optional gate.

## 8) Definition of Roadmap Success

By February 28, 2027, Vetrai should support:
- reliable flow authoring and execution with predictable runtime states,
- production-grade RAG + tool orchestration,
- multi-provider model execution,
- enterprise governance and auditability,
- scalable multi-tenant operations with measurable SLO compliance.
