import { z } from "zod";
import { ValueIntentSchema, type ValueIntent } from "./xaml/expression-builder";

export const VariableDeclarationSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  default: z.string().optional(),
});

export type VariableDeclaration = z.infer<typeof VariableDeclarationSchema>;

const PrimitivePropertySchema = z.union([z.string(), z.number(), z.boolean()]).transform(v => String(v));

const PlainObjectFallbackSchema = z.record(z.any()).transform((val) => {
  if (val.type && typeof val.type === "string" && ["literal", "variable", "expression", "url_with_params", "vb_expression"].includes(val.type)) {
    const viResult = ValueIntentSchema.safeParse(val);
    if (viResult.success) return viResult.data;
  }
  return `OBJECT_SERIALIZED:${JSON.stringify(val)}`;
});

const PropertyValueSchema = z.union([
  ValueIntentSchema,
  PrimitivePropertySchema,
  PlainObjectFallbackSchema,
]);

export type PropertyValue = string | ValueIntent;

export const ActivityNodeSchema = z.object({
  kind: z.literal("activity"),
  template: z.string().min(1),
  displayName: z.string().min(1),
  properties: z.record(PropertyValueSchema).default({}),
  outputVar: z.string().nullable().optional(),
  outputType: z.string().nullable().optional(),
  errorHandling: z.enum(["retry", "catch", "escalate", "none"]).default("none"),
});

export type ActivityNode = z.infer<typeof ActivityNodeSchema>;

const BaseWorkflowNodeSchema = z.discriminatedUnion("kind", [
  ActivityNodeSchema,
  z.object({
    kind: z.literal("sequence"),
    displayName: z.string().min(1),
    children: z.lazy(() => WorkflowNodeSchema.array()).default([]),
    variables: z.array(VariableDeclarationSchema).optional(),
  }),
  z.object({
    kind: z.literal("tryCatch"),
    displayName: z.string().min(1),
    tryChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
    catchChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
    finallyChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
    catchVariableName: z.string().optional(),
  }),
  z.object({
    kind: z.literal("if"),
    displayName: z.string().min(1),
    condition: z.union([z.string().min(1), ValueIntentSchema]),
    thenChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
    elseChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
  }),
  z.object({
    kind: z.literal("while"),
    displayName: z.string().min(1),
    condition: z.union([z.string().min(1), ValueIntentSchema]),
    bodyChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
  }),
  z.object({
    kind: z.literal("forEach"),
    displayName: z.string().min(1),
    itemType: z.string().default("x:Object"),
    valuesExpression: z.string().min(1),
    iteratorName: z.string().default("item"),
    bodyChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
  }),
  z.object({
    kind: z.literal("retryScope"),
    displayName: z.string().min(1),
    numberOfRetries: z.number().int().positive().default(3),
    retryInterval: z.string().default("00:00:05"),
    bodyChildren: z.lazy(() => WorkflowNodeSchema.array()).default([]),
  }),
]);

export const WorkflowNodeSchema: z.ZodType<WorkflowNode> = z.lazy(() => BaseWorkflowNodeSchema);

export type SequenceNode = {
  kind: "sequence";
  displayName: string;
  children: WorkflowNode[];
  variables?: VariableDeclaration[];
};

export type TryCatchNode = {
  kind: "tryCatch";
  displayName: string;
  tryChildren: WorkflowNode[];
  catchChildren: WorkflowNode[];
  finallyChildren: WorkflowNode[];
  catchVariableName?: string;
};

export type IfNode = {
  kind: "if";
  displayName: string;
  condition: string | ValueIntent;
  thenChildren: WorkflowNode[];
  elseChildren: WorkflowNode[];
};

export type WhileNode = {
  kind: "while";
  displayName: string;
  condition: string | ValueIntent;
  bodyChildren: WorkflowNode[];
};

export type ForEachNode = {
  kind: "forEach";
  displayName: string;
  itemType: string;
  valuesExpression: string;
  iteratorName: string;
  bodyChildren: WorkflowNode[];
};

export type RetryScopeNode = {
  kind: "retryScope";
  displayName: string;
  numberOfRetries: number;
  retryInterval: string;
  bodyChildren: WorkflowNode[];
};

export type WorkflowNode =
  | ActivityNode
  | SequenceNode
  | TryCatchNode
  | IfNode
  | WhileNode
  | ForEachNode
  | RetryScopeNode;

export const WorkflowSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  variables: z.array(VariableDeclarationSchema).default([]),
  arguments: z.array(z.object({
    name: z.string().min(1),
    direction: z.enum(["InArgument", "OutArgument", "InOutArgument"]),
    type: z.string().min(1),
    required: z.boolean().optional(),
  })).default([]),
  rootSequence: z.object({
    kind: z.literal("sequence"),
    displayName: z.string().min(1),
    children: z.array(WorkflowNodeSchema).default([]),
    variables: z.array(VariableDeclarationSchema).optional(),
  }),
  useReFramework: z.boolean().default(false),
  reframeworkConfig: z.object({
    queueName: z.string(),
    maxRetries: z.number().int().nonnegative(),
    processName: z.string(),
  }).optional(),
  dhgNotes: z.array(z.string()).default([]),
  decomposition: z.array(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    nodeIds: z.array(z.number()).default([]),
    isDispatcher: z.boolean().optional(),
    isPerformer: z.boolean().optional(),
  })).default([]),
});

export type WorkflowSpec = z.infer<typeof WorkflowSpecSchema>;

export function validateWorkflowSpec(data: unknown): { success: true; data: WorkflowSpec } | { success: false; errors: string[] } {
  const result = WorkflowSpecSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors = result.error.issues.map(issue => {
    const path = issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
  return { success: false, errors };
}

/**
 * Task #556 Wave 1 — Typed contract violation raised when a stage boundary
 * receives or produces data that does not satisfy the schema for that
 * boundary. Carries the boundary name so the run ledger can report which
 * stage failed without having to re-derive it from the stack.
 */
export class SpecContractViolation extends Error {
  readonly boundary: string;
  readonly errors: string[];
  readonly workflowName?: string;
  constructor(boundary: string, errors: string[], workflowName?: string) {
    const summary = errors.slice(0, 5).join("; ");
    super(`SpecContractViolation at ${boundary}${workflowName ? ` (${workflowName})` : ""}: ${summary}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ""}`);
    this.name = "SpecContractViolation";
    this.boundary = boundary;
    this.errors = errors;
    this.workflowName = workflowName;
  }
}

/**
 * Boundary-enforcing parse. Throws SpecContractViolation when the data does
 * not satisfy WorkflowSpecSchema. Use at the four named stage boundaries:
 *   - decomposer output (per-workflow tree mapping)
 *   - refiner input
 *   - refiner output
 *   - assembler input (when a WorkflowSpec is consumed downstream)
 */
export function enforceWorkflowSpecContract(data: unknown, boundary: string, workflowName?: string): WorkflowSpec {
  const result = WorkflowSpecSchema.safeParse(data);
  if (result.success) return result.data;
  const errors = result.error.issues.map(issue => `${issue.path.join(".") || "<root>"}: ${issue.message}`);
  throw new SpecContractViolation(boundary, errors, workflowName);
}
