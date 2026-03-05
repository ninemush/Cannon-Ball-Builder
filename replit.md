# CannonBall

## Overview
CannonBall is a full-stack web application designed for comprehensive automation pipeline management. It guides users from initial idea capture through to the deployment of automation packages using an AI-first approach. The platform aims to streamline the development and deployment of automation solutions by automating interactions and generating deployable automation packages, featuring a role-based shell, a Kanban board, a three-panel workspace with live AI chat, and a visual process map engine.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts.

## System Architecture
The application is built on a modern web stack designed for scalability and an intuitive user experience.

-   **Frontend**: React with Vite, styled using Tailwind CSS and shadcn/ui. It utilizes React Flow for interactive process mapping and wouter for client-side routing. The UI is responsive, defaults to dark mode, and employs a distinct color palette.
-   **Backend**: An Express.js server handles API requests and implements session-based authentication.
-   **Database**: PostgreSQL is used for data persistence, managed via Drizzle ORM.
-   **AI Integration**: Anthropic Claude is integrated via Replit AI Integrations to provide streaming Server-Sent Events (SSE) for chat responses.
-   **Authentication**: Session-based authentication supports demo users and role-switching capabilities.

**Key Features and Design Choices:**

-   **UI/UX**: Features a responsive sidebar, top navigation, and a resizable three-panel workspace displaying stage progress, a live React Flow process map, and the AI chat interface.
-   **Process Map Engine**: Custom node types (Start/End, Task, Decision) are supported, with DAG-based layout for intelligent branching. It includes confidence scoring, inline editing, context menus, and an approval workflow. Dynamic updates from AI's `[STEP: 1.0 Name ...]` tags ensure deterministic step-number-based edge resolution.
-   **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with comprehensive audit logging.
-   **Document Generation**: Automates the generation of Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals, including version control. Regenerated documents are auto-saved, and raw `[STEP:]` tags are formatted and replaced with process map tables.
-   **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI-powered enrichment. The AI analyzes process maps and SDD content to create multi-activity sequences, system-specific selectors (SAP, Salesforce, ServiceNow), context-aware variable names, and real property values from SDD artifacts. It adheres to UiPath Package Explorer compliance, includes traceability comments linking back to process map steps, supports the REFramework pattern (generating State Machine Main.xaml, GetTransactionData.xaml, etc., when queues are detected), and enhances `Config.xlsx` and `InitAllSettings.xaml`. It also generates an Enhanced Developer Handoff Guide (DHG). Conversational deployment to UiPath Orchestrator with live status streaming is supported.
-   **UiPath Integration Layer**: A robust authentication module handles UiPath's multi-resource token architecture, managing five independent cached token types (Orchestrator, Test Manager, Document Understanding, Platform Management, Data Service) with proactive refresh, 401 auto-retry, and secret masking. It includes typed Orchestrator API client with exponential backoff and prerequisite checker. Test Manager API uses `/api/v2/{projectId}/testcases` endpoint pattern (projectId is a GUID, not an integer). Test steps are attached via separate PUT to `/api/v2/{projectId}/teststeps/testcase/{testCaseId}` after creation. Full Test Manager lifecycle: Requirements → Test Cases (with steps) → Test Sets (with assigned test cases) → Requirement↔TestCase linking. All artifacts use idempotent create-or-update: existing items are detected by name match and reported as "exists" instead of creating duplicates. SDD artifacts prompt (both chat route and document-routes) generates `requirements`, `testCases`, and `testSets` arrays; `testSets` reference test case names for automatic assignment. TM project selection uses exact name match (case-insensitive, underscores normalized to spaces); no fallback to first project — a new project is created if no exact match exists. TM project creation uses `projectPrefix` field (not `prefix`) with PascalCase fallback. Test steps are sent both inline during creation (`testSteps`/`manualSteps` fields) and via separate PUT/POST attempts for maximum compatibility. Action Center catalog creation tries `/api/TaskCatalogs` (REST) first, then falls back to `/odata/TaskCatalogs` (OData). `getPlatformCapabilities()` uses DU-specific token (not OR token) to probe Document Understanding availability, matching `probeServiceAvailability()` behavior. Both `getPlatformCapabilities()` and `probeServiceAvailability()` use permissive AC detection — Action Center is marked available whenever Orchestrator is connected. Chat route always runs service probe regardless of pipeline stage (no stage gating). Chat route strips old superseded SDD/PDD messages from chat history (replaces with short summaries) to prevent AI from reproducing outdated service availability claims; only the most recent version of each document type is kept in full. System prompt includes strong override language ensuring AI uses current live probe data over any contradictory information in previous messages.
-   **Integration Status Bar**: A persistent, collapsible status bar displays live UiPath connection status, robot count, pending Action Center tasks, latency, and last provisioning decisions.
-   **Enhanced Diagnostics & Live Operations UI**: A settings tab provides a structured diagnostics checklist with inline remediation and a live operations panel showing real-time metrics.
-   **File Upload Content Extraction**: Server-side content extraction from DOCX, PDF, XLSX, TXT, and CSV files, injecting content into the AI chat context to drive process mapping and document generation.
-   **Admin & Review Panels**: Dedicated panels for CoE review (idea approval/rejection) and Admin tasks (user management, audit logs, system configuration).
-   **Role-Based Access**: Authorization is enforced on process map and document routes based on user ownership and roles.

## External Dependencies
-   **AI Service**: Anthropic Claude (via Replit AI Integrations)
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Frontend Libraries**:
    -   React Flow (`@xyflow/react`)
    -   `@dagrejs/dagre`
    -   `shadcn/ui`
    -   `wouter`
-   **Backend Framework**: Express.js
-   **Session Management**: `express-session`, `connect-pg-simple`
-   **File Parsing**: `mammoth` (DOCX), `pdf-parse` (PDF), `xlsx` (XLSX/XLS), `multer` (file upload)
-   **UiPath Orchestrator**: For deploying automation packages and API integrations for provisioning assets, queues, and processes.

## UiPath Multi-Resource Token Architecture
UiPath's identity server (`cloud.uipath.com/identity_/connect/token`) cannot mix scopes from different resource types in a single token request (returns `invalid_scope`). The auth module (`server/uipath-auth.ts`) maintains 5 independent cached tokens:

| Resource | Token Function | Scopes | Service |
|---|---|---|---|
| OR | `getToken()` / `getHeaders()` | 74 OR.* scopes (from DB) | Orchestrator, Action Center |
| TM | `getTmToken()` / `getTmHeaders()` | 16 TM.* scopes | Test Manager |
| DU | `getDuToken()` | `Du.DocumentManager.Document` | Document Understanding |
| PM | `getPmToken()` | 6 PM.* scopes | Platform Management, Robot Accounts |
| DF | `getDfToken()` | `DataFabric.Schema.Read .Data.Read .Data.Write` | Data Service |

**Service Availability Detection:** `probeServiceAvailability()` uses permissive detection — Action Center is available whenever Orchestrator is connected; Test Manager is available whenever TM token acquisition succeeds. This availability data flows into the AI system prompt (affecting to-be process map design and automation %), PDD generation (platform capabilities injected via `getPlatformCapabilities()`), and SDD generation (artifact inclusion).

**Deployment Architecture:** Provisioning is attempt-first — Action Center, Test Manager, and DU artifacts are always attempted regardless of probe results. The provisioning functions themselves determine success/failure. Single deployment report card per deployment (push-uipath route returns JSON only; chat route in `server/replit_integrations/chat/routes.ts` handles message creation).

**JSON Sanitization:** All AI-generated JSON (SDD artifact blocks, LLM extraction responses, XAML enricher responses) is sanitized before parsing via `sanitizeJsonString()` — a state-machine parser that properly escapes literal newlines/tabs/control characters inside JSON string values. Code fences are stripped via `stripCodeFences()` which uses greedy regex matching and falls back to brace extraction. Both functions live in `server/uipath-deploy.ts`; the XAML enricher (`server/ai-xaml-enricher.ts`) has an inline copy.

Key files: `server/uipath-auth.ts` (token management), `server/uipath-deploy.ts` (provisioning + JSON sanitization), `server/uipath-integration.ts` (service probing), `server/uipath-routes.ts` (API routes), `server/document-routes.ts` (PDD/SDD generation with platform capabilities), `server/ai-xaml-enricher.ts` (AI-powered XAML activity enrichment).