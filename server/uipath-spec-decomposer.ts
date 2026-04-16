import { getCodeLLM, SDD_LLM_TIMEOUT_MS, getActiveCodeModel, getActiveModel } from "./lib/llm";
import { sanitizeAndParseJson, diagnoseJsonFailure } from "./lib/json-utils";
import { uipathPackageSchema, type UiPathPackageSpec } from "./types/uipath-package";
import { repairTruncatedPackageJson } from "./uipath-prompts";
import { storage } from "./storage";
import { RunLogger } from "./lib/run-logger";
import { sanitizeValueIntentExpressions } from "./xaml/expression-builder";
import { buildCompactCatalogSummary } from "./catalog/xaml-template-builder";
import { normalizeWorkflowName } from "./workflow-name-utils";
import { catalogService } from "./catalog/catalog-service";
import { recordLlmCall, buildLlmTraceEntry } from "./llm-trace-collector";

const SCAFFOLD_MAX_TOKENS = 4096;
const SCAFFOLD_RETRY_LIMIT = 3;
const SCAFFOLD_TIMEOUT_ESCALATION_MS = 60_000;
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

function extractHttpStatus(err: any): number {
  const explicit = err?.status ?? err?.statusCode ?? 0;
  if (explicit) return explicit;
  const match = (err?.message ?? "").match(/\((\d{3})\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function isTransientError(err: any): boolean {
  if (isRateLimitError(err)) return true;
  const msg = (err?.message ?? "").toLowerCase();
  const status = extractHttpStatus(err);
  if (/timed?\s*out/i.test(msg) || msg.includes("timeout") || msg.includes("econnreset") || msg.includes("econnrefused") || msg.includes("socket hang up") || msg.includes("fetch failed")) return true;
  if (status >= 500 && status < 600) return true;
  if (status === 404) return true;
  if (status === 401 || status === 403) return false;
  return false;
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

export interface SpecScaffoldMeta {
  executionOrder: string[];
  workflowContracts: Array<{
    name: string;
    invokes: string[];
    sharedArguments: Array<{ name: string; direction: "in" | "out" | "in_out"; type: string }>;
  }>;
}

export interface DecomposedSpecResult {
  packageSpec: UiPathPackageSpec;
  metrics: DecompositionMetrics;
  scaffoldMeta: SpecScaffoldMeta;
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
        { "name": "string (PascalCase)", "direction": "in|out|in_out", "type": "String|Int32|Boolean|DataTable|Dictionary<String,Object>|Array<String>|DateTime|SecureString" }
      ],
      "sharedAssets": ["asset names referenced by this workflow"]
    }
  ],
  "sharedQueueNames": ["queue names used across workflows"],
  "sharedAssetNames": ["orchestrator asset names used across workflows"],
  "executionOrder": ["Main", "SubWorkflow1", "SubWorkflow2 (topological order)"]
}

IMPORTANT RULES:
- NEVER name a custom workflow "Main", "Process", "Init", "GetTransactionData", "SetTransactionStatus", "CloseAllApplications", "KillAllProcesses", "InitAllApplications", "RetryCurrentTransaction", "RetryInit", "BuildTransactionData", "CleanupAndPrep", "SendNotifications", "Finalise", or "Finalize". These are auto-generated REFramework infrastructure files. Name your orchestration workflows descriptively instead.
  - WRONG: "Main" (collides with REFramework Main.xaml)
  - WRONG: "Process" (collides with REFramework Process.xaml)
  - RIGHT: "OrchestrateGreetings", "RunDispatcherPerformer", "ProcessInvoices", "ExecuteReconciliation"
- Error handling (TryCatch, RetryScope) belongs INLINE within workflows — do NOT create separate error-handler or retry .xaml files
- Only create a dedicated utility/helper workflow when the logic is genuinely reused by 2+ caller workflows (e.g., a shared login sequence)
- Separate workflows ARE appropriate for: dispatcher/performer patterns, REFramework structure (Init/Process/End), Action Center / HITL boundaries, and genuinely distinct business sub-processes
- The invokes array defines the invocation graph: which workflows call which via InvokeWorkflowFile
- sharedArguments are input/output arguments that define a workflow's interface to ITS callers. Use CONCRETE types (String, Int32, Boolean, DataTable, etc.) — never bare "Object" unless genuinely polymorphic (generic container types like Dictionary<String,Object> are fine). Every argument MUST specify name, direction, and type.
- A workflow's sharedArguments define its own public interface — callers pass data via local variables, config entries, or computed values. Do NOT duplicate callee arguments into the caller's sharedArguments unless the caller genuinely needs to expose them to its own callers.
- executionOrder should be topological: invoked (dependency) workflows should come BEFORE the workflows that call them, so dependencies are generated first
- List ALL required UiPath package dependencies
- Keep it concise — this is the project skeleton, not full workflow details

Return ONLY the JSON object, no other text.`;
}

function buildStudioProfileBlock(): string {
  const profile = catalogService.getStudioProfile();
  if (!profile) return "";
  const lines: string[] = [
    "=== STUDIO PROFILE ===",
    `Studio: ${profile.studioLine} v${profile.studioVersion}`,
    `Target Framework: ${profile.targetFramework}`,
    `Expression Language: ${profile.expressionLanguage}`,
  ];
  if (profile.minimumRequiredPackages && Object.keys(profile.minimumRequiredPackages).length > 0) {
    lines.push(`Minimum Required Packages: ${Object.entries(profile.minimumRequiredPackages).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
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

  const studioProfile = buildStudioProfileBlock();

  return `You are a Senior Developer and Solution Architect. Apply production engineering rigor: use camelCase for all variable names, provide meaningful defaultValues (not empty strings for critical variables), include logging-level annotations in step notes at every decision point and error handler, use realistic selectorHints with tag/attribute structure (not just placeholder text), and set errorHandling deliberately — "none" only for steps that genuinely cannot fail. Anticipate specific runtime failures (selector not found, API timeout, file locked, stale data) rather than relying on generic TryCatch. Comply strictly with the JSON schema below — no extra fields, no missing required fields, no prose outside the JSON.

${studioProfile}Generate the full workflow specification for the "${workflow.name}" workflow in the UiPath project "${scaffold.projectName}".

PROJECT CONTEXT:
${contextLines.join("\n")}

WORKFLOW PURPOSE:
${workflow.description}
${workflow.invokes?.length ? `This workflow invokes: ${workflow.invokes.join(", ")}` : ""}

${buildCompactCatalogSummary() || ""}
Output a JSON object with this exact shape:
{
  "name": "${workflow.name}",
  "description": "${workflow.description}",
  "arguments": [
    {
      "name": "string (argument name matching scaffold contract)",
      "direction": "in|out|in_out",
      "type": "String|Int32|Boolean|DataTable|Object|DateTime|Array<String>|Dictionary<String,Object>"
    }
  ],
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
      "activityType": "string (exact UiPath activity name from the AVAILABLE ACTIVITIES catalog below)",
      "activityPackage": "string (UiPath package namespace)",
      "properties": {
        "PropertyName": { "type": "literal", "value": "some text or prompt content" },
        "VariableRef": { "type": "variable", "name": "myVariable" },
        "ConditionExpr": { "type": "expression", "left": "variableName", "operator": "=", "right": "expectedValue" }
      },
      // IMPORTANT: For "expression" type, both "left" and "right" MUST be non-empty strings. Never use "" for left or right — use a meaningful variable name or literal value (e.g. "0", "Nothing", "True").
      "selectorHint": "string or null (placeholder UI selector for UI activities)",
      "errorHandling": "retry|catch|escalate|none",
      "notes": "string (implementation notes)"
    }
  ]
}

TYPED PROPERTY VALUES:
Every value in "properties" MUST be a typed object — NOT a bare string. Use one of:
- { "type": "literal", "value": "..." } — for text content, prompts, display strings, file paths, fixed config values, enum values, and any value that should be treated as a string literal in XAML. Do NOT use literal for values containing VB code like String.Format(...), concatenation with &, or method calls.
- { "type": "variable", "name": "variableName" } — for VB variable or argument references (the name without brackets; the build system adds [brackets])
- { "type": "expression", "left": "varName", "operator": "=", "right": "value" } — for conditions and comparisons ONLY. Allowed operators: =, <>, <, >, <=, >=, Is, IsNot, Like, AndAlso, OrElse. Do NOT use expression for string concatenation.
- { "type": "vb_expression", "value": "..." } — for raw VB expressions including string concatenation with &, function calls like String.Format(...), and any compound VB code that is NOT a simple comparison. The build system will bracket-wrap the value.
- { "type": "url_with_params", "baseUrl": "https://...", "params": { "key": "value" } } — for URLs with query parameters

CORRECT Examples:
  "Prompt": { "type": "literal", "value": "Write a birthday email for the customer" }
  "To": { "type": "variable", "name": "recipientEmail" }
  "Condition": { "type": "expression", "left": "retryCount", "operator": "<", "right": "3" }
  "Message": { "type": "vb_expression", "value": "\"[Init] RunId=\" & runId" }
  "Value": { "type": "vb_expression", "value": "String.Format(\"run_summary_{0}.json\", in_RunId)" }
  "DisplayName": { "type": "vb_expression", "value": "\"Processing: \" & in_FullName & \" (\" & str_Status & \")\"" }
  "Url": { "type": "url_with_params", "baseUrl": "https://api.example.com/users", "params": { "id": "userId" } }
  "FilePath": { "type": "literal", "value": "C:\\Data\\output.xlsx" }
  "Value": { "type": "variable", "name": "currentTransaction" }
  "Level": { "type": "literal", "value": "Info" }
  "Priority": { "type": "literal", "value": "Normal" }

ENUM PROPERTIES — enum-typed properties (LogMessage Level, AddQueueItem Priority, etc.) MUST use { "type": "literal", "value": "ValidEnumValue" } with ONLY catalog-valid values. Never use a bare string for enum values.

WRONG (do NOT do this):
  ✗ "Level": "Info"                      → MUST be { "type": "literal", "value": "Info" }
  ✗ "To": "str_Email"                    → MUST be { "type": "variable", "name": "str_Email" }
  ✗ "Message": "str_LogMessage"          → MUST be { "type": "variable", "name": "str_LogMessage" }
  ✗ "Priority": { "type": "variable", "name": "High" } → "High" is an enum value, not a variable — use { "type": "literal", "value": "High" }
  ✗ "Message": { "type": "literal", "value": "\"text\" & varName & \"text\"" } → contains VB concatenation — use { "type": "vb_expression", "value": "\"text\" & varName & \"text\"" }
  ✗ "Value": { "type": "literal", "value": "String.Format(\"x_{0}\", id)" } → contains VB function call — use { "type": "vb_expression", "value": "String.Format(\"x_{0}\", id)" }
  ✗ "Message": { "type": "expression", "left": "\"text\" & var", "operator": "=", "right": "\"text\" & var" } → expression is for comparisons only — use { "type": "vb_expression", "value": "\"text\" & var" }

IMPORTANT RULES:
- Use SPECIFIC UiPath activity names in activityType
- For UI automation steps, include a selectorHint with a realistic placeholder selector
- For system interaction steps, set errorHandling to "retry" or "catch"
- Include ALL variables needed by the workflow
- Include specific properties for each activity using the typed format above
- Map decision points to If/Switch activities
- Map loops to ForEach/While activities
- Be as specific and production-ready as possible

HARD CONSTRAINTS — CATALOG BOUNDARY:
- ONLY use activity names that appear in the AVAILABLE ACTIVITIES catalog above or the Built-in Activities list. Do NOT invent activity names, class names, or aliases.
- ONLY use property names that are listed for each activity in the catalog. Do NOT invent property names.
- ONLY use enum values that are listed for each activity's enum properties. Do NOT invent enum values.
- ONLY reference dependency packages that appear in the catalog. Do NOT invent package names.
- Every variable referenced in steps MUST be declared in the "variables" array with a concrete type.
- Follow catalog xamlSyntax metadata: if a property is marked as a child element (not an attribute), emit it accordingly.
- When using InvokeWorkflowFile, the target workflow MUST exist in this project's workflow list and all required in/out arguments MUST be wired.

VB.NET EXPRESSION SYNTAX (expressionLanguage = VisualBasic):
- All expressions use VB.NET syntax — not C#, not JavaScript.
- String concatenation: use "&" operator (e.g. "Hello " & variableName), NEVER "+".
- Not-equal comparison: use "<>" (e.g. status <> "Done"), NEVER "!=".
- No string interpolation: do NOT use $"..." syntax. Use String.Format or "&" concatenation.
- Variable references in expression attributes MUST be bracket-wrapped: [variableName].
- Boolean literals: True / False (PascalCase), not true / false.
- Nothing instead of null.
- Logical operators: AndAlso, OrElse, Not — not &&, ||, !.

OUTPUT FORMAT RULES (strict):
- Workflow names must NOT include file extensions (no ".xaml") or surrounding quotes
- Enum values for LogMessage Level must be bare keywords from: Trace, Info, Warn, Error, Fatal — never use "Information", "Warning", or "Debug"
- Expression "left" and "right" fields must NEVER be empty strings — use a variable name or literal value
- GetAsset output must be a simple variable name (e.g. "str_MaxRetry"), never a dictionary key access like dict_Config("key")
- ForEach "iteratorName" must be a valid identifier matching variables used in body expressions
- InvokeWorkflowFile "WorkflowFileName" must be a plain filename like Init.xaml without surrounding quotes
- Property values must never be wrapped in extra quotes unless they are genuine string literals

ERROR HANDLING:
- Use the "errorHandling" field on each step to declare retry/catch intent. The build system handles TryCatch/RetryScope wrapping automatically.
- Prefer flat step sequences over deeply nested control flow. Do NOT manually nest TryCatch or RetryScope activities — the builder does this for you based on the errorHandling field.
- Wire arguments explicitly: every InvokeWorkflowFile must specify all required in/out/in_out arguments in its properties with correct variable references.
- Do NOT create separate error-handler .xaml files — all error handling belongs inline within the workflow.

CRITICAL OPERATION REPRESENTATION RULES — ONE CANONICAL FORM ONLY:
For critical operations (mail send, task create/wait, invoke workflow, Data Service CRUD), you MUST emit exactly ONE representation per logical operation. Do NOT emit both:
  1. A narrative/prose TryCatch container describing the operation in text, AND
  2. A concrete executable step (e.g. GmailSendMessage, SendOutlookMailMessage, CreateFormTask) for the same logical operation.
Pick the concrete executable step as the canonical representation. If TryCatch wrapping is needed, use the "errorHandling" field on the step — do NOT create a separate narrative TryCatch sequence that describes the same send/create/invoke action in prose.
- Each mail send operation → exactly one concrete send step (GmailSendMessage, SendSmtpMailMessage, or SendOutlookMailMessage) with To, Subject, Body populated.
- Each Action Center task → exactly one CreateFormTask or WaitForFormTask step with required properties.
- Each Data Service CRUD → exactly one concrete step (CreateEntity, UpdateEntity, QueryEntity, DeleteEntity).
- Each InvokeWorkflowFile → exactly one invocation step with all required arguments wired.
- NEVER duplicate a critical operation as both a high-level narrative container AND a concrete activity step. The downstream build system will reject duplicate representations.

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

interface ScaffoldValidationResult {
  errors: string[];
  warnings: string[];
}

function isBareObjectType(type: string): boolean {
  const trimmed = type.trim();
  return trimmed === "Object" && !/<|>/.test(type);
}

function validateScaffoldArgumentContracts(scaffold: ScaffoldResult): ScaffoldValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const workflowNames = new Set(scaffold.workflows.map(w => w.name));
  const seenWorkflowNames = new Set<string>();

  for (const wf of scaffold.workflows) {
    if (seenWorkflowNames.has(wf.name)) {
      errors.push(`Duplicate workflow name: "${wf.name}" appears more than once in the scaffold`);
    }
    seenWorkflowNames.add(wf.name);

    if (!wf.name || !/^[A-Za-z][A-Za-z0-9_]*$/.test(wf.name)) {
      errors.push(`Invalid workflow name: "${wf.name}" — must be a valid identifier (alphanumeric and underscores, starting with a letter)`);
    }

    for (const arg of wf.sharedArguments || []) {
      if (!arg.name || !arg.direction || !arg.type) {
        errors.push(`Malformed argument in "${wf.name}": missing required field(s) (name, direction, or type) — got ${JSON.stringify(arg)}`);
        continue;
      }
      if (isBareObjectType(arg.type)) {
        const likelySpecific = /path|file|name|url|id|email|date|count|flag|status|message|text|folder|dir/i.test(arg.name);
        if (likelySpecific) {
          warnings.push(`Suspicious type: "${wf.name}" argument "${arg.name}" uses bare "Object" but the name suggests a more specific type (e.g., String, Int32, Boolean)`);
        } else {
          warnings.push(`Generic type: "${wf.name}" argument "${arg.name}" uses bare "Object" — consider a concrete type if possible`);
        }
      }
    }
  }

  for (const caller of scaffold.workflows) {
    if (!caller.invokes?.length) continue;
    for (const calleeName of caller.invokes) {
      if (!workflowNames.has(calleeName)) {
        errors.push(`"${caller.name}" invokes undeclared workflow "${calleeName}" — add it to the scaffold or remove the reference`);
      }
    }
  }

  const allArgs = new Map<string, Array<{ workflow: string; direction: string; type: string }>>();
  for (const wf of scaffold.workflows) {
    for (const arg of wf.sharedArguments || []) {
      if (!arg.name || !arg.direction || !arg.type) continue;
      if (!allArgs.has(arg.name)) allArgs.set(arg.name, []);
      allArgs.get(arg.name)!.push({ workflow: wf.name, direction: arg.direction, type: arg.type });
    }
  }
  for (const [argName, entries] of Array.from(allArgs)) {
    if (entries.length < 2) continue;
    const types = new Set(entries.map(e => e.type));
    if (types.size > 1) {
      const details = entries.map(e => `"${e.workflow}" (${e.type})`).join(", ");
      warnings.push(`Type inconsistency: argument "${argName}" has different types across workflows: ${details}`);
    }
    const directions = new Set(entries.map(e => e.direction));
    if (directions.size > 1) {
      const details = entries.map(e => `"${e.workflow}" (${e.direction})`).join(", ");
      warnings.push(`Direction inconsistency: argument "${argName}" has different directions across workflows: ${details}`);
    }
  }

  return { errors, warnings };
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

  sanitizeValueIntentExpressions(parsed);

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

  const scaffoldNameSet = new Set(scaffold.workflows.map(w => normalizeWorkflowName(w.name)));

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
          const wfProp = step.properties["WorkflowFileName"];
          const wfFileName = typeof wfProp === "string" ? wfProp : (wfProp && typeof wfProp === "object" && "type" in wfProp && wfProp.type === "literal" && "value" in wfProp ? String(wfProp.value) : String(wfProp));
          const targetName = normalizeWorkflowName(wfFileName);
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

  for (const wf of workflows) {
    const scaffoldEntry = scaffold.workflows.find(e => e.name === wf.name);
    if (scaffoldEntry?.sharedArguments && scaffoldEntry.sharedArguments.length > 0) {
      const scaffoldArgs = scaffoldEntry.sharedArguments;
      const llmArgs: Array<{ name: string; direction: string; type: string }> = wf.arguments || [];
      const llmArgMap = new Map(llmArgs.map(a => [a.name.toLowerCase(), a]));
      const reconciledArgs: typeof wf.arguments = [];
      for (const sArg of scaffoldArgs) {
        const llmMatch = llmArgMap.get(sArg.name.toLowerCase());
        if (llmMatch && llmMatch.direction === sArg.direction && llmMatch.type === sArg.type) {
          reconciledArgs.push({ name: sArg.name, direction: sArg.direction, type: sArg.type });
        } else {
          if (llmMatch) {
            console.warn(`[SpecDecomposer] LLM argument "${llmMatch.name}" for "${wf.name}" conflicts with scaffold (LLM: dir=${llmMatch.direction} type=${llmMatch.type}, scaffold: dir=${sArg.direction} type=${sArg.type}) — using scaffold as canonical`);
          }
          reconciledArgs.push({ name: sArg.name, direction: sArg.direction, type: sArg.type });
        }
      }
      for (const llmArg of llmArgs) {
        const inScaffold = scaffoldArgs.some(s => s.name.toLowerCase() === llmArg.name.toLowerCase());
        if (!inScaffold) {
          console.warn(`[SpecDecomposer] LLM-only argument "${llmArg.name}" for "${wf.name}" not in scaffold — discarding (scaffold is canonical)`);
        }
      }
      wf.arguments = reconciledArgs;
    } else if (!scaffoldEntry?.sharedArguments || scaffoldEntry.sharedArguments.length === 0) {
      if (wf.arguments && wf.arguments.length > 0) {
        console.warn(`[SpecDecomposer] LLM output ${wf.arguments.length} argument(s) for "${wf.name}" but scaffold has none — discarding (scaffold is canonical)`);
        wf.arguments = [];
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
  let scaffoldLlmDuration = 0;
  let scaffoldTimeoutEscalations = 0;
  let scaffoldLlmOptions: any;
  for (let attempt = 0; attempt <= SCAFFOLD_RETRY_LIMIT; attempt++) {
    const escalatedTimeout = SDD_LLM_TIMEOUT_MS + (scaffoldTimeoutEscalations * SCAFFOLD_TIMEOUT_ESCALATION_MS);
    console.log(`[SpecDecomposer] Run ${runId}: Scaffold attempt ${attempt + 1}/${SCAFFOLD_RETRY_LIMIT + 1} (timeout: ${Math.round(escalatedTimeout / 1000)}s)`);

    scaffoldLlmOptions = {
      maxTokens: SCAFFOLD_MAX_TOKENS,
      system: systemContext,
      messages: [{ role: "user", content: buildScaffoldPrompt(complexityGuidance) }] as Array<{ role: "user" | "assistant"; content: string }>,
      timeoutMs: escalatedTimeout,
    };
    const scaffoldCallStart = Date.now();
    try {
      metrics.totalLlmCalls++;
      scaffoldResponse = await getCodeLLM().create(scaffoldLlmOptions);
      scaffoldLlmDuration = Date.now() - scaffoldCallStart;
      break;
    } catch (err: any) {
      recordLlmCall(runId, buildLlmTraceEntry(
        "spec_scaffold",
        scaffoldLlmOptions,
        "",
        Date.now() - scaffoldCallStart,
        "error",
        err?.message || "Unknown error",
        getActiveCodeModel() || getActiveModel(),
      ));
      const isTimeout = /timed?\s*out/i.test(err?.message ?? "");
      const failureKind = isTimeout ? "timeout" : "error";
      const attemptDuration = Date.now() - scaffoldStart;
      console.warn(`[SpecDecomposer] Run ${runId}: Scaffold attempt ${attempt + 1} failed (${failureKind}) after ${attemptDuration}ms: ${err?.message}`);
      runLogger.recordRetry("spec_scaffold", attempt + 1, err?.message);

      if (isTimeout) {
        scaffoldTimeoutEscalations++;
      }

      if (attempt < SCAFFOLD_RETRY_LIMIT && isTransientError(err)) {
        const isRateLimit = isRateLimitError(err);
        const backoffMs = backoffWithJitter(attempt);
        const nextTimeout = SDD_LLM_TIMEOUT_MS + (scaffoldTimeoutEscalations * SCAFFOLD_TIMEOUT_ESCALATION_MS);
        const retryMessage = isTimeout
          ? `Scaffold attempt ${attempt + 1} timed out, backing off ${Math.round(backoffMs)}ms, retrying with ${Math.round(nextTimeout / 1000)}s timeout`
          : isRateLimit
            ? `Scaffold attempt ${attempt + 1} rate-limited, backing off ${Math.round(backoffMs)}ms before retry`
            : `Scaffold attempt ${attempt + 1} failed (${err?.message}), backing off ${Math.round(backoffMs)}ms, retrying with ${Math.round(nextTimeout / 1000)}s timeout`;
        onPipelineProgress?.({
          type: "warning",
          stage: "spec_scaffold",
          message: retryMessage,
          context: { attempt: attempt + 1, maxAttempts: SCAFFOLD_RETRY_LIMIT + 1, failureKind: isRateLimit ? "rate_limit" : failureKind, backoffMs: Math.round(backoffMs) },
        });
        onProgress?.(`Retrying scaffold (retry ${attempt + 1}/${SCAFFOLD_RETRY_LIMIT})...`);
        await sleep(backoffMs);
        continue;
      }

      runLogger.stageEnd("spec_scaffold", "failed", undefined, err?.message);
      onPipelineProgress?.({ type: "failed", stage: "spec_scaffold", message: `Scaffold generation failed after ${attempt + 1} attempt(s)` });
      throw new Error(`Scaffold LLM call failed after ${attempt + 1} attempt(s): ${err?.message}`);
    }
  }
  metrics.scaffoldDurationMs = Date.now() - scaffoldStart;

  let scaffold: ScaffoldResult;
  const scaffoldRawText = scaffoldResponse!.text || "";
  try {
    scaffold = parseScaffold(scaffoldRawText || "{}");
  } catch (err: any) {
    recordLlmCall(runId, buildLlmTraceEntry(
      "spec_scaffold",
      scaffoldLlmOptions,
      scaffoldRawText,
      scaffoldLlmDuration,
      "parse_error",
      err?.message || "Parse failed",
      getActiveCodeModel() || getActiveModel(),
    ));
    runLogger.stageEnd("spec_scaffold", "failed", undefined, err?.message);
    onPipelineProgress?.({ type: "failed", stage: "spec_scaffold", message: "Failed to parse scaffold" });
    throw new Error(`Scaffold parse failed: ${err?.message}`);
  }

  recordLlmCall(runId, buildLlmTraceEntry(
    "spec_scaffold",
    scaffoldLlmOptions,
    scaffoldRawText,
    scaffoldLlmDuration,
    "success",
    undefined,
    getActiveCodeModel() || getActiveModel(),
  ));

  let validation = validateScaffoldArgumentContracts(scaffold);

  if (validation.warnings.length > 0) {
    const warnSummary = validation.warnings.join("; ");
    console.warn(`[SpecDecomposer] Run ${runId}: Scaffold validation warnings (${validation.warnings.length}): ${warnSummary}`);
    onPipelineProgress?.({
      type: "warning",
      stage: "spec_scaffold",
      message: `Scaffold has ${validation.warnings.length} non-blocking warning(s)`,
      context: { warnings: validation.warnings },
    });
  }

  if (validation.errors.length > 0) {
    const errorSummary = validation.errors.join("; ");
    console.warn(`[SpecDecomposer] Run ${runId}: Scaffold has ${validation.errors.length} blocking error(s), attempting feedback retry: ${errorSummary}`);
    onPipelineProgress?.({
      type: "warning",
      stage: "spec_scaffold",
      message: `Scaffold has ${validation.errors.length} blocking error(s) — retrying with feedback`,
      context: { errors: validation.errors },
    });
    onProgress?.("Scaffold had structural errors, retrying with corrections...");

    const correctionPrompt = `The scaffold you generated has the following structural errors that must be fixed:\n\n${validation.errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\nPlease regenerate the complete scaffold JSON, fixing all listed errors. Return ONLY the corrected JSON object, no other text.`;
    const retryLlmOptions = {
      maxTokens: SCAFFOLD_MAX_TOKENS,
      system: systemContext,
      messages: [
        { role: "user" as const, content: buildScaffoldPrompt(complexityGuidance) },
        { role: "assistant" as const, content: scaffoldResponse!.text || "{}" },
        { role: "user" as const, content: correctionPrompt },
      ],
      timeoutMs: SDD_LLM_TIMEOUT_MS + SCAFFOLD_TIMEOUT_ESCALATION_MS,
    };
    const retryCallStart = Date.now();
    try {
      metrics.totalLlmCalls++;
      const retryResponse = await getCodeLLM().create(retryLlmOptions);
      const retryDuration = Date.now() - retryCallStart;
      const retryRawText = retryResponse.text || "";

      let retryScaffold;
      try {
        retryScaffold = parseScaffold(retryRawText || "{}");
      } catch (parseErr: any) {
        recordLlmCall(runId, buildLlmTraceEntry(
          "spec_scaffold_feedback_retry",
          retryLlmOptions,
          retryRawText,
          retryDuration,
          "parse_error",
          parseErr?.message || "Parse failed",
          getActiveCodeModel() || getActiveModel(),
        ));
        throw parseErr;
      }

      recordLlmCall(runId, buildLlmTraceEntry(
        "spec_scaffold_feedback_retry",
        retryLlmOptions,
        retryRawText,
        retryDuration,
        "success",
        undefined,
        getActiveCodeModel() || getActiveModel(),
      ));

      const retryValidation = validateScaffoldArgumentContracts(retryScaffold);

      if (retryValidation.warnings.length > 0) {
        const warnSummary = retryValidation.warnings.join("; ");
        console.warn(`[SpecDecomposer] Run ${runId}: Retry scaffold warnings (${retryValidation.warnings.length}): ${warnSummary}`);
        onPipelineProgress?.({
          type: "warning",
          stage: "spec_scaffold",
          message: `Retry scaffold has ${retryValidation.warnings.length} non-blocking warning(s)`,
          context: { warnings: retryValidation.warnings },
        });
      }

      if (retryValidation.errors.length > 0) {
        const retryErrorSummary = retryValidation.errors.join("; ");
        console.error(`[SpecDecomposer] Run ${runId}: Scaffold still has ${retryValidation.errors.length} blocking error(s) after feedback retry: ${retryErrorSummary}`);
        runLogger.stageEnd("spec_scaffold", "failed", undefined, `Argument contract violations after retry: ${retryErrorSummary}`);
        onPipelineProgress?.({
          type: "failed",
          stage: "spec_scaffold",
          message: `Scaffold has ${retryValidation.errors.length} blocking error(s) after feedback retry — halting`,
          context: { errors: retryValidation.errors },
        });
        throw new Error(`Scaffold argument contract violations after feedback retry (${retryValidation.errors.length}): ${retryErrorSummary}`);
      }

      scaffold = retryScaffold;
      validation = retryValidation;
      console.log(`[SpecDecomposer] Run ${runId}: Scaffold feedback retry succeeded — errors resolved`);
      onPipelineProgress?.({
        type: "progress",
        stage: "spec_scaffold",
        message: "Scaffold feedback retry succeeded — all blocking errors resolved",
      });
    } catch (retryErr: any) {
      const isContractViolation = retryErr?.message?.startsWith("Scaffold argument contract violations after feedback retry");
      const isParseError = retryErr?.message?.includes("Parse failed") || retryErr?.message?.includes("JSON");
      if (!isContractViolation && !isParseError) {
        recordLlmCall(runId, buildLlmTraceEntry(
          "spec_scaffold_feedback_retry",
          retryLlmOptions,
          "",
          Date.now() - retryCallStart,
          "error",
          retryErr?.message || "Unknown error",
          getActiveCodeModel() || getActiveModel(),
        ));
      }
      if (isContractViolation) {
        throw retryErr;
      }
      const originalErrorSummary = validation.errors.join("; ");
      console.error(`[SpecDecomposer] Run ${runId}: Scaffold feedback retry failed (${retryErr?.message}), failing with original errors`);
      runLogger.stageEnd("spec_scaffold", "failed", undefined, `Argument contract violations: ${originalErrorSummary}`);
      onPipelineProgress?.({
        type: "failed",
        stage: "spec_scaffold",
        message: `Scaffold has ${validation.errors.length} blocking error(s) — feedback retry also failed`,
        context: { errors: validation.errors, retryError: retryErr?.message },
      });
      throw new Error(`Scaffold argument contract violations (${validation.errors.length}): ${originalErrorSummary}`);
    }
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

  const budgetMatch = complexityGuidance?.match(/~(\d+)[–-](\d+)\s+workflows/);
  const budgetMax = budgetMatch ? parseInt(budgetMatch[2], 10) : 0;
  const isSimpleTier = complexityGuidance?.toLowerCase().includes("simple") || (budgetMax > 0 && budgetMax <= 3);

  if (isSimpleTier && scaffold.workflows.length > (budgetMax || 3)) {
    const INFRA_NAMES = new Set(["Main", "Init", "InitAllSettings", "GetTransactionData", "SetTransactionStatus", "CloseAllApplications", "KillAllProcesses", "Process"]);
    const infraWorkflows = scaffold.workflows.filter(w => INFRA_NAMES.has(w.name));
    const businessWorkflows = scaffold.workflows.filter(w => !INFRA_NAMES.has(w.name));

    if (businessWorkflows.length > 1) {
      const mergedDescription = businessWorkflows.map(w => `${w.name}: ${w.description}`).join("; ");
      const mergedInvokes = businessWorkflows.flatMap(w => w.invokes || []);
      const mergedArgs = businessWorkflows.flatMap(w => w.sharedArguments || []);
      const processWf = infraWorkflows.find(w => w.name === "Process") || {
        name: "Process",
        description: `Process transaction — ${mergedDescription}`,
        invokes: mergedInvokes,
        sharedArguments: mergedArgs,
        sharedAssets: [],
      };
      if (infraWorkflows.find(w => w.name === "Process")) {
        processWf.description += ` | Collapsed: ${mergedDescription}`;
      }

      scaffold.workflows = [...infraWorkflows.filter(w => w.name !== "Process"), processWf];
      console.log(`[SpecDecomposer] Complexity gate: Collapsed ${businessWorkflows.length} business workflow(s) into Process.xaml for simple automation (budget max: ${budgetMax || 3})`);
    }
  }

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
    const estimatedTokens = Math.ceil(detailPrompt.length / 3.5);
    console.log(`[SpecDecomposer] Prompt for "${entry.name}": ${detailPrompt.length} chars (~${estimatedTokens} tokens)`);
    if (estimatedTokens > 30000) {
      console.warn(`[SpecDecomposer] Token budget warning: prompt for "${entry.name}" exceeds 30k tokens (~${estimatedTokens})`);
    }

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

      const detailLlmOptions = {
        maxTokens: DETAIL_MAX_TOKENS,
        system: systemContext,
        messages: [{ role: "user", content: detailPrompt }] as Array<{ role: "user" | "assistant"; content: string }>,
        timeoutMs: perWorkflowTimeout,
      };
      const detailCallStart = Date.now();
      try {
        const detailResponse = await getCodeLLM().create(detailLlmOptions);
        const detailDuration = Date.now() - detailCallStart;
        const detailRawText = detailResponse.text || "";

        let detail;
        try {
          detail = parseWorkflowDetail(detailRawText || "{}", entry.name, runLogger);
        } catch (parseErr: any) {
          recordLlmCall(runId, buildLlmTraceEntry(
            `spec_detail:${entry.name}`,
            detailLlmOptions,
            detailRawText,
            detailDuration,
            "parse_error",
            parseErr?.message || "Parse failed",
            getActiveCodeModel() || getActiveModel(),
          ));
          throw parseErr;
        }

        recordLlmCall(runId, buildLlmTraceEntry(
          `spec_detail:${entry.name}`,
          detailLlmOptions,
          detailRawText,
          detailDuration,
          "success",
          undefined,
          getActiveCodeModel() || getActiveModel(),
        ));

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
        recordLlmCall(runId, buildLlmTraceEntry(
          `spec_detail:${entry.name}`,
          detailLlmOptions,
          "",
          Date.now() - detailCallStart,
          "error",
          err?.message || "Unknown error",
          getActiveCodeModel() || getActiveModel(),
        ));
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

  const scaffoldMeta: SpecScaffoldMeta = {
    executionOrder,
    workflowContracts: scaffold.workflows.map(w => ({
      name: w.name,
      invokes: w.invokes || [],
      sharedArguments: (w.sharedArguments || []).map(a => ({
        name: a.name,
        direction: a.direction,
        type: a.type,
      })),
    })),
  };

  return { packageSpec: mergedSpec, metrics, scaffoldMeta };
}
