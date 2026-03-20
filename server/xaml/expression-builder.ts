import { z } from "zod";
import { escapeXml } from "../lib/xml-utils";

function escapeXmlInner(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

  return `[${escapeXmlInner(parts.join(" & "))}]`;
}

function buildComparisonExpression(left: string, operator: string, right: string): string {
  const normalizedOp = OPERATOR_NORMALIZE[operator] || operator;
  if (isAllowedLeft(left) && isAllowedRight(right)) {
    return `[${escapeXmlInner(`${left.trim()} ${normalizedOp} ${right.trim()}`)}]`;
  }

  const rawExpression = `${left.trim()} ${normalizedOp} ${right.trim()}`;
  return `[${escapeXml(rawExpression)}]`;
}

const ALLOWED_OPERATOR_SET = new Set<string>(ALLOWED_OPERATORS);

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
    default:
      return false;
  }
}
