import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useRoute, Link } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Check,
  Lock,
  Sparkles,
  Bot,
  File as FileIcon,
  X,
  Package,
  Pencil,
  FileText,
  ListChecks,
  Map,
  MessageSquare,
  ListPlus,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DeploymentReportCard } from "@/components/deployment-report-card";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { PIPELINE_STAGES, type Idea, type PipelineStage, type ChatMessage as DBChatMessage } from "@shared/schema";
import ProcessMapPanel from "@/components/process-map-panel";
import { parseStepsFromText, parseStepsByView } from "@/lib/step-parser";
import { DocumentCard, UiPathPackageCard } from "@/components/document-card";

let currentProcessView: "as-is" | "to-be" | "sdd" = "as-is";

function ThinkingIndicator() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getMessage = () => {
    if (elapsed >= 15) return "This is taking longer than usual, hang tight...";
    if (elapsed >= 5) return "Still working on this...";
    return "Thinking";
  };

  return (
    <div className="flex items-center gap-2.5" data-testid="thinking-indicator">
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1.2s" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1.2s" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1.2s" }} />
      </div>
      <span className="text-[11px] text-muted-foreground/70 font-medium">{getMessage()}</span>
    </div>
  );
}

function getStageBadgeClass(stage: string): string {
  const approvalStages = ["CoE Approval", "Governance / Security Scan"];
  const actionStages = ["Idea", "Feasibility Assessment"];
  if (approvalStages.includes(stage))
    return "bg-cb-gold/15 text-cb-gold border-cb-gold/25";
  if (actionStages.includes(stage))
    return "bg-primary/15 text-primary border-primary/25";
  return "bg-cb-teal/15 text-cb-teal border-cb-teal/25";
}

const STAGE_GUIDANCE: Record<string, { action: string; hint: string }> = {
  Idea: {
    action: "Describe Your Process",
    hint: "Tell the assistant about the manual process you want to automate. Include who does it, how often, and what systems are involved.",
  },
  "Feasibility Assessment": {
    action: "Review Feasibility",
    hint: "Your process is being assessed for automation potential. Review the complexity score, estimated effort, and ROI projection.",
  },
  "Validated Backlog": {
    action: "Prioritize & Plan",
    hint: "This idea has been validated. It's queued for design. Review priority ranking and target timeline.",
  },
  Design: {
    action: "Refine the Design",
    hint: "The As-Is process map is ready. Work with the assistant to design the To-Be automated workflow and identify exception paths.",
  },
  Build: {
    action: "Build in Progress",
    hint: "Development is underway. Track build progress, review test scenarios, and flag any process changes.",
  },
  Test: {
    action: "Validate & Test",
    hint: "Review test results, confirm edge cases are handled, and approve for governance review.",
  },
  "Governance / Security Scan": {
    action: "Governance Review",
    hint: "Security and compliance checks are running. Review findings and address any flagged items.",
  },
  "CoE Approval": {
    action: "Awaiting Approval",
    hint: "The CoE team is reviewing this automation. Respond to any questions or change requests.",
  },
  Deploy: {
    action: "Deploying",
    hint: "Deployment is in progress. Monitor rollout status and confirm production readiness.",
  },
  Maintenance: {
    action: "Monitor & Maintain",
    hint: "This automation is live. Track performance metrics, exception rates, and optimization opportunities.",
  },
};

function getCompletedStagesForIdea(idea: Idea) {
  const currentIndex = PIPELINE_STAGES.indexOf(idea.stage as PipelineStage);
  const completed: Record<string, string> = {};
  const createdDate = new Date(idea.createdAt);

  for (let i = 0; i < currentIndex; i++) {
    const stageDate = new Date(createdDate);
    stageDate.setDate(stageDate.getDate() + (i + 1) * 2);
    completed[PIPELINE_STAGES[i]] = stageDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return completed;
}

const STAGE_ARTIFACTS: Record<string, string[]> = {
  "Design": ["as-is-map"],
  "Build": ["as-is-map", "to-be-map", "pdd"],
  "Test": ["as-is-map", "to-be-map", "pdd", "sdd"],
  "Governance / Security Scan": ["as-is-map", "to-be-map", "pdd", "sdd"],
  "CoE Approval": ["as-is-map", "to-be-map", "pdd", "sdd"],
  "Deploy": ["as-is-map", "to-be-map", "pdd", "sdd"],
  "Maintenance": ["as-is-map", "to-be-map", "pdd", "sdd"],
};

const ARTIFACT_LABELS: Record<string, string> = {
  "as-is-map": "As-Is Map",
  "to-be-map": "To-Be Map",
  "pdd": "PDD",
  "sdd": "SDD",
};

function StageTracker({
  idea,
  onStageClick,
}: {
  idea: Idea;
  onStageClick: (stage: string) => void;
}) {
  const currentIndex = PIPELINE_STAGES.indexOf(idea.stage as PipelineStage);
  const completedStages = getCompletedStagesForIdea(idea);

  const { data: approvalSummary } = useQuery<Record<string, any>>({
    queryKey: ["/api/ideas", idea.id, "approval-summary"],
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${idea.id}/approval-summary`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    staleTime: 30000,
  });

  const getStageTooltip = (stage: string): ReactNode | null => {
    const artifacts = STAGE_ARTIFACTS[stage];
    if (!artifacts || !approvalSummary) return null;

    const items = artifacts.map(key => {
      const data = approvalSummary[key];
      if (!data) return { key, label: ARTIFACT_LABELS[key] || key, status: "pending" as const };
      return {
        key,
        label: ARTIFACT_LABELS[key] || key,
        status: data.invalidated ? "invalidated" as const : "approved" as const,
        version: data.version,
        userName: data.userName,
        approvedAt: data.approvedAt,
      };
    });

    if (items.every(i => i.status === "pending")) return null;

    return (
      <div className="space-y-1.5 text-left min-w-[180px]">
        <div className="text-[11px] font-semibold text-zinc-200 border-b border-zinc-700 pb-1 mb-1">{stage}</div>
        {items.map(item => (
          <div key={item.key} className="flex items-center justify-between gap-3">
            <span className="text-[10px] text-zinc-400">{item.label}</span>
            {item.status === "approved" ? (
              <div className="flex items-center gap-1">
                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  v{item.version || 1}
                </span>
                <span className="text-[9px] text-zinc-500">{item.userName}</span>
              </div>
            ) : item.status === "invalidated" ? (
              <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400">needs redo</span>
            ) : (
              <span className="text-[9px] text-zinc-600">pending</span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full" data-testid="panel-stage-tracker">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Progress
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4">
          <div className="relative">
            {PIPELINE_STAGES.map((stage, index) => {
              const isCompleted = index < currentIndex;
              const isCurrent = index === currentIndex;
              const isFuture = index > currentIndex;
              const tooltip = getStageTooltip(stage);

              const stageContent = (
                <div key={stage} className="relative flex items-start group" data-testid={`stage-step-${index}`}>
                  {index < PIPELINE_STAGES.length - 1 && (
                    <div
                      className={`absolute left-[11px] top-[24px] w-[2px] h-[calc(100%-8px)] ${
                        isCompleted
                          ? "bg-cb-teal/40"
                          : isCurrent
                            ? "bg-gradient-to-b from-primary/60 to-border/30"
                            : "bg-border/30"
                      }`}
                    />
                  )}

                  <div className="relative z-10 flex items-center justify-center w-6 h-6 shrink-0 mt-0.5">
                    {isCompleted && (
                      <button
                        onClick={() => onStageClick(stage)}
                        className="flex items-center justify-center w-5 h-5 rounded-full bg-cb-teal/20 border border-cb-teal/30 cursor-pointer hover:bg-cb-teal/30 transition-colors"
                        data-testid={`button-stage-${index}`}
                      >
                        <Check className="h-2.5 w-2.5 text-cb-teal" />
                      </button>
                    )}
                    {isCurrent && (
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 border-2 border-primary">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      </div>
                    )}
                    {isFuture && (
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted/30 border border-border/50">
                        <Lock className="h-2 w-2 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  <div className="ml-2.5 pb-5 min-w-0 flex-1">
                    <span
                      className={`text-xs leading-tight block ${
                        isCurrent
                          ? "text-primary font-semibold"
                          : isCompleted
                            ? "text-foreground/80 font-medium"
                            : "text-muted-foreground/50"
                      }`}
                    >
                      {stage}
                    </span>
                    {isCompleted && completedStages[stage] && (
                      <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                        {completedStages[stage]}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] text-primary/70 mt-0.5 block">
                        In progress
                      </span>
                    )}
                  </div>
                </div>
              );

              if (tooltip && (isCompleted || isCurrent)) {
                return (
                  <Tooltip key={stage}>
                    <TooltipTrigger asChild>{stageContent}</TooltipTrigger>
                    <TooltipContent side="right" className="p-2.5 bg-zinc-900 border-zinc-700 max-w-[260px]">
                      {tooltip}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return stageContent;
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  docType?: "PDD" | "SDD";
  docId?: number;
  uipathData?: any;
  deployReport?: any;
}

function stripStepTags(text: string): string {
  return text
    .replace(/\[STEP:\s*[^\]]*\]/g, "")
    .replace(/\[DOC:(PDD|SDD):\d+\]/g, "")
    .replace(/\[APPROVE:(PDD|SDD)\]/g, "")
    .replace(/\[DEPLOY_UIPATH\]/g, "")
    .replace(/\[DEPLOY_REPORT:[\s\S]*?\]/g, "")
    .replace(/\[STAGE_BACK:\s*[^\]]+\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMessageMeta(content: string): { docType?: "PDD" | "SDD"; docId?: number; uipathData?: any; deployReport?: any; displayContent: string } {
  const docMatch = content.match(/^\[DOC:(PDD|SDD):(\d+)\]/);
  if (docMatch) {
    return {
      docType: docMatch[1] as "PDD" | "SDD",
      docId: parseInt(docMatch[2]),
      displayContent: stripStepTags(content.slice(docMatch[0].length)),
    };
  }
  const uipathMatch = content.match(/^\[UIPATH:([\s\S]*)\]$/);
  if (uipathMatch) {
    try {
      return {
        uipathData: JSON.parse(uipathMatch[1]),
        displayContent: "",
      };
    } catch {
      return { displayContent: stripStepTags(content) };
    }
  }
  const deployReportMatch = content.match(/\[DEPLOY_REPORT:([\s\S]*)\]$/);
  if (deployReportMatch) {
    try {
      const report = JSON.parse(deployReportMatch[1]);
      const displayContent = content.slice(0, deployReportMatch.index).trim();
      return {
        deployReport: report,
        displayContent: stripStepTags(displayContent),
      };
    } catch {
      return { displayContent: stripStepTags(content.replace(/\[DEPLOY_REPORT:[\s\S]*\]$/, "").trim()) };
    }
  }
  return { displayContent: stripStepTags(content) };
}

function ChatPanel({ idea }: { idea: Idea }) {
  const { toast } = useToast();
  const [streamingMsg, setStreamingMsg] = useState<ChatMsg | null>(null);
  const [pendingUserMsg, setPendingUserMsg] = useState<ChatMsg | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [generatingDocType, setGeneratingDocType] = useState<string>("");
  const [messageQueue, setMessageQueue] = useState<Array<{ id: string; text: string }>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);

  useEffect(() => {
    initialScrollDoneRef.current = false;
  }, [idea.id]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamingMsgRef = useRef<string>("");
  const chatInitializedRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (chatInitializedRef.current) return;
    chatInitializedRef.current = true;
    fetch(`/api/ideas/${idea.id}/init-chat`, {
      method: "POST",
      credentials: "include",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
    }).catch(() => {});
  }, [idea.id]);

  const cancelDocGeneration = useCallback(() => {
    setIsGeneratingDoc(false);
    setGeneratingDocType("");
  }, []);

  const pddTriggeredRef = useRef(false);
  const sddTriggeredRef = useRef(false);
  const generateDocRef = useRef<((type: "PDD" | "SDD") => void) | null>(null);

  const guidance = STAGE_GUIDANCE[idea.stage];

  const { data: savedMessages, isLoading: loadingHistory } = useQuery<DBChatMessage[]>({
    queryKey: ["/api/ideas", idea.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/ideas/${idea.id}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!idea.id,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const displayMessages: ChatMsg[] = (() => {
    if (savedMessages && savedMessages.length > 0) {
      const loaded: ChatMsg[] = savedMessages
        .filter((m) => m.role !== "system")
        .map((m) => {
        const meta = parseMessageMeta(m.content);
        return {
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: meta.displayContent,
          timestamp: new Date(m.createdAt),
          docType: meta.docType,
          docId: meta.docId,
          uipathData: meta.uipathData,
          deployReport: meta.deployReport,
        };
      });
      const result = [...loaded];
      if (pendingUserMsg) result.push(pendingUserMsg);
      if (streamingMsg) result.push(streamingMsg);
      return result;
    }
    if (!loadingHistory) {
      const result: ChatMsg[] = [];
      if (pendingUserMsg) result.push(pendingUserMsg);
      if (streamingMsg) result.push(streamingMsg);
      return result;
    }
    return [];
  })();

  useEffect(() => {
    if (displayMessages.length === 0) return;
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [displayMessages]);

  useEffect(() => {
    if (!savedMessages || savedMessages.length === 0) return;
    const hasMapApproval = savedMessages.some(
      (m) => m.role === "assistant" && m.content.includes("As-Is process map approved")
    );
    const hasPdd = savedMessages.some(
      (m) => m.content.startsWith("[DOC:PDD:")
    );
    if (hasMapApproval && !hasPdd && !pddTriggeredRef.current && !isGeneratingDoc) {
      pddTriggeredRef.current = true;
      generateDocRef.current?.("PDD");
      return;
    }

    const hasPddApproval = savedMessages.some(
      (m) => m.role === "assistant" && m.content.includes("PDD approved")
    );
    const hasSdd = savedMessages.some(
      (m) => m.content.startsWith("[DOC:SDD:")
    );
    if (hasPddApproval && !hasSdd && !sddTriggeredRef.current && !isGeneratingDoc) {
      sddTriggeredRef.current = true;
      generateDocRef.current?.("SDD");
    }
  }, [savedMessages, isGeneratingDoc]);

  useEffect(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!savedMessages || savedMessages.length === 0 || isStreaming || isGeneratingDoc) return;

    const lastMsg = savedMessages[savedMessages.length - 1];
    if (lastMsg.role === "assistant" && lastMsg.content.endsWith("?")) {
      idleTimerRef.current = setTimeout(async () => {
        try {
          await fetch(`/api/ideas/${idea.id}/nudge`, {
            method: "POST",
            credentials: "include",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
        } catch {}
      }, 60000);
    }

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [savedMessages, isStreaming, isGeneratingDoc, idea.id]);

  const sendMessageDirect = useCallback(async (text: string) => {
    const userMsg: ChatMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setPendingUserMsg(userMsg);
    setIsStreaming(true);

    const streamMsg: ChatMsg = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };
    setStreamingMsg(streamMsg);
    streamingMsgRef.current = "";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ideaId: idea.id, content: text }),
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No stream reader");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                streamingMsgRef.current += data.token;
                setStreamingMsg((prev) =>
                  prev ? { ...prev, content: prev.content + data.token } : prev
                );
              }
              if (data.done) {
                setStreamingMsg((prev) =>
                  prev ? { ...prev, isStreaming: false } : prev
                );
              }
              if (data.deployStatus) {
                if (data.deployComplete) {
                  if (data.deployReport) {
                    setStreamingMsg((prev) => prev ? {
                      ...prev,
                      content: prev.content || data.deployStatus || "Deployment complete.",
                      isStreaming: false,
                      deployReport: data.deployReport,
                    } : {
                      id: `deploy-done-${Date.now()}`,
                      role: "assistant",
                      content: data.deployStatus || "Deployment complete.",
                      timestamp: new Date(),
                      isStreaming: false,
                      deployReport: data.deployReport,
                    });
                    setTimeout(() => {
                      setStreamingMsg(null);
                      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
                    }, 500);
                  } else {
                    setStreamingMsg(null);
                    queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
                  }
                } else {
                  setStreamingMsg({
                    id: `deploy-${Date.now()}`,
                    role: "assistant",
                    content: data.deployStatus,
                    timestamp: new Date(),
                    isStreaming: true,
                  });
                }
              }
              if (data.transition) {
                queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id] });
                queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
                const { fromStage, toStage, reason } = data.transition;
                toast({
                  title: fromStage && toStage && PIPELINE_STAGES.indexOf(fromStage) > PIPELINE_STAGES.indexOf(toStage)
                    ? `Stage Moved Back: ${toStage}`
                    : `Stage Advanced: ${toStage}`,
                  description: reason || `Moved from ${fromStage}`,
                });
              }
              if (data.error) {
                streamingMsgRef.current = "";
                setStreamingMsg(null);
                toast({
                  title: "Message failed",
                  description: "Something went wrong. Please try sending your message again.",
                  variant: "destructive",
                });
              }
            } catch {}
          }
        }
      }
    } catch {
      streamingMsgRef.current = "";
      setStreamingMsg(null);
      toast({
        title: "Connection error",
        description: "Couldn't reach the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsStreaming(false);
      setIsGeneratingDoc(false);
      setGeneratingDocType("");
      setPendingUserMsg(null);
      const finalContent = streamingMsgRef.current;
      setStreamingMsg(null);
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });

      if (finalContent) {
        const viewStepSets = parseStepsByView(finalContent);

        for (const { viewType, steps } of viewStepSets) {
          if (steps.length === 0) continue;

          const hasStartNode = steps.some(s => s.nodeType === "start");
          const hasEndNode = steps.some(s => s.nodeType === "end");
          const isFullRegeneration = hasStartNode && hasEndNode && steps.length >= 5;

          const existingMap = await fetch(`/api/ideas/${idea.id}/process-map?view=${viewType}`, { credentials: "include" })
            .then((r) => r.json());
          const existingNodes: any[] = existingMap.nodes || [];

          const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
          const stripPrefixes = (s: string) =>
            s.replace(/^(record|send|initiate|close|auto[-\s]?|re[-\s]?check)\s+/i, "")
             .replace(/\s+(in erp|in app|notification|end|start)$/i, "")
             .replace(/[?\-]/g, " ")
             .replace(/\s+/g, " ")
             .trim();
          const tokenize = (s: string) => new Set(stripPrefixes(normalizeName(s)).split(" ").filter(w => w.length > 2));

          const similarity = (a: string, b: string): number => {
            const na = normalizeName(a);
            const nb = normalizeName(b);
            if (na === nb) return 1;
            const shorter = na.length < nb.length ? na : nb;
            const longer = na.length < nb.length ? nb : na;
            if (shorter.length >= 6 && longer.includes(shorter)) return 0.85;
            const tokA = tokenize(a);
            const tokB = tokenize(b);
            if (tokA.size === 0 || tokB.size === 0) return 0;
            let shared = 0;
            tokA.forEach(t => { if (tokB.has(t)) shared++; });
            const minTokens = Math.min(tokA.size, tokB.size);
            if (minTokens < 2) return shared >= 1 ? 0.5 : 0;
            return shared / Math.max(tokA.size, tokB.size);
          };

          const seenStepNames = new Set<string>();
          const dedupedSteps = steps.filter(step => {
            const norm = normalizeName(step.name);
            if (seenStepNames.has(norm)) return false;

            let isDuplicate = false;
            seenStepNames.forEach(existing => {
              if (similarity(step.name, existing) >= 0.85) isDuplicate = true;
            });
            if (isDuplicate) return false;

            seenStepNames.add(norm);
            return true;
          });

          const dedupedHasStart = dedupedSteps.some(s => s.nodeType === "start");
          const dedupedHasEnd = dedupedSteps.some(s => s.nodeType === "end");
          const safeToRegenerate = isFullRegeneration && dedupedHasStart && dedupedHasEnd && dedupedSteps.length >= 3;

          if (safeToRegenerate && existingNodes.length > 0) {
            console.log(`[ProcessMap] Full regeneration detected (${dedupedSteps.length} deduped steps with start+end). Clearing existing ${existingNodes.length} nodes for view=${viewType}`);
            await fetch(`/api/ideas/${idea.id}/process-map/clear?view=${viewType}`, {
              method: "DELETE",
              credentials: "include",
            });
          }

          const remainingNodes = safeToRegenerate ? [] : existingNodes;

          const nameToId: Record<string, number> = {};
          for (const n of remainingNodes) {
            nameToId[normalizeName(n.name)] = n.id;
          }

          const findMatch = (stepName: string, stepType: string): number | null => {
            if (safeToRegenerate) return null;
            const norm = normalizeName(stepName);
            if (nameToId[norm]) return nameToId[norm];
            let bestScore = 0;
            let bestId: number | null = null;
            for (const n of remainingNodes) {
              if (n.nodeType !== stepType) continue;
              const score = similarity(stepName, n.name);
              if (score > bestScore && score >= 0.8) {
                bestScore = score;
                bestId = n.id;
              }
            }
            return bestId;
          };

          const createdNodes: { name: string; id: number; from?: string; edgeLabel?: string }[] = [];

          for (let i = 0; i < dedupedSteps.length; i++) {
            const step = dedupedSteps[i];
            const existingId = findMatch(step.name, step.nodeType);

            if (existingId) {
              await fetch(`/api/process-nodes/${existingId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  name: step.name,
                  role: step.role,
                  system: step.system,
                  nodeType: step.nodeType,
                }),
              });
              createdNodes.push({
                name: step.name,
                id: existingId,
                from: step.from,
                edgeLabel: step.edgeLabel,
              });
            } else {
              const res = await fetch(`/api/ideas/${idea.id}/process-nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  viewType,
                  name: step.name,
                  role: step.role,
                  system: step.system,
                  nodeType: step.nodeType,
                  orderIndex: i,
                }),
              });
              const created = await res.json();
              createdNodes.push({
                name: step.name,
                id: created.id,
                from: step.from,
                edgeLabel: step.edgeLabel,
              });
              nameToId[normalizeName(step.name)] = created.id;
            }
          }

          const seenEdgePairs = new Set<string>();

          const resolveFrom = (fromName: string): number | null => {
            const normalized = normalizeName(fromName);
            if (nameToId[normalized]) return nameToId[normalized];
            let bestScore = 0;
            let bestId: number | null = null;
            for (const [key, id] of Object.entries(nameToId)) {
              const score = similarity(fromName, key);
              if (score > bestScore && score >= 0.7) {
                bestScore = score;
                bestId = id;
              }
            }
            if (bestId) return bestId;
            const keys = Object.keys(nameToId);
            const partial = keys.find(k => k.includes(normalized) || normalized.includes(k));
            if (partial) return nameToId[partial];
            return null;
          };

          for (let i = 0; i < createdNodes.length; i++) {
            const node = createdNodes[i];
            let sourceId: number | null = null;
            let label = node.edgeLabel || "";

            if (node.from) {
              sourceId = resolveFrom(node.from);
              if (!sourceId) {
                console.warn(`[ProcessMap] FROM "${node.from}" not found for step "${node.name}", skipping edge`);
                continue;
              }
            } else {
              if (i > 0) {
                sourceId = createdNodes[i - 1].id;
              }
            }

            if (sourceId) {
              const edgePairKey = `${sourceId}->${node.id}`;
              if (seenEdgePairs.has(edgePairKey)) continue;
              seenEdgePairs.add(edgePairKey);

              await fetch(`/api/ideas/${idea.id}/process-edges`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                  viewType,
                  sourceNodeId: sourceId,
                  targetNodeId: node.id,
                  label,
                }),
              });
            }
          }

          queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "process-map", viewType] });
        }
      }
    }
  }, [idea.id]);

  const generateDocument = useCallback((type: "PDD" | "SDD") => {
    if (isGeneratingDoc || isStreaming) return;
    setIsGeneratingDoc(true);
    setGeneratingDocType(type);
    const prompt = type === "PDD"
      ? "Generate the Process Design Document (PDD) now. Start your response with [DOC:PDD:0] followed by the full document. Include all sections: 1) Executive Summary, 2) Process Scope, 3) As-Is Process Description, 4) To-Be Process Description, 5) Pain Points and Inefficiencies, 6) Automation Opportunity Assessment, 7) Assumptions and Exceptions, 8) Data and System Requirements. Write as a professional document using ## headings."
      : "Generate the Solution Design Document (SDD) now. Start your response with [DOC:SDD:0] followed by the full document. Include the orchestrator_artifacts JSON block in Section 9 with all artifact definitions (queues, assets, machines, triggers, storageBuckets, environments, actionCenter, testCases). Write as a professional technical specification using ## headings.";
    sendMessageDirect(prompt);
  }, [isGeneratingDoc, isStreaming, sendMessageDirect]);

  generateDocRef.current = generateDocument;

  const generateUiPath = useCallback(async () => {
    if (isGeneratingDoc || isStreaming) return;
    setIsGeneratingDoc(true);
    setGeneratingDocType("UiPath");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`/api/ideas/${idea.id}/generate-uipath`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Failed to generate UiPath package:", err);
        toast({
          title: "Package generation failed",
          description: err.message || "Could not generate UiPath package. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "UiPath Package Ready",
          description: "Package generated successfully. You can now deploy to UiPath.",
        });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast({
          title: "Timed out",
          description: "Package generation took too long. Please try again.",
          variant: "destructive",
        });
      } else {
        console.error("Error generating UiPath package:", err);
        toast({
          title: "Error",
          description: "Could not generate UiPath package. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsGeneratingDoc(false);
      setGeneratingDocType("");
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
    }
  }, [idea.id, isGeneratingDoc, isStreaming]);

  const handleDocApproved = useCallback(async (docType: "PDD" | "SDD") => {
    queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
    if (docType === "PDD" && !sddTriggeredRef.current) {
      sddTriggeredRef.current = true;
      setTimeout(() => generateDocRef.current?.("SDD"), 500);
    }
  }, [idea.id]);

  const removeFromQueue = useCallback((queueId: string) => {
    setMessageQueue(prev => prev.filter(m => m.id !== queueId));
  }, []);

  useEffect(() => {
    if (!isStreaming && !isGeneratingDoc && messageQueue.length > 0) {
      const [next, ...rest] = messageQueue;
      setMessageQueue(rest);
      sendMessageDirect(next.text);
    }
  }, [isStreaming, isGeneratingDoc, messageQueue, sendMessageDirect]);

  const [isUploading, setIsUploading] = useState(false);

  const handleSend = useCallback(async () => {
    let text = inputValue.trim();
    if (!text && !attachedFile) return;

    if (attachedFile) {
      const extractableTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/plain",
        "text/csv",
      ];

      if (extractableTypes.includes(attachedFile.type)) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append("files", attachedFile);
          const uploadRes = await fetch("/api/upload", { method: "POST", body: formData, credentials: "include" });
          if (uploadRes.ok) {
            const data = await uploadRes.json();
            if (data.files?.[0]?.text) {
              const extracted = data.files[0];
              const contextNote = `[UPLOADED_FILE: ${attachedFile.name} (${extracted.type})]\n\nExtracted content from "${attachedFile.name}":\n---\n${extracted.text}\n---\n\nUse this document content to help drive the automation pipeline. Analyze it for process steps, business rules, and requirements. If appropriate, suggest creating a process map or generating PDD/SDD documents based on this content.`;
              text = text ? `${text}\n\n${contextNote}` : contextNote;
            } else {
              text = text ? `${text}\n\n(User uploaded "${attachedFile.name}" but content extraction returned empty.)` : `(User uploaded "${attachedFile.name}" but content extraction returned empty.)`;
            }
          } else {
            text = text ? `${text}\n\n(User uploaded "${attachedFile.name}" but server-side extraction failed.)` : `(User uploaded "${attachedFile.name}" but server-side extraction failed.)`;
          }
        } catch (err) {
          console.error("File upload error:", err);
          text = text ? `${text}\n\n(User uploaded "${attachedFile.name}" but extraction encountered an error.)` : `(User uploaded "${attachedFile.name}" but extraction encountered an error.)`;
        } finally {
          setIsUploading(false);
        }
      } else {
        const fileNote = `[UPLOADED_FILE: ${attachedFile.name} (${attachedFile.type})]\n\n(User uploaded a media file: "${attachedFile.name}". This file type cannot be parsed as text. Please ask the user to describe the process or steps shown in this file so you can create a process map and documentation.)`;
        text = text ? `${text}\n\n${fileNote}` : fileNote;
      }
    }

    setInputValue("");
    clearAttachedFile();

    if (isStreaming || isGeneratingDoc) {
      setMessageQueue(prev => [...prev, { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text }]);
      return;
    }

    sendMessageDirect(text);
  }, [inputValue, attachedFile, isStreaming, isGeneratingDoc, sendMessageDirect, clearAttachedFile]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function attachFile(file: File) {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      setFilePreviewUrl(URL.createObjectURL(file));
    } else {
      setFilePreviewUrl(null);
    }
  }

  function clearAttachedFile() {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    setAttachedFile(null);
    setFilePreviewUrl(null);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      attachFile(file);
    }
    e.target.value = "";
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          const named = new File([file], `screenshot-${Date.now()}.png`, { type: file.type });
          attachFile(named);
        }
        return;
      }
    }
  }

  if (loadingHistory) {
    return (
      <div className="flex flex-col h-full items-center justify-center" data-testid="panel-chat">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Loading conversation...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="panel-chat">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="h-4 w-4 text-cb-teal shrink-0" />
          <h3
            className="text-sm font-semibold text-foreground truncate"
            data-testid="text-chat-title"
          >
            {idea.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${getStageBadgeClass(idea.stage)}`}
          >
            {idea.stage}
          </Badge>
          {guidance && (
            <span className="text-[10px] text-muted-foreground truncate">
              {guidance.action}
            </span>
          )}
        </div>
      </div>

      {guidance && (
        <div className="mx-3 mt-3 p-3 rounded-md bg-primary/5 border border-primary/10">
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-[11px] font-medium text-primary">
                {guidance.action}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                {guidance.hint}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-3 space-y-3" data-testid="chat-messages">
        {displayMessages.map((msg) => {
          if (msg.docType && msg.docId) {
            const latestDocOfType = [...displayMessages]
              .filter((m) => m.docType === msg.docType)
              .pop();
            const isLatest = latestDocOfType?.id === msg.id;
            return (
              <div key={msg.id} className="flex justify-start" data-testid={`chat-message-${msg.id}`}>
                <div className="max-w-[95%] w-full">
                  <DocumentCard
                    docType={msg.docType}
                    docId={msg.docId}
                    content={msg.content}
                    ideaId={idea.id}
                    isApproved={!isLatest}
                    onApproved={() => handleDocApproved(msg.docType!)}
                  />
                </div>
              </div>
            );
          }

          if (msg.uipathData) {
            return (
              <div key={msg.id} className="flex justify-start" data-testid={`chat-message-${msg.id}`}>
                <div className="max-w-[95%] w-full">
                  <UiPathPackageCard packageData={msg.uipathData} ideaId={idea.id} />
                </div>
              </div>
            );
          }

          if (msg.deployReport && msg.deployReport.results?.length > 0) {
            return (
              <div key={msg.id} className="flex justify-start" data-testid={`chat-message-${msg.id}`}>
                <div className="max-w-[95%] w-full space-y-2">
                  {msg.content && (
                    <div className="rounded-lg px-3 py-2.5 bg-card border border-card-border rounded-bl-sm">
                      <div className="text-xs leading-relaxed prose-chat overflow-hidden break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {stripStepTags(msg.content)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                  <DeploymentReportCard report={msg.deployReport} onDismiss={undefined} />
                  {!msg.isStreaming && (
                    <span className="text-[9px] text-muted-foreground/60 block">
                      {msg.timestamp.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              data-testid={`chat-message-${msg.id}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2.5 overflow-hidden ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-card-border rounded-bl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="text-xs leading-relaxed prose-chat overflow-hidden break-words">
                    {msg.isStreaming && !msg.content ? (
                      <ThinkingIndicator />
                    ) : (
                      <>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {stripStepTags(msg.content)}
                        </ReactMarkdown>
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse rounded-sm" />
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-primary ml-0.5 animate-pulse rounded-sm" />
                    )}
                  </p>
                )}
                {!msg.isStreaming && (
                  <span
                    className={`text-[9px] mt-1.5 block ${
                      msg.role === "user"
                        ? "text-primary-foreground/60"
                        : "text-muted-foreground/60"
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {isGeneratingDoc && (
          <div className="flex justify-start" data-testid="doc-generation-loading">
            <div className="max-w-[85%] rounded-lg px-3 py-2.5 bg-card border border-card-border rounded-bl-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-cb-teal" />
                <p className="text-xs text-muted-foreground">
                  Generating {generatingDocType}...{" "}
                  {generatingDocType === "UiPath" ? "Building package structure (~30–60s)." :
                   generatingDocType === "SDD" ? "Writing technical spec (~30–60s)." :
                   generatingDocType === "PDD" ? "Writing process document (~30–60s)." :
                   "This may take a moment."}
                </p>
                <button
                  onClick={cancelDocGeneration}
                  className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                  data-testid="button-cancel-doc-gen"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {(() => {
          const hasSdd = displayMessages.some((m) => m.docType === "SDD");
          const hasPddApprovalMsg = displayMessages.some(
            (m) => m.content.includes("PDD approved") && m.role === "assistant"
          );
          if (hasPddApprovalMsg && !hasSdd && !isGeneratingDoc) {
            return (
              <div className="flex justify-center py-2" data-testid="sdd-generate-section">
                <Button
                  className="bg-cb-teal hover:bg-cb-teal/90 text-white text-xs"
                  onClick={() => {
                    sddTriggeredRef.current = true;
                    generateDocument("SDD");
                  }}
                  data-testid="button-generate-sdd"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Generate SDD
                </Button>
              </div>
            );
          }
          return null;
        })()}

        {(() => {
          const hasUiPath = displayMessages.some((m) => m.uipathData);
          const hasSddApproval = displayMessages.some(
            (m) => m.content.includes("SDD approved") && m.role === "assistant"
          );
          if (hasSddApproval && !hasUiPath && !isGeneratingDoc) {
            return (
              <div className="flex justify-center py-2" data-testid="uipath-generate-section">
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs"
                  onClick={generateUiPath}
                  data-testid="button-generate-uipath"
                >
                  <Package className="h-3.5 w-3.5 mr-1.5" />
                  Generate UiPath Package
                </Button>
              </div>
            );
          }
          return null;
        })()}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-border">
        {messageQueue.length > 0 && (
          <div className="mb-2 space-y-1" data-testid="message-queue">
            <div className="flex items-center gap-1.5 mb-1">
              <ListPlus className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground font-medium">
                {messageQueue.length} queued message{messageQueue.length > 1 ? "s" : ""}
              </span>
            </div>
            {messageQueue.map((qMsg) => (
              <div key={qMsg.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/30 border border-border/40" data-testid={`queued-message-${qMsg.id}`}>
                <span className="text-[10px] text-foreground/70 truncate flex-1">{qMsg.text}</span>
                <button
                  onClick={() => removeFromQueue(qMsg.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  data-testid={`button-remove-queued-${qMsg.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {attachedFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs" data-testid="chip-attached-file">
            {filePreviewUrl ? (
              <img src={filePreviewUrl} alt="Preview" className="h-10 w-10 rounded object-cover shrink-0 border border-border" />
            ) : (
              <FileIcon className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className="truncate text-foreground/80">{attachedFile.name}</span>
            <button
              onClick={clearAttachedFile}
              className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
              data-testid="button-remove-file"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className={`flex items-end gap-2 rounded-lg bg-card border p-2 transition-all duration-500 ${
          !isStreaming && displayMessages.length > 0 && displayMessages[displayMessages.length - 1]?.role === "assistant" && displayMessages[displayMessages.length - 1]?.content.endsWith("?")
            ? "border-primary/40 ring-1 ring-primary/20 animate-pulse"
            : "border-card-border"
        }`}>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.docx,.xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp4,.webm,.mov"
            data-testid="input-file-upload"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            data-testid="button-attach-file"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isGeneratingDoc ? `Generating ${generatingDocType}... Type to queue your next message` : isStreaming ? "Type to queue your next message..." : "Describe your process..."}
            className="min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 text-xs placeholder:text-muted-foreground/50"
            rows={1}
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            className="shrink-0"
            onClick={handleSend}
            disabled={isUploading || (!inputValue.trim() && !attachedFile)}
            data-testid="button-send-message"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isStreaming ? (
              <ListPlus className="h-3.5 w-3.5" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}


function ExportDialog({ ideaId, ideaTitle }: { ideaId: string; ideaTitle: string }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({
    "as-is": true,
    "to-be": true,
    pdd: true,
    sdd: true,
  });
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggle = (key: string) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  const selectedTypes = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const allSelected = selectedTypes.length === 4;
  const noneSelected = selectedTypes.length === 0;

  async function doExport() {
    if (noneSelected) return;
    setExporting(true);
    setOpen(false);
    try {
      const query = `?types=${selectedTypes.join(",")}`;
      const resp = await fetch(`/api/ideas/${ideaId}/export${query}`, { credentials: "include" });
      if (!resp.ok) throw new Error("Export failed");
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ideaTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_export.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Word document downloaded" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
    setExporting(false);
  }

  const items = [
    { key: "as-is", label: "As-Is Process Map" },
    { key: "to-be", label: "To-Be Process Map" },
    { key: "pdd", label: "Process Design Document (PDD)" },
    { key: "sdd", label: "Solution Design Document (SDD)" },
  ];

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setOpen(!open)}
        disabled={exporting}
        data-testid="button-export-documents"
      >
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl py-2 w-[260px]" data-testid="export-dialog">
          <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Export to Word</span>
            <button
              className="text-[10px] text-primary hover:underline font-normal normal-case tracking-normal"
              onClick={() => {
                const newVal = !allSelected;
                setSelected({ "as-is": newVal, "to-be": newVal, pdd: newVal, sdd: newVal });
              }}
              data-testid="button-toggle-all-export"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>
          <div className="px-1 py-1 space-y-0.5">
            {items.map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                data-testid={`export-check-${item.key}`}
              >
                <input
                  type="checkbox"
                  checked={!!selected[item.key]}
                  onChange={() => toggle(item.key)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-xs text-foreground">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="px-3 pt-2 pb-1 border-t border-border/50 mt-1">
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={doExport}
              disabled={noneSelected || exporting}
              data-testid="button-download-export"
            >
              {exporting ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="mr-1.5 h-3 w-3" />
                  Download .docx
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

type MobileTab = "stages" | "map" | "chat";

export default function Workspace() {
  const [, params] = useRoute("/workspace/:id");
  const ideaId = params?.id;
  const [selectedCompletedStage, setSelectedCompletedStage] = useState<
    string | null
  >(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");

  const { data: idea, isLoading } = useQuery<Idea>({
    queryKey: ["/api/ideas", ideaId],
    enabled: !!ideaId,
  });

  useEffect(() => {
    if (idea && !isEditingTitle) {
      setEditTitle(idea.title);
    }
  }, [idea?.title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Idea not found.</p>
      </div>
    );
  }

  const currentIndex = PIPELINE_STAGES.indexOf(idea.stage as PipelineStage);
  const completedStages = getCompletedStagesForIdea(idea);

  async function handleTitleSave() {
    const trimmed = editTitle.trim();
    if (!trimmed || trimmed === idea!.title) {
      setEditTitle(idea!.title);
      setIsEditingTitle(false);
      return;
    }
    try {
      await apiRequest("PATCH", `/api/ideas/${idea!.id}`, { title: trimmed });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea!.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/ideas"] });
      toast({ title: "Idea renamed", description: `Title updated to "${trimmed}"` });
    } catch {
      setEditTitle(idea!.title);
      toast({ title: "Failed to rename", variant: "destructive" });
    }
    setIsEditingTitle(false);
  }

  function handleStageClick(stage: string) {
    setSelectedCompletedStage((prev) => (prev === stage ? null : stage));
  }

  const stagePanel = (
    <div className="relative h-full">
      <StageTracker idea={idea} onStageClick={handleStageClick} />
      {selectedCompletedStage && (
        <div className="absolute inset-0 bg-card z-20 flex flex-col" data-testid="drawer-stage-summary">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h4 className="text-xs font-semibold text-foreground">
              {selectedCompletedStage}
            </h4>
            <button
              onClick={() => setSelectedCompletedStage(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-close-drawer"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-3 w-3 text-cb-teal" />
              <span className="text-xs text-muted-foreground">
                Completed {completedStages[selectedCompletedStage]}
              </span>
            </div>
            <div className="p-3 rounded-md bg-muted/20 border border-border/40">
              <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                Stage summary and artifacts will appear here
                once the AI assistant is connected.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const mapPanel = (
    <ProcessMapPanel
      ideaId={idea.id}
      onApproved={() => {
        queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
      }}
      onCompletenessChange={(pct) => {
        if (pct >= 85) {
          queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "process-map"] });
        }
      }}
      onViewChange={(view) => { currentProcessView = view; }}
    />
  );

  const chatPanel = <ChatPanel idea={idea} />;

  const mobileTabs = [
    { id: "stages" as MobileTab, label: "Stages", icon: ListChecks },
    { id: "map" as MobileTab, label: "Map", icon: Map },
    { id: "chat" as MobileTab, label: "Chat", icon: MessageSquare },
  ];

  return (
    <div className="flex flex-col h-full" data-testid="page-workspace">
      <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border bg-card/30">
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 sm:h-9 sm:w-9"
              data-testid="button-back-pipeline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleSave();
                    if (e.key === "Escape") { setEditTitle(idea.title); setIsEditingTitle(false); }
                  }}
                  className="text-xs sm:text-sm font-semibold text-foreground bg-transparent border-b border-primary outline-none px-0 py-0.5 min-w-[100px] max-w-[200px] sm:max-w-[300px]"
                  data-testid="input-edit-title"
                />
              ) : (
                <button
                  onClick={() => { setEditTitle(idea.title); setIsEditingTitle(true); }}
                  className="flex items-center gap-1.5 group cursor-pointer min-w-0"
                  data-testid="button-edit-title"
                >
                  <h1
                    className="text-xs sm:text-sm font-semibold text-foreground truncate"
                    data-testid="text-idea-title"
                  >
                    {idea.title}
                  </h1>
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] ${getStageBadgeClass(idea.stage)} hidden sm:inline-flex`}
                data-testid="badge-idea-stage"
              >
                {idea.stage}
              </Badge>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
            <span>{idea.owner}</span>
            {idea.tag && (
              <>
                <span className="text-border">|</span>
                <span>{idea.tag}</span>
              </>
            )}
          </div>
          <ExportDialog ideaId={idea.id} ideaTitle={idea.title} />
        </div>
      </div>

      {isMobile ? (
        <>
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobileTab === "stages" && stagePanel}
            {mobileTab === "map" && <div className="h-full">{mapPanel}</div>}
            {mobileTab === "chat" && chatPanel}
          </div>
          <div className="flex items-center border-t border-border bg-card shrink-0" data-testid="mobile-tab-bar">
            {mobileTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMobileTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors ${
                  mobileTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full"
            data-testid="workspace-panels"
          >
            <ResizablePanel
              defaultSize={15}
              minSize={12}
              maxSize={25}
              className="bg-card/20"
            >
              {stagePanel}
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={50} minSize={30}>
              {mapPanel}
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              defaultSize={35}
              minSize={25}
              maxSize={50}
            >
              {chatPanel}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      )}
    </div>
  );
}
