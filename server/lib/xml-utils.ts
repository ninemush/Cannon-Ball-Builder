export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function decodeXmlEntities(str: string): string {
  let result = str;
  let prev: string;
  do {
    prev = result;
    result = result
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&amp;/g, "&");
  } while (result !== prev);
  return result;
}

export function escapeXmlExpression(str: string): string {
  const normalized = decodeXmlEntities(str);
  return normalized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeXmlTextContent(str: string): string {
  const decoded = decodeXmlEntities(str);
  return decoded
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeXmlExpression(str: string): string {
  let result = str;
  let prev: string;
  do {
    prev = result;
    result = result
      .replace(/&amp;quot;/g, "&quot;")
      .replace(/&amp;amp;/g, "&amp;")
      .replace(/&amp;lt;/g, "&lt;")
      .replace(/&amp;gt;/g, "&gt;")
      .replace(/&amp;apos;/g, "&apos;");
  } while (result !== prev);
  return result;
}

export function escapeXmlAttributeValue(raw: string): string {
  const decoded = decodeXmlEntities(raw);
  return escapeXml(decoded);
}

let _authoritativeSerializerCallCount = 0;
let _authoritativeSerializerCorrectionCount = 0;
let _authoritativeSerializerBypassAttempts: string[] = [];

export interface AttributeSerializerDiagnostics {
  calls: number;
  corrections: number;
  bypassAttempts: string[];
}

export function getAttributeSerializerDiagnostics(): AttributeSerializerDiagnostics {
  return {
    calls: _authoritativeSerializerCallCount,
    corrections: _authoritativeSerializerCorrectionCount,
    bypassAttempts: [..._authoritativeSerializerBypassAttempts],
  };
}

export function resetAttributeSerializerDiagnostics(): void {
  _authoritativeSerializerCallCount = 0;
  _authoritativeSerializerCorrectionCount = 0;
  _authoritativeSerializerBypassAttempts = [];
}

export function reportAttributeSerializerBypass(context: string): void {
  _authoritativeSerializerBypassAttempts.push(context);
}

export function serializeSafeAttributeValue(raw: string): string {
  _authoritativeSerializerCallCount++;
  if (!raw || raw.length === 0) return raw;

  const decoded = decodeXmlEntities(raw);
  const escaped = decoded
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  if (escaped !== raw) {
    _authoritativeSerializerCorrectionCount++;
  }

  return escaped;
}

export function fixUnescapedAmpersands(xmlContent: string): { content: string; fixCount: number } {
  let fixCount = 0;
  const fixed = xmlContent.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, () => {
    fixCount++;
    return "&amp;";
  });
  return { content: fixed, fixCount };
}

export interface QuoteRepairResult {
  repaired: boolean;
  content: string;
  repairs: QuoteRepairDetail[];
}

export interface QuoteRepairDetail {
  line: number;
  attributeName: string;
  originalValue: string;
  repairedValue: string;
  repairReason: string;
}

export function repairMalformedQuotesInXaml(xamlContent: string): QuoteRepairResult {
  const lines = xamlContent.split("\n");
  const repairs: QuoteRepairDetail[] = [];
  let anyRepaired = false;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const repairedLine = repairLineQuotes(line, lineIdx + 1, repairs);
    if (repairedLine !== line) {
      lines[lineIdx] = repairedLine;
      anyRepaired = true;
    }
  }

  return {
    repaired: anyRepaired,
    content: anyRepaired ? lines.join("\n") : xamlContent,
    repairs,
  };
}

function repairLineQuotes(line: string, lineNum: number, repairs: QuoteRepairDetail[]): string {
  const attrPattern = /(\w[\w:.]*)\s*=\s*"/g;
  let result = line;
  let offset = 0;

  let attrMatch;
  const lineForScan = line;
  while ((attrMatch = attrPattern.exec(lineForScan)) !== null) {
    const attrName = attrMatch[1];
    if (attrName === "Selector") continue;

    const valueStart = attrMatch.index + attrMatch[0].length;
    const closingQuoteIdx = findClosingAttributeQuote(lineForScan, valueStart);
    if (closingQuoteIdx < 0) continue;

    const rawValue = lineForScan.substring(valueStart, closingQuoteIdx);

    const withoutEntities = rawValue
      .replace(/&quot;/g, "")
      .replace(/&apos;/g, "")
      .replace(/&amp;/g, "")
      .replace(/&lt;/g, "")
      .replace(/&gt;/g, "");

    const isVbStringLiteral = /^'.*'$/.test(withoutEntities.trim());
    if (isVbStringLiteral) continue;
    const isBracketedExpr = /^\[.*\]$/.test(withoutEntities.trim());
    if (isBracketedExpr && !withoutEntities.includes('"')) continue;

    if (!withoutEntities.includes('"')) continue;

    const repairedValue = deterministicQuoteRepair(rawValue);
    if (repairedValue === null) continue;
    if (repairedValue === rawValue) continue;

    repairs.push({
      line: lineNum,
      attributeName: attrName,
      originalValue: rawValue,
      repairedValue,
      repairReason: "raw_quote_escaped_to_entity",
    });

    const adjValueStart = valueStart + offset;
    const adjClosingQuoteIdx = closingQuoteIdx + offset;
    result = result.substring(0, adjValueStart) + repairedValue + result.substring(adjClosingQuoteIdx);
    offset += repairedValue.length - rawValue.length;
  }

  return result;
}

export function findClosingAttributeQuote(line: string, startIdx: number): number {
  let lastCandidateIdx = -1;
  for (let i = startIdx; i < line.length; i++) {
    if (line[i] !== '"') continue;
    const after = line.substring(i + 1).trimStart();
    if (/^(\/?>|\w[\w:.]*\s*=|$)/.test(after)) {
      return i;
    }
    lastCandidateIdx = i;
  }
  return lastCandidateIdx;
}

export function deterministicQuoteRepair(attrValue: string): string | null {
  const ENTITY_PLACEHOLDER = "\x00ENTITY_";
  let work = attrValue;
  const entities: string[] = [];

  work = work.replace(/&(quot|apos|amp|lt|gt);/g, (match) => {
    const idx = entities.length;
    entities.push(match);
    return `${ENTITY_PLACEHOLDER}${idx}\x00`;
  });

  if (!work.includes('"')) {
    return attrValue;
  }

  work = work.replace(/"/g, "&quot;");

  for (let i = entities.length - 1; i >= 0; i--) {
    work = work.replace(`${ENTITY_PLACEHOLDER}${i}\x00`, entities[i]);
  }

  if (work.includes("&amp;quot;") || work.includes("&amp;amp;")) {
    return null;
  }

  return work;
}
