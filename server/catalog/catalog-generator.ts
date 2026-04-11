import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  ACTIVITY_DEFINITIONS_REGISTRY,
  getRegistryPackageIds,
  getTotalRegistryActivityCount,
  type ActivityPropertyDef,
  type ActivityDef,
} from "./activity-definitions";
import {
  catalogService,
  type CatalogProperty,
  type CatalogActivity,
  type CatalogPackage,
  type ActivityCatalog,
} from "./catalog-service";
import { getPackageNamespaceMap } from "../xaml/xaml-compliance";
import { CANONICAL_STUDIO_VERSION } from "./metadata-schemas";
import { loadDllExtract, importDllMetadata, type DllImportPackage } from "./dll-metadata-importer";

const CATALOG_VERSION = "2.0.0";

function getPackageNamespaceDefaults(): Record<string, { prefix: string; clrNamespace: string; assembly: string }> {
  if (!catalogService.isLoaded()) {
    catalogService.load();
  }
  const defaults: Record<string, { prefix: string; clrNamespace: string; assembly: string }> = {};
  const nsMap = getPackageNamespaceMap();
  for (const [packageId, info] of Object.entries(nsMap)) {
    defaults[packageId] = { prefix: info.prefix, clrNamespace: info.clrNamespace, assembly: info.assembly };
  }
  return defaults;
}

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
  if (a.namespace) {
    result.namespace = a.namespace;
  }
  if (a.isDeprecated) {
    result.isDeprecated = true;
  }
  if (a.preferModern) {
    result.preferModern = a.preferModern;
  }
  return result;
}

function resolveVersion(
  packageId: string,
  metadataPackages: Record<string, any> | null,
): { version: string; feedStatus: "verified" | "unverified" | "delisted"; preferred: string } {
  if (metadataPackages && metadataPackages[packageId]) {
    const entry = metadataPackages[packageId];
    const preferred = entry.preferred || entry.min || "1.0.0";
    if (entry.feedStatus === "delisted") {
      return { version: preferred, feedStatus: "delisted", preferred };
    }
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
  dllMetadataPath?: string;
  outputPath?: string;
  studioVersion?: string;
}

const ENRICHMENT_FIELDS = [
  "emissionApproved", "canonicalIdentity", "compositionRules",
  "xamlExample", "isDeprecated", "preferModern", "processTypes",
  "propertyConflicts", "propertiesComplete",
] as const;

function copyEnrichmentFromExisting(target: CatalogActivity, existing: CatalogActivity): void {
  if (existing.emissionApproved !== undefined) target.emissionApproved = existing.emissionApproved;
  if (existing.canonicalIdentity) target.canonicalIdentity = existing.canonicalIdentity;
  if (existing.compositionRules) target.compositionRules = existing.compositionRules;
  if (existing.propertyConflicts) target.propertyConflicts = existing.propertyConflicts;
  if (existing.xamlExample) target.xamlExample = existing.xamlExample;
  if (existing.isDeprecated !== undefined) target.isDeprecated = existing.isDeprecated;
  if (existing.preferModern) target.preferModern = existing.preferModern;
  if (existing.propertiesComplete) target.propertiesComplete = existing.propertiesComplete;
  if (existing.processTypes && existing.processTypes.length > 0) target.processTypes = existing.processTypes;
  if (existing.namespace && !target.namespace) target.namespace = existing.namespace;
  if (existing.displayName && existing.displayName !== existing.className) target.displayName = existing.displayName;
  target.browsable = existing.browsable;
}

function mergeDllActivityIntoApproved(existing: CatalogActivity, dllActivity: CatalogActivity): CatalogActivity {
  const existingPropNames = new Set(existing.properties.map(p => p.name));
  const newDllProps = dllActivity.properties.filter(p => !existingPropNames.has(p.name));
  const merged: CatalogActivity = {
    ...existing,
    properties: [...existing.properties, ...newDllProps],
  };
  return merged;
}

function mergeDllActivityIntoNonApproved(existing: CatalogActivity, dllActivity: CatalogActivity): CatalogActivity {
  const merged: CatalogActivity = {
    ...dllActivity,
  };
  copyEnrichmentFromExisting(merged, existing);
  return merged;
}

export function generateActivityCatalog(options: GenerateCatalogOptions = {}): ActivityCatalog {
  const {
    preserveExisting = true,
    existingCatalogPath = join(process.cwd(), "catalog", "activity-catalog.json"),
    metadataPath = join(process.cwd(), "catalog", "generation-metadata.json"),
    dllMetadataPath = join(process.cwd(), "catalog", "dll-metadata", "uipath-activity-metadata-from-dll-full.json"),
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

  let dllPackageMap = new Map<string, DllImportPackage>();
  if (existsSync(dllMetadataPath)) {
    try {
      const dllExtract = loadDllExtract(dllMetadataPath);
      const dllResult = importDllMetadata(dllExtract);
      for (const pkg of dllResult.packages) {
        dllPackageMap.set(pkg.packageId, pkg);
      }
      console.log(`[Catalog Generator] Loaded DLL metadata: ${dllResult.stats.totalPackages} packages, ${dllResult.stats.totalActivities} activities, ${dllResult.stats.totalProperties} properties (${dllResult.stats.filteredNoiseProperties} noise filtered, ${dllResult.stats.displayNamesNormalized} displayNames normalized)`);
    } catch (e: any) {
      console.warn(`[Catalog Generator] Failed to load DLL metadata: ${e.message}`);
    }
  }

  const packages: CatalogPackage[] = [];
  const processedPackageIds = new Set<string>();

  function preserveEnrichmentFields(act: CatalogActivity): CatalogActivity {
    if (act.emissionApproved === undefined) {
      return { ...act, emissionApproved: false };
    }
    return act;
  }

  function mergeDllIntoExistingPackage(existingPkg: CatalogPackage, dllPkg: DllImportPackage): CatalogActivity[] {
    const existingActivityMap = new Map<string, CatalogActivity>();
    for (const act of existingPkg.activities) {
      existingActivityMap.set(act.className, act);
    }

    const dllActivityMap = new Map<string, CatalogActivity>();
    for (const act of dllPkg.activities) {
      dllActivityMap.set(act.className, act);
    }

    const mergedActivities: CatalogActivity[] = [];
    const processedClassNames = new Set<string>();

    for (const existingAct of existingPkg.activities) {
      const dllAct = dllActivityMap.get(existingAct.className);
      processedClassNames.add(existingAct.className);

      if (dllAct) {
        if (existingAct.emissionApproved) {
          mergedActivities.push(mergeDllActivityIntoApproved(existingAct, dllAct));
        } else {
          mergedActivities.push(mergeDllActivityIntoNonApproved(existingAct, dllAct));
        }
      } else {
        mergedActivities.push(preserveEnrichmentFields(existingAct));
      }
    }

    for (const dllAct of dllPkg.activities) {
      if (!processedClassNames.has(dllAct.className)) {
        mergedActivities.push({ ...dllAct, emissionApproved: false, browsable: true });
      }
    }

    return mergedActivities;
  }

  for (const [pkgId, existingPkg] of existingPackageMap) {
    const hasRegistryDef = ACTIVITY_DEFINITIONS_REGISTRY.some(r => r.packageId === pkgId);
    if (!hasRegistryDef) {
      const vInfo = resolveVersion(pkgId, metadataPackages);
      const dllPkg = dllPackageMap.get(pkgId);

      let activities: CatalogActivity[];
      if (dllPkg) {
        activities = mergeDllIntoExistingPackage(existingPkg, dllPkg);
      } else {
        activities = existingPkg.activities.map(preserveEnrichmentFields);
      }

      packages.push({
        ...existingPkg,
        version: vInfo.version,
        feedStatus: vInfo.feedStatus,
        preferredVersion: vInfo.preferred,
        generationApproved: existingPkg.generationApproved ?? (vInfo.feedStatus !== "delisted"),
        activities,
      });
      processedPackageIds.add(pkgId);
    }
  }

  for (const regPkg of ACTIVITY_DEFINITIONS_REGISTRY) {
    const vInfo = resolveVersion(regPkg.packageId, metadataPackages);
    const existingPkg = existingPackageMap.get(regPkg.packageId);
    const nsDefaults = getPackageNamespaceDefaults()[regPkg.packageId];
    const dllPkg = dllPackageMap.get(regPkg.packageId);

    if (existingPkg) {
      const registryClassNames = new Set(regPkg.activities.map(a => a.className));
      const preservedExisting = existingPkg.activities.filter(a => !registryClassNames.has(a.className)).map(preserveEnrichmentFields);

      const existingActivityMap = new Map<string, CatalogActivity>();
      for (const act of existingPkg.activities) {
        existingActivityMap.set(act.className, act);
      }

      const dllActivityMap = new Map<string, CatalogActivity>();
      if (dllPkg) {
        for (const act of dllPkg.activities) {
          dllActivityMap.set(act.className, act);
        }
      }

      const registryActivities = regPkg.activities.map(a => {
        const converted = convertActivity(a);
        const existing = existingActivityMap.get(a.className);
        if (existing) {
          if (existing.canonicalIdentity) converted.canonicalIdentity = existing.canonicalIdentity;
          if (existing.compositionRules) converted.compositionRules = existing.compositionRules;
          if (existing.propertyConflicts) converted.propertyConflicts = existing.propertyConflicts;
          if (existing.xamlExample) converted.xamlExample = existing.xamlExample;
          if (existing.namespace && !converted.namespace) converted.namespace = existing.namespace;
          if (existing.isDeprecated !== undefined) converted.isDeprecated = existing.isDeprecated;
          if (existing.preferModern && !converted.preferModern) converted.preferModern = existing.preferModern;
        }

        if (dllPkg) {
          const dllAct = dllActivityMap.get(a.className);
          if (dllAct) {
            const existingPropNames = new Set(converted.properties.map(p => p.name));
            const newDllProps = dllAct.properties.filter(p => !existingPropNames.has(p.name));
            if (newDllProps.length > 0) {
              converted.properties = [...converted.properties, ...newDllProps];
            }
          }
        }

        return converted;
      });

      let dllOnlyActivities: CatalogActivity[] = [];
      if (dllPkg) {
        const allProcessedClassNames = new Set([
          ...registryClassNames,
          ...preservedExisting.map(a => a.className),
        ]);
        dllOnlyActivities = dllPkg.activities
          .filter(a => !allProcessedClassNames.has(a.className))
          .map(a => ({ ...a, emissionApproved: false, browsable: true }));
      }

      packages.push({
        packageId: regPkg.packageId,
        version: vInfo.version,
        feedStatus: vInfo.feedStatus,
        preferredVersion: vInfo.preferred,
        generationApproved: existingPkg.generationApproved ?? (vInfo.feedStatus !== "delisted"),
        ...(nsDefaults ? { prefix: nsDefaults.prefix, clrNamespace: nsDefaults.clrNamespace, assembly: nsDefaults.assembly } : {}),
        activities: [...preservedExisting, ...registryActivities, ...dllOnlyActivities],
      });
    } else {
      let dllOnlyActivities: CatalogActivity[] = [];
      if (dllPkg) {
        const registryClassNames = new Set(regPkg.activities.map(a => a.className));
        dllOnlyActivities = dllPkg.activities
          .filter(a => !registryClassNames.has(a.className))
          .map(a => ({ ...a, emissionApproved: false, browsable: true }));
      }

      packages.push({
        packageId: regPkg.packageId,
        version: vInfo.version,
        feedStatus: vInfo.feedStatus,
        preferredVersion: vInfo.preferred,
        generationApproved: vInfo.feedStatus !== "delisted",
        ...(nsDefaults ? { prefix: nsDefaults.prefix, clrNamespace: nsDefaults.clrNamespace, assembly: nsDefaults.assembly } : {}),
        activities: [...regPkg.activities.map(convertActivity), ...dllOnlyActivities],
      });
    }
    processedPackageIds.add(regPkg.packageId);
  }

  for (const [dllPkgId, dllPkg] of dllPackageMap) {
    if (processedPackageIds.has(dllPkgId)) continue;
    const vInfo = resolveVersion(dllPkgId, metadataPackages);
    const nsDefaults = getPackageNamespaceDefaults()[dllPkgId];

    packages.push({
      packageId: dllPkgId,
      version: vInfo.version,
      feedStatus: vInfo.feedStatus,
      preferredVersion: vInfo.preferred,
      generationApproved: false,
      ...(nsDefaults ? { prefix: nsDefaults.prefix, clrNamespace: nsDefaults.clrNamespace, assembly: nsDefaults.assembly } : {}),
      activities: dllPkg.activities.map(a => ({ ...a, emissionApproved: false, browsable: true })),
    });
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
  const dllOnlyCount = dllPackageMap.size - [...processedPackageIds].filter(id => dllPackageMap.has(id)).length;
  console.log(`[Catalog Generator] Generated catalog: ${packages.length} packages, ${totalActivities} activities, studio ${resolvedStudioVersion} (${dllOnlyCount} new DLL-only packages)`);

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
