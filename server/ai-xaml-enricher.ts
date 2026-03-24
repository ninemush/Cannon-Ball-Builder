import { getCodeLLM } from "./lib/llm";
import type { ProcessNode, ProcessEdge } from "@shared/schema";
import { sanitizeJsonString, stripCodeFences } from "./lib/json-utils";
import { isActivityAllowed } from "./uipath-activity-policy";
import type { AutomationPattern } from "./uipath-activity-registry";
import { catalogService, type ProcessType, type PaletteEntry } from "./catalog/catalog-service";
import { buildTemplateBlock, formatTemplateBlockForPrompt, formatCompactTemplateBlockForPrompt, shouldUseCompactFormat } from "./catalog/xaml-template-builder";
import { validateWorkflowSpec, type WorkflowSpec as TreeWorkflowSpec, type WorkflowNode, type PropertyValue } from "./workflow-spec-types";
import { isValueIntent, type ValueIntent } from "./xaml/expression-builder";

export interface EnrichedActivity {
  activityType: string;
  displayName: string;
  package: string;
  properties: Record<string, string>;
  selectorHint?: string;
  errorHandling: "retry" | "catch" | "escalate" | "none";
  timeout?: number;
  continueOnError?: boolean;
  delayBefore?: number;
  delayAfter?: number;
  variables: { name: string; type: string; defaultValue?: string }[];
}

export interface EnrichedNodeSpec {
  nodeId: number;
  nodeName: string;
  activities: EnrichedActivity[];
  gaps: {
    category: "selector" | "credential" | "endpoint" | "logic" | "config";
    activity: string;
    description: string;
    placeholder: string;
    estimatedMinutes: number;
  }[];
}

export interface WorkflowDecomposition {
  name: string;
  description: string;
  nodeIds: number[];
  isDispatcher?: boolean;
  isPerformer?: boolean;
}

export interface EnrichmentResult {
  nodes: EnrichedNodeSpec[];
  decomposition: WorkflowDecomposition[];
  useReFramework: boolean;
  reframeworkConfig?: {
    queueName: string;
    maxRetries: number;
    processName: string;
  };
  dhgNotes: string[];
  arguments?: Array<{ name: string; direction: string; type: string; required?: boolean }>;
}

const SECTION_1_ROLE = `=== SECTION 1: ROLE ===
You are a senior UiPath RPA architect. Your job is to ASSEMBLE workflows by filling in VALUES within pre-defined XAML templates. You do NOT invent XAML syntax.

You are generating PRODUCTION-READY artifacts. Every value must be as close to executable as possible. Use real values from the SDD — queue names, asset names, API endpoints, system URLs, file paths, email addresses, credential asset names, cron schedules, field names, data types. Only use placeholders when the information is genuinely not available in the SDD (e.g. actual passwords, environment-specific hostnames). For any placeholder, prefix with PLACEHOLDER_ so the Developer Handoff Guide can identify them.

ABSOLUTE RULES:
1. Each process node should map to ONE OR MORE UiPath activities — reference template names from Section 2 for each activity.
2. Use ONLY activity types present in the Activity Templates (Section 2). Do NOT invent activity names or properties not in the templates.
3. For LogMessage, the Level property MUST be one of: Info, Warn, Error, Fatal, Trace. NEVER use "Information", "Warning", "Debug", or "Critical" — these are INVALID enum values and constitute a generation failure.
   These are .NET LogLevel names that UiPath does NOT accept:
     Information ✗ → use Info instead
     Warning ✗ → use Warn instead
     Debug ✗ → use Trace instead
     Critical ✗ → use Fatal instead
4. For Assign, ALWAYS use child-element syntax with Assign.To (OutArgument) and Assign.Value (InArgument). NEVER use To= or Value= as XML attributes.
5. For properties marked as child-element in templates, ALWAYS emit them as nested child XML elements with the correct argument wrapper. NEVER place them as XML attributes.
6. NEVER double-wrap arguments — do NOT nest InArgument inside InArgument or OutArgument inside OutArgument.
7. NEVER return Then, Else, Cases, Body, or Finally as string property values — these are always nested child elements in UiPath XAML.
8. Properties must ONLY contain simple string/number/boolean values or VB.NET/C# expressions — never nested activity XML as a string value.
9. ALL variables must be declared in the Sequence.Variables block BEFORE their first use. Use the Variable Declaration template from Section 3.
10. Variable names must be CONTEXT-SPECIFIC with type prefixes (str_, int_, bool_, dt_, dbl_, dec_, obj_, ts_, drow_, qi_).
11. For Headers properties, return a proper VB.NET Dictionary initializer string, not a JSON object.
12. DOMAIN-SPECIFIC BUSINESS LOGIC FIDELITY: Reflect exact priority ordering, fallback sequences, and routing rules from the SDD. Do NOT reorder steps arbitrarily.
13. NEVER use TODO_ or PLACEHOLDER_ tokens as attribute values (e.g. TODO_Condition, PLACEHOLDER_Expression). When you cannot determine the correct value, use safe defaults: "True" for If Conditions, "Nothing" for Switch Expressions, "New List(Of Object)" for ForEach Values. Add a ui:Comment element immediately before the activity explaining what needs review.`;

const SECTION_3_VARIABLES = `=== SECTION 3: VARIABLE DECLARATION RULES ===
Every variable MUST be declared before first use using this template:
  <Variable x:TypeArguments="{{type}}" Name="{{name}}" Default="{{defaultValue}}" />

Type mapping:
  String → x:String       Int32 → x:Int32        Int64 → x:Int64
  Boolean → x:Boolean     Double → x:Double      Decimal → x:Decimal
  Object → x:Object       DateTime → s:DateTime  TimeSpan → s:TimeSpan
  DataTable → scg2:DataTable    DataRow → scg2:DataRow

Naming conventions (MANDATORY):
  str_VariableName   int_VariableName   bool_VariableName
  dt_VariableName    dbl_VariableName   dec_VariableName
  obj_VariableName   ts_VariableName    drow_VariableName
  qi_VariableName    qid_VariableName

Variables must be declared inside the nearest enclosing Sequence.Variables block.
Variable names must be context-specific (str_CustomerEmail not str_Email, dt_InvoiceData not dt_Data).`;

const SECTION_4_OUTPUT = `=== SECTION 4: WORKFLOW SPECIFICATION ===
OUTPUT FORMAT — respond with ONLY valid JSON matching this schema.

You MUST output a HIERARCHICAL TREE — NOT a flat list. Activities that can fail MUST be children of a tryCatch node, not flat siblings. Use if, while, forEach, retryScope, and sequence nodes to express control flow. NEVER place activities as flat siblings when they belong inside a structural parent.

BLOCKED ACTIVITY: ui:InvokeCode is BLOCKED. If you need to parse JSON, use Newtonsoft.Json.Linq patterns instead:
  - Assign: JObject.Parse(str_JsonResponse) → obj_Parsed
  - Assign: obj_Parsed("fieldName").ToString() → str_FieldValue
  - For arrays: JArray from obj_Parsed("items") and iterate with ForEach

VARIABLE PRE-DECLARATION: ALL variables MUST be listed in the top-level "variables" array BEFORE they appear in any activity. Every variable referenced in any expression must have a corresponding entry in "variables" with its correct type. Variables MUST use type prefixes (str_, int_, bool_, dt_, dbl_, dec_, obj_, ts_, drow_).

{
  "name": "<WorkflowName>",
  "description": "<purpose>",
  "variables": [
    { "name": "<var_name>", "type": "<.NET type e.g. String, Int32, Boolean, Object, DataTable>", "default": "<optional default value>" }
  ],
  "arguments": [
    { "name": "in_TransactionItem", "direction": "InArgument", "type": "x:String", "required": true }
  ],
  "rootSequence": {
    "kind": "sequence",
    "displayName": "<workflow display name>",
    "children": [
      <WorkflowNode entries — see node types below>
    ]
  },
  "useReFramework": true|false,
  "reframeworkConfig": { "queueName": "<from SDD>", "maxRetries": 3, "processName": "<name>" },
  "dhgNotes": ["<architecture decision or risk note>"],
  "decomposition": [
    { "name": "<SubWorkflowName>", "description": "<purpose>", "nodeIds": [<ids>], "isDispatcher": false, "isPerformer": false }
  ]
}

=== WorkflowNode types (discriminated by "kind") ===

1. ActivityNode — a single UiPath activity:
   { "kind": "activity", "template": "<template name from Section 2>", "displayName": "<name>", "properties": { "<Key>": "<value>" }, "outputVar": "<var or null>", "outputType": "<.NET type or null>", "errorHandling": "retry|catch|escalate|none" }

2. SequenceNode — ordered list of children:
   { "kind": "sequence", "displayName": "<name>", "children": [<WorkflowNode>...] }

3. TryCatchNode — wrap activities that can fail:
   { "kind": "tryCatch", "displayName": "<name>", "tryChildren": [<WorkflowNode>...], "catchChildren": [<WorkflowNode>...], "finallyChildren": [<WorkflowNode>...] }

4. IfNode — conditional branch:
   { "kind": "if", "displayName": "<name>", "condition": "<VB.NET boolean expression>", "thenChildren": [<WorkflowNode>...], "elseChildren": [<WorkflowNode>...] }

5. WhileNode — loop with condition:
   { "kind": "while", "displayName": "<name>", "condition": "<VB.NET boolean expression>", "bodyChildren": [<WorkflowNode>...] }

6. ForEachNode — iterate collection:
   { "kind": "forEach", "displayName": "<name>", "itemType": "x:String", "valuesExpression": "<VB.NET expression>", "iteratorName": "item", "bodyChildren": [<WorkflowNode>...] }

7. RetryScopeNode — retry on failure:
   { "kind": "retryScope", "displayName": "<name>", "numberOfRetries": 3, "retryInterval": "00:00:05", "bodyChildren": [<WorkflowNode>...] }

=== NESTING RULES ===
- Activities that make API calls, read files, or interact with external systems MUST be inside a tryCatch or retryScope node.
- Decision points MUST use IfNode with activities in thenChildren/elseChildren — NEVER emit Then/Else as string property values.
- Loops MUST use WhileNode or ForEachNode with activities in bodyChildren.
- Each "template" value in an ActivityNode MUST reference a template name from Section 2.

IMPORTANT: Respond with ONLY the JSON object. No markdown fences, no explanation.

=== SECTION 5: STRUCTURED VALUE DESCRIPTIONS (ValueIntent) ===
For TWO specific high-risk patterns, you MAY use structured ValueIntent objects instead of plain strings in activity "properties" values. All other values MUST remain plain strings.

1. URL endpoints with query parameters — use type "url_with_params":
   { "type": "url_with_params", "baseUrl": "https://api.example.com/data", "params": { "city": "str_CityName", "units": "metric" } }
   This avoids & characters in URLs being incorrectly XML-escaped.

2. Conditions with comparison operators (<, >, <>, >=, <=) — use type "expression":
   { "type": "expression", "left": "int_StatusCode", "operator": "<>", "right": "200" }
   This avoids <> being incorrectly XML-escaped to &lt;&gt;.

Additional types (use sparingly):
- Literal string: { "type": "literal", "value": "Hello World" }
- Variable reference: { "type": "variable", "name": "str_MyVar" }

Rules:
- "expression" left/right fields must be simple variable names or literals only.
- All other property values should remain plain strings — do NOT convert everything to ValueIntent.`;

export async function enrichWithAI(
  nodes: ProcessNode[],
  edges: ProcessEdge[],
  sddContent: string,
  orchestratorArtifacts: any,
  projectName: string,
  timeoutMs: number = 45000,
  automationPattern?: AutomationPattern
): Promise<EnrichmentResult | null> {
  try {
    const nodeDescriptions = nodes
      .filter(n => n.nodeType !== "start" && n.nodeType !== "end")
      .map(n => ({
        id: n.id,
        name: n.name,
        type: n.nodeType,
        system: n.system || "Unknown",
        role: n.role || "System",
        description: n.description || "",
        isPainPoint: n.isPainPoint || false,
      }));

    const edgeDescriptions = edges.map(e => ({
      from: nodes.find(n => n.id === e.sourceNodeId)?.name || `Node${e.sourceNodeId}`,
      to: nodes.find(n => n.id === e.targetNodeId)?.name || `Node${e.targetNodeId}`,
      label: e.label || "",
    }));

    const sddSummary = sddContent ? sddContent.slice(0, 8000) : "No SDD available";

    const artifactsJson = orchestratorArtifacts
      ? JSON.stringify(orchestratorArtifacts, null, 2).slice(0, 3000)
      : "No artifacts defined";

    const userMessage = `Project: ${projectName}

PROCESS MAP NODES:
${JSON.stringify(nodeDescriptions, null, 2)}

PROCESS MAP EDGES:
${JSON.stringify(edgeDescriptions, null, 2)}

ORCHESTRATOR ARTIFACTS (from SDD):
${artifactsJson}

SDD CONTENT (excerpts):
${sddSummary}

Generate the enriched workflow specification. For each node, provide the specific UiPath activities with system-aware properties and selectors. Determine if REFramework is appropriate and suggest workflow decomposition. Reference template names from Section 2 in each step's "template" field.`;

    let section2Block = "";
    const processType = classifyProcessType(sddSummary, nodeDescriptions);

    if (catalogService.isLoaded()) {
      try {
        const templateBlock = buildTemplateBlock(processType, true);
        if (shouldUseCompactFormat(templateBlock)) {
          section2Block = "\n\n" + formatCompactTemplateBlockForPrompt(templateBlock);
          console.log(`[AI XAML Enricher] Injected COMPACT ACTIVITY CATALOG for processType="${processType}" (${templateBlock.activityTemplates.length} activities, wide mode)`);
        } else {
          section2Block = "\n\n" + formatTemplateBlockForPrompt(templateBlock);
          console.log(`[AI XAML Enricher] Injected ACTIVITY TEMPLATES block for processType="${processType}" (${templateBlock.activityTemplates.length} activity templates, ${templateBlock.templateNames.length} total templates, wide mode)`);
        }
      } catch (err: any) {
        console.warn(`[AI XAML Enricher] Failed to build template block: ${err.message}`);
        try {
          const palette = catalogService.buildWidePalette();
          if (palette.length > 0) {
            section2Block = "\n\n" + formatActivityConstraints(palette, processType);
            console.log(`[AI XAML Enricher] Fell back to ACTIVITY CONSTRAINTS block for processType="${processType}" (${palette.length} activities, wide mode)`);
          }
        } catch (err2: any) {
          console.warn(`[AI XAML Enricher] Fallback also failed: ${err2.message}`);
        }
      }
    } else {
      console.warn(`[AI XAML Enricher] Activity catalog not loaded — skipping template injection; LLM output may use incorrect XAML syntax`);
    }

    const systemPrompt = SECTION_1_ROLE + section2Block + "\n\n" + SECTION_3_VARIABLES + "\n\n" + SECTION_4_OUTPUT;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[AI XAML Enricher] Requesting enrichment for ${nodeDescriptions.length} nodes...`);
      const response = await getCodeLLM().create({
        maxTokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        timeoutMs,
        abortSignal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.text) {
        console.log("[AI XAML Enricher] Empty response received");
        return null;
      }

      const jsonText = stripCodeFences(response.text.trim());
      const sanitized = sanitizeJsonString(jsonText);

      let parsed: EnrichmentResult;
      try {
        parsed = JSON.parse(sanitized) as EnrichmentResult;
      } catch (parseErr: any) {
        console.log(`[AI XAML Enricher] Initial JSON parse failed: ${parseErr.message} — attempting repair`);
        const { repairTruncatedPackageJson } = await import("./uipath-prompts");
        const repaired = repairTruncatedPackageJson(sanitized);
        if (repaired && repaired.nodes && Array.isArray(repaired.nodes)) {
          console.log(`[AI XAML Enricher] JSON repair succeeded — recovered ${repaired.nodes.length} nodes`);
          parsed = repaired as EnrichmentResult;
        } else {
          console.log("[AI XAML Enricher] JSON repair failed — could not recover valid enrichment structure");
          return null;
        }
      }

      if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
        console.log("[AI XAML Enricher] Invalid response structure — missing nodes array");
        return null;
      }

      for (const node of parsed.nodes) {
        if (!node.activities) node.activities = [];
        if (!node.gaps) node.gaps = [];
        node.activities = node.activities.filter((a: any) =>
          a && typeof a.activityType === "string" && a.activityType.length > 0
        );
        if (automationPattern) {
          const beforeCount = node.activities.length;
          node.activities = node.activities.filter((a: any) =>
            isActivityAllowed(a.activityType, automationPattern)
          );
          const removedCount = beforeCount - node.activities.length;
          if (removedCount > 0) {
            console.log(`[AI XAML Enricher] Filtered ${removedCount} policy-blocked activit(ies) from node "${node.nodeName}" for pattern "${automationPattern}"`);
          }
        }
        for (const act of node.activities) {
          if (!act.properties) act.properties = {};
          if (!act.variables) act.variables = [];
          if (!act.errorHandling) act.errorHandling = "none";
          if (!act.package) act.package = "UiPath.System.Activities";
          if (typeof act.timeout !== "number") act.timeout = undefined;
          if (typeof act.continueOnError !== "boolean") act.continueOnError = undefined;
          if (typeof act.delayBefore !== "number") act.delayBefore = undefined;
          if (typeof act.delayAfter !== "number") act.delayAfter = undefined;

          const uiPrefixActivities = new Set([
            "InvokeWorkflowFile", "RetryScope", "AddQueueItem", "GetTransactionItem",
            "SetTransactionStatus", "LogMessage", "GetCredential", "GetAsset",
            "TakeScreenshot", "AddLogFields", "HttpClient", "DeserializeJson",
            "SerializeJson", "Comment", "ShouldRetry",
            "ExcelApplicationScope", "UseExcel", "ExcelReadRange", "ExcelWriteRange",
            "SendSmtpMailMessage", "SendOutlookMailMessage", "GetImapMailMessage",
            "ExecuteQuery", "ExecuteNonQuery", "ConnectToDatabase",
            "ReadTextFile", "WriteTextFile", "PathExists",
            "DigitizeDocument", "ClassifyDocument", "ExtractDocumentData", "ValidateDocumentData",
            "Rethrow",
          ]);
          const bareType = act.activityType.replace(/^ui:/, "");
          if (uiPrefixActivities.has(bareType) && !act.activityType.startsWith("ui:")) {
            act.activityType = `ui:${bareType}`;
          }

          if (act.activityType === "ui:InvokeWorkflowFile") {
            if (act.properties["Input"] && typeof act.properties["Input"] === "string") {
              act.properties["_convertedInputArgs"] = act.properties["Input"];
            }
            delete act.properties["Input"];
            if (act.properties["Output"] && typeof act.properties["Output"] === "string") {
              act.properties["_convertedOutputArgs"] = act.properties["Output"];
            }
            delete act.properties["Output"];
          }
          if (act.activityType === "ui:TakeScreenshot") {
            delete act.properties["OutputPath"];
          }
          if (act.activityType === "ui:HttpClient") {
            delete act.properties["ResponseType"];
            if (act.properties["URL"]) {
              act.properties["Endpoint"] = act.properties["URL"];
              delete act.properties["URL"];
            }
          }
          const pseudoKeys = ["Then", "Else", "Cases", "Body", "Finally", "Try"];
          const isControlFlow = ["If", "Switch", "ForEach", "TryCatch"].some(
            cf => act.activityType === cf || act.activityType === `System.Activities.${cf}`
          );
          if (!isControlFlow) {
            for (const pk of pseudoKeys) {
              if (pk in act.properties) {
                delete act.properties[pk];
              }
            }
          }
          for (const [propKey, propVal] of Object.entries(act.properties)) {
            if (isControlFlow && pseudoKeys.includes(propKey)) continue;
            if (typeof propVal !== "string") {
              if (propVal === null || propVal === undefined) {
                delete act.properties[propKey];
              } else if (typeof propVal === "object") {
                if (propKey.toLowerCase().includes("header")) {
                  const entries = Object.entries(propVal as Record<string, any>);
                  if (entries.length === 0) {
                    act.properties[propKey] = "New Dictionary(Of String, String)()";
                  } else {
                    const kvPairs = entries.map(([k, v]) => `{"${k}", "${String(v)}"}`).join(", ");
                    act.properties[propKey] = `New Dictionary(Of String, String) From {${kvPairs}}`;
                  }
                } else {
                  act.properties[propKey] = JSON.stringify(propVal);
                }
              } else {
                act.properties[propKey] = String(propVal);
              }
            } else if (propVal === "[object Object]") {
              act.properties[propKey] = `PLACEHOLDER_${propKey}_object_value`;
            } else if (propVal === "...") {
              act.properties[propKey] = `PLACEHOLDER_${propKey}`;
            } else if (typeof propVal === "string") {
              const isVbExpr = /^\[.*\]$/.test(propVal.trim());
              if (isVbExpr) {
                act.properties[propKey] = propVal.replace(/'/g, "");
              } else {
                act.properties[propKey] = propVal.replace(/["']/g, "");
              }
            }
          }
        }
      }
      if (!parsed.decomposition) parsed.decomposition = [];
      if (!parsed.dhgNotes) parsed.dhgNotes = [];
      if (typeof parsed.useReFramework !== "boolean") parsed.useReFramework = false;
      if (!Array.isArray(parsed.arguments)) parsed.arguments = [];

      console.log(`[AI XAML Enricher] Successfully enriched ${parsed.nodes.length} nodes, REFramework=${parsed.useReFramework}, ${parsed.decomposition?.length || 0} sub-workflows`);
      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[AI XAML Enricher] Timed out — falling back to keyword classification");
    } else {
      console.log(`[AI XAML Enricher] Error: ${err.message} — falling back to keyword classification`);
    }
    return null;
  }
}

export function classifyProcessType(
  sddContent: string,
  nodeDescriptions: any[]
): ProcessType {
  const text = (sddContent + " " + nodeDescriptions.map(n => `${n.name || ""} ${n.description || ""}`).join(" ")).toLowerCase();

  const signals: Record<ProcessType, string[]> = {
    "api-integration": ["api", "http", "rest", "endpoint", "web service", "json", "soap"],
    "document-processing": ["ocr", "document", "digitize", "classify document", "extract data", "intelligent ocr", "pdf", "invoice processing"],
    "attended-ui": ["attended", "user interaction", "form task", "input dialog", "message box", "human in the loop"],
    "unattended-ui": ["unattended", "scheduled", "background process", "headless", "selector", "click", "type into", "get text", "browser"],
    "orchestration": ["queue", "transaction", "orchestrator", "dispatcher", "performer", "reframework"],
    "general": [],
  };

  let bestType: ProcessType = "general";
  let bestScore = 0;

  for (const [pType, keywords] of Object.entries(signals)) {
    if (pType === "general") continue;
    const score = keywords.filter(k => text.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestType = pType as ProcessType;
    }
  }

  return bestType;
}

function formatActivityConstraints(palette: PaletteEntry[], processType: ProcessType): string {
  const lines = [
    `ACTIVITY CONSTRAINTS (processType: ${processType})`,
    "You MUST only use activities and properties listed below. Do NOT use activities or property names not present in this catalog.",
    "Properties marked [child-element] MUST be emitted as nested child XML elements, NOT as XML attributes.",
    "Properties marked [attribute] should be emitted as XML attributes on the activity element.",
    "",
  ];

  for (const entry of palette) {
    let line = `- ${entry.className} (${entry.packageId || "System.Activities"})`;
    const propDescs: string[] = [];
    for (const p of entry.properties) {
      const req = p.required ? "REQUIRED" : "optional";
      propDescs.push(`${p.name}[${p.xamlSyntax},${req}]`);
    }
    if (propDescs.length > 0) line += `: ${propDescs.join(", ")}`;
    lines.push(line);
  }

  return lines.join("\n");
}

export type TreeEnrichmentResult =
  | {
      status: "success";
      workflowSpec: TreeWorkflowSpec;
      processType: ProcessType;
    }
  | {
      status: "validation_failed";
      processType: ProcessType;
      validationErrors: string[];
    };

export async function enrichWithAITree(
  nodes: ProcessNode[],
  edges: ProcessEdge[],
  sddContent: string,
  orchestratorArtifacts: any,
  projectName: string,
  timeoutMs: number = 45000,
  automationPattern?: AutomationPattern,
  skipRetry?: boolean,
): Promise<TreeEnrichmentResult | null> {
  try {
    const nodeDescriptions = nodes
      .filter(n => n.nodeType !== "start" && n.nodeType !== "end")
      .map(n => ({
        id: n.id,
        name: n.name,
        type: n.nodeType,
        system: n.system || "Unknown",
        role: n.role || "System",
        description: n.description || "",
        isPainPoint: n.isPainPoint || false,
      }));

    const edgeDescriptions = edges.map(e => ({
      from: nodes.find(n => n.id === e.sourceNodeId)?.name || `Node${e.sourceNodeId}`,
      to: nodes.find(n => n.id === e.targetNodeId)?.name || `Node${e.targetNodeId}`,
      label: e.label || "",
    }));

    const sddSummary = sddContent ? sddContent.slice(0, 8000) : "No SDD available";
    const artifactsJson = orchestratorArtifacts
      ? JSON.stringify(orchestratorArtifacts, null, 2).slice(0, 3000)
      : "No artifacts defined";

    const userMessage = `Project: ${projectName}

PROCESS MAP NODES:
${JSON.stringify(nodeDescriptions, null, 2)}

PROCESS MAP EDGES:
${JSON.stringify(edgeDescriptions, null, 2)}

ORCHESTRATOR ARTIFACTS (from SDD):
${artifactsJson}

SDD CONTENT (excerpts):
${sddSummary}

Generate the hierarchical WorkflowSpec JSON tree. Use tryCatch nodes to wrap activities that can fail. Use if nodes for decision points. Reference template names from Section 2 for each activity node. Pre-declare all variables in the top-level variables array.`;

    let section2Block = "";
    const processType = classifyProcessType(sddSummary, nodeDescriptions);

    if (catalogService.isLoaded()) {
      try {
        const templateBlock = buildTemplateBlock(processType, true);
        if (shouldUseCompactFormat(templateBlock)) {
          section2Block = "\n\n" + formatCompactTemplateBlockForPrompt(templateBlock);
          console.log(`[AI XAML Enricher Tree] Injected COMPACT ACTIVITY CATALOG for processType="${processType}" (wide mode)`);
        } else {
          section2Block = "\n\n" + formatTemplateBlockForPrompt(templateBlock);
          console.log(`[AI XAML Enricher Tree] Injected ACTIVITY TEMPLATES for processType="${processType}" (wide mode)`);
        }
      } catch (err: any) {
        console.warn(`[AI XAML Enricher Tree] Failed to build template block: ${err.message}`);
      }
    }

    const systemPrompt = SECTION_1_ROLE + section2Block + "\n\n" + SECTION_3_VARIABLES + "\n\n" + SECTION_4_OUTPUT;

    let lastValidationErrors: string[] = [];
    let lastParseError: string | null = null;

    const attemptTreeEnrichment = async (extraContext?: string): Promise<TreeWorkflowSpec | null> => {
      lastValidationErrors = [];
      lastParseError = null;

      const messages: Array<{ role: "user"; content: string }> = [
        { role: "user", content: extraContext ? userMessage + "\n\n" + extraContext : userMessage },
      ];

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await getCodeLLM().create({
          maxTokens: 16384,
          system: systemPrompt,
          messages,
          timeoutMs,
          abortSignal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.text) {
          console.log("[AI XAML Enricher Tree] Empty response received");
          lastParseError = "Empty response from LLM";
          return null;
        }

        let parsed: any;
        try {
          const jsonText = stripCodeFences(response.text.trim());
          const sanitized = sanitizeJsonString(jsonText);
          parsed = JSON.parse(sanitized);
        } catch (parseErr: any) {
          lastParseError = `JSON parse error: ${parseErr.message}`;
          console.log(`[AI XAML Enricher Tree] ${lastParseError}`);
          return null;
        }

        if (parsed && typeof parsed === "object") {
          if (parsed.reframeworkConfig == null || typeof parsed.reframeworkConfig !== "object") {
            parsed.reframeworkConfig = undefined;
            if (parsed.useReFramework) {
              parsed.reframeworkConfig = { queueName: "", maxRetries: 1, processName: parsed.name || "" };
            }
          } else {
            if (parsed.reframeworkConfig.maxRetries == null || parsed.reframeworkConfig.maxRetries < 0) {
              parsed.reframeworkConfig.maxRetries = 1;
            }
          }
        }

        const validation = validateWorkflowSpec(parsed);
        if (!validation.success) {
          lastValidationErrors = validation.errors;
          console.log(`[AI XAML Enricher Tree] Validation failed: ${validation.errors.join("; ")}`);
          return null;
        }

        return validation.data;
      } finally {
        clearTimeout(timeout);
      }
    };

    console.log(`[AI XAML Enricher Tree] Requesting tree enrichment for ${nodeDescriptions.length} nodes...`);
    let spec = await attemptTreeEnrichment();

    if (!spec) {
      if (skipRetry) {
        const allErrors = lastValidationErrors.length > 0
          ? lastValidationErrors
          : lastParseError ? [lastParseError] : ["Unknown validation failure"];
        console.log(`[AI XAML Enricher Tree] First attempt failed and skipRetry=true — returning validation_failed status with ${allErrors.length} errors`);
        return {
          status: "validation_failed",
          processType,
          validationErrors: allErrors,
        };
      }

      const errorContext = lastValidationErrors.length > 0
        ? `IMPORTANT: Your previous response FAILED Zod schema validation with these specific errors:\n${lastValidationErrors.map((e, i) => `  ${i + 1}. ${e}`).join("\n")}\n\nFix these errors. The root must have 'name' (non-empty string), 'rootSequence' (object with kind='sequence', displayName, children array), and 'variables' (array). All nodes in children arrays must have a valid 'kind' field: activity, sequence, tryCatch, if, while, forEach, or retryScope.`
        : lastParseError
          ? `IMPORTANT: Your previous response was not valid JSON: ${lastParseError}. Respond with ONLY the JSON object, no markdown fences or explanation.`
          : "IMPORTANT: Your previous response was invalid. Ensure the output matches the WorkflowSpec schema exactly.";

      console.log("[AI XAML Enricher Tree] First attempt failed, retrying with specific error context...");
      spec = await attemptTreeEnrichment(errorContext);

      if (!spec) {
        const allErrors = lastValidationErrors.length > 0
          ? lastValidationErrors
          : lastParseError ? [lastParseError] : ["Unknown validation failure"];
        console.log(`[AI XAML Enricher Tree] Retry also failed — returning validation_failed status with ${allErrors.length} errors`);
        return {
          status: "validation_failed",
          processType,
          validationErrors: allErrors,
        };
      }
    }

    annotateSpecConfidence(spec);
    console.log(`[AI XAML Enricher Tree] Successfully produced WorkflowSpec tree: "${spec.name}", ${spec.variables.length} variables, REFramework=${spec.useReFramework}`);
    return { workflowSpec: spec, processType, status: "success" };
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log("[AI XAML Enricher Tree] Timed out");
    } else {
      console.log(`[AI XAML Enricher Tree] Error: ${err.message}`);
    }
    return null;
  }
}

const LOW_CONFIDENCE_PATTERNS = [
  /PLACEHOLDER_/i,
  /selector/i,
  /credential/i,
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /hostname/i,
  /environment/i,
];

const HIGH_CONFIDENCE_PATTERNS = [
  /^"[^"]*"$/,
  /^True$/,
  /^False$/,
  /^Nothing$/,
  /^\d+$/,
  /^Info$|^Warn$|^Error$|^Fatal$|^Trace$/,
];

function scorePropertyConfidence(key: string, value: PropertyValue): number {
  if (isValueIntent(value)) {
    const intent = value as ValueIntent;
    if (intent.confidence !== undefined) return intent.confidence;
    if (intent.type === "literal") {
      const v = intent.value;
      if (/PLACEHOLDER_/.test(v)) return 0.2;
      if (/^"[^"]*"$/.test(v) || /^\d+$/.test(v)) return 0.9;
      return 0.7;
    }
    if (intent.type === "variable") return 0.8;
    if (intent.type === "url_with_params") {
      if (/PLACEHOLDER_/.test(intent.baseUrl)) return 0.2;
      return 0.6;
    }
    if (intent.type === "expression") return 0.7;
    return 0.5;
  }

  const strVal = String(value);
  const lowerKey = key.toLowerCase();

  if (LOW_CONFIDENCE_PATTERNS.some(p => p.test(strVal) || p.test(lowerKey))) return 0.2;
  if (HIGH_CONFIDENCE_PATTERNS.some(p => p.test(strVal))) return 0.95;
  if (/^(DisplayName|Level|Method)$/i.test(key)) return 0.9;
  if (/^(AssetName|QueueName|Endpoint|To|From|Server)$/i.test(key)) return 0.4;

  return 0.6;
}

function annotateNodeConfidence(node: WorkflowNode): void {
  if (node.kind === "activity") {
    for (const [key, value] of Object.entries(node.properties)) {
      if (isValueIntent(value)) {
        const intent = value as ValueIntent;
        if (intent.confidence === undefined) {
          (intent as any).confidence = scorePropertyConfidence(key, value);
        }
      }
    }
  } else if (node.kind === "sequence") {
    for (const child of node.children) annotateNodeConfidence(child);
  } else if (node.kind === "tryCatch") {
    for (const child of node.tryChildren) annotateNodeConfidence(child);
    for (const child of node.catchChildren) annotateNodeConfidence(child);
    for (const child of node.finallyChildren) annotateNodeConfidence(child);
  } else if (node.kind === "if") {
    for (const child of node.thenChildren) annotateNodeConfidence(child);
    for (const child of node.elseChildren) annotateNodeConfidence(child);
  } else if (node.kind === "while") {
    for (const child of node.bodyChildren) annotateNodeConfidence(child);
  } else if (node.kind === "forEach") {
    for (const child of node.bodyChildren) annotateNodeConfidence(child);
  } else if (node.kind === "retryScope") {
    for (const child of node.bodyChildren) annotateNodeConfidence(child);
  }
}

export function annotateSpecConfidence(spec: TreeWorkflowSpec): void {
  for (const child of spec.rootSequence.children) {
    annotateNodeConfidence(child);
  }
}
