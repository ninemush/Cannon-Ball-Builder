import { z } from "zod";
import type { EnrichmentResult } from "../ai-xaml-enricher";
import { ValueIntentSchema } from "../xaml/expression-builder";

const VALID_ERROR_HANDLING = new Set(["retry", "catch", "escalate", "none"]);

const PropertyValueInputSchema = z.preprocess(
  (val) => {
    if (val === null || val === undefined) return { type: "literal", value: "" };
    if (typeof val === "number" || typeof val === "boolean") return { type: "literal", value: String(val) };
    if (typeof val === "string") return { type: "literal", value: val };
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (obj.type === "literal" || obj.type === "variable" || obj.type === "url_with_params" || obj.type === "expression" || obj.type === "vb_expression") {
        return val;
      }
      return { type: "literal", value: JSON.stringify(val) };
    }
    return { type: "literal", value: String(val) };
  },
  ValueIntentSchema,
);

export const uipathPackageSchema = z.object({
  projectName: z.string().default("UiPathPackage"),
  description: z.string().default(""),
  dependencies: z.array(z.string()).default([]),
  workflows: z.array(z.object({
    name: z.string().default("Main"),
    description: z.string().default(""),
    variables: z.array(z.object({
      name: z.string().default("variable"),
      type: z.string().default("String"),
      defaultValue: z.preprocess(v => v == null ? "" : String(v), z.string().default("")),
      scope: z.string().optional().default("workflow"),
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
