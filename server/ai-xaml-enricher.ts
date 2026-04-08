import { getCodeLLM, getActiveCodeModel, getActiveModel } from "./lib/llm";
import type { ProcessNode, ProcessEdge } from "@shared/schema";
import { sanitizeJsonString, stripCodeFences } from "./lib/json-utils";
import { isActivityAllowed } from "./uipath-activity-policy";
import type { AutomationPattern } from "./uipath-activity-registry";
import { catalogService, type ProcessType, type PaletteEntry } from "./catalog/catalog-service";
import { getActivityPrefixStrict } from "./xaml/xaml-compliance";
import { buildTemplateBlock, formatTemplateBlockForPrompt, formatCompactTemplateBlockForPrompt, shouldUseCompactFormat } from "./catalog/xaml-template-builder";
import { validateWorkflowSpec, type WorkflowSpec as TreeWorkflowSpec, type WorkflowNode, type PropertyValue } from "./workflow-spec-types";
import { isValueIntent, sanitizeValueIntentExpressions, type ValueIntent } from "./xaml/expression-builder";
import { extractUiContext, formatUiContextForPrompt } from "./xaml/selector-quality-scorer";
import { recordLlmCall, buildLlmTraceEntry, getCurrentRunId } from "./llm-trace-collector";

const TIMESPAN_PROPERTY_NAMES = new Set([
  "RetryInterval", "Timeout", "DelayBefore", "DelayAfter",
  "TimeoutMS", "DelayBetween", "WaitTime", "Duration",
]);

function objectToTimeSpan(val: Record<string, any>): string | null {
  const hours = parseInt(val.hours || val.Hours || "0", 10) || 0;
  const minutes = parseInt(val.minutes || val.Minutes || "0", 10) || 0;
  const seconds = parseInt(val.seconds || val.Seconds || "0", 10) || 0;
  const totalMs = parseInt(val.milliseconds || val.Milliseconds || val.ms || "0", 10) || 0;

  if (hours === 0 && minutes === 0 && seconds === 0 && totalMs === 0) {
    return null;
  }

  if (hours === 0 && minutes === 0 && seconds === 0 && totalMs > 0) {
    const totalSec = Math.floor(totalMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function sanitizeObjectProperties(obj: any): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    for (const item of obj) sanitizeObjectProperties(item);
    return;
  }

  if (obj.properties && typeof obj.properties === "object" && !Array.isArray(obj.properties)) {
    for (const [key, val] of Object.entries(obj.properties)) {
      if (val === null || val === undefined) {
        delete obj.properties[key];
        continue;
      }
      if (typeof val === "object" && !Array.isArray(val)) {
        if (isValueIntent(val as any)) continue;
        if (TIMESPAN_PROPERTY_NAMES.has(key)) {
          const ts = objectToTimeSpan(val as Record<string, any>);
          if (ts !== null) {
            obj.properties[key] = ts;
            continue;
          }
        }
        if (key.toLowerCase().includes("header")) {
          const entries = Object.entries(val as Record<string, any>);
          if (entries.length === 0) {
            obj.properties[key] = "New Dictionary(Of String, String)()";
          } else {
            const kvPairs = entries.map(([k, v]) => `{"${k}", "${String(v)}"}`).join(", ");
            obj.properties[key] = `New Dictionary(Of String, String) From {${kvPairs}}`;
          }
          continue;
        }
        obj.properties[key] = JSON.stringify(val);
      }
    }
  }

  if (obj.children && Array.isArray(obj.children)) {
    for (const child of obj.children) sanitizeObjectProperties(child);
  }
  if (obj.tryChildren && Array.isArray(obj.tryChildren)) {
    for (const child of obj.tryChildren) sanitizeObjectProperties(child);
  }
  if (obj.catchChildren && Array.isArray(obj.catchChildren)) {
    for (const child of obj.catchChildren) sanitizeObjectProperties(child);
  }
  if (obj.finallyChildren && Array.isArray(obj.finallyChildren)) {
    for (const child of obj.finallyChildren) sanitizeObjectProperties(child);
  }
  if (obj.bodyChildren && Array.isArray(obj.bodyChildren)) {
    for (const child of obj.bodyChildren) sanitizeObjectProperties(child);
  }
  if (obj.thenChildren && Array.isArray(obj.thenChildren)) {
    for (const child of obj.thenChildren) sanitizeObjectProperties(child);
  }
  if (obj.elseChildren && Array.isArray(obj.elseChildren)) {
    for (const child of obj.elseChildren) sanitizeObjectProperties(child);
  }
  if (obj.rootSequence) {
    sanitizeObjectProperties(obj.rootSequence);
  }
}

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
0. Never use String.Format with more than 10 arguments ({0} through {9} maximum). For messages with many variables, use string concatenation with the & operator instead. Example: "Name: " & str_Name & ", Age: " & CStr(int_Age) & ", City: " & str_City.
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
Variable names must be context-specific (str_CustomerEmail not str_Email, dt_InvoiceData not dt_Data).

PROHIBITED variable names — these are property accesses, NOT variable declarations:
  NEVER declare variables with dots — \`dt_Constants.Rows\` is a runtime property access on a DataTable variable, not a variable name. Use \`dt_Constants\` as the variable and \`.Rows\` as a property access in expressions.
  ✗ dt_Constants.Rows  → use dt_Constants as variable, access .Rows in expressions
  ✗ dt_Settings.Rows   → use dt_Settings as variable, access .Rows in expressions
  ✗ obj_Result.Value    → use obj_ResultValue
  ✗ any name containing a dot (.) — dots indicate property access in VB.NET, not valid variable identifiers
  ✗ names with spaces, leading digits, or VB.NET reserved words are also invalid`;

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
   { "kind": "tryCatch", "displayName": "<name>", "tryChildren": [<WorkflowNode>...], "catchChildren": [<WorkflowNode>...], "finallyChildren": [<WorkflowNode>...], "catchVariableName": "<exception variable name, default: exception>" }

4. IfNode — conditional branch:
   { "kind": "if", "displayName": "<name>", "condition": "<VB.NET boolean expression>", "thenChildren": [<WorkflowNode>...], "elseChildren": [<WorkflowNode>...] }

5. WhileNode — loop with condition:
   { "kind": "while", "displayName": "<name>", "condition": "<VB.NET boolean expression>", "bodyChildren": [<WorkflowNode>...] }

6. ForEachNode — iterate collection:
   { "kind": "forEach", "displayName": "<name>", "itemType": "x:String", "valuesExpression": "<VB.NET expression>", "iteratorName": "item", "bodyChildren": [<WorkflowNode>...] }

7. RetryScopeNode — retry on failure:
   { "kind": "retryScope", "displayName": "<name>", "numberOfRetries": 3, "retryInterval": "00:00:05", "bodyChildren": [<WorkflowNode>...] }

=== MODERN DESIGN ACTIVITIES (preferred over legacy) ===
Use Modern Design (N-prefix) activities instead of legacy ones:
- NClick (replaces Click) — ui:NClick
- NTypeInto (replaces TypeInto) — ui:NTypeInto
- NGetText (replaces GetText) — ui:NGetText
- NApplicationCard (replaces OpenBrowser, AttachBrowser, UseBrowser, UseApplicationBrowser) — ui:NApplicationCard
- NSelectItem (replaces SelectItem) — ui:NSelectItem
- NCheckState (replaces CheckState) — ui:NCheckState
Legacy names (Click, TypeInto, GetText, OpenBrowser, AttachBrowser) are automatically mapped to their Modern Design equivalents.

=== NESTING RULES ===
- Activities that make API calls, read files, or interact with external systems MUST be inside a tryCatch or retryScope node.
- Decision points MUST use IfNode with activities in thenChildren/elseChildren — NEVER emit Then/Else as string property values.
- Loops MUST use WhileNode or ForEachNode with activities in bodyChildren.
- Each "template" value in an ActivityNode MUST reference a template name from Section 2.

IMPORTANT: Respond with ONLY the JSON object. No markdown fences, no explanation.

=== SECTION 5: STRUCTURED VALUE DESCRIPTIONS (ValueIntent) ===
Property values SHOULD use structured ValueIntent objects to declare intent explicitly. This eliminates ambiguity between variable references, literals, and expressions.

Types:
1. Literal string — for text content, prompts, display strings, file paths, config values, AND enum values:
   { "type": "literal", "value": "Hello World" }
   { "type": "literal", "value": "Info" }  ← for enum properties like LogMessage.Level

2. Variable reference — for VB variable or argument references:
   { "type": "variable", "name": "str_MyVar" }

3. URL endpoints with query parameters:
   { "type": "url_with_params", "baseUrl": "https://api.example.com/data", "params": { "city": "str_CityName", "units": "metric" } }

4. Conditions with comparison operators (<, >, <>, >=, <=):
   { "type": "expression", "left": "int_StatusCode", "operator": "<>", "right": "200" }

ENUM PROPERTY RULES:
- Enum-typed properties (e.g., LogMessage Level, AddQueueItem Priority) MUST use { "type": "literal", "value": "ValidEnumValue" }
- Only use values from the catalog's validValues list — any other value is a generation failure
- Do NOT use bare strings for enum properties — always wrap in a literal ValueIntent

NEGATIVE EXAMPLES (do NOT do this):
  ✗ "Level": "Info"              → use { "type": "literal", "value": "Info" }
  ✗ "To": "str_Email"            → use { "type": "variable", "name": "str_Email" }
  ✗ "Message": "str_LogMessage"  → if this is a variable, use { "type": "variable", "name": "str_LogMessage" }

Rules:
- "expression" left/right fields must be simple variable names or literals only.
- "expression" left and right fields must NEVER be empty strings. Always provide a meaningful variable name or literal value (e.g. "0", "Nothing", "True").
- Plain strings are accepted as a legacy fallback but structured ValueIntent is preferred.

OUTPUT FORMAT RULES (strict):
- Property values must NEVER be wrapped in quotes unless they are genuine string literals. For example, use Info not "Info".
- Enum values for LogMessage Level must be bare keywords from: Trace, Info, Warn, Error, Fatal — never "Information", "Warning", or "Debug".
- InvokeWorkflowFile "WorkflowFileName" must be a plain filename like Init.xaml without surrounding quotes.
- GetAsset outputVar must be a simple variable name (e.g. str_MaxRetry), never a dictionary key access like dict_Config("key").
- Workflow names must not include ".xaml" extensions or surrounding quotes.
- ForEach "iteratorName" must be a valid identifier that matches variables referenced in body expressions.`;

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

    let uiContextBlock = "";
    try {
      const uiCtx = extractUiContext(sddSummary);
      const uiContextStr = formatUiContextForPrompt(uiCtx);
      if (uiContextStr) {
        uiContextBlock = "\n\n" + uiContextStr;
        console.log(`[AI XAML Enricher] Injected UI context: ${uiCtx.applicationNames.length} apps, ${uiCtx.fieldLabels.length} fields, ${uiCtx.buttonTexts.length} buttons, ${uiCtx.urlPatterns.length} URLs`);
      }
    } catch (err: any) {
      console.warn(`[AI XAML Enricher] UI context extraction failed: ${err.message}`);
    }

    const systemPrompt = SECTION_1_ROLE + section2Block + "\n\n" + SECTION_3_VARIABLES + "\n\n" + SECTION_4_OUTPUT + uiContextBlock;

      console.log(`[AI XAML Enricher] Requesting enrichment for ${nodeDescriptions.length} nodes (streaming)...`);
      const enrichLlmOptions = {
        maxTokens: 12288,
        temperature: 0.15,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }] as Array<{ role: "user" | "assistant"; content: string }>,
        timeoutMs,
      };
      const enrichCallStart = Date.now();
      const stream = getCodeLLM().stream(enrichLlmOptions);

      const timeoutHandle = setTimeout(() => stream.abort(), timeoutMs);

      let accumulated = "";
      let enrichStreamError: string | undefined;
      try {
        for await (const event of stream) {
          if (event.type === "text_delta" && event.text) {
            accumulated += event.text;
          }
        }
      } catch (streamErr: any) {
        enrichStreamError = streamErr?.message || "Stream error";
        const enrichRunId = getCurrentRunId();
        if (enrichRunId) {
          recordLlmCall(enrichRunId, buildLlmTraceEntry(
            "xaml_enrichment",
            enrichLlmOptions,
            accumulated,
            Date.now() - enrichCallStart,
            "error",
            enrichStreamError,
            getActiveCodeModel() || getActiveModel(),
          ));
        }
        throw streamErr;
      } finally {
        clearTimeout(timeoutHandle);
      }

      const enrichDuration = Date.now() - enrichCallStart;

      const responseText = accumulated.trim();
      if (!responseText) {
        const enrichRunId = getCurrentRunId();
        if (enrichRunId) {
          recordLlmCall(enrichRunId, buildLlmTraceEntry(
            "xaml_enrichment",
            enrichLlmOptions,
            accumulated,
            enrichDuration,
            "error",
            "Empty response",
            getActiveCodeModel() || getActiveModel(),
          ));
        }
        console.log("[AI XAML Enricher] Empty response received");
        return null;
      }

      const jsonText = stripCodeFences(responseText);
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
          const parseRunId = getCurrentRunId();
          if (parseRunId) {
            recordLlmCall(parseRunId, buildLlmTraceEntry(
              "xaml_enrichment",
              enrichLlmOptions,
              accumulated,
              enrichDuration,
              "parse_error",
              parseErr.message,
              getActiveCodeModel() || getActiveModel(),
            ));
          }
          console.log("[AI XAML Enricher] JSON repair failed — could not recover valid enrichment structure");
          return null;
        }
      }

      sanitizeValueIntentExpressions(parsed);

      const enrichRunId = getCurrentRunId();
      if (enrichRunId) {
        recordLlmCall(enrichRunId, buildLlmTraceEntry(
          "xaml_enrichment",
          enrichLlmOptions,
          accumulated,
          enrichDuration,
          "success",
          undefined,
          getActiveCodeModel() || getActiveModel(),
        ));
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

          const bareType = act.activityType.replace(/^[a-zA-Z][a-zA-Z0-9]*:/, "");
          const canonicalPrefix = getActivityPrefixStrict(bareType);
          if (canonicalPrefix !== null) {
            const canonicalType = canonicalPrefix ? `${canonicalPrefix}:${bareType}` : bareType;
            if (act.activityType !== canonicalType) {
              act.activityType = canonicalType;
            }
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
            delete act.properties["FileName"];
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
              } else if (isValueIntent(propVal)) {
                continue;
              } else if (typeof propVal === "object") {
                if (propKey.toLowerCase().includes("header")) {
                  const entries = Object.entries(propVal as Record<string, any>);
                  if (entries.length === 0) {
                    act.properties[propKey] = "New Dictionary(Of String, String)()";
                  } else {
                    const kvPairs = entries.map(([k, v]) => `{"${k}", "${String(v)}"}`).join(", ");
                    act.properties[propKey] = `New Dictionary(Of String, String) From {${kvPairs}}`;
                  }
                } else if (TIMESPAN_PROPERTY_NAMES.has(propKey)) {
                  const ts = objectToTimeSpan(propVal as Record<string, any>);
                  if (ts !== null) {
                    act.properties[propKey] = ts;
                  } else {
                    act.properties[propKey] = `INVALID_TIMESPAN_${propKey}:${JSON.stringify(propVal)}`;
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
  preMappedSpecs?: Map<string, { spec: any; processType: ProcessType }>,
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

    let preMappedContext = "";
    if (preMappedSpecs && preMappedSpecs.size > 0) {
      const specSummaries: string[] = [];
      for (const [name, entry] of preMappedSpecs) {
        const spec = entry.spec;
        const varNames = (spec.variables || []).map((v: any) => v.name).join(", ");
        const childCount = spec.rootSequence?.children?.length || 0;
        specSummaries.push(`- ${name}: ${childCount} activities, variables=[${varNames}]`);
      }
      preMappedContext = `\n\nPRE-MAPPED WORKFLOW STRUCTURE (use as starting point — refine properties to match catalog, add error handling, fix variable flow):
${specSummaries.join("\n")}
${JSON.stringify(Array.from(preMappedSpecs.entries()).map(([name, e]) => ({ name, spec: e.spec })), null, 2).slice(0, 6000)}

IMPORTANT: The pre-mapped structure above is authoritative for workflow decomposition and activity selection. Your job is to REFINE it:
1. Ensure all activity properties conform to the catalog (Section 2 templates)
2. Add proper error handling (TryCatch, RetryScope) where appropriate
3. Fix variable declarations and ensure proper flow between activities
4. Keep the same workflow structure and activity templates — do NOT change which activities are used unless they violate the catalog`;
    }

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

    let uiContextBlock2 = "";
    try {
      const uiCtx2 = extractUiContext(sddSummary);
      const uiContextStr2 = formatUiContextForPrompt(uiCtx2);
      if (uiContextStr2) {
        uiContextBlock2 = "\n\n" + uiContextStr2;
        console.log(`[AI XAML Enricher Tree] Injected UI context: ${uiCtx2.applicationNames.length} apps, ${uiCtx2.fieldLabels.length} fields, ${uiCtx2.buttonTexts.length} buttons`);
      }
    } catch (err: any) {
      console.warn(`[AI XAML Enricher Tree] UI context extraction failed: ${err.message}`);
    }

    const systemPrompt = SECTION_1_ROLE + section2Block + "\n\n" + SECTION_3_VARIABLES + "\n\n" + SECTION_4_OUTPUT + uiContextBlock2;

    let lastValidationErrors: string[] = [];
    let lastParseError: string | null = null;

    const attemptTreeEnrichment = async (extraContext?: string): Promise<TreeWorkflowSpec | null> => {
      lastValidationErrors = [];
      lastParseError = null;

      const messages: Array<{ role: "user"; content: string }> = [
        { role: "user", content: (preMappedContext ? userMessage + preMappedContext : userMessage) + (extraContext ? "\n\n" + extraContext : "") },
      ];

      const treeLlmOptions = {
        maxTokens: 16384,
        temperature: 0.15,
        system: systemPrompt,
        messages,
        timeoutMs,
      };
      const treeCallStart = Date.now();
      const stream = getCodeLLM().stream(treeLlmOptions);

      const timeoutHandle = setTimeout(() => stream.abort(), timeoutMs);

      let accumulated = "";
      try {
        for await (const event of stream) {
          if (event.type === "text_delta" && event.text) {
            accumulated += event.text;
          }
        }
      } catch (streamErr: any) {
        const treeRunId = getCurrentRunId();
        if (treeRunId) {
          recordLlmCall(treeRunId, buildLlmTraceEntry(
            "xaml_enrichment_tree",
            treeLlmOptions,
            accumulated,
            Date.now() - treeCallStart,
            "error",
            streamErr?.message || "Stream error",
            getActiveCodeModel() || getActiveModel(),
          ));
        }
        throw streamErr;
      } finally {
        clearTimeout(timeoutHandle);
      }

      const treeDuration = Date.now() - treeCallStart;

      const responseText = accumulated.trim();
      if (!responseText) {
        const treeRunId = getCurrentRunId();
        if (treeRunId) {
          recordLlmCall(treeRunId, buildLlmTraceEntry(
            "xaml_enrichment_tree",
            treeLlmOptions,
            accumulated,
            treeDuration,
            "error",
            "Empty response",
            getActiveCodeModel() || getActiveModel(),
          ));
        }
        console.log("[AI XAML Enricher Tree] Empty response received");
        lastParseError = "Empty response from LLM";
        return null;
      }

      let parsed: any;
      try {
        const jsonText = stripCodeFences(responseText);
        const sanitized = sanitizeJsonString(jsonText);
        parsed = JSON.parse(sanitized);
      } catch (parseErr: any) {
        lastParseError = `JSON parse error: ${parseErr.message}`;
        const parseRunId = getCurrentRunId();
        if (parseRunId) {
          recordLlmCall(parseRunId, buildLlmTraceEntry(
            "xaml_enrichment_tree",
            treeLlmOptions,
            accumulated,
            treeDuration,
            "parse_error",
            parseErr.message,
            getActiveCodeModel() || getActiveModel(),
          ));
        }
        console.log(`[AI XAML Enricher Tree] ${lastParseError}`);
        return null;
      }

      const treeRunId = getCurrentRunId();
      if (treeRunId) {
        recordLlmCall(treeRunId, buildLlmTraceEntry(
          "xaml_enrichment_tree",
          treeLlmOptions,
          accumulated,
          treeDuration,
          "success",
          undefined,
          getActiveCodeModel() || getActiveModel(),
        ));
      }

      if (parsed && typeof parsed === "object") {
        sanitizeObjectProperties(parsed);
        sanitizeValueIntentExpressions(parsed);
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
    if (intent.type === "vb_expression") return 0.7;
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
