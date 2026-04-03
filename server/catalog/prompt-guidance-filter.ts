import { catalogService, type CatalogPackage, type CatalogActivity, type ActivityCatalog } from "./catalog-service";
import { metadataService, type StudioProfile } from "./metadata-service";

export interface PromptGuidanceConfig {
  maxPackages?: number;
  maxCharacters?: number;
  targetFramework?: "Windows" | "Portable";
  includeConnectorOnly?: boolean;
}

export interface PackageGuidanceEntry {
  packageId: string;
  keyActivities: string[];
  version?: string;
}

export interface ExcludedPackageEntry {
  packageId: string;
  reasons: string[];
}

export interface PromptGuidanceDiagnostics {
  totalConsidered: number;
  totalIncluded: number;
  totalExcluded: number;
  included: PackageGuidanceEntry[];
  excluded: ExcludedPackageEntry[];
  budgetApplied: boolean;
  budgetTruncatedCount: number;
  targetFramework: string;
}

export interface PromptGuidanceResult {
  guidanceBlock: string;
  packageIds: Set<string>;
  diagnostics: PromptGuidanceDiagnostics;
}

const DEFAULT_MAX_PACKAGES = 60;
const DEFAULT_MAX_CHARACTERS = 4000;
const MAX_ACTIVITIES_PER_PACKAGE = 8;

const CONNECTOR_ONLY_PATTERNS = [
  "UiPath.IntegrationService.Activities",
];

const WINDOWS_ONLY_PACKAGES = new Set([
  "UiPath.UIAutomation.Activities",
  "UiPath.UIAutomationNext.Activities",
  "UiPath.Excel.Activities",
  "UiPath.Word.Activities",
  "UiPath.Presentations.Activities",
  "UiPath.Terminal.Activities",
  "UiPath.Citrix.Activities",
  "UiPath.AzureWindowsVirtualDesktop.Activities",
  "UiPath.Java.Activities",
  "UiPath.SAP.BAPI.Activities",
]);

function isConnectorOnlyPackage(packageId: string): boolean {
  return CONNECTOR_ONLY_PATTERNS.includes(packageId);
}

function hasApprovedActivities(pkg: CatalogPackage): boolean {
  return pkg.activities.some(a => a.emissionApproved);
}

function isPackageDeprecated(pkg: CatalogPackage): boolean {
  return pkg.activities.length > 0 && pkg.activities.every(a => a.isDeprecated === true);
}

function isTargetIncompatible(packageId: string, targetFramework?: "Windows" | "Portable"): boolean {
  if (!targetFramework || targetFramework === "Windows") return false;
  return WINDOWS_ONLY_PACKAGES.has(packageId);
}

function getKeyActivities(pkg: CatalogPackage, limit: number): string[] {
  const approved = pkg.activities.filter(a => a.emissionApproved && !a.isDeprecated);
  const sorted = approved.sort((a, b) => {
    if (a.browsable && !b.browsable) return -1;
    if (!a.browsable && b.browsable) return 1;
    return 0;
  });
  return sorted.slice(0, limit).map(a => a.displayName);
}

export function buildPromptGuidance(config: PromptGuidanceConfig = {}): PromptGuidanceResult {
  const {
    maxPackages = DEFAULT_MAX_PACKAGES,
    maxCharacters = DEFAULT_MAX_CHARACTERS,
    targetFramework,
    includeConnectorOnly = false,
  } = config;

  const catalog = catalogService.getCatalog();
  if (!catalog) {
    return {
      guidanceBlock: "",
      packageIds: new Set(),
      diagnostics: {
        totalConsidered: 0,
        totalIncluded: 0,
        totalExcluded: 0,
        included: [],
        excluded: [],
        budgetApplied: false,
        budgetTruncatedCount: 0,
        targetFramework: targetFramework || "unknown",
      },
    };
  }

  const included: PackageGuidanceEntry[] = [];
  const excluded: ExcludedPackageEntry[] = [];

  for (const pkg of catalog.packages) {
    const reasons: string[] = [];

    if (pkg.feedStatus === "delisted") {
      reasons.push("delisted");
    } else if (pkg.feedStatus === "unverified") {
      // Policy: only verified packages are included in prompt guidance to prevent
      // recommending packages whose feed presence has not been confirmed
      reasons.push("unverified feed status");
    }

    if (pkg.generationApproved !== true) {
      reasons.push("not generation-approved");
    }

    if (!hasApprovedActivities(pkg)) {
      reasons.push("no emission-approved activities");
    }

    if (isPackageDeprecated(pkg)) {
      reasons.push("all activities deprecated");
    }

    if (!includeConnectorOnly && isConnectorOnlyPackage(pkg.packageId)) {
      reasons.push("connector-only");
    }

    if (isTargetIncompatible(pkg.packageId, targetFramework)) {
      reasons.push("target-incompatible (Windows-only)");
    }

    if (reasons.length > 0) {
      excluded.push({ packageId: pkg.packageId, reasons });
      continue;
    }

    const keyActivities = getKeyActivities(pkg, MAX_ACTIVITIES_PER_PACKAGE);
    included.push({
      packageId: pkg.packageId,
      keyActivities,
      version: pkg.preferredVersion || pkg.version,
    });
  }

  let budgetTruncatedCount = 0;
  let budgetApplied = false;

  if (included.length > maxPackages) {
    budgetApplied = true;
    budgetTruncatedCount = included.length - maxPackages;
    included.length = maxPackages;
  }

  let guidanceBlock = buildGuidanceText(included);
  if (guidanceBlock.length > maxCharacters) {
    budgetApplied = true;
    while (guidanceBlock.length > maxCharacters && included.length > 0) {
      budgetTruncatedCount++;
      included.pop();
      guidanceBlock = buildGuidanceText(included);
    }
  }

  const packageIds = new Set(included.map(e => e.packageId));

  return {
    guidanceBlock,
    packageIds,
    diagnostics: {
      totalConsidered: catalog.packages.length,
      totalIncluded: included.length,
      totalExcluded: excluded.length,
      included,
      excluded,
      budgetApplied,
      budgetTruncatedCount,
      targetFramework: targetFramework || "default",
    },
  };
}

function buildGuidanceText(entries: PackageGuidanceEntry[]): string {
  if (entries.length === 0) return "";

  const lines: string[] = [];
  for (const entry of entries) {
    if (entry.keyActivities.length > 0) {
      lines.push(`${entry.packageId}: ${entry.keyActivities.join(", ")}`);
    } else {
      lines.push(entry.packageId);
    }
  }
  return lines.join("\n");
}

export function buildPromptPackageGuidance(profile?: StudioProfile | null): { guidance: string; diagnostics: PromptGuidanceDiagnostics } {
  const config: PromptGuidanceConfig = {};
  if (profile?.targetFramework) {
    config.targetFramework = profile.targetFramework === "Portable" ? "Portable" : "Windows";
  }

  const result = buildPromptGuidance(config);

  if (!result.guidanceBlock) {
    return { guidance: "", diagnostics: result.diagnostics };
  }

  const guidance = `\nVERIFIED ACTIVITY PACKAGES (catalog-grounded, prefer these):\n${result.guidanceBlock}\n`;
  return { guidance, diagnostics: result.diagnostics };
}

export function buildSddPackageGuidance(profile?: StudioProfile | null): { guidance: string; diagnostics: PromptGuidanceDiagnostics } {
  const config: PromptGuidanceConfig = {
    maxCharacters: 3000,
    maxPackages: 40,
  };
  if (profile?.targetFramework) {
    config.targetFramework = profile.targetFramework === "Portable" ? "Portable" : "Windows";
  }

  const result = buildPromptGuidance(config);

  if (!result.guidanceBlock) {
    return { guidance: "", diagnostics: result.diagnostics };
  }

  logGuidanceDiagnostics("SDD", result.diagnostics);

  const versionedLines: string[] = [];
  for (const entry of result.diagnostics.included) {
    const versionTag = entry.version ? ` ${entry.version}` : "";
    if (entry.keyActivities.length > 0) {
      versionedLines.push(`- ${entry.packageId}${versionTag}: ${entry.keyActivities.join(", ")}`);
    } else {
      versionedLines.push(`- ${entry.packageId}${versionTag}`);
    }
  }
  const versionedBlock = versionedLines.join("\n");

  const guidance = `\nVERIFIED UiPath ACTIVITY PACKAGES (${result.diagnostics.totalIncluded} packages — catalog-verified, available on the UiPath Official Feed):\n${versionedBlock}\n`;
  return { guidance, diagnostics: result.diagnostics };
}

export function buildSddScanGuidance(profile?: StudioProfile | null): PromptGuidanceResult {
  const config: PromptGuidanceConfig = {
    maxCharacters: 3000,
    maxPackages: 40,
  };
  if (profile?.targetFramework) {
    config.targetFramework = profile.targetFramework === "Portable" ? "Portable" : "Windows";
  }
  return buildPromptGuidance(config);
}

export function scanSddForUnverifiedPackages(sddContent: string, verifiedPackageIds: Set<string>): string[] {
  const packagePattern = /UiPath\.[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*/g;
  const matches = sddContent.match(packagePattern) || [];

  const mentionedPackages = new Set<string>();
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    if (match.includes(".Activities") || match.endsWith(".Activities")) {
      mentionedPackages.add(match);
    }
  }

  const unverified: string[] = [];
  const mentionedArr = Array.from(mentionedPackages);
  for (let i = 0; i < mentionedArr.length; i++) {
    if (!verifiedPackageIds.has(mentionedArr[i])) {
      unverified.push(mentionedArr[i]);
    }
  }

  return unverified.sort();
}

function logGuidanceDiagnostics(context: string, diagnostics: PromptGuidanceDiagnostics): void {
  console.log(`[PromptGuidance:${context}] Considered: ${diagnostics.totalConsidered}, Included: ${diagnostics.totalIncluded}, Excluded: ${diagnostics.totalExcluded}, Budget applied: ${diagnostics.budgetApplied}, Target: ${diagnostics.targetFramework}`);
  if (diagnostics.excluded.length > 0) {
    const summary = diagnostics.excluded.map(e => `${e.packageId} (${e.reasons.join(", ")})`).join("; ");
    console.log(`[PromptGuidance:${context}] Excluded: ${summary}`);
  }
}
