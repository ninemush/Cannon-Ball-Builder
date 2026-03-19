import type { ErrorCategory } from "./confidence-scorer";
import { getLLM, getLLMForModel, getActiveMetaValidationModel, type LLMProvider } from "../lib/llm";

export type CorrectionConfidence = "high" | "medium" | "low";

export interface Correction {
  workflowName: string;
  activityDisplayName: string;
  xpath?: string;
  category: ErrorCategory;
  confidence: CorrectionConfidence;
  description: string;
  original: string;
  corrected: string;
}

export interface CorrectionSet {
  corrections: Correction[];
  totalReviewed: number;
  reviewDurationMs: number;
  inputTokens: number;
  outputTokens: number;
  modelUsed?: string;
}

const ERROR_CATEGORY_DESCRIPTIONS: Record<ErrorCategory, string> = {
  ENUM_VIOLATIONS: `ENUM_VIOLATIONS: Activity properties with invalid enum values. For example, LogMessage Level must be one of: Info, Warn, Error, Fatal, Trace. Check every property that has a fixed set of valid values and flag any value not in that set.`,
  NESTED_ARGUMENTS: `NESTED_ARGUMENTS: Doubled/nested InArgument or OutArgument tags. For example, <InArgument><InArgument>value</InArgument></InArgument> should be collapsed to <InArgument>value</InArgument>. Check for any argument tag nested inside another argument tag of the same type.`,
  LITERAL_EXPRESSIONS: `LITERAL_EXPRESSIONS: Variable references in attribute values that are not wrapped in brackets. In UiPath XAML, variable references in expression attributes must be wrapped in square brackets like [variableName]. Check for bare variable names used in Value, Condition, Message, and similar expression attributes. Also detect bare < characters inside InArgument/OutArgument text content that are not part of an XML entity reference (e.g. &lt;) or a valid XML tag. A bare < in element text content causes XML parse errors. Auto-correct by escaping to &lt;.`,
  MISSING_PROPERTIES: `MISSING_PROPERTIES: Required properties missing from activity elements. Check that each activity has all mandatory attributes set (e.g., HttpClient needs Url, ExcelReadRange needs SheetName, TypeInto needs Text and Selector).`,
  UNDECLARED_VARIABLES: `UNDECLARED_VARIABLES: Variables referenced in expressions (inside [...]) that are not declared in any <Variable> element within the workflow. Check that every [variableName] reference has a corresponding <Variable ... Name="variableName" /> declaration.`,
  FLAT_STRUCTURE: `FLAT_STRUCTURE: Workflow structure issues — activities that should be nested inside container elements (TryCatch, If, ForEach) are placed flat in a sequence instead. Also check for missing Sequence wrappers inside structural elements. NOTE: Do not attempt to fix these; only report them.`,
};

function buildReviewPrompt(categories: ErrorCategory[], xamlContent: string, workflowName: string): string {
  const categorySection = categories
    .map((cat) => `### ${cat}\n${ERROR_CATEGORY_DESCRIPTIONS[cat]}`)
    .join("\n\n");

  return `You are a UiPath XAML quality reviewer. Your task is to review the following XAML file for SPECIFIC error categories only. Do NOT look for issues outside the listed categories.

## Workflow: ${workflowName}

## Error Categories to Check
${categorySection}

## XAML Content
\`\`\`xml
${xamlContent}
\`\`\`

## Output Format
Return a JSON array of corrections. Each correction must have:
- "workflowName": "${workflowName}"
- "activityDisplayName": the DisplayName of the affected activity
- "xpath": optional XPath-like location hint (e.g. "Sequence/TryCatch/Assign")
- "category": one of the error category names above
- "confidence": "high", "medium", or "low"
- "description": what is wrong
- "original": the exact text that needs to change
- "corrected": what it should be changed to

If no issues are found, return an empty array: []

Return ONLY the JSON array, no markdown fences, no explanation.`;
}

function truncateXaml(xaml: string, maxTokens: number): string {
  const estimatedCharsPerToken = 3.5;
  const maxChars = Math.floor(maxTokens * estimatedCharsPerToken);
  if (xaml.length <= maxChars) return xaml;
  return xaml.substring(0, maxChars) + "\n<!-- [truncated for review] -->";
}

interface RawCorrectionEntry {
  workflowName?: string;
  activityDisplayName?: string;
  xpath?: string;
  category?: string;
  confidence?: string;
  description?: string;
  original?: string;
  corrected?: string;
}

function isRawCorrectionEntry(val: unknown): val is RawCorrectionEntry {
  return val !== null && typeof val === "object";
}

function parseCorrectionResponse(raw: string): Correction[] {
  try {
    let text = raw.trim();
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenceMatch) text = fenceMatch[1].trim();

    const bracketStart = text.indexOf("[");
    const bracketEnd = text.lastIndexOf("]");
    if (bracketStart >= 0 && bracketEnd > bracketStart) {
      text = text.substring(bracketStart, bracketEnd + 1);
    }

    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];

    return (parsed as unknown[])
      .filter((c): c is RawCorrectionEntry => isRawCorrectionEntry(c) && !!(c as RawCorrectionEntry).category && !!(c as RawCorrectionEntry).description)
      .map((c: RawCorrectionEntry): Correction => ({
        workflowName: c.workflowName || "",
        activityDisplayName: c.activityDisplayName || "",
        xpath: c.xpath || undefined,
        category: (c.category || "MISSING_PROPERTIES") as ErrorCategory,
        confidence: (["high", "medium", "low"].includes(c.confidence || "") ? c.confidence as CorrectionConfidence : "low"),
        description: c.description || "",
        original: c.original || "",
        corrected: c.corrected || "",
      }));
  } catch {
    return [];
  }
}

export async function runMetaValidation(
  xamlEntries: { name: string; content: string }[],
  categories: ErrorCategory[],
  onProgress?: (message: string) => void,
): Promise<CorrectionSet> {
  const startTime = Date.now();
  const allCorrections: Correction[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalReviewed = 0;

  const INPUT_TOKEN_CAP = 6000;
  const OUTPUT_TOKEN_CAP = 2000;

  const configuredModel = getActiveMetaValidationModel();
  let llm: LLMProvider;
  let usedModel = configuredModel;
  try {
    llm = getLLMForModel(configuredModel);
    console.log(`[Meta-Validator] Using configured model (${configuredModel}) for review`);
  } catch {
    console.warn(`[Meta-Validator] Configured model "${configuredModel}" unavailable, falling back to active generation model`);
    try {
      llm = getLLM();
      usedModel = "default";
    } catch {
      console.warn("[Meta-Validator] No LLM available for meta-validation");
      return {
        corrections: [],
        totalReviewed: 0,
        reviewDurationMs: Date.now() - startTime,
        inputTokens: 0,
        outputTokens: 0,
      };
    }
  }

  for (const entry of xamlEntries) {
    const workflowName = entry.name.replace(".xaml", "").split("/").pop() || entry.name;
    totalReviewed++;

    if (onProgress) {
      onProgress(`Reviewing ${workflowName} (${totalReviewed}/${xamlEntries.length})...`);
    }

    const truncatedXaml = truncateXaml(entry.content, INPUT_TOKEN_CAP);
    const prompt = buildReviewPrompt(categories, truncatedXaml, workflowName);

    try {
      const response = await llm.create({
        system: "You are a UiPath XAML quality reviewer. Return only valid JSON arrays of corrections.",
        messages: [{ role: "user", content: prompt }],
        maxTokens: OUTPUT_TOKEN_CAP,
      });

      const responseText = response.text;

      const inputEstimate = Math.ceil(prompt.length / 3.5);
      const outputEstimate = Math.ceil(responseText.length / 3.5);
      totalInputTokens += inputEstimate;
      totalOutputTokens += outputEstimate;

      const corrections = parseCorrectionResponse(responseText);
      for (const c of corrections) {
        c.workflowName = workflowName;
        allCorrections.push(c);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[Meta-Validator] Review failed for ${workflowName}: ${errMsg}`);
    }
  }

  return {
    corrections: allCorrections,
    totalReviewed,
    reviewDurationMs: Date.now() - startTime,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    modelUsed: usedModel,
  };
}

export { parseCorrectionResponse };
