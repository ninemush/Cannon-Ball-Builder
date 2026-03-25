import type { UiPathPackageSpec } from "./types/uipath-package";

export type ComplexityTier = "simple" | "moderate" | "complex";

export interface ComplexityClassification {
  tier: ComplexityTier;
  score: number;
  reasons: string[];
  streamlined: boolean;
}

export interface WorkflowBudget {
  min: number;
  max: number;
  label: string;
  guidance: string;
}

export interface PreGenerationComplexity {
  tier: ComplexityTier;
  score: number;
  reasons: string[];
  budget: WorkflowBudget;
}

export const WORKFLOW_BUDGET_BY_TIER: Record<ComplexityTier, WorkflowBudget> = {
  simple: {
    min: 2,
    max: 3,
    label: "~2–3 workflows",
    guidance: [
      "Target ~2–3 workflows total (e.g., Main + one or two focused sub-workflows).",
      "Keep error handling (TryCatch, RetryScope) inline within each workflow — do NOT create separate error-handler .xaml files.",
      "Do NOT create dedicated utility workflows for logging, config reading, or variable initialization — these belong inline.",
      "Only extract a separate workflow if the logic is genuinely reused by 2+ callers.",
    ].join("\n"),
  },
  moderate: {
    min: 3,
    max: 5,
    label: "~3–5 workflows",
    guidance: [
      "Target ~3–5 workflows total, each representing a distinct business sub-process.",
      "Keep error handling (TryCatch, RetryScope) inline within each workflow — do NOT create separate error-handler .xaml files.",
      "Do NOT create dedicated utility workflows for logging, config reading, or variable initialization — these belong inline.",
      "Only extract a separate workflow when the logic is genuinely reused by 2+ callers or represents a distinct lifecycle boundary.",
    ].join("\n"),
  },
  complex: {
    min: 5,
    max: 8,
    label: "~5–8 workflows",
    guidance: [
      "Target ~5–8 workflows total. Separate workflows are justified for: dispatcher/performer splits, Document Understanding extraction, Action Center HITL boundaries, and REFramework patterns (Init/Process/End).",
      "Keep error handling (TryCatch, RetryScope) inline within each workflow — do NOT create separate error-handler .xaml files.",
      "Do NOT create dedicated utility workflows for logging, config reading, or variable initialization — these belong inline.",
      "Only extract a utility workflow when the logic is genuinely reused by 2+ callers.",
    ].join("\n"),
  },
};

export function estimateComplexityFromContext(
  sddContent?: string,
  processNodes?: any[],
): PreGenerationComplexity {
  const reasons: string[] = [];
  let score = 0;

  const allText = [
    sddContent || "",
    ...(processNodes || []).flatMap((n: any) => [n.name || "", n.description || "", n.system || "", n.nodeType || ""]),
  ].join(" ").toLowerCase();

  let advancedCapabilities = 0;
  for (const keyword of ADVANCED_ACTIVITY_KEYWORDS) {
    if (allText.includes(keyword)) {
      advancedCapabilities++;
    }
  }

  if (advancedCapabilities === 0) {
    reasons.push("No advanced capabilities detected");
  } else if (advancedCapabilities <= 2) {
    score += 2;
    reasons.push(`${advancedCapabilities} advanced capability keyword(s) detected`);
  } else {
    score += 4;
    reasons.push(`${advancedCapabilities} advanced capability keywords detected`);
  }

  const hasAgents = allText.includes("agent-task") || allText.includes("agent-loop") || allText.includes("agentic");
  if (hasAgents) {
    score += 3;
    reasons.push("Agent capabilities detected");
  }

  const hasDU = allText.includes("document understanding") || allText.includes("digitize") || allText.includes("classify document") || allText.includes("extract document");
  if (hasDU) {
    score += 2;
    reasons.push("Document Understanding detected");
  }

  const artifactSignals = countOrchestratorArtifactSignals(sddContent || "");
  if (artifactSignals === 0) {
    reasons.push("No orchestrator artifact signals");
  } else if (artifactSignals <= 4) {
    score += 1;
    reasons.push(`${artifactSignals} orchestrator artifact signal(s)`);
  } else {
    score += 2;
    reasons.push(`${artifactSignals} orchestrator artifact signals`);
  }

  const nodeCount = processNodes?.length || 0;
  if (nodeCount > 15) {
    score += 2;
    reasons.push(`High process node count (${nodeCount})`);
  } else if (nodeCount > 8) {
    score += 1;
    reasons.push(`Moderate process node count (${nodeCount})`);
  } else if (nodeCount > 0) {
    reasons.push(`Low process node count (${nodeCount})`);
  }

  let tier: ComplexityTier;
  if (score <= 2) {
    tier = "simple";
  } else if (score <= 6) {
    tier = "moderate";
  } else {
    tier = "complex";
  }

  return {
    tier,
    score,
    reasons,
    budget: WORKFLOW_BUDGET_BY_TIER[tier],
  };
}

const ADVANCED_ACTIVITY_KEYWORDS = [
  "agent", "agentic", "autopilot",
  "document understanding", "du ", "digitize", "classify document", "extract data",
  "integration service", "connector",
  "action center", "human task", "create task", "wait for task", "form task",
  "data fabric", "data service", "data entity",
  "ml skill", "ai center", "ai skill", "machine learning",
];

const ADVANCED_ACTIVITY_TYPES = new Set([
  "ui:CreateFormTask",
  "ui:WaitForFormTaskAndResume",
  "ui:QueryEntity",
  "ui:CreateEntity",
  "ui:UpdateEntity",
  "ui:DeleteEntity",
  "ui:GetEntityById",
  "ui:MLSkill",
  "ui:ClassifyDocument",
  "ui:ExtractDocumentData",
  "ui:DigitizeDocument",
]);

const ORCHESTRATOR_ARTIFACT_KEYWORDS = [
  "queue",
  "asset",
  "credential",
  "orchestrator folder",
  "storage bucket",
  "trigger",
  "machine template",
];

function countOrchestratorArtifactSignals(sddText: string): number {
  if (!sddText) return 0;
  const lower = sddText.toLowerCase();
  let count = 0;
  for (const keyword of ORCHESTRATOR_ARTIFACT_KEYWORDS) {
    const regex = new RegExp(keyword, "gi");
    const matches = lower.match(regex);
    if (matches) count += Math.min(matches.length, 3);
  }
  return count;
}

export function classifyComplexity(
  pkg: UiPathPackageSpec,
  sddContent?: string,
  processNodes?: any[],
): ComplexityClassification {
  const reasons: string[] = [];
  let score = 0;

  const workflows = pkg.workflows || [];
  const workflowCount = workflows.length;
  const totalSteps = workflows.reduce((sum, w) => sum + (w.steps?.length || 0), 0);

  if (workflowCount <= 2) {
    reasons.push(`Low workflow count (${workflowCount})`);
  } else if (workflowCount <= 5) {
    score += 2;
    reasons.push(`Moderate workflow count (${workflowCount})`);
  } else {
    score += 4;
    reasons.push(`High workflow count (${workflowCount})`);
  }

  if (totalSteps <= 10) {
    reasons.push(`Low activity count (${totalSteps})`);
  } else if (totalSteps <= 25) {
    score += 1;
    reasons.push(`Moderate activity count (${totalSteps})`);
  } else {
    score += 3;
    reasons.push(`High activity count (${totalSteps})`);
  }

  const allText = [
    sddContent || "",
    ...workflows.flatMap(w => [
      w.description || "",
      ...(w.steps || []).flatMap(s => [s.activity || "", s.activityType || "", s.notes || ""]),
    ]),
    ...(processNodes || []).flatMap((n: any) => [n.name || "", n.description || "", n.system || "", n.nodeType || ""]),
  ].join(" ").toLowerCase();

  let advancedCapabilities = 0;
  for (const keyword of ADVANCED_ACTIVITY_KEYWORDS) {
    if (allText.includes(keyword)) {
      advancedCapabilities++;
    }
  }

  const allActivityTypes = workflows.flatMap(w =>
    (w.steps || []).map(s => s.activityType || "")
  );
  for (const actType of allActivityTypes) {
    if (ADVANCED_ACTIVITY_TYPES.has(actType)) {
      advancedCapabilities++;
    }
  }

  if (advancedCapabilities === 0) {
    reasons.push("No advanced capabilities detected");
  } else if (advancedCapabilities <= 2) {
    score += 2;
    reasons.push(`${advancedCapabilities} advanced capability keyword(s) detected`);
  } else {
    score += 4;
    reasons.push(`${advancedCapabilities} advanced capability keywords detected`);
  }

  const hasAgents = allText.includes("agent-task") || allText.includes("agent-loop") || allText.includes("agentic");
  if (hasAgents) {
    score += 3;
    reasons.push("Agent capabilities detected");
  }

  const hasDU = allText.includes("document understanding") || allText.includes("digitize") || allText.includes("classify document") || allText.includes("extract document");
  if (hasDU) {
    score += 2;
    reasons.push("Document Understanding detected");
  }

  const artifactSignals = countOrchestratorArtifactSignals(sddContent || "");
  if (artifactSignals === 0) {
    reasons.push("No orchestrator artifact signals in SDD");
  } else if (artifactSignals <= 4) {
    score += 1;
    reasons.push(`${artifactSignals} orchestrator artifact signal(s) in SDD`);
  } else {
    score += 2;
    reasons.push(`${artifactSignals} orchestrator artifact signals in SDD`);
  }

  const nodeCount = processNodes?.length || 0;
  if (nodeCount > 15) {
    score += 2;
    reasons.push(`High process node count (${nodeCount})`);
  } else if (nodeCount > 8) {
    score += 1;
    reasons.push(`Moderate process node count (${nodeCount})`);
  }

  let tier: ComplexityTier;
  if (score <= 2) {
    tier = "simple";
  } else if (score <= 6) {
    tier = "moderate";
  } else {
    tier = "complex";
  }

  return {
    tier,
    score,
    reasons,
    streamlined: tier === "simple",
  };
}
