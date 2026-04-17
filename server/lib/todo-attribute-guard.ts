import type { DiagnosticSource } from "./stub-cause";
import { makeTodoTextPlaceholder } from "./placeholder-sanitizer";

/**
 * Task #529: position-aware guard against TODO tokens in attribute-name,
 * element-name, and namespace-prefix positions. Two surfaces share this
 * module: emitter-time `sanitizeAttributeNameKey` (typed assembler) and
 * pre-compliance `repairTodoAttributeNamesInXaml` (buffer scan).
 */

/** Thrown for unrecoverable element-name / namespace-prefix TODO violations. */
export class TodoAttributeGuardHardFailError extends Error {
  readonly code = "TODO_ATTR_GUARD_HARD_FAIL";
  constructor(public readonly diagnostic: TodoAttributeGuardDiagnostic) {
    super(`[todo-attribute-guard] hard-fail: ${diagnostic.reason}`);
  }
}

export type TodoAttributeContextType =
  | "attribute-name"
  | "element-name"
  | "namespace-prefix"
  | "attribute-value"
  | "text-node";

export type TodoAttributeReplacementPath =
  | "canonical-conversion"
  | "activity-handoff"
  | "attribute-omission"
  | "hard-fail";

export interface TodoAttributeGuardDiagnostic {
  /** Source emitter or guard surface that recorded this entry. */
  source: DiagnosticSource;
  /** XAML file the diagnostic applies to (basename or full archive path). */
  file: string;
  /** Caller helper or template name that emitted the offending token, if known. */
  emitter: string;
  /** Position type within the XAML buffer where the offending token was seen. */
  contextType: TodoAttributeContextType;
  /** Original offending token form, e.g., `"TODO:"` or `"TODO: bind X"`. */
  originalToken: string;
  /** Replacement chosen, or `null` for hard fail. */
  replacement: string | null;
  /** What the guard did. */
  replacementPath: TodoAttributeReplacementPath;
  /** Human-readable reason for diagnostics consumers. */
  reason: string;
  /** Workflow name (filename without `.xaml`), if known. */
  workflow?: string;
  /** Line number in XAML, when available. */
  line?: number;
  /** Activity template name (e.g., "Click", "TypeInto"), when known. */
  activity?: string;
  /**
   * True iff the omitted attribute corresponds to a *required* activity
   * contract property. The contract checker (catalog-service) is consulted
   * by the call site; when this is true, the activity must be degraded to a
   * localized handoff (Comment + LogMessage) rather than silently shipped.
   */
  requiredFieldOmitted?: boolean;
}

const diagnosticsLedger: TodoAttributeGuardDiagnostic[] = [];
// Per-run accumulator of entries already consumed by `compliancePass` (via
// per-file drain). These remain visible to `runFinalArtifactValidation` so
// the run-artifact `final_quality_report.diagnostics` channel achieves 1:1
// parity with DHG `quality_issues`. Cleared by the same drain operations
// that read it, ensuring no double-counting across runs.
const consumedDiagnosticsLedger: TodoAttributeGuardDiagnostic[] = [];

export function pushTodoAttributeGuardDiagnostic(diag: TodoAttributeGuardDiagnostic): void {
  diagnosticsLedger.push(diag);
}

/**
 * Full-drain helper used by `runFinalArtifactValidation` to populate
 * `final_quality_report.diagnostics`. Returns the union of:
 *   1. live ledger entries (events not yet consumed by compliancePass)
 *   2. consumed ledger entries (events already drained per-file by
 *      compliancePass for DHG/buffer evidence — re-surfaced here so the
 *      diagnostics channel sees them too).
 * Both backing arrays are cleared atomically.
 */
export function drainTodoAttributeGuardDiagnostics(): TodoAttributeGuardDiagnostic[] {
  const live = diagnosticsLedger.splice(0);
  const consumed = consumedDiagnosticsLedger.splice(0);
  return [...consumed, ...live];
}

export function peekTodoAttributeGuardDiagnostics(): readonly TodoAttributeGuardDiagnostic[] {
  return [...consumedDiagnosticsLedger, ...diagnosticsLedger];
}

export function resetTodoAttributeGuardDiagnostics(): void {
  diagnosticsLedger.length = 0;
  consumedDiagnosticsLedger.length = 0;
}

/**
 * Drain only the ledger entries scoped to a particular file/workflow.
 * Used by `compliancePass` to dual-sink emitter-time events (originating
 * in the typed assembler before XAML existed) into the run-artifact DHG
 * and into the buffer itself. Returns the matching entries and moves them
 * to the consumed ledger so they remain visible to the eventual full-drain
 * by `runFinalArtifactValidation`.
 */
export function drainTodoAttributeGuardDiagnosticsForFile(file: string): TodoAttributeGuardDiagnostic[] {
  const matched: TodoAttributeGuardDiagnostic[] = [];
  for (let i = diagnosticsLedger.length - 1; i >= 0; i--) {
    const d = diagnosticsLedger[i];
    if (d.file === file || (d.workflow && file.endsWith(`${d.workflow}.xaml`))) {
      matched.unshift(d);
      diagnosticsLedger.splice(i, 1);
    }
  }
  // Preserve in consumed ledger so FinalQualityReport.diagnostics sees it.
  for (const d of matched) consumedDiagnosticsLedger.push(d);
  return matched;
}

/**
 * Build a top-of-file XML comment block carrying emitter-time
 * `requiredFieldOmitted` evidence. Inserted into the XAML buffer at the
 * start of compliancePass so the artifact itself shows the localized
 * degradation even when the offending attribute was dropped before any
 * XAML existed (typed-assembler path).
 */
export function buildEmitterTimeHandoffCommentBlock(diagnostics: readonly TodoAttributeGuardDiagnostic[]): string {
  const requiredOnly = diagnostics.filter(d => d.requiredFieldOmitted);
  if (requiredOnly.length === 0) return "";
  const safe = (s: string) => String(s).replace(/--/g, "—").replace(/[<>&"']/g, "");
  const lines = requiredOnly.map(d =>
    `<!-- TODO-attribute-guard (emitter-time): ${safe(d.emitter)} dropped required attribute "${safe(d.originalToken)}" on activity "${safe(d.activity ?? "?")}"; operator handoff required — see DHG quality_issues check=todo-attribute-guard. -->`
  );
  return lines.join("\n") + "\n";
}

/**
 * Convert TODO-attribute guard diagnostics into DHG-shaped quality issues
 * (matches `DhgQualityIssue` from `xaml-generator.ts`). The DHG channel is
 * separate from `final_quality_report.diagnostics`: DHG is per-workflow
 * human-readable evidence the user sees in the Defect Honesty Gate, while
 * the diagnostics array is the machine-readable stream consumers filter.
 *
 * Both sinks must report the same events (per Task #529 review feedback)
 * — this helper is the single point that translates guard ledger entries
 * into the DHG shape so they cannot drift apart.
 *
 * Returns lightweight structurally-typed records to avoid a circular
 * import on `xaml-generator.ts` (which imports from `lib/`).
 */
export interface GuardDhgIssue {
  severity: "blocking" | "warning";
  file: string;
  check: string;
  detail: string;
  stubCause?: "todo-attribute";
  stubbedWorkflow?: string;
}
export function toDhgIssuesFromGuardDiagnostics(
  diagnostics: readonly TodoAttributeGuardDiagnostic[],
): GuardDhgIssue[] {
  return diagnostics.map((d) => {
    const requiredSuffix = d.requiredFieldOmitted ? " (REQUIRED contract field omitted — activity contract violation)" : "";
    const replacementSuffix = d.replacement ? ` value-captured="${d.replacement}"` : "";
    return {
      severity: d.requiredFieldOmitted ? "blocking" : "warning",
      file: d.file,
      check: "todo-attribute-guard",
      detail:
        `[${d.contextType}] ${d.emitter} on <${d.activity ?? "?"}> ` +
        `dropped malformed token "${d.originalToken}"${requiredSuffix}.` +
        ` ${d.reason}${replacementSuffix}`,
      stubCause: "todo-attribute",
    };
  });
}

/** Valid XML NCName start char (subset; ASCII-pragmatic). */
const NCNAME_START = /^[A-Za-z_]/;
const NCNAME_CHARS = /^[A-Za-z_][A-Za-z0-9_.\-]*$/;

/** A QName like `prefix:Local` is permitted, but the prefix and local must each be valid. */
const QNAME_PATTERN = /^([A-Za-z_][A-Za-z0-9_.\-]*:)?[A-Za-z_][A-Za-z0-9_.\-]*$/;

const TODO_PREFIX_RE = /^TODO[\s:_\-]?/i;

/**
 * Returns true when `name` is a structurally valid XML attribute or element
 * name (NCName or QName). False positives are acceptable; this is a guard,
 * not a parser.
 */
export function isValidXmlName(name: string): boolean {
  if (!name) return false;
  if (!NCNAME_START.test(name)) return false;
  return QNAME_PATTERN.test(name);
}

/**
 * Returns true if `name` looks like a TODO-prefixed token that must NEVER
 * appear in an attribute-name / element-name / namespace-prefix position.
 * The check is intentionally broad (case-insensitive, tolerant of trailing
 * punctuation) so legacy emitters that produce `TODO:`, `TODO_x`, `TODO -`,
 * or `TODO ` are all caught.
 */
export function looksLikeTodoMarker(name: string): boolean {
  if (!name) return false;
  return TODO_PREFIX_RE.test(name.trim());
}

export interface AttributeKeySanitizationResult {
  /**
   * Safe attribute name to emit. When `omitted` is true this is undefined and
   * the caller MUST drop the attribute entirely (smallest-scope local
   * degradation; the diagnostic carries the dropped value for DHG honesty).
   */
  safeKey?: string;
  /** True iff the original key was unsafe and the attribute was omitted. */
  omitted: boolean;
  /** Original offending key, if a repair occurred. */
  originalKey?: string;
  /** Diagnostic that was recorded, if any. */
  diagnostic?: TodoAttributeGuardDiagnostic;
}

/**
 * Emitter-side sanitizer for property keys before they become XAML attribute
 * names. If the key is structurally a valid XML name AND not a TODO marker,
 * it is returned unchanged. Otherwise the attribute is omitted and a
 * structured diagnostic is recorded; the original raw value is folded into
 * the diagnostic's `originalToken` so the DHG can honestly report what was
 * dropped.
 *
 * Per the task contract: silent omission of a *required contract field* is
 * forbidden. This guard does not know the activity contract — its job is
 * only to prevent the malformed-XML emission. The downstream
 * `required-property-enforcer` is responsible for surfacing missing required
 * properties as defects so DHG honesty is preserved.
 */
export function sanitizeAttributeNameKey(
  rawKey: string,
  ctx: {
    file: string;
    emitter: string;
    rawValue?: unknown;
    workflow?: string;
    activity?: string;
    /**
     * Optional contract probe — should return `true` iff the (rawKey on
     * the activity contract) is a required property. When the guard finds
     * that a required field was just dropped, it tags the diagnostic with
     * `requiredFieldOmitted: true` and chooses `activity-handoff` so the
     * call site can degrade the activity to a localized Comment+LogMessage
     * handoff rather than silently shipping a contract-broken activity.
     */
    isRequiredProperty?: (activity: string | undefined, propertyName: string) => boolean;
  },
): AttributeKeySanitizationResult {
  if (rawKey && isValidXmlName(rawKey) && !looksLikeTodoMarker(rawKey)) {
    return { safeKey: rawKey, omitted: false };
  }

  const valuePreview =
    typeof ctx.rawValue === "string"
      ? ctx.rawValue.slice(0, 200)
      : ctx.rawValue !== undefined
        ? JSON.stringify(ctx.rawValue).slice(0, 200)
        : "";

  const originalToken = rawKey + (valuePreview ? `=${valuePreview}` : "");
  // Contract-aware gating (Task #529 review feedback v2): a TODO marker in
  // attribute-name position IS, by construction, the explicit signal from
  // the upstream emitter that a required binding was left unfulfilled — the
  // emitter would not have written `TODO:` if the property were optional and
  // safely omittable. We therefore treat *every* TODO-marker drop as a
  // potential required-field omission (`requiredFieldOmitted: true`) and
  // route it to the activity-handoff degradation path, ensuring the
  // contract violation is surfaced to DHG rather than silently shipped.
  //
  // For non-TODO invalid names (rare; e.g., key with whitespace), we use
  // the optional `isRequiredProperty` contract probe when available; it
  // returns false unless the property name happens to match a known
  // required contract field on the activity schema.
  const todoMarker = looksLikeTodoMarker(rawKey);
  const probeSaysRequired = !!(ctx.isRequiredProperty && ctx.activity && ctx.isRequiredProperty(ctx.activity, rawKey));
  const isRequired = todoMarker || probeSaysRequired;

  const diagnostic: TodoAttributeGuardDiagnostic = {
    source: "todo-attribute-guard",
    file: ctx.file,
    emitter: ctx.emitter,
    contextType: "attribute-name",
    originalToken,
    replacement: null,
    replacementPath: isRequired ? "activity-handoff" : "attribute-omission",
    reason: looksLikeTodoMarker(rawKey)
      ? `Attribute name "${rawKey}" is a TODO marker — forbidden in attribute-name position; ${isRequired ? "REQUIRED contract field — activity will be degraded to localized handoff (Comment + LogMessage) so the contract violation is surfaced to DHG rather than silently shipped." : "attribute omitted at smallest scope."}`
      : `Attribute name "${rawKey}" is not a valid XML NCName/QName; ${isRequired ? "REQUIRED contract field — activity will be degraded to localized handoff." : "attribute omitted at smallest scope."}`,
    workflow: ctx.workflow,
    activity: ctx.activity,
    requiredFieldOmitted: isRequired || undefined,
  };
  pushTodoAttributeGuardDiagnostic(diagnostic);
  return { omitted: true, originalKey: rawKey, diagnostic };
}

/**
 * Find the 1-based line number for a character offset in `content`.
 */
function lineForOffset(content: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

/**
 * Pre-compliance scan: locate any TODO-prefixed token sitting in an XML
 * attribute-name position inside `content` and surgically remove the
 * offending attribute. The element and all sibling attributes are preserved
 * (smallest-scope local degradation); a structured diagnostic is recorded
 * for each repair. Whole-workflow stubbing is NOT performed here.
 *
 * Detection target: a token of the form `TODO[:_-\s]?…` immediately
 * followed (after optional whitespace) by `=` and a quoted attribute value,
 * inside an open-tag `<…>` boundary. Element-name and namespace-prefix
 * positions are also checked separately.
 *
 * Attribute-VALUE / text-node positions that legitimately contain TODO text
 * are NOT touched.
 */
export function repairTodoAttributeNamesInXaml(
  content: string,
  ctx: { file: string; emitter?: string; workflow?: string },
): { content: string; repairs: TodoAttributeGuardDiagnostic[] } {
  const repairs: TodoAttributeGuardDiagnostic[] = [];
  if (!content) return { content, repairs };
  if (!/TODO/i.test(content)) return { content, repairs };

  const emitter = ctx.emitter || "pre-compliance-scan";

  // Walk every open tag `<...>` (including self-closing), inspect attributes.
  const result = content.replace(/<([A-Za-z_][\w.\-:]*)([^<>]*)(\/?)>/g, (match, tagName: string, attrsBlock: string, selfClose: string, offset: number) => {
    const line = lineForOffset(content, offset);

    // 1. Element-name TODO violation: unrecoverable at the buffer layer.
    if (looksLikeTodoMarker(tagName) || !isValidXmlName(tagName)) {
      const diag: TodoAttributeGuardDiagnostic = {
        source: "todo-attribute-guard",
        file: ctx.file,
        emitter,
        contextType: "element-name",
        originalToken: tagName,
        replacement: null,
        replacementPath: "hard-fail",
        reason: `Element name "${tagName}" is invalid or a TODO marker — buffer-layer repair is unsafe; emission rejected.`,
        workflow: ctx.workflow,
        line,
      };
      pushTodoAttributeGuardDiagnostic(diag);
      repairs.push(diag);
      throw new TodoAttributeGuardHardFailError(diag);
    }

    // 2. Walk attributes inside the open tag. We only act on attribute *names*.
    if (!attrsBlock || !/TODO/i.test(attrsBlock)) return match;

    let repairedAttrs = "";
    let i = 0;
    let mutated = false;
    while (i < attrsBlock.length) {
      const ch = attrsBlock[i];
      if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
        repairedAttrs += ch;
        i++;
        continue;
      }
      // Match `name="value"` or `name='value'`. Name may be QName-shaped.
      const nameMatch = /^([^\s"'=<>\/]+)\s*=\s*(["'])/.exec(attrsBlock.slice(i));
      if (!nameMatch) {
        // Could be a stray fragment; copy one char to avoid an infinite loop.
        repairedAttrs += ch;
        i++;
        continue;
      }
      const attrName = nameMatch[1];
      const quote = nameMatch[2];
      const headLen = nameMatch[0].length;
      // Find the matching closing quote.
      const valueStart = i + headLen;
      const valueEnd = attrsBlock.indexOf(quote, valueStart);
      if (valueEnd < 0) {
        repairedAttrs += attrsBlock.slice(i);
        i = attrsBlock.length;
        break;
      }
      const attrValue = attrsBlock.slice(valueStart, valueEnd);
      const fullAttr = attrsBlock.slice(i, valueEnd + 1);

      const attrIsTodoMarker = looksLikeTodoMarker(attrName);
      const attrIsValidName = isValidXmlName(attrName);
      const isNamespacePrefixDecl = /^xmlns(?::|$)/.test(attrName);
      const prefixPart = attrName.includes(":") ? attrName.split(":", 1)[0] : "";
      const prefixIsTodoMarker = !!prefixPart && looksLikeTodoMarker(prefixPart);

      if (isNamespacePrefixDecl && /TODO/i.test(attrName.split(":")[1] || "")) {
        // Namespace prefix declaration whose local part is a TODO marker.
        const diag: TodoAttributeGuardDiagnostic = {
          source: "todo-attribute-guard",
          file: ctx.file,
          emitter,
          contextType: "namespace-prefix",
          originalToken: `${attrName}=${quote}${attrValue}${quote}`,
          replacement: "",
          replacementPath: "attribute-omission",
          reason: `Namespace prefix declaration "${attrName}" contains a TODO token in the prefix position; declaration omitted to keep XAML well-formed.`,
          workflow: ctx.workflow,
          line,
        };
        pushTodoAttributeGuardDiagnostic(diag);
        repairs.push(diag);
        mutated = true;
        i = valueEnd + 1;
        continue;
      }

      if (attrIsTodoMarker || prefixIsTodoMarker || !attrIsValidName) {
        // Always omit the malformed attribute from the open tag (only safe
        // XML edit at this layer). The diagnostic carries the original
        // value verbatim so DHG can honestly report what was dropped, and
        // the replacementPath always reflects what we actually did to the
        // XML buffer (no drift). When the dropped key is a TODO marker we
        // ALSO treat the omission as a required-field violation (the
        // upstream emitter would not have written `TODO:` for an optional
        // field) and inject a sibling `<!-- … -->` comment immediately
        // before the affected open tag so the localized degradation is
        // visible in the artifact (no silent omission).
        const canonicalValue = attrValue && /[A-Za-z]/.test(attrValue)
          ? makeTodoTextPlaceholder(attrValue, `todo-attribute-guard:${ctx.file}`, "attribute name was a TODO marker — value preserved in diagnostic for DHG honesty").value
          : null;
        const isRequiredOmission = attrIsTodoMarker || prefixIsTodoMarker;
        const diag: TodoAttributeGuardDiagnostic = {
          source: "todo-attribute-guard",
          file: ctx.file,
          emitter,
          contextType: prefixIsTodoMarker ? "namespace-prefix" : "attribute-name",
          originalToken: `${attrName}=${quote}${attrValue}${quote}`,
          replacement: canonicalValue,
          replacementPath: isRequiredOmission ? "activity-handoff" : "attribute-omission",
          reason: (attrIsTodoMarker || prefixIsTodoMarker
            ? `Attribute name "${attrName}" carries a TODO marker in name/prefix position on <${tagName}> — forbidden by XML well-formedness; attribute omitted (smallest scope) AND localized handoff comment injected before activity.`
            : `Attribute name "${attrName}" is not a valid XML NCName/QName on <${tagName}>; attribute omitted (smallest scope).`)
            + (canonicalValue ? ` Original value text captured as canonical placeholder "${canonicalValue}" in diagnostic for DHG honesty.` : ""),
          workflow: ctx.workflow,
          activity: tagName.includes(":") ? tagName.split(":")[1] : tagName,
          line,
          requiredFieldOmitted: isRequiredOmission || undefined,
        };
        pushTodoAttributeGuardDiagnostic(diag);
        repairs.push(diag);
        mutated = true;
        i = valueEnd + 1;
        continue;
      }

      repairedAttrs += fullAttr;
      i = valueEnd + 1;
    }

    if (!mutated) return match;
    const tidied = repairedAttrs.replace(/[ \t]+/g, " ").replace(/\s+$/g, "").replace(/^\s+/g, " ");
    // Build the localized Comment+LogMessage handoff for required-field
    // omissions. Each handoff is a sibling pair injected before the
    // (sanitized) activity element: an XML comment carrying the diagnostic
    // evidence and a real `<ui:LogMessage>` activity that surfaces the
    // contract violation at runtime. This is the contract-safe degradation
    // required by Task #529 — no required field is silently dropped.
    const safeText = (s: string) => String(s).replace(/--/g, "—").replace(/[<>&"']/g, "");
    const handoffParts = repairs
      .filter(d => d.line === line && d.replacementPath === "activity-handoff")
      .map(d => {
        const comment = `<!-- TODO-attribute-guard: dropped "${safeText(d.originalToken)}" on <${safeText(tagName)}>; required-field omission. -->`;
        const logMsg = `<ui:LogMessage Level="Warn" Message="[TODO-ATTR-GUARD] ${safeText(tagName)}: required field from token &quot;${safeText(d.originalToken)}&quot; was not bound; operator handoff required." />`;
        return comment + logMsg;
      })
      .join("");
    return `${handoffParts}<${tagName}${tidied}${selfClose ? "/" : ""}>`;
  });

  return { content: result, repairs };
}
