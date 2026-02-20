import type { Express, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { documentStorage } from "./document-storage";
import { processMapStorage } from "./process-map-storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { storage } from "./storage";
import { z } from "zod";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const PDD_PROMPT = `The SME has approved the As-Is process map. Now generate a Process Design Document. The PDD must include: 1) Executive Summary, 2) Process Scope, 3) As-Is Process Description (narrative form, referencing the steps in the map), 4) Pain Points and Inefficiencies, 5) Automation Opportunity Assessment, 6) Assumptions and Exceptions, 7) Data and System Requirements. Write this as a professional document, not a bullet list. Be specific and use the details from our conversation.

Format your response as sections separated by "## " headings. Each section should start with "## 1. Executive Summary", "## 2. Process Scope", etc.`;

const SDD_PROMPT = `The SME has approved the PDD. Now generate a Solution Design Document for UiPath automation. Include: 1) Automation Architecture Overview, 2) Process Components and Workflow Breakdown, 3) UiPath Activities and Packages Required, 4) Integration Points and API/System Connections, 5) Exception Handling Strategy, 6) Security Considerations, 7) Test Strategy. Be specific. Reference UiPath best practices. This will be used to generate the automation package.

Format your response as sections separated by "## " headings. Each section should start with "## 1. Automation Architecture Overview", etc.`;

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

async function generateDocument(ideaId: string, docType: string): Promise<string> {
  const idea = await storage.getIdea(ideaId);
  if (!idea) throw new Error("Idea not found");

  const history = await chatStorage.getMessagesByIdeaId(ideaId);
  const chatMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  let contextPrompt = "";
  if (docType === "PDD") {
    const nodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
    const edges = await processMapStorage.getEdgesByIdeaId(ideaId, "as-is");
    contextPrompt = `\n\nHere is the approved As-Is process map:\n${JSON.stringify({ nodes, edges }, null, 2)}`;
  } else if (docType === "SDD") {
    const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
    if (pdd) {
      contextPrompt = `\n\nHere is the approved PDD:\n${pdd.content}`;
    }
  }

  const prompt = docType === "PDD" ? PDD_PROMPT : docType === "SDD" ? SDD_PROMPT : UIPATH_PROMPT;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: `You are a professional automation consultant generating formal documents for the "${idea.title}" project. Be specific, thorough, and use details from the conversation history.${contextPrompt}`,
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
    } catch (error) {
      console.error(`Error generating ${type}:`, error);
      return res.status(500).json({ message: `Failed to generate ${type}` });
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
      return res.status(400).json({ message: "Already approved" });
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
      await chatStorage.createMessage(
        ideaId,
        "assistant",
        "SDD approved. You can now generate the UiPath automation package."
      );
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
      const content = textBlock?.text || "";

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

      const idea = await storage.getIdea(ideaId);
      if (!idea) return res.status(404).json({ message: "Idea not found" });

      const history = await chatStorage.getMessagesByIdeaId(ideaId);
      const chatMessages = history.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: `You are a UiPath automation architect. Generate a detailed package structure based on the approved SDD.\n\nSDD:\n${sdd.content}`,
        messages: [...chatMessages, { role: "user", content: UIPATH_PROMPT }],
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
