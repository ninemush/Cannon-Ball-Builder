import { catalogService, type CatalogProperty } from "./catalog-service";
import type { StudioProfile } from "./metadata-service";
import { metadataService } from "./metadata-service";
import type { WorkflowSpec, WorkflowNode, ActivityNode, VariableDeclaration, ForEachNode } from "../workflow-spec-types";
import { sanitizeVariableName, isUnsafeVariableName } from "../workflow-tree-assembler";

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
  excessiveStrippingCount: number;
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
    excessiveStrippingCount: 0,
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

  const EXCESSIVE_STRIP_THRESHOLD = 5;
  if (strippedNames.length > 0) {
    const isExcessive = strippedNames.length >= EXCESSIVE_STRIP_THRESHOLD;
    const knownPropCount = knownProps.size + INHERITED_BASE_PROPERTIES.size;
    const strippedRatio = knownPropCount > 0 ? strippedNames.length / (knownPropCount + strippedNames.length) : 0;
    const isStructuralBreak = strippedRatio > 0.5 || !schema.activity;
    if (isExcessive && isStructuralBreak) {
      report.excessiveStrippingCount++;
      report.commentConversions++;
      const stubMessage = `Hallucinated activity: ${node.template} "${node.displayName}" had ${Math.round(strippedRatio * 100)}% properties stripped (${strippedNames.length}/${strippedNames.length + knownPropCount}). Converted to Comment stub. Original properties: ${strippedNames.join(", ")}`;
      report.issues.push({
        severity: "error",
        code: "EXCESSIVE_PROPERTIES_STRIPPED",
        activityTemplate: node.template,
        activityDisplayName: node.displayName,
        message: stubMessage,
        autoFixed: true,
      });
      console.log(`[SpecValidator] HALLUCINATION RECOVERY: ${stubMessage}`);
      return {
        kind: "activity",
        template: "Comment",
        displayName: `${node.displayName} (hallucinated — stub)`,
        properties: {
          Text: `Hallucinated activity: ${node.template}. Original display name: "${node.displayName}". ${Math.round(strippedRatio * 100)}% of properties were non-catalog (${strippedNames.join(", ")}). Manual implementation required with correct activity type.`,
        },
        outputVar: null,
        outputType: null,
        errorHandling: "none",
      };
    }
    const violationClass = isStructuralBreak ? "structural-break" : "property-noise";
    report.issues.push({
      severity: "warning",
      code: isExcessive ? "EXCESSIVE_PROPERTIES_STRIPPED" : "UNKNOWN_PROPERTIES_STRIPPED",
      activityTemplate: node.template,
      activityDisplayName: node.displayName,
      message: isExcessive
        ? `Stripped ${strippedNames.length} non-catalog properties from ${node.template} "${node.displayName}" (threshold: ${EXCESSIVE_STRIP_THRESHOLD}, class: ${violationClass}): ${strippedNames.join(", ")}${isStructuralBreak ? " — structural break" : " — property-noise, non-blocking"}`
        : `Stripped ${strippedNames.length} non-catalog property(ies) from ${node.template} "${node.displayName}": ${strippedNames.join(", ")}`,
      autoFixed: true,
    });
    console.log(`[SpecValidator] ${isExcessive ? "EXCESSIVE stripping" : "Stripped properties"} from ${node.template} "${node.displayName}": ${strippedNames.join(", ")} (class: ${violationClass})`);
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

function sanitizeVariableDeclarationsInSpec(
  variables: VariableDeclaration[],
  renameMap: Map<string, string>,
  report: SpecValidationReport,
): VariableDeclaration[] {
  const seen = new Set<string>();
  return variables.map(v => {
    const reason = isUnsafeVariableName(v.name);
    if (!reason) {
      seen.add(v.name);
      return v;
    }
    let safeName = sanitizeVariableName(v.name);
    let counter = 2;
    while (seen.has(safeName)) {
      safeName = `${sanitizeVariableName(v.name)}_${counter}`;
      counter++;
    }
    seen.add(safeName);
    renameMap.set(v.name, safeName);
    report.issues.push({
      severity: "warning",
      code: "UNSAFE_VARIABLE_NAME",
      activityTemplate: "Variable",
      activityDisplayName: v.name,
      message: `Variable "${v.name}" ${reason} — auto-repaired to "${safeName}"`,
      autoFixed: true,
    });
    console.log(`[SpecValidator] Auto-repaired variable name "${v.name}" → "${safeName}" (${reason})`);
    return { ...v, name: safeName };
  });
}

function replaceVarRefsInString(str: string, renameMap: Map<string, string>): string {
  let result = str;
  renameMap.forEach((newName, oldName) => {
    if (oldName === newName) return;
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "g"), newName);
  });
  return result;
}

function replaceVarRefsInValueIntent(intent: any, renameMap: Map<string, string>): any {
  if (!intent || typeof intent !== "object") return intent;
  if (intent.type === "variable" && typeof intent.name === "string") {
    const newName = renameMap.get(intent.name);
    if (newName) return { ...intent, name: newName };
    return intent;
  }
  if (intent.type === "expression") {
    let updated = { ...intent };
    if (typeof intent.left === "string") updated.left = replaceVarRefsInString(intent.left, renameMap);
    if (typeof intent.right === "string") updated.right = replaceVarRefsInString(intent.right, renameMap);
    return updated;
  }
  if (intent.type === "url_with_params" && typeof intent.baseUrl === "string") {
    return { ...intent, baseUrl: replaceVarRefsInString(intent.baseUrl, renameMap) };
  }
  return intent;
}

function replaceVarRefsInPropertyValue(value: any, renameMap: Map<string, string>): any {
  if (typeof value === "string") return replaceVarRefsInString(value, renameMap);
  if (typeof value === "object" && value !== null && "type" in value) {
    return replaceVarRefsInValueIntent(value, renameMap);
  }
  return value;
}

function replaceVarRefsInCondition(condition: string | any, renameMap: Map<string, string>): string | any {
  if (typeof condition === "string") return replaceVarRefsInString(condition, renameMap);
  return replaceVarRefsInValueIntent(condition, renameMap);
}

function sanitizeVarRefsInNode(node: WorkflowNode, renameMap: Map<string, string>, report: SpecValidationReport): WorkflowNode {
  if (renameMap.size === 0) return node;

  if (node.kind === "activity") {
    const newProps: Record<string, any> = {};
    for (const [k, v] of Object.entries(node.properties)) {
      newProps[k] = replaceVarRefsInPropertyValue(v, renameMap);
    }
    const newOutputVar = node.outputVar ? replaceVarRefsInString(node.outputVar, renameMap) : node.outputVar;
    return { ...node, properties: newProps, outputVar: newOutputVar };
  }

  if (node.kind === "sequence") {
    const localVars = node.variables
      ? sanitizeVariableDeclarationsInSpec(node.variables, renameMap, report)
      : node.variables;
    return {
      ...node,
      variables: localVars,
      children: node.children.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
    };
  }

  if (node.kind === "tryCatch") {
    return {
      ...node,
      tryChildren: node.tryChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
      catchChildren: node.catchChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
      finallyChildren: node.finallyChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
    };
  }

  if (node.kind === "if") {
    return {
      ...node,
      condition: replaceVarRefsInCondition(node.condition, renameMap),
      thenChildren: node.thenChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
      elseChildren: node.elseChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
    };
  }

  if (node.kind === "while") {
    return {
      ...node,
      condition: replaceVarRefsInCondition(node.condition, renameMap),
      bodyChildren: node.bodyChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
    };
  }

  if (node.kind === "forEach") {
    return {
      ...node,
      valuesExpression: replaceVarRefsInString(node.valuesExpression, renameMap),
      iteratorName: sanitizeVariableName(node.iteratorName || "item"),
      bodyChildren: node.bodyChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
    };
  }

  if (node.kind === "retryScope") {
    return {
      ...node,
      bodyChildren: node.bodyChildren.map(c => sanitizeVarRefsInNode(c, renameMap, report)),
    };
  }

  return node;
}

const SPEC_TYPE_TO_XAML: Record<string, string> = {
  "String": "x:String",
  "string": "x:String",
  "Int32": "x:Int32",
  "int32": "x:Int32",
  "Integer": "x:Int32",
  "integer": "x:Int32",
  "Int64": "x:Int64",
  "int64": "x:Int64",
  "Boolean": "x:Boolean",
  "boolean": "x:Boolean",
  "Double": "x:Double",
  "double": "x:Double",
  "Decimal": "x:Decimal",
  "decimal": "x:Decimal",
  "Object": "x:Object",
  "object": "x:Object",
  "DataRow": "scg2:DataRow",
  "datarow": "scg2:DataRow",
  "DataTable": "scg2:DataTable",
  "datatable": "scg2:DataTable",
  "DateTime": "s:DateTime",
  "datetime": "s:DateTime",
  "TimeSpan": "s:TimeSpan",
  "timespan": "s:TimeSpan",
};

function toXamlType(rawType: string): string {
  if (SPEC_TYPE_TO_XAML[rawType]) return SPEC_TYPE_TO_XAML[rawType];
  if (rawType.includes(":")) return rawType;
  return SPEC_TYPE_TO_XAML[rawType.toLowerCase()] || rawType;
}

function inferCorrectForEachItemType(node: ForEachNode, allVariables: VariableDeclaration[]): string | null {
  const expr = node.valuesExpression.trim().replace(/^\[|\]$/g, "");
  if (/\.Rows$/i.test(expr) || /\.AsEnumerable\(\)$/i.test(expr)) {
    return "scg2:DataRow";
  }
  const simpleVar = expr.match(/^(\w+)$/);
  if (simpleVar) {
    const decl = allVariables.find(v => v.name === simpleVar[1]);
    if (decl) {
      const lower = decl.type.toLowerCase();
      if (lower.includes("datatable")) return "scg2:DataRow";
      const listMatch = decl.type.match(/List\s*\(\s*Of\s+(\w+)\s*\)/i) || decl.type.match(/List<([^>]+)>/i);
      if (listMatch) return toXamlType(listMatch[1].trim());
      const arrayMatch = decl.type.match(/Array\s*\(\s*Of\s+(\w+)\s*\)/i) || decl.type.match(/(\w+)\[\]/);
      if (arrayMatch) return toXamlType(arrayMatch[1].trim());
      const dictMatch = decl.type.match(/Dictionary\s*\(\s*Of\s+(\w+)\s*,\s*(\w+)\s*\)/i) || decl.type.match(/Dictionary<([^,]+),\s*([^>]+)>/i);
      if (dictMatch) return `scg:KeyValuePair(${toXamlType(dictMatch[1].trim())}, ${toXamlType(dictMatch[2].trim())})`;
    }
  }
  return null;
}

function correctForEachTypesInNode(node: WorkflowNode, allVariables: VariableDeclaration[], report: SpecValidationReport): WorkflowNode {
  if (node.kind === "forEach") {
    const inferred = inferCorrectForEachItemType(node, allVariables);
    let correctedNode = node;
    if (inferred && node.itemType !== inferred) {
      report.issues.push({
        severity: "info",
        code: "FOREACH_TYPE_INFERRED",
        activityTemplate: "ForEach",
        activityDisplayName: node.displayName,
        message: `ForEach itemType corrected from "${node.itemType}" to "${inferred}" based on valuesExpression "${node.valuesExpression}"`,
        autoFixed: true,
      });
      correctedNode = { ...node, itemType: inferred };
    }

    const expr = node.valuesExpression.trim().replace(/^\[|\]$/g, "");
    const rowsMatch = expr.match(/^(\w+)\.Rows$/i) || expr.match(/^(\w+)\.AsEnumerable\(\)$/i);
    if (rowsMatch) {
      const varName = rowsMatch[1];
      const decl = allVariables.find(v => v.name === varName);
      if (decl && !decl.type.toLowerCase().includes("datatable")) {
        report.issues.push({
          severity: "warning",
          code: "VARIABLE_TYPE_MISMATCH",
          activityTemplate: "Variable",
          activityDisplayName: varName,
          message: `Variable "${varName}" typed as "${decl.type}" but expression "${node.valuesExpression}" accesses DataTable members — corrected to DataTable`,
          autoFixed: true,
        });
        decl.type = "DataTable";
      }
    }

    return {
      ...correctedNode,
      bodyChildren: correctedNode.bodyChildren.map(c => correctForEachTypesInNode(c, allVariables, report)),
    };
  }

  if (node.kind === "sequence") {
    const localVars = [...allVariables, ...(node.variables || [])];
    return {
      ...node,
      children: node.children.map(c => correctForEachTypesInNode(c, localVars, report)),
    };
  }

  if (node.kind === "tryCatch") {
    return {
      ...node,
      tryChildren: node.tryChildren.map(c => correctForEachTypesInNode(c, allVariables, report)),
      catchChildren: node.catchChildren.map(c => correctForEachTypesInNode(c, allVariables, report)),
      finallyChildren: node.finallyChildren.map(c => correctForEachTypesInNode(c, allVariables, report)),
    };
  }

  if (node.kind === "if") {
    return {
      ...node,
      thenChildren: node.thenChildren.map(c => correctForEachTypesInNode(c, allVariables, report)),
      elseChildren: node.elseChildren.map(c => correctForEachTypesInNode(c, allVariables, report)),
    };
  }

  if (node.kind === "while" || node.kind === "retryScope") {
    return { ...node, bodyChildren: node.bodyChildren.map(c => correctForEachTypesInNode(c, allVariables, report)) };
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

  const renameMap = new Map<string, string>();
  const sanitizedTopVars = sanitizeVariableDeclarationsInSpec(spec.variables || [], renameMap, report);
  const sanitizedRootVars = spec.rootSequence.variables
    ? sanitizeVariableDeclarationsInSpec(spec.rootSequence.variables, renameMap, report)
    : spec.rootSequence.variables;

  let sanitizedChildren = spec.rootSequence.children.map(
    child => sanitizeVarRefsInNode(child, renameMap, report),
  );

  const allVarsForTypeCheck: VariableDeclaration[] = [
    ...sanitizedTopVars,
    ...(sanitizedRootVars || []),
  ];
  sanitizedChildren = sanitizedChildren.map(
    child => correctForEachTypesInNode(child, allVarsForTypeCheck, report),
  );

  const validatedChildren = sanitizedChildren.map(
    child => validateNode(child, report, effectiveProfile),
  );

  const validatedSpec: WorkflowSpec = {
    ...spec,
    variables: sanitizedTopVars,
    rootSequence: {
      ...spec.rootSequence,
      variables: sanitizedRootVars,
      children: validatedChildren,
    },
  };

  console.log(
    `[SpecValidator] Validation complete: ${report.totalActivities} activities, ` +
    `${report.validActivities} valid, ${report.unknownActivities} unknown→comment, ` +
    `${report.strippedProperties} props stripped (${report.excessiveStrippingCount} excessive), ${report.enumCorrections} enum corrections, ` +
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
  md += `| Activities with excessive stripping | ${report.excessiveStrippingCount} |\n`;
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
