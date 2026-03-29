import dagreImport from "@dagrejs/dagre";
import sharp from "sharp";
import { escapeXml } from "../server/lib/xml-utils";
import fs from "fs";
import path from "path";

const dagre = (dagreImport as any).default || dagreImport;

interface MapNode {
  id: number;
  name: string;
  nodeType: string;
  role?: string | null;
  system?: string | null;
  description?: string | null;
  isPainPoint?: boolean | null;
  positionX?: number | null;
  positionY?: number | null;
  orderIndex?: number;
}

interface MapEdge {
  id: number;
  sourceNodeId: number;
  targetNodeId: number;
  label?: string | null;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  data: MapNode;
}

interface LayoutEdge {
  source: string;
  target: string;
  label: string;
  points: { x: number; y: number }[];
  isDecisionSource?: boolean;
  sourceHandle?: string;
}

interface RenderConfig {
  label: string;
  taskWidth: number;
  taskHeight: number;
  startEndSize: number;
  decisionSize: number;
  nameFontSize: number;
  badgeFontSize: number;
  edgeLabelFontSize: number;
  decisionFontSize: number;
  nameMaxChars: number;
  nameMaxLines: number;
  nodesep: number;
  ranksep: number;
  density: number;
  edgeCornerRadius: number;
  badgeHeight: number;
  nameTruncate: number;
  edgesep: number;
  strokeWidth: number;
  arrowSize: number;
}

const CURRENT: RenderConfig = {
  label: "CURRENT",
  taskWidth: 240,
  taskHeight: 70,
  startEndSize: 44,
  decisionSize: 52,
  nameFontSize: 10,
  badgeFontSize: 7.5,
  edgeLabelFontSize: 8,
  decisionFontSize: 8,
  nameMaxChars: 30,
  nameMaxLines: 1,
  nodesep: 60,
  ranksep: 80,
  density: 72,
  edgeCornerRadius: 8,
  badgeHeight: 14,
  nameTruncate: 30,
  edgesep: 40,
  strokeWidth: 1.5,
  arrowSize: 8,
};

const IMPROVED: RenderConfig = {
  label: "IMPROVED",
  taskWidth: 320,
  taskHeight: 100,
  startEndSize: 52,
  decisionSize: 90,
  nameFontSize: 14,
  badgeFontSize: 11,
  edgeLabelFontSize: 11,
  decisionFontSize: 11,
  nameMaxChars: 40,
  nameMaxLines: 2,
  nodesep: 120,
  ranksep: 140,
  density: 200,
  edgeCornerRadius: 14,
  badgeHeight: 18,
  nameTruncate: 40,
  edgesep: 80,
  strokeWidth: 2.5,
  arrowSize: 11,
};

const TEST_NODES: MapNode[] = [
  { id: 7127, name: "8AM Daily Trigger", nodeType: "start", role: "System", system: "Orchestrator Triggers", orderIndex: 0 },
  { id: 7128, name: "Get Today's Birthday Events (Birthdays calendar)", nodeType: "task", role: "System", system: "Google Calendar (UiPath activities)", orderIndex: 1 },
  { id: 7129, name: "Any Birthdays Today?", nodeType: "decision", role: "System", system: "Orchestrator", orderIndex: 2 },
  { id: 7130, name: "End (No Birthdays Today)", nodeType: "end", role: "System", system: "Orchestrator", orderIndex: 3 },
  { id: 7131, name: "For Each Birthday Person", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 4 },
  { id: 7132, name: "Lookup Contact by Full Name", nodeType: "task", role: "System", system: "Google Contacts (UiPath activities)", orderIndex: 5 },
  { id: 7133, name: "Email Available (Personal/Home)?", nodeType: "decision", role: "System", system: "Orchestrator", orderIndex: 6 },
  { id: 7134, name: "Select Preferred Email (Personal over Home)", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 7 },
  { id: 7135, name: "Generate Birthday Message in My Voice", nodeType: "agent-task", role: "System", system: "UiPath GenAI Activities", orderIndex: 8 },
  { id: 7136, name: "Message Policy Check (safe/appropriate/no sensitive content)", nodeType: "agent-decision", role: "System", system: "UiPath GenAI Activities", orderIndex: 9 },
  { id: 7137, name: "Create Human Review Task (Message Needs Review)", nodeType: "task", role: "System", system: "Action Center", orderIndex: 10 },
  { id: 7138, name: "Approved to Send?", nodeType: "decision", role: "You", system: "Action Center", orderIndex: 11 },
  { id: 7139, name: "Send Birthday Email", nodeType: "task", role: "System", system: "Gmail (Integration Service)", orderIndex: 12 },
  { id: 7140, name: "Skip Send (Rejected)", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 13 },
  { id: 7141, name: "Mark Person Processed", nodeType: "task", role: "System", system: "Data Service", orderIndex: 14 },
  { id: 7142, name: "Mark Person Skipped", nodeType: "task", role: "System", system: "Data Service", orderIndex: 15 },
  { id: 7143, name: "Next Birthday Person?", nodeType: "decision", role: "System", system: "Orchestrator", orderIndex: 16 },
  { id: 7144, name: "Loop to Next Person", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 17 },
  { id: 7145, name: "End (Run Complete)", nodeType: "end", role: "System", system: "Orchestrator", orderIndex: 18 },
  { id: 7146, name: "No Action (No Email Found)", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 19 },
  { id: 7147, name: "Mark Missing Email", nodeType: "task", role: "System", system: "Data Service", orderIndex: 20 },
  { id: 7148, name: "Return to Loop Control", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 21 },
  { id: 7149, name: "Continue Loop Check", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 22 },
  { id: 7150, name: "Next Birthday Person? (after missing email)", nodeType: "decision", role: "System", system: "Orchestrator", orderIndex: 23 },
  { id: 7151, name: "Loop to Next (from missing email path)", nodeType: "task", role: "System", system: "Orchestrator", orderIndex: 24 },
];

const TEST_EDGES: MapEdge[] = [
  { id: 7721, sourceNodeId: 7127, targetNodeId: 7128, label: "" },
  { id: 7722, sourceNodeId: 7128, targetNodeId: 7129, label: "" },
  { id: 7723, sourceNodeId: 7129, targetNodeId: 7130, label: "No" },
  { id: 7724, sourceNodeId: 7129, targetNodeId: 7131, label: "Yes" },
  { id: 7725, sourceNodeId: 7131, targetNodeId: 7132, label: "" },
  { id: 7726, sourceNodeId: 7132, targetNodeId: 7133, label: "" },
  { id: 7727, sourceNodeId: 7133, targetNodeId: 7134, label: "Yes" },
  { id: 7728, sourceNodeId: 7134, targetNodeId: 7135, label: "" },
  { id: 7729, sourceNodeId: 7135, targetNodeId: 7136, label: "" },
  { id: 7730, sourceNodeId: 7136, targetNodeId: 7137, label: "Needs review" },
  { id: 7731, sourceNodeId: 7137, targetNodeId: 7138, label: "" },
  { id: 7732, sourceNodeId: 7138, targetNodeId: 7139, label: "Approved" },
  { id: 7733, sourceNodeId: 7138, targetNodeId: 7140, label: "Rejected" },
  { id: 7734, sourceNodeId: 7139, targetNodeId: 7141, label: "" },
  { id: 7735, sourceNodeId: 7140, targetNodeId: 7142, label: "" },
  { id: 7736, sourceNodeId: 7141, targetNodeId: 7143, label: "" },
  { id: 7737, sourceNodeId: 7143, targetNodeId: 7144, label: "Yes" },
  { id: 7738, sourceNodeId: 7143, targetNodeId: 7145, label: "No" },
  { id: 7739, sourceNodeId: 7133, targetNodeId: 7146, label: "No" },
  { id: 7740, sourceNodeId: 7146, targetNodeId: 7147, label: "" },
  { id: 7741, sourceNodeId: 7147, targetNodeId: 7148, label: "" },
  { id: 7742, sourceNodeId: 7148, targetNodeId: 7149, label: "" },
  { id: 7743, sourceNodeId: 7149, targetNodeId: 7150, label: "" },
  { id: 7744, sourceNodeId: 7150, targetNodeId: 7151, label: "Yes" },
  { id: 7745, sourceNodeId: 7150, targetNodeId: 7145, label: "No" },
  { id: 7746, sourceNodeId: 7142, targetNodeId: 7130, label: "" },
  { id: 7747, sourceNodeId: 7144, targetNodeId: 7130, label: "" },
  { id: 7748, sourceNodeId: 7151, targetNodeId: 7130, label: "" },
];

function getNodeDimensions(nodeType: string, cfg: RenderConfig): { width: number; height: number } {
  const t = (nodeType || "task").toLowerCase();
  if (t === "start" || t === "end") return { width: cfg.startEndSize, height: cfg.startEndSize };
  if (t === "decision" || t === "agent-decision") return { width: cfg.decisionSize, height: cfg.decisionSize };
  return { width: cfg.taskWidth, height: cfg.taskHeight };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

function wrapText(str: string, maxCharsPerLine: number, maxLines: number): string[] {
  if (str.length <= maxCharsPerLine) return [str];
  const words = str.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if ((current + " " + word).length <= maxCharsPerLine) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > 0 && lines[lines.length - 1].length > maxCharsPerLine) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1], maxCharsPerLine);
  }
  return lines;
}

function getLabelSemanticSide(label: string | null | undefined): "left" | "right" | null {
  const lbl = (label || "").trim();
  if (/^(no|rejected|fail|invalid|incomplete|false|exceed|above|poor|flag|needs)/i.test(lbl)) return "right";
  if (/^(yes|approved|pass|valid|complete|true|within|below|stp|auto)/i.test(lbl)) return "left";
  return null;
}

function computeLayout(
  nodes: MapNode[],
  edges: MapEdge[],
  cfg: RenderConfig,
): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[] } {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: cfg.nodesep,
    ranksep: cfg.ranksep,
    edgesep: cfg.edgesep,
    marginx: 50,
    marginy: 50,
  });

  for (const node of nodes) {
    const dims = getNodeDimensions(node.nodeType, cfg);
    g.setNode(String(node.id), { width: dims.width, height: dims.height });
  }

  for (const edge of edges) {
    g.setEdge(String(edge.sourceNodeId), String(edge.targetNodeId), {}, String(edge.id));
  }

  dagre.layout(g);

  const layoutNodes: LayoutNode[] = nodes.map((node) => {
    const pos = g.node(String(node.id));
    const dims = getNodeDimensions(node.nodeType, cfg);
    return {
      id: String(node.id),
      x: pos.x - dims.width / 2,
      y: pos.y - dims.height / 2,
      width: dims.width,
      height: dims.height,
      data: node,
    };
  });

  const nodeTypeMap: Record<string, string> = {};
  nodes.forEach((n) => {
    nodeTypeMap[String(n.id)] = n.nodeType || "task";
  });

  const nodeById: Record<string, LayoutNode> = {};
  layoutNodes.forEach((n) => {
    nodeById[n.id] = n;
  });

  const edgesBySource: Record<string, MapEdge[]> = {};
  for (const edge of edges) {
    const key = String(edge.sourceNodeId);
    if (!edgesBySource[key]) edgesBySource[key] = [];
    edgesBySource[key].push(edge);
  }

  const layoutEdges: LayoutEdge[] = edges.map((edge) => {
    const srcType = nodeTypeMap[String(edge.sourceNodeId)] || "task";
    const isDecision = srcType === "decision" || srcType === "agent-decision";

    return {
      source: String(edge.sourceNodeId),
      target: String(edge.targetNodeId),
      label: edge.label || "",
      points: [],
      isDecisionSource: isDecision,
      sourceHandle: "bottom",
    };
  });

  assignDecisionHandles(layoutNodes, layoutEdges, nodeTypeMap, edgesBySource, cfg);

  for (const le of layoutEdges) {
    const srcNode = nodeById[le.source];
    const tgtNode = nodeById[le.target];
    if (srcNode && tgtNode) {
      le.points = computeEdgePoints(srcNode, tgtNode, le.sourceHandle, le.isDecisionSource || false, cfg, nodeById, layoutNodes);
    }
  }

  return { layoutNodes, layoutEdges };
}

function assignDecisionHandles(
  layoutNodes: LayoutNode[],
  layoutEdges: LayoutEdge[],
  nodeTypeMap: Record<string, string>,
  _edgesBySource: Record<string, MapEdge[]>,
  cfg: RenderConfig,
): void {
  const nodeCenter: Record<string, { x: number; y: number }> = {};
  layoutNodes.forEach((n) => {
    nodeCenter[n.id] = { x: n.x + n.width / 2, y: n.y + n.height / 2 };
  });

  const edgesBySource: Record<string, LayoutEdge[]> = {};
  layoutEdges.forEach((e) => {
    if (!edgesBySource[e.source]) edgesBySource[e.source] = [];
    edgesBySource[e.source].push(e);
  });

  for (const sourceId of Object.keys(edgesBySource)) {
    const srcType = nodeTypeMap[sourceId] || "task";
    const isDecision = srcType === "decision" || srcType === "agent-decision";
    if (!isDecision) continue;

    const siblings = edgesBySource[sourceId];
    if (siblings.length !== 2) continue;

    const srcPos = nodeCenter[sourceId];
    if (!srcPos) continue;

    const tgt0 = nodeCenter[siblings[0].target];
    const tgt1 = nodeCenter[siblings[1].target];
    if (!tgt0 || !tgt1) continue;

    const halfDiamond = cfg.decisionSize / 2;
    const tgt0IsBelow = tgt0.y > srcPos.y + halfDiamond;
    const tgt1IsBelow = tgt1.y > srcPos.y + halfDiamond;
    const tgt0DirectlyBelow = Math.abs(tgt0.x - srcPos.x) < halfDiamond * 0.8 && tgt0IsBelow;
    const tgt1DirectlyBelow = Math.abs(tgt1.x - srcPos.x) < halfDiamond * 0.8 && tgt1IsBelow;

    if (tgt0DirectlyBelow && !tgt1DirectlyBelow) {
      siblings[0].sourceHandle = "bottom";
      siblings[1].sourceHandle = tgt1.x <= srcPos.x ? "left" : "right";
    } else if (tgt1DirectlyBelow && !tgt0DirectlyBelow) {
      siblings[1].sourceHandle = "bottom";
      siblings[0].sourceHandle = tgt0.x <= srcPos.x ? "left" : "right";
    } else if (tgt0.x < srcPos.x && tgt1.x >= srcPos.x) {
      siblings[0].sourceHandle = "left";
      siblings[1].sourceHandle = "right";
    } else if (tgt1.x < srcPos.x && tgt0.x >= srcPos.x) {
      siblings[0].sourceHandle = "right";
      siblings[1].sourceHandle = "left";
    } else if (tgt0.x < tgt1.x) {
      siblings[0].sourceHandle = "left";
      siblings[1].sourceHandle = "right";
    } else if (tgt0.x > tgt1.x) {
      siblings[0].sourceHandle = "right";
      siblings[1].sourceHandle = "left";
    } else {
      const sem0 = getLabelSemanticSide(siblings[0].label);
      const sem1 = getLabelSemanticSide(siblings[1].label);
      if (sem0 === "left" && sem1 !== "left") {
        siblings[0].sourceHandle = "left";
        siblings[1].sourceHandle = "right";
      } else if (sem1 === "left" && sem0 !== "left") {
        siblings[1].sourceHandle = "left";
        siblings[0].sourceHandle = "right";
      } else {
        siblings[0].sourceHandle = "left";
        siblings[1].sourceHandle = "right";
      }
    }
  }
}

function segmentIntersectsBox(
  x1: number, y1: number, x2: number, y2: number,
  bx: number, by: number, bw: number, bh: number,
  margin: number = 10
): boolean {
  const left = bx - margin;
  const right = bx + bw + margin;
  const top = by - margin;
  const bottom = by + bh + margin;
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < left || minX > right || maxY < top || minY > bottom) return false;
  if (x1 === x2) return x1 >= left && x1 <= right && !(minY >= bottom || maxY <= top);
  if (y1 === y2) return y1 >= top && y1 <= bottom && !(minX >= right || maxX <= left);
  const slope = (y2 - y1) / (x2 - x1);
  const yAtLeft = y1 + slope * (left - x1);
  const yAtRight = y1 + slope * (right - x1);
  return (yAtLeft >= top && yAtLeft <= bottom) || (yAtRight >= top && yAtRight <= bottom);
}

function findMinClearanceX(
  obstacleNodes: LayoutNode[],
  sx: number, sy: number, tx: number, ty: number,
  side: "left" | "right"
): number {
  const yMin = Math.min(sy, ty);
  const yMax = Math.max(sy, ty);
  const margin = 20;
  const relevant = obstacleNodes.filter(n =>
    n.y + n.height > yMin - margin && n.y < yMax + margin
  );
  if (relevant.length === 0) {
    return side === "left" ? Math.min(sx, tx) - margin : Math.max(sx, tx) + margin;
  }
  if (side === "left") {
    const minX = Math.min(...relevant.map(n => n.x));
    return minX - margin;
  }
  const maxX = Math.max(...relevant.map(n => n.x + n.width));
  return maxX + margin;
}

function computeMinElbowRoute(
  sx: number, sy: number, tx: number, ty: number,
  obstacleNodes: LayoutNode[],
  exitDirection?: "left" | "right" | "bottom"
): { x: number; y: number }[] {
  const dx = Math.abs(tx - sx);
  const isAligned = dx < 5;

  function segHitsObstacle(x1: number, y1: number, x2: number, y2: number): boolean {
    return obstacleNodes.some(obs =>
      segmentIntersectsBox(x1, y1, x2, y2, obs.x, obs.y, obs.width, obs.height)
    );
  }

  if (exitDirection === "left" || exitDirection === "right") {
    const lPath = [
      { x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }
    ];
    if (!segHitsObstacle(sx, sy, tx, sy) && !segHitsObstacle(tx, sy, tx, ty)) return lPath;

    const midY = (sy + ty) / 2;
    const zPath = [
      { x: sx, y: sy }, { x: sx, y: midY },
      { x: tx, y: midY }, { x: tx, y: ty }
    ];
    if (!segHitsObstacle(sx, sy, sx, midY) && !segHitsObstacle(sx, midY, tx, midY) && !segHitsObstacle(tx, midY, tx, ty)) return zPath;

    const detourX = findMinClearanceX(obstacleNodes, sx, sy, tx, ty, exitDirection);
    return [
      { x: sx, y: sy }, { x: detourX, y: sy },
      { x: detourX, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }
    ];
  }

  if (isAligned) {
    if (!segHitsObstacle(sx, sy, sx, ty)) {
      return [{ x: sx, y: sy }, { x: sx, y: ty }];
    }
    let bestDetourX = sx;
    let bestClearance = 0;
    for (const obs of obstacleNodes) {
      if (!segmentIntersectsBox(sx, sy, sx, ty, obs.x, obs.y, obs.width, obs.height)) continue;
      const leftX = obs.x - 20;
      const rightX = obs.x + obs.width + 20;
      const leftDist = Math.abs(sx - leftX);
      const rightDist = Math.abs(sx - rightX);
      const chosenX = leftDist <= rightDist ? leftX : rightX;
      if (Math.abs(chosenX - sx) > bestClearance) {
        bestDetourX = chosenX;
        bestClearance = Math.abs(chosenX - sx);
      }
    }
    const midY = (sy + ty) / 2;
    return [
      { x: sx, y: sy }, { x: bestDetourX, y: sy },
      { x: bestDetourX, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }
    ];
  }

  const lPath = [
    { x: sx, y: sy }, { x: tx, y: sy }, { x: tx, y: ty }
  ];
  if (!segHitsObstacle(sx, sy, tx, sy) && !segHitsObstacle(tx, sy, tx, ty)) return lPath;

  const midY = (sy + ty) / 2;
  const zPath = [
    { x: sx, y: sy }, { x: sx, y: midY },
    { x: tx, y: midY }, { x: tx, y: ty }
  ];
  if (!segHitsObstacle(sx, sy, sx, midY) && !segHitsObstacle(sx, midY, tx, midY) && !segHitsObstacle(tx, midY, tx, ty)) return zPath;

  const preferRight = tx > sx;
  const detourX = findMinClearanceX(obstacleNodes, sx, sy, tx, ty, preferRight ? "right" : "left");
  return [
    { x: sx, y: sy }, { x: detourX, y: sy },
    { x: detourX, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }
  ];
}

function computeEdgePoints(
  srcNode: LayoutNode,
  tgtNode: LayoutNode,
  sourceHandle: string | undefined,
  isDecisionSource: boolean,
  cfg: RenderConfig,
  _nodeById: Record<string, LayoutNode>,
  allNodes: LayoutNode[],
): { x: number; y: number }[] {
  const cx = srcNode.x + srcNode.width / 2;
  const cy = srcNode.y + srcNode.height / 2;
  const tx = tgtNode.x + tgtNode.width / 2;
  const ty = tgtNode.y;
  const halfDiamond = cfg.decisionSize / 2;
  const obstacleNodes = allNodes.filter(n => n.id !== srcNode.id && n.id !== tgtNode.id);

  if (isDecisionSource && sourceHandle === "left") {
    const sx = cx - halfDiamond;
    const sy = cy;
    return computeMinElbowRoute(sx, sy, tx, ty, obstacleNodes, "left");
  }

  if (isDecisionSource && sourceHandle === "right") {
    const sx = cx + halfDiamond;
    const sy = cy;
    return computeMinElbowRoute(sx, sy, tx, ty, obstacleNodes, "right");
  }

  if (isDecisionSource) {
    const sx = cx;
    const sy = cy + halfDiamond;
    return computeMinElbowRoute(sx, sy, tx, ty, obstacleNodes, "bottom");
  }

  const sx = cx;
  const sy = srcNode.y + srcNode.height;
  return computeMinElbowRoute(sx, sy, tx, ty, obstacleNodes, "bottom");
}

function renderEdgePath(points: { x: number; y: number }[], r: number): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
    if (len1 < 1 || len2 < 1) {
      d += ` L ${curr.x} ${curr.y}`;
      continue;
    }
    const isStraight = Math.abs(dx1 * dy2 - dy1 * dx2) < 0.01 * len1 * len2;
    if (isStraight) {
      continue;
    }
    const clampR = Math.min(r, len1 / 2, len2 / 2);
    const ax = curr.x - (dx1 / len1) * clampR;
    const ay = curr.y - (dy1 / len1) * clampR;
    const bx = curr.x + (dx2 / len2) * clampR;
    const by = curr.y + (dy2 / len2) * clampR;
    d += ` L ${ax} ${ay} Q ${curr.x} ${curr.y} ${bx} ${by}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function getEdgeColor(label: string): string {
  const l = label.toLowerCase();
  if (l === "yes" || l === "true" || l === "approved") return "#4ade80";
  if (l === "no" || l === "false" || l === "rejected") return "#f87171";
  if (l === "needs review") return "#fbbf24";
  return "#5eead4";
}

function renderNodeSvg(node: LayoutNode, cfg: RenderConfig): string {
  const { x, y, width, height, data } = node;
  const nType = (data.nodeType || "task").toLowerCase();

  if (nType === "start") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = width * 0.41;
    const pr = r * 0.35;
    return `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#059669" stroke="#34d399" stroke-width="2.5"/>
      <polygon points="${cx - pr * 0.7},${cy - pr} ${cx - pr * 0.7},${cy + pr} ${cx + pr},${cy}" fill="white"/>
    `;
  }

  if (nType === "end") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = width * 0.41;
    const sq = r * 0.45;
    return `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc2626" stroke="#f87171" stroke-width="2.5"/>
      <rect x="${cx - sq}" y="${cy - sq}" width="${sq * 2}" height="${sq * 2}" rx="2" fill="white"/>
    `;
  }

  if (nType === "decision" || nType === "agent-decision") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const s = cfg.decisionSize / 2 * 0.72;
    const nameLines = wrapText(data.name || "?", Math.floor(cfg.decisionSize / (cfg.decisionFontSize * 0.55)), cfg.nameMaxLines);
    const lineHeight = cfg.decisionFontSize + 3;
    const totalTextH = nameLines.length * lineHeight;
    const startY = -totalTextH / 2 + cfg.decisionFontSize * 0.4;
    const fillColor = nType === "agent-decision" ? "#7c3aed" : "#d97706";
    const strokeColor = nType === "agent-decision" ? "#a78bfa" : "#fbbf24";
    let textSvg = "";
    nameLines.forEach((line, i) => {
      textSvg += `<text x="0" y="${startY + i * lineHeight}" text-anchor="middle" fill="white" font-size="${cfg.decisionFontSize}" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(line)}</text>`;
    });
    return `
      <g transform="translate(${cx}, ${cy})">
        <rect x="${-s}" y="${-s}" width="${s * 2}" height="${s * 2}" rx="4" transform="rotate(45)" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2"/>
        ${textSvg}
      </g>
    `;
  }

  const borderColor = "#5eead4";
  const painPointBorder = data.isPainPoint ? "#f87171" : borderColor;
  const nameLines = wrapText(data.name || "Unnamed", cfg.nameMaxChars, cfg.nameMaxLines);
  const roleText = data.role ? truncate(data.role, cfg.nameMaxChars - 8) : "";
  const systemText = data.system ? truncate(data.system, cfg.nameMaxChars - 8) : "";

  const lineHeight = cfg.nameFontSize + 4;
  const nameStartY = y + 8 + cfg.nameFontSize;
  let nameTextSvg = "";
  nameLines.forEach((line, i) => {
    nameTextSvg += `<text x="${x + width / 2}" y="${nameStartY + i * lineHeight}" text-anchor="middle" fill="#f4f4f5" font-size="${cfg.nameFontSize}" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(line)}</text>`;
  });

  const maxBadgeArea = width - 16;
  let badgeSvg = "";
  let badgeX = x + 8;
  const badgeY = y + height - cfg.badgeHeight - 6;

  if (roleText) {
    const rw = Math.min(roleText.length * (cfg.badgeFontSize * 0.7) + 14, maxBadgeArea);
    badgeSvg += `
      <rect x="${badgeX}" y="${badgeY}" width="${rw}" height="${cfg.badgeHeight}" rx="4" fill="#374151"/>
      <text x="${badgeX + rw / 2}" y="${badgeY + cfg.badgeHeight * 0.72}" text-anchor="middle" fill="#d1d5db" font-size="${cfg.badgeFontSize}" font-family="system-ui, sans-serif">${escapeXml(roleText)}</text>
    `;
    badgeX += rw + 4;
  }
  if (systemText) {
    const remainingSpace = (x + width - 8) - badgeX;
    if (remainingSpace > 30) {
      const maxSysChars = Math.floor(remainingSpace / (cfg.badgeFontSize * 0.7));
      const displaySys = truncate(systemText, maxSysChars);
      const sw = Math.min(displaySys.length * (cfg.badgeFontSize * 0.7) + 14, remainingSpace);
      badgeSvg += `
        <rect x="${badgeX}" y="${badgeY}" width="${sw}" height="${cfg.badgeHeight}" rx="4" fill="#1e293b" stroke="#334155" stroke-width="0.5"/>
        <text x="${badgeX + sw / 2}" y="${badgeY + cfg.badgeHeight * 0.72}" text-anchor="middle" fill="#94a3b8" font-size="${cfg.badgeFontSize}" font-family="system-ui, sans-serif">${escapeXml(displaySys)}</text>
      `;
    }
  }

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#1e1e2e" stroke="${painPointBorder}" stroke-width="2"/>
    ${nameTextSvg}
    ${badgeSvg}
  `;
}

async function renderWithConfig(
  nodes: MapNode[],
  edges: MapEdge[],
  cfg: RenderConfig,
): Promise<{ svgContent: string; pngBuffer: Buffer; width: number; height: number }> {
  const { layoutNodes, layoutEdges } = computeLayout(nodes, edges, cfg);

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of layoutNodes) {
    const nType = (n.data.nodeType || "task").toLowerCase();
    const extra = nType === "decision" || nType === "agent-decision" ? cfg.decisionSize * 0.75 : 0;
    minX = Math.min(minX, n.x - extra);
    minY = Math.min(minY, n.y - extra);
    maxX = Math.max(maxX, n.x + n.width + extra);
    maxY = Math.max(maxY, n.y + n.height + extra);
  }
  for (const e of layoutEdges) {
    for (const p of e.points) {
      minX = Math.min(minX, p.x - 30);
      minY = Math.min(minY, p.y - 30);
      maxX = Math.max(maxX, p.x + 30);
      maxY = Math.max(maxY, p.y + 30);
    }
  }

  const padding = 70;
  const svgWidth = maxX - minX + padding * 2;
  const svgHeight = maxY - minY + padding * 2;
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  const adjustedNodes = layoutNodes.map((n) => ({
    ...n,
    x: n.x + offsetX,
    y: n.y + offsetY,
  }));

  const adjustedEdges = layoutEdges.map((e) => ({
    ...e,
    points: e.points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
  }));

  let edgesSvg = "";
  for (const edge of adjustedEdges) {
    const color = getEdgeColor(edge.label);
    const pathD = renderEdgePath(edge.points, cfg.edgeCornerRadius);
    if (!pathD) continue;

    edgesSvg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${cfg.strokeWidth}" marker-end="url(#arrow-${color.replace("#", "")})" stroke-linejoin="round"/>`;

    if (edge.label) {
      let lx: number, ly: number;
      if (edge.isDecisionSource && edge.points.length >= 2) {
        const p0 = edge.points[0];
        const p1 = edge.points[1];
        lx = (p0.x + p1.x) / 2;
        ly = (p0.y + p1.y) / 2;
        if (Math.abs(p0.y - p1.y) < 3) {
          ly -= cfg.edgeLabelFontSize + 4;
        }
      } else {
        const midIdx = Math.floor(edge.points.length / 2);
        const mp = edge.points[midIdx];
        const mpPrev = edge.points[midIdx - 1] || mp;
        lx = (mp.x + mpPrev.x) / 2;
        ly = (mp.y + mpPrev.y) / 2;
        if (Math.abs(mp.x - mpPrev.x) < 3) {
          lx += cfg.edgeLabelFontSize * 2 + 8;
        } else {
          ly -= cfg.edgeLabelFontSize + 2;
        }
      }
      const labelBgW = edge.label.length * (cfg.edgeLabelFontSize * 0.65) + 14;
      const labelBgH = cfg.edgeLabelFontSize + 8;
      edgesSvg += `
        <rect x="${lx - labelBgW / 2}" y="${ly - labelBgH / 2}" width="${labelBgW}" height="${labelBgH}" rx="4" fill="#18181b" stroke="${color}" stroke-width="0.5"/>
        <text x="${lx}" y="${ly + cfg.edgeLabelFontSize * 0.35}" text-anchor="middle" fill="${color}" font-size="${cfg.edgeLabelFontSize}" font-weight="500" font-family="system-ui, sans-serif">${escapeXml(edge.label)}</text>
      `;
    }
  }

  let nodesSvg = "";
  for (const node of adjustedNodes) {
    nodesSvg += renderNodeSvg(node, cfg);
  }

  const arrowColors = new Set<string>();
  for (const edge of adjustedEdges) {
    arrowColors.add(getEdgeColor(edge.label));
  }
  let markerDefs = "";
  for (const color of arrowColors) {
    const id = `arrow-${color.replace("#", "")}`;
    markerDefs += `
      <marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="${cfg.arrowSize}" markerHeight="${cfg.arrowSize}" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
      </marker>
    `;
  }

  const titleFontSize = cfg.label === "IMPROVED" ? 16 : 12;
  const titleSvg = `<text x="${svgWidth / 2}" y="${30}" text-anchor="middle" fill="#71717a" font-size="${titleFontSize}" font-weight="700" font-family="system-ui, sans-serif">${cfg.label}: nodes ${cfg.taskWidth}\u00d7${cfg.taskHeight}, decisions ${cfg.decisionSize}\u00d7${cfg.decisionSize}, font ${cfg.nameFontSize}px, spacing ${cfg.nodesep}/${cfg.ranksep}, DPI ${cfg.density}</text>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" shape-rendering="geometricPrecision" text-rendering="optimizeLegibility">
  <defs>${markerDefs}</defs>
  <rect width="100%" height="100%" fill="#0a0a0f"/>
  ${titleSvg}
  ${edgesSvg}
  ${nodesSvg}
</svg>`;

  const pngBuffer = await sharp(Buffer.from(svg), { density: cfg.density })
    .png({ compressionLevel: 6 })
    .sharpen({ sigma: 0.3 })
    .toBuffer();

  return {
    svgContent: svg,
    pngBuffer,
    width: Math.round(svgWidth),
    height: Math.round(svgHeight),
  };
}

async function main() {
  const outDir = path.join(process.cwd(), "scripts", "renderer-comparison");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log("Rendering CURRENT settings...");
  const current = await renderWithConfig(TEST_NODES, TEST_EDGES, CURRENT);
  fs.writeFileSync(path.join(outDir, "current.svg"), current.svgContent);
  fs.writeFileSync(path.join(outDir, "current.png"), current.pngBuffer);
  console.log(`  CURRENT: SVG ${current.width}\u00d7${current.height}, PNG ${(current.pngBuffer.length / 1024).toFixed(0)}KB`);

  console.log("Rendering IMPROVED settings...");
  const improved = await renderWithConfig(TEST_NODES, TEST_EDGES, IMPROVED);
  fs.writeFileSync(path.join(outDir, "improved.svg"), improved.svgContent);
  fs.writeFileSync(path.join(outDir, "improved.png"), improved.pngBuffer);
  console.log(`  IMPROVED: SVG ${improved.width}\u00d7${improved.height}, PNG ${(improved.pngBuffer.length / 1024).toFixed(0)}KB`);

  console.log(`\nComparison files saved to: ${outDir}/`);
  console.log("  current.png  \u2014 existing renderer settings");
  console.log("  improved.png \u2014 proposed improvements");

  const sizeRatio = (improved.pngBuffer.length / current.pngBuffer.length).toFixed(1);
  const areaRatio = ((improved.width * improved.height) / (current.width * current.height)).toFixed(1);
  console.log(`\nSize comparison:`);
  console.log(`  PNG size ratio: ${sizeRatio}x (${(current.pngBuffer.length / 1024).toFixed(0)}KB \u2192 ${(improved.pngBuffer.length / 1024).toFixed(0)}KB)`);
  console.log(`  Canvas area ratio: ${areaRatio}x (${current.width}\u00d7${current.height} \u2192 ${improved.width}\u00d7${improved.height})`);
}

main().catch(console.error);
