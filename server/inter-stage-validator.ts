import type { TraceabilityManifest } from "./traceability-manifest";

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
        if (isHighConfidenceVariableName(varRef)) {
          const repaired = tryInjectVariableDeclaration(entry, varRef);
          if (repaired) {
            repairsApplied++;
            declaredVarsInXaml.add(varRef);
            console.log(`[Inter-Stage] Auto-injected variable declaration for "${varRef}" in ${baseName}`);
          } else {
            violations.push({
              type: "variable_ref_missing",
              workflow: baseName,
              detail: `Variable "${varRef}" referenced in expressions but not declared in ${baseName}.xaml — no Sequence.Variables block found for injection`,
              severity: "warning",
            });
          }
        } else {
          violations.push({
            type: "variable_ref_missing",
            workflow: baseName,
            detail: `Variable "${varRef}" referenced in expressions but not declared in ${baseName}.xaml — name does not match variable naming conventions`,
            severity: "warning",
          });
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

function extractVariableReferences(expr: string): string[] {
  const refs: string[] = [];
  const bracketPattern = /\[([A-Za-z_]\w*)\]/g;
  let m;
  while ((m = bracketPattern.exec(expr)) !== null) {
    refs.push(m[1]);
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
  return vars;
}

function tryInjectVariableDeclaration(entry: { content: string }, varName: string): boolean {
  const sequenceVarsPattern = /(<Sequence\.Variables>)([\s\S]*?)(<\/Sequence\.Variables>)/;
  const match = sequenceVarsPattern.exec(entry.content);
  if (match) {
    const variableDecl = `\n      <Variable x:TypeArguments="x:String" Name="${varName}" />`;
    entry.content = entry.content.substring(0, match.index + match[1].length) +
      match[2] + variableDecl +
      entry.content.substring(match.index + match[1].length + match[2].length);
    return true;
  }
  return false;
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
