import Anthropic from "@anthropic-ai/sdk";
import type { ProcessNode, ProcessEdge } from "@shared/schema";
import { sanitizeJsonString, stripCodeFences } from "./lib/json-utils";

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

const ENRICHMENT_PROMPT = `You are a senior UiPath RPA architect. Given a process map and SDD content, produce a detailed technical specification for generating UiPath XAML workflows.

You are generating PRODUCTION-READY artifacts. Every value must be as close to executable as possible. Use real values from the SDD — queue names, asset names, API endpoints, system URLs, file paths, email addresses, credential asset names, cron schedules, field names, data types. Only use placeholders when the information is genuinely not available in the SDD (e.g. actual passwords, environment-specific hostnames). For any placeholder, prefix with PLACEHOLDER_ so the Developer Handoff Guide can identify them.

RULES:
1. Each process node should map to ONE OR MORE UiPath activities (multi-activity sequences for complex steps)
2. Use REAL UiPath activity types from standard packages:
   - UiPath.UIAutomation.Activities: OpenBrowser, NavigateTo, TypeInto, Click, GetText, ElementExists, AttachBrowser, AttachWindow, UseApplicationBrowser
   - UiPath.Excel.Activities: ExcelApplicationScope, ExcelReadRange, ExcelWriteRange, ExcelWriteCell
   - UiPath.Mail.Activities: SendSmtpMailMessage, GetImapMailMessage, GetOutlookMailMessages, SendOutlookMailMessage
   - UiPath.Web.Activities: HttpClient, DeserializeJson, SerializeJson
   - UiPath.Database.Activities: ExecuteQuery, ExecuteNonQuery, ConnectToDatabase
   - UiPath.System.Activities: AddQueueItem, GetTransactionItem, SetTransactionStatus, GetCredential, GetAsset, ReadTextFile, WriteTextFile, PathExists, LogMessage, InvokeWorkflowFile
   - System.Activities: Assign, If, ForEach, Switch, Delay, Sequence, TryCatch, Rethrow
3. Generate SYSTEM-SPECIFIC selector patterns:
   - SAP GUI: <wnd app='saplogon.exe' /><ctrl role='editable text' automationid='usr/txtRSYST-BNAME' />
   - SAP Fiori: <webctrl css-selector='.sapMInputBaseInner' parentcss-selector='.sapMInput' />
   - Salesforce: <webctrl tag='INPUT' css-selector='input[data-interactive-lib-uid]' parentcss-selector='.slds-form-element' />
   - ServiceNow: <webctrl tag='INPUT' id='sys_display.incident.caller_id' />
   - Workday: <webctrl tag='INPUT' data-automation-id='textInputBox' />
   - Oracle: <webctrl tag='INPUT' id='pt1:r1:0:inputText1::content' />
   - Generic web: <webctrl tag='INPUT|SELECT|BUTTON' name='field_name_from_context' />
   - Desktop: <wnd cls='WindowClass' title='Window Title' /><ctrl name='ControlName' role='role' />
   For selectors, generate the most specific selector possible — include application names, window titles, control IDs, CSS selectors. For web apps, use realistic CSS selectors based on the system (Salesforce uses data-interactive-lib-uid, ServiceNow uses sys_display prefixes, SAP Fiori uses sapM prefixes).
4. Replace ALL TODO placeholders with real values from the SDD — actual queue names, asset names, API endpoints, file paths, email addresses, system URLs, credential asset names. Only use PLACEHOLDER_ prefix when the SDD genuinely doesn't contain the value.
5. Variable names should be CONTEXT-SPECIFIC (dt_InvoiceData not dt_ExcelData, str_CustomerEmail not str_EmailTo)
6. For login flows, generate FULL multi-step sequences: navigate → type username → type password → click login → verify success
7. For data processing, use ForEachRow with proper column references
8. Determine if REFramework should be used (when queues are involved for transaction processing)
9. Suggest workflow decomposition: group related steps into sub-workflows by system or function
10. Define workflow arguments: For each sub-workflow (not Main), specify InArgument/OutArgument/InOutArgument entries with direction-prefixed names (in_, out_, io_), .NET types, and whether required. Include in_TransactionItem for performer workflows, io_Config for all workflows.
11. Include these operational properties for each activity:
    - Timeout: default 30000ms for UI activities, higher for long-running operations
    - ContinueOnError: "True" for non-critical activities (logging, notifications), "False" for critical activities (data processing, login, validation)
    - DelayBefore/DelayAfter: specify when system-specific timing needs exist (e.g. SAP page loads need 1000-2000ms delay, web transitions need 500ms)

OUTPUT FORMAT — respond with ONLY valid JSON matching this schema:
{
  "nodes": [
    {
      "nodeId": <number>,
      "nodeName": "<string>",
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
}`;

export async function enrichWithAI(
  nodes: ProcessNode[],
  edges: ProcessEdge[],
  sddContent: string,
  orchestratorArtifacts: any,
  projectName: string,
  timeoutMs: number = 45000
): Promise<EnrichmentResult | null> {
  try {
    const anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
    });

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

Generate the enriched workflow specification. For each node, provide the specific UiPath activities with system-aware properties and selectors. Determine if REFramework is appropriate and suggest workflow decomposition.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[AI XAML Enricher] Requesting enrichment for ${nodeDescriptions.length} nodes...`);
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: ENRICHMENT_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      clearTimeout(timeout);

      const content = response.content[0];
      if (content.type !== "text") {
        console.log("[AI XAML Enricher] Non-text response received");
        return null;
      }

      const jsonText = stripCodeFences(content.text.trim());
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
        for (const act of node.activities) {
          if (!act.properties) act.properties = {};
          if (!act.variables) act.variables = [];
          if (!act.errorHandling) act.errorHandling = "none";
          if (!act.package) act.package = "UiPath.System.Activities";
          if (typeof act.timeout !== "number") act.timeout = undefined;
          if (typeof act.continueOnError !== "boolean") act.continueOnError = undefined;
          if (typeof act.delayBefore !== "number") act.delayBefore = undefined;
          if (typeof act.delayAfter !== "number") act.delayAfter = undefined;
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
