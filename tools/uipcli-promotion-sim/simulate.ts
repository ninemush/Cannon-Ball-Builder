/**
 * uipcli promotion simulator (#545).
 *
 * Read-only. Given the per-run inputs the pipeline already produced under the
 * legacy code path, compute what #541 Phase 1 would have done and emit the five
 * delta sections plus a regression-risk classification.
 *
 * Imports rule-mapping constants from the production codebase so simulated
 * routing stays in sync. Does not touch any production write path.
 */

import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import AdmZip from "adm-zip";
import { CLI_RULE_TO_CHECK, CLI_FIXABLE_RULE_IDS } from "../../server/meta-validation/iterative-llm-corrector";

// ---------------------------------------------------------------------------
// Simulator inputs
// ---------------------------------------------------------------------------

export type LegacyPackageStatus =
  | "studio_stable"
  | "openable_with_warnings"
  | "handoff_only"
  | "structurally_invalid";

export interface LegacyCliAnalyzerDefect {
  ruleId: string;
  severity: "Error" | "Warning" | "Info";
  file: string;
  line?: number;
  message: string;
}

export interface LegacyCliPackResult {
  success: boolean;
  outputPath?: string;
  errors?: string[];
  /** sha256 of the CLI-produced .nupkg bytes if available; required for byte-diff. */
  artifactSha256?: string;
  /** byte size of the CLI-produced .nupkg if available. */
  artifactBytes?: number;
}

export interface LegacyCliValidation {
  mode:
    | "custom_validated_only"
    | "cli_validated"
    | "cli_skipped_incompatible_agent"
    | "cli_failed";
  projectType?: "CrossPlatform" | "Windows" | "WindowsLegacy";
  analyzeResult?: {
    success: boolean;
    defects: LegacyCliAnalyzerDefect[];
  };
  packResult?: LegacyCliPackResult;
}

export interface LegacyStudioCompat {
  file: string;
  level: "studio-stable" | "studio-warnings" | "studio-blocked";
  blockers: string[];
}

export interface LegacyShippedArtifact {
  /** sha256 of the actually shipped .nupkg (built by buildNuGetPackage today). */
  sha256?: string;
  bytes?: number;
  fileList?: string[];
  /**
   * Absolute path to the shipped .nupkg on disk. When set, the simulator will
   * load and zip-diff it against the CLI-produced .nupkg (also from disk via
   * `LegacyCliPackResult.outputPath`).
   */
  filePath?: string;
  /** Raw buffer of the shipped .nupkg (alternative to filePath). */
  buffer?: Buffer;
}

export interface LegacyFinalQualityReport {
  derivedStatus?: LegacyPackageStatus;
  statusReason?: string;
}

export interface SimulatorRunInput {
  runId: string;
  specId?: string;
  declaredTargetFramework?: "Windows" | "Portable" | "Legacy" | string;
  actualStatus: LegacyPackageStatus | "failed" | string;
  cliValidation?: LegacyCliValidation;
  shippedArtifact?: LegacyShippedArtifact;
  studioCompatibility?: LegacyStudioCompat[];
  finalQualityReport?: LegacyFinalQualityReport;
  /** Free-form notes (e.g. "CLI data not persisted; replay would be required."). */
  notes?: string[];
}

// ---------------------------------------------------------------------------
// Three-bucket router for analyzer Errors under #541's invariant
// ---------------------------------------------------------------------------

/**
 * Closed list of rules that, under #541, are explicitly tagged
 * `blocking_cli_error`. The plan requires this set to be small, reviewable, and
 * justified rule-by-rule. Today none are tagged; an unknown Error rule defaults
 * to `surfaced_as_localized_dhg_todo`.
 */
export const BLOCKING_CLI_ERROR_RULE_IDS: ReadonlySet<string> = new Set<string>([
  // intentionally empty — the plan defaults unknown Errors to localized TODO
]);

export type RoutingBucket =
  | "mapped_to_iterative_corrector"
  | "surfaced_as_localized_dhg_todo"
  | "blocking_cli_error";

export function classifyAnalyzerError(ruleId: string): RoutingBucket {
  if (BLOCKING_CLI_ERROR_RULE_IDS.has(ruleId)) return "blocking_cli_error";
  if (CLI_FIXABLE_RULE_IDS.has(ruleId)) return "mapped_to_iterative_corrector";
  return "surfaced_as_localized_dhg_todo";
}

// ---------------------------------------------------------------------------
// Section 1 — Verdict delta (per #541 hierarchy)
// ---------------------------------------------------------------------------

export interface VerdictDelta {
  actualStatus: string;
  simulatedStatus: LegacyPackageStatus;
  /** True only when the run had real CLI execution data driving the simulated verdict. */
  simulatable: boolean;
  agree: boolean;
  reason: string;
  openabilityTruthSource: "uipcli" | "fallback_heuristic" | "n/a";
  fidelityTruthSource: "final_quality_report" | "fallback_heuristic" | "n/a";
}

function hasUsableCliSignals(cli: LegacyCliValidation | undefined): boolean {
  if (!cli) return false;
  if (cli.mode !== "cli_validated" && cli.mode !== "cli_failed") return false;
  // Need at least one of: a pack result OR an analyze result to differ from
  // the legacy heuristic. Without either, #541 has no CLI-grounded signal.
  return !!cli.packResult || (cli.analyzeResult?.defects?.length ?? 0) > 0;
}

function simulateVerdict(input: SimulatorRunInput): VerdictDelta {
  const cli = input.cliValidation;

  if (!hasUsableCliSignals(cli)) {
    // CLI did not produce a usable verdict: #541 explicitly falls back to the
    // existing legacy heuristic for these runs, so the simulated status is
    // identical to the actual status by construction. agree=true (no
    // disagreement noise), simulatable=false (this run carries no CLI-grounded
    // evidence and must not count toward simulatable totals).
    return {
      actualStatus: input.actualStatus,
      simulatedStatus: input.actualStatus as LegacyPackageStatus,
      simulatable: false,
      agree: true,
      reason: `CLI did not produce usable signals (mode=${cli?.mode ?? "absent"}); #541 falls back to legacy heuristic — simulated verdict is identical to actual by definition. Run is not counted toward simulatable totals.`,
      openabilityTruthSource: "fallback_heuristic",
      fidelityTruthSource: input.finalQualityReport ? "final_quality_report" : "fallback_heuristic",
    };
  }

  const packSuccess = cli.packResult?.success === true;
  const errorCount = (cli.analyzeResult?.defects ?? []).filter(d => d.severity === "Error").length;

  if (!packSuccess) {
    return {
      actualStatus: input.actualStatus,
      simulatedStatus: "structurally_invalid",
      agree: input.actualStatus === "structurally_invalid",
      reason: "CLI pack failed → terminal structurally_invalid (overrides finalQualityReport).",
      openabilityTruthSource: "uipcli",
      fidelityTruthSource: input.finalQualityReport ? "final_quality_report" : "n/a",
    };
  }

  // CLI pack succeeded → at least openable. Apply finalQualityReport downgrades on the success path.
  const fqrStatus = input.finalQualityReport?.derivedStatus;
  let simulated: LegacyPackageStatus;

  // Check for openability-blocking analyzer Errors (closed list — currently empty).
  const hasOpenabilityBlockingError = (cli.analyzeResult?.defects ?? [])
    .filter(d => d.severity === "Error")
    .some(d => BLOCKING_CLI_ERROR_RULE_IDS.has(d.ruleId));

  if (hasOpenabilityBlockingError) {
    simulated = "structurally_invalid";
  } else if (fqrStatus === "handoff_only") {
    simulated = "handoff_only";
  } else if (fqrStatus === "openable_with_warnings" || errorCount > 0) {
    simulated = "openable_with_warnings";
  } else if (fqrStatus === "structurally_invalid") {
    // Per #541: finalQualityReport may NOT claim structurally_invalid against a
    // successful CLI pack except in the closed artifact-integrity exception
    // list. We don't have those signals available without replay, so respect
    // CLI authority and downgrade to handoff_only as the safest visible signal.
    simulated = "handoff_only";
  } else {
    simulated = "studio_stable";
  }

  return {
    actualStatus: input.actualStatus,
    simulatedStatus: simulated,
    agree: input.actualStatus === simulated,
    reason: `CLI pack succeeded; analyzer Errors=${errorCount}; finalQualityReport=${fqrStatus ?? "n/a"} → ${simulated}.`,
    openabilityTruthSource: "uipcli",
    fidelityTruthSource: input.finalQualityReport ? "final_quality_report" : "n/a",
  };
}

// ---------------------------------------------------------------------------
// Section 2 — Shipped artifact delta
// ---------------------------------------------------------------------------

export interface ArchiveEntryDiff {
  name: string;
  status: "only_in_shipped" | "only_in_cli" | "content_differs" | "identical";
  shippedSha256?: string;
  cliSha256?: string;
  shippedSize?: number;
  cliSize?: number;
}

export interface ArtifactDelta {
  packArtifactSourceLegacy: "fallback_adm_zip";
  packArtifactSourceSimulated: "uipcli" | "fallback_adm_zip";
  packFallbackReason?: string;
  shippedSha256?: string;
  cliSha256?: string;
  shippedSize?: number;
  cliSize?: number;
  bytesIdentical?: boolean;
  comparable: boolean;
  /** Per-entry diff when both archives are loadable; empty when not. */
  entryDiff: ArchiveEntryDiff[];
  diffSummary?: {
    onlyInShipped: number;
    onlyInCli: number;
    contentDiffers: number;
    identical: number;
  };
  notes: string;
}

function loadNupkgBuffer(
  filePath: string | undefined,
  buffer: Buffer | undefined,
): Buffer | undefined {
  if (buffer) return buffer;
  if (filePath && existsSync(filePath)) {
    try {
      return readFileSync(filePath);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function sha256(b: Buffer): string {
  return createHash("sha256").update(b).digest("hex");
}

function indexEntries(buf: Buffer): Map<string, { sha: string; size: number }> | undefined {
  try {
    const zip = new AdmZip(buf);
    const map = new Map<string, { sha: string; size: number }>();
    for (const e of zip.getEntries()) {
      if (e.isDirectory) continue;
      const data = e.getData();
      map.set(e.entryName, { sha: sha256(data), size: data.length });
    }
    return map;
  } catch {
    return undefined;
  }
}

function diffArchives(
  shipped: Map<string, { sha: string; size: number }>,
  cli: Map<string, { sha: string; size: number }>,
): ArchiveEntryDiff[] {
  const all = new Set<string>([...shipped.keys(), ...cli.keys()]);
  const diff: ArchiveEntryDiff[] = [];
  for (const name of all) {
    const s = shipped.get(name);
    const c = cli.get(name);
    if (s && !c) diff.push({ name, status: "only_in_shipped", shippedSha256: s.sha, shippedSize: s.size });
    else if (!s && c) diff.push({ name, status: "only_in_cli", cliSha256: c.sha, cliSize: c.size });
    else if (s && c && s.sha !== c.sha)
      diff.push({
        name,
        status: "content_differs",
        shippedSha256: s.sha,
        cliSha256: c.sha,
        shippedSize: s.size,
        cliSize: c.size,
      });
    else if (s && c)
      diff.push({
        name,
        status: "identical",
        shippedSha256: s.sha,
        cliSha256: c.sha,
        shippedSize: s.size,
        cliSize: c.size,
      });
  }
  return diff.sort((a, b) => a.name.localeCompare(b.name));
}

function summarizeEntryDiff(entries: ArchiveEntryDiff[]) {
  return {
    onlyInShipped: entries.filter(e => e.status === "only_in_shipped").length,
    onlyInCli: entries.filter(e => e.status === "only_in_cli").length,
    contentDiffers: entries.filter(e => e.status === "content_differs").length,
    identical: entries.filter(e => e.status === "identical").length,
  };
}

function simulateArtifactDelta(input: SimulatorRunInput): ArtifactDelta {
  const cli = input.cliValidation;
  const cliPackSuccess = cli?.packResult?.success === true;

  if (!cliPackSuccess) {
    return {
      packArtifactSourceLegacy: "fallback_adm_zip",
      packArtifactSourceSimulated: "fallback_adm_zip",
      packFallbackReason: cli?.mode ?? "cli_unavailable",
      comparable: false,
      entryDiff: [],
      notes: "Simulated #541 would also use the hand-rolled packer; both runs ship the same artifact.",
    };
  }

  // Try to load both archives from disk/buffer for archive-level diff.
  const shippedBuf = loadNupkgBuffer(input.shippedArtifact?.filePath, input.shippedArtifact?.buffer);
  const cliBuf = loadNupkgBuffer(cli?.packResult?.outputPath, undefined);

  const shippedSha = shippedBuf ? sha256(shippedBuf) : input.shippedArtifact?.sha256;
  const cliSha = cliBuf ? sha256(cliBuf) : cli?.packResult?.artifactSha256;
  const comparable = !!shippedBuf && !!cliBuf;

  let entryDiff: ArchiveEntryDiff[] = [];
  let diffSummary: ArtifactDelta["diffSummary"];
  let notes: string;

  if (comparable) {
    const shippedIdx = indexEntries(shippedBuf!);
    const cliIdx = indexEntries(cliBuf!);
    if (shippedIdx && cliIdx) {
      entryDiff = diffArchives(shippedIdx, cliIdx);
      diffSummary = summarizeEntryDiff(entryDiff);
      notes = `Archive-level diff performed: ${diffSummary.identical} identical, ${diffSummary.contentDiffers} content-differs, ${diffSummary.onlyInShipped} only-in-shipped, ${diffSummary.onlyInCli} only-in-cli.`;
    } else {
      notes = "Archives loaded but failed to parse as zip; falling back to whole-file sha256.";
    }
  } else if (shippedSha && cliSha) {
    notes = "Whole-file sha256 comparison only (archives not loaded for entry-level diff).";
  } else {
    notes =
      "Archive paths not provided. To enable archive-level diff, set `shippedArtifact.filePath`/`buffer` and `cliValidation.packResult.outputPath` on the run input. Today neither is persisted by the pipeline; supply them via a verification-bundle loader or a future artifact-persistence change.";
  }

  return {
    packArtifactSourceLegacy: "fallback_adm_zip",
    packArtifactSourceSimulated: "uipcli",
    cliSha256: cliSha,
    shippedSha256: shippedSha,
    cliSize: cliBuf?.length,
    shippedSize: shippedBuf?.length,
    bytesIdentical: shippedSha && cliSha ? shippedSha === cliSha : undefined,
    comparable,
    entryDiff,
    diffSummary,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Section 3 — Analyzer Error routing delta
// ---------------------------------------------------------------------------

export interface RoutingDeltaEntry {
  ruleId: string;
  file: string;
  line?: number;
  message: string;
  legacyRouting:
    | "iterative_corrector_via_CLI_RULE_TO_CHECK"
    | "demoted_to_CLI_DIAGNOSTIC_warning";
  simulatedBucket: RoutingBucket;
  changed: boolean;
  flagsBlockingCliError: boolean;
}

function simulateRoutingDelta(input: SimulatorRunInput): RoutingDeltaEntry[] {
  const defects = input.cliValidation?.analyzeResult?.defects ?? [];
  return defects
    .filter(d => d.severity === "Error")
    .map(d => {
      const legacyRouting = CLI_FIXABLE_RULE_IDS.has(d.ruleId)
        ? "iterative_corrector_via_CLI_RULE_TO_CHECK"
        : ("demoted_to_CLI_DIAGNOSTIC_warning" as const);
      const simulatedBucket = classifyAnalyzerError(d.ruleId);
      const changed =
        (legacyRouting === "iterative_corrector_via_CLI_RULE_TO_CHECK" &&
          simulatedBucket !== "mapped_to_iterative_corrector") ||
        (legacyRouting === "demoted_to_CLI_DIAGNOSTIC_warning" &&
          simulatedBucket !== "surfaced_as_localized_dhg_todo");
      return {
        ruleId: d.ruleId,
        file: d.file,
        line: d.line,
        message: d.message,
        legacyRouting,
        simulatedBucket,
        changed,
        flagsBlockingCliError: simulatedBucket === "blocking_cli_error",
      };
    });
}

// ---------------------------------------------------------------------------
// Section 4 — DHG Studio Compatibility delta
// ---------------------------------------------------------------------------

export interface StudioCompatDeltaEntry {
  file: string;
  legacyLevel: "studio-stable" | "studio-warnings" | "studio-blocked" | "unknown";
  simulatedLevel: "studio-stable" | "studio-warnings" | "studio-blocked" | "cli-skipped";
  changed: boolean;
}

function simulateStudioCompatDelta(input: SimulatorRunInput): StudioCompatDeltaEntry[] {
  const defects = input.cliValidation?.analyzeResult?.defects ?? [];
  const cliRan =
    input.cliValidation?.mode === "cli_validated" || input.cliValidation?.mode === "cli_failed";

  const filesSeen = new Set<string>();
  for (const sc of input.studioCompatibility ?? []) filesSeen.add(sc.file);
  for (const d of defects) if (d.file) filesSeen.add(d.file);

  const out: StudioCompatDeltaEntry[] = [];
  for (const file of filesSeen) {
    const legacy = (input.studioCompatibility ?? []).find(s => s.file === file);
    const legacyLevel = (legacy?.level ?? "unknown") as StudioCompatDeltaEntry["legacyLevel"];

    if (!cliRan) {
      out.push({ file, legacyLevel, simulatedLevel: "cli-skipped", changed: legacyLevel !== "unknown" });
      continue;
    }

    const fileDefects = defects.filter(d => d.file === file);
    const hasError = fileDefects.some(d => d.severity === "Error");
    const hasWarning = fileDefects.some(d => d.severity === "Warning");
    const simulatedLevel: StudioCompatDeltaEntry["simulatedLevel"] = hasError
      ? "studio-blocked"
      : hasWarning
      ? "studio-warnings"
      : "studio-stable";

    out.push({ file, legacyLevel, simulatedLevel, changed: legacyLevel !== simulatedLevel });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Section 5 — Regression-risk classification
// ---------------------------------------------------------------------------

export type RiskClass = "safe" | "expected_churn" | "regression_risk";

export interface RiskItem {
  area: "verdict" | "artifact" | "routing" | "studio_compat";
  summary: string;
  classification: RiskClass;
  proposedMitigation?: string;
}

const STATUS_RANK: Record<string, number> = {
  studio_stable: 3,
  openable_with_warnings: 2,
  handoff_only: 1,
  structurally_invalid: 0,
  failed: -1,
};

function classifyRisks(
  verdict: VerdictDelta,
  artifact: ArtifactDelta,
  routing: RoutingDeltaEntry[],
  studioCompat: StudioCompatDeltaEntry[],
): RiskItem[] {
  const out: RiskItem[] = [];

  if (verdict.simulatable && !verdict.agree) {
    const actualRank = STATUS_RANK[verdict.actualStatus] ?? 0;
    const simRank = STATUS_RANK[verdict.simulatedStatus] ?? 0;
    if (simRank < actualRank) {
      out.push({
        area: "verdict",
        summary: `Verdict would downgrade ${verdict.actualStatus} → ${verdict.simulatedStatus}.`,
        classification: "regression_risk",
        proposedMitigation:
          "Confirm CLI authority is correct here; if false-positive, narrow blocking_cli_error membership or expand CLI_RULE_TO_CHECK to auto-fix the offending rule.",
      });
    } else {
      out.push({
        area: "verdict",
        summary: `Verdict would upgrade ${verdict.actualStatus} → ${verdict.simulatedStatus}; CLI sees the package as more openable than the legacy heuristic.`,
        classification: "safe",
      });
    }
  }

  if (artifact.comparable && artifact.bytesIdentical === false) {
    out.push({
      area: "artifact",
      summary: "Shipped artifact would change bytes (CLI-produced vs. hand-rolled).",
      classification: "expected_churn",
      proposedMitigation: "No mitigation required; #541 explicitly establishes CLI as packaging authority.",
    });
  }

  for (const r of routing) {
    if (r.flagsBlockingCliError) {
      out.push({
        area: "routing",
        summary: `Analyzer rule ${r.ruleId} would land in blocking_cli_error (file=${r.file}).`,
        classification: "regression_risk",
        proposedMitigation:
          "Either expand CLI_RULE_TO_CHECK to give this rule an auto-fix mapping, or confirm the rule deserves loud-failure treatment (PR-amend BLOCKING_CLI_ERROR_RULE_IDS with written justification).",
      });
    } else if (r.changed && r.simulatedBucket === "surfaced_as_localized_dhg_todo") {
      out.push({
        area: "routing",
        summary: `Analyzer rule ${r.ruleId} (currently demoted to CLI_DIAGNOSTIC warning) would surface as a localized DHG TODO.`,
        classification: "safe",
      });
    }
  }

  for (const s of studioCompat) {
    if (!s.changed) continue;
    if (s.simulatedLevel === "studio-blocked" && s.legacyLevel !== "studio-blocked") {
      out.push({
        area: "studio_compat",
        summary: `Workflow ${s.file} would be reclassified ${s.legacyLevel} → studio-blocked by CLI defects.`,
        classification: "regression_risk",
        proposedMitigation:
          "Investigate the per-file CLI defects; if Studio actually opens the workflow, narrow the per-file Error → blocked mapping or confirm the per-file degradation is real.",
      });
    } else {
      out.push({
        area: "studio_compat",
        summary: `Workflow ${s.file} would be reclassified ${s.legacyLevel} → ${s.simulatedLevel}.`,
        classification: "safe",
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Top-level simulator entry point
// ---------------------------------------------------------------------------

export interface SimulatedRunReport {
  runId: string;
  specId?: string;
  declaredTargetFramework?: string;
  cliMode: string;
  notSimulatable: boolean;
  verdict: VerdictDelta;
  artifact: ArtifactDelta;
  routing: RoutingDeltaEntry[];
  studioCompat: StudioCompatDeltaEntry[];
  risks: RiskItem[];
  notes: string[];
}

export function simulateRun(input: SimulatorRunInput): SimulatedRunReport {
  const verdict = simulateVerdict(input);
  const artifact = simulateArtifactDelta(input);
  const routing = simulateRoutingDelta(input);
  const studioCompat = simulateStudioCompatDelta(input);
  const risks = classifyRisks(verdict, artifact, routing, studioCompat);

  return {
    runId: input.runId,
    specId: input.specId,
    declaredTargetFramework: input.declaredTargetFramework,
    cliMode: input.cliValidation?.mode ?? "absent",
    notSimulatable: !verdict.simulatable,
    verdict,
    artifact,
    routing,
    studioCompat,
    risks,
    notes: input.notes ?? [],
  };
}

// ---------------------------------------------------------------------------
// Aggregate top-line summary
// ---------------------------------------------------------------------------

export type TopLine = "green" | "yellow" | "red" | "deferred";

export interface AggregateSummary {
  totalRuns: number;
  simulatableRuns: number;
  regressionRiskRuns: number;
  expectedChurnRuns: number;
  safeRuns: number;
  topLine: TopLine;
  rationale: string;
}

export function summarize(reports: SimulatedRunReport[]): AggregateSummary {
  const total = reports.length;
  const simulatable = reports.filter(r => !r.notSimulatable).length;
  const regression = reports.filter(r =>
    r.risks.some(x => x.classification === "regression_risk"),
  ).length;
  const churn = reports.filter(r =>
    r.risks.some(x => x.classification === "expected_churn"),
  ).length;
  const safe = simulatable - regression - churn;

  let topLine: TopLine;
  let rationale: string;
  if (simulatable === 0) {
    topLine = "deferred";
    rationale =
      "DEFERRED: 0 of " + total + " runs in the sample carried real CLI execution data, so #541 has no CLI-grounded behavior to differ on. The simulator cannot produce evidence-based verdict/artifact/routing/DHG deltas from this sample. Re-run after a Windows runner (#549) lands or after #541 Phase 1 step 1 (capability-driven framework selection) starts producing CLI shadow data on Linux.";
  } else if (regression === 0) {
    topLine = "green";
    rationale = `${simulatable}/${total} runs simulatable; 0 regression-risk items found.`;
  } else if (regression <= Math.max(1, Math.floor(simulatable * 0.1))) {
    topLine = "yellow";
    rationale = `${regression} of ${simulatable} simulatable runs flagged regression risk; named scope adjustments recommended.`;
  } else {
    topLine = "red";
    rationale = `${regression} of ${simulatable} simulatable runs would regress under #541 — do not proceed without mitigation.`;
  }

  return {
    totalRuns: total,
    simulatableRuns: simulatable,
    regressionRiskRuns: regression,
    expectedChurnRuns: churn,
    safeRuns: Math.max(0, safe),
    topLine,
    rationale,
  };
}
