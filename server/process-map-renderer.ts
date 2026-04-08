import dagreImport from "@dagrejs/dagre";
import sharp from "sharp";
import { escapeXml } from "./lib/xml-utils";

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
}

const MAX_SVG_DIMENSION = 4000;

function getNodeDimensions(nodeType: string): { width: number; height: number } {
  const t = (nodeType || "task").toLowerCase();
  if (t === "start" || t === "end") return { width: 44, height: 44 };
  if (t === "decision") return { width: 52, height: 52 };
  return { width: 240, height: 70 };
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

function computeLayout(nodes: MapNode[], edges: MapEdge[]): { layoutNodes: LayoutNode[]; layoutEdges: LayoutEdge[] } {
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

  const layoutEdges: LayoutEdge[] = edges.map((edge) => {
    const edgeData = g.edge(String(edge.sourceNodeId), String(edge.targetNodeId), String(edge.id));
    return {
      source: String(edge.sourceNodeId),
      target: String(edge.targetNodeId),
      label: edge.label || "",
      points: edgeData?.points || [],
    };
  });

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

  if (nType === "decision") {
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
    const extra = nType === "decision" ? 34 : 0;
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
      const midIdx = Math.floor(edge.points.length / 2);
      const lx = edge.points[midIdx]?.x || 0;
      const ly = edge.points[midIdx]?.y || 0;
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
