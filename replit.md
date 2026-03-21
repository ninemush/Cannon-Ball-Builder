# CannonBall

## Overview
CannonBall is a full-stack web application for comprehensive automation pipeline management, guiding users from idea capture to the deployment of AI-generated automation packages. It aims to streamline development and deployment through AI-first interactions, a role-based shell, Kanban boards, a three-panel workspace with live AI chat, and a visual process map engine. The platform specializes in generating deployable UiPath automation solutions, enhancing efficiency in automation development across various industries.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts. Reduce redundant code: Always consolidate duplicated logic into single canonical functions. When implementing shared behavior, create one source of truth and have all callers use it. Update all references across the app when consolidating — do not leave orphaned implementations that could cause discrepancies.

## System Architecture
The application uses a modern web stack for scalability and an intuitive user experience.

**Frontend**:
- Built with React (Vite), Tailwind CSS, and shadcn/ui.
- Utilizes React Flow for interactive process mapping and wouter for client-side routing.
- Features a responsive UI, dark mode, and a distinct color palette.

**Backend**:
- Express.js server handles API requests and session-based authentication.

**Database**:
- PostgreSQL integrated with Drizzle ORM.

**AI Integration**:
- An abstraction layer supports provider-agnostic AI calls from Anthropic Claude, OpenAI, and Google Gemini via Replit AI Integrations, with configurable model selection and normalized stop reasons for consistent auto-continuation logic.

**Authentication**:
- Session-based authentication supports demo users and role-switching.

**Key Features and Design Choices**:
- **UI/UX**: Responsive sidebar, top navigation, and a resizable three-panel workspace displaying stage progress, a live React Flow process map, and the AI chat.
- **UiPath Agent Awareness**: Supports the full pipeline for automation type evaluation (RPA, Agent, Hybrid), influencing process maps, PDDs, SDDs, XAML generation, and deployment.
- **Process Map Engine**: Supports custom node types with DAG-based layout, confidence scoring, inline editing, and an approval workflow for AS-IS and TO-BE maps.
- **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with audit logging and frontend auto-chaining for document generation and approvals.
- **Document Generation**: Automates version-controlled Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals, including visual process map images, using LLM-based intent classification.
- **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI enrichment, adhering to UiPath standards, and supporting conversational deployment to UiPath Orchestrator with live status streaming.
- **Pre-Package Quality Gate**: A mandatory validation gate (`server/uipath-quality-gate.ts`) runs before NuGet package finalization and Orchestrator upload.
- **Centralized UiPath Pipeline**: All UiPath generation entry points delegate to a single canonical orchestration function (`generateUiPathPackage()`) in `server/uipath-pipeline.ts`, providing consistent package generation and pipeline-level caching.
- **Generation Modes**: Supports `baseline_openable` (skips AI enrichment, forces flat scaffold, demotes quality gate errors) and `full_implementation` (default: AI enrichment, REFramework, blocking quality gate enforcement).
- **Unified Metadata Freshness Architecture**: Three snapshot files under `catalog/` provide the single source of truth for generation metadata, service endpoints, and activity catalogs. A centralized `MetadataService` (`server/catalog/metadata-service.ts`) loads and exposes this data, serving as the single authoritative source for all UiPath endpoint URLs, scopes, confidence levels, and reachability status across 17 service types.
- **Activity Catalog System**: A versioned activity catalog (`catalog/activity-catalog.json`, v1.0.0) serves as the single source of truth for activities, properties, packages, and enum constraints.
- **Template-Driven XAML Generation**: The template builder (`server/catalog/xaml-template-builder.ts`) provides pre-defined XAML templates with typed placeholders, structured for LLM-based generation.
- **Hierarchical XAML Generation Architecture**: A three-pass tree-based pipeline (`server/workflow-spec-types.ts`, `server/workflow-tree-assembler.ts`) replaces flat activity list generation, assembling correctly-nested XAML.
- **Regression Test Suite**: Server-side vitest tests cover 34+ regression scenarios for stub validity, activity policy, XAML validation, quality gate, dependency management, and hierarchical tree assembly.
- **Automation Pattern Classification**: Classifies automation (simple-linear, API/data-driven, UI, transactional/queue-based, hybrid) to determine appropriate REFramework usage and scaffold generation.
- **Demand-Driven Dependencies**: Dynamically determines and includes necessary UiPath package dependencies based on emitted activities.
- **Workflow Analyzer Compliance Engine**: Static analysis for 11+ Workflow Analyzer rules with auto-correction, reporting, and dynamic governance policy integration.
- **UiPath Naming Convention Enforcement**: Standardized naming conventions for variables and arguments enforced during XAML generation.
- **Argument Validation**: Automated argument validation at workflow entry points.
- **Three-Tier Developer Handoff Guide (DHG)**: AI-first structured guide (Tier 1: AI Completed, Tier 2: Smart Defaults, Tier 3: Human Required) including readiness score, compliance report, and artifact configuration.
- **UiPath Integration Layer**: Manages UiPath's multi-resource token architecture, typed Orchestrator API client, robust artifact provisioning, and SSE deploy streaming.
- **Integration Service Connector Discovery**: Queries UiPath Integration Service API to discover available connectors and active connections.
- **Maestro Process Orchestration**: Generates BPMN-compatible Maestro process definitions and deploys via the Maestro API.
- **Unified Probe Architecture**: Single source of truth for platform service availability with structured per-service status (available/limited/unavailable/unknown), confidence levels (official/inferred/deprecated), evidence tracking, and reachability. Discovers Automation Ops governance policies, robot landscape, and existing Studio processes.
- **Automation Ops Integration**: Discovers governance policies from UiPath Automation Ops and syncs them into the Workflow Analyzer.
- **Attended Robot & Studio Discovery**: Probes UiPath for attended/Assistant robot sessions and existing Studio processes.
- **Consolidated Streaming Progress Indicator**: A unified component for displaying real-time progress during AI chat, document generation, and deployment.
- **Document Approval**: Supports approval of PDD/SDD via dedicated buttons, chat phrases, or auto-chain detection.
- **Document Understanding — Discovery-Based Provisioning**: Manages DU project provisioning by discovering existing projects via API.
- **Integration Status Bar**: Displays live UiPath connection status, robot count, pending tasks, and latency.
- **File Upload Content Extraction**: Server-side extraction from various document types for AI context.
- **Image/Screenshot Vision**: Processes image files via Claude's vision API for text extraction and process analysis.
- **Admin & Review Panels**: Dedicated interfaces for CoE review and administrative tasks.
- **Role-Based Access**: Authorization enforced based on user ownership and roles for process maps and documents.
- **Multi-Orchestrator Connection Management**: Supports storing and managing multiple UiPath Orchestrator connection profiles.
- **Automation Hub & Store Integration**: Connects to UiPath Automation Hub to import ideas and automatically publish completed automations to the Automation Store.
- **Modular Backend Architecture**: Monolithic backend files decomposed into focused sub-modules for XAML generation, UiPath integration, and deployment.
- **JSON Sanitization**: Robust parsing of AI-generated JSON with error recovery.
- **Shared Utilities**: Consolidated server and client utilities for common functions and shared types.
- **Deploy Parallelization**: Groups independent UiPath API calls into parallel batches to reduce deployment time.
- **High Confidence Mode (Meta-Validation)**: Optional post-generation review layer in `server/meta-validation/` with deterministic confidence scoring and targeted LLM review for XAML error categories.

## External Dependencies
- **AI Services**: Anthropic Claude, OpenAI, Google Gemini (via Replit AI Integrations)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Frontend Libraries**: React Flow, @dagrejs/dagre, shadcn/ui, wouter
- **Backend Framework**: Express.js
- **Session Management**: `express-session`, `connect-pg-simple`
- **File Parsing**: `mammoth`, `pdf-parse`, `xlsx`, `multer`
- **Image Processing**: `sharp`
- **UiPath Orchestrator**: For deploying automation packages and API integrations.