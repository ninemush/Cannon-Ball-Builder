import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { validateCatalog } from "./catalog-validator";

export type ProcessType = "api-integration" | "document-processing" | "attended-ui" | "unattended-ui" | "orchestration" | "general";

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
}

export interface CatalogActivity {
  className: string;
  displayName: string;
  browsable: boolean;
  processTypes: ProcessType[];
  properties: CatalogProperty[];
}

export interface CatalogPackage {
  packageId: string;
  version: string;
  activities: CatalogActivity[];
}

export interface ActivityCatalog {
  catalogVersion: string;
  generatedAt: string;
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
  properties: { name: string; direction: string; required: boolean; xamlSyntax: string }[];
}

class CatalogService {
  private catalog: ActivityCatalog | null = null;
  private activityIndex = new Map<string, ActivitySchema>();
  private packageIndex = new Map<string, CatalogPackage>();
  private loaded = false;

  load(catalogPath?: string): void {
    const path = catalogPath || join(process.cwd(), "catalog", "activity-catalog.json");

    if (!existsSync(path)) {
      console.warn(`[Activity Catalog] Catalog file not found at ${path} — catalog constraints disabled`);
      this.loaded = false;
      return;
    }

    try {
      const raw = readFileSync(path, "utf-8");
      const parsed = JSON.parse(raw);

      const validation = validateCatalog(parsed);
      if (!validation.valid) {
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

      let totalActivities = 0;
      for (const pkg of this.catalog.packages) {
        totalActivities += pkg.activities.length;
      }

      console.log(`Activity catalog loaded: ${this.catalog.packages.length} packages, ${totalActivities} activities, Studio ${this.catalog.studioVersion}`);
    } catch (err: any) {
      console.warn(`[Activity Catalog] Failed to load catalog: ${err.message} — catalog constraints disabled`);
      this.loaded = false;
    }
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  private buildIndices(): void {
    if (!this.catalog) return;

    this.activityIndex.clear();
    this.packageIndex.clear();

    for (const pkg of this.catalog.packages) {
      if (pkg.packageId) {
        this.packageIndex.set(pkg.packageId, pkg);
      }

      for (const act of pkg.activities) {
        const schema: ActivitySchema = {
          activity: act,
          packageId: pkg.packageId,
          packageVersion: pkg.version,
        };

        this.activityIndex.set(act.className, schema);

        if (pkg.packageId) {
          this.activityIndex.set(`${pkg.packageId}:${act.className}`, schema);
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
    return this.activityIndex.get(className) || null;
  }

  getPackageForActivity(tag: string): string | null {
    const schema = this.getActivitySchema(tag);
    return schema?.packageId || null;
  }

  getActivitiesForPackage(packageName: string): CatalogActivity[] {
    if (!this.loaded || !this.catalog) return [];
    const pkg = this.packageIndex.get(packageName);
    return pkg?.activities || [];
  }

  buildActivityPalette(processType: ProcessType): PaletteEntry[] {
    if (!this.loaded || !this.catalog) return [];

    const entries: PaletteEntry[] = [];
    for (const pkg of this.catalog.packages) {
      for (const act of pkg.activities) {
        if (!act.browsable) continue;
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
          })),
        });
      }
    }

    return entries;
  }

  getConfirmedVersion(packageName: string): string | null {
    if (!this.loaded || !this.catalog) return null;
    const pkg = this.packageIndex.get(packageName);
    return pkg?.version || null;
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
      "Timeout", "DelayAfter", "DelayBefore",
      "mc:Ignorable", "x:Class", "x:TypeArguments", "x:Name",
    ]);

    const FRAMEWORK_CHILD_ELEMENTS = new Set([
      "Variables", "VirtualizedContainerService.HintSize", "WorkflowViewState.IdRef",
    ]);

    const knownPropertyNames = new Set(schema.activity.properties.map(p => p.name));
    const className = tag.includes(":") ? tag.split(":").pop()! : tag;

    for (const attrName of Object.keys(attributes)) {
      if (attrName.startsWith("xmlns")) continue;
      if (!knownPropertyNames.has(attrName) && !FRAMEWORK_ATTRIBUTES.has(attrName)) {
        result.valid = false;
        result.violations.push(`Unrecognized attribute "${attrName}" on ${tag} — not in catalog schema`);
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

    for (const prop of schema.activity.properties) {
      const hasAttribute = prop.name in attributes;
      const hasChild = children.some(c => c === prop.name || c === `${tag.split(":").pop()}.${prop.name}`);

      if (prop.required && !hasAttribute && !hasChild) {
        result.valid = false;
        result.violations.push(`Missing required property "${prop.name}" on ${tag}`);
        result.corrections.push({
          type: "add-missing-required",
          property: prop.name,
          detail: `Add required property "${prop.name}" (${prop.clrType}) to ${tag}`,
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
        const currentVal = attributes[prop.name];
        if (currentVal && !prop.validValues.includes(currentVal)) {
          result.valid = false;
          result.violations.push(`ENUM_VIOLATION: Invalid value "${currentVal}" for "${prop.name}" on ${tag} — valid values: ${prop.validValues.join(", ")}. This is a generation failure — enum violations must not be auto-corrected.`);
          result.corrections.push({
            type: "fix-invalid-value",
            property: prop.name,
            detail: `GENERATION_FAILURE: "${prop.name}" value "${currentVal}" is not a valid enum value on ${tag}. Valid values: ${prop.validValues.join(", ")}`,
            correctedValue: undefined,
          });
        }
      }
    }

    return result;
  }
}

export const catalogService = new CatalogService();
