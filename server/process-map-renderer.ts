import dagreImport from "@dagrejs/dagre";
import sharp from "sharp";
import { escapeXml } from "./lib/xml-utils";
import { computeProcessAwareLayout, type LayoutInput, type LayoutEdgeInput } from "../shared/process-layout";

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

const MAX_SVG_DIMENSION = 4000;

function getNodeDimensions(nodeType: string): { width: number; height: number } {
  const t = (nodeType || "task").toLowerCase();
  if (t === "start" || t === "end") return { width: 60, height: 60 };
  if (t === "decision" || t === "agent-decision") return { width: 90, height: 90 };
  return { width: 320, height: 100 };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current.length + 1 + word.length) > maxCharsPerLine) {
      lines.push(current);
      current = word;
      if (lines.length >= 2) break;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current && lines.length < 2) lines.push(current);
  else if (current && lines.length >= 2) {
    lines[lines.length - 1] = truncate(lines[lines.length - 1] + " " + current, maxCharsPerLine + 3);
  }
  return lines.length > 0 ? lines : [text];
}

function getEdgeSourceHandle(
  isDecision: boolean,
  label: string | null | undefined,
  siblings: MapEdge[],
  edge: MapEdge
): string {
  if (!isDecision) return "bottom";
  const lbl = (label || "").trim();
  const isNoEdge = /^(no|rejected|fail|invalid|incomplete|false|exceed|above|poor|flag)/i.test(lbl);
  if (isNoEdge) return "right";
  const isYesEdge = /^(yes|approved|pass|valid|complete|true|within|below|stp|auto)/i.test(lbl);
  if (isYesEdge) return "left";
  if (siblings.length > 1) {
    const idx = siblings.indexOf(edge);
    if (idx === 0) return "left";
    if (idx === 1) return "right";
    return "bottom";
  }
  return "left";
}

function getLabelSemanticSide(label: string | null | undefined): "left" | "right" | null {
  const lbl = (label || "").trim();
  if (/^(no|rejected|fail|invalid|incomplete|false|exceed|above|poor|flag)/i.test(lbl)) return "right";
  if (/^(yes|approved|pass|valid|complete|true|within|below|stp|auto)/i.test(lbl)) return "left";
  return null;
}

function fixDecisionHandlesPostLayout(
  layoutNodes: LayoutNode[],
  layoutEdges: LayoutEdge[],
  nodeTypeMap: Record<string, string>
): void {
  const nodePositions: Record<string, { x: number; y: number; width: number; height: number }> = {};
  layoutNodes.forEach((n) => {
    nodePositions[n.id] = { x: n.x + n.width / 2, y: n.y + n.height / 2, width: n.width, height: n.height };
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

    const srcPos = nodePositions[sourceId];
    if (!srcPos) continue;

    const edge0 = siblings[0];
    const edge1 = siblings[1];
    const tgt0 = nodePositions[edge0.target];
    const tgt1 = nodePositions[edge1.target];
    if (!tgt0 || !tgt1) continue;

    let handle0: string;
    let handle1: string;

    const sem0 = getLabelSemanticSide(edge0.label);
    const sem1 = getLabelSemanticSide(edge1.label);

    if (sem0 && sem1 && sem0 !== sem1) {
      handle0 = sem0;
      handle1 = sem1;
    } else if (sem0 && !sem1) {
      handle0 = sem0;
      handle1 = sem0 === "left" ? "right" : "left";
    } else if (!sem0 && sem1) {
      handle1 = sem1;
      handle0 = sem1 === "left" ? "right" : "left";
    } else {
      if (tgt0.x < tgt1.x) {
        handle0 = "left";
        handle1 = "right";
      } else if (tgt0.x > tgt1.x) {
        handle0 = "right";
        handle1 = "left";
      } else {
        handle0 = "left";
        handle1 = "right";
      }
    }

    edge0.sourceHandle = handle0;
    edge1.sourceHandle = handle1;
  }
}

function computeDagreLayoutNodes(nodes: MapNode[], edges: MapEdge[]): { layoutNodes: LayoutNode[]; dagreGraph: any } {
  const g = new dagre.graphlib.Graph({ multigraph: true });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    nodesep: 120,
    ranksep: 140,
    edgesep: 40,
    marginx: 40,
    marginy: 40,
  });

  for (const node of nodes) {
    const dims = getNodeDimensions(node.nodeType);
    g.setNode(String(node.id), { width: dims.width, height: dims.height });
  }

  for (const edge of edges) {
    g.setEdge(String(edge.sourceNodeId), String(edge.targetNodeId), {}, String(edge.id));
  }

  dagre.layout(g);

  const layoutNodes: LayoutNode[] = nodes.map((node) => {
    const pos = g.node(String(node.id));
    const dims = getNodeDimensions(node.nodeType);
    return {
      id: String(node.id),
      x: pos.x - dims.width / 2,
      y: pos.y - dims.height / 2,
      width: dims.width,
      height: dims.height,
      data: node,
    };
  });

  return { layoutNodes, dagreGraph: g };
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

  if (x1 === x2) {
    return x1 >= left && x1 <= right && !(minY >= bottom || maxY <= top);
  }
  if (y1 === y2) {
    return y1 >= top && y1 <= bottom && !(minX >= right || maxX <= left);
  }

  const slope = (y2 - y1) / (x2 - x1);
  const yAtLeft = y1 + slope * (left - x1);
  const yAtRight = y1 + slope * (right - x1);
  if ((yAtLeft >= top && yAtLeft <= bottom) || (yAtRight >= top && yAtRight <= bottom)) return true;

  return false;
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
  sourceHandle?: string,
  allNodes?: LayoutNode[]
): { x: number; y: number }[] {
  const cx = srcNode.x + srcNode.width / 2;
  const cy = srcNode.y + srcNode.height / 2;
  const tx = tgtNode.x + tgtNode.width / 2;
  const ty = tgtNode.y;
  const diamondR = 42;
  const obstacleNodes = (allNodes || []).filter(n => n.id !== srcNode.id && n.id !== tgtNode.id);

  if (sourceHandle === "left") {
    const sx = cx - diamondR;
    const sy = cy;
    const targetTopX = tgtNode.x + tgtNode.width / 2;
    const targetTopY = tgtNode.y;
    return computeMinElbowRoute(sx, sy, targetTopX, targetTopY, obstacleNodes, "left");
  }

  if (sourceHandle === "right") {
    const sx = cx + diamondR;
    const sy = cy;
    const targetTopX = tgtNode.x + tgtNode.width / 2;
    const targetTopY = tgtNode.y;
    return computeMinElbowRoute(sx, sy, targetTopX, targetTopY, obstacleNodes, "right");
  }

  const sx = srcNode.x + srcNode.width / 2;
  const sy = srcNode.y + srcNode.height;
  const targetTopX = tgtNode.x + tgtNode.width / 2;
  const targetTopY = tgtNode.y;

  return computeMinElbowRoute(sx, sy, targetTopX, targetTopY, obstacleNodes, "bottom");
}

function computeLayout(nodes: MapNode[], edges: MapEdge[]): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[] } {
  const hasOrderIndex = nodes.some((n) => n.orderIndex !== undefined && n.orderIndex > 0);

  let layoutNodes: LayoutNode[];
  let dagreGraph: any = null;

  if (hasOrderIndex && nodes.length > 0) {
    const layoutInputs: LayoutInput[] = nodes.map((n) => ({
      id: String(n.id),
      nodeType: n.nodeType || "task",
      orderIndex: n.orderIndex || 0,
    }));
    const layoutEdgeInputs: LayoutEdgeInput[] = edges.map((e) => ({
      source: String(e.sourceNodeId),
      target: String(e.targetNodeId),
      label: e.label || null,
    }));
    const positions = computeProcessAwareLayout(layoutInputs, layoutEdgeInputs, (nodeType) => getNodeDimensions(nodeType));
    if (positions.size === nodes.length) {
      layoutNodes = nodes.map((node) => {
        const dims = getNodeDimensions(node.nodeType);
        const pos = positions.get(String(node.id));
        return {
          id: String(node.id),
          x: pos ? pos.x : 0,
          y: pos ? pos.y : 0,
          width: dims.width,
          height: dims.height,
          data: node,
        };
      });
    } else {
      const result = computeDagreLayoutNodes(nodes, edges);
      layoutNodes = result.layoutNodes;
      dagreGraph = result.dagreGraph;
    }
  } else {
    const result = computeDagreLayoutNodes(nodes, edges);
    layoutNodes = result.layoutNodes;
    dagreGraph = result.dagreGraph;
  }

  const nodeTypeMap: Record<string, string> = {};
  nodes.forEach(n => { nodeTypeMap[String(n.id)] = n.nodeType || "task"; });

  const nodeById: Record<string, LayoutNode> = {};
  layoutNodes.forEach(n => { nodeById[n.id] = n; });

  const edgesBySource: Record<string, MapEdge[]> = {};
  for (const edge of edges) {
    const key = String(edge.sourceNodeId);
    if (!edgesBySource[key]) edgesBySource[key] = [];
    edgesBySource[key].push(edge);
  }

  const initialEdges: LayoutEdge[] = edges.map((edge) => {
    const srcType = nodeTypeMap[String(edge.sourceNodeId)] || "task";
    const isDecision = srcType === "decision" || srcType === "agent-decision";
    const siblings = edgesBySource[String(edge.sourceNodeId)] || [edge];
    const sourceHandle = getEdgeSourceHandle(isDecision, edge.label, siblings, edge);

    let points: { x: number; y: number }[];
    if (dagreGraph) {
      const edgeData = dagreGraph.edge(String(edge.sourceNodeId), String(edge.targetNodeId), String(edge.id));
      points = edgeData?.points || [];
    } else {
      const srcNode = nodeById[String(edge.sourceNodeId)];
      const tgtNode = nodeById[String(edge.targetNodeId)];
      points = (srcNode && tgtNode) ? computeEdgePoints(srcNode, tgtNode, sourceHandle, layoutNodes) : [];
    }

    return {
      source: String(edge.sourceNodeId),
      target: String(edge.targetNodeId),
      label: edge.label || "",
      points,
      isDecisionSource: isDecision,
      sourceHandle,
    };
  });

  fixDecisionHandlesPostLayout(layoutNodes, initialEdges, nodeTypeMap);

  const layoutEdges: LayoutEdge[] = initialEdges.map((le) => {
    if (!dagreGraph && le.isDecisionSource) {
      const srcNode = nodeById[le.source];
      const tgtNode = nodeById[le.target];
      if (srcNode && tgtNode) {
        le.points = computeEdgePoints(srcNode, tgtNode, le.sourceHandle, layoutNodes);
      }
    }
    return le;
  });

  return { layoutNodes, layoutEdges };
}

function renderEdgePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const r = 14;
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

function getEdgeColor(label: string, viewType: string): string {
  const l = label.toLowerCase();
  if (l === "yes" || l === "true" || l === "approved") return "#4ade80";
  if (l === "no" || l === "false" || l === "rejected") return "#f87171";
  return viewType === "to-be" ? "#5eead4" : "#9ca3af";
}

function renderNodeSvg(node: LayoutNode, viewType: string): string {
  const { x, y, width, height, data } = node;
  const nType = (data.nodeType || "task").toLowerCase();

  if (nType === "start") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = 25;
    return `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#059669" stroke="#34d399" stroke-width="2.5"/>
      <polygon points="${cx - 7},${cy - 9} ${cx - 7},${cy + 9} ${cx + 9},${cy}" fill="white"/>
    `;
  }

  if (nType === "end") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = 25;
    return `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc2626" stroke="#f87171" stroke-width="2.5"/>
      <rect x="${cx - 8}" y="${cy - 8}" width="16" height="16" rx="2" fill="white"/>
    `;
  }

  if (nType === "decision" || nType === "agent-decision") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const s = 42;
    const label = truncate(data.name || "?", 30);
    const lines = wrapText(label, 20);
    const lineHeight = 14;
    const startY = -(lines.length - 1) * lineHeight / 2 + 4;
    const tspans = lines.map((line, i) =>
      `<tspan x="0" dy="${i === 0 ? 0 : lineHeight}" text-anchor="middle">${escapeXml(line)}</tspan>`
    ).join("");
    return `
      <g transform="translate(${cx}, ${cy})">
        <rect x="${-s}" y="${-s}" width="${s * 2}" height="${s * 2}" rx="4" transform="rotate(45)" fill="#d97706" stroke="#fbbf24" stroke-width="2.5"/>
        <text x="0" y="${startY}" text-anchor="middle" fill="white" font-size="11" font-weight="600" font-family="system-ui, sans-serif">${tspans}</text>
      </g>
    `;
  }

  const borderColor = viewType === "to-be" ? "#5eead4" : "#6b7280";
  const painPointBorder = data.isPainPoint ? "#f87171" : borderColor;
  const nameText = truncate(data.name || "Unnamed", 60);
  const roleText = data.role ? truncate(data.role, 30) : "";
  const systemText = data.system ? truncate(data.system, 30) : "";

  const nameLines = wrapText(nameText, 32);
  const nameLineHeight = 17;
  const nameStartY = y + 28;
  const nameTspans = nameLines.map((line, i) =>
    `<tspan x="${x + width / 2}" dy="${i === 0 ? 0 : nameLineHeight}">${escapeXml(line)}</tspan>`
  ).join("");

  const maxBadgeArea = width - 16;
  let badgeSvg = "";
  let badgeX = x + 8;
  const badgeY = y + height - 24;

  if (roleText) {
    let rw = Math.min(roleText.length * 7 + 14, maxBadgeArea);
    badgeSvg += `
      <rect x="${badgeX}" y="${badgeY}" width="${rw}" height="18" rx="4" fill="#374151"/>
      <text x="${badgeX + rw / 2}" y="${badgeY + 13}" text-anchor="middle" fill="#d1d5db" font-size="11" font-family="system-ui, sans-serif">${escapeXml(roleText)}</text>
    `;
    badgeX += rw + 4;
  }
  if (systemText) {
    const remainingSpace = (x + width - 8) - badgeX;
    if (remainingSpace > 24) {
      let sw = Math.min(systemText.length * 7 + 14, remainingSpace);
      badgeSvg += `
        <rect x="${badgeX}" y="${badgeY}" width="${sw}" height="18" rx="4" fill="#1e293b"/>
        <text x="${badgeX + sw / 2}" y="${badgeY + 13}" text-anchor="middle" fill="#94a3b8" font-size="11" font-family="system-ui, sans-serif">${escapeXml(systemText)}</text>
      `;
    }
  }

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="14" fill="#1e1e2e" stroke="${painPointBorder}" stroke-width="2.5"/>
    <text x="${x + width / 2}" y="${nameStartY}" text-anchor="middle" fill="#e4e4e7" font-size="14" font-weight="600" font-family="system-ui, sans-serif">${nameTspans}</text>
    ${badgeSvg}
  `;
}

function buildSvgContent(
  adjustedNodes: LayoutNode[],
  adjustedEdges: LayoutEdge[],
  svgWidth: number,
  svgHeight: number,
  viewType: string,
  pageLabel?: string
): string {
  let edgesSvg = "";
  for (const edge of adjustedEdges) {
    const color = getEdgeColor(edge.label, viewType);
    const pathD = renderEdgePath(edge.points);
    if (!pathD) continue;

    edgesSvg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" marker-end="url(#arrow-${color.replace("#", "")})" stroke-linejoin="round"/>`;

    if (edge.label) {
      let lx: number, ly: number;
      if (edge.isDecisionSource && edge.points.length >= 2) {
        const srcPt = edge.points[0];
        const xDir = edge.sourceHandle === "left" ? -1 : edge.sourceHandle === "right" ? 1 : 0;
        lx = srcPt.x + xDir * 45;
        ly = srcPt.y + 30;
      } else {
        const midIdx = Math.floor(edge.points.length / 2);
        lx = edge.points[midIdx]?.x || 0;
        ly = edge.points[midIdx]?.y || 0;
      }
      const labelBgW = edge.label.length * 7 + 12;
      edgesSvg += `
        <rect x="${lx - labelBgW / 2}" y="${ly - 10}" width="${labelBgW}" height="20" rx="4" fill="#18181b" stroke="${color}" stroke-width="0.5"/>
        <text x="${lx}" y="${ly + 4}" text-anchor="middle" fill="${color}" font-size="10" font-weight="500" font-family="system-ui, sans-serif">${escapeXml(edge.label)}</text>
      `;
    }
  }

  let nodesSvg = "";
  for (const node of adjustedNodes) {
    nodesSvg += renderNodeSvg(node, viewType);
  }

  const arrowColors = new Set<string>();
  for (const edge of adjustedEdges) {
    arrowColors.add(getEdgeColor(edge.label, viewType));
  }
  let markerDefs = "";
  for (const color of arrowColors) {
    const id = `arrow-${color.replace("#", "")}`;
    markerDefs += `
      <marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
      </marker>
    `;
  }

  let pageLabelSvg = "";
  if (pageLabel) {
    pageLabelSvg = `<text x="${svgWidth - 20}" y="20" text-anchor="end" fill="#71717a" font-size="11" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(pageLabel)}</text>`;
    const pageMatch = pageLabel.match(/Page (\d+) of (\d+)/);
    if (pageMatch) {
      const currentPage = parseInt(pageMatch[1], 10);
      const totalPages = parseInt(pageMatch[2], 10);
      if (currentPage > 1) {
        pageLabelSvg += `
          <rect x="${svgWidth / 2 - 80}" y="2" width="160" height="22" rx="4" fill="#27272a" stroke="#3f3f46" stroke-width="0.5"/>
          <text x="${svgWidth / 2}" y="17" text-anchor="middle" fill="#a1a1aa" font-size="10" font-weight="500" font-family="system-ui, sans-serif">▲ Continued from Page ${currentPage - 1}</text>`;
      }
      if (currentPage < totalPages) {
        pageLabelSvg += `
          <rect x="${svgWidth / 2 - 80}" y="${svgHeight - 24}" width="160" height="22" rx="4" fill="#27272a" stroke="#3f3f46" stroke-width="0.5"/>
          <text x="${svgWidth / 2}" y="${svgHeight - 9}" text-anchor="middle" fill="#a1a1aa" font-size="10" font-weight="500" font-family="system-ui, sans-serif">▼ Continues on Page ${currentPage + 1}</text>`;
      }
    }
  }

  const bgColor = "#0a0a0f";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" text-rendering="geometricPrecision" shape-rendering="optimizeLegibility">
  <defs>${markerDefs}</defs>
  <rect width="100%" height="100%" fill="${bgColor}"/>
  ${pageLabelSvg}
  ${edgesSvg}
  ${nodesSvg}
</svg>`;
}

export async function renderProcessMapImage(
  nodes: MapNode[],
  edges: MapEdge[],
  viewType: string
): Promise<{ buffer: Buffer; width: number; height: number; pages?: { buffer: Buffer; width: number; height: number }[] } | null> {
  if (!nodes.length) return null;

  const { layoutNodes, layoutEdges } = computeLayout(nodes, edges);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of layoutNodes) {
    const nType = (n.data.nodeType || "task").toLowerCase();
    const extra = (nType === "decision" || nType === "agent-decision") ? 34 : 0;
    minX = Math.min(minX, n.x - extra);
    minY = Math.min(minY, n.y - extra);
    maxX = Math.max(maxX, n.x + n.width + extra);
    maxY = Math.max(maxY, n.y + n.height + extra);
  }
  for (const e of layoutEdges) {
    for (const p of e.points) {
      minX = Math.min(minX, p.x - 10);
      minY = Math.min(minY, p.y - 10);
      maxX = Math.max(maxX, p.x + 10);
      maxY = Math.max(maxY, p.y + 10);
    }
  }

  const padding = 50;
  const svgWidth = Math.min(maxX - minX + padding * 2, MAX_SVG_DIMENSION);
  const svgHeight = Math.min(maxY - minY + padding * 2, MAX_SVG_DIMENSION);
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

  const useMultiPage = nodes.length >= 50;

  if (useMultiPage) {
    const pageHeight = 800;
    const overlap = 60;
    const totalPages = Math.ceil(svgHeight / (pageHeight - overlap));
    const pages: { buffer: Buffer; width: number; height: number }[] = [];

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const yStart = pageIdx * (pageHeight - overlap);
      const yEnd = yStart + pageHeight;
      const pageLabel = `Page ${pageIdx + 1} of ${totalPages}`;

      const pageNodes = adjustedNodes.filter(n => {
        const nBottom = n.y + n.height;
        return nBottom > yStart && n.y < yEnd;
      }).map(n => ({ ...n, y: n.y - yStart }));

      const pageEdges = adjustedEdges.filter(e => {
        return e.points.some(p => p.y >= yStart && p.y <= yEnd);
      }).map(e => ({
        ...e,
        points: e.points.map(p => ({ x: p.x, y: p.y - yStart })),
      }));

      const actualPageHeight = Math.min(pageHeight, svgHeight - yStart);
      const svg = buildSvgContent(pageNodes, pageEdges, svgWidth, actualPageHeight, viewType, pageLabel);

      try {
        const pngBuffer = await sharp(Buffer.from(svg), { density: 200 })
          .sharpen()
          .png()
          .toBuffer();

        const maxDocWidth = 580;
        const scale = svgWidth > maxDocWidth ? maxDocWidth / svgWidth : 1;
        const docWidth = Math.round(svgWidth * scale);
        const docHeight = Math.round(actualPageHeight * scale);
        pages.push({ buffer: pngBuffer, width: docWidth, height: docHeight });
      } catch (err) {
        console.error(`[Process Map Renderer] Failed to render page ${pageIdx + 1}:`, err);
      }
    }

    if (pages.length === 0) return null;
    return { buffer: pages[0].buffer, width: pages[0].width, height: pages[0].height, pages };
  }

  const svg = buildSvgContent(adjustedNodes, adjustedEdges, svgWidth, svgHeight, viewType);

  try {
    const pngBuffer = await sharp(Buffer.from(svg), { density: 200 })
      .sharpen()
      .png()
      .toBuffer();

    const maxDocWidth = 580;
    const scale = svgWidth > maxDocWidth ? maxDocWidth / svgWidth : 1;
    const docWidth = Math.round(svgWidth * scale);
    const docHeight = Math.round(svgHeight * scale);

    return { buffer: pngBuffer, width: docWidth, height: docHeight };
  } catch (err) {
    console.error("[Process Map Renderer] Failed to render image:", err);
    return null;
  }
}
