import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { chatStorage } from "./storage";
import { storage } from "../../storage";
import { documentStorage } from "../../document-storage";
import { processMapStorage } from "../../process-map-storage";
import { evaluateTransition } from "../../stage-transition";
import { PIPELINE_STAGES, type PipelineStage } from "@shared/schema";
import { probeServiceAvailability, type ServiceAvailabilityMap } from "../../uipath-integration";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function detectApprovalIntent(userMessage: string): "PDD" | "SDD" | null {
  const msg = userMessage.toLowerCase().trim();
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
  const hasApprovalIntent = approvePatterns.some(p => p.test(msg));
  if (!hasApprovalIntent) return null;

  if (/\bsdd\b/.test(msg) || /\bsolution\s+design\b/.test(msg)) return "SDD";
  if (/\bpdd\b/.test(msg) || /\bprocess\s+design\b/.test(msg)) return "PDD";

  if (/\bpdd\b/i.test(userMessage)) return "PDD";
  if (/\bsdd\b/i.test(userMessage)) return "SDD";

  return "PDD";
}

function buildSystemPrompt(ideaTitle: string, currentStage: string, docContext?: string, serviceAvailability?: ServiceAvailabilityMap | null): string {
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
    if (serviceAvailability.environments) available.push("Environments");
    else unavailable.push("Environments (deprecated on modern folders — machine templates used instead)");
    if (serviceAvailability.triggers) available.push("Triggers (queue and time-based)");
    else unavailable.push("Triggers API");

    serviceContext = `\n\nUIPath SERVICE AVAILABILITY (probed from the connected Orchestrator):
- AVAILABLE: ${available.join(", ")}
- NOT AVAILABLE: ${unavailable.length > 0 ? unavailable.join(", ") : "All services available"}`;
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
- For images/videos where content cannot be extracted as text, ask the user to describe what's shown.

STAGE BEHAVIOR:
- Idea: Extract the process with targeted single questions. Identify who does it, what triggers it, what systems are involved, what the pain points are, and what a successful outcome looks like.
- Feasibility Assessment: Assess automation potential directly. Flag complexity honestly. Give an effort range. Do not hedge excessively.
- Design: Reconstruct the process step by step. Output each confirmed step using the [STEP] tag format below so the visual map builds in real time.

STEP TAG FORMAT — output one per line for every confirmed process step:
[STEP: <step name> | ROLE: <who does it> | SYSTEM: <system or 'Manual'> | TYPE: <task/decision/start/end> | FROM: <parent step name> | LABEL: <edge label>]

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
- Every step (except the very first Start node) MUST have a FROM field pointing to its parent step by exact name.
- Decision nodes MUST have 2 or more children. Each child step FROM the decision with a LABEL like "Yes", "No", "Approved", "Rejected", "Pass", "Fail", "Above Threshold", "Below Threshold", etc.
- THREE-WAY DECISIONS are common: "Claim Decision" → Approved / Rejected / More Info Required. Output 3 child steps each with FROM pointing to the decision and different LABELs.
- LOOPS: To create a loop, have a step's FROM point BACK to an earlier step. Example: "Customer Resubmits" FROM "Request Missing Docs", then a new check step FROM "Customer Resubmits" that loops back to the completeness decision.
- MERGE POINTS: Branches can converge. After parallel paths complete, a single step can FROM the last step of one branch, and another edge connects from the other branch's last step.
- PARALLEL PATHS: If two tasks happen simultaneously after a step, both FROM the same parent (no decision needed — just two children with no LABEL).
- MULTIPLE END NODES: Use separate End nodes for each terminal outcome (e.g., "Claim Approved End", "Claim Rejected End", "Claim Withdrawn End").
- NEVER output all steps in a linear chain when the process has decisions. EVERY process has decisions — insurance claims, invoice processing, onboarding, purchase orders, IT service requests — ALL of them branch.

DUPLICATE PREVENTION (CRITICAL):
- EXACTLY ONE Start node per process. Never output multiple Start nodes.
- Each step name must be unique. Never repeat the same step name or a near-identical variant (e.g., do NOT output both "Validate Documents" and "Document Validation" — pick one).
- When adding steps to an existing map, check what already exists. Reference existing step names in FROM fields — do not recreate them.
- If regenerating a full process, output a single coherent graph. Do not output leftover steps from a previous version.
- End nodes: use distinct names for genuinely different outcomes (e.g., "Approved End", "Rejected End"). Do NOT create multiple end nodes for the same outcome.

EXAMPLE 1 — Insurance claim with 3-way decision and loop:
[STEP: Customer Submits Claim | ROLE: Customer | SYSTEM: Claims Portal | TYPE: start]
[STEP: Receive & Log Claim | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: Customer Submits Claim]
[STEP: Document Complete? | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: decision | FROM: Receive & Log Claim]
[STEP: Request Missing Docs | ROLE: Claims Officer | SYSTEM: Email | TYPE: task | FROM: Document Complete? | LABEL: No]
[STEP: Customer Resubmits | ROLE: Customer | SYSTEM: Claims Portal | TYPE: task | FROM: Request Missing Docs]
[STEP: Re-check Documents | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: Customer Resubmits]
[STEP: Policy Validation | ROLE: System | SYSTEM: Claims App | TYPE: task | FROM: Document Complete? | LABEL: Yes]
[STEP: Fraud Check | ROLE: System | SYSTEM: Fraud Detection | TYPE: task | FROM: Policy Validation]
[STEP: Fraud Detected? | ROLE: System | SYSTEM: Fraud Detection | TYPE: decision | FROM: Fraud Check]
[STEP: Flag for Investigation | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: Fraud Detected? | LABEL: Yes]
[STEP: Claim Flagged End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: Flag for Investigation]
[STEP: Assess Claim Value | ROLE: Claims Officer | SYSTEM: Claims App | TYPE: task | FROM: Fraud Detected? | LABEL: No]
[STEP: Claim Decision | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: decision | FROM: Assess Claim Value]
[STEP: Full Approval | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: task | FROM: Claim Decision | LABEL: Approved]
[STEP: Process Payment | ROLE: Finance | SYSTEM: ERP | TYPE: task | FROM: Full Approval]
[STEP: Claim Approved End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: Process Payment]
[STEP: Partial Approval | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: task | FROM: Claim Decision | LABEL: Partial]
[STEP: Amended Payment | ROLE: Finance | SYSTEM: ERP | TYPE: task | FROM: Partial Approval]
[STEP: Partial Approval End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: Amended Payment]
[STEP: Reject Claim | ROLE: Claims Manager | SYSTEM: Claims App | TYPE: task | FROM: Claim Decision | LABEL: Rejected]
[STEP: Send Rejection Notice | ROLE: System | SYSTEM: Email | TYPE: task | FROM: Reject Claim]
[STEP: Claim Rejected End | ROLE: System | SYSTEM: Claims App | TYPE: end | FROM: Send Rejection Notice]

EXAMPLE 2 — Invoice processing with approval loop:
[STEP: Invoice Received | ROLE: System | SYSTEM: Email/Portal | TYPE: start]
[STEP: Extract Invoice Data | ROLE: System | SYSTEM: Document Understanding | TYPE: task | FROM: Invoice Received]
[STEP: Data Valid? | ROLE: System | SYSTEM: ERP | TYPE: decision | FROM: Extract Invoice Data]
[STEP: Flag for Manual Entry | ROLE: AP Clerk | SYSTEM: ERP | TYPE: task | FROM: Data Valid? | LABEL: No]
[STEP: Three-Way Match | ROLE: System | SYSTEM: ERP | TYPE: task | FROM: Data Valid? | LABEL: Yes]
[STEP: Match OK? | ROLE: System | SYSTEM: ERP | TYPE: decision | FROM: Three-Way Match]
[STEP: Route to Exception Queue | ROLE: System | SYSTEM: ERP | TYPE: task | FROM: Match OK? | LABEL: No]
[STEP: Amount Within Limit? | ROLE: System | SYSTEM: ERP | TYPE: decision | FROM: Match OK? | LABEL: Yes]
[STEP: Auto-Approve | ROLE: System | SYSTEM: ERP | TYPE: task | FROM: Amount Within Limit? | LABEL: Yes]
[STEP: Manager Approval | ROLE: Manager | SYSTEM: Action Center | TYPE: task | FROM: Amount Within Limit? | LABEL: No]
[STEP: Approved? | ROLE: Manager | SYSTEM: Action Center | TYPE: decision | FROM: Manager Approval]
[STEP: Schedule Payment | ROLE: System | SYSTEM: ERP | TYPE: task | FROM: Approved? | LABEL: Yes]
[STEP: Return to Requester | ROLE: System | SYSTEM: Email | TYPE: task | FROM: Approved? | LABEL: No]
[STEP: Payment Complete End | ROLE: System | SYSTEM: ERP | TYPE: end | FROM: Schedule Payment]

DOCUMENT GENERATION:
- When you generate or regenerate a PDD or SDD, you MUST start your response with exactly [DOC:PDD:0] or [DOC:SDD:0] followed immediately by the full document content. The system uses this tag to save the document as a new version. Without the tag, the document will NOT be saved and deployment will use stale content.
- Example: [DOC:SDD:0]## 1. Automation Architecture Overview\\n...rest of SDD...
- The number after the colon (0) is a placeholder — the system assigns the real ID.
- DOCUMENT APPROVALS happen through a Confirm button that appears on the document card in the UI. Do NOT ask users to say "approved" in chat. Instead, tell them to use the Approve/Confirm button on the document card that appears above.
- After the user approves a document via the button, the system records the approval. You will see this in the document context above. Do not re-ask for approval if it is already approved.

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

    const { ideaId, content } = req.body;
    if (!ideaId || !content) {
      return res.status(400).json({ error: "ideaId and content are required" });
    }

    let heartbeat: ReturnType<typeof setInterval> | null = null;
    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      await chatStorage.createMessage(ideaId, "user", content);

      const approvalIntent = detectApprovalIntent(content);
      let chatApprovalDone = false;
      if (approvalIntent) {
        try {
          const latestDoc = await documentStorage.getLatestDocument(ideaId, approvalIntent);
          if (latestDoc && latestDoc.status !== "approved") {
            const existingApproval = await documentStorage.getApproval(ideaId, approvalIntent);
            if (!existingApproval) {
              const approveUser = await storage.getUser(req.session.userId!);
              if (approveUser) {
                await documentStorage.updateDocument(latestDoc.id, { status: "approved" });
                await documentStorage.createApproval({
                  documentId: latestDoc.id,
                  ideaId,
                  docType: approvalIntent,
                  userId: approveUser.id,
                  userRole: (req.session.activeRole || approveUser.role) as string,
                  userName: approveUser.displayName,
                });
                await chatStorage.createMessage(ideaId, "system",
                  `[CHAT_APPROVAL] ${approvalIntent} v${latestDoc.version} approved by ${approveUser.displayName} via chat confirmation.`
                );
                chatApprovalDone = true;
                console.log(`[Chat] ${approvalIntent} approved via chat by ${approveUser.displayName}`);
                try {
                  await evaluateTransition(ideaId, req.session.userId!, approveUser.displayName, req.session.activeRole || "Process SME");
                } catch {}
              }
            }
          }
        } catch (approvalErr: any) {
          console.error("[Chat] Chat-based approval failed:", approvalErr?.message);
        }
      }

      const history = await chatStorage.getMessagesByIdeaId(ideaId);
      const filteredHistory = history.filter((m) => m.role === "user" || m.role === "assistant");
      const merged: { role: "user" | "assistant"; content: string }[] = [];
      for (const m of filteredHistory) {
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
          const stepList = existingNodes.map(n => `${n.name} (${n.nodeType})`).join(", ");
          docContext += `\nEXISTING AS-IS MAP (${existingNodes.length} steps): ${stepList}\nDo NOT recreate these steps. Reference them by exact name in FROM fields when adding new steps.`;
        }
      } catch (e) { /* non-critical */ }

      let serviceAvailability: ServiceAvailabilityMap | null = null;
      const sddRelevantStages = ["Design", "Solution Design", "Build", "Test", "UAT", "Deployment"];
      if (sddRelevantStages.some(s => idea.stage.toLowerCase().includes(s.toLowerCase()))) {
        try {
          serviceAvailability = await probeServiceAvailability();
          if (serviceAvailability.configured) {
            console.log(`[Chat] Service probe: AC=${serviceAvailability.actionCenter}, TM=${serviceAvailability.testManager}, DU=${serviceAvailability.documentUnderstanding}, Env=${serviceAvailability.environments}, Trig=${serviceAvailability.triggers}`);
          }
        } catch (e) { /* non-critical — proceed without probe */ }
      }

      const systemPrompt = buildSystemPrompt(idea.title, idea.stage, docContext, serviceAvailability);

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: chatMessages,
      });

      let fullResponse = "";
      let stopReason = "";

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

      await chatStorage.createMessage(ideaId, "assistant", cleanedResponse);

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
          const deployData = await deployRes.json();
          if (deployData.success) {
            const d = deployData.details;
            let statusMsg = `Deployment complete — ${d?.packageId} v${d?.version}`;
            if (d?.processName) statusMsg += ` — Process "${d.processName}" ready.`;
            const deployResults: Array<{artifact: string; name: string; status: string; message: string}> = d?.deploymentResults || [];
            const deployReport = {
              packageId: d?.packageId,
              version: d?.version,
              processName: d?.processName,
              orgName: d?.orgName,
              tenantName: d?.tenantName,
              folderName: d?.folderName,
              results: deployResults,
              summary: d?.deploymentSummary || "",
            };

            const created = deployResults.filter(r => r.status === "created");
            const existed = deployResults.filter(r => r.status === "exists");
            const failed = deployResults.filter(r => r.status === "failed");
            const skipped = deployResults.filter(r => r.status === "skipped");
            let verifiedSummary = `VERIFIED DEPLOYMENT RESULTS (use ONLY these facts when discussing this deployment):\n`;
            verifiedSummary += `- Package: ${d?.packageId} v${d?.version}\n`;
            verifiedSummary += `- Process: ${d?.processName || "N/A"}\n`;
            verifiedSummary += `- Created: ${created.length} (${created.map(r => `${r.artifact}: ${r.name}`).join(", ") || "none"})\n`;
            verifiedSummary += `- Already existed: ${existed.length}\n`;
            if (failed.length > 0) {
              verifiedSummary += `- FAILED: ${failed.length} (${failed.map(r => `${r.artifact}: ${r.name} — ${r.message}`).join("; ")})\n`;
            }
            if (skipped.length > 0) {
              verifiedSummary += `- SKIPPED (service unavailable): ${skipped.length} (${skipped.map(r => `${r.artifact}: ${r.name} — ${r.message}`).join("; ")})\n`;
            }

            await chatStorage.createMessage(ideaId, "system", verifiedSummary);

            const deployMsgContent = `${statusMsg}\n[DEPLOY_REPORT:${JSON.stringify(deployReport)}]`;
            await chatStorage.createMessage(ideaId, "assistant", deployMsgContent);

            res.write(`data: ${JSON.stringify({ deployStatus: statusMsg, deployComplete: true, deployReport })}\n\n`);
          } else {
            const errMsg = `Deployment failed: ${deployData.message}`;
            await chatStorage.createMessage(ideaId, "assistant", errMsg);
            res.write(`data: ${JSON.stringify({ deployStatus: errMsg, deployComplete: true, deployError: true })}\n\n`);
          }
        } catch (deployErr: any) {
          const errMsg = `Deployment error: ${deployErr?.message || "Unknown error"}`;
          await chatStorage.createMessage(ideaId, "assistant", errMsg);
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
