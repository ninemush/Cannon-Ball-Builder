export const LAYOUT_VERSION = 2;

export interface LayoutInput {
  id: string;
  nodeType: string;
  orderIndex: number;
}

export interface LayoutEdgeInput {
  source: string;
  target: string;
  label?: string | null;
}

export interface LayoutPosition {
  x: number;
  y: number;
}

interface NodeDims {
  width: number;
  height: number;
}

function getNodeDims(nodeType: string): NodeDims {
  const t = (nodeType || "task").toLowerCase();
  if (t === "start" || t === "end") return { width: 56, height: 56 };
  if (t === "decision" || t === "agent-decision") return { width: 100, height: 100 };
  if (t === "agent-loop" || t === "agent-task") return { width: 280, height: 100 };
  return { width: 280, height: 96 };
}

function isYesLabel(label: string | null | undefined): boolean {
  return /^(yes|approved|pass|valid|complete|true|within|below|stp|auto)/i.test((label || "").trim());
}

function isNoLabel(label: string | null | undefined): boolean {
  return /^(no|rejected|fail|invalid|incomplete|false|exceed|above|poor|flag)/i.test((label || "").trim());
}

interface PlacedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function boxesOverlap(a: PlacedNode, b: PlacedNode, gap: number): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

function resolveCollisions(
  positions: Map<string, LayoutPosition>,
  nodeMap: Map<string, LayoutInput>,
  getDims: (nodeType: string) => NodeDims,
  downstreamMap: Map<string, Set<string>>,
  minGap: number = 40
): void {
  const placed: PlacedNode[] = [];
  positions.forEach((pos, id) => {
    const node = nodeMap.get(id);
    if (!node) return;
    const dims = getDims(node.nodeType);
    placed.push({ id, x: pos.x, y: pos.y, width: dims.width, height: dims.height });
  });

  let changed = true;
  let iterations = 0;
  const maxIterations = 50;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (boxesOverlap(placed[i], placed[j], minGap)) {
          changed = true;
          const aCx = placed[i].x + placed[i].width / 2;
          const bCx = placed[j].x + placed[j].width / 2;
          const aCy = placed[i].y + placed[i].height / 2;
          const bCy = placed[j].y + placed[j].height / 2;

          const overlapX = (placed[i].width / 2 + placed[j].width / 2 + minGap) - Math.abs(aCx - bCx);
          const overlapY = (placed[i].height / 2 + placed[j].height / 2 + minGap) - Math.abs(aCy - bCy);

          if (overlapX < overlapY) {
            const shift = Math.ceil(overlapX / 2) + 5;
            const aLeft = aCx <= bCx;
            const aDx = aLeft ? -shift : shift;
            const bDx = aLeft ? shift : -shift;

            placed[i].x += aDx;
            placed[j].x += bDx;

            const aDownstream = downstreamMap.get(placed[i].id);
            if (aDownstream) {
              for (const p of placed) {
                if (aDownstream.has(p.id)) p.x += aDx;
              }
            }
            const bDownstream = downstreamMap.get(placed[j].id);
            if (bDownstream) {
              for (const p of placed) {
                if (bDownstream.has(p.id)) p.x += bDx;
              }
            }
          } else {
            const shift = Math.ceil(overlapY / 2) + 5;
            const aUp = aCy <= bCy;
            const aDy = aUp ? -shift : shift;
            const bDy = aUp ? shift : -shift;

            placed[i].y += aDy;
            placed[j].y += bDy;

            const aDownstream = downstreamMap.get(placed[i].id);
            if (aDownstream) {
              for (const p of placed) {
                if (aDownstream.has(p.id)) p.y += aDy;
              }
            }
            const bDownstream = downstreamMap.get(placed[j].id);
            if (bDownstream) {
              for (const p of placed) {
                if (bDownstream.has(p.id)) p.y += bDy;
              }
            }
          }
        }
      }
    }
  }

  for (const p of placed) {
    positions.set(p.id, { x: p.x, y: p.y });
  }
}

function findConvergenceNode(
  decisionId: string,
  outEdges: Map<string, LayoutEdgeInput[]>,
  nodeMap: Map<string, LayoutInput>
): string | null {
  const outs = outEdges.get(decisionId) || [];
  if (outs.length < 2) return null;

  const branchDescendants: Set<string>[] = [];
  for (const edge of outs) {
    const descendants = new Set<string>();
    const queue = [edge.target];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const nId = queue.shift()!;
      if (visited.has(nId) || nId === decisionId) continue;
      visited.add(nId);
      descendants.add(nId);
      const nOuts = outEdges.get(nId) || [];
      for (const ne of nOuts) {
        if (!visited.has(ne.target)) queue.push(ne.target);
      }
    }
    branchDescendants.push(descendants);
  }

  if (branchDescendants.length < 2) return null;

  let common: Set<string> = new Set(branchDescendants[0]);
  for (let i = 1; i < branchDescendants.length; i++) {
    const next = new Set<string>();
    for (const id of common) {
      if (branchDescendants[i].has(id)) next.add(id);
    }
    common = next;
  }

  if (common.size === 0) return null;

  let bestNode: string | null = null;
  let bestOrder = Infinity;
  for (const id of common) {
    const node = nodeMap.get(id);
    if (node && node.orderIndex < bestOrder) {
      bestOrder = node.orderIndex;
      bestNode = id;
    }
  }

  return bestNode;
}

function buildDownstreamMap(
  outEdges: Map<string, LayoutEdgeInput[]>,
  nodeIds: string[]
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const nodeId of nodeIds) {
    const descendants = new Set<string>();
    const queue = [...(outEdges.get(nodeId) || []).map(e => e.target)];
    const visited = new Set<string>();
    while (queue.length > 0) {
      const nId = queue.shift()!;
      if (visited.has(nId) || nId === nodeId) continue;
      visited.add(nId);
      descendants.add(nId);
      const nOuts = outEdges.get(nId) || [];
      for (const ne of nOuts) {
        if (!visited.has(ne.target)) queue.push(ne.target);
      }
    }
    if (descendants.size > 0) result.set(nodeId, descendants);
  }
  return result;
}

export function computeProcessAwareLayout(
  nodes: LayoutInput[],
  edges: LayoutEdgeInput[],
  overrideDims?: (nodeType: string) => NodeDims
): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();
  if (nodes.length === 0) return positions;

  const getDims = overrideDims || getNodeDims;
  const nodeMap = new Map<string, LayoutInput>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const outEdges = new Map<string, LayoutEdgeInput[]>();
  const inEdges = new Map<string, LayoutEdgeInput[]>();
  edges.forEach((e) => {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    outEdges.get(e.source)!.push(e);
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    inEdges.get(e.target)!.push(e);
  });

  let startNode = nodes.find((n) => n.nodeType === "start");
  if (!startNode) {
    const nodesWithNoIncoming = nodes.filter((n) => !inEdges.has(n.id) || inEdges.get(n.id)!.length === 0);
    startNode = nodesWithNoIncoming.length > 0 ? nodesWithNoIncoming[0] : nodes[0];
  }

  const trunk: string[] = [];
  const trunkSet = new Set<string>();
  const visited = new Set<string>();

  let current: string | null = startNode.id;
  while (current && !visited.has(current)) {
    visited.add(current);
    trunk.push(current);
    trunkSet.add(current);

    const outs = outEdges.get(current) || [];
    if (outs.length === 0) break;

    const node = nodeMap.get(current);
    const isDecision = node && (node.nodeType === "decision" || node.nodeType === "agent-decision");

    if (isDecision && outs.length >= 2) {
      const convergence = findConvergenceNode(current, outEdges, nodeMap);
      if (convergence) {
        current = convergence;
      } else {
        break;
      }
    } else {
      if (outs.length === 1) {
        current = outs[0].target;
      } else {
        const targetsByOrder = outs
          .map((e) => ({ edge: e, node: nodeMap.get(e.target) }))
          .filter((x) => x.node)
          .sort((a, b) => (a.node!.orderIndex - b.node!.orderIndex));
        current = targetsByOrder.length > 0 ? targetsByOrder[0].edge.target : outs[0].target;
      }
    }
  }

  const nodeCount = nodes.length;
  const edgeCount = edges.length;
  const density = edgeCount / Math.max(nodeCount, 1);

  let branchCount = 0;
  for (const trunkNodeId of trunk) {
    const outs = outEdges.get(trunkNodeId) || [];
    for (const edge of outs) {
      if (!trunkSet.has(edge.target)) branchCount++;
    }
  }

  let verticalGap: number;
  let branchXOffset: number;
  if (nodeCount > 60) {
    verticalGap = Math.round(45 + density * 8);
    branchXOffset = Math.round(380 + branchCount * 8);
  } else if (nodeCount > 30) {
    verticalGap = Math.round(55 + density * 10);
    branchXOffset = Math.round(400 + branchCount * 10);
  } else {
    verticalGap = Math.round(65 + density * 12);
    branchXOffset = Math.round(420 + branchCount * 12);
  }
  verticalGap = Math.max(40, Math.min(verticalGap, 100));
  branchXOffset = Math.max(350, Math.min(branchXOffset, 550));

  const centerX = 400;

  let y = 60;
  for (const nodeId of trunk) {
    const node = nodeMap.get(nodeId)!;
    const dims = getDims(node.nodeType);
    positions.set(nodeId, { x: centerX - dims.width / 2, y });
    y += dims.height + verticalGap;
  }

  interface BranchWork {
    nodeId: string;
    parentId: string;
    inheritedSide: "right" | "left";
    branchY: number;
    xOffset: number;
    depth: number;
  }
  const branchQueue: BranchWork[] = [];

  const branchReconnections = new Map<string, { decisionId: string; reconnectTrunkIdx: number; side: "right" | "left" }[]>();
  for (const trunkNodeId of trunk) {
    const outs = outEdges.get(trunkNodeId) || [];
    if (outs.length < 2) continue;
    const node = nodeMap.get(trunkNodeId);
    const isDecision = node && (node.nodeType === "decision" || node.nodeType === "agent-decision");
    if (!isDecision) continue;

    for (const edge of outs) {
      if (!trunkSet.has(edge.target)) {
        const queue = [edge.target];
        const visited2 = new Set<string>();
        const isNo = isNoLabel(edge.label);
        const side: "right" | "left" = isNo ? "right" : "left";
        while (queue.length > 0) {
          const nId = queue.shift()!;
          if (visited2.has(nId)) continue;
          visited2.add(nId);
          const nOuts = outEdges.get(nId) || [];
          for (const ne of nOuts) {
            if (trunkSet.has(ne.target)) {
              const reconnIdx = trunk.indexOf(ne.target);
              if (reconnIdx >= 0) {
                if (!branchReconnections.has(trunkNodeId)) branchReconnections.set(trunkNodeId, []);
                branchReconnections.get(trunkNodeId)!.push({ decisionId: trunkNodeId, reconnectTrunkIdx: reconnIdx, side });
              }
            } else if (!visited2.has(ne.target)) {
              queue.push(ne.target);
            }
          }
        }
      }
    }
  }

  const occupiedTrunkSegments = new Map<string, Set<"right" | "left">>();
  for (const [decisionId, reconns] of branchReconnections) {
    const decisionIdx = trunk.indexOf(decisionId);
    for (const reconn of reconns) {
      for (let i = decisionIdx; i < reconn.reconnectTrunkIdx; i++) {
        const segKey = `${trunk[i]}-${trunk[i + 1]}`;
        if (!occupiedTrunkSegments.has(segKey)) occupiedTrunkSegments.set(segKey, new Set());
        occupiedTrunkSegments.get(segKey)!.add(reconn.side);
      }
    }
  }

  let cumulativeRightOffset = 0;
  let cumulativeLeftOffset = 0;

  for (const trunkNodeId of trunk) {
    const outs = outEdges.get(trunkNodeId) || [];
    if (outs.length < 2) continue;

    const node = nodeMap.get(trunkNodeId);
    const isDecision = node && (node.nodeType === "decision" || node.nodeType === "agent-decision");
    if (!isDecision) continue;

    const trunkPos = positions.get(trunkNodeId)!;
    const parentDims = getDims(node!.nodeType);
    const branchStartY = trunkPos.y + parentDims.height + verticalGap;

    let rightBranchCount = 0;
    let leftBranchCount = 0;

    const decisionIdx = trunk.indexOf(trunkNodeId);
    const reconns = branchReconnections.get(trunkNodeId) || [];
    let rightCrossings = 0;
    let leftCrossings = 0;
    for (const reconn of reconns) {
      for (let i = decisionIdx; i < reconn.reconnectTrunkIdx; i++) {
        const segKey = `${trunk[i]}-${trunk[i + 1]}`;
        const occupied = occupiedTrunkSegments.get(segKey);
        if (occupied && occupied.size > 1 && reconn.side === "right") rightCrossings++;
        if (occupied && occupied.size > 1 && reconn.side === "left") leftCrossings++;
      }
    }

    const rightSpacingBonus = rightCrossings > 0 ? branchXOffset * 0.3 : 0;
    const leftSpacingBonus = leftCrossings > 0 ? branchXOffset * 0.3 : 0;

    for (const edge of outs) {
      if (trunkSet.has(edge.target)) continue;
      if (positions.has(edge.target)) continue;

      const isNo = isNoLabel(edge.label);
      const side: "right" | "left" = isNo ? "right" : "left";
      if (side === "right") rightBranchCount++;
      else leftBranchCount++;

      const xOff = side === "right"
        ? branchXOffset * rightBranchCount + cumulativeRightOffset + rightSpacingBonus
        : -(branchXOffset * leftBranchCount + cumulativeLeftOffset + leftSpacingBonus);

      branchQueue.push({
        nodeId: edge.target,
        parentId: trunkNodeId,
        inheritedSide: side,
        branchY: branchStartY,
        xOffset: xOff,
        depth: 1,
      });
    }

    cumulativeRightOffset += rightBranchCount > 0 ? branchXOffset * 0.15 : 0;
    cumulativeLeftOffset += leftBranchCount > 0 ? branchXOffset * 0.15 : 0;
  }

  const processedBranches = new Set<string>();

  while (branchQueue.length > 0) {
    const work = branchQueue.shift()!;
    if (positions.has(work.nodeId)) continue;
    if (processedBranches.has(work.nodeId)) continue;
    processedBranches.add(work.nodeId);

    let branchY = work.branchY;
    let currentId: string | null = work.nodeId;
    const branchX = centerX + work.xOffset;

    while (currentId && !positions.has(currentId)) {
      const node = nodeMap.get(currentId);
      if (!node) break;

      const dims = getDims(node.nodeType);
      positions.set(currentId, { x: branchX - dims.width / 2, y: branchY });
      branchY += dims.height + verticalGap;

      const outs = outEdges.get(currentId) || [];
      if (outs.length === 0) break;

      const isDecision = node.nodeType === "decision" || node.nodeType === "agent-decision";
      if (isDecision && outs.length >= 2) {
        let subBranchIdx = 0;
        for (const edge of outs) {
          if (!positions.has(edge.target) && !trunkSet.has(edge.target)) {
            subBranchIdx++;
            const depthMultiplier = 0.6 + work.depth * 0.15;
            const subOffset = work.xOffset + (
              work.inheritedSide === "left"
                ? -branchXOffset * depthMultiplier * subBranchIdx
                : branchXOffset * depthMultiplier * subBranchIdx
            );
            branchQueue.push({
              nodeId: edge.target,
              parentId: currentId,
              inheritedSide: work.inheritedSide,
              branchY,
              xOffset: subOffset,
              depth: work.depth + 1,
            });
          }
        }
        break;
      } else {
        const nextEdge = outs.find((e) => !positions.has(e.target) && !trunkSet.has(e.target));
        if (nextEdge) {
          currentId = nextEdge.target;
        } else {
          break;
        }
      }
    }
  }

  let orphanX = centerX + branchXOffset * 2;
  for (const node of nodes) {
    if (!positions.has(node.id)) {
      const dims = getDims(node.nodeType);
      const hasAnyEdge = edges.some(e => e.source === node.id || e.target === node.id);
      if (hasAnyEdge) {
        positions.set(node.id, { x: centerX - dims.width / 2 + branchXOffset * 2, y });
        y += dims.height + verticalGap;
      } else {
        positions.set(node.id, { x: orphanX, y: 60 });
        orphanX += dims.width + 60;
      }
    }
  }

  const downstreamMap = buildDownstreamMap(outEdges, nodes.map(n => n.id));
  resolveCollisions(positions, nodeMap, getDims, downstreamMap, 40);

  let minX = Infinity, minY = Infinity;
  positions.forEach((pos) => {
    if (pos.x < minX) minX = pos.x;
    if (pos.y < minY) minY = pos.y;
  });
  const padX = 60 - minX;
  const padY = 60 - minY;
  positions.forEach((pos, key) => {
    positions.set(key, { x: pos.x + padX, y: pos.y + padY });
  });

  return positions;
}
