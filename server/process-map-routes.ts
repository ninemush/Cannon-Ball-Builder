import type { Express, Request, Response } from "express";
import { processMapStorage } from "./process-map-storage";
import { documentStorage } from "./document-storage";
import { storage } from "./storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { evaluateTransition } from "./stage-transition";
import { z } from "zod";
import { db } from "./db";
import { sql } from "drizzle-orm";

const toBeGenerationLocks = new Set<string>();
const bulkWriteLocks = new Map<string, Promise<void>>();

async function consolidateDuplicateEndNodes(ideaId?: string, viewType?: string): Promise<number> {
  let totalMerged = 0;
  try {
    const query = (ideaId && viewType)
      ? sql`
        SELECT idea_id, view_type, LOWER(TRIM(name)) as norm_name,
               array_agg(id ORDER BY id) as ids
        FROM process_nodes
        WHERE node_type = 'end' AND idea_id = ${ideaId} AND view_type = ${viewType}
        GROUP BY idea_id, view_type, LOWER(TRIM(name))
        HAVING COUNT(*) > 1
      `
      : sql`
        SELECT idea_id, view_type, LOWER(TRIM(name)) as norm_name,
               array_agg(id ORDER BY id) as ids
        FROM process_nodes
        WHERE node_type = 'end'
        GROUP BY idea_id, view_type, LOWER(TRIM(name))
        HAVING COUNT(*) > 1
      `;

    const result = await db.execute(query);
    const rows = result.rows || result || [];
    if (!Array.isArray(rows)) return 0;

    for (const row of rows) {
      const ids: number[] = Array.isArray(row.ids) ? row.ids : [];
      if (ids.length < 2) continue;
      const keepId = ids[0];
      const deleteIds = ids.slice(1);

      for (const delId of deleteIds) {
        await db.execute(sql`
          UPDATE process_edges SET target_node_id = ${keepId}
          WHERE target_node_id = ${delId}
            AND source_node_id NOT IN (
              SELECT source_node_id FROM process_edges WHERE target_node_id = ${keepId}
            )
        `);
        await db.execute(sql`DELETE FROM process_edges WHERE target_node_id = ${delId}`);
        await db.execute(sql`DELETE FROM process_edges WHERE source_node_id = ${delId}`);
        await db.execute(sql`DELETE FROM process_nodes WHERE id = ${delId}`);
        totalMerged++;
      }
    }
  } catch (err: any) {
    console.error("[ProcessMap] End node consolidation error:", err?.message);
  }
  return totalMerged;
}

async function cleanupDuplicateProcessNodes(): Promise<void> {
  try {
    let totalDeleted = 0;

    const dupResult = await db.execute(sql`
      SELECT idea_id, view_type, node_type, LOWER(TRIM(name)) as norm_name, COUNT(*) as cnt,
             array_agg(id ORDER BY id) as ids
      FROM process_nodes
      WHERE view_type IN ('to-be', 'sdd')
      GROUP BY idea_id, view_type, node_type, LOWER(TRIM(name))
      HAVING COUNT(*) > 1
    `);

    const dupRows = dupResult.rows || dupResult || [];
    if (Array.isArray(dupRows)) {
      for (const row of dupRows) {
        const ids: number[] = Array.isArray(row.ids) ? row.ids : [];
        if (ids.length < 2) continue;
        const deleteIds = ids.slice(1);
        for (const delId of deleteIds) {
          await db.execute(sql`DELETE FROM process_edges WHERE source_node_id = ${delId} OR target_node_id = ${delId}`);
          await db.execute(sql`DELETE FROM process_nodes WHERE id = ${delId}`);
          totalDeleted++;
        }
      }
    }

    const endMerged = await consolidateDuplicateEndNodes();
    totalDeleted += endMerged;

    const suffixResult = await db.execute(sql`
      SELECT id, idea_id, view_type, name
      FROM process_nodes
      WHERE node_type = 'end'
        AND (LOWER(TRIM(name)) ~ ' [b-z]$' OR LOWER(TRIM(name)) ~ ' \d+$')
    `);
    const suffixRows = suffixResult.rows || suffixResult || [];
    if (Array.isArray(suffixRows)) {
      for (const row of suffixRows) {
        const baseName = (row.name as string).replace(/\s+[B-Zb-z]$/, '').replace(/\s+\d+$/, '').trim();
        const baseResult = await db.execute(sql`
          SELECT id FROM process_nodes
          WHERE idea_id = ${row.idea_id} AND view_type = ${row.view_type}
            AND node_type = 'end' AND LOWER(TRIM(name)) = ${baseName.toLowerCase().trim()}
          LIMIT 1
        `);
        const baseRows = baseResult.rows || baseResult || [];
        if (Array.isArray(baseRows) && baseRows.length > 0) {
          const keepId = baseRows[0].id;
          await db.execute(sql`
            UPDATE process_edges SET target_node_id = ${keepId}
            WHERE target_node_id = ${row.id}
          `);
          await db.execute(sql`DELETE FROM process_edges WHERE source_node_id = ${row.id}`);
          await db.execute(sql`DELETE FROM process_nodes WHERE id = ${row.id}`);
          totalDeleted++;
        }
      }
    }

    const multiStartResult = await db.execute(sql`
      SELECT idea_id, view_type, array_agg(id ORDER BY id) as ids
      FROM process_nodes
      WHERE node_type = 'start'
      GROUP BY idea_id, view_type
      HAVING COUNT(*) > 1
    `);
    const multiStartRows = multiStartResult.rows || multiStartResult || [];
    if (Array.isArray(multiStartRows)) {
      for (const row of multiStartRows) {
        const ids: number[] = Array.isArray(row.ids) ? row.ids : [];
        if (ids.length < 2) continue;
        const extraStartIds = ids.slice(1);
        for (const startId of extraStartIds) {
          const reachable = await db.execute(sql`
            WITH RECURSIVE tree AS (
              SELECT ${startId}::int AS node_id
              UNION
              SELECT e.target_node_id AS node_id
              FROM process_edges e
              INNER JOIN tree t ON e.source_node_id = t.node_id
            )
            SELECT node_id FROM tree
          `);
          const treeRows = reachable.rows || reachable || [];
          const keepStart = ids[0];
          if (Array.isArray(treeRows)) {
            const treeNodeIds = treeRows.map((r: any) => r.node_id as number);
            const alsoReachableFromKept = await db.execute(sql`
              WITH RECURSIVE tree AS (
                SELECT ${keepStart}::int AS node_id
                UNION
                SELECT e.target_node_id AS node_id
                FROM process_edges e
                INNER JOIN tree t ON e.source_node_id = t.node_id
              )
              SELECT node_id FROM tree
            `);
            const keptTreeIds = new Set((alsoReachableFromKept.rows || []).map((r: any) => r.node_id as number));
            for (const nodeId of treeNodeIds) {
              if (nodeId === startId) continue;
              if (keptTreeIds.has(nodeId)) continue;
              await db.execute(sql`DELETE FROM process_edges WHERE source_node_id = ${nodeId} OR target_node_id = ${nodeId}`);
              await db.execute(sql`DELETE FROM process_nodes WHERE id = ${nodeId}`);
              totalDeleted++;
            }
            await db.execute(sql`DELETE FROM process_edges WHERE source_node_id = ${startId} OR target_node_id = ${startId}`);
            await db.execute(sql`DELETE FROM process_nodes WHERE id = ${startId}`);
            totalDeleted++;
          }
        }
      }
    }

    const orphanResult = await db.execute(sql`
      SELECT n.id, n.idea_id, n.view_type, n.name, n.node_type
      FROM process_nodes n
      LEFT JOIN process_edges e_in ON n.id = e_in.target_node_id
      LEFT JOIN process_edges e_out ON n.id = e_out.source_node_id
      WHERE e_in.id IS NULL AND e_out.id IS NULL AND n.node_type != 'start'
    `);

    const orphanRows = orphanResult.rows || orphanResult || [];
    if (Array.isArray(orphanRows)) {
      for (const row of orphanRows) {
        await db.execute(sql`DELETE FROM process_nodes WHERE id = ${row.id}`);
        totalDeleted++;
      }
    }

    const agentDowngrade = await db.execute(sql`
      UPDATE process_nodes
      SET node_type = CASE
        WHEN node_type = 'agent-task' THEN 'task'
        WHEN node_type = 'agent-decision' THEN 'decision'
        WHEN node_type = 'agent-loop' THEN 'task'
      END
      WHERE view_type = 'as-is'
        AND node_type IN ('agent-task', 'agent-decision', 'agent-loop')
    `);
    const downgraded = (agentDowngrade as any).rowCount || 0;
    if (downgraded > 0) {
      console.log(`[ProcessMap] Startup: Downgraded ${downgraded} agent node(s) in as-is views to standard types.`);
    }

    const viewsResult = await db.execute(sql`
      SELECT DISTINCT idea_id, view_type FROM process_nodes
    `);
    const viewsRows = viewsResult.rows || viewsResult || [];
    if (Array.isArray(viewsRows)) {
      for (const row of viewsRows) {
        try {
          await cleanupUnreachableNodes(row.idea_id as string, row.view_type as string);
        } catch {}
      }
    }

    if (totalDeleted > 0) {
      console.log(`[ProcessMap] Cleanup: Removed ${totalDeleted} duplicate/orphaned nodes.`);
    }
  } catch (err: any) {
    console.error("[ProcessMap] Cleanup error:", err?.message);
  }
}

async function consolidateSuffixEndNodes(ideaId: string, viewType: string): Promise<number> {
  let merged = 0;
  try {
    const suffixResult = await db.execute(sql`
      SELECT id, idea_id, view_type, name
      FROM process_nodes
      WHERE node_type = 'end' AND idea_id = ${ideaId} AND view_type = ${viewType}
        AND (LOWER(TRIM(name)) ~ ' [b-z]$' OR LOWER(TRIM(name)) ~ ' \d+$')
    `);
    const rows = suffixResult.rows || suffixResult || [];
    if (Array.isArray(rows)) {
      for (const row of rows) {
        const baseName = (row.name as string).replace(/\s+[B-Zb-z]$/, '').replace(/\s+\d+$/, '').trim();
        const baseResult = await db.execute(sql`
          SELECT id FROM process_nodes
          WHERE idea_id = ${row.idea_id} AND view_type = ${row.view_type}
            AND node_type = 'end' AND LOWER(TRIM(name)) = ${baseName.toLowerCase().trim()}
          LIMIT 1
        `);
        const baseRows = baseResult.rows || baseResult || [];
        if (Array.isArray(baseRows) && baseRows.length > 0) {
          const keepId = baseRows[0].id;
          await db.execute(sql`
            UPDATE process_edges SET target_node_id = ${keepId}
            WHERE target_node_id = ${row.id}
              AND source_node_id NOT IN (SELECT source_node_id FROM process_edges WHERE target_node_id = ${keepId})
          `);
          await db.execute(sql`DELETE FROM process_edges WHERE target_node_id = ${row.id}`);
          await db.execute(sql`DELETE FROM process_edges WHERE source_node_id = ${row.id}`);
          await db.execute(sql`DELETE FROM process_nodes WHERE id = ${row.id}`);
          merged++;
        }
      }
    }
  } catch (err: any) {
    console.error("[ProcessMap] Suffix end node cleanup error:", err?.message);
  }
  return merged;
}

async function repairDeadEndBranches(ideaId: string, viewType: string): Promise<number> {
  let repaired = 0;
  try {
    const nodesResult = await db.execute(sql`
      SELECT id, node_type FROM process_nodes
      WHERE idea_id = ${ideaId} AND view_type = ${viewType}
    `);
    const nodes = (nodesResult.rows || nodesResult || []) as any[];
    if (!Array.isArray(nodes) || nodes.length === 0) return 0;

    const edgesResult = await db.execute(sql`
      SELECT source_node_id, target_node_id FROM process_edges
      WHERE idea_id = ${ideaId} AND view_type = ${viewType}
    `);
    const edges = (edgesResult.rows || edgesResult || []) as any[];

    const sourceSet = new Set<number>();
    if (Array.isArray(edges)) {
      for (const edge of edges) {
        sourceSet.add(edge.source_node_id as number);
      }
    }

    const endNode = nodes.find((n: any) => n.node_type === 'end');
    if (!endNode) return 0;

    const leafNodes = nodes.filter((n: any) =>
      n.node_type !== 'end' && n.node_type !== 'start' && !sourceSet.has(n.id as number)
    );

    for (const leaf of leafNodes) {
      await processMapStorage.createEdge({
        ideaId,
        viewType,
        sourceNodeId: leaf.id as number,
        targetNodeId: endNode.id as number,
        label: "",
      });
      repaired++;
    }

    if (repaired > 0) {
      console.log(`[ProcessMap] Auto-repaired ${repaired} dead-end branch(es) for idea=${ideaId} view=${viewType}`);
    }
  } catch (err: any) {
    console.error("[ProcessMap] Dead-end repair error:", err?.message);
  }
  return repaired;
}

async function cleanupOrphanedNodes(ideaId: string, viewType: string): Promise<void> {
  try {
    await consolidateDuplicateEndNodes(ideaId, viewType);
    await consolidateSuffixEndNodes(ideaId, viewType);

    await cleanupUnreachableNodes(ideaId, viewType);
  } catch (err: any) {
    console.error("[ProcessMap] Orphan cleanup error:", err?.message);
  }
}

async function cleanupUnreachableNodes(ideaId: string, viewType: string): Promise<void> {
  const allNodesResult = await db.execute(sql`
    SELECT id, node_type FROM process_nodes
    WHERE idea_id = ${ideaId} AND view_type = ${viewType}
  `);
  const allNodes = (allNodesResult.rows || allNodesResult || []) as any[];
  if (!Array.isArray(allNodes) || allNodes.length === 0) return;

  const startNode = allNodes.find((n: any) => n.node_type === 'start');
  if (!startNode) return;

  const allEdgesResult = await db.execute(sql`
    SELECT source_node_id, target_node_id FROM process_edges
    WHERE idea_id = ${ideaId} AND view_type = ${viewType}
  `);
  const allEdges = (allEdgesResult.rows || allEdgesResult || []) as any[];

  const adjacency = new Map<number, Set<number>>();
  for (const node of allNodes) {
    adjacency.set(node.id as number, new Set());
  }
  if (Array.isArray(allEdges)) {
    for (const edge of allEdges) {
      const src = edge.source_node_id as number;
      const tgt = edge.target_node_id as number;
      adjacency.get(src)?.add(tgt);
      adjacency.get(tgt)?.add(src);
    }
  }

  const reachable = new Set<number>();
  const queue: number[] = [startNode.id as number];
  reachable.add(startNode.id as number);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current);
    if (neighbors) {
      Array.from(neighbors).forEach((neighbor) => {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
  }

  const unreachableIds = allNodes
    .map((n: any) => n.id as number)
    .filter((id: number) => !reachable.has(id));

  if (unreachableIds.length > 0) {
    for (const nodeId of unreachableIds) {
      await db.execute(sql`DELETE FROM process_edges WHERE source_node_id = ${nodeId} OR target_node_id = ${nodeId}`);
      await db.execute(sql`DELETE FROM process_nodes WHERE id = ${nodeId}`);
    }
    console.log(`[ProcessMap] Removed ${unreachableIds.length} unreachable nodes from ${viewType} view of idea ${ideaId}`);
  }
}

cleanupDuplicateProcessNodes().then(async () => {
    try {
      const viewsResult = await db.execute(sql`
        SELECT DISTINCT idea_id, view_type FROM process_nodes
      `);
      const viewsRows = viewsResult.rows || viewsResult || [];
      if (Array.isArray(viewsRows)) {
        for (const row of viewsRows) {
          await repairDeadEndBranches(row.idea_id as string, row.view_type as string);
        }
      }
    } catch (err: any) {
      console.error("[ProcessMap] Startup dead-end repair error:", err?.message);
    }
}).catch(() => {});

const createNodeSchema = z.object({
  viewType: z.string().default("as-is"),
  name: z.string().min(1),
  role: z.string().default(""),
  system: z.string().default(""),
  nodeType: z.enum(["task", "decision", "start", "end", "agent-task", "agent-decision", "agent-loop"]).default("task"),
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
  nodeType: z.enum(["task", "decision", "start", "end", "agent-task", "agent-decision", "agent-loop"]).optional(),
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

function hasMapChanged(
  currentNodes: any[],
  currentEdges: any[],
  snapshotJson: string
): boolean {
  try {
    const snapshot = JSON.parse(snapshotJson);
    const snapNodes = snapshot.nodes || [];
    const snapEdges = snapshot.edges || [];

    if (currentNodes.length !== snapNodes.length || currentEdges.length !== snapEdges.length) {
      return true;
    }

    const normalize = (nodes: any[], edges: any[]) => {
      const sortedNodes = nodes
        .map((n: any) => ({ name: n.name, role: n.role, system: n.system, nodeType: n.nodeType || n.node_type, description: n.description, isPainPoint: n.isPainPoint ?? n.is_pain_point, isGhost: n.isGhost ?? n.is_ghost, orderIndex: n.orderIndex ?? n.order_index }))
        .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0) || a.name.localeCompare(b.name));
      const sortedEdges = edges
        .map((e: any) => ({ source: e.sourceNodeId ?? e.source_node_id, target: e.targetNodeId ?? e.target_node_id, label: e.label }))
        .sort((a: any, b: any) => a.source - b.source || a.target - b.target);
      return JSON.stringify({ nodes: sortedNodes, edges: sortedEdges });
    };

    return normalize(currentNodes, currentEdges) !== normalize(snapNodes, snapEdges);
  } catch {
    return true;
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
      const recheckBulk = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
      if (recheckBulk.length > 0) {
        nodes = recheckBulk;
        edges = await processMapStorage.getEdgesByIdeaId(ideaId, "to-be");
      }
    }

    if (viewType === "sdd" && nodes.length === 0) {
      const toBeNodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
      if (toBeNodes.length > 0) {
        const recheck = await processMapStorage.getNodesByIdeaId(ideaId, "sdd");
        if (recheck.length === 0) {
          if (!toBeGenerationLocks.has(`${ideaId}-sdd`)) {
            toBeGenerationLocks.add(`${ideaId}-sdd`);
            try {
              const toBeEdges = await processMapStorage.getEdgesByIdeaId(ideaId, "to-be");
              const idMap: Record<number, number> = {};
              for (const node of toBeNodes) {
                const sddNode = await processMapStorage.createNode({
                  ideaId,
                  name: node.name,
                  role: node.role,
                  system: node.system,
                  nodeType: node.nodeType,
                  description: node.description,
                  isGhost: node.isGhost,
                  isPainPoint: false,
                  viewType: "sdd",
                  orderIndex: node.orderIndex,
                  positionX: node.positionX,
                  positionY: node.positionY,
                });
                idMap[node.id] = sddNode.id;
              }
              for (const edge of toBeEdges) {
                if (idMap[edge.sourceNodeId] && idMap[edge.targetNodeId]) {
                  await processMapStorage.createEdge({
                    ideaId,
                    sourceNodeId: idMap[edge.sourceNodeId],
                    targetNodeId: idMap[edge.targetNodeId],
                    label: edge.label,
                    viewType: "sdd",
                  });
                }
              }
            } finally {
              toBeGenerationLocks.delete(`${ideaId}-sdd`);
            }
          }
          nodes = await processMapStorage.getNodesByIdeaId(ideaId, "sdd");
          edges = await processMapStorage.getEdgesByIdeaId(ideaId, "sdd");
        }
      }
    }

    let mapChanged = false;
    if (approval && approval.snapshotJson) {
      mapChanged = hasMapChanged(nodes, edges, approval.snapshotJson);
    }

    return res.json({ nodes, edges, approval, mapChanged });
  });

  app.get("/api/ideas/:ideaId/process-approval-history", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const viewType = (req.query.view as string) || "as-is";
    const history = await processMapStorage.getApprovalHistory(ideaId, viewType);
    return res.json(history);
  });

  app.get("/api/ideas/:ideaId/approval-summary", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const allApprovals = await processMapStorage.getAllApprovalsForIdea(ideaId);
    const pddApproval = await documentStorage.getApproval(ideaId, "PDD");
    const sddApproval = await documentStorage.getApproval(ideaId, "SDD");

    const summary: Record<string, any> = {};

    for (const a of allApprovals) {
      const key = `${a.viewType}-map`;
      if (!summary[key] || a.version > summary[key].version) {
        summary[key] = {
          type: `${a.viewType} Map`,
          version: a.version,
          userName: a.userName,
          userRole: a.userRole,
          approvedAt: a.approvedAt,
          invalidated: a.invalidated,
        };
      }
    }

    if (pddApproval) {
      summary["pdd"] = {
        type: "PDD",
        userName: pddApproval.userName,
        userRole: pddApproval.userRole,
        approvedAt: pddApproval.approvedAt,
      };
    }
    if (sddApproval) {
      summary["sdd"] = {
        type: "SDD",
        userName: sddApproval.userName,
        userRole: sddApproval.userRole,
        approvedAt: sddApproval.approvedAt,
      };
    }

    return res.json(summary);
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

  app.delete("/api/ideas/:ideaId/process-map/clear", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;
    const viewType = (req.query.view as string) || "as-is";
    try {
      const result = await processMapStorage.clearAllForView(ideaId, viewType);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.error(`[ProcessMap] Clear failed:`, err?.message);
      return res.status(500).json({ message: "Failed to clear process map" });
    }
  });

  app.post("/api/ideas/:ideaId/process-map/bulk", async (req: Request, res: Response) => {
    const ideaId = await verifyIdeaAccess(req, res);
    if (!ideaId) return;

    const { viewType = "as-is", nodes = [], edges = [], clearExisting = false } = req.body;

    const shouldClear = clearExisting || viewType === "sdd";

    const lockKey = `${ideaId}:${viewType}`;
    const existingLock = bulkWriteLocks.get(lockKey);
    if (existingLock) {
      await existingLock;
    }

    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => { resolveLock = resolve; });
    bulkWriteLocks.set(lockKey, lockPromise);

    if (viewType === "to-be") {
      toBeGenerationLocks.add(ideaId);
    }

    try {
      if (shouldClear) {
        await processMapStorage.clearAllForView(ideaId, viewType);
      }

      const existingNodes = shouldClear ? [] : await processMapStorage.getNodesByIdeaId(ideaId, viewType);
      const nameToId: Record<string, number> = {};
      for (const n of existingNodes) {
        nameToId[n.name.toLowerCase().replace(/\s+/g, " ").trim()] = n.id;
      }

      const createdNodeIds: number[] = [];
      const indexToId: Record<number, number> = {};

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const normName = (node.name || "").toLowerCase().replace(/\s+/g, " ").trim();
        const existingId = nameToId[normName];

        if (existingId && !shouldClear) {
          await processMapStorage.updateNode(existingId, {
            name: node.name,
            role: node.role || "",
            system: node.system || "",
            nodeType: node.nodeType || "task",
            ideaId,
            isGhost: false,
          });
          createdNodeIds.push(existingId);
          indexToId[i] = existingId;
        } else {
          const created = await processMapStorage.createNode({
            ideaId,
            viewType,
            name: node.name,
            role: node.role || "",
            system: node.system || "",
            nodeType: node.nodeType || "task",
            orderIndex: node.orderIndex ?? i,
          });
          createdNodeIds.push(created.id);
          indexToId[i] = created.id;
          nameToId[normName] = created.id;
        }
      }

      const createdEdgeIds: number[] = [];
      for (const edge of edges) {
        const sourceId = indexToId[edge.sourceIndex];
        const targetId = indexToId[edge.targetIndex];
        if (sourceId && targetId) {
          const created = await processMapStorage.createEdge({
            ideaId,
            viewType,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            label: edge.label || "",
          });
          createdEdgeIds.push(created.id);
        }
      }

      await cleanupOrphanedNodes(ideaId, viewType);
      await repairDeadEndBranches(ideaId, viewType);

      return res.status(201).json({ nodeIds: createdNodeIds, edgeIds: createdEdgeIds, indexToId });
    } catch (err: any) {
      console.error(`[ProcessMap] Bulk create failed:`, err?.message);
      return res.status(500).json({ message: "Failed to bulk create process map" });
    } finally {
      if (viewType === "to-be") {
        toBeGenerationLocks.delete(ideaId);
      }
      resolveLock!();
      bulkWriteLocks.delete(lockKey);
    }
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
    if (existingApproval) {
      const nodes = await processMapStorage.getNodesByIdeaId(ideaId, viewType);
      const edges = await processMapStorage.getEdgesByIdeaId(ideaId, viewType);
      const changed = hasMapChanged(nodes, edges, existingApproval.snapshotJson);
      if (!changed) {
        return res.status(400).json({ message: "Already approved — no changes detected" });
      }
    }

    const nodes = await processMapStorage.getNodesByIdeaId(ideaId, viewType);
    if (nodes.length < 3) return res.status(400).json({ message: "At least 3 nodes required" });

    const user = await storage.getUser(req.session.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });

    const edges = await processMapStorage.getEdgesByIdeaId(ideaId, viewType);
    const snapshot = JSON.stringify({ nodes, edges });

    if (existingApproval) {
      await processMapStorage.invalidateApprovals(ideaId, viewType, `Superseded by new version`);
    }

    const nextVersion = await processMapStorage.getNextVersion(ideaId, viewType);

    const approval = await processMapStorage.createApproval({
      ideaId,
      viewType,
      version: nextVersion,
      userId: user.id,
      userRole: (req.session.activeRole || user.role) as string,
      userName: user.displayName,
      snapshotJson: snapshot,
      invalidated: false,
    });

    if (viewType === "as-is") {
      if (existingApproval) {
        await processMapStorage.invalidateApprovals(ideaId, "to-be", "As-Is map was re-approved (v" + nextVersion + ")");
        await processMapStorage.invalidateApprovals(ideaId, "sdd", "As-Is map was re-approved (v" + nextVersion + ")");
        await processMapStorage.clearAllForView(ideaId, "to-be");
        await processMapStorage.clearAllForView(ideaId, "sdd");
        try { await documentStorage.deleteApproval(ideaId, "PDD"); } catch {}
        try { await documentStorage.deleteApproval(ideaId, "SDD"); } catch {}
        try { await storage.updateIdea(ideaId, { automationType: null, automationTypeRationale: null }); } catch {}
        console.log(`[ProcessMap] Cascade invalidation: As-Is v${nextVersion} invalidated feasibility, To-Be, PDD, SDD for idea=${ideaId}`);
      }

    }

    if (viewType === "to-be" && existingApproval) {
      await processMapStorage.invalidateApprovals(ideaId, "sdd", "To-Be map was re-approved (v" + nextVersion + ")");
      await processMapStorage.clearAllForView(ideaId, "sdd");
      try { await documentStorage.deleteApproval(ideaId, "PDD"); } catch {}
      try { await documentStorage.deleteApproval(ideaId, "SDD"); } catch {}
      console.log(`[ProcessMap] Cascade invalidation: To-Be v${nextVersion} invalidated PDD, SDD for idea=${ideaId}`);
    }

    const isReapproval = existingApproval != null;
    let nextAction: string | undefined;
    if (viewType === "as-is") {
      nextAction = "generate-feasibility-and-to-be";
      await chatStorage.createMessage(
        ideaId,
        "assistant",
        isReapproval
          ? `As-Is process map re-approved (v${nextVersion}). All downstream artifacts (To-Be map, PDD, SDD, UiPath package) have been invalidated. Running feasibility assessment and then generating the To-Be automated process map...`
          : "As-Is process map approved. Running feasibility assessment (automation type evaluation) and then generating the To-Be automated process map..."
      );
    } else {
      nextAction = "generate-pdd";
      await chatStorage.createMessage(
        ideaId,
        "assistant",
        isReapproval
          ? `To-Be process map re-approved (v${nextVersion}). Downstream documents (PDD, SDD) have been invalidated and need to be regenerated. Generating the Process Design Document now...`
          : "To-Be process map approved. Generating the Process Design Document now..."
      );
    }

    try {
      await evaluateTransition(
        ideaId,
        req.session.userId!,
        user.displayName,
        (req.session.activeRole || user.role) as string
      );
    } catch (transErr: any) {
      console.error("[ProcessMap] Transition evaluation failed:", transErr?.message);
    }

    return res.status(201).json({ ...approval, nextAction });
  });
}
