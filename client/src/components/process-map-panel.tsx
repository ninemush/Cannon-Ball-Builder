import { useState, useCallback, useRef, useEffect, useMemo, Component, type ReactNode, type ErrorInfo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  Handle,
  Position,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  getBezierPath,
  useReactFlow,
  useStore,
  ReactFlowProvider,
  MarkerType,
  BackgroundVariant,
  ConnectionLineType,
  type OnReconnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import type { ProcessNode, ProcessApproval } from "@shared/schema";
import {
  Map,
  Sparkles,
  Flag,
  X,
  Save,
  Plus,
  Check,
  Loader2,
  Pencil,
  Trash2,
  User,
  Monitor,
  Bot,
  Zap,
  Play,
  Square,
  Diamond,
  GitBranch,
  CircleDot,
  LayoutGrid,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  FileText,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Layers,
  History,
  RefreshCw,
  Cable,
  Brain,
  Repeat,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTheme } from "@/components/theme-provider";

class ReactFlowErrorBoundary extends Component<{ children: ReactNode; onRetry?: () => void }, { hasError: boolean; retryCount: number }> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(props: { children: ReactNode; onRetry?: () => void }) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("[ProcessMap] Error boundary caught:", error.message);
    if (this.state.retryCount < 3) {
      this.retryTimer = setTimeout(() => {
        this.setState(prev => ({ hasError: false, retryCount: prev.retryCount + 1 }));
      }, 200 * (this.state.retryCount + 1));
    }
  }
  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
  render() {
    if (this.state.hasError) {
      if (this.state.retryCount < 3) {
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-cb-teal border-t-transparent rounded-full" />
          </div>
        );
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <AlertCircle className="h-8 w-8 text-amber-500/60" />
          <p className="text-xs text-zinc-400">Process map encountered an error</p>
          <button
            className="text-xs px-3 py-1.5 rounded-md bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 transition-colors"
            onClick={() => this.setState({ hasError: false, retryCount: 0 })}
            data-testid="button-retry-map"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function DelayedMount({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  if (!ready) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin h-6 w-6 border-2 border-cb-teal border-t-transparent rounded-full" />
    </div>
  );
  return <>{children}</>;
}

interface HistorySnapshot {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY = 50;

function useUndoRedo() {
  const pastRef = useRef<HistorySnapshot[]>([]);
  const futureRef = useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushSnapshot = useCallback((snapshot: HistorySnapshot) => {
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), snapshot];
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(
    (currentSnapshot: HistorySnapshot): HistorySnapshot | null => {
      if (pastRef.current.length === 0) return null;
      const prev = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current, currentSnapshot];
      setCanUndo(pastRef.current.length > 0);
      setCanRedo(true);
      return prev;
    },
    []
  );

  const redo = useCallback(
    (currentSnapshot: HistorySnapshot): HistorySnapshot | null => {
      if (futureRef.current.length === 0) return null;
      const next = futureRef.current[futureRef.current.length - 1];
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = [...pastRef.current, currentSnapshot];
      setCanUndo(true);
      setCanRedo(futureRef.current.length > 0);
      return next;
    },
    []
  );

  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { pushSnapshot, undo, redo, reset, canUndo, canRedo };
}

interface ProcessMapData {
  nodes: ProcessNode[];
  edges: { id: number; ideaId: string; viewType: string; sourceNodeId: number; targetNodeId: number; label: string; createdAt: string }[];
  approval: ProcessApproval | null;
  mapChanged?: boolean;
}

type ProcessView = "as-is" | "to-be" | "sdd";

interface CompletenessIssue {
  type: "missing_role" | "missing_system" | "missing_description" | "dead_end" | "no_decision" | "single_path" | "no_end";
  message: string;
  nodeId?: string;
  nodeName?: string;
  severity: "warning" | "info";
}

function analyzeCompleteness(nodes: ProcessMapData["nodes"], edges: ProcessMapData["edges"]): CompletenessIssue[] {
  const issues: CompletenessIssue[] = [];
  const actionableNodes = nodes.filter(n => n.nodeType !== "start" && n.nodeType !== "end" && n.nodeType !== "agent-loop");

  actionableNodes.forEach((n) => {
    if (!n.role?.trim()) {
      issues.push({ type: "missing_role", message: `"${n.name}" has no assigned role`, nodeId: String(n.id), nodeName: n.name, severity: "warning" });
    }
    if (!n.system?.trim() || n.system === "Manual") {
      if (n.nodeType !== "decision") {
        issues.push({ type: "missing_system", message: `"${n.name}" has no system specified`, nodeId: String(n.id), nodeName: n.name, severity: "info" });
      }
    }
  });

  const hasDecision = nodes.some(n => n.nodeType === "decision" || n.nodeType === "agent-decision");
  if (actionableNodes.length >= 3 && !hasDecision) {
    issues.push({ type: "no_decision", message: "No decision points — consider adding branching logic", severity: "info" });
  }

  const hasEnd = nodes.some(n => n.nodeType === "end");
  if (nodes.length > 1 && !hasEnd) {
    issues.push({ type: "no_end", message: "Process has no End node — add a termination point", severity: "warning" });
  }

  const nodeOutgoing: Record<number, number> = {};
  edges.forEach(e => { nodeOutgoing[e.sourceNodeId] = (nodeOutgoing[e.sourceNodeId] || 0) + 1; });
  actionableNodes.forEach(n => {
    if (!nodeOutgoing[n.id] && n.nodeType !== "end") {
      issues.push({ type: "dead_end", message: `"${n.name}" has no outgoing path — it's a dead end`, nodeId: String(n.id), nodeName: n.name, severity: "warning" });
    }
  });

  return issues.slice(0, 8);
}

interface PerformerSummary {
  human: { count: number; nodes: string[] };
  system: { count: number; nodes: string[] };
  hybrid: { count: number; nodes: string[] };
}

function analyzePerformers(nodes: ProcessMapData["nodes"]): PerformerSummary {
  const summary: PerformerSummary = {
    human: { count: 0, nodes: [] },
    system: { count: 0, nodes: [] },
    hybrid: { count: 0, nodes: [] },
  };
  nodes.forEach(n => {
    if (n.nodeType === "start" || n.nodeType === "end") return;
    const p = classifyPerformer(n.role || "", n.system || "");
    summary[p].count++;
    summary[p].nodes.push(n.name);
  });
  return summary;
}

function detectPhaseGroups(nodes: ProcessMapData["nodes"], edges: ProcessMapData["edges"]): Array<{ name: string; nodes: ProcessMapData["nodes"] }> {
  if (nodes.length < 4) return [{ name: "All Steps", nodes }];

  const ordered: ProcessMapData["nodes"] = [];
  const visited: Record<number, boolean> = {};
  const adjacency: Record<number, number[]> = {};
  edges.forEach(e => {
    if (!adjacency[e.sourceNodeId]) adjacency[e.sourceNodeId] = [];
    adjacency[e.sourceNodeId].push(e.targetNodeId);
  });

  const startNode = nodes.find(n => n.nodeType === "start");
  const queue = startNode ? [startNode.id] : [nodes[0].id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited[id]) continue;
    visited[id] = true;
    const node = nodes.find(n => n.id === id);
    if (node) ordered.push(node);
    const children = adjacency[id] || [];
    children.forEach(c => { if (!visited[c]) queue.push(c); });
  }
  nodes.forEach(n => { if (!visited[n.id]) ordered.push(n); });

  const actionable = ordered.filter(n => n.nodeType !== "start" && n.nodeType !== "end");
  if (actionable.length < 4) return [{ name: "All Steps", nodes: ordered }];

  const phaseSize = Math.max(3, Math.ceil(actionable.length / Math.min(6, Math.ceil(actionable.length / 4))));
  const groups: Array<{ name: string; nodes: ProcessMapData["nodes"] }> = [];
  
  for (let i = 0; i < actionable.length; i += phaseSize) {
    const chunk = actionable.slice(i, i + phaseSize);
    const firstLabel = chunk[0]?.name || "Phase";
    const phaseNum = Math.floor(i / phaseSize) + 1;
    groups.push({ name: `Phase ${phaseNum}: ${firstLabel}`, nodes: chunk });
  }

  return groups;
}

type DetailLevel = "L0" | "L1" | "L2";

function filterNodesForLevel(
  allNodes: ProcessMapData["nodes"],
  allEdges: ProcessMapData["edges"],
  level: DetailLevel
): { nodes: ProcessMapData["nodes"]; edges: ProcessMapData["edges"] } {
  if (level === "L2") return { nodes: allNodes, edges: allEdges };

  const phaseGroups = detectPhaseGroups(allNodes, allEdges);

  const adjacency: Record<number, { target: number; edgeLabel: string }[]> = {};
  allEdges.forEach(e => {
    if (!adjacency[e.sourceNodeId]) adjacency[e.sourceNodeId] = [];
    adjacency[e.sourceNodeId].push({ target: e.targetNodeId, edgeLabel: e.label });
  });

  const outDegree: Record<number, number> = {};
  allEdges.forEach(e => {
    outDegree[e.sourceNodeId] = (outDegree[e.sourceNodeId] || 0) + 1;
  });

  if (level === "L0") {
    let syntheticId = -1;
    let edgeId = -1;

    const nodeById: Record<number, ProcessMapData["nodes"][0]> = {};
    allNodes.forEach(n => { nodeById[n.id] = n; });

    const phaseGroupForNode: Record<number, number> = {};
    phaseGroups.forEach((group, gi) => {
      group.nodes.forEach(n => {
        if (n.nodeType !== "start" && n.nodeType !== "end") {
          phaseGroupForNode[n.id] = gi;
        }
      });
    });

    const startNodes = allNodes.filter(n => n.nodeType === "start");
    const endNodes = allNodes.filter(n => n.nodeType === "end");

    const startNodeIds = new Set(startNodes.map(n => n.id));
    const endNodeIds = new Set(endNodes.map(n => n.id));

    if (allNodes.length === 0) {
      return { nodes: [], edges: [] };
    }
    const refNode = allNodes[0];
    const makeSynthetic = (nodeType: "start" | "end", name: string): ProcessMapData["nodes"][0] => ({
      ...refNode,
      id: syntheticId--,
      name,
      nodeType,
      description: "",
      role: "",
      system: "",
      positionX: 0,
      positionY: 0,
    });
    const consolidatedStart = startNodes.length > 0
      ? { ...startNodes[0], name: "Start", positionX: 0, positionY: 0 }
      : makeSynthetic("start", "Start");
    const consolidatedEnd = endNodes.length > 0
      ? { ...endNodes[0], name: "End", positionX: 0, positionY: 0 }
      : makeSynthetic("end", "End");
    const l0StartId = consolidatedStart.id;
    const l0EndId = consolidatedEnd.id;

    const phaseSyntheticNodes: ProcessMapData["nodes"] = [];
    const phaseSyntheticIdMap: Record<number, number> = {};
    phaseGroups.forEach((group, gi) => {
      const actionable = group.nodes.filter(n => n.nodeType !== "start" && n.nodeType !== "end");
      if (actionable.length === 0) return;
      const totalSteps = actionable.length;
      const decisions = actionable.filter(n => n.nodeType === "decision" || n.nodeType === "agent-decision").length;
      const desc = decisions > 0 ? `${totalSteps} steps, ${decisions} decision${decisions > 1 ? "s" : ""}` : `${totalSteps} steps`;
      const phaseNode = {
        ...actionable[0],
        id: syntheticId,
        name: group.name,
        nodeType: "task" as const,
        description: desc,
        role: "",
        system: "",
        positionX: 0,
        positionY: 0,
      };
      phaseSyntheticNodes.push(phaseNode);
      phaseSyntheticIdMap[gi] = syntheticId;
      syntheticId--;
    });

    const l0Edges: ProcessMapData["edges"] = [];
    const seenL0Pairs = new Set<string>();

    for (const s of startNodes) {
      const children = adjacency[s.id] || [];
      for (const { target } of children) {
        const tgtNode = nodeById[target];
        if (!tgtNode) continue;
        let targetL0Id: number;
        if (endNodeIds.has(target)) {
          targetL0Id = l0EndId;
        } else if (startNodeIds.has(target)) {
          continue;
        } else {
          const gi = phaseGroupForNode[target];
          if (gi !== undefined && phaseSyntheticIdMap[gi] !== undefined) {
            targetL0Id = phaseSyntheticIdMap[gi];
          } else continue;
        }
        const key = `${l0StartId}->${targetL0Id}`;
        if (!seenL0Pairs.has(key)) {
          seenL0Pairs.add(key);
          l0Edges.push({
            id: edgeId--,
            ideaId: allEdges[0]?.ideaId || s.ideaId,
            viewType: allEdges[0]?.viewType || "as-is",
            sourceNodeId: l0StartId,
            targetNodeId: targetL0Id,
            label: "",
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    for (let gi = 0; gi < phaseGroups.length; gi++) {
      const srcPhaseId = phaseSyntheticIdMap[gi];
      if (srcPhaseId === undefined) continue;

      const group = phaseGroups[gi];
      const groupNodeIds = new Set(group.nodes.map(n => n.id));

      const externalTargets = new Set<number>();
      group.nodes.forEach(n => {
        (adjacency[n.id] || []).forEach(({ target }) => {
          if (!groupNodeIds.has(target)) {
            externalTargets.add(target);
          }
        });
      });

      externalTargets.forEach(targetId => {
        const tgtNode = nodeById[targetId];
        if (!tgtNode) return;
        let targetL0Id: number;
        if (endNodeIds.has(targetId)) {
          targetL0Id = l0EndId;
        } else if (startNodeIds.has(targetId)) {
          return;
        } else {
          const tgi = phaseGroupForNode[targetId];
          if (tgi !== undefined && phaseSyntheticIdMap[tgi] !== undefined) {
            targetL0Id = phaseSyntheticIdMap[tgi];
          } else return;
        }
        if (srcPhaseId === targetL0Id) return;
        const key = `${srcPhaseId}->${targetL0Id}`;
        if (!seenL0Pairs.has(key)) {
          seenL0Pairs.add(key);
          l0Edges.push({
            id: edgeId--,
            ideaId: allEdges[0]?.ideaId || "",
            viewType: allEdges[0]?.viewType || "as-is",
            sourceNodeId: srcPhaseId,
            targetNodeId: targetL0Id,
            label: "",
            createdAt: new Date().toISOString(),
          });
        }
      });
    }

    const resultNodes: ProcessMapData["nodes"] = [
      consolidatedStart,
      consolidatedEnd,
      ...phaseSyntheticNodes,
    ];

    return { nodes: resultNodes, edges: l0Edges };
  }

  const keepIds = new Set<number>();
  allNodes.forEach(n => {
    if (n.nodeType === "start" || n.nodeType === "end") {
      keepIds.add(n.id);
    }
  });

  allNodes.forEach(n => {
    if ((n.nodeType === "decision" || n.nodeType === "agent-decision") && (outDegree[n.id] || 0) >= 3) {
      keepIds.add(n.id);
    }
  });

  phaseGroups.forEach((group) => {
    const tasks = group.nodes.filter(n => n.nodeType === "task" || n.nodeType === "agent-task" || n.nodeType === "agent-loop");
    if (tasks.length > 0) {
      keepIds.add(tasks[0].id);
      if (tasks.length > 1) keepIds.add(tasks[tasks.length - 1].id);
    }
  });

  const filteredNodes = allNodes.filter(n => keepIds.has(n.id));

  const bridgeEdges: ProcessMapData["edges"] = [];
  let bridgeEdgeId = -1;
  const seenEdgePairs = new Set<string>();

  keepIds.forEach(sourceId => {
    const visited = new Set<number>();
    const toVisit = [...(adjacency[sourceId] || [])];

    while (toVisit.length > 0) {
      const { target, edgeLabel } = toVisit.shift()!;
      if (visited.has(target)) continue;
      visited.add(target);

      if (keepIds.has(target)) {
        const pairKey = `${sourceId}->${target}`;
        if (!seenEdgePairs.has(pairKey)) {
          seenEdgePairs.add(pairKey);
          bridgeEdges.push({
            id: bridgeEdgeId--,
            ideaId: allEdges[0]?.ideaId || "",
            viewType: allEdges[0]?.viewType || "as-is",
            sourceNodeId: sourceId,
            targetNodeId: target,
            label: edgeLabel,
            createdAt: new Date().toISOString(),
          });
        }
      } else {
        const nextEdges = adjacency[target] || [];
        nextEdges.forEach(ne => {
          if (!visited.has(ne.target)) toVisit.push(ne);
        });
      }
    }
  });

  return { nodes: filteredNodes, edges: bridgeEdges };
}

interface ProcessMapPanelProps {
  ideaId: string;
  onStepsChange?: (count: number) => void;
  onApproved?: () => void;
  onCompletenessChange?: (pct: number) => void;
  onViewChange?: (view: ProcessView) => void;
  onSwitchViewReady?: (fn: (view: ProcessView) => void) => void;
}

function getNodeDimensions(nodeType: string): { width: number; height: number } {
  if (nodeType === "start") return { width: 72, height: 72 };
  if (nodeType === "end") return { width: 72, height: 72 };
  if (nodeType === "decision") return { width: 100, height: 100 };
  if (nodeType === "agent-decision") return { width: 100, height: 120 };
  if (nodeType === "agent-loop") return { width: 280, height: 110 };
  if (nodeType === "agent-task") return { width: 280, height: 120 };
  return { width: 280, height: 100 };
}

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "LR" | "TB" = "TB",
  simplified: boolean = false
): Node[] {
  const nodeCount = nodes.length;
  const edgeCount = edges.length;

  const density = edgeCount / Math.max(nodeCount, 1);
  const isLarge = nodeCount > 30;
  const isVeryLarge = nodeCount > 60;

  let nodesep: number;
  let ranksep: number;
  let edgesep: number;

  if (simplified) {
    nodesep = 180;
    ranksep = 120;
    edgesep = 80;
  } else if (isVeryLarge) {
    nodesep = Math.round(80 + density * 20);
    ranksep = Math.round(120 + density * 15);
    edgesep = Math.round(30 + density * 10);
  } else if (isLarge) {
    nodesep = Math.round(100 + density * 25);
    ranksep = Math.round(140 + density * 20);
    edgesep = Math.round(40 + density * 15);
  } else {
    nodesep = 140;
    ranksep = 200;
    edgesep = 60;
  }

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep,
    ranksep,
    edgesep,
    marginx: 60,
    marginy: 60,
    ranker: "longest-path",
    align: isLarge ? "UL" : undefined,
  });

  nodes.forEach((node) => {
    const nodeType = (node.data as any)?.nodeType || "task";
    const dims = getNodeDimensions(nodeType);
    g.setNode(node.id, { width: dims.width, height: dims.height });
  });

  const outDeg: Record<string, number> = {};
  const inDeg: Record<string, number> = {};
  edges.forEach((edge) => {
    outDeg[edge.source] = (outDeg[edge.source] || 0) + 1;
    inDeg[edge.target] = (inDeg[edge.target] || 0) + 1;
  });

  const sortedEdges = [...edges].sort((a, b) => {
    const aFanout = outDeg[a.source] || 1;
    const bFanout = outDeg[b.source] || 1;
    return bFanout - aFanout;
  });

  sortedEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  try {
    dagre.layout(g);
  } catch (err) {
    console.warn("[dagre] layout failed, nodes:", g.nodes().length, "edges:", g.edges().length, "graph opts:", JSON.stringify(g.graph()), err);
    return nodes.map((node, i) => ({
      ...node,
      position: { x: (i % 6) * 200 + 60, y: Math.floor(i / 6) * 150 + 60 },
    }));
  }

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) {
      return { ...node, position: { x: 0, y: 0 } };
    }
    const nodeType = (node.data as any)?.nodeType || "task";
    const dims = getNodeDimensions(nodeType);
    return {
      ...node,
      position: {
        x: pos.x - dims.width / 2,
        y: pos.y - dims.height / 2,
      },
    };
  });
}

function getNodePosition(index: number, total: number) {
  const cols = Math.min(total, 3);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: 80 + col * 260,
    y: 80 + row * 120,
  };
}

function getNodeConfidence(data: any): number {
  let score = 0;
  if (data.label && data.label.trim()) score += 25;
  if (data.role && data.role.trim()) score += 25;
  if (data.system && data.system.trim() && data.system !== "Manual") score += 25;
  if (data.description && data.description.trim()) score += 25;
  if (data.nodeType === "start" || data.nodeType === "end") return 100;
  if (data.nodeType === "agent-loop") return Math.max(score, 50);
  return score;
}

type PerformerType = "human" | "system" | "hybrid";

function classifyPerformer(role: string, system: string): PerformerType {
  const r = (role || "").toLowerCase().trim();
  const s = (system || "").toLowerCase().trim();
  const humanKeywords = ["customer", "user", "officer", "clerk", "analyst", "manager", "agent", "specialist", "admin", "employee", "staff", "reviewer", "approver", "supervisor"];
  const systemKeywords = ["system", "api", "bot", "erp", "crm", "app", "platform", "email", "sms", "portal", "database", "server", "automation", "rpa", "mobile"];
  const isHuman = humanKeywords.some((k) => r.includes(k));
  const isSystem = systemKeywords.some((k) => r.includes(k) || s.includes(k));
  if (isHuman && isSystem) return "hybrid";
  if (isSystem) return "system";
  if (isHuman) return "human";
  if (s && s !== "manual") return "system";
  return "human";
}

function NodeHoverTooltip({ data, visible }: { data: any; visible: boolean }) {
  if (!visible) return null;

  const performer = classifyPerformer(data.role || "", data.system || "");
  const isAutomated = data.viewType === "to-be" && (data.description || "").startsWith("[AUTOMATED]");
  const performerLabel = performer === "system" ? "System" : performer === "hybrid" ? "Hybrid" : "Human";
  const PerformerIcon = performer === "system" ? Monitor : performer === "hybrid" ? Bot : User;
  const cleanDescription = isAutomated
    ? (data.description || "").replace(/^\[AUTOMATED\]\s*/, "")
    : (data.description || "");

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{ bottom: "calc(100% + 8px)" }}
      data-testid={`tooltip-node-${data.nodeId || ""}`}
    >
      <div
        className="rounded-lg px-3 py-2.5 text-left shadow-xl min-w-[200px] max-w-[300px] bg-white/95 dark:bg-[rgba(15,15,20,0.85)] backdrop-blur-xl border border-gray-200 dark:border-white/10"
      >
        <div className="text-[12px] font-semibold text-gray-900 dark:text-white/90 leading-snug break-words">
          {data.label}
        </div>
        {data.role && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <PerformerIcon className="h-3 w-3 text-gray-400 dark:text-white/40 flex-shrink-0" />
            <span className="text-[10px] text-gray-500 dark:text-white/50">{data.role}</span>
          </div>
        )}
        {data.system && data.system !== "Manual" && data.system !== "manual" && (
          <div className="flex items-center gap-1.5 mt-1">
            <Monitor className="h-3 w-3 text-gray-400 dark:text-white/40 flex-shrink-0" />
            <span className="text-[10px] text-gray-500 dark:text-white/50">{data.system}</span>
          </div>
        )}
        {cleanDescription && (
          <div className="mt-1.5 text-[10px] text-gray-400 dark:text-white/40 leading-relaxed break-words line-clamp-3">
            {cleanDescription}
          </div>
        )}
        <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-gray-200 dark:border-white/10">
          <span className="text-[9px] text-gray-400 dark:text-white/30">{performerLabel}</span>
          {isAutomated && (
            <span className="flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-green-400" />
              <span className="text-[9px] text-green-400/80 font-medium">Automated</span>
            </span>
          )}
          {data.isPainPoint && (
            <span className="flex items-center gap-1">
              <Flag className="h-2.5 w-2.5 text-red-400" />
              <span className="text-[9px] text-red-400/80 font-medium">Pain Point</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function useNodeHover(delay = 200) {
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setIsHovered(true), delay);
  }, [delay]);

  const onMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsHovered(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { isHovered, onMouseEnter, onMouseLeave };
}

const connectionNodeIdSelector = (state: any) => state.connectionNodeId;

function useConnectionState(nodeId: string) {
  const connectionNodeId = useStore(connectionNodeIdSelector);
  const isConnecting = connectionNodeId !== null;
  const isSource = connectionNodeId === nodeId;
  return { isConnecting, isSource };
}

function NodeHandles({
  nodeId,
  isHovered,
  connectModeSourceId,
  sourceHandles,
  targetHandles,
}: {
  nodeId: string;
  isHovered: boolean;
  connectModeSourceId?: string | null;
  sourceHandles: { position: Position; id?: string }[];
  targetHandles: { position: Position; id?: string }[];
}) {
  const { isConnecting, isSource } = useConnectionState(nodeId);

  const showSources = isHovered || isSource || connectModeSourceId === nodeId;
  const showTargets = (isConnecting && !isSource) || (!!connectModeSourceId && connectModeSourceId !== nodeId);

  return (
    <>
      {targetHandles.map((h, i) => (
        <Handle
          key={`t-${h.id || i}`}
          type="target"
          position={h.position}
          id={h.id}
          className={`!w-[6px] !h-[6px] ${showTargets ? "handle-target-visible" : ""}`}
        />
      ))}
      {sourceHandles.map((h, i) => (
        <Handle
          key={`s-${h.id || i}`}
          type="source"
          position={h.position}
          id={h.id}
          className={`!w-[6px] !h-[6px] ${showSources ? "handle-source-visible" : ""}`}
        />
      ))}
    </>
  );
}

function StartNode({ data, id }: { data: any; id: string }) {
  const { isHovered, onMouseEnter, onMouseLeave } = useNodeHover(100);
  const connectModeSourceId = data.connectModeSourceId;
  return (
    <div
      className={`flex items-center justify-center ${connectModeSourceId === id ? "connect-mode-source rounded-full" : ""}`}
      style={{ width: 72, height: 72 }}
      data-testid={`node-${id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeHandles
        nodeId={id}
        isHovered={isHovered}
        connectModeSourceId={connectModeSourceId}
        targetHandles={[{ position: Position.Top }]}
        sourceHandles={[
          { position: Position.Bottom },
          { position: Position.Right, id: "right" },
          { position: Position.Left, id: "left" },
        ]}
      />
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
        style={{
          background: "linear-gradient(135deg, #10b981, #059669)",
          border: "3px solid #34d399",
        }}
      >
        <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
      </div>
    </div>
  );
}

function EndNode({ data, id }: { data: any; id: string }) {
  const { isHovered, onMouseEnter, onMouseLeave } = useNodeHover(100);
  const connectModeSourceId = data.connectModeSourceId;
  return (
    <div
      className={`flex items-center justify-center ${connectModeSourceId === id ? "connect-mode-source rounded-full" : ""}`}
      style={{ width: 72, height: 72 }}
      data-testid={`node-${id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeHandles
        nodeId={id}
        isHovered={isHovered}
        connectModeSourceId={connectModeSourceId}
        targetHandles={[
          { position: Position.Top },
          { position: Position.Left, id: "left-target" },
          { position: Position.Right, id: "right-target" },
        ]}
        sourceHandles={[{ position: Position.Bottom }]}
      />
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30"
        style={{
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          border: "3px solid #f87171",
        }}
      >
        <Square className="h-4 w-4 text-white" fill="white" />
      </div>
    </div>
  );
}

function DecisionNode({ data, id }: { data: any; id: string }) {
  const performer = classifyPerformer(data.role || "", data.system || "");
  const isAutomated = data.viewType === "to-be" && (data.description || "").startsWith("[AUTOMATED]");
  const { isHovered, onMouseEnter, onMouseLeave } = useNodeHover();
  const connectModeSourceId = data.connectModeSourceId;

  const bgColor = isAutomated ? "#166534" : "#92400e";
  const borderColor = isAutomated ? "#22c55e" : "#f59e0b";
  const glowColor = isAutomated ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)";

  return (
    <div
      className={`relative flex items-center justify-center cursor-pointer ${connectModeSourceId === id ? "connect-mode-source" : ""}`}
      style={{ width: 100, height: 100 }}
      data-testid={`node-${id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeHoverTooltip data={{ ...data, nodeId: id }} visible={isHovered} />
      <NodeHandles
        nodeId={id}
        isHovered={isHovered}
        connectModeSourceId={connectModeSourceId}
        targetHandles={[
          { position: Position.Top },
          { position: Position.Left, id: "left-target" },
        ]}
        sourceHandles={[
          { position: Position.Bottom, id: "bottom" },
          { position: Position.Right, id: "right" },
          { position: Position.Left, id: "left" },
        ]}
      />
      <div
        className="absolute transition-all hover:brightness-110"
        style={{
          width: 70,
          height: 70,
          transform: "rotate(45deg)",
          background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
          border: `2.5px solid ${borderColor}`,
          borderRadius: 8,
          boxShadow: `0 4px 20px ${glowColor}`,
        }}
      />
      <div className="relative z-10 text-center" style={{ maxWidth: 80 }}>
        <div className="text-white text-[10px] font-bold leading-tight line-clamp-2 px-0.5">
          {data.label}
        </div>
      </div>
      {data.isPainPoint && <Flag className="absolute -top-1.5 -right-1.5 h-3 w-3 text-red-500 fill-red-500 z-20" />}
    </div>
  );
}

function TaskNode({ data, id }: { data: any; id: string }) {
  const confidence = getNodeConfidence(data);
  const performer = classifyPerformer(data.role || "", data.system || "");
  const isAutomated = data.viewType === "to-be" && (data.description || "").startsWith("[AUTOMATED]");
  const isLowConf = confidence < 50;
  const isGhost = data.isGhost;
  const { isHovered, onMouseEnter, onMouseLeave } = useNodeHover();
  const connectModeSourceId = data.connectModeSourceId;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const accentColor = isAutomated ? "#22c55e" : performer === "system" ? "#8b5cf6" : performer === "hybrid" ? "#f59e0b" : "#3b82f6";
  const bgColor = isAutomated
    ? (isDark ? "rgba(22,101,52,0.3)" : "rgba(22,101,52,0.08)")
    : (isDark ? "rgba(30,30,36,0.95)" : "rgba(255,255,255,0.98)");
  const borderColor = isGhost || isLowConf
    ? (isDark ? "rgba(75,75,85,0.5)" : "rgba(209,213,219,0.7)")
    : (isDark ? "rgba(55,55,65,0.8)" : "rgba(229,231,235,1)");
  const boxShadow = isDark
    ? "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)"
    : "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)";

  const PerformerIcon = performer === "system" ? Monitor : performer === "hybrid" ? Bot : User;

  return (
    <div
      className={`relative cursor-pointer group ${connectModeSourceId === id ? "connect-mode-source rounded-xl" : ""}`}
      style={{
        width: 280,
        opacity: isGhost || isLowConf ? 0.5 : 1,
        borderStyle: isGhost ? "dashed" : "solid",
      }}
      data-testid={`node-${id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeHoverTooltip data={{ ...data, nodeId: id }} visible={isHovered} />
      <NodeHandles
        nodeId={id}
        isHovered={isHovered}
        connectModeSourceId={connectModeSourceId}
        targetHandles={[
          { position: Position.Top },
          { position: Position.Left, id: "left-target" },
        ]}
        sourceHandles={[
          { position: Position.Bottom },
          { position: Position.Right, id: "right" },
          { position: Position.Left, id: "left" },
        ]}
      />
      <div
        className="rounded-xl overflow-hidden transition-all duration-200 group-hover:shadow-lg"
        style={{
          background: bgColor,
          border: `1.5px solid ${borderColor}`,
          boxShadow,
        }}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
        />
        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
            >
              <PerformerIcon className="h-3.5 w-3.5" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-semibold leading-tight line-clamp-2 ${isDark ? "text-white/90" : "text-gray-900"}`}>
                {data.label}
              </div>
              {data.role && (
                <div className={`text-[10px] mt-0.5 line-clamp-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>{data.role}</div>
              )}
            </div>
          </div>
          {data.system && data.system !== "manual" && data.system !== "Manual" && (
            <div className="mt-1.5 flex items-center gap-1">
              <Monitor className={`h-3 w-3 ${isDark ? "text-white/25" : "text-gray-400"}`} />
              <span className={`text-[9px] line-clamp-2 ${isDark ? "text-white/30" : "text-gray-400"}`}>{data.system}</span>
            </div>
          )}
          {isAutomated && (
            <div className="mt-1.5 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-green-400" />
              <span className="text-[9px] text-green-400/80 font-medium">Automated</span>
            </div>
          )}
        </div>
      </div>
      {data.isPainPoint && <Flag className="absolute -top-1.5 -right-1.5 h-3 w-3 text-red-500 fill-red-500 z-10" />}
    </div>
  );
}

function AgentTaskNode({ data, id }: { data: any; id: string }) {
  const confidence = getNodeConfidence(data);
  const isLowConf = confidence < 50;
  const isGhost = data.isGhost;
  const { isHovered, onMouseEnter, onMouseLeave } = useNodeHover();
  const connectModeSourceId = data.connectModeSourceId;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const accentColor = "#a855f7";
  const bgColor = isDark ? "rgba(88,28,135,0.25)" : "rgba(147,51,234,0.06)";
  const borderColor = isGhost || isLowConf
    ? (isDark ? "rgba(139,92,246,0.3)" : "rgba(168,85,247,0.3)")
    : (isDark ? "rgba(139,92,246,0.5)" : "rgba(168,85,247,0.45)");
  const boxShadow = isDark
    ? "0 2px 12px rgba(139,92,246,0.15), inset 0 1px 0 rgba(255,255,255,0.03)"
    : "0 1px 3px rgba(139,92,246,0.12), 0 1px 2px rgba(139,92,246,0.08)";

  return (
    <div
      className={`relative cursor-pointer group ${connectModeSourceId === id ? "connect-mode-source rounded-xl" : ""}`}
      style={{
        width: 280,
        opacity: isGhost || isLowConf ? 0.5 : 1,
        borderStyle: isGhost ? "dashed" : "solid",
      }}
      data-testid={`node-${id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeHoverTooltip data={{ ...data, nodeId: id }} visible={isHovered} />
      <NodeHandles
        nodeId={id}
        isHovered={isHovered}
        connectModeSourceId={connectModeSourceId}
        targetHandles={[
          { position: Position.Top },
          { position: Position.Left, id: "left-target" },
        ]}
        sourceHandles={[
          { position: Position.Bottom },
          { position: Position.Right, id: "right" },
          { position: Position.Left, id: "left" },
        ]}
      />
      <div
        className="rounded-xl overflow-hidden transition-all duration-200 group-hover:shadow-lg"
        style={{
          background: bgColor,
          border: `1.5px solid ${borderColor}`,
          boxShadow,
        }}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: `linear-gradient(90deg, ${accentColor}, #c084fc)` }}
        />
        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.3)" }}
            >
              <Brain className="h-3.5 w-3.5" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-semibold leading-tight line-clamp-2 ${isDark ? "text-white/90" : "text-gray-900"}`}>
                {data.label}
              </div>
              {data.role && (
                <div className={`text-[10px] mt-0.5 line-clamp-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>{data.role}</div>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <Brain className="h-2.5 w-2.5 text-purple-400" />
            <span className="text-[9px] text-purple-400/80 font-medium">AI Agent</span>
          </div>
        </div>
      </div>
      {data.isPainPoint && <Flag className="absolute -top-1.5 -right-1.5 h-3 w-3 text-red-500 fill-red-500 z-10" />}
    </div>
  );
}

function AgentDecisionNode({ data, id }: { data: any; id: string }) {
  const { isHovered, onMouseEnter, onMouseLeave } = useNodeHover();
  const connectModeSourceId = data.connectModeSourceId;

  const bgColor = "#581c87";
  const borderColor = "#a855f7";
  const glowColor = "rgba(168,85,247,0.2)";

  return (
    <div
      className={`relative flex items-center justify-center cursor-pointer ${connectModeSourceId === id ? "connect-mode-source" : ""}`}
      style={{ width: 100, height: 100 }}
      data-testid={`node-${id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeHoverTooltip data={{ ...data, nodeId: id }} visible={isHovered} />
      <NodeHandles
        nodeId={id}
        isHovered={isHovered}
        connectModeSourceId={connectModeSourceId}
        targetHandles={[
          { position: Position.Top },
          { position: Position.Left, id: "left-target" },
        ]}
        sourceHandles={[
          { position: Position.Bottom, id: "bottom" },
          { position: Position.Right, id: "right" },
          { position: Position.Left, id: "left" },
        ]}
      />
      <div
        className="absolute transition-all hover:brightness-110"
        style={{
          width: 70,
          height: 70,
          transform: "rotate(45deg)",
          background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
          border: `2.5px solid ${borderColor}`,
          borderRadius: 8,
          boxShadow: `0 4px 20px ${glowColor}`,
        }}
      />
      <div className="relative z-10 text-center" style={{ maxWidth: 80 }}>
        <Brain className="h-3 w-3 text-purple-300 mx-auto mb-0.5" />
        <div className="text-white text-[10px] font-bold leading-tight line-clamp-2 px-0.5">
          {data.label}
        </div>
      </div>
      {data.isPainPoint && <Flag className="absolute -top-1.5 -right-1.5 h-3 w-3 text-red-500 fill-red-500 z-20" />}
    </div>
  );
}

function AgentLoopNode({ data, id }: { data: any; id: string }) {
  const isGhost = data.isGhost;
  const { isHovered, onMouseEnter, onMouseLeave } = useNodeHover();
  const connectModeSourceId = data.connectModeSourceId;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const accentColor = "#a855f7";
  const bgColor = isDark ? "rgba(88,28,135,0.2)" : "rgba(147,51,234,0.05)";
  const borderColor = isDark ? "rgba(139,92,246,0.4)" : "rgba(168,85,247,0.35)";
  const boxShadow = isDark
    ? "0 2px 12px rgba(139,92,246,0.12), inset 0 1px 0 rgba(255,255,255,0.03)"
    : "0 1px 3px rgba(139,92,246,0.1), 0 1px 2px rgba(139,92,246,0.06)";

  return (
    <div
      className={`relative cursor-pointer group ${connectModeSourceId === id ? "connect-mode-source rounded-xl" : ""}`}
      style={{
        width: 280,
        opacity: isGhost ? 0.5 : 1,
        borderStyle: isGhost ? "dashed" : "solid",
      }}
      data-testid={`node-${id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <NodeHoverTooltip data={{ ...data, nodeId: id }} visible={isHovered} />
      <NodeHandles
        nodeId={id}
        isHovered={isHovered}
        connectModeSourceId={connectModeSourceId}
        targetHandles={[
          { position: Position.Top },
          { position: Position.Left, id: "left-target" },
        ]}
        sourceHandles={[
          { position: Position.Bottom },
          { position: Position.Right, id: "right" },
          { position: Position.Left, id: "left" },
        ]}
      />
      <div
        className="rounded-xl overflow-hidden transition-all duration-200 group-hover:shadow-lg"
        style={{
          background: bgColor,
          border: `2px dashed ${borderColor}`,
          boxShadow,
        }}
      >
        <div
          className="h-1.5 w-full"
          style={{ background: `linear-gradient(90deg, ${accentColor}88, #c084fc88, ${accentColor}88)` }}
        />
        <div className="px-4 py-3">
          <div className="flex items-start gap-2">
            <div
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.3)" }}
            >
              <Repeat className="h-3.5 w-3.5" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-[13px] font-semibold leading-tight line-clamp-2 ${isDark ? "text-white/90" : "text-gray-900"}`}>
                {data.label}
              </div>
              {data.role && (
                <div className={`text-[10px] mt-0.5 line-clamp-2 ${isDark ? "text-white/40" : "text-gray-500"}`}>{data.role}</div>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <Repeat className="h-2.5 w-2.5 text-purple-400" />
            <span className="text-[9px] text-purple-400/80 font-medium">Agent Loop</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProcessNodeComponent({ data, id }: { data: any; id: string }) {
  const nodeType = data.nodeType || "task";
  if (nodeType === "start") return <StartNode data={data} id={id} />;
  if (nodeType === "end") return <EndNode data={data} id={id} />;
  if (nodeType === "decision") return <DecisionNode data={data} id={id} />;
  if (nodeType === "agent-task") return <AgentTaskNode data={data} id={id} />;
  if (nodeType === "agent-decision") return <AgentDecisionNode data={data} id={id} />;
  if (nodeType === "agent-loop") return <AgentLoopNode data={data} id={id} />;
  return <TaskNode data={data} id={id} />;
}

function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: any) {
  const sourceIndex = data?.sourceIndex || 0;
  const sourceSiblings = data?.sourceSiblings || 1;
  const targetIndex = data?.targetIndex || 0;
  const targetSiblings = data?.targetSiblings || 1;
  const totalNodes = data?.totalNodes || 0;
  const simplified = data?.simplified || false;
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const useBezier = simplified || totalNodes > 25;

  const sourceOffset = simplified ? 0 : (sourceSiblings > 1 ? (sourceIndex - (sourceSiblings - 1) / 2) * (useBezier ? 12 : 20) : 0);
  const targetOffset = simplified ? 0 : (targetSiblings > 1 ? (targetIndex - (targetSiblings - 1) / 2) * (useBezier ? 12 : 20) : 0);

  const [edgePath, labelX, labelY] = useBezier
    ? getBezierPath({
        sourceX: sourceX + sourceOffset,
        sourceY,
        sourcePosition,
        targetX: targetX + targetOffset,
        targetY,
        targetPosition,
      })
    : getSmoothStepPath({
        sourceX: sourceX + sourceOffset,
        sourceY,
        sourcePosition,
        targetX: targetX + targetOffset,
        targetY,
        targetPosition,
        borderRadius: 16,
        offset: (Math.abs(sourceOffset) > 0 || Math.abs(targetOffset) > 0) ? 25 + Math.max(Math.abs(sourceOffset), Math.abs(targetOffset)) : 20,
      });

  const label = data?.label || "";
  const isYes = /^(yes|approved|pass|valid|complete|true|within|below|stp|auto)/i.test(label);
  const isNo = /^(no|rejected|fail|invalid|incomplete|false|exceed|above|poor|flag)/i.test(label);
  const isPartial = /^(partial|medium|check)/i.test(label);
  const isToBeView = data?.viewType === "to-be";
  const isSddView = data?.viewType === "sdd";

  let edgeColor = isDark ? "rgba(120,120,145,0.35)" : "rgba(100,116,139,0.45)";
  if (isSddView) edgeColor = isDark ? "rgba(249,115,22,0.5)" : "rgba(249,115,22,0.6)";
  else if (isToBeView) edgeColor = isDark ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.6)";
  else if (isYes) edgeColor = "rgba(34,197,94,0.7)";
  else if (isNo) edgeColor = "rgba(239,68,68,0.7)";
  else if (isPartial) edgeColor = "rgba(245,158,11,0.7)";
  else if (label) edgeColor = isDark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.6)";

  const strokeWidth = simplified ? 2 : useBezier ? (label ? 1.2 : 0.8) : (label ? 1.5 : 1);
  const edgeOpacity = simplified ? 0.85 : useBezier ? 0.7 : 1;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth,
          strokeLinecap: "round" as const,
          opacity: edgeOpacity,
        }}
        className="transition-all duration-200 hover:!stroke-[3px] hover:!opacity-100"
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
              zIndex: 10,
            }}
            className={`px-2 py-0.5 rounded text-[9px] font-medium cursor-pointer transition-all max-w-[140px] truncate ${
              isYes
                ? (isDark
                    ? "bg-emerald-950/95 border border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-900/30"
                    : "bg-emerald-50 border border-emerald-300 text-emerald-700 shadow-sm")
                : isNo
                ? (isDark
                    ? "bg-red-950/95 border border-red-500/30 text-red-300 shadow-sm shadow-red-900/30"
                    : "bg-red-50 border border-red-300 text-red-700 shadow-sm")
                : isPartial
                ? (isDark
                    ? "bg-amber-950/95 border border-amber-500/30 text-amber-300 shadow-sm shadow-amber-900/30"
                    : "bg-amber-50 border border-amber-300 text-amber-700 shadow-sm")
                : (isDark
                    ? "bg-zinc-900/95 border border-zinc-600/30 text-zinc-400 shadow-sm shadow-zinc-900/30"
                    : "bg-white border border-gray-200 text-gray-600 shadow-sm")
            }`}
            data-testid={`edge-label-${id}`}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes: NodeTypes = {
  processNode: ProcessNodeComponent,
};

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

const defaultEdgeOpts = {
  type: "custom",
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
  },
};

const connectionStyle = { stroke: "rgba(251,146,60,0.6)", strokeWidth: 2 };
const proOpts = { hideAttribution: true };
const snapGridVal: [number, number] = [10, 10];

interface NodeEditData {
  nodeId: number;
  name: string;
  role: string;
  system: string;
  nodeType: "task" | "decision" | "start" | "end" | "agent-task" | "agent-decision" | "agent-loop";
  description: string;
  isPainPoint: boolean;
}

interface EdgeEditData {
  edgeId: number;
  label: string;
}

function InlineEditPanel({
  editData,
  onChange,
  onSave,
  onCancel,
  onDelete,
  isNew,
}: {
  editData: NodeEditData;
  onChange: (data: NodeEditData) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  isNew?: boolean;
}) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-l border-gray-200 dark:border-zinc-800 z-50 flex flex-col overflow-y-auto" data-testid="panel-node-edit">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Pencil className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-gray-900 dark:text-white">{isNew ? "Add Step" : "Edit Step"}</span>
        </div>
        <button onClick={onCancel} className="text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors" data-testid="button-close-edit">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Step Name</label>
          <input
            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.name}
            onChange={(e) => onChange({ ...editData, name: e.target.value })}
            data-testid="input-node-name"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Role</label>
          <input
            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.role}
            onChange={(e) => onChange({ ...editData, role: e.target.value })}
            data-testid="input-node-role"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">System</label>
          <input
            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.system}
            onChange={(e) => onChange({ ...editData, system: e.target.value })}
            data-testid="input-node-system"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Type</label>
          <select
            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.nodeType}
            onChange={(e) => onChange({ ...editData, nodeType: e.target.value as any })}
            data-testid="select-node-type"
          >
            <option value="task">Task</option>
            <option value="decision">Decision / Gateway</option>
            <option value="start">Start Event</option>
            <option value="end">End Event</option>
            <option value="agent-task">Agent Task (AI)</option>
            <option value="agent-decision">Agent Decision (AI)</option>
            <option value="agent-loop">Agent Loop (AI)</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Description</label>
          <textarea
            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none transition-all"
            rows={3}
            value={editData.description}
            onChange={(e) => onChange({ ...editData, description: e.target.value })}
            data-testid="input-node-description"
          />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer group" data-testid="toggle-pain-point">
          <input
            type="checkbox"
            checked={editData.isPainPoint}
            onChange={(e) => onChange({ ...editData, isPainPoint: e.target.checked })}
            className="rounded border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-red-500 focus:ring-red-500/30"
          />
          <Flag className="h-3 w-3 text-red-400 group-hover:text-red-300" />
          <span className="text-xs text-zinc-400 group-hover:text-zinc-300">Pain point</span>
        </label>
      </div>
      <div className="p-4 border-t border-gray-200 dark:border-zinc-800 flex items-center gap-2">
        <Button size="sm" className="flex-1 text-xs h-8 rounded-lg" onClick={onSave} data-testid="button-save-node">
          <Save className="h-3 w-3 mr-1.5" /> Save
        </Button>
        {!isNew && onDelete && (
          <Button size="sm" variant="ghost" className="text-xs h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={onDelete} data-testid="button-delete-node">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-xs h-8 text-zinc-400" onClick={onCancel} data-testid="button-cancel-edit">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function EdgeLabelEditPopup({
  editData,
  onChange,
  onSave,
  onCancel,
  position,
}: {
  editData: EdgeEditData;
  onChange: (data: EdgeEditData) => void;
  onSave: () => void;
  onCancel: () => void;
  position: { x: number; y: number };
}) {
  return (
    <div
      className="absolute z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-gray-200 dark:border-zinc-700 rounded-xl p-3 shadow-2xl"
      style={{ left: position.x, top: position.y }}
      data-testid="popup-edge-label"
    >
      <div className="text-[10px] text-zinc-500 font-medium mb-1.5">Edge Label</div>
      <div className="flex items-center gap-2">
        <input
          className="bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:border-primary focus:outline-none w-36"
          placeholder="e.g. Yes / No"
          value={editData.label}
          onChange={(e) => onChange({ ...editData, label: e.target.value })}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          data-testid="input-edge-label"
        />
        <button onClick={onSave} className="text-emerald-400 hover:text-emerald-300 transition-colors" data-testid="button-save-edge-label">
          <Check className="h-4 w-4" />
        </button>
        <button onClick={onCancel} className="text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors" data-testid="button-cancel-edge-label">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ContextMenu({
  position,
  onAddStep,
  onClose,
}: {
  position: { x: number; y: number; flowX: number; flowY: number };
  onAddStep: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-gray-200 dark:border-zinc-700 rounded-xl py-1.5 shadow-2xl min-w-[160px]"
      style={{ left: position.x, top: position.y }}
      data-testid="context-menu"
    >
      <button
        className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white flex items-center gap-2.5 transition-colors"
        onClick={onAddStep}
        data-testid="button-add-step-context"
      >
        <Plus className="h-3.5 w-3.5 text-primary" /> Add Step Here
      </button>
    </div>
  );
}

function NodeContextMenu({
  position,
  nodeData,
  onEdit,
  onAddChild,
  onConnectTo,
  onDelete,
  onClose,
}: {
  position: { x: number; y: number };
  nodeData: { dbId: number; label: string; nodeType: string };
  onEdit: () => void;
  onAddChild: () => void;
  onConnectTo: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-gray-200 dark:border-zinc-700 rounded-xl py-1.5 shadow-2xl min-w-[180px]"
      style={{ left: position.x, top: position.y }}
      data-testid="node-context-menu"
    >
      <button
        className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white flex items-center gap-2.5 transition-colors"
        onClick={onEdit}
        data-testid="button-edit-node-context"
      >
        <Pencil className="h-3.5 w-3.5 text-primary" /> Edit Step
      </button>
      <button
        className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white flex items-center gap-2.5 transition-colors"
        onClick={onAddChild}
        data-testid="button-add-child-context"
      >
        <Plus className="h-3.5 w-3.5 text-cb-teal" />
        {(nodeData.nodeType === "decision" || nodeData.nodeType === "agent-decision") ? "Add Branch" : "Add Child Step"}
      </button>
      <button
        className="w-full text-left px-3 py-2 text-xs text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white flex items-center gap-2.5 transition-colors"
        onClick={onConnectTo}
        data-testid="button-connect-to-context"
      >
        <Cable className="h-3.5 w-3.5 text-emerald-400" /> Connect to...
      </button>
      <div className="h-px bg-gray-200 dark:bg-zinc-800 my-1" />
      <button
        className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2.5 transition-colors"
        onClick={onDelete}
        data-testid="button-delete-node-context"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete Step
      </button>
    </div>
  );
}

function ProcessMapFlow({ ideaId, activeView, detailLevel, onRelayout, onUndoRedoReady, onFocusNodeReady, onDetailLevelChange }: { ideaId: string; activeView: ProcessView; detailLevel: DetailLevel; onRelayout?: (fn: () => void) => void; onUndoRedoReady?: (controls: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }) => void; onFocusNodeReady?: (fn: (nodeId: string) => void) => void; onDetailLevelChange?: (level: DetailLevel) => void; }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const onNodesChange = useCallback((changes: any) => setNodes(nds => applyNodeChanges(changes, nds)), [setNodes]);
  const onEdgesChange = useCallback((changes: any) => setEdges(eds => applyEdgeChanges(changes, eds)), [setEdges]);
  const [editingNode, setEditingNode] = useState<NodeEditData | null>(null);
  const [editingEdge, setEditingEdge] = useState<EdgeEditData | null>(null);
  const [edgeEditPos, setEdgeEditPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const [nodeContextMenu, setNodeContextMenu] = useState<{ x: number; y: number; nodeData: { dbId: number; label: string; nodeType: string } } | null>(null);
  const [isNewNode, setIsNewNode] = useState(false);
  const [newNodeFlowPos, setNewNodeFlowPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set());
  const [parentNodeIdForChild, setParentNodeIdForChild] = useState<number | null>(null);
  const [reconnectingEdge, setReconnectingEdge] = useState(false);
  const [connectModeSourceId, setConnectModeSourceId] = useState<string | null>(null);
  const [detailPopover, setDetailPopover] = useState<{ node: any; position: { x: number; y: number } } | null>(null);
  const hasInitialFitRef = useRef(false);
  const prevDetailLevelRef = useRef<string>(detailLevel);
  const dataVersionRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextHistoryRef = useRef(false);
  const { fitView, setCenter, getNodes, screenToFlowPosition } = useReactFlow();
  const { pushSnapshot, undo, redo, reset: resetHistory, canUndo, canRedo } = useUndoRedo();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

  useEffect(() => {
    setNodes(nds => nds.map(n => ({
      ...n,
      data: { ...(n.data as any), connectModeSourceId },
    })));
  }, [connectModeSourceId]);

  const focusNode = useCallback((nodeId: string) => {
    const allNodes = getNodes();
    const target = allNodes.find(n => n.id === nodeId || (n.data as any)?.dbId?.toString() === nodeId);
    if (target) {
      const x = target.position.x + (target.measured?.width ?? 140) / 2;
      const y = target.position.y + (target.measured?.height ?? 40) / 2;
      setCenter(x, y, { zoom: 1.5, duration: 600 });
      const highlightClass = "ring-2 ring-amber-400 ring-offset-2 ring-offset-zinc-900 rounded-lg";
      setNodes(nds => nds.map(n => ({
        ...n,
        selected: n.id === target.id,
        className: n.id === target.id ? `${n.className || ""} ${highlightClass}`.trim() : (n.className || ""),
      })));
      setTimeout(() => {
        setNodes(nds => nds.map(n => ({
          ...n,
          className: (n.className || "").replace(highlightClass, "").trim(),
        })));
      }, 2500);
    }
  }, [getNodes, setCenter, setNodes]);

  useEffect(() => {
    onFocusNodeReady?.(focusNode);
  }, [onFocusNodeReady, focusNode]);

  const takeSnapshot = useCallback(() => {
    if (skipNextHistoryRef.current) { skipNextHistoryRef.current = false; return; }
    pushSnapshot({
      nodes: nodesRef.current.map(n => ({ ...n, position: { ...n.position }, data: { ...n.data } })),
      edges: edgesRef.current.map(e => ({ ...e, data: e.data ? { ...e.data } : {} })),
    });
  }, [pushSnapshot]);

  const applySnapshot = useCallback((snapshot: HistorySnapshot) => {
    skipNextHistoryRef.current = true;
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    snapshot.nodes.forEach((n) => {
      const d = n.data as any;
      if (d.dbId) {
        updateNodeMutation.mutate({ id: d.dbId, data: { positionX: n.position.x, positionY: n.position.y } });
      }
    });
  }, [setNodes, setEdges]);

  const handleUndo = useCallback(() => {
    const snapshot = undo({ nodes: nodesRef.current, edges: edgesRef.current });
    if (snapshot) applySnapshot(snapshot);
  }, [undo, applySnapshot]);

  const handleRedo = useCallback(() => {
    const snapshot = redo({ nodes: nodesRef.current, edges: edgesRef.current });
    if (snapshot) applySnapshot(snapshot);
  }, [redo, applySnapshot]);

  useEffect(() => {
    onUndoRedoReady?.({ undo: handleUndo, redo: handleRedo, canUndo, canRedo });
  }, [onUndoRedoReady, handleUndo, handleRedo, canUndo, canRedo]);

  const { data: mapData, isLoading } = useQuery<ProcessMapData>({
    queryKey: ["/api/ideas", ideaId, "process-map", activeView],
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${ideaId}/process-map?view=${activeView}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load process map");
      return res.json();
    },
    refetchOnMount: "always",
    staleTime: 0,
  });

  useEffect(() => {
    hasInitialFitRef.current = false;
  }, [detailLevel]);

  const doRelayout = useCallback(() => {
    if (!mapData) return;
    const { nodes: dbNodes, edges: dbEdges } = filterNodesForLevel(mapData.nodes, mapData.edges, detailLevel);
    const rawNodes: Node[] = dbNodes.map((n) => ({
      id: String(n.id),
      type: "processNode",
      position: { x: 0, y: 0 },
      data: {
        label: n.name, role: n.role, system: n.system, nodeType: n.nodeType,
        isGhost: n.isGhost, isPainPoint: n.isPainPoint, description: n.description,
        dbId: n.id, viewType: activeView, connectModeSourceId,
      },
    }));
    const nodeIdSet = new Set(dbNodes.map(n => n.id));
    const validEdges = dbEdges.filter(e => nodeIdSet.has(e.sourceNodeId) && nodeIdSet.has(e.targetNodeId));
    const relSrcGrp: Record<string, typeof validEdges> = {};
    const relTgtGrp: Record<string, typeof validEdges> = {};
    validEdges.forEach(e => {
      const sk = String(e.sourceNodeId);
      const tk = String(e.targetNodeId);
      if (!relSrcGrp[sk]) relSrcGrp[sk] = [];
      relSrcGrp[sk].push(e);
      if (!relTgtGrp[tk]) relTgtGrp[tk] = [];
      relTgtGrp[tk].push(e);
    });
    const relNodeCount = dbNodes.length;
    const relSimplified = detailLevel !== "L2";
    const rawEdges: Edge[] = validEdges.map((e) => {
      const srcS = relSrcGrp[String(e.sourceNodeId)] || [e];
      const tgtS = relTgtGrp[String(e.targetNodeId)] || [e];
      return {
        id: String(e.id), source: String(e.sourceNodeId), target: String(e.targetNodeId),
        type: "custom",
        data: {
          label: e.label, dbId: e.id, viewType: activeView,
          sourceIndex: srcS.indexOf(e), sourceSiblings: srcS.length,
          targetIndex: tgtS.indexOf(e), targetSiblings: tgtS.length,
          totalNodes: relNodeCount,
          simplified: relSimplified,
        },
      };
    });
    let layoutNodes: Node[];
    if (rawEdges.length > 0) {
      layoutNodes = applyDagreLayout(rawNodes, rawEdges, "TB", relSimplified);
    } else {
      layoutNodes = rawNodes.map((node, i) => ({ ...node, position: getNodePosition(i, rawNodes.length) }));
    }
    setNodes(layoutNodes);
    layoutNodes.forEach((n) => {
      const d = n.data as any;
      if (d.dbId && d.dbId > 0) {
        updateNodeMutation.mutate({ id: d.dbId, data: { positionX: n.position.x, positionY: n.position.y } });
      }
    });
    setTimeout(() => fitView({ padding: 0.3, duration: 400, maxZoom: 1.2 }), 150);
  }, [mapData, activeView, detailLevel, setNodes, fitView]);

  useEffect(() => {
    if (onRelayout) onRelayout(doRelayout);
  }, [onRelayout, doRelayout]);

  useEffect(() => {
    if (!mapData) return;
    const { nodes: dbNodes, edges: dbEdges } = filterNodesForLevel(mapData.nodes, mapData.edges, detailLevel);

    const rawNodes: Node[] = dbNodes.map((n) => ({
      id: String(n.id),
      type: "processNode",
      position: { x: n.positionX, y: n.positionY },
      data: {
        label: n.name,
        role: n.role,
        system: n.system,
        nodeType: n.nodeType,
        isGhost: n.isGhost,
        isPainPoint: n.isPainPoint,
        description: n.description,
        dbId: n.id,
        viewType: activeView,
      },
    }));

    const nodeIdSet2 = new Set(dbNodes.map(n => n.id));
    const safeEdges = dbEdges.filter(e => nodeIdSet2.has(e.sourceNodeId) && nodeIdSet2.has(e.targetNodeId));
    const sourceGroups: Record<string, typeof safeEdges> = {};
    const targetGroups: Record<string, typeof safeEdges> = {};
    safeEdges.forEach(e => {
      const sk = String(e.sourceNodeId);
      const tk = String(e.targetNodeId);
      if (!sourceGroups[sk]) sourceGroups[sk] = [];
      sourceGroups[sk].push(e);
      if (!targetGroups[tk]) targetGroups[tk] = [];
      targetGroups[tk].push(e);
    });

    const nodeCount = dbNodes.length;
    const isSimplified = detailLevel !== "L2";
    const rawEdges: Edge[] = safeEdges.map((e) => {
      const srcSiblings = sourceGroups[String(e.sourceNodeId)] || [e];
      const tgtSiblings = targetGroups[String(e.targetNodeId)] || [e];
      const markerColor = activeView === "sdd" ? "rgba(249,115,22,0.5)" : activeView === "to-be" ? "rgba(34,197,94,0.5)" : "rgba(120,120,145,0.4)";
      const markerSize = isSimplified ? 16 : nodeCount > 25 ? 10 : 14;

      return {
        id: String(e.id),
        source: String(e.sourceNodeId),
        target: String(e.targetNodeId),
        type: "custom",
        data: {
          label: e.label, dbId: e.id, viewType: activeView,
          sourceIndex: srcSiblings.indexOf(e), sourceSiblings: srcSiblings.length,
          targetIndex: tgtSiblings.indexOf(e), targetSiblings: tgtSiblings.length,
          totalNodes: nodeCount,
          simplified: isSimplified,
        },
        animated: activeView === "to-be" || activeView === "sdd",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: markerSize,
          height: markerSize,
          color: markerColor,
        },
      };
    });

    let layoutNodes: Node[];
    const levelChanged = prevDetailLevelRef.current !== detailLevel;
    prevDetailLevelRef.current = detailLevel;

    const forceLayout = levelChanged;

    if (detailLevel !== "L2" || forceLayout) {
      if (rawEdges.length > 0) {
        layoutNodes = applyDagreLayout(rawNodes, rawEdges, "TB", isSimplified);
        if (detailLevel === "L2") {
          layoutNodes.forEach((n) => {
            const d = n.data as any;
            if (d.dbId && d.dbId > 0) {
              updateNodeMutation.mutate({ id: d.dbId, data: { positionX: n.position.x, positionY: n.position.y } });
            }
          });
        }
      } else if (rawNodes.length > 0) {
        layoutNodes = rawNodes.map((node, i) => ({ ...node, position: getNodePosition(i, rawNodes.length) }));
      } else {
        layoutNodes = rawNodes;
      }
    } else {
      const savedCount = dbNodes.filter((n) => n.positionX !== 0 || n.positionY !== 0).length;
      const allHaveSavedPositions = savedCount === dbNodes.length;

      if (allHaveSavedPositions) {
        layoutNodes = rawNodes;
      } else if (rawEdges.length > 0) {
        layoutNodes = applyDagreLayout(rawNodes, rawEdges, "TB", false);
        layoutNodes.forEach((n) => {
          const d = n.data as any;
          if (d.dbId && d.dbId > 0) {
            updateNodeMutation.mutate({ id: d.dbId, data: { positionX: n.position.x, positionY: n.position.y } });
          }
        });
      } else if (rawNodes.length > 0) {
        layoutNodes = rawNodes.map((node, i) => ({ ...node, position: getNodePosition(i, rawNodes.length) }));
      } else {
        layoutNodes = rawNodes;
      }
    }

    setNodes(layoutNodes);
    setEdges(rawEdges);
    dataVersionRef.current += 1;

    if (levelChanged || (!hasInitialFitRef.current && layoutNodes.length > 0)) {
      hasInitialFitRef.current = true;
      setTimeout(() => fitView({ padding: 0.3, duration: 400, maxZoom: 1.2 }), 150);
    }
  }, [mapData, detailLevel, setNodes, setEdges]);

  const updateNodeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/process-nodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return res.json();
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/ideas/${ideaId}/process-nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: async (newNode: any) => {
      if (parentNodeIdForChild && newNode?.id) {
        await fetch(`/api/ideas/${ideaId}/process-edges`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            viewType: activeView,
            sourceNodeId: parentNodeIdForChild,
            targetNodeId: newNode.id,
            label: "",
          }),
        });
        setParentNodeIdForChild(null);
      }
      hasInitialFitRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/process-nodes/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      hasInitialFitRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    },
  });

  const createEdgeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/ideas/${ideaId}/process-edges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      hasInitialFitRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    },
  });

  const updateEdgeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/process-edges/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      hasInitialFitRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/process-edges/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      hasInitialFitRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    },
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        takeSnapshot();
        createEdgeMutation.mutate({
          viewType: activeView,
          sourceNodeId: parseInt(connection.source),
          targetNodeId: parseInt(connection.target),
          label: "",
        });
      }
    },
    [createEdgeMutation, activeView, takeSnapshot]
  );

  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    const d = node.data as any;
    if (detailLevel === "L0") {
      onDetailLevelChange?.("L1");
      return;
    }
    if (detailLevel === "L1") {
      onDetailLevelChange?.("L2");
      return;
    }
    if (d.dbId < 0) return;
    setEditingNode({
      nodeId: d.dbId,
      name: d.label || "",
      role: d.role || "",
      system: d.system || "",
      nodeType: d.nodeType || "task",
      description: d.description || "",
      isPainPoint: d.isPainPoint || false,
    });
    setIsNewNode(false);
    setContextMenu(null);
    setNodeContextMenu(null);
    setDetailPopover(null);
  }, [detailLevel, onDetailLevelChange]);

  const onNodeContextMenu = useCallback((event: any, node: Node) => {
    event.preventDefault();
    if (detailLevel !== "L2") return;
    const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    if (bounds) {
      const d = node.data as any;
      if (d.dbId < 0) return;
      setNodeContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        nodeData: { dbId: d.dbId, label: d.label || "", nodeType: d.nodeType || "task" },
      });
      setContextMenu(null);
    }
  }, [detailLevel]);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdgeIds(new Set([edge.id]));
    setContextMenu(null);
    setNodeContextMenu(null);
  }, []);

  const onEdgeDoubleClick = useCallback((_: any, edge: Edge) => {
    const d = edge.data as any;
    setEditingEdge({ edgeId: d.dbId, label: d.label || "" });
    setEdgeEditPos({ x: 200, y: 100 });
    setContextMenu(null);
    setNodeContextMenu(null);
  }, []);

  const onPaneContextMenu = useCallback((event: any) => {
    event.preventDefault();
    const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    if (bounds) {
      setContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        flowX: event.clientX - bounds.left,
        flowY: event.clientY - bounds.top,
      });
      setNodeContextMenu(null);
    }
  }, []);

  const onNodeClick = useCallback((_: any, node: Node) => {
    const d = node.data as any;
    if (d.dbId < 0) return;

    if (connectModeSourceId) {
      if (node.id !== connectModeSourceId) {
        takeSnapshot();
        createEdgeMutation.mutate({
          viewType: activeView,
          sourceNodeId: parseInt(connectModeSourceId),
          targetNodeId: parseInt(node.id),
          label: "",
        });
      }
      setConnectModeSourceId(null);
      return;
    }

    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const nodeType = d.nodeType || "task";
    const dims = getNodeDimensions(nodeType);
    setDetailPopover({
      node: {
        dbId: d.dbId,
        label: d.label || "",
        role: d.role || "",
        system: d.system || "",
        nodeType: d.nodeType || "task",
        description: d.description || "",
        isPainPoint: d.isPainPoint || false,
      },
      position: {
        x: (node.position?.x ?? 0) + dims.width / 2,
        y: (node.position?.y ?? 0) - 10,
      },
    });
    setContextMenu(null);
    setNodeContextMenu(null);
  }, [mapData, connectModeSourceId, activeView, createEdgeMutation, takeSnapshot]);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setNodeContextMenu(null);
    setDetailPopover(null);
    setSelectedEdgeIds(new Set());
    setConnectModeSourceId(null);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;

      if (e.key === "Escape") {
        setConnectModeSourceId(null);
        setDetailPopover(null);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "Z" || (e.key === "z" && e.shiftKey)) ) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingNode || editingEdge) return;

        if (selectedEdgeIds.size > 0) {
          takeSnapshot();
          selectedEdgeIds.forEach((edgeId) => {
            const edge = edges.find((ed) => ed.id === edgeId);
            if (edge) {
              const d = edge.data as any;
              if (d?.dbId) {
                deleteEdgeMutation.mutate(d.dbId);
              }
            }
          });
          setSelectedEdgeIds(new Set());
          e.preventDefault();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEdgeIds, edges, editingNode, editingEdge, deleteEdgeMutation, handleUndo, handleRedo, takeSnapshot]);

  function handleSaveNode() {
    if (!editingNode) return;
    takeSnapshot();
    if (isNewNode) {
      const existingNodes = mapData?.nodes || [];
      createNodeMutation.mutate({
        viewType: activeView,
        name: editingNode.name,
        role: editingNode.role,
        system: editingNode.system,
        nodeType: editingNode.nodeType,
        description: editingNode.description,
        isPainPoint: editingNode.isPainPoint,
        positionX: newNodeFlowPos?.x || 0,
        positionY: newNodeFlowPos?.y || 0,
        orderIndex: existingNodes.length,
      });
    } else {
      updateNodeMutation.mutate({
        id: editingNode.nodeId,
        data: {
          name: editingNode.name,
          role: editingNode.role,
          system: editingNode.system,
          nodeType: editingNode.nodeType,
          description: editingNode.description,
          isPainPoint: editingNode.isPainPoint,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    }
    setEditingNode(null);
    setNewNodeFlowPos(null);
  }

  function handleDeleteNode() {
    if (!editingNode || isNewNode) return;
    takeSnapshot();
    deleteNodeMutation.mutate(editingNode.nodeId);
    setEditingNode(null);
  }

  function handleSaveEdgeLabel() {
    if (!editingEdge) return;
    takeSnapshot();
    updateEdgeMutation.mutate({
      id: editingEdge.edgeId,
      data: { label: editingEdge.label },
    });
    setEditingEdge(null);
  }

  function handleAddStepFromContext() {
    if (!contextMenu) return;
    setNewNodeFlowPos({ x: contextMenu.flowX, y: contextMenu.flowY });
    setEditingNode({
      nodeId: 0,
      name: "",
      role: "",
      system: "",
      nodeType: "task",
      description: "",
      isPainPoint: false,
    });
    setIsNewNode(true);
    setContextMenu(null);
  }

  function handleNodeContextEdit() {
    if (!nodeContextMenu) return;
    const nd = nodeContextMenu.nodeData;
    const dbNode = mapData?.nodes.find((n) => n.id === nd.dbId);
    if (dbNode) {
      setEditingNode({
        nodeId: dbNode.id,
        name: dbNode.name || "",
        role: dbNode.role || "",
        system: dbNode.system || "",
        nodeType: (dbNode.nodeType || "task") as any,
        description: dbNode.description || "",
        isPainPoint: dbNode.isPainPoint || false,
      });
      setIsNewNode(false);
    }
    setNodeContextMenu(null);
  }

  function handleNodeContextAddChild() {
    if (!nodeContextMenu) return;
    const parentNode = nodes.find((n) => String((n.data as any).dbId) === String(nodeContextMenu.nodeData.dbId));
    const px = parentNode?.position?.x || 0;
    const py = parentNode?.position?.y || 0;
    setParentNodeIdForChild(nodeContextMenu.nodeData.dbId);
    setNewNodeFlowPos({ x: px, y: py + 120 });
    setEditingNode({
      nodeId: 0,
      name: "",
      role: "",
      system: "",
      nodeType: "task",
      description: "",
      isPainPoint: false,
    });
    setIsNewNode(true);
    setNodeContextMenu(null);
  }

  function handleNodeContextDelete() {
    if (!nodeContextMenu) return;
    takeSnapshot();
    deleteNodeMutation.mutate(nodeContextMenu.nodeData.dbId);
    setNodeContextMenu(null);
  }

  const onNodeDragStart = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    const d = node.data as any;
    if (d.dbId && d.dbId > 0) {
      updateNodeMutation.mutate({
        id: d.dbId,
        data: { positionX: node.position.x, positionY: node.position.y },
      });
    }
  }, [updateNodeMutation]);

  const onReconnectStart = useCallback(() => {
    setReconnectingEdge(true);
  }, []);

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      if (!newConnection.source || !newConnection.target) return;
      if (oldEdge.source === newConnection.source && oldEdge.target === newConnection.target) {
        setReconnectingEdge(false);
        return;
      }
      takeSnapshot();
      const d = oldEdge.data as any;
      if (d?.dbId) {
        updateEdgeMutation.mutate({
          id: d.dbId,
          data: {
            sourceNodeId: parseInt(newConnection.source),
            targetNodeId: parseInt(newConnection.target),
          },
        });
      }
      setReconnectingEdge(false);
    },
    [takeSnapshot, updateEdgeMutation]
  );

  const onReconnectEnd = useCallback((_: any, oldEdge: Edge) => {
    setReconnectingEdge(false);
  }, []);

  const styledEdges = useMemo(() => {
    return edges.map((e) => ({
      ...e,
      selected: selectedEdgeIds.has(e.id),
      style: {
        ...e.style,
        strokeWidth: selectedEdgeIds.has(e.id) ? 3 : (e.style?.strokeWidth || 1.5),
        filter: selectedEdgeIds.has(e.id) ? "drop-shadow(0 0 4px rgba(251,146,60,0.6))" : undefined,
      },
    }));
  }, [edges, selectedEdgeIds]);

  const hasNodes = (mapData?.nodes?.length || 0) > 0;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasNodes) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="relative">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
              <GitBranch className="h-7 w-7 text-zinc-600" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-zinc-300">
              {activeView === "as-is"
                ? "Process map will appear here"
                : activeView === "to-be"
                ? "To-Be map will appear here"
                : "SDD map will appear here"}
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {activeView === "as-is"
                ? "Describe your process in the chat and the AI will build a visual flowchart with tasks, decisions, and handoffs."
                : activeView === "to-be"
                ? "Once the As-Is is mapped, the AI will generate an optimized workflow showing where automation removes manual steps."
                : "The SDD view shows the finalized process architecture from the approved Solution Design Document."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative" data-testid="process-map-canvas" ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOpts}
        connectionLineStyle={connectionStyle}
        connectionLineType={ConnectionLineType.SmoothStep}
        edgesReconnectable
        proOptions={proOpts}
        className={`process-map-canvas ${reconnectingEdge ? "reconnecting" : ""}`}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable
        snapToGrid
        snapGrid={snapGridVal}
        deleteKeyCode={null}
        selectionKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color={isDark ? "rgba(100,100,120,0.15)" : "rgba(100,100,120,0.25)"}
        />
        <Controls
          showInteractive={false}
          className={isDark
            ? "!bg-zinc-900/90 !border-zinc-700 !rounded-xl !shadow-lg [&_button]:!bg-zinc-800 [&_button]:!border-zinc-700 [&_button]:!text-zinc-400 [&_button:hover]:!bg-zinc-700 [&_button:hover]:!text-white [&_button]:!rounded-lg"
            : "!bg-white !border-gray-200 !rounded-xl !shadow-lg [&_button]:!bg-gray-50 [&_button]:!border-gray-200 [&_button]:!text-gray-600 [&_button:hover]:!bg-gray-100 [&_button:hover]:!text-gray-900 [&_button]:!rounded-lg"
          }
        />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => {
            const t = (n.data as any)?.nodeType;
            if (t === "start") return "#10b981";
            if (t === "end") return "#ef4444";
            if (t === "decision") return "#f59e0b";
            return "#3b82f6";
          }}
          maskColor={isDark ? "rgba(0,0,0,0.7)" : "rgba(240,240,245,0.7)"}
          className={isDark
            ? "!bg-zinc-900/80 !border-zinc-700 !rounded-xl"
            : "!bg-white/90 !border-gray-200 !rounded-xl"
          }
          pannable
          zoomable
        />
      </ReactFlow>

      {selectedEdgeIds.size > 0 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg z-40" data-testid="edge-selection-hint">
          <span className="text-[10px] text-zinc-400">Edge selected</span>
          <span className="text-[10px] text-zinc-600">|</span>
          <button
            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1"
            onClick={() => {
              selectedEdgeIds.forEach((edgeId) => {
                const edge = edges.find((ed) => ed.id === edgeId);
                if (edge) {
                  const d = edge.data as any;
                  if (d?.dbId) deleteEdgeMutation.mutate(d.dbId);
                }
              });
              setSelectedEdgeIds(new Set());
            }}
            data-testid="button-delete-edge"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
          <span className="text-[10px] text-zinc-600">|</span>
          <button
            className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1"
            onClick={() => {
              const edgeId = Array.from(selectedEdgeIds)[0];
              const edge = edges.find((ed) => ed.id === edgeId);
              if (edge) {
                const d = edge.data as any;
                setEditingEdge({ edgeId: d.dbId, label: d.label || "" });
                setEdgeEditPos({ x: 200, y: 100 });
              }
              setSelectedEdgeIds(new Set());
            }}
            data-testid="button-edit-edge-label"
          >
            <Pencil className="h-3 w-3" /> Label
          </button>
          <span className="text-[10px] text-zinc-500 ml-1">(or press Delete)</span>
        </div>
      )}

      {connectModeSourceId && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-blue-500/40 rounded-xl px-4 py-2 flex items-center gap-3 shadow-lg"
          data-testid="connect-mode-banner"
        >
          <Cable className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-gray-600 dark:text-zinc-300">Click a target node to connect, or press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-zinc-800 rounded text-[10px] font-mono text-gray-500 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700">Esc</kbd> to cancel</span>
          <button
            className="text-xs text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors ml-1"
            onClick={() => setConnectModeSourceId(null)}
            data-testid="button-cancel-connect-mode"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          onAddStep={handleAddStepFromContext}
          onClose={() => setContextMenu(null)}
        />
      )}

      {nodeContextMenu && (
        <NodeContextMenu
          position={{ x: nodeContextMenu.x, y: nodeContextMenu.y }}
          nodeData={nodeContextMenu.nodeData}
          onEdit={handleNodeContextEdit}
          onAddChild={handleNodeContextAddChild}
          onConnectTo={() => {
            setConnectModeSourceId(String(nodeContextMenu.nodeData.dbId));
            setNodeContextMenu(null);
          }}
          onDelete={handleNodeContextDelete}
          onClose={() => setNodeContextMenu(null)}
        />
      )}

      {editingEdge && (
        <EdgeLabelEditPopup
          editData={editingEdge}
          onChange={setEditingEdge}
          onSave={handleSaveEdgeLabel}
          onCancel={() => setEditingEdge(null)}
          position={edgeEditPos}
        />
      )}

      {detailPopover && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
          }}
        >
          <div
            className="pointer-events-auto absolute bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl w-72"
            style={{
              left: `50%`,
              top: `40px`,
              transform: "translateX(-50%)",
            }}
            data-testid="popover-node-detail"
          >
            <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{
                    background: (detailPopover.node.nodeType === "decision" || detailPopover.node.nodeType === "agent-decision") ? "rgba(245,158,11,0.15)" :
                      detailPopover.node.nodeType === "start" ? "rgba(16,185,129,0.15)" :
                      detailPopover.node.nodeType === "end" ? "rgba(239,68,68,0.15)" :
                      (detailPopover.node.nodeType === "agent-task" || detailPopover.node.nodeType === "agent-loop") ? "rgba(168,85,247,0.15)" : "rgba(59,130,246,0.15)",
                    border: `1px solid ${(detailPopover.node.nodeType === "decision" || detailPopover.node.nodeType === "agent-decision") ? "rgba(245,158,11,0.3)" :
                      detailPopover.node.nodeType === "start" ? "rgba(16,185,129,0.3)" :
                      detailPopover.node.nodeType === "end" ? "rgba(239,68,68,0.3)" :
                      (detailPopover.node.nodeType === "agent-task" || detailPopover.node.nodeType === "agent-loop") ? "rgba(168,85,247,0.3)" : "rgba(59,130,246,0.3)"}`,
                  }}
                >
                  {(detailPopover.node.nodeType === "decision" || detailPopover.node.nodeType === "agent-decision") ? <Diamond className="h-3 w-3 text-amber-400" /> :
                   detailPopover.node.nodeType === "start" ? <Play className="h-3 w-3 text-emerald-400" /> :
                   detailPopover.node.nodeType === "end" ? <Square className="h-3 w-3 text-red-400" /> :
                   (detailPopover.node.nodeType === "agent-task" || detailPopover.node.nodeType === "agent-loop") ? <Brain className="h-3 w-3 text-purple-400" /> :
                   <CircleDot className="h-3 w-3 text-blue-400" />}
                </div>
                <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">{detailPopover.node.label || "(unnamed)"}</span>
              </div>
              <button
                onClick={() => setDetailPopover(null)}
                className="text-zinc-500 hover:text-gray-900 dark:hover:text-white transition-colors flex-shrink-0"
                data-testid="button-close-detail-popover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium w-16 flex-shrink-0 pt-0.5">Type</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {detailPopover.node.nodeType === "decision" ? "Decision" :
                   detailPopover.node.nodeType === "start" ? "Start" :
                   detailPopover.node.nodeType === "end" ? "End" :
                   detailPopover.node.nodeType === "agent-task" ? "Agent Task" :
                   detailPopover.node.nodeType === "agent-decision" ? "Agent Decision" :
                   detailPopover.node.nodeType === "agent-loop" ? "Agent Loop" : "Task"}
                </Badge>
              </div>
              {detailPopover.node.role && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium w-16 flex-shrink-0 pt-0.5">Role</span>
                  <span className="text-xs text-gray-600 dark:text-zinc-300" data-testid="text-detail-role">{detailPopover.node.role}</span>
                </div>
              )}
              {detailPopover.node.system && detailPopover.node.system !== "Manual" && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium w-16 flex-shrink-0 pt-0.5">System</span>
                  <span className="text-xs text-gray-600 dark:text-zinc-300" data-testid="text-detail-system">{detailPopover.node.system}</span>
                </div>
              )}
              {detailPopover.node.description && (
                <div className="flex items-start gap-2">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium w-16 flex-shrink-0 pt-0.5">Desc</span>
                  <span className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed" data-testid="text-detail-description">{detailPopover.node.description}</span>
                </div>
              )}
              {detailPopover.node.isPainPoint && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Flag className="h-3 w-3 text-red-400 fill-red-400" />
                  <span className="text-[10px] text-red-400 font-medium" data-testid="text-detail-pain-point">Pain Point</span>
                </div>
              )}
            </div>
            {detailLevel === "L2" && (
              <div className="px-4 py-2.5 border-t border-gray-200 dark:border-zinc-800">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-xs justify-center gap-1.5"
                  onClick={() => {
                    const nd = detailPopover.node;
                    setEditingNode({
                      nodeId: nd.dbId,
                      name: nd.label || "",
                      role: nd.role || "",
                      system: nd.system || "",
                      nodeType: nd.nodeType || "task",
                      description: nd.description || "",
                      isPainPoint: nd.isPainPoint || false,
                    });
                    setIsNewNode(false);
                    setDetailPopover(null);
                  }}
                  data-testid="button-edit-from-detail"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {editingNode && (
        <InlineEditPanel
          editData={editingNode}
          onChange={setEditingNode}
          onSave={handleSaveNode}
          onCancel={() => { setEditingNode(null); setNewNodeFlowPos(null); setParentNodeIdForChild(null); }}
          onDelete={isNewNode ? undefined : handleDeleteNode}
          isNew={isNewNode}
        />
      )}
    </div>
  );
}

interface SDDSection {
  title: string;
  content: string;
}

function parseSddSections(content: string): SDDSection[] {
  const lines = content.split("\n");
  const sections: SDDSection[] = [];
  let currentTitle = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+\d*\.?\s*(.*)/);
    if (headingMatch) {
      if (currentTitle) {
        sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
      }
      currentTitle = headingMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  if (currentTitle) {
    sections.push({ title: currentTitle, content: currentContent.join("\n").trim() });
  }

  if (sections.length === 0 && content.trim()) {
    sections.push({ title: "Document Content", content: content.trim() });
  }

  return sections;
}

function SDDInlineViewer({ ideaId, onApproved }: { ideaId: string; onApproved?: () => void }) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));
  const [selectedVersionIdx, setSelectedVersionIdx] = useState<number>(0);

  const { data: sddVersions, isLoading } = useQuery<{ id: number; version: number; content: string; status: string; createdAt: string }[]>({
    queryKey: ["/api/ideas", ideaId, "documents", "versions", "SDD"],
  });

  const currentSdd = sddVersions?.length ? sddVersions[selectedVersionIdx] || sddVersions[0] : null;
  const latestSdd = sddVersions?.length ? sddVersions[0] : null;

  const approveSddMutation = useMutation({
    mutationFn: async () => {
      if (!latestSdd) throw new Error("No SDD to approve");
      const res = await fetch(`/api/ideas/${ideaId}/documents/${latestSdd.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Approval failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "documents", "versions", "SDD"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "approval-summary"] });
      onApproved?.();
    },
  });

  const showSddApproveButton = latestSdd && latestSdd.status !== "approved";

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="sdd-view-loading">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">Loading SDD...</span>
        </div>
      </div>
    );
  }

  if (!currentSdd) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" data-testid="sdd-view-empty">
        <div className="text-center max-w-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-cb-orange/10 flex items-center justify-center mx-auto">
            <FileText className="h-6 w-6 text-cb-orange" />
          </div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-zinc-300">No SDD Generated Yet</h4>
          <p className="text-xs text-zinc-500 leading-relaxed">
            The Solution Design Document will appear here once it's generated. First, complete and approve your To-Be process map, then approve the PDD. The SDD is automatically created after PDD approval.
          </p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-600">
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Approve To-Be Map</span>
            <span className="text-zinc-700">&rarr;</span>
            <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Approve PDD</span>
            <span className="text-zinc-700">&rarr;</span>
            <span className="flex items-center gap-1 text-cb-orange"><FileText className="h-3 w-3" /> SDD Generated</span>
          </div>
        </div>
      </div>
    );
  }

  const sections = parseSddSections(currentSdd.content);

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar" data-testid="sdd-view-content">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-cb-orange" />
          <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">Solution Design Document</span>
          <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
            v{currentSdd.version}
          </Badge>
          {currentSdd.status === "approved" && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
              <Check className="h-3 w-3" /> Approved
            </span>
          )}
          {sddVersions && sddVersions.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-zinc-800/50 transition-colors" data-testid="sdd-version-dropdown">
                  <History className="h-3.5 w-3.5 text-zinc-500" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700 min-w-[200px]">
                {sddVersions.map((v, idx) => (
                  <DropdownMenuItem
                    key={v.id}
                    onClick={() => {
                      setSelectedVersionIdx(idx);
                      setExpandedSections(new Set([0]));
                    }}
                    className={`text-xs cursor-pointer ${idx === selectedVersionIdx ? "bg-zinc-800 text-zinc-200" : "text-zinc-400"}`}
                    data-testid={`sdd-version-option-${v.version}`}
                  >
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">v{v.version}</span>
                        {v.status === "approved" && (
                          <Check className="h-3 w-3 text-emerald-400" />
                        )}
                        {idx === 0 && (
                          <span className="text-[9px] text-cb-orange font-medium">Latest</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-600">
                        {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <span className="text-[10px] text-zinc-600">
          {new Date(currentSdd.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      <div className="divide-y divide-zinc-800/40">
        {sections.map((section, idx) => {
          const isExpanded = expandedSections.has(idx);
          return (
            <div key={idx} data-testid={`sdd-section-${idx}`}>
              <button
                onClick={() => toggleSection(idx)}
                className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-800/30 transition-colors text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                )}
                <span className="text-xs font-medium text-gray-700 dark:text-zinc-300">{section.title}</span>
              </button>
              {isExpanded && (
                <div className="px-6 pb-4 text-xs text-gray-500 dark:text-zinc-400 leading-relaxed prose dark:prose-invert prose-xs max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showSddApproveButton && (
        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-zinc-800/80 flex items-center justify-between bg-gray-50/80 dark:bg-zinc-950/50">
          <Button
            size="sm"
            className="text-xs rounded-lg shadow-sm bg-cb-teal shadow-cb-teal/20"
            onClick={() => approveSddMutation.mutate()}
            disabled={approveSddMutation.isPending}
            data-testid="button-approve-sdd"
          >
            {approveSddMutation.isPending ? (
              <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Approving...</>
            ) : (
              <><Check className="h-3 w-3 mr-1.5" /> Approve SDD</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ProcessMapPanel({ ideaId, onStepsChange, onApproved, onCompletenessChange, onViewChange, onSwitchViewReady }: ProcessMapPanelProps) {
  const [activeView, setActiveView] = useState<ProcessView>("as-is");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("L2");

  const handleViewChange = useCallback((view: ProcessView) => {
    setActiveView(view);
    setDetailLevel("L2");
    onViewChange?.(view);
  }, [onViewChange]);

  useEffect(() => {
    onSwitchViewReady?.(handleViewChange);
  }, [onSwitchViewReady, handleViewChange]);

  const { data: mapData } = useQuery<ProcessMapData>({
    queryKey: ["/api/ideas", ideaId, "process-map", activeView],
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${ideaId}/process-map?view=${activeView}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 0,
  });

  const nodeCount = mapData?.nodes?.length || 0;
  const approval = mapData?.approval;
  const mapChanged = mapData?.mapChanged || false;

  const { data: approvalHistory } = useQuery<ProcessApproval[]>({
    queryKey: ["/api/ideas", ideaId, "process-approval-history", activeView],
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${ideaId}/process-approval-history?view=${activeView}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 30000,
  });

  const [viewingSnapshotVersion, setViewingSnapshotVersion] = useState<number | null>(null);

  const showApproveButton = activeView !== "sdd" && nodeCount >= 3 && (!approval || mapChanged);

  const mapCompleteness = useMemo(() => {
    if (!mapData?.nodes || mapData.nodes.length === 0) return 0;
    const nodes = mapData.nodes;
    const totalConfidence = nodes.reduce((sum, node) => {
      let score = 0;
      if (node.name?.trim()) score += 25;
      if (node.role?.trim()) score += 25;
      if (node.system?.trim() && node.system !== "Manual") score += 25;
      if (node.description?.trim()) score += 25;
      if (node.nodeType === "start" || node.nodeType === "end") score = 100;
      return sum + score;
    }, 0);
    return Math.round(totalConfidence / (nodes.length * 100) * 100);
  }, [mapData?.nodes]);

  useEffect(() => {
    onStepsChange?.(nodeCount);
  }, [nodeCount, onStepsChange]);

  useEffect(() => {
    onCompletenessChange?.(mapCompleteness);
  }, [mapCompleteness, onCompletenessChange]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ideas/${ideaId}/process-approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ viewType: activeView }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Approval failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-approval-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "approval-summary"] });
      onApproved?.();
    },
  });

  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const relayoutRef = useRef<(() => void) | null>(null);
  const focusNodeRef = useRef<((nodeId: string) => void) | null>(null);
  const [undoRedoControls, setUndoRedoControls] = useState<{ undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [showPerformers, setShowPerformers] = useState(false);
  const [showPhases, setShowPhases] = useState(false);

  const completenessIssues = useMemo(() => {
    if (!mapData?.nodes || !mapData?.edges) return [];
    return analyzeCompleteness(mapData.nodes, mapData.edges);
  }, [mapData?.nodes, mapData?.edges]);

  const performerSummary = useMemo(() => {
    if (!mapData?.nodes) return null;
    return analyzePerformers(mapData.nodes);
  }, [mapData?.nodes]);

  const phaseGroups = useMemo(() => {
    if (!mapData?.nodes || !mapData?.edges) return [];
    return detectPhaseGroups(mapData.nodes, mapData.edges);
  }, [mapData?.nodes, mapData?.edges]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  return (
    <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-white dark:bg-zinc-950" : "h-full"}`} data-testid="panel-process-map">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800/80 flex items-center justify-between gap-2 bg-gray-50/80 dark:bg-zinc-950/50">
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeView === "sdd" ? "bg-cb-orange/10" : "bg-cb-teal/10"}`}>
            {activeView === "sdd" ? <FileText className="h-3.5 w-3.5 text-cb-orange" /> : <GitBranch className="h-3.5 w-3.5 text-cb-teal" />}
          </div>
          <h3 className="text-xs font-semibold text-gray-600 dark:text-zinc-300 uppercase tracking-wider">
            {activeView === "as-is" ? "As-Is Process Map" : activeView === "to-be" ? "To-Be Process Map" : "Solution Design Document"}
          </h3>
          {activeView !== "sdd" && nodeCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500 font-medium">
              {nodeCount} steps
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeView !== "sdd" && nodeCount > 0 && undoRedoControls && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-7 w-7 p-0 text-zinc-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-zinc-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={undoRedoControls.undo}
                disabled={!undoRedoControls.canUndo}
                title="Undo (Ctrl+Z)"
                data-testid="button-undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[10px] h-7 w-7 p-0 text-zinc-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-zinc-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={undoRedoControls.redo}
                disabled={!undoRedoControls.canRedo}
                title="Redo (Ctrl+Shift+Z)"
                data-testid="button-redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {activeView !== "sdd" && nodeCount > 3 && (
            <div className="flex items-center rounded-lg bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-0.5" data-testid="level-selector">
              <button
                onClick={() => setDetailLevel("L0")}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${detailLevel === "L0" ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"}`}
                data-testid="button-level-l0"
                title="Overview - Phase groups only"
              >
                L0
              </button>
              <button
                onClick={() => setDetailLevel("L1")}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${detailLevel === "L1" ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"}`}
                data-testid="button-level-l1"
                title="Key Steps - Decisions & milestones"
              >
                L1
              </button>
              <button
                onClick={() => setDetailLevel("L2")}
                className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${detailLevel === "L2" ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm" : "text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"}`}
                data-testid="button-level-l2"
                title="Full Detail - All steps"
              >
                L2
              </button>
            </div>
          )}
          {activeView !== "sdd" && nodeCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] h-7 px-2 text-zinc-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-zinc-800 rounded-lg"
              onClick={() => relayoutRef.current?.()}
              data-testid="button-relayout"
            >
              <LayoutGrid className="h-3 w-3 mr-1" /> Re-layout
            </Button>
          )}
          {activeView !== "sdd" && nodeCount > 2 && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className={`text-[10px] h-7 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg ${showPerformers ? "text-purple-400 bg-purple-500/10 !border-purple-500/30" : "text-zinc-400 hover:text-gray-900 dark:hover:text-white"}`}
                onClick={() => { setShowPerformers(!showPerformers); setShowGuidance(false); setShowPhases(false); }}
                title="Human vs Machine breakdown"
                data-testid="button-toggle-performers"
              >
                <User className="h-3 w-3 mr-1" />/<Monitor className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={`text-[10px] h-7 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg ${showGuidance ? "text-amber-400 bg-amber-500/10 !border-amber-500/30" : "text-zinc-400 hover:text-gray-900 dark:hover:text-white"}`}
                onClick={() => { setShowGuidance(!showGuidance); setShowPerformers(false); setShowPhases(false); }}
                title="Completeness guidance"
                data-testid="button-toggle-guidance"
              >
                <AlertCircle className="h-3 w-3" />
                {completenessIssues.length > 0 && (
                  <span className="ml-1 text-[9px] font-bold">{completenessIssues.length}</span>
                )}
              </Button>
              {nodeCount > 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className={`text-[10px] h-7 px-2 border border-gray-200 dark:border-zinc-800 rounded-lg ${showPhases ? "text-blue-400 bg-blue-500/10 !border-blue-500/30" : "text-zinc-400 hover:text-gray-900 dark:hover:text-white"}`}
                  onClick={() => { setShowPhases(!showPhases); setShowPerformers(false); setShowGuidance(false); }}
                  title="Phase groups"
                  data-testid="button-toggle-phases"
                >
                  <CircleDot className="h-3 w-3" />
                </Button>
              )}
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] h-7 w-7 p-0 text-zinc-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-zinc-800 rounded-lg"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            data-testid="button-fullscreen-map"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <div
            className="flex items-center rounded-full bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-0.5"
            data-testid="button-toggle-view"
          >
            <button
              onClick={() => handleViewChange("as-is")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "as-is" ? "bg-cb-teal text-white shadow-sm shadow-cb-teal/20" : "text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"}`}
              data-testid="button-view-as-is"
            >
              As-Is
            </button>
            <button
              onClick={() => handleViewChange("to-be")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "to-be" ? "bg-cb-teal text-white shadow-sm shadow-cb-teal/20" : "text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"}`}
              data-testid="button-view-to-be"
            >
              To-Be
            </button>
            <button
              onClick={() => handleViewChange("sdd")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "sdd" ? "bg-cb-orange text-white shadow-sm shadow-cb-orange/20" : "text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"}`}
              data-testid="button-view-sdd"
            >
              SDD
            </button>
          </div>
        </div>
      </div>

      {activeView === "to-be" && nodeCount > 0 && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-950/30" data-testid="automation-impact-bar">
          {(() => {
            const nodes = mapData?.nodes || [];
            const startEndCount = nodes.filter((n) => n.nodeType === "start" || n.nodeType === "end").length;
            const actionableNodes = nodes.filter((n) => n.nodeType !== "start" && n.nodeType !== "end");
            const processSteps = actionableNodes.length;
            const automatedCount = actionableNodes.filter((n) => (n.description || "").startsWith("[AUTOMATED]")).length;
            const systemCount = actionableNodes.filter((n) => {
              if ((n.description || "").startsWith("[AUTOMATED]")) return false;
              return classifyPerformer(n.role || "", n.system || "") === "system";
            }).length;
            const humanCount = actionableNodes.filter((n) => {
              if ((n.description || "").startsWith("[AUTOMATED]")) return false;
              return classifyPerformer(n.role || "", n.system || "") !== "system";
            }).length;
            const totalAutomatable = automatedCount + systemCount;
            const automationPct = processSteps > 0 ? Math.min(100, Math.round(totalAutomatable / processSteps * 100)) : 0;
            return (
              <div className="flex items-center gap-3 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 cursor-default" data-testid="stat-automated-pct">
                      <Zap className="h-3 w-3 text-green-400" />
                      <span className="text-[10px] font-semibold text-green-400">{automationPct}% automated</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p className="text-xs">Percentage of steps handled by automation or system (not human)</p>
                  </TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-2 text-[9px] text-zinc-500">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 cursor-default" data-testid="stat-resolved"><Zap className="h-2.5 w-2.5 text-green-400" /> {automatedCount} resolved</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">Pain points from the AS-IS map that have been automated in this TO-BE map</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 cursor-default" data-testid="stat-system"><Monitor className="h-2.5 w-2.5 text-purple-400" /> {systemCount} system</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">Steps performed by existing systems (non-human)</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-0.5 cursor-default" data-testid="stat-human"><User className="h-2.5 w-2.5 text-blue-400" /> {humanCount} human</span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">Steps that still require manual human intervention</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeView !== "sdd" && (
        <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-800/80 bg-gray-50/50 dark:bg-zinc-950/30" data-testid="map-completeness-bar">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500 font-medium">Completeness</span>
            <span className={`text-[10px] font-semibold ${mapCompleteness >= 85 ? "text-green-400" : mapCompleteness >= 50 ? "text-amber-400" : "text-zinc-500"}`}>
              {mapCompleteness}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                mapCompleteness >= 85 ? "bg-green-500" : mapCompleteness >= 50 ? "bg-amber-500" : "bg-zinc-600"
              }`}
              style={{ width: `${mapCompleteness}%` }}
            />
          </div>
        </div>
      )}

      {showPerformers && performerSummary && activeView !== "sdd" && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800/80 bg-gray-50/60 dark:bg-zinc-950/40 space-y-3" data-testid="panel-performers">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-zinc-300">Human vs Machine Breakdown</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20" data-testid="summary-human">
              <div className="flex items-center gap-1.5 mb-1">
                <User className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-400">Human</span>
              </div>
              <span className="text-lg font-bold text-blue-300">{performerSummary.human.count}</span>
              {performerSummary.human.nodes.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {performerSummary.human.nodes.slice(0, 3).map((n, i) => (
                    <div key={i} className="text-[8px] text-blue-400/60 truncate">{n}</div>
                  ))}
                  {performerSummary.human.nodes.length > 3 && (
                    <div className="text-[8px] text-blue-400/40">+{performerSummary.human.nodes.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20" data-testid="summary-system">
              <div className="flex items-center gap-1.5 mb-1">
                <Monitor className="h-3 w-3 text-purple-400" />
                <span className="text-[10px] font-semibold text-purple-400">System</span>
              </div>
              <span className="text-lg font-bold text-purple-300">{performerSummary.system.count}</span>
              {performerSummary.system.nodes.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {performerSummary.system.nodes.slice(0, 3).map((n, i) => (
                    <div key={i} className="text-[8px] text-purple-400/60 truncate">{n}</div>
                  ))}
                  {performerSummary.system.nodes.length > 3 && (
                    <div className="text-[8px] text-purple-400/40">+{performerSummary.system.nodes.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20" data-testid="summary-hybrid">
              <div className="flex items-center gap-1.5 mb-1">
                <Bot className="h-3 w-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-400">Hybrid</span>
              </div>
              <span className="text-lg font-bold text-amber-300">{performerSummary.hybrid.count}</span>
              {performerSummary.hybrid.nodes.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {performerSummary.hybrid.nodes.slice(0, 3).map((n, i) => (
                    <div key={i} className="text-[8px] text-amber-400/60 truncate">{n}</div>
                  ))}
                  {performerSummary.hybrid.nodes.length > 3 && (
                    <div className="text-[8px] text-amber-400/40">+{performerSummary.hybrid.nodes.length - 3} more</div>
                  )}
                </div>
              )}
            </div>
          </div>
          {(() => {
            const total = performerSummary.human.count + performerSummary.system.count + performerSummary.hybrid.count;
            if (total === 0) return null;
            const humanPct = Math.round((performerSummary.human.count / total) * 100);
            const sysPct = Math.round((performerSummary.system.count / total) * 100);
            const hybridPct = 100 - humanPct - sysPct;
            return (
              <div className="h-2 rounded-full overflow-hidden flex bg-zinc-800">
                {humanPct > 0 && <div className="h-full bg-blue-500" style={{ width: `${humanPct}%` }} />}
                {sysPct > 0 && <div className="h-full bg-purple-500" style={{ width: `${sysPct}%` }} />}
                {hybridPct > 0 && <div className="h-full bg-amber-500" style={{ width: `${hybridPct}%` }} />}
              </div>
            );
          })()}
        </div>
      )}

      {showGuidance && completenessIssues.length > 0 && activeView !== "sdd" && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800/80 bg-gray-50/60 dark:bg-zinc-950/40 space-y-2" data-testid="panel-guidance">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-zinc-300">Completeness Suggestions</span>
          </div>
          {completenessIssues.map((issue, i) => {
            const isClickable = !!issue.nodeId;
            return (
              <button
                key={i}
                type="button"
                disabled={!isClickable}
                onClick={() => { if (issue.nodeId) focusNodeRef.current?.(issue.nodeId); }}
                className={`flex items-start gap-2 p-2 rounded-lg text-[10px] w-full text-left transition-colors ${
                  issue.severity === "warning"
                    ? "bg-amber-500/10 border border-amber-500/15 text-amber-400"
                    : "bg-zinc-800/50 border border-zinc-700/30 text-zinc-400"
                } ${isClickable ? "cursor-pointer hover:bg-amber-500/20 hover:border-amber-500/30" : "cursor-default"}`}
                data-testid={`guidance-issue-${i}`}
              >
                {issue.severity === "warning" ? (
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                ) : (
                  <Sparkles className="h-3 w-3 mt-0.5 shrink-0 text-zinc-500" />
                )}
                <span className="leading-relaxed flex-1">{issue.message}</span>
                {isClickable && (
                  <Maximize2 className="h-3 w-3 mt-0.5 shrink-0 opacity-50" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {showGuidance && completenessIssues.length === 0 && activeView !== "sdd" && nodeCount > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800/80 bg-gray-50/60 dark:bg-zinc-950/40" data-testid="panel-guidance-complete">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-[10px]">
            <Check className="h-3 w-3" />
            <span>Process map looks complete — no issues detected</span>
          </div>
        </div>
      )}

      {showPhases && phaseGroups.length > 0 && activeView !== "sdd" && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800/80 bg-gray-50/60 dark:bg-zinc-950/40 space-y-2" data-testid="panel-phases">
          <div className="flex items-center gap-2 mb-1">
            <CircleDot className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] font-semibold text-gray-700 dark:text-zinc-300">Phase Groups ({phaseGroups.length})</span>
          </div>
          {phaseGroups.map((group, gi) => (
            <details key={gi} className="group" data-testid={`phase-group-${gi}`}>
              <summary className="flex items-center gap-2 p-2 rounded-lg bg-gray-100/60 dark:bg-zinc-800/40 border border-gray-200/50 dark:border-zinc-700/30 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors text-[10px] text-gray-700 dark:text-zinc-300 font-medium">
                <ChevronRight className="h-3 w-3 text-zinc-500 group-open:rotate-90 transition-transform" />
                <span>{group.name}</span>
                <Badge variant="outline" className="ml-auto text-[8px] border-zinc-700 text-zinc-500">{group.nodes.length} steps</Badge>
              </summary>
              <div className="pl-6 pt-1 space-y-0.5">
                {group.nodes.map((node, ni) => {
                  const perf = classifyPerformer(node.role || "", node.system || "");
                  const perfColor = perf === "system" ? "text-purple-400" : perf === "hybrid" ? "text-amber-400" : "text-blue-400";
                  const PerfIcon = perf === "system" ? Monitor : perf === "hybrid" ? Bot : User;
                  return (
                    <button
                      key={ni}
                      type="button"
                      onClick={() => focusNodeRef.current?.(String(node.id))}
                      className="flex items-center gap-2 text-[9px] text-zinc-400 py-0.5 w-full text-left hover:text-zinc-200 transition-colors cursor-pointer"
                      data-testid={`phase-node-${node.id}`}
                    >
                      <PerfIcon className={`h-2.5 w-2.5 ${perfColor}`} />
                      <span className="truncate">{node.name}</span>
                      {(node.nodeType === "decision" || node.nodeType === "agent-decision") && <Diamond className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                      {(node.nodeType === "agent-task" || node.nodeType === "agent-loop") && <Brain className="h-2.5 w-2.5 text-purple-500 shrink-0" />}
                      <Maximize2 className="h-2 w-2 ml-auto shrink-0 opacity-0 group-hover:opacity-30" />
                    </button>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      )}

      {activeView === "sdd" ? (
        <SDDInlineViewer ideaId={ideaId} onApproved={onApproved} />
      ) : (
        <ReactFlowErrorBoundary>
          <ReactFlowProvider>
            <DelayedMount>
              <ProcessMapFlow ideaId={ideaId} activeView={activeView} detailLevel={detailLevel} onRelayout={(fn) => { relayoutRef.current = fn; }} onUndoRedoReady={setUndoRedoControls} onFocusNodeReady={(fn) => { focusNodeRef.current = fn; }} onDetailLevelChange={setDetailLevel} />
            </DelayedMount>
          </ReactFlowProvider>
        </ReactFlowErrorBoundary>
      )}

      {showApproveButton && (
        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-zinc-800/80 flex items-center justify-between bg-gray-50/80 dark:bg-zinc-950/50">
          {!showApprovalConfirm ? (
            <div className="flex items-center gap-2 flex-1">
              <Button
                size="sm"
                className={`text-xs h-8 rounded-lg shadow-sm ${mapChanged ? "bg-amber-500 hover:bg-amber-500/80 shadow-amber-500/20" : "bg-cb-teal hover:bg-cb-teal/80 shadow-cb-teal/20"}`}
                onClick={() => setShowApprovalConfirm(true)}
                data-testid="button-approve-map"
              >
                {mapChanged ? (
                  <><RefreshCw className="h-3 w-3 mr-1.5" /> Re-approve {activeView === "as-is" ? "As-Is" : "To-Be"} Map</>
                ) : (
                  <><Check className="h-3 w-3 mr-1.5" /> Approve {activeView === "as-is" ? "As-Is" : activeView === "to-be" ? "To-Be" : "SDD"} Map</>
                )}
              </Button>
              {mapChanged && approval && (
                <span className="text-[10px] text-amber-400/80">Map changed since v{(approval as any).version || 1} approval</span>
              )}
            </div>
          ) : (
            <div className="flex-1 space-y-2">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {mapChanged
                  ? `Changes detected since last approval. Re-approving will create a new version and ${activeView === "as-is" ? "invalidate all downstream artifacts (To-Be, PDD, SDD, UiPath package)" : "invalidate downstream documents (PDD, SDD)"}.`
                  : `By approving, you formally sign off on this ${activeView === "as-is" ? "As-Is" : activeView === "to-be" ? "To-Be" : "SDD"} process map. This is recorded with your name, role, and timestamp.`
                }
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className={`text-xs h-7 rounded-lg ${mapChanged ? "bg-amber-500 hover:bg-amber-500/80" : "bg-cb-teal hover:bg-cb-teal/80"}`}
                  onClick={() => { approveMutation.mutate(); setShowApprovalConfirm(false); }}
                  disabled={approveMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  {mapChanged ? "Confirm Re-approval" : "Confirm"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 text-zinc-400"
                  onClick={() => setShowApprovalConfirm(false)}
                  data-testid="button-cancel-approve"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeView !== "sdd" && approval && !mapChanged && (
        <div className="px-4 py-2.5 border-t border-gray-200 dark:border-zinc-800/80 flex items-center justify-between bg-gray-50/80 dark:bg-zinc-950/50" data-testid="approval-badge">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Check className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] text-emerald-400 font-medium">{activeView === "as-is" ? "As-Is" : "To-Be"} Approved v{(approval as any).version || 1}</span>
            </div>
            <span className="text-[10px] text-zinc-500">
              {new Date(approval.approvedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              {" by "}
              {approval.userName}
            </span>
          </div>

          {approvalHistory && approvalHistory.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="text-xs h-7 text-zinc-400 hover:text-zinc-200 gap-1" data-testid="button-version-history">
                  <History className="h-3 w-3" />
                  <span>v{(approval as any).version || 1}</span>
                  <ChevronDown className="h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[240px]">
                {approvalHistory.map((h) => (
                  <DropdownMenuItem
                    key={h.id}
                    className="flex flex-col items-start gap-0.5 cursor-pointer"
                    onClick={() => setViewingSnapshotVersion(h.version === (approval as any).version ? null : (h as any).version)}
                    data-testid={`version-item-${(h as any).version}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-xs font-medium">
                        v{(h as any).version || 1}
                        {(h as any).version === (approval as any).version && " (current)"}
                      </span>
                      {(h as any).invalidated && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">superseded</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(h.approvedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {" by "}{h.userName}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
