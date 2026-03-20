import { getLLM } from "../lib/llm";
import { sanitizeJsonString, stripCodeFences } from "../lib/json-utils";

  export type AgentToolDef = { name: string; description: string; activityType?: string; processReference?: string; inputArguments?: Record<string, string>; outputArguments?: string[] };
export type AgentEscalationRule = { condition: string; target: string; actionCenterCatalog?: string; priority?: string };
export type AgentContextGrounding = { storageBucket?: string; documentSources?: string[]; refreshStrategy?: string; embeddingModel?: string };
export type AgentDef = {
  name: string;
  agentType?: "autonomous" | "conversational" | "coded";
  description?: string;
  systemPrompt?: string;
  tools?: AgentToolDef[];
  contextGrounding?: AgentContextGrounding;
  knowledgeBases?: string[];
  guardrails?: string[];
  escalationRules?: AgentEscalationRule[];
  inputSchema?: Record<string, string>;
  outputSchema?: Record<string, string>;
  maxIterations?: number;
  temperature?: number;
};
export type KnowledgeBaseDef = { name: string; description?: string; documentSources?: string[]; refreshFrequency?: string };
export type PromptTemplateDef = { name: string; description?: string; template?: string; variables?: string[] };

export type OrchestratorArtifacts = {
  queues?: Array<{ name: string; description?: string; maxRetries?: number; uniqueReference?: boolean; jsonSchema?: string; outputSchema?: string }>;
  assets?: Array<{ name: string; type: string; value?: string; description?: string }>;
  machines?: Array<{ name: string; type?: string; slots?: number; description?: string; runtimeType?: string }>;
  triggers?: Array<{ name: string; type: string; queueName?: string; cron?: string; description?: string; timezone?: string; startStrategy?: string; maxJobsCount?: number }>;
  storageBuckets?: Array<{ name: string; description?: string; storageProvider?: string }>;
  environments?: Array<{ name: string; type?: string; description?: string }>;
  robotAccounts?: Array<{ name: string; type?: string; description?: string; role?: string }>;
  actionCenter?: Array<{ taskCatalog: string; assignedRole?: string; sla?: string; escalation?: string; description?: string; priority?: string; actions?: string[]; formFields?: Array<{ name: string; type: string; required?: boolean; defaultValue?: string; validationRule?: string }>; slaConfig?: { dueInHours?: number; warningThresholdHours?: number; escalationPolicy?: string; autoEscalate?: boolean }; dataFabricEntity?: string }>;
  documentUnderstanding?: Array<{ name: string; documentTypes: string[]; description?: string; extractionApproach?: string; taxonomyFields?: Array<{ documentType: string; fields: Array<{ name: string; type: string }> }>; classifierType?: string; validationRules?: Array<{ field: string; rule: string; action: string }> }>;
  communicationsMining?: Array<{ name: string; sourceType?: string; description?: string; intents?: string[]; entities?: string[]; routingRules?: Array<{ intent: string; action: string; target: string }> }>;
  testCases?: Array<{ name: string; description?: string; labels?: string[]; testType?: string; priority?: string; preconditions?: string[]; postconditions?: string[]; testData?: Array<{ field: string; value: string; dataType: string }>; automationWorkflow?: string; expectedDuration?: number; steps?: Array<{ action: string; expected: string }> }>;
  testDataQueues?: Array<{ name: string; description?: string; jsonSchema?: string; items?: Array<{ name: string; content: string }> }>;
  requirements?: Array<{ name: string; description?: string; source?: string; type?: string; priority?: string; acceptanceCriteria?: string[] }>;
  testSets?: Array<{ name: string; description?: string; testCaseNames?: string[]; executionMode?: string; environment?: string; triggerType?: string }>;
  agents?: AgentDef[];
  knowledgeBases?: KnowledgeBaseDef[];
  promptTemplates?: PromptTemplateDef[];
  dataFabricEntities?: Array<{ name: string; description?: string; fields: Array<{ name: string; type: string; required?: boolean; isKey?: boolean; description?: string }>; referencedBy?: string[] }>;
  apps?: Array<{ name: string; description?: string; appId?: string; linkedProcesses?: string[]; linkedEntities?: string[] }>;
  maestroProcesses?: MaestroProcessDef[];
};

export type MaestroBpmnTask = {
  id: string;
  name: string;
  type: "serviceTask" | "userTask" | "scriptTask" | "sendTask" | "receiveTask";
  processReference?: string;
  actionCenterCatalog?: string;
  formFields?: Array<{ name: string; type: string; required?: boolean }>;
  description?: string;
};

export type MaestroBpmnGateway = {
  id: string;
  name: string;
  type: "exclusive" | "parallel" | "inclusive" | "eventBased";
  conditions?: Array<{ targetRef: string; expression: string; label?: string }>;
};

export type MaestroBpmnEvent = {
  id: string;
  name: string;
  type: "startEvent" | "endEvent" | "intermediateThrowEvent" | "intermediateCatchEvent" | "boundaryEvent";
  trigger?: "timer" | "message" | "signal" | "error" | "none";
  timerDefinition?: string;
  description?: string;
};

export type MaestroBpmnSequenceFlow = {
  id: string;
  sourceRef: string;
  targetRef: string;
  conditionExpression?: string;
  label?: string;
};

export type MaestroProcessDef = {
  name: string;
  description?: string;
  tasks?: MaestroBpmnTask[];
  gateways?: MaestroBpmnGateway[];
  events?: MaestroBpmnEvent[];
  sequenceFlows?: MaestroBpmnSequenceFlow[];
  crossReferences?: Array<{ artifactType: string; artifactName: string; relationship: string }>;
};

export type { DeploymentResult, DeployReport } from "@shared/models/deployment";
import type { DeploymentResult } from "@shared/models/deployment";


export function parseArtifactsFromSDD(sddContent: string): OrchestratorArtifacts | null {
  const exactMatch = sddContent.match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
  if (exactMatch) {
    try {
      return JSON.parse(sanitizeJsonString(exactMatch[1].trim()));
    } catch (e) {
      console.warn("[parseArtifacts] orchestrator_artifacts fence found but JSON parse failed:", (e as Error).message);
    }
  }

  const jsonFenceMatch = sddContent.match(/```json\s*\n([\s\S]*?)\n```/g);
  if (jsonFenceMatch) {
    for (const fence of jsonFenceMatch) {
      const inner = fence.replace(/```json\s*\n/, "").replace(/\n```$/, "").trim();
      try {
        const parsed = JSON.parse(sanitizeJsonString(inner));
        if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers || parsed.agents || parsed.communicationsMining || parsed.dataFabricEntities || parsed.apps || parsed.maestroProcesses) {
          console.log("[parseArtifacts] Found artifacts in json fence block");
          return parsed;
        }
      } catch { /* not the right block */ }
    }
  }

  const rawMatch = sddContent.match(/\{\s*"(?:queues|assets|documentUnderstanding|communicationsMining)"\s*:\s*\[[\s\S]*?\}\s*\]\s*\}/);
  if (rawMatch) {
    try {
      const braceStart = rawMatch.index!;
      let depth = 0;
      let end = braceStart;
      for (let i = braceStart; i < sddContent.length; i++) {
        if (sddContent[i] === "{") depth++;
        if (sddContent[i] === "}") depth--;
        if (depth === 0) { end = i + 1; break; }
      }
      const jsonStr = sddContent.slice(braceStart, end);
      const parsed = JSON.parse(sanitizeJsonString(jsonStr));
      if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers || parsed.agents || parsed.communicationsMining || parsed.documentUnderstanding || parsed.dataFabricEntities || parsed.apps || parsed.maestroProcesses) {
        console.log("[parseArtifacts] Found artifacts in raw JSON");
        return parsed;
      }
    } catch { /* not valid JSON */ }
  }

  return null;
}

export async function extractArtifactsWithLLM(sddContent: string): Promise<OrchestratorArtifacts | null> {
  try {
    console.log("[UiPath Deploy] Extracting artifacts from SDD using LLM...");
    const response = await getLLM().create({
      maxTokens: 8192,
      system: `You are a senior UiPath RPA architect generating PRODUCTION-READY artifacts. Output ONLY valid JSON — no text, no markdown, no code fences.

CRITICAL RULES:
1. Every value must be as close to EXECUTABLE as possible. Use REAL values from the SDD — queue names, asset names, API endpoints, system URLs, file paths, cron schedules, field names, data types, email addresses, system names.
2. Only use PLACEHOLDER_ prefix when the information is genuinely not in the SDD (e.g. actual passwords, environment-specific hostnames like PLACEHOLDER_SAP_HOST).
3. Test cases must be AUTOMATION-GRADE: concrete preconditions, concrete postconditions, real test data values, specific step actions with field names and values, specific expected results with verifiable values.
4. Queue schemas must define the actual data fields the process uses — derive from the SDD data model.
5. Triggers must use the correct business timezone and realistic cron schedules.
6. All descriptions must be specific and actionable, not generic.`,
      messages: [{
        role: "user",
        content: `Extract ALL UiPath Orchestrator and platform artifacts from this Solution Design Document. Output a single JSON object. Include every artifact mentioned or implied.

ARTIFACT RULES:
- queues: Include jsonSchema (JSON Schema for SpecificContent fields from the SDD data model) and outputSchema where applicable. maxRetries and uniqueReference must reflect the SDD's error handling requirements.
- assets: For credential assets use value "". For text/integer/bool assets provide REAL values from the SDD. Descriptions must explain usage context (e.g. "SMTP server for invoice notification emails").
- machines: Include runtimeType (Unattended|NonProduction|TestAutomation|Headless|Serverless). For Serverless runtime, machine templates are not required — omit the machines array entirely. Description must state the machine's purpose.
- triggers: Include timezone (e.g. "America/New_York" from the SDD business context), startStrategy ("Specific"|"ModernJobs"), maxJobsCount. All triggers MUST be included — never treat them as manual steps.
- storageBuckets: Include storageProvider ("Orchestrator"|"Azure"|"AWS"|"GCP") derived from the SDD tech stack.
- robotAccounts: Include role (specific role name like "InvoiceProcessor" not generic "Executor"). At least one robot per machine.
- actionCenter: Include priority ("Critical"|"High"|"Normal"|"Low"), actions array (e.g. ["Approve","Reject","Escalate"]), formFields array with field definitions including defaultValue and validationRule where applicable. Include slaConfig with dueInHours, warningThresholdHours, escalationPolicy, and autoEscalate. If the task writes results to a Data Fabric entity, set dataFabricEntity to the entity name. CRITICAL: Any human approval/review/escalation step MUST generate an entry.
- documentUnderstanding: Include extractionApproach ("classic_du" for structured forms, "generative" for unstructured documents, "hybrid" for mixed). Include taxonomyFields (extraction fields per document type with name+type), classifierType ("Keyword"|"ML"|"Regex"), validationRules [{field, rule (e.g. "confidence >= 0.85"), action ("flag_for_review"|"reject"|"auto_accept")}].
- communicationsMining: Include sourceType ("email"|"chat"|"ticket"), intents (array of intent labels the model should detect), entities (array of entity names to extract), routingRules [{intent, action ("escalate"|"auto_reply"|"route"|"archive"), target (team/person/queue)}].
- testCases: AUTOMATION-GRADE quality required:
  - testType: "Functional"|"Regression"|"Smoke"|"Integration"|"E2E"
  - priority: "Critical"|"High"|"Medium"|"Low"
  - preconditions: specific setup requirements (e.g. "User logged into SAP client 100", "Queue has 5+ pending items")
  - postconditions: specific verifiable end states (e.g. "Invoice status set to 'Posted' in SAP", "Confirmation email sent to requester")
  - testData: concrete values [{field,value,dataType}] derived from SDD (e.g. {field:"InvoiceNumber",value:"INV-2024-001",dataType:"String"})
  - automationWorkflow: which .xaml file to execute (e.g. "Main.xaml")
  - expectedDuration: seconds
  - steps: Each step MUST have specific field names, input values, and concrete expected results — NOT generic descriptions. Example: action="Enter 'INV-2024-001' in Invoice Number field", expected="Invoice Number field displays 'INV-2024-001'"
- testDataQueues: Include jsonSchema and concrete test data items.
- requirements: Include type ("Functional"|"NonFunctional"|"Compliance"|"SLA"), priority, acceptanceCriteria (concrete testable criteria array).
- testSets: Include executionMode ("Sequential"|"Parallel"), environment (target environment name), triggerType ("Manual"|"Scheduled"|"CI/CD").
- agents: Include agentType ("autonomous"|"conversational"|"coded"), tools with processReference (exact Orchestrator process name), contextGrounding with storageBucket (exact bucket name from storageBuckets), escalationRules with actionCenterCatalog (exact catalog name from actionCenter). Cross-references are resolved to IDs during deployment.
- knowledgeBases: Include documentSources and refreshFrequency.
- promptTemplates: Include template text with {{variable}} placeholders and variables array.
- dataFabricEntities: Define structured data entities for process data persistence. Each entity needs a name, description, and fields array with field name, type (String|Int32|Int64|Boolean|DateTime|Decimal|Guid), required flag, isKey flag, and description. Include referencedBy array listing which artifacts reference this entity (e.g. ["InvoiceApproval_TaskCatalog", "Main.xaml"]). Use Data Fabric entities for any process data that needs to persist across workflow runs or be shared between processes.
- apps: Reference existing UiPath Apps that serve as user-facing interfaces for this automation. Include name, description, and linkedProcesses array (process names), linkedEntities array (Data Fabric entity names). Only include apps that are relevant to this specific automation.
- maestroProcesses: BPMN-compatible Maestro process definitions. Include when the SDD describes multi-step orchestrated processes combining automated and human tasks. Each process has:
  - tasks: Array of BPMN tasks [{id,name,type:"serviceTask"|"userTask"|"scriptTask"|"sendTask"|"receiveTask",processReference:"<Orchestrator process name>",actionCenterCatalog:"<task catalog name>",formFields:[{name,type,required}],description}]
  - gateways: Array of BPMN gateways [{id,name,type:"exclusive"|"parallel"|"inclusive"|"eventBased",conditions:[{targetRef,expression,label}]}]
  - events: Array of BPMN events [{id,name,type:"startEvent"|"endEvent"|"intermediateThrowEvent"|"intermediateCatchEvent"|"boundaryEvent",trigger:"timer"|"message"|"signal"|"error"|"none",timerDefinition,description}]
  - sequenceFlows: Array of BPMN sequence flows [{id,sourceRef,targetRef,conditionExpression,label}]
  - crossReferences: Array of references to other artifacts [{artifactType:"queue"|"asset"|"process"|"actionCenter",artifactName,relationship}]
  - Service tasks MUST reference Orchestrator process names. User tasks MUST reference Action Center catalogs. Gateway conditions MUST have real expressions.

Expected JSON shape:
{"queues":[{"name":"...","description":"...","maxRetries":3,"uniqueReference":true,"jsonSchema":"{\\"type\\":\\"object\\",\\"properties\\":{...}}","outputSchema":"..."}],"assets":[{"name":"...","type":"Text|Integer|Bool|Credential","value":"...","description":"Usage context"}],"machines":[{"name":"...","type":"Unattended|Attended|Development","slots":1,"runtimeType":"Unattended|NonProduction|TestAutomation|Headless|Serverless","description":"Purpose"}],"triggers":[{"name":"...","type":"Queue|Time","queueName":"...","cron":"0 0 8 ? * MON-FRI","timezone":"America/New_York","startStrategy":"Specific","maxJobsCount":1,"description":"..."}],"storageBuckets":[{"name":"...","storageProvider":"Orchestrator","description":"..."}],"environments":[{"name":"...","type":"Production|Development|Testing","description":"..."}],"robotAccounts":[{"name":"...","type":"Unattended","role":"SpecificRole","description":"..."}],"actionCenter":[{"taskCatalog":"...","assignedRole":"...","sla":"4h","escalation":"Manager","priority":"High","actions":["Approve","Reject"],"formFields":[{"name":"...","type":"String|Number|Boolean","required":true,"defaultValue":"...","validationRule":"..."}],"slaConfig":{"dueInHours":4,"warningThresholdHours":3,"escalationPolicy":"Manager","autoEscalate":true},"dataFabricEntity":"EntityName","description":"..."}],"dataFabricEntities":[{"name":"...","description":"...","fields":[{"name":"Id","type":"Guid","required":true,"isKey":true,"description":"Primary key"},{"name":"FieldName","type":"String","required":true,"description":"..."}],"referencedBy":["TaskCatalog_Name","Main.xaml"]}],"apps":[{"name":"...","description":"...","linkedProcesses":["ProcessName"],"linkedEntities":["EntityName"]}],"documentUnderstanding":[{"name":"...","documentTypes":["Invoice"],"extractionApproach":"classic_du","taxonomyFields":[{"documentType":"Invoice","fields":[{"name":"InvoiceNumber","type":"String"}]}],"classifierType":"ML","validationRules":[{"field":"TotalAmount","rule":"confidence >= 0.85","action":"flag_for_review"}],"description":"..."}],"communicationsMining":[{"name":"...","sourceType":"email","intents":["Request","Complaint"],"entities":["CustomerName","OrderNumber"],"routingRules":[{"intent":"Complaint","action":"escalate","target":"SeniorAgent"}],"description":"..."}],"testCases":[{"name":"TC_001_TestName","testType":"Functional","priority":"Critical","description":"...","preconditions":["Precondition 1"],"postconditions":["Postcondition 1"],"testData":[{"field":"FieldName","value":"TestValue","dataType":"String"}],"automationWorkflow":"Main.xaml","expectedDuration":60,"labels":["Critical","Smoke"],"steps":[{"action":"Specific action with field names and values","expected":"Specific expected result with values"}]}],"testDataQueues":[{"name":"...","description":"...","jsonSchema":"...","items":[{"name":"Record_1","content":"..."}]}],"requirements":[{"name":"REQ-001: Name","type":"Functional","priority":"Critical","description":"...","source":"SDD Section X","acceptanceCriteria":["Criteria 1"]}],"testSets":[{"name":"Happy Path Tests","description":"...","executionMode":"Sequential","environment":"Production","triggerType":"Manual","testCaseNames":["TC_001_TestName"]}]}

SDD content:
${sddContent.slice(0, 12000)}`
      }],
    });

    const text = response.text.trim();

    let jsonStr = stripCodeFences(text);
    if (jsonStr !== text) {
      console.warn("[UiPath Deploy] LLM returned fenced JSON despite instructions — stripped fences");
    }

    let raw: any;
    const sanitized = sanitizeJsonString(jsonStr);
    try {
      raw = JSON.parse(sanitized);
    } catch (parseErr: any) {
      const posMatch = parseErr.message?.match(/position (\d+)/);
      const isUnexpectedEnd = /unexpected end/i.test(parseErr.message || "");
      const truncPos = posMatch ? parseInt(posMatch[1], 10) : (isUnexpectedEnd ? sanitized.length : -1);
      if (truncPos >= 0) {
        console.warn(`[UiPath Deploy] JSON parse failed at position ${truncPos}/${sanitized.length}, attempting stack-based recovery...`);
        let truncated = sanitized.slice(0, truncPos);
        truncated = truncated.replace(/,\s*$/, "");
        if (/:\s*$/.test(truncated)) truncated += '""';
        const stack: string[] = [];
        let inStr = false;
        for (let i = 0; i < truncated.length; i++) {
          if (truncated[i] === '"' && (i === 0 || truncated[i-1] !== '\\')) { inStr = !inStr; continue; }
          if (inStr) continue;
          if (truncated[i] === '{') stack.push('}');
          else if (truncated[i] === '[') stack.push(']');
          else if (truncated[i] === '}' || truncated[i] === ']') stack.pop();
        }
        if (inStr) truncated += '"';
        const closer = stack.reverse().join("");
        try {
          raw = JSON.parse(truncated + closer);
          console.log(`[UiPath Deploy] JSON recovery succeeded — parsed ${Object.keys(raw).length} top-level keys`);
        } catch {
          throw parseErr;
        }
      } else {
        throw parseErr;
      }
    }

    const validated: OrchestratorArtifacts = {};
    if (Array.isArray(raw.queues)) {
      validated.queues = raw.queues.filter((q: any) => typeof q?.name === "string" && q.name.length > 0);
    }
    if (Array.isArray(raw.assets)) {
      validated.assets = raw.assets.filter((a: any) => typeof a?.name === "string" && a.name.length > 0 && typeof a?.type === "string");
    }
    if (Array.isArray(raw.machines)) {
      validated.machines = raw.machines.filter((m: any) => typeof m?.name === "string" && m.name.length > 0);
    }
    if (Array.isArray(raw.triggers)) {
      validated.triggers = raw.triggers.filter((t: any) => typeof t?.name === "string" && t.name.length > 0 && typeof t?.type === "string");
    }
    if (Array.isArray(raw.storageBuckets)) {
      validated.storageBuckets = raw.storageBuckets.filter((b: any) => typeof b?.name === "string" && b.name.length > 0);
    }
    if (Array.isArray(raw.environments)) {
      validated.environments = raw.environments.filter((e: any) => typeof e?.name === "string" && e.name.length > 0);
    }
    if (Array.isArray(raw.robotAccounts)) {
      validated.robotAccounts = raw.robotAccounts.filter((r: any) => typeof r?.name === "string" && r.name.length > 0);
    }
    if (Array.isArray(raw.actionCenter)) {
      validated.actionCenter = raw.actionCenter.filter((a: any) => typeof a?.taskCatalog === "string" && a.taskCatalog.length > 0);
    }
    if (Array.isArray(raw.documentUnderstanding)) {
      const validApproaches = new Set(["classic_du", "generative", "hybrid"]);
      validated.documentUnderstanding = raw.documentUnderstanding
        .filter((d: any) => typeof d?.name === "string" && d.name.length > 0)
        .map((d: any) => ({
          ...d,
          extractionApproach: validApproaches.has(d.extractionApproach) ? d.extractionApproach : "classic_du",
        }));
    }
    if (Array.isArray(raw.communicationsMining)) {
      validated.communicationsMining = raw.communicationsMining
        .filter((d: any) => typeof d?.name === "string" && d.name.length > 0)
        .map((d: any) => ({
          ...d,
          intents: Array.isArray(d.intents) ? d.intents.filter((i: any) => typeof i === "string") : undefined,
          entities: Array.isArray(d.entities) ? d.entities.filter((e: any) => typeof e === "string") : undefined,
          routingRules: Array.isArray(d.routingRules) ? d.routingRules.filter((r: any) => typeof r?.intent === "string" && typeof r?.action === "string") : undefined,
        }));
    }
    if (Array.isArray(raw.testCases)) {
      validated.testCases = raw.testCases.filter((t: any) => typeof t?.name === "string" && t.name.length > 0).map((t: any) => ({
        ...t,
        labels: Array.isArray(t.labels) ? t.labels.filter((l: any) => typeof l === "string") : undefined,
        preconditions: Array.isArray(t.preconditions) ? t.preconditions.filter((p: any) => typeof p === "string") : undefined,
        postconditions: Array.isArray(t.postconditions) ? t.postconditions.filter((p: any) => typeof p === "string") : undefined,
        testData: Array.isArray(t.testData) ? t.testData.filter((d: any) => typeof d?.field === "string") : undefined,
        acceptanceCriteria: undefined,
      }));
    }
    if (Array.isArray(raw.testDataQueues)) {
      validated.testDataQueues = raw.testDataQueues.filter((q: any) => typeof q?.name === "string" && q.name.length > 0);
    }
    if (Array.isArray(raw.requirements)) {
      validated.requirements = raw.requirements.filter((r: any) => typeof r?.name === "string" && r.name.length > 0);
    }
    if (Array.isArray(raw.testSets)) {
      validated.testSets = raw.testSets.filter((s: any) => typeof s?.name === "string" && s.name.length > 0).map((s: any) => ({
        ...s,
        testCaseNames: Array.isArray(s.testCaseNames) ? s.testCaseNames.filter((n: any) => typeof n === "string") : undefined,
      }));
    }
    if (Array.isArray(raw.agents)) {
      validated.agents = raw.agents.filter((a: any) => typeof a?.name === "string" && a.name.length > 0);
    }
    if (Array.isArray(raw.knowledgeBases)) {
      validated.knowledgeBases = raw.knowledgeBases.filter((k: any) => typeof k?.name === "string" && k.name.length > 0);
    }
    if (Array.isArray(raw.promptTemplates)) {
      validated.promptTemplates = raw.promptTemplates.filter((p: any) => typeof p?.name === "string" && p.name.length > 0);
    }
    if (Array.isArray(raw.dataFabricEntities)) {
      validated.dataFabricEntities = raw.dataFabricEntities.filter((e: any) => typeof e?.name === "string" && e.name.length > 0 && Array.isArray(e.fields));
    }
    if (Array.isArray(raw.apps)) {
      validated.apps = raw.apps.filter((a: any) => typeof a?.name === "string" && a.name.length > 0);
    }
    if (Array.isArray(raw.maestroProcesses)) {
      validated.maestroProcesses = raw.maestroProcesses.filter((mp: any) => typeof mp?.name === "string" && mp.name.length > 0).map((mp: any) => ({
        ...mp,
        tasks: Array.isArray(mp.tasks) ? mp.tasks.filter((t: any) => typeof t?.id === "string" && typeof t?.name === "string") : undefined,
        gateways: Array.isArray(mp.gateways) ? mp.gateways.filter((g: any) => typeof g?.id === "string" && typeof g?.name === "string") : undefined,
        events: Array.isArray(mp.events) ? mp.events.filter((e: any) => typeof e?.id === "string" && typeof e?.name === "string") : undefined,
        sequenceFlows: Array.isArray(mp.sequenceFlows) ? mp.sequenceFlows.filter((sf: any) => typeof sf?.id === "string" && typeof sf?.sourceRef === "string" && typeof sf?.targetRef === "string") : undefined,
        crossReferences: Array.isArray(mp.crossReferences) ? mp.crossReferences.filter((cr: any) => typeof cr?.artifactType === "string" && typeof cr?.artifactName === "string") : undefined,
      }));
    }

    const hasContent = (validated.queues?.length || 0) + (validated.assets?.length || 0) +
      (validated.triggers?.length || 0) + (validated.machines?.length || 0) +
      (validated.storageBuckets?.length || 0) + (validated.environments?.length || 0) +
      (validated.robotAccounts?.length || 0) + (validated.actionCenter?.length || 0) +
      (validated.documentUnderstanding?.length || 0) + (validated.communicationsMining?.length || 0) +
      (validated.testCases?.length || 0) + (validated.testDataQueues?.length || 0) +
      (validated.requirements?.length || 0) + (validated.testSets?.length || 0) +
      (validated.agents?.length || 0) + (validated.knowledgeBases?.length || 0) +
      (validated.promptTemplates?.length || 0) +
      (validated.dataFabricEntities?.length || 0) + (validated.apps?.length || 0) +
      (validated.maestroProcesses?.length || 0);

    if (hasContent > 0) {
      console.log(`[UiPath Deploy] LLM extracted ${hasContent} validated artifacts (queues:${validated.queues?.length||0}, assets:${validated.assets?.length||0}, machines:${validated.machines?.length||0}, triggers:${validated.triggers?.length||0}, buckets:${validated.storageBuckets?.length||0}, robots:${validated.robotAccounts?.length||0}, actionCenter:${validated.actionCenter?.length||0}, DU:${validated.documentUnderstanding?.length||0}, commsMining:${validated.communicationsMining?.length||0}, testCases:${validated.testCases?.length||0}, testDataQueues:${validated.testDataQueues?.length||0}, requirements:${validated.requirements?.length||0}, testSets:${validated.testSets?.length||0}, agents:${validated.agents?.length||0}, knowledgeBases:${validated.knowledgeBases?.length||0}, promptTemplates:${validated.promptTemplates?.length||0}, dataFabric:${validated.dataFabricEntities?.length||0}, apps:${validated.apps?.length||0}, maestroProcesses:${validated.maestroProcesses?.length||0})`);
      return validated;
    }
    console.warn("[UiPath Deploy] LLM returned JSON but no valid artifacts after validation. Raw keys:", Object.keys(raw));
    return null;
  } catch (err: any) {
    console.error("[UiPath Deploy] LLM artifact extraction failed:", err?.message, "| Raw text start:", (err?.rawText || "").slice(0, 200));
    return null;
  }
}