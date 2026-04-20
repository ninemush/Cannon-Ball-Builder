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
- **Activity Catalog System**: A versioned activity catalog serves as the single source of truth for packages and activities, enriched with CLR namespaces, canonical identity for duplicate classNames, deprecation/modern-alternative tagging, composition rules, property conflicts, and XAML usage examples. Enrichment provenance is tracked as `authoritative` (DLL metadata) or `curated` (official docs). Supports `feedStatus: "delisted"` for packages removed from the official feed, with `generationApproved` flags controlling prompt inclusion. DLL-extracted metadata (`catalog/dll-metadata/`) provides assembly-verified property definitions for 2,524 activities across 114 packages; the catalog generator (`server/catalog/dll-metadata-importer.ts`) merges DLL data with impact-safe rules: approved activities preserve existing property definitions (adding new DLL props alongside), non-approved activities receive full DLL property replacement, and new activities enter with `emissionApproved: false`. All 50 emission-approved activities with DLL metadata are reconciled to use DLL-sourced property data as single source of truth: correct `required` flags, `clrType` values (including UiPath enum types), `validValues`, `default` values, and `typeArguments`. DLL-only properties are added to enrich coverage. `xamlSyntax` remains `attribute` where Studio supports attribute shorthand (simple scalar types). Catalog-only properties (61) are audited and retained where they are known aliases, target-embedded properties, or framework properties.
- **Prompt-Guidance Filter Layer**: `server/catalog/prompt-guidance-filter.ts` provides policy-gated, budget-constrained package guidance for SDD and UiPath generation prompts, ensuring only verified, non-delisted, emission-approved packages are referenced. Includes post-generation diagnostics to detect unverified package hallucinations in generated SDD content.
- **Catalog Staleness & Delisting Detection**: The metadata refresher detects delisted packages (0 versions/404 on feed) and marks them with `feedStatus: "delisted"` + `delistedAt` timestamps. Delisted packages are preserved for diagnostics but excluded from generation guidance. Previously delisted packages require manual re-approval to be reintroduced.
- **Catalog Enrichment Pipeline**: `server/catalog/catalog-enrichment.ts` applies quality enrichment to the catalog from NuGet package metadata, with provenance tracking in `catalog/catalog-enrichment-report.json`.
- **Deterministic XAML Generator Engine**: `server/xaml/deterministic-generators.ts` provides ~30 per-activity TypeScript generator functions (NClick, NTypeInto, NGetText, NApplicationCard, NSelectItem, NCheckState, LogMessage, Assign, InvokeWorkflowFile, HTTP/Queue/Excel/Mail/DB/PDF activities, control flow) that emit exact XAML strings without LLM involvement. `server/xaml/generator-registry.ts` provides dispatch table, legacy→modern alias map, and `dispatchGenerator()`/`hasGenerator()`/`resolveTemplateName()` exports. Modern Design activities (.NET 6 `uix` namespace) replace legacy Click/TypeInto/GetText equivalents.
- **Template-Driven XAML Generation**: Provides pre-defined XAML templates with typed placeholders for LLM-based generation (legacy fallback path).
- **Hierarchical XAML Generation Architecture**: A three-pass tree-based pipeline assembles correctly-nested XAML. The `assembleActivityNode` function tries the deterministic generator registry first, falling back to `resolveActivityTemplate` for activities not yet covered or requiring complex declaration registry integration.
- **Canonical XAML Normalization Boundary**: Defines all bracket-wrapping, literal-vs-expression classification, bare-word handling, and package/prefix/namespace mapping in a single canonical source.
- **Unified Declaration Registry**: A single `DeclarationRegistry` class is the source of truth for all variable and argument declarations.
- **Canonical Type Inference**: A single shared `inferTypeFromPrefix()` function maps variable naming convention prefixes to UiPath XAML types.
- **DHG Tier Classification**: Classifies workflow tiers for the Developer Handoff Guide.
- **Undeclared Variable Auto-Repair**: Auto-declares variables with recognized naming prefixes. Includes spec-level `reconcileSpecLevelVariables()` (catalog-backed type inference then naming-convention fallback) and XAML-level `extractReferencedVariablesFromXaml` with `<OutArgument>` binding scanning and type-aware `tryInjectVariableDeclaration`.
- **Canonical Pipeline**: The UiPath generation pipeline follows: Spec Generation → XAML Emission → Compliance Normalization → Validation → Pre-Correction CLI Analyze → Iterative LLM Correction (merged internal + CLI defects) → Rebuild → Final CLI Validation (analyze + pack) → Emission Gate → Final Normalization → Packaging + DHG.
- **Sentinel Remediation Sweep**: `sweepResidualSentinels()` in `emission-gate.ts` detects and replaces residual `__BLOCKED_TYPED_PROPERTY__` sentinels with Comment+LogMessage stubs or TODO placeholders after `cleanSentinelExpressions`.
- **False Variable Extraction Prevention**: `extractVariableReferences` strips VB.NET string literals and excludes log-prefix brackets (`[INFO]`, `[WARN]`, `[ERROR]`, etc.) from variable name extraction.
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
- **Pre-Lowering Spec Normalization**: `server/pre-lowering-spec-normalization.ts` runs between spec generation and critical-activity-lowering. Detects duplicate representations of the same logical critical operation (e.g. a narrative TryCatch container + a concrete send step) and collapses them into one canonical representation. Rejects clusters with conflicting non-empty property values. Emits `SpecNormalizationDiagnostics` with per-operation detail and summary counts. Produces `ActivePathAdoptionTraceEntry` per workflow recording pre/post normalization counts and a `loweringSawOnlyNormalizedRepresentation` flag. Debug mode (env `CANNONBALL_DEBUG_NORMALIZATION=true`) fails the run if lowering sees pre-normalized specs. Wired into `package-assembler.ts` before the per-workflow assembly loop. Prompt instructions in `buildDetailPrompt()` (`server/uipath-spec-decomposer.ts`) explicitly prevent the LLM from emitting duplicate representations.
- **Critical Activity Family Lowering**: `server/critical-activity-lowering.ts` implements pre-emission contract synthesis for execution-critical activity families (Gmail/SMTP/Outlook send, Action Center create/wait, RetryScope, InvokeWorkflow, Data Service CRUD). Derives required-property contracts from `server/catalog/activity-definitions.ts` registry (single authoritative source). Detects mixed-family drift, pseudo-activity narratives, framework incompatibility, and package availability. `runPreEmissionLoweringGate()` validates structured WorkflowSpec nodes before XAML assembly in `package-assembler.ts`. XAML-level lowering (`runXamlLevelCriticalActivityLowering()`) provides post-emission safety net in `FinalArtifactValidation`. Emits `criticalActivityLoweringDiagnostics` in `FinalQualityReport`.
- **Mail Family Lock & Narrative Container Elimination**: Cluster-level mail-send model groups related nodes (concrete send + TryCatch/RetryScope wrappers + catch steps) into `MailSendCluster` objects. Each cluster is locked to exactly one mail family (Gmail/SMTP/Outlook) via `lockClusterToFamily()`. Narrative TryCatch text-property representations (e.g. `Try = "GmailSendMessage(...)"`) are detected and rejected before XAML emission — no placeholder injection for rejected clusters. Cross-family drift guardrails (`checkCrossFamilyDriftInXaml`, `checkCrossFamilyDriftInDependencies`) enforce that Gmail-locked clusters never produce SMTP/Outlook activity tags or wrong-family packages. Emits `mailFamilyLockDiagnostics` artifact with per-cluster details. Rejected clusters feed into `packageCompletenessViolations` via `mailFamilyLockToPackageViolations` and `crossFamilyDriftToPackageViolations`. Wired into `final-artifact-validation.ts`, `post-emission-dependency-analyzer.ts`, and `package-assembler.ts`.
- **Regression Test Suite**: Server-side vitest tests cover 40+ regression scenarios.
- **Automation Pattern Classification**: Classifies automation patterns to determine appropriate REFramework usage.
- **Role-Based Deterministic Scaffold**: Generates structured Main.xaml + role-based sub-workflows when AI enrichment fails.
- **Demand-Driven Dependencies**: Dynamically determines and includes necessary UiPath package dependencies.
- **VB.NET Expression Linter**: Scans VB.NET expressions for syntax errors and provides auto-correction. Unfixable expressions (`EXPRESSION_SYNTAX_UNFIXABLE`) are replaced with TODO placeholder strings or Comment+LogMessage stubs (with type-safety guardrail for non-string property contexts).
- **Type Compatibility Validator**: Cross-references variable types against catalog property clrTypes with auto-repair. Includes UiPath enum-string compatibility rules for 11 enum types (NClickType, NMouseButton, LogLevel, ProcessingStatus, ErrorType, PathType, QueueItemPriority, CredentialType, SymmetricAlgorithms, KeyedHashAlgorithms, EOrderByDate) enabling String↔Enum conversions in type checking.
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
- **UiPath CLI Authoritative Validation**: `server/uipath-cli-validator.ts` integrates UiPath CLI (25.10, .NET 8) as an authoritative second-pass validator with platform routing. Detects project type (CrossPlatform/Windows/WindowsLegacy) from `project.json`, maps to required CLI flavor (`UiPath.CLI.Linux`/`UiPath.CLI.Windows`/`UiPath.CLI.Windows.Legacy`), and only runs authoritative CLI validation when the current runner matches the required platform. CLI `analyze` diagnostics are parsed into structured defects and fed into pipeline warnings. CLI `pack` validates build integrity. Reports `cliValidationMode` field (`custom_validated_only`, `cli_validated`, `cli_skipped_incompatible_agent`, `cli_failed`) in `PipelineResult`, `PipelineOutcomeReport`, `FinalQualityReport`, and DHG. Gracefully degrades when CLI/.NET 8 is unavailable.
- **CLI-Aware Iterative Correction Loop**: Pipeline runs a pre-correction `runCliAnalyze()` pass before the iterative LLM corrector. CLI defects are normalized via `normalizeCliDefectsToQgIssues()` from `server/meta-validation/iterative-llm-corrector.ts` into corrector-compatible `QualityGateIssue` objects with `source: "cli"` markers. Known fixable CLI rule IDs (ST-NMG-*, ST-DBP-*, ST-USG-*, ST-SEC-*) are mapped to four CLI-specific check categories (`cli-namespace-error`, `cli-argument-error`, `cli-variable-error`, `cli-expression-error`) registered in `FIXABLE_QG_CHECKS`. CLI-derived issues use deferred verification: accepted without revert if no internal regression is detected, with final `runCliValidation()` as authoritative verifier. Non-fixable CLI defects remain visible in diagnostics only.
- **Emission Triage DLL-Derived Namespace Expansion**: `catalog/run-emission-triage.js` criterion-2 namespace resolution uses both hardcoded compliance entries and DLL-extracted catalog namespace data (`prefix`/`clrNamespace`/`assembly` from `activity-catalog.json`) for emission approval decisions.
- **XAML Structure Reference Prompt Section**: Enrichment prompt includes a compact "SECTION 7: CORRECT XAML STRUCTURE REFERENCE" with Studio baseline envelope pattern, If/Then/Else nesting, InvokeWorkflowFile typed argument binding, and typed ForEach with ActivityAction body structure.
- **Post-Implementation Verification Bundle**: A downloadable ZIP containing verification artifacts (manifest, nupkg, DHG, quality gate results, meta-validation results, pipeline diagnostics, outcome report, final quality report, spec snapshot) for reviewer inspection after pipeline tasks. Button appears when a UiPath package exists. Endpoint: `POST /api/verification-bundle/:ideaId`. Agent skill at `.agents/skills/post-implementation-verification/SKILL.md`.
- **Remote Windows CLI Runner Dispatch (Task #549)**: `server/uipath-cli-remote-dispatch.ts` provides the pipeline-side dispatch contract that lets `uipcli` run on a remote Windows worker for Windows / WindowsLegacy projects (10 enterprise activity packages) that the Linux pipeline runner cannot validate locally. New `CliValidationMode` values (`cli_remote_windows`, `cli_remote_unreachable`, `cli_remote_misconfigured`, `cli_remote_busy_fallback`, `cli_remote_degraded_fallback`, `cli_remote_dispatch_timeout`, `cli_remote_retry_exhausted`, `cli_remote_byte_fidelity_failure`, `cli_remote_invocation_error`) plus `CliRunnerType` (`local_linux | remote_windows | none`) and `CliPackArtifactSource` (`uipcli | fallback_adm_zip | none`) surface end-to-end through `CliValidationResult`, `PipelineOutcomeReport.cliRemoteRunner`, and the DHG Studio Compatibility header. Health-state classification (`healthy / degraded / busy / unreachable / misconfigured`) is cached with a TTL via `RunnerHealthChecker` so dispatch never blocks on a per-job probe. Hash chain (`bundleHash → returnedArtifactHash → persistedArtifactHash`) is persisted on every dispatched run; mismatch forces fallback packaging with reason `cli_remote_byte_fidelity_failure` (no failed remote artifact is ever shipped). Default queue/timeout/retry policy: `maxDispatchWaitMs=60000`, `maxExecutionTimeMs=180000`, `retryCount=1`, `busyBehavior=queue`, `dispatchOnDegraded=true`. Dispatch is enabled by setting the `UIPATH_REMOTE_RUNNER_URL` env var; when unset, the pipeline cleanly falls through to the existing `cli_skipped_incompatible_agent` skip path so Linux-only deployments continue to work unchanged.

## Remote Windows CLI Runner Runbook

**Topology decision (Task #549 step 1):** Self-hosted Windows VM (Windows Server 2022) with `UiPath.CLI.Windows` + `UiPath.CLI.Windows.Legacy` and .NET 8 installed, exposing an HTTPS dispatch endpoint (`POST /dispatch`) and an HTTPS health endpoint (`GET /health`). Rationale: lowest cold-start latency among the four candidate options (a) self-hosted Windows VM, (b) GitHub Actions self-hosted Windows runner, (c) Azure Container Instances Windows containers, (d) hosted CI Windows runners — because the CLI step sits on the critical path of every Windows-project run, the ~1–3 s warm dispatch latency of an always-on VM is preferred over the 30–90 s cold start of on-demand container or CI options. Operational overhead of a single dedicated VM is acceptable at current run volumes, and the contract is artifact-based so a future migration to Azure Container Instances or GitHub Actions only changes the transport, not the pipeline contract.

**Required environment variables (set via Replit Secrets, not in code):**
- `UIPATH_REMOTE_RUNNER_URL` — base URL of the runner (e.g. `https://win-runner.internal/`). When unset the dispatch path is disabled and the existing skip behavior applies.
- `UIPATH_REMOTE_RUNNER_TOKEN` — bearer token used for `Authorization: Bearer …` on `/dispatch` and `/health`.

**Optional tuning variables:**
- `UIPATH_REMOTE_CLI_VERSION` (default `25.10.0`)
- `UIPATH_REMOTE_CLI_LEGACY_VERSION` (default `22.10.0`)
- `UIPATH_REMOTE_DOTNET_VERSION` (default `8.0`)
- `UIPATH_REMOTE_HEALTH_TTL_MS` (default `30000`)
- `UIPATH_REMOTE_HEALTH_PROBE_TIMEOUT_MS` (default `5000`)
- `UIPATH_REMOTE_MAX_DISPATCH_WAIT_MS` (default `60000`)
- `UIPATH_REMOTE_MAX_EXECUTION_MS` (default `180000`)
- `UIPATH_REMOTE_RETRY_COUNT` (default `1`)
- `UIPATH_REMOTE_BUSY_BEHAVIOR` — `queue` (default) or `fallback`
- `UIPATH_REMOTE_DISPATCH_ON_DEGRADED` — `true` (default) or `false`

**Health states:**
- `healthy` — runner accepting jobs and returning results within latency budget; dispatch proceeds.
- `degraded` — runner responding but slow / intermittent; dispatch proceeds by default (override with `UIPATH_REMOTE_DISPATCH_ON_DEGRADED=false`).
- `busy` — runner at capacity; pipeline queues up to `maxDispatchWaitMs` (production default — preserves CLI authority on the dispatched run; setting `UIPATH_REMOTE_BUSY_BEHAVIOR=fallback` short-circuits to the hand-rolled packer).
- `unreachable` — network-level failure to contact the runner; pipeline falls back with reason `cli_remote_unreachable`.
- `misconfigured` — runner reachable but reports configuration error (wrong CLI/runtime version, auth failure); pipeline falls back with reason `cli_remote_misconfigured`.

**How to check runner health:** `curl -H "Authorization: Bearer $UIPATH_REMOTE_RUNNER_TOKEN" $UIPATH_REMOTE_RUNNER_URL/health` — returns `{ "state": "healthy|degraded|busy|misconfigured" }`. The pipeline-side cache TTL is `UIPATH_REMOTE_HEALTH_TTL_MS` (default 30 s) so operational state changes propagate within that window without a per-job probe.

**How to restart the runner:** RDP into the Windows VM and restart the `UiPath.RemoteRunner` Windows Service (or the equivalent process). The pipeline cache will mark the runner `unreachable` until the next probe TTL window passes.

**Operational metrics (documentation requirement, not a quality gate):** observed median dispatch latency, p95 latency, and approximate per-run cost band (low/medium/high) should be captured by an operator after the runner has served a representative sample of runs and added here. These are intentionally documentation-only — the pipeline does not gate on them.

**Escalation path:** when health is `degraded` / `unreachable` / `misconfigured` for > 15 minutes, the on-call operator restarts the runner; if still unhealthy, swap to a standby VM by repointing `UIPATH_REMOTE_RUNNER_URL`. The pipeline never blocks on the remote runner — it gracefully degrades to the existing skip path with the corresponding `cli_remote_*` mode in the run record and DHG.

**Byte-fidelity invariant:** every dispatched run records `bundleHash → returnedArtifactHash → persistedArtifactHash` on the run record. A mismatch is a hard failure: the pipeline forces `packArtifactSource = fallback_adm_zip` for that run, ships the hand-rolled artifact, and preserves the full hash chain plus runner metadata under `cliRemoteRunner.byteFidelityFailure` for forensic review. The DHG cites the failure explicitly.

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