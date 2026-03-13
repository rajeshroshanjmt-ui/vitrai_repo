# Vetrai User Manual (As of March 8, 2026)

This manual explains how to use Vetrai day-to-day: build and run Chatflows, Agentflows, Multi-Agent workflows, Assistants, RAG pipelines, tools, and integrations with external portals or app services.

## 1) Access and Setup

1. Start the platform:
   - `docker compose up -d --build`
2. Open the UI:
   - `http://localhost`
3. Sign in with your workspace account.
4. Confirm services are healthy:
   - `GET /api/health`
   - `GET /api/health/ready`
   - `GET http://localhost:8001/health/ready`

## 2) Main Navigation

Main sections:

- `Dashboard`
- `Chatflows`
- `Agentflows`
- `Assistants`
- `Executions`
- `Tools`
- `Document Stores`
- `Datasets`
- `Evaluators` / `Evaluations`
- `Credentials`
- `Variables`
- `API Keys`
- `Marketplaces`
- `Account Settings`
- `Documentation`

## 3) Create and Use Chatflows

1. Open `Chatflows`.
2. Click `Add New`.
3. In canvas (`/canvas/:id`), add nodes and connect edges.
4. Configure node parameters (model, prompt, tool/retriever inputs).
5. Save draft.
6. Publish the flow.
7. Open chat preview/test and send prompts.
8. Validate outputs and metadata in `Executions`.

## 4) Edit Existing Chatflows

1. Open a chatflow from `Chatflows`.
2. Modify nodes, edges, or settings.
3. Save draft again.
4. Publish updated version.
5. Re-run test prompts and compare responses.

## 5) Create and Use Agentflows / Multi-Agent Workflows

1. Open `Agentflows`.
2. Use v2 canvas (`/v2/agentcanvas/:id`) for multi-agent orchestration.
3. Create orchestration graph:
   - start node
   - task/agent nodes
   - routing/decision paths
   - reply/finalization node
4. Configure model/tool settings per relevant node.
5. Save and publish.
6. Run with input parameters.
7. Check node-level execution details in `Executions`.

## 6) Create and Use Assistants

1. Open `Assistants`.
2. Create assistant type:
   - `CUSTOM`
   - `OPENAI`
   - `AZURE`
3. Configure instruction/profile details.
4. Attach credential and model settings.
5. Optionally attach tools/docstores.
6. Save and preview.
7. Reuse assistant in Chatflow/Agentflow configurations.

## 7) RAG Workflow (Document Stores)

1. Open `Document Stores`.
2. Create a document store.
3. Add loader config (text/web/pdf, etc.).
4. Preview chunks.
5. Save loader config.
6. Configure vector store + embeddings + record manager.
7. Insert data into vector store.
8. Test retrieval via query view (`/document-stores/query/:storeId`).
9. Connect retriever/docstore components in your flow.

## 8) Tools and Credentials

1. Create or manage tools in `Tools`.
2. Add provider/tool credentials in `Credentials`.
3. Reference tools in flow nodes.
4. Run flow and validate tool outputs in execution logs.

Tip: tool toggles can be managed through `/api/flows/tools/state` for user-level runtime behavior.

## 9) Variables and API Keys

1. Store reusable values in `Variables`.
2. Create scoped API keys in `API Keys` for app integrations.
3. Use least-privilege permissions by environment (dev/stage/prod).

## 10) Run, Monitor, and Troubleshoot

1. Open `Executions` for status and outputs.
2. Common statuses:
   - `queued`
   - `running`
   - `completed`
   - `failed`
3. For failures:
   - inspect error message and node context
   - verify credentials/provider availability
   - verify ingestion completed before execute
4. Review backend logs and queue depth if failures persist.

## 11) Sharing and Embedding

1. From flow canvas, open `API Code / Share / Embed`.
2. Use generated snippets for internal portals.
3. For execution sharing, use execution share options in `Executions`.
4. Public chatbot endpoints may be unavailable in this deployment; verify before external public launch.

## 12) External Integration (Portal / App Service)

Recommended production pattern:

1. Authenticate and get JWT:
   - `POST /api/auth/token`
2. Manage flow lifecycle:
   - `POST /api/flows/create`
   - `PUT /api/flows/{flow_id}/draft`
   - `POST /api/flows/{flow_id}/publish`
3. Execute workflow:
   - `POST /api/flows/{flow_id}/execute`
4. Poll results:
   - `GET /api/flows/logs`
5. For RAG:
   - `POST /api/flows/{flow_id}/documents`
   - `GET /api/flows/{flow_id}/ingestions`

## 13) Best Practices

1. Publish before any production execution.
2. Keep ingestion gating enabled (`wait_for_ingestion=true`) for RAG flows.
3. Pin model provider/model for deterministic behavior in regulated workloads.
4. Validate every flow change with quick checks before release.
5. Track flow IDs, version IDs, and execution IDs for audit and rollback.

## 14) Quick Operator Checklist

1. Health checks pass.
2. Queue depth normal.
3. New/updated flows are published.
4. Executions show expected completion rate.
5. Release scripts pass:
   - `scripts/quick_check.ps1`
   - `scripts/tenant_isolation_check.ps1`
   - `scripts/slo_gate_check.ps1`
