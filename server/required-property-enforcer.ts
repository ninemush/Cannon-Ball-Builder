import { catalogService, type CatalogProperty, type ActivitySchema } from "./catalog/catalog-service";
import { tryParseJsonValueIntent, buildExpression, type ValueIntent, recordExpressionLoweringDiagnostic } from "./xaml/expression-builder";

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
  return FALLBACK_ELIGIBLE_POLICIES.find(
    p => p.activityType === activityType && p.propertyName === propertyName,
  ) || null;
}

export interface RequiredPropertyEnforcementResult {
  requiredPropertyBindings: RequiredPropertyBinding[];
  unresolvedRequiredPropertyDefects: UnresolvedRequiredPropertyDefect[];
  expressionLoweringFixes: ExpressionLoweringFix[];
  expressionLoweringFailures: ExpressionLoweringFailure[];
  invalidRequiredPropertySubstitutions: InvalidRequiredPropertySubstitution[];
  fallbackResolutionDiagnostics: FallbackResolutionDiagnostic[];
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
    return trimmed === "Nothing" || trimmed === "null";
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
    enforceForFile(entry, fileName, workflowName, isPackageMode, bindings, defects, exprFixes, exprFailures, invalidSubstitutions, upstreamSources, fallbackDiagnostics);
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

  return {
    requiredPropertyBindings: bindings,
    unresolvedRequiredPropertyDefects: defects,
    expressionLoweringFixes: exprFixes,
    expressionLoweringFailures: exprFailures,
    invalidRequiredPropertySubstitutions: invalidSubstitutions,
    fallbackResolutionDiagnostics: fallbackDiagnostics,
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

      const attrBoundaryPattern = new RegExp(`(?:^|\\s)${propDef.name}="`);
      const attrPresent = attrBoundaryPattern.test(attrStr);
      const childPresent = bodySection.includes(`${activityTag}.${propDef.name}`);
      if (!attrPresent && !childPresent) {
        handleMissingRequiredProperty(
          fileName, workflowName, strippedTag, propDef, isPackageMode,
          bindings, defects, currentOccurrence, mergedSources, fallbackDiagnostics,
          activityDisplayName,
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
            activityDisplayName,
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
              activityDisplayName,
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

function tryContextDerivedFallback(
  activityType: string,
  propertyName: string,
  context: ContextDerivedFallbackContext,
  policy: FallbackEligiblePolicy | null,
): { value: string; spec: ContextDerivedFallbackSpec } | null {
  if (!policy || !policy.contextDerivedFallbackAllowed) return null;

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

  const fallback = hasContractValidFallback(prop);
  if (fallback.valid && fallback.fallbackValue) {
    if (policy) {
      const isDisallowedGeneric = policy.blockOnGenericDefault && policy.genericDefaultValues.includes(fallback.fallbackValue);
      if (isDisallowedGeneric || !policy.fallbackAllowed) {
        const policyBlockedContextFallback = tryContextDerivedFallback(
          activityType, prop.name, {
            displayName,
            fileName,
            workflowName,
            activityType,
            propertyName: prop.name,
          },
          policy,
        );
        if (policyBlockedContextFallback) {
          bindings.push({
            file: fileName,
            workflow: workflowName,
            activityType,
            propertyName: prop.name,
            sourceBinding: "context-derived",
            originalValue: "",
            resolvedValue: policyBlockedContextFallback.value,
            severity: "info",
            packageModeOutcome: "bound",
            occurrenceIndex,
            provenance: {
              sourceKind: "context-derived",
              sourceName: `${activityType}.${prop.name}.context-derived`,
              precedenceTier: 7,
            },
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
          fallbackDiagnostics.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            propertyClass: policy.propertyClass, decision: "context-derived-fallback",
            sourceFound: false, expressionLowered: null, fallbackApplied: true,
            blockReason: null, originalValue: "", resolvedValue: policyBlockedContextFallback.value,
          });
          console.log(`[RequiredPropertyEnforcer] CONTEXT-DERIVED-FALLBACK: ${activityType}.${prop.name} in ${fileName} — tier 7 applied (policy-blocked recovery): ${policyBlockedContextFallback.value}`);
          return;
        }

        if (isPackageMode) {
          const reason = isDisallowedGeneric
            ? `Contract fallback "${fallback.fallbackValue}" is a disallowed generic default for ${policy.propertyClass}`
            : `Fallback not allowed by policy for ${policy.propertyClass} — contract fallback "${fallback.fallbackValue}" rejected`;
          defects.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            failureReason: `Required property "${prop.name}" on ${activityType} has no valid source — ${reason}`,
            originalValue: "",
            severity: "execution_blocking", packageModeOutcome: "structured_defect",
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
          fallbackDiagnostics.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            propertyClass: policy.propertyClass, decision: "blocked",
            sourceFound: false, expressionLowered: null, fallbackApplied: false,
            blockReason: reason,
            originalValue: "", resolvedValue: null,
          });
          console.warn(`[RequiredPropertyEnforcer] FALLBACK-POLICY-BLOCKED: ${activityType}.${prop.name} in ${fileName} — ${reason}`);
        }
        return;
      }
    }

    bindings.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      sourceBinding: "contract-default",
      originalValue: "",
      resolvedValue: fallback.fallbackValue,
      severity: "info",
      packageModeOutcome: "bound",
      occurrenceIndex,
      provenance: {
        sourceKind: "contract-default",
        sourceName: `${activityType}.${prop.name}.default`,
        precedenceTier: 6,
      },
      rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
    });
    if (policy) {
      fallbackDiagnostics.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        propertyClass: policy.propertyClass, decision: "fallback-applied",
        sourceFound: false, expressionLowered: null, fallbackApplied: true,
        blockReason: null, originalValue: "", resolvedValue: fallback.fallbackValue,
      });
    }
    return;
  }

  const contextFallbackResult = tryContextDerivedFallback(
    activityType, prop.name, {
      displayName,
      fileName,
      workflowName,
      activityType,
      propertyName: prop.name,
    },
    policy,
  );
  if (contextFallbackResult) {
    bindings.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      sourceBinding: "context-derived",
      originalValue: "",
      resolvedValue: contextFallbackResult.value,
      severity: "info",
      packageModeOutcome: "bound",
      occurrenceIndex,
      provenance: {
        sourceKind: "context-derived",
        sourceName: `${activityType}.${prop.name}.context-derived`,
        precedenceTier: 7,
      },
      rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
    });
    if (policy) {
      fallbackDiagnostics.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        propertyClass: policy.propertyClass, decision: "context-derived-fallback",
        sourceFound: false, expressionLowered: null, fallbackApplied: true,
        blockReason: null, originalValue: "", resolvedValue: contextFallbackResult.value,
      });
    }
    console.log(`[RequiredPropertyEnforcer] CONTEXT-DERIVED-FALLBACK: ${activityType}.${prop.name} in ${fileName} — tier 7 applied: ${contextFallbackResult.value}`);
    return;
  }

  if (isPackageMode) {
    const blockReason = policy
      ? `Required property "${prop.name}" on ${activityType} has no valid source binding and no allowed fallback per policy for ${policy.propertyClass}`
      : `Required property "${prop.name}" on ${activityType} has no valid source binding and no contract-valid fallback`;
    defects.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      failureReason: blockReason,
      originalValue: "",
      severity: "execution_blocking",
      packageModeOutcome: "structured_defect",
      rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
    });
    if (policy) {
      fallbackDiagnostics.push({
        file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
        propertyClass: policy.propertyClass, decision: "blocked",
        sourceFound: false, expressionLowered: null, fallbackApplied: false,
        blockReason, originalValue: "", resolvedValue: null,
      });
    }
    console.warn(`[RequiredPropertyEnforcer] DEFECT: ${activityType}.${prop.name} in ${fileName} — no contract-valid fallback, blocking`);
  }
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
    if (policy && policy.blockOnGenericDefault) {
      const genericValue = isGenericRaw ? rawValue : unwrappedValue;
      if (policy.genericDefaultValues.includes(genericValue)) {
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
          fallbackDiagnostics.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            propertyClass: policy.propertyClass, decision: "source-bound",
            sourceFound: true, expressionLowered: null, fallbackApplied: false,
            blockReason: null, originalValue: rawValue, resolvedValue,
          });
          console.log(`[RequiredPropertyEnforcer] FALLBACK-POLICY SOURCE-RESOLVED: ${activityType}.${prop.name} in ${fileName} — replaced disallowed generic default "${rawValue}" with ${resolved.sourceKind}:${resolved.sourceName}`);
          return;
        }

        const genericContextFallback = tryContextDerivedFallback(
          activityType, prop.name, {
            displayName,
            fileName,
            workflowName,
            activityType,
            propertyName: prop.name,
          },
          policy,
        );
        if (genericContextFallback) {
          bindings.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            sourceBinding: "context-derived", originalValue: rawValue,
            resolvedValue: genericContextFallback.value,
            severity: "info", packageModeOutcome: "bound", occurrenceIndex,
            provenance: {
              sourceKind: "context-derived",
              sourceName: `${activityType}.${prop.name}.context-derived`,
              precedenceTier: 7,
            },
            rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
          });
          fallbackDiagnostics.push({
            file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
            propertyClass: policy.propertyClass, decision: "context-derived-fallback",
            sourceFound: false, expressionLowered: null, fallbackApplied: true,
            blockReason: null, originalValue: rawValue, resolvedValue: genericContextFallback.value,
          });
          console.log(`[RequiredPropertyEnforcer] CONTEXT-DERIVED-FALLBACK: ${activityType}.${prop.name} in ${fileName} — tier 7 replaced disallowed generic default "${rawValue}": ${genericContextFallback.value}`);
          return;
        }

        invalidSubstitutions.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          attemptedValue: rawValue,
          reasonRejected: `Generic default "${rawValue}" is disallowed by fallback policy for ${policy.propertyClass} — no valid upstream source found`,
          expectedSourceKinds: ["workflowArgument", "variable", "invokeOutput", "priorStepOutput", "contractMapping"],
          packageModeOutcome: "blocked",
        });
        defects.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          failureReason: `Required property "${prop.name}" on ${activityType} contains disallowed generic default "${rawValue}" per fallback policy for ${policy.propertyClass} — no valid source found`,
          originalValue: rawValue,
          severity: "execution_blocking", packageModeOutcome: "structured_defect",
          rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
        });
        fallbackDiagnostics.push({
          file: fileName, workflow: workflowName, activityType, propertyName: prop.name,
          propertyClass: policy.propertyClass, decision: "blocked",
          sourceFound: false, expressionLowered: null, fallbackApplied: false,
          blockReason: `Generic default "${rawValue}" disallowed by policy for ${policy.propertyClass} — no valid upstream source`,
          originalValue: rawValue, resolvedValue: null,
        });
        console.warn(`[RequiredPropertyEnforcer] FALLBACK-POLICY BLOCKED: ${activityType}.${prop.name} = "${rawValue}" in ${fileName} — disallowed generic default, no source available`);
        return;
      }
    }

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
        originalValue: rawValue,
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
      console.log(`[RequiredPropertyEnforcer] SOURCE-RESOLVED (replaced generic default): ${activityType}.${prop.name} in ${fileName} — bound to ${resolved.sourceKind}:${resolved.sourceName} (tier ${resolved.precedenceTier})`);
      return;
    }

    if (isDocumentedContractGenericDefault(prop, isGenericRaw ? rawValue : unwrappedValue)) {
      bindings.push({
        file: fileName,
        workflow: workflowName,
        activityType,
        propertyName: prop.name,
        sourceBinding: "contract-default",
        originalValue: rawValue,
        resolvedValue: rawValue,
        severity: "info",
        packageModeOutcome: "bound",
        occurrenceIndex,
        provenance: {
          sourceKind: "contract-default",
          sourceName: `${activityType}.${prop.name}.default`,
          precedenceTier: 6,
        },
        rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
      });
      console.log(`[RequiredPropertyEnforcer] DOCUMENTED-GENERIC-DEFAULT ACCEPTED: ${activityType}.${prop.name} in ${fileName} — catalog explicitly documents this generic default`);
      return;
    }

    invalidSubstitutions.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      attemptedValue: rawValue,
      reasonRejected: `Generic type default "${rawValue}" for ${prop.clrType} is not resolvable from upstream sources and is not a documented contract fallback for ${activityType}.${prop.name}`,
      expectedSourceKinds: ["workflowArgument", "variable", "invokeOutput", "priorStepOutput", "contractMapping"],
      packageModeOutcome: "blocked",
    });
    defects.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      propertyName: prop.name,
      failureReason: `Required property "${prop.name}" on ${activityType} contains generic type default "${rawValue}" — source resolution attempted but no valid upstream source found — invalid substitution blocked`,
      originalValue: rawValue,
      severity: "execution_blocking",
      packageModeOutcome: "structured_defect",
      rejectedCandidates: sourceResolution.rejectedCandidates.length > 0 ? sourceResolution.rejectedCandidates : undefined,
    });
    console.warn(`[RequiredPropertyEnforcer] INVALID SUBSTITUTION BLOCKED: ${activityType}.${prop.name} = "${rawValue}" in ${fileName} — source resolution failed, generic default not contract-valid`);
    return;
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
}

export function runPreCompliancePackageModeGuard(
  xamlEntries: { name: string; content: string }[],
): PreComplianceGuardResult {
  const violations: PreComplianceGuardViolation[] = [];

  if (!catalogService.isLoaded()) {
    const broadViolations: PreComplianceGuardViolation[] = [];
    for (const entry of xamlEntries) {
      const fileName = entry.name.split("/").pop() || entry.name;
      broadScanForSentinels(entry.content, fileName, broadViolations);
    }
    return {
      passed: broadViolations.length === 0,
      violations: broadViolations,
      summary: broadViolations.length === 0
        ? "Pre-compliance guard passed (catalog unavailable — broad sentinel scan used)"
        : `Pre-compliance guard FAILED: ${broadViolations.length} sentinel value(s) found via broad scan (catalog unavailable)`,
    };
  }

  for (const entry of xamlEntries) {
    const fileName = entry.name.split("/").pop() || entry.name;
    scanForSentinels(entry.content, fileName, violations);
  }

  return {
    passed: violations.length === 0,
    violations,
    summary: violations.length === 0
      ? "Pre-compliance guard passed — no sentinel values in required properties"
      : `Pre-compliance guard FAILED: ${violations.length} sentinel value(s) found in required executable properties`,
  };
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

    const guardResult = runPreCompliancePackageModeGuard(updatedEntries);

    return { entries: updatedEntries, enforcementResult, guardResult };
  }

  return {
    entries: xamlEntries,
    enforcementResult,
    guardResult: { passed: true, violations: [], summary: "Not package mode — guard skipped" },
  };
}

function injectResolvedPropertyBindings(
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
      if (attrBoundary.test(attrs)) return match;
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
