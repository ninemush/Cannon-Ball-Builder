import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
  useReactFlow,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
}

type ProcessView = "as-is" | "to-be" | "sdd";

interface ProcessMapPanelProps {
  ideaId: string;
  onStepsChange?: (count: number) => void;
  onApproved?: () => void;
  onCompletenessChange?: (pct: number) => void;
  onViewChange?: (view: ProcessView) => void;
}

function getNodeDimensions(nodeType: string): { width: number; height: number } {
  if (nodeType === "start") return { width: 56, height: 56 };
  if (nodeType === "end") return { width: 56, height: 56 };
  if (nodeType === "decision") return { width: 64, height: 64 };
  return { width: 220, height: 72 };
}

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: "LR" | "TB" = "TB"
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 80,
    edgesep: 30,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    const nodeType = (node.data as any)?.nodeType || "task";
    const dims = getNodeDimensions(nodeType);
    g.setNode(node.id, { width: dims.width, height: dims.height });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
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

function StartNode({ data, id }: { data: any; id: string }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: 56, height: 56 }}
      data-testid={`node-${id}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-3 !h-3" />
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
        style={{
          background: "linear-gradient(135deg, #10b981, #059669)",
          border: "3px solid #34d399",
        }}
      >
        <Play className="h-4 w-4 text-white ml-0.5" fill="white" />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Left} id="left" className="!opacity-0 !w-3 !h-3" />
    </div>
  );
}

function EndNode({ data, id }: { data: any; id: string }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: 56, height: 56 }}
      data-testid={`node-${id}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} id="left-target" className="!opacity-0 !w-3 !h-3" />
      <Handle type="target" position={Position.Right} id="right-target" className="!opacity-0 !w-3 !h-3" />
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30"
        style={{
          background: "linear-gradient(135deg, #ef4444, #dc2626)",
          border: "3px solid #f87171",
        }}
      >
        <Square className="h-3.5 w-3.5 text-white" fill="white" />
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-3 !h-3" />
    </div>
  );
}

function DecisionNode({ data, id }: { data: any; id: string }) {
  const performer = classifyPerformer(data.role || "", data.system || "");
  const isAutomated = data.viewType === "to-be" && (data.description || "").startsWith("[AUTOMATED]");

  const bgColor = isAutomated ? "#166534" : "#92400e";
  const borderColor = isAutomated ? "#22c55e" : "#f59e0b";
  const glowColor = isAutomated ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)";

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer"
      style={{ width: 64, height: 64 }}
      data-testid={`node-${id}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} id="left-target" className="!opacity-0 !w-3 !h-3" />
      <div
        className="absolute transition-all hover:brightness-110"
        style={{
          width: 46,
          height: 46,
          transform: "rotate(45deg)",
          background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
          border: `2.5px solid ${borderColor}`,
          borderRadius: 6,
          boxShadow: `0 4px 20px ${glowColor}`,
        }}
      />
      <div className="relative z-10 text-center" style={{ maxWidth: 52 }}>
        <div className="text-white text-[8px] font-bold leading-tight truncate px-0.5">
          {data.label?.length > 12 ? data.label.slice(0, 12) + "…" : data.label}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} id="bottom" className="!opacity-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Left} id="left" className="!opacity-0 !w-3 !h-3" />
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

  const accentColor = isAutomated ? "#22c55e" : performer === "system" ? "#8b5cf6" : performer === "hybrid" ? "#f59e0b" : "#3b82f6";
  const bgColor = isAutomated ? "rgba(22,101,52,0.3)" : "rgba(30,30,36,0.95)";
  const borderColor = isGhost || isLowConf ? "rgba(75,75,85,0.5)" : "rgba(55,55,65,0.8)";

  const PerformerIcon = performer === "system" ? Monitor : performer === "hybrid" ? Bot : User;

  return (
    <div
      className="relative cursor-pointer group"
      style={{
        width: 220,
        opacity: isGhost || isLowConf ? 0.5 : 1,
        borderStyle: isGhost ? "dashed" : "solid",
      }}
      data-testid={`node-${id}`}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0 !w-3 !h-3" />
      <Handle type="target" position={Position.Left} id="left-target" className="!opacity-0 !w-3 !h-3" />
      <div
        className="rounded-xl overflow-hidden transition-all duration-200 group-hover:shadow-lg"
        style={{
          background: bgColor,
          border: `1.5px solid ${borderColor}`,
          boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)`,
        }}
      >
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
        />
        <div className="px-3 py-2.5">
          <div className="flex items-start gap-2">
            <div
              className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5"
              style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}30` }}
            >
              <PerformerIcon className="h-3 w-3" style={{ color: accentColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-white/90 leading-tight truncate">
                {data.label}
              </div>
              {data.role && (
                <div className="text-[9px] text-white/40 mt-0.5 truncate">{data.role}</div>
              )}
            </div>
          </div>
          {data.system && data.system !== "manual" && data.system !== "Manual" && (
            <div className="mt-1.5 flex items-center gap-1">
              <Monitor className="h-2.5 w-2.5 text-white/25" />
              <span className="text-[8px] text-white/30 truncate">{data.system}</span>
            </div>
          )}
          {isAutomated && (
            <div className="mt-1.5 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5 text-green-400" />
              <span className="text-[8px] text-green-400/80 font-medium">Automated</span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!opacity-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Right} id="right" className="!opacity-0 !w-3 !h-3" />
      <Handle type="source" position={Position.Left} id="left" className="!opacity-0 !w-3 !h-3" />
      {data.isPainPoint && <Flag className="absolute -top-1.5 -right-1.5 h-3 w-3 text-red-500 fill-red-500 z-10" />}
    </div>
  );
}

function ProcessNodeComponent({ data, id }: { data: any; id: string }) {
  const nodeType = data.nodeType || "task";
  if (nodeType === "start") return <StartNode data={data} id={id} />;
  if (nodeType === "end") return <EndNode data={data} id={id} />;
  if (nodeType === "decision") return <DecisionNode data={data} id={id} />;
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
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 20,
  });

  const label = data?.label || "";
  const isYes = /^(yes|approved|pass|valid|complete|true)$/i.test(label);
  const isNo = /^(no|rejected|fail|invalid|incomplete|false)$/i.test(label);
  const isToBeView = data?.viewType === "to-be";

  let edgeColor = "rgba(100,100,120,0.5)";
  if (isToBeView) edgeColor = "rgba(34,197,94,0.6)";
  else if (isYes) edgeColor = "#22c55e";
  else if (isNo) edgeColor = "#ef4444";
  else if (label) edgeColor = "rgba(140,140,160,0.6)";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: label ? 2 : 1.5,
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className={`px-2 py-0.5 rounded-full text-[9px] font-semibold cursor-pointer transition-all shadow-sm ${
              isYes
                ? "bg-emerald-950/90 border border-emerald-500/40 text-emerald-300"
                : isNo
                ? "bg-red-950/90 border border-red-500/40 text-red-300"
                : "bg-zinc-900/90 border border-zinc-600/40 text-zinc-300"
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

interface NodeEditData {
  nodeId: number;
  name: string;
  role: string;
  system: string;
  nodeType: "task" | "decision" | "start" | "end";
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
    <div className="absolute right-0 top-0 bottom-0 w-72 bg-zinc-950/95 backdrop-blur-md border-l border-zinc-800 z-50 flex flex-col overflow-y-auto" data-testid="panel-node-edit">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
            <Pencil className="h-3 w-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-white">{isNew ? "Add Step" : "Edit Step"}</span>
        </div>
        <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors" data-testid="button-close-edit">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Step Name</label>
          <input
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.name}
            onChange={(e) => onChange({ ...editData, name: e.target.value })}
            data-testid="input-node-name"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Role</label>
          <input
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.role}
            onChange={(e) => onChange({ ...editData, role: e.target.value })}
            data-testid="input-node-role"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">System</label>
          <input
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.system}
            onChange={(e) => onChange({ ...editData, system: e.target.value })}
            data-testid="input-node-system"
          />
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Type</label>
          <select
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none transition-all"
            value={editData.nodeType}
            onChange={(e) => onChange({ ...editData, nodeType: e.target.value as any })}
            data-testid="select-node-type"
          >
            <option value="task">Task</option>
            <option value="decision">Decision / Gateway</option>
            <option value="start">Start Event</option>
            <option value="end">End Event</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Description</label>
          <textarea
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none transition-all"
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
            className="rounded border-zinc-600 bg-zinc-900 text-red-500 focus:ring-red-500/30"
          />
          <Flag className="h-3 w-3 text-red-400 group-hover:text-red-300" />
          <span className="text-xs text-zinc-400 group-hover:text-zinc-300">Pain point</span>
        </label>
      </div>
      <div className="p-4 border-t border-zinc-800 flex items-center gap-2">
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
      className="absolute z-50 bg-zinc-950/95 backdrop-blur-md border border-zinc-700 rounded-xl p-3 shadow-2xl"
      style={{ left: position.x, top: position.y }}
      data-testid="popup-edge-label"
    >
      <div className="text-[10px] text-zinc-500 font-medium mb-1.5">Edge Label</div>
      <div className="flex items-center gap-2">
        <input
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-primary focus:outline-none w-36"
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
        <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors" data-testid="button-cancel-edge-label">
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
      className="absolute z-50 bg-zinc-950/95 backdrop-blur-md border border-zinc-700 rounded-xl py-1.5 shadow-2xl min-w-[160px]"
      style={{ left: position.x, top: position.y }}
      data-testid="context-menu"
    >
      <button
        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
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
  onDelete,
  onClose,
}: {
  position: { x: number; y: number };
  nodeData: { dbId: number; label: string; nodeType: string };
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute z-50 bg-zinc-950/95 backdrop-blur-md border border-zinc-700 rounded-xl py-1.5 shadow-2xl min-w-[180px]"
      style={{ left: position.x, top: position.y }}
      data-testid="node-context-menu"
    >
      <button
        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
        onClick={onEdit}
        data-testid="button-edit-node-context"
      >
        <Pencil className="h-3.5 w-3.5 text-primary" /> Edit Step
      </button>
      <button
        className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2.5 transition-colors"
        onClick={onAddChild}
        data-testid="button-add-child-context"
      >
        <Plus className="h-3.5 w-3.5 text-cb-teal" />
        {nodeData.nodeType === "decision" ? "Add Branch" : "Add Child Step"}
      </button>
      <div className="h-px bg-zinc-800 my-1" />
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

function ProcessMapFlow({ ideaId, activeView, onRelayout, onUndoRedoReady }: { ideaId: string; activeView: ProcessView; onRelayout?: (fn: () => void) => void; onUndoRedoReady?: (controls: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }) => void; }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
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
  const hasInitialFitRef = useRef(false);
  const dataVersionRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextHistoryRef = useRef(false);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const { pushSnapshot, undo, redo, reset: resetHistory, canUndo, canRedo } = useUndoRedo();
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);

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

  const doRelayout = useCallback(() => {
    if (!mapData) return;
    const dbNodes = mapData.nodes;
    const dbEdges = mapData.edges;
    const rawNodes: Node[] = dbNodes.map((n) => ({
      id: String(n.id),
      type: "processNode",
      position: { x: 0, y: 0 },
      data: {
        label: n.name, role: n.role, system: n.system, nodeType: n.nodeType,
        isGhost: n.isGhost, isPainPoint: n.isPainPoint, description: n.description,
        dbId: n.id, viewType: activeView,
      },
    }));
    const rawEdges: Edge[] = dbEdges.map((e) => ({
      id: String(e.id), source: String(e.sourceNodeId), target: String(e.targetNodeId),
      type: "custom", data: { label: e.label, dbId: e.id, viewType: activeView },
    }));
    let layoutNodes: Node[];
    if (rawEdges.length > 0) {
      layoutNodes = applyDagreLayout(rawNodes, rawEdges, "TB");
    } else {
      layoutNodes = rawNodes.map((node, i) => ({ ...node, position: getNodePosition(i, rawNodes.length) }));
    }
    setNodes(layoutNodes);
    layoutNodes.forEach((n) => {
      const d = n.data as any;
      if (d.dbId) {
        updateNodeMutation.mutate({ id: d.dbId, data: { positionX: n.position.x, positionY: n.position.y } });
      }
    });
    setTimeout(() => fitView({ padding: 0.3, duration: 400, maxZoom: 1.2 }), 150);
  }, [mapData, activeView, setNodes, fitView]);

  useEffect(() => {
    if (onRelayout) onRelayout(doRelayout);
  }, [onRelayout, doRelayout]);

  useEffect(() => {
    if (!mapData) return;
    const dbNodes = mapData.nodes;
    const dbEdges = mapData.edges;

    const savedCount = dbNodes.filter((n) => n.positionX !== 0 || n.positionY !== 0).length;
    const hasSavedPositions = savedCount > 0;
    const allHaveSavedPositions = savedCount === dbNodes.length;

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

    const rawEdges: Edge[] = dbEdges.map((e) => ({
      id: String(e.id),
      source: String(e.sourceNodeId),
      target: String(e.targetNodeId),
      type: "custom",
      data: { label: e.label, dbId: e.id, viewType: activeView },
      animated: activeView === "to-be" || activeView === "sdd",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: activeView === "sdd" ? "rgba(249,115,22,0.6)" : activeView === "to-be" ? "rgba(34,197,94,0.6)" : "rgba(100,100,120,0.5)",
      },
    }));

    let layoutNodes: Node[];

    if (allHaveSavedPositions) {
      layoutNodes = rawNodes;
    } else if (!hasSavedPositions) {
      if (rawEdges.length > 0) {
        layoutNodes = applyDagreLayout(rawNodes, rawEdges, "TB");
      } else if (rawNodes.length > 0) {
        layoutNodes = rawNodes.map((node, i) => ({
          ...node,
          position: getNodePosition(i, rawNodes.length),
        }));
      } else {
        layoutNodes = rawNodes;
      }
      layoutNodes.forEach((n) => {
        const d = n.data as any;
        if (d.dbId) {
          updateNodeMutation.mutate({ id: d.dbId, data: { positionX: n.position.x, positionY: n.position.y } });
        }
      });
    } else {
      if (rawEdges.length > 0) {
        const unsavedNodes = rawNodes.filter((n) => n.position.x === 0 && n.position.y === 0);
        if (unsavedNodes.length > 0) {
          const layoutAll = applyDagreLayout(rawNodes, rawEdges, "TB");
          layoutNodes = rawNodes.map((n) => {
            if (n.position.x === 0 && n.position.y === 0) {
              const laid = layoutAll.find((l) => l.id === n.id);
              const pos = laid ? laid.position : { x: 0, y: 0 };
              const d = n.data as any;
              if (d.dbId) {
                updateNodeMutation.mutate({ id: d.dbId, data: { positionX: pos.x, positionY: pos.y } });
              }
              return { ...n, position: pos };
            }
            return n;
          });
        } else {
          layoutNodes = rawNodes;
        }
      } else {
        layoutNodes = rawNodes.map((node, i) => {
          if (node.position.x === 0 && node.position.y === 0) {
            const pos = getNodePosition(i, rawNodes.length);
            const d = node.data as any;
            if (d.dbId) {
              updateNodeMutation.mutate({ id: d.dbId, data: { positionX: pos.x, positionY: pos.y } });
            }
            return { ...node, position: pos };
          }
          return node;
        });
      }
    }

    setNodes(layoutNodes);
    setEdges(rawEdges);
    dataVersionRef.current += 1;

    if (!hasInitialFitRef.current && layoutNodes.length > 0) {
      hasInitialFitRef.current = true;
      setTimeout(() => fitView({ padding: 0.3, duration: 400, maxZoom: 1.2 }), 150);
    }
  }, [mapData, setNodes, setEdges]);

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
  }, []);

  const onNodeContextMenu = useCallback((event: any, node: Node) => {
    event.preventDefault();
    const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
    if (bounds) {
      const d = node.data as any;
      setNodeContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        nodeData: { dbId: d.dbId, label: d.label || "", nodeType: d.nodeType || "task" },
      });
      setContextMenu(null);
    }
  }, []);

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

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setNodeContextMenu(null);
    setSelectedEdgeIds(new Set());
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;

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
    if (d.dbId) {
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
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800">
              <GitBranch className="h-7 w-7 text-zinc-600" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="h-3 w-3 text-primary" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-zinc-300">
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
        defaultEdgeOptions={{
          type: "custom",
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
          },
        }}
        connectionLineStyle={{ stroke: "rgba(251,146,60,0.6)", strokeWidth: 2 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        edgesReconnectable
        proOptions={{ hideAttribution: true }}
        className={`process-map-canvas ${reconnectingEdge ? "reconnecting" : ""}`}
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={[10, 10]}
        deleteKeyCode={null}
        selectionKeyCode={null}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(100,100,120,0.15)"
        />
        <Controls
          showInteractive={false}
          className="!bg-zinc-900/90 !border-zinc-700 !rounded-xl !shadow-lg [&_button]:!bg-zinc-800 [&_button]:!border-zinc-700 [&_button]:!text-zinc-400 [&_button:hover]:!bg-zinc-700 [&_button:hover]:!text-white [&_button]:!rounded-lg"
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
          maskColor="rgba(0,0,0,0.7)"
          className="!bg-zinc-900/80 !border-zinc-700 !rounded-xl"
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

function SDDInlineViewer({ ideaId }: { ideaId: string }) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

  const { data: sddVersions, isLoading } = useQuery<{ id: number; version: number; content: string; status: string; createdAt: string }[]>({
    queryKey: ["/api/ideas", ideaId, "documents", "versions", "SDD"],
  });

  const latestSdd = sddVersions?.length ? sddVersions[sddVersions.length - 1] : null;

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

  if (!latestSdd) {
    return (
      <div className="flex-1 flex items-center justify-center p-6" data-testid="sdd-view-empty">
        <div className="text-center max-w-sm space-y-3">
          <div className="w-12 h-12 rounded-xl bg-cb-orange/10 flex items-center justify-center mx-auto">
            <FileText className="h-6 w-6 text-cb-orange" />
          </div>
          <h4 className="text-sm font-semibold text-zinc-300">No SDD Generated Yet</h4>
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

  const sections = parseSddSections(latestSdd.content);

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
      <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-cb-orange" />
          <span className="text-xs font-semibold text-zinc-300">Solution Design Document</span>
          <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-500">
            v{latestSdd.version}
          </Badge>
          {latestSdd.status === "approved" && (
            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
              <Check className="h-3 w-3" /> Approved
            </span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600">
          {new Date(latestSdd.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
                <span className="text-xs font-medium text-zinc-300">{section.title}</span>
              </button>
              {isExpanded && (
                <div className="px-6 pb-4 text-xs text-zinc-400 leading-relaxed prose prose-invert prose-xs max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProcessMapPanel({ ideaId, onStepsChange, onApproved, onCompletenessChange, onViewChange }: ProcessMapPanelProps) {
  const [activeView, setActiveView] = useState<ProcessView>("as-is");

  const handleViewChange = useCallback((view: ProcessView) => {
    setActiveView(view);
    onViewChange?.(view);
  }, [onViewChange]);

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
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
      onApproved?.();
    },
  });

  const [showApprovalConfirm, setShowApprovalConfirm] = useState(false);
  const relayoutRef = useRef<(() => void) | null>(null);
  const [undoRedoControls, setUndoRedoControls] = useState<{ undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  return (
    <div className={`flex flex-col ${isFullscreen ? "fixed inset-0 z-50 bg-zinc-950" : "h-full"}`} data-testid="panel-process-map">
      <div className="px-4 py-3 border-b border-zinc-800/80 flex items-center justify-between gap-2 bg-zinc-950/50">
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeView === "sdd" ? "bg-cb-orange/10" : "bg-cb-teal/10"}`}>
            {activeView === "sdd" ? <FileText className="h-3.5 w-3.5 text-cb-orange" /> : <GitBranch className="h-3.5 w-3.5 text-cb-teal" />}
          </div>
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
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
                className="text-[10px] h-7 w-7 p-0 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
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
                className="text-[10px] h-7 w-7 p-0 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                onClick={undoRedoControls.redo}
                disabled={!undoRedoControls.canRedo}
                title="Redo (Ctrl+Shift+Z)"
                data-testid="button-redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {activeView !== "sdd" && nodeCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-[10px] h-7 px-2 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg"
              onClick={() => relayoutRef.current?.()}
              data-testid="button-relayout"
            >
              <LayoutGrid className="h-3 w-3 mr-1" /> Re-layout
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-[10px] h-7 w-7 p-0 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            data-testid="button-fullscreen-map"
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <div
            className="flex items-center rounded-full bg-zinc-900 border border-zinc-800 p-0.5"
            data-testid="button-toggle-view"
          >
            <button
              onClick={() => handleViewChange("as-is")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "as-is" ? "bg-cb-teal text-white shadow-sm shadow-cb-teal/20" : "text-zinc-500 hover:text-zinc-300"}`}
              data-testid="button-view-as-is"
            >
              As-Is
            </button>
            <button
              onClick={() => handleViewChange("to-be")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "to-be" ? "bg-cb-teal text-white shadow-sm shadow-cb-teal/20" : "text-zinc-500 hover:text-zinc-300"}`}
              data-testid="button-view-to-be"
            >
              To-Be
            </button>
            <button
              onClick={() => handleViewChange("sdd")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "sdd" ? "bg-cb-orange text-white shadow-sm shadow-cb-orange/20" : "text-zinc-500 hover:text-zinc-300"}`}
              data-testid="button-view-sdd"
            >
              SDD
            </button>
          </div>
        </div>
      </div>

      {activeView === "to-be" && nodeCount > 0 && (
        <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-950/30" data-testid="automation-impact-bar">
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
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-green-400" />
                  <span className="text-[10px] font-semibold text-green-400">{automationPct}% automated</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-zinc-500">
                  <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5 text-green-400" /> {automatedCount} resolved</span>
                  <span className="flex items-center gap-0.5"><Monitor className="h-2.5 w-2.5 text-purple-400" /> {systemCount} system</span>
                  <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5 text-blue-400" /> {humanCount} human</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {nodeCount > 0 && !approval && activeView === "as-is" && (
        <div className="px-4 py-2 border-b border-zinc-800/80 bg-zinc-950/30" data-testid="map-completeness-bar">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500 font-medium">Completeness</span>
            <span className={`text-[10px] font-semibold ${mapCompleteness >= 85 ? "text-green-400" : mapCompleteness >= 50 ? "text-amber-400" : "text-zinc-500"}`}>
              {mapCompleteness}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                mapCompleteness >= 85 ? "bg-green-500" : mapCompleteness >= 50 ? "bg-amber-500" : "bg-zinc-600"
              }`}
              style={{ width: `${mapCompleteness}%` }}
            />
          </div>
        </div>
      )}

      {activeView === "sdd" ? (
        <SDDInlineViewer ideaId={ideaId} />
      ) : (
        <ReactFlowProvider>
          <ProcessMapFlow ideaId={ideaId} activeView={activeView} onRelayout={(fn) => { relayoutRef.current = fn; }} onUndoRedoReady={setUndoRedoControls} />
        </ReactFlowProvider>
      )}

      {activeView !== "sdd" && nodeCount >= 3 && !approval && (
        <div className="px-4 py-2.5 border-t border-zinc-800/80 flex items-center justify-between bg-zinc-950/50">
          {!showApprovalConfirm ? (
            <Button
              size="sm"
              className="text-xs h-8 bg-cb-teal hover:bg-cb-teal/80 rounded-lg shadow-sm shadow-cb-teal/20"
              onClick={() => setShowApprovalConfirm(true)}
              data-testid="button-approve-map"
            >
              <Check className="h-3 w-3 mr-1.5" /> Approve {activeView === "as-is" ? "As-Is" : activeView === "to-be" ? "To-Be" : "SDD"} Map
            </Button>
          ) : (
            <div className="flex-1 space-y-2">
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                By approving, you formally sign off on this {activeView === "as-is" ? "As-Is" : activeView === "to-be" ? "To-Be" : "SDD"} process map. This is recorded with your name, role, and timestamp.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="text-xs h-7 bg-cb-teal hover:bg-cb-teal/80 rounded-lg"
                  onClick={() => { approveMutation.mutate(); setShowApprovalConfirm(false); }}
                  disabled={approveMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Confirm
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

      {activeView !== "sdd" && approval && (
        <div className="px-4 py-2.5 border-t border-zinc-800/80 flex items-center gap-2 bg-zinc-950/50" data-testid="approval-badge">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Check className="h-3 w-3 text-emerald-500" />
            <span className="text-[11px] text-emerald-400 font-medium">{activeView === "as-is" ? "As-Is" : "To-Be"} Approved</span>
          </div>
          <span className="text-[10px] text-zinc-500">
            {new Date(approval.approvedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {" by "}
            {approval.userName}
          </span>
        </div>
      )}
    </div>
  );
}
