# CannonBall

## Overview
CannonBall is a full-stack web application designed for comprehensive automation pipeline management, guiding users from idea capture to the deployment of AI-generated automation packages. It aims to streamline development and deployment by focusing on AI-first interactions, a role-based shell, Kanban boards, a three-panel workspace with live AI chat, and a visual process map engine. The platform specializes in generating deployable UiPath automation solutions, enhancing efficiency in automation development across various industries.

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
- **Process Map Engine**: Supports custom node types with DAG-based layout, confidence scoring, inline editing, and an approval workflow for AS-IS and TO-BE maps. Includes features for map cleanup and auto-repair.
- **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with audit logging and frontend auto-chaining for document generation and approvals.
- **Document Generation**: Automates version-controlled Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals, including visual process map images, using LLM-based intent classification.
- **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI enrichment, adhering to UiPath standards (Package Explorer, REFramework), and supporting conversational deployment to UiPath Orchestrator with live status streaming.
- **Pre-Package Quality Gate**: A mandatory validation gate (`server/uipath-quality-gate.ts`) runs before NuGet package finalization and Orchestrator upload. It uses a shared activity registry to validate technical completeness and accuracy, with auto-remediation attempts and fallback stub generation for errors.
- **Centralized UiPath Pipeline**: All UiPath generation entry points delegate to a single canonical orchestration function (`generateUiPathPackage()`) in `server/uipath-pipeline.ts`, providing consistent package generation and pipeline-level caching.
- **Generation Modes**: Supports `baseline_openable` (skips AI enrichment, forces flat scaffold, demotes quality gate errors) and `full_implementation` (default: AI enrichment, REFramework, blocking quality gate enforcement).
- **Activity Catalog System**: A structured activity catalog (`catalog/activity-catalog.json`) provides validated, schema-rich metadata including XAML syntax rules (attribute vs child-element), argument wrappers, CLR types, and process type scoping. The catalog service (`server/catalog/catalog-service.ts`) loads at startup, injects activity constraints into LLM prompts, runs post-generation XAML validation with auto-correction, and provides catalog-driven dependency version lookup alongside the existing `confirmedVersionMap`.
- **Template-Driven XAML Generation**: The template builder (`server/catalog/xaml-template-builder.ts`) provides pre-defined XAML templates with typed placeholders for all activities, scoped by processType. The LLM prompt is structured into 4 sections (Role + Rules, Activity Templates, Variable Rules, Workflow Spec) so the LLM fills templates rather than inventing syntax. Enum violations (e.g. `Level="Information"` instead of `"Info"`) are flagged as generation failures without auto-correction. A `templateComplianceScore` (0.0–1.0) is calculated per generation using scoped subtree analysis and surfaced in the UI as a color-coded badge.
- **Hierarchical XAML Generation Architecture**: A three-pass tree-based pipeline (`server/workflow-spec-types.ts`, `server/workflow-tree-assembler.ts`) replaces flat activity list generation. Pass 1: LLM produces a typed WorkflowSpec JSON tree (validated against Zod schemas with one retry on failure). Pass 2: Deterministic template resolver maps ActivityNodes to catalog templates. Pass 3: Recursive tree walker (`assembleNode`) assembles correctly-nested XAML with activities inside TryCatch.Try, If.Then/Else, While.Body, ForEach.Body, and RetryScope.Body. Supported node kinds: activity, sequence, tryCatch, if, while, forEach, retryScope. Falls back to legacy flat generation if tree enrichment fails. GetAsset uses AssetValue, GetCredential has proper OutArgument structure, SendSmtpMailMessage includes Body property, Assign activities infer x:TypeArguments from variable declarations, and ui:InvokeCode is blocked with Newtonsoft.Json.Linq guidance.
- **Regression Test Suite**: Server-side vitest tests cover 34+ regression scenarios for stub validity, activity policy, XAML validation, quality gate, dependency management, and hierarchical tree assembly.
- **Automation Pattern Classification**: Classifies automation as simple-linear, API/data-driven, UI, transactional/queue-based, or hybrid to determine appropriate REFramework usage and scaffold generation.
- **Demand-Driven Dependencies**: Dynamically determines and includes necessary UiPath package dependencies based on emitted activities.
- **Workflow Analyzer Compliance Engine**: Static analysis for 11+ Workflow Analyzer rules with auto-correction, reporting, and dynamic governance policy integration.
- **UiPath Naming Convention Enforcement**: Standardized naming conventions for variables and arguments enforced during XAML generation.
- **Argument Validation**: Automated argument validation at workflow entry points.
- **Three-Tier Developer Handoff Guide (DHG)**: AI-first structured guide (Tier 1: AI Completed, Tier 2: Smart Defaults, Tier 3: Human Required) including readiness score, compliance report, and artifact configuration.
- **UiPath Integration Layer**: Manages UiPath's multi-resource token architecture, typed Orchestrator API client, robust artifact provisioning, and SSE deploy streaming.
- **Integration Service Connector Discovery**: Queries UiPath Integration Service API to discover available connectors and active connections, injecting them into SDD generation prompts and chat system prompts.
- **Maestro Process Orchestration**: Generates BPMN-compatible Maestro process definitions (service tasks, user tasks, gateways, events) and deploys via the Maestro API.
- **Unified Probe Architecture**: Single source of truth for platform service availability, discovering Automation Ops governance policies, robot landscape, and existing Studio processes.
- **Automation Ops Integration**: Discovers governance policies from UiPath Automation Ops and syncs them into the Workflow Analyzer for compliance checking and context injection.
- **Attended Robot & Studio Discovery**: Probes UiPath for attended/Assistant robot sessions and existing Studio processes, using this context during SDD generation and chat.
- **Consolidated Streaming Progress Indicator**: A unified component for displaying real-time progress during AI chat, document generation, and deployment, with live document rendering and approval.
- **Document Approval**: Supports approval of PDD/SDD via dedicated buttons, chat phrases, or auto-chain detection.
- **Document Understanding — Discovery-Based Provisioning**: Manages DU project provisioning by discovering existing projects via API.
- **Integration Status Bar**: Displays live UiPath connection status, robot count, pending tasks, and latency.
- **File Upload Content Extraction**: Server-side extraction from various document types (DOCX, PDF, XLSX, TXT, CSV) for AI context.
- **Image/Screenshot Vision**: Processes image files (PNG, JPEG, WebP, GIF) via Claude's vision API for text extraction and process analysis.
- **Admin & Review Panels**: Dedicated interfaces for CoE review and administrative tasks.
- **Role-Based Access**: Authorization enforced based on user ownership and roles for process maps and documents.
- **Multi-Orchestrator Connection Management**: Supports storing and managing multiple UiPath Orchestrator connection profiles.
- **Automation Hub & Store Integration**: Connects to UiPath Automation Hub to import ideas and automatically publish completed automations to the Automation Store.
- **Modular Backend Architecture**: Monolithic backend files decomposed into focused sub-modules:
  - `server/xaml-generator.ts` → `server/xaml/xaml-compliance.ts` (XAML compliance, bracket wrapping, variable inference) + `server/xaml/gap-analyzer.ts` (validation, stub generation, DHG summary)
  - `server/uipath-integration.ts` → `server/package-assembler.ts` (NuGet package building, ZIP creation, REFramework scaffolding, config XLSX) + `server/uipath-shared.ts` (shared types: UiPathConfig, QualityGateError, package alias map)
  - `server/uipath-deploy.ts` → `server/orchestrator/manifest-manager.ts` (artifact type definitions, SDD parsing, LLM extraction) + `server/orchestrator/artifact-provisioner.ts` (Orchestrator API provisioning, deployment orchestration)
  - Original files remain thin re-export facades preserving all import paths.
- **JSON Sanitization**: Robust parsing of AI-generated JSON with error recovery.
- **Shared Utilities**: Consolidated server and client utilities for common functions and shared types.
- **Deploy Parallelization**: Groups independent UiPath API calls into parallel batches to reduce deployment time.
- **High Confidence Mode (Meta-Validation)**: Optional post-generation review layer in `server/meta-validation/`. Deterministic confidence scoring (10 weighted signals, normalized 0–1) determines whether to engage targeted Haiku-based LLM review for 6 XAML error categories (ENUM_VIOLATIONS, NESTED_ARGUMENTS, LITERAL_EXPRESSIONS, MISSING_PROPERTIES, UNDECLARED_VARIABLES, FLAT_STRUCTURE). High/medium confidence corrections are applied programmatically; FLAT_STRUCTURE corrections are never auto-applied (logged as warnings); low-confidence corrections are skipped. User toggle bar (Auto/Always/Off) in chat panel with 9-state dynamic status chip. Admin Quality dashboard with cost tracking, engagement rates, and compliance trends. SSE events stream real-time meta-validation progress to the frontend.

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