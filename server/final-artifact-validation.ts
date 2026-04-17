import { runQualityGate, type QualityGateResult, type QualityGateViolation } from "./uipath-quality-gate";
import { getQuoteRepairDiagnostics } from "./lib/quote-repair-diagnostics";
import { analyzeAndFix, type AnalysisReport } from "./workflow-analyzer";
import type {
  PackageStatus,
  PipelineWarning,
  DowngradeEvent,
  PipelineOutcomeReport,
} from "./uipath-pipeline";
import type { CliValidationMode } from "./uipath-cli-validator";
import type { AutomationPattern } from "./uipath-activity-registry";
import { validateExecutablePaths, type ExecutablePathDefect } from "./xaml/executable-path-validator";
import {
  validateWorkflowGraph,
  type WorkflowGraphDefect,
  type WorkflowGraphSummary,
  type WorkflowGraphValidationResult,
} from "./xaml/workflow-graph-validator";
import {
  validateContractIntegrity,
  type ContractIntegrityDefect,
  type ContractNormalizationAction,
  type ContractExtractionExclusion,
  type ContractIntegritySummaryMetrics,
} from "./xaml/workflow-contract-integrity";
import {
  canonicalizeInvokeBindings,
  postEmissionInvokeValidator,
  canonicalizeTargetValueExpressions,
  type InvokeSerializationFix,
  type ResidualExpressionSerializationDefect,
  type ExpressionCanonicalizationFix,
  type SymbolScopeDefect,
  type SentinelReplacementRecord,
  type UnresolvableJsonDefect,
} from "./xaml/invoke-binding-canonicalizer";
import { AUTHORITATIVE_STUB_PATTERNS } from "./workflow-status-classifier";
import {
  applyRequiredPropertyEnforcement,
  type RequiredPropertyEnforcementResult,
  type PreComplianceGuardResult,
  type RequiredPropertyBinding,
  type UnresolvedRequiredPropertyDefect,
  type ExpressionLoweringFix,
  type ExpressionLoweringFailure,
  type InvalidRequiredPropertySubstitution,
} from "./required-property-enforcer";
import {
  runXamlLevelCriticalActivityLowering,
  loweringDiagnosticsToPackageViolations,
  mergeLoweringDiagnostics,
  runXamlLevelMailFamilyLockAnalysis,
  mailFamilyLockToPackageViolations,
  crossFamilyDriftToPackageViolations,
  type CriticalActivityLoweringDiagnostics,
  type CriticalStepLoweringResult,
  type MailFamilyLockDiagnostics,
  type CrossFamilyDriftViolation,
} from "./critical-activity-lowering";
import { catalogService } from "./catalog/catalog-service";
import { drainTodoAttributeGuardDiagnostics, type TodoAttributeGuardDiagnostic } from "./lib/todo-attribute-guard";
import type { DiagnosticSource } from "./lib/stub-cause";

export interface FinalArtifactValidationInput {
  xamlEntries: { name: string; content: string }[];
  projectJsonContent: string;
  targetFramework: "Windows" | "Portable";
  archiveManifest?: string[];
  archiveContentHashes?: Record<string, string>;
  automationPattern?: AutomationPattern;
  hasNupkg: boolean;
  preEmissionLoweringDiagnostics?: CriticalActivityLoweringDiagnostics;
  assemblerDriftViolations?: CrossFamilyDriftViolation[];
  preEmissionMailFamilyLockDiagnostics?: MailFamilyLockDiagnostics;
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

export type PackageCompletenessViolationType =
  | "sentinel_in_required_property"
  | "stub_workflow_in_package"
  | "xml_wellformedness_failure"
  | "unwired_critical_workflow"
  | "missing_critical_activity_property"
  | "malformed_executable_expression"
  | "blocked_workflow_in_package"
  | "critical_activity_lowering_failure";

export interface PackageCompletenessViolation {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  violationType: PackageCompletenessViolationType;
  severity: "execution_blocking" | "handoff_required";
  packageFatal: boolean;
  handoffGuidanceAvailable: boolean;
  remediationHint: string;
}

export interface PackageCompletenessViolationsSummary {
  totalPackageFatalViolations: number;
  totalPlaceholderInjectionPrevented: number;
  totalStubSubstitutionsPrevented: number;
  totalUnwiredCriticalWorkflows: number;
  totalCriticalMissingProperties: number;
}

export interface PackageCompletenessViolationsArtifact {
  violations: PackageCompletenessViolation[];
  summary: PackageCompletenessViolationsSummary;
  packageViable: boolean;
}

/**
 * Discriminated union describing one entry in the shared
 * `final_quality_report.diagnostics` collection. Each task tags entries with
 * its own `source` so consumers (verdict policy, regression assertions, DHG)
 * can filter mechanically rather than parsing prose. New tasks extend this
 * union by adding a new variant with a unique `source` literal.
 */
export type RunArtifactDiagnostic =
  | (TodoAttributeGuardDiagnostic & { source: "todo-attribute-guard" })
  | { source: Exclude<DiagnosticSource, "todo-attribute-guard">; file?: string; emitter?: string; reason: string; [k: string]: unknown };

function collectRunArtifactDiagnostics(): RunArtifactDiagnostic[] {
  const out: RunArtifactDiagnostic[] = [];
  for (const d of drainTodoAttributeGuardDiagnostics()) {
    out.push(d as RunArtifactDiagnostic);
  }
  return out;
}

export interface FinalQualityReport {
  perFileResults: PerFileValidation[];
  qualityGateResult: QualityGateResult;
  analysisReports: Array<{ fileName: string; report: AnalysisReport }>;
  declarationValidation: DeclarationValidationSummary;
  enumCompliance: EnumComplianceSummary;
  workflowGraphDefects: WorkflowGraphDefect[];
  hasWorkflowGraphIntegrityIssues: boolean;
  workflowGraphSummary: WorkflowGraphSummary;
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
  contractIntegrityDefects: ContractIntegrityDefect[];
  hasContractIntegrityIssues: boolean;
  contractIntegritySummary?: string;
  contractIntegritySummaryMetrics?: ContractIntegritySummaryMetrics;
  contractNormalizationActions: ContractNormalizationAction[];
  contractExtractionExclusions: ContractExtractionExclusion[];
  invokeSerializationFixes: InvokeSerializationFix[];
  residualExpressionSerializationDefects: ResidualExpressionSerializationDefect[];
  expressionCanonicalizationFixes: ExpressionCanonicalizationFix[];
  symbolScopeDefects: SymbolScopeDefect[];
  unresolvableJsonDefects: UnresolvableJsonDefect[];
  sentinelReplacements: SentinelReplacementRecord[];
  targetValueCanonicalizationSummary?: string;
  requiredPropertyBindings: RequiredPropertyBinding[];
  unresolvedRequiredPropertyDefects: UnresolvedRequiredPropertyDefect[];
  expressionLoweringFixes: ExpressionLoweringFix[];
  expressionLoweringFailures: ExpressionLoweringFailure[];
  invalidRequiredPropertySubstitutions: InvalidRequiredPropertySubstitution[];
  totalInvalidSubstitutionsBlocked: number;
  requiredPropertyEnforcementSummary?: string;
  preComplianceGuardPassed: boolean;
  preComplianceGuardViolationCount: number;
  derivedStatus: PackageStatus;
  statusReason: string;
  outcomeContext?: PipelineOutcomeReport;
  traceabilityMetadata: {
    downgradeCount: number;
    usedAIFallback: boolean;
    pipelineWarningCount: number;
    flatStructureWarningCount: number;
  };
  packageCompletenessViolations: PackageCompletenessViolationsArtifact;
  packageViable: boolean;
  /**
   * Shared run-artifact diagnostics channel introduced by Task #529. All
   * tasks in the #528/#529/#530 batch write to and read from this single
   * collection; each entry is origin-tagged via `source` (a
   * `DiagnosticSource` literal) so consumers can filter by task without
   * parsing message text. The collection is intentionally typed as
   * `RunArtifactDiagnostic[]` (a discriminated union over per-source
   * payloads) so future tasks can extend it without breaking the contract.
   */
  diagnostics: RunArtifactDiagnostic[];
  criticalActivityLoweringDiagnostics?: CriticalActivityLoweringDiagnostics;
  mailFamilyLockDiagnostics?: MailFamilyLockDiagnostics;
  quoteRepairDiagnostics?: QuoteRepairDiagnosticsReport;
  cliValidationMode?: CliValidationMode;
  cliValidationDetails?: {
    projectType?: string;
    cliFlavor?: string;
    runnerPlatform?: string;
    dotnetAvailable?: boolean;
    cliToolAvailable?: boolean;
    analyzerDefectCount?: number;
    analyzerErrorCount?: number;
    analyzerWarningCount?: number;
    packSuccess?: boolean;
    packErrors?: string[];
    durationMs?: number;
  };
}

export interface QuoteRepairDiagnosticsReport {
  attempts: Array<{
    file: string;
    workflow: string;
    attributePath: string;
    originalValue: string;
    repairedValue: string;
    repairApplied: boolean;
    repairReason: string;
    repairFailedReason?: string;
    savedFromStub: boolean;
    packageFatal: boolean;
  }>;
  summary: {
    totalMalformedQuoteFindings: number;
    totalQuoteRepairsApplied: number;
    totalQuoteRepairsFailed: number;
    totalWorkflowsSavedFromStub: number;
    totalFilesStillStubbedAfterRepairAttempt: number;
  };
  activePathProof: Array<{
    file: string;
    workflow: string;
    stageWhereDetected: string;
    stageWhereApplied: string;
    preRepairHash: string;
    postRepairHash: string;
    downstreamConsumedRepairedVersion: boolean;
  }>;
}

const STUDIO_BLOCKING_CHECKS = new Set([
  "empty-container", "empty-http-endpoint", "invalid-trycatch-structure",
  "invalid-catch-type", "invalid-activity-property", "undeclared-variable",
  "unknown-activity", "deprecated-activity", "non-emission-approved-activity", "target-incompatible-activity",
  "undeclared-namespace", "invalid-type-argument",
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

const STUB_CONTENT_PATTERNS = AUTHORITATIVE_STUB_PATTERNS;

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

const SENTINEL_SCAN_PATTERN = /\b(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?|HANDOFF(?:_\w*)?)\b/i;

const CRITICAL_EXECUTION_ACTIVITIES: Record<string, string[]> = {
  "SendSmtpMailMessage": ["To", "Subject", "Body", "Host", "Port"],
  "ui:SendSmtpMailMessage": ["To", "Subject", "Body", "Host", "Port"],
  "GmailSendMessage": ["To", "Subject", "Body"],
  "ui:GmailSendMessage": ["To", "Subject", "Body"],
  "SendOutlookMailMessage": ["To", "Subject", "Body"],
  "ui:SendOutlookMailMessage": ["To", "Subject", "Body"],
  "InvokeWorkflowFile": ["WorkflowFileName"],
  "ui:InvokeWorkflowFile": ["WorkflowFileName"],
  "CreateFormTask": ["Title", "FormData"],
  "ui:CreateFormTask": ["Title", "FormData"],
  "RetryScope": [],
  "ui:RetryScope": [],
};

function buildPackageCompletenessViolations(
  perFileResults: PerFileValidation[],
  xamlEntries: { name: string; content: string }[],
  graphDefects: WorkflowGraphDefect[],
  unresolvedDefects: UnresolvedRequiredPropertyDefect[],
  expressionLoweringFailures: ExpressionLoweringFailure[],
  invalidSubstitutions: InvalidRequiredPropertySubstitution[],
  preComplianceGuard: PreComplianceGuardResult,
  outcomeReport?: PipelineOutcomeReport,
  criticalLoweringDiagnostics?: CriticalActivityLoweringDiagnostics,
  mailFamilyLockDiagnostics?: MailFamilyLockDiagnostics,
  crossFamilyDriftViolationsList?: CrossFamilyDriftViolation[],
): PackageCompletenessViolationsArtifact {
  const violations: PackageCompletenessViolation[] = [];

  for (const fileResult of perFileResults) {
    if (fileResult.hasStubContent) {
      violations.push({
        file: fileResult.file,
        workflow: fileResult.file.replace(/\.xaml$/i, ""),
        activityType: "Workflow",
        propertyName: "Implementation",
        violationType: "stub_workflow_in_package",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `Workflow ${fileResult.file} contains stub content — must be fully implemented before package is viable`,
      });
    }

    if (fileResult.studioCompatibilityLevel === "studio-blocked" && !fileResult.isStudioLoadable) {
      violations.push({
        file: fileResult.file,
        workflow: fileResult.file.replace(/\.xaml$/i, ""),
        activityType: "Workflow",
        propertyName: "XmlStructure",
        violationType: "xml_wellformedness_failure",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `Workflow ${fileResult.file} failed XML well-formedness validation — ${fileResult.blockers.join("; ")}`,
      });
    } else if (fileResult.studioCompatibilityLevel === "studio-blocked" && fileResult.isStudioLoadable) {
      violations.push({
        file: fileResult.file,
        workflow: fileResult.file.replace(/\.xaml$/i, ""),
        activityType: "Workflow",
        propertyName: "StudioCompatibility",
        violationType: "blocked_workflow_in_package",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `Workflow ${fileResult.file} is blocked in Studio — ${fileResult.blockers.join("; ")}`,
      });
    }
  }

  const knownRequiredProperties = new Set<string>();
  for (const props of Object.values(CRITICAL_EXECUTION_ACTIVITIES)) {
    for (const p of props) knownRequiredProperties.add(p);
  }
  knownRequiredProperties.add("Selector");
  knownRequiredProperties.add("Target");
  knownRequiredProperties.add("FilePath");
  knownRequiredProperties.add("FileName");
  knownRequiredProperties.add("Url");
  knownRequiredProperties.add("InputPath");
  knownRequiredProperties.add("OutputPath");
  knownRequiredProperties.add("Expression");
  knownRequiredProperties.add("Value");
  knownRequiredProperties.add("Condition");
  knownRequiredProperties.add("Password");
  knownRequiredProperties.add("Username");
  knownRequiredProperties.add("Database");
  knownRequiredProperties.add("ConnectionString");
  knownRequiredProperties.add("SheetName");
  knownRequiredProperties.add("Range");

  const nonExecutableAttrs = new Set(["DisplayName", "sap2010:Annotation.AnnotationText", "sap2010:WorkflowViewState.IdRef", "Text", "xmlns"]);

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    let sentinelAttrCount = 0;
    const sentinelProperties: string[] = [];
    const attrSentinelPattern = /\s+(\w+)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrSentinelPattern.exec(entry.content)) !== null) {
      const attrName = attrMatch[1];
      const attrValue = attrMatch[2].trim();
      if (nonExecutableAttrs.has(attrName) || attrName.startsWith("xmlns:") || attrName.startsWith("sap2010:")) continue;
      if (!knownRequiredProperties.has(attrName)) continue;
      if (SENTINEL_SCAN_PATTERN.test(attrValue)) {
        sentinelAttrCount++;
        if (!sentinelProperties.includes(attrName)) sentinelProperties.push(attrName);
      }
    }
    const wrappedAttrPattern = /\s+(\w+)="\["([^"]*)"\]"/g;
    let wrappedMatch;
    while ((wrappedMatch = wrappedAttrPattern.exec(entry.content)) !== null) {
      const attrName = wrappedMatch[1];
      const attrValue = wrappedMatch[2].trim();
      if (nonExecutableAttrs.has(attrName) || attrName.startsWith("xmlns:") || attrName.startsWith("sap2010:")) continue;
      if (!knownRequiredProperties.has(attrName)) continue;
      if (SENTINEL_SCAN_PATTERN.test(attrValue)) {
        sentinelAttrCount++;
        if (!sentinelProperties.includes(attrName)) sentinelProperties.push(attrName);
      }
    }
    if (sentinelAttrCount > 0) {
      violations.push({
        file: shortName,
        workflow: shortName.replace(/\.xaml$/i, ""),
        activityType: "Workflow",
        propertyName: sentinelProperties.join(", "),
        violationType: "sentinel_in_required_property",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `${sentinelAttrCount} sentinel value(s) in required executable property(ies) [${sentinelProperties.join(", ")}] in ${shortName} — these must be resolved before package is viable`,
      });
    }
  }

  for (const defect of unresolvedDefects) {
    if (defect.severity === "execution_blocking") {
      violations.push({
        file: defect.file,
        workflow: defect.workflow,
        activityType: defect.activityType,
        propertyName: defect.propertyName,
        violationType: "missing_critical_activity_property",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `Required property ${defect.propertyName} on ${defect.activityType} is unresolved: ${defect.failureReason}`,
      });
    }
  }

  for (const failure of expressionLoweringFailures) {
    if (failure.severity === "execution_blocking") {
      violations.push({
        file: failure.file,
        workflow: failure.workflow,
        activityType: failure.activityType,
        propertyName: failure.propertyName,
        violationType: "malformed_executable_expression",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `Expression lowering failed for ${failure.propertyName} on ${failure.activityType}: ${failure.failureReason}`,
      });
    }
  }

  for (const sub of invalidSubstitutions) {
    violations.push({
      file: sub.file,
      workflow: sub.workflow,
      activityType: sub.activityType,
      propertyName: sub.propertyName,
      violationType: "missing_critical_activity_property",
      severity: "execution_blocking",
      packageFatal: true,
      handoffGuidanceAvailable: true,
      remediationHint: `Invalid substitution blocked for ${sub.propertyName} on ${sub.activityType}: ${sub.reasonRejected}`,
    });
  }

  for (const guardViolation of preComplianceGuard.violations) {
    const alreadyCovered = violations.some(
      v => v.file === guardViolation.file && v.violationType === "sentinel_in_required_property"
    );
    if (!alreadyCovered) {
      violations.push({
        file: guardViolation.file,
        workflow: guardViolation.file.replace(/\.xaml$/i, ""),
        activityType: guardViolation.activityType || "Unknown",
        propertyName: guardViolation.propertyName || "Unknown",
        violationType: "sentinel_in_required_property",
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `Sentinel value in required property ${guardViolation.propertyName || "unknown"} on ${guardViolation.activityType || "unknown activity"}`,
      });
    }
  }

  for (const graphDefect of graphDefects) {
    if (graphDefect.severity === "execution_blocking") {
      const isUnwired = graphDefect.defectType === "orphan_workflow" || graphDefect.defectType === "decomposed_unwired_workflow" || graphDefect.defectType === "missing_target_workflow" || graphDefect.defectType === "unparseable_target_workflow";
      const violationType: PackageCompletenessViolationType = isUnwired ? "unwired_critical_workflow" : "blocked_workflow_in_package";
      violations.push({
        file: graphDefect.file,
        workflow: graphDefect.workflow,
        activityType: graphDefect.defectType === "orphan_workflow" ? "Workflow" : "InvokeWorkflowFile",
        propertyName: graphDefect.defectType === "orphan_workflow" ? "Reachability" : "WorkflowFileName",
        violationType,
        severity: "execution_blocking",
        packageFatal: true,
        handoffGuidanceAvailable: true,
        remediationHint: `Workflow graph defect (${graphDefect.defectType}): ${graphDefect.notes}`,
      });
    }
  }

  if (outcomeReport) {
    const stubRemediations = outcomeReport.remediations?.filter(
      r => r.remediationCode === "STUB_WORKFLOW_BLOCKING" || r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE"
    ) || [];
    for (const stubRem of stubRemediations) {
      const alreadyCovered = violations.some(
        v => v.file === stubRem.file && v.violationType === "stub_workflow_in_package"
      );
      if (!alreadyCovered) {
        violations.push({
          file: stubRem.file,
          workflow: stubRem.file.replace(/\.xaml$/i, ""),
          activityType: "Workflow",
          propertyName: "Implementation",
          violationType: "stub_workflow_in_package",
          severity: "execution_blocking",
          packageFatal: true,
          handoffGuidanceAvailable: true,
          remediationHint: stubRem.reason || `Stub workflow was substituted — must be fully implemented`,
        });
      }
    }
  }

  if (criticalLoweringDiagnostics) {
    const loweringViolations = loweringDiagnosticsToPackageViolations(criticalLoweringDiagnostics);
    for (const lv of loweringViolations) {
      violations.push({
        file: lv.file,
        workflow: lv.workflow,
        activityType: lv.activityType,
        propertyName: lv.propertyName,
        violationType: lv.violationType,
        severity: lv.severity,
        packageFatal: lv.packageFatal,
        handoffGuidanceAvailable: lv.handoffGuidanceAvailable,
        remediationHint: lv.remediationHint,
      });
    }
  }

  if (mailFamilyLockDiagnostics) {
    const mailLockViolations = mailFamilyLockToPackageViolations(mailFamilyLockDiagnostics);
    for (const mv of mailLockViolations) {
      violations.push({
        file: mv.file,
        workflow: mv.workflow,
        activityType: mv.activityType,
        propertyName: mv.propertyName,
        violationType: mv.violationType,
        severity: mv.severity,
        packageFatal: mv.packageFatal,
        handoffGuidanceAvailable: mv.handoffGuidanceAvailable,
        remediationHint: mv.remediationHint,
      });
    }
  }

  if (crossFamilyDriftViolationsList && crossFamilyDriftViolationsList.length > 0) {
    const driftPackageViolations = crossFamilyDriftToPackageViolations(crossFamilyDriftViolationsList);
    for (const dv of driftPackageViolations) {
      violations.push({
        file: dv.file,
        workflow: dv.workflow,
        activityType: dv.activityType,
        propertyName: dv.propertyName,
        violationType: dv.violationType,
        severity: dv.severity,
        packageFatal: dv.packageFatal,
        handoffGuidanceAvailable: dv.handoffGuidanceAvailable,
        remediationHint: dv.remediationHint,
      });
    }
  }

  const totalPackageFatalViolations = violations.filter(v => v.packageFatal).length;
  const totalPlaceholderInjectionPrevented = violations.filter(
    v => v.violationType === "sentinel_in_required_property"
  ).length;
  const totalStubSubstitutionsPrevented = violations.filter(
    v => v.violationType === "stub_workflow_in_package"
  ).length;
  const totalUnwiredCriticalWorkflows = violations.filter(
    v => v.violationType === "unwired_critical_workflow"
  ).length;
  const totalCriticalMissingProperties = violations.filter(
    v => v.violationType === "missing_critical_activity_property" || v.violationType === "malformed_executable_expression"
  ).length;

  const packageViable = totalPackageFatalViolations === 0;

  return {
    violations,
    summary: {
      totalPackageFatalViolations,
      totalPlaceholderInjectionPrevented,
      totalStubSubstitutionsPrevented,
      totalUnwiredCriticalWorkflows,
      totalCriticalMissingProperties,
    },
    packageViable,
  };
}

function buildDeclarationSummary(violations: QualityGateViolation[]): DeclarationValidationSummary {
  const undeclaredVariables = violations.filter(v => v.check === "undeclared-variable").length;
  const unknownActivities = violations.filter(v => v.check === "unknown-activity" || v.check === "deprecated-activity" || v.check === "non-emission-approved-activity" || v.check === "target-incompatible-activity").length;
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

  const invokeCanonicalizationResult = canonicalizeInvokeBindings(xamlEntries);

  const targetValueResult = canonicalizeTargetValueExpressions(xamlEntries);

  const graphValidation = validateWorkflowGraph(xamlEntries);

  const enforcementApplication = applyRequiredPropertyEnforcement(xamlEntries, input.hasNupkg);
  const requiredPropertyEnforcement = enforcementApplication.enforcementResult;
  const preComplianceGuard = enforcementApplication.guardResult;
  const enforcedEntries = enforcementApplication.entries;

  const studioProfile = catalogService.isLoaded() ? catalogService.getStudioProfile() : null;
  const verifiedPackages = new Set<string>();
  try {
    const projJson = JSON.parse(projectJsonContent);
    if (projJson.dependencies) {
      for (const pkgId of Object.keys(projJson.dependencies)) {
        verifiedPackages.add(pkgId);
      }
    }
  } catch {}
  const xamlLevelDiagnostics = runXamlLevelCriticalActivityLowering(
    xamlEntries, studioProfile, verifiedPackages,
  );
  const criticalLoweringDiagnostics = mergeLoweringDiagnostics(
    input.preEmissionLoweringDiagnostics,
    xamlLevelDiagnostics,
  );

  const mailFamilyLockResult = runXamlLevelMailFamilyLockAnalysis(
    xamlEntries, studioProfile, verifiedPackages,
  );
  const xamlLevelMailDiag = mailFamilyLockResult.diagnostics;
  const preEmissionMailDiag = input.preEmissionMailFamilyLockDiagnostics;
  const mailFamilyLockDiag: MailFamilyLockDiagnostics = preEmissionMailDiag
    ? {
        perClusterResults: [...preEmissionMailDiag.perClusterResults, ...xamlLevelMailDiag.perClusterResults.filter(
          xr => !preEmissionMailDiag.perClusterResults.some(pr => pr.clusterId === xr.clusterId)
        )],
        summary: {
          totalClusters: preEmissionMailDiag.summary.totalClusters + xamlLevelMailDiag.perClusterResults.filter(
            xr => !preEmissionMailDiag.perClusterResults.some(pr => pr.clusterId === xr.clusterId)
          ).length,
          totalLocked: preEmissionMailDiag.summary.totalLocked + xamlLevelMailDiag.perClusterResults.filter(
            xr => xr.locked && !preEmissionMailDiag.perClusterResults.some(pr => pr.clusterId === xr.clusterId)
          ).length,
          totalRejectedAmbiguous: preEmissionMailDiag.summary.totalRejectedAmbiguous + xamlLevelMailDiag.perClusterResults.filter(
            xr => !xr.locked && xr.lockRejectionReason?.includes("ambiguous") && !preEmissionMailDiag.perClusterResults.some(pr => pr.clusterId === xr.clusterId)
          ).length,
          totalRejectedNarrative: preEmissionMailDiag.summary.totalRejectedNarrative + xamlLevelMailDiag.perClusterResults.filter(
            xr => xr.narrativeRepresentationsRejected.length > 0 && !preEmissionMailDiag.perClusterResults.some(pr => pr.clusterId === xr.clusterId)
          ).length,
          totalRejectedMissingProperties: preEmissionMailDiag.summary.totalRejectedMissingProperties + xamlLevelMailDiag.perClusterResults.filter(
            xr => xr.missingRequiredProperties.length > 0 && !preEmissionMailDiag.perClusterResults.some(pr => pr.clusterId === xr.clusterId)
          ).length,
          totalCrossFamilyDriftViolations: preEmissionMailDiag.summary.totalCrossFamilyDriftViolations + xamlLevelMailDiag.perClusterResults.filter(
            xr => xr.crossFamilyDriftViolation && !preEmissionMailDiag.perClusterResults.some(pr => pr.clusterId === xr.clusterId)
          ).length,
        },
      }
    : xamlLevelMailDiag;
  const xamlLevelDriftViolations = mailFamilyLockResult.crossFamilyViolations;
  const assemblerDrift = input.assemblerDriftViolations || [];
  const crossFamilyDriftViolations = [...xamlLevelDriftViolations, ...assemblerDrift];

  const perFileResults: PerFileValidation[] = enforcedEntries.map(entry => {
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

  const executablePathResult = validateExecutablePaths(xamlEntries, targetFramework);

  const contractIntegrityResult = validateContractIntegrity(xamlEntries);

  const postEmissionInvokeDefects = postEmissionInvokeValidator(xamlEntries);
  const allResidualDefects = [
    ...invokeCanonicalizationResult.residualExpressionSerializationDefects,
    ...postEmissionInvokeDefects,
  ];

  const mainXamlEntry = perFileResults.find(r => r.file === "Main.xaml");
  const entryPointHasBlockers = mainXamlEntry
    ? (mainXamlEntry.studioCompatibilityLevel === "studio-blocked" || mainXamlEntry.hasStubContent)
    : false;

  const hasStructuralBlockers = studioBlockedCount > 0;
  const hasStructuralWarnings = studioWarningsCount > 0;
  const hasAnyStubContent = perFileResults.some(r => r.hasStubContent);
  const qgIncomplete = qualityGateResult.completenessLevel === "incomplete";

  const hasResidualDefects = allResidualDefects.length > 0;
  const hasSymbolScopeDefects = targetValueResult.symbolScopeDefects.length > 0;
  const hasSentinelReplacements = targetValueResult.sentinelReplacements.length > 0;
  const hasUnresolvableJsonDefects = targetValueResult.unresolvableJsonDefects.length > 0;
  const hasRequiredPropertyDefects = requiredPropertyEnforcement.unresolvedRequiredPropertyDefects.length > 0;
  const hasExpressionLoweringFailures = requiredPropertyEnforcement.expressionLoweringFailures.length > 0;
  const hasInvalidSubstitutions = requiredPropertyEnforcement.invalidRequiredPropertySubstitutions.length > 0;
  const preComplianceGuardFailed = !preComplianceGuard.passed;
  const hasCriticalLoweringFailures = criticalLoweringDiagnostics.perStepResults.some(r => r.packageFatal);
  const hasDegradation = entryPointHasBlockers || hasStructuralBlockers || hasAnyStubContent || qgIncomplete || executablePathResult.hasExecutablePathContamination || graphValidation.hasWorkflowGraphIntegrityIssues || contractIntegrityResult.hasContractIntegrityIssues || hasResidualDefects || hasSymbolScopeDefects || hasSentinelReplacements || hasUnresolvableJsonDefects || hasRequiredPropertyDefects || hasExpressionLoweringFailures || hasInvalidSubstitutions || preComplianceGuardFailed || hasCriticalLoweringFailures;

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
  } else if (graphValidation.workflowGraphDefects.some(d => d.severity === "execution_blocking") || contractIntegrityResult.contractIntegrityDefects.some(d => d.severity === "execution_blocking" && d.origin !== "pipeline-fallback") || allResidualDefects.some(d => d.severity === "execution_blocking") || targetValueResult.sentinelReplacements.some(d => d.severity === "execution_blocking") || targetValueResult.symbolScopeDefects.some(d => d.severity === "execution_blocking") || hasUnresolvableJsonDefects || requiredPropertyEnforcement.unresolvedRequiredPropertyDefects.some(d => d.severity === "execution_blocking") || requiredPropertyEnforcement.expressionLoweringFailures.some(d => d.severity === "execution_blocking") || preComplianceGuardFailed || hasCriticalLoweringFailures) {
    derivedStatus = "structurally_invalid";
    const reasons: string[] = [];
    const graphBlockingCount = graphValidation.workflowGraphDefects.filter(d => d.severity === "execution_blocking").length;
    if (graphBlockingCount > 0) reasons.push(`${graphBlockingCount} execution-blocking workflow graph defect(s)`);
    // Task #527 RC5: exclude pipeline-fallback origin defects from the
    // structurally_invalid count. Pipeline-generated safe placeholder
    // defects still appear in reports with execution_blocking severity
    // but cannot themselves cause the artifact to be ruled structurally
    // invalid — they represent localized degradation, not structural failure.
    const contractBlockingCount = contractIntegrityResult.contractIntegrityDefects.filter(d => d.severity === "execution_blocking" && d.origin !== "pipeline-fallback").length;
    if (contractBlockingCount > 0) reasons.push(`${contractBlockingCount} execution-blocking contract integrity defect(s)`);
    const residualBlockingCount = allResidualDefects.filter(d => d.severity === "execution_blocking").length;
    if (residualBlockingCount > 0) reasons.push(`${residualBlockingCount} execution-blocking residual expression/invoke serialization defect(s)`);
    const sentinelBlockingCount = targetValueResult.sentinelReplacements.filter(d => d.severity === "execution_blocking").length;
    if (sentinelBlockingCount > 0) reasons.push(`${sentinelBlockingCount} sentinel replacement(s) applied as degradation substitutes`);
    const scopeBlockingCount = targetValueResult.symbolScopeDefects.filter(d => d.severity === "execution_blocking").length;
    if (scopeBlockingCount > 0) reasons.push(`${scopeBlockingCount} execution-blocking symbol scope defect(s)`);
    if (hasUnresolvableJsonDefects) reasons.push(`${targetValueResult.unresolvableJsonDefects.length} unresolvable JSON payload(s) replaced with degradation substitutes`);
    const reqPropBlockingCount = requiredPropertyEnforcement.unresolvedRequiredPropertyDefects.filter(d => d.severity === "execution_blocking").length;
    if (reqPropBlockingCount > 0) reasons.push(`${reqPropBlockingCount} unresolved required property defect(s)`);
    const exprLoweringBlockingCount = requiredPropertyEnforcement.expressionLoweringFailures.filter(d => d.severity === "execution_blocking").length;
    if (exprLoweringBlockingCount > 0) reasons.push(`${exprLoweringBlockingCount} expression lowering failure(s)`);
    if (preComplianceGuardFailed) reasons.push(`pre-compliance guard failed: ${preComplianceGuard.violations.length} sentinel violation(s) detected`);
    const loweringFatalCount = criticalLoweringDiagnostics.perStepResults.filter(r => r.packageFatal).length;
    if (loweringFatalCount > 0) reasons.push(`${loweringFatalCount} critical activity lowering failure(s)`);
    statusReason = `Structurally invalid: ${reasons.join(", ")} detected`;
  } else if (hasAnyStubContent || qgIncomplete || executablePathResult.hasExecutablePathContamination || graphValidation.workflowGraphDefects.some(d => d.severity === "handoff_required") || contractIntegrityResult.contractIntegrityDefects.some(d => d.severity === "handoff_required") || allResidualDefects.some(d => d.severity === "handoff_required") || hasSymbolScopeDefects || hasSentinelReplacements || requiredPropertyEnforcement.unresolvedRequiredPropertyDefects.some(d => d.severity === "handoff_required") || requiredPropertyEnforcement.expressionLoweringFailures.some(d => d.severity === "handoff_required")) {
    derivedStatus = "handoff_only";
    const reasons: string[] = [];
    if (hasAnyStubContent) reasons.push("stub content detected in finalized artifacts");
    if (qgIncomplete) reasons.push("quality gate completeness level: incomplete");
    if (executablePathResult.hasExecutablePathContamination) reasons.push(`${executablePathResult.executablePathDefects.length} executable-path defect(s) detected`);
    if (graphValidation.workflowGraphDefects.some(d => d.severity === "handoff_required")) {
      const handoffCount = graphValidation.workflowGraphDefects.filter(d => d.severity === "handoff_required").length;
      reasons.push(`${handoffCount} workflow graph integrity issue(s) require handoff`);
    }
    if (contractIntegrityResult.contractIntegrityDefects.some(d => d.severity === "handoff_required")) {
      const handoffCount = contractIntegrityResult.contractIntegrityDefects.filter(d => d.severity === "handoff_required").length;
      reasons.push(`${handoffCount} contract integrity issue(s) require handoff`);
    }
    if (allResidualDefects.some(d => d.severity === "handoff_required")) {
      const residualHandoffCount = allResidualDefects.filter(d => d.severity === "handoff_required").length;
      reasons.push(`${residualHandoffCount} residual expression/invoke serialization issue(s) require handoff`);
    }
    if (hasSymbolScopeDefects) {
      reasons.push(`${targetValueResult.symbolScopeDefects.length} symbol scope defect(s) with degradation substitutes`);
    }
    if (hasSentinelReplacements) {
      reasons.push(`${targetValueResult.sentinelReplacements.length} sentinel(s) replaced with degradation substitutes`);
    }
    if (requiredPropertyEnforcement.unresolvedRequiredPropertyDefects.some(d => d.severity === "handoff_required")) {
      const handoffCount = requiredPropertyEnforcement.unresolvedRequiredPropertyDefects.filter(d => d.severity === "handoff_required").length;
      reasons.push(`${handoffCount} unresolved required property defect(s) require handoff`);
    }
    if (requiredPropertyEnforcement.expressionLoweringFailures.some(d => d.severity === "handoff_required")) {
      const handoffCount = requiredPropertyEnforcement.expressionLoweringFailures.filter(d => d.severity === "handoff_required").length;
      reasons.push(`${handoffCount} expression lowering failure(s) require handoff`);
    }
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

  if (contractIntegrityResult.contractNormalizationActions.length > 0 && derivedStatus === "studio_stable") {
    statusReason = `${statusReason} (note: ${contractIntegrityResult.contractNormalizationActions.length} contract normalization(s) were applied — run was not clean from first principles)`;
  }

  const packageCompletenessViolations = buildPackageCompletenessViolations(
    perFileResults,
    xamlEntries,
    graphValidation.workflowGraphDefects,
    requiredPropertyEnforcement.unresolvedRequiredPropertyDefects,
    requiredPropertyEnforcement.expressionLoweringFailures,
    requiredPropertyEnforcement.invalidRequiredPropertySubstitutions,
    preComplianceGuard,
    contextMetadata.outcomeReport,
    criticalLoweringDiagnostics,
    mailFamilyLockDiag,
    crossFamilyDriftViolations,
  );

  if (!packageCompletenessViolations.packageViable && derivedStatus !== "structurally_invalid") {
    derivedStatus = "structurally_invalid";
    statusReason = `Package completeness violations prevent viable package: ${packageCompletenessViolations.summary.totalPackageFatalViolations} package-fatal violation(s) — ${statusReason}`;
  }

  console.log(`[Final Artifact Validation] Package completeness: viable=${packageCompletenessViolations.packageViable}, fatal=${packageCompletenessViolations.summary.totalPackageFatalViolations}, stubs=${packageCompletenessViolations.summary.totalStubSubstitutionsPrevented}, sentinels=${packageCompletenessViolations.summary.totalPlaceholderInjectionPrevented}, unwired=${packageCompletenessViolations.summary.totalUnwiredCriticalWorkflows}, missingProps=${packageCompletenessViolations.summary.totalCriticalMissingProperties}`);

  return {
    perFileResults,
    qualityGateResult,
    analysisReports,
    declarationValidation,
    enumCompliance,
    workflowGraphDefects: graphValidation.workflowGraphDefects,
    hasWorkflowGraphIntegrityIssues: graphValidation.hasWorkflowGraphIntegrityIssues,
    workflowGraphSummary: graphValidation.workflowGraphSummary,
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
    contractIntegrityDefects: contractIntegrityResult.contractIntegrityDefects,
    hasContractIntegrityIssues: contractIntegrityResult.hasContractIntegrityIssues,
    contractIntegritySummary: contractIntegrityResult.contractIntegritySummary,
    contractIntegritySummaryMetrics: contractIntegrityResult.contractIntegritySummaryMetrics,
    contractNormalizationActions: contractIntegrityResult.contractNormalizationActions,
    contractExtractionExclusions: contractIntegrityResult.contractExtractionExclusions,
    invokeSerializationFixes: invokeCanonicalizationResult.invokeSerializationFixes,
    residualExpressionSerializationDefects: allResidualDefects,
    expressionCanonicalizationFixes: targetValueResult.expressionCanonicalizationFixes,
    symbolScopeDefects: targetValueResult.symbolScopeDefects,
    unresolvableJsonDefects: targetValueResult.unresolvableJsonDefects,
    sentinelReplacements: targetValueResult.sentinelReplacements,
    targetValueCanonicalizationSummary: targetValueResult.summary,
    requiredPropertyBindings: requiredPropertyEnforcement.requiredPropertyBindings,
    unresolvedRequiredPropertyDefects: requiredPropertyEnforcement.unresolvedRequiredPropertyDefects,
    expressionLoweringFixes: requiredPropertyEnforcement.expressionLoweringFixes,
    expressionLoweringFailures: requiredPropertyEnforcement.expressionLoweringFailures,
    invalidRequiredPropertySubstitutions: requiredPropertyEnforcement.invalidRequiredPropertySubstitutions,
    totalInvalidSubstitutionsBlocked: requiredPropertyEnforcement.totalInvalidSubstitutionsBlocked,
    requiredPropertyEnforcementSummary: requiredPropertyEnforcement.summary,
    preComplianceGuardPassed: preComplianceGuard.passed,
    preComplianceGuardViolationCount: preComplianceGuard.violations.length,
    derivedStatus,
    statusReason,
    outcomeContext: contextMetadata.outcomeReport,
    traceabilityMetadata: {
      downgradeCount: contextMetadata.downgrades.length,
      usedAIFallback: contextMetadata.usedAIFallback,
      pipelineWarningCount: contextMetadata.pipelineWarnings.length,
      flatStructureWarningCount: contextMetadata.metaValidationFlatStructureWarnings || 0,
    },
    packageCompletenessViolations,
    packageViable: packageCompletenessViolations.packageViable,
    diagnostics: collectRunArtifactDiagnostics(),
    criticalActivityLoweringDiagnostics: criticalLoweringDiagnostics,
    mailFamilyLockDiagnostics: mailFamilyLockDiag,
    quoteRepairDiagnostics: _getQuoteRepairDiagnosticsSnapshot(),
  };
}

function _getQuoteRepairDiagnosticsSnapshot(): QuoteRepairDiagnosticsReport | undefined {
  const diag = getQuoteRepairDiagnostics();
  if (!diag || (diag.attempts.length === 0 && diag.activePathProof.length === 0)) {
    return undefined;
  }
  return diag;
}
