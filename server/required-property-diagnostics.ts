import { ACTIVITY_DEFINITIONS_REGISTRY } from "./catalog/activity-definitions";
import { isSentinelValue } from "./required-property-enforcer";

export type LossType = "value-loss" | "shape-loss" | null;

export interface RequiredPropertyTraceEntry {
  instanceId: string;
  workflowFile: string;
  activityType: string;
  displayName: string;
  requiredProperty: string;
  catalogXamlSyntax: "attribute" | "child-element";
  specStagePresent: boolean;
  specStageValue: string | null;
  specSentinelTriggered: boolean;
  preNormalizationStagePresent: boolean;
  loweringStagePresent: boolean;
  loweringStageOutcome: string | null;
  emissionGateDecision: "accept" | "correct" | "block" | "degrade" | "skip" | null;
  emissionStagePresent: boolean;
  emissionStageForm: "attribute" | "child-element" | "absent" | null;
  complianceStagePresent: boolean;
  enforcerStagePresent: boolean;
  enforcerStageOutcome: string | null;
  enforcerSentinelResolved: boolean;
  finalXamlStagePresent: boolean;
  lossStage: string | null;
  lossType: LossType;
  shapeChangeStage: string | null;
  rootCauseCategory: string | null;
  remediationHint: string | null;
}

export interface RequiredPropertyDiagnosticsResult {
  traces: RequiredPropertyTraceEntry[];
  summary: {
    totalTracked: number;
    totalPreserved: number;
    totalLost: number;
    totalShapeChanged: number;
    lossStageBreakdown: Record<string, number>;
    shapeChangeStageBreakdown: Record<string, number>;
  };
}

let _instanceCounter = 0;

function generateInstanceId(workflowFile: string, activityType: string, displayName: string): string {
  _instanceCounter++;
  return `${workflowFile}::${activityType}::${displayName}::${_instanceCounter}`;
}

export function resetInstanceCounter(): void {
  _instanceCounter = 0;
}

export function traceRequiredPropertyThroughSpec(
  activityType: string,
  specProperties: Record<string, any>,
  workflowFile: string,
  displayName?: string,
): RequiredPropertyTraceEntry[] {
  const strippedType = activityType.replace(/^ui:/, "");
  const traces: RequiredPropertyTraceEntry[] = [];
  const effectiveDisplayName = displayName || strippedType;

  for (const pkg of ACTIVITY_DEFINITIONS_REGISTRY) {
    const actDef = pkg.activities.find(a => a.className === strippedType);
    if (!actDef) continue;

    for (const propDef of actDef.properties) {
      if (!propDef.required) continue;

      const specValue = specProperties[propDef.name];
      const specPresent = specValue !== undefined && specValue !== null;
      const specValueStr = specPresent ? (typeof specValue === "string" ? specValue : JSON.stringify(specValue)) : null;
      const isPlaceholder = specValueStr !== null && isSentinelValue(specValueStr);
      const catalogSyntax: "attribute" | "child-element" = propDef.xamlSyntax === "child-element" ? "child-element" : "attribute";

      traces.push({
        instanceId: generateInstanceId(workflowFile, strippedType, effectiveDisplayName),
        workflowFile,
        activityType: strippedType,
        displayName: effectiveDisplayName,
        requiredProperty: propDef.name,
        catalogXamlSyntax: catalogSyntax,
        specStagePresent: specPresent && !isPlaceholder,
        specStageValue: specValueStr,
        specSentinelTriggered: isPlaceholder,
        preNormalizationStagePresent: specPresent && !isPlaceholder,
        loweringStagePresent: false,
        loweringStageOutcome: null,
        emissionGateDecision: null,
        emissionStagePresent: false,
        emissionStageForm: null,
        complianceStagePresent: false,
        enforcerStagePresent: false,
        enforcerStageOutcome: null,
        enforcerSentinelResolved: false,
        finalXamlStagePresent: false,
        lossStage: specPresent && !isPlaceholder ? null : "spec-generation",
        lossType: specPresent && !isPlaceholder ? null : "value-loss",
        shapeChangeStage: null,
        rootCauseCategory: specPresent && !isPlaceholder ? null : (isPlaceholder ? "placeholder-value" : "property-absent-at-spec"),
        remediationHint: specPresent && !isPlaceholder ? null : `Required property "${propDef.name}" on ${strippedType} was ${isPlaceholder ? "set to a placeholder" : "not present"} in the spec`,
      });
    }
    break;
  }

  return traces;
}

export function updateTraceAfterPreNormalization(
  traces: RequiredPropertyTraceEntry[],
  normalizedProperties: Record<string, any>,
): void {
  for (const trace of traces) {
    const value = normalizedProperties[trace.requiredProperty];
    const present = value !== undefined && value !== null;
    const valueStr = present ? (typeof value === "string" ? value : JSON.stringify(value)) : null;
    const isPlaceholder = valueStr !== null && isSentinelValue(valueStr);
    trace.preNormalizationStagePresent = present && !isPlaceholder;

    if (trace.specStagePresent && !trace.preNormalizationStagePresent && !trace.lossStage) {
      trace.lossStage = "pre-lowering-normalization";
      trace.lossType = "value-loss";
      trace.rootCauseCategory = "normalization-loss";
      trace.remediationHint = `Property "${trace.requiredProperty}" on ${trace.activityType} was present in spec but lost during pre-lowering normalization`;
    }
  }
}

export function updateTraceAfterLowering(
  traces: RequiredPropertyTraceEntry[],
  loweringOutcome: string,
  missingProperties: string[],
): void {
  for (const trace of traces) {
    const isMissing = missingProperties.includes(trace.requiredProperty);
    trace.loweringStagePresent = !isMissing && trace.preNormalizationStagePresent;
    trace.loweringStageOutcome = loweringOutcome;

    if (loweringOutcome === "lowered") {
      trace.emissionGateDecision = isMissing ? "correct" : "accept";
    } else if (loweringOutcome === "rejected_incomplete_contract") {
      trace.emissionGateDecision = "block";
    } else if (loweringOutcome === "degraded_fallback") {
      trace.emissionGateDecision = "degrade";
    } else if (loweringOutcome === "skipped_not_critical") {
      trace.emissionGateDecision = "skip";
    }

    if (trace.preNormalizationStagePresent && isMissing && !trace.lossStage) {
      trace.lossStage = "critical-activity-lowering";
      trace.lossType = "value-loss";
      trace.rootCauseCategory = "lowering-rejected-incomplete";
      trace.remediationHint = `Property "${trace.requiredProperty}" on ${trace.activityType} was present in spec but flagged missing by lowering (possible naming mismatch)`;
    }
  }
}

function scanXamlForProperty(
  xamlContent: string,
  activityTag: string,
  propertyName: string,
  instanceDisplayName: string,
): { present: boolean; form: "attribute" | "child-element" | "absent" } {
  const displayNameEscaped = instanceDisplayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selfClosingPattern = new RegExp(
    `<${activityTag}\\s[^>]*?DisplayName="${displayNameEscaped}"[^>]*?/>`,
    "m"
  );
  const openClosePattern = new RegExp(
    `<${activityTag}\\s[^>]*?DisplayName="${displayNameEscaped}"[^>]*?>[\\s\\S]*?</${activityTag}>`,
    "m"
  );
  const selfClosingMatch = xamlContent.match(selfClosingPattern);
  const openCloseMatch = xamlContent.match(openClosePattern);
  let searchScope: string;
  let instanceResolved = true;
  if (openCloseMatch) {
    searchScope = openCloseMatch[0];
  } else if (selfClosingMatch) {
    searchScope = selfClosingMatch[0];
  } else {
    instanceResolved = false;
    searchScope = xamlContent;
  }

  const attrPattern = new RegExp(`(?:^|\\s)${propertyName}="`, "m");
  const childPattern = new RegExp(`<${activityTag}\\.${propertyName}[\\s>]`);

  const hasAttr = attrPattern.test(searchScope);
  const hasChild = childPattern.test(searchScope);

  return {
    present: hasAttr || hasChild,
    form: hasAttr ? "attribute" : hasChild ? "child-element" : "absent",
  };
}

export function updateTraceAfterEmission(
  traces: RequiredPropertyTraceEntry[],
  xamlContent: string,
  activityTag: string,
): void {
  for (const trace of traces) {
    const result = scanXamlForProperty(xamlContent, activityTag, trace.requiredProperty, trace.displayName);
    trace.emissionStagePresent = result.present;
    trace.emissionStageForm = result.form;

    if (trace.loweringStagePresent && !trace.emissionStagePresent && !trace.lossStage) {
      trace.lossStage = "workflow-tree-assembler";
      trace.lossType = "value-loss";
      trace.rootCauseCategory = "emission-shape-loss";
      trace.remediationHint = `Property "${trace.requiredProperty}" on ${trace.activityType} (instance "${trace.displayName}") survived lowering but was not emitted in XAML (possible naming mismatch between spec property key and catalog property name)`;
    }

    if (trace.emissionStagePresent && trace.catalogXamlSyntax !== trace.emissionStageForm && !trace.shapeChangeStage) {
      trace.shapeChangeStage = "workflow-tree-assembler";
    }
  }
}

export function updateTraceAfterCompliance(
  traces: RequiredPropertyTraceEntry[],
  compliantXaml: string,
  activityTag: string,
): void {
  for (const trace of traces) {
    const result = scanXamlForProperty(compliantXaml, activityTag, trace.requiredProperty, trace.displayName);
    trace.complianceStagePresent = result.present;

    if (trace.emissionStagePresent && !trace.complianceStagePresent && !trace.lossStage) {
      trace.lossStage = "xaml-compliance";
      trace.lossType = "value-loss";
      trace.rootCauseCategory = "compliance-stripping";
      trace.remediationHint = `Property "${trace.requiredProperty}" on ${trace.activityType} (instance "${trace.displayName}") was emitted but stripped during compliance normalization`;
    }

    if (trace.complianceStagePresent && trace.emissionStageForm && result.form !== trace.emissionStageForm && !trace.shapeChangeStage) {
      trace.shapeChangeStage = "xaml-compliance";
    }
  }
}

export function updateTraceAfterEnforcement(
  traces: RequiredPropertyTraceEntry[],
  enforcerBindings: Array<{ activityType: string; propertyName: string; displayName?: string; occurrenceIndex?: number }>,
  enforcerDefects: Array<{ activityType: string; propertyName: string; displayName?: string; occurrenceIndex?: number }>,
): void {
  for (const trace of traces) {
    const matchesInstance = (entry: { activityType: string; propertyName: string; displayName?: string }) => {
      if (entry.activityType !== trace.activityType || entry.propertyName !== trace.requiredProperty) return false;
      if (entry.displayName && entry.displayName !== trace.displayName) return false;
      return true;
    };

    const bound = enforcerBindings.some(matchesInstance);
    const defect = enforcerDefects.some(matchesInstance);

    if (bound) {
      trace.enforcerStagePresent = true;
      trace.enforcerStageOutcome = "bound";
      trace.enforcerSentinelResolved = trace.specSentinelTriggered;
    } else if (defect) {
      trace.enforcerStagePresent = false;
      trace.enforcerStageOutcome = "defect";
      if (!trace.lossStage) {
        trace.lossStage = "required-property-enforcer";
        trace.lossType = "value-loss";
        trace.rootCauseCategory = "enforcer-defect";
        trace.remediationHint = `Property "${trace.requiredProperty}" on ${trace.activityType} (instance "${trace.displayName}") was flagged as a defect by the required-property enforcer`;
      }
    } else if (trace.complianceStagePresent || trace.emissionStagePresent) {
      trace.enforcerStagePresent = true;
      trace.enforcerStageOutcome = "already-present";
    }
  }
}

export function updateTraceAfterFinalXaml(
  traces: RequiredPropertyTraceEntry[],
  finalXaml: string,
  activityTag: string,
): void {
  for (const trace of traces) {
    const result = scanXamlForProperty(finalXaml, activityTag, trace.requiredProperty, trace.displayName);
    trace.finalXamlStagePresent = result.present;

    if ((trace.enforcerStagePresent || trace.complianceStagePresent) && !trace.finalXamlStagePresent && !trace.lossStage) {
      trace.lossStage = "final-archive";
      trace.lossType = "value-loss";
      trace.rootCauseCategory = "post-enforcement-loss";
      trace.remediationHint = `Property "${trace.requiredProperty}" on ${trace.activityType} (instance "${trace.displayName}") was present after enforcement but missing in final archived XAML`;
    }

    if (trace.finalXamlStagePresent && trace.emissionStageForm && result.form !== trace.emissionStageForm && !trace.shapeChangeStage) {
      trace.shapeChangeStage = "final-archive";
    }
  }
}

export function buildDiagnosticsResult(traces: RequiredPropertyTraceEntry[]): RequiredPropertyDiagnosticsResult {
  const lossStageBreakdown: Record<string, number> = {};
  const shapeChangeStageBreakdown: Record<string, number> = {};
  let totalPreserved = 0;
  let totalLost = 0;
  let totalShapeChanged = 0;

  for (const trace of traces) {
    if (trace.lossStage) {
      totalLost++;
      lossStageBreakdown[trace.lossStage] = (lossStageBreakdown[trace.lossStage] || 0) + 1;
    } else {
      totalPreserved++;
    }
    if (trace.shapeChangeStage) {
      totalShapeChanged++;
      shapeChangeStageBreakdown[trace.shapeChangeStage] = (shapeChangeStageBreakdown[trace.shapeChangeStage] || 0) + 1;
    }
  }

  return {
    traces,
    summary: {
      totalTracked: traces.length,
      totalPreserved,
      totalLost,
      totalShapeChanged,
      lossStageBreakdown,
      shapeChangeStageBreakdown,
    },
  };
}

export function detectPropertyNameMismatch(
  activityType: string,
  specPropertyKeys: string[],
): Array<{ specKey: string; catalogKey: string; mismatchType: string }> {
  const strippedType = activityType.replace(/^ui:/, "");
  const mismatches: Array<{ specKey: string; catalogKey: string; mismatchType: string }> = [];

  for (const pkg of ACTIVITY_DEFINITIONS_REGISTRY) {
    const actDef = pkg.activities.find(a => a.className === strippedType);
    if (!actDef) continue;

    const catalogRequiredNames = actDef.properties
      .filter(p => p.required)
      .map(p => p.name);

    for (const catalogName of catalogRequiredNames) {
      const exactMatch = specPropertyKeys.includes(catalogName);
      if (!exactMatch) {
        const caseInsensitiveMatch = specPropertyKeys.find(
          k => k.toLowerCase() === catalogName.toLowerCase()
        );
        if (caseInsensitiveMatch) {
          mismatches.push({
            specKey: caseInsensitiveMatch,
            catalogKey: catalogName,
            mismatchType: "case-mismatch",
          });
        } else {
          const partialMatch = specPropertyKeys.find(
            k => catalogName.toLowerCase().includes(k.toLowerCase()) ||
                 k.toLowerCase().includes(catalogName.toLowerCase())
          );
          if (partialMatch) {
            mismatches.push({
              specKey: partialMatch,
              catalogKey: catalogName,
              mismatchType: "partial-name-overlap",
            });
          }
        }
      }
    }
    break;
  }

  return mismatches;
}
