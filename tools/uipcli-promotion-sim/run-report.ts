/**
 * Orchestrator for the uipcli promotion simulator (#545).
 *
 * Reads the most recent N pipeline runs from the database, extracts whatever
 * CLI / studio-compatibility / final-quality-report data is persisted, feeds
 * each run into the simulator, and writes:
 *
 *   - tools/uipcli-promotion-sim/sim-output.json   (raw structured output)
 *   - docs/uipcli-promotion-simulation-report.md   (rendered report)
 *
 * Usage:
 *   tsx tools/uipcli-promotion-sim/run-report.ts [--limit N]
 *
 * Read-only against production schema. Does not mutate any pipeline state.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { db } from "../../server/db";
import { uipathGenerationRuns } from "../../shared/models/pipeline";
import { desc } from "drizzle-orm";
import {
  simulateRun,
  summarize,
  type SimulatorRunInput,
  type SimulatedRunReport,
  type AggregateSummary,
  type LegacyCliValidation,
  type LegacyStudioCompat,
  type LegacyFinalQualityReport,
} from "./simulate";
import { loadAllBundles } from "./bundle-loader";

interface CliArgs {
  limit: number;
  fromBundles: boolean;
  bundleDir?: string;
  outputJson: string;
  outputMd: string;
}

function parseArgs(argv: string[]): CliArgs {
  let limit = 10;
  let fromBundles = false;
  let bundleDir: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Number(argv[i + 1]);
      i++;
    } else if (argv[i] === "--from-bundles") {
      fromBundles = true;
    } else if (argv[i] === "--bundle-dir" && argv[i + 1]) {
      bundleDir = argv[i + 1];
      fromBundles = true;
      i++;
    }
  }
  return {
    limit,
    fromBundles,
    bundleDir,
    outputJson: "tools/uipcli-promotion-sim/sim-output.json",
    outputMd: "docs/uipcli-promotion-simulation-report.md",
  };
}

/**
 * Decode a column value that might arrive as either a string (text/jsonb-as-text)
 * or as an already-parsed object (jsonb decoded by the driver). Returns
 * undefined only when the value is genuinely absent or unparseable. This is
 * critical for `finalQualityReport`, which is a `jsonb` column and arrives as
 * an object — parsing it as a string would silently drop the data and cause
 * the verdict reconciliation hierarchy to ignore FQR downgrades.
 */
function decodeMaybeJson<T>(value: unknown): T | undefined {
  if (value == null) return undefined;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    if (value.length === 0) return undefined;
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function extractInput(row: typeof uipathGenerationRuns.$inferSelect): SimulatorRunInput {
  const outcome = decodeMaybeJson<Record<string, unknown>>(row.outcomeReport);
  const fqr = decodeMaybeJson<Record<string, unknown>>(row.finalQualityReport);

  // The pipeline's outcome report does not currently persist the full
  // cliValidationResult; it persists a small set of fields when CLI ran.
  const cliMode = (outcome?.cliValidationMode as string | undefined) ??
    (outcome?.cliValidation as { mode?: string } | undefined)?.mode;
  const cliFromOutcome = outcome?.cliValidation as Partial<LegacyCliValidation> | undefined;

  const cli: LegacyCliValidation | undefined = cliMode || cliFromOutcome
    ? {
        mode: (cliMode as LegacyCliValidation["mode"]) ?? "custom_validated_only",
        projectType: (outcome?.cliProjectType as LegacyCliValidation["projectType"]) ??
          cliFromOutcome?.projectType,
        analyzeResult: cliFromOutcome?.analyzeResult,
        packResult: cliFromOutcome?.packResult ??
          (typeof outcome?.cliPackSuccess === "boolean"
            ? { success: outcome.cliPackSuccess as boolean }
            : undefined),
      }
    : undefined;

  const studioCompat = (outcome?.studioCompatibility as LegacyStudioCompat[] | undefined) ?? [];

  const finalQualityReport: LegacyFinalQualityReport | undefined = fqr
    ? {
        derivedStatus: fqr.derivedStatus as LegacyFinalQualityReport["derivedStatus"],
        statusReason: fqr.statusReason as string | undefined,
      }
    : undefined;

  const notes: string[] = [];
  if (!cli) {
    notes.push(
      "Outcome report contains no cliValidation block; CLI either did not run or the result is not persisted today.",
    );
  }
  if (cli && !cli.analyzeResult && !cli.packResult) {
    notes.push(
      "CLI mode recorded but analyzer defects / pack result not persisted; routing & artifact deltas are not reconstructible without replay.",
    );
  }

  return {
    runId: row.runId,
    specId: (row as unknown as { ideaId?: string }).ideaId,
    declaredTargetFramework: (outcome?.targetFramework as string | undefined),
    actualStatus: row.status as SimulatorRunInput["actualStatus"],
    cliValidation: cli,
    studioCompatibility: studioCompat,
    finalQualityReport,
    notes,
  };
}

function renderMarkdown(reports: SimulatedRunReport[], summary: AggregateSummary, generatedAt: string): string {
  const lines: string[] = [];
  lines.push("# uipcli Promotion Simulation Report (#545)");
  lines.push("");
  lines.push(`_Generated: ${generatedAt}_`);
  lines.push("");
  lines.push("## Top-line summary");
  lines.push("");
  lines.push(`- **Verdict:** \`${summary.topLine.toUpperCase()}\``);
  lines.push(`- **Sample size:** ${summary.totalRuns} runs`);
  lines.push(`- **Simulatable runs (CLI produced a usable verdict):** ${summary.simulatableRuns}`);
  lines.push(`- **Regression-risk runs:** ${summary.regressionRiskRuns}`);
  lines.push(`- **Expected-churn runs:** ${summary.expectedChurnRuns}`);
  lines.push(`- **Safe-delta runs:** ${summary.safeRuns}`);
  lines.push("");
  lines.push(`**Rationale:** ${summary.rationale}`);
  lines.push("");

  if (summary.simulatableRuns === 0) {
    lines.push("## Deferral notice");
    lines.push("");
    lines.push(
      "The recommendation in `.local/tasks/uipcli-promotion-dry-run-simulation.md` ('When to run') applies: when no recent runs include real CLI execution data, the simulation has nothing CLI-grounded to differ on. Re-run this simulator after either:",
    );
    lines.push("");
    lines.push("- **#549 lands** (Windows runner) — Windows-required runs start producing real CLI shadow data on the dominant project shape; or");
    lines.push(
      "- **#541 Phase 1 step 1 lands** (capability-driven post-emission framework selection) — CrossPlatform-eligible runs start executing CLI in-process on Linux.",
    );
    lines.push("");
    lines.push(
      "Until then, the simulator's verdict-, artifact-, and routing-delta sections fall through to 'CLI did not run; #541 falls back to legacy heuristic — verdict identical by definition.'",
    );
    lines.push("");
  }

  lines.push("## Per-run findings");
  lines.push("");

  for (const r of reports) {
    lines.push(`### Run \`${r.runId}\``);
    lines.push("");
    lines.push(`- Spec id: \`${r.specId ?? "n/a"}\``);
    lines.push(`- Declared targetFramework: \`${r.declaredTargetFramework ?? "n/a"}\``);
    lines.push(`- CLI mode: \`${r.cliMode}\``);
    lines.push(`- Actual status: \`${r.verdict.actualStatus}\``);
    lines.push(`- Simulated status: \`${r.verdict.simulatedStatus}\``);
    lines.push(`- Verdict reason: ${r.verdict.reason}`);
    lines.push(
      `- Truth sources (simulated): openability=\`${r.verdict.openabilityTruthSource}\`, fidelity=\`${r.verdict.fidelityTruthSource}\``,
    );
    lines.push("");

    lines.push("**1. Verdict delta**");
    lines.push("");
    lines.push(
      `${r.verdict.agree ? "Agree" : "Disagree"} — actual=\`${r.verdict.actualStatus}\` simulated=\`${r.verdict.simulatedStatus}\``,
    );
    lines.push("");

    lines.push("**2. Shipped artifact delta**");
    lines.push("");
    lines.push(`- packArtifactSource (legacy): \`${r.artifact.packArtifactSourceLegacy}\``);
    lines.push(`- packArtifactSource (simulated): \`${r.artifact.packArtifactSourceSimulated}\``);
    if (r.artifact.packFallbackReason) {
      lines.push(`- packFallbackReason: \`${r.artifact.packFallbackReason}\``);
    }
    if (r.artifact.comparable) {
      lines.push(`- shipped sha256: \`${r.artifact.shippedSha256 ?? "n/a"}\` (${r.artifact.shippedSize ?? "?"} bytes)`);
      lines.push(`- CLI sha256: \`${r.artifact.cliSha256 ?? "n/a"}\` (${r.artifact.cliSize ?? "?"} bytes)`);
      lines.push(`- bytes identical: ${r.artifact.bytesIdentical}`);
      if (r.artifact.diffSummary) {
        const s = r.artifact.diffSummary;
        lines.push(`- archive entries: ${s.identical} identical • ${s.contentDiffers} content-differs • ${s.onlyInShipped} only-in-shipped • ${s.onlyInCli} only-in-cli`);
        const interesting = r.artifact.entryDiff.filter(e => e.status !== "identical");
        if (interesting.length > 0) {
          lines.push("");
          lines.push("| Entry | Status | shipped sha256 | cli sha256 |");
          lines.push("|---|---|---|---|");
          for (const e of interesting.slice(0, 50)) {
            lines.push(`| \`${e.name}\` | ${e.status} | \`${e.shippedSha256?.slice(0, 12) ?? "—"}\` | \`${e.cliSha256?.slice(0, 12) ?? "—"}\` |`);
          }
          if (interesting.length > 50) lines.push(`| _…${interesting.length - 50} more_ | | | |`);
        }
      }
    } else {
      lines.push(`- ${r.artifact.notes}`);
    }
    lines.push("");

    lines.push("**3. Analyzer Error routing delta**");
    lines.push("");
    if (r.routing.length === 0) {
      lines.push("_No analyzer Error-severity defects in this run (or CLI did not produce defects)._");
    } else {
      lines.push("| Rule | File | Legacy routing | Simulated bucket | Changed |");
      lines.push("|---|---|---|---|---|");
      for (const e of r.routing) {
        lines.push(
          `| \`${e.ruleId}\` | \`${e.file}\` | ${e.legacyRouting} | ${e.simulatedBucket}${e.flagsBlockingCliError ? " ⚠️" : ""} | ${e.changed ? "yes" : "no"} |`,
        );
      }
    }
    lines.push("");

    lines.push("**4. DHG Studio Compatibility delta**");
    lines.push("");
    if (r.studioCompat.length === 0) {
      lines.push("_No per-workflow studio compatibility classifications recorded for this run._");
    } else {
      const changed = r.studioCompat.filter(s => s.changed);
      lines.push(`Total workflows: ${r.studioCompat.length} • would reclassify: ${changed.length}`);
      if (changed.length > 0) {
        lines.push("");
        lines.push("| Workflow | Legacy | Simulated |");
        lines.push("|---|---|---|");
        for (const s of changed.slice(0, 25)) {
          lines.push(`| \`${s.file}\` | ${s.legacyLevel} | ${s.simulatedLevel} |`);
        }
        if (changed.length > 25) lines.push(`| _…${changed.length - 25} more_ | | |`);
      }
    }
    lines.push("");

    lines.push("**5. Regression-risk classification**");
    lines.push("");
    if (r.risks.length === 0) {
      lines.push("_No risk items — all simulated deltas are no-ops._");
    } else {
      for (const risk of r.risks) {
        lines.push(`- \`${risk.classification}\` (${risk.area}): ${risk.summary}`);
        if (risk.proposedMitigation) lines.push(`  - **Mitigation:** ${risk.proposedMitigation}`);
      }
    }
    lines.push("");

    if (r.notes.length > 0) {
      lines.push("**Notes:**");
      lines.push("");
      for (const n of r.notes) lines.push(`- ${n}`);
      lines.push("");
    }
  }

  lines.push("## Reproducibility");
  lines.push("");
  lines.push("Re-run this report with:");
  lines.push("");
  lines.push("```");
  lines.push("# from the database (most recent N runs)");
  lines.push("tsx tools/uipcli-promotion-sim/run-report.ts --limit 10");
  lines.push("");
  lines.push("# from on-disk verification bundles (default: attached_assets/)");
  lines.push("tsx tools/uipcli-promotion-sim/run-report.ts --from-bundles");
  lines.push("");
  lines.push("# or pin to a specific bundle directory");
  lines.push("tsx tools/uipcli-promotion-sim/run-report.ts --bundle-dir /path/to/bundles");
  lines.push("```");
  lines.push("");
  lines.push(
    "The simulator imports `CLI_RULE_TO_CHECK` and `CLI_FIXABLE_RULE_IDS` from `server/meta-validation/iterative-llm-corrector.ts` so simulated routing follows the production whitelist. The `BLOCKING_CLI_ERROR_RULE_IDS` set in `tools/uipcli-promotion-sim/simulate.ts` is the closed list of openability-blocking analyzer Errors anticipated by #541; it is empty today (per the plan, unknown Errors default to localized DHG TODOs).",
  );
  lines.push("");
  lines.push(
    "Archive-level diff: when both the shipped `.nupkg` (via `shippedArtifact.filePath`/`buffer`) and the CLI-produced `.nupkg` (via `cliValidation.packResult.outputPath`) are available on disk, the artifact-delta section emits a per-entry table (only-in-shipped / only-in-cli / content-differs / identical, with truncated sha256 per side). When neither is on disk, the section honestly reports the missing inputs and the path to enable the diff.",
  );
  lines.push("");

  return lines.join("\n");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let inputs: SimulatorRunInput[];
  if (args.fromBundles) {
    const dir = args.bundleDir ?? "attached_assets";
    console.log(`[sim] loading verification bundles from ${dir}…`);
    inputs = loadAllBundles(dir);
    console.log(`[sim] loaded ${inputs.length} bundle(s)`);
  } else {
    console.log(`[sim] loading the most recent ${args.limit} runs from the database…`);
    const rows = await db
      .select()
      .from(uipathGenerationRuns)
      .orderBy(desc(uipathGenerationRuns.createdAt))
      .limit(args.limit);
    inputs = rows.map(extractInput);
  }

  const reports = inputs.map(simulateRun);
  const summary = summarize(reports);
  const generatedAt = new Date().toISOString();

  mkdirSync(dirname(args.outputJson), { recursive: true });
  mkdirSync(dirname(args.outputMd), { recursive: true });

  writeFileSync(
    args.outputJson,
    JSON.stringify({ generatedAt, summary, reports }, null, 2),
    "utf-8",
  );
  writeFileSync(args.outputMd, renderMarkdown(reports, summary, generatedAt), "utf-8");

  console.log(`[sim] wrote ${args.outputJson}`);
  console.log(`[sim] wrote ${args.outputMd}`);
  console.log(
    `[sim] top-line=${summary.topLine}; ${summary.simulatableRuns}/${summary.totalRuns} simulatable; ${summary.regressionRiskRuns} regression-risk`,
  );

  // Drizzle's pg pool keeps the process alive — exit explicitly.
  process.exit(0);
}

main().catch(err => {
  console.error("[sim] failed:", err);
  process.exit(1);
});
