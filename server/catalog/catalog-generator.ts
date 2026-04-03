import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  ACTIVITY_DEFINITIONS_REGISTRY,
  getRegistryPackageIds,
  getTotalRegistryActivityCount,
  type ActivityPropertyDef,
  type ActivityDef,
} from "./activity-definitions";
import type {
  CatalogProperty,
  CatalogActivity,
  CatalogPackage,
  ActivityCatalog,
} from "./catalog-service";
import { PACKAGE_NAMESPACE_MAP } from "../xaml/xaml-compliance";
import { CANONICAL_STUDIO_VERSION } from "./metadata-schemas";

const CATALOG_VERSION = "2.0.0";

const PACKAGE_NAMESPACE_DEFAULTS: Record<string, { prefix: string; clrNamespace: string; assembly: string }> = (() => {
  const defaults: Record<string, { prefix: string; clrNamespace: string; assembly: string }> = {};
  for (const [packageId, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
    defaults[packageId] = { prefix: info.prefix, clrNamespace: info.clrNamespace, assembly: info.assembly };
  }
  return defaults;
})();

function convertProperty(p: ActivityPropertyDef): CatalogProperty {
  const result: CatalogProperty = {
    name: p.name,
    direction: p.direction,
    clrType: p.clrType,
    xamlSyntax: p.xamlSyntax,
    argumentWrapper: p.argumentWrapper,
    typeArguments: p.typeArguments,
    required: p.required,
  };
  if (p.validValues && p.validValues.length > 0) {
    result.validValues = p.validValues;
  }
  if (p.default !== undefined) {
    result.default = p.default;
  }
  return result;
}

function convertActivity(a: ActivityDef): CatalogActivity {
  const result: CatalogActivity = {
    className: a.className,
    displayName: a.displayName,
    browsable: a.browsable,
    processTypes: a.processTypes,
    properties: a.properties.map(convertProperty),
    emissionApproved: a.emissionApproved,
  };
  if (a.propertiesComplete) {
    result.propertiesComplete = true;
  }
  return result;
}

function resolveVersion(
  packageId: string,
  metadataPackages: Record<string, any> | null,
): { version: string; feedStatus: "verified" | "unverified"; preferred: string } {
  if (metadataPackages && metadataPackages[packageId]) {
    const entry = metadataPackages[packageId];
    const preferred = entry.preferred || entry.min || "1.0.0";
    const isVerified = !!entry.lastVerifiedAt && entry.verificationSource === "uipath-official-feed";
    return {
      version: preferred,
      feedStatus: isVerified ? "verified" : "unverified",
      preferred,
    };
  }
  return { version: "1.0.0", feedStatus: "unverified", preferred: "1.0.0" };
}

export interface GenerateCatalogOptions {
  preserveExisting?: boolean;
  existingCatalogPath?: string;
  metadataPath?: string;
  outputPath?: string;
  studioVersion?: string;
}

export function generateActivityCatalog(options: GenerateCatalogOptions = {}): ActivityCatalog {
  const {
    preserveExisting = true,
    existingCatalogPath = join(process.cwd(), "catalog", "activity-catalog.json"),
    metadataPath = join(process.cwd(), "catalog", "generation-metadata.json"),
    studioVersion = CANONICAL_STUDIO_VERSION,
  } = options;

  let metadataPackages: Record<string, any> | null = null;
  let resolvedStudioVersion = studioVersion;
  if (existsSync(metadataPath)) {
    try {
      const raw = JSON.parse(readFileSync(metadataPath, "utf-8"));
      metadataPackages = raw.packageVersionRanges || null;
      if (raw.studioTarget?.version) {
        resolvedStudioVersion = raw.studioTarget.version;
      }
    } catch (e) {}
  }

  const existingPackageMap = new Map<string, CatalogPackage>();
  if (preserveExisting && existsSync(existingCatalogPath)) {
    try {
      const existingCatalog = JSON.parse(readFileSync(existingCatalogPath, "utf-8")) as ActivityCatalog;
      for (const pkg of existingCatalog.packages) {
        existingPackageMap.set(pkg.packageId, pkg);
      }
      console.log(`[Catalog Generator] Loaded ${existingPackageMap.size} existing packages from catalog`);
    } catch (e: any) {
      console.warn(`[Catalog Generator] Failed to load existing catalog: ${e.message}`);
    }
  }

  const packages: CatalogPackage[] = [];

  function ensureEmissionApproved(act: CatalogActivity): CatalogActivity {
    if (act.emissionApproved === undefined) {
      // Preserved activities without explicit emissionApproved are not approved by default
      return { ...act, emissionApproved: false };
    }
    return act;
  }

  for (const [pkgId, existingPkg] of existingPackageMap) {
    const hasRegistryDef = ACTIVITY_DEFINITIONS_REGISTRY.some(r => r.packageId === pkgId);
    if (!hasRegistryDef) {
      const vInfo = resolveVersion(pkgId, metadataPackages);
      packages.push({
        ...existingPkg,
        version: vInfo.version,
        feedStatus: vInfo.feedStatus,
        preferredVersion: vInfo.preferred,
        activities: existingPkg.activities.map(ensureEmissionApproved),
      });
    }
  }

  for (const regPkg of ACTIVITY_DEFINITIONS_REGISTRY) {
    const vInfo = resolveVersion(regPkg.packageId, metadataPackages);
    const existingPkg = existingPackageMap.get(regPkg.packageId);
    const nsDefaults = PACKAGE_NAMESPACE_DEFAULTS[regPkg.packageId];

    if (existingPkg) {
      const registryClassNames = new Set(regPkg.activities.map(a => a.className));
      const preservedExisting = existingPkg.activities.filter(a => !registryClassNames.has(a.className)).map(ensureEmissionApproved);
      const registryActivities = regPkg.activities.map(convertActivity);

      packages.push({
        packageId: regPkg.packageId,
        version: vInfo.version,
        feedStatus: vInfo.feedStatus,
        preferredVersion: vInfo.preferred,
        ...(nsDefaults ? { prefix: nsDefaults.prefix, clrNamespace: nsDefaults.clrNamespace, assembly: nsDefaults.assembly } : {}),
        activities: [...preservedExisting, ...registryActivities],
      });
    } else {
      packages.push({
        packageId: regPkg.packageId,
        version: vInfo.version,
        feedStatus: vInfo.feedStatus,
        preferredVersion: vInfo.preferred,
        ...(nsDefaults ? { prefix: nsDefaults.prefix, clrNamespace: nsDefaults.clrNamespace, assembly: nsDefaults.assembly } : {}),
        activities: regPkg.activities.map(convertActivity),
      });
    }
  }

  packages.sort((a, b) => {
    const order = [
      "System.Activities",
      "UiPath.System.Activities",
      "UiPath.UIAutomation.Activities",
    ];
    const aIdx = order.indexOf(a.packageId);
    const bIdx = order.indexOf(b.packageId);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.packageId.localeCompare(b.packageId);
  });

  const now = new Date().toISOString();
  const catalog: ActivityCatalog = {
    catalogVersion: CATALOG_VERSION,
    generatedAt: now,
    lastVerifiedAt: now,
    studioVersion: resolvedStudioVersion,
    packages,
  };

  const totalActivities = packages.reduce((sum, p) => sum + p.activities.length, 0);
  console.log(`[Catalog Generator] Generated catalog: ${packages.length} packages, ${totalActivities} activities, studio ${resolvedStudioVersion}`);

  return catalog;
}

export function generateAndWriteCatalog(options: GenerateCatalogOptions = {}): { packages: number; activities: number; path: string } {
  const outputPath = options.outputPath || join(process.cwd(), "catalog", "activity-catalog.json");
  const catalog = generateActivityCatalog(options);

  writeFileSync(outputPath, JSON.stringify(catalog, null, 2), "utf-8");

  const totalActivities = catalog.packages.reduce((sum, p) => sum + p.activities.length, 0);
  console.log(`[Catalog Generator] Wrote catalog to ${outputPath}`);

  return {
    packages: catalog.packages.length,
    activities: totalActivities,
    path: outputPath,
  };
}

if (process.argv[1]?.endsWith("catalog-generator.ts") || process.argv[1]?.endsWith("catalog-generator.js")) {
  const result = generateAndWriteCatalog();
  console.log(`Done: ${result.packages} packages, ${result.activities} activities → ${result.path}`);
}
