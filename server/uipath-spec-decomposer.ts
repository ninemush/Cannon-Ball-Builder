import { getCodeLLM, SDD_LLM_TIMEOUT_MS } from "./lib/llm";
import { sanitizeAndParseJson, diagnoseJsonFailure } from "./lib/json-utils";
import { uipathPackageSchema, type UiPathPackageSpec } from "./types/uipath-package";
import { repairTruncatedPackageJson } from "./uipath-prompts";
import { storage } from "./storage";
import { RunLogger } from "./lib/run-logger";

const SCAFFOLD_MAX_TOKENS = 4096;
const DETAIL_MAX_TOKENS = 8192;
const DETAIL_RETRY_LIMIT = 3;
const DETAIL_LLM_TIMEOUT_MS = 150_000;
const DETAIL_TIMEOUT_ESCALATION_MS = 50_000;
const DECOMPOSITION_AGGREGATE_TIMEOUT_BASE_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 4_000;
const PARALLEL_CONCURRENCY = 3;
const BACKOFF_BASE_MS = 2_000;
const BACKOFF_MAX_MS = 16_000;

function isRateLimitError(err: any): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  const status = err?.status ?? err?.statusCode ?? 0;
  return status === 429 || msg.includes("429") || msg.includes("rate limit") || msg.includes("resource_exhausted") || msg.includes("too many requests");
}

function backoffWithJitter(attempt: number): number {
  const exponential = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt), BACKOFF_MAX_MS);
  const jitter = Math.random() * exponential * 0.5;
  return exponential + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface DecompositionMetrics {
  scaffoldDurationMs: number;
  totalLlmCalls: number;
  perWorkflow: Array<{
    name: string;
    status: "succeeded" | "stubbed" | "failed";
    attempts: number;
    durationMs: number;
  }>;
  stubCount: number;
  totalElapsedMs: number;
}

export interface DecomposedSpecResult {
  packageSpec: UiPathPackageSpec;
  metrics: DecompositionMetrics;
}

interface ScaffoldWorkflowEntry {
  name: string;
  description: string;
  invokes?: string[];
  sharedArguments?: Array<{ name: string; direction: "in" | "out" | "in_out"; type: string }>;
  sharedAssets?: string[];
}

interface ScaffoldResult {
  projectName: string;
  description: string;
  dependencies: string[];
  workflows: ScaffoldWorkflowEntry[];
  sharedQueueNames?: string[];
  sharedAssetNames?: string[];
  executionOrder?: string[];
}

function buildScaffoldPrompt(complexityGuidance?: string): string {
  const budgetSection = complexityGuidance
    ? `\nWORKFLOW DECOMPOSITION GUIDANCE:\n${complexityGuidance}\n`
    : "";

  return `You are a Senior Developer and Solution Architect. Apply production engineering rigor: enforce strict naming conventions (PascalCase project and workflow names, camelCase variables, PascalCase arguments), cohesive workflow boundaries where each workflow owns a meaningful business sub-process, meaningful shared arguments that cross workflow boundaries with clear direction, and realistic dependency declarations. Anticipate common runtime failures (selector timeouts, credential expiry, file locks) within each workflow using inline TryCatch and RetryScope — do NOT create separate error-handler or retry .xaml files. Comply strictly with the JSON schema below — no extra fields, no missing required fields, no prose outside the JSON.
${budgetSection}
Based on the approved SDD and any PDD/process map context provided, generate a project scaffold for a UiPath automation package. Output a JSON object with this exact shape:

{
  "projectName": "string (PascalCase, no spaces)",
  "description": "string (brief project description)",
  "dependencies": ["UiPath.System.Activities", "... other required UiPath package names"],
  "workflows": [
    {
      "name": "string (PascalCase filename without .xaml)",
      "description": "string (what this workflow does)",
      "invokes": ["OtherWorkflowName (names of workflows this one calls via InvokeWorkflowFile)"],
      "sharedArguments": [
        { "name": "string", "direction": "in|out|in_out", "type": "String|Int32|Boolean|DataTable|Object" }
      ],
      "sharedAssets": ["asset names referenced by this workflow"]
    }
  ],
  "sharedQueueNames": ["queue names used across workflows"],
  "sharedAssetNames": ["orchestrator asset names used across workflows"],
  "executionOrder": ["Main", "SubWorkflow1", "SubWorkflow2 (topological order)"]
}

IMPORTANT RULES:
- Error handling (TryCatch, RetryScope) belongs INLINE within workflows — do NOT create separate error-handler or retry .xaml files
- Only create a dedicated utility/helper workflow when the logic is genuinely reused by 2+ caller workflows (e.g., a shared login sequence)
- Separate workflows ARE appropriate for: dispatcher/performer patterns, REFramework structure (Init/Process/End), Action Center / HITL boundaries, and genuinely distinct business sub-processes
- The invokes array defines the invocation graph: which workflows call which via InvokeWorkflowFile
- sharedArguments are input/output arguments that cross workflow boundaries
- executionOrder should be topological: invoked (dependency) workflows should come BEFORE the workflows that call them, so dependencies are generated first
- List ALL required UiPath package dependencies
- Keep it concise — this is the project skeleton, not full workflow details

Return ONLY the JSON object, no other text.`;
}

function buildDetailPrompt(workflow: ScaffoldWorkflowEntry, scaffold: ScaffoldResult): string {
  const contextLines: string[] = [];
  contextLines.push(`Project: ${scaffold.projectName} — ${scaffold.description}`);
  contextLines.push(`Dependencies: ${scaffold.dependencies.join(", ")}`);

  const otherWorkflows = scaffold.workflows
    .filter(w => w.name !== workflow.name)
    .map(w => `  - ${w.name}: ${w.description}${w.invokes?.length ? ` (invokes: ${w.invokes.join(", ")})` : ""}`);
  if (otherWorkflows.length > 0) {
    contextLines.push(`Other workflows in this project:\n${otherWorkflows.join("\n")}`);
  }

  if (workflow.sharedArguments?.length) {
    contextLines.push(`Shared arguments for ${workflow.name}: ${JSON.stringify(workflow.sharedArguments)}`);
  }
  if (workflow.sharedAssets?.length) {
    contextLines.push(`Referenced assets: ${workflow.sharedAssets.join(", ")}`);
  }
  if (scaffold.sharedQueueNames?.length) {
    contextLines.push(`Shared queues: ${scaffold.sharedQueueNames.join(", ")}`);
  }
  if (scaffold.sharedAssetNames?.length) {
    contextLines.push(`Shared orchestrator assets: ${scaffold.sharedAssetNames.join(", ")}`);
  }

  return `You are a Senior Developer and Solution Architect. Apply production engineering rigor: use camelCase for all variable names, provide meaningful defaultValues (not empty strings for critical variables), include logging-level annotations in step notes at every decision point and error handler, use realistic selectorHints with tag/attribute structure (not just placeholder text), and set errorHandling deliberately — "none" only for steps that genuinely cannot fail. Anticipate specific runtime failures (selector not found, API timeout, file locked, stale data) rather than relying on generic TryCatch. Comply strictly with the JSON schema below — no extra fields, no missing required fields, no prose outside the JSON.

Generate the full workflow specification for the "${workflow.name}" workflow in the UiPath project "${scaffold.projectName}".

PROJECT CONTEXT:
${contextLines.join("\n")}

WORKFLOW PURPOSE:
${workflow.description}
${workflow.invokes?.length ? `This workflow invokes: ${workflow.invokes.join(", ")}` : ""}

Output a JSON object with this exact shape:
{
  "name": "${workflow.name}",
  "description": "${workflow.description}",
  "variables": [
    {
      "name": "string (camelCase variable name)",
      "type": "String|Int32|Boolean|DataTable|Object|DateTime|Array<String>|Dictionary<String,Object>",
      "defaultValue": "optional default value or empty string",
      "scope": "workflow|sequence"
    }
  ],
  "steps": [
    {
      "activity": "string (human-readable step description)",
      "activityType": "string (exact UiPath activity name, e.g. ui:TypeInto, ui:Click, ui:GetText, ui:OpenBrowser, ui:ExcelApplicationScope, ui:ReadRange, ui:WriteRange, ui:SendSmtpMailMessage, ui:HttpClient, ui:Assign, If, ForEach, While, TryCatch, RetryScope, InvokeWorkflowFile)",
      "activityPackage": "string (UiPath package namespace)",
      "properties": { "key": "value (activity-specific properties)" },
      "selectorHint": "string or null (placeholder UI selector for UI activities)",
      "errorHandling": "retry|catch|escalate|none",
      "notes": "string (implementation notes)"
    }
  ]
}

IMPORTANT RULES:
- Use SPECIFIC UiPath activity names in activityType
- For UI automation steps, include a selectorHint with a realistic placeholder selector
- For system interaction steps, set errorHandling to "retry" or "catch"
- Include ALL variables needed by the workflow
- Include specific properties for each activity
- Map decision points to If/Switch activities
- Map loops to ForEach/While activities
- Be as specific and production-ready as possible

ACTIVITY TREE DEPTH & INLINE ERROR HANDLING:
- Build DEEP nested activity trees — do NOT flatten everything to a single-level sequence. Group related steps into nested Sequence activities (3-4 levels deep when appropriate).
- Wrap error-prone operations (UI interactions, API calls, DB queries, file I/O) in inline TryCatch blocks directly at the point of use — NOT at the top level of the workflow. Each TryCatch catch block must contain a LogMessage activity with the exception details.
- Use RetryScope around flaky operations (selector-dependent UI steps, network calls) with NumberOfRetries=3 and RetryInterval=00:00:05. Nest the target activity inside the RetryScope body.
- Wire arguments explicitly: every InvokeWorkflowFile must specify all required in/out/in_out arguments in its properties with correct variable references.
- For multi-step business transactions, nest related activities inside a parent TryCatch so the catch block can perform cleanup/rollback of the entire sub-transaction.
- Example deep structure: Sequence → TryCatch → Try: Sequence → RetryScope → target activity; Catch: Sequence → LogMessage + compensating action.
- Do NOT create separate error-handler .xaml files — all error handling must be inline within the workflow using TryCatch/RetryScope activities.

Return ONLY the JSON object, no other text.`;
}

function buildExecutionOrder(workflows: ScaffoldWorkflowEntry[]): string[] {
  const nameSet = new Set(workflows.map(w => w.name));
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const w of workflows) {
    graph.set(w.name, new Set());
    inDegree.set(w.name, 0);
  }

  for (const w of workflows) {
    if (w.invokes) {
      for (const target of w.invokes) {
        if (nameSet.has(target) && target !== w.name) {
          graph.get(target)!.add(w.name);
          inDegree.set(w.name, (inDegree.get(w.name) || 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  inDegree.forEach((deg, name) => {
    if (deg === 0) queue.push(name);
  });

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const deps = graph.get(current);
    if (deps) {
      deps.forEach(dep => {
        const newDeg = (inDegree.get(dep) || 1) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg === 0) queue.push(dep);
      });
    }
  }

  for (const w of workflows) {
    if (!order.includes(w.name)) order.push(w.name);
  }

  return order;
}

function makeStubWorkflow(entry: ScaffoldWorkflowEntry): UiPathPackageSpec["workflows"][number] {
  return {
    name: entry.name,
    description: entry.description || "Stub workflow — detail generation failed",
    variables: [],
    steps: [],
  };
}

function parseScaffold(rawText: string): ScaffoldResult {
  let parsed: any;
  try {
    parsed = sanitizeAndParseJson(rawText);
  } catch {
    const repaired = repairTruncatedPackageJson(rawText);
    if (!repaired) throw new Error("Failed to parse scaffold response");
    parsed = repaired;
  }

  if (!parsed.projectName || typeof parsed.projectName !== "string") {
    parsed.projectName = "UiPathPackage";
  }
  if (!parsed.description || typeof parsed.description !== "string") {
    parsed.description = "";
  }
  if (!Array.isArray(parsed.dependencies)) {
    parsed.dependencies = [];
  }
  if (!parsed.workflows || !Array.isArray(parsed.workflows) || parsed.workflows.length === 0) {
    throw new Error("Scaffold contains no workflows");
  }
  if (!Array.isArray(parsed.sharedQueueNames)) {
    parsed.sharedQueueNames = [];
  }
  if (!Array.isArray(parsed.sharedAssetNames)) {
    parsed.sharedAssetNames = [];
  }
  if (!Array.isArray(parsed.executionOrder)) {
    parsed.executionOrder = [];
  }
  for (const wf of parsed.workflows) {
    if (!Array.isArray(wf.invokes)) wf.invokes = [];
    if (!Array.isArray(wf.sharedArguments)) wf.sharedArguments = [];
    if (!Array.isArray(wf.sharedAssets)) wf.sharedAssets = [];
    if (!wf.description || typeof wf.description !== "string") wf.description = "";
  }

  return parsed as ScaffoldResult;
}

function parseWorkflowDetail(rawText: string, workflowName: string, runLogger?: RunLogger): UiPathPackageSpec["workflows"][number] {
  let parsed: any;
  try {
    parsed = sanitizeAndParseJson(rawText);
  } catch (sanitizeErr: any) {
    const repaired = repairTruncatedPackageJson(rawText);
    if (!repaired) {
      const diag = diagnoseJsonFailure(rawText);
      const logId = runLogger?.getRunId() ?? "unknown";
      console.error(`[SpecDecomposer] [${logId}] JSON parse failed for workflow "${workflowName}" — ${diag.truncationHint}, length=${diag.totalLength}, bracketDepth=${diag.bracketDepth}, endsInString=${diag.endsInString}`);
      console.error(`[SpecDecomposer] [${logId}] Response head (first 1500 chars): ${diag.head}`);
      if (diag.tail) {
        console.error(`[SpecDecomposer] [${logId}] Response tail (last 500 chars): ${diag.tail}`);
      }
      if (runLogger) {
        runLogger.recordRetry(`json_parse_diag_${workflowName}`, 0, `${diag.truncationHint} | len=${diag.totalLength} | depth=${diag.bracketDepth} | inStr=${diag.endsInString} | sanitizeErr=${sanitizeErr?.message}`);
      }
      throw new Error(`Failed to parse detail response for ${workflowName} (${diag.truncationHint}, length=${diag.totalLength})`);
    }
    parsed = repaired;
  }

  const wrapperResult = uipathPackageSchema.parse({
    projectName: "temp",
    description: "",
    dependencies: [],
    workflows: [{ ...parsed, name: workflowName }],
  });
  return wrapperResult.workflows[0];
}

function mergeSpec(
  scaffold: ScaffoldResult,
  workflowDetails: Map<string, UiPathPackageSpec["workflows"][number]>,
  warnings: string[],
): UiPathPackageSpec {
  const workflows: UiPathPackageSpec["workflows"] = [];

  for (const entry of scaffold.workflows) {
    const detail = workflowDetails.get(entry.name);
    if (detail) {
      workflows.push(detail);
    } else {
      warnings.push(`Workflow "${entry.name}" missing from detail results — inserting stub`);
      workflows.push(makeStubWorkflow(entry));
    }
  }

  const scaffoldNameSet = new Set(scaffold.workflows.map(w => w.name));

  const declaredSharedArgs = new Map<string, Set<string>>();
  for (const entry of scaffold.workflows) {
    if (entry.sharedArguments) {
      for (const arg of entry.sharedArguments) {
        if (!declaredSharedArgs.has(arg.name)) {
          declaredSharedArgs.set(arg.name, new Set());
        }
        declaredSharedArgs.get(arg.name)!.add(entry.name);
      }
    }
  }

  for (const wf of workflows) {
    if (wf.steps) {
      for (const step of wf.steps) {
        if (step.activityType === "InvokeWorkflowFile" && step.properties?.["WorkflowFileName"]) {
          const targetName = String(step.properties["WorkflowFileName"]).replace(/\.xaml$/i, "");
          if (!scaffoldNameSet.has(targetName)) {
            warnings.push(`Workflow "${wf.name}" references undeclared workflow "${targetName}" via InvokeWorkflowFile`);
          }
        }
      }
    }

    const scaffoldEntry = scaffold.workflows.find(e => e.name === wf.name);
    if (wf.variables) {
      const myDeclaredArgNames = new Set(
        (scaffoldEntry?.sharedArguments || []).map(a => a.name)
      );
      for (const v of wf.variables) {
        if (declaredSharedArgs.has(v.name) && !myDeclaredArgNames.has(v.name)) {
          warnings.push(`Workflow "${wf.name}" uses variable "${v.name}" which is a shared argument in other workflows but not declared in its scaffold entry`);
        }
      }
    }
  }

  const spec: UiPathPackageSpec = {
    projectName: scaffold.projectName,
    description: scaffold.description || "",
    dependencies: scaffold.dependencies || [],
    workflows,
  };

  return uipathPackageSchema.parse(spec);
}

export interface DecomposeOptions {
  systemContext: string;
  runId: string;
  runLogger: RunLogger;
  onProgress?: (message: string) => void;
  onPipelineProgress?: (event: any) => void;
  complexityGuidance?: string;
}

export async function generateDecomposedSpec(options: DecomposeOptions): Promise<DecomposedSpecResult> {
  const { systemContext, runId, runLogger, onProgress, onPipelineProgress, complexityGuidance } = options;
  const overallStart = Date.now();
  const metrics: DecompositionMetrics = {
    scaffoldDurationMs: 0,
    totalLlmCalls: 0,
    perWorkflow: [],
    stubCount: 0,
    totalElapsedMs: 0,
  };
  const mergeWarnings: string[] = [];

  onPipelineProgress?.({ type: "started", stage: "spec_scaffold", message: "Generating project scaffold" });
  onProgress?.("Generating project scaffold...");
  runLogger.stageStart("spec_scaffold");

  const scaffoldStart = Date.now();
  let scaffoldResponse;
  try {
    scaffoldResponse = await getCodeLLM().create({
      maxTokens: SCAFFOLD_MAX_TOKENS,
      system: systemContext,
      messages: [{ role: "user", content: buildScaffoldPrompt(complexityGuidance) }],
      timeoutMs: SDD_LLM_TIMEOUT_MS,
    });
    metrics.totalLlmCalls++;
  } catch (err: any) {
    runLogger.stageEnd("spec_scaffold", "failed", undefined, err?.message);
    onPipelineProgress?.({ type: "failed", stage: "spec_scaffold", message: "Scaffold generation failed" });
    throw new Error(`Scaffold LLM call failed: ${err?.message}`);
  }
  metrics.scaffoldDurationMs = Date.now() - scaffoldStart;

  let scaffold: ScaffoldResult;
  try {
    scaffold = parseScaffold(scaffoldResponse.text || "{}");
  } catch (err: any) {
    runLogger.stageEnd("spec_scaffold", "failed", undefined, err?.message);
    onPipelineProgress?.({ type: "failed", stage: "spec_scaffold", message: "Failed to parse scaffold" });
    throw new Error(`Scaffold parse failed: ${err?.message}`);
  }

  let executionOrder: string[];
  const scaffoldNames = new Set(scaffold.workflows.map(w => w.name));
  const scaffoldOrderValid = (() => {
    if (!scaffold.executionOrder?.length) return false;
    if (!scaffold.executionOrder.every(name => scaffoldNames.has(name))) return false;
    if (new Set(scaffold.executionOrder).size !== scaffold.executionOrder.length) return false;
    const posMap = new Map<string, number>();
    scaffold.executionOrder.forEach((name, idx) => posMap.set(name, idx));
    for (const w of scaffold.workflows) {
      if (w.invokes) {
        for (const target of w.invokes) {
          if (scaffoldNames.has(target) && target !== w.name) {
            const targetPos = posMap.get(target);
            const callerPos = posMap.get(w.name);
            if (targetPos !== undefined && callerPos !== undefined && targetPos > callerPos) {
              return false;
            }
          }
        }
      }
    }
    return true;
  })();

  if (scaffoldOrderValid) {
    executionOrder = scaffold.executionOrder!;
  } else {
    executionOrder = buildExecutionOrder(scaffold.workflows);
  }

  runLogger.stageEnd("spec_scaffold", "succeeded", {
    workflowCount: scaffold.workflows.length,
    projectName: scaffold.projectName,
    executionOrder,
  });
  onPipelineProgress?.({
    type: "completed",
    stage: "spec_scaffold",
    message: `Scaffold ready: ${scaffold.workflows.length} workflow(s)`,
    context: { workflowCount: scaffold.workflows.length, projectName: scaffold.projectName },
  });

  console.log(`[SpecDecomposer] Run ${runId}: Scaffold generated — ${scaffold.workflows.length} workflows: ${scaffold.workflows.map(w => w.name).join(", ")}`);

  const workflowMap = new Map<string, ScaffoldWorkflowEntry>();
  for (const w of scaffold.workflows) {
    workflowMap.set(w.name, w);
  }

  const workflowDetails = new Map<string, UiPathPackageSpec["workflows"][number]>();

  const orderedWorkflows = executionOrder
    .filter(name => workflowMap.has(name))
    .map(name => workflowMap.get(name)!);

  for (const remaining of scaffold.workflows) {
    if (!orderedWorkflows.find(w => w.name === remaining.name)) {
      orderedWorkflows.push(remaining);
    }
  }

  onPipelineProgress?.({ type: "started", stage: "spec_workflow_detail", message: `Generating ${orderedWorkflows.length} workflow detail(s)` });

  const detailPhaseStart = Date.now();
  let aggregateTimedOut = false;

  let heartbeatState = { index: 0, name: orderedWorkflows[0]?.name || "", total: orderedWorkflows.length };
  const heartbeatInterval = setInterval(() => {
    const elapsed = ((Date.now() - detailPhaseStart) / 1000).toFixed(1);
    onPipelineProgress?.({
      type: "heartbeat",
      stage: "spec_workflow_detail",
      message: `Generating workflow ${heartbeatState.index + 1}/${heartbeatState.total}: ${heartbeatState.name} (${elapsed}s elapsed)`,
      elapsed: parseFloat(elapsed),
      context: { workflowName: heartbeatState.name, index: heartbeatState.index + 1, total: heartbeatState.total },
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
  const aggregateTimeoutMs = Math.max(DECOMPOSITION_AGGREGATE_TIMEOUT_BASE_MS, orderedWorkflows.length * 120_000);

  async function generateSingleWorkflow(entry: ScaffoldWorkflowEntry, i: number): Promise<void> {
    if (aggregateTimedOut) {
      const stub = makeStubWorkflow(entry);
      workflowDetails.set(entry.name, stub);
      metrics.stubCount++;
      mergeWarnings.push(`Workflow "${entry.name}" was stubbed due to aggregate timeout`);
      metrics.perWorkflow.push({ name: entry.name, status: "stubbed", attempts: 0, durationMs: 0 });
      onPipelineProgress?.({
        type: "warning",
        stage: "spec_workflow_detail",
        message: `Workflow "${entry.name}" stubbed due to aggregate timeout`,
        context: { workflowName: entry.name, index: i + 1, total: orderedWorkflows.length, outcome: "stubbed", reason: "aggregate_timeout" },
      });
      return;
    }

    if (Date.now() - detailPhaseStart > aggregateTimeoutMs) {
      aggregateTimedOut = true;
      const stub = makeStubWorkflow(entry);
      workflowDetails.set(entry.name, stub);
      metrics.stubCount++;
      mergeWarnings.push(`Workflow "${entry.name}" was stubbed due to aggregate timeout`);
      metrics.perWorkflow.push({ name: entry.name, status: "stubbed", attempts: 0, durationMs: 0 });
      onPipelineProgress?.({
        type: "warning",
        stage: "spec_workflow_detail",
        message: `Workflow "${entry.name}" stubbed due to aggregate timeout`,
        context: { workflowName: entry.name, index: i + 1, total: orderedWorkflows.length, outcome: "stubbed", reason: "aggregate_timeout" },
      });
      return;
    }

    const wfStart = Date.now();
    let attempts = 0;
    let succeeded = false;
    let timeoutEscalations = 0;

    heartbeatState = { index: i, name: entry.name, total: orderedWorkflows.length };
    console.log(`[SpecDecomposer] Run ${runId}: Starting workflow ${i + 1}/${orderedWorkflows.length}: "${entry.name}"`);
    onProgress?.(`Generating workflow ${i + 1}/${orderedWorkflows.length}: ${entry.name}...`);
    onPipelineProgress?.({
      type: "started",
      stage: "spec_workflow_detail",
      message: `Generating workflow ${i + 1}/${orderedWorkflows.length}: ${entry.name}`,
      context: { workflowName: entry.name, index: i + 1, total: orderedWorkflows.length },
    });

    const detailPrompt = buildDetailPrompt(entry, scaffold);

    for (let attempt = 0; attempt <= DETAIL_RETRY_LIMIT; attempt++) {
      const aggregateRemaining = aggregateTimeoutMs - (Date.now() - detailPhaseStart);
      if (aggregateRemaining <= 0) {
        aggregateTimedOut = true;
        console.warn(`[SpecDecomposer] Run ${runId}: Aggregate timeout reached during retries for "${entry.name}" — stubbing`);
        const stub = makeStubWorkflow(entry);
        workflowDetails.set(entry.name, stub);
        metrics.stubCount++;
        mergeWarnings.push(`Workflow "${entry.name}" was stubbed due to aggregate timeout (during retry ${attempt + 1})`);
        onPipelineProgress?.({
          type: "warning",
          stage: "spec_workflow_detail",
          message: `Workflow "${entry.name}" stubbed due to aggregate timeout`,
          context: { workflowName: entry.name, index: i + 1, total: orderedWorkflows.length, outcome: "stubbed", reason: "aggregate_timeout_mid_retry" },
        });
        break;
      }

      attempts++;
      metrics.totalLlmCalls++;

      const escalatedTimeout = DETAIL_LLM_TIMEOUT_MS + (timeoutEscalations * DETAIL_TIMEOUT_ESCALATION_MS);
      const perWorkflowTimeout = Math.min(escalatedTimeout, aggregateRemaining);

      console.log(`[SpecDecomposer] Run ${runId}: Workflow "${entry.name}" attempt ${attempt + 1}/${DETAIL_RETRY_LIMIT + 1} (timeout: ${Math.round(perWorkflowTimeout / 1000)}s)`);

      try {
        const detailResponse = await getCodeLLM().create({
          maxTokens: DETAIL_MAX_TOKENS,
          system: systemContext,
          messages: [{ role: "user", content: detailPrompt }],
          timeoutMs: perWorkflowTimeout,
        });

        const detail = parseWorkflowDetail(detailResponse.text || "{}", entry.name, runLogger);
        workflowDetails.set(entry.name, detail);
        succeeded = true;

        const wfDuration = Date.now() - wfStart;
        console.log(`[SpecDecomposer] Run ${runId}: Workflow "${entry.name}" succeeded in ${wfDuration}ms (${attempts} attempt(s))`);

        onPipelineProgress?.({
          type: "completed",
          stage: "spec_workflow_detail",
          message: `Workflow ${i + 1}/${orderedWorkflows.length} complete: ${entry.name}`,
          elapsed: (Date.now() - wfStart) / 1000,
          context: { workflowName: entry.name, index: i + 1, total: orderedWorkflows.length },
        });

        try {
          const partialWorkflows = Array.from(workflowDetails.values());
          const partialSpec = {
            projectName: scaffold.projectName,
            description: scaffold.description,
            dependencies: scaffold.dependencies,
            workflows: partialWorkflows,
          };
          await storage.updateGenerationRunSpecSnapshot(runId, {
            partialSpec,
            completedWorkflows: partialWorkflows.map(w => w.name),
            totalWorkflows: scaffold.workflows.length,
            timestamp: new Date().toISOString(),
          });
        } catch {}

        break;
      } catch (err: any) {
        const wfDuration = Date.now() - wfStart;
        const isTimeout = /timed?\s*out/i.test(err?.message ?? "");
        const failureKind = isTimeout ? "timeout" : "error";
        const timeoutSec = Math.round(perWorkflowTimeout / 1000);
        console.warn(`[SpecDecomposer] Run ${runId}: Workflow "${entry.name}" attempt ${attempt + 1} failed (${failureKind}) after ${wfDuration}ms (timeout was ${timeoutSec}s): ${err?.message}`);
        runLogger.recordRetry(`spec_workflow_detail_${entry.name}`, attempt + 1, err?.message);

        if (isTimeout) {
          timeoutEscalations++;
        }

        if (attempt < DETAIL_RETRY_LIMIT) {
          const nextEscalatedTimeout = DETAIL_LLM_TIMEOUT_MS + (timeoutEscalations * DETAIL_TIMEOUT_ESCALATION_MS);
          const nextAggregateRemaining = aggregateTimeoutMs - (Date.now() - detailPhaseStart);
          const nextEffectiveTimeout = Math.min(nextEscalatedTimeout, Math.max(0, nextAggregateRemaining));
          const nextTimeoutSec = Math.round(nextEffectiveTimeout / 1000);

          const isRateLimit = isRateLimitError(err);
          let backoffMs = 0;
          if (isRateLimit) {
            backoffMs = backoffWithJitter(attempt);
            console.log(`[SpecDecomposer] Run ${runId}: Rate limit hit for "${entry.name}", backing off ${Math.round(backoffMs)}ms before retry`);
          }

          const retryMessage = isTimeout
            ? `Workflow "${entry.name}" attempt ${attempt + 1} timed out after ${timeoutSec}s, retrying with ${nextTimeoutSec}s timeout`
            : isRateLimit
              ? `Workflow "${entry.name}" attempt ${attempt + 1} rate-limited, backing off ${Math.round(backoffMs)}ms before retry with ${nextTimeoutSec}s timeout`
              : `Workflow "${entry.name}" attempt ${attempt + 1} failed (${err?.message}), retrying with ${nextTimeoutSec}s timeout`;
          onPipelineProgress?.({
            type: "warning",
            stage: "spec_workflow_detail",
            message: retryMessage,
            context: { workflowName: entry.name, attempt: attempt + 1, total: orderedWorkflows.length, failureKind: isRateLimit ? "rate_limit" : failureKind, timeoutUsed: timeoutSec, nextTimeout: nextTimeoutSec, backoffMs: isRateLimit ? Math.round(backoffMs) : undefined },
          });

          if (backoffMs > 0) {
            await sleep(backoffMs);
          }
        }

        if (attempt === DETAIL_RETRY_LIMIT) {
          console.error(`[SpecDecomposer] Run ${runId}: Stubbing workflow "${entry.name}" after ${attempts} attempts (${wfDuration}ms, last failure: ${failureKind})`);
          const stub = makeStubWorkflow(entry);
          workflowDetails.set(entry.name, stub);
          metrics.stubCount++;
          mergeWarnings.push(`Workflow "${entry.name}" was stubbed after ${attempts} failed attempts (last failure: ${failureKind})`);
          onPipelineProgress?.({
            type: "warning",
            stage: "spec_workflow_detail",
            message: `Workflow "${entry.name}" stubbed after ${attempts} failed attempts (last failure: ${failureKind})`,
            context: { workflowName: entry.name, attempts, outcome: "stubbed", reason: err?.message, failureKind },
          });
          onPipelineProgress?.({
            type: "completed",
            stage: "spec_workflow_detail",
            message: `Workflow ${i + 1}/${orderedWorkflows.length} stubbed: ${entry.name}`,
            elapsed: (Date.now() - wfStart) / 1000,
            context: { workflowName: entry.name, index: i + 1, total: orderedWorkflows.length, outcome: "stubbed" },
          });

          try {
            const partialWorkflows = Array.from(workflowDetails.values());
            const partialSpec = {
              projectName: scaffold.projectName,
              description: scaffold.description,
              dependencies: scaffold.dependencies,
              workflows: partialWorkflows,
            };
            await storage.updateGenerationRunSpecSnapshot(runId, {
              partialSpec,
              completedWorkflows: partialWorkflows.map(w => w.name),
              stubbedWorkflows: [entry.name],
              totalWorkflows: scaffold.workflows.length,
              timestamp: new Date().toISOString(),
            });
          } catch {}
        }
      }
    }

    metrics.perWorkflow.push({
      name: entry.name,
      status: succeeded ? "succeeded" : "stubbed",
      attempts,
      durationMs: Date.now() - wfStart,
    });
  }

  const concurrency = Math.min(PARALLEL_CONCURRENCY, orderedWorkflows.length);
  console.log(`[SpecDecomposer] Run ${runId}: Generating ${orderedWorkflows.length} workflow(s) with concurrency ${concurrency}`);

  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < orderedWorkflows.length) {
      const i = nextIndex++;
      if (i >= orderedWorkflows.length) break;
      const entry = orderedWorkflows[i];
      await generateSingleWorkflow(entry, i);
    }
  }

  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  } finally {
    clearInterval(heartbeatInterval);
  }

  onPipelineProgress?.({
    type: "completed",
    stage: "spec_workflow_detail",
    message: `All ${orderedWorkflows.length} workflow details generated (${metrics.stubCount} stubbed${aggregateTimedOut ? ", aggregate timeout triggered" : ""})`,
    context: { totalWorkflows: orderedWorkflows.length, stubCount: metrics.stubCount, aggregateTimedOut },
  });

  onPipelineProgress?.({ type: "started", stage: "spec_merge", message: "Merging workflow specifications" });
  onProgress?.("Merging and validating package specification...");

  let mergedSpec: UiPathPackageSpec;
  try {
    mergedSpec = mergeSpec(scaffold, workflowDetails, mergeWarnings);
  } catch (err: any) {
    onPipelineProgress?.({ type: "failed", stage: "spec_merge", message: "Merge/validation failed" });
    throw new Error(`Spec merge/validation failed: ${err?.message}`);
  }

  if (mergeWarnings.length > 0) {
    for (const warn of mergeWarnings) {
      console.warn(`[SpecDecomposer] Run ${runId}: Merge warning — ${warn}`);
    }
  }

  onPipelineProgress?.({
    type: "completed",
    stage: "spec_merge",
    message: `Package spec merged: ${mergedSpec.workflows.length} workflows`,
    context: { workflowCount: mergedSpec.workflows.length, warnings: mergeWarnings },
  });

  metrics.totalElapsedMs = Date.now() - overallStart;

  console.log(`[SpecDecomposer] Run ${runId}: Decomposition complete — ${mergedSpec.workflows.length} workflows, ${metrics.stubCount} stubs, ${metrics.totalLlmCalls} LLM calls, ${metrics.totalElapsedMs}ms total`);

  return { packageSpec: mergedSpec, metrics };
}
