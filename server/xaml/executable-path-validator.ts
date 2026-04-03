import { ACTIVITY_REGISTRY, DESIGNER_PROPERTIES } from "../uipath-activity-registry";
import { lintExpression } from "./vbnet-expression-linter";

export type DefectType =
  | "placeholder"
  | "todo_marker"
  | "leaked_json_expression"
  | "blank_required_property"
  | "malformed_vb_expression"
  | "sentinel_value";

export type DefectSeverity = "execution_blocking" | "handoff_required";

export interface ExecutablePathDefect {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  defectType: DefectType;
  offendingValue: string;
  severity: DefectSeverity;
  detectionMethod: string;
}

export interface ExecutablePathValidationResult {
  executablePathDefects: ExecutablePathDefect[];
  hasExecutablePathContamination: boolean;
}

const HIGH_RISK_REQUIRED_OVERRIDES: Record<string, string[]> = {
  "Assign": ["To", "Value"],
  "If": ["Condition"],
  "ui:InvokeWorkflowFile": ["WorkflowFileName"],
  "InvokeWorkflowFile": ["WorkflowFileName"],
  "ui:SendSmtpMailMessage": ["To", "Subject", "Body", "Host", "Port"],
  "SendSmtpMailMessage": ["To", "Subject", "Body", "Host", "Port"],
  "ui:AddQueueItem": ["QueueName", "ItemInformation"],
  "AddQueueItem": ["QueueName", "ItemInformation"],
  "ui:CreateFormTask": ["Title", "FormData", "TaskCatalog", "TaskTitle", "TaskData"],
  "CreateFormTask": ["Title", "FormData", "TaskCatalog", "TaskTitle", "TaskData"],
};

const PLACEHOLDER_PATTERN = /\bPLACEHOLDER\b|\bPLACEHOLDER_\w+/i;
const TODO_PATTERN = /\bTODO:\s*implement\s+this\s+expression\b|\bTODO\b/i;
const SENTINEL_PATTERN = /\bHANDOFF_\w+|\bSTUB_\w+|\bASSEMBLY_FAILED\w*/;

const DESIGN_TIME_ELEMENTS = new Set([
  "TextExpression.NamespacesForImplementation",
  "TextExpression.ReferencesForImplementation",
  "Sequence.Variables",
  "Flowchart.Variables",
  "Activity.Variables",
]);

const LAYOUT_METADATA_PATTERNS = [
  /sap:VirtualizedContainerService/,
  /sap2010:WorkflowViewState/,
  /WorkflowViewState\./,
  /Annotation\.AnnotationText/,
];

function isDesignerProperty(propName: string): boolean {
  if (DESIGNER_PROPERTIES.has(propName)) return true;
  if (propName === "DisplayName") return true;
  for (const pattern of LAYOUT_METADATA_PATTERNS) {
    if (pattern.test(propName)) return true;
  }
  return false;
}

function deriveWorkflowName(fileName: string): string {
  const base = fileName.split("/").pop() || fileName;
  return base.replace(/\.xaml$/i, "");
}

function getRegistryEntry(activityType: string): { required: string[]; optional: string[] } | null {
  const normalizedType = activityType.replace(/^.*:/, "");

  const entry = ACTIVITY_REGISTRY[activityType];
  if (entry) {
    return {
      required: entry.properties?.required || [],
      optional: entry.properties?.optional || [],
    };
  }

  const prefixed = activityType.startsWith("ui:") ? activityType : `ui:${normalizedType}`;
  const prefixedEntry = ACTIVITY_REGISTRY[prefixed];
  if (prefixedEntry) {
    return {
      required: prefixedEntry.properties?.required || [],
      optional: prefixedEntry.properties?.optional || [],
    };
  }

  return null;
}

function getHighRiskProps(activityType: string): string[] {
  const normalizedType = activityType.replace(/^.*:/, "");
  for (const [key, props] of Object.entries(HIGH_RISK_REQUIRED_OVERRIDES)) {
    const keyBase = key.replace(/^.*:/, "");
    if (keyBase === normalizedType || key === activityType) {
      return props;
    }
  }
  return [];
}

type PropertyCriticality = "required" | "optional" | "non_executable";

function classifyProperty(activityType: string, propertyName: string, isArgumentSlot: boolean): PropertyCriticality {
  if (isDesignerProperty(propertyName)) return "non_executable";

  const highRiskProps = getHighRiskProps(activityType);
  if (highRiskProps.includes(propertyName)) return "required";

  const registry = getRegistryEntry(activityType);
  if (registry) {
    if (registry.required.includes(propertyName)) return "required";
    if (registry.optional.includes(propertyName)) return "optional";
  }

  if (isArgumentSlot) return "optional";

  return "non_executable";
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
}

function detectLeakedJsonExpression(value: string): boolean {
  const decoded = decodeXmlEntities(value).trim();
  const trimmed = decoded;
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      const schemaKeys = ["type", "value", "kind", "expression", "schema"];
      const matchCount = keys.filter(k => schemaKeys.includes(k.toLowerCase())).length;
      return matchCount >= 2;
    }
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
      const keys = Object.keys(parsed[0]);
      const schemaKeys = ["type", "value", "kind", "expression", "schema"];
      const matchCount = keys.filter(k => schemaKeys.includes(k.toLowerCase())).length;
      return matchCount >= 2;
    }
  } catch {
    return false;
  }
  return false;
}

function isVbExpression(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return true;
  return false;
}

const ADVISORY_LINT_CODES = new Set([
  "COMPLEX_EXPRESSION_PASSTHROUGH",
  "BARE_WORD_REFERENCE",
]);

function checkMalformedVbExpression(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (!isVbExpression(trimmed)) return false;
  if (PLACEHOLDER_PATTERN.test(trimmed)) return false;
  if (TODO_PATTERN.test(trimmed)) return false;
  if (SENTINEL_PATTERN.test(trimmed)) return false;

  const expression = trimmed.slice(1, -1);

  if (!expression || expression.length < 2) return false;

  const result = lintExpression(expression);
  const hasSyntaxFailure = result.issues.some(
    i => !i.autoFixed && !ADVISORY_LINT_CODES.has(i.code)
  );
  return hasSyntaxFailure;
}

interface PropertyMatch {
  activityType: string;
  propertyName: string;
  value: string;
  isArgumentSlot: boolean;
}

function extractActivityProperties(xmlContent: string): PropertyMatch[] {
  const results: PropertyMatch[] = [];

  const commentPattern = /<!--[\s\S]*?-->/g;
  const cleaned = xmlContent.replace(commentPattern, "");

  const viewStatePattern = /<sap:WorkflowViewStateService\.ViewState[\s\S]*?<\/sap:WorkflowViewStateService\.ViewState>/gi;
  const withoutViewState = cleaned.replace(viewStatePattern, "");

  const viewStatePattern2 = /<sap2010:WorkflowViewState[\s\S]*?<\/sap2010:WorkflowViewState>/gi;
  const content = withoutViewState.replace(viewStatePattern2, "");

  const tagPattern = /<(\w+(?::\w+)?)\s([^>]*?)(?:\/>|>)/g;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(content)) !== null) {
    const activityType = tagMatch[1];

    if (DESIGN_TIME_ELEMENTS.has(activityType)) continue;
    if (activityType.startsWith("x:") || activityType.startsWith("mc:")) continue;
    if (activityType === "sco:Collection" || activityType === "x:String" ||
        activityType === "AssemblyReference" || activityType === "s:String") continue;
    if (activityType === "Activity" || activityType === "Sequence.Variables" ||
        activityType === "Variable" || activityType === "Flowchart.Variables") continue;

    const attrs = tagMatch[2];
    const attrPattern = /(\w+(?:\.\w+)?(?::\w+(?:\.\w+)?)?)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      const propName = attrMatch[1];
      const propValue = attrMatch[2];

      if (isDesignerProperty(propName)) continue;
      if (propName.startsWith("xmlns") || propName.startsWith("x:") ||
          propName.startsWith("mc:") || propName === "x:Class" ||
          propName === "x:TypeArguments" || propName === "x:Key") continue;

      results.push({
        activityType,
        propertyName: propName,
        value: propValue,
        isArgumentSlot: false,
      });
    }
  }

  const propElementPattern = /<(\w+(?::\w+)?)\.(\w+)>\s*<(?:InArgument|OutArgument|InOutArgument)\b[^>]*>\s*([^<]*?)\s*<\/(?:InArgument|OutArgument|InOutArgument)>/g;
  let propElemMatch;
  while ((propElemMatch = propElementPattern.exec(content)) !== null) {
    const activityType = propElemMatch[1];
    const propertyName = propElemMatch[2];
    const value = propElemMatch[3].trim();

    if (isDesignerProperty(propertyName)) continue;

    results.push({
      activityType,
      propertyName,
      value,
      isArgumentSlot: true,
    });
  }

  const standaloneArgPattern = /<(InArgument|OutArgument|InOutArgument)\b[^>]*>\s*([^<]*?)\s*<\/\1>/g;
  let standaloneMatch;
  while ((standaloneMatch = standaloneArgPattern.exec(content)) !== null) {
    const value = standaloneMatch[2].trim();
    if (!value) continue;

    const alreadyCaptured = results.some(r => r.value === value);
    if (alreadyCaptured) continue;

    const contextBefore = content.substring(Math.max(0, standaloneMatch.index - 500), standaloneMatch.index);
    const parentPropPattern = /<(\w+(?::\w+)?)\.(\w+)>\s*$/;
    const parentMatch = contextBefore.match(parentPropPattern);

    if (parentMatch) {
      results.push({
        activityType: parentMatch[1],
        propertyName: parentMatch[2],
        value,
        isArgumentSlot: true,
      });
    } else {
      const activityMatch = contextBefore.match(/<(\w+(?::\w+)?)\s[^>]*$/);
      results.push({
        activityType: activityMatch ? activityMatch[1] : "Unknown",
        propertyName: standaloneMatch[1],
        value,
        isArgumentSlot: true,
      });
    }
  }

  return results;
}

function checkPropertyForDefects(
  file: string,
  workflow: string,
  activityType: string,
  propertyName: string,
  value: string,
  isArgumentSlot: boolean,
): ExecutablePathDefect[] {
  const defects: ExecutablePathDefect[] = [];

  const criticality = classifyProperty(activityType, propertyName, isArgumentSlot);
  if (criticality === "non_executable") return defects;

  const severity: DefectSeverity = criticality === "required" ? "execution_blocking" : "handoff_required";

  if (PLACEHOLDER_PATTERN.test(value)) {
    defects.push({
      file, workflow, activityType, propertyName,
      defectType: "placeholder",
      offendingValue: value.substring(0, 200),
      severity,
      detectionMethod: "regex_pattern",
    });
    return defects;
  }

  if (TODO_PATTERN.test(value)) {
    defects.push({
      file, workflow, activityType, propertyName,
      defectType: "todo_marker",
      offendingValue: value.substring(0, 200),
      severity,
      detectionMethod: "regex_pattern",
    });
    return defects;
  }

  if (SENTINEL_PATTERN.test(value)) {
    defects.push({
      file, workflow, activityType, propertyName,
      defectType: "sentinel_value",
      offendingValue: value.substring(0, 200),
      severity,
      detectionMethod: "regex_pattern",
    });
    return defects;
  }

  if (detectLeakedJsonExpression(value)) {
    defects.push({
      file, workflow, activityType, propertyName,
      defectType: "leaked_json_expression",
      offendingValue: value.substring(0, 200),
      severity,
      detectionMethod: "json_structure_analysis",
    });
    return defects;
  }

  if (value.trim() === "" && criticality === "required") {
    defects.push({
      file, workflow, activityType, propertyName,
      defectType: "blank_required_property",
      offendingValue: "",
      severity: "execution_blocking",
      detectionMethod: "registry_required_blank",
    });
    return defects;
  }

  if (value.trim().length > 0 && checkMalformedVbExpression(value)) {
    defects.push({
      file, workflow, activityType, propertyName,
      defectType: "malformed_vb_expression",
      offendingValue: value.substring(0, 200),
      severity,
      detectionMethod: "vb_linter",
    });
  }

  return defects;
}

export function validateExecutablePaths(
  xamlEntries: { name: string; content: string }[],
): ExecutablePathValidationResult {
  const allDefects: ExecutablePathDefect[] = [];

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const workflow = deriveWorkflowName(shortName);
    const properties = extractActivityProperties(entry.content);

    for (const prop of properties) {
      const defects = checkPropertyForDefects(
        shortName,
        workflow,
        prop.activityType,
        prop.propertyName,
        prop.value,
        prop.isArgumentSlot,
      );
      allDefects.push(...defects);
    }
  }

  return {
    executablePathDefects: allDefects,
    hasExecutablePathContamination: allDefects.length > 0,
  };
}
