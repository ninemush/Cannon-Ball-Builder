/**
 * Verification-bundle loader for the uipcli promotion simulator (#545).
 *
 * Reads the verification bundles produced by the
 * post-implementation-verification skill (zip files under attached_assets/ that
 * contain manifest.json + outcome-report.json + final-quality-report.json +
 * <ProjectName>.nupkg + DHG.md) and converts them into SimulatorRunInput.
 *
 * This is the disk-based reproducibility path called out by #545: when a
 * caller has a saved verification bundle from a past run, the simulator can
 * replay against it without needing the database row.
 *
 * Read-only.
 */

import { readFileSync, readdirSync, writeFileSync, mkdtempSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import AdmZip from "adm-zip";
import type {
  SimulatorRunInput,
  LegacyCliValidation,
  LegacyStudioCompat,
  LegacyFinalQualityReport,
  LegacyShippedArtifact,
  LegacyPackageStatus,
} from "./simulate";

interface BundleFiles {
  manifest?: Record<string, unknown>;
  outcomeReport?: Record<string, unknown>;
  finalQualityReport?: Record<string, unknown>;
  shippedNupkgPath?: string;
}

function readBundle(zipPath: string): BundleFiles | undefined {
  if (!existsSync(zipPath)) return undefined;
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipPath);
  } catch {
    return undefined;
  }

  const out: BundleFiles = {};
  const tmp = mkdtempSync(join(tmpdir(), "uipcli-sim-bundle-"));

  for (const e of zip.getEntries()) {
    if (e.isDirectory) continue;
    const name = e.entryName.replace(/\\/g, "/").split("/").pop() || e.entryName;
    const data = e.getData();
    if (name === "manifest.json") {
      try {
        out.manifest = JSON.parse(data.toString("utf-8"));
      } catch {}
    } else if (name === "outcome-report.json") {
      try {
        out.outcomeReport = JSON.parse(data.toString("utf-8"));
      } catch {}
    } else if (name === "final-quality-report.json") {
      try {
        out.finalQualityReport = JSON.parse(data.toString("utf-8"));
      } catch {}
    } else if (name.toLowerCase().endsWith(".nupkg")) {
      const nupkgPath = join(tmp, name);
      writeFileSync(nupkgPath, data);
      out.shippedNupkgPath = nupkgPath;
    }
  }
  return out;
}

export function bundleToInput(zipPath: string): SimulatorRunInput | undefined {
  const b = readBundle(zipPath);
  if (!b || !b.manifest) return undefined;

  const manifest = b.manifest;
  const outcome = b.outcomeReport ?? {};
  const fqr = b.finalQualityReport;

  const cliMode = (outcome.cliValidationMode as string | undefined) ??
    (outcome.cliValidation as { mode?: string } | undefined)?.mode;
  const cliFromOutcome = outcome.cliValidation as Partial<LegacyCliValidation> | undefined;

  const cli: LegacyCliValidation | undefined = cliMode || cliFromOutcome
    ? {
        mode: (cliMode as LegacyCliValidation["mode"]) ?? "custom_validated_only",
        projectType: (outcome.cliProjectType as LegacyCliValidation["projectType"]) ??
          cliFromOutcome?.projectType,
        analyzeResult: cliFromOutcome?.analyzeResult,
        packResult: cliFromOutcome?.packResult ??
          (typeof outcome.cliPackSuccess === "boolean"
            ? { success: outcome.cliPackSuccess as boolean }
            : undefined),
      }
    : undefined;

  const studioCompat = (outcome.studioCompatibility as LegacyStudioCompat[] | undefined) ?? [];

  const finalQualityReport: LegacyFinalQualityReport | undefined = fqr
    ? {
        derivedStatus: fqr.derivedStatus as LegacyFinalQualityReport["derivedStatus"],
        statusReason: fqr.statusReason as string | undefined,
      }
    : undefined;

  const shippedArtifact: LegacyShippedArtifact | undefined = b.shippedNupkgPath
    ? { filePath: b.shippedNupkgPath }
    : undefined;

  const notes: string[] = [`Loaded from verification bundle: ${zipPath}`];
  if (!cli) notes.push("Bundle's outcome report has no cliValidation block.");
  if (!shippedArtifact) notes.push("Bundle did not contain a .nupkg file.");

  return {
    runId: (manifest.generationRunId as string | undefined) ?? "(unknown-run-id)",
    specId: manifest.ideaId as string | undefined,
    declaredTargetFramework: outcome.targetFramework as string | undefined,
    actualStatus: ((manifest.generationStatus as string | undefined) ?? "unknown") as
      | LegacyPackageStatus
      | "failed"
      | string,
    cliValidation: cli,
    shippedArtifact,
    studioCompatibility: studioCompat,
    finalQualityReport,
    notes,
  };
}

/**
 * Discover verification bundles under a directory (default: attached_assets/).
 * Matches the "<ProjectName>_..._verification_bundle_<timestamp>.zip" naming
 * convention written by the post-implementation-verification skill.
 */
export function discoverBundles(dir = "attached_assets"): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(n => /verification_bundle_\d+\.zip$/.test(n))
    .map(n => join(dir, n))
    .sort();
}

export function loadAllBundles(dir?: string): SimulatorRunInput[] {
  const paths = discoverBundles(dir);
  const inputs: SimulatorRunInput[] = [];
  for (const p of paths) {
    const i = bundleToInput(p);
    if (i) inputs.push(i);
  }
  return inputs;
}

/** Read the bundle's project name (used for grouping latest-per-idea). */
export function getBundleProjectName(zipPath: string): string | undefined {
  const b = readBundle(zipPath);
  return (b?.manifest?.projectName as string | undefined) ??
    (b?.manifest?.ideaTitle as string | undefined);
}
