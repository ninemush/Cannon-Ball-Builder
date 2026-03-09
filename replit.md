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
-   **UI/UX**: Features a responsive sidebar, top navigation, and a resizable three-panel workspace displaying stage progress, a live React Flow process map, and the AI chat.
-   **UiPath Agent Awareness**: Supports full pipeline for automation type evaluation (RPA, Agent, Hybrid), influencing process maps, PDDs, SDDs, XAML generation, and deployment.
-   **Process Map Engine**: Supports custom node types (Start/End, Task, Decision, Agent-Task, Agent-Decision) with DAG-based layout, confidence scoring, inline editing, and an approval workflow.
-   **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with audit logging.
-   **Document Generation**: Automates version-controlled Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals, including visual process map images.
-   **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI-powered enrichment, adhering to UiPath Package Explorer compliance, REFramework, and generating 14 types of production-quality artifacts. Supports conversational deployment to UiPath Orchestrator with live status streaming.
-   **Workflow Analyzer Compliance Engine**: Static analysis for 11 Workflow Analyzer rules with auto-correction and comprehensive reporting.
-   **UiPath Naming Convention Enforcement**: Standardized naming conventions for variables and arguments enforced throughout XAML generation.
-   **Argument Validation**: Automated argument validation at workflow entry points.
-   **Three-Tier Developer Handoff Guide (DHG)**: Restructured with an AI-first philosophy (Tier 1: AI Completed, Tier 2: Smart Defaults, Tier 3: Human Required), including readiness score, compliance report, and code review rubric.
-   **UiPath Integration Layer**: Manages UiPath's multi-resource token architecture with proactive refresh, typed Orchestrator API client, and robust artifact provisioning.
-   **Unified Probe Architecture**: Single source of truth for platform service availability with caching and automated configuration changes.
-   **Consolidated Streaming Progress Indicator**: A unified component for displaying real-time progress during AI chat, document generation, and deployment.
-   **LLM-Based Intent Classification**: Uses a lightweight LLM call to classify user intent (PDD, SDD, DEPLOY, CHAT) to drive appropriate system actions and document generation.
-   **Document Approval**: Supports approval of PDD/SDD via dedicated buttons or chat phrases, with a pending-approval banner for unapproved documents.
-   **Artifact Upsert on Re-deployment**: Deployment uses create-or-update logic for all artifact types in UiPath Orchestrator, including PUT-404 fallback to POST.
-   **SSE Deploy Streaming**: Button-triggered deploy (`POST /api/ideas/:ideaId/push-uipath`) uses Server-Sent Events to stream real-time per-artifact progress to the client. `deployAllArtifacts` accepts an `onProgress` callback. The deploy report is saved as an assistant chat message with `[DEPLOY_REPORT:{...}]` tag for both chat-triggered and button-triggered deploys.
-   **Document Understanding — Discovery-Based Provisioning**: Manages DU project provisioning by discovering existing projects via API, as direct project creation is not supported.
-   **Integration Status Bar**: Displays live UiPath connection status, robot count, pending tasks, and latency.
-   **File Upload Content Extraction**: Server-side extraction from various document types (DOCX, PDF, XLSX, TXT, CSV) for AI context.
-   **Image/Screenshot Vision**: Processes image files (PNG, JPEG, WebP, GIF) via Claude's vision API for text extraction and process analysis.
-   **Bulk Process Map Creation**: `POST /api/ideas/:ideaId/process-map/bulk` endpoint for creating all nodes and edges in a single request.
-   **Admin & Review Panels**: Dedicated interfaces for CoE review and administrative tasks.
-   **Role-Based Access**: Authorization enforced based on user ownership and roles for process maps and documents.
-   **Multi-Orchestrator Connection Management**: Supports storing and managing multiple UiPath Orchestrator connection profiles.
-   **JSON Sanitization**: Robust parsing of AI-generated JSON with error recovery.

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