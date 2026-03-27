import type { Correction, CorrectionSet, CorrectionConfidence } from "./meta-validator";
import type { ErrorCategory } from "./confidence-scorer";

export interface CorrectionApplicationResult {
  applied: number;
  skipped: number;
  failed: number;
  flatStructureWarnings: number;
  lowConfidenceSkipped: number;
  durationMs: number;
  details: CorrectionDetail[];
  updatedXamlEntries: { name: string; content: string }[];
}

export interface CorrectionDetail {
  workflowName: string;
  category: ErrorCategory;
  confidence: CorrectionConfidence;
  status: "applied" | "skipped" | "failed";
  reason?: string;
  description: string;
}

function findXamlEntry(
  entries: { name: string; content: string }[],
  workflowName: string,
): { name: string; content: string } | undefined {
  return entries.find((e) => {
    const baseName = e.name.replace(".xaml", "").split("/").pop() || e.name;
    return baseName === workflowName;
  });
}

function findActivityScope(xaml: string, displayName: string): { start: number; end: number } | null {
  if (!displayName) return null;
  const escapedName = displayName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<[^/][^>]*DisplayName="${escapedName}"[^>]*/?>`, "g");
  const match = pattern.exec(xaml);
  if (!match || match.index === undefined) return null;

  const start = match.index;
  if (match[0].endsWith("/>")) {
    return { start, end: start + match[0].length };
  }

  const tagNameMatch = match[0].match(/^<(\S+)/);
  if (!tagNameMatch) return { start, end: start + match[0].length };
  const tagName = tagNameMatch[1];
  const closingTag = `</${tagName}>`;
  const closingIdx = xaml.indexOf(closingTag, start + match[0].length);
  if (closingIdx === -1) return { start, end: start + match[0].length };
  return { start, end: closingIdx + closingTag.length };
}

function looksLikeNaturalLanguage(text: string): boolean {
  if (/[;.]\s+[a-z]/.test(text)) return true;

  if (/\b[A-Z][a-z]+\s+[a-z]+\s+[a-z]+\s+[a-z]+/.test(text)) return true;

  const hasXmlSyntax = /[<>\[\]"=&]/.test(text);
  if (!hasXmlSyntax && text.length > 20 && /\s{1,}\w+\s{1,}\w+/.test(text)) return true;

  return false;
}

function wouldBreakAttributeQuoting(xaml: string, original: string, corrected: string): boolean {
  const idx = xaml.indexOf(original);
  if (idx === -1) return false;

  const before = xaml.substring(Math.max(0, idx - 50), idx);
  const after = xaml.substring(idx + original.length, Math.min(xaml.length, idx + original.length + 50));

  const inAttribute = /=\s*"[^"]*$/.test(before) && /^[^"]*"/.test(after);
  if (inAttribute && corrected.includes('"') && !corrected.includes('&quot;')) {
    return true;
  }

  return false;
}

function isCorrectedValueValid(corrected: string): boolean {
  if (looksLikeNaturalLanguage(corrected)) return false;

  if (corrected.length > 30 && !/[<>\[\]"=&{}()]/.test(corrected)) return false;

  return true;
}

function scopedReplace(
  xaml: string,
  correction: Correction,
): { result: string; success: boolean } {
  if (!correction.original || !correction.corrected) {
    return { result: xaml, success: false };
  }

  if (!isCorrectedValueValid(correction.corrected)) {
    console.warn(`[Meta-Validation] Rejected correction as invalid (natural-language commentary detected): "${correction.corrected.substring(0, 80)}..."`);
    return { result: xaml, success: false };
  }

  if (wouldBreakAttributeQuoting(xaml, correction.original, correction.corrected)) {
    console.warn(`[Meta-Validation] Rejected correction that would break attribute quoting: "${correction.corrected.substring(0, 80)}..."`);
    return { result: xaml, success: false };
  }

  if (correction.activityDisplayName) {
    const scope = findActivityScope(xaml, correction.activityDisplayName);
    if (scope) {
      const scopedText = xaml.substring(scope.start, scope.end);
      if (scopedText.includes(correction.original)) {
        const patched = scopedText.replace(correction.original, correction.corrected);
        return {
          result: xaml.substring(0, scope.start) + patched + xaml.substring(scope.end),
          success: true,
        };
      }
    }
  }

  if (!xaml.includes(correction.original)) {
    return { result: xaml, success: false };
  }
  return { result: xaml.replace(correction.original, correction.corrected), success: true };
}

function applyEnumViolation(
  xaml: string,
  correction: Correction,
): { result: string; success: boolean } {
  return scopedReplace(xaml, correction);
}

function applyNestedArguments(
  xaml: string,
  correction: Correction,
): { result: string; success: boolean } {
  const argTags = ["InArgument", "OutArgument"];
  let modified = xaml;
  let changed = false;

  const scope = correction.activityDisplayName
    ? findActivityScope(xaml, correction.activityDisplayName)
    : null;
  const searchRegion = scope
    ? xaml.substring(scope.start, scope.end)
    : xaml;

  let regionModified = searchRegion;
  for (const tag of argTags) {
    const pattern = new RegExp(
      `<${tag}(\\s[^>]*)?>\\s*<${tag}(\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>\\s*<\\/${tag}>`,
      "g",
    );
    const replaced = regionModified.replace(pattern, (_match, outerAttrs, innerAttrs, content) => {
      changed = true;
      const attrs = ((innerAttrs || outerAttrs) || "").trim();
      return `<${tag}${attrs ? " " + attrs : ""}>${content.trim()}</${tag}>`;
    });
    regionModified = replaced;
  }

  if (changed && scope) {
    modified = xaml.substring(0, scope.start) + regionModified + xaml.substring(scope.end);
  } else if (changed) {
    modified = regionModified;
  }

  return { result: modified, success: changed };
}

function applyLiteralExpression(
  xaml: string,
  correction: Correction,
): { result: string; success: boolean } {
  return scopedReplace(xaml, correction);
}

function applyUndeclaredVariable(
  xaml: string,
  correction: Correction,
): { result: string; success: boolean } {
  if (!correction.corrected) return { result: xaml, success: false };

  const variableDecl = correction.corrected.trim();
  if (!variableDecl.startsWith("<Variable")) return { result: xaml, success: false };

  const selfClosingVarsMatch = xaml.match(/<Sequence\.Variables\s*\/>/);
  if (selfClosingVarsMatch && selfClosingVarsMatch.index !== undefined) {
    const replacement = `<Sequence.Variables>\n      ${variableDecl}\n    </Sequence.Variables>`;
    const modified = xaml.substring(0, selfClosingVarsMatch.index) + replacement + xaml.substring(selfClosingVarsMatch.index + selfClosingVarsMatch[0].length);
    return { result: modified, success: true };
  }

  const seqVarsMatch = xaml.match(/<Sequence\.Variables>/);
  if (seqVarsMatch && seqVarsMatch.index !== undefined) {
    const insertPos = seqVarsMatch.index + "<Sequence.Variables>".length;
    const modified = xaml.substring(0, insertPos) + "\n      " + variableDecl + xaml.substring(insertPos);
    return { result: modified, success: true };
  }

  const seqMatch = xaml.match(/<Sequence\s[^>]*>/);
  if (seqMatch && seqMatch.index !== undefined) {
    const insertPos = (seqMatch.index ?? 0) + seqMatch[0].length;
    const variablesBlock = `\n    <Sequence.Variables>\n      ${variableDecl}\n    </Sequence.Variables>`;
    const modified = xaml.substring(0, insertPos) + variablesBlock + xaml.substring(insertPos);
    return { result: modified, success: true };
  }

  return { result: xaml, success: false };
}

function applyMissingProperty(
  xaml: string,
  correction: Correction,
): { result: string; success: boolean } {
  return scopedReplace(xaml, correction);
}

export function applyCorrections(
  xamlEntries: { name: string; content: string }[],
  correctionSet: CorrectionSet,
): CorrectionApplicationResult {
  const startTime = Date.now();
  const details: CorrectionDetail[] = [];
  let applied = 0;
  let skipped = 0;
  let failed = 0;
  let flatStructureWarnings = 0;
  let lowConfidenceSkipped = 0;

  const mutableEntries = xamlEntries.map((e) => ({ ...e }));

  for (const correction of correctionSet.corrections) {
    if (correction.category === "FLAT_STRUCTURE") {
      flatStructureWarnings++;
      skipped++;
      details.push({
        workflowName: correction.workflowName,
        category: correction.category,
        confidence: correction.confidence,
        status: "skipped",
        reason: "FLAT_STRUCTURE corrections are never auto-applied",
        description: correction.description,
      });
      continue;
    }

    if (correction.confidence === "low") {
      lowConfidenceSkipped++;
      skipped++;
      details.push({
        workflowName: correction.workflowName,
        category: correction.category,
        confidence: correction.confidence,
        status: "skipped",
        reason: "Low confidence correction — logged as warning",
        description: correction.description,
      });
      console.warn(`[Meta-Validation] Low-confidence correction skipped: ${correction.category} in ${correction.workflowName}: ${correction.description}`);
      continue;
    }

    const entry = findXamlEntry(mutableEntries, correction.workflowName);
    if (!entry) {
      failed++;
      details.push({
        workflowName: correction.workflowName,
        category: correction.category,
        confidence: correction.confidence,
        status: "failed",
        reason: `Workflow "${correction.workflowName}" not found in XAML entries`,
        description: correction.description,
      });
      continue;
    }

    let result: { result: string; success: boolean };

    switch (correction.category) {
      case "ENUM_VIOLATIONS":
        result = applyEnumViolation(entry.content, correction);
        break;
      case "NESTED_ARGUMENTS":
        result = applyNestedArguments(entry.content, correction);
        break;
      case "LITERAL_EXPRESSIONS":
        result = applyLiteralExpression(entry.content, correction);
        break;
      case "UNDECLARED_VARIABLES":
        result = applyUndeclaredVariable(entry.content, correction);
        break;
      case "MISSING_PROPERTIES":
        result = applyMissingProperty(entry.content, correction);
        break;
      default:
        result = { result: entry.content, success: false };
    }

    if (result.success) {
      entry.content = result.result;
      applied++;
      details.push({
        workflowName: correction.workflowName,
        category: correction.category,
        confidence: correction.confidence,
        status: "applied",
        description: correction.description,
      });
    } else {
      failed++;
      details.push({
        workflowName: correction.workflowName,
        category: correction.category,
        confidence: correction.confidence,
        status: "failed",
        reason: "Could not locate target text in XAML",
        description: correction.description,
      });
    }
  }

  return {
    applied,
    skipped,
    failed,
    flatStructureWarnings,
    lowConfidenceSkipped,
    durationMs: Date.now() - startTime,
    details,
    updatedXamlEntries: mutableEntries,
  };
}
