import { getCodeLLM, SDD_LLM_TIMEOUT_MS } from "./lib/llm";
import { sanitizeAndParseJson } from "./lib/json-utils";
import { uipathPackageSchema, type UiPathPackageSpec } from "./types/uipath-package";
import { repairTruncatedPackageJson } from "./uipath-prompts";
import { storage } from "./storage";
import { RunLogger } from "./lib/run-logger";

const SCAFFOLD_MAX_TOKENS = 4096;
const DETAIL_MAX_TOKENS = 8192;
const DETAIL_RETRY_LIMIT = 2;
const DETAIL_LLM_TIMEOUT_MS = 90_000;
const DECOMPOSITION_AGGREGATE_TIMEOUT_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 4_000;

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

const SCAFFOLD_PROMPT = `You are a Senior Developer and Solution Architect. Apply production engineering rigor: enforce strict naming conventions (PascalCase project and workflow names, camelCase variables, PascalCase arguments), single-responsibility decomposition (each workflow does one thing well), meaningful shared arguments that cross workflow boundaries with clear direction, and realistic dependency declarations. Anticipate common runtime failures (selector timeouts, credential expiry, file locks) in the scaffold structure by ensuring error-handler and retry workflows are included where appropriate. Comply strictly with the JSON schema below — no extra fields, no missing required fields, no prose outside the JSON.

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
- Include ALL workflows needed for the automation (Main, sub-workflows, error handlers, utility workflows)
- The invokes array defines the invocation graph: which workflows call which via InvokeWorkflowFile
- sharedArguments are input/output arguments that cross workflow boundaries
- executionOrder should be topological: invoked (dependency) workflows should come BEFORE the workflows that call them, so dependencies are generated first
- List ALL required UiPath package dependencies
- Keep it concise — this is the project skeleton, not full workflow details

Return ONLY the JSON object, no other text.`;

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

function parseWorkflowDetail(rawText: string, workflowName: string): UiPathPackageSpec["workflows"][number] {
  let parsed: any;
  try {
    parsed = sanitizeAndParseJson(rawText);
  } catch {
    const repaired = repairTruncatedPackageJson(rawText);
    if (!repaired) throw new Error(`Failed to parse detail response for ${workflowName}`);
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
}

export async function generateDecomposedSpec(options: DecomposeOptions): Promise<DecomposedSpecResult> {
  const { systemContext, runId, runLogger, onProgress, onPipelineProgress } = options;
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
      messages: [{ role: "user", content: SCAFFOLD_PROMPT }],
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
  for (let i = 0; i < orderedWorkflows.length; i++) {
    const entry = orderedWorkflows[i];
    heartbeatState = { index: i, name: entry.name, total: orderedWorkflows.length };

    if (Date.now() - detailPhaseStart > DECOMPOSITION_AGGREGATE_TIMEOUT_MS) {
      aggregateTimedOut = true;
      const remainingNames = orderedWorkflows.slice(i).map(w => w.name);
      console.warn(`[SpecDecomposer] Run ${runId}: Aggregate timeout (${DECOMPOSITION_AGGREGATE_TIMEOUT_MS}ms) exceeded — stubbing ${remainingNames.length} remaining workflow(s): ${remainingNames.join(", ")}`);

      for (let j = i; j < orderedWorkflows.length; j++) {
        const remaining = orderedWorkflows[j];
        const stub = makeStubWorkflow(remaining);
        workflowDetails.set(remaining.name, stub);
        metrics.stubCount++;
        mergeWarnings.push(`Workflow "${remaining.name}" was stubbed due to aggregate timeout`);
        metrics.perWorkflow.push({
          name: remaining.name,
          status: "stubbed",
          attempts: 0,
          durationMs: 0,
        });
        onPipelineProgress?.({
          type: "warning",
          stage: "spec_workflow_detail",
          message: `Workflow "${remaining.name}" stubbed due to aggregate timeout`,
          context: { workflowName: remaining.name, index: j + 1, total: orderedWorkflows.length, outcome: "stubbed", reason: "aggregate_timeout" },
        });
      }

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
          stubbedWorkflows: remainingNames,
          totalWorkflows: scaffold.workflows.length,
          timestamp: new Date().toISOString(),
        });
      } catch {}
      break;
    }

    const wfStart = Date.now();
    let attempts = 0;
    let succeeded = false;

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
      const aggregateRemaining = DECOMPOSITION_AGGREGATE_TIMEOUT_MS - (Date.now() - detailPhaseStart);
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

      console.log(`[SpecDecomposer] Run ${runId}: Workflow "${entry.name}" attempt ${attempt + 1}/${DETAIL_RETRY_LIMIT + 1}`);

      try {
        const perWorkflowTimeout = Math.min(DETAIL_LLM_TIMEOUT_MS, aggregateRemaining);

        const detailResponse = await getCodeLLM().create({
          maxTokens: DETAIL_MAX_TOKENS,
          system: systemContext,
          messages: [{ role: "user", content: detailPrompt }],
          timeoutMs: perWorkflowTimeout,
        });

        const detail = parseWorkflowDetail(detailResponse.text || "{}", entry.name);
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
        console.warn(`[SpecDecomposer] Run ${runId}: Workflow "${entry.name}" attempt ${attempt + 1} failed after ${wfDuration}ms: ${err?.message}`);
        runLogger.recordRetry(`spec_workflow_detail_${entry.name}`, attempt + 1, err?.message);
        onPipelineProgress?.({
          type: "warning",
          stage: "spec_workflow_detail",
          message: `Workflow "${entry.name}" attempt ${attempt + 1} failed, retrying`,
          context: { workflowName: entry.name, attempt: attempt + 1, total: orderedWorkflows.length },
        });

        if (attempt === DETAIL_RETRY_LIMIT) {
          console.error(`[SpecDecomposer] Run ${runId}: Stubbing workflow "${entry.name}" after ${attempts} attempts (${wfDuration}ms)`);
          const stub = makeStubWorkflow(entry);
          workflowDetails.set(entry.name, stub);
          metrics.stubCount++;
          mergeWarnings.push(`Workflow "${entry.name}" was stubbed after ${attempts} failed attempts`);
          onPipelineProgress?.({
            type: "warning",
            stage: "spec_workflow_detail",
            message: `Workflow "${entry.name}" stubbed after ${attempts} failed attempts`,
            context: { workflowName: entry.name, attempts, outcome: "stubbed", reason: err?.message },
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
