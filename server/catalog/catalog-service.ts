import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { validateCatalog } from "./catalog-validator";
import { metadataService, type StudioProfile } from "./metadata-service";
export type { StudioProfile } from "./metadata-service";

export type ProcessType = "api-integration" | "document-processing" | "attended-ui" | "unattended-ui" | "orchestration" | "general";

export type FeedStatus = "verified" | "unverified" | "delisted";

export interface CatalogProperty {
  name: string;
  direction: "In" | "Out" | "InOut" | "None";
  clrType: string;
  xamlSyntax: "child-element" | "attribute";
  argumentWrapper: string | null;
  typeArguments: string | null;
  required: boolean;
  validValues?: string[];
  default?: string;
  addedInVersion?: string;
  removedInVersion?: string;
}

export interface CanonicalIdentity {
  canonicalPackageId: string;
  canonicalPrefix: string;
  canonicalNamespace: string;
  alternates: Array<{ packageId: string; prefix: string; namespace: string }>;
}

export interface CompositionRule {
  rule: string;
  provenance: "authoritative" | "curated";
}

export interface PropertyConflict {
  property: string;
  conflictsWith: string[];
  reason: string;
  provenance: "authoritative" | "curated";
}

export interface CatalogActivity {
  className: string;
  displayName: string;
  namespace?: string;
  browsable: boolean;
  processTypes: ProcessType[];
  properties: CatalogProperty[];
  propertiesComplete?: boolean;
  source?: "dll-extract" | "hand-authored" | "xaml-reference";
  emissionApproved: boolean;
  canonicalIdentity?: CanonicalIdentity;
  isDeprecated?: boolean;
  preferModern?: string;
  compositionRules?: CompositionRule[];
  propertyConflicts?: PropertyConflict[];
  xamlExample?: string;
}

export interface AdditionalNamespace {
  prefix: string;
  clrNamespace: string;
  assembly: string;
  xmlns?: string;
}

export interface CatalogPackage {
  packageId: string;
  version?: string;
  feedStatus?: FeedStatus;
  preferredVersion?: string;
  generationApproved?: boolean;
  prefix?: string;
  clrNamespace?: string;
  assembly?: string;
  xmlns?: string;
  prefixAliases?: string[];
  additionalNamespaces?: AdditionalNamespace[];
  activities: CatalogActivity[];
}

export interface ActivityCatalog {
  catalogVersion: string;
  generatedAt: string;
  lastVerifiedAt: string;
  studioVersion: string;
  packages: CatalogPackage[];
}

export interface ActivitySchema {
  activity: CatalogActivity;
  packageId: string;
  packageVersion: string;
}

export interface ValidationCorrection {
  type: "wrap-in-argument" | "move-to-attribute" | "move-to-child-element" | "add-missing-required" | "fix-invalid-value";
  property: string;
  detail: string;
  argumentWrapper?: string;
  typeArguments?: string | null;
  correctedValue?: string;
}

export interface ActivityValidationResult {
  valid: boolean;
  violations: string[];
  corrections: ValidationCorrection[];
}

export interface PaletteEntry {
  className: string;
  displayName: string;
  packageId: string;
  properties: { name: string; direction: string; required: boolean; xamlSyntax: string; validValues?: string[] }[];
}

export interface PackageNamespaceInfo {
  prefix: string;
  xmlns: string;
  clrNamespace: string;
  assembly: string;
}


class CatalogService {
  private catalog: ActivityCatalog | null = null;
  private activityIndex = new Map<string, ActivitySchema>();
  private packageIndex = new Map<string, CatalogPackage>();
  private clrTypeIndex = new Map<string, string>();
  private prefixIndex = new Map<string, { packageId: string; prefix: string; clrNamespace: string; assembly: string; xmlns: string }>();
  private aliasIndex = new Map<string, string>();
  private loaded = false;
  private _studioProfile: StudioProfile | null = null;
  private loadGeneration = 0;
  private _lastLoadError: string | null = null;

  load(catalogPath?: string): void {
    metadataService.load();
    this._studioProfile = metadataService.getStudioProfile();
    this._lastLoadError = null;

    let parsed: any = null;

    if (!catalogPath && metadataService.isActivityCatalogAvailable()) {
      parsed = metadataService.getActivityCatalogData();
    }

    if (!parsed) {
      const path = catalogPath || metadataService.getActivityCatalogPath() || join(process.cwd(), "catalog", "activity-catalog.json");
      if (!existsSync(path)) {
        this._lastLoadError = `file not found at ${path}`;
        console.warn(`[Activity Catalog] Catalog file not found at ${path} — catalog constraints disabled`);
        this.loaded = false;
        return;
      }
      try {
        const raw = readFileSync(path, "utf-8");
        parsed = JSON.parse(raw);
      } catch (err: any) {
        this._lastLoadError = err.message;
        console.warn(`[Activity Catalog] Failed to load catalog: ${err.message} — catalog constraints disabled`);
        this.loaded = false;
        return;
      }
    }

    try {
      const validation = validateCatalog(parsed);
      if (!validation.valid) {
        this._lastLoadError = `validation rejected: ${validation.errors.join("; ")}`;
        console.warn(`[Activity Catalog] Catalog validation failed: ${validation.errors.join("; ")} — catalog constraints disabled`);
        this.loaded = false;
        return;
      }

      if (validation.warnings.length > 0) {
        console.warn(`[Activity Catalog] Catalog warnings: ${validation.warnings.join("; ")}`);
      }

      this.catalog = parsed as ActivityCatalog;
      this.buildIndices();
      this.loaded = true;
      this.loadGeneration++;

      let totalActivities = 0;
      for (const pkg of this.catalog.packages) {
        totalActivities += pkg.activities.length;
      }

      console.log(`Activity catalog loaded: v${this.catalog.catalogVersion}, ${this.catalog.packages.length} packages, ${totalActivities} activities, Studio ${this.catalog.studioVersion}`);

      this.checkVersionAlignment();
      this.checkCatalogFreshness();
      validateCatalogNamespaceCoverage();
    } catch (err: any) {
      this._lastLoadError = err.message;
      console.warn(`[Activity Catalog] Failed to load catalog: ${err.message} — catalog constraints disabled`);
      this.loaded = false;
    }
  }

  getLastLoadError(): string | null {
    return this._lastLoadError;
  }

  getStudioProfile(): StudioProfile | null {
    return metadataService.getStudioProfile() || this._studioProfile;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getCatalog(): ActivityCatalog | null {
    return this.catalog;
  }

  getLoadGeneration(): number {
    return this.loadGeneration;
  }

  private checkVersionAlignment(): void {
    if (!this.catalog) return;
    const metaTarget = metadataService.getStudioTarget();
    if (!metaTarget) return;
    if (this.catalog.studioVersion !== metaTarget.version) {
      console.warn(`[Activity Catalog] WARNING: activity-catalog.json studioVersion (${this.catalog.studioVersion}) does not match MetadataService studio target (${metaTarget.version}). Version drift may cause dependency mismatches.`);
    }
  }

  checkCatalogCoverage(hardcodedActivityPrefixMap: Record<string, string>): void {
    if (!this.loaded || !this.catalog) return;
    const catalogActivities = new Set(this.getAllActivityClassNames());
    const missing: string[] = [];
    for (const actName of Object.keys(hardcodedActivityPrefixMap)) {
      if (!catalogActivities.has(actName)) {
        missing.push(actName);
      }
    }
    if (missing.length > 0) {
      console.warn(`[Activity Catalog] WARNING: ${missing.length} activities in hardcoded prefix map are missing from catalog: ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ` ... and ${missing.length - 20} more` : ""}`);
    }
  }

  private checkCatalogFreshness(): void {
    if (!this.catalog?.lastVerifiedAt) return;

    const lastVerified = new Date(this.catalog.lastVerifiedAt).getTime();
    if (isNaN(lastVerified)) return;

    const ageMs = Date.now() - lastVerified;
    const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

    if (ageMs > NINETY_DAYS_MS) {
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      console.warn(`[Activity Catalog] WARNING: Catalog lastVerifiedAt is ${ageDays} days old (>${90} days). Consider re-verifying the catalog against NuGet feeds.`);
    }
  }

  private buildIndices(): void {
    if (!this.catalog) return;

    this.activityIndex.clear();
    this.packageIndex.clear();
    this.clrTypeIndex.clear();
    this.prefixIndex.clear();
    this.aliasIndex.clear();

    for (const pkg of this.catalog.packages) {
      if (pkg.packageId) {
        this.packageIndex.set(pkg.packageId, pkg);
      }

      if (pkg.prefix !== undefined && pkg.packageId) {
        const xmlns = pkg.xmlns
          ? pkg.xmlns
          : (pkg.prefix === ""
            ? "http://schemas.microsoft.com/netfx/2009/xaml/activities"
            : (pkg.clrNamespace && pkg.assembly
              ? `clr-namespace:${pkg.clrNamespace};assembly=${pkg.assembly}`
              : ""));
        if (pkg.prefix !== "" && !this.prefixIndex.has(pkg.prefix)) {
          this.prefixIndex.set(pkg.prefix, {
            packageId: pkg.packageId,
            prefix: pkg.prefix,
            clrNamespace: pkg.clrNamespace || "",
            assembly: pkg.assembly || "",
            xmlns,
          });
        }
      }

      if (pkg.additionalNamespaces) {
        for (const ns of pkg.additionalNamespaces) {
          if (ns.prefix && !this.prefixIndex.has(ns.prefix)) {
            const xmlns = ns.xmlns || (ns.clrNamespace && ns.assembly
              ? `clr-namespace:${ns.clrNamespace};assembly=${ns.assembly}`
              : "");
            this.prefixIndex.set(ns.prefix, {
              packageId: pkg.packageId,
              prefix: ns.prefix,
              clrNamespace: ns.clrNamespace || "",
              assembly: ns.assembly || "",
              xmlns,
            });
          }
        }
      }

      if (pkg.prefixAliases && pkg.prefix) {
        for (const alias of pkg.prefixAliases) {
          if (!this.aliasIndex.has(alias)) {
            this.aliasIndex.set(alias, pkg.prefix);
          }
        }
      }

      for (const act of pkg.activities) {
        const metaVersion = metadataService.getPreferredVersion(pkg.packageId);
        const schema: ActivitySchema = {
          activity: act,
          packageId: pkg.packageId,
          packageVersion: metaVersion || pkg.version || "",
        };

        const existingEntry = this.activityIndex.get(act.className);
        if (existingEntry) {
          if (act.canonicalIdentity && act.canonicalIdentity.canonicalPackageId === pkg.packageId) {
            this.activityIndex.set(act.className, schema);
          }
        } else {
          this.activityIndex.set(act.className, schema);
        }

        if (pkg.packageId) {
          this.activityIndex.set(`${pkg.packageId}:${act.className}`, schema);

          for (const prop of act.properties) {
            if (prop.clrType && prop.clrType.startsWith("UiPath.") && !this.clrTypeIndex.has(prop.clrType)) {
              this.clrTypeIndex.set(prop.clrType, pkg.packageId);
            }
          }
        }
      }
    }
  }

  private resolveTag(tag: string): string {
    const stripped = tag.includes(":") ? tag.split(":").pop()! : tag;
    return stripped;
  }

  getActivitySchema(tag: string): ActivitySchema | null {
    if (!this.loaded || !this.catalog) return null;

    const direct = this.activityIndex.get(tag);
    if (direct) return direct;

    const className = this.resolveTag(tag);
    const resolved = this.activityIndex.get(className);
    if (resolved) return resolved;

    const lowerTag = className.toLowerCase();
    const entries = Array.from(this.activityIndex.entries());
    for (const [key, schema] of entries) {
      if (key.toLowerCase() === lowerTag) return schema;
    }

    const withoutPrefix = className.replace(/^(UiPath\.[\w.]+\.)/, "");
    if (withoutPrefix !== className) {
      const prefixResolved = this.activityIndex.get(withoutPrefix);
      if (prefixResolved) return prefixResolved;
    }

    const commonAliases: Record<string, string> = {
      "logmessage": "ui:LogMessage",
      "messagebox": "ui:MessageBox",
      "inputdialog": "ui:InputDialog",
      "excelapplicationscope": "ui:ExcelApplicationScope",
      "browserscope": "ui:BrowserScope",
      "useapplicationbrowser": "ui:UseApplicationBrowser",
      "clickactivity": "ui:Click",
      "typeintoactivity": "ui:TypeInto",
      "gettextactivity": "ui:GetText",
      "settextactivity": "ui:SetText",
    };
    const aliasTarget = commonAliases[className.toLowerCase()];
    if (aliasTarget) {
      const aliasResolved = this.activityIndex.get(aliasTarget);
      if (aliasResolved) return aliasResolved;
      const strippedAlias = this.resolveTag(aliasTarget);
      const strippedResolved = this.activityIndex.get(strippedAlias);
      if (strippedResolved) return strippedResolved;
    }

    return null;
  }

  getPackageForActivity(tag: string): string | null {
    const schema = this.getActivitySchema(tag);
    return schema?.packageId || null;
  }

  resolveTypeToPackage(clrType: string): string | null {
    if (!this.loaded || !this.catalog) return null;

    const indexed = this.clrTypeIndex.get(clrType);
    if (indexed) return indexed;

    for (const pkg of this.catalog.packages) {
      if (clrType.startsWith(pkg.packageId + ".") || clrType === pkg.packageId) {
        return pkg.packageId;
      }
    }

    if (clrType.startsWith("UiPath.")) {
      const parts = clrType.replace("UiPath.", "").split(".");
      const candidateIds: string[] = [];
      if (parts.length >= 2 && parts.includes("Activities")) {
        const actIdx = parts.indexOf("Activities");
        candidateIds.push("UiPath." + parts.slice(0, actIdx + 1).join("."));
      }
      if (parts.length >= 1) {
        candidateIds.push(`UiPath.${parts[0]}.Activities`);
      }
      for (const candidate of candidateIds) {
        if (this.packageIndex.has(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  getActivitiesForPackage(packageName: string): CatalogActivity[] {
    if (!this.loaded || !this.catalog) return [];
    const pkg = this.packageIndex.get(packageName);
    return pkg?.activities || [];
  }

  getAllActivities(): ActivitySchema[] {
    if (!this.loaded || !this.catalog) return [];

    const schemas: ActivitySchema[] = [];
    for (const pkg of this.catalog.packages) {
      const metaVersion = metadataService.getPreferredVersion(pkg.packageId);
      for (const act of pkg.activities) {
        schemas.push({
          activity: act,
          packageId: pkg.packageId,
          packageVersion: metaVersion || pkg.version || "",
        });
      }
    }
    return schemas;
  }

  buildActivityPalette(processType: ProcessType): PaletteEntry[] {
    if (!this.loaded || !this.catalog) return [];

    const entries: PaletteEntry[] = [];
    for (const pkg of this.catalog.packages) {
      for (const act of pkg.activities) {
        if (!act.browsable) continue;
        if (!act.emissionApproved) continue;
        if (act.processTypes && act.processTypes.length > 0) {
          if (!act.processTypes.includes(processType) && !act.processTypes.includes("general")) {
            continue;
          }
        }

        entries.push({
          className: act.className,
          displayName: act.displayName,
          packageId: pkg.packageId,
          properties: act.properties.map(p => ({
            name: p.name,
            direction: p.direction,
            required: p.required,
            xamlSyntax: p.xamlSyntax,
            validValues: p.validValues,
          })),
        });
      }
    }

    return entries;
  }

  buildWidePalette(): PaletteEntry[] {
    if (!this.loaded || !this.catalog) return [];

    const entries: PaletteEntry[] = [];
    for (const pkg of this.catalog.packages) {
      for (const act of pkg.activities) {
        if (!act.browsable) continue;
        if (!act.emissionApproved) continue;

        entries.push({
          className: act.className,
          displayName: act.displayName,
          packageId: pkg.packageId,
          properties: act.properties.map(p => ({
            name: p.name,
            direction: p.direction,
            required: p.required,
            xamlSyntax: p.xamlSyntax,
            validValues: p.validValues,
          })),
        });
      }
    }

    return entries;
  }

  getConfirmedVersion(packageName: string): string | null {
    const metaVersion = metadataService.getPreferredVersion(packageName);
    if (metaVersion) return metaVersion;
    return null;
  }

  getEnumValues(activityClassName: string, propertyName: string): string[] | null {
    const schema = this.getActivitySchema(activityClassName);
    if (!schema) return null;

    const prop = schema.activity.properties.find(p => p.name === propertyName);
    if (!prop || !prop.validValues || prop.validValues.length === 0) return null;

    return prop.validValues;
  }

  getPropertyClrType(activityClassName: string, propertyName: string): string | null {
    const schema = this.getActivitySchema(activityClassName);
    if (!schema) return null;

    const prop = schema.activity.properties.find(p => p.name === propertyName);
    if (!prop) return null;

    return prop.clrType;
  }

  getActivityPrefixMap(): Record<string, string> {
    if (!this.loaded || !this.catalog) return {};
    const map: Record<string, string> = {};
    for (const pkg of this.catalog.packages) {
      if (!pkg.prefix && pkg.prefix !== "") continue;
      for (const act of pkg.activities) {
        map[act.className] = pkg.prefix!;
      }
    }
    return map;
  }

  getPrefixForActivity(className: string): string | null {
    if (!this.loaded || !this.catalog) return null;
    const schema = this.getActivitySchema(className);
    if (!schema) return null;
    const pkg = this.packageIndex.get(schema.packageId);
    if (!pkg) return null;

    if (schema.activity.namespace && pkg.additionalNamespaces) {
      let bestMatch: { prefix: string; matchLen: number } | null = null;
      for (const ns of pkg.additionalNamespaces) {
        if (ns.clrNamespace && (schema.activity.namespace === ns.clrNamespace || schema.activity.namespace.startsWith(ns.clrNamespace + "."))) {
          if (!bestMatch || ns.clrNamespace.length > bestMatch.matchLen) {
            bestMatch = { prefix: ns.prefix, matchLen: ns.clrNamespace.length };
          }
        }
      }
      if (bestMatch) return bestMatch.prefix;
    }

    if (pkg.prefix !== undefined) return pkg.prefix;
    return null;
  }

  getAllPrefixableActivityNames(): string[] {
    if (!this.loaded || !this.catalog) return [];
    const names: string[] = [];
    for (const pkg of this.catalog.packages) {
      if (pkg.prefix === undefined || pkg.prefix === "") continue;
      for (const act of pkg.activities) {
        names.push(act.className);
      }
    }
    return names;
  }

  getAllActivityClassNames(): string[] {
    if (!this.loaded || !this.catalog) return [];
    const names: string[] = [];
    for (const pkg of this.catalog.packages) {
      for (const act of pkg.activities) {
        names.push(act.className);
      }
    }
    return names;
  }

  resolvePrefix(prefix: string): string {
    if (this.prefixIndex.has(prefix)) return prefix;
    const aliased = this.aliasIndex.get(prefix);
    if (aliased && this.prefixIndex.has(aliased)) return aliased;
    return prefix;
  }

  getPackageForPrefix(prefix: string): string | null {
    if (!this.loaded || !this.catalog) return null;
    const resolved = this.resolvePrefix(prefix);
    const entry = this.prefixIndex.get(resolved);
    return entry?.packageId || null;
  }

  getNamespaceForPrefix(prefix: string): PackageNamespaceInfo | null {
    if (!this.loaded || !this.catalog) return null;
    const resolved = this.resolvePrefix(prefix);
    const entry = this.prefixIndex.get(resolved);
    if (!entry) return null;
    return {
      prefix: entry.prefix,
      xmlns: entry.xmlns,
      clrNamespace: entry.clrNamespace,
      assembly: entry.assembly,
    };
  }

  getFullNamespaceInfoForPrefix(prefix: string): { packageId: string; prefix: string; clrNamespace: string; assembly: string; xmlns: string } | null {
    if (!this.loaded || !this.catalog) return null;
    const resolved = this.resolvePrefix(prefix);
    return this.prefixIndex.get(resolved) || null;
  }

  getAliasMap(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [alias, canonical] of this.aliasIndex.entries()) {
      result[alias] = canonical;
    }
    return result;
  }

  getAllPrefixes(): string[] {
    return Array.from(this.prefixIndex.keys());
  }

  getAllPackageNamespaceEntries(): Array<{ packageId: string; prefix: string; clrNamespace: string; assembly: string; xmlns?: string }> {
    if (!this.loaded || !this.catalog) return [];
    const entries: Array<{ packageId: string; prefix: string; clrNamespace: string; assembly: string; xmlns?: string }> = [];
    for (const [packageId, pkg] of this.packageIndex) {
      if (pkg.prefix && pkg.clrNamespace && pkg.assembly) {
        entries.push({ packageId, prefix: pkg.prefix, clrNamespace: pkg.clrNamespace, assembly: pkg.assembly, xmlns: pkg.xmlns });
      }
      if (pkg.additionalNamespaces) {
        for (const ns of pkg.additionalNamespaces) {
          let variantSuffix = "";
          if (ns.clrNamespace.startsWith(packageId + ".")) {
            variantSuffix = ns.clrNamespace.substring(packageId.length + 1);
          } else if (ns.clrNamespace.startsWith(pkg.clrNamespace + ".")) {
            variantSuffix = ns.clrNamespace.substring(pkg.clrNamespace!.length + 1);
          } else if (ns.assembly !== pkg.assembly) {
            variantSuffix = ns.assembly.replace(packageId + ".", "");
          }
          const variantKey = variantSuffix ? `${packageId}::${variantSuffix}` : packageId;
          entries.push({ packageId: variantKey, prefix: ns.prefix, clrNamespace: ns.clrNamespace, assembly: ns.assembly, xmlns: ns.xmlns });
        }
      }
    }
    return entries;
  }

  getPackageNamespaceInfo(packageId: string): { prefix: string; clrNamespace: string; assembly: string } | null {
    if (!this.loaded || !this.catalog) return null;
    const pkg = this.packageIndex.get(packageId);
    if (!pkg) return null;
    if (pkg.prefix && pkg.clrNamespace && pkg.assembly) {
      return { prefix: pkg.prefix, clrNamespace: pkg.clrNamespace, assembly: pkg.assembly };
    }
    return null;
  }

  getNamespaceInfoForActivity(activityClassName: string): { prefix: string; clrNamespace: string; assembly: string; packageId: string } | null {
    const schema = this.getActivitySchema(activityClassName);
    if (!schema) return null;

    const pkg = this.packageIndex.get(schema.packageId);
    if (!pkg) return null;

    if (schema.activity.namespace && pkg.additionalNamespaces) {
      let bestMatch: { prefix: string; clrNamespace: string; assembly: string; matchLen: number } | null = null;
      for (const ns of pkg.additionalNamespaces) {
        if (ns.clrNamespace && (schema.activity.namespace === ns.clrNamespace || schema.activity.namespace.startsWith(ns.clrNamespace + "."))) {
          if (!bestMatch || ns.clrNamespace.length > bestMatch.matchLen) {
            bestMatch = { prefix: ns.prefix, clrNamespace: ns.clrNamespace, assembly: ns.assembly, matchLen: ns.clrNamespace.length };
          }
        }
      }
      if (bestMatch) {
        return { prefix: bestMatch.prefix, clrNamespace: bestMatch.clrNamespace, assembly: bestMatch.assembly, packageId: schema.packageId };
      }
    }

    const nsInfo = this.getPackageNamespaceInfo(schema.packageId);
    if (!nsInfo) return null;
    return { ...nsInfo, packageId: schema.packageId };
  }

  isPropertyAvailableForVersion(activityClassName: string, propertyName: string, packageVersion: string): boolean {
    const schema = this.getActivitySchema(activityClassName);
    if (!schema) return true;

    const prop = schema.activity.properties.find(p => p.name === propertyName);
    if (!prop) return false;

    if (prop.addedInVersion && this.compareVersions(packageVersion, prop.addedInVersion) < 0) {
      return false;
    }

    if (prop.removedInVersion && this.compareVersions(packageVersion, prop.removedInVersion) >= 0) {
      return false;
    }

    return true;
  }

  getPreferredVersion(packageName: string): string | null {
    return metadataService.getPreferredVersion(packageName);
  }

  getFeedStatus(packageName: string): FeedStatus | null {
    if (!this.loaded || !this.catalog) return null;
    const pkg = this.packageIndex.get(packageName);
    return pkg?.feedStatus || null;
  }

  isPackageVerified(packageName: string): boolean {
    const status = this.getFeedStatus(packageName);
    return status === "verified";
  }

  private compareVersions(a: string, b: string): number {
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

  validateEmittedActivity(
    tag: string,
    attributes: Record<string, string>,
    children: string[]
  ): ActivityValidationResult {
    const result: ActivityValidationResult = {
      valid: true,
      violations: [],
      corrections: [],
    };

    const schema = this.getActivitySchema(tag);
    if (!schema) return result;

    const FRAMEWORK_ATTRIBUTES = new Set([
      "DisplayName", "ContinueOnError", "sap2010:Annotation.AnnotationText",
      "sap2010:WorkflowViewState.IdRef", "WorkflowViewState.IdRef",
      "sap:VirtualizedContainerService.HintSize",
      "sap2010:VirtualizedContainerService.HintSize", "VirtualizedContainerService.HintSize",
      "Annotation.AnnotationText",
      "DelayAfter", "DelayBefore",
      "mc:Ignorable", "x:Class", "x:TypeArguments", "TypeArguments", "x:Name",
    ]);

    const FRAMEWORK_CHILD_ELEMENTS = new Set([
      "Variables", "VirtualizedContainerService.HintSize", "WorkflowViewState.IdRef",
      "Try", "TryCatch.Try", "Catches", "TryCatch.Catches", "Finally", "TryCatch.Finally",
      "Body", "ForEach.Body", "ParallelForEach.Body",
      "Then", "If.Then", "Else", "If.Else",
      "Cases", "Switch.Cases", "Default", "Switch.Default",
      "Condition", "While.Condition", "DoWhile.Condition",
    ]);

    const knownPropertyNames = new Set(schema.activity.properties.map(p => p.name));
    const className = tag.includes(":") ? tag.split(":").pop()! : tag;
    const isComplete = schema.activity.propertiesComplete === true;

    if (isComplete) {
      for (const attrName of Object.keys(attributes)) {
        if (attrName.startsWith("xmlns")) continue;
        if (!knownPropertyNames.has(attrName) && !FRAMEWORK_ATTRIBUTES.has(attrName)) {
          result.valid = false;
          result.violations.push(`Unrecognized attribute "${attrName}" on ${tag} — not in catalog schema`);
          result.corrections.push({
            type: "remove-attribute",
            property: attrName,
            detail: `Remove unrecognized attribute "${attrName}" from ${tag}`,
          });
        }
      }

      for (const childName of children) {
        const simpleName = childName.includes(".") ? childName.split(".").pop()! : childName;
        if (FRAMEWORK_CHILD_ELEMENTS.has(simpleName) || FRAMEWORK_CHILD_ELEMENTS.has(childName)) continue;
        if (!knownPropertyNames.has(simpleName) && !FRAMEWORK_ATTRIBUTES.has(simpleName)) {
          result.valid = false;
          result.violations.push(`Unrecognized child property "${childName}" on ${tag} — not in catalog schema`);
        }
      }
    }

    const attrNamesLower = new Map<string, string>();
    for (const attrName of Object.keys(attributes)) {
      attrNamesLower.set(attrName.toLowerCase(), attrName);
    }

    for (const prop of schema.activity.properties) {
      const hasAttribute = prop.name in attributes || attrNamesLower.has(prop.name.toLowerCase());
      const hasChild = children.some(c => c === prop.name || c === `${tag.split(":").pop()}.${prop.name}`);

      if (prop.required && !hasAttribute && !hasChild) {
        const defaultValue = prop.default || `TODO_Provide_value_for_${prop.name}`;
        result.valid = false;
        result.violations.push(`Missing required property "${prop.name}" on ${tag}`);
        result.corrections.push({
          type: "add-missing-required",
          property: prop.name,
          detail: `Injecting required property "${prop.name}" with ${prop.default ? "catalog default" : "placeholder"} value "${defaultValue}" on ${tag}`,
          correctedValue: defaultValue,
        });
      }

      if (prop.xamlSyntax === "child-element" && hasAttribute && !hasChild) {
        result.valid = false;
        result.violations.push(`Property "${prop.name}" on ${tag} must be a child element, not an attribute`);
        result.corrections.push({
          type: "move-to-child-element",
          property: prop.name,
          detail: `Move "${prop.name}" from attribute to child element <${tag.split(":").pop()}.${prop.name}> with ${prop.argumentWrapper || "InArgument"} wrapper`,
          argumentWrapper: prop.argumentWrapper || "InArgument",
          typeArguments: prop.typeArguments,
        });
      }

      if (prop.xamlSyntax === "child-element" && hasChild && prop.argumentWrapper && !hasAttribute) {
        result.corrections.push({
          type: "wrap-in-argument",
          property: prop.name,
          detail: `Ensure "${prop.name}" child element on ${tag} is wrapped with <${prop.argumentWrapper}> if not already`,
          argumentWrapper: prop.argumentWrapper,
          typeArguments: prop.typeArguments,
        });
      }

      if (prop.xamlSyntax === "attribute" && hasChild && !hasAttribute) {
        result.valid = false;
        result.violations.push(`Property "${prop.name}" on ${tag} is a child element but should be an attribute`);
        result.corrections.push({
          type: "move-to-attribute",
          property: prop.name,
          detail: `Move "${prop.name}" from child element to attribute on ${tag}`,
        });
      }

      if (hasAttribute && prop.validValues && prop.validValues.length > 0) {
        const currentVal = this.stripEnumQuotes(attributes[prop.name]);
        if (currentVal && !prop.validValues.includes(currentVal)) {
          const normalized = this.normalizeEnumValue(currentVal, prop.validValues);
          if (normalized) {
            result.corrections.push({
              type: "fix-invalid-value",
              property: prop.name,
              detail: `Auto-corrected "${prop.name}" value "${currentVal}" → "${normalized}" on ${tag}`,
              correctedValue: normalized,
            });
          } else {
            result.valid = false;
            result.violations.push(`ENUM_VIOLATION: Invalid value "${currentVal}" for "${prop.name}" on ${tag} — valid values: ${prop.validValues.join(", ")}. No normalization match found.`);
            result.corrections.push({
              type: "fix-invalid-value",
              property: prop.name,
              detail: `ENUM_VIOLATION: "${prop.name}" value "${currentVal}" is not a valid enum value on ${tag}. Valid values: ${prop.validValues.join(", ")}`,
              correctedValue: undefined,
            });
          }
        }
      }

    }

    return result;
  }

  private stripEnumQuotes(value: string): string {
    return value.replace(/&quot;/g, "").replace(/^["']+|["']+$/g, "").trim();
  }

  private normalizeEnumValue(value: string, validValues: string[]): string | null {
    const SYNONYM_MAP: Record<string, string> = {
      "information": "Info",
      "warning": "Warn",
      "debug": "Trace",
      "error": "Error",
      "critical": "Fatal",
      "verbose": "Verbose",
      "get": "GET",
      "post": "POST",
      "put": "PUT",
      "delete": "DELETE",
      "patch": "PATCH",
      "json": "JSON",
      "xml": "XML",
      "text": "TEXT",
      "html": "HTML",
      "csv": "CSV",
      "application/json": "JSON",
      "application/xml": "XML",
      "text/plain": "TEXT",
      "text/html": "HTML",
    };

    const stripped = this.stripEnumQuotes(value);
    const lowerVal = stripped.toLowerCase();
    for (const valid of validValues) {
      if (valid.toLowerCase() === lowerVal) return valid;
    }

    const synonym = SYNONYM_MAP[lowerVal];
    if (synonym && validValues.includes(synonym)) return synonym;

    return null;
  }
}

export const catalogService = new CatalogService();

const REQUIRED_PREFIX_COVERAGE: Record<string, string> = {
  "isactr": "UiPath.IntegrationService.Activities",
  "p": "UiPath.IntelligentOCR.Activities",
  "snetmail": "System.Net.Mail",
  "uaa": "UiPath.Agentic.Activities",
  "uaasm": "UiPath.Agentic.Activities",
  "uact365": "UiPath.Act365.IntegrationService.Activities",
  "uadds": "UiPath.ActiveDirectoryDomainServices.Activities",
  "uadobepdf": "UiPath.AdobePdfServices.IntegrationService.Activities",
  "uadosign": "UiPath.Adobe.AdobeSign.Activities",
  "uafr": "UiPath.AzureFormRecognizerV3.Activities",
  "ualteryx": "UiPath.Alteryx.Activities",
  "uamzconn": "UiPath.AmazonConnect.Activities",
  "uamzscope": "UiPath.Amazon.Scope.Activities",
  "uamzws": "UiPath.AmazonWorkSpaces.Activities",
  "uaplemail": "UiPath.AppleMail.Activities",
  "uaplnum": "UiPath.AppleNumbers.Activities",
  "uaplscript": "UiPath.AppleScripting.Activities",
  "uasj": "UiPath.System.Activities",
  "uasom": "UiPath.System.Activities",
  "uaws": "UiPath.AmazonWebServices.Activities",
  "uaz": "UiPath.Azure.Activities",
  "uazad": "UiPath.AzureActiveDirectory.Activities",
  "uazoai": "UiPath.MicrosoftAzureOpenAI.IntegrationService.Activities",
  "uazwvd": "UiPath.AzureWindowsVirtualDesktop.Activities",
  "ubamboo": "UiPath.BambooHR.IntegrationService.Activities",
  "ubox": "UiPath.Box.Activities",
  "uboxis": "UiPath.Box.IntegrationService.Activities",
  "ucallout": "UiPath.Callout.Activities",
  "ucampmon": "UiPath.CampaignMonitor.IntegrationService.Activities",
  "ucas": "UiPath.System.Activities",
  "ucitrix": "UiPath.Citrix.Activities",
  "ucm": "UiPath.CommunicationsMining.Activities",
  "ucmp": "UiPath.Amazon.Comprehend.Activities",
  "ucognitive": "UiPath.Cognitive.Activities",
  "uconfluence": "UiPath.ConfluenceCloud.IntegrationService.Activities",
  "ucoupa": "UiPath.Coupa.IntegrationService.Activities",
  "ucred": "UiPath.Credentials.Activities",
  "ucrypt": "UiPath.Cryptography.Activities",
  "ucs": "UiPath.ComplexScenarios.Activities",
  "uda": "UiPath.DataService.Activities",
  "udam": "UiPath.DataService.Activities",
  "udb": "UiPath.Database.Activities",
  "udocuis": "UiPath.Docusign.IntegrationService.Activities",
  "udocusign": "UiPath.DocuSign.Activities",
  "udropbiz": "UiPath.DropboxBusiness.IntegrationService.Activities",
  "udropbox": "UiPath.Dropbox.IntegrationService.Activities",
  "uds": "UiPath.DataService.Activities",
  "udu": "UiPath.DocumentUnderstanding.Activities",
  "uduml": "UiPath.DocumentUnderstanding.ML.Activities",
  "udyn": "UiPath.MicrosoftDynamics.Activities",
  "udyncrm": "UiPath.MicrosoftDynamicsCRM.IntegrationService.Activities",
  "ueloqua": "UiPath.OracleEloqua.IntegrationService.Activities",
  "uexcel": "UiPath.Excel.Activities",
  "uexchange": "UiPath.ExchangeServer.Activities",
  "uexpensify": "UiPath.Expensify.IntegrationService.Activities",
  "uform": "UiPath.Form.Activities",
  "ufreshsvc": "UiPath.Freshservice.IntegrationService.Activities",
  "uftp": "UiPath.FTP.Activities",
  "ugc": "UiPath.GoogleCloud.Activities",
  "ugenai": "UiPath.GenAI.Activities",
  "ugithub": "UiPath.GitHub.IntegrationService.Activities",
  "ugotoweb": "UiPath.GoToWebinar.IntegrationService.Activities",
  "ugs": "UiPath.GSuite.Activities",
  "ugv": "UiPath.GoogleVision.Activities",
  "uhyperv": "UiPath.HyperV.Activities",
  "ui": "UiPath.UIAutomation.Activities",
  "uis": "UiPath.IntegrationService.Activities",
  "uisad": "UiPath.IntelligentOCR.StudioWeb.Activities",
  "uisape": "UiPath.IntelligentOCR.StudioWeb.Activities",
  "uisw": "UiPath.IntelligentOCR.StudioWeb.Activities",
  "uix": "UiPath.UIAutomation.Activities",
  "ujava": "UiPath.Java.Activities",
  "ujira": "UiPath.Jira.Activities",
  "ujirais": "UiPath.Jira.IntegrationService.Activities",
  "umae": "UiPath.MicrosoftOffice365.Activities",
  "umafm": "UiPath.MicrosoftOffice365.Activities",
  "umail": "UiPath.Mail.Activities",
  "umailchimp": "UiPath.Mailchimp.IntegrationService.Activities",
  "umam": "UiPath.MicrosoftOffice365.Activities",
  "umarketo": "UiPath.Marketo.Activities",
  "umarketois": "UiPath.Marketo.IntegrationService.Activities",
  "uml": "UiPath.MLActivities",
  "umlsvc": "UiPath.MLServices.Activities",
  "umstrans": "UiPath.MicrosoftTranslator.Activities",
  "umsvision": "UiPath.MicrosoftVision.Activities",
  "unetiq": "UiPath.NetIQeDirectory.Activities",
  "unetsuite": "UiPath.OracleNetSuite.Activities",
  "unetsuitis": "UiPath.OracleNetSuite.IntegrationService.Activities",
  "uo365": "UiPath.MicrosoftOffice365.Activities",
  "uocr": "UiPath.IntelligentOCR.Activities",
  "uoic": "UiPath.Oracle.IntegrationCloud.Process.Activities",
  "uopenai": "UiPath.OpenAI.IntegrationService.Activities",
  "upa": "UiPath.Process.Activities",
  "upad": "UiPath.Persistence.Activities",
  "upaf": "UiPath.Persistence.Activities",
  "upaj": "UiPath.Persistence.Activities",
  "upama": "UiPath.Persistence.Activities",
  "upas": "UiPath.Process.Activities",
  "upat": "UiPath.Persistence.Activities",
  "upau": "UiPath.Persistence.Activities",
  "updf": "UiPath.PDF.Activities",
  "upers": "UiPath.Persistence.Activities",
  "upr": "UiPath.Platform",
  "upres": "UiPath.Presentations.Activities",
  "upython": "UiPath.Python.Activities",
  "uqbo": "UiPath.QuickBooksOnline.IntegrationService.Activities",
  "urek": "UiPath.Amazon.Rekognition.Activities",
  "usapc4c": "UiPath.SAPCloudForCustomer.IntegrationService.Activities",
  "usau": "UiPath.MicrosoftOffice365.Activities",
  "usendgrid": "UiPath.SendGrid.IntegrationService.Activities",
  "usf": "UiPath.Salesforce.Activities",
  "usfis": "UiPath.Salesforce.IntegrationService.Activities",
  "usfmc": "UiPath.SalesforceMarketingCloud.IntegrationService.Activities",
  "usheet": "UiPath.Smartsheet.Activities",
  "usheetis": "UiPath.Smartsheet.IntegrationService.Activities",
  "uslack": "UiPath.Slack.Activities",
  "usnow": "UiPath.ServiceNow.Activities",
  "usnowflake": "UiPath.Snowflake.IntegrationService.Activities",
  "usnowis": "UiPath.ServiceNow.IntegrationService.Activities",
  "usuccfact": "UiPath.SuccessFactors.Activities",
  "usugare": "UiPath.SugarEnterprise.IntegrationService.Activities",
  "usugarp": "UiPath.SugarProfessional.IntegrationService.Activities",
  "usugars": "UiPath.SugarSell.IntegrationService.Activities",
  "usugarv": "UiPath.SugarServe.IntegrationService.Activities",
  "usysctr": "UiPath.SystemCenter.Activities",
  "utableau": "UiPath.Tableau.Activities",
  "uteams": "UiPath.MicrosoftTeams.Activities",
  "uterminal": "UiPath.Terminal.Activities",
  "utest": "UiPath.Testing.Activities",
  "utwilio": "UiPath.Twilio.Activities",
  "utwiliois": "UiPath.Twilio.IntegrationService.Activities",
  "utwitter": "UiPath.Twitter.IntegrationService.Activities",
  "utxt": "UiPath.Amazon.Textract.Activities",
  "uvertex": "UiPath.GoogleVertex.IntegrationService.Activities",
  "uvmware": "UiPath.VMware.Activities",
  "uwd": "UiPath.Workday.Activities",
  "uwdis": "UiPath.Workday.IntegrationService.Activities",
  "uweb": "UiPath.WebAPI.Activities",
  "uwebex": "UiPath.CiscoWebexTeams.IntegrationService.Activities",
  "uwfe": "UiPath.WorkflowEvents.Activities",
  "uword": "UiPath.Word.Activities",
  "uworkato": "UiPath.Workato.Activities",
  "uzendesk": "UiPath.Zendesk.IntegrationService.Activities",
  "uzoom": "UiPath.Zoom.IntegrationService.Activities",
};

const REQUIRED_ALIAS_COVERAGE: Record<string, string> = {
  "ds": "uds",
  "datafabric": "uds",
  "ocr": "uocr",
  "uwebapi": "uweb",
  "usfdc": "usf",
  "ugcloud": "ugc",
  "uazure": "uaz",
  "ucrypto": "ucrypt",
  "ui2": "ui",
};

export function validateCatalogNamespaceCoverage(): { missingPrefixes: string[]; mismatchedPrefixes: string[]; missingAliases: string[]; catalogPrefixCount: number; manifestEntryCount: number } {
  if (!catalogService.isLoaded()) {
    console.warn("[CatalogService] Cannot validate namespace coverage — catalog not loaded");
    return { missingPrefixes: [], mismatchedPrefixes: [], missingAliases: [], catalogPrefixCount: 0, manifestEntryCount: 0 };
  }

  const catalogPrefixes = catalogService.getAllPrefixes();
  const catalogPrefixCount = catalogPrefixes.length;
  const manifestEntryCount = Object.keys(REQUIRED_PREFIX_COVERAGE).length + Object.keys(REQUIRED_ALIAS_COVERAGE).length;

  const missingPrefixes: string[] = [];
  const mismatchedPrefixes: string[] = [];
  for (const [prefix, expectedPkg] of Object.entries(REQUIRED_PREFIX_COVERAGE)) {
    const resolved = catalogService.getPackageForPrefix(prefix);
    if (!resolved) {
      missingPrefixes.push(prefix);
    } else if (resolved !== expectedPkg) {
      mismatchedPrefixes.push(`${prefix}: expected ${expectedPkg}, got ${resolved}`);
    }
  }

  const missingAliases: string[] = [];
  for (const [alias, expectedCanonical] of Object.entries(REQUIRED_ALIAS_COVERAGE)) {
    const resolved = catalogService.getPackageForPrefix(alias);
    const canonicalResolved = catalogService.getPackageForPrefix(expectedCanonical);
    if (!resolved) {
      missingAliases.push(alias);
    } else if (canonicalResolved && resolved !== canonicalResolved) {
      missingAliases.push(`${alias}: resolves to ${resolved}, but canonical ${expectedCanonical} resolves to ${canonicalResolved}`);
    }
  }

  if (missingPrefixes.length > 0) {
    console.warn(`[CatalogService] Migration coverage: ${missingPrefixes.length}/${manifestEntryCount} legacy prefixes missing from catalog: ${missingPrefixes.join(", ")}`);
  }
  if (mismatchedPrefixes.length > 0) {
    console.warn(`[CatalogService] Migration coverage: ${mismatchedPrefixes.length} prefix→package mismatches vs legacy manifest: ${mismatchedPrefixes.join("; ")}`);
  }
  if (missingAliases.length > 0) {
    console.warn(`[CatalogService] Migration coverage: ${missingAliases.length} legacy aliases not resolving: ${missingAliases.join(", ")}`);
  }
  if (missingPrefixes.length === 0 && mismatchedPrefixes.length === 0 && missingAliases.length === 0) {
    console.log(`[CatalogService] Migration coverage validated: catalog has ${catalogPrefixCount} prefixes, all ${manifestEntryCount} legacy manifest entries confirmed (${Object.keys(REQUIRED_PREFIX_COVERAGE).length} prefixes + ${Object.keys(REQUIRED_ALIAS_COVERAGE).length} aliases)`);
  }

  return { missingPrefixes, mismatchedPrefixes, missingAliases, catalogPrefixCount, manifestEntryCount };
}
