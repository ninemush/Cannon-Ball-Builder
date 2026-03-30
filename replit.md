# CannonBall

## Overview
CannonBall is a full-stack web application designed to manage the entire automation pipeline, from ideation to deployment of AI-generated automation packages. It aims to accelerate automation development through AI-driven interactions, a role-based shell, Kanban boards, a three-panel workspace with live AI chat, and a visual process map engine. The platform specifically focuses on generating deployable UiPath automation solutions to enhance efficiency in various industries.

## User Preferences
The agent should prioritize an AI-first interaction style, proactively engaging users and providing guidance throughout the automation pipeline. It should facilitate an iterative development process, allowing for dynamic adjustments such as moving ideas to earlier stages if requirements change. The agent should ask for confirmation or approval before making significant changes, especially regarding document generation, process map approvals, and deployment actions. Communication should be clear and concise, with real-time feedback on progress, such as stage transitions and deployment statuses. The agent must adhere to structured outputs for documents and deployment artifacts. Reduce redundant code: Always consolidate duplicated logic into single canonical functions. When implementing shared behavior, create one source of truth and have all callers use it. Update all references across the app when consolidating — do not leave orphaned implementations that could cause discrepancies.

## System Architecture
The application is built on a modern web stack to ensure scalability and a user-friendly experience.

**Frontend**:
- Uses React (Vite) with Tailwind CSS and shadcn/ui for component styling.
- Integrates React Flow for interactive process mapping and wouter for client-side routing.
- Features a responsive design, dark mode, and a distinctive color palette.

**Backend**:
- Powered by Express.js, handling API requests and session-based authentication.

**Database**:
- PostgreSQL is used for data storage, managed with Drizzle ORM.

**AI Integration**:
- An abstraction layer provides provider-agnostic AI capabilities, supporting Anthropic Claude, OpenAI, and Google Gemini through Replit AI Integrations, with configurable model selection and normalized stop reasons for consistent auto-continuation logic.

**Authentication**:
- Session-based authentication is implemented, supporting demo users and role-switching.

**Key Features and Design Choices**:
- **UI/UX**: Features a responsive sidebar, top navigation, and a resizable three-panel workspace that displays stage progress, a live React Flow process map, and the AI chat interface.
- **UiPath Agent Awareness**: Supports the full automation pipeline, evaluating automation types (RPA, Agent, Hybrid) to inform process maps, PDDs, SDDs, XAML generation, and deployment.
- **Process Map Engine**: Enables custom node types, DAG-based layouts, confidence scoring, inline editing, and an approval workflow for AS-IS and TO-BE maps.
- **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with audit logging and frontend auto-chaining for document generation and approvals.
- **Document Generation**: Automates the creation of version-controlled Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals, including visual process map images, using LLM-based intent classification.
- **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI enrichment, adhering to UiPath standards, and supports conversational deployment to UiPath Orchestrator with live status streaming.
- **Pre-Package Quality Gate**: A mandatory validation gate runs before NuGet package finalization and Orchestrator upload.
- **Centralized UiPath Pipeline**: All UiPath generation entry points delegate to a single canonical orchestration function (`generateUiPathPackage()`) for consistent package generation and pipeline-level caching.
- **Generation Modes**: Supports `baseline_openable` (skips AI enrichment) and `full_implementation` (default: AI enrichment, REFramework).
- **Unified Metadata Freshness Architecture**: Three snapshot files under `catalog/` provide the single source of truth for generation metadata, service endpoints, and activity catalogs. A centralized `MetadataService` (`server/catalog/metadata-service.ts`) loads and exposes this data.
- **Activity Catalog System**: A versioned activity catalog (`catalog/activity-catalog.json`) serves as the single source of truth for packages and activities, with properties, packages, and enum constraints. An activity definitions registry (`server/catalog/activity-definitions.ts`) provides structured schemas.
- **Template-Driven XAML Generation**: The template builder (`server/catalog/xaml-template-builder.ts`) provides pre-defined XAML templates with typed placeholders for LLM-based generation.
- **Hierarchical XAML Generation Architecture**: A three-pass tree-based pipeline (`server/workflow-spec-types.ts`, `server/workflow-tree-assembler.ts`) assembles correctly-nested XAML. Semantic generation (Assign canonicalization, Excel ActivityAction wrapping, HttpClient canonicalization, expression bracket-wrapping) happens at emission time in the tree assembler — the compliance pass (`server/xaml/xaml-compliance.ts`) is limited to namespace normalization, whitespace canonicalization, prefix resolution, and schema-level fixes. A compliance idempotency check logs warnings when re-running compliance changes output.
- **Regression Test Suite**: Server-side vitest tests cover 34+ regression scenarios.
- **Automation Pattern Classification**: Classifies automation patterns to determine appropriate REFramework usage and scaffold generation.
- **Demand-Driven Dependencies**: Dynamically determines and includes necessary UiPath package dependencies based on emitted activities.
- **VB.NET Expression Linter**: Deterministic linter (`server/xaml/vbnet-expression-linter.ts`) scans VB.NET expressions in generated XAML for syntax errors and provides auto-correction for fixable issues.
- **Type Compatibility Validator**: (`server/xaml/type-compatibility-validator.ts`) Cross-references variable types against catalog property clrTypes after XAML generation, with auto-repair via conversion wrapping.
- **Selector Quality Scorer**: (`server/xaml/selector-quality-scorer.ts`) Extracts UI context from SDD content and scores generated selectors, detecting placeholders and low-quality selectors.
- **Workflow Analyzer Compliance Engine**: Static analysis for 11+ Workflow Analyzer rules with auto-correction and reporting.
- **UiPath Naming Convention Enforcement**: Standardized naming conventions for variables and arguments are enforced during XAML generation.
- **Three-Tier Developer Handoff Guide (DHG)**: An AI-first structured guide (Tier 1: AI Completed, Tier 2: Smart Defaults, Tier 3: Human Required) including readiness score, compliance report, and artifact configuration, enhanced with production deployment sections.
- **UiPath Integration Layer**: Manages UiPath's multi-resource token architecture, typed Orchestrator API client, robust artifact provisioning, and SSE deploy streaming.
- **Integration Service Connector Discovery**: Queries UiPath Integration Service API to discover available connectors and active connections.
- **Maestro Process Orchestration**: Generates BPMN-compatible Maestro process definitions and deploys via the Maestro API.
- **Unified Probe Architecture**: Single source of truth for platform service availability with structured status, confidence levels, and evidence tracking.
- **Automation Ops Integration**: Discovers governance policies from UiPath Automation Ops and syncs them into the Workflow Analyzer.
- **Consolidated Streaming Progress Indicator**: A unified component for displaying real-time progress during AI chat, document generation, and deployment.
- **Document Approval**: Supports approval of PDD/SDD via dedicated buttons, chat phrases, or auto-chain detection.
- **Document Understanding — Discovery-Based Provisioning**: Manages DU project provisioning by discovering existing projects via API.
- **Integration Status Bar**: Displays live UiPath connection status, robot count, pending tasks, and latency.
- **File Upload Content Extraction**: Server-side extraction from various document types for AI context.
- **Image/Screenshot Vision**: Processes image files via Claude's vision API for text extraction and process analysis.
- **Admin & Review Panels**: Dedicated interfaces for CoE review and administrative tasks.
- **Role-Based Access**: Authorization enforced based on user ownership and roles for process maps and documents.
- **Multi-Orchestrator Connection Management**: Supports storing and managing multiple UiPath Orchestrator connection profiles.
- **Automation Hub & Store Integration**: Connects to UiPath Automation Hub to import ideas and publish completed automations to the Automation Store.
- **Modular Backend Architecture**: Monolithic backend files decomposed into focused sub-modules for better organization.
- **JSON Sanitization**: Robust parsing of AI-generated JSON with error recovery.
- **Shared Utilities**: Consolidated server and client utilities for common functions and shared types.
- **Deploy Parallelization**: Groups independent UiPath API calls into parallel batches to reduce deployment time.
- **Spec Decomposer Parallelism & Retry Hardening**: Up to 3 workflow details generate concurrently with exponential backoff (2s→16s + jitter) for 429/rate-limit errors. Aggregate timeout is maintained across parallel workers.
- **Proactive Registry-Based Dependency Resolution**: Activity registry fallback resolves packages proactively when the catalog service misses, reducing dependency crosscheck gaps.
- **Non-Catalog Property Stripping Threshold**: Activities with 3+ unknown properties stripped are flagged as blocking errors (`EXCESSIVE_PROPERTIES_STRIPPED`) indicating generation hallucination.
- **High Confidence Mode (Meta-Validation)**: Optional post-generation review layer with deterministic confidence scoring and targeted LLM review for XAML error categories.

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