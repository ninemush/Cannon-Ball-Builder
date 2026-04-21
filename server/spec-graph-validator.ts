/**
 * Task #556 Wave 1 — Upstream spec-time graph and resolution validation.
 *
 * These passes run immediately after `spec_merge` (before per-workflow
 * refinement and XAML emission) on the merged `UiPathPackageSpec`. They
 * are the structural/resolution tier of the validation pyramid and are
 * deliberately separate from the post-emission XAML-graph validator that
 * still lives in `package-assembler.ts` for defense in depth.
 *
 * Two passes are exported:
 *
 *   1. `validateSpecGraphAtMerge(pkg)` — cycles, orphans (workflows not
 *      reachable from the entry point), and InvokeWorkflowFile targets
 *      that name workflows not present in the package.
 *
 *   2. `validateSpecResolution(pkg)` — catalog-derived activity existence
 *      and invocation-target resolution. Only runs the catalog check when
 *      the catalog is loaded; missing-catalog at this stage is a no-op
 *      with a warning rather than an error so we don't fail-fast on a
 *      cold environment.
 *
 * Both passes are pure functions of the merged spec — they do not touch
 * the LLM, the filesystem, or any caller's heartbeats. They are intended
 * to be cheap (~milliseconds) and to fire before the most expensive work
 * in the pipeline.
 */

import type { UiPathPackageSpec } from "./types/uipath-package";
import { catalogService } from "./catalog/catalog-service";
import { normalizeWorkflowName } from "./workflow-name-utils";

/**
 * Task #560 Step 1 — structured merge-validator error tagging.
 *
 * Every error surfaced by the spec-merge validators is tagged with a
 * machine-readable `class` and the upstream pipeline stage that originated
 * the structural condition, so the run manager and the auto-repair pass
 * can branch on shape rather than parse free-text messages.
 *
 * `class` values:
 *   - "orphan"                  — workflow unreachable from entry
 *   - "cycle"                   — invocation cycle detected
 *   - "unresolved-invocation"   — InvokeWorkflowFile target not declared
 *   - "unknown-activity"        — activity type not in catalog
 *   - "unresolved-prefix"       — namespace prefix not in catalog
 *   - "unresolved-package"      — activity has no derivable package
 *   - "missing-required-property" — required prop absent (no catalog default)
 *   - "argument-contract"       — invocation argument bindings unsatisfiable
 *   - "other"                   — anything else
 *
 * `originatedAtStage` values:
 *   - "scaffold" — structural shape decided by the scaffold pass
 *     (orphans, cycles, unresolved invocations, argument-contract)
 *   - "detail"   — structural shape decided by per-workflow detail
 *     emission (unknown-activity, missing-required-property, prefix/package)
 *   - "unknown"  — cannot be attributed
 */
export type SpecMergeErrorClass =
  | "orphan"
  | "cycle"
  | "unresolved-invocation"
  | "unknown-activity"
  | "unresolved-prefix"
  | "unresolved-package"
  | "missing-required-property"
  | "argument-contract"
  // Task #563 — scaffold authority pass: spec carries `entryWorkflow`
  // explicitly. When the merged spec arrives without one, the graph
  // validator emits this tagged error and the run halts before the
  // assembler is invited to guess.
  | "missing-entry-workflow"
  | "unresolved-entry-workflow"
  | "other";

export type SpecMergeErrorOriginStage = "scaffold" | "detail" | "unknown";

export interface TaggedSpecMergeError {
  class: SpecMergeErrorClass;
  originatedAtStage: SpecMergeErrorOriginStage;
  message: string;
  /**
   * Class-specific payload so consumers can branch without re-parsing the
   * message. Shape varies by `class`; readers should narrow on `class`
   * before reading fields.
   */
  detail?: {
    workflow?: string;
    target?: string;
    caller?: string;
    activityType?: string;
    property?: string;
    prefix?: string;
  };
}

export interface SpecGraphValidationResult {
  errors: string[];
  warnings: string[];
  cycles: string[];
  orphans: string[];
  unresolvedInvocations: Array<{ caller: string; target: string }>;
  taggedErrors: TaggedSpecMergeError[];
}

export interface SpecResolutionValidationResult {
  errors: string[];
  warnings: string[];
  taggedErrors: TaggedSpecMergeError[];
  unknownActivities: Array<{ workflow: string; activityType: string }>;
  unresolvedInvocationTargets: Array<{ workflow: string; target: string }>;
  unresolvedPrefixes: Array<{ workflow: string; activityType: string; prefix: string }>;
  missingRequiredProperties: Array<{ workflow: string; activityType: string; property: string; hasCatalogDefault: boolean }>;
  // Task #556 Wave 1 — the derivation outcome of the package-resolution
  // check. `derivedPackages` lists catalog package IDs that are required
  // to satisfy every activity in the spec (by catalog schema OR by
  // prefix resolution). `unresolvedPackageDependencies` lists activities
  // whose package could not be derived at all at this tier; those are
  // treated as errors since no downstream refinement can fabricate a
  // missing package.
  derivedPackages: string[];
  unresolvedPackageDependencies: Array<{ workflow: string; activityType: string }>;
  catalogChecked: boolean;
}

interface FlatStep {
  activityType?: string;
  activity?: string;
  properties?: Record<string, unknown>;
  steps?: FlatStep[];
  thenSteps?: FlatStep[];
  elseSteps?: FlatStep[];
  bodySteps?: FlatStep[];
  trySteps?: FlatStep[];
  catchSteps?: FlatStep[];
  finallySteps?: FlatStep[];
}

// Typed list of FlatStep keys that can hold nested child step arrays.
// Using a typed `keyof` narrowing avoids `(step as any)[childKey]` escapes
// in the recursive visitors below.
type FlatStepChildKey =
  | "steps"
  | "thenSteps"
  | "elseSteps"
  | "bodySteps"
  | "trySteps"
  | "catchSteps"
  | "finallySteps";

const FLAT_STEP_CHILD_KEYS: readonly FlatStepChildKey[] = [
  "steps",
  "thenSteps",
  "elseSteps",
  "bodySteps",
  "trySteps",
  "catchSteps",
  "finallySteps",
] as const;

function getFlatStepChildren(step: FlatStep, key: FlatStepChildKey): FlatStep[] | undefined {
  return step[key];
}

/**
 * Coerce any value that should be a workflow filename into a string. Returns
 * an empty string for objects we cannot resolve (so the check fails closed).
 */
function coerceTargetToString(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw == null) return "";
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.value === "string") return obj.value;
    if (typeof obj.name === "string") return obj.name;
    if (typeof obj.baseUrl === "string") return obj.baseUrl;
  }
  return "";
}

function normalizeTargetToWorkflowName(raw: unknown): string {
  const asString = coerceTargetToString(raw);
  if (!asString) return "";
  let t = (asString.split("/").pop() || asString).split("\\").pop() || asString;
  t = t.replace(/^\.+[/\\]*/, "");
  t = t.replace(/\.xaml$/i, "");
  return normalizeWorkflowName(t);
}

function visitStepsForInvokes(
  steps: FlatStep[] | undefined,
  out: Array<{ rawTarget: unknown; normalized: string }>,
): void {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    const at = step?.activityType || "";
    if (at === "InvokeWorkflowFile" || /InvokeWorkflowFile$/.test(at)) {
      const raw = step.properties?.WorkflowFileName;
      const normalized = normalizeTargetToWorkflowName(raw);
      out.push({ rawTarget: raw, normalized });
    }
    for (const childKey of FLAT_STEP_CHILD_KEYS) {
      visitStepsForInvokes(getFlatStepChildren(step, childKey), out);
    }
  }
}

function visitStepsForActivities(
  steps: FlatStep[] | undefined,
  out: Array<{ activityType: string; activity?: string }>,
): void {
  if (!Array.isArray(steps)) return;
  for (const step of steps) {
    const at = step?.activityType;
    if (typeof at === "string" && at.length > 0) {
      out.push({ activityType: at, activity: step.activity });
    }
    for (const childKey of FLAT_STEP_CHILD_KEYS) {
      visitStepsForActivities(getFlatStepChildren(step, childKey), out);
    }
  }
}

function findEntryWorkflowKey(workflowKeys: string[], pkg?: UiPathPackageSpec): string | null {
  // Task #563 (review) — scaffold authority is now strict: the entry
  // workflow MUST be declared by name on the spec. No "Main" or
  // first-workflow election; missing entry is surfaced by the caller as
  // a tagged `missing-entry-workflow` error.
  if (pkg?.entryWorkflow) {
    const entryNorm = normalizeWorkflowName(pkg.entryWorkflow);
    for (const key of workflowKeys) {
      if (normalizeWorkflowName(key) === entryNorm) return key;
    }
  }
  return null;
}

/**
 * Spec-time graph validation. Runs immediately after spec_merge on the
 * merged package spec — well before refinement and XAML emission.
 *
 * This validator covers the three structural conditions named in
 * task-556 acceptance:
 *   - cycles in the InvokeWorkflowFile graph
 *   - orphan workflows unreachable from the entry workflow
 *   - InvokeWorkflowFile targets that name a workflow not present in
 *     the spec
 *
 * It does not require XAML to exist and does not mutate the spec.
 */
export function validateSpecGraphAtMerge(pkg: UiPathPackageSpec): SpecGraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cycles: string[] = [];
  const orphans: string[] = [];
  const unresolvedInvocations: Array<{ caller: string; target: string }> = [];

  const taggedErrors: TaggedSpecMergeError[] = [];
  const workflows = pkg.workflows || [];
  if (workflows.length === 0) {
    warnings.push("Spec contains zero workflows — graph validation skipped");
    return { errors, warnings, cycles, orphans, unresolvedInvocations, taggedErrors };
  }

  const normalizedWorkflowKeys = new Set<string>();
  const declaredKeyByNormalized = new Map<string, string>();
  for (const wf of workflows) {
    const norm = normalizeWorkflowName(wf.name || "");
    if (!norm) continue;
    normalizedWorkflowKeys.add(norm);
    if (!declaredKeyByNormalized.has(norm)) declaredKeyByNormalized.set(norm, wf.name);
  }

  const graph = new Map<string, string[]>();
  for (const wf of workflows) {
    const callerNorm = normalizeWorkflowName(wf.name || "");
    if (!callerNorm) continue;
    const invokes: Array<{ rawTarget: unknown; normalized: string }> = [];
    visitStepsForInvokes((wf.steps || []) as FlatStep[], invokes);
    const targetNorms: string[] = [];
    for (const inv of invokes) {
      if (!inv.normalized) {
        // Non-string or unresolvable target — record as unresolved.
        unresolvedInvocations.push({
          caller: wf.name,
          target: typeof inv.rawTarget === "string" ? inv.rawTarget : `<non-string: ${typeof inv.rawTarget}>`,
        });
        continue;
      }
      if (!normalizedWorkflowKeys.has(inv.normalized)) {
        unresolvedInvocations.push({ caller: wf.name, target: coerceTargetToString(inv.rawTarget) || inv.normalized });
        continue;
      }
      targetNorms.push(inv.normalized);
    }
    graph.set(callerNorm, targetNorms);
  }

  // Cycle detection (Tarjan-style DFS with stack). Records the SCCs as cycles.
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const start = path.indexOf(node);
      if (start >= 0) {
        const cycle = path.slice(start).concat(node).join(" → ");
        if (!cycles.includes(cycle)) cycles.push(cycle);
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const next of graph.get(node) || []) dfs(next, [...path, node]);
    inStack.delete(node);
  }
  for (const node of Array.from(graph.keys())) dfs(node, []);

  // Reachability from the entry workflow.
  // Task #563 — surface a tagged error if the spec arrived without an
  // explicit `entryWorkflow`. We still attempt fallback to compute
  // reachability so the user sees both classes of failure in one pass.
  if (!pkg.entryWorkflow) {
    const msg = `Spec missing required "entryWorkflow" field — scaffold authority cannot be enforced without an explicit entry`;
    errors.push(msg);
    taggedErrors.push({
      class: "missing-entry-workflow",
      originatedAtStage: "scaffold",
      message: msg,
    });
  }
  const entryKey = findEntryWorkflowKey(workflows.map(w => w.name), pkg);
  // Task #563 (review) — fail fast at merge when an entryWorkflow value
  // is present but does not resolve to any workflow in the merged spec.
  // Otherwise this dangling-entry case slips into package assembly and
  // surfaces as a confusing wrapper-wiring failure.
  if (pkg.entryWorkflow && !entryKey) {
    const msg = `Spec entryWorkflow "${pkg.entryWorkflow}" does not resolve to any workflow in the merged spec`;
    errors.push(msg);
    taggedErrors.push({
      class: "unresolved-entry-workflow",
      originatedAtStage: "scaffold",
      message: msg,
    });
  }
  if (entryKey) {
    const entryNorm = normalizeWorkflowName(entryKey);
    const reachable = new Set<string>([entryNorm]);
    const queue = [entryNorm];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const next of graph.get(cur) || []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    for (const norm of Array.from(normalizedWorkflowKeys)) {
      if (!reachable.has(norm)) {
        orphans.push(declaredKeyByNormalized.get(norm) || norm);
      }
    }
  }

  for (const cycle of cycles) {
    const msg = `Circular invocation detected: ${cycle}`;
    errors.push(msg);
    taggedErrors.push({ class: "cycle", originatedAtStage: "scaffold", message: msg });
  }
  if (orphans.length > 0) {
    const summaryMsg = `${orphans.length} orphan workflow(s) unreachable from entry workflow: ${orphans.join(", ")}`;
    errors.push(summaryMsg);
    for (const orphanName of orphans) {
      taggedErrors.push({
        class: "orphan",
        originatedAtStage: "scaffold",
        message: `Workflow "${orphanName}" is unreachable from the entry workflow`,
        detail: { workflow: orphanName },
      });
    }
  }
  for (const u of unresolvedInvocations) {
    const msg = `Unresolved InvokeWorkflowFile target in "${u.caller}": "${u.target}" does not match any workflow declared in the spec`;
    errors.push(msg);
    taggedErrors.push({
      class: "unresolved-invocation",
      originatedAtStage: "scaffold",
      message: msg,
      detail: { caller: u.caller, target: u.target },
    });
  }

  return { errors, warnings, cycles, orphans, unresolvedInvocations, taggedErrors };
}

/**
 * Spec-time resolution validation. Per task-556 acceptance, this pass is
 * deliberately conservative: it only flags conditions that are
 * deterministically derivable at this stage and would represent a
 * structural shape that no downstream refinement can repair.
 *
 *   - every InvokeWorkflowFile target resolves to a known workflow
 *     (also covered by graph validation; included here for the catalog
 *     story to make this pass self-contained)
 *   - every referenced activityType exists in the loaded activity catalog
 *
 * The "missing required property" and "unresolved package dependency"
 * checks named in the task description are intentionally NOT implemented
 * as fail-fast errors here because, per the task constraints, properties
 * and packages can be legitimately filled later by refinement, fallback
 * registry logic, or post-assembly repair. They remain the domain of the
 * downstream `spec-validator.ts` (per-activity) and dependency-analyzer.
 */
export function validateSpecResolution(pkg: UiPathPackageSpec): SpecResolutionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const unknownActivities: Array<{ workflow: string; activityType: string }> = [];
  const unresolvedInvocationTargets: Array<{ workflow: string; target: string }> = [];
  const unresolvedPrefixes: Array<{ workflow: string; activityType: string; prefix: string }> = [];
  const missingRequiredProperties: Array<{ workflow: string; activityType: string; property: string; hasCatalogDefault: boolean }> = [];

  const derivedPackageSet = new Set<string>();
  const unresolvedPackageDependencies: Array<{ workflow: string; activityType: string }> = [];

  const taggedErrors: TaggedSpecMergeError[] = [];
  const workflows = pkg.workflows || [];
  if (workflows.length === 0) {
    warnings.push("Spec contains zero workflows — resolution validation skipped");
    return { errors, warnings, taggedErrors, unknownActivities, unresolvedInvocationTargets, unresolvedPrefixes, missingRequiredProperties, derivedPackages: [], unresolvedPackageDependencies, catalogChecked: false };
  }

  const normalizedWorkflowKeys = new Set<string>(workflows.map(w => normalizeWorkflowName(w.name || "")).filter(Boolean));

  for (const wf of workflows) {
    const invokes: Array<{ rawTarget: unknown; normalized: string }> = [];
    visitStepsForInvokes((wf.steps || []) as FlatStep[], invokes);
    for (const inv of invokes) {
      const targetStr = coerceTargetToString(inv.rawTarget);
      if (!inv.normalized || !normalizedWorkflowKeys.has(inv.normalized)) {
        unresolvedInvocationTargets.push({
          workflow: wf.name,
          target: targetStr || `<non-string: ${typeof inv.rawTarget}>`,
        });
      }
    }
  }

  // Walk every activity-bearing step (not just leaves) so we can run the
  // catalog/required-property checks against properties carried by the
  // step itself (control-flow steps still get visited because their children
  // are walked separately).
  function walkSteps(
    steps: FlatStep[] | undefined,
    out: Array<{ activityType: string; properties: Record<string, unknown> }>,
  ): void {
    if (!Array.isArray(steps)) return;
    for (const step of steps) {
      const at = step?.activityType;
      if (typeof at === "string" && at.length > 0) {
        out.push({ activityType: at, properties: (step.properties || {}) as Record<string, unknown> });
      }
      for (const childKey of FLAT_STEP_CHILD_KEYS) {
        walkSteps(getFlatStepChildren(step, childKey), out);
      }
    }
  }

  let catalogChecked = false;
  if (catalogService.isLoaded()) {
    catalogChecked = true;
    const CONTROL_FLOW = new Set(["If", "Switch", "ForEach", "While", "DoWhile", "TryCatch", "RetryScope", "Sequence", "Comment", "InvokeWorkflowFile", "Parallel", "Pick", "PickBranch", "Flowchart", "FlowDecision", "FlowSwitch", "StateMachine", "State"]);
    const seenActivity = new Set<string>();
    const seenPrefix = new Set<string>();
    const seenRequired = new Set<string>();
    for (const wf of workflows) {
      const acts: Array<{ activityType: string; properties: Record<string, unknown> }> = [];
      walkSteps((wf.steps || []) as FlatStep[], acts);
      for (const a of acts) {
        const prefixMatch = a.activityType.match(/^([A-Za-z][A-Za-z0-9]*):/);
        const bare = a.activityType.replace(/^[A-Za-z][A-Za-z0-9]*:/, "");
        if (CONTROL_FLOW.has(bare)) continue;

        // Deterministic package-derivation: every prefixed activity must
        // resolve to a catalog package via the prefix index.
        let prefixPackageId: string | null = null;
        if (prefixMatch) {
          const prefix = prefixMatch[1];
          prefixPackageId = catalogService.getPackageForPrefix(prefix);
          const prefixKey = `${wf.name}::${prefix}::${bare}`;
          if (!seenPrefix.has(prefixKey)) {
            seenPrefix.add(prefixKey);
            if (!prefixPackageId) {
              unresolvedPrefixes.push({ workflow: wf.name, activityType: a.activityType, prefix });
            }
          }
        }

        // Activity existence in catalog.
        const actKey = `${wf.name}::${bare}`;
        let schema = null as ReturnType<typeof catalogService.getActivitySchema>;
        if (!seenActivity.has(actKey)) {
          seenActivity.add(actKey);
          schema = catalogService.getActivitySchema(bare);
          if (!schema) {
            unknownActivities.push({ workflow: wf.name, activityType: bare });
          }
        } else {
          schema = catalogService.getActivitySchema(bare);
        }

        // Comprehensive package derivation: prefer the catalog schema's
        // packageId (which names the owning package directly) and fall
        // back to the prefix index. If NEITHER resolves, the activity
        // has no derivable package dependency and is flagged as an
        // unresolved package dependency. Derived package IDs are
        // accumulated into `derivedPackageSet` so the run ledger can see
        // exactly which packages the spec demands.
        const derivedPkg = (schema && schema.packageId) || prefixPackageId;
        if (derivedPkg) {
          derivedPackageSet.add(derivedPkg);
        } else {
          unresolvedPackageDependencies.push({ workflow: wf.name, activityType: a.activityType });
        }

        // Deterministic required-property check. We only flag IN/INOUT
        // properties marked required: true that are absent or empty in
        // the spec. OUT properties are not user inputs and are skipped.
        if (schema && schema.activity && Array.isArray(schema.activity.properties)) {
          for (const prop of schema.activity.properties) {
            if (!prop.required) continue;
            if (prop.direction !== "In" && prop.direction !== "InOut") continue;
            const reqKey = `${wf.name}::${bare}::${prop.name}`;
            if (seenRequired.has(reqKey)) continue;
            seenRequired.add(reqKey);
            const v = a.properties[prop.name];
            const isEmpty = v == null
              || (typeof v === "string" && v.trim().length === 0)
              || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length === 0);
            if (isEmpty) {
              // Task #556 Wave 1 — split by whether the catalog defines a
              // default value for the required property. A required
              // property WITHOUT a catalog default cannot be filled in
              // downstream by any deterministic source (refinement is
              // non-deterministic, fallback has no default either) — so
              // it is a fail-fast error at this tier. A required
              // property WITH a catalog default will be filled at
              // emission time by spec-validator's contract-default
              // pass, so it is surfaced as a warning only.
              const hasCatalogDefault = typeof prop.default === "string" && prop.default.length > 0;
              missingRequiredProperties.push({ workflow: wf.name, activityType: bare, property: prop.name, hasCatalogDefault });
            }
          }
        }
      }
    }
  } else {
    warnings.push("Activity catalog not loaded at spec-resolution time — catalog-based activity existence, package-derivation, and required-property checks skipped");
  }

  for (const u of unresolvedInvocationTargets) {
    const msg = `Unresolved invocation target in "${u.workflow}": "${u.target}" does not match any workflow in the spec`;
    errors.push(msg);
    taggedErrors.push({
      class: "unresolved-invocation",
      originatedAtStage: "scaffold",
      message: msg,
      detail: { caller: u.workflow, target: u.target },
    });
  }
  // Wave 1 acceptance: only checks that are deterministically structural
  // at spec_merge — and that no downstream refinement can legitimately
  // repair — are promoted to errors. The package-derivation check
  // (prefix → package) is deterministic: a prefix that does not resolve
  // to any catalog package cannot be "filled in" later by refinement,
  // so it fails fast here. Activity-existence-in-catalog is likewise
  // deterministic at this tier. Required-property presence, however, is
  // legitimately filled in later by refinement / fallback registry /
  // post-assembly repair, so it is surfaced as a warning and left to
  // the per-activity validator at catalog/spec-validator.ts.
  for (const u of unresolvedPrefixes) {
    const msg = `Activity "${u.activityType}" in "${u.workflow}" uses prefix "${u.prefix}" which does not resolve to any catalog package (deterministic package-derivation failure)`;
    errors.push(msg);
    taggedErrors.push({
      class: "unresolved-prefix",
      originatedAtStage: "detail",
      message: msg,
      detail: { workflow: u.workflow, activityType: u.activityType, prefix: u.prefix },
    });
  }
  for (const u of unknownActivities) {
    const msg = `Activity "${u.activityType}" in "${u.workflow}" is not present in the activity catalog (deterministic activity-existence failure)`;
    errors.push(msg);
    taggedErrors.push({
      class: "unknown-activity",
      originatedAtStage: "detail",
      message: msg,
      detail: { workflow: u.workflow, activityType: u.activityType },
    });
  }
  for (const u of unresolvedPackageDependencies) {
    const msg = `Activity "${u.activityType}" in "${u.workflow}" has no derivable package dependency (neither catalog schema nor prefix index resolved it)`;
    errors.push(msg);
    taggedErrors.push({
      class: "unresolved-package",
      originatedAtStage: "detail",
      message: msg,
      detail: { workflow: u.workflow, activityType: u.activityType },
    });
  }
  // Task #556 Wave 1 — split required-property surfacing:
  //   - no catalog default → ERROR (cannot be deterministically filled)
  //   - catalog default     → WARNING (emission will contract-default-fill)
  for (const u of missingRequiredProperties) {
    if (!u.hasCatalogDefault) {
      const msg = `Activity "${u.activityType}" in "${u.workflow}" is missing required property "${u.property}" and the catalog defines no default for it (deterministic required-property failure)`;
      errors.push(msg);
      taggedErrors.push({
        class: "missing-required-property",
        originatedAtStage: "detail",
        message: msg,
        detail: { workflow: u.workflow, activityType: u.activityType, property: u.property },
      });
    } else {
      warnings.push(`Activity "${u.activityType}" in "${u.workflow}" is missing required property "${u.property}" — catalog default will be applied at emission time`);
    }
  }

  return { errors, warnings, taggedErrors, unknownActivities, unresolvedInvocationTargets, unresolvedPrefixes, missingRequiredProperties, derivedPackages: Array.from(derivedPackageSet).sort(), unresolvedPackageDependencies, catalogChecked };
}
