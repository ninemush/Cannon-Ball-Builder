import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { documentStorage } from "./document-storage";
import { processMapStorage } from "./process-map-storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { storage } from "./storage";
import { getPlatformCapabilities } from "./uipath-integration";
import { evaluateTransition } from "./stage-transition";
import { z } from "zod";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, BorderStyle,
  AlignmentType, ShadingType,
} from "docx";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const PDD_PROMPT = `The SME has approved the As-Is process map. Now generate a Process Design Document. The PDD must include: 1) Executive Summary, 2) Process Scope, 3) As-Is Process Description (narrative form, referencing the steps in the map), 4) To-Be Process Description (describe the optimised automated process — how the workflow will operate once automation is applied, referencing the To-Be map steps), 5) Pain Points and Inefficiencies, 6) Automation Opportunity Assessment, 7) Assumptions and Exceptions, 8) Data and System Requirements. Write this as a professional document, not a bullet list. Be specific and use the details from our conversation.

Format your response as sections separated by "## " headings. Each section should start with "## 1. Executive Summary", "## 2. Process Scope", etc.`;

const SDD_PROMPT = `(Legacy fallback — see SDD_PROSE_PROMPT and SDD_ARTIFACTS_PROMPT for active prompts)`;

const UIPATH_PROMPT = `Based on the approved SDD, generate a UiPath automation package structure. Output a JSON object with this shape: { "projectName": "string", "description": "string", "dependencies": ["array of UiPath package names"], "workflows": [{ "name": "string", "description": "string", "steps": [{ "activity": "string", "properties": {}, "notes": "string" }] }] }. Be as specific as possible. Return ONLY the JSON object, no other text.`;

const uipathPackageSchema = z.object({
  projectName: z.string().default("UiPathPackage"),
  description: z.string().default(""),
  dependencies: z.array(z.string()).default([]),
  workflows: z.array(z.object({
    name: z.string().default("Main"),
    description: z.string().default(""),
    steps: z.array(z.object({
      activity: z.string().default("Activity"),
      properties: z.record(z.unknown()).default({}),
      notes: z.string().default(""),
    })).default([]),
  })).default([]),
});

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
  "testCases": [
    { "name": "Test case name", "description": "What this tests", "steps": [{ "action": "Step action", "expected": "Expected result" }] }
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
- Include test cases covering key automation scenarios.
- Be comprehensive — this specification drives full automated deployment.

Output ONLY "## 9. Orchestrator & Platform Deployment Specification" followed by the fenced artifacts block and any brief supporting prose. Nothing else.`;
}

function parseArtifactBlock(text: string): string | null {
  const exactMatch = text.match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
  if (exactMatch) return exactMatch[0];

  const jsonFenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (jsonFenceMatch) {
    try {
      const parsed = JSON.parse(jsonFenceMatch[1].trim());
      if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers) {
        return "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
      }
    } catch { /* not valid JSON */ }
  }

  const rawJsonMatch = text.match(/\{[\s\S]*"queues"[\s\S]*\}/);
  if (rawJsonMatch) {
    try {
      const parsed = JSON.parse(rawJsonMatch[0]);
      if (parsed.queues || parsed.assets || parsed.machines || parsed.triggers) {
        return "```orchestrator_artifacts\n" + JSON.stringify(parsed, null, 2) + "\n```";
      }
    } catch { /* not valid JSON */ }
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
            content: `From this document, extract ALL Orchestrator and platform artifacts and output them as a single fenced block:\n\n\`\`\`orchestrator_artifacts\n{ "queues": [...], "assets": [...], "machines": [...], "triggers": [...], "storageBuckets": [...], "environments": [...], "actionCenter": [...], "documentUnderstanding": [...], "testCases": [...] }\n\`\`\`\n\nDocument:\n${combinedText.slice(0, 8000)}`
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
    if (doc.status === "approved") {
      return res.status(400).json({ message: "Already approved" });
    }

    const existingApproval = await documentStorage.getApproval(ideaId, doc.type);
    if (existingApproval) {
      if (existingApproval.documentId === docId) {
        return res.status(400).json({ message: "Already approved" });
      }
      await documentStorage.deleteApproval(ideaId, doc.type);
      const oldDoc = await documentStorage.getDocument(existingApproval.documentId);
      if (oldDoc && oldDoc.status === "approved") {
        await documentStorage.updateDocument(oldDoc.id, { status: "superseded" });
      }
    }

    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });

    await documentStorage.updateDocument(docId, { status: "approved" });

    const approval = await documentStorage.createApproval({
      documentId: docId,
      ideaId,
      docType: doc.type,
      userId: user.id,
      userRole: (req.session.activeRole || user.role) as string,
      userName: user.displayName,
    });

    if (doc.type === "PDD") {
      await chatStorage.createMessage(
        ideaId,
        "assistant",
        "PDD approved. I'll now generate the Solution Design Document (SDD)."
      );
    } else if (doc.type === "SDD") {
      let deployPrompt = "SDD approved. You can now generate the UiPath automation package.";
      try {
        const idea = await storage.getIdea(ideaId);
        const sddDoc = await documentStorage.getDocument(docId);
        let artifactSummary = "";
        if (sddDoc?.content) {
          const artifactMatch = sddDoc.content.match(/```orchestrator_artifacts\s*([\s\S]*?)```/);
          if (artifactMatch) {
            try {
              const artifacts = JSON.parse(artifactMatch[1]);
              const parts: string[] = [];
              if (artifacts.queues?.length) parts.push(`${artifacts.queues.length} queue(s)`);
              if (artifacts.assets?.length) parts.push(`${artifacts.assets.length} asset(s)`);
              if (artifacts.machines?.length) parts.push(`${artifacts.machines.length} machine template(s)`);
              if (artifacts.triggers?.length) parts.push(`${artifacts.triggers.length} trigger(s)`);
              if (artifacts.actionCenter?.length) parts.push(`${artifacts.actionCenter.length} Action Center catalog(s)`);
              if (artifacts.documentUnderstanding?.length) parts.push(`${artifacts.documentUnderstanding.length} DU project(s)`);
              if (artifacts.testCases?.length) parts.push(`${artifacts.testCases.length} test case(s)`);
              if (artifacts.folder) artifactSummary += `Target folder: **${artifacts.folder}**\n`;
              if (parts.length) artifactSummary += `Artifacts to provision: ${parts.join(", ")}`;
            } catch {}
          }
        }
        const ideaName = idea?.title || "this automation";
        deployPrompt = `**SDD approved** for **${ideaName}**.\n\nThe Solution Design Document has been approved and the automation is ready for deployment to UiPath Orchestrator.\n\n${artifactSummary ? artifactSummary + "\n\n" : ""}This will:\n1. Generate a UiPath NuGet package\n2. Upload it to Orchestrator\n3. Create the process\n4. Auto-provision all orchestrator artifacts (queues, assets, machine templates, triggers, and more)\n\nWould you like me to **push this to UiPath now**? Just say "Push to UiPath" or "Deploy" and I'll start the deployment immediately.`;
      } catch (promptErr: any) {
        console.error("[Document Routes] Failed to build SDD deploy prompt:", promptErr.message);
      }
      await chatStorage.createMessage(ideaId, "assistant", deployPrompt);
    }

    try {
      const user2 = await storage.getUser(req.session.userId!);
      const transitionResult = await evaluateTransition(
        ideaId,
        req.session.userId!,
        user2?.displayName || "Unknown",
        req.session.activeRole || "Process SME"
      );
      if (transitionResult.transitioned) {
        return res.json({ approval, document: { ...doc, status: "approved" }, transition: transitionResult });
      }
    } catch (transErr: any) {
      console.error("[Document Routes] Transition evaluation failed:", transErr?.message);
    }

    return res.json({ approval, document: { ...doc, status: "approved" } });
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
          return res.json({ package: existingData });
        } catch { /* fall through to regeneration */ }
      }

      const idea = await storage.getIdea(ideaId);
      if (!idea) return res.status(404).json({ message: "Idea not found" });

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

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemCtx,
        messages: [{ role: "user", content: UIPATH_PROMPT }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      const rawText = textBlock?.text || "{}";

      let packageJson;
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        packageJson = uipathPackageSchema.parse(parsed);
      } catch {
        packageJson = uipathPackageSchema.parse({ projectName: idea.title.replace(/\s+/g, "_"), description: idea.description });
      }

      await chatStorage.createMessage(
        ideaId,
        "assistant",
        `[UIPATH:${JSON.stringify(packageJson)}]`
      );

      return res.json({ package: packageJson });
    } catch (error) {
      console.error("Error generating UiPath package:", error);
      return res.status(500).json({ message: "Failed to generate UiPath package" });
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

      const archiverModule = require("archiver") as typeof import("archiver");
      const archive = (archiverModule as any)("zip", { zlib: { level: 9 } });

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${pkg.projectName || "UiPathPackage"}.zip"`);

      archive.pipe(res);

      const projectJson = {
        name: pkg.projectName || idea.title.replace(/\s+/g, "_"),
        description: pkg.description || idea.description,
        main: "Main.xaml",
        dependencies: Object.fromEntries(
          (pkg.dependencies || []).map((d: string) => [d, "*"])
        ),
        schemaVersion: "4.0",
        studioVersion: "23.10.0",
        projectVersion: "1.0.0",
        runtimeOptions: { autoDispose: false, netFrameworkLazyLoading: false },
      };
      archive.append(JSON.stringify(projectJson, null, 2), { name: "project.json" });

      const workflows = pkg.workflows || [];
      for (const wf of workflows) {
        const xamlContent = generateXamlStub(wf);
        archive.append(xamlContent, { name: `${wf.name || "Workflow"}.xaml` });
      }

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

      await archive.finalize();
    } catch (error) {
      console.error("Error generating ZIP:", error);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to generate ZIP" });
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

function generateXamlStub(workflow: any): string {
  const steps = workflow.steps || [];
  let activities = "";
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    activities += `
        <!-- Step ${i + 1}: ${step.activity || "Activity"} -->
        <!-- Notes: ${step.notes || "N/A"} -->
        <!-- Properties: ${JSON.stringify(step.properties || {})} -->
        <ui:Comment DisplayName="Step ${i + 1}: ${escapeXml(step.activity || "Activity")}" Text="${escapeXml(step.notes || "")}" />`;
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${workflow.name || "Workflow"}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(workflow.name || "Main Sequence")}">
    <Sequence.Variables />
    <!-- ${escapeXml(workflow.description || "Auto-generated workflow")} -->${activities}
  </Sequence>
</Activity>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
