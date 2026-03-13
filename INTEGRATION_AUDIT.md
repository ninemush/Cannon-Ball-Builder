# CannonBall UiPath Integration Audit
## Pre-rebuild audit — V2.0

**Date:** 2026-02-27
**Files reviewed:** uipath-integration.ts, uipath-deploy.ts, uipath-fetch.ts, uipath-routes.ts, ai-xaml-enricher.ts, xaml-generator.ts

---

## Category 1: Authentication Issues

### A1 — No token caching or proactive refresh
`getAccessToken()` in `uipath-integration.ts` (line 153) fetches a new token on every call. There is no expiry tracking, no caching, and no proactive refresh. Every API call triggers a full OAuth2 token request, wasting latency and risking rate limits.

### A2 — Duplicate getAccessToken implementations
`uipath-deploy.ts` (line 225) has its own copy of `getAccessToken()`. Two independent implementations of the same auth flow — a maintenance hazard and a source of divergence.

### A3 — No 401 auto-retry
If a token expires mid-operation, the call fails permanently. There is no logic to catch a 401 response, refresh the token, and retry the request.

### A4 — Client secret in request params without masking
`getAccessToken()` includes `client_secret` in URLSearchParams (line 157). While necessary for the OAuth flow, the function does not guard against the secret appearing in logs. No masking is applied anywhere.

### A5 — Token endpoint hardcoded
The token URL `https://cloud.uipath.com/identity_/connect/token` is hardcoded in both files. Should be derived from a base URL config.

---

## Category 2: Error Handling Gaps

### E1 — Silent catch blocks
`uipath-integration.ts` line 240: `catch { /* parse error */ }` — swallows JSON parse failures silently.
`uipath-deploy.ts` lines 106, 127: empty catch blocks for artifact parsing.
Multiple `try { } catch { /* non-blocking */ }` patterns throughout.

### E2 — Raw errors reaching the UI
Error messages from `sanitizeErrorMessage()` in deploy.ts still expose HTTP status codes and partial API response text. These are not user-friendly.

### E3 — No structured error types
Errors are thrown as generic `Error` objects with string messages. No custom exception classes for auth failures, API errors, or validation errors. Makes it impossible to programmatically distinguish error types.

### E4 — Fetch calls without timeout in integration.ts
`fetchUiPathFolders()` (line 125) uses raw `fetch()` with no timeout. If the Orchestrator is slow or unreachable, the request hangs indefinitely.

### E5 — Missing error propagation in diagnostic endpoint
The diagnostic endpoint (uipath-routes.ts line 380+) catches errors per-section but uses a generic `safeCall` wrapper that returns truncated error text. No structured reporting.

---

## Category 3: State Management

### S1 — All deployment state is in-memory only
`pushToUiPath()` returns results but nothing is persisted to the database. A server restart loses all deployment tracking. The only record is a chat message.

### S2 — No pipeline job tracking
There is no database table for tracking deployment pipeline state. Jobs are fire-and-forget — no way to retry, resume, or audit.

### S3 — Package data stored in chat messages
UiPath package metadata is stored as `[UIPATH:...]` prefixed chat messages (routes.ts line 221). This is fragile — parsing relies on string slicing and brace matching.

### S4 — Health check state is timestamp-only
`recordLastTestedAt()` stores only a timestamp. No record of what was tested, whether it passed, or what the latency was.

---

## Category 4: Code Duplication

### D1 — Response validation duplicated 3 times
- `parseOrchestratorResponse()` in uipath-deploy.ts (line 255)
- `extractError()` in uipath-fetch.ts (line 22)
- `isGenuineServiceResponse()` in uipath-deploy.ts (line 288) duplicates `isGenuineApiResponse()` in uipath-fetch.ts (line 190)
- `validateCreationResponse()` in deploy.ts (line 329) duplicates `isValidCreation()` in fetch.ts (line 227)

### D2 — UUID generation duplicated
`generateUuid()` exists in both uipath-integration.ts (line 194) and uipath-deploy.ts (line 52).

### D3 — Header construction duplicated
`headers()` function in deploy.ts (line 246) manually builds headers. Integration.ts does the same inline in multiple places. Should be centralized in auth module.

### D4 — OData escape duplicated
Only in deploy.ts but used inconsistently — some filter strings don't escape values.

---

## Category 5: Architectural Issues

### AR1 — No centralized API client
Every file makes its own `fetch()` calls with its own header construction. `uipath-fetch.ts` exists as a utility but is only used by deploy.ts — integration.ts bypasses it entirely.

### AR2 — Monolithic pushToUiPath function
`pushToUiPath()` in integration.ts is 800+ lines. It handles package building, NuGet packaging, uploading, process creation, and returns. No separation of concerns.

### AR3 — No retry on artifact provisioning
`deployAllArtifacts()` in deploy.ts attempts each artifact once. If a transient error occurs (429, 503), the artifact is marked as failed permanently.

### AR4 — Direct fetch() calls bypass retry logic
Integration.ts uses raw `fetch()` for folder listing, token acquisition, and health checks. The retry-capable `uipathFetch()` wrapper in fetch.ts is not used.

### AR5 — No background monitoring
No background threads/intervals for health checking, action center polling, or provisioning monitoring. Everything is on-demand only.

---

## Category 6: Missing Functionality

### M1 — Action Center integration (partially fixed)
Action Center Task Catalog creation uses OData and REST API endpoints. Misleading GenericTask/OData unbound action fallbacks that reported phantom success have been removed. When API creation fails (e.g., 405 on Cloud tenants), honest failure is reported with actionable manual steps. No polling, routing, or resolution logic exists yet.

### M2 — No Test Manager integration
Test case creation is attempted via diagnostic endpoint but returns 404. No test execution, evaluation, or blocking gate logic.

### M3 — No smart provisioning
No robot scaling logic. No queue depth monitoring. No provisioning decisions. Robots are not managed at all.

### M4 — No prerequisite checks before deploy
No machine availability, robot license, folder permission, or package feed checks before attempting to publish.

### M5 — No process lifecycle management
Process creation is a one-shot attempt with no versioning, rollback, or deprecation support.

### M6 — No SSE streaming for long operations
The push-uipath endpoint is synchronous. No progress streaming. UI shows a spinner with no context during the entire operation.

---

## Priority Fix List (for V2 rebuild)

1. **CRITICAL**: Centralize auth with token caching and proactive refresh (A1, A2, A3)
2. **CRITICAL**: Create typed API client that all modules use (AR1, AR4, D1, D3)
3. **HIGH**: Add 4 new DB tables for pipeline state persistence (S1, S2)
4. **HIGH**: Add prerequisite checks before any deploy (M4)
5. **HIGH**: Implement structured error types (E3)
6. **MEDIUM**: Eliminate code duplication (D1-D4)
7. **MEDIUM**: Add background health polling (AR5, S4)
8. **MEDIUM**: Add SSE streaming for long operations (M6)
9. **LOW**: Action Center, Test Manager, Smart Provisioning (M1-M3, M5) — Phase 2
