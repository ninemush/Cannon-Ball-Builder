import { catalogService } from "./catalog/catalog-service";
import { metadataService as _metadataService } from "./catalog/metadata-service";
import { isFrameworkAssembly, UIPATH_PACKAGE_ALIAS_MAP } from "./uipath-shared";
import { getActivityPackage, NAMESPACE_PREFIX_TO_PACKAGE } from "./uipath-activity-registry";
import { getFilteredSchema, registerStage } from "./catalog/filtered-schema-lookup";

registerStage("post-emission-dependency-analyzer");

export type ResolutionSource =
  | "metadata_service"
  | "catalog_service"
  | "registry_match"
  | "speculative_fallback"
  | "manual_override"
  | "unresolved";

export interface ActivityResolutionEntry {
  activityTag: string;
  resolvedPackage: string | null;
  resolutionSource: ResolutionSource;
  candidatePackages?: string[];
  fileName: string;
}

export interface AmbiguousResolution {
  activityTag: string;
  candidatePackages: string[];
  fileName: string;
}

export interface PackageResolutionEntry {
  packageId: string;
  version: string | null;
  resolutionSource: ResolutionSource;
  activities: string[];
}

export interface OrphanDependency {
  packageId: string;
  version: string | null;
  reason: string;
}

export interface SpeculativeComparisonDelta {
  addedBySpeculative: string[];
  removedBySpeculative: string[];
  common: string[];
}

export interface DependencyDiagnosticsArtifact {
  activityResolutions: ActivityResolutionEntry[];
  packageResolutions: PackageResolutionEntry[];
  unresolvedActivities: ActivityResolutionEntry[];
  ambiguousResolutions: AmbiguousResolution[];
  orphanDependencies: OrphanDependency[];
  speculativeComparisonDelta: SpeculativeComparisonDelta | null;
  summary: {
    totalActivities: number;
    resolvedPackages: number;
    unresolvedCount: number;
    ambiguousCount: number;
    orphanCount: number;
  };
}

export interface DependencyAnalysisReport {
  resolvedPackages: Record<string, { version: string | null; resolutionSource: ResolutionSource }>;
  unresolvedActivities: ActivityResolutionEntry[];
  ambiguousResolutions: AmbiguousResolution[];
  activityToPackageMap: Map<string, string>;
  packageToActivitiesMap: Map<string, Set<string>>;
  activityResolutions: ActivityResolutionEntry[];
  dependencyGaps: Array<{ activityTag: string; fileName: string; detail: string }>;
}

const FRAMEWORK_PREFIXES = new Set([
  "x", "s", "sap", "sap2010", "scg", "scg2", "sco", "mc", "mva", "mca",
  "this", "local", "p", "sads", "sa", "sad", "xmlns", "xml",
]);

const VIEW_STATE_PATTERNS = [
  /sap:VirtualizedContainerService\.\w+/,
  /sap2010:WorkflowViewState\.\w+/,
  /WorkflowViewState\.\w+/,
];

function isViewStateOrDesignTimeContent(line: string): boolean {
  return VIEW_STATE_PATTERNS.some(p => p.test(line));
}

function normalizePackageName(name: string): string {
  return UIPATH_PACKAGE_ALIAS_MAP[name] || name;
}

interface XamlEntry {
  name: string;
  content: string;
}

export class PostEmissionDependencyAnalyzer {
  private targetFramework: "Windows" | "Portable";

  constructor(targetFramework: "Windows" | "Portable" = "Windows") {
    this.targetFramework = targetFramework;
  }

  analyze(finalXamlEntries: XamlEntry[]): DependencyAnalysisReport {
    const activityResolutions: ActivityResolutionEntry[] = [];
    const unresolvedActivities: ActivityResolutionEntry[] = [];
    const ambiguousResolutions: AmbiguousResolution[] = [];
    const activityToPackageMap = new Map<string, string>();
    const packageToActivitiesMap = new Map<string, Set<string>>();
    const resolvedPackages: Record<string, { version: string | null; resolutionSource: ResolutionSource }> = {};
    const dependencyGaps: Array<{ activityTag: string; fileName: string; detail: string }> = [];

    const seenActivities = new Map<string, Set<string>>();

    for (const entry of finalXamlEntries) {
      if (!entry.name.endsWith(".xaml")) continue;
      const fileName = entry.name.split("/").pop() || entry.name;
      const content = entry.content;

      this.scanActivityTags(content, fileName, seenActivities);
      this.scanXmlnsDeclarations(content, fileName, seenActivities);
      this.scanTypeArguments(content, fileName, seenActivities);
      this.scanAssemblyReferences(content, fileName, seenActivities);
    }

    for (const [activityTag, fileNames] of seenActivities.entries()) {
      const representativeFile = Array.from(fileNames)[0];

      const resolution = this.resolveActivity(activityTag);

      if (resolution.candidates.length > 1 && !resolution.packageId) {
        ambiguousResolutions.push({
          activityTag,
          candidatePackages: resolution.candidates,
          fileName: representativeFile,
        });
        activityResolutions.push({
          activityTag,
          resolvedPackage: null,
          resolutionSource: "unresolved",
          candidatePackages: resolution.candidates,
          fileName: representativeFile,
        });
        unresolvedActivities.push({
          activityTag,
          resolvedPackage: null,
          resolutionSource: "unresolved",
          candidatePackages: resolution.candidates,
          fileName: representativeFile,
        });
        dependencyGaps.push({
          activityTag,
          fileName: representativeFile,
          detail: `Activity "${activityTag}" has ${resolution.candidates.length} ambiguous candidate packages: ${resolution.candidates.join(", ")} — deterministic tie-break failed`,
        });
        continue;
      }

      if (resolution.packageId) {
        const normalized = normalizePackageName(resolution.packageId);
        if (isFrameworkAssembly(normalized)) continue;

        const entry: ActivityResolutionEntry = {
          activityTag,
          resolvedPackage: normalized,
          resolutionSource: resolution.source,
          fileName: representativeFile,
        };
        activityResolutions.push(entry);
        activityToPackageMap.set(activityTag, normalized);

        if (!packageToActivitiesMap.has(normalized)) {
          packageToActivitiesMap.set(normalized, new Set());
        }
        packageToActivitiesMap.get(normalized)!.add(activityTag);
      } else {
        const entry: ActivityResolutionEntry = {
          activityTag,
          resolvedPackage: null,
          resolutionSource: "unresolved",
          fileName: representativeFile,
        };
        activityResolutions.push(entry);
        unresolvedActivities.push(entry);
        dependencyGaps.push({
          activityTag,
          fileName: representativeFile,
          detail: `Activity "${activityTag}" used in ${representativeFile} has no resolvable package`,
        });
      }
    }

    for (const [pkgId, activities] of packageToActivitiesMap.entries()) {
      const versionResult = this.resolveVersion(pkgId);
      resolvedPackages[pkgId] = {
        version: versionResult.version,
        resolutionSource: versionResult.source,
      };

      if (!versionResult.version) {
        dependencyGaps.push({
          activityTag: Array.from(activities)[0],
          fileName: "",
          detail: `Package "${pkgId}" resolved for activities [${Array.from(activities).join(", ")}] but has no validated version`,
        });
      }
    }

    const totalActivities = seenActivities.size;
    const resolvedCount = Object.keys(resolvedPackages).length;
    console.log(`[Post-Emission Analyzer] Found ${totalActivities} activities across ${resolvedCount} packages`);
    console.log(`[Post-Emission Analyzer] Dependency diagnostics: ${resolvedCount} resolved, ${unresolvedActivities.length} unresolvable, ${ambiguousResolutions.length} ambiguous`);

    return {
      resolvedPackages,
      unresolvedActivities,
      ambiguousResolutions,
      activityToPackageMap,
      packageToActivitiesMap,
      activityResolutions,
      dependencyGaps,
    };
  }

  resolveVersion(pkgName: string): { version: string | null; source: ResolutionSource } {
    const studioTarget = _metadataService.getStudioTarget();
    const metadataTargetFramework = studioTarget?.targetFramework || null;
    const targetMatch = !metadataTargetFramework || metadataTargetFramework === this.targetFramework;

    const preferred = _metadataService.getPreferredVersion(pkgName);
    if (preferred && targetMatch) {
      return { version: preferred, source: "metadata_service" };
    }

    if (catalogService.isLoaded()) {
      const catalogVersion = catalogService.getConfirmedVersion(pkgName);
      if (catalogVersion) {
        return { version: catalogVersion, source: "catalog_service" };
      }
    }

    if (preferred && !targetMatch) {
      console.warn(`[Post-Emission Analyzer] Version ${preferred} for ${pkgName} from metadata targets ${metadataTargetFramework}, analyzer targets ${this.targetFramework} — no catalog fallback available, marking unresolved`);
    }

    return { version: null, source: "unresolved" };
  }

  private resolveActivity(activityTag: string): { packageId: string | null; source: ResolutionSource; candidates: string[] } {
    if (activityTag.startsWith("__xmlns:")) {
      const parts = activityTag.split(":");
      const assembly = parts.slice(2).join(":");
      if (catalogService.isLoaded()) {
        const catalogPkg = catalogService.resolveTypeToPackage(assembly);
        if (catalogPkg) return { packageId: catalogPkg, source: "catalog_service", candidates: [catalogPkg] };
      }
      const registryXmlnsPkg = getActivityPackage(assembly);
      if (registryXmlnsPkg) return { packageId: registryXmlnsPkg, source: "registry_match", candidates: [registryXmlnsPkg] };
      if (assembly.startsWith("UiPath.") && assembly.includes(".Activities")) {
        return { packageId: assembly, source: "registry_match", candidates: [assembly] };
      }
      return { packageId: null, source: "unresolved", candidates: [] };
    }

    if (activityTag.startsWith("__type:")) {
      const typeRef = activityTag.substring("__type:".length);
      const TYPE_TO_PACKAGE: Record<string, string> = {
        "Newtonsoft.Json": "Newtonsoft.Json",
        "Newtonsoft.Json.Linq.JToken": "Newtonsoft.Json",
        "Newtonsoft.Json.Linq.JObject": "Newtonsoft.Json",
        "Newtonsoft.Json.Linq.JArray": "Newtonsoft.Json",
        "System.Data.DataTable": "UiPath.Database.Activities",
        "System.Data.DataRow": "UiPath.Database.Activities",
        "System.Net.Mail.MailMessage": "UiPath.Mail.Activities",
      };
      const directPkg = TYPE_TO_PACKAGE[typeRef];
      if (directPkg) return { packageId: directPkg, source: "registry_match", candidates: [directPkg] };
      if (catalogService.isLoaded()) {
        const catalogPkg = catalogService.resolveTypeToPackage(typeRef);
        if (catalogPkg) return { packageId: catalogPkg, source: "catalog_service", candidates: [catalogPkg] };
      }
      return { packageId: null, source: "unresolved", candidates: [] };
    }

    if (activityTag.startsWith("__asm:")) {
      const assembly = activityTag.substring("__asm:".length);
      if (assembly === "Newtonsoft.Json") return { packageId: "Newtonsoft.Json", source: "registry_match", candidates: ["Newtonsoft.Json"] };
      if (assembly.startsWith("UiPath.") && assembly.includes(".Activities")) {
        return { packageId: assembly, source: "registry_match", candidates: [assembly] };
      }
      if (catalogService.isLoaded()) {
        const catalogPkg = catalogService.resolveTypeToPackage(assembly);
        if (catalogPkg) return { packageId: catalogPkg, source: "catalog_service", candidates: [catalogPkg] };
      }
      return { packageId: null, source: "unresolved", candidates: [] };
    }

    const className = activityTag.includes(":") ? activityTag.split(":").pop()! : activityTag;
    const prefix = activityTag.includes(":") ? activityTag.split(":")[0] : null;

    const allCandidates: Array<{ packageId: string; source: ResolutionSource }> = [];

    if (catalogService.isLoaded()) {
      const filteredResult = getFilteredSchema(className, "post-emission-dependency-analyzer", this.targetFramework);
      if (filteredResult.status === "approved" && filteredResult.schema.packageId) {
        allCandidates.push({ packageId: filteredResult.schema.packageId, source: "catalog_service" });
      }
      if (activityTag !== className) {
        const filteredDirect = getFilteredSchema(activityTag, "post-emission-dependency-analyzer", this.targetFramework);
        if (filteredDirect.status === "approved" && filteredDirect.schema.packageId && filteredDirect.schema.packageId !== (filteredResult.status === "approved" ? filteredResult.schema.packageId : null)) {
          allCandidates.push({ packageId: filteredDirect.schema.packageId, source: "catalog_service" });
        }
      }
    }

    const registryPkg = getActivityPackage(className);
    if (registryPkg) {
      if (!allCandidates.some(c => c.packageId === registryPkg)) {
        allCandidates.push({ packageId: registryPkg, source: "registry_match" });
      }
    }

    if (prefix && prefix !== "ui" && NAMESPACE_PREFIX_TO_PACKAGE[prefix]) {
      const nsPkg = NAMESPACE_PREFIX_TO_PACKAGE[prefix];
      if (!allCandidates.some(c => c.packageId === nsPkg)) {
        allCandidates.push({ packageId: nsPkg, source: "registry_match" });
      }
    }

    if (allCandidates.length === 0) {
      return { packageId: null, source: "unresolved", candidates: [] };
    }

    const uniquePackages = [...new Set(allCandidates.map(c => c.packageId))];
    if (uniquePackages.length === 1) {
      return { packageId: allCandidates[0].packageId, source: allCandidates[0].source, candidates: uniquePackages };
    }

    const catalogCandidate = allCandidates.find(c => c.source === "catalog_service");
    if (catalogCandidate) {
      return { packageId: catalogCandidate.packageId, source: catalogCandidate.source, candidates: uniquePackages };
    }

    const prefixCandidate = prefix ? allCandidates.find(c =>
      c.source === "registry_match" && NAMESPACE_PREFIX_TO_PACKAGE[prefix] === c.packageId
    ) : null;
    if (prefixCandidate) {
      return { packageId: prefixCandidate.packageId, source: prefixCandidate.source, candidates: uniquePackages };
    }

    return { packageId: null, source: "unresolved", candidates: uniquePackages };
  }

  private scanActivityTags(content: string, fileName: string, seenActivities: Map<string, Set<string>>): void {
    const activityPattern = /<([A-Za-z][A-Za-z0-9]*):([A-Za-z]\w*)\s/g;
    let match;
    while ((match = activityPattern.exec(content)) !== null) {
      const prefix = match[1];
      const activityName = match[2];

      if (FRAMEWORK_PREFIXES.has(prefix)) continue;

      const fullTag = `${prefix}:${activityName}`;

      const lineStart = content.lastIndexOf("\n", match.index);
      const lineEnd = content.indexOf("\n", match.index);
      const line = content.substring(lineStart >= 0 ? lineStart : 0, lineEnd >= 0 ? lineEnd : content.length);
      if (isViewStateOrDesignTimeContent(line)) continue;

      if (!seenActivities.has(fullTag)) {
        seenActivities.set(fullTag, new Set());
      }
      seenActivities.get(fullTag)!.add(fileName);
    }

    const unprefixedTags = ["Sequence", "If", "While", "DoWhile", "Switch", "ForEach", "ParallelForEach",
      "TryCatch", "Throw", "Rethrow", "Assign", "Delay", "Flowchart", "FlowDecision", "FlowSwitch"];
    for (const tag of unprefixedTags) {
      const pattern = new RegExp(`<${tag}(?:\\s|>|/>)(?![.])`, "m");
      if (pattern.test(content)) {
        if (!seenActivities.has(tag)) {
          seenActivities.set(tag, new Set());
        }
        seenActivities.get(tag)!.add(fileName);
      }
    }
  }

  private scanXmlnsDeclarations(content: string, fileName: string, seenActivities: Map<string, Set<string>>): void {
    const xmlnsPattern = /xmlns:(\w+)="clr-namespace:([^;]*);assembly=([^"]+)"/g;
    let match;
    while ((match = xmlnsPattern.exec(content)) !== null) {
      const prefix = match[1];
      const namespace = match[2].trim();
      const assembly = match[3].trim();

      if (FRAMEWORK_PREFIXES.has(prefix)) continue;
      if (isFrameworkAssembly(assembly)) continue;
      if (assembly === "System.Activities" || assembly === "mscorlib" || assembly === "System" || assembly === "System.Core" || assembly === "System.Data") continue;

      const syntheticTag = `__xmlns:${prefix}:${assembly}`;
      if (!seenActivities.has(syntheticTag)) {
        seenActivities.set(syntheticTag, new Set());
      }
      seenActivities.get(syntheticTag)!.add(fileName);
    }
  }

  private scanTypeArguments(content: string, fileName: string, seenActivities: Map<string, Set<string>>): void {
    const TYPE_ARGUMENT_PACKAGE_MAP: Record<string, string> = {
      "Newtonsoft.Json": "Newtonsoft.Json",
      "Newtonsoft.Json.Linq.JToken": "Newtonsoft.Json",
      "Newtonsoft.Json.Linq.JObject": "Newtonsoft.Json",
      "Newtonsoft.Json.Linq.JArray": "Newtonsoft.Json",
      "System.Data.DataTable": "UiPath.Database.Activities",
      "System.Data.DataRow": "UiPath.Database.Activities",
      "System.Net.Mail.MailMessage": "UiPath.Mail.Activities",
    };

    const typeArgPattern = /x:TypeArguments="([^"]+)"/g;
    let match;
    while ((match = typeArgPattern.exec(content)) !== null) {
      const typeArgs = match[1];

      for (const [typeRef, pkg] of Object.entries(TYPE_ARGUMENT_PACKAGE_MAP)) {
        if (typeArgs.includes(typeRef) && !isFrameworkAssembly(pkg)) {
          const syntheticTag = `__type:${typeRef}`;
          if (!seenActivities.has(syntheticTag)) {
            seenActivities.set(syntheticTag, new Set());
          }
          seenActivities.get(syntheticTag)!.add(fileName);
        }
      }

      if (catalogService.isLoaded()) {
        const clrTypes = typeArgs.split(",").map(t => t.trim()).filter(t => t.startsWith("UiPath.") || t.startsWith("Newtonsoft."));
        for (const clrType of clrTypes) {
          const catalogPkg = catalogService.resolveTypeToPackage(clrType);
          if (catalogPkg && !isFrameworkAssembly(catalogPkg)) {
            const syntheticTag = `__type:${clrType}`;
            if (!seenActivities.has(syntheticTag)) {
              seenActivities.set(syntheticTag, new Set());
            }
            seenActivities.get(syntheticTag)!.add(fileName);
          }
        }
      }
    }

    const newtonsoftPatterns = [/Newtonsoft\.Json/, /JToken/, /JObject/, /JArray/, /JsonConvert/];
    for (const pattern of newtonsoftPatterns) {
      if (pattern.test(content)) {
        const syntheticTag = `__type:Newtonsoft.Json`;
        if (!seenActivities.has(syntheticTag)) {
          seenActivities.set(syntheticTag, new Set());
        }
        seenActivities.get(syntheticTag)!.add(fileName);
        break;
      }
    }
  }

  private scanAssemblyReferences(content: string, fileName: string, seenActivities: Map<string, Set<string>>): void {
    const asmRefPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
    let match;
    while ((match = asmRefPattern.exec(content)) !== null) {
      const assembly = match[1].trim();
      if (isFrameworkAssembly(assembly)) continue;
      if (assembly === "System.Activities" || assembly === "mscorlib" || assembly === "System" || assembly === "System.Core" || assembly === "System.Data") continue;

      const syntheticTag = `__asm:${assembly}`;
      if (!seenActivities.has(syntheticTag)) {
        seenActivities.set(syntheticTag, new Set());
      }
      seenActivities.get(syntheticTag)!.add(fileName);
    }
  }
}

export function buildDependencyDiagnosticsArtifact(
  analysisReport: DependencyAnalysisReport,
  speculativeDeps: Record<string, string> | null,
  finalDeps: Record<string, string>,
): DependencyDiagnosticsArtifact {
  const orphanDependencies: OrphanDependency[] = [];
  for (const [pkgId, version] of Object.entries(finalDeps)) {
    if (!analysisReport.packageToActivitiesMap.has(pkgId)) {
      orphanDependencies.push({
        packageId: pkgId,
        version,
        reason: `Package "${pkgId}" is declared in project.json but no XAML activity uses it`,
      });
    }
  }

  let speculativeComparisonDelta: SpeculativeComparisonDelta | null = null;
  if (speculativeDeps) {
    const specSet = new Set(Object.keys(speculativeDeps));
    const derivedSet = new Set(Object.keys(finalDeps));

    const addedBySpeculative = Array.from(specSet).filter(p => !derivedSet.has(p));
    const removedBySpeculative = Array.from(derivedSet).filter(p => !specSet.has(p));
    const common = Array.from(specSet).filter(p => derivedSet.has(p));

    speculativeComparisonDelta = { addedBySpeculative, removedBySpeculative, common };

    if (addedBySpeculative.length > 0 || removedBySpeculative.length > 0) {
      console.log(`[Post-Emission Analyzer] Comparison: speculative predicted {${Object.keys(speculativeDeps).join(", ")}}, XAML-derived actual {${Object.keys(finalDeps).join(", ")}}, delta: added {${addedBySpeculative.join(", ")}}, removed {${removedBySpeculative.join(", ")}}`);
    }
  }

  const packageResolutions: PackageResolutionEntry[] = [];
  for (const [pkgId, info] of Object.entries(analysisReport.resolvedPackages)) {
    packageResolutions.push({
      packageId: pkgId,
      version: info.version,
      resolutionSource: info.resolutionSource,
      activities: Array.from(analysisReport.packageToActivitiesMap.get(pkgId) || []),
    });
  }

  return {
    activityResolutions: analysisReport.activityResolutions,
    packageResolutions,
    unresolvedActivities: analysisReport.unresolvedActivities,
    ambiguousResolutions: analysisReport.ambiguousResolutions,
    orphanDependencies,
    speculativeComparisonDelta,
    summary: {
      totalActivities: analysisReport.activityResolutions.length,
      resolvedPackages: Object.keys(analysisReport.resolvedPackages).length,
      unresolvedCount: analysisReport.unresolvedActivities.length,
      ambiguousCount: analysisReport.ambiguousResolutions.length,
      orphanCount: orphanDependencies.length,
    },
  };
}

export function checkDependencyDriftAgainstMailFamilyLocks(
  resolvedPackages: Record<string, { version: string | null; resolutionSource: ResolutionSource }>,
  mailFamilyLockResults: Array<{ clusterId: string; selectedFamily: string | null; locked: boolean }>,
): Array<{ clusterId: string; lockedFamily: string; violatingPackage: string; detail: string; packageFatal: boolean }> {
  const violations: Array<{ clusterId: string; lockedFamily: string; violatingPackage: string; detail: string; packageFatal: boolean }> = [];

  const CROSS_FAMILY_PKG: Record<string, Set<string>> = {
    "gmail-send": new Set(["UiPath.Mail.Activities"]),
    "smtp-send": new Set(["UiPath.GSuite.Activities"]),
    "outlook-send": new Set(["UiPath.GSuite.Activities"]),
  };

  const packageList = Object.keys(resolvedPackages);

  const FAMILY_REQUIRED_PKG: Record<string, string> = {
    "gmail-send": "UiPath.GSuite.Activities",
    "smtp-send": "UiPath.Mail.Activities",
    "outlook-send": "UiPath.Mail.Activities",
  };

  const legitimatePackages = new Set<string>();
  for (const lock of mailFamilyLockResults) {
    if (!lock.locked || !lock.selectedFamily) continue;
    const needed = FAMILY_REQUIRED_PKG[lock.selectedFamily];
    if (needed) legitimatePackages.add(needed);
  }

  for (const lock of mailFamilyLockResults) {
    if (!lock.locked || !lock.selectedFamily) continue;
    const wrongPkgs = CROSS_FAMILY_PKG[lock.selectedFamily];
    if (!wrongPkgs) continue;

    for (const pkg of wrongPkgs) {
      if (!packageList.includes(pkg)) continue;
      if (legitimatePackages.has(pkg)) continue;

      violations.push({
        clusterId: lock.clusterId,
        lockedFamily: lock.selectedFamily,
        violatingPackage: pkg,
        detail: `Locked to ${lock.selectedFamily} but dependency analysis resolved wrong-family package ${pkg} not attributable to any locked cluster`,
        packageFatal: true,
      });
    }
  }

  return violations;
}

export function runPostEmissionDependencyAnalysis(
  finalXamlEntries: XamlEntry[],
  targetFramework: "Windows" | "Portable",
  speculativeDeps: Record<string, string> | null,
): {
  deps: Record<string, string>;
  report: DependencyAnalysisReport;
  diagnostics: DependencyDiagnosticsArtifact;
} {
  const analyzer = new PostEmissionDependencyAnalyzer(targetFramework);
  const report = analyzer.analyze(finalXamlEntries);

  const deps: Record<string, string> = {};
  for (const [pkgId, info] of Object.entries(report.resolvedPackages)) {
    if (info.version) {
      deps[pkgId] = info.version;
    }
  }

  const diagnostics = buildDependencyDiagnosticsArtifact(report, speculativeDeps, deps);

  return { deps, report, diagnostics };
}
