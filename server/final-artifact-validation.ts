import { runQualityGate, type QualityGateResult, type QualityGateViolation } from "./uipath-quality-gate";
import { analyzeAndFix, type AnalysisReport } from "./workflow-analyzer";
import type {
  PackageStatus,
  PipelineWarning,
  DowngradeEvent,
  PipelineOutcomeReport,
} from "./uipath-pipeline";
import type { AutomationPattern } from "./uipath-activity-registry";
import { validateExecutablePaths, type ExecutablePathDefect } from "./xaml/executable-path-validator";

export interface FinalArtifactValidationInput {
  xamlEntries: { name: string; content: string }[];
  projectJsonContent: string;
  targetFramework: "Windows" | "Portable";
  archiveManifest?: string[];
  archiveContentHashes?: Record<string, string>;
  automationPattern?: AutomationPattern;
  hasNupkg: boolean;
  contextMetadata: {
    downgrades: DowngradeEvent[];
    usedAIFallback: boolean;
    pipelineWarnings: PipelineWarning[];
    metaValidationFlatStructureWarnings?: number;
    outcomeReport?: PipelineOutcomeReport;
  };
}

export interface PerFileValidation {
  file: string;
  studioCompatibilityLevel: "studio-clean" | "studio-warnings" | "studio-blocked";
  blockers: string[];
  warningCount: number;
  errorCount: number;
  isStudioLoadable: boolean;
  hasStubContent: boolean;
  analysisReport?: AnalysisReport;
}

export interface DeclarationValidationSummary {
  undeclaredVariables: number;
  unknownActivities: number;
  undeclaredNamespaces: number;
  invalidTypeArguments: number;
  totalDeclarationIssues: number;
}

export interface EnumComplianceSummary {
  enumViolations: number;
  catalogStructuralViolations: number;
  expressionSyntaxIssues: number;
  totalEnumComplianceIssues: number;
}

export interface FinalQualityReport {
  perFileResults: PerFileValidation[];
  qualityGateResult: QualityGateResult;
  analysisReports: Array<{ fileName: string; report: AnalysisReport }>;
  declarationValidation: DeclarationValidationSummary;
  enumCompliance: EnumComplianceSummary;
  aggregatedStats: {
    totalFiles: number;
    studioCleanCount: number;
    studioWarningsCount: number;
    studioBlockedCount: number;
    totalErrors: number;
    totalWarnings: number;
  };
  executablePathDefects: ExecutablePathDefect[];
  hasExecutablePathContamination: boolean;
  derivedStatus: PackageStatus;
  statusReason: string;
  outcomeContext?: PipelineOutcomeReport;
  traceabilityMetadata: {
    downgradeCount: number;
    usedAIFallback: boolean;
    pipelineWarningCount: number;
    flatStructureWarningCount: number;
  };
}

const STUDIO_BLOCKING_CHECKS = new Set([
  "empty-container", "empty-http-endpoint", "invalid-trycatch-structure",
  "invalid-catch-type", "invalid-activity-property", "undeclared-variable",
  "unknown-activity", "undeclared-namespace", "invalid-type-argument",
  "invalid-default-value", "policy-blocked-activity", "pseudo-xaml",
  "fake-trycatch", "object-object", "EXPRESSION_SYNTAX_UNFIXABLE",
  "TYPE_MISMATCH", "FOREACH_TYPE_MISMATCH", "LITERAL_TYPE_ERROR",
  "CATALOG_STRUCTURAL_VIOLATION", "STRING_FORMAT_OVERFLOW",
  "EXPRESSION_IN_LITERAL_SLOT", "UNDECLARED_ARGUMENT",
]);

const STUDIO_WARNING_CHECKS = new Set([
  "placeholder-value", "expression-syntax-mismatch", "invoke-arg-type-mismatch",
  "invalid-continue-on-error", "EXPRESSION_SYNTAX", "UNSAFE_VARIABLE_NAME", "empty-catches",
]);

const STUB_CONTENT_PATTERNS = [
  "STUB_BLOCKING_FALLBACK",
  "STUB: ",
  "STUB_WORKFLOW_GENERATOR_FAILURE",
  "stub — Final validation remediation",
  "ASSEMBLY_FAILED",
  "Generator failed",
  "Generator could not",
];

function checkFinalStudioLoadability(xamlContent: string): { loadable: boolean; reason?: string } {
  if (!xamlContent || xamlContent.trim().length === 0) {
    return { loadable: false, reason: "Empty XAML content" };
  }
  if (!/<Activity\b[^.]/i.test(xamlContent)) {
    return { loadable: false, reason: "Missing root <Activity> element" };
  }
  const activityMatch = xamlContent.match(/<Activity\b[^.][^>]*>([\s\S]*?)<\/Activity>/);
  if (activityMatch && activityMatch[1].trim().length === 0) {
    return { loadable: false, reason: "Empty <Activity> element — no Implementation child" };
  }
  if (/\[ASSEMBLY_FAILED\]/.test(xamlContent)) {
    return { loadable: false, reason: "Contains [ASSEMBLY_FAILED] marker" };
  }
  if (!/<(?:Sequence|Flowchart|StateMachine)\b(?!\.)(?:\s|>|\/)/i.test(xamlContent)) {
    return { loadable: false, reason: "No implementation child element" };
  }
  return { loadable: true };
}

function hasStubMarkers(xamlContent: string): boolean {
  return STUB_CONTENT_PATTERNS.some(pattern => xamlContent.includes(pattern));
}

function buildDeclarationSummary(violations: QualityGateViolation[]): DeclarationValidationSummary {
  const undeclaredVariables = violations.filter(v => v.check === "undeclared-variable").length;
  const unknownActivities = violations.filter(v => v.check === "unknown-activity").length;
  const undeclaredNamespaces = violations.filter(v => v.check === "undeclared-namespace").length;
  const invalidTypeArguments = violations.filter(v => v.check === "invalid-type-argument" || v.check === "unresolved-type-argument").length;
  return {
    undeclaredVariables,
    unknownActivities,
    undeclaredNamespaces,
    invalidTypeArguments,
    totalDeclarationIssues: undeclaredVariables + unknownActivities + undeclaredNamespaces + invalidTypeArguments,
  };
}

function buildEnumComplianceSummary(violations: QualityGateViolation[]): EnumComplianceSummary {
  const enumViolations = violations.filter(v => v.check === "ENUM_VIOLATION").length;
  const catalogStructuralViolations = violations.filter(v => v.check === "CATALOG_STRUCTURAL_VIOLATION").length;
  const expressionSyntaxIssues = violations.filter(v =>
    v.check === "EXPRESSION_SYNTAX" || v.check === "EXPRESSION_SYNTAX_UNFIXABLE" || v.check === "EXPRESSION_IN_LITERAL_SLOT"
  ).length;
  return {
    enumViolations,
    catalogStructuralViolations,
    expressionSyntaxIssues,
    totalEnumComplianceIssues: enumViolations + catalogStructuralViolations + expressionSyntaxIssues,
  };
}

export function runFinalArtifactValidation(input: FinalArtifactValidationInput): FinalQualityReport {
  const { xamlEntries, projectJsonContent, targetFramework, contextMetadata } = input;

  const qualityGateResult = runQualityGate({
    xamlEntries,
    projectJsonContent,
    targetFramework,
    archiveManifest: input.archiveManifest,
    archiveContentHashes: input.archiveContentHashes,
    automationPattern: input.automationPattern,
  });

  const analysisReports: Array<{ fileName: string; report: AnalysisReport }> = [];
  for (const entry of xamlEntries) {
    const { report } = analyzeAndFix(entry.content);
    analysisReports.push({ fileName: entry.name, report });
  }

  const declarationValidation = buildDeclarationSummary(qualityGateResult.violations);
  const enumCompliance = buildEnumComplianceSummary(qualityGateResult.violations);

  const perFileResults: PerFileValidation[] = xamlEntries.map(entry => {
    const shortName = entry.name.split("/").pop() || entry.name;

    const loadability = checkFinalStudioLoadability(entry.content);
    const stubContent = hasStubMarkers(entry.content);

    const fileViolations = qualityGateResult.violations.filter(v => v.file === shortName);
    const blockingViolations = fileViolations.filter(v => v.severity === "error" && STUDIO_BLOCKING_CHECKS.has(v.check));
    const warningViolations = fileViolations.filter(v =>
      (v.severity === "error" && STUDIO_WARNING_CHECKS.has(v.check)) ||
      (v.severity === "warning" && (STUDIO_BLOCKING_CHECKS.has(v.check) || STUDIO_WARNING_CHECKS.has(v.check)))
    );
    const fileErrors = fileViolations.filter(v => v.severity === "error").length;
    const fileWarnings = fileViolations.filter(v => v.severity === "warning").length;

    let studioLevel: PerFileValidation["studioCompatibilityLevel"];
    let blockers: string[] = [];

    if (!loadability.loadable) {
      studioLevel = "studio-blocked";
      blockers = [loadability.reason || "Not Studio-loadable"];
    } else if (blockingViolations.length > 0) {
      studioLevel = "studio-blocked";
      blockers = blockingViolations.map(v => `[${v.check}] ${v.detail}`);
    } else if (warningViolations.length > 0) {
      studioLevel = "studio-warnings";
    } else {
      studioLevel = "studio-clean";
    }

    const analysisEntry = analysisReports.find(ar => ar.fileName === entry.name);

    return {
      file: shortName,
      studioCompatibilityLevel: studioLevel,
      blockers,
      warningCount: fileWarnings,
      errorCount: fileErrors,
      isStudioLoadable: loadability.loadable,
      hasStubContent: stubContent,
      analysisReport: analysisEntry?.report,
    };
  });

  const studioCleanCount = perFileResults.filter(r => r.studioCompatibilityLevel === "studio-clean").length;
  const studioWarningsCount = perFileResults.filter(r => r.studioCompatibilityLevel === "studio-warnings").length;
  const studioBlockedCount = perFileResults.filter(r => r.studioCompatibilityLevel === "studio-blocked").length;
  const totalErrors = perFileResults.reduce((s, r) => s + r.errorCount, 0);
  const totalWarnings = perFileResults.reduce((s, r) => s + r.warningCount, 0);

  const executablePathResult = validateExecutablePaths(xamlEntries);

  const mainXamlEntry = perFileResults.find(r => r.file === "Main.xaml");
  const entryPointHasBlockers = mainXamlEntry
    ? (mainXamlEntry.studioCompatibilityLevel === "studio-blocked" || mainXamlEntry.hasStubContent)
    : false;

  const hasStructuralBlockers = studioBlockedCount > 0;
  const hasStructuralWarnings = studioWarningsCount > 0;
  const hasAnyStubContent = perFileResults.some(r => r.hasStubContent);
  const qgIncomplete = qualityGateResult.completenessLevel === "incomplete";

  const hasDegradation = entryPointHasBlockers || hasStructuralBlockers || hasAnyStubContent || qgIncomplete || executablePathResult.hasExecutablePathContamination;

  let derivedStatus: PackageStatus;
  let statusReason: string;

  /**
   * Status derivation uses the defect-aware assessed terminal states.
   *
   * Semantic distinction (FAILED vs structurally_invalid):
   * - `FAILED` = pipeline crash or unrecoverable system/process failure — reserved for
   *   cases where the pipeline itself did not complete. Never used as a quality outcome.
   * - `structurally_invalid` = pipeline completed assessment, but the artifact is unusable:
   *   no .nupkg produced, entry point blocked, studio-blocked files, or unusable assembly.
   * - `handoff_only` = artifact generated but quality gate is incomplete — not deployment-ready.
   * - `openable_with_warnings` = artifact opens and loads but has minor non-blocking issues.
   * - `studio_stable` = artifact validated clean — ready to deploy.
   *
   * Artifact availability is intentionally decoupled from deployability:
   * download/DHG remain available for ALL states.
   */
  if (!input.hasNupkg) {
    derivedStatus = "structurally_invalid";
    statusReason = "No .nupkg package was produced — artifact assembly failed";
  } else if (entryPointHasBlockers || hasStructuralBlockers) {
    derivedStatus = "structurally_invalid";
    const reasons: string[] = [];
    if (entryPointHasBlockers) reasons.push("entry point (Main.xaml) has structural blockers or stub content");
    if (hasStructuralBlockers) reasons.push(`${studioBlockedCount} file(s) structurally blocked in final validation`);
    statusReason = `Structurally invalid: ${reasons.join(", ")}`;
  } else if (hasAnyStubContent || qgIncomplete || executablePathResult.hasExecutablePathContamination) {
    derivedStatus = "handoff_only";
    const reasons: string[] = [];
    if (hasAnyStubContent) reasons.push("stub content detected in finalized artifacts");
    if (qgIncomplete) reasons.push("quality gate completeness level: incomplete");
    if (executablePathResult.hasExecutablePathContamination) reasons.push(`${executablePathResult.executablePathDefects.length} executable-path defect(s) detected`);
    statusReason = `Handoff only: ${reasons.join(", ")}`;
  } else if (hasStructuralWarnings || totalWarnings > 0) {
    derivedStatus = "openable_with_warnings";
    const reasons: string[] = [];
    if (hasStructuralWarnings) reasons.push(`${studioWarningsCount} file(s) with studio warnings`);
    if (totalWarnings > 0) reasons.push(`${totalWarnings} quality gate warning(s)`);
    statusReason = `Openable with warnings: ${reasons.join(", ")}`;
  } else {
    derivedStatus = "studio_stable";
    statusReason = "All finalized artifacts validated — no blockers or warnings — studio stable";
  }

  return {
    perFileResults,
    qualityGateResult,
    analysisReports,
    declarationValidation,
    enumCompliance,
    aggregatedStats: {
      totalFiles: xamlEntries.length,
      studioCleanCount,
      studioWarningsCount,
      studioBlockedCount,
      totalErrors,
      totalWarnings,
    },
    executablePathDefects: executablePathResult.executablePathDefects,
    hasExecutablePathContamination: executablePathResult.hasExecutablePathContamination,
    derivedStatus,
    statusReason,
    outcomeContext: contextMetadata.outcomeReport,
    traceabilityMetadata: {
      downgradeCount: contextMetadata.downgrades.length,
      usedAIFallback: contextMetadata.usedAIFallback,
      pipelineWarningCount: contextMetadata.pipelineWarnings.length,
      flatStructureWarningCount: contextMetadata.metaValidationFlatStructureWarnings || 0,
    },
  };
}
