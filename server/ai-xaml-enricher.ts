import { getCodeLLM } from "./lib/llm";
import type { ProcessNode, ProcessEdge } from "@shared/schema";
import { sanitizeJsonString, stripCodeFences } from "./lib/json-utils";
import { isActivityAllowed } from "./uipath-activity-policy";
import type { AutomationPattern } from "./uipath-activity-registry";
import { catalogService, type ProcessType, type PaletteEntry } from "./catalog/catalog-service";
import { buildTemplateBlock, formatTemplateBlockForPrompt } from "./catalog/xaml-template-builder";

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
4. For Assign, ALWAYS use child-element syntax with Assign.To (OutArgument) and Assign.Value (InArgument). NEVER use To= or Value= as XML attributes.
5. For properties marked as child-element in templates, ALWAYS emit them as nested child XML elements with the correct argument wrapper. NEVER place them as XML attributes.
6. NEVER double-wrap arguments — do NOT nest InArgument inside InArgument or OutArgument inside OutArgument.
7. NEVER return Then, Else, Cases, Body, or Finally as string property values — these are always nested child elements in UiPath XAML.
8. Properties must ONLY contain simple string/number/boolean values or VB.NET/C# expressions — never nested activity XML as a string value.
9. ALL variables must be declared in the Sequence.Variables block BEFORE their first use. Use the Variable Declaration template from Section 3.
10. Variable names must be CONTEXT-SPECIFIC with type prefixes (str_, int_, bool_, dt_, dbl_, dec_, obj_, ts_, drow_, qi_).
11. For Headers properties, return a proper VB.NET Dictionary initializer string, not a JSON object.
12. DOMAIN-SPECIFIC BUSINESS LOGIC FIDELITY: Reflect exact priority ordering, fallback sequences, and routing rules from the SDD. Do NOT reorder steps arbitrarily.`;

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
OUTPUT FORMAT — respond with ONLY valid JSON matching this schema:
{
  "nodes": [
    {
      "nodeId": <number>,
      "nodeName": "<string>",
      "steps": [
        {
          "template": "<template name from Section 2>",
          "displayName": "<descriptive name>",
          "errorHandling": "retry|catch|escalate|none",
          "properties": { "<PropertyName>": "<real_value_from_SDD_or_PLACEHOLDER_description>" },
          "outputVar": "<variable name if activity produces output, or null>",
          "outputType": "<.NET type for output variable, or null>"
        }
      ],
      "activities": [
        {
          "activityType": "<full UiPath activity type e.g. ui:TypeInto>",
          "displayName": "<descriptive name>",
          "package": "<UiPath package name>",
          "properties": { "<PropertyName>": "<real_value_from_SDD_or_PLACEHOLDER_description>" },
          "selectorHint": "<system-specific selector XML or null>",
          "errorHandling": "retry|catch|escalate|none",
          "timeout": <milliseconds, default 30000 for UI activities>,
          "continueOnError": <true for non-critical like logging/notification, false for critical>,
          "delayBefore": <milliseconds or 0>,
          "delayAfter": <milliseconds or 0>,
          "variables": [{ "name": "<var_name>", "type": "<.NET type>", "defaultValue": "<optional>" }]
        }
      ],
      "gaps": [
        {
          "category": "selector|credential|endpoint|logic|config",
          "activity": "<activity type>",
          "description": "<specific actionable instruction>",
          "placeholder": "<current placeholder value>",
          "estimatedMinutes": <number>
        }
      ]
    }
  ],
  "decomposition": [
    { "name": "<WorkflowName>", "description": "<purpose>", "nodeIds": [<ids>], "isDispatcher": false, "isPerformer": false }
  ],
  "useReFramework": true|false,
  "reframeworkConfig": { "queueName": "<from SDD>", "maxRetries": 3, "processName": "<name>" },
  "dhgNotes": ["<architecture decision or risk note>"],
  "arguments": [
    { "name": "in_TransactionItem", "direction": "InArgument", "type": "x:String", "required": true }
  ]
}

IMPORTANT: Each "steps" entry references a template name from Section 2. The "activities" array provides the full activity specification for backward compatibility. Both should be consistent.`;

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
        const templateBlock = buildTemplateBlock(processType);
        section2Block = "\n\n" + formatTemplateBlockForPrompt(templateBlock);
        console.log(`[AI XAML Enricher] Injected ACTIVITY TEMPLATES block for processType="${processType}" (${templateBlock.activityTemplates.length} activity templates, ${templateBlock.templateNames.length} total templates)`);
      } catch (err: any) {
        console.warn(`[AI XAML Enricher] Failed to build template block: ${err.message}`);
        try {
          const palette = catalogService.buildActivityPalette(processType);
          if (palette.length > 0) {
            section2Block = "\n\n" + formatActivityConstraints(palette, processType);
            console.log(`[AI XAML Enricher] Fell back to ACTIVITY CONSTRAINTS block for processType="${processType}" (${palette.length} activities)`);
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
      });

      clearTimeout(timeout);

      if (!response.text) {
        console.log("[AI XAML Enricher] Empty response received");
        return null;
      }

      const jsonText = stripCodeFences(response.text.trim());
      const sanitized = sanitizeJsonString(jsonText);

      const parsed = JSON.parse(sanitized) as EnrichmentResult;

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
