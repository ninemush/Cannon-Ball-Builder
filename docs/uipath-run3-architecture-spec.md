# UiPath Run 3 Architecture Spec — Platform Capability Discovery & Solution Mode Selection

> Companion architecture document for the CannonBall UiPath package-builder rearchitecture.
> This spec defines how UiPath Platform Capability Discovery and UiPath Solution Mode Selection integrate into the existing pipeline while preserving non-negotiable package generation safeguards.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Target Architecture](#2-target-architecture)
3. [UiPath-Specific Output Contracts](#3-uipath-specific-output-contracts)
4. [Decision Rules — UiPath RPA vs UiPath Agent vs Hybrid UiPath Solution](#4-decision-rules--uipath-rpa-vs-uipath-agent-vs-hybrid-uipath-solution)
5. [UiPath Service Confidence Model](#5-uipath-service-confidence-model)
6. [PDD Future Enhancements Contract](#6-pdd-future-enhancements-contract)
7. [Non-Negotiable Package Generation Safeguards](#7-non-negotiable-package-generation-safeguards)
8. [Implementation Plan](#8-implementation-plan)
9. [Acceptance Criteria](#9-acceptance-criteria)

---

## 1. Problem Statement

### Why the Discovery / Selection Subsystem Is Needed

CannonBall connects to a customer's UiPath tenant and generates production-ready `.nupkg` packages, PDD documents, and SDD documents. The quality and relevance of these outputs depends on understanding which UiPath platform services are actually available on the connected tenant.

Today, CannonBall probes the connected UiPath tenant via `probeServiceAvailability()` and `getPlatformCapabilities()` (defined in `server/uipath-integration.ts`). These probes detect which services — Orchestrator, Action Center, Document Understanding, AI Center, Agents, Maestro, Integration Service, and others — are accessible with the configured credentials and scopes.

**Current consumers of probe data:**

| Consumer | File | What It Uses Probe Data For |
|----------|------|-----------------------------|
| SDD generation prompt | `server/document-routes.ts` | Shapes the SDD to leverage available platform services; drives TO-BE design toward services the tenant can actually use |
| Chat system prompt | `server/replit_integrations/chat/routes.ts` | Provides conversational awareness of platform capabilities; enables the chat to suggest Agent-based or Hybrid approaches when services are available |
| PDD Future Enhancements | `server/document-routes.ts` | Recommends unavailable-but-beneficial services as future adoption candidates |

**Current non-consumers of probe data (by design):**

| Non-Consumer | File | Why It Must Stay Decoupled |
|--------------|------|---------------------------|
| Build pipeline | `server/uipath-pipeline.ts` | Zero probe imports — consumes only structured package specs and SDD content |
| Package assembler | `server/package-assembler.ts` | Zero `ServiceAvailabilityMap`/`probeServiceAvailability` imports — assembles `.nupkg` from enriched specs. **Note:** has one grandfathered `getProbeCache()` import used only for two boolean flags (`serverlessDetected`, `autopilot`); see [Current Boundary Risk](#current-boundary-risk) for remediation plan |
| Quality gate | `server/uipath-quality-gate.ts` | Validates XAML structural correctness, not platform availability |
| XAML generator | `server/xaml-generator.ts` | Produces XAML from activity specs, not from probe flags |

**The problem this spec solves:**

The discovery and selection subsystem is currently ad-hoc. Probe results flow into SDD/PDD generation and chat prompts as raw `ServiceAvailabilityMap` objects, with each consumer interpreting boolean flags independently. There is no formal:

1. **Confidence model** — probes return booleans, but a boolean cannot distinguish between "service is definitely available" and "probe succeeded but the response was ambiguous."
2. **Solution mode selection engine** — the decision of whether the automation should be UiPath RPA, UiPath Agent, or a Hybrid UiPath solution is implicit in prompt text, not formalized as a deterministic decision.
3. **Normalized design contract** — the package builder has no formal interface for consuming solution mode decisions. Today it doesn't need one (it builds standard UiPath RPA packages), but as Agent and Hybrid modes are introduced, the contract must exist before the first line of Agent-aware package code is written.
4. **Architectural boundary enforcement** — the current decoupling between probe logic and the package pipeline is accidental (it happens to be the case that no one has added probe imports to the pipeline). This spec formalizes that decoupling as law.

---

## 2. Target Architecture

### Subsystem Relationships

```
┌──────────────────────────────────────────────────────────────────────┐
│                   UiPath Platform Capability Discovery               │
│                                                                      │
│  probeServiceAvailability() → ServiceAvailabilityMap                 │
│  getPlatformCapabilities()  → PlatformCapabilityProfile              │
│                                                                      │
│  Source: server/uipath-integration.ts                                │
│  Probes: Orchestrator, Action Center, DU, AI Center, Agents,         │
│          Maestro, Integration Service, IXP, Apps, etc.               │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       │ Raw probe results (ServiceAvailabilityMap)
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  UiPath Service Confidence Model                     │
│                                                                      │
│  Classifies each probed service on two independent axes:             │
│    • Availability: available | limited | unavailable | unknown       │
│    • Confidence:   high | medium | low                               │
│                                                                      │
│  Output: ServiceConfidenceMap                                        │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       │ ServiceConfidenceMap
                       │
          ┌────────────┼────────────────────┐
          │            │                    │
          ▼            ▼                    ▼
┌─────────────┐ ┌─────────────┐  ┌─────────────────────────────────────┐
│ SDD/PDD     │ │ Chat        │  │  UiPath Solution Mode Selection     │
│ Generation  │ │ System      │  │                                     │
│             │ │ Prompt      │  │  Inputs:                            │
│ Consumes    │ │             │  │    • ServiceConfidenceMap            │
│ raw probe   │ │ Consumes    │  │    • Process characteristics        │
│ data — OK   │ │ raw probe   │  │      (automation type, complexity,  │
│ in this     │ │ data — OK   │  │       interaction mode)             │
│ layer       │ │ in this     │  │                                     │
│             │ │ layer       │  │  Output:                            │
└─────────────┘ └─────────────┘  │    • Selected UiPath solution mode  │
                                 │    • Fallback mode                  │
                                 │    • Future enhancement candidates  │
                                 └──────────────┬──────────────────────┘
                                                │
                                                │ Normalized Design Contract
                                                │ (solution mode + selected
                                                │  capabilities + fallback)
                                                │
                         ┌──────────────────────┐
                         │                      │
                         │  ══════════════════   │
                         │  ARCHITECTURAL        │
                         │  FIREWALL             │
                         │  ══════════════════   │
                         │                      │
                         │  No raw probe data    │
                         │  crosses this line    │
                         │                      │
                         └──────────┬───────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Package Generation Pipeline                        │
│                                                                      │
│  server/uipath-pipeline.ts     — orchestrates build stages           │
│  server/package-assembler.ts   — XAML generation, .nupkg assembly    │
│  server/uipath-quality-gate.ts — structural XAML validation          │
│  server/xaml-generator.ts      — activity-to-XAML translation        │
│                                                                      │
│  Consumes ONLY:                                                      │
│    • UiPathPackageSpec / UiPathPackage (structured intent)            │
│    • SDD content (string)                                            │
│    • Process map nodes/edges                                         │
│    • Normalized Design Contract (when Agent/Hybrid builds exist)     │
│                                                                      │
│  NEVER consumes:                                                     │
│    • ServiceAvailabilityMap                                          │
│    • Raw probe payloads                                              │
│    • Endpoint paths or transport diagnostics                         │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Principles

1. **Discovery is essential, not optional.** The probe runs on every generation-triggering flow. It shapes the design, the solution mode, and the future enhancement recommendations. Skipping discovery produces lower-quality outputs.

2. **Package generation stability is non-negotiable.** The package builder must produce a valid `.nupkg` regardless of discovery outcomes. Discovery failures degrade design quality, not build reliability.

3. **The architectural firewall between discovery and package generation is a rule, not an observation.** The current absence of probe imports in `uipath-pipeline.ts` and `package-assembler.ts` is not merely current state — it is an architectural invariant that must be preserved.

4. **Two independent data paths.** Raw probe data flows into design/prompting layers (SDD, PDD, chat). Normalized design intent flows into the package builder. These paths do not merge.

---

## 3. UiPath-Specific Output Contracts

### 3.1 ServiceConfidenceMap

The output of the UiPath Service Confidence Model. Each probed service is classified on two independent dimensions.

```typescript
export type ServiceAvailability = "available" | "limited" | "unavailable" | "unknown";
export type ProbeConfidence = "high" | "medium" | "low";

export interface ServiceConfidenceEntry {
  availability: ServiceAvailability;
  confidence: ProbeConfidence;
  reason: string;
  probedAt: number;
}

export interface ServiceConfidenceMap {
  orchestrator: ServiceConfidenceEntry;
  actionCenter: ServiceConfidenceEntry;
  documentUnderstanding: ServiceConfidenceEntry;
  generativeExtraction: ServiceConfidenceEntry;
  communicationsMining: ServiceConfidenceEntry;
  testManager: ServiceConfidenceEntry;
  storageBuckets: ServiceConfidenceEntry;
  aiCenter: ServiceConfidenceEntry;
  agents: ServiceConfidenceEntry;
  maestro: ServiceConfidenceEntry;
  integrationService: ServiceConfidenceEntry;
  ixp: ServiceConfidenceEntry;
  automationHub: ServiceConfidenceEntry;
  automationOps: ServiceConfidenceEntry;
  automationStore: ServiceConfidenceEntry;
  apps: ServiceConfidenceEntry;
  assistant: ServiceConfidenceEntry;
  dataService: ServiceConfidenceEntry;
}
```

### 3.2 Normalized Design Contract

The contract between the UiPath Solution Mode Selection engine and the package builder. This is the **only** interface through which solution mode decisions reach the package generation pipeline.

```typescript
export type UiPathSolutionMode = "uipath_rpa" | "uipath_agent" | "hybrid_uipath";

export interface NormalizedDesignContract {
  selectedMode: UiPathSolutionMode;

  selectedCapabilities: SelectedCapability[];

  fallback: {
    mode: UiPathSolutionMode;
    reason: string;
  };

  futureEnhancementCandidates: FutureEnhancementCandidate[];
}

export interface SelectedCapability {
  service: string;
  role: string;
  requiredForMode: boolean;
}

export interface FutureEnhancementCandidate {
  service: string;
  benefit: string;
  currentAvailability: ServiceAvailability;
  currentConfidence: ProbeConfidence;
  adoptionPriority: "high" | "medium" | "low";
}
```

**What the Normalized Design Contract MUST include:**

| Field | Purpose |
|-------|---------|
| `selectedMode` | The UiPath solution mode the design targets: UiPath RPA, UiPath Agent, or Hybrid UiPath solution |
| `selectedCapabilities` | Which platform services the design actively uses, and their role in the solution |
| `fallback.mode` | What the build degrades to if the selected mode is unimplementable at build time |
| `fallback.reason` | Human-readable explanation of why the fallback exists |
| `futureEnhancementCandidates` | Services that would benefit the process but aren't currently available — feeds PDD Future Enhancements section |

**What the Normalized Design Contract MUST NOT include:**

| Excluded | Reason |
|----------|--------|
| Raw endpoint paths (e.g., `/odata/Releases`, `/api/agents/v2`) | Transport-level detail that couples the package builder to probe internals |
| Raw probe payloads (HTTP responses, status codes) | Diagnostic data irrelevant to design intent |
| Transport diagnostics (latency, retry counts, timeout durations) | Operational telemetry, not design input |
| Low-level service discovery details (OAuth scopes, tenant IDs, folder paths) | Credential/config-level detail that the package builder must never depend on |

### 3.3 PDD Future Enhancement Entry

The structured format for discovery-driven recommendations in the PDD.

```typescript
export interface PddFutureEnhancement {
  service: string;
  category: "document_processing" | "human_in_loop" | "ai_ml" | "integration" |
            "orchestration" | "testing" | "governance" | "user_interface" | "communication";
  benefit: string;
  implementationSketch: string;
  adoptionPriority: "high" | "medium" | "low";
  estimatedEffortDays: number;
  prerequisite: string;
}
```

---

## 4. Decision Rules — UiPath RPA vs UiPath Agent vs Hybrid UiPath Solution

### Solution Mode Decision Matrix

The UiPath Solution Mode Selection engine applies a deterministic decision matrix. Inputs are the `ServiceConfidenceMap` and process characteristics. The output is a `UiPathSolutionMode` with explicit fallback.

#### Input Dimensions

**Process Characteristics** (derived from PDD / idea metadata):

| Characteristic | Values | Source |
|---------------|--------|--------|
| Automation type | `rpa`, `agent`, `hybrid` | `idea.automationType` |
| Interaction mode | `unattended`, `attended`, `citizen_dev` | Inferred from SDD |
| Complexity | `simple`, `moderate`, `complex` | Process map node count, branching factor |
| Requires NLU/LLM reasoning | `yes`, `no` | SDD analysis |
| Requires human-in-the-loop | `yes`, `no` | SDD analysis / Action Center dependency |
| Document processing required | `yes`, `no` | SDD analysis / DU dependency |

**Platform Availability** (from `ServiceConfidenceMap`):

| Capability Group | Key Services |
|-----------------|-------------|
| Core RPA | Orchestrator (required) |
| Agent runtime | Agents service (available + high/medium confidence) |
| Human-in-the-loop | Action Center, Maestro |
| Document processing | Document Understanding, Generative Extraction, IXP |
| AI/ML | AI Center (with deployed skills) |
| Integration | Integration Service |

#### Decision Rules

```
RULE 1: UiPath Agent Mode
  IF automation_type = "agent"
  AND agents.availability = "available"
  AND agents.confidence IN ("high", "medium")
  AND orchestrator.availability = "available"
  THEN selectedMode = "uipath_agent"
       fallback = { mode: "uipath_rpa", reason: "Agent runtime unavailable at build time" }

RULE 2: Hybrid UiPath Solution
  IF automation_type = "hybrid"
  AND agents.availability = "available"
  AND orchestrator.availability = "available"
  THEN selectedMode = "hybrid_uipath"
       fallback = { mode: "uipath_rpa", reason: "Agent capabilities unavailable; RPA-only path" }

RULE 3: Agent-Eligible Process (inferred)
  IF automation_type = "rpa"
  AND requires_nlu_llm = true
  AND agents.availability = "available"
  AND agents.confidence = "high"
  THEN selectedMode = "hybrid_uipath"
       fallback = { mode: "uipath_rpa", reason: "NLU steps replaced with rule-based logic" }

RULE 4: Standard UiPath RPA (default)
  IF orchestrator.availability IN ("available", "limited", "unknown")
  THEN selectedMode = "uipath_rpa"
       fallback = { mode: "uipath_rpa", reason: "Already on minimal path" }

RULE 5: Forced UiPath RPA (degradation)
  IF automation_type IN ("agent", "hybrid")
  AND agents.availability IN ("unavailable", "unknown")
  OR agents.confidence = "low"
  THEN selectedMode = "uipath_rpa"
       fallback = { mode: "uipath_rpa", reason: "Agent services not confirmed available" }
       NOTE: Log degradation event; include agent capabilities in futureEnhancementCandidates
```

#### Rule Evaluation Order

Rules are evaluated in order (1 → 5). The first matching rule wins. Rule 4 (Standard UiPath RPA) is the catch-all default. Rule 5 overrides Rules 1-3 when Agent services are unavailable or low-confidence.

#### Fallback Guarantee

Every decision MUST produce a fallback mode. The fallback mode MUST be implementable using only Orchestrator-backed UiPath RPA capabilities. This ensures the package builder always has a buildable path.

---

## 5. UiPath Service Confidence Model

### Two Independent Dimensions

The UiPath Service Confidence Model classifies each probed service on **two separate dimensions that must not be conflated**:

#### Dimension 1: Availability (Service Health)

Describes whether the service can be used.

| Value | Meaning | Example |
|-------|---------|---------|
| `available` | Service is accessible and usable with current credentials | Orchestrator responds 200 to folder/process listing |
| `limited` | Service responds but with reduced capability (e.g., read-only, missing permissions) | Action Center reachable but task creation returns 403 |
| `unavailable` | Service is definitively not accessible | Endpoint returns 404, or license check confirms service not provisioned |
| `unknown` | Probe could not determine availability (timeout, network error, ambiguous response) | Probe timed out after 10s; 500 error with no diagnostic body |

#### Dimension 2: Confidence (Probe Certainty)

Describes how certain we are about the availability classification.

| Value | Meaning | Example |
|-------|---------|---------|
| `high` | Probe returned a definitive, unambiguous signal | 200 with expected response body; 403/404 with clear error code |
| `medium` | Probe returned a plausible signal but with some ambiguity | 200 but response body doesn't match expected schema; redirected to login |
| `low` | Probe result is unreliable or based on indirect evidence | Inferred from scope grants rather than direct probe; cached stale result |

#### Cross-Product Examples

| Service | Availability | Confidence | Interpretation |
|---------|-------------|------------|----------------|
| Orchestrator | `available` | `high` | Orchestrator is confirmed working — full RPA path is safe |
| Action Center | `available` | `low` | Probe succeeded but response was ambiguous — design can reference Action Center but package builder should not hard-depend on it |
| AI Center | `unavailable` | `high` | Probe returned definitive 404 — do not design for AI Center; recommend as Future Enhancement |
| Agents | `unknown` | `low` | Probe timed out — cannot confirm Agent availability; fall back to UiPath RPA |
| Document Understanding | `limited` | `medium` | DU endpoint responds but only classic extraction is available (no generative) — design for classic DU only |

#### Classification Rules

```typescript
function classifyService(
  probeResult: { statusCode: number; body: any; error?: string; timedOut: boolean }
): ServiceConfidenceEntry {

  if (probeResult.timedOut) {
    return { availability: "unknown", confidence: "low", reason: "Probe timed out" };
  }

  if (probeResult.error) {
    return { availability: "unknown", confidence: "low", reason: `Probe error: ${probeResult.error}` };
  }

  if (probeResult.statusCode === 200) {
    const bodyValid = validateExpectedResponseShape(probeResult.body);
    return {
      availability: "available",
      confidence: bodyValid ? "high" : "medium",
      reason: bodyValid ? "Service responded with expected format" : "Service responded 200 but body shape unexpected",
    };
  }

  if (probeResult.statusCode === 403) {
    return { availability: "limited", confidence: "high", reason: "Access denied — service exists but credentials lack permission" };
  }

  if (probeResult.statusCode === 404) {
    return { availability: "unavailable", confidence: "high", reason: "Endpoint not found — service not provisioned" };
  }

  if (probeResult.statusCode >= 500) {
    return { availability: "unknown", confidence: "low", reason: `Server error ${probeResult.statusCode}` };
  }

  return { availability: "unknown", confidence: "low", reason: `Unexpected status ${probeResult.statusCode}` };
}
```

### How the Two Axes Feed the Solution Mode Engine

The solution mode engine consumes both axes independently:

- **Availability** determines **what services can be designed for.** A service must be `available` or `limited` to be included in `selectedCapabilities`.
- **Confidence** determines **how aggressively the design commits to that service.** A `low` confidence service is included in the design as optional/fallback-able, not as a hard dependency.

A service can be:
- `available / low confidence` → include in design, but ensure fallback path exists
- `unavailable / high confidence` → definitively exclude from design; recommend as Future Enhancement
- `unknown / low confidence` → exclude from design; do not recommend (insufficient signal)

---

## 6. PDD Future Enhancements Contract

### How Discovery Results Flow into PDD Recommendations

When the UiPath Platform Capability Discovery identifies services that are **unavailable but would benefit the process**, those services flow into the PDD "Future Enhancements" section through a structured contract.

### Flow

```
ServiceConfidenceMap
  │
  │  Filter: services where availability ∈ {"unavailable", "limited"}
  │          AND the process would benefit from the service
  │
  ▼
FutureEnhancementCandidate[]
  │
  │  Enriched with:
  │    • Benefit description (why this service would help)
  │    • Adoption priority (high/medium/low)
  │    • Implementation sketch (what changes when service becomes available)
  │    • Prerequisites (what the customer needs to enable)
  │
  ▼
PDD Section: "Future Enhancements & Platform Adoption Roadmap"
  │
  │  Rendered as structured recommendations in PDD markdown
  │
  ▼
PddFutureEnhancement[]
```

### Inclusion Criteria

A service qualifies as a Future Enhancement candidate when ALL of the following are true:

1. **The service is currently unavailable or limited** — `availability ∈ {"unavailable", "limited"}`
2. **The confidence is medium or high** — we have a reliable signal that the service exists but isn't accessible (a `low` confidence + `unavailable` combination means we don't even know if the service is relevant)
3. **The process would benefit from the service** — determined by analyzing process characteristics:

| Service | Benefit Trigger |
|---------|----------------|
| Action Center | Process has human decision points, approvals, or exception handling that require human judgment |
| Document Understanding | Process involves document intake, data extraction from structured/semi-structured forms |
| Generative Extraction | Process involves unstructured document processing (contracts, correspondence) |
| AI Center | Process has classification, prediction, or anomaly detection steps |
| Communications Mining | Process involves email/message triage, routing, or sentiment analysis |
| Agents | Process requires NLU, autonomous decision-making, or conversational interaction |
| Integration Service | Process interfaces with external systems (SAP, Salesforce, ServiceNow) that have IS connectors |
| Apps | Process has manual data entry points or oversight dashboards |
| Data Service | Process needs cross-run data persistence or entity-based data management |
| Maestro | Process is complex enough to benefit from BPMN orchestration |

### PDD Output Format

Each Future Enhancement is rendered in the PDD as:

```markdown
### Future Enhancement: [Service Name]

**Priority:** High | Medium | Low
**Current Status:** [Unavailable | Limited] (Confidence: [High | Medium])

**Benefit:**
[Description of how this service would improve the automation]

**Implementation When Available:**
[Sketch of what changes in the solution when the service becomes available]

**Prerequisites:**
[What the customer needs to do to enable this service — licensing, configuration, permissions]

**Estimated Additional Effort:** [X] days
```

### Separation from Package Generation

Future Enhancement recommendations are a **PDD/SDD output only**. They MUST NOT:

- Influence the package builder's behavior
- Add conditional logic to XAML generation
- Create probe-dependent branches in the build pipeline
- Produce warnings or errors in the quality gate

They exist solely as advisory content in generated documents.

---

## 7. Non-Negotiable Package Generation Safeguards

This section defines six architectural rules that protect the core UiPath package generation path from any failure, uncertainty, or regression introduced by the UiPath Platform Capability Discovery and UiPath Solution Mode Selection subsystems.

These rules are **non-negotiable**. They are not guidelines, recommendations, or best practices. They are hard architectural constraints that must be enforced in code review, testing, and architectural governance.

### Rule 1: Capability Discovery Informs But Does Not Own or Block Package Generation

**Statement:** UiPath Platform Capability Discovery provides input to the design layer (SDD/PDD generation, chat prompts) and to the UiPath Solution Mode Selection engine. It does NOT own, gate, or block the package generation pipeline.

**Implication:** No code path in the package generation pipeline may include a conditional branch of the form "if discovery failed, fail the build." Discovery results shape the *intent* of the package (via the Normalized Design Contract), but the *execution* of the build is independent.

**Enforcement:**
- The `generateUiPathPackage()` function in `server/uipath-pipeline.ts` must not import or call `probeServiceAvailability()`, `getPlatformCapabilities()`, or read `ServiceAvailabilityMap`.
- The `buildNuGetPackage()` function in `server/package-assembler.ts` must not import or call `probeServiceAvailability()`, `getPlatformCapabilities()`, or read `ServiceAvailabilityMap`.
- If the Normalized Design Contract is unavailable at build time, the pipeline defaults to standard UiPath RPA mode.

### Rule 2: Standard Package Generation Works on the Minimal Orchestrator-Backed UiPath RPA Path

**Statement:** The standard UiPath package generation path — the path that produces a valid `.nupkg` with XAML workflows, project.json, dependencies, and Config.xlsx — must remain fully functional when the only available service is Orchestrator.

**Implication:** Every feature added to the discovery/selection subsystem must be additive. The package builder's default behavior (no discovery data, no solution mode selection) must produce the same quality output it produces today: a standard UiPath RPA package.

**Enforcement:**
- The pipeline's default `generationMode` remains `"full_implementation"` or `"baseline_openable"` as determined by the existing `selectGenerationMode()` logic in `server/xaml-generator.ts`.
- No new required parameter may be added to `generateUiPathPackage()` or `buildNuGetPackage()` that depends on discovery data.
- The existing test suite (which runs without UiPath tenant credentials) must continue to pass.

### Rule 3: Probe Failures Do Not Fail Builds

**Statement:** Failures in probing optional or advanced UiPath services — including timeouts, permission denials, network errors, unexpected response formats, and undocumented endpoint mismatches — must not propagate as build failures.

**Implication:** The probe layer must handle all failure modes internally and produce a valid (possibly degraded) `ServiceConfidenceMap`. The solution mode engine must handle `unknown` availability and `low` confidence inputs without throwing. The Normalized Design Contract must always be constructable, even from an entirely failed probe.

**Enforcement:**
- `probeServiceAvailability()` wraps all individual service probes in try-catch blocks (this is already the case — see `server/uipath-integration.ts`).
- The `ServiceConfidenceMap` always has an entry for every service, even if the entry is `{ availability: "unknown", confidence: "low" }`.
- The solution mode engine never throws on input. It always returns a valid `NormalizedDesignContract` with at minimum `{ selectedMode: "uipath_rpa", fallback: { mode: "uipath_rpa", reason: "..." } }`.

### Rule 4: Safe Degradation from UiPath Agent / Hybrid to UiPath RPA

**Statement:** If the UiPath Solution Mode Selection engine recommends UiPath Agent or Hybrid UiPath solution, but those capabilities are unavailable, uncertain, or unimplementable at build time, CannonBall must degrade safely to an implementable UiPath RPA path. If the UiPath RPA path is also not fully implementable (e.g., required activities are unsupported), the design is explicitly marked as partially implementable — the build still succeeds with appropriate DHG documentation of the gap.

**Implication:**
- UiPath Agent mode → UiPath RPA: Agent-specific activities (tool bindings, context grounding, escalation) are replaced with TODO-annotated stubs. The package remains openable in UiPath Studio.
- Hybrid UiPath solution → UiPath RPA: Agent components are stubbed; RPA components are fully generated. The package is valid and deployable for the RPA portion.
- The degradation is logged as a `DowngradeEvent` and documented in the DHG.

**Enforcement:**
- The Normalized Design Contract's `fallback.mode` is always `"uipath_rpa"` (the universal safe floor).
- The package builder checks `selectedMode` against its own capability to generate that mode. If it cannot, it uses `fallback.mode` without failing.
- Degradation events are captured in `PipelineOutcomeReport.downgradeEvents`.

### Rule 5: The Package Builder Consumes a Normalized Design Contract, Not Raw Probe Logic

**Statement:** The package generation pipeline (`server/uipath-pipeline.ts`) and the package assembler (`server/package-assembler.ts`) must consume only the Normalized Design Contract — a high-level, transport-agnostic statement of design intent. They must never consume raw probe outputs, endpoint paths, HTTP status codes, or service discovery diagnostics.

**Implication:** The Normalized Design Contract is the **only** interface between the discovery/selection subsystem and the package builder. This contract is:
- **Stable:** its shape changes only through explicit versioning, not because a UiPath API endpoint changed.
- **Testable:** the package builder can be tested with mock contracts without a live UiPath tenant.
- **Decoupled:** changes to probe endpoints, authentication flows, or service APIs cannot cascade into the package builder.

**Enforcement:**
- Import analysis: `server/uipath-pipeline.ts` and `server/package-assembler.ts` must not import `probeServiceAvailability`, `ServiceAvailabilityMap`, `getPlatformCapabilities`, `PlatformCapabilityProfile`, or `probeAllServices` from `server/uipath-integration.ts`.
- The Normalized Design Contract type is defined in a shared types file, not in the probe module.
- Code review must reject any PR that introduces raw probe data consumption in the pipeline or assembler.

### Rule 6: No Probe Timeout or Endpoint Mismatch Produces Build Failure

**Statement:** No probe timeout, undocumented endpoint mismatch, unexpected HTTP response, DNS resolution failure, TLS error, or any other transport-level issue in the UiPath Platform Capability Discovery subsystem may directly produce a package build failure.

**Implication:** This rule is the transport-level corollary of Rule 3. Even if the probe subsystem encounters a completely novel failure mode (e.g., a UiPath API introduces a new authentication challenge, or a regional endpoint uses a different URL pattern), the build pipeline must be unaffected.

**Enforcement:**
- The probe layer catches all exceptions — including unhandled promise rejections — and maps them to `{ availability: "unknown", confidence: "low" }`.
- The solution mode engine treats `unknown` availability as equivalent to `unavailable` for mode selection purposes (conservative degradation).
- No `throw` statement in the probe or discovery layer may propagate above the design/prompting layer without being caught.

### Current Boundary Risk

This subsection documents the current state of probe data consumption and identifies patterns that must be preserved or corrected.

#### Acceptable Raw Probe Consumption (Design/Prompting Layer)

Raw `ServiceAvailabilityMap` consumption currently exists in:

- **`server/document-routes.ts`** (line 86+): `buildSddProsePrompt()` receives `platformCapabilities` as a string derived from `getPlatformCapabilities()`. This shapes the SDD prompt to leverage available services. **This is acceptable** — the design/prompting layer is the intended consumer of raw probe data.

- **`server/replit_integrations/chat/routes.ts`** (line 66+): `buildSystemPrompt()` receives `serviceAvailability: ServiceAvailabilityMap` and constructs a platform context string for the chat system prompt. **This is acceptable** — the chat layer is an intended consumer of raw probe data.

#### Copy-Risk Pattern

The raw `ServiceAvailabilityMap` consumption pattern in the design/prompting layer is a **copy-risk**: if the same pattern is ever introduced into the package generation pipeline or assembler, it breaks the architectural firewall.

Specifically:
- A developer working on Agent-mode package generation might be tempted to check `serviceAvailability.agents` directly in `package-assembler.ts` to conditionally generate Agent-specific XAML.
- This would create a direct dependency between the package builder and the probe subsystem, violating Rules 1, 5, and 6.
- The correct approach is to pass Agent-mode intent through the `NormalizedDesignContract.selectedMode` field.

#### Existing Probe Cache Consumption in package-assembler.ts

`server/package-assembler.ts` (line 47-49) imports `getProbeCache()` from `server/uipath-integration.ts` and uses it for two narrow purposes:
- `_probeCacheSnapshot?.serverlessDetected` — to determine target framework (line 642)
- `_probeCacheSnapshot?.flags?.autopilot` — to enable autopilot enrichment (line 703)

**Assessment:** This is a **pre-existing boundary violation** that predates this spec. It uses cached probe data (not raw `ServiceAvailabilityMap`) for two operational flags. While not ideal, these are boolean flags that affect build configuration, not raw probe diagnostics.

**Remediation path:** These two flags (`serverlessDetected`, `autopilot`) should migrate into the Normalized Design Contract or be passed as explicit build parameters. Until then, the `getProbeCache()` import is grandfathered but must not be expanded.

**Hard rule:** No additional probe imports or probe data consumption may be added to `server/package-assembler.ts` or `server/uipath-pipeline.ts`. The existing `getProbeCache()` usage is a known exception with a planned remediation path.

#### Preserved Architectural Boundaries

The following boundaries are **architectural law**, not implementation details:

| File | Boundary Rule | Current Status |
|------|--------------|----------------|
| `server/uipath-pipeline.ts` | Zero imports of `probeServiceAvailability`, `ServiceAvailabilityMap`, `getPlatformCapabilities`, `PlatformCapabilityProfile`, `probeAllServices` | ✅ Verified — no probe imports exist |
| `server/package-assembler.ts` | Zero imports of `probeServiceAvailability`, `ServiceAvailabilityMap`, `getPlatformCapabilities`, `PlatformCapabilityProfile`, `probeAllServices` | ✅ Verified — no `ServiceAvailabilityMap` imports exist (grandfathered `getProbeCache()` for two flags only) |
| `server/uipath-quality-gate.ts` | Zero probe imports — validates XAML structure, not platform availability | ✅ Verified |
| `server/xaml-generator.ts` | Zero probe imports — generates XAML from activity specs | ✅ Verified |

---

## 8. Implementation Plan

### Phase A: UiPath Service Confidence Model (Foundation)

**Scope:** Introduce the two-dimensional confidence model that replaces raw boolean flags with `ServiceConfidenceEntry` objects.

**Steps:**

1. Define `ServiceConfidenceEntry`, `ServiceConfidenceMap`, `ServiceAvailability`, and `ProbeConfidence` types in a new shared types file (`server/types/uipath-confidence.ts`).
2. Implement `classifyServiceProbe()` — the function that maps a raw probe result (status code, body, error, timeout) to a `ServiceConfidenceEntry`.
3. Implement `buildServiceConfidenceMap()` — wraps `probeAllServices()` and produces a `ServiceConfidenceMap` by classifying each service.
4. Update `getPlatformCapabilities()` to internally use the confidence model while maintaining backward-compatible output.
5. Unit test the classification logic with edge cases: timeouts, 403s, 404s, 500s, malformed bodies, network errors.

**Dependencies:** None.
**Risk:** Low — additive change, no existing behavior modified.

### Phase B: UiPath Solution Mode Selection Engine

**Scope:** Implement the deterministic decision matrix that produces a `NormalizedDesignContract` from `ServiceConfidenceMap` + process characteristics.

**Steps:**

1. Define `NormalizedDesignContract`, `UiPathSolutionMode`, `SelectedCapability`, and `FutureEnhancementCandidate` types (in `server/types/uipath-confidence.ts` or a dedicated `server/types/uipath-design-contract.ts`).
2. Implement `selectSolutionMode(confidenceMap, processCharacteristics) → NormalizedDesignContract` — the pure function implementing the decision rules from Section 4.
3. Ensure the function never throws — all inputs (including nulls, empties, malformed objects) produce a valid contract defaulting to UiPath RPA.
4. Unit test all decision rules, including degradation paths (Rules 4 and 5 from Section 4).
5. Unit test the fallback guarantee: every output has `fallback.mode = "uipath_rpa"`.

**Dependencies:** Phase A.
**Risk:** Low — new code with no integration into existing flows.

### Phase C: PDD Future Enhancements Integration

**Scope:** Wire the `futureEnhancementCandidates` from the `NormalizedDesignContract` into PDD generation.

**Steps:**

1. Define `PddFutureEnhancement` type.
2. Implement `buildFutureEnhancements(contract: NormalizedDesignContract, processCharacteristics) → PddFutureEnhancement[]` — maps candidates to structured PDD entries using the inclusion criteria from Section 6.
3. Update PDD generation in `server/document-routes.ts` to include the Future Enhancements section when candidates exist.
4. Ensure the PDD generation path handles empty candidates gracefully (no section rendered).

**Dependencies:** Phase B.
**Risk:** Low — changes are in the design/prompting layer, which is the intended consumer of probe data.

### Phase D: SDD / Chat Integration

**Scope:** Migrate SDD prompt and chat system prompt to use `ServiceConfidenceMap` instead of raw boolean flags, enabling confidence-aware design.

**Steps:**

1. Update `buildSddProsePrompt()` in `server/document-routes.ts` to accept `ServiceConfidenceMap` and produce confidence-aware platform context (e.g., "Action Center is available with high confidence" vs. "AI Center availability is uncertain").
2. Update `buildSystemPrompt()` in `server/replit_integrations/chat/routes.ts` similarly.
3. Maintain backward compatibility: if `ServiceConfidenceMap` is unavailable, fall back to existing `ServiceAvailabilityMap` boolean behavior.

**Dependencies:** Phase A.
**Risk:** Medium — changes touch SDD/chat prompt quality. Requires manual review of generated outputs.

### Phase E: Package Builder Contract Integration (Future)

**Scope:** When Agent-mode or Hybrid-mode package generation is implemented, wire the `NormalizedDesignContract` into the pipeline as the design input.

**Steps:**

1. Add an optional `designContract?: NormalizedDesignContract` parameter to `generateUiPathPackage()`.
2. If present, the pipeline uses `designContract.selectedMode` to select the appropriate XAML generation strategy.
3. If `selectedMode` is not implementable, the pipeline falls back to `designContract.fallback.mode` and logs a `DowngradeEvent`.
4. If `designContract` is absent, the pipeline defaults to standard UiPath RPA mode (Rule 2).
5. Migrate the grandfathered `getProbeCache()` usage in `package-assembler.ts` to use `designContract` fields instead.

**Dependencies:** Phases A, B. Also depends on Agent/Hybrid XAML generation capability (not in scope for this spec).
**Risk:** Medium — this is the phase where the architectural firewall is most at risk. Code review must be rigorous.

### Phase Order

```
Phase A (Confidence Model)  ──► Phase B (Solution Mode Engine) ──► Phase C (PDD Future Enhancements)
       │                                                                    │
       └──► Phase D (SDD/Chat Integration)                                  │
                                                                            │
                                              Phase E (Package Builder — future, when Agent/Hybrid builds exist)
```

---

## 9. Acceptance Criteria

### Architectural Criteria (Testable Against Codebase)

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| A1 | `server/uipath-pipeline.ts` has zero imports of `probeServiceAvailability`, `ServiceAvailabilityMap`, `getPlatformCapabilities`, `PlatformCapabilityProfile`, or `probeAllServices` | Static import analysis (grep) |
| A2 | `server/package-assembler.ts` has zero imports of `probeServiceAvailability`, `ServiceAvailabilityMap`, `getPlatformCapabilities`, `PlatformCapabilityProfile`, or `probeAllServices` | Static import analysis (grep) |
| A3 | `server/uipath-quality-gate.ts` has zero imports of any probe function or probe type | Static import analysis (grep) |
| A4 | `server/xaml-generator.ts` has zero imports of any probe function or probe type | Static import analysis (grep) |
| A5 | The Normalized Design Contract type is defined outside the probe module (not in `server/uipath-integration.ts`) | File location check |
| A6 | The `getProbeCache()` import in `server/package-assembler.ts` is not expanded beyond the two grandfathered usages (`serverlessDetected`, `autopilot`) | Code review; grep for `_probeCacheSnapshot` usage count |
| A7 | A valid `.nupkg` can be generated with zero discovery data (empty/null `ServiceConfidenceMap`) | Integration test: generate package without UiPath credentials |
| A8 | The grandfathered `getProbeCache()` usage in `server/package-assembler.ts` is migrated to Normalized Design Contract fields or explicit build parameters by Phase E completion | Code review: verify `getProbeCache` import removed from `package-assembler.ts` |

### Confidence Model Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| C1 | Every probed service has both an `availability` status AND a `confidence` level in `ServiceConfidenceMap` | Type check + unit test |
| C2 | `availability` and `confidence` are independent — changing one does not automatically change the other | Unit test with cross-product scenarios |
| C3 | Probe timeouts produce `{ availability: "unknown", confidence: "low" }`, never throw | Unit test with simulated timeout |
| C4 | Probe 403 errors produce `{ availability: "limited", confidence: "high" }`, never throw | Unit test with simulated 403 |
| C5 | Probe 404 errors produce `{ availability: "unavailable", confidence: "high" }`, never throw | Unit test with simulated 404 |

### Solution Mode Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| S1 | `selectSolutionMode()` never throws, regardless of input | Fuzz test with random/null/empty inputs |
| S2 | Every `NormalizedDesignContract` output has a valid `fallback` with `mode = "uipath_rpa"` | Unit test: assert fallback on all outputs |
| S3 | When `agents.availability = "unavailable"`, `selectedMode` is never `"uipath_agent"` | Unit test |
| S4 | When discovery data is entirely absent, `selectedMode = "uipath_rpa"` | Unit test |
| S5 | Decision rules are deterministic: same inputs always produce same output | Unit test: run same input 100x, assert identical output |

### Package Generation Safeguard Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| P1 | A package can be built when all probes fail (all services `unknown / low`) | Integration test |
| P2 | A package can be built when `NormalizedDesignContract` is absent/null | Integration test |
| P3 | Degradation from Agent to RPA mode produces a valid `.nupkg` with appropriate DHG documentation | Integration test with mock Agent contract + unavailable Agent runtime |
| P4 | No `throw` in probe/discovery code propagates past the design/prompting layer boundary | Static analysis: trace throw paths; integration test |
| P5 | Adding a new UiPath service to the probe (e.g., a future "Process Mining" endpoint) does not require changes to the package builder | Design review: verify Normalized Design Contract abstracts service identity |
| P6 | The existing test suite passes without UiPath tenant credentials (unchanged from today) | CI test run |

### PDD Future Enhancements Criteria

| # | Criterion | Verification Method |
|---|-----------|-------------------|
| F1 | Unavailable-but-beneficial services appear in the PDD Future Enhancements section | Integration test with mock `ServiceConfidenceMap` |
| F2 | Available services do NOT appear in Future Enhancements | Unit test |
| F3 | Services with `confidence = "low"` and `availability = "unknown"` do NOT appear in Future Enhancements | Unit test |
| F4 | Future Enhancement recommendations do not influence package generation | Static analysis: Future Enhancement types not imported in pipeline/assembler |
