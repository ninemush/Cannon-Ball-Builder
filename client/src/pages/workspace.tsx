import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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

function StageTracker({
  idea,
  onStageClick,
}: {
  idea: Idea;
  onStageClick: (stage: string) => void;
}) {
  const currentIndex = PIPELINE_STAGES.indexOf(idea.stage as PipelineStage);
  const completedStages = getCompletedStagesForIdea(idea);

  return (
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

            return (
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
          })}
        </div>
      </div>
    </div>
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
}

function stripStepTags(text: string): string {
  return text
    .replace(/\[STEP:\s*[^\]]*\]/g, "")
    .replace(/\[DOC:(PDD|SDD):\d+\]/g, "")
    .replace(/\[APPROVE:(PDD|SDD)\]/g, "")
    .replace(/\[DEPLOY_UIPATH\]/g, "")
    .replace(/\[STAGE_BACK:\s*[^\]]+\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseMessageMeta(content: string): { docType?: "PDD" | "SDD"; docId?: number; uipathData?: any; displayContent: string } {
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
  const [deployReport, setDeployReport] = useState<any>(null);
  const docAbortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    if (docAbortRef.current) {
      docAbortRef.current.abort();
      docAbortRef.current = null;
    }
    setIsGeneratingDoc(false);
    setGeneratingDocType("");
  }, []);

  const generateDocument = useCallback(async (type: "PDD" | "SDD") => {
    if (isGeneratingDoc) return;
    setIsGeneratingDoc(true);
    setGeneratingDocType(type);
    const controller = new AbortController();
    docAbortRef.current = controller;
    try {
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`/api/ideas/${idea.id}/documents/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error(`Failed to generate ${type}:`, err);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.log(`${type} generation cancelled`);
      } else {
        console.error(`Error generating ${type}:`, err);
      }
    } finally {
      docAbortRef.current = null;
      setIsGeneratingDoc(false);
      setGeneratingDocType("");
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
    }
  }, [idea.id, isGeneratingDoc]);

  const generateUiPath = useCallback(async () => {
    setIsGeneratingDoc(true);
    setGeneratingDocType("UiPath");
    try {
      const res = await fetch(`/api/ideas/${idea.id}/generate-uipath`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        console.error("Failed to generate UiPath package");
      }
    } catch (err) {
      console.error("Error generating UiPath package:", err);
    } finally {
      setIsGeneratingDoc(false);
      setGeneratingDocType("");
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
    }
  }, [idea.id]);

  const pddTriggeredRef = useRef(false);
  const sddTriggeredRef = useRef(false);

  const handleDocApproved = useCallback(async (docType: "PDD" | "SDD") => {
    queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
    if (docType === "PDD" && !sddTriggeredRef.current) {
      sddTriggeredRef.current = true;
      setTimeout(() => generateDocument("SDD"), 500);
    }
  }, [idea.id, generateDocument]);

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
      const loaded: ChatMsg[] = savedMessages.map((m) => {
        const meta = parseMessageMeta(m.content);
        return {
          id: String(m.id),
          role: m.role as "user" | "assistant",
          content: meta.displayContent,
          timestamp: new Date(m.createdAt),
          docType: meta.docType,
          docId: meta.docId,
          uipathData: meta.uipathData,
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
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      generateDocument("PDD");
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
      generateDocument("SDD");
    }
  }, [savedMessages, isGeneratingDoc, generateDocument]);

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
                    setDeployReport(data.deployReport);
                  }
                  setStreamingMsg(null);
                  queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });
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
                setStreamingMsg((prev) =>
                  prev
                    ? { ...prev, content: "Sorry, something went wrong. Please try again.", isStreaming: false }
                    : prev
                );
              }
            } catch {}
          }
        }
      }
    } catch {
      setStreamingMsg((prev) =>
        prev
          ? { ...prev, content: "Sorry, I couldn't connect to the server. Please try again.", isStreaming: false }
          : prev
      );
    } finally {
      setIsStreaming(false);
      setPendingUserMsg(null);
      const finalContent = streamingMsgRef.current;
      setStreamingMsg(null);
      queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "messages"] });

      if (finalContent) {
        const viewStepSets = parseStepsByView(finalContent);

        for (const { viewType, steps } of viewStepSets) {
          if (steps.length === 0) continue;

          const existingMap = await fetch(`/api/ideas/${idea.id}/process-map?view=${viewType}`, { credentials: "include" })
            .then((r) => r.json());
          const existingNodes = existingMap.nodes || [];

          const normalizeName = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

          const nameToId: Record<string, number> = {};
          for (const n of existingNodes) {
            nameToId[normalizeName(n.name)] = n.id;
          }

          const createdNodes: { name: string; id: number; from?: string; edgeLabel?: string }[] = [];

          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            const normalizedStepName = normalizeName(step.name);
            const existingId = nameToId[normalizedStepName];

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
                  orderIndex: existingNodes.length + i,
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

          const updatedMap = await fetch(`/api/ideas/${idea.id}/process-map?view=${viewType}`, { credentials: "include" }).then((r) => r.json());
          const existingEdges = updatedMap.edges || [];

          const resolveFrom = (fromName: string): number | null => {
            const normalized = normalizeName(fromName);
            if (nameToId[normalized]) return nameToId[normalized];
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
              } else if (existingNodes.length > 0) {
                sourceId = existingNodes[existingNodes.length - 1].id;
              }
            }

            if (sourceId) {
              const edgeExists = existingEdges.some(
                (e: any) => e.sourceNodeId === sourceId && e.targetNodeId === node.id
              );
              if (!edgeExists) {
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
          }

          queryClient.invalidateQueries({ queryKey: ["/api/ideas", idea.id, "process-map", viewType] });
        }
      }
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

  const handleSend = useCallback(() => {
    let text = inputValue.trim();
    if (!text && !attachedFile) return;

    if (attachedFile) {
      const fileNote = `(User uploaded a file: ${attachedFile.name}. Acknowledge it and ask them to describe its contents since you cannot read it directly yet.)`;
      text = text ? `${text}\n\n${fileNote}` : fileNote;
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

        {deployReport && deployReport.results?.length > 0 && (
          <DeploymentReportCard report={deployReport} onDismiss={() => setDeployReport(null)} />
        )}

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
            placeholder={isStreaming ? "Type to queue your next message..." : "Describe your process..."}
            className="min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent focus-visible:ring-0 p-0 text-xs placeholder:text-muted-foreground/50"
            rows={1}
            data-testid="input-chat-message"
          />
          <Button
            size="icon"
            className="shrink-0"
            onClick={handleSend}
            disabled={!inputValue.trim() && !attachedFile}
            data-testid="button-send-message"
          >
            {isStreaming ? (
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
