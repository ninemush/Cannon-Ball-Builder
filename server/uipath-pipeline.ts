import { createHash } from "crypto";

class RebuildIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RebuildIntegrityError";
  }
}
import AdmZip from "adm-zip";
import { storage } from "./storage";
import { documentStorage } from "./document-storage";
import { processMapStorage } from "./process-map-storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import {
  buildNuGetPackage,
  QualityGateError,
  getAICenterSkills,
  rebuildNupkgWithEntries,
  type BuildResult,
  type GenerationMode,
} from "./uipath-integration";
import { catalogService } from "./catalog/catalog-service";
import type { StudioProfile } from "./catalog/metadata-service";
import { getAdoptionReport, resetLookupCounters } from "./catalog/filtered-schema-lookup";
import { setAssemblyTargetFramework } from "./workflow-tree-assembler";
import {
  normalizeXaml as normalizeXamlCompliance,
  validateXamlContent,
  type XamlGap,
} from "./xaml-generator";
import { generateDhgFromOutcomeReport, summarizeBindPoints, type DhgContext } from "./dhg-generator";
import { runDhgAnalysis, type UpstreamContext, type ProcessStepSummary } from "./xaml/dhg-analyzers";
import { parseArtifactBlockAsObject } from "./lib/artifact-parser";
import type { UiPathPackage, UiPathPackageSpec, UiPathPackageInternal } from "./types/uipath-package";
import { analyzeAndFix, type AnalysisReport } from "./workflow-analyzer";
import { runQualityGate, type QualityGateResult } from "./uipath-quality-gate";
import { calculateTemplateCompliance } from "./catalog/xaml-template-builder";
import {
  calculateConfidenceScore,
  runMetaValidation,
  applyCorrections,
  runDeterministicValidation,
  calculateEstimatedCost,
  recordGenerationMetrics,
  runIterativeLlmCorrection,
  normalizeCliDefectsToQgIssues,
  type MetaValidationMode,
  type MetaValidationResult,
  type ConfidenceScorerInput,
  type GenerationMetrics,
  type EntryWorkflowMetadata,
} from "./meta-validation";
import { classifyComplexity, estimateComplexityFromContext, type ComplexityTier, type ComplexityClassification } from "./complexity-classifier";
import {
  createManifest,
  initializeManifestFromSpec,
  updateManifestEntriesByWorkflow,
  updateManifestEntriesByActivityType,
  markWorkflowStubbed,
  markWorkflowDropped,
  markStepDegraded,
  recordPruningDecision,
  finalizeManifest,
  reconcileManifestWithArtifact,
  type TraceabilityManifest,
  type ManifestEntry,
} from "./traceability-manifest";
import { recordPipelineHealth, computePipelineHealthFromResult } from "./pipeline-health";
import { runFinalArtifactValidation, type FinalQualityReport } from "./final-artifact-validation";
import { flushTrace, getCurrentRunId } from "./llm-trace-collector";

async function periodicTraceFlush(): Promise<void> {
  const runId = getCurrentRunId();
  if (runId) {
    await flushTrace(runId).catch((err: any) => {
      console.warn(`[Pipeline] Periodic trace flush failed: ${err?.message}`);
    });
  }
}

export type { GenerationMode };
export type { ComplexityTier, ComplexityClassification };

export interface MetaValidationEvent {
  status: string;
  correctionsApplied?: number;
  correctionsSkipped?: number;
  correctionsFailed?: number;
  flatStructureWarnings?: number;
  confidenceScore?: number;
  durationMs?: number;
}

/**
 * PackageStatus uses the defect-aware assessed terminal states plus process states.
 *
 * Terminal assessed states:
 * - `studio_stable` — opens in target Studio version with no validation errors/material warnings
 * - `openable_with_warnings` — opens and loads but has minor non-blocking issues
 * - `handoff_only` — artifact generated for inspection/continuation, not deployment-ready
 * - `structurally_invalid` — pipeline completed enough to assess, but artifact is structurally invalid
 *
 * Semantic distinction:
 * - `FAILED` = crash or unrecoverable system/process failure — the pipeline did not complete.
 * - `structurally_invalid` = the pipeline completed enough to assess artifacts, but the generated
 *   automation artifact is structurally invalid.
 *
 * Artifact availability is intentionally decoupled from deployability:
 * - Download/DHG remain available for ALL terminal states.
 * - Only `studio_stable` packages may be deployed to Orchestrator.
 */
export type PackageStatus = "BUILDING" | "studio_stable" | "openable_with_warnings" | "handoff_only" | "structurally_invalid" | "FAILED" | "generation_finished";

export type PipelineEventType = "started" | "heartbeat" | "completed" | "warning" | "failed";

export interface PipelineProgressEvent {
  type: PipelineEventType;
  stage: string;
  message: string;
  elapsed?: number;
  context?: Record<string, any>;
}

export type PipelineProgressCallback = (event: PipelineProgressEvent) => void;

class PipelineStageTracker {
  private startTimes: Map<string, number> = new Map();
  private heartbeatIntervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private activeStage: string | null = null;
  private onProgress: PipelineProgressCallback;

  constructor(onProgress: PipelineProgressCallback) {
    this.onProgress = onProgress;
  }

  start(stage: string, message: string, context?: Record<string, any>) {
    this.activeStage = stage;
    this.startTimes.set(stage, Date.now());
    this.onProgress({ type: "started", stage, message, context });
  }

  heartbeat(stage: string, messageFn: () => string) {
    this.clearHeartbeat(stage);
    const interval = setInterval(() => {
      const startTime = this.startTimes.get(stage);
      const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
      this.onProgress({
        type: "heartbeat",
        stage,
        message: messageFn(),
        elapsed: Math.round(elapsed * 10) / 10,
      });
    }, 3500);
    this.heartbeatIntervals.set(stage, interval);
  }

  complete(stage: string, message: string, context?: Record<string, any>) {
    this.clearHeartbeat(stage);
    const startTime = this.startTimes.get(stage);
    const elapsed = startTime ? (Date.now() - startTime) / 1000 : 0;
    this.onProgress({
      type: "completed",
      stage,
      message,
      elapsed: Math.round(elapsed * 10) / 10,
      context,
    });
  }

  warn(stage: string, message: string, context?: Record<string, any>) {
    this.onProgress({ type: "warning", stage, message, context });
  }

  fail(stage: string, message: string, context?: Record<string, any>) {
    this.clearHeartbeat(stage);
    this.onProgress({ type: "failed", stage, message, context });
  }

  private clearHeartbeat(stage: string) {
    const interval = this.heartbeatIntervals.get(stage);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(stage);
    }
  }

  cleanup() {
    for (const [stage, interval] of this.heartbeatIntervals) {
      clearInterval(interval);
    }
    this.heartbeatIntervals.clear();
  }
}

export interface PipelineWarning {
  code: string;
  message: string;
  stage: string;
  recoverable: boolean;
  affectedFiles?: string[];
}

export interface DowngradeEvent {
  fromMode: GenerationMode;
  toMode: GenerationMode;
  reason: string;
  triggerStage: string;
  timestamp: Date;
}

export type RemediationLevel = "property" | "activity" | "sequence" | "structural-leaf" | "workflow" | "package" | "validation-finding";

export type RemediationCode =
  | "STUB_PROPERTY_BAD_EXPRESSION"
  | "STUB_PROPERTY_MISSING_SELECTOR"
  | "STUB_PROPERTY_UNSUPPORTED_TYPE"
  | "STUB_PROPERTY_INVALID_VALUE"
  | "STUB_ACTIVITY_CATALOG_VIOLATION"
  | "STUB_ACTIVITY_BLOCKED_PATTERN"
  | "STUB_ACTIVITY_OBJECT_OBJECT"
  | "STUB_ACTIVITY_PSEUDO_XAML"
  | "STUB_ACTIVITY_WELLFORMEDNESS"
  | "STUB_ACTIVITY_UNKNOWN"
  | "STUB_ACTIVITY_PROPERTY_ESCALATION"
  | "STUB_SEQUENCE_MULTIPLE_FAILURES"
  | "STUB_SEQUENCE_WELLFORMEDNESS"
  | "STUB_STRUCTURAL_LEAF"
  | "STUB_WORKFLOW_BLOCKING"
  | "STUB_WORKFLOW_GENERATOR_FAILURE"
  | "HALLUCINATED_ACTIVITY_STUBBED"
  | "UNDECLARED_VARIABLE_MANUAL"
  | "INVOKE_ARG_TYPE_MISMATCH"
  | "POST_ASSEMBLY_REPAIR"
  | "ASSIGN_TO_FALLBACK_VARIABLE"
  | "DEGRADED_ACTIVITY_MISSING_PROPERTY";

export type RepairCode =
  | "REPAIR_ALIAS_NORMALIZE"
  | "REPAIR_ENUM_CORRECTION"
  | "REPAIR_CATALOG_PROPERTY_SYNTAX"
  | "REPAIR_CATALOG_PROPERTY_VALUE"
  | "REPAIR_CATALOG_WRAPPER"
  | "REPAIR_LOG_LEVEL_NORMALIZE"
  | "REPAIR_AMPERSAND_ESCAPE"
  | "REPAIR_BARE_ANGLE_ESCAPE"
  | "REPAIR_DUPLICATE_ATTRIBUTE"
  | "REPAIR_TAKESCREENSHOT_STRIP"
  | "REPAIR_XAML_SANITIZE"
  | "REPAIR_UNKNOWN_ACTIVITY_REMOVE"
  | "REPAIR_INVOKE_PATH_FIX"
  | "REPAIR_DEPENDENCY_ADD"
  | "REPAIR_GENERIC"
  | "REPAIR_PLACEHOLDER_CLEANUP"
  | "REPAIR_MIXED_EXPRESSION_SYNTAX";

export interface RemediationEntry {
  level: RemediationLevel;
  file: string;
  remediationCode: RemediationCode;
  originalTag?: string;
  originalDisplayName?: string;
  propertyName?: string;
  reason: string;
  classifiedCheck: string;
  developerAction: string;
  estimatedEffortMinutes: number;
  businessDescription?: string;
  businessRule?: string;
  expectedInputs?: string;
  expectedOutputs?: string;
  inferredType?: string;
}

export interface AutoRepairEntry {
  repairCode: RepairCode;
  file: string;
  description: string;
  developerAction: string;
  estimatedEffortMinutes: number;
}

export interface DowngradeEventEntry {
  file?: string;
  fromMode: string;
  toMode: string;
  triggerReason: string;
  developerAction: string;
  estimatedEffortMinutes: number;
}

export interface QualityWarningEntry {
  file: string;
  check: string;
  detail: string;
  severity: "warning" | "blocking";
  developerAction: string;
  estimatedEffortMinutes: number;
  businessContext?: string;
  stubCategory?: "handoff" | "failure";
}

export const PROPERTY_REMEDIATION_ESCALATION_THRESHOLD = 3;

export interface StructuralPreservationMetrics {
  file: string;
  totalActivities: number;
  preservedActivities: number;
  stubbedActivities: number;
  preservedStructures: string[];
  studioLoadable?: boolean;
  studioLoadableNote?: string;
}

export type StudioCompatibilityLevel = "studio-clean" | "studio-warnings" | "studio-blocked";

export type StubFailureCategory =
  | "xml-wellformedness"
  | "quality-gate-escalation"
  | "type-mismatch"
  | "structural-invalid"
  | "generation-failure"
  | "compliance-failure"
  | "expression-syntax"
  | "undeclared-variable"
  | "unknown-activity"
  | "deprecated-activity"
  | "non-emission-approved-activity"
  | "target-incompatible-activity";

export interface PerWorkflowStudioCompatibility {
  file: string;
  level: StudioCompatibilityLevel;
  blockers: string[];
  failureCategory?: StubFailureCategory;
  failureSummary?: string;
}

export interface PipelineOutcomeReport {
  remediations: RemediationEntry[];
  propertyRemediations: RemediationEntry[];
  autoRepairs: AutoRepairEntry[];
  downgradeEvents: DowngradeEventEntry[];
  qualityWarnings: QualityWarningEntry[];
  fullyGeneratedFiles: string[];
  totalEstimatedEffortMinutes: number;
  structuralPreservationMetrics?: StructuralPreservationMetrics[];
  studioCompatibility?: PerWorkflowStudioCompatibility[];
  propertySerializationTrace?: import("./pipeline-trace-collector").PropertySerializationTraceEntry[];
  invokeContractTrace?: import("./pipeline-trace-collector").InvokeContractTraceEntry[];
  stageHashParity?: import("./pipeline-trace-collector").StageHashParityEntry[];
  preEmissionValidation?: {
    totalActivities: number;
    validActivities: number;
    unknownActivities: number;
    deprecatedActivities: number;
    nonEmissionApprovedActivities: number;
    targetIncompatibleActivities: number;
    strippedProperties: number;
    enumCorrections: number;
    missingRequiredFilled: number;
    commentConversions: number;
    issueCount: number;
  };
  emissionGateViolations?: {
    totalViolations: number;
    stubbed: number;
    corrected: number;
    blocked: number;
    degraded: number;
    details: Array<{
      file: string;
      line?: number;
      type: string;
      detail: string;
      resolution: string;
      containingBlockType?: string;
      containedActivities?: string[];
      isIntegrityFailure?: boolean;
      businessDescription?: string;
      businessRule?: string;
      expectedInputs?: string;
      expectedOutputs?: string;
    }>;
  };
  invokeSerializationFixes?: import("./xaml/invoke-binding-canonicalizer").InvokeSerializationFix[];
  expressionCanonicalizationFixes?: import("./xaml/invoke-binding-canonicalizer").ExpressionCanonicalizationFix[];
  symbolScopeDefects?: import("./xaml/invoke-binding-canonicalizer").SymbolScopeDefect[];
  targetValueCanonicalizationSummary?: string;
  residualExpressionSerializationDefects?: import("./xaml/invoke-binding-canonicalizer").ResidualExpressionSerializationDefect[];
  sentinelReplacements?: import("./xaml/invoke-binding-canonicalizer").SentinelReplacementRecord[];
  unresolvableJsonDefects?: import("./xaml/invoke-binding-canonicalizer").UnresolvableJsonDefect[];
  requiredPropertyBindings?: import("./required-property-enforcer").RequiredPropertyBinding[];
  unresolvedRequiredPropertyDefects?: import("./required-property-enforcer").UnresolvedRequiredPropertyDefect[];
  expressionLoweringFixes?: import("./required-property-enforcer").ExpressionLoweringFix[];
  expressionLoweringFailures?: import("./required-property-enforcer").ExpressionLoweringFailure[];
  requiredPropertyEnforcementSummary?: string;
  preComplianceGuardPassed?: boolean;
  preComplianceGuardViolationCount?: number;
  canonicalizationArchiveParity?: Array<{ file: string; preCanonicalizationHash: string; canonicalizedHash: string; archivedHash: string; identical: boolean; mutated: boolean }>;
  catalogFilterAdoption?: import("./catalog/filtered-schema-lookup").StageAdoptionEntry[];
  preArchiveStructuralDefects?: Array<{ file: string; pattern: string; detail: string }>;
  workflowStatusParity?: import("./workflow-status-classifier").WorkflowStatusParityEntry[];
  _preArchiveClassification?: import("./workflow-status-classifier").WorkflowStatusClassifierResult;
  postClassifierMutationTrace?: import("./workflow-status-classifier").PostClassifierMutationTrace;
  postFreezeMutationTrace?: import("./workflow-status-classifier").PostClassifierMutationTrace;
  workflowAutoWiringDiagnostics?: import("./auto-wiring-diagnostics").WorkflowAutoWiringDiagnostics;
  symbolDiscoveryDiagnostics?: import("./declaration-registry").SymbolDiscoveryDiagnostic[];
  cliValidationMode?: import("./uipath-cli-validator").CliValidationMode;
  cliValidationSummary?: string;
  cliAnalyzerDefectCount?: number;
  cliPackSuccess?: boolean;
  cliProjectType?: import("./uipath-cli-validator").UiPathProjectType;
  traceabilityManifest?: TraceabilityManifest;
  reachabilityPruning?: Array<{ file: string; action: "removed" | "retained"; reason: string }>;
  infrastructureRenameRecords?: Array<{ originalName: string; renamedName: string; reason: string; affectedReferences: string[] }>;
}

export interface PipelineResult {
  packageBuffer: Buffer;
  gaps: XamlGap[];
  usedPackages: string[];
  qualityGateResult?: QualityGateResult;
  dhgContent: string;
  cacheHit?: boolean;
  projectName: string;
  xamlEntries: { name: string; content: string }[];
  dependencyMap: Record<string, string>;
  archiveManifest: string[];
  qualityGateBlocking: boolean;
  qualityGateWarnings: string[];
  generationMode: GenerationMode;
  usedFallbackStubs: boolean;
  referencedMLSkillNames: string[];
  warnings: PipelineWarning[];
  downgrades: DowngradeEvent[];
  usedAIFallback: boolean;
  status: PackageStatus;
  templateComplianceScore?: number;
  metaValidationResult?: MetaValidationResult;
  outcomeReport?: PipelineOutcomeReport;
  finalQualityReport?: FinalQualityReport;
  packageViable: boolean;
  fallbackModeActive?: boolean;
  fallbackModeReason?: string;
  dependencyDiagnostics?: import("./post-emission-dependency-analyzer").DependencyDiagnosticsArtifact;
  dependencyGaps?: Array<{ activityTag: string; fileName: string; detail: string }>;
  ambiguousResolutions?: Array<{ activityTag: string; candidatePackages: string[]; fileName: string }>;
  orphanDependencies?: Array<{ packageId: string; version: string | null; reason: string }>;
  propertySerializationTrace?: import("./pipeline-trace-collector").PropertySerializationTraceEntry[];
  invokeContractTrace?: import("./pipeline-trace-collector").InvokeContractTraceEntry[];
  stageHashParity?: import("./pipeline-trace-collector").StageHashParityEntry[];
  criticalActivityContractDiagnostics?: import("./required-property-diagnostics").RequiredPropertyDiagnosticsResult;
  cliValidationMode?: import("./uipath-cli-validator").CliValidationMode;
  cliValidationResult?: import("./uipath-cli-validator").CliValidationResult;
  traceabilityManifest?: TraceabilityManifest;
}

export interface DhgResult {
  dhgContent: string;
  projectName: string;
  analysisReports: Array<{ fileName: string; report: AnalysisReport }>;
}

export interface IdeaContext {
  idea: NonNullable<Awaited<ReturnType<typeof storage.getIdea>>>;
  sdd: Awaited<ReturnType<typeof documentStorage.getLatestDocument>>;
  pdd: Awaited<ReturnType<typeof documentStorage.getLatestDocument>>;
  mapNodes: any[];
  processEdges: any[];
}


type CachedPipelineResult = PipelineResult & { fingerprint: string };

const pipelineCache = new Map<string, CachedPipelineResult>();
const PIPELINE_CACHE_MAX = 20;

function evictOldestPipelineCacheEntry(): void {
  if (pipelineCache.size >= PIPELINE_CACHE_MAX) {
    const oldest = pipelineCache.keys().next().value;
    if (oldest) {
      pipelineCache.delete(oldest);
      console.log(`[Pipeline Cache] Evicted oldest entry: ${oldest}`);
    }
  }
}

function computeFingerprint(pkg: UiPathPackageSpec, sddContent: string, nodes: any[], edges: any[]): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(pkg));
  hash.update(sddContent);
  hash.update(JSON.stringify(nodes.map((n: any) => ({ id: n.id, name: n.name, type: n.nodeType, description: n.description, system: n.system }))));
  hash.update(JSON.stringify(edges.map((e: any) => ({ source: e.sourceNodeId, target: e.targetNodeId, label: e.label }))));
  return hash.digest("hex").slice(0, 16);
}

function validateArchiveStructure(buffer: Buffer): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!buffer || buffer.length === 0) {
    errors.push("Package buffer is empty");
    return { valid: false, errors };
  }

  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    const entryNames = entries.map(e => e.entryName);

    const hasMainXaml = entryNames.some(n => {
      const basename = n.split("/").pop() || n;
      return basename === "Main.xaml";
    });
    if (!hasMainXaml) {
      errors.push("Archive is missing Main.xaml");
    }

    const hasProjectJson = entryNames.some(n => {
      const basename = n.split("/").pop() || n;
      return basename === "project.json";
    });
    if (!hasProjectJson) {
      errors.push("Archive is missing project.json");
    }
  } catch (err: any) {
    errors.push(`Archive is not a valid ZIP: ${err.message}`);
  }

  return { valid: errors.length === 0, errors };
}

async function loadIdeaContext(ideaId: string): Promise<IdeaContext> {
  const idea = await storage.getIdea(ideaId);
  if (!idea) throw new Error("Idea not found");

  const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
  const pdd = await documentStorage.getLatestDocument(ideaId, "PDD");
  const toBeNodes = await processMapStorage.getNodesByIdeaId(ideaId, "to-be");
  const asIsNodes = await processMapStorage.getNodesByIdeaId(ideaId, "as-is");
  const mapNodes = toBeNodes.length > 0 ? toBeNodes : asIsNodes;
  const mapVariant = toBeNodes.length > 0 ? "to-be" : "as-is";

  let processEdges: any[] = [];
  if (mapNodes.length > 0) {
    processEdges = await processMapStorage.getEdgesByIdeaId(ideaId, mapVariant as "to-be" | "as-is");
  }

  return { idea, sdd, pdd, mapNodes, processEdges };
}

async function extractOrchestratorArtifacts(sddContent: string | undefined, warnings: PipelineWarning[]): Promise<any | null> {
  if (!sddContent) return null;
  try {
    const { parseArtifactsFromSDD, extractArtifactsWithLLM } = await import("./uipath-deploy");
    let artifacts = parseArtifactsFromSDD(sddContent);
    if (!artifacts) {
      console.warn("[Pipeline] No artifact block found in SDD content — attempting LLM extraction as recovery...");
      artifacts = await extractArtifactsWithLLM(sddContent);
      if (artifacts) {
        console.log("[Pipeline] LLM extraction recovery succeeded");
      } else {
        console.error("[Pipeline] LLM extraction recovery failed — no artifacts will be provisioned");
      }
    }
    return artifacts || null;
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    console.warn(`[Pipeline] Artifact extraction failed: ${msg}`);
    warnings.push({
      code: "ARTIFACT_EXTRACTION_FAILED",
      message: `Orchestrator artifact extraction failed: ${msg}`,
      stage: "artifact-extraction",
      recoverable: true,
    });
    return null;
  }
}

function enrichPackageWithContext(
  pkg: UiPathPackageSpec,
  context: IdeaContext,
  orchestratorArtifacts: any | null,
  aiCenterSkills?: any[],
): UiPathPackage {
  const internal: UiPathPackage["internal"] = {};
  if (context.sdd?.content) internal.sddContent = context.sdd.content;
  if (context.idea.automationType) internal.automationType = context.idea.automationType as UiPathPackageInternal["automationType"];
  if (context.mapNodes.length > 0) {
    internal.processNodes = context.mapNodes;
    internal.processEdges = context.processEdges;
  }
  if (orchestratorArtifacts) internal.orchestratorArtifacts = orchestratorArtifacts;
  if (aiCenterSkills) internal.aiCenterSkills = aiCenterSkills;
  const pkgRecord = pkg as Record<string, unknown>;
  if (pkgRecord._specScaffoldMeta) {
    internal.specScaffoldMeta = pkgRecord._specScaffoldMeta as UiPathPackageInternal["specScaffoldMeta"];
    delete pkgRecord._specScaffoldMeta;
  }
  return { ...pkg, internal };
}

export function computeVersion(): string {
  const now = new Date();
  const patch = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  return `1.0.${patch}`;
}

export function findUiPathMessage(messages: any[]): any | null {
  return [...messages].reverse().find((m: any) =>
    (m.role === "assistant" || m.role === "system") && m.content.startsWith("[UIPATH:")
  ) || null;
}

export function parseUiPathPackage(uipathMsg: any): UiPathPackage {
  let jsonStr = uipathMsg.content.slice(8);
  if (jsonStr.endsWith("]")) jsonStr = jsonStr.slice(0, -1);
  const braceEnd = jsonStr.lastIndexOf("}");
  if (braceEnd !== -1) jsonStr = jsonStr.slice(0, braceEnd + 1);
  const parsed = JSON.parse(jsonStr);
  if (!parsed.internal) parsed.internal = {};
  return parsed as UiPathPackage;
}

function buildDhgFromBuildResult(
  pkg: UiPathPackage,
  ctx: IdeaContext,
  buildResult: BuildResult,
  overrideXamlEntries?: { name: string; content: string }[],
  generationMode?: GenerationMode,
  finalQualityReport?: FinalQualityReport,
  emergencyFallbackActive?: boolean,
  emergencyFallbackReason?: string,
  cliValidationResultForDhg?: import("./uipath-cli-validator").CliValidationResult,
  traceabilityManifest?: TraceabilityManifest,
): DhgResult {
  const sddContent = ctx.sdd?.content || "";
  const workflows = pkg.workflows || [];
  const xamlEntries = overrideXamlEntries || buildResult.xamlEntries;

  const effectiveWfNames = xamlEntries.map(e => {
    const baseName = e.name.split("/").pop() || e.name;
    return baseName.replace(/\.xaml$/i, "");
  });

  const analysisReports: Array<{ fileName: string; report: AnalysisReport }> = finalQualityReport
    ? finalQualityReport.analysisReports
    : (() => {
        const reports: Array<{ fileName: string; report: AnalysisReport }> = [];
        for (const entry of xamlEntries) {
          const { report } = analyzeAndFix(entry.content);
          reports.push({ fileName: entry.name, report });
        }
        return reports;
      })();

  const enrichment = pkg.internal?.enrichment || null;
  const useReFramework = enrichment?.useReFramework ?? pkg.internal?.useReFramework ?? false;
  const painPoints = (pkg.internal?.painPoints || []).map((p: { name?: string; description?: string }) => ({
    name: p.name || "",
    description: p.description || "",
  }));

  const extractedArtifacts = pkg.internal?.extractedArtifacts || undefined;
  const projectName = pkg.projectName || ctx.idea.title.replace(/\s+/g, "_");

  let dhgContent = "";

  const effectiveOutcomeReport = finalQualityReport?.outcomeContext || buildResult.outcomeReport;

  if (effectiveOutcomeReport) {
    effectiveOutcomeReport.catalogFilterAdoption = getAdoptionReport();
    const qualityWarningCount = effectiveOutcomeReport.qualityWarnings.length;
    const remediationCount = effectiveOutcomeReport.remediations.length + effectiveOutcomeReport.propertyRemediations.length;

    const plannedWfNames = workflows.map((wf: { name?: string }) => (wf.name || "Workflow").replace(/\s+/g, "_"));
    const archiveWfNames = new Set(effectiveWfNames);

    let entryPointStubbed: boolean;
    let stubCount: number;
    let studioBlockedCount: number;
    let studioLoadableCount: number;

    if (finalQualityReport) {
      entryPointStubbed = finalQualityReport.perFileResults.some(
        r => r.file === "Main.xaml" && (r.studioCompatibilityLevel === "studio-blocked" || r.hasStubContent)
      );
      stubCount = finalQualityReport.perFileResults.filter(r => r.hasStubContent).length;
      studioBlockedCount = finalQualityReport.aggregatedStats.studioBlockedCount;
      studioLoadableCount = Math.max(0, archiveWfNames.size - studioBlockedCount);
    } else {
      const stubRemediations = effectiveOutcomeReport.remediations.filter(r => r.remediationCode === "STUB_WORKFLOW_BLOCKING");
      const stubFileNames = new Set(stubRemediations.map(r => r.file.replace(/\.xaml$/i, "")));
      entryPointStubbed = stubFileNames.has("Main");
      stubCount = stubFileNames.size;
      studioBlockedCount = effectiveOutcomeReport?.studioCompatibility?.filter(
        sc => sc.level === "studio-blocked"
      ).length ?? stubFileNames.size;
      studioLoadableCount = Math.max(0, archiveWfNames.size - studioBlockedCount);
    }

    const plannedButMissingCount = plannedWfNames.filter(n => !archiveWfNames.has(n)).length;
    const stubAwareness = {
      entryPointStubbed,
      stubCount,
      totalWorkflowCount: archiveWfNames.size,
      plannedButMissingCount,
      studioLoadableCount,
      studioBlockedCount,
    };

    const upstreamContext: UpstreamContext = {
      ideaDescription: ctx.idea.description || undefined,
      automationType: ctx.idea.automationType || undefined,
      automationTypeRationale: ctx.idea.automationTypeRationale || undefined,
      feasibilityComplexity: ctx.idea.feasibilityComplexity || undefined,
      feasibilityEffortEstimate: ctx.idea.feasibilityEffortEstimate || undefined,
      qualityWarnings: effectiveOutcomeReport.qualityWarnings.map(w => ({
        code: w.check,
        message: w.detail,
        severity: w.severity,
      })),
    };
    if (ctx.pdd?.content) {
      const pddContent = typeof ctx.pdd.content === "string" ? ctx.pdd.content : "";
      upstreamContext.pddSummary = pddContent.slice(0, 2000) + (pddContent.length > 2000 ? "..." : "");
    }
    if (ctx.sdd?.content) {
      const sddContentStr = typeof ctx.sdd.content === "string" ? ctx.sdd.content : "";
      upstreamContext.sddSummary = sddContentStr.slice(0, 2000) + (sddContentStr.length > 2000 ? "..." : "");
    }

    if (ctx.mapNodes && ctx.mapNodes.length > 0) {
      const toBeNodes = ctx.mapNodes.filter((n: any) => n.viewType === "to-be" || !n.viewType || n.viewType === "as-is");
      upstreamContext.processSteps = toBeNodes.map((n: any): ProcessStepSummary => ({
        name: n.name || "",
        role: n.role || "",
        system: n.system || "",
        nodeType: n.nodeType || "task",
        isPainPoint: !!n.isPainPoint,
        description: n.description || "",
      }));

      upstreamContext.painPoints = ctx.mapNodes
        .filter((n: any) => n.isPainPoint)
        .map((n: any) => `${n.name || "Unnamed step"}${n.description ? ": " + n.description : ""}`);

      const uniqueSystems = [...new Set(
        ctx.mapNodes
          .map((n: any) => (n.system || "").trim())
          .filter((s: string) => s.length > 0),
      )] as string[];
      if (uniqueSystems.length > 0) upstreamContext.systems = uniqueSystems;

      const uniqueRoles = [...new Set(
        ctx.mapNodes
          .map((n: any) => (n.role || "").trim())
          .filter((r: string) => r.length > 0),
      )] as string[];
      if (uniqueRoles.length > 0) upstreamContext.roles = uniqueRoles;

      if (ctx.processEdges && ctx.processEdges.length > 0) {
        const nodeById = new Map<number, any>();
        for (const n of ctx.mapNodes) nodeById.set(n.id, n);

        const decisionNodes = ctx.mapNodes.filter((n: any) =>
          (n.nodeType || "").toLowerCase() === "decision" || (n.nodeType || "").toLowerCase() === "gateway"
        );

        if (decisionNodes.length > 0) {
          const decisionBranches: Array<{ decisionNodeName: string; branches: Array<{ label: string; targetNodeName: string }> }> = [];
          for (const dn of decisionNodes) {
            const outgoing = ctx.processEdges.filter((e: any) => e.sourceNodeId === dn.id);
            if (outgoing.length > 0) {
              decisionBranches.push({
                decisionNodeName: dn.name || "Decision",
                branches: outgoing.map((e: any) => ({
                  label: e.label || "→",
                  targetNodeName: nodeById.get(e.targetNodeId)?.name || `Node ${e.targetNodeId}`,
                })),
              });
            }
          }
          if (decisionBranches.length > 0) upstreamContext.decisionBranches = decisionBranches;
        }
      }
    }

    let sddArtifacts: Record<string, any> | null = null;
    if (ctx.sdd?.content && typeof ctx.sdd.content === "string") {
      sddArtifacts = parseArtifactBlockAsObject(ctx.sdd.content);
    }

    const pipelineEmptyContainerCount = effectiveOutcomeReport.qualityWarnings.filter(
      w => w.check === "empty-container"
    ).length;
    const analysis = runDhgAnalysis(
      xamlEntries,
      buildResult.projectJsonContent || undefined,
      qualityWarningCount,
      remediationCount,
      ctx.idea.automationType || undefined,
      upstreamContext,
      sddArtifacts,
      stubAwareness,
      pipelineEmptyContainerCount,
    );
    analysis.hasBlockedWorkflows = finalQualityReport
      ? finalQualityReport.aggregatedStats.studioBlockedCount > 0
      : (effectiveOutcomeReport?.studioCompatibility?.some(
          sc => sc.level === "studio-blocked"
        ) ?? false);
    const bindPointSummary = summarizeBindPoints(xamlEntries);
    const sddBusinessStepsByWorkflow = computeSddBusinessStepsByWorkflow(
      effectiveWfNames, analysis, effectiveOutcomeReport,
    );
    const dhgContext: DhgContext = {
      projectName,
      workflowNames: effectiveWfNames,
      generationMode: generationMode || undefined,
      analysis,
      finalQualityReport: finalQualityReport || undefined,
      bindPointSummary: bindPointSummary.totalCount > 0 ? bindPointSummary : undefined,
      sddBusinessStepsByWorkflow: sddBusinessStepsByWorkflow.size > 0 ? sddBusinessStepsByWorkflow : undefined,
      emergencyFallbackActive: emergencyFallbackActive || undefined,
      emergencyFallbackReason: emergencyFallbackActive ? emergencyFallbackReason : undefined,
      cliValidationMode: cliValidationResultForDhg?.mode,
      cliProjectType: cliValidationResultForDhg?.compatibility.projectType,
      cliAnalyzerDefectCount: cliValidationResultForDhg?.analyzeResult?.defects.length,
      cliPackSuccess: cliValidationResultForDhg?.packResult?.success,
      traceabilityManifest: traceabilityManifest || undefined,
    };
    dhgContent = generateDhgFromOutcomeReport(effectiveOutcomeReport, dhgContext);
  } else {
    const syntheticReport: PipelineOutcomeReport = {
      remediations: [],
      propertyRemediations: [],
      autoRepairs: [],
      downgradeEvents: [],
      qualityWarnings: [],
      fullyGeneratedFiles: xamlEntries.map(e => {
        const baseName = e.name.split("/").pop() || e.name;
        return baseName;
      }),
      totalEstimatedEffortMinutes: 0,
    };
    const analysis = runDhgAnalysis(
      xamlEntries,
      buildResult.projectJsonContent || undefined,
      0,
      0,
      ctx.idea.automationType || undefined,
    );
    const syntheticBindPoints = summarizeBindPoints(xamlEntries);
    const dhgContext: DhgContext = {
      projectName,
      workflowNames: effectiveWfNames,
      generationMode: generationMode || undefined,
      analysis,
      bindPointSummary: syntheticBindPoints.totalCount > 0 ? syntheticBindPoints : undefined,
      emergencyFallbackActive: emergencyFallbackActive || undefined,
      emergencyFallbackReason: emergencyFallbackActive ? emergencyFallbackReason : undefined,
    };
    dhgContent = generateDhgFromOutcomeReport(syntheticReport, dhgContext);
  }

  return {
    dhgContent,
    projectName: pkg.projectName || ctx.idea.title,
    analysisReports,
  };
}

export interface SpecGenerationResult {
  ctx: IdeaContext;
  enrichedPkg: UiPathPackage;
  fingerprint: string;
  aiSkills: any[];
  artifacts: any | null;
  pipelineWarnings: PipelineWarning[];
  usedAIFallback: boolean;
  emergencyFallbackActive?: boolean;
  emergencyFallbackReason?: string;
  effectiveMode?: GenerationMode;
  traceabilityManifest?: TraceabilityManifest;
}

export async function generateWorkflowSpecs(
  ideaId: string,
  pkg: UiPathPackageSpec,
  options?: {
    generationMode?: GenerationMode;
    onProgress?: (message: string) => void;
    onPipelineProgress?: PipelineProgressCallback;
    preloadedContext?: IdeaContext;
    runId?: string;
    complexityTier?: ComplexityTier;
  },
): Promise<SpecGenerationResult> {
  const requestedMode: GenerationMode | undefined = options?.generationMode;
  if (requestedMode === "baseline_openable") {
    console.warn(`[Pipeline] generateWorkflowSpecs: baseline_openable rejected — only available as emergency fallback, using full_implementation`);
  }
  let mode: GenerationMode = "full_implementation";
  const pipelineWarnings: PipelineWarning[] = [];
  let usedAIFallback = false;

  if (!requestedMode) {
    console.log(`[Pipeline] generateWorkflowSpecs: full_implementation is the default mode (no explicit mode requested)`);
  }

  const noop: PipelineProgressCallback = () => {};
  const tracker = new PipelineStageTracker(options?.onPipelineProgress || noop);
  const emitLegacy = options?.onProgress;

  try {
    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, "spec_generating");
      } catch (e) { /* best-effort */ }
    }

    tracker.start("spec_generation", "Loading context and preparing spec generation");
    tracker.heartbeat("spec_generation", () => "Loading idea, SDD, and process map data");
    const ctx = options?.preloadedContext || await loadIdeaContext(ideaId);
    const artifacts = await extractOrchestratorArtifacts(ctx.sdd?.content, pipelineWarnings);
    tracker.complete("spec_generation", "Context loaded for spec generation", {
      hasSdd: !!ctx.sdd,
      hasPdd: !!ctx.pdd,
      nodeCount: ctx.mapNodes.length,
    });

    const fp = computeFingerprint(pkg, ctx.sdd?.content || "", ctx.mapNodes, ctx.processEdges);

    let emergencyFallbackActive = false;
    let emergencyFallbackReason = "";

    if (mode === "full_implementation" && !catalogService.isLoaded()) {
      emergencyFallbackActive = true;
      emergencyFallbackReason = "Activity catalog failed to load — no activity metadata available";
      mode = "baseline_openable";
      console.warn(`[EMERGENCY FALLBACK] Downgrading to baseline_openable — reason: ${emergencyFallbackReason}`);
      pipelineWarnings.push({
        code: "EMERGENCY_FALLBACK_CATALOG_UNAVAILABLE",
        message: `[EMERGENCY FALLBACK] ${emergencyFallbackReason}`,
        stage: "emergency-fallback",
        recoverable: false,
      });
    }

    if (emitLegacy) emitLegacy(mode === "baseline_openable" ? "Generating baseline Studio-openable package..." : "AI-enriching XAML workflows...");

    let aiSkills: any[] = [];
    if (mode !== "baseline_openable") {
      tracker.start("spec_generation_ai", "Fetching AI Center skills");
      tracker.heartbeat("spec_generation_ai", () => "Checking AI Center availability");
    }
    let aiServiceUnreachable = false;
    try {
      const aiResult = await getAICenterSkills();
      if (aiResult.available) {
        aiSkills = aiResult.skills;
      } else {
        console.warn(`[Pipeline] AI Center skills returned available=false — continuing in full_implementation (not a hard blocker)`);
        pipelineWarnings.push({
          code: "AI_CENTER_SKILLS_UNAVAILABLE",
          message: `AI Center skills not available — continuing without AI skills`,
          stage: "ai-center",
          recoverable: true,
        });
      }
      if (mode !== "baseline_openable") {
        if (!aiResult.available) {
          tracker.warn("spec_generation_ai", `AI Center skills not available — non-blocking`);
          tracker.complete("spec_generation_ai", "Continuing without AI Center skills");
        } else {
          tracker.complete("spec_generation_ai", `${aiSkills.length} AI skill(s) available`, { skillCount: aiSkills.length });
        }
      }
    } catch (err: any) {
      const msg = err?.message || "Unknown error";
      console.warn(`[Pipeline] AI Center skills fetch threw — service unreachable: ${msg}`);
      aiServiceUnreachable = true;
      pipelineWarnings.push({
        code: "AI_CENTER_SERVICE_UNREACHABLE",
        message: `AI enrichment service unreachable after retries: ${msg}`,
        stage: "ai-center",
        recoverable: false,
      });
      if (mode !== "baseline_openable") {
        tracker.warn("spec_generation_ai", `AI enrichment service unreachable: ${msg}`);
        tracker.complete("spec_generation_ai", "Service unreachable — emergency fallback candidate");
      }
    }

    if (!emergencyFallbackActive && mode === "full_implementation" && aiServiceUnreachable) {
      emergencyFallbackActive = true;
      emergencyFallbackReason = "AI enrichment service unreachable after retries";
      mode = "baseline_openable";
      console.warn(`[EMERGENCY FALLBACK] Downgrading to baseline_openable — reason: ${emergencyFallbackReason}`);
      pipelineWarnings.push({
        code: "EMERGENCY_FALLBACK_AI_UNREACHABLE",
        message: `[EMERGENCY FALLBACK] ${emergencyFallbackReason}`,
        stage: "emergency-fallback",
        recoverable: false,
      });
    }

    const enrichedPkg = enrichPackageWithContext(pkg, ctx, artifacts, aiSkills);

    const traceabilityManifest = createManifest();
    if (enrichedPkg.workflows && enrichedPkg.workflows.length > 0) {
      initializeManifestFromSpec(traceabilityManifest, enrichedPkg.workflows.map((w: any) => ({
        name: w.name || "Main",
        steps: (w.rootSequence?.children || []).filter((c: any) => c.kind === "activity").map((c: any) => ({
          activity: c.displayName || c.template || "",
          activityType: c.template || "unknown",
          properties: c.properties || {},
        })),
      })));
      console.log(`[Pipeline] Traceability manifest initialized at decomposition with ${traceabilityManifest.entries.length} step(s) across ${enrichedPkg.workflows.length} workflow(s)`);
    }

    tracker.start("spec_generation_done", "Spec generation complete");
    tracker.complete("spec_generation_done", "WorkflowSpecs ready for XAML emission");
    await periodicTraceFlush();

    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, "spec_ready");
        await storage.updateGenerationRunSpecSnapshot(options.runId, {
          pkg: enrichedPkg,
          fingerprint: fp,
          generationMode: mode,
          timestamp: new Date().toISOString(),
          emergencyFallbackActive,
          emergencyFallbackReason: emergencyFallbackActive ? emergencyFallbackReason : undefined,
        });
      } catch (e) {
        console.warn(`[Pipeline] Failed to persist spec snapshot: ${(e as Error).message}`);
      }
    }

    return {
      ctx,
      enrichedPkg: enrichedPkg,
      fingerprint: fp,
      aiSkills,
      artifacts,
      pipelineWarnings,
      usedAIFallback,
      emergencyFallbackActive,
      emergencyFallbackReason: emergencyFallbackActive ? emergencyFallbackReason : undefined,
      effectiveMode: mode,
      traceabilityManifest,
    };
  } finally {
    tracker.cleanup();
  }
}

export async function compilePackageFromSpecs(
  ideaId: string,
  specResult: SpecGenerationResult,
  pkg: UiPathPackageSpec,
  options?: {
    version?: string;
    generationMode?: GenerationMode;
    onProgress?: (message: string) => void;
    onMetaValidation?: (event: MetaValidationEvent) => void;
    onPipelineProgress?: PipelineProgressCallback;
    metaValidationMode?: MetaValidationMode;
    _accumulatedDowngrades?: DowngradeEvent[];
    _accumulatedWarnings?: PipelineWarning[];
    _priorCompliantWorkflows?: Array<{ name: string; content: string }>;
    runId?: string;
    complexityTier?: ComplexityTier;
    forceRebuild?: boolean;
  },
): Promise<PipelineResult> {
  const ver = options?.version || computeVersion();
  const requestedMode: GenerationMode | undefined = options?.generationMode;
  if (requestedMode === "baseline_openable") {
    console.warn(`[Pipeline] compilePackageFromSpecs: baseline_openable rejected — only available as emergency fallback, using full_implementation`);
  }
  const emergencyFallbackActive = specResult.emergencyFallbackActive || false;
  const emergencyFallbackReason = specResult.emergencyFallbackReason || "";
  const mode: GenerationMode = emergencyFallbackActive
    ? (specResult.effectiveMode || "baseline_openable")
    : "full_implementation";
  const pipelineWarnings: PipelineWarning[] = [
    ...specResult.pipelineWarnings,
    ...(options?._accumulatedWarnings || []),
  ];
  const downgrades: DowngradeEvent[] = options?._accumulatedDowngrades ? [...options._accumulatedDowngrades] : [];
  let usedAIFallback = specResult.usedAIFallback;
  const priorCompliantWorkflows = options?._priorCompliantWorkflows || [];

  if (emergencyFallbackActive) {
    console.warn(`[Pipeline] compilePackageFromSpecs: emergency fallback active — using ${mode} (reason: ${emergencyFallbackReason})`);
  } else if (!requestedMode) {
    console.log(`[Pipeline] compilePackageFromSpecs: full_implementation is the default mode (no explicit mode requested)`);
  }

  try {
    const { discoverNewerLines } = await import("./catalog/metadata-refresher");
    const { metadataService: metaSvc } = await import("./catalog/metadata-service");
    const newerLines = await discoverNewerLines();
    if (newerLines.newerLineAvailable) {
      const studioTarget = metaSvc.getStudioTarget();
      const currentLine = studioTarget?.line || "unknown";
      const LTS_LINES = new Set(["25.10", "24.10", "23.10"]);
      if (!LTS_LINES.has(currentLine)) {
        pipelineWarnings.push({
          code: "CATALOG_VERSION_BEHIND_STUDIO",
          message: `Catalog targets Studio line ${currentLine}, but newer line ${newerLines.newerLineAvailable} (v${newerLines.latestVersion}) is available on NuGet. The generated package may need version updates when opened in a newer Studio.`,
          stage: "version-check",
          recoverable: true,
        });
      }
    }
  } catch (err: any) {
    console.debug(`[Pipeline] Newer-line discovery skipped: ${err?.message || "unknown error"}`);
  }

  const noop: PipelineProgressCallback = () => {};
  const tracker = new PipelineStageTracker(options?.onPipelineProgress || noop);
  const mvMode: MetaValidationMode = options?.metaValidationMode || "Auto";

  const ctx = specResult.ctx;
  const enriched = specResult.enrichedPkg;
  const fp = specResult.fingerprint;

  const traceabilityManifest = specResult.traceabilityManifest || createManifest();
  if (traceabilityManifest.entries.length === 0 && enriched.workflows && enriched.workflows.length > 0) {
    initializeManifestFromSpec(traceabilityManifest, enriched.workflows.map((w: any) => ({
      name: w.name || "Main",
      steps: (w.rootSequence?.children || w.steps || [])
        .filter((c: any) => c.kind === "activity" || c.activity)
        .map((c: any) => ({
          activity: c.displayName || c.activity || "",
          activityType: c.template || c.activityType || "unknown",
          properties: c.properties || {},
        })),
    })));
    console.log(`[Pipeline] Traceability manifest late-initialized with ${traceabilityManifest.entries.length} step(s) across ${enriched.workflows.length} workflow(s)`);
  } else if (traceabilityManifest.entries.length > 0) {
    console.log(`[Pipeline] Traceability manifest carried from decomposition: ${traceabilityManifest.entries.length} step(s)`);
  }

  if (emergencyFallbackActive) {
    if (!enriched.internal) enriched.internal = {};
    enriched.internal.emergencyFallbackActive = true;
    enriched.internal.emergencyFallbackReason = emergencyFallbackReason;
  }

  try {
    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, "compiling");
      } catch (e) { /* best-effort */ }
    }

    tracker.start("xaml_emission", "Assembling XAML workflows");
    const workflowCount = (pkg as any).workflows?.length || 0;
    let currentWorkflowIdx = 0;
    tracker.heartbeat("xaml_emission", () => {
      return `Building workflow ${currentWorkflowIdx + 1} of ${workflowCount || "?"}`;
    });
    let buildResult: BuildResult;
    try {
      const _pipelineProfile = catalogService.getStudioProfile();
      if (options?.forceRebuild) {
        enriched.internal.forceRebuild = true;
      }
      if (priorCompliantWorkflows.length > 0) {
        enriched.internal.priorCompliantWorkflows = priorCompliantWorkflows;
        console.log(`[Pipeline] Passing ${priorCompliantWorkflows.length} prior compliant workflow(s) to build: ${priorCompliantWorkflows.map(w => w.name).join(", ")}`);
      }
      buildResult = await buildNuGetPackage(enriched, ver, ideaId, mode, options?.onPipelineProgress ? (event) => {
        options.onPipelineProgress!(event);
      } : undefined, _pipelineProfile, options?.complexityTier, traceabilityManifest);
    } catch (err) {
      throw err;
    }

    if (buildResult.usedAIFallback) {
      usedAIFallback = true;
    }

    currentWorkflowIdx = workflowCount > 0 ? workflowCount - 1 : 0;
    tracker.complete("xaml_emission", `${buildResult.xamlEntries.length} XAML file(s) assembled`, {
      xamlCount: buildResult.xamlEntries.length,
      cacheHit: buildResult.cacheHit,
    });
    await periodicTraceFlush();

    if (buildResult.emissionGateWarnings) {
      for (const w of buildResult.emissionGateWarnings) {
        pipelineWarnings.push({
          code: w.code,
          message: `[Emission Gate] ${w.file}${w.line ? `:${w.line}` : ""} — ${w.message}`,
          stage: "emission_gate",
          recoverable: true,
        });
        tracker.warn("xaml_emission", `Emission gate warning (${w.type}): ${w.message}`);
      }
    }

    if (buildResult.dependencyWarnings) {
      pipelineWarnings.push(...buildResult.dependencyWarnings);
      for (const w of buildResult.dependencyWarnings) {
        tracker.warn("xaml_emission", w.message);
      }

    }

    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, "validating");
      } catch (e) { /* best-effort */ }
    }

    tracker.start("compliance_normalization", "Validating archive and catalog compliance");
    const archiveValidation = validateArchiveStructure(buildResult.buffer);
    if (!archiveValidation.valid) {
      tracker.warn("compliance_normalization", `Archive validation failed: ${archiveValidation.errors.join("; ")}`);
      const archiveError = `Archive validation failed: ${archiveValidation.errors.join("; ")}`;
      tracker.fail("compliance_normalization", archiveError);
      tracker.cleanup();
      throw new Error(archiveError);
    }

    let templateComplianceScore: number | undefined;
    try {
      if (buildResult.xamlEntries.length > 0) {
        let totalScore = 0;
        let count = 0;
        for (const entry of buildResult.xamlEntries) {
          const compliance = calculateTemplateCompliance(entry.content);
          totalScore += compliance.score;
          count++;
          if (compliance.violations.length > 0) {
            console.log(`[Pipeline] Template compliance for ${entry.name}: ${compliance.score} (${compliance.compliantActivities}/${compliance.totalActivities} compliant, ${compliance.violations.length} violations)`);
          }
        }
        templateComplianceScore = count > 0 ? Math.round((totalScore / count) * 100) / 100 : 1.0;
        const hasStubs = buildResult.usedFallbackStubs || buildResult.outcomeReport?.remediations.some(
          r => r.level === "activity" || r.level === "sequence" || r.level === "structural-leaf" || r.level === "workflow"
        );
        if (hasStubs && templateComplianceScore > 0.69) {
          console.log(`[Pipeline] Capping templateComplianceScore from ${templateComplianceScore} to 0.69 — package contains stubs`);
          templateComplianceScore = 0.69;
        }
        console.log(`[Pipeline] Overall templateComplianceScore: ${templateComplianceScore}`);
      }
    } catch (err: any) {
      console.warn(`[Pipeline] Template compliance calculation failed: ${err.message}`);
      tracker.warn("compliance_normalization", `Template compliance check failed: ${err.message}`);
    }
    tracker.complete("compliance_normalization", "Compliance normalization complete", { templateComplianceScore });
    await periodicTraceFlush();

    const qgResult = buildResult.qualityGateResult;
    const isIncomplete = qgResult ? qgResult.completenessLevel === "incomplete" : false;
    const hasStructuralCatalogErrors = qgResult
      ? qgResult.violations.some((v: any) => v.severity === "error" && (v.check === "CATALOG_STRUCTURAL_VIOLATION" || v.check === "ENUM_VIOLATION"))
      : false;
    const hasMainXamlMissing = qgResult
      ? qgResult.violations.some((v: any) => v.severity === "error" && v.check === "main-xaml")
      : false;
    let qualityGateBlocking = mode === "baseline_openable"
      ? (isIncomplete || hasStructuralCatalogErrors || hasMainXamlMissing)
      : (qgResult ? (!qgResult.passed || isIncomplete) : false);
    let qualityGateWarnings: string[] = qgResult
      ? qgResult.violations
          .filter((v: any) => {
            if (v.severity === "warning") return true;
            if (mode === "baseline_openable" && v.severity === "error") {
              if (isIncomplete) return false;
              if (v.check === "CATALOG_STRUCTURAL_VIOLATION" || v.check === "ENUM_VIOLATION") return false;
              return true;
            }
            return false;
          })
          .map((v: any) => v.detail)
      : [];
    let postCorrectionQualityGate: QualityGateResult | null = null;

    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, "remediating");
      } catch (e) { /* best-effort */ }
    }

    tracker.start("validation", "Running meta-validation and remediation");
    let metaValidationResult: MetaValidationResult | undefined;
    let finalXamlEntries = buildResult.xamlEntries;
    let finalPackageBuffer = buildResult.buffer;
    let mvInputTokens = 0;
    let mvOutputTokens = 0;
    const hasNupkg = buildResult.buffer && buildResult.buffer.length > 0;

    if (hasNupkg) {
      try {
        const mainXamlEntry = buildResult.xamlEntries.find(e => {
          const basename = e.name.split("/").pop() || e.name;
          return basename === "Main.xaml";
        });
        let entryWorkflow: EntryWorkflowMetadata | undefined;
        if (mainXamlEntry) {
          const mainContent = mainXamlEntry.content;
          const invokeCount = (mainContent.match(/InvokeWorkflowFile/g) || []).length;
          const mainActivityCount = (mainContent.match(/<ui:[A-Z]/g) || []).length + (mainContent.match(/<[A-Za-z]+\.[A-Za-z]+/g) || []).length;
          const mainHasReFramework = mainContent.includes("GetTransactionData") || mainContent.includes("SetTransactionStatus") || mainContent.includes("ReFramework");
          const mainHasCatalogViolations = (qgResult?.violations.filter(v => (v.check === "catalog-violation" || v.check === "CATALOG_VIOLATION" || v.check === "CATALOG_STRUCTURAL_VIOLATION") && (v.file === "Main.xaml" || v.file.endsWith("/Main.xaml"))).length || 0) > 0;
          entryWorkflow = {
            isPreviouslyStubbed: buildResult.usedFallbackStubs,
            invokeWorkflowFileCount: invokeCount,
            hasReFramework: mainHasReFramework,
            activityCount: mainActivityCount,
            hasCatalogViolations: mainHasCatalogViolations,
          };
        }

        const scorerInput: ConfidenceScorerInput = {
          workflowCount: buildResult.xamlEntries.length,
          activityCount: buildResult.xamlEntries.reduce((sum, e) => sum + (e.content.match(/<ui:[A-Z]/g)?.length || 0), 0),
          templateComplianceScore,
          catalogViolationCount: qgResult?.violations.filter(v => v.check === "catalog-violation" || v.check === "CATALOG_VIOLATION" || v.check === "CATALOG_STRUCTURAL_VIOLATION").length || 0,
          uncataloguedActivityCount: qgResult?.violations.filter(v => v.check === "uncatalogued-activity").length || 0,
          hasReFramework: buildResult.xamlEntries.some(e => e.name.includes("GetTransactionData") || e.name.includes("SetTransactionStatus")),
          hasDocumentUnderstanding: buildResult.xamlEntries.some(e => e.content.includes("DigitizeDocument") || e.content.includes("ClassifyDocument")),
          hasAICenter: buildResult.xamlEntries.some(e => e.content.includes("MLSkill") || e.content.includes("Predict")),
          priorGenerationHadStubs: buildResult.usedFallbackStubs,
          qualityGateWarningCount: qgResult?.summary.totalWarnings || 0,
          entryWorkflow,
        };

        const confidenceResult = calculateConfidenceScore(scorerInput);

        const fixableCategories = ["ENUM_VIOLATIONS", "NESTED_ARGUMENTS", "LITERAL_EXPRESSIONS", "UNDECLARED_VARIABLES"];
        const fixableDefectCount = qgResult?.violations.filter(v => fixableCategories.includes(v.check)).length || 0;
        const hasFixableDefects = fixableDefectCount > 0;

        const remediations = buildResult.outcomeReport?.remediations || [];
        const degradedFiles = new Set<string>();
        for (const r of remediations) {
          if (r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE") {
            degradedFiles.add(r.file);
          }
        }
        for (const r of remediations) {
          if (r.remediationCode === "DEGRADED_ACTIVITY_MISSING_PROPERTY" && r.file) {
            degradedFiles.add(r.file);
          }
        }
        const reframeworkFileCount = buildResult.xamlEntries.filter(e =>
          e.name.includes("GetTransactionData") || e.name.includes("SetTransactionStatus") ||
          e.name.includes("InitAllSettings") || e.name.includes("InitAllApplications") ||
          e.name.includes("RetryCurrentTransaction") || e.name.includes("CloseAllApplications") ||
          e.name.includes("KillAllProcesses")
        ).length;
        const totalBusinessWorkflows = (buildResult.xamlEntries?.length || 0) - reframeworkFileCount;
        const degradationRatio = totalBusinessWorkflows > 0 ? degradedFiles.size / totalBusinessWorkflows : 0;
        const degradationExceedsThreshold = degradationRatio > 0.6;

        let bypassReason: string | null = null;
        if (!hasFixableDefects) bypassReason = "no_fixable_defects";
        else if (degradationExceedsThreshold) bypassReason = "degradation_threshold_exceeded";
        const shouldBypass = !hasFixableDefects || degradationExceedsThreshold;
        const shouldEngage = mvMode !== "Off" && !shouldBypass && (mvMode === "Always" || (mvMode === "Auto" && confidenceResult.shouldEngage));

        if (shouldBypass && mvMode !== "Off") {
          console.log(`[Pipeline] Meta-validation BYPASSED: ${bypassReason} (fixable=${fixableDefectCount}, degradation=${(degradationRatio * 100).toFixed(0)}%)`);
        }

        options?.onMetaValidation?.({ status: "assessing", confidenceScore: confidenceResult.score });

        if (shouldEngage) {
          options?.onMetaValidation?.({ status: "will-validate", confidenceScore: confidenceResult.score });
          if (options?.onProgress) options.onProgress("Running meta-validation review...");
          console.log(`[Pipeline] Meta-validation engaged (mode=${mvMode}, score=${confidenceResult.score.toFixed(2)}, categories=${confidenceResult.triggeredCategories.join(",")})`);

          options?.onMetaValidation?.({ status: "started" });

          const useLlmMetaValidation = process.env.LLM_META_VALIDATION === "true";
          let correctionSet;
          if (useLlmMetaValidation) {
            console.log(`[Pipeline] LLM_META_VALIDATION=true — using LLM-based meta-validation`);
            correctionSet = await runMetaValidation(
              buildResult.xamlEntries,
              confidenceResult.triggeredCategories,
              options?.onProgress,
            );
          } else {
            console.log(`[Pipeline] Using deterministic meta-validators (${confidenceResult.triggeredCategories.join(",")})`);
            correctionSet = runDeterministicValidation(
              buildResult.xamlEntries,
              confidenceResult.triggeredCategories,
              options?.onProgress,
              "Windows",
            );
          }

          mvInputTokens = correctionSet.inputTokens;
          mvOutputTokens = correctionSet.outputTokens;

          const applicationResult = applyCorrections(buildResult.xamlEntries, correctionSet);
          finalXamlEntries = applicationResult.updatedXamlEntries;

          if (applicationResult.applied > 0) {
            const preCorrectionEntries = buildResult.xamlEntries.map(e => ({ ...e }));
            let revertedCount = 0;
            for (let i = 0; i < finalXamlEntries.length; i++) {
              const entry = finalXamlEntries[i];
              try {
                const { XMLParser } = await import("fast-xml-parser");
                const parser = new XMLParser({ ignoreAttributes: false, allowBooleanAttributes: true, processEntities: false });
                parser.parse(entry.content);
              } catch (xmlErr: any) {
                const original = preCorrectionEntries.find(e => e.name === entry.name);
                if (original) {
                  console.warn(`[Pipeline] Well-formedness check failed for ${entry.name} after corrections: ${xmlErr.message} — reverting to pre-correction version`);
                  finalXamlEntries[i] = { ...original };
                  revertedCount++;
                  pipelineWarnings.push({
                    code: "POST_MV_WELLFORMEDNESS_REVERT",
                    message: `[Post-MV] Reverted ${entry.name} to pre-correction version due to XML well-formedness failure: ${xmlErr.message}`,
                    stage: "remediating",
                    recoverable: true,
                  });
                }
              }
            }
            if (revertedCount > 0) {
              console.log(`[Pipeline] Reverted ${revertedCount} XAML file(s) to pre-correction versions due to well-formedness failures`);
            }
          }

          if (applicationResult.applied > 0 && buildResult.buffer.length > 0) {
            const rebuilt = await rebuildNupkgWithEntries(buildResult.buffer, finalXamlEntries, buildResult.archiveManifest);
            if (rebuilt) {
              finalPackageBuffer = rebuilt;
              console.log(`[Pipeline] Rebuilt .nupkg with ${applicationResult.applied} correction(s) applied (${finalPackageBuffer.length} bytes)`);
            } else {
              const rebuildErrorMsg =
                `Canonical nupkg rebuild failed after ${applicationResult.applied} meta-validation correction(s). ` +
                `Cannot produce a structurally valid package with corrected XAML. ` +
                `Artifact integrity cannot be guaranteed — hard failing to prevent stale artifact delivery.`;
              console.error(`[Pipeline] ${rebuildErrorMsg}`);
              throw new RebuildIntegrityError(rebuildErrorMsg);
            }
          }

          if (applicationResult.applied > 0) {
            try {
              const xamlValidationViolations = validateXamlContent(finalXamlEntries);
              if (xamlValidationViolations.length > 0) {
                console.log(`[Pipeline] Post-correction XAML validation: ${xamlValidationViolations.length} issue(s) found`);
                for (const v of xamlValidationViolations) {
                  pipelineWarnings.push({
                    code: `POST_MV_XAML_${v.check.toUpperCase().replace(/-/g, "_")}`,
                    message: `[Post-MV] ${v.detail}`,
                    stage: "remediating",
                    recoverable: true,
                  });
                }
              }

              const projectJsonContent = buildResult.projectJsonContent || "{}";
              const revalidationResult = runQualityGate({
                xamlEntries: finalXamlEntries,
                projectJsonContent,
                targetFramework: "Windows",
                archiveManifest: buildResult.archiveManifest,
              });

              postCorrectionQualityGate = revalidationResult;
              const revalIncomplete = revalidationResult.completenessLevel === "incomplete";

              if (!revalidationResult.passed) {
                const postFixWarnings = revalidationResult.violations.filter(v => v.severity === "warning");
                const postFixErrors = revalidationResult.violations.filter(v => v.severity === "error");
                qualityGateBlocking = postFixErrors.length > 0 || revalIncomplete;
                qualityGateWarnings = postFixWarnings.map(v => v.detail);
                if (postFixErrors.length > 0) {
                  console.warn(`[Pipeline] Post-correction quality gate found ${postFixErrors.length} error(s)`);
                  for (const e of postFixErrors) {
                    pipelineWarnings.push({
                      code: "POST_MV_QG_ERROR",
                      message: `[Post-MV QG] ${e.detail}`,
                      stage: "remediating",
                      recoverable: false,
                    });
                  }
                }
                if (postFixWarnings.length > 0) {
                  console.log(`[Pipeline] Post-correction quality gate: ${postFixWarnings.length} warning(s) remain`);
                }
              } else {
                qualityGateBlocking = revalIncomplete;
                qualityGateWarnings = [];
                console.log(`[Pipeline] Post-correction quality gate: ${revalIncomplete ? "PASSED but INCOMPLETE — blocking" : "PASSED"}`);
              }
            } catch (qgErr: unknown) {
              const errMsg = qgErr instanceof Error ? qgErr.message : String(qgErr);
              console.warn(`[Pipeline] Post-correction revalidation failed: ${errMsg}`);
            }
          }

          let iterativeLlmApplied = 0;
          let iterativeSkipped = 0;
          let iterativeFailed = 0;
          let preCorrectCliDefectCount = 0;
          let cliDiagnosticOnly: Array<{ ruleId: string; file: string; message: string; severity: string }> = [];
          try {
            if (options?.onProgress) options.onProgress("Running iterative LLM self-correction...");

            const qgViolationsForIterative: Array<{ check: string; file: string; detail: string; severity: string; source?: "internal" | "cli" }> = (postCorrectionQualityGate?.violations || qgResult?.violations || [])
              .filter(v => ["unknown-activity", "deprecated-activity", "non-emission-approved-activity", "target-incompatible-activity", "invalid-activity-property", "undeclared-variable", "expression-syntax"].includes(v.check))
              .map(v => ({ check: v.check, file: v.file, detail: v.detail, severity: v.severity, source: "internal" as const }));

            try {
              const { runCliAnalyze, cliDefectsToHealingInput, checkCliCompatibility } = await import("./uipath-cli-validator");
              const projectJsonForPreCli = buildResult.projectJsonContent || "{}";
              const preCliCompat = checkCliCompatibility(projectJsonForPreCli);

              if (preCliCompat.isCompatible) {
                if (options?.onProgress) options.onProgress("Running pre-correction CLI analysis...");
                const preCliStart = Date.now();
                const preCliResult = await runCliAnalyze(projectJsonForPreCli, finalXamlEntries);
                const preCliDuration = Date.now() - preCliStart;

                if (preCliResult.defects.length > 0) {
                  preCorrectCliDefectCount = preCliResult.defects.length;
                  preCorrectCliDefectCount_outer = preCliResult.defects.length;
                  const healingInput = cliDefectsToHealingInput(preCliResult.defects);
                  const normalized = normalizeCliDefectsToQgIssues(healingInput);

                  if (normalized.fixable.length > 0) {
                    qgViolationsForIterative.push(...normalized.fixable);
                    console.log(`[Pipeline] Pre-correction CLI analyze: ${preCliResult.defects.length} defect(s) found, ${normalized.fixable.length} fixable merged into corrector input, ${normalized.diagnosticOnly.length} diagnostic-only (${preCliDuration}ms)`);
                  } else {
                    console.log(`[Pipeline] Pre-correction CLI analyze: ${preCliResult.defects.length} defect(s) found, none fixable (${preCliDuration}ms)`);
                  }
                  cliDiagnosticOnly = normalized.diagnosticOnly;

                  for (const diag of normalized.diagnosticOnly) {
                    pipelineWarnings.push({
                      code: `CLI_DIAGNOSTIC_${diag.severity.toUpperCase()}`,
                      message: `[CLI Diagnostic] ${diag.ruleId}: ${diag.message}${diag.file ? ` in ${diag.file}` : ""}`,
                      stage: "remediating",
                      recoverable: true,
                    });
                  }
                } else {
                  console.log(`[Pipeline] Pre-correction CLI analyze: no defects found (${preCliDuration}ms)`);
                }
              }
            } catch (preCliErr: unknown) {
              const errMsg = preCliErr instanceof Error ? preCliErr.message : String(preCliErr);
              console.warn(`[Pipeline] Pre-correction CLI analyze failed gracefully: ${errMsg}`);
            }

            const workflowSpecs = enriched.workflows?.map((w: any) => ({
              name: w.name,
              description: w.description,
              steps: w.steps?.map((s: any) => ({
                activity: s.activity,
                activityType: s.activityType,
                activityPackage: s.activityPackage,
                properties: s.properties,
              })),
              variables: w.variables?.map((v: any) => ({
                name: v.name,
                type: v.type,
              })),
            })) || [];

            const iterativeProjectContext = {
              projectJsonContent: buildResult.projectJsonContent || "{}",
              targetFramework: ("Windows" as const),
              archiveManifest: buildResult.archiveManifest,
            };

            const iterativeResult = await runIterativeLlmCorrection(
              finalXamlEntries,
              options?.onProgress,
              qgViolationsForIterative,
              workflowSpecs,
              iterativeProjectContext,
            );

            iterativeSkipped = iterativeResult.totalCorrectionsSkipped;
            iterativeFailed = iterativeResult.totalCorrectionsFailed;

            if (iterativeResult.totalCorrectionsApplied > 0) {
              finalXamlEntries = iterativeResult.updatedXamlEntries;
              iterativeLlmApplied = iterativeResult.totalCorrectionsApplied;
              mvInputTokens += iterativeResult.llmInputTokens;
              mvOutputTokens += iterativeResult.llmOutputTokens;
              console.log(
                `[Pipeline] Iterative LLM correction: ${iterativeResult.totalRounds} round(s), ${iterativeResult.totalCorrectionsApplied} verified fixes, ${iterativeResult.remainingIssueCount} remaining (${iterativeResult.durationMs}ms)`,
              );

              if (buildResult.buffer.length > 0) {
                const rebuilt = await rebuildNupkgWithEntries(buildResult.buffer, finalXamlEntries, buildResult.archiveManifest);
                if (rebuilt) {
                  finalPackageBuffer = rebuilt;
                  console.log(`[Pipeline] Rebuilt .nupkg after iterative LLM correction (${finalPackageBuffer.length} bytes)`);
                } else {
                  const iterativeRebuildError =
                    `Iterative LLM corrections applied but .nupkg rebuild failed — ` +
                    `artifact integrity cannot be guaranteed. Hard failing to prevent stale artifact delivery.`;
                  console.error(`[Pipeline] ${iterativeRebuildError}`);
                  throw new RebuildIntegrityError(iterativeRebuildError);
                }
              }

              try {
                const postIterativeQg = runQualityGate({
                  xamlEntries: finalXamlEntries,
                  projectJsonContent: buildResult.projectJsonContent || "{}",
                  targetFramework: "Windows",
                  archiveManifest: buildResult.archiveManifest,
                });
                postCorrectionQualityGate = postIterativeQg;
                const postIterErrors = postIterativeQg.violations.filter(v => v.severity === "error");
                const postIterWarnings = postIterativeQg.violations.filter(v => v.severity === "warning");
                qualityGateBlocking = postIterErrors.length > 0 || postIterativeQg.completenessLevel === "incomplete";
                qualityGateWarnings = postIterWarnings.map(v => v.detail);
                console.log(`[Pipeline] Post-iterative quality gate: ${postIterErrors.length} error(s), ${postIterWarnings.length} warning(s), blocking=${qualityGateBlocking}`);
              } catch (qgErr: unknown) {
                const errMsg = qgErr instanceof Error ? qgErr.message : String(qgErr);
                console.warn(`[Pipeline] Post-iterative quality gate revalidation failed: ${errMsg}`);
              }
            } else {
              console.log(`[Pipeline] Iterative LLM correction: no additional fixes needed`);
            }

            if (iterativeResult.remainingIssueCount > 0) {
              pipelineWarnings.push({
                code: "ITERATIVE_LLM_REMAINING_ISSUES",
                message: `${iterativeResult.remainingIssueCount} fragile defect(s) remain after iterative LLM correction (unknown-activity, invalid-activity-property, ENUM_VIOLATIONS, LITERAL_EXPRESSIONS, UNDECLARED_VARIABLES, MISSING_PROPERTIES, NESTED_ARGUMENTS, cli-namespace-error, cli-argument-error, cli-variable-error, cli-expression-error)`,
                stage: "remediating",
                recoverable: true,
              });
            }

            if (preCorrectCliDefectCount > 0) {
              console.log(`[Pipeline] CLI defect metrics: pre-correction=${preCorrectCliDefectCount}, diagnostic-only=${cliDiagnosticOnly.length}`);
            }
          } catch (iterErr: unknown) {
            if (iterErr instanceof RebuildIntegrityError) throw iterErr;
            const errMsg = iterErr instanceof Error ? iterErr.message : String(iterErr);
            console.warn(`[Pipeline] Iterative LLM correction failed: ${errMsg}`);
            pipelineWarnings.push({
              code: "ITERATIVE_LLM_CORRECTION_FAILED",
              message: `Iterative LLM self-correction failed: ${errMsg}`,
              stage: "remediating",
              recoverable: true,
            });
          }

          if (applicationResult.flatStructureWarnings > 0) {
            pipelineWarnings.push({
              code: "META_VALIDATION_FLAT_STRUCTURE",
              message: `${applicationResult.flatStructureWarnings} FLAT_STRUCTURE issue(s) detected — manual review recommended`,
              stage: "remediating",
              recoverable: true,
            });
          }

          const totalCorrectionsApplied = applicationResult.applied + iterativeLlmApplied;
          const mvStatus = totalCorrectionsApplied > 0
            ? "fixed"
            : applicationResult.flatStructureWarnings > 0
              ? "warnings"
              : "clean";

          const totalSkipped = applicationResult.skipped + iterativeSkipped;
          const totalFailed = applicationResult.failed + iterativeFailed;

          metaValidationResult = {
            engaged: true,
            mode: mvMode,
            confidenceScore: confidenceResult.score,
            correctionsApplied: totalCorrectionsApplied,
            correctionsSkipped: totalSkipped,
            correctionsFailed: totalFailed,
            flatStructureWarnings: applicationResult.flatStructureWarnings,
            durationMs: applicationResult.durationMs + correctionSet.reviewDurationMs,
            status: mvStatus,
          };

          console.log(`[Pipeline] Meta-validation complete: ${totalCorrectionsApplied} applied (${applicationResult.applied} deterministic + ${iterativeLlmApplied} iterative-LLM), ${totalSkipped} skipped (${applicationResult.skipped} det + ${iterativeSkipped} iter), ${totalFailed} failed (${applicationResult.failed} det + ${iterativeFailed} iter) (${metaValidationResult.durationMs}ms) | corrections_applied=${totalCorrectionsApplied}, meta_validations_engaged=1`);

          const completionEvent: MetaValidationEvent = {
            status: mvStatus === "fixed" ? "completed" : mvStatus === "warnings" ? "warning" : "completed",
            correctionsApplied: totalCorrectionsApplied,
            correctionsSkipped: totalSkipped,
            correctionsFailed: totalFailed,
            flatStructureWarnings: applicationResult.flatStructureWarnings,
            confidenceScore: confidenceResult.score,
            durationMs: metaValidationResult.durationMs,
          };

          if (totalSkipped > 0 && mvStatus !== "warnings") {
            completionEvent.status = "warning";
          }

          options?.onMetaValidation?.(completionEvent);
        } else {
          const mvSkipStatus = (shouldBypass && mvMode !== "Off") ? "bypassed" : "skipped";
          options?.onMetaValidation?.({ status: "not-needed", confidenceScore: confidenceResult.score, durationMs: 0 });
          metaValidationResult = {
            engaged: false,
            mode: mvMode,
            confidenceScore: confidenceResult.score,
            correctionsApplied: 0,
            correctionsSkipped: 0,
            correctionsFailed: 0,
            flatStructureWarnings: 0,
            durationMs: 0,
            status: mvSkipStatus,
            ...(bypassReason ? { bypassReason } : {}),
          };
          console.log(`[Pipeline] Meta-validation ${mvSkipStatus} (mode=${mvMode}, score=${confidenceResult.score.toFixed(2)}${bypassReason ? `, bypass=${bypassReason}` : ""})`);
        }
      } catch (err: unknown) {
        if (err instanceof RebuildIntegrityError) throw err;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[Pipeline] Meta-validation failed: ${errMsg}`);
        pipelineWarnings.push({
          code: "META_VALIDATION_FAILED",
          message: `Meta-validation review failed: ${errMsg}`,
          stage: "remediating",
          recoverable: true,
        });
      }
    }
    tracker.complete("validation", "Validation and remediation complete");
    await periodicTraceFlush();

    let preCorrectCliDefectCount_outer = 0;
    let cliValidationResult: import("./uipath-cli-validator").CliValidationResult | undefined;
    try {
      tracker.start("cli_validation", "Running UiPath CLI authoritative validation");
      const { runCliValidation, checkCliCompatibility, formatCliValidationSummary } = await import("./uipath-cli-validator");

      const projectJsonForCli = buildResult.projectJsonContent || "{}";
      const cliCompat = checkCliCompatibility(projectJsonForCli);

      if (!cliCompat.isCompatible) {
        console.log(`[Pipeline] CLI validation skipped: ${cliCompat.reason}`);
        cliValidationResult = {
          mode: "cli_skipped_incompatible_agent",
          compatibility: cliCompat,
          dotnetAvailable: false,
          cliAvailable: false,
          durationMs: 0,
        };
        tracker.complete("cli_validation", `CLI validation skipped: incompatible agent for ${cliCompat.projectType} project`, {
          mode: "cli_skipped_incompatible_agent",
          projectType: cliCompat.projectType,
        });
      } else {
        cliValidationResult = await runCliValidation(projectJsonForCli, finalXamlEntries, options?.onProgress);
        const summary = formatCliValidationSummary(cliValidationResult);
        console.log(`[Pipeline] CLI validation result:\n${summary}`);

        if (cliValidationResult.mode === "cli_validated") {
          tracker.complete("cli_validation", `CLI validation passed (${cliValidationResult.compatibility.projectType})`, {
            mode: "cli_validated",
            projectType: cliValidationResult.compatibility.projectType,
            analyzerDefects: cliValidationResult.analyzeResult?.defects.length || 0,
          });
        } else if (cliValidationResult.mode === "cli_failed") {
          const defectCount = cliValidationResult.analyzeResult?.defects.length || 0;
          tracker.warn("cli_validation", `CLI validation failed: ${defectCount} defect(s) found`);

          if (cliValidationResult.analyzeResult && cliValidationResult.analyzeResult.defects.length > 0) {
            for (const defect of cliValidationResult.analyzeResult.defects.slice(0, 10)) {
              pipelineWarnings.push({
                code: `CLI_ANALYZER_${defect.severity.toUpperCase()}`,
                message: `[CLI Analyzer] ${defect.ruleId}: ${defect.message}${defect.file ? ` in ${defect.file}` : ""}`,
                stage: "cli_validation",
                recoverable: defect.severity !== "Error",
                affectedFiles: defect.file ? [defect.file] : undefined,
              });
            }
          }

          if (cliValidationResult.packResult && !cliValidationResult.packResult.success) {
            for (const err of cliValidationResult.packResult.errors.slice(0, 5)) {
              pipelineWarnings.push({
                code: "CLI_PACK_ERROR",
                message: `[CLI Pack] ${err}`,
                stage: "cli_validation",
                recoverable: false,
              });
            }
          }

          tracker.complete("cli_validation", `CLI validation failed — ${defectCount} analyzer defect(s)`, {
            mode: "cli_failed",
            projectType: cliValidationResult.compatibility.projectType,
            analyzerDefects: defectCount,
          });
        } else {
          tracker.complete("cli_validation", `CLI validation: ${cliValidationResult.mode}`, {
            mode: cliValidationResult.mode,
            projectType: cliValidationResult.compatibility.projectType,
          });
        }

        const postCorrectionCliDefectCount = cliValidationResult.analyzeResult?.defects.length || 0;
        if (preCorrectCliDefectCount_outer > 0 || postCorrectionCliDefectCount > 0) {
          console.log(`[Pipeline] CLI defect delta: pre-correction=${preCorrectCliDefectCount_outer}, post-correction=${postCorrectionCliDefectCount}, delta=${preCorrectCliDefectCount_outer - postCorrectionCliDefectCount}`);
        }
      }
    } catch (cliErr: unknown) {
      const errMsg = cliErr instanceof Error ? cliErr.message : String(cliErr);
      console.warn(`[Pipeline] CLI validation failed gracefully: ${errMsg}`);
      pipelineWarnings.push({
        code: "CLI_VALIDATION_UNAVAILABLE",
        message: `CLI validation unavailable: ${errMsg}`,
        stage: "cli_validation",
        recoverable: true,
      });
      tracker.complete("cli_validation", "CLI validation unavailable — falling back to custom validation");
    }

    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, "packaging");
      } catch (e) { /* best-effort */ }
    }

    tracker.start("packaging_dhg", "Building .nupkg archive");
    if (hasNupkg) {
      tracker.complete("packaging_dhg", `Package built (${Math.round(finalPackageBuffer.length / 1024)}KB)`, {
        sizeBytes: finalPackageBuffer.length,
      });
    } else {
      tracker.fail("packaging_dhg", "Package build produced no output");
    }

    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, "dhg_generating");
      } catch (e) { /* best-effort */ }
    }

    if (buildResult.outcomeReport && cliValidationResult) {
      buildResult.outcomeReport.cliValidationMode = cliValidationResult.mode;
      buildResult.outcomeReport.cliProjectType = cliValidationResult.compatibility.projectType;
      buildResult.outcomeReport.cliAnalyzerDefectCount = cliValidationResult.analyzeResult?.defects.length;
      buildResult.outcomeReport.cliPackSuccess = cliValidationResult.packResult?.success;
      const { formatCliValidationSummary: fmtSummary } = await import("./uipath-cli-validator");
      buildResult.outcomeReport.cliValidationSummary = fmtSummary(cliValidationResult);
    }

    tracker.start("final_artifact_validation", "Running final artifact truth gate");
    let finalQualityReport: FinalQualityReport | undefined;
    try {
      finalQualityReport = runFinalArtifactValidation({
        xamlEntries: finalXamlEntries,
        projectJsonContent: buildResult.projectJsonContent || "{}",
        targetFramework: "Windows",
        archiveManifest: buildResult.archiveManifest,
        archiveContentHashes: {},
        hasNupkg,
        preEmissionLoweringDiagnostics: buildResult.preEmissionLoweringDiagnostics,
        assemblerDriftViolations: buildResult.crossFamilyDriftViolations,
        preEmissionMailFamilyLockDiagnostics: buildResult.preEmissionMailFamilyLockDiagnostics,
        contextMetadata: {
          downgrades,
          usedAIFallback,
          pipelineWarnings,
          metaValidationFlatStructureWarnings: metaValidationResult?.flatStructureWarnings,
          outcomeReport: buildResult.outcomeReport,
        },
      });
      console.log(`[Pipeline] Final artifact validation: status=${finalQualityReport.derivedStatus}, reason="${finalQualityReport.statusReason}", files=${finalQualityReport.aggregatedStats.totalFiles}, errors=${finalQualityReport.aggregatedStats.totalErrors}, warnings=${finalQualityReport.aggregatedStats.totalWarnings}`);
      tracker.complete("final_artifact_validation", `Final validation: ${finalQualityReport.derivedStatus}`, {
        status: finalQualityReport.derivedStatus,
        totalFiles: finalQualityReport.aggregatedStats.totalFiles,
        studioBlocked: finalQualityReport.aggregatedStats.studioBlockedCount,
        studioWarnings: finalQualityReport.aggregatedStats.studioWarningsCount,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Pipeline] Final artifact validation failed: ${errMsg}`);
      tracker.warn("final_artifact_validation", `Validation error: ${errMsg}`);
      tracker.complete("final_artifact_validation", "Final validation fell back to intermediate signals");
    }

    if (buildResult.outcomeReport) {
      const remediations = buildResult.outcomeReport.remediations || [];
      for (const r of remediations) {
        const wfName = (r.file || "").replace(/\.xaml$/i, "");
        if (r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE" || r.remediationCode === "STUB_WORKFLOW_BLOCKING") {
          markWorkflowStubbed(traceabilityManifest, wfName, r.reason || r.remediationCode);
        } else if (r.level === "activity" && r.remediationCode === "DEGRADED_ACTIVITY_MISSING_PROPERTY") {
          const actTag = r.originalTag || "";
          if (actTag) {
            updateManifestEntriesByActivityType(traceabilityManifest, wfName, actTag, {
              status: "degraded",
              reason: r.reason || "Activity degraded due to missing property",
              developerAction: `Review degraded ${actTag} activity in ${wfName}.xaml and add missing properties`,
            });
          } else {
            const matchedEntry = traceabilityManifest.entries.find(
              e => e.assignedWorkflow === wfName &&
                   e.status === "preserved" &&
                   r.originalDisplayName &&
                   e.assignedActivity === r.originalDisplayName
            );
            if (matchedEntry) {
              matchedEntry.status = "degraded";
              matchedEntry.reason = r.reason || "Activity degraded due to missing property";
              matchedEntry.developerAction = `Review degraded activity "${r.originalDisplayName}" in ${wfName}.xaml and add missing properties`;
            } else {
              updateManifestEntriesByWorkflow(traceabilityManifest, wfName, {
                status: "degraded",
                reason: r.reason || "Activity degraded due to missing property",
                developerAction: `Review degraded activity in ${wfName}.xaml and add missing properties`,
              });
            }
          }
        }
      }
      buildResult.outcomeReport.traceabilityManifest = traceabilityManifest;

      const pruning = buildResult.outcomeReport.reachabilityPruning || [];
      for (const p of pruning) {
        const wfName = p.file.replace(/\.xaml$/i, "");
        if (p.action === "removed") {
          markWorkflowDropped(traceabilityManifest, wfName, `Pruned: ${p.reason}`);
        } else if (p.action === "retained") {
          updateManifestEntriesByWorkflow(traceabilityManifest, wfName, {
            status: "degraded",
            reason: `Unreachable but retained: ${p.reason}`,
            developerAction: `Wire "${wfName}.xaml" into the invocation graph or remove if unnecessary`,
          });
        }
      }
    }

    reconcileManifestWithArtifact(traceabilityManifest, finalXamlEntries);

    finalizeManifest(traceabilityManifest);
    const manifestSummary = {
      total: traceabilityManifest.entries.length,
      preserved: traceabilityManifest.entries.filter(e => e.status === "preserved").length,
      stubbed: traceabilityManifest.entries.filter(e => e.status === "stubbed").length,
      degraded: traceabilityManifest.entries.filter(e => e.status === "degraded").length,
      dropped: traceabilityManifest.entries.filter(e => e.status === "dropped").length,
    };
    console.log(`[Pipeline] Traceability manifest reconciled and finalized: ${manifestSummary.total} steps — ${manifestSummary.preserved} preserved, ${manifestSummary.stubbed} stubbed, ${manifestSummary.degraded} degraded, ${manifestSummary.dropped} dropped`);

    tracker.start("packaging_dhg_guide", "Generating Developer Handoff Guide");
    tracker.heartbeat("packaging_dhg_guide", () => "Analyzing workflows and writing guide");
    const dhgResult = buildDhgFromBuildResult(enriched, ctx, buildResult, finalXamlEntries, mode, finalQualityReport, emergencyFallbackActive, emergencyFallbackReason, cliValidationResult, traceabilityManifest);
    tracker.complete("packaging_dhg_guide", "Handoff Guide generated", {
      analysisCount: dhgResult.analysisReports.length,
    });

    if (pipelineWarnings.length > 0) {
      for (const w of pipelineWarnings) {
        tracker.warn(w.stage, w.message);
      }
    }

    /**
     * Fallback status derivation when final-artifact-validation did not run.
     * Without final validation evidence, the highest possible status is `handoff_only`.
     * `studio_stable` can only be assigned by passing final artifact validation.
     * `generation_finished` is transient and never emitted as a final status.
     */
    const finalStatus: PackageStatus = finalQualityReport
      ? finalQualityReport.derivedStatus
      : (() => {
          const entryPointIsStubbed = buildResult.outcomeReport?.remediations.some(
            r => (r.remediationCode === "STUB_WORKFLOW_BLOCKING" || r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE") && (r.file === "Main.xaml" || r.file === "Main")
          ) ?? false;
          const hasStructuralBlockers = buildResult.outcomeReport?.studioCompatibility?.some(
            sc => sc.level === "studio-blocked"
          ) ?? false;
          if (!hasNupkg || entryPointIsStubbed || hasStructuralBlockers) return "structurally_invalid" as PackageStatus;
          return "handoff_only" as PackageStatus;
        })();

    if (options?.runId) {
      try {
        await storage.updateGenerationRunStatus(options.runId, finalStatus === "FAILED" ? "failed" : finalStatus);
      } catch (e) { /* best-effort */ }
    }

    tracker.start("complete", "Finalizing pipeline");
    tracker.complete("complete", `Pipeline complete — ${finalStatus}`, {
      status: finalStatus,
      workflowCount: buildResult.xamlEntries.length,
      warningCount: pipelineWarnings.length,
      downgradeCount: downgrades.length,
      usedAIFallback,
      templateComplianceScore,
    });

    const packageViable = finalQualityReport
      ? finalQualityReport.packageViable
      : false;

    if (!finalQualityReport) {
      console.warn(`[Pipeline] Final quality report unavailable — package viability fails closed (packageViable=false)`);
    }

    if (!packageViable) {
      if (dhgResult.dhgContent) {
        console.log(`[Pipeline] Package not viable due to completeness violations — DHG remains available for developer handoff`);
      }
      console.log(`[Pipeline] Package buffer suppressed: completeness violations prevent viable package archive`);
    }

    if (finalQualityReport) {
      finalQualityReport.cliValidationMode = cliValidationResult?.mode || "custom_validated_only";
      if (cliValidationResult) {
        const analyzerDefects = cliValidationResult.analyzeResult?.defects || [];
        finalQualityReport.cliValidationDetails = {
          projectType: cliValidationResult.compatibility.projectType,
          cliFlavor: cliValidationResult.compatibility.requiredCliFlavor,
          runnerPlatform: cliValidationResult.compatibility.currentRunner,
          dotnetAvailable: cliValidationResult.dotnetAvailable,
          cliToolAvailable: cliValidationResult.cliAvailable,
          analyzerDefectCount: analyzerDefects.length,
          analyzerErrorCount: analyzerDefects.filter(d => d.severity === "Error").length,
          analyzerWarningCount: analyzerDefects.filter(d => d.severity === "Warning").length,
          packSuccess: cliValidationResult.packResult?.success,
          packErrors: cliValidationResult.packResult?.errors,
          durationMs: cliValidationResult.durationMs,
        };
      }
    }

    const effectivePackageBuffer = packageViable ? finalPackageBuffer : Buffer.alloc(0);

    const result: PipelineResult = {
      packageBuffer: effectivePackageBuffer,
      gaps: buildResult.gaps,
      usedPackages: buildResult.usedPackages,
      qualityGateResult: finalQualityReport?.qualityGateResult || postCorrectionQualityGate || buildResult.qualityGateResult,
      cacheHit: buildResult.cacheHit,
      dhgContent: dhgResult.dhgContent,
      projectName: dhgResult.projectName,
      xamlEntries: finalXamlEntries,
      dependencyMap: buildResult.dependencyMap,
      archiveManifest: buildResult.archiveManifest,
      qualityGateBlocking,
      qualityGateWarnings,
      generationMode: mode,
      usedFallbackStubs: buildResult.usedFallbackStubs,
      referencedMLSkillNames: buildResult.referencedMLSkillNames || [],
      warnings: pipelineWarnings,
      downgrades,
      usedAIFallback,
      status: finalStatus,
      templateComplianceScore,
      metaValidationResult,
      outcomeReport: buildResult.outcomeReport,
      finalQualityReport,
      packageViable,
      fallbackModeActive: emergencyFallbackActive || undefined,
      fallbackModeReason: emergencyFallbackActive ? emergencyFallbackReason : undefined,
      dependencyDiagnostics: buildResult.dependencyDiagnostics,
      dependencyGaps: buildResult.dependencyGaps,
      ambiguousResolutions: buildResult.ambiguousResolutions,
      orphanDependencies: buildResult.orphanDependencies,
      propertySerializationTrace: buildResult.propertySerializationTrace,
      invokeContractTrace: buildResult.invokeContractTrace,
      stageHashParity: buildResult.stageHashParity,
      criticalActivityContractDiagnostics: buildResult.criticalActivityContractDiagnostics,
      cliValidationMode: cliValidationResult?.mode || "custom_validated_only",
      cliValidationResult: cliValidationResult,
      traceabilityManifest,
    };

    evictOldestPipelineCacheEntry();
    const degradationKey = (downgrades.length > 0 || usedAIFallback) ? "degraded" : "clean";
    const finalCacheKey = `${ideaId}:${mode}:${mvMode}:${degradationKey}`;
    pipelineCache.set(finalCacheKey, { ...result, fingerprint: fp });
    try {
      const mvTokens = { input: mvInputTokens, output: mvOutputTokens };
      const totalXamlLength = finalXamlEntries.reduce((sum, e) => sum + e.content.length, 0);
      const estimatedAssemblyOutputTokens = Math.ceil(totalXamlLength / 3.5);
      const estimatedAssemblyInputTokens = Math.ceil(estimatedAssemblyOutputTokens * 1.5);
      const assemblyTokens = { input: estimatedAssemblyInputTokens, output: estimatedAssemblyOutputTokens };
      const totalTokens = {
        input: assemblyTokens.input + mvTokens.input,
        output: assemblyTokens.output + mvTokens.output,
      };
      const assemblyCost = calculateEstimatedCost(assemblyTokens.input, assemblyTokens.output, "default");
      const mvCost = mvInputTokens > 0 ? calculateEstimatedCost(mvTokens.input, mvTokens.output, "haiku") : 0;
      const estimatedCost = assemblyCost + mvCost;
      await recordGenerationMetrics({
        id: `gen-${ideaId}-${Date.now()}`,
        timestamp: new Date(),
        ideaId,
        decompositionTokens: { input: 0, output: 0 },
        assemblyTokens,
        metaValidationTokens: mvTokens,
        totalTokens,
        estimatedCostUsd: estimatedCost,
        templateComplianceScore: templateComplianceScore || 0,
        confidenceScore: metaValidationResult?.confidenceScore || 0,
        metaValidationEngaged: metaValidationResult?.engaged || false,
        metaValidationMode: mvMode,
        correctionsApplied: metaValidationResult?.correctionsApplied || 0,
        finalStatus,
      });
    } catch (metricsErr: unknown) {
      const errMsg = metricsErr instanceof Error ? metricsErr.message : String(metricsErr);
      console.warn(`[Pipeline] Failed to record generation metrics: ${errMsg}`);
    }

    try {
      const pipelineStartTime = (tracker as any).startTimes?.get("spec_generation") || Date.now();
      const durationMs = Date.now() - pipelineStartTime;
      const transitiveDepsCount = qgResult
        ? qgResult.violations.filter((v: any) =>
            v.check === "transitive-dependency-missing" || v.check === "error-activity-reference" || v.check === "unresolved-type-argument"
          ).length
        : 0;
      const qgRunCount = 1 + downgrades.length;
      const healthMetrics = computePipelineHealthFromResult(result, ideaId, durationMs, qgRunCount, transitiveDepsCount);
      await recordPipelineHealth(healthMetrics);
    } catch (healthErr: unknown) {
      const errMsg = healthErr instanceof Error ? healthErr.message : String(healthErr);
      console.warn(`[Pipeline] Failed to record pipeline health: ${errMsg}`);
    }

    console.log(`[Pipeline] Cached result for ${ideaId} (mode=${mode}, fingerprint ${fp}, ${finalPackageBuffer.length} bytes, status=${finalStatus}, warnings=${pipelineWarnings.length}, templateCompliance=${templateComplianceScore ?? "N/A"})`);

    return result;
  } finally {
    tracker.cleanup();
  }
}

export async function generateUiPathPackage(
  ideaId: string,
  pkg: UiPathPackageSpec,
  options?: {
    version?: string;
    generationMode?: GenerationMode;
    onProgress?: (message: string) => void;
    onMetaValidation?: (event: MetaValidationEvent) => void;
    onPipelineProgress?: PipelineProgressCallback;
    preloadedContext?: IdeaContext;
    metaValidationMode?: MetaValidationMode;
    _accumulatedDowngrades?: DowngradeEvent[];
    _accumulatedWarnings?: PipelineWarning[];
    _usedAIFallback?: boolean;
    forceRebuild?: boolean;
  },
): Promise<PipelineResult> {
  const pipelineTargetFramework: "Windows" | "Portable" = "Windows";
  resetLookupCounters();
  setAssemblyTargetFramework(pipelineTargetFramework);
  const ver = options?.version || computeVersion();
  const requestedMode: GenerationMode | undefined = options?.generationMode;
  if (requestedMode === "baseline_openable") {
    console.warn(`[Pipeline] generateUiPathPackage: baseline_openable rejected — only available as emergency fallback, using full_implementation`);
  }
  const mode: GenerationMode = "full_implementation";
  const mvMode: MetaValidationMode = options?.metaValidationMode || "Auto";
  const pipelineWarnings: PipelineWarning[] = options?._accumulatedWarnings ? [...options._accumulatedWarnings] : [];
  const downgrades: DowngradeEvent[] = options?._accumulatedDowngrades ? [...options._accumulatedDowngrades] : [];
  let usedAIFallback = options?._usedAIFallback || false;
  const forceRebuild = options?.forceRebuild || false;

  if (!requestedMode) {
    console.log(`[Pipeline] generateUiPathPackage: full_implementation is the default mode (no explicit mode requested)`);
  }

  const noop: PipelineProgressCallback = () => {};
  const tracker = new PipelineStageTracker(options?.onPipelineProgress || noop);

  try {
    tracker.start("decomposition", "Computing fingerprint and checking cache");
    const ctx = options?.preloadedContext || await loadIdeaContext(ideaId);

    const preComplexity = estimateComplexityFromContext(ctx.sdd?.content, ctx.mapNodes);
    tracker.start("pre_complexity_estimation", "Estimating pre-generation complexity");
    tracker.complete("pre_complexity_estimation", `Pre-generation complexity: ${preComplexity.tier} (${preComplexity.budget.label})`, {
      tier: preComplexity.tier,
      score: preComplexity.score,
      budgetLabel: preComplexity.budget.label,
      budgetMin: preComplexity.budget.min,
      budgetMax: preComplexity.budget.max,
      reasons: preComplexity.reasons,
    });
    console.log(`[Pipeline] Pre-generation complexity: tier=${preComplexity.tier}, score=${preComplexity.score}, budget=${preComplexity.budget.label}, reasons=${preComplexity.reasons.join("; ")}`);

    const workflowCount = (pkg as any).workflows?.length || 0;
    tracker.complete("decomposition", `Decomposed into ${workflowCount} workflow(s)`, { workflowCount });

    const withinBudget = workflowCount >= preComplexity.budget.min && workflowCount <= preComplexity.budget.max;
    tracker.start("workflow_budget_check", "Checking workflow count against budget");
    tracker.complete("workflow_budget_check", withinBudget
      ? `Workflow count (${workflowCount}) is within expected range (${preComplexity.budget.label})`
      : `Workflow count (${workflowCount}) is outside expected range (${preComplexity.budget.label})`, {
      actualCount: workflowCount,
      expectedMin: preComplexity.budget.min,
      expectedMax: preComplexity.budget.max,
      withinBudget,
      preGenerationTier: preComplexity.tier,
    });
    console.log(`[Pipeline] Workflow budget check: actual=${workflowCount}, expected=${preComplexity.budget.label}, withinBudget=${withinBudget}`);

    const complexity = classifyComplexity(
      pkg,
      ctx.sdd?.content,
      ctx.mapNodes,
    );
    tracker.start("complexity_classification", `Classifying process complexity`);
    const complexityPath = complexity.streamlined ? "streamlined" : "full pipeline";
    tracker.complete("complexity_classification", `Complexity: ${complexity.tier} (${complexityPath})`, {
      complexityTier: complexity.tier,
      complexityScore: complexity.score,
      streamlined: complexity.streamlined,
      reasons: complexity.reasons,
    });
    console.log(`[Pipeline] Complexity classification: tier=${complexity.tier}, score=${complexity.score}, streamlined=${complexity.streamlined}, reasons=${complexity.reasons.join("; ")}`);

    console.log(`[Pipeline] INSTRUMENTATION: mode=${mode}, downgrades=${downgrades.length}`);

    const fp = computeFingerprint(pkg, ctx.sdd?.content || "", ctx.mapNodes, ctx.processEdges);
    const degradationKey = (downgrades.length > 0 || usedAIFallback) ? "degraded" : "clean";
    const cacheKey = `${ideaId}:${mode}:${mvMode}:${degradationKey}`;
    const cached = pipelineCache.get(cacheKey);
    if (forceRebuild) {
      console.log(`[Pipeline Cache] FORCE REBUILD requested for ${cacheKey} — bypassing pipeline cache`);
      pipelineCache.delete(cacheKey);
    } else if (cached && cached.fingerprint === fp) {
      tracker.complete("decomposition", "Cache hit — serving cached result");
      tracker.cleanup();
      return cached;
    }

    let specResult: SpecGenerationResult;
    try {
      specResult = await generateWorkflowSpecs(ideaId, pkg, {
        generationMode: mode,
        onProgress: options?.onProgress,
        onPipelineProgress: options?.onPipelineProgress,
        preloadedContext: ctx,
        complexityTier: complexity.tier,
      });
    } catch (specErr) {
      throw specErr;
    }

    specResult.pipelineWarnings.push(...pipelineWarnings);
    specResult.usedAIFallback = specResult.usedAIFallback || usedAIFallback;

    try {
      const result = await compilePackageFromSpecs(ideaId, specResult, pkg, {
        version: ver,
        generationMode: mode,
        onProgress: options?.onProgress,
        onMetaValidation: options?.onMetaValidation,
        onPipelineProgress: options?.onPipelineProgress,
        metaValidationMode: mvMode,
        _accumulatedDowngrades: downgrades,
        _accumulatedWarnings: options?._accumulatedWarnings,
        complexityTier: complexity.tier,
        forceRebuild,
      });

      return result;
    } catch (compileErr) {
      throw compileErr;
    }
  } finally {
    tracker.cleanup();
  }
}

export function getCachedPipelineResult(ideaId: string, mode?: GenerationMode): PipelineResult | null {
  let bestMatch: PipelineResult | null = null;
  for (const [key, value] of pipelineCache.entries()) {
    const matchesId = mode
      ? key.startsWith(`${ideaId}:${mode}:`)
      : key.startsWith(`${ideaId}:`);
    if (matchesId) {
      if (key.endsWith(":clean")) return value;
      if (!bestMatch) bestMatch = value;
    }
  }
  return bestMatch;
}

function computeSddBusinessStepsByWorkflow(
  workflowNames: string[],
  analysis: ReturnType<typeof runDhgAnalysis> | null | undefined,
  outcomeReport: PipelineOutcomeReport,
): Map<string, number> {
  const result = new Map<string, number>();

  const processSteps = analysis?.upstreamContext?.processSteps;
  if (!processSteps || processSteps.length === 0) return result;

  const totalSddSteps = processSteps.length;

  if (workflowNames.length === 0) return result;

  if (workflowNames.length === 1) {
    result.set(workflowNames[0], totalSddSteps);
    return result;
  }

  const spMetrics = outcomeReport.structuralPreservationMetrics || [];
  const totalActivities = spMetrics.reduce((sum, m) => sum + m.totalActivities, 0);

  if (totalActivities > 0 && spMetrics.length > 0) {
    for (const wf of workflowNames) {
      const wfFile = `${wf}.xaml`;
      const metric = spMetrics.find(m => m.file === wfFile || m.file === wf);
      if (metric && metric.totalActivities > 0) {
        const proportion = metric.totalActivities / totalActivities;
        result.set(wf, Math.max(1, Math.round(totalSddSteps * proportion)));
      } else {
        const baseLine = Math.max(1, Math.round(totalSddSteps / workflowNames.length));
        result.set(wf, baseLine);
      }
    }
  } else {
    const perWorkflow = Math.max(1, Math.round(totalSddSteps / workflowNames.length));
    for (const wf of workflowNames) {
      result.set(wf, perWorkflow);
    }
  }

  return result;
}

export async function generateDhg(
  ideaId: string,
  pkg: UiPathPackage,
): Promise<DhgResult> {
  const cached = getCachedPipelineResult(ideaId);
  if (cached) {
    console.log(`[Pipeline] Serving cached DHG for ${ideaId}`);
    const cachedReports = cached.finalQualityReport?.analysisReports
      || cached.xamlEntries.map(e => {
        const { report } = analyzeAndFix(e.content);
        return { fileName: e.name, report };
      });
    return {
      dhgContent: cached.dhgContent,
      projectName: cached.projectName,
      analysisReports: cachedReports,
    };
  }

  console.log(`[Pipeline] No cached result for DHG — running full pipeline for ${ideaId}`);
  const pipelineResult = await generateUiPathPackage(ideaId, pkg);

  const reports = pipelineResult.finalQualityReport?.analysisReports
    || pipelineResult.xamlEntries.map(e => {
      const { report } = analyzeAndFix(e.content);
      return { fileName: e.name, report };
    });
  return {
    dhgContent: pipelineResult.dhgContent,
    projectName: pipelineResult.projectName,
    analysisReports: reports,
  };
}

export interface BuildPipelineOptions {
  generationMode?: GenerationMode;
  metaValidationMode?: MetaValidationMode;
  onProgress?: (message: string) => void;
  onPipelineProgress?: PipelineProgressCallback;
  onMetaValidation?: (event: MetaValidationEvent) => void;
  preloadedContext?: IdeaContext;
  version?: string;
  forceRebuild?: boolean;
}

export async function runBuildPipeline(
  ideaId: string,
  pkg: UiPathPackageSpec,
  options?: BuildPipelineOptions,
): Promise<PipelineResult> {
  return generateUiPathPackage(ideaId, pkg, {
    version: options?.version || computeVersion(),
    generationMode: options?.generationMode,
    metaValidationMode: options?.metaValidationMode,
    onProgress: options?.onProgress,
    onPipelineProgress: options?.onPipelineProgress,
    onMetaValidation: options?.onMetaValidation,
    preloadedContext: options?.preloadedContext,
    forceRebuild: options?.forceRebuild,
  });
}

export { QualityGateError } from "./uipath-integration";

export function normalizeAndAnalyzeXaml(
  xaml: string,
  targetFramework: "Windows" | "Portable" = "Windows",
): { normalized: string; report: AnalysisReport } {
  const compliant = normalizeXamlCompliance(xaml, targetFramework);
  const { fixed, report } = analyzeAndFix(compliant);
  return { normalized: fixed, report };
}

export { normalizeAndAnalyzeXaml as normalizeXaml };

export { normalizeXamlCompliance as makeUiPathCompliant, analyzeAndFix };
