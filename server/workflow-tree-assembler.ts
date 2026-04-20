import type {
  WorkflowNode,
  WorkflowSpec,
  VariableDeclaration,
  ActivityNode,
  SequenceNode,
  TryCatchNode,
  IfNode,
  WhileNode,
  ForEachNode,
  RetryScopeNode,
  PropertyValue,
} from "./workflow-spec-types";
import { BLOCKED_PROPERTY_SENTINEL, isBlockedPropertyValue, isBlockedSentinel } from "./types/uipath-package";
import { resolveToScalarString } from "./xaml/deterministic-generators";
import { catalogService } from "./catalog/catalog-service";
import { getFilteredSchema, registerStage } from "./catalog/filtered-schema-lookup";
import { inferTypeFromPrefix, PREFIXED_VAR_REF_REGEX, DEMOTION_WHITELIST_REGEX } from "./shared/type-inference";

registerStage("workflow-tree-assembler");
import type { ActivityValidationResult, ValidationCorrection } from "./catalog/catalog-service";
import { buildTemplateBlock } from "./catalog/xaml-template-builder";
import type { ProcessType } from "./catalog/catalog-service";
import { escapeXml, escapeXmlExpression, normalizeXmlExpression, escapeXmlTextContent, serializeSafeAttributeValue } from "./lib/xml-utils";
import { XMLValidator } from "fast-xml-parser";
import { buildExpression, isValueIntent, normalizeStringToExpression, normalizePropertyToValueIntent, tryParseJsonValueIntent, emitJsonResolutionDiagnostic, resolveValueIntentJsonString, containsValueIntentJson, sweepAttributeValueForJsonIntents, type ValueIntent } from "./xaml/expression-builder";
import { emitPropertySerializationTrace, computeContentHash } from "./pipeline-trace-collector";
import { validateMapClrTypeOutput, reportCriticalTypeDiagnostic } from "./emission-gate";
import { getActivityTag, getActivityPrefixStrict, injectMissingNamespaceDeclarations, ensureBracketWrapped, smartBracketWrap, looksLikePlainText, BARE_WORD_LITERALS_SET, CLR_NAMESPACE_TO_XAML_PREFIX } from "./xaml/xaml-compliance";
import { lintExpression } from "./xaml/vbnet-expression-linter";
import type { RemediationEntry, RemediationCode } from "./uipath-pipeline";
import { PROPERTY_REMEDIATION_ESCALATION_THRESHOLD } from "./uipath-pipeline";
import { DeclarationRegistry, scopeIdMatchesStackEntryExternal, type SymbolDiscoveryDiagnostic, type ExpressionContextEvidence } from "./declaration-registry";
import { isExcludedSymbolToken } from "./shared/symbol-exclusions";
import { sanitizePlaceholderForAttribute, sanitizePlaceholderForVbExpression, makeTodoTextPlaceholder } from "./lib/placeholder-sanitizer";
import { sanitizeAttributeNameKey } from "./lib/todo-attribute-guard";
import { dispatchGenerator, hasGenerator, resolveTemplateName } from "./xaml/generator-registry";
import { normalizeWorkflowTreeForGenerators, getAndClearNormalizationDiagnostics } from "./spec-ir-normalizer";
import { buildRootActivityAttr as _buildRootActivityAttr, buildRootActivityChildren as _buildRootActivityChildren, buildTextExpressionBlocks as _buildTextExpressionBlocksShared } from "./xaml/xaml-studio-references";

export interface PropertyRemediationRecord {
  propertyName: string;
  remediationCode: RemediationCode;
  reason: string;
  originalValue: string;
  replacementValue: string;
}

export class CSharpExpressionBlockedError extends Error {
  public readonly syntaxType: string;
  public readonly expression: string;
  constructor(syntaxType: string, expression: string) {
    super(`Unconvertible C# syntax (${syntaxType}) blocked: "${expression}"`);
    this.name = "CSharpExpressionBlockedError";
    this.syntaxType = syntaxType;
    this.expression = expression;
  }
}

export interface AssemblyRemediationContext {
  fileName: string;
  propertyRemediations: RemediationEntry[];
  escalationThreshold: number;
}

export interface ResidualJsonDefect {
  templateName: string;
  displayName: string;
  propertyName: string;
  rawPayload: string;
}

export interface TemplateDispatchNormalizationRecord {
  originalTemplate: string;
  normalizedDispatchKey: string;
  displayName: string;
  inRequiredPropertyGuaranteeMap: boolean;
  requiredPropertyGuaranteed: string[];
  confirmedPairDetail?: {
    sourcePresent: boolean;
    valueSource: "upstream" | "fallback";
    fallbackApplied: boolean;
    chosenValue: string;
  };
}

const NORMALIZATION_BUFFER_LIMIT = 200;
let _templateDispatchNormalizations: TemplateDispatchNormalizationRecord[] = [];

export function getAndClearTemplateDispatchNormalizations(): TemplateDispatchNormalizationRecord[] {
  const records = [..._templateDispatchNormalizations];
  _templateDispatchNormalizations = [];
  return records;
}

export function getTemplateDispatchNormalizations(): TemplateDispatchNormalizationRecord[] {
  return [..._templateDispatchNormalizations];
}

let _activeRemediationContext: AssemblyRemediationContext | null = null;
let _activeDeclarationLookup: ((name: string) => boolean) | null = null;
let _activeTargetFramework: "Windows" | "Portable" = "Windows";
let _lateDiscoveredVariables: VariableDeclaration[] = [];
let _residualJsonDefects: ResidualJsonDefect[] = [];

export interface WorkflowContractArgument {
  name: string;
  direction: "InArgument" | "OutArgument" | "InOutArgument";
  type: string;
}

export interface WorkflowContract {
  workflowName: string;
  arguments: WorkflowContractArgument[];
}

export type WorkflowContractMap = Map<string, WorkflowContract>;

export interface ContractDiagnostic {
  kind: "unresolved_callee" | "unsupported_binding";
  callerWorkflow: string;
  calleeFile: string;
  bindingName?: string;
  reason: string;
}

let _activeWorkflowContractMap: WorkflowContractMap | null = null;
let _contractDiagnostics: ContractDiagnostic[] = [];
let _activeCallerWorkflowName: string = "";

export function setActiveWorkflowContractMap(map: WorkflowContractMap): void {
  _activeWorkflowContractMap = map;
}

export function clearActiveWorkflowContractMap(): void {
  _activeWorkflowContractMap = null;
}

export function setActiveCallerWorkflowName(name: string): void {
  _activeCallerWorkflowName = name;
}

export function getAndClearContractDiagnostics(): ContractDiagnostic[] {
  const diags = _contractDiagnostics;
  _contractDiagnostics = [];
  return diags;
}

export function getContractDiagnostics(): ReadonlyArray<ContractDiagnostic> {
  return _contractDiagnostics;
}

export function buildPreEmissionContractMap(
  specs: Array<{ name: string; spec: { arguments?: Array<{ name: string; direction: string; type: string; required?: boolean }> } }>
): WorkflowContractMap {
  const map: WorkflowContractMap = new Map();
  for (const entry of specs) {
    const rawName = (entry.name || "").replace(/\s+/g, "_");
    const wfFileName = rawName.endsWith(".xaml") ? rawName : `${rawName}.xaml`;
    const args: WorkflowContractArgument[] = [];
    if (entry.spec.arguments && Array.isArray(entry.spec.arguments)) {
      for (const arg of entry.spec.arguments) {
        const dir = arg.direction as "InArgument" | "OutArgument" | "InOutArgument";
        if (dir === "InArgument" || dir === "OutArgument" || dir === "InOutArgument") {
          args.push({ name: arg.name, direction: dir, type: arg.type || "" });
        }
      }
    }
    map.set(wfFileName.toLowerCase(), { workflowName: rawName, arguments: args });
  }
  return map;
}

function stripDirectionPrefix(name: string): string {
  const underscoreStripped = name.replace(/^(in_|out_|io_)/i, "");
  if (underscoreStripped !== name) return underscoreStripped;
  const pascalMatch = name.match(/^(In|Out|Io|InOut)([A-Z].*)/);
  if (pascalMatch) return pascalMatch[2];
  return name;
}

function resolveBindingAgainstContract(
  binding: InvokeArgumentBinding,
  contract: WorkflowContract,
): { matched: boolean; contractArg?: WorkflowContractArgument; strippedName?: string } {
  const bindingNameLower = binding.name.toLowerCase();
  for (const contractArg of contract.arguments) {
    if (contractArg.name.toLowerCase() === bindingNameLower) {
      return { matched: true, contractArg };
    }
  }
  const strippedName = stripDirectionPrefix(binding.name);
  const strippedLower = strippedName.toLowerCase();
  for (const contractArg of contract.arguments) {
    if (contractArg.name.toLowerCase() === strippedLower) {
      return { matched: true, contractArg, strippedName };
    }
    if (stripDirectionPrefix(contractArg.name).toLowerCase() === strippedLower) {
      return { matched: true, contractArg, strippedName };
    }
  }
  return { matched: false };
}

export function getAndClearResidualJsonDefects(): ResidualJsonDefect[] {
  const defects = _residualJsonDefects;
  _residualJsonDefects = [];
  return defects;
}

export function getResidualJsonDefects(): ReadonlyArray<ResidualJsonDefect> {
  return _residualJsonDefects;
}

export function setRemediationContext(ctx: AssemblyRemediationContext): void {
  _activeRemediationContext = ctx;
}

export function clearRemediationContext(): AssemblyRemediationContext | null {
  const ctx = _activeRemediationContext;
  _activeRemediationContext = null;
  return ctx;
}

export function setAssemblyTargetFramework(tf: "Windows" | "Portable"): void {
  _activeTargetFramework = tf;
}

function recordPropertyRemediation(
  propertyName: string,
  remediationCode: RemediationCode,
  reason: string,
  activityTemplate: string,
  displayName: string,
): void {
  if (!_activeRemediationContext) return;
  _activeRemediationContext.propertyRemediations.push({
    level: "property",
    file: _activeRemediationContext.fileName,
    remediationCode,
    originalTag: activityTemplate,
    originalDisplayName: displayName,
    propertyName,
    reason,
    classifiedCheck: remediationCode,
    developerAction: `Fix property "${propertyName}" on "${displayName}" (${activityTemplate}) in ${_activeRemediationContext.fileName} — ${reason}`,
    estimatedEffortMinutes: estimatePropertyEffort(remediationCode),
  });
}

function estimatePropertyEffort(code: RemediationCode): number {
  const effortMap: Record<string, number> = {
    "STUB_PROPERTY_BAD_EXPRESSION": 10,
    "STUB_PROPERTY_MISSING_SELECTOR": 15,
    "STUB_PROPERTY_UNSUPPORTED_TYPE": 5,
    "STUB_PROPERTY_INVALID_VALUE": 5,
  };
  return effortMap[code] || 5;
}

function validatePropertyValue(
  key: string,
  value: string,
  schema: any,
  templateName: string,
): { valid: boolean; code: RemediationCode; reason: string } | null {
  if (value === "[object Object]" || value === "undefined" || value === "null") {
    return {
      valid: false,
      code: "STUB_PROPERTY_BAD_EXPRESSION",
      reason: `Property "${key}" contains serialization artifact "${value}"`,
    };
  }

  if (key.toLowerCase() === "selector" || key.toLowerCase().endsWith("selector")) {
    if (!value || value === "" || value === '""') {
      return {
        valid: false,
        code: "STUB_PROPERTY_MISSING_SELECTOR",
        reason: `Property "${key}" has empty or missing selector value`,
      };
    }
  }

  if (schema) {
    const propDef = schema.activity?.properties?.find((p: any) => p.name === key);
    if (propDef?.validValues && propDef.validValues.length > 0) {
      const normalizedValue = value.replace(/^\[|\]$/g, "").trim();
      if (!propDef.validValues.includes(normalizedValue) && !propDef.validValues.includes(value)) {
        return {
          valid: false,
          code: "STUB_PROPERTY_INVALID_VALUE",
          reason: `Property "${key}" has value "${value}" which is not in valid values: ${propDef.validValues.join(", ")}`,
        };
      }
    }
  }

  return null;
}

function getSafeDefaultForProperty(key: string, code: RemediationCode): string {
  let raw: string;
  if (code === "STUB_PROPERTY_MISSING_SELECTOR") {
    raw = '[TODO - Capture selector using UiExplorer]';
  } else if (code === "STUB_PROPERTY_BAD_EXPRESSION") {
    raw = '[TODO - Replace with valid expression]';
  } else if (code === "STUB_PROPERTY_INVALID_VALUE") {
    raw = '[TODO - Set valid value]';
  } else {
    raw = `[TODO - Fix ${key}]`;
  }
  return sanitizePlaceholderForAttribute(raw, `getSafeDefaultForProperty:${key}`);
}

const XAML_PROTECTED_STRUCTURAL_NAMES = new Set([
  "Try", "Then", "Else", "Body", "Condition", "Catches", "Finally",
  "Cases", "Default", "Values", "Username", "Password",
  "Implementation", "Variables", "Activities", "Arguments",
  "Handler", "Trigger", "Action", "Content", "Result",
  "Header", "Headers", "Branches", "Constraints",
]);

const VBNET_RESERVED_WORDS = new Set([
  "addhandler", "addressof", "alias", "and", "andalso", "as", "boolean", "byref",
  "byte", "byval", "call", "case", "catch", "cbool", "cbyte", "cchar", "cdate",
  "cdbl", "cdec", "char", "cint", "class", "clng", "cobj", "const", "continue",
  "csbyte", "cshort", "csng", "cstr", "ctype", "cuint", "culng", "cushort",
  "date", "decimal", "declare", "default", "delegate", "dim", "directcast", "do",
  "double", "each", "else", "elseif", "end", "endif", "enum", "erase", "error",
  "event", "exit", "false", "finally", "for", "friend", "function", "get",
  "gettype", "getxmlnamespace", "global", "gosub", "goto", "handles", "if",
  "implements", "imports", "in", "inherits", "integer", "interface", "is", "isnot",
  "let", "lib", "like", "long", "loop", "me", "mod", "module", "mustinherit",
  "mustoverride", "mybase", "myclass", "namespace", "narrowing", "new", "next",
  "not", "nothing", "notinheritable", "notoverridable", "object", "of", "on",
  "operator", "option", "optional", "or", "orelse", "overloads", "overridable",
  "overrides", "paramarray", "partial", "private", "property", "protected", "public",
  "raiseevent", "readonly", "redim", "rem", "removehandler", "resume", "return",
  "sbyte", "select", "set", "shadows", "shared", "short", "single", "static",
  "step", "stop", "string", "structure", "sub", "synclock", "then", "throw", "to",
  "true", "try", "trycast", "typeof", "uinteger", "ulong", "ushort", "using",
  "variant", "wend", "when", "while", "widening", "with", "withevents", "writeonly",
  "xor",
]);

export function isProtectedXamlStructuralName(name: string): boolean {
  return XAML_PROTECTED_STRUCTURAL_NAMES.has(name);
}

export function sanitizeVariableName(name: string): string {
  if (XAML_PROTECTED_STRUCTURAL_NAMES.has(name)) {
    return name;
  }
  let sanitized = name.replace(/\./g, "_");
  sanitized = sanitized.replace(/[^a-zA-Z0-9_]/g, "_");
  sanitized = sanitized.replace(/^[0-9]+/, "");
  sanitized = sanitized.replace(/_+/g, "_");
  sanitized = sanitized.replace(/^_|_$/g, "");
  if (!sanitized) sanitized = "var1";
  if (VBNET_RESERVED_WORDS.has(sanitized.toLowerCase()) && !XAML_PROTECTED_STRUCTURAL_NAMES.has(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized;
}

export function isUnsafeVariableName(name: string): string | null {
  if (/\./.test(name)) return `contains dot(s)`;
  if (/\s/.test(name)) return `contains whitespace`;
  if (/^[0-9]/.test(name)) return `starts with a digit`;
  if (/[^a-zA-Z0-9_]/.test(name)) return `contains invalid character(s)`;
  if (VBNET_RESERVED_WORDS.has(name.toLowerCase())) return `is a VB.NET reserved word`;
  return null;
}

type MapClrTypeContext = "critical" | "non-critical";


export function mapClrFullyQualifiedToXamlPrefix(clrType: string): string | null {
  const dotParts = clrType.split(".");
  if (dotParts.length < 2) return null;
  const typeName = dotParts[dotParts.length - 1];
  if (!typeName || !/^[A-Z]/.test(typeName)) return null;

  for (let i = dotParts.length - 1; i >= 1; i--) {
    const ns = dotParts.slice(0, i).join(".");
    const prefix = CLR_NAMESPACE_TO_XAML_PREFIX[ns];
    if (prefix) {
      const remainder = dotParts.slice(i).join(".");
      return `${prefix}:${remainder}`;
    }
  }

  if (clrType.startsWith("System.") && !clrType.startsWith("System.Collections") && !clrType.startsWith("System.Data")) {
    const afterSystem = clrType.substring("System.".length);
    if (/^[A-Z]\w*$/.test(afterSystem)) {
      return `s:${afterSystem}`;
    }
  }

  return null;
}

const EXTRA_XMLNS_FOR_TYPE: Record<string, { prefix: string; namespace: string; assembly: string }> = {
  "System.Net.Mail.MailMessage": { prefix: "snetmail", namespace: "System.Net.Mail", assembly: "System" },
  "System.Net.Mail.MailAddress": { prefix: "snetmail", namespace: "System.Net.Mail", assembly: "System" },
};

export function normalizeVariableTypeAttr(typeAttr: string): string {
  const clrPrefixed = mapClrFullyQualifiedToXamlPrefix(typeAttr);
  if (clrPrefixed) {
    if (clrPrefixed.includes(".") && clrPrefixed.includes(":")) {
      const colonIdx = clrPrefixed.indexOf(":");
      const afterPrefix = clrPrefixed.substring(colonIdx + 1);
      if (afterPrefix.includes(".")) {
        const extraXmlns = EXTRA_XMLNS_FOR_TYPE[typeAttr];
        if (extraXmlns) {
          return `${extraXmlns.prefix}:${typeAttr.split(".").pop()}`;
        }
        return typeAttr;
      }
    }
    return clrPrefixed;
  }
  if (/^[A-Z][\w.]+\.[A-Z]\w+$/.test(typeAttr) && !typeAttr.includes(":") && !typeAttr.startsWith("clr-namespace:")) {
    const directPrefixed = mapClrFullyQualifiedToXamlPrefix(typeAttr);
    if (directPrefixed) return directPrefixed;
  }
  return typeAttr;
}

function mapClrType(type: string, context: MapClrTypeContext = "non-critical"): string {
  const trimmed = type.trim();

  if (/^scg:(?:List|Dictionary)\(/.test(trimmed) || /^scg2:/.test(trimmed)) {
    return trimmed;
  }
  if (/^[a-z]+:[A-Z]/.test(trimmed) && !trimmed.includes("clr-namespace:")) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  if (lower === "string" || lower === "system.string" || lower === "x:string") return "x:String";
  if (lower === "int32" || lower === "integer" || lower === "int" || lower === "system.int32" || lower === "x:int32") return "x:Int32";
  if (lower === "int64" || lower === "long" || lower === "system.int64" || lower === "x:int64") return "x:Int64";
  if (lower === "boolean" || lower === "bool" || lower === "system.boolean" || lower === "x:boolean") return "x:Boolean";
  if (lower === "double" || lower === "system.double" || lower === "x:double") return "x:Double";
  if (lower === "decimal" || lower === "system.decimal" || lower === "x:decimal") return "x:Decimal";
  if (lower === "datetime" || lower === "system.datetime" || lower === "s:datetime") return "s:DateTime";
  if (lower === "timespan" || lower === "system.timespan" || lower === "s:timespan") return "s:TimeSpan";
  if (lower === "object" || lower === "system.object" || lower === "x:object") return "x:Object";
  if (lower === "securestring" || lower === "system.security.securestring") return "s:Security.SecureString";

  if (lower.includes("datatable") && !lower.includes("dictionary")) return "scg2:DataTable";
  if (lower.includes("datarow")) return "scg2:DataRow";
  if (lower.includes("securestring")) return "s:Security.SecureString";

  const dictMatch = trimmed.match(/^Dictionary\s*<\s*([^,]+)\s*,\s*([^>]+)\s*>$/i);
  if (dictMatch) {
    const keyType = mapClrType(dictMatch[1].trim(), context);
    const valType = mapClrType(dictMatch[2].trim(), context);
    return `scg:Dictionary(${keyType}, ${valType})`;
  }

  const listMatch = trimmed.match(/^List\s*<\s*([^>]+)\s*>$/i);
  if (listMatch) {
    const itemType = mapClrType(listMatch[1].trim(), context);
    return `scg:List(${itemType})`;
  }

  const arrayMatch = trimmed.match(/^Array\s*<\s*([^>]+)\s*>$/i);
  if (arrayMatch) {
    const itemType = mapClrType(arrayMatch[1].trim(), context);
    return `scg:List(${itemType})`;
  }

  const arrayBracketMatch = trimmed.match(/^(\w+)\[\]$/);
  if (arrayBracketMatch) {
    const itemType = mapClrType(arrayBracketMatch[1].trim(), context);
    return `scg:List(${itemType})`;
  }

  const clrPrefixResult = mapClrFullyQualifiedToXamlPrefix(trimmed);
  if (clrPrefixResult) return clrPrefixResult;

  if (trimmed.includes("clr-namespace:")) {
    if (/\[/.test(trimmed)) {
      const reason = "clr-namespace type with leaked brackets";
      if (context === "critical") {
        console.error(`[mapClrType] CRITICAL: ${reason} in critical context: "${trimmed}" — blocking`);
        reportCriticalTypeDiagnostic({ inputType: type, resolvedType: "x:Object", reason, context, source: "workflow-tree-assembler" });
      } else {
        console.warn(`[mapClrType] ${reason}: "${trimmed}" — falling back to x:Object`);
      }
      return "x:Object";
    }
    if (!/assembly=/.test(trimmed)) {
      const reason = "clr-namespace type without assembly qualification";
      if (context === "critical") {
        console.error(`[mapClrType] CRITICAL: ${reason} in critical context: "${trimmed}" — blocking`);
        reportCriticalTypeDiagnostic({ inputType: type, resolvedType: "x:Object", reason, context, source: "workflow-tree-assembler" });
      } else {
        console.warn(`[mapClrType] ${reason}: "${trimmed}" — falling back to x:Object`);
      }
      return "x:Object";
    }
    return trimmed;
  }

  const validation = validateMapClrTypeOutput(type, type, context);
  if (!validation.valid) {
    if (context === "critical") {
      console.error(`[mapClrType] CRITICAL: ${validation.diagnostic}`);
      reportCriticalTypeDiagnostic({ inputType: type, resolvedType: "x:Object", reason: validation.diagnostic || "unrecognized type", context, source: "workflow-tree-assembler" });
    } else if (validation.diagnostic) {
      console.warn(`[mapClrType] ${validation.diagnostic}`);
    }
  }
  return "x:Object";
}

function inferTypeFromDefault(defaultValue: string | undefined): string | null {
  if (!defaultValue) return null;
  const trimmed = defaultValue.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return null;
  const unquoted = trimmed.replace(/^&quot;|&quot;$/g, "").replace(/^"|"$/g, "");
  if (trimmed === "True" || trimmed === "False") return "x:Boolean";
  if (/^-?\d+$/.test(trimmed)) return "x:Int32";
  if (/^-?\d+\.\d+$/.test(trimmed)) return "x:Double";
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return "x:String";
  if (trimmed.startsWith("&quot;") && trimmed.endsWith("&quot;")) return "x:String";
  if (unquoted !== trimmed && unquoted.length < trimmed.length) return "x:String";
  return null;
}

function inferAssignType(varName: string, variables: VariableDeclaration[]): string {
  const decl = variables.find(v => v.name === varName);
  if (decl) {
    const mapped = mapClrType(decl.type);
    if (mapped !== "x:Object") return mapped;
    const prefixInferred = inferTypeFromPrefix(varName);
    if (prefixInferred) return prefixInferred;
    const defaultInferred = inferTypeFromDefault(decl.default);
    if (defaultInferred) return defaultInferred;
    return mapped;
  }
  const prefixInferred = inferTypeFromPrefix(varName);
  if (prefixInferred) return prefixInferred;
  return "x:Object";
}


const IMPLICIT_OUTPUT_ACTIVITY_TYPES: Record<string, { outputPropNames: string[]; defaultVar: string; defaultType: string }> = {
  "GetAsset": { outputPropNames: ["AssetValue", "Value"], defaultVar: "str_AssetValue", defaultType: "String" },
  "GetCredential": { outputPropNames: ["Username", "Password"], defaultVar: "str_Username", defaultType: "String" },
  "GetTransactionItem": { outputPropNames: ["TransactionItem"], defaultVar: "qi_TransactionItem", defaultType: "UiPath.Core.QueueItem" },
  "DeserializeJson": { outputPropNames: ["Result"], defaultVar: "obj_Result", defaultType: "Object" },
  "HttpClient": { outputPropNames: ["Result"], defaultVar: "str_ResponseBody", defaultType: "String" },
  "GetRobotAsset": { outputPropNames: ["AssetValue", "Value"], defaultVar: "str_RobotAssetValue", defaultType: "String" },
  "GetQueueItems": { outputPropNames: ["QueueItems"], defaultVar: "list_QueueItems", defaultType: "System.Collections.Generic.List(UiPath.Core.QueueItem)" },
  "AddQueueItem": { outputPropNames: ["QueueItem"], defaultVar: "qi_NewQueueItem", defaultType: "UiPath.Core.QueueItem" },
  "ReadRange": { outputPropNames: ["DataTable"], defaultVar: "dt_ExcelData", defaultType: "System.Data.DataTable" },
  "ReadCsvFile": { outputPropNames: ["DataTable"], defaultVar: "dt_CsvData", defaultType: "System.Data.DataTable" },
  "ExecuteQuery": { outputPropNames: ["DataTable"], defaultVar: "dt_QueryResult", defaultType: "System.Data.DataTable" },
  "DeserializeXml": { outputPropNames: ["XmlDocument"], defaultVar: "obj_XmlDoc", defaultType: "System.Xml.Linq.XDocument" },
  "InputDialog": { outputPropNames: ["Result"], defaultVar: "str_UserInput", defaultType: "String" },
  "MessageBox": { outputPropNames: ["ChosenButton"], defaultVar: "str_ChosenButton", defaultType: "String" },
  "GetOrchestratorJobInfo": { outputPropNames: ["JobId", "MachineName"], defaultVar: "str_JobId", defaultType: "String" },
  "ReadTextFile": { outputPropNames: ["Content"], defaultVar: "str_FileContent", defaultType: "String" },
  "SerializeJson": { outputPropNames: ["JsonString"], defaultVar: "str_JsonOutput", defaultType: "String" },
  "MatchPattern": { outputPropNames: ["Matches", "Result"], defaultVar: "obj_Matches", defaultType: "System.Text.RegularExpressions.MatchCollection" },
};

function extractArgumentRefsFromString(str: string): string[] {
  const refs: string[] = [];
  const pattern = /\b(in_[A-Za-z]\w*|out_[A-Za-z]\w*|io_[A-Za-z]\w*)\b/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(str)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function extractPrefixedVarRefsFromString(str: string): string[] {
  const refs: string[] = [];
  const pattern = new RegExp(PREFIXED_VAR_REF_REGEX.source, "g");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(str)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

function getUnprefixedCandidateRejectionReason(ident: string, expressionContext: string): string | null {
  if (ident.length < 2) return "identifier too short";
  if (isExcludedSymbolToken(ident)) return `excluded symbol token (keyword/CLR type/XML entity)`;
  if (VBNET_RESERVED_WORDS.has(ident.toLowerCase())) return "VB.NET reserved word";
  if (/^\d/.test(ident)) return "starts with digit";
  if (/^[A-Z][a-z]/.test(ident)) {
    const dotFollowPattern = new RegExp(`\\b${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`, "g");
    if (dotFollowPattern.test(expressionContext)) return "PascalCase identifier followed by dot (member access)";
  }
  const funcCallPattern = new RegExp(`\\b${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(`);
  if (funcCallPattern.test(expressionContext)) return "identifier used as function call";
  const memberAccessPattern = new RegExp(`\\.${ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  if (memberAccessPattern.test(expressionContext)) return "identifier accessed as member";
  if (XAML_PROTECTED_STRUCTURAL_NAMES.has(ident)) return "XAML protected structural name";
  return null;
}

interface UnprefixedExtractionResult {
  accepted: string[];
  rejected: Array<{ ident: string; reason: string; expressionContext: string }>;
}

function extractUnprefixedVarRefsFromExpression(str: string): UnprefixedExtractionResult {
  const result: UnprefixedExtractionResult = { accepted: [], rejected: [] };
  let stripped = str.replace(/^\[|\]$/g, "").trim();
  if (/^"\[.*\]"$/s.test(stripped)) {
    stripped = stripped.replace(/^"(.*)"$/s, "$1").trim();
    stripped = stripped.replace(/^\[|\]$/g, "").trim();
  }
  if (!stripped) return result;

  const stringPattern = /"(?:[^"]|"")*"/g;
  const exprWithoutStrings = stripped.replace(stringPattern, (m) => " ".repeat(m.length));

  const identPattern = /\b([a-zA-Z_]\w*)\b/g;
  let match;
  const seen = new Set<string>();
  while ((match = identPattern.exec(exprWithoutStrings)) !== null) {
    const ident = match[1];
    if (seen.has(ident)) continue;
    seen.add(ident);

    if (/^(str_|int_|bool_|dbl_|dec_|obj_|dt_|ts_|drow_|qi_|sec_|arr_|dict_|list_|num_|is_|has_|date_|dtm_|dr_)/i.test(ident)) continue;
    if (/^(in_|out_|io_)/i.test(ident)) continue;

    const rejectionReason = getUnprefixedCandidateRejectionReason(ident, exprWithoutStrings);
    if (rejectionReason) {
      result.rejected.push({ ident, reason: rejectionReason, expressionContext: exprWithoutStrings });
    } else {
      result.accepted.push(ident);
    }
  }
  return result;
}

interface ExpressionContextHint {
  activityType?: string;
  propertyName?: string;
  peerType?: string;
}

const ACTIVITY_PROPERTY_TYPE_MAP: Record<string, Record<string, string>> = {
  "Assign": {
    "To": "",
    "Value": "",
  },
  "If": {
    "Condition": "Boolean",
  },
  "While": {
    "Condition": "Boolean",
  },
  "DoWhile": {
    "Condition": "Boolean",
  },
  "LogMessage": {
    "Message": "String",
  },
  "SendSmtpMailMessage": {
    "To": "String",
    "Subject": "String",
    "Body": "String",
    "From": "String",
  },
  "AddTransactionItem": {
    "QueueName": "String",
  },
  "SetTransactionStatus": {
    "Status": "String",
  },
};

function normalizeTypeForComparison(t: string): string {
  return t.replace(/^(x:|s:|System\.)/, "");
}

function typesAreEquivalent(a: string, b: string): boolean {
  return normalizeTypeForComparison(a).toLowerCase() === normalizeTypeForComparison(b).toLowerCase();
}

function inferTypeFromExpressionContext(varName: string, hint?: ExpressionContextHint): { type: string; strength: "strong" | "moderate" | "weak" } | null {
  if (!hint) return null;

  if (hint.peerType && hint.peerType !== "x:Object" && hint.peerType !== "Object") {
    return { type: hint.peerType, strength: "strong" };
  }

  if (hint.activityType && hint.propertyName) {
    const actMap = ACTIVITY_PROPERTY_TYPE_MAP[hint.activityType];
    if (actMap && hint.propertyName in actMap) {
      const expectedType = actMap[hint.propertyName];
      if (expectedType) {
        return { type: expectedType, strength: "moderate" };
      }
    }
  }

  return null;
}

function discoverAndRegisterVarRef(varName: string, registry: DeclarationRegistry, workflowName: string, contextHint?: ExpressionContextHint): void {
  if (registry.hasName(varName)) return;
  if (/^(in_|out_|io_)/i.test(varName)) return;
  const inferredType = inferTypeFromPrefix(varName);

  if (inferredType) {
    const contextInference = inferTypeFromExpressionContext(varName, contextHint);
    if (contextInference && !typesAreEquivalent(contextInference.type, inferredType)) {
      registry.recordSymbolDiagnostic({
        symbol: varName,
        category: "variable",
        inferredType,
        declarationEmitted: false,
        scope: "workflow",
        source: "discovered-reference",
        ambiguityReason: `Prefix infers "${inferredType}" but expression context (${contextHint?.activityType}.${contextHint?.propertyName}) expects "${contextInference.type}" — conflicting evidence, declaration blocked`,
        expressionContext: contextHint?.activityType ? {
          activityType: contextHint.activityType,
          propertyName: contextHint.propertyName || "",
          expectedType: contextInference.type,
          evidenceStrength: contextInference.strength,
        } : undefined,
      });
      console.warn(`[Variable Declaration] BLOCKED: conflicting type evidence for "${varName}" in "${workflowName}" — prefix="${inferredType}", context="${contextInference.type}"`);
      return;
    }

    registry.registerVariable({
      name: varName,
      type: inferredType,
      source: "discovered-reference",
      scope: "workflow",
    });
    registry.recordSymbolDiagnostic({
      symbol: varName,
      category: "variable",
      inferredType,
      declarationEmitted: true,
      scope: "workflow",
      source: "discovered-reference",
      expressionContext: contextHint?.activityType ? {
        activityType: contextHint.activityType,
        propertyName: contextHint.propertyName || "",
        expectedType: inferredType,
        evidenceStrength: "strong",
      } : undefined,
    });
    console.log(`[Variable Declaration] Pre-emission walk: auto-declared variable "${varName}" (${inferredType}) in "${workflowName}"`);
    return;
  }

  const contextInference = inferTypeFromExpressionContext(varName, contextHint);
  if (contextInference) {
    registry.registerVariable({
      name: varName,
      type: contextInference.type,
      source: "discovered-reference",
      scope: "workflow",
    });
    registry.recordSymbolDiagnostic({
      symbol: varName,
      category: "variable",
      inferredType: contextInference.type,
      declarationEmitted: true,
      scope: "workflow",
      source: "discovered-reference",
      expressionContext: contextHint?.activityType ? {
        activityType: contextHint.activityType,
        propertyName: contextHint.propertyName || "",
        expectedType: contextInference.type,
        evidenceStrength: contextInference.strength,
      } : undefined,
    });
    console.log(`[Variable Declaration] Pre-emission walk: context-inferred variable "${varName}" (${contextInference.type}) from ${contextHint?.activityType}.${contextHint?.propertyName} in "${workflowName}"`);
    return;
  }
}

function discoverAndRegisterUnprefixedVarRef(
  varName: string,
  registry: DeclarationRegistry,
  workflowName: string,
  contextHint?: ExpressionContextHint,
): void {
  if (registry.hasName(varName)) return;
  if (/^(in_|out_|io_)/i.test(varName)) return;

  const prefixType = inferTypeFromPrefix(varName);
  if (prefixType) {
    discoverAndRegisterVarRef(varName, registry, workflowName, contextHint);
    return;
  }

  const contextInference = inferTypeFromExpressionContext(varName, contextHint);

  if (!contextInference) {
    registry.recordSymbolDiagnostic({
      symbol: varName,
      category: "variable",
      inferredType: "unknown",
      declarationEmitted: false,
      scope: "workflow",
      source: "discovered-reference",
      ambiguityReason: `No prefix and no expression context evidence — declaration blocked to avoid generic placeholder`,
      expressionContext: contextHint?.activityType ? {
        activityType: contextHint.activityType,
        propertyName: contextHint.propertyName || "",
        expectedType: "unknown",
        evidenceStrength: "weak",
      } : undefined,
    });
    console.warn(`[Variable Declaration] BLOCKED: no type evidence for unprefixed "${varName}" in "${workflowName}" — no prefix, no context hint`);
    return;
  }

  registry.registerVariable({
    name: varName,
    type: contextInference.type,
    source: "discovered-reference",
    scope: "workflow",
  });
  registry.recordSymbolDiagnostic({
    symbol: varName,
    category: "variable",
    inferredType: contextInference.type,
    declarationEmitted: true,
    scope: "workflow",
    source: "discovered-reference",
    expressionContext: contextHint?.activityType ? {
      activityType: contextHint.activityType,
      propertyName: contextHint.propertyName || "",
      expectedType: contextInference.type,
      evidenceStrength: contextInference.strength,
    } : undefined,
  });
  console.log(`[Variable Declaration] Pre-emission walk: context-inferred unprefixed variable "${varName}" (${contextInference.type}) from ${contextHint?.activityType}.${contextHint?.propertyName} in "${workflowName}"`);
}

function discoverAndRegisterArgRef(argName: string, registry: DeclarationRegistry, workflowName: string): void {
  if (registry.hasVariableName(argName)) return;
  if (registry.hasNameInScope(argName) && !registry.hasArgumentName(argName)) return;
  const lower = argName.toLowerCase();
  const direction = lower.startsWith("out_") ? "OutArgument" as const
    : lower.startsWith("io_") ? "InOutArgument" as const
    : "InArgument" as const;
  const inferredFromPrefix = inferTypeFromPrefix(argName);
  // For argument prefixes (in_/out_/io_), the prefix only encodes direction —
  // not type. When no body-prefix carries type evidence, fall back to x:Object
  // so the argument is still declared (Studio accepts x:Object), rather than
  // leaving it undeclared and triggering a downstream "undeclared variable"
  // QG error.
  const inferredType = inferredFromPrefix ?? "x:Object";
  if (!inferredFromPrefix) {
    console.log(`[Argument Declaration] No body-prefix type evidence for "${argName}" in "${workflowName}" — declaring as ${direction} x:Object`);
  }
  registry.registerArgument({
    name: argName,
    direction,
    type: inferredType,
    source: "discovered-reference",
  });
  if (!registry.hasArgumentName(argName)) return;
  registry.recordSymbolDiagnostic({
    symbol: argName,
    category: "argument",
    inferredType,
    declarationEmitted: true,
    scope: "workflow",
    source: "discovered-reference",
  });
  console.log(`[Argument Declaration] Pre-emission walk: auto-declared ${direction} "${argName}" (${inferredType}) in "${workflowName}"`);
}

function extractRefsFromStrings(strings: string[], registry: DeclarationRegistry, workflowName: string, isExpressionContext: boolean = false, contextHint?: ExpressionContextHint): void {
  for (const str of strings) {
    const refs = extractArgumentRefsFromString(str);
    for (const argName of refs) {
      discoverAndRegisterArgRef(argName, registry, workflowName);
    }
    const varRefs = extractPrefixedVarRefsFromString(str);
    for (const varName of varRefs) {
      discoverAndRegisterVarRef(varName, registry, workflowName, contextHint);
    }
    if (isExpressionContext) {
      const unprefixedResult = extractUnprefixedVarRefsFromExpression(str);
      for (const varName of unprefixedResult.accepted) {
        discoverAndRegisterUnprefixedVarRef(varName, registry, workflowName, contextHint);
      }
      for (const rejection of unprefixedResult.rejected) {
        if (!registry.hasName(rejection.ident)) {
          registry.recordSymbolDiagnostic({
            symbol: rejection.ident,
            category: "variable",
            inferredType: "x:Object",
            declarationEmitted: false,
            scope: "workflow",
            source: "discovered-reference",
            ambiguityReason: `Withheld: ${rejection.reason}`,
          });
        }
      }
    }
  }
}

function collectStringsFromValue(val: unknown, out: string[]): void {
  if (typeof val === "string") {
    out.push(val);
    if (containsValueIntentJson(val)) {
      const jsonResult = tryParseJsonValueIntent(val);
      if (jsonResult) {
        try { out.push(buildExpression(jsonResult.intent)); } catch (e) {
          console.warn(`[Ref Discovery] Failed to build expression from JSON ValueIntent in property value: ${(e as Error).message}`);
        }
      }
    }
  } else if (isValueIntent(val)) {
    try { out.push(buildExpression(val as ValueIntent)); } catch (e) {
      console.warn(`[Ref Discovery] Failed to build expression from ValueIntent: ${(e as Error).message}`);
    }
  } else if (val !== null && val !== undefined && typeof val === "object") {
    if (Array.isArray(val)) {
      for (const item of val) collectStringsFromValue(item, out);
    } else {
      for (const v of Object.values(val as Record<string, unknown>)) {
        collectStringsFromValue(v, out);
      }
    }
  }
}

const NEVER_EXPRESSION_PROPERTY_NAMES = new Set([
  "DisplayName", "Level", "Annotation", "AnnotationText",
]);

function isNeverExpressionProperty(propName: string): boolean {
  return NEVER_EXPRESSION_PROPERTY_NAMES.has(propName);
}

function walkNodeForArgumentRefs(node: WorkflowNode, registry: DeclarationRegistry, workflowName: string): void {
  if (node.kind === "activity") {
    const actNode = node as ActivityNode;
    const templateName = actNode.template || "";
    const dispatchKey = templateName.replace(/^ui:/, "");

    if (actNode.outputVar) {
      extractRefsFromStrings([actNode.outputVar], registry, workflowName, true);
    }

    let assignToType: string | undefined;
    if (dispatchKey === "Assign") {
      const toVal = coercePropToString(actNode.properties?.["To"] || actNode.properties?.["to"]);
      if (toVal) {
        const cleaned = toVal.replace(/^\[|\]$/g, "").trim();
        if (/^[a-zA-Z_]\w*$/.test(cleaned)) {
          const existing = registry.getVariable(cleaned) || registry.getArgument(cleaned);
          if (existing) {
            assignToType = existing.type;
          } else {
            const prefixType = inferTypeFromPrefix(cleaned);
            if (prefixType) {
              const PREFIX_TO_CLR_LOCAL: Record<string, string> = {
                "x:String": "String", "x:Int32": "Int32", "x:Boolean": "Boolean",
                "x:Double": "Double", "x:Decimal": "Decimal", "s:DateTime": "DateTime",
                "scg2:DataTable": "System.Data.DataTable", "scg2:DataRow": "System.Data.DataRow",
                "s:TimeSpan": "TimeSpan", "x:Object": "Object",
              };
              assignToType = PREFIX_TO_CLR_LOCAL[prefixType] || undefined;
            }
          }
        }
      }
    }

    for (const [key, val] of Object.entries(actNode.properties || {})) {
      if (isNeverExpressionProperty(key)) {
        const target: string[] = [];
        collectStringsFromValue(val, target);
        extractRefsFromStrings(target, registry, workflowName, false);
      } else {
        const target: string[] = [];
        collectStringsFromValue(val, target);
        const hint: ExpressionContextHint = {
          activityType: dispatchKey,
          propertyName: key,
        };
        if (dispatchKey === "Assign" && (key === "Value" || key === "value") && assignToType) {
          hint.peerType = assignToType;
        }
        extractRefsFromStrings(target, registry, workflowName, true, hint);
      }
    }
  }

  if (node.kind === "if") {
    const ifNode = node as IfNode;
    const condStrings: string[] = [];
    if (typeof ifNode.condition === "string") {
      condStrings.push(ifNode.condition);
      if (containsValueIntentJson(ifNode.condition)) {
        const jsonResult = tryParseJsonValueIntent(ifNode.condition);
        if (jsonResult) {
          try { condStrings.push(buildExpression(jsonResult.intent)); } catch (e) {
            console.warn(`[Ref Discovery] Failed to build expression from If condition JSON: ${(e as Error).message}`);
          }
        }
      }
    } else {
      try { condStrings.push(buildExpression(ifNode.condition as ValueIntent)); } catch (e) {
        console.warn(`[Ref Discovery] Failed to build expression from If condition ValueIntent: ${(e as Error).message}`);
      }
    }
    extractRefsFromStrings(condStrings, registry, workflowName, true);
  }

  if (node.kind === "while") {
    const whileNode = node as WhileNode;
    const condStrings: string[] = [];
    if (typeof whileNode.condition === "string") {
      condStrings.push(whileNode.condition);
      if (containsValueIntentJson(whileNode.condition)) {
        const jsonResult = tryParseJsonValueIntent(whileNode.condition);
        if (jsonResult) {
          try { condStrings.push(buildExpression(jsonResult.intent)); } catch (e) {
            console.warn(`[Ref Discovery] Failed to build expression from While condition JSON: ${(e as Error).message}`);
          }
        }
      }
    } else {
      try { condStrings.push(buildExpression(whileNode.condition as ValueIntent)); } catch (e) {
        console.warn(`[Ref Discovery] Failed to build expression from While condition ValueIntent: ${(e as Error).message}`);
      }
    }
    extractRefsFromStrings(condStrings, registry, workflowName, true);
  }

  if (node.kind === "forEach") {
    const forEachNode = node as ForEachNode;
    const scopeId = `forEach::${forEachNode.displayName}`;
    registry.pushScope(scopeId);

    const forEachStrings: string[] = [forEachNode.valuesExpression];
    if (containsValueIntentJson(forEachNode.valuesExpression)) {
      const jsonResult = tryParseJsonValueIntent(forEachNode.valuesExpression);
      if (jsonResult) {
        try { forEachStrings.push(buildExpression(jsonResult.intent)); } catch (e) {
          console.warn(`[Ref Discovery] Failed to build expression from ForEach values JSON: ${(e as Error).message}`);
        }
      }
    }
    extractRefsFromStrings(forEachStrings, registry, workflowName, true);

    if (forEachNode.bodyChildren) {
      for (const child of forEachNode.bodyChildren) {
        walkNodeForArgumentRefs(child, registry, workflowName);
      }
    }

    registry.popScope();
    return;
  }

  if (node.kind === "tryCatch") {
    const tryCatchNode = node as TryCatchNode;
    const scopeId = `tryCatch::${tryCatchNode.displayName}`;

    if (tryCatchNode.tryChildren) {
      for (const child of tryCatchNode.tryChildren) {
        walkNodeForArgumentRefs(child, registry, workflowName);
      }
    }

    registry.pushScope(scopeId);
    if (tryCatchNode.catchChildren) {
      for (const child of tryCatchNode.catchChildren) {
        walkNodeForArgumentRefs(child, registry, workflowName);
      }
    }
    registry.popScope();

    if (tryCatchNode.finallyChildren) {
      for (const child of tryCatchNode.finallyChildren) {
        walkNodeForArgumentRefs(child, registry, workflowName);
      }
    }
    return;
  }

  if (node.kind === "retryScope") {
    const retryScopeNode = node as RetryScopeNode;
    if (retryScopeNode.bodyChildren) {
      for (const child of retryScopeNode.bodyChildren) {
        walkNodeForArgumentRefs(child, registry, workflowName);
      }
    }
    return;
  }

  const childArrays: WorkflowNode[][] = [];
  if ("children" in node && Array.isArray((node as any).children)) childArrays.push((node as any).children);
  if ("thenChildren" in node && Array.isArray((node as any).thenChildren)) childArrays.push((node as any).thenChildren);
  if ("elseChildren" in node && Array.isArray((node as any).elseChildren)) childArrays.push((node as any).elseChildren);
  if ("bodyChildren" in node && Array.isArray((node as any).bodyChildren)) childArrays.push((node as any).bodyChildren);

  for (const arr of childArrays) {
    for (const child of arr) {
      walkNodeForArgumentRefs(child, registry, workflowName);
    }
  }
}

function registerImplicitOutputVariables(children: WorkflowNode[], registry: DeclarationRegistry): void {
  function scanNode(node: WorkflowNode): void {
    if (node.kind === "activity") {
      const actNode = node as ActivityNode;
      const templateName = actNode.template || "";
      const actConfig = IMPLICIT_OUTPUT_ACTIVITY_TYPES[templateName];

      if (actConfig) {
        const props = actNode.properties || {};
        const varNames: string[] = [];

        if (templateName === "GetAsset" || templateName === "GetRobotAsset") {
          const rawOutputVar = actNode.outputVar || coercePropToString(props.AssetValue) || coercePropToString(props.Value) || "";
          if (rawOutputVar && isValidOutputVariableName(rawOutputVar)) {
            varNames.push(rawOutputVar);
          } else {
            const assetName = coercePropToString(props.AssetName) || coercePropToString(props.assetName) || "";
            const assetType = coercePropToString(props.AssetType) || coercePropToString(props.assetType) || "String";
            if (assetName && !assetName.startsWith("PLACEHOLDER_")) {
              varNames.push(deriveAssetOutputVariable(assetName, assetType));
            } else {
              varNames.push("str_REVIEW_AssetOutput");
            }
          }
        } else {
          if (actNode.outputVar) {
            varNames.push(actNode.outputVar);
          }

          for (const propName of actConfig.outputPropNames) {
            const val = props[propName] || props[propName.charAt(0).toLowerCase() + propName.slice(1)];
            if (val && typeof val === "string" && /^[a-zA-Z_]\w*$/.test(val.replace(/^\[|\]$/g, ""))) {
              varNames.push(val.replace(/^\[|\]$/g, ""));
            }
          }

          if (varNames.length === 0) {
            varNames.push(actConfig.defaultVar);
          }
        }

        if (templateName === "GetCredential") {
          const rawUsername = props.Username || props.username || "str_Username";
          const rawPassword = props.Password || props.password || "sec_Password";
          const usernameVar = coerceGetCredentialProp(rawUsername, "Username");
          const passwordVar = coerceGetCredentialProp(rawPassword, "Password");
          const cleanUser = usernameVar.replace(/^\[|\]$/g, "");
          const cleanPass = passwordVar.replace(/^\[|\]$/g, "");
          if (!registry.hasName(cleanUser)) {
            registry.registerVariable({
              name: cleanUser,
              type: "String",
              source: "implicit-output",
              scope: "workflow",
            });
          }
          if (!registry.hasName(cleanPass)) {
            registry.registerVariable({
              name: cleanPass,
              type: "System.Security.SecureString",
              source: "implicit-output",
              scope: "workflow",
            });
          }
        }

        for (const varName of varNames) {
          const cleanName = varName.replace(/^\[|\]$/g, "");
          if (!cleanName || registry.hasName(cleanName)) continue;

          const PREFIX_TO_CLR: Record<string, string> = {
            "x:String": "String",
            "x:Int32": "Int32",
            "x:Boolean": "Boolean",
            "x:Double": "Double",
            "x:Decimal": "Decimal",
            "s:DateTime": "DateTime",
            "scg2:DataTable": "System.Data.DataTable",
            "scg2:DataRow": "System.Data.DataRow",
            "s:Security.SecureString": "System.Security.SecureString",
            "s:TimeSpan": "TimeSpan",
            "x:Object": "Object",
            "ui:QueueItem": "UiPath.Core.QueueItem",
          };
          const prefixType = inferTypeFromPrefix(cleanName);
          const prefixClr = prefixType ? (PREFIX_TO_CLR[prefixType] || null) : null;
          const schemaType = actConfig.defaultType;
          const isSchemaGeneric = !schemaType || schemaType === "Object" || schemaType === "x:Object";
          let varType: string;
          if (prefixClr && !isSchemaGeneric) {
            varType = prefixClr;
          } else if (prefixClr) {
            varType = prefixClr;
          } else if (!isSchemaGeneric) {
            varType = schemaType;
          } else {
            varType = "String";
          }

          registry.registerVariable({
            name: cleanName,
            type: varType,
            source: "implicit-output",
            scope: "workflow",
          });
          console.log(`[Implicit Variable] Auto-declared "${cleanName}" (type: ${varType}) from ${templateName} activity`);
        }
      }

      if (actNode.outputVar) {
        const cleanName = actNode.outputVar.replace(/^\[|\]$/g, "");
        if (cleanName && !registry.hasName(cleanName)) {
          let varType = "Object";
          const prefixType = inferTypeFromPrefix(cleanName);
          if (prefixType) {
            const PREFIX_TO_CLR: Record<string, string> = {
              "x:String": "String", "x:Int32": "Int32", "x:Boolean": "Boolean",
              "x:Double": "Double", "x:Decimal": "Decimal", "s:DateTime": "DateTime",
              "scg2:DataTable": "System.Data.DataTable", "scg2:DataRow": "System.Data.DataRow",
              "s:Security.SecureString": "System.Security.SecureString", "s:TimeSpan": "TimeSpan",
              "x:Object": "Object", "ui:QueueItem": "UiPath.Core.QueueItem",
            };
            varType = PREFIX_TO_CLR[prefixType] || varType;
          }
          registry.registerVariable({
            name: cleanName,
            type: varType,
            source: "implicit-output",
            scope: "workflow",
          });
          console.log(`[Implicit Variable] Auto-declared "${cleanName}" (type: ${varType}) from generic outputVar`);
        }
      }
    }

    if ("children" in node && Array.isArray((node as any).children)) {
      for (const child of (node as any).children) scanNode(child);
    }
    if ("thenChildren" in node && Array.isArray((node as any).thenChildren)) {
      for (const child of (node as any).thenChildren) scanNode(child);
    }
    if ("elseChildren" in node && Array.isArray((node as any).elseChildren)) {
      for (const child of (node as any).elseChildren) scanNode(child);
    }
    if ("tryChildren" in node && Array.isArray((node as any).tryChildren)) {
      for (const child of (node as any).tryChildren) scanNode(child);
    }
    if ("catchChildren" in node && Array.isArray((node as any).catchChildren)) {
      for (const child of (node as any).catchChildren) scanNode(child);
    }
    if ("finallyChildren" in node && Array.isArray((node as any).finallyChildren)) {
      for (const child of (node as any).finallyChildren) scanNode(child);
    }
    if ("bodyChildren" in node && Array.isArray((node as any).bodyChildren)) {
      for (const child of (node as any).bodyChildren) scanNode(child);
    }
  }

  for (const child of children) {
    scanNode(child);
  }
}

const TEMPLATE_INPUT_VAR_PATTERNS: Record<string, { propNames: string[]; varType: string }[]> = {
  "SendSmtpMailMessage": [
    { propNames: ["To", "to"], varType: "String" },
    { propNames: ["Body", "body"], varType: "String" },
    { propNames: ["Subject", "subject"], varType: "String" },
    { propNames: ["From", "from"], varType: "String" },
  ],
  "SetTransactionStatus": [
    { propNames: ["TransactionItem", "transactionItem"], varType: "UiPath.Core.QueueItem" },
    { propNames: ["Status", "status"], varType: "String" },
  ],
  "AddTransactionItem": [
    { propNames: ["QueueName", "queueName"], varType: "String" },
  ],
};

function harvestTemplateInputVariables(children: WorkflowNode[], registry: DeclarationRegistry): void {
  function scanNode(node: WorkflowNode): void {
    if (node.kind === "activity") {
      const actNode = node as ActivityNode;
      const templateName = actNode.template || "";
      const patterns = TEMPLATE_INPUT_VAR_PATTERNS[templateName];
      if (patterns) {
        const props = actNode.properties || {};
        for (const pattern of patterns) {
          for (const propName of pattern.propNames) {
            const val = coercePropToString(props[propName]);
            if (!val) continue;
            const cleaned = val.replace(/^\[|\]$/g, "").trim();
            if (!cleaned || cleaned.startsWith('"') || cleaned.startsWith("PLACEHOLDER")) continue;
            if (/^[a-zA-Z_]\w*$/.test(cleaned) && !registry.hasName(cleaned)) {
              const inferredType = inferTypeFromPrefix(cleaned);
              registry.registerVariable({
                name: cleaned,
                type: inferredType || pattern.varType,
                source: "template-input-harvest",
                scope: "workflow",
              });
            }
          }
        }
      }
    }

    const childKeys = ["children", "thenChildren", "elseChildren", "tryChildren", "catchChildren", "finallyChildren", "bodyChildren"] as const;
    for (const key of childKeys) {
      if (key in node && Array.isArray((node as any)[key])) {
        for (const child of (node as any)[key]) scanNode(child);
      }
    }
  }
  for (const child of children) scanNode(child);
}

function resolveTryCatchExceptionName(tryCatchNode: TryCatchNode): string {
  const deepResult = inferExceptionVariableName(tryCatchNode.catchChildren);
  if (deepResult) return deepResult;
  return tryCatchNode.catchVariableName || "exception";
}

function resolveForEachIteratorName(node: ForEachNode, registry?: DeclarationRegistry): string {
  const fallback = node.iteratorName || "item";
  if (!registry) return fallback;
  const entry = registry.findScopedVariableByTypeAndName("forEach", node.displayName);
  return entry ? entry.name : fallback;
}

function registerScopedDeclarations(children: WorkflowNode[], registry: DeclarationRegistry): void {
  const scopeCounters = { forEach: 0, tryCatch: 0 };

  function scanNode(node: WorkflowNode, pathPrefix: string): void {
    if (node.kind === "forEach") {
      const forEachNode = node as ForEachNode;
      const iteratorName = inferForEachIteratorFromBody(forEachNode, []);
      const idx = scopeCounters.forEach++;
      const scopeId = `forEach[${idx}]::${pathPrefix}/${forEachNode.displayName}`;
      registry.registerScopedVariable({
        name: iteratorName,
        type: forEachNode.itemType || "x:Object",
        source: "iterator",
        scope: "block",
        scopeId,
      });
    }

    if (node.kind === "tryCatch") {
      const tryCatchNode = node as TryCatchNode;
      const exceptionName = resolveTryCatchExceptionName(tryCatchNode);
      const idx = scopeCounters.tryCatch++;
      const scopeId = `tryCatch[${idx}]::${pathPrefix}/${tryCatchNode.displayName}`;
      registry.registerScopedVariable({
        name: exceptionName,
        type: "s:Exception",
        source: "catch-exception",
        scope: "block",
        scopeId,
      });
    }

    const childArrays: WorkflowNode[][] = [];
    if ("children" in node && Array.isArray((node as any).children)) childArrays.push((node as any).children);
    if ("thenChildren" in node && Array.isArray((node as any).thenChildren)) childArrays.push((node as any).thenChildren);
    if ("elseChildren" in node && Array.isArray((node as any).elseChildren)) childArrays.push((node as any).elseChildren);
    if ("tryChildren" in node && Array.isArray((node as any).tryChildren)) childArrays.push((node as any).tryChildren);
    if ("catchChildren" in node && Array.isArray((node as any).catchChildren)) childArrays.push((node as any).catchChildren);
    if ("finallyChildren" in node && Array.isArray((node as any).finallyChildren)) childArrays.push((node as any).finallyChildren);
    if ("bodyChildren" in node && Array.isArray((node as any).bodyChildren)) childArrays.push((node as any).bodyChildren);

    for (const arr of childArrays) {
      for (const child of arr) scanNode(child, `${pathPrefix}/${node.displayName}`);
    }
  }

  for (let i = 0; i < children.length; i++) {
    scanNode(children[i], `root[${i}]`);
  }
}

function extractAllVariableRefsFromExpression(expr: string): string[] {
  const refs: string[] = [];
  const stripped = expr.replace(/^\[|\]$/g, "").trim();
  if (!stripped) return refs;
  const identifierPattern = /\b([a-zA-Z_]\w*)\b/g;
  const vbKeywords = new Set([
    "True", "False", "Nothing", "Not", "And", "Or", "AndAlso", "OrAlso",
    "Is", "IsNot", "Like", "Mod", "New", "If", "Then", "Else", "ElseIf",
    "End", "Select", "Case", "For", "Each", "Next", "While", "Do", "Loop",
    "Until", "To", "Step", "In", "Throw", "Try", "Catch", "Finally",
    "Dim", "As", "Of", "Imports", "Return", "Exit", "Continue",
    "String", "Integer", "Boolean", "Object", "Double", "Decimal",
    "Date", "Byte", "Short", "Long", "Single", "Char",
    "CStr", "CInt", "CBool", "CDbl", "CDec", "CDate", "CLng", "CSng", "CType",
    "GetType", "TypeOf", "DirectCast", "TryCast",
    "AddressOf", "RaiseEvent", "WithEvents", "Handles",
    "Me", "MyBase", "MyClass",
    "Len", "Mid", "Left", "Right", "Trim", "UCase", "LCase",
    "Now", "Today", "TimeOfDay",
    "Math", "Convert", "Environment", "System", "DateTime",
    "TimeSpan", "Array", "Console",
  ]);
  const dotPropertyPattern = /\.(\w+)/g;
  const dotProperties = new Set<string>();
  let dotMatch;
  while ((dotMatch = dotPropertyPattern.exec(stripped)) !== null) {
    dotProperties.add(dotMatch[1]);
  }
  let match;
  while ((match = identifierPattern.exec(stripped)) !== null) {
    const name = match[1];
    if (vbKeywords.has(name)) continue;
    if (dotProperties.has(name) && stripped.indexOf(`.${name}`) >= 0) {
      const beforeIdx = match.index - 1;
      if (beforeIdx >= 0 && stripped[beforeIdx] === ".") continue;
    }
    if (/^\d/.test(name)) continue;
    refs.push(name);
  }
  return refs;
}

function validateStructurallyKnownLocals(
  children: WorkflowNode[],
  registry: DeclarationRegistry,
  workflowName: string,
): void {
  function scanForStructuralLocals(node: WorkflowNode): void {
    if (node.kind === "forEach") {
      const forEachNode = node as ForEachNode;
      const iteratorName = inferForEachIteratorFromBody(forEachNode, []);
      if (!registry.hasName(iteratorName)) {
        console.warn(`[StructuralLocal] "${workflowName}": ForEach iterator variable "${iteratorName}" from "${forEachNode.displayName}" was not registered — adding to scoped declarations`);
        registry.registerScopedVariable({
          name: iteratorName,
          type: forEachNode.itemType || "x:Object",
          source: "iterator",
          scope: "block",
          scopeId: `forEach::recovery::${forEachNode.displayName}`,
        });
      }
      if (forEachNode.bodyChildren) {
        for (const child of forEachNode.bodyChildren) scanForStructuralLocals(child);
      }
      return;
    }

    if (node.kind === "tryCatch") {
      const tryCatchNode = node as TryCatchNode;
      const exceptionName = resolveTryCatchExceptionName(tryCatchNode);
      if (!registry.hasName(exceptionName)) {
        console.warn(`[StructuralLocal] "${workflowName}": TryCatch exception variable "${exceptionName}" from "${tryCatchNode.displayName}" was not registered — adding to scoped declarations`);
        registry.registerScopedVariable({
          name: exceptionName,
          type: "s:Exception",
          source: "catch-exception",
          scope: "block",
          scopeId: `tryCatch::recovery::${tryCatchNode.displayName}`,
        });
      }
      if (tryCatchNode.tryChildren) {
        for (const child of tryCatchNode.tryChildren) scanForStructuralLocals(child);
      }
      if (tryCatchNode.catchChildren) {
        for (const child of tryCatchNode.catchChildren) scanForStructuralLocals(child);
      }
      if (tryCatchNode.finallyChildren) {
        for (const child of tryCatchNode.finallyChildren) scanForStructuralLocals(child);
      }
      return;
    }

    const childArrays: WorkflowNode[][] = [];
    if ("children" in node && Array.isArray((node as any).children)) childArrays.push((node as any).children);
    if ("thenChildren" in node && Array.isArray((node as any).thenChildren)) childArrays.push((node as any).thenChildren);
    if ("elseChildren" in node && Array.isArray((node as any).elseChildren)) childArrays.push((node as any).elseChildren);
    if ("tryChildren" in node && Array.isArray((node as any).tryChildren)) childArrays.push((node as any).tryChildren);
    if ("catchChildren" in node && Array.isArray((node as any).catchChildren)) childArrays.push((node as any).catchChildren);
    if ("finallyChildren" in node && Array.isArray((node as any).finallyChildren)) childArrays.push((node as any).finallyChildren);
    if ("bodyChildren" in node && Array.isArray((node as any).bodyChildren)) childArrays.push((node as any).bodyChildren);

    for (const arr of childArrays) {
      for (const child of arr) scanForStructuralLocals(child);
    }
  }

  for (const child of children) {
    scanForStructuralLocals(child);
  }

  const deterministicScaffoldVars: Array<{ name: string; type: string; source: string }> = [
    { name: "str_ScreenshotPath", type: "String", source: "scaffold-screenshot" },
    { name: "dt_ExcelData", type: "System.Data.DataTable", source: "scaffold-excel" },
  ];

  for (const scaffoldVar of deterministicScaffoldVars) {
    if (registry.hasVariableName(scaffoldVar.name)) continue;
    const specStr = JSON.stringify(children);
    if (specStr.includes(scaffoldVar.name)) {
      console.warn(`[StructuralLocal] "${workflowName}": Deterministic scaffold variable "${scaffoldVar.name}" is referenced but not declared — adding to variable declarations`);
      registry.registerVariable({
        name: scaffoldVar.name,
        type: scaffoldVar.type,
        source: scaffoldVar.source,
        scope: "workflow",
      });
    }
  }
}

function validateReferencesBeforeEmission(
  children: WorkflowNode[],
  registry: DeclarationRegistry,
  workflowName: string,
): void {
  const unresolvedRefs: string[] = [];

  function checkRef(ref: string, scopeStack: string[]): void {
    if (registry.hasName(ref)) return;
    const scopedEntries = registry.findAllScopedVariablesByName(ref);
    if (scopedEntries.length > 0) {
      for (const entry of scopedEntries) {
        for (let i = scopeStack.length - 1; i >= 0; i--) {
          if (entry.scopeId && scopeIdMatchesStackEntryExternal(entry.scopeId, scopeStack[i])) return;
        }
      }
    }
    unresolvedRefs.push(ref);
  }

  function extractAndCheckStrings(strings: string[], scopeStack: string[]): void {
    for (const str of strings) {
      const argRefs = extractArgumentRefsFromString(str);
      for (const ref of argRefs) checkRef(ref, scopeStack);
      const allRefs = extractAllVariableRefsFromExpression(str);
      for (const ref of allRefs) checkRef(ref, scopeStack);
    }
  }

  function collectRefs(node: WorkflowNode, scopeStack: string[]): void {
    if (node.kind === "activity") {
      const actNode = node as ActivityNode;
      const allStrings: string[] = [];
      if (actNode.outputVar) allStrings.push(actNode.outputVar);
      for (const [, val] of Object.entries(actNode.properties || {})) {
        if (typeof val === "string") {
          allStrings.push(val);
        } else if (isValueIntent(val)) {
          allStrings.push(buildExpression(val as ValueIntent));
        }
      }
      extractAndCheckStrings(allStrings, scopeStack);
    }

    if (node.kind === "if") {
      const ifNode = node as IfNode;
      if (ifNode.condition) {
        const condStr = typeof ifNode.condition === "string" ? ifNode.condition : "";
        if (condStr) extractAndCheckStrings([condStr], scopeStack);
      }
    }

    if (node.kind === "while") {
      const whileNode = node as WhileNode;
      if (whileNode.condition) {
        const condStr = typeof whileNode.condition === "string" ? whileNode.condition : "";
        if (condStr) extractAndCheckStrings([condStr], scopeStack);
      }
    }

    if (node.kind === "forEach") {
      const forEachNode = node as ForEachNode;
      if (forEachNode.valuesExpression) {
        extractAndCheckStrings([forEachNode.valuesExpression], scopeStack);
      }
      const newStack = [...scopeStack, `forEach::${forEachNode.displayName}`];
      if (forEachNode.bodyChildren) {
        for (const child of forEachNode.bodyChildren) collectRefs(child, newStack);
      }
      return;
    }

    if (node.kind === "tryCatch") {
      const tryCatchNode = node as TryCatchNode;
      if (tryCatchNode.tryChildren) {
        for (const child of tryCatchNode.tryChildren) collectRefs(child, scopeStack);
      }
      const catchStack = [...scopeStack, `tryCatch::${tryCatchNode.displayName}`];
      if (tryCatchNode.catchChildren) {
        for (const child of tryCatchNode.catchChildren) collectRefs(child, catchStack);
      }
      if (tryCatchNode.finallyChildren) {
        for (const child of tryCatchNode.finallyChildren) collectRefs(child, scopeStack);
      }
      return;
    }

    const childArrays: WorkflowNode[][] = [];
    if ("children" in node && Array.isArray((node as any).children)) childArrays.push((node as any).children);
    if ("thenChildren" in node && Array.isArray((node as any).thenChildren)) childArrays.push((node as any).thenChildren);
    if ("elseChildren" in node && Array.isArray((node as any).elseChildren)) childArrays.push((node as any).elseChildren);
    if ("bodyChildren" in node && Array.isArray((node as any).bodyChildren)) childArrays.push((node as any).bodyChildren);

    for (const arr of childArrays) {
      for (const child of arr) collectRefs(child, scopeStack);
    }
  }

  for (const child of children) {
    collectRefs(child, []);
  }

  const unique = Array.from(new Set(unresolvedRefs));
  if (unique.length > 0) {
    console.warn(
      `[DeclarationRegistry] Pre-emission validation for "${workflowName}": ` +
      `${unique.length} unresolved reference(s) detected: ${unique.join(", ")}. ` +
      `These names are not registered as arguments, variables, or scoped declarations.`
    );
  }
}

function indent(xml: string, level: number): string {
  const spaces = "  ".repeat(level);
  return xml.split("\n").map(line => line.trim() ? spaces + line : line).join("\n");
}

function isVbExpression(val: string): boolean {
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/:\/\//.test(trimmed) || /^https?:\/\//i.test(trimmed)) return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return true;
  if (trimmed.startsWith("\"") || trimmed.startsWith("&quot;")) return true;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") return true;
  if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) return true;
  if (/^New\s/.test(trimmed)) return true;

  // Task #527 RC2: source-boundary guard. A bare multi-word natural-language
  // phrase (three or more alphabetic words separated by whitespace or in-
  // word slashes, with no parentheses, member access, division operator, or
  // other VB syntax indicators) must be treated as a string literal, not a
  // VB expression. Without this guard, "Missing/Invalid invoice header data"
  // is wrapped as [Missing/Invalid invoice header data] and surfaces later
  // as a cascade of false-positive UNDECLARED_VARIABLE errors.
  //
  // A VB division operator requires whitespace on both sides (e.g., "a / b")
  // — an in-word slash (e.g., "Missing/Invalid") is prose.
  {
    const hasDivisionOperator = /\s\/\s/.test(trimmed);
    const hasNonSlashOperator = /[()=<>&|+*^]/.test(trimmed);
    const hasMemberAccess = /\b\w+\.\w+/.test(trimmed);
    const hasCallSyntax = /\b\w+\(/.test(trimmed);
    const hasCommaOrSemi = /[,;:]/.test(trimmed);
    if (
      !hasDivisionOperator &&
      !hasNonSlashOperator &&
      !hasMemberAccess &&
      !hasCallSyntax &&
      !hasCommaOrSemi
    ) {
      const words = trimmed.split(/[\s/]+/).filter(Boolean);
      const allAlphabetic = words.every(w => /^[A-Za-z][A-Za-z]*$/.test(w));
      if (words.length >= 3 && allAlphabetic) {
        return false;
      }
    }
  }

  if (/[()=<>&|+*/^]/.test(trimmed)) return true;
  if (/\b\w+\.\w+/.test(trimmed)) {
    if (/\.(json|xml|xlsx|csv|txt|log|config|pdf|html|xaml|dll|exe|zip|png|jpg)$/i.test(trimmed)) return false;
    return true;
  }
  if (/\b(AndAlso|OrElse|Not|Mod|Xor|Is|IsNot|Like)\b/.test(trimmed)) return true;
  if (trimmed.startsWith("in_") || trimmed.startsWith("out_") || trimmed.startsWith("io_")) return true;
  if (/^(str|int|bool|dbl|dec|obj|dt|ts|drow|qi|arr|dict|list|sec)_/i.test(trimmed)) return true;
  return false;
}

export function wrapVariableDefault(val: string, varType: string): string {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") return trimmed;
  if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) return trimmed;

  if (isVbExpression(trimmed)) {
    const hasVbConcatOperator = / & /.test(trimmed) || /&(?!quot;|amp;|lt;|gt;|apos;)/.test(trimmed) || /&amp;/.test(trimmed);
    const hasVbOperators = hasVbConcatOperator || (/[+]/.test(trimmed) && /\b\w+\.\w+\(/.test(trimmed));
    if (hasVbOperators) {
      return `[${trimmed}]`;
    }
    if (trimmed.startsWith("\"") || trimmed.startsWith("&quot;")) {
      return trimmed;
    }
    return `[${trimmed}]`;
  }

  if (trimmed.startsWith("\"") || trimmed.startsWith("&quot;")) return trimmed;

  const typeNorm = varType.toLowerCase();
  const isStringType = typeNorm.includes("string") && !typeNorm.includes("secure");
  if (isStringType) {
    return `"${trimmed}"`;
  }
  return trimmed;
}

const ENCODING_MAP: Record<string, string> = {
  "utf-8": "System.Text.Encoding.UTF8",
  "utf8": "System.Text.Encoding.UTF8",
  "utf-16": "System.Text.Encoding.Unicode",
  "unicode": "System.Text.Encoding.Unicode",
  "ascii": "System.Text.Encoding.ASCII",
  "utf-32": "System.Text.Encoding.UTF32",
  "utf32": "System.Text.Encoding.UTF32",
};

export function resolvePropertyValue(
  value: PropertyValue,
  activityClassName?: string,
  propertyName?: string,
): string {
  let isEnumProperty = false;
  let clrType: string | undefined;
  if (activityClassName && propertyName) {
    const enumValues = catalogService.getEnumValues(activityClassName, propertyName);
    if (enumValues && enumValues.length > 0) {
      isEnumProperty = true;
    }
    clrType = catalogService.getPropertyClrType(activityClassName, propertyName) || undefined;
  }

  const strVal = String(isValueIntent(value) ? buildExpression(value as ValueIntent) : value).trim();

  if (clrType && (clrType === "System.Text.Encoding" || clrType.includes("Encoding"))) {
    const encodingExpr = ENCODING_MAP[strVal.toLowerCase().replace(/^"+|"+$/g, "")];
    if (encodingExpr) {
      return `[${encodingExpr}]`;
    }
  }

  if (isValueIntent(value)) {
    return resolveValueIntentToXaml(value as ValueIntent, isEnumProperty);
  }
  const normalized = normalizePropertyToValueIntent(
    strVal,
    activityClassName,
    propertyName,
    (cls, prop) => catalogService.getEnumValues(cls, prop),
    _activeDeclarationLookup || undefined,
    clrType,
  );
  return resolveValueIntentToXaml(normalized, isEnumProperty);
}

export function resolveValueIntentToXaml(intent: ValueIntent, isEnumProperty: boolean = false): string {
  if (intent.type === "literal" && isEnumProperty) {
    return intent.value;
  }

  if (intent.type === "literal") {
    const val = intent.value;
    if (val === "True" || val === "False" || val === "Nothing" || val === "null") {
      return val;
    }
    // Numeric literals (including signed) are returned bare so typed
    // properties (Int32, Double, ...) bind correctly. Short-circuit
    // BEFORE linting so the linter does not auto-quote them.
    if (/^[+-]?[0-9]+(\.[0-9]+)?$/.test(val)) {
      return val;
    }
  }

  const built = buildExpression(intent);
  const linted = lintAndFixVbExpression(built);

  if (intent.type === "literal") {
    if (/^[+-]?[0-9]+(\.[0-9]+)?$/.test(linted)) {
      return linted;
    }
    if (linted.startsWith('"') && linted.endsWith('"')) {
      return escapeXmlExpression(linted);
    }
    if (linted.startsWith("[") && linted.endsWith("]")) {
      const inner = linted.slice(1, -1);
      return `[${escapeXmlExpression(inner)}]`;
    }
    // Task #539 (Step 6 / Pattern F): auto-quote SDD-orchestrator-artifact
    // bareword literals. When a literal carries a name that LOOKS like a
    // queue / asset / credential identifier but contains a hyphen — e.g.
    // `BDAYGREETINGS-DailyWorkQueue` — emitting it bare into an
    // attribute-value VB expression slot makes the linter parse it as
    // `BDAYGREETINGS - DailyWorkQueue` (subtraction of two undeclared
    // identifiers). Wrap such names as a quoted VB string literal so they
    // survive linting and Studio binding.
    //
    // Narrowed (post-review): only fires when the literal is an
    // identifier-shaped name containing one or more hyphens — i.e. it
    // matches `^[A-Za-z_][A-Za-z0-9_-]*$` AND contains `-`. This
    // explicitly excludes signed numerics (`-1`, `+3.14`), arithmetic
    // expressions, URLs, mime/encoding tokens like `UTF-8`/`text/plain`
    // (no — `UTF-8` matches; see below), and anything with whitespace.
    // For `UTF-8` style tokens we additionally require at least one
    // alphabetic character on BOTH sides of the hyphen so pure short
    // codes like `UTF-8` (digit-trailing) are not mis-quoted; orchestrator
    // names always have alpha runs separating their hyphens.
    if (
      linted.length > 0 &&
      /^[A-Za-z_][A-Za-z0-9_-]*$/.test(linted) &&
      linted.includes("-") &&
      /[A-Za-z][A-Za-z0-9_]*-[A-Za-z_][A-Za-z0-9_-]*[A-Za-z_]$/.test(linted)
    ) {
      const quoted = `"${linted.replace(/"/g, '""')}"`;
      return escapeXmlExpression(quoted);
    }
    return escapeXmlExpression(linted);
  }

  if (intent.type === "vb_expression") {
    if (linted.startsWith("[") && linted.endsWith("]")) {
      const inner = linted.slice(1, -1);
      return `[${escapeXmlExpression(inner)}]`;
    }
    return `[${escapeXmlExpression(linted)}]`;
  }

  const wrapped = smartBracketWrap(linted, _activeDeclarationLookup || undefined);
  if (wrapped.startsWith("[") && wrapped.endsWith("]")) {
    const inner = wrapped.slice(1, -1);
    return `[${escapeXmlExpression(inner)}]`;
  }
  return escapeXmlExpression(wrapped);
}

export function resolvePropertyValueRaw(value: PropertyValue): string {
  if (isValueIntent(value)) {
    const result = buildExpression(value as ValueIntent);
    if (result === "vb_expression" || result === "[vb_expression]") {
      return buildCanonicalTodoExpressionAttributeValue(
        "Implement expression",
        "workflow-tree-assembler:resolvePropertyValueRaw:value-intent",
      );
    }
    return result;
  }
  const strVal = String(value);
  if (strVal === "vb_expression") {
    return buildCanonicalTodoExpressionAttributeValue(
      "Implement expression",
      "workflow-tree-assembler:resolvePropertyValueRaw:string",
    );
  }
  return strVal;
}

/**
 * Task #539 (Step 1): Canonical XML-attribute-safe VB-expression placeholder.
 *
 * Background. Three sites in this file used to return raw bracket-wrapped
 * placeholders of the form `["TODO - ..."]`. When the returned token was
 * interpolated into an XML attribute value without `escapeXml`, the literal
 * `"` characters terminated the attribute and left `TODO` as the next
 * attribute name — producing the `Attribute 'TODO' has no space in starting`
 * compliance crash that cascaded into whole-workflow stubbing on the named
 * replay fixtures (runs `b2bda0c2`, `66561075`).
 *
 * This helper combines the canonical placeholder constructor
 * (`makeTodoTextPlaceholder`) — for provenance tracking — with the
 * canonical sanitizer (`sanitizePlaceholderForVbExpression`) and an explicit
 * `escapeXml` pass on the surrounding bracket-wrapped form so the value is
 * safe to interpolate directly into XML attribute syntax (the `"` characters
 * become `&quot;`). Per the Task #527 contract, no other placeholder shape
 * may be emitted.
 */
export function buildCanonicalTodoExpressionAttributeValue(description: string, source: string): string {
  const canonical = makeTodoTextPlaceholder(description, source).value;
  const safeForVb = sanitizePlaceholderForVbExpression(canonical, source);
  return escapeXml(`["${safeForVb}"]`);
}

export function parseEmittedXmlForValidation(xml: string): {
  tag: string;
  className: string;
  attributes: Record<string, string>;
  childNames: string[];
} | null {
  const trimmed = xml.trim();
  const openTagMatch = trimmed.match(/^<((?:[\w]+:)?[\w]+)([\s\S]*?)(?:\/>|>)/);
  if (!openTagMatch) return null;
  const tag = openTagMatch[1];
  const className = tag.includes(":") ? tag.split(":").pop()! : tag;
  const attrString = openTagMatch[2];

  const attributes: Record<string, string> = {};
  const attrRegex = /([\w]+(?:\.[\w]+)?)="([^"]*)"/g;
  let m;
  while ((m = attrRegex.exec(attrString)) !== null) {
    if (m[1].startsWith("xmlns") || m[1].includes(":")) continue;
    attributes[m[1]] = m[2];
  }

  const childNames: string[] = [];
  const childPropRegex = new RegExp(`<${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\w+)[\\s>]`, "g");
  let cm;
  while ((cm = childPropRegex.exec(trimmed)) !== null) {
    childNames.push(cm[1]);
    childNames.push(`${className}.${cm[1]}`);
  }
  const prefixedChildPropRegex = new RegExp(`<[\\w]+:${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(\\w+)[\\s>]`, "g");
  while ((cm = prefixedChildPropRegex.exec(trimmed)) !== null) {
    if (!childNames.includes(cm[1])) {
      childNames.push(cm[1]);
      childNames.push(`${className}.${cm[1]}`);
    }
  }

  return { tag, className, attributes, childNames };
}

function applyCatalogConformance(xml: string): string {
  if (!catalogService.isLoaded()) return xml;

  const parsed = parseEmittedXmlForValidation(xml);
  if (!parsed) return xml;

  const { tag, className } = parsed;
  const templateName = className;
  const filteredConformResult = getFilteredSchema(templateName, "workflow-tree-assembler", _activeTargetFramework);
  if (filteredConformResult.status !== "approved") return xml;
  const schema = filteredConformResult.schema;

  const validation = catalogService.validateEmittedActivity(
    tag,
    parsed.attributes,
    parsed.childNames,
  );

  if (validation.valid && validation.corrections.length === 0) return xml;

  let corrected = xml;
  for (const correction of validation.corrections) {
    if (correction.type === "move-to-child-element") {
      const propName = correction.property;
      let propVal = parsed.attributes[propName];
      let actualAttrName = propName;
      if (propVal === undefined) {
        const lowerProp = propName.toLowerCase();
        const match = Object.keys(parsed.attributes).find(k => k.toLowerCase() === lowerProp);
        if (match) {
          propVal = parsed.attributes[match];
          actualAttrName = match;
        }
      }
      if (propVal === undefined) continue;

      const wrapper = correction.argumentWrapper || "InArgument";
      const xType = correction.typeArguments || "x:String";
      const wrappedVal = escapeXmlTextContent(ensureBracketWrapped(propVal, _activeDeclarationLookup || undefined));
      const childElement = `<${tag}.${propName}>\n    <${wrapper} x:TypeArguments="${xType}">${wrappedVal}</${wrapper}>\n  </${tag}.${propName}>`;

      const escapedAttrName = actualAttrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedVal = propVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const selfClosingRegex = new RegExp(`(<${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s[^>]*?)${escapedAttrName}="${escapedVal}"([^>]*?)\\s*\\/>`);
      if (selfClosingRegex.test(corrected)) {
        corrected = corrected.replace(selfClosingRegex, `$1$2>\n  ${childElement}\n</${tag}>`);
      } else {
        const openRegex = new RegExp(`(<${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s[^>]*?)${escapedAttrName}="${escapedVal}"([^>]*?>)`);
        if (openRegex.test(corrected)) {
          corrected = corrected.replace(openRegex, `$1$2\n  ${childElement}`);
          const closingTag = `</${tag}>`;
          if (!corrected.includes(closingTag)) {
            corrected += `\n${closingTag}`;
          }
        }
      }

      console.log(`[Catalog Conformance] Moved ${tag}.${propName} from attribute to child-element at emission time`);
    } else if (correction.type === "move-to-attribute") {
      console.log(`[Catalog Conformance] Property ${tag}.${correction.property} should be attribute, not child-element (logged for review)`);
    } else if (correction.type === "fix-invalid-value" && correction.correctedValue) {
      const propName = correction.property;
      const currentVal = parsed.attributes[propName];
      if (currentVal !== undefined) {
        const escapedPropName = propName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedVal = currentVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const attrRegex = new RegExp(`${escapedPropName}="${escapedVal}"`);
        corrected = corrected.replace(attrRegex, `${propName}="${serializeSafeAttributeValue(correction.correctedValue)}"`);
        console.log(`[Catalog Conformance] Auto-corrected ${tag}.${propName} enum value: "${currentVal}" → "${correction.correctedValue}"`);
      }
    } else if (correction.type === "add-missing-required" && correction.correctedValue) {
      const propName = correction.property;
      const catalogProp = schema?.activity.properties.find(p => p.name === propName);
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      if (catalogProp?.xamlSyntax === "child-element") {
        const wrapper = catalogProp.argumentWrapper || "InArgument";
        const xType = catalogProp.typeArguments || "x:String";
        const wrappedVal = escapeXmlTextContent(ensureBracketWrapped(correction.correctedValue, _activeDeclarationLookup || undefined));
        const childElement = `<${tag}.${propName}>\n    <${wrapper} x:TypeArguments="${xType}">${wrappedVal}</${wrapper}>\n  </${tag}.${propName}>`;

        const selfClosingRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)\\s*\\/>`);
        if (selfClosingRegex.test(corrected)) {
          corrected = corrected.replace(selfClosingRegex, `$1>\n  ${childElement}\n</${tag}>`);
        } else {
          const closingTag = `</${tag}>`;
          const closingIdx = corrected.lastIndexOf(closingTag);
          if (closingIdx >= 0) {
            corrected = corrected.substring(0, closingIdx) + `  ${childElement}\n` + corrected.substring(closingIdx);
          }
        }
        console.log(`[Catalog Conformance] Injected required child-element property ${tag}.${propName}`);
      } else {
        const selfClosingRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)\\s*\\/>`);
        if (selfClosingRegex.test(corrected)) {
          corrected = corrected.replace(selfClosingRegex, `$1 ${propName}="${serializeSafeAttributeValue(correction.correctedValue)}" />`);
        } else {
          const openRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)(>)`);
          if (openRegex.test(corrected)) {
            corrected = corrected.replace(openRegex, `$1 ${propName}="${serializeSafeAttributeValue(correction.correctedValue)}"$2`);
          }
        }
        console.log(`[Catalog Conformance] Injected required attribute property ${tag}.${propName}="${correction.correctedValue}"`);
      }
    }
  }

  corrected = corrected.replace(/\s{2,}\/?>/g, (match) => match.includes('/') ? ' />' : '>');
  corrected = corrected.replace(/<(\S+)\s+>/g, '<$1>');

  return corrected;
}

const RECOGNIZED_TYPED_PROPERTY_TYPE_NAMES = new Set(["literal", "variable", "url_with_params", "expression", "vb_expression"]);

export function isTypedPropertyObject(val: unknown): boolean {
  if (typeof val !== "object" || val === null || Array.isArray(val)) return false;
  const obj = val as Record<string, unknown>;
  return typeof obj.type === "string" && RECOGNIZED_TYPED_PROPERTY_TYPE_NAMES.has(obj.type);
}

export type PropertyClassification =
  | { kind: "scalar"; value: string }
  | { kind: "child-element"; value: string; wrapper: string; typeArguments: string | null }
  | { kind: "unsupported-structured"; reason: string; rawShape: string };

export function classifyPropertyValue(
  val: unknown,
  propertyName?: string,
  templateName?: string,
): PropertyClassification {
  if (val === null || val === undefined) {
    return { kind: "scalar", value: "" };
  }
  if (typeof val === "string") {
    if (val === BLOCKED_PROPERTY_SENTINEL) {
      return {
        kind: "unsupported-structured",
        reason: "Blocked property sentinel detected — value was rejected by input preprocessing",
        rawShape: BLOCKED_PROPERTY_SENTINEL,
      };
    }
    return { kind: "scalar", value: val };
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return { kind: "scalar", value: String(val) };
  }
  if (isValueIntent(val)) {
    const vi = val as ValueIntent;
    if (vi.type === "literal" && vi.value === BLOCKED_PROPERTY_SENTINEL) {
      return {
        kind: "unsupported-structured",
        reason: "Blocked property sentinel in ValueIntent — value was rejected by input preprocessing",
        rawShape: BLOCKED_PROPERTY_SENTINEL,
      };
    }
    if (vi.type === "literal" || vi.type === "vb_expression") {
      return { kind: "scalar", value: vi.value };
    }
    if (vi.type === "variable") {
      return { kind: "scalar", value: vi.name };
    }
    return { kind: "scalar", value: buildExpression(vi) };
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (isTypedPropertyObject(val)) {
      if (obj.type === "literal" && typeof obj.value === "string") return { kind: "scalar", value: obj.value };
      if (obj.type === "vb_expression" && typeof obj.value === "string" && obj.value !== "") return { kind: "scalar", value: obj.value };
      if (obj.type === "variable" && typeof obj.name === "string" && obj.name !== "") return { kind: "scalar", value: obj.name };
      return {
        kind: "unsupported-structured",
        reason: `Incomplete typed property object (type="${obj.type}") with missing/invalid required field`,
        rawShape: JSON.stringify(obj).substring(0, 200),
      };
    }
    if (typeof obj.value === "string") return { kind: "scalar", value: obj.value };
    if (typeof obj.name === "string") return { kind: "scalar", value: obj.name };
    return {
      kind: "unsupported-structured",
      reason: `Unrecognized object shape cannot be serialized as XAML attribute`,
      rawShape: JSON.stringify(obj).substring(0, 200),
    };
  }
  return { kind: "scalar", value: String(val) };
}

export function classifyPropertyWithSchema(
  val: unknown,
  propertyName: string,
  templateName: string,
): PropertyClassification {
  const schema = catalogService.getActivitySchema(templateName);
  if (schema) {
    const propDef = schema.activity.properties.find((p: any) => p.name === propertyName);
    if (propDef && propDef.xamlSyntax === "child-element") {
      const basicClassification = classifyPropertyValue(val, propertyName, templateName);
      if (basicClassification.kind === "scalar") {
        return {
          kind: "child-element",
          value: basicClassification.value,
          wrapper: propDef.argumentWrapper || "InArgument",
          typeArguments: propDef.typeArguments || null,
        };
      }
      return basicClassification;
    }
  }
  return classifyPropertyValue(val, propertyName, templateName);
}

export interface TypedPropertyNormalizationDiagnostic {
  workflowFile: string;
  templateName: string;
  propertyName: string;
  classification: string;
  action: "blocked" | "scalar-extracted";
  reason: string;
  rawShape?: string;
  stage: string;
}

const _typedPropertyDiagnostics: TypedPropertyNormalizationDiagnostic[] = [];

export function emitTypedPropertyDiagnostic(diag: TypedPropertyNormalizationDiagnostic): void {
  _typedPropertyDiagnostics.push(diag);
}

export function getAndClearTypedPropertyDiagnostics(): TypedPropertyNormalizationDiagnostic[] {
  const diags = _typedPropertyDiagnostics.splice(0);
  return diags;
}

export function getTypedPropertyDiagnostics(): ReadonlyArray<TypedPropertyNormalizationDiagnostic> {
  return _typedPropertyDiagnostics;
}

export function coercePropToString(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") {
    if (val === BLOCKED_PROPERTY_SENTINEL) return "";
    return val;
  }
  if (isValueIntent(val)) {
    const vi = val as ValueIntent;
    if (vi.type === "literal" || vi.type === "vb_expression") return vi.value;
    if (vi.type === "variable") return vi.name;
    return buildExpression(vi);
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (obj.type === "literal" && typeof obj.value === "string") return obj.value;
    if (obj.type === "vb_expression" && typeof obj.value === "string") return obj.value;
    if (obj.type === "variable" && typeof obj.name === "string") return obj.name;
    if (isTypedPropertyObject(val)) {
      console.warn(`[coercePropToString] Incomplete typed property object (type="${obj.type}") — blocked to prevent leaking`);
      emitTypedPropertyDiagnostic({
        workflowFile: _activeRemediationContext?.fileName || "unknown",
        templateName: "(coercePropToString)",
        propertyName: "(unknown)",
        classification: "unsupported-structured",
        action: "blocked",
        reason: `Incomplete typed property object (type=${obj.type}, missing value)`,
        rawShape: JSON.stringify(val).substring(0, 200),
        stage: "coercePropToString",
      });
      return "";
    }
    if (typeof obj.value === "string") return obj.value;
    if (typeof obj.name === "string") return obj.name;
    console.warn(`[coercePropToString] Unrecognized object shape — blocked to prevent [object Object] leakage: ${JSON.stringify(obj).substring(0, 120)}`);
    emitTypedPropertyDiagnostic({
      workflowFile: _activeRemediationContext?.fileName || "unknown",
      templateName: "(coercePropToString)",
      propertyName: "(unknown)",
      classification: "unsupported-structured",
      action: "blocked",
      reason: `Unrecognized object shape blocked at coercePropToString boundary`,
      rawShape: JSON.stringify(val).substring(0, 200),
      stage: "coercePropToString",
    });
    return "";
  }
  return String(val);
}

export function getPropString(props: Record<string, PropertyValue>, ...keys: string[]): string {
  for (const key of keys) {
    if (props[key] !== undefined) {
      const val = props[key];
      if (isBlockedPropertyValue(val)) {
        console.warn(`[getPropString] Property "${key}" is blocked — withholding from emission`);
        emitTypedPropertyDiagnostic({
          workflowFile: _activeRemediationContext?.fileName || "unknown",
          templateName: "(getPropString)",
          propertyName: key,
          classification: "unsupported-structured",
          action: "blocked",
          reason: "Blocked property sentinel detected in getPropString — property withheld",
          stage: "getPropString-sentinel-check",
        });
        continue;
      }
      if (typeof val === "string") {
        const extracted = extractValueIntentFromString(val);
        if (extracted !== null) return extracted;
        return val;
      }
      if (isValueIntent(val)) {
        const vi = val as ValueIntent;
        if (vi.type === "literal" && vi.value === BLOCKED_PROPERTY_SENTINEL) {
          console.warn(`[getPropString] ValueIntent for "${key}" contains blocked sentinel — withholding`);
          emitTypedPropertyDiagnostic({
            workflowFile: _activeRemediationContext?.fileName || "unknown",
            templateName: "(getPropString)",
            propertyName: key,
            classification: "unsupported-structured",
            action: "blocked",
            reason: "Blocked property sentinel in ValueIntent detected in getPropString",
            stage: "getPropString-sentinel-check",
          });
          continue;
        }
        return buildExpression(vi);
      }
      return coercePropToString(val);
    }
  }
  return "";
}

function extractValueIntentFromString(s: string): string | null {
  const jsonResult = tryParseJsonValueIntent(s);
  if (jsonResult) {
    const resolved = buildExpression(jsonResult.intent);
    emitJsonResolutionDiagnostic(s, jsonResult.intent, resolved, jsonResult.fallbackUsed);
    return resolved;
  }
  return null;
}

export interface InvokeArgumentBinding {
  name: string;
  direction: "InArgument" | "OutArgument" | "InOutArgument";
  type: string;
  value: string;
  typeInferredFromDefault?: boolean;
}

export function parseInvokeArguments(props: Record<string, PropertyValue>): InvokeArgumentBinding[] {
  const bindings: InvokeArgumentBinding[] = [];

  const rawArgs = getPropString(props, "Arguments", "arguments");
  if (rawArgs) {
    const dictDecomposed = decomposeDictionaryArgBag(rawArgs);
    if (dictDecomposed.length > 0) {
      return dictDecomposed;
    }
  }

  for (const [key, val] of Object.entries(props)) {
    if (key === "WorkflowFileName" || key === "workflowFileName" ||
        key === "DisplayName" || key === "displayName" ||
        key === "ContinueOnError" || key === "continueOnError" ||
        key === "Timeout" || key === "timeout" ||
        key === "Isolated" || key === "isolated" ||
        key === "Arguments" || key === "arguments") continue;

    if (isArgumentNamedBinding(key)) {
      const direction = inferDirectionFromPrefix(key);
      const strVal = typeof val === "string" ? val : coercePropToString(val);
      const cleanVal = strVal.replace(/^\[|\]$/g, "").trim();
      const inferredType = inferTypeFromPrefix(cleanVal);
      const type = inferredType || "";
      const wrappedVal = ensureBracketWrapped(strVal, _activeDeclarationLookup || undefined);
      bindings.push({ name: key, direction, type, value: wrappedVal, typeInferredFromDefault: !inferredType });
    }
  }

  return bindings;
}

function isArgumentNamedBinding(name: string): boolean {
  return /^(in_|out_|io_)/i.test(name);
}

function inferDirectionFromPrefix(name: string): "InArgument" | "OutArgument" | "InOutArgument" {
  const lower = name.toLowerCase();
  if (lower.startsWith("out_")) return "OutArgument";
  if (lower.startsWith("io_")) return "InOutArgument";
  return "InArgument";
}

function decomposeDictionaryArgBag(rawArgs: string): InvokeArgumentBinding[] {
  const bindings: InvokeArgumentBinding[] = [];

  const dictPattern = /Dictionary\s*\(\s*Of\s+String\s*,\s*Object\s*\)\s*From\s*\{([\s\S]*)\}/i;
  const dictMatch = rawArgs.match(dictPattern);
  if (!dictMatch) return bindings;

  const outerContent = dictMatch[1].trim();
  const kvPairs = splitDictionaryPairs(outerContent);

  for (const pair of kvPairs) {
    const pairContent = pair.trim();
    const pairMatch = pairContent.match(/^\s*"([^"]+)"\s*,\s*([\s\S]+?)\s*$/);
    if (!pairMatch) continue;

    const argName = pairMatch[1].trim();
    const argValue = pairMatch[2].trim();

    if (!isArgumentNamedBinding(argName)) continue;

    const direction = inferDirectionFromPrefix(argName);
    const cleanVal = argValue.replace(/^\[|\]$/g, "").trim();
    const inferredType = inferTypeFromPrefix(cleanVal);
    const type = inferredType || "";
    const wrappedVal = ensureBracketWrapped(argValue, _activeDeclarationLookup || undefined);
    bindings.push({ name: argName, direction, type, value: wrappedVal, typeInferredFromDefault: !inferredType });
  }

  return bindings;
}

function splitDictionaryPairs(content: string): string[] {
  const pairs: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") {
      depth++;
      current += ch;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        current += ch;
        const trimmed = current.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          pairs.push(trimmed.slice(1, -1));
        } else if (trimmed) {
          pairs.push(trimmed);
        }
        current = "";
      } else {
        current += ch;
      }
    } else if (ch === "," && depth === 0) {
      current = "";
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) {
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      pairs.push(trimmed.slice(1, -1));
    } else if (trimmed) {
      pairs.push(trimmed);
    }
  }
  return pairs;
}

export type EmissionContext = "normal" | "mandatory-catch" | "mandatory-finally" | "inside-trycatch";

export function resolveActivityTemplate(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType = "general",
  emissionContext: EmissionContext = "normal"
): string {
  const templateName = node.template;
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);

  const dispatchKey = templateName.includes(":") ? templateName.replace(/^[A-Za-z0-9]+:/, "") : templateName;
  const wasNormalized = dispatchKey !== templateName;
  if (wasNormalized) {
    console.log(`[Template Dispatch] Normalized "${templateName}" → dispatchKey "${dispatchKey}"`);
  }

  const DEDICATED_TEMPLATE_REQUIRED_GUARANTEES: Record<string, string[]> = {
    "SendSmtpMailMessage": ["Body"],
    "GmailSendMessage": ["Body", "To", "Subject"],
    "SendOutlookMailMessage": ["Body", "To", "Subject"],
    "SendMail365": ["Body", "To", "Subject"],
    "LogMessage": ["Message"],
    "InvokeWorkflowFile": ["WorkflowFileName"],
  };

  if (wasNormalized) {
    const guarantees = DEDICATED_TEMPLATE_REQUIRED_GUARANTEES[dispatchKey] || [];
    if (_templateDispatchNormalizations.length < NORMALIZATION_BUFFER_LIMIT) {
      const record: TemplateDispatchNormalizationRecord = {
        originalTemplate: templateName,
        normalizedDispatchKey: dispatchKey,
        displayName: node.displayName,
        inRequiredPropertyGuaranteeMap: guarantees.length > 0,
        requiredPropertyGuaranteed: guarantees,
      };
      if (dispatchKey === "SendSmtpMailMessage" || dispatchKey === "GmailSendMessage" || dispatchKey === "SendOutlookMailMessage" || dispatchKey === "SendMail365") {
        const bodyProvided = !!(props.Body && String(props.Body).trim());
        record.confirmedPairDetail = {
          sourcePresent: bodyProvided,
          valueSource: bodyProvided ? "upstream" : "fallback",
          fallbackApplied: !bodyProvided,
          chosenValue: bodyProvided ? String(props.Body) : "str_EmailBody",
        };
      }
      _templateDispatchNormalizations.push(record);
    }
  }

  if (dispatchKey === "Assign") {
    return applyCatalogConformance(resolveAssignTemplate(node, allVariables));
  }

  if (dispatchKey === "LogMessage") {
    const ENUM_NORMALIZE: Record<string, string> = {
      "information": "Info", "warning": "Warn", "debug": "Trace",
      "info": "Info", "warn": "Warn", "error": "Error", "trace": "Trace", "fatal": "Fatal",
      "verbose": "Trace", "critical": "Fatal",
    };
    const rawLevel = (getPropString(props, "Level", "level") || "Info")
      .replace(/&quot;/g, "").replace(/^"+|"+$/g, "").trim();
    const level = ENUM_NORMALIZE[rawLevel.toLowerCase()] || rawLevel;
    const messageRaw = props.Message || props.message;
    let message: string;
    if (messageRaw !== undefined && isValueIntent(messageRaw)) {
      message = buildExpression(messageRaw as ValueIntent);
    } else if (typeof messageRaw === "string" && containsValueIntentJson(messageRaw)) {
      const jsonResult = tryParseJsonValueIntent(messageRaw);
      if (jsonResult) {
        message = buildExpression(jsonResult.intent);
        emitJsonResolutionDiagnostic(messageRaw, jsonResult.intent, message, jsonResult.fallbackUsed);
      } else {
        message = getPropString(props, "Message", "message") || `"${displayName}"`;
      }
    } else {
      message = getPropString(props, "Message", "message") || `"${displayName}"`;
    }
    let wrappedMessage: string;
    if (looksLikePlainText(message, _activeDeclarationLookup || undefined)) {
      wrappedMessage = `"${message.replace(/"/g, '""')}"`;
    } else {
      wrappedMessage = smartBracketWrap(message, _activeDeclarationLookup || undefined);
    }
    return applyCatalogConformance(`<ui:LogMessage Level="${serializeSafeAttributeValue(level)}" Message="${serializeSafeAttributeValue(wrappedMessage)}" DisplayName="${displayName}" />`);
  }

  if (dispatchKey === "Delay") {
    const duration = getPropString(props, "Duration", "duration") || "00:00:05";
    return applyCatalogConformance(`<Delay Duration="${serializeSafeAttributeValue(duration)}" DisplayName="${displayName}" />`);
  }

  if (dispatchKey === "Rethrow") {
    return applyCatalogConformance(`<Rethrow DisplayName="${displayName}" />`);
  }

  if (dispatchKey === "InvokeWorkflowFile") {
    let fileName = (getPropString(props, "WorkflowFileName", "workflowFileName") || "Workflow.xaml")
      .replace(/&quot;/g, "").replace(/^"+|"+$/g, "").trim();
    fileName = fileName.replace(/\{type:[^}]*,value:([^}]*)\}/g, "$1").replace(/\{"type":"[^"]*","value":"([^"]*)"\}/g, "$1").replace(/[{}]/g, "");
    if (!fileName.endsWith(".xaml")) fileName += ".xaml";

    const argBindings = parseInvokeArguments(props);

    const calleeContract = _activeWorkflowContractMap
      ? _activeWorkflowContractMap.get(fileName.toLowerCase()) || null
      : null;

    let resolvedBindings: InvokeArgumentBinding[];
    if (calleeContract) {
      resolvedBindings = [];
      const matchedContractArgs = new Set<string>();

      for (const binding of argBindings) {
        const resolution = resolveBindingAgainstContract(binding, calleeContract);
        if (resolution.matched && resolution.contractArg) {
          const emittedName = resolution.contractArg.name;
          const emittedDirection = resolution.contractArg.direction;
          const emittedType = resolution.contractArg.type || binding.type;
          matchedContractArgs.add(emittedName.toLowerCase());
          resolvedBindings.push({
            name: emittedName,
            direction: emittedDirection,
            type: emittedType,
            value: binding.value,
            typeInferredFromDefault: binding.typeInferredFromDefault,
          });
        } else {
          _contractDiagnostics.push({
            kind: "unsupported_binding",
            callerWorkflow: _activeCallerWorkflowName,
            calleeFile: fileName,
            bindingName: binding.name,
            reason: `Binding "${binding.name}" does not match any argument in callee contract for "${fileName}". Callee declares: [${calleeContract.arguments.map(a => a.name).join(", ")}]. Binding withheld from emission.`,
          });
          console.warn(`[Contract Resolution] Unsupported binding "${binding.name}" withheld from InvokeWorkflowFile "${fileName}" — no matching callee argument found`);
        }
      }

      for (const contractArg of calleeContract.arguments) {
        if (matchedContractArgs.has(contractArg.name.toLowerCase())) continue;
        if (contractArg.direction !== "InArgument") continue;

        const callerVarName = _activeDeclarationLookup
          ? (() => {
              const stripped = stripDirectionPrefix(contractArg.name);
              const strippedLower = stripped.charAt(0).toLowerCase() + stripped.slice(1);
              const candidates = [
                contractArg.name,
                `in_${stripped}`,
                `In${stripped}`,
                stripped,
                `str_${strippedLower}`,
                `str_${stripped}`,
                strippedLower,
              ];
              for (const candidate of candidates) {
                if (_activeDeclarationLookup(candidate)) return candidate;
              }
              return null;
            })()
          : null;

        const bindingValue = callerVarName
          ? `[${callerVarName}]`
          : buildCanonicalTodoExpressionAttributeValue(
              `Bind ${contractArg.name}`,
              "workflow-tree-assembler:caller-binding-fallback",
            );

        if (!callerVarName) {
          _contractDiagnostics.push({
            kind: "unsupported_binding",
            callerWorkflow: _activeCallerWorkflowName,
            calleeFile: fileName,
            bindingName: contractArg.name,
            reason: `No matching caller variable found for required InArgument "${contractArg.name}" in callee "${fileName}". Emitting TODO placeholder binding.`,
          });
          console.warn(`[Contract Resolution] No caller variable for required InArgument "${contractArg.name}" on "${fileName}" — emitting TODO placeholder`);
        } else {
          console.log(`[Contract Resolution] Auto-bound missing InArgument "${contractArg.name}" to caller variable "${callerVarName}" for "${fileName}"`);
        }

        resolvedBindings.push({
          name: contractArg.name,
          direction: contractArg.direction,
          type: contractArg.type || "",
          value: bindingValue,
          typeInferredFromDefault: false,
        });
      }
    } else {
      resolvedBindings = argBindings;
      if (_activeWorkflowContractMap) {
        _contractDiagnostics.push({
          kind: "unresolved_callee",
          callerWorkflow: _activeCallerWorkflowName,
          calleeFile: fileName,
          reason: `No pre-emission contract available for callee "${fileName}". Falling through to default emission; post-emission validator/canonicalizer will act as safety net.`,
        });
        console.log(`[Contract Resolution] No pre-emission contract for callee "${fileName}" — using default emission path`);
      }
    }

    let argBlock = "";
    for (const binding of resolvedBindings) {
      if (binding.type) {
        argBlock += `    <${binding.direction} x:TypeArguments="${binding.type}" x:Key="${escapeXml(binding.name)}">${escapeXmlTextContent(binding.value)}</${binding.direction}>\n`;
      } else {
        argBlock += `    <${binding.direction} x:Key="${escapeXml(binding.name)}">${escapeXmlTextContent(binding.value)}</${binding.direction}>\n`;
      }
    }

    return applyCatalogConformance(`<ui:InvokeWorkflowFile WorkflowFileName="${serializeSafeAttributeValue(fileName)}" DisplayName="${displayName}">\n` +
      `  <ui:InvokeWorkflowFile.Arguments>\n` +
      argBlock +
      `  </ui:InvokeWorkflowFile.Arguments>\n` +
      `</ui:InvokeWorkflowFile>`);
  }

  if (dispatchKey === "GetAsset") {
    return applyCatalogConformance(resolveGetAssetTemplate(node));
  }

  if (dispatchKey === "GetCredential") {
    return applyCatalogConformance(resolveGetCredentialTemplate(node));
  }

  if (dispatchKey === "SendSmtpMailMessage") {
    return applyCatalogConformance(resolveSendSmtpMailMessageTemplate(node));
  }

  if (dispatchKey === "GmailSendMessage") {
    return applyCatalogConformance(resolveGmailSendMessageTemplate(node));
  }

  if (dispatchKey === "SendOutlookMailMessage") {
    return applyCatalogConformance(resolveSendOutlookMailMessageTemplate(node));
  }

  if (dispatchKey === "SendMail365") {
    return applyCatalogConformance(resolveSendMail365Template(node));
  }

  if (dispatchKey === "GetImapMailMessage") {
    return applyCatalogConformance(resolveGetImapMailMessageTemplate(node));
  }

  if (dispatchKey === "CreateFormTask") {
    return applyCatalogConformance(resolveCreateFormTaskTemplate(node));
  }

  if (dispatchKey === "HttpClient") {
    return applyCatalogConformance(resolveHttpClientTemplate(node));
  }

  if (dispatchKey === "ExcelApplicationScope") {
    return applyCatalogConformance(resolveExcelApplicationScopeTemplate(node, allVariables, processType, emissionContext));
  }

  if (dispatchKey === "UseExcel") {
    return applyCatalogConformance(resolveUseExcelTemplate(node, allVariables, processType, emissionContext));
  }

  if (dispatchKey === "DeserializeJson") {
    const input = getPropString(props, "JsonString", "jsonString", "Input") || "";
    const outputVar = node.outputVar || "obj_Result";
    const djTag = getActivityTag("DeserializeJson");
    return applyCatalogConformance(`<${djTag} DisplayName="${displayName}" JsonString="${serializeSafeAttributeValue(input)}">\n` +
      `  <${djTag}.Result>\n` +
      `    <OutArgument x:TypeArguments="x:Object">${escapeXmlTextContent(ensureBracketWrapped(outputVar, _activeDeclarationLookup || undefined))}</OutArgument>\n` +
      `  </${djTag}.Result>\n` +
      `</${djTag}>`);
  }

  if (dispatchKey === "Comment") {
    const text = getPropString(props, "Text", "text") || "";
    return applyCatalogConformance(`<ui:Comment Text="${serializeSafeAttributeValue(text)}" DisplayName="${displayName}" />`);
  }

  if (wasNormalized) {
    console.log(`[Template Dispatch] No dedicated template matched for dispatchKey "${dispatchKey}" (original: "${templateName}") — falling through to dynamic/fallback path`);
  }

  const UNSUPPORTED_ACTIVITIES = new Set([
    "InvokeAgent",
  ]);

  if (UNSUPPORTED_ACTIVITIES.has(dispatchKey)) {
    const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
    console.warn(`[Tree Assembler] Unsupported activity "${templateName}" — "${node.displayName}"${isMandatoryPath ? " (in mandatory path)" : ""}. Emitting fallback.`);
    if (_activeRemediationContext) {
      _activeRemediationContext.propertyRemediations.push({
        level: "activity",
        file: _activeRemediationContext.fileName,
        remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
        originalTag: templateName,
        originalDisplayName: node.displayName,
        propertyName: isMandatoryPath ? "(unsupported-activity-mandatory-path)" : "(unsupported-activity)",
        reason: `Activity "${templateName}" is not supported — no valid catalog entry or package mapping exists. Business step "${node.displayName}" requires manual implementation.${isMandatoryPath ? " This activity is in a mandatory execution path (catch/finally block) — the workflow is BLOCKED until resolved." : ""}`,
        classifiedCheck: "UNSUPPORTED_ACTIVITY",
        developerAction: `Manually implement "${node.displayName}" using supported activities — "${templateName}" has no valid package mapping`,
        estimatedEffortMinutes: isMandatoryPath ? 45 : 30,
      });
    }
    if (isMandatoryPath) {
      return `<!-- BLOCKED: Unsupported activity "${escapeXml(templateName)}" in mandatory ${emissionContext === "mandatory-catch" ? "catch" : "finally"} path — "${escapeXml(node.displayName)}" requires manual implementation -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Unsupported activity &apos;${escapeXml(templateName)}&apos; in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
    }
    return `<!-- WARNING: Unsupported activity "${escapeXml(templateName)}" — "${escapeXml(node.displayName)}" requires manual implementation -->
<ui:Comment Text="[BLOCKED] Unsupported activity: ${escapeXml(templateName)}. Business step &quot;${escapeXml(node.displayName)}&quot; requires manual implementation using supported UiPath activities." DisplayName="${escapeXml(node.displayName)} (unsupported — manual implementation required)" />
<ui:LogMessage Level="Warn" Message="[&quot;WARNING: Business step &apos;${escapeXml(node.displayName)}&apos; uses unsupported activity &apos;${escapeXml(templateName)}&apos; — requires manual implementation&quot;]" DisplayName="Log Unsupported Activity Warning" />`;
  }

  if (catalogService.isLoaded()) {
    const filteredTemplateResult = getFilteredSchema(templateName, "workflow-tree-assembler", _activeTargetFramework);
    if (filteredTemplateResult.status !== "approved") {
      const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
      const rejectionLabel = filteredTemplateResult.status === "rejected" ? filteredTemplateResult.reason : "unknown-activity";
      console.warn(`[Tree Assembler] Rejected template "${templateName}" (${rejectionLabel}) — not approved for emission${isMandatoryPath ? " (in mandatory path)" : ""}, emitting fallback`);
      if (_activeRemediationContext) {
        _activeRemediationContext.propertyRemediations.push({
          level: "activity",
          file: _activeRemediationContext.fileName,
          remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
          originalTag: templateName,
          originalDisplayName: node.displayName,
          propertyName: isMandatoryPath ? `(${rejectionLabel}-mandatory-path)` : `(${rejectionLabel})`,
          reason: `Activity "${templateName}" is rejected (${rejectionLabel}). Business step "${node.displayName}" requires manual implementation.${isMandatoryPath ? " This activity is in a mandatory execution path — the workflow is BLOCKED until resolved." : ""}`,
          classifiedCheck: "CATALOG_VIOLATION",
          developerAction: `Verify and implement "${node.displayName}" (${templateName}) using supported activities`,
          estimatedEffortMinutes: isMandatoryPath ? 30 : 20,
        });
      }
      if (isMandatoryPath) {
        return `<!-- BLOCKED: Rejected activity "${escapeXml(templateName)}" (${rejectionLabel}) in mandatory ${emissionContext === "mandatory-catch" ? "catch" : "finally"} path — "${escapeXml(node.displayName)}" -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Rejected activity &apos;${escapeXml(templateName)}&apos; (${rejectionLabel}) in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
      }
      return `<!-- WARNING: Rejected activity template "${escapeXml(templateName)}" (${rejectionLabel}) — "${escapeXml(node.displayName)}" not approved for emission -->
<ui:Comment Text="[BLOCKED] Rejected activity: ${escapeXml(templateName)} (${rejectionLabel}). Business step &quot;${escapeXml(node.displayName)}&quot; requires manual implementation." DisplayName="${escapeXml(node.displayName)} (${rejectionLabel} — manual implementation required)" />
<ui:LogMessage Level="Warn" Message="[&quot;WARNING: Business step &apos;${escapeXml(node.displayName)}&apos; uses rejected activity &apos;${escapeXml(templateName)}&apos; (${rejectionLabel}) — requires manual implementation&quot;]" DisplayName="Log Rejected Activity Warning" />`;
    }
  } else {
    const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
    console.error(`[Tree Assembler] Catalog not loaded — cannot resolve template "${templateName}" safely${isMandatoryPath ? " (in mandatory path)" : ""}. Emitting stub.`);
    if (_activeRemediationContext) {
      _activeRemediationContext.propertyRemediations.push({
        level: "activity",
        file: _activeRemediationContext.fileName,
        remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
        originalTag: templateName,
        originalDisplayName: node.displayName,
        propertyName: isMandatoryPath ? "(catalog-not-loaded-mandatory-path)" : "(catalog-not-loaded)",
        reason: `Catalog not loaded — cannot verify template "${templateName}" structure. Emitting stub to avoid schema-less degradation.${isMandatoryPath ? " This is in a mandatory execution path — workflow is BLOCKED." : ""}`,
        classifiedCheck: "CATALOG_VIOLATION",
        developerAction: `Verify and re-implement "${node.displayName}" (${templateName}) — catalog was not available at emission time`,
        estimatedEffortMinutes: isMandatoryPath ? 25 : 15,
      });
    }
    if (isMandatoryPath) {
      return `<!-- BLOCKED: Catalog not loaded for "${escapeXml(templateName)}" in mandatory ${emissionContext === "mandatory-catch" ? "catch" : "finally"} path -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Activity &apos;${escapeXml(templateName)}&apos; could not be validated (catalog not loaded) in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
    }
    return `<!-- CATALOG NOT LOADED: ${escapeXml(templateName)} — "${escapeXml(node.displayName)}" -->
<ui:Comment Text="[TODO - Activity ${escapeXml(templateName)} requires catalog validation. Manual implementation required.]" DisplayName="${escapeXml(node.displayName)} (stub)" />`;
  }

  return resolveDynamicTemplate(node, processType, emissionContext);
}

function resolveAssignTemplate(node: ActivityNode, allVariables: VariableDeclaration[]): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const toRaw = props.To || props.to || node.outputVar || "obj_Result";
  const valRaw = props.Value || props.value || '""';
  let toVarName: string;
  if (isValueIntent(toRaw) && (toRaw as ValueIntent).type === "variable") {
    toVarName = (toRaw as ValueIntent & { type: "variable" }).name;
  } else if (isValueIntent(toRaw)) {
    toVarName = buildExpression(toRaw as ValueIntent);
  } else {
    const toStr = String(toRaw);
    if (containsValueIntentJson(toStr)) {
      const jsonResult = tryParseJsonValueIntent(toStr);
      if (jsonResult) {
        if (jsonResult.intent.type === "variable") {
          toVarName = jsonResult.intent.name;
        } else {
          toVarName = buildExpression(jsonResult.intent);
        }
        emitJsonResolutionDiagnostic(toStr, jsonResult.intent, toVarName, jsonResult.fallbackUsed);
      } else {
        toVarName = toStr;
      }
    } else {
      toVarName = toStr;
    }
  }

  const INVALID_TO_VALUES = new Set(["Nothing", "null", "", "undefined", '""', "''", "Nothing "]);
  const cleanedTo = toVarName.replace(/^\[+|\]+$/g, "").trim();
  if (INVALID_TO_VALUES.has(cleanedTo) || !cleanedTo) {
    _sweepFallbackCounter++;
    const safeName = `obj_REVIEW_${node.displayName.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").substring(0, 40)}_UnresolvedTarget_${_sweepFallbackCounter}`;
    console.warn(`[Assign Guard] Assign "${node.displayName}" has invalid To target "${toVarName}" — generating fallback variable "${safeName}"`);

    _lateDiscoveredVariables.push({
      name: safeName,
      type: "x:Object",
    });

    if (_activeRemediationContext) {
      _activeRemediationContext.propertyRemediations.push({
        level: "property",
        file: _activeRemediationContext.fileName,
        remediationCode: "ASSIGN_TO_FALLBACK_VARIABLE",
        originalTag: "Assign",
        originalDisplayName: node.displayName,
        propertyName: "To",
        reason: `Assign.To resolved to invalid value "${toVarName}" — generated fallback variable "${safeName}". Manual review required to assign the correct target variable.`,
        classifiedCheck: "UNRESOLVED_ASSIGN_TARGET",
        developerAction: `Replace fallback variable "${safeName}" with the correct target variable in Assign "${node.displayName}"`,
        estimatedEffortMinutes: 10,
      });
    }

    toVarName = safeName;
  }

  const typeArg = inferAssignType(toVarName, allVariables);
  const wrappedTo = ensureBracketWrapped(toVarName, _activeDeclarationLookup || undefined);
  const wrappedVal = resolvePropertyValue(valRaw as PropertyValue);

  const safeToExpr = escapeXmlTextContent(normalizeXmlExpression(wrappedTo));
  let safeValExpr = escapeXmlTextContent(normalizeXmlExpression(wrappedVal));

  if (typeArg === "x:Object") {
    const valContent = safeValExpr.trim();
    const isLiteral = !(valContent.startsWith("[") && valContent.endsWith("]"));
    if (isLiteral && valContent.length > 0) {
      safeValExpr = `[${valContent}]`;
      console.warn(`[Argument Guard] Bracket-wrapping literal value "${valContent}" for x:Object Assign "${displayName}"`);
    }
  }

  const rawExpr = safeValExpr.startsWith("[") && safeValExpr.endsWith("]")
    ? safeValExpr.slice(1, -1) : safeValExpr;
  const decomposed = decomposeComplexExpression(rawExpr, toVarName, node.displayName);
  if (decomposed.intermediateAssigns.length > 0) {
    console.log(`[Expression Decomposition] Decomposed complex expression in "${displayName}" into ${decomposed.intermediateAssigns.length} intermediate step(s)`);
    for (const iv of decomposed.intermediateVariables) {
      _lateDiscoveredVariables.push(iv);
    }
    const finalExpr = decomposed.finalExpression.startsWith("[") ? decomposed.finalExpression : `[${decomposed.finalExpression}]`;
    const finalAssign = `<Assign DisplayName="${displayName}">\n` +
      `  <Assign.To>\n` +
      `    <OutArgument x:TypeArguments="${typeArg}">${safeToExpr}</OutArgument>\n` +
      `  </Assign.To>\n` +
      `  <Assign.Value>\n` +
      `    <InArgument x:TypeArguments="${typeArg}">${escapeXmlTextContent(normalizeXmlExpression(finalExpr))}</InArgument>\n` +
      `  </Assign.Value>\n` +
      `</Assign>`;
    return decomposed.intermediateAssigns.join("\n") + "\n" + finalAssign;
  }

  return `<Assign DisplayName="${displayName}">\n` +
    `  <Assign.To>\n` +
    `    <OutArgument x:TypeArguments="${typeArg}">${safeToExpr}</OutArgument>\n` +
    `  </Assign.To>\n` +
    `  <Assign.Value>\n` +
    `    <InArgument x:TypeArguments="${typeArg}">${safeValExpr}</InArgument>\n` +
    `  </Assign.Value>\n` +
    `</Assign>`;
}

function isValidOutputVariableName(val: string): boolean {
  if (!val || val === "Nothing") return false;
  if (/[()."'\[\]]/.test(val)) return false;
  if (/^dict_\w+\(/.test(val)) return false;
  if (val.includes("dict_Config(")) return false;
  if (/\.\w+\(/.test(val)) return false;
  return /^[a-zA-Z_]\w*$/.test(val);
}

function deriveAssetOutputVariable(assetName: string | unknown, assetType: string = "String"): string {
  const name = coercePropToString(assetName);
  if (!name || name.startsWith("PLACEHOLDER_")) return "str_REVIEW_AssetOutput";
  let cleanName = name;
  const dotIdx = cleanName.indexOf(".");
  if (dotIdx >= 0) {
    cleanName = cleanName.substring(dotIdx + 1);
  }
  cleanName = cleanName.replace(/[^a-zA-Z0-9_]/g, "");
  if (!cleanName) return "str_REVIEW_AssetOutput";
  const typePrefix = assetType.toLowerCase().startsWith("int") ? "int_"
    : assetType.toLowerCase().startsWith("bool") ? "bool_"
    : "str_";
  return `${typePrefix}${cleanName}`;
}

function resolveGetAssetTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const assetName = getPropString(props, "AssetName", "assetName") || "PLACEHOLDER_AssetName";
  const assetType = getPropString(props, "AssetType", "assetType") || "String";

  const rawOutputVar = node.outputVar || getPropString(props, "AssetValue", "Value");

  let outputVar: string;
  if (rawOutputVar && isValidOutputVariableName(rawOutputVar)) {
    outputVar = rawOutputVar;
  } else if (assetName && !assetName.startsWith("PLACEHOLDER_")) {
    outputVar = deriveAssetOutputVariable(assetName, assetType);
    console.log(`[GetAsset] Tier 2: derived output variable "${outputVar}" from asset name "${assetName}"`);
  } else {
    outputVar = "str_REVIEW_AssetOutput";
    console.warn(`[GetAsset] Tier 3: using stub variable "str_REVIEW_AssetOutput" for asset "${assetName}" — needs manual binding`);
    console.warn(`[DHG_REMEDIATION] GetAsset output binding unresolved: asset="${assetName}", activity="${node.displayName}", stub_var="str_REVIEW_AssetOutput" — developer must create a correctly-named output variable and bind it to this GetAsset activity`);
  }

  const outArgType = outputVar.startsWith("int_") ? "x:Int32"
    : outputVar.startsWith("bool_") ? "x:Boolean"
    : outputVar.startsWith("dbl_") ? "x:Double"
    : "x:String";

  return `<ui:GetAsset DisplayName="${displayName}" AssetName="${serializeSafeAttributeValue(assetName)}">\n` +
    `  <ui:GetAsset.AssetValue>\n` +
    `    <OutArgument x:TypeArguments="${outArgType}">${escapeXmlTextContent(ensureBracketWrapped(outputVar, _activeDeclarationLookup || undefined))}</OutArgument>\n` +
    `  </ui:GetAsset.AssetValue>\n` +
    `</ui:GetAsset>`;
}

function resolveGetCredentialTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const assetName = getPropString(props, "AssetName", "assetName") || "PLACEHOLDER_CredentialName";
  const usernameVar = getPropString(props, "Username", "username") || "str_Username";
  const passwordVar = getPropString(props, "Password", "password") || "sec_Password";

  return `<ui:GetCredential DisplayName="${displayName}" AssetName="${serializeSafeAttributeValue(assetName)}">\n` +
    `  <ui:GetCredential.Username>\n` +
    `    <OutArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(usernameVar, _activeDeclarationLookup || undefined))}</OutArgument>\n` +
    `  </ui:GetCredential.Username>\n` +
    `  <ui:GetCredential.Password>\n` +
    `    <OutArgument x:TypeArguments="s:Security.SecureString">${escapeXmlTextContent(ensureBracketWrapped(passwordVar, _activeDeclarationLookup || undefined))}</OutArgument>\n` +
    `  </ui:GetCredential.Password>\n` +
    `</ui:GetCredential>`;
}

function wrapSmtpPropValue(val: string): string {
  if (!val) return val;
  return smartBracketWrap(val, _activeDeclarationLookup || undefined);
}

function resolveSendSmtpMailMessageTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const to = getPropString(props, "To", "to") || "PLACEHOLDER_To";
  const from = getPropString(props, "From", "from");
  const subject = getPropString(props, "Subject", "subject") || "PLACEHOLDER_Subject";
  const body = getPropString(props, "Body", "body") || "";
  const server = getPropString(props, "Server", "server") || "PLACEHOLDER_SmtpServer";
  const port = getPropString(props, "Port", "port") || "587";
  const email = getPropString(props, "Email", "email");
  const password = getPropString(props, "Password", "password");
  const username = getPropString(props, "Username", "username");
  const isBodyHtml = getPropString(props, "IsBodyHtml", "isBodyHtml") || "False";

  const wrappedTo = wrapSmtpPropValue(to);
  const wrappedSubject = wrapSmtpPropValue(subject);

  let attrs = `DisplayName="${displayName}" To="${serializeSafeAttributeValue(wrappedTo)}" Subject="${serializeSafeAttributeValue(wrappedSubject)}"`;
  attrs += ` IsBodyHtml="${serializeSafeAttributeValue(isBodyHtml)}"`;
  attrs += ` Server="${serializeSafeAttributeValue(server)}" Port="${serializeSafeAttributeValue(port)}"`;
  if (from) attrs += ` From="${serializeSafeAttributeValue(wrapSmtpPropValue(from))}"`;
  if (email) attrs += ` Email="${serializeSafeAttributeValue(wrapSmtpPropValue(email))}"`;
  if (username) attrs += ` Username="${serializeSafeAttributeValue(wrapSmtpPropValue(username))}"`;
  if (password) attrs += ` Password="${serializeSafeAttributeValue(wrapSmtpPropValue(password))}"`;

  const bodyBinding = body || "str_EmailBody";
  const safeBody = escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(bodyBinding), _activeDeclarationLookup || undefined));
  let bodyChildParts = "";
  if (!body) {
    bodyChildParts += `  <!-- HANDOFF: Body binding was not provided — using placeholder variable str_EmailBody. Replace with actual email body content. -->\n`;
  }
  bodyChildParts += `  <ui:SendSmtpMailMessage.Body>\n` +
    `    <InArgument x:TypeArguments="x:String">${safeBody}</InArgument>\n` +
    `  </ui:SendSmtpMailMessage.Body>\n`;
  return `<ui:SendSmtpMailMessage ${attrs}>\n` +
    bodyChildParts +
    `</ui:SendSmtpMailMessage>`;
}

function resolveGmailSendMessageTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const to = getPropString(props, "To", "to") || "PLACEHOLDER_To";
  const subject = getPropString(props, "Subject", "subject") || "PLACEHOLDER_Subject";
  const body = getPropString(props, "Body", "body") || "";
  const cc = getPropString(props, "Cc", "cc");
  const bcc = getPropString(props, "Bcc", "bcc");
  const isBodyHtml = getPropString(props, "IsBodyHtml", "isBodyHtml") || "False";

  const tag = getActivityTag("GmailSendMessage");
  let attrs = `DisplayName="${displayName}"`;
  attrs += ` IsBodyHtml="${serializeSafeAttributeValue(isBodyHtml)}"`;

  const safeBody = body
    ? escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(body), _activeDeclarationLookup || undefined))
    : escapeXmlTextContent(ensureBracketWrapped("str_EmailBody", _activeDeclarationLookup || undefined));

  let childParts = "";
  childParts += `  <${tag}.To>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(to), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.To>\n`;
  childParts += `  <${tag}.Subject>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(subject), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.Subject>\n`;
  if (!body) {
    childParts += `  <!-- HANDOFF: Body binding was not provided — using placeholder variable str_EmailBody. Replace with actual email body content. -->\n`;
  }
  childParts += `  <${tag}.Body>\n    <InArgument x:TypeArguments="x:String">${safeBody}</InArgument>\n  </${tag}.Body>\n`;
  if (cc) childParts += `  <${tag}.Cc>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(cc), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.Cc>\n`;
  if (bcc) childParts += `  <${tag}.Bcc>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(bcc), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.Bcc>\n`;

  return `<${tag} ${attrs}>\n${childParts}</${tag}>`;
}

function resolveSendOutlookMailMessageTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const to = getPropString(props, "To", "to") || "PLACEHOLDER_To";
  const subject = getPropString(props, "Subject", "subject") || "PLACEHOLDER_Subject";
  const body = getPropString(props, "Body", "body") || "";
  const cc = getPropString(props, "Cc", "cc");
  const bcc = getPropString(props, "Bcc", "bcc");
  const isBodyHtml = getPropString(props, "IsBodyHtml", "isBodyHtml") || "True";
  const account = getPropString(props, "Account", "account");

  const tag = getActivityTag("SendOutlookMailMessage");
  let attrs = `DisplayName="${displayName}" To="${serializeSafeAttributeValue(wrapSmtpPropValue(to))}" Subject="${serializeSafeAttributeValue(wrapSmtpPropValue(subject))}"`;
  attrs += ` IsBodyHtml="${serializeSafeAttributeValue(isBodyHtml)}"`;
  if (account) attrs += ` Account="${serializeSafeAttributeValue(wrapSmtpPropValue(account))}"`;

  const safeBody = body
    ? escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(body), _activeDeclarationLookup || undefined))
    : escapeXmlTextContent(ensureBracketWrapped("str_EmailBody", _activeDeclarationLookup || undefined));

  let childParts = "";
  if (!body) {
    childParts += `  <!-- HANDOFF: Body binding was not provided — using placeholder variable str_EmailBody. Replace with actual email body content. -->\n`;
  }
  childParts += `  <${tag}.Body>\n    <InArgument x:TypeArguments="x:String">${safeBody}</InArgument>\n  </${tag}.Body>\n`;
  if (cc) {
    attrs += ` Cc="${serializeSafeAttributeValue(wrapSmtpPropValue(cc))}"`;
  }
  if (bcc) {
    attrs += ` Bcc="${serializeSafeAttributeValue(wrapSmtpPropValue(bcc))}"`;
  }

  return `<${tag} ${attrs}>\n${childParts}</${tag}>`;
}

function resolveSendMail365Template(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const to = getPropString(props, "To", "to") || "PLACEHOLDER_To";
  const subject = getPropString(props, "Subject", "subject") || "PLACEHOLDER_Subject";
  const body = getPropString(props, "Body", "body") || "";
  const cc = getPropString(props, "Cc", "cc");
  const bcc = getPropString(props, "Bcc", "bcc");
  const isBodyHtml = getPropString(props, "IsBodyHtml", "isBodyHtml") || "True";
  const account = getPropString(props, "Account", "account") || "PLACEHOLDER_Account";

  const tag = getActivityTag("SendMail365");
  let attrs = `DisplayName="${displayName}"`;
  attrs += ` IsBodyHtml="${serializeSafeAttributeValue(isBodyHtml)}"`;

  const safeBody = body
    ? escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(body), _activeDeclarationLookup || undefined))
    : escapeXmlTextContent(ensureBracketWrapped("str_EmailBody", _activeDeclarationLookup || undefined));

  let childParts = "";
  childParts += `  <${tag}.Account>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(account), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.Account>\n`;
  childParts += `  <${tag}.To>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(to), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.To>\n`;
  childParts += `  <${tag}.Subject>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(subject), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.Subject>\n`;
  if (!body) {
    childParts += `  <!-- HANDOFF: Body binding was not provided — using placeholder variable str_EmailBody. Replace with actual email body content. -->\n`;
  }
  childParts += `  <${tag}.Body>\n    <InArgument x:TypeArguments="x:String">${safeBody}</InArgument>\n  </${tag}.Body>\n`;
  if (cc) childParts += `  <${tag}.Cc>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(cc), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.Cc>\n`;
  if (bcc) childParts += `  <${tag}.Bcc>\n    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(wrapSmtpPropValue(bcc), _activeDeclarationLookup || undefined))}</InArgument>\n  </${tag}.Bcc>\n`;

  return `<${tag} ${attrs}>\n${childParts}</${tag}>`;
}

function resolveGetImapMailMessageTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const server = getPropString(props, "Server", "server") || "PLACEHOLDER_ImapServer";
  const port = getPropString(props, "Port", "port") || "993";
  const email = getPropString(props, "Email", "email") || "PLACEHOLDER_Email";
  const password = getPropString(props, "Password", "password") || "PLACEHOLDER_Password";
  const secureConnection = getPropString(props, "SecureConnection", "secureConnection") || "Auto";
  const top = getPropString(props, "Top", "top") || "30";
  const mailFolder = getPropString(props, "MailFolder", "mailFolder") || "Inbox";
  const onlyUnread = getPropString(props, "OnlyUnreadMessages", "onlyUnreadMessages") || "True";
  const outputVar = node.outputVar || getPropString(props, "Messages", "messages") || "list_Messages";

  let attrs = `DisplayName="${displayName}"`;
  attrs += ` Server="${serializeSafeAttributeValue(wrapSmtpPropValue(server))}"`;
  attrs += ` Port="${serializeSafeAttributeValue(port)}"`;
  attrs += ` Email="${serializeSafeAttributeValue(wrapSmtpPropValue(email))}"`;
  attrs += ` Password="${serializeSafeAttributeValue(wrapSmtpPropValue(password))}"`;
  attrs += ` SecureConnection="${serializeSafeAttributeValue(secureConnection)}"`;
  attrs += ` Top="${serializeSafeAttributeValue(top)}"`;
  attrs += ` MailFolder="${serializeSafeAttributeValue(wrapSmtpPropValue(mailFolder))}"`;
  attrs += ` OnlyUnreadMessages="${serializeSafeAttributeValue(onlyUnread)}"`;

  return `<umail:GetImapMailMessage ${attrs}>\n` +
    `  <umail:GetImapMailMessage.Messages>\n` +
    `    <OutArgument x:TypeArguments="scg:List(snetmail:MailMessage)">[${outputVar}]</OutArgument>\n` +
    `  </umail:GetImapMailMessage.Messages>\n` +
    `</umail:GetImapMailMessage>`;
}

function resolveCreateFormTaskTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const title = getPropString(props, "Title", "title") || "PLACEHOLDER_FormTitle";
  const formSchemaPath = getPropString(props, "FormSchemaPath", "formSchemaPath") || "PLACEHOLDER_FormSchemaPath";
  const taskDataJson = getPropString(props, "TaskDataJson", "taskDataJson");
  const taskCatalog = getPropString(props, "TaskCatalog", "taskCatalog");
  const taskFolder = getPropString(props, "TaskFolder", "taskFolder");
  const outputVar = node.outputVar || getPropString(props, "TaskObject", "taskObject") || "obj_FormTask";

  let attrs = `DisplayName="${displayName}"`;
  attrs += ` Title="${serializeSafeAttributeValue(wrapSmtpPropValue(title))}"`;
  attrs += ` FormSchemaPath="${serializeSafeAttributeValue(wrapSmtpPropValue(formSchemaPath))}"`;
  if (taskCatalog) attrs += ` TaskCatalog="${serializeSafeAttributeValue(wrapSmtpPropValue(taskCatalog))}"`;
  if (taskFolder) attrs += ` TaskFolder="${serializeSafeAttributeValue(wrapSmtpPropValue(taskFolder))}"`;

  let childParts = "";
  if (taskDataJson) {
    childParts += `  <upers:CreateFormTask.TaskDataJson>\n` +
      `    <InArgument x:TypeArguments="x:String">[${taskDataJson}]</InArgument>\n` +
      `  </upers:CreateFormTask.TaskDataJson>\n`;
  }
  childParts += `  <upers:CreateFormTask.TaskObject>\n` +
    `    <OutArgument x:TypeArguments="upers:FormTaskData">[${outputVar}]</OutArgument>\n` +
    `  </upers:CreateFormTask.TaskObject>\n`;

  return `<upers:CreateFormTask ${attrs}>\n${childParts}</upers:CreateFormTask>`;
}

function resolveHttpClientTemplate(node: ActivityNode): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const endpointRaw = props.Endpoint || props.endpoint || props.URL || props.url;
  if (!endpointRaw) {
    throw new Error(`[HttpClient] Activity "${node.displayName}" is missing a required Endpoint/URL property — cannot emit HttpClient without a valid endpoint.`);
  }
  const endpointResolved = resolvePropertyValueRaw(endpointRaw as PropertyValue);
  const method = getPropString(props, "Method", "method") || "GET";
  const outputVar = node.outputVar || "str_ResponseBody";
  const tag = getActivityTag("HttpClient");

  let wrappedEndpoint: string;
  if (endpointResolved.startsWith("[") && endpointResolved.endsWith("]")) {
    const inner = endpointResolved.slice(1, -1);
    wrappedEndpoint = `[${escapeXmlExpression(inner)}]`;
  } else if (/^[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*$/.test(endpointResolved)) {
    wrappedEndpoint = `[${endpointResolved}]`;
  } else if (/^https?:\/\//.test(endpointResolved) || endpointResolved.includes("://")) {
    wrappedEndpoint = `["${endpointResolved}"]`;
  } else {
    wrappedEndpoint = `[${escapeXmlExpression(endpointResolved)}]`;
  }

  let xml = `<${tag} DisplayName="${displayName}" Endpoint="${serializeSafeAttributeValue(wrappedEndpoint)}" Method="${serializeSafeAttributeValue(method)}"`;

  xml += `>\n`;

  const body = getPropString(props, "Body", "body");
  const methodUpper = method.toUpperCase();
  if (body) {
    xml += `  <${tag}.Body>\n`;
    xml += `    <InArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(body, _activeDeclarationLookup || undefined))}</InArgument>\n`;
    xml += `  </${tag}.Body>\n`;
  } else if (methodUpper === "POST" || methodUpper === "PUT" || methodUpper === "PATCH") {
    xml += `  <${tag}.Body>\n`;
    xml += `    <InArgument x:TypeArguments="x:String">[str_RequestBody]</InArgument>\n`;
    xml += `  </${tag}.Body>\n`;
  }

  const headers = getPropString(props, "Headers", "headers");
  if (headers) {
    xml += `  <${tag}.Headers>\n`;
    xml += `    <InArgument x:TypeArguments="scg:Dictionary(x:String, x:String)">${escapeXmlTextContent(ensureBracketWrapped(headers, _activeDeclarationLookup || undefined))}</InArgument>\n`;
    xml += `  </${tag}.Headers>\n`;
  } else {
    const authToken = getPropString(props, "AuthToken", "authToken", "BearerToken", "bearerToken");
    if (authToken) {
      xml += `  <${tag}.Headers>\n`;
      const safeAuthToken = escapeXmlTextContent(ensureBracketWrapped(authToken, _activeDeclarationLookup || undefined)).slice(1, -1);
      xml += `    <InArgument x:TypeArguments="scg:Dictionary(x:String, x:String)">${escapeXmlTextContent(`[New Dictionary(Of String, String) From {{"Authorization", "Bearer " & ${safeAuthToken}}}]`)}</InArgument>\n`;
      xml += `  </${tag}.Headers>\n`;
    }
  }

  xml += `  <${tag}.Result>\n`;
  xml += `    <OutArgument x:TypeArguments="x:String">${escapeXmlTextContent(ensureBracketWrapped(outputVar, _activeDeclarationLookup || undefined))}</OutArgument>\n`;
  xml += `  </${tag}.Result>\n`;
  xml += `</${tag}>`;

  return xml;
}

function resolveExcelApplicationScopeTemplate(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  emissionContext: EmissionContext,
): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const workbookPath = getPropString(props, "WorkbookPath", "workbookPath", "FilePath", "filePath") || "PLACEHOLDER_WorkbookPath";
  const visible = getPropString(props, "Visible", "visible") || "False";
  const tag = getActivityTag("ExcelApplicationScope");

  const bodyChildren = (node as any).bodyChildren || (node as any).children || [];
  let bodyXml = "";
  if (Array.isArray(bodyChildren) && bodyChildren.length > 0) {
    bodyXml = bodyChildren
      .map((child: WorkflowNode) => assembleNode(child, allVariables, processType, 0, emissionContext))
      .join("\n");
  }
  if (!bodyXml.trim()) {
    bodyXml = `<ui:Comment Text="TODO - Add Excel activities here" DisplayName="Placeholder" />`;
  }

  return `<${tag} DisplayName="${displayName}" WorkbookPath="${serializeSafeAttributeValue(smartBracketWrap(workbookPath, _activeDeclarationLookup || undefined))}" Visible="${serializeSafeAttributeValue(visible)}">\n` +
    `  <${tag}.Body>\n` +
    `    <ActivityAction x:TypeArguments="x:Object">\n` +
    `      <ActivityAction.Handler>\n` +
    `        <Sequence DisplayName="Excel Scope Body">\n` +
    `          ${bodyXml}\n` +
    `        </Sequence>\n` +
    `      </ActivityAction.Handler>\n` +
    `    </ActivityAction>\n` +
    `  </${tag}.Body>\n` +
    `</${tag}>`;
}

function resolveUseExcelTemplate(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  emissionContext: EmissionContext,
): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const excelFile = getPropString(props, "ExcelFile", "excelFile", "FilePath", "filePath") || "PLACEHOLDER_ExcelFile";
  const tag = getActivityTag("UseExcel");

  const bodyChildren = (node as any).bodyChildren || (node as any).children || [];
  let bodyXml = "";
  if (Array.isArray(bodyChildren) && bodyChildren.length > 0) {
    bodyXml = bodyChildren
      .map((child: WorkflowNode) => assembleNode(child, allVariables, processType, 0, emissionContext))
      .join("\n");
  }
  if (!bodyXml.trim()) {
    bodyXml = `<ui:Comment Text="TODO - Add Excel activities here" DisplayName="Placeholder" />`;
  }

  return `<${tag} DisplayName="${displayName}" ExcelFile="${serializeSafeAttributeValue(smartBracketWrap(excelFile, _activeDeclarationLookup || undefined))}">\n` +
    `  <${tag}.Body>\n` +
    `    <ActivityAction x:TypeArguments="x:Object">\n` +
    `      <ActivityAction.Handler>\n` +
    `        <Sequence DisplayName="Excel Body">\n` +
    `          ${bodyXml}\n` +
    `        </Sequence>\n` +
    `      </ActivityAction.Handler>\n` +
    `    </ActivityAction>\n` +
    `  </${tag}.Body>\n` +
    `</${tag}>`;
}

function sanitizeResidualJsonInAttributes(xmlString: string, templateName: string, displayName: string): string {
  return xmlString.replace(
    /(\w+)="([^"]*\{(?:&quot;|")type(?:&quot;|")[^"]*)"/g,
    (match, attrName: string, attrValue: string) => {
      const decoded = attrValue
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      const jsonResult = tryParseJsonValueIntent(decoded);
      if (jsonResult) {
        const resolved = buildExpression(jsonResult.intent);
        const escaped = escapeXml(resolved);
        emitJsonResolutionDiagnostic(decoded, jsonResult.intent, resolved, jsonResult.fallbackUsed);
        return `${attrName}="${escaped}"`;
      }

      console.warn(`[Tree Assembler] Post-emission safety net: unresolvable residual JSON in attribute "${attrName}" on ${templateName} — preserved as structured defect`);
      if (_activeRemediationContext) {
        _activeRemediationContext.propertyRemediations.push({
          level: "property",
          file: _activeRemediationContext.fileName,
          remediationCode: "STUB_PROPERTY_BAD_EXPRESSION",
          originalTag: templateName,
          originalDisplayName: displayName,
          propertyName: attrName,
          reason: `Unresolvable residual JSON payload in attribute "${attrName}": ${decoded.substring(0, 200)}`,
          classifiedCheck: "RESIDUAL_JSON_PAYLOAD",
          developerAction: `Resolve JSON expression intermediate in property "${attrName}" on "${displayName}" (${templateName})`,
          estimatedEffortMinutes: 10,
        });
      } else {
        _residualJsonDefects.push({
          templateName,
          displayName,
          propertyName: attrName,
          rawPayload: decoded.substring(0, 500),
        });
      }

      return match;
    },
  );
}

function resolveDynamicTemplate(node: ActivityNode, processType: ProcessType, emissionContext: EmissionContext = "normal"): string {
  const props = node.properties || {};
  const displayName = escapeXml(node.displayName);
  const templateName = node.template;

  const strictPrefix = getActivityPrefixStrict(templateName);
  if (strictPrefix === null) {
    const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
    console.warn(`[Tree Assembler] Activity "${templateName}" has no resolved namespace mapping — emitting as unsupported`);
    if (_activeRemediationContext) {
      _activeRemediationContext.propertyRemediations.push({
        level: "activity",
        file: _activeRemediationContext.fileName,
        remediationCode: "STUB_ACTIVITY_CATALOG_VIOLATION",
        originalTag: templateName,
        originalDisplayName: node.displayName,
        propertyName: "(unmapped-namespace)",
        reason: `Activity "${templateName}" could not be resolved to a known UiPath package namespace. Business step "${node.displayName}" requires manual implementation.${isMandatoryPath ? " This is in a mandatory execution path — workflow is BLOCKED." : ""}`,
        classifiedCheck: "UNMAPPED_NAMESPACE",
        developerAction: `Resolve namespace mapping for "${templateName}" and re-implement "${node.displayName}"`,
        estimatedEffortMinutes: isMandatoryPath ? 30 : 20,
      });
    }
    if (isMandatoryPath) {
      return `<!-- BLOCKED: Unmapped namespace for "${escapeXml(templateName)}" in mandatory path -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Activity &apos;${escapeXml(templateName)}&apos; has no resolved namespace — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Unmapped Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — unmapped activity &apos;${escapeXml(node.displayName)}&apos;" />`;
    }
    return `<!-- WARNING: Unmapped namespace for "${escapeXml(templateName)}" — "${escapeXml(node.displayName)}" -->
<ui:Comment Text="[BLOCKED] Unmapped namespace: ${escapeXml(templateName)}. Business step &quot;${escapeXml(node.displayName)}&quot; requires manual namespace resolution." DisplayName="${escapeXml(node.displayName)} (unmapped namespace — manual fix required)" />
<ui:LogMessage Level="Warn" Message="[&quot;WARNING: Activity &apos;${escapeXml(templateName)}&apos; has no resolved namespace — &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Unmapped Activity Warning" />`;
  }

  const tag = strictPrefix ? `${strictPrefix}:${templateName}` : templateName;

  const attrParts: string[] = [`DisplayName="${displayName}"`];
  const childParts: string[] = [];

  let schema: any = null;
  if (catalogService.isLoaded()) {
    const filteredDynResult = getFilteredSchema(templateName, "workflow-tree-assembler", _activeTargetFramework);
    if (filteredDynResult.status === "approved") {
      schema = filteredDynResult.schema;
    }
  }

  const escalationThreshold = _activeRemediationContext?.escalationThreshold ?? PROPERTY_REMEDIATION_ESCALATION_THRESHOLD;
  const propertyFailures: PropertyRemediationRecord[] = [];
  const pendingPropertyRemediations: Array<{ propertyName: string; code: RemediationCode; reason: string }> = [];

  const KNOWN_ENUM_PROPERTIES: Record<string, Record<string, string>> = {
    "Level": {
      "information": "Info", "warning": "Warn", "debug": "Trace",
      "info": "Info", "warn": "Warn", "error": "Error", "trace": "Trace", "fatal": "Fatal",
      "verbose": "Trace", "critical": "Fatal",
    },
    "Priority": {
      "high": "High", "low": "Low", "normal": "Normal",
    },
  };

  for (const [key, rawValue] of Object.entries(props)) {
    if (key.startsWith("_") || key === "displayName" || key === "DisplayName") continue;

    // Task #529: emitter-side guard. If the property key is not a valid XML
    // NCName/QName, or is a TODO marker (e.g., "TODO:" or "TODO_bind"), the
    // attribute MUST NOT be emitted in attribute-name position. Drop the
    // attribute at smallest scope and persist a structured diagnostic so
    // the DHG can honestly report it. The activity body and unrelated
    // properties are preserved.
    {
      const keyGuard = sanitizeAttributeNameKey(key, {
        file: _activeRemediationContext?.fileName || "unknown",
        emitter: `workflow-tree-assembler:resolveDynamicTemplate:${templateName}`,
        rawValue,
        workflow: (_activeRemediationContext?.fileName || "").replace(/\.xaml$/i, ""),
        activity: templateName,
        // Contract-aware probe (#529 review): consult the activity catalog
        // so that omission of a *required* contract field is recorded as
        // `requiredFieldOmitted: true` and routed to a localized handoff.
        isRequiredProperty: (activityName: string | undefined, propertyName: string) => {
          if (!activityName) return false;
          try {
            const schema = catalogService.getActivitySchema(activityName);
            if (!schema) return false;
            const prop = schema.activity.properties.find(p => p.name === propertyName);
            return !!prop?.required;
          } catch {
            return false;
          }
        },
      });
      if (keyGuard.omitted) {
        const wasRequired = keyGuard.diagnostic?.requiredFieldOmitted ? " [REQUIRED]" : "";
        console.warn(`[TODO Attribute Guard] Dropped property "${key}" on ${templateName}${wasRequired} — invalid XML attribute name (would have produced malformed XAML)`);
        continue;
      }
    }

    if (isBlockedPropertyValue(rawValue)) {
      console.warn(`[Tree Assembler] Property "${key}" on "${templateName}" is marked as blocked — withholding from emission`);
      emitTypedPropertyDiagnostic({
        workflowFile: _activeRemediationContext?.fileName || "unknown",
        templateName,
        propertyName: key,
        classification: "unsupported-structured",
        action: "blocked",
        reason: "Property marked as blocked by upstream input preprocessing (sentinel detected)",
        stage: "pre-serialization-sentinel-check",
      });
      continue;
    }

    const propClrType = schema ? (schema.activity.properties.find((p: any) => p.name === key)?.clrType) : undefined;

    let preprocessedRawValue = rawValue;
    let _dynamicFallbackUsed = false;

    if (typeof rawValue !== "string" && !isValueIntent(rawValue) && typeof rawValue === "object" && rawValue !== null) {
      const preClassification = classifyPropertyValue(rawValue, key, templateName);
      if (preClassification.kind === "unsupported-structured") {
        console.warn(`[Tree Assembler] Blocking unsupported structured property "${key}" on "${templateName}" — property withheld from emission: ${preClassification.reason}`);
        emitTypedPropertyDiagnostic({
          workflowFile: _activeRemediationContext?.fileName || "unknown",
          templateName,
          propertyName: key,
          classification: "unsupported-structured",
          action: "blocked",
          reason: preClassification.reason,
          rawShape: preClassification.rawShape,
          stage: "pre-serialization-boundary",
        });
        continue;
      } else if (preClassification.kind === "scalar") {
        preprocessedRawValue = preClassification.value;
      }
    }

    if (typeof rawValue === "string" && !isValueIntent(rawValue)) {
      const jsonParsed = tryParseJsonValueIntent(rawValue);
      if (jsonParsed) {
        preprocessedRawValue = jsonParsed.intent;
        _dynamicFallbackUsed = jsonParsed.fallbackUsed;
        const resolvedExpr = buildExpression(jsonParsed.intent);
        emitJsonResolutionDiagnostic(rawValue, jsonParsed.intent, resolvedExpr, jsonParsed.fallbackUsed);
        console.log(`[Tree Assembler] resolveDynamicTemplate pre-processed JSON string for property "${key}": type=${jsonParsed.intent.type}, fallback=${jsonParsed.fallbackUsed}, raw=${rawValue.substring(0, 120)}`);
      }
    }

    let value = isValueIntent(preprocessedRawValue) ? buildExpression(preprocessedRawValue as ValueIntent) : normalizeStringToExpression(typeof preprocessedRawValue === "string" ? preprocessedRawValue : coercePropToString(preprocessedRawValue), _activeDeclarationLookup || undefined, propClrType);

    if (propClrType && /Boolean/i.test(propClrType)) {
      const stripped = value.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").replace(/&quot;/g, "").trim();
      if (/^(yes|true)$/i.test(stripped)) value = "True";
      else if (/^(no|false)$/i.test(stripped)) value = "False";
    }

    if (propClrType && (propClrType === "System.Text.Encoding" || propClrType.includes("Encoding"))) {
      const rawEncoding = value.replace(/^"+|"+$/g, "").replace(/&quot;/g, "").trim();
      const encodingExpr = ENCODING_MAP[rawEncoding.toLowerCase()];
      if (encodingExpr) {
        value = `[${encodingExpr}]`;
      }
    }

    const enumMap = KNOWN_ENUM_PROPERTIES[key];
    if (enumMap) {
      const stripped = value.replace(/&quot;/g, "").replace(/^"+|"+$/g, "").trim();
      value = enumMap[stripped.toLowerCase()] || stripped;
    }

    const validationResult = validatePropertyValue(key, value, schema, templateName);
    if (validationResult && _activeRemediationContext) {
      const safeDefault = getSafeDefaultForProperty(key, validationResult.code);
      propertyFailures.push({
        propertyName: key,
        remediationCode: validationResult.code,
        reason: validationResult.reason,
        originalValue: value,
        replacementValue: safeDefault,
      });
    }

    if (propertyFailures.length > escalationThreshold) {
      const isMandatoryPath = emissionContext === "mandatory-catch" || emissionContext === "mandatory-finally";
      if (_activeRemediationContext) {
        _activeRemediationContext.propertyRemediations.push({
          level: "activity",
          file: _activeRemediationContext.fileName,
          remediationCode: "STUB_ACTIVITY_PROPERTY_ESCALATION",
          originalTag: templateName,
          originalDisplayName: node.displayName,
          propertyName: isMandatoryPath ? "(escalated-mandatory-path)" : "(escalated)",
          reason: `${propertyFailures.length} properties failed validation (threshold: ${escalationThreshold}) — escalating to activity-level stub${isMandatoryPath ? ". This is in a mandatory execution path — workflow is BLOCKED." : ""}`,
          classifiedCheck: "STUB_ACTIVITY_PROPERTY_ESCALATION",
          developerAction: `Re-implement "${node.displayName}" (${templateName}) in ${_activeRemediationContext.fileName} — ${propertyFailures.length} properties failed: ${propertyFailures.map(f => f.propertyName).join(', ')}`,
          estimatedEffortMinutes: isMandatoryPath ? 30 : 20,
        });
      }
      if (isMandatoryPath) {
        return `<!-- BLOCKED: Property escalation for "${escapeXml(templateName)}" in mandatory path -->
<ui:LogMessage Level="Error" Message="[&quot;BLOCKED: Activity &apos;${escapeXml(templateName)}&apos; failed property validation in mandatory path — business step &apos;${escapeXml(node.displayName)}&apos; requires manual implementation&quot;]" DisplayName="Log Blocked Activity (${escapeXml(node.displayName)})" />
<Rethrow DisplayName="Rethrow — blocked activity &apos;${escapeXml(node.displayName)}&apos;" />`;
      }
      return `<ui:Comment Text="[TODO - Re-implement ${escapeXml(templateName)} activity — ${escapeXml(node.displayName)}. ${propertyFailures.length} properties failed validation. Original properties: ${propertyFailures.map(f => f.propertyName).join(', ')}]" DisplayName="${displayName} (stub)" />`;
    }

    let effectiveValue = value;
    if (validationResult && _activeRemediationContext) {
      const safeDefault = getSafeDefaultForProperty(key, validationResult.code);
      effectiveValue = safeDefault;
      pendingPropertyRemediations.push({
        propertyName: key,
        code: validationResult.code,
        reason: validationResult.reason,
      });
    }

    let isChildElement = false;
    let childSerializedValue = "";
    if (schema) {
      const propDef = schema.activity.properties.find((p: any) => p.name === key);
      if (propDef && propDef.xamlSyntax === "child-element") {
        isChildElement = true;
        const wrapper = propDef.argumentWrapper || "InArgument";
        let resolvedTypeArg = propDef.typeArguments || "";
        if (!resolvedTypeArg && propDef.clrType && /^[0-9]+(\.[0-9]+)?$/.test(effectiveValue.trim())) {
          const numericTypeMap: Record<string, string> = {
            "system.int32": "x:Int32", "int32": "x:Int32",
            "system.int64": "x:Int64", "int64": "x:Int64",
            "system.double": "x:Double", "double": "x:Double",
            "system.decimal": "x:Decimal", "decimal": "x:Decimal",
          };
          resolvedTypeArg = numericTypeMap[propDef.clrType.toLowerCase()] || "";
        }
        const typeArg = resolvedTypeArg ? ` x:TypeArguments="${resolvedTypeArg}"` : "";
        let wrappedValue = validationResult ? effectiveValue : (isValueIntent(rawValue) ? buildExpression(rawValue as ValueIntent) : smartBracketWrap(lintAndFixVbExpression(effectiveValue), _activeDeclarationLookup || undefined));
        if (propDef.typeArguments === "x:Boolean") {
          const stripped = wrappedValue.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "").trim();
          if (stripped === "True" || stripped === "False") {
            wrappedValue = stripped;
          }
        }
        childSerializedValue = escapeXmlTextContent(wrappedValue);
        childParts.push(
          `  <${tag}.${key}>\n` +
          `    <${wrapper}${typeArg}>${childSerializedValue}</${wrapper}>\n` +
          `  </${tag}.${key}>`
        );
      }
    }

    const traceIntentType = isValueIntent(preprocessedRawValue) ? (preprocessedRawValue as ValueIntent).type : "string";
    const isExpressionBearing = traceIntentType !== "string" || _dynamicFallbackUsed ||
      (typeof effectiveValue === "string" && /^\[.*\]$/.test(effectiveValue.trim()));

    if (!isChildElement) {
      const lintedAttrValue = lintAndFixVbExpression(effectiveValue);
      attrParts.push(`${key}="${serializeSafeAttributeValue(lintedAttrValue)}"`);
      if (isExpressionBearing) {
        emitPropertySerializationTrace({
          workflowFile: _activeRemediationContext?.fileName || "unknown",
          activityType: templateName,
          propertyName: key,
          originalRawValue: (typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue)).substring(0, 500),
          parsedIntentType: traceIntentType,
          normalizedOutput: lintedAttrValue.substring(0, 500),
          fallbackUsed: _dynamicFallbackUsed,
          finalValueHash: computeContentHash(lintedAttrValue),
        });
      }
    } else {
      const serializedChildValue = childSerializedValue || effectiveValue;
      if (isExpressionBearing) {
        emitPropertySerializationTrace({
          workflowFile: _activeRemediationContext?.fileName || "unknown",
          activityType: templateName,
          propertyName: key,
          originalRawValue: (typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue)).substring(0, 500),
          parsedIntentType: traceIntentType,
          normalizedOutput: serializedChildValue.substring(0, 500),
          fallbackUsed: _dynamicFallbackUsed,
          finalValueHash: computeContentHash(serializedChildValue),
        });
      }
    }
  }

  for (const pending of pendingPropertyRemediations) {
    recordPropertyRemediation(pending.propertyName, pending.code, pending.reason, templateName, node.displayName);
  }

  if (node.outputVar) {
    const outputType = node.outputType || "x:Object";
    childParts.push(
      `  <${tag}.Result>\n` +
      `    <OutArgument x:TypeArguments="${mapClrType(outputType, "critical")}">${escapeXmlTextContent(ensureBracketWrapped(node.outputVar, _activeDeclarationLookup || undefined))}</OutArgument>\n` +
      `  </${tag}.Result>`
    );
  }

  let xmlResult: string;
  if (childParts.length === 0) {
    xmlResult = `<${tag} ${attrParts.join(" ")} />`;
  } else {
    xmlResult = `<${tag} ${attrParts.join(" ")}>\n${childParts.join("\n")}\n</${tag}>`;
  }

  xmlResult = sanitizeResidualJsonInAttributes(xmlResult, templateName, node.displayName);

  return xmlResult;
}

const HIGH_RISK_TEMPLATES = new Set([
  "HttpClient",
  "ExecuteQuery",
  "SendSmtpMailMessage",
  "InvokeCode",
  "StartProcess",
  "TypeInto",
  "Click",
  "GetCredential",
  "GetAsset",
  "AddQueueItem",
  "GetTransactionItem",
  "SetTransactionStatus",
  "ExcelApplicationScope",
  "UseExcel",
  "ReadRange",
  "WriteRange",
  "ReadTextFile",
  "WriteTextFile",
  "ReadCsvFile",
  "WriteCsvFile",
]);

function isHighRiskTemplate(templateName: string): boolean {
  return HIGH_RISK_TEMPLATES.has(templateName);
}

function wrapInTryCatch(innerXml: string, displayName: string, exceptionVarName: string = "exception"): string {
  const effectiveInnerXml = innerXml.trim()
    ? innerXml
    : `<ui:Comment DisplayName="TODO - Implement try block logic" Text="This TryCatch was generated without try content — add activities here." />`;
  return `<TryCatch DisplayName="Try: ${escapeXml(displayName)}">
  <TryCatch.Try>
    <Sequence DisplayName="Try Block">
      ${effectiveInnerXml}
    </Sequence>
  </TryCatch.Try>
  <TryCatch.Catches>
    <Catch x:TypeArguments="s:Exception">
      <ActivityAction x:TypeArguments="s:Exception">
        <ActivityAction.Argument>
          <DelegateInArgument x:TypeArguments="s:Exception" Name="${escapeXml(exceptionVarName)}" />
        </ActivityAction.Argument>
        <Sequence DisplayName="Handle Exception">
          <ui:LogMessage Level="Error" Message="[&quot;Error in ${escapeXml(displayName)} (&quot; &amp; ${escapeXml(exceptionVarName)}.GetType().Name &amp; &quot;): &quot; &amp; ${escapeXml(exceptionVarName)}.Message]" DisplayName="Log Exception" />
          <Rethrow DisplayName="Rethrow Exception" />
        </Sequence>
      </ActivityAction>
    </Catch>
  </TryCatch.Catches>
</TryCatch>`;
}

function sanitizeRetryInterval(val: string): string {
  if (!val) return "00:00:05";
  const trimmed = val.trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{1,2}:\d{2}:\d{2}\.\d+$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
  if (/^[a-zA-Z_]/.test(trimmed) && /[.()\s]/.test(trimmed)) {
    console.warn(`[RetryInterval] Bracket-wrapping VB expression: ${trimmed}`);
    return `[${trimmed}]`;
  }
  if (/^[a-zA-Z_]\w*$/.test(trimmed)) {
    console.warn(`[RetryInterval] Bracket-wrapping variable reference: ${trimmed}`);
    return `[${trimmed}]`;
  }
  console.warn(`[RetryInterval] Unrecognized value "${trimmed}" — replacing with safe default 00:00:05`);
  return "00:00:05";
}

function wrapInRetryScope(innerXml: string, displayName: string, retries: number = 3, interval: string = "00:00:05"): string {
  const safeInterval = sanitizeRetryInterval(interval);
  const effectiveInnerXml = innerXml.trim()
    ? innerXml
    : `<ui:LogMessage Level="Trace" DisplayName="TODO - Implement RetryScope body" Message="[&quot;Placeholder — RetryScope body has no activities yet&quot;]" />`;
  return `<ui:RetryScope NumberOfRetries="${retries}" RetryInterval="${safeInterval}" DisplayName="Retry: ${escapeXml(displayName)}">
  <ui:RetryScope.Condition>
    <ui:ShouldRetry />
  </ui:RetryScope.Condition>
  <Sequence DisplayName="Retry Body">
    ${effectiveInnerXml}
  </Sequence>
</ui:RetryScope>`;
}

export function assembleNode(
  node: WorkflowNode,
  allVariables: VariableDeclaration[] = [],
  processType: ProcessType = "general",
  depthLevel: number = 0,
  emissionContext: EmissionContext = "normal",
  registry?: DeclarationRegistry,
): string {
  switch (node.kind) {
    case "activity":
      return assembleActivityNode(node, allVariables, processType, emissionContext);
    case "sequence":
      return assembleSequenceNode(node, allVariables, processType, depthLevel, emissionContext, registry);
    case "tryCatch":
      return assembleTryCatchNode(node, allVariables, processType, depthLevel, emissionContext, registry);
    case "if":
      return assembleIfNode(node, allVariables, processType, depthLevel, emissionContext, registry);
    case "while":
      return assembleWhileNode(node, allVariables, processType, depthLevel, emissionContext, registry);
    case "forEach":
      return assembleForEachNode(node, allVariables, processType, depthLevel, emissionContext, registry);
    case "retryScope":
      return assembleRetryScopeNode(node, allVariables, processType, depthLevel, emissionContext, registry);
    default:
      return `<!-- Unknown node kind -->`;
  }
}

let _sweepFallbackCounter = 0;

function sweepXmlForResidualJsonIntents(xml: string): string {
  const JSON_IN_ATTR_PATTERN = /([\w:.]+)="(\{(?:&quot;|")(?:type|value|name)(?:&quot;|")[^"]*\})"/g;
  let result = xml;
  let match;
  const replacements: Array<{ original: string; resolved: string }> = [];

  while ((match = JSON_IN_ATTR_PATTERN.exec(xml)) !== null) {
    const attrName = match[1];
    const rawValue = match[2];
    const decoded = rawValue.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const jsonResult = tryParseJsonValueIntent(decoded);
    if (jsonResult) {
      const resolved = buildExpression(jsonResult.intent);
      const escaped = escapeXml(resolved);
      emitJsonResolutionDiagnostic(decoded, jsonResult.intent, resolved, jsonResult.fallbackUsed);
      replacements.push({ original: `${attrName}="${rawValue}"`, resolved: `${attrName}="${escaped}"` });
      console.log(`[Pre-Emission Sweep] Resolved residual JSON in attribute "${attrName}": ${decoded.substring(0, 80)} → ${resolved}`);
    }
  }

  for (const rep of replacements) {
    result = result.replace(rep.original, rep.resolved);
  }

  const JSON_IN_ELEMENT_PATTERN = /(<[A-Za-z][\w:.]*(?:\s[^>]*)?>)\s*(\{(?:&quot;|")(?:type|value|name)(?:&quot;|")[^<]*\})\s*(<\/[A-Za-z][\w:.]*>)/g;
  let elemMatch;
  const elemReplacements: Array<{ original: string; resolved: string }> = [];

  while ((elemMatch = JSON_IN_ELEMENT_PATTERN.exec(result)) !== null) {
    const openTag = elemMatch[1];
    const rawValue = elemMatch[2];
    const closeTag = elemMatch[3];
    const decoded = rawValue.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const jsonResult = tryParseJsonValueIntent(decoded);
    if (jsonResult) {
      const resolved = buildExpression(jsonResult.intent);
      const escaped = escapeXmlTextContent(resolved);
      emitJsonResolutionDiagnostic(decoded, jsonResult.intent, resolved, jsonResult.fallbackUsed);
      elemReplacements.push({ original: elemMatch[0], resolved: `${openTag}${escaped}${closeTag}` });
      console.log(`[Pre-Emission Sweep] Resolved residual JSON in element content: ${decoded.substring(0, 80)} → ${resolved}`);
    }
  }

  for (const rep of elemReplacements) {
    result = result.replace(rep.original, rep.resolved);
  }

  return result;
}

const ACTIVITIES_REQUIRING_LEGACY_TEMPLATE = new Set([
  "Assign",               // System.Activities base type — requires runtime type inference (To/Value generic typing)
  "SendSmtpMailMessage",  // Complex multi-property mail with child-element body — legacy template handles MIME structure
  "SendOutlookMailMessage", // Same as SendSmtpMailMessage — legacy template handles Outlook-specific property shape
  "ExcelApplicationScope",  // Scope activity requiring nested Body child — modern generator lacks scope nesting support
  "UseExcel",             // Modern Excel scope — still requires legacy Body child nesting like ExcelApplicationScope
  "NApplicationCard",     // UI Automation scope — requires Target/Selector child-element nesting not in modern generator
  "UseApplicationBrowser", // Browser scope — requires nested Body and Target child elements
  "UseBrowser",           // Legacy browser scope — same nesting requirements as UseApplicationBrowser
  "UseApplication",       // Application scope — requires nested Body child element
  "OpenBrowser",          // Legacy browser open — requires nested Body child element for contained activities
  "AttachBrowser",        // Legacy browser attach — same body-nesting requirements
  "AttachWindow",         // Legacy window attach — same body-nesting requirements
]);

const STRUCTURED_PROPERTY_KEYS: Record<string, Set<string>> = {
  "InvokeWorkflowFile": new Set(["Arguments", "arguments"]),
  // No DLL-renamed properties affect structured keys — QueueType/Timeout/TextString/InUiElement are all scalar attributes
};

function resolveValueIntentToString(vi: { type: string; name?: string; value?: string; expression?: string; baseUrl?: string }): string {
  switch (vi.type) {
    case "variable":
      return vi.name ? `[${vi.name}]` : "";
    case "literal":
      return vi.value !== undefined ? String(vi.value) : "";
    case "expression":
      return vi.expression ? `[${vi.expression}]` : "";
    case "url_with_params":
      return vi.baseUrl || "";
    case "vb_expression":
      return vi.value !== undefined ? String(vi.value) : "";
    default:
      return vi.value !== undefined ? String(vi.value) : "";
  }
}

function coerceGetCredentialProp(val: unknown, propName: string): string {
  if (typeof val === "string") return val;
  const defaultVal = propName === "Password" ? "sec_Password" : "str_Username";
  if (val !== null && val !== undefined && typeof val === "object") {
    const resolved = resolveToScalarString(val);
    if (resolved && !resolved.startsWith("OBJECT_SERIALIZED:")) {
      console.log(`[GetCredential] Coerced ValueIntent for ${propName}: → "${resolved}"`);
      return resolved;
    }
    console.warn(`[GetCredential] Non-string, non-ValueIntent value for ${propName}: ${JSON.stringify(val).substring(0, 120)} — using default`);
    return defaultVal;
  }
  return String(val ?? defaultVal);
}

function isValueIntentShape(obj: Record<string, unknown>): boolean {
  return typeof obj.type === "string" && (
    obj.type === "literal" || obj.type === "variable" || obj.type === "expression" ||
    obj.type === "url_with_params" || obj.type === "vb_expression"
  );
}

function flattenNodeProperties(properties: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!properties) return result;

  for (const [key, val] of Object.entries(properties)) {
    if (isBlockedPropertyValue(val)) {
      console.warn(`[flattenNodeProperties] Property "${key}" contains blocked sentinel — omitting from flattened output (remediation: omit)`);
      emitTypedPropertyDiagnostic({
        workflowFile: _activeRemediationContext?.fileName || "unknown",
        templateName: "(flattenNodeProperties)",
        propertyName: key,
        classification: "unsupported-structured",
        action: "blocked",
        reason: "Blocked property sentinel intercepted at flattenNodeProperties boundary — property omitted",
        stage: "flattenNodeProperties-sentinel-guard",
      });
      continue;
    }

    if (typeof val === "string") {
      if (isBlockedSentinel(val)) {
        console.warn(`[flattenNodeProperties] Property "${key}" string value is blocked sentinel — omitting (remediation: omit)`);
        emitTypedPropertyDiagnostic({
          workflowFile: _activeRemediationContext?.fileName || "unknown",
          templateName: "(flattenNodeProperties)",
          propertyName: key,
          classification: "unsupported-structured",
          action: "blocked",
          reason: "Blocked sentinel string intercepted at flattenNodeProperties boundary — property omitted",
          stage: "flattenNodeProperties-sentinel-guard",
        });
        continue;
      }
      let resolved = val;
      try {
        const parsed = JSON.parse(val);
        if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
          resolved = resolveValueIntentToString(parsed);
        }
      } catch (_jsonParseIgnored) { /* not JSON — use raw string */ }
      if (isBlockedSentinel(resolved)) {
        console.warn(`[flattenNodeProperties] Property "${key}" resolved to blocked sentinel — omitting (remediation: omit)`);
        continue;
      }
      result[key] = resolved;
    } else if (val !== null && val !== undefined && typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (isValueIntentShape(obj)) {
        const resolved = resolveValueIntentToString(obj as { type: string; name?: string; value?: string; expression?: string; baseUrl?: string });
        if (isBlockedSentinel(resolved)) {
          console.warn(`[flattenNodeProperties] Property "${key}" ValueIntent resolved to blocked sentinel — omitting (remediation: omit)`);
          continue;
        }
        result[key] = resolved;
      } else if ("value" in obj && Object.keys(obj).length <= 3) {
        const strVal = String(obj.value);
        if (isBlockedSentinel(strVal)) {
          console.warn(`[flattenNodeProperties] Property "${key}" object value is blocked sentinel — omitting (remediation: omit)`);
          continue;
        }
        result[key] = strVal;
      }
    } else if (val !== null && val !== undefined) {
      const strVal = String(val);
      if (isBlockedSentinel(strVal)) {
        console.warn(`[flattenNodeProperties] Property "${key}" coerced value is blocked sentinel — omitting (remediation: omit)`);
        continue;
      }
      result[key] = strVal;
    }
  }
  return result;
}

function safeDispatchGenerator(template: string, args: Record<string, unknown>, displayName: string): string | null {
  try {
    const xml = dispatchGenerator(template, args);
    if (xml) {
      console.log(`[Deterministic Generator] Used generator for "${resolveTemplateName(template)}" activity "${displayName}"`);
    }
    return xml;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Deterministic Generator] Dispatch failed for "${template}" ("${displayName}"), falling back to legacy template: ${msg}`);
    return null;
  }
}

function assembleActivityNode(
  node: ActivityNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  emissionContext: EmissionContext = "normal",
): string {
  let xml: string | null = null;

  const stripped = node.template.includes(":") ? node.template.split(":").pop()! : node.template;
  if (hasGenerator(node.template) && !ACTIVITIES_REQUIRING_LEGACY_TEMPLATE.has(stripped)) {
    let generatorArgs: Record<string, unknown>;
    const structuredKeys = STRUCTURED_PROPERTY_KEYS[stripped];
    if (structuredKeys) {
      const raw = node.properties || {};
      const scalarProps: Record<string, unknown> = {};
      const structuredProps: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (structuredKeys.has(k)) {
          structuredProps[k] = v;
        } else {
          scalarProps[k] = v;
        }
      }
      const flatProps = flattenNodeProperties(scalarProps);
      generatorArgs = {
        displayName: node.displayName,
        ...flatProps,
        ...structuredProps,
      };
    } else {
      const flatProps = flattenNodeProperties(node.properties);
      generatorArgs = {
        displayName: node.displayName,
        ...flatProps,
      };
    }
    if (node.outputVar) {
      generatorArgs.outputVar = node.outputVar;
    }
    xml = safeDispatchGenerator(node.template, generatorArgs, node.displayName);
  }

  if (!xml) {
    xml = resolveActivityTemplate(node, allVariables, processType, emissionContext);
  }

  xml = sweepXmlForResidualJsonIntents(xml);

  if (node.errorHandling === "catch" || node.errorHandling === "escalate") {
    xml = wrapInTryCatch(xml, node.displayName);
  } else if (node.errorHandling === "retry") {
    xml = wrapInRetryScope(xml, node.displayName);
  } else if ((!node.errorHandling || node.errorHandling === "none") && isHighRiskTemplate(node.template) && emissionContext !== "inside-trycatch" && emissionContext !== "mandatory-catch" && emissionContext !== "mandatory-finally") {
    xml = wrapInTryCatch(xml, node.displayName);
  }

  return xml;
}

function assembleSequenceNode(
  node: SequenceNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
  registry?: DeclarationRegistry,
): string {
  const displayName = escapeXml(node.displayName);
  const childrenXml = node.children
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext, registry))
    .join("\n");

  let varsBlock = "";
  if (node.variables && node.variables.length > 0) {
    varsBlock = "  <Sequence.Variables>\n";
    for (const v of node.variables) {
      let typeAttr = mapClrType(v.type);
      if (typeAttr === "x:Object") {
        const prefixType = inferTypeFromPrefix(v.name);
        if (prefixType) {
          typeAttr = prefixType;
        } else {
          const defaultType = inferTypeFromDefault(v.default);
          if (defaultType) typeAttr = defaultType;
        }
      }
      typeAttr = normalizeVariableTypeAttr(typeAttr);
      let defaultAttr = "";
      if (v.default) {
        const isObjectType = typeAttr === "x:Object" || typeAttr.includes("System.Object");
        if (isObjectType) {
          console.warn(`[Variable Guard] Omitting Default="${v.default}" for x:Object variable "${v.name}" — UiPath does not support Literal<Object>`);
        } else {
          const wrappedDefault = wrapVariableDefault(v.default, v.type);
          defaultAttr = ` Default="${serializeSafeAttributeValue(wrappedDefault)}"`;
        }
      }
      varsBlock += `    <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}"${defaultAttr} />\n`;
    }
    varsBlock += "  </Sequence.Variables>\n";
  }

  return `<Sequence DisplayName="${displayName}">\n${varsBlock}  ${childrenXml}\n</Sequence>`;
}

function inferExceptionVariableName(catchChildren: WorkflowNode[]): string | null {
  const exceptionVarPattern = /\b(\w+)\.(Message|StackTrace|InnerException|GetType|Source|HResult|Data|ToString)\b/;
  for (const child of catchChildren) {
    const propsStr = JSON.stringify(child);
    const match = propsStr.match(exceptionVarPattern);
    if (match && match[1] !== "exception") {
      return match[1];
    }
  }
  return null;
}

const NON_EXPRESSION_PROPERTY_NAMES = new Set([
  "DisplayName", "Text", "Message", "Level", "Annotation", "AnnotationText",
]);

function collectExpressionReferences(nodes: WorkflowNode[]): Set<string> {
  const refs = new Set<string>();

  function extractIdents(str: string): void {
    const pattern = /\b([a-zA-Z_]\w*)\b/g;
    let m;
    while ((m = pattern.exec(str)) !== null) {
      refs.add(m[1]);
    }
  }

  function extractFromValue(val: PropertyValue): void {
    if (typeof val === "string") {
      extractIdents(val);
    } else if (isValueIntent(val)) {
      if (val.type === "variable") refs.add(val.name);
      if (val.type === "expression") {
        extractIdents(val.left);
        extractIdents(val.right);
      }
    }
  }

  function scanNode(node: WorkflowNode): void {
    if (node.kind === "activity") {
      for (const [key, val] of Object.entries(node.properties || {})) {
        if (NON_EXPRESSION_PROPERTY_NAMES.has(key)) continue;
        extractFromValue(val);
      }
    } else if (node.kind === "sequence") {
      for (const child of node.children) scanNode(child);
    } else if (node.kind === "tryCatch") {
      for (const child of [...node.tryChildren, ...node.catchChildren, ...node.finallyChildren]) scanNode(child);
    } else if (node.kind === "if") {
      if (typeof node.condition === "string") extractIdents(node.condition);
      for (const child of [...node.thenChildren, ...node.elseChildren]) scanNode(child);
    } else if (node.kind === "while") {
      if (typeof node.condition === "string") extractIdents(node.condition);
      for (const child of node.bodyChildren) scanNode(child);
    } else if (node.kind === "forEach") {
      extractIdents(node.valuesExpression);
      for (const child of node.bodyChildren) scanNode(child);
    } else if (node.kind === "retryScope") {
      for (const child of node.bodyChildren) scanNode(child);
    }
  }

  for (const n of nodes) scanNode(n);
  return refs;
}

function inferForEachIteratorFromBody(node: ForEachNode, allVariables: VariableDeclaration[]): string {
  const declaredIterator = node.iteratorName || "item";
  const declaredVarNames = new Set(allVariables.map(v => v.name));
  declaredVarNames.add(declaredIterator);

  const referencedIdents = collectExpressionReferences(node.bodyChildren);

  if (referencedIdents.has(declaredIterator)) {
    return declaredIterator;
  }

  for (const ident of Array.from(referencedIdents)) {
    if (!declaredVarNames.has(ident) &&
        !ident.startsWith("str_") && !ident.startsWith("int_") &&
        !ident.startsWith("bool_") && !ident.startsWith("dt_") && !ident.startsWith("obj_") &&
        !ident.startsWith("dict_") && !ident.startsWith("list_") && !ident.startsWith("arr_") &&
        !ident.startsWith("in_") && !ident.startsWith("out_") && !ident.startsWith("io_")) {
      if (ident.toLowerCase().includes("row") || ident.toLowerCase().includes("item") ||
          ident.toLowerCase().includes("element") || ident.toLowerCase().includes("entry") ||
          ident.toLowerCase().includes("current") || ident.toLowerCase().includes("iterator")) {
        return ident;
      }
    }
  }

  return declaredIterator;
}

function assembleTryCatchNode(
  node: TryCatchNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  _parentEmissionContext: EmissionContext = "normal",
  registry?: DeclarationRegistry,
): string {
  const displayName = escapeXml(node.displayName);

  const resolvedExceptionName = resolveTryCatchExceptionName(node);

  let tryXml = node.tryChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, "inside-trycatch", registry))
    .join("\n");

  if (!tryXml.trim()) {
    const stepContext = node.displayName || "try block";
    const targetSystemHints: string[] = [];
    for (const child of node.tryChildren) {
      if (child.kind === "activity" && child.properties) {
        const sysRaw = child.properties.Application || child.properties.BrowserType || child.properties.Target || child.properties.WorkflowFileName || "";
        const sys = typeof sysRaw === "string" ? sysRaw : (isValueIntent(sysRaw) ? (sysRaw.type === "literal" ? sysRaw.value : sysRaw.type === "variable" ? sysRaw.name : String(sysRaw)) : String(sysRaw));
        if (sys) targetSystemHints.push(sys);
      }
    }
    const systemNote = targetSystemHints.length > 0 ? ` Target system: ${targetSystemHints.join(", ")}.` : "";
    tryXml = `<ui:Comment DisplayName="TODO - Implement ${escapeXml(stepContext)}" Text="TryCatch step &quot;${escapeXml(stepContext)}&quot; was generated without try content — implement the business logic for this step.${escapeXml(systemNote)}" />`;
  }

  let catchXml = node.catchChildren.length > 0
    ? node.catchChildren
        .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, "mandatory-catch", registry))
        .join("\n")
    : `<ui:LogMessage Level="Error" Message="[&quot;Error: &quot; &amp; ${escapeXml(resolvedExceptionName)}.Message]" DisplayName="Log Exception" />\n<Rethrow DisplayName="Rethrow Exception" />`;

  if (resolvedExceptionName !== "exception" && node.catchChildren.length > 0) {
    catchXml = catchXml.replace(/\bexception\b/g, resolvedExceptionName);
  }

  const finallyXml = node.finallyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, "mandatory-finally", registry))
    .join("\n");

  let xml = `<TryCatch DisplayName="${displayName}">\n`;
  xml += `  <TryCatch.Try>\n`;
  xml += `    <Sequence DisplayName="Try Block">\n`;
  xml += `      ${tryXml}\n`;
  xml += `    </Sequence>\n`;
  xml += `  </TryCatch.Try>\n`;
  xml += `  <TryCatch.Catches>\n`;
  xml += `    <Catch x:TypeArguments="s:Exception">\n`;
  xml += `      <ActivityAction x:TypeArguments="s:Exception">\n`;
  xml += `        <ActivityAction.Argument>\n`;
  xml += `          <DelegateInArgument x:TypeArguments="s:Exception" Name="${escapeXml(resolvedExceptionName)}" />\n`;
  xml += `        </ActivityAction.Argument>\n`;
  xml += `        <Sequence DisplayName="Handle Exception">\n`;
  xml += `          ${catchXml}\n`;
  xml += `        </Sequence>\n`;
  xml += `      </ActivityAction>\n`;
  xml += `    </Catch>\n`;
  xml += `  </TryCatch.Catches>\n`;
  if (finallyXml.trim()) {
    xml += `  <TryCatch.Finally>\n`;
    xml += `    <Sequence DisplayName="Finally Block">\n`;
    xml += `      ${finallyXml}\n`;
    xml += `    </Sequence>\n`;
    xml += `  </TryCatch.Finally>\n`;
  }
  xml += `</TryCatch>`;

  return xml;
}

const CSHARP_BLOCKERS = [
  { pattern: /=>\s*\{/, desc: "C# lambda expression" },
  { pattern: /\$"/, desc: "C# string interpolation" },
  { pattern: /\?\?/, desc: "C# null coalescing operator" },
  { pattern: /\?\.\w/, desc: "C# null conditional operator" },
  { pattern: /\bvar\s+\w/, desc: "C# var keyword" },
  { pattern: /\bforeach\s*\(/, desc: "C# foreach" },
  { pattern: /\busing\s*\(/, desc: "C# using statement" },
];

export function lintAndFixVbExpression(expr: string): string {
  if (!expr || !expr.trim()) return expr;
  const trimmed = expr.trim();
  if (/^"[^"]*"$/.test(trimmed)) return expr;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return expr;
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing") return expr;

  for (const { pattern, desc } of CSHARP_BLOCKERS) {
    if (pattern.test(trimmed)) {
      console.error(`[VB Lint BLOCKED] Expression contains unconvertible C# syntax (${desc}): "${trimmed}"`);
      throw new CSharpExpressionBlockedError(desc, trimmed);
    }
  }

  const result = lintExpression(expr);
  if (result.corrected && result.corrected !== expr) {
    console.log(`[VB Lint Pre-Emission] Auto-corrected expression: "${expr}" → "${result.corrected}"`);
    return result.corrected;
  }
  return expr;
}

function resolveConditionValue(condition: string | ValueIntent): string {
  if (isValueIntent(condition)) {
    const built = buildExpression(condition as ValueIntent);
    const linted = lintAndFixVbExpression(built);
    if (linted.startsWith("[") && linted.endsWith("]")) {
      const inner = linted.slice(1, -1);
      return `[${escapeXmlExpression(inner)}]`;
    }
    if (linted === "True" || linted === "False") return linted;
    return `[${escapeXmlExpression(linted)}]`;
  }
  const trimmed = (condition as string).trim();
  if (!trimmed) return trimmed;

  if (containsValueIntentJson(trimmed)) {
    const jsonResult = tryParseJsonValueIntent(trimmed);
    if (jsonResult) {
      const resolved = buildExpression(jsonResult.intent);
      emitJsonResolutionDiagnostic(trimmed, jsonResult.intent, resolved, jsonResult.fallbackUsed);
      const linted = lintAndFixVbExpression(resolved);
      if (linted.startsWith("[") && linted.endsWith("]")) {
        const inner = linted.slice(1, -1);
        return `[${escapeXmlExpression(inner)}]`;
      }
      if (linted === "True" || linted === "False") return linted;
      return `[${escapeXmlExpression(linted)}]`;
    }
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1);
    const linted = lintAndFixVbExpression(inner);
    return `[${escapeXmlExpression(linted)}]`;
  }
  if (trimmed === "True" || trimmed === "False") return trimmed;
  const linted = lintAndFixVbExpression(trimmed);
  return `[${escapeXmlExpression(linted)}]`;
}

function assembleIfNode(
  node: IfNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
  registry?: DeclarationRegistry,
): string {
  const displayName = escapeXml(node.displayName);
  const condition = resolveConditionValue(node.condition);

  const thenXml = node.thenChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext, registry))
    .join("\n");

  const elseXml = node.elseChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext, registry))
    .join("\n");

  const thenContent = thenXml.trim()
    ? thenXml
    : `<ui:LogMessage Level="Trace" DisplayName="TODO - Implement Then branch" Message="[&quot;Placeholder — Then branch has no activities yet&quot;]" />`;

  let xml = `<If Condition="${condition}" DisplayName="${displayName}">\n`;
  xml += `  <If.Then>\n`;
  xml += `    <Sequence DisplayName="Then">\n`;
  xml += `      ${thenContent}\n`;
  xml += `    </Sequence>\n`;
  xml += `  </If.Then>\n`;
  if (elseXml.trim()) {
    xml += `  <If.Else>\n`;
    xml += `    <Sequence DisplayName="Else">\n`;
    xml += `      ${elseXml}\n`;
    xml += `    </Sequence>\n`;
    xml += `  </If.Else>\n`;
  }
  xml += `</If>`;

  return xml;
}

function assembleWhileNode(
  node: WhileNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
  registry?: DeclarationRegistry,
): string {
  const displayName = escapeXml(node.displayName);
  const condition = resolveConditionValue(node.condition);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext, registry))
    .join("\n");

  const bodyContent = bodyXml.trim()
    ? bodyXml
    : `<ui:LogMessage Level="Trace" DisplayName="TODO - Implement While body" Message="[&quot;Placeholder — While body has no activities yet&quot;]" />`;

  return `<While Condition="${condition}" DisplayName="${displayName}">\n` +
    `  <While.Body>\n` +
    `    <Sequence DisplayName="While Body">\n` +
    `      ${bodyContent}\n` +
    `    </Sequence>\n` +
    `  </While.Body>\n` +
    `</While>`;
}

function inferCollectionItemType(declaredType: string): string | null {
  const lower = declaredType.toLowerCase();
  if (lower.includes("datatable")) return "scg2:DataRow";

  const listMatch = declaredType.match(/List\s*\(\s*Of\s+(\w+)\s*\)/i)
    || declaredType.match(/List<([^>]+)>/i)
    || declaredType.match(/System\.Collections\.Generic\.List.*?<([^>]+)>/i);
  if (listMatch) {
    return mapClrType(listMatch[1].trim());
  }

  const arrayMatch = declaredType.match(/Array\s*\(\s*Of\s+(\w+)\s*\)/i)
    || declaredType.match(/Array<([^>]+)>/i)
    || declaredType.match(/(\w+)\[\]/);
  if (arrayMatch) {
    return mapClrType(arrayMatch[1].trim());
  }

  const dictMatch = declaredType.match(/Dictionary\s*\(\s*Of\s+(\w+)\s*,\s*(\w+)\s*\)/i)
    || declaredType.match(/Dictionary<([^,]+),\s*([^>]+)>/i);
  if (dictMatch) {
    const keyType = mapClrType(dictMatch[1].trim());
    const valType = mapClrType(dictMatch[2].trim());
    return `scg:KeyValuePair(${keyType}, ${valType})`;
  }

  const scgListMatch = declaredType.match(/^scg:List\((.+)\)$/);
  if (scgListMatch) {
    return scgListMatch[1].trim();
  }

  const scgDictMatch = declaredType.match(/^scg:Dictionary\((.+),\s*(.+)\)$/);
  if (scgDictMatch) {
    return `scg:KeyValuePair(${scgDictMatch[1].trim()}, ${scgDictMatch[2].trim()})`;
  }

  return null;
}

function inferForEachItemType(itemType: string, valuesExpression: string, allVariables: VariableDeclaration[]): string {
  const expr = valuesExpression.trim().replace(/^\[|\]$/g, "");

  const isDataTableIteration = /\bdt_\w*\.Rows\b/i.test(expr) || /\.AsEnumerable\(\)/i.test(expr)
    || /\bDataTable\b.*\.Rows\b/i.test(expr) || /^(\w+)\.Rows$/i.test(expr);

  if (isDataTableIteration) {
    return "scg2:DataRow";
  }

  let expressionInferred: string | null = null;
  const simpleVarMatch = expr.match(/^(\w+)$/);
  if (simpleVarMatch) {
    const varName = simpleVarMatch[1];
    const decl = allVariables.find(v => v.name === varName);
    if (decl) {
      expressionInferred = inferCollectionItemType(decl.type);
      if (!expressionInferred) {
        const mappedVarType = mapClrType(decl.type);
        expressionInferred = inferCollectionItemType(mappedVarType);
      }
    }
  }

  if (expressionInferred) {
    return expressionInferred;
  }

  if (itemType && itemType !== "x:Object") {
    const mappedItem = mapClrType(itemType);
    if (mappedItem === "x:String" && isDataTableIteration) {
      return "scg2:DataRow";
    }
    return mappedItem;
  }
  return itemType || "x:Object";
}

function validateForEachTypeConsistency(itemType: string, valuesExpression: string): string {
  const expr = valuesExpression.trim().replace(/^\[|\]$/g, "");
  const isDataTableIteration = /\bdt_\w*\.Rows\b/i.test(expr) || /\.AsEnumerable\(\)/i.test(expr)
    || /\bDataTable\b.*\.Rows\b/i.test(expr) || /^(\w+)\.Rows$/i.test(expr);

  if (isDataTableIteration && itemType !== "scg2:DataRow") {
    console.warn(`[ForEach Guard] Type mismatch: x:TypeArguments="${itemType}" but Values expression "${expr}" iterates DataTable rows — auto-correcting to scg2:DataRow`);
    return "scg2:DataRow";
  }

  if (itemType === "x:String" && /\.Rows\b/i.test(expr)) {
    console.warn(`[ForEach Guard] Type mismatch: x:TypeArguments="x:String" but Values expression "${expr}" appears to iterate rows — auto-correcting to scg2:DataRow`);
    return "scg2:DataRow";
  }

  return itemType;
}

function upgradeObjectVariableForForEachConsumer(
  valuesExpression: string,
  allVariables: VariableDeclaration[],
  itemType: string,
): void {
  const expr = valuesExpression.trim().replace(/^\[|\]$/g, "").trim();
  const simpleVarMatch = expr.match(/^([a-zA-Z_]\w*)$/);
  if (!simpleVarMatch) return;

  const varName = simpleVarMatch[1];
  const decl = allVariables.find(v => v.name === varName);
  if (!decl) return;

  const isObjectTyped = decl.type === "x:Object" || decl.type === "System.Object" || decl.type === "Object";
  if (!isObjectTyped) return;

  const safeCollectionType = `scg:List(${itemType || "x:Object"})`;
  console.warn(`[Consumer-Driven Type Inference] Variable "${varName}" typed as "${decl.type}" but bound to ForEach.Values (expects IEnumerable) — upgrading to "${safeCollectionType}"`);
  (decl as { type: string }).type = safeCollectionType;
}

function assembleForEachNode(
  node: ForEachNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
  registry?: DeclarationRegistry,
): string {
  const displayName = escapeXml(node.displayName);
  const inferredType = inferForEachItemType(node.itemType || "x:Object", node.valuesExpression, allVariables);
  const itemType = validateForEachTypeConsistency(inferredType, node.valuesExpression);

  upgradeObjectVariableForForEachConsumer(node.valuesExpression, allVariables, itemType);

  const wrappedValues = ensureBracketWrapped(node.valuesExpression, _activeDeclarationLookup || undefined);

  const effectiveIteratorName = inferForEachIteratorFromBody(node, allVariables);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext, registry))
    .join("\n");

  const bodyContent = bodyXml.trim()
    ? bodyXml
    : `<ui:LogMessage Level="Trace" DisplayName="TODO - Implement ForEach body" Message="[&quot;Placeholder — ForEach body has no activities yet&quot;]" />`;

  const valuesInner = wrappedValues.startsWith("[") && wrappedValues.endsWith("]")
    ? `[${escapeXmlExpression(wrappedValues.slice(1, -1))}]`
    : escapeXmlExpression(wrappedValues);
  return `<ForEach x:TypeArguments="${itemType}" Values="${valuesInner}" DisplayName="${displayName}">\n` +
    `  <ActivityAction x:TypeArguments="${itemType}">\n` +
    `    <ActivityAction.Argument>\n` +
    `      <DelegateInArgument x:TypeArguments="${itemType}" Name="${escapeXml(registry ? (resolveForEachIteratorName(node, registry)) : effectiveIteratorName)}" />\n` +
    `    </ActivityAction.Argument>\n` +
    `    <Sequence DisplayName="Body">\n` +
    `      ${bodyContent}\n` +
    `    </Sequence>\n` +
    `  </ActivityAction>\n` +
    `</ForEach>`;
}

function assembleRetryScopeNode(
  node: RetryScopeNode,
  allVariables: VariableDeclaration[],
  processType: ProcessType,
  depthLevel: number,
  emissionContext: EmissionContext = "normal",
  registry?: DeclarationRegistry,
): string {
  const displayName = escapeXml(node.displayName);

  const bodyXml = node.bodyChildren
    .map(child => assembleNode(child, allVariables, processType, depthLevel + 1, emissionContext, registry))
    .join("\n");

  const bodyContent = bodyXml.trim()
    ? bodyXml
    : `<ui:LogMessage Level="Trace" DisplayName="TODO - Implement RetryScope body" Message="[&quot;Placeholder — RetryScope body has no activities yet&quot;]" />`;

  const safeInterval = sanitizeRetryInterval(node.retryInterval);
  return `<ui:RetryScope NumberOfRetries="${node.numberOfRetries}" RetryInterval="${safeInterval}" DisplayName="${displayName}">\n` +
    `  <ui:RetryScope.Condition>\n` +
    `    <ui:ShouldRetry />\n` +
    `  </ui:RetryScope.Condition>\n` +
    `  <Sequence DisplayName="Retry Body">\n` +
    `    ${bodyContent}\n` +
    `  </Sequence>\n` +
    `</ui:RetryScope>`;
}

function buildVariablesBlock(variables: VariableDeclaration[]): string {
  if (variables.length === 0) return "";
  let xml = "<Sequence.Variables>\n";
  const seen = new Set<string>();
  for (const v of variables) {
    if (seen.has(v.name)) continue;
    seen.add(v.name);
    let typeAttr = mapClrType(v.type);
    if (typeAttr === "x:Object") {
      const prefixType = inferTypeFromPrefix(v.name);
      if (prefixType) {
        typeAttr = prefixType;
      } else {
        const defaultType = inferTypeFromDefault(v.default);
        if (defaultType) typeAttr = defaultType;
      }
    }
    typeAttr = normalizeVariableTypeAttr(typeAttr);
    let defaultAttr = "";
    if (v.default) {
      const isObjectType = typeAttr === "x:Object" || typeAttr.includes("System.Object");
      if (isObjectType) {
        console.warn(`[Variable Guard] Omitting Default="${v.default}" for x:Object variable "${v.name}" — UiPath does not support Literal<Object>`);
      } else {
        const wrappedDefault = wrapVariableDefault(v.default, v.type);
        defaultAttr = ` Default="${serializeSafeAttributeValue(wrappedDefault)}"`;
      }
    }
    if (v.type && v.type.includes("clr-namespace:")) {
      xml += `      <Variable x:TypeArguments="${v.type}" Name="${escapeXml(v.name)}"${defaultAttr} />\n`;
    } else {
      xml += `      <Variable x:TypeArguments="${typeAttr}" Name="${escapeXml(v.name)}"${defaultAttr} />\n`;
    }
  }
  xml += "    </Sequence.Variables>";
  return xml;
}

export function ensureBalancedParens(typeExpr: string): string {
  const opens = (typeExpr.match(/\(/g) || []).length;
  const closes = (typeExpr.match(/\)/g) || []).length;
  if (opens > closes) {
    return typeExpr + ")".repeat(opens - closes);
  }
  return typeExpr;
}

function buildXMembersBlock(
  args: Array<{ name: string; direction: string; type: string }>
): string {
  if (!args || args.length === 0) return "";
  const lines: string[] = [];
  lines.push("  <x:Members>");
  for (const arg of args) {
    const clrType = mapClrType(arg.type, "critical");
    const dir = arg.direction || "InArgument";
    const typeExpr = ensureBalancedParens(`${dir}(${clrType})`);
    lines.push(`    <x:Property Name="${escapeXml(arg.name)}" Type="${typeExpr}" />`);
  }
  lines.push("  </x:Members>");
  return lines.join("\n") + "\n";
}

function collectGetCredentialNodes(node: WorkflowNode): ActivityNode[] {
  const results: ActivityNode[] = [];
  if (node.kind === "activity" && node.template === "GetCredential") {
    results.push(node);
  } else if (node.kind === "sequence") {
    for (const child of node.children) results.push(...collectGetCredentialNodes(child));
  } else if (node.kind === "tryCatch") {
    for (const child of [...node.tryChildren, ...node.catchChildren, ...node.finallyChildren]) results.push(...collectGetCredentialNodes(child));
  } else if (node.kind === "if") {
    for (const child of [...node.thenChildren, ...node.elseChildren]) results.push(...collectGetCredentialNodes(child));
  } else if (node.kind === "while" || node.kind === "forEach" || node.kind === "retryScope") {
    for (const child of node.bodyChildren) results.push(...collectGetCredentialNodes(child));
  }
  return results;
}

function crossCheckGetCredentialVariableTypes(
  rootSequence: { children: WorkflowNode[]; variables?: VariableDeclaration[] },
  allVariables: VariableDeclaration[],
): void {
  const credNodes: ActivityNode[] = [];
  for (const child of rootSequence.children) {
    credNodes.push(...collectGetCredentialNodes(child));
  }

  for (const node of credNodes) {
    const props = node.properties || {};
    const passwordVar = coerceGetCredentialProp(props.Password || props.password || "sec_Password", "Password");
    const usernameVar = coerceGetCredentialProp(props.Username || props.username || "str_Username", "Username");

    const pwDecl = allVariables.find(v => v.name === passwordVar);
    if (pwDecl) {
      const mapped = mapClrType(pwDecl.type);
      if (mapped !== "s:Security.SecureString") {
        console.log(`[CrossCheck] Fixing variable ${passwordVar} type from ${pwDecl.type} to SecureString for GetCredential.Password`);
        pwDecl.type = "SecureString";
      }
    } else {
      allVariables.push({ name: passwordVar, type: "SecureString" });
      console.log(`[CrossCheck] Added missing variable ${passwordVar} as SecureString for GetCredential.Password`);
    }

    const unDecl = allVariables.find(v => v.name === usernameVar);
    if (!unDecl) {
      allVariables.push({ name: usernameVar, type: "String" });
      console.log(`[CrossCheck] Added missing variable ${usernameVar} as String for GetCredential.Username`);
    }
  }
}

function crossCheckGetCredentialVariableTypesRegistry(
  rootSequence: { children: WorkflowNode[]; variables?: VariableDeclaration[] },
  registry: DeclarationRegistry,
): void {
  const credNodes: ActivityNode[] = [];
  for (const child of rootSequence.children) {
    credNodes.push(...collectGetCredentialNodes(child));
  }

  for (const node of credNodes) {
    const props = node.properties || {};
    const passwordVar = coerceGetCredentialProp(props.Password || props.password || "sec_Password", "Password");
    const usernameVar = coerceGetCredentialProp(props.Username || props.username || "str_Username", "Username");

    if (registry.hasVariableName(passwordVar)) {
      const existing = registry.getVariable(passwordVar);
      if (existing) {
        const mapped = mapClrType(existing.type);
        if (mapped !== "s:Security.SecureString") {
          console.log(`[CrossCheck] Fixing variable ${passwordVar} type from ${existing.type} to SecureString for GetCredential.Password`);
          registry.updateVariableType(passwordVar, "SecureString", "auto-injected");
        }
      }
    } else {
      registry.registerVariable({
        name: passwordVar,
        type: "SecureString",
        source: "auto-injected",
        scope: "workflow",
      });
      console.log(`[CrossCheck] Added missing variable ${passwordVar} as SecureString for GetCredential.Password`);
    }

    if (!registry.hasVariableName(usernameVar)) {
      registry.registerVariable({
        name: usernameVar,
        type: "String",
        source: "auto-injected",
        scope: "workflow",
      });
      console.log(`[CrossCheck] Added missing variable ${usernameVar} as String for GetCredential.Username`);
    }
  }
}

function replaceVariableRefsInString(str: string, renameMap: Map<string, string>): string {
  let result = str;
  renameMap.forEach((newName, oldName) => {
    if (oldName === newName) return;
    const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`\\b${escaped}\\b`, "g"), newName);
  });
  return result;
}

function sanitizeVariableDeclarations(
  vars: VariableDeclaration[],
  renameMap: Map<string, string>,
): VariableDeclaration[] {
  const seen = new Set<string>();
  return vars.map(v => {
    const safeName = sanitizeVariableName(v.name);
    if (safeName !== v.name) {
      renameMap.set(v.name, safeName);
    }
    let finalName = safeName;
    let counter = 2;
    while (seen.has(finalName)) {
      finalName = `${safeName}_${counter}`;
      counter++;
    }
    if (finalName !== safeName && safeName !== v.name) {
      renameMap.set(v.name, finalName);
    }
    seen.add(finalName);
    return { ...v, name: finalName };
  });
}

function sanitizeNodeVariableRefs(node: WorkflowNode, renameMap: Map<string, string>): WorkflowNode {
  if (renameMap.size === 0) return node;

  if (node.kind === "activity") {
    const newProps: Record<string, PropertyValue> = {};
    for (const [k, v] of Object.entries(node.properties)) {
      if (typeof v === "string") {
        newProps[k] = replaceVariableRefsInString(v, renameMap);
      } else {
        newProps[k] = v;
      }
    }
    const newOutputVar = node.outputVar ? replaceVariableRefsInString(node.outputVar, renameMap) : node.outputVar;
    return { ...node, properties: newProps, outputVar: newOutputVar };
  }

  if (node.kind === "sequence") {
    const localVars = node.variables ? sanitizeVariableDeclarations(node.variables, renameMap) : node.variables;
    return {
      ...node,
      variables: localVars,
      children: node.children.map(c => sanitizeNodeVariableRefs(c, renameMap)),
    };
  }

  if (node.kind === "tryCatch") {
    return {
      ...node,
      tryChildren: node.tryChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
      catchChildren: node.catchChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
      finallyChildren: node.finallyChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
    };
  }

  if (node.kind === "if") {
    const newCond = typeof node.condition === "string"
      ? replaceVariableRefsInString(node.condition, renameMap)
      : node.condition;
    return {
      ...node,
      condition: newCond,
      thenChildren: node.thenChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
      elseChildren: node.elseChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
    };
  }

  if (node.kind === "while") {
    const newCond = typeof node.condition === "string"
      ? replaceVariableRefsInString(node.condition, renameMap)
      : node.condition;
    return {
      ...node,
      condition: newCond,
      bodyChildren: node.bodyChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
    };
  }

  if (node.kind === "forEach") {
    return {
      ...node,
      valuesExpression: replaceVariableRefsInString(node.valuesExpression, renameMap),
      iteratorName: sanitizeVariableName(node.iteratorName || "item"),
      bodyChildren: node.bodyChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
    };
  }

  if (node.kind === "retryScope") {
    return {
      ...node,
      bodyChildren: node.bodyChildren.map(c => sanitizeNodeVariableRefs(c, renameMap)),
    };
  }

  return node;
}

function injectTransactionItemNullGuard(activitiesXml: string, allVariables: VariableDeclaration[]): string {
  const transactionVarNames = allVariables
    .filter(v => v.type === "UiPath.Core.QueueItem" || v.type === "ui:QueueItem")
    .map(v => v.name);

  if (transactionVarNames.length === 0) {
    const defaultNames = ["qi_TransactionItem", "obj_TransactionItem", "out_TransactionItem"];
    for (const name of defaultNames) {
      if (activitiesXml.includes(`${name}.`)) {
        transactionVarNames.push(name);
      }
    }
  }

  if (transactionVarNames.length === 0) return activitiesXml;

  for (const varName of transactionVarNames) {
    const propAccessPattern = new RegExp(`${varName}\\.\\w+`);
    if (!propAccessPattern.test(activitiesXml)) continue;

    const alreadyGuarded = new RegExp(
      `Condition="\\[${varName}\\s+IsNot\\s+Nothing\\]"`,
      "i"
    ).test(activitiesXml);
    if (alreadyGuarded) continue;

    const topLevelActivities = extractTopLevelXmlElements(activitiesXml);
    if (topLevelActivities.length === 0) continue;

    const accessingElements: string[] = [];
    const nonAccessingElements: string[] = [];

    for (const elem of topLevelActivities) {
      if (propAccessPattern.test(elem)) {
        accessingElements.push(elem);
      } else {
        nonAccessingElements.push(elem);
      }
    }

    if (accessingElements.length === 0) continue;

    const guardedContent = accessingElements.join("\n    ");
    const guardedBlock =
      `<If DisplayName="Check ${varName} Not Null" Condition="[${varName} IsNot Nothing]">\n` +
      `      <If.Then>\n` +
      `        <Sequence DisplayName="${varName} Processing">\n` +
      `          ${guardedContent}\n` +
      `        </Sequence>\n` +
      `      </If.Then>\n` +
      `      <If.Else>\n` +
      `        <Sequence DisplayName="${varName} Is Null">\n` +
      `          <ui:LogMessage Level="Warn" Message="[&quot;${varName} is Nothing — skipping property access&quot;]" DisplayName="Null Guard: ${varName}" />\n` +
      `        </Sequence>\n` +
      `      </If.Else>\n` +
      `    </If>`;

    const rebuiltParts: string[] = [];
    let accessIdx = 0;
    let guardInserted = false;
    for (const elem of topLevelActivities) {
      if (propAccessPattern.test(elem)) {
        if (!guardInserted) {
          rebuiltParts.push(guardedBlock);
          guardInserted = true;
        }
        accessIdx++;
      } else {
        rebuiltParts.push(elem);
      }
    }

    activitiesXml = rebuiltParts.join("\n    ");
  }

  return activitiesXml;
}

function extractTopLevelXmlElements(xml: string): string[] {
  const elements: string[] = [];
  const trimmed = xml.trim();
  if (!trimmed) return elements;

  let i = 0;
  while (i < trimmed.length) {
    while (i < trimmed.length && trimmed[i] !== '<') i++;
    if (i >= trimmed.length) break;

    if (trimmed.substring(i, i + 4) === '<!--') {
      const commentEnd = trimmed.indexOf('-->', i + 4);
      if (commentEnd < 0) {
        elements.push(trimmed.substring(i));
        break;
      }
      elements.push(trimmed.substring(i, commentEnd + 3));
      i = commentEnd + 3;
      continue;
    }

    const tagNameMatch = trimmed.substring(i).match(/^<([a-zA-Z][\w:.]*)/);
    if (!tagNameMatch) {
      i++;
      continue;
    }

    const tagName = tagNameMatch[1];
    let depth = 0;
    let j = i;
    let foundEnd = false;

    while (j < trimmed.length) {
      const nextOpen = trimmed.indexOf('<', j);
      if (nextOpen < 0) break;

      if (trimmed[nextOpen + 1] === '/') {
        const closeTag = trimmed.substring(nextOpen).match(/^<\/([a-zA-Z][\w:.]*)\s*>/);
        if (closeTag) {
          if (depth === 0 && closeTag[1] === tagName) {
            const end = nextOpen + closeTag[0].length;
            elements.push(trimmed.substring(i, end));
            i = end;
            foundEnd = true;
            break;
          }
          if (closeTag[1] === tagName) depth--;
          j = nextOpen + closeTag[0].length;
          continue;
        }
      }

      const selfClose = trimmed.substring(nextOpen).match(/^<[a-zA-Z][\w:.]*[^>]*\/>/);
      if (selfClose && nextOpen === i && depth === 0) {
        elements.push(selfClose[0]);
        i = nextOpen + selfClose[0].length;
        foundEnd = true;
        break;
      }
      if (selfClose) {
        j = nextOpen + selfClose[0].length;
        continue;
      }

      const openTag = trimmed.substring(nextOpen).match(/^<([a-zA-Z][\w:.]*)/);
      if (openTag) {
        if (nextOpen !== i || depth > 0) {
          if (openTag[1] === tagName) depth++;
        }
        j = nextOpen + openTag[0].length;
      } else {
        j = nextOpen + 1;
      }
    }

    if (!foundEnd) {
      elements.push(trimmed.substring(i));
      break;
    }
  }

  return elements;
}

function hasNodeReference(nodes: WorkflowNode[], name: string): boolean {
  for (const node of nodes) {
    if (node.kind === "activity") {
      const actNode = node as ActivityNode;
      for (const [, val] of Object.entries(actNode.properties || {})) {
        if (typeof val === "string" && val.includes(name)) return true;
        if (isValueIntent(val)) {
          const built = buildExpression(val as ValueIntent);
          if (built.includes(name)) return true;
        }
      }
      if (actNode.outputVar && actNode.outputVar.includes(name)) return true;
    }

    const childArrays: WorkflowNode[][] = [];
    if ("children" in node && Array.isArray((node as any).children)) childArrays.push((node as any).children);
    if ("thenChildren" in node && Array.isArray((node as any).thenChildren)) childArrays.push((node as any).thenChildren);
    if ("elseChildren" in node && Array.isArray((node as any).elseChildren)) childArrays.push((node as any).elseChildren);
    if ("tryChildren" in node && Array.isArray((node as any).tryChildren)) childArrays.push((node as any).tryChildren);
    if ("catchChildren" in node && Array.isArray((node as any).catchChildren)) childArrays.push((node as any).catchChildren);
    if ("finallyChildren" in node && Array.isArray((node as any).finallyChildren)) childArrays.push((node as any).finallyChildren);
    if ("bodyChildren" in node && Array.isArray((node as any).bodyChildren)) childArrays.push((node as any).bodyChildren);

    for (const arr of childArrays) {
      if (hasNodeReference(arr, name)) return true;
    }
  }
  return false;
}

interface ValueIntentMetrics {
  structuredCount: number;
  flatStringCount: number;
}

function countPropertyMetrics(node: WorkflowNode, metrics: ValueIntentMetrics): void {
  if (node.kind === "activity") {
    for (const [, value] of Object.entries(node.properties || {})) {
      if (isValueIntent(value)) {
        metrics.structuredCount++;
      } else {
        metrics.flatStringCount++;
      }
    }
  }
  if (node.kind === "sequence") {
    for (const child of node.children) countPropertyMetrics(child, metrics);
  }
  if (node.kind === "tryCatch") {
    for (const child of node.tryChildren) countPropertyMetrics(child, metrics);
    for (const child of node.catchChildren) countPropertyMetrics(child, metrics);
    for (const child of node.finallyChildren) countPropertyMetrics(child, metrics);
  }
  if (node.kind === "if") {
    for (const child of node.thenChildren) countPropertyMetrics(child, metrics);
    for (const child of node.elseChildren) countPropertyMetrics(child, metrics);
  }
  if (node.kind === "while") {
    for (const child of node.bodyChildren) countPropertyMetrics(child, metrics);
  }
  if (node.kind === "forEach") {
    for (const child of node.bodyChildren) countPropertyMetrics(child, metrics);
  }
  if (node.kind === "retryScope") {
    for (const child of node.bodyChildren) countPropertyMetrics(child, metrics);
  }
}

const SCALAR_REQUIRED_PROPERTIES = new Set([
  "WorkflowFileName", "workflowFileName",
  "Message", "message",
  "AssetName", "assetName",
  "EntityType", "entityType",
  "QueueName", "queueName",
  "QueueType", "queueType",
  "ProcessName", "processName",
  "FileName", "fileName",
  "DisplayName", "displayName",
  "To", "Subject", "Body",
  "Level", "level",
  "Text", "text",
  "TextString", "textString",
  "Timeout", "timeout",
]);

function resolveScalarRequiredProperty(
  value: PropertyValue,
  key: string,
  templateName: string,
  workflowFile: string | undefined,
  props: Record<string, any>,
): boolean {
  if (!SCALAR_REQUIRED_PROPERTIES.has(key)) return false;

  if (isValueIntent(value)) {
    const vi = value as ValueIntent;
    if (vi.type === "literal" || vi.type === "vb_expression") {
      if (typeof vi.value === "string") {
        props[key] = vi.value;
        emitTypedPropertyDiagnostic({
          workflowFile: workflowFile || "unknown",
          templateName,
          propertyName: key,
          classification: "scalar-from-object",
          action: "scalar-resolved",
          reason: `Scalar-required property "${key}" resolved from ValueIntent (type=${vi.type}) to plain scalar`,
          stage: "pre-dispatch-scalar-resolution",
        });
        return true;
      }
    }
    if (vi.type === "variable" && typeof vi.name === "string") {
      const FILENAME_PROPERTIES = new Set(["WorkflowFileName", "workflowFileName", "FileName", "fileName"]);
      if (FILENAME_PROPERTIES.has(key)) {
        props[key] = vi.name;
        emitTypedPropertyDiagnostic({
          workflowFile: workflowFile || "unknown",
          templateName,
          propertyName: key,
          classification: "scalar-from-object",
          action: "scalar-resolved",
          reason: `Filename property "${key}" resolved from ValueIntent variable to name "${vi.name}"`,
          stage: "pre-dispatch-scalar-resolution",
        });
        return true;
      }
    }
  }

  if (typeof value === "object" && value !== null && !isValueIntent(value)) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.type === "string") {
      if ((obj.type === "literal" || obj.type === "vb_expression") && typeof obj.value === "string") {
        props[key] = obj.value;
        emitTypedPropertyDiagnostic({
          workflowFile: workflowFile || "unknown",
          templateName,
          propertyName: key,
          classification: "scalar-from-object",
          action: "scalar-resolved",
          reason: `Scalar-required property "${key}" resolved from typed object (type=${obj.type}) to plain scalar`,
          stage: "pre-dispatch-scalar-resolution",
        });
        return true;
      }
      if (obj.type === "variable" && typeof obj.name === "string") {
        props[key] = obj.name;
        emitTypedPropertyDiagnostic({
          workflowFile: workflowFile || "unknown",
          templateName,
          propertyName: key,
          classification: "scalar-from-object",
          action: "scalar-resolved",
          reason: `Scalar-required property "${key}" resolved from typed variable object to name "${obj.name}"`,
          stage: "pre-dispatch-scalar-resolution",
        });
        return true;
      }
    }

    console.warn(`[normalizeSpecProperties] Scalar-required property "${key}" on "${templateName}" contains unresolvable structured value — blocking: ${JSON.stringify(value).substring(0, 120)}`);
    emitTypedPropertyDiagnostic({
      workflowFile: workflowFile || "unknown",
      templateName,
      propertyName: key,
      classification: "unsupported-structured",
      action: "blocked",
      reason: `Scalar-required property "${key}" contains unresolvable structured value — blocked to prevent object leakage`,
      rawShape: JSON.stringify(value).substring(0, 200),
      stage: "pre-dispatch-scalar-resolution",
    });
    delete props[key];
    return true;
  }

  return false;
}

function normalizeSpecProperties(node: WorkflowNode, workflowFile?: string): void {
  if (node.kind === "activity") {
    const templateName = node.template || "";
    for (const [key, value] of Object.entries(node.properties || {})) {
      if (resolveScalarRequiredProperty(value, key, templateName, workflowFile, node.properties as Record<string, any>)) {
        continue;
      }
      if (isValueIntent(value)) {
        resolveNestedJsonInValueIntent(value as ValueIntent, key, node.properties as Record<string, any>);
      } else if (!isValueIntent(value) && typeof value === "string") {
        const clrType = catalogService.getPropertyClrType(templateName.replace(/^[a-z]+:/, ""), key) || undefined;
        const normalized = normalizePropertyToValueIntent(
          value,
          templateName,
          key,
          (cls, prop) => catalogService.getEnumValues(cls, prop),
          undefined,
          clrType,
        );
        (node.properties as Record<string, any>)[key] = normalized;

        const normalizedOutput = isValueIntent(normalized)
          ? buildExpression(normalized as ValueIntent)
          : String(normalized);
        emitPropertySerializationTrace({
          workflowFile: workflowFile || "unknown",
          activityType: templateName,
          propertyName: key,
          originalRawValue: value.substring(0, 500),
          parsedIntentType: `pre-assembly:${isValueIntent(normalized) ? (normalized as ValueIntent).type : "passthrough"}`,
          normalizedOutput: normalizedOutput.substring(0, 500),
          fallbackUsed: false,
          finalValueHash: computeContentHash(normalizedOutput),
        });
      } else if (!isValueIntent(value) && typeof value === "object" && value !== null) {
        const STRUCTURED_PROPERTY_ALLOWLIST: Record<string, Set<string>> = {
          "InvokeWorkflowFile": new Set(["Arguments", "arguments"]),
        };
        const strippedTemplate = templateName.replace(/^[a-z]+:/, "");
        const allowedProps = STRUCTURED_PROPERTY_ALLOWLIST[strippedTemplate];
        if (allowedProps && allowedProps.has(key)) {
          continue;
        }
        const classification = classifyPropertyValue(value, key, templateName);
        if (classification.kind === "unsupported-structured") {
          console.warn(`[normalizeSpecProperties] Blocking unsupported structured property "${key}" on "${templateName}" — property removed from spec: ${classification.reason}`);
          delete (node.properties as Record<string, any>)[key];
          emitTypedPropertyDiagnostic({
            workflowFile: workflowFile || "unknown",
            templateName,
            propertyName: key,
            classification: "unsupported-structured",
            action: "blocked",
            reason: classification.reason,
            rawShape: classification.rawShape,
            stage: "pre-assembly-normalization",
          });
        } else if (classification.kind === "scalar") {
          (node.properties as Record<string, any>)[key] = classification.value;
          emitTypedPropertyDiagnostic({
            workflowFile: workflowFile || "unknown",
            templateName,
            propertyName: key,
            classification: "scalar-from-object",
            action: "scalar-extracted",
            reason: `Typed property object resolved to scalar value`,
            stage: "pre-assembly-normalization",
          });
        }
      }
    }
  }
  if (node.kind === "sequence") {
    for (const child of node.children) normalizeSpecProperties(child, workflowFile);
  }
  if (node.kind === "tryCatch") {
    for (const child of node.tryChildren) normalizeSpecProperties(child, workflowFile);
    for (const child of node.catchChildren) normalizeSpecProperties(child, workflowFile);
    for (const child of node.finallyChildren) normalizeSpecProperties(child, workflowFile);
  }
  if (node.kind === "if") {
    for (const child of node.thenChildren) normalizeSpecProperties(child, workflowFile);
    for (const child of node.elseChildren) normalizeSpecProperties(child, workflowFile);
  }
  if (node.kind === "while") {
    for (const child of node.bodyChildren) normalizeSpecProperties(child, workflowFile);
  }
  if (node.kind === "forEach") {
    for (const child of node.bodyChildren) normalizeSpecProperties(child, workflowFile);
  }
  if (node.kind === "retryScope") {
    for (const child of node.bodyChildren) normalizeSpecProperties(child, workflowFile);
  }
}

function sanitizeBooleanInArguments(xml: string): string {
  return xml.replace(
    /<(InArgument|OutArgument)\s+x:TypeArguments="x:Boolean">"(True|False)"<\/(InArgument|OutArgument)>/g,
    (match, openTag, boolVal, closeTag) => {
      if (openTag !== closeTag) return match;
      console.log(`[Boolean Sanitizer] Stripped quotes from boolean InArgument: "${boolVal}" → ${boolVal}`);
      return `<${openTag} x:TypeArguments="x:Boolean">${boolVal}</${closeTag}>`;
    }
  );
}

function demoteUndeclaredBracketReferences(xml: string, registry: DeclarationRegistry): string {
  return xml.replace(/<(In|Out|InOut)Argument[^>]*>\[([a-zA-Z_]\w*)\]<\/(In|Out|InOut)Argument>/g, (match, openTag, name, closeTag) => {
    if (openTag !== closeTag) return match;
    if (registry.hasName(name)) return match;
    if (DEMOTION_WHITELIST_REGEX.test(name)) return match;
    console.log(`[Literal Demotion] Post-emission: demoted bracket reference [${name}] to literal "${name}" in ${openTag}Argument (not in declaration registry)`);
    return match.replace(`[${name}]`, `"${name}"`);
  });
}

function recursivelyResolveJsonField(fieldVal: string): { resolved: string; success: boolean } {
  const MAX_DEPTH = 5;
  let current = fieldVal;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (!containsValueIntentJson(current)) break;
    const parsed = tryParseJsonValueIntent(current);
    if (!parsed) return { resolved: current, success: false };
    try {
      current = buildExpression(parsed.intent);
    } catch {
      return { resolved: current, success: false };
    }
  }
  if (containsValueIntentJson(current)) {
    return { resolved: current, success: false };
  }
  return { resolved: current, success: true };
}

function resolveNestedJsonInValueIntent(intent: ValueIntent, key: string, properties: Record<string, any>): void {
  switch (intent.type) {
    case "literal": {
      if (intent.value === undefined) {
        console.warn(`[normalizeSpecProperties] ValueIntent "literal" has undefined "value" — resolving to empty literal`);
        properties[key] = { type: "literal", value: "" };
        return;
      }
      if (containsValueIntentJson(intent.value)) {
        const result = recursivelyResolveJsonField(intent.value);
        if (!result.success) {
          console.warn(`[normalizeSpecProperties] Unresolvable nested JSON in literal.value of "${key}" — replacing with empty literal`);
          properties[key] = { type: "literal", value: "" };
          return;
        }
        if (result.resolved !== intent.value) {
          console.log(`[normalizeSpecProperties] Resolved nested JSON in literal.value of "${key}": ${intent.value.substring(0, 80)} → ${result.resolved.substring(0, 80)}`);
          properties[key] = { type: "literal", value: result.resolved };
        }
      }
      break;
    }
    case "vb_expression": {
      if (intent.value === undefined) {
        console.warn(`[normalizeSpecProperties] ValueIntent "vb_expression" has undefined "value" — resolving to empty literal`);
        properties[key] = { type: "literal", value: "" };
        return;
      }
      if (containsValueIntentJson(intent.value)) {
        const result = recursivelyResolveJsonField(intent.value);
        if (!result.success) {
          console.warn(`[normalizeSpecProperties] Unresolvable nested JSON in vb_expression.value of "${key}" — replacing with empty literal`);
          properties[key] = { type: "literal", value: "" };
          return;
        }
        if (result.resolved !== intent.value) {
          console.log(`[normalizeSpecProperties] Resolved nested JSON in vb_expression.value of "${key}": ${intent.value.substring(0, 80)} → ${result.resolved.substring(0, 80)}`);
          properties[key] = { type: "vb_expression", value: result.resolved };
        }
      }
      break;
    }
    case "variable": {
      if (intent.name === undefined || intent.name === "") {
        console.warn(`[normalizeSpecProperties] ValueIntent "variable" has empty/undefined "name" — resolving to empty literal`);
        properties[key] = { type: "literal", value: "" };
        return;
      }
      if (containsValueIntentJson(intent.name)) {
        const result = recursivelyResolveJsonField(intent.name);
        if (!result.success) {
          console.warn(`[normalizeSpecProperties] Unresolvable nested JSON in variable.name of "${key}" — replacing with empty literal`);
          properties[key] = { type: "literal", value: "" };
          return;
        }
        if (result.resolved !== intent.name) {
          console.log(`[normalizeSpecProperties] Resolved nested JSON in variable.name of "${key}": ${intent.name.substring(0, 80)} → ${result.resolved.substring(0, 80)}`);
          properties[key] = { type: "vb_expression", value: result.resolved };
        }
      }
      break;
    }
    case "url_with_params": {
      if (intent.baseUrl === undefined || intent.baseUrl === "") {
        console.warn(`[normalizeSpecProperties] ValueIntent "url_with_params" has empty/undefined "baseUrl" — resolving to empty literal`);
        properties[key] = { type: "literal", value: "" };
        return;
      }
      if (containsValueIntentJson(intent.baseUrl)) {
        const result = recursivelyResolveJsonField(intent.baseUrl);
        if (!result.success) {
          console.warn(`[normalizeSpecProperties] Unresolvable nested JSON in url_with_params.baseUrl of "${key}" — replacing with empty literal`);
          properties[key] = { type: "literal", value: "" };
          return;
        }
        if (result.resolved !== intent.baseUrl) {
          console.log(`[normalizeSpecProperties] Resolved nested JSON in url_with_params.baseUrl of "${key}": ${intent.baseUrl.substring(0, 80)} → ${result.resolved.substring(0, 80)}`);
          properties[key] = { type: "url_with_params", baseUrl: result.resolved, params: intent.params || {} };
        }
      }
      break;
    }
  }
}

function lowerPropertyValueInPlace(obj: Record<string, any>, key: string): void {
  const val = obj[key];
  if (typeof val === "string" && containsValueIntentJson(val)) {
    const jsonResult = tryParseJsonValueIntent(val);
    if (jsonResult) {
      try {
        const resolved = buildExpression(jsonResult.intent);
        obj[key] = jsonResult.intent;
        emitJsonResolutionDiagnostic(val, jsonResult.intent, resolved, jsonResult.fallbackUsed);
        console.log(`[Pre-Assembly Lowering] Resolved JSON ValueIntent in property "${key}": ${val.substring(0, 80)} → ${resolved.substring(0, 80)}`);
      } catch (e) {
        console.warn(`[Pre-Assembly Lowering] Failed to lower property "${key}": ${(e as Error).message}`);
      }
    }
  } else if (val !== null && val !== undefined && typeof val === "object" && isValueIntent(val)) {
    resolveNestedJsonInValueIntent(val as ValueIntent, key, obj);
  } else if (val !== null && val !== undefined && typeof val === "object" && !isValueIntent(val)) {
    if (isTypedPropertyObject(val)) {
      const classification = classifyPropertyValue(val, key);
      if (classification.kind === "scalar") {
        obj[key] = classification.value;
        console.log(`[Pre-Assembly Lowering] Resolved incomplete typed property object in "${key}" to scalar: "${classification.value.substring(0, 80)}"`);
      } else if (classification.kind === "unsupported-structured") {
        delete obj[key];
        console.warn(`[Pre-Assembly Lowering] Blocked unsupported typed property object in "${key}" — property removed: ${classification.reason}`);
      }
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        lowerPropertyValueInPlace(val, String(i));
      }
    } else {
      for (const nestedKey of Object.keys(val)) {
        lowerPropertyValueInPlace(val, nestedKey);
      }
    }
  }
}

function preAssemblyLowerValueIntents(node: WorkflowNode): void {
  if (node.kind === "activity") {
    const actNode = node as ActivityNode;
    const props = actNode.properties;
    if (props) {
      for (const key of Object.keys(props)) {
        lowerPropertyValueInPlace(props as Record<string, any>, key);
      }
    }
  }

  if (node.kind === "if") {
    const ifNode = node as IfNode;
    if (typeof ifNode.condition === "string" && containsValueIntentJson(ifNode.condition)) {
      const jsonResult = tryParseJsonValueIntent(ifNode.condition);
      if (jsonResult) {
        ifNode.condition = jsonResult.intent as ValueIntent;
        console.log(`[Pre-Assembly Lowering] Resolved JSON ValueIntent in If condition`);
      }
    }
  }

  if (node.kind === "while") {
    const whileNode = node as WhileNode;
    if (typeof whileNode.condition === "string" && containsValueIntentJson(whileNode.condition)) {
      const jsonResult = tryParseJsonValueIntent(whileNode.condition);
      if (jsonResult) {
        whileNode.condition = jsonResult.intent as ValueIntent;
        console.log(`[Pre-Assembly Lowering] Resolved JSON ValueIntent in While condition`);
      }
    }
  }

  if (node.kind === "forEach") {
    const forEachNode = node as ForEachNode;
    if (containsValueIntentJson(forEachNode.valuesExpression)) {
      const originalValuesExpr = forEachNode.valuesExpression;
      const jsonResult = tryParseJsonValueIntent(originalValuesExpr);
      if (jsonResult) {
        try {
          const resolved = buildExpression(jsonResult.intent);
          forEachNode.valuesExpression = resolved;
          emitJsonResolutionDiagnostic(originalValuesExpr, jsonResult.intent, resolved, jsonResult.fallbackUsed);
          console.log(`[Pre-Assembly Lowering] Resolved JSON ValueIntent in ForEach valuesExpression: ${originalValuesExpr.substring(0, 80)} → ${resolved}`);
        } catch (e) {
          console.warn(`[Pre-Assembly Lowering] Failed to lower ForEach valuesExpression: ${(e as Error).message}`);
        }
      }
    }
  }

  const childArrays: WorkflowNode[][] = [];
  if ("children" in node && Array.isArray((node as any).children)) childArrays.push((node as any).children);
  if ("thenChildren" in node && Array.isArray((node as any).thenChildren)) childArrays.push((node as any).thenChildren);
  if ("elseChildren" in node && Array.isArray((node as any).elseChildren)) childArrays.push((node as any).elseChildren);
  if ("bodyChildren" in node && Array.isArray((node as any).bodyChildren)) childArrays.push((node as any).bodyChildren);
  if ("tryChildren" in node && Array.isArray((node as any).tryChildren)) childArrays.push((node as any).tryChildren);
  if ("catchChildren" in node && Array.isArray((node as any).catchChildren)) childArrays.push((node as any).catchChildren);
  if ("finallyChildren" in node && Array.isArray((node as any).finallyChildren)) childArrays.push((node as any).finallyChildren);

  for (const arr of childArrays) {
    for (const child of arr) {
      preAssemblyLowerValueIntents(child);
    }
  }
}

export function assembleWorkflowFromSpec(
  spec: WorkflowSpec,
  processType: ProcessType = "general",
): { xaml: string; variables: VariableDeclaration[]; symbolDiscoveryDiagnostics?: SymbolDiscoveryDiagnostic[] } {
  const workflowName = (spec.name || "Workflow").replace(/"/g, "").replace(/&quot;/g, "").replace(/\s+/g, "_");

  const metrics: ValueIntentMetrics = { structuredCount: 0, flatStringCount: 0 };
  for (const child of spec.rootSequence.children) {
    countPropertyMetrics(child, metrics);
  }

  const totalProps = metrics.structuredCount + metrics.flatStringCount;
  if (totalProps > 0) {
    const structuredPct = ((metrics.structuredCount / totalProps) * 100).toFixed(1);
    console.log(`[ValueIntent Metrics] "${workflowName}": ${metrics.structuredCount}/${totalProps} properties arrived as structured ValueIntent (${structuredPct}%), ${metrics.flatStringCount} flat strings`);
    if (metrics.flatStringCount > 0 && metrics.flatStringCount > metrics.structuredCount) {
      console.warn(`[ValueIntent Migration] "${workflowName}": high flat-string rate (${metrics.flatStringCount}/${totalProps}) — consider migrating to structured ValueIntent format`);
    }
  }

  const normalizedRootSequence = normalizeWorkflowTreeForGenerators(spec.rootSequence, workflowName);
  const irDiags = getAndClearNormalizationDiagnostics();
  if (irDiags.length > 0) {
    console.log(`[Spec-IR Normalizer] "${workflowName}": ${irDiags.length} normalization(s) applied before generator dispatch`);
    for (const d of irDiags) {
      if (d.blockedReason) {
        console.warn(`[Spec-IR Normalizer]   BLOCKED ${d.propertyName}: ${d.blockedReason}`);
      }
    }
  }
  const normalizedSpec = { ...spec, rootSequence: normalizedRootSequence as typeof spec.rootSequence };

  const workflowFileName = workflowName.endsWith(".xaml") ? workflowName : `${workflowName}.xaml`;
  for (const child of normalizedSpec.rootSequence.children) {
    normalizeSpecProperties(child, workflowFileName);
  }

  const renameMap = new Map<string, string>();
  const sanitizedTopVars = sanitizeVariableDeclarations(normalizedSpec.variables || [], renameMap);
  const sanitizedRootVars = normalizedSpec.rootSequence.variables
    ? sanitizeVariableDeclarations(normalizedSpec.rootSequence.variables, renameMap)
    : undefined;
  const sanitizedRootChildren = normalizedSpec.rootSequence.children.map(c => sanitizeNodeVariableRefs(c, renameMap));

  const registry = new DeclarationRegistry();

  for (const v of sanitizedTopVars) {
    registry.registerVariable({
      name: v.name,
      type: v.type,
      default: v.default,
      source: "explicit-spec",
      scope: "workflow",
    });
  }

  if (sanitizedRootVars) {
    for (const v of sanitizedRootVars) {
      registry.registerVariable({
        name: v.name,
        type: v.type,
        default: v.default,
        source: "explicit-spec",
        scope: "workflow",
      });
    }
  }

  if (!registry.hasVariableName("str_ScreenshotPath")) {
    registry.registerVariable({
      name: "str_ScreenshotPath",
      type: "String",
      default: '["screenshots/error_" & DateTime.Now.ToString("yyyyMMdd_HHmmss") & ".png"]',
      source: "auto-injected",
      scope: "workflow",
    });
  }

  for (const arg of (normalizedSpec.arguments || [])) {
    registry.registerArgument({
      name: arg.name,
      direction: arg.direction as "InArgument" | "OutArgument" | "InOutArgument",
      type: arg.type,
      source: "explicit-spec",
      required: arg.required,
    });
  }

  const sanitizedRootSequence = {
    ...normalizedSpec.rootSequence,
    variables: sanitizedRootVars,
    children: sanitizedRootChildren,
  };
  crossCheckGetCredentialVariableTypesRegistry(sanitizedRootSequence, registry);

  registerImplicitOutputVariables(sanitizedRootChildren, registry);

  harvestTemplateInputVariables(sanitizedRootChildren, registry);

  registerScopedDeclarations(sanitizedRootChildren, registry);

  validateStructurallyKnownLocals(sanitizedRootChildren, registry, workflowName);

  for (const child of sanitizedRootChildren) {
    preAssemblyLowerValueIntents(child);
  }

  const syntheticRoot: SequenceNode = { kind: "sequence", displayName: workflowName, children: sanitizedRootChildren };
  walkNodeForArgumentRefs(syntheticRoot, registry, workflowName);

  const isMainWorkflow = workflowName.toLowerCase() === "main" || workflowName.toLowerCase() === "main.xaml";
  const isInitAllSettings = workflowName.toLowerCase().includes("initallsettings");

  const hasDictConfigRefInSpec = !isMainWorkflow && !isInitAllSettings && hasNodeReference(sanitizedRootChildren, "dict_Config");
  if (hasDictConfigRefInSpec && !registry.hasArgumentName("in_Config")) {
    registry.registerArgument({
      name: "in_Config",
      direction: "InArgument",
      type: "scg:Dictionary(x:String, x:Object)",
      source: "auto-injected",
    });
  }
  if (hasDictConfigRefInSpec && !registry.hasVariableName("dict_Config")) {
    registry.registerVariable({
      name: "dict_Config",
      type: "scg:Dictionary(x:String, x:Object)",
      default: "[in_Config]",
      source: "auto-injected",
      scope: "workflow",
    });
  }

  validateReferencesBeforeEmission(sanitizedRootChildren, registry, workflowName);

  const finalVariables = registry.getAllVariables();
  const wfArgs = registry.getAllArgumentsAsSpec();

  _activeDeclarationLookup = (name: string) => registry.hasName(name);
  _lateDiscoveredVariables = [];
  _sweepFallbackCounter = 0;

  let activitiesXml: string;
  try {
    activitiesXml = sanitizedRootChildren
      .map(child => assembleNode(child, finalVariables, processType, 0, "normal", registry))
      .join("\n    ");
    if (_lateDiscoveredVariables.length > 0) {
      for (const lv of _lateDiscoveredVariables) {
        if (!registry.hasName(lv.name)) {
          registry.registerVariable({ name: lv.name, type: lv.type || "x:Object", source: "discovered-reference" });
          finalVariables.push(lv);
        }
      }
      console.log(`[Expression Decomposition] Registered ${_lateDiscoveredVariables.length} intermediate variable(s) from expression decomposition`);
    }
  } catch (e) {
    if (e instanceof CSharpExpressionBlockedError) {
      console.error(`[VB Lint FATAL] Workflow "${workflowName}" blocked due to unconvertible C# expression: ${e.message}`);
      const blockedFallbackXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(workflowName)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:uix="http://schemas.uipath.com/workflow/activities/uix"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(workflowName)}">
    <ui:Comment Text="[VB_EXPRESSION_BLOCKED] Workflow generation was blocked because an expression contained unconvertible C# syntax: ${escapeXml(e.message)}. The expression must be rewritten in VB.NET before this workflow can be generated." DisplayName="BLOCKED — C# Expression Not Convertible" />
  </Sequence>
</Activity>`;
      return { xaml: blockedFallbackXaml, variables: finalVariables, symbolDiscoveryDiagnostics: registry.hasSymbolDiagnostics() ? registry.getSymbolDiagnostics() : undefined };
    }
    throw e;
  } finally {
    _activeDeclarationLookup = null;
    _lateDiscoveredVariables = [];
  }

  activitiesXml = demoteUndeclaredBracketReferences(activitiesXml, registry);

  activitiesXml = sanitizeBooleanInArguments(activitiesXml);

  activitiesXml = injectTransactionItemNullGuard(activitiesXml, finalVariables);

  const resolvedVariables = finalVariables;
  const resolvedArgs = wfArgs;

  if (registry.hasConflicts()) {
    for (const conflict of registry.getConflicts()) {
      console.warn(`[DeclarationRegistry] Conflict detected for "${conflict.name}": ${conflict.existingType} (${conflict.existingSource}) vs ${conflict.incomingType} (${conflict.incomingSource})`);
      registry.recordSymbolDiagnostic({
        symbol: conflict.name,
        category: conflict.existingSource === "argument-discovery" || conflict.incomingSource === "argument-discovery" ? "argument" : "variable",
        inferredType: conflict.existingType,
        declarationEmitted: true,
        scope: "workflow",
        source: conflict.existingSource,
        conflictReason: `Type conflict: existing ${conflict.existingType} (${conflict.existingSource}) vs incoming ${conflict.incomingType} (${conflict.incomingSource})`,
      });
    }
  }

  const variablesBlock = buildVariablesBlock(resolvedVariables);
  const xMembersBlock = buildXMembersBlock(resolvedArgs);

  let xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(workflowName)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=System.Private.CoreLib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:uix="http://schemas.uipath.com/workflow/activities/uix"
  xmlns:ucs="http://schemas.uipath.com/workflow/activities/collection"
  xmlns:udb="http://schemas.uipath.com/workflow/activities/database"
  xmlns:umail="http://schemas.uipath.com/workflow/activities/mail"
  xmlns:updf="http://schemas.uipath.com/workflow/activities/pdf"
  xmlns:upers="http://schemas.uipath.com/workflow/activities/persistence"
  xmlns:uweb="http://schemas.uipath.com/workflow/activities/web"
  xmlns:ss="clr-namespace:System.Security;assembly=System.Private.CoreLib"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"${_buildRootActivityAttr("Windows")}>
${_buildRootActivityChildren("Windows")}
${_buildTextExpressionBlocksShared("Windows")}
${xMembersBlock}  <Sequence DisplayName="${escapeXml(workflowName)}">
    ${variablesBlock}
    ${activitiesXml}
  </Sequence>
</Activity>`;

  xaml = sanitizeObjectLiteralArguments(xaml);

  xaml = deduplicateAssemblyAttributes(xaml);

  const containerResult = validateContainerChildModel(xaml, workflowName);
  xaml = containerResult.repairedXaml;
  for (const repair of containerResult.repairs) {
    console.log(`[Container Repair] ${workflowName}: ${repair}`);
  }
  if (containerResult.errors.length > 0) {
    for (const err of containerResult.errors) {
      console.error(`[Container Error] ${workflowName}: ${err}`);
    }
    const errorSummary = containerResult.errors.join("; ");
    const fallbackXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(workflowName)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:uix="http://schemas.uipath.com/workflow/activities/uix"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(workflowName)}">
    <ui:Comment Text="[CONTAINER_VALIDATION_FAILED] Irrecoverable container structure error(s): ${escapeXml(errorSummary)}. Manual implementation required." DisplayName="Container Validation Failed — ${escapeXml(workflowName)}" />
  </Sequence>
</Activity>`;
    return { xaml: fallbackXaml, variables: resolvedVariables, symbolDiscoveryDiagnostics: registry.hasSymbolDiagnostics() ? registry.getSymbolDiagnostics() : undefined };
  }

  xaml = sanitizeUnescapedAmpersands(xaml);

  const nsResult = injectMissingNamespaceDeclarations(xaml);
  if (nsResult.injected.length > 0) {
    xaml = nsResult.xml;
    console.log(`[Tree Assembler] Injected missing namespace declarations for prefixes: ${nsResult.injected.join(", ")}`);
  }

  const validationResult = XMLValidator.validate(xaml, { allowBooleanAttributes: true });
  if (validationResult !== true) {
    const err = validationResult.err;
    const lines = xaml.split("\n");
    const contextStart = Math.max(0, err.line - 3);
    const contextEnd = Math.min(lines.length, err.line + 2);
    const contextSnippet = lines.slice(contextStart, contextEnd)
      .map((l, i) => `  ${contextStart + i + 1}${contextStart + i + 1 === err.line ? " >>>" : "    "} ${l}`)
      .join("\n");
    console.error(`[Tree Assembler] Post-assembly XML well-formedness check FAILED for "${workflowName}": ${err.msg} at line ${err.line}, col ${err.col}\nContext:\n${contextSnippet}`);
    const fallbackXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(workflowName)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=System.Private.CoreLib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:uix="http://schemas.uipath.com/workflow/activities/uix"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(workflowName)}">
    <ui:Comment Text="[ASSEMBLY_FAILED] Tree assembly produced malformed XML: ${escapeXml(err.msg)} at line ${err.line}, col ${err.col}. Manual implementation required." DisplayName="Assembly Failed — ${escapeXml(workflowName)}" />
  </Sequence>
</Activity>`;
    return { xaml: fallbackXaml, variables: resolvedVariables, symbolDiscoveryDiagnostics: registry.hasSymbolDiagnostics() ? registry.getSymbolDiagnostics() : undefined };
  }

  return { xaml, variables: resolvedVariables, symbolDiscoveryDiagnostics: registry.hasSymbolDiagnostics() ? registry.getSymbolDiagnostics() : undefined };
}

export interface ContainerValidationResult {
  repairedXaml: string;
  repairs: string[];
  errors: string[];
}

export function validateContainerChildModel(xaml: string, workflowName: string): ContainerValidationResult {
  const repairs: string[] = [];
  const errors: string[] = [];
  let patched = xaml;

  patched = patched.replace(/<If\.Then>\s*<\/If\.Then>/g, () => {
    repairs.push("If.Then was empty — injected placeholder Sequence");
    return `<If.Then><Sequence DisplayName="TODO - If.Then"><ui:Comment DisplayName="TODO" Text="If.Then was empty — implement then branch" /></Sequence></If.Then>`;
  });

  patched = patched.replace(/<If\.Else>\s*<\/If\.Else>/g, () => {
    repairs.push("If.Else was empty — injected placeholder Sequence");
    return `<If.Else><Sequence DisplayName="TODO - If.Else"><ui:Comment DisplayName="TODO" Text="If.Else was empty — implement else branch" /></Sequence></If.Else>`;
  });

  patched = patched.replace(/<TryCatch\.Try>\s*<\/TryCatch\.Try>/g, () => {
    repairs.push("TryCatch.Try was empty — injected placeholder Sequence");
    return `<TryCatch.Try><Sequence DisplayName="TODO - TryCatch.Try"><ui:Comment DisplayName="TODO" Text="TryCatch.Try was empty — implement try body" /></Sequence></TryCatch.Try>`;
  });

  const ifThenMulti = /<If\.Then>([\s\S]*?)<\/If\.Then>/g;
  let ifMatch;
  while ((ifMatch = ifThenMulti.exec(patched)) !== null) {
    const inner = ifMatch[1].trim();
    const topLevelTags = inner.match(/<(?!\/)[A-Za-z][^>]*>/g) || [];
    const directChildren = topLevelTags.filter(t => !t.startsWith("</") && !t.endsWith("/>"));
    if (directChildren.length > 1 && !inner.startsWith("<Sequence")) {
      const wrapped = `<If.Then><Sequence DisplayName="Auto-wrapped Then">${inner}</Sequence></If.Then>`;
      patched = patched.replace(ifMatch[0], wrapped);
      repairs.push("If.Then had multiple children — auto-wrapped in Sequence");
    }
  }

  const tryCatchBlocks = /<TryCatch\s[^>]*>[\s\S]*?<\/TryCatch>/g;
  let tcBlockMatch;
  while ((tcBlockMatch = tryCatchBlocks.exec(patched)) !== null) {
    const block = tcBlockMatch[0];
    if (!block.includes("<TryCatch.Catches>")) {
      const fixed = block.replace(
        /<\/TryCatch>/,
        `<TryCatch.Catches><Catch x:TypeArguments="s:Exception"><ActivityAction x:TypeArguments="s:Exception"><ActivityAction.Argument><DelegateInArgument x:TypeArguments="s:Exception" Name="exception" /></ActivityAction.Argument><Sequence DisplayName="Catch Handler"><ui:LogMessage Level="Error" DisplayName="Log Exception" Message="[exception.Message]" /></Sequence></ActivityAction></Catch></TryCatch.Catches></TryCatch>`
      );
      patched = patched.replace(block, fixed);
      repairs.push("TryCatch was missing Catches — injected default Exception catch");
    }
  }

  const forEachBlocks = /<ForEach\s[^>]*>[\s\S]*?<\/ForEach>/g;
  let feBlockMatch;
  while ((feBlockMatch = forEachBlocks.exec(patched)) !== null) {
    const block = feBlockMatch[0];
    if (!block.includes("<ActivityAction")) {
      errors.push("ForEach is missing ActivityAction child element — cannot auto-repair (irrecoverable)");
    }
  }

  const statePattern = /<State\s[^>]*DisplayName="([^"]*)"[^>]*>/g;
  let stateMatch;
  while ((stateMatch = statePattern.exec(patched)) !== null) {
    const stateName = stateMatch[1];
    const stateStart = stateMatch.index;
    const stateEnd = patched.indexOf("</State>", stateStart);
    if (stateEnd === -1) continue;
    const stateSection = patched.substring(stateStart, stateEnd + 8);
    const isFinal = /IsFinal="True"/i.test(stateMatch[0]);
    if (!isFinal && !stateSection.includes("<State.Entry>")) {
      errors.push(`State "${stateName}" is missing State.Entry element — non-final states require entry activities`);
    }
  }

  const transitionPattern = /<Transition\s[^>]*(?:\/>|>)/g;
  let transMatch;
  while ((transMatch = transitionPattern.exec(patched)) !== null) {
    const isSelfClosing = transMatch[0].endsWith("/>");
    const transStart = transMatch.index;

    if (isSelfClosing) {
      const tag = transMatch[0];
      if (!tag.includes("To=")) {
        const stateNames = Array.from(patched.matchAll(/x:Name="([^"]+)"/g)).map(m => m[1]);
        if (stateNames.length > 0) {
          const displayNameMatch = tag.match(/DisplayName="([^"]*)"/);
          const dn = displayNameMatch ? displayNameMatch[1] : "Transition";
          const lastState = stateNames[stateNames.length - 1];
          const repairedTag = tag.replace(/\/>$/, ` To="{x:Reference ${lastState}}" />`);
          patched = patched.replace(tag, repairedTag);
          repairs.push(`Transition "${dn}" was missing To attribute — repaired with target "${lastState}"`);
        } else {
          errors.push("Transition is missing To attribute — every Transition must specify a target State");
        }
      }
      const hasConditionAttr = /Condition="[^"]*"/.test(tag);
      if (!hasConditionAttr) {
        const displayNameMatch = tag.match(/DisplayName="([^"]*)"/);
        const dn = displayNameMatch ? displayNameMatch[1] : "Transition";
        const toMatch = tag.match(/To="([^"]*)"/);
        const toRef = toMatch ? toMatch[1] : "";
        const expanded = `<Transition DisplayName="${dn}" To="${toRef}">\n        <Transition.Condition>[True]</Transition.Condition>\n      </Transition>`;
        patched = patched.replace(tag, expanded);
        repairs.push(`Self-closing Transition "${dn}" had no Condition — expanded with [True] condition`);
      }
      continue;
    }

    const transEnd = patched.indexOf("</Transition>", transStart);
    if (transEnd === -1) continue;
    const transSection = patched.substring(transStart, transEnd + 13);
    if (!transSection.includes("To=")) {
      const stateNames = Array.from(patched.matchAll(/x:Name="([^"]+)"/g)).map(m => m[1]);
      if (stateNames.length > 0) {
        const displayNameMatch = transSection.match(/DisplayName="([^"]*)"/);
        const dn = displayNameMatch ? displayNameMatch[1] : "Transition";
        const lastState = stateNames[stateNames.length - 1];
        const repairedOpening = transMatch[0].replace(/>$/, ` To="{x:Reference ${lastState}}">`);
        patched = patched.replace(transMatch[0], repairedOpening);
        repairs.push(`Transition "${dn}" was missing To attribute — repaired with target "${lastState}"`);
      } else {
        errors.push("Transition is missing To attribute — every Transition must specify a target State");
      }
    }
    const hasCondition = transSection.includes("<Transition.Condition>");
    const hasAction = transSection.includes("<Transition.Action>");
    if (!hasCondition && !hasAction) {
      const displayNameMatch = transSection.match(/DisplayName="([^"]*)"/);
      const dn = displayNameMatch ? displayNameMatch[1] : "Transition";
      repairs.push(`Transition "${dn}" has neither Condition nor Action — injecting [True] condition`);
      const conditionInsert = `<Transition.Condition>[True]</Transition.Condition>\n`;
      patched = patched.replace(transMatch[0], transMatch[0] + "\n        " + conditionInsert);
    }
    if (hasCondition) {
      const condInner = transSection.match(/<Transition\.Condition>([\s\S]*?)<\/Transition\.Condition>/);
      if (condInner && !condInner[1].trim()) {
        errors.push("Transition.Condition is empty — must contain exactly one condition expression");
      }
    }
    if (hasAction) {
      const actionInner = transSection.match(/<Transition\.Action>([\s\S]*?)<\/Transition\.Action>/);
      if (actionInner && !actionInner[1].trim()) {
        repairs.push("Transition.Action was empty — injected placeholder Sequence");
        const fixed = transSection.replace(
          /<Transition\.Action>\s*<\/Transition\.Action>/,
          `<Transition.Action><Sequence DisplayName="TODO - Transition Action"><ui:Comment DisplayName="TODO" Text="Transition action was empty — implement transition logic" /></Sequence></Transition.Action>`
        );
        patched = patched.replace(transSection, fixed);
      }
    }
  }

  const tryCatchFinallyMulti = /<TryCatch\.Finally>([\s\S]*?)<\/TryCatch\.Finally>/g;
  let finMatch;
  while ((finMatch = tryCatchFinallyMulti.exec(patched)) !== null) {
    const inner = finMatch[1].trim();
    if (inner) {
      const topTags = inner.match(/<(?!\/)[A-Za-z][^/>]*(?:\/>|>)/g) || [];
      const nonSelfClosing = topTags.filter(t => !t.endsWith("/>"));
      if (nonSelfClosing.length > 1 && !inner.startsWith("<Sequence")) {
        const wrapped = `<TryCatch.Finally><Sequence DisplayName="Auto-wrapped Finally">${inner}</Sequence></TryCatch.Finally>`;
        patched = patched.replace(finMatch[0], wrapped);
        repairs.push("TryCatch.Finally had multiple children — auto-wrapped in Sequence");
      }
    }
  }

  if (patched.includes("<ui:RetryScope.Body>")) {
    patched = patched.replace(/<ui:RetryScope\.Body>\s*/g, "").replace(/\s*<\/ui:RetryScope\.Body>/g, "");
    repairs.push("RetryScope had explicit .Body property element — unwrapped to use default content property");
  }

  const retryScopePattern = /<ui:RetryScope\s[^>]*>[\s\S]*?<\/ui:RetryScope>/g;
  let rsMatch;
  while ((rsMatch = retryScopePattern.exec(patched)) !== null) {
    const block = rsMatch[0];
    if (!block.includes("<ui:RetryScope.Condition>") && !block.includes("<ui:ShouldRetry")) {
      repairs.push("RetryScope is missing Condition — injecting default ShouldRetry");
      const conditionXml = `<ui:RetryScope.Condition><ui:ShouldRetry /></ui:RetryScope.Condition>`;
      const insertPoint = block.indexOf(">") + 1;
      const fixed = block.substring(0, insertPoint) + "\n    " + conditionXml + block.substring(insertPoint);
      patched = patched.replace(block, fixed);
    }
    if (!block.includes("<Sequence")) {
      repairs.push("RetryScope has no Sequence body — injecting placeholder");
      const closingTag = "</ui:RetryScope>";
      const fixed = block.replace(closingTag, `<Sequence DisplayName="TODO - RetryScope Body"><ui:Comment DisplayName="TODO" Text="RetryScope body was empty — implement retry logic" /></Sequence>\n    ${closingTag}`);
      patched = patched.replace(block, fixed);
    }
  }

  if (repairs.length > 0) {
    console.log(`[Container Validation] ${workflowName}: Repaired ${repairs.length} container structure issue(s)`);
  }
  if (errors.length > 0) {
    console.error(`[Container Validation] ${workflowName}: ${errors.length} irrecoverable container error(s)`);
  }

  return { repairedXaml: patched, repairs, errors };
}

function deduplicateAssemblyAttributes(xaml: string): string {
  let dedupCount = 0;
  const result = xaml.replace(/<([a-zA-Z_][\w.:]*)((?:\s+[\w.:]+\s*=\s*"[^"]*")+)\s*(\/?>)/g, (match, tagName, attrsBlock, closing) => {
    const attrPattern = /([\w.:]+)\s*=\s*"([^"]*)"/g;
    const seen = new Map<string, string>();
    const order: string[] = [];
    let hasDup = false;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrsBlock)) !== null) {
      const name = attrMatch[1];
      const value = attrMatch[2];
      if (seen.has(name)) {
        hasDup = true;
      } else {
        order.push(name);
      }
      if (!seen.has(name)) {
        seen.set(name, value);
      }
    }
    if (!hasDup) return match;
    dedupCount++;
    const rebuiltAttrs = order.map(n => `${n}="${seen.get(n)}"`).join(" ");
    return `<${tagName} ${rebuiltAttrs} ${closing}`.replace(/\s+(\/?>) *$/, ` $1`);
  });
  if (dedupCount > 0) {
    console.log(`[Tree Assembler] Deduplicated attributes in ${dedupCount} element(s) before well-formedness check`);
  }
  return result;
}

function sanitizeUnescapedAmpersands(xaml: string): string {
  let sanitized = xaml;
  let fixCount = 0;

  sanitized = sanitized.replace(/="([^"]*)"/g, (_match, attrVal: string) => {
    const fixed = attrVal.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
    if (fixed !== attrVal) fixCount++;
    return `="${fixed}"`;
  });

  sanitized = sanitized.replace(/>([^<]+)</g, (_match, textContent: string) => {
    const fixed = textContent.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
    if (fixed !== textContent) fixCount++;
    return `>${fixed}<`;
  });

  if (fixCount > 0) {
    console.warn(`[XML Sanitizer] Fixed ${fixCount} unescaped ampersand(s) in assembled XAML`);
  }

  return sanitized;
}

function sanitizeObjectLiteralArguments(xaml: string): string {
  return xaml.replace(
    /(<(?:In|Out|InOut)Argument\s+x:TypeArguments="x:Object"(?:\s+[^>]*)?>)([^<]+)(<\/(?:In|Out|InOut)Argument>)/g,
    (_match, openTag, content, closeTag) => {
      const trimmed = content.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        return `${openTag}${content}${closeTag}`;
      }
      if (trimmed.length > 0) {
        console.warn(`[Argument Guard] Bracket-wrapping literal content "${trimmed}" in x:Object argument`);
        return `${openTag}[${trimmed}]${closeTag}`;
      }
      return `${openTag}${content}${closeTag}`;
    }
  );
}

const HIGH_RISK_EXPRESSION_THRESHOLD = 3;

function countNestedCalls(expr: string): number {
  let depth = 0;
  let maxDepth = 0;
  for (const ch of expr) {
    if (ch === '(') { depth++; maxDepth = Math.max(maxDepth, depth); }
    else if (ch === ')') { depth--; }
  }
  return maxDepth;
}

function countChainedIndexers(expr: string): number {
  const matches = expr.match(/\)\s*\(/g);
  const indexerMatches = expr.match(/\([^)]*\)\s*\(/g);
  return (matches?.length || 0) + (indexerMatches?.length || 0);
}

function isHighRiskExpression(expr: string): boolean {
  if (countNestedCalls(expr) >= HIGH_RISK_EXPRESSION_THRESHOLD) return true;
  if (countChainedIndexers(expr) >= HIGH_RISK_EXPRESSION_THRESHOLD) return true;
  if (/CType\s*\(.*CType\s*\(/s.test(expr)) return true;
  if (/CStr\s*\(.*CStr\s*\(/s.test(expr)) return true;
  return false;
}

export function decomposeComplexExpression(
  expr: string,
  targetVariable: string,
  displayNamePrefix: string,
): { intermediateAssigns: string[]; finalExpression: string; intermediateVariables: VariableDeclaration[] } {
  if (!isHighRiskExpression(expr)) {
    return { intermediateAssigns: [], finalExpression: expr, intermediateVariables: [] };
  }

  const intermediateAssigns: string[] = [];
  const intermediateVariables: VariableDeclaration[] = [];
  let currentExpr = expr;
  let stepCount = 0;

  const innerPattern = /CType\s*\(([^,]+(?:\([^)]*\))*[^,]*),\s*([^)]+)\)/;
  while (countNestedCalls(currentExpr) >= HIGH_RISK_EXPRESSION_THRESHOLD && stepCount < 5) {
    const match = innerPattern.exec(currentExpr);
    if (!match) break;

    stepCount++;
    const innerExpr = match[1].trim();
    const targetType = match[2].trim();
    const intermediateVarName = `obj_Intermediate_${displayNamePrefix.replace(/\s+/g, "_")}_${stepCount}`;

    intermediateVariables.push({
      name: intermediateVarName,
      type: "x:Object",
    });

    intermediateAssigns.push(
      `<Assign DisplayName="Extract ${displayNamePrefix} Step ${stepCount}">\n` +
      `  <Assign.To><OutArgument x:TypeArguments="x:Object">[${intermediateVarName}]</OutArgument></Assign.To>\n` +
      `  <Assign.Value><InArgument x:TypeArguments="x:Object">[${escapeXmlExpression(innerExpr)}]</InArgument></Assign.Value>\n` +
      `</Assign>`
    );

    currentExpr = currentExpr.replace(match[0], `CType(${intermediateVarName}, ${targetType})`);
  }

  return { intermediateAssigns, finalExpression: currentExpr, intermediateVariables };
}
