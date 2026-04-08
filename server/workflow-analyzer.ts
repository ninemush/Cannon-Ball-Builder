export type AnalysisViolation = {
  ruleId: string;
  ruleName: string;
  category: "naming" | "best-practice" | "usage" | "security";
  severity: "error" | "warning" | "info";
  message: string;
  location?: string;
  autoFixed: boolean;
};

export type AnalysisReport = {
  violations: AnalysisViolation[];
  rulesChecked: AnalysisRuleSummary[];
  totalChecked: number;
  totalPassed: number;
  totalAutoFixed: number;
  totalRemaining: number;
};

export type AnalysisRuleSummary = {
  ruleId: string;
  ruleName: string;
  category: string;
  status: "passed" | "auto-fixed" | "violation" | "not-applicable";
  violationCount: number;
  autoFixedCount: number;
};

const VARIABLE_TYPE_PREFIXES: Record<string, string> = {
  "x:String": "str",
  "x:Int32": "int",
  "x:Int64": "int",
  "x:Boolean": "bool",
  "x:Double": "dbl",
  "x:Decimal": "dec",
  "x:Object": "obj",
  "s:DateTime": "dt",
  "s:TimeSpan": "ts",
  "scg2:DataTable": "dt",
  "scg2:DataRow": "drow",
  "ui:QueueItem": "qi",
  "ui:QueueItemData": "qid",
};

const ARGUMENT_DIRECTION_PREFIXES: Record<string, string> = {
  InArgument: "in",
  OutArgument: "out",
  InOutArgument: "io",
};

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /apikey/i,
  /api_key/i,
  /token(?!ize)/i,
  /credential/i,
  /private_key/i,
  /privatekey/i,
  /passphrase/i,
];

function toPascalCase(name: string): string {
  return name
    .replace(/[^A-Za-z0-9]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export function enforceVariableName(name: string, type: string): string {
  const prefix = VARIABLE_TYPE_PREFIXES[type];
  if (!prefix) {
    const pascal = toPascalCase(name);
    return pascal || name;
  }
  const stripped = name
    .replace(/^(str|int|bool|dbl|dec|obj|dt|ts|drow|qi|qid|arr|dict|list|jobj)_/i, "");
  const pascal = toPascalCase(stripped);
  return `${prefix}_${pascal || stripped}`;
}

export function enforceArgumentName(name: string, direction: string): string {
  const prefix = ARGUMENT_DIRECTION_PREFIXES[direction] || "in";
  const stripped = name.replace(/^(in|out|io)_/i, "");
  const pascal = toPascalCase(stripped);
  return `${prefix}_${pascal || stripped}`;
}

export function enforceDisplayName(
  activityType: string,
  currentDisplayName: string,
): string {
  if (!currentDisplayName || currentDisplayName.trim() === "") {
    const typePart = activityType.replace("ui:", "").replace(/([A-Z])/g, " $1").trim();
    return typePart;
  }
  return currentDisplayName;
}

export function enforceWorkflowFileName(name: string): string {
  const clean = name.replace(/\.xaml$/i, "");
  const reserved = ["Main", "GetTransactionData", "Process", "SetTransactionStatus",
    "CloseAllApplications", "KillAllProcesses", "InitAllSettings"];
  if (reserved.includes(clean)) return `${clean}.xaml`;
  if (/^(Process_|Framework_|Util_)/.test(clean)) return `${clean}.xaml`;
  return `Process_${clean}.xaml`;
}

function extractVariables(xaml: string): Array<{ name: string; type: string; line: number }> {
  const results: Array<{ name: string; type: string; line: number }> = [];
  const pattern = /<Variable\s+x:TypeArguments="([^"]+)"\s+Name="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(xaml)) !== null) {
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    results.push({ name: match[2], type: match[1], line: lineNum });
  }
  const pattern2 = /<Variable\s+Name="([^"]+)"\s+x:TypeArguments="([^"]+)"/g;
  while ((match = pattern2.exec(xaml)) !== null) {
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    results.push({ name: match[1], type: match[2], line: lineNum });
  }
  return results;
}

function extractArguments(xaml: string): Array<{ name: string; direction: string; type: string; line: number }> {
  const results: Array<{ name: string; direction: string; type: string; line: number }> = [];
  const pattern = /<(InArgument|OutArgument|InOutArgument)\s+x:TypeArguments="([^"]+)"[^>]*Name="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(xaml)) !== null) {
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    results.push({ name: match[3], direction: match[1], type: match[2], line: lineNum });
  }
  const delPattern = /<DelegateInArgument\s+x:TypeArguments="([^"]+)"\s+Name="([^"]+)"/g;
  while ((match = delPattern.exec(xaml)) !== null) {
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    results.push({ name: match[2], direction: "DelegateInArgument", type: match[1], line: lineNum });
  }
  return results;
}

function extractDisplayNames(xaml: string): Array<{ activityType: string; displayName: string; line: number }> {
  const results: Array<{ activityType: string; displayName: string; line: number }> = [];
  const pattern = /<([A-Za-z:]+)\s[^>]*DisplayName="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(xaml)) !== null) {
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    results.push({ activityType: match[1], displayName: match[2], line: lineNum });
  }
  return results;
}

function checkNaming(xaml: string): AnalysisViolation[] {
  const violations: AnalysisViolation[] = [];
  const variables = extractVariables(xaml);
  for (const v of variables) {
    const expected = enforceVariableName(v.name, v.type);
    if (v.name !== expected && v.name !== "exception") {
      violations.push({
        ruleId: "ST-NMG-001",
        ruleName: "Variable naming convention",
        category: "naming",
        severity: "warning",
        message: `Variable "${v.name}" should be "${expected}" (type: ${v.type})`,
        location: `line ${v.line}`,
        autoFixed: false,
      });
    }
  }

  const args = extractArguments(xaml);
  for (const a of args) {
    if (a.direction === "DelegateInArgument") continue;
    const expected = enforceArgumentName(a.name, a.direction);
    if (a.name !== expected) {
      violations.push({
        ruleId: "ST-NMG-004",
        ruleName: "Argument naming convention",
        category: "naming",
        severity: "warning",
        message: `Argument "${a.name}" should be "${expected}" (direction: ${a.direction})`,
        location: `line ${a.line}`,
        autoFixed: false,
      });
    }
  }

  const displayNames = extractDisplayNames(xaml);
  for (const dn of displayNames) {
    if (!dn.displayName || dn.displayName.trim() === "") {
      violations.push({
        ruleId: "ST-NMG-009",
        ruleName: "Activity must have DisplayName",
        category: "naming",
        severity: "warning",
        message: `Activity "${dn.activityType}" at line ${dn.line} has empty DisplayName`,
        location: `line ${dn.line}`,
        autoFixed: false,
      });
    }
  }

  return violations;
}

function checkBestPractices(xaml: string): AnalysisViolation[] {
  const violations: AnalysisViolation[] = [];

  const catchPattern = /<Catch\s[^>]*>[\s\S]*?<\/Catch>/g;
  let match;
  while ((match = catchPattern.exec(xaml)) !== null) {
    const catchBlock = match[0];
    const hasActivity = /<(ui:|Sequence|Assign|Rethrow|Throw|If)\s/i.test(catchBlock);
    if (!hasActivity) {
      const lineNum = xaml.substring(0, match.index).split("\n").length;
      violations.push({
        ruleId: "ST-DBP-002",
        ruleName: "Empty Catch block",
        category: "best-practice",
        severity: "error",
        message: "Catch block contains no activities — exceptions will be silently swallowed",
        location: `line ${lineNum}`,
        autoFixed: false,
      });
    }
  }

  const hasStartLog = /<ui:LogMessage[^>]*DisplayName="Log Start"/i.test(xaml) ||
    /<ui:LogMessage[^>]*Message="[^"]*Starting/i.test(xaml);
  if (!hasStartLog) {
    violations.push({
      ruleId: "ST-DBP-025",
      ruleName: "Workflow should have initial log",
      category: "best-practice",
      severity: "warning",
      message: "Workflow does not contain an initial LogMessage activity",
      autoFixed: false,
    });
  }

  const hasEndLog = /<ui:LogMessage[^>]*DisplayName="Log (Complete|End|Completion|Finish)"/i.test(xaml) ||
    /<ui:LogMessage[^>]*Message="[^"]*completed/i.test(xaml) ||
    /<ui:LogMessage[^>]*Message="[^"]*(=== .+ complete|finished|ending)/i.test(xaml);
  if (!hasEndLog) {
    violations.push({
      ruleId: "ST-DBP-025",
      ruleName: "Workflow should have final log",
      category: "best-practice",
      severity: "warning",
      message: "Workflow does not contain a final LogMessage activity",
      autoFixed: false,
    });
  }

  const hardcodedTimeouts = /<[^>]+TimeoutMS="(?!30000)[0-9]+"/g;
  while ((match = hardcodedTimeouts.exec(xaml)) !== null) {
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    const timeoutMatch = match[0].match(/TimeoutMS="([0-9]+)"/);
    const val = timeoutMatch ? timeoutMatch[1] : "unknown";
    if (val !== "30000") {
      violations.push({
        ruleId: "ST-DBP-020",
        ruleName: "Hardcoded timeout",
        category: "best-practice",
        severity: "info",
        message: `Hardcoded timeout value ${val}ms — consider using a Config variable`,
        location: `line ${lineNum}`,
        autoFixed: false,
      });
    }
  }

  const delayPattern = /<Delay\s[^>]*>/g;
  while ((match = delayPattern.exec(xaml)) !== null) {
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    violations.push({
      ruleId: "ST-DBP-006",
      ruleName: "Delay activity usage",
      category: "best-practice",
      severity: "warning",
      message: "Delay activity detected — prefer element-wait or retry patterns over fixed delays",
      location: `line ${lineNum}`,
      autoFixed: false,
    });
  }

  return violations;
}

function checkUsage(xaml: string): AnalysisViolation[] {
  const violations: AnalysisViolation[] = [];
  const variables = extractVariables(xaml);

  for (const v of variables) {
    const nameEscaped = v.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const usagePattern = new RegExp(`(?<!Name=")${nameEscaped}`, "g");
    const varDeclPattern = new RegExp(`<Variable[^>]*Name="${nameEscaped}"`, "g");
    const allMatches = (xaml.match(usagePattern) || []).length;
    const declMatches = (xaml.match(varDeclPattern) || []).length;
    if (allMatches <= declMatches) {
      violations.push({
        ruleId: "ST-USG-005",
        ruleName: "Unused variable",
        category: "usage",
        severity: "warning",
        message: `Variable "${v.name}" is declared but never used`,
        location: `line ${v.line}`,
        autoFixed: false,
      });
    }
  }

  let ifNestDepth = 0;
  let maxNestDepth = 0;
  const ifOpenPattern = /<If\s/g;
  const ifClosePattern = /<\/If>/g;
  let pos = 0;
  while (pos < xaml.length) {
    const nextOpen = xaml.indexOf("<If ", pos);
    const nextClose = xaml.indexOf("</If>", pos);
    if (nextOpen === -1 && nextClose === -1) break;
    if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) {
      ifNestDepth++;
      if (ifNestDepth > maxNestDepth) maxNestDepth = ifNestDepth;
      pos = nextOpen + 4;
    } else {
      ifNestDepth--;
      pos = nextClose + 5;
    }
  }
  if (maxNestDepth > 3) {
    violations.push({
      ruleId: "ST-USG-017",
      ruleName: "Deeply nested If activities",
      category: "usage",
      severity: "warning",
      message: `If nesting depth is ${maxNestDepth} (max recommended: 3) — consider refactoring into separate workflows`,
      autoFixed: false,
    });
  }

  return violations;
}

function checkSecurity(xaml: string): AnalysisViolation[] {
  const violations: AnalysisViolation[] = [];

  const logPattern = /<ui:LogMessage[^>]*Message="([^"]+)"/g;
  let match;
  while ((match = logPattern.exec(xaml)) !== null) {
    const msgContent = match[1];
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(msgContent)) {
        const lineNum = xaml.substring(0, match.index).split("\n").length;
        violations.push({
          ruleId: "ST-SEC-004",
          ruleName: "Sensitive data in log message",
          category: "security",
          severity: "error",
          message: `LogMessage may contain sensitive data (matched: "${pattern.source}") — use SecureString or mask the value`,
          location: `line ${lineNum}`,
          autoFixed: false,
        });
        break;
      }
    }
  }

  const propPattern = /(?:Password|Secret|ApiKey|Token|Credential)="(?!{[^}]+})(?!\[)([^"]{3,})"/gi;
  while ((match = propPattern.exec(xaml)) !== null) {
    const value = match[1];
    if (value === "True" || value === "False" || value.startsWith("PLACEHOLDER_") || value.startsWith("TODO")) continue;
    const lineNum = xaml.substring(0, match.index).split("\n").length;
    violations.push({
      ruleId: "ST-SEC-005",
      ruleName: "Plaintext credential in property",
      category: "security",
      severity: "error",
      message: `Possible plaintext credential detected — use Orchestrator Asset or Windows Credential Manager`,
      location: `line ${lineNum}`,
      autoFixed: false,
    });
  }

  return violations;
}

function autoFixNaming(xaml: string): { fixed: string; fixes: AnalysisViolation[] } {
  const fixes: AnalysisViolation[] = [];
  let fixed = xaml;

  const variables = extractVariables(fixed);
  for (const v of variables) {
    if (v.name === "exception") continue;
    const expected = enforceVariableName(v.name, v.type);
    if (v.name !== expected) {
      const nameEscaped = v.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      fixed = fixed.replace(new RegExp(`Name="${nameEscaped}"`, "g"), `Name="${expected}"`);
      fixed = fixed.replace(new RegExp(`\\[${nameEscaped}\\]`, "g"), `[${expected}]`);
      fixed = fixed.replace(new RegExp(`'\\+\\s*${nameEscaped}`, "g"), `'+ ${expected}`);
      fixed = fixed.replace(new RegExp(`${nameEscaped}\\.ToString`, "g"), `${expected}.ToString`);
      fixes.push({
        ruleId: "ST-NMG-001",
        ruleName: "Variable naming convention",
        category: "naming",
        severity: "warning",
        message: `Auto-renamed variable "${v.name}" → "${expected}"`,
        location: `line ${v.line}`,
        autoFixed: true,
      });
    }
  }

  const args = extractArguments(fixed);
  for (const a of args) {
    if (a.direction === "DelegateInArgument") continue;
    const expected = enforceArgumentName(a.name, a.direction);
    if (a.name !== expected) {
      const nameEscaped = a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      fixed = fixed.replace(new RegExp(`Name="${nameEscaped}"`, "g"), `Name="${expected}"`);
      fixed = fixed.replace(new RegExp(`\\[${nameEscaped}\\]`, "g"), `[${expected}]`);
      fixes.push({
        ruleId: "ST-NMG-004",
        ruleName: "Argument naming convention",
        category: "naming",
        severity: "warning",
        message: `Auto-renamed argument "${a.name}" → "${expected}"`,
        location: `line ${a.line}`,
        autoFixed: true,
      });
    }
  }

  return { fixed, fixes };
}

function autoFixEmptyCatches(xaml: string): { fixed: string; fixes: AnalysisViolation[] } {
  const fixes: AnalysisViolation[] = [];
  let fixed = xaml;

  const catchPattern = /(<Catch\s+x:TypeArguments="[^"]*">\s*<ActivityAction\s+x:TypeArguments="[^"]*">\s*<ActivityAction\.Argument>\s*<DelegateInArgument\s+x:TypeArguments="[^"]*"\s+Name="([^"]+)"\s*\/>\s*<\/ActivityAction\.Argument>)\s*(<\/ActivityAction>)/g;
  let match;
  while ((match = catchPattern.exec(fixed)) !== null) {
    const exName = match[2];
    const lineNum = fixed.substring(0, match.index).split("\n").length;
    const replacement = `${match[1]}
                  <Sequence DisplayName="Handle Exception">
                    <ui:LogMessage Level="Error" Message="'[Error] Exception caught: ' + ${exName}.Message" DisplayName="Log Exception" />
                    <Rethrow DisplayName="Rethrow Exception" />
                  </Sequence>
                ${match[3]}`;
    fixed = fixed.replace(match[0], replacement);
    fixes.push({
      ruleId: "ST-DBP-002",
      ruleName: "Empty Catch block",
      category: "best-practice",
      severity: "error",
      message: "Auto-filled empty Catch block with Log + Rethrow",
      location: `line ${lineNum}`,
      autoFixed: true,
    });
  }

  return { fixed, fixes };
}

function autoFixMissingLogs(xaml: string): { fixed: string; fixes: AnalysisViolation[] } {
  const fixes: AnalysisViolation[] = [];
  let fixed = xaml;

  const hasStartLog = /<ui:LogMessage[^>]*DisplayName="Log Start"/i.test(fixed) ||
    /<ui:LogMessage[^>]*Message="[^"]*Starting/i.test(fixed);
  const hasEndLog = /<ui:LogMessage[^>]*DisplayName="Log (Complete|End|Completion|Finish)"/i.test(fixed) ||
    /<ui:LogMessage[^>]*Message="[^"]*completed/i.test(fixed) ||
    /<ui:LogMessage[^>]*Message="[^"]*(=== .+ complete|finished|ending)/i.test(fixed);

  const classMatch = fixed.match(/x:Class="([^"]+)"/);
  const wfName = classMatch ? classMatch[1] : "Workflow";

  if (!hasStartLog) {
    const seqStart = fixed.match(/(<Sequence\s+DisplayName="[^"]*">)/);
    if (seqStart) {
      fixed = fixed.replace(
        seqStart[0],
        `${seqStart[0]}\n        <ui:LogMessage Level="Info" Message="'=== Starting: ${wfName} ==='" DisplayName="Log Start" />`
      );
      fixes.push({
        ruleId: "ST-DBP-025",
        ruleName: "Missing initial log",
        category: "best-practice",
        severity: "warning",
        message: `Auto-added initial LogMessage to workflow "${wfName}"`,
        autoFixed: true,
      });
    }
  }

  if (!hasEndLog) {
    const lastSeqClose = fixed.lastIndexOf("</Sequence>");
    if (lastSeqClose > 0) {
      const endLog = `\n        <ui:LogMessage Level="Info" Message="'=== Completed: ${wfName} ==='" DisplayName="Log Completion" />`;
      fixed = fixed.substring(0, lastSeqClose) + endLog + "\n      " + fixed.substring(lastSeqClose);
      fixes.push({
        ruleId: "ST-DBP-025",
        ruleName: "Missing final log",
        category: "best-practice",
        severity: "warning",
        message: `Auto-added final LogMessage to workflow "${wfName}"`,
        autoFixed: true,
      });
    }
  }

  return { fixed, fixes };
}

const ALL_RULES: Array<{ ruleId: string; ruleName: string; category: string }> = [
  { ruleId: "ST-NMG-001", ruleName: "Variable naming convention", category: "naming" },
  { ruleId: "ST-NMG-004", ruleName: "Argument naming convention", category: "naming" },
  { ruleId: "ST-NMG-009", ruleName: "Activity must have DisplayName", category: "naming" },
  { ruleId: "ST-DBP-002", ruleName: "Empty Catch block", category: "best-practice" },
  { ruleId: "ST-DBP-006", ruleName: "Delay activity usage", category: "best-practice" },
  { ruleId: "ST-DBP-020", ruleName: "Hardcoded timeout", category: "best-practice" },
  { ruleId: "ST-DBP-025", ruleName: "Workflow start/end logging", category: "best-practice" },
  { ruleId: "ST-USG-005", ruleName: "Unused variable", category: "usage" },
  { ruleId: "ST-USG-017", ruleName: "Deeply nested If activities", category: "usage" },
  { ruleId: "ST-SEC-004", ruleName: "Sensitive data in log message", category: "security" },
  { ruleId: "ST-SEC-005", ruleName: "Plaintext credential in property", category: "security" },
];

function buildRuleSummaries(violations: AnalysisViolation[]): AnalysisRuleSummary[] {
  return ALL_RULES.map((rule) => {
    const ruleViolations = violations.filter((v) => v.ruleId === rule.ruleId);
    const autoFixed = ruleViolations.filter((v) => v.autoFixed).length;
    const remaining = ruleViolations.filter((v) => !v.autoFixed).length;
    let status: AnalysisRuleSummary["status"];
    if (ruleViolations.length === 0) status = "passed";
    else if (remaining === 0 && autoFixed > 0) status = "auto-fixed";
    else status = "violation";
    return {
      ruleId: rule.ruleId,
      ruleName: rule.ruleName,
      category: rule.category,
      status,
      violationCount: remaining,
      autoFixedCount: autoFixed,
    };
  });
}

export function analyzeXaml(xamlContent: string): AnalysisReport {
  const violations: AnalysisViolation[] = [
    ...checkNaming(xamlContent),
    ...checkBestPractices(xamlContent),
    ...checkUsage(xamlContent),
    ...checkSecurity(xamlContent),
  ];

  const ruleSummaries = buildRuleSummaries(violations);

  return {
    violations,
    rulesChecked: ruleSummaries,
    totalChecked: ALL_RULES.length,
    totalPassed: ruleSummaries.filter((r) => r.status === "passed").length,
    totalAutoFixed: 0,
    totalRemaining: violations.length,
  };
}

export function analyzeAndFix(xamlContent: string): { fixed: string; report: AnalysisReport } {
  const allViolations: AnalysisViolation[] = [];

  const namingResult = autoFixNaming(xamlContent);
  let fixed = namingResult.fixed;
  allViolations.push(...namingResult.fixes);

  const catchResult = autoFixEmptyCatches(fixed);
  fixed = catchResult.fixed;
  allViolations.push(...catchResult.fixes);

  const logResult = autoFixMissingLogs(fixed);
  fixed = logResult.fixed;
  allViolations.push(...logResult.fixes);

  const postFixViolations = [
    ...checkNaming(fixed),
    ...checkBestPractices(fixed),
    ...checkUsage(fixed),
    ...checkSecurity(fixed),
  ];
  allViolations.push(...postFixViolations);

  const ruleSummaries = buildRuleSummaries(allViolations);
  const autoFixedCount = allViolations.filter((v) => v.autoFixed).length;
  const remainingCount = allViolations.filter((v) => !v.autoFixed).length;

  return {
    fixed,
    report: {
      violations: allViolations,
      rulesChecked: ruleSummaries,
      totalChecked: ALL_RULES.length,
      totalPassed: ruleSummaries.filter((r) => r.status === "passed").length,
      totalAutoFixed: autoFixedCount,
      totalRemaining: remainingCount,
    },
  };
}

export function formatAnalysisReportMarkdown(report: AnalysisReport): string {
  let md = "";

  md += `### Workflow Analyzer Compliance\n\n`;
  md += `| Rule ID | Rule Name | Category | Status | Auto-Fixed | Remaining |\n`;
  md += `|---------|-----------|----------|--------|------------|----------|\n`;

  for (const rule of report.rulesChecked) {
    const statusIcon = rule.status === "passed" ? "Passed" :
      rule.status === "auto-fixed" ? "Auto-Fixed" : "Needs Review";
    md += `| ${rule.ruleId} | ${rule.ruleName} | ${rule.category} | ${statusIcon} | ${rule.autoFixedCount} | ${rule.violationCount} |\n`;
  }

  md += `\n**Summary:** ${report.totalChecked} rules checked, ${report.totalPassed} passed, ${report.totalAutoFixed} auto-fixed, ${report.totalRemaining} remaining\n\n`;

  const remaining = report.violations.filter((v) => !v.autoFixed);
  if (remaining.length > 0) {
    md += `### Remaining Violations (Require Manual Review)\n\n`;
    md += `| Severity | Rule | Message | Location |\n`;
    md += `|----------|------|---------|----------|\n`;
    for (const v of remaining) {
      md += `| ${v.severity} | ${v.ruleId} | ${v.message} | ${v.location || "—"} |\n`;
    }
    md += `\n`;
  }

  const autoFixed = report.violations.filter((v) => v.autoFixed);
  if (autoFixed.length > 0) {
    md += `### Auto-Corrected Items\n\n`;
    for (const v of autoFixed) {
      md += `- **${v.ruleId}**: ${v.message}\n`;
    }
    md += `\n`;
  }

  return md;
}

export function generateAnnotationText(opts: {
  stepNumber?: number;
  stepName?: string;
  businessContext?: string;
  errorStrategy?: string;
  placeholders?: string[];
  aiReasoning?: string;
}): string {
  const parts: string[] = [];
  if (opts.stepNumber !== undefined && opts.stepName) {
    parts.push(`[Step ${opts.stepNumber}] ${opts.stepName}`);
  }
  if (opts.businessContext) {
    parts.push(`Business Context: ${opts.businessContext}`);
  }
  if (opts.errorStrategy) {
    parts.push(`Error Handling: ${opts.errorStrategy}`);
  }
  if (opts.placeholders?.length) {
    parts.push(`Action Required: Replace ${opts.placeholders.join(", ")}`);
  }
  if (opts.aiReasoning) {
    parts.push(`AI Reasoning: ${opts.aiReasoning}`);
  }
  return parts.join("\n");
}

export function generateArgumentValidationXaml(
  args: Array<{ name: string; direction: string; type: string; required?: boolean }>,
  workflowName: string,
): string {
  const inArgs = args.filter((a) => a.direction === "InArgument" || a.direction === "InOutArgument");
  if (inArgs.length === 0) return "";

  let xml = `
        <Sequence DisplayName="Validate Arguments"
          sap2010:Annotation.AnnotationText="Auto-generated argument validation — ensures all required inputs are provided before execution begins">`;

  xml += `
          <ui:LogMessage Level="Trace" Message="'[${workflowName}] Validating ${inArgs.length} input argument(s)...'" DisplayName="Log Argument Validation Start" />`;

  for (const arg of inArgs) {
    const typeLower = arg.type.toLowerCase();
    const isSensitive = SENSITIVE_PATTERNS.some((p) => p.test(arg.name));

    if (typeLower.includes("string") || typeLower === "x:string") {
      xml += `
          <If DisplayName="Validate ${arg.name}" Condition="[String.IsNullOrWhiteSpace(${arg.name})]">
            <If.Then>
              <Throw DisplayName="Throw: ${arg.name} required" Exception="[New BusinessRuleException(&quot;Required argument '${arg.name}' is null or empty&quot;)]" />
            </If.Then>
            <If.Else>
              <ui:LogMessage Level="Trace" Message="'[${workflowName}] ${arg.name} = ${isSensitive ? "****" : `' + ${arg.name}`}'" DisplayName="Log ${arg.name}" />
            </If.Else>
          </If>`;
    } else if (typeLower.includes("datatable") || typeLower === "scg2:datatable") {
      xml += `
          <If DisplayName="Validate ${arg.name}" Condition="[${arg.name} Is Nothing]">
            <If.Then>
              <Throw DisplayName="Throw: ${arg.name} required" Exception="[New BusinessRuleException(&quot;Required argument '${arg.name}' is Nothing (DataTable expected)&quot;)]" />
            </If.Then>
            <If.Else>
              <ui:LogMessage Level="Trace" Message="'[${workflowName}] ${arg.name} has ' + ${arg.name}.Rows.Count.ToString() + ' rows'" DisplayName="Log ${arg.name}" />
            </If.Else>
          </If>`;
    } else if (typeLower.includes("object") || typeLower === "x:object") {
      xml += `
          <If DisplayName="Validate ${arg.name}" Condition="[${arg.name} Is Nothing]">
            <If.Then>
              <Throw DisplayName="Throw: ${arg.name} required" Exception="[New BusinessRuleException(&quot;Required argument '${arg.name}' is Nothing&quot;)]" />
            </If.Then>
            <If.Else>
              <ui:LogMessage Level="Trace" Message="'[${workflowName}] ${arg.name} provided'" DisplayName="Log ${arg.name}" />
            </If.Else>
          </If>`;
    } else {
      xml += `
          <ui:LogMessage Level="Trace" Message="'[${workflowName}] ${arg.name} = ${isSensitive ? "****" : `' + ${arg.name}.ToString()`}'" DisplayName="Log ${arg.name}" />`;
    }
  }

  xml += `
          <ui:LogMessage Level="Trace" Message="'[${workflowName}] All arguments validated successfully'" DisplayName="Log Validation Complete" />
        </Sequence>`;

  return xml;
}
