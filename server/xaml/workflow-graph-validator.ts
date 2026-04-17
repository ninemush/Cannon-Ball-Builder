import { REFRAMEWORK_INFRASTRUCTURE_FILES } from "../shared/reframework-constants";

export type WorkflowGraphDefectType =
  | "orphan_workflow"
  | "missing_target_workflow"
  | "unparseable_target_workflow"
  | "ambiguous_target_reference"
  | "decomposed_unwired_workflow"
  | "reframework_wiring_inconsistency"
  | "root_entrypoint_missing"
  | "graph_discontinuity";

export type WorkflowGraphSeverity = "execution_blocking" | "handoff_required";

export interface WorkflowGraphDefect {
  file: string;
  workflow: string;
  defectType: WorkflowGraphDefectType;
  referencedFrom: string | null;
  referencedTarget: string | null;
  severity: WorkflowGraphSeverity;
  detectionMethod: string;
  notes: string;
  /**
   * Task #528: workflow graph defects represent hard structural facts
   * (orphan workflow, broken/ambiguous reference, missing root). They
   * are by nature "genuine" structural issues — provenance filtering
   * does NOT apply. Field exists for taxonomy uniformity only.
   */
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export interface WorkflowGraphExclusion {
  file: string;
  reason: string;
}

export interface WorkflowGraphSummary {
  reachableCount: number;
  unreachableCount: number;
  brokenReferenceCount: number;
  ambiguousReferenceCount: number;
  exclusions: WorkflowGraphExclusion[];
  rootEntrypoint: {
    file: string;
    resolution: "explicit" | "inferred";
  };
}

export interface WorkflowGraphValidationResult {
  workflowGraphDefects: WorkflowGraphDefect[];
  hasWorkflowGraphIntegrityIssues: boolean;
  workflowGraphSummary: WorkflowGraphSummary;
}

const NON_EXECUTABLE_PATTERNS = [
  /\.dhg\.xaml$/i,
  /\.template\.xaml$/i,
  /^dhg[_-]/i,
  /^template[_-]/i,
  /\.md$/i,
  /\.json$/i,
  /\.txt$/i,
  /\.nuspec$/i,
  /\.png$/i,
  /\.jpg$/i,
  /\.svg$/i,
  /\.config$/i,
];

const DHG_CONTENT_MARKERS = [
  "DHG_ARTIFACT",
  "Developer Handoff Guide",
  "<!-- DHG",
];

const TEMPLATE_CONTENT_MARKERS = [
  "TEMPLATE_FILE",
  "<!-- Template:",
];

function classifyExclusion(name: string, content: string): string | null {
  const basename = name.split("/").pop() || name;

  if (/\.dhg\.xaml$/i.test(basename) || /^dhg[_-]/i.test(basename)) {
    return "dhg_artifact";
  }
  if (DHG_CONTENT_MARKERS.some(m => content.includes(m))) {
    return "dhg_artifact";
  }

  if (/\.template\.xaml$/i.test(basename) || /^template[_-]/i.test(basename)) {
    return "template_file";
  }
  if (TEMPLATE_CONTENT_MARKERS.some(m => content.includes(m))) {
    return "template_file";
  }

  for (const pat of NON_EXECUTABLE_PATTERNS) {
    if (pat.test(basename)) {
      return "non_executable_support";
    }
  }

  if (!basename.endsWith(".xaml")) {
    return "non_executable_support";
  }

  return null;
}

function normalizeGraphPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^[./]+/, "");
}

function stripXamlExtension(name: string): string {
  return name.replace(/\.xaml$/i, "");
}

function extractWorkflowReferences(content: string): string[] {
  const refs: string[] = [];

  const attrPattern = /WorkflowFileName="([^"]+)"/g;
  let match;
  while ((match = attrPattern.exec(content)) !== null) {
    refs.push(match[1]);
  }

  const elemPattern = /<[^:>]*:?InvokeWorkflowFile\.WorkflowFileName[^>]*>([\s\S]*?)<\/[^:>]*:?InvokeWorkflowFile\.WorkflowFileName>/g;
  while ((match = elemPattern.exec(content)) !== null) {
    const innerContent = match[1].trim();
    if (innerContent && !innerContent.startsWith("<")) {
      refs.push(innerContent);
    }
  }

  const genericElemPattern = /<InvokeWorkflowFile\.WorkflowFileName[^>]*>([\s\S]*?)<\/InvokeWorkflowFile\.WorkflowFileName>/g;
  while ((match = genericElemPattern.exec(content)) !== null) {
    const innerContent = match[1].trim();
    if (innerContent && !innerContent.startsWith("<")) {
      refs.push(innerContent);
    }
  }

  return refs;
}

interface ResolvedRef {
  resolved: string | null;
  ambiguous: boolean;
  candidates: string[];
  rawRef: string;
}

function resolveReference(
  rawRef: string,
  fileIndex: Map<string, string>,
  basenameIndex: Map<string, string[]>,
): ResolvedRef {
  const cleaned = rawRef
    .replace(/[\[\]"]/g, "")
    .replace(/&quot;/g, "")
    .trim();

  const normalized = normalizeGraphPath(cleaned);

  if (fileIndex.has(normalized)) {
    return { resolved: normalized, ambiguous: false, candidates: [normalized], rawRef };
  }

  const withExt = /\.xaml$/i.test(normalized) ? normalized : normalized + ".xaml";
  if (fileIndex.has(withExt)) {
    return { resolved: withExt, ambiguous: false, candidates: [withExt], rawRef };
  }

  const lowerMap = new Map<string, string>();
  Array.from(fileIndex.keys()).forEach(key => {
    lowerMap.set(key.toLowerCase(), key);
  });

  const lowerNorm = withExt.toLowerCase();
  if (lowerMap.has(lowerNorm)) {
    const actual = lowerMap.get(lowerNorm)!;
    return { resolved: actual, ambiguous: false, candidates: [actual], rawRef };
  }

  const basename = (withExt.split("/").pop() || withExt).toLowerCase();
  const matches = basenameIndex.get(basename) || [];
  if (matches.length === 1) {
    return { resolved: matches[0], ambiguous: false, candidates: matches, rawRef };
  }
  if (matches.length > 1) {
    return { resolved: matches[0], ambiguous: true, candidates: [...matches], rawRef };
  }

  const strippedBase = stripXamlExtension(basename);
  const fileKeys = Array.from(fileIndex.keys());
  for (let i = 0; i < fileKeys.length; i++) {
    const key = fileKeys[i];
    const keyBase = stripXamlExtension((key.split("/").pop() || key).toLowerCase());
    if (keyBase === strippedBase) {
      return { resolved: key, ambiguous: false, candidates: [key], rawRef };
    }
  }

  return { resolved: null, ambiguous: false, candidates: [], rawRef };
}

export interface StateMachineAnalysis {
  isStateMachine: boolean;
  hasStateMachineRoot: boolean;
  stateCount: number;
  transitionCount: number;
  stateNames: string[];
  invokedFromStates: Map<string, string[]>;
}

export function analyzeStateMachine(content: string): StateMachineAnalysis {
  const result: StateMachineAnalysis = {
    isStateMachine: false,
    hasStateMachineRoot: false,
    stateCount: 0,
    transitionCount: 0,
    stateNames: [],
    invokedFromStates: new Map(),
  };

  result.hasStateMachineRoot = /<StateMachine\b/i.test(content);
  if (!result.hasStateMachineRoot) {
    return result;
  }

  const statePattern = /<State\b[^>]*DisplayName="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = statePattern.exec(content)) !== null) {
    result.stateCount++;
    result.stateNames.push(match[1]);
  }

  const stateTagPattern = /<State\b/gi;
  let stateTagCount = 0;
  while (stateTagPattern.exec(content) !== null) {
    stateTagCount++;
  }
  if (stateTagCount > result.stateCount) {
    result.stateCount = stateTagCount;
  }

  const transitionPattern = /<Transition\b/gi;
  while (transitionPattern.exec(content) !== null) {
    result.transitionCount++;
  }

  result.isStateMachine = result.hasStateMachineRoot && result.stateCount >= 2;

  if (result.isStateMachine) {
    const stateBlocks = content.split(/<State\b/i);
    for (let i = 1; i < stateBlocks.length; i++) {
      const block = stateBlocks[i];
      const nameMatch = block.match(/DisplayName="([^"]*)"/);
      const stateName = nameMatch ? nameMatch[1] : `State_${i}`;
      const refs = extractWorkflowReferences(block);
      if (refs.length > 0) {
        result.invokedFromStates.set(stateName, refs);
      }
    }
  }

  return result;
}

const REFRAMEWORK_EXPECTED_WORKFLOWS = [
  "InitAllSettings.xaml",
  "GetTransactionData.xaml",
  "SetTransactionStatus.xaml",
  "CloseAllApplications.xaml",
  "KillAllProcesses.xaml",
];

const REFRAMEWORK_STATE_NAMES = new Set([
  "init", "initialization", "initialize",
  "get transaction data", "gettransactiondata",
  "process", "process transaction",
  "set transaction status", "settransactionstatus",
  "end process", "end",
]);

const REFRAMEWORK_NAMING_PATTERNS = [
  /init/i, /gettransaction/i, /settransaction/i,
  /process/i, /dispatcher/i, /performer/i,
  /closeallapplications/i, /killallprocesses/i,
];

const CRITICAL_WORKFLOW_PATTERNS = [
  /^main\.xaml$/i,
  /^process\.xaml$/i,
  /^processtransaction/i,
  /^settransactionstatus/i,
  /^gettransactiondata/i,
  /^initallapplications/i,
  /^initallapps/i,
  /^closeallapplications/i,
  /^closeallapps/i,
  /^initallsettings/i,
];

function isCriticalWorkflow(fileName: string): boolean {
  const basename = (fileName.split("/").pop() || fileName).toLowerCase();
  return CRITICAL_WORKFLOW_PATTERNS.some(p => p.test(basename));
}

export function detectReframeworkStructurally(
  mainContent: string,
  smAnalysis: StateMachineAnalysis,
  allFiles: Map<string, string>,
): {
  isReframework: boolean;
  confidence: "high" | "medium" | "low";
  missingExpected: string[];
  unwiredWorkflows: string[];
} {
  const result = {
    isReframework: false,
    confidence: "low" as "high" | "medium" | "low",
    missingExpected: [] as string[],
    unwiredWorkflows: [] as string[],
  };

  let namingScore = 0;
  const allFileNames = Array.from(allFiles.keys()).map(f => (f.split("/").pop() || f).toLowerCase());
  for (const pat of REFRAMEWORK_NAMING_PATTERNS) {
    if (allFileNames.some(f => pat.test(f))) {
      namingScore++;
    }
  }

  if (smAnalysis.isStateMachine) {
    const stateNamesLower = smAnalysis.stateNames.map(n => n.toLowerCase());
    let matchedStateNames = 0;
    for (const sn of stateNamesLower) {
      if (REFRAMEWORK_STATE_NAMES.has(sn)) {
        matchedStateNames++;
      }
    }

    const hasFrameworkStates = matchedStateNames >= 2;
    const hasTransitions = smAnalysis.transitionCount >= 3;

    if (hasFrameworkStates && hasTransitions) {
      result.isReframework = true;
      result.confidence = "high";
    } else if (smAnalysis.stateCount >= 3 && namingScore >= 3) {
      result.isReframework = true;
      result.confidence = "medium";
    }
  }

  if (!result.isReframework) {
    const reframeworkInvokeTargets = ["init.xaml", "gettransactiondata.xaml", "process.xaml", "settransactionstatus.xaml"];
    const invokeRefs = extractWorkflowReferences(mainContent).map(r => normalizeGraphPath(r).toLowerCase());
    const matchedInvokes = reframeworkInvokeTargets.filter(t => invokeRefs.some(r => r.endsWith(t))).length;

    if (matchedInvokes >= 3 && namingScore >= 3) {
      result.isReframework = true;
      result.confidence = "medium";
    } else {
      return result;
    }
  }

  const allFileLower = new Map<string, string>();
  Array.from(allFiles.keys()).forEach(key => {
    const bn = (key.split("/").pop() || key).toLowerCase();
    allFileLower.set(bn, key);
  });

  for (const expected of REFRAMEWORK_EXPECTED_WORKFLOWS) {
    const lowerExpected = expected.toLowerCase();
    if (!allFileLower.has(lowerExpected)) {
      result.missingExpected.push(expected);
    }
  }

  const allInvokedFromMain = extractWorkflowReferences(mainContent);
  const invokedSet = new Set(allInvokedFromMain.map(r => normalizeGraphPath(r).toLowerCase()));

  Array.from(smAnalysis.invokedFromStates.entries()).forEach(([, refs]) => {
    for (const ref of refs) {
      invokedSet.add(normalizeGraphPath(ref).toLowerCase());
    }
  });

  Array.from(allFiles.keys()).forEach(key => {
    const bn = (key.split("/").pop() || key).toLowerCase();
    if (bn === "main.xaml") return;
    const isFrameworkFile = REFRAMEWORK_NAMING_PATTERNS.some(p => p.test(bn));
    if (isFrameworkFile) {
      const isInvoked = invokedSet.has(bn) || invokedSet.has(stripXamlExtension(bn));
      if (!isInvoked) {
        const matchedByPath = Array.from(invokedSet).some(inv => {
          const invBn = (inv.split("/").pop() || inv).toLowerCase();
          return invBn === bn || invBn + ".xaml" === bn;
        });
        if (!matchedByPath) {
          result.unwiredWorkflows.push(key);
        }
      }
    }
  });

  return result;
}

export function validateWorkflowGraph(
  entries: { name: string; content: string }[],
): WorkflowGraphValidationResult {
  const defects: WorkflowGraphDefect[] = [];
  const exclusions: WorkflowGraphExclusion[] = [];

  const executableEntries = new Map<string, string>();
  const fileIndex = new Map<string, string>();
  const basenameIndex = new Map<string, string[]>();

  for (const entry of entries) {
    const normalizedName = normalizeGraphPath(entry.name);
    const exclusionReason = classifyExclusion(normalizedName, entry.content);
    if (exclusionReason) {
      exclusions.push({ file: normalizedName, reason: exclusionReason });
      continue;
    }

    executableEntries.set(normalizedName, entry.content);
    fileIndex.set(normalizedName, entry.content);

    const basename = (normalizedName.split("/").pop() || normalizedName).toLowerCase();
    if (!basenameIndex.has(basename)) {
      basenameIndex.set(basename, []);
    }
    basenameIndex.get(basename)!.push(normalizedName);
  }

  let rootFile: string | null = null;
  const rootResolution: "explicit" | "inferred" = "inferred";

  const execKeys = Array.from(executableEntries.keys());
  for (let i = 0; i < execKeys.length; i++) {
    const bn = (execKeys[i].split("/").pop() || execKeys[i]).toLowerCase();
    if (bn === "main.xaml") {
      rootFile = execKeys[i];
      break;
    }
  }

  if (!rootFile) {
    defects.push({
      file: "Main.xaml",
      workflow: "Main",
      defectType: "root_entrypoint_missing",
      referencedFrom: null,
      referencedTarget: null,
      severity: "execution_blocking",
      detectionMethod: "root_scan",
      notes: "Main.xaml not found in the archive — no root entry point for execution",
    });

    return {
      workflowGraphDefects: defects,
      hasWorkflowGraphIntegrityIssues: true,
      workflowGraphSummary: {
        reachableCount: 0,
        unreachableCount: executableEntries.size,
        brokenReferenceCount: 0,
        ambiguousReferenceCount: 0,
        exclusions,
        rootEntrypoint: { file: "Main.xaml", resolution: "inferred" },
      },
    };
  }

  const graph = new Map<string, string[]>();
  let brokenReferenceCount = 0;
  let ambiguousReferenceCount = 0;

  Array.from(executableEntries.entries()).forEach(([file, content]) => {
    const rawRefs = extractWorkflowReferences(content);
    const edges: string[] = [];

    for (const rawRef of rawRefs) {
      const resolved = resolveReference(rawRef, fileIndex, basenameIndex);

      if (resolved.ambiguous) {
        ambiguousReferenceCount++;
        defects.push({
          file,
          workflow: stripXamlExtension((file.split("/").pop() || file)),
          defectType: "ambiguous_target_reference",
          referencedFrom: file,
          referencedTarget: rawRef,
          severity: "handoff_required",
          detectionMethod: "reference_resolution",
          notes: `Reference "${rawRef}" matches multiple files: ${resolved.candidates.join(", ")}`,
        });
        if (resolved.resolved) {
          edges.push(resolved.resolved);
        }
      } else if (resolved.resolved === null) {
        brokenReferenceCount++;

        const looksUnparseable = /[\[\]{}<>]/.test(rawRef) || /\bNew\b/.test(rawRef);
        const defectType: WorkflowGraphDefectType = looksUnparseable
          ? "unparseable_target_workflow"
          : "missing_target_workflow";

        defects.push({
          file,
          workflow: stripXamlExtension((file.split("/").pop() || file)),
          defectType,
          referencedFrom: file,
          referencedTarget: rawRef,
          severity: "execution_blocking",
          detectionMethod: "reference_resolution",
          notes: looksUnparseable
            ? `Reference "${rawRef}" appears to contain an expression or malformed path — cannot resolve to a workflow file`
            : `Reference "${rawRef}" does not match any workflow file in the archive`,
        });
      } else {
        edges.push(resolved.resolved);
      }
    }

    graph.set(file, edges);
  });

  const reachable = new Set<string>();
  const queue = [rootFile];
  reachable.add(rootFile);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const edges = graph.get(current) || [];
    for (const target of edges) {
      if (!reachable.has(target) && executableEntries.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  const unreachable = new Set<string>();
  Array.from(executableEntries.keys()).forEach(file => {
    if (!reachable.has(file)) {
      unreachable.add(file);
    }
  });

  const mainContent = executableEntries.get(rootFile) || "";
  const smAnalysis = analyzeStateMachine(mainContent);
  const reframeworkResult = detectReframeworkStructurally(mainContent, smAnalysis, executableEntries);

  if (reframeworkResult.isReframework) {
    for (const missing of reframeworkResult.missingExpected) {
      const alreadyReported = defects.some(
        d => d.defectType === "missing_target_workflow" && d.referencedTarget === missing,
      );
      if (!alreadyReported) {
        defects.push({
          file: rootFile,
          workflow: "Main",
          defectType: "reframework_wiring_inconsistency",
          referencedFrom: rootFile,
          referencedTarget: missing,
          severity: "handoff_required",
          detectionMethod: `reframework_structural_${reframeworkResult.confidence}`,
          notes: `REFramework state-machine detected (confidence: ${reframeworkResult.confidence}) but expected workflow "${missing}" is missing from the archive`,
        });
      }
    }

    for (const unwired of reframeworkResult.unwiredWorkflows) {
      if (unreachable.has(unwired)) {
        const unwiredBasename = (unwired.split("/").pop() || unwired);
        const isInfraFile = Array.from(REFRAMEWORK_INFRASTRUCTURE_FILES).some(
          f => f.toLowerCase() === unwiredBasename.toLowerCase()
        );
        if (isInfraFile) continue;
        defects.push({
          file: unwired,
          workflow: stripXamlExtension(unwiredBasename),
          defectType: "reframework_wiring_inconsistency",
          referencedFrom: null,
          referencedTarget: null,
          severity: "handoff_required",
          detectionMethod: `reframework_structural_${reframeworkResult.confidence}`,
          notes: `Workflow exists and matches REFramework naming but is not invoked from any state in the state machine`,
        });
      }
    }
  }

  Array.from(unreachable).forEach(file => {
    const basename = (file.split("/").pop() || file).toLowerCase();
    const basenameOriginal = file.split("/").pop() || file;

    const alreadyReportedAsReframework = defects.some(
      d => d.file === file && d.defectType === "reframework_wiring_inconsistency",
    );
    if (alreadyReportedAsReframework) return;

    const infraMatch = Array.from(REFRAMEWORK_INFRASTRUCTURE_FILES).some(
      f => f.toLowerCase() === basenameOriginal.toLowerCase()
    );
    if (reframeworkResult.isReframework && infraMatch) {
      return;
    }

    const isDecomposedCandidate = REFRAMEWORK_NAMING_PATTERNS.some(p => p.test(basename));
    const critical = isCriticalWorkflow(file);

    if (isDecomposedCandidate && !reframeworkResult.isReframework) {
      defects.push({
        file,
        workflow: stripXamlExtension((file.split("/").pop() || file)),
        defectType: "decomposed_unwired_workflow",
        referencedFrom: null,
        referencedTarget: null,
        severity: critical ? "execution_blocking" : "handoff_required",
        detectionMethod: "bfs_reachability",
        notes: `Workflow matches a known decomposition pattern but is not reachable from ${rootFile}${critical ? " — critical workflow, package-fatal" : ""}`,
      });
    } else {
      defects.push({
        file,
        workflow: stripXamlExtension((file.split("/").pop() || file)),
        defectType: "orphan_workflow",
        referencedFrom: null,
        referencedTarget: null,
        severity: critical ? "execution_blocking" : "handoff_required",
        detectionMethod: "bfs_reachability",
        notes: `Workflow is not reachable from root entry point ${rootFile}${critical ? " — critical workflow, package-fatal" : ""}`,
      });
    }
  });

  let effectiveEntries = executableEntries;
  if (reframeworkResult.isReframework) {
    effectiveEntries = new Map<string, string>();
    Array.from(executableEntries.entries()).forEach(([key, val]) => {
      const bn = (key.split("/").pop() || key).toLowerCase();
      const isInfra = Array.from(REFRAMEWORK_INFRASTRUCTURE_FILES).some(
        f => f.toLowerCase() === bn
      );
      if (!isInfra || !unreachable.has(key)) {
        effectiveEntries.set(key, val);
      }
    });
  }
  const connectedComponents = computeConnectedComponents(effectiveEntries, graph);
  if (connectedComponents > 1 && unreachable.size > 0) {
    const alreadyHasDiscontinuity = defects.some(d => d.defectType === "graph_discontinuity");
    if (!alreadyHasDiscontinuity) {
      defects.push({
        file: rootFile,
        workflow: "Main",
        defectType: "graph_discontinuity",
        referencedFrom: null,
        referencedTarget: null,
        severity: "handoff_required",
        detectionMethod: "component_analysis",
        notes: `Workflow graph has ${connectedComponents} disconnected components — some workflows form isolated subgraphs`,
      });
    }
  }

  Array.from(basenameIndex.entries()).forEach(([basename, files]) => {
    if (files.length > 1) {
      const allExcluded = files.every(f => !executableEntries.has(f));
      if (!allExcluded) {
        const alreadyReported = defects.some(
          d => d.defectType === "ambiguous_target_reference" && d.referencedTarget?.toLowerCase() === basename,
        );
        if (!alreadyReported) {
          defects.push({
            file: files[0],
            workflow: stripXamlExtension(basename),
            defectType: "ambiguous_target_reference",
            referencedFrom: null,
            referencedTarget: basename,
            severity: "handoff_required",
            detectionMethod: "duplicate_scan",
            notes: `Multiple workflow files share the same basename "${basename}": ${files.join(", ")}`,
          });
        }
      }
    }
  });

  // Task #528: construction-site origin tagging at the producer's
  // exit boundary. Workflow-graph defects are by definition genuine
  // structural facts (orphan workflow, broken/ambiguous reference,
  // missing root) — provenance filtering does not apply.
  for (const d of defects) {
    if (d.origin) continue;
    d.origin = "genuine";
    d.originReason = `workflow-graph defect (${d.defectType}) is a hard structural fact`;
  }

  return {
    workflowGraphDefects: defects,
    hasWorkflowGraphIntegrityIssues: defects.length > 0,
    workflowGraphSummary: {
      reachableCount: reachable.size,
      unreachableCount: unreachable.size,
      brokenReferenceCount,
      ambiguousReferenceCount,
      exclusions,
      rootEntrypoint: { file: rootFile, resolution: rootResolution },
    },
  };
}

function computeConnectedComponents(
  files: Map<string, string>,
  graph: Map<string, string[]>,
): number {
  const undirected = new Map<string, Set<string>>();
  Array.from(files.keys()).forEach(file => {
    undirected.set(file, new Set());
  });
  Array.from(graph.entries()).forEach(([source, targets]) => {
    for (const target of targets) {
      if (files.has(target)) {
        undirected.get(source)?.add(target);
        undirected.get(target)?.add(source);
      }
    }
  });

  const visited = new Set<string>();
  let components = 0;

  Array.from(files.keys()).forEach(file => {
    if (visited.has(file)) return;
    components++;
    const queue = [file];
    visited.add(file);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = undirected.get(current);
      if (neighbors) {
        Array.from(neighbors).forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        });
      }
    }
  });

  return components;
}
