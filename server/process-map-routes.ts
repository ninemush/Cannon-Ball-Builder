import type { Express, Request, Response } from "express";
import { processMapStorage } from "./process-map-storage";
import { storage } from "./storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { z } from "zod";

const toBeGenerationLocks = new Set<string>();

const createNodeSchema = z.object({
  viewType: z.string().default("as-is"),
  name: z.string().min(1),
  role: z.string().default(""),
  system: z.string().default(""),
  nodeType: z.enum(["task", "decision", "start", "end"]).default("task"),
  description: z.string().default(""),
  isPainPoint: z.boolean().default(false),
  isGhost: z.boolean().default(false),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  orderIndex: z.number().default(0),
});

const updateNodeSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  system: z.string().optional(),
  nodeType: z.enum(["task", "decision", "start", "end"]).optional(),
  description: z.string().optional(),
  isPainPoint: z.boolean().optional(),
  isGhost: z.boolean().optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  orderIndex: z.number().optional(),
});

const createEdgeSchema = z.object({
  viewType: z.string().default("as-is"),
  sourceNodeId: z.number(),
  targetNodeId: z.number(),
  label: z.string().default(""),
});

const updateEdgeSchema = z.object({
  label: z.string().optional(),
  sourceNodeId: z.number().optional(),
  targetNodeId: z.number().optional(),
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

export function registerProcessMapRoutes(app: Express): void {
  app.get("/api/ideas/:ideaId/process-map", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const viewType = (req.query.view as string) || "as-is";
    let [nodes, edges, approval] = await Promise.all([
      processMapStorage.getNodesByIdeaId(ideaId, viewType),
      processMapStorage.getEdgesByIdeaId(ideaId, viewType),
      processMapStorage.getApproval(ideaId, viewType),
    ]);

    if (viewType === "to-be" && nodes.length === 0) {
      const asIsApproval = await processMapStorage.getApproval(ideaId, "as-is");
      if (asIsApproval) {
        const recheck = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
        if (recheck.length === 0) {
          if (!toBeGenerationLocks.has(ideaId)) {
            toBeGenerationLocks.add(ideaId);
            try {
              const asIsNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
              const asIsEdges = await processMapStorage.getEdgesByIdeaId(ideaId, "as-is");
              if (asIsNodes.length > 0) {
                const idMap: Record<number, number> = {};
                for (const node of asIsNodes) {
                  const toBeNode = await processMapStorage.createNode({
                    ideaId,
                    name: node.name,
                    role: node.role,
                    system: node.system,
                    nodeType: node.nodeType,
                    description: node.isPainPoint
                      ? `[AUTOMATED] ${node.description || node.name}`
                      : node.description,
                    isGhost: node.isGhost,
                    isPainPoint: false,
                    viewType: "to-be",
                    orderIndex: node.orderIndex,
                    positionX: node.positionX,
                    positionY: node.positionY,
                  });
                  idMap[node.id] = toBeNode.id;
                }
                for (const edge of asIsEdges) {
                  if (idMap[edge.sourceNodeId] && idMap[edge.targetNodeId]) {
                    await processMapStorage.createEdge({
                      ideaId,
                      sourceNodeId: idMap[edge.sourceNodeId],
                      targetNodeId: idMap[edge.targetNodeId],
                      label: edge.label,
                      viewType: "to-be",
                    });
                  }
                }
              }
            } finally {
              toBeGenerationLocks.delete(ideaId);
            }
          }
          nodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
          edges = await processMapStorage.getEdgesByIdeaId(ideaId, "to-be");
        }
      }
    }

    return res.json({ nodes, edges, approval });
  });

  app.post("/api/ideas/:ideaId/process-nodes", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const parsed = createNodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

    const existing = await processMapStorage.findNodeByName(ideaId, parsed.data.name, parsed.data.viewType);
    if (existing) {
      const updated = await processMapStorage.updateNode(existing.id, {
        ...parsed.data,
        ideaId,
        isGhost: false,
      });
      return res.json(updated);
    }

    const node = await processMapStorage.createNode({ ...parsed.data, ideaId });
    return res.status(201).json(node);
  });

  app.patch("/api/process-nodes/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const node = await processMapStorage.getNodeById(id);
    if (!node) return res.status(404).json({ message: "Node not found" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const idea = await storage.getIdea(node.ideaId);
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    const activeRole = (req.session.activeRole || user.role) as string;
    if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
      return res.status(403).json({ message: "Access denied" });
    }
    const parsed = updateNodeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const updated = await processMapStorage.updateNode(id, parsed.data);
    return res.json(updated);
  });

  app.delete("/api/process-nodes/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const node = await processMapStorage.getNodeById(id);
    if (!node) return res.status(404).json({ message: "Node not found" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const idea = await storage.getIdea(node.ideaId);
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    const activeRole = (req.session.activeRole || user.role) as string;
    if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
      return res.status(403).json({ message: "Access denied" });
    }
    await processMapStorage.deleteNode(id);
    return res.json({ success: true });
  });

  app.post("/api/ideas/:ideaId/process-edges", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const parsed = createEdgeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const edge = await processMapStorage.createEdge({ ...parsed.data, ideaId });
    return res.status(201).json(edge);
  });

  app.patch("/api/process-edges/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const edge = await processMapStorage.getEdgeById(id);
    if (!edge) return res.status(404).json({ message: "Edge not found" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const idea = await storage.getIdea(edge.ideaId);
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    const activeRole = (req.session.activeRole || user.role) as string;
    if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
      return res.status(403).json({ message: "Access denied" });
    }
    const parsed = updateEdgeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });
    const updated = await processMapStorage.updateEdge(id, parsed.data);
    return res.json(updated);
  });

  app.delete("/api/process-edges/:id", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
    const id = parseInt(req.params.id as string);
    const edge = await processMapStorage.getEdgeById(id);
    if (!edge) return res.status(404).json({ message: "Edge not found" });
    const user = await storage.getUser(req.session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });
    const idea = await storage.getIdea(edge.ideaId);
    if (!idea) return res.status(404).json({ message: "Idea not found" });
    const activeRole = (req.session.activeRole || user.role) as string;
    if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
      return res.status(403).json({ message: "Access denied" });
    }
    await processMapStorage.deleteEdge(id);
    return res.json({ success: true });
  });

  app.post("/api/ideas/:ideaId/process-approvals", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const viewType = (req.body.viewType as string) || "as-is";

    const existingApproval = await processMapStorage.getApproval(ideaId, viewType);
    if (existingApproval) return res.status(400).json({ message: "Already approved" });

    const nodes = await processMapStorage.getNodesByIdeaId(ideaId, viewType);
    if (nodes.length < 3) return res.status(400).json({ message: "At least 3 nodes required" });

    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });

    const edges = await processMapStorage.getEdgesByIdeaId(ideaId, viewType);
    const snapshot = JSON.stringify({ nodes, edges });

    const approval = await processMapStorage.createApproval({
      ideaId,
      viewType,
      userId: user.id,
      userRole: (req.session.activeRole || user.role) as string,
      userName: user.displayName,
      snapshotJson: snapshot,
    });

    if (viewType === "as-is") {
      const existingToBe = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
      if (existingToBe.length === 0) {
        const idMap: Record<number, number> = {};
        for (const node of nodes) {
          const toBeNode = await processMapStorage.createNode({
            ideaId,
            name: node.name,
            role: node.role,
            system: node.system,
            nodeType: node.nodeType,
            description: node.isPainPoint
              ? `[AUTOMATED] ${node.description || node.name}`
              : node.description,
            isGhost: node.isGhost,
            isPainPoint: false,
            viewType: "to-be",
            orderIndex: node.orderIndex,
            positionX: node.positionX,
            positionY: node.positionY,
          });
          idMap[node.id] = toBeNode.id;
        }
        for (const edge of edges) {
          if (idMap[edge.sourceNodeId] && idMap[edge.targetNodeId]) {
            await processMapStorage.createEdge({
              ideaId,
              sourceNodeId: idMap[edge.sourceNodeId],
              targetNodeId: idMap[edge.targetNodeId],
              label: edge.label,
              viewType: "to-be",
            });
          }
        }
      }
    }

    await chatStorage.createMessage(
      ideaId,
      "assistant",
      viewType === "as-is"
        ? "Great \u2014 As-Is process map approved. I've generated a To-Be process map based on your current workflow. You can switch to the To-Be view to review and refine the optimized version. I'll also now prepare your Process Design Document."
        : "To-Be process map approved. The optimized workflow has been locked in."
    );

    return res.status(201).json(approval);
  });
}
