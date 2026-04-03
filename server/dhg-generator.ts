import type {
  PipelineOutcomeReport,
  RemediationEntry,
  PerWorkflowStudioCompatibility,
} from "./uipath-pipeline";
import type { DhgAnalysisResult, SddArtifactCrossReference } from "./xaml/dhg-analyzers";
import type { FinalQualityReport } from "./final-artifact-validation";

export interface HandoffBlockEntry {
  file: string;
  blockType: string;
  displayName: string;
  businessDescription: string;
  businessRule: string;
  expectedInputs: string;
  expectedOutputs: string;
  developerAction: string;
  estimatedEffortMinutes: number;
  containedActivities: string;
  remediationCode?: string;
  line?: number;
}

export interface BindPointEntry {
  file: string;
  displayName: string;
  system: string;
  detail: string;
  estimatedEffortMinutes: number;
}

export interface BindPointSummary {
  entries: BindPointEntry[];
  totalCount: number;
  totalEffortMinutes: number;
  byWorkflow: Map<string, BindPointEntry[]>;
}

export function estimateBindPointEffort(system: string): number {
  const s = system.toLowerCase();
  if (s.includes("queue") || s.includes("action center") || s.includes("data service")) return 45;
  if (s.includes("genai") || s.includes("ai center") || s.includes("ml skill") || s.includes("document understanding")) return 40;
  if (s.includes("gmail") || s.includes("http") || s.includes("calendar") || s.includes("outlook") || s.includes("excel")) return 30;
  if (s.includes("sap") || s.includes("salesforce") || s.includes("servicenow") || s.includes("oracle")) return 35;
  return 25;
}

export function summarizeBindPoints(xamlEntries: { name: string; content: string }[]): BindPointSummary {
  const entries: BindPointEntry[] = [];
  const byWorkflow = new Map<string, BindPointEntry[]>();

  const logMessageTagPattern = /<[\w]*:?LogMessage\b([^>]*?)\/?>|<[\w]*:?LogMessage\b([^>]*?)>[\s\S]*?<\/[\w]*:?LogMessage>/gi;
  const displayNameAttrPattern = /DisplayName\s*=\s*"([^"]*)"/i;
  const messageAttrPattern = /Message\s*=\s*"([^"]*)"/i;

  for (const entry of xamlEntries) {
    const baseName = entry.name.split("/").pop() || entry.name;
    let tagMatch: RegExpExecArray | null;
    const regex = new RegExp(logMessageTagPattern.source, logMessageTagPattern.flags);

    while ((tagMatch = regex.exec(entry.content)) !== null) {
      const fullElement = tagMatch[0];

      const dnMatch = fullElement.match(displayNameAttrPattern);
      if (!dnMatch) continue;
      const displayName = dnMatch[1];

      if (!/bind\s*point/i.test(displayName)) continue;

      const systemMatch = displayName.match(/bind\s*point[:\s\-]*(.+)/i);
      const system = systemMatch ? systemMatch[1].trim() : "Unknown";

      const msgMatch = fullElement.match(messageAttrPattern);
      const detail = msgMatch ? msgMatch[1] : "";

      const bp: BindPointEntry = {
        file: baseName,
        displayName,
        system,
        detail,
        estimatedEffortMinutes: estimateBindPointEffort(system),
      };

      entries.push(bp);

      const wfKey = baseName.replace(/\.xaml$/i, "");
      if (!byWorkflow.has(wfKey)) byWorkflow.set(wfKey, []);
      byWorkflow.get(wfKey)!.push(bp);
    }
  }

  return {
    entries,
    totalCount: entries.length,
    totalEffortMinutes: entries.reduce((sum, e) => sum + e.estimatedEffortMinutes, 0),
    byWorkflow,
  };
}

export interface DhgContext {
  projectName: string;
  workflowNames: string[];
  generationMode?: "full_implementation" | "baseline_openable";
  generationModeReason?: string;
  generatedDate?: string;
  analysis?: DhgAnalysisResult;
  finalQualityReport?: FinalQualityReport;
  bindPointSummary?: BindPointSummary;
  sddBusinessStepsByWorkflow?: Map<string, number>;
}

interface WorkflowTierClassification {
  name: string;
  tier: "generated" | "handoff" | "stub" | "blocked";
  isFullyGenerated: boolean;
  isStubbed: boolean;
  isStudioBlocked: boolean;
  hasHandoffBlocks: boolean;
  hasRemediations: boolean;
  hasPlaceholders: boolean;
  failureSummary?: string;
  studioLevel?: string;
  remediationCount: number;
  handoffBlockCount: number;
  propertyRemediationCount: number;
  bindPointCount: number;
  preservedSteps: number;
  degradedSteps: number;
  manualSteps: number;
  totalSteps: number;
}

function classifyWorkflows(
  report: PipelineOutcomeReport,
  context: DhgContext,
): WorkflowTierClassification[] {
  const fqr = context.finalQualityReport;
  const studioCompat = report.studioCompatibility || [];
  const activityRemediations = report.remediations.filter(r => r.level === "activity");
  const sequenceRemediations = report.remediations.filter(r => r.level === "sequence");
  const structuralLeafRemediations = report.remediations.filter(r => r.level === "structural-leaf");
  const workflowRemediations = report.remediations.filter(r => r.level === "workflow");
  const degradedItems = report.emissionGateViolations?.details.filter(v => v.resolution === "degraded") || [];
  const stubbedEmissions = report.emissionGateViolations?.details.filter(v => v.resolution === "stubbed") || [];

  const seenWfNames = new Set<string>();
  const deduplicatedNames = context.workflowNames.filter(wf => {
    const normalized = wf.replace(/\.xaml$/i, "").toLowerCase();
    if (seenWfNames.has(normalized)) return false;
    seenWfNames.add(normalized);
    return true;
  });

  return deduplicatedNames.map(wf => {
    const wfFile = `${wf}.xaml`;
    let isStubbed: boolean;
    let isStudioBlocked = false;
    let failureSummary: string | undefined;
    let isFullyGenerated: boolean;
    let hasRemediation: boolean;
    let hasPlaceholders: boolean;
    let studioLevel: string | undefined;

    if (fqr) {
      const fqrEntry = fqr.perFileResults.find(r => r.file === wfFile || r.file === wf);
      isStubbed = fqrEntry?.hasStubContent ?? false;
      isStudioBlocked = fqrEntry?.studioCompatibilityLevel === "studio-blocked";
      studioLevel = fqrEntry?.studioCompatibilityLevel;
      if (isStudioBlocked && fqrEntry) {
        failureSummary = fqrEntry.blockers.slice(0, 2).join("; ");
      }
      isFullyGenerated = fqrEntry ? !fqrEntry.hasStubContent && fqrEntry.studioCompatibilityLevel !== "studio-blocked" : false;
      hasRemediation = [...report.remediations, ...report.propertyRemediations].some(
        r => r.file === wfFile || r.file === wf
      );
      hasPlaceholders = report.qualityWarnings.some(
        w => w.check === "placeholder-value" && (w.file === wfFile || w.file === wf)
      );
    } else {
      isStubbed = report.remediations.some(
        r => (r.remediationCode === "STUB_WORKFLOW_GENERATOR_FAILURE" || r.remediationCode === "STUB_WORKFLOW_BLOCKING") && (r.file === wfFile || r.file === wf)
      );
      const studioEntry = studioCompat.find(
        (s: PerWorkflowStudioCompatibility) => s.file === wfFile || s.file === wf
      );
      isStudioBlocked = studioEntry?.level === "studio-blocked";
      studioLevel = studioEntry?.level;
      failureSummary = studioEntry?.failureSummary;
      isFullyGenerated = report.fullyGeneratedFiles.some(f => f === wfFile || f === wf);
      hasRemediation = [...report.remediations, ...report.propertyRemediations].some(
        r => r.file === wfFile || r.file === wf
      );
      hasPlaceholders = report.qualityWarnings.some(
        w => w.check === "placeholder-value" && (w.file === wfFile || w.file === wf)
      );
    }

    const wfActivityRems = activityRemediations.filter(r => r.file === wfFile || r.file === wf);
    const wfSequenceRems = sequenceRemediations.filter(r => r.file === wfFile || r.file === wf);
    const wfStructuralLeafRems = structuralLeafRemediations.filter(r => r.file === wfFile || r.file === wf);
    const wfWorkflowRems = workflowRemediations.filter(r => r.file === wfFile || r.file === wf);
    const wfDegraded = degradedItems.filter(d => d.file === wfFile || d.file === wf);
    const wfStubbedEmissions = stubbedEmissions.filter(s => s.file === wfFile || s.file === wf);
    const wfPropertyRems = report.propertyRemediations.filter(r => r.file === wfFile || r.file === wf);
    const wfBindPoints = context.bindPointSummary?.byWorkflow.get(wf) || [];

    const handoffBlockCount = wfDegraded.length + wfActivityRems.length + wfSequenceRems.length + wfStructuralLeafRems.length + wfStubbedEmissions.length;
    const hasHandoffBlocks = handoffBlockCount > 0;

    const isWorkflowStub = wfWorkflowRems.length > 0 || (isStubbed && !hasHandoffBlocks);

    const spMetrics = report.structuralPreservationMetrics?.find(m => m.file === wfFile || m.file === wf);
    const sddStepCount = context.sddBusinessStepsByWorkflow?.get(wf);
    const totalSteps = sddStepCount ?? spMetrics?.totalActivities ?? (hasRemediation ? handoffBlockCount + wfPropertyRems.length + 1 : 1);
    const degradedSteps = handoffBlockCount;
    const manualSteps = isWorkflowStub ? totalSteps : handoffBlockCount + wfPropertyRems.length + wfBindPoints.length;
    const preservedSteps = Math.max(0, totalSteps - degradedSteps - (isWorkflowStub ? totalSteps : 0));

    let tier: "generated" | "handoff" | "stub" | "blocked";
    if (isWorkflowStub) {
      tier = "stub";
    } else if (isStudioBlocked) {
      tier = "blocked";
    } else if (hasHandoffBlocks) {
      tier = "handoff";
    } else {
      tier = "generated";
    }

    return {
      name: wf,
      tier,
      isFullyGenerated: isFullyGenerated && !hasHandoffBlocks,
      isStubbed: isWorkflowStub,
      isStudioBlocked,
      hasHandoffBlocks,
      hasRemediations: hasRemediation,
      hasPlaceholders,
      failureSummary,
      studioLevel,
      remediationCount: wfActivityRems.length + wfSequenceRems.length + wfStructuralLeafRems.length + wfWorkflowRems.length,
      handoffBlockCount,
      propertyRemediationCount: wfPropertyRems.length,
      bindPointCount: wfBindPoints.length,
      preservedSteps,
      degradedSteps,
      manualSteps,
      totalSteps,
    };
  });
}

export function generateDhgFromOutcomeReport(
  report: PipelineOutcomeReport,
  context: DhgContext,
): string {
  const date = context.generatedDate || new Date().toISOString().split("T")[0];
  let sectionNum = 0;
  let md = "";

  md += `# Developer Handoff Guide\n\n`;
  md += `**Project:** ${context.projectName}\n`;
  md += `**Generated:** ${date}\n`;
  if (context.generationMode) {
    const modeLabel = context.generationMode === "baseline_openable"
      ? "Baseline Openable (minimal, deterministic)"
      : "Full Implementation";
    md += `**Generation Mode:** ${modeLabel}\n`;
    if (context.generationModeReason) md += `**Mode Reason:** ${context.generationModeReason}\n`;
  }

  const totalPropertyRemediations = report.propertyRemediations.length;
  const totalActivityRemediations = report.remediations.filter(r => r.level === "activity").length;
  const totalSequenceRemediations = report.remediations.filter(r => r.level === "sequence").length;
  const totalStructuralLeafRemediations = report.remediations.filter(r => r.level === "structural-leaf").length;
  const totalWorkflowRemediations = report.remediations.filter(r => r.level === "workflow").length;
  const totalRemediations = totalPropertyRemediations + report.remediations.length;

  const hasStubs = context.finalQualityReport
    ? context.finalQualityReport.perFileResults.some(r => r.hasStubContent)
    : (totalWorkflowRemediations > 0 || totalActivityRemediations > 0 || totalSequenceRemediations > 0 || totalStructuralLeafRemediations > 0);
  const hasStructuralDefects = context.finalQualityReport
    ? context.finalQualityReport.aggregatedStats.studioBlockedCount > 0
    : (report.studioCompatibility?.some(
        (sc: PerWorkflowStudioCompatibility) => sc.level === "studio-blocked"
      ) ?? false);
  const transitiveDependencyWarnings = report.qualityWarnings.filter(
    w => w.check === "transitive-dependency-missing" || w.check === "error-activity-reference" || w.check === "unresolved-type-argument"
  );

  if (context.analysis) {
    const r = context.analysis.readiness;
    let adjustedPercent = r.percent;
    let adjustedRating = r.rating;
    if ((hasStubs || hasStructuralDefects) && adjustedPercent > 69) {
      adjustedPercent = Math.min(adjustedPercent, 69);
      adjustedRating = adjustedPercent >= 65 ? "Mostly Ready" : adjustedPercent >= 40 ? "Needs Work" : "Not Ready";
    }
    if (transitiveDependencyWarnings.length > 0 && adjustedPercent > 79) {
      adjustedPercent = Math.min(adjustedPercent, 79);
      adjustedRating = adjustedPercent >= 65 ? "Mostly Ready" : adjustedPercent >= 40 ? "Needs Work" : "Not Ready";
    }
    if (context.generationMode === "baseline_openable" && context.bindPointSummary && context.bindPointSummary.totalCount > 0) {
      const bpCap = context.bindPointSummary.totalCount >= 5 ? 45 : 55;
      if (adjustedPercent > bpCap) {
        adjustedPercent = bpCap;
      }
      adjustedRating = adjustedPercent >= 85 ? "Ready"
        : adjustedPercent >= 65 ? "Mostly Ready"
        : adjustedPercent >= 40 ? "Needs Work"
        : "Not Ready";
    }
    md += `**Deployment Readiness:** ${adjustedRating} (${adjustedPercent}%)\n`;
  }

  md += `\n`;

  const wfClassifications = classifyWorkflows(report, context);
  const fullyGeneratedCount = wfClassifications.filter(c => c.tier === "generated").length;
  const handoffCount = wfClassifications.filter(c => c.tier === "handoff").length;
  const workflowStubCount = wfClassifications.filter(c => c.isStubbed).length;
  const studioBlockedOnly = wfClassifications.filter(c => c.tier === "blocked").length;
  const totalWorkflows = wfClassifications.length;

  let tierSummary = `**${totalWorkflows} workflow${totalWorkflows !== 1 ? "s" : ""}: ${fullyGeneratedCount} fully generated, ${handoffCount} with handoff blocks, ${workflowStubCount} workflow-level stub${workflowStubCount !== 1 ? "s" : ""}`;
  if (studioBlockedOnly > 0) {
    tierSummary += `, ${studioBlockedOnly} Studio-blocked`;
  }
  tierSummary += `**\n`;
  md += tierSummary;
  md += `**Total Estimated Effort: ~${report.totalEstimatedEffortMinutes} minutes (${(report.totalEstimatedEffortMinutes / 60).toFixed(1)} hours)**\n`;
  md += `**Remediations:** ${totalRemediations} total (${totalPropertyRemediations} property, ${totalActivityRemediations} activity, ${totalSequenceRemediations} sequence, ${totalStructuralLeafRemediations} structural-leaf, ${totalWorkflowRemediations} workflow)\n`;
  md += `**Auto-Repairs:** ${report.autoRepairs.length}\n`;
  md += `**Quality Warnings:** ${report.qualityWarnings.length}\n`;
  md += `\n---\n\n`;

  if (wfClassifications.length > 0) {
    const hasSddSteps = context.sddBusinessStepsByWorkflow && context.sddBusinessStepsByWorkflow.size > 0;
    const stepsLabel = hasSddSteps ? "Business Steps (SDD)" : "Total Steps";
    md += `### Per-Workflow Preservation Summary\n\n`;
    md += `| # | Workflow | Tier | ${stepsLabel} | Preserved | Degraded (Handoff) | Manual | Bind Points |\n`;
    md += `|---|----------|------|-------------|-----------|-------------------|--------|-------------|\n`;
    wfClassifications.forEach((wfc, i) => {
      const tierLabel = wfc.tier === "generated" ? "Generated" : wfc.tier === "handoff" ? "Handoff" : wfc.tier === "blocked" ? "Blocked" : "Stub";
      md += `| ${i + 1} | \`${wfc.name}.xaml\` | ${tierLabel} | ${wfc.totalSteps} | ${wfc.preservedSteps} | ${wfc.degradedSteps} | ${wfc.manualSteps} | ${wfc.bindPointCount} |\n`;
    });
    md += `\n`;
  }

  sectionNum++;
  md += `## ${sectionNum}. Generated Logic (ready to use)\n\n`;
  md += `Generated XAML that is Studio-openable and does not contain handoff blocks or workflow-level stubs. May include auto-resolved property remediations or placeholders for fine-tuning.\n\n`;

  const generatedWorkflows = wfClassifications.filter(c => c.tier === "generated");
  if (generatedWorkflows.length > 0) {
    md += `The following ${generatedWorkflows.length} workflow(s) were fully generated and are ready to use:\n\n`;
    md += `| # | Workflow | Status | Studio Compatibility |\n`;
    md += `|---|----------|--------|---------------------|\n`;
    generatedWorkflows.forEach((wfc, i) => {
      let status: string;
      if (wfc.isFullyGenerated && !wfc.hasPlaceholders && !wfc.hasRemediations) {
        status = "Fully Generated";
      } else if (wfc.hasPlaceholders) {
        status = "Generated with Placeholders";
      } else if (wfc.hasRemediations) {
        status = "Generated with Remediations";
      } else {
        status = "Generated";
      }
      const studioLabel = wfc.studioLevel === "studio-clean"
        ? "Studio-openable"
        : wfc.studioLevel === "studio-warnings"
          ? "Openable with warnings"
          : "Studio-openable";
      md += `| ${i + 1} | \`${wfc.name}.xaml\` | ${status} | ${studioLabel} |\n`;
    });
    md += `\n`;

    const spMetrics = report.structuralPreservationMetrics || [];
    if (spMetrics.length > 0) {
      md += `**Preserved Capabilities per Workflow:**\n\n`;
      md += `| Workflow | Boundaries | Sequence Ordering | Branching | Config Reads | Infrastructure |\n`;
      md += `|----------|-----------|-------------------|-----------|-------------|----------------|\n`;
      for (const wfc of generatedWorkflows) {
        const wfFile = `${wfc.name}.xaml`;
        const metric = spMetrics.find(m => m.file === wfFile || m.file === wfc.name);
        const structures = metric?.preservedStructures || [];
        const hasBoundaries = structures.some(s => /boundary|scope|try|catch/i.test(s)) ? "Yes" : "—";
        const hasSequencing = structures.some(s => /sequence|flowchart|flow/i.test(s)) ? "Yes" : "—";
        const hasBranching = structures.some(s => /if|switch|decision|branch|condition/i.test(s)) ? "Yes" : "—";
        const hasConfig = structures.some(s => /config|setting|read|argument|variable/i.test(s)) ? "Yes" : "—";
        const hasInfra = structures.some(s => /assign|log|invoke|delay|retry/i.test(s)) ? "Yes" : "—";
        md += `| \`${wfc.name}.xaml\` | ${hasBoundaries} | ${hasSequencing} | ${hasBranching} | ${hasConfig} | ${hasInfra} |\n`;
      }
      md += `\n`;
    }
  } else {
    md += `No workflows were generated without handoff blocks or stubs.\n\n`;
  }

  if (report.autoRepairs.length > 0) {
    md += `### AI-Resolved with Smart Defaults (${report.autoRepairs.length})\n\n`;
    md += `The following issue(s) were automatically corrected during the build pipeline. **No developer action required.**\n\n`;
    md += `| # | Code | File | Description | Est. Minutes Saved |\n`;
    md += `|---|------|------|-------------|-------------------|\n`;
    report.autoRepairs.forEach((r, i) => {
      const desc = (r.description || "").length > 100 ? (r.description || "").slice(0, 97) + "..." : (r.description || "—");
      md += `| ${i + 1} | \`${r.repairCode}\` | \`${r.file}\` | ${desc.replace(/\|/g, "\\|")} | ${r.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  if (report.downgradeEvents.length > 0) {
    md += `### Downgraded Components\n\n`;
    md += `| # | File | From | To | Reason | Developer Action | Est. Minutes |\n`;
    md += `|---|------|------|----|--------|-----------------|-------------|\n`;
    report.downgradeEvents.forEach((d, i) => {
      const reason = (d.triggerReason || "").length > 80 ? (d.triggerReason || "").slice(0, 77) + "..." : (d.triggerReason || "—");
      md += `| ${i + 1} | ${d.file || "—"} | \`${d.fromMode}\` | \`${d.toMode}\` | ${reason.replace(/\|/g, "\\|")} | ${d.developerAction} | ${d.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  if (report.structuralPreservationMetrics && report.structuralPreservationMetrics.length > 0) {
    md += `### Structural Preservation Metrics\n\n`;
    md += `| File | Total Activities | Preserved | Stubbed | Preservation Rate | Studio-Loadable | Preserved Structures |\n`;
    md += `|------|-----------------|-----------|---------|-------------------|----------------|---------------------|\n`;
    for (const m of report.structuralPreservationMetrics) {
      const rate = m.totalActivities > 0 ? Math.round((m.preservedActivities / m.totalActivities) * 100) : 0;
      const structures = m.preservedStructures.length > 3
        ? m.preservedStructures.slice(0, 3).join(", ") + `... (+${m.preservedStructures.length - 3})`
        : m.preservedStructures.join(", ");
      const loadableLabel = m.studioLoadable === false
        ? "No"
        : m.studioLoadable === true
          ? "Yes"
          : "Unknown";
      md += `| \`${m.file}\` | ${m.totalActivities} | ${m.preservedActivities} | ${m.stubbedActivities} | ${rate}% | ${loadableLabel} | ${structures} |\n`;
    }
    md += `\n`;
    const nonLoadable = report.structuralPreservationMetrics.filter(m => m.studioLoadable === false);
    if (nonLoadable.length > 0) {
      md += `> **⚠ ${nonLoadable.length} structurally-preserved file(s) are not Studio-loadable** despite high preservation rates. `;
      md += `XML structure is intact but Studio cannot load these files (missing Implementation/DynamicActivity). `;
      md += `These require rebuilding from scratch.\n\n`;
      for (const m of nonLoadable) {
        if (m.studioLoadableNote) {
          md += `> - \`${m.file}\`: ${m.studioLoadableNote}\n`;
        }
      }
      if (nonLoadable.some(m => m.studioLoadableNote)) md += `\n`;
    }
  }

  const fqr = context.finalQualityReport;
  const rawStudioCompatData = fqr
    ? fqr.perFileResults.map(r => ({
        file: r.file,
        level: r.studioCompatibilityLevel,
        blockers: r.blockers,
        failureCategory: undefined as string | undefined,
        failureSummary: r.blockers.length > 0 ? r.blockers.slice(0, 2).join("; ") : undefined,
      }))
    : (report.studioCompatibility || []);
  const seenStudioFiles = new Set<string>();
  const studioCompatData = rawStudioCompatData
    .map(sc => ({
      ...sc,
      file: sc.file.endsWith(".xaml") ? sc.file : `${sc.file}.xaml`,
    }))
    .filter(sc => {
      const normalized = sc.file.replace(/\.xaml$/i, "").toLowerCase();
      if (seenStudioFiles.has(normalized)) return false;
      seenStudioFiles.add(normalized);
      return true;
    });

  if (studioCompatData.length > 0) {
    md += `### Studio Compatibility\n\n`;
    md += `| # | Workflow | Compatibility | Failure Category | Blockers |\n`;
    md += `|---|----------|--------------|-----------------|----------|\n`;
    studioCompatData.forEach((sc, i) => {
      const levelLabel = sc.level === "studio-clean"
        ? "Studio-openable"
        : sc.level === "studio-warnings"
          ? "Openable with warnings"
          : "Structurally invalid — not Studio-loadable";
      const categoryLabel = sc.failureCategory
        ? sc.failureCategory.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
        : sc.level === "studio-clean" ? "—" : "Unclassified";
      const blockerSummary = sc.blockers.length > 0
        ? sc.blockers.slice(0, 3).map((b: string) => b.length > 80 ? b.slice(0, 77) + "..." : b).join("; ").replace(/\|/g, "\\|")
        : "—";
      md += `| ${i + 1} | \`${sc.file}\` | ${levelLabel} | ${categoryLabel} | ${blockerSummary} |\n`;
    });
    const blocked = studioCompatData.filter(sc => sc.level === "studio-blocked");
    const warnings = studioCompatData.filter(sc => sc.level === "studio-warnings");
    const clean = studioCompatData.filter(sc => sc.level === "studio-clean");
    md += `\n`;
    md += `**Summary:** ${clean.length} Studio-loadable, ${warnings.length} with warnings, ${blocked.length} not Studio-loadable\n\n`;
    if (blocked.length > 0) {
      md += `> **⚠ ${blocked.length} workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.\n\n`;
      const categoryCounts = new Map<string, number>();
      for (const b of blocked) {
        const cat = b.failureSummary || "Unknown";
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
      if (categoryCounts.size > 1) {
        md += `**Blocked by category:**\n`;
        for (const [cat, count] of categoryCounts) {
          md += `- ${cat}: ${count} workflow(s)\n`;
        }
        md += `\n`;
      }
    }
  }

  sectionNum++;
  md += `## ${sectionNum}. Handoff Blocks (business logic preserved, implementation required)\n\n`;
  md += `Blocks where business logic is preserved as documentation but implementation requires manual Studio work. Each entry includes the workflow file, block type, business description from the SDD (when available), expected inputs/outputs, and the developer action required.\n\n`;

  const activityRemediations = report.remediations.filter(r => r.level === "activity");
  const sequenceRemediations = report.remediations.filter(r => r.level === "sequence");
  const structuralLeafRemediations = report.remediations.filter(r => r.level === "structural-leaf");
  const degradedItems = report.emissionGateViolations?.details.filter(v => v.resolution === "degraded") || [];
  const stubbedEmissionItems = report.emissionGateViolations?.details.filter(v => v.resolution === "stubbed") || [];

  const handoffEntries: HandoffBlockEntry[] = [];

  for (const v of degradedItems) {
    handoffEntries.push({
      file: v.file,
      blockType: v.containingBlockType || "control-flow",
      displayName: `${v.containingBlockType || "Control-flow"} block`,
      businessDescription: v.businessDescription || "",
      businessRule: v.businessRule || "",
      expectedInputs: v.expectedInputs || "",
      expectedOutputs: v.expectedOutputs || "",
      developerAction: `Implement entire ${v.containingBlockType || "block"} manually in Studio`,
      estimatedEffortMinutes: 30,
      containedActivities: v.containedActivities?.join(", ") || "—",
      line: v.line,
    });
  }

  for (const v of stubbedEmissionItems) {
    handoffEntries.push({
      file: v.file,
      blockType: "emission-stub",
      displayName: (v.detail || "Unapproved activity").slice(0, 80),
      businessDescription: v.businessDescription || "",
      businessRule: v.businessRule || "",
      expectedInputs: v.expectedInputs || "",
      expectedOutputs: v.expectedOutputs || "",
      developerAction: "Implement approved activity replacement in Studio",
      estimatedEffortMinutes: 15,
      containedActivities: "—",
      line: v.line,
    });
  }

  for (const r of activityRemediations) {
    handoffEntries.push({
      file: r.file,
      blockType: "activity",
      displayName: r.originalDisplayName || r.originalTag || "—",
      businessDescription: r.businessDescription || "",
      businessRule: r.businessRule || "",
      expectedInputs: r.expectedInputs || "",
      expectedOutputs: r.expectedOutputs || "",
      developerAction: r.developerAction || "Implement activity in Studio",
      estimatedEffortMinutes: r.estimatedEffortMinutes,
      containedActivities: r.originalTag || "—",
      remediationCode: r.remediationCode,
    });
  }

  for (const r of sequenceRemediations) {
    handoffEntries.push({
      file: r.file,
      blockType: "sequence",
      displayName: r.originalDisplayName || "—",
      businessDescription: r.businessDescription || "",
      businessRule: r.businessRule || "",
      expectedInputs: r.expectedInputs || "",
      expectedOutputs: r.expectedOutputs || "",
      developerAction: r.developerAction || "Implement sequence in Studio",
      estimatedEffortMinutes: r.estimatedEffortMinutes,
      containedActivities: "—",
      remediationCode: r.remediationCode,
    });
  }

  for (const r of structuralLeafRemediations) {
    handoffEntries.push({
      file: r.file,
      blockType: "structural-leaf",
      displayName: r.originalDisplayName || "—",
      businessDescription: r.businessDescription || "",
      businessRule: r.businessRule || "",
      expectedInputs: r.expectedInputs || "",
      expectedOutputs: r.expectedOutputs || "",
      developerAction: r.developerAction || "Implement activity in Studio",
      estimatedEffortMinutes: r.estimatedEffortMinutes,
      containedActivities: r.originalTag || "—",
      remediationCode: r.remediationCode,
    });
  }

  if (handoffEntries.length === 0) {
    md += `No handoff blocks — all logic was fully generated.\n\n`;
  } else {
    md += `**${handoffEntries.length} handoff block(s) requiring manual implementation**\n\n`;
    handoffEntries.forEach((entry, i) => {
      md += `#### ${i + 1}. \`${entry.file}\` — ${entry.displayName} (${entry.blockType})\n\n`;
      md += `- **Workflow File:** \`${entry.file}\`\n`;
      md += `- **Block Type:** ${entry.blockType}\n`;
      md += `- **Business Description (SDD):** ${entry.businessDescription || "—"}\n`;
      md += `- **Business Rule:** ${entry.businessRule || "—"}\n`;
      md += `- **Expected Inputs:** ${entry.expectedInputs || "—"}\n`;
      md += `- **Expected Outputs:** ${entry.expectedOutputs || "—"}\n`;
      md += `- **Contained Activities:** ${entry.containedActivities}\n`;
      if (entry.remediationCode) {
        md += `- **Remediation Code:** \`${entry.remediationCode}\`\n`;
      }
      if (entry.line) {
        md += `- **Line:** ${entry.line}\n`;
      }
      md += `- **Developer Action:** ${entry.developerAction}\n`;
      md += `- **Estimated Effort:** ${entry.estimatedEffortMinutes} minutes\n\n`;
    });
  }

  sectionNum++;
  md += `## ${sectionNum}. Manual Work Remaining\n\n`;
  md += `Consolidated developer TODO list organized by workflow, with estimated effort per item.\n\n`;

  interface TodoItem {
    workflow: string;
    category: string;
    description: string;
    developerAction: string;
    estimatedMinutes: number;
    priority: number;
  }
  const todoItems: TodoItem[] = [];

  const workflowRemediations = report.remediations.filter(r => r.level === "workflow");
  for (const r of workflowRemediations) {
    const wfName = (r.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Workflow Stub",
      description: `Entire workflow \`${r.file}\` replaced with Studio-openable stub`,
      developerAction: r.developerAction || "Rebuild workflow from scratch in Studio",
      estimatedMinutes: r.estimatedEffortMinutes,
      priority: 1,
    });
  }

  for (const v of degradedItems) {
    const wfName = (v.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Degraded Block",
      description: `${v.containingBlockType || "Unknown"} block degraded — ${(v.detail || "").slice(0, 100)}`,
      developerAction: `Implement entire ${v.containingBlockType || "block"} manually in Studio`,
      estimatedMinutes: 30,
      priority: 2,
    });
  }

  for (const r of activityRemediations) {
    const wfName = (r.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Activity Stub",
      description: `Activity "${r.originalDisplayName || r.originalTag || "unknown"}" stubbed`,
      developerAction: r.developerAction || "Implement activity in Studio",
      estimatedMinutes: r.estimatedEffortMinutes,
      priority: 3,
    });
  }

  for (const r of sequenceRemediations) {
    const wfName = (r.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Sequence Stub",
      description: `Sequence "${r.originalDisplayName || "unknown"}" stubbed`,
      developerAction: r.developerAction || "Implement sequence in Studio",
      estimatedMinutes: r.estimatedEffortMinutes,
      priority: 3,
    });
  }

  for (const r of structuralLeafRemediations) {
    const wfName = (r.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Leaf Stub",
      description: `Leaf activity "${r.originalDisplayName || "unknown"}" (\`${r.originalTag || "—"}\`) stubbed`,
      developerAction: r.developerAction || "Implement activity in Studio",
      estimatedMinutes: r.estimatedEffortMinutes,
      priority: 4,
    });
  }

  for (const v of stubbedEmissionItems) {
    const wfName = (v.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Emission Stub",
      description: (v.detail || "Unapproved activity stubbed").slice(0, 120),
      developerAction: "Implement approved activity replacement in Studio",
      estimatedMinutes: 15,
      priority: 4,
    });
  }

  for (const r of report.propertyRemediations) {
    const wfName = (r.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Property Fix",
      description: `Property \`${r.propertyName || "—"}\` on "${r.originalDisplayName || r.originalTag || "—"}" replaced with placeholder`,
      developerAction: r.developerAction || "Replace placeholder with correct value",
      estimatedMinutes: r.estimatedEffortMinutes,
      priority: 5,
    });
  }

  const validationFindings = report.remediations.filter(r => r.level === "validation-finding");
  for (const r of validationFindings) {
    const wfName = (r.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Validation Finding",
      description: `Quality gate finding: \`${r.classifiedCheck}\``,
      developerAction: r.developerAction || "Review and fix",
      estimatedMinutes: r.estimatedEffortMinutes,
      priority: 5,
    });
  }

  if (transitiveDependencyWarnings.length > 0) {
    for (const w of transitiveDependencyWarnings) {
      const wfName = (w.file || "").replace(/\.xaml$/i, "");
      todoItems.push({
        workflow: wfName || "Unknown",
        category: "Dependency Issue",
        description: `${w.check}: ${(w.detail || "").slice(0, 100)}`,
        developerAction: w.developerAction || "Add missing dependency to project.json",
        estimatedMinutes: w.estimatedEffortMinutes || 10,
        priority: 4,
      });
    }
  }

  const nonTransitivePlaceholderWarnings = report.qualityWarnings.filter(w =>
    w.check !== "transitive-dependency-missing" && w.check !== "error-activity-reference" && w.check !== "unresolved-type-argument"
  );
  const selectorWarnings = nonTransitivePlaceholderWarnings.filter(w => w.check === "SELECTOR_PLACEHOLDER" || w.check === "SELECTOR_LOW_QUALITY");
  for (const w of selectorWarnings) {
    const wfName = (w.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Selector Warning",
      description: `${w.check}: ${(w.detail || "").slice(0, 100)}`,
      developerAction: w.developerAction || "Fix selector in Studio",
      estimatedMinutes: w.estimatedEffortMinutes || 15,
      priority: 6,
    });
  }

  const otherQualityWarnings = nonTransitivePlaceholderWarnings.filter(w =>
    w.check !== "SELECTOR_PLACEHOLDER" && w.check !== "SELECTOR_LOW_QUALITY"
  );
  const placeholderWarnings = otherQualityWarnings.filter(w => w.check === "placeholder-value");
  const handoffPlaceholders = placeholderWarnings.filter(w => w.stubCategory !== "failure");
  const failurePlaceholders = placeholderWarnings.filter(w => w.stubCategory === "failure");
  const generalWarnings = otherQualityWarnings.filter(w => w.check !== "placeholder-value");

  for (const w of failurePlaceholders) {
    const wfName = (w.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Generation Failure",
      description: (w.detail || "Pipeline generation failure").slice(0, 120),
      developerAction: w.developerAction || "Implement manually — pipeline could not generate",
      estimatedMinutes: w.estimatedEffortMinutes || 15,
      priority: 2,
    });
  }

  for (const w of handoffPlaceholders) {
    const wfName = (w.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Implementation Required",
      description: (w.detail || "Developer implementation required").slice(0, 120),
      developerAction: w.developerAction || "Implement in Studio",
      estimatedMinutes: w.estimatedEffortMinutes || 10,
      priority: 5,
    });
  }

  for (const w of generalWarnings) {
    const wfName = (w.file || "").replace(/\.xaml$/i, "");
    todoItems.push({
      workflow: wfName || "Unknown",
      category: "Quality Warning",
      description: `${w.check}: ${(w.detail || "").slice(0, 100)}`,
      developerAction: w.developerAction || "Review and address",
      estimatedMinutes: w.estimatedEffortMinutes || 10,
      priority: 6,
    });
  }

  if (context.bindPointSummary && context.bindPointSummary.totalCount > 0) {
    for (const bp of context.bindPointSummary.entries) {
      const wfName = (bp.file || "").replace(/\.xaml$/i, "");
      todoItems.push({
        workflow: wfName || "Unknown",
        category: "Bind Point",
        description: `Bind point: ${bp.system} — ${(bp.detail || "Connector implementation needed").slice(0, 100)}`,
        developerAction: `Implement ${bp.system} connector integration`,
        estimatedMinutes: bp.estimatedEffortMinutes,
        priority: 3,
      });
    }
  }

  todoItems.sort((a, b) => a.priority - b.priority || a.workflow.localeCompare(b.workflow));

  if (todoItems.length === 0) {
    md += `No manual developer action is required.\n\n`;
  } else {
    const byWorkflow = new Map<string, TodoItem[]>();
    for (const item of todoItems) {
      const existing = byWorkflow.get(item.workflow) || [];
      existing.push(item);
      byWorkflow.set(item.workflow, existing);
    }

    const totalTodoEffort = todoItems.reduce((s, t) => s + t.estimatedMinutes, 0);
    md += `**${todoItems.length} items remaining — ~${totalTodoEffort} minutes (${(totalTodoEffort / 60).toFixed(1)} hours) total estimated effort**\n\n`;

    let globalIndex = 0;
    for (const [workflow, items] of Array.from(byWorkflow.entries())) {
      const wfEffort = items.reduce((s: number, t: TodoItem) => s + t.estimatedMinutes, 0);
      md += `### ${workflow}.xaml (${items.length} item${items.length !== 1 ? "s" : ""}, ~${wfEffort} min)\n\n`;
      md += `| # | Priority | Category | Description | Developer Action | Est. Minutes |\n`;
      md += `|---|----------|----------|-------------|-----------------|-------------|\n`;
      for (const item of items) {
        globalIndex++;
        const priorityLabel = item.priority <= 2 ? "High" : item.priority <= 4 ? "Medium" : "Low";
        const desc = item.description.length > 80 ? item.description.slice(0, 77) + "..." : item.description;
        const action = item.developerAction.length > 80 ? item.developerAction.slice(0, 77) + "..." : item.developerAction;
        md += `| ${globalIndex} | ${priorityLabel} | ${item.category} | ${desc.replace(/\|/g, "\\|")} | ${action.replace(/\|/g, "\\|")} | ${item.estimatedMinutes} |\n`;
      }
      md += `\n`;
    }
  }

  if (context.analysis) {
    if (context.analysis.upstreamContext) {
      md += generateUpstreamContextSection(context.analysis, ++sectionNum);
      if (hasProcessMapData(context.analysis)) {
        md += generateBusinessProcessOverviewSection(context.analysis, ++sectionNum);
      }
    }
    md += generateEnvironmentSetupSection(context.analysis, ++sectionNum);
    md += generateCredentialAssetSection(context.analysis, ++sectionNum);
    if (context.analysis.sddCrossReference) {
      md += generateCrossReferenceSection(context.analysis.sddCrossReference, ++sectionNum);
    }
    md += generateQueueManagementSection(context.analysis, ++sectionNum);
    md += generateExceptionCoverageSection(context.analysis, ++sectionNum);
    md += generateTriggerConfigSection(context.analysis, ++sectionNum);
    if (context.analysis.upstreamContext?.qualityWarnings && context.analysis.upstreamContext.qualityWarnings.length > 0) {
      md += generateUpstreamWarningsSection(context.analysis, ++sectionNum);
    }
    if (context.bindPointSummary && context.bindPointSummary.totalCount > 0) {
      const bpSection = generateBindPointsSection(context.bindPointSummary, ++sectionNum);
      if (bpSection) md += bpSection;
    }
    md += generatePreDeploymentChecklist(context.analysis, ++sectionNum);
    md += generateReadinessScoreSection(context.analysis, ++sectionNum, context.bindPointSummary, context.generationMode);
  }

  if (report.preEmissionValidation) {
    const pev = report.preEmissionValidation;
    sectionNum++;
    md += `## ${sectionNum}. Pre-emission Spec Validation\n\n`;
    md += `Validation was performed on the WorkflowSpec tree before XAML assembly. `;
    md += `Issues caught at this stage are cheaper to fix than post-emission quality gate findings.\n\n`;
    md += `| Metric | Count |\n|---|---|\n`;
    md += `| Total activities checked | ${pev.totalActivities} |\n`;
    md += `| Valid activities | ${pev.validActivities} |\n`;
    md += `| Unknown → Comment stubs | ${pev.unknownActivities} |\n`;
    md += `| Non-catalog properties stripped | ${pev.strippedProperties} |\n`;
    md += `| Enum values auto-corrected | ${pev.enumCorrections} |\n`;
    md += `| Missing required props filled | ${pev.missingRequiredFilled} |\n`;
    md += `| Total issues | ${pev.issueCount} |\n\n`;

    const preEmissionFixCount = pev.enumCorrections + pev.strippedProperties + pev.missingRequiredFilled + pev.commentConversions;
    const postEmissionIssueCount = report.qualityWarnings.length + report.remediations.length;
    md += `### Pre-emission vs Post-emission\n\n`;
    md += `| Stage | Issues Caught/Fixed |\n|---|---|\n`;
    md += `| Pre-emission (spec validation) | ${preEmissionFixCount} auto-fixed, ${pev.issueCount} total issues |\n`;
    md += `| Post-emission (quality gate) | ${postEmissionIssueCount} warnings/remediations |\n\n`;
  }

  md += `---\n\n`;

  sectionNum++;
  md += `## ${sectionNum}. Structured Report (JSON)\n\n`;
  md += `The following JSON appendix contains the full pipeline outcome report for programmatic consumption:\n\n`;
  md += "```json\n";
  md += JSON.stringify(report, null, 2);
  md += "\n```\n";

  return md;
}

function generateEnvironmentSetupSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const env = analysis.environmentRequirements;
  let md = `## ${sectionNum}. Environment Setup\n\n`;

  md += `| Requirement | Value |\n`;
  md += `|---|---|\n`;
  md += `| Target Framework | ${env.needsWindowsTarget ? "Windows (required)" : "Windows or Portable"} |\n`;
  md += `| Robot Type | ${env.needsAttendedRobot ? "Attended (user interaction required)" : "Unattended"} |\n`;
  md += `| Modern Activities | ${env.usesModernActivities ? "Yes" : "No"} |\n`;
  md += `| Studio Version | ${env.studioVersion} |\n`;
  md += `| Orchestrator Connection | ${env.usesOrchestrator ? "Required" : "Not required"} |\n`;
  md += `| Machine Template | ${env.machineTemplate.recommendedType} |\n`;

  if (env.usesActionCenter) md += `| Action Center | Required |\n`;
  if (env.usesAICenter) md += `| AI Center | Required |\n`;
  if (env.usesDocumentUnderstanding) md += `| Document Understanding | Required |\n`;
  if (env.usesDataService) md += `| Data Service | Required |\n`;
  md += `\n`;

  md += `### Machine Template\n\n`;
  md += `**Recommended:** ${env.machineTemplate.recommendedType}\n`;
  md += `${env.machineTemplate.note}\n\n`;

  md += `### Orchestrator Folder Structure\n\n`;
  md += `${env.orchestratorFolderGuidance}\n\n`;

  if (env.browserExtensions.length > 0) {
    md += `### Browser Extensions\n\n`;
    md += `The following extensions must be installed on the robot machine:\n\n`;
    for (const ext of env.browserExtensions) {
      md += `- ${ext}\n`;
    }
    md += `\n`;
  }

  if (env.requiredPackages.length > 0) {
    md += `### NuGet Dependencies\n\n`;
    md += `| # | Package |\n`;
    md += `|---|--------|\n`;
    env.requiredPackages.forEach((pkg, i) => {
      md += `| ${i + 1} | \`${pkg}\` |\n`;
    });
    md += `\n`;
  }

  if (analysis.upstreamContext?.systems && analysis.upstreamContext.systems.length > 0) {
    md += `### Target Applications (from Process Map)\n\n`;
    md += `The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:\n\n`;
    for (const sys of analysis.upstreamContext.systems) {
      md += `- ${sys}\n`;
    }
    md += `\n`;
  }

  return md;
}

function generateCredentialAssetSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const inv = analysis.credentialInventory;
  let md = `## ${sectionNum}. Credential & Asset Inventory\n\n`;

  if (inv.entries.length === 0) {
    md += `No GetCredential/GetAsset/SetCredential/SetAsset activities detected.\n\n`;
    return md;
  }

  md += `**Total:** ${inv.entries.length} activities (${inv.hardcodedCount} hardcoded, ${inv.variableCount} variable-driven)\n\n`;

  if (inv.uniqueCredentialNames.length > 0) {
    md += `### Orchestrator Credentials to Provision\n\n`;
    md += `| # | Credential Name | Type | Consuming Activity | File | Action |\n`;
    md += `|---|----------------|------|-------------------|------|--------|\n`;
    inv.uniqueCredentialNames.forEach((name, i) => {
      const entry = inv.entries.find(e => e.assetName === name && (e.activityType === "GetCredential" || e.activityType === "SetCredential"));
      const consumer = entry?.consumingActivity || "—";
      const file = entry?.file || "—";
      const action = entry?.isHardcoded ? "Create in Orchestrator before deployment" : "Verify exists in target environment";
      md += `| ${i + 1} | \`${name}\` | Credential | ${consumer} | \`${file}\` | ${action} |\n`;
    });
    md += `\n`;
  }

  if (inv.uniqueAssetNames.length > 0) {
    md += `### Orchestrator Assets to Provision\n\n`;
    md += `| # | Asset Name | Value Type | Consuming Activity | File | Action |\n`;
    md += `|---|-----------|-----------|-------------------|------|--------|\n`;
    inv.uniqueAssetNames.forEach((name, i) => {
      const entry = inv.entries.find(e => e.assetName === name && (e.activityType === "GetAsset" || e.activityType === "SetAsset"));
      const valueType = entry?.assetValueType || "Unknown";
      const consumer = entry?.consumingActivity || "—";
      const file = entry?.file || "—";
      const action = entry?.isHardcoded ? "Create in Orchestrator before deployment" : "Verify exists in target environment";
      md += `| ${i + 1} | \`${name}\` | ${valueType} | ${consumer} | \`${file}\` | ${action} |\n`;
    });
    md += `\n`;
  }

  md += `### Detailed Usage Map\n\n`;
  md += `| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |\n`;
  md += `|------|------|----------|-----------------|------|----------|----------|\n`;
  for (const e of inv.entries) {
    md += `| \`${e.file}\` | ${e.lineNumber} | ${e.activityType} | \`${e.assetName}\` | ${e.assetValueType} | ${e.variableName || "—"} | ${e.isHardcoded ? "Yes" : "No"} |\n`;
  }
  md += `\n`;

  if (inv.hardcodedCount > 0) {
    md += `> **Warning:** ${inv.hardcodedCount} asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.\n\n`;
  }

  return md;
}

function generateQueueManagementSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const q = analysis.queueManagement;
  let md = `## ${sectionNum}. Queue Management\n\n`;

  if (q.entries.length === 0) {
    md += `No queue activities detected in the package.\n\n`;
    return md;
  }

  md += `**Pattern:** ${q.isTransactionalPattern ? "Transactional (Dispatcher/Performer)" : "Queue usage (non-transactional)"}\n\n`;

  if (q.uniqueQueues.length > 0) {
    const sddQueueConfigs = analysis.sddCrossReference?.sddQueueConfigs || [];
    md += `### Queues to Provision\n\n`;
    md += `| # | Queue Name | Activities | Unique Reference | Auto Retry | SLA | Action |\n`;
    md += `|---|-----------|------------|-----------------|------------|-----|--------|\n`;
    q.uniqueQueues.forEach((qName, i) => {
      const activities = q.entries.filter(e => e.queueName === qName).map(e => e.activityType);
      const uniqueActs = [...new Set(activities)].join(", ");
      const isHardcoded = q.entries.some(e => e.queueName === qName && e.isHardcoded);
      const sddConfig = sddQueueConfigs.find(c => c.name === qName);
      const uniqueRef = sddConfig?.uniqueReference !== undefined
        ? (sddConfig.uniqueReference ? "Yes (SDD)" : "No (SDD)")
        : q.isTransactionalPattern ? "Recommended" : "Optional";
      const autoRetry = sddConfig?.maxRetries !== undefined
        ? `Yes (${sddConfig.maxRetries}x, SDD)`
        : q.retryPolicy.autoRetryEnabled ? `Yes (${q.retryPolicy.maxRetries}x)` : "No";
      const sla = sddConfig?.sla || "—";
      md += `| ${i + 1} | \`${qName}\` | ${uniqueActs} | ${uniqueRef} | ${autoRetry} | ${sla} | ${isHardcoded ? "Create in Orchestrator" : "Verify exists"} |\n`;
    });
    md += `\n`;
  }

  const sddOnlyQueues = (analysis.sddCrossReference?.sddQueueConfigs || [])
    .filter(c => !q.uniqueQueues.some(qn => qn.trim() === c.name.trim()));
  if (sddOnlyQueues.length > 0) {
    md += `### SDD-Defined Queues (Not Yet in XAML)\n\n`;
    md += `| # | Queue Name | Unique Reference | Max Retries | SLA | Note |\n`;
    md += `|---|-----------|-----------------|-------------|-----|------|\n`;
    sddOnlyQueues.forEach((c, i) => {
      const uniqueRef = c.uniqueReference !== undefined ? (c.uniqueReference ? "Yes" : "No") : "—";
      const retries = c.maxRetries !== undefined ? `${c.maxRetries}x` : "—";
      const sla = c.sla || "—";
      md += `| ${i + 1} | \`${c.name}\` | ${uniqueRef} | ${retries} | ${sla} | Defined in SDD but no matching XAML activity — verify implementation |\n`;
    });
    md += `\n`;
  }

  md += `### Queue Activity Summary\n\n`;
  md += `| Capability | Present |\n`;
  md += `|---|---|\n`;
  md += `| Add Queue Item | ${q.hasAddQueueItem ? "Yes" : "No"} |\n`;
  md += `| Get Transaction Item | ${q.hasGetTransaction ? "Yes" : "No"} |\n`;
  md += `| Set Transaction Status | ${q.hasSetTransactionStatus ? "Yes" : "No"} |\n`;
  md += `\n`;

  md += `### Retry Policy\n\n`;
  md += `${q.retryPolicy.note}\n\n`;

  md += `### SLA Guidance\n\n`;
  md += `${q.slaGuidance}\n\n`;

  md += `### Dead-Letter / Failed Items Handling\n\n`;
  md += `${q.deadLetterHandling}\n\n`;

  if (q.isTransactionalPattern && !q.hasAddQueueItem) {
    md += `> **Note:** This is a Performer process — a separate Dispatcher process is needed to populate the queue.\n\n`;
  }

  return md;
}

function generateExceptionCoverageSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const exc = analysis.exceptionCoverage;
  let md = `## ${sectionNum}. Exception Handling Coverage\n\n`;

  if (exc.totalActivities === 0) {
    md += `No high-risk activities detected to evaluate exception coverage.\n\n`;
    return md;
  }

  md += `**Coverage:** ${exc.coveredActivities}/${exc.totalActivities} high-risk activities inside TryCatch (${exc.coveragePercent}%)\n\n`;

  if (exc.filesWithoutTryCatch.length > 0) {
    md += `### Files Without TryCatch\n\n`;
    for (const f of exc.filesWithoutTryCatch) {
      md += `- \`${f}\`\n`;
    }
    md += `\n`;
  }

  if (exc.uncoveredHighRiskActivities.length > 0) {
    md += `### Uncovered High-Risk Activities\n\n`;
    md += `| # | Location | Activity |\n`;
    md += `|---|----------|----------|\n`;
    exc.uncoveredHighRiskActivities.forEach((desc, i) => {
      const parts = desc.split(" ");
      const location = parts[0];
      const activity = parts.slice(1).join(" ");
      md += `| ${i + 1} | \`${location}\` | ${activity} |\n`;
    });
    md += `\n`;
    md += `> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).\n\n`;
  }

  return md;
}

function generateTriggerConfigSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const triggers = analysis.triggerSuggestions;
  let md = `## ${sectionNum}. Trigger Configuration\n\n`;

  md += `Based on the process analysis, the following trigger configuration is recommended:\n\n`;
  md += `| # | Trigger Type | Reason | Configuration |\n`;
  md += `|---|-------------|--------|---------------|\n`;
  triggers.forEach((t, i) => {
    md += `| ${i + 1} | **${t.triggerType}** | ${t.reason} | ${t.suggestedConfig || "Configure in Orchestrator"} |\n`;
  });
  md += `\n`;

  return md;
}

function generatePreDeploymentChecklist(analysis: DhgAnalysisResult, sectionNum: number): string {
  const env = analysis.environmentRequirements;
  const cred = analysis.credentialInventory;
  const q = analysis.queueManagement;
  let md = `## ${sectionNum}. Pre-Deployment Checklist\n\n`;

  const items: Array<{ task: string; category: string; required: boolean }> = [];

  items.push({ task: "Publish package to Orchestrator feed", category: "Deployment", required: true });
  items.push({ task: "Create Process in target folder", category: "Deployment", required: true });

  if (env.usesOrchestrator) {
    items.push({ task: "Verify Orchestrator connection from robot", category: "Environment", required: true });
  }

  if (cred.uniqueCredentialNames.length > 0) {
    for (const name of cred.uniqueCredentialNames) {
      items.push({ task: `Provision credential: \`${name}\``, category: "Credentials", required: true });
    }
  }

  if (cred.uniqueAssetNames.length > 0) {
    for (const name of cred.uniqueAssetNames) {
      items.push({ task: `Provision asset: \`${name}\``, category: "Assets", required: true });
    }
  }

  if (q.uniqueQueues.length > 0) {
    for (const qName of q.uniqueQueues) {
      items.push({ task: `Create queue: \`${qName}\``, category: "Queues", required: true });
    }
  }

  if (env.browserExtensions.length > 0) {
    for (const ext of env.browserExtensions) {
      items.push({ task: `Install ${ext}`, category: "Extensions", required: true });
    }
  }

  if (env.needsAttendedRobot) {
    items.push({ task: "Configure attended robot with user session", category: "Robot", required: true });
  }

  items.push({ task: "Configure trigger (schedule/queue/API)", category: "Trigger", required: true });
  items.push({ task: "Run smoke test in target environment", category: "Testing", required: true });
  items.push({ task: "Verify logging output in Orchestrator", category: "Monitoring", required: false });

  items.push({ task: "UAT test execution completed and sign-off obtained", category: "Governance", required: true });
  items.push({ task: "Peer code review completed", category: "Governance", required: true });
  items.push({ task: "All quality gate warnings addressed or risk-accepted", category: "Governance", required: true });
  items.push({ task: "Business process owner validation obtained", category: "Governance", required: true });
  items.push({ task: "CoE approval obtained", category: "Governance", required: true });
  items.push({ task: "Production readiness assessment completed (monitoring, alerting, rollback plan documented)", category: "Governance", required: true });

  md += `| # | Category | Task | Required |\n`;
  md += `|---|----------|------|----------|\n`;
  items.forEach((item, i) => {
    md += `| ${i + 1} | ${item.category} | ${item.task} | ${item.required ? "Yes" : "Recommended"} |\n`;
  });
  md += `\n`;

  return md;
}

function generateUpstreamContextSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const ctx = analysis.upstreamContext!;
  let md = `## ${sectionNum}. Process Context (from Pipeline)\n\n`;

  if (ctx.ideaDescription) {
    md += `### Idea Description\n\n`;
    md += `${ctx.ideaDescription}\n\n`;
  }

  if (ctx.pddSummary) {
    md += `### PDD Summary\n\n`;
    md += `${ctx.pddSummary}\n\n`;
  }

  if (ctx.sddSummary) {
    md += `### SDD Summary\n\n`;
    md += `${ctx.sddSummary}\n\n`;
  }

  if (ctx.automationType) {
    md += `**Automation Type:** ${ctx.automationType}\n`;
  }
  if (ctx.automationTypeRationale) {
    md += `**Rationale:** ${ctx.automationTypeRationale}\n`;
  }
  if (ctx.feasibilityComplexity) {
    md += `**Feasibility Complexity:** ${ctx.feasibilityComplexity}\n`;
  }
  if (ctx.feasibilityEffortEstimate) {
    md += `**Effort Estimate:** ${ctx.feasibilityEffortEstimate}\n`;
  }
  if (ctx.feasibilityScore !== undefined) {
    md += `**Feasibility Score:** ${ctx.feasibilityScore}%\n`;
  }
  md += `\n`;

  return md;
}

function hasProcessMapData(analysis: DhgAnalysisResult): boolean {
  const ctx = analysis.upstreamContext;
  if (!ctx) return false;
  return !!(
    (ctx.processSteps && ctx.processSteps.length > 0) ||
    (ctx.painPoints && ctx.painPoints.length > 0) ||
    (ctx.systems && ctx.systems.length > 0) ||
    (ctx.roles && ctx.roles.length > 0)
  );
}

function generateBusinessProcessOverviewSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const ctx = analysis.upstreamContext!;
  let md = `## ${sectionNum}. Business Process Overview\n\n`;

  if (ctx.processSteps && ctx.processSteps.length > 0) {
    md += `### Process Steps\n\n`;
    md += `| # | Step | Role | System | Type | Pain Point |\n`;
    md += `|---|------|------|--------|------|------------|\n`;
    ctx.processSteps.forEach((step, i) => {
      md += `| ${i + 1} | ${step.name} | ${step.role || "—"} | ${step.system || "—"} | ${step.nodeType} | ${step.isPainPoint ? "Yes" : "—"} |\n`;
    });
    md += `\n`;
  }

  if (ctx.painPoints && ctx.painPoints.length > 0) {
    md += `### Pain Points\n\n`;
    for (const pp of ctx.painPoints) {
      md += `- ${pp}\n`;
    }
    md += `\n`;
  }

  if (ctx.systems && ctx.systems.length > 0) {
    md += `### Target Applications / Systems\n\n`;
    md += `The following applications were identified from the process map and must be accessible from the robot machine:\n\n`;
    for (const sys of ctx.systems) {
      md += `- ${sys}\n`;
    }
    md += `\n`;
  }

  if (ctx.roles && ctx.roles.length > 0) {
    md += `### User Roles Involved\n\n`;
    for (const role of ctx.roles) {
      md += `- ${role}\n`;
    }
    md += `\n`;
  }

  if (ctx.decisionBranches && ctx.decisionBranches.length > 0) {
    md += `### Decision Points (Process Map Topology)\n\n`;
    for (const db of ctx.decisionBranches) {
      md += `**${db.decisionNodeName}**\n`;
      for (const branch of db.branches) {
        md += `  - [${branch.label}] → ${branch.targetNodeName}\n`;
      }
      md += `\n`;
    }
  }

  return md;
}

function generateCrossReferenceSection(xref: SddArtifactCrossReference, sectionNum: number): string {
  let md = `## ${sectionNum}. SDD × XAML Artifact Reconciliation\n\n`;

  md += `**Summary:** ${xref.alignedCount} aligned, ${xref.sddOnlyCount} SDD-only, ${xref.xamlOnlyCount} XAML-only\n\n`;

  if (xref.sddOnlyCount > 0) {
    md += `> **Warning:** ${xref.sddOnlyCount} artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.\n\n`;
  }
  if (xref.xamlOnlyCount > 0) {
    md += `> **Warning:** ${xref.xamlOnlyCount} artifact(s) found in XAML are not declared in the SDD. Update the SDD orchestrator_artifacts block to include these, or the deployment manifest will be incomplete.\n\n`;
  }

  if (xref.entries.length > 0) {
    md += `| # | Name | Type | Status | SDD Config | XAML File | XAML Line |\n`;
    md += `|---|------|------|--------|-----------|----------|----------|\n`;
    xref.entries.forEach((e, i) => {
      const sddConfig = e.sddConfig ? Object.entries(e.sddConfig).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}`).join(", ") : "—";
      const statusLabel = e.status === "aligned" ? "Aligned" : e.status === "sdd-only" ? "SDD Only" : "XAML Only";
      md += `| ${i + 1} | \`${e.name}\` | ${e.type} | **${statusLabel}** | ${sddConfig} | ${e.xamlFile ? `\`${e.xamlFile}\`` : "—"} | ${e.xamlLineNumber || "—"} |\n`;
    });
    md += `\n`;
  }

  return md;
}

function generateUpstreamWarningsSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const warnings = analysis.upstreamContext!.qualityWarnings!;
  let md = `## ${sectionNum}. Upstream Quality Findings\n\n`;

  md += `The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:\n\n`;

  const byCode = new Map<string, typeof warnings>();
  for (const w of warnings) {
    const existing = byCode.get(w.code) || [];
    existing.push(w);
    byCode.set(w.code, existing);
  }

  md += `| Code | Severity | Count | Sample Message |\n`;
  md += `|------|----------|-------|----------------|\n`;
  for (const [code, items] of byCode) {
    md += `| ${code} | ${items[0].severity} | ${items.length} | ${(items[0].message || "").slice(0, 120)}${(items[0].message || "").length > 120 ? "..." : ""} |\n`;
  }
  md += `\n`;

  return md;
}

function generateBindPointsSection(bindPointSummary: BindPointSummary, sectionNum: number): string {
  if (bindPointSummary.totalCount === 0) return "";

  let md = `## ${sectionNum}. Developer Bind Points\n\n`;
  md += `The following ${bindPointSummary.totalCount} bind point(s) mark locations where real connector integrations need to be implemented. `;
  md += `These are placeholder LogMessage activities inserted during baseline generation.\n\n`;
  md += `**Total Bind Points:** ${bindPointSummary.totalCount}\n`;
  md += `**Total Estimated Implementation Effort:** ~${bindPointSummary.totalEffortMinutes} minutes (${(bindPointSummary.totalEffortMinutes / 60).toFixed(1)} hours)\n\n`;

  for (const [workflow, entries] of bindPointSummary.byWorkflow) {
    md += `### ${workflow}.xaml (${entries.length} bind point${entries.length !== 1 ? "s" : ""})\n\n`;
    md += `| # | File | System | Detail | Est. Minutes |\n`;
    md += `|---|------|--------|--------|-------------|\n`;
    entries.forEach((bp: BindPointEntry, i: number) => {
      const detail = bp.detail.length > 100 ? bp.detail.slice(0, 97) + "..." : (bp.detail || "—");
      md += `| ${i + 1} | \`${bp.file}\` | ${bp.system} | ${detail.replace(/\|/g, "\\|")} | ${bp.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  return md;
}

function generateReadinessScoreSection(analysis: DhgAnalysisResult, sectionNum: number, bindPointSummary?: BindPointSummary, generationMode?: string): string {
  const r = analysis.readiness;
  let md = `## ${sectionNum}. Deployment Readiness Score\n\n`;

  let adjustedPercent = r.percent;
  let adjustedRating = r.rating;

  const bindPointNotes = new Map<string, string[]>();

  if (generationMode === "baseline_openable" && bindPointSummary && bindPointSummary.totalCount > 0) {
    const cap = bindPointSummary.totalCount >= 5 ? 45 : 55;
    if (adjustedPercent > cap) {
      adjustedPercent = cap;
    }
    adjustedRating = adjustedPercent >= 85 ? "Ready"
      : adjustedPercent >= 65 ? "Mostly Ready"
      : adjustedPercent >= 40 ? "Needs Work"
      : "Not Ready";

    const queueBindPoints = bindPointSummary.entries.filter(bp => bp.system.toLowerCase().includes("queue"));
    if (queueBindPoints.length > 0) {
      bindPointNotes.set("Queue Management", [`${queueBindPoints.length} queue bind point(s) require implementation`]);
    }
    bindPointNotes.set("Environment Setup", [`${bindPointSummary.totalCount} bind point(s) require connector setup`]);
  }

  md += `**Overall: ${adjustedRating} — ${r.totalScore}/${r.maxTotalScore} (${adjustedPercent}%)**\n\n`;

  md += `| Section | Score | Notes |\n`;
  md += `|---------|-------|-------|\n`;
  for (const sec of r.sections) {
    const extraNotes = bindPointNotes.get(sec.section) || [];
    const allNotes = [...sec.notes, ...extraNotes].join("; ");
    md += `| ${sec.section} | ${sec.score}/${sec.maxScore} | ${allNotes} |\n`;
  }
  md += `\n`;

  if (generationMode === "baseline_openable" && bindPointSummary && bindPointSummary.totalCount > 0) {
    const cap = bindPointSummary.totalCount >= 5 ? 45 : 55;
    if (r.percent > cap) {
      md += `> **Bind Point Adjustment:** Readiness capped at ${adjustedPercent}% (from ${r.percent}%) due to ${bindPointSummary.totalCount} remaining bind point(s) requiring implementation (~${bindPointSummary.totalEffortMinutes} min effort).\n\n`;
    } else {
      md += `> **Bind Points:** ${bindPointSummary.totalCount} bind point(s) remain, requiring ~${bindPointSummary.totalEffortMinutes} min of implementation effort.\n\n`;
    }
  }

  const hasBlockingDefects = analysis.hasBlockedWorkflows || analysis.readiness.sections.some(s => s.score <= 0);
  if (adjustedRating === "Not Ready" || adjustedRating === "Needs Work") {
    md += `> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.\n\n`;
  } else if (hasBlockingDefects) {
    md += `> **Action Required:** The package has blocking structural defects that must be resolved before deployment.\n\n`;
  } else if (adjustedRating === "Mostly Ready") {
    md += `> **Almost There:** A few items need attention before production deployment.\n\n`;
  } else {
    md += `> **Good to Go:** The package meets deployment readiness criteria.\n\n`;
  }

  return md;
}
