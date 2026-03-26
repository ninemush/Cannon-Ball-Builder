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
      const yesEdge = outs.find((e) => isYesLabel(e.label));
      const noEdge = outs.find((e) => isNoLabel(e.label));
      if (yesEdge) {
        current = yesEdge.target;
      } else if (noEdge) {
        const nonNoEdge = outs.find((e) => e !== noEdge);
        current = nonNoEdge ? nonNoEdge.target : outs[0].target;
      } else {
        const targetsByOrder = outs
          .map((e) => ({ edge: e, node: nodeMap.get(e.target) }))
          .filter((x) => x.node)
          .sort((a, b) => (a.node!.orderIndex - b.node!.orderIndex));
        current = targetsByOrder.length > 0 ? targetsByOrder[0].edge.target : outs[0].target;
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
    side: "right" | "left";
    branchY: number;
    xOffset: number;
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
      const side: "right" | "left" = isNo ? "right" : (rightBranchCount <= leftBranchCount ? "right" : "left");
      if (side === "right") rightBranchCount++;
      else leftBranchCount++;

      const xOff = side === "right"
        ? branchXOffset * rightBranchCount + cumulativeRightOffset + rightSpacingBonus
        : -(branchXOffset * leftBranchCount + cumulativeLeftOffset + leftSpacingBonus);

      branchQueue.push({
        nodeId: edge.target,
        parentId: trunkNodeId,
        side,
        branchY: branchStartY,
        xOffset: xOff,
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
        for (const edge of outs) {
          if (!positions.has(edge.target) && !trunkSet.has(edge.target)) {
            const isNo = isNoLabel(edge.label);
            const subSide = isNo ? "right" as const : "left" as const;
            const subOffset = work.xOffset + (subSide === "right" ? branchXOffset * 0.6 : -branchXOffset * 0.6);
            branchQueue.push({
              nodeId: edge.target,
              parentId: currentId,
              side: subSide,
              branchY,
              xOffset: subOffset,
            });
          }
        }

        const yesEdge = outs.find((e) => isYesLabel(e.label));
        if (yesEdge && !positions.has(yesEdge.target) && !trunkSet.has(yesEdge.target)) {
          currentId = yesEdge.target;
        } else {
          break;
        }
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

  for (const node of nodes) {
    if (!positions.has(node.id)) {
      const dims = getDims(node.nodeType);
      positions.set(node.id, { x: centerX - dims.width / 2 + branchXOffset * 2, y });
      y += dims.height + verticalGap;
    }
  }

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
