/**
 * Task #541 — uipcli authority ledger, framework selection, defect routing,
 * and verdict reconciliation hierarchy.
 *
 * Authority model (see task-541.md):
 *   - Openability authority      = uipcli (pack outcome)
 *   - Packaging authority        = uipcli (when pack succeeds, its .nupkg ships)
 *   - Fidelity / degradation     = pipeline-native (FinalQualityReport)
 *
 * This module is the single source of truth for the seven-field run-record
 * "truth-source ledger" persisted on every run, the post-emission
 * capability-driven framework override, the three-bucket analyzer-defect
 * router, and the verdict reconciliation hierarchy.
 *
 * The Phase 1 authority switch is gated by a feature flag that defaults to
 * `shadow`. In `shadow`, the legacy buildNuGetPackage artifact and legacy
 * verdict derivation remain authoritative — the CLI-derived values are
 * computed and persisted alongside for comparison only. In `authoritative`,
 * the CLI-derived artifact and verdict become the production-truth values.
 */

import { existsSync, readFileSync } from "fs";
import { WINDOWS_ONLY_PACKAGES } from "./catalog/prompt-guidance-filter-constants";
import type {
  CliValidationMode,
  CliValidationResult,
  UiPathProjectType,
  CliAnalyzerDefect,
} from "./uipath-cli-validator";
import type { PackageStatus } from "./uipath-pipeline";

export type CliAuthorityMode = "shadow" | "authoritative";

export type PackArtifactSource = "uipcli" | "fallback_adm_zip";
export type OpenabilityTruthSource = "uipcli" | "fallback_heuristic";
export type FidelityTruthSource = "final_quality_report" | "fallback_heuristic";
export type FrameworkSelectionSource = "static_profile" | "post_emission_override";
export type CliRunnerType = "local_linux" | "remote_windows" | "none";

/**
 * Seven-field truth-source ledger persisted on every run record. Every field
 * is required; callers must supply explicit values rather than rely on
 * defaults so that the ledger is honest about which signal drove the verdict.
 */
export interface CliAuthorityLedger {
  packArtifactSource: PackArtifactSource;
  packFallbackReason?: string;
  openabilityTruthSource: OpenabilityTruthSource;
  fidelityTruthSource: FidelityTruthSource;
  frameworkSelectionSource: FrameworkSelectionSource;
  frameworkSelectionReason: string;
  cliRunnerType: CliRunnerType;
  runMode: CliAuthorityMode;
  // Task #541 — in shadow mode the CLI artifact is captured for forensic
  // comparison even though the legacy artifact ships. These fields make that
  // shadow capture observable.
  cliShadowArtifactSizeBytes?: number;
  cliShadowArtifactFileName?: string;
}

/**
 * Reads the rollout flag from the environment. Defaults to `shadow` so any
 * deployment without explicit opt-in keeps the legacy code paths as the
 * production-truth values.
 */
export function getCliAuthorityMode(): CliAuthorityMode {
  const raw = (process.env.UIPCLI_AUTHORITY_MODE || "shadow").toLowerCase();
  return raw === "authoritative" ? "authoritative" : "shadow";
}

// ---------------------------------------------------------------------------
// Capability-based framework selection (post-emission)
// ---------------------------------------------------------------------------

export interface FrameworkSelectionResult {
  source: FrameworkSelectionSource;
  reason: string;
  recommendedFramework: "Windows" | "Portable";
  blockingActivity?: string;
  blockingPackage?: string;
}

const PACKAGE_FROM_NS_PATTERN = /assembly=([A-Za-z0-9_.]+)/g;

/**
 * Inspects the activity set actually present in the emitted xaml entries and
 * recommends a target framework. When every emitted activity is outside
 * WINDOWS_ONLY_PACKAGES, recommends "Portable". When any emitted activity
 * is in that set, retains "Windows" and names the activity that forced the
 * choice.
 *
 * Important: this function never mutates upstream prompt-guidance or
 * schema-lookup behavior — it only informs the *final emitted* project.json.
 * The LLM still sees Windows activities when the upstream Studio profile is
 * Windows.
 */
export function evaluateFrameworkSelection(
  xamlEntries: { name: string; content: string }[],
  currentTargetFramework: string | undefined,
): FrameworkSelectionResult {
  const referencedAssemblies = new Set<string>();
  for (const entry of xamlEntries) {
    let match: RegExpExecArray | null;
    PACKAGE_FROM_NS_PATTERN.lastIndex = 0;
    while ((match = PACKAGE_FROM_NS_PATTERN.exec(entry.content)) !== null) {
      referencedAssemblies.add(match[1]);
    }
  }

  let blockingPackage: string | undefined;
  for (const pkg of referencedAssemblies) {
    if (WINDOWS_ONLY_PACKAGES.has(pkg)) {
      blockingPackage = pkg;
      break;
    }
  }

  if (currentTargetFramework !== "Windows" && currentTargetFramework !== "Portable") {
    return {
      source: "static_profile",
      reason: `static_profile target "${currentTargetFramework ?? "unset"}" retained — post-emission override only adjusts Windows<->Portable`,
      recommendedFramework: currentTargetFramework === "Portable" ? "Portable" : "Windows",
    };
  }

  if (blockingPackage) {
    if (currentTargetFramework === "Windows") {
      return {
        source: "static_profile",
        reason: `${blockingPackage} requires Windows; static_profile target "Windows" retained`,
        recommendedFramework: "Windows",
        blockingPackage,
      };
    }
    return {
      source: "post_emission_override",
      reason: `${blockingPackage} requires Windows; overriding static_profile target "${currentTargetFramework}" to "Windows"`,
      recommendedFramework: "Windows",
      blockingPackage,
    };
  }

  if (currentTargetFramework === "Windows") {
    return {
      source: "post_emission_override",
      reason: "all emitted activities CrossPlatform-compatible; overriding static_profile target \"Windows\" to \"Portable\"",
      recommendedFramework: "Portable",
    };
  }
  return {
    source: "static_profile",
    reason: "all emitted activities CrossPlatform-compatible; static_profile target \"Portable\" retained",
    recommendedFramework: "Portable",
  };
}

/**
 * Returns a project.json string with the recommended targetFramework. Idempotent.
 */
export function applyFrameworkOverride(
  projectJsonContent: string,
  recommendedFramework: "Windows" | "Portable",
): string {
  try {
    const pj = JSON.parse(projectJsonContent);
    if (pj.targetFramework === recommendedFramework) return projectJsonContent;
    pj.targetFramework = recommendedFramework;
    return JSON.stringify(pj, null, 2);
  } catch {
    return projectJsonContent;
  }
}

// ---------------------------------------------------------------------------
// Three-bucket analyzer-defect router
// ---------------------------------------------------------------------------

/**
 * Rules whose presence in CLI analyzer Errors makes the package not openable
 * in Studio in practice, even if the CLI pack step itself succeeded.
 *
 * Membership is closed and reviewable rule-by-rule. Adding a rule requires
 * explicit written justification in the PR per the task contract — this is
 * the rare bucket reserved for terminal failures that demand a loud build
 * failure rather than a TODO. Empty by default; populated only with proven
 * openability blockers.
 */
export const OPENABILITY_BLOCKING_CLI_RULES = new Set<string>([
  // Intentionally empty at task-541 landing. Future additions require a PR
  // amending this set with written justification per task contract.
]);

export interface RoutedCliDefect {
  ruleId: string;
  severity: "Error" | "Warning" | "Info";
  file: string;
  line?: number;
  message: string;
}

export interface CliDefectRouting {
  mapped_to_iterative_corrector: RoutedCliDefect[];
  surfaced_as_localized_dhg_todo: RoutedCliDefect[];
  blocking_cli_error: RoutedCliDefect[];
  unmappedRuleIds: string[];
  perBucketCounts: {
    mapped: number;
    surfaced: number;
    blocking: number;
  };
}

/**
 * Routes every CLI analyzer Error-severity defect into exactly one of three
 * buckets. The default for unknown ruleIds is `surfaced_as_localized_dhg_todo`,
 * never silent demotion and never `blocking_cli_error`.
 *
 * Warning/Info severity defects are not routed here — they are diagnostic-only
 * and surfaced through the existing pipelineWarnings channel.
 */
export function routeCliErrorDefectsThreeBucket(
  defects: CliAnalyzerDefect[],
  fixableRuleIds: ReadonlySet<string>,
): CliDefectRouting {
  const mapped: RoutedCliDefect[] = [];
  const surfaced: RoutedCliDefect[] = [];
  const blocking: RoutedCliDefect[] = [];
  const unmapped = new Set<string>();

  for (const d of defects) {
    if (d.severity !== "Error") continue;
    const routed: RoutedCliDefect = {
      ruleId: d.ruleId,
      severity: d.severity,
      file: d.file,
      line: d.line,
      message: d.message,
    };
    if (fixableRuleIds.has(d.ruleId)) {
      mapped.push(routed);
    } else if (OPENABILITY_BLOCKING_CLI_RULES.has(d.ruleId)) {
      blocking.push(routed);
    } else {
      surfaced.push(routed);
      unmapped.add(d.ruleId);
    }
  }

  return {
    mapped_to_iterative_corrector: mapped,
    surfaced_as_localized_dhg_todo: surfaced,
    blocking_cli_error: blocking,
    unmappedRuleIds: Array.from(unmapped).sort(),
    perBucketCounts: {
      mapped: mapped.length,
      surfaced: surfaced.length,
      blocking: blocking.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Verdict reconciliation hierarchy
// ---------------------------------------------------------------------------

export interface VerdictReconciliationInputs {
  cliRan: boolean;
  cliPackSuccess?: boolean;
  cliAnalyzerErrorCount: number;
  cliRoutingHadOpenabilityBlocking: boolean;
  finalQualityReportStatus?: PackageStatus;
  artifactIntegrityFailureReason?: string;
  hasNupkg: boolean;
  entryPointStubbed: boolean;
  hasStructuralBlockers: boolean;
}

export interface VerdictReconciliationResult {
  status: PackageStatus;
  openabilityTruthSource: OpenabilityTruthSource;
  fidelityTruthSource: FidelityTruthSource;
  reason: string;
}

/**
 * Implements the five-step verdict reconciliation hierarchy from task-541
 * "Done looks like → Verdict reconciliation hierarchy".
 *
 *   1. CLI pack failure is terminal for openability.
 *   2. CLI pack success establishes openability.
 *   3. finalQualityReport may downgrade studio_stable → openable_with_warnings
 *      / handoff_only on the success path; may only override openability via
 *      explicitly-enumerated artifact-integrity facts.
 *   4. Status mapping for CLI-authoritative openability — including the
 *      blocking_cli_error rule that downgrades at least to
 *      openable_with_warnings on a successful pack.
 *   5. Fallback heuristic only when CLI did not run or produced no usable
 *      result.
 */
export function reconcileVerdict(input: VerdictReconciliationInputs): VerdictReconciliationResult {
  // (5) Fallback path — CLI did not run or produced no usable result.
  if (!input.cliRan || input.cliPackSuccess === undefined) {
    if (input.finalQualityReportStatus) {
      return {
        status: input.finalQualityReportStatus,
        openabilityTruthSource: "fallback_heuristic",
        fidelityTruthSource: "final_quality_report",
        reason: "CLI did not run; openability inferred from fallback heuristic, fidelity from final_quality_report",
      };
    }
    if (!input.hasNupkg || input.entryPointStubbed || input.hasStructuralBlockers) {
      return {
        status: "structurally_invalid",
        openabilityTruthSource: "fallback_heuristic",
        fidelityTruthSource: "fallback_heuristic",
        reason: "CLI did not run; fallback heuristic flagged structural invalidity",
      };
    }
    return {
      status: "handoff_only",
      openabilityTruthSource: "fallback_heuristic",
      fidelityTruthSource: "fallback_heuristic",
      reason: "CLI did not run; fallback heuristic capped status at handoff_only",
    };
  }

  // (1) CLI pack failure is terminal for openability.
  if (input.cliPackSuccess === false) {
    return {
      status: "structurally_invalid",
      openabilityTruthSource: "uipcli",
      fidelityTruthSource: input.finalQualityReportStatus ? "final_quality_report" : "fallback_heuristic",
      reason: "uipcli pack failed — openability blocked",
    };
  }

  // (3) Artifact-integrity exception: closed list. May override pack-success openability.
  if (input.artifactIntegrityFailureReason) {
    return {
      status: "structurally_invalid",
      openabilityTruthSource: "uipcli",
      fidelityTruthSource: input.finalQualityReportStatus ? "final_quality_report" : "fallback_heuristic",
      reason: `uipcli pack succeeded but artifact integrity failed: ${input.artifactIntegrityFailureReason}`,
    };
  }

  // (4) Status mapping when CLI is authoritative for openability.
  const fqrStatus = input.finalQualityReportStatus;
  const fqrDowngradesToHandoff = fqrStatus === "handoff_only";
  const fqrDowngradesToWarnings = fqrStatus === "openable_with_warnings";
  const fqrClaimsStructurallyInvalid = fqrStatus === "structurally_invalid";

  if (input.cliRoutingHadOpenabilityBlocking) {
    return {
      status: "structurally_invalid",
      openabilityTruthSource: "uipcli",
      fidelityTruthSource: fqrStatus ? "final_quality_report" : "fallback_heuristic",
      reason: "uipcli pack succeeded but openability-blocking analyzer rule fired",
    };
  }

  if (fqrDowngradesToHandoff) {
    return {
      status: "handoff_only",
      openabilityTruthSource: "uipcli",
      fidelityTruthSource: "final_quality_report",
      reason: "uipcli pack succeeded; final_quality_report downgrades fidelity to handoff_only",
    };
  }

  if (fqrDowngradesToWarnings || input.cliAnalyzerErrorCount > 0) {
    return {
      status: "openable_with_warnings",
      openabilityTruthSource: "uipcli",
      fidelityTruthSource: fqrStatus ? "final_quality_report" : "fallback_heuristic",
      reason: input.cliAnalyzerErrorCount > 0
        ? `uipcli pack succeeded with ${input.cliAnalyzerErrorCount} analyzer Error(s)`
        : "uipcli pack succeeded; final_quality_report downgrades fidelity to openable_with_warnings",
    };
  }

  if (fqrClaimsStructurallyInvalid) {
    // FQR cannot override openability on a successful CLI pack except via the
    // closed integrity list above. Honor its fidelity downgrade by capping at
    // handoff_only — the lowest non-openability-overriding fidelity verdict.
    return {
      status: "handoff_only",
      openabilityTruthSource: "uipcli",
      fidelityTruthSource: "final_quality_report",
      reason: "uipcli pack succeeded; final_quality_report would have flagged structurally_invalid but pack-success openability prevails — capped at handoff_only",
    };
  }

  return {
    status: "studio_stable",
    openabilityTruthSource: "uipcli",
    fidelityTruthSource: fqrStatus ? "final_quality_report" : "fallback_heuristic",
    reason: "uipcli pack succeeded; no analyzer Errors; no fidelity downgrade",
  };
}

// ---------------------------------------------------------------------------
// CLI-produced .nupkg → shipped artifact (authoritative mode only)
// ---------------------------------------------------------------------------

export interface CliArtifactReadResult {
  buffer?: Buffer;
  source: PackArtifactSource;
  fallbackReason?: string;
  integrityFailureReason?: string;
}

/**
 * Returns the .nupkg buffer to ship for this run. In authoritative mode, when
 * the CLI pack succeeded and produced an output path on disk, the CLI artifact
 * is returned. In all other cases — shadow mode, CLI skipped, CLI failed,
 * missing output path, missing file on disk — the fallback adm-zip buffer is
 * returned with a named reason.
 *
 * The integrity facts (missing file at expected path, unusable output
 * metadata) are surfaced as `integrityFailureReason` so the verdict
 * reconciliation hierarchy can apply the closed artifact-integrity exception.
 */
export function selectShippedArtifact(
  authorityMode: CliAuthorityMode,
  cliResult: CliValidationResult | undefined,
  fallbackBuffer: Buffer,
): CliArtifactReadResult {
  if (authorityMode !== "authoritative") {
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "shadow_mode_active",
    };
  }
  if (!cliResult) {
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "cli_unavailable",
    };
  }
  if (cliResult.mode === "cli_skipped_incompatible_agent") {
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "cli_skipped_incompatible_agent",
    };
  }
  if (cliResult.mode === "custom_validated_only") {
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "cli_unavailable",
    };
  }
  if (!cliResult.packResult || !cliResult.packResult.success) {
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "cli_failed",
    };
  }
  // Task #541 — prefer the in-memory buffer captured by runCliPack BEFORE the
  // temp output dir was cleaned up. Disk-path fallback exists only for paths
  // where the buffer wasn't captured (e.g. older CLI integrations).
  const inMemoryBuffer = cliResult.packResult.nupkgBuffer;
  if (inMemoryBuffer && inMemoryBuffer.length > 0) {
    return {
      buffer: inMemoryBuffer,
      source: "uipcli",
    };
  }
  const outputPath = cliResult.packResult.outputPath;
  if (!outputPath) {
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "cli_pack_returned_no_output_path",
      integrityFailureReason: "pack reported success but returned no outputPath and no in-memory buffer",
    };
  }
  if (!existsSync(outputPath)) {
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "cli_pack_artifact_missing_on_disk",
      integrityFailureReason: `CLI-produced artifact missing at expected path and no in-memory buffer captured: ${outputPath}`,
    };
  }
  try {
    const buf = readFileSync(outputPath);
    return {
      buffer: buf,
      source: "uipcli",
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      buffer: fallbackBuffer,
      source: "fallback_adm_zip",
      fallbackReason: "cli_pack_artifact_read_failed",
      integrityFailureReason: `CLI artifact unreadable: ${errMsg}`,
    };
  }
}

/**
 * Determines the runner topology for ledger reporting.
 */
export function detectCliRunnerType(cliResult: CliValidationResult | undefined): CliRunnerType {
  if (!cliResult) return "none";
  if (cliResult.mode === "cli_skipped_incompatible_agent" || cliResult.mode === "custom_validated_only") {
    return "none";
  }
  return cliResult.compatibility.currentRunner === "windows" ? "remote_windows" : "local_linux";
}

/**
 * Convenience accessor for tests: whether the analyzer Error count includes
 * any rule explicitly tagged as openability-blocking.
 */
export function hasOpenabilityBlockingError(routing: CliDefectRouting): boolean {
  return routing.blocking_cli_error.length > 0;
}

// Re-export for downstream consumers that don't want to import CliValidator types directly.
export type { CliValidationMode, UiPathProjectType };
