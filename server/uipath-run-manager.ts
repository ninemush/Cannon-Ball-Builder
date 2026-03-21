import { randomUUID } from "crypto";
import { storage } from "./storage";
import { documentStorage } from "./document-storage";
import { processMapStorage } from "./process-map-storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { getCodeLLM } from "./lib/llm";
import { runBuildPipeline, getCachedPipelineResult, findUiPathMessage, type IdeaContext, type PipelineResult } from "./uipath-pipeline";
import type { PipelineProgressEvent, PipelineProgressCallback } from "./uipath-pipeline";
import type { UipathGenerationRun } from "@shared/schema";
import { sanitizeAndParseJson } from "./lib/json-utils";
import { uipathPackageSchema } from "./types/uipath-package";
import { UIPATH_PROMPT, repairTruncatedPackageJson } from "./uipath-prompts";
import { QualityGateError } from "./uipath-integration";
import type { MetaValidationMode } from "./meta-validation";

export type TriggerSource = "manual" | "chat" | "api";

export interface RunCallbacks {
  onProgress?: (message: string) => void;
  onPipelineEvent?: PipelineProgressCallback;
  onMetaValidation?: (event: any) => void;
  onPackageResolved?: (packageJson: any) => void;
  onComplete?: (result: RunResult) => void;
  onFail?: (error: string, context?: Record<string, any>) => void;
}

export interface RunOptions {
  generationMode?: "baseline_openable" | "full_implementation";
  metaValidationMode?: MetaValidationMode;
  forceRegenerate?: boolean;
  callbacks?: RunCallbacks;
}

export interface RunResult {
  status: string;
  packageJson: any;
  pipelineResult: PipelineResult | null;
  cached: boolean;
}

interface ActiveRun {
  runId: string;
  ideaId: string;
  events: PipelineProgressEvent[];
  sseListeners: Set<(event: PipelineProgressEvent) => void>;
  completed: boolean;
  finalStatus?: string;
  error?: string;
}

const activeRuns = new Map<string, ActiveRun>();
const ideaActiveRunMap = new Map<string, string>();

export function getActiveRunForIdea(ideaId: string): ActiveRun | undefined {
  const runId = ideaActiveRunMap.get(ideaId);
  if (!runId) return undefined;
  return activeRuns.get(runId);
}

export function getActiveRun(runId: string): ActiveRun | undefined {
  return activeRuns.get(runId);
}

export function subscribeToRun(runId: string, listener: (event: PipelineProgressEvent) => void): () => void {
  const run = activeRuns.get(runId);
  if (!run) return () => {};
  run.sseListeners.add(listener);
  return () => {
    run.sseListeners.delete(listener);
  };
}

async function checkDbInProgress(ideaId: string): Promise<boolean> {
  const latest = await storage.getLatestGenerationRunForIdea(ideaId);
  if (latest && latest.status === "running" && !latest.completedAt) {
    const ageMs = Date.now() - new Date(latest.createdAt).getTime();
    if (ageMs < 10 * 60 * 1000) {
      return true;
    }
    await storage.failGenerationRun(latest.runId, "Run timed out (stale after restart)");
    console.warn(`[RunManager] Cleaned up stale run ${latest.runId} for idea ${ideaId} (age: ${Math.round(ageMs / 1000)}s)`);
  }
  return false;
}

export async function startUiPathGenerationRun(
  ideaId: string,
  triggerSource: TriggerSource,
  options?: RunOptions,
): Promise<{ runId: string; run: UipathGenerationRun }> {
  const existingRunId = ideaActiveRunMap.get(ideaId);
  if (existingRunId) {
    const existingActive = activeRuns.get(existingRunId);
    if (existingActive && !existingActive.completed) {
      throw new Error("A generation run is already in progress for this idea");
    }
  }

  const dbInProgress = await checkDbInProgress(ideaId);
  if (dbInProgress) {
    throw new Error("A generation run is already in progress for this idea");
  }

  const runId = randomUUID();

  let dbRun: UipathGenerationRun;
  try {
    dbRun = await storage.createGenerationRun({
      ideaId,
      runId,
      status: "running",
      generationMode: options?.generationMode || null,
      triggeredBy: triggerSource,
      currentPhase: "initializing",
      phaseProgress: null,
      outcomeReport: null,
      dhgContent: null,
      errorMessage: null,
    });
  } catch (insertErr: any) {
    if (insertErr?.code === "23505" || insertErr?.message?.includes("unique") || insertErr?.message?.includes("duplicate")) {
      throw new Error("A generation run is already in progress for this idea");
    }
    throw insertErr;
  }

  const activeRun: ActiveRun = {
    runId,
    ideaId,
    events: [],
    sseListeners: new Set(),
    completed: false,
  };
  activeRuns.set(runId, activeRun);
  ideaActiveRunMap.set(ideaId, runId);

  executeRun(runId, ideaId, options).catch((err) => {
    console.error(`[RunManager] Unhandled error in run ${runId}:`, err);
  });

  return { runId, run: dbRun };
}

async function executeRun(
  runId: string,
  ideaId: string,
  options?: RunOptions,
): Promise<void> {
  const activeRun = activeRuns.get(runId)!;
  const callbacks = options?.callbacks;
  const phaseEvents: PipelineProgressEvent[] = [];

  const pipelineProgressCallback: PipelineProgressCallback = (event) => {
    phaseEvents.push(event);
    activeRun.events.push(event);

    Array.from(activeRun.sseListeners).forEach(listener => {
      try { listener(event); } catch {}
    });

    if (callbacks?.onPipelineEvent) {
      try { callbacks.onPipelineEvent(event); } catch {}
    }

    storage.updateGenerationRunStatus(runId, "running", event.stage).catch(() => {});

    if (phaseEvents.length % 5 === 0 || event.type === "completed" || event.type === "failed") {
      storage.updateGenerationRunPhaseProgress(runId, JSON.stringify(phaseEvents.slice(-50))).catch(() => {});
    }
  };

  const emitProgress = (message: string) => {
    if (callbacks?.onProgress) {
      try { callbacks.onProgress(message); } catch {}
    }
  };

  let packageJson: any = null;

  try {
    await storage.updateGenerationRunStatus(runId, "running", "sdd_validation");
    emitProgress("Loading idea and documents...");

    const sddApproval = await documentStorage.getApproval(ideaId, "SDD");
    if (!sddApproval) {
      throw new RunError("SDD must be approved first", "precondition");
    }
    const sdd = await documentStorage.getDocument(sddApproval.documentId);
    if (!sdd) {
      throw new RunError("Approved SDD document not found", "precondition");
    }

    const idea = await storage.getIdea(ideaId);
    if (!idea) {
      throw new RunError("Idea not found", "precondition");
    }

    const existingMessages = await chatStorage.getMessagesByIdeaId(ideaId);
    const existingUiPath = [...existingMessages].reverse().find((m: any) => m.content.startsWith("[UIPATH:"));

    if (existingUiPath && !options?.forceRegenerate) {
      try {
        const existingData = JSON.parse(existingUiPath.content.slice(8, -1));
        if ((existingData.workflows || []).length > 0) {
          packageJson = existingData;

          const cachedResult = getCachedPipelineResult(ideaId);
          if (cachedResult) {
            if (callbacks?.onPackageResolved) callbacks.onPackageResolved(packageJson);
            if (callbacks?.onComplete) {
              callbacks.onComplete({
                status: cachedResult.status || "READY",
                packageJson,
                pipelineResult: cachedResult,
                cached: true,
              });
            }
            await finishRun(runId, activeRun, phaseEvents, {
              status: "completed",
              generationMode: cachedResult.generationMode,
            });
            return;
          }
        }
      } catch {}
    }

    if (!packageJson) {
      await storage.updateGenerationRunStatus(runId, "running", "llm_generation");
      emitProgress("Calling LLM to generate package specification...");

      const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
      const toBeNodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
      const asIsNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
      const mapNodes = toBeNodes.length > 0 ? toBeNodes : asIsNodes;
      const mapSummary = mapNodes.map((n: any) => ({ name: n.name, type: n.nodeType, role: n.role, system: n.system, description: n.description }));

      let systemCtx = `You are a UiPath automation architect generating a production-ready package structure for "${idea.title}".\n\nApproved SDD:\n${sdd.content}`;
      if (pdd) systemCtx += `\n\nApproved PDD:\n${pdd.content}`;
      if (mapSummary.length > 0) systemCtx += `\n\nProcess Map Steps:\n${JSON.stringify(mapSummary)}`;

      const keepAliveMessages = [
        "Analysing your process specification...",
        "Planning workflow structure...",
        "Determining activity requirements...",
        "Mapping data flows and variables...",
        "Almost ready to build...",
      ];
      let keepAliveIdx = 0;
      const keepAliveInterval = setInterval(() => {
        emitProgress(keepAliveMessages[keepAliveIdx % keepAliveMessages.length]);
        keepAliveIdx++;
      }, 5000);

      let response;
      try {
        response = await getCodeLLM().create({
          maxTokens: 16384,
          system: systemCtx,
          messages: [{ role: "user", content: UIPATH_PROMPT }],
        });
      } finally {
        clearInterval(keepAliveInterval);
      }

      emitProgress("LLM response received, parsing JSON...");
      const rawText = response.text || "{}";

      if (response.stopReason === "max_tokens") {
        emitProgress("Response truncated, attempting JSON repair...");
      }

      try {
        const parsed = sanitizeAndParseJson(rawText);
        packageJson = uipathPackageSchema.parse(parsed);
        emitProgress("Package JSON parsed successfully");
      } catch (parseErr: any) {
        emitProgress("Initial parse failed, attempting repair...");
        const repaired = repairTruncatedPackageJson(rawText);
        if (repaired) {
          try {
            packageJson = uipathPackageSchema.parse(repaired);
            emitProgress(`Repaired JSON: ${(repaired.workflows || []).length} workflows recovered`);
          } catch {}
        }
        if (!packageJson) {
          throw new RunError("Failed to parse AI-generated package. Please try again.", "llm_parse");
        }
      }

      if (!packageJson.workflows || packageJson.workflows.length === 0) {
        throw new RunError("AI generated a package with no workflows. Please try again.", "llm_parse");
      }
    }

    if (callbacks?.onPackageResolved) callbacks.onPackageResolved(packageJson);

    await storage.updateGenerationRunStatus(runId, "running", "build_pipeline");
    emitProgress("Pre-building .nupkg with AI enrichment...");

    const sddDoc = await documentStorage.getLatestDocument(ideaId, "SDD");
    const pddDoc = await documentStorage.getLatestDocument(ideaId, "PDD");
    const toBeN = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
    const asIsN = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
    const mNodes = toBeN.length > 0 ? toBeN : asIsN;
    const mVariant = toBeN.length > 0 ? "to-be" : "as-is";
    let pEdges: any[] = [];
    if (mNodes.length > 0) {
      pEdges = await processMapStorage.getEdgesByIdeaId(ideaId, mVariant as "to-be" | "as-is");
    }
    const preloadedContext: IdeaContext = { idea, sdd: sddDoc, pdd: pddDoc, mapNodes: mNodes, processEdges: pEdges };

    let userMetaValidationMode: MetaValidationMode = options?.metaValidationMode || "Auto";

    const pipelineResult = await runBuildPipeline(ideaId, packageJson, {
      onProgress: (msg: string) => emitProgress(msg),
      onPipelineProgress: pipelineProgressCallback,
      onMetaValidation: callbacks?.onMetaValidation,
      generationMode: options?.generationMode,
      metaValidationMode: userMetaValidationMode,
      preloadedContext,
    });

    if (pipelineResult.status === "FAILED") {
      throw new RunError("Package build produced no output", "build_failed", { packageJson });
    }

    const actualWorkflowCount = (pipelineResult.xamlEntries || []).filter(
      (e: { name: string }) => e.name.endsWith(".xaml")
    ).length;
    const updatedPackageJson = { ...packageJson, generatedWorkflowCount: actualWorkflowCount };

    await chatStorage.createMessage(ideaId, "assistant", `[UIPATH:${JSON.stringify(updatedPackageJson)}]`);

    const result: RunResult = {
      status: pipelineResult.status,
      packageJson: updatedPackageJson,
      pipelineResult,
      cached: false,
    };

    if (callbacks?.onComplete) callbacks.onComplete(result);

    const outcomeReportJson = pipelineResult.outcomeReport ? JSON.stringify(pipelineResult.outcomeReport) : undefined;
    await finishRun(runId, activeRun, phaseEvents, {
      status: pipelineResult.warnings?.length > 0 || pipelineResult.status === "FALLBACK_READY" ? "completed_with_warnings" : "completed",
      outcomeReport: outcomeReportJson,
      dhgContent: pipelineResult.dhgContent || undefined,
      generationMode: pipelineResult.generationMode,
    });

    console.log(`[RunManager] Run ${runId} completed for idea ${ideaId} — status: ${pipelineResult.status}`);

  } catch (err: any) {
    const errorMessage = err?.message || "Unknown error";
    let errorContext: Record<string, any> | undefined;

    if (err instanceof RunError) {
      errorContext = err.context;
    } else if (err instanceof QualityGateError) {
      const qgResult = err.qualityGateResult;
      errorContext = {
        stage: "quality-gate",
        qualityGateWarning: true,
        qualityGateViolations: qgResult?.violations,
        qualityGateSummary: qgResult?.summary,
        packageJson,
      };
    }

    console.error(`[RunManager] Run ${runId} failed:`, errorMessage);

    if (callbacks?.onFail) {
      try { callbacks.onFail(errorMessage, errorContext); } catch {}
    }

    await failRunInternal(runId, activeRun, phaseEvents, errorMessage);
  }
}

async function finishRun(
  runId: string,
  activeRun: ActiveRun,
  phaseEvents: PipelineProgressEvent[],
  updates: { status: string; outcomeReport?: string; dhgContent?: string; generationMode?: string },
): Promise<void> {
  const finalProgress = JSON.stringify(phaseEvents.slice(-50));
  await storage.updateGenerationRunPhaseProgress(runId, finalProgress).catch(() => {});
  await storage.completeGenerationRun(runId, updates);

  activeRun.completed = true;
  activeRun.finalStatus = updates.status;

  Array.from(activeRun.sseListeners).forEach(listener => {
    try {
      listener({ type: "completed", stage: "run_manager", message: `Run completed with status: ${updates.status}` });
    } catch {}
  });

  scheduleCleanup(runId, activeRun.ideaId);
}

async function failRunInternal(
  runId: string,
  activeRun: ActiveRun,
  phaseEvents: PipelineProgressEvent[],
  errorMessage: string,
): Promise<void> {
  const finalProgress = JSON.stringify(phaseEvents.slice(-50));
  await storage.updateGenerationRunPhaseProgress(runId, finalProgress).catch(() => {});
  await storage.failGenerationRun(runId, errorMessage).catch(() => {});

  activeRun.completed = true;
  activeRun.finalStatus = "failed";
  activeRun.error = errorMessage;

  Array.from(activeRun.sseListeners).forEach(listener => {
    try {
      listener({ type: "failed", stage: "run_manager", message: errorMessage });
    } catch {}
  });

  scheduleCleanup(runId, activeRun.ideaId);
}

export async function cancelActiveRun(runId: string): Promise<boolean> {
  const activeRun = activeRuns.get(runId);
  if (!activeRun || activeRun.completed) return false;

  activeRun.completed = true;
  activeRun.finalStatus = "cancelled";

  Array.from(activeRun.sseListeners).forEach(listener => {
    try {
      listener({ type: "failed", stage: "run_manager", message: "Run cancelled by user" });
    } catch {}
  });

  await storage.failGenerationRun(runId, "Cancelled by user").catch(() => {});
  scheduleCleanup(runId, activeRun.ideaId);
  return true;
}

function scheduleCleanup(runId: string, ideaId: string): void {
  setTimeout(() => {
    const run = activeRuns.get(runId);
    if (run && run.completed) {
      activeRuns.delete(runId);
      const currentRunId = ideaActiveRunMap.get(ideaId);
      if (currentRunId === runId) {
        ideaActiveRunMap.delete(ideaId);
      }
    }
  }, 5 * 60 * 1000);
}

class RunError extends Error {
  stage: string;
  context?: Record<string, any>;
  constructor(message: string, stage: string, context?: Record<string, any>) {
    super(message);
    this.stage = stage;
    this.context = context;
  }
}

import { EventEmitter } from "events";

export type ObserverRunStatus = "PENDING" | "BUILDING" | "STALLED" | "READY" | "READY_WITH_WARNINGS" | "FALLBACK_READY" | "FAILED" | "CANCELLED";

export interface ObserverRunEvent {
  type: "status" | "progress" | "pipeline" | "heartbeat" | "metaValidation" | "done" | "error" | "warnings" | "complianceScore" | "outcomeSummary";
  data: any;
  timestamp: number;
}

export interface ObserverRunState {
  runId: string;
  ideaId: string;
  status: ObserverRunStatus;
  source: "chat" | "retry" | "approval" | "auto";
  createdAt: number;
  updatedAt: number;
  currentPhase?: string;
  phaseProgress?: string;
  warnings?: Array<{ code: string; message: string; stage: string; recoverable: boolean }>;
  complianceScore?: number;
  outcomeSummary?: {
    stubbedActivities: number;
    stubbedSequences: number;
    stubbedWorkflows: number;
    autoRepairs: number;
    fullyGenerated: number;
    totalEstimatedMinutes: number;
  };
  error?: string;
}

interface ObserverRunEntry {
  state: ObserverRunState;
  emitter: EventEmitter;
  events: ObserverRunEvent[];
}

const observerRuns = new Map<string, ObserverRunEntry>();
const latestObserverRunByIdea = new Map<string, string>();

export function createObserverRun(runId: string, ideaId: string, source: "chat" | "retry" | "approval" | "auto"): ObserverRunState {
  const now = Date.now();
  const state: ObserverRunState = {
    runId,
    ideaId,
    status: "BUILDING",
    source,
    createdAt: now,
    updatedAt: now,
  };
  const entry: ObserverRunEntry = {
    state,
    emitter: new EventEmitter(),
    events: [],
  };
  entry.emitter.setMaxListeners(20);
  observerRuns.set(runId, entry);
  latestObserverRunByIdea.set(ideaId, runId);
  return { ...state };
}

export function getObserverRun(runId: string): ObserverRunState | null {
  const entry = observerRuns.get(runId);
  return entry ? { ...entry.state } : null;
}

export function getLatestObserverRun(ideaId: string): ObserverRunState | null {
  const runId = latestObserverRunByIdea.get(ideaId);
  if (!runId) return null;
  return getObserverRun(runId);
}

export function emitObserverProgress(runId: string, message: string): void {
  const entry = observerRuns.get(runId);
  if (!entry) return;
  entry.state.phaseProgress = message;
  entry.state.updatedAt = Date.now();
  emitObserverEvent(runId, { type: "progress", data: { progress: message }, timestamp: Date.now() });
}

export function emitObserverPipelineEvent(runId: string, evt: PipelineProgressEvent): void {
  emitObserverEvent(runId, { type: "pipeline", data: { pipelineEvent: evt }, timestamp: Date.now() });
}

export function emitObserverHeartbeat(runId: string): void {
  emitObserverEvent(runId, { type: "heartbeat", data: { heartbeat: true }, timestamp: Date.now() });
}

export function emitObserverMetaValidation(runId: string, event: any): void {
  emitObserverEvent(runId, { type: "metaValidation", data: { metaValidation: event }, timestamp: Date.now() });
}

export function emitObserverDone(runId: string, payload: any): void {
  const entry = observerRuns.get(runId);
  if (!entry) return;
  if (payload.status) entry.state.status = payload.status as ObserverRunStatus;
  if (payload.warnings) entry.state.warnings = payload.warnings;
  if (payload.templateComplianceScore !== undefined) entry.state.complianceScore = payload.templateComplianceScore;
  if (payload.outcomeSummary) entry.state.outcomeSummary = payload.outcomeSummary;
  entry.state.updatedAt = Date.now();
  emitObserverEvent(runId, { type: "done", data: { done: true, ...payload }, timestamp: Date.now() });
}

export function emitObserverError(runId: string, error: string): void {
  const entry = observerRuns.get(runId);
  if (!entry) return;
  entry.state.status = "FAILED";
  entry.state.error = error;
  entry.state.updatedAt = Date.now();
  emitObserverEvent(runId, { type: "error", data: { status: "FAILED", error }, timestamp: Date.now() });
}

export function cancelObserverRun(runId: string): boolean {
  const entry = observerRuns.get(runId);
  if (!entry) return false;
  if (entry.state.status !== "BUILDING" && entry.state.status !== "PENDING") return false;
  entry.state.status = "CANCELLED";
  entry.state.updatedAt = Date.now();
  emitObserverEvent(runId, { type: "status", data: { status: "CANCELLED" }, timestamp: Date.now() });
  emitObserverEvent(runId, { type: "done", data: { done: true, status: "CANCELLED" }, timestamp: Date.now() });
  return true;
}

export function isObserverRunCancelled(runId: string): boolean {
  const entry = observerRuns.get(runId);
  return entry ? entry.state.status === "CANCELLED" : false;
}

function emitObserverEvent(runId: string, event: ObserverRunEvent): void {
  const entry = observerRuns.get(runId);
  if (!entry) return;
  entry.events.push(event);
  entry.emitter.emit("event", event);
}

export function subscribeToObserverRun(runId: string, onEvent: (event: ObserverRunEvent) => void, replayAll?: boolean): () => void {
  const entry = observerRuns.get(runId);
  if (!entry) {
    onEvent({ type: "error", data: { error: "Run not found" }, timestamp: Date.now() });
    return () => {};
  }

  if (replayAll) {
    for (const evt of entry.events) {
      onEvent(evt);
    }
  }

  const handler = (evt: ObserverRunEvent) => onEvent(evt);
  entry.emitter.on("event", handler);

  return () => {
    entry.emitter.off("event", handler);
  };
}

export function isObserverTerminalStatus(status: ObserverRunStatus): boolean {
  return status === "READY" || status === "READY_WITH_WARNINGS" || status === "FALLBACK_READY" || status === "FAILED" || status === "CANCELLED";
}

export function cleanupOldObserverRuns(): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [runId, entry] of observerRuns) {
    if (isObserverTerminalStatus(entry.state.status) && entry.state.updatedAt < cutoff) {
      entry.emitter.removeAllListeners();
      observerRuns.delete(runId);
    }
  }
}

setInterval(cleanupOldObserverRuns, 30 * 60 * 1000);
