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
- **UI/UX**: Features a responsive sidebar, top navigation, and a resizable three-panel workspace displaying stage progress, a live React Flow process map, and the AI chat interface.
- **UiPath Agent Awareness**: Supports the full automation pipeline, evaluating automation types to inform process maps, PDDs, SDDs, XAML generation, and deployment.
- **Process Map Engine**: Enables custom node types, DAG-based layouts, confidence scoring, inline editing, and an approval workflow.
- **Automated Stage Transitions**: An engine automatically transitions ideas across 10 pipeline stages based on predefined criteria, with audit logging and frontend auto-chaining for document generation and approvals.
- **Document Generation**: Automates the creation of version-controlled Process Design Documents (PDD) and Solution Design Documents (SDD) post-approvals, including visual process map images, using LLM-based intent classification.
- **AI-Enriched UiPath Package Generation & Deployment**: Generates near-production-ready UiPath packages with AI enrichment, adhering to UiPath standards, and supports conversational deployment to UiPath Orchestrator with live status streaming.
- **Pre-Package Quality Gate**: A mandatory validation gate runs before NuGet package finalization and Orchestrator upload.
- **Centralized UiPath Pipeline**: All UiPath generation entry points delegate to a single canonical orchestration function (`generateUiPathPackage()`).
- **Generation Modes**: Supports `baseline_openable` (default: skips AI enrichment, flat scaffold) and `full_implementation` (AI enrichment, REFramework).
- **Business Context Mapping**: Extracts per-workflow business context from SDD content.
- **Business-Context-Aware Handoff Stubs**: Annotates handoff stubs with business descriptions.
- **Unified Metadata Freshness Architecture**: Three snapshot files provide a single source of truth for generation metadata, service endpoints, and activity catalogs.
- **Activity Catalog System**: A versioned activity catalog serves as the single source of truth for packages and activities, enriched with CLR namespaces, canonical identity for duplicate classNames, deprecation/modern-alternative tagging, composition rules, property conflicts, and XAML usage examples. Enrichment provenance is tracked as `authoritative` (DLL metadata) or `curated` (official docs). Supports `feedStatus: "delisted"` for packages removed from the official feed, with `generationApproved` flags controlling prompt inclusion.
- **Prompt-Guidance Filter Layer**: `server/catalog/prompt-guidance-filter.ts` provides policy-gated, budget-constrained package guidance for SDD and UiPath generation prompts, ensuring only verified, non-delisted, emission-approved packages are referenced. Includes post-generation diagnostics to detect unverified package hallucinations in generated SDD content.
- **Catalog Staleness & Delisting Detection**: The metadata refresher detects delisted packages (0 versions/404 on feed) and marks them with `feedStatus: "delisted"` + `delistedAt` timestamps. Delisted packages are preserved for diagnostics but excluded from generation guidance. Previously delisted packages require manual re-approval to be reintroduced.
- **Catalog Enrichment Pipeline**: `server/catalog/catalog-enrichment.ts` applies quality enrichment to the catalog from NuGet package metadata, with provenance tracking in `catalog/catalog-enrichment-report.json`.
- **Template-Driven XAML Generation**: Provides pre-defined XAML templates with typed placeholders for LLM-based generation.
- **Hierarchical XAML Generation Architecture**: A three-pass tree-based pipeline assembles correctly-nested XAML.
- **Canonical XAML Normalization Boundary**: Defines all bracket-wrapping, literal-vs-expression classification, bare-word handling, and package/prefix/namespace mapping in a single canonical source.
- **Unified Declaration Registry**: A single `DeclarationRegistry` class is the source of truth for all variable and argument declarations.
- **Canonical Type Inference**: A single shared `inferTypeFromPrefix()` function maps variable naming convention prefixes to UiPath XAML types.
- **DHG Tier Classification**: Classifies workflow tiers for the Developer Handoff Guide.
- **Undeclared Variable Auto-Repair**: Auto-declares variables with recognized naming prefixes.
- **Canonical 7-Stage Pipeline**: The UiPath generation pipeline follows a canonical model: Spec Generation → XAML Emission → Compliance Normalization → Validation → Emission Gate → Final Normalization → Packaging + DHG.
- **Emission Contract Hardening**: Prevents string values from entering VB expression context for critical required properties.
- **Infrastructure Workflow Dedup**: Canonicalizes workflow names to prevent duplicate workflows.
- **Authoritative Namespace Injection**: A single authoritative pass injects missing namespace declarations after all XAML files are generated.
- **Studio Resolution Smoke Test**: Verifies every activity tag maps to declared xmlns, AssemblyReference, NamespacesForImplementation import, and project.json dependency.
- **Activity-Level Package Resolution**: Deterministically maps activity names to specific packages.
- **InArgument Type Arguments**: Automatically receives `x:TypeArguments` attributes for non-string types.
- **Safe VB Expression Normalization**: Detects and emits complex expressions as-is to prevent corruption.
- **Pre-Emission Health Invariant**: Throws blocking error when non-empty builds have zero activity coverage.
- **High-Risk Expression Decomposition**: Decomposes complex nested expressions into sequential Assign activities.
- **Final Artifact Truth Gate**: A single `FinalArtifactValidation` pass produces a `FinalQualityReport` as the sole authority for package status. Includes workflow graph integrity validation via `server/xaml/workflow-graph-validator.ts`. Produces `packageCompletenessViolations` artifact with per-violation detail (file, workflow, activityType, propertyName, violationType, severity, packageFatal, handoffGuidanceAvailable, remediationHint) and summary counts. Drives the `packageViable` flag on `PipelineResult` — when package-fatal violations exist, the package is marked non-viable while DHG remains available.
- **Executable-Path Validator**: A read-only validation pass (`server/xaml/executable-path-validator.ts`) scans final post-repair XAML for six defect classes (placeholders, TODO markers, leaked JSON expressions, blank required properties, malformed VB expressions, sentinel values) in runtime-critical property slots. Uses ACTIVITY_REGISTRY and high-risk overrides for severity classification. Emits `hasExecutablePathContamination` signal for downstream status derivation.
- **Workflow Graph Validator**: A dedicated read-only graph-based validator (`server/xaml/workflow-graph-validator.ts`) that operates on final archive entries to detect orphaned workflows, broken InvokeWorkflowFile references, REFramework wiring defects (via structural state-machine analysis), decomposed-but-unwired workflows, ambiguous references, and graph discontinuities. Emits `workflowGraphDefects[]`, `hasWorkflowGraphIntegrityIssues`, and `workflowGraphSummary` with exclusions for non-executable files. Critical workflows (Main, Process, ProcessTransaction, etc.) are promoted to `execution_blocking` severity when orphaned/unwired. Feeds into `hasDegradation` composite in `FinalQualityReport`.
- **Pipeline Health & Convergence Metrics**: Tracks per-run convergence metrics and determines readiness.
- **Transitive Dependency Validation**: Validates that XAML-referenced activities have corresponding packages declared.
- **Invoke Binding Canonicalizer**: A dedicated canonicalization pass (`server/xaml/invoke-binding-canonicalizer.ts`) that runs before contract-integrity validation. Converts all invoke activity argument bindings to the single canonical `<InvokeWorkflowFile.Arguments>` child-element form with typed `InArgument`/`OutArgument`/`InOutArgument` elements. Removes pseudo-properties from invoke activities, deduplicates equivalent dual-serialization forms, normalizes JSON expression leaks, and emits structured `invokeSerializationFixes[]` and `residualExpressionSerializationDefects[]` diagnostics in `FinalQualityReport`. Unresolved defects feed into degradation derivation.
- **Required Property Enforcement**: `server/required-property-enforcer.ts` provides the authoritative pre-compliance enforcement layer that (1) validates required activity properties in both attribute and child-element form, (2) rejects generic type defaults unless contract-documented, (3) eliminates PLACEHOLDER/TODO/STUB/HANDOFF sentinel injection by removing sentinel attributes entirely, (4) injects contract-valid fallback values for missing required properties, (5) deterministically lowers structured expressions per-property then globally, (6) emits structured diagnostics (`requiredPropertyBindings[]`, `unresolvedRequiredPropertyDefects[]`, `expressionLoweringFixes[]`, `expressionLoweringFailures[]`). Diagnostics computed on original content before mutation. Pre-compliance guard uses broad sentinel scan when catalog unavailable and drives `structurally_invalid` status in final quality reports.
- **Critical Activity Family Lowering**: `server/critical-activity-lowering.ts` implements pre-emission contract synthesis for execution-critical activity families (Gmail/SMTP/Outlook send, Action Center create/wait, RetryScope, InvokeWorkflow, Data Service CRUD). Derives required-property contracts from `server/catalog/activity-definitions.ts` registry (single authoritative source). Detects mixed-family drift, pseudo-activity narratives, framework incompatibility, and package availability. `runPreEmissionLoweringGate()` validates structured WorkflowSpec nodes before XAML assembly in `package-assembler.ts`. XAML-level lowering (`runXamlLevelCriticalActivityLowering()`) provides post-emission safety net in `FinalArtifactValidation`. Emits `criticalActivityLoweringDiagnostics` in `FinalQualityReport`.
- **Regression Test Suite**: Server-side vitest tests cover 40+ regression scenarios.
- **Automation Pattern Classification**: Classifies automation patterns to determine appropriate REFramework usage.
- **Role-Based Deterministic Scaffold**: Generates structured Main.xaml + role-based sub-workflows when AI enrichment fails.
- **Demand-Driven Dependencies**: Dynamically determines and includes necessary UiPath package dependencies.
- **VB.NET Expression Linter**: Scans VB.NET expressions for syntax errors and provides auto-correction.
- **Type Compatibility Validator**: Cross-references variable types against catalog property clrTypes with auto-repair.
- **Selector Quality Scorer**: Extracts UI context from SDD and scores generated selectors.
- **Workflow Analyzer Compliance Engine**: Static analysis for 11+ Workflow Analyzer rules with auto-correction.
- **UiPath Naming Convention Enforcement**: Enforces standardized naming conventions.
- **Three-Tier Developer Handoff Guide (DHG)**: An AI-first structured guide with readiness score, compliance report, and artifact configuration.
- **UiPath Integration Layer**: Manages UiPath's multi-resource token architecture, API client, and SSE deploy streaming.
- **Integration Service Connector Discovery**: Queries UiPath Integration Service API to discover available connectors.
- **Maestro Process Orchestration**: Generates BPMN-compatible Maestro process definitions.
- **Unified Probe Architecture**: Single source of truth for platform service availability.
- **Automation Ops Integration**: Discovers governance policies from UiPath Automation Ops.
- **Consolidated Streaming Progress Indicator**: Displays real-time progress during AI chat, document generation, and deployment.
- **Document Approval**: Supports approval of PDD/SDD.
- **Document Understanding — Discovery-Based Provisioning**: Manages DU project provisioning by discovering existing projects.
- **Integration Status Bar**: Displays live UiPath connection status.
- **File Upload Content Extraction**: Server-side extraction from various document types for AI context.
- **Image/Screenshot Vision**: Processes image files via Claude's vision API.
- **Admin & Review Panels**: Dedicated interfaces for CoE review and administrative tasks.
- **Role-Based Access**: Authorization enforced based on user ownership and roles.
- **Multi-Orchestrator Connection Management**: Supports managing multiple UiPath Orchestrator connection profiles.
- **Automation Hub & Store Integration**: Connects to UiPath Automation Hub to import ideas and publish automations.
- **Modular Backend Architecture**: Monolithic backend files decomposed into focused sub-modules.
- **JSON Sanitization**: Robust parsing of AI-generated JSON with error recovery.
- **Shared Utilities**: Consolidated server and client utilities.
- **Deploy Parallelization**: Groups independent UiPath API calls into parallel batches.
- **Spec Decomposer Parallelism & Retry Hardening**: Concurrent workflow details generation with exponential backoff.
- **Proactive Registry-Based Dependency Resolution**: Activity registry fallback resolves packages proactively.
- **Non-Catalog Property Stripping Threshold**: Flags activities with excessive unknown properties.
- **High Confidence Mode (Meta-Validation)**: Optional post-generation review layer with deterministic confidence scoring.
- **Post-Implementation Verification Bundle**: A downloadable ZIP containing verification artifacts (manifest, nupkg, DHG, quality gate results, meta-validation results, pipeline diagnostics, outcome report, final quality report, spec snapshot) for reviewer inspection after pipeline tasks. Button appears when a UiPath package exists. Endpoint: `POST /api/verification-bundle/:ideaId`. Agent skill at `.agents/skills/post-implementation-verification/SKILL.md`.

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