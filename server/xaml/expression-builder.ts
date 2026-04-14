import { z } from "zod";
import { convertMixedLiteralBracketToConcat } from "./xaml-compliance";

export interface JsonValueIntentDiagnostic {
  originalRaw: string;
  parsedIntentType: string;
  normalizedOutput: string;
  fallbackUsed: boolean;
}

let _jsonValueIntentDiagnostics: JsonValueIntentDiagnostic[] = [];

export function getAndClearJsonValueIntentDiagnostics(): JsonValueIntentDiagnostic[] {
  const diagnostics = _jsonValueIntentDiagnostics;
  _jsonValueIntentDiagnostics = [];
  return diagnostics;
}

export function getJsonValueIntentDiagnostics(): ReadonlyArray<JsonValueIntentDiagnostic> {
  return _jsonValueIntentDiagnostics;
}

export function tryParseJsonValueIntent(s: string): { intent: ValueIntent; fallbackUsed: boolean } | null {
  let trimmed = s.trim();

  if (trimmed.startsWith('[{') && trimmed.endsWith('}]')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && typeof parsed[0].type === "string") {
        if (parsed.length > 1) {
          const compoundResult = tryLowerCompoundIntent(parsed);
          if (compoundResult) {
            return { intent: compoundResult, fallbackUsed: true };
          }
        }
      }
    } catch {
    }
    trimmed = trimmed.slice(1, -1).trim();
  }

  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    const decoded = trimmed
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
    if (decoded !== trimmed && decoded.trim().startsWith('{') && decoded.trim().endsWith('}')) {
      return tryParseJsonValueIntent(decoded);
    }
    return null;
  }
  if (!/"type"/.test(trimmed) && !/&quot;type&quot;/.test(trimmed)) return null;

  const literalOrVbMatch = trimmed.match(
    /^\{\s*"type"\s*:\s*"(literal|vb_expression)"\s*,\s*"value"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}$/
  );
  if (literalOrVbMatch) {
    const type = literalOrVbMatch[1] as "literal" | "vb_expression";
    const value = literalOrVbMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    return { intent: { type, value } as ValueIntent, fallbackUsed: false };
  }

  const variableMatch = trimmed.match(
    /^\{\s*"type"\s*:\s*"variable"\s*,\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}$/
  );
  if (variableMatch) {
    const name = variableMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    return { intent: { type: "variable", name } as ValueIntent, fallbackUsed: false };
  }

  const reversedValueMatch = trimmed.match(
    /^\{\s*"value"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"type"\s*:\s*"(literal|vb_expression)"\s*\}$/
  );
  if (reversedValueMatch) {
    const type = reversedValueMatch[2] as "literal" | "vb_expression";
    const value = reversedValueMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    return { intent: { type, value } as ValueIntent, fallbackUsed: false };
  }

  const reversedNameMatch = trimmed.match(
    /^\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"type"\s*:\s*"variable"\s*\}$/
  );
  if (reversedNameMatch) {
    const name = reversedNameMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    return { intent: { type: "variable", name } as ValueIntent, fallbackUsed: false };
  }

  const decodedEntities = trimmed
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  if (decodedEntities !== trimmed && decodedEntities.startsWith('{')) {
    const result = tryParseJsonValueIntent(decodedEntities);
    if (result) return result;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "object" && parsed !== null && typeof parsed.type === "string") {
      if ((parsed.type === "literal" || parsed.type === "vb_expression") && typeof parsed.value === "string") {
        return { intent: { type: parsed.type, value: parsed.value } as ValueIntent, fallbackUsed: true };
      }
      if (parsed.type === "variable" && typeof parsed.name === "string") {
        return { intent: { type: "variable", name: parsed.name } as ValueIntent, fallbackUsed: true };
      }
      if (parsed.type === "expression" && typeof parsed.left === "string" && typeof parsed.operator === "string" && typeof parsed.right === "string") {
        return { intent: { type: "expression", left: parsed.left, operator: parsed.operator, right: parsed.right } as ValueIntent, fallbackUsed: true };
      }
      if (parsed.type === "url_with_params" && typeof parsed.baseUrl === "string") {
        return { intent: { type: "url_with_params", baseUrl: parsed.baseUrl, params: parsed.params || {} } as ValueIntent, fallbackUsed: true };
      }
      if (parsed.type === "compound" && Array.isArray(parsed.parts)) {
        const compoundResult = tryLowerCompoundIntent(parsed.parts);
        if (compoundResult) {
          return { intent: compoundResult, fallbackUsed: true };
        }
      }
      if ((parsed.type === "literal" || parsed.type === "vb_expression") && typeof parsed.value === "object" && parsed.value !== null) {
        const nestedStr = JSON.stringify(parsed.value);
        return { intent: { type: "literal", value: nestedStr } as ValueIntent, fallbackUsed: true };
      }
    }
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && typeof parsed[0].type === "string") {
      const compoundResult = tryLowerCompoundIntent(parsed);
      if (compoundResult) {
        return { intent: compoundResult, fallbackUsed: true };
      }
    }
  } catch {
  }

  return null;
}

export function emitJsonResolutionDiagnostic(originalRaw: string, intent: ValueIntent, normalizedOutput: string, fallbackUsed: boolean): void {
  const diagnostic: JsonValueIntentDiagnostic = {
    originalRaw,
    parsedIntentType: intent.type,
    normalizedOutput,
    fallbackUsed,
  };
  _jsonValueIntentDiagnostics.push(diagnostic);
  console.log(`[Expression Builder] JSON ValueIntent resolved: type=${intent.type}, fallback=${fallbackUsed}, raw=${originalRaw.substring(0, 120)}, output=${normalizedOutput.substring(0, 120)}`);
}

const VARIABLE_NAME_ONLY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const PLACEHOLDER_SENTINEL_PREFIX = "PLACEHOLDER_";

const PROMPT_PROPERTY_NAMES = new Set([
  "Prompt", "SystemPrompt", "UserPrompt", "AssistantPrompt",
  "prompt", "systemPrompt", "userPrompt", "assistantPrompt",
]);

const TIMEZONE_PATTERN = /^[A-Z][a-zA-Z]+\/[A-Z][a-zA-Z_]+$/;
const FILE_PATH_PATTERN = /^[A-Za-z]:\\|^\\\\|^\/[a-zA-Z]|^\.\//;
const CONFIG_VALUE_PATTERN = /^[a-zA-Z0-9_.:-]+\.[a-zA-Z]{2,}$|^[a-zA-Z]+[_-][a-zA-Z]+$/;

const BLOCKED_SENTINEL_PREFIX = "__BLOCKED_";

export function isPlaceholderSentinel(value: string): boolean {
  return value.startsWith(PLACEHOLDER_SENTINEL_PREFIX) || value.startsWith(BLOCKED_SENTINEL_PREFIX);
}

const SIMPLE_LITERAL = /^(".*"|'.*'|\d+(\.\d+)?|True|False|Nothing|null)$/;

function isVariableName(val: string): boolean {
  return VARIABLE_NAME_ONLY.test(val.trim());
}

function isSimpleLiteral(val: string): boolean {
  return SIMPLE_LITERAL.test(val.trim());
}

function isAllowedLeft(val: string): boolean {
  return isVariableName(val);
}

function isAllowedRight(val: string): boolean {
  return isVariableName(val) || isSimpleLiteral(val);
}

const ALLOWED_OPERATORS = ["=", "<>", "!=", "<", ">", "<=", ">=", "And", "Or", "AndAlso", "OrElse", "Like", "Is", "IsNot"] as const;

const OPERATOR_NORMALIZE: Record<string, string> = {
  "!=": "<>",
};

export const ValueIntentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("literal"),
    value: z.string(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal("variable"),
    name: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal("url_with_params"),
    baseUrl: z.string().min(1),
    params: z.record(z.string()).default({}),
    confidence: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal("expression"),
    left: z.string().min(1),
    operator: z.enum(ALLOWED_OPERATORS),
    right: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
  }),
  z.object({
    type: z.literal("vb_expression"),
    value: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
  }),
]);

export type ValueIntent = z.infer<typeof ValueIntentSchema>;

export function buildExpression(intent: ValueIntent, options?: { clrType?: string; propertyName?: string }): string {
  const clrType = options?.clrType;
  const propertyName = options?.propertyName;
  const isStringTyped = clrType === "System.String" || clrType === "String";
  const isPromptProperty = propertyName ? PROMPT_PROPERTY_NAMES.has(propertyName) : false;

  switch (intent.type) {
    case "literal": {
      if (isPlaceholderSentinel(intent.value)) {
        throw new Error(`PLACEHOLDER sentinel "${intent.value}" cannot be emitted — resolve to a valid default or emit a blocking diagnostic`);
      }
      const isBoolType = clrType === "System.Boolean" || clrType === "Boolean";
      if (isBoolType && /^(true|false)$/i.test(intent.value)) {
        return intent.value.charAt(0).toUpperCase() + intent.value.slice(1).toLowerCase();
      }
      const escaped = intent.value.replace(/"/g, '""');
      if (/[&<>"']/.test(intent.value)) {
        return `["${escaped}"]`;
      }
      return `"${escaped}"`;
    }

    case "variable":
      return `[${intent.name}]`;

    case "url_with_params":
      return buildUrlExpression(intent.baseUrl, intent.params);

    case "expression":
      return buildComparisonExpression(intent.left, intent.operator, intent.right);

    case "vb_expression": {
      if (!intent.value || intent.value === "vb_expression" || intent.value.trim() === "") {
        return `["TODO: Implement expression"]`;
      }
      if (isPlaceholderSentinel(intent.value)) {
        throw new Error(`PLACEHOLDER sentinel "${intent.value}" cannot be emitted — resolve to a valid default or emit a blocking diagnostic`);
      }
      if (isPromptProperty) {
        const escaped = intent.value.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      if (isStringTyped && !looksLikeVbCodePattern(intent.value) && !VARIABLE_NAME_ONLY.test(intent.value)) {
        const escaped = intent.value.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      return `[${intent.value}]`;
    }
  }
}

export function buildUrlExpression(baseUrl: string, params: Record<string, string>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) {
    return `"${baseUrl}"`;
  }

  const parts: string[] = [`"${baseUrl}?"`];

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    const prefix = i === 0 ? "" : `"&"`;
    const paramKey = `"${key}="`;

    if (isVariableName(value.trim())) {
      if (prefix) {
        parts.push(`${prefix} & ${paramKey} & ${value.trim()}`);
      } else {
        parts.push(`${paramKey} & ${value.trim()}`);
      }
    } else {
      if (prefix) {
        parts.push(`${prefix} & ${paramKey} & "${value.replace(/"/g, '""')}"`);
      } else {
        parts.push(`${paramKey} & "${value.replace(/"/g, '""')}"`);
      }
    }
  }

  return `[${parts.join(" & ")}]`;
}

function buildComparisonExpression(left: string, operator: string, right: string): string {
  const normalizedOp = OPERATOR_NORMALIZE[operator] || operator;
  if (isAllowedLeft(left) && isAllowedRight(right)) {
    return `[${left.trim()} ${normalizedOp} ${right.trim()}]`;
  }

  const rawExpression = `${left.trim()} ${normalizedOp} ${right.trim()}`;
  return `[${rawExpression}]`;
}

const ALLOWED_OPERATOR_SET = new Set<string>(ALLOWED_OPERATORS);

export function normalizeStringToExpression(val: string, isDeclared?: (name: string) => boolean, clrType?: string, propertyName?: string): string {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;

  if (isPlaceholderSentinel(trimmed)) {
    console.warn(`[Expression Builder] PLACEHOLDER sentinel "${trimmed}" blocked from emission for property "${propertyName || "unknown"}"`);
    return `""`;
  }

  const jsonResult = tryParseJsonValueIntent(trimmed);
  if (jsonResult) {
    const resolved = buildExpression(jsonResult.intent);
    emitJsonResolutionDiagnostic(trimmed, jsonResult.intent, resolved, jsonResult.fallbackUsed);
    return resolved;
  }

  const isPromptProp = propertyName ? PROMPT_PROPERTY_NAMES.has(propertyName) : false;
  if (isPromptProp && !trimmed.startsWith("[") && !/^".*"$/.test(trimmed)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;

  const mixedConcat = convertMixedLiteralBracketToConcat(trimmed);
  if (mixedConcat) return mixedConcat;

  if (/^".*"$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1);
    if (/^New\s+\w/.test(inner)) {
      return `[${inner}]`;
    }
    return trimmed;
  }
  if (/^'.*'$/.test(trimmed)) return trimmed;
  if (/^&quot;.*&quot;$/.test(trimmed)) return trimmed;
  if (/:\/\//.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") return trimmed;
  if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) return trimmed;

  if (/^New\s+\w/.test(trimmed)) return `[${trimmed}]`;
  if (/^TimeSpan\.\w+/i.test(trimmed)) return `[${trimmed}]`;
  if (/^[a-zA-Z_]\w*\(/.test(trimmed)) return `[${trimmed}]`;
  if (/^(str_|int_|bool_|dbl_|dec_|obj_|dt_|ts_|drow_|qi_|sec_)/i.test(trimmed)) return `[${trimmed}]`;
  if (/^(in_|out_|io_)/i.test(trimmed)) return `[${trimmed}]`;
  if (/^[a-zA-Z_]\w*\.[a-zA-Z_]\w*/.test(trimmed) && !/[.,!?;:'"…\s]/.test(trimmed)) return `[${trimmed}]`;
  if ((/[A-Z]\w*\/[A-Z]\w*/.test(trimmed) || /\w+\/\w+\/\w+/.test(trimmed)) && !/[()=<>]/.test(trimmed)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  if (TIMEZONE_PATTERN.test(trimmed) || FILE_PATH_PATTERN.test(trimmed)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  if (/[+\-*/&=<>]/.test(trimmed) && !/[.,!?;:'"…\s]/.test(trimmed)) return `[${trimmed}]`;

  const isStringTyped = clrType === "System.String" || clrType === "String";

  if (isStringTyped && /\s/.test(trimmed) && !looksLikeVbCodePattern(trimmed)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  if (isStringTyped && CONFIG_VALUE_PATTERN.test(trimmed) && !looksLikeVbCodePattern(trimmed)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  if (/^[a-zA-Z_]\w*$/.test(trimmed)) {
    if (isStringTyped && isDeclared && !isDeclared(trimmed)) {
      const escaped = trimmed.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    return `[${trimmed}]`;
  }

  const escaped = trimmed.replace(/"/g, '""');
  return `"${escaped}"`;
}

function looksLikeVbCodePattern(value: string): boolean {
  if (/String\.Format\s*\(/.test(value)) return true;
  if (/CType\s*\(/.test(value)) return true;
  if (/CStr\s*\(/.test(value)) return true;
  if (/CInt\s*\(/.test(value)) return true;
  if (/DirectCast\s*\(/.test(value)) return true;
  if (/TryCast\s*\(/.test(value)) return true;
  if (/\.ToString\s*\(/.test(value)) return true;
  if (/\.Contains\s*\(/.test(value)) return true;
  if (/\.Replace\s*\(/.test(value)) return true;
  if (/"\s*&\s*/.test(value)) return true;
  if (/\s*&\s*"/.test(value)) return true;
  if (/^New\s+\w/.test(value)) return true;
  if (/\bIf\s*\(/.test(value)) return true;
  return false;
}

export function normalizePropertyToValueIntent(
  value: string,
  activityClassName?: string,
  propertyName?: string,
  getEnumValues?: (className: string, propName: string) => string[] | null,
  isDeclared?: (name: string) => boolean,
  clrType?: string,
): ValueIntent {
  const trimmed = value.trim();
  if (!trimmed) {
    return { type: "literal", value: "" };
  }

  if (isPlaceholderSentinel(trimmed)) {
    return { type: "literal", value: trimmed };
  }

  const jsonResult = tryParseJsonValueIntent(trimmed);
  if (jsonResult) {
    const resolved = buildExpression(jsonResult.intent);
    emitJsonResolutionDiagnostic(trimmed, jsonResult.intent, resolved, jsonResult.fallbackUsed);
    return jsonResult.intent;
  }

  const isPromptProp = propertyName ? PROMPT_PROPERTY_NAMES.has(propertyName) : false;
  if (isPromptProp) {
    const unquoted = trimmed.replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");
    return { type: "literal", value: unquoted };
  }

  const isStringTyped = clrType === "System.String" || clrType === "String";
  const isBooleanTyped = clrType === "System.Boolean" || clrType === "Boolean";

  if (isBooleanTyped) {
    const lower = trimmed.toLowerCase().replace(/^"+|"+$/g, "").replace(/^'+|'+$/g, "");
    if (lower === "true" || lower === "yes") return { type: "literal", value: "True" };
    if (lower === "false" || lower === "no") return { type: "literal", value: "False" };
  }

  if (activityClassName && propertyName && getEnumValues) {
    const validValues = getEnumValues(activityClassName, propertyName);
    if (validValues && validValues.length > 0) {
      if (validValues.includes(trimmed)) {
        return { type: "literal", value: trimmed };
      }
      const lowerMap = new Map(validValues.map(v => [v.toLowerCase(), v]));
      const matched = lowerMap.get(trimmed.toLowerCase());
      if (matched) {
        return { type: "literal", value: matched };
      }
    }
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const inner = trimmed.slice(1, -1).trim();
    if (VARIABLE_NAME_ONLY.test(inner)) {
      return { type: "variable", name: inner };
    }
    return { type: "literal", value: trimmed };
  }

  if (/^".*"$/.test(trimmed)) {
    const inner = trimmed.slice(1, -1).replace(/""/g, '"');
    return { type: "literal", value: inner };
  }

  if (trimmed === "True" || trimmed === "False" || trimmed === "Nothing" || trimmed === "null") {
    return { type: "literal", value: trimmed };
  }

  if (/^[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
    return { type: "literal", value: trimmed };
  }

  if (/:\/\//.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
    return { type: "literal", value: trimmed };
  }

  if ((/[A-Z]\w*\/[A-Z]\w*/.test(trimmed) || /\w+\/\w+\/\w+/.test(trimmed)) && !/[()=<>]/.test(trimmed)) {
    return { type: "literal", value: trimmed };
  }

  if (/^(str_|int_|bool_|dbl_|dec_|obj_|dt_|ts_|drow_|qi_|sec_|in_|out_|io_|arr_|dict_|list_)/i.test(trimmed) && VARIABLE_NAME_ONLY.test(trimmed)) {
    return { type: "variable", name: trimmed };
  }

  if (/^[a-zA-Z_]\w*\.[a-zA-Z_]\w*/.test(trimmed) && !/\s/.test(trimmed)) {
    if (/\.(json|xml|xlsx|csv|txt|log|config|pdf|html|xaml|dll|exe|zip|png|jpg|yaml|yml)$/i.test(trimmed)) {
      return { type: "literal", value: trimmed };
    }
    return { type: "variable", name: trimmed };
  }

  if (/^[a-zA-Z_]\w*\(/.test(trimmed)) {
    return { type: "literal", value: `[${trimmed}]` };
  }

  if (/[+\-*/&=<>]/.test(trimmed) && !/[.,!?;:'"…]/.test(trimmed)) {
    return { type: "literal", value: `[${trimmed}]` };
  }

  if (isStringTyped && /\s/.test(trimmed) && !looksLikeVbCodePattern(trimmed)) {
    return { type: "literal", value: trimmed };
  }

  if (isDeclared && VARIABLE_NAME_ONLY.test(trimmed) && isDeclared(trimmed)) {
    return { type: "variable", name: trimmed };
  }

  if (isStringTyped && VARIABLE_NAME_ONLY.test(trimmed) && !(isDeclared && isDeclared(trimmed))) {
    return { type: "literal", value: trimmed };
  }

  return { type: "literal", value: trimmed };
}

function tryLowerCompoundIntent(parts: unknown[]): ValueIntent | null {
  const resolvedParts: string[] = [];
  for (const part of parts) {
    if (typeof part !== "object" || part === null) return null;
    const obj = part as Record<string, unknown>;
    if (typeof obj.type !== "string") return null;
    const partResult = tryParseJsonValueIntent(JSON.stringify(part));
    if (!partResult) return null;
    try {
      const built = buildExpression(partResult.intent);
      resolvedParts.push(built);
    } catch {
      return null;
    }
  }
  if (resolvedParts.length === 0) return null;
  if (resolvedParts.length === 1) {
    const single = resolvedParts[0];
    if (single.startsWith("[") && single.endsWith("]")) {
      return { type: "vb_expression", value: single.slice(1, -1) };
    }
    if (single.startsWith('"') && single.endsWith('"')) {
      return { type: "literal", value: single.slice(1, -1).replace(/""/g, '"') };
    }
    return { type: "literal", value: single };
  }
  const concatExpr = resolvedParts.map(p => {
    if (p.startsWith("[") && p.endsWith("]")) return p.slice(1, -1);
    if (p.startsWith('"') && p.endsWith('"')) return p;
    return `"${p.replace(/"/g, '""')}"`;
  }).join(" & ");
  return { type: "vb_expression", value: concatExpr };
}

export interface ExpressionLoweringDiagnostic {
  originalValue: string;
  loweredValue: string | null;
  lowered: boolean;
  evidenceSources: string[];
  blockReason?: string;
}

let _expressionLoweringDiagnostics: ExpressionLoweringDiagnostic[] = [];

export function getAndClearExpressionLoweringDiagnostics(): ExpressionLoweringDiagnostic[] {
  const diags = _expressionLoweringDiagnostics;
  _expressionLoweringDiagnostics = [];
  return diags;
}

export function recordExpressionLoweringDiagnostic(diag: ExpressionLoweringDiagnostic): void {
  _expressionLoweringDiagnostics.push(diag);
}

export function isValueIntent(value: unknown): value is ValueIntent {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  switch (obj.type) {
    case "literal":
      return typeof obj.value === "string";
    case "variable":
      return typeof obj.name === "string" && obj.name !== "";
    case "url_with_params":
      return typeof obj.baseUrl === "string" && obj.baseUrl !== "";
    case "expression":
      return typeof obj.left === "string" && obj.left !== ""
        && typeof obj.operator === "string" && ALLOWED_OPERATOR_SET.has(obj.operator)
        && typeof obj.right === "string" && obj.right !== "";
    case "vb_expression":
      return typeof obj.value === "string" && obj.value !== "";
    default:
      return false;
  }
}

function isEmptyOrInvalidOperand(val: unknown): boolean {
  if (val == null) return true;
  if (typeof val !== "string") return true;
  return val.trim() === "";
}

const VB_CONCAT_PATTERN = /(?:")\s*&\s*(?:[a-zA-Z_]\w*|\()|(?:[a-zA-Z_]\w*|\))\s*&\s*(?:")/;

const VB_CODE_IN_LITERAL_PATTERNS = [
  VB_CONCAT_PATTERN,
  /String\.Format\s*\(/,
  /Integer\.Parse\s*\(/,
  /Boolean\.Parse\s*\(/,
  /Double\.Parse\s*\(/,
  /Decimal\.Parse\s*\(/,
  /CStr\s*\(/,
  /CInt\s*\(/,
  /CDbl\s*\(/,
  /CBool\s*\(/,
  /CType\s*\(/,
  /DirectCast\s*\(/,
  /TryCast\s*\(/,
  /New\s+Dictionary\s*\(/,
  /New\s+List\s*\(/,
  /New\s+With\b/,
  /\.ToString\s*\(/,
  /\.Contains\s*\(/,
  /\.Replace\s*\(/,
  /\.Trim\s*\(/,
  /\.Substring\s*\(/,
  /\.Split\s*\(/,
  /\.Length\b/,
  /\.Count\b/,
];

function looksLikeVbCode(value: string): boolean {
  if (/^\[.*\]$/.test(value)) return false;
  if (/^"[^"]*"$/.test(value)) return false;

  for (const pattern of VB_CODE_IN_LITERAL_PATTERNS) {
    if (pattern.test(value)) return true;
  }
  return false;
}

export const VALUE_INTENT_JSON_PATTERN = /\{"(?:type|value|name)"[^}]*"(?:type|value|name)"[^}]*\}/g;

export function containsValueIntentJson(s: string): boolean {
  if (typeof s !== "string") return false;
  const trimmed = s.trim();
  if (trimmed.startsWith('{') && /"type"\s*:/.test(trimmed)) return true;
  if (trimmed.startsWith('[{') && /"type"\s*:/.test(trimmed)) return true;
  if (/\{(?:&quot;|")(?:type|value|name)(?:&quot;|")/.test(s)) return true;
  return false;
}

export function resolveValueIntentJsonString(s: string, options?: { clrType?: string; propertyName?: string }): string {
  if (typeof s !== "string") return s;
  const trimmed = s.trim();

  const jsonResult = tryParseJsonValueIntent(trimmed);
  if (jsonResult) {
    const resolved = buildExpression(jsonResult.intent, options);
    emitJsonResolutionDiagnostic(trimmed, jsonResult.intent, resolved, jsonResult.fallbackUsed);
    return resolved;
  }

  return s;
}

export function sweepAttributeValueForJsonIntents(s: string): string {
  if (typeof s !== "string") return s;
  if (!containsValueIntentJson(s)) return s;

  const result = resolveValueIntentJsonString(s);
  if (result !== s) return result;

  return s;
}

export function sanitizeValueIntentExpressions(obj: any): void {
  if (!obj || typeof obj !== "object") return;

  if (Array.isArray(obj)) {
    for (const item of obj) sanitizeValueIntentExpressions(item);
    return;
  }

  if (obj.type === "expression") {
    if (isEmptyOrInvalidOperand(obj.left)) {
      obj.left = "Nothing";
    }
    if (isEmptyOrInvalidOperand(obj.right)) {
      obj.right = "Nothing";
    }

    if (typeof obj.left === "string" && typeof obj.right === "string"
        && obj.left === obj.right && obj.operator === "="
        && looksLikeVbCode(obj.left)) {
      obj.type = "vb_expression";
      obj.value = obj.left;
      delete obj.left;
      delete obj.right;
      delete obj.operator;
    }
  }

  if (obj.type === "literal" && typeof obj.value === "string" && looksLikeVbCode(obj.value)) {
    obj.type = "vb_expression";
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object" && obj[key] !== null) {
      sanitizeValueIntentExpressions(obj[key]);
    }
  }
}
