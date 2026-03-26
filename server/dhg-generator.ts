import type {
  PipelineOutcomeReport,
  RemediationEntry,
} from "./uipath-pipeline";
import type { DhgAnalysisResult } from "./xaml/dhg-analyzers";

export interface DhgContext {
  projectName: string;
  workflowNames: string[];
  generationMode?: "full_implementation" | "baseline_openable";
  generationModeReason?: string;
  generatedDate?: string;
  analysis?: DhgAnalysisResult;
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

  if (context.analysis) {
    const r = context.analysis.readiness;
    md += `**Deployment Readiness:** ${r.rating} (${r.percent}%)\n`;
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

  if (context.analysis) {
    md += generateEnvironmentSetupSection(context.analysis, ++sectionNum);
    md += generateCredentialAssetSection(context.analysis, ++sectionNum);
    md += generateQueueManagementSection(context.analysis, ++sectionNum);
    md += generateExceptionCoverageSection(context.analysis, ++sectionNum);
    md += generateTriggerConfigSection(context.analysis, ++sectionNum);
    md += generatePreDeploymentChecklist(context.analysis, ++sectionNum);
    md += generateReadinessScoreSection(context.analysis, ++sectionNum);
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
  md += `| Orchestrator Connection | ${env.usesOrchestrator ? "Required" : "Not required"} |\n`;

  if (env.usesActionCenter) md += `| Action Center | Required |\n`;
  if (env.usesAICenter) md += `| AI Center | Required |\n`;
  if (env.usesDocumentUnderstanding) md += `| Document Understanding | Required |\n`;
  if (env.usesDataService) md += `| Data Service | Required |\n`;
  md += `\n`;

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
    md += `| # | Credential Name | Action |\n`;
    md += `|---|----------------|--------|\n`;
    inv.uniqueCredentialNames.forEach((name, i) => {
      const isHardcoded = inv.entries.some(e => e.assetName === name && e.isHardcoded);
      md += `| ${i + 1} | \`${name}\` | ${isHardcoded ? "Create in Orchestrator before deployment" : "Verify exists in target environment"} |\n`;
    });
    md += `\n`;
  }

  if (inv.uniqueAssetNames.length > 0) {
    md += `### Orchestrator Assets to Provision\n\n`;
    md += `| # | Asset Name | Action |\n`;
    md += `|---|-----------|--------|\n`;
    inv.uniqueAssetNames.forEach((name, i) => {
      const isHardcoded = inv.entries.some(e => e.assetName === name && e.isHardcoded);
      md += `| ${i + 1} | \`${name}\` | ${isHardcoded ? "Create in Orchestrator before deployment" : "Verify exists in target environment"} |\n`;
    });
    md += `\n`;
  }

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
    md += `### Queues to Provision\n\n`;
    md += `| # | Queue Name | Activities | Action |\n`;
    md += `|---|-----------|------------|--------|\n`;
    q.uniqueQueues.forEach((qName, i) => {
      const activities = q.entries.filter(e => e.queueName === qName).map(e => e.activityType);
      const uniqueActs = [...new Set(activities)].join(", ");
      const isHardcoded = q.entries.some(e => e.queueName === qName && e.isHardcoded);
      md += `| ${i + 1} | \`${qName}\` | ${uniqueActs} | ${isHardcoded ? "Create in Orchestrator" : "Verify exists"} |\n`;
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

  md += `| # | Category | Task | Required |\n`;
  md += `|---|----------|------|----------|\n`;
  items.forEach((item, i) => {
    md += `| ${i + 1} | ${item.category} | ${item.task} | ${item.required ? "Yes" : "Recommended"} |\n`;
  });
  md += `\n`;

  return md;
}

function generateReadinessScoreSection(analysis: DhgAnalysisResult, sectionNum: number): string {
  const r = analysis.readiness;
  let md = `## ${sectionNum}. Deployment Readiness Score\n\n`;

  md += `**Overall: ${r.rating} — ${r.totalScore}/${r.maxTotalScore} (${r.percent}%)**\n\n`;

  md += `| Section | Score | Notes |\n`;
  md += `|---------|-------|-------|\n`;
  for (const sec of r.sections) {
    const notes = sec.notes.join("; ");
    md += `| ${sec.section} | ${sec.score}/${sec.maxScore} | ${notes} |\n`;
  }
  md += `\n`;

  if (r.rating === "Not Ready" || r.rating === "Needs Work") {
    md += `> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.\n\n`;
  } else if (r.rating === "Mostly Ready") {
    md += `> **Almost There:** A few items need attention before production deployment.\n\n`;
  } else {
    md += `> **Good to Go:** The package meets deployment readiness criteria.\n\n`;
  }

  return md;
}
