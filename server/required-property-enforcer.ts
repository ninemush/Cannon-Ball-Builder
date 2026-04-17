import { catalogService, type CatalogProperty, type ActivitySchema } from "./catalog/catalog-service";
import { isPropertyOverriddenOptional } from "./uipath-activity-registry";
import { tryParseJsonValueIntent, buildExpression, type ValueIntent, recordExpressionLoweringDiagnostic } from "./xaml/expression-builder";
import { classifyDefectOrigin } from "./lib/placeholder-sanitizer";
import { XMLValidator } from "fast-xml-parser";

export type SourceKind =
  | "workflowArgument"
  | "variable"
  | "invokeOutput"
  | "priorStepOutput"
  | "contractMapping"
  | "contract-default"
  | "context-derived"
  | "attribute-value";

export type PrecedenceTier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const PRECEDENCE_TIER_LABELS: Record<PrecedenceTier, string> = {
  1: "workflowArgument",
  2: "variable",
  3: "invokeOutput / priorStepOutput",
  4: "contractMapping",
  5: "(reserved — activity-family rules deferred to future iteration)",
  6: "contract-default",
  7: "context-derived-fallback",
};

export interface ResolvedSourceProvenance {
  sourceKind: SourceKind;
  sourceName: string;
  sourceWorkflow?: string;
  sourceStep?: string;
  precedenceTier: PrecedenceTier;
}

export interface RejectedCandidateRecord {
  sourceKind: SourceKind;
  sourceName: string;
  sourceWorkflow?: string;
  sourceStep?: string;
  precedenceTier: PrecedenceTier;
  rejectionReason: "typeIncompatible" | "slotIncompatible" | "ambiguousPrecedence" | "lowerPrecedence";
}

export interface InvalidRequiredPropertySubstitution {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  attemptedValue: string;
  reasonRejected: string;
  expectedSourceKinds: SourceKind[];
  packageModeOutcome: "blocked";
}

export interface RequiredPropertyBinding {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  sourceBinding: string;
  originalValue: string;
  resolvedValue: string;
  severity: "info";
  packageModeOutcome: "bound";
  occurrenceIndex: number;
  provenance?: ResolvedSourceProvenance;
  rejectedCandidates?: RejectedCandidateRecord[];
}

export interface UnresolvedRequiredPropertyDefect {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  failureReason: string;
  originalValue: string;
  severity: "execution_blocking" | "handoff_required";
  packageModeOutcome: "structured_defect" | "degraded";
  rejectedCandidates?: RejectedCandidateRecord[];
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export interface ExpressionLoweringFix {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  originalValue: string;
  resolvedValue: string;
  severity: "info";
  packageModeOutcome: "lowered";
  occurrenceIndex: number;
}

export interface ExpressionLoweringFailure {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  originalValue: string;
  failureReason: string;
  severity: "execution_blocking" | "handoff_required";
  packageModeOutcome: "structured_defect";
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export type FallbackDecision = "source-bound" | "expression-lowered" | "fallback-applied" | "context-derived-fallback" | "blocked";

export interface FallbackResolutionDiagnostic {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  propertyClass: string;
  decision: FallbackDecision;
  sourceFound: boolean;
  expressionLowered: boolean | null;
  fallbackApplied: boolean;
  blockReason: string | null;
  originalValue: string;
  resolvedValue: string | null;
}

export interface FallbackEligiblePolicy {
  activityType: string;
  propertyName: string;
  propertyClass: string;
  fallbackAllowed: boolean;
  fallbackValue: string | null;
  requireExpressionLowering: boolean;
  blockOnGenericDefault: boolean;
  genericDefaultValues: string[];
  contextDerivedFallbackAllowed?: boolean;
}

export interface ContextDerivedFallbackSpec {
  activityType: string;
  propertyName: string;
  propertyClass: string;
  deriveExpression: (context: ContextDerivedFallbackContext) => string | null;
}

export interface ContextDerivedFallbackContext {
  displayName: string | null;
  fileName: string;
  workflowName: string;
  activityType: string;
  propertyName: string;
}

function xmlEscapeForAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function vbEscapeString(value: string): string {
  return value.replace(/"/g, '""');
}

export const CONTEXT_DERIVED_FALLBACK_REGISTRY: ContextDerivedFallbackSpec[] = [
  {
    activityType: "LogMessage",
    propertyName: "Message",
    propertyClass: "LogMessage.Message",
    deriveExpression: (ctx) => {
      const label = ctx.displayName && ctx.displayName.trim().length > 0
        ? ctx.displayName.trim()
        : ctx.workflowName || "Activity";
      const vbSafe = vbEscapeString(label);
      const xmlSafe = xmlEscapeForAttribute(`"[Auto-generated] Log: ${vbSafe}"`);
      return `[${xmlSafe}]`;
    },
  },
  {
    activityType: "InvokeWorkflowFile",
    propertyName: "WorkflowFileName",
    propertyClass: "InvokeWorkflowFile.WorkflowFileName",
    deriveExpression: (ctx) => {
      const label = ctx.displayName && ctx.displayName.trim().length > 0
        ? ctx.displayName.trim()
        : null;
      if (label) {
        const hasXamlExt = /\.xaml$/i.test(label);
        const baseName = hasXamlExt ? label.replace(/\.xaml$/i, "") : label;
        const cleaned = baseName.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
        if (cleaned.length > 0) {
          return `AutoGenerated_Invoke_${cleaned}.xaml`;
        }
      }
      const workflowRef = ctx.workflowName
        ? ctx.workflowName.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "")
        : "Workflow";
      return `AutoGenerated_Invoke_${workflowRef}.xaml`;
    },
  },
];

export type RequiredPropertyClassification =
  | "safe-fallback"
  | "generator-owned"
  | "spec-required"
  | "unsupported";

export interface ClassificationEntry {
  activityType: string;
  propertyName: string;
  classification: RequiredPropertyClassification;
  approvedEnforcerRecovery: boolean;
  rationale: string;
}

export interface ClassificationDiagnostic {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  classification: RequiredPropertyClassification;
  approvedEnforcerRecovery: boolean;
  message: string;
  resolved: boolean;
  resolvedValue: string | null;
}

const REQUIRED_PROPERTY_CLASSIFICATION_REGISTRY: ClassificationEntry[] = [
  {
    activityType: "LogMessage",
    propertyName: "Message",
    classification: "generator-owned",
    approvedEnforcerRecovery: true,
    rationale: "Primary authority is the generator. Enforcer has proven context-derived recovery from displayName/workflowName.",
  },
  {
    activityType: "InvokeWorkflowFile",
    propertyName: "WorkflowFileName",
    classification: "generator-owned",
    approvedEnforcerRecovery: true,
    rationale: "Primary authority is spec invokes/executionOrder. Enforcer has proven context-derived recovery deriving .xaml filename.",
  },
  {
    activityType: "QueryEntity",
    propertyName: "EntityType",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Entity type is business-domain data from the SDD; cannot be generically defaulted.",
  },
  {
    activityType: "UpdateEntity",
    propertyName: "EntityType",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Entity type is business-domain data from the SDD; cannot be generically defaulted.",
  },
  {
    activityType: "CreateEntity",
    propertyName: "EntityType",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Entity type is business-domain data from the SDD; cannot be generically defaulted.",
  },
  {
    activityType: "CreateEntityRecord",
    propertyName: "EntityType",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Entity type is business-domain data from the SDD; cannot be generically defaulted. Alias for CreateEntity.",
  },
  {
    activityType: "DeleteEntity",
    propertyName: "EntityType",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Entity type is business-domain data from the SDD; cannot be generically defaulted.",
  },
  {
    activityType: "GetEntityById",
    propertyName: "EntityType",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Entity type is business-domain data from the SDD; cannot be generically defaulted.",
  },
  {
    activityType: "CreateFormTask",
    propertyName: "Title",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Task title is business-domain data; cannot be generically defaulted.",
  },
  {
    activityType: "CreateFormTask",
    propertyName: "TaskTitle",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Task title is business-domain data; cannot be generically defaulted.",
  },
  {
    activityType: "CreateFormTask",
    propertyName: "FormSchemaPath",
    classification: "spec-required",
    approvedEnforcerRecovery: false,
    rationale: "Schema path is a deployment-specific reference; cannot be generically defaulted.",
  },
  {
    activityType: "ReadTextFile",
    propertyName: "File",
    classification: "unsupported",
    approvedEnforcerRecovery: false,
    rationale: "No pipeline stage can currently produce a valid IResource-shaped file path for this property.",
  },
  {
    activityType: "SendSmtpMailMessage",
    propertyName: "Body",
    classification: "safe-fallback",
    approvedEnforcerRecovery: false,
    rationale: "A placeholder body is semantically acceptable as a stub that doesn't cause runtime errors.",
  },
  {
    activityType: "While",
    propertyName: "Condition",
    classification: "generator-owned",
    approvedEnforcerRecovery: false,
    rationale: "Conditions are expression-sensitive; the generator must emit a valid VB.NET expression.",
  },
  {
    activityType: "If",
    propertyName: "Condition",
    classification: "generator-owned",
    approvedEnforcerRecovery: false,
    rationale: "Conditions are expression-sensitive; the generator must emit a valid VB.NET expression.",
  },
  {
    activityType: "DoWhile",
    propertyName: "Condition",
    classification: "generator-owned",
    approvedEnforcerRecovery: false,
    rationale: "Conditions are expression-sensitive; the generator must emit a valid VB.NET expression.",
  },
  {
    activityType: "BuildDataTable",
    propertyName: "TableInfo",
    classification: "generator-owned",
    approvedEnforcerRecovery: false,
    rationale: "TableInfo is an XML-encoded DataTable schema structure that must be emitted by the deterministic generator. The enforcer cannot synthesize valid table schema.",
  },
];

const ACTIVITY_ALIASES: Record<string, string> = {
  "CreateEntityRecord": "CreateEntity",
};

export function getPropertyClassification(activityType: string, propertyName: string): ClassificationEntry | null {
  const direct = REQUIRED_PROPERTY_CLASSIFICATION_REGISTRY.find(
    e => e.activityType === activityType && e.propertyName === propertyName,
  );
  if (direct) return direct;

  const alias = ACTIVITY_ALIASES[activityType];
  if (alias) {
    const aliased = REQUIRED_PROPERTY_CLASSIFICATION_REGISTRY.find(
      e => e.activityType === alias && e.propertyName === propertyName,
    );
    if (aliased) return { ...aliased, activityType };
  }

  return null;
}

function buildClassificationDiagnosticMessage(
  activityType: string,
  propertyName: string,
  classification: RequiredPropertyClassification,
): string {
  switch (classification) {
    case "generator-owned":
      return `${activityType}.${propertyName} is generator-owned — the XAML generator or spec decomposer must emit this value. Found empty at enforcer stage.`;
    case "spec-required":
      return `${activityType}.${propertyName} is spec-required — this value must be provided by the business specification. Not found in spec output.`;
    case "unsupported":
      return `${activityType}.${propertyName} is classified as unsupported — the current pipeline cannot resolve this property. No automated recovery is available; manual intervention or pipeline extension is required.`;
    case "safe-fallback":
      return `${activityType}.${propertyName} is classified as safe-fallback — catalog-driven resolution will be attempted.`;
  }
}

const SAFE_FALLBACK_DETERMINISTIC_OVERRIDES: Record<string, string> = {
  "SendSmtpMailMessage.Body": "[Auto-generated] Email body — requires manual completion",
};

function resolveSafeFallbackFromCatalog(prop: CatalogProperty, activityType?: string): string | null {
  const overrideKey = activityType ? `${activityType}.${prop.name}` : null;
  if (overrideKey && SAFE_FALLBACK_DETERMINISTIC_OVERRIDES[overrideKey]) {
    return SAFE_FALLBACK_DETERMINISTIC_OVERRIDES[overrideKey];
  }

  if (prop.default !== undefined && prop.default !== null && prop.default !== "") {
    if (!isSentinelValue(prop.default) && !isGenericTypeDefault(prop.default, prop.clrType)) {
      return prop.default;
    }
  }

  if (prop.validValues && prop.validValues.length > 0) {
    const firstValid = prop.validValues[0];
    if (firstValid && firstValid.trim() !== "" && !isSentinelValue(firstValid) && !isGenericTypeDefault(firstValid, prop.clrType)) {
      return firstValid;
    }
  }

  if (prop.clrType) {
    if (prop.clrType.includes("String") || prop.clrType === "string") {
      return `[Auto-generated] ${prop.name} — requires manual completion`;
    }
    if (prop.clrType.includes("Boolean") || prop.clrType === "bool") {
      return "True";
    }
    if (prop.clrType.includes("Int") || prop.clrType === "int") {
      return "1";
    }
  }

  return null;
}

export const FALLBACK_ELIGIBLE_POLICIES: FallbackEligiblePolicy[] = [
  {
    activityType: "LogMessage",
    propertyName: "Message",
    propertyClass: "LogMessage.Message",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: false,
    blockOnGenericDefault: true,
    genericDefaultValues: ["", '""', "''"],
    contextDerivedFallbackAllowed: true,
  },
  {
    activityType: "InvokeWorkflowFile",
    propertyName: "WorkflowFileName",
    propertyClass: "InvokeWorkflowFile.WorkflowFileName",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: false,
    blockOnGenericDefault: true,
    genericDefaultValues: ["", '""', "''"],
    contextDerivedFallbackAllowed: true,
  },
  {
    activityType: "If",
    propertyName: "Condition",
    propertyClass: "If.Condition",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: true,
    blockOnGenericDefault: true,
    genericDefaultValues: ["False"],
  },
  {
    activityType: "While",
    propertyName: "Condition",
    propertyClass: "While.Condition",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: true,
    blockOnGenericDefault: true,
    genericDefaultValues: ["False"],
  },
  {
    activityType: "DoWhile",
    propertyName: "Condition",
    propertyClass: "DoWhile.Condition",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: true,
    blockOnGenericDefault: true,
    genericDefaultValues: ["False"],
  },
  {
    activityType: "QueryEntity",
    propertyName: "EntityType",
    propertyClass: "QueryEntity.EntityType",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: false,
    blockOnGenericDefault: true,
    genericDefaultValues: ["", '""', "''"],
  },
  {
    activityType: "UpdateEntity",
    propertyName: "EntityType",
    propertyClass: "UpdateEntity.EntityType",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: false,
    blockOnGenericDefault: true,
    genericDefaultValues: ["", '""', "''"],
  },
  {
    activityType: "CreateEntity",
    propertyName: "EntityType",
    propertyClass: "CreateEntity.EntityType",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: false,
    blockOnGenericDefault: true,
    genericDefaultValues: ["", '""', "''"],
  },
  {
    activityType: "DeleteEntity",
    propertyName: "EntityType",
    propertyClass: "DeleteEntity.EntityType",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: false,
    blockOnGenericDefault: true,
    genericDefaultValues: ["", '""', "''"],
  },
  {
    activityType: "GetEntityById",
    propertyName: "EntityType",
    propertyClass: "GetEntityById.EntityType",
    fallbackAllowed: false,
    fallbackValue: null,
    requireExpressionLowering: false,
    blockOnGenericDefault: true,
    genericDefaultValues: ["", '""', "''"],
  },
];

export function getFallbackPolicy(activityType: string, propertyName: string): FallbackEligiblePolicy | null {
  const direct = FALLBACK_ELIGIBLE_POLICIES.find(
    p => p.activityType === activityType && p.propertyName === propertyName,
  );
  if (direct) return direct;

  const alias = ACTIVITY_ALIASES[activityType];
  if (alias) {
    const aliased = FALLBACK_ELIGIBLE_POLICIES.find(
      p => p.activityType === alias && p.propertyName === propertyName,
    );
    if (aliased) return { ...aliased, activityType, propertyClass: `${activityType}.${propertyName}` };
  }

  return null;
}

export interface RequiredPropertyEnforcementResult {
  requiredPropertyBindings: RequiredPropertyBinding[];
  unresolvedRequiredPropertyDefects: UnresolvedRequiredPropertyDefect[];
  expressionLoweringFixes: ExpressionLoweringFix[];
  expressionLoweringFailures: ExpressionLoweringFailure[];
  invalidRequiredPropertySubstitutions: InvalidRequiredPropertySubstitution[];
  fallbackResolutionDiagnostics: FallbackResolutionDiagnostic[];
  classificationDiagnostics: ClassificationDiagnostic[];
  totalEnforced: number;
  totalDefects: number;
  totalInvalidSubstitutionsBlocked: number;
  hasBlockingDefects: boolean;
  summary: string;
}

const SENTINEL_PATTERNS = [
  /^PLACEHOLDER$/i,
  /^PLACEHOLDER_\w*/,
  /^TODO$/i,
  /^TODO_\w*/,
  /^STUB$/i,
  /^STUB_\w*/,
  /^HANDOFF$/i,
  /^HANDOFF_\w*/,
  /^HANDOFF_STRING_FORMAT_UNSAFE$/i,
];

const VALUE_INTENT_PATTERN = /\{"type":"[^"]*","value":"[^"]*"\}/;
const VALUE_INTENT_ENTITY_PATTERN = /\{&quot;type&quot;:&quot;[^&]*&quot;,&quot;value&quot;:&quot;[^&]*&quot;\}/;

export function isSentinelValue(value: string): boolean {
  const trimmed = value.trim();
  for (const pattern of SENTINEL_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }
  if (trimmed === "" || trimmed === '""' || trimmed === "''") return false;
  return false;
}

export function isGenericTypeDefault(value: string, clrType: string): boolean {
  const trimmed = value.trim();
  if (clrType.includes("String") || clrType === "string") {
    return trimmed === "" || trimmed === '""' || trimmed === "''";
  }
  if (clrType.includes("Int") || clrType === "int") {
    return trimmed === "0";
  }
  if (clrType.includes("Boolean") || clrType === "bool") {
    return trimmed === "False";
  }
  if (clrType.includes("Double") || clrType.includes("Decimal")) {
    return trimmed === "0" || trimmed === "0.0";
  }
  if (clrType.includes("Object")) {
    return trimmed === "" || trimmed === "Nothing" || trimmed === "null";
  }
  return false;
}

export interface ContractFallbackResult {
  valid: boolean;
  fallbackValue?: string;
  isDocumentedGenericDefault?: boolean;
}

export function hasContractValidFallback(prop: CatalogProperty): ContractFallbackResult {
  if (prop.default !== undefined && prop.default !== null && prop.default !== "") {
    if (!isSentinelValue(prop.default)) {
      if (isGenericTypeDefault(prop.default, prop.clrType)) {
        return { valid: true, fallbackValue: prop.default, isDocumentedGenericDefault: true };
      }
      return { valid: true, fallbackValue: prop.default };
    }
  }
  if (prop.validValues && prop.validValues.length > 0) {
    return { valid: true, fallbackValue: prop.validValues[0] };
  }
  return { valid: false };
}

export function isDocumentedContractGenericDefault(prop: CatalogProperty, value: string): boolean {
  if (prop.default === undefined || prop.default === null) return false;
  return prop.default === value && isGenericTypeDefault(value, prop.clrType);
}

export interface UpstreamSourceCandidate {
  sourceKind: SourceKind;
  sourceName: string;
  sourceType: string;
  sourceWorkflow?: string;
  sourceStep?: string;
  precedenceTier: PrecedenceTier;
}

const CLR_TYPE_COMPATIBILITY: Record<string, Set<string>> = {
  "System.String": new Set(["System.String", "String", "x:String", "string"]),
  "System.Boolean": new Set(["System.Boolean", "Boolean", "x:Boolean", "bool"]),
  "System.Int32": new Set(["System.Int32", "Int32", "x:Int32", "int", "Integer"]),
  "System.Int64": new Set(["System.Int64", "Int64", "x:Int64", "long", "Long"]),
  "System.Double": new Set(["System.Double", "Double", "x:Double", "double"]),
  "System.Object": new Set(["System.Object", "Object", "x:Object"]),
  "System.Net.Mail.MailMessage": new Set(["System.Net.Mail.MailMessage", "MailMessage"]),
  "System.Data.DataTable": new Set(["System.Data.DataTable", "DataTable", "scg2:DataTable"]),
  "System.DateTime": new Set(["System.DateTime", "DateTime", "s:DateTime"]),
  "System.TimeSpan": new Set(["System.TimeSpan", "TimeSpan", "s:TimeSpan"]),
  "System.Security.SecureString": new Set(["System.Security.SecureString", "SecureString"]),
};

export function isTypeCompatible(sourceType: string, targetType: string): boolean {
  if (!sourceType || !targetType) return true;
  const normalizedSource = sourceType.trim();
  const normalizedTarget = targetType.trim();
  if (normalizedSource === normalizedTarget) return true;
  if (normalizedTarget === "System.Object" || normalizedTarget === "Object" || normalizedTarget === "x:Object") return true;
  const targetSet = CLR_TYPE_COMPATIBILITY[normalizedTarget];
  if (targetSet && targetSet.has(normalizedSource)) return true;
  const sourceSet = CLR_TYPE_COMPATIBILITY[normalizedSource];
  if (sourceSet && sourceSet.has(normalizedTarget)) return true;
  if (normalizedSource.includes("String") && normalizedTarget.includes("String")) return true;
  return false;
}

export function isSlotCompatible(sourceKind: SourceKind, propertyDirection: string): boolean {
  if (propertyDirection === "In" || propertyDirection === "None") {
    return true;
  }
  if (propertyDirection === "Out") {
    return sourceKind === "variable" || sourceKind === "workflowArgument";
  }
  if (propertyDirection === "InOut") {
    return sourceKind === "variable" || sourceKind === "workflowArgument";
  }
  return true;
}

export function extractUpstreamSources(content: string, workflowName: string): UpstreamSourceCandidate[] {
  const candidates: UpstreamSourceCandidate[] = [];

  const argPattern = /<x:Property\s+Name="([^"]+)"\s+Type="(?:InArgument|OutArgument|InOutArgument)\(([^)]+)\)"/g;
  let argMatch;
  while ((argMatch = argPattern.exec(content)) !== null) {
    candidates.push({
      sourceKind: "workflowArgument",
      sourceName: argMatch[1],
      sourceType: argMatch[2],
      sourceWorkflow: workflowName,
      precedenceTier: 1,
    });
  }

  const argPrefixPattern = /(?:x:Property\s+Name|<(?:x:)?Member\s+Name)="(in_[A-Za-z]\w*|out_[A-Za-z]\w*|io_[A-Za-z]\w*)"/g;
  let prefixMatch;
  while ((prefixMatch = argPrefixPattern.exec(content)) !== null) {
    const name = prefixMatch[1];
    if (!candidates.some(c => c.sourceName === name)) {
      const typeHint = name.startsWith("in_") || name.startsWith("out_") ? "System.String" : "System.Object";
      candidates.push({
        sourceKind: "workflowArgument",
        sourceName: name,
        sourceType: typeHint,
        sourceWorkflow: workflowName,
        precedenceTier: 1,
      });
    }
  }

  const varPattern1 = /<Variable\s+x:TypeArguments="([^"]+)"\s+Name="([^"]+)"/g;
  let varMatch;
  while ((varMatch = varPattern1.exec(content)) !== null) {
    candidates.push({
      sourceKind: "variable",
      sourceName: varMatch[2],
      sourceType: varMatch[1],
      sourceWorkflow: workflowName,
      precedenceTier: 2,
    });
  }
  const varPattern2 = /<Variable\s+Name="([^"]+)"\s+x:TypeArguments="([^"]+)"/g;
  let varMatch2;
  while ((varMatch2 = varPattern2.exec(content)) !== null) {
    if (!candidates.some(c => c.sourceName === varMatch2[1] && c.sourceKind === "variable")) {
      candidates.push({
        sourceKind: "variable",
        sourceName: varMatch2[1],
        sourceType: varMatch2[2],
        sourceWorkflow: workflowName,
        precedenceTier: 2,
      });
    }
  }

  const invokePattern = /WorkflowFileName="([^"]+)"/g;
  let invokeMatch;
  while ((invokeMatch = invokePattern.exec(content)) !== null) {
    const invokedFile = invokeMatch[1];
    const invokedWorkflow = invokedFile.replace(/\.xaml$/i, "");
    candidates.push({
      sourceKind: "invokeOutput",
      sourceName: `${invokedWorkflow}_output`,
      sourceType: "System.Object",
      sourceWorkflow: invokedWorkflow,
      sourceStep: invokedFile,
      precedenceTier: 3,
    });
  }

  const outputVarPattern = /\s+(?:Result|Output|Value)="(\[[^\]]+\])"/g;
  let outputMatch;
  while ((outputMatch = outputVarPattern.exec(content)) !== null) {
    const varRef = outputMatch[1].replace(/^\[|\]$/g, "").trim();
    if (/^[a-zA-Z_]\w*$/.test(varRef) && !candidates.some(c => c.sourceName === varRef)) {
      candidates.push({
        sourceKind: "priorStepOutput",
        sourceName: varRef,
        sourceType: "System.Object",
        sourceWorkflow: workflowName,
        precedenceTier: 3,
      });
    }
  }

  return candidates;
}

export interface CatalogSourceCandidate extends UpstreamSourceCandidate {
  resolvedLiteralValue?: string;
}

export function extractCatalogSourceCandidates(
  schema: ActivitySchema,
  activityType: string,
): CatalogSourceCandidate[] {
  const candidates: CatalogSourceCandidate[] = [];

  for (const prop of schema.activity.properties) {
    if (!prop.required) continue;

    if (prop.default !== undefined && prop.default !== null && prop.default !== "" && !isSentinelValue(prop.default) && !isGenericTypeDefault(prop.default, prop.clrType)) {
      candidates.push({
        sourceKind: "contractMapping",
        sourceName: prop.name,
        sourceType: prop.clrType,
        precedenceTier: 4,
        resolvedLiteralValue: prop.default,
      });
    }

    if (prop.validValues && prop.validValues.length > 0) {
      candidates.push({
        sourceKind: "contractMapping",
        sourceName: prop.name,
        sourceType: prop.clrType,
        precedenceTier: 4,
        resolvedLiteralValue: prop.validValues[0],
      });
    }
  }

  return candidates;
}

export function resolveSourceForProperty(
  prop: CatalogProperty,
  upstreamSources: UpstreamSourceCandidate[],
  fileName: string,
  workflowName: string,
  activityType: string,
): {
  resolved: UpstreamSourceCandidate | null;
  rejectedCandidates: RejectedCandidateRecord[];
} {
  const rejectedCandidates: RejectedCandidateRecord[] = [];
  const sortedCandidates = [...upstreamSources].sort((a, b) => a.precedenceTier - b.precedenceTier);

  const propertyNameLower = prop.name.toLowerCase();

  const exactCandidates = sortedCandidates.filter(c => {
    const nameLower = c.sourceName.toLowerCase();
    const strippedName = nameLower.replace(/^(?:in_|out_|io_|str_|int_|bool_|obj_|dt_)/i, "");
    return nameLower === propertyNameLower || strippedName === propertyNameLower;
  });

  const fuzzyCandidates = exactCandidates.length > 0 ? [] : sortedCandidates.filter(c => {
    const nameLower = c.sourceName.toLowerCase();
    const strippedName = nameLower.replace(/^(?:in_|out_|io_|str_|int_|bool_|obj_|dt_)/i, "");
    return (nameLower.includes(propertyNameLower) || propertyNameLower.includes(strippedName)) && strippedName.length > 0;
  });

  const matchingCandidates = exactCandidates.length > 0 ? exactCandidates : fuzzyCandidates;

  if (matchingCandidates.length === 0) return { resolved: null, rejectedCandidates };

  for (const candidate of matchingCandidates) {
    if (!isTypeCompatible(candidate.sourceType, prop.clrType)) {
      rejectedCandidates.push({
        sourceKind: candidate.sourceKind,
        sourceName: candidate.sourceName,
        sourceWorkflow: candidate.sourceWorkflow,
        sourceStep: candidate.sourceStep,
        precedenceTier: candidate.precedenceTier,
        rejectionReason: "typeIncompatible",
      });
      continue;
    }

    if (!isSlotCompatible(candidate.sourceKind, prop.direction)) {
      rejectedCandidates.push({
        sourceKind: candidate.sourceKind,
        sourceName: candidate.sourceName,
        sourceWorkflow: candidate.sourceWorkflow,
        sourceStep: candidate.sourceStep,
        precedenceTier: candidate.precedenceTier,
        rejectionReason: "slotIncompatible",
      });
      continue;
    }

    const sameTierCandidates = matchingCandidates.filter(
      c => c.precedenceTier === candidate.precedenceTier &&
        isTypeCompatible(c.sourceType, prop.clrType) &&
        isSlotCompatible(c.sourceKind, prop.direction)
    );
    if (sameTierCandidates.length > 1) {
      for (const ambiguous of sameTierCandidates) {
        rejectedCandidates.push({
          sourceKind: ambiguous.sourceKind,
          sourceName: ambiguous.sourceName,
          sourceWorkflow: ambiguous.sourceWorkflow,
          sourceStep: ambiguous.sourceStep,
          precedenceTier: ambiguous.precedenceTier,
          rejectionReason: "ambiguousPrecedence",
        });
      }
      return { resolved: null, rejectedCandidates };
    }

    for (const lowerCandidate of matchingCandidates) {
      if (lowerCandidate !== candidate && lowerCandidate.precedenceTier > candidate.precedenceTier) {
        rejectedCandidates.push({
          sourceKind: lowerCandidate.sourceKind,
          sourceName: lowerCandidate.sourceName,
          sourceWorkflow: lowerCandidate.sourceWorkflow,
          sourceStep: lowerCandidate.sourceStep,
          precedenceTier: lowerCandidate.precedenceTier,
          rejectionReason: "lowerPrecedence",
        });
      }
    }

    return { resolved: candidate, rejectedCandidates };
  }

  return { resolved: null, rejectedCandidates };
}

export function tryLowerStructuredExpression(value: string): { lowered: boolean; result: string; reason?: string } {
  const trimmed = value.trim();

  const jsonResult = tryParseJsonValueIntent(trimmed);
  if (jsonResult) {
    try {
      const built = buildExpression(jsonResult.intent);
      if (built && !isSentinelValue(built)) {
        recordExpressionLoweringDiagnostic({
          originalValue: trimmed,
          loweredValue: built,
          lowered: true,
          evidenceSources: [`ValueIntent(type=${jsonResult.intent.type}, fallback=${jsonResult.fallbackUsed})`],
        });
        return { lowered: true, result: built };
      }
      recordExpressionLoweringDiagnostic({
        originalValue: trimmed,
        loweredValue: null,
        lowered: false,
        evidenceSources: [`ValueIntent(type=${jsonResult.intent.type})`],
        blockReason: `ValueIntent lowered to sentinel or empty value: "${built}"`,
      });
      return { lowered: false, result: trimmed, reason: `ValueIntent lowered to sentinel or empty value: "${built}"` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      recordExpressionLoweringDiagnostic({
        originalValue: trimmed,
        loweredValue: null,
        lowered: false,
        evidenceSources: ["ValueIntent(build_exception)"],
        blockReason: `ValueIntent build failed: ${message}`,
      });
      return { lowered: false, result: trimmed, reason: `ValueIntent build failed: ${message}` };
    }
  }

  const entityDecoded = trimmed
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  if (entityDecoded !== trimmed) {
    const decodedResult = tryParseJsonValueIntent(entityDecoded);
    if (decodedResult) {
      try {
        const built = buildExpression(decodedResult.intent);
        if (built && !isSentinelValue(built)) {
          recordExpressionLoweringDiagnostic({
            originalValue: trimmed,
            loweredValue: built,
            lowered: true,
            evidenceSources: [`EntityDecoded-ValueIntent(type=${decodedResult.intent.type})`],
          });
          return { lowered: true, result: built };
        }
      } catch {
      }
    }
  }

  if (VALUE_INTENT_PATTERN.test(trimmed) || VALUE_INTENT_ENTITY_PATTERN.test(trimmed)) {
    recordExpressionLoweringDiagnostic({
      originalValue: trimmed,
      loweredValue: null,
      lowered: false,
      evidenceSources: ["residual_json_pattern"],
      blockReason: "Unresolvable ValueIntent JSON pattern in property value",
    });
    return { lowered: false, result: trimmed, reason: "Unresolvable ValueIntent JSON pattern in property value" };
  }

  return { lowered: true, result: trimmed };
}

export function enforceRequiredProperties(
  xamlEntries: { name: string; content: string }[],
  isPackageMode: boolean = true,
): RequiredPropertyEnforcementResult {
  const bindings: RequiredPropertyBinding[] = [];
  const defects: UnresolvedRequiredPropertyDefect[] = [];
  const exprFixes: ExpressionLoweringFix[] = [];
  const exprFailures: ExpressionLoweringFailure[] = [];
  const invalidSubstitutions: InvalidRequiredPropertySubstitution[] = [];
  const fallbackDiagnostics: FallbackResolutionDiagnostic[] = [];
  const classificationDiags: ClassificationDiagnostic[] = [];

  if (!catalogService.isLoaded()) {
    if (isPackageMode) {
      for (const entry of xamlEntries) {
        const fileName = entry.name.split("/").pop() || entry.name;
        const workflowName = fileName.replace(/\.xaml$/i, "");
        conservativeEnforceForFile(entry, fileName, workflowName, defects);
      }
    }
    const totalDefects = defects.length;
    const hasBlockingDefects = defects.some(d => d.severity === "execution_blocking");
    const summaryParts: string[] = ["Catalog not loaded — using conservative enforcement"];
    if (defects.length > 0) summaryParts.push(`${defects.length} sentinel value(s) detected as defects`);
    return {
      requiredPropertyBindings: bindings,
      unresolvedRequiredPropertyDefects: defects,
      expressionLoweringFixes: exprFixes,
      expressionLoweringFailures: exprFailures,
      invalidRequiredPropertySubstitutions: invalidSubstitutions,
      fallbackResolutionDiagnostics: fallbackDiagnostics,
      classificationDiagnostics: classificationDiags,
      totalEnforced: 0,
      totalDefects,
      totalInvalidSubstitutionsBlocked: 0,
      hasBlockingDefects,
      summary: summaryParts.join("; "),
    };
  }

  for (const entry of xamlEntries) {
    const fileName = entry.name.split("/").pop() || entry.name;
    const workflowName = fileName.replace(/\.xaml$/i, "");
    const upstreamSources = extractUpstreamSources(entry.content, workflowName);
    enforceForFile(entry, fileName, workflowName, isPackageMode, bindings, defects, exprFixes, exprFailures, invalidSubstitutions, upstreamSources, fallbackDiagnostics, classificationDiags);
  }

  const totalDefects = defects.length + exprFailures.length;
  const hasBlockingDefects = defects.some(d => d.severity === "execution_blocking") ||
    exprFailures.some(f => f.severity === "execution_blocking");

  const summaryParts: string[] = [];
  if (bindings.length > 0) summaryParts.push(`${bindings.length} required property binding(s) resolved`);
  if (defects.length > 0) summaryParts.push(`${defects.length} unresolved required property defect(s)`);
  if (exprFixes.length > 0) summaryParts.push(`${exprFixes.length} structured expression(s) lowered`);
  if (exprFailures.length > 0) summaryParts.push(`${exprFailures.length} expression lowering failure(s)`);
  if (invalidSubstitutions.length > 0) summaryParts.push(`${invalidSubstitutions.length} invalid generic substitution(s) blocked`);
  if (fallbackDiagnostics.length > 0) summaryParts.push(`${fallbackDiagnostics.length} fallback-eligible resolution(s) diagnosed`);
  if (classificationDiags.length > 0) summaryParts.push(`${classificationDiags.length} classification diagnostic(s)`);

  return {
    requiredPropertyBindings: bindings,
    unresolvedRequiredPropertyDefects: defects,
    expressionLoweringFixes: exprFixes,
    expressionLoweringFailures: exprFailures,
    invalidRequiredPropertySubstitutions: invalidSubstitutions,
    fallbackResolutionDiagnostics: fallbackDiagnostics,
    classificationDiagnostics: classificationDiags,
    totalEnforced: bindings.length + exprFixes.length,
    totalDefects,
    totalInvalidSubstitutionsBlocked: invalidSubstitutions.length,
    hasBlockingDefects,
    summary: summaryParts.length > 0 ? summaryParts.join("; ") : "No required property issues found",
  };
}

function enforceForFile(
  entry: { name: string; content: string },
  fileName: string,
  workflowName: string,
  isPackageMode: boolean,
  bindings: RequiredPropertyBinding[],
  defects: UnresolvedRequiredPropertyDefect[],
  exprFixes: ExpressionLoweringFix[],
  exprFailures: ExpressionLoweringFailure[],
  invalidSubstitutions: InvalidRequiredPropertySubstitution[],
  upstreamSources: UpstreamSourceCandidate[],
  fallbackDiagnostics: FallbackResolutionDiagnostic[] = [],
  classificationDiags: ClassificationDiagnostic[] = [],
): void {
  const activityTagPattern = /<((?:[a-z]+:)?[A-Z][A-Za-z]+)\s([^>]*?)(\/>|>)/g;
  let match;
  const occurrenceCounts = new Map<string, number>();

  while ((match = activityTagPattern.exec(entry.content)) !== null) {
    const activityTag = match[1];
    const attrStr = match[2];
    const tagStart = match.index;

    const strippedTag = activityTag.includes(":") ? activityTag.split(":").pop()! : activityTag;
    const schema = catalogService.getActivitySchema(strippedTag) || catalogService.getActivitySchema(activityTag);
    if (!schema) continue;

    const currentOccurrence = (occurrenceCounts.get(strippedTag) || 0);
    occurrenceCounts.set(strippedTag, currentOccurrence + 1);

    const closeTag = `</${activityTag}>`;
    const endIdx = entry.content.indexOf(closeTag, tagStart);
    const bodySection = endIdx > 0 ? entry.content.substring(tagStart, endIdx) : match[0];

    const catalogSources = extractCatalogSourceCandidates(schema, strippedTag);
    const mergedSources = [...upstreamSources, ...catalogSources];

    const displayNameMatch = attrStr.match(/DisplayName="([^"]*)"/);
    const activityDisplayName = displayNameMatch ? displayNameMatch[1] : null;

    for (const propDef of schema.activity.properties) {
      if (!propDef.required) continue;

      if (isPropertyOverriddenOptional(strippedTag, propDef.name)) {
        continue;
      }

      const attrBoundaryPattern = new RegExp(`(?:^|\\s)${propDef.name}="`);
      const attrPresent = attrBoundaryPattern.test(attrStr);
      const childPresent = bodySection.includes(`${activityTag}.${propDef.name}`);
      if (!attrPresent && !childPresent) {
        handleMissingRequiredProperty(
          fileName, workflowName, strippedTag, propDef, isPackageMode,
          bindings, defects, currentOccurrence, mergedSources, fallbackDiagnostics,
          activityDisplayName, classificationDiags,
        );
        continue;
      }

      if (attrPresent) {
        const valMatch = attrStr.match(new RegExp(`(?:^|\\s)${propDef.name}="([^"]*)"`));
        if (valMatch) {
          const rawValue = valMatch[1];
          checkPropertyValue(
            fileName, workflowName, strippedTag, propDef, rawValue, isPackageMode,
            bindings, defects, exprFixes, exprFailures, invalidSubstitutions, currentOccurrence, mergedSources, fallbackDiagnostics,
            activityDisplayName, classificationDiags,
          );
        }
      } else if (childPresent) {
        const childPattern = new RegExp(`<${activityTag}\\.${propDef.name}[^>]*>([\\s\\S]*?)</${activityTag}\\.${propDef.name}>`);
        const childMatch = bodySection.match(childPattern);
        if (childMatch) {
          const childContent = childMatch[1].trim();
          const innerValMatch = childContent.match(/^(?:<[^>]+>)?([^<]*)/);
          const innerVal = innerValMatch ? innerValMatch[1].trim() : childContent;
          if (innerVal) {
            checkPropertyValue(
              fileName, workflowName, strippedTag, propDef, innerVal, isPackageMode,
              bindings, defects, exprFixes, exprFailures, invalidSubstitutions, currentOccurrence, mergedSources, fallbackDiagnostics,
              activityDisplayName, classificationDiags,
            );
          }
        }
      }
    }
  }
}

function conservativeEnforceForFile(
  entry: { name: string; content: string },
  fileName: string,
  workflowName: string,
  defects: UnresolvedRequiredPropertyDefect[],
): void {
  const attrPattern = /\s+(\w+)="([^"]*)"/g;
  const tagContext = /<((?:[a-z]+:)?[A-Z][A-Za-z]+)\s/g;
  let currentActivityType = "unknown";

  let tagMatch;
  const tagPositions: { type: string; start: number }[] = [];
  while ((tagMatch = tagContext.exec(entry.content)) !== null) {
    tagPositions.push({ type: tagMatch[1], start: tagMatch.index });
  }

  let attrMatch;
  while ((attrMatch = attrPattern.exec(entry.content)) !== null) {
    const attrPos = attrMatch.index;
    for (const tp of tagPositions) {
      if (tp.start <= attrPos) currentActivityType = tp.type;
      else break;
    }

    const propName = attrMatch[1];
    const rawValue = attrMatch[2];
    if (propName === "xmlns" || propName.startsWith("xmlns:") || propName === "x:Class" || propName === "x:Key") continue;

    const unwrapped = rawValue.replace(/^\[|\]$/g, "").trim();
    if (isSentinelValue(rawValue) || isSentinelValue(unwrapped)) {
      const strippedType = currentActivityType.includes(":") ? currentActivityType.split(":").pop()! : currentActivityType;
      defects.push({
        file: fileName,
        workflow: workflowName,
        activityType: strippedType,
        propertyName: propName,
        failureReason: `Sentinel value "${rawValue}" detected on ${strippedType}.${propName} (catalog unavailable — conservative enforcement)`,
        originalValue: rawValue,
        severity: "execution_blocking",
        packageModeOutcome: "structured_defect",
      });
    }
  }
}

function tryContextDerivedFallbackByClassification(
  activityType: string,
  propertyName: string,
  context: ContextDerivedFallbackContext,
): { value: string; spec: ContextDerivedFallbackSpec } | null {
  const spec = CONTEXT_DERIVED_FALLBACK_REGISTRY.find(
    s => s.activityType === activityType && s.propertyName === propertyName,
  );
  if (!spec) return null;

  const derivedValue = spec.deriveExpression(context);
  if (!derivedValue || derivedValue.trim().length === 0) return null;

  return { value: derivedValue, spec };
}

function handleMissingRequiredProperty(
  fileName: string,
  workflowName: string,
  activityType: string,
  prop: CatalogProperty,
  isPackageMode: boolean,
  bindings: RequiredPropertyBinding[],
  defects: UnresolvedRequiredPropertyDefect[],
  occurrenceIndex: number,
  upstreamSources: UpstreamSourceCandidate[] = [],
  fallbackDiagnostics: FallbackResolutionDiagnostic[] = [],
  displayName: string | null = null,
  classificationDiags: ClassificationDiagnostic[] = [],
): void {
  const policy = getFallbackPolicy(activityType, prop.name);
  const sourceResolution = resolveSourceForProperty(prop, upstreamSources, fileName, workflowName, activityType);
  if (sourceResolution.resolved) {
    const resolved = sourceResolution.resolved;
    const catalogCandidate = resolved as CatalogSourceCandidate;
    let resolvedValue: string;
    if (catalogCandidate.resolvedLiteralValue && resolved.sourceKind === "contractMapping") {
      resolvedValue = catalogCandidate.resolvedLiteralValue;
    } else {
      resolvedValue = `[${resolved.sourceName}]`;
    }

    bindings.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      sourceBinding: resolved.sourceKind,
      originalValue: "",
      resolvedValue,
      severity: "info",
      packageModeOutcome: "bound",
      occurrenceIndex,
      provenance: {
        sourceKind: resolved.sourceKind,
        sourceName: resolved.sourceName,
        sourceWorkflow: resolved.sourceWorkflow,
        sourceStep: resolved.sourceStep,
        precedenceTier: resolved.precedenceTier,
      },
      rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
    });
    if (policy) {
      fallbackDiagnostics.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        propertyClass: policy.propertyClass, decision: "source-bound",
        sourceFound: true, expressionLowered: null, fallbackApplied: false,
        blockReason: null, originalValue: "", resolvedValue,
      });
    }
    console.log(`[RequiredPropertyEnforcer] SOURCE-RESOLVED: ${activityType}.${prop.name} in ${fileName} — bound to ${resolved.sourceKind}:${resolved.sourceName} (tier ${resolved.precedenceTier})`);
    return;
  }

  const classification = getPropertyClassification(activityType, prop.name);

  if (classification) {
    switch (classification.classification) {
      case "unsupported": {
        const msg = buildClassificationDiagnosticMessage(activityType, prop.name, "unsupported");
        classificationDiags.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          classification: "unsupported", approvedEnforcerRecovery: false,
          message: msg, resolved: false, resolvedValue: null,
        });
        if (isPackageMode) {
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: "",
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
        }
        console.warn(`[RequiredPropertyEnforcer] CLASSIFICATION-UNSUPPORTED: ${activityType}.${prop.name} in ${fileName}`);
        return;
      }

      case "spec-required": {
        const msg = buildClassificationDiagnosticMessage(activityType, prop.name, "spec-required");
        classificationDiags.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          classification: "spec-required", approvedEnforcerRecovery: false,
          message: msg, resolved: false, resolvedValue: null,
        });
        if (isPackageMode) {
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: "",
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
        }
        console.warn(`[RequiredPropertyEnforcer] CLASSIFICATION-SPEC-REQUIRED: ${activityType}.${prop.name} in ${fileName}`);
        return;
      }

      case "generator-owned": {
        if (classification.approvedEnforcerRecovery) {
          const contextFallbackResult = tryContextDerivedFallbackByClassification(
            activityType, prop.name, {
              displayName, fileName, workflowName, activityType, propertyName: prop.name,
            },
          );
          if (contextFallbackResult) {
            bindings.push({
              file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
              sourceBinding: "context-derived", originalValue: "",
              resolvedValue: contextFallbackResult.value,
              severity: "info", packageModeOutcome: "bound", occurrenceIndex,
              provenance: {
                sourceKind: "context-derived",
                sourceName: `${activityType}.${prop.name}.context-derived`,
                precedenceTier: 7,
              },
              rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
            });
            classificationDiags.push({
              file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
              classification: "generator-owned", approvedEnforcerRecovery: true,
              message: `${activityType}.${prop.name} is generator-owned with approved enforcer recovery — context-derived value applied.`,
              resolved: true, resolvedValue: contextFallbackResult.value,
            });
            if (policy) {
              fallbackDiagnostics.push({
                file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
                propertyClass: policy.propertyClass, decision: "context-derived-fallback",
                sourceFound: false, expressionLowered: null, fallbackApplied: true,
                blockReason: null, originalValue: "", resolvedValue: contextFallbackResult.value,
              });
            }
            console.log(`[RequiredPropertyEnforcer] CLASSIFICATION-APPROVED-RECOVERY: ${activityType}.${prop.name} in ${fileName} — enforcer recovery applied: ${contextFallbackResult.value}`);
            return;
          }
        }

        const msg = buildClassificationDiagnosticMessage(activityType, prop.name, "generator-owned");
        classificationDiags.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          classification: "generator-owned", approvedEnforcerRecovery: classification.approvedEnforcerRecovery,
          message: msg, resolved: false, resolvedValue: null,
        });
        if (isPackageMode) {
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: "",
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
        }
        console.warn(`[RequiredPropertyEnforcer] CLASSIFICATION-GENERATOR-OWNED: ${activityType}.${prop.name} in ${fileName}${classification.approvedEnforcerRecovery ? " — approved recovery returned null" : ""}`);
        return;
      }

      case "safe-fallback": {
        const safeFallbackValue = resolveSafeFallbackFromCatalog(prop, activityType);
        if (safeFallbackValue) {
          if (policy && policy.blockOnGenericDefault && policy.genericDefaultValues.includes(safeFallbackValue)) {
            const msg = `${activityType}.${prop.name} safe-fallback value "${safeFallbackValue}" blocked by policy — disallowed generic default.`;
            classificationDiags.push({
              file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
              classification: "safe-fallback", approvedEnforcerRecovery: false,
              message: msg, resolved: false, resolvedValue: null,
            });
            if (isPackageMode) {
              defects.push({
                file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
                failureReason: msg, originalValue: "",
                severity: "execution_blocking", packageModeOutcome: "structured_defect",
                rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
              });
            }
            console.warn(`[RequiredPropertyEnforcer] CLASSIFICATION-SAFE-FALLBACK-BLOCKED: ${activityType}.${prop.name} in ${fileName} — policy blocked safe-fallback value`);
            return;
          }

          bindings.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            sourceBinding: "contract-default", originalValue: "",
            resolvedValue: safeFallbackValue,
            severity: "info", packageModeOutcome: "bound", occurrenceIndex,
            provenance: {
              sourceKind: "contract-default",
              sourceName: `${activityType}.${prop.name}.safe-fallback`,
              precedenceTier: 6,
            },
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
          classificationDiags.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            classification: "safe-fallback", approvedEnforcerRecovery: false,
            message: `${activityType}.${prop.name} resolved via safe-fallback catalog resolution.`,
            resolved: true, resolvedValue: safeFallbackValue,
          });
          if (policy) {
            fallbackDiagnostics.push({
              file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
              propertyClass: policy.propertyClass, decision: "fallback-applied",
              sourceFound: false, expressionLowered: null, fallbackApplied: true,
              blockReason: null, originalValue: "", resolvedValue: safeFallbackValue,
            });
          }
          console.log(`[RequiredPropertyEnforcer] CLASSIFICATION-SAFE-FALLBACK: ${activityType}.${prop.name} in ${fileName} — safe-fallback applied: ${safeFallbackValue}`);
          return;
        }

        const msg = `${activityType}.${prop.name} is classified as safe-fallback but no valid catalog fallback value found.`;
        classificationDiags.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          classification: "safe-fallback", approvedEnforcerRecovery: false,
          message: msg, resolved: false, resolvedValue: null,
        });
        if (isPackageMode) {
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: "",
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
        }
        console.warn(`[RequiredPropertyEnforcer] CLASSIFICATION-SAFE-FALLBACK-EMPTY: ${activityType}.${prop.name} in ${fileName} — no valid safe-fallback value`);
        return;
      }
    }
  }

  const unclassifiedMsg = `${activityType}.${prop.name} is not classified — defaulting to unsupported.`;
  classificationDiags.push({
    file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
    classification: "unsupported", approvedEnforcerRecovery: false,
    message: unclassifiedMsg,
    resolved: false, resolvedValue: null,
  });
  if (isPackageMode) {
    defects.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      failureReason: unclassifiedMsg,
      originalValue: "",
      severity: "execution_blocking",
      packageModeOutcome: "structured_defect",
      rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
    });
  }
  console.warn(`[RequiredPropertyEnforcer] UNCLASSIFIED-UNSUPPORTED: ${activityType}.${prop.name} in ${fileName} — no classification, defaulting to unsupported`);
}

function checkPropertyValue(
  fileName: string,
  workflowName: string,
  activityType: string,
  prop: CatalogProperty,
  rawValue: string,
  isPackageMode: boolean,
  bindings: RequiredPropertyBinding[],
  defects: UnresolvedRequiredPropertyDefect[],
  exprFixes: ExpressionLoweringFix[],
  exprFailures: ExpressionLoweringFailure[],
  invalidSubstitutions: InvalidRequiredPropertySubstitution[],
  occurrenceIndex: number,
  upstreamSources: UpstreamSourceCandidate[] = [],
  fallbackDiagnostics: FallbackResolutionDiagnostic[] = [],
  displayName: string | null = null,
  classificationDiags: ClassificationDiagnostic[] = [],
): void {
  const policy = getFallbackPolicy(activityType, prop.name);
  const unwrappedValue = rawValue.replace(/^\[|\]$/g, "").trim();
  if (isSentinelValue(rawValue) || isSentinelValue(unwrappedValue)) {
    if (isPackageMode) {
      defects.push({
        file: fileName,
        workflow: workflowName,
        activityType,
        propertyName: prop.name,
        failureReason: `Required property "${prop.name}" on ${activityType} contains sentinel value "${rawValue}" — cannot emit in package mode`,
        originalValue: rawValue,
        severity: "execution_blocking",
        packageModeOutcome: "structured_defect",
      });
      if (policy) {
        fallbackDiagnostics.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          propertyClass: policy.propertyClass, decision: "blocked",
          sourceFound: false, expressionLowered: null, fallbackApplied: false,
          blockReason: `Sentinel value "${rawValue}" in ${policy.propertyClass}`,
          originalValue: rawValue, resolvedValue: null,
        });
      }
      console.warn(`[RequiredPropertyEnforcer] SENTINEL DEFECT: ${activityType}.${prop.name} = "${rawValue}" in ${fileName}`);
    }
    return;
  }

  const isGenericRaw = isGenericTypeDefault(rawValue, prop.clrType);
  const isGenericUnwrapped = !isGenericRaw && isGenericTypeDefault(unwrappedValue, prop.clrType);
  if (isPackageMode && (isGenericRaw || isGenericUnwrapped)) {
    const classification = getPropertyClassification(activityType, prop.name);
    if (classification) {
      const sourceResolution = resolveSourceForProperty(prop, upstreamSources, fileName, workflowName, activityType);
      if (sourceResolution.resolved) {
        const resolved = sourceResolution.resolved;
        const catalogCandidate = resolved as CatalogSourceCandidate;
        let resolvedValue: string;
        if (catalogCandidate.resolvedLiteralValue && resolved.sourceKind === "contractMapping") {
          resolvedValue = catalogCandidate.resolvedLiteralValue;
        } else {
          resolvedValue = `[${resolved.sourceName}]`;
        }
        bindings.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          sourceBinding: resolved.sourceKind, originalValue: rawValue, resolvedValue,
          severity: "info", packageModeOutcome: "bound", occurrenceIndex,
          provenance: {
            sourceKind: resolved.sourceKind, sourceName: resolved.sourceName,
            sourceWorkflow: resolved.sourceWorkflow, sourceStep: resolved.sourceStep,
            precedenceTier: resolved.precedenceTier,
          },
          rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
        });
        console.log(`[RequiredPropertyEnforcer] CLASSIFIED-SOURCE-RESOLVED: ${activityType}.${prop.name} in ${fileName} — replaced generic default "${rawValue}" with ${resolved.sourceKind}:${resolved.sourceName}`);
        return;
      }

      switch (classification.classification) {
        case "unsupported": {
          const msg = buildClassificationDiagnosticMessage(activityType, prop.name, "unsupported");
          classificationDiags.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            classification: "unsupported", approvedEnforcerRecovery: false,
            message: msg, resolved: false, resolvedValue: null,
          });
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: rawValue,
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
          });
          return;
        }
        case "spec-required": {
          const msg = buildClassificationDiagnosticMessage(activityType, prop.name, "spec-required");
          classificationDiags.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            classification: "spec-required", approvedEnforcerRecovery: false,
            message: msg, resolved: false, resolvedValue: null,
          });
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: rawValue,
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
          });
          return;
        }
        case "generator-owned": {
          if (classification.approvedEnforcerRecovery) {
            const contextFallbackResult = tryContextDerivedFallbackByClassification(
              activityType, prop.name, {
                displayName, fileName, workflowName, activityType, propertyName: prop.name,
              },
            );
            if (contextFallbackResult) {
              bindings.push({
                file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
                sourceBinding: "context-derived", originalValue: rawValue,
                resolvedValue: contextFallbackResult.value,
                severity: "info", packageModeOutcome: "bound", occurrenceIndex,
                provenance: {
                  sourceKind: "context-derived",
                  sourceName: `${activityType}.${prop.name}.context-derived`,
                  precedenceTier: 7,
                },
              });
              classificationDiags.push({
                file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
                classification: "generator-owned", approvedEnforcerRecovery: true,
                message: `${activityType}.${prop.name} is generator-owned with approved enforcer recovery — context-derived value replaced generic default "${rawValue}".`,
                resolved: true, resolvedValue: contextFallbackResult.value,
              });
              return;
            }
          }
          const msg = buildClassificationDiagnosticMessage(activityType, prop.name, "generator-owned");
          classificationDiags.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            classification: "generator-owned", approvedEnforcerRecovery: classification.approvedEnforcerRecovery,
            message: msg, resolved: false, resolvedValue: null,
          });
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: rawValue,
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
          });
          return;
        }
        case "safe-fallback": {
          const safeFallbackValue = resolveSafeFallbackFromCatalog(prop, activityType);
          if (safeFallbackValue) {
            if (policy && policy.blockOnGenericDefault && policy.genericDefaultValues.includes(safeFallbackValue)) {
              const msg = `${activityType}.${prop.name} safe-fallback value "${safeFallbackValue}" blocked by policy — disallowed generic default.`;
              classificationDiags.push({
                file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
                classification: "safe-fallback", approvedEnforcerRecovery: false,
                message: msg, resolved: false, resolvedValue: null,
              });
              defects.push({
                file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
                failureReason: msg, originalValue: rawValue,
                severity: "execution_blocking", packageModeOutcome: "structured_defect",
              });
              return;
            }
            bindings.push({
              file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
              sourceBinding: "contract-default", originalValue: rawValue,
              resolvedValue: safeFallbackValue,
              severity: "info", packageModeOutcome: "bound", occurrenceIndex,
              provenance: {
                sourceKind: "contract-default",
                sourceName: `${activityType}.${prop.name}.safe-fallback`,
                precedenceTier: 6,
              },
            });
            classificationDiags.push({
              file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
              classification: "safe-fallback", approvedEnforcerRecovery: false,
              message: `${activityType}.${prop.name} resolved via safe-fallback catalog resolution (replaced generic default "${rawValue}").`,
              resolved: true, resolvedValue: safeFallbackValue,
            });
            return;
          }
          const msg = `${activityType}.${prop.name} is classified as safe-fallback but no valid catalog fallback value found.`;
          classificationDiags.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            classification: "safe-fallback", approvedEnforcerRecovery: false,
            message: msg, resolved: false, resolvedValue: null,
          });
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: msg, originalValue: rawValue,
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
          });
          return;
        }
      }
    } else {
      classificationDiags.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        classification: "unsupported", approvedEnforcerRecovery: false,
        message: `${activityType}.${prop.name} has no classification and contains generic default "${rawValue}" — defaulting to unsupported.`,
        resolved: false, resolvedValue: null,
      });
      defects.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        failureReason: `${activityType}.${prop.name} has no classification — property is not supported by the current pipeline.`,
        originalValue: rawValue,
        severity: "execution_blocking", packageModeOutcome: "structured_defect",
      });
      console.warn(`[RequiredPropertyEnforcer] UNCLASSIFIED-GENERIC-DEFAULT: ${activityType}.${prop.name} = "${rawValue}" in ${fileName} — no classification, defaulting to unsupported`);
      return;
    }
  }

  if (policy && policy.requireExpressionLowering) {
    const lowerResult = tryLowerStructuredExpression(rawValue);
    if (lowerResult.lowered && lowerResult.result !== rawValue) {
      exprFixes.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        originalValue: rawValue, resolvedValue: lowerResult.result,
        severity: "info", packageModeOutcome: "lowered", occurrenceIndex,
      });
      fallbackDiagnostics.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        propertyClass: policy.propertyClass, decision: "expression-lowered",
        sourceFound: false, expressionLowered: true, fallbackApplied: false,
        blockReason: null, originalValue: rawValue, resolvedValue: lowerResult.result,
      });
      console.log(`[RequiredPropertyEnforcer] CONDITION-LOWERED: ${activityType}.${prop.name} in ${fileName} — expression lowered from "${rawValue}" to "${lowerResult.result}"`);
      const resolvedRef = unwrappedValue;
      let provenance: ResolvedSourceProvenance | undefined;
      if (/^[a-zA-Z_]\w*$/.test(resolvedRef)) {
        const matchingSource = upstreamSources.find(s => s.sourceName === resolvedRef);
        if (matchingSource) {
          provenance = {
            sourceKind: matchingSource.sourceKind, sourceName: matchingSource.sourceName,
            sourceWorkflow: matchingSource.sourceWorkflow, sourceStep: matchingSource.sourceStep,
            precedenceTier: matchingSource.precedenceTier,
          };
        }
      }
      if (!provenance) {
        provenance = { sourceKind: "attribute-value", sourceName: rawValue.substring(0, 80), precedenceTier: 4 };
      }
      bindings.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        sourceBinding: provenance.sourceKind, originalValue: rawValue, resolvedValue: lowerResult.result,
        severity: "info", packageModeOutcome: "bound", occurrenceIndex, provenance,
      });
      return;
    } else if (!lowerResult.lowered) {
      if (isPackageMode) {
        exprFailures.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          originalValue: rawValue,
          failureReason: `Expression lowering failed for ${policy.propertyClass}: ${lowerResult.reason || "structurally broken expression"} — blocked with diagnostic (not defaulted to generic value)`,
          severity: "execution_blocking", packageModeOutcome: "structured_defect",
        });
        fallbackDiagnostics.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          propertyClass: policy.propertyClass, decision: "blocked",
          sourceFound: false, expressionLowered: false, fallbackApplied: false,
          blockReason: `Expression lowering failed for ${policy.propertyClass}: ${lowerResult.reason || "structurally broken"} — blocked, not silently defaulted`,
          originalValue: rawValue, resolvedValue: null,
        });
        console.warn(`[RequiredPropertyEnforcer] CONDITION-LOWERING-BLOCKED: ${activityType}.${prop.name} in ${fileName} — expression lowering failed: ${lowerResult.reason}, blocking instead of defaulting to False`);
      }
      return;
    }
  }

  const lowerResult = tryLowerStructuredExpression(rawValue);
  if (!lowerResult.lowered) {
    if (isPackageMode) {
      exprFailures.push({
        file: fileName,
        workflow: workflowName,
        activityType,
        propertyName: prop.name,
        originalValue: rawValue,
        failureReason: lowerResult.reason || "Expression lowering failed",
        severity: "execution_blocking",
        packageModeOutcome: "structured_defect",
      });
      if (policy) {
        fallbackDiagnostics.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          propertyClass: policy.propertyClass, decision: "blocked",
          sourceFound: false, expressionLowered: false, fallbackApplied: false,
          blockReason: `Expression lowering failed: ${lowerResult.reason}`,
          originalValue: rawValue, resolvedValue: null,
        });
      }
      console.warn(`[RequiredPropertyEnforcer] EXPRESSION LOWERING FAILURE: ${activityType}.${prop.name} in ${fileName}: ${lowerResult.reason}`);
    }
    return;
  }

  if (lowerResult.result !== rawValue) {
    exprFixes.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      originalValue: rawValue,
      resolvedValue: lowerResult.result,
      severity: "info",
      packageModeOutcome: "lowered",
      occurrenceIndex,
    });
    if (policy) {
      fallbackDiagnostics.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        propertyClass: policy.propertyClass, decision: "expression-lowered",
        sourceFound: false, expressionLowered: true, fallbackApplied: false,
        blockReason: null, originalValue: rawValue, resolvedValue: lowerResult.result,
      });
    }
  }

  const resolvedRef = unwrappedValue;
  let provenance: ResolvedSourceProvenance | undefined;
  if (/^[a-zA-Z_]\w*$/.test(resolvedRef)) {
    const matchingSource = upstreamSources.find(s => s.sourceName === resolvedRef);
    if (matchingSource) {
      provenance = {
        sourceKind: matchingSource.sourceKind,
        sourceName: matchingSource.sourceName,
        sourceWorkflow: matchingSource.sourceWorkflow,
        sourceStep: matchingSource.sourceStep,
        precedenceTier: matchingSource.precedenceTier,
      };
    }
  }
  if (!provenance) {
    provenance = {
      sourceKind: "attribute-value",
      sourceName: rawValue.substring(0, 80),
      precedenceTier: 4,
    };
  }

  bindings.push({
    file: fileName,
    workflow: workflowName,
    activityType,
    propertyName: prop.name,
    sourceBinding: provenance.sourceKind,
    originalValue: rawValue,
    resolvedValue: lowerResult.result,
    severity: "info",
    packageModeOutcome: "bound",
    occurrenceIndex,
    provenance,
  });
}

export interface PreComplianceGuardResult {
  passed: boolean;
  violations: PreComplianceGuardViolation[];
  summary: string;
}

export interface PreComplianceGuardViolation {
  file: string;
  propertyName: string;
  activityType: string;
  sentinelValue: string;
  sentinelCategory: "PLACEHOLDER" | "TODO" | "STUB" | "HANDOFF" | "SYNTHETIC_SENTINEL";
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
  /**
   * Task #528: classification verdict for this violation. A
   * pipeline-fallback safe placeholder in an attribute-VALUE position
   * counted by this guard is recorded as a localized degradation and
   * does NOT flip preComplianceGuardPassed to false on its own. A
   * genuinely unsafe pipeline output (malformed XML, prohibited
   * position, contract-required field) flips the guard regardless of
   * provenance.
   */
  classification?: "soft-localized-degradation" | "genuine-structural-violation";
  classificationReason?: string;
}

export function runPreCompliancePackageModeGuard(
  xamlEntries: { name: string; content: string }[],
): PreComplianceGuardResult {
  const violations: PreComplianceGuardViolation[] = [];

  // Task #528: pre-compute well-formedness per file. A pipeline-fallback
  // sentinel sitting in a file whose XML is malformed is "genuinely
  // unsafe pipeline output" and still flips the guard regardless of
  // provenance.
  const fileWellFormedness = new Map<string, boolean>();
  for (const entry of xamlEntries) {
    const fileName = entry.name.split("/").pop() || entry.name;
    try {
      const validation = XMLValidator.validate(entry.content);
      fileWellFormedness.set(fileName, validation === true);
    } catch {
      fileWellFormedness.set(fileName, false);
    }
  }

  if (!catalogService.isLoaded()) {
    const broadViolations: PreComplianceGuardViolation[] = [];
    for (const entry of xamlEntries) {
      const fileName = entry.name.split("/").pop() || entry.name;
      broadScanForSentinels(entry.content, fileName, broadViolations);
      // Task #528: forbidden-position scan must run even on the broad
      // (catalog-unavailable) path — these positions are unconditionally
      // genuine and must not be classified by provenance.
      scanForForbiddenPositionSentinels(entry.content, fileName, broadViolations);
    }
    classifyGuardViolations(broadViolations, fileWellFormedness);
    const genuineCount = broadViolations.filter(v => v.classification === "genuine-structural-violation").length;
    return {
      passed: genuineCount === 0,
      violations: broadViolations,
      summary: genuineCount === 0
        ? `Pre-compliance guard passed (catalog unavailable — broad scan; ${broadViolations.length} pipeline-fallback safe placeholder(s) recorded as localized degradation)`
        : `Pre-compliance guard FAILED: ${genuineCount} genuine sentinel violation(s) (of ${broadViolations.length} total; ${broadViolations.length - genuineCount} pipeline-fallback)`,
    };
  }

  for (const entry of xamlEntries) {
    const fileName = entry.name.split("/").pop() || entry.name;
    scanForSentinels(entry.content, fileName, violations);
    // Task #528: forbidden-position scans — sentinels in attribute
    // names, element local names, or namespace prefixes are ALWAYS
    // genuine structural violations regardless of provenance.
    scanForForbiddenPositionSentinels(entry.content, fileName, violations);
  }
  classifyGuardViolations(violations, fileWellFormedness);
  const genuineCount = violations.filter(v => v.classification === "genuine-structural-violation").length;

  return {
    passed: genuineCount === 0,
    violations,
    summary: genuineCount === 0
      ? `Pre-compliance guard passed — ${violations.length} pipeline-fallback safe placeholder(s) recorded as localized degradation, no genuine structural violation`
      : `Pre-compliance guard FAILED: ${genuineCount} genuine sentinel violation(s) (of ${violations.length} total; ${violations.length - genuineCount} pipeline-fallback safe)`,
  };
}

/**
 * Task #528: pre-compliance guard provenance-awareness. Classifies each
 * scanned violation as either a localized degradation (do not flip the
 * guard) or a genuine structural violation (flip the guard).
 *
 * Genuine if ANY of:
 *  - File XML is not well-formed (malformed pipeline output)
 *  - The sentinel sits in an InvokeWorkflowFile argument-binding key
 *    position (x:Key) — i.e., #530 territory; if its repair stack did
 *    not absorb it the guard must still flip.
 *  - The provenance index does not classify the value as
 *    pipeline-fallback (and the value is not a canonical placeholder).
 *
 * Otherwise: soft-localized-degradation (do not flip the guard).
 */
function classifyGuardViolations(
  violations: PreComplianceGuardViolation[],
  fileWellFormedness: Map<string, boolean>,
): void {
  for (const v of violations) {
    // Already pre-classified by forbidden-position scanner — keep.
    if (v.classification === "genuine-structural-violation" && v.origin === "genuine") {
      continue;
    }
    const wellFormed = fileWellFormedness.get(v.file);
    if (wellFormed === false) {
      v.origin = "genuine";
      v.originReason = "containing file failed XML well-formedness re-parse";
      v.classification = "genuine-structural-violation";
      v.classificationReason = "malformed XML — genuinely unsafe pipeline output";
      continue;
    }
    if (v.propertyName === "x:Key" || /^Key$/i.test(v.propertyName)) {
      v.origin = "genuine";
      v.originReason = "sentinel in InvokeWorkflowFile argument binding key (x:Key) position — #530 repair did not absorb";
      v.classification = "genuine-structural-violation";
      v.classificationReason = "sentinel in prohibited key position";
      continue;
    }
    // Task #528: required-contract fields lacking a safe canonical
    // substitution remain genuine. We classify the property using the
    // existing per-property classification system; "spec-required" with
    // a sentinel value (not a safe substitute) is genuine.
    // Task #528: required-contract spec-required fields lacking a safe
    // canonical substitution remain genuine. Use the existing
    // getPropertyClassification registry rather than a local heuristic.
    const entry = getPropertyClassification(v.activityType, v.propertyName);
    if (entry && entry.classification === "spec-required" && !isSafeCanonicalSubstitution(v.sentinelValue)) {
      v.origin = "genuine";
      v.originReason = `spec-required contract field "${v.activityType}.${v.propertyName}" lacks safe canonical substitution (classification registry)`;
      v.classification = "genuine-structural-violation";
      v.classificationReason = "required-contract field with no safe substitute";
      continue;
    }
    const classified = classifyDefectOrigin(v.sentinelValue, `pre-compliance-guard:${v.file}:${v.propertyName}`);
    v.origin = classified.origin;
    v.originReason = classified.originReason;
    v.classification = classified.origin === "pipeline-fallback"
      ? "soft-localized-degradation"
      : "genuine-structural-violation";
    v.classificationReason = classified.origin === "pipeline-fallback"
      ? "pipeline-fallback safe placeholder in attribute-VALUE position; file is well-formed"
      : "value not in provenance index and not canonical placeholder shape";
  }
}

/**
 * A safe canonical substitution is a TODO_X / PLACEHOLDER_X / "TODO - …"
 * canonical-vocabulary token (cf. placeholder-sanitizer.isCanonicalPlaceholder).
 * We re-derive it locally to avoid importing the full sanitizer surface.
 */
function isSafeCanonicalSubstitution(raw: string): boolean {
  const s = (raw || "").trim().replace(/^[\["]+|[\]"]+$/g, "").trim();
  if (!s) return false;
  return /^(TODO|PLACEHOLDER)[_ -][A-Za-z][A-Za-z0-9 _\-]*$/i.test(s);
}


function categorizeSentinel(value: string): PreComplianceGuardViolation["sentinelCategory"] {
  if (/^PLACEHOLDER/i.test(value) || /\bPLACEHOLDER\b/i.test(value)) return "PLACEHOLDER";
  if (/^TODO/i.test(value) || /\bTODO\b/i.test(value)) return "TODO";
  if (/^STUB/i.test(value) || /\bSTUB\b/i.test(value)) return "STUB";
  if (/^HANDOFF/i.test(value) || /\bHANDOFF\b/i.test(value)) return "HANDOFF";
  return "SYNTHETIC_SENTINEL";
}

function scanForSentinels(
  content: string,
  fileName: string,
  violations: PreComplianceGuardViolation[],
): void {
  const activityTagPattern = /<((?:[a-z]+:)?[A-Z][A-Za-z]+)\s([^>]*?)(\/>|>)/g;
  let match;

  while ((match = activityTagPattern.exec(content)) !== null) {
    const activityTag = match[1];
    const attrStr = match[2];
    const tagStart = match.index;

    const strippedTag = activityTag.includes(":") ? activityTag.split(":").pop()! : activityTag;
    const schema = catalogService.getActivitySchema(strippedTag) || catalogService.getActivitySchema(activityTag);
    if (!schema) continue;

    const closeTag = `</${activityTag}>`;
    const endIdx = content.indexOf(closeTag, tagStart);
    const bodySection = endIdx > 0 ? content.substring(tagStart, endIdx) : match[0];

    for (const propDef of schema.activity.properties) {
      if (!propDef.required) continue;

      const valMatch = attrStr.match(new RegExp(`(?:^|\\s)${propDef.name}="([^"]*)"`));
      if (valMatch) {
        const rawValue = valMatch[1];
        const unwrapped = rawValue.replace(/^\[|\]$/g, "").trim();
        if (isSentinelValue(rawValue) || isSentinelValue(unwrapped)) {
          violations.push({
            file: fileName,
            propertyName: propDef.name,
            activityType: strippedTag,
            sentinelValue: rawValue,
            sentinelCategory: categorizeSentinel(unwrapped),
          });
        }
        continue;
      }

      const childPattern = new RegExp(`<${activityTag}\\.${propDef.name}[^>]*>([\\s\\S]*?)</${activityTag}\\.${propDef.name}>`);
      const childMatch = bodySection.match(childPattern);
      if (childMatch) {
        const childContent = childMatch[1].trim();
        const innerValMatch = childContent.match(/^(?:<[^>]+>)?([^<]*)/);
        const innerVal = innerValMatch ? innerValMatch[1].trim() : childContent;
        if (innerVal) {
          const unwrapped = innerVal.replace(/^\[|\]$/g, "").trim();
          if (isSentinelValue(innerVal) || isSentinelValue(unwrapped)) {
            violations.push({
              file: fileName,
              propertyName: propDef.name,
              activityType: strippedTag,
              sentinelValue: innerVal,
              sentinelCategory: categorizeSentinel(unwrapped),
            });
          }
        }
      }
    }
  }
}

/**
 * Task #528: scan for sentinels in forbidden positions — attribute
 * NAMES, element LOCAL NAMES, namespace prefix declarations. Any hit
 * is unconditionally a genuine structural violation regardless of
 * provenance, because these positions cannot be repaired by
 * substituting a safe value (the structure of the document is wrong).
 *
 * Hits are pushed with classification pre-set so classifyGuardViolations
 * does not relax them.
 */
function scanForForbiddenPositionSentinels(
  content: string,
  fileName: string,
  violations: PreComplianceGuardViolation[],
): void {
  // Element local name: <TODO_X ...> or <ui:PLACEHOLDER_Y />
  const elementNamePattern = /<((?:[A-Za-z_][\w-]*:)?(?:TODO|PLACEHOLDER|STUB|HANDOFF)[A-Za-z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = elementNamePattern.exec(content)) !== null) {
    violations.push({
      file: fileName,
      propertyName: "<element-name>",
      activityType: m[1],
      sentinelValue: m[1],
      sentinelCategory: categorizeSentinel(m[1]),
      origin: "genuine",
      originReason: "sentinel in element local name (forbidden position)",
      classification: "genuine-structural-violation",
      classificationReason: "sentinel cannot legally appear in element name position",
    });
  }
  // Attribute name: <Foo TODO_Bar="..." />
  const attrNamePattern = /\s((?:TODO|PLACEHOLDER|STUB|HANDOFF)[A-Za-z0-9_]*)\s*=/g;
  while ((m = attrNamePattern.exec(content)) !== null) {
    violations.push({
      file: fileName,
      propertyName: m[1],
      activityType: "<attribute-name>",
      sentinelValue: m[1],
      sentinelCategory: categorizeSentinel(m[1]),
      origin: "genuine",
      originReason: "sentinel in attribute name (forbidden position)",
      classification: "genuine-structural-violation",
      classificationReason: "sentinel cannot legally appear in attribute name position",
    });
  }
  // Namespace prefix declaration: xmlns:TODO_X="..."
  const nsPrefixPattern = /\bxmlns:((?:TODO|PLACEHOLDER|STUB|HANDOFF)[A-Za-z0-9_]*)\s*=/g;
  while ((m = nsPrefixPattern.exec(content)) !== null) {
    violations.push({
      file: fileName,
      propertyName: `xmlns:${m[1]}`,
      activityType: "<namespace-declaration>",
      sentinelValue: m[1],
      sentinelCategory: categorizeSentinel(m[1]),
      origin: "genuine",
      originReason: "sentinel in namespace prefix (forbidden position)",
      classification: "genuine-structural-violation",
      classificationReason: "sentinel cannot legally appear in namespace prefix position",
    });
  }
  // Task #528: x:Key attribute VALUE — invoke-binding key position. The
  // broad scanner skips x:Key entirely; we scan it explicitly here.
  const xKeyValuePattern = /\bx:Key\s*=\s*"([^"]+)"/g;
  while ((m = xKeyValuePattern.exec(content)) !== null) {
    const val = m[1];
    if (isSentinelValue(val)) {
      violations.push({
        file: fileName,
        propertyName: "x:Key",
        activityType: "<invoke-binding-key>",
        sentinelValue: val,
        sentinelCategory: categorizeSentinel(val),
        origin: "genuine",
        originReason: "sentinel in invoke-binding key (x:Key) value position — #530 territory",
        classification: "genuine-structural-violation",
        classificationReason: "sentinel cannot legally appear in invoke-binding key value",
      });
    }
  }
}

function broadScanForSentinels(
  content: string,
  fileName: string,
  violations: PreComplianceGuardViolation[],
): void {
  const attrPattern = /(\w+)="([^"]*)"/g;
  let match;
  while ((match = attrPattern.exec(content)) !== null) {
    const propName = match[1];
    const rawValue = match[2];
    if (propName === "xmlns" || propName.startsWith("xmlns:") || propName === "x:Class" || propName === "x:Key") continue;
    const unwrapped = rawValue.replace(/^\[|\]$/g, "").trim();
    if (isSentinelValue(rawValue) || isSentinelValue(unwrapped)) {
      violations.push({
        file: fileName,
        propertyName: propName,
        activityType: "unknown",
        sentinelValue: rawValue,
        sentinelCategory: categorizeSentinel(unwrapped),
      });
    }
  }
}

export function applyRequiredPropertyEnforcement(
  xamlEntries: { name: string; content: string }[],
  isPackageMode: boolean = true,
): {
  entries: { name: string; content: string }[];
  enforcementResult: RequiredPropertyEnforcementResult;
  guardResult: PreComplianceGuardResult;
} {
  const enforcementResult = enforceRequiredProperties(xamlEntries, isPackageMode);

  if (isPackageMode) {
    const globalLoweringFailures: ExpressionLoweringFailure[] = [];
    const updatedEntries = xamlEntries.map(entry => {
      let content = entry.content;
      content = stripSentinelValuesFromRequiredProperties(content);
      content = injectResolvedPropertyBindings(content, enforcementResult.requiredPropertyBindings, entry.name);
      content = lowerStructuredExpressionsPerProperty(content, enforcementResult.expressionLoweringFixes, entry.name);
      content = lowerStructuredExpressionsInContent(content, entry.name, globalLoweringFailures);
      return { ...entry, content };
    });

    if (globalLoweringFailures.length > 0) {
      enforcementResult.expressionLoweringFailures.push(...globalLoweringFailures);
      enforcementResult.totalDefects += globalLoweringFailures.length;
      if (globalLoweringFailures.some(f => f.severity === "execution_blocking")) {
        enforcementResult.hasBlockingDefects = true;
      }
    }

    // Task #528: construction-site origin tagging for required-property
    // and expression-lowering defects. We tag here at the producer's
    // exit boundary (which is functionally construction-site for the
    // module's external surface) so every defect leaves this producer
    // already carrying origin metadata. The retrospective backstop in
    // final-artifact-validation.ts only fires (and warns) when this
    // tagging is missed.
    for (const d of enforcementResult.unresolvedRequiredPropertyDefects) {
      if (d.origin) continue;
      const c = classifyDefectOrigin(d.originalValue, `required-property:${d.activityType}.${d.propertyName}`);
      d.origin = c.origin;
      d.originReason = c.originReason;
    }
    for (const f of enforcementResult.expressionLoweringFailures) {
      if (f.origin) continue;
      const c = classifyDefectOrigin(f.originalValue, `expression-lowering:${f.activityType}.${f.propertyName}`);
      f.origin = c.origin;
      f.originReason = c.originReason;
    }

    const guardResult = runPreCompliancePackageModeGuard(updatedEntries);

    return { entries: updatedEntries, enforcementResult, guardResult };
  }

  return {
    entries: xamlEntries,
    enforcementResult,
    guardResult: { passed: true, violations: [], summary: "Not package mode — guard skipped" },
  };
}

export function injectResolvedPropertyBindings(
  content: string,
  bindings: RequiredPropertyBinding[],
  entryName: string,
): string {
  let result = content;
  const fileName = entryName.split("/").pop() || entryName;

  const INJECTABLE_SOURCE_KINDS = new Set([
    "contract-default", "workflowArgument", "variable", "invokeOutput",
    "priorStepOutput", "contractMapping", "context-derived",
  ]);

  const missingBindings = bindings.filter(
    b => b.file === fileName && INJECTABLE_SOURCE_KINDS.has(b.sourceBinding) && b.resolvedValue && b.originalValue === "",
  );

  for (const binding of missingBindings) {
    const tagPattern = new RegExp(`(<(?:[a-z]+:)?${binding.activityType}\\s)([^>]*?)(/?>)`, "g");
    let matchIdx = 0;
    result = result.replace(tagPattern, (match, prefix: string, attrs: string, closing: string) => {
      const currentIdx = matchIdx++;
      if (currentIdx !== binding.occurrenceIndex) return match;
      const attrBoundary = new RegExp(`(?:^|\\s)${binding.propertyName}="`);
      if (attrBoundary.test(attrs)) {
        const emptyAttrRegex = new RegExp(`((?:^|\\s)${binding.propertyName}=")(")`);
        if (emptyAttrRegex.test(attrs)) {
          const replaced = attrs.replace(emptyAttrRegex, `$1${binding.resolvedValue}$2`);
          return `${prefix}${replaced}${closing}`;
        }
        return match;
      }
      return `${prefix}${attrs} ${binding.propertyName}="${binding.resolvedValue}"${closing}`;
    });
  }

  const replacementBindings = bindings.filter(
    b => b.file === fileName && INJECTABLE_SOURCE_KINDS.has(b.sourceBinding) && b.resolvedValue && b.originalValue !== "" && b.resolvedValue !== b.originalValue,
  );

  for (const binding of replacementBindings) {
    const tagPattern = new RegExp(`(<(?:[a-z]+:)?${binding.activityType}\\s)([^>]*?)(/?>)`, "g");
    let matchIdx = 0;
    result = result.replace(tagPattern, (match, prefix: string, attrs: string, closing: string) => {
      const currentIdx = matchIdx++;
      if (currentIdx !== binding.occurrenceIndex) return match;
      const escaped = binding.originalValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const attrRegex = new RegExp(`((?:^|\\s)${binding.propertyName}=")${escaped}(")`);
      const replaced = attrs.replace(attrRegex, `$1${binding.resolvedValue}$2`);
      return `${prefix}${replaced}${closing}`;
    });
  }

  return result;
}

function lowerStructuredExpressionsPerProperty(
  content: string,
  fixes: ExpressionLoweringFix[],
  entryName: string,
): string {
  let result = content;
  const fileName = entryName.split("/").pop() || entryName;

  const relevantFixes = fixes.filter(f => f.file === fileName);

  for (const fix of relevantFixes) {
    if (fix.originalValue && fix.resolvedValue && fix.originalValue !== fix.resolvedValue) {
      const escaped = fix.originalValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const tagPattern = new RegExp(`(<(?:[a-z]+:)?${fix.activityType}\\s)([^>]*?)(/?>)`, "g");
      let matchIdx = 0;
      result = result.replace(tagPattern, (match, prefix: string, attrs: string, closing: string) => {
        const currentIdx = matchIdx++;
        if (currentIdx !== fix.occurrenceIndex) return match;
        const attrRegex = new RegExp(`((?:^|\\s)${fix.propertyName}=")${escaped}(")`);
        const replaced = attrs.replace(attrRegex, `$1${fix.resolvedValue}$2`);
        return `${prefix}${replaced}${closing}`;
      });
    }
  }

  return result;
}

function stripSentinelValuesFromRequiredProperties(content: string): string {
  let result = content;

  const sentinelAttrPattern = /\s+\w+="(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?|HANDOFF(?:_\w*)?|\[(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?)\])"/gi;
  result = result.replace(sentinelAttrPattern, '');

  const childSentinelPattern = /(<\w+(?::\w+)?\.\w+[^>]*>)\s*(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?|HANDOFF(?:_\w*)?|\[(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?)\])\s*(<\/\w+(?::\w+)?\.\w+>)/gi;
  result = result.replace(childSentinelPattern, '$1$2');

  return result;
}

function extractBalancedBraceBlock(content: string, startIdx: number): string | null {
  if (content[startIdx] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"' && !escaped) { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return content.substring(startIdx, i + 1);
    }
  }
  return null;
}

function lowerBalancedJsonValueIntents(
  content: string,
  fileName: string,
  workflowName: string,
  failures?: ExpressionLoweringFailure[],
): string {
  const typeMarker = /"type"\s*:\s*"(?:url_with_params|expression|variable|literal|vb_expression)"/;
  let result = content;
  let searchFrom = 0;

  while (searchFrom < result.length) {
    const braceIdx = result.indexOf('{"type"', searchFrom);
    if (braceIdx === -1) break;

    const block = extractBalancedBraceBlock(result, braceIdx);
    if (!block) { searchFrom = braceIdx + 1; continue; }
    if (!typeMarker.test(block)) { searchFrom = braceIdx + block.length; continue; }

    const optionalBracketStart = braceIdx > 0 && result[braceIdx - 1] === '[';
    const optionalBracketEnd = braceIdx + block.length < result.length && result[braceIdx + block.length] === ']';
    const fullMatch = optionalBracketStart && optionalBracketEnd
      ? result.substring(braceIdx - 1, braceIdx + block.length + 1)
      : block;
    const matchStart = optionalBracketStart && optionalBracketEnd ? braceIdx - 1 : braceIdx;

    const jsonResult = tryParseJsonValueIntent(fullMatch);
    if (jsonResult) {
      try {
        const built = buildExpression(jsonResult.intent);
        if (built && !isSentinelValue(built)) {
          result = result.substring(0, matchStart) + built + result.substring(matchStart + fullMatch.length);
          searchFrom = matchStart + built.length;
          continue;
        }
      } catch {}
      if (failures) {
        failures.push({
          file: fileName,
          workflow: workflowName,
          activityType: "unknown",
          propertyName: "unknown",
          originalValue: fullMatch.substring(0, 200),
          failureReason: `Balanced JSON lowering failed for structured expression in ${fileName}`,
          severity: "execution_blocking",
          packageModeOutcome: "structured_defect",
        });
      }
    }
    searchFrom = braceIdx + block.length;
  }
  return result;
}

function lowerStructuredExpressionsInContent(
  content: string,
  entryName?: string,
  failures?: ExpressionLoweringFailure[],
): string {
  let result = content;
  const fileName = entryName ? (entryName.split("/").pop() || entryName) : "unknown";
  const workflowName = fileName.replace(/\.xaml$/i, "");

  const viPatterns = [
    /\{"type":"[^"]*","value":"([^"]*)"\}/g,
    /\{&quot;type&quot;:&quot;[^&]*&quot;,&quot;value&quot;:&quot;([^&]*)&quot;\}/g,
    /\{"type"\s*:\s*"expression"\s*,\s*"left"\s*:\s*"[^"]*"\s*,\s*"operator"\s*:\s*"[^"]*"\s*,\s*"right"\s*:\s*"[^"]*"\s*\}/g,
    /\{"type"\s*:\s*"variable"\s*,\s*"name"\s*:\s*"[^"]*"\s*\}/g,
    /\{"name"\s*:\s*"[^"]*"\s*,\s*"type"\s*:\s*"variable"\s*\}/g,
    /\{&quot;type&quot;\s*:\s*&quot;expression&quot;\s*,\s*&quot;left&quot;\s*:\s*&quot;[^&]*&quot;\s*,\s*&quot;operator&quot;\s*:\s*&quot;[^&]*&quot;\s*,\s*&quot;right&quot;\s*:\s*&quot;[^&]*&quot;\s*\}/g,
    /\{&quot;type&quot;\s*:\s*&quot;variable&quot;\s*,\s*&quot;name&quot;\s*:\s*&quot;[^&]*&quot;\s*\}/g,
    /\[?\{"type"\s*:\s*"[^"]*"[^}]*\}\]?/g,
  ];

  for (const pattern of viPatterns) {
    const regex = new RegExp(pattern.source, "g");
    result = result.replace(regex, (fullMatch) => {
      const jsonResult = tryParseJsonValueIntent(fullMatch);
      if (jsonResult) {
        try {
          const built = buildExpression(jsonResult.intent);
          if (built && !isSentinelValue(built)) {
            return built;
          }
        } catch {
        }
      }
      if (failures) {
        failures.push({
          file: fileName,
          workflow: workflowName,
          activityType: "unknown",
          propertyName: "unknown",
          originalValue: fullMatch,
          failureReason: `Global lowering failed for structured expression in ${fileName}`,
          severity: "execution_blocking",
          packageModeOutcome: "structured_defect",
        });
      }
      return fullMatch;
    });
  }

  result = lowerBalancedJsonValueIntents(result, fileName, workflowName, failures);

  return result;
}

const MAIL_ACTIVITY_BODY_TAGS: Record<string, string> = {
  "SendSmtpMailMessage": "umail",
  "GmailSendMessage": "ugs",
  "SendOutlookMailMessage": "umail",
};

function wrapBodyValueForXaml(val: string): string {
  if (/^\[.*\]$/.test(val.trim())) return val;
  if (/^[a-zA-Z_]\w*$/.test(val.trim())) return `[${val}]`;
  if (/^".*"$/.test(val.trim())) return val;
  return `"${val}"`;
}

export function repairMailBodyAttributes(content: string): { content: string; repaired: boolean; repairs: string[] } {
  const repairs: string[] = [];
  let result = content;

  for (const [activityName, prefix] of Object.entries(MAIL_ACTIVITY_BODY_TAGS)) {
    const prefixedTag = `${prefix}:${activityName}`;
    const escapedPrefixedTag = prefixedTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedActivityName = activityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const tagPatterns = [escapedPrefixedTag, `ui:${escapedActivityName}`];

    for (const tagPat of tagPatterns) {
      const selfClosingRegex = new RegExp(
        `(<${tagPat}\\s[^>]*?)\\bBody="([^"]*)"([^>]*?)\\s*\\/>`,
        "g"
      );
      result = result.replace(selfClosingRegex, (_match, before, bodyVal, after) => {
        const wrappedBody = wrapBodyValueForXaml(bodyVal);
        const fullTag = before.includes(`${prefix}:`) ? prefixedTag : `ui:${activityName}`;
        const childElement = `<${fullTag}.Body>\n            <InArgument x:TypeArguments="x:String">${wrappedBody}</InArgument>\n          </${fullTag}.Body>`;
        repairs.push(`Converted Body attribute to child element on ${fullTag}`);
        return `${before}${after}>\n          ${childElement}\n        </${fullTag}>`;
      });

      const openTagRegex = new RegExp(
        `(<${tagPat}\\s[^>]*?)\\bBody="([^"]*)"([^>]*?>)([\\s\\S]*?<\\/${tagPat}>)`,
        "g"
      );
      result = result.replace(openTagRegex, (_match, before, bodyVal, after, innerAndClose) => {
        const nodeLocalChildBody = new RegExp(`<(?:[\\w]+:)?${escapedActivityName}\\.Body[\\s>]`).test(innerAndClose);
        if (nodeLocalChildBody) {
          repairs.push(`Removed duplicate Body attribute on ${activityName} (child element already exists)`);
          return `${before}${after}${innerAndClose}`;
        }
        const wrappedBody = wrapBodyValueForXaml(bodyVal);
        const fullTag = before.includes(`${prefix}:`) ? prefixedTag : `ui:${activityName}`;
        const childElement = `<${fullTag}.Body>\n            <InArgument x:TypeArguments="x:String">${wrappedBody}</InArgument>\n          </${fullTag}.Body>`;
        repairs.push(`Converted Body attribute to child element on ${fullTag}`);
        return `${before}${after}\n          ${childElement}${innerAndClose}`;
      });
    }
  }

  return { content: result, repaired: repairs.length > 0, repairs };
}
