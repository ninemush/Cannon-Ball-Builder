/**
 * Task #560 — spec_merge auto-repair safety net.
 *
 * This module implements a bounded, single-pass repair over a merged
 * `UiPathPackageSpec` whose validators (`spec-graph-validator.ts`) flagged
 * structural failures. It is the *safety net*, not the primary fix — the
 * primary fix is upstream catalog-grounded scaffold + detail emission
 * (Steps 2–6 of the task), which this module does not implement.
 *
 * Repair scope (per task acceptance):
 *
 *   - Class `orphan` — rewire (inject `InvokeWorkflowFile` into the entry
 *     workflow) when the orphan is named in the entry workflow's
 *     description text OR has zero required `In` arguments and its
 *     arguments can be satisfied from the entry's scope. Otherwise prune
 *     (remove the orphan workflow from the spec). The orphan-overrun
 *     signal is preserved in the repair record so downstream
 *     `workflow_budget_check` and #408 mode-selection can read it.
 *
 *   - Class `missing-required-property` — consult per-activity policy:
 *       safely-defaultable      → fill from documented default
 *       must-be-real-value      → do not silently default; reserve an LLM
 *                                 repair call (counted toward the cap).
 *     If neither applies, fall through to a single targeted LLM repair
 *     call scoped to that activity's JSON.
 *
 * Hard caps (per task acceptance):
 *
 *   - Total LLM repair calls per run: ≤3 (combined across all required
 *     properties).
 *   - Per-call wall-clock budget: 30 seconds.
 *   - Per-property attempts: 1.
 *   - Cancellation: every LLM call honours the caller-supplied
 *     `AbortSignal` (the same signal that propagates from the user's
 *     cancel button via `cancelActiveRun`).
 *
 * Outputs a `SpecMergeRepairRecord` with `schemaVersion: 1` (per task
 * acceptance — the shape is versioned so future evolution does not break
 * downstream readers like #410 readiness reporting and #525 infra-rename
 * surfacing).
 */

import type { UiPathPackageSpec } from "./types/uipath-package";
import type { TaggedSpecMergeError } from "./spec-graph-validator";
import type { ValueIntent } from "./xaml/expression-builder";
import { catalogService } from "./catalog/catalog-service";
import { normalizeWorkflowName } from "./workflow-name-utils";
import { getCodeLLM, type LLMProvider } from "./lib/llm";
import { trySanitizeAndParseJson } from "./lib/json-utils";

type WorkflowSpec = UiPathPackageSpec["workflows"][number];
type StepSpec = WorkflowSpec["steps"][number];
type StepProperties = StepSpec["properties"];

export const SPEC_MERGE_REPAIR_RECORD_SCHEMA_VERSION = 1;

/**
 * Per-activity policy for missing-required-property repair. Two tiers:
 *
 *   - `safelyDefaultable`: a documented default value sane for production
 *     emission. Used when the catalog itself does not declare a default
 *     but the value is unambiguous (e.g. enum has one canonical value).
 *
 *   - `mustBeRealValue`: properties for which a fabricated default would
 *     produce silent runtime failures (paths, URLs, selectors, secrets,
 *     workflow file names). Never silently filled; LLM-only.
 *
 * Properties not listed in either set fall through to the LLM-repair
 * path (which is itself capped).
 */
interface RequiredPropertyPolicy {
  safelyDefaultable: Record<string, Record<string, string>>;
  mustBeRealValue: Set<string>;
}

const DEFAULT_POLICY: RequiredPropertyPolicy = {
  safelyDefaultable: {
    "AddQueueItem":          { "QueueType": "Simple" },
    "ui:AddQueueItem":       { "QueueType": "Simple" },
    "SetTransactionStatus":  { "Status": "Successful" },
    "ui:SetTransactionStatus": { "Status": "Successful" },
    "HttpClient":            { "Method": "GET", "AcceptFormat": "JSON" },
    "ui:HttpClient":         { "Method": "GET", "AcceptFormat": "JSON" },
    "LogMessage":            { "Level": "Info" },
    "ui:LogMessage":         { "Level": "Info" },
  },
  mustBeRealValue: new Set([
    "FormSchemaPath",
    "WorkflowFileName",
    "FilePath",
    "FileName",
    "Url",
    "EndPoint",
    "ConnectionString",
    "Selector",
    "Target",
    "Password",
    "Username",
  ]),
};

export interface OrphanRepairAction {
  workflow: string;
  action: "rewired" | "pruned" | "skipped";
  reason: string;
}

export interface RequiredPropertyRepairAction {
  workflow: string;
  activityType: string;
  property: string;
  action: "filled-default" | "filled-llm" | "failed";
  source: "deterministic-policy" | "llm-repair";
  value?: string;
  reason: string;
  /**
   * When true the fill came from a non-deterministic LLM call; downstream
   * (#408 mode-selection, #410 readiness reporting) uses this so users can
   * tell why two otherwise-identical regenerated runs differ on the same
   * scaffold.
   */
  nonDeterministic: boolean;
}

export interface SpecMergeRepairRecord {
  schemaVersion: number;
  attempted: boolean;
  succeeded: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** Total LLM repair calls actually issued (capped at LLM_CALL_CAP). */
  llmCallCount: number;
  llmCallCap: number;
  cancelled: boolean;
  orphanActions: OrphanRepairAction[];
  requiredPropertyActions: RequiredPropertyRepairAction[];
  unrepairableErrors: TaggedSpecMergeError[];
  /**
   * Counts the orphan-rewire signal so #408 mode-selection still sees
   * "scaffold over-decomposed by N" even after pruning silences
   * `workflow_budget_check`.
   *
   *   - `orphansBeforeRepair`: number of orphan-class tagged errors received.
   *   - `orphansUnresolved`: orphan-class errors the repair could neither
   *     rewire nor prune (i.e. the `skipped` actions). Note this is the
   *     repair module's local view; downstream consumers that need the
   *     true post-repair orphan count from graph re-validation should
   *     call the validator again on `repairedPackage`.
   */
  scaffoldOverrunSignal: { orphansBeforeRepair: number; orphansUnresolved: number };
}

export interface RunSpecMergeRepairOptions {
  pkg: UiPathPackageSpec;
  taggedErrors: TaggedSpecMergeError[];
  abortSignal?: AbortSignal;
  /** Optional logger for stage emission (not required for unit tests). */
  onLog?: (msg: string) => void;
  /**
   * Override the LLM-call cap (default 3). Tests use 0 to assert that
   * deterministic repair never reaches the LLM.
   */
  llmCallCap?: number;
  /** Override the per-call budget in ms. Default 30000. */
  perCallBudgetMs?: number;
  /** Inject an alternate LLM for tests. */
  llmOverride?: Pick<LLMProvider, "create">;
}

const DEFAULT_LLM_CALL_CAP = 3;
const DEFAULT_PER_CALL_BUDGET_MS = 30_000;

export async function runSpecMergeRepair(opts: RunSpecMergeRepairOptions): Promise<{
  repairedPackage: UiPathPackageSpec;
  record: SpecMergeRepairRecord;
}> {
  const startedAt = new Date();
  const cap = typeof opts.llmCallCap === "number" ? opts.llmCallCap : DEFAULT_LLM_CALL_CAP;
  const perCallBudgetMs = opts.perCallBudgetMs ?? DEFAULT_PER_CALL_BUDGET_MS;
  const log = opts.onLog || (() => {});

  const orphanErrors = opts.taggedErrors.filter(e => e.class === "orphan");
  const requiredPropErrors = opts.taggedErrors.filter(e => e.class === "missing-required-property");
  const unrepairable = opts.taggedErrors.filter(
    e => e.class !== "orphan" && e.class !== "missing-required-property",
  );

  const orphanActions: OrphanRepairAction[] = [];
  const requiredPropertyActions: RequiredPropertyRepairAction[] = [];
  let llmCallCount = 0;
  let cancelled = false;

  const orphansBeforeRepair = orphanErrors.length;

  // Deep-clone so callers retain the original on partial failure.
  const pkg: UiPathPackageSpec = JSON.parse(JSON.stringify(opts.pkg));

  // ---- Orphan rewire / prune ----
  if (orphanErrors.length > 0) {
    const entryWorkflow = pickEntryWorkflow(pkg);
    if (!entryWorkflow) {
      for (const oe of orphanErrors) {
        orphanActions.push({
          workflow: oe.detail?.workflow || "",
          action: "skipped",
          reason: "no entry workflow available to rewire into",
        });
      }
    } else {
      const entryIntentText = `${entryWorkflow.name} ${entryWorkflow.description || ""}`.toLowerCase();
      for (const oe of orphanErrors) {
        if (opts.abortSignal?.aborted) { cancelled = true; break; }
        const orphanName = oe.detail?.workflow || "";
        if (!orphanName) {
          orphanActions.push({ workflow: "", action: "skipped", reason: "orphan name missing from tagged error" });
          continue;
        }
        const orphan = pkg.workflows.find(w => normalizeWorkflowName(w.name) === normalizeWorkflowName(orphanName));
        if (!orphan) {
          orphanActions.push({ workflow: orphanName, action: "skipped", reason: "orphan workflow not present in spec" });
          continue;
        }
        const namedInIntent = entryIntentText.includes(normalizeWorkflowName(orphanName).toLowerCase());
        const requiredInArgs = (orphan.arguments || []).filter(a => isInDirection(a.direction));
        const zeroRequiredIn = requiredInArgs.length === 0;

        // Argument-contract safety: never inject InvokeWorkflowFile unless
        // every required In argument can be satisfied from the entry
        // workflow's scope (variables or arguments matching by normalized
        // name). Without this check, a "named-in-intent" rewire silently
        // shifts the failure downstream into XAML emission / Studio open.
        const entryScope = collectEntryScope(entryWorkflow);
        const unsatisfied = requiredInArgs
          .map(a => normalizeArgName(a.name))
          .filter(n => !entryScope.has(n));
        const argsSatisfiable = unsatisfied.length === 0;

        const canRewire = zeroRequiredIn || (namedInIntent && argsSatisfiable);

        if (canRewire) {
          // Inject InvokeWorkflowFile into entry workflow with deterministic
          // argument bindings drawn from entry scope (variables/arguments
          // matched by normalized name). For zero-required-In orphans the
          // arguments map is empty.
          const argumentsBinding: Record<string, { type: "variable"; name: string }> = {};
          for (const a of requiredInArgs) {
            const n = normalizeArgName(a.name);
            const original = entryScope.get(n);
            if (original) argumentsBinding[a.name] = { type: "variable", name: original };
          }
          const stepProps: StepProperties = {
            WorkflowFileName: { type: "literal", value: `${orphan.name}.xaml` } satisfies ValueIntent,
          };
          if (Object.keys(argumentsBinding).length > 0) {
            stepProps.Arguments = { type: "literal", value: JSON.stringify(argumentsBinding) } satisfies ValueIntent;
          }
          entryWorkflow.steps.push({
            activity: `Invoke ${orphan.name}`,
            activityType: "InvokeWorkflowFile",
            activityPackage: "UiPath.System.Activities",
            properties: stepProps,
            selectorHint: null,
            errorHandling: "none",
            notes: `Auto-rewired by spec_merge_repair (${zeroRequiredIn ? "zero required In args" : "named in entry intent + args bound from entry scope"})`,
          });
          orphanActions.push({
            workflow: orphanName,
            action: "rewired",
            reason: zeroRequiredIn
              ? "orphan has zero required In arguments"
              : `orphan named in entry workflow intent text; ${requiredInArgs.length} required In arg(s) bound from entry scope`,
          });
        } else {
          // Prune. Either the orphan was not named in intent and had
          // required In args, or it was named in intent but its required
          // In args could not be satisfied from entry scope (the
          // contract-safety case the reviewer flagged in #560).
          const idx = pkg.workflows.findIndex(w => normalizeWorkflowName(w.name) === normalizeWorkflowName(orphanName));
          if (idx >= 0) pkg.workflows.splice(idx, 1);
          const reason = !namedInIntent
            ? `orphan not named in entry intent and has ${requiredInArgs.length} required In arg(s) — cannot fabricate bindings`
            : `orphan named in entry intent but ${unsatisfied.length} required In arg(s) cannot be bound from entry scope (${unsatisfied.join(", ")}) — refusing to rewire with fabricated bindings`;
          orphanActions.push({
            workflow: orphanName,
            action: "pruned",
            reason,
          });
        }
      }
    }
  }

  // ---- Missing required property fill ----
  for (const rpe of requiredPropErrors) {
    if (opts.abortSignal?.aborted) { cancelled = true; break; }
    const wfName = rpe.detail?.workflow || "";
    const activityType = rpe.detail?.activityType || "";
    const propertyName = rpe.detail?.property || "";
    const wf = pkg.workflows.find(w => normalizeWorkflowName(w.name) === normalizeWorkflowName(wfName));
    if (!wf) {
      requiredPropertyActions.push({
        workflow: wfName, activityType, property: propertyName,
        action: "failed", source: "deterministic-policy",
        reason: "workflow not found in spec (likely pruned by orphan repair)",
        nonDeterministic: false,
      });
      continue;
    }

    // Locate the activity step. We walk recursively because real specs
    // often nest activities in control-flow containers.
    const step = findFirstStepWithMissingProperty(wf.steps, activityType, propertyName);
    if (!step) {
      requiredPropertyActions.push({
        workflow: wfName, activityType, property: propertyName,
        action: "failed", source: "deterministic-policy",
        reason: "could not locate activity step in workflow",
        nonDeterministic: false,
      });
      continue;
    }

    // Tier 1: deterministic policy.
    const policyMatch =
      DEFAULT_POLICY.safelyDefaultable[activityType]?.[propertyName] ||
      DEFAULT_POLICY.safelyDefaultable[stripPrefix(activityType)]?.[propertyName];
    if (policyMatch !== undefined) {
      step.properties = step.properties || {};
      step.properties[propertyName] = { type: "literal", value: String(policyMatch) };
      requiredPropertyActions.push({
        workflow: wfName, activityType, property: propertyName,
        action: "filled-default", source: "deterministic-policy",
        value: policyMatch,
        reason: "documented safely-defaultable value applied",
        nonDeterministic: false,
      });
      continue;
    }

    // Tier 2: must-be-real-value → fail repair. The repair safety net
    // never fabricates these (paths, URLs, selectors, credentials,
    // workflow file names): an LLM-fabricated value would silently pass
    // spec_merge but blow up at runtime / Studio open. Surfacing this as
    // a `failed` action keeps the failure visible upstream so users can
    // supply the real value.
    const isMustBeReal = DEFAULT_POLICY.mustBeRealValue.has(propertyName);
    if (isMustBeReal) {
      requiredPropertyActions.push({
        workflow: wfName, activityType, property: propertyName,
        action: "failed", source: "deterministic-policy",
        reason: "property requires a real-world value (path / URL / selector / credential / workflow file name) — repair refuses to fabricate; user input required",
        nonDeterministic: false,
      });
      continue;
    }

    // Tier 3: LLM repair, capped.
    if (llmCallCount >= cap) {
      requiredPropertyActions.push({
        workflow: wfName, activityType, property: propertyName,
        action: "failed", source: "llm-repair",
        reason: `LLM repair cap (${cap}) reached; no deterministic policy available for this property`,
        nonDeterministic: false,
      });
      continue;
    }
    if (opts.abortSignal?.aborted) { cancelled = true; break; }

    llmCallCount++;
    try {
      const llmFill = await callRepairLLM({
        workflowName: wfName,
        workflowDescription: wf.description || "",
        activityType,
        propertyName,
        catalogHint: getCatalogHint(activityType, propertyName),
        abortSignal: opts.abortSignal,
        budgetMs: perCallBudgetMs,
        llmOverride: opts.llmOverride,
      });
      if (llmFill == null || llmFill.length === 0) {
        requiredPropertyActions.push({
          workflow: wfName, activityType, property: propertyName,
          action: "failed", source: "llm-repair",
          reason: "LLM returned empty value",
          nonDeterministic: true,
        });
        continue;
      }
      step.properties = step.properties || {};
      step.properties[propertyName] = { type: "literal", value: llmFill };
      requiredPropertyActions.push({
        workflow: wfName, activityType, property: propertyName,
        action: "filled-llm", source: "llm-repair",
        value: llmFill,
        reason: "no deterministic policy; targeted LLM repair fill",
        nonDeterministic: true,
      });
    } catch (err: unknown) {
      const isAbort = (err instanceof Error && err.name === "AbortError") || !!opts.abortSignal?.aborted;
      const msg = isAbort
        ? "LLM call aborted by run cancellation"
        : `LLM call failed: ${err instanceof Error ? err.message : String(err)}`;
      if (isAbort) cancelled = true;
      requiredPropertyActions.push({
        workflow: wfName, activityType, property: propertyName,
        action: "failed", source: "llm-repair",
        reason: msg,
        nonDeterministic: true,
      });
      if (cancelled) break;
    }
  }

  const finishedAt = new Date();
  const succeeded =
    !cancelled &&
    orphanActions.every(a => a.action !== "skipped") &&
    requiredPropertyActions.every(a => a.action !== "failed") &&
    unrepairable.length === 0;

  const orphansUnresolved = orphanActions.filter(a => a.action === "skipped").length;

  log(`[spec_merge_repair] orphans=${orphanActions.length} (rewired=${orphanActions.filter(a => a.action === "rewired").length}, pruned=${orphanActions.filter(a => a.action === "pruned").length}, skipped=${orphanActions.filter(a => a.action === "skipped").length}); requiredProps=${requiredPropertyActions.length} (filled=${requiredPropertyActions.filter(a => a.action !== "failed").length}, failed=${requiredPropertyActions.filter(a => a.action === "failed").length}); llmCalls=${llmCallCount}/${cap}; cancelled=${cancelled}`);

  return {
    repairedPackage: pkg,
    record: {
      schemaVersion: SPEC_MERGE_REPAIR_RECORD_SCHEMA_VERSION,
      attempted: true,
      succeeded,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      llmCallCount,
      llmCallCap: cap,
      cancelled,
      orphanActions,
      requiredPropertyActions,
      unrepairableErrors: unrepairable,
      scaffoldOverrunSignal: { orphansBeforeRepair, orphansUnresolved },
    },
  };
}

function pickEntryWorkflow(pkg: UiPathPackageSpec): UiPathPackageSpec["workflows"][number] | null {
  if (!pkg.workflows || pkg.workflows.length === 0) return null;
  for (const wf of pkg.workflows) {
    if (normalizeWorkflowName(wf.name) === "Main") return wf;
  }
  return pkg.workflows[0];
}

/**
 * Build a lookup of names available in the entry workflow's scope, mapping
 * normalized name → original name. Both variables and arguments contribute.
 * Used to verify orphan-rewire argument bindings can actually be satisfied
 * before injecting an InvokeWorkflowFile.
 */
function collectEntryScope(wf: UiPathPackageSpec["workflows"][number]): Map<string, string> {
  const scope = new Map<string, string>();
  for (const v of wf.variables || []) {
    if (v?.name) scope.set(normalizeArgName(v.name), v.name);
  }
  for (const a of wf.arguments || []) {
    if (a?.name) scope.set(normalizeArgName(a.name), a.name);
  }
  return scope;
}

function normalizeArgName(name: string): string {
  return (name || "").trim().replace(/^(in_|out_|io_)/i, "").toLowerCase();
}

function isInDirection(direction: string): boolean {
  const d = direction.toLowerCase();
  return d === "in" || d === "inargument" || d === "in_out" || d === "inoutargument";
}

function stripPrefix(activityType: string): string {
  const i = activityType.indexOf(":");
  return i >= 0 ? activityType.slice(i + 1) : activityType;
}

/**
 * Locate the first step in a workflow whose `activityType` matches
 * `activityType` (with or without `ui:`-style prefix) and whose
 * `properties[propertyName]` is missing or empty. Returns the step
 * by reference so the caller can mutate `properties` in place. Steps
 * are flat in the current `uipathPackageSchema`; if a future schema
 * nests sub-steps, extend this walker accordingly.
 */
function findFirstStepWithMissingProperty(
  steps: StepSpec[] | undefined,
  activityType: string,
  propertyName: string,
): StepSpec | null {
  if (!Array.isArray(steps)) return null;
  for (const step of steps) {
    const at = step.activityType || "";
    if (at !== activityType && stripPrefix(at) !== stripPrefix(activityType)) continue;
    const v = step.properties?.[propertyName];
    const isEmpty = v == null
      || (typeof v === "string" && (v as string).trim().length === 0)
      || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length === 0);
    if (isEmpty) return step;
  }
  return null;
}

function getCatalogHint(activityType: string, propertyName: string): string {
  if (!catalogService.isLoaded()) return "";
  const schema = catalogService.getActivitySchema(stripPrefix(activityType))
    || catalogService.getActivitySchema(activityType);
  if (!schema || !schema.activity) return "";
  const prop = (schema.activity.properties || []).find(p => p.name === propertyName);
  if (!prop) return "";
  const parts: string[] = [];
  if (prop.clrType) parts.push(`type: ${prop.clrType}`);
  if (Array.isArray(prop.validValues) && prop.validValues.length > 0) {
    parts.push(`allowed: ${prop.validValues.join("|")}`);
  }
  if (prop.default) parts.push(`catalogDefault: ${prop.default}`);
  return parts.join("; ");
}

interface CallRepairLLMOptions {
  workflowName: string;
  workflowDescription: string;
  activityType: string;
  propertyName: string;
  catalogHint: string;
  abortSignal?: AbortSignal;
  budgetMs: number;
  llmOverride?: Pick<LLMProvider, "create">;
}

async function callRepairLLM(opts: CallRepairLLMOptions): Promise<string> {
  const llm = opts.llmOverride || getCodeLLM();
  // Compose a budget-bounded abort: combine caller signal + per-call timeout.
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  if (opts.abortSignal) {
    if (opts.abortSignal.aborted) controller.abort();
    else opts.abortSignal.addEventListener("abort", onCallerAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), opts.budgetMs);
  try {
    const sys = "You repair a single missing required property in a UiPath activity. Respond with ONLY a JSON object of shape {\"value\": \"<string>\"} — no prose, no code fences. Pick a value consistent with the workflow's intent. The caller has already filtered out properties that require real-world values (paths, URLs, selectors, credentials, workflow file names) — those never reach you.";
    const userMsg = JSON.stringify({
      workflowName: opts.workflowName,
      workflowDescription: opts.workflowDescription,
      activityType: opts.activityType,
      missingProperty: opts.propertyName,
      catalogHint: opts.catalogHint || null,
    });
    const response = await llm.create({
      system: sys,
      messages: [{ role: "user", content: userMsg }],
      maxTokens: 256,
      temperature: 0,
      abortSignal: controller.signal,
    });
    const parsed = trySanitizeAndParseJson<unknown>(response.text || "");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const candidate = (parsed as { value?: unknown }).value;
      if (typeof candidate === "string") return candidate.trim();
    }
    return "";
  } finally {
    clearTimeout(timer);
    if (opts.abortSignal) opts.abortSignal.removeEventListener("abort", onCallerAbort);
  }
}
