import { catalogService, type CatalogProperty } from "./catalog-service";
import type { StudioProfile } from "./metadata-service";
import { metadataService } from "./metadata-service";
import type { WorkflowSpec, WorkflowNode, ActivityNode } from "../workflow-spec-types";

export interface SpecValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  activityTemplate: string;
  activityDisplayName: string;
  property?: string;
  message: string;
  autoFixed: boolean;
}

export interface SpecValidationReport {
  totalActivities: number;
  validActivities: number;
  unknownActivities: number;
  strippedProperties: number;
  enumCorrections: number;
  missingRequiredFilled: number;
  commentConversions: number;
  issues: SpecValidationIssue[];
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const av = aParts[i] || 0;
    const bv = bParts[i] || 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

const ENUM_AUTO_CORRECTION_MAP: Record<string, string> = {
  "Information": "Info",
  "Warning": "Warn",
  "Debug": "Trace",
  "Critical": "Fatal",
};

function createEmptyReport(): SpecValidationReport {
  return {
    totalActivities: 0,
    validActivities: 0,
    unknownActivities: 0,
    strippedProperties: 0,
    enumCorrections: 0,
    missingRequiredFilled: 0,
    commentConversions: 0,
    issues: [],
  };
}

function getDefaultForType(clrType: string): string {
  if (clrType.includes("Boolean") || clrType === "bool") return "False";
  if (clrType.includes("Int") || clrType.includes("Double") || clrType.includes("Decimal") || clrType === "int") return "0";
  if (clrType.includes("TimeSpan")) return "00:00:00";
  return `PLACEHOLDER_${clrType.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function resolveTargetVersion(schema: { packageId: string; packageVersion: string }, _studioProfile: StudioProfile | null): string {
  const preferred = metadataService.getPreferredVersion(schema.packageId);
  if (preferred) return preferred;
  return schema.packageVersion;
}

function validateActivityNode(
  node: ActivityNode,
  report: SpecValidationReport,
  studioProfile: StudioProfile | null,
): WorkflowNode {
  report.totalActivities++;
  const issueCountAtStart = report.issues.length;

  const schema = catalogService.getActivitySchema(node.template);

  if (!schema) {
    report.unknownActivities++;
    report.commentConversions++;
    const message = `Unknown activity template "${node.template}" — not in catalog. Converted to Comment stub.`;
    report.issues.push({
      severity: "error",
      code: "UNKNOWN_ACTIVITY",
      activityTemplate: node.template,
      activityDisplayName: node.displayName,
      message,
      autoFixed: true,
    });
    console.log(`[SpecValidator] ${message}`);

    return {
      kind: "activity",
      template: "Comment",
      displayName: `${node.displayName} (stub)`,
      properties: {
        Text: `Unknown activity template: ${node.template}. Original display name: "${node.displayName}". Manual implementation required.`,
      },
      outputVar: null,
      outputType: null,
      errorHandling: "none",
    };
  }

  if (studioProfile) {
    const packageId = schema.packageId;
    const packageVersion = schema.packageVersion;
    if (packageId && packageVersion && !metadataService.isVersionPreferred(packageId, packageVersion)) {
      const preferred = metadataService.getPreferredVersion(packageId);
      if (preferred && preferred !== packageVersion) {
        report.issues.push({
          severity: "warning",
          code: "VERSION_MISMATCH",
          activityTemplate: node.template,
          activityDisplayName: node.displayName,
          message: `Activity "${node.template}" is from package ${packageId}@${packageVersion} which differs from preferred version ${preferred}.`,
          autoFixed: false,
        });
      }
    }
  }

  const knownProps = new Map<string, CatalogProperty>();
  for (const p of schema.activity.properties) {
    knownProps.set(p.name, p);
  }

  const INHERITED_BASE_PROPERTIES = new Set([
    "ContinueOnError",
    "Timeout",
    "DisplayName",
    "Private",
    "DelayBefore",
    "DelayAfter",
    "TimeoutMS",
    "Annotation",
    "AnnotationText",
  ]);

  const filteredProperties: Record<string, any> = {};
  const strippedNames: string[] = [];

  for (const [key, value] of Object.entries(node.properties || {})) {
    if (!knownProps.has(key) && !INHERITED_BASE_PROPERTIES.has(key)) {
      strippedNames.push(key);
      report.strippedProperties++;
      continue;
    }

    const propSchema = knownProps.get(key);

    if (propSchema && propSchema.validValues && propSchema.validValues.length > 0) {
      const strValue = typeof value === "object" ? null : String(value);
      if (strValue && !propSchema.validValues.includes(strValue)) {
        const corrected = ENUM_AUTO_CORRECTION_MAP[strValue];
        if (corrected && propSchema.validValues.includes(corrected)) {
          filteredProperties[key] = corrected;
          report.enumCorrections++;
          report.issues.push({
            severity: "info",
            code: "ENUM_AUTO_CORRECTED",
            activityTemplate: node.template,
            activityDisplayName: node.displayName,
            property: key,
            message: `Auto-corrected enum value "${strValue}" → "${corrected}" for property "${key}".`,
            autoFixed: true,
          });
          console.log(`[SpecValidator] Auto-corrected ${node.template}."${key}": "${strValue}" → "${corrected}"`);
          continue;
        } else {
          report.issues.push({
            severity: "error",
            code: "INVALID_ENUM_VALUE",
            activityTemplate: node.template,
            activityDisplayName: node.displayName,
            property: key,
            message: `Invalid enum value "${strValue}" for property "${key}" on ${node.template}. Valid values: ${propSchema.validValues.join(", ")}.`,
            autoFixed: false,
          });
          filteredProperties[key] = value;
          continue;
        }
      }
    }

    filteredProperties[key] = value;
  }

  if (strippedNames.length > 0) {
    report.issues.push({
      severity: "warning",
      code: "UNKNOWN_PROPERTIES_STRIPPED",
      activityTemplate: node.template,
      activityDisplayName: node.displayName,
      message: `Stripped ${strippedNames.length} non-catalog property(ies) from ${node.template} "${node.displayName}": ${strippedNames.join(", ")}`,
      autoFixed: true,
    });
    console.log(`[SpecValidator] Stripped properties from ${node.template} "${node.displayName}": ${strippedNames.join(", ")}`);
  }

  const targetVersion = resolveTargetVersion(schema, studioProfile);
  if (targetVersion) {
    const versionStrippedNames: string[] = [];
    for (const [key] of Object.entries(filteredProperties)) {
      const propSchema = knownProps.get(key);
      if (!propSchema) continue;

      if (propSchema.addedInVersion && compareVersions(targetVersion, propSchema.addedInVersion) < 0) {
        versionStrippedNames.push(key);
        report.strippedProperties++;
        report.issues.push({
          severity: "warning",
          code: "PROPERTY_NOT_YET_AVAILABLE",
          activityTemplate: node.template,
          activityDisplayName: node.displayName,
          property: key,
          message: `Property "${key}" on ${node.template} was added in version ${propSchema.addedInVersion} but target package is ${targetVersion} — stripped.`,
          autoFixed: true,
        });
        console.log(`[SpecValidator] Stripped "${key}" from ${node.template}: added in ${propSchema.addedInVersion}, target is ${targetVersion}`);
      }

      if (propSchema.removedInVersion && compareVersions(targetVersion, propSchema.removedInVersion) >= 0) {
        versionStrippedNames.push(key);
        report.strippedProperties++;
        report.issues.push({
          severity: "warning",
          code: "PROPERTY_REMOVED_IN_VERSION",
          activityTemplate: node.template,
          activityDisplayName: node.displayName,
          property: key,
          message: `Property "${key}" on ${node.template} was removed in version ${propSchema.removedInVersion} and target package is ${targetVersion} — stripped.`,
          autoFixed: true,
        });
        console.log(`[SpecValidator] Stripped "${key}" from ${node.template}: removed in ${propSchema.removedInVersion}, target is ${targetVersion}`);
      }
    }
    for (const name of versionStrippedNames) {
      delete filteredProperties[name];
    }
  }

  for (const prop of schema.activity.properties) {
    if (prop.required && !(prop.name in filteredProperties)) {
      if (targetVersion) {
        if (prop.addedInVersion && compareVersions(targetVersion, prop.addedInVersion) < 0) {
          report.issues.push({
            severity: "info",
            code: "REQUIRED_PROPERTY_NOT_AVAILABLE",
            activityTemplate: node.template,
            activityDisplayName: node.displayName,
            property: prop.name,
            message: `Required property "${prop.name}" on ${node.template} is not available in target version ${targetVersion} (added in ${prop.addedInVersion}) — skipped.`,
            autoFixed: false,
          });
          continue;
        }
        if (prop.removedInVersion && compareVersions(targetVersion, prop.removedInVersion) >= 0) {
          report.issues.push({
            severity: "info",
            code: "REQUIRED_PROPERTY_REMOVED",
            activityTemplate: node.template,
            activityDisplayName: node.displayName,
            property: prop.name,
            message: `Required property "${prop.name}" on ${node.template} was removed in version ${prop.removedInVersion} and target is ${targetVersion} — skipped.`,
            autoFixed: false,
          });
          continue;
        }
      }

      const defaultValue = prop.default || (prop.validValues && prop.validValues.length > 0 ? prop.validValues[0] : getDefaultForType(prop.clrType));
      filteredProperties[prop.name] = defaultValue;
      report.missingRequiredFilled++;
      report.issues.push({
        severity: "warning",
        code: "MISSING_REQUIRED_FILLED",
        activityTemplate: node.template,
        activityDisplayName: node.displayName,
        property: prop.name,
        message: `Missing required property "${prop.name}" on ${node.template} — filled with default: "${defaultValue}".`,
        autoFixed: true,
      });
      console.log(`[SpecValidator] Filled missing required ${node.template}."${prop.name}" with default: "${defaultValue}"`);
    }
  }

  const hasUnresolvedErrors = report.issues.slice(issueCountAtStart).some(
    i => i.severity === "error" && !i.autoFixed
  );
  if (!hasUnresolvedErrors) {
    report.validActivities++;
  }
  return { ...node, properties: filteredProperties };
}

function validateNode(
  node: WorkflowNode,
  report: SpecValidationReport,
  studioProfile: StudioProfile | null,
): WorkflowNode {
  if (node.kind === "activity") {
    return validateActivityNode(node, report, studioProfile);
  }

  if (node.kind === "sequence" && node.children) {
    return { ...node, children: node.children.map(c => validateNode(c, report, studioProfile)) };
  }
  if (node.kind === "tryCatch") {
    return {
      ...node,
      tryChildren: (node.tryChildren || []).map(c => validateNode(c, report, studioProfile)),
      catchChildren: (node.catchChildren || []).map(c => validateNode(c, report, studioProfile)),
      finallyChildren: (node.finallyChildren || []).map(c => validateNode(c, report, studioProfile)),
    };
  }
  if (node.kind === "if") {
    return {
      ...node,
      thenChildren: (node.thenChildren || []).map(c => validateNode(c, report, studioProfile)),
      elseChildren: (node.elseChildren || []).map(c => validateNode(c, report, studioProfile)),
    };
  }
  if (node.kind === "while" || node.kind === "forEach" || node.kind === "retryScope") {
    return { ...node, bodyChildren: (node.bodyChildren || []).map(c => validateNode(c, report, studioProfile)) };
  }

  return node;
}

export function validateWorkflowSpec(
  spec: WorkflowSpec,
  studioProfile?: StudioProfile | null,
): { spec: WorkflowSpec; report: SpecValidationReport } {
  if (!catalogService.isLoaded()) {
    return { spec, report: createEmptyReport() };
  }

  const report = createEmptyReport();
  const effectiveProfile = studioProfile ?? catalogService.getStudioProfile();

  const validatedChildren = spec.rootSequence.children.map(
    child => validateNode(child, report, effectiveProfile),
  );

  const validatedSpec: WorkflowSpec = {
    ...spec,
    rootSequence: {
      ...spec.rootSequence,
      children: validatedChildren,
    },
  };

  console.log(
    `[SpecValidator] Validation complete: ${report.totalActivities} activities, ` +
    `${report.validActivities} valid, ${report.unknownActivities} unknown→comment, ` +
    `${report.strippedProperties} props stripped, ${report.enumCorrections} enum corrections, ` +
    `${report.missingRequiredFilled} required filled, ${report.issues.length} issues total`
  );

  return { spec: validatedSpec, report };
}

export function formatValidationReportForDhg(report: SpecValidationReport): string {
  if (report.issues.length === 0 && report.totalActivities === 0) {
    return "";
  }

  let md = `### Pre-emission Spec Validation Summary\n\n`;
  md += `| Metric | Count |\n|---|---|\n`;
  md += `| Total activities checked | ${report.totalActivities} |\n`;
  md += `| Valid activities | ${report.validActivities} |\n`;
  md += `| Unknown → Comment stubs | ${report.unknownActivities} |\n`;
  md += `| Non-catalog properties stripped | ${report.strippedProperties} |\n`;
  md += `| Enum values auto-corrected | ${report.enumCorrections} |\n`;
  md += `| Missing required props filled | ${report.missingRequiredFilled} |\n\n`;

  const errors = report.issues.filter(i => i.severity === "error");
  const warnings = report.issues.filter(i => i.severity === "warning");
  const infos = report.issues.filter(i => i.severity === "info");

  if (errors.length > 0) {
    md += `**Errors (${errors.length}):**\n`;
    for (const e of errors) {
      md += `- \`${e.activityTemplate}\`: ${e.message}${e.autoFixed ? " *(auto-fixed)*" : ""}\n`;
    }
    md += `\n`;
  }

  if (warnings.length > 0) {
    md += `**Warnings (${warnings.length}):**\n`;
    for (const w of warnings) {
      md += `- \`${w.activityTemplate}\`: ${w.message}\n`;
    }
    md += `\n`;
  }

  if (infos.length > 0) {
    md += `**Info (${infos.length}):**\n`;
    for (const i of infos) {
      md += `- \`${i.activityTemplate}\`: ${i.message}\n`;
    }
    md += `\n`;
  }

  return md;
}
