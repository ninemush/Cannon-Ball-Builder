# CannonBall

## Overview
CannonBall is a full-stack web application designed for automation pipeline management. Its core purpose is to guide users from initial idea capture to the deployment of automation packages, primarily leveraging an AI-first approach. Key capabilities include a role-based shell, a Kanban pipeline board with stalled idea detection, a three-panel workspace featuring a live AI chat, and a visual process map engine. The system automates interactions from idea generation to the creation of deployable automation packages, aiming to streamline the development and deployment of automation solutions.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts.

## System Architecture
The application employs a modern web stack:
- **Frontend**: Built with React + Vite, styled using Tailwind CSS and shadcn/ui, and utilizes React Flow for process mapping and wouter for routing. It features a responsive/adaptive UI for various devices, including a dedicated mobile view with a bottom tab bar for the workspace.
- **Backend**: An Express.js server handles API requests and session-based authentication.
- **Database**: PostgreSQL is used for data persistence, managed with Drizzle ORM.
- **AI Integration**: Anthropic Claude, accessed via Replit AI Integrations, powers the AI chat, offering streaming SSE responses.
- **Authentication**: Session-based authentication is implemented with demo users and role-switching capabilities.

**Key Features and Design Choices:**
- **UI/UX**: Features a dark mode default with a light mode toggle, a distinct color palette (orange accent, teal, gold, magenta, purple), Inter font, and custom scrollbar styling. The layout includes a responsive sidebar and a top navigation bar.
- **Workspace**: A three-panel layout (resizable) for stage progress tracking, a live React Flow process map, and an AI chat interface.
- **Process Map Engine**: Custom node types (Start/End, Task, Decision), dagre-based DAG layout for intelligent branching, confidence scoring, completeness bar, inline editing, context menu, edge labeling with branch conditions (Yes/No/Approved/Rejected), and an approval workflow. It dynamically updates based on AI's `[STEP:]` tags with FROM/LABEL fields for branching.
- **Automated Stage Transitions**: An engine that evaluates and automatically transitions ideas between 10 defined pipeline stages based on specific criteria (e.g., number of steps, messages, document approvals), with audit logging.
- **Document Generation**: Automated generation of PDD (Process Design Document) and SDD (Solution Design Document) after process map and PDD approvals, respectively. Includes document version control. Chat-regenerated documents are auto-saved via [DOC:] tag interception.
- **UiPath Package Generation & Deployment**: After SDD approval, the system generates a UiPath compatible ZIP package (project.json, XAML stubs, README). It supports conversational deployment, where the AI triggers deployment to UiPath Orchestrator with live status streaming.
- **Admin & Review Panels**: Includes a CoE review page for idea approval/rejection and an Admin panel for user management, audit logs, and system configuration.
- **Role-Based Access**: Authorization is enforced on process map and document routes based on user ownership and roles (Admin/CoE).

## External Dependencies
- **AI Service**: Anthropic Claude (via Replit AI Integrations) for natural language processing and chat functionalities.
- **Database**: PostgreSQL for relational data storage.
- **ORM**: Drizzle ORM for database interaction.
- **Frontend Libraries**:
    - React Flow (@xyflow/react) for interactive process mapping.
    - @dagrejs/dagre for directed-graph layout (branching process maps).
    - shadcn/ui for UI components.
    - wouter for client-side routing.
- **Backend Framework**: Express.js for the server-side application.
- **Session Management**: express-session and connect-pg-simple for session-based authentication.
- **UiPath Orchestrator**: For deploying automation packages, including API integrations for provisioning assets, queues, and processes.

## Step Tag Format
```
[STEP: <name> | ROLE: <who> | SYSTEM: <system> | TYPE: <task/decision/start/end> | FROM: <parent step name> | LABEL: <edge label>]
```
- FROM field connects to parent step by name for branching
- LABEL field provides edge condition text (Yes/No/Approved/Rejected)
- Decision nodes must have multiple children with different labels
- Steps without FROM fall back to sequential connection

## Recent Changes
- 2026-02-23: Platform-aware SDD generation: getPlatformCapabilities() probes connected UiPath tenant for available services (Orchestrator, Action Center, DU, Test Manager, Storage Buckets, AI Center) in parallel; SDD prose prompt redesigned to evaluate full UiPath platform breadth (bots, agents, human-in-the-loop, DU, Integration Service, Communications Mining, Apps); "Platform Recommendations" section auto-generated for unavailable services explaining what each would unlock; artifact prompt expanded with environments, DU, testCases arrays
- 2026-02-23: Trigger runtime fix: detectAvailableRuntimeType() now defaults to "Unattended" instead of null; removed skip logic so triggers are always created, matching machine templates already provisioned with unattended slots
- 2026-02-23: Parallel SDD generation: prose sections (1-7) and orchestrator artifacts (section 9) generated simultaneously via parallel AI calls, reducing generation time by ~40%; dedicated artifact prompt ensures reliable ```orchestrator_artifacts block output; reusable parseArtifactBlock() parser
- 2026-02-23: Scope verification system: GET /api/settings/uipath/verify-scopes endpoint decodes JWT to extract granted scopes, probes service availability (Orchestrator, Storage Buckets, Action Center, Test Manager, Document Understanding); Admin UI "Verify Scopes & Services" button with service status grid and granted scope badges
- 2026-02-23: Comprehensive scope expansion: default scopes updated to include OR.Blobs, OR.Tasks, OR.TestSets, OR.ML, OR.Administration, and 10+ additional scopes; DB scopes auto-updated to match granted permissions
- 2026-02-23: Graceful service unavailability: "skipped" deployment status distinguishes failures from unavailable services; amber warning styling; aggregated skip messages (e.g. "10 test cases skipped - Test Manager not available"); deployment report footer shows partial success state
- 2026-02-23: Multi-path API endpoint routing: Action Center tries 4 endpoint patterns (orchestrator odata, actions_, tasks_, maestro_ APIs); Document Understanding probes 4 endpoints (du_, aifabric_); improved error detection for "ServiceType not onboarded" patterns
- 2026-02-23: Post-creation verification: all Orchestrator artifact provisioning (queues, assets, machines, triggers, storage buckets, environments) now reads back created artifacts via GET to confirm they actually exist; response body error detection catches hidden UiPath errors in 200/201 responses (ErrorCode, odata.error, nested Response errors); pre-deployment folder and release validation
- 2026-02-23: Word document export: checklist dialog (checkboxes for As-Is, To-Be, PDD, SDD) replaces old dropdown; backend generates .docx via `docx` package with styled headings, process step tables, connection lists, version history tables, approval badges; markdown-to-docx conversion for document content
- 2026-02-23: Trigger runtime detection: detectAvailableRuntimeType() queries Sessions/Robots endpoints to find actual runtimes before creating triggers; skips all triggers with informational message when no runtimes exist instead of creating broken triggers that flood error emails
- 2026-02-23: SDD approval deployment hook: approving SDD now triggers context-aware deployment prompt in chat with artifact summary (queues, assets, machines, triggers count), target folder, and clear call-to-action for user to deploy
- 2026-02-23: Zero-manual deployment: removed manual_required status entirely — all artifact provisioning now uses aggressive multi-path retry logic (DU API + AI Fabric API, multiple Test Manager URLs, cloud Action Center paths) and reports only created/exists/failed
- 2026-02-23: SDD inline viewer: SDD view in process map panel now shows actual Solution Design Document content with collapsible sections, markdown rendering, version badge, and approval status instead of duplicate process map
- 2026-02-23: SDD empty state: clear guided prompt when no SDD exists showing the progression path (Approve To-Be Map → Approve PDD → SDD Generated)
- 2026-02-23: Deployment report card cleanup: removed manual_required styling, only shows created/exists/failed statuses with updated counts and messaging
- 2026-02-23: Deployment report card UI: structured collapsible card component replacing raw markdown dump, grouped by artifact type with status icons and summary counts
- 2026-02-23: Deployment error handling: StartStrategy fallback chain (15→0→{Type:0}), 405 graceful fallback across all artifact provisioning (triggers, environments, storage buckets, action center)
- 2026-02-23: Message queue system: users can type and queue messages while AI processes, queued messages shown with cancel buttons, auto-sends next message when streaming AND doc generation complete
- 2026-02-23: Fullscreen process map mode: maximize/minimize button in toolbar, fixed overlay at z-50, Escape key to exit, preserves all editing tools
- 2026-02-23: Three-way view toggle: SDD view added to process map panel alongside As-Is/To-Be, distinct orange styling, auto-copy from To-Be, full backend support with process-map-routes
- 2026-02-23: Chat message cleanup: raw [STEP:] tags stripped from displayed text via stripStepTags() while still parsed for process map updates
- 2026-02-23: UiPath Document Understanding integration: DU project instructions generated in deployment report with document type taxonomy
- 2026-02-23: UiPath Test Manager integration: auto-provisions test projects and test cases via Test Manager API with manual step definitions; graceful fallback to manual instructions if API unavailable
- 2026-02-23: Extended orchestrator_artifacts block: added documentUnderstanding and testCases arrays to SDD generation, LLM extraction, validation, and deployment pipeline
- 2026-02-23: Process map undo/redo: in-memory history stack (50 snapshots), Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y keyboard shortcuts, toolbar undo/redo buttons, snapshots on every meaningful change (node add/edit/delete, edge add/edit/delete, drag, reconnect)
- 2026-02-23: Edge reconnection: drag edge endpoints to different nodes via ReactFlow onReconnect, DB sync on reconnect, visual feedback during reconnection (pulsing orange handles, dashed edge animation)
- 2026-02-23: Enhanced visual handles: glowing blue handles on node hover, scale-up on handle hover, orange pulsing handles during reconnection mode, connection line glow effect
- 2026-02-23: Fixed UiPath QueueTrigger payload: corrected field names (ReleaseName, JobsCount, RuntimeType), removed invalid fields (ProcessKey, NoOfRobots, Priority, Strategy), fixed queue trigger existence check to use QueueTriggers endpoint instead of ProcessSchedules, added ReleaseName parameter passthrough, fixed time trigger StartStrategy to use numeric value
- 2026-02-22: Interactive process map editor: positions persist to DB, dagre only runs on first load or explicit re-layout, no auto-reset on data changes. Right-click node context menu (Edit/Add Child/Delete), edge selection with Delete key, double-click to edit nodes/edge labels, Re-layout toolbar button, connection handles visible on hover, edge selection action bar
- 2026-02-22: Intelligent branching process maps: dagre DAG layout, FROM/LABEL fields in [STEP:] tags, decision node forking with labeled Yes/No edges, smooth-step edge paths, color-coded branch labels (green=Yes, red=No)
- 2026-02-22: Fixed SDD/PDD Confirm button: backend now allows re-approval of newer document versions (deletes old approval, supersedes old doc); frontend shows error toast on failure
- 2026-02-22: Fixed UiPath trigger provisioning: StartStrategy now uses proper object format { Type: 0 } instead of raw integer
- 2026-02-21: Fixed critical bug: chat-regenerated documents (PDD/SDD) now saved to database via [DOC:] tag interception in chat route
- 2026-02-21: Added document/approval context to AI chat system prompt
- 2026-02-21: Pipeline layout: all 10 stage columns fit within viewport width on desktop (flex-1 min-w-0)
- 2026-02-21: Mobile-responsive/adaptive UI: all pages adapt to mobile viewports
- 2026-02-21: Document version control: version history dropdown in DocumentCard
- 2026-02-21: Conversational deployment: AI asks if ready to push, [DEPLOY_UIPATH] tag triggers deployment
- 2026-02-20: Full Orchestrator deployment pipeline with artifact provisioning
- 2026-02-20: Fixed NuGet package structure for proper UiPath Orchestrator indexing
- 2026-02-20: Built live process map engine, CoE review page, Admin panel, User Guide
- 2026-02-20: AI-first behavioral model with streaming chat, [STEP:] tag parsing
- 2026-02-20: Initial app shell with auth, role switching, navigation, dark/light mode
