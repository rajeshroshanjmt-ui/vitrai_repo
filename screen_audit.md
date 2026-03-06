# Screen-wise OSS Audit

Run date: 2026-03-06  
Environment: localhost Docker (`/api` base path), seeded with `5` Chatflows, `5` Agentflows, `120` Marketplace templates.

| Screen | Endpoint(s) | Status | Error Class | Fix Applied | Retest Result |
|---|---|---|---|---|---|
| Login (`/login` -> sign-in UX) | `POST /api/auth/token`, `GET /api/auth/me` | Pass | None | Auth path normalization and token/me validation in browser smoke | Login successful; redirected to `/`; token/tenant/role keys present |
| Dashboard (`/dashboard`) | Dashboard data calls (none failed) | Pass | None | Runtime guards already in place; no blocking call failures observed | Loads without runtime/page errors |
| Chatflows List (`/chatflows`) | `GET /api/flows/list` | Partial Pass | Non-blocking selector drift | None needed for stability; smoke action selector for `Add New` did not match visible control | List route stable; no crash; create button click not auto-confirmed |
| Chatflow Canvas (`/canvas/:id`) | Flow read/draft APIs via UI | Pass | None | Guarded API dialog flow parsing (`inputParams` array checks) in `CanvasHeader` | Canvas opens with zero runtime errors |
| Chat Preview (canvas chat popup) | `GET /api/internal-chatmessage/:id?feedback=true` (optional OSS) | Pass (degraded) | Non-blocking optional 404 | Optional endpoint classification and non-fatal UI handling | Popup interaction remains stable; optional 404 does not crash |
| API Code Dialog (from canvas header) | API key list/config calls | Partial Pass | Non-blocking selector drift | Data-shape guards + replaced `react-code-blocks` in APICodeDialog/Embed tab to remove DOM prop warnings | No runtime warning from `codeBlock/copied`; trigger auto-detect failed in last run |
| Agentflows V2 List (`/agentflows`) | Agentflow list APIs | Partial Pass | Non-blocking selector drift | None needed for stability | List stable; `Add New` click not auto-confirmed by selector |
| Agentflow V2 Canvas (`/v2/agentcanvas/:id`) | Agentflow read/update/validation paths | Pass | None | Existing null-shape guards on node collections retained | Canvas route stable, no runtime/page errors |
| Marketplace (`/marketplaces`) | `GET /api/resources/marketplace` | Pass | None | Marketplace canvases now tolerate direct entry without router state | Marketplace list stable; import navigation succeeded |
| Marketplace Chat Template Canvas (`/marketplace/:id`) | Template fetch/list fallback | Pass | None | Added direct-route fallback when `location.state` is null in `MarketplaceCanvas` | Opens without crash; unavailable templates show controlled message |
| Marketplace Agent Template Canvas (`/v2/marketplace/:id`) | Template fetch/list fallback | Pass | None | Added direct-route fallback + `inputParams` array guard in V2 marketplace canvas | Opens without crash; unavailable templates handled gracefully |
| Datasets (`/datasets`) | Dataset list/create APIs | Pass | None | Existing response-shape guards retained | Route stable; create dialog detected |
| Evaluators (`/evaluators`) | Evaluator list/create APIs | Pass | None | Existing response-shape guards retained | Route stable; create dialog detected |
| Evaluations (`/evaluations`) | Evaluation list/run APIs | Partial Pass | Non-blocking selector drift | Existing response-shape guards retained | Route stable; start-new dialog not auto-confirmed |
| Assistants (`/assistants`) | Assistant resource list | Partial Pass | Non-blocking selector drift | None needed for crash safety | Route stable; custom-assistant card click not auto-confirmed |
| Document Store (`/document-stores`) | Store/vector list/create APIs | Partial Pass | Non-blocking selector drift | None needed for crash safety | Route stable; add dialog not auto-confirmed |

## Evidence
- Baseline artifact: `tmp/test-artifacts/baseline-smoke.json`
- Final artifact: `tmp/test-artifacts/final-smoke.json`
- Browser script: `tmp/test-artifacts/browser-smoke.mjs`
- Screenshots: `tmp/test-artifacts/screens/`
