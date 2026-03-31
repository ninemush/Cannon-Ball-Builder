import { z } from "zod";


const VARIABLE_NAME_ONLY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

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

export function buildExpression(intent: ValueIntent): string {
  switch (intent.type) {
    case "literal": {
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

    case "vb_expression":
      return `[${intent.value}]`;
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

export function normalizeStringToExpression(val: string, isDeclared?: (name: string) => boolean, clrType?: string): string {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return trimmed;
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
  if (/^[a-zA-Z_]\w*\(/.test(trimmed)) return `[${trimmed}]`;
  if (/^(str_|int_|bool_|dbl_|dec_|obj_|dt_|ts_|drow_|qi_|sec_)/i.test(trimmed)) return `[${trimmed}]`;
  if (/^(in_|out_|io_)/i.test(trimmed)) return `[${trimmed}]`;
  if (/^[a-zA-Z_]\w*\.[a-zA-Z_]\w*/.test(trimmed) && !/[.,!?;:'"…\s]/.test(trimmed)) return `[${trimmed}]`;
  if ((/[A-Z]\w*\/[A-Z]\w*/.test(trimmed) || /\w+\/\w+\/\w+/.test(trimmed)) && !/[()=<>]/.test(trimmed)) {
    const escaped = trimmed.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  if (/[+\-*/&=<>]/.test(trimmed) && !/[.,!?;:'"…\s]/.test(trimmed)) return `[${trimmed}]`;

  const isStringTyped = clrType === "System.String" || clrType === "String";

  if (isStringTyped && /\s/.test(trimmed) && !looksLikeVbCodePattern(trimmed)) {
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
