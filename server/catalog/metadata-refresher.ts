import { writeFileSync, readFileSync, existsSync, renameSync } from "fs";
import { join } from "path";
import {
  generationMetadataSchema,
  serviceEndpointsSchema,
  type GenerationMetadata,
  type ServiceEndpoints,
} from "./metadata-schemas";
import { metadataService } from "./metadata-service";

const CATALOG_DIR = join(process.cwd(), "catalog");
const NUGET_V3_BASE = "https://api.nuget.org/v3-flatcontainer";

const CORE_PACKAGES = [
  "UiPath.System.Activities",
  "UiPath.UIAutomation.Activities",
  "UiPath.Mail.Activities",
  "UiPath.Excel.Activities",
  "UiPath.Web.Activities",
  "UiPath.Database.Activities",
  "UiPath.Persistence.Activities",
  "UiPath.IntelligentOCR.Activities",
];

interface RefreshResult {
  family: "generation" | "integration";
  success: boolean;
  message: string;
  updatedAt?: string;
}

interface VersionRange {
  min: string;
  max: string;
  preferred: string;
}

function parseMajorMinor(version: string): { major: number; minor: number } | null {
  const parts = version.split(".");
  if (parts.length < 2) return null;
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  if (isNaN(major) || isNaN(minor)) return null;
  return { major, minor };
}

function isVersionInCompatibleLine(version: string, seedMin: string, seedMax: string): boolean {
  const v = parseMajorMinor(version);
  const minRef = parseMajorMinor(seedMin);
  const maxRef = parseMajorMinor(seedMax);
  if (!v || !minRef || !maxRef) return false;
  if (v.major !== minRef.major) return false;
  if (minRef.major === maxRef.major && minRef.minor === maxRef.minor) {
    return v.minor === minRef.minor;
  }
  return true;
}

async function fetchVersionRange(
  packageId: string,
  seedMin: string,
  seedMax: string,
): Promise<VersionRange | null> {
  try {
    const indexUrl = `${NUGET_V3_BASE}/${packageId.toLowerCase()}/index.json`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(indexUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data: any = await res.json();
    const versions: string[] = data.versions || [];
    const stableVersions = versions.filter(v => !v.includes("-"));
    const compatibleVersions = stableVersions.filter(v =>
      isVersionInCompatibleLine(v, seedMin, seedMax)
    );
    if (compatibleVersions.length === 0) return null;
    return {
      min: compatibleVersions[0],
      max: compatibleVersions[compatibleVersions.length - 1],
      preferred: compatibleVersions[compatibleVersions.length - 1],
    };
  } catch {
    return null;
  }
}

function atomicWrite(filePath: string, data: string): void {
  const stagingPath = `${filePath}.tmp`;
  writeFileSync(stagingPath, data, "utf-8");
  renameSync(stagingPath, filePath);
}

export async function refreshGeneration(): Promise<RefreshResult> {
  const now = new Date().toISOString();

  try {
    const existingPath = join(CATALOG_DIR, "generation-metadata.json");
    let existing: GenerationMetadata | null = null;

    if (existsSync(existingPath)) {
      try {
        const raw = readFileSync(existingPath, "utf-8");
        const parsed = generationMetadataSchema.safeParse(JSON.parse(raw));
        if (parsed.success) existing = parsed.data;
      } catch { }
    }

    if (!existing) {
      return { family: "generation", success: false, message: "No existing generation-metadata.json to update" };
    }

    const updatedRanges = { ...existing.packageVersionRanges };
    let updatedCount = 0;

    for (const pkgName of CORE_PACKAGES) {
      const existingRange = updatedRanges[pkgName];
      if (!existingRange) continue;
      const range = await fetchVersionRange(pkgName, existingRange.min, existingRange.max);
      if (range && updatedRanges[pkgName]) {
        updatedRanges[pkgName] = {
          ...updatedRanges[pkgName],
          min: range.min,
          max: range.max,
          preferred: range.preferred,
          lastVerifiedAt: now,
          verificationSource: "nuget-feed",
        };
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      metadataService.recordRefreshResult("generation", false);
      return {
        family: "generation",
        success: false,
        message: `No package versions could be verified from NuGet feed (0/${CORE_PACKAGES.length} succeeded). Timestamps preserved from last successful verification.`,
      };
    }

    const isPartial = updatedCount < CORE_PACKAGES.length;
    const updated: GenerationMetadata = {
      ...existing,
      packageVersionRanges: updatedRanges,
      lastRefreshedAt: now,
      lastVerifiedAt: isPartial ? existing.lastVerifiedAt : now,
    };

    const validation = generationMetadataSchema.safeParse(updated);
    if (!validation.success) {
      metadataService.recordRefreshResult("generation", false);
      return { family: "generation", success: false, message: `Validation failed after refresh: ${validation.error.message}` };
    }

    atomicWrite(existingPath, JSON.stringify(updated, null, 2));
    metadataService.reload("generation");
    metadataService.recordRefreshResult("generation", true);

    return {
      family: "generation",
      success: true,
      message: `Updated ${updatedCount}/${CORE_PACKAGES.length} package versions from NuGet feed${isPartial ? " (partial — snapshot-level verification timestamp preserved)" : ""}`,
      updatedAt: now,
    };
  } catch (err: any) {
    metadataService.recordRefreshResult("generation", false);
    return { family: "generation", success: false, message: `Generation refresh failed: ${err.message}` };
  }
}

export async function refreshIntegration(): Promise<RefreshResult> {
  const now = new Date().toISOString();

  try {
    const existingPath = join(CATALOG_DIR, "service-endpoints.json");
    let existing: ServiceEndpoints | null = null;

    if (existsSync(existingPath)) {
      try {
        const raw = readFileSync(existingPath, "utf-8");
        const parsed = serviceEndpointsSchema.safeParse(JSON.parse(raw));
        if (parsed.success) existing = parsed.data;
      } catch { }
    }

    if (!existing) {
      return { family: "integration", success: false, message: "No existing service-endpoints.json to update" };
    }

    const runtimeState: Record<string, { reachabilityStatus: string; lastVerifiedAt: string }> = {};
    let probeSuccessCount = 0;
    let probeAttemptCount = 0;

    for (const [key, endpoint] of Object.entries(existing.endpoints)) {
      probeAttemptCount++;
      try {
        const probeUrl = endpoint.urlTemplate
          .replace("{orgName}", "probe")
          .replace("{tenantName}", "probe");
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(probeUrl, {
          method: "HEAD",
          signal: controller.signal,
        }).catch(() => null);
        clearTimeout(tid);

        if (res) {
          let reachability: "reachable" | "limited" | "unreachable";
          if (res.ok || res.status === 401 || res.status === 403) {
            reachability = "reachable";
          } else if (res.status === 404) {
            reachability = "limited";
          } else {
            reachability = "unreachable";
          }

          runtimeState[key] = { reachabilityStatus: reachability, lastVerifiedAt: now };
          probeSuccessCount++;
        }
      } catch {
      }
    }

    if (probeSuccessCount === 0) {
      metadataService.recordRefreshResult("integration", false);
      return {
        family: "integration",
        success: false,
        message: `No endpoints could be probed (0/${probeAttemptCount} succeeded). Runtime state preserved from last successful verification.`,
      };
    }

    const allSucceeded = probeSuccessCount === probeAttemptCount;
    const runtimeSnapshot = {
      lastRefreshedAt: now,
      lastVerifiedAt: allSucceeded ? now : undefined,
      endpoints: runtimeState,
    };

    const runtimePath = join(CATALOG_DIR, "service-endpoints-runtime.json");
    atomicWrite(runtimePath, JSON.stringify(runtimeSnapshot, null, 2));
    metadataService.reload("integration");
    metadataService.recordRefreshResult("integration", true);

    return {
      family: "integration",
      success: true,
      message: `Probed ${probeSuccessCount}/${probeAttemptCount} endpoints${!allSucceeded ? " (partial)" : ""}. Runtime state saved separately from curated baseline.`,
      updatedAt: now,
    };
  } catch (err: any) {
    metadataService.recordRefreshResult("integration", false);
    return { family: "integration", success: false, message: `Integration refresh failed: ${err.message}` };
  }
}

export interface NewerLineDiscovery {
  packageId: string;
  currentLine: string;
  newerLine: string;
  latestVersion: string;
}

export interface NewerLineResult {
  newerLineAvailable: string | null;
  latestVersion: string | null;
  packages: NewerLineDiscovery[];
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

function extractMajorMinor(version: string): string | null {
  const parts = version.split(".");
  if (parts.length < 2) return null;
  return `${parts[0]}.${parts[1]}`;
}

async function fetchAllStableVersions(packageId: string): Promise<string[]> {
  try {
    const indexUrl = `${NUGET_V3_BASE}/${packageId.toLowerCase()}/index.json`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(indexUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return [];
    const data: any = await res.json();
    const versions: string[] = data.versions || [];
    return versions.filter(v => !v.includes("-"));
  } catch {
    return [];
  }
}

let _newerLineCache: { result: NewerLineResult; expiresAt: number } | null = null;
const NEWER_LINE_CACHE_TTL_MS = 10 * 60 * 1000;

export async function discoverNewerLines(): Promise<NewerLineResult> {
  if (_newerLineCache && Date.now() < _newerLineCache.expiresAt) {
    return _newerLineCache.result;
  }

  const currentTarget = metadataService.getStudioTarget();
  if (!currentTarget) {
    return { newerLineAvailable: null, latestVersion: null, packages: [] };
  }

  const currentLine = currentTarget.line;
  const currentParts = parseMajorMinor(currentLine);
  if (!currentParts) {
    return { newerLineAvailable: null, latestVersion: null, packages: [] };
  }

  const allVersions = await Promise.all(
    CORE_PACKAGES.map(async (pkgId) => ({ pkgId, versions: await fetchAllStableVersions(pkgId) }))
  );

  const discoveries: NewerLineDiscovery[] = [];

  for (const { pkgId, versions } of allVersions) {
    const newerLines = new Map<string, string>();

    for (const ver of versions) {
      const line = extractMajorMinor(ver);
      if (!line) continue;
      const lineParts = parseMajorMinor(line);
      if (!lineParts) continue;

      if (lineParts.major > currentParts.major ||
          (lineParts.major === currentParts.major && lineParts.minor > currentParts.minor)) {
        const existing = newerLines.get(line);
        if (!existing || compareVersions(ver, existing) > 0) {
          newerLines.set(line, ver);
        }
      }
    }

    for (const [line, latestVer] of newerLines) {
      discoveries.push({ packageId: pkgId, currentLine, newerLine: line, latestVersion: latestVer });
    }
  }

  let highestLine: string | null = null;
  let highestVersion: string | null = null;

  for (const d of discoveries) {
    if (!highestLine) {
      highestLine = d.newerLine;
      highestVersion = d.latestVersion;
    } else {
      const hParts = parseMajorMinor(highestLine);
      const cParts = parseMajorMinor(d.newerLine);
      if (hParts && cParts &&
          (cParts.major > hParts.major ||
           (cParts.major === hParts.major && cParts.minor > hParts.minor))) {
        highestLine = d.newerLine;
        highestVersion = d.latestVersion;
      }
    }
  }

  const result: NewerLineResult = { newerLineAvailable: highestLine, latestVersion: highestVersion, packages: discoveries };
  _newerLineCache = { result, expiresAt: Date.now() + NEWER_LINE_CACHE_TTL_MS };
  return result;
}

export async function refreshOidc(): Promise<RefreshResult> {
  try {
    const result = await metadataService.refreshFromOIDC();
    return {
      family: "integration",
      success: result.success,
      message: result.message,
      updatedAt: result.success ? new Date().toISOString() : undefined,
    };
  } catch (err: any) {
    return { family: "integration", success: false, message: `OIDC refresh failed: ${err.message}` };
  }
}

export async function refreshAll(): Promise<{ generation: RefreshResult; integration: RefreshResult; oidc?: RefreshResult; newerLines?: NewerLineResult }> {
  const [generation, integration, oidc] = await Promise.allSettled([
    refreshGeneration(),
    refreshIntegration(),
    refreshOidc(),
  ]);

  let newerLines: NewerLineResult | undefined;
  try {
    newerLines = await discoverNewerLines();
  } catch (err: any) {
    console.warn(`[MetadataRefresher] Newer-line discovery failed during refresh: ${err?.message || "unknown error"}`);
  }

  return {
    generation: generation.status === "fulfilled"
      ? generation.value
      : { family: "generation", success: false, message: `Unexpected error: ${(generation as PromiseRejectedResult).reason}` },
    integration: integration.status === "fulfilled"
      ? integration.value
      : { family: "integration", success: false, message: `Unexpected error: ${(integration as PromiseRejectedResult).reason}` },
    oidc: oidc.status === "fulfilled"
      ? oidc.value
      : { family: "integration", success: false, message: `OIDC unexpected error: ${(oidc as PromiseRejectedResult).reason}` },
    newerLines,
  };
}

let refreshInterval: ReturnType<typeof setInterval> | null = null;

export function startRefreshScheduler(intervalMs: number = 24 * 60 * 60 * 1000): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  refreshInterval = setInterval(async () => {
    console.log("[MetadataRefresher] Starting scheduled refresh...");
    const results = await refreshAll();
    if (results.generation.success) {
      console.log(`[MetadataRefresher] Generation refresh: ${results.generation.message}`);
    } else {
      console.warn(`[MetadataRefresher] Generation refresh failed: ${results.generation.message}`);
    }
    if (results.integration.success) {
      console.log(`[MetadataRefresher] Integration refresh: ${results.integration.message}`);
    } else {
      console.warn(`[MetadataRefresher] Integration refresh failed: ${results.integration.message}`);
    }
    if (results.oidc) {
      if (results.oidc.success) {
        console.log(`[MetadataRefresher] OIDC refresh: ${results.oidc.message}`);
      } else {
        console.warn(`[MetadataRefresher] OIDC refresh failed: ${results.oidc.message}`);
      }
    }
    if (results.newerLines?.newerLineAvailable) {
      console.warn(`[MetadataRefresher] NEWER STUDIO LINE DETECTED: ${results.newerLines.newerLineAvailable} (latest: ${results.newerLines.latestVersion}). Current catalog targets ${metadataService.getStudioTarget()?.line || "unknown"}. Consider upgrading the catalog to match the connected tenant's Studio version.`);
      for (const pkg of results.newerLines.packages) {
        console.warn(`[MetadataRefresher]   - ${pkg.packageId}: current line ${pkg.currentLine} → newer line ${pkg.newerLine} (latest ${pkg.latestVersion})`);
      }
    }
  }, intervalMs);
  console.log(`[MetadataRefresher] Scheduler started (interval: ${Math.round(intervalMs / 3600000)}h)`);
}

export function stopRefreshScheduler(): void {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
