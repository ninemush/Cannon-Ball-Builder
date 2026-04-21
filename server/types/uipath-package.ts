import { z } from "zod";
import type { EnrichmentResult } from "../ai-xaml-enricher";
import { ValueIntentSchema, containsValueIntentJson, tryParseJsonValueIntent, buildExpression } from "../xaml/expression-builder";

const VALID_ERROR_HANDLING = new Set(["retry", "catch", "escalate", "none"]);

const RECOGNIZED_TYPED_PROPERTY_TYPES = new Set(["literal", "variable", "url_with_params", "expression", "vb_expression"]);

function isIncompleteTypedPropertyObject(obj: Record<string, unknown>): boolean {
  if (!RECOGNIZED_TYPED_PROPERTY_TYPES.has(obj.type as string)) return false;
  switch (obj.type) {
    case "literal":
    case "vb_expression":
      return obj.value === undefined || obj.value === null || typeof obj.value !== "string";
    case "variable":
      return obj.name === undefined || obj.name === null || typeof obj.name !== "string" || obj.name === "";
    case "url_with_params":
      return obj.baseUrl === undefined || obj.baseUrl === null || typeof obj.baseUrl !== "string" || obj.baseUrl === "";
    case "expression":
      return obj.left === undefined || obj.right === undefined || typeof obj.left !== "string" || typeof obj.right !== "string" || obj.left === "" || obj.right === "";
    default:
      return false;
  }
}

function resolveNestedJsonField(obj: Record<string, unknown>, field: string): boolean {
  const fieldVal = obj[field];
  if (typeof fieldVal !== "string" || !containsValueIntentJson(fieldVal)) return true;

  const MAX_DEPTH = 5;
  let current = fieldVal;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (!containsValueIntentJson(current)) break;
    const parsed = tryParseJsonValueIntent(current);
    if (!parsed) {
      console.warn(`[PropertyValueInput] Nested JSON detected in field "${field}" but unparseable — blocking`);
      return false;
    }
    try {
      current = buildExpression(parsed.intent);
    } catch (e) {
      console.warn(`[PropertyValueInput] Failed to resolve nested JSON in field "${field}": ${(e as Error).message} — blocking`);
      return false;
    }
  }
  if (containsValueIntentJson(current)) {
    console.warn(`[PropertyValueInput] Nested JSON in field "${field}" still present after max depth — blocking`);
    return false;
  }
  if (current !== fieldVal) {
    obj[field] = current;
    console.log(`[PropertyValueInput] Resolved nested JSON in typed property field "${field}": ${fieldVal.substring(0, 80)} → ${current.substring(0, 80)}`);
  }
  return true;
}

function resolveNestedJsonInTypedPropertyObject(obj: Record<string, unknown>): boolean {
  switch (obj.type) {
    case "literal":
    case "vb_expression":
      return resolveNestedJsonField(obj, "value");
    case "variable":
      return resolveNestedJsonField(obj, "name");
    case "url_with_params":
      return resolveNestedJsonField(obj, "baseUrl");
    default:
      return true;
  }
}

export const BLOCKED_PROPERTY_SENTINEL = "__BLOCKED_TYPED_PROPERTY__";

export function isBlockedSentinel(value: string): boolean {
  return value === BLOCKED_PROPERTY_SENTINEL || value.startsWith("__BLOCKED_");
}

export function isBlockedPropertyValue(val: unknown): boolean {
  if (typeof val === "object" && val !== null) {
    const obj = val as Record<string, unknown>;
    return obj.type === "literal" && obj.value === BLOCKED_PROPERTY_SENTINEL;
  }
  if (typeof val === "string") return isBlockedSentinel(val);
  return false;
}

const PropertyValueInputSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return { type: "literal", value: "" };
    if (typeof val === "number" || typeof val === "boolean") return { type: "literal", value: String(val) };
    if (typeof val === "string") return { type: "literal", value: val };
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (RECOGNIZED_TYPED_PROPERTY_TYPES.has(obj.type as string)) {
        if (isIncompleteTypedPropertyObject(obj)) {
          console.warn(`[PropertyValueInput] Incomplete typed property object (type="${obj.type}") — blocked (marked with sentinel)`);
          return { type: "literal", value: BLOCKED_PROPERTY_SENTINEL };
        }
        if (!resolveNestedJsonInTypedPropertyObject(obj)) {
          console.warn(`[PropertyValueInput] Typed property object (type="${obj.type}") contains unresolvable nested JSON — blocked (marked with sentinel)`);
          return { type: "literal", value: BLOCKED_PROPERTY_SENTINEL };
        }
        return val;
      }
      console.warn(`[PropertyValueInput] Unrecognized object shape — blocked (marked with sentinel): ${JSON.stringify(val).substring(0, 120)}`);
      return { type: "literal", value: BLOCKED_PROPERTY_SENTINEL };
    }
    return { type: "literal", value: String(val) };
  },
  ValueIntentSchema,
);

export const uipathPackageSchema = z.object({
  projectName: z.string().default("UiPathPackage"),
  description: z.string().default(""),
  dependencies: z.array(z.string()).default([]),
  entryWorkflow: z.string().optional(),
  workflows: z.array(z.object({
    name: z.string().default("Main"),
    description: z.string().default(""),
    variables: z.array(z.object({
      name: z.string().default("variable"),
      type: z.string().default("String"),
      defaultValue: z.preprocess(v => v == null ? "" : String(v), z.string().default("")),
      scope: z.string().optional().default("workflow"),
    })).optional().default([]),
    arguments: z.array(z.object({
      name: z.string(),
      direction: z.enum(["in", "out", "in_out", "InArgument", "OutArgument", "InOutArgument"]),
      type: z.string(),
    })).optional().default([]),
    steps: z.array(z.object({
      activity: z.string().default("Activity"),
      activityType: z.string().optional().default("ui:Comment"),
      activityPackage: z.string().optional().default("UiPath.System.Activities"),
      properties: z.record(PropertyValueInputSchema).default({}),
      selectorHint: z.preprocess(
        v => typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        z.string().nullable().optional().default(null)
      ),
      errorHandling: z.preprocess(
        v => {
          const normalized = typeof v === "string" ? v.trim().toLowerCase() : "";
          return VALID_ERROR_HANDLING.has(normalized) ? normalized : "none";
        },
        z.enum(["retry", "catch", "escalate", "none"]).optional().default("none")
      ),
      notes: z.preprocess(v => v == null ? "" : String(v), z.string().default("")),
    })).default([]),
  })).default([]),
});

export type UiPathPackageSpec = z.infer<typeof uipathPackageSchema>;

export interface ScaffoldInvocation {
  target: string;
  argumentBindings: Record<string, string>;
}

export interface SpecScaffoldMeta {
  entryWorkflow: string;
  workflowContracts: Array<{
    name: string;
    invokes: ScaffoldInvocation[];
    sharedArguments: Array<{ name: string; direction: "in" | "out" | "in_out"; type: string }>;
  }>;
}

export interface UiPathPackageInternal {
  sddContent?: string;
  automationType?: "rpa" | "agent" | "hybrid";
  processNodes?: any[];
  processEdges?: any[];
  orchestratorArtifacts?: any;
  enrichment?: EnrichmentResult | null;
  useReFramework?: boolean;
  painPoints?: Array<{ name: string; description: string }>;
  extractedArtifacts?: any;
  deploymentResults?: any;
  aiCenterSkills?: any[];
  targetFramework?: "Windows" | "Portable";
  isServerless?: boolean;
  autopilotEnabled?: boolean;
  forceRebuild?: boolean;
  complexityTier?: string;
  priorCompliantWorkflows?: Array<{ name: string; content: string }>;
  integrationServiceConnectors?: Array<{ connectorName: string; connectionName?: string; connectionId?: string }>;
  specScaffoldMeta?: SpecScaffoldMeta;
  emergencyFallbackActive?: boolean;
  emergencyFallbackReason?: string;
}

export interface AgentSpec {
  description?: string;
  tools?: Array<string | { name: string; description?: string; parameters?: Record<string, unknown> }>;
  guardrails?: string[];
  escalationRules?: Array<string | { condition: string; target: string }>;
  knowledgeBases?: Array<string | { name: string }>;
  temperature?: number;
  maxIterations?: number;
}

export type UiPathPackage = UiPathPackageSpec & {
  internal: UiPathPackageInternal;
  agents?: AgentSpec[];
  knowledgeBases?: Array<string | { name: string }>;
};

export interface XamlGenerationContext {
  generationMode: "baseline_openable" | "full_implementation";
  automationPattern: string;
  aiCenterSkills: Array<{ name: string; status: string; inputType?: string; outputType?: string; mlPackageName?: string; [key: string]: any }>;
  referencedMLSkillNames: string[];
}
