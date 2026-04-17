/**
 * Invoke-binding-key safety stack (task #530).
 *
 * The generic `InvokeWorkflowFile` emission path (server/xaml-generator.ts)
 * historically allowed binding entries whose `key` resolved to null, undefined,
 * empty/whitespace, or the VB literal `Nothing` to serialize directly into
 * `x:Key="..."` on InArgument/OutArgument. The contract validator then flagged
 * each one as `unknown_target_argument` against the callee, producing
 * execution-blocking defects.
 *
 * This module provides the repair-first safety stack the emitter calls before
 * writing any InvokeWorkflowFile.Arguments block:
 *
 *   Step 1 — Deterministic, non-guessing repair of the binding key only.
 *            The bound *value* is preserved verbatim. The callee identity is
 *            fixed input. No heuristic ranking, no positional fallback, no
 *            silent dedupe/drop/omit.
 *   Step 2 — If repair fails, mark the single invoke for invoke-level
 *            localized degradation (Comment + LogMessage handoff). Surrounding
 *            workflow structure is preserved by the caller.
 *   Step 3 — Hard-fail only as a last resort. Recorded as a severity-1
 *            remediation failure in the run diagnostics channel.
 *
 * The guard also performs emission-time contract validation: if a callee
 * contract is known, every key is checked against the declared argument set
 * before XAML is written.
 */

import type { StubCause } from "../lib/stub-cause";

/** VB.NET keywords / literals that must never appear as an `x:Key` value. */
export const VB_KEYWORD_INVALID_KEYS: ReadonlySet<string> = new Set([
  "Nothing", "nothing",
  "True", "true",
  "False", "false",
  "Me", "me",
  "MyBase", "mybase",
  "MyClass", "myclass",
  "Null", "null", "NULL",
  "Undefined", "undefined",
]);

export type InvokeKeyInvalidReason =
  | "null"
  | "undefined"
  | "empty"
  | "whitespace"
  | "vb-keyword";

export type InvokeKeyValidation =
  | { valid: true; normalized: string }
  | { valid: false; reason: InvokeKeyInvalidReason; raw: unknown };

/**
 * Pure predicate. Determines whether a candidate binding key is structurally
 * acceptable for emission as `x:Key="..."`. Does not consult the callee
 * contract — that step is performed by `validateAgainstContract`.
 */
export function validateBindingKey(key: unknown): InvokeKeyValidation {
  if (key === null) return { valid: false, reason: "null", raw: key };
  if (key === undefined) return { valid: false, reason: "undefined", raw: key };
  if (typeof key !== "string") {
    const coerced = String(key);
    if (coerced === "" ) return { valid: false, reason: "empty", raw: key };
    if (coerced.trim() === "") return { valid: false, reason: "whitespace", raw: key };
    if (VB_KEYWORD_INVALID_KEYS.has(coerced) || VB_KEYWORD_INVALID_KEYS.has(coerced.trim())) {
      return { valid: false, reason: "vb-keyword", raw: key };
    }
    return { valid: true, normalized: coerced };
  }
  if (key === "") return { valid: false, reason: "empty", raw: key };
  if (key.trim() === "") return { valid: false, reason: "whitespace", raw: key };
  if (VB_KEYWORD_INVALID_KEYS.has(key) || VB_KEYWORD_INVALID_KEYS.has(key.trim())) {
    return { valid: false, reason: "vb-keyword", raw: key };
  }
  return { valid: true, normalized: key };
}

export interface CalleeContractView {
  /** Lowercased argument-name → canonical declared name. */
  readonly argumentNames: ReadonlyMap<string, string>;
}

/**
 * Validates a key against the callee contract (post-structural check). Returns
 * the canonical declared name if found.
 */
export function validateAgainstContract(
  key: string,
  contract: CalleeContractView | null,
): { matched: true; canonical: string } | { matched: false } {
  if (!contract) return { matched: false };
  const canonical = contract.argumentNames.get(key.toLowerCase());
  if (canonical) return { matched: true, canonical };
  return { matched: false };
}

export interface InvokeBindingInput {
  /** Resolved key as it would otherwise be emitted into `x:Key`. */
  readonly key: unknown;
  /** Spec-declared argument name on the callee (carried through normalization), if any. */
  readonly specDeclaredName?: string | null;
  /** Source-side identifier — e.g. the caller variable name that produced the value. */
  readonly sourceIdentifier?: string | null;
  /** Direction as already inferred (`In` | `Out` | `InOut`). */
  readonly direction: "In" | "Out" | "InOut";
  /** Bound value. Preserved verbatim through Step 1. */
  readonly value: string;
}

export interface InvokeBindingResolved {
  readonly key: string;
  readonly direction: "In" | "Out" | "InOut";
  readonly value: string;
  readonly repairedFromInvalidKey: boolean;
  readonly repairProvenance?: "spec-declared" | "contract-name-equality";
}

export type GuardStep = 1 | 2 | 3;

export interface InvokeBindingGuardDiagnostic {
  /** Human-readable display name of the InvokeWorkflowFile activity. */
  invokeDisplayName: string;
  /** WorkflowFileName of the callee. */
  targetWorkflow: string;
  /** Original offending value preserved for traceability. */
  offendingValue: string;
  /** The key the emitter attempted to use, stringified. */
  attemptedKey: string;
  /** Reason the key was invalid. */
  reason: InvokeKeyInvalidReason | "contract-mismatch";
  /** Which step of the safety stack absorbed this binding. */
  step: GuardStep;
  /** Direction of the binding, for the manual-fix hint. */
  direction: "In" | "Out" | "InOut";
  /** Spec-declared name (if any) — used to record DHG-actionable intent. */
  specDeclaredName?: string | null;
}

export interface InvokeBindingGuardResult {
  /** Bindings the emitter should write into `<InvokeWorkflowFile.Arguments>`. */
  resolved: InvokeBindingResolved[];
  /** When true, the emitter must replace the entire InvokeWorkflowFile activity
   *  with a localized Comment + LogMessage handoff stub (Step 2). */
  requiresInvokeLevelDegradation: boolean;
  /** When true, no smallest-scope local degradation is viable (Step 3). */
  hardFail: boolean;
  /** Per-binding diagnostics emitted by this guard invocation. */
  diagnostics: InvokeBindingGuardDiagnostic[];
  /** Cause tag for any stub the emitter produces from this invocation. */
  stubCause: StubCause;
}

export interface InvokeBindingGuardContext {
  invokeDisplayName: string;
  targetWorkflow: string;
  contract: CalleeContractView | null;
  /** Optional callback invoked for each diagnostic so callers can persist it
   *  to their preferred channel (DHG, final_quality_report.diagnostics, etc.). */
  onDiagnostic?: (d: InvokeBindingGuardDiagnostic) => void;
}

interface ModuleDiagnosticsState {
  diagnostics: InvokeBindingGuardDiagnostic[];
  step3Count: number;
}

const _state: ModuleDiagnosticsState = { diagnostics: [], step3Count: 0 };

/** Test/observability accessor — returns a snapshot, never the live array. */
export function getInvokeKeyGuardDiagnostics(): {
  diagnostics: InvokeBindingGuardDiagnostic[];
  step3Count: number;
} {
  return {
    diagnostics: _state.diagnostics.slice(),
    step3Count: _state.step3Count,
  };
}

/** Reset module-level counters between runs/tests. */
export function resetInvokeKeyGuardDiagnostics(): void {
  _state.diagnostics.length = 0;
  _state.step3Count = 0;
}

function pushDiagnostic(
  d: InvokeBindingGuardDiagnostic,
  ctx: InvokeBindingGuardContext,
): void {
  _state.diagnostics.push(d);
  if (d.step === 3) _state.step3Count += 1;
  ctx.onDiagnostic?.(d);
  // Mirror to console with a stable prefix the regression suite can grep.
  console.warn(
    `[Invoke Key Guard] step=${d.step} reason=${d.reason} ` +
      `invoke="${d.invokeDisplayName}" callee="${d.targetWorkflow}" ` +
      `attemptedKey=${JSON.stringify(d.attemptedKey)} ` +
      `value=${JSON.stringify(d.offendingValue)}`,
  );
}

/**
 * Step-1 deterministic, non-guessing repair. Returns the recovered canonical
 * key (and provenance) if exactly one valid candidate exists; otherwise null.
 */
function deterministicRepair(
  binding: InvokeBindingInput,
  contract: CalleeContractView | null,
): { canonical: string; provenance: "spec-declared" | "contract-name-equality" } | null {
  // Priority 1: spec-declared name (the spec said which argument this targets).
  const specName = typeof binding.specDeclaredName === "string"
    ? binding.specDeclaredName.trim()
    : "";
  if (specName) {
    const specCheck = validateBindingKey(specName);
    if (specCheck.valid) {
      if (contract) {
        const m = validateAgainstContract(specCheck.normalized, contract);
        if (m.matched) {
          return { canonical: m.canonical, provenance: "spec-declared" };
        }
      } else {
        // No contract available: spec-declared name is sufficient on its own
        // because it represents authoritative caller intent.
        return { canonical: specCheck.normalized, provenance: "spec-declared" };
      }
    }
  }

  // Priority 2: name-equality match between source identifier and a single
  // declared callee argument. Only when EXACTLY ONE candidate exists.
  if (contract) {
    const sourceName = typeof binding.sourceIdentifier === "string"
      ? binding.sourceIdentifier.trim()
      : "";
    if (sourceName) {
      const sourceLower = sourceName.toLowerCase();
      const direct = contract.argumentNames.get(sourceLower);
      if (direct) return { canonical: direct, provenance: "contract-name-equality" };
    }
  }

  // Priority 3 (positional) is intentionally not implemented here: the strict
  // condition (spec carries explicit ordered list AND callee declares args in
  // the same canonical order in `<x:Members>`) is not knowable from the inputs
  // available to the generic emission path. Falling through to Step 2 is the
  // correct behavior per the safety-stack specification.
  return null;
}

/**
 * Main entry point. Validates each binding's key, attempts deterministic
 * repair, and decides whether the entire invoke must be locally degraded.
 *
 * The emitter MUST honor `requiresInvokeLevelDegradation` — when true it must
 * not write a partial Arguments block; instead, replace the InvokeWorkflowFile
 * activity with a Comment + LogMessage handoff stub and record the intent in
 * the DHG entry for that workflow. Surrounding control flow is preserved.
 */
export function applyInvokeBindingKeyGuard(
  bindings: readonly InvokeBindingInput[],
  ctx: InvokeBindingGuardContext,
): InvokeBindingGuardResult {
  const resolved: InvokeBindingResolved[] = [];
  const diagnostics: InvokeBindingGuardDiagnostic[] = [];
  let degrade = false;

  for (const binding of bindings) {
    const structural = validateBindingKey(binding.key);

    if (structural.valid) {
      // Structurally valid. If a contract is available, additionally validate
      // against the declared argument set (emission-time contract validation).
      if (ctx.contract) {
        const contractMatch = validateAgainstContract(structural.normalized, ctx.contract);
        if (contractMatch.matched) {
          resolved.push({
            key: contractMatch.canonical,
            direction: binding.direction,
            value: binding.value,
            repairedFromInvalidKey: false,
          });
          continue;
        }
        // Key is structurally valid but unknown to the callee. Try Step-1
        // repair before degrading (the structurally valid key may itself be a
        // misnamed alias the spec can recover from).
        const repaired = deterministicRepair(binding, ctx.contract);
        if (repaired) {
          resolved.push({
            key: repaired.canonical,
            direction: binding.direction,
            value: binding.value,
            repairedFromInvalidKey: true,
            repairProvenance: repaired.provenance,
          });
          const d: InvokeBindingGuardDiagnostic = {
            invokeDisplayName: ctx.invokeDisplayName,
            targetWorkflow: ctx.targetWorkflow,
            offendingValue: binding.value,
            attemptedKey: structural.normalized,
            reason: "contract-mismatch",
            step: 1,
            direction: binding.direction,
            specDeclaredName: binding.specDeclaredName ?? null,
          };
          diagnostics.push(d);
          pushDiagnostic(d, ctx);
          continue;
        }
        // Not repairable — invoke must be locally degraded. Do NOT silently
        // drop or dedupe.
        degrade = true;
        const d: InvokeBindingGuardDiagnostic = {
          invokeDisplayName: ctx.invokeDisplayName,
          targetWorkflow: ctx.targetWorkflow,
          offendingValue: binding.value,
          attemptedKey: structural.normalized,
          reason: "contract-mismatch",
          step: 2,
          direction: binding.direction,
          specDeclaredName: binding.specDeclaredName ?? null,
        };
        diagnostics.push(d);
        pushDiagnostic(d, ctx);
        continue;
      }
      // No contract — pass through.
      resolved.push({
        key: structural.normalized,
        direction: binding.direction,
        value: binding.value,
        repairedFromInvalidKey: false,
      });
      continue;
    }

    // Structurally invalid key (null/undefined/empty/whitespace/VB-keyword).
    const repaired = deterministicRepair(binding, ctx.contract);
    if (repaired) {
      resolved.push({
        key: repaired.canonical,
        direction: binding.direction,
        value: binding.value,
        repairedFromInvalidKey: true,
        repairProvenance: repaired.provenance,
      });
      const d: InvokeBindingGuardDiagnostic = {
        invokeDisplayName: ctx.invokeDisplayName,
        targetWorkflow: ctx.targetWorkflow,
        offendingValue: binding.value,
        attemptedKey: String(binding.key),
        reason: structural.reason,
        step: 1,
        direction: binding.direction,
        specDeclaredName: binding.specDeclaredName ?? null,
      };
      diagnostics.push(d);
      pushDiagnostic(d, ctx);
      continue;
    }

    // Step 1 failed → degrade the invoke (Step 2). Forbidden to drop/dedupe.
    degrade = true;
    const d: InvokeBindingGuardDiagnostic = {
      invokeDisplayName: ctx.invokeDisplayName,
      targetWorkflow: ctx.targetWorkflow,
      offendingValue: binding.value,
      attemptedKey: String(binding.key),
      reason: structural.reason,
      step: 2,
      direction: binding.direction,
      specDeclaredName: binding.specDeclaredName ?? null,
    };
    diagnostics.push(d);
    pushDiagnostic(d, ctx);
  }

  // Step-3 hard-fail decision. The smallest-scope local degradation
  // (Comment + LogMessage handoff at the activity level) is always viable
  // unless the invoke is itself the entry-point root activity of a workflow
  // — that case must be detected by the caller and signaled separately. From
  // this guard's vantage, the emitter can always insert a localized stub.
  return {
    resolved,
    requiresInvokeLevelDegradation: degrade,
    hardFail: false,
    diagnostics,
    stubCause: degrade ? "null-key-invoke" : "other",
  };
}

/**
 * Caller-side helper for emitting a Comment + LogMessage handoff stub when
 * Step 2 fires. Returns the XAML fragment that should replace the
 * `<ui:InvokeWorkflowFile>` element entirely.
 *
 * The DHG entry recording (intended callee, intended argument mapping,
 * offending values, exact manual fix) is the caller's responsibility — this
 * helper only produces the openable XAML.
 */
export function buildInvokeLevelHandoffStub(
  ctx: InvokeBindingGuardContext,
  diagnostics: InvokeBindingGuardDiagnostic[],
): string {
  const summary = diagnostics
    .map(d => `${d.direction}Argument key=${JSON.stringify(d.attemptedKey)} value=${JSON.stringify(d.offendingValue)} reason=${d.reason}`)
    .join("; ");
  const escapedSummary = summary
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const escapedTarget = ctx.targetWorkflow
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const escapedDisplay = ctx.invokeDisplayName
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return [
    `<Sequence DisplayName="HANDOFF: ${escapedDisplay}">`,
    `  <ui:Comment Text="HANDOFF (null-key-invoke): InvokeWorkflowFile to '${escapedTarget}' could not resolve binding key(s). ${escapedSummary}. Restore the InvokeWorkflowFile activity with the correct x:Key for each argument before deployment." />`,
    `  <ui:LogMessage DisplayName="Handoff log: ${escapedDisplay}" Level="[LogLevel.Warn]" Message="Handoff stub: invoke of '${escapedTarget}' was degraded — see DHG for required manual fix." />`,
    `</Sequence>`,
  ].join("\n");
}
