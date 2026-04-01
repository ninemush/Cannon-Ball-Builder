import { catalogService } from "./catalog/catalog-service";

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

export interface EmissionViolation {
  file: string;
  line?: number;
  type: "unapproved-activity" | "malformed-type" | "sentinel-expression";
  detail: string;
  resolution: "stubbed" | "corrected" | "blocked";
  context?: string;
}

export interface EmissionGateResult {
  violations: EmissionViolation[];
  blocked: boolean;
  summary: {
    totalViolations: number;
    stubbed: number;
    corrected: number;
    blocked: number;
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

function enforceActivityEmission(
  fileName: string,
  content: string,
  violations: EmissionViolation[],
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

    if (SYSTEM_ACTIVITIES_NO_PREFIX.has(activityName) && !prefix) continue;
    if (XML_INFRASTRUCTURE_TAGS.has(activityName) && !prefix) continue;
    if (/^[a-z]$/.test(activityName)) continue;
    if (prefix === "x" || prefix === "s" || prefix === "scg" || prefix === "scg2" || prefix === "mc" || prefix === "sap" || prefix === "sap2010" || prefix === "sads") continue;
    if (activityName.includes(".")) continue;

    const key = activityName;
    if (!foundActivities.has(key)) foundActivities.set(key, []);
    foundActivities.get(key)!.push({ index: match.index, prefix, fullMatch: match[0] });
  }

  for (const [activityName, occurrences] of foundActivities) {
    const schema = catalogService.getActivitySchema(activityName);

    if (schema && schema.activity.emissionApproved) continue;

    const reason = schema
      ? `emissionApproved=false`
      : `not found in activity catalog`;

    for (const occ of occurrences) {
      const line = findLineNumber(content, occ.index);
      const insideControlFlow = isInsideControlFlowOrRetryContainer(result, occ.index);
      const isOrch = isOrchestrationNode(activityName);

      if (insideControlFlow || isOrch) {
        violations.push({
          file: fileName,
          line,
          type: "unapproved-activity",
          detail: `Unapproved activity "${activityName}" (${reason}) inside ${isOrch ? "orchestration node" : "control-flow/retry container"} — cannot safely stub`,
          resolution: "blocked",
          context: isOrch ? "orchestration-node" : "control-flow-container",
        });
        blocked = true;
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
    });
    anyBlocked = true;
  }

  for (let i = 0; i < xamlEntries.length; i++) {
    const entry = xamlEntries[i];
    let content = entry.content;
    const fileName = entry.name;

    const actResult = enforceActivityEmission(fileName, content, violations);
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
  };

  if (violations.length > 0) {
    console.log(`[Emission Gate] Found ${summary.totalViolations} violation(s): ${summary.stubbed} stubbed, ${summary.corrected} corrected, ${summary.blocked} blocked`);
    for (const v of violations) {
      const prefix = v.resolution === "blocked" ? "BLOCKED" : v.resolution === "stubbed" ? "STUBBED" : "CORRECTED";
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
