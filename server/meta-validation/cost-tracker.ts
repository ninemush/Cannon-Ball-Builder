import { storage } from "../storage";

export interface TokenPricing {
  inputPer1KTokens: number;
  outputPer1KTokens: number;
}

export const LLM_PRICING: Record<string, TokenPricing> = {
  haiku: { inputPer1KTokens: 0.00025, outputPer1KTokens: 0.00125 },
  sonnet: { inputPer1KTokens: 0.003, outputPer1KTokens: 0.015 },
  opus: { inputPer1KTokens: 0.015, outputPer1KTokens: 0.075 },
  default: { inputPer1KTokens: 0.003, outputPer1KTokens: 0.015 },
};

export interface GenerationMetrics {
  id: string;
  timestamp: Date;
  ideaId: string;
  decompositionTokens: { input: number; output: number };
  assemblyTokens: { input: number; output: number };
  metaValidationTokens: { input: number; output: number };
  totalTokens: { input: number; output: number };
  estimatedCostUsd: number;
  templateComplianceScore: number;
  confidenceScore: number;
  metaValidationEngaged: boolean;
  metaValidationMode: "Auto" | "Always" | "Off";
  correctionsApplied: number;
  finalStatus: string;
}

interface SerializedMetrics {
  id: string;
  timestamp: string;
  ideaId: string;
  decompositionTokens: { input: number; output: number };
  assemblyTokens: { input: number; output: number };
  metaValidationTokens: { input: number; output: number };
  totalTokens: { input: number; output: number };
  estimatedCostUsd: number;
  templateComplianceScore: number;
  confidenceScore: number;
  metaValidationEngaged: boolean;
  metaValidationMode: "Auto" | "Always" | "Off";
  correctionsApplied: number;
  finalStatus: string;
}

const METRICS_DB_KEY = "mv_generation_metrics";
const MAX_STORED_METRICS = 500;

let metricsCache: GenerationMetrics[] | null = null;

function serializeMetrics(m: GenerationMetrics): SerializedMetrics {
  return { ...m, timestamp: m.timestamp.toISOString() };
}

function deserializeMetrics(s: SerializedMetrics): GenerationMetrics {
  return { ...s, timestamp: new Date(s.timestamp) };
}

async function loadMetrics(): Promise<GenerationMetrics[]> {
  if (metricsCache !== null) return metricsCache;
  try {
    const raw = await storage.getAppSetting(METRICS_DB_KEY);
    if (raw) {
      const parsed: SerializedMetrics[] = JSON.parse(raw);
      metricsCache = parsed.map(deserializeMetrics);
    } else {
      metricsCache = [];
    }
  } catch {
    console.warn("[Cost-Tracker] Failed to load metrics from DB, starting fresh");
    metricsCache = [];
  }
  return metricsCache;
}

async function persistMetrics(metrics: GenerationMetrics[]): Promise<void> {
  try {
    const serialized = metrics.map(serializeMetrics);
    await storage.setAppSetting(METRICS_DB_KEY, JSON.stringify(serialized));
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Cost-Tracker] Failed to persist metrics: ${errMsg}`);
  }
}

export function calculateEstimatedCost(
  inputTokens: number,
  outputTokens: number,
  model: string = "default",
): number {
  const pricing = LLM_PRICING[model] || LLM_PRICING.default;
  return (inputTokens / 1000) * pricing.inputPer1KTokens + (outputTokens / 1000) * pricing.outputPer1KTokens;
}

export async function recordGenerationMetrics(metrics: GenerationMetrics): Promise<void> {
  const store = await loadMetrics();
  store.push(metrics);
  if (store.length > MAX_STORED_METRICS) {
    store.splice(0, store.length - MAX_STORED_METRICS);
  }
  metricsCache = store;
  await persistMetrics(store);
}

export async function getMetricsSummary(days: number = 30): Promise<{
  averageCostUsd: number;
  metaValidationEngagementRate: number;
  averageCorrectionsPerValidation: number;
  correctionRate: number;
  correctionsAppliedTotal: number;
  metaValidationsEngagedTotal: number;
  templateComplianceTrend: number[];
  totalGenerations: number;
}> {
  const store = await loadMetrics();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const recent = store.filter((m) => m.timestamp >= cutoff);

  if (recent.length === 0) {
    return {
      averageCostUsd: 0,
      metaValidationEngagementRate: 0,
      averageCorrectionsPerValidation: 0,
      correctionRate: 0,
      correctionsAppliedTotal: 0,
      metaValidationsEngagedTotal: 0,
      templateComplianceTrend: [],
      totalGenerations: 0,
    };
  }

  const totalCost = recent.reduce((sum, m) => sum + m.estimatedCostUsd, 0);
  const engaged = recent.filter((m) => m.metaValidationEngaged);
  const totalCorrections = engaged.reduce((sum, m) => sum + m.correctionsApplied, 0);

  const complianceValues = recent
    .filter((m) => m.templateComplianceScore > 0)
    .map((m) => m.templateComplianceScore);

  const trendBucketSize = Math.max(1, Math.ceil(complianceValues.length / 10));
  const trend: number[] = [];
  for (let i = 0; i < complianceValues.length; i += trendBucketSize) {
    const bucket = complianceValues.slice(i, i + trendBucketSize);
    trend.push(bucket.reduce((s, v) => s + v, 0) / bucket.length);
  }

  const correctionRate = engaged.length > 0 ? totalCorrections / engaged.length : 0;
  console.log(`[Cost-Tracker] Correction rate: ${correctionRate.toFixed(3)} (corrections_applied=${totalCorrections}, meta_validations_engaged=${engaged.length}, total_generations=${recent.length})`);

  return {
    averageCostUsd: totalCost / recent.length,
    metaValidationEngagementRate: engaged.length / recent.length,
    averageCorrectionsPerValidation: engaged.length > 0 ? totalCorrections / engaged.length : 0,
    correctionRate,
    correctionsAppliedTotal: totalCorrections,
    metaValidationsEngagedTotal: engaged.length,
    templateComplianceTrend: trend,
    totalGenerations: recent.length,
  };
}

export async function getAllMetrics(): Promise<GenerationMetrics[]> {
  const store = await loadMetrics();
  return [...store];
}
