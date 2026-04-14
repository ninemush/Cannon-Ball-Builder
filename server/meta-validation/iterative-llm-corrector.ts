import type { ErrorCategory } from "./confidence-scorer";
import { runDeterministicValidation } from "./deterministic-validators";
import { applyCorrections } from "./correction-applier";
import type { CorrectionSet } from "./meta-validator";
import { getLLM, getActiveModel, type LLMProvider } from "../lib/llm";
import { runQualityGate, type QualityGateViolation } from "../uipath-quality-gate";
import { recordLlmCall, buildLlmTraceEntry, getCurrentRunId } from "../llm-trace-collector";
import { registerStage } from "../catalog/filtered-schema-lookup";
import { buildPromptPackageGuidance } from "../catalog/prompt-guidance-filter";
import { metadataService } from "../catalog/metadata-service";

registerStage("iterative-llm-corrector");

const LLM_CORRECTION_MAX_ROUNDS = 2;
const LLM_CORRECTION_MAX_TOKENS = 4000;
const MAX_XAML_CHARS_FOR_LLM = 14000;

const FRAGILE_CATEGORIES: ErrorCategory[] = [
  "ENUM_VIOLATIONS",
  "LITERAL_EXPRESSIONS",
  "UNDECLARED_VARIABLES",
  "MISSING_PROPERTIES",
  "NESTED_ARGUMENTS",
];

const FIXABLE_QG_CHECKS = new Set([
  "unknown-activity",
  "deprecated-activity",
  "non-emission-approved-activity",
  "target-incompatible-activity",
  "invalid-activity-property",
  "undeclared-variable",
  "expression-syntax",
  "cli-namespace-error",
  "cli-argument-error",
  "cli-variable-error",
  "cli-expression-error",
]);

const CLI_RULE_TO_CHECK: Record<string, string> = {
  "ST-NMG-001": "cli-namespace-error",
  "ST-NMG-002": "cli-namespace-error",
  "ST-NMG-004": "cli-namespace-error",
  "ST-NMG-005": "cli-namespace-error",
  "ST-NMG-006": "cli-namespace-error",
  "ST-NMG-008": "cli-namespace-error",
  "ST-NMG-009": "cli-namespace-error",
  "ST-NMG-011": "cli-namespace-error",
  "ST-NMG-012": "cli-namespace-error",
  "ST-NMG-016": "cli-namespace-error",
  "ST-DBP-002": "cli-argument-error",
  "ST-DBP-006": "cli-argument-error",
  "ST-DBP-020": "cli-argument-error",
  "ST-USG-005": "cli-variable-error",
  "ST-USG-007": "cli-variable-error",
  "ST-USG-010": "cli-variable-error",
  "ST-USG-014": "cli-variable-error",
  "ST-USG-028": "cli-variable-error",
  "ST-USG-034": "cli-expression-error",
  "ST-SEC-009": "cli-expression-error",
};

const CLI_FIXABLE_RULE_IDS = new Set(Object.keys(CLI_RULE_TO_CHECK));

export interface QualityGateIssue {
  check: string;
  file: string;
  detail: string;
  severity: string;
  source?: "internal" | "cli";
}

export interface WorkflowSpecContext {
  name: string;
  description?: string;
  steps?: Array<{
    activity?: string;
    activityType?: string;
    activityPackage?: string;
    properties?: Record<string, unknown>;
  }>;
  variables?: Array<{
    name?: string;
    type?: string;
  }>;
}

export interface IterativeCorrectionResult {
  totalRounds: number;
  totalCorrectionsApplied: number;
  totalCorrectionsSkipped: number;
  totalCorrectionsFailed: number;
  updatedXamlEntries: { name: string; content: string }[];
  durationMs: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  remainingIssueCount: number;
}

export interface ProjectContext {
  projectJsonContent: string;
  targetFramework: "Windows" | "Portable";
  archiveManifest?: string[];
}

function countFixableQgViolations(violations: QualityGateViolation[]): QualityGateIssue[] {
  return violations
    .filter(v => FIXABLE_QG_CHECKS.has(v.check))
    .map(v => ({ check: v.check, file: v.file, detail: v.detail, severity: v.severity, source: "internal" as const }));
}

export function normalizeCliDefectsToQgIssues(
  cliDefects: Array<{ source: string; ruleId: string; severity: string; file: string; line?: number; message: string }>
): { fixable: QualityGateIssue[]; diagnosticOnly: Array<{ ruleId: string; file: string; message: string; severity: string }> } {
  const fixable: QualityGateIssue[] = [];
  const diagnosticOnly: Array<{ ruleId: string; file: string; message: string; severity: string }> = [];

  for (const defect of cliDefects) {
    const mappedCheck = CLI_RULE_TO_CHECK[defect.ruleId];
    if (mappedCheck && FIXABLE_QG_CHECKS.has(mappedCheck)) {
      fixable.push({
        check: mappedCheck,
        file: defect.file || "unknown.xaml",
        detail: `[CLI:${defect.ruleId}] ${defect.message}`,
        severity: defect.severity === "Error" ? "error" : "warning",
        source: "cli",
      });
    } else {
      diagnosticOnly.push({
        ruleId: defect.ruleId,
        file: defect.file,
        message: defect.message,
        severity: defect.severity,
      });
    }
  }

  return { fixable, diagnosticOnly };
}

export { CLI_FIXABLE_RULE_IDS, CLI_RULE_TO_CHECK };

function countFragileIssues(correctionSet: CorrectionSet): number {
  return correctionSet.corrections.filter(
    (c) => FRAGILE_CATEGORIES.includes(c.category),
  ).length;
}

function countFragileForWorkflow(correctionSet: CorrectionSet, workflowName: string): number {
  return correctionSet.corrections.filter(
    (c) => FRAGILE_CATEGORIES.includes(c.category) && c.workflowName === workflowName,
  ).length;
}

function groupQgIssuesByWorkflow(issues: QualityGateIssue[]): Record<string, QualityGateIssue[]> {
  const result: Record<string, QualityGateIssue[]> = {};
  for (const issue of issues) {
    if (!FIXABLE_QG_CHECKS.has(issue.check)) continue;
    const wfName = issue.file.replace(".xaml", "").split("/").pop() || issue.file;
    if (!result[wfName]) result[wfName] = [];
    result[wfName].push(issue);
  }
  return result;
}

function buildLlmCorrectionPrompt(
  xamlContent: string,
  workflowName: string,
  deterministicIssues: CorrectionSet,
  qgIssues: QualityGateIssue[],
  workflowSpec?: WorkflowSpecContext,
): string {
  const deterministicDescriptions = deterministicIssues.corrections
    .filter((c) => FRAGILE_CATEGORIES.includes(c.category))
    .map(
      (c) =>
        `- [${c.category}] ${c.description} (activity: ${c.activityDisplayName || "N/A"})${c.original ? ` | original: "${c.original}"` : ""}`,
    );

  const qgDescriptions = qgIssues.map(
    (q) => `- [QG:${q.check}] ${q.detail}`,
  );

  const allIssues = [...deterministicDescriptions, ...qgDescriptions].join("\n");

  const specBlock = workflowSpec
    ? `\n## Original Workflow Specification (authoritative source of intent)
Workflow: ${workflowSpec.name}
Description: ${workflowSpec.description || "N/A"}
Variables: ${JSON.stringify(workflowSpec.variables || [], null, 2)}
Steps:
${JSON.stringify(workflowSpec.steps || [], null, 2)}
`
    : "";

  const profile = metadataService.getStudioProfile();
  const { guidance: catalogGuidance } = buildPromptPackageGuidance(profile);
  const catalogBlock = catalogGuidance
    ? `\n## Approved Activity Catalog\nThe following activities and packages are approved for use. Use ONLY activities from this list.\n${catalogGuidance}\n`
    : "";

  return `You are a UiPath XAML regeneration specialist. You are given:
1. The ORIGINAL workflow specification (the authoritative description of what this workflow should do)
2. The CURRENT XAML (which was generated from that spec but has defects)
3. A list of specific defects found during validation
4. The approved activity catalog (only these activities are valid)

Your task: regenerate the workflow body to faithfully implement the original specification while eliminating the listed defects. Use the original spec as the primary guide for what activities, properties, and variables should exist. The current XAML provides structural context (namespaces, argument wiring, scoping) but may contain errors.

## Workflow: ${workflowName}
${specBlock}${catalogBlock}
## Defects Found in Current XAML
${allIssues}

## Regeneration Rules
- Regenerate the workflow to match the original specification's intent while fixing ALL listed defects.
- Use ONLY activities from the UiPath catalog that match the spec's activityType and activityPackage fields.
- For unknown-activity: replace stubbed/unknown activities with the correct catalog activity that matches the original spec step. Use the spec's activityType and activityPackage as the authoritative source. If no catalog match exists, use a Comment activity documenting the intended behavior.
- For invalid-activity-property: use only properties valid for each activity type per the catalog. Consult the spec's properties field to understand what was intended, then map to valid catalog property names.
- For UNDECLARED_VARIABLES / undeclared-variable: declare all variables from the spec in the correct scope's .Variables section with proper types.
- For LITERAL_EXPRESSIONS: wrap bare variable references in square brackets [variableName] in expression attributes.
- For ENUM_VIOLATIONS: replace invalid enum values with correct ones from the valid set.
- For MISSING_PROPERTIES: add missing required properties using values from the spec.
- For NESTED_ARGUMENTS: collapse doubled/nested InArgument or OutArgument wrappers.
- For expression-syntax: use valid VB.NET syntax (& not +, <> not !=, no $"" interpolation, bracket-wrap variables).
- For cli-namespace-error: ensure all XML namespace prefixes used in activities have corresponding xmlns declarations in the root Activity element. Add missing xmlns entries matching the pattern xmlns:prefix="clr-namespace:Namespace;assembly=Assembly".
- For cli-argument-error: ensure all InvokeWorkflowFile arguments match the target workflow's declared In/Out/InOut arguments in type and direction. Remove undeclared arguments and add missing required ones.
- For cli-variable-error: ensure all referenced variables are declared in the nearest enclosing scope's Variables section with correct x:TypeArguments. Remove unused variable declarations that trigger warnings.
- For cli-expression-error: fix VB.NET expression syntax errors flagged by the CLI analyzer — ensure proper bracket-wrapping, correct method calls, and valid type casts.
- Preserve XML namespaces, argument declarations, and overall document structure from the current XAML.
- Return the COMPLETE regenerated XAML — not a diff, not a snippet.

## Current XAML (with defects)
\`\`\`xml
${xamlContent}
\`\`\`

Return ONLY the regenerated XAML content, no markdown fences, no explanation.`;
}

function extractXamlFromResponse(response: string): string {
  let text = response.trim();
  const fenceMatch = text.match(/```(?:xml)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  return text;
}

export async function runIterativeLlmCorrection(
  xamlEntries: { name: string; content: string }[],
  onProgress?: (message: string) => void,
  qualityGateIssues?: QualityGateIssue[],
  workflowSpecs?: WorkflowSpecContext[],
  projectContext?: ProjectContext,
): Promise<IterativeCorrectionResult> {
  const startTime = Date.now();
  let totalApplied = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let mutableEntries = xamlEntries.map((e) => ({ ...e }));

  const qgIssuesByWorkflow = groupQgIssuesByWorkflow(qualityGateIssues || []);
  const specsByName: Record<string, WorkflowSpecContext> = {};
  if (workflowSpecs) {
    for (const spec of workflowSpecs) {
      specsByName[spec.name] = spec;
    }
  }

  const initialValidation = runDeterministicValidation(mutableEntries, FRAGILE_CATEGORIES);
  const initialFragileCount = countFragileIssues(initialValidation);
  const initialQgCount = Object.values(qgIssuesByWorkflow).reduce((sum, arr) => sum + arr.length, 0);
  const totalInitialIssues = initialFragileCount + initialQgCount;

  if (totalInitialIssues === 0) {
    return {
      totalRounds: 0,
      totalCorrectionsApplied: 0,
      totalCorrectionsSkipped: 0,
      totalCorrectionsFailed: 0,
      updatedXamlEntries: mutableEntries,
      durationMs: Date.now() - startTime,
      llmInputTokens: 0,
      llmOutputTokens: 0,
      remainingIssueCount: 0,
    };
  }

  let llm: LLMProvider;
  try {
    llm = getLLM();
  } catch {
    console.warn("[Iterative LLM Corrector] No LLM available — skipping iterative correction");
    return {
      totalRounds: 0,
      totalCorrectionsApplied: 0,
      totalCorrectionsSkipped: 0,
      totalCorrectionsFailed: 0,
      updatedXamlEntries: mutableEntries,
      durationMs: Date.now() - startTime,
      llmInputTokens: 0,
      llmOutputTokens: 0,
      remainingIssueCount: totalInitialIssues,
    };
  }

  let round = 0;
  for (round = 1; round <= LLM_CORRECTION_MAX_ROUNDS; round++) {
    if (onProgress) {
      onProgress(`Iterative LLM correction round ${round}/${LLM_CORRECTION_MAX_ROUNDS}...`);
    }

    const revalidation = runDeterministicValidation(
      mutableEntries,
      FRAGILE_CATEGORIES,
    );

    const fragileCount = countFragileIssues(revalidation);
    const qgCount = Object.values(qgIssuesByWorkflow).reduce((sum, arr) => sum + arr.length, 0);

    if (fragileCount === 0 && qgCount === 0) {
      console.log(`[Iterative LLM Corrector] Round ${round}: no fixable issues remain — stopping`);
      break;
    }

    console.log(`[Iterative LLM Corrector] Round ${round}: ${fragileCount} deterministic + ${qgCount} quality-gate issue(s) found, attempting LLM correction`);

    const issuesByWorkflow: Record<string, typeof revalidation.corrections> = {};
    for (const c of revalidation.corrections) {
      if (!FRAGILE_CATEGORIES.includes(c.category)) continue;
      if (!issuesByWorkflow[c.workflowName]) {
        issuesByWorkflow[c.workflowName] = [];
      }
      issuesByWorkflow[c.workflowName].push(c);
    }

    const allWorkflowNamesArr = Array.from(new Set([
      ...Object.keys(issuesByWorkflow),
      ...Object.keys(qgIssuesByWorkflow),
    ]));

    let roundApplied = 0;
    for (const workflowName of allWorkflowNamesArr) {
      const corrections = issuesByWorkflow[workflowName] || [];
      const qgIssues = qgIssuesByWorkflow[workflowName] || [];
      const totalIssuesForWf = corrections.length + qgIssues.length;
      if (totalIssuesForWf === 0) continue;

      const entry = mutableEntries.find((e) => {
        const baseName = e.name.replace(".xaml", "").split("/").pop() || e.name;
        return baseName === workflowName;
      });
      if (!entry) continue;

      if (entry.content.length > MAX_XAML_CHARS_FOR_LLM) {
        console.warn(
          `[Iterative LLM Corrector] Round ${round}: skipping ${workflowName} — XAML too large (${entry.content.length} chars > ${MAX_XAML_CHARS_FOR_LLM} limit), falling back to deterministic`,
        );
        if (corrections.length > 0) {
          const correctionSet: CorrectionSet = {
            corrections,
            totalReviewed: 1,
            reviewDurationMs: 0,
            inputTokens: 0,
            outputTokens: 0,
          };
          const deterministicResult = applyCorrections([entry], correctionSet);
          if (deterministicResult.applied > 0) {
            entry.content = deterministicResult.updatedXamlEntries[0].content;
            roundApplied += deterministicResult.applied;
            totalApplied += deterministicResult.applied;
          }
          totalSkipped += corrections.length - (deterministicResult.applied || 0);
        }
        totalSkipped += qgIssues.length;
        continue;
      }

      const correctionSet: CorrectionSet = {
        corrections,
        totalReviewed: 1,
        reviewDurationMs: 0,
        inputTokens: 0,
        outputTokens: 0,
      };

      const workflowSpec = specsByName[workflowName];

      const prompt = buildLlmCorrectionPrompt(
        entry.content,
        workflowName,
        correctionSet,
        qgIssues,
        workflowSpec,
      );

      const issuesBefore = countFragileForWorkflow(revalidation, workflowName) + qgIssues.length;

      const iterLlmOptions = {
        system: "You are a UiPath XAML regeneration specialist. You regenerate workflow XAML from the original specification and current defective XAML. Return only the regenerated XAML content.",
        messages: [{ role: "user", content: prompt }] as Array<{ role: "user" | "assistant"; content: string }>,
        maxTokens: LLM_CORRECTION_MAX_TOKENS,
      };
      const iterCallStart = Date.now();
      try {
        const response = await llm.create(iterLlmOptions);

        const iterRunId = getCurrentRunId();
        if (iterRunId) {
          recordLlmCall(iterRunId, buildLlmTraceEntry(
            `iterative_correction:${workflowName}:round_${round}`,
            iterLlmOptions,
            response.text,
            Date.now() - iterCallStart,
            "success",
            undefined,
            getActiveModel(),
          ));
        }

        const inputEst = Math.ceil(prompt.length / 3.5);
        const outputEst = Math.ceil(response.text.length / 3.5);
        totalInputTokens += inputEst;
        totalOutputTokens += outputEst;

        const correctedXaml = extractXamlFromResponse(response.text);

        if (
          correctedXaml.length < entry.content.length * 0.5 ||
          correctedXaml.length > entry.content.length * 2
        ) {
          console.warn(
            `[Iterative LLM Corrector] Round ${round}: LLM response for ${workflowName} has suspicious length (${correctedXaml.length} vs original ${entry.content.length}) — skipping`,
          );
          totalSkipped += totalIssuesForWf;
          continue;
        }

        try {
          const { XMLParser } = await import("fast-xml-parser");
          const parser = new XMLParser({
            ignoreAttributes: false,
            allowBooleanAttributes: true,
            processEntities: false,
          });
          parser.parse(correctedXaml);
        } catch (xmlErr: any) {
          const xmlRunId = getCurrentRunId();
          if (xmlRunId) {
            recordLlmCall(xmlRunId, buildLlmTraceEntry(
              `iterative_correction:${workflowName}:round_${round}:xml_validation`,
              iterLlmOptions,
              response.text,
              Date.now() - iterCallStart,
              "parse_error",
              `Malformed XML: ${xmlErr.message}`,
              getActiveModel(),
            ));
          }
          console.warn(
            `[Iterative LLM Corrector] Round ${round}: LLM-corrected XAML for ${workflowName} is malformed: ${xmlErr.message} — falling back to deterministic corrections`,
          );

          if (corrections.length > 0) {
            const deterministicResult = applyCorrections(
              [entry],
              correctionSet,
            );
            if (deterministicResult.applied > 0) {
              entry.content = deterministicResult.updatedXamlEntries[0].content;
              roundApplied += deterministicResult.applied;
              totalApplied += deterministicResult.applied;
            }
            totalFailed += corrections.length - (deterministicResult.applied || 0);
          }
          totalFailed += qgIssues.length;
          continue;
        }

        const originalContent = entry.content;
        entry.content = correctedXaml;

        const postFixValidation = runDeterministicValidation(
          [entry],
          FRAGILE_CATEGORIES,
        );
        const deterministicAfter = countFragileForWorkflow(postFixValidation, workflowName);
        const deterministicBefore = countFragileForWorkflow(revalidation, workflowName);
        const deterministicResolved = Math.max(0, deterministicBefore - deterministicAfter);

        let qgResolved = 0;
        const internalQgIssues = qgIssues.filter(q => q.source !== "cli");
        const cliQgIssues = qgIssues.filter(q => q.source === "cli");

        if (internalQgIssues.length > 0 && projectContext) {
          try {
            const postFixQg = runQualityGate({
              xamlEntries: mutableEntries,
              projectJsonContent: projectContext.projectJsonContent,
              targetFramework: projectContext.targetFramework,
              archiveManifest: projectContext.archiveManifest,
            });
            const postFixQgIssues = countFixableQgViolations(postFixQg.violations);
            const postFixQgForWf = postFixQgIssues.filter(v => {
              const wfName = v.file.replace(".xaml", "").split("/").pop() || v.file;
              return wfName === workflowName;
            });
            qgResolved = Math.max(0, internalQgIssues.length - postFixQgForWf.length);

            const remainingForWf = [...postFixQgForWf, ...cliQgIssues];
            if (remainingForWf.length > 0) {
              qgIssuesByWorkflow[workflowName] = remainingForWf;
            } else {
              delete qgIssuesByWorkflow[workflowName];
            }
          } catch (qgErr: unknown) {
            const errMsg = qgErr instanceof Error ? qgErr.message : String(qgErr);
            console.warn(
              `[Iterative LLM Corrector] Round ${round}: post-fix quality gate re-run failed for ${workflowName}: ${errMsg} — treating QG issues as unresolved`,
            );
          }
        } else if (internalQgIssues.length > 0) {
          console.warn(
            `[Iterative LLM Corrector] Round ${round}: no project context available — cannot verify QG resolution for ${workflowName}`,
          );
        }

        const cliDeferredCount = cliQgIssues.length;
        const actuallyResolved = deterministicResolved + qgResolved;
        const nonRegression = deterministicAfter <= deterministicBefore;

        if (actuallyResolved > 0) {
          const qgStillPresent = internalQgIssues.length - qgResolved;
          roundApplied += actuallyResolved;
          totalApplied += actuallyResolved;

          if (cliDeferredCount > 0) {
            roundApplied += cliDeferredCount;
            totalApplied += cliDeferredCount;
            const remainingInternal = qgIssuesByWorkflow[workflowName]?.filter(q => q.source !== "cli") || [];
            if (remainingInternal.length > 0) {
              qgIssuesByWorkflow[workflowName] = remainingInternal;
            } else {
              delete qgIssuesByWorkflow[workflowName];
            }
            console.log(
              `[Iterative LLM Corrector] Round ${round}: ${cliDeferredCount} CLI-sourced issue(s) in ${workflowName} accepted with deferred verification (final CLI pass will verify)`,
            );
          }

          if (qgStillPresent > 0) {
            totalFailed += qgStillPresent;
          }

          console.log(
            `[Iterative LLM Corrector] Round ${round}: regeneration resolved ${deterministicResolved} deterministic + ${qgResolved}/${internalQgIssues.length} internal QG issue(s) in ${workflowName} (${deterministicAfter} deterministic remaining, ${cliDeferredCount} CLI-deferred)`,
          );
        } else if (cliDeferredCount > 0 && nonRegression) {
          roundApplied += cliDeferredCount;
          totalApplied += cliDeferredCount;
          delete qgIssuesByWorkflow[workflowName];
          console.log(
            `[Iterative LLM Corrector] Round ${round}: ${cliDeferredCount} CLI-sourced issue(s) in ${workflowName} accepted with deferred verification (no internal regression detected, final CLI pass will verify)`,
          );
        } else {
          entry.content = originalContent;
          totalFailed += totalIssuesForWf;
          console.warn(
            `[Iterative LLM Corrector] Round ${round}: regeneration for ${workflowName} did not reduce validated issue count — reverting`,
          );
        }
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const iterRunId = getCurrentRunId();
        if (iterRunId) {
          recordLlmCall(iterRunId, buildLlmTraceEntry(
            `iterative_correction:${workflowName}:round_${round}`,
            iterLlmOptions,
            "",
            Date.now() - iterCallStart,
            "error",
            errMsg,
            getActiveModel(),
          ));
        }
        console.warn(
          `[Iterative LLM Corrector] Round ${round}: LLM call failed for ${workflowName}: ${errMsg}`,
        );
        totalFailed += totalIssuesForWf;
      }
    }

    if (roundApplied === 0) {
      console.log(
        `[Iterative LLM Corrector] Round ${round}: no corrections applied — stopping early`,
      );
      break;
    }
  }

  const finalValidation = runDeterministicValidation(
    mutableEntries,
    FRAGILE_CATEGORIES,
  );
  const remainingDeterministic = countFragileIssues(finalValidation);
  const remainingQg = Object.values(qgIssuesByWorkflow).reduce((sum, arr) => sum + arr.length, 0);
  const remainingTotal = remainingDeterministic + remainingQg;

  console.log(
    `[Iterative LLM Corrector] Completed: ${round - 1} round(s), ${totalApplied} verified fixes, ${totalSkipped} skipped, ${totalFailed} failed, ${remainingTotal} remaining (${remainingDeterministic} deterministic + ${remainingQg} QG)`,
  );

  return {
    totalRounds: round - 1,
    totalCorrectionsApplied: totalApplied,
    totalCorrectionsSkipped: totalSkipped,
    totalCorrectionsFailed: totalFailed,
    updatedXamlEntries: mutableEntries,
    durationMs: Date.now() - startTime,
    llmInputTokens: totalInputTokens,
    llmOutputTokens: totalOutputTokens,
    remainingIssueCount: remainingTotal,
  };
}
