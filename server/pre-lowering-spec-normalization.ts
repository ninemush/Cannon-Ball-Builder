import type { WorkflowSpec, WorkflowNode, ActivityNode, TryCatchNode, SequenceNode, IfNode, WhileNode, ForEachNode, RetryScopeNode } from "./workflow-spec-types";
import { isValueIntent, type ValueIntent } from "./xaml/expression-builder";

const CRITICAL_OPERATION_TEMPLATES = new Set([
  "GmailSendMessage",
  "SendSmtpMailMessage",
  "SendOutlookMailMessage",
  "SendMail",
  "CreateFormTask",
  "WaitForFormTask",
  "CreateEntity",
  "UpdateEntity",
  "QueryEntity",
  "DeleteEntity",
  "InvokeWorkflowFile",
]);

const MAIL_SEND_TEMPLATES = new Set([
  "GmailSendMessage",
  "SendSmtpMailMessage",
  "SendOutlookMailMessage",
  "SendMail",
]);

const NARRATIVE_TRYCATCH_PATTERNS = [
  /TryCatch\s*\{/i,
  /Try:\s*\w+SendMessage/i,
  /Catches?:\s*Exception/i,
  /Send.*email.*with.*error.*handling/i,
  /narrative.*container/i,
];

export type RepresentationKind = "concrete-executable" | "narrative-container" | "ambiguous";

export interface DetectedRepresentation {
  nodeIndex: number;
  node: WorkflowNode;
  kind: RepresentationKind;
  operationType: string;
  template: string | null;
  properties: Record<string, any>;
  displayName: string;
}

export interface OperationCluster {
  operationType: string;
  representations: DetectedRepresentation[];
}

export interface FieldProvenance {
  fieldName: string;
  value: any;
  sourceRepresentationIndex: number;
  sourceKind: RepresentationKind;
  sourceTemplate: string | null;
}

export interface NormalizationResult {
  operationType: string;
  workflowName: string;
  nestingPath: string;
  representationsDetected: number;
  canonicalRepresentationIndex: number;
  canonicalKind: RepresentationKind;
  deterministicResolution: boolean;
  preservedFields: FieldProvenance[];
  droppedRepresentationIndices: number[];
  conflictFields: string[];
  rejected: boolean;
  rejectionReason: string | null;
  remediationHint: string | null;
}

export interface SpecNormalizationDiagnostics {
  perOperationResults: NormalizationResult[];
  summary: {
    totalClusters: number;
    duplicatesDetected: number;
    normalizedSuccessfully: number;
    rejectedForConflict: number;
    narrativePseudoContainersRemoved: number;
  };
}

export interface ActivePathAdoptionTraceEntry {
  workflowName: string;
  preNormalizationRepresentationCount: number;
  postNormalizationRepresentationCount: number;
  normalizedOperationIds: string[];
  loweringSawOnlyNormalizedRepresentation: boolean;
  droppedRepresentationNodeIndices: number[];
  hasRejectedClusters: boolean;
}

function extractPropertyStringValue(val: any): string | null {
  if (typeof val === "string") return val;
  if (isValueIntent(val)) {
    const vi = val as ValueIntent;
    if (vi.type === "literal") return vi.value;
    if (vi.type === "variable") return vi.name;
    if (vi.type === "vb_expression") return vi.value;
  }
  return null;
}

function isNarrativePseudoContent(value: string): boolean {
  for (const pattern of NARRATIVE_TRYCATCH_PATTERNS) {
    if (pattern.test(value)) return true;
  }
  return false;
}

function classifyActivityRepresentation(node: ActivityNode): RepresentationKind {
  const template = (node.template || "").replace(/^ui:/, "");
  if (CRITICAL_OPERATION_TEMPLATES.has(template)) {
    for (const [, val] of Object.entries(node.properties || {})) {
      const strVal = extractPropertyStringValue(val);
      if (strVal && isNarrativePseudoContent(strVal)) {
        return "narrative-container";
      }
    }
    return "concrete-executable";
  }
  return "ambiguous";
}

function classifyTryCatchRepresentation(node: TryCatchNode): RepresentationKind {
  const displayLower = (node.displayName || "").toLowerCase();
  const isNarrativeDisplayName =
    /send.*email/i.test(displayLower) ||
    /mail.*send/i.test(displayLower) ||
    /create.*task/i.test(displayLower) ||
    /invoke.*workflow/i.test(displayLower) ||
    /data.*service/i.test(displayLower) ||
    /create.*entity/i.test(displayLower) ||
    /update.*entity/i.test(displayLower) ||
    /query.*entity/i.test(displayLower) ||
    /delete.*entity/i.test(displayLower) ||
    /gmail/i.test(displayLower) ||
    /smtp/i.test(displayLower) ||
    /outlook.*mail/i.test(displayLower);

  const hasConcreteSendInTry = node.tryChildren.some(child => {
    if (child.kind === "activity") {
      const template = (child.template || "").replace(/^ui:/, "");
      return CRITICAL_OPERATION_TEMPLATES.has(template);
    }
    return false;
  });

  if (isNarrativeDisplayName && !hasConcreteSendInTry) {
    return "narrative-container";
  }

  return "ambiguous";
}

function inferOperationType(node: WorkflowNode): string | null {
  if (node.kind === "activity") {
    const template = (node.template || "").replace(/^ui:/, "");
    if (MAIL_SEND_TEMPLATES.has(template)) return "mail-send";
    if (template === "CreateFormTask" || template === "WaitForFormTask") return "action-center";
    if (["CreateEntity", "UpdateEntity", "QueryEntity", "DeleteEntity"].includes(template)) return "data-service";
    if (template === "InvokeWorkflowFile") return "invoke-workflow";
    return null;
  }

  if (node.kind === "tryCatch") {
    const displayLower = (node.displayName || "").toLowerCase();
    if (/send.*email|mail.*send|gmail|smtp|outlook.*mail/i.test(displayLower)) return "mail-send";
    if (/create.*task|action.*center|wait.*task/i.test(displayLower)) return "action-center";
    if (/data.*service|create.*entity|update.*entity|query.*entity|delete.*entity/i.test(displayLower)) return "data-service";
    if (/invoke.*workflow/i.test(displayLower)) return "invoke-workflow";
    return null;
  }

  return null;
}

function collectRepresentations(children: WorkflowNode[], recursive: boolean = false): DetectedRepresentation[] {
  const representations: DetectedRepresentation[] = [];

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    const operationType = inferOperationType(node);
    if (operationType) {
      let kind: RepresentationKind = "ambiguous";
      let template: string | null = null;
      let properties: Record<string, any> = {};
      let displayName = "";

      if (node.kind === "activity") {
        kind = classifyActivityRepresentation(node);
        template = (node.template || "").replace(/^ui:/, "");
        properties = node.properties || {};
        displayName = node.displayName || "";
      } else if (node.kind === "tryCatch") {
        kind = classifyTryCatchRepresentation(node);
        displayName = node.displayName || "";
      }

      representations.push({
        nodeIndex: i,
        node,
        kind,
        operationType,
        template,
        properties,
        displayName,
      });
    }

    if (recursive) {
      const subChildren = getChildNodes(node);
      if (subChildren.length > 0) {
        const subReps = collectRepresentations(subChildren, true);
        representations.push(...subReps);
      }
    }
  }

  return representations;
}

function getChildNodes(node: WorkflowNode): WorkflowNode[] {
  switch (node.kind) {
    case "sequence": return (node as SequenceNode).children || [];
    case "tryCatch": {
      const tc = node as TryCatchNode;
      return [...(tc.tryChildren || []), ...(tc.catchChildren || []), ...(tc.finallyChildren || [])];
    }
    case "if": {
      const ifn = node as IfNode;
      return [...(ifn.thenChildren || []), ...(ifn.elseChildren || [])];
    }
    case "while": return (node as WhileNode).bodyChildren || [];
    case "forEach": return (node as ForEachNode).bodyChildren || [];
    case "retryScope": return (node as RetryScopeNode).bodyChildren || [];
    default: return [];
  }
}

const MAX_PROXIMITY_GAP = 3;

function concretePropertiesMatch(reps: DetectedRepresentation[]): boolean {
  if (reps.length < 2) return true;
  const baseline = reps[0];
  for (let i = 1; i < reps.length; i++) {
    const other = reps[i];
    const allKeys = new Set([...Object.keys(baseline.properties), ...Object.keys(other.properties)]);
    for (const key of allKeys) {
      const baseVal = extractPropertyStringValue(baseline.properties[key]);
      const otherVal = extractPropertyStringValue(other.properties[key]);
      if (baseVal && otherVal && baseVal !== otherVal) {
        return false;
      }
    }
  }
  return true;
}

function clusterByProximityAndType(representations: DetectedRepresentation[]): OperationCluster[] {
  const sorted = [...representations].sort((a, b) => a.nodeIndex - b.nodeIndex);
  const clusters: OperationCluster[] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (assigned.has(i)) continue;
    const anchor = sorted[i];
    const clusterReps: DetectedRepresentation[] = [anchor];
    assigned.add(i);

    for (let j = i + 1; j < sorted.length; j++) {
      if (assigned.has(j)) continue;
      const candidate = sorted[j];
      if (candidate.operationType !== anchor.operationType) continue;
      const gap = candidate.nodeIndex - clusterReps[clusterReps.length - 1].nodeIndex;
      if (gap > MAX_PROXIMITY_GAP) continue;
      clusterReps.push(candidate);
      assigned.add(j);
    }

    if (clusterReps.length > 1) {
      const hasConcrete = clusterReps.some(r => r.kind === "concrete-executable");
      const hasNarrative = clusterReps.some(r => r.kind === "narrative-container");
      const concreteReps = clusterReps.filter(r => r.kind === "concrete-executable");
      const hasMultipleConcreteSameTemplate = concreteReps.length > 1 &&
        concreteReps.every(r => r.template && r.template === concreteReps[0].template);

      if (hasConcrete && hasNarrative) {
        clusters.push({ operationType: anchor.operationType, representations: clusterReps });
      } else if (hasMultipleConcreteSameTemplate && concretePropertiesMatch(concreteReps)) {
        clusters.push({ operationType: anchor.operationType, representations: clusterReps });
      }
    }
  }

  return clusters;
}

function resolvePropertyConflict(
  fieldName: string,
  concreteValue: any,
  narrativeValue: any,
): { resolved: boolean; winner: any; source: "concrete" | "narrative" } {
  const concreteStr = extractPropertyStringValue(concreteValue);
  const narrativeStr = extractPropertyStringValue(narrativeValue);

  if (!concreteStr || concreteStr.trim() === "" || concreteStr === "PLACEHOLDER" || concreteStr === '""') {
    if (narrativeStr && narrativeStr.trim() !== "" && narrativeStr !== "PLACEHOLDER" && narrativeStr !== '""') {
      return { resolved: true, winner: narrativeValue, source: "narrative" };
    }
  }

  return { resolved: true, winner: concreteValue, source: "concrete" };
}

function normalizeCluster(cluster: OperationCluster, workflowName: string, nestingPath: string): NormalizationResult {
  const concreteReps = cluster.representations.filter(r => r.kind === "concrete-executable");
  const narrativeReps = cluster.representations.filter(r => r.kind === "narrative-container");
  const totalReps = cluster.representations.length;

  if (concreteReps.length === 0) {
    return {
      operationType: cluster.operationType,
      workflowName,
      nestingPath,
      representationsDetected: totalReps,
      canonicalRepresentationIndex: cluster.representations[0].nodeIndex,
      canonicalKind: cluster.representations[0].kind,
      deterministicResolution: false,
      preservedFields: [],
      droppedRepresentationIndices: [],
      conflictFields: [],
      rejected: true,
      rejectionReason: "No concrete executable representation found in cluster",
      remediationHint: "Add a concrete executable step for this critical operation",
    };
  }

  if (concreteReps.length > 1) {
    const conflictingProperties: string[] = [];
    const first = concreteReps[0];
    for (let i = 1; i < concreteReps.length; i++) {
      const other = concreteReps[i];
      const allKeys = new Set([...Object.keys(first.properties), ...Object.keys(other.properties)]);
      for (const key of allKeys) {
        const firstVal = extractPropertyStringValue(first.properties[key]);
        const otherVal = extractPropertyStringValue(other.properties[key]);
        if (firstVal && otherVal && firstVal !== otherVal) {
          if (!conflictingProperties.includes(key)) {
            conflictingProperties.push(key);
          }
        }
      }
    }

    if (conflictingProperties.length > 0) {
      return {
        operationType: cluster.operationType,
        workflowName,
        nestingPath,
        representationsDetected: totalReps,
        canonicalRepresentationIndex: concreteReps[0].nodeIndex,
        canonicalKind: "concrete-executable",
        deterministicResolution: false,
        preservedFields: [],
        droppedRepresentationIndices: concreteReps.slice(1).map(r => r.nodeIndex),
        conflictFields: conflictingProperties,
        rejected: true,
        rejectionReason: `Multiple concrete representations with conflicting values for: ${conflictingProperties.join(", ")}`,
        remediationHint: `Remove duplicate concrete steps or resolve conflicting values for: ${conflictingProperties.join(", ")}`,
      };
    }
  }

  const canonical = concreteReps[0];
  const preservedFields: FieldProvenance[] = [];
  const droppedIndices: number[] = [];

  for (const [key, val] of Object.entries(canonical.properties)) {
    preservedFields.push({
      fieldName: key,
      value: val,
      sourceRepresentationIndex: canonical.nodeIndex,
      sourceKind: "concrete-executable",
      sourceTemplate: canonical.template,
    });
  }

  for (const rep of narrativeReps) {
    droppedIndices.push(rep.nodeIndex);
  }

  for (let i = 1; i < concreteReps.length; i++) {
    droppedIndices.push(concreteReps[i].nodeIndex);
    for (const [key, val] of Object.entries(concreteReps[i].properties)) {
      const canonicalVal = extractPropertyStringValue(canonical.properties[key]);
      if (!canonicalVal || canonicalVal.trim() === "" || canonicalVal === "PLACEHOLDER" || canonicalVal === '""') {
        const resolution = resolvePropertyConflict(key, canonical.properties[key], val);
        if (resolution.source === "narrative" || !canonicalVal) {
          canonical.properties[key] = val;
        }
        preservedFields.push({
          fieldName: key,
          value: val,
          sourceRepresentationIndex: concreteReps[i].nodeIndex,
          sourceKind: "concrete-executable",
          sourceTemplate: concreteReps[i].template,
        });
      }
    }
  }

  return {
    operationType: cluster.operationType,
    workflowName,
    nestingPath,
    representationsDetected: totalReps,
    canonicalRepresentationIndex: canonical.nodeIndex,
    canonicalKind: "concrete-executable",
    deterministicResolution: true,
    preservedFields,
    droppedRepresentationIndices: droppedIndices,
    conflictFields: [],
    rejected: false,
    rejectionReason: null,
    remediationHint: null,
  };
}

interface NormalizationLevelResult {
  newChildren: WorkflowNode[];
  perOperationResults: NormalizationResult[];
  stats: {
    totalClusters: number;
    duplicatesDetected: number;
    normalizedSuccessfully: number;
    rejectedForConflict: number;
    narrativePseudoContainersRemoved: number;
  };
}

function normalizeChildrenLevel(
  children: WorkflowNode[],
  workflowName: string,
  nestingPath: string,
): NormalizationLevelResult {
  const representations = collectRepresentations(children);
  const clusters = clusterByProximityAndType(representations);

  const perOperationResults: NormalizationResult[] = [];
  const indicesToRemove = new Set<number>();
  let narrativePseudoContainersRemoved = 0;
  let normalizedSuccessfully = 0;
  let rejectedForConflict = 0;

  for (const cluster of clusters) {
    const result = normalizeCluster(cluster, workflowName, nestingPath);
    perOperationResults.push(result);

    if (result.rejected) {
      rejectedForConflict++;
      continue;
    }

    normalizedSuccessfully++;
    for (const idx of result.droppedRepresentationIndices) {
      indicesToRemove.add(idx);
      const rep = cluster.representations.find(r => r.nodeIndex === idx);
      if (rep && rep.kind === "narrative-container") {
        narrativePseudoContainersRemoved++;
      }
    }
  }

  let newChildren = children.filter((_, idx) => !indicesToRemove.has(idx));

  const nestedResults: NormalizationResult[] = [];
  let nestedStats = { totalClusters: 0, duplicatesDetected: 0, normalizedSuccessfully: 0, rejectedForConflict: 0, narrativePseudoContainersRemoved: 0 };
  newChildren = newChildren.map((child, idx) => {
    const result = normalizeNodeChildren(child, workflowName, `${nestingPath}[${idx}]`);
    nestedResults.push(...result.nestedResults);
    nestedStats.totalClusters += result.nestedStats.totalClusters;
    nestedStats.duplicatesDetected += result.nestedStats.duplicatesDetected;
    nestedStats.normalizedSuccessfully += result.nestedStats.normalizedSuccessfully;
    nestedStats.rejectedForConflict += result.nestedStats.rejectedForConflict;
    nestedStats.narrativePseudoContainersRemoved += result.nestedStats.narrativePseudoContainersRemoved;
    return result.node;
  });

  return {
    newChildren,
    perOperationResults: [...perOperationResults, ...nestedResults],
    stats: {
      totalClusters: clusters.length + nestedStats.totalClusters,
      duplicatesDetected: clusters.reduce((acc, c) => acc + c.representations.length - 1, 0) + nestedStats.duplicatesDetected,
      normalizedSuccessfully: normalizedSuccessfully + nestedStats.normalizedSuccessfully,
      rejectedForConflict: rejectedForConflict + nestedStats.rejectedForConflict,
      narrativePseudoContainersRemoved: narrativePseudoContainersRemoved + nestedStats.narrativePseudoContainersRemoved,
    },
  };
}

interface NodeNormResult {
  node: WorkflowNode;
  nestedResults: NormalizationResult[];
  nestedStats: { totalClusters: number; duplicatesDetected: number; normalizedSuccessfully: number; rejectedForConflict: number; narrativePseudoContainersRemoved: number };
}

const EMPTY_STATS = { totalClusters: 0, duplicatesDetected: 0, normalizedSuccessfully: 0, rejectedForConflict: 0, narrativePseudoContainersRemoved: 0 };

function normalizeNodeChildren(node: WorkflowNode, workflowName: string, nestingPath: string): NodeNormResult {
  if (node.kind === "sequence") {
    const seq = node as SequenceNode;
    if (seq.children && seq.children.length > 0) {
      const result = normalizeChildrenLevel(seq.children, workflowName, `${nestingPath}/sequence`);
      return { node: { ...seq, children: result.newChildren }, nestedResults: result.perOperationResults, nestedStats: result.stats };
    }
  }
  if (node.kind === "tryCatch") {
    const tc = node as TryCatchNode;
    const allResults: NormalizationResult[] = [];
    const accStats = { ...EMPTY_STATS };
    let tryChildren = tc.tryChildren;
    let catchChildren = tc.catchChildren;
    let finallyChildren = tc.finallyChildren;
    if (tryChildren.length > 0) {
      const r = normalizeChildrenLevel(tryChildren, workflowName, `${nestingPath}/try`);
      tryChildren = r.newChildren;
      allResults.push(...r.perOperationResults);
      accStats.totalClusters += r.stats.totalClusters; accStats.duplicatesDetected += r.stats.duplicatesDetected;
      accStats.normalizedSuccessfully += r.stats.normalizedSuccessfully; accStats.rejectedForConflict += r.stats.rejectedForConflict;
      accStats.narrativePseudoContainersRemoved += r.stats.narrativePseudoContainersRemoved;
    }
    if (catchChildren.length > 0) {
      const r = normalizeChildrenLevel(catchChildren, workflowName, `${nestingPath}/catch`);
      catchChildren = r.newChildren;
      allResults.push(...r.perOperationResults);
      accStats.totalClusters += r.stats.totalClusters; accStats.duplicatesDetected += r.stats.duplicatesDetected;
      accStats.normalizedSuccessfully += r.stats.normalizedSuccessfully; accStats.rejectedForConflict += r.stats.rejectedForConflict;
      accStats.narrativePseudoContainersRemoved += r.stats.narrativePseudoContainersRemoved;
    }
    if (finallyChildren.length > 0) {
      const r = normalizeChildrenLevel(finallyChildren, workflowName, `${nestingPath}/finally`);
      finallyChildren = r.newChildren;
      allResults.push(...r.perOperationResults);
      accStats.totalClusters += r.stats.totalClusters; accStats.duplicatesDetected += r.stats.duplicatesDetected;
      accStats.normalizedSuccessfully += r.stats.normalizedSuccessfully; accStats.rejectedForConflict += r.stats.rejectedForConflict;
      accStats.narrativePseudoContainersRemoved += r.stats.narrativePseudoContainersRemoved;
    }
    return { node: { ...tc, tryChildren, catchChildren, finallyChildren }, nestedResults: allResults, nestedStats: accStats };
  }
  if (node.kind === "if") {
    const ifn = node as IfNode;
    const allResults: NormalizationResult[] = [];
    const accStats = { ...EMPTY_STATS };
    let thenChildren = ifn.thenChildren;
    let elseChildren = ifn.elseChildren;
    if (thenChildren.length > 0) {
      const r = normalizeChildrenLevel(thenChildren, workflowName, `${nestingPath}/then`);
      thenChildren = r.newChildren;
      allResults.push(...r.perOperationResults);
      accStats.totalClusters += r.stats.totalClusters; accStats.duplicatesDetected += r.stats.duplicatesDetected;
      accStats.normalizedSuccessfully += r.stats.normalizedSuccessfully; accStats.rejectedForConflict += r.stats.rejectedForConflict;
      accStats.narrativePseudoContainersRemoved += r.stats.narrativePseudoContainersRemoved;
    }
    if (elseChildren.length > 0) {
      const r = normalizeChildrenLevel(elseChildren, workflowName, `${nestingPath}/else`);
      elseChildren = r.newChildren;
      allResults.push(...r.perOperationResults);
      accStats.totalClusters += r.stats.totalClusters; accStats.duplicatesDetected += r.stats.duplicatesDetected;
      accStats.normalizedSuccessfully += r.stats.normalizedSuccessfully; accStats.rejectedForConflict += r.stats.rejectedForConflict;
      accStats.narrativePseudoContainersRemoved += r.stats.narrativePseudoContainersRemoved;
    }
    return { node: { ...ifn, thenChildren, elseChildren }, nestedResults: allResults, nestedStats: accStats };
  }
  if (node.kind === "while") {
    const wn = node as WhileNode;
    if (wn.bodyChildren.length > 0) {
      const r = normalizeChildrenLevel(wn.bodyChildren, workflowName, `${nestingPath}/whileBody`);
      return { node: { ...wn, bodyChildren: r.newChildren }, nestedResults: r.perOperationResults, nestedStats: r.stats };
    }
  }
  if (node.kind === "forEach") {
    const fen = node as ForEachNode;
    if (fen.bodyChildren.length > 0) {
      const r = normalizeChildrenLevel(fen.bodyChildren, workflowName, `${nestingPath}/forEachBody`);
      return { node: { ...fen, bodyChildren: r.newChildren }, nestedResults: r.perOperationResults, nestedStats: r.stats };
    }
  }
  if (node.kind === "retryScope") {
    const rsn = node as RetryScopeNode;
    if (rsn.bodyChildren.length > 0) {
      const r = normalizeChildrenLevel(rsn.bodyChildren, workflowName, `${nestingPath}/retryBody`);
      return { node: { ...rsn, bodyChildren: r.newChildren }, nestedResults: r.perOperationResults, nestedStats: r.stats };
    }
  }
  return { node, nestedResults: [], nestedStats: { ...EMPTY_STATS } };
}

export function normalizeWorkflowSpecCriticalOperations(
  spec: WorkflowSpec,
): { normalizedSpec: WorkflowSpec; diagnostics: SpecNormalizationDiagnostics } {
  const workflowName = spec.name || "Unknown";
  const result = normalizeChildrenLevel(spec.rootSequence.children, workflowName, "rootSequence");

  const normalizedSpec: WorkflowSpec = {
    ...spec,
    rootSequence: {
      ...spec.rootSequence,
      children: result.newChildren,
    },
  };

  return {
    normalizedSpec,
    diagnostics: {
      perOperationResults: result.perOperationResults,
      summary: result.stats,
    },
  };
}

export function runPreLoweringSpecNormalization(
  specs: Array<{ name: string; spec: WorkflowSpec }>,
): {
  normalizedSpecs: Array<{ name: string; spec: WorkflowSpec }>;
  allDiagnostics: SpecNormalizationDiagnostics;
  adoptionTrace: ActivePathAdoptionTraceEntry[];
} {
  const normalizedSpecs: Array<{ name: string; spec: WorkflowSpec }> = [];
  const allPerOperationResults: NormalizationResult[] = [];
  const adoptionTrace: ActivePathAdoptionTraceEntry[] = [];
  let totalClusters = 0;
  let totalDuplicates = 0;
  let totalNormalized = 0;
  let totalRejected = 0;
  let totalNarrativeRemoved = 0;

  for (const entry of specs) {
    const preCount = countCriticalRepresentations(entry.spec.rootSequence.children);
    const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(entry.spec);
    const postCount = countCriticalRepresentations(normalizedSpec.rootSequence.children);

    normalizedSpecs.push({ name: entry.name, spec: normalizedSpec });

    allPerOperationResults.push(...diagnostics.perOperationResults);
    totalClusters += diagnostics.summary.totalClusters;
    totalDuplicates += diagnostics.summary.duplicatesDetected;
    totalNormalized += diagnostics.summary.normalizedSuccessfully;
    totalRejected += diagnostics.summary.rejectedForConflict;
    totalNarrativeRemoved += diagnostics.summary.narrativePseudoContainersRemoved;

    const normalizedOperationIds = diagnostics.perOperationResults
      .filter(r => !r.rejected)
      .map(r => `${entry.name}:${r.operationType}:idx${r.canonicalRepresentationIndex}`);

    const allDroppedIndices = diagnostics.perOperationResults
      .filter(r => !r.rejected)
      .flatMap(r => r.droppedRepresentationIndices);

    const hasRejectedClusters = diagnostics.perOperationResults.some(r => r.rejected);
    adoptionTrace.push({
      workflowName: entry.name,
      preNormalizationRepresentationCount: preCount,
      postNormalizationRepresentationCount: postCount,
      normalizedOperationIds,
      loweringSawOnlyNormalizedRepresentation: false,
      droppedRepresentationNodeIndices: allDroppedIndices,
      hasRejectedClusters,
    });
  }

  const allDiagnostics: SpecNormalizationDiagnostics = {
    perOperationResults: allPerOperationResults,
    summary: {
      totalClusters,
      duplicatesDetected: totalDuplicates,
      normalizedSuccessfully: totalNormalized,
      rejectedForConflict: totalRejected,
      narrativePseudoContainersRemoved: totalNarrativeRemoved,
    },
  };

  if (totalClusters > 0) {
    console.log(
      `[PreLoweringNormalization] Processed ${specs.length} workflow(s): ${totalClusters} cluster(s), ${totalDuplicates} duplicate(s) detected, ${totalNormalized} normalized, ${totalRejected} rejected, ${totalNarrativeRemoved} narrative pseudo-container(s) removed`,
    );
  }

  return { normalizedSpecs, allDiagnostics, adoptionTrace };
}

function countCriticalRepresentations(children: WorkflowNode[]): number {
  let count = 0;
  for (const child of children) {
    if (inferOperationType(child) !== null) {
      count++;
    }
    const nested = getChildNodes(child);
    if (nested.length > 0) {
      count += countCriticalRepresentations(nested);
    }
  }
  return count;
}

export function validateAdoptionTrace(
  trace: ActivePathAdoptionTraceEntry[],
  debugMode: boolean = false,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const entry of trace) {
    if (entry.hasRejectedClusters) {
      violations.push(
        `Workflow "${entry.workflowName}": normalization rejected clusters with conflicting property values — workflow blocked from lowering`,
      );
      continue;
    }

    if (!entry.loweringSawOnlyNormalizedRepresentation) {
      violations.push(
        `Workflow "${entry.workflowName}": lowering consumed pre-normalized or mixed representations`,
      );
    }

    if (entry.preNormalizationRepresentationCount > entry.postNormalizationRepresentationCount) {
      if (!entry.loweringSawOnlyNormalizedRepresentation) {
        violations.push(
          `Workflow "${entry.workflowName}": normalization reduced representations (${entry.preNormalizationRepresentationCount} → ${entry.postNormalizationRepresentationCount}) but lowering flag is false`,
        );
      }
    }
  }

  if (debugMode && violations.length > 0) {
    throw new Error(
      `[PreLoweringNormalization] Debug mode: adoption trace violations detected:\n${violations.join("\n")}`,
    );
  }

  return { valid: violations.length === 0, violations };
}

export function markLoweringAdoptionResult(
  trace: ActivePathAdoptionTraceEntry[],
  workflowName: string,
  sawOnlyNormalized: boolean,
): void {
  const entry = trace.find(t => t.workflowName === workflowName);
  if (entry) {
    entry.loweringSawOnlyNormalizedRepresentation = sawOnlyNormalized;
  }
}

export function checkLoweringReceivedNormalizedOnly(
  trace: ActivePathAdoptionTraceEntry[],
  workflowName: string,
  currentChildren: WorkflowNode[],
): boolean {
  const entry = trace.find(t => t.workflowName === workflowName);
  if (!entry) return true;
  if (entry.droppedRepresentationNodeIndices.length === 0 && !entry.hasRejectedClusters) return true;

  return checkChildrenForMixedRepresentations(currentChildren);
}

function checkChildrenForMixedRepresentations(children: WorkflowNode[]): boolean {
  const proximityClusters = new Map<string, number[]>();

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const opType = inferOperationType(child);

    if (opType && child.kind === "activity") {
      for (const [, val] of Object.entries((child as ActivityNode).properties || {})) {
        const strVal = extractPropertyStringValue(val);
        if (strVal && isNarrativePseudoContent(strVal)) {
          return false;
        }
      }
      const template = ((child as ActivityNode).template || "").replace(/^ui:/, "");
      const clusterKey = `${opType}::${template}`;
      const indices = proximityClusters.get(clusterKey) || [];
      indices.push(i);
      proximityClusters.set(clusterKey, indices);
    }

    if (opType && child.kind === "tryCatch") {
      const tc = child as TryCatchNode;
      const displayLower = (tc.displayName || "").toLowerCase();
      const isCriticalNarrative =
        /send.*email|mail.*send|gmail|smtp|outlook.*mail/i.test(displayLower) ||
        /create.*task|action.*center|wait.*task/i.test(displayLower) ||
        /data.*service|create.*entity|update.*entity|query.*entity|delete.*entity/i.test(displayLower) ||
        /invoke.*workflow/i.test(displayLower);
      const hasConcreteCriticalInTry = tc.tryChildren.some(c => {
        if (c.kind === "activity") {
          const t = ((c as ActivityNode).template || "").replace(/^ui:/, "");
          return CRITICAL_OPERATION_TEMPLATES.has(t);
        }
        return false;
      });
      if (isCriticalNarrative && !hasConcreteCriticalInTry) {
        return false;
      }
    }

    const subChildren = getChildNodes(child);
    if (subChildren.length > 0 && !checkChildrenForMixedRepresentations(subChildren)) {
      return false;
    }
  }

  for (const [, indices] of proximityClusters) {
    if (indices.length < 2) continue;
    for (let i = 1; i < indices.length; i++) {
      if (indices[i] - indices[i - 1] <= MAX_PROXIMITY_GAP) {
        return false;
      }
    }
  }

  return true;
}
