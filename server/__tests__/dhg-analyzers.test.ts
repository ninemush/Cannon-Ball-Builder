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
});

describe("suggestTriggers", () => {
  it("suggests queue trigger for transactional pattern", () => {
    const qResult: QueueManagementResult = {
      entries: [],
      uniqueQueues: ["WorkQueue"],
      hasAddQueueItem: false,
      hasGetTransaction: true,
      hasSetTransactionStatus: true,
      isTransactionalPattern: true,
    };
    const envResult: EnvironmentRequirements = {
      needsWindowsTarget: false,
      needsAttendedRobot: false,
      usesModernActivities: true,
      browserExtensions: [],
      requiredPackages: [],
      usesOrchestrator: true,
      usesActionCenter: false,
      usesAICenter: false,
      usesDocumentUnderstanding: false,
      usesDataService: false,
    };
    const triggers = suggestTriggers(qResult, envResult);
    expect(triggers.some(t => t.triggerType === "Queue")).toBe(true);
  });

  it("suggests attended trigger for attended robot", () => {
    const qResult: QueueManagementResult = {
      entries: [],
      uniqueQueues: [],
      hasAddQueueItem: false,
      hasGetTransaction: false,
      hasSetTransactionStatus: false,
      isTransactionalPattern: false,
    };
    const envResult: EnvironmentRequirements = {
      needsWindowsTarget: false,
      needsAttendedRobot: true,
      usesModernActivities: true,
      browserExtensions: [],
      requiredPackages: [],
      usesOrchestrator: false,
      usesActionCenter: false,
      usesAICenter: false,
      usesDocumentUnderstanding: false,
      usesDataService: false,
    };
    const triggers = suggestTriggers(qResult, envResult);
    expect(triggers.some(t => t.triggerType === "Attended")).toBe(true);
  });

  it("suggests schedule trigger as default", () => {
    const qResult: QueueManagementResult = {
      entries: [],
      uniqueQueues: [],
      hasAddQueueItem: false,
      hasGetTransaction: false,
      hasSetTransactionStatus: false,
      isTransactionalPattern: false,
    };
    const envResult: EnvironmentRequirements = {
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
    };
    const triggers = suggestTriggers(qResult, envResult);
    expect(triggers.some(t => t.triggerType === "Schedule")).toBe(true);
  });

  it("suggests API trigger for agent automation", () => {
    const qResult: QueueManagementResult = {
      entries: [],
      uniqueQueues: [],
      hasAddQueueItem: false,
      hasGetTransaction: false,
      hasSetTransactionStatus: false,
      isTransactionalPattern: false,
    };
    const envResult: EnvironmentRequirements = {
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
    };
    const triggers = suggestTriggers(qResult, envResult, "agent");
    expect(triggers.some(t => t.triggerType === "API/Webhook")).toBe(true);
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
  const emptyQueue: QueueManagementResult = {
    entries: [],
    uniqueQueues: [],
    hasAddQueueItem: false,
    hasGetTransaction: false,
    hasSetTransactionStatus: false,
    isTransactionalPattern: false,
  };
  const simpleEnv: EnvironmentRequirements = {
    needsWindowsTarget: false,
    needsAttendedRobot: false,
    usesModernActivities: true,
    browserExtensions: [],
    requiredPackages: ["UiPath.System.Activities"],
    usesOrchestrator: false,
    usesActionCenter: false,
    usesAICenter: false,
    usesDocumentUnderstanding: false,
    usesDataService: false,
  };

  it("returns Ready for clean package", () => {
    const result = calculateReadiness(emptyCred, emptyExc, emptyQueue, simpleEnv, 0, 0);
    expect(result.rating).toBe("Ready");
    expect(result.percent).toBeGreaterThanOrEqual(85);
  });

  it("penalizes hardcoded credentials", () => {
    const cred: CredentialAssetInventory = {
      entries: [{ file: "Main.xaml", activityType: "GetAsset", assetName: "Test", isHardcoded: true, lineNumber: 1 }],
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
    const queue: QueueManagementResult = {
      entries: [{ file: "Main.xaml", activityType: "GetTransactionItem", queueName: "Q1", isHardcoded: true, lineNumber: 1 }],
      uniqueQueues: ["Q1"],
      hasAddQueueItem: false,
      hasGetTransaction: true,
      hasSetTransactionStatus: false,
      isTransactionalPattern: false,
    };
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
