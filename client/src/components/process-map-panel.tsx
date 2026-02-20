import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
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
  getBezierPath,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProcessMapData {
  nodes: ProcessNode[];
  edges: { id: number; ideaId: string; viewType: string; sourceNodeId: number; targetNodeId: number; label: string; createdAt: string }[];
  approval: ProcessApproval | null;
}

interface ProcessMapPanelProps {
  ideaId: string;
  onStepsChange?: (count: number) => void;
  onApproved?: () => void;
  onCompletenessChange?: (pct: number) => void;
}

const NODE_SPACING_X = 300;
const NODE_SPACING_Y = 0;
const START_X = 80;
const START_Y = 200;

function getNodePosition(index: number, total: number) {
  const cols = Math.min(total, 4);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: START_X + col * NODE_SPACING_X,
    y: START_Y + row * 160,
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

function getConfidenceStyles(confidence: number, isGhost: boolean) {
  if (isGhost || confidence < 50) {
    return { opacity: 0.4, borderStyle: "dashed" as const, level: "low" };
  }
  if (confidence < 80) {
    return { opacity: 0.7, borderStyle: "solid" as const, level: "medium" };
  }
  return { opacity: 1, borderStyle: "solid" as const, level: "high" };
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

function PerformerBadge({ performer, size = "normal" }: { performer: PerformerType; size?: "normal" | "small" }) {
  const iconSize = size === "small" ? "h-2.5 w-2.5" : "h-3 w-3";
  const textSize = size === "small" ? "text-[7px]" : "text-[8px]";
  const padding = size === "small" ? "px-1 py-0" : "px-1.5 py-0.5";

  if (performer === "human") {
    return (
      <span className={`inline-flex items-center gap-0.5 ${padding} rounded-full bg-blue-500/20 border border-blue-500/30 ${textSize} text-blue-300 font-medium`} data-testid="badge-performer-human">
        <User className={iconSize} />
        Human
      </span>
    );
  }
  if (performer === "system") {
    return (
      <span className={`inline-flex items-center gap-0.5 ${padding} rounded-full bg-purple-500/20 border border-purple-500/30 ${textSize} text-purple-300 font-medium`} data-testid="badge-performer-system">
        <Monitor className={iconSize} />
        System
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-0.5 ${padding} rounded-full bg-amber-500/20 border border-amber-500/30 ${textSize} text-amber-300 font-medium`} data-testid="badge-performer-hybrid">
      <User className={iconSize} />
      <Monitor className={iconSize} />
      Hybrid
    </span>
  );
}

function ProcessNodeComponent({ data, id }: { data: any; id: string }) {
  const nodeType = data.nodeType || "task";
  const isGhost = data.isGhost;
  const isPainPoint = data.isPainPoint;
  const confidence = getNodeConfidence(data);
  const confStyle = getConfidenceStyles(confidence, isGhost);
  const performer = classifyPerformer(data.role || "", data.system || "");
  const isAutomated = (data.description || "").startsWith("[AUTOMATED]");
  const isToBeView = data.viewType === "to-be";

  const baseClasses = "relative transition-all duration-300";

  if (nodeType === "start" || nodeType === "end") {
    return (
      <div
        className={`${baseClasses} px-5 py-3 rounded-full border-2 cursor-pointer`}
        style={{
          backgroundColor: "#008b9b",
          borderColor: "#00a5b8",
          borderStyle: confStyle.borderStyle,
          opacity: confStyle.opacity,
          minWidth: 120,
          textAlign: "center",
        }}
        data-testid={`node-${id}`}
      >
        <Handle type="target" position={Position.Left} className="!bg-[#008b9b] !border-[#00a5b8] !w-2 !h-2" />
        <div className="text-white text-xs font-semibold">{data.label}</div>
        {data.role && <div className="text-white/60 text-[10px] mt-0.5">{data.role}</div>}
        <Handle type="source" position={Position.Right} className="!bg-[#008b9b] !border-[#00a5b8] !w-2 !h-2" />
        {isPainPoint && <Flag className="absolute -top-2 -right-2 h-3.5 w-3.5 text-red-500 fill-red-500" />}
      </div>
    );
  }

  if (nodeType === "decision") {
    return (
      <div
        className={`${baseClasses} cursor-pointer`}
        style={{ width: 160, height: 120, opacity: confStyle.opacity }}
        data-testid={`node-${id}`}
      >
        <Handle type="target" position={Position.Left} className="!bg-[#c8940a] !border-[#daa520] !w-2 !h-2" style={{ top: "50%" }} />
        <div
          className="absolute flex flex-col items-center justify-center"
          style={{
            transform: "rotate(45deg)",
            backgroundColor: isToBeView && isAutomated ? "#166534" : confStyle.level === "low" ? "#555" : "#c8940a",
            borderRadius: 8,
            border: `2px ${confStyle.borderStyle} ${isToBeView && isAutomated ? "#22c55e" : "#daa520"}`,
            width: "65%",
            height: "65%",
            top: "10%",
            left: "17.5%",
          }}
        >
          <div style={{ transform: "rotate(-45deg)" }} className="text-center px-1">
            <div className="text-white text-[10px] font-semibold leading-tight">{data.label}</div>
            {data.role && <div className="text-white/60 text-[7px] mt-0.5">{data.role}</div>}
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex items-center gap-1 whitespace-nowrap">
          <PerformerBadge performer={performer} size="small" />
          {isToBeView && isAutomated && (
            <span className="inline-flex items-center gap-0.5 px-1 rounded-full bg-green-500/20 border border-green-500/30 text-[7px] text-green-300 font-medium" data-testid="badge-automated">
              <Zap className="h-2 w-2" />
            </span>
          )}
        </div>
        <Handle type="source" position={Position.Right} className="!bg-[#c8940a] !border-[#daa520] !w-2 !h-2" style={{ top: "50%" }} />
        <Handle type="source" position={Position.Bottom} id="bottom" className="!bg-[#c8940a] !border-[#daa520] !w-2 !h-2" />
        {isPainPoint && <Flag className="absolute -top-2 -right-2 h-3.5 w-3.5 text-red-500 fill-red-500 z-10" />}
      </div>
    );
  }

  const automatedBorder = isToBeView && isAutomated;

  return (
    <div
      className={`${baseClasses} rounded-lg border cursor-pointer`}
      style={{
        backgroundColor: automatedBorder ? "#0a2e1a" : confStyle.level === "low" ? "#1a1a1a" : "#242424",
        borderColor: automatedBorder ? "#22c55e" : confStyle.level === "low" ? "#444" : "#333",
        borderStyle: confStyle.borderStyle,
        borderLeftWidth: 3,
        borderLeftColor: automatedBorder ? "#22c55e" : confStyle.level === "low" ? "#888" : "#e8450a",
        opacity: confStyle.opacity,
        minWidth: 200,
        maxWidth: 240,
      }}
      data-testid={`node-${id}`}
    >
      <Handle type="target" position={Position.Left} className={automatedBorder ? "!bg-green-500 !border-green-400 !w-2 !h-2" : "!bg-[#e8450a] !border-[#ff5722] !w-2 !h-2"} />
      <div className="px-3 py-2.5">
        <div className="text-white text-xs font-medium leading-tight">{data.label}</div>
        {data.role && <div className="text-gray-400 text-[10px] mt-1">{data.role}</div>}
        {data.system && data.system !== "manual" && (
          <div className="text-gray-500 text-[9px] mt-0.5 italic">{data.system}</div>
        )}
        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
          <PerformerBadge performer={performer} />
          {isToBeView && isAutomated && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-500/20 border border-green-500/30 text-[8px] text-green-300 font-medium" data-testid="badge-automated">
              <Zap className="h-3 w-3" />
              Automated
            </span>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={automatedBorder ? "!bg-green-500 !border-green-400 !w-2 !h-2" : "!bg-[#e8450a] !border-[#ff5722] !w-2 !h-2"} />
      {isPainPoint && <Flag className="absolute -top-2 -right-2 h-3.5 w-3.5 text-red-500 fill-red-500" />}
    </div>
  );
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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: data?.viewType === "to-be" ? "#22c55e" : "#555",
          strokeWidth: 2,
          animation: data?.isNew ? "edgeDraw 0.4s ease-out" : undefined,
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#333] text-[10px] text-gray-300 cursor-pointer hover:border-[#e8450a] transition-colors"
            data-testid={`edge-label-${id}`}
          >
            {data.label}
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
    <div className="absolute right-0 top-0 bottom-0 w-64 bg-[#1a1a1a] border-l border-[#333] z-50 flex flex-col overflow-y-auto" data-testid="panel-node-edit">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#333]">
        <span className="text-xs font-semibold text-white">{isNew ? "Add Step" : "Edit Step"}</span>
        <button onClick={onCancel} className="text-gray-400 hover:text-white" data-testid="button-close-edit">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 p-3 space-y-3">
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Step Name</label>
          <input
            className="w-full bg-[#242424] border border-[#444] rounded px-2 py-1.5 text-xs text-white focus:border-[#e8450a] focus:outline-none"
            value={editData.name}
            onChange={(e) => onChange({ ...editData, name: e.target.value })}
            data-testid="input-node-name"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Role</label>
          <input
            className="w-full bg-[#242424] border border-[#444] rounded px-2 py-1.5 text-xs text-white focus:border-[#e8450a] focus:outline-none"
            value={editData.role}
            onChange={(e) => onChange({ ...editData, role: e.target.value })}
            data-testid="input-node-role"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">System</label>
          <input
            className="w-full bg-[#242424] border border-[#444] rounded px-2 py-1.5 text-xs text-white focus:border-[#e8450a] focus:outline-none"
            value={editData.system}
            onChange={(e) => onChange({ ...editData, system: e.target.value })}
            data-testid="input-node-system"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Type</label>
          <select
            className="w-full bg-[#242424] border border-[#444] rounded px-2 py-1.5 text-xs text-white focus:border-[#e8450a] focus:outline-none"
            value={editData.nodeType}
            onChange={(e) => onChange({ ...editData, nodeType: e.target.value as any })}
            data-testid="select-node-type"
          >
            <option value="task">Task</option>
            <option value="decision">Decision</option>
            <option value="start">Start</option>
            <option value="end">End</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-1">Description / Notes</label>
          <textarea
            className="w-full bg-[#242424] border border-[#444] rounded px-2 py-1.5 text-xs text-white focus:border-[#e8450a] focus:outline-none resize-none"
            rows={3}
            value={editData.description}
            onChange={(e) => onChange({ ...editData, description: e.target.value })}
            data-testid="input-node-description"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer" data-testid="toggle-pain-point">
          <input
            type="checkbox"
            checked={editData.isPainPoint}
            onChange={(e) => onChange({ ...editData, isPainPoint: e.target.checked })}
            className="rounded border-[#444] bg-[#242424] text-red-500 focus:ring-red-500"
          />
          <Flag className="h-3 w-3 text-red-400" />
          <span className="text-xs text-gray-300">Mark as pain point</span>
        </label>
      </div>
      <div className="p-3 border-t border-[#333] flex items-center gap-2">
        <Button size="sm" className="flex-1 text-xs h-7" onClick={onSave} data-testid="button-save-node">
          <Save className="h-3 w-3 mr-1" /> Save
        </Button>
        {!isNew && onDelete && (
          <Button size="sm" variant="ghost" className="text-xs h-7 text-red-400 hover:text-red-300" onClick={onDelete} data-testid="button-delete-node">
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-xs h-7" onClick={onCancel} data-testid="button-cancel-edit">
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
      className="absolute z-50 bg-[#1a1a1a] border border-[#333] rounded-lg p-2 shadow-xl"
      style={{ left: position.x, top: position.y }}
      data-testid="popup-edge-label"
    >
      <div className="flex items-center gap-2">
        <input
          className="bg-[#242424] border border-[#444] rounded px-2 py-1 text-xs text-white focus:border-[#e8450a] focus:outline-none w-32"
          placeholder="e.g. Yes / No"
          value={editData.label}
          onChange={(e) => onChange({ ...editData, label: e.target.value })}
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
          data-testid="input-edge-label"
        />
        <button onClick={onSave} className="text-green-400 hover:text-green-300" data-testid="button-save-edge-label">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={onCancel} className="text-gray-400 hover:text-white" data-testid="button-cancel-edge-label">
          <X className="h-3.5 w-3.5" />
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
      className="absolute z-50 bg-[#1a1a1a] border border-[#333] rounded-lg py-1 shadow-xl min-w-[140px]"
      style={{ left: position.x, top: position.y }}
      data-testid="context-menu"
    >
      <button
        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-[#242424] hover:text-white flex items-center gap-2 transition-colors"
        onClick={onAddStep}
        data-testid="button-add-step-context"
      >
        <Plus className="h-3 w-3" /> Add Step Here
      </button>
    </div>
  );
}

function ProcessMapFlow({ ideaId, activeView }: { ideaId: string; activeView: "as-is" | "to-be"; }) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editingNode, setEditingNode] = useState<NodeEditData | null>(null);
  const [editingEdge, setEditingEdge] = useState<EdgeEditData | null>(null);
  const [edgeEditPos, setEdgeEditPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const [isNewNode, setIsNewNode] = useState(false);
  const [newNodeFlowPos, setNewNodeFlowPos] = useState<{ x: number; y: number } | null>(null);
  const prevNodeCountRef = useRef(0);
  const { fitView } = useReactFlow();

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
    if (!mapData) return;
    const dbNodes = mapData.nodes;
    const dbEdges = mapData.edges;

    const newNodes: Node[] = dbNodes.map((n, i) => {
      const pos = n.positionX !== 0 || n.positionY !== 0
        ? { x: n.positionX, y: n.positionY }
        : getNodePosition(i, dbNodes.length);
      const isNew = i >= prevNodeCountRef.current;

      return {
        id: String(n.id),
        type: "processNode",
        position: pos,
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
        className: isNew ? "animate-node-in" : "",
      };
    });

    const newEdges: Edge[] = dbEdges.map((e) => ({
      id: String(e.id),
      source: String(e.sourceNodeId),
      target: String(e.targetNodeId),
      type: "custom",
      data: { label: e.label, dbId: e.id, viewType: activeView },
      animated: activeView === "to-be",
    }));

    setNodes(newNodes);
    setEdges(newEdges);
    prevNodeCountRef.current = dbNodes.length;

    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
  }, [mapData, setNodes, setEdges, fitView]);

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/process-nodes/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "process-map", activeView] });
    },
  });

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        createEdgeMutation.mutate({
          viewType: activeView,
          sourceNodeId: parseInt(connection.source),
          targetNodeId: parseInt(connection.target),
          label: "",
        });
      }
    },
    [createEdgeMutation, activeView]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
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
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    const d = edge.data as any;
    setEditingEdge({ edgeId: d.dbId, label: d.label || "" });
    setEdgeEditPos({ x: 200, y: 100 });
    setContextMenu(null);
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
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  function handleSaveNode() {
    if (!editingNode) return;
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
    }
    setEditingNode(null);
    setNewNodeFlowPos(null);
  }

  function handleDeleteNode() {
    if (!editingNode || isNewNode) return;
    deleteNodeMutation.mutate(editingNode.nodeId);
    setEditingNode(null);
  }

  function handleSaveEdgeLabel() {
    if (!editingEdge) return;
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

  const onNodeDragStop = useCallback((_: any, node: Node) => {
    const d = node.data as any;
    if (d.dbId) {
      updateNodeMutation.mutate({
        id: d.dbId,
        data: { positionX: node.position.x, positionY: node.position.y },
      });
    }
  }, [updateNodeMutation]);

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
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#333]">
            <Map className="h-7 w-7 text-gray-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400">
              {activeView === "as-is"
                ? "Process map will appear here"
                : "To-Be map will appear here"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {activeView === "as-is"
                ? "As you describe your process in the chat, the AI will visualize each step, decision point, and handoff in a clear flowchart."
                : "Once the As-Is process is mapped, the AI will generate an optimized To-Be workflow showing where automation removes manual steps."}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-primary/60 mt-1">
            <Sparkles className="h-3 w-3" />
            <span>Powered by AI process mining</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative" data-testid="process-map-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{ type: "custom" }}
        proOptions={{ hideAttribution: true }}
        className="bg-[#0d0d0d]"
      >
        <Background color="#222" gap={20} size={1} />
        <Controls
          showInteractive={false}
          className="!bg-[#1a1a1a] !border-[#333] !rounded-lg [&_button]:!bg-[#242424] [&_button]:!border-[#333] [&_button]:!text-gray-400 [&_button:hover]:!bg-[#333]"
        />
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          onAddStep={handleAddStepFromContext}
          onClose={() => setContextMenu(null)}
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
          onCancel={() => { setEditingNode(null); setNewNodeFlowPos(null); }}
          onDelete={isNewNode ? undefined : handleDeleteNode}
          isNew={isNewNode}
        />
      )}
    </div>
  );
}

export default function ProcessMapPanel({ ideaId, onStepsChange, onApproved, onCompletenessChange }: ProcessMapPanelProps) {
  const [activeView, setActiveView] = useState<"as-is" | "to-be">("as-is");

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

  return (
    <div className="flex flex-col h-full" data-testid="panel-process-map">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Map className="h-4 w-4 text-cb-teal" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {activeView === "as-is" ? "As-Is" : "To-Be"} Process Map
          </h3>
          {nodeCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-[#333] text-gray-400">
              {nodeCount} steps
            </Badge>
          )}
        </div>
        <div
          className="flex items-center rounded-full bg-secondary/60 border border-border p-0.5"
          data-testid="button-toggle-view"
        >
          <button
            onClick={() => setActiveView("as-is")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "as-is" ? "bg-cb-teal text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="button-view-as-is"
          >
            As-Is
          </button>
          <button
            onClick={() => setActiveView("to-be")}
            className={`px-3 py-1 rounded-full text-[11px] font-medium transition-all ${activeView === "to-be" ? "bg-cb-teal text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="button-view-to-be"
          >
            To-Be
          </button>
        </div>
      </div>

      {activeView === "to-be" && nodeCount > 0 && (
        <div className="px-4 py-2 border-b border-border" data-testid="automation-impact-bar">
          {(() => {
            const nodes = mapData?.nodes || [];
            const automatedCount = nodes.filter((n) => (n.description || "").startsWith("[AUTOMATED]")).length;
            const humanCount = nodes.filter((n) => {
              const p = classifyPerformer(n.role || "", n.system || "");
              return p === "human" && !(n.description || "").startsWith("[AUTOMATED]");
            }).length;
            const systemCount = nodes.filter((n) => classifyPerformer(n.role || "", n.system || "") === "system").length;
            const totalAutomatable = automatedCount + systemCount;
            const startEndCount = nodes.filter((n) => n.nodeType === "start" || n.nodeType === "end").length;
            const processSteps = nodes.length - startEndCount;
            const automationPct = processSteps > 0 ? Math.round(totalAutomatable / processSteps * 100) : 0;
            return (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3 text-green-400" />
                  <span className="text-[10px] font-semibold text-green-400">{automationPct}% automated</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5 text-green-400" /> {automatedCount} pain points resolved</span>
                  <span className="flex items-center gap-0.5"><Monitor className="h-2.5 w-2.5 text-purple-400" /> {systemCount} system-driven</span>
                  <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5 text-blue-400" /> {humanCount} human-in-loop</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {nodeCount > 0 && !approval && activeView === "as-is" && (
        <div className="px-4 py-2 border-b border-border" data-testid="map-completeness-bar">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground font-medium">Map Completeness</span>
            <span className={`text-[10px] font-semibold ${mapCompleteness >= 85 ? "text-green-400" : mapCompleteness >= 50 ? "text-cb-gold" : "text-muted-foreground"}`}>
              {mapCompleteness}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                mapCompleteness >= 85 ? "bg-green-500" : mapCompleteness >= 50 ? "bg-cb-gold" : "bg-muted-foreground/40"
              }`}
              style={{ width: `${mapCompleteness}%` }}
            />
          </div>
        </div>
      )}

      <ReactFlowProvider>
        <ProcessMapFlow ideaId={ideaId} activeView={activeView} />
      </ReactFlowProvider>

      {nodeCount >= 3 && !approval && (
        <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
          {!showApprovalConfirm ? (
            <Button
              size="sm"
              className="text-xs h-8 bg-cb-teal hover:bg-cb-teal/80"
              onClick={() => setShowApprovalConfirm(true)}
              data-testid="button-approve-map"
            >
              <Check className="h-3 w-3 mr-1" /> Approve {activeView === "as-is" ? "As-Is" : "To-Be"} Map
            </Button>
          ) : (
            <div className="flex-1 space-y-2">
              <p className="text-[11px] text-gray-300 leading-relaxed">
                By approving, you are formally signing off on this {activeView === "as-is" ? "As-Is" : "To-Be"} process map. This action is recorded with your name, role, and timestamp.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="text-xs h-7 bg-cb-teal hover:bg-cb-teal/80"
                  onClick={() => { approveMutation.mutate(); setShowApprovalConfirm(false); }}
                  disabled={approveMutation.isPending}
                  data-testid="button-confirm-approve"
                >
                  {approveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                  Confirm Approval
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7"
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

      {approval && (
        <div className="px-4 py-2.5 border-t border-border flex items-center gap-2" data-testid="approval-badge">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-500/10 border border-green-500/20">
            <Check className="h-3 w-3 text-green-500" />
            <span className="text-[11px] text-green-400 font-medium">{activeView === "as-is" ? "As-Is" : "To-Be"} Approved</span>
          </div>
          <span className="text-[10px] text-gray-500">
            {new Date(approval.approvedAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            {" by "}
            {approval.userName}
          </span>
        </div>
      )}
    </div>
  );
}
