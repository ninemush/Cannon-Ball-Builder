import type { WorkflowSpec, WorkflowNode, VariableDeclaration, ActivityNode, PropertyValue } from "./workflow-spec-types";
import type { UiPathPackageSpec } from "./types/uipath-package";
import type { ProcessType } from "./catalog/catalog-service";
import type { TreeEnrichmentResult } from "./ai-xaml-enricher";
import { isValueIntent } from "./xaml/expression-builder";
import { normalizeWorkflowName } from "./workflow-name-utils";

type FlatWorkflow = UiPathPackageSpec["workflows"][number];
type FlatStep = FlatWorkflow["steps"][number];
type FlatVariable = FlatWorkflow["variables"][number];

function stripActivityPrefix(activityType: string): string {
  return activityType.replace(/^[a-zA-Z][a-zA-Z0-9]*:/, "");
}

function mapVariable(v: FlatVariable): VariableDeclaration {
  return {
    name: v.name,
    type: v.type || "String",
    default: v.defaultValue || undefined,
  };
}

function tryResolveObjectToScalar(val: unknown): { resolved: true; value: PropertyValue } | { resolved: false } {
  if (typeof val !== "object" || val === null) return { resolved: false };
  const obj = val as Record<string, unknown>;

  if (typeof obj.type === "string") {
    if ((obj.type === "literal" || obj.type === "vb_expression") && typeof obj.value === "string") {
      return { resolved: true, value: obj.value };
    }
    if (obj.type === "variable" && typeof obj.name === "string" && obj.name !== "") {
      return { resolved: true, value: obj.name };
    }
    if (obj.type === "url_with_params" && typeof obj.baseUrl === "string") {
      return { resolved: true, value: obj.baseUrl };
    }
    if (obj.type === "expression" && typeof obj.left === "string" && typeof obj.operator === "string" && typeof obj.right === "string") {
      return { resolved: true, value: `${obj.left} ${obj.operator} ${obj.right}` };
    }
  }

  return { resolved: false };
}

function mapProperties(props: Record<string, unknown>): Record<string, PropertyValue> {
  const result: Record<string, PropertyValue> = {};
  for (const [key, val] of Object.entries(props)) {
    if (val === null || val === undefined) continue;
    if (isValueIntent(val)) {
      result[key] = val;
    } else if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      if (typeof obj.type === "string" && ["literal", "variable", "vb_expression", "expression", "url_with_params"].includes(obj.type)) {
        const scalarResolution = tryResolveObjectToScalar(val);
        if (scalarResolution.resolved) {
          result[key] = scalarResolution.value;
        } else {
          console.warn(`[mapProperties] Blocking malformed ValueIntent-shaped object for property "${key}" — cannot safely resolve to scalar: ${JSON.stringify(val).substring(0, 120)}`);
        }
      } else {
        result[key] = JSON.stringify(val);
      }
    } else {
      result[key] = String(val);
    }
  }
  return result;
}

function propertyToString(val: PropertyValue): string {
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null) {
    if ("type" in val) {
      if (val.type === "literal") return val.value;
      if (val.type === "variable") return val.name;
      if (val.type === "expression") return `${val.left} ${val.operator} ${val.right}`;
      if (val.type === "url_with_params") return val.baseUrl;
    }
    return JSON.stringify(val);
  }
  return typeof val === "number" || typeof val === "boolean" ? String(val) : `ERROR_UNSERIALIZABLE_PROPERTY`;
}

function isControlFlowActivity(activityType: string): boolean {
  const bare = stripActivityPrefix(activityType);
  return ["If", "Switch", "ForEach", "While", "DoWhile", "TryCatch", "RetryScope"].includes(bare);
}

function mapStepToNode(step: FlatStep): WorkflowNode {
  const bare = stripActivityPrefix(step.activityType || "Comment");
  const props = mapProperties(step.properties || {});
  const displayName = step.activity || bare;

  if (bare === "If") {
    const condition = props.Condition ? propertyToString(props.Condition) : props.condition ? propertyToString(props.condition) : "True";
    delete props.Condition;
    delete props.condition;
    return {
      kind: "if",
      displayName,
      condition,
      thenChildren: [],
      elseChildren: [],
    };
  }

  if (bare === "ForEach") {
    const values = props.Values ? propertyToString(props.Values) : props.values ? propertyToString(props.values) : props.Collection ? propertyToString(props.Collection) : "{}";
    delete props.Values;
    delete props.values;
    delete props.Collection;
    const itemType = props.TypeArgument ? propertyToString(props.TypeArgument) : props.typeArgument ? propertyToString(props.typeArgument) : "x:Object";
    delete props.TypeArgument;
    delete props.typeArgument;
    return {
      kind: "forEach",
      displayName,
      itemType,
      valuesExpression: values,
      iteratorName: props.IteratorName ? propertyToString(props.IteratorName) : "item",
      bodyChildren: [],
    };
  }

  if (bare === "While" || bare === "DoWhile") {
    const condition = props.Condition ? propertyToString(props.Condition) : props.condition ? propertyToString(props.condition) : "True";
    delete props.Condition;
    delete props.condition;
    return {
      kind: "while",
      displayName,
      condition,
      bodyChildren: [],
    };
  }

  if (bare === "TryCatch") {
    return {
      kind: "tryCatch",
      displayName,
      tryChildren: [],
      catchChildren: [],
      finallyChildren: [],
    };
  }

  if (bare === "RetryScope") {
    const retriesStr = props.NumberOfRetries ? propertyToString(props.NumberOfRetries) : props.numberOfRetries ? propertyToString(props.numberOfRetries) : "3";
    const retries = parseInt(retriesStr, 10);
    const interval = props.RetryInterval ? propertyToString(props.RetryInterval) : props.retryInterval ? propertyToString(props.retryInterval) : "00:00:05";
    delete props.NumberOfRetries;
    delete props.numberOfRetries;
    delete props.RetryInterval;
    delete props.retryInterval;
    return {
      kind: "retryScope",
      displayName,
      numberOfRetries: isNaN(retries) ? 3 : retries,
      retryInterval: interval,
      bodyChildren: [],
    };
  }

  const activityNode: ActivityNode = {
    kind: "activity",
    template: bare,
    displayName,
    properties: props,
    errorHandling: (step.errorHandling as "retry" | "catch" | "escalate" | "none") || "none",
  };

  if (step.selectorHint) {
    activityNode.properties.Selector = step.selectorHint;
  }

  return activityNode;
}

function wrapWithErrorHandling(node: WorkflowNode, errorHandling: string): WorkflowNode {
  if (node.kind !== "activity") return node;

  if (errorHandling === "retry") {
    return {
      kind: "retryScope",
      displayName: `Retry ${node.displayName}`,
      numberOfRetries: 3,
      retryInterval: "00:00:05",
      bodyChildren: [node],
    };
  }

  if (errorHandling === "catch") {
    return {
      kind: "tryCatch",
      displayName: `Try ${node.displayName}`,
      tryChildren: [node],
      catchChildren: [
        {
          kind: "activity",
          template: "LogMessage",
          displayName: `Log Error - ${node.displayName}`,
          properties: {
            Level: "Error",
            Message: `"Error in ${node.displayName}: " & exception.Message`,
          },
          errorHandling: "none",
        },
      ],
      finallyChildren: [],
    };
  }

  return node;
}

export function mapWorkflowToSpec(workflow: FlatWorkflow): WorkflowSpec {
  const variables: VariableDeclaration[] = (workflow.variables || []).map(mapVariable);

  const children: WorkflowNode[] = [];
  for (const step of workflow.steps || []) {
    let node = mapStepToNode(step);

    if (node.kind === "activity" && step.errorHandling && step.errorHandling !== "none") {
      node = wrapWithErrorHandling(node, step.errorHandling);
    }

    children.push(node);
  }

  return {
    name: workflow.name || "Workflow",
    description: workflow.description || "",
    variables,
    arguments: (workflow.arguments || []).map(a => {
      const dirMap: Record<string, "InArgument" | "OutArgument" | "InOutArgument"> = {
        in: "InArgument",
        out: "OutArgument",
        in_out: "InOutArgument",
        InArgument: "InArgument",
        OutArgument: "OutArgument",
        InOutArgument: "InOutArgument",
      };
      return {
        name: a.name,
        direction: dirMap[a.direction] || "InArgument",
        type: a.type,
      };
    }),
    rootSequence: {
      kind: "sequence",
      displayName: workflow.name || "Workflow",
      children,
    },
    useReFramework: false,
    dhgNotes: [],
    decomposition: [],
  };
}

export function mapPackageSpecToTreeEnrichments(
  pkg: UiPathPackageSpec,
): Map<string, { spec: WorkflowSpec; processType: ProcessType }> {
  const result = new Map<string, { spec: WorkflowSpec; processType: ProcessType }>();

  for (const workflow of pkg.workflows || []) {
    if (!workflow.steps || workflow.steps.length === 0) continue;

    const spec = mapWorkflowToSpec(workflow);
    const normalizedName = normalizeWorkflowName(workflow.name);
    result.set(normalizedName, { spec, processType: "general" });
  }

  return result;
}

export function convertDecomposedSpecToTreeEnrichment(
  workflow: FlatWorkflow,
  processType: ProcessType = "general",
): TreeEnrichmentResult | null {
  if (!workflow.steps || workflow.steps.length === 0) return null;

  const spec = mapWorkflowToSpec(workflow);
  return {
    status: "success",
    workflowSpec: spec,
    processType,
  };
}
