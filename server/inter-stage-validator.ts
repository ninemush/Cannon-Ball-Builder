import type { TraceabilityManifest } from "./traceability-manifest";
import { catalogService } from "./catalog/catalog-service";

export interface InterStageViolation {
  type: "undeclared_variable" | "argument_mismatch" | "scope_violation" | "xmlns_missing" | "structural_violation" | "variable_ref_missing" | "argument_type_mismatch" | "argument_direction_mismatch";
  workflow: string;
  stepIndex?: number;
  detail: string;
  severity: "error" | "warning";
  repairAction?: string;
}

export interface InterStageValidationResult {
  violations: InterStageViolation[];
  repairsApplied: number;
  unresolvedCount: number;
}

export interface ContractCorrectionRound {
  round: number;
  violationsAtStart: number;
  repairsApplied: number;
  violationsRemaining: number;
}

export interface ContractCorrectionResult {
  rounds: ContractCorrectionRound[];
  totalRepairs: number;
  finalViolations: InterStageViolation[];
  finalUnresolvedCount: number;
}

export type SemanticCorrectorFn = (
  workflow: string,
  stepIndex: number,
  violation: InterStageViolation,
  step: { activity: string; activityType?: string; properties?: Record<string, unknown> },
) => { repaired: boolean; updatedProperties?: Record<string, unknown> };

export function runEnricherToAssemblerCorrectionLadder(
  workflows: Array<{
    name: string;
    variables?: Array<{ name: string; type?: string; scope?: string }>;
    arguments?: Array<{ name: string; direction: string; type: string }>;
    steps?: Array<{
      activity: string;
      activityType?: string;
      properties?: Record<string, unknown>;
    }>;
  }>,
  manifest?: TraceabilityManifest,
  maxRounds: number = 2,
  semanticCorrector?: SemanticCorrectorFn,
): ContractCorrectionResult {
  const rounds: ContractCorrectionRound[] = [];
  let totalRepairs = 0;

  let currentResult = validateEnricherToAssemblerContract(workflows, manifest);
  totalRepairs += currentResult.repairsApplied;
  rounds.push({
    round: 0,
    violationsAtStart: currentResult.violations.length + currentResult.repairsApplied,
    repairsApplied: currentResult.repairsApplied,
    violationsRemaining: currentResult.unresolvedCount,
  });

  for (let round = 1; round <= maxRounds; round++) {
    const correctableCount = currentResult.violations.filter(
      v => v.severity === "error" || (v.severity === "warning" && v.repairAction),
    ).length;
    if (correctableCount === 0) break;

    let roundRepairs = applyDeterministicCorrections(workflows, currentResult.violations, manifest);

    if (semanticCorrector && correctableCount > roundRepairs) {
      for (const v of currentResult.violations) {
        if (v.stepIndex === undefined || !v.workflow) continue;
        const wf = workflows.find(w => (w.name || "Main") === v.workflow);
        if (!wf?.steps?.[v.stepIndex]) continue;
        const step = wf.steps[v.stepIndex];
        try {
          const result = semanticCorrector(v.workflow, v.stepIndex, v, step);
          if (result.repaired) {
            if (result.updatedProperties) {
              step.properties = result.updatedProperties;
            }
            roundRepairs++;
            console.log(`[Inter-Stage] Semantic corrector repaired ${v.type} in ${v.workflow} step ${v.stepIndex}`);
            if (manifest) {
              const mEntry = findManifestEntryForStep(manifest, v.workflow, v.stepIndex, step);
              if (mEntry) {
                mEntry.corrections.push(`Semantic correction round ${round}: ${v.type} repaired`);
              }
            }
          }
        } catch (corrErr: any) {
          console.warn(`[Inter-Stage] Semantic corrector failed for ${v.workflow} step ${v.stepIndex}: ${corrErr?.message || "unknown"}`);
        }
      }
    }

    if (roundRepairs === 0) break;

    totalRepairs += roundRepairs;
    const revalidation = validateEnricherToAssemblerContract(workflows, manifest);
    totalRepairs += revalidation.repairsApplied;
    rounds.push({
      round,
      violationsAtStart: currentResult.unresolvedCount,
      repairsApplied: roundRepairs + revalidation.repairsApplied,
      violationsRemaining: revalidation.unresolvedCount,
    });
    currentResult = revalidation;
  }

  if (currentResult.unresolvedCount > 0 && manifest) {
    for (const v of currentResult.violations) {
      if (v.stepIndex === undefined || !v.workflow) continue;
      const wf = workflows.find(w => (w.name || "Main") === v.workflow);
      if (!wf?.steps?.[v.stepIndex]) continue;
      const step = wf.steps[v.stepIndex];
      const mEntry = findManifestEntryForStep(manifest, v.workflow, v.stepIndex, step);
      if (mEntry && mEntry.status === "preserved") {
        mEntry.status = "degraded";
        mEntry.reason = `Unresolved after ${rounds.length} correction round(s): ${v.detail}`;
        mEntry.developerAction = v.repairAction || `Fix ${v.type} in ${v.workflow}.xaml step ${v.stepIndex}`;
        mEntry.corrections.push(`Unresolved: ${v.type} — localized degradation applied`);
      }
    }
  }

  return {
    rounds,
    totalRepairs,
    finalViolations: currentResult.violations,
    finalUnresolvedCount: currentResult.unresolvedCount,
  };
}

function applyDeterministicCorrections(
  workflows: Array<{
    name: string;
    variables?: Array<{ name: string; type?: string; scope?: string }>;
    arguments?: Array<{ name: string; direction: string; type: string }>;
    steps?: Array<{
      activity: string;
      activityType?: string;
      properties?: Record<string, unknown>;
    }>;
  }>,
  violations: InterStageViolation[],
  manifest?: TraceabilityManifest,
): number {
  let repairsApplied = 0;

  for (const v of violations) {
    if (v.type === "argument_mismatch" && v.severity === "warning") {
      const wf = workflows.find(w => (w.name || "Main") === v.workflow);
      if (!wf || !wf.steps || v.stepIndex === undefined) continue;
      const step = wf.steps[v.stepIndex];
      if (!step || !step.properties) continue;

      const argMatch = v.detail.match(/argument "([^"]+)"/);
      const targetMatch = v.detail.match(/InvokeWorkflowFile to ([^:]+):/);
      if (argMatch && targetMatch) {
        const argName = argMatch[1];
        const targetWfName = targetMatch[1];
        if (!step.properties.Arguments) step.properties.Arguments = {};
        const args = step.properties.Arguments as Record<string, unknown>;
        if (args[argName] === undefined || args[argName] === null || args[argName] === "") {
          const targetWf = workflows.find(w => (w.name || "Main") === targetWfName);
          const targetArg = targetWf?.arguments?.find(a => a.name === argName);
          if (targetArg) {
            const defaultVal = getDefaultValueForType(targetArg.type);
            args[argName] = defaultVal;
            repairsApplied++;
            console.log(`[Inter-Stage] Correction round: injected default binding for "${argName}" (${targetArg.type}) in InvokeWorkflowFile to ${targetWfName} within ${v.workflow}`);
            if (manifest) {
              const mEntry = findManifestEntryForStep(manifest, v.workflow, v.stepIndex, step);
              if (mEntry) {
                mEntry.corrections.push(`Auto-bound argument "${argName}" with default ${targetArg.type} value`);
                if (mEntry.status === "preserved") {
                  mEntry.status = "degraded";
                  mEntry.reason = `Auto-bound argument "${argName}" with default value — developer should verify`;
                  mEntry.developerAction = `Verify binding for argument "${argName}" in InvokeWorkflowFile to ${targetWfName} within ${v.workflow}.xaml`;
                }
              }
            }
          }
        }
      }
    }

    if (v.type === "argument_direction_mismatch" && v.severity === "error") {
      const wf = workflows.find(w => (w.name || "Main") === v.workflow);
      if (!wf || !wf.steps || v.stepIndex === undefined) continue;
      const step = wf.steps[v.stepIndex];
      if (!step?.properties?.Arguments) continue;

      const argMatch = v.detail.match(/argument "([^"]+)"/);
      const dirMatch = v.detail.match(/target declares (\w+)/);
      if (argMatch && dirMatch) {
        const argName = argMatch[1];
        const correctDir = dirMatch[1];
        const args = step.properties.Arguments as Record<string, unknown>;
        const binding = args[argName];
        if (binding && typeof binding === "object") {
          (binding as Record<string, unknown>).direction = correctDir;
          repairsApplied++;
          console.log(`[Inter-Stage] Correction round: fixed argument direction for "${argName}" to ${correctDir} in ${v.workflow}`);
          if (manifest) {
            const mEntry = findManifestEntryForStep(manifest, v.workflow, v.stepIndex, step);
            if (mEntry) {
              mEntry.corrections.push(`Fixed argument "${argName}" direction to ${correctDir}`);
            }
          }
        }
      }
    }
  }

  return repairsApplied;
}

function getDefaultValueForType(type: string): string {
  const lower = type.toLowerCase().replace(/^system\./, "");
  switch (lower) {
    case "string": return '""';
    case "int32": case "int64": return "0";
    case "boolean": return "False";
    case "double": case "decimal": return "0.0";
    case "datetime": return "DateTime.Now";
    default: return "Nothing";
  }
}

const NAMING_CONVENTION_TYPE_MAP: Record<string, string> = {
  "bool": "Boolean", "str": "String", "int": "Int32",
  "dt": "DataTable", "dbl": "Double", "dec": "Decimal",
  "obj": "Object", "ts": "TimeSpan", "drow": "DataRow",
  "qi": "Object", "qid": "Object", "arr": "Object",
  "dict": "Object", "lst": "Object", "list": "Object",
};

function inferVariableTypeFromName(varName: string): string | null {
  const prefixMatch = varName.match(/^([a-z]+)_/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    return NAMING_CONVENTION_TYPE_MAP[prefix] || null;
  }
  return null;
}

function inferOutputVarType(activityType: string | undefined, varName: string): string {
  if (activityType && catalogService.isLoaded()) {
    const catalogType = catalogService.getActivityOutputType(activityType);
    if (catalogType) return catalogType;
  }

  return inferVariableTypeFromName(varName) || "String";
}

function collectOutputVarsFromSteps(
  steps: Array<{ activity: string; activityType?: string; properties?: Record<string, unknown> }>,
): Array<{ varName: string; varType: string; activityType: string }> {
  const results: Array<{ varName: string; varType: string; activityType: string }> = [];

  function walkNode(node: Record<string, unknown>) {
    const outputVar = node.outputVar as string | undefined;
    const actType = (node.activityType || node.template || node.activity || "") as string;
    if (outputVar && typeof outputVar === "string" && outputVar.trim().length > 0) {
      const inferredType = inferOutputVarType(actType, outputVar);
      results.push({ varName: outputVar, varType: inferredType, activityType: actType });
    }

    const childKeys = ["children", "tryChildren", "catchChildren", "finallyChildren",
      "thenChildren", "elseChildren", "bodyChildren"];
    for (const key of childKeys) {
      const children = node[key];
      if (Array.isArray(children)) {
        for (const child of children) {
          if (child && typeof child === "object") {
            walkNode(child as Record<string, unknown>);
          }
        }
      }
    }

    if (Array.isArray(node.steps)) {
      for (const step of node.steps) {
        if (step && typeof step === "object") {
          walkNode(step as Record<string, unknown>);
        }
      }
    }
  }

  for (const step of steps) {
    walkNode(step as unknown as Record<string, unknown>);
  }

  return results;
}

export function reconcileSpecLevelVariables(
  workflows: Array<{
    name: string;
    variables?: Array<{ name: string; type?: string; scope?: string }>;
    arguments?: Array<{ name: string; direction: string; type: string }>;
    steps?: Array<{
      activity: string;
      activityType?: string;
      properties?: Record<string, unknown>;
    }>;
    rootSequence?: Record<string, unknown>;
  }>,
): number {
  let autoDeclarations = 0;

  for (const wf of workflows) {
    const wfName = wf.name || "Main";
    if (!wf.variables) wf.variables = [];

    const declaredVars = new Set<string>();
    for (const v of wf.variables) declaredVars.add(v.name);
    if (wf.arguments) {
      for (const a of wf.arguments) declaredVars.add(a.name);
    }

    const outputVars: Array<{ varName: string; varType: string; activityType: string }> = [];

    if (wf.steps) {
      outputVars.push(...collectOutputVarsFromSteps(wf.steps));
    }

    if (wf.rootSequence) {
      const rootChildren = wf.rootSequence.children;
      if (Array.isArray(rootChildren)) {
        outputVars.push(...collectOutputVarsFromSteps(rootChildren as any));
      }
    }

    for (const ov of outputVars) {
      if (!declaredVars.has(ov.varName)) {
        wf.variables.push({ name: ov.varName, type: ov.varType, scope: "workflow" });
        declaredVars.add(ov.varName);
        autoDeclarations++;
        console.log(`[Spec-Reconciliation] Auto-declared output variable "${ov.varName}" (type: ${ov.varType}) from activity "${ov.activityType}" in ${wfName}`);
      }
    }

    function walkNodesForExprRefs(nodes: any[]) {
      for (const node of nodes) {
        if (node.properties) {
          const allProps = collectAllProperties(node.properties);
          for (const { value: propVal } of allProps) {
            const strVal = extractStringValue(propVal);
            if (!strVal) continue;
            const refs = extractVariableReferences(strVal);
            for (const varRef of refs) {
              if (!declaredVars.has(varRef) && !isBuiltInVariable(varRef) && isHighConfidenceVariableName(varRef)) {
                const namingType = inferVariableTypeFromName(varRef);
                if (!namingType) continue;
                wf.variables!.push({ name: varRef, type: namingType, scope: "workflow" });
                declaredVars.add(varRef);
                autoDeclarations++;
                console.log(`[Spec-Reconciliation] Auto-declared expression-referenced variable "${varRef}" (type: ${namingType}) in ${wfName}`);
              }
            }
          }
        }
        for (const childKey of ["children", "tryChildren", "catchChildren", "finallyChildren", "thenChildren", "elseChildren", "body"]) {
          const childArr = node[childKey];
          if (Array.isArray(childArr)) {
            walkNodesForExprRefs(childArr);
          }
        }
      }
    }

    if (wf.steps) walkNodesForExprRefs(wf.steps);
    if (wf.rootSequence) {
      const rootChildren = wf.rootSequence.children;
      if (Array.isArray(rootChildren)) walkNodesForExprRefs(rootChildren);
    }
  }

  return autoDeclarations;
}

export function validateEnricherToAssemblerContract(
  workflows: Array<{
    name: string;
    variables?: Array<{ name: string; type?: string; scope?: string }>;
    arguments?: Array<{ name: string; direction: string; type: string }>;
    steps?: Array<{
      activity: string;
      activityType?: string;
      properties?: Record<string, unknown>;
    }>;
  }>,
  manifest?: TraceabilityManifest,
): InterStageValidationResult {
  const violations: InterStageViolation[] = [];
  let repairsApplied = 0;

  const workflowArgMap = new Map<string, Array<{ name: string; direction: string; type: string }>>();
  for (const wf of workflows) {
    const wfName = wf.name || "Main";
    workflowArgMap.set(wfName, wf.arguments || []);
  }

  for (const wf of workflows) {
    const wfName = wf.name || "Main";
    const declaredVars = new Set<string>();
    if (wf.variables) {
      for (const v of wf.variables) {
        declaredVars.add(v.name);
      }
    }
    if (wf.arguments) {
      for (const a of wf.arguments) {
        declaredVars.add(a.name);
      }
    }

    if (!wf.steps) continue;

    for (let stepIdx = 0; stepIdx < wf.steps.length; stepIdx++) {
      const step = wf.steps[stepIdx];
      if (!step.properties) continue;

      const allProps = collectAllProperties(step.properties);

      for (const { path: propPath, value: propVal } of allProps) {
        const strVal = extractStringValue(propVal);
        if (!strVal) continue;

        const referencedVars = extractVariableReferences(strVal);
        for (const varRef of referencedVars) {
          if (!declaredVars.has(varRef) && !isBuiltInVariable(varRef)) {
            if (isHighConfidenceVariableName(varRef)) {
              if (!wf.variables) wf.variables = [];
              const alreadyDeclared = wf.variables.some(v => v.name === varRef);
              if (!alreadyDeclared) {
                wf.variables.push({ name: varRef, type: "String", scope: "workflow" });
              }
              declaredVars.add(varRef);
              repairsApplied++;
              console.log(`[Inter-Stage] Auto-declared missing variable "${varRef}" in ${wfName} (type: String)`);
            } else {
              violations.push({
                type: "undeclared_variable",
                workflow: wfName,
                stepIndex: stepIdx,
                detail: `Variable "${varRef}" referenced in step ${stepIdx} (${step.activity || step.activityType || "unknown"}) property "${propPath}" but not declared in ${wfName}`,
                severity: "warning",
                repairAction: `Add variable declaration for "${varRef}" or replace with TODO placeholder`,
              });
              if (manifest) {
                const mEntry = findManifestEntryForStep(manifest, wfName, stepIdx, step);
                if (mEntry && mEntry.status === "preserved") {
                  mEntry.status = "degraded";
                  mEntry.reason = `Variable "${varRef}" not declared — property "${propPath}" may use placeholder`;
                  mEntry.developerAction = `Declare variable "${varRef}" or update expression in ${wfName}.xaml`;
                }
              }
            }
          }
        }

        if (step.activityType === "InvokeWorkflowFile" && propPath === "WorkflowFileName") {
          const targetWf = strVal.replace(/\.xaml$/i, "").replace(/^.*[/\\]/, "");
          const targetArgs = workflowArgMap.get(targetWf);
          if (targetArgs) {
            const invokeViolations = validateArgumentCompatibility(
              wfName, targetWf, targetArgs,
              step.properties.Arguments,
              stepIdx,
            );
            for (const v of invokeViolations) {
              violations.push(v);
              if (manifest) {
                const mEntry = findManifestEntryForStep(manifest, wfName, stepIdx, step);
                if (mEntry && mEntry.status === "preserved") {
                  mEntry.status = "degraded";
                  mEntry.reason = v.detail;
                  mEntry.developerAction = v.repairAction || `Fix argument bindings for InvokeWorkflowFile to ${targetWf} in ${wfName}.xaml`;
                }
              }
            }
          }
        }
      }
    }
  }

  for (const v of violations) {
    if (v.severity === "warning" && v.repairAction) {
      const wf = workflows.find(w => (w.name || "Main") === v.workflow);
      if (wf && v.stepIndex !== undefined && wf.steps && wf.steps[v.stepIndex]) {
        const step = wf.steps[v.stepIndex];
        if (v.type === "undeclared_variable") {
          const varMatch = v.detail.match(/Variable "([^"]+)"/);
          const propMatch = v.detail.match(/property "([^"]+)"/);
          if (varMatch && propMatch && step.properties) {
            const varName = varMatch[1];
            const propName = propMatch[1];
            const currentVal = step.properties[propName];
            if (typeof currentVal === "string" && currentVal.includes(`[${varName}]`)) {
              step.properties[propName] = currentVal.replace(
                `[${varName}]`,
                `"TODO_${varName}"`,
              );
              repairsApplied++;
              v.severity = "warning";
              console.log(`[Inter-Stage] Fallback: replaced undeclared variable "${varName}" with TODO placeholder in ${v.workflow} step ${v.stepIndex}`);
              if (manifest) {
                const mEntry = findManifestEntryForStep(manifest, v.workflow, v.stepIndex, step);
                if (mEntry) {
                  mEntry.placeholderInserted = `TODO_${varName}`;
                  mEntry.developerAction = `Replace TODO_${varName} with proper variable declaration and binding in ${v.workflow}.xaml`;
                }
              }
            }
          }
        }
      }
    }
  }

  const wfVarScopes = new Map<string, Set<string>>();
  for (const wf of workflows) {
    const wfName = wf.name || "Main";
    const scope = new Set<string>();
    if (wf.variables) for (const v of wf.variables) scope.add(v.name);
    if (wf.arguments) for (const a of wf.arguments) scope.add(a.name);
    wfVarScopes.set(wfName, scope);
  }
  for (const wf of workflows) {
    const wfName = wf.name || "Main";
    if (!wf.steps) continue;
    for (let stepIdx = 0; stepIdx < wf.steps.length; stepIdx++) {
      const step = wf.steps[stepIdx];
      if (step.activityType !== "InvokeWorkflowFile" || !step.properties) continue;
      const wfFileName = extractStringValue(step.properties.WorkflowFileName);
      if (!wfFileName) continue;
      const targetWf = wfFileName.replace(/\.xaml$/i, "").replace(/^.*[/\\]/, "");
      const targetScope = wfVarScopes.get(targetWf);
      if (!targetScope) continue;
      const callerScope = wfVarScopes.get(wfName);
      if (!callerScope) continue;

      if (step.properties.Arguments && typeof step.properties.Arguments === "object") {
        const bindings = step.properties.Arguments as Record<string, unknown>;
        for (const [argName, argVal] of Object.entries(bindings)) {
          const strVal = typeof argVal === "string" ? argVal : null;
          if (!strVal) continue;
          const refs = extractVariableReferences(strVal);
          for (const ref of refs) {
            if (!callerScope.has(ref) && !isBuiltInVariable(ref)) {
              violations.push({
                type: "scope_violation",
                workflow: wfName,
                stepIndex: stepIdx,
                detail: `Scope violation: argument binding for "${argName}" in InvokeWorkflowFile to ${targetWf} references variable "${ref}" not in scope of ${wfName}`,
                severity: "warning",
                repairAction: `Declare variable "${ref}" in ${wfName}.xaml or update the argument binding for "${argName}"`,
              });
              if (manifest) {
                const mEntry = findManifestEntryForStep(manifest, wfName, stepIdx, step);
                if (mEntry && mEntry.status === "preserved") {
                  mEntry.status = "degraded";
                  mEntry.reason = `Scope violation: "${ref}" not in caller scope for argument "${argName}"`;
                  mEntry.developerAction = `Declare "${ref}" in ${wfName}.xaml or fix binding for "${argName}"`;
                  mEntry.corrections.push(`Scope violation: "${ref}" out of scope`);
                }
              }
            }
          }
        }
      }
    }
  }

  const unresolvedCount = violations.filter(v =>
    v.severity === "error" || (v.severity === "warning" && v.repairAction),
  ).length;

  return {
    violations,
    repairsApplied,
    unresolvedCount,
  };
}

function findManifestEntryForStep(
  manifest: TraceabilityManifest,
  wfName: string,
  stepIdx: number,
  step: { activity?: string; activityType?: string },
) {
  const actKey = (step.activity || "").replace(/\s+/g, "_").substring(0, 40);
  const fullStepId = `${wfName}:S${stepIdx}:${step.activityType || "unknown"}:${actKey}`;
  let entry = manifest.entries.find(e => e.stepId === fullStepId);
  if (!entry) {
    entry = manifest.entries.find(e => e.stepId.startsWith(`${wfName}:S${stepIdx}:`));
  }
  if (!entry) {
    entry = manifest.entries.find(
      e => e.assignedWorkflow === wfName && e.assignedActivity === (step.activity || ""),
    );
  }
  return entry || null;
}

function collectAllProperties(
  props: Record<string, unknown>,
  parentPath?: string,
): Array<{ path: string; value: unknown }> {
  const results: Array<{ path: string; value: unknown }> = [];
  for (const [key, val] of Object.entries(props)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    results.push({ path, value: val });
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const nested = val as Record<string, unknown>;
      if (nested.type === undefined && nested.name === undefined && nested.value === undefined) {
        results.push(...collectAllProperties(nested, path));
      }
    }
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const item = val[i];
        if (item && typeof item === "object") {
          results.push(...collectAllProperties(item as Record<string, unknown>, `${path}[${i}]`));
        } else {
          results.push({ path: `${path}[${i}]`, value: item });
        }
      }
    }
  }
  return results;
}

export function validateAssemblerToComplianceContract(
  xamlEntries: Array<{ name: string; content: string }>,
  manifest?: TraceabilityManifest,
): InterStageValidationResult {
  const violations: InterStageViolation[] = [];
  let repairsApplied = 0;

  for (const entry of xamlEntries) {
    const baseName = (entry.name.split("/").pop() || entry.name).replace(/\.xaml$/i, "");

    const xmlnsPrefixes = extractUsedPrefixes(entry.content);
    const declaredPrefixes = extractDeclaredPrefixes(entry.content);

    for (const prefix of xmlnsPrefixes) {
      if (!declaredPrefixes.has(prefix) && !isBuiltInXmlPrefix(prefix)) {
        const repaired = tryInjectXmlnsDeclaration(entry, prefix);
        if (repaired) {
          repairsApplied++;
          console.log(`[Inter-Stage] Auto-injected xmlns declaration for prefix "${prefix}" in ${baseName}`);
        } else {
          violations.push({
            type: "xmlns_missing",
            workflow: baseName,
            detail: `xmlns prefix "${prefix}" used but not declared in ${baseName}.xaml — compliance pass will likely fail`,
            severity: "error",
          });
        }
      }
    }

    const declaredVarsInXaml = extractDeclaredVariablesFromXaml(entry.content);
    const referencedVarsInXaml = extractReferencedVariablesFromXaml(entry.content);

    for (const varRef of referencedVarsInXaml) {
      if (!declaredVarsInXaml.has(varRef) && !isBuiltInVariable(varRef)) {
        let resolved = false;
        if (isHighConfidenceVariableName(varRef)) {
          resolved = tryInjectVariableDeclaration(entry, varRef);
          if (resolved) {
            repairsApplied++;
            declaredVarsInXaml.add(varRef);
            console.log(`[Inter-Stage] Auto-injected variable declaration for "${varRef}" in ${baseName}`);
          }
        }
        if (!resolved) {
          const degraded = degradeUndeclaredVariableReferences(entry, varRef);
          if (degraded) {
            repairsApplied++;
            console.log(`[Inter-Stage] Degraded references to undeclared variable "${varRef}" in ${baseName} — replaced with TODO placeholder`);
            violations.push({
              type: "variable_ref_missing",
              workflow: baseName,
              detail: `Variable "${varRef}" referenced in ${baseName}.xaml — could not safely auto-declare; expressions replaced with TODO placeholder [DEGRADED]`,
              severity: "warning",
            });
          } else {
            violations.push({
              type: "variable_ref_missing",
              workflow: baseName,
              detail: `Variable "${varRef}" referenced in expressions but not declared in ${baseName}.xaml — could not auto-declare or degrade`,
              severity: "warning",
            });
          }
        }
      }
    }

    const structuralIssues = validateXamlStructure(entry.content, baseName);
    violations.push(...structuralIssues);
  }

  const repairedViolationIndices = new Set<number>();
  const unresolvedErrors = violations.filter(v => v.severity === "error");
  for (const v of unresolvedErrors) {
    const vIdx = violations.indexOf(v);
    const entryMatch = xamlEntries.find(e => {
      const bn = (e.name.split("/").pop() || e.name).replace(/\.xaml$/i, "");
      return bn === v.workflow;
    });
    if (entryMatch) {
      if (v.type === "structural_violation") {
        const stubbed = applyStructuralDegradation(entryMatch, v);
        if (stubbed) {
          repairsApplied++;
          repairedViolationIndices.add(vIdx);
          console.log(`[Inter-Stage] Applied structural degradation for ${v.type} in ${v.workflow}`);
          continue;
        }
      }
      const todoComment = `\n    <!-- TODO [Pre-Compliance]: ${v.type} — ${v.detail.replace(/--/g, "- -")} -->`;
      const closingIdx = entryMatch.content.lastIndexOf("</Sequence>");
      if (closingIdx > 0) {
        entryMatch.content = entryMatch.content.substring(0, closingIdx) + todoComment + "\n    " + entryMatch.content.substring(closingIdx);
        repairsApplied++;
        console.log(`[Inter-Stage] Injected TODO anchor for unresolved ${v.type} in ${v.workflow}`);
      }
    }
  }

  if (violations.length > 0 && manifest) {
    for (const v of violations) {
      const entriesForWf = manifest.entries.filter(e => e.assignedWorkflow === v.workflow);
      if (entriesForWf.length === 0) continue;

      if (v.type === "xmlns_missing" || v.type === "structural_violation") {
        for (const entry of entriesForWf) {
          if (entry.status === "preserved") {
            entry.status = "degraded";
            entry.reason = v.detail;
            entry.developerAction = v.repairAction || `Fix ${v.type} in ${v.workflow}.xaml`;
            entry.corrections.push(`Pre-compliance: ${v.type} detected`);
          }
        }
      } else if (v.type === "variable_ref_missing") {
        const varMatch = v.detail.match(/Variable "([^"]+)"/);
        const varName = varMatch ? varMatch[1] : "unknown";
        let targeted = false;
        for (const entry of entriesForWf) {
          const actLower = (entry.assignedActivity || "").toLowerCase();
          if (actLower.includes(varName.toLowerCase()) || v.detail.includes(entry.assignedActivity)) {
            if (entry.status === "preserved") {
              entry.status = "degraded";
              entry.reason = v.detail;
              entry.developerAction = `Declare variable "${varName}" or update expression in ${v.workflow}.xaml`;
              entry.corrections.push(`Pre-compliance: undeclared variable "${varName}"`);
              targeted = true;
              break;
            }
          }
        }
        if (!targeted) {
          const firstPreserved = entriesForWf.find(e => e.status === "preserved");
          if (firstPreserved) {
            firstPreserved.status = "degraded";
            firstPreserved.reason = v.detail;
            firstPreserved.developerAction = v.repairAction || `Fix ${v.type} in ${v.workflow}.xaml`;
            firstPreserved.corrections.push(`Pre-compliance: ${v.type}`);
          }
        }
      }
    }
  }

  const postRepairUnresolved = violations.filter((v, idx) => {
    if (v.severity !== "error") return false;
    if (repairedViolationIndices.has(idx)) return false;
    return true;
  }).length;

  return {
    violations,
    repairsApplied,
    unresolvedCount: postRepairUnresolved,
  };
}

function extractStringValue(val: unknown): string | null {
  if (typeof val === "string") return val;
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if (obj.type === "variable" && typeof obj.name === "string") return `[${obj.name}]`;
    if (obj.type === "expression" && typeof obj.left === "string") return obj.left;
    if (obj.type === "literal" && typeof obj.value === "string") return obj.value;
    if (obj.type === "vb_expression" && typeof obj.value === "string") return obj.value;
  }
  return null;
}

const LOG_PREFIX_EXCLUSIONS = new Set([
  "INFO", "WARN", "ERROR", "FATAL", "TRACE", "DEBUG",
  "RecordOutcome", "START", "END", "STEP", "RESULT",
  "STATUS", "LOG", "AUDIT", "METRIC", "EVENT",
]);

function extractVariableReferences(expr: string): string[] {
  const strippedExpr = expr.replace(/"(?:[^"\\]|\\.)*"/g, (m) => " ".repeat(m.length));

  const refs: string[] = [];
  const bracketPattern = /\[([A-Za-z_]\w*)\]/g;
  let m;
  while ((m = bracketPattern.exec(strippedExpr)) !== null) {
    const candidate = m[1];
    if (LOG_PREFIX_EXCLUSIONS.has(candidate)) continue;
    refs.push(candidate);
  }
  return refs;
}

const BUILT_IN_VARIABLES = new Set([
  "Now", "Today", "Nothing", "True", "False", "String", "Integer", "Boolean",
  "DateTime", "TimeSpan", "Environment", "Math", "Convert", "CType", "CStr",
  "CInt", "CDbl", "CBool", "CDate",
]);

function isBuiltInVariable(name: string): boolean {
  return BUILT_IN_VARIABLES.has(name);
}

function isHighConfidenceVariableName(name: string): boolean {
  if (name.length < 2 || name.length > 80) return false;
  if (BUILT_IN_VARIABLES.has(name)) return false;
  if (/^[A-Z][A-Z_]+$/.test(name)) return false;
  if (/^(dt|str|int|bool|arr|lst|dict|io|in|out|row)[_A-Z]/.test(name)) return true;
  if (/^[a-z][a-zA-Z0-9]*$/.test(name)) return true;
  if (/^[A-Z][a-z][a-zA-Z0-9]*$/.test(name)) return true;
  if (/^[a-z]+_[a-z]+/i.test(name)) return true;
  return false;
}

const DIRECTION_NORMALIZED: Record<string, string> = {
  "in": "in",
  "out": "out",
  "in_out": "in_out",
  "InArgument": "in",
  "OutArgument": "out",
  "InOutArgument": "in_out",
  "in/out": "in_out",
};

function normalizeDirection(dir: string): string {
  return DIRECTION_NORMALIZED[dir] || dir.toLowerCase();
}

function validateArgumentCompatibility(
  callerWf: string,
  targetWf: string,
  targetArgs: Array<{ name: string; direction: string; type: string }>,
  callerArgBindings: unknown,
  stepIdx: number,
): InterStageViolation[] {
  const violations: InterStageViolation[] = [];

  for (const arg of targetArgs) {
    if (!arg.name || arg.name.trim() === "") {
      violations.push({
        type: "argument_mismatch",
        workflow: callerWf,
        stepIndex: stepIdx,
        detail: `InvokeWorkflowFile to ${targetWf}: argument has empty name`,
        severity: "warning",
      });
      continue;
    }

    const dir = normalizeDirection(arg.direction);
    if (dir === "in" || dir === "in_out") {
      if (!callerArgBindings || typeof callerArgBindings !== "object") {
        violations.push({
          type: "argument_mismatch",
          workflow: callerWf,
          stepIndex: stepIdx,
          detail: `InvokeWorkflowFile to ${targetWf}: required ${arg.direction} argument "${arg.name}" (${arg.type}) has no binding — Arguments block is missing entirely in caller ${callerWf}`,
          severity: "warning",
          repairAction: `Add Arguments block with binding for "${arg.name}" in InvokeWorkflowFile to ${targetWf} within ${callerWf}.xaml`,
        });
      } else {
        const bindings = callerArgBindings as Record<string, unknown>;
        const binding = bindings[arg.name];
        if (binding === undefined || binding === null || binding === "") {
          violations.push({
            type: "argument_mismatch",
            workflow: callerWf,
            stepIndex: stepIdx,
            detail: `InvokeWorkflowFile to ${targetWf}: required ${arg.direction} argument "${arg.name}" (${arg.type}) has no binding in caller ${callerWf}`,
            severity: "warning",
            repairAction: `Add binding for argument "${arg.name}" in InvokeWorkflowFile to ${targetWf} within ${callerWf}.xaml`,
          });
        } else if (binding && typeof binding === "object") {
          const bindObj = binding as Record<string, unknown>;
          const bindDir = bindObj.direction ? normalizeDirection(String(bindObj.direction)) : "";
          if (bindDir && bindDir !== dir) {
            violations.push({
              type: "argument_direction_mismatch",
              workflow: callerWf,
              stepIndex: stepIdx,
              detail: `InvokeWorkflowFile to ${targetWf}: argument "${arg.name}" direction mismatch — target declares ${arg.direction} but caller binds as ${bindObj.direction}`,
              severity: "error",
              repairAction: `Fix argument direction for "${arg.name}" in InvokeWorkflowFile to ${targetWf} within ${callerWf}.xaml to match target's ${arg.direction}`,
            });
          }
          const bindType = bindObj.type ? normalizeType(String(bindObj.type)) : "";
          const targetType = normalizeType(arg.type);
          if (bindType && targetType && bindType !== targetType && !isCompatibleType(bindType, targetType)) {
            violations.push({
              type: "argument_type_mismatch",
              workflow: callerWf,
              stepIndex: stepIdx,
              detail: `InvokeWorkflowFile to ${targetWf}: argument "${arg.name}" type mismatch — target declares ${arg.type} but caller binds as ${bindObj.type}`,
              severity: "error",
              repairAction: `Fix argument type for "${arg.name}" in InvokeWorkflowFile to ${targetWf} within ${callerWf}.xaml to match target's ${arg.type}`,
            });
          }
        }
      }
    }
  }

  return violations;
}

function normalizeType(t: string): string {
  const lower = t.toLowerCase().replace(/^system\./, "");
  const typeMap: Record<string, string> = {
    "string": "string", "int32": "int32", "int64": "int64", "boolean": "boolean",
    "double": "double", "decimal": "decimal", "datetime": "datetime",
    "object": "object", "datatable": "datatable",
  };
  return typeMap[lower] || lower;
}

function isCompatibleType(a: string, b: string): boolean {
  const numericTypes = new Set(["int32", "int64", "double", "decimal"]);
  if (numericTypes.has(a) && numericTypes.has(b)) return true;
  if (a === "object" || b === "object") return true;
  return false;
}

function extractUsedPrefixes(xml: string): Set<string> {
  const prefixes = new Set<string>();
  const elementPattern = /<([A-Za-z][\w]*):[\w]/g;
  let m;
  while ((m = elementPattern.exec(xml)) !== null) {
    prefixes.add(m[1]);
  }
  return prefixes;
}

function extractDeclaredPrefixes(xml: string): Set<string> {
  const prefixes = new Set<string>();
  const xmlnsPattern = /xmlns:([A-Za-z][\w]*)=/g;
  let m;
  while ((m = xmlnsPattern.exec(xml)) !== null) {
    prefixes.add(m[1]);
  }
  prefixes.add("xml");
  return prefixes;
}

function isBuiltInXmlPrefix(prefix: string): boolean {
  return prefix === "x" || prefix === "xml" || prefix === "xmlns";
}

const KNOWN_XMLNS_DECLARATIONS: Record<string, string> = {
  "ui": "http://schemas.uipath.com/workflow/activities",
  "sap": "http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation",
  "sap2010": "http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation",
  "scg": "clr-namespace:System.Collections.Generic;assembly=mscorlib",
  "sco": "clr-namespace:System.Collections.ObjectModel;assembly=mscorlib",
  "mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
  "mva": "clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities",
  "local": "clr-namespace:",
};

function tryInjectXmlnsDeclaration(entry: { content: string }, prefix: string): boolean {
  const knownUri = KNOWN_XMLNS_DECLARATIONS[prefix];
  if (!knownUri) return false;

  const rootTagMatch = entry.content.match(/^(\s*<[A-Za-z][\w:.]*)([\s>])/);
  if (!rootTagMatch) return false;

  const declaration = ` xmlns:${prefix}="${knownUri}"`;
  const insertPos = rootTagMatch.index! + rootTagMatch[1].length;
  entry.content = entry.content.substring(0, insertPos) + declaration + entry.content.substring(insertPos);
  return true;
}

function extractDeclaredVariablesFromXaml(xml: string): Set<string> {
  const vars = new Set<string>();
  const varPattern = /<Variable\s[^>]*?Name="([^"]+)"/g;
  let m;
  while ((m = varPattern.exec(xml)) !== null) {
    vars.add(m[1]);
  }
  const argInPattern = /<x:Property\s[^>]*?Name="([^"]+)"/g;
  while ((m = argInPattern.exec(xml)) !== null) {
    vars.add(m[1]);
  }
  return vars;
}

function extractReferencedVariablesFromXaml(xml: string): Set<string> {
  const vars = new Set<string>();
  const exprAttrPattern = /(?:Condition|Value|Expression|Message|Text|To|FileName|WorkflowFileName)="([^"]+)"/g;
  let m;
  while ((m = exprAttrPattern.exec(xml)) !== null) {
    const expr = m[1];
    const bracketVars = expr.match(/\[([A-Za-z_]\w*)\]/g);
    if (bracketVars) {
      for (const bv of bracketVars) {
        vars.add(bv.slice(1, -1));
      }
    }
  }

  const outArgPattern = /<OutArgument[^>]*>\[([A-Za-z_]\w*)\]<\/OutArgument>/g;
  while ((m = outArgPattern.exec(xml)) !== null) {
    vars.add(m[1]);
  }
  const outArgAttrPattern = /<OutArgument[^>]*x:TypeArguments="[^"]*"[^>]*>\[([A-Za-z_]\w*)\]/g;
  while ((m = outArgAttrPattern.exec(xml)) !== null) {
    vars.add(m[1]);
  }

  return vars;
}

const SIMPLE_TYPE_TO_XAML: Record<string, string> = {
  "String": "x:String", "Boolean": "x:Boolean", "Int32": "x:Int32",
  "Int64": "x:Int64", "Double": "x:Double", "Decimal": "x:Decimal",
  "Object": "x:Object", "DataTable": "scg2:DataTable", "DataRow": "scg2:DataRow",
  "DateTime": "s:DateTime", "TimeSpan": "s:TimeSpan",
  "System.String": "x:String", "System.Boolean": "x:Boolean", "System.Int32": "x:Int32",
  "System.Int64": "x:Int64", "System.Double": "x:Double", "System.Decimal": "x:Decimal",
  "System.Object": "x:Object", "System.Data.DataTable": "scg2:DataTable",
  "System.Data.DataRow": "scg2:DataRow", "System.DateTime": "s:DateTime",
  "System.TimeSpan": "s:TimeSpan",
};

function inferXamlTypeFromCatalogContext(varName: string, xmlContent: string): string | null {
  const outArgPattern = new RegExp(
    `<OutArgument[^>]*>\\s*\\[?${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]?\\s*</OutArgument>`,
    "g"
  );
  let oam;
  while ((oam = outArgPattern.exec(xmlContent)) !== null) {
    const preceding = xmlContent.substring(Math.max(0, oam.index - 300), oam.index);
    const actTagMatch = preceding.match(/<((?:[a-z]+:)?([A-Z]\w+))\s/g);
    if (actTagMatch && actTagMatch.length > 0) {
      const lastTag = actTagMatch[actTagMatch.length - 1];
      const classMatch = lastTag.match(/<(?:[a-z]+:)?([A-Z]\w+)/);
      if (classMatch) {
        const actClassName = classMatch[1];
        const outputType = catalogService.getActivityOutputType(actClassName);
        if (outputType && SIMPLE_TYPE_TO_XAML[outputType]) {
          return SIMPLE_TYPE_TO_XAML[outputType];
        }
      }
    }
  }

  const attrPattern = new RegExp(
    `(\\w+)="${varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
    "g"
  );
  let am;
  while ((am = attrPattern.exec(xmlContent)) !== null) {
    const propName = am[1];
    const preceding = xmlContent.substring(Math.max(0, am.index - 300), am.index);
    const actTagMatch = preceding.match(/<((?:[a-z]+:)?([A-Z]\w+))\s/g);
    if (actTagMatch && actTagMatch.length > 0) {
      const lastTag = actTagMatch[actTagMatch.length - 1];
      const classMatch = lastTag.match(/<(?:[a-z]+:)?([A-Z]\w+)/);
      if (classMatch) {
        const actClassName = classMatch[1];
        const clrType = catalogService.getPropertyClrType(actClassName, propName);
        if (clrType && SIMPLE_TYPE_TO_XAML[clrType]) {
          return SIMPLE_TYPE_TO_XAML[clrType];
        }
      }
    }
  }

  return null;
}

function inferXamlTypeForVariable(varName: string, xmlContext?: string): string | null {
  if (xmlContext) {
    const catalogType = inferXamlTypeFromCatalogContext(varName, xmlContext);
    if (catalogType) return catalogType;
  }

  const inferredType = inferVariableTypeFromName(varName);
  if (inferredType && SIMPLE_TYPE_TO_XAML[inferredType]) return SIMPLE_TYPE_TO_XAML[inferredType];
  return null;
}

function tryInjectVariableDeclaration(entry: { content: string }, varName: string): boolean {
  const existingArgs = new Set<string>();
  const argPattern = /<x:Property\s[^>]*?Name="([^"]+)"/g;
  let argMatch;
  while ((argMatch = argPattern.exec(entry.content)) !== null) {
    existingArgs.add(argMatch[1]);
  }
  if (existingArgs.has(varName)) return true;

  const xamlType = inferXamlTypeForVariable(varName, entry.content);
  if (!xamlType) {
    console.log(`[XAML-Reconciliation] Skipping variable "${varName}" — no high-confidence type inference available (no catalog context or naming convention match)`);
    return false;
  }

  const sequenceVarsPattern = /(<Sequence\.Variables>)([\s\S]*?)(<\/Sequence\.Variables>)/;
  const match = sequenceVarsPattern.exec(entry.content);
  if (match) {
    const variableDecl = `\n      <Variable x:TypeArguments="${xamlType}" Name="${varName}" />`;
    entry.content = entry.content.substring(0, match.index + match[1].length) +
      match[2] + variableDecl +
      entry.content.substring(match.index + match[1].length + match[2].length);
    return true;
  }
  return false;
}

function degradeUndeclaredVariableReferences(entry: { content: string }, varName: string): boolean {
  const escapedName = varName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let modified = false;

  const typedArgPattern = new RegExp(
    `<(Out|In)Argument\\s+x:TypeArguments="([^"]*)"[^>]*>\\s*\\[?${escapedName}\\]?\\s*</(Out|In)Argument>`,
    'g'
  );
  let tam;
  const typedArgMatches: Array<{ full: string; typeArg: string; pos: number }> = [];
  while ((tam = typedArgPattern.exec(entry.content)) !== null) {
    typedArgMatches.push({ full: tam[0], typeArg: tam[2], pos: tam.index });
  }

  for (let i = typedArgMatches.length - 1; i >= 0; i--) {
    const m = typedArgMatches[i];
    const isStringType = m.typeArg === "x:String" || m.typeArg === "s:String";

    if (isStringType) {
      const replacement = m.full.replace(
        new RegExp(`\\[?${escapedName}\\]?`),
        `"TODO - undeclared variable ${varName}"`
      );
      entry.content = entry.content.substring(0, m.pos) + replacement + entry.content.substring(m.pos + m.full.length);
      modified = true;
    } else {
      const preceding = entry.content.substring(Math.max(0, m.pos - 500), m.pos);
      const actTagMatch = preceding.match(/<((?:[a-z]+:)?[A-Z]\w+)\s[^>]*$/);
      if (actTagMatch) {
        const actTag = actTagMatch[1];
        const fullTagStart = preceding.lastIndexOf("<" + actTag);
        if (fullTagStart >= 0) {
          const absStart = Math.max(0, m.pos - 500) + fullTagStart;
          const afterStart = entry.content.substring(absStart);

          const closeTagPattern = new RegExp(`</${actTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`);
          const closeMatch = closeTagPattern.exec(afterStart);
          if (closeMatch) {
            const fullActivity = afterStart.substring(0, closeMatch.index + closeMatch[0].length);
            const dnMatch = fullActivity.match(/DisplayName="([^"]*)"/);
            const displayName = dnMatch ? dnMatch[1] : actTag;
            const stub =
              `<ui:Comment DisplayName="[DEGRADED] ${displayName} — undeclared typed variable ${varName}">\n` +
              `  <ui:Comment.Body>\n` +
              `    <InArgument x:TypeArguments="x:String">"Activity ${actTag} referenced undeclared variable '${varName}' (type: ${m.typeArg}) and was replaced with a developer handoff stub."</InArgument>\n` +
              `  </ui:Comment.Body>\n` +
              `</ui:Comment>\n` +
              `<ui:LogMessage Level="Warn" Message="&quot;[DEGRADED] ${displayName} requires developer implementation — undeclared variable ${varName} (${m.typeArg})&quot;" />`;
            entry.content = entry.content.substring(0, absStart) + stub + entry.content.substring(absStart + fullActivity.length);
            modified = true;
            continue;
          }
        }
      }
      const replacement = m.full.replace(
        new RegExp(`\\[?${escapedName}\\]?`),
        `Nothing`
      );
      entry.content = entry.content.substring(0, m.pos) + replacement + entry.content.substring(m.pos + m.full.length);
      modified = true;
    }
  }

  const bracketPattern = new RegExp(`\\[${escapedName}\\]`, 'g');
  if (bracketPattern.test(entry.content)) {
    entry.content = entry.content.replace(bracketPattern, `"TODO - undeclared variable ${varName}"`);
    modified = true;
  }

  const STRING_ATTR_CONTEXTS = new Set([
    "Subject", "Body", "Message", "Text", "To", "Value", "Content",
    "DisplayName", "FileName", "FilePath", "FolderPath", "Url", "MailFolder",
    "Account", "Password", "Input", "Output", "Result",
  ]);
  const attrPattern = new RegExp(`(\\w+)="${escapedName}"`, 'g');
  let attrMatch;
  const attrReplacements: Array<{ full: string; propName: string; pos: number }> = [];
  while ((attrMatch = attrPattern.exec(entry.content)) !== null) {
    attrReplacements.push({ full: attrMatch[0], propName: attrMatch[1], pos: attrMatch.index });
  }
  for (let i = attrReplacements.length - 1; i >= 0; i--) {
    const ar = attrReplacements[i];
    if (STRING_ATTR_CONTEXTS.has(ar.propName) || ar.propName.endsWith("Name") || ar.propName.endsWith("Text") || ar.propName.endsWith("Path")) {
      const replacement = `${ar.propName}="TODO - undeclared variable ${varName}"`;
      entry.content = entry.content.substring(0, ar.pos) + replacement + entry.content.substring(ar.pos + ar.full.length);
      modified = true;
    } else {
      const preceding = entry.content.substring(Math.max(0, ar.pos - 400), ar.pos);
      const actTagMatch = preceding.match(/<((?:[a-z]+:)?([A-Z]\w+))\s/g);
      const actClassName = actTagMatch ? actTagMatch[actTagMatch.length - 1].match(/<(?:[a-z]+:)?([A-Z]\w+)/)?.[1] || "" : "";
      const isString = actClassName ? catalogService.isPropertyStringTyped(actClassName, ar.propName) : true;
      if (isString) {
        const replacement = `${ar.propName}="TODO - undeclared variable ${varName}"`;
        entry.content = entry.content.substring(0, ar.pos) + replacement + entry.content.substring(ar.pos + ar.full.length);
        modified = true;
      } else {
        entry.content = entry.content.substring(0, ar.pos) + `${ar.propName}="Nothing"` + entry.content.substring(ar.pos + ar.full.length);
        modified = true;
      }
    }
  }

  return modified;
}

function validateXamlStructure(xml: string, baseName: string): InterStageViolation[] {
  const violations: InterStageViolation[] = [];

  const selfClosedEmptySeqs = xml.match(/<Sequence[^>]*DisplayName="([^"]*)"\s*\/>/g) || [];
  for (const seq of selfClosedEmptySeqs) {
    const dnMatch = seq.match(/DisplayName="([^"]*)"/);
    if (dnMatch) {
      violations.push({
        type: "structural_violation",
        workflow: baseName,
        detail: `Empty self-closing Sequence "${dnMatch[1]}" in ${baseName}.xaml — may indicate missing content`,
        severity: "warning",
      });
    }
  }

  if (xml.includes("<?xml")) {
    const xmlDeclEnd = xml.indexOf("?>");
    if (xmlDeclEnd > 0) {
      const afterDecl = xml.substring(xmlDeclEnd + 2).trim();
      if (afterDecl.length > 0 && !afterDecl.startsWith("<")) {
        violations.push({
          type: "structural_violation",
          workflow: baseName,
          detail: `Malformed XML structure in ${baseName}.xaml — content after XML declaration is not a valid element`,
          severity: "error",
        });
      }
    }
  }

  return violations;
}

function applyStructuralDegradation(
  entry: { name: string; content: string },
  violation: InterStageViolation,
): boolean {
  const baseName = (entry.name.split("/").pop() || entry.name).replace(/\.xaml$/i, "");

  if (violation.detail.includes("Empty self-closing Sequence")) {
    const dnMatch = violation.detail.match(/Sequence "([^"]+)"/);
    if (dnMatch) {
      const displayName = dnMatch[1];
      const selfClosingPattern = new RegExp(
        `<Sequence([^>]*DisplayName="${displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*)/>`,
      );
      const replacement = `<Sequence$1>\n        <Sequence.Variables />\n        <!-- DEGRADED: Empty sequence "${displayName}" stubbed with TODO placeholder -->\n      </Sequence>`;
      const updated = entry.content.replace(selfClosingPattern, replacement);
      if (updated !== entry.content) {
        entry.content = updated;
        return true;
      }
    }
  }

  if (violation.detail.includes("Malformed XML structure")) {
    const xmlDeclEnd = entry.content.indexOf("?>");
    if (xmlDeclEnd > 0) {
      const afterDecl = entry.content.substring(xmlDeclEnd + 2).trim();
      if (afterDecl.length > 0 && !afterDecl.startsWith("<")) {
        const firstElementIdx = afterDecl.indexOf("<");
        if (firstElementIdx > 0) {
          entry.content = entry.content.substring(0, xmlDeclEnd + 2) + "\n" + afterDecl.substring(firstElementIdx);
          return true;
        }
      }
    }
  }

  return false;
}
