# CannonBall

## Overview
CannonBall is a full-stack web application designed for comprehensive automation pipeline management. Its primary purpose is to guide users from initial idea capture through to the deployment of AI-generated automation packages, aiming to significantly streamline the development and deployment process. Key capabilities include an AI-first approach, a role-based shell, a Kanban board, a three-panel workspace with live AI chat, and a visual process map engine. The platform focuses on automating interactions and generating deployable UiPath automation solutions, with a vision to enhance efficiency in automation development and deployment across various industries.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts. Reduce redundant code: Always consolidate duplicated logic into single canonical functions. When implementing shared behavior, create one source of truth and have all callers use it. Update all references across the app when consolidating — do not leave orphaned implementations that could cause discrepancies.

## System Architecture
The application employs a modern web stack for scalability and an intuitive user experience.

**Frontend**:
-   Built with React (Vite), Tailwind CSS, and shadcn/ui.
-   Uses React Flow for interactive process mapping and wouter for client-side routing.
-   Features a responsive UI, dark mode, and a distinct color palette.

**Backend**:
-   Express.js server handles API requests and session-based authentication.

**Database**:
-   PostgreSQL integrated with Drizzle ORM.

**AI Integration**:
-   Anthropic Claude via Replit AI Integrations for streaming SSE chat responses.

**Authentication**:
-   Session-based authentication supports demo users and role-switching.

**Key Features and Design Choices**:
-   **UI/UX**: Responsive sidebar, top navigation, and a resizable three-panel workspace displaying stage progress, a live React Flow process map, and the AI chat.
-   **UiPath Agent Awareness**: Supports full pipeline for automation type evaluation (RPA, Agent, Hybrid), influencing process maps, PDDs, SDDs, XAML generation, and deployment.
-   **Process Map Engine**: Supports custom node types (Start/End, Task, Decision, Agent-Task, Agent-Decision) with DAG-based layout, confidence scoring, inline editing, and an approval workflow. AS-IS and TO-BE maps are generated as separate, sequential AI calls — AS-IS first from the process narrative, then TO-BE auto-generated after AS-IS approval using the approved AS-IS steps + live Orchestrator service availability as context. No client-side node redistribution. Multi-start node cleanup, orphan node cleanup, and dead-end auto-repair. Supports chat-based map approval via `hasMapApprovalIntent()` — approves one view at a time based on current pipeline state.
-   **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with audit logging. Features frontend auto-chaining for document generation and approvals.
-   **Document Generation**: Automates version-controlled Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals, including visual process map images. Includes LLM-based intent classification for document generation. Uses a single canonical auto-chain path: AS-IS approval → TO-BE generation → TO-BE approval → PDD generation → PDD approval → SDD generation → SDD approval → UiPath package generation. Approval confirmation responses are capped at 300 tokens with inline doc detection disabled to prevent duplicate generation.
-   **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI-powered enrichment, adhering to UiPath Package Explorer compliance, REFramework, and generating 14 types of production-quality artifacts. Supports conversational deployment to UiPath Orchestrator with live status streaming. Includes robust handling for truncated LLM responses, caching mechanisms, and version conflict retries.
-   **Pre-Package Quality Gate**: Mandatory validation gate (`server/uipath-quality-gate.ts`) that runs before every NuGet package finalization and Orchestrator upload. Validates technical completeness (Modern project settings, Main.xaml existence, invoke path integrity, dependency versions, credential scanning, placeholder detection) and technical accuracy (known-activity whitelist with ~40 activity types, namespace consistency, expression syntax cross-checking for VB.NET/C# framework targeting, type argument validation, empty container detection). Blocked patterns cause immediate rejection. Results are surfaced in API responses with categorized violations.
-   **Workflow Analyzer Compliance Engine**: Static analysis for 11+ Workflow Analyzer rules with auto-correction, comprehensive reporting, and dynamic governance policy integration from Automation Ops.
-   **UiPath Naming Convention Enforcement**: Standardized naming conventions for variables and arguments enforced throughout XAML generation.
-   **Argument Validation**: Automated argument validation at workflow entry points.
-   **Three-Tier Developer Handoff Guide (DHG)**: Restructured with an AI-first philosophy (Tier 1: AI Completed, Tier 2: Smart Defaults, Tier 3: Human Required), including readiness score, Workflow Analyzer compliance report, code review rubric, and Section 2a for agent artifact import/configuration. Includes process logic validation.
-   **UiPath Integration Layer**: Manages UiPath's multi-resource token architecture with proactive refresh, typed Orchestrator API client, and robust artifact provisioning. Supports artifact upsert on re-deployment and SSE deploy streaming.
-   **Integration Service Connector Discovery**: Queries UiPath Integration Service API to discover available connectors and active connections on the tenant. Discovered connections are injected into SDD generation prompts, chat system prompts, and platform capability profiles so designs reference real connected enterprise systems (SAP, Salesforce, ServiceNow, etc.) by name. The Settings UI shows discovered connections with status badges, and the XAML generator recommends Integration Service connectors over custom HTTP activities for known enterprise systems.
-   **Maestro Process Orchestration**: Generates BPMN-compatible Maestro process definitions with service tasks (linked to Orchestrator processes by name), user tasks (linked to Action Center catalogs), gateways with conditions, and events. Deploys via the Maestro API (`{base}/maestro_/`) using the `PIMS` OAuth scope. Falls back to in-package artifacts with manual import steps when Maestro is unavailable.
-   **Unified Probe Architecture**: Single source of truth for platform service availability with caching and automated configuration changes. Discovers Automation Ops governance policies, attended/unattended robot landscape, and existing Studio processes in parallel. Probes Maestro alongside other services.
-   **Automation Ops Integration**: Discovers governance policies from UiPath Automation Ops and syncs them into the Workflow Analyzer for build-time compliance checking (activity-restriction, naming, error-handling, security). Governance context is injected into SDD generation and AI chat prompts.
-   **Attended Robot & Studio Discovery**: Probes UiPath for attended/Assistant robot sessions and existing Studio processes/releases. Robot landscape and process names are used as context during SDD generation and chat interactions.
-   **Consolidated Streaming Progress Indicator**: A unified component for displaying real-time progress during AI chat, document generation, and deployment. During PDD/SDD generation, a live DocumentCard renders progressively as sections stream in (with pulsing write cursor, auto-expanding latest section, elapsed timer, and cancel button), transitioning seamlessly to the final saved card with Approve/Reject buttons on completion. Uses `docGenIdRef` generation session tracking to prevent stale stream cleanup from resetting active doc generation state during auto-chain transitions.
-   **Document Approval**: Supports approval of PDD/SDD via dedicated buttons, chat phrases, or auto-chain detection.
-   **Document Understanding — Discovery-Based Provisioning**: Manages DU project provisioning by discovering existing projects via API.
-   **Integration Status Bar**: Displays live UiPath connection status, robot count, pending tasks, and latency.
-   **File Upload Content Extraction**: Server-side extraction from various document types (DOCX, PDF, XLSX, TXT, CSV) for AI context.
-   **Image/Screenshot Vision**: Processes image files (PNG, JPEG, WebP, GIF) via Claude's vision API for text extraction and process analysis.
-   **Admin & Review Panels**: Dedicated interfaces for CoE review and administrative tasks.
-   **Role-Based Access**: Authorization enforced based on user ownership and roles for process maps and documents.
-   **Multi-Orchestrator Connection Management**: Supports storing and managing multiple UiPath Orchestrator connection profiles.
-   **Automation Hub & Store Integration**: Connects to UiPath Automation Hub to import automation ideas as Cannonball projects with pre-populated AI context. After successful deployment, completed automations are automatically published to the Automation Store with documentation and deployment metadata. The active connection stores an optional Open API token for Hub authentication (`automation_hub_token` column on `uipath_connections`). API client in `server/automation-hub.ts`, routes added to `server/uipath-routes.ts`, Settings UI panel in `AutomationHubPanel` component.
-   **JSON Sanitization**: Robust parsing of AI-generated JSON with error recovery.
-   **Shared Utilities**: Consolidated server and client utilities for common functions and shared types.
-   **Deploy Parallelization**: Groups independent UiPath API calls into parallel batches to reduce deploy time.

## External Dependencies
-   **AI Service**: Anthropic Claude (via Replit AI Integrations)
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Frontend Libraries**: React Flow, @dagrejs/dagre, shadcn/ui, wouter
-   **Backend Framework**: Express.js
-   **Session Management**: `express-session`, `connect-pg-simple`
-   **File Parsing**: `mammoth`, `pdf-parse`, `xlsx`, `multer`
-   **Image Processing**: `sharp`
-   **UiPath Orchestrator**: For deploying automation packages and API integrations.