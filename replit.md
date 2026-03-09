# CannonBall

## Overview
CannonBall is a full-stack web application for comprehensive automation pipeline management. It guides users from idea capture to deployment of AI-generated automation packages, aiming to streamline development and deployment. Key features include an AI-first approach, a role-based shell, a Kanban board, a three-panel workspace with live AI chat, and a visual process map engine. The platform focuses on automating interactions and generating deployable UiPath automation solutions.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts.

## System Architecture
The application uses a modern web stack for scalability and an intuitive user experience.

-   **Frontend**: React with Vite, Tailwind CSS, and shadcn/ui. It uses React Flow for interactive process mapping and wouter for client-side routing, featuring a responsive UI, dark mode, and a distinct color palette.
-   **Backend**: Express.js server handling API requests and session-based authentication.
-   **Database**: PostgreSQL with Drizzle ORM.
-   **AI Integration**: Anthropic Claude via Replit AI Integrations for streaming SSE chat responses.
-   **Authentication**: Session-based authentication supporting demo users and role-switching.

**Key Features and Design Choices:**

-   **UI/UX**: Responsive sidebar, top navigation, and a resizable three-panel workspace displaying stage progress, a live React Flow process map, and the AI chat.
-   **Process Map Engine**: Supports custom node types (Start/End, Task, Decision) with DAG-based layout, confidence scoring, inline editing, context menus, and an approval workflow. Dynamic updates from AI's `[STEP: 1.0 Name ...]` tags ensure deterministic step-number-based edge resolution.
-   **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with comprehensive audit logging.
-   **Document Generation**: Automates generation of version-controlled Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals. SDD generation is conversational and auto-triggered on PDD approval. Exported documents include visual process map images (PNG) rendered server-side.
-   **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI-powered enrichment, including multi-activity sequences, system-specific selectors, context-aware variable names, and real property values from SDD artifacts. It adheres to UiPath Package Explorer compliance, includes traceability comments, supports REFramework, and enhances `Config.xlsx` and `InitAllSettings.xaml`. All 14 artifact types are generated at production quality (queues, assets, machines, triggers, storage buckets, environments, robot accounts, Action Center, Document Understanding, test cases, test sets, requirements, test data queues). XAML activities include standard properties and production-grade selectors. An Enhanced Developer Handoff Guide (DHG) covers all 14 artifact types with completion instructions and effort estimates. Conversational deployment to UiPath Orchestrator with live status streaming is supported.
-   **UiPath Integration Layer**: Manages UiPath's multi-resource token architecture (5 independent cached tokens for Orchestrator, Test Manager, Document Understanding, Platform Management, Data Service) with proactive refresh and 401 auto-retry. Includes a typed Orchestrator API client with exponential backoff. Supports full Test Manager lifecycle, idempotent create-or-update for artifacts, and robust Action Center catalog creation attempts. Chat route ensures service probes run regardless of pipeline stage and strips superseded SDD/PDD messages from chat history.
-   **Integration Status Bar**: Displays live UiPath connection status, robot count, pending Action Center tasks, latency, and last provisioning decisions.
-   **Enhanced Diagnostics & Live Operations UI**: Settings tab with diagnostics checklist and a live operations panel.
-   **File Upload Content Extraction**: Server-side extraction from DOCX, PDF, XLSX, TXT, and CSV for AI chat context.
-   **Admin & Review Panels**: For CoE review and Admin tasks (user management, audit logs, system configuration).
-   **Role-Based Access**: Authorization enforced on process map and document routes based on user ownership and roles.
-   **Multi-Orchestrator Connection Management**: Supports storing and managing multiple UiPath Orchestrator connection profiles, with auto-migration of existing credentials.
-   **JSON Sanitization**: AI-generated JSON is sanitized and errors are recovered to ensure robust parsing.

## External Dependencies
-   **AI Service**: Anthropic Claude (via Replit AI Integrations)
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **Frontend Libraries**: React Flow, @dagrejs/dagre, shadcn/ui, wouter
-   **Backend Framework**: Express.js
-   **Session Management**: `express-session`, `connect-pg-simple`
-   **File Parsing**: `mammoth`, `pdf-parse`, `xlsx`, `multer`
-   **Image Processing**: `sharp` (for SVG-to-PNG conversion)
-   **UiPath Orchestrator**: For deploying automation packages and API integrations.