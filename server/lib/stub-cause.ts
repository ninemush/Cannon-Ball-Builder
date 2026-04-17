/**
 * Shared StubCause taxonomy — single source of truth for tasks #528, #529, #530.
 *
 * Any code path that emits a workflow-level or activity-level stub from a
 * known defect class MUST tag the stub with one of these literals so that
 * downstream policy (verdict assessment, regression assertions, DHG honesty
 * checks) can filter mechanically rather than parsing free-text messages.
 *
 * #529 introduces "todo-attribute". #530 will add "null-key-invoke" and may
 * extend the union further; #528 will add "verdict-policy" diagnostic source
 * markers via DiagnosticSource (below) but does not introduce new stub causes.
 *
 * IMPORTANT: do NOT redeclare or duplicate these literals elsewhere. Import
 * the type and constants from this module.
 */

export type StubCause =
  | "todo-attribute"
  | "null-key-invoke"
  | "pipeline-fallback-compliance-crash"
  | "other";

export const STUB_CAUSES: readonly StubCause[] = [
  "todo-attribute",
  "null-key-invoke",
  "pipeline-fallback-compliance-crash",
  "other",
] as const;

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
