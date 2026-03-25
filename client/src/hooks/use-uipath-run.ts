import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export type UiPathRunStatus = "BUILDING" | "STALLED" | "READY" | "READY_WITH_WARNINGS" | "FALLBACK_READY" | "FAILED" | "CANCELLED" | "PENDING";
export type UiPathRunWarning = { code: string; message: string; stage: string; recoverable: boolean };
export type UiPathOutcomeSummary = {
  stubbedActivities: number;
  stubbedSequences: number;
  stubbedWorkflows: number;
  autoRepairs: number;
  fullyGenerated: number;
  totalEstimatedMinutes: number;
};

export interface UiPathRunState {
  runId: string;
  status: UiPathRunStatus;
  source: "chat" | "retry" | "approval" | "auto";
  warnings?: UiPathRunWarning[];
  complianceScore?: number;
  completenessLevel?: "structural" | "functional" | "incomplete";
  outcomeSummary?: UiPathOutcomeSummary;
  createdAt: number;
}

export interface PipelineLogEntry {
  id: string;
  type: "started" | "heartbeat" | "completed" | "warning" | "failed" | "progress";
  stage: string;
  message: string;
  elapsed?: number;
  context?: Record<string, any>;
  timestamp: number;
}

export type CancelState = "idle" | "cancelling" | "cancelled" | "cancel_failed";

interface CompletedRunResult {
  runId: string;
  status: UiPathRunStatus;
  warnings?: UiPathRunWarning[];
  complianceScore?: number;
  completenessLevel?: "structural" | "functional" | "incomplete";
  outcomeSummary?: UiPathOutcomeSummary;
  dependencyMap?: Record<string, string>;
}

export interface UseUiPathRunReturn {
  currentRun: UiPathRunState | null;
  completedRuns: Map<string, CompletedRunResult>;
  pipelineLogEntries: PipelineLogEntry[];
  pipelineComplete: boolean;
  isRunning: boolean;
  showProgressPanel: boolean;
  dismissProgressPanel: () => void;
  startRun: (source?: "chat" | "retry" | "approval" | "auto", force?: boolean) => Promise<void>;
  cancelRun: () => void;
  metaValidationChipStatus: string;
  metaValidationFixCount: number;
  liveStatus: string;
  cancelState: CancelState;
  generationStartTime: number | null;
}

const SSE_MAX_RETRIES = 3;
const SSE_BACKOFF_BASE_MS = 1000;

export function useUiPathRun(ideaId: string): UseUiPathRunReturn {
  const { toast } = useToast();
  const [currentRun, setCurrentRun] = useState<UiPathRunState | null>(null);
  const currentRunRef = useRef<UiPathRunState | null>(null);
  const [completedRuns, setCompletedRuns] = useState<Map<string, CompletedRunResult>>(new Map());
  const [pipelineLogEntries, setPipelineLogEntries] = useState<PipelineLogEntry[]>([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);

  const [isRunning, setIsRunning] = useState(false);
  const [showProgressPanel, setShowProgressPanel] = useState(false);
  const [metaValidationChipStatus, setMetaValidationChipStatus] = useState<string>("ready");
  const [metaValidationFixCount, setMetaValidationFixCount] = useState(0);
  const [liveStatus, setLiveStatus] = useState("");
  const [cancelState, setCancelState] = useState<CancelState>("idle");
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const cancelRequestedRef = useRef(false);
  const retryCountRef = useRef(0);

  const processSSEDataRef = useRef<(data: any, runId: string) => void>(() => {});
  const finishRunRef = useRef<() => void>(() => {});
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAfterIndexRef = useRef(0);
  const runCompletedViaPollingRef = useRef(false);
  const activePollingRunIdRef = useRef<string | null>(null);
  const lastSseDataAtRef = useRef(0);
  const pollingActiveRef = useRef(false);
  const pollDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollDelayTimerRef.current !== null) {
      clearTimeout(pollDelayTimerRef.current);
      pollDelayTimerRef.current = null;
    }
    activePollingRunIdRef.current = null;
    pollingActiveRef.current = false;
  }, []);

  const startPolling = useCallback((pollingIdeaId: string, pollingRunId: string) => {
    stopPolling();
    pollAfterIndexRef.current = 0;
    runCompletedViaPollingRef.current = false;
    activePollingRunIdRef.current = pollingRunId;
    lastSseDataAtRef.current = Date.now();
    pollingActiveRef.current = false;

    const SSE_INACTIVITY_MS = 5000;
    const POLL_INTERVAL_MS = 2500;

    const doPoll = async () => {
      if (activePollingRunIdRef.current !== pollingRunId) return;
      if (runCompletedViaPollingRef.current) return;

      const sseRecentlyActive = (Date.now() - lastSseDataAtRef.current) < SSE_INACTIVITY_MS;
      if (sseRecentlyActive) return;

      try {
        const url = `/api/ideas/${pollingIdeaId}/uipath-runs/${pollingRunId}/progress?afterIndex=${pollAfterIndexRef.current}`;
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) return;
        const result = await res.json();

        if (activePollingRunIdRef.current !== pollingRunId) return;

        if (result.events && result.events.length > 0) {
          for (const event of result.events) {
            if (event.data) {
              processSSEDataRef.current(event.data, pollingRunId);
            }
          }
          pollAfterIndexRef.current = result.totalStored;
        }

        if (result.status && result.status !== "BUILDING" && result.status !== "PENDING") {
          runCompletedViaPollingRef.current = true;
          stopPolling();
          finishRunRef.current();
        }
      } catch (err) {
        console.warn("[useUiPathRun] polling error:", err);
      }
    };

    const beginInterval = () => {
      if (activePollingRunIdRef.current !== pollingRunId) return;
      pollingActiveRef.current = true;
      doPoll();
      pollIntervalRef.current = setInterval(doPoll, POLL_INTERVAL_MS);
    };

    pollDelayTimerRef.current = setTimeout(() => {
      pollDelayTimerRef.current = null;
      beginInterval();
    }, SSE_INACTIVITY_MS);
  }, [stopPolling]);

  const finishRun = useCallback(() => {
    setIsRunning(false);
    setCancelState("idle");
    activeRunIdRef.current = null;
    cancelRequestedRef.current = false;
    retryCountRef.current = 0;
    clearRetryTimer();
    stopPolling();
    queryClient.invalidateQueries({ queryKey: ["/api/ideas", ideaId, "messages"] });
  }, [ideaId, clearRetryTimer, stopPolling]);

  finishRunRef.current = finishRun;

  const processSSEData = useCallback((data: any, runId: string) => {
    if (data.heartbeat) return;

    if (data.pipelineEvent) {
      const evt = data.pipelineEvent;
      console.log(`[useUiPathRun] pipelineEvent received: stage=${evt.stage}, type=${evt.type}, message=${evt.message}, runId=${runId}`);
      setPipelineLogEntries(prev => [...prev, {
        id: `pe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: evt.type,
        stage: evt.stage,
        message: evt.message,
        elapsed: evt.elapsed,
        context: evt.context,
        timestamp: Date.now(),
      }]);
      if (evt.message) {
        setLiveStatus(evt.message);
      }
      if (evt.stage === "complete" && evt.type === "completed") {
        setPipelineComplete(true);
      }
      if (evt.type === "failed") {
        setPipelineComplete(true);
      }
    }

    if (data.progress) {
      setLiveStatus(data.progress);
    }

    if (data.metaValidation) {
      const mv = data.metaValidation;
      if (mv.status === "started") setMetaValidationChipStatus("validating");
      else if (mv.status === "assessing") setMetaValidationChipStatus("assessing");
      else if (mv.status === "will-validate") setMetaValidationChipStatus("will-validate");
      else if (mv.status === "not-needed") setMetaValidationChipStatus("not-needed");
      else if (mv.status === "completed") {
        if (mv.correctionsApplied > 0) {
          setMetaValidationChipStatus("fixed");
          setMetaValidationFixCount(mv.correctionsApplied);
        } else {
          setMetaValidationChipStatus("clean");
        }
      } else if (mv.status === "warning") {
        setMetaValidationChipStatus("warning");
        setMetaValidationFixCount(mv.correctionsApplied || 0);
      }
    }

    if (data.status) {
      const status = data.status as UiPathRunStatus;
      setCurrentRun(prev => {
        if (!prev || prev.runId !== runId) return prev;
        const updated = { ...prev, status };
        currentRunRef.current = updated;
        return updated;
      });

      if (status === "FAILED") {
        setPipelineComplete(true);
        toast({
          title: "Package build failed",
          description: data.error || "Package build produced no output",
          variant: "destructive",
        });
      }
    }

    if (data.warnings) {
      setCurrentRun(prev => {
        if (!prev || prev.runId !== runId) return prev;
        const updated = { ...prev, warnings: data.warnings };
        currentRunRef.current = updated;
        return updated;
      });
    }

    if (data.templateComplianceScore !== undefined) {
      setCurrentRun(prev => {
        if (!prev || prev.runId !== runId) return prev;
        const updated = { ...prev, complianceScore: data.templateComplianceScore };
        currentRunRef.current = updated;
        return updated;
      });
    }

    if (data.outcomeSummary) {
      setCurrentRun(prev => {
        if (!prev || prev.runId !== runId) return prev;
        const updated = { ...prev, outcomeSummary: data.outcomeSummary };
        currentRunRef.current = updated;
        return updated;
      });
    }

    if (data.error && !data.status) {
      setCurrentRun(prev => {
        if (!prev || prev.runId !== runId) return prev;
        const updated = { ...prev, status: "FAILED" as UiPathRunStatus };
        currentRunRef.current = updated;
        return updated;
      });
      setPipelineLogEntries(prev => {
        const hasFailEntry = prev.some(e => e.type === "failed");
        if (hasFailEntry) return prev;
        return [...prev, {
          id: `pe-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "failed" as const,
          stage: "unknown",
          message: data.error,
          timestamp: Date.now(),
        }];
      });
      toast({
        title: "Package generation failed",
        description: data.error,
        variant: "destructive",
      });
    }

    if (data.done) {
      console.log(`[useUiPathRun] done event received: runId=${runId}, status=${data.status}`);
      setPipelineComplete(true);
      const finalRun = currentRunRef.current;
      if (finalRun && finalRun.runId === runId) {
        const finalStatus = (data.status || finalRun.status) as UiPathRunStatus;
        const isSuccess = finalStatus !== "FAILED" && finalStatus !== "CANCELLED";
        if (isSuccess && (finalStatus === "BUILDING" || finalStatus === "PENDING")) {
          setCurrentRun(prev => {
            if (!prev || prev.runId !== runId) return prev;
            const updated = { ...prev, status: "READY" as UiPathRunStatus };
            currentRunRef.current = updated;
            return updated;
          });
        }
        setCompletedRuns(prev => {
          const next = new Map(prev);
          const cur = currentRunRef.current;
          next.set(runId, {
            runId,
            status: cur?.status || finalStatus,
            warnings: data.warnings || cur?.warnings,
            complianceScore: data.templateComplianceScore ?? cur?.complianceScore,
            completenessLevel: data.completenessLevel,
            outcomeSummary: data.outcomeSummary || cur?.outcomeSummary,
            dependencyMap: data.dependencyMap,
          });
          return next;
        });
        if (isSuccess) {
          toast({
            title: "UiPath Package Ready",
            description: "Package generated successfully. You can now deploy to UiPath.",
          });
        }
      }
      finishRunRef.current();
    }
  }, [toast]);

  processSSEDataRef.current = processSSEData;

  const subscribeToStream = useCallback((ideaId: string, runId: string, replay?: boolean) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    startPolling(ideaId, runId);

    const url = `/api/ideas/${ideaId}/uipath-runs/${runId}/stream${replay ? "?replay=true" : ""}`;
    console.log(`[useUiPathRun] subscribing to SSE stream: runId=${runId}, replay=${!!replay}, url=${url}`);
    let sseEventCount = 0;
    fetch(url, { credentials: "include", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          console.error("[useUiPathRun] Stream response not OK:", res.status);
          finishRunRef.current();
          return;
        }
        console.log(`[useUiPathRun] SSE stream connected: runId=${runId}`);
        retryCountRef.current = 0;
        const reader = res.body?.getReader();
        if (!reader) {
          console.error("[useUiPathRun] SSE stream has no readable body");
          finishRunRef.current();
          return;
        }
        const decoder = new TextDecoder();
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
                lastSseDataAtRef.current = Date.now();
                if (runCompletedViaPollingRef.current) {
                  continue;
                }
                sseEventCount++;
                if (pollingActiveRef.current && pollAfterIndexRef.current > 0) {
                  if (sseEventCount <= pollAfterIndexRef.current) {
                    continue;
                  }
                }
                pollAfterIndexRef.current = Math.max(pollAfterIndexRef.current, sseEventCount);
                processSSEDataRef.current(data, runId);
              } catch (parseErr) {
                console.error("[useUiPathRun] SSE parse error:", parseErr, "raw:", line.slice(6, 200));
              }
            }
          }
        }
        if (runCompletedViaPollingRef.current) {
          finishRunRef.current();
          return;
        }
        const finalRun = currentRunRef.current;
        if (finalRun && finalRun.runId === runId && (finalRun.status === "BUILDING" || finalRun.status === "PENDING")) {
          setCurrentRun(prev => {
            if (!prev || prev.runId !== runId) return prev;
            const updated = { ...prev, status: "READY" as UiPathRunStatus };
            currentRunRef.current = updated;
            return updated;
          });
          setCompletedRuns(prev => {
            const next = new Map(prev);
            const cur = currentRunRef.current;
            next.set(runId, { runId, status: cur?.status || "READY", warnings: cur?.warnings, complianceScore: cur?.complianceScore, completenessLevel: cur?.completenessLevel, outcomeSummary: cur?.outcomeSummary });
            return next;
          });
        }
        finishRunRef.current();
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        console.error("[useUiPathRun] Stream error:", err);
        const attempt = retryCountRef.current;
        if (attempt < SSE_MAX_RETRIES) {
          retryCountRef.current = attempt + 1;
          const delay = SSE_BACKOFF_BASE_MS * Math.pow(2, attempt);
          console.log(`[useUiPathRun] Retrying SSE connection in ${delay}ms (attempt ${attempt + 1}/${SSE_MAX_RETRIES})`);
          setLiveStatus(`Connection lost — retrying (${attempt + 1}/${SSE_MAX_RETRIES})...`);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            if (activeRunIdRef.current === runId) {
              subscribeToStream(ideaId, runId, true);
            }
          }, delay);
        } else {
          console.error(`[useUiPathRun] SSE retries exhausted after ${SSE_MAX_RETRIES} attempts`);
          setPipelineLogEntries(prev => {
            const hasFailEntry = prev.some(e => e.type === "failed");
            if (hasFailEntry) return prev;
            return [...prev, {
              id: `pe-fail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              type: "failed" as const,
              stage: "connection",
              message: "Connection lost — could not reconnect to server",
              timestamp: Date.now(),
            }];
          });
          finishRunRef.current();
        }
      });
  }, [startPolling]);

  const dismissProgressPanel = useCallback(() => {
    setShowProgressPanel(false);
  }, []);

  useEffect(() => {
    setCurrentRun(null);
    currentRunRef.current = null;
    setCompletedRuns(new Map());
    setPipelineLogEntries([]);
    setPipelineComplete(false);
    setIsRunning(false);
    setShowProgressPanel(false);
    setLiveStatus("");
    setCancelState("idle");
    setGenerationStartTime(null);
    activeRunIdRef.current = null;
    cancelRequestedRef.current = false;
    retryCountRef.current = 0;

    (async () => {
      try {
        const res = await fetch(`/api/ideas/${ideaId}/uipath-runs/latest`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.run) return;
        const run = data.run;
        const isActive = run.status === "BUILDING" || run.status === "PENDING";
        const runState: UiPathRunState = {
          runId: run.runId,
          status: run.status,
          source: run.source,
          warnings: run.warnings,
          complianceScore: run.complianceScore,
          outcomeSummary: run.outcomeSummary,
          createdAt: run.createdAt,
        };

        if (isActive) {
          setCurrentRun(runState);
          currentRunRef.current = runState;
          setIsRunning(true);
          setShowProgressPanel(true);
          activeRunIdRef.current = run.runId;
          setLiveStatus("Generating UiPath package...");
          setGenerationStartTime(run.createdAt || Date.now());
          setCancelState("idle");
          subscribeToStream(ideaId, run.runId, true);
        } else if (run.status !== "CANCELLED") {
          setCompletedRuns(new Map([[run.runId, {
            runId: run.runId,
            status: run.status,
            warnings: run.warnings,
            complianceScore: run.complianceScore,
            completenessLevel: run.completenessLevel,
            outcomeSummary: run.outcomeSummary,
            dependencyMap: run.dependencyMap,
          }]]));
        }
      } catch {}
    })();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      stopPolling();
    };
  }, [ideaId, subscribeToStream, stopPolling]);

  const startRun = useCallback(async (source: "chat" | "retry" | "approval" | "auto" = "auto", force?: boolean) => {
    if (isRunning) {
      console.log("[useUiPathRun] Run already in progress — ignoring");
      return;
    }

    setIsRunning(true);
    setShowProgressPanel(true);
    setLiveStatus("Generating UiPath package...");
    setPipelineLogEntries([]);
    setPipelineComplete(false);
    setMetaValidationChipStatus("ready");
    setCancelState("idle");
    setGenerationStartTime(Date.now());
    cancelRequestedRef.current = false;
    retryCountRef.current = 0;

    try {
      const res = await fetch(`/api/ideas/${ideaId}/uipath-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ source, force: force || false }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({
          title: "Package generation failed",
          description: err.message || "Could not start UiPath package generation.",
          variant: "destructive",
        });
        setIsRunning(false);
        setLiveStatus("");
        setShowProgressPanel(false);
        return;
      }

      const { runId } = await res.json();

      if (cancelRequestedRef.current) {
        fetch(`/api/ideas/${ideaId}/uipath-runs/${runId}/cancel`, {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
        setCancelState("cancelled");
        setCurrentRun({ runId, status: "CANCELLED", source, createdAt: Date.now() });
        currentRunRef.current = { runId, status: "CANCELLED", source, createdAt: Date.now() };
        setTimeout(() => {
          setIsRunning(false);
          setLiveStatus("");
        }, 1500);
        return;
      }

      const newRun: UiPathRunState = {
        runId,
        status: "BUILDING",
        source,
        createdAt: Date.now(),
      };
      setCurrentRun(newRun);
      currentRunRef.current = newRun;
      activeRunIdRef.current = runId;

      subscribeToStream(ideaId, runId, true);
    } catch (err: any) {
      console.error("[useUiPathRun] startRun error:", err);
      toast({
        title: "Error",
        description: "Could not generate UiPath package. Please try again.",
        variant: "destructive",
      });
      setIsRunning(false);
      setLiveStatus("");
      setShowProgressPanel(false);
    }
  }, [ideaId, isRunning, toast, subscribeToStream]);

  const doCancelRun = useCallback(() => {
    if (cancelState !== "idle" && cancelState !== "cancel_failed") return;
    setCancelState("cancelling");
    cancelRequestedRef.current = true;
    clearRetryTimer();
    stopPolling();
    const runId = activeRunIdRef.current;
    if (runId) {
      fetch(`/api/ideas/${ideaId}/uipath-runs/${runId}/cancel`, {
        method: "POST",
        credentials: "include",
      }).then((res) => {
        if (res.ok) {
          setCancelState("cancelled");
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          setCurrentRun(prev => {
            if (!prev) return prev;
            const updated = { ...prev, status: "CANCELLED" as UiPathRunStatus };
            currentRunRef.current = updated;
            return updated;
          });
          toast({
            title: "Cancelled",
            description: "Package generation was cancelled.",
          });
          setTimeout(() => {
            setIsRunning(false);
            setLiveStatus("");
            activeRunIdRef.current = null;
          }, 1500);
        } else {
          setCancelState("cancel_failed");
          cancelRequestedRef.current = false;
          toast({
            title: "Cancel failed",
            description: "Could not cancel the run. You can try again.",
            variant: "destructive",
          });
        }
      }).catch(() => {
        setCancelState("cancel_failed");
        cancelRequestedRef.current = false;
        toast({
          title: "Cancel failed",
          description: "Could not reach the server. You can try again.",
          variant: "destructive",
        });
      });
    } else {
      setCancelState("cancelled");
      setCurrentRun(prev => {
        if (!prev) return prev;
        const updated = { ...prev, status: "CANCELLED" as UiPathRunStatus };
        currentRunRef.current = updated;
        return updated;
      });
      toast({
        title: "Cancelled",
        description: "Package generation was cancelled.",
      });
      setTimeout(() => {
        setIsRunning(false);
        setLiveStatus("");
        activeRunIdRef.current = null;
      }, 1500);
    }
  }, [ideaId, toast, cancelState, clearRetryTimer, stopPolling]);

  return {
    currentRun,
    completedRuns,
    pipelineLogEntries,
    pipelineComplete,
    isRunning,
    showProgressPanel,
    dismissProgressPanel,
    startRun,
    cancelRun: doCancelRun,
    metaValidationChipStatus,
    metaValidationFixCount,
    liveStatus,
    cancelState,
    generationStartTime,
  };
}
