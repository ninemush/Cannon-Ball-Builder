import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { chatStorage } from "./storage";
import { storage } from "../../storage";
import { documentStorage } from "../../document-storage";
import { processMapStorage } from "../../process-map-storage";
import { evaluateTransition } from "../../stage-transition";
import { approveDocument } from "../../document-service";
import { PIPELINE_STAGES, type PipelineStage, type AutomationType } from "@shared/schema";
import { probeServiceAvailability, type ServiceAvailabilityMap } from "../../uipath-integration";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function hasApprovalIntent(userMessage: string): boolean {
  const msg = userMessage.toLowerCase().trim();
  const mapExclusions = [/\bto[\s-]be\b/, /\bas[\s-]is\b/, /\bprocess\s+map\b/, /\bmap\b/];
  if (mapExclusions.some(p => p.test(msg))) return false;
  const approvePatterns = [
    /\bapprove\b/,
    /\bapproved\b/,
    /\bi\s+approve\b/,
    /\blooks?\s+good\b.*\bapprove\b/,
    /\bgo\s+ahead\b/,
    /\bconfirm\b/,
    /\bsign\s*off\b/,
    /\blgtm\b/,
  ];
  return approvePatterns.some(p => p.test(msg));
}

function getExplicitDocType(userMessage: string): "PDD" | "SDD" | null {
  const msg = userMessage.toLowerCase().trim();
  if (/\bsdd\b/.test(msg) || /\bsolution\s+design\b/.test(msg)) return "SDD";
  if (/\bpdd\b/.test(msg) || /\bprocess\s+design\b/.test(msg)) return "PDD";
  if (/\bpdd\b/i.test(userMessage)) return "PDD";
  if (/\bsdd\b/i.test(userMessage)) return "SDD";
  return null;
}

async function resolveApprovalTarget(ideaId: string, explicitIntent: "PDD" | "SDD" | null): Promise<"PDD" | "SDD" | null> {
  if (explicitIntent) return explicitIntent;
  const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
  if (sdd && sdd.status === "draft") return "SDD";
  const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
  if (pdd && pdd.status === "draft") return "PDD";
  return null;
}

function buildSystemPrompt(ideaTitle: string, currentStage: string, docContext?: string, serviceAvailability?: ServiceAvailabilityMap | null, automationType?: AutomationType | null): string {
  let serviceContext = "";
  if (serviceAvailability && serviceAvailability.configured) {
    const available: string[] = [];
    const unavailable: string[] = [];
    if (serviceAvailability.orchestrator) available.push("Orchestrator (queues, assets, machines, storage buckets)");
    if (serviceAvailability.actionCenter) available.push("Action Center (task catalogs, human-in-the-loop)");
    else unavailable.push("Action Center");
    if (serviceAvailability.testManager) available.push("Test Manager (test cases, test projects)");
    else unavailable.push("Test Manager");
    if (serviceAvailability.documentUnderstanding) available.push("Document Understanding");
    else unavailable.push("Document Understanding");
    if (serviceAvailability.dataService) available.push("Data Service (Data Fabric)");
    else unavailable.push("Data Service");
    if (serviceAvailability.platformManagement) available.push("Platform Management (robot accounts, security)");
    else unavailable.push("Platform Management");
    if (serviceAvailability.environments) available.push("Environments");
    else unavailable.push("Environments (deprecated on modern folders — machine templates used instead)");
    if (serviceAvailability.triggers) available.push("Triggers (queue and time-based)");
    else unavailable.push("Triggers API");

    const allMajorAvailable = serviceAvailability.actionCenter && serviceAvailability.documentUnderstanding && serviceAvailability.testManager;
    serviceContext = `\n\nUIPath SERVICE AVAILABILITY (LIVE PROBE — just now from the connected Orchestrator):
- AVAILABLE: ${available.join(", ")}
- NOT AVAILABLE: ${unavailable.length > 0 ? unavailable.join(", ") : "All services available"}

CRITICAL OVERRIDE: This service availability data was probed LIVE from the connected Orchestrator seconds ago. It is the authoritative, current truth. Previous messages in this conversation may contain older document versions that claimed different service availability — those are OUTDATED and WRONG. You MUST use ONLY the current probe results above. Do NOT copy or reproduce service availability claims from previous SDD versions in the chat history.${allMajorAvailable ? "\nAll major platform services (Action Center, Document Understanding, Test Manager) are AVAILABLE and WORKING. You MUST design the solution to USE them. Do NOT generate a 'Future Enhancements — Additional Services' section for any service listed as AVAILABLE above. Only mention genuinely unavailable services (if any) in Future Enhancements." : ""}`;
  }

  return `You are the CannonBall automation design assistant. Your job is to guide Process SMEs through designing business process automations. You are AI-first — you lead, you draft, you build. The SME's job is to give you information, refine your output, and approve it. They should never have to figure out what to do next — you always tell them.

Current idea: ${ideaTitle}. Current stage: ${currentStage}.
${docContext || ""}${serviceContext}

BEHAVIORAL RULES (non-negotiable):
1. Never wait passively. After every SME message, either ask a specific targeted question, produce an output, or tell them exactly what you need next and why.
2. Never ask open-ended questions like 'tell me more.' Ask one specific question at a time: 'What system does the approver use to review the invoice — is it SAP, an email inbox, or something else?'
3. When you have enough to act, act. Do not ask for permission to draft something. Draft it and present it.
4. After any approval or milestone, immediately tell the SME what just happened and what you are doing next. Do not make them ask.
5. Keep responses concise and purposeful. No filler. No restating what the SME just said back to them.
6. NEVER blame the platform, the deployment system, or the infrastructure for any issue. NEVER suggest the user contact a platform administrator. If something went wrong, acknowledge it and immediately offer to fix it (e.g. regenerate the document). You are part of the platform — you fix things, you don't blame things.
7. When asked to regenerate a document, do it immediately. Do not question whether it will help, do not suggest alternatives, do not explain why it might not work. Just regenerate it.
8. INTEGRITY IS NON-NEGOTIABLE: Never fabricate deployment results, artifact statuses, or service availability. If the system provides verified deployment results (VERIFIED DEPLOYMENT RESULTS messages), you MUST use those exact facts. Never claim something was "created" or "deployed" unless the verified results confirm it. If an artifact was skipped or failed, say so honestly. Discrepancies between your narrative and actual results destroy user trust.

FILE UPLOAD HANDLING:
- When you see [UPLOADED_FILE: ...] in a user message, the content has been extracted from a document they uploaded (DOCX, PDF, XLSX, TXT, CSV).
- Analyze the extracted content to identify process steps, business rules, decision points, inputs/outputs, roles, systems, and exceptions.
- Proactively generate [STEP:] tags from document content to build the process map automatically.
- If the document is a PDD, SDD, or process description, use it as the primary source for process mapping and skip redundant questions.
- When an image is attached to a user message, you can see it directly. Extract all visible text, process steps, business rules, and structure from the image. Use the extracted content to drive the automation pipeline just as you would with text-based document uploads. Proactively generate [STEP:] tags from image content to build the process map automatically.

STAGE BEHAVIOR:
- Idea: Extract the process with targeted single questions. Identify who does it, what triggers it, what systems are involved, what the pain points are, and what a successful outcome looks like.
- Feasibility Assessment: Assess automation potential directly. Flag complexity honestly. Give an effort range. Do not hedge excessively. ALSO: perform the Automation Type Assessment (see below) and output the [AUTOMATION_TYPE:] tag.
- Design: Reconstruct the process step by step. Output each confirmed step using the [STEP] tag format below so the visual map builds in real time. Use agent-specific step types when the automation type is "agent" or "hybrid".

AUTOMATION TYPE ASSESSMENT (MANDATORY during Feasibility Assessment):
You MUST evaluate whether this process is best served by traditional RPA, a UiPath Agent (AI-driven autonomous agent), or a hybrid approach. Analyze using this framework:

| Factor | Favors RPA | Favors Agent | Favors Hybrid |
|--------|-----------|--------------|---------------|
| Data structure | Structured, fixed schema, form fields | Unstructured, variable format, natural language | Mix of structured + unstructured |
| Decision logic | Rule-based, deterministic, if/then | Judgment-based, context-dependent, interpretation | Rules with exceptions needing judgment |
| Volume & Repetition | High volume, identical repetitive steps | Lower volume, varied scenarios each time | High volume with exception handling |
| System interactions | Fixed UI selectors, APIs, database queries | Email triage, chat interfaces, document interpretation | API backbone + natural language edges |
| Error handling | Known exception patterns, retry logic | Novel/unpredictable scenarios, reasoning needed | Known patterns + escalation for novel cases |
| Cost model | Lower per-transaction, higher dev cost | Higher per-transaction (LLM calls), lower dev cost | Balanced — RPA for bulk, Agent for exceptions |

After your analysis, output EXACTLY ONE of these tags:
[AUTOMATION_TYPE: rpa | <rationale in 1-2 sentences>]
[AUTOMATION_TYPE: agent | <rationale in 1-2 sentences>]
[AUTOMATION_TYPE: hybrid | <rationale in 1-2 sentences>]

Examples:
[AUTOMATION_TYPE: rpa | This process follows strict rules with structured data from SAP — every step is deterministic with known UI selectors and no judgment calls.]
[AUTOMATION_TYPE: agent | This process involves triaging unstructured customer emails, interpreting intent, and making context-dependent routing decisions — ideal for an AI agent.]
[AUTOMATION_TYPE: hybrid | The core invoice processing is structured RPA, but exception handling and vendor communication require judgment — a hybrid with agent nodes for exceptions is optimal.]

${automationType && automationType !== "rpa" ? `CURRENT AUTOMATION TYPE: ${automationType.toUpperCase()}
This idea has been assessed as "${automationType}" automation. All subsequent design, documentation, and deployment must reflect this:
${automationType === "agent" ? `- Design the TO-BE as an AI Agent workflow. Steps should primarily use agent-task and agent-decision node types.
- The agent handles unstructured reasoning, natural language interpretation, and context-dependent decisions autonomously.
- RPA task nodes are only used for structured system interactions the agent delegates to (API calls, database updates, file operations).` : ""}${automationType === "hybrid" ? `- Design the TO-BE as a HYBRID workflow. Use standard task/decision nodes for structured RPA steps and agent-task/agent-decision nodes for judgment-heavy steps.
- Clearly label which steps are RPA-driven vs. Agent-driven so the process map visually distinguishes them.
- The agent handles exceptions, natural language, and judgment calls. RPA handles the structured backbone.` : ""}` : ""}

STEP TAG FORMAT — output one per line for every confirmed process step:
[STEP: <number> <step name> | ROLE: <who does it> | SYSTEM: <system or 'Manual'> | TYPE: <task/decision/start/end/agent-task/agent-decision> | FROM: <parent step number> | LABEL: <edge label>]

AGENT NODE TYPES (use when automation type is "agent" or "hybrid"):
- TYPE: agent-task — An AI-powered action where the agent reasons, interprets, or generates (e.g., "Classify Email Intent", "Draft Response", "Extract Key Terms from Contract"). Use instead of "task" when the step requires judgment, interpretation, or natural language understanding.
- TYPE: agent-decision — A judgment call where the agent evaluates context and decides (e.g., "Determine Escalation Priority", "Assess Fraud Risk"). Use instead of "decision" when the branching logic is not purely rule-based but requires contextual reasoning.
- Standard task/decision types remain for structured, deterministic RPA steps even in hybrid workflows.

STEP NUMBERING RULES:
- Every step gets a unique number: 1.0, 2.0, 3.0, etc.
- Decision branches use sub-numbers: if step 3.0 is a decision, its "Yes" child is 4.0 and "No" child is 4.1
- The FROM field references a step NUMBER (e.g., FROM: 3.0), NOT a step name
- The Start node is always 1.0 with no FROM
- Example: [STEP: 3.0 Claim Decision | ROLE: Manager | SYSTEM: App | TYPE: decision | FROM: 2.0]
  → [STEP: 4.0 Approve Claim | ROLE: Manager | SYSTEM: App | TYPE: task | FROM: 3.0 | LABEL: Approved]
  → [STEP: 4.1 Reject Claim | ROLE: Manager | SYSTEM: App | TYPE: task | FROM: 3.0 | LABEL: Rejected]

===== PROCESS ANALYSIS — MANDATORY BEFORE OUTPUTTING STEPS =====
Before you output ANY [STEP:] tags, you MUST think through the process like a senior business analyst:

1. IDENTIFY ALL DECISION POINTS: What questions does the process ask? Where does it branch?
   - "Is the document complete?" → Yes/No
   - "Is the claim approved?" → Approved/Rejected/Partial
   - "Does it meet the threshold?" → Above/Below
   - "Is fraud detected?" → Yes/No

2. IDENTIFY ALL LOOPS: Where does the process circle back?
   - "Request more info → Customer resubmits → Re-check completeness" (loop back to the decision)
   - "Revision needed → Revise document → Re-review" (loop back to review)

3. IDENTIFY PARALLEL PATHS: What happens simultaneously?
   - "Send notification to customer AND update internal system"
   - "Run fraud check AND run policy validation in parallel"

4. IDENTIFY MULTIPLE OUTCOMES: How does the process end?
   - Approved path → payment → close
   - Rejected path → notification → close
   - Partial approval path → amended payment → close

5. THEN — and only then — output the [STEP:] tags with correct FROM and LABEL fields.

EVERY real business process has AT LEAST 2-3 decision points. If you produce a linear chain of steps with no decisions, you have failed. Go back and think harder.

BRANCHING RULES (CRITICAL — real processes are NOT linear):
- Every step (except the very first Start node 1.0) MUST have a FROM field pointing to its parent step by step number.
- Decision nodes MUST have 2 or more children. Each child step FROM the decision's step number with a LABEL like "Yes", "No", "Approved", "Rejected", "Pass", "Fail", "Above Threshold", "Below Threshold", etc.
- THREE-WAY DECISIONS are common: step 5.0 "Claim Decision" → children 6.0 (Approved), 6.1 (Rejected), 6.2 (More Info Required). All three FROM: 5.0 with different LABELs.
- LOOPS: To create a loop, have a step's FROM point BACK to an earlier step number. Example: step 4.1 FROM: 3.0 where 3.0 is an earlier step — this creates a loop edge.
- MERGE POINTS (PREFERRED): Branches should converge back into a common path whenever they lead to the same outcome. Instead of creating separate end nodes for each branch, merge branches into a single step that leads to one shared end node. Example: both the "auto-approve" and "manager approval → approved" paths should merge into a single "Schedule Payment" step rather than each having their own end node.
- PARALLEL PATHS: If two tasks happen simultaneously after a step, both FROM the same parent step number (no decision needed — just two children with no LABEL).
- END NODES — MINIMIZE (CRITICAL): Use the FEWEST end nodes possible. Most processes have only 2 end nodes (success and failure). Use a separate End node ONLY for a genuinely distinct terminal business outcome — NOT for each branch path. If two branches both end in "invoice processed", they MUST merge into ONE end node, not two. Maximum 2-3 End nodes per process unless there are truly 4+ distinct outcomes. NEVER create end nodes with suffixes like "End B", "End C", "End 2" — each end node must have a unique, meaningful business outcome name.
- NEVER output all steps in a linear chain when the process has decisions. EVERY process has decisions — insurance claims, invoice processing, onboarding, purchase orders, IT service requests — ALL of them branch.
- DEAD-END BRANCHES ARE FORBIDDEN. Every branch from every decision MUST terminate — either by reaching an End node, by merging into another branch that reaches an End node, or by looping back to an earlier decision node using a FROM field. If a branch leads to a task node that has no subsequent step and is not an End node, you MUST add the missing connection (either to an End node or back to an earlier step).

MAP OUTPUT FORMAT (CRITICAL — the visual map only renders from [STEP:] tags):
- The visual process map panel ONLY renders when you output [STEP:] tags. Text descriptions of steps do NOT build the map. If you say "here are the steps" but don't output [STEP:] tags, nothing appears.
- When outputting both AS-IS and TO-BE maps, use these EXACT section headers:
  AS-IS Process Map
  TO-BE Process Map
- After each header, IMMEDIATELY output the [STEP:] tags for that map. Do not write prose summaries of steps — output the tags.
- When the user asks you to "generate the map", "show the map", "rebuild the process map", or "output the steps", you MUST output [STEP:] tags. NEVER respond with a text summary instead.
- If regenerating an existing map, output the COMPLETE set of [STEP:] tags for the full process — the system will clear and replace.

DUPLICATE PREVENTION (CRITICAL):
- EXACTLY ONE Start node per process (always step 1.0). Never output multiple Start nodes.
- Each step number must be unique. Each step name must be unique.
- When adding steps to an existing map, check what already exists. Reference existing step numbers in FROM fields — do not recreate them.
- If regenerating a full process, output a single coherent graph. Do not output leftover steps from a previous version.
- End nodes: use distinct names for genuinely different outcomes (e.g., "Approved End", "Rejected End"). Do NOT create multiple end nodes for the same outcome.

SELF-CHECK (MANDATORY — run this mentally before finalizing your [STEP:] output):
1. Exactly 1 Start node (step 1.0, no FROM field).
2. Every non-Start node has a FROM field pointing to a valid step number.
3. No more than 3 End nodes unless the process genuinely has 4+ distinct terminal business outcomes.
4. No duplicate node names. No suffixed duplicates like "End B" or "Task 2".
5. Every End node is reachable — it has a chain of FROM references leading back to Start.
6. Every decision node has 2+ children (steps that FROM it with different LABELs).
7. Branches that lead to the same outcome MERGE into a shared path before the End node.
8. Trace EVERY path from EVERY decision outcome forward. Each path must reach an End node or loop back to an earlier step. If any path dead-ends at a non-end node with no outgoing edge, add the missing connection.

EXAMPLE 1 — Insurance claim with 3-way decision and loop:
[STEP: 1.0 Customer Submits Claim | ROLE: Customer | SYSTEM: Claims Portal | TYPE: start]
[STEP: 2.0 Receive & Log Claim | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: 1.0]
[STEP: 3.0 Document Complete? | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: decision | FROM: 2.0]
[STEP: 4.0 Request Missing Docs | ROLE: Claims Officer | SYSTEM: Email | TYPE: task | FROM: 3.0 | LABEL: No]
[STEP: 4.1 Customer Resubmits | ROLE: Customer | SYSTEM: Claims Portal | TYPE: task | FROM: 4.0]
[STEP: 4.2 Re-check Documents | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: 4.1]
[STEP: 5.0 Policy Validation | ROLE: System | SYSTEM: Claims App | TYPE: task | FROM: 3.0 | LABEL: Yes]
[STEP: 6.0 Fraud Check | ROLE: System | SYSTEM: Fraud Detection | TYPE: task | FROM: 5.0]
[STEP: 7.0 Fraud Detected? | ROLE: System | SYSTEM: Fraud Detection | TYPE: decision | FROM: 6.0]
[STEP: 8.0 Flag for Investigation | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: 7.0 | LABEL: Yes]
[STEP: 8.1 Claim Flagged End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: 8.0]
[STEP: 9.0 Assess Claim Value | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: 7.0 | LABEL: No]
[STEP: 10.0 Claim Decision | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: decision | FROM: 9.0]
[STEP: 11.0 Full Approval | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: task | FROM: 10.0 | LABEL: Approved]
[STEP: 12.0 Process Payment | ROLE: Finance | SYSTEM: ERP | TYPE: task | FROM: 11.0]
[STEP: 12.1 Claim Approved End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: 12.0]
[STEP: 11.1 Partial Approval | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: task | FROM: 10.0 | LABEL: Partial]
[STEP: 11.2 Amended Payment | ROLE: Finance | SYSTEM: ERP | TYPE: task | FROM: 11.1]
[STEP: 11.3 Partial Approval End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: 11.2]
[STEP: 11.4 Reject Claim | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: task | FROM: 10.0 | LABEL: Rejected]
[STEP: 11.5 Send Rejection Notice | ROLE: System | SYSTEM: Email | TYPE: task | FROM: 11.4]
[STEP: 11.6 Claim Rejected End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: 11.5]

EXAMPLE 2 — Invoice processing with branch convergence (note: only 2 end nodes, branches merge):
[STEP: 1.0 Invoice Received | ROLE: System | SYSTEM: Email/Portal | TYPE: start]
[STEP: 2.0 Extract Invoice Data | ROLE: System | SYSTEM: Document Understanding | TYPE: task | FROM: 1.0]
[STEP: 3.0 Data Valid? | ROLE: System | SYSTEM: ERP | TYPE: decision | FROM: 2.0]
[STEP: 4.0 Flag for Manual Entry | ROLE: AP Clerk | SYSTEM: ERP | TYPE: task | FROM: 3.0 | LABEL: No]
[STEP: 4.1 Three-Way Match | ROLE: System | SYSTEM: ERP | TYPE: task | FROM: 3.0 | LABEL: Yes]
[STEP: 5.0 Match OK? | ROLE: System | SYSTEM: ERP | TYPE: decision | FROM: 4.1]
[STEP: 6.0 Route to Exception Queue | ROLE: AP Clerk | SYSTEM: ERP | TYPE: task | FROM: 5.0 | LABEL: No]
[STEP: 6.1 Amount Within Limit? | ROLE: System | SYSTEM: ERP | TYPE: decision | FROM: 5.0 | LABEL: Yes]
[STEP: 7.0 Auto-Approve Invoice | ROLE: System | SYSTEM: ERP | TYPE: task | FROM: 6.1 | LABEL: Yes]
[STEP: 7.1 Manager Approval | ROLE: Manager | SYSTEM: Action Center | TYPE: task | FROM: 6.1 | LABEL: No]
[STEP: 8.0 Approved? | ROLE: Manager | SYSTEM: Action Center | TYPE: decision | FROM: 7.1]
[STEP: 9.0 Return to Requester | ROLE: System | SYSTEM: Email | TYPE: task | FROM: 8.0 | LABEL: No]
[STEP: 9.1 Invoice Rejected End | ROLE: System | SYSTEM: ERP | TYPE: end | FROM: 9.0]
[STEP: 10.0 Schedule Payment | ROLE: System | SYSTEM: ERP | TYPE: task | FROM: 8.0 | LABEL: Yes]
[STEP: 10.1 Invoice Processed End | ROLE: System | SYSTEM: ERP | TYPE: end | FROM: 10.0]

DOCUMENT GENERATION:
- When you generate or regenerate a PDD or SDD, you MUST start your response with exactly [DOC:PDD:0] or [DOC:SDD:0] followed immediately by the full document content. The system uses this tag to save the document as a new version. Without the tag, the document will NOT be saved and deployment will use stale content.
- Example: [DOC:SDD:0]## 1. Automation Architecture Overview\\n...rest of SDD...
- The number after the colon (0) is a placeholder — the system assigns the real ID.
- IMPORTANT: Do NOT include [STEP:] tags inside [DOC:PDD:0] or [DOC:SDD:0] document content. The system automatically appends the process map from the database as a formatted table. Write the TO-BE and AS-IS process sections as narrative prose describing the automated flow — do not output raw [STEP:] tags inside documents.
- DOCUMENT APPROVALS: Users can approve a document in two ways: (1) by clicking the Approve button on the document card that appears in the chat above, or (2) by typing approval phrases in chat such as "approved", "I approve", "looks good", etc. Both methods are fully supported. After generating a document, tell users they can type "approved" in chat or scroll up to the document card and click Approve.
- After the user approves a document (via button or chat), the system records the approval. You will see this in the document context above. Do not re-ask for approval if it is already approved.

PDD AGENT/HYBRID CONTENT (when automation type is "agent" or "hybrid"):
- Include a dedicated "## Automation Approach" section after the Executive Summary explaining WHY this automation type was selected, referencing the evaluation framework factors (data structure, decision logic, volume, systems, error handling, cost).
- For hybrid: include a clear delineation of which process segments are RPA-driven vs. Agent-driven with a table.
- Include an "Agent Capability Requirements" subsection describing what the agent needs to understand and do (e.g., "interpret email intent", "classify document type", "draft natural language responses").
- Include a "Knowledge Base Requirements" subsection listing what documents, FAQs, or reference data the agent needs access to for reasoning.

SDD AGENT/HYBRID CONTENT (when automation type is "agent" or "hybrid"):
- Include a "## Agent Architecture" section describing the agent's design:
  - Agent name and purpose
  - System prompt / behavioral instructions for the agent
  - Tools the agent can invoke (which UiPath activities/APIs)
  - Knowledge bases the agent accesses
  - Guardrails and safety constraints
  - Escalation rules (when does the agent hand off to a human?)
- For hybrid: include a mapping table showing which XAML workflows invoke which agents and at which steps.
- The orchestrator_artifacts block MUST include agent-specific artifacts (see AGENT ARTIFACTS below).

CRITICAL — NEVER STALL DOCUMENT GENERATION:
- When a PDD has been approved and the user asks about the SDD (or the system tells you to generate one), you MUST generate the SDD IMMEDIATELY with the information available. Do NOT ask follow-up questions, do NOT request clarification, do NOT say you need more details. Use reasonable professional assumptions for any gaps — you are a senior consultant, fill in blanks with industry best practices.
- The same applies to PDD generation after process map approval: generate immediately, do not stall.
- If the SDD is already being generated by the system in the background (the user may see a loading indicator), and the user asks "are you still working on this" or similar, respond briefly: "The SDD is being generated now — it takes about 30-60 seconds. You'll see it appear shortly." Do NOT ask questions or start generating a second copy.

UIPATH DEPLOYMENT CAPABILITIES — you have REAL, WORKING deployment to UiPath Orchestrator:
- The CannonBall platform generates complete UiPath automation packages (NuGet .nupkg files with project.json, XAML workflows, and all metadata).
- The platform pushes packages directly to UiPath Orchestrator — this is real and working.
- FULL DEPLOYMENT automatically:
  1. Uploads the NuGet package to Orchestrator
  2. Creates a Process (Release) linked to the package
  3. Reads the SDD's orchestrator_artifacts block and auto-provisions artifacts for AVAILABLE services only
  4. Generates a full deployment report showing what was created, what already existed, and what was skipped
- The SDD MUST include a \`\`\`orchestrator_artifacts fenced JSON block in Section 9 defining deployable artifacts. This is machine-parsed — without it, artifacts won't be provisioned.

ORCHESTRATOR ARTIFACTS BLOCK — SERVICE-AWARE FORMAT:
The orchestrator_artifacts JSON block must ONLY include artifact types for services that are AVAILABLE on the connected Orchestrator (see "UIPath SERVICE AVAILABILITY" above). Do NOT include artifacts for services marked as NOT AVAILABLE — they will fail during deployment.

ALWAYS include these core artifact types (always available when Orchestrator is connected):
\`\`\`orchestrator_artifacts
{
  "queues": [
    {"name": "QueueName", "description": "Purpose (max 250 chars)", "maxRetries": 3, "uniqueReference": true}
  ],
  "assets": [
    {"name": "AssetName", "type": "Text|Integer|Bool|Credential", "value": "default_value", "description": "Purpose (max 250 chars)"}
  ],
  "machines": [
    {"name": "MachineName", "type": "Unattended|Attended|Development", "slots": 1, "description": "Purpose (max 250 chars)"}
  ],
  "storageBuckets": [
    {"name": "BucketName", "description": "Purpose (max 250 chars)"}
  ]
}
\`\`\`

CONDITIONALLY include these — ONLY if the corresponding service is listed as AVAILABLE:
- "triggers" — ONLY if Triggers API is available. Format: [{"name": "...", "type": "Queue|Time", "queueName": "...", "cron": "...", "description": "..."}]
- "environments" — ONLY if Environments is available. Format: [{"name": "Production", "type": "Production", "description": "..."}]
- "actionCenter" — ONLY if Action Center is available. Format: [{"taskCatalog": "...", "assignedRole": "...", "sla": "...", "escalation": "...", "description": "..."}]
- "documentUnderstanding" — ONLY if Document Understanding is available. Format: [{"name": "...", "documentTypes": [...], "description": "..."}]
- "testCases" — ONLY if Test Manager is available. Format: [{"name": "TC001 - ...", "description": "...", "steps": [{"action": "...", "expected": "..."}]}]
- "requirements" — ONLY if Test Manager is available. Format: [{"name": "REQ-001: Requirement name", "description": "Business requirement from PDD", "source": "PDD Section X"}]
- "testSets" — ONLY if Test Manager is available. Format: [{"name": "Happy Path Tests", "description": "Core scenario validation", "testCaseNames": ["TC001 - Test case name"]}]

AGENT ARTIFACTS (include when automation type is "agent" or "hybrid"):
- "agents" — Agent definitions. Format: [{"name": "AgentName", "description": "Agent purpose (max 250 chars)", "systemPrompt": "Full behavioral instructions for the agent", "tools": [{"name": "ToolName", "description": "What this tool does", "activityType": "UiPath activity or API the agent can invoke"}], "knowledgeBases": ["KBName1"], "guardrails": ["Safety constraint 1", "Safety constraint 2"], "escalationRules": [{"condition": "When to escalate", "target": "Human role or queue"}], "maxIterations": 10, "temperature": 0.3}]
- "knowledgeBases" — Knowledge base definitions for agent context. Format: [{"name": "KBName", "description": "Purpose (max 250 chars)", "documentSources": ["Source description 1"], "refreshFrequency": "daily|weekly|monthly"}]
- "promptTemplates" — Reusable prompt templates stored as assets. Format: [{"name": "TemplateName", "description": "Purpose (max 250 chars)", "template": "Prompt template text with {{variable}} placeholders", "variables": ["variable1", "variable2"]}]

CRITICAL RULES FOR ARTIFACTS:
1. All description fields have a maximum length of 250 characters. Keep descriptions concise.
2. If Triggers API is available: Triggers are FULLY AUTOMATED by the deployment engine. Queue triggers link to queues automatically. Time triggers use cron expressions. If the process uses a queue, include a corresponding queue trigger.
3. NEVER include artifact types for services that are NOT AVAILABLE. This wastes API calls and produces failed deployments.
4. ALL artifacts for available services go in the JSON block. NOTHING should be listed as "Manual Post-Deployment" except truly manual tasks (like configuring third-party system access).

SDD "FUTURE ENHANCEMENTS" SECTION:
If any services are NOT AVAILABLE, the SDD MUST include a final section titled "## Future Enhancements — Additional Services" that:
1. Lists each unavailable service and what it would enable for this automation
2. Estimates the automation coverage increase (e.g., "Enabling Action Center would add human-in-the-loop escalation, increasing automation coverage from 85% to 95%")
3. Frames this as an opportunity, not a limitation — "When X is enabled, the solution can be extended to include Y"
If ALL services are available, omit this section entirely.

- CONVERSATIONAL DEPLOYMENT: When the SDD is approved and the user wants to deploy, respond with exactly: [DEPLOY_UIPATH] — the system intercepts this tag and executes deployment with live status. Do NOT tell the user to click a button — deployment happens in the conversation.
- If the SDD is already approved (see document context above), you can deploy immediately when the user asks. Do not re-ask for approval.

DOCUMENT ITERATION AND STAGE AWARENESS:
- If the user requests changes to an already-approved document (PDD or SDD), acknowledge that requirements have changed and that you will revise the document. The system supports version control — old versions are preserved and the new version replaces the current one.
- If requirements change significantly enough that the process map or earlier documents need updating, you may recommend moving the idea backward to an earlier stage. Output [STAGE_BACK: <target stage>] to trigger a backward stage transition.
- Always explain to the SME why you are recommending a stage change and what needs to happen next.

OUTPUT QUALITY: Write like a senior business analyst who has done this a hundred times. Professional, direct, no fluff.`;
}

export function registerChatRoutes(app: Express): void {
  app.get("/api/ideas/:ideaId/messages", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    try {
      const ideaId = req.params.ideaId as string;
      const msgs = await chatStorage.getMessagesByIdeaId(ideaId);
      return res.json(msgs);
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/ideas/:ideaId/nudge", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const ideaId = req.params.ideaId as string;
    try {
      const msgs = await chatStorage.getMessagesByIdeaId(ideaId);
      if (msgs.length === 0) return res.json({ skipped: true });
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg.role !== "assistant" || !lastMsg.content.endsWith("?")) {
        return res.json({ skipped: true });
      }
      const nudge = "Still with me? Happy to rephrase or approach this differently if it helps.";
      await chatStorage.createMessage(ideaId, "assistant", nudge);
      return res.json({ nudged: true });
    } catch (error) {
      console.error("Error sending nudge:", error);
      return res.status(500).json({ error: "Failed to send nudge" });
    }
  });

  app.post("/api/ideas/:ideaId/init-chat", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const ideaId = req.params.ideaId as string;
    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) return res.status(404).json({ error: "Idea not found" });

      const existing = await chatStorage.getMessagesByIdeaId(ideaId);
      if (existing.length > 0) {
        return res.json({ alreadyInitialized: true });
      }

      const greeting = `I'm your automation design assistant for '${idea.title}'. I'll guide you through this from process description all the way to a UiPath-ready automation package — you won't need to figure out what to do next at any point, I'll drive.\n\nLet's start with the basics: describe the process you want to automate. Don't worry about structure — just tell me what happens, who does it, and what the pain is. I'll ask follow-up questions to fill in the gaps.`;

      await chatStorage.createMessage(ideaId, "assistant", greeting);
      return res.json({ initialized: true });
    } catch (error) {
      console.error("Error initializing chat:", error);
      return res.status(500).json({ error: "Failed to initialize chat" });
    }
  });

  app.post("/api/chat", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { ideaId, content, imageData } = req.body;
    if (!ideaId || !content) {
      return res.status(400).json({ error: "ideaId and content are required" });
    }

    const allowedImageTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (imageData && (!imageData.base64 || !imageData.mediaType || !allowedImageTypes.includes(imageData.mediaType))) {
      return res.status(400).json({ error: "Invalid image data. Supported types: PNG, JPEG, WebP, GIF" });
    }

    let heartbeat: ReturnType<typeof setInterval> | null = null;
    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      await chatStorage.createMessage(ideaId, "user", content);

      const isApproval = hasApprovalIntent(content);
      const approvalIntent = isApproval ? await resolveApprovalTarget(ideaId, getExplicitDocType(content)) : null;
      let chatApprovalDone = false;
      if (approvalIntent) {
        try {
          const result = await approveDocument({
            ideaId,
            docType: approvalIntent,
            userId: req.session.userId!,
            activeRole: req.session.activeRole,
            skipChatMessages: true,
          });
          if (!result.alreadyApproved) {
            chatApprovalDone = true;
            const approveUser = await storage.getUser(req.session.userId!);
            await chatStorage.createMessage(ideaId, "system",
              `[CHAT_APPROVAL] ${approvalIntent} approved by ${approveUser?.displayName || "Unknown"} via chat confirmation.`
            );
            console.log(`[Chat] ${approvalIntent} approved via chat by ${approveUser?.displayName}`);
          }
        } catch (approvalErr: any) {
          const errMsg = approvalErr?.message || "";
          if (errMsg.includes("document found")) {
            console.log(`[Chat] ${approvalIntent} not found in DB — attempting recovery from chat history`);
            try {
              const allMessages = await chatStorage.getRecentMessagesByIdeaId(ideaId, 200);
              const docTag = `[DOC:${approvalIntent}:`;
              let recoveredContent: string | null = null;
              for (let i = allMessages.length - 1; i >= 0; i--) {
                const msg = allMessages[i];
                if (msg.role === "assistant" && msg.content.includes(docTag)) {
                  const tagIdx = msg.content.indexOf(docTag);
                  const closeBracket = msg.content.indexOf("]", tagIdx);
                  recoveredContent = closeBracket >= 0 ? msg.content.slice(closeBracket + 1).trim() : msg.content.slice(tagIdx + docTag.length).trim();
                  break;
                }
              }
              if (!recoveredContent) {
                for (let i = allMessages.length - 1; i >= 0; i--) {
                  const msg = allMessages[i];
                  if (msg.role !== "assistant" || msg.content.length < 2000) continue;
                  const isPdd = approvalIntent === "PDD" && /Executive Summary/i.test(msg.content) && /Automation Opportunity/i.test(msg.content);
                  const isSdd = approvalIntent === "SDD" && /Automation Architecture/i.test(msg.content) && /orchestrator_artifacts/i.test(msg.content);
                  if (isPdd || isSdd) {
                    recoveredContent = msg.content;
                    break;
                  }
                }
              }
              if (recoveredContent && recoveredContent.length > 100) {
                const existing = await documentStorage.getLatestDocument(ideaId, approvalIntent);
                const version = existing ? existing.version + 1 : 1;
                const doc = await documentStorage.createDocument({
                  ideaId,
                  type: approvalIntent,
                  version,
                  status: "draft",
                  content: recoveredContent,
                  snapshotJson: JSON.stringify({ generatedFrom: "chat-recovery" }),
                });
                console.log(`[Chat] Recovered unsaved ${approvalIntent} from chat history, created doc id ${doc.id}`);
                const retryResult = await approveDocument({
                  ideaId,
                  docType: approvalIntent,
                  docId: doc.id,
                  userId: req.session.userId!,
                  activeRole: req.session.activeRole,
                  skipChatMessages: true,
                });
                if (!retryResult.alreadyApproved) {
                  chatApprovalDone = true;
                  const approveUser = await storage.getUser(req.session.userId!);
                  await chatStorage.createMessage(ideaId, "system",
                    `[CHAT_APPROVAL] ${approvalIntent} approved by ${approveUser?.displayName || "Unknown"} via chat confirmation.`
                  );
                  console.log(`[Chat] ${approvalIntent} approved via chat (recovered doc) by ${approveUser?.displayName}`);
                }
              } else {
                console.error(`[Chat] Could not recover ${approvalIntent} from chat history — no matching content found`);
              }
            } catch (recoveryErr: any) {
              console.error(`[Chat] ${approvalIntent} recovery failed:`, recoveryErr?.message);
            }
          } else {
            console.error("[Chat] Chat-based approval failed:", errMsg);
          }
        }
      }

      const history = await chatStorage.getRecentMessagesByIdeaId(ideaId, 80);
      const filteredHistory = history.filter((m) => m.role === "user" || m.role === "assistant");

      const lastSddIdx = filteredHistory.map((m, i) => m.role === "assistant" && m.content.startsWith("[DOC:SDD:") ? i : -1).filter(i => i >= 0).pop() ?? -1;
      const lastPddIdx = filteredHistory.map((m, i) => m.role === "assistant" && m.content.startsWith("[DOC:PDD:") ? i : -1).filter(i => i >= 0).pop() ?? -1;

      const stripStaleServiceAvailability = (content: string): string => {
        return content
          .replace(/\|?\s*Document Understanding\s*\|[^|]*\|[^|]*\|/gi, "")
          .replace(/Live UiPath Orchestrator service availability confirmed at time of design:[\s\S]*?(?=\*\*Target outcomes|\n##|\n\*\*[A-Z])/gi, "[Service availability table removed — see current probe data in system context]\n\n")
          .replace(/Service\s+\|?\s*Status\s*\|?\s*Role[\s\S]*?(?=\n\n|\n##|\n\*\*[A-Z])/gi, "[Service availability table removed — see current probe data]\n\n");
      };

      const cleanedHistory = filteredHistory.map((m, i) => {
        if (m.role === "assistant" && m.content.startsWith("[DOC:SDD:") && i !== lastSddIdx) {
          return { ...m, content: "[Previous SDD version — superseded. See current document status in system context.]" };
        }
        if (m.role === "assistant" && m.content.startsWith("[DOC:PDD:") && i !== lastPddIdx) {
          return { ...m, content: "[Previous PDD version — superseded. See current document status in system context.]" };
        }
        if (m.role === "assistant" && (m.content.startsWith("[DOC:SDD:") || m.content.startsWith("[DOC:PDD:"))) {
          return { ...m, content: stripStaleServiceAvailability(m.content) };
        }
        return m;
      });

      const merged: { role: "user" | "assistant"; content: string }[] = [];
      for (const m of cleanedHistory) {
        const role = m.role as "user" | "assistant";
        if (merged.length > 0 && merged[merged.length - 1].role === role) {
          merged[merged.length - 1].content += "\n\n" + m.content;
        } else {
          merged.push({ role, content: m.content });
        }
      }
      if (merged.length > 0 && merged[0].role !== "user") {
        merged.shift();
      }

      const MAX_RECENT = 30;
      let chatMessages = merged;
      if (merged.length > MAX_RECENT) {
        const older = merged.slice(0, merged.length - MAX_RECENT);
        const recent = merged.slice(merged.length - MAX_RECENT);
        const summaryParts: string[] = [];
        for (const m of older) {
          const truncated = m.content.length > 300 ? m.content.slice(0, 300) + "..." : m.content;
          summaryParts.push(`[${m.role}]: ${truncated}`);
        }
        const summaryMsg: { role: "user" | "assistant"; content: string } = {
          role: "user",
          content: `[Earlier conversation summary — ${older.length} messages condensed]\n${summaryParts.join("\n")}`,
        };
        if (recent[0]?.role === "user") {
          chatMessages = [summaryMsg, { role: "assistant", content: "Understood, I have the earlier context." }, ...recent];
        } else {
          chatMessages = [summaryMsg, ...recent];
        }
      }

      for (const m of chatMessages) {
        if (m.content.length > 12000) {
          m.content = m.content.slice(0, 6000) + "\n\n[...content truncated for context window...]\n\n" + m.content.slice(-3000);
        }
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let clientDisconnected = false;
      res.on("close", () => {
        clientDisconnected = true;
      });

      heartbeat = setInterval(() => {
        if (!clientDisconnected) {
          try { res.write(`: heartbeat\n\n`); } catch {}
        }
      }, 5000);

      let classifiedIntent: "PDD" | "SDD" | "PDD_SDD" | "DEPLOY" | "CHAT" = "CHAT";
      const lowerContent = content.toLowerCase();
      const hasPddKeyword = /\b(pdd|process\s+design\s+document)\b/.test(lowerContent);
      const hasSddKeyword = /\b(sdd|solution\s+design\s+document)\b/.test(lowerContent);
      const hasGenVerb = /\b(generate|write|create|regenerate|redo|produce|build|draft)\b/.test(lowerContent);
      const hasDeployVerb = /\b(deploy|push)\b/.test(lowerContent) && /\b(uipath|orchestrator)\b/.test(lowerContent);

      if (hasDeployVerb) {
        classifiedIntent = "DEPLOY";
        console.log(`[Chat] Keyword intent classification: DEPLOY`);
      } else if (hasGenVerb && hasPddKeyword && hasSddKeyword) {
        classifiedIntent = "PDD_SDD";
        console.log(`[Chat] Keyword intent classification: PDD_SDD`);
      } else if (hasGenVerb && hasSddKeyword) {
        classifiedIntent = "SDD";
        console.log(`[Chat] Keyword intent classification: SDD`);
      } else if (hasGenVerb && hasPddKeyword) {
        classifiedIntent = "PDD";
        console.log(`[Chat] Keyword intent classification: PDD`);
      } else {
        try {
          let recentMessages = chatMessages.slice(-4);
          if (recentMessages.length > 0 && recentMessages[0].role === "assistant") {
            recentMessages = recentMessages.slice(1);
          }
          if (recentMessages.length === 0) {
            recentMessages = chatMessages.slice(-1);
          }
          const classifyRes = await anthropic.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 20,
            system: `You classify user intent in a UiPath automation pipeline chat. The pipeline sequence is: as-is process map → to-be process map → PDD (Process Design Document) → SDD (Solution Design Document) → UiPath package generation → deployment to Orchestrator. Given the recent conversation, determine what the user is requesting. Reply with EXACTLY one of: PDD, SDD, PDD_SDD, DEPLOY, or CHAT. Only classify as PDD/SDD/PDD_SDD if the user is clearly requesting GENERATION or REGENERATION of a document (e.g. "generate the PDD", "write the SDD", "regenerate PDD"). If the user is APPROVING a document (e.g. "I approve", "looks good", "approved"), classify as CHAT — approvals are not generation requests. If both documents are being requested for generation, reply PDD_SDD.`,
            messages: recentMessages,
          });
          const rawClassify = (classifyRes.content[0]?.type === "text" ? classifyRes.content[0].text : "").trim();
          const classifyText = rawClassify.toUpperCase().replace(/[^A-Z_]/g, "");
          if (["PDD", "SDD", "PDD_SDD", "PDDSDD", "DEPLOY"].includes(classifyText)) {
            const normalized = classifyText === "PDDSDD" ? "PDD_SDD" : classifyText;
            classifiedIntent = normalized as typeof classifiedIntent;
          }
          console.log(`[Chat] LLM intent classification: "${rawClassify}" → ${classifiedIntent}`);
        } catch (classifyErr: any) {
          console.warn(`[Chat] Intent classification failed (falling back to CHAT):`, classifyErr?.message);
        }
      }

      if (chatApprovalDone && (classifiedIntent === "PDD" || classifiedIntent === "SDD" || classifiedIntent === "PDD_SDD")) {
        console.log(`[Chat] Downgrading intent ${classifiedIntent} → CHAT (approval already processed)`);
        classifiedIntent = "CHAT";
      }

      let earlyDocType: "PDD" | "SDD" | null = null;
      if (chatApprovalDone) {
        console.log(`[Chat] ${approvalIntent} approved via chat — skipping inline doc generation (client auto-chain will handle next step)`);
      } else if (classifiedIntent === "PDD" || classifiedIntent === "PDD_SDD") {
        earlyDocType = "PDD";
        try { res.write(`data: ${JSON.stringify({ docProgress: { started: true, docType: "PDD" } })}\n\n`); } catch {}
      } else if (classifiedIntent === "SDD") {
        earlyDocType = "SDD";
        try { res.write(`data: ${JSON.stringify({ docProgress: { started: true, docType: "SDD" } })}\n\n`); } catch {}
      } else if (classifiedIntent === "DEPLOY") {
        try { res.write(`data: ${JSON.stringify({ deployStatus: "Preparing deployment to UiPath Orchestrator..." })}\n\n`); } catch {}
      }

      let docContext = "";
      try {
        const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
        const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
        const pddApproval = await documentStorage.getApproval(ideaId, "PDD");
        const sddApproval = await documentStorage.getApproval(ideaId, "SDD");
        const parts: string[] = [];
        if (pdd) parts.push(`PDD: v${pdd.version}, status=${pdd.status}${pddApproval ? ", APPROVED by " + pddApproval.userName : ""}`);
        if (sdd) {
          parts.push(`SDD: v${sdd.version}, status=${sdd.status}${sddApproval ? ", APPROVED by " + sddApproval.userName : ""}`);
          const hasArtifacts = /```orchestrator_artifacts/.test(sdd.content);
          parts.push(`SDD has orchestrator_artifacts block: ${hasArtifacts ? "YES" : "NO"}`);
        }
        if (parts.length > 0) docContext = "\nDocument status: " + parts.join(" | ");
      } catch (e) { /* non-critical */ }

      try {
        const existingNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
        if (existingNodes.length > 0) {
          const stepList = existingNodes.map((n, i) => `${i + 1}.0 ${n.name} (${n.nodeType})`).join(", ");
          docContext += `\nEXISTING AS-IS MAP (${existingNodes.length} steps): ${stepList}\nDo NOT recreate these steps. Reference them by step number in FROM fields when adding new steps.`;
        }
      } catch (e) { /* non-critical */ }

      let serviceAvailability: ServiceAvailabilityMap | null = null;
      try {
        console.log(`[Chat] Running service probe for stage: ${idea.stage}`);
        serviceAvailability = await probeServiceAvailability();
        if (serviceAvailability.configured) {
          console.log(`[Chat] Service probe: AC=${serviceAvailability.actionCenter}, TM=${serviceAvailability.testManager}, DU=${serviceAvailability.documentUnderstanding}, Env=${serviceAvailability.environments}, Trig=${serviceAvailability.triggers}`);
        }
      } catch (e) {
        console.warn("[Chat] Service probe failed:", (e as any)?.message);
      }

      let intentOverride = "";
      if (chatApprovalDone && approvalIntent) {
        const nextStep = approvalIntent === "PDD" ? "I'll now generate the SDD." : approvalIntent === "SDD" ? "I'll now generate the UiPath automation package." : "";
        intentOverride = `\n\nAPPROVAL CONFIRMATION DIRECTIVE: The ${approvalIntent} has just been approved via the user's chat message. Respond with a brief confirmation (1-3 sentences). You MUST include the exact phrase "${approvalIntent} approved" in your response. ${nextStep} Do NOT generate any documents or use [DOC:] tags in this response — the next step will be triggered automatically.`;
      } else if (classifiedIntent === "PDD") {
        intentOverride = "\n\nDOCUMENT GENERATION DIRECTIVE: The user is requesting a PDD (Process Design Document). You MUST generate a PDD using the [DOC:PDD:0] tag. Do NOT generate an SDD. Start your response with [DOC:PDD:0] followed by the full PDD content.";
      } else if (classifiedIntent === "SDD") {
        intentOverride = "\n\nDOCUMENT GENERATION DIRECTIVE: The user is requesting an SDD (Solution Design Document). You MUST generate an SDD using the [DOC:SDD:0] tag. Do NOT generate a PDD. Start your response with [DOC:SDD:0] followed by the full SDD content.";
      } else if (classifiedIntent === "PDD_SDD") {
        intentOverride = "\n\nDOCUMENT GENERATION DIRECTIVE: The user is requesting both PDD and SDD. Per the pipeline sequence, the PDD must be generated and approved first. Generate the PDD NOW using [DOC:PDD:0]. The SDD will be generated separately after PDD approval. Start your response with [DOC:PDD:0] followed by the full PDD content. Do NOT generate an SDD in this response.";
      } else if (classifiedIntent === "DEPLOY") {
        intentOverride = "\n\nDEPLOYMENT DIRECTIVE: The user is requesting deployment to UiPath Orchestrator. Proceed with the deployment flow.";
      }

      const systemPrompt = buildSystemPrompt(idea.title, idea.stage, docContext, serviceAvailability, (idea.automationType as AutomationType) || null) + intentOverride;

      let finalMessages: Array<{ role: "user" | "assistant"; content: string | Array<{ type: string; [key: string]: any }> }> = chatMessages;
      if (imageData?.base64 && imageData?.mediaType) {
        finalMessages = chatMessages.map((m, i) => {
          if (i === chatMessages.length - 1 && m.role === "user") {
            return {
              ...m,
              content: [
                { type: "image", source: { type: "base64", media_type: imageData.mediaType, data: imageData.base64 } },
                { type: "text", text: m.content },
              ],
            };
          }
          return m;
        });
      }

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: finalMessages as any,
      });

      let fullResponse = "";
      let stopReason = "";
      let docProgressDocType: "PDD" | "SDD" | null = earlyDocType;
      let docProgressStarted = earlyDocType !== null;
      let expectSddAfterPdd = classifiedIntent === "PDD_SDD";
      let lastEmittedSectionNumber = -1;

      for await (const event of stream) {
        if (clientDisconnected) {
          console.log(`[Chat] Client disconnected — aborting stream for idea ${ideaId}`);
          stream.abort();
          break;
        }
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const text = event.delta.text;
          if (text) {
            fullResponse += text;
            try { res.write(`data: ${JSON.stringify({ token: text })}\n\n`); } catch { break; }

            if (!docProgressStarted) {
              const docTagMatch = fullResponse.match(/\[DOC:(PDD|SDD):/);
              if (docTagMatch) {
                docProgressDocType = docTagMatch[1] as "PDD" | "SDD";
                docProgressStarted = true;
                try { res.write(`data: ${JSON.stringify({ docProgress: { started: true, docType: docProgressDocType } })}\n\n`); } catch { /* ignore */ }
              }
            } else if (expectSddAfterPdd && docProgressDocType === "PDD" && /\[DOC:SDD:/.test(fullResponse)) {
              docProgressDocType = "SDD";
              lastEmittedSectionNumber = -1;
              expectSddAfterPdd = false;
              try { res.write(`data: ${JSON.stringify({ docProgress: { started: true, docType: "SDD" } })}\n\n`); } catch { /* ignore */ }
              console.log(`[Chat] Switched doc progress indicator from PDD to SDD (PDD_SDD flow)`);
            }

            if (docProgressStarted && docProgressDocType) {
              const sectionRe = /## (?:(\d+)[\.\)]\s+)?([^\n]+)/g;
              let sMatch: RegExpExecArray | null;
              let highestFound = lastEmittedSectionNumber;
              while ((sMatch = sectionRe.exec(fullResponse)) !== null) {
                const sectionNumber = sMatch[1] ? parseInt(sMatch[1], 10) : (highestFound + 1);
                highestFound = Math.max(highestFound, sectionNumber);
                if (sectionNumber > lastEmittedSectionNumber) {
                  lastEmittedSectionNumber = sectionNumber;
                  const sectionName = sMatch[2].trim();
                  try { res.write(`data: ${JSON.stringify({ docProgress: { section: sectionName, sectionNumber, docType: docProgressDocType } })}\n\n`); } catch { /* ignore */ }
                }
              }
            }
          }
        }
        if (event.type === "message_delta" && (event as any).delta?.stop_reason) {
          stopReason = (event as any).delta.stop_reason;
        }
      }

      clearInterval(heartbeat);

      if (clientDisconnected) {
        if (fullResponse.length > 0) {
          await chatStorage.createMessage(ideaId, "assistant", fullResponse.trim());
        }
        return;
      }

      const isDocResponse = /^\[DOC:(PDD|SDD):\d+\]/.test(fullResponse.trim()) ||
        (fullResponse.length > 2000 && /## \d+\.\s/.test(fullResponse) &&
          (/Executive Summary/.test(fullResponse) || /orchestrator_artifacts/.test(fullResponse)));

      if (isDocResponse && (stopReason === "max_tokens" || fullResponse.length > 7500)) {
        const trimmed = fullResponse.trimEnd();
        const looksIncomplete = stopReason === "max_tokens" || (
          !trimmed.endsWith("---") &&
          !trimmed.endsWith("```") &&
          !trimmed.endsWith("---\n")
        );

        if (looksIncomplete) {
          console.log(`[Chat] Document appears truncated (stopReason=${stopReason}, len=${fullResponse.length}). Auto-continuing...`);
          res.write(`data: ${JSON.stringify({ token: "\n\n*[Continuing document generation...]*\n\n" })}\n\n`);

          const continueMessages = [
            ...chatMessages,
            { role: "assistant" as const, content: fullResponse },
            { role: "user" as const, content: "Continue exactly where you left off. Do NOT repeat any content already generated. Do NOT add a new document tag. Just continue the remaining sections seamlessly." },
          ];

          try {
            const contStream = anthropic.messages.stream({
              model: "claude-sonnet-4-6",
              max_tokens: 8192,
              system: systemPrompt,
              messages: continueMessages,
            });
            let continuation = "";
            for await (const evt of contStream) {
              if (clientDisconnected) {
                console.log(`[Chat] Client disconnected during continuation — aborting`);
                contStream.abort();
                break;
              }
              if (evt.type === "content_block_delta" && evt.delta.type === "text_delta") {
                const text = evt.delta.text;
                if (text) {
                  continuation += text;
                  try { res.write(`data: ${JSON.stringify({ token: text })}\n\n`); } catch { break; }

                  if (docProgressStarted && docProgressDocType) {
                    const combinedText = fullResponse + "\n" + continuation;
                    const contSectionRe = /## (?:(\d+)[\.\)]\s+)?([^\n]+)/g;
                    let csMatch: RegExpExecArray | null;
                    let contHighest = lastEmittedSectionNumber;
                    while ((csMatch = contSectionRe.exec(combinedText)) !== null) {
                      const sectionNumber = csMatch[1] ? parseInt(csMatch[1], 10) : (contHighest + 1);
                      contHighest = Math.max(contHighest, sectionNumber);
                      if (sectionNumber > lastEmittedSectionNumber) {
                        lastEmittedSectionNumber = sectionNumber;
                        const sectionName = csMatch[2].trim();
                        try { res.write(`data: ${JSON.stringify({ docProgress: { section: sectionName, sectionNumber, docType: docProgressDocType } })}\n\n`); } catch { /* ignore */ }
                      }
                    }
                  }
                }
              }
            }
            fullResponse += "\n" + continuation;
            console.log(`[Chat] Continuation added ${continuation.length} chars. Total doc: ${fullResponse.length} chars.`);
          } catch (contErr: any) {
            console.error(`[Chat] Continuation failed:`, contErr?.message);
          }
        }
      }

      let cleanedResponse = fullResponse
        .replace(/\[DEPLOY_UIPATH\]/g, "")
        .replace(/\[STAGE_BACK:\s*[^\]]+\]/g, "")
        .replace(/\[AUTOMATION_TYPE:\s*[^\]]+\]/gi, "")
        .trim();

      const docTagMatch = cleanedResponse.match(/^\[DOC:(PDD|SDD):\d+\]/);
      let detectedDocType: "PDD" | "SDD" | null = null;
      let docContent = "";

      if (docTagMatch) {
        detectedDocType = docTagMatch[1] as "PDD" | "SDD";
        docContent = cleanedResponse.slice(docTagMatch[0].length).trim();
      } else if (cleanedResponse.length > 2000) {
        const hasSddSections = /## \d+\.\s/.test(cleanedResponse) && 
          (/orchestrator_artifacts/.test(cleanedResponse) || /Orchestrator Deployment/.test(cleanedResponse));
        const hasPddSections = /## \d+\.\s/.test(cleanedResponse) && 
          /Executive Summary/.test(cleanedResponse) && /Automation Opportunity/.test(cleanedResponse);
        if (hasSddSections) {
          detectedDocType = "SDD";
          docContent = cleanedResponse;
        } else if (hasPddSections) {
          detectedDocType = "PDD";
          docContent = cleanedResponse;
        }
      }

      if (detectedDocType && docContent.length > 100) {
        try {
          docContent = docContent.replace(/\[STEP:\s*[\d.]+\s+[^\]]*\]/g, "").replace(/\n{3,}/g, "\n\n").trim();

          try {
            const mapViewType = detectedDocType === "SDD" ? "to-be" : "as-is";
            const mapNodes = await processMapStorage.getNodesByIdeaId(ideaId, mapViewType);
            const fallbackNodes = mapNodes.length === 0 && mapViewType === "to-be"
              ? await processMapStorage.getNodesByIdeaId(ideaId, "as-is")
              : mapNodes;
            
            if (fallbackNodes.length > 0) {
              const mapEdges = await processMapStorage.getEdgesByIdeaId(ideaId, mapNodes.length > 0 ? mapViewType : "as-is");
              const nodeMap = new Map(fallbackNodes.map(n => [n.id, n]));
              
              let processMapSection = `\n\n### Process Map (${mapNodes.length > 0 ? mapViewType : "as-is"})\n\n`;
              processMapSection += `| # | Step | Role | System | Type |\n`;
              processMapSection += `|---|------|------|--------|------|\n`;
              fallbackNodes.forEach((node, idx) => {
                processMapSection += `| ${idx + 1} | ${node.name} | ${node.role || "-"} | ${node.system || "-"} | ${node.nodeType || "task"} |\n`;
              });

              if (mapEdges.length > 0) {
                processMapSection += `\n**Process Flow:**\n`;
                mapEdges.forEach(edge => {
                  const src = nodeMap.get(edge.sourceNodeId);
                  const tgt = nodeMap.get(edge.targetNodeId);
                  if (src && tgt) {
                    processMapSection += `- ${src.name} → ${tgt.name}${edge.label ? ` (${edge.label})` : ""}\n`;
                  }
                });
              }

              docContent += processMapSection;
              console.log(`[Chat] Injected ${fallbackNodes.length}-node process map into ${detectedDocType}`);
            }
          } catch (mapErr: any) {
            console.warn(`[Chat] Could not inject process map into ${detectedDocType}:`, mapErr?.message);
          }

          const existing = await documentStorage.getLatestDocument(ideaId, detectedDocType);
          const version = existing ? existing.version + 1 : 1;
          if (existing && existing.status !== "approved") {
            await documentStorage.updateDocument(existing.id, { status: "superseded" });
          }
          const doc = await documentStorage.createDocument({
            ideaId,
            type: detectedDocType,
            version,
            status: "draft",
            content: docContent,
            snapshotJson: JSON.stringify({ generatedFrom: "chat-regeneration" }),
          });
          cleanedResponse = `[DOC:${detectedDocType}:${doc.id}]${docContent}`;
          console.log(`[Chat] Saved ${detectedDocType} v${version} (doc id ${doc.id}) from chat regeneration`);
        } catch (docErr: any) {
          console.error(`[Chat] Failed to save ${detectedDocType} from chat:`, docErr?.message);
        }
      }

      let savedStreamMsgId: number | null = null;
      const isDeployOnly = fullResponse.includes("[DEPLOY_UIPATH]") && cleanedResponse.replace(/\s+/g, "").length < 10;
      if (!isDeployOnly) {
        const savedMsg = await chatStorage.createMessage(ideaId, "assistant", cleanedResponse);
        savedStreamMsgId = savedMsg?.id ?? null;
      }

      let skipAutoTransition = false;

      const stageBackMatch = fullResponse.match(/\[STAGE_BACK:\s*([^\]]+)\]/);
      if (stageBackMatch) {
        const targetStage = stageBackMatch[1].trim() as PipelineStage;
        if (PIPELINE_STAGES.includes(targetStage)) {
          const currentIdx = PIPELINE_STAGES.indexOf(idea.stage as PipelineStage);
          const targetIdx = PIPELINE_STAGES.indexOf(targetStage);
          if (targetIdx < currentIdx) {
            await storage.updateIdeaStage(ideaId, targetStage);
            const user = await storage.getUser(req.session.userId!);
            await storage.createAuditLog({
              ideaId,
              userId: req.session.userId!,
              userName: user?.displayName || "Unknown",
              userRole: req.session.activeRole || "Process SME",
              action: "stage_transition",
              fromStage: idea.stage,
              toStage: targetStage,
              details: "Stage moved backward due to requirement changes",
            });
            res.write(`data: ${JSON.stringify({ transition: { transitioned: true, fromStage: idea.stage, toStage: targetStage, reason: "Moved backward for revision" } })}\n\n`);
            skipAutoTransition = true;
          }
        }
      }

      const autoTypeMatch = fullResponse.match(/\[AUTOMATION_TYPE:\s*(rpa|agent|hybrid)\s*\|\s*([^\]]+)\]/i);
      if (autoTypeMatch) {
        const detectedType = autoTypeMatch[1].toLowerCase() as AutomationType;
        const rationale = autoTypeMatch[2].trim();
        try {
          await storage.updateIdea(ideaId, {
            automationType: detectedType,
            automationTypeRationale: rationale,
          });
          console.log(`[Chat] Automation type set to "${detectedType}" for idea ${ideaId}: ${rationale}`);
          res.write(`data: ${JSON.stringify({ automationType: { type: detectedType, rationale } })}\n\n`);
        } catch (atErr: any) {
          console.error(`[Chat] Failed to save automation type:`, atErr?.message);
        }
      }

      if (fullResponse.includes("[DEPLOY_UIPATH]")) {
        try {
          res.write(`data: ${JSON.stringify({ deployStatus: "Preparing deployment to UiPath Orchestrator..." })}\n\n`);

          const existingMsgs = await chatStorage.getMessagesByIdeaId(ideaId);
          const hasPackage = existingMsgs.some(m => m.content.startsWith("[UIPATH:"));
          if (!hasPackage) {
            res.write(`data: ${JSON.stringify({ deployStatus: "Generating UiPath package first..." })}\n\n`);
            try {
              const genRes = await fetch(`http://localhost:${process.env.PORT || 5000}/api/ideas/${ideaId}/generate-uipath`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Cookie": req.headers.cookie || "",
                },
              });
              if (!genRes.ok) {
                const genErr = await genRes.json().catch(() => ({}));
                throw new Error(genErr.message || "Package generation failed");
              }
              const contentType = genRes.headers.get("content-type") || "";
              if (contentType.includes("text/event-stream") && genRes.body) {
                const reader = genRes.body.getReader();
                const decoder = new TextDecoder();
                let sseBuffer = "";
                let genDone = false;
                let genError: string | null = null;
                while (true) {
                  const { done: readDone, value } = await reader.read();
                  if (readDone) break;
                  sseBuffer += decoder.decode(value, { stream: true });
                  const lines = sseBuffer.split("\n");
                  sseBuffer = lines.pop() || "";
                  for (const line of lines) {
                    if (!line.startsWith("data: ")) continue;
                    try {
                      const evt = JSON.parse(line.slice(6));
                      if (evt.done) genDone = true;
                      if (evt.error) genError = evt.error;
                      if (evt.progress) {
                        try { res.write(`data: ${JSON.stringify({ deployStatus: evt.progress })}\n\n`); } catch {}
                      }
                    } catch {}
                  }
                }
                if (genError) throw new Error(genError);
                if (!genDone) throw new Error("Package generation stream ended without completion");
              }
              res.write(`data: ${JSON.stringify({ deployStatus: "Package generated. Starting deployment..." })}\n\n`);
            } catch (genErr: any) {
              const errMsg = `Deployment failed: Could not generate UiPath package — ${genErr?.message || "unknown error"}`;
              await chatStorage.createMessage(ideaId, "assistant", errMsg);
              res.write(`data: ${JSON.stringify({ deployStatus: errMsg, deployComplete: true, deployError: true })}\n\n`);
              res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
              res.end();
              return;
            }
          }

          res.write(`data: ${JSON.stringify({ deployStatus: "Deploying to UiPath Orchestrator..." })}\n\n`);
          const deployRes = await fetch(`http://localhost:${process.env.PORT || 5000}/api/ideas/${ideaId}/push-uipath`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Cookie": req.headers.cookie || "",
            },
          });

          let finalEvent: any = null;

          if (deployRes.headers.get("content-type")?.includes("text/event-stream") && deployRes.body) {
            const reader = deployRes.body as AsyncIterable<Uint8Array>;
            const decoder = new TextDecoder();
            let sseBuffer = "";

            for await (const chunk of reader) {
              sseBuffer += decoder.decode(chunk, { stream: true });
              const lines = sseBuffer.split("\n");
              sseBuffer = lines.pop() || "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                try {
                  const event = JSON.parse(line.slice(6));
                  if (event.deployStatus && !event.deployComplete) {
                    res.write(`data: ${JSON.stringify({ deployStatus: event.deployStatus })}\n\n`);
                  }
                  if (event.deployComplete) {
                    finalEvent = event;
                  }
                } catch {}
              }
            }
          } else {
            try {
              const jsonData = await deployRes.json();
              finalEvent = { deployComplete: true, success: jsonData.success, result: jsonData };
            } catch {
              finalEvent = { deployComplete: true, success: false, error: "Invalid response from deploy endpoint" };
            }
          }

          if (!finalEvent) {
            finalEvent = { deployComplete: true, success: false, error: "Deploy stream ended unexpectedly without completion" };
          }

          if (finalEvent?.success) {
            const d = finalEvent.result?.details;
            let statusMsg = `Deployment complete — ${d?.packageId} v${d?.version}`;
            if (d?.processName) statusMsg += ` — Process "${d.processName}" ready.`;
            const deployResults: Array<{artifact: string; name: string; status: string; message: string}> = d?.deploymentResults || [];
            const deployReport = finalEvent.deployReport;

            const created = deployResults.filter((r: any) => r.status === "created");
            const existed = deployResults.filter((r: any) => r.status === "exists");
            const failed = deployResults.filter((r: any) => r.status === "failed");
            const skipped = deployResults.filter((r: any) => r.status === "skipped");
            const manual = deployResults.filter((r: any) => r.status === "manual");
            let verifiedSummary = `VERIFIED DEPLOYMENT RESULTS (use ONLY these facts when discussing this deployment):\n`;
            verifiedSummary += `- Package: ${d?.packageId} v${d?.version}\n`;
            verifiedSummary += `- Process: ${d?.processName || "N/A"}\n`;
            verifiedSummary += `- Created: ${created.length} (${created.map((r: any) => `${r.artifact}: ${r.name}`).join(", ") || "none"})\n`;
            verifiedSummary += `- Already existed: ${existed.length}\n`;
            if (failed.length > 0) {
              verifiedSummary += `- FAILED: ${failed.length} (${failed.map((r: any) => `${r.artifact}: ${r.name} — ${r.message}`).join("; ")})\n`;
            }
            if (skipped.length > 0) {
              verifiedSummary += `- SKIPPED (service unavailable): ${skipped.length} (${skipped.map((r: any) => `${r.artifact}: ${r.name} — ${r.message}`).join("; ")})\n`;
            }
            if (manual.length > 0) {
              verifiedSummary += `- MANUAL SETUP REQUIRED: ${manual.length} (${manual.map((r: any) => `${r.artifact}: ${r.name} — ${r.message}`).join("; ")})\n`;
            }

            await chatStorage.createMessage(ideaId, "system", verifiedSummary);

            if (savedStreamMsgId) {
              await chatStorage.updateMessageContent(savedStreamMsgId, statusMsg);
            }

            res.write(`data: ${JSON.stringify({ deployStatus: statusMsg, deployComplete: true, deployReport })}\n\n`);
          } else {
            const errMsg = `Deployment failed: ${finalEvent?.error || finalEvent?.result?.message || "Unknown error"}`;
            if (savedStreamMsgId) {
              await chatStorage.updateMessageContent(savedStreamMsgId, errMsg);
            } else {
              await chatStorage.createMessage(ideaId, "assistant", errMsg);
            }
            res.write(`data: ${JSON.stringify({ deployStatus: errMsg, deployComplete: true, deployError: true })}\n\n`);
          }
        } catch (deployErr: any) {
          const errMsg = `Deployment error: ${deployErr?.message || "Unknown error"}`;
          if (savedStreamMsgId) {
            await chatStorage.updateMessageContent(savedStreamMsgId, errMsg);
          } else {
            await chatStorage.createMessage(ideaId, "assistant", errMsg);
          }
          res.write(`data: ${JSON.stringify({ deployStatus: errMsg, deployComplete: true, deployError: true })}\n\n`);
        }
      }

      if (!skipAutoTransition) {
        const user = await storage.getUser(req.session.userId!);
        const transitionResult = await evaluateTransition(
          ideaId,
          req.session.userId!,
          user?.displayName || "Unknown",
          req.session.activeRole || "Process SME"
        );

        if (transitionResult.transitioned) {
          res.write(`data: ${JSON.stringify({ transition: transitionResult })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error: any) {
      if (heartbeat) clearInterval(heartbeat);
      console.error("Error in chat:", error?.message || error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process chat" });
      }
    }
  });
}
