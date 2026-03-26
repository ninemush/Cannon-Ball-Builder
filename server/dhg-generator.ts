import type {
  PipelineOutcomeReport,
  RemediationEntry,
} from "./uipath-pipeline";

export interface DhgContext {
  projectName: string;
  workflowNames: string[];
  generationMode?: "full_implementation" | "baseline_openable";
  generationModeReason?: string;
  generatedDate?: string;
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
  md += `\n`;

  const totalPropertyRemediations = report.propertyRemediations.length;
  const totalActivityRemediations = report.remediations.filter(r => r.level === "activity").length;
  const totalSequenceRemediations = report.remediations.filter(r => r.level === "sequence").length;
  const totalStructuralLeafRemediations = report.remediations.filter(r => r.level === "structural-leaf").length;
  const totalWorkflowRemediations = report.remediations.filter(r => r.level === "workflow").length;
  const totalRemediations = totalPropertyRemediations + report.remediations.length;

  md += `**Total Estimated Effort: ~${report.totalEstimatedEffortMinutes} minutes (${(report.totalEstimatedEffortMinutes / 60).toFixed(1)} hours)**\n`;
  md += `**Remediations:** ${totalRemediations} total (${totalPropertyRemediations} property, ${totalActivityRemediations} activity, ${totalSequenceRemediations} sequence, ${totalStructuralLeafRemediations} structural-leaf, ${totalWorkflowRemediations} workflow)\n`;
  md += `**Auto-Repairs:** ${report.autoRepairs.length}\n`;
  md += `**Quality Warnings:** ${report.qualityWarnings.length}\n`;
  md += `\n---\n\n`;

  sectionNum++;
  md += `## ${sectionNum}. Completed Work\n\n`;
  if (report.fullyGeneratedFiles.length > 0) {
    md += `The following ${report.fullyGeneratedFiles.length} workflow(s) were fully generated without any stub replacements or remediation:\n\n`;
    for (const f of report.fullyGeneratedFiles) {
      md += `- \`${f}\`\n`;
    }
    md += `\n`;
  } else {
    md += `No workflows were generated without remediation.\n\n`;
  }

  if (context.workflowNames.length > 0) {
    md += `### Workflow Inventory\n\n`;
    md += `| # | Workflow | Status |\n`;
    md += `|---|----------|--------|\n`;
    context.workflowNames.forEach((wf, i) => {
      const isFullyGenerated = report.fullyGeneratedFiles.some(f => f === `${wf}.xaml` || f === wf);
      const hasRemediation = [...report.remediations, ...report.propertyRemediations].some(
        r => r.file === `${wf}.xaml` || r.file === wf
      );
      const status = isFullyGenerated ? "Fully Generated" : hasRemediation ? "Generated with Remediations" : "Generated";
      md += `| ${i + 1} | \`${wf}.xaml\` | ${status} |\n`;
    });
    md += `\n`;
  }

  sectionNum++;
  md += `## ${sectionNum}. AI-Resolved with Smart Defaults\n\n`;
  if (report.autoRepairs.length > 0) {
    md += `The following ${report.autoRepairs.length} issue(s) were automatically corrected during the build pipeline. **No developer action required.**\n\n`;
    md += `| # | Code | File | Description | Est. Minutes |\n`;
    md += `|---|------|------|-------------|-------------|\n`;
    report.autoRepairs.forEach((r, i) => {
      const desc = r.description.length > 100 ? r.description.slice(0, 97) + "..." : r.description;
      md += `| ${i + 1} | \`${r.repairCode}\` | \`${r.file}\` | ${desc.replace(/\|/g, "\\|")} | ${r.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  } else {
    md += `No auto-repairs were applied.\n\n`;
  }

  if (report.downgradeEvents.length > 0) {
    md += `### Downgraded Components\n\n`;
    md += `| # | File | From | To | Reason | Developer Action | Est. Minutes |\n`;
    md += `|---|------|------|----|--------|-----------------|-------------|\n`;
    report.downgradeEvents.forEach((d, i) => {
      const reason = d.triggerReason.length > 80 ? d.triggerReason.slice(0, 77) + "..." : d.triggerReason;
      md += `| ${i + 1} | ${d.file || "—"} | \`${d.fromMode}\` | \`${d.toMode}\` | ${reason.replace(/\|/g, "\\|")} | ${d.developerAction} | ${d.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  sectionNum++;
  md += `## ${sectionNum}. Manual Action Required\n\n`;

  const allRemediations = [
    ...report.propertyRemediations,
    ...report.remediations,
  ];

  if (allRemediations.length === 0 && report.qualityWarnings.length === 0) {
    md += `No manual developer action is required.\n\n`;
  }

  if (report.propertyRemediations.length > 0) {
    md += `### Property-Level Remediations (${report.propertyRemediations.length})\n\n`;
    md += `Individual properties were replaced with safe defaults/placeholders. The rest of the activity is intact.\n\n`;
    md += `| # | File | Activity | Property | Code | Developer Action | Est. Minutes |\n`;
    md += `|---|------|----------|----------|------|-----------------|-------------|\n`;
    report.propertyRemediations.forEach((r, i) => {
      const actName = r.originalDisplayName || r.originalTag || "—";
      const propName = r.propertyName || "—";
      const action = (r.developerAction || "").length > 80
        ? (r.developerAction || "").slice(0, 77) + "..."
        : (r.developerAction || "—");
      md += `| ${i + 1} | \`${r.file}\` | ${actName} | \`${propName}\` | \`${r.remediationCode}\` | ${action.replace(/\|/g, "\\|")} | ${r.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  const activityRemediations = report.remediations.filter(r => r.level === "activity");
  if (activityRemediations.length > 0) {
    md += `### Activity-Level Stubs (${activityRemediations.length})\n\n`;
    md += `Entire activities were replaced with TODO stubs. The surrounding workflow structure is preserved.\n\n`;
    md += `| # | File | Activity | Code | Developer Action | Est. Minutes |\n`;
    md += `|---|------|----------|------|-----------------|-------------|\n`;
    activityRemediations.forEach((r, i) => {
      const actName = r.originalDisplayName || r.originalTag || "—";
      const action = (r.developerAction || "").length > 80
        ? (r.developerAction || "").slice(0, 77) + "..."
        : (r.developerAction || "—");
      md += `| ${i + 1} | \`${r.file}\` | ${actName} | \`${r.remediationCode}\` | ${action.replace(/\|/g, "\\|")} | ${r.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  const sequenceRemediations = report.remediations.filter(r => r.level === "sequence");
  if (sequenceRemediations.length > 0) {
    md += `### Sequence-Level Stubs (${sequenceRemediations.length})\n\n`;
    md += `Sequence children were replaced with a single TODO stub because multiple activities in the sequence had issues.\n\n`;
    md += `| # | File | Sequence | Code | Developer Action | Est. Minutes |\n`;
    md += `|---|------|----------|------|-----------------|-------------|\n`;
    sequenceRemediations.forEach((r, i) => {
      const seqName = r.originalDisplayName || "—";
      const action = (r.developerAction || "").length > 80
        ? (r.developerAction || "").slice(0, 77) + "..."
        : (r.developerAction || "—");
      md += `| ${i + 1} | \`${r.file}\` | ${seqName} | \`${r.remediationCode}\` | ${action.replace(/\|/g, "\\|")} | ${r.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  const structuralLeafRemediations = report.remediations.filter(r => r.level === "structural-leaf");
  if (structuralLeafRemediations.length > 0) {
    md += `### Structural-Leaf Stubs (${structuralLeafRemediations.length})\n\n`;
    md += `Individual leaf activities were stubbed while preserving the workflow skeleton (sequences, branches, try/catch, loops, invocations).\n\n`;
    md += `| # | File | Activity | Original Tag | Code | Developer Action | Est. Minutes |\n`;
    md += `|---|------|----------|-------------|------|-----------------|-------------|\n`;
    structuralLeafRemediations.forEach((r, i) => {
      const actName = r.originalDisplayName || "—";
      const tag = r.originalTag || "—";
      const action = (r.developerAction || "").length > 80
        ? (r.developerAction || "").slice(0, 77) + "..."
        : (r.developerAction || "—");
      md += `| ${i + 1} | \`${r.file}\` | ${actName} | \`${tag}\` | \`${r.remediationCode}\` | ${action.replace(/\|/g, "\\|")} | ${r.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;

    if (report.structuralPreservationMetrics && report.structuralPreservationMetrics.length > 0) {
      md += `#### Structural Preservation Metrics\n\n`;
      md += `| File | Total Activities | Preserved | Stubbed | Preservation Rate | Preserved Structures |\n`;
      md += `|------|-----------------|-----------|---------|-------------------|---------------------|\n`;
      for (const m of report.structuralPreservationMetrics) {
        const rate = m.totalActivities > 0 ? Math.round((m.preservedActivities / m.totalActivities) * 100) : 0;
        const structures = m.preservedStructures.length > 3
          ? m.preservedStructures.slice(0, 3).join(", ") + `... (+${m.preservedStructures.length - 3})`
          : m.preservedStructures.join(", ");
        md += `| \`${m.file}\` | ${m.totalActivities} | ${m.preservedActivities} | ${m.stubbedActivities} | ${rate}% | ${structures} |\n`;
      }
      md += `\n`;
    }
  }

  const workflowRemediations = report.remediations.filter(r => r.level === "workflow");
  if (workflowRemediations.length > 0) {
    md += `### Workflow-Level Stubs (${workflowRemediations.length})\n\n`;
    md += `Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).\n\n`;
    md += `| # | File | Code | Developer Action | Est. Minutes |\n`;
    md += `|---|------|------|-----------------|-------------|\n`;
    workflowRemediations.forEach((r, i) => {
      const action = (r.developerAction || "").length > 80
        ? (r.developerAction || "").slice(0, 77) + "..."
        : (r.developerAction || "—");
      md += `| ${i + 1} | \`${r.file}\` | \`${r.remediationCode}\` | ${action.replace(/\|/g, "\\|")} | ${r.estimatedEffortMinutes} |\n`;
    });
    md += `\n`;
  }

  if (report.qualityWarnings.length > 0) {
    const selectorWarnings = report.qualityWarnings.filter(w => w.check === "SELECTOR_PLACEHOLDER" || w.check === "SELECTOR_LOW_QUALITY");
    const otherWarnings = report.qualityWarnings.filter(w => w.check !== "SELECTOR_PLACEHOLDER" && w.check !== "SELECTOR_LOW_QUALITY");

    if (selectorWarnings.length > 0) {
      md += `### UI Selector Warnings (${selectorWarnings.length})\n\n`;
      md += `These selectors need attention to ensure reliable UI automation.\n\n`;
      md += `| # | File | Check | Business Context | Detail | Est. Minutes |\n`;
      md += `|---|------|-------|-----------------|--------|-------------|\n`;
      selectorWarnings.forEach((w, i) => {
        const detail = w.detail.length > 80 ? w.detail.slice(0, 77) + "..." : w.detail;
        const context = (w.businessContext || "—").length > 80
          ? (w.businessContext || "").slice(0, 77) + "..."
          : (w.businessContext || "—");
        md += `| ${i + 1} | \`${w.file}\` | ${w.check} | ${context.replace(/\|/g, "\\|")} | ${detail.replace(/\|/g, "\\|")} | ${w.estimatedEffortMinutes || 15} |\n`;
      });
      md += `\n`;
    }

    if (otherWarnings.length > 0) {
      md += `### Quality Warnings (${otherWarnings.length})\n\n`;
      md += `| # | File | Check | Detail | Developer Action | Est. Minutes |\n`;
      md += `|---|------|-------|--------|-----------------|-------------|\n`;
      otherWarnings.forEach((w, i) => {
        const detail = w.detail.length > 100 ? w.detail.slice(0, 97) + "..." : w.detail;
        const action = (w.developerAction || "").length > 80
          ? (w.developerAction || "").slice(0, 77) + "..."
          : (w.developerAction || "—");
        md += `| ${i + 1} | \`${w.file}\` | ${w.check} | ${detail.replace(/\|/g, "\\|")} | ${action.replace(/\|/g, "\\|")} | ${w.estimatedEffortMinutes} |\n`;
      });
      md += `\n`;
    }
  }

  if (allRemediations.length > 0 || report.qualityWarnings.length > 0) {
    const remediationEffort = allRemediations.reduce((s, r) => s + (r.estimatedEffortMinutes || 0), 0);
    const warningEffort = report.qualityWarnings.reduce((s, w) => s + (w.estimatedEffortMinutes || 0), 0);
    const totalEffort = remediationEffort + warningEffort;
    md += `**Total manual remediation effort: ~${totalEffort} minutes (${(totalEffort / 60).toFixed(1)} hours)**\n\n`;
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
