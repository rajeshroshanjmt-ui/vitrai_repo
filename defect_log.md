# Defect Log

## Crash

### Closed
1. `TypeError: Cannot destructure property 'flowData' of 'state' as it is null.`
- Impact: Marketplace template canvases crashed on direct URL open.
- Baseline evidence: `baseline-smoke.json` crash classification.
- Fix:
  - `frontend/ui/src/views/marketplaces/MarketplaceCanvas.jsx`
  - `frontend/ui/src/views/agentflowsv2/MarketplaceCanvas.jsx`
  - Added fallback: resolve template by route `:id` via marketplace list API when router state is absent.
- Retest: Closed (no crash in final run).

2. `TypeError: Cannot read properties of undefined (reading 'find')`
- Impact: API dialog prep in canvas header crashed on malformed node `inputParams`.
- Baseline evidence: `baseline-smoke.json` crash classification.
- Fix:
  - `frontend/ui/src/views/canvas/CanvasHeader.jsx`
  - Added strict array guards for `nodes` and `inputParams` before `.find`.
- Retest: Closed (no crash in final run).

## Blocking

### Open
- None.

### Closed
- None recorded as blocking in baseline classification (`blocking=0`).

## Non-blocking warning

### Open
1. Optional OSS endpoint 404s
- Endpoint: `GET /api/internal-chatmessage/:id?feedback=true`
- Final evidence: `optional404Count=2`, `nonOptional404Count=0` in `final-smoke.json`.
- Behavior: Non-fatal; chat/canvas remains usable.
- Disposition: Accepted OSS-unavailable behavior.

2. Build-time chunk-size/code-splitting advisories
- Source: `tmp/test-artifacts/final-build.log`
- Behavior: Build succeeds; warnings are optimization advisories.
- Disposition: Non-blocking performance/packaging follow-up.

### Closed
1. `react-code-blocks` DOM-prop warnings (`codeBlock`, `copied`) during API/embed code dialogs.
- Fix:
  - `frontend/ui/src/views/chatflows/APICodeDialog.jsx`
  - `frontend/ui/src/views/chatflows/EmbedChat.jsx`
  - Replaced `CopyBlock` usage with internal `CodeBlock` component.
- Retest: Closed (final browser run has `totalConsoleWarnings=0`).
