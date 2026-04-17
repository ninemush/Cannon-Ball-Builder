/**
 * Shared `StubCause` taxonomy — single source of truth for tasks #528, #529, #530.
 *
 * Any code path that emits a workflow-level or activity-level stub or
 * localized degradation from a known defect class MUST tag the stub with one
 * of these literals so that downstream policy (verdict assessment, regression
 * assertions, DHG honesty checks) can filter mechanically rather than parsing
 * free-text messages.
 *
 * Tag semantics:
 * - "todo-attribute": stub or degradation produced because a TODO placeholder
 *   crashed compliance / structural validation (covered by #529).
 * - "null-key-invoke": stub or degradation produced by the null/unresolved
 *   invoke-binding-key safety stack (#530).
 * - "pipeline-fallback-compliance-crash": pipeline-injected safe placeholder
 *   that itself failed downstream compliance — kept distinct so verdict logic
 *   does not double-count pipeline-fallback origins.
 * - "other": any cause not yet classified by the three above. New causes
 *   should be added explicitly to the union rather than collapsed here.
 *
 * IMPORTANT: do NOT redeclare or duplicate these literals elsewhere. Import
 * the type and constants from this module.
 */
export type StubCause =
  | "todo-attribute"
  | "null-key-invoke"
  | "pipeline-fallback-compliance-crash"
  | "other";

export const STUB_CAUSE_VALUES: readonly StubCause[] = [
  "todo-attribute",
  "null-key-invoke",
  "pipeline-fallback-compliance-crash",
  "other",
] as const;

/** Backwards-compatible alias retained for callers that imported the older name. */
export const STUB_CAUSES: readonly StubCause[] = STUB_CAUSE_VALUES;

export function isStubCause(v: unknown): v is StubCause {
  return typeof v === "string" && (STUB_CAUSE_VALUES as readonly string[]).includes(v);
}

/**
 * DiagnosticSource — origin marker for entries in the shared
 * `final_quality_report.diagnostics` collection. Each task writes to the
 * same collection but tags entries with its own source so consumers can
 * filter by task without parsing prose.
 */
export type DiagnosticSource =
  | "todo-attribute-guard"
  | "null-key-invoke-repair"
  | "verdict-policy"
  | "other";
