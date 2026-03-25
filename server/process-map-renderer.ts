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
  if (t === "start" || t === "end") return { width: 44, height: 44 };
  if (t === "decision" || t === "agent-decision") return { width: 52, height: 52 };
  return { width: 240, height: 70 };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
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

    const dx0 = Math.abs(tgt0.x - srcPos.x);
    const dx1 = Math.abs(tgt1.x - srcPos.x);
    const dy0 = tgt0.y - srcPos.y;
    const dy1 = tgt1.y - srcPos.y;
    const directlyBelow0 = dx0 < 30 && dy0 > 0;
    const directlyBelow1 = dx1 < 30 && dy1 > 0;

    let handle0: string;
    let handle1: string;

    if (directlyBelow0 && !directlyBelow1) {
      handle0 = "bottom";
      handle1 = tgt1.x > srcPos.x ? "right" : "left";
    } else if (directlyBelow1 && !directlyBelow0) {
      handle1 = "bottom";
      handle0 = tgt0.x > srcPos.x ? "right" : "left";
    } else {
      const bothBelow = tgt0.y > srcPos.y && tgt1.y > srcPos.y;
      const dx = Math.abs(tgt0.x - tgt1.x);
      const isXAmbiguous = dx < 5;

      if (bothBelow && isXAmbiguous) {
        const sem0 = getLabelSemanticSide(edge0.label);
        const sem1 = getLabelSemanticSide(edge1.label);
        handle0 = sem0 === "left" ? "bottom-left" : "bottom-right";
        handle1 = sem1 === "right" ? "bottom-right" : "bottom-left";
        if (handle0 === handle1) {
          handle0 = "bottom-left";
          handle1 = "bottom-right";
        }
      } else if (bothBelow) {
        if (tgt0.x < tgt1.x) {
          handle0 = "bottom-left";
          handle1 = "bottom-right";
        } else {
          handle0 = "bottom-right";
          handle1 = "bottom-left";
        }
      } else if (isXAmbiguous) {
        const sem0 = getLabelSemanticSide(edge0.label);
        const sem1 = getLabelSemanticSide(edge1.label);
        handle0 = sem0 || "left";
        handle1 = sem1 || "right";
        if (handle0 === handle1) {
          handle0 = "left";
          handle1 = "right";
        }
      } else {
        if (tgt0.x < tgt1.x) {
          handle0 = "left";
          handle1 = "right";
        } else {
          handle0 = "right";
          handle1 = "left";
        }
      }

      const isLeftRight0 = handle0 === "left" || handle0 === "right";
      const isLeftRight1 = handle1 === "left" || handle1 === "right";
      if (isLeftRight0 && isLeftRight1) {
        const wouldCross =
          (handle0 === "left" && handle1 === "right" && tgt0.x > tgt1.x) ||
          (handle0 === "right" && handle1 === "left" && tgt0.x < tgt1.x);
        if (wouldCross) {
          const tmp = handle0;
          handle0 = handle1;
          handle1 = tmp;
        }
      }

      const isBottom0 = handle0 === "bottom-left" || handle0 === "bottom-right";
      const isBottom1 = handle1 === "bottom-left" || handle1 === "bottom-right";
      if (isBottom0 && isBottom1) {
        const wouldCross =
          (handle0 === "bottom-left" && handle1 === "bottom-right" && tgt0.x > tgt1.x) ||
          (handle0 === "bottom-right" && handle1 === "bottom-left" && tgt0.x < tgt1.x);
        if (wouldCross) {
          const tmp = handle0;
          handle0 = handle1;
          handle1 = tmp;
        }
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
    nodesep: 60,
    ranksep: 80,
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

function computeEdgePoints(srcNode: LayoutNode, tgtNode: LayoutNode): { x: number; y: number }[] {
  const sx = srcNode.x + srcNode.width / 2;
  const sy = srcNode.y + srcNode.height;
  const tx = tgtNode.x + tgtNode.width / 2;
  const ty = tgtNode.y;
  if (Math.abs(sx - tx) < 5) {
    return [{ x: sx, y: sy }, { x: tx, y: ty }];
  }
  const midY = (sy + ty) / 2;
  return [{ x: sx, y: sy }, { x: sx, y: midY }, { x: tx, y: midY }, { x: tx, y: ty }];
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

  const layoutEdges: LayoutEdge[] = edges.map((edge) => {
    let points: { x: number; y: number }[];
    if (dagreGraph) {
      const edgeData = dagreGraph.edge(String(edge.sourceNodeId), String(edge.targetNodeId), String(edge.id));
      points = edgeData?.points || [];
    } else {
      const srcNode = nodeById[String(edge.sourceNodeId)];
      const tgtNode = nodeById[String(edge.targetNodeId)];
      points = (srcNode && tgtNode) ? computeEdgePoints(srcNode, tgtNode) : [];
    }
    const srcType = nodeTypeMap[String(edge.sourceNodeId)] || "task";
    const isDecision = srcType === "decision" || srcType === "agent-decision";
    const siblings = edgesBySource[String(edge.sourceNodeId)] || [edge];
    const sourceHandle = getEdgeSourceHandle(isDecision, edge.label, siblings, edge);

    return {
      source: String(edge.sourceNodeId),
      target: String(edge.targetNodeId),
      label: edge.label || "",
      points,
      isDecisionSource: isDecision,
      sourceHandle,
    };
  });

  fixDecisionHandlesPostLayout(layoutNodes, layoutEdges, nodeTypeMap);

  for (const le of layoutEdges) {
    if (le.isDecisionSource && le.points.length >= 1) {
      const srcNode = layoutNodes.find(n => n.id === le.source);
      if (srcNode) {
        const cx = srcNode.x + srcNode.width / 2;
        const cy = srcNode.y + srcNode.height / 2;
        const diamondR = 24;
        if (le.sourceHandle === "left") {
          le.points[0] = { x: cx - diamondR, y: cy };
        } else if (le.sourceHandle === "right") {
          le.points[0] = { x: cx + diamondR, y: cy };
        } else if (le.sourceHandle === "bottom-left") {
          le.points[0] = { x: cx - diamondR * 0.5, y: cy + diamondR };
        } else if (le.sourceHandle === "bottom-right") {
          le.points[0] = { x: cx + diamondR * 0.5, y: cy + diamondR };
        } else {
          le.points[0] = { x: cx, y: cy + diamondR };
        }
      }
    }
  }

  return { layoutNodes, layoutEdges };
}

function renderEdgePath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
}

function getEdgeColor(label: string, viewType: string): string {
  const l = label.toLowerCase();
  if (l === "yes" || l === "true" || l === "approved") return "#22c55e";
  if (l === "no" || l === "false" || l === "rejected") return "#ef4444";
  return viewType === "to-be" ? "#2dd4bf" : "#6b7280";
}

function renderNodeSvg(node: LayoutNode, viewType: string): string {
  const { x, y, width, height, data } = node;
  const nType = (data.nodeType || "task").toLowerCase();

  if (nType === "start") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = 18;
    return `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#059669" stroke="#34d399" stroke-width="2"/>
      <polygon points="${cx - 5},${cy - 7} ${cx - 5},${cy + 7} ${cx + 7},${cy}" fill="white"/>
    `;
  }

  if (nType === "end") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const r = 18;
    return `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#dc2626" stroke="#f87171" stroke-width="2"/>
      <rect x="${cx - 6}" y="${cy - 6}" width="12" height="12" rx="2" fill="white"/>
    `;
  }

  if (nType === "decision" || nType === "agent-decision") {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const s = 24;
    const label = truncate(data.name || "?", 18);
    return `
      <g transform="translate(${cx}, ${cy})">
        <rect x="${-s}" y="${-s}" width="${s * 2}" height="${s * 2}" rx="4" transform="rotate(45)" fill="#d97706" stroke="#fbbf24" stroke-width="1.5"/>
        <text x="0" y="4" text-anchor="middle" fill="white" font-size="8" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(label)}</text>
      </g>
    `;
  }

  const borderColor = viewType === "to-be" ? "#2dd4bf" : "#4b5563";
  const painPointBorder = data.isPainPoint ? "#ef4444" : borderColor;
  const nameText = truncate(data.name || "Unnamed", 30);
  const roleText = data.role ? truncate(data.role, 22) : "";
  const systemText = data.system ? truncate(data.system, 22) : "";

  const maxBadgeArea = width - 16;
  let badgeSvg = "";
  let badgeX = x + 8;
  const badgeY = y + height - 18;

  if (roleText) {
    let rw = Math.min(roleText.length * 5.5 + 12, maxBadgeArea);
    badgeSvg += `
      <rect x="${badgeX}" y="${badgeY}" width="${rw}" height="14" rx="3" fill="#374151"/>
      <text x="${badgeX + rw / 2}" y="${badgeY + 10}" text-anchor="middle" fill="#9ca3af" font-size="7.5" font-family="system-ui, sans-serif">${escapeXml(roleText)}</text>
    `;
    badgeX += rw + 4;
  }
  if (systemText) {
    const remainingSpace = (x + width - 8) - badgeX;
    if (remainingSpace > 20) {
      let sw = Math.min(systemText.length * 5.5 + 12, remainingSpace);
      badgeSvg += `
        <rect x="${badgeX}" y="${badgeY}" width="${sw}" height="14" rx="3" fill="#1e293b"/>
        <text x="${badgeX + sw / 2}" y="${badgeY + 10}" text-anchor="middle" fill="#64748b" font-size="7.5" font-family="system-ui, sans-serif">${escapeXml(systemText)}</text>
      `;
    }
  }

  return `
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="#1e1e2e" stroke="${painPointBorder}" stroke-width="1.5"/>
    <text x="${x + width / 2}" y="${y + 22}" text-anchor="middle" fill="#e4e4e7" font-size="10" font-weight="600" font-family="system-ui, sans-serif">${escapeXml(nameText)}</text>
    ${badgeSvg}
  `;
}

export async function renderProcessMapImage(
  nodes: MapNode[],
  edges: MapEdge[],
  viewType: string
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
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
  let svgWidth = Math.min(maxX - minX + padding * 2, MAX_SVG_DIMENSION);
  let svgHeight = Math.min(maxY - minY + padding * 2, MAX_SVG_DIMENSION);
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
    const color = getEdgeColor(edge.label, viewType);
    const pathD = renderEdgePath(edge.points);
    if (!pathD) continue;

    edgesSvg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.5" marker-end="url(#arrow-${color.replace("#", "")})" stroke-linejoin="round"/>`;

    if (edge.label) {
      let lx: number, ly: number;
      if (edge.isDecisionSource && edge.points.length >= 2) {
        const srcPt = edge.points[0];
        const isBottomHandle = edge.sourceHandle === "bottom-left" || edge.sourceHandle === "bottom-right";
        const xDir = edge.sourceHandle === "left" ? -1 : edge.sourceHandle === "right" ? 1 : edge.sourceHandle === "bottom-left" ? -0.5 : edge.sourceHandle === "bottom-right" ? 0.5 : 0;
        lx = srcPt.x + xDir * (isBottomHandle ? 30 : 35);
        ly = srcPt.y + (isBottomHandle ? 20 : 25);
      } else {
        const midIdx = Math.floor(edge.points.length / 2);
        lx = edge.points[midIdx]?.x || 0;
        ly = edge.points[midIdx]?.y || 0;
      }
      const labelBgW = edge.label.length * 6 + 10;
      edgesSvg += `
        <rect x="${lx - labelBgW / 2}" y="${ly - 8}" width="${labelBgW}" height="16" rx="4" fill="#18181b" stroke="${color}" stroke-width="0.5"/>
        <text x="${lx}" y="${ly + 4}" text-anchor="middle" fill="${color}" font-size="8" font-weight="500" font-family="system-ui, sans-serif">${escapeXml(edge.label)}</text>
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
      <marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
      </marker>
    `;
  }

  const bgColor = "#0a0a0f";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>${markerDefs}</defs>
  <rect width="100%" height="100%" fill="${bgColor}"/>
  ${edgesSvg}
  ${nodesSvg}
</svg>`;

  try {
    const pngBuffer = await sharp(Buffer.from(svg))
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
