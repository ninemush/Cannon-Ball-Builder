import { storage } from "../storage";

export interface StageLogEntry {
  stage: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  outcome: "running" | "succeeded" | "failed" | "skipped" | "degraded";
  retryAttempt?: number;
  fallback?: boolean;
  context?: Record<string, unknown>;
  error?: string;
}

export interface RunOutcomeSummary {
  status: "succeeded" | "succeeded_degraded" | "blocked" | "failed";
  totalDurationMs: number;
  stageCount: number;
  degradations?: string[];
  blockReason?: string;
  errorMessage?: string;
}

export class RunLogger {
  private runId: string;
  private runType: string;
  private stages: StageLogEntry[] = [];
  private runStartedAt: number;
  private flushQueued = false;

  constructor(runId: string, runType: string) {
    this.runId = runId;
    this.runType = runType;
    this.runStartedAt = Date.now();
    console.log(`[RunLogger] Run ${runId} (${runType}) started`);
  }

  stageStart(stage: string, context?: Record<string, unknown>): StageLogEntry {
    const entry: StageLogEntry = {
      stage,
      startedAt: new Date().toISOString(),
      outcome: "running",
      context,
    };
    this.stages.push(entry);
    console.log(`[RunLogger] [${this.runId}] Stage "${stage}" started`);
    this.queueFlush();
    return entry;
  }

  stageEnd(stage: string, outcome: StageLogEntry["outcome"], context?: Record<string, unknown>, error?: string): void {
    const entry = this.findRunningStage(stage);
    if (!entry) {
      console.warn(`[RunLogger] [${this.runId}] stageEnd called for "${stage}" but no running entry found`);
      return;
    }
    const now = new Date();
    entry.endedAt = now.toISOString();
    entry.durationMs = now.getTime() - new Date(entry.startedAt).getTime();
    entry.outcome = outcome;
    if (context) entry.context = { ...entry.context, ...context };
    if (error) entry.error = error;
    console.log(`[RunLogger] [${this.runId}] Stage "${stage}" ${outcome} (${entry.durationMs}ms)${error ? ` — ${error}` : ""}`);
    this.queueFlush();
  }

  recordRetry(stage: string, attempt: number, error?: string): void {
    const now = new Date().toISOString();
    const retryEntry: StageLogEntry = {
      stage: `${stage}_retry`,
      startedAt: now,
      endedAt: now,
      durationMs: 0,
      outcome: error ? "failed" : "succeeded",
      retryAttempt: attempt,
      error,
    };
    this.stages.push(retryEntry);
    console.log(`[RunLogger] [${this.runId}] Retry ${attempt} for "${stage}"${error ? `: ${error}` : ""}`);
    this.queueFlush();
  }

  recordFallback(stage: string, reason: string): void {
    const fbEntry: StageLogEntry = {
      stage: `${stage}_fallback`,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: 0,
      outcome: "degraded",
      fallback: true,
      context: { reason },
    };
    this.stages.push(fbEntry);
    console.log(`[RunLogger] [${this.runId}] Fallback for "${stage}": ${reason}`);
    this.queueFlush();
  }

  buildOutcomeSummary(overrides?: Partial<RunOutcomeSummary>): RunOutcomeSummary {
    const totalDurationMs = Date.now() - this.runStartedAt;
    const degradations = this.stages
      .filter((s) => s.outcome === "degraded" || s.fallback)
      .map((s) => s.stage + (s.context?.reason ? `: ${s.context.reason}` : ""));
    const failedStages = this.stages.filter((s) => s.outcome === "failed");

    let status: RunOutcomeSummary["status"] = "succeeded";
    if (failedStages.length > 0) {
      status = "failed";
    } else if (degradations.length > 0) {
      status = "succeeded_degraded";
    }

    return {
      status,
      totalDurationMs,
      stageCount: this.stages.length,
      degradations: degradations.length > 0 ? degradations : undefined,
      errorMessage: failedStages[0]?.error,
      ...overrides,
    };
  }

  getStages(): StageLogEntry[] {
    return [...this.stages];
  }

  async flush(): Promise<void> {
    try {
      await storage.updateGenerationRunStageLog(this.runId, this.stages);
    } catch (err: any) {
      console.warn(`[RunLogger] Failed to persist stage log for ${this.runId}: ${err?.message}`);
    }
  }

  private findRunningStage(stage: string): StageLogEntry | undefined {
    for (let i = this.stages.length - 1; i >= 0; i--) {
      if (this.stages[i].stage === stage && this.stages[i].outcome === "running") {
        return this.stages[i];
      }
    }
    return undefined;
  }

  private queueFlush(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    setTimeout(() => {
      this.flushQueued = false;
      this.flush().catch(() => {});
    }, 2000);
  }
}
