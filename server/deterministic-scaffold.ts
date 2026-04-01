import type { WorkflowSpec as TreeWorkflowSpec, WorkflowNode as TreeWorkflowNode } from "./workflow-spec-types";
import type { ProcessType } from "./catalog/catalog-service";
import type { TreeEnrichmentResult } from "./ai-xaml-enricher";
import { escapeXml } from "./lib/xml-utils";

export interface ProcessNodeInput {
  id?: number;
  name?: string;
  description?: string;
  system?: string;
  nodeType?: string;
}

export type DeterministicWorkflowRole =
  | "intake_dispatcher"
  | "entity_resolution"
  | "document_extraction"
  | "validation_matching"
  | "communication_drafting"
  | "review_exception"
  | "outbound_communication"
  | "approval_routing"
  | "persistence_audit"
  | "generic_step_group";

export interface DeterministicWorkflowContext {
  projectName: string;
  domainLabel: string;
  primaryEntityLabel: string;
  queueName: string;
}

const ROLE_PRIORITY: DeterministicWorkflowRole[] = [
  "intake_dispatcher",
  "entity_resolution",
  "document_extraction",
  "validation_matching",
  "communication_drafting",
  "review_exception",
  "outbound_communication",
  "approval_routing",
  "persistence_audit",
  "generic_step_group",
];

const ROLE_DISPLAY_LABELS: Record<DeterministicWorkflowRole, string> = {
  intake_dispatcher: "Intake and Dispatch",
  entity_resolution: "Entity Resolution",
  document_extraction: "Document Extraction",
  validation_matching: "Validation and Matching",
  communication_drafting: "Communication Drafting",
  review_exception: "Review and Exception Handling",
  outbound_communication: "Outbound Communication",
  approval_routing: "Approval Routing",
  persistence_audit: "Persistence and Audit",
  generic_step_group: "Process Steps",
};

const ROLE_STATUS_LITERALS: Record<DeterministicWorkflowRole, string> = {
  intake_dispatcher: "Dispatched",
  entity_resolution: "Resolved",
  document_extraction: "Extracted",
  validation_matching: "Validated",
  communication_drafting: "Drafted",
  review_exception: "Reviewed",
  outbound_communication: "Sent",
  approval_routing: "Approved",
  persistence_audit: "Persisted",
  generic_step_group: "Completed",
};

interface RolePattern {
  role: DeterministicWorkflowRole;
  keywords: RegExp;
}

const ROLE_PATTERNS: RolePattern[] = [
  { role: "intake_dispatcher", keywords: /\b(intake|dispatch|receive|inbound|ingest|fetch queue|get transaction|load input|trigger|start process|initiat|queue item|get item|collect)\b/i },
  { role: "entity_resolution", keywords: /\b(entity|resolution|resolve|lookup|match entity|identify|deduplicate|master data|customer match|vendor match|reconcile identity|find record|search record)\b/i },
  { role: "document_extraction", keywords: /\b(document|extract|ocr|scan|parse document|read document|digitize|classify document|data capture|form extract|invoice extract|pdf|image recogni)\b/i },
  { role: "validation_matching", keywords: /\b(validat|match|verify|check|reconcil|compare|cross.?check|rule check|compliance check|data quality|sanity check|confirm accuracy|audit check)\b/i },
  { role: "communication_drafting", keywords: /\b(draft|compose|template|generate (letter|email|message|notification)|prepare (email|letter|message|notification)|create (email|letter|message)|write (email|letter|message))\b/i },
  { role: "review_exception", keywords: /\b(review|exception|escalat|manual review|human review|flag|error handl|exception handl|retry|remediat|investigate|triage)\b/i },
  { role: "outbound_communication", keywords: /\b(send|email|notify|outbound|dispatch (email|message|notification)|post message|publish|broadcast|alert|sms|transmit)\b/i },
  { role: "approval_routing", keywords: /\b(approv|reject|route for|sign.?off|authorize|decision gate|workflow approval|manager approval|submit for|pending approval|action center)\b/i },
  { role: "persistence_audit", keywords: /\b(save|persist|store|record|log|audit|archive|write back|update (database|record|system|status)|insert|commit|finalize|close out)\b/i },
];

export function classifyDeterministicWorkflowRole(node: ProcessNodeInput): DeterministicWorkflowRole {
  const combined = `${node.name || ""} ${node.description || ""} ${node.system || ""}`;
  for (const pattern of ROLE_PATTERNS) {
    if (pattern.keywords.test(combined)) {
      return pattern.role;
    }
  }
  return "generic_step_group";
}

export function inferDomainLabel(projectName: string, processNodes: ProcessNodeInput[], sddContent?: string): string {
  const combined = `${projectName} ${(processNodes || []).map(n => `${n.name || ""} ${n.description || ""}`).join(" ")} ${sddContent || ""}`.toLowerCase();

  const domainPatterns: Array<[string, RegExp]> = [
    ["Finance", /\b(invoice|payment|account[s]? (payable|receivable)|billing|ledger|journal entr|financial|treasury|remittance|expense|reimbursement)\b/i],
    ["Human Resources", /\b(employee|onboard|offboard|payroll|recruit|hiring|hr |human resource|leave|benefits|talent|workforce)\b/i],
    ["Insurance", /\b(claim|policy|underwriting|premium|coverage|insured|adjuster|endorsement|renewal)\b/i],
    ["Healthcare", /\b(patient|medical|clinical|healthcare|hospital|diagnos|prescription|ehr|pharmacy|lab result)\b/i],
    ["Supply Chain", /\b(purchase order|inventory|warehouse|shipping|logistics|procurement|supplier|vendor|supply chain|fulfillment)\b/i],
    ["Customer Service", /\b(customer|ticket|case management|service request|complaint|inquiry|support|helpdesk|contact center)\b/i],
    ["Banking", /\b(loan|mortgage|credit|deposit|withdrawal|account open|kyc|aml|bank|transaction process)\b/i],
    ["Legal", /\b(contract|legal|compliance|regulatory|agreement|litigation|disclosure|consent)\b/i],
    ["IT Operations", /\b(incident|change request|service desk|monitoring|patch|deploy|infrastructure|server|network|it service)\b/i],
    ["Sales", /\b(order|quote|opportunity|lead|crm|sales|pipeline|proposal|contract sign)\b/i],
  ];

  for (const [label, pattern] of domainPatterns) {
    if (pattern.test(combined)) {
      return label;
    }
  }
  return "General";
}

export function inferPrimaryEntityLabel(projectName: string, processNodes: ProcessNodeInput[], sddContent?: string): string {
  const combined = `${projectName} ${(processNodes || []).map(n => `${n.name || ""} ${n.description || ""}`).join(" ")} ${sddContent || ""}`.toLowerCase();

  const entityPatterns: Array<[string, RegExp]> = [
    ["Invoice", /\b(invoice)\b/i],
    ["Claim", /\b(claim)\b/i],
    ["Order", /\b(order|purchase order)\b/i],
    ["Employee", /\b(employee|staff|associate)\b/i],
    ["Customer", /\b(customer|client)\b/i],
    ["Patient", /\b(patient)\b/i],
    ["Ticket", /\b(ticket|case|incident)\b/i],
    ["Policy", /\b(policy|insurance policy)\b/i],
    ["Contract", /\b(contract|agreement)\b/i],
    ["Transaction", /\b(transaction)\b/i],
    ["Application", /\b(application|request|submission)\b/i],
    ["Record", /\b(record|entry|item)\b/i],
  ];

  for (const [label, pattern] of entityPatterns) {
    if (pattern.test(combined)) {
      return label;
    }
  }
  return "WorkItem";
}

function inferQueueName(projectName: string, processNodes: ProcessNodeInput[], sddContent?: string): string {
  if (sddContent) {
    const queueMatch = sddContent.match(/queue[:\s]+["']?([A-Za-z_]\w*)["']?/i);
    if (queueMatch) return queueMatch[1];
  }
  const combined = `${(processNodes || []).map(n => `${n.name || ""} ${n.description || ""}`).join(" ")} ${sddContent || ""}`;
  const match = combined.match(/queue\s*(?:name)?[:\s]+["']?([A-Za-z_]\w+)/i);
  if (match) return match[1];
  return `Q_${projectName.replace(/[^A-Za-z0-9]/g, "_")}`;
}

export interface SystemActivityResult {
  template: string;
  displayName: string;
  properties: Record<string, string>;
}

export function selectSystemActivity(system: string, description: string): SystemActivityResult | null {
  const sysLower = (system || "").toLowerCase();
  const descLower = (description || "").toLowerCase();
  const combined = `${sysLower} ${descLower}`;

  if (sysLower.includes("orchestrator") || sysLower.includes("queue") || combined.includes("queue item") || combined.includes("transaction item")) {
    if (combined.includes("add") || combined.includes("create") || combined.includes("push")) {
      return { template: "AddQueueItem", displayName: `Add Queue Item - ${system || "Orchestrator"}`, properties: { QueueName: '"TODO_QueueName"', ItemInformation: '""' } };
    }
    return { template: "GetTransactionItem", displayName: `Get Transaction Item - ${system || "Orchestrator"}`, properties: { QueueName: '"TODO_QueueName"' } };
  }

  if (sysLower.includes("action center") || combined.includes("human task") || combined.includes("approval task")) {
    return { template: "CreateFormTask", displayName: `Create Task - ${system || "Action Center"}`, properties: { TaskCatalog: '"TODO_TaskCatalog"', TaskTitle: '"TODO_TaskTitle"', TaskPriority: "Normal" } };
  }

  if (sysLower.includes("data service") || sysLower.includes("data fabric") || combined.includes("data entity")) {
    return { template: "QueryEntity", displayName: `Query Entity - ${system || "Data Service"}`, properties: { EntityType: '"TODO_EntityType"', Filter: '"TODO_Filter"' } };
  }

  if (sysLower.includes("genai") || sysLower.includes("gen ai") || sysLower.includes("generative ai") || combined.includes("llm") || combined.includes("gpt") || combined.includes("prompt")) {
    return { template: "LogMessage", displayName: `GenAI Prompt - ${system || "GenAI"}`, properties: { Level: "Info", Message: '"TODO: Configure GenAI prompt activity — install UiPath.GenAI.Activities"' } };
  }

  if (sysLower.includes("google calendar") || combined.includes("calendar event")) {
    return { template: "LogMessage", displayName: `Calendar - ${system || "Google Calendar"}`, properties: { Level: "Info", Message: '"TODO: Configure Google Calendar activity — install UiPath.GSuite.Activities"' } };
  }

  if (sysLower.includes("google contacts") || combined.includes("contact lookup")) {
    return { template: "LogMessage", displayName: `Contacts - ${system || "Google Contacts"}`, properties: { Level: "Info", Message: '"TODO: Configure Google Contacts activity — install UiPath.GSuite.Activities"' } };
  }

  if (sysLower.includes("gmail") || (sysLower.includes("google") && combined.includes("email"))) {
    return { template: "LogMessage", displayName: `Gmail - ${system || "Gmail"}`, properties: { Level: "Info", Message: '"TODO: Configure Gmail activity — install UiPath.GSuite.Activities"' } };
  }

  if (sysLower.includes("api") || sysLower.includes("rest") || sysLower.includes("http") || sysLower.includes("web service") || combined.includes("api call") || combined.includes("http request")) {
    return { template: "HttpClient", displayName: `HTTP Request - ${system || "API"}`, properties: { Method: "GET", Endpoint: `"https://${(system || "api").replace(/\s+/g, "").toLowerCase()}.example.com/api"`, AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("excel") || sysLower.includes("spreadsheet")) {
    return { template: "ExcelApplicationScope", displayName: `Open Excel - ${system || "Excel"}`, properties: { WorkbookPath: '"C:\\\\Data\\\\Workbook.xlsx"' } };
  }

  if (sysLower.includes("email") || sysLower.includes("outlook") || sysLower.includes("mail") || sysLower.includes("smtp")) {
    return { template: "SendOutlookMailMessage", displayName: `Send Email - ${system || "Email"}`, properties: { To: '""', Subject: '""', Body: '""' } };
  }

  if (sysLower.includes("sap")) {
    return { template: "TypeInto", displayName: `Type Into SAP - ${system || "SAP"}`, properties: { Text: '""', Target: '{ "type": "selector", "value": "<wnd app=\'saplogon.exe\' />" }' } };
  }

  if (sysLower.includes("browser") || sysLower.includes("web") || sysLower.includes("chrome") || sysLower.includes("portal") || sysLower.includes("website")) {
    return { template: "OpenBrowser", displayName: `Open Browser - ${system || "Browser"}`, properties: { Url: `"https://${(system || "app").replace(/\s+/g, "").toLowerCase()}.example.com"`, BrowserType: "Chrome" } };
  }

  if (sysLower.includes("database") || sysLower.includes("sql") || sysLower.includes("db")) {
    return { template: "ExecuteQuery", displayName: `Query Database - ${system || "Database"}`, properties: { Sql: '"SELECT * FROM table"', ConnectionString: '""' } };
  }

  if (sysLower.includes("coupa") || sysLower.includes("erp") || sysLower.includes("procurement") || combined.includes("coupa") || combined.includes("purchase order") || combined.includes("procurement")) {
    return { template: "HttpClient", displayName: `ERP/Procurement API - ${system || "Coupa"}`, properties: { Method: "GET", Endpoint: '"https://TODO.coupahost.com/api/v1/"', AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("document understanding") || combined.includes("document understanding") || combined.includes("intelligent ocr") || sysLower.includes("ocr") || combined.includes("digitize") || combined.includes("classify document") || combined.includes("extract data from document")) {
    return { template: "LogMessage", displayName: `Document Understanding - ${system || "DU"}`, properties: { Level: "Info", Message: '"TODO: Configure Document Understanding taxonomy and extractors — install UiPath.DocumentUnderstanding.ML.Activities"' } };
  }

  if (sysLower.includes("integration service") || combined.includes("integration service") || combined.includes("connector")) {
    return { template: "LogMessage", displayName: `Integration Service - ${system || "Integration Service"}`, properties: { Level: "Info", Message: '"TODO: Configure Integration Service connector — select connector from Orchestrator"' } };
  }

  if (sysLower.includes("servicenow") || sysLower.includes("service now") || sysLower.includes("snow") || combined.includes("servicenow") || combined.includes("incident ticket") || combined.includes("snow record")) {
    return { template: "HttpClient", displayName: `ServiceNow API - ${system || "ServiceNow"}`, properties: { Method: "GET", Endpoint: '"https://TODO.service-now.com/api/now/table/"', AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("workday") || combined.includes("workday") || combined.includes("hcm system")) {
    return { template: "HttpClient", displayName: `Workday API - ${system || "Workday"}`, properties: { Method: "GET", Endpoint: '"https://TODO.workday.com/api/v1/"', AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("salesforce") || sysLower.includes("sfdc") || combined.includes("salesforce") || combined.includes("sfdc")) {
    return { template: "HttpClient", displayName: `Salesforce API - ${system || "Salesforce"}`, properties: { Method: "GET", Endpoint: '"https://TODO.salesforce.com/services/data/v58.0/"', AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("sharepoint")) {
    return { template: "HttpClient", displayName: `SharePoint API - ${system || "SharePoint"}`, properties: { Method: "GET", Endpoint: '"https://TODO.sharepoint.com/_api/web/"', AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("jira") || sysLower.includes("atlassian")) {
    return { template: "HttpClient", displayName: `Jira API - ${system || "Jira"}`, properties: { Method: "GET", Endpoint: '"https://TODO.atlassian.net/rest/api/3/"', AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("dynamics") || sysLower.includes("d365")) {
    return { template: "HttpClient", displayName: `Dynamics 365 API - ${system || "Dynamics 365"}`, properties: { Method: "GET", Endpoint: '"https://TODO.crm.dynamics.com/api/data/v9.2/"', AcceptFormat: "JSON" } };
  }

  if (sysLower.includes("pdf") || combined.includes("pdf") || combined.includes("read pdf") || combined.includes("extract pdf") || combined.includes("generate pdf")) {
    return { template: "ReadPdfText", displayName: `Read PDF - ${system || "PDF"}`, properties: { FileName: '"C:\\\\Data\\\\Document.pdf"', Range: '"All"' } };
  }

  if (sysLower.includes("desktop") || sysLower.includes("citrix") || sysLower.includes("mainframe") || sysLower.includes("terminal") || combined.includes("desktop app") || combined.includes("citrix") || combined.includes("remote app") || combined.includes("mainframe")) {
    return { template: "UseApplication", displayName: `Desktop App - ${system || "Desktop"}`, properties: { ApplicationPath: '""', Selector: '"<wnd app=\'app.exe\' />"' } };
  }

  if (descLower.includes("click") || descLower.includes("type") || descLower.includes("enter") || descLower.includes("input") || descLower.includes("fill")) {
    return { template: "TypeInto", displayName: `Type Into - ${system || "Application"}`, properties: { Text: '""' } };
  }

  if (descLower.includes("download") || descLower.includes("save file") || descLower.includes("export")) {
    return { template: "MoveFile", displayName: `Save File - ${system || "FileSystem"}`, properties: { Path: '""', Destination: '""' } };
  }

  return null;
}

function roleToFileName(role: DeterministicWorkflowRole, index: number): string {
  const base = ROLE_DISPLAY_LABELS[role].replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
  return `${String(index + 1).padStart(2, "0")}_${base}`;
}

export function buildGenericDeterministicSubWorkflowSpec(
  role: DeterministicWorkflowRole,
  nodes: ProcessNodeInput[],
  domainCtx: DeterministicWorkflowContext,
  index: number,
): TreeWorkflowSpec {
  const fileName = roleToFileName(role, index);
  const displayLabel = ROLE_DISPLAY_LABELS[role];
  const statusLiteral = ROLE_STATUS_LITERALS[role];

  const roleSpecificArgs: Array<{ name: string; direction: "InArgument" | "OutArgument" | "InOutArgument"; type: string }> = [];
  if (role === "intake_dispatcher") {
    roleSpecificArgs.push({ name: "in_QueueName", direction: "InArgument", type: "String" });
    roleSpecificArgs.push({ name: "out_ItemCount", direction: "OutArgument", type: "Int32" });
  } else if (role === "entity_resolution") {
    roleSpecificArgs.push({ name: "in_EntityType", direction: "InArgument", type: "String" });
    roleSpecificArgs.push({ name: "out_ResolvedEntityId", direction: "OutArgument", type: "String" });
  } else if (role === "document_extraction") {
    roleSpecificArgs.push({ name: "in_DocumentPath", direction: "InArgument", type: "String" });
    roleSpecificArgs.push({ name: "out_ExtractedData", direction: "OutArgument", type: "String" });
  } else if (role === "validation_matching") {
    roleSpecificArgs.push({ name: "in_ValidationRules", direction: "InArgument", type: "String" });
    roleSpecificArgs.push({ name: "out_IsValid", direction: "OutArgument", type: "Boolean" });
  } else if (role === "approval_routing") {
    roleSpecificArgs.push({ name: "in_ApproverGroup", direction: "InArgument", type: "String" });
    roleSpecificArgs.push({ name: "out_ApprovalDecision", direction: "OutArgument", type: "String" });
  }

  const standardArgs: Array<{ name: string; direction: "InArgument" | "OutArgument" | "InOutArgument"; type: string }> = [
    { name: "in_Config", direction: "InArgument", type: "Dictionary<String, Object>" },
    { name: "in_ContextJson", direction: "InArgument", type: "String" },
    { name: "out_ContextJson", direction: "OutArgument", type: "String" },
    { name: "out_WorkflowStatus", direction: "OutArgument", type: "String" },
    ...roleSpecificArgs,
  ];

  const variables: Array<{ name: string; type: string; default?: string }> = [
    { name: "str_StepStatus", type: "String", default: `"${statusLiteral}"` },
  ];

  const children: TreeWorkflowNode[] = [];

  children.push({
    kind: "activity" as const,
    template: "LogMessage",
    displayName: `Log ${displayLabel} Start`,
    properties: { Level: "Info", Message: `"Starting ${displayLabel} for ${domainCtx.primaryEntityLabel}"` },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  for (const node of nodes) {
    const sysActivity = selectSystemActivity(node.system || "", node.description || "");

    const nodeChildren: TreeWorkflowNode[] = [
      {
        kind: "activity" as const,
        template: "LogMessage",
        displayName: `Log: ${node.name || "Step"}`,
        properties: { Level: "Info", Message: `"Executing ${displayLabel} step: ${escapeXml(node.name || "Step")}"` },
        outputVar: null,
        outputType: null,
        errorHandling: "none" as const,
      },
    ];

    if (sysActivity) {
      nodeChildren.push({
        kind: "activity" as const,
        template: sysActivity.template,
        displayName: sysActivity.displayName,
        properties: sysActivity.properties,
        outputVar: null,
        outputType: null,
        errorHandling: "none" as const,
      });
    } else {
      nodeChildren.push({
        kind: "activity" as const,
        template: "Comment",
        displayName: `TODO: ${node.name || "Step"}`,
        properties: { Text: `TODO: Implement ${node.name || "step"}${node.description ? " - " + node.description : ""}${node.system ? " (System: " + node.system + ")" : ""}` },
        outputVar: null,
        outputType: null,
        errorHandling: "none" as const,
      });
    }

    children.push({
      kind: "tryCatch" as const,
      displayName: `TryCatch: ${node.name || "Step"}`,
      tryChildren: nodeChildren,
      catchChildren: [
        {
          kind: "activity" as const,
          template: "LogMessage",
          displayName: `Log Error: ${node.name || "Step"}`,
          properties: { Level: "Error", Message: `"Error in ${displayLabel} step '${escapeXml(node.name || "Step")}': " & exception.Message` },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
        {
          kind: "activity" as const,
          template: "Assign",
          displayName: "Set Status to Failed",
          properties: { To: "str_StepStatus", Value: '"Failed"' },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
      ],
      finallyChildren: [],
    });
  }

  children.push({
    kind: "activity" as const,
    template: "Assign",
    displayName: `Set ${displayLabel} Status`,
    properties: { To: "out_WorkflowStatus", Value: "str_StepStatus" },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  children.push({
    kind: "activity" as const,
    template: "LogMessage",
    displayName: `Log ${displayLabel} Complete`,
    properties: { Level: "Info", Message: `"${displayLabel} completed with status: " & str_StepStatus` },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  return {
    name: fileName,
    description: `${displayLabel} sub-workflow for ${domainCtx.projectName} (${domainCtx.domainLabel})`,
    variables,
    arguments: standardArgs,
    rootSequence: {
      kind: "sequence" as const,
      displayName: `${displayLabel} - Main Sequence`,
      children,
    },
    useReFramework: false,
    dhgNotes: [`Role: ${role}`, `Domain: ${domainCtx.domainLabel}`, `Entity: ${domainCtx.primaryEntityLabel}`],
    decomposition: [],
  };
}

export function buildGenericDeterministicMainWorkflowSpec(
  roleGroups: Map<DeterministicWorkflowRole, ProcessNodeInput[]>,
  domainCtx: DeterministicWorkflowContext,
): TreeWorkflowSpec {
  const variables: Array<{ name: string; type: string; default?: string }> = [
    { name: "dict_Config", type: "Dictionary<String, Object>" },
    { name: "str_ProcessContextJson", type: "String", default: '"{}"' },
    { name: "str_ProcessStatus", type: "String", default: '"Success"' },
    { name: "str_LastWorkflowStatus", type: "String", default: '""' },
    { name: "int_WorkItemCount", type: "Int32", default: "0" },
    { name: "bool_RequiresReview", type: "Boolean", default: "False" },
  ];

  const children: TreeWorkflowNode[] = [];
  const decomposition: Array<{ name: string; nodeIds: number[]; description?: string }> = [];

  children.push({
    kind: "activity" as const,
    template: "LogMessage",
    displayName: "Log Process Start",
    properties: { Level: "Info", Message: `"Starting ${domainCtx.projectName} — Domain: ${domainCtx.domainLabel}, Entity: ${domainCtx.primaryEntityLabel}"` },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  children.push({
    kind: "activity" as const,
    template: "InvokeWorkflowFile",
    displayName: "Initialize All Settings",
    properties: { WorkflowFileName: "InitAllSettings.xaml" },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  let subIndex = 0;
  for (const role of ROLE_PRIORITY) {
    const nodes = roleGroups.get(role);
    if (!nodes || nodes.length === 0) continue;

    const fileName = roleToFileName(role, subIndex);
    const displayLabel = ROLE_DISPLAY_LABELS[role];
    const statusLiteral = ROLE_STATUS_LITERALS[role];

    const nodeIds = nodes.map(n => n.id).filter((id): id is number => typeof id === "number");
    decomposition.push({
      name: fileName,
      nodeIds,
      description: `${displayLabel} — ${nodes.length} step(s) for ${domainCtx.primaryEntityLabel}`,
    });

    children.push({
      kind: "tryCatch" as const,
      displayName: `TryCatch: ${displayLabel}`,
      tryChildren: [
        {
          kind: "activity" as const,
          template: "InvokeWorkflowFile",
          displayName: `Run ${displayLabel}`,
          properties: { WorkflowFileName: `${fileName}.xaml` },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
        {
          kind: "activity" as const,
          template: "Assign",
          displayName: `Mark ${displayLabel} Success`,
          properties: { To: "str_LastWorkflowStatus", Value: `"${statusLiteral}"` },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
        {
          kind: "activity" as const,
          template: "LogMessage",
          displayName: `Log ${displayLabel} Success`,
          properties: { Level: "Info", Message: `"${displayLabel} completed with status: ${statusLiteral}"` },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
      ],
      catchChildren: [
        {
          kind: "activity" as const,
          template: "LogMessage",
          displayName: `Log ${displayLabel} Failure`,
          properties: { Level: "Error", Message: `"${displayLabel} failed: " & exception.Message` },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
        {
          kind: "activity" as const,
          template: "Assign",
          displayName: `Mark ${displayLabel} Failed`,
          properties: { To: "str_LastWorkflowStatus", Value: '"Failed"' },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
        {
          kind: "activity" as const,
          template: "Assign",
          displayName: "Set Process Status Failed",
          properties: { To: "str_ProcessStatus", Value: '"Failed"' },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
        {
          kind: "activity" as const,
          template: "Assign",
          displayName: "Flag for Review",
          properties: { To: "bool_RequiresReview", Value: "True" },
          outputVar: null,
          outputType: null,
          errorHandling: "none" as const,
        },
      ],
      finallyChildren: [],
    });

    subIndex++;
  }

  children.push({
    kind: "activity" as const,
    template: "LogMessage",
    displayName: "Log Process Complete",
    properties: { Level: "Info", Message: `"${domainCtx.projectName} completed with status: " & str_ProcessStatus & " | Review required: " & bool_RequiresReview.ToString()` },
    outputVar: null,
    outputType: null,
    errorHandling: "none" as const,
  });

  const dhgNotes = [
    "This workflow was generated as a role-based deterministic scaffold because AI enrichment was unavailable",
    `Domain: ${domainCtx.domainLabel} | Entity: ${domainCtx.primaryEntityLabel} | Queue: ${domainCtx.queueName}`,
    `${decomposition.length} sub-workflow(s) generated by role classification`,
  ];

  return {
    name: "Main",
    description: `Role-based deterministic scaffold for ${domainCtx.projectName} (${domainCtx.domainLabel})`,
    variables,
    arguments: [],
    rootSequence: {
      kind: "sequence" as const,
      displayName: `${domainCtx.projectName} - Main Sequence`,
      children,
    },
    useReFramework: false,
    dhgNotes,
    decomposition,
  };
}

export function buildDeterministicScaffold(
  processNodes: ProcessNodeInput[],
  projectName: string,
  sddContent?: string,
  processEdges?: Array<{ sourceNodeId: number; targetNodeId: number; label?: string }>,
  extractVariablesFromSDD?: (sddContent: string) => Array<{ name: string; type: string; default?: string }>,
): { treeEnrichment: TreeEnrichmentResult; usedAIFallback: boolean; allTreeEnrichments?: Map<string, { spec: TreeWorkflowSpec; processType: ProcessType }> } {
  const actionNodes = processNodes.filter(n => n.nodeType !== "start" && n.nodeType !== "end");

  const domainLabel = inferDomainLabel(projectName, actionNodes, sddContent);
  const primaryEntityLabel = inferPrimaryEntityLabel(projectName, actionNodes, sddContent);
  const queueName = inferQueueName(projectName, actionNodes, sddContent);

  const domainCtx: DeterministicWorkflowContext = {
    projectName,
    domainLabel,
    primaryEntityLabel,
    queueName,
  };

  const roleGroups = new Map<DeterministicWorkflowRole, typeof actionNodes>();
  for (const node of actionNodes) {
    const role = classifyDeterministicWorkflowRole(node);
    if (!roleGroups.has(role)) roleGroups.set(role, []);
    roleGroups.get(role)!.push(node);
  }

  const allTreeEnrichments = new Map<string, { spec: TreeWorkflowSpec; processType: ProcessType }>();

  const mainSpec = buildGenericDeterministicMainWorkflowSpec(roleGroups, domainCtx);

  if (sddContent && extractVariablesFromSDD) {
    const sddVars = extractVariablesFromSDD(sddContent);
    for (const v of sddVars) {
      if (!mainSpec.variables.find(ev => ev.name === v.name)) {
        mainSpec.variables.push(v);
      }
    }
  }

  allTreeEnrichments.set("Main", { spec: mainSpec, processType: "general" as ProcessType });

  let subIndex = 0;
  for (const role of ROLE_PRIORITY) {
    const nodes = roleGroups.get(role);
    if (!nodes || nodes.length === 0) continue;

    const subSpec = buildGenericDeterministicSubWorkflowSpec(role, nodes, domainCtx, subIndex);
    allTreeEnrichments.set(subSpec.name, { spec: subSpec, processType: "general" as ProcessType });
    subIndex++;
  }

  const totalNodes = actionNodes.length;
  const roleBreakdown = Array.from(roleGroups.entries())
    .filter(([, nodes]) => nodes.length > 0)
    .map(([role, nodes]) => `${role}(${nodes.length})`)
    .join(", ");

  console.log(`[UiPath] Built role-based deterministic scaffold for "${projectName}": ${totalNodes} action nodes → ${allTreeEnrichments.size} workflow(s) [${roleBreakdown}], domain: ${domainLabel}, entity: ${primaryEntityLabel}`);

  return {
    treeEnrichment: { status: "success", workflowSpec: mainSpec, processType: "general" as ProcessType },
    usedAIFallback: true,
    allTreeEnrichments,
  };
}
