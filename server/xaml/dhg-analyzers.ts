export interface CredentialAssetEntry {
  file: string;
  activityType: "GetCredential" | "GetAsset" | "SetCredential" | "SetAsset";
  assetName: string;
  isHardcoded: boolean;
  variableName?: string;
  lineNumber: number;
}

export interface CredentialAssetInventory {
  entries: CredentialAssetEntry[];
  hardcodedCount: number;
  variableCount: number;
  uniqueAssetNames: string[];
  uniqueCredentialNames: string[];
}

export interface ExceptionCoverageEntry {
  file: string;
  activityName: string;
  lineNumber: number;
  insideTryCatch: boolean;
  catchTypes: string[];
}

export interface ExceptionCoverageResult {
  entries: ExceptionCoverageEntry[];
  totalActivities: number;
  coveredActivities: number;
  coveragePercent: number;
  uncoveredHighRiskActivities: string[];
  filesWithoutTryCatch: string[];
}

export interface QueueUsageEntry {
  file: string;
  activityType: string;
  queueName: string;
  isHardcoded: boolean;
  lineNumber: number;
}

export interface QueueManagementResult {
  entries: QueueUsageEntry[];
  uniqueQueues: string[];
  hasAddQueueItem: boolean;
  hasGetTransaction: boolean;
  hasSetTransactionStatus: boolean;
  isTransactionalPattern: boolean;
}

export interface EnvironmentRequirements {
  needsWindowsTarget: boolean;
  needsAttendedRobot: boolean;
  usesModernActivities: boolean;
  browserExtensions: string[];
  requiredPackages: string[];
  usesOrchestrator: boolean;
  usesActionCenter: boolean;
  usesAICenter: boolean;
  usesDocumentUnderstanding: boolean;
  usesDataService: boolean;
}

export interface TriggerSuggestion {
  triggerType: "Schedule" | "Queue" | "API/Webhook" | "Attended" | "EventBased";
  reason: string;
  suggestedConfig?: string;
}

const ASSET_ACTIVITY_PATTERN = /<ui:(GetCredential|GetAsset|SetCredential|SetAsset)\b[^>]*>/g;
const ASSET_NAME_ATTR = /\bAssetName\s*=\s*"([^"]*)"/;
const CREDENTIAL_NAME_ATTR = /\bCredentialName\s*=\s*"([^"]*)"/;
const RESULT_ATTR = /\bResult\s*=\s*"\[([^\]]+)\]"/;

const HIGH_RISK_ACTIVITIES = new Set([
  "ui:HttpClient", "uweb:HttpClient",
  "ui:ExecuteQuery", "udb:ExecuteQuery",
  "ui:SendSmtpMailMessage", "umail:SendSmtpMailMessage",
  "ui:InvokeCode",
  "ui:StartProcess",
  "ui:TypeInto", "ui:Click",
  "ui:GetCredential", "ui:GetAsset",
  "ui:AddQueueItem", "ui:GetTransactionItem",
  "ui:ExcelApplicationScope", "ui:UseExcel",
]);

const BROWSER_EXTENSION_INDICATORS: Array<{ pattern: RegExp; extension: string }> = [
  { pattern: /UseBrowser|OpenBrowser|NavigateTo/i, extension: "Chrome/Edge UiPath Extension" },
  { pattern: /UseApplicationCard.*chrome/i, extension: "Chrome UiPath Extension" },
  { pattern: /UseApplicationCard.*edge/i, extension: "Edge UiPath Extension" },
  { pattern: /UseApplicationCard.*firefox/i, extension: "Firefox UiPath Extension" },
  { pattern: /JavaScope|JavaElement/i, extension: "Java Bridge Extension" },
  { pattern: /CitrixScope|CitrixRecorder/i, extension: "Citrix Extension" },
];

const MODERN_ACTIVITY_INDICATORS = [
  "UseApplication", "UseBrowser", "UseExcel",
  "Target.Selector", "Target.Timeout",
  "ObjectContainer",
];

export function scanCredentialAssets(
  xamlEntries: { name: string; content: string }[],
): CredentialAssetInventory {
  const entries: CredentialAssetEntry[] = [];

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const lines = entry.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const activityMatch = line.match(/<ui:(GetCredential|GetAsset|SetCredential|SetAsset)\b/);
      if (!activityMatch) continue;

      const activityType = activityMatch[1] as CredentialAssetEntry["activityType"];
      const isCredential = activityType === "GetCredential" || activityType === "SetCredential";
      const nameAttr = isCredential ? CREDENTIAL_NAME_ATTR : ASSET_NAME_ATTR;

      const contextBlock = lines.slice(i, Math.min(i + 5, lines.length)).join("\n");
      const nameMatch = contextBlock.match(nameAttr) || contextBlock.match(ASSET_NAME_ATTR);
      const assetName = nameMatch ? nameMatch[1] : "UNKNOWN";

      const isHardcoded = !!nameMatch && !nameMatch[1].startsWith("[") && !nameMatch[1].includes("variable");

      const resultMatch = contextBlock.match(RESULT_ATTR);
      const variableName = resultMatch ? resultMatch[1] : undefined;

      entries.push({
        file: shortName,
        activityType,
        assetName,
        isHardcoded,
        variableName,
        lineNumber: i + 1,
      });
    }
  }

  const hardcodedCount = entries.filter(e => e.isHardcoded).length;
  const variableCount = entries.filter(e => !e.isHardcoded).length;
  const uniqueAssetNames = [...new Set(
    entries.filter(e => e.activityType === "GetAsset" || e.activityType === "SetAsset")
      .map(e => e.assetName)
      .filter(n => n !== "UNKNOWN"),
  )];
  const uniqueCredentialNames = [...new Set(
    entries.filter(e => e.activityType === "GetCredential" || e.activityType === "SetCredential")
      .map(e => e.assetName)
      .filter(n => n !== "UNKNOWN"),
  )];

  return { entries, hardcodedCount, variableCount, uniqueAssetNames, uniqueCredentialNames };
}

export function analyzeExceptionCoverage(
  xamlEntries: { name: string; content: string }[],
): ExceptionCoverageResult {
  const entries: ExceptionCoverageEntry[] = [];
  const filesWithoutTryCatch: string[] = [];

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;
    const hasTryCatch = /<TryCatch[\s>]/.test(content);

    if (!hasTryCatch) {
      filesWithoutTryCatch.push(shortName);
    }

    const tryCatchRanges = findTryCatchRanges(content);
    const catchTypesMap = extractCatchTypes(content);
    const lines = content.split("\n");

    const lineOffsets: number[] = [];
    let runningOffset = 0;
    for (let li = 0; li < lines.length; li++) {
      lineOffsets.push(runningOffset);
      runningOffset += lines[li].length + 1;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const actTag of HIGH_RISK_ACTIVITIES) {
        const prefix = actTag.split(":")[0];
        const name = actTag.split(":")[1];
        if (line.includes(`<${prefix}:${name}`) || line.includes(`<${prefix}:${name} `)) {
          const charOffset = lineOffsets[i];
          const insideTryCatch = tryCatchRanges.some(r => charOffset >= r.start && charOffset <= r.end);
          const catchTypes = insideTryCatch
            ? (catchTypesMap.find(c => charOffset >= c.start && charOffset <= c.end)?.types || [])
            : [];

          const displayNameMatch = line.match(/DisplayName="([^"]*)"/);

          entries.push({
            file: shortName,
            activityName: displayNameMatch ? displayNameMatch[1] : actTag,
            lineNumber: i + 1,
            insideTryCatch,
            catchTypes,
          });
          break;
        }
      }
    }
  }

  const totalActivities = entries.length;
  const coveredActivities = entries.filter(e => e.insideTryCatch).length;
  const coveragePercent = totalActivities > 0 ? Math.round((coveredActivities / totalActivities) * 100) : 100;
  const uncoveredHighRiskActivities = entries
    .filter(e => !e.insideTryCatch)
    .map(e => `${e.file}:${e.lineNumber} ${e.activityName}`);

  return {
    entries,
    totalActivities,
    coveredActivities,
    coveragePercent,
    uncoveredHighRiskActivities,
    filesWithoutTryCatch,
  };
}

interface TagRange {
  start: number;
  end: number;
}

interface CatchTypeRange extends TagRange {
  types: string[];
}

function findTryCatchRanges(content: string): TagRange[] {
  const ranges: TagRange[] = [];
  const openPattern = /<TryCatch[\s>]/g;
  const closeTag = "</TryCatch>";
  let match;

  while ((match = openPattern.exec(content)) !== null) {
    const start = match.index;
    let depth = 1;
    let pos = start + match[0].length;

    while (pos < content.length && depth > 0) {
      const nestedOpenPattern = /<TryCatch[\s>]/g;
      nestedOpenPattern.lastIndex = pos;
      const nextOpenMatch = nestedOpenPattern.exec(content);
      const nextCloseIdx = content.indexOf(closeTag, pos);

      if (nextCloseIdx === -1) break;

      if (nextOpenMatch && nextOpenMatch.index < nextCloseIdx) {
        depth++;
        pos = nextOpenMatch.index + nextOpenMatch[0].length;
      } else {
        depth--;
        if (depth === 0) {
          ranges.push({ start, end: nextCloseIdx + closeTag.length });
        }
        pos = nextCloseIdx + closeTag.length;
      }
    }
  }

  return ranges;
}

function extractCatchTypes(content: string): CatchTypeRange[] {
  const results: CatchTypeRange[] = [];
  const tryCatchRanges = findTryCatchRanges(content);

  for (const range of tryCatchRanges) {
    const block = content.slice(range.start, range.end);
    const types: string[] = [];
    const catchTypePattern = /TypeArgument="([^"]+)"/g;
    let m;
    while ((m = catchTypePattern.exec(block)) !== null) {
      const contextBefore = block.slice(Math.max(0, m.index - 100), m.index);
      if (contextBefore.includes("Catch") || contextBefore.includes("ActivityAction")) {
        types.push(m[1]);
      }
    }
    results.push({ ...range, types: [...new Set(types)] });
  }

  return results;
}

export function extractQueueManagement(
  xamlEntries: { name: string; content: string }[],
): QueueManagementResult {
  const entries: QueueUsageEntry[] = [];

  const queueActivities = [
    { pattern: /<ui:AddQueueItem\b/g, type: "AddQueueItem" },
    { pattern: /<ui:GetTransactionItem\b/g, type: "GetTransactionItem" },
    { pattern: /<ui:SetTransactionStatus\b/g, type: "SetTransactionStatus" },
    { pattern: /<ui:SetTransactionProgress\b/g, type: "SetTransactionProgress" },
    { pattern: /<ui:GetQueueItems\b/g, type: "GetQueueItems" },
    { pattern: /<ui:DeleteQueueItems\b/g, type: "DeleteQueueItems" },
    { pattern: /<ui:PostponeTransactionItem\b/g, type: "PostponeTransactionItem" },
    { pattern: /<ui:BulkAddQueueItems\b/g, type: "BulkAddQueueItems" },
  ];

  const queueNamePattern = /QueueName\s*=\s*"([^"]*)"/;

  for (const entry of xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const lines = entry.content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      for (const qa of queueActivities) {
        qa.pattern.lastIndex = 0;
        if (qa.pattern.test(lines[i])) {
          const contextBlock = lines.slice(i, Math.min(i + 5, lines.length)).join("\n");
          const nameMatch = contextBlock.match(queueNamePattern);
          const queueName = nameMatch ? nameMatch[1] : "UNKNOWN";
          const isHardcoded = !!nameMatch && !nameMatch[1].startsWith("[");

          entries.push({
            file: shortName,
            activityType: qa.type,
            queueName,
            isHardcoded,
            lineNumber: i + 1,
          });
          break;
        }
      }
    }
  }

  const uniqueQueues = [...new Set(entries.map(e => e.queueName).filter(n => n !== "UNKNOWN"))];
  const hasAddQueueItem = entries.some(e => e.activityType === "AddQueueItem" || e.activityType === "BulkAddQueueItems");
  const hasGetTransaction = entries.some(e => e.activityType === "GetTransactionItem");
  const hasSetTransactionStatus = entries.some(e => e.activityType === "SetTransactionStatus");
  const isTransactionalPattern = hasGetTransaction && hasSetTransactionStatus;

  return {
    entries,
    uniqueQueues,
    hasAddQueueItem,
    hasGetTransaction,
    hasSetTransactionStatus,
    isTransactionalPattern,
  };
}

export function detectEnvironmentRequirements(
  xamlEntries: { name: string; content: string }[],
  projectJsonContent?: string,
): EnvironmentRequirements {
  const allContent = xamlEntries.map(e => e.content).join("\n");

  const needsWindowsTarget =
    allContent.includes("ExcelApplicationScope") ||
    allContent.includes("OutlookScope") ||
    allContent.includes("WordApplicationScope") ||
    allContent.includes("SAP.") ||
    allContent.includes("CitrixScope");

  const needsAttendedRobot =
    allContent.includes("InputDialog") ||
    allContent.includes("MessageBox") ||
    allContent.includes("SelectFile") ||
    allContent.includes("SelectFolder") ||
    allContent.includes("CalloutScope");

  const usesModernActivities = MODERN_ACTIVITY_INDICATORS.some(ind => allContent.includes(ind));

  const browserExtensions: string[] = [];
  for (const indicator of BROWSER_EXTENSION_INDICATORS) {
    if (indicator.pattern.test(allContent)) {
      browserExtensions.push(indicator.extension);
    }
  }

  let requiredPackages: string[] = [];
  if (projectJsonContent) {
    try {
      const pj = JSON.parse(projectJsonContent);
      requiredPackages = Object.keys(pj.dependencies || {});
    } catch {}
  }

  const usesOrchestrator =
    allContent.includes("GetCredential") ||
    allContent.includes("GetAsset") ||
    allContent.includes("SetAsset") ||
    allContent.includes("AddQueueItem") ||
    allContent.includes("GetTransactionItem") ||
    allContent.includes("SetTransactionStatus");

  const usesActionCenter =
    allContent.includes("CreateFormTask") ||
    allContent.includes("WaitForFormTaskAndResume") ||
    allContent.includes("CreateExternalTask");

  const usesAICenter =
    allContent.includes("MLSkill") ||
    allContent.includes("MachineLearningScope") ||
    allContent.includes("MLModel");

  const usesDocumentUnderstanding =
    allContent.includes("DocumentUnderstanding") ||
    allContent.includes("DigitizeDocument") ||
    allContent.includes("ClassifyDocument") ||
    allContent.includes("ExtractData");

  const usesDataService =
    allContent.includes("DataService") ||
    allContent.includes("QueryEntity") ||
    allContent.includes("CreateEntity") ||
    allContent.includes("UpdateEntity") ||
    allContent.includes("DeleteEntity");

  return {
    needsWindowsTarget,
    needsAttendedRobot,
    usesModernActivities,
    browserExtensions: [...new Set(browserExtensions)],
    requiredPackages,
    usesOrchestrator,
    usesActionCenter,
    usesAICenter,
    usesDocumentUnderstanding,
    usesDataService,
  };
}

export function suggestTriggers(
  queueResult: QueueManagementResult,
  envResult: EnvironmentRequirements,
  automationType?: string,
): TriggerSuggestion[] {
  const suggestions: TriggerSuggestion[] = [];

  if (queueResult.isTransactionalPattern) {
    suggestions.push({
      triggerType: "Queue",
      reason: "Process uses GetTransactionItem/SetTransactionStatus — configure a queue trigger in Orchestrator",
      suggestedConfig: queueResult.uniqueQueues.length > 0
        ? `Queue: ${queueResult.uniqueQueues[0]}`
        : "Configure queue name in Orchestrator",
    });
  }

  if (envResult.needsAttendedRobot) {
    suggestions.push({
      triggerType: "Attended",
      reason: "Process uses UI dialogs (InputDialog/MessageBox) — requires attended robot with user interaction",
    });
  }

  if (automationType === "agent" || automationType === "hybrid") {
    suggestions.push({
      triggerType: "API/Webhook",
      reason: "Agent/hybrid automation — consider API trigger or webhook for on-demand invocation",
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      triggerType: "Schedule",
      reason: "Standard unattended process — configure a time-based schedule trigger in Orchestrator",
      suggestedConfig: "Suggested: Daily or per business requirement",
    });
  }

  return suggestions;
}

export interface ReadinessScore {
  section: string;
  score: number;
  maxScore: number;
  notes: string[];
}

export interface OverallReadiness {
  sections: ReadinessScore[];
  totalScore: number;
  maxTotalScore: number;
  percent: number;
  rating: "Ready" | "Mostly Ready" | "Needs Work" | "Not Ready";
}

export function calculateReadiness(
  credentialInventory: CredentialAssetInventory,
  exceptionCoverage: ExceptionCoverageResult,
  queueManagement: QueueManagementResult,
  envRequirements: EnvironmentRequirements,
  qualityWarningCount: number,
  remediationCount: number,
): OverallReadiness {
  const sections: ReadinessScore[] = [];

  {
    let score = 10;
    const notes: string[] = [];
    if (credentialInventory.hardcodedCount > 0) {
      score -= Math.min(5, credentialInventory.hardcodedCount * 2);
      notes.push(`${credentialInventory.hardcodedCount} hardcoded asset name(s) — use Orchestrator assets/config`);
    }
    if (credentialInventory.entries.length === 0 && envRequirements.usesOrchestrator) {
      score -= 2;
      notes.push("No credential/asset activities found despite Orchestrator usage");
    }
    if (notes.length === 0) notes.push("All credentials/assets properly configured");
    sections.push({ section: "Credentials & Assets", score: Math.max(0, score), maxScore: 10, notes });
  }

  {
    let score = 10;
    const notes: string[] = [];
    if (exceptionCoverage.totalActivities === 0) {
      notes.push("No high-risk activities detected — exception handling not scored");
    } else {
      if (exceptionCoverage.coveragePercent < 50) {
        score -= 5;
        notes.push(`Only ${exceptionCoverage.coveragePercent}% of high-risk activities covered by TryCatch`);
      } else if (exceptionCoverage.coveragePercent < 80) {
        score -= 3;
        notes.push(`${exceptionCoverage.coveragePercent}% coverage — consider wrapping remaining activities`);
      }
      if (exceptionCoverage.filesWithoutTryCatch.length > 0) {
        score -= Math.min(3, exceptionCoverage.filesWithoutTryCatch.length);
        notes.push(`${exceptionCoverage.filesWithoutTryCatch.length} file(s) with no TryCatch blocks`);
      }
    }
    if (notes.length === 0) notes.push("Good exception handling coverage");
    sections.push({ section: "Exception Handling", score: Math.max(0, score), maxScore: 10, notes });
  }

  {
    let score = 10;
    const notes: string[] = [];
    if (queueManagement.hasGetTransaction && !queueManagement.hasSetTransactionStatus) {
      score -= 5;
      notes.push("GetTransactionItem found without SetTransactionStatus — incomplete transaction handling");
    }
    const hardcodedQueues = queueManagement.entries.filter(e => e.isHardcoded).length;
    if (hardcodedQueues > 0) {
      score -= Math.min(3, hardcodedQueues);
      notes.push(`${hardcodedQueues} hardcoded queue name(s) — externalize to config`);
    }
    if (queueManagement.entries.length === 0) {
      score = 10;
      notes.length = 0;
      notes.push("No queue activities — section not applicable");
    }
    if (notes.length === 0) notes.push("Queue configuration looks good");
    sections.push({ section: "Queue Management", score: Math.max(0, score), maxScore: 10, notes });
  }

  {
    let score = 10;
    const notes: string[] = [];
    if (qualityWarningCount > 10) {
      score -= 5;
      notes.push(`${qualityWarningCount} quality warnings — significant remediation needed`);
    } else if (qualityWarningCount > 3) {
      score -= 2;
      notes.push(`${qualityWarningCount} quality warnings to address`);
    }
    if (remediationCount > 5) {
      score -= 4;
      notes.push(`${remediationCount} remediations — stub replacements need developer attention`);
    } else if (remediationCount > 0) {
      score -= 2;
      notes.push(`${remediationCount} remediation(s) to complete`);
    }
    if (notes.length === 0) notes.push("Build quality is clean");
    sections.push({ section: "Build Quality", score: Math.max(0, score), maxScore: 10, notes });
  }

  {
    let score = 10;
    const notes: string[] = [];
    if (envRequirements.requiredPackages.length === 0) {
      score -= 3;
      notes.push("No dependency packages detected in project.json");
    }
    if (envRequirements.browserExtensions.length > 0) {
      score -= 1;
      notes.push(`Browser extensions required: ${envRequirements.browserExtensions.join(", ")}`);
    }
    if (notes.length === 0) notes.push("Environment requirements are straightforward");
    sections.push({ section: "Environment Setup", score: Math.max(0, score), maxScore: 10, notes });
  }

  const totalScore = sections.reduce((s, sec) => s + sec.score, 0);
  const maxTotalScore = sections.reduce((s, sec) => s + sec.maxScore, 0);
  const percent = maxTotalScore > 0 ? Math.round((totalScore / maxTotalScore) * 100) : 0;

  let rating: OverallReadiness["rating"];
  if (percent >= 85) rating = "Ready";
  else if (percent >= 65) rating = "Mostly Ready";
  else if (percent >= 40) rating = "Needs Work";
  else rating = "Not Ready";

  return { sections, totalScore, maxTotalScore, percent, rating };
}

export interface DhgAnalysisResult {
  credentialInventory: CredentialAssetInventory;
  exceptionCoverage: ExceptionCoverageResult;
  queueManagement: QueueManagementResult;
  environmentRequirements: EnvironmentRequirements;
  triggerSuggestions: TriggerSuggestion[];
  readiness: OverallReadiness;
}

export function runDhgAnalysis(
  xamlEntries: { name: string; content: string }[],
  projectJsonContent?: string,
  qualityWarningCount?: number,
  remediationCount?: number,
  automationType?: string,
): DhgAnalysisResult {
  const credentialInventory = scanCredentialAssets(xamlEntries);
  const exceptionCoverage = analyzeExceptionCoverage(xamlEntries);
  const queueManagement = extractQueueManagement(xamlEntries);
  const environmentRequirements = detectEnvironmentRequirements(xamlEntries, projectJsonContent);
  const triggerSuggestions = suggestTriggers(queueManagement, environmentRequirements, automationType);
  const readiness = calculateReadiness(
    credentialInventory,
    exceptionCoverage,
    queueManagement,
    environmentRequirements,
    qualityWarningCount || 0,
    remediationCount || 0,
  );

  return {
    credentialInventory,
    exceptionCoverage,
    queueManagement,
    environmentRequirements,
    triggerSuggestions,
    readiness,
  };
}
