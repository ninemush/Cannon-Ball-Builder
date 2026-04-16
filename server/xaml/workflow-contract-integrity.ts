import { extractDeclaredVariables, findUndeclaredVariables } from "./vbnet-expression-linter";
import { emitInvokeContractTrace } from "../pipeline-trace-collector";
import { isCanonicalPlaceholder, lookupPipelineFallbackProvenance } from "../lib/placeholder-sanitizer";

export type ContractDefectType =
  | "unknown_target_argument"
  | "missing_required_target_argument"
  | "invoke_argument_binding_mismatch"
  | "decomposed_workflow_missing_contract"
  | "undeclared_variable_reference"
  | "undeclared_argument_reference"
  | "invalid_expression_scope"
  | "mixed_literal_expression_syntax"
  | "placeholder_sentinel_in_property"
  | "pseudo_property_on_invoke" // @deprecated — use invalid_invoke_serialization; retained for backward compatibility
  | "conflicting_argument_serialization"
  | "invalid_argument_map_serialization"
  | "invalid_invoke_serialization";

export type ContractDefectSeverity = "execution_blocking" | "handoff_required";

export interface ContractIntegrityDefect {
  file: string;
  workflow: string;
  defectType: ContractDefectType;
  activityType: string;
  propertyName: string;
  referencedSymbol: string;
  targetWorkflow: string;
  targetArgument: string;
  offendingValue: string;
  severity: ContractDefectSeverity;
  detectionMethod: string;
  notes: string;
  /**
   * Task #527 RC5: origin provenance for defect classification.
   *
   * - "pipeline-fallback": the offending value is a canonical safe placeholder
   *   from the pipeline's own fallback/handoff vocabulary (TODO - ..., TODO_...,
   *   PLACEHOLDER_...). These do NOT count toward structurally_invalid verdicts.
   * - "genuine": the defect reflects a real integrity failure (malformed XML,
   *   undeclared symbol, bad contract binding, etc.). Counts toward the
   *   structurally_invalid threshold.
   *
   * When absent, treated as "genuine" for backward compatibility.
   */
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export type NormalizationType =
  | "canonicalize_invoke_binding"
  | "remove_duplicate_conflicting_serialization"
  | "normalize_quoting_wrapping";

const NORMALIZATION_ALLOWLIST = new Set<NormalizationType>([
  "canonicalize_invoke_binding",
  "remove_duplicate_conflicting_serialization",
  "normalize_quoting_wrapping",
]);

export interface ContractNormalizationAction {
  beforeValue: string;
  afterValue: string;
  normalizationType: NormalizationType;
  file: string;
  workflow: string;
  property: string;
  rationale: string;
}

export type ExclusionCategory =
  | "designer_metadata"
  | "view_state"
  | "layout_hint"
  | "idref_reference"
  | "annotation"
  | "non_runtime_serialization";

export interface ContractExtractionExclusion {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  exclusionCategory: ExclusionCategory;
  exclusionReason: string;
}

export interface ContractIntegritySummaryMetrics {
  totalContractDefects: number;
  totalNormalizationActions: number;
  totalExecutionBlocking: number;
  totalHandoffRequired: number;
  totalUnknownTargetArguments: number;
  totalInvalidInvokeSerialization: number;
  totalUndeclaredSymbols: number;
  totalExcludedNonContractFields: number;
  exclusionsByCategory: Record<ExclusionCategory, number>;
}

export interface ContractIntegrityResult {
  contractIntegrityDefects: ContractIntegrityDefect[];
  hasContractIntegrityIssues: boolean;
  contractIntegritySummary?: string;
  contractIntegritySummaryMetrics?: ContractIntegritySummaryMetrics;
  contractNormalizationActions: ContractNormalizationAction[];
  contractExtractionExclusions: ContractExtractionExclusion[];
}

export interface WorkflowContract {
  file: string;
  workflowName: string;
  declaredArguments: Map<string, { direction: string; type: string }>;
  declaredVariables: Set<string>;
}

export interface InvocationBinding {
  file: string;
  workflow: string;
  activityType: string;
  targetWorkflow: string;
  bindings: Map<string, string>;
  rawElement: string;
}

const PLACEHOLDER_PATTERN = /\bPLACEHOLDER\b|\bPLACEHOLDER_\w+/i;
const TODO_PATTERN = /\bTODO\b/i;
const HANDOFF_PATTERN = /\bHANDOFF_\w+/;
const STUB_PATTERN = /\bSTUB_\w+/;
const SENTINEL_PATTERNS = [PLACEHOLDER_PATTERN, TODO_PATTERN, HANDOFF_PATTERN, STUB_PATTERN];

const PSEUDO_PROPERTY_NAMES = new Set([
  "Then", "Else", "Body", "Cases", "Finally", "Try", "Catches",
]);

function deriveWorkflowName(fileName: string): string {
  const base = fileName.split("/").pop() || fileName;
  return base.replace(/\.xaml$/i, "");
}

function normalizeFilePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^[./]+/, "");
}

function extractArguments(content: string): Map<string, { direction: string; type: string }> {
  const args = new Map<string, { direction: string; type: string }>();

  const propertyPattern = /<x:Property\s+Name="([^"]+)"\s+Type="([^"]+)"/g;
  let m;
  while ((m = propertyPattern.exec(content)) !== null) {
    const name = m[1];
    const typeAttr = m[2];
    let direction = "InArgument";
    if (/OutArgument/.test(typeAttr)) direction = "OutArgument";
    else if (/InOutArgument/.test(typeAttr)) direction = "InOutArgument";
    const typeMatch = typeAttr.match(/\(([^)]+)\)/);
    const type = typeMatch ? typeMatch[1] : "x:Object";
    args.set(name, { direction, type });
  }

  const memberPattern = /<x:Member\s+Name="([^"]+)"\s+Type="([^"]+)"/g;
  while ((m = memberPattern.exec(content)) !== null) {
    const name = m[1];
    const typeAttr = m[2];
    if (args.has(name)) continue;
    let direction = "InArgument";
    if (/OutArgument/.test(typeAttr)) direction = "OutArgument";
    else if (/InOutArgument/.test(typeAttr)) direction = "InOutArgument";
    const typeMatch = typeAttr.match(/\(([^)]+)\)/);
    const type = typeMatch ? typeMatch[1] : "x:Object";
    args.set(name, { direction, type });
  }

  return args;
}

const INVOKE_ACTIVITY_TYPES = [
  "InvokeWorkflowFile",
  "InvokeWorkflow",
  "InvokeWorkflowInteractive",
];

const WORKFLOW_FILENAME_ATTRS = [
  "WorkflowFileName",
  "WorkflowFilePath",
  "FileName",
];

const INVOKE_SYSTEM_ATTRS = new Set([
  "workflowfilename", "workflowfilepath", "filename",
  "displayname", "continueonerror", "timeout", "timeoutms", "isolated",
  "targetfolder", "logmessage", "inuielement",
]);

const NON_CONTRACT_EXCLUSION_PATTERNS: Array<{ pattern: RegExp; category: ExclusionCategory; reason: string }> = [
  { pattern: /^sap2010:WorkflowViewState\./i, category: "view_state", reason: "WF designer view-state property" },
  { pattern: /^sap:WorkflowViewStateService\./i, category: "view_state", reason: "WF designer view-state service property" },
  { pattern: /^WorkflowViewState\./i, category: "view_state", reason: "WF designer view-state property" },
  { pattern: /^sap:VirtualizedContainerService\./i, category: "layout_hint", reason: "Designer virtualization layout hint" },
  { pattern: /^VirtualizedContainerService\./i, category: "layout_hint", reason: "Designer virtualization layout hint" },
  { pattern: /\.IdRef$/i, category: "idref_reference", reason: "Designer IdRef tracking reference" },
  { pattern: /^Annotation\./i, category: "annotation", reason: "Designer annotation-only field" },
  { pattern: /^sap2010:Annotation\./i, category: "annotation", reason: "Designer annotation field" },
  { pattern: /^mc:/, category: "non_runtime_serialization", reason: "Markup compatibility attribute" },
  { pattern: /^mva:VisualBasic\.Settings$/i, category: "non_runtime_serialization", reason: "VB settings serialization artifact" },
  { pattern: /^TextExpression\./i, category: "non_runtime_serialization", reason: "Text expression namespace/reference metadata" },
];

const NON_CONTRACT_EXACT_NAMES = new Map<string, { category: ExclusionCategory; reason: string }>([
  ["HintSize", { category: "layout_hint", reason: "Designer layout sizing hint" }],
  ["WorkflowViewState.IdRef", { category: "idref_reference", reason: "Designer IdRef tracking reference" }],
]);

function classifyNonContractProperty(attrName: string): { category: ExclusionCategory; reason: string } | null {
  const exactMatch = NON_CONTRACT_EXACT_NAMES.get(attrName);
  if (exactMatch) return exactMatch;

  for (const { pattern, category, reason } of NON_CONTRACT_EXCLUSION_PATTERNS) {
    if (pattern.test(attrName)) return { category, reason };
  }

  if (/^sap\d*:/.test(attrName)) return { category: "designer_metadata", reason: "SAP designer namespace property" };

  return null;
}

function extractInvocationsForActivityType(
  content: string,
  fileName: string,
  workflowName: string,
  activityType: string,
  exclusions: ContractExtractionExclusion[],
  defects: ContractIntegrityDefect[],
): InvocationBinding[] {
  const invocations: InvocationBinding[] = [];

  const invokePattern = new RegExp(
    `<(?:\\w+:)?${activityType}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:\\w+:)?${activityType}>)`,
    "g"
  );
  let m;
  while ((m = invokePattern.exec(content)) !== null) {
    const attrs = m[1];
    const body = m[2] || "";
    const rawElement = m[0];

    let targetFile: string | null = null;
    for (const fileAttr of WORKFLOW_FILENAME_ATTRS) {
      const fileMatch = attrs.match(new RegExp(`${fileAttr}="([^"]+)"`));
      if (fileMatch) {
        targetFile = fileMatch[1].replace(/[\[\]"]/g, "").replace(/&quot;/g, "").trim();
        break;
      }
    }
    if (!targetFile) continue;

    const targetWorkflow = deriveWorkflowName(targetFile);

    const bindings = new Map<string, string>();

    const argBlockPattern = new RegExp(
      `<(?:\\w+:)?${activityType}\\.Arguments>([\\s\\S]*?)<\\/(?:\\w+:)?${activityType}\\.Arguments>`
    );
    const argBlock = body.match(argBlockPattern);
    if (argBlock) {
      const argBindingPattern = /<(?:In|Out|InOut)Argument\b[^>]*\bx:Key="([^"]+)"[^>]*>([^<]*)<\/(?:In|Out|InOut)Argument>/g;
      let am;
      while ((am = argBindingPattern.exec(argBlock[1])) !== null) {
        bindings.set(am[1], am[2].trim());
      }

      const selfClosingArgPattern = /<(?:In|Out|InOut)Argument\b[^>]*\bx:Key="([^"]+)"[^>]*\/>/g;
      while ((am = selfClosingArgPattern.exec(argBlock[1])) !== null) {
        bindings.set(am[1], "");
      }
    }

    const attrArgPattern = /\b([a-zA-Z_][\w.:]*)\s*=\s*"([^"]*)"/g;
    let attrM;
    while ((attrM = attrArgPattern.exec(attrs)) !== null) {
      const attrName = attrM[1];
      if (INVOKE_SYSTEM_ATTRS.has(attrName.toLowerCase())) continue;
      if (attrName.startsWith("xmlns") || attrName.startsWith("x:")) continue;

      const nonContractClassification = classifyNonContractProperty(attrName);
      if (nonContractClassification) {
        exclusions.push({
          file: fileName,
          workflow: workflowName,
          activityType,
          propertyName: attrName,
          exclusionCategory: nonContractClassification.category,
          exclusionReason: nonContractClassification.reason,
        });
        continue;
      }

      if (PSEUDO_PROPERTY_NAMES.has(attrName)) {
        defects.push({
          file: fileName,
          workflow: workflowName,
          defectType: "invalid_invoke_serialization",
          activityType,
          propertyName: attrName,
          referencedSymbol: "",
          targetWorkflow: targetWorkflow,
          targetArgument: "",
          offendingValue: attrM[2].substring(0, 200),
          severity: "execution_blocking",
          detectionMethod: "invoke_attr_classification",
          notes: `Pseudo-property "${attrName}" on ${activityType} is not a valid contract carrier — structural element serialized as attribute`,
        });
        continue;
      }

      if (!bindings.has(attrName)) {
        bindings.set(attrName, attrM[2]);
      }
    }

    invocations.push({
      file: fileName,
      workflow: workflowName,
      activityType,
      targetWorkflow,
      bindings,
      rawElement,
    });
  }

  return invocations;
}

export function extractInvocations(
  content: string,
  fileName: string,
  workflowName: string,
  exclusions: ContractExtractionExclusion[],
  defects: ContractIntegrityDefect[],
): InvocationBinding[] {
  const invocations: InvocationBinding[] = [];
  for (const activityType of INVOKE_ACTIVITY_TYPES) {
    invocations.push(...extractInvocationsForActivityType(content, fileName, workflowName, activityType, exclusions, defects));
  }
  return invocations;
}

function extractExpressionBearingProperties(content: string): Array<{
  activityType: string;
  propertyName: string;
  value: string;
}> {
  const results: Array<{ activityType: string; propertyName: string; value: string }> = [];

  const commentPattern = /<!--[\s\S]*?-->/g;
  const cleaned = content.replace(commentPattern, "");

  const viewStatePattern = /<sap:WorkflowViewStateService\.ViewState[\s\S]*?<\/sap:WorkflowViewStateService\.ViewState>/gi;
  const withoutViewState = cleaned.replace(viewStatePattern, "");
  const viewStatePattern2 = /<sap2010:WorkflowViewState[\s\S]*?<\/sap2010:WorkflowViewState>/gi;
  const finalContent = withoutViewState.replace(viewStatePattern2, "");

  const tagPattern = /<(\w+(?::\w+)?)\s([^>]*?)(?:\/>|>)/g;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(finalContent)) !== null) {
    const activityType = tagMatch[1];
    if (activityType.startsWith("x:") || activityType.startsWith("mc:") || activityType === "Variable") continue;

    const attrs = tagMatch[2];
    const attrPattern = /(\w+(?:\.\w+)?)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      const propName = attrMatch[1];
      const propValue = attrMatch[2];
      if (propName === "DisplayName" || propName.startsWith("xmlns") || propName.startsWith("x:")) continue;
      if (propName.startsWith("sap") || propName.startsWith("mc:")) continue;

      if (propValue.trim().length > 0) {
        results.push({ activityType, propertyName: propName, value: propValue });
      }
    }
  }

  const elementBodyPattern = /<(\w+(?:\.\w+)?)>(\[[^\]<>]+\])<\/\1>/g;
  let bodyMatch;
  while ((bodyMatch = elementBodyPattern.exec(finalContent)) !== null) {
    const propName = bodyMatch[1];
    const propValue = bodyMatch[2];
    if (propName.startsWith("x:") || propName.startsWith("mc:") || propName.startsWith("sap")) continue;
    if (propName === "Variable" || propName === "DisplayName") continue;

    const parentTag = finalContent.substring(Math.max(0, bodyMatch.index - 200), bodyMatch.index);
    const parentMatch = parentTag.match(/<(\w+(?::\w+)?)\b[^>]*?$/);
    const parentActivity = parentMatch ? parentMatch[1] : "Unknown";

    results.push({ activityType: parentActivity, propertyName: propName, value: propValue });
  }

  const wrappedExprPattern = /<((?:In|Out|InOut)Argument)\b[^>]*>(\[[^\]<>]+\])<\/\1>/g;
  while ((bodyMatch = wrappedExprPattern.exec(finalContent)) !== null) {
    const propValue = bodyMatch[2];
    const parentTag = finalContent.substring(Math.max(0, bodyMatch.index - 200), bodyMatch.index);
    const parentMatch = parentTag.match(/<(\w+(?::\w+)?)\b[^>]*?$/);
    const parentActivity = parentMatch ? parentMatch[1] : "Unknown";
    const propNameMatch = parentTag.match(/\.(\w+)>\s*$/);
    const propName = propNameMatch ? propNameMatch[1] : bodyMatch[1];

    results.push({ activityType: parentActivity, propertyName: propName, value: propValue });
  }

  return results;
}

function detectMixedLiteralExpression(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 3) return false;

  if (/^"[^"]*"$/.test(trimmed)) return false;
  if (/^\[[^\]]*\]$/.test(trimmed)) return false;
  if (/^(True|False|Nothing|\d+(\.\d+)?)$/.test(trimmed)) return false;
  if (/^[a-zA-Z_]\w*$/.test(trimmed)) return false;

  if (/\[[a-zA-Z_]\w*\]/.test(trimmed) && /[a-zA-Z]/.test(trimmed.replace(/\[[^\]]*\]/g, ""))) {
    if (!/\s*&\s*/.test(trimmed)) {
      return true;
    }
  }

  if (/^[a-zA-Z_]\w*\s+"[^"]*"/.test(trimmed) || /"[^"]*"\s+[a-zA-Z_]\w*$/.test(trimmed)) {
    if (!/\s*&\s*/.test(trimmed) && !/\s*\+\s*/.test(trimmed)) {
      return true;
    }
  }

  if (/\{[^}]*"type"\s*:/.test(trimmed) && /\{[^}]*"value"\s*:/.test(trimmed)) {
    return true;
  }

  return false;
}

function detectSentinelInProperty(value: string): string | null {
  const strippedValue = value.replace(/&quot;[^&]*&quot;/g, "").replace(/\[&quot;[^[]*&quot;\]/g, "");
  for (const pattern of SENTINEL_PATTERNS) {
    if (pattern.test(strippedValue)) {
      const match = strippedValue.match(pattern);
      return match ? match[0] : null;
    }
  }
  return null;
}

export function buildWorkflowContracts(
  entries: { name: string; content: string }[]
): Map<string, WorkflowContract> {
  const contracts = new Map<string, WorkflowContract>();

  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);
    const declaredArgs = extractArguments(entry.content);
    const declaredVars = extractDeclaredVariables(entry.content);

    contracts.set(workflowName.toLowerCase(), {
      file: normalizedName,
      workflowName,
      declaredArguments: declaredArgs,
      declaredVariables: declaredVars,
    });

    const basename = (normalizedName.split("/").pop() || normalizedName).replace(/\.xaml$/i, "").toLowerCase();
    if (!contracts.has(basename)) {
      contracts.set(basename, {
        file: normalizedName,
        workflowName,
        declaredArguments: declaredArgs,
        declaredVariables: declaredVars,
      });
    }
  }

  return contracts;
}

export function resolveTargetContract(
  targetWorkflow: string,
  contracts: Map<string, WorkflowContract>
): WorkflowContract | null {
  const lowerTarget = targetWorkflow.toLowerCase().replace(/\.xaml$/i, "");
  if (contracts.has(lowerTarget)) return contracts.get(lowerTarget)!;

  const basename = (lowerTarget.split("/").pop() || lowerTarget).replace(/\.xaml$/i, "");
  if (contracts.has(basename)) return contracts.get(basename)!;

  return null;
}

function validateParentChildContracts(
  entries: { name: string; content: string }[],
  contracts: Map<string, WorkflowContract>,
  defects: ContractIntegrityDefect[],
  exclusions: ContractExtractionExclusion[],
): void {
  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);
    const invocations = extractInvocations(entry.content, normalizedName, workflowName, exclusions, defects);

    for (const invocation of invocations) {
      const childContract = resolveTargetContract(invocation.targetWorkflow, contracts);

      if (!childContract) {
        defects.push({
          file: invocation.file,
          workflow: invocation.workflow,
          defectType: "decomposed_workflow_missing_contract",
          activityType: invocation.activityType,
          propertyName: "WorkflowFileName",
          referencedSymbol: "",
          targetWorkflow: invocation.targetWorkflow,
          targetArgument: "",
          offendingValue: invocation.targetWorkflow,
          severity: invocation.bindings.size > 0 ? "execution_blocking" : "handoff_required",
          detectionMethod: "contract_resolution",
          notes: invocation.bindings.size > 0
            ? `Target workflow "${invocation.targetWorkflow}" not found in archive — cannot validate ${invocation.bindings.size} argument binding(s)`
            : `Target workflow "${invocation.targetWorkflow}" not found in archive — invocation contract unverifiable`,
        });
        continue;
      }

      const unknownTargetArguments: string[] = [];
      const missingRequiredArguments: string[] = [];
      const undeclaredSymbols: string[] = [];

      for (const [bindingName, bindingValue] of invocation.bindings) {
        if (!childContract.declaredArguments.has(bindingName)) {
          unknownTargetArguments.push(bindingName);
          defects.push({
            file: invocation.file,
            workflow: invocation.workflow,
            defectType: "unknown_target_argument",
            activityType: invocation.activityType,
            propertyName: bindingName,
            referencedSymbol: bindingName,
            targetWorkflow: invocation.targetWorkflow,
            targetArgument: bindingName,
            offendingValue: bindingValue.substring(0, 200),
            severity: "execution_blocking",
            detectionMethod: "contract_comparison",
            notes: `Binding "${bindingName}" does not match any declared argument in "${invocation.targetWorkflow}"`,
          });
        } else {
          const childArg = childContract.declaredArguments.get(bindingName)!;
          const bindingDirection = detectBindingDirection(bindingName, invocation.rawElement);
          if (bindingDirection && bindingDirection !== childArg.direction) {
            defects.push({
              file: invocation.file,
              workflow: invocation.workflow,
              defectType: "invoke_argument_binding_mismatch",
              activityType: invocation.activityType,
              propertyName: bindingName,
              referencedSymbol: bindingName,
              targetWorkflow: invocation.targetWorkflow,
              targetArgument: bindingName,
              offendingValue: `bound as ${bindingDirection}, declared as ${childArg.direction}`,
              severity: "execution_blocking",
              detectionMethod: "contract_comparison",
              notes: `Binding direction mismatch for "${bindingName}" in "${invocation.targetWorkflow}": bound as ${bindingDirection} but declared as ${childArg.direction}`,
            });
          }

          const bindingType = detectBindingType(bindingValue, invocation.rawElement, bindingName);
          if (bindingType && childArg.type !== "x:Object") {
            const normalizedBindingType = normalizeTypeName(bindingType);
            const normalizedArgType = normalizeTypeName(childArg.type);
            if (normalizedBindingType && normalizedArgType && normalizedBindingType !== normalizedArgType) {
              defects.push({
                file: invocation.file,
                workflow: invocation.workflow,
                defectType: "invoke_argument_binding_mismatch",
                activityType: invocation.activityType,
                propertyName: bindingName,
                referencedSymbol: bindingName,
                targetWorkflow: invocation.targetWorkflow,
                targetArgument: bindingName,
                offendingValue: `bound type "${bindingType}", declared type "${childArg.type}"`,
                severity: "handoff_required",
                detectionMethod: "contract_comparison",
                notes: `Type mismatch for "${bindingName}" in "${invocation.targetWorkflow}": bound as "${bindingType}" but declared as "${childArg.type}"`,
              });
            }
          }
        }
      }

      const callerDeclaredVars = extractDeclaredVariables(entry.content);
      const callerDeclaredArgs = extractArguments(entry.content);
      const allCallerDeclared = new Set(callerDeclaredVars);
      for (const argKey of Array.from(callerDeclaredArgs.keys())) {
        allCallerDeclared.add(argKey);
      }

      for (const [bindingName, bindingValue] of invocation.bindings) {
        if (!bindingValue || bindingValue.trim().length === 0) continue;
        let exprToCheck = bindingValue.trim();
        if (exprToCheck.startsWith("[") && exprToCheck.endsWith("]")) {
          exprToCheck = exprToCheck.slice(1, -1);
        }
        if (/HANDOFF_|STUB_|ASSEMBLY_FAILED|PLACEHOLDER_/.test(exprToCheck)) continue;
        const undeclaredRefs = findUndeclaredVariables(exprToCheck, allCallerDeclared);
        for (const ref of undeclaredRefs) {
          if (!undeclaredSymbols.includes(ref)) {
            undeclaredSymbols.push(ref);
          }
        }
      }

      for (const [argName, argInfo] of childContract.declaredArguments) {
        if (argInfo.direction === "InArgument" || argInfo.direction === "InOutArgument") {
          if (!invocation.bindings.has(argName)) {
            missingRequiredArguments.push(argName);
            defects.push({
              file: invocation.file,
              workflow: invocation.workflow,
              defectType: "missing_required_target_argument",
              activityType: invocation.activityType,
              propertyName: argName,
              referencedSymbol: argName,
              targetWorkflow: invocation.targetWorkflow,
              targetArgument: argName,
              offendingValue: "",
              severity: "handoff_required",
              detectionMethod: "contract_comparison",
              notes: `Required ${argInfo.direction} "${argName}" (${argInfo.type}) in "${invocation.targetWorkflow}" is not bound by caller`,
            });
          }
        }
      }

      const providedBindings: Record<string, string> = {};
      for (const [k, v] of invocation.bindings) {
        providedBindings[k] = v.substring(0, 200);
      }
      emitInvokeContractTrace({
        callerWorkflow: invocation.workflow,
        targetWorkflow: invocation.targetWorkflow,
        targetDeclaredArguments: Array.from(childContract.declaredArguments.keys()),
        providedBindings,
        unknownTargetArguments,
        missingRequiredArguments,
        undeclaredSymbols,
      });
    }
  }
}

function detectBindingDirection(argName: string, rawElement: string): string | null {
  const inPattern = new RegExp(`<InArgument[^>]*x:Key="${argName}"`, "i");
  const outPattern = new RegExp(`<OutArgument[^>]*x:Key="${argName}"`, "i");
  const ioPattern = new RegExp(`<InOutArgument[^>]*x:Key="${argName}"`, "i");

  if (ioPattern.test(rawElement)) return "InOutArgument";
  if (outPattern.test(rawElement)) return "OutArgument";
  if (inPattern.test(rawElement)) return "InArgument";
  return null;
}

function detectBindingType(bindingValue: string, rawElement: string, argName: string): string | null {
  const escapedName = argName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const argElementPattern = new RegExp(`<(?:In|Out|InOut)Argument\\b[^>]*\\bx:Key="${escapedName}"[^>]*>`, "gi");
  let argMatch;
  while ((argMatch = argElementPattern.exec(rawElement)) !== null) {
    const tagStr = argMatch[0];
    const typeArgMatch = tagStr.match(/x:TypeArguments="([^"]+)"/);
    if (typeArgMatch) {
      const typeArg = typeArgMatch[1];
      if (typeArg && typeArg !== "x:Object") {
        return typeArg.replace(/^x:/, "");
      }
    }
  }
  const altPattern = new RegExp(`<(?:In|Out|InOut)Argument\\b[^>]*\\bx:TypeArguments="([^"]+)"[^>]*\\bx:Key="${escapedName}"`, "i");
  const altMatch = rawElement.match(altPattern);
  if (altMatch) {
    const typeArg = altMatch[1];
    if (typeArg && typeArg !== "x:Object") {
      return typeArg.replace(/^x:/, "");
    }
  }
  return null;
}

function normalizeTypeName(typeName: string): string {
  const map: Record<string, string> = {
    "string": "String", "x:string": "String", "x:String": "String", "System.String": "String",
    "int32": "Int32", "x:int32": "Int32", "x:Int32": "Int32", "System.Int32": "Int32", "integer": "Int32",
    "int64": "Int64", "x:int64": "Int64", "x:Int64": "Int64", "System.Int64": "Int64",
    "boolean": "Boolean", "x:boolean": "Boolean", "x:Boolean": "Boolean", "System.Boolean": "Boolean",
    "double": "Double", "x:double": "Double", "x:Double": "Double", "System.Double": "Double",
    "decimal": "Decimal", "x:decimal": "Decimal", "x:Decimal": "Decimal", "System.Decimal": "Decimal",
    "object": "Object", "x:object": "Object", "x:Object": "Object", "System.Object": "Object",
    "datetime": "DateTime", "System.DateTime": "DateTime",
  };
  const cleaned = typeName.replace(/^x:/, "");
  return map[typeName] || map[cleaned.toLowerCase()] || cleaned;
}

function isExpressionProperty(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return true;
  if (/^".*"$/.test(trimmed)) return false;
  if (/^&quot;.*&quot;$/.test(trimmed)) return false;
  if (/^(True|False|Nothing|\d+(\.\d+)?)$/.test(trimmed)) return false;
  if (/^[A-Z][a-zA-Z]+$/.test(trimmed)) return false;
  if (/\s*&\s*/.test(trimmed)) return true;
  if (/^[a-zA-Z_]\w*\(/.test(trimmed)) return true;
  if (/^(str_|int_|bool_|dbl_|dec_|obj_|dt_|ts_|in_|out_|io_)/i.test(trimmed)) return true;
  return false;
}

function validateScopeAndReferences(
  entries: { name: string; content: string }[],
  defects: ContractIntegrityDefect[],
): void {
  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);
    const declaredVars = extractDeclaredVariables(entry.content);
    const declaredArgs = extractArguments(entry.content);

    const allDeclared = new Set(declaredVars);
    for (const argName of declaredArgs.keys()) {
      allDeclared.add(argName);
    }

    const properties = extractExpressionBearingProperties(entry.content);

    for (const prop of properties) {
      const value = prop.value.trim();
      if (!value) continue;
      if (!isExpressionProperty(value)) continue;

      let exprToCheck = value;
      if (exprToCheck.startsWith("[") && exprToCheck.endsWith("]")) {
        exprToCheck = exprToCheck.slice(1, -1);
      }

      if (!exprToCheck || exprToCheck.length < 2) continue;
      if (/HANDOFF_|STUB_|ASSEMBLY_FAILED/.test(exprToCheck)) continue;

      const undeclaredRefs = findUndeclaredVariables(exprToCheck, allDeclared);
      const reportedSymbols = new Set<string>();

      for (const ref of undeclaredRefs) {
        reportedSymbols.add(ref);
        defects.push({
          file: normalizedName,
          workflow: workflowName,
          defectType: "undeclared_variable_reference",
          activityType: prop.activityType,
          propertyName: prop.propertyName,
          referencedSymbol: ref,
          targetWorkflow: "",
          targetArgument: "",
          offendingValue: value.substring(0, 200),
          severity: "handoff_required",
          detectionMethod: "scope_analysis",
          notes: `Variable "${ref}" is referenced but not declared in workflow "${workflowName}"`,
        });
      }

      const argPrefixPattern = /\b(in_\w+|out_\w+|io_\w+)\b/gi;
      let argMatch;
      while ((argMatch = argPrefixPattern.exec(exprToCheck)) !== null) {
        const argRef = argMatch[1];
        if (reportedSymbols.has(argRef)) continue;
        reportedSymbols.add(argRef);
        if (!allDeclared.has(argRef)) {
          defects.push({
            file: normalizedName,
            workflow: workflowName,
            defectType: "undeclared_argument_reference",
            activityType: prop.activityType,
            propertyName: prop.propertyName,
            referencedSymbol: argRef,
            targetWorkflow: "",
            targetArgument: "",
            offendingValue: value.substring(0, 200),
            severity: "handoff_required",
            detectionMethod: "scope_analysis",
            notes: `Argument "${argRef}" is referenced but not declared in workflow "${workflowName}"`,
          });
        }
      }
    }
  }
}

function validateMixedLiteralExpressionSyntax(
  entries: { name: string; content: string }[],
  defects: ContractIntegrityDefect[],
): void {
  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);
    const properties = extractExpressionBearingProperties(entry.content);

    for (const prop of properties) {
      if (detectMixedLiteralExpression(prop.value)) {
        defects.push({
          file: normalizedName,
          workflow: workflowName,
          defectType: "mixed_literal_expression_syntax",
          activityType: prop.activityType,
          propertyName: prop.propertyName,
          referencedSymbol: "",
          targetWorkflow: "",
          targetArgument: "",
          offendingValue: prop.value.substring(0, 200),
          severity: "handoff_required",
          detectionMethod: "pattern_analysis",
          notes: `Property "${prop.propertyName}" contains mixed literal/expression syntax that is neither a valid literal nor a valid executable expression`,
        });
      }
    }
  }
}

function validateInvokePropertySerialization(
  entries: { name: string; content: string }[],
  defects: ContractIntegrityDefect[],
): void {
  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);

    const properties = extractExpressionBearingProperties(entry.content);
    for (const prop of properties) {
      const sentinel = detectSentinelInProperty(prop.value);
      if (sentinel) {
        defects.push({
          file: normalizedName,
          workflow: workflowName,
          defectType: "placeholder_sentinel_in_property",
          activityType: prop.activityType,
          propertyName: prop.propertyName,
          referencedSymbol: sentinel,
          targetWorkflow: "",
          targetArgument: "",
          offendingValue: prop.value.substring(0, 200),
          severity: "execution_blocking",
          detectionMethod: "sentinel_scan",
          notes: `Property "${prop.propertyName}" contains sentinel "${sentinel}" — not executable`,
        });
      }
    }

    for (const invokeType of INVOKE_ACTIVITY_TYPES) {
      const invokePattern = new RegExp(`<(?:\\w+:)?${invokeType}\\b([^>]*?)(?:\\/>|>)`, "g");
      let im;
      while ((im = invokePattern.exec(entry.content)) !== null) {
        const attrs = im[1];

        for (const pseudoName of PSEUDO_PROPERTY_NAMES) {
          const pseudoPattern = new RegExp(`\\b${pseudoName}\\s*=\\s*"([^"]*)"`, "g");
          let pm;
          while ((pm = pseudoPattern.exec(attrs)) !== null) {
            const alreadyReported = defects.some(
              d => d.file === normalizedName && d.activityType === invokeType &&
                   d.propertyName === pseudoName && d.defectType === "invalid_invoke_serialization"
            );
            if (!alreadyReported) {
              defects.push({
                file: normalizedName,
                workflow: workflowName,
                defectType: "invalid_invoke_serialization",
                activityType: invokeType,
                propertyName: pseudoName,
                referencedSymbol: "",
                targetWorkflow: "",
                targetArgument: "",
                offendingValue: pm[1].substring(0, 200),
                severity: "execution_blocking",
                detectionMethod: "pseudo_property_scan",
                notes: `${invokeType} has pseudo-property "${pseudoName}" as attribute — structural element serialized as string`,
              });
            }
          }
        }
      }
    }

    for (const invokeType of INVOKE_ACTIVITY_TYPES) {
      const argBlockPattern = new RegExp(`<(?:\\w+:)?${invokeType}\\.Arguments>([\\s\\S]*?)<\\/(?:\\w+:)?${invokeType}\\.Arguments>`, "g");
      let abm;
      while ((abm = argBlockPattern.exec(entry.content)) !== null) {
        const argBlock = abm[1];
        const argKeys = new Map<string, number>();
        const keyPattern = /x:Key="([^"]+)"/g;
        let km;
        while ((km = keyPattern.exec(argBlock)) !== null) {
          const key = km[1];
          argKeys.set(key, (argKeys.get(key) || 0) + 1);
        }

        for (const [key, count] of argKeys) {
          if (count > 1) {
            defects.push({
              file: normalizedName,
              workflow: workflowName,
              defectType: "conflicting_argument_serialization",
              activityType: invokeType,
              propertyName: key,
              referencedSymbol: key,
              targetWorkflow: "",
              targetArgument: key,
              offendingValue: `${count} duplicate bindings for "${key}"`,
              severity: "execution_blocking",
              detectionMethod: "serialization_analysis",
              notes: `Argument "${key}" appears ${count} times in the same invocation argument block — conflicting serialization`,
            });
          }
        }

        const argElementPattern = /<(In|Out|InOut)Argument\b([^>]*)(?:\/>|>[^<]*<\/(?:In|Out|InOut)Argument>)/g;
        let aem;
        while ((aem = argElementPattern.exec(argBlock)) !== null) {
          const fullMatch = aem[0];
          const attrs = aem[2];
          if (!/x:Key="/.test(attrs)) {
            defects.push({
              file: normalizedName,
              workflow: workflowName,
              defectType: "invalid_argument_map_serialization",
              activityType: invokeType,
              propertyName: "Arguments",
              referencedSymbol: "",
              targetWorkflow: "",
              targetArgument: "",
              offendingValue: fullMatch.substring(0, 200),
              severity: "execution_blocking",
              detectionMethod: "serialization_analysis",
              notes: `Argument element missing required x:Key attribute — malformed argument map serialization`,
            });
          }
          if (!/x:TypeArguments="/.test(attrs)) {
            const keyMatch = attrs.match(/x:Key="([^"]+)"/);
            const keyName = keyMatch ? keyMatch[1] : "unknown";
            defects.push({
              file: normalizedName,
              workflow: workflowName,
              defectType: "invalid_argument_map_serialization",
              activityType: invokeType,
              propertyName: keyName,
              referencedSymbol: keyName,
              targetWorkflow: "",
              targetArgument: keyName,
              offendingValue: fullMatch.substring(0, 200),
              severity: "handoff_required",
              detectionMethod: "serialization_analysis",
              notes: `Argument "${keyName}" missing x:TypeArguments attribute — may cause runtime type resolution failure`,
            });
          }
        }
      }
    }
  }
}

function applyNormalizations(
  entries: { name: string; content: string }[],
  defects: ContractIntegrityDefect[],
  normalizations: ContractNormalizationAction[],
): void {
  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);

    for (const invokeType of INVOKE_ACTIVITY_TYPES) {
      const invokePattern = new RegExp(
        `<(?:\\w+:)?${invokeType}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/(?:\\w+:)?${invokeType}>)`,
        "g"
      );
      let m;
      while ((m = invokePattern.exec(entry.content)) !== null) {
        const attrs = m[1];
        const body = m[2] || "";

        const attrBindings = new Map<string, string>();
        const attrArgPattern = /\b([a-zA-Z_]\w*)\s*=\s*"([^"]*)"/g;
        let am;
        while ((am = attrArgPattern.exec(attrs)) !== null) {
          const name = am[1];
          if (INVOKE_SYSTEM_ATTRS.has(name.toLowerCase())) continue;
          if (name.startsWith("xmlns") || name.startsWith("sap") || name.startsWith("x:")) continue;
          attrBindings.set(name, am[2]);
        }

        const bodyBindings = new Map<string, string>();
        const argBlockMatch = body.match(new RegExp(`<(?:\\w+:)?${invokeType}\\.Arguments>([\\s\\S]*?)<\\/(?:\\w+:)?${invokeType}\\.Arguments>`));
        if (argBlockMatch) {
          const argBindingPattern = /<(?:In|Out|InOut)Argument\b[^>]*\bx:Key="([^"]+)"[^>]*>([^<]*)<\/(?:In|Out|InOut)Argument>/g;
          while ((am = argBindingPattern.exec(argBlockMatch[1])) !== null) {
            bodyBindings.set(am[1], am[2].trim());
          }
        }

        const declaredVars = extractDeclaredVariables(entry.content);
        const declaredArgs = extractArguments(entry.content);
        const allDeclaredInScope = new Set(declaredVars);
        for (const argName of declaredArgs.keys()) {
          allDeclaredInScope.add(argName);
        }

        for (const [name, attrValue] of attrBindings) {
          if (bodyBindings.has(name)) {
            const bodyValue = bodyBindings.get(name)!;
            const strippedAttr = attrValue.replace(/[\[\]"]/g, "");
            const strippedBody = bodyValue.replace(/[\[\]"]/g, "");
            const isEquivalent = attrValue === bodyValue || strippedAttr === strippedBody;

            defects.push({
              file: normalizedName,
              workflow: workflowName,
              defectType: "conflicting_argument_serialization",
              activityType: invokeType,
              propertyName: name,
              referencedSymbol: name,
              targetWorkflow: "",
              targetArgument: name,
              offendingValue: `attribute="${attrValue}" + body="${bodyValue}"`,
              severity: isEquivalent ? "handoff_required" : "execution_blocking",
              detectionMethod: "serialization_analysis",
              notes: isEquivalent
                ? `Duplicate binding for "${name}" — attribute and argument block both present with equivalent values`
                : `Conflicting binding for "${name}" — attribute="${attrValue}" vs body="${bodyValue}" have different values`,
            });

            if (isEquivalent && isNormalizationAllowed("remove_duplicate_conflicting_serialization")) {
              normalizations.push({
                beforeValue: `attribute="${attrValue}" + body="${bodyValue}"`,
                afterValue: `body="${bodyValue}"`,
                normalizationType: "remove_duplicate_conflicting_serialization",
                file: normalizedName,
                workflow: workflowName,
                property: name,
                rationale: `Removed duplicate attribute binding for "${name}" — body form is canonical`,
              });
            }
          }
        }

        for (const [name, value] of attrBindings) {
          if (!bodyBindings.has(name)) {
            const trimmed = value.trim();

            if (/^[a-zA-Z_]\w*$/.test(trimmed) && allDeclaredInScope.has(trimmed) && !/^\[.*\]$/.test(trimmed)) {
              defects.push({
                file: normalizedName,
                workflow: workflowName,
                defectType: "conflicting_argument_serialization",
                activityType: invokeType,
                propertyName: name,
                referencedSymbol: trimmed,
                targetWorkflow: "",
                targetArgument: name,
                offendingValue: trimmed,
                severity: "handoff_required",
                detectionMethod: "serialization_analysis",
                notes: `Bare variable reference "${trimmed}" used as attribute value for "${name}" — missing bracket wrapping`,
              });

              if (isNormalizationAllowed("normalize_quoting_wrapping")) {
                const normalizedValue = `[${trimmed}]`;
                normalizations.push({
                  beforeValue: trimmed,
                  afterValue: normalizedValue,
                  normalizationType: "normalize_quoting_wrapping",
                  file: normalizedName,
                  workflow: workflowName,
                  property: name,
                  rationale: `Declared variable "${trimmed}" normalized from bare to bracket-wrapped form`,
                });
              }
            }

            if (/^\[.*\]$/.test(trimmed) || /^".*"$/.test(trimmed)) {
              if (isNormalizationAllowed("canonicalize_invoke_binding")) {
                const direction = /^(in_|io_)/i.test(name) ? "InArgument" : /^out_/i.test(name) ? "OutArgument" : "InArgument";
                const canonicalForm = `<${direction} x:TypeArguments="x:Object" x:Key="${name}">${trimmed}</${direction}>`;

                defects.push({
                  file: normalizedName,
                  workflow: workflowName,
                  defectType: "conflicting_argument_serialization",
                  activityType: invokeType,
                  propertyName: name,
                  referencedSymbol: name,
                  targetWorkflow: "",
                  targetArgument: name,
                  offendingValue: `attribute: ${name}="${trimmed}"`,
                  severity: "handoff_required",
                  detectionMethod: "serialization_analysis",
                  notes: `Attribute-style binding "${name}" should use canonical argument block form`,
                });

                normalizations.push({
                  beforeValue: `${name}="${trimmed}"`,
                  afterValue: canonicalForm,
                  normalizationType: "canonicalize_invoke_binding",
                  file: normalizedName,
                  workflow: workflowName,
                  property: name,
                  rationale: `Attribute binding "${name}" canonicalized to structured argument element form`,
                });
              }
            }
          }
        }
      }
    }
  }
}

function validateExpressionScopeViolations(
  entries: { name: string; content: string }[],
  defects: ContractIntegrityDefect[],
): void {
  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);

    const scopeVars: { vars: Set<string>; depth: number }[] = [];
    let depth = 0;

    const varBlockPattern = /<(?:Sequence|Flowchart|StateMachine)\.Variables>([\s\S]*?)<\/(?:Sequence|Flowchart|StateMachine)\.Variables>/g;
    let vbm;
    while ((vbm = varBlockPattern.exec(entry.content)) !== null) {
      const varBlock = vbm[1];
      const vars = new Set<string>();
      const varPattern = /Name="([^"]+)"/g;
      let vm;
      while ((vm = varPattern.exec(varBlock)) !== null) {
        vars.add(vm[1]);
      }
      if (vars.size > 0) {
        scopeVars.push({ vars, depth: depth++ });
      }
    }

    if (scopeVars.length < 2) continue;

    const innerVars = new Set<string>();
    for (let i = 1; i < scopeVars.length; i++) {
      for (const v of scopeVars[i].vars) {
        innerVars.add(v);
      }
    }

    const outerVars = scopeVars[0].vars;
    for (const innerVar of innerVars) {
      if (outerVars.has(innerVar)) {
        defects.push({
          file: normalizedName,
          workflow: workflowName,
          defectType: "invalid_expression_scope",
          activityType: "Variable",
          propertyName: innerVar,
          referencedSymbol: innerVar,
          targetWorkflow: "",
          targetArgument: "",
          offendingValue: innerVar,
          severity: "handoff_required",
          detectionMethod: "scope_analysis",
          notes: `Variable "${innerVar}" is declared in multiple scopes within "${workflowName}" — potential scope shadowing issue`,
        });
      }
    }
  }
}

function isNormalizationAllowed(type: NormalizationType): boolean {
  return NORMALIZATION_ALLOWLIST.has(type);
}

export function validateContractIntegrity(
  entries: { name: string; content: string }[]
): ContractIntegrityResult {
  const defects: ContractIntegrityDefect[] = [];
  const normalizations: ContractNormalizationAction[] = [];
  const exclusions: ContractExtractionExclusion[] = [];

  const contracts = buildWorkflowContracts(entries);

  validateParentChildContracts(entries, contracts, defects, exclusions);
  validateScopeAndReferences(entries, defects);
  validateExpressionScopeViolations(entries, defects);
  validateMixedLiteralExpressionSyntax(entries, defects);
  validateInvokePropertySerialization(entries, defects);
  applyNormalizations(entries, defects, normalizations);

  // Task #527 RC5: classify origin per defect using the canonical closed
  // placeholder vocabulary. Deterministic membership test — not retrospective
  // string matching on arbitrary content. Defects whose offending value is
  // exactly a canonical pipeline-fallback placeholder are tagged as
  // "pipeline-fallback" and are excluded from the structurally_invalid
  // threshold by the final verdict logic.
  for (const d of defects) {
    if (d.origin) continue;
    const raw = (d.offendingValue || "").trim();
    // Unwrap VB bracketed form and surrounding quotes to get the bare token.
    const inner = raw.replace(/^[\[\s"]+|[\]\s"]+$/g, "").trim();
    // Task #527 RC5: primary classification uses construction-time
    // provenance — the value is looked up in the placeholder-sanitizer's
    // value->provenance index, which was populated when the canonical
    // placeholder constructor ran. This carries origin from construction
    // point through to verdict without retrospective shape matching.
    const constructedProvenance = lookupPipelineFallbackProvenance(inner);
    if (constructedProvenance) {
      d.origin = constructedProvenance.origin;
      d.originReason = `construction-time provenance from ${constructedProvenance.source} (${constructedProvenance.reason})`;
      // NOTE: severity is intentionally preserved. The final-artifact
      // verdict logic (see final-artifact-validation.ts) consults `origin`
      // explicitly and excludes pipeline-fallback defects from the
      // structurally_invalid count, while still surfacing them in the
      // defect list with their original severity for handoff reporting.
      continue;
    }
    // Secondary classification: values that match the canonical vocabulary
    // shape but were not registered in the provenance index. This covers
    // placeholders produced before the index was wired — during rollout
    // of construction-time provenance — and is documented as a transitional
    // fallback. Once every emission site uses canonical constructors, this
    // branch becomes unreachable.
    if (isCanonicalPlaceholder(inner)) {
      d.origin = "pipeline-fallback";
      d.originReason = "canonical-vocabulary shape match (transitional fallback; no construction-time provenance entry)";
    } else {
      d.origin = "genuine";
    }
  }

  const hasIssues = defects.length > 0;

  const executionBlocking = defects.filter(d => d.severity === "execution_blocking").length;
  const handoffRequired = defects.filter(d => d.severity === "handoff_required").length;
  const totalUnknownTargetArguments = defects.filter(d => d.defectType === "unknown_target_argument").length;
  const totalInvalidInvokeSerialization = defects.filter(d => d.defectType === "invalid_invoke_serialization" || d.defectType === "invalid_argument_map_serialization").length;
  const totalUndeclaredSymbols = defects.filter(d => d.defectType === "undeclared_variable_reference" || d.defectType === "undeclared_argument_reference").length;

  const exclusionsByCategory: Record<ExclusionCategory, number> = {
    designer_metadata: 0,
    view_state: 0,
    layout_hint: 0,
    idref_reference: 0,
    annotation: 0,
    non_runtime_serialization: 0,
  };
  for (const ex of exclusions) {
    exclusionsByCategory[ex.exclusionCategory]++;
  }

  const summaryMetrics: ContractIntegritySummaryMetrics = {
    totalContractDefects: defects.length,
    totalNormalizationActions: normalizations.length,
    totalExecutionBlocking: executionBlocking,
    totalHandoffRequired: handoffRequired,
    totalUnknownTargetArguments,
    totalInvalidInvokeSerialization,
    totalUndeclaredSymbols,
    totalExcludedNonContractFields: exclusions.length,
    exclusionsByCategory,
  };

  let summary: string | undefined;
  if (hasIssues || exclusions.length > 0) {
    const parts: string[] = [];
    if (executionBlocking > 0) parts.push(`${executionBlocking} execution-blocking`);
    if (handoffRequired > 0) parts.push(`${handoffRequired} handoff-required`);
    if (normalizations.length > 0) parts.push(`${normalizations.length} normalization(s) applied`);
    if (exclusions.length > 0) parts.push(`${exclusions.length} non-contract field(s) excluded`);
    summary = hasIssues
      ? `Contract integrity: ${parts.join(", ")} defect(s) found`
      : `Contract integrity: clean — ${parts.join(", ")}`;
  }

  return {
    contractIntegrityDefects: defects,
    hasContractIntegrityIssues: hasIssues,
    contractIntegritySummary: summary,
    contractIntegritySummaryMetrics: summaryMetrics,
    contractNormalizationActions: normalizations,
    contractExtractionExclusions: exclusions,
  };
}
