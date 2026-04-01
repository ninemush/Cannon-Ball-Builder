import { catalogService } from "./catalog/catalog-service";
import { validateXmlWellFormedness } from "./xaml/xaml-compliance";

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
}

const CONTROL_FLOW_CONTAINERS = new Set([
  "If", "Switch", "While", "DoWhile", "ForEach", "Flowchart",
  "FlowStep", "FlowDecision", "FlowSwitch",
]);

const RETRY_LOOP_CONTAINERS = new Set([
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
]);

const SENTINEL_PATTERNS = /\b(HANDOFF_\w+|STUB_\w+|ASSEMBLY_FAILED\w*)\b/;

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
    const name = m[2];
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
): { content: string; blocked: boolean } {
  if (!catalogService.isLoaded()) return { content, blocked: false };

  let blocked = false;
  let result = content;

  const activityTagPattern = /<(\w+:)?(\w+)[\s/>]/g;
  const foundActivities = new Map<string, { index: number; prefix: string; fullMatch: string }[]>();

  let match;
  while ((match = activityTagPattern.exec(content)) !== null) {
    const prefix = match[1] ? match[1].replace(":", "") : "";
    const activityName = match[2];

    if (SYSTEM_ACTIVITIES_NO_PREFIX.has(activityName)) continue;
    if (XML_INFRASTRUCTURE_TAGS.has(activityName)) continue;
    if (/^[a-z]$/.test(activityName)) continue;
    if (prefix === "x" || prefix === "s" || prefix === "scg" || prefix === "scg2" || prefix === "mc" || prefix === "sap" || prefix === "sap2010" || prefix === "sads") continue;
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
            pendingBlockReplacements.push({
              block,
              activityName,
              reason,
              line,
              containedActivities,
            });
            continue;
          }
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

        const stubComment = `<ui:Comment DisplayName="[STUBBED] ${activityName} — ${reason}">\n` +
          `  <ui:Comment.Body>\n` +
          `    <InArgument x:TypeArguments="x:String">"This activity (${activityName}) was removed: ${reason}. Original location: ${fileName}:${line}"</InArgument>\n` +
          `  </ui:Comment.Body>\n` +
          `</ui:Comment>\n` +
          `<ui:LogMessage Level="Warn" Message="&quot;[EmissionGate] Stubbed unapproved activity: ${activityName} in ${fileName}:${line}&quot;" />`;

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
      const handoffStub =
        `<Sequence DisplayName="[HANDOFF] ${rep.block.blockType} — requires developer implementation">\n` +
        `  <ui:Comment DisplayName="[HANDOFF] ${rep.block.blockType} block requires developer implementation">\n` +
        `    <ui:Comment.Body>\n` +
        `      <InArgument x:TypeArguments="x:String">"This ${rep.block.blockType} block was replaced because it contained unapproved activity: ${rep.activityName} (${rep.reason}). ` +
        `Original activities in block: ${rep.containedActivities.join(", ") || "none detected"}. File: ${fileName}:${rep.line}"</InArgument>\n` +
        `    </ui:Comment.Body>\n` +
        `  </ui:Comment>\n` +
        `  <ui:LogMessage Level="Warn" Message="&quot;[HANDOFF] Skipped ${rep.block.blockType} containing unapproved activity ${rep.activityName} — implement manually&quot;" />\n` +
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

const RECOGNIZED_NAMESPACE_PREFIXES = new Set([
  "x", "s", "scg", "scg2", "ui", "mc", "sap", "sap2010", "sads",
  "mva", "this", "local",
]);

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

  const attrPattern = /("[^"]*(?:HANDOFF_\w+|STUB_\w+|ASSEMBLY_FAILED\w*)[^"]*")/g;

  result = result.replace(attrPattern, (fullMatch) => {
    const sentinelMatch = fullMatch.match(SENTINEL_PATTERNS);
    if (!sentinelMatch) return fullMatch;

    const lineNum = findLineNumber(content, content.indexOf(fullMatch));

    violations.push({
      file: fileName,
      line: lineNum,
      type: "sentinel-expression",
      detail: `Sentinel expression "${sentinelMatch[1]}" found and replaced with TODO stub`,
      resolution: "corrected",
    });

    return `"TODO: implement this expression"`;
  });

  const elemPattern = /(>)([^<]*(?:HANDOFF_\w+|STUB_\w+|ASSEMBLY_FAILED\w*)[^<]*)(<)/g;
  result = result.replace(elemPattern, (fullMatch, openDelim, textContent, closeDelim) => {
    const sentinelMatch = textContent.match(SENTINEL_PATTERNS);
    if (!sentinelMatch) return fullMatch;

    const lineNum = findLineNumber(content, content.indexOf(fullMatch));

    violations.push({
      file: fileName,
      line: lineNum,
      type: "sentinel-expression",
      detail: `Sentinel expression "${sentinelMatch[1]}" in element text replaced with TODO stub`,
      resolution: "corrected",
    });

    return `${openDelim}TODO: implement this expression${closeDelim}`;
  });

  return result;
}

export function runEmissionGate(
  xamlEntries: Array<{ name: string; content: string }>,
  mode: EmissionGateMode = "strict",
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

    const actResult = enforceActivityEmission(fileName, content, violations, mode);
    content = actResult.content;
    if (actResult.blocked) anyBlocked = true;

    const typeResult = enforceTypeStrings(fileName, content, violations);
    content = typeResult.content;
    if (typeResult.blocked) anyBlocked = true;

    content = cleanSentinelExpressions(fileName, content, violations);

    if (content !== entry.content) {
      xamlEntries[i] = { name: fileName, content };
    }
  }

  const summary = {
    totalViolations: violations.length,
    stubbed: violations.filter(v => v.resolution === "stubbed").length,
    corrected: violations.filter(v => v.resolution === "corrected").length,
    blocked: violations.filter(v => v.resolution === "blocked").length,
    degraded: violations.filter(v => v.resolution === "degraded").length,
  };

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
