import { storage } from "./storage";

export interface PipelineHealthMetrics {
  id: string;
  timestamp: Date;
  ideaId: string;
  qgRunCount: number;
  postComplianceDefects: number;
  complianceIdempotent: boolean;
  cascadeAmplificationRatio: number;
  stubRatio: number;
  stubCount: number;
  totalWorkflowCount: number;
  dhgAccuracyScore: number;
  studioLoadableCount: number;
  studioBlockedCount: number;
  generationMode: string;
  downgradeCount: number;
  transitiveDependencyIssues: number;
  pipelineDurationMs: number;
  finalStatus: string;
}

interface SerializedHealthMetrics {
  id: string;
  timestamp: string;
  ideaId: string;
  qgRunCount: number;
  postComplianceDefects: number;
  complianceIdempotent: boolean;
  cascadeAmplificationRatio: number;
  stubRatio: number;
  stubCount: number;
  totalWorkflowCount: number;
  dhgAccuracyScore: number;
  studioLoadableCount: number;
  studioBlockedCount: number;
  generationMode: string;
  downgradeCount: number;
  transitiveDependencyIssues: number;
  pipelineDurationMs: number;
  finalStatus: string;
}

export interface ConvergenceReport {
  totalRuns: number;
  recentRuns: number;
  averageQgRunCount: number;
  postComplianceDefectRate: number;
  complianceIdempotencyRate: number;
  averageCascadeAmplification: number;
  averageStubRatio: number;
  zeroStubRunCount: number;
  averageDhgAccuracy: number;
  convergenceReady: boolean;
  consecutiveCleanRuns: number;
  studioLoadabilityRate: number;
  averageTransitiveDependencyIssues: number;
  trend: {
    stubRatios: number[];
    dhgAccuracyScores: number[];
    qgRunCounts: number[];
    cascadeRatios: number[];
  };
}

const HEALTH_DB_KEY = "pipeline_health_metrics";
const MAX_STORED_HEALTH = 500;
const CONVERGENCE_THRESHOLD = 20;

let healthCache: PipelineHealthMetrics[] | null = null;

function serializeHealth(m: PipelineHealthMetrics): SerializedHealthMetrics {
  return { ...m, timestamp: m.timestamp.toISOString() };
}

function deserializeHealth(s: SerializedHealthMetrics): PipelineHealthMetrics {
  return { ...s, timestamp: new Date(s.timestamp) };
}

async function loadHealth(): Promise<PipelineHealthMetrics[]> {
  if (healthCache !== null) return healthCache;
  try {
    const raw = await storage.getAppSetting(HEALTH_DB_KEY);
    if (raw) {
      const parsed: SerializedHealthMetrics[] = JSON.parse(raw);
      healthCache = parsed.map(deserializeHealth);
    } else {
      healthCache = [];
    }
  } catch {
    console.warn("[Pipeline Health] Failed to load metrics from DB, starting fresh");
    healthCache = [];
  }
  return healthCache;
}

async function persistHealth(metrics: PipelineHealthMetrics[]): Promise<void> {
  try {
    const serialized = metrics.map(serializeHealth);
    await storage.setAppSetting(HEALTH_DB_KEY, JSON.stringify(serialized));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Pipeline Health] Failed to persist metrics: ${errMsg}`);
  }
}

export async function recordPipelineHealth(metrics: PipelineHealthMetrics): Promise<void> {
  const store = await loadHealth();
  store.push(metrics);
  if (store.length > MAX_STORED_HEALTH) {
    store.splice(0, store.length - MAX_STORED_HEALTH);
  }
  healthCache = store;
  await persistHealth(store);
  console.log(
    `[Pipeline Health] Recorded: qg_runs=${metrics.qgRunCount}, stub_ratio=${metrics.stubRatio.toFixed(2)}, ` +
    `cascade=${metrics.cascadeAmplificationRatio.toFixed(2)}, dhg_accuracy=${metrics.dhgAccuracyScore.toFixed(2)}, ` +
    `compliance_idempotent=${metrics.complianceIdempotent}, transitive_issues=${metrics.transitiveDependencyIssues}`
  );
}

export async function getConvergenceReport(days: number = 30): Promise<ConvergenceReport> {
  const store = await loadHealth();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = store.filter(m => m.timestamp >= cutoff);

  if (recent.length === 0) {
    return {
      totalRuns: store.length,
      recentRuns: 0,
      averageQgRunCount: 0,
      postComplianceDefectRate: 0,
      complianceIdempotencyRate: 0,
      averageCascadeAmplification: 0,
      averageStubRatio: 0,
      zeroStubRunCount: 0,
      averageDhgAccuracy: 0,
      convergenceReady: false,
      consecutiveCleanRuns: 0,
      studioLoadabilityRate: 0,
      averageTransitiveDependencyIssues: 0,
      trend: { stubRatios: [], dhgAccuracyScores: [], qgRunCounts: [], cascadeRatios: [] },
    };
  }

  const avgQgRuns = recent.reduce((s, m) => s + m.qgRunCount, 0) / recent.length;
  const totalPostDefects = recent.reduce((s, m) => s + m.postComplianceDefects, 0);
  const defectRate = totalPostDefects / recent.length;
  const idempotentCount = recent.filter(m => m.complianceIdempotent).length;
  const idempotencyRate = (idempotentCount / recent.length) * 100;
  const avgCascade = recent.reduce((s, m) => s + m.cascadeAmplificationRatio, 0) / recent.length;
  const avgStubRatio = recent.reduce((s, m) => s + m.stubRatio, 0) / recent.length;
  const zeroStubRuns = recent.filter(m => m.stubRatio === 0).length;
  const avgDhgAccuracy = recent.reduce((s, m) => s + m.dhgAccuracyScore, 0) / recent.length;
  const avgTransitiveIssues = recent.reduce((s, m) => s + m.transitiveDependencyIssues, 0) / recent.length;

  const totalLoadable = recent.reduce((s, m) => s + m.studioLoadableCount, 0);
  const totalWorkflows = recent.reduce((s, m) => s + m.totalWorkflowCount, 0);
  const studioLoadabilityRate = totalWorkflows > 0 ? (totalLoadable / totalWorkflows) * 100 : 0;

  let consecutiveClean = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    if (m.stubRatio === 0 && m.cascadeAmplificationRatio <= 1.0 && m.complianceIdempotent && m.postComplianceDefects === 0) {
      consecutiveClean++;
    } else {
      break;
    }
  }

  const convergenceReady = consecutiveClean >= CONVERGENCE_THRESHOLD;

  const bucketSize = Math.max(1, Math.ceil(recent.length / 10));
  const stubRatios: number[] = [];
  const dhgScores: number[] = [];
  const qgCounts: number[] = [];
  const cascadeRatios: number[] = [];
  for (let i = 0; i < recent.length; i += bucketSize) {
    const bucket = recent.slice(i, i + bucketSize);
    stubRatios.push(bucket.reduce((s, m) => s + m.stubRatio, 0) / bucket.length);
    dhgScores.push(bucket.reduce((s, m) => s + m.dhgAccuracyScore, 0) / bucket.length);
    qgCounts.push(bucket.reduce((s, m) => s + m.qgRunCount, 0) / bucket.length);
    cascadeRatios.push(bucket.reduce((s, m) => s + m.cascadeAmplificationRatio, 0) / bucket.length);
  }

  return {
    totalRuns: store.length,
    recentRuns: recent.length,
    averageQgRunCount: Math.round(avgQgRuns * 100) / 100,
    postComplianceDefectRate: Math.round(defectRate * 1000) / 1000,
    complianceIdempotencyRate: Math.round(idempotencyRate * 10) / 10,
    averageCascadeAmplification: Math.round(avgCascade * 100) / 100,
    averageStubRatio: Math.round(avgStubRatio * 1000) / 1000,
    zeroStubRunCount: zeroStubRuns,
    averageDhgAccuracy: Math.round(avgDhgAccuracy * 100) / 100,
    convergenceReady,
    consecutiveCleanRuns: consecutiveClean,
    studioLoadabilityRate: Math.round(studioLoadabilityRate * 10) / 10,
    averageTransitiveDependencyIssues: Math.round(avgTransitiveIssues * 100) / 100,
    trend: {
      stubRatios,
      dhgAccuracyScores: dhgScores,
      qgRunCounts: qgCounts,
      cascadeRatios,
    },
  };
}

export async function getAllPipelineHealth(): Promise<PipelineHealthMetrics[]> {
  const store = await loadHealth();
  return [...store];
}

export function computePipelineHealthFromResult(
  pipelineResult: {
    generationMode: string;
    usedFallbackStubs: boolean;
    downgrades: Array<{ fromMode: string; toMode: string }>;
    status: string;
    qualityGateResult?: { violations: Array<{ severity: string }> };
    outcomeReport?: {
      remediations: Array<{ level: string; remediationCode: string }>;
      qualityWarnings: Array<{ check: string }>;
      studioCompatibility?: Array<{ level: string }>;
    };
    xamlEntries: Array<{ name: string; content: string }>;
  },
  ideaId: string,
  durationMs: number,
  qgRunCount: number = 1,
  transitiveDependencyIssues: number = 0,
): PipelineHealthMetrics {
  const report = pipelineResult.outcomeReport;
  const totalWorkflows = pipelineResult.xamlEntries.length;
  const stubbedWorkflows = report?.remediations.filter(
    r => r.level === "workflow" || r.remediationCode === "STUB_WORKFLOW_BLOCKING" || r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE"
  ).length ?? 0;
  const stubRatio = totalWorkflows > 0 ? stubbedWorkflows / totalWorkflows : 0;

  const studioCompatibility = report?.studioCompatibility ?? [];
  const studioLoadable = studioCompatibility.filter(sc => sc.level !== "studio-blocked").length;
  const studioBlocked = studioCompatibility.filter(sc => sc.level === "studio-blocked").length;

  const postComplianceDefects = report?.qualityWarnings.filter(
    w => w.check.startsWith("POST_COMPLIANCE_") || w.check === "post-compliance-defect"
  ).length ?? 0;

  const dhgAccuracyScore = computeDhgAccuracy(pipelineResult);

  return {
    id: `health-${ideaId}-${Date.now()}`,
    timestamp: new Date(),
    ideaId,
    qgRunCount,
    postComplianceDefects,
    complianceIdempotent: postComplianceDefects === 0,
    cascadeAmplificationRatio: pipelineResult.downgrades.length > 0 ? 1 + pipelineResult.downgrades.length * 0.5 : 1.0,
    stubRatio,
    stubCount: stubbedWorkflows,
    totalWorkflowCount: totalWorkflows,
    dhgAccuracyScore,
    studioLoadableCount: studioLoadable,
    studioBlockedCount: studioBlocked,
    generationMode: pipelineResult.generationMode,
    downgradeCount: pipelineResult.downgrades.length,
    transitiveDependencyIssues,
    pipelineDurationMs: durationMs,
    finalStatus: pipelineResult.status,
  };
}

function computeDhgAccuracy(pipelineResult: {
  usedFallbackStubs: boolean;
  outcomeReport?: {
    remediations: Array<{ level: string }>;
    studioCompatibility?: Array<{ level: string }>;
    fullyGeneratedFiles?: string[];
  };
  xamlEntries: Array<{ name: string }>;
}): number {
  const report = pipelineResult.outcomeReport;
  if (!report) return 0.5;

  const totalFiles = pipelineResult.xamlEntries.length;
  if (totalFiles === 0) return 0;

  const fullyGenerated = report.fullyGeneratedFiles?.length ?? 0;
  const studioBlocked = report.studioCompatibility?.filter(sc => sc.level === "studio-blocked").length ?? 0;
  const hasStubs = pipelineResult.usedFallbackStubs || report.remediations.some(
    r => r.level === "workflow" || r.level === "activity" || r.level === "sequence"
  );

  let score = fullyGenerated / totalFiles;
  if (studioBlocked > 0) {
    score *= 1 - (studioBlocked / totalFiles) * 0.5;
  }
  if (hasStubs) {
    score = Math.min(score, 0.69);
  }
  return Math.round(score * 100) / 100;
}
