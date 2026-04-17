export type PlaceholderContext = "xml-attribute" | "xml-text-node" | "vb-expression";

export interface PlaceholderSanitizationRecord {
  originalToken: string;
  contextType: PlaceholderContext;
  replacement: string;
  source: string;
}

/**
 * Provenance record attached to every pipeline-generated placeholder / fallback.
 * Carried forward through pipeline stages so the final quality gate can
 * distinguish pipeline-generated localized degradation from genuine structural
 * failures WITHOUT relying on retrospective string matching.
 */
export interface PipelineFallbackProvenance {
  origin: "pipeline-fallback";
  kind: "placeholder-todo-text" | "placeholder-todo-token" | "placeholder-fallback-token" | "handoff-marker";
  source: string;
  reason: string;
  createdAt: number;
}

export interface CanonicalPlaceholder {
  value: string;
  provenance: PipelineFallbackProvenance;
}

const sanitizationLog: PlaceholderSanitizationRecord[] = [];
const provenanceLedger: PipelineFallbackProvenance[] = [];
// Task #527 RC5: value->provenance index populated at placeholder
// construction time. The integrity validator consults this index to
// classify defect origin, so origin is carried from construction
// through to verdict — not inferred retrospectively from string shape.
const valueProvenanceIndex: Map<string, PipelineFallbackProvenance> = new Map();

export function drainSanitizationLog(): PlaceholderSanitizationRecord[] {
  return sanitizationLog.splice(0);
}

export function drainProvenanceLedger(): PipelineFallbackProvenance[] {
  return provenanceLedger.splice(0);
}

export function recordFallbackProvenance(p: PipelineFallbackProvenance): void {
  provenanceLedger.push(p);
}

/**
 * Returns provenance for a value produced by a canonical placeholder
 * constructor during this pipeline run, if any. Used by the final
 * quality gate to classify defect origin by construction-time
 * metadata rather than by string-shape heuristics.
 */
export function lookupPipelineFallbackProvenance(value: string): PipelineFallbackProvenance | null {
  if (!value) return null;
  return valueProvenanceIndex.get(value) ?? null;
}

export function resetPipelineFallbackProvenanceIndex(): void {
  valueProvenanceIndex.clear();
}

function indexValueProvenance(value: string, p: PipelineFallbackProvenance): void {
  if (!valueProvenanceIndex.has(value)) {
    valueProvenanceIndex.set(value, p);
  }
}

/**
 * Canonical safe placeholder vocabulary. These are the ONLY forms the
 * deterministic pipeline is allowed to emit as placeholders into XAML/VB
 * contexts. All three are XML-attribute-safe, XML-text-node-safe, and
 * VB-expression-safe by construction.
 *
 *   TODO - {description}   : human-readable, for XML text nodes and attribute values
 *   TODO_{TOKEN}           : identifier-safe, for VB expression and identifier contexts
 *   PLACEHOLDER_{TOKEN}    : identifier-safe fallback marker
 *
 * No other placeholder forms may be emitted anywhere in deterministic pipeline
 * code. In particular, any form containing ':' (colon), unescaped '<', '>',
 * '&', '"' or other XML/VB-breaking characters is prohibited.
 */
const SAFE_DESCRIPTION_CHARS = /^[A-Za-z0-9 _\-().,/]+$/;
const SAFE_TOKEN_CHARS = /^[A-Za-z][A-Za-z0-9_]*$/;

function normalizeDescription(raw: string): string {
  let desc = (raw || "").replace(/[\r\n\t]+/g, " ").trim();
  desc = desc.replace(/:/g, " -");
  desc = desc.replace(/[<>"&]/g, "");
  desc = desc.replace(/\s+/g, " ");
  if (!desc) desc = "fill in value";
  return desc;
}

function normalizeToken(raw: string): string {
  let tok = (raw || "").replace(/[^A-Za-z0-9_]/g, "_");
  tok = tok.replace(/^_+|_+$/g, "");
  if (!tok) tok = "Value";
  if (!/^[A-Za-z]/.test(tok)) tok = "T_" + tok;
  return tok;
}

/**
 * Build a canonical "TODO - {description}" placeholder for XML text/attribute contexts.
 * Never contains ':', unescaped XML specials, or VB-breaking characters.
 */
export function makeTodoTextPlaceholder(description: string, source: string = "unknown", reason: string = "missing value"): CanonicalPlaceholder {
  const desc = normalizeDescription(description);
  const value = `TODO - ${desc}`;
  const provenance: PipelineFallbackProvenance = {
    origin: "pipeline-fallback",
    kind: "placeholder-todo-text",
    source,
    reason,
    createdAt: Date.now(),
  };
  provenanceLedger.push(provenance);
  indexValueProvenance(value, provenance);
  return { value, provenance };
}

/**
 * Build a canonical "TODO_{TOKEN}" placeholder for VB expression / identifier contexts.
 * Always a valid VB identifier.
 */
export function makeTodoTokenPlaceholder(token: string, source: string = "unknown", reason: string = "missing identifier"): CanonicalPlaceholder {
  const tok = normalizeToken(token);
  const value = `TODO_${tok}`;
  const provenance: PipelineFallbackProvenance = {
    origin: "pipeline-fallback",
    kind: "placeholder-todo-token",
    source,
    reason,
    createdAt: Date.now(),
  };
  provenanceLedger.push(provenance);
  indexValueProvenance(value, provenance);
  return { value, provenance };
}

/**
 * Build a canonical "PLACEHOLDER_{TOKEN}" fallback marker for VB expression /
 * identifier contexts. Always a valid VB identifier.
 */
export function makePlaceholderTokenFallback(token: string, source: string = "unknown", reason: string = "fallback value"): CanonicalPlaceholder {
  const tok = normalizeToken(token);
  const value = `PLACEHOLDER_${tok}`;
  const provenance: PipelineFallbackProvenance = {
    origin: "pipeline-fallback",
    kind: "placeholder-fallback-token",
    source,
    reason,
    createdAt: Date.now(),
  };
  provenanceLedger.push(provenance);
  indexValueProvenance(value, provenance);
  return { value, provenance };
}

const CANONICAL_VOCABULARY_PATTERNS: RegExp[] = [
  /^TODO - [A-Za-z0-9 _\-().,/]+$/,
  /^TODO_[A-Za-z][A-Za-z0-9_]*$/,
  /^PLACEHOLDER_[A-Za-z][A-Za-z0-9_]*$/,
];

export function isCanonicalPlaceholder(text: string): boolean {
  return CANONICAL_VOCABULARY_PATTERNS.some(re => re.test(text));
}

let backstopFireCount = 0;

export function getDefectOriginBackstopFireCount(): number {
  return backstopFireCount;
}

export function resetDefectOriginBackstopFireCount(): void {
  backstopFireCount = 0;
}

/**
 * Task #528: classify a single defect's offending value as either
 * "pipeline-fallback" (safe canonical placeholder produced by the pipeline
 * itself) or "genuine" (a real structural defect).
 *
 * Primary classification: construction-time provenance from the
 * value->provenance index. Secondary backstop: canonical-vocabulary
 * shape match. The backstop fires only for placeholders produced
 * before the index was wired (transitional). Each backstop fire
 * increments a counter and emits a console.warn so missed
 * construction-site coverage shows up in CI.
 */
export function classifyDefectOrigin(rawValue: string | undefined | null, contextLabel: string = "unknown"): {
  origin: "pipeline-fallback" | "genuine";
  originReason: string;
} {
  const raw = (rawValue || "").trim();
  if (!raw) return { origin: "genuine", originReason: "no offending value" };
  const inner = raw.replace(/^[\[\s"]+|[\]\s"]+$/g, "").trim();
  const constructed = lookupPipelineFallbackProvenance(inner) || lookupPipelineFallbackProvenance(raw);
  if (constructed) {
    return {
      origin: constructed.origin,
      originReason: `construction-time provenance from ${constructed.source} (${constructed.reason})`,
    };
  }
  if (isCanonicalPlaceholder(inner) || isCanonicalPlaceholder(raw)) {
    backstopFireCount++;
    console.warn(`[Origin Backstop Fired] ${contextLabel}: canonical-vocabulary shape match without construction-time provenance entry: "${inner}"`);
    return {
      origin: "pipeline-fallback",
      originReason: "canonical-vocabulary shape match (transitional fallback; no construction-time provenance entry)",
    };
  }
  return { origin: "genuine", originReason: "not a pipeline-fallback canonical placeholder" };
}

/**
 * Returns a safe canonical form of a possibly-unsafe placeholder token.
 * Used by the build-time assertion sweep to convert any non-canonical
 * placeholder residue to a canonical safe form.
 */
export function coerceToCanonicalPlaceholder(raw: string, source: string = "unknown"): string {
  if (!raw) return makeTodoTextPlaceholder("fill in value", source, "empty placeholder").value;
  if (isCanonicalPlaceholder(raw)) return raw;

  const colonStripped = raw.replace(/\bTODO\s*:\s*/gi, "");
  const trimmed = colonStripped.replace(/^[\[\s]+|[\]\s]+$/g, "").trim();

  if (SAFE_TOKEN_CHARS.test(trimmed)) {
    return makeTodoTokenPlaceholder(trimmed, source, "coerced token").value;
  }
  return makeTodoTextPlaceholder(trimmed || "fill in value", source, "coerced description").value;
}

function stripUnsafeColons(text: string): string {
  let result = text.replace(/\bTODO\s*:/g, "TODO -");
  if (/^[A-Za-z_]\w*:/.test(result)) {
    result = result.replace(/:/, " -");
  }
  return result;
}

function hasBareAmpersand(text: string): boolean {
  return /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(text);
}

function hasBareAngleBracket(text: string): boolean {
  return /</.test(text) || />/.test(text);
}

export function sanitizePlaceholder(
  raw: string,
  context: PlaceholderContext,
  source: string = "unknown",
): string {
  if (!raw || typeof raw !== "string") return raw;

  const alreadySanitized = raw.includes("TODO -") && !raw.includes("TODO:");
  if (alreadySanitized && !hasBareAmpersand(raw) && !hasBareAngleBracket(raw)) {
    return raw;
  }

  let result = raw;
  const original = raw;

  result = stripUnsafeColons(result);

  switch (context) {
    case "xml-attribute": {
      result = result.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
      result = result.replace(/</g, "&lt;");
      result = result.replace(/>/g, "&gt;");
      result = result.replace(/"/g, "&quot;");
      break;
    }
    case "xml-text-node": {
      result = result.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
      result = result.replace(/</g, "&lt;");
      result = result.replace(/>/g, "&gt;");
      break;
    }
    case "vb-expression": {
      result = result.replace(/"/g, '""');
      result = result.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
      result = result.replace(/</g, "&lt;");
      result = result.replace(/>/g, "&gt;");
      break;
    }
  }

  if (result !== original) {
    sanitizationLog.push({
      originalToken: original,
      contextType: context,
      replacement: result,
      source,
    });
  }

  return result;
}

export function sanitizePlaceholderForAttribute(raw: string, source: string = "unknown"): string {
  return sanitizePlaceholder(raw, "xml-attribute", source);
}

export function sanitizePlaceholderForTextNode(raw: string, source: string = "unknown"): string {
  return sanitizePlaceholder(raw, "xml-text-node", source);
}

export function sanitizePlaceholderForVbExpression(raw: string, source: string = "unknown"): string {
  return sanitizePlaceholder(raw, "vb-expression", source);
}

export function containsUnsafePlaceholder(text: string): boolean {
  return /TODO\s*:/.test(text) || hasBareAmpersand(text);
}

export function sweepUnsafePlaceholders(
  content: string,
  fileName: string,
): { content: string; fixes: PlaceholderSanitizationRecord[] } {
  const fixes: PlaceholderSanitizationRecord[] = [];

  if (!containsUnsafePlaceholder(content)) {
    return { content, fixes };
  }

  let result = content;

  result = result.replace(/(\w+)="([^"]*TODO\s*:[^"]*)"/g, (fullMatch, attrName, attrValue) => {
    const sanitized = sanitizePlaceholderForAttribute(attrValue, `${fileName}:attr:${attrName}`);
    if (sanitized !== attrValue) {
      fixes.push({
        originalToken: attrValue,
        contextType: "xml-attribute",
        replacement: sanitized,
        source: `${fileName}:attr:${attrName}`,
      });
      return `${attrName}="${sanitized}"`;
    }
    return fullMatch;
  });

  result = result.replace(/>([^<]*TODO\s*:[^<]*)</g, (fullMatch, textContent) => {
    const sanitized = sanitizePlaceholderForTextNode(textContent, `${fileName}:text-node`);
    if (sanitized !== textContent) {
      fixes.push({
        originalToken: textContent,
        contextType: "xml-text-node",
        replacement: sanitized,
        source: `${fileName}:text-node`,
      });
      return `>${sanitized}<`;
    }
    return fullMatch;
  });

  result = result.replace(/(\w+)="([^"]*&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)[^"]*)"/g, (fullMatch, attrName, attrValue) => {
    const sanitized = sanitizePlaceholderForAttribute(attrValue, `${fileName}:attr-amp:${attrName}`);
    if (sanitized !== attrValue) {
      fixes.push({
        originalToken: attrValue,
        contextType: "xml-attribute",
        replacement: sanitized,
        source: `${fileName}:attr-amp:${attrName}`,
      });
      return `${attrName}="${sanitized}"`;
    }
    return fullMatch;
  });

  result = result.replace(/>([^<]*&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)[^<]*)</g, (fullMatch, textContent) => {
    const sanitized = sanitizePlaceholderForTextNode(textContent, `${fileName}:text-amp`);
    if (sanitized !== textContent) {
      fixes.push({
        originalToken: textContent,
        contextType: "xml-text-node",
        replacement: sanitized,
        source: `${fileName}:text-amp`,
      });
      return `>${sanitized}<`;
    }
    return fullMatch;
  });

  return { content: result, fixes };
}

/**
 * Build-time assertion guard. Scans XAML for placeholder-like tokens that are
 * NOT in the canonical closed vocabulary and coerces each to a safe canonical
 * form. Returns a list of repairs for diagnostics.
 *
 * Intentionally conservative: only matches tokens that look like placeholders
 * (contain TODO or PLACEHOLDER prefixes, or bracketed TODO forms), to avoid
 * touching real business content.
 */
export function assertCanonicalPlaceholdersInXaml(
  content: string,
  fileName: string,
): { content: string; repairs: Array<{ original: string; replacement: string; context: PlaceholderContext }> } {
  const repairs: Array<{ original: string; replacement: string; context: PlaceholderContext }> = [];
  let result = content;

  result = result.replace(/(\w+)="(\[?)((?:TODO\b[^"]*|PLACEHOLDER[^"]*?))(\]?)"/g, (full, attrName, openBracket, raw, closeBracket) => {
    // If inner value is already canonical, or the bracketed form wraps a
    // canonical value, leave it alone. We intentionally preserve bracket
    // wrappers so we do not alter VB-expression semantics in attribute
    // contexts (a bracketed attribute value is parsed as a VB expression
    // rather than a literal).
    if (isCanonicalPlaceholder(raw)) return full;
    const coerced = coerceToCanonicalPlaceholder(raw, `${fileName}:attr:${attrName}`);
    if (coerced !== raw) {
      repairs.push({ original: raw, replacement: coerced, context: "xml-attribute" });
      return `${attrName}="${openBracket}${coerced}${closeBracket}"`;
    }
    return full;
  });

  return { content: result, repairs };
}
