import { writeFileSync, readFileSync, existsSync, renameSync } from "fs";
import { join } from "path";
import {
  generationMetadataSchema,
  serviceEndpointsSchema,
  CANONICAL_STUDIO_VERSION,
  type GenerationMetadata,
  type ServiceEndpoints,
  type VerificationSource,
} from "./metadata-schemas";
import { metadataService } from "./metadata-service";
import { generateAndWriteCatalog } from "./catalog-generator";

const CATALOG_DIR = join(process.cwd(), "catalog");

const NUGET_V3_BASE = "https://api.nuget.org/v3-flatcontainer";

const UIPATH_OFFICIAL_FEED_INDEX = "https://pkgs.dev.azure.com/uipath/Public.Feeds/_packaging/UiPath-Official/nuget/v3/index.json";
const UIPATH_MARKETPLACE_INDEX = "https://gallery.uipath.com/api/v3/index.json";

const CORE_PACKAGES = [
  "UiPath.System.Activities",
  "UiPath.UIAutomation.Activities",
];

const MARKETPLACE_PACKAGES: string[] = [];

interface RefreshResult {
  family: "generation" | "integration";
  success: boolean;
  message: string;
  updatedAt?: string;
}

interface FeedResolution {
  preferred: string;
  source: VerificationSource;
  usedFallback: boolean;
}

type FeedFetchResult = { status: "ok"; versions: string[] } | { status: "unreachable" };

const ACTIVITY_PACKAGE_EXCLUSIONS = [
  "UiPath.Studio",
  "UiPath.Robot",
  "UiPath.Orchestrator",
  "UiPath.Platform",
  "UiPath.DesignCenter",
  "UiPath.CoreIpc",
  "UiPath.Activities.Api",
  "UiPath.Activities.Contracts",
  "UiPath.Activities.RuntimeGovernance",
  "UiPath.Telemetry.",
  "UiPath.OpenTelemetry",
  "UiPath.System.Runtime",
  "UiPath.Serverless.",
  "UiPath.Integration.Api.Client",
  "UiPath.IntegrationService.Client",
  "UiPath.IntegrationService.Adapters",
  "UiPath.IntegrationService.Infrastructure",
  "UiPath.ConnectionClient",
  "UiPath.Driver.",
  "UiPath.EmguCVBundle",
  "UiPath.CefSharpBundle",
  "UiPath.AppSignatures",
  "UiPath.BAF",
  "UiPath.ErrorInfo",
  "UiPath.FeatureFlagsService",
  "UiPath.ImageProcessing",
  "UiPath.OfficeLibs",
  "UiPath.OmniPage.Bundle",
  "UiPath.Vision",
  "UiPath.Plugin.",
  "UiPath.CLI",
  "UiPath.ClipboardAI",
  "UiPath.CodedWorkflows",
  "UiPath.StudioWeb",
  "UiPath.SolutionAccelerators",
  "UiPath.OCR.Contracts",
  "UiPath.DocumentProcessing.Contracts",
  "UiPath.DocumentUnderstanding.Common.SDK",
  "UiPath.DocumentUnderstanding.Digitizer",
  "UiPath.DocumentUnderstanding.OCR.LocalServer",
  "UiPath.DocumentUnderstanding.Orchestrator",
  "UiPath.ComputerVision.LocalServer",
  "UiPath.Atlassian.Jira.SDK",
  "UiPath.FormActivityLibrary",
  "UiPath.IPC.",
  "UiPath.LanguageModel.",
];

const RUNTIME_TEST_SUFFIXES = [
  ".Runtime",
  ".Runtime.",
  ".Design",
  ".DesignExperience",
  "RuntimeTests_portable",
  "RuntimeTests_windows",
  ".Bootstrap",
  ".RecoveryPanel",
];

function isActivityPackage(packageId: string): boolean {
  if (ACTIVITY_PACKAGE_EXCLUSIONS.some(excl => packageId.startsWith(excl))) {
    return false;
  }
  if (RUNTIME_TEST_SUFFIXES.some(suffix => packageId.endsWith(suffix) || packageId.includes(suffix))) {
    return false;
  }
  if (packageId.includes("Activities")) {
    return true;
  }
  const knownActivityPatterns = [
    "UiPath.Credentials.",
    "UiPath.CV.",
  ];
  if (knownActivityPatterns.some(p => packageId.startsWith(p))) {
    return true;
  }
  return false;
}

type PackageCategory = "official-uipath" | "marketplace" | "general";

function classifyPackage(packageId: string): PackageCategory {
  if (MARKETPLACE_PACKAGES.includes(packageId)) {
    return "marketplace";
  }
  if (packageId.startsWith("UiPath.")) {
    return "official-uipath";
  }
  return "general";
}

function parseMajorMinor(version: string): { major: number; minor: number } | null {
  const parts = version.split(".");
  if (parts.length < 2) return null;
  const major = parseInt(parts[0], 10);
  const minor = parseInt(parts[1], 10);
  if (isNaN(major) || isNaN(minor)) return null;
  return { major, minor };
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

let _serviceIndexCache: Map<string, { packageBaseAddress: string; expiresAt: number }> = new Map();
const SERVICE_INDEX_CACHE_TTL_MS = 30 * 60 * 1000;

interface ServiceIndexResolution {
  packageBaseAddress: string | null;
  registrationsBaseUrl: string | null;
  searchQueryServiceUrl: string | null;
}

let _serviceIndexDetailCache: Map<string, { resolution: ServiceIndexResolution; expiresAt: number }> = new Map();

async function resolveServiceIndex(feedIndexUrl: string): Promise<ServiceIndexResolution | null> {
  const cached = _serviceIndexDetailCache.get(feedIndexUrl);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.resolution;
  }

  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(feedIndexUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return null;
    const data: any = await res.json();
    const resources: any[] = data.resources || [];

    let packageBaseAddress: string | null = null;
    let registrationsBaseUrl: string | null = null;
    let searchQueryServiceUrl: string | null = null;

    for (const resource of resources) {
      const type = resource["@type"];
      if (typeof type !== "string") continue;

      if (!packageBaseAddress && type.startsWith("PackageBaseAddress")) {
        packageBaseAddress = resource["@id"];
      }
      if (!registrationsBaseUrl && type.startsWith("RegistrationsBaseUrl")) {
        registrationsBaseUrl = resource["@id"];
      }
      if (!searchQueryServiceUrl && type.startsWith("SearchQueryService")) {
        searchQueryServiceUrl = resource["@id"];
      }
    }

    if (!packageBaseAddress) {
      for (const resource of resources) {
        const type = resource["@type"];
        if (typeof type === "string" && type.includes("PackageBaseAddress")) {
          packageBaseAddress = resource["@id"];
          break;
        }
      }
    }

    if (!registrationsBaseUrl) {
      for (const resource of resources) {
        const type = resource["@type"];
        if (typeof type === "string" && type.includes("RegistrationsBaseUrl")) {
          registrationsBaseUrl = resource["@id"];
          break;
        }
      }
    }

    if (!searchQueryServiceUrl) {
      for (const resource of resources) {
        const type = resource["@type"];
        if (typeof type === "string" && type.includes("SearchQueryService")) {
          searchQueryServiceUrl = resource["@id"];
          break;
        }
      }
    }

    if (packageBaseAddress && !packageBaseAddress.endsWith("/")) {
      packageBaseAddress += "/";
    }
    if (registrationsBaseUrl && !registrationsBaseUrl.endsWith("/")) {
      registrationsBaseUrl += "/";
    }

    const resolution: ServiceIndexResolution = { packageBaseAddress, registrationsBaseUrl, searchQueryServiceUrl };

    if (packageBaseAddress || registrationsBaseUrl || searchQueryServiceUrl) {
      _serviceIndexDetailCache.set(feedIndexUrl, {
        resolution,
        expiresAt: Date.now() + SERVICE_INDEX_CACHE_TTL_MS,
      });
    }

    return resolution;
  } catch {
    return null;
  }
}

async function resolvePackageBaseAddress(feedIndexUrl: string): Promise<string | null> {
  const cached = _serviceIndexCache.get(feedIndexUrl);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.packageBaseAddress;
  }

  const index = await resolveServiceIndex(feedIndexUrl);
  if (!index) return null;

  if (index.packageBaseAddress) {
    _serviceIndexCache.set(feedIndexUrl, {
      packageBaseAddress: index.packageBaseAddress,
      expiresAt: Date.now() + SERVICE_INDEX_CACHE_TTL_MS,
    });
    return index.packageBaseAddress;
  }

  return null;
}

async function fetchVersionsViaRegistrations(
  registrationsBaseUrl: string,
  packageId: string,
): Promise<FeedFetchResult> {
  try {
    const regUrl = `${registrationsBaseUrl}${packageId.toLowerCase()}/index.json`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(regUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) {
      if (res.status === 404) return { status: "ok", versions: [] };
      return { status: "unreachable" };
    }
    const data: any = await res.json();
    const items: any[] = data.items || [];
    const versions: string[] = [];
    for (const page of items) {
      const pageItems: any[] = page.items || [];
      for (const entry of pageItems) {
        const catalogEntry = entry.catalogEntry || entry;
        const version = catalogEntry.version;
        if (typeof version === "string") {
          versions.push(version);
        }
      }
    }
    return { status: "ok", versions: versions.filter(v => !v.includes("-")) };
  } catch {
    return { status: "unreachable" };
  }
}

async function fetchVersionsViaSearchQuery(
  searchQueryServiceUrl: string,
  packageId: string,
): Promise<FeedFetchResult> {
  try {
    const searchUrl = `${searchQueryServiceUrl}?q=${encodeURIComponent(packageId)}&prerelease=false&take=20`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return { status: "unreachable" };
    const data: any = await res.json();
    const results: any[] = data.data || [];
    const match = results.find((r: any) =>
      typeof r.id === "string" && r.id.toLowerCase() === packageId.toLowerCase()
    );
    if (!match) return { status: "ok", versions: [] };
    const versionEntries: any[] = match.versions || [];
    const versions = versionEntries
      .map((v: any) => v.version)
      .filter((v: string) => typeof v === "string" && !v.includes("-"));
    return { status: "ok", versions };
  } catch {
    return { status: "unreachable" };
  }
}

async function discoverPackagesViaSearch(
  searchQueryServiceUrl: string,
  queryPrefix: string,
  take: number = 100,
): Promise<{ status: "ok"; packageIds: string[] } | { status: "unreachable" }> {
  try {
    const allPackageIds: string[] = [];
    let skip = 0;
    const maxPages = 5;

    for (let page = 0; page < maxPages; page++) {
      const searchUrl = `${searchQueryServiceUrl}?q=${encodeURIComponent(queryPrefix)}&prerelease=false&take=${take}&skip=${skip}`;
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(searchUrl, { signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) return { status: "unreachable" };
      const data: any = await res.json();
      const results: any[] = data.data || [];
      if (results.length === 0) break;

      for (const result of results) {
        if (typeof result.id === "string" && result.id.startsWith("UiPath.") && isActivityPackage(result.id)) {
          allPackageIds.push(result.id);
        }
      }

      if (results.length < take) break;
      skip += take;
    }

    return { status: "ok", packageIds: allPackageIds };
  } catch {
    return { status: "unreachable" };
  }
}

interface DiscoveryResult {
  newEntries: Record<string, {
    preferred: string;
    lastVerifiedAt: string;
    verificationSource: VerificationSource;
    discoveredAt: string;
  }>;
  count: number;
}

function isDelistedInMetadata(packageId: string, existingRanges: Record<string, any>): boolean {
  const entry = existingRanges[packageId];
  return entry?.feedStatus === "delisted";
}

async function discoverAndResolveNewPackages(
  searchQueryServiceUrl: string,
  existingRanges: Record<string, any>,
  _studioLine: string,
  now: string,
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = { newEntries: {}, count: 0 };

  const allDiscoveredIds = new Set<string>();
  const searchQueries = [
    "UiPath",
    "UiPath.IntegrationService",
    "UiPath.Amazon",
    "UiPath.Azure",
    "UiPath.Google",
    "UiPath.Microsoft",
    "UiPath.Salesforce",
    "UiPath.Oracle",
    "UiPath.SAP",
    "UiPath.Document",
  ];

  for (const query of searchQueries) {
    const disc = await discoverPackagesViaSearch(searchQueryServiceUrl, query, 100);
    if (disc.status === "ok") {
      for (const id of disc.packageIds) {
        allDiscoveredIds.add(id);
      }
    }
  }

  if (allDiscoveredIds.size === 0) return result;

  const discovery = { status: "ok" as const, packageIds: Array.from(allDiscoveredIds) };

  for (const pkgId of discovery.packageIds) {
    if (isDelistedInMetadata(pkgId, existingRanges)) {
      console.log(`[MetadataRefresher] Skipping ${pkgId} — previously delisted, requires manual re-approval`);
      continue;
    }

    if (existingRanges[pkgId]) continue;

    const versionResult = await fetchVersionsViaSearchQuery(searchQueryServiceUrl, pkgId);
    if (versionResult.status !== "ok" || versionResult.versions.length === 0) continue;

    const stableVersions = versionResult.versions.filter(v => !v.includes("-"));
    if (stableVersions.length === 0) continue;

    const sorted = [...stableVersions].sort(compareVersions);
    const bestPreferred = sorted[sorted.length - 1];

    result.newEntries[pkgId] = {
      preferred: bestPreferred,
      lastVerifiedAt: now,
      verificationSource: "uipath-official-feed" as VerificationSource,
      discoveredAt: now,
    };
    result.count++;
  }

  return result;
}

async function fetchVersionsFromV3Feed(
  feedIndexUrl: string,
  packageId: string,
): Promise<FeedFetchResult> {
  const serviceIndex = await resolveServiceIndex(feedIndexUrl);
  if (!serviceIndex) return { status: "unreachable" };

  if (serviceIndex.searchQueryServiceUrl) {
    const searchResult = await fetchVersionsViaSearchQuery(serviceIndex.searchQueryServiceUrl, packageId);
    if (searchResult.status === "ok" && searchResult.versions.length > 0) {
      return searchResult;
    }
    if (searchResult.status === "ok" && searchResult.versions.length === 0) {
      if (serviceIndex.registrationsBaseUrl) {
        const regResult = await fetchVersionsViaRegistrations(serviceIndex.registrationsBaseUrl, packageId);
        if (regResult.status === "ok" && regResult.versions.length > 0) return regResult;
      }
      return searchResult;
    }
  }

  if (serviceIndex.registrationsBaseUrl) {
    const regResult = await fetchVersionsViaRegistrations(serviceIndex.registrationsBaseUrl, packageId);
    if (regResult.status === "ok" && regResult.versions.length > 0) return regResult;
  }

  return { status: "unreachable" };
}

async function fetchVersionsFromNugetFlatContainer(
  packageId: string,
): Promise<FeedFetchResult> {
  try {
    const indexUrl = `${NUGET_V3_BASE}/${packageId.toLowerCase()}/index.json`;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(indexUrl, { signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) {
      if (res.status === 404) {
        return { status: "ok", versions: [] };
      }
      return { status: "unreachable" };
    }
    const data: any = await res.json();
    const versions: string[] = data.versions || [];
    return { status: "ok", versions: versions.filter(v => !v.includes("-")) };
  } catch {
    return { status: "unreachable" };
  }
}

function resolveLatestStable(
  versions: string[],
): string | null {
  const stable = versions
    .filter(v => !v.includes("-"))
    .sort(compareVersions);

  if (stable.length === 0) return null;
  return stable[stable.length - 1];
}

async function resolvePackageFromFeeds(
  packageId: string,
  category: PackageCategory,
  existingPreferred: string | null,
  existingSource: VerificationSource | null,
): Promise<FeedResolution | null> {
  if (category === "official-uipath") {
    const officialResult = await fetchVersionsFromV3Feed(UIPATH_OFFICIAL_FEED_INDEX, packageId);

    if (officialResult.status === "ok") {
      if (officialResult.versions.length > 0) {
        const latest = resolveLatestStable(officialResult.versions);
        if (latest) {
          return { preferred: latest, source: "uipath-official-feed", usedFallback: false };
        }
      }
      return null;
    }

    console.warn(`[MetadataRefresher] UiPath Official feed unreachable for ${packageId}, falling back to nuget.org`);

    const nugetResult = await fetchVersionsFromNugetFlatContainer(packageId);
    if (nugetResult.status === "ok" && nugetResult.versions.length > 0) {
      const latest = resolveLatestStable(nugetResult.versions);
      if (latest) {
        return { preferred: latest, source: "nuget-feed", usedFallback: true };
      }
    }

    if (existingPreferred && existingSource) {
      console.warn(`[MetadataRefresher] No restorable version found on fallback feeds for ${packageId}, using last-known-good cached version`);
      return { preferred: existingPreferred, source: existingSource, usedFallback: true };
    }

    return null;
  }

  if (category === "marketplace") {
    const marketplaceResult = await fetchVersionsFromV3Feed(UIPATH_MARKETPLACE_INDEX, packageId);

    if (marketplaceResult.status === "ok") {
      if (marketplaceResult.versions.length > 0) {
        const latest = resolveLatestStable(marketplaceResult.versions);
        if (latest) {
          return { preferred: latest, source: "uipath-marketplace", usedFallback: false };
        }
      }
      return null;
    }

    console.warn(`[MetadataRefresher] Marketplace feed unreachable for ${packageId}, falling back to nuget.org`);
    const nugetResult = await fetchVersionsFromNugetFlatContainer(packageId);
    if (nugetResult.status === "ok" && nugetResult.versions.length > 0) {
      const latest = resolveLatestStable(nugetResult.versions);
      if (latest) {
        return { preferred: latest, source: "nuget-feed", usedFallback: true };
      }
    }

    if (existingPreferred && existingSource) {
      console.warn(`[MetadataRefresher] No restorable version found on fallback feeds for ${packageId}, using last-known-good cached version`);
      return { preferred: existingPreferred, source: existingSource, usedFallback: true };
    }

    return null;
  }

  const nugetResult = await fetchVersionsFromNugetFlatContainer(packageId);
  if (nugetResult.status === "ok" && nugetResult.versions.length > 0) {
    const latest = resolveLatestStable(nugetResult.versions);
    if (latest) {
      return { preferred: latest, source: "nuget-feed", usedFallback: false };
    }
  }

  if (existingPreferred && existingSource) {
    const reason = nugetResult.status === "unreachable" ? "unreachable" : "has no compatible versions";
    console.warn(`[MetadataRefresher] nuget.org ${reason} for ${packageId}, using last-known-good cached version`);
    return { preferred: existingPreferred, source: existingSource, usedFallback: true };
  }

  return null;
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
    let fallbackCount = 0;
    let failedPackages: string[] = [];
    let delistedPackages: string[] = [];
    const allPackageNames = Object.keys(updatedRanges);

    for (const pkgName of allPackageNames) {
      const existingRange = updatedRanges[pkgName];
      if (!existingRange) continue;

      const category = classifyPackage(pkgName);
      const resolution = await resolvePackageFromFeeds(
        pkgName,
        category,
        existingRange.preferred,
        existingRange.verificationSource,
      );

      if (resolution) {
        const previousPreferred = existingRange.preferred;
        const newPreferred = resolution.preferred;

        if (resolution.usedFallback) {
          fallbackCount++;
          console.warn(`[MetadataRefresher] ${pkgName}: resolved via fallback (${resolution.source})`);
        }

        if (previousPreferred !== newPreferred && compareVersions(newPreferred, previousPreferred) < 0) {
          console.warn(`[MetadataRefresher] ${pkgName}: preferred version downgraded from ${previousPreferred} to ${newPreferred} (unavailable on ${resolution.source})`);
        }

        updatedRanges[pkgName] = {
          ...updatedRanges[pkgName],
          preferred: resolution.preferred,
          lastVerifiedAt: now,
          verificationSource: resolution.source,
          feedStatus: "active",
        };
        if (existingRange.feedStatus === "delisted") {
          delete (updatedRanges[pkgName] as any).delistedAt;
          console.log(`[MetadataRefresher] ${pkgName}: previously delisted package is now available again on feed`);
        }
        updatedCount++;
      } else {
        const wasAlreadyDelisted = existingRange.feedStatus === "delisted";
        updatedRanges[pkgName] = {
          ...updatedRanges[pkgName],
          feedStatus: "delisted",
          ...(!wasAlreadyDelisted ? { delistedAt: now } : {}),
        };
        if (!wasAlreadyDelisted) {
          console.warn(`[MetadataRefresher] WARNING: ${pkgName} detected as DELISTED — 0 versions / 404 from all authoritative feeds. Package preserved for diagnostics but excluded from generation guidance.`);
        }
        delistedPackages.push(pkgName);
        updatedCount++;
      }
    }

    let discoveredCount = 0;
    try {
      const serviceIndex = await resolveServiceIndex(UIPATH_OFFICIAL_FEED_INDEX);
      if (serviceIndex?.searchQueryServiceUrl) {
        const discResult = await discoverAndResolveNewPackages(
          serviceIndex.searchQueryServiceUrl,
          updatedRanges,
          existing.studioTarget?.line || "25.10",
          now,
        );
        for (const [pkgId, entry] of Object.entries(discResult.newEntries)) {
          updatedRanges[pkgId] = entry;
          discoveredCount++;
          updatedCount++;
          console.log(`[MetadataRefresher] DISCOVERED new package: ${pkgId} → preferred ${entry.preferred}`);
        }
      }
    } catch (err: any) {
      console.warn(`[MetadataRefresher] Dynamic package discovery failed (non-fatal): ${err?.message || "unknown"}`);
    }

    const requiredPackages = existing.minimumRequiredPackages || [];
    const unresolvableRequired = requiredPackages.filter(pkg => failedPackages.includes(pkg) && !delistedPackages.includes(pkg));
    if (unresolvableRequired.length > 0) {
      metadataService.recordRefreshResult("generation", false);
      return {
        family: "generation",
        success: false,
        message: `Package generation blocked: required dependencies cannot be resolved to a restorable version on any authoritative feed: ${unresolvableRequired.join(", ")}`,
      };
    }

    if (updatedCount === 0) {
      metadataService.recordRefreshResult("generation", false);
      return {
        family: "generation",
        success: false,
        message: `No package versions could be verified from any feed (0/${allPackageNames.length} succeeded). Timestamps preserved from last successful verification.`,
      };
    }

    const isPartial = updatedCount < allPackageNames.length;
    const updated: GenerationMetadata = {
      ...existing,
      studioTarget: {
        ...existing.studioTarget,
        version: CANONICAL_STUDIO_VERSION,
      },
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

    try {
      const genResult = generateAndWriteCatalog();
      console.log(`[MetadataRefresher] Regenerated activity catalog after generation refresh: ${genResult.packages} packages, ${genResult.activities} activities`);
    } catch (genErr: any) {
      console.warn(`[MetadataRefresher] Failed to regenerate activity catalog after generation refresh: ${genErr.message}`);
    }

    let statusParts: string[] = [];
    statusParts.push(`Updated ${updatedCount}/${Object.keys(updatedRanges).length} packages`);
    if (discoveredCount > 0) {
      statusParts.push(`${discoveredCount} newly discovered via search API`);
    }
    if (fallbackCount > 0) {
      statusParts.push(`${fallbackCount} via nuget.org fallback`);
    }
    if (delistedPackages.length > 0) {
      statusParts.push(`${delistedPackages.length} delisted: ${delistedPackages.join(", ")}`);
    }
    if (failedPackages.length > 0) {
      statusParts.push(`${failedPackages.length} unresolvable (non-required): ${failedPackages.join(", ")}`);
    }
    if (isPartial) {
      statusParts.push("partial — snapshot-level verification timestamp preserved");
    }

    return {
      family: "generation",
      success: true,
      message: statusParts.join("; "),
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

function extractMajorMinor(version: string): string | null {
  const parts = version.split(".");
  if (parts.length < 2) return null;
  return `${parts[0]}.${parts[1]}`;
}

async function fetchAllStableVersions(packageId: string): Promise<string[]> {
  const category = classifyPackage(packageId);

  if (category === "official-uipath") {
    const officialResult = await fetchVersionsFromV3Feed(UIPATH_OFFICIAL_FEED_INDEX, packageId);
    if (officialResult.status === "ok" && officialResult.versions.length > 0) {
      return officialResult.versions;
    }
    if (officialResult.status === "unreachable") {
      console.warn(`[MetadataRefresher] fetchAllStableVersions: UiPath Official feed unreachable for ${packageId}, falling back to nuget.org`);
      const nugetResult = await fetchVersionsFromNugetFlatContainer(packageId);
      return nugetResult.status === "ok" ? nugetResult.versions : [];
    }
    return [];
  }

  if (category === "marketplace") {
    const marketplaceResult = await fetchVersionsFromV3Feed(UIPATH_MARKETPLACE_INDEX, packageId);
    if (marketplaceResult.status === "ok" && marketplaceResult.versions.length > 0) {
      return marketplaceResult.versions;
    }
    if (marketplaceResult.status === "unreachable") {
      const nugetResult = await fetchVersionsFromNugetFlatContainer(packageId);
      return nugetResult.status === "ok" ? nugetResult.versions : [];
    }
    return [];
  }

  const nugetResult = await fetchVersionsFromNugetFlatContainer(packageId);
  return nugetResult.status === "ok" ? nugetResult.versions : [];
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

export async function verifyPreferredVersionsOnStartup(): Promise<{ verified: number; corrected: number; upgraded: number; unreachable: number; details: string[] }> {
  const details: string[] = [];
  let verified = 0;
  let corrected = 0;
  let upgraded = 0;
  let unreachable = 0;

  const existingPath = join(CATALOG_DIR, "generation-metadata.json");
  if (!existsSync(existingPath)) {
    details.push("No generation-metadata.json found — skipping feed availability check");
    return { verified: 0, corrected: 0, upgraded: 0, unreachable: 0, details };
  }

  let existing: GenerationMetadata | null = null;
  try {
    const raw = readFileSync(existingPath, "utf-8");
    const parsed = generationMetadataSchema.safeParse(JSON.parse(raw));
    if (parsed.success) existing = parsed.data;
  } catch { }

  if (!existing) {
    details.push("generation-metadata.json could not be parsed — skipping feed availability check");
    return { verified: 0, corrected: 0, upgraded: 0, unreachable: 0, details };
  }

  const requiredPackages = existing.minimumRequiredPackages || [];
  let needsWrite = false;

  for (const pkgName of Object.keys(existing.packageVersionRanges)) {
    const entry = existing.packageVersionRanges[pkgName];
    const preferred = entry.preferred;

    const category = classifyPackage(pkgName);
    const isCurated = entry.verificationSource === "studio-bundled";

    let feedResult: FeedFetchResult = { status: "unreachable" };
    if (category === "official-uipath") {
      feedResult = await fetchVersionsFromV3Feed(UIPATH_OFFICIAL_FEED_INDEX, pkgName);
      if (feedResult.status === "unreachable" || (feedResult.status === "ok" && feedResult.versions.length === 0)) {
        feedResult = await fetchVersionsFromNugetFlatContainer(pkgName);
      }
    } else if (category === "general") {
      feedResult = await fetchVersionsFromNugetFlatContainer(pkgName);
    }

    if (feedResult.status !== "ok" || (feedResult.status === "ok" && feedResult.versions.length === 0)) {
      if (isCurated) {
        const msg = `[FeedCheck] INFO: ${pkgName}@${preferred} confirmed absent from public feeds (studio-bundled package, distributed via authenticated Studio channel)`;
        details.push(msg);
        verified++;
        continue;
      }
      unreachable++;
      const isRequired = requiredPackages.includes(pkgName);
      const level = isRequired ? "ERROR" : "WARNING";
      const msg = `[FeedCheck] ${level}: Cannot verify ${pkgName}@${preferred} — feeds unreachable`;
      console.warn(msg);
      details.push(msg);
      continue;
    }

    const stableOnFeed = feedResult.versions
      .filter(v => !v.includes("-"))
      .sort(compareVersions);
    const latestStable = stableOnFeed.length > 0 ? stableOnFeed[stableOnFeed.length - 1] : null;

    if (!latestStable) {
      if (feedResult.versions.includes(preferred)) {
        verified++;
        continue;
      }
      const isRequired = requiredPackages.includes(pkgName);
      const level = isRequired ? "ERROR" : "WARNING";
      const msg = `[FeedCheck] ${level}: ${pkgName} preferred ${preferred} — no stable version found on feed`;
      console.warn(msg);
      details.push(msg);
      continue;
    }

    if (latestStable === preferred) {
      verified++;
      continue;
    }

    if (compareVersions(latestStable, preferred) > 0) {
      const msg = `[FeedCheck] UPGRADED: ${pkgName} preferred ${preferred} → ${latestStable}`;
      console.log(msg);
      details.push(msg);
      existing.packageVersionRanges[pkgName] = {
        ...entry,
        preferred: latestStable,
        lastVerifiedAt: new Date().toISOString(),
      };
      upgraded++;
      needsWrite = true;
    } else if (!feedResult.versions.includes(preferred)) {
      const msg = `[FeedCheck] CORRECTED: ${pkgName} preferred ${preferred} not found on feed — auto-corrected to ${latestStable}`;
      console.warn(msg);
      details.push(msg);
      existing.packageVersionRanges[pkgName] = {
        ...entry,
        preferred: latestStable,
        lastVerifiedAt: new Date().toISOString(),
      };
      corrected++;
      needsWrite = true;
    } else {
      verified++;
    }
  }

  if (needsWrite) {
    try {
      const updated = { ...existing, lastRefreshedAt: new Date().toISOString() };
      const validation = generationMetadataSchema.safeParse(updated);
      if (validation.success) {
        atomicWrite(existingPath, JSON.stringify(updated, null, 2));
        metadataService.reload("generation");
        details.push(`[FeedCheck] Updated generation-metadata.json with ${upgraded} upgraded and ${corrected} corrected version(s)`);

        try {
          const genResult = generateAndWriteCatalog();
          details.push(`[FeedCheck] Regenerated activity catalog: ${genResult.packages} packages, ${genResult.activities} activities`);
        } catch (genErr: any) {
          details.push(`[FeedCheck] Failed to regenerate activity catalog: ${genErr.message}`);
        }
      }
    } catch (err: any) {
      details.push(`[FeedCheck] Failed to write corrected metadata: ${err.message}`);
    }
  }

  if (verified > 0 || corrected > 0 || upgraded > 0) {
    console.log(`[FeedCheck] Startup verification complete: ${verified} verified, ${upgraded} upgraded, ${corrected} corrected, ${unreachable} unreachable`);
  }

  return { verified, corrected, upgraded, unreachable, details };
}

export async function runStartupDiscovery(): Promise<void> {
  try {
    const existingPath = join(CATALOG_DIR, "generation-metadata.json");
    if (!existsSync(existingPath)) return;
    const existingRaw = JSON.parse(readFileSync(existingPath, "utf-8"));
    const parseResult = generationMetadataSchema.safeParse(existingRaw);
    if (!parseResult.success) return;
    const existing = parseResult.data;
    const currentRanges = { ...existing.packageVersionRanges };

    const serviceIndex = await resolveServiceIndex(UIPATH_OFFICIAL_FEED_INDEX);
    if (!serviceIndex?.searchQueryServiceUrl) {
      console.log("[Discovery] No SearchQueryService available, skipping discovery");
      return;
    }

    const now = new Date().toISOString();
    const discResult = await discoverAndResolveNewPackages(
      serviceIndex.searchQueryServiceUrl,
      currentRanges,
      existing.studioTarget?.line || "25.10",
      now,
    );

    if (discResult.count > 0) {
      for (const [pkgId, entry] of Object.entries(discResult.newEntries)) {
        currentRanges[pkgId] = entry;
      }
      const updated = {
        ...existing,
        packageVersionRanges: currentRanges,
        lastRefreshedAt: now,
      };
      const validation = generationMetadataSchema.safeParse(updated);
      if (validation.success) {
        atomicWrite(existingPath, JSON.stringify(updated, null, 2));
        metadataService.reload("generation");
        console.log(`[Discovery] Expanded catalog with ${discResult.count} new packages (total: ${Object.keys(currentRanges).length})`);

        try {
          const genResult = generateAndWriteCatalog();
          console.log(`[Discovery] Regenerated activity catalog: ${genResult.packages} packages, ${genResult.activities} activities`);
        } catch (genErr: any) {
          console.warn(`[Discovery] Failed to regenerate activity catalog: ${genErr.message}`);
        }
      } else {
        console.warn(`[Discovery] Validation failed after adding ${discResult.count} packages: ${validation.error.message}`);
      }
    } else {
      console.log(`[Discovery] No new packages found (catalog already has ${Object.keys(currentRanges).length} packages)`);
    }
  } catch (err: any) {
    console.warn(`[Discovery] Startup discovery failed: ${err.message}`);
  }
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
