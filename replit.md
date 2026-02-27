# CannonBall

## Overview
CannonBall is a full-stack web application for automation pipeline management, guiding users from idea capture to deployment of automation packages with an AI-first approach. It features a role-based shell, a Kanban pipeline board with stalled idea detection, a three-panel workspace including a live AI chat, and a visual process map engine. The system streamlines the development and deployment of automation solutions by automating interactions from idea generation to the creation of deployable automation packages.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts.

## System Architecture
The application employs a modern web stack:
- **Frontend**: React + Vite, styled with Tailwind CSS and shadcn/ui, using React Flow for process mapping and wouter for routing. It features a responsive UI with dark mode default and a distinct color palette.
- **Backend**: Express.js server for API requests and session-based authentication.
- **Database**: PostgreSQL with Drizzle ORM.
- **AI Integration**: Anthropic Claude via Replit AI Integrations for streaming SSE chat responses.
- **Authentication**: Session-based authentication with demo users and role-switching.

**Key Features and Design Choices:**
- **UI/UX**: Responsive sidebar, top navigation, and a three-panel workspace (resizable) for stage progress, a live React Flow process map, and AI chat.
- **Process Map Engine**: Custom node types (Start/End, Task, Decision), dagre-based DAG layout for intelligent branching, confidence scoring, inline editing, context menus with "Connect to..." guided mode, edge labeling, and an approval workflow. Dynamically updates based on AI's numbered `[STEP: 1.0 Name ...]` tags with deterministic step-number-based edge resolution (no fuzzy matching). Connection handles follow Lucidchart/draw.io pattern: invisible by default, source handles appear on hover, target handles pulse during active connection drag or "Connect to..." mode.
- **Automated Stage Transitions**: Engine evaluates and automatically transitions ideas across 10 pipeline stages based on criteria, with audit logging.
- **Document Generation**: Automated PDD and SDD generation after process map and PDD approvals, respectively, including version control. Chat-regenerated documents are auto-saved. Raw `[STEP:]` tags are automatically stripped from document content and replaced with a formatted process map table injected from the database (to-be nodes for SDD, as-is for PDD, with edge flow summary).
- **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI-powered enrichment via `server/ai-xaml-enricher.ts`. The enricher analyzes process maps + SDD content using Claude to generate multi-activity sequences per node, system-specific selectors (SAP, Salesforce, ServiceNow, web, desktop), context-aware variable names, and real property values from SDD artifacts. Falls back to keyword-based classification if AI enrichment fails. The XAML generator engine (`server/xaml-generator.ts`) supports:
  - **UiPath Package Explorer Compliance**: `makeUiPathCompliant()` post-processor injects `sap2010:WorkflowViewState.IdRef`, `sap:VirtualizedContainerService.HintSize`, `mva:VisualBasic.Settings`, namespace imports, and `ViewStateManager` block into every XAML file so activities render visually in UiPath Package Explorer (not blank).
  - **SDD/PDD Traceability Comments**: Every XAML file includes header comments (project, generation date, process map stats) and per-activity source comments linking back to process map step names, node types, systems, and roles.
  - **REFramework Pattern**: Automatically generates State Machine Main.xaml (Init → Get Transaction → Process → End), GetTransactionData.xaml, SetTransactionStatus.xaml, CloseAllApplications.xaml, and KillAllProcesses.xaml when queues are detected in SDD artifacts. Each file includes REFramework-specific header comments.
  - **Workflow Decomposition**: AI suggests grouping related steps into sub-workflows by system/function; generates InvokeWorkflowFile calls in Main.xaml.
  - **Enhanced Config.xlsx**: Settings sheet populated with all Orchestrator assets (GetAsset/GetCredential), Constants sheet with queue names, API endpoints. REFramework-specific config (OrchestratorQueueName, MaxRetryNumber, ProcessName) added when queues present.
  - **Enhanced InitAllSettings.xaml**: Real ForEach row iteration, GetCredential calls for credential assets, GetAsset calls for text/integer assets. Includes traceability header with asset/queue counts.
  - **Enhanced Developer Handoff Guide (DHG)**: Architecture Decision Record (REFramework vs Linear rationale), system-specific selector guidance (SAP, Salesforce, ServiceNow), risk assessment from process map pain points, environment setup checklists (Dev/UAT/Prod), AI-generated architecture notes.
  - Supports conversational deployment to UiPath Orchestrator with live status streaming.
- **Test Manager V2 API Integration**: Creates Test Manager projects and test cases. Tries 6 endpoint patterns (PascalCase/camelCase bodies, URL variants, TM-scoped and main Orchestrator tokens) with verbose failure diagnostics including Swagger endpoint probing. Falls back to "failed" status with detailed attempt log.
- **Action Center Provisioning**: Creates Task Catalogs via Actions microservice, OData POST, OData unbound action (`UiPathODataSvc.CreateTask`), and GenericTasks fallback. Pre-checks catalog existence. Returns detailed diagnostic on failure including all endpoints attempted with status codes.
- **UiPath Diagnostic Endpoint**: `GET /api/admin/uipath-diagnostic` (admin-only) tests real API calls across all 11 artifact types against the connected tenant and returns structured JSON results.
- **Automation-First Deployment**: All provisioning uses statuses "created", "exists", "failed", or "skipped" — never "manual". Failed artifacts show clear API limitation messages. Deployment report card footer shows "API-limited" count.
- **File Upload Content Extraction**: Server-side file upload (`/api/upload`) with content extraction for DOCX (mammoth), PDF (pdf-parse), XLSX (xlsx), TXT, and CSV. Extracted content is injected into AI chat context to automatically drive process mapping and document generation. Images and videos are acknowledged with prompts for user description.
- **Admin & Review Panels**: CoE review page for idea approval/rejection and an Admin panel for user management, audit logs, and system configuration.
- **Role-Based Access**: Authorization enforced on process map and document routes based on user ownership and roles (Admin/CoE).
- **Server Performance & Stability**: Lightweight request logging (method/path/status/duration only, no response body capture), process-level crash handlers (`unhandledRejection`, `uncaughtException`) for visibility, graceful session middleware error handling for deployment healthchecks, and DB-level LIMIT on chat history queries (`getRecentMessagesByIdeaId`) to reduce memory usage.
- **V2 UiPath Integration Layer**: Hardened auth module (`server/uipath-auth.ts`) with singleton token caching, proactive 60s-before-expiry refresh, 401 auto-retry, secret masking, and expanded default scopes covering Orchestrator (`OR.*`), Action Center (`AC.*`), and Test Manager (`TM.*`) in a single cached token. Service-specific base URL helpers: `getBaseUrl` (Orchestrator `orchestrator_`), `getTestManagerBaseUrl` (Test Manager `testmanager_`). Action Center uses the Orchestrator base URL (`{orchBase}/tasks/taskCatalogs` and `{orchBase}/tasks/`), not a separate microservice. Typed Orchestrator API client (`server/orchestrator-client.ts`) with exponential backoff retry (3x), 30s timeout, and full method coverage (queues, processes, jobs, robots, action center via Orchestrator tasks API, test manager via `testmanager_/api`, triggers, monitoring). Prerequisite checker (`server/prerequisite-checker.ts`) with 6 checks (machines, robots, folder, package feed, action center, test manager) returning blocking/warning/pass statuses. New API endpoints: `/api/uipath/health`, `/api/uipath/live-ops`, `/api/uipath/diagnostics`, `/api/uipath/prerequisites`, provisioning status/emergency-stop, action center tasks, test results.
- **Integration Status Bar**: Persistent collapsible bar at app shell bottom (`client/src/components/integration-status-bar.tsx`) showing live UiPath connection status (green pulse/red dot), robot count, pending Action Center tasks, latency, and last provisioning decision. Polls `/api/uipath/health` every 60s. Accessible with aria-expanded/aria-controls.
- **Enhanced Diagnostics & Live Operations UI**: Settings Integrations tab shows structured diagnostics checklist with pass/blocking/warning states and inline remediation. Live Operations panel auto-refreshes every 30s showing connection latency, active jobs, pending tasks, processes, machines, queues. Connection badge driven by live healthCheck polling. Disconnected state with retry button.
- **Pipeline Database Tables**: 4 new tables in `shared/models/pipeline.ts` — `pipeline_jobs` (12-stage agent tracking), `provisioning_log` (scaling decisions), `action_tasks` (Action Center tracking), `test_results` (test gate decisions).

## External Dependencies
- **AI Service**: Anthropic Claude (via Replit AI Integrations).
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM.
- **Frontend Libraries**:
    - React Flow (@xyflow/react)
    - @dagrejs/dagre
    - shadcn/ui
    - wouter
- **Backend Framework**: Express.js.
- **Session Management**: express-session and connect-pg-simple.
- **File Parsing**: mammoth (DOCX), pdf-parse (PDF), xlsx (XLSX/XLS), multer (file upload handling).
- **UiPath Orchestrator**: For deploying automation packages, including API integrations for provisioning assets, queues, and processes.

## UiPath API Diagnostic Results (Feb 2026)
Admin diagnostic endpoint: `GET /api/admin/uipath-diagnostic`

| Artifact Type | API Status | Fix Applied |
|---|---|---|
| Queues | Working | N/A |
| Assets | Working | N/A |
| Machines | Working | N/A |
| Triggers | Working (needs process) | N/A |
| Storage Buckets | Working | UUID Identifier required; no StorageProvider preferred |
| Environments | Manual | Modern folders deprecated (405). Machine templates used instead |
| Robot Accounts | Manual | Identity API returns HTML. PM token OK but endpoint inaccessible |
| Action Center | Manual | Task Catalog POST returns 405. Tenant limitation |
| Test Data Queues | Working | `ContentJsonSchema` field required (default schema added) |
| Document Understanding | Manual | DU service not available on tenant |
| Test Manager | Manual | TestCases endpoints return 404. Project CRUD works |

Key files: `server/uipath-deploy.ts` (provisioning), `server/uipath-routes.ts` (diagnostic endpoint), `server/uipath-integration.ts` (auth/connection), `client/src/components/deployment-report-card.tsx` (UI).