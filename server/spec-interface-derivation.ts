/**
 * Pre-emission spec-level interface derivation.
 *
 * Design note — relationship to buildCrossWorkflowArgContracts:
 * buildCrossWorkflowArgContracts (package-assembler.ts) is a POST-emission pass
 * that operates on emitted XAML content strings, parsing <InvokeWorkflowFile>
 * XML elements from rendered output. It cannot be reused here because this module
 * runs PRE-emission on the spec tree (WorkflowSpec/WorkflowNode structures) before
 * any XAML has been generated. The two passes share the same harvesting pattern
 * (caller-side invoke bindings → callee interface declarations) and the same
 * conflict-detection semantics (direction/type mismatch → withhold), but the
 * input representations are fundamentally different:
 *   - buildCrossWorkflowArgContracts: XAML strings, regex/XML parsing
 *   - deriveSpecInterfaces: WorkflowNode trees, attribute map traversal
 * Extracting shared primitives would require an abstraction layer over both
 * representations with no clear benefit given the different data models.
 */
import type { WorkflowSpec, WorkflowNode } from "./workflow-spec-types";
import { inferTypeFromPrefix } from "./shared/type-inference";

export interface CallerBinding {
  argName: string;
  direction: "InArgument" | "OutArgument" | "InOutArgument";
  type: string;
  sourceWorkflow: string;
}

export interface InterfaceDerivationDiagnostic {
  targetWorkflow: string;
  kind: "derived" | "conflict" | "incomplete" | "preserved" | "supplemented" | "framework_skip" | "unresolved_target";
  details: string;
  derivedArguments?: Array<{ name: string; direction: string; type: string }>;
  withheldArguments?: string[];
  conflictDetails?: string[];
}

export interface InterfaceDerivationResult {
  derivedCount: number;
  supplementedCount: number;
  conflictCount: number;
  skippedCount: number;
  incompleteCount: number;
  diagnostics: InterfaceDerivationDiagnostic[];
}

const FRAMEWORK_SCAFFOLD_NAMES = new Set([
  "initallsettings",
  "initallapplications",
  "gettransactiondata",
  "settransactionstatus",
  "closeapplications",
  "closeallapplications",
  "killallprocesses",
  "framework/initallsettings",
  "framework/gettransactiondata",
  "framework/settransactionstatus",
  "framework/closeapplications",
  "framework/killallprocesses",
]);

function normalizeTargetName(raw: string): string {
  return raw
    .replace(/\.xaml$/i, "")
    .replace(/\\/g, "/")
    .replace(/^[./]+/, "")
    .replace(/\s+/g, "_");
}

function stripDirectionPrefix(name: string): string {
  return name.replace(/^(in_|out_|io_)/i, "");
}

function inferDirectionFromPrefix(name: string): "InArgument" | "OutArgument" | "InOutArgument" {
  const lower = name.toLowerCase();
  if (lower.startsWith("out_")) return "OutArgument";
  if (lower.startsWith("io_")) return "InOutArgument";
  return "InArgument";
}

function isArgumentNamedBinding(name: string): boolean {
  return /^(in_|out_|io_)/i.test(name);
}

function decomposeDictionaryPairsFromSpec(rawArgs: string): Array<{ argName: string; argValue: string }> {
  const dictPattern = /Dictionary\s*\(\s*Of\s+String\s*,\s*Object\s*\)\s*From\s*\{([\s\S]*)\}/i;
  const dictMatch = rawArgs.match(dictPattern);
  if (!dictMatch) return [];

  const pairs: Array<{ argName: string; argValue: string }> = [];
  const content = dictMatch[1].trim();

  let depth = 0;
  let current = "";
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === "{") {
      depth++;
      current += ch;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        current += ch;
        const trimmed = current.trim();
        if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
          const inner = trimmed.slice(1, -1).trim();
          const pairMatch = inner.match(/^\s*"([^"]+)"\s*,\s*([\s\S]+?)\s*$/);
          if (pairMatch) {
            pairs.push({ argName: pairMatch[1].trim(), argValue: pairMatch[2].trim() });
          }
        }
        current = "";
      } else {
        current += ch;
      }
    } else {
      if (depth > 0) {
        current += ch;
      } else if (ch === "{") {
        depth++;
        current = ch;
      }
    }
  }

  return pairs;
}

function harvestCallerBindingsFromInvokeNode(
  node: WorkflowNode,
  sourceWorkflowName: string,
  targetMap: Map<string, CallerBinding[]>,
  skippedUnprefixed?: Array<{ targetKey: string; entryName: string; sourceWorkflow: string }>,
): void {
  if (node.kind !== "activity") return;
  if (node.template !== "InvokeWorkflowFile") return;

  const props = node.properties || {};
  let targetFile = "";
  for (const key of ["WorkflowFileName", "workflowFileName"]) {
    if (props[key]) {
      const val = typeof props[key] === "string" ? props[key] as string : "";
      targetFile = val.replace(/&quot;/g, "").replace(/^"+|"+$/g, "").trim();
      break;
    }
  }
  if (!targetFile) return;

  const targetName = normalizeTargetName(targetFile);
  const targetKey = targetName.toLowerCase();

  if (!targetMap.has(targetKey)) {
    targetMap.set(targetKey, []);
  }
  const bindings = targetMap.get(targetKey)!;

  const rawArgs = typeof props["Arguments"] === "string" ? props["Arguments"] as string :
                  typeof props["arguments"] === "string" ? props["arguments"] as string : "";
  if (rawArgs) {
    const dictPairs = decomposeDictionaryPairsFromSpec(rawArgs);
    for (const pair of dictPairs) {
      if (!isArgumentNamedBinding(pair.argName)) {
        if (skippedUnprefixed) {
          skippedUnprefixed.push({ targetKey, entryName: pair.argName, sourceWorkflow: sourceWorkflowName });
        }
        continue;
      }
      const direction = inferDirectionFromPrefix(pair.argName);
      const cleanVal = pair.argValue.replace(/^\[|\]$/g, "").trim();
      const type = inferTypeFromPrefix(cleanVal) || "";
      bindings.push({ argName: pair.argName, direction, type, sourceWorkflow: sourceWorkflowName });
    }
  }

  for (const [key, val] of Object.entries(props)) {
    if (key === "WorkflowFileName" || key === "workflowFileName" ||
        key === "DisplayName" || key === "displayName" ||
        key === "ContinueOnError" || key === "continueOnError" ||
        key === "Timeout" || key === "timeout" ||
        key === "Isolated" || key === "isolated" ||
        key === "Arguments" || key === "arguments") continue;

    if (isArgumentNamedBinding(key)) {
      const direction = inferDirectionFromPrefix(key);
      const strVal = typeof val === "string" ? val : String(val);
      const cleanVal = strVal.replace(/^\[|\]$/g, "").trim();
      const type = inferTypeFromPrefix(cleanVal) || "";
      const alreadyHas = bindings.some(b => b.argName.toLowerCase() === key.toLowerCase() && b.sourceWorkflow === sourceWorkflowName);
      if (!alreadyHas) {
        bindings.push({ argName: key, direction, type, sourceWorkflow: sourceWorkflowName });
      }
    }
  }
}

function walkNodes(nodes: WorkflowNode[], callback: (node: WorkflowNode) => void): void {
  for (const node of nodes) {
    callback(node);
    const childArrays: (WorkflowNode[] | undefined)[] = [];
    switch (node.kind) {
      case "sequence":
        childArrays.push(node.children);
        break;
      case "tryCatch":
        childArrays.push(node.tryChildren, node.catchChildren, node.finallyChildren);
        break;
      case "if":
        childArrays.push(node.thenChildren, node.elseChildren);
        break;
      case "while":
      case "forEach":
      case "retryScope":
        childArrays.push(node.bodyChildren);
        break;
    }
    for (const arr of childArrays) {
      if (arr) walkNodes(arr, callback);
    }
  }
}

export function deriveSpecInterfaces(
  specs: Array<{ name: string; spec: WorkflowSpec }>,
): InterfaceDerivationResult {
  const diagnostics: InterfaceDerivationDiagnostic[] = [];
  let derivedCount = 0;
  let supplementedCount = 0;
  let conflictCount = 0;
  let skippedCount = 0;
  let incompleteCount = 0;

  const specLookup = new Map<string, { name: string; spec: WorkflowSpec }>();
  for (const entry of specs) {
    const key = entry.name.replace(/\s+/g, "_").toLowerCase();
    specLookup.set(key, entry);
  }

  const callerEvidence = new Map<string, CallerBinding[]>();
  const skippedUnprefixed: Array<{ targetKey: string; entryName: string; sourceWorkflow: string }> = [];

  for (const entry of specs) {
    const children = entry.spec.rootSequence?.children;
    if (!children) continue;
    walkNodes(children, (node) => {
      harvestCallerBindingsFromInvokeNode(node, entry.name, callerEvidence, skippedUnprefixed);
    });
  }

  for (const skipped of skippedUnprefixed) {
    diagnostics.push({
      targetWorkflow: skipped.targetKey,
      kind: "incomplete",
      details: `Dictionary entry "${skipped.entryName}" in caller "${skipped.sourceWorkflow}" lacks direction prefix (in_/out_/io_) — skipped, no direction signal`,
      withheldArguments: [skipped.entryName],
    });
    incompleteCount++;
  }

  for (const [targetKey, bindings] of Array.from(callerEvidence.entries())) {
    if (bindings.length === 0) continue;

    let targetEntry = specLookup.get(targetKey);
    if (!targetEntry) {
      const withoutPath = targetKey.replace(/^.*\//, "");
      targetEntry = specLookup.get(withoutPath);
    }

    const isFrameworkScaffold = FRAMEWORK_SCAFFOLD_NAMES.has(targetKey) ||
      FRAMEWORK_SCAFFOLD_NAMES.has(targetKey.replace(/^.*\//, ""));

    if (isFrameworkScaffold) {
      skippedCount++;
      diagnostics.push({
        targetWorkflow: targetKey,
        kind: "framework_skip",
        details: `Framework scaffold workflow "${targetKey}" — skipping derivation (framework-owned interface)`,
      });
      continue;
    }

    if (!targetEntry) {
      skippedCount++;
      diagnostics.push({
        targetWorkflow: targetKey,
        kind: "unresolved_target",
        details: `Target workflow "${targetKey}" not found in spec set — cannot derive interface`,
      });
      continue;
    }

    applyDerivation(targetEntry, bindings, diagnostics);
  }

  function applyDerivation(
    targetEntry: { name: string; spec: WorkflowSpec },
    bindings: CallerBinding[],
    diags: InterfaceDerivationDiagnostic[],
  ): void {
    if (!targetEntry.spec.arguments) {
      targetEntry.spec.arguments = [];
    }
    const existingArgs = targetEntry.spec.arguments;
    const existingArgNames = new Set(existingArgs.map(a => a.name.toLowerCase()));
    const existingBaseNames = new Map<string, { name: string; direction: string; type: string }>();
    for (const arg of existingArgs) {
      existingBaseNames.set(stripDirectionPrefix(arg.name).toLowerCase(), { name: arg.name, direction: arg.direction, type: arg.type });
    }

    const argCandidates = new Map<string, CallerBinding[]>();
    for (const binding of bindings) {
      const key = binding.argName.toLowerCase();
      if (!argCandidates.has(key)) {
        argCandidates.set(key, []);
      }
      argCandidates.get(key)!.push(binding);
    }

    const baseNameGroups = new Map<string, CallerBinding[]>();
    for (const binding of bindings) {
      const base = stripDirectionPrefix(binding.argName).toLowerCase();
      if (!baseNameGroups.has(base)) {
        baseNameGroups.set(base, []);
      }
      baseNameGroups.get(base)!.push(binding);
    }

    const baseNameConflicts = new Set<string>();
    for (const [base, group] of Array.from(baseNameGroups.entries())) {
      const directions = new Set(group.map(b => b.direction));
      if (directions.size > 1) {
        baseNameConflicts.add(base);
        conflictCount++;
        const argNames = Array.from(new Set(group.map(b => b.argName)));
        diags.push({
          targetWorkflow: targetEntry.name,
          kind: "conflict",
          details: `Base argument "${base}" has conflicting directions across callers: ${group.map(b => `${b.sourceWorkflow}→${b.argName}(${b.direction})`).join(", ")}. Not auto-declaring any variant.`,
          withheldArguments: argNames,
          conflictDetails: group.map(b => `${b.sourceWorkflow}→${b.argName}(${b.direction})`),
        });
      }
    }

    const newArgs: Array<{ name: string; direction: "InArgument" | "OutArgument" | "InOutArgument"; type: string }> = [];
    const withheld: string[] = [];

    for (const [argKey, argBindings] of Array.from(argCandidates.entries())) {
      const canonicalName = argBindings[0].argName;
      const baseName = stripDirectionPrefix(canonicalName).toLowerCase();

      if (baseNameConflicts.has(baseName)) {
        withheld.push(canonicalName);
        continue;
      }

      if (existingArgNames.has(argKey)) {
        const existingArg = existingArgs.find(a => a.name.toLowerCase() === argKey);
        if (existingArg) {
          const directions = new Set(argBindings.map(b => b.direction));
          if (directions.size === 1) {
            const callerDir = argBindings[0].direction;
            if (callerDir !== existingArg.direction) {
              diags.push({
                targetWorkflow: targetEntry.name,
                kind: "conflict",
                details: `Argument "${canonicalName}" has conflicting direction: caller=${callerDir}, existing=${existingArg.direction}. Preserving existing declaration.`,
                conflictDetails: [`direction: caller=${callerDir} vs existing=${existingArg.direction}`],
              });
              conflictCount++;
            }
          }

          const callerTypes = new Set(argBindings.map(b => b.type).filter(t => t !== ""));
          const callerTypeArr = Array.from(callerTypes);
          if (callerTypeArr.length === 1 && existingArg.type) {
            const callerType = callerTypeArr[0];
            if (callerType.toLowerCase() !== existingArg.type.toLowerCase()) {
              diags.push({
                targetWorkflow: targetEntry.name,
                kind: "conflict",
                details: `Argument "${canonicalName}" has conflicting type: caller=${callerType}, existing=${existingArg.type}. Preserving existing declaration.`,
                conflictDetails: [`type: caller=${callerType} vs existing=${existingArg.type}`],
              });
              conflictCount++;
            }
          }
        }
        continue;
      }

      if (existingBaseNames.has(baseName)) {
        const existingByBase = existingBaseNames.get(baseName)!;
        diags.push({
          targetWorkflow: targetEntry.name,
          kind: "conflict",
          details: `Argument "${canonicalName}" shares base name with existing "${existingByBase.name}" — not adding to avoid ambiguity. Preserving existing declaration.`,
          conflictDetails: [`base-name overlap: new="${canonicalName}" vs existing="${existingByBase.name}"`],
        });
        conflictCount++;
        continue;
      }

      const types = new Set(argBindings.map(b => b.type).filter(t => t !== ""));
      const nonEmptyTypes = Array.from(types);

      if (nonEmptyTypes.length > 1) {
        withheld.push(canonicalName);
        diags.push({
          targetWorkflow: targetEntry.name,
          kind: "conflict",
          details: `Argument "${canonicalName}" has conflicting types from callers: ${argBindings.map(b => `${b.sourceWorkflow}→${b.type || "(unknown)"}`).join(", ")}. Not auto-declaring.`,
          withheldArguments: [canonicalName],
          conflictDetails: argBindings.map(b => `${b.sourceWorkflow}→${b.type || "(unknown)"}`),
        });
        conflictCount++;
        continue;
      }

      const resolvedType = nonEmptyTypes.length === 1 ? nonEmptyTypes[0] : "";

      if (!resolvedType) {
        withheld.push(canonicalName);
        incompleteCount++;
        diags.push({
          targetWorkflow: targetEntry.name,
          kind: "incomplete",
          details: `Argument "${canonicalName}" has no usable type evidence from callers — withholding declaration. Sources: ${argBindings.map(b => b.sourceWorkflow).join(", ")}`,
          withheldArguments: [canonicalName],
        });
        continue;
      }

      newArgs.push({
        name: canonicalName,
        direction: argBindings[0].direction,
        type: resolvedType,
      });
    }

    if (newArgs.length > 0) {
      const hadExisting = existingArgs.length > 0;

      for (const arg of newArgs) {
        targetEntry.spec.arguments.push(arg);
      }

      if (hadExisting) {
        supplementedCount += newArgs.length;
        diags.push({
          targetWorkflow: targetEntry.name,
          kind: "supplemented",
          details: `Supplemented ${newArgs.length} argument(s) from caller evidence onto existing interface (${existingArgs.length - newArgs.length} pre-existing)`,
          derivedArguments: newArgs.map(a => ({ name: a.name, direction: a.direction, type: a.type })),
          withheldArguments: withheld.length > 0 ? withheld : undefined,
        });
      } else {
        derivedCount += newArgs.length;
        diags.push({
          targetWorkflow: targetEntry.name,
          kind: "derived",
          details: `Derived ${newArgs.length} argument(s) from caller evidence`,
          derivedArguments: newArgs.map(a => ({ name: a.name, direction: a.direction, type: a.type })),
          withheldArguments: withheld.length > 0 ? withheld : undefined,
        });
      }
    }

    if (newArgs.length === 0 && withheld.length === 0 && existingArgs.length > 0) {
      diags.push({
        targetWorkflow: targetEntry.name,
        kind: "preserved",
        details: `Existing interface with ${existingArgs.length} argument(s) preserved — no new caller evidence to add`,
      });
    }
  }

  if (diagnostics.length > 0) {
    const derived = diagnostics.filter(d => d.kind === "derived");
    const supplemented = diagnostics.filter(d => d.kind === "supplemented");
    const conflicted = diagnostics.filter(d => d.kind === "conflict");
    const incomplete = diagnostics.filter(d => d.kind === "incomplete");
    console.log(
      `[UiPath] Spec interface derivation: ${derivedCount} arg(s) derived, ${supplementedCount} supplemented, ${conflictCount} conflict(s), ${incompleteCount} incomplete, ${skippedCount} skipped`
    );
    for (const d of derived) {
      console.log(`  → ${d.targetWorkflow}: derived ${d.derivedArguments?.length || 0} arg(s): [${d.derivedArguments?.map(a => `${a.name}:${a.direction}`).join(", ") || ""}]`);
    }
    for (const d of supplemented) {
      console.log(`  → ${d.targetWorkflow}: supplemented ${d.derivedArguments?.length || 0} arg(s)`);
    }
    for (const d of conflicted) {
      console.warn(`  ⚠ ${d.targetWorkflow}: ${d.details}`);
    }
    for (const d of incomplete) {
      console.warn(`  ⚠ ${d.targetWorkflow}: ${d.details}`);
    }
  }

  return { derivedCount, supplementedCount, conflictCount, skippedCount, incompleteCount, diagnostics };
}
