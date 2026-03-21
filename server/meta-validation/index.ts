export {
  calculateConfidenceScore,
  AUTO_ENGAGE_THRESHOLD,
  type ConfidenceScore,
  type ConfidenceScorerInput,
  type ConfidenceSignal,
  type ErrorCategory,
  type EntryWorkflowMetadata,
} from "./confidence-scorer";

export {
  runMetaValidation,
  parseCorrectionResponse,
  type Correction,
  type CorrectionSet,
  type CorrectionConfidence,
} from "./meta-validator";

export {
  applyCorrections,
  type CorrectionApplicationResult,
  type CorrectionDetail,
} from "./correction-applier";

export {
  calculateEstimatedCost,
  recordGenerationMetrics,
  getMetricsSummary,
  getAllMetrics,
  LLM_PRICING,
  type GenerationMetrics,
  type TokenPricing,
} from "./cost-tracker";

export type MetaValidationMode = "Auto" | "Always" | "Off";

export interface MetaValidationResult {
  engaged: boolean;
  mode: MetaValidationMode;
  confidenceScore: number;
  correctionsApplied: number;
  correctionsSkipped: number;
  correctionsFailed: number;
  flatStructureWarnings: number;
  durationMs: number;
  status: "clean" | "fixed" | "warnings" | "skipped";
}
