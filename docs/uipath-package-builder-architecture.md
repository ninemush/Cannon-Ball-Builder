# UiPath Package Builder — Rearchitecture Spec

> Umbrella architecture document for the CannonBall UiPath package-builder rearchitecture.
> This spec defines the target architecture, migration phases, data contracts, and file decomposition plan.

---

## Table of Contents

1. [Status Quo](#1-status-quo)
2. [Problems](#2-problems)
3. [Target Architecture](#3-target-architecture)
4. [Data Model](#4-data-model)
5. [Phase 1 — Server-Side Run Model](#5-phase-1--server-side-run-model)
6. [Phase 2 — Frontend Thin Observer](#6-phase-2--frontend-thin-observer)
7. [Phase 3 — Two-Phase Generation](#7-phase-3--two-phase-generation)
8. [Phase 4 — Property-Level Remediation & DHG Contract](#8-phase-4--property-level-remediation--dhg-contract)
9. [Phase 5 — Codebase Decomposition](#9-phase-5--codebase-decomposition)
10. [Migration Strategy](#10-migration-strategy)
11. [API Surface](#11-api-surface)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Out of Scope](#13-out-of-scope)

---

## 1. Status Quo

### Current File Map

| File | Lines | Responsibility |
|------|-------|----------------|
| `server/xaml-generator.ts` | 5,161 | XAML template engine, compliance sanitization, expression fixing, DHG generation |
| `server/uipath-integration.ts` | 4,764 | NuGet assembly, Orchestrator auth, dependency mapping, remediation ladder (activity/sequence/workflow stubbing) |
| `server/uipath-deploy.ts` | 4,854 | Orchestrator deployment, artifact extraction via LLM, queue/asset/trigger provisioning |
| `server/uipath-pipeline.ts` | 1,081 | 12-stage build pipeline, `PipelineStageTracker`, `PipelineOutcomeReport`, cache/fingerprint |
| `server/uipath-quality-gate.ts` | 1,839 | Blocking/warning validation checks, `QualityGateError` |
| `client/src/pages/workspace.tsx` | 3,064 | Primary workspace UI, `UiPathRunState`, SSE stream consumer, run lifecycle management |

### Current Generation Flow

```
workspace.tsx (client)
  │
  ├─ POST /api/ideas/:ideaId/generate-uipath   (SSE stream)
  │   └─ document-routes.ts
  │       ├─ LLM call → UiPath Package Spec (JSON)
  │       └─ runBuildPipeline()
  │           └─ generateUiPathPackage()  (uipath-pipeline.ts)
  │               ├─ Context loading (SDD, process map)
  │               ├─ SHA-256 fingerprint / cache check
  │               ├─ buildNuGetPackage()  (uipath-integration.ts)
  │               │   ├─ XAML generation  (xaml-generator.ts)
  │               │   ├─ Quality gate     (uipath-quality-gate.ts)
  │               │   └─ Remediation ladder (activity → sequence → workflow)
  │               ├─ Auto-downgrade on QualityGateError
  │               ├─ Meta-validation      (meta-validation/)
  │               └─ DHG generation       (xaml-generator.ts)
  │
  └─ Client-side UiPathRunState
      ├─ Manages run ID, status, stall detection
      ├─ Parses SSE pipelineEvent stream
      └─ Lost on page refresh
```

### Current Data Model

- **`pipeline_jobs`** table: Generic job tracker with `jobId`, `status`, `currentStage`, `failedStage`, `stages` (JSON blob). Does not capture generation-specific data (spec, outcome report, DHG, package metadata).
- **`UiPathRunState`** (client-only): Ephemeral React state tracking `runId`, `source`, `status`, `complianceScore`, `outcomeSummary`. Lost on refresh.

### Current Remediation Ladder

Three levels: `activity` → `sequence` → `workflow`

```
RemediationLevel = "activity" | "sequence" | "workflow"
```

Codes: `STUB_ACTIVITY_*`, `STUB_SEQUENCE_*`, `STUB_WORKFLOW_*`

A single bad property expression forces stubbing the entire activity, losing all other valid properties.

---

## 2. Problems

| # | Problem | Impact |
|---|---------|--------|
| P1 | No first-class run model | Generation state lost on refresh; no historical run audit trail |
| P2 | Frontend orchestrates backend work | 3,000+ line `workspace.tsx` owns run ID generation, SSE management, safety timers, stalled detection, retry logic |
| P3 | Spec generation fused with package compilation | Cannot inspect or correct intent before XAML commitment |
| P4 | Remediation granularity stops at activity level | One bad property expression stubs the entire activity |
| P5 | DHG assembled from scattered inputs | `generateDeveloperHandoffGuide` pulls from loose parameters rather than a single structured report |
| P6 | Monolithic files | Three files exceed 4,700 lines each; difficult to test, review, and maintain |

---

## 3. Target Architecture

### Principles

1. **Server owns the run lifecycle.** The server generates run IDs, manages phase transitions, detects stalls, and handles retries.
2. **Frontend is a thin observer.** The client subscribes to run state via SSE/polling and renders progress. It never makes orchestration decisions.
3. **Two-phase generation.** Spec intent is produced and inspectable before XAML compilation begins.
4. **Five-level remediation.** Property → activity → sequence → workflow → package, each attempted before escalating.
5. **Structured DHG contract.** The DHG derives entirely from a formalized `PipelineOutcomeReport` with typed per-item effort estimates.
6. **Focused modules.** No file exceeds ~800 lines. Monolithic files are decomposed behind facade re-exports.

### Target Flow

```
workspace.tsx (thin observer)
  │
  ├─ POST /api/uipath/runs                     → Start run (returns runId)
  ├─ GET  /api/uipath/runs/:runId/stream        → SSE progress subscription
  ├─ GET  /api/uipath/runs/:runId               → Poll run state (reconnect)
  │
  └─ Server: startUiPathGenerationRun()          (canonical entry point)
      │
      ├─ Phase 1: Spec Generation
      │   ├─ LLM call → WorkflowSpec[] with confidence annotations
      │   ├─ Persist specs to uipath_generation_runs.spec_snapshot
      │   └─ Emit phase1_complete event
      │
      ├─ Phase 2: Package Compilation
      │   ├─ Consume WorkflowSpec[] → XAML generation
      │   ├─ Quality gate validation
      │   ├─ Five-level remediation ladder
      │   │   ├─ Level 0: Property remediation (expression fix / default)
      │   │   ├─ Level 1: Activity stubbing
      │   │   ├─ Level 2: Sequence stubbing
      │   │   ├─ Level 3: Workflow stubbing
      │   │   └─ Level 4: Package fallback (baseline_openable)
      │   ├─ Meta-validation
      │   └─ DHG generation from PipelineOutcomeReport
      │
      └─ Persist outcome to uipath_generation_runs
          (outcome_report, dhg_markdown, package_buffer, final status)
```

---

## 4. Data Model

### New Table: `uipath_generation_runs`

This table replaces the generic `pipeline_jobs` usage for generation tracking and provides a first-class run model.

```typescript
export const uipathGenerationRuns = pgTable("uipath_generation_runs", {
  id:              serial("id").primaryKey(),
  runId:           text("run_id").notNull().unique(),
  ideaId:          text("idea_id").notNull(),
  
  // Lifecycle
  phase:           text("phase").notNull().default("pending"),
    // "pending" | "spec_generation" | "spec_review" | "package_compilation" | "complete" | "failed"
  status:          text("status").notNull().default("running"),
    // "running" | "paused" | "success" | "failed" | "cancelled"
  
  // Trigger metadata
  source:          text("source").notNull().default("chat"),
    // "chat" | "retry" | "approval" | "auto"
  triggeredBy:     text("triggered_by"),
  
  // Phase 1 output (jsonb for structured querying)
  specSnapshot:    jsonb("spec_snapshot"),
    // WorkflowSpec[] with confidence annotations
  specFingerprint: text("spec_fingerprint"),
    // SHA-256 of spec inputs for cache deduplication
  
  // Phase 2 output
  generationMode:  text("generation_mode"),
    // "full_implementation" | "baseline_openable"
  outcomeReport:   jsonb("outcome_report"),
    // PipelineOutcomeReport
  dhgMarkdown:     text("dhg_markdown"),
  packageSize:     integer("package_size"),
  packageArtifactRef: text("package_artifact_ref"),
    // Reference to the stored .nupkg (chat message ID or object storage key)
  complianceScore: real("compliance_score"),
  readinessScore:  real("readiness_score"),
  
  // Error tracking
  errorMessage:    text("error_message"),
  failedStage:     text("failed_stage"),
  retryOf:         text("retry_of"),
    // run_id of the run this is retrying, if applicable
  
  // Progress tracking with sequence IDs for replay-from-offset
  progressLog:     jsonb("progress_log"),
    // Array of { seq: number, ...PipelineProgressEvent }
  lastEventSeq:    integer("last_event_seq").default(0),
  lastEventAt:     timestamp("last_event_at"),
  
  // Timestamps
  startedAt:       timestamp("started_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  specCompletedAt: timestamp("spec_completed_at"),
  completedAt:     timestamp("completed_at"),
}, (table) => ({
  ideaIdIdx: index("idx_uipath_gen_runs_idea_id").on(table.ideaId),
  statusIdx: index("idx_uipath_gen_runs_status").on(table.status),
  startedAtIdx: index("idx_uipath_gen_runs_started_at").on(table.startedAt),
}));
```

### Key Design Decisions

1. **`progressLog` stores sequenced events** (each with a `seq` integer) so that a reconnecting client can request `GET /api/uipath/runs/:runId/stream?afterSeq=N` to replay only missed events. `lastEventSeq` and `lastEventAt` track the latest event for stall detection without parsing the full log.
2. **`specSnapshot` captures the WorkflowSpec[]** between Phase 1 and Phase 2, enabling future "spec review" workflows where a human can inspect/edit intent before compilation.
3. **`retryOf` links retry chains** for audit and debugging.
4. **`outcomeReport` is the canonical JSON `PipelineOutcomeReport`** from which the DHG is deterministically derived. The DHG markdown is also persisted for convenience, but the report is the source of truth.
5. **`packageArtifactRef`** stores a reference to the generated `.nupkg` artifact (either a chat message ID containing the base64 package or an object storage key). The raw buffer is not stored in the database row.
6. **`jsonb` columns** (`specSnapshot`, `outcomeReport`, `progressLog`) enable structured querying, partial indexing, and native JSON operators — critical for replay semantics and reporting queries.
7. **Indexes** on `ideaId`, `status`, and `startedAt` support the common query patterns: "runs for this idea," "active runs," and "recent runs."

### WorkflowSpec Type (Phase 1 Output)

```typescript
export interface WorkflowSpec {
  fileName: string;
  displayName: string;
  description: string;
  
  // Structured intent
  variables: VariableSpec[];
  arguments: ArgumentSpec[];
  activities: ActivitySpec[];
  
  // Confidence annotation
  confidence: number;           // 0-1 overall confidence
  lowConfidenceItems: LowConfidenceItem[];
}

export interface ActivitySpec {
  activityType: string;         // Catalog-validated activity type
  displayName: string;
  properties: PropertySpec[];
  children?: ActivitySpec[];    // For container activities (Sequence, If, ForEach, etc.)
  confidence: number;           // Per-activity confidence
}

export interface PropertySpec {
  name: string;
  value: string;
  valueType: "literal" | "expression" | "variable" | "argument";
  confidence: number;           // Per-property confidence
  fallbackValue?: string;       // Safe default if expression fails validation
}

export interface LowConfidenceItem {
  path: string;                 // e.g., "Main.xaml > Sequence > TypeInto.Selector"
  reason: string;
  suggestedAction: string;
}
```

---

## 5. Phase 1 — Server-Side Run Model

**Depends on:** Nothing (first phase)

### Scope

- Create `uipath_generation_runs` table and Drizzle schema
- Implement `startUiPathGenerationRun()` as the canonical server-side entry point
- Add storage interface methods for run CRUD
- Create API endpoints:
  - `POST /api/uipath/runs` — start a new generation run
  - `GET /api/uipath/runs/:runId` — get run state (for polling/reconnection)
  - `GET /api/uipath/runs/:runId/stream` — SSE progress stream
  - `GET /api/uipath/runs?ideaId=X` — list runs for an idea
- Server generates run IDs (UUID v4)
- Server owns stall detection and timeout logic
- Progress events persisted to `progressLog` column for replay on reconnection
- The existing `POST /api/ideas/:ideaId/generate-uipath` endpoint becomes a compatibility facade that delegates to `startUiPathGenerationRun()`

### Implementation Notes

```
server/
  uipath-run-manager.ts          // NEW: startUiPathGenerationRun(), run lifecycle
  uipath-run-routes.ts           // NEW: /api/uipath/runs endpoints
shared/
  models/
    uipath-generation-run.ts     // NEW: table schema, insert/select types
```

- `startUiPathGenerationRun()` wraps the existing `runBuildPipeline()` call, adding run persistence before and after
- SSE stream reads from the existing `PipelineStageTracker` callback mechanism
- On reconnection, the `GET /api/uipath/runs/:runId/stream` endpoint replays `progressLog` events, then switches to live events if the run is still active
- Stall detection moves from `workspace.tsx` timers to a server-side watchdog (periodic check of last progress event timestamp)

### Compatibility Facade

The existing endpoint continues to work:

```typescript
// document-routes.ts (modified)
router.post("/api/ideas/:ideaId/generate-uipath", async (req, res) => {
  // Delegate to new canonical entry point
  const run = await startUiPathGenerationRun({
    ideaId: req.params.ideaId,
    source: "chat",
    triggeredBy: req.user?.id,
  });
  
  // Pipe SSE events from run to response (same format as before)
  pipeRunStreamToResponse(run.runId, res);
});
```

### Migration Mechanics

Phase 1 introduces a **dual-write** strategy to ensure zero-risk transition:

1. **Dual-write:** The compatibility facade writes to both `pipeline_jobs` (existing) and `uipath_generation_runs` (new) during generation. This ensures the old system continues to work while the new table is populated.
2. **Read-from-new:** New `/api/uipath/runs/*` endpoints read exclusively from `uipath_generation_runs`. The old `/api/ideas/:ideaId/generate-uipath` endpoint continues to read from `pipeline_jobs` until Phase 2 migrates the frontend.
3. **Cutover criteria:** Phase 1 is considered stable when:
   - 10+ successful dual-write generations have been verified (both tables consistent)
   - SSE reconnection tested manually on at least 3 runs
   - No data discrepancies between `pipeline_jobs` and `uipath_generation_runs` for the same runs
4. **Rollback plan:** If issues are discovered:
   - Remove the facade wrapper from `document-routes.ts` (one-line revert)
   - The `uipath_generation_runs` table is unused by the old code path, so it can be dropped or left dormant
   - Zero impact on the existing frontend or generation pipeline

### Acceptance Criteria

- [ ] Every generation attempt creates a `uipath_generation_runs` row
- [ ] Dual-write: `pipeline_jobs` row also created (backward compat)
- [ ] Run survives page refresh (state recoverable via `GET /api/uipath/runs/:runId`)
- [ ] SSE reconnection replays missed events via `afterSeq` parameter
- [ ] Existing frontend works unchanged via compatibility facade
- [ ] Run history queryable per idea
- [ ] Cancellation endpoint stops active runs at next stage boundary

---

## 6. Phase 2 — Frontend Thin Observer

**Depends on:** Phase 1

### Scope

- Remove run ID generation from `workspace.tsx`
- Remove stall detection timers from `workspace.tsx`
- Remove retry logic orchestration from `workspace.tsx`
- Replace direct SSE stream parsing with a `useUiPathRun()` hook that:
  - Calls `POST /api/uipath/runs` to start a run
  - Subscribes to `GET /api/uipath/runs/:runId/stream` for progress
  - Polls `GET /api/uipath/runs/:runId` on reconnection
  - Exposes reactive state: `{ run, progress, isBuilding, isStalled, isComplete }`
- `workspace.tsx` shrinks to pure rendering logic

### Implementation Notes

```
client/src/
  hooks/
    use-uipath-run.ts            // NEW: useUiPathRun() hook
  pages/
    workspace.tsx                // MODIFIED: remove orchestration, use hook
```

### Key Deletions from `workspace.tsx`

| Current Code | Action |
|-------------|--------|
| `UiPathRunState` interface | Delete — state comes from server |
| `UiPathRunStatus` type | Delete — server provides status |
| `currentUiPathRun` / `currentUiPathRunRef` state | Replace with `useUiPathRun()` |
| `startUiPathRun()` function (~200 lines) | Replace with `hook.startRun()` |
| SSE stream reader / `ReadableStreamDefaultReader` parsing | Move into hook |
| `updateRun()` helper | Delete |
| Stall detection timer setup | Delete (server-owned) |
| `guessIntentFromMessage` for generation trigger | Keep (intent classification stays on client) |

### Acceptance Criteria

- [ ] `workspace.tsx` no longer manages run IDs, timers, or retry decisions
- [ ] Page refresh reconnects to active run and displays current progress
- [ ] All existing UX behaviors preserved (progress display, stall indication, completion)
- [ ] `workspace.tsx` drops below 2,000 lines

---

## 7. Phase 3 — Two-Phase Generation

**Depends on:** Phase 1

### Scope

Split the current single-pass pipeline into two distinct phases:

**Phase 1: Spec Generation**
- LLM produces `WorkflowSpec[]` with per-activity and per-property confidence annotations
- Spec is persisted to `uipath_generation_runs.spec_snapshot`
- Catalog validation runs against spec (pre-XAML) to flag invalid activity types early
- Phase completes with `spec_generation` → `spec_review` (or auto-advance to `package_compilation`)

**Phase 2: Package Compilation**
- Consumes `WorkflowSpec[]` as input (not raw LLM text)
- XAML generation is deterministic given a spec (no LLM calls in this phase)
- Quality gate, remediation, meta-validation, and DHG generation happen here
- Phase completes with `package_compilation` → `complete`

### Implementation Notes

```
server/
  uipath-spec-generator.ts      // NEW: LLM → WorkflowSpec[] with confidence
  uipath-spec-validator.ts       // NEW: pre-XAML catalog validation
  uipath-package-compiler.ts     // NEW: WorkflowSpec[] → XAML → .nupkg
  uipath-pipeline.ts             // MODIFIED: orchestrate two phases
```

### Spec-to-XAML Boundary

The key architectural boundary: `WorkflowSpec[]` is the contract between Phase 1 and Phase 2.

- **Phase 1 is AI-dependent** (LLM calls, confidence scoring)
- **Phase 2 is deterministic** (template expansion, XAML serialization, validation)

This separation enables:
- Spec review/editing before committing to XAML
- Spec caching (same spec fingerprint = same package)
- Independent testing of LLM quality vs. XAML generation correctness
- Future: human-in-the-loop spec correction for low-confidence items

### Acceptance Criteria

- [ ] Spec generation produces typed `WorkflowSpec[]` with confidence annotations
- [ ] Spec persisted to database before compilation begins
- [ ] Package compilation consumes only `WorkflowSpec[]` (no raw LLM text)
- [ ] Catalog violations caught at spec level before XAML generation
- [ ] Generated packages remain identical in quality to current output

---

## 8. Phase 4 — Property-Level Remediation & DHG Contract

**Depends on:** Phase 3

### Scope

#### Five-Level Remediation Ladder

Extend the current three-level ladder with property-level remediation at the bottom and package-level fallback at the top:

```
Level 0: Property    →  Fix or default a single property expression
Level 1: Activity    →  Stub the activity (preserve container structure)
Level 2: Sequence    →  Stub the sequence children
Level 3: Workflow    →  Stub the entire workflow file
Level 4: Package     →  Fallback to baseline_openable mode
```

**New Level 0 — Property Remediation:**

When a property expression fails validation:
1. Attempt expression auto-repair (bracket wrapping, syntax normalization)
2. If `PropertySpec.fallbackValue` exists, substitute it
3. If the property has a catalog-defined default, use that
4. Only if all property-level fixes fail → escalate to Level 1 (activity stub)

This preserves the activity structure and all other valid properties.

**New Level 4 — Package Fallback:**

Explicit formalization of the existing auto-downgrade behavior as the top of the ladder rather than a separate code path.

#### Updated Types

```typescript
export type RemediationLevel = "property" | "activity" | "sequence" | "workflow" | "package";

export type RemediationCode =
  // Property level (NEW)
  | "FIX_PROPERTY_EXPRESSION_REPAIR"
  | "FIX_PROPERTY_FALLBACK_VALUE"
  | "FIX_PROPERTY_CATALOG_DEFAULT"
  // Activity level (existing)
  | "STUB_ACTIVITY_CATALOG_VIOLATION"
  | "STUB_ACTIVITY_BLOCKED_PATTERN"
  | "STUB_ACTIVITY_OBJECT_OBJECT"
  | "STUB_ACTIVITY_PSEUDO_XAML"
  | "STUB_ACTIVITY_WELLFORMEDNESS"
  | "STUB_ACTIVITY_UNKNOWN"
  // Sequence level (existing)
  | "STUB_SEQUENCE_MULTIPLE_FAILURES"
  | "STUB_SEQUENCE_WELLFORMEDNESS"
  // Workflow level (existing)
  | "STUB_WORKFLOW_BLOCKING"
  | "STUB_WORKFLOW_GENERATOR_FAILURE"
  // Package level (NEW — formalizes auto-downgrade)
  | "FALLBACK_PACKAGE_BASELINE";
```

#### Structured DHG Contract

Formalize the `PipelineOutcomeReport` as the single source of truth for DHG generation:

```typescript
export interface PipelineOutcomeReport {
  // Existing fields
  remediations: RemediationEntry[];
  autoRepairs: AutoRepairEntry[];
  downgradeEvents: DowngradeEventEntry[];
  qualityWarnings: QualityWarningEntry[];
  fullyGeneratedFiles: string[];
  totalEstimatedEffortMinutes: number;

  // NEW: Structured effort breakdown
  effortBreakdown: EffortBreakdown;
  
  // NEW: Per-workflow summary
  workflowSummaries: WorkflowOutcomeSummary[];
  
  // NEW: Overall readiness assessment
  readinessScore: number;           // 0-100
  readinessCategory: "production_ready" | "minor_work" | "significant_work" | "scaffold_only";
}

export interface EffortBreakdown {
  propertyFixes: number;            // Minutes — items fixed by property remediation
  activityStubs: number;            // Minutes — activities that need manual implementation
  sequenceStubs: number;            // Minutes — sequences that need manual implementation
  workflowStubs: number;            // Minutes — workflows that need manual implementation
  total: number;                    // Sum of above
}

export interface WorkflowOutcomeSummary {
  fileName: string;
  displayName: string;
  status: "fully_generated" | "partially_generated" | "stubbed";
  activitiesTotal: number;
  activitiesGenerated: number;
  activitiesStubbed: number;
  propertiesRemediated: number;
  estimatedEffortMinutes: number;
}
```

#### DHG Generation

`generateDeveloperHandoffGuide()` becomes a pure function of `PipelineOutcomeReport`:

```typescript
function generateDeveloperHandoffGuide(report: PipelineOutcomeReport): string {
  // Deterministic Markdown rendering from structured data only
  // No additional inputs needed
}
```

### Acceptance Criteria

- [ ] Property-level expression failures are repaired without stubbing the activity
- [ ] Five-level remediation ladder operates as: property → activity → sequence → workflow → package
- [ ] `PipelineOutcomeReport` contains complete structured effort breakdown
- [ ] DHG is a pure function of `PipelineOutcomeReport` (no scattered inputs)
- [ ] Readiness scoring uses the new `readinessCategory` classification
- [ ] Existing packages maintain quality; net reduction in unnecessary stubs

---

## 9. Phase 5 — Codebase Decomposition

**Depends on:** Phases 2, 3, 4

### Scope

Decompose monolithic files into focused modules. This is strictly a refactor with no behavior changes.

### Target File Structure

```
server/
  uipath/
    # Run management (Phase 1 outputs)
    run-manager.ts               # startUiPathGenerationRun(), run lifecycle
    run-routes.ts                # /api/uipath/runs/* endpoints
    run-stream.ts                # SSE streaming, reconnection, event replay
    
    # Spec generation (Phase 3 outputs)
    spec-generator.ts            # LLM → WorkflowSpec[]
    spec-validator.ts            # Pre-XAML catalog validation
    
    # Package compilation (Phase 3 outputs)
    package-compiler.ts          # WorkflowSpec[] → XAML → .nupkg
    
    # XAML engine (from xaml-generator.ts)
    xaml/
      xaml-serializer.ts         # WorkflowSpec → raw XAML string
      xaml-compliance.ts         # makeUiPathCompliant, namespace fixing
      xaml-expressions.ts        # smartBracketWrap, expression syntax
      xaml-view-state.ts         # WorkflowViewState.IdRef generation
      xaml-templates.ts          # Base XAML templates (Windows/Portable)
      index.ts                   # Facade re-export
    
    # Quality & remediation (from uipath-quality-gate.ts + uipath-integration.ts)
    quality/
      quality-gate.ts            # Validation checks, QualityGateError
      remediation-ladder.ts      # Five-level remediation orchestration
      property-remediator.ts     # Level 0: property expression fixes
      activity-remediator.ts     # Level 1: activity stubbing
      sequence-remediator.ts     # Level 2: sequence stubbing
      workflow-remediator.ts     # Level 3: workflow stubbing
      index.ts                   # Facade re-export
    
    # NuGet packaging (from uipath-integration.ts)
    packaging/
      nuget-builder.ts           # .nupkg assembly, archiver
      project-json.ts            # project.json generation
      dependency-resolver.ts     # Activity → NuGet package mapping
      index.ts                   # Facade re-export
    
    # Deployment (from uipath-deploy.ts)
    deploy/
      deploy-orchestrator.ts     # deployAllArtifacts, upload flow
      artifact-extractor.ts      # LLM-based artifact extraction from SDD
      queue-provisioner.ts       # Queue creation
      asset-provisioner.ts       # Asset creation
      trigger-provisioner.ts     # Trigger creation
      orchestrator-client.ts     # Low-level Orchestrator API calls
      index.ts                   # Facade re-export
    
    # DHG (from xaml-generator.ts)
    dhg/
      dhg-generator.ts           # PipelineOutcomeReport → Markdown
      dhg-templates.ts           # Section templates
      index.ts                   # Facade re-export
    
    # Shared types
    types.ts                     # All UiPath-specific types consolidated
    
    # Existing files (relocated)
    activity-policy.ts           # from server/uipath-activity-policy.ts
    activity-registry.ts         # from server/uipath-activity-registry.ts
    auth.ts                      # from server/uipath-auth.ts
    fetch.ts                     # from server/uipath-fetch.ts
    
    # Pipeline orchestration
    pipeline.ts                  # Simplified orchestrator (Phase 1 → Phase 2)
    
    # Facade
    index.ts                     # Public API re-exports

  # Existing directories (unchanged)
  catalog/
    catalog-service.ts
    catalog-validator.ts
    xaml-template-builder.ts
  
  meta-validation/
    meta-validator.ts
    confidence-scorer.ts
    correction-applier.ts
    cost-tracker.ts
    index.ts
```

### Decomposition Rules

1. **No file exceeds ~800 lines.** If a module grows beyond this, it should be split further.
2. **Facade re-exports.** Each subdirectory has an `index.ts` that re-exports the public API. Internal modules are not imported directly from outside the directory.
3. **Backward compatibility.** The top-level `server/uipath/index.ts` facade re-exports everything that external code (routes, etc.) currently imports from the monolithic files. Existing imports continue to resolve.
4. **One responsibility per file.** Each module has a single, clear responsibility described by its name.

### Migration Approach

1. Create the directory structure
2. Extract functions/types from monolithic files into new modules
3. Update the monolithic files to re-export from new locations (temporary)
4. Update all import sites to use the new paths
5. Delete the now-empty monolithic files
6. Verify all tests pass at each step

### Acceptance Criteria

- [ ] All monolithic files (>4,700 lines) are decomposed
- [ ] No module exceeds ~800 lines
- [ ] All imports resolve correctly
- [ ] All existing functionality works identically
- [ ] Facade re-exports maintain backward compatibility during transition

---

## 10. Migration Strategy

### Phased Rollout

```
Phase 1 (Run Model)        ──────►  Phase 2 (Frontend)
         │
         └──────────────────────►  Phase 3 (Two-Phase Gen)  ──►  Phase 4 (Remediation)
                                                                        │
                                                                        ▼
                                            Phase 2 + Phase 3 + Phase 4 ──►  Phase 5 (Decomposition)
```

### Compatibility Guarantees

| Phase | Existing Endpoint | Frontend | Generation Quality |
|-------|-------------------|----------|-------------------|
| 1 | Works unchanged (facade) | Works unchanged | Identical |
| 2 | Works unchanged | Migrated to new hooks | Identical |
| 3 | Works unchanged | Works unchanged | Identical (spec is internal) |
| 4 | Works unchanged | Minor UI updates for property remediation | Improved (fewer stubs) |
| 5 | Import paths updated | Import paths updated | Identical |

### Risk Mitigation

- **Phase 1** is additive only — new table + new endpoints + facade wrapper. Zero risk to existing flow.
- **Phase 2** is a frontend-only change. If the new hook has issues, revert to direct SSE parsing.
- **Phase 3** changes internal pipeline structure but external behavior is unchanged. Integration tests validate package output.
- **Phase 4** adds a new remediation level. Worst case: property remediation doesn't trigger and the existing activity-level stub fires (same as today).
- **Phase 5** is purely structural. The test suite validates no behavior changes.

---

## 11. API Surface

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/uipath/runs` | Start a new generation run |
| `GET` | `/api/uipath/runs/:runId` | Get run state (polling, reconnection) |
| `GET` | `/api/uipath/runs/:runId/stream` | SSE progress stream (with replay) |
| `GET` | `/api/uipath/runs` | List runs for an idea (`?ideaId=X`) |
| `POST` | `/api/uipath/runs/:runId/cancel` | Cancel an active run |

### Authorization

All run endpoints enforce idea-level ownership checks:

- The caller must have access to the `ideaId` associated with the run.
- `POST /api/uipath/runs` validates that the caller has access to the specified `ideaId` before creating the run.
- `GET /api/uipath/runs/:runId`, `GET .../stream`, and `POST .../cancel` load the run row, extract `ideaId`, and verify the caller has access to that idea using the same access-check middleware used by existing `/api/ideas/:ideaId/*` routes.
- `GET /api/uipath/runs?ideaId=X` validates idea access before querying runs.

This prevents IDOR: a `runId` alone is not sufficient to access run data.

### Request/Response Shapes

**POST /api/uipath/runs**
```typescript
// Request
{
  ideaId: string;
  source?: "chat" | "retry" | "approval" | "auto";
  retryOfRunId?: string;
  force?: boolean;         // Skip cache
}

// Response
{
  runId: string;
  status: "running";
  phase: "spec_generation";
  streamUrl: string;       // SSE endpoint URL
}
```

**GET /api/uipath/runs/:runId**
```typescript
// Response
{
  runId: string;
  ideaId: string;
  phase: string;
  status: string;
  source: string;
  generationMode?: string;
  complianceScore?: number;
  readinessScore?: number;
  outcomeReport?: PipelineOutcomeReport;
  dhgMarkdown?: string;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
  lastEventSeq: number;
  progressLog: PipelineProgressEvent[];
}
```

**GET /api/uipath/runs/:runId/stream?afterSeq=N**
```
Query parameter:
  afterSeq (optional): Replay events with seq > N, then switch to live stream.
                       If omitted, replays all events.

SSE event stream (same format as current pipelineEvent, with added seq):
data: {"seq": 1, "pipelineEvent": {"type": "started", "stage": "xaml_generation", "message": "..."}}
data: {"seq": 2, "pipelineEvent": {"type": "heartbeat", "stage": "xaml_generation", "elapsed": 5200}}
data: {"seq": 3, "pipelineEvent": {"type": "completed", "stage": "xaml_generation", "message": "..."}}
data: {"done": true, "runId": "...", "status": "success"}
```

**POST /api/uipath/runs/:runId/cancel**
```typescript
// Request: empty body
// Response
{
  runId: string;
  status: "cancelled";
  cancelledAt: string;
}
```

Cancellation sets the run status to `cancelled` and signals the pipeline to abort at the next stage boundary. In-progress LLM calls are not interrupted but their results are discarded.

### Deprecated Endpoints (Phase 2+)

| Method | Path | Status |
|--------|------|--------|
| `POST` | `/api/ideas/:ideaId/generate-uipath` | Facade → delegates to new run API |

### Data Retention

- **Active runs** (status `running` or `paused`): retained indefinitely.
- **Completed runs** (status `success`, `failed`, `cancelled`): `progressLog` is pruned to summary-only (stage start/complete events, removing heartbeats) after 7 days to reduce storage. `outcomeReport`, `specSnapshot`, and `dhgMarkdown` are retained for the lifetime of the idea.
- **Retention enforcement**: a scheduled job (or on-demand cleanup) runs weekly to prune old `progressLog` entries.

---

## 12. Acceptance Criteria

### Overall Done

- [ ] Every generation attempt tracked in `uipath_generation_runs` with full lifecycle
- [ ] Page refresh recovers run state and reconnects to progress stream
- [ ] Spec intent is inspectable before XAML compilation
- [ ] A single bad property expression doesn't stub an entire activity
- [ ] DHG accurately reports completed work, remaining work, and effort estimates from structured data
- [ ] Codebase organized into focused, testable modules (no file >800 lines in the `server/uipath/` tree)
- [ ] Generated packages open in UiPath Studio and deploy to Orchestrator
- [ ] All existing functionality preserved throughout migration

### Per-Phase Verification

Each phase has its own acceptance criteria (see Sections 5-9). A phase is complete when all its criteria are met and the existing test suite passes.

---

## 13. Out of Scope

- Rewriting the activity catalog, workflow tree assembler, or expression builder from scratch
- Changing the UiPath Orchestrator deployment flow
- Modifying the PDD/SDD document generation pipeline
- Frontend visual redesign beyond consuming the new observation model
- Multi-tenant or multi-user concurrent generation
- Changes to `server/catalog/`, `server/meta-validation/`, or `server/ai-xaml-enricher.ts` (these are already well-scoped modules)
