# Phase 1 (0-8 Weeks): Production Hardening

This phase hardens Vetrai for enterprise pilot readiness by enforcing reliability objectives, audit completeness standards, tenant isolation regression checks, and CI quality gates.

## Scope

- Define and enforce service-level objectives (SLOs).
- Ensure audit coverage for critical control-plane operations.
- Add tenant isolation regression checks.
- Raise CI bars so regressions fail pull requests.

## SLOs

### SLO-1: API Readiness

- **Objective**: `/api/health/ready` succeeds >= 99.9% per rolling 30-day window.
- **Indicator**: successful readiness checks / total readiness checks.
- **Error budget**: 0.1% failed checks.

### SLO-2: Flow Execute API Latency (Control Plane)

- **Objective**: `POST /api/flows/{flow_id}/execute` p95 response time < 300ms (queueing only, not model runtime).
- **Indicator**: p95 handler latency from API ingress to response.
- **Error budget**: 5% monthly breach windows.

### SLO-3: Tenant Isolation Integrity

- **Objective**: 100% of cross-tenant access attempts to tenant-scoped flow resources fail (`404` or `403` by policy).
- **Indicator**: automated tenant-isolation gate pass rate in CI.
- **Error budget**: 0 (any failure blocks merge).

### SLO-4: Audit Log Integrity

- **Objective**: 100% of high-risk governance actions produce audit records with `tenant_id`, `actor_email`, `action`, and `created_at`.
- **Indicator**: audit completeness regression checks + periodic sampling.
- **Error budget**: 0 for guarded actions.

## Audit Completeness Baseline (Phase 1)

Phase 1 minimum required audited actions:

- `agent_task_policy_approved`
- `agent_task_policy_rejected`
- `agent_task_planned`
- `agent_task_running`
- `agent_task_completed`
- `agent_task_failed`
- `dlq_replay`
- `dlq_delete`

Validation requirements:

- Every record must include tenant and actor attribution.
- Every action must be queryable by `/api/agent/tasks/audit` or `/api/flows/audit`.

## CI Gates (Phase 1)

Required PR gates:

1. Backend unit test suite pass.
2. Fast API quick-check pass.
3. Tenant isolation gate pass.
4. Audit completeness gate pass.
5. SLO gate pass (readiness probes + execute p95 threshold).

Failure policy:

- Any gate failure blocks merge.
- Compose logs are uploaded on failure.

## Week-by-Week Plan

### Weeks 1-2

- Finalize SLO definitions and owners.
- Lock CI baseline gates.
- Land tenant-isolation gate script.

### Weeks 3-4

- Instrument dashboard-facing latency snapshots.
- Add regression tests for tenant-scoped flow access paths.
- Verify audit action completeness for governance routes.

### Weeks 5-6

- Tune queue/dependency health checks.
- Add failure triage playbook and runbooks for common incidents.
- Reduce flaky tests and tighten timeouts.

### Weeks 7-8

- Run pilot hardening drill (simulate degraded backend/redis paths).
- Produce readiness report with SLO trend snapshots and residual risks.

## Definition of Done (Phase 1)

- SLOs documented and reviewed.
- PR CI includes tenant-isolation regression gate.
- Backend tenant-isolation regression tests in place.
- Audit completeness baseline defined and validated.
- Release-readiness checklist signed off for pilot environment.
