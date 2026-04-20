import { escapeXml, escapeXmlTextContent } from "../lib/xml-utils";
import { classifyDefectOrigin } from "../lib/placeholder-sanitizer";
import { tryParseJsonValueIntent, buildExpression } from "./expression-builder";
import { extractDeclaredVariables, findUndeclaredVariables } from "./vbnet-expression-linter";

export interface ExpressionCanonicalizationFix {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  originalValue: string;
  canonicalizedValue: string;
  canonicalizationType: "json_child_element_normalize" | "json_target_normalize" | "json_value_normalize";
  rationale: string;
}

export interface SymbolScopeDefect {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  referencedSymbol: string;
  offendingExpression: string;
  replacementType: "degradation_substitute";
  safeReplacementValue: string;
  originalDefectClass: "undeclared_variable_reference" | "undeclared_argument_reference";
  severity: "execution_blocking" | "handoff_required";
  rationale: string;
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export interface SentinelReplacementRecord {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  originalValue: string;
  replacementType: "degradation_substitute";
  safeReplacementValue: string;
  originalDefectClass: "placeholder_sentinel" | "todo_sentinel" | "handoff_sentinel" | "stub_sentinel";
  severity: "execution_blocking" | "handoff_required";
  rationale: string;
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export interface UnresolvableJsonDefect {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  originalValue: string;
  replacementType: "degradation_substitute";
  safeReplacementValue: string;
  originalDefectClass: "unresolvable_json_payload";
  severity: "execution_blocking";
  rationale: string;
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export interface TargetValueCanonicalizationResult {
  expressionCanonicalizationFixes: ExpressionCanonicalizationFix[];
  symbolScopeDefects: SymbolScopeDefect[];
  sentinelReplacements: SentinelReplacementRecord[];
  unresolvableJsonDefects: UnresolvableJsonDefect[];
  summary: string;
}

export interface InvokeSerializationFix {
  originalForm: string;
  canonicalizedForm: string;
  normalizationType: InvokeNormalizationType;
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  rationale: string;
}

export type InvokeNormalizationType =
  | "pseudo_property_removal"
  | "attr_to_argument_block"
  | "dual_serialization_dedup"
  | "json_expression_normalize"
  | "argument_blob_canonicalize";

export interface ResidualExpressionSerializationDefect {
  file: string;
  workflow: string;
  activityType: string;
  propertyName: string;
  originalValue: string;
  defectType: ResidualExpressionDefectType;
  severity: "execution_blocking" | "handoff_required";
  rationale: string;
  origin?: "pipeline-fallback" | "genuine";
  originReason?: string;
}

export type ResidualExpressionDefectType =
  | "json_expression_leak"
  | "mixed_literal_expression"
  | "placeholder_in_executable"
  | "unresolvable_invoke_conflict"
  | "invalid_invoke_serialization";

export interface InvokeCanonicalizationResult {
  invokeSerializationFixes: InvokeSerializationFix[];
  residualExpressionSerializationDefects: ResidualExpressionSerializationDefect[];
  totalCanonicalizations: number;
  totalResidualDefects: number;
}

const INVOKE_ACTIVITY_TYPES = [
  "InvokeWorkflowFile",
  "InvokeWorkflow",
  "InvokeWorkflowInteractive",
];

const INVOKE_SYSTEM_ATTRS = new Set([
  "workflowfilename", "workflowfilepath", "filename",
  "displayname", "continueonerror", "timeout", "isolated",
  "targetfolder", "logmessage", "timeoutms", "inuielement",
]);

const PSEUDO_PROPERTY_NAMES = new Set([
  "Then", "Else", "Body", "Cases", "Finally", "Try", "Catches",
]);

const XMLNS_ATTR_PREFIXES = ["xmlns", "sap", "sap2010", "x:", "mc:"];

const JSON_EXPRESSION_PATTERN = /(?:\{&quot;|\{")(?:type|value|name)(?:&quot;|")\s*:/;

const PLACEHOLDER_PATTERN = /\bPLACEHOLDER\b|\bPLACEHOLDER_\w+/i;

function deriveWorkflowName(fileName: string): string {
  const base = fileName.split("/").pop() || fileName;
  return base.replace(/\.xaml$/i, "");
}

function normalizeFilePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^[./]+/, "");
}

function isSystemOrMetaAttr(attrName: string): boolean {
  if (INVOKE_SYSTEM_ATTRS.has(attrName.toLowerCase())) return true;
  for (const prefix of XMLNS_ATTR_PREFIXES) {
    if (attrName.startsWith(prefix)) return true;
  }
  return false;
}

function tryNormalizeJsonExpression(value: string): { normalized: string; wasJson: boolean } {
  const decoded = value.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const parsed = tryParseJsonValueIntent(decoded);
  if (parsed) {
    try {
      const built = buildExpression(parsed.intent);
      return { normalized: built, wasJson: true };
    } catch {
      return { normalized: value, wasJson: false };
    }
  }
  return { normalized: value, wasJson: false };
}

function inferDirection(name: string): "InArgument" | "OutArgument" | "InOutArgument" {
  if (/^out_/i.test(name)) return "OutArgument";
  if (/^io_/i.test(name)) return "InOutArgument";
  return "InArgument";
}

function buildCanonicalArgElement(key: string, value: string, direction?: "InArgument" | "OutArgument" | "InOutArgument"): string {
  const dir = direction || inferDirection(key);
  let val = value.trim();
  if (!val.startsWith("[") && !val.startsWith('"') && !/^(True|False|Nothing|\d+)$/i.test(val)) {
    val = `[${val}]`;
  }
  return `                <${dir} x:TypeArguments="x:Object" x:Key="${escapeXml(key)}">${escapeXmlTextContent(val)}</${dir}>`;
}

function findInvokeNodes(content: string, invokeType: string): Array<{ fullMatch: string; startIndex: number; endIndex: number }> {
  const results: Array<{ fullMatch: string; startIndex: number; endIndex: number }> = [];

  const selfClosePattern = new RegExp(`<(?:\\w+:)?${invokeType}\\b[^>]*?\\/>`, "g");
  let m;
  while ((m = selfClosePattern.exec(content)) !== null) {
    results.push({ fullMatch: m[0], startIndex: m.index, endIndex: m.index + m[0].length });
  }

  const openTagPattern = new RegExp(`<(?:\\w+:)?${invokeType}\\b[^>]*?>`, "g");
  while ((m = openTagPattern.exec(content)) !== null) {
    if (m[0].endsWith("/>")) continue;
    const closeTagPattern = new RegExp(`<\\/(?:\\w+:)?${invokeType}\\s*>`);
    const restContent = content.substring(m.index + m[0].length);
    const closeMatch = closeTagPattern.exec(restContent);
    if (closeMatch) {
      const fullEnd = m.index + m[0].length + closeMatch.index + closeMatch[0].length;
      const fullMatch = content.substring(m.index, fullEnd);
      results.push({ fullMatch, startIndex: m.index, endIndex: fullEnd });
    }
  }

  results.sort((a, b) => b.startIndex - a.startIndex);
  return results;
}

export function canonicalizeInvokeBindings(
  entries: { name: string; content: string }[]
): InvokeCanonicalizationResult {
  const fixes: InvokeSerializationFix[] = [];
  const residualDefects: ResidualExpressionSerializationDefect[] = [];

  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);

    for (const invokeType of INVOKE_ACTIVITY_TYPES) {
      const nodes = findInvokeNodes(entry.content, invokeType);

      for (const node of nodes) {
        const fullMatch = node.fullMatch;

        const openTagMatch = fullMatch.match(new RegExp(`^(<(?:\\w+:)?${invokeType}\\b[^>]*?)(\\/>|>)`));
        if (!openTagMatch) continue;

        const openTag = openTagMatch[1];
        const closeTag = openTagMatch[2];
        const rest = fullMatch.substring(openTagMatch[0].length);

        const attrString = openTag.replace(new RegExp(`^<(?:\\w+:)?${invokeType}\\b`), "").trim();

        const attrBindings = new Map<string, { name: string; value: string }>();
        const pseudoAttrsToRemove: Array<{ name: string; value: string }> = [];
        const attrPattern = /\b([a-zA-Z_][\w.:]*)\s*=\s*"([^"]*)"/g;
        let am;
        while ((am = attrPattern.exec(attrString)) !== null) {
          const name = am[1];
          if (isSystemOrMetaAttr(name)) continue;
          // Task #539 (Step 4 / Pattern B): the `Arguments` property on
          // InvokeWorkflowFile is the typed `Dictionary<String, Argument>`
          // *property*; its serialization MUST be the typed
          // `<InvokeWorkflowFile.Arguments>` child-element block, never
          // the attribute form `Arguments="[dict_Config]"`. The attribute
          // form binds a runtime `Dictionary<String, Object>` value into
          // a property whose contract is `Dictionary<String, Argument>`
          // and is the source of the type-mismatch reported in run
          // b2bda0c2 on Main.xaml / Init.xaml. Strip it here. We do NOT
          // synthesize child entries from the dropped value because the
          // callee contract drives the canonical typed-children
          // materialization elsewhere (workflow-contract-integrity).
          if (invokeType === "InvokeWorkflowFile" && name === "Arguments") {
            pseudoAttrsToRemove.push({ name, value: am[2] });
            fixes.push({
              originalForm: `${name}="${am[2].substring(0, 200)}"`,
              canonicalizedForm: "(removed — typed <InvokeWorkflowFile.Arguments> child-block is canonical form)",
              normalizationType: "pseudo_property_removal",
              file: normalizedName,
              workflow: workflowName,
              activityType: invokeType,
              propertyName: name,
              rationale: `Attribute-form Arguments="..." dropped from InvokeWorkflowFile — Pattern B no-double-emission rule (typed child block is the canonical form for the Dictionary<String, Argument> property)`,
            });
            continue;
          }
          if (PSEUDO_PROPERTY_NAMES.has(name)) {
            pseudoAttrsToRemove.push({ name, value: am[2] });
            fixes.push({
              originalForm: `${name}="${am[2].substring(0, 200)}"`,
              canonicalizedForm: "(removed)",
              normalizationType: "pseudo_property_removal",
              file: normalizedName,
              workflow: workflowName,
              activityType: invokeType,
              propertyName: name,
              rationale: `Pseudo-property "${name}" removed from ${invokeType} — structural element must not appear as attribute`,
            });
            continue;
          }
          attrBindings.set(name, { name, value: am[2] });
        }

        const argBlockMatch = rest.match(
          new RegExp(`<(?:\\w+:)?${invokeType}\\.Arguments>([\\s\\S]*?)<\\/(?:\\w+:)?${invokeType}\\.Arguments>`)
        );

        const bodyBindings = new Map<string, string>();
        if (argBlockMatch) {
          const argBindingPattern = /<(In|Out|InOut)Argument\b[^>]*\bx:Key="([^"]+)"[^>]*>([^<]*)<\/(?:In|Out|InOut)Argument>/g;
          let bm;
          while ((bm = argBindingPattern.exec(argBlockMatch[1])) !== null) {
            bodyBindings.set(bm[2], bm[3].trim());
          }
        }

        const attrsToRemove: string[] = [];
        const argsToAdd: string[] = [];

        for (const [name, attrInfo] of Array.from(attrBindings.entries())) {
          if (bodyBindings.has(name)) {
            const bodyValue = bodyBindings.get(name)!;
            const strippedAttr = attrInfo.value.replace(/[\[\]"]/g, "");
            const strippedBody = bodyValue.replace(/[\[\]"]/g, "");
            const isEquivalent = attrInfo.value === bodyValue || strippedAttr === strippedBody;

            if (isEquivalent) {
              fixes.push({
                originalForm: `attribute="${attrInfo.value}" + body="${bodyValue}"`,
                canonicalizedForm: `body="${bodyValue}"`,
                normalizationType: "dual_serialization_dedup",
                file: normalizedName,
                workflow: workflowName,
                activityType: invokeType,
                propertyName: name,
                rationale: `Duplicate binding for "${name}" — attribute form removed, canonical body form preserved`,
              });
              attrsToRemove.push(name);
            } else {
              {
                const _origin = classifyDefectOrigin(attrInfo.value, "invoke-binding:unresolvable_invoke_conflict");
                residualDefects.push({
                  file: normalizedName,
                  workflow: workflowName,
                  activityType: invokeType,
                  propertyName: name,
                  originalValue: `attribute="${attrInfo.value}" vs body="${bodyValue}"`,
                  defectType: "unresolvable_invoke_conflict",
                  severity: "handoff_required",
                  rationale: `Conflicting binding for "${name}" — attribute and body have different values, cannot deterministically resolve — both preserved for manual resolution`,
                  origin: _origin.origin,
                  originReason: _origin.originReason,
                });
              }
            }
          } else {
            let normalizedValue = attrInfo.value;
            const jsonResult = tryNormalizeJsonExpression(attrInfo.value);
            if (jsonResult.wasJson) {
              normalizedValue = jsonResult.normalized;
              fixes.push({
                originalForm: `${name}="${attrInfo.value.substring(0, 200)}"`,
                canonicalizedForm: `${name}="${normalizedValue}"`,
                normalizationType: "json_expression_normalize",
                file: normalizedName,
                workflow: workflowName,
                activityType: invokeType,
                propertyName: name,
                rationale: `JSON expression payload in invoke binding "${name}" normalized to VB expression`,
              });
            }

            const argElement = buildCanonicalArgElement(name, normalizedValue);
            argsToAdd.push(argElement);

            fixes.push({
              originalForm: `${name}="${attrInfo.value.substring(0, 200)}"`,
              canonicalizedForm: argElement.trim(),
              normalizationType: "attr_to_argument_block",
              file: normalizedName,
              workflow: workflowName,
              activityType: invokeType,
              propertyName: name,
              rationale: `Attribute-style binding "${name}" canonicalized to structured argument element form`,
            });

            attrsToRemove.push(name);
          }
        }

        for (const pseudo of pseudoAttrsToRemove) {
          attrsToRemove.push(pseudo.name);
        }

        if (attrsToRemove.length === 0 && argsToAdd.length === 0) continue;

        let newOpenTag = openTag;
        for (const name of attrsToRemove) {
          newOpenTag = newOpenTag.replace(
            new RegExp(`\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*"[^"]*"`, "g"),
            ""
          );
        }

        let replacement: string;

        if (argsToAdd.length > 0) {
          const prefix = openTag.match(/<(\w+:)?/)?.[1] || "";
          const fullType = prefix ? `${prefix}${invokeType}` : invokeType;
          const argBlockContent = argsToAdd.join("\n");

          if (argBlockMatch) {
            const existingArgsContent = argBlockMatch[1].trimEnd();
            const newArgsContent = existingArgsContent + "\n" + argBlockContent;
            let newRest = rest.replace(argBlockMatch[1], newArgsContent + "\n");
            replacement = newOpenTag + ">" + newRest;
          } else if (closeTag === "/>") {
            replacement = newOpenTag + ">\n" +
              `              <${fullType}.Arguments>\n` +
              argBlockContent + "\n" +
              `              </${fullType}.Arguments>\n` +
              `            </${fullType}>`;
          } else {
            const insertArgBlock = `\n              <${fullType}.Arguments>\n` +
              argBlockContent + "\n" +
              `              </${fullType}.Arguments>`;
            replacement = newOpenTag + ">" + insertArgBlock + rest;
          }
        } else {
          if (closeTag === "/>" && !rest) {
            replacement = newOpenTag + " />";
          } else {
            replacement = newOpenTag + closeTag + rest;
          }
        }

        entry.content = entry.content.substring(0, node.startIndex) + replacement + entry.content.substring(node.endIndex);
      }
    }

    canonicalizeResidualJsonExpressions(entry, normalizedName, workflowName, fixes, residualDefects);
  }

  return {
    invokeSerializationFixes: fixes,
    residualExpressionSerializationDefects: residualDefects,
    totalCanonicalizations: fixes.length,
    totalResidualDefects: residualDefects.length,
  };
}

const EXPRESSION_BEARING_ATTR_PATTERNS = [
  { pattern: /\bMessage\s*=\s*"([^"]+)"/g, propName: "Message" },
  { pattern: /\bCondition\s*=\s*"([^"]+)"/g, propName: "Condition" },
  { pattern: /\bValue\s*=\s*"([^"]+)"/g, propName: "Value" },
  { pattern: /\bTo\s*=\s*"([^"]+)"/g, propName: "To" },
  { pattern: /\bText\s*=\s*"([^"]+)"/g, propName: "Text" },
  { pattern: /\bTextString\s*=\s*"([^"]+)"/g, propName: "TextString" },
  { pattern: /\bQueueType\s*=\s*"([^"]+)"/g, propName: "QueueType" },
  { pattern: /\bTimeout\s*=\s*"([^"]+)"/g, propName: "Timeout" },
  { pattern: /\bExpression\s*=\s*"([^"]+)"/g, propName: "Expression" },
  { pattern: /\bException\s*=\s*"([^"]+)"/g, propName: "Exception" },
  { pattern: /\bBody\s*=\s*"([^"]+)"/g, propName: "Body" },
  { pattern: /\bInput\s*=\s*"([^"]+)"/g, propName: "Input" },
  { pattern: /\bOutput\s*=\s*"([^"]+)"/g, propName: "Output" },
  { pattern: /\bResult\s*=\s*"([^"]+)"/g, propName: "Result" },
  { pattern: /\bSelector\s*=\s*"([^"]+)"/g, propName: "Selector" },
  { pattern: /\bUrl\s*=\s*"([^"]+)"/g, propName: "Url" },
  { pattern: /\bEndpoint\s*=\s*"([^"]+)"/g, propName: "Endpoint" },
  { pattern: /\bJsonPayload\s*=\s*"([^"]+)"/g, propName: "JsonPayload" },
  { pattern: /\bRequestContent\s*=\s*"([^"]+)"/g, propName: "RequestContent" },
  { pattern: /\bResponseContent\s*=\s*"([^"]+)"/g, propName: "ResponseContent" },
];

function canonicalizeResidualJsonExpressions(
  entry: { name: string; content: string },
  normalizedName: string,
  workflowName: string,
  fixes: InvokeSerializationFix[],
  residualDefects: ResidualExpressionSerializationDefect[],
): void {
  let content = entry.content;
  let changed = false;

  for (const { pattern, propName } of EXPRESSION_BEARING_ATTR_PATTERNS) {
    const localPattern = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = localPattern.exec(content)) !== null) {
      const originalValue = match[1];
      if (!JSON_EXPRESSION_PATTERN.test(originalValue)) continue;

      const jsonResult = tryNormalizeJsonExpression(originalValue);
      if (jsonResult.wasJson && jsonResult.normalized !== originalValue) {
        const activityContext = detectEnclosingActivity(content, match.index);
        fixes.push({
          originalForm: `${propName}="${originalValue.substring(0, 200)}"`,
          canonicalizedForm: `${propName}="${jsonResult.normalized}"`,
          normalizationType: "json_expression_normalize",
          file: normalizedName,
          workflow: workflowName,
          activityType: activityContext,
          propertyName: propName,
          rationale: `JSON expression leak in ${propName} normalized to VB expression`,
        });

        content = content.replace(
          `${propName}="${originalValue}"`,
          `${propName}="${escapeXml(jsonResult.normalized)}"`
        );
        changed = true;
      } else if (JSON_EXPRESSION_PATTERN.test(originalValue)) {
        const activityContext = detectEnclosingActivity(content, match.index);
        const _origin = classifyDefectOrigin(originalValue, "invoke-binding:json_expression_leak");
        residualDefects.push({
          file: normalizedName,
          workflow: workflowName,
          activityType: activityContext,
          propertyName: propName,
          originalValue: originalValue.substring(0, 200),
          defectType: "json_expression_leak",
          severity: "execution_blocking",
          rationale: `Unresolvable JSON expression payload in ${propName} — manual remediation required`,
          origin: _origin.origin,
          originReason: _origin.originReason,
        });
      }
    }
  }

  scanForPlaceholderSentinels(content, normalizedName, workflowName, residualDefects);

  const argValuePattern = /<(In|Out|InOut)Argument\b[^>]*>([^<]+)<\/(In|Out|InOut)Argument>/g;
  let avm;
  while ((avm = argValuePattern.exec(content)) !== null) {
    const argValue = avm[2].trim();
    if (JSON_EXPRESSION_PATTERN.test(argValue)) {
      const jsonResult = tryNormalizeJsonExpression(argValue);
      if (jsonResult.wasJson && jsonResult.normalized !== argValue) {
        content = content.replace(avm[0], avm[0].replace(argValue, jsonResult.normalized));
        changed = true;
        fixes.push({
          originalForm: argValue.substring(0, 200),
          canonicalizedForm: jsonResult.normalized,
          normalizationType: "json_expression_normalize",
          file: normalizedName,
          workflow: workflowName,
          activityType: "InvokeArgument",
          propertyName: "ArgumentValue",
          rationale: `JSON expression in invoke argument value normalized`,
        });
      }
    }
  }

  if (changed) {
    entry.content = content;
  }
}

export function runPreGateResidualJsonCanonicalization(
  xamlEntries: Array<{ name: string; content: string }>,
): { totalFixes: number; totalDefects: number } {
  const fixes: InvokeSerializationFix[] = [];
  const residualDefects: ResidualExpressionSerializationDefect[] = [];
  for (const entry of xamlEntries) {
    const normalizedName = entry.name.split("/").pop() || entry.name;
    const workflowName = normalizedName.replace(/\.xaml$/i, "");
    canonicalizeResidualJsonExpressions(entry, normalizedName, workflowName, fixes, residualDefects);
  }
  return { totalFixes: fixes.length, totalDefects: residualDefects.length };
}

function detectEnclosingActivity(content: string, position: number): string {
  const before = content.substring(Math.max(0, position - 500), position);
  const actMatch = before.match(/<(\w+:?\w+)\s+[^>]*$/);
  if (actMatch) return actMatch[1];
  const simpleMatch = before.match(/<(\w+:?\w+)\b[^>]*$/);
  if (simpleMatch) return simpleMatch[1];
  return "unknown";
}

function scanForPlaceholderSentinels(
  content: string,
  normalizedName: string,
  workflowName: string,
  residualDefects: ResidualExpressionSerializationDefect[],
): void {
  const executableAttrPattern = /\b(Message|Condition|Value|To|Text|TextString|Expression|WorkflowFileName|QueueType|Timeout)\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = executableAttrPattern.exec(content)) !== null) {
    const propName = match[1];
    const value = match[2];
    if (PLACEHOLDER_PATTERN.test(value)) {
      const activityContext = detectEnclosingActivity(content, match.index);
      const _origin = classifyDefectOrigin(value, "invoke-binding:placeholder_in_executable");
      residualDefects.push({
        file: normalizedName,
        workflow: workflowName,
        activityType: activityContext,
        propertyName: propName,
        originalValue: value.substring(0, 200),
        defectType: "placeholder_in_executable",
        severity: "handoff_required",
        rationale: `Placeholder sentinel in executable property ${propName} — requires business value`,
        origin: _origin.origin,
        originReason: _origin.originReason,
      });
    }
  }
}

const CHILD_ELEMENT_PROPERTY_PATTERNS = [
  { parentTag: "Assign", propName: "To", isTarget: true },
  { parentTag: "Assign", propName: "Value", isTarget: false },
  { parentTag: "LogMessage", propName: "Message", isTarget: false },
  { parentTag: "LogMessage", propName: "Level", isTarget: false },
  { parentTag: "If", propName: "Condition", isTarget: false },
  { parentTag: "Throw", propName: "Exception", isTarget: false },
  { parentTag: "AddQueueItem", propName: "QueueType", isTarget: false },
  { parentTag: "AddQueueItem", propName: "QueueName", isTarget: false },
  { parentTag: "AddQueueItem", propName: "ItemInformation", isTarget: false },
  { parentTag: "SendSmtpMailMessage", propName: "Subject", isTarget: false },
  { parentTag: "SendSmtpMailMessage", propName: "Body", isTarget: false },
  { parentTag: "SendSmtpMailMessage", propName: "To", isTarget: true },
];

const SENTINEL_PLACEHOLDER_RE = /\bPLACEHOLDER\b|\bPLACEHOLDER_\w+/i;
const SENTINEL_TODO_RE = /\bTODO:\s*implement\s+this\s+expression\b|\bTODO\b/i;
const SENTINEL_HANDOFF_RE = /\bHANDOFF_\w+/;
const SENTINEL_STUB_RE = /\bSTUB_\w+|\bASSEMBLY_FAILED\w*/;

function classifySentinel(value: string): SentinelReplacementRecord["originalDefectClass"] | null {
  const strippedValue = value.replace(/&quot;[^&]*&quot;/g, "").replace(/\[&quot;[^[]*&quot;\]/g, "");
  if (SENTINEL_PLACEHOLDER_RE.test(strippedValue)) return "placeholder_sentinel";
  if (SENTINEL_TODO_RE.test(strippedValue)) return "todo_sentinel";
  if (SENTINEL_HANDOFF_RE.test(strippedValue)) return "handoff_sentinel";
  if (SENTINEL_STUB_RE.test(strippedValue)) return "stub_sentinel";
  return null;
}

function getSafeReplacementForProperty(propertyName: string, isTarget: boolean): string {
  if (isTarget) return "Nothing";
  const lowerProp = propertyName.toLowerCase();
  if (lowerProp === "condition") return "False";
  if (lowerProp === "message" || lowerProp === "text" || lowerProp === "textstring" || lowerProp === "subject" || lowerProp === "body" || lowerProp === "queuename" || lowerProp === "queuetype") return '""';
  if (lowerProp === "value") return '""';
  if (lowerProp === "exception") return "Nothing";
  return "Nothing";
}

function isTargetProperty(propertyName: string): boolean {
  const lp = propertyName.toLowerCase();
  return lp === "to" || lp === "result" || lp === "output";
}

function extractArgumentsFromContent(content: string): Map<string, { direction: string; type: string }> {
  const args = new Map<string, { direction: string; type: string }>();
  const propertyPattern = /<x:Property\s+([^>]+)\/?>/g;
  let m;
  while ((m = propertyPattern.exec(content)) !== null) {
    const attrs = m[1];
    const nameMatch = attrs.match(/Name="([^"]+)"/);
    const typeMatch = attrs.match(/Type="([^"]+)"/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const typeAttr = typeMatch ? typeMatch[1] : "";
    let direction = "InArgument";
    if (/OutArgument/.test(typeAttr)) direction = "OutArgument";
    else if (/InOutArgument/.test(typeAttr)) direction = "InOutArgument";
    const innerTypeMatch = typeAttr.match(/\(([^)]+)\)/);
    const type = innerTypeMatch ? innerTypeMatch[1] : "x:Object";
    args.set(name, { direction, type });
  }
  return args;
}

function extractExpressionBearingProperties(content: string): Array<{ activityType: string; propertyName: string; value: string }> {
  const results: Array<{ activityType: string; propertyName: string; value: string }> = [];
  const commentClean = content.replace(/<!--[\s\S]*?-->/g, "");
  const viewClean = commentClean
    .replace(/<sap:WorkflowViewStateService\.ViewState[\s\S]*?<\/sap:WorkflowViewStateService\.ViewState>/gi, "")
    .replace(/<sap2010:WorkflowViewState[\s\S]*?<\/sap2010:WorkflowViewState>/gi, "");

  const tagPattern = /<(\w+(?::\w+)?)\s([^>]*?)(?:\/>|>)/g;
  let tagMatch;
  while ((tagMatch = tagPattern.exec(viewClean)) !== null) {
    const actType = tagMatch[1];
    if (/^(x:|mc:|sco:|s:)/.test(actType)) continue;
    if (/^(Variable|Activity|Sequence\.Variables|Flowchart\.Variables|AssemblyReference)$/.test(actType)) continue;
    const attrs = tagMatch[2];
    const attrPattern = /(\w+(?:\.\w+)?)\s*=\s*"([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrs)) !== null) {
      const propName = attrMatch[1];
      if (/^(xmlns|x:|mc:|sap)/.test(propName) || propName === "DisplayName") continue;
      results.push({ activityType: actType, propertyName: propName, value: attrMatch[2] });
    }
  }
  return results;
}

function isExpressionLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) return true;
  if (/\b(in_|out_|io_|str_|int_|bool_|dbl_|obj_|dt_|ts_|drow_|qi_)\w+/.test(trimmed)) return true;
  return false;
}

export function canonicalizeTargetValueExpressions(
  entries: { name: string; content: string }[]
): TargetValueCanonicalizationResult {
  const fixes: ExpressionCanonicalizationFix[] = [];
  const scopeDefects: SymbolScopeDefect[] = [];
  const sentinelReplacements: SentinelReplacementRecord[] = [];
  const unresolvableJsonDefects: UnresolvableJsonDefect[] = [];

  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);

    canonicalizeChildElementJsonPayloads(entry, normalizedName, workflowName, fixes, unresolvableJsonDefects);

    enforceSymbolScope(entry, normalizedName, workflowName, scopeDefects);

    blockSentinelsInExecutableProperties(entry, normalizedName, workflowName, sentinelReplacements);
  }

  const totalActions = fixes.length + scopeDefects.length + sentinelReplacements.length + unresolvableJsonDefects.length;
  const summary = totalActions > 0
    ? `Target/value canonicalization: ${fixes.length} expression fix(es), ${scopeDefects.length} symbol scope defect(s), ${sentinelReplacements.length} sentinel replacement(s), ${unresolvableJsonDefects.length} unresolvable JSON defect(s)`
    : "Target/value canonicalization: no issues found";

  return {
    expressionCanonicalizationFixes: fixes,
    symbolScopeDefects: scopeDefects,
    sentinelReplacements: sentinelReplacements,
    unresolvableJsonDefects,
    summary,
  };
}

function canonicalizeChildElementJsonPayloads(
  entry: { name: string; content: string },
  normalizedName: string,
  workflowName: string,
  fixes: ExpressionCanonicalizationFix[],
  unresolvableJsonDefects: UnresolvableJsonDefect[],
): void {
  let content = entry.content;
  let changed = false;

  for (const { parentTag, propName, isTarget } of CHILD_ELEMENT_PROPERTY_PATTERNS) {
    const childElemPattern = new RegExp(
      `(<(?:\\w+:)?${parentTag}\\.${propName}>)([\\s\\S]*?)(<\\/(?:\\w+:)?${parentTag}\\.${propName}>)`,
      "g"
    );
    content = content.replace(childElemPattern, (fullMatch, openTag, inner, closeTag) => {
      const argWrapperMatch = inner.match(
        /(<(?:InArgument|OutArgument|InOutArgument)\b[^>]*>)([\s\S]*?)(<\/(?:InArgument|OutArgument|InOutArgument)>)/
      );

      let expressionContent: string;
      let prefix = "";
      let suffix = "";

      if (argWrapperMatch) {
        prefix = argWrapperMatch[1];
        expressionContent = argWrapperMatch[2].trim();
        suffix = argWrapperMatch[3];
      } else {
        expressionContent = inner.trim();
      }

      if (!JSON_EXPRESSION_PATTERN.test(expressionContent)) return fullMatch;

      const jsonResult = tryNormalizeJsonExpression(expressionContent);
      if (jsonResult.wasJson && jsonResult.normalized !== expressionContent) {
        const canonType = isTarget ? "json_target_normalize" as const : "json_value_normalize" as const;
        fixes.push({
          file: normalizedName,
          workflow: workflowName,
          activityType: parentTag,
          propertyName: propName,
          originalValue: expressionContent.substring(0, 200),
          canonicalizedValue: jsonResult.normalized,
          canonicalizationType: canonType,
          rationale: `JSON expression payload in child element <${parentTag}.${propName}> normalized to VB expression`,
        });

        changed = true;
        if (argWrapperMatch) {
          return `${openTag}${prefix}${jsonResult.normalized}${suffix}${closeTag}`;
        } else {
          return `${openTag}${jsonResult.normalized}${closeTag}`;
        }
      } else if (JSON_EXPRESSION_PATTERN.test(expressionContent)) {
        const safeValue = getSafeReplacementForProperty(propName, isTarget);
        const _origin = classifyDefectOrigin(expressionContent, "invoke-binding:unresolvable_json_payload");
        unresolvableJsonDefects.push({
          file: normalizedName,
          workflow: workflowName,
          activityType: parentTag,
          propertyName: propName,
          originalValue: expressionContent.substring(0, 200),
          replacementType: "degradation_substitute",
          safeReplacementValue: safeValue,
          originalDefectClass: "unresolvable_json_payload",
          severity: "execution_blocking",
          rationale: `Unresolvable JSON payload in <${parentTag}.${propName}> replaced with platform-safe value "${safeValue}" — non-deterministic canonicalization, degradation substitute`,
          origin: _origin.origin,
          originReason: _origin.originReason,
        });

        changed = true;
        if (argWrapperMatch) {
          return `${openTag}${prefix}${safeValue}${suffix}${closeTag}`;
        } else {
          return `${openTag}${safeValue}${closeTag}`;
        }
      }

      return fullMatch;
    });
  }

  if (changed) {
    entry.content = content;
  }
}

function enforceSymbolScope(
  entry: { name: string; content: string },
  normalizedName: string,
  workflowName: string,
  scopeDefects: SymbolScopeDefect[],
): void {
  const declaredVars = extractDeclaredVariables(entry.content);
  const declaredArgs = extractArgumentsFromContent(entry.content);

  const allDeclared = new Set(declaredVars);
  for (const argName of declaredArgs.keys()) {
    allDeclared.add(argName);
  }

  let content = entry.content;
  let changed = false;
  const properties = extractExpressionBearingProperties(content);

  for (const prop of properties) {
    const value = prop.value.trim();
    if (!value) continue;
    if (!isExpressionLike(value)) continue;

    let exprToCheck = value;
    if (exprToCheck.startsWith("[") && exprToCheck.endsWith("]")) {
      exprToCheck = exprToCheck.slice(1, -1);
    }
    if (!exprToCheck || exprToCheck.length < 2) continue;

    if (/HANDOFF_|STUB_|ASSEMBLY_FAILED|PLACEHOLDER|TODO/.test(exprToCheck)) continue;

    const undeclaredRefs = findUndeclaredVariables(exprToCheck, allDeclared);

    if (undeclaredRefs.length === 0) {
      const argPrefixPattern = /\b(in_\w+|out_\w+|io_\w+)\b/gi;
      let argMatch;
      while ((argMatch = argPrefixPattern.exec(exprToCheck)) !== null) {
        const argRef = argMatch[1];
        if (!allDeclared.has(argRef) && !undeclaredRefs.includes(argRef)) {
          undeclaredRefs.push(argRef);
        }
      }
    }

    if (undeclaredRefs.length === 0) continue;

    const isTarget = isTargetProperty(prop.propertyName);
    const safeValue = getSafeReplacementForProperty(prop.propertyName, isTarget);

    for (const ref of undeclaredRefs) {
      const isArgRef = /^(in_|out_|io_)/i.test(ref);
      const severity = isTarget ? "execution_blocking" as const : "handoff_required" as const;
      scopeDefects.push({
        file: normalizedName,
        workflow: workflowName,
        activityType: prop.activityType,
        propertyName: prop.propertyName,
        referencedSymbol: ref,
        offendingExpression: value.substring(0, 200),
        replacementType: "degradation_substitute",
        safeReplacementValue: safeValue,
        originalDefectClass: isArgRef ? "undeclared_argument_reference" : "undeclared_variable_reference",
        severity,
        rationale: `${isArgRef ? "Argument" : "Variable"} "${ref}" referenced in ${prop.propertyName} but not declared in workflow "${workflowName}" — expression replaced with "${safeValue}"`,
      });
    }

    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const attrReplacePattern = new RegExp(
      `(\\b${prop.propertyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*=\\s*")${escapedValue}(")`
    );
    const newContent = content.replace(attrReplacePattern, `$1${safeValue}$2`);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }

  for (const { parentTag, propName, isTarget } of CHILD_ELEMENT_PROPERTY_PATTERNS) {
    const childElemPattern = new RegExp(
      `(<(?:\\w+:)?${parentTag}\\.${propName}>)([\\s\\S]*?)(<\\/(?:\\w+:)?${parentTag}\\.${propName}>)`,
      "g"
    );
    content = content.replace(childElemPattern, (fullMatch, openTag, inner, closeTag) => {
      const argWrapperMatch = inner.match(
        /(<(?:InArgument|OutArgument|InOutArgument)\b[^>]*>)([\s\S]*?)(<\/(?:InArgument|OutArgument|InOutArgument)>)/
      );

      let expressionContent: string;
      if (argWrapperMatch) {
        expressionContent = argWrapperMatch[2].trim();
      } else {
        expressionContent = inner.trim();
      }

      if (!expressionContent || !isExpressionLike(expressionContent)) return fullMatch;
      if (/HANDOFF_|STUB_|ASSEMBLY_FAILED|PLACEHOLDER|TODO/.test(expressionContent)) return fullMatch;

      let exprToCheck = expressionContent;
      if (exprToCheck.startsWith("[") && exprToCheck.endsWith("]")) {
        exprToCheck = exprToCheck.slice(1, -1);
      }
      if (!exprToCheck || exprToCheck.length < 2) return fullMatch;

      const undeclaredRefs = findUndeclaredVariables(exprToCheck, allDeclared);

      if (undeclaredRefs.length === 0) {
        const argPrefixPattern = /\b(in_\w+|out_\w+|io_\w+)\b/gi;
        let argMatch;
        while ((argMatch = argPrefixPattern.exec(exprToCheck)) !== null) {
          const argRef = argMatch[1];
          if (!allDeclared.has(argRef) && !undeclaredRefs.includes(argRef)) {
            undeclaredRefs.push(argRef);
          }
        }
      }

      if (undeclaredRefs.length === 0) return fullMatch;

      const safeValue = getSafeReplacementForProperty(propName, isTarget);

      for (const ref of undeclaredRefs) {
        const isArgRef = /^(in_|out_|io_)/i.test(ref);
        const severity = isTarget ? "execution_blocking" as const : "handoff_required" as const;
        scopeDefects.push({
          file: normalizedName,
          workflow: workflowName,
          activityType: parentTag,
          propertyName: propName,
          referencedSymbol: ref,
          offendingExpression: expressionContent.substring(0, 200),
          replacementType: "degradation_substitute",
          safeReplacementValue: safeValue,
          originalDefectClass: isArgRef ? "undeclared_argument_reference" : "undeclared_variable_reference",
          severity,
          rationale: `${isArgRef ? "Argument" : "Variable"} "${ref}" referenced in child element <${parentTag}.${propName}> but not declared in workflow "${workflowName}" — expression replaced with "${safeValue}"`,
        });
      }

      changed = true;
      if (argWrapperMatch) {
        return `${openTag}${argWrapperMatch[1]}${safeValue}${argWrapperMatch[3]}${closeTag}`;
      }
      return `${openTag}${safeValue}${closeTag}`;
    });
  }

  if (changed) {
    entry.content = content;
  }
}

function blockSentinelsInExecutableProperties(
  entry: { name: string; content: string },
  normalizedName: string,
  workflowName: string,
  sentinelReplacements: SentinelReplacementRecord[],
): void {
  let content = entry.content;
  let changed = false;

  const executableAttrPatterns = [
    { pattern: /\b(Message)\s*=\s*"([^"]+)"/g, isTarget: false },
    { pattern: /\b(Condition)\s*=\s*"([^"]+)"/g, isTarget: false },
    { pattern: /\b(Value)\s*=\s*"([^"]+)"/g, isTarget: false },
    { pattern: /\b(To)\s*=\s*"([^"]+)"/g, isTarget: true },
    { pattern: /\b(Text)\s*=\s*"([^"]+)"/g, isTarget: false },
    { pattern: /\b(Expression)\s*=\s*"([^"]+)"/g, isTarget: false },
    { pattern: /\b(WorkflowFileName)\s*=\s*"([^"]+)"/g, isTarget: false },
    { pattern: /\b(Exception)\s*=\s*"([^"]+)"/g, isTarget: true },
    { pattern: /\b(Result)\s*=\s*"([^"]+)"/g, isTarget: true },
    { pattern: /\b(Output)\s*=\s*"([^"]+)"/g, isTarget: true },
  ];

  for (const { pattern, isTarget } of executableAttrPatterns) {
    const localPattern = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = localPattern.exec(content)) !== null) {
      const propName = match[1];
      const value = match[2];

      const sentinelClass = classifySentinel(value);
      if (!sentinelClass) continue;

      const safeValue = getSafeReplacementForProperty(propName, isTarget);
      const activityContext = detectEnclosingActivity(content, match.index);

      {
        const _origin = classifyDefectOrigin(value, `invoke-binding:sentinel:${sentinelClass}`);
        sentinelReplacements.push({
          file: normalizedName,
          workflow: workflowName,
          activityType: activityContext,
          propertyName: propName,
          originalValue: value.substring(0, 200),
          replacementType: "degradation_substitute",
          safeReplacementValue: safeValue,
          originalDefectClass: sentinelClass,
          severity: "execution_blocking",
          rationale: `Sentinel "${value.substring(0, 80)}" in executable property ${propName} replaced with platform-safe value "${safeValue}" — not executable, degradation substitute`,
          origin: _origin.origin,
          originReason: _origin.originReason,
        });
      }

      content = content.replace(
        `${propName}="${value}"`,
        `${propName}="${safeValue}"`
      );
      changed = true;
    }
  }

  for (const { parentTag, propName, isTarget } of CHILD_ELEMENT_PROPERTY_PATTERNS) {
    const childElemPattern = new RegExp(
      `(<(?:\\w+:)?${parentTag}\\.${propName}>)([\\s\\S]*?)(<\\/(?:\\w+:)?${parentTag}\\.${propName}>)`,
      "g"
    );
    content = content.replace(childElemPattern, (fullMatch, openTag, inner, closeTag) => {
      const argWrapperMatch = inner.match(
        /(<(?:InArgument|OutArgument|InOutArgument)\b[^>]*>)([\s\S]*?)(<\/(?:InArgument|OutArgument|InOutArgument)>)/
      );

      let expressionContent: string;
      if (argWrapperMatch) {
        expressionContent = argWrapperMatch[2].trim();
      } else {
        expressionContent = inner.trim();
      }

      const sentinelClass = classifySentinel(expressionContent);
      if (!sentinelClass) return fullMatch;

      const safeValue = getSafeReplacementForProperty(propName, isTarget);

      {
        const _origin = classifyDefectOrigin(expressionContent, `invoke-binding:child-sentinel:${sentinelClass}`);
        sentinelReplacements.push({
          file: normalizedName,
          workflow: workflowName,
          activityType: parentTag,
          propertyName: propName,
          originalValue: expressionContent.substring(0, 200),
          replacementType: "degradation_substitute",
          safeReplacementValue: safeValue,
          originalDefectClass: sentinelClass,
          severity: "execution_blocking",
          rationale: `Sentinel "${expressionContent.substring(0, 80)}" in child element <${parentTag}.${propName}> replaced with "${safeValue}" — degradation substitute`,
          origin: _origin.origin,
          originReason: _origin.originReason,
        });
      }

      changed = true;
      if (argWrapperMatch) {
        return `${openTag}${argWrapperMatch[1]}${safeValue}${argWrapperMatch[3]}${closeTag}`;
      }
      return `${openTag}${safeValue}${closeTag}`;
    });
  }

  if (changed) {
    entry.content = content;
  }
}

export interface InvokeBindingRepairRecord {
  file: string;
  workflow: string;
  activityType: string;
  bindingKey: string;
  repairOutcome: "repaired" | "blocked";
  callerSymbolEvidence: boolean;
  calleeContractEvidence: boolean;
  directionTypeCompatible: boolean;
  originalValue: string;
  repairedValue?: string;
  blockReason?: string;
  evidenceSummary: string;
}

export interface InvokeBindingRepairResult {
  repairs: InvokeBindingRepairRecord[];
  totalRepaired: number;
  totalBlocked: number;
  summary: string;
}

interface CalleeContractArg {
  name: string;
  direction: string;
  type: string;
}

interface CalleeContract {
  workflowName: string;
  arguments: CalleeContractArg[];
}

function stripDirectionPrefixLocal(name: string): string {
  return name.replace(/^(in_|out_|io_)/i, "");
}

function isDirectionCompatible(bindingDirection: string, contractDirection: string): boolean {
  if (!bindingDirection || !contractDirection) return false;
  const bd = bindingDirection.replace(/Argument$/i, "").toLowerCase();
  const cd = contractDirection.replace(/Argument$/i, "").toLowerCase();
  if (bd === cd) return true;
  if (cd === "inout") return true;
  return false;
}

function isTypeCompatibleForInvoke(bindingType: string, contractType: string): boolean {
  if (!bindingType || !contractType) return false;
  if (bindingType === contractType) return true;
  if (contractType === "x:Object" || contractType === "Object" || contractType === "System.Object") return true;
  if (bindingType === "x:Object" || bindingType === "Object" || bindingType === "System.Object") return true;
  const normalize = (t: string) => t.replace(/^(x:|s:|scg2:)/, "").replace(/^System\./, "");
  return normalize(bindingType) === normalize(contractType);
}

export function repairInvokeBindingsWithTripleEvidence(
  entries: { name: string; content: string }[],
  contractMap: Map<string, CalleeContract>,
): InvokeBindingRepairResult {
  const repairs: InvokeBindingRepairRecord[] = [];

  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);

    const declaredVars = new Set(extractDeclaredVariables(entry.content));
    const declaredArgs = extractArgumentsFromContent(entry.content);
    const allDeclared = new Set(Array.from(declaredVars).concat(Array.from(declaredArgs.keys())));

    for (const invokeType of INVOKE_ACTIVITY_TYPES) {
      const nodes = findInvokeNodes(entry.content, invokeType);

      for (const node of nodes) {
        const fileNameMatch = node.fullMatch.match(/WorkflowFileName="([^"]+)"/);
        if (!fileNameMatch) continue;
        const calleeFile = fileNameMatch[1];
        const calleeBasename = (calleeFile.split("/").pop() || calleeFile).replace(/\.xaml$/i, "").toLowerCase();
        const calleeContract = contractMap.get(calleeBasename) || contractMap.get(calleeFile.toLowerCase()) || null;

        const argBlockMatch = node.fullMatch.match(
          new RegExp(`<(?:\\w+:)?${invokeType}\\.Arguments>([\\s\\S]*?)<\\/(?:\\w+:)?${invokeType}\\.Arguments>`)
        );
        if (!argBlockMatch) continue;

        const bindingPattern = /<(InArgument|OutArgument|InOutArgument)\b[^>]*x:Key="([^"]+)"[^>]*>([^<]*)<\//g;
        let bm;
        while ((bm = bindingPattern.exec(argBlockMatch[1])) !== null) {
          const bindingDirection = bm[1];
          const bindingKey = bm[2];
          const bindingValue = bm[3].trim();

          const callerSymbolRefs = findBindingSymbolRefs(bindingValue);
          const hasSymbolRefs = callerSymbolRefs.length > 0;
          const callerSymbolEvidence = hasSymbolRefs
            ? callerSymbolRefs.every(ref => allDeclared.has(ref))
            : /^\[?"[^"]*"\]?$|^\[?(True|False|Nothing|\d+(\.\d+)?)\]?$/i.test(bindingValue.trim());

          let calleeContractEvidence = false;
          let matchedContractArg: CalleeContractArg | null = null;
          let calleeAmbiguous = false;
          if (calleeContract) {
            const bindingKeyLower = bindingKey.toLowerCase();
            const strippedKey = stripDirectionPrefixLocal(bindingKey).toLowerCase();
            const matchedArgs: CalleeContractArg[] = [];
            for (const cArg of calleeContract.arguments) {
              const cNameLower = cArg.name.toLowerCase();
              const cStripped = stripDirectionPrefixLocal(cArg.name).toLowerCase();
              if (cNameLower === bindingKeyLower || cStripped === strippedKey || cNameLower === strippedKey || cStripped === bindingKeyLower) {
                matchedArgs.push(cArg);
              }
            }
            if (matchedArgs.length === 1) {
              matchedContractArg = matchedArgs[0];
              calleeContractEvidence = true;
            } else if (matchedArgs.length > 1) {
              calleeAmbiguous = true;
            }
          }

          let directionTypeCompatible = false;
          if (matchedContractArg) {
            const dirOk = isDirectionCompatible(bindingDirection, matchedContractArg.direction);
            const typeOk = isTypeCompatibleForInvoke(
              bm[0].match(/x:TypeArguments="([^"]+)"/)?.[1] || "",
              matchedContractArg.type
            );
            directionTypeCompatible = dirOk && typeOk;
          }

          const tripleOk = callerSymbolEvidence && calleeContractEvidence && directionTypeCompatible;
          const evidenceParts: string[] = [];
          evidenceParts.push(`caller_symbol=${callerSymbolEvidence ? (hasSymbolRefs ? "confirmed" : "literal_value") : "missing"}`);
          evidenceParts.push(`callee_contract=${calleeContractEvidence ? "matched" : "no_match"}`);
          evidenceParts.push(`direction_type=${directionTypeCompatible ? "compatible" : "incompatible"}`);

          if (tripleOk && matchedContractArg) {
            const contractDirection = matchedContractArg.direction.replace(/Argument$/i, "") + "Argument";
            const contractType = matchedContractArg.type || "x:Object";
            const contractName = matchedContractArg.name;
            const originalFragment = bm[0];
            let repairedFragment = originalFragment;

            if (bindingKey !== contractName) {
              repairedFragment = repairedFragment.replace(`x:Key="${bindingKey}"`, `x:Key="${contractName}"`);
            }
            if (bindingDirection !== contractDirection) {
              repairedFragment = repairedFragment.replace(new RegExp(`<${bindingDirection}\\b`), `<${contractDirection}`);
              repairedFragment = repairedFragment.replace(new RegExp(`</${bindingDirection}>`), `</${contractDirection}>`);
            }
            const currentTypeArgs = bm[0].match(/x:TypeArguments="([^"]+)"/)?.[1] || "";
            if (currentTypeArgs && currentTypeArgs !== contractType) {
              repairedFragment = repairedFragment.replace(`x:TypeArguments="${currentTypeArgs}"`, `x:TypeArguments="${contractType}"`);
            }

            if (repairedFragment !== originalFragment) {
              entry.content = entry.content.replace(originalFragment, repairedFragment);
            }

            repairs.push({
              file: normalizedName,
              workflow: workflowName,
              activityType: invokeType,
              bindingKey,
              repairOutcome: "repaired",
              callerSymbolEvidence,
              calleeContractEvidence,
              directionTypeCompatible,
              originalValue: bindingValue.substring(0, 200),
              repairedValue: repairedFragment.substring(0, 200),
              evidenceSummary: evidenceParts.join(", "),
            });
          } else {
            const reasons: string[] = [];
            if (!callerSymbolEvidence) {
              const undeclared = callerSymbolRefs.filter(r => !allDeclared.has(r));
              reasons.push(`caller symbol(s) undeclared: [${undeclared.join(", ")}]`);
            }
            if (!calleeContractEvidence) {
              if (calleeAmbiguous) {
                reasons.push(`binding key "${bindingKey}" matches multiple callee contract arguments — ambiguous, blocked`);
              } else {
                reasons.push(calleeContract
                  ? `binding key "${bindingKey}" not found in callee contract (declares: [${calleeContract.arguments.map(a => a.name).join(", ")}])`
                  : `no callee contract available for "${calleeFile}"`);
              }
            }
            if (!directionTypeCompatible && matchedContractArg) {
              reasons.push(`direction/type mismatch: binding=${bindingDirection}, contract=${matchedContractArg.direction}(${matchedContractArg.type})`);
            }

            repairs.push({
              file: normalizedName,
              workflow: workflowName,
              activityType: invokeType,
              bindingKey,
              repairOutcome: "blocked",
              callerSymbolEvidence,
              calleeContractEvidence,
              directionTypeCompatible,
              originalValue: bindingValue.substring(0, 200),
              blockReason: reasons.join("; "),
              evidenceSummary: evidenceParts.join(", "),
            });
          }
        }
      }
    }
  }

  const totalRepaired = repairs.filter(r => r.repairOutcome === "repaired").length;
  const totalBlocked = repairs.filter(r => r.repairOutcome === "blocked").length;
  const summary = repairs.length > 0
    ? `Invoke binding triple-evidence repair: ${totalRepaired} repaired, ${totalBlocked} blocked`
    : "Invoke binding triple-evidence repair: no bindings evaluated";

  return { repairs, totalRepaired, totalBlocked, summary };
}

function findBindingSymbolRefs(value: string): string[] {
  const refs: string[] = [];
  let expr = value.replace(/^\[|\]$/g, "").trim();
  if (!expr) return refs;
  if (/^".*"$/.test(expr)) return refs;
  if (/^(True|False|Nothing|\d+(\.\d+)?)$/.test(expr)) return refs;

  const identPattern = /\b([a-zA-Z_]\w*)\b/g;
  const vbKeywords = new Set([
    "True", "False", "Nothing", "Not", "And", "Or", "AndAlso", "OrElse",
    "Is", "IsNot", "New", "If", "CStr", "CInt", "CBool", "CDbl", "CType",
    "String", "Integer", "Boolean", "Object", "Double", "Decimal",
    "DateTime", "TimeSpan", "Math", "Convert", "Environment", "System",
    "GetType", "TypeOf", "DirectCast", "TryCast", "Array",
  ]);
  let m;
  while ((m = identPattern.exec(expr)) !== null) {
    const name = m[1];
    if (vbKeywords.has(name)) continue;
    if (/^\d/.test(name)) continue;
    const beforeIdx = m.index - 1;
    if (beforeIdx >= 0 && expr[beforeIdx] === ".") continue;
    refs.push(name);
  }
  return Array.from(new Set(refs));
}

export function postEmissionInvokeValidator(
  entries: { name: string; content: string }[]
): ResidualExpressionSerializationDefect[] {
  const defects: ResidualExpressionSerializationDefect[] = [];

  for (const entry of entries) {
    const normalizedName = normalizeFilePath(entry.name);
    const workflowName = deriveWorkflowName(normalizedName);

    for (const invokeType of INVOKE_ACTIVITY_TYPES) {
      const nodes = findInvokeNodes(entry.content, invokeType);

      for (const node of nodes) {
        const openTagMatch = node.fullMatch.match(new RegExp(`^<(?:\\w+:)?${invokeType}\\b([^>]*?)(?:\\/>|>)`));
        if (!openTagMatch) continue;

        const attrs = openTagMatch[1];
        const rest = node.fullMatch.substring(openTagMatch[0].length);
        const attrPattern = /\b([a-zA-Z_]\w*)\s*=\s*"([^"]*)"/g;
        let am;

        const nonSystemAttrs: Array<{ name: string; value: string }> = [];
        while ((am = attrPattern.exec(attrs)) !== null) {
          const name = am[1];
          if (isSystemOrMetaAttr(name)) continue;
          nonSystemAttrs.push({ name, value: am[2] });
        }

        for (const attr of nonSystemAttrs) {
          if (PSEUDO_PROPERTY_NAMES.has(attr.name)) {
            defects.push({
              file: normalizedName,
              workflow: workflowName,
              activityType: invokeType,
              propertyName: attr.name,
              originalValue: attr.value.substring(0, 200),
              defectType: "invalid_invoke_serialization",
              severity: "handoff_required",
              rationale: `Post-canonicalization: pseudo-property "${attr.name}" still present on ${invokeType}`,
            });
          } else {
            defects.push({
              file: normalizedName,
              workflow: workflowName,
              activityType: invokeType,
              propertyName: attr.name,
              originalValue: attr.value.substring(0, 200),
              defectType: "invalid_invoke_serialization",
              severity: "handoff_required",
              rationale: `Post-canonicalization: attribute-style binding "${attr.name}" survived on ${invokeType} — should use canonical argument block form`,
            });
          }
        }

        const hasArgBlock = new RegExp(`<(?:\\w+:)?${invokeType}\\.Arguments>`).test(rest);
        if (nonSystemAttrs.length > 0 && hasArgBlock) {
          defects.push({
            file: normalizedName,
            workflow: workflowName,
            activityType: invokeType,
            propertyName: "Arguments",
            originalValue: nonSystemAttrs.map(a => a.name).join(", "),
            defectType: "invalid_invoke_serialization",
            severity: "handoff_required",
            rationale: `Post-canonicalization: both attribute-style bindings (${nonSystemAttrs.map(a => a.name).join(", ")}) and argument block coexist on ${invokeType}`,
          });
        }

        const argBlockMatch = rest.match(
          new RegExp(`<(?:\\w+:)?${invokeType}\\.Arguments>([\\s\\S]*?)<\\/(?:\\w+:)?${invokeType}\\.Arguments>`)
        );
        if (argBlockMatch) {
          const argKeys = new Map<string, number>();
          const keyPattern = /x:Key="([^"]+)"/g;
          let km;
          while ((km = keyPattern.exec(argBlockMatch[1])) !== null) {
            const key = km[1];
            argKeys.set(key, (argKeys.get(key) || 0) + 1);
          }
          for (const [key, count] of Array.from(argKeys.entries())) {
            if (count > 1) {
              defects.push({
                file: normalizedName,
                workflow: workflowName,
                activityType: invokeType,
                propertyName: key,
                originalValue: `${count} duplicate bindings for "${key}"`,
                defectType: "invalid_invoke_serialization",
                severity: "handoff_required",
                rationale: `Post-canonicalization: argument "${key}" appears ${count} times in argument block — conflicting serialization`,
              });
            }
          }
        }
      }
    }
  }

  return defects;
}
