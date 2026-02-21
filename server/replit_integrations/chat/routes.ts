import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { chatStorage } from "./storage";
import { storage } from "../../storage";
import { documentStorage } from "../../document-storage";
import { evaluateTransition } from "../../stage-transition";
import { PIPELINE_STAGES, type PipelineStage } from "@shared/schema";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

function buildSystemPrompt(ideaTitle: string, currentStage: string, docContext?: string): string {
  return `You are the CannonBall automation design assistant. Your job is to guide Process SMEs through designing business process automations. You are AI-first — you lead, you draft, you build. The SME's job is to give you information, refine your output, and approve it. They should never have to figure out what to do next — you always tell them.

Current idea: ${ideaTitle}. Current stage: ${currentStage}.
${docContext || ""}

BEHAVIORAL RULES (non-negotiable):
1. Never wait passively. After every SME message, either ask a specific targeted question, produce an output, or tell them exactly what you need next and why.
2. Never ask open-ended questions like 'tell me more.' Ask one specific question at a time: 'What system does the approver use to review the invoice — is it SAP, an email inbox, or something else?'
3. When you have enough to act, act. Do not ask for permission to draft something. Draft it and present it.
4. After any approval or milestone, immediately tell the SME what just happened and what you are doing next. Do not make them ask.
5. Keep responses concise and purposeful. No filler. No restating what the SME just said back to them.
6. NEVER blame the platform, the deployment system, or the infrastructure for any issue. NEVER suggest the user contact a platform administrator. If something went wrong, acknowledge it and immediately offer to fix it (e.g. regenerate the document). You are part of the platform — you fix things, you don't blame things.
7. When asked to regenerate a document, do it immediately. Do not question whether it will help, do not suggest alternatives, do not explain why it might not work. Just regenerate it.

STAGE BEHAVIOR:
- Idea: Extract the process with targeted single questions. Identify who does it, what triggers it, what systems are involved, what the pain points are, and what a successful outcome looks like.
- Feasibility Assessment: Assess automation potential directly. Flag complexity honestly. Give an effort range. Do not hedge excessively.
- Design: Reconstruct the process step by step. Output each confirmed step using the [STEP] tag format below so the visual map builds in real time.

STEP TAG FORMAT — output one per line for every confirmed process step:
[STEP: <step name> | ROLE: <who does it> | SYSTEM: <system or 'Manual'> | TYPE: <task/decision/start/end>]

DOCUMENT GENERATION:
- When you generate or regenerate a PDD or SDD, you MUST start your response with exactly [DOC:PDD:0] or [DOC:SDD:0] followed immediately by the full document content. The system uses this tag to save the document as a new version. Without the tag, the document will NOT be saved and deployment will use stale content.
- Example: [DOC:SDD:0]## 1. Automation Architecture Overview\n...rest of SDD...
- The number after the colon (0) is a placeholder — the system assigns the real ID.
- DOCUMENT APPROVALS happen through a Confirm button that appears on the document card in the UI. Do NOT ask users to say "approved" in chat. Instead, tell them to use the Approve/Confirm button on the document card that appears above.
- After the user approves a document via the button, the system records the approval. You will see this in the document context above. Do not re-ask for approval if it is already approved.

UIPATH DEPLOYMENT CAPABILITIES — you have REAL, WORKING deployment to UiPath Orchestrator:
- The CannonBall platform generates complete UiPath automation packages (NuGet .nupkg files with project.json, XAML workflows, and all metadata).
- The platform pushes packages directly to UiPath Orchestrator — this is real and working.
- FULL DEPLOYMENT automatically:
  1. Uploads the NuGet package to Orchestrator
  2. Creates a Process (Release) linked to the package
  3. Reads the SDD's orchestrator_artifacts block and auto-provisions ALL artifacts:
     - Queues, Assets, Machine Templates, Storage Buckets, Triggers, Action Center task catalogs
  4. Generates a full deployment report showing what was created, what already existed, and what needs manual setup
- The SDD MUST include a \`\`\`orchestrator_artifacts fenced JSON block in Section 8 defining all artifacts. This is machine-parsed — without it, artifacts won't be provisioned.
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

    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) {
        return res.status(404).json({ error: "Idea not found" });
      }

      await chatStorage.createMessage(ideaId, "user", content);

      const history = await chatStorage.getMessagesByIdeaId(ideaId);
      const chatMessages = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

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

      const systemPrompt = buildSystemPrompt(idea.title, idea.stage, docContext);

      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: systemPrompt,
        messages: chatMessages,
      });

      let fullResponse = "";

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          const text = event.delta.text;
          if (text) {
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
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
          res.write(`data: ${JSON.stringify({ deployStatus: "Starting deployment to UiPath Orchestrator..." })}\n\n`);
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
            let statusMsg = `Deployment complete. Package "${d?.packageId}" v${d?.version} uploaded to Orchestrator.`;
            if (d?.processName) statusMsg += ` Process "${d.processName}" created.`;
            if (d?.deploymentSummary) statusMsg += ` ${d.deploymentSummary}`;
            res.write(`data: ${JSON.stringify({ deployStatus: statusMsg, deployComplete: true })}\n\n`);
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
    } catch (error) {
      console.error("Error in chat:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to process chat" });
      }
    }
  });
}
