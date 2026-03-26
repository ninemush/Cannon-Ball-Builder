import { describe, it, expect } from "vitest";
import {
  scanCredentialAssets,
  analyzeExceptionCoverage,
  extractQueueManagement,
  detectEnvironmentRequirements,
  suggestTriggers,
  calculateReadiness,
  runDhgAnalysis,
  type CredentialAssetInventory,
  type ExceptionCoverageResult,
  type QueueManagementResult,
  type EnvironmentRequirements,
} from "../xaml/dhg-analyzers";
import { generateDhgFromOutcomeReport, type DhgContext } from "../dhg-generator";
import type { PipelineOutcomeReport } from "../uipath-pipeline";

function makeQueueResult(overrides: Partial<QueueManagementResult> = {}): QueueManagementResult {
  return {
    entries: [],
    uniqueQueues: [],
    hasAddQueueItem: false,
    hasGetTransaction: false,
    hasSetTransactionStatus: false,
    isTransactionalPattern: false,
    retryPolicy: { maxRetries: 0, autoRetryEnabled: false, note: "N/A" },
    slaGuidance: "No queue-based SLA applicable.",
    deadLetterHandling: "No dead-letter handling applicable — process does not consume queue items.",
    ...overrides,
  };
}

function makeEnvResult(overrides: Partial<EnvironmentRequirements> = {}): EnvironmentRequirements {
  return {
    needsWindowsTarget: false,
    needsAttendedRobot: false,
    usesModernActivities: true,
    browserExtensions: [],
    requiredPackages: [],
    usesOrchestrator: false,
    usesActionCenter: false,
    usesAICenter: false,
    usesDocumentUnderstanding: false,
    usesDataService: false,
    machineTemplate: { recommendedType: "Standard", note: "Standard unattended machine template" },
    orchestratorFolderGuidance: "Create a Modern Folder with at least one unattended robot assignment.",
    studioVersion: "25.10.0",
    ...overrides,
  };
}

function makeXaml(body: string): string {
  return `<Activity xmlns:ui="http://schemas.uipath.com/workflow/activities"
    xmlns:uweb="http://schemas.uipath.com/workflow/activities/web"
    xmlns:udb="http://schemas.uipath.com/workflow/activities/database"
    xmlns:umail="http://schemas.uipath.com/workflow/activities/mail"
    xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
    <Sequence DisplayName="Main">
      ${body}
    </Sequence>
  </Activity>`;
}

describe("scanCredentialAssets", () => {
  it("detects GetCredential with hardcoded name", () => {
    const xaml = makeXaml(`<ui:GetCredential CredentialName="MyAppLogin" Result="[cred_Output]" />`);
    const result = scanCredentialAssets([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].activityType).toBe("GetCredential");
    expect(result.entries[0].assetName).toBe("MyAppLogin");
    expect(result.entries[0].isHardcoded).toBe(true);
    expect(result.entries[0].variableName).toBe("cred_Output");
    expect(result.uniqueCredentialNames).toEqual(["MyAppLogin"]);
    expect(result.hardcodedCount).toBe(1);
  });

  it("detects GetAsset with hardcoded name", () => {
    const xaml = makeXaml(`<ui:GetAsset AssetName="Config_URL" Result="[str_URL]" />`);
    const result = scanCredentialAssets([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].activityType).toBe("GetAsset");
    expect(result.entries[0].assetName).toBe("Config_URL");
    expect(result.uniqueAssetNames).toEqual(["Config_URL"]);
  });

  it("detects SetCredential", () => {
    const xaml = makeXaml(`<ui:SetCredential CredentialName="NewCred" />`);
    const result = scanCredentialAssets([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].activityType).toBe("SetCredential");
  });

  it("detects SetAsset", () => {
    const xaml = makeXaml(`<ui:SetAsset AssetName="LastRunDate" />`);
    const result = scanCredentialAssets([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].activityType).toBe("SetAsset");
  });

  it("detects variable-driven asset names", () => {
    const xaml = makeXaml(`<ui:GetAsset AssetName="[config_AssetName]" />`);
    const result = scanCredentialAssets([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].isHardcoded).toBe(false);
    expect(result.variableCount).toBe(1);
  });

  it("returns empty for no asset activities", () => {
    const xaml = makeXaml(`<ui:LogMessage Text="Hello" />`);
    const result = scanCredentialAssets([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(0);
    expect(result.uniqueAssetNames).toEqual([]);
    expect(result.uniqueCredentialNames).toEqual([]);
  });

  it("handles multiple assets across files", () => {
    const xaml1 = makeXaml(`<ui:GetCredential CredentialName="Cred1" />`);
    const xaml2 = makeXaml(`<ui:GetAsset AssetName="Asset1" />\n<ui:GetAsset AssetName="Asset2" />`);
    const result = scanCredentialAssets([
      { name: "lib/Login.xaml", content: xaml1 },
      { name: "lib/Process.xaml", content: xaml2 },
    ]);
    expect(result.entries.length).toBe(3);
    expect(result.uniqueCredentialNames).toEqual(["Cred1"]);
    expect(result.uniqueAssetNames).toContain("Asset1");
    expect(result.uniqueAssetNames).toContain("Asset2");
  });

  it("infers Credential assetValueType for GetCredential", () => {
    const xaml = makeXaml(`<ui:GetCredential CredentialName="MyLogin" Result="[cred_Out]" />`);
    const result = scanCredentialAssets([{ name: "Main.xaml", content: xaml }]);
    expect(result.entries[0].assetValueType).toBe("Credential");
  });

  it("reads explicit AssetType attribute", () => {
    const xaml = makeXaml(`<ui:GetAsset AssetName="MaxRetry" AssetType="Integer" Result="[int_Retry]" />`);
    const result = scanCredentialAssets([{ name: "Main.xaml", content: xaml }]);
    expect(result.entries[0].assetValueType).toBe("Integer");
  });

  it("infers asset type from variable name heuristics", () => {
    const xaml = makeXaml(`<ui:GetAsset AssetName="SomeFlag" Result="[bool_Flag]" />`);
    const result = scanCredentialAssets([{ name: "Main.xaml", content: xaml }]);
    expect(result.entries[0].assetValueType).toBe("Boolean");
  });
});

describe("analyzeExceptionCoverage", () => {
  it("detects activities inside TryCatch", () => {
    const xaml = makeXaml(`
      <TryCatch DisplayName="Error Handler">
        <TryCatch.Try>
          <ui:HttpClient DisplayName="Call API" />
        </TryCatch.Try>
        <TryCatch.Catches>
          <Catch TypeArgument="System.Exception">
            <ActivityAction />
          </Catch>
        </TryCatch.Catches>
      </TryCatch>
    `);
    const result = analyzeExceptionCoverage([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.totalActivities).toBeGreaterThanOrEqual(1);
    expect(result.coveredActivities).toBeGreaterThanOrEqual(1);
    expect(result.coveragePercent).toBe(100);
  });

  it("detects uncovered high-risk activities", () => {
    const xaml = makeXaml(`<ui:HttpClient DisplayName="Call API" />`);
    const result = analyzeExceptionCoverage([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.totalActivities).toBe(1);
    expect(result.coveredActivities).toBe(0);
    expect(result.coveragePercent).toBe(0);
    expect(result.uncoveredHighRiskActivities.length).toBe(1);
  });

  it("identifies files without TryCatch", () => {
    const xaml = makeXaml(`<ui:LogMessage Text="Hello" />`);
    const result = analyzeExceptionCoverage([{ name: "lib/Simple.xaml", content: xaml }]);
    expect(result.filesWithoutTryCatch).toContain("Simple.xaml");
  });

  it("returns 100% coverage when no high-risk activities", () => {
    const xaml = makeXaml(`<ui:LogMessage Text="Hello" />`);
    const result = analyzeExceptionCoverage([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.totalActivities).toBe(0);
    expect(result.coveragePercent).toBe(100);
  });

  it("detects catch types from TypeArgument", () => {
    const xaml = makeXaml(`
      <TryCatch>
        <TryCatch.Try>
          <ui:ExecuteQuery DisplayName="Run Query" />
        </TryCatch.Try>
        <TryCatch.Catches>
          <Catch TypeArgument="System.Exception">
            <ActivityAction />
          </Catch>
          <Catch TypeArgument="System.TimeoutException">
            <ActivityAction />
          </Catch>
        </TryCatch.Catches>
      </TryCatch>
    `);
    const result = analyzeExceptionCoverage([{ name: "lib/Main.xaml", content: xaml }]);
    const dbEntry = result.entries.find(e => e.activityName === "Run Query");
    expect(dbEntry).toBeDefined();
    expect(dbEntry!.insideTryCatch).toBe(true);
    expect(dbEntry!.catchTypes).toContain("System.Exception");
    expect(dbEntry!.catchTypes).toContain("System.TimeoutException");
  });
});

describe("extractQueueManagement", () => {
  it("detects AddQueueItem", () => {
    const xaml = makeXaml(`<ui:AddQueueItem QueueName="InvoiceQueue" />`);
    const result = extractQueueManagement([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(1);
    expect(result.entries[0].activityType).toBe("AddQueueItem");
    expect(result.entries[0].queueName).toBe("InvoiceQueue");
    expect(result.hasAddQueueItem).toBe(true);
    expect(result.uniqueQueues).toEqual(["InvoiceQueue"]);
  });

  it("detects transactional pattern", () => {
    const xaml = makeXaml(`
      <ui:GetTransactionItem QueueName="WorkQueue" />
      <ui:SetTransactionStatus />
    `);
    const result = extractQueueManagement([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.hasGetTransaction).toBe(true);
    expect(result.hasSetTransactionStatus).toBe(true);
    expect(result.isTransactionalPattern).toBe(true);
  });

  it("detects non-transactional queue usage", () => {
    const xaml = makeXaml(`<ui:AddQueueItem QueueName="TestQueue" />`);
    const result = extractQueueManagement([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.isTransactionalPattern).toBe(false);
    expect(result.hasAddQueueItem).toBe(true);
  });

  it("returns empty for no queue activities", () => {
    const xaml = makeXaml(`<ui:LogMessage Text="Hello" />`);
    const result = extractQueueManagement([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(0);
    expect(result.uniqueQueues).toEqual([]);
  });

  it("detects hardcoded vs variable queue names", () => {
    const xaml = makeXaml(`
      <ui:AddQueueItem QueueName="HardcodedQueue" />
      <ui:GetTransactionItem QueueName="[config_QueueName]" />
    `);
    const result = extractQueueManagement([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.entries.length).toBe(2);
    const hardcoded = result.entries.find(e => e.queueName === "HardcodedQueue");
    const variable = result.entries.find(e => e.queueName === "[config_QueueName]");
    expect(hardcoded?.isHardcoded).toBe(true);
    expect(variable?.isHardcoded).toBe(false);
  });

  it("detects BulkAddQueueItems", () => {
    const xaml = makeXaml(`<ui:BulkAddQueueItems QueueName="BulkQueue" />`);
    const result = extractQueueManagement([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.hasAddQueueItem).toBe(true);
    expect(result.entries[0].activityType).toBe("BulkAddQueueItems");
  });

  it("provides retry policy for transactional pattern", () => {
    const xaml = makeXaml(`
      <ui:GetTransactionItem QueueName="Q1" />
      <ui:SetTransactionStatus />
    `);
    const result = extractQueueManagement([{ name: "Main.xaml", content: xaml }]);
    expect(result.retryPolicy.autoRetryEnabled).toBe(true);
    expect(result.retryPolicy.maxRetries).toBe(3);
    expect(result.slaGuidance).toContain("SLA");
    expect(result.deadLetterHandling).toContain("Failed");
  });

  it("provides no retry for dispatcher-only", () => {
    const xaml = makeXaml(`<ui:AddQueueItem QueueName="Q1" />`);
    const result = extractQueueManagement([{ name: "Main.xaml", content: xaml }]);
    expect(result.retryPolicy.autoRetryEnabled).toBe(false);
    expect(result.retryPolicy.note).toContain("Dispatcher");
  });

  it("sets no-queue guidance when no queue activities", () => {
    const xaml = makeXaml(`<ui:LogMessage Text="Hello" />`);
    const result = extractQueueManagement([{ name: "Main.xaml", content: xaml }]);
    expect(result.slaGuidance).toContain("No queue-based SLA applicable");
    expect(result.deadLetterHandling).toContain("does not consume queue items");
  });
});

describe("detectEnvironmentRequirements", () => {
  it("detects Windows-only requirements", () => {
    const xaml = makeXaml(`<ui:ExcelApplicationScope />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.needsWindowsTarget).toBe(true);
  });

  it("detects attended robot needs", () => {
    const xaml = makeXaml(`<ui:InputDialog />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.needsAttendedRobot).toBe(true);
  });

  it("detects modern activities", () => {
    const xaml = makeXaml(`<ui:UseApplication />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.usesModernActivities).toBe(true);
  });

  it("detects browser extension needs", () => {
    const xaml = makeXaml(`<ui:UseBrowser />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.browserExtensions.length).toBeGreaterThan(0);
  });

  it("detects Orchestrator usage", () => {
    const xaml = makeXaml(`<ui:GetCredential CredentialName="Test" />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.usesOrchestrator).toBe(true);
  });

  it("detects Action Center usage", () => {
    const xaml = makeXaml(`<ui:CreateFormTask />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.usesActionCenter).toBe(true);
  });

  it("detects AI Center usage", () => {
    const xaml = makeXaml(`<ui:MLSkill />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.usesAICenter).toBe(true);
  });

  it("detects Document Understanding usage", () => {
    const xaml = makeXaml(`<ui:DigitizeDocument />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.usesDocumentUnderstanding).toBe(true);
  });

  it("detects Data Service usage", () => {
    const xaml = makeXaml(`<ui:QueryEntity />`);
    const result = detectEnvironmentRequirements([{ name: "lib/Main.xaml", content: xaml }]);
    expect(result.usesDataService).toBe(true);
  });

  it("extracts packages from project.json", () => {
    const projectJson = JSON.stringify({
      dependencies: {
        "UiPath.System.Activities": "[25.10.0]",
        "UiPath.Excel.Activities": "[25.10.0]",
      },
    });
    const result = detectEnvironmentRequirements([], projectJson);
    expect(result.requiredPackages).toContain("UiPath.System.Activities");
    expect(result.requiredPackages).toContain("UiPath.Excel.Activities");
  });

  it("handles missing project.json gracefully", () => {
    const result = detectEnvironmentRequirements([]);
    expect(result.requiredPackages).toEqual([]);
  });

  it("provides machine template for AI Center workloads", () => {
    const xaml = makeXaml(`<ui:MLSkill />`);
    const result = detectEnvironmentRequirements([{ name: "Main.xaml", content: xaml }]);
    expect(result.machineTemplate.recommendedType).toBe("Server");
  });

  it("provides Serverless for modern cross-platform", () => {
    const xaml = makeXaml(`<ui:UseApplication />`);
    const result = detectEnvironmentRequirements([{ name: "Main.xaml", content: xaml }]);
    expect(result.machineTemplate.recommendedType).toBe("Serverless");
  });

  it("provides Standard for attended robot", () => {
    const xaml = makeXaml(`<ui:InputDialog />`);
    const result = detectEnvironmentRequirements([{ name: "Main.xaml", content: xaml }]);
    expect(result.machineTemplate.recommendedType).toBe("Standard");
    expect(result.machineTemplate.note).toContain("interactive session");
  });

  it("provides orchestrator folder guidance", () => {
    const xaml = makeXaml(`<ui:GetCredential CredentialName="Test" />`);
    const result = detectEnvironmentRequirements([{ name: "Main.xaml", content: xaml }]);
    expect(result.orchestratorFolderGuidance).toContain("Modern Folder");
  });

  it("defaults studioVersion to 25.10.0", () => {
    const result = detectEnvironmentRequirements([]);
    expect(result.studioVersion).toBe("25.10.0");
  });

  it("extracts studioVersion from project.json", () => {
    const pj = JSON.stringify({ studioVersion: "24.10.6" });
    const result = detectEnvironmentRequirements([], pj);
    expect(result.studioVersion).toBe("24.10.6");
  });
});

describe("suggestTriggers", () => {
  it("suggests queue trigger for transactional pattern", () => {
    const qResult = makeQueueResult({ uniqueQueues: ["WorkQueue"], hasGetTransaction: true, hasSetTransactionStatus: true, isTransactionalPattern: true });
    const envResult = makeEnvResult({ usesOrchestrator: true });
    const triggers = suggestTriggers(qResult, envResult);
    expect(triggers.some(t => t.triggerType === "Queue")).toBe(true);
    expect(triggers[0].suggestedConfig).toContain("WorkQueue");
  });

  it("suggests attended trigger for attended robot", () => {
    const qResult = makeQueueResult();
    const envResult = makeEnvResult({ needsAttendedRobot: true });
    const triggers = suggestTriggers(qResult, envResult);
    expect(triggers.some(t => t.triggerType === "Attended")).toBe(true);
    expect(triggers[0].suggestedConfig).toContain("Assistant");
  });

  it("suggests schedule trigger as default with cron expression", () => {
    const qResult = makeQueueResult();
    const envResult = makeEnvResult();
    const triggers = suggestTriggers(qResult, envResult);
    expect(triggers.some(t => t.triggerType === "Schedule")).toBe(true);
    expect(triggers[0].suggestedConfig).toContain("Cron:");
  });

  it("suggests API trigger for agent automation", () => {
    const qResult = makeQueueResult();
    const envResult = makeEnvResult();
    const triggers = suggestTriggers(qResult, envResult, "agent");
    expect(triggers.some(t => t.triggerType === "API/Webhook")).toBe(true);
    expect(triggers[0].suggestedConfig).toContain("StartJobs");
  });

  it("suggests event trigger for Action Center usage", () => {
    const qResult = makeQueueResult();
    const envResult = makeEnvResult({ usesActionCenter: true });
    const triggers = suggestTriggers(qResult, envResult);
    expect(triggers.some(t => t.triggerType === "EventBased")).toBe(true);
  });
});

describe("calculateReadiness", () => {
  const emptyCred: CredentialAssetInventory = {
    entries: [],
    hardcodedCount: 0,
    variableCount: 0,
    uniqueAssetNames: [],
    uniqueCredentialNames: [],
  };
  const emptyExc: ExceptionCoverageResult = {
    entries: [],
    totalActivities: 0,
    coveredActivities: 0,
    coveragePercent: 100,
    uncoveredHighRiskActivities: [],
    filesWithoutTryCatch: [],
  };
  const emptyQueue = makeQueueResult();
  const simpleEnv = makeEnvResult({ requiredPackages: ["UiPath.System.Activities"] });

  it("returns Ready for clean package", () => {
    const result = calculateReadiness(emptyCred, emptyExc, emptyQueue, simpleEnv, 0, 0);
    expect(result.rating).toBe("Ready");
    expect(result.percent).toBeGreaterThanOrEqual(85);
  });

  it("penalizes hardcoded credentials", () => {
    const cred: CredentialAssetInventory = {
      entries: [{ file: "Main.xaml", activityType: "GetAsset", assetName: "Test", isHardcoded: true, lineNumber: 1, assetValueType: "Unknown" as const }],
      hardcodedCount: 1,
      variableCount: 0,
      uniqueAssetNames: ["Test"],
      uniqueCredentialNames: [],
    };
    const result = calculateReadiness(cred, emptyExc, emptyQueue, simpleEnv, 0, 0);
    const credSection = result.sections.find(s => s.section === "Credentials & Assets");
    expect(credSection!.score).toBeLessThan(credSection!.maxScore);
  });

  it("penalizes low exception coverage", () => {
    const exc: ExceptionCoverageResult = {
      entries: [
        { file: "Main.xaml", activityName: "ui:HttpClient", lineNumber: 10, insideTryCatch: false, catchTypes: [] },
        { file: "Main.xaml", activityName: "ui:ExecuteQuery", lineNumber: 20, insideTryCatch: false, catchTypes: [] },
      ],
      totalActivities: 2,
      coveredActivities: 0,
      coveragePercent: 0,
      uncoveredHighRiskActivities: ["Main.xaml:10 ui:HttpClient", "Main.xaml:20 ui:ExecuteQuery"],
      filesWithoutTryCatch: ["Main.xaml"],
    };
    const result = calculateReadiness(emptyCred, exc, emptyQueue, simpleEnv, 0, 0);
    const excSection = result.sections.find(s => s.section === "Exception Handling");
    expect(excSection!.score).toBeLessThan(5);
  });

  it("returns lower rating for many issues", () => {
    const exc: ExceptionCoverageResult = {
      entries: Array(5).fill(null).map((_, i) => ({
        file: "Main.xaml",
        activityName: `Activity${i}`,
        lineNumber: i * 10,
        insideTryCatch: false,
        catchTypes: [],
      })),
      totalActivities: 5,
      coveredActivities: 0,
      coveragePercent: 0,
      uncoveredHighRiskActivities: Array(5).fill("Main.xaml:1 Activity"),
      filesWithoutTryCatch: ["Main.xaml", "Sub1.xaml", "Sub2.xaml", "Sub3.xaml"],
    };
    const result = calculateReadiness(emptyCred, exc, emptyQueue, simpleEnv, 15, 10);
    expect(result.percent).toBeLessThan(85);
    expect(result.rating !== "Ready").toBe(true);
  });

  it("penalizes GetTransactionItem without SetTransactionStatus", () => {
    const queue = makeQueueResult({
      entries: [{ file: "Main.xaml", activityType: "GetTransactionItem", queueName: "Q1", isHardcoded: true, lineNumber: 1 }],
      uniqueQueues: ["Q1"],
      hasGetTransaction: true,
    });
    const result = calculateReadiness(emptyCred, emptyExc, queue, simpleEnv, 0, 0);
    const queueSection = result.sections.find(s => s.section === "Queue Management");
    expect(queueSection!.score).toBeLessThan(queueSection!.maxScore);
    expect(queueSection!.notes.some(n => n.includes("SetTransactionStatus"))).toBe(true);
  });

  it("does not penalize exception handling when no high-risk activities", () => {
    const exc: ExceptionCoverageResult = {
      entries: [],
      totalActivities: 0,
      coveredActivities: 0,
      coveragePercent: 100,
      uncoveredHighRiskActivities: [],
      filesWithoutTryCatch: ["Simple.xaml", "Helper.xaml"],
    };
    const result = calculateReadiness(emptyCred, exc, emptyQueue, simpleEnv, 0, 0);
    const excSection = result.sections.find(s => s.section === "Exception Handling");
    expect(excSection!.score).toBe(excSection!.maxScore);
  });
});

describe("runDhgAnalysis", () => {
  it("runs full analysis pipeline", () => {
    const xaml = makeXaml(`
      <ui:GetCredential CredentialName="AppLogin" />
      <TryCatch>
        <TryCatch.Try>
          <ui:HttpClient DisplayName="Call API" />
        </TryCatch.Try>
        <TryCatch.Catches>
          <Catch TypeArgument="System.Exception"><ActivityAction /></Catch>
        </TryCatch.Catches>
      </TryCatch>
      <ui:AddQueueItem QueueName="ResultQueue" />
    `);
    const result = runDhgAnalysis([{ name: "lib/Main.xaml", content: xaml }]);

    expect(result.credentialInventory.entries.length).toBe(1);
    expect(result.queueManagement.entries.length).toBe(1);
    expect(result.environmentRequirements.usesOrchestrator).toBe(true);
    expect(result.triggerSuggestions.length).toBeGreaterThan(0);
    expect(result.readiness.sections.length).toBe(5);
    expect(result.readiness.percent).toBeGreaterThan(0);
  });

  it("works with empty entries", () => {
    const result = runDhgAnalysis([]);
    expect(result.credentialInventory.entries.length).toBe(0);
    expect(result.readiness.rating).toBe("Ready");
  });

  it("passes projectJsonContent to environment detector", () => {
    const projectJson = JSON.stringify({
      dependencies: {
        "UiPath.System.Activities": "[25.10.0]",
        "UiPath.Excel.Activities": "[25.10.0]",
      },
    });
    const result = runDhgAnalysis([], projectJson);
    expect(result.environmentRequirements.requiredPackages).toContain("UiPath.System.Activities");
    expect(result.environmentRequirements.requiredPackages).toContain("UiPath.Excel.Activities");
  });
});

describe("DHG generator with analysis context", () => {
  function makeMinimalReport(): PipelineOutcomeReport {
    return {
      remediations: [],
      propertyRemediations: [],
      autoRepairs: [],
      downgradeEvents: [],
      qualityWarnings: [],
      fullyGeneratedFiles: ["Main.xaml"],
      totalEstimatedEffortMinutes: 0,
    };
  }

  it("includes Environment Setup section when analysis is present", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:UseBrowser /><ui:GetCredential CredentialName="Cred1" />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Environment Setup");
    expect(md).toContain("Browser Extensions");
    expect(md).toContain("Chrome/Edge UiPath Extension");
  });

  it("includes Credential & Asset Inventory section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`
        <ui:GetCredential CredentialName="AppCred" />
        <ui:GetAsset AssetName="Config_URL" />
      `),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Credential & Asset Inventory");
    expect(md).toContain("AppCred");
    expect(md).toContain("Config_URL");
    expect(md).toContain("Orchestrator Credentials to Provision");
    expect(md).toContain("Orchestrator Assets to Provision");
  });

  it("includes Queue Management section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`
        <ui:GetTransactionItem QueueName="WorkQueue" />
        <ui:SetTransactionStatus />
      `),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Queue Management");
    expect(md).toContain("WorkQueue");
    expect(md).toContain("Transactional (Dispatcher/Performer)");
  });

  it("includes Exception Handling Coverage section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:HttpClient DisplayName="Call API" />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Exception Handling Coverage");
    expect(md).toContain("Uncovered High-Risk Activities");
  });

  it("includes Trigger Configuration section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:LogMessage Text="Hi" />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Trigger Configuration");
  });

  it("includes Pre-Deployment Checklist section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:GetCredential CredentialName="Cred1" />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Pre-Deployment Checklist");
    expect(md).toContain("Provision credential");
    expect(md).toContain("Publish package to Orchestrator feed");
  });

  it("includes Deployment Readiness Score section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:LogMessage Text="Hi" />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Deployment Readiness Score");
    expect(md).toContain("Overall:");
  });

  it("shows readiness in header when analysis present", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:LogMessage Text="Hi" />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("**Deployment Readiness:**");
  });

  it("includes Retry Policy and SLA Guidance in queue section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`
        <ui:GetTransactionItem QueueName="WorkQueue" />
        <ui:SetTransactionStatus />
      `),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Retry Policy");
    expect(md).toContain("SLA Guidance");
    expect(md).toContain("Dead-Letter / Failed Items Handling");
    expect(md).toContain("Auto Retry");
  });

  it("includes Machine Template and Folder Guidance in environment section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:UseApplication />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Machine Template");
    expect(md).toContain("Orchestrator Folder Structure");
    expect(md).toContain("Studio Version");
  });

  it("includes Detailed Usage Map in credential section", () => {
    const analysis = runDhgAnalysis([{
      name: "lib/Main.xaml",
      content: makeXaml(`<ui:GetAsset AssetName="Config_URL" Result="[str_URL]" />`),
    }]);
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Detailed Usage Map");
    expect(md).toContain("Config_URL");
  });

  it("includes upstream context section when provided", () => {
    const analysis = runDhgAnalysis(
      [{ name: "Main.xaml", content: makeXaml(`<ui:LogMessage Text="Hi" />`) }],
      undefined, 0, 0, undefined,
      { ideaDescription: "Invoice processing automation", automationType: "rpa", feasibilityScore: 85 },
    );
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Process Context (from Pipeline)");
    expect(md).toContain("Invoice processing automation");
    expect(md).toContain("Automation Type");
    expect(md).toContain("Feasibility Score");
  });

  it("includes upstream quality warnings section", () => {
    const analysis = runDhgAnalysis(
      [{ name: "Main.xaml", content: makeXaml(`<ui:LogMessage Text="Hi" />`) }],
      undefined, 2, 0, undefined,
      {
        qualityWarnings: [
          { code: "SELECTOR_LOW_QUALITY", message: "Selector score 4/20 in Main.xaml", severity: "warning" },
          { code: "TYPE_MISMATCH", message: "Int32 expected but got String", severity: "warning" },
        ],
      },
    );
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("Upstream Quality Findings");
    expect(md).toContain("SELECTOR_LOW_QUALITY");
    expect(md).toContain("TYPE_MISMATCH");
  });

  it("includes PDD and SDD summaries in upstream context", () => {
    const analysis = runDhgAnalysis(
      [{ name: "Main.xaml", content: makeXaml(`<ui:LogMessage Text="Hi" />`) }],
      undefined, 0, 0, undefined,
      { pddSummary: "Process Design for invoice handling", sddSummary: "Solution using REFramework with SAP" },
    );
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
      analysis,
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).toContain("PDD Summary");
    expect(md).toContain("invoice handling");
    expect(md).toContain("SDD Summary");
    expect(md).toContain("REFramework with SAP");
  });

  it("omits analysis sections when no analysis context", () => {
    const context: DhgContext = {
      projectName: "TestProject",
      workflowNames: ["Main"],
    };
    const md = generateDhgFromOutcomeReport(makeMinimalReport(), context);
    expect(md).not.toContain("Environment Setup");
    expect(md).not.toContain("Credential & Asset Inventory");
    expect(md).not.toContain("Queue Management");
    expect(md).not.toContain("Exception Handling Coverage");
    expect(md).not.toContain("Trigger Configuration");
    expect(md).not.toContain("Pre-Deployment Checklist");
    expect(md).not.toContain("Deployment Readiness Score");
  });
});
