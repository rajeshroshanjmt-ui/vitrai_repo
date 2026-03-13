# Vetrai RAG + Tools Stack

Dockerized reference stack:

- `frontend/ui` Vetrai Flowise-based React console
- `nginx` reverse proxy (`/` -> frontend, `/api` -> backend)
- `backend` FastAPI for JWT auth, RBAC, flow lifecycle, queueing
- `langgraph` worker for queued ingestion + execution
- `redis` job queues (`execution_queue`, `ingest_queue`)
- `postgres` flow versions + execution logs
- `qdrant` vector DB for tenant-isolated RAG
- `ollama` local LLM + embeddings

## Start

```bash
docker compose up -d --build
```

UI: `http://localhost`

### Container Hardening Defaults

- `nginx` is the only internet-facing service (`0.0.0.0:80`).
- Internal infrastructure ports are bound to loopback for local operator access only:
  - LangGraph: `127.0.0.1:8001`
  - Qdrant: `127.0.0.1:6333`
  - Ollama: `127.0.0.1:11434`
- Services run with `restart: unless-stopped`.
- Compose includes healthchecks for gateway, app, and stateful dependencies.
- Docker log rotation is configured (`max-size=10m`, `max-file=5`).
- Runtime credentials and queue/model settings are env-driven (see `.env.example`).

### Production Overlay (TLS + stricter exposure)

Use the production overlay to enable HTTPS edge config and disable internal host port publishing:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file .env \
  up -d --build
```

Notes:

- Provide real certificate/key paths via `NGINX_TLS_CERT_PATH` and `NGINX_TLS_KEY_PATH`.
- In prod overlay, `langgraph`, `qdrant`, and `ollama` host port mappings are removed.

## Auth Environment Notes

- Set `APP_ENV=development` for local usage.
- In non-dev environments (for example `APP_ENV=production`), backend startup rejects weak/default `JWT_SECRET` values.
- User identity uniqueness is enforced as `(tenant_id, lower(email))` in Postgres.
- Usage trend window is configurable with `USAGE_DAILY_DAYS` (default `7`).

## Prepare Ollama models

```bash
docker exec -it vetrai-ollama-1 ollama pull llama3.2
docker exec -it vetrai-ollama-1 ollama pull nomic-embed-text
```

## Production Pre-Flight Checklist

Before deploying to production, run the pre-flight validation script to check:
- Environment variables (JWT_SECRET, API keys, database config)
- Service connectivity (backend, worker, Redis, database, vector DB)
- LLM provider health (Ollama, OpenAI, Anthropic, Azure)
- Security configuration (HTTPS, strong credentials, etc.)

**Bash (Linux/Unix):**

```bash
./scripts/production_preflight_check.sh
```

Optional flags:
```bash
./scripts/production_preflight_check.sh \
  -b http://myhost/api \
  -l http://myhost:8001 \
  -r redis-host:6379
```

**PowerShell (Windows):**

```powershell
.\scripts\production_preflight_check.ps1 -BaseUrl "http://myhost/api" -LanggraphUrl "http://myhost:8001"
```

The script returns exit code 1 if critical checks fail, 0 otherwise.

## Smoke Test

Run an end-to-end gated flow test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke_test.ps1
```

This validates:

- JWT issue
- flow create + publish
- ingestion queue + completion
- execute blocked during ingestion (`409`)
- execute success after ingestion

## CI Smoke Pipeline

Full workflow: `.github/workflows/smoke-test.yml`

- Starts the full Docker stack
- Waits for backend health
- Pulls `llama3.2` and `nomic-embed-text` in Ollama
- Runs `scripts/smoke_test.ps1`
- Uploads compose logs on failure

Note: this workflow is intentionally heavy because model pulls are large and can take significant time.

Fast PR workflow: `.github/workflows/fast-check.yml`

- Starts minimal stack (`nginx`, `frontend`, `backend`, `postgres`, `redis`, `qdrant`)
- Runs `scripts/quick_check.ps1` (no Ollama model pull)
- Runs `scripts/tenant_isolation_check.ps1` to enforce cross-tenant access blocking
- Runs `scripts/audit_completeness_check.ps1` to enforce Codex audit field/action integrity
- Runs `scripts/slo_gate_check.ps1` to enforce readiness + execute p95 latency SLO gate
- Validates auth + flow lifecycle + ingestion-gating behavior quickly
- Validates Codex guardrail config/evaluate/report/audit paths for a scoped task
- Validates `/api/flows/usage` snapshot response for dashboard KPIs

## Phase 1 Hardening

Phase 1 production-hardening scope and SLO targets are tracked in:

- `docs/PHASE1_PRODUCTION_HARDENING.md`

## Product Roadmap

Full product roadmap (March 2026 - February 2027):

- `docs/PRODUCT_ROADMAP.md`

## Role-Based Runbook

Operational runbook by role (Admin, Builder, QA, Integrator, Ops):

- `docs/ROLE_BASED_RUNBOOK.md`

## User Manual

End-user guide for creating and using flows, assistants, RAG, tools, and integrations:

- `docs/USER_MANUAL.md`

## Core API paths

- `POST /api/auth/token`
- `POST /api/flows/create`
- `PUT /api/flows/{flow_id}/draft`
- `POST /api/flows/{flow_id}/publish`
- `POST /api/flows/{flow_id}/documents` (queue ingestion)
- `GET /api/flows/{flow_id}/ingestions` (poll ingestion job status)
- `POST /api/flows/{flow_id}/execute` (queue execution)
- `GET /api/flows/logs`
- `GET /api/flows/usage` (tenant usage + queue depth snapshot)
- `GET /api/flows/tools/state` (tenant+user tool-toggle preferences)
- `PUT /api/flows/tools/state` (persist tenant+user tool-toggle preferences)
- `GET /api/health`
- `GET /api/health/ready` (backend readiness: db + redis)
- `GET /api/flows/dlq/{execution|ingestion}` (admin DLQ inspect)
- `GET /api/flows/dlq/{execution|ingestion}/{redis_index}` (admin DLQ detail)
- `POST /api/flows/dlq/{execution|ingestion}/replay` (admin DLQ replay)
- `DELETE /api/flows/dlq/{execution|ingestion}/{redis_index}` (admin DLQ delete)
- `GET /api/flows/audit?limit=&offset=&action=&actor_email=&created_from=&created_to=` (admin audit logs)
  returns `{ items, total_count, limit, offset }`
- `POST /api/agent/tasks/evaluate` (admin/editor Codex task policy decision)
- `GET /api/agent/tasks/config` (admin/editor Codex guardrail limits + allowed tools)
- `POST /api/agent/tasks/report` (admin/editor Codex task execution audit report)
- `GET /api/agent/tasks/audit?limit=&offset=&action=&status=&actor_email=&task_id=&created_from=&created_to=` (admin/editor Codex task audit feed)
- `GET http://localhost:8001/health` (langgraph worker service)
- `GET http://localhost:8001/health/ready` (langgraph readiness: db + redis + qdrant + ollama)

## Multi-tenant RAG isolation

Vectors are stored in per-tenant collections:

`tenant_{tenant_id}`

The worker only retrieves from the requesting tenant collection.

## Deterministic Ingestion Gating

`POST /api/flows/{flow_id}/execute` now enforces ingestion readiness by default.

- If the latest ingestion job is still `queued` or `processing`, execution returns `409`.
- You can bypass this with `wait_for_ingestion=false` in the execute request body.

## Multi-LLM Selection

`POST /api/flows/{flow_id}/execute` accepts optional LLM selectors:

- `llm_provider` (`ollama`, `openai`, `anthropic`, or `azure_openai`)
- `llm_model` (provider-specific model name)

If omitted, the worker uses `DEFAULT_LLM_PROVIDER` (defaults to `ollama`) and then provider defaults:

- **Ollama:** `OLLAMA_LLM_MODEL` (default `llama3.2`), `OLLAMA_EMBED_MODEL` (default `nomic-embed-text`), `OLLAMA_API_PREFIX` (auto-detected or default `/api`)
- **OpenAI:** `OPENAI_MODEL` (default `gpt-4o-mini`), `OPENAI_BASE_URL` (optional; uses OpenAI default if empty)
- **Anthropic:** `ANTHROPIC_MODEL` (default `claude-3-5-sonnet-latest`), `ANTHROPIC_BASE_URL` (default `https://api.anthropic.com`)
- **Azure OpenAI:** `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_VERSION` (default `2024-02-15-preview`)


### Provider endpoint flexibility

All LLM providers now support configurable base URLs, making it easy to:

- Route requests through corporate proxies or VPNs.
- Use alternative/self-hosted instances (e.g. local Ollama, Azure, Anthropic proxy).
- Support future provider migrations without code changes.

For **Ollama specifically**, the worker also includes automatic API prefix detection
(`/api` vs `/v1`) – set `OLLAMA_API_PREFIX` explicitly if auto-detection isn't desired.
For other providers, set the corresponding `*_BASE_URL` environment variable:

```bash
export OPENAI_BASE_URL=https://proxy.corp.com/openai          # custom OpenAI endpoint
export ANTHROPIC_BASE_URL=https://anthropic-gateway:8000      # on-prem Anthropic gateway
export AZURE_OPENAI_ENDPOINT=https://myazure.openai.azure.com  # your Azure instance
```


## Retries And Dead-Letter Queues

Worker retries failed jobs before dead-lettering:

- `MAX_JOB_RETRIES` controls retries after the first attempt (default: `2`)
- execution queue DLQ: `execution_dlq`
- ingestion queue DLQ: `ingestion_dlq`

Status behavior:

- execution logs: `retrying` -> `failed` (if retries exhausted)
- ingestion jobs: `retrying` -> `failed` (if retries exhausted)

## Codex Guardrails

Backend includes a policy gate for autonomous coding tasks:

- Role gate: only `admin` and `editor` can evaluate/report agent tasks.
- Path gate: project-relative paths only; parent traversal and absolute paths are rejected.
- Secrets protection: `.env`, key/pem files, and secrets paths are blocked.
- Protected changes: CI workflow and infra paths require `allow_protected_changes=true`.
- Risk escalation: `high` / `critical` tasks require `approval_confirmed=true`.
- Budget controls: policy rejects tasks that exceed token/duration/file-change budgets.
- Concurrency controls: policy/report reject new running tasks when tenant running-task limit is reached.
- Evaluation rate controls: policy evaluate requests are limited per tenant per minute.
- Workflow integrity: report calls require a prior `agent_task_policy_approved` record for the same task.
- Change-size controls: policy/report enforce total changed-bytes budgets.
- VCS controls: completed write tasks must report a non-protected feature branch and `pr_url`.
- Runtime controls: report rejects tasks whose `tokens_used`/`execution_duration_ms` exceed configured runtime budgets.
- Runtime controls: report rejects tasks whose changed file count exceeds configured runtime file budget.

Agent events are persisted into `audit_logs` with `resource_type=codex_task` and actions:

- `agent_task_policy_approved`
- `agent_task_policy_rejected`
- `agent_task_planned|running|completed|failed`

You can retrieve these records via `/api/agent/tasks/audit` and filter by:

- `action` (exact action string)
- `status` (`planned|running|completed|failed|policy_approved|policy_rejected`)
- `actor_email`, `task_id`, `created_from`, `created_to`

Budget defaults (override via env):

- `MAX_AGENT_ESTIMATED_TOKENS=120000`
- `MAX_AGENT_EXPECTED_DURATION_MS=120000`
- `MAX_AGENT_EXPECTED_FILES_CHANGED=40`
- `MAX_AGENT_TOTAL_CHANGED_BYTES=5242880`
- `MAX_AGENT_CONCURRENT_RUNNING_TASKS=5`
- `MAX_AGENT_RUNTIME_TOKENS_USED=120000`
- `MAX_AGENT_RUNTIME_DURATION_MS=120000`
- `MAX_AGENT_RUNTIME_FILES_CHANGED=40`
- `MAX_AGENT_EVALUATIONS_PER_MINUTE=60`

`POST /api/agent/tasks/report` enforces runtime budgets for `changed_bytes`,
`tokens_used`, and `execution_duration_ms`.
