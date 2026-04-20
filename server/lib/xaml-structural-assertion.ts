/**
 * Task #539 (Step 1): Build-time XAML structural assertion.
 *
 * Runs against the assembled XAML for every workflow before `compliancePass`
 * to fail the assembler if either:
 *
 * (a) the XAML is parser-invalid in a way that suggests placeholder-bearing
 *     attribute serialization with unescaped quote characters (the structural
 *     form of the historical bug — independent of the literal `TODO` token), or
 *
 * (b) a TODO/PLACEHOLDER token appears in XML attribute-name, element-name,
 *     or namespace-prefix position (i.e., where it cannot be a value).
 *
 * The check is **context-aware**: properly XML-escaped placeholder text in
 * attribute-value or text-node content is intentionally ignored — that is
 * exactly what the canonical sanitizer produces and is the intended shape.
 *
 * Implementation uses `XMLValidator` and `XMLParser` from `fast-xml-parser`
 * (same dependency the existing compliance transform already uses) — no
 * second custom XML model is introduced.
 */
import { XMLValidator, XMLParser } from "fast-xml-parser";

export interface XamlStructuralViolation {
  kind:
    | "parser-invalid-placeholder-attribute"
    | "todo-token-in-attribute-name"
    | "todo-token-in-element-name"
    | "todo-token-in-namespace-prefix"
    | "invoke-workflow-file-dual-arguments";
  file: string;
  detail: string;
  position?: { line?: number; col?: number };
}

const TODO_TOKEN_NAME_RE = /^(?:[A-Za-z]+:)?TODO(?:[_\-][A-Za-z0-9]*)?$|^(?:[A-Za-z]+:)?PLACEHOLDER(?:_[A-Za-z0-9_]*)?$/;

function looksLikeTodoOrPlaceholderName(name: string): boolean {
  return TODO_TOKEN_NAME_RE.test(name);
}

/**
 * Recursively walk a parsed XML object (as produced by XMLParser with
 * `ignoreAttributes: false` and `attributeNamePrefix: "@_"`) and report
 * violations for TODO/PLACEHOLDER tokens that appear as element names,
 * attribute names, or namespace prefixes. Attribute *values* are
 * intentionally NOT inspected here — escaped placeholder text inside an
 * attribute value is the canonical, intended emission.
 */
function walkParsed(
  node: any,
  file: string,
  violations: XamlStructuralViolation[],
  parentTag: string = "",
): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walkParsed(child, file, violations, parentTag);
    return;
  }
  for (const key of Object.keys(node)) {
    const value = (node as any)[key];

    if (key.startsWith("@_")) {
      const attrName = key.slice(2);
      const colonIdx = attrName.indexOf(":");
      if (colonIdx > 0) {
        const prefix = attrName.slice(0, colonIdx);
        if (looksLikeTodoOrPlaceholderName(prefix)) {
          violations.push({
            kind: "todo-token-in-namespace-prefix",
            file,
            detail: `Namespace prefix "${prefix}" on attribute "${attrName}" appears to be a TODO/PLACEHOLDER token`,
          });
        }
      }
      if (looksLikeTodoOrPlaceholderName(attrName)) {
        violations.push({
          kind: "todo-token-in-attribute-name",
          file,
          detail: `Attribute name "${attrName}" on element <${parentTag}> appears to be a TODO/PLACEHOLDER token`,
        });
      }
      continue;
    }
    if (key === "#text") continue;

    // Element name. Also covers namespace-prefix detection on element side.
    const colonIdx = key.indexOf(":");
    if (colonIdx > 0) {
      const prefix = key.slice(0, colonIdx);
      if (looksLikeTodoOrPlaceholderName(prefix)) {
        violations.push({
          kind: "todo-token-in-namespace-prefix",
          file,
          detail: `Namespace prefix "${prefix}" on element <${key}> appears to be a TODO/PLACEHOLDER token`,
        });
      }
    }
    if (looksLikeTodoOrPlaceholderName(key)) {
      violations.push({
        kind: "todo-token-in-element-name",
        file,
        detail: `Element name <${key}> appears to be a TODO/PLACEHOLDER token`,
      });
    }

    // Pattern B (no-double-emission rule): InvokeWorkflowFile must not carry
    // both attribute-form `Arguments=` and the typed
    // `<InvokeWorkflowFile.Arguments>` child-element block simultaneously.
    if (/(?:^|:)InvokeWorkflowFile$/.test(key)) {
      const subnodes = Array.isArray(value) ? value : [value];
      for (const sn of subnodes) {
        if (sn === null || typeof sn !== "object") continue;
        const hasAttrArgs = "@_Arguments" in sn;
        const hasChildArgs = Object.keys(sn).some(k => /(?:^|:)InvokeWorkflowFile\.Arguments$/.test(k));
        if (hasAttrArgs && hasChildArgs) {
          violations.push({
            kind: "invoke-workflow-file-dual-arguments",
            file,
            detail: `InvokeWorkflowFile carries both attribute-form Arguments="..." and the typed <InvokeWorkflowFile.Arguments> child block — Pattern B no-double-emission rule violated`,
          });
        }
      }
    }

    walkParsed(value, file, violations, key);
  }
}

/**
 * Heuristic that tells the difference between "the parser failed because of
 * generic malformed XML" and "the parser failed because a placeholder-bearing
 * value was interpolated into attribute syntax without escaping the quote
 * characters". Used only to attribute the (a) class of violation; the
 * underlying XML validity check is what actually fails the assembler.
 */
function looksLikePlaceholderAttributeBreakage(errMessage: string): boolean {
  if (!errMessage) return false;
  if (/Attribute\s+'TODO/i.test(errMessage)) return true;
  if (/Attribute\s+'PLACEHOLDER/i.test(errMessage)) return true;
  // Raw `"]` tail in the parser's "invalid attribute" context strongly
  // implies a `["TODO - ..."]` token closed an attribute prematurely.
  if (/InvalidAttr/i.test(errMessage) && /\]/.test(errMessage)) return true;
  return false;
}

export interface XamlStructuralAssertionResult {
  ok: boolean;
  violations: XamlStructuralViolation[];
  parserError?: string;
}

export function assertXamlStructuralIntegrity(
  xamlContent: string,
  file: string,
): XamlStructuralAssertionResult {
  const violations: XamlStructuralViolation[] = [];

  let parserError: string | undefined;
  const validation = XMLValidator.validate(xamlContent, { allowBooleanAttributes: true });
  if (validation !== true) {
    const message = (validation as { err?: { msg?: string } })?.err?.msg || "XAML XML well-formedness validation failed";
    parserError = message;
    if (looksLikePlaceholderAttributeBreakage(message)) {
      violations.push({
        kind: "parser-invalid-placeholder-attribute",
        file,
        detail: `Parser-invalid XAML attributable to placeholder-bearing attribute serialization: ${message}`,
      });
    }
  } else {
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        allowBooleanAttributes: true,
        preserveOrder: false,
      });
      const parsed = parser.parse(xamlContent);
      walkParsed(parsed, file, violations);
    } catch (e: any) {
      parserError = e?.message || String(e);
    }
  }

  return { ok: violations.length === 0, violations, parserError };
}
