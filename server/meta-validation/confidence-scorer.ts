export type ErrorCategory =
  | "ENUM_VIOLATIONS"
  | "NESTED_ARGUMENTS"
  | "LITERAL_EXPRESSIONS"
  | "MISSING_PROPERTIES"
  | "UNDECLARED_VARIABLES"
  | "FLAT_STRUCTURE";

export interface ConfidenceSignal {
  name: string;
  weight: number;
  triggered: boolean;
  mappedCategories: ErrorCategory[];
}

export interface ConfidenceScore {
  score: number;
  signals: ConfidenceSignal[];
  triggeredCategories: ErrorCategory[];
  shouldEngage: boolean;
  reason: string;
}

export interface EntryWorkflowMetadata {
  isPreviouslyStubbed?: boolean;
  invokeWorkflowFileCount?: number;
  hasReFramework?: boolean;
  activityCount?: number;
  hasCatalogViolations?: boolean;
}

export interface ConfidenceScorerInput {
  workflowCount: number;
  activityCount: number;
  templateComplianceScore?: number;
  catalogViolationCount?: number;
  uncataloguedActivityCount?: number;
  hasExternalSystems?: boolean;
  hasReFramework?: boolean;
  hasAdvancedServices?: boolean;
  hasDocumentUnderstanding?: boolean;
  hasAICenter?: boolean;
  priorGenerationHadStubs?: boolean;
  isFirstGeneration?: boolean;
  qualityGateWarningCount?: number;
  entryWorkflow?: EntryWorkflowMetadata;
}

const SIGNAL_DEFINITIONS: Array<{
  name: string;
  weight: number;
  test: (input: ConfidenceScorerInput) => boolean;
  categories: ErrorCategory[];
}> = [
  {
    name: "low_template_compliance",
    weight: 0.25,
    test: (i) => (i.templateComplianceScore ?? 1.0) < 0.9,
    categories: ["ENUM_VIOLATIONS", "NESTED_ARGUMENTS", "LITERAL_EXPRESSIONS"],
  },
  {
    name: "catalog_violations",
    weight: 0.20,
    test: (i) => (i.catalogViolationCount ?? 0) > 0,
    categories: ["ENUM_VIOLATIONS", "MISSING_PROPERTIES", "NESTED_ARGUMENTS"],
  },
  {
    name: "uncatalogued_activities",
    weight: 0.15,
    test: (i) => (i.uncataloguedActivityCount ?? 0) > 0,
    categories: ["MISSING_PROPERTIES"],
  },
  {
    name: "high_complexity",
    weight: 0.20,
    test: (i) => i.workflowCount > 4 || i.activityCount > 50,
    categories: ["FLAT_STRUCTURE", "UNDECLARED_VARIABLES"],
  },
  {
    name: "prior_stubs",
    weight: 0.25,
    test: (i) => i.priorGenerationHadStubs === true,
    categories: ["FLAT_STRUCTURE", "UNDECLARED_VARIABLES", "NESTED_ARGUMENTS"],
  },
  {
    name: "advanced_services",
    weight: 0.15,
    test: (i) => i.hasDocumentUnderstanding === true || i.hasAICenter === true,
    categories: ["MISSING_PROPERTIES"],
  },
  {
    name: "reframework",
    weight: 0.15,
    test: (i) => i.hasReFramework === true,
    categories: ["UNDECLARED_VARIABLES", "MISSING_PROPERTIES"],
  },
  {
    name: "external_systems",
    weight: 0.10,
    test: (i) => i.hasExternalSystems === true,
    categories: ["MISSING_PROPERTIES", "ENUM_VIOLATIONS"],
  },
  {
    name: "first_generation",
    weight: 0.10,
    test: (i) => i.isFirstGeneration === true,
    categories: ["NESTED_ARGUMENTS", "LITERAL_EXPRESSIONS"],
  },
  {
    name: "quality_gate_warnings",
    weight: 0.15,
    test: (i) => (i.qualityGateWarningCount ?? 0) > 2,
    categories: ["ENUM_VIOLATIONS", "MISSING_PROPERTIES"],
  },
];

const TOTAL_POSSIBLE_WEIGHT = SIGNAL_DEFINITIONS.reduce((sum, s) => sum + s.weight, 0);

const AUTO_ENGAGE_THRESHOLD = 0.6;

export function calculateConfidenceScore(input: ConfidenceScorerInput): ConfidenceScore {
  const signals: ConfidenceSignal[] = [];
  let triggeredWeight = 0;
  const categorySet = new Set<ErrorCategory>();

  categorySet.add("LITERAL_EXPRESSIONS");

  for (const def of SIGNAL_DEFINITIONS) {
    const triggered = def.test(input);
    signals.push({
      name: def.name,
      weight: def.weight,
      triggered,
      mappedCategories: def.categories,
    });
    if (triggered) {
      triggeredWeight += def.weight;
      for (const cat of def.categories) {
        categorySet.add(cat);
      }
    }
  }

  const score = triggeredWeight / TOTAL_POSSIBLE_WEIGHT;
  let shouldEngage = score >= AUTO_ENGAGE_THRESHOLD;

  const triggeredNames = signals.filter(s => s.triggered).map(s => s.name);

  let hardEngageReason = "";

  const catalogTriggered = signals.find(s => s.name === "catalog_violations")?.triggered ?? false;
  const lowComplianceTriggered = signals.find(s => s.name === "low_template_compliance")?.triggered ?? false;
  if (catalogTriggered && lowComplianceTriggered) {
    shouldEngage = true;
    hardEngageReason = "Hard-engage: catalog_violations + low_template_compliance both triggered";
  }

  if (input.entryWorkflow) {
    const ew = input.entryWorkflow;
    const entryRiskConditions: string[] = [];
    if (ew.isPreviouslyStubbed) entryRiskConditions.push("Main.xaml previously stubbed");
    if ((ew.invokeWorkflowFileCount ?? 0) >= 3) entryRiskConditions.push(`${ew.invokeWorkflowFileCount} InvokeWorkflowFile activities in entry workflow`);
    if (ew.hasReFramework) entryRiskConditions.push("ReFramework in entry workflow");
    if ((ew.activityCount ?? 0) > 20) entryRiskConditions.push(`${ew.activityCount} activities in Main.xaml (>20)`);
    if (ew.hasCatalogViolations) entryRiskConditions.push("Main.xaml has catalog violations");

    if (entryRiskConditions.length > 0) {
      shouldEngage = true;
      hardEngageReason = hardEngageReason
        ? `${hardEngageReason}; Entry-workflow risk: ${entryRiskConditions.join(", ")}`
        : `Hard-engage entry-workflow risk: ${entryRiskConditions.join(", ")}`;
    }
  }

  let reason: string;
  if (hardEngageReason) {
    reason = `${hardEngageReason} (score=${score.toFixed(2)}, triggered: ${triggeredNames.join(", ")})`;
  } else {
    reason = shouldEngage
      ? `Score ${score.toFixed(2)} >= ${AUTO_ENGAGE_THRESHOLD} threshold (triggered: ${triggeredNames.join(", ")})`
      : `Score ${score.toFixed(2)} < ${AUTO_ENGAGE_THRESHOLD} threshold`;
  }

  return {
    score,
    signals,
    triggeredCategories: Array.from(categorySet),
    shouldEngage,
    reason,
  };
}

export { AUTO_ENGAGE_THRESHOLD, TOTAL_POSSIBLE_WEIGHT };
