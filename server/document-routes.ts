import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { documentStorage } from "./document-storage";
import { processMapStorage } from "./process-map-storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { storage } from "./storage";
import { getPlatformCapabilities, buildNuGetPackage } from "./uipath-integration";
import { generateRichXamlFromSpec, generateDeveloperHandoffGuide, aggregateGaps as aggGapsImport } from "./xaml-generator";
import { analyzeAndFix } from "./workflow-analyzer";
import { evaluateTransition } from "./stage-transition";
import { approveDocument } from "./document-service";
import { escapeXml } from "./lib/xml-utils";
import { sanitizeAndParseJson, trySanitizeAndParseJson, stripCodeFences, sanitizeJsonString } from "./lib/json-utils";
import { z } from "zod";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType, ImageRun,
} from "docx";
import { renderProcessMapImage } from "./process-map-renderer";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const PDD_PROMPT = `The SME has approved the As-Is process map. Now generate a Process Design Document. The PDD must include: 1) Executive Summary, 2) Process Scope, 3) As-Is Process Description (narrative form, referencing the steps in the map), 4) To-Be Process Description (describe the optimised automated process — how the workflow will operate once automation is applied, referencing the To-Be map steps), 5) Pain Points and Inefficiencies, 6) Automation Opportunity Assessment, 7) Assumptions and Exceptions, 8) Data and System Requirements. Write this as a professional document, not a bullet list. Be specific and use the details from our conversation.

Format your response as sections separated by "## " headings. Each section should start with "## 1. Executive Summary", "## 2. Process Scope", etc.`;

const SDD_PROMPT = `(Legacy fallback — see SDD_PROSE_PROMPT and SDD_ARTIFACTS_PROMPT for active prompts)`;

const UIPATH_PROMPT = `Based on the approved SDD, generate a detailed UiPath automation package specification. Output a JSON object with this exact shape:

{
  "projectName": "string (PascalCase, no spaces)",
  "description": "string",
  "dependencies": [
    "UiPath.System.Activities",
    "UiPath.UIAutomation.Activities",
    "... other specific UiPath package names needed"
  ],
  "workflows": [
    {
      "name": "string (PascalCase filename without .xaml)",
      "description": "string",
      "variables": [
        {
          "name": "string (camelCase variable name)",
          "type": "String|Int32|Boolean|DataTable|Object|DateTime|Array<String>|Dictionary<String,Object>",
          "defaultValue": "optional default value or empty string",
          "scope": "workflow|sequence (where this variable is declared)"
        }
      ],
      "steps": [
        {
          "activity": "string (human-readable step description)",
          "activityType": "string (exact UiPath activity name, e.g. ui:TypeInto, ui:Click, ui:GetText, ui:OpenBrowser, ui:ExcelApplicationScope, ui:ReadRange, ui:WriteRange, ui:SendSmtpMailMessage, ui:GetImapMailMessage, ui:HttpClient, ui:ExecuteQuery, ui:ReadTextFile, ui:WriteTextFile, ui:AddQueueItem, ui:GetTransactionItem, ui:SetTransactionStatus, ui:LogMessage, ui:Assign, ui:Delay, ui:MessageBox, If, ForEach, While, Switch, TryCatch, RetryScope, InvokeWorkflowFile)",
          "activityPackage": "string (UiPath package namespace, e.g. UiPath.UIAutomation.Activities, UiPath.Excel.Activities, UiPath.Mail.Activities, UiPath.WebAPI.Activities, UiPath.Database.Activities, UiPath.System.Activities)",
          "properties": {
            "key": "value (activity-specific properties like Selector, Input, Output, FileName, SheetName, URL, Method, Headers, Body, Query, Timeout, etc.)"
          },
          "selectorHint": "string or null (placeholder UI selector pattern for UI activities, e.g. '<html app=\"chrome\" /><webctrl tag=\"input\" id=\"username\" />' with TODO comments for elements needing real selectors)",
          "errorHandling": "retry|catch|escalate|none (retry = wrap in RetryScope, catch = wrap in TryCatch, escalate = catch + Action Center escalation, none = no special handling)",
          "notes": "string (implementation notes, business rules, or TODO items for the developer)"
        }
      ]
    }
  ]
}

IMPORTANT RULES:
- Use SPECIFIC UiPath activity names in activityType (e.g. "ui:TypeInto" not just "Type Into")
- For UI automation steps, always include a selectorHint with a realistic placeholder selector pattern and TODO comment
- For system interaction steps (UI, API, DB, email), set errorHandling to "retry" or "catch"
- For human-in-the-loop steps, set errorHandling to "escalate"
- Include ALL variables needed by the workflow in the variables array
- Include specific properties for each activity (e.g. Selector, Input, Output, FileName, URL, Method, etc.)
- Map decision points to If/Switch activities with Condition properties
- Map loops to ForEach/While activities
- Include initialization steps (config read, variable setup) at the start of Main workflow
- Include cleanup/logging steps at the end
- List ALL required UiPath package dependencies
- Be as specific and production-ready as possible

Return ONLY the JSON object, no other text.`;

const VALID_ERROR_HANDLING = new Set(["retry", "catch", "escalate", "none"]);

const uipathPackageSchema = z.object({
  projectName: z.string().default("UiPathPackage"),
  description: z.string().default(""),
  dependencies: z.array(z.string()).default([]),
  workflows: z.array(z.object({
    name: z.string().default("Main"),
    description: z.string().default(""),
    variables: z.array(z.object({
      name: z.string().default("variable"),
      type: z.string().default("String"),
      defaultValue: z.preprocess(v => v == null ? "" : String(v), z.string().default("")),
      scope: z.string().optional().default("workflow"),
    })).optional().default([]),
    steps: z.array(z.object({
      activity: z.string().default("Activity"),
      activityType: z.string().optional().default("ui:Comment"),
      activityPackage: z.string().optional().default("UiPath.System.Activities"),
      properties: z.record(z.unknown()).default({}),
      selectorHint: z.preprocess(
        v => typeof v === "object" && v !== null ? JSON.stringify(v) : v,
        z.string().nullable().optional().default(null)
      ),
      errorHandling: z.preprocess(
        v => {
          const normalized = typeof v === "string" ? v.trim().toLowerCase() : "";
          return VALID_ERROR_HANDLING.has(normalized) ? normalized : "none";
        },
        z.enum(["retry", "catch", "escalate", "none"]).optional().default("none")
      ),
      notes: z.preprocess(v => v == null ? "" : String(v), z.string().default("")),
    })).default([]),
  })).default([]),
});

function repairTruncatedPackageJson(rawText: string): any | null {
  try {
    let text = rawText.trim();
    const fenceStart = text.match(/```(?:json)?\s*\n/);
    if (fenceStart) {
      text = text.slice(fenceStart.index! + fenceStart[0].length);
      const fenceEnd = text.lastIndexOf("```");
      if (fenceEnd > 0) text = text.slice(0, fenceEnd);
    }

    const firstBrace = text.indexOf("{");
    if (firstBrace === -1) return null;
    text = text.slice(firstBrace);

    let inString = false;
    let escaped = false;
    let lastSafePos = 0;
    const stack: string[] = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{" || ch === "[") {
        stack.push(ch === "{" ? "}" : "]");
      } else if (ch === "}" || ch === "]") {
        if (stack.length > 0) stack.pop();
      }
      if (ch === "," || ch === "}" || ch === "]") {
        lastSafePos = i;
      }
    }

    if (inString) {
      text = text.slice(0, text.lastIndexOf('"'));
    }

    for (let attempts = 0; attempts < 30; attempts++) {
      text = text.replace(/,\s*$/, "");

      let s = false, esc = false;
      const st: string[] = [];
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') { s = !s; continue; }
        if (s) continue;
        if (c === "{") st.push("}");
        else if (c === "[") st.push("]");
        else if (c === "}" || c === "]") { if (st.length > 0) st.pop(); }
      }

      if (s) {
        text = text.slice(0, text.lastIndexOf('"'));
        continue;
      }

      const closing = st.reverse().join("");
      try {
        return JSON.parse(text + closing);
      } catch {
        const cutPoints = [text.lastIndexOf(","), text.lastIndexOf("}")].filter(p => p > 0);
        const cutAt = Math.max(...cutPoints, -1);
        if (cutAt <= 0) return null;
        text = text.slice(0, cutAt);
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function verifyIdeaAccess(req: Request, res: Response): Promise<string | null> {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  const ideaId = req.params.ideaId as string;
  const idea = await storage.getIdea(ideaId);
  if (!idea) {
    res.status(404).json({ message: "Idea not found" });
    return null;
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    res.status(401).json({ message: "User not found" });
    return null;
  }
  const activeRole = (req.session.activeRole || user.role) as string;
  if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
    res.status(403).json({ message: "Access denied" });
    return null;
  }
  return ideaId;
}

function trimChatForDocGen(messages: { role: string; content: string }[]): { role: "user" | "assistant"; content: string }[] {
  const filtered = messages
    .filter((m) => !m.content.startsWith("[DOC:") && !m.content.startsWith("[UIPATH:"));

  const deduped: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of filtered) {
    let content = m.content;
    if (content.length > 2000) {
      content = content.slice(0, 2000) + "\n...[truncated]";
    }
    const role = m.role as "user" | "assistant";
    if (deduped.length > 0 && deduped[deduped.length - 1].role === role) {
      deduped[deduped.length - 1].content += "\n" + content;
    } else {
      deduped.push({ role, content });
    }
  }

  const MAX_MSGS = 30;
  let result = deduped.length > MAX_MSGS ? deduped.slice(deduped.length - MAX_MSGS) : deduped;

  if (result.length > 0 && result[0].role !== "user") {
    result = result.slice(1);
  }
  return result;
}

function buildSddProsePrompt(platformCapabilities?: string): string {
  const platformContext = platformCapabilities
    ? `\n\nIMPORTANT — PLATFORM-AWARE DESIGN:\n${platformCapabilities}\n\nYou MUST design the solution to leverage the available services optimally. Consider the full breadth of the UiPath platform:\n- **Unattended vs Attended automation**: Use unattended bots for back-office tasks, attended for human-assisted work\n- **Agentic automation / AI Agents**: For processes needing intelligent decision-making, context understanding, or natural language processing\n- **Action Center**: For human-in-the-loop steps — approvals, validations, exception review, escalations\n- **Document Understanding**: For intelligent document processing — classification, extraction, validation of invoices, forms, contracts\n- **Integration Service**: For pre-built API connectors to enterprise systems (SAP, Salesforce, ServiceNow, etc.) instead of custom HTTP calls\n- **Storage Buckets**: For centralized file storage — input documents, output reports, templates, audit logs\n- **AI Center**: For custom ML models — classification, prediction, NLP, anomaly detection\n- **Test Manager**: For automated test suites to validate the automation\n- **Communications Mining**: For email/message triage and intelligent routing\n- **Apps**: For citizen developer interfaces where manual input or oversight is needed\n\nFor each available service, explain HOW it will be used in the solution. For unavailable services, include a "## 8. Platform Recommendations" section explaining what each missing service would unlock and the concrete benefits it would provide for this specific automation.`
    : "";

  return `The SME has approved the PDD. Generate the Solution Design Document for this UiPath automation. You are designing a solution that will be FULLY DEPLOYED — every artifact you specify will be automatically provisioned on the connected UiPath platform.

Think holistically about the optimal combination of UiPath platform capabilities to deliver this automation. Don't default to a simple bot — evaluate whether the process benefits from agents, human-in-the-loop steps, document processing, ML models, or other advanced capabilities.${platformContext}

Include these sections:

1) Automation Architecture Overview — describe the overall solution architecture, which UiPath services are used and why. Include a clear rationale for the chosen approach (e.g., why unattended vs attended, why Action Center for certain steps, etc.)
2) Process Components and Workflow Breakdown — detail each workflow/component, its purpose, and how they interconnect. Specify which execution type (unattended, attended, agent-based) each component uses
3) UiPath Activities and Packages Required — list specific UiPath packages and activities. Include Integration Service connectors if applicable
4) Integration Points and API/System Connections — all external systems, APIs, databases, and how they connect (Integration Service connectors, custom HTTP, direct DB, etc.)
5) Exception Handling Strategy — business exceptions, system exceptions, retry logic, Action Center escalations, dead-letter handling
6) Security Considerations — credential management via Orchestrator assets, role-based access, data encryption, audit trail
7) Test Strategy — unit tests, integration tests, UAT approach. Reference Test Manager if available

AGENT ARCHITECTURE (MANDATORY when automation type is agent or hybrid):
If this automation uses AI agents, you MUST include a dedicated "## 8. Agent Architecture" section with:
- **Agent Type**: autonomous (operates independently with goal-based reasoning), conversational (interactive chat-based with user), or coded (developer-written Python/JS agent logic)
- **Agent Identity**: name, purpose, and behavioral system prompt
- **Tool Definitions**: each tool the agent can invoke, mapped to a specific deployed Orchestrator process by name (e.g., "InvoiceExtractor" tool → calls the "Extract_Invoice_Data" process). Include input/output argument schemas.
- **Context Grounding Strategy**: which storage buckets provide reference documents, what document sources feed the agent's knowledge, refresh cadence, and embedding model if applicable
- **Escalation Rules**: conditions under which the agent escalates to a human, mapped to specific Action Center task catalogs by name (e.g., "confidence < 0.7" → escalate to "InvoiceReview_Catalog")
- **Guardrails**: safety constraints, output validation rules, PII handling, and maximum iteration limits
- **Agent Interaction Flow**: how the agent fits into the broader automation — which RPA process triggers it, what it returns, and how its output feeds downstream steps

Format your response as sections separated by "## " headings. Each section should start with "## 1. Automation Architecture Overview", etc. Be comprehensive and specific. Do NOT include the Orchestrator Deployment Specification — that will be generated separately as section 9.`;
}

function buildSddArtifactsPrompt(platformCapabilities?: string): string {
  const platformContext = platformCapabilities
    ? `\n\nPLATFORM AVAILABILITY:\n${platformCapabilities}\n\nOnly generate artifacts for services that are AVAILABLE. For unavailable services, do NOT include their artifact arrays.`
    : "";

  return `Based on the approved PDD and conversation, generate ONLY the Orchestrator & Platform Deployment Specification (Section 9) for a UiPath automation SDD.${platformContext}

You MUST output a fenced code block tagged \`\`\`orchestrator_artifacts with a complete JSON object defining EVERY deployable artifact needed. This is machine-parsed and used to AUTO-PROVISION all artifacts on the connected UiPath platform. Every artifact you include WILL be created automatically.

Here is the EXACT format:

\`\`\`orchestrator_artifacts
{
  "queues": [
    { "name": "QueueName", "description": "Purpose", "maxRetries": 3, "uniqueReference": true }
  ],
  "assets": [
    { "name": "AssetName", "type": "Text|Integer|Bool|Credential", "value": "default value or empty", "description": "Purpose" }
  ],
  "machines": [
    { "name": "TemplateName", "type": "Unattended|Attended|Development", "slots": 1, "description": "Purpose" }
  ],
  "triggers": [
    { "name": "TriggerName", "type": "Queue|Time", "queueName": "if queue trigger", "cron": "if time trigger e.g. 0 0 9 ? * MON-FRI *", "description": "Purpose" }
  ],
  "storageBuckets": [
    { "name": "BucketName", "description": "Purpose" }
  ],
  "environments": [
    { "name": "EnvironmentName", "type": "Production|Development|Testing", "description": "Purpose" }
  ],
  "actionCenter": [
    { "taskCatalog": "CatalogName", "assignedRole": "Role", "sla": "24 hours", "escalation": "description", "description": "Purpose" }
  ],
  "documentUnderstanding": [
    { "name": "ProjectName", "documentTypes": ["Invoice", "Receipt"], "description": "Purpose" }
  ],
  "requirements": [
    { "name": "REQ-001: Requirement name", "description": "Business requirement from PDD", "source": "PDD Section X" }
  ],
  "testCases": [
    { "name": "TC001 - Test case name", "description": "What this tests", "steps": [{ "action": "Step action", "expected": "Expected result" }] }
  ],
  "testSets": [
    { "name": "Happy Path Tests", "description": "Core scenario validation", "testCaseNames": ["TC001 - Test case name"] }
  ],
  "agents": [
    {
      "name": "AgentName",
      "agentType": "autonomous|conversational|coded",
      "description": "Agent purpose and scope",
      "systemPrompt": "Full behavioral instructions for the agent",
      "tools": [
        { "name": "ToolName", "description": "What this tool does", "processReference": "Orchestrator_Process_Name", "inputArguments": { "argName": "argType" }, "outputArguments": ["resultField"] }
      ],
      "contextGrounding": {
        "storageBucket": "BucketName_from_storageBuckets_above",
        "documentSources": ["Source description"],
        "refreshStrategy": "daily|weekly|on-change",
        "embeddingModel": "model name or default"
      },
      "guardrails": ["Safety constraint"],
      "escalationRules": [
        { "condition": "When to escalate", "target": "Human role", "actionCenterCatalog": "CatalogName_from_actionCenter_above", "priority": "High" }
      ],
      "maxIterations": 10,
      "temperature": 0.3
    }
  ],
  "knowledgeBases": [
    { "name": "KBName", "description": "Purpose", "documentSources": ["Source"], "refreshFrequency": "weekly" }
  ],
  "promptTemplates": [
    { "name": "TemplateName", "description": "Purpose", "template": "Prompt with {{variable}}", "variables": ["variable"] }
  ]
}
\`\`\`

Rules:
- Include ALL artifacts needed for a fully deployed, production-ready automation.
- Every automation needs at least one queue, credentials, a machine template, and a trigger.
- For credential assets, set value to "" (empty).
- For text/integer/bool assets, provide sensible defaults.
- For queue triggers, reference the queue name defined above.
- For time triggers, use UiPath 7-field cron expressions.
- Include environments (Production at minimum).
- Include Action Center task catalogs if the solution uses human-in-the-loop.
- Include Document Understanding projects if the solution processes documents.
- Include requirements derived from PDD business rules, compliance constraints, SLAs, and acceptance criteria. Use "REQ-NNN:" prefix for traceability.
- Include test cases covering key automation scenarios (happy path, exceptions, edge cases, regression). Use "TCNNN - " prefix.
- Group test cases into logical test sets (e.g. "Happy Path Tests", "Exception Handling Tests", "Regression Tests"). Reference test case names exactly as defined above in the testCaseNames array.
- AGENT ARTIFACTS (include when automation type is agent or hybrid):
  - Each agent MUST specify agentType (autonomous, conversational, or coded).
  - Agent tools MUST reference Orchestrator processes by exact name via processReference — these are resolved to deployed process IDs during provisioning.
  - Agent contextGrounding.storageBucket MUST reference a storage bucket defined in the storageBuckets array above by exact name.
  - Agent escalationRules.actionCenterCatalog MUST reference an Action Center catalog defined in the actionCenter array above by exact taskCatalog name.
  - These cross-references are validated and wired during deployment — the agent config will contain resolved IDs for all referenced artifacts.
- Be comprehensive — this specification drives full automated deployment.

Output ONLY "## 9. Orchestrator & Platform Deployment Specification" followed by the fenced artifacts block and any brief supporting prose. Nothing else.`;
}

function parseArtifactBlock(text: string): string | null {
  const exactMatch = text.match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
  if (exactMatch) return exactMatch[0];

  const jsonFenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (jsonFenceMatch) {
    const parsed = trySanitizeAndParseJson(jsonFenceMatch[1].trim());
    if (parsed && (parsed.queues || parsed.assets || parsed.machines || parsed.triggers)) {
      return "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
    }
  }

  const rawJsonMatch = text.match(/\{[\s\S]*"queues"[\s\S]*\}/);
  if (rawJsonMatch) {
    const parsed = trySanitizeAndParseJson(rawJsonMatch[0]);
    if (parsed && (parsed.queues || parsed.assets || parsed.machines || parsed.triggers)) {
      return "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
    }
  }

  return null;
}

async function generateDocument(ideaId: string, docType: string): Promise<string> {
  const idea = await storage.getIdea(ideaId);
  if (!idea) throw new Error("Idea not found");

  const history = await chatStorage.getMessagesByIdeaId(ideaId);
  const chatMessages = trimChatForDocGen(history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  })));

  let contextPrompt = "";
  if (docType === "PDD") {
    const asIsNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
    const asIsEdges = await processMapStorage.getEdgesByIdeaId(ideaId, "as-is");
    const toBeNodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
    const toBeEdges = await processMapStorage.getEdgesByIdeaId(ideaId, "to-be");
    const mapSummary = (nodes: any[]) => nodes.map((n) => ({ name: n.name, type: n.nodeType, role: n.role, system: n.system }));
    contextPrompt = `\n\nApproved As-Is process map:\n${JSON.stringify({ nodes: mapSummary(asIsNodes), edges: asIsEdges.map((e: any) => ({ source: e.sourceNodeId, target: e.targetNodeId, label: e.label })) })}`;
    if (toBeNodes.length > 0) {
      contextPrompt += `\n\nTo-Be process map:\n${JSON.stringify({ nodes: mapSummary(toBeNodes), edges: toBeEdges.map((e: any) => ({ source: e.sourceNodeId, target: e.targetNodeId, label: e.label })) })}`;
    }
    try {
      const platformProfile = await getPlatformCapabilities();
      if (platformProfile.configured) {
        contextPrompt += `\n\nUiPath Platform Capabilities (connected Orchestrator):\n${platformProfile.availableDescription}`;
        if (platformProfile.unavailableRecommendations) {
          contextPrompt += `\n${platformProfile.unavailableRecommendations}`;
        }
        console.log(`[PDD] Platform capabilities injected: ${platformProfile.summary}`);
      }
    } catch (err: any) {
      console.log(`[PDD] Could not fetch platform capabilities: ${err.message}`);
    }
  } else if (docType === "SDD") {
    const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
    if (pdd) {
      contextPrompt = `\n\nHere is the approved PDD:\n${pdd.content}`;
    }
  }

  if (docType === "SDD") {
    console.log("[SDD] Fetching platform capabilities for platform-aware SDD...");
    const platformProfile = await getPlatformCapabilities();
    let platformCapabilitiesText = platformProfile.configured
      ? `${platformProfile.availableDescription}\n\n${platformProfile.unavailableRecommendations}`
      : undefined;
    if (platformProfile.licenseInfo && platformCapabilitiesText) {
      const lic = platformProfile.licenseInfo;
      platformCapabilitiesText += `\n\nLICENSE ANALYSIS:\nCurrent license allocation: ${lic.summary}\n`;
      if (lic.recommendations.length > 0) {
        platformCapabilitiesText += `\nLicense optimization recommendations:\n${lic.recommendations.join("\n")}\n`;
      }
      platformCapabilitiesText += `\nInclude a "## License Analysis & Optimization" section in the SDD covering:\n1. Current license utilization and whether it supports the proposed solution\n2. Recommendations for optimal license allocation (e.g., which robot types to use, how many slots needed)\n3. Any missing license types that would be needed and the business impact of not having them`;
    }
    console.log(`[SDD] Platform profile: ${platformProfile.summary}`);

    console.log("[SDD] Starting parallel generation (prose + artifacts)...");
    const startTime = Date.now();
    const systemPrompt = `You are a professional automation consultant generating formal documents for the "${idea.title}" project. Be specific and use details from the conversation.${contextPrompt}`;

    const sddProsePrompt = buildSddProsePrompt(platformCapabilitiesText);
    const sddArtifactsPrompt = buildSddArtifactsPrompt(platformCapabilitiesText);

    const [proseResponse, artifactsResponse] = await Promise.all([
      anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 6144,
        system: systemPrompt,
        messages: [...chatMessages, { role: "user", content: sddProsePrompt }],
      }),
      anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3072,
        system: systemPrompt,
        messages: [...chatMessages, { role: "user", content: sddArtifactsPrompt }],
      }),
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SDD] Parallel generation completed in ${elapsed}s`);

    const proseText = proseResponse.content.find((b) => b.type === "text")?.text || "";
    const artifactsText = artifactsResponse.content.find((b) => b.type === "text")?.text || "";

    let artifactBlock = parseArtifactBlock(artifactsText);

    if (!artifactBlock) {
      console.warn("[SDD] Artifacts call did not produce valid block, trying extraction from prose...");
      artifactBlock = parseArtifactBlock(proseText);
    }

    if (!artifactBlock) {
      console.warn("[SDD] Both parallel calls failed to produce artifacts block, running recovery extraction...");
      try {
        const combinedText = proseText + "\n\n" + artifactsText;
        const recoveryResponse = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: "You are a UiPath automation consultant. Extract the Orchestrator artifact definitions and output ONLY a fenced JSON block. Output nothing else.",
          messages: [{
            role: "user",
            content: `From this document, extract ALL Orchestrator and platform artifacts and output them as a single fenced block:\n\n\`\`\`orchestrator_artifacts\n{ "queues": [...], "assets": [...], "machines": [...], "triggers": [...], "storageBuckets": [...], "environments": [...], "actionCenter": [...], "documentUnderstanding": [...], "testCases": [...], "requirements": [...], "testSets": [...] }\n\`\`\`\n\nDocument:\n${combinedText.slice(0, 8000)}`
          }],
        });
        const recoveryText = recoveryResponse.content.find((b) => b.type === "text")?.text || "";
        artifactBlock = parseArtifactBlock(recoveryText);
        if (artifactBlock) {
          console.log("[SDD] Recovery extraction succeeded");
        } else {
          console.error("[SDD] Recovery extraction also failed — SDD will lack orchestrator_artifacts block");
        }
      } catch (err: any) {
        console.error("[SDD] Recovery extraction error:", err?.message);
      }
    }

    let deploySpecContent: string;
    if (artifactBlock) {
      deploySpecContent = `## 9. Orchestrator & Platform Deployment Specification\n\n${artifactBlock}`;
    } else {
      deploySpecContent = "";
    }

    let content = proseText;
    const existingDeploySpec = /## (?:8|9)[\.\s].*(?:Orchestrator|Deployment)/i.test(content);
    if (deploySpecContent) {
      if (existingDeploySpec) {
        content = content.replace(/## (?:8|9)[\.\s].*(?:Orchestrator|Deployment)[\s\S]*$/, deploySpecContent.trim());
      } else {
        content = content.trimEnd() + "\n\n" + deploySpecContent.trim();
      }
    }

    const hasBlock = /```orchestrator_artifacts/.test(content);
    console.log(`[SDD] Final document: ${content.length} chars, has artifacts block: ${hasBlock}`);
    return content;
  }

  const prompt = docType === "PDD" ? PDD_PROMPT : UIPATH_PROMPT;
  const maxTokens = 4096;
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: `You are a professional automation consultant generating formal documents for the "${idea.title}" project. Be specific and use details from the conversation.${contextPrompt}`,
    messages: [...chatMessages, { role: "user", content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock?.text || "";
}

export function registerDocumentRoutes(app: Express): void {
  app.get("/api/ideas/:ideaId/artifacts", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) return res.status(404).json({ message: "Idea not found" });

      const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
      const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
      const pddApproval = await documentStorage.getApproval(ideaId, "PDD");
      const sddApproval = await documentStorage.getApproval(ideaId, "SDD");

      const asIsNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
      const toBeNodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
      const asIsApproval = await processMapStorage.getApproval(ideaId, "as-is");
      const toBeApproval = await processMapStorage.getApproval(ideaId, "to-be");

      const messages = await chatStorage.getMessagesByIdeaId(ideaId);
      const uipathMsg = [...messages].reverse().find((m) => m.content.startsWith("[UIPATH:"));
      let uipathData: { projectName?: string; workflowCount?: number; dependencyCount?: number } | null = null;
      if (uipathMsg) {
        try {
          const pkg = JSON.parse(uipathMsg.content.slice(8, -1));
          uipathData = {
            projectName: pkg.projectName,
            workflowCount: pkg.workflows?.length || 0,
            dependencyCount: pkg.dependencies?.length || 0,
          };
        } catch {}
      }

      const artifacts = [
        {
          type: "as-is" as const,
          label: "As-Is Process Map",
          exists: asIsNodes.length > 0,
          status: asIsApproval && !asIsApproval.invalidated ? "Approved" : asIsNodes.length > 0 ? "Draft" : "Not Generated",
          version: asIsApproval?.version || null,
          nodeCount: asIsNodes.length,
        },
        {
          type: "to-be" as const,
          label: "To-Be Process Map",
          exists: toBeNodes.length > 0,
          status: toBeApproval && !toBeApproval.invalidated ? "Approved" : toBeNodes.length > 0 ? "Draft" : "Not Generated",
          version: toBeApproval?.version || null,
          nodeCount: toBeNodes.length,
        },
        {
          type: "pdd" as const,
          label: "Process Design Document",
          exists: !!pdd,
          status: pddApproval ? "Approved" : pdd ? (pdd.status === "approved" ? "Approved" : "Draft") : "Not Generated",
          version: pdd?.version || null,
        },
        {
          type: "sdd" as const,
          label: "Solution Design Document",
          exists: !!sdd,
          status: sddApproval ? "Approved" : sdd ? (sdd.status === "approved" ? "Approved" : "Draft") : "Not Generated",
          version: sdd?.version || null,
        },
        {
          type: "uipath" as const,
          label: "UiPath Package",
          exists: !!uipathMsg,
          status: uipathMsg ? "Generated" : "Not Generated",
          version: null,
          meta: uipathData,
        },
        {
          type: "dhg" as const,
          label: "Developer Handoff Guide",
          exists: !!uipathMsg,
          status: uipathMsg ? "Available" : "Not Generated",
          version: null,
        },
      ];

      return res.json({ artifacts });
    } catch (error) {
      console.error("Error fetching artifacts summary:", error);
      return res.status(500).json({ message: "Failed to fetch artifacts" });
    }
  });

  app.get("/api/ideas/:ideaId/documents", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const docs = await documentStorage.getDocumentsByIdea(ideaId);
    return res.json(docs);
  });

  app.get("/api/ideas/:ideaId/documents/versions/:type", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const docType = req.params.type as string;
    const versions = await documentStorage.getDocumentVersions(ideaId, docType);
    return res.json(versions);
  });

  app.get("/api/ideas/:ideaId/documents/latest/:type", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const docType = req.params.type as string;
    const doc = await documentStorage.getLatestDocument(ideaId, docType);
    const approval = await documentStorage.getApproval(ideaId, docType);
    return res.json({ document: doc || null, approval: approval || null });
  });

  app.post("/api/ideas/:ideaId/documents/generate", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    const { type } = req.body;
    if (!type || !["PDD", "SDD"].includes(type)) {
      return res.status(400).json({ message: "Invalid document type" });
    }

    try {
      const existing = await documentStorage.getLatestDocument(ideaId, type);
      const version = existing ? existing.version + 1 : 1;

      if (existing && existing.status !== "approved") {
        await documentStorage.updateDocument(existing.id, { status: "superseded" });
      }

      const content = await generateDocument(ideaId, type);

      const nodes = type === "PDD"
        ? await processMapStorage.getNodesByIdeaId(ideaId, "as-is")
        : [];
      const snapshot = JSON.stringify({ generatedFrom: type === "PDD" ? "as-is-map" : "pdd", nodes });

      const doc = await documentStorage.createDocument({
        ideaId,
        type,
        version,
        status: "draft",
        content,
        snapshotJson: snapshot,
      });

      await chatStorage.createMessage(
        ideaId,
        "assistant",
        `[DOC:${type}:${doc.id}]${content}`
      );

      return res.json(doc);
    } catch (error: any) {
      const msg = error?.message || error?.toString() || "Unknown error";
      console.error(`Error generating ${type}:`, msg);
      if (error?.status) console.error(`API status: ${error.status}`);
      return res.status(500).json({ message: `Failed to generate ${type}: ${msg.slice(0, 200)}` });
    }
  });

  app.post("/api/ideas/:ideaId/documents/:docId/approve", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    const docId = parseInt(req.params.docId as string);
    const doc = await documentStorage.getDocument(docId);
    if (!doc || doc.ideaId !== ideaId) {
      return res.status(404).json({ message: "Document not found" });
    }

    try {
      const result = await approveDocument({
        ideaId,
        docType: doc.type as "PDD" | "SDD",
        docId,
        userId: req.session.userId!,
        activeRole: req.session.activeRole,
      });
      if (result.alreadyApproved) {
        return res.status(400).json({ message: "Already approved" });
      }
      return res.json(result);
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  });

  app.post("/api/ideas/:ideaId/documents/revise", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    const { type, revision } = req.body;
    if (!type || !revision) {
      return res.status(400).json({ message: "type and revision required" });
    }

    try {
      const currentDoc = await documentStorage.getLatestDocument(ideaId, type);
      if (!currentDoc) {
        return res.status(404).json({ message: "No document to revise" });
      }

      await chatStorage.createMessage(ideaId, "user", revision);

      const idea = await storage.getIdea(ideaId);
      if (!idea) return res.status(404).json({ message: "Idea not found" });

      const history = await chatStorage.getMessagesByIdeaId(ideaId);
      const chatMessages = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const revisionPrompt = `The user has requested a revision to the ${type}. Here is the current document:\n\n${currentDoc.content}\n\nRevision request: ${revision}\n\nPlease regenerate the complete ${type} with this revision applied. Keep the same section structure (## headings). Output only the revised document.`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: `You are a professional automation consultant revising a ${type} for the "${idea.title}" project.`,
        messages: [...chatMessages, { role: "user", content: revisionPrompt }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      let content = textBlock?.text || "";

      if (type === "SDD" && content.length > 0) {
        const hasArtifactsBlock = /```orchestrator_artifacts\s*\n[\s\S]*?\n```/.test(content);
        if (!hasArtifactsBlock) {
          console.log("[SDD Revision] orchestrator_artifacts block missing, extracting...");
          try {
            const extractionResponse = await anthropic.messages.create({
              model: "claude-sonnet-4-6",
              max_tokens: 2048,
              system: "You are a UiPath automation consultant. Extract the Orchestrator artifact definitions from the SDD document and output ONLY a fenced JSON block. Output nothing else.",
              messages: [{
                role: "user",
                content: `From this Solution Design Document, extract ALL Orchestrator artifacts needed and output them as a single fenced JSON block using this exact format:

\`\`\`orchestrator_artifacts
{
  "queues": [{ "name": "QueueName", "description": "Purpose", "maxRetries": 3, "uniqueReference": true }],
  "assets": [{ "name": "AssetName", "type": "Text|Integer|Bool|Credential", "value": "default or empty", "description": "Purpose" }],
  "machines": [{ "name": "TemplateName", "type": "Unattended|Attended|Development", "slots": 1, "description": "Purpose" }],
  "triggers": [{ "name": "TriggerName", "type": "Queue|Time", "queueName": "if queue trigger", "cron": "if time trigger", "description": "Purpose" }],
  "storageBuckets": [{ "name": "BucketName", "description": "Purpose" }],
  "actionCenter": [{ "taskCatalog": "CatalogName", "assignedRole": "Role", "sla": "24 hours", "escalation": "description", "description": "Purpose" }]
}
\`\`\`

Here is the SDD:
${content}`
              }],
            });
            const extractBlock = extractionResponse.content.find((b) => b.type === "text");
            const extractedText = extractBlock?.text || "";
            let artifactBlock: string | null = null;
            const exactMatch = extractedText.match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
            if (exactMatch) {
              artifactBlock = exactMatch[0];
            } else {
              const jsonFenceMatch = extractedText.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
              if (jsonFenceMatch) {
                try {
                  const parsed = JSON.parse(jsonFenceMatch[1].trim());
                  if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers) {
                    artifactBlock = "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
                  }
                } catch { /* not valid JSON */ }
              }
              if (!artifactBlock) {
                const rawJsonMatch = extractedText.match(/\{[\s\S]*"queues"[\s\S]*\}/);
                if (rawJsonMatch) {
                  try {
                    const parsed = JSON.parse(rawJsonMatch[0]);
                    if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers) {
                      artifactBlock = "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
                    }
                  } catch { /* not valid JSON */ }
                }
              }
            }
            if (artifactBlock) {
              const section8Regex = /## (?:8|9)[\.\s][^\n]*/i;
              const section8Match = content.match(section8Regex);
              if (section8Match) {
                const insertPos = content.indexOf(section8Match[0]) + section8Match[0].length;
                content = content.slice(0, insertPos) + `\n\n${artifactBlock}` + content.slice(insertPos);
              } else {
                content += `\n\n## 9. Orchestrator & Platform Deployment Specification\n\n${artifactBlock}`;
              }
              console.log("[SDD Revision] Successfully appended orchestrator_artifacts block");
            } else {
              console.warn("[SDD Revision] Follow-up extraction failed. Raw:", extractedText.slice(0, 500));
            }
          } catch (extractErr: any) {
            console.error("[SDD Revision] Artifact extraction failed:", extractErr?.message);
          }
        }
      }

      await documentStorage.updateDocument(currentDoc.id, { status: "superseded" });

      const doc = await documentStorage.createDocument({
        ideaId,
        type,
        version: currentDoc.version + 1,
        status: "draft",
        content,
        snapshotJson: currentDoc.snapshotJson,
      });

      await chatStorage.createMessage(
        ideaId,
        "assistant",
        `[DOC:${type}:${doc.id}]${content}`
      );

      return res.json(doc);
    } catch (error) {
      console.error(`Error revising ${type}:`, error);
      return res.status(500).json({ message: `Failed to revise ${type}` });
    }
  });

  app.post("/api/ideas/:ideaId/generate-uipath", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    try {
      const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
      if (!sdd || sdd.status !== "approved") {
        return res.status(400).json({ message: "SDD must be approved first" });
      }

      const existingMessages = await chatStorage.getMessagesByIdeaId(ideaId);
      const existingUiPath = [...existingMessages].reverse().find((m) => m.content.startsWith("[UIPATH:"));
      if (existingUiPath && !req.query.force) {
        try {
          const existingData = JSON.parse(existingUiPath.content.slice(8, -1));
          if ((existingData.workflows || []).length > 0) {
            return res.json({ package: existingData });
          }
          console.log(`[UiPath] Cached package for ${ideaId} has 0 workflows — regenerating`);
        } catch { /* fall through to regeneration */ }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const sendProgress = (message: string) => {
        res.write(`data: ${JSON.stringify({ progress: message })}\n\n`);
      };

      sendProgress("Loading idea and documents...");

      const idea = await storage.getIdea(ideaId);
      if (!idea) {
        res.write(`data: ${JSON.stringify({ error: "Idea not found" })}\n\n`);
        return res.end();
      }

      const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
      const toBeNodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
      const asIsNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
      const mapNodes = toBeNodes.length > 0 ? toBeNodes : asIsNodes;
      const mapSummary = mapNodes.map((n) => ({ name: n.name, type: n.nodeType, role: n.role, system: n.system, description: n.description }));

      let systemCtx = `You are a UiPath automation architect generating a production-ready package structure for "${idea.title}".\n\nApproved SDD:\n${sdd.content}`;
      if (pdd) {
        systemCtx += `\n\nApproved PDD:\n${pdd.content}`;
      }
      if (mapSummary.length > 0) {
        systemCtx += `\n\nProcess Map Steps:\n${JSON.stringify(mapSummary)}`;
      }

      sendProgress("Calling LLM to generate package specification...");

      const keepAliveInterval = setInterval(() => {
        sendProgress("Still generating package specification...");
      }, 15000);

      let response;
      try {
        response = await anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 16384,
          system: systemCtx,
          messages: [{ role: "user", content: UIPATH_PROMPT }],
        });
      } finally {
        clearInterval(keepAliveInterval);
      }

      sendProgress("LLM response received, parsing JSON...");

      const textBlock = response.content.find((b) => b.type === "text");
      const rawText = textBlock?.text || "{}";

      if (response.stop_reason === "max_tokens") {
        console.warn(`[UiPath] LLM response truncated at max_tokens for ${ideaId} — attempting repair`);
        sendProgress("Response truncated, attempting JSON repair...");
      }

      let packageJson;
      try {
        const parsed = sanitizeAndParseJson(rawText);
        packageJson = uipathPackageSchema.parse(parsed);
        sendProgress("Package JSON parsed successfully");
      } catch (parseErr: any) {
        sendProgress("Initial parse failed, attempting repair...");
        const repaired = repairTruncatedPackageJson(rawText);
        if (repaired) {
          try {
            packageJson = uipathPackageSchema.parse(repaired);
            console.log(`[UiPath] Repaired truncated JSON for ${ideaId}: ${(repaired.workflows || []).length} workflows recovered`);
            sendProgress(`Repaired JSON: ${(repaired.workflows || []).length} workflows recovered`);
          } catch (repairErr: any) {
            console.error(`[UiPath] Repair also failed for ${ideaId}:`, repairErr?.message);
          }
        }
        if (!packageJson) {
          console.error(`[UiPath] Package parse/validation failed for ${ideaId}:`, parseErr?.message || parseErr);
          console.error(`[UiPath] Raw LLM response (first 500 chars):`, rawText.slice(0, 500));
          res.write(`data: ${JSON.stringify({ error: "Failed to parse AI-generated package. Please try again." })}\n\n`);
          return res.end();
        }
      }

      if (!packageJson.workflows || packageJson.workflows.length === 0) {
        console.error(`[UiPath] Generated package for ${ideaId} has 0 workflows — not storing`);
        res.write(`data: ${JSON.stringify({ error: "AI generated a package with no workflows. Please try again." })}\n\n`);
        return res.end();
      }

      sendProgress(`Validating ${packageJson.workflows.length} workflow(s)...`);

      await chatStorage.createMessage(
        ideaId,
        "assistant",
        `[UIPATH:${JSON.stringify(packageJson)}]`
      );

      sendProgress("Package spec stored. Pre-building .nupkg with AI enrichment...");

      try {
        const enrichPkg = { ...packageJson } as any;
        if (sdd?.content) enrichPkg._sddContent = sdd.content;
        if (idea.automationType) enrichPkg._automationType = idea.automationType;
        if (mapNodes.length > 0) {
          enrichPkg._processNodes = mapNodes;
          const allEdges = await processMapStorage.getEdgesByIdeaId(ideaId, toBeNodes.length > 0 ? "to-be" : "as-is");
          enrichPkg._processEdges = allEdges;
        }
        if (sdd?.content) {
          const { parseArtifactsFromSDD, extractArtifactsWithLLM } = await import("./uipath-deploy");
          let artifacts = parseArtifactsFromSDD(sdd.content);
          if (!artifacts) artifacts = await extractArtifactsWithLLM(sdd.content);
          if (artifacts) enrichPkg._orchestratorArtifacts = artifacts;
        }

        const now = new Date();
        const patch = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
        const version = `1.0.${patch}`;

        sendProgress("AI-enriching XAML workflows...");
        const buildResult = await buildNuGetPackage(enrichPkg, version, ideaId);
        console.log(`[UiPath] Pre-built .nupkg for "${idea.title}" — ${buildResult.buffer.length} bytes, ${buildResult.gaps.length} gaps`);
        sendProgress(`Pre-build complete: ${packageJson.workflows.length} workflow(s) enriched`);
      } catch (prebuildErr: any) {
        console.error(`[UiPath] Pre-build failed (deploy will rebuild):`, prebuildErr?.message);
        sendProgress("Pre-build skipped — deploy will build on demand");
      }

      res.write(`data: ${JSON.stringify({ done: true, package: packageJson })}\n\n`);
      return res.end();
    } catch (error) {
      console.error("Error generating UiPath package:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to generate UiPath package" });
      }
      res.write(`data: ${JSON.stringify({ error: "Failed to generate UiPath package" })}\n\n`);
      return res.end();
    }
  });

  app.get("/api/ideas/:ideaId/download-uipath", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) return res.status(404).json({ message: "Idea not found" });

      const messages = await chatStorage.getMessagesByIdeaId(ideaId);
      const uipathMsg = [...messages].reverse().find((m) => m.content.startsWith("[UIPATH:"));
      if (!uipathMsg) {
        return res.status(404).json({ message: "No UiPath package found" });
      }

      const jsonStr = uipathMsg.content.slice(8, -1);
      let pkg;
      try {
        pkg = JSON.parse(jsonStr);
      } catch {
        return res.status(500).json({ message: "Invalid package data" });
      }

      const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
      const sddContent = sdd?.content || "";

      const archiverModule = require("archiver") as typeof import("archiver");
      const archive = (archiverModule as any)("zip", { zlib: { level: 9 } });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${pkg.projectName || "UiPathPackage"}.zip"`);

      archive.pipe(res);

      const { generateInitAllSettingsXaml: genInit, aggregatePackages: aggPkgs } = require("./xaml-generator");
      const allXamlResults: any[] = [];

      const workflows = pkg.workflows || [];
      for (const wf of workflows) {
        const result = generateRichXamlFromSpec(wf, sddContent || undefined);
        allXamlResults.push(result);
        archive.append(result.xaml, { name: `${wf.name || "Workflow"}.xaml` });
      }

      const initXaml = genInit();
      archive.append(initXaml, { name: "InitAllSettings.xaml" });

      const richPkgs = aggPkgs(allXamlResults);
      const packageVersionMap: Record<string, string> = {
        "UiPath.System.Activities": "[23.10.0]",
        "UiPath.UIAutomation.Activities": "[23.10.0]",
        "UiPath.Web.Activities": "[1.18.0]",
        "UiPath.Excel.Activities": "[2.22.0]",
        "UiPath.Mail.Activities": "[1.20.0]",
        "UiPath.Database.Activities": "[1.8.0]",
      };
      const depMap: Record<string, string> = {};
      for (const d of (pkg.dependencies || [])) {
        depMap[d] = packageVersionMap[d] || "*";
      }
      for (const rp of richPkgs) {
        if (!depMap[rp]) depMap[rp] = packageVersionMap[rp] || "*";
      }
      if (!depMap["UiPath.Excel.Activities"]) {
        depMap["UiPath.Excel.Activities"] = "[2.22.0]";
      }

      const crypto = require("crypto");
      const entryPointId = crypto.randomUUID();
      const projectJson = {
        name: pkg.projectName || idea.title.replace(/\s+/g, "_"),
        description: pkg.description || idea.description,
        main: "Main.xaml",
        dependencies: depMap,
        webServices: [],
        entitiesStores: [],
        schemaVersion: "4.0",
        studioVersion: "25.10.0",
        projectVersion: "1.0.0",
        runtimeOptions: {
          autoDispose: false,
          netFrameworkLazyLoading: false,
          isPausable: true,
          isAttended: false,
          requiresUserInteraction: false,
          supportsPersistence: false,
          executionType: "Workflow",
          readyForPiP: false,
          startsInPiP: false,
          mustRestoreAllDependencies: true,
        },
        designOptions: {
          projectProfile: "Developement",
          outputType: "Process",
          libraryOptions: { includeOriginalXaml: false, privateWorkflows: [] },
          processOptions: { ignoredFiles: [] },
          fileInfoCollection: [],
          modernBehavior: false,
        },
        expressionLanguage: "VisualBasic",
        entryPoints: [
          {
            filePath: "Main.xaml",
            uniqueId: entryPointId,
            input: [],
            output: [],
          },
        ],
        isTemplate: false,
        templateProjectData: {},
        publishData: {},
      };
      archive.append(JSON.stringify(projectJson, null, 2), { name: "project.json" });

      archive.append("Name,Value,Description\nOrchestratorURL,,Orchestrator base URL\nProcessTimeout,30,Max process timeout in minutes\nMaxRetries,3,Maximum retry attempts\nApplicationName," + (pkg.projectName || "Automation") + ",Process name\nVersion,1.0.0,Package version", { name: "Data/Config.csv" });

      let readme = `# ${pkg.projectName || idea.title}\n\n`;
      readme += `${pkg.description || idea.description}\n\n`;
      readme += `## Import Instructions\n\n`;
      readme += `1. Open UiPath Studio\n`;
      readme += `2. Click "Open Project" and navigate to this folder\n`;
      readme += `3. Select project.json\n`;
      readme += `4. Install any missing dependencies from the Package Manager\n`;
      readme += `5. Review each XAML workflow file\n\n`;
      readme += `## Workflows\n\n`;
      for (const wf of workflows) {
        readme += `### ${wf.name}\n${wf.description || ""}\n\n`;
        if (wf.steps) {
          for (const step of wf.steps) {
            readme += `- **${step.activity}**: ${step.notes || ""}\n`;
          }
          readme += "\n";
        }
      }
      archive.append(readme, { name: "README.md" });

      const analysisReports: Array<{ fileName: string; report: any }> = [];
      for (let i = 0; i < allXamlResults.length; i++) {
        const wfName = (workflows[i]?.name || "Workflow").replace(/\s+/g, "_");
        const { report } = analyzeAndFix(allXamlResults[i].xaml);
        analysisReports.push({ fileName: `${wfName}.xaml`, report });
      }

      const allGapsForDhg = aggGapsImport(allXamlResults);
      const allUsedPkgsForDhg = Object.keys(depMap);
      const wfNamesForDhg = workflows.map((wf: any) => (wf.name || "Workflow").replace(/\s+/g, "_"));

      const zipEnrichment = pkg._enrichment || pkg.enrichment || null;
      const zipUseReFramework = zipEnrichment?.useReFramework ?? pkg._useReFramework ?? pkg.useReFramework ?? false;
      const zipPainPoints = (pkg._painPoints || pkg.painPoints || []).map((p: any) => ({
        name: p.name || "",
        description: p.description || "",
      }));
      const zipExtractedArtifacts = pkg._extractedArtifacts || pkg.extractedArtifacts || undefined;

      const zipDeployReportMsg = [...messages].reverse().find((m) => m.content.includes("[DEPLOY_REPORT:"));
      let zipDeploymentResults: any[] | undefined;
      if (zipDeployReportMsg) {
        const drMatch = zipDeployReportMsg.content.match(/\[DEPLOY_REPORT:([\s\S]*?)\]$/);
        if (drMatch) {
          try {
            const drData = JSON.parse(drMatch[1]);
            zipDeploymentResults = drData.results || [];
          } catch {}
        }
      }

      const dhgContent = generateDeveloperHandoffGuide({
        projectName: pkg.projectName || idea.title.replace(/\s+/g, "_"),
        description: pkg.description || idea.description,
        gaps: allGapsForDhg,
        usedPackages: allUsedPkgsForDhg,
        workflowNames: wfNamesForDhg,
        sddContent: sddContent || undefined,
        enrichment: zipEnrichment,
        useReFramework: zipUseReFramework,
        painPoints: zipPainPoints,
        deploymentResults: zipDeploymentResults,
        extractedArtifacts: zipExtractedArtifacts,
        automationType: idea.automationType as "rpa" | "agent" | "hybrid" || undefined,
        analysisReports,
      });
      archive.append(dhgContent, { name: "DeveloperHandoffGuide.md" });

      const autoType = idea.automationType as string || "";
      if (autoType === "agent" || autoType === "hybrid") {
        const agentName = (pkg.projectName || idea.title).replace(/\s+/g, "_");

        const systemPrompt = extractAgentPrompt(sddContent, "system", pkg);
        archive.append(systemPrompt, { name: "prompts/system_prompt.txt" });

        const userPromptTemplate = extractAgentPrompt(sddContent, "user", pkg);
        archive.append(userPromptTemplate, { name: "prompts/user_prompt_template.txt" });

        const toolDefs = extractToolDefinitions(sddContent, pkg);
        archive.append(JSON.stringify(toolDefs, null, 2), { name: "tools/tool_definitions.json" });

        const kbPlaceholder = generateKBPlaceholder(sddContent, pkg);
        archive.append(kbPlaceholder, { name: "knowledge/kb_placeholder.md" });

        const agentConfig = generateAgentConfig(agentName, sddContent, pkg);
        archive.append(JSON.stringify(agentConfig, null, 2), { name: `agents/${agentName}_config.json` });
      }

      await archive.finalize();
    } catch (error) {
      console.error("Error generating ZIP:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to generate ZIP" });
      }
    }
  });

  app.get("/api/ideas/:ideaId/dhg", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) return res.status(404).json({ message: "Idea not found" });

      const messages = await chatStorage.getMessagesByIdeaId(ideaId);
      const uipathMsg = [...messages].reverse().find((m) => m.content.startsWith("[UIPATH:"));
      if (!uipathMsg) {
        return res.status(404).json({ message: "No UiPath package found. Generate the package first." });
      }

      const jsonStr = uipathMsg.content.slice(8, -1);
      let pkg;
      try {
        pkg = JSON.parse(jsonStr);
      } catch {
        return res.status(500).json({ message: "Invalid package data" });
      }

      const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
      const sddContent = sdd?.content || "";

      const aggGaps = aggGapsImport;
      const workflows = pkg.workflows || [];
      const allXamlResults: any[] = [];
      for (const wf of workflows) {
        const result = generateRichXamlFromSpec(wf, sddContent || undefined);
        allXamlResults.push(result);
      }

      const analysisReports: Array<{ fileName: string; report: any }> = [];
      for (let i = 0; i < allXamlResults.length; i++) {
        const wfName = (workflows[i]?.name || "Workflow").replace(/\s+/g, "_");
        const { report } = analyzeAndFix(allXamlResults[i].xaml);
        analysisReports.push({ fileName: `${wfName}.xaml`, report });
      }

      const allGapsForDhg = aggGaps(allXamlResults);
      const depMap: Record<string, string> = {};
      for (const d of (pkg.dependencies || [])) depMap[d] = "*";
      const wfNamesForDhg = workflows.map((wf: any) => (wf.name || "Workflow").replace(/\s+/g, "_"));

      const enrichment = pkg._enrichment || pkg.enrichment || null;
      const useReFramework = enrichment?.useReFramework ?? pkg._useReFramework ?? pkg.useReFramework ?? false;
      const painPoints = (pkg._painPoints || pkg.painPoints || []).map((p: any) => ({
        name: p.name || "",
        description: p.description || "",
      }));

      const deployReportMsg = [...messages].reverse().find((m) => m.content.includes("[DEPLOY_REPORT:"));
      let deploymentResults: any[] | undefined;
      if (deployReportMsg) {
        const drMatch = deployReportMsg.content.match(/\[DEPLOY_REPORT:([\s\S]*?)\]$/);
        if (drMatch) {
          try {
            const drData = JSON.parse(drMatch[1]);
            deploymentResults = drData.results || [];
          } catch {}
        }
      }

      const extractedArtifacts = pkg._extractedArtifacts || pkg.extractedArtifacts || undefined;

      const dhgContent = generateDeveloperHandoffGuide({
        projectName: pkg.projectName || idea.title.replace(/\s+/g, "_"),
        description: pkg.description || idea.description,
        gaps: allGapsForDhg,
        usedPackages: Object.keys(depMap),
        workflowNames: wfNamesForDhg,
        sddContent: sddContent || undefined,
        enrichment,
        useReFramework,
        painPoints,
        deploymentResults,
        extractedArtifacts,
        automationType: idea.automationType as "rpa" | "agent" | "hybrid" || undefined,
        analysisReports,
      });

      res.json({ content: dhgContent, projectName: pkg.projectName || idea.title });
    } catch (error) {
      console.error("Error generating DHG:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to generate Developer Handoff Guide" });
      }
    }
  });

  app.get("/api/ideas/:ideaId/export", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const ideaId = req.params.ideaId as string;

    const types = ((req.query.types as string) || "").split(",").filter(Boolean);
    const validTypes = ["as-is", "to-be", "pdd", "sdd"];
    const requestedTypes = types.length ? types.filter(t => validTypes.includes(t.toLowerCase())) : validTypes;

    if (!requestedTypes.length) {
      return res.status(400).json({ message: "No valid document types specified. Use: as-is, to-be, pdd, sdd" });
    }

    try {
      const idea = await storage.getIdea(ideaId);
      const ideaTitle = idea?.title || "Untitled Idea";
      const docChildren: (Paragraph | Table)[] = [];

      const ORANGE = "E8450A";

      docChildren.push(new Paragraph({
        heading: HeadingLevel.TITLE,
        children: [new TextRun({ text: `Document Export: ${ideaTitle}`, bold: true, size: 48, color: ORANGE })],
        spacing: { after: 200 },
      }));
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: "Exported: ", bold: true, size: 20, color: "999999" }),
          new TextRun({ text: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), size: 20, color: "999999" }),
        ],
        spacing: { after: 100 },
      }));
      docChildren.push(new Paragraph({
        children: [
          new TextRun({ text: "Idea ID: ", bold: true, size: 20, color: "999999" }),
          new TextRun({ text: ideaId, size: 20, color: "999999", font: "Courier New" }),
        ],
        spacing: { after: 400 },
      }));

      for (const t of requestedTypes) {
        const typeLower = t.toLowerCase();

        if (typeLower === "as-is" || typeLower === "to-be") {
          const viewType = typeLower;
          const label = typeLower === "as-is" ? "As-Is Process Map" : "To-Be Process Map";

          docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: label, bold: true, size: 32, color: ORANGE })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ORANGE } },
          }));

          const nodes = await processMapStorage.getNodesByIdeaId(ideaId, viewType);
          const edges = await processMapStorage.getEdgesByIdeaId(ideaId, viewType);

          if (!nodes.length) {
            docChildren.push(new Paragraph({
              children: [new TextRun({ text: `No ${label.toLowerCase()} data available.`, italics: true, color: "888888" })],
              spacing: { after: 200 },
            }));
            continue;
          }

          try {
            const mapImage = await renderProcessMapImage(nodes, edges, viewType);
            if (mapImage) {
              docChildren.push(new Paragraph({
                children: [
                  new ImageRun({
                    data: mapImage.buffer,
                    transformation: { width: mapImage.width, height: mapImage.height },
                    type: "png",
                  }),
                ],
                spacing: { before: 100, after: 200 },
                alignment: AlignmentType.CENTER,
              }));
            } else {
              docChildren.push(new Paragraph({
                children: [new TextRun({ text: "[Process map image could not be generated]", italics: true, color: "888888" })],
                spacing: { before: 100, after: 200 },
              }));
            }
          } catch (imgErr: any) {
            console.error("[Document Export] Process map image generation failed:", imgErr.message);
            docChildren.push(new Paragraph({
              children: [new TextRun({ text: "[Process map image could not be generated]", italics: true, color: "888888" })],
              spacing: { before: 100, after: 200 },
            }));
          }

          docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: `Process Steps (${nodes.length})`, bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          }));

          const sortedNodes = [...nodes].sort((a, b) =>
            (a.positionY || 0) - (b.positionY || 0) || (a.positionX || 0) - (b.positionX || 0)
          );

          const tableRows: TableRow[] = [
            new TableRow({
              tableHeader: true,
              children: ["Step", "Type", "Role", "System"].map(h =>
                new TableCell({
                  width: { size: h === "Step" ? 40 : 20, type: WidthType.PERCENTAGE },
                  shading: { type: ShadingType.SOLID, fill: ORANGE, color: "FFFFFF" },
                  children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20 })], alignment: AlignmentType.LEFT })],
                })
              ),
            }),
          ];
          for (const node of sortedNodes) {
            tableRows.push(new TableRow({
              children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: node.name || "Unnamed Step", bold: true, size: 20 })]})] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: (node.nodeType || "task").toUpperCase(), size: 18, color: "666666" })]})] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: node.role || "—", size: 20 })]})] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: node.system || "—", size: 20 })]})] }),
              ],
            }));
          }
          docChildren.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
          docChildren.push(new Paragraph({ spacing: { after: 200 } }));

          if (edges.length) {
            docChildren.push(new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: `Connections (${edges.length})`, bold: true, size: 26 })],
              spacing: { before: 200, after: 100 },
            }));
            for (const edge of edges) {
              const sourceNode = nodes.find(n => n.id === edge.sourceNodeId);
              const targetNode = nodes.find(n => n.id === edge.targetNodeId);
              const sourceName = sourceNode?.name || String(edge.sourceNodeId);
              const targetName = targetNode?.name || String(edge.targetNodeId);
              const edgeLabel = edge.label ? ` [${edge.label}]` : "";
              docChildren.push(new Paragraph({
                children: [
                  new TextRun({ text: "→  ", color: ORANGE, bold: true }),
                  new TextRun({ text: `${sourceName}  →  ${targetName}${edgeLabel}`, size: 20 }),
                ],
                spacing: { after: 40 },
              }));
            }
          }

          // BPMN-style Process Flow Narrative
          if (nodes.length && edges.length) {
            docChildren.push(new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Process Flow Narrative", bold: true, size: 26 })],
              spacing: { before: 300, after: 100 },
            }));
            docChildren.push(new Paragraph({
              children: [new TextRun({ text: `The following narrative describes the ${typeLower === "as-is" ? "current (As-Is)" : "target (To-Be)"} process flow from start to completion.`, italics: true, size: 20, color: "666666" })],
              spacing: { after: 150 },
            }));

            const nodeMap = new Map(nodes.map(n => [n.id, n]));
            const outgoingEdges = new Map<number, typeof edges>();
            for (const edge of edges) {
              if (!outgoingEdges.has(edge.sourceNodeId)) {
                outgoingEdges.set(edge.sourceNodeId, []);
              }
              outgoingEdges.get(edge.sourceNodeId)!.push(edge);
            }

            const startNode = nodes.find(n => (n.nodeType || "").toLowerCase() === "start");
            const visited = new Set<number>();
            const narrativeSteps: { node: typeof nodes[0]; outEdges: typeof edges; depth: number }[] = [];

            const walkProcess = (nodeId: number, depth: number): void => {
              if (visited.has(nodeId)) return;
              visited.add(nodeId);
              const node = nodeMap.get(nodeId);
              if (!node) return;
              const out = outgoingEdges.get(nodeId) || [];
              narrativeSteps.push({ node, outEdges: out, depth });
              for (const edge of out) {
                walkProcess(edge.targetNodeId, depth + (node.nodeType === "decision" ? 1 : 0));
              }
            }

            if (startNode) {
              walkProcess(startNode.id, 0);
            } else {
              const targetIds = new Set(edges.map(e => e.targetNodeId));
              const rootNodes = nodes.filter(n => !targetIds.has(n.id));
              for (const root of rootNodes) {
                walkProcess(root.id, 0);
              }
              for (const node of sortedNodes) {
                if (!visited.has(node.id)) {
                  walkProcess(node.id, 0);
                }
              }
            }

            let stepNumber = 0;
            for (const { node, outEdges } of narrativeSteps) {
              const nType = (node.nodeType || "task").toLowerCase();

              if (nType === "start") {
                docChildren.push(new Paragraph({
                  children: [
                    new TextRun({ text: "Process Initiation: ", bold: true, size: 20 }),
                    new TextRun({ text: `The process begins at "${node.name}".`, size: 20 }),
                    ...(node.description ? [new TextRun({ text: ` ${node.description}`, size: 20, color: "555555" })] : []),
                    ...(node.role ? [new TextRun({ text: ` (Initiated by: ${node.role})`, size: 20, italics: true, color: "666666" })] : []),
                  ],
                  spacing: { after: 80 },
                }));
              } else if (nType === "end") {
                docChildren.push(new Paragraph({
                  children: [
                    new TextRun({ text: "Process Completion: ", bold: true, size: 20 }),
                    new TextRun({ text: `The process concludes at "${node.name}".`, size: 20 }),
                    ...(node.description ? [new TextRun({ text: ` ${node.description}`, size: 20, color: "555555" })] : []),
                  ],
                  spacing: { after: 80 },
                }));
              } else if (nType === "decision") {
                stepNumber++;
                const branches = outEdges.map(e => {
                  const target = nodeMap.get(e.targetNodeId);
                  return `${e.label || "Branch"}: proceed to "${target?.name || "next step"}"`;
                });
                docChildren.push(new Paragraph({
                  children: [
                    new TextRun({ text: `Step ${stepNumber} — Decision Point: `, bold: true, size: 20 }),
                    new TextRun({ text: `"${node.name}"`, bold: true, size: 20, color: ORANGE }),
                    ...(node.role ? [new TextRun({ text: ` [${node.role}]`, size: 20, italics: true, color: "666666" })] : []),
                  ],
                  spacing: { before: 60, after: 40 },
                }));
                if (node.description) {
                  docChildren.push(new Paragraph({
                    children: [new TextRun({ text: node.description, size: 20, color: "555555" })],
                    spacing: { after: 40 },
                  }));
                }
                for (const branch of branches) {
                  docChildren.push(new Paragraph({
                    children: [
                      new TextRun({ text: "    " }),
                      new TextRun({ text: "◆  ", color: ORANGE }),
                      new TextRun({ text: branch, size: 20 }),
                    ],
                    spacing: { after: 30 },
                  }));
                }
              } else {
                stepNumber++;
                const systemInfo = node.system ? ` using ${node.system}` : "";
                const roleInfo = node.role ? ` performed by ${node.role}` : "";
                docChildren.push(new Paragraph({
                  children: [
                    new TextRun({ text: `Step ${stepNumber}: `, bold: true, size: 20 }),
                    new TextRun({ text: `"${node.name}"`, bold: true, size: 20 }),
                    new TextRun({ text: `${roleInfo}${systemInfo}.`, size: 20 }),
                    ...(node.isPainPoint ? [new TextRun({ text: " [Pain Point]", bold: true, size: 20, color: "DC2626" })] : []),
                  ],
                  spacing: { before: 40, after: 40 },
                }));
                if (node.description) {
                  docChildren.push(new Paragraph({
                    children: [new TextRun({ text: node.description, size: 20, color: "555555" })],
                    spacing: { after: 40 },
                  }));
                }
                if (outEdges.length === 1 && outEdges[0].label) {
                  const target = nodeMap.get(outEdges[0].targetNodeId);
                  docChildren.push(new Paragraph({
                    children: [
                      new TextRun({ text: "    " }),
                      new TextRun({ text: `Transition [${outEdges[0].label}]: proceed to "${target?.name || "next step"}".`, size: 20, italics: true, color: "666666" }),
                    ],
                    spacing: { after: 40 },
                  }));
                }
              }
            }
          }

          // Process Assumptions
          docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Process Assumptions", bold: true, size: 26 })],
            spacing: { before: 300, after: 100 },
          }));

          const painPoints = sortedNodes.filter(n => n.isPainPoint);
          const systemsUsed = Array.from(new Set(sortedNodes.map(n => n.system).filter(Boolean)));
          const rolesInvolved = Array.from(new Set(sortedNodes.map(n => n.role).filter(Boolean)));
          const decisionNodes = sortedNodes.filter(n => (n.nodeType || "").toLowerCase() === "decision");
          const nodeDescriptions = sortedNodes.filter(n => n.description && n.description.trim().length > 0);

          const assumptions: string[] = [];

          assumptions.push(`The process involves ${rolesInvolved.length || "one or more"} role${rolesInvolved.length !== 1 ? "s" : ""}: ${rolesInvolved.length ? rolesInvolved.join(", ") : "to be confirmed"}.`);

          if (systemsUsed.length > 0) {
            assumptions.push(`The process relies on the following system(s): ${systemsUsed.join(", ")}. It is assumed these systems are available and accessible.`);
          } else {
            assumptions.push("No specific systems have been identified. It is assumed the process is primarily manual or system dependencies are yet to be confirmed.");
          }

          if (decisionNodes.length > 0) {
            assumptions.push(`There ${decisionNodes.length === 1 ? "is" : "are"} ${decisionNodes.length} decision point${decisionNodes.length !== 1 ? "s" : ""} in the process. It is assumed that decision criteria are well-defined and consistently applied.`);
          }

          if (painPoints.length > 0) {
            assumptions.push(`${painPoints.length} step${painPoints.length !== 1 ? "s have" : " has"} been identified as pain point${painPoints.length !== 1 ? "s" : ""}: ${painPoints.map(p => `"${p.name}"`).join(", ")}. It is assumed these areas are candidates for improvement or automation.`);
          }

          assumptions.push("The process steps documented represent the standard flow; exception handling and edge cases may require additional detail.");
          assumptions.push("Stakeholders have validated that the process map accurately reflects current operations.");
          assumptions.push("Process volumes and frequency are assumed to be consistent with historical patterns unless otherwise stated.");

          for (const desc of nodeDescriptions) {
            if (desc.description.toLowerCase().includes("assum") || desc.description.toLowerCase().includes("note")) {
              assumptions.push(`From "${desc.name}": ${desc.description}`);
            }
          }

          for (const assumption of assumptions) {
            docChildren.push(new Paragraph({
              children: [new TextRun({ text: assumption, size: 20 })],
              bullet: { level: 0 },
              spacing: { after: 40 },
            }));
          }
          docChildren.push(new Paragraph({ spacing: { after: 200 } }));

          const mapApproval = await documentStorage.getApproval(ideaId, typeLower === "as-is" ? "as-is-map" : "to-be-map");
          docChildren.push(new Paragraph({ spacing: { before: 200 } }));
          if (mapApproval) {
            docChildren.push(new Paragraph({
              children: [
                new TextRun({ text: "✓ Approved", bold: true, color: "22C55E", size: 22 }),
                new TextRun({ text: `  by ${mapApproval.userName} (${mapApproval.userRole})`, size: 20, color: "888888" }),
                new TextRun({ text: mapApproval.approvedAt ? `  on ${new Date(mapApproval.approvedAt).toLocaleDateString()}` : "", size: 20, color: "888888" }),
              ],
              spacing: { after: 300 },
            }));
          } else {
            docChildren.push(new Paragraph({
              children: [new TextRun({ text: "○ Not yet approved", color: "888888", size: 20 })],
              spacing: { after: 300 },
            }));
          }

        } else {
          const docType = typeLower.toUpperCase();
          const label = docType === "PDD" ? "Process Design Document" : "Solution Design Document";

          docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: `${label} (${docType})`, bold: true, size: 32, color: ORANGE })],
            spacing: { before: 400, after: 200 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: ORANGE } },
          }));

          const allVersions = await documentStorage.getDocumentVersions(ideaId, docType);
          const latest = allVersions[0];

          if (!latest) {
            docChildren.push(new Paragraph({
              children: [new TextRun({ text: `No ${docType} has been generated yet.`, italics: true, color: "888888" })],
              spacing: { after: 200 },
            }));
            continue;
          }

          docChildren.push(new Paragraph({
            children: [
              new TextRun({ text: `Version ${latest.version}`, bold: true, size: 22 }),
              new TextRun({ text: `  |  Status: ${latest.status}`, size: 20, color: "888888" }),
              new TextRun({ text: `  |  Created: ${latest.createdAt ? new Date(latest.createdAt).toLocaleDateString() : "N/A"}`, size: 20, color: "888888" }),
            ],
            spacing: { after: 100 },
          }));

          const approval = await documentStorage.getApproval(ideaId, docType);
          if (approval) {
            docChildren.push(new Paragraph({
              children: [
                new TextRun({ text: "✓ Approved", bold: true, color: "22C55E", size: 22 }),
                new TextRun({ text: `  by ${approval.userName} (${approval.userRole})`, size: 20, color: "888888" }),
                new TextRun({ text: approval.approvedAt ? `  on ${new Date(approval.approvedAt).toLocaleDateString()}` : "", size: 20, color: "888888" }),
              ],
              spacing: { after: 200 },
            }));
          } else {
            docChildren.push(new Paragraph({
              children: [new TextRun({ text: "○ Not yet approved", color: "888888", size: 20 })],
              spacing: { after: 200 },
            }));
          }

          docChildren.push(new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: "Document Content", bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          }));

          const content = latest.content || "No content";
          const lines = content.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("## ")) {
              docChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [new TextRun({ text: trimmed.replace(/^##\s+/, ""), bold: true, size: 26 })],
                spacing: { before: 200, after: 100 },
              }));
            } else if (trimmed.startsWith("### ")) {
              docChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: [new TextRun({ text: trimmed.replace(/^###\s+/, ""), bold: true, size: 24 })],
                spacing: { before: 150, after: 80 },
              }));
            } else if (trimmed.startsWith("# ")) {
              docChildren.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                children: [new TextRun({ text: trimmed.replace(/^#\s+/, ""), bold: true, size: 30 })],
                spacing: { before: 250, after: 120 },
              }));
            } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
              const bulletText = trimmed.replace(/^[-*]\s+/, "");
              const runs: TextRun[] = [];
              const boldParts = bulletText.split(/(\*\*[^*]+\*\*)/);
              for (const part of boldParts) {
                if (part.startsWith("**") && part.endsWith("**")) {
                  runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 20 }));
                } else {
                  runs.push(new TextRun({ text: part, size: 20 }));
                }
              }
              docChildren.push(new Paragraph({
                children: runs,
                bullet: { level: 0 },
                spacing: { after: 40 },
              }));
            } else if (trimmed.startsWith("```")) {
              continue;
            } else if (trimmed === "") {
              docChildren.push(new Paragraph({ spacing: { after: 80 } }));
            } else {
              const runs: TextRun[] = [];
              const boldParts = trimmed.split(/(\*\*[^*]+\*\*)/);
              for (const part of boldParts) {
                if (part.startsWith("**") && part.endsWith("**")) {
                  runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 20 }));
                } else {
                  runs.push(new TextRun({ text: part, size: 20 }));
                }
              }
              docChildren.push(new Paragraph({
                children: runs,
                spacing: { after: 60 },
              }));
            }
          }

          if (allVersions.length > 1) {
            docChildren.push(new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [new TextRun({ text: "Version History", bold: true, size: 26 })],
              spacing: { before: 300, after: 100 },
            }));
            const versionRows: TableRow[] = [
              new TableRow({
                tableHeader: true,
                children: ["Version", "Status", "Created"].map(h =>
                  new TableCell({
                    shading: { type: ShadingType.SOLID, fill: ORANGE, color: "FFFFFF" },
                    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 20 })] })],
                  })
                ),
              }),
            ];
            for (const v of allVersions) {
              versionRows.push(new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `v${v.version}`, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.status, size: 20 })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "N/A", size: 20 })] })] }),
                ],
              }));
            }
            docChildren.push(new Table({ rows: versionRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
          }
        }
      }

      const doc = new Document({
        styles: {
          default: {
            document: {
              run: { font: "Calibri", size: 22 },
            },
          },
        },
        sections: [{
          properties: {},
          children: docChildren,
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const filename = `${ideaTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_export_${new Date().toISOString().slice(0, 10)}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(Buffer.from(buffer));
    } catch (err: any) {
      console.error("[Document Export] Error:", err.message);
      return res.status(500).json({ message: "Export failed" });
    }
  });
}

function generateXamlStub(workflow: any, sddContent?: string): string {
  const result = generateRichXamlFromSpec(workflow, sddContent);
  return result.xaml;
}

function extractSddSection(sddContent: string, heading: string): string {
  const lines = sddContent.split("\n");
  let capture = false;
  let result: string[] = [];
  for (const line of lines) {
    if (line.toLowerCase().includes(heading.toLowerCase()) && (line.startsWith("#") || line.startsWith("**"))) {
      capture = true;
      continue;
    }
    if (capture && (line.startsWith("# ") || line.startsWith("## "))) break;
    if (capture) result.push(line);
  }
  return result.join("\n").trim();
}

function extractAgentPrompt(sddContent: string, type: "system" | "user", pkg: any): string {
  const projectName = pkg.projectName || "Automation";
  const description = pkg.description || "";

  if (type === "system") {
    let prompt = `You are an AI agent for the "${projectName}" automation process.\n\n`;
    prompt += `## Purpose\n${description}\n\n`;

    const agentSection = extractSddSection(sddContent, "agent") || extractSddSection(sddContent, "AI");
    if (agentSection) {
      prompt += `## Context from Solution Design\n${agentSection.slice(0, 2000)}\n\n`;
    }

    prompt += `## Behavioral Guidelines\n`;
    prompt += `- Follow the process steps defined in the automation workflow\n`;
    prompt += `- Escalate to a human operator when confidence is below threshold\n`;
    prompt += `- Log all decisions and actions for audit trail\n`;
    prompt += `- Do not perform actions outside the defined scope\n\n`;

    const guardrails = pkg.agents?.[0]?.guardrails || [];
    if (guardrails.length > 0) {
      prompt += `## Guardrails\n`;
      for (const g of guardrails) prompt += `- ${g}\n`;
      prompt += `\n`;
    }

    return prompt;
  }

  let template = `## Task\nProcess the following input according to the "${projectName}" workflow.\n\n`;
  template += `## Input\n{{input_data}}\n\n`;
  template += `## Expected Output Format\n`;
  template += `Provide your response as structured JSON with the following fields:\n`;
  template += `- decision: The action decision (approve/reject/escalate)\n`;
  template += `- confidence: Confidence score (0.0 to 1.0)\n`;
  template += `- reasoning: Brief explanation of the decision\n`;
  template += `- next_steps: Array of recommended next actions\n\n`;
  template += `## Additional Context\n{{additional_context}}\n`;
  return template;
}

function extractToolDefinitions(sddContent: string, pkg: any): any[] {
  const tools: any[] = [];

  const agentTools = pkg.agents?.[0]?.tools || [];
  for (const tool of agentTools) {
    if (typeof tool === "string") {
      tools.push({
        name: tool,
        description: `UiPath activity: ${tool}`,
        input_schema: { type: "object", properties: {}, required: [] },
        output_schema: { type: "object", properties: {} },
        action: "AUTHORIZE",
      });
    } else if (typeof tool === "object") {
      tools.push({
        name: tool.name || "unknown_tool",
        description: tool.description || "",
        input_schema: tool.inputSchema || { type: "object", properties: {} },
        output_schema: tool.outputSchema || { type: "object", properties: {} },
        action: "AUTHORIZE",
      });
    }
  }

  if (tools.length === 0) {
    tools.push(
      { name: "read_document", description: "Read and extract content from a document", input_schema: { type: "object", properties: { document_path: { type: "string" } }, required: ["document_path"] }, output_schema: { type: "object", properties: { content: { type: "string" } } }, action: "CONFIGURE" },
      { name: "query_database", description: "Execute a read-only query against the business database", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }, output_schema: { type: "object", properties: { results: { type: "array" } } }, action: "AUTHORIZE" },
      { name: "send_notification", description: "Send a notification or escalation message", input_schema: { type: "object", properties: { recipient: { type: "string" }, message: { type: "string" } }, required: ["recipient", "message"] }, output_schema: { type: "object", properties: { sent: { type: "boolean" } } }, action: "CONFIGURE" },
    );
  }

  return tools;
}

function generateKBPlaceholder(sddContent: string, pkg: any): string {
  const projectName = pkg.projectName || "Automation";
  let md = `# Knowledge Base — ${projectName}\n\n`;
  md += `This folder should contain the documents the agent needs for retrieval-augmented generation (RAG).\n\n`;
  md += `## Recommended Documents\n\n`;

  const kbs = pkg.knowledgeBases || pkg.agents?.[0]?.knowledgeBases || [];
  if (kbs.length > 0) {
    for (const kb of kbs) {
      const name = typeof kb === "string" ? kb : kb.name || kb;
      md += `- ${name}\n`;
    }
  } else {
    md += `- Standard Operating Procedures (SOPs) for ${projectName}\n`;
    md += `- Business rules and exception handling documentation\n`;
    md += `- Reference data tables and lookup values\n`;
    md += `- Previous process execution logs and examples\n`;
  }

  md += `\n## Setup Steps\n\n`;
  md += `1. Upload documents to the UiPath AI Center knowledge base\n`;
  md += `2. Configure indexing and chunking strategy\n`;
  md += `3. Test retrieval with representative queries\n`;
  md += `4. Verify agent can cite relevant document sections\n`;
  return md;
}

function generateAgentConfig(agentName: string, sddContent: string, pkg: any): any {
  const agent = pkg.agents?.[0] || {};
  return {
    name: agentName,
    description: agent.description || pkg.description || "",
    systemPromptFile: "prompts/system_prompt.txt",
    userPromptTemplateFile: "prompts/user_prompt_template.txt",
    toolDefinitionsFile: "tools/tool_definitions.json",
    knowledgeBaseFolder: "knowledge/",
    configuration: {
      temperature: { value: agent.temperature ?? 0.3, action: "TUNE" },
      maxIterations: { value: agent.maxIterations || 10, action: "TUNE" },
      model: { value: "gpt-4o", action: "CONFIGURE" },
      escalationThreshold: { value: 0.7, action: "TUNE" },
    },
    guardrails: (agent.guardrails || []).map((g: string) => ({ rule: g, action: "REVIEW" })),
    escalationRules: (agent.escalationRules || []).map((r: any) => ({
      condition: typeof r === "string" ? r : r.condition,
      target: typeof r === "string" ? "human_operator" : r.target,
      action: "REVIEW",
    })),
    tools: (agent.tools || []).map((t: any) => ({
      name: typeof t === "string" ? t : t.name,
      action: "AUTHORIZE",
    })),
    provisionedBy: "CannonBall",
    importInstructions: "Import this configuration into UiPath Agent Builder. See DeveloperHandoffGuide.md Section 2a for step-by-step instructions.",
  };
}
