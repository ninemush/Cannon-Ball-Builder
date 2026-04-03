import { escapeXml } from "../lib/xml-utils";
import { tryParseJsonValueIntent, buildExpression } from "./expression-builder";

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
  "targetfolder", "logmessage", "timeoutms",
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
  return `                <${dir} x:TypeArguments="x:Object" x:Key="${escapeXml(key)}">${escapeXml(val)}</${dir}>`;
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
              residualDefects.push({
                file: normalizedName,
                workflow: workflowName,
                activityType: invokeType,
                propertyName: name,
                originalValue: `attribute="${attrInfo.value}" vs body="${bodyValue}"`,
                defectType: "unresolvable_invoke_conflict",
                severity: "handoff_required",
                rationale: `Conflicting binding for "${name}" — attribute and body have different values, cannot deterministically resolve — both preserved for manual resolution`,
              });
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
        residualDefects.push({
          file: normalizedName,
          workflow: workflowName,
          activityType: activityContext,
          propertyName: propName,
          originalValue: originalValue.substring(0, 200),
          defectType: "json_expression_leak",
          severity: "execution_blocking",
          rationale: `Unresolvable JSON expression payload in ${propName} — manual remediation required`,
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
  const executableAttrPattern = /\b(Message|Condition|Value|To|Text|Expression|WorkflowFileName)\s*=\s*"([^"]+)"/g;
  let match;
  while ((match = executableAttrPattern.exec(content)) !== null) {
    const propName = match[1];
    const value = match[2];
    if (PLACEHOLDER_PATTERN.test(value)) {
      const activityContext = detectEnclosingActivity(content, match.index);
      residualDefects.push({
        file: normalizedName,
        workflow: workflowName,
        activityType: activityContext,
        propertyName: propName,
        originalValue: value.substring(0, 200),
        defectType: "placeholder_in_executable",
        severity: "handoff_required",
        rationale: `Placeholder sentinel in executable property ${propName} — requires business value`,
      });
    }
  }
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
