import { escapeXml } from "../lib/xml-utils";
import { XMLValidator } from "fast-xml-parser";
import type { DeploymentResult } from "@shared/models/deployment";

export type XamlGap = {
  category: "selector" | "credential" | "endpoint" | "logic" | "config" | "manual" | "agent";
  activity: string;
  description: string;
  placeholder: string;
  estimatedMinutes: number;
};

export type DhgDeploymentResult = DeploymentResult;

export function extractSystemFromGap(gap: XamlGap): string {
  const desc = (gap.description + " " + gap.placeholder).toLowerCase();
  if (desc.includes("sap")) return "SAP";
  if (desc.includes("salesforce") || desc.includes("sfdc")) return "Salesforce";
  if (desc.includes("servicenow") || desc.includes("snow")) return "ServiceNow";
  if (desc.includes("workday")) return "Workday";
  if (desc.includes("oracle")) return "Oracle";
  if (desc.includes("browser") || desc.includes("web") || desc.includes("chrome")) return "Web Browser";
  return "General";
}

export interface XamlValidationViolation {
  check: "placeholder" | "pseudo-xaml" | "invoked-file" | "malformed-quote" | "duplicate-file" | "xml-wellformedness";
  file: string;
  detail: string;
}

export function validateXamlContent(xamlEntries: { name: string; content: string }[]): XamlValidationViolation[] {
  const violations: XamlValidationViolation[] = [];
  const fileNames = new Set(xamlEntries.map(e => {
    const parts = e.name.split("/");
    return parts[parts.length - 1];
  }));

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;

    if (content.includes("[object Object]")) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("[object Object]")) {
          violations.push({
            check: "placeholder",
            file: shortName,
            detail: `Line ${i + 1}: contains "[object Object]"`,
          });
        }
      }
    }

    const ellipsisAttrPattern = /(\w+)="\.\.\."/g;
    let match;
    while ((match = ellipsisAttrPattern.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split("\n").length;
      violations.push({
        check: "placeholder",
        file: shortName,
        detail: `Line ${lineNum}: attribute ${match[1]}="..." contains placeholder ellipsis`,
      });
    }

    const pseudoXamlPattern = /\b(Then|Else|Cases|Body|Finally|Try)="([^"]*)"/g;
    while ((match = pseudoXamlPattern.exec(content)) !== null) {
      const attrName = match[1];
      const attrValue = match[2];
      const contextBefore = content.substring(Math.max(0, match.index - 80), match.index);
      const isInChildElement = /\.\s*$/.test(contextBefore.trimEnd()) ||
        contextBefore.includes(`<If.${attrName}`) ||
        contextBefore.includes(`<Switch.${attrName}`) ||
        contextBefore.includes(`<TryCatch.${attrName}`) ||
        contextBefore.includes(`<ForEach.${attrName}`) ||
        contextBefore.includes(`<Sequence.${attrName}`);
      if (isInChildElement) continue;
      const isPartOfDisplayName = new RegExp(`DisplayName="[^"]*$`).test(contextBefore);
      if (isPartOfDisplayName) continue;
      if (attrValue.length > 0 && attrValue !== "True" && attrValue !== "False") {
        const lineNum = content.substring(0, match.index).split("\n").length;
        const parentTag = attrName === "Cases" ? "Switch" : attrName === "Finally" ? "TryCatch" : attrName === "Body" ? "Activity" : "If";
        violations.push({
          check: "pseudo-xaml",
          file: shortName,
          detail: `Line ${lineNum}: pseudo-XAML attribute ${attrName}="${attrValue.substring(0, 80)}${attrValue.length > 80 ? "..." : ""}" — should use nested <${parentTag}.${attrName}> child element`,
        });
      }
    }

    const invokePattern = /WorkflowFileName="([^"]+)"/g;
    while ((match = invokePattern.exec(content)) !== null) {
      const invokedFile = match[1];
      if (!fileNames.has(invokedFile)) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          check: "invoked-file",
          file: shortName,
          detail: `Line ${lineNum}: InvokeWorkflowFile references "${invokedFile}" which does not exist in the package`,
        });
      }
    }

    const contentLines = content.split("\n");
    for (let lineIdx = 0; lineIdx < contentLines.length; lineIdx++) {
      const line = contentLines[lineIdx];
      const attrPattern = /(\w[\w:.]*)\s*=\s*"/g;
      let attrMatch;
      while ((attrMatch = attrPattern.exec(line)) !== null) {
        const attrName = attrMatch[1];
        const valueStart = attrMatch.index + attrMatch[0].length;
        const closingQuote = line.indexOf('"', valueStart);
        if (closingQuote < 0) continue;
        const attrValue = line.substring(valueStart, closingQuote);
        if (attrName === "Selector") continue;
        const withoutEntities = attrValue
          .replace(/&quot;/g, "")
          .replace(/&apos;/g, "")
          .replace(/&amp;/g, "")
          .replace(/&lt;/g, "")
          .replace(/&gt;/g, "");
        const isVbStringLiteral = /^'.*'$/.test(withoutEntities.trim());
        if (isVbStringLiteral) continue;
        const isVbExprWithStrings = /^\[.*\]$/.test(withoutEntities.trim());
        if (isVbExprWithStrings) continue;
        const startsWithQuote = /^['"]/.test(withoutEntities.trim());
        if (startsWithQuote) continue;
        if (withoutEntities.includes("'") || withoutEntities.includes('"')) {
          violations.push({
            check: "malformed-quote",
            file: shortName,
            detail: `Line ${lineIdx + 1}: attribute ${attrName} contains raw quote character mid-value`,
          });
        }
      }
    }

    try {
      const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
      const xmlContent = content.startsWith("<?xml") ? content : xmlHeader + "\n" + content;
      const result = XMLValidator.validate(xmlContent, { allowBooleanAttributes: true });
      if (result !== true) {
        const err = result.err;
        const detail = err
          ? `XML parse error at line ${err.line}, col ${err.col}: ${err.msg.substring(0, 200)}`
          : "XML parse error: unknown";
        console.warn(`[XAML wellformedness] Validation failed for ${shortName}: ${detail}\nFull XAML content:\n${content}`);
        violations.push({
          check: "xml-wellformedness",
          file: shortName,
          detail,
        });
      }
    } catch (xmlParseErr: any) {
      console.warn(`[XAML wellformedness] Parse exception for ${shortName}: ${xmlParseErr.message || String(xmlParseErr)}\nFull XAML content:\n${content}`);
      violations.push({
        check: "xml-wellformedness",
        file: shortName,
        detail: `XML parse exception: ${xmlParseErr.message?.substring(0, 200) || String(xmlParseErr)}`,
      });
    }
  }

  const fileNameCounts = new Map<string, string[]>();
  for (const entry of xamlEntries) {
    const basename = entry.name.split("/").pop() || entry.name;
    if (!fileNameCounts.has(basename)) {
      fileNameCounts.set(basename, []);
    }
    fileNameCounts.get(basename)!.push(entry.name);
  }
  fileNameCounts.forEach((paths, basename) => {
    if (paths.length > 1) {
      violations.push({
        check: "duplicate-file",
        file: basename,
        detail: `Duplicate XAML file "${basename}" found in multiple locations: ${paths.join(", ")}`,
      });
    }
  });

  return violations;
}

export interface ActivityStubResult {
  content: string;
  replaced: boolean;
  originalTag?: string;
  originalDisplayName?: string;
}

export function replaceActivityWithStub(
  xamlContent: string,
  classifiedIssue: { file: string; check: string; detail: string },
): ActivityStubResult {
  const lineMatch = classifiedIssue.detail.match(/Line (\d+)/);
  if (!lineMatch) {
    return { content: xamlContent, replaced: false };
  }

  const targetLineNum = parseInt(lineMatch[1], 10);
  const lines = xamlContent.split("\n");
  if (targetLineNum < 1 || targetLineNum > lines.length) {
    return { content: xamlContent, replaced: false };
  }

  const targetLine = lines[targetLineNum - 1];

  const activityTagMatch = targetLine.match(/<((?:ui:)?[A-Z][A-Za-z]*)\s/);
  if (!activityTagMatch) {
    const contextWindow = 5;
    for (let offset = 1; offset <= contextWindow; offset++) {
      for (const dir of [-1, 1]) {
        const checkIdx = targetLineNum - 1 + (dir * offset);
        if (checkIdx >= 0 && checkIdx < lines.length) {
          const checkLine = lines[checkIdx];
          const match = checkLine.match(/<((?:ui:)?[A-Z][A-Za-z]*)\s/);
          if (match) {
            return replaceActivityAtLine(xamlContent, lines, checkIdx, match[1], classifiedIssue);
          }
        }
      }
    }
    return { content: xamlContent, replaced: false };
  }

  return replaceActivityAtLine(xamlContent, lines, targetLineNum - 1, activityTagMatch[1], classifiedIssue);
}

function replaceActivityAtLine(
  xamlContent: string,
  lines: string[],
  lineIdx: number,
  tagName: string,
  classifiedIssue: { check: string; detail: string },
): ActivityStubResult {
  const displayNameMatch = lines[lineIdx].match(/DisplayName="([^"]*)"/);
  const originalDisplayName = displayNameMatch ? displayNameMatch[1] : undefined;
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const isSelfClosing = /\/>\s*$/.test(lines[lineIdx]);
  let startLine = lineIdx;
  let endLine = lineIdx;

  if (isSelfClosing) {
    if (lineIdx > 0 && !lines[lineIdx - 1].match(/</) && lines[lineIdx - 1].trim()) {
      let tmpLine = lineIdx;
      while (tmpLine > 0 && !lines[tmpLine].match(new RegExp(`<${escapedTag}\\s`))) {
        tmpLine--;
      }
      if (lines[tmpLine].match(new RegExp(`<${escapedTag}\\s`))) {
        startLine = tmpLine;
      }
    }
  } else {
    const closingTag = `</${tagName}>`;
    let depth = 0;
    let foundOpen = false;

    let tmpLine = lineIdx;
    while (tmpLine >= 0 && !lines[tmpLine].match(new RegExp(`<${escapedTag}[\\s>]`))) {
      tmpLine--;
    }
    if (tmpLine >= 0) startLine = tmpLine;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const opens = (line.match(new RegExp(`<${escapedTag}[\\s>]`, 'g')) || []).length;
      const closes = (line.match(new RegExp(`</${escapedTag}>`, 'g')) || []).length;
      const selfCloses = (line.match(new RegExp(`<${escapedTag}[^>]*/\\s*>`, 'g')) || []).length;

      depth += opens - selfCloses;
      if (opens > 0) foundOpen = true;
      depth -= closes;

      if (foundOpen && depth <= 0) {
        endLine = i;
        break;
      }

      if (i - startLine > 200) {
        return { content: xamlContent, replaced: false };
      }
    }
  }

  const indent = lines[startLine].match(/^(\s*)/)?.[1] || "    ";
  const stubComment = `${indent}<ui:Comment Text="${escapeXml(`[STUB_ACTIVITY] Original: ${tagName}${originalDisplayName ? ` (${originalDisplayName})` : ''}. Reason: ${classifiedIssue.check} — ${classifiedIssue.detail}`)}" DisplayName="${escapeXml(`Stub: ${originalDisplayName || tagName}`)}" />`;

  const newLines = [
    ...lines.slice(0, startLine),
    stubComment,
    ...lines.slice(endLine + 1),
  ];

  return {
    content: newLines.join("\n"),
    replaced: true,
    originalTag: tagName,
    originalDisplayName,
  };
}

export interface SequenceStubResult {
  content: string;
  replaced: boolean;
  sequenceDisplayName?: string;
  replacedActivityCount: number;
}

export function replaceSequenceChildrenWithStub(
  xamlContent: string,
  failingIssues: Array<{ file: string; check: string; detail: string }>,
): SequenceStubResult {
  const failingLines = new Set<number>();
  for (const issue of failingIssues) {
    const lineMatch = issue.detail.match(/Line (\d+)/);
    if (lineMatch) failingLines.add(parseInt(lineMatch[1], 10));
  }

  if (failingLines.size === 0) {
    return { content: xamlContent, replaced: false, replacedActivityCount: 0 };
  }

  const lines = xamlContent.split("\n");

  const sequenceRanges: Array<{
    seqStart: number;
    seqEnd: number;
    displayName: string;
    childStart: number;
    childEnd: number;
  }> = [];

  for (let i = 0; i < lines.length; i++) {
    const seqMatch = lines[i].match(/<Sequence\s[^>]*DisplayName="([^"]*)"[^>]*>/);
    if (!seqMatch) continue;
    if (/\/>\s*$/.test(lines[i])) continue;

    const seqStart = i;
    const displayName = seqMatch[1];
    let depth = 1;
    let seqEnd = i;

    for (let j = i + 1; j < lines.length; j++) {
      if (/<Sequence[\s>]/.test(lines[j]) && !/\/>\s*$/.test(lines[j])) depth++;
      if (/<\/Sequence>/.test(lines[j])) depth--;
      if (depth === 0) {
        seqEnd = j;
        break;
      }
    }

    let childStart = seqStart + 1;
    let inVariablesBlock = false;
    while (childStart < seqEnd) {
      const currentLine = lines[childStart];
      const lineTrimmed = currentLine.trim();
      if (lineTrimmed === "") {
        childStart++;
        continue;
      }
      if (currentLine.includes("<Sequence.Variables")) {
        if (/\/>\s*$/.test(currentLine) || currentLine.includes("</Sequence.Variables")) {
          childStart++;
          continue;
        }
        inVariablesBlock = true;
        childStart++;
        continue;
      }
      if (currentLine.includes("</Sequence.Variables")) {
        inVariablesBlock = false;
        childStart++;
        continue;
      }
      if (inVariablesBlock) {
        childStart++;
        continue;
      }
      break;
    }

    sequenceRanges.push({ seqStart, seqEnd, displayName, childStart, childEnd: seqEnd });
  }

  for (const range of sequenceRanges) {
    let failingCount = 0;
    for (const lineNum of failingLines) {
      if (lineNum > range.childStart && lineNum < range.childEnd) {
        failingCount++;
      }
    }

    if (failingCount >= 2) {
      const indent = lines[range.childStart].match(/^(\s*)/)?.[1] || "      ";
      const checks = failingIssues.map(i => i.check).filter((v, idx, arr) => arr.indexOf(v) === idx).join(", ");
      const stubLine = `${indent}<ui:Comment Text="[STUB_SEQUENCE] Replaced ${failingCount} invalid activities in sequence '${escapeXml(range.displayName)}'. Checks: ${escapeXml(checks)}. Manual implementation required." DisplayName="Stub: ${escapeXml(range.displayName)} children" />`;

      const newLines = [
        ...lines.slice(0, range.childStart),
        stubLine,
        ...lines.slice(range.childEnd),
      ];

      return {
        content: newLines.join("\n"),
        replaced: true,
        sequenceDisplayName: range.displayName,
        replacedActivityCount: failingCount,
      };
    }
  }

  return { content: xamlContent, replaced: false, replacedActivityCount: 0 };
}

export interface StubWorkflowOptions {
  arguments?: Array<{ name: string; direction: string; type: string }>;
  variables?: Array<{ name: string; type: string; defaultValue?: string }>;
  reason?: string;
  isBlockingFallback?: boolean;
  invokeWorkflows?: Array<{ displayName: string; fileName: string }>;
}

export function generateStubWorkflow(fileName: string, options?: StubWorkflowOptions): string {
  const className = fileName.replace(/\.xaml$/i, "").replace(/[^A-Za-z0-9_]/g, "_");
  const reason = options?.reason || "this workflow was auto-generated as a placeholder because it is referenced by InvokeWorkflowFile but was not part of the original process map";
  const stubLabel = options?.isBlockingFallback ? "STUB_BLOCKING_FALLBACK" : "STUB";

  let argumentProps = "";
  if (options?.arguments?.length) {
    argumentProps = "\n  <x:Members>\n";
    for (const arg of options.arguments) {
      const dir = arg.direction === "OutArgument" ? "OutArgument" : arg.direction === "InOutArgument" ? "InOutArgument" : "InArgument";
      argumentProps += `    <x:Property Name="${escapeXml(arg.name)}" Type="${dir}(${escapeXml(arg.type)})" />\n`;
    }
    argumentProps += "  </x:Members>";
  }

  let variableDecls = "";
  if (options?.variables?.length) {
    variableDecls = "\n    <Sequence.Variables>\n";
    for (const v of options.variables) {
      const defVal = v.defaultValue ? ` Default="${escapeXml(v.defaultValue)}"` : "";
      variableDecls += `      <Variable x:TypeArguments="${escapeXml(v.type)}" Name="${escapeXml(v.name)}"${defVal} />\n`;
    }
    variableDecls += "    </Sequence.Variables>";
  } else {
    variableDecls = "\n    <Sequence.Variables />";
  }

  let invokeBlock = "";
  if (options?.invokeWorkflows?.length) {
    invokeBlock = "\n" + options.invokeWorkflows.map(wf =>
      `    <ui:InvokeWorkflowFile DisplayName="${escapeXml(wf.displayName)}" WorkflowFileName="${escapeXml(wf.fileName)}" />`
    ).join("\n");
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${className}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">${argumentProps}
  <Sequence DisplayName="${escapeXml(className)}">${variableDecls}
    <ui:LogMessage Level="Warn" Message="[&quot;${stubLabel}: ${escapeXml(className)} — ${escapeXml(reason)}. Implement the actual logic here.&quot;]" DisplayName="Stub Warning: ${escapeXml(className)}" />${invokeBlock}
  </Sequence>
</Activity>`;
}

export interface StructuralPreservationResult {
  content: string;
  preserved: boolean;
  parseableXml: boolean;
  totalActivities: number;
  preservedActivities: number;
  stubbedActivities: number;
  stubbedDetails: Array<{
    tag: string;
    displayName?: string;
    reason: string;
    check: string;
  }>;
  preservedStructures: string[];
}

const STRUCTURAL_ELEMENTS = new Set([
  "Sequence", "If", "TryCatch", "ForEach", "While", "DoWhile",
  "Switch", "Flowchart", "FlowDecision", "FlowSwitch", "FlowStep",
  "Parallel", "ParallelForEach", "Pick", "PickBranch",
]);

const STRUCTURAL_CHILD_ELEMENTS = new Set([
  "If.Then", "If.Else", "TryCatch.Try", "TryCatch.Catches", "TryCatch.Finally",
  "Catch", "ForEach.Body", "While.Body", "DoWhile.Body",
  "Switch.Default", "Flowchart.StartNode", "ActivityAction",
  "Sequence.Variables", "Activity",
]);

function isStructuralTag(tag: string): boolean {
  const bare = tag.replace(/^ui:/, "");
  return STRUCTURAL_ELEMENTS.has(bare) || STRUCTURAL_CHILD_ELEMENTS.has(bare);
}

function isInvokeTag(tag: string): boolean {
  return tag === "ui:InvokeWorkflowFile" || tag === "InvokeWorkflowFile";
}

function isVariableOrArgumentDecl(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("<Variable ") ||
    trimmed.startsWith("<Variable>") ||
    trimmed.startsWith("</Variable>") ||
    trimmed.startsWith("<x:Property ") ||
    trimmed.startsWith("<x:Members") ||
    trimmed.startsWith("</x:Members") ||
    trimmed.startsWith("<Sequence.Variables") ||
    trimmed.startsWith("</Sequence.Variables");
}

function countActivities(xamlContent: string): number {
  const activityPattern = /<((?:ui:)?[A-Z][A-Za-z]*)\s/g;
  let count = 0;
  let match;
  while ((match = activityPattern.exec(xamlContent)) !== null) {
    const tag = match[1];
    if (!isStructuralTag(tag) && tag !== "Activity" && !tag.startsWith("x:") && tag !== "Variable") {
      count++;
    }
  }
  return count;
}

export function preserveStructureAndStubLeaves(
  xamlContent: string,
  blockingIssues: Array<{ file: string; check: string; detail: string }>,
  options?: { isMainXaml?: boolean },
): StructuralPreservationResult {
  const unparseableResult: StructuralPreservationResult = {
    content: xamlContent,
    preserved: false,
    parseableXml: false,
    totalActivities: 0,
    preservedActivities: 0,
    stubbedActivities: 0,
    stubbedDetails: [],
    preservedStructures: [],
  };

  try {
    const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
    const xmlContent = xamlContent.startsWith("<?xml") ? xamlContent : xmlHeader + "\n" + xamlContent;
    const validationResult = XMLValidator.validate(xmlContent, { allowBooleanAttributes: true });
    if (validationResult !== true) {
      return unparseableResult;
    }
  } catch {
    return unparseableResult;
  }

  const totalActivities = countActivities(xamlContent);

  const failingLineNumbers = new Set<number>();
  const issuesByLine = new Map<number, { check: string; detail: string }>();
  for (const issue of blockingIssues) {
    const lineMatch = issue.detail.match(/Line (\d+)/);
    if (lineMatch) {
      const lineNum = parseInt(lineMatch[1], 10);
      failingLineNumbers.add(lineNum);
      issuesByLine.set(lineNum, { check: issue.check, detail: issue.detail });
    }
  }

  const failingDisplayNames = new Set<string>();
  for (const issue of blockingIssues) {
    const dnMatch = issue.detail.match(/DisplayName="([^"]+)"/);
    if (dnMatch) failingDisplayNames.add(dnMatch[1]);
    const actLabel = issue.detail.match(/activity "([^"]+)"/i);
    if (actLabel) failingDisplayNames.add(actLabel[1]);
  }

  const lines = xamlContent.split("\n");
  const linesToStub: Array<{
    startLine: number;
    endLine: number;
    tag: string;
    displayName?: string;
    check: string;
    detail: string;
  }> = [];

  const preservedStructures: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const dottedMatch = trimmed.match(/^<((?:ui:)?[A-Z][A-Za-z]*\.[A-Za-z]+)/);
    if (dottedMatch) {
      const dottedTag = dottedMatch[1].replace(/^ui:/, "");
      if (STRUCTURAL_CHILD_ELEMENTS.has(dottedTag)) {
        preservedStructures.push(dottedTag);
      }
      continue;
    }

    if (trimmed.startsWith("</")) continue;

    const tagMatch = line.match(/<((?:ui:)?[A-Z][A-Za-z]*)[\s>\/]/);
    if (!tagMatch) continue;

    const tag = tagMatch[1];

    if (isStructuralTag(tag)) {
      const dnMatch = line.match(/DisplayName="([^"]*)"/);
      preservedStructures.push(tag + (dnMatch ? ` (${dnMatch[1]})` : ""));
      continue;
    }

    if (isVariableOrArgumentDecl(line)) continue;

    if (isInvokeTag(tag)) {
      continue;
    }

    const lineNum = i + 1;
    let isBlocking = false;
    let matchedCheck = "";
    let matchedDetail = "";

    if (failingLineNumbers.has(lineNum)) {
      isBlocking = true;
      const issueInfo = issuesByLine.get(lineNum);
      matchedCheck = issueInfo?.check || "unknown";
      matchedDetail = issueInfo?.detail || "";
    }

    if (!isBlocking) {
      const contextWindow = 3;
      for (let offset = 1; offset <= contextWindow; offset++) {
        if (failingLineNumbers.has(lineNum + offset) || failingLineNumbers.has(lineNum - offset)) {
          const nearLine = failingLineNumbers.has(lineNum + offset) ? lineNum + offset : lineNum - offset;
          const issueInfo = issuesByLine.get(nearLine);
          if (issueInfo) {
            const nearLineContent = lines[nearLine - 1] || "";
            const nearTag = nearLineContent.match(/<((?:ui:)?[A-Z][A-Za-z]*)\s/);
            if (!nearTag) {
              isBlocking = true;
              matchedCheck = issueInfo.check;
              matchedDetail = issueInfo.detail;
              break;
            }
          }
        }
      }
    }

    if (!isBlocking) {
      const dnMatch = line.match(/DisplayName="([^"]*)"/);
      if (dnMatch && failingDisplayNames.has(dnMatch[1])) {
        isBlocking = true;
        matchedCheck = "display-name-match";
        matchedDetail = `Activity "${dnMatch[1]}" matched by display name`;
      }
    }

    if (!isBlocking) continue;

    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isSelfClosing = /\/>\s*$/.test(line);
    let startLine = i;
    let endLine = i;

    if (isSelfClosing) {
      let tmpLine = i;
      while (tmpLine > 0 && !lines[tmpLine].match(new RegExp(`<${escapedTag}\\s`))) {
        tmpLine--;
      }
      if (lines[tmpLine].match(new RegExp(`<${escapedTag}\\s`))) {
        startLine = tmpLine;
      }
    } else {
      let tmpLine = i;
      while (tmpLine >= 0 && !lines[tmpLine].match(new RegExp(`<${escapedTag}[\\s>]`))) {
        tmpLine--;
      }
      if (tmpLine >= 0) startLine = tmpLine;

      let depth = 0;
      let foundOpen = false;
      for (let j = startLine; j < lines.length; j++) {
        const l = lines[j];
        const opens = (l.match(new RegExp(`<${escapedTag}[\\s>]`, 'g')) || []).length;
        const closes = (l.match(new RegExp(`</${escapedTag}>`, 'g')) || []).length;
        const selfCloses = (l.match(new RegExp(`<${escapedTag}[^>]*/\\s*>`, 'g')) || []).length;
        depth += opens - selfCloses;
        if (opens > 0) foundOpen = true;
        depth -= closes;
        if (foundOpen && depth <= 0) {
          endLine = j;
          break;
        }
        if (j - startLine > 200) {
          endLine = j;
          break;
        }
      }
    }

    const displayNameMatch = lines[startLine].match(/DisplayName="([^"]*)"/);
    linesToStub.push({
      startLine,
      endLine,
      tag,
      displayName: displayNameMatch?.[1],
      check: matchedCheck,
      detail: matchedDetail,
    });
  }

  if (linesToStub.length === 0) {
    return {
      content: xamlContent,
      preserved: blockingIssues.length === 0,
      parseableXml: true,
      totalActivities,
      preservedActivities: totalActivities,
      stubbedActivities: 0,
      stubbedDetails: [],
      preservedStructures: [...new Set(preservedStructures)],
    };
  }

  const sortedStubs = [...linesToStub].sort((a, b) => b.startLine - a.startLine);

  const seen = new Set<number>();
  const deduped = sortedStubs.filter(s => {
    if (seen.has(s.startLine)) return false;
    seen.add(s.startLine);
    return true;
  });

  let result = [...lines];
  const stubbedDetails: StructuralPreservationResult["stubbedDetails"] = [];

  for (const stub of deduped) {
    const indent = result[stub.startLine].match(/^(\s*)/)?.[1] || "    ";
    const stubComment = `${indent}<ui:Comment Text="${escapeXml(`[STUB_STRUCTURAL_LEAF] Original: ${stub.tag}${stub.displayName ? ` (${stub.displayName})` : ''}. Check: ${stub.check} — ${stub.detail}`)}" DisplayName="${escapeXml(`Stub: ${stub.displayName || stub.tag}`)}" />`;

    result = [
      ...result.slice(0, stub.startLine),
      stubComment,
      ...result.slice(stub.endLine + 1),
    ];

    stubbedDetails.push({
      tag: stub.tag,
      displayName: stub.displayName,
      reason: stub.detail,
      check: stub.check,
    });
  }

  const stubbedCount = deduped.length;
  const preservedCount = Math.max(0, totalActivities - stubbedCount);

  const finalContent = result.join("\n");

  try {
    const xmlHeader = '<?xml version="1.0" encoding="utf-8"?>';
    const xmlToValidate = finalContent.startsWith("<?xml") ? finalContent : xmlHeader + "\n" + finalContent;
    const postValidation = XMLValidator.validate(xmlToValidate, { allowBooleanAttributes: true });
    if (postValidation !== true) {
      return {
        content: xamlContent,
        preserved: false,
        parseableXml: true,
        totalActivities,
        preservedActivities: totalActivities,
        stubbedActivities: 0,
        stubbedDetails: [],
        preservedStructures: [...new Set(preservedStructures)],
      };
    }
  } catch {
    return {
      content: xamlContent,
      preserved: false,
      parseableXml: true,
      totalActivities,
      preservedActivities: totalActivities,
      stubbedActivities: 0,
      stubbedDetails: [],
      preservedStructures: [...new Set(preservedStructures)],
    };
  }

  return {
    content: finalContent,
    preserved: true,
    parseableXml: true,
    totalActivities,
    preservedActivities: preservedCount,
    stubbedActivities: stubbedCount,
    stubbedDetails,
    preservedStructures: [...new Set(preservedStructures)],
  };
}

export function generateDhgSummary(gaps: XamlGap[], deploymentResults?: DhgDeploymentResult[]): string {
  const selectorCount = gaps.filter((g) => g.category === "selector").length;
  const credentialCount = gaps.filter((g) => g.category === "credential").length;
  const endpointCount = gaps.filter((g) => g.category === "endpoint").length;
  const configCount = gaps.filter((g) => g.category === "config").length;
  const logicCount = gaps.filter((g) => g.category === "logic").length;
  const manualCount = gaps.filter((g) => g.category === "manual").length;
  const agentCount = gaps.filter((g) => g.category === "agent").length;
  const totalMinutes = gaps.reduce((sum, g) => sum + g.estimatedMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const lines: string[] = [
    `Enhanced Developer Handoff Summary (${gaps.length} XAML items, ~${totalHours}h XAML effort):`,
  ];

  if (selectorCount > 0) lines.push(`  - ${selectorCount} UI selector(s) to capture`);
  if (credentialCount > 0) lines.push(`  - ${credentialCount} credential/asset(s) to configure`);
  if (endpointCount > 0) lines.push(`  - ${endpointCount} integration endpoint(s) to set`);
  if (configCount > 0) lines.push(`  - ${configCount} configuration value(s) to update`);
  if (logicCount > 0) lines.push(`  - ${logicCount} business logic gap(s) to implement`);
  if (manualCount > 0) lines.push(`  - ${manualCount} manual step(s) to complete`);
  if (agentCount > 0) lines.push(`  - ${agentCount} agent invocation(s) to configure`);

  if (deploymentResults?.length) {
    const failed = deploymentResults.filter(r => r.status === "failed" || r.status === "manual");
    const created = deploymentResults.filter(r => r.status === "created" || r.status === "exists" || r.status === "updated" || r.status === "in_package");
    lines.push(`  Orchestrator: ${created.length}/${deploymentResults.length} artifacts provisioned`);
    if (failed.length > 0) {
      lines.push(`  ${failed.length} artifact(s) need manual setup — see DHG for details`);
    }
  }

  lines.push(`See DeveloperHandoffGuide.md in the package for full details (covers all 14 artifact types).`);

  return lines.join("\n");
}
