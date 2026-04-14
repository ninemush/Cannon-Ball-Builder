import { catalogService } from "./catalog/catalog-service";
import { validateXmlWellFormedness, GUARANTEED_ACTIVITY_PREFIX_MAP } from "./xaml/xaml-compliance";
import type { PackageNamespaceInfo } from "./xaml/xaml-compliance";
import { escapeXml, getAttributeSerializerDiagnostics, resetAttributeSerializerDiagnostics, detectRawAmpersands } from "./lib/xml-utils";
import type { WorkflowBusinessContextMap } from "./sdd-business-context-mapper";
import { formatBusinessContextForHandoff } from "./sdd-business-context-mapper";

export interface CriticalTypeDiagnostic {
  inputType: string;
  resolvedType: string;
  reason: string;
  context: "critical";
  source: string;
}

const criticalTypeDiagnostics: CriticalTypeDiagnostic[] = [];

export function reportCriticalTypeDiagnostic(diag: CriticalTypeDiagnostic): void {
  criticalTypeDiagnostics.push(diag);
}

export function drainCriticalTypeDiagnostics(): CriticalTypeDiagnostic[] {
  return criticalTypeDiagnostics.splice(0);
}

export type EmissionGateMode = "strict" | "baseline";

export interface EmissionViolation {
  file: string;
  line?: number;
  type: "unapproved-activity" | "malformed-type" | "sentinel-expression";
  detail: string;
  resolution: "stubbed" | "corrected" | "blocked" | "degraded";
  context?: string;
  containingBlockType?: string;
  containedActivities?: string[];
  isIntegrityFailure?: boolean;
}

export interface EmissionGateResult {
  violations: EmissionViolation[];
  blocked: boolean;
  summary: {
    totalViolations: number;
    stubbed: number;
    corrected: number;
    blocked: number;
    degraded: number;
  };
  attributeSerializerDiagnostics?: {
    calls: number;
    corrections: number;
    bypassAttempts: string[];
  };
}

const CONTROL_FLOW_CONTAINERS = new Set([
  "If", "Switch", "While", "DoWhile", "ForEach", "Flowchart",
  "FlowStep", "FlowDecision", "FlowSwitch",
]);

const RETRY_LOOP_CONTAINERS = new Set([
  "RetryScope", "TryCatch",
]);

const INDIVISIBLE_BUSINESS_CONTAINERS = new Set([
  "RetryScope", "TryCatch",
]);

const ORCHESTRATION_NODES = new Set([
  "InvokeWorkflowFile", "GetTransactionItem", "SetTransactionStatus",
]);

const SYSTEM_ACTIVITIES_NO_PREFIX = new Set([
  "Assign", "If", "TryCatch", "Sequence", "Delay", "Throw", "While", "DoWhile",
  "ForEach", "Flowchart", "FlowStep", "FlowDecision", "FlowSwitch", "Switch",
  "AddToCollection", "RemoveFromCollection", "ClearCollection", "ExistsInCollection",
  "Catch", "Rethrow", "State", "StateMachine", "Transition",
  "RetryScope", "ShouldRetry",
]);

const XML_INFRASTRUCTURE_TAGS = new Set([
  "Activity", "Sequence", "Variable", "Members", "Property", "DynamicActivity",
  "TextExpression", "Literal", "Reference", "InArgument", "OutArgument", "InOutArgument",
  "VisualBasicValue", "VisualBasicReference", "VisualBasic",
  "Assign", "If", "TryCatch", "Catch", "Rethrow", "Throw",
  "While", "DoWhile", "ForEach", "Flowchart", "FlowStep", "FlowDecision", "FlowSwitch",
  "Switch", "Delay", "Sequence", "State", "StateMachine", "Transition",
  "AddToCollection", "RemoveFromCollection", "ClearCollection", "ExistsInCollection",
  "RetryScope", "ShouldRetry",
  "CSharpValue", "CSharpReference",
  "ActivityAction", "DelegateInArgument", "DelegateOutArgument",
  "ArgumentValue", "VariableValue", "VariableReference",
  "AssemblyReference", "Collection",
]);

const SENTINEL_PATTERNS = /\b(HANDOFF_\w+|STUB_\w+|ASSEMBLY_FAILED\w*|__BLOCKED_\w+|PLACEHOLDER_\w+)\b/;

function findLineNumber(content: string, charIndex: number): number {
  let line = 1;
  for (let i = 0; i < charIndex && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function isInsideControlFlowOrRetryContainer(content: string, matchIndex: number): boolean {
  const before = content.substring(0, matchIndex);

  const containerNames = [...CONTROL_FLOW_CONTAINERS, ...RETRY_LOOP_CONTAINERS];
  for (const container of containerNames) {
    const openPattern = new RegExp(`<${container}[\\s>]`, "g");
    const closePattern = new RegExp(`</${container}>`, "g");

    let openCount = 0;
    let m;
    while ((m = openPattern.exec(before)) !== null) openCount++;
    while ((m = closePattern.exec(before)) !== null) openCount--;
    if (openCount > 0) return true;
  }

  for (const container of containerNames) {
    const prefixedOpenPattern = new RegExp(`<\\w+:${container}[\\s>]`, "g");
    const prefixedClosePattern = new RegExp(`</\\w+:${container}>`, "g");

    let openCount = 0;
    let m;
    while ((m = prefixedOpenPattern.exec(before)) !== null) openCount++;
    while ((m = prefixedClosePattern.exec(before)) !== null) openCount--;
    if (openCount > 0) return true;
  }

  return false;
}

function isOrchestrationNode(activityName: string): boolean {
  return ORCHESTRATION_NODES.has(activityName);
}

function findInnermostContainingBlock(
  content: string,
  matchIndex: number,
): { start: number; end: number; blockType: string; prefix: string } | null {
  const ALL_CONTAINER_NAMES = [...CONTROL_FLOW_CONTAINERS, ...RETRY_LOOP_CONTAINERS];
  let best: { start: number; end: number; blockType: string; prefix: string } | null = null;

  for (const container of ALL_CONTAINER_NAMES) {
    const openPatterns = [
      new RegExp(`<(${container})[\\s>]`, "g"),
      new RegExp(`<(\\w+):(${container})[\\s>]`, "g"),
    ];

    for (const openPattern of openPatterns) {
      let m;
      while ((m = openPattern.exec(content)) !== null) {
        if (m.index >= matchIndex) continue;

        const isPrefixed = openPattern.source.includes("\\w+");
        const tagPrefix = isPrefixed ? m[1] + ":" : "";
        const tagName = isPrefixed ? m[2] : m[1];
        const blockStart = m.index;

        let depth = 1;
        const closeTagStr = `</${tagPrefix}${tagName}>`;
        const openTagPattern = new RegExp(`<${tagPrefix.replace(/([.*+?^${}()|[\]\\])/g, '\\$1')}${tagName}[\\s>]`, "g");
        const closeTagPattern = new RegExp(`</${tagPrefix.replace(/([.*+?^${}()|[\]\\])/g, '\\$1')}${tagName}>`, "g");

        openTagPattern.lastIndex = m.index + m[0].length;
        closeTagPattern.lastIndex = m.index + m[0].length;

        let blockEnd = -1;
        let searchPos = m.index + m[0].length;

        while (searchPos < content.length) {
          const nextOpenIdx = content.indexOf(`<${tagPrefix}${tagName}`, searchPos);
          const nextCloseIdx = content.indexOf(closeTagStr, searchPos);

          if (nextCloseIdx === -1) break;

          if (nextOpenIdx !== -1 && nextOpenIdx < nextCloseIdx) {
            const charAfter = content[nextOpenIdx + tagPrefix.length + tagName.length + 1];
            if (charAfter === ' ' || charAfter === '>' || charAfter === '/' || charAfter === '\n' || charAfter === '\r' || charAfter === '\t') {
              depth++;
            }
            searchPos = nextOpenIdx + 1;
          } else {
            depth--;
            if (depth === 0) {
              blockEnd = nextCloseIdx + closeTagStr.length;
              break;
            }
            searchPos = nextCloseIdx + closeTagStr.length;
          }
        }

        if (blockEnd === -1) continue;
        if (matchIndex < blockStart || matchIndex >= blockEnd) continue;

        if (best === null || (blockEnd - blockStart) < (best.end - best.start)) {
          best = { start: blockStart, end: blockEnd, blockType: tagName, prefix: tagPrefix };
        }
      }
    }
  }

  return best;
}

function listActivitiesInBlock(blockContent: string): string[] {
  const activities: string[] = [];
  const tagPattern = /<(\w+:)?(\w+)[\s/>]/g;
  let m;
  while ((m = tagPattern.exec(blockContent)) !== null) {
    const prefix = m[1] ? m[1].replace(":", "") : "";
    const name = m[2];
    if (prefix === "x" || prefix === "s" || prefix === "scg" || prefix === "scg2" || prefix === "sco" || prefix === "mc" || prefix === "sap" || prefix === "sap2010" || prefix === "sads") continue;
    if (!SYSTEM_ACTIVITIES_NO_PREFIX.has(name) && !XML_INFRASTRUCTURE_TAGS.has(name) && !/^[a-z]$/.test(name)) {
      if (!activities.includes(name)) activities.push(name);
    }
  }
  return activities;
}

function enforceActivityEmission(
  fileName: string,
  content: string,
  violations: EmissionViolation[],
  mode: EmissionGateMode = "strict",
  businessContextMap?: WorkflowBusinessContextMap,
): { content: string; blocked: boolean } {
  if (!catalogService.isLoaded()) return { content, blocked: false };

  let blocked = false;
  let result = content;

  const declarationRanges: Array<{ start: number; end: number }> = [];
  const declSectionPattern = /<TextExpression\.(?:ReferencesForImplementation|NamespacesForImplementation)>[\s\S]*?<\/TextExpression\.(?:ReferencesForImplementation|NamespacesForImplementation)>/g;
  let declMatch;
  while ((declMatch = declSectionPattern.exec(content)) !== null) {
    declarationRanges.push({ start: declMatch.index, end: declMatch.index + declMatch[0].length });
  }

  const activityTagPattern = /<(\w+:)?(\w+)[\s/>]/g;
  const foundActivities = new Map<string, { index: number; prefix: string; fullMatch: string }[]>();

  let match;
  while ((match = activityTagPattern.exec(content)) !== null) {
    const matchIndex = match.index;
    if (declarationRanges.some(r => matchIndex >= r.start && matchIndex < r.end)) continue;
    const prefix = match[1] ? match[1].replace(":", "") : "";
    const activityName = match[2];

    if (SYSTEM_ACTIVITIES_NO_PREFIX.has(activityName)) continue;
    if (XML_INFRASTRUCTURE_TAGS.has(activityName)) continue;
    if (/^[a-z]$/.test(activityName)) continue;
    if (prefix === "x" || prefix === "s" || prefix === "scg" || prefix === "scg2" || prefix === "sco" || prefix === "mc" || prefix === "sap" || prefix === "sap2010" || prefix === "sads") continue;
    if (activityName.includes(".")) continue;

    const key = activityName;
    if (!foundActivities.has(key)) foundActivities.set(key, []);
    foundActivities.get(key)!.push({ index: match.index, prefix, fullMatch: match[0] });
  }

  interface PendingBlockReplacement {
    block: { start: number; end: number; blockType: string; prefix: string };
    activityName: string;
    reason: string;
    line: number;
    containedActivities: string[];
  }
  const pendingBlockReplacements: PendingBlockReplacement[] = [];

  for (const [activityName, occurrences] of foundActivities) {
    const schema = catalogService.getActivitySchema(activityName);

    if (schema && schema.activity.emissionApproved) continue;

    const reason = schema
      ? `emissionApproved=false`
      : `not found in activity catalog`;

    for (const occ of occurrences) {
      const alreadyCoveredByBlock = pendingBlockReplacements.some(
        r => occ.index >= r.block.start && occ.index < r.block.end
      );
      if (alreadyCoveredByBlock) continue;

      const line = findLineNumber(content, occ.index);
      const insideControlFlow = isInsideControlFlowOrRetryContainer(content, occ.index);
      const isOrch = isOrchestrationNode(activityName);

      if (insideControlFlow || isOrch) {
        if (mode === "baseline") {
          const block = findInnermostContainingBlock(content, occ.index);
          if (block) {
            const blockContent = content.substring(block.start, block.end);
            const containedActivities = listActivitiesInBlock(blockContent);
            const isIndivisible = INDIVISIBLE_BUSINESS_CONTAINERS.has(block.blockType);
            const unapprovedInBlock = containedActivities.filter(act => {
              const actSchema = catalogService.getActivitySchema(act);
              return actSchema ? !actSchema.activity.emissionApproved : true;
            });

            if (!isIndivisible && unapprovedInBlock.length <= 1 && !isOrch) {
              console.log(`[Emission Gate] ${block.blockType} contains only ${unapprovedInBlock.length} unapproved activity — using activity-level stub within block (preserving ${block.blockType} structure)`);
            } else {
              pendingBlockReplacements.push({
                block,
                activityName,
                reason,
                line,
                containedActivities,
              });
              if (isIndivisible) {
                console.log(`[Emission Gate] ${block.blockType} is indivisible business container — block-level replacement for "${activityName}"`);
              }
              continue;
            }
          } else {
            const contextLabel = isOrch ? "orchestration node" : "control-flow/retry container";
            console.warn(`[Emission Gate] No containing block found for "${activityName}" at ${fileName}:${line} inside ${contextLabel} — cannot perform block-level replacement in baseline mode`);
            violations.push({
              file: fileName,
              line,
              type: "unapproved-activity",
              detail: `Unapproved activity "${activityName}" (${reason}) inside ${contextLabel} — no containing block found for replacement, blocking`,
              resolution: "blocked",
              context: isOrch ? "orchestration-node" : "control-flow-container",
            });
            blocked = true;
            continue;
          }
        } else {
          violations.push({
            file: fileName,
            line,
            type: "unapproved-activity",
            detail: `Unapproved activity "${activityName}" (${reason}) inside ${isOrch ? "orchestration node" : "control-flow/retry container"} — cannot safely stub`,
            resolution: "blocked",
            context: isOrch ? "orchestration-node" : "control-flow-container",
          });
          blocked = true;
        }
      } else {
        const tagPrefix = occ.prefix ? `${occ.prefix}:` : "";
        const selfClosingPattern = new RegExp(
          `<${tagPrefix}${activityName}\\b[^>]*/\\s*>`,
          "g"
        );
        const openClosePattern = new RegExp(
          `<${tagPrefix}${activityName}\\b[^>]*>[\\s\\S]*?</${tagPrefix}${activityName}>`,
          "g"
        );

        const fileBaseName = fileName.split("/").pop() || fileName;
        const businessCtx = businessContextMap?.get(fileName) || businessContextMap?.get(fileBaseName);
        const businessDesc = formatBusinessContextForHandoff(businessCtx, activityName);
        const escapedBusinessDesc = escapeXml(businessDesc);
        const stubComment = `<ui:Comment DisplayName="[STUBBED] ${escapeXml(activityName)} — ${escapeXml(reason)}">\n` +
          `  <ui:Comment.Body>\n` +
          `    <InArgument x:TypeArguments="x:String">"This activity (${escapeXml(activityName)}) was removed: ${escapeXml(reason)}. Original location: ${escapeXml(fileName)}:${line}.\n` +
          `Business Context: ${escapedBusinessDesc}"</InArgument>\n` +
          `  </ui:Comment.Body>\n` +
          `</ui:Comment>\n` +
          `<ui:LogMessage Level="Warn" Message="&quot;[EmissionGate] Stubbed unapproved activity: ${escapeXml(activityName)} in ${escapeXml(fileName)}:${line}&quot;" />`;

        let replaced = false;
        result = result.replace(openClosePattern, (m) => {
          if (!replaced) {
            replaced = true;
            return stubComment;
          }
          return m;
        });
        if (!replaced) {
          result = result.replace(selfClosingPattern, (m) => {
            if (!replaced) {
              replaced = true;
              return stubComment;
            }
            return m;
          });
        }

        violations.push({
          file: fileName,
          line,
          type: "unapproved-activity",
          detail: `Unapproved activity "${activityName}" (${reason}) replaced with Comment+LogMessage stub`,
          resolution: "stubbed",
          context: "sequential",
        });
      }
    }
  }

  if (pendingBlockReplacements.length > 0) {
    const deduped = new Map<string, PendingBlockReplacement>();
    for (const rep of pendingBlockReplacements) {
      const key = `${rep.block.start}:${rep.block.end}`;
      if (!deduped.has(key)) {
        deduped.set(key, rep);
      }
    }

    const sorted = Array.from(deduped.values()).sort((a, b) => b.block.start - a.block.start);

    for (const rep of sorted) {
      const blockFileBaseName = fileName.split("/").pop() || fileName;
      const blockBusinessCtx = businessContextMap?.get(fileName) || businessContextMap?.get(blockFileBaseName);
      const blockBusinessDesc = formatBusinessContextForHandoff(blockBusinessCtx, rep.activityName, rep.block.blockType);
      const escapedBlockDesc = escapeXml(blockBusinessDesc);
      const handoffStub =
        `<Sequence DisplayName="[HANDOFF] ${escapeXml(rep.block.blockType)} — requires developer implementation">\n` +
        `  <ui:Comment DisplayName="[HANDOFF] ${escapeXml(rep.block.blockType)} block requires developer implementation">\n` +
        `    <ui:Comment.Body>\n` +
        `      <InArgument x:TypeArguments="x:String">"This ${escapeXml(rep.block.blockType)} block was replaced because it contained unapproved activity: ${escapeXml(rep.activityName)} (${escapeXml(rep.reason)}). ` +
        `Original activities in block: ${escapeXml(rep.containedActivities.join(", ") || "none detected")}. File: ${escapeXml(fileName)}:${rep.line}.\n` +
        `Business Context: ${escapedBlockDesc}"</InArgument>\n` +
        `    </ui:Comment.Body>\n` +
        `  </ui:Comment>\n` +
        `  <ui:LogMessage Level="Warn" Message="&quot;[HANDOFF] Skipped ${escapeXml(rep.block.blockType)} containing unapproved activity ${escapeXml(rep.activityName)} — implement manually&quot;" />\n` +
        `</Sequence>`;

      const before = result.substring(0, rep.block.start);
      const after = result.substring(rep.block.end);
      const candidate = before + handoffStub + after;

      const xmlValidation = validateXmlWellFormedness(candidate);
      if (xmlValidation.valid) {
        result = candidate;
        violations.push({
          file: fileName,
          line: rep.line,
          type: "unapproved-activity",
          detail: `Unapproved activity "${rep.activityName}" (${rep.reason}) inside ${rep.block.blockType} — entire block replaced with handoff stub`,
          resolution: "degraded",
          context: "control-flow-container",
          containingBlockType: rep.block.blockType,
          containedActivities: rep.containedActivities,
        });
      } else {
        console.warn(`[Emission Gate] Block replacement produced invalid XML for ${rep.block.blockType} in ${fileName}:${rep.line}: ${xmlValidation.errors.join("; ")}. Containing block type: ${rep.block.blockType}, contained activities: [${rep.containedActivities.join(", ")}], block range: ${rep.block.start}-${rep.block.end}`);
        violations.push({
          file: fileName,
          line: rep.line,
          type: "unapproved-activity",
          detail: `Unapproved activity "${rep.activityName}" (${rep.reason}) inside ${rep.block.blockType} — block-level replacement produced invalid XML (${xmlValidation.errors.join("; ")}), blocking. Contained activities: [${rep.containedActivities.join(", ")}]`,
          resolution: "blocked",
          context: "control-flow-container",
          containingBlockType: rep.block.blockType,
          containedActivities: rep.containedActivities,
        });
        blocked = true;
      }
    }
  }

  return { content: result, blocked };
}

const INFRASTRUCTURE_PREFIXES = [
  "x", "s", "scg", "scg2", "ui", "mc", "sap", "sap2010", "sads",
  "mva", "this", "local", "sco", "sd", "ss", "uix", "snetmail",
];

class LivePrefixSet extends Set<string> {
  private _catalogGen = -1;

  private refresh(): void {
    const currentGen = catalogService.isLoaded() ? catalogService.getLoadGeneration() : -1;
    if (this._catalogGen === currentGen && super.size > 0) return;
    super.clear();
    for (const p of INFRASTRUCTURE_PREFIXES) super.add(p);
    if (catalogService.isLoaded()) {
      for (const p of catalogService.getAllPrefixes()) {
        if (p) super.add(p);
      }
    }
    for (const p of Object.values(GUARANTEED_ACTIVITY_PREFIX_MAP)) {
      if (p) super.add(p);
    }
    this._catalogGen = currentGen;
  }

  override has(value: string): boolean { this.refresh(); return super.has(value); }
  override get size(): number { this.refresh(); return super.size; }
  override forEach(cb: (value: string, value2: string, set: Set<string>) => void, thisArg?: unknown): void { this.refresh(); super.forEach(cb, thisArg); }
  override [Symbol.iterator](): SetIterator<string> { this.refresh(); return super[Symbol.iterator](); }
  override entries(): SetIterator<[string, string]> { this.refresh(); return super.entries(); }
  override keys(): SetIterator<string> { this.refresh(); return super.keys(); }
  override values(): SetIterator<string> { this.refresh(); return super.values(); }
}

export function getRecognizedNamespacePrefixes(): Set<string> {
  return RECOGNIZED_NAMESPACE_PREFIXES;
}

export const RECOGNIZED_NAMESPACE_PREFIXES = new LivePrefixSet();

export function isWellFormedXamlType(typeStr: string): boolean {
  const trimmed = typeStr.trim();
  if (!trimmed) return false;

  if (/\[/.test(trimmed) && !/^\w+:\w+\(/.test(trimmed)) return false;

  let parenDepth = 0;
  let braceDepth = 0;
  for (const ch of trimmed) {
    if (ch === "(") parenDepth++;
    else if (ch === ")") {
      parenDepth--;
      if (parenDepth < 0) return false;
    }
    else if (ch === "{") braceDepth++;
    else if (ch === "}") {
      braceDepth--;
      if (braceDepth < 0) return false;
    }
  }
  if (parenDepth !== 0 || braceDepth !== 0) return false;

  if (/clr-namespace:/.test(trimmed)) {
    if (/\[/.test(trimmed)) return false;
    if (!/assembly=/.test(trimmed) && !/^[a-zA-Z][\w.]*$/.test(trimmed.split(":").pop() || "")) return false;
  }

  const prefixMatch = trimmed.match(/^(\w+):/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    if (!RECOGNIZED_NAMESPACE_PREFIXES.has(prefix)) {
      if (!/clr-namespace:/.test(trimmed)) return false;
    }
  }

  return true;
}

function isCriticalTypeContext(tagContext: string, typeStr?: string): boolean {
  if (/x:Property\b/i.test(tagContext)) return true;
  if (/ForEach\b/i.test(tagContext)) return true;
  if (/InArgument\b|OutArgument\b|InOutArgument\b/i.test(tagContext)) return true;
  if (typeStr && /scg:(?:Dictionary|List|Queue|Stack|HashSet)\b/i.test(typeStr)) return true;
  if (typeStr && /Generic\./i.test(typeStr)) return true;
  return false;
}

function enforceTypeStrings(
  fileName: string,
  content: string,
  violations: EmissionViolation[],
): { content: string; blocked: boolean } {
  let blocked = false;
  let result = content;

  const typePatterns = [
    { pattern: /(<x:Property\s+[^>]*Type=")([^"]+)(")/g, contextTag: "x:Property" },
    { pattern: /(<Variable\s+[^>]*x:TypeArguments=")([^"]+)(")/g, contextTag: "Variable" },
    { pattern: /(<InArgument\s+[^>]*x:TypeArguments=")([^"]+)(")/g, contextTag: "InArgument" },
    { pattern: /(<OutArgument\s+[^>]*x:TypeArguments=")([^"]+)(")/g, contextTag: "OutArgument" },
    { pattern: /(<InOutArgument\s+[^>]*x:TypeArguments=")([^"]+)(")/g, contextTag: "InOutArgument" },
    { pattern: /(<ForEach\s+[^>]*x:TypeArguments=")([^"]+)(")/g, contextTag: "ForEach TypeArguments" },
  ];

  for (const { pattern, contextTag } of typePatterns) {
    result = result.replace(pattern, (fullMatch, prefix, typeStr, suffix) => {
      if (isWellFormedXamlType(typeStr)) return fullMatch;

      const lineNum = findLineNumber(result, result.indexOf(fullMatch));
      const critical = isCriticalTypeContext(contextTag, typeStr);

      if (critical) {
        violations.push({
          file: fileName,
          line: lineNum,
          type: "malformed-type",
          detail: `Malformed type "${typeStr}" in critical context (${contextTag}) — blocking: raw brackets, unbalanced delimiters, or unmapped clr-namespace detected`,
          resolution: "blocked",
          context: contextTag,
          isIntegrityFailure: true,
        });
        blocked = true;
        return fullMatch;
      }

      violations.push({
        file: fileName,
        line: lineNum,
        type: "malformed-type",
        detail: `Malformed type "${typeStr}" in non-critical context (${contextTag}) — corrected to x:Object`,
        resolution: "corrected",
        context: contextTag,
      });
      return `${prefix}x:Object${suffix}`;
    });
  }

  return { content: result, blocked };
}

function cleanSentinelExpressions(
  fileName: string,
  content: string,
  violations: EmissionViolation[],
): string {
  let result = content;

  const COMPOUND_SENTINEL_MARKER = "__COMPOUND_SENTINEL_DEGRADED__";
  let hasCompoundDegradation = false;

  const attrPattern = /("[^"]*(?:HANDOFF_\w+|STUB_\w+|ASSEMBLY_FAILED\w*|__BLOCKED_\w+|PLACEHOLDER_\w+)[^"]*")/g;

  result = result.replace(attrPattern, (fullMatch) => {
    const sentinelMatch = fullMatch.match(SENTINEL_PATTERNS);
    if (!sentinelMatch) return fullMatch;

    const sentinelToken = sentinelMatch[1];
    const lineNum = findLineNumber(content, content.indexOf(fullMatch));
    const innerValue = fullMatch.slice(1, -1);
    const isSentinelOnly = innerValue.trim() === sentinelToken;

    if (isSentinelOnly) {
      violations.push({
        file: fileName,
        line: lineNum,
        type: "sentinel-expression",
        detail: `Sentinel expression "${sentinelToken}" found and replaced with TODO stub (remediation: TODO literal placeholder)`,
        resolution: "corrected",
      });
      return `"TODO: implement this expression"`;
    } else {
      hasCompoundDegradation = true;
      violations.push({
        file: fileName,
        line: lineNum,
        type: "sentinel-expression",
        detail: `Sentinel "${sentinelToken}" embedded in compound expression — activity degraded to Comment+LogMessage stub`,
        resolution: "degraded",
      });
      return `"${COMPOUND_SENTINEL_MARKER}"`;
    }
  });

  const INFRASTRUCTURE_TAGS = new Set([
    "InArgument", "OutArgument", "InOutArgument", "DelegateInArgument",
    "Variable", "Sequence", "Flowchart", "FlowStep", "FlowDecision",
    "FlowSwitch", "ActivityAction", "ActivityBuilder", "Activity",
    "TextExpression", "Literal", "VisualBasicValue", "VisualBasicReference",
  ]);

  const isActivityTag = (tag: string): boolean => {
    const bareTag = tag.includes(":") ? tag.split(":").pop()! : tag;
    if (INFRASTRUCTURE_TAGS.has(bareTag)) return false;
    return true;
  };

  const makeCompoundDegradationStub = (activityTag: string, displayName: string, context: string): string => {
    return `<ui:Comment DisplayName="[DEGRADED] ${escapeXml(displayName)} — ${context}">\n` +
      `  <ui:Comment.Body>\n` +
      `    <InArgument x:TypeArguments="x:String">"This activity (${escapeXml(activityTag)}) contained a compound sentinel and was replaced with a developer handoff stub."</InArgument>\n` +
      `  </ui:Comment.Body>\n` +
      `</ui:Comment>\n` +
      `<ui:LogMessage Level="Warn" Message="&quot;[DEGRADED] ${escapeXml(displayName)} requires developer implementation&quot;" />`;
  };

  if (hasCompoundDegradation) {
    const escapedMarker = COMPOUND_SENTINEL_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const selfClosePattern = new RegExp(
      `<((?:[a-z]+:)?[A-Z]\\w+)\\s[^>]*?"${escapedMarker}"[^>]*?/>`,
      "g"
    );
    result = result.replace(selfClosePattern, (_match, activityTag) => {
      if (!isActivityTag(activityTag)) {
        return _match.replace(new RegExp(`"${escapedMarker}"`, "g"), `"TODO: implement this expression"`);
      }
      const dnMatch = _match.match(/DisplayName="([^"]*)"/);
      return makeCompoundDegradationStub(activityTag, dnMatch ? dnMatch[1] : activityTag, "compound sentinel remediation");
    });

    const openClosePattern = new RegExp(
      `<((?:[a-z]+:)?[A-Z]\\w+)\\s[^>]*?"${escapedMarker}"[^>]*?>[\\s\\S]*?</\\1>`,
      "g"
    );
    result = result.replace(openClosePattern, (_match, activityTag) => {
      if (!isActivityTag(activityTag)) {
        return _match.replace(new RegExp(`"${escapedMarker}"`, "g"), `"TODO: implement this expression"`);
      }
      const dnMatch = _match.match(/DisplayName="([^"]*)"/);
      return makeCompoundDegradationStub(activityTag, dnMatch ? dnMatch[1] : activityTag, "compound sentinel remediation");
    });

    result = result.replace(new RegExp(`"${escapedMarker}"`, "g"), `"TODO: implement this expression"`);
  }

  const elemPattern = /(>)([^<]*(?:HANDOFF_\w+|STUB_\w+|ASSEMBLY_FAILED\w*|__BLOCKED_\w+|PLACEHOLDER_\w+)[^<]*)(<)/g;
  let hasElemCompound = false;
  result = result.replace(elemPattern, (fullMatch, openDelim, textContent, closeDelim) => {
    const sentinelMatch = textContent.match(SENTINEL_PATTERNS);
    if (!sentinelMatch) return fullMatch;

    const lineNum = findLineNumber(content, content.indexOf(fullMatch));
    const isSentinelOnly = textContent.trim() === sentinelMatch[1];

    if (isSentinelOnly) {
      violations.push({
        file: fileName,
        line: lineNum,
        type: "sentinel-expression",
        detail: `Sentinel expression "${sentinelMatch[1]}" in element text replaced with TODO stub`,
        resolution: "corrected",
      });
      return `${openDelim}TODO: implement this expression${closeDelim}`;
    } else {
      hasElemCompound = true;
      violations.push({
        file: fileName,
        line: lineNum,
        type: "sentinel-expression",
        detail: `Sentinel "${sentinelMatch[1]}" embedded in compound element text — marked for activity-level degradation`,
        resolution: "degraded",
      });
      return `${openDelim}${COMPOUND_SENTINEL_MARKER}${closeDelim}`;
    }
  });

  if (hasElemCompound) {
    const escapedMarker = COMPOUND_SENTINEL_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const elemDegradePattern = new RegExp(
      `<((?:[a-z]+:)?[A-Z]\\w+)\\s[^>]*?>[\\s\\S]*?${escapedMarker}[\\s\\S]*?</\\1>`,
      "g"
    );
    result = result.replace(elemDegradePattern, (_match, activityTag) => {
      if (!isActivityTag(activityTag)) {
        return _match.replace(new RegExp(escapedMarker, "g"), "TODO: implement this expression");
      }
      const dnMatch = _match.match(/DisplayName="([^"]*)"/);
      return makeCompoundDegradationStub(activityTag, dnMatch ? dnMatch[1] : activityTag, "compound sentinel in element text");
    });
    result = result.replace(new RegExp(escapedMarker, "g"), "TODO: implement this expression");
  }

  return result;
}

export interface NormalizationInvariantViolation {
  pattern: string;
  detail: string;
  line?: number;
}

export function checkNormalizationInvariants(
  content: string,
  fileName: string,
): NormalizationInvariantViolation[] {
  const violations: NormalizationInvariantViolation[] = [];

  const declarationRanges: Array<{ start: number; end: number }> = [];
  const declSectionPattern = /<TextExpression\.(?:ReferencesForImplementation|NamespacesForImplementation)>[\s\S]*?<\/TextExpression\.(?:ReferencesForImplementation|NamespacesForImplementation)>/g;
  let declMatch;
  while ((declMatch = declSectionPattern.exec(content)) !== null) {
    declarationRanges.push({ start: declMatch.index, end: declMatch.index + declMatch[0].length });
  }

  function isInDeclarationRange(idx: number): boolean {
    return declarationRanges.some(r => idx >= r.start && idx < r.end);
  }

  const typedPropertyObjectPattern = /x:TypeArguments="[^"]*"\s*>\s*\{[^}]*\}/g;
  let tpoMatch;
  while ((tpoMatch = typedPropertyObjectPattern.exec(content)) !== null) {
    if (isInDeclarationRange(tpoMatch.index)) continue;
    violations.push({
      pattern: "typed-property-object",
      detail: `Typed property object leaked into XAML at ${fileName}:${findLineNumber(content, tpoMatch.index)}: ${tpoMatch[0].substring(0, 80)}`,
      line: findLineNumber(content, tpoMatch.index),
    });
  }

  const rawClrPattern = /(?:Type|x:TypeArguments)="([^"]+)"/g;
  let clrMatch;
  while ((clrMatch = rawClrPattern.exec(content)) !== null) {
    if (isInDeclarationRange(clrMatch.index)) continue;
    const typeVal = clrMatch[1];
    if (/^clr-namespace:/.test(typeVal)) continue;
    if (/\bSystem\.\w+\.\w+\.\w+/.test(typeVal) && !/^[sx]:/.test(typeVal) && !/^scg/.test(typeVal) && !/^mva:/.test(typeVal)) {
      if (typeVal.startsWith("clr-namespace:")) continue;
      violations.push({
        pattern: "raw-clr-type",
        detail: `Raw CLR type "${typeVal}" found where XAML-prefix type required at ${fileName}:${findLineNumber(content, clrMatch.index)}`,
        line: findLineNumber(content, clrMatch.index),
      });
    }
  }

  const unwrappedVbDefaultPattern = /<Variable\s+[^>]*Default="([^"]+)"/g;
  let vbMatch;
  while ((vbMatch = unwrappedVbDefaultPattern.exec(content)) !== null) {
    if (isInDeclarationRange(vbMatch.index)) continue;
    const defaultVal = vbMatch[1];
    if (/^New\s+\w/.test(defaultVal) && !defaultVal.startsWith("[")) {
      violations.push({
        pattern: "unwrapped-vb-default",
        detail: `Unwrapped VB expression default "${defaultVal}" at ${fileName}:${findLineNumber(content, vbMatch.index)} — should be bracket-wrapped`,
        line: findLineNumber(content, vbMatch.index),
      });
    }
  }

  const malformedGenericPattern = /x:TypeArguments="([^"]+)"/g;
  let genMatch;
  while ((genMatch = malformedGenericPattern.exec(content)) !== null) {
    if (isInDeclarationRange(genMatch.index)) continue;
    const typeVal = genMatch[1];
    const openParens = (typeVal.match(/\(/g) || []).length;
    const closeParens = (typeVal.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      violations.push({
        pattern: "malformed-generic",
        detail: `Malformed generic type serialization "${typeVal}" at ${fileName}:${findLineNumber(content, genMatch.index)} — unbalanced parentheses`,
        line: findLineNumber(content, genMatch.index),
      });
    }
    if (/\[/.test(typeVal) && !/^\w+:\w+\(/.test(typeVal)) {
      violations.push({
        pattern: "malformed-generic",
        detail: `Malformed generic type with raw brackets "${typeVal}" at ${fileName}:${findLineNumber(content, genMatch.index)}`,
        line: findLineNumber(content, genMatch.index),
      });
    }
  }

  const propAttrPattern = /(\w+)="([^"]+)"/g;
  let attrMatch;
  while ((attrMatch = propAttrPattern.exec(content)) !== null) {
    if (isInDeclarationRange(attrMatch.index)) continue;
    const attrName = attrMatch[1];
    const attrVal = attrMatch[2];
    if (attrName === "xmlns" || attrName.startsWith("xmlns:") || attrName === "x:Class" || attrName === "x:TypeArguments" || attrName === "Type") continue;
    if (attrName === "DisplayName" || attrName === "Text" || attrName === "Message" || attrName === "AnnotationText") continue;
    if (/\[.*".*\]/.test(attrVal) && !/^\["[^"]*"\]$/.test(attrVal) && !/^\[.*&quot;.*\]$/.test(attrVal)) {
      if (/\[.*\]/.test(attrVal) && /"/.test(attrVal.replace(/&quot;/g, "").replace(/""/, ""))) {
        violations.push({
          pattern: "mixed-literal-expression",
          detail: `Mixed literal/expression syntax in ${attrName}="${attrVal}" at ${fileName}:${findLineNumber(content, attrMatch.index)}`,
          line: findLineNumber(content, attrMatch.index),
        });
      }
    }
  }

  const objectSerializedPattern = /OBJECT_SERIALIZED:/g;
  let osMatch;
  while ((osMatch = objectSerializedPattern.exec(content)) !== null) {
    if (isInDeclarationRange(osMatch.index)) continue;
    violations.push({
      pattern: "raw-object-serialized",
      detail: `Raw OBJECT_SERIALIZED marker leaked into XAML at ${fileName}:${findLineNumber(content, osMatch.index)}`,
      line: findLineNumber(content, osMatch.index),
    });
  }

  const objectObjectPattern = /\[object Object\]/g;
  let ooMatch;
  while ((ooMatch = objectObjectPattern.exec(content)) !== null) {
    if (isInDeclarationRange(ooMatch.index)) continue;
    violations.push({
      pattern: "object-object-leak",
      detail: `Raw [object Object] leaked into XAML at ${fileName}:${findLineNumber(content, ooMatch.index)}`,
      line: findLineNumber(content, ooMatch.index),
    });
  }

  const allSentinelPattern = /\b(__BLOCKED_\w+|HANDOFF_\w+|STUB_\w+|ASSEMBLY_FAILED\w*|PLACEHOLDER_\w+)\b/g;
  let bsMatch;
  while ((bsMatch = allSentinelPattern.exec(content)) !== null) {
    if (isInDeclarationRange(bsMatch.index)) continue;
    const surroundingCtx = content.substring(Math.max(0, bsMatch.index - 80), bsMatch.index + bsMatch[0].length + 80);
    const alreadyCleaned = /TODO: implement this expression/.test(surroundingCtx)
      || /\[DEGRADED\]/.test(surroundingCtx)
      || /\[STUBBED\]/.test(surroundingCtx)
      || /\[HANDOFF\]/.test(surroundingCtx)
      || /DisplayName="\[/.test(surroundingCtx);
    if (alreadyCleaned) continue;
    violations.push({
      pattern: "sentinel-leak",
      detail: `Sentinel "${bsMatch[0]}" leaked into XAML at ${fileName}:${findLineNumber(content, bsMatch.index)} (post-cleanSentinelExpressions residual)`,
      line: findLineNumber(content, bsMatch.index),
    });
  }

  return violations;
}

export function runEmissionGate(
  xamlEntries: Array<{ name: string; content: string }>,
  mode: EmissionGateMode = "strict",
  businessContextMap?: WorkflowBusinessContextMap,
): EmissionGateResult {
  const violations: EmissionViolation[] = [];
  let anyBlocked = false;

  const criticalDiags = drainCriticalTypeDiagnostics();
  for (const diag of criticalDiags) {
    violations.push({
      file: diag.source,
      type: "malformed-type",
      detail: `Critical mapClrType failure: input="${diag.inputType}" resolved="${diag.resolvedType}" — ${diag.reason}`,
      resolution: "blocked",
      context: "mapClrType-critical",
      isIntegrityFailure: true,
    });
    anyBlocked = true;
  }

  for (let i = 0; i < xamlEntries.length; i++) {
    const entry = xamlEntries[i];
    let content = entry.content;
    const fileName = entry.name;

    const actResult = enforceActivityEmission(fileName, content, violations, mode, businessContextMap);
    content = actResult.content;
    if (actResult.blocked) anyBlocked = true;

    const typeResult = enforceTypeStrings(fileName, content, violations);
    content = typeResult.content;
    if (typeResult.blocked) anyBlocked = true;

    content = cleanSentinelExpressions(fileName, content, violations);

    const ampDetect = detectRawAmpersands(content);
    if (ampDetect.count > 0) {
      violations.push({
        file: fileName,
        type: "sentinel-expression",
        detail: `[Ampersand Gap Detector] ${ampDetect.count} raw ampersand(s) detected in ${fileName} — serializer bypass: value(s) reached XAML without passing through escapeXml/escapeXmlAttributeValue. Requires upstream call-site fix.`,
        resolution: "degraded",
      });
      for (const loc of ampDetect.locations) {
        console.warn(`[Emission Gate] WARNING: Raw ampersand at ${fileName}:${loc.line} — "${loc.context}" — serializer bypass, requires call-site fix`);
      }
    }

    const normViolations = checkNormalizationInvariants(content, fileName);
    for (const nv of normViolations) {
      violations.push({
        file: fileName,
        line: nv.line,
        type: "malformed-type",
        detail: `[Normalization Invariant] ${nv.pattern}: ${nv.detail}`,
        resolution: "blocked",
        isIntegrityFailure: true,
      });
      anyBlocked = true;
    }

    if (content !== entry.content) {
      xamlEntries[i] = { name: fileName, content };
    }

    if (mode === "baseline") {
      const fileViolations = violations.filter(v => v.file === fileName);
      const degradedCount = fileViolations.filter(v => v.resolution === "degraded" || v.resolution === "stubbed").length;
      const totalActivities = listActivitiesInBlock(content).length;
      const degradationRatio = totalActivities > 0 ? degradedCount / totalActivities : 0;

      if (degradationRatio > 0.6 && degradedCount >= 3) {
        const shortName = fileName.split("/").pop() || fileName;
        if (shortName !== "Main.xaml") {
          const wfBaseName = fileName.split("/").pop() || fileName;
          const businessCtx = businessContextMap?.get(fileName) || businessContextMap?.get(wfBaseName);
          const businessDesc = formatBusinessContextForHandoff(businessCtx, "workflow", "workflow");
          const escapedWfDesc = escapeXml(businessDesc);
          console.warn(`[Emission Gate] Workflow "${fileName}" is ${Math.round(degradationRatio * 100)}% degraded (${degradedCount}/${totalActivities} activities) — performing workflow-level replacement`);

          const wfHandoffXaml =
            `<Activity x:Class="${escapeXml(shortName.replace(/\.xaml$/i, ""))}" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">\n` +
            `  <Sequence DisplayName="[WORKFLOW-HANDOFF] ${escapeXml(shortName)} — requires full developer implementation">\n` +
            `    <ui:Comment DisplayName="[WORKFLOW-HANDOFF] This workflow is too degraded for baseline emission">\n` +
            `      <ui:Comment.Body>\n` +
            `        <InArgument x:TypeArguments="x:String">"This entire workflow (${escapeXml(shortName)}) was replaced because ${degradedCount} of ${totalActivities} activities (${Math.round(degradationRatio * 100)}%) could not be safely emitted. ` +
            `The workflow structure was too gutted for meaningful baseline output.\n` +
            `Business Context: ${escapedWfDesc}"</InArgument>\n` +
            `      </ui:Comment.Body>\n` +
            `    </ui:Comment>\n` +
            `    <ui:LogMessage Level="Warn" Message="&quot;[WORKFLOW-HANDOFF] ${escapeXml(shortName)} requires full developer implementation (${degradedCount}/${totalActivities} activities degraded)&quot;" />\n` +
            `  </Sequence>\n` +
            `</Activity>`;

          xamlEntries[i] = { name: fileName, content: wfHandoffXaml };

          violations.push({
            file: fileName,
            type: "unapproved-activity",
            detail: `Workflow "${fileName}" replaced with workflow-level handoff (${degradedCount}/${totalActivities} activities stubbed/degraded, ${Math.round(degradationRatio * 100)}%). ${businessDesc}`,
            resolution: "degraded",
            context: "workflow-level-replacement",
          });
        }
      }
    }
  }

  const summary = {
    totalViolations: violations.length,
    stubbed: violations.filter(v => v.resolution === "stubbed").length,
    corrected: violations.filter(v => v.resolution === "corrected").length,
    blocked: violations.filter(v => v.resolution === "blocked").length,
    degraded: violations.filter(v => v.resolution === "degraded").length,
  };

  const serializerDiag = getAttributeSerializerDiagnostics();
  if (serializerDiag.calls > 0 || serializerDiag.bypassAttempts.length > 0) {
    console.log(`[Emission Gate] Attribute serializer: ${serializerDiag.calls} calls, ${serializerDiag.corrections} corrections, ${serializerDiag.bypassAttempts.length} bypass attempts`);
    if (serializerDiag.bypassAttempts.length > 0) {
      for (const bypass of serializerDiag.bypassAttempts) {
        console.warn(`[Emission Gate]   BYPASS: ${bypass}`);
      }
    }
  }
  resetAttributeSerializerDiagnostics();

  if (violations.length > 0) {
    console.log(`[Emission Gate] Found ${summary.totalViolations} violation(s): ${summary.stubbed} stubbed, ${summary.corrected} corrected, ${summary.blocked} blocked, ${summary.degraded} degraded`);
    for (const v of violations) {
      const prefix = v.resolution === "blocked" ? "BLOCKED" : v.resolution === "stubbed" ? "STUBBED" : v.resolution === "degraded" ? "DEGRADED" : "CORRECTED";
      console.log(`[Emission Gate]   ${prefix}: ${v.file}${v.line ? `:${v.line}` : ""} — ${v.detail}`);
    }
  }

  return {
    violations,
    blocked: anyBlocked,
    summary,
    attributeSerializerDiagnostics: serializerDiag,
  };
}

export function validateMapClrTypeOutput(input: string, output: string, context: "critical" | "non-critical"): { valid: boolean; fallback?: string; diagnostic?: string } {
  if (isWellFormedXamlType(output)) {
    if (output.includes("clr-namespace:") && /\[/.test(output)) {
      if (context === "critical") {
        return { valid: false, diagnostic: `mapClrType produced "${output}" from "${input}" containing clr-namespace with brackets — critical context blocks` };
      }
      return { valid: false, fallback: "x:Object", diagnostic: `mapClrType produced "${output}" from "${input}" — corrected to x:Object in non-critical context` };
    }
    return { valid: true };
  }

  if (context === "critical") {
    return { valid: false, diagnostic: `mapClrType produced malformed type "${output}" from "${input}" — critical context blocks` };
  }
  return { valid: false, fallback: "x:Object", diagnostic: `mapClrType produced malformed type "${output}" from "${input}" — corrected to x:Object` };
}
