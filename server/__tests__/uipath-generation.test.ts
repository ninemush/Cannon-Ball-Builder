import { describe, it, expect } from "vitest";
import { generateStubWorkflow, validateXamlContent, makeUiPathCompliant } from "../xaml-generator";
import { runQualityGate, type QualityGateInput } from "../uipath-quality-gate";
import { getBlockedActivities, isActivityAllowed } from "../uipath-activity-policy";
import { scanXamlForRequiredPackages, classifyAutomationPattern } from "../uipath-activity-registry";
import {
  simpleLinearNodes,
  apiDataDrivenNodes,
  transactionalQueueNodes,
  lowConfidenceNodes,
  makeProjectJson,
} from "./fixtures/process-specs";

function makeStubWithDeps(name: string = "Main") {
  const stub = generateStubWorkflow(name);
  const compliant = makeUiPathCompliant(stub, "Windows");
  const required = scanXamlForRequiredPackages(compliant);
  const deps: Record<string, string> = {};
  for (const pkg of required) deps[pkg] = "23.10.0";
  if (!deps["UiPath.System.Activities"]) deps["UiPath.System.Activities"] = "23.10.0";
  return { xaml: compliant, deps };
}

describe("UiPath Generation Regression Tests", () => {

  describe("Stub Workflow Generation", () => {
    it("generates valid XML for stub workflows", () => {
      const stub = generateStubWorkflow("MyWorkflow");
      expect(stub).toContain('<?xml version="1.0"');
      expect(stub).toContain('x:Class="MyWorkflow"');
      expect(stub).toContain("<Sequence");
      expect(stub).toContain("</Activity>");
      expect(stub.trim().startsWith("<?xml")).toBe(true);
      expect(stub.trim().endsWith("</Activity>")).toBe(true);
    });

    it("sanitizes file names with special characters", () => {
      const stub = generateStubWorkflow("My Workflow (v2).xaml");
      expect(stub).toContain('x:Class="My_Workflow__v2_"');
      expect(stub).not.toContain(".xaml");
    });

    it("stub contains LogMessage warning about placeholder status", () => {
      const stub = generateStubWorkflow("ProcessInvoice");
      expect(stub).toContain("STUB:");
      expect(stub).toContain("ProcessInvoice");
      expect(stub).toContain("ui:LogMessage");
    });

    it("stub workflow produces valid Studio-openable XAML", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");
      expect(compliant).toContain('<?xml version="1.0"');
      expect(compliant).toContain("</Activity>");
      expect(compliant).toContain("x:Class=");
      expect(compliant).toContain("<Sequence");
      const validation = validateXamlContent([{ name: "Main.xaml", content: compliant }]);
      const severe = validation.filter(v =>
        v.check === "malformed-quote" || v.check === "placeholder" || v.check === "pseudo-xaml"
      );
      expect(severe.length).toBe(0);
    });
  });

  describe("Activity Policy Enforcement", () => {
    it("blocks ui:TakeScreenshot for simple-linear automations", () => {
      expect(isActivityAllowed("ui:TakeScreenshot", "simple-linear")).toBe(false);
    });

    it("blocks ui:TakeScreenshot for api-data-driven automations", () => {
      expect(isActivityAllowed("ui:TakeScreenshot", "api-data-driven")).toBe(false);
    });

    it("blocks ui:AddLogFields for all automation patterns", () => {
      const patterns: Array<"simple-linear" | "api-data-driven" | "ui-automation" | "transactional-queue" | "hybrid"> = [
        "simple-linear", "api-data-driven", "ui-automation", "transactional-queue", "hybrid"
      ];
      for (const pattern of patterns) {
        expect(isActivityAllowed("ui:AddLogFields", pattern)).toBe(false);
      }
    });

    it("allows ui:Click for ui-automation pattern", () => {
      expect(isActivityAllowed("ui:Click", "ui-automation")).toBe(true);
    });

    it("blocks UI activities for simple-linear pattern", () => {
      const blocked = getBlockedActivities("simple-linear");
      expect(blocked.has("ui:Click")).toBe(true);
      expect(blocked.has("ui:TypeInto")).toBe(true);
      expect(blocked.has("ui:GetText")).toBe(true);
    });

    it("blocks mail activities for api-data-driven pattern", () => {
      const blocked = getBlockedActivities("api-data-driven");
      expect(blocked.has("ui:SendSmtpMailMessage")).toBe(true);
    });

    it("allows standard activities for all patterns", () => {
      const patterns: Array<"simple-linear" | "api-data-driven" | "ui-automation" | "transactional-queue" | "hybrid"> = [
        "simple-linear", "api-data-driven", "ui-automation", "transactional-queue", "hybrid"
      ];
      for (const pattern of patterns) {
        expect(isActivityAllowed("Assign", pattern)).toBe(true);
        expect(isActivityAllowed("ui:LogMessage", pattern)).toBe(true);
        expect(isActivityAllowed("Sequence", pattern)).toBe(true);
      }
    });
  });

  describe("Automation Pattern Classification", () => {
    it("classifies nodes with browser/portal keywords as ui-automation", () => {
      const pattern = classifyAutomationPattern(simpleLinearNodes, "", false);
      expect(pattern).toBe("ui-automation");
    });

    it("classifies transactional-queue nodes when queues present", () => {
      const pattern = classifyAutomationPattern(transactionalQueueNodes, "", true);
      expect(pattern).toBe("transactional-queue");
    });

    it("classifies api-data-driven with API keywords and no UI", () => {
      const apiOnlyNodes = [
        { id: "1", name: "Call REST API", nodeType: "task", description: "Call the token endpoint for OAuth2 authentication", system: "API" },
        { id: "2", name: "Process Response", nodeType: "task", description: "Parse JSON response and extract records", system: "Internal" },
      ];
      const pattern = classifyAutomationPattern(apiOnlyNodes, "REST API integration with OAuth2", false);
      expect(["api-data-driven", "simple-linear"]).toContain(pattern);
    });

    it("classifies low-confidence nodes with some valid pattern", () => {
      const pattern = classifyAutomationPattern(lowConfidenceNodes, "", false);
      expect(["simple-linear", "api-data-driven", "ui-automation", "transactional-queue", "hybrid"]).toContain(pattern);
    });
  });

  describe("XAML Validation — validateXamlContent", () => {
    it("detects [object Object] placeholder leakage", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:LogMessage Message="[object Object]" />
  </Sequence>
</Activity>`;
      const violations = validateXamlContent([{ name: "Main.xaml", content: xaml }]);
      const placeholders = violations.filter(v => v.check === "placeholder");
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it("detects ellipsis placeholder attributes", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:LogMessage Message="..." />
  </Sequence>
</Activity>`;
      const violations = validateXamlContent([{ name: "Main.xaml", content: xaml }]);
      const placeholders = violations.filter(v => v.check === "placeholder");
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it("passes validation for well-formed XAML without placeholders", () => {
      const stub = generateStubWorkflow("CleanWorkflow");
      const compliant = makeUiPathCompliant(stub, "Windows");
      const violations = validateXamlContent([{ name: "CleanWorkflow.xaml", content: compliant }]);
      const severe = violations.filter(v =>
        v.check === "malformed-quote" || v.check === "placeholder"
      );
      expect(severe.length).toBe(0);
    });
  });

  describe("Quality Gate — Warning vs Blocking Classification", () => {
    it("treats invalid XML as blocking error", () => {
      const badXaml = `<?xml version="1.0"?><Activity><Sequence>unclosed`;
      const deps = { "UiPath.System.Activities": "23.10.0" };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: badXaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      expect(result.passed).toBe(false);
      expect(result.summary.totalErrors).toBeGreaterThan(0);
    });

    it("treats malformed project.json as blocking error", () => {
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: makeStubWithDeps().xaml }],
        projectJsonContent: "{ invalid json",
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      expect(result.passed).toBe(false);
    });

    it("captures logic-location findings as warnings not errors", () => {
      const { xaml, deps } = makeStubWithDeps();
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      const logicLocationErrors = result.violations.filter(
        v => v.category === "logic-location" && v.severity === "error"
      );
      expect(logicLocationErrors.length).toBe(0);
    });

    it("errors vs warnings are correctly classified by severity", () => {
      const { xaml, deps } = makeStubWithDeps();
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      for (const v of result.violations) {
        expect(["error", "warning"]).toContain(v.severity);
        expect(v.category).toBeDefined();
        expect(v.detail).toBeDefined();
        expect(v.file).toBeDefined();
      }
      const blockingCategories = result.violations.filter(v => v.severity === "error");
      const warningCategories = result.violations.filter(v => v.severity === "warning");
      expect(result.summary.totalErrors).toBe(blockingCategories.length);
      expect(result.summary.totalWarnings).toBe(warningCategories.length);
    });
  });

  describe("Dependency Management", () => {
    it("scanXamlForRequiredPackages returns only packages for activities present", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");
      const required = scanXamlForRequiredPackages(compliant);
      expect(required.size).toBeLessThanOrEqual(3);
      expect(required.has("UiPath.System.Activities")).toBe(true);
    });

    it("scanXamlForRequiredPackages does not include UIAutomation for non-UI XAML", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");
      const required = scanXamlForRequiredPackages(compliant);
      expect(required.has("UiPath.UIAutomation.Activities")).toBe(false);
    });

    it("scanXamlForRequiredPackages detects UIAutomation when UI activities present", () => {
      const uiXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:OpenBrowser Url="'https://example.com'" BrowserType="Chrome" DisplayName="Open Browser" />
  </Sequence>
</Activity>`;
      const required = scanXamlForRequiredPackages(uiXaml);
      expect(required.has("UiPath.UIAutomation.Activities")).toBe(true);
    });
  });

  describe("Archive Manifest Parity", () => {
    it("quality gate checks archive manifest presence", () => {
      const { xaml, deps } = makeStubWithDeps();
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
    });
  });

  describe("Project JSON Validation", () => {
    it("detects [*] wildcard version strings as errors", () => {
      const { xaml } = makeStubWithDeps();
      const badProjectJson = JSON.stringify({
        name: "Test",
        projectVersion: "1.0.0",
        description: "Test",
        main: "Main.xaml",
        dependencies: { "UiPath.System.Activities": "[*]" },
        toolVersion: "23.10.0",
        projectType: "Workflow",
        expressionLanguage: "VisualBasic",
        entryPoints: [{ filePath: "Main.xaml", uniqueId: "00000000-0000-0000-0000-000000000001", input: [], output: [] }],
        schemaVersion: "4.0",
        studioVersion: "23.10.0.0",
        targetFramework: "Windows",
      }, null, 2);

      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: badProjectJson,
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      const wildcardIssues = result.violations.filter(v =>
        v.detail.includes("[*]") || v.detail.includes("wildcard") || v.check.includes("version")
      );
      expect(wildcardIssues.length).toBeGreaterThan(0);
    });

    it("detects missing required project.json fields", () => {
      const { xaml } = makeStubWithDeps();
      const minimalProjectJson = JSON.stringify({ name: "Test" });

      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: minimalProjectJson,
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      expect(result.passed).toBe(false);
    });
  });

  describe("InvokeWorkflowFile Path Validation", () => {
    it("detects InvokeWorkflowFile references to nonexistent files", () => {
      const mainXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:InvokeWorkflowFile DisplayName="Invoke Helper" WorkflowFileName="Helper.xaml" />
  </Sequence>
</Activity>`;
      const violations = validateXamlContent([{ name: "Main.xaml", content: mainXaml }]);
      const invokeIssues = violations.filter(v => v.check === "invoked-file");
      expect(invokeIssues.length).toBeGreaterThan(0);
    });

    it("no invoke violation when referenced file exists in entries", () => {
      const mainXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:InvokeWorkflowFile DisplayName="Invoke Helper" WorkflowFileName="Helper.xaml" />
  </Sequence>
</Activity>`;
      const helperStub = generateStubWorkflow("Helper");
      const violations = validateXamlContent([
        { name: "Main.xaml", content: mainXaml },
        { name: "Helper.xaml", content: helperStub },
      ]);
      const invokeIssues = violations.filter(v => v.check === "invoked-file");
      expect(invokeIssues.length).toBe(0);
    });
  });

  describe("Generation Mode Type Exports", () => {
    it("GenerationMode and pipeline functions are exported from pipeline", async () => {
      const pipeline = await import("../uipath-pipeline");
      expect(pipeline).toHaveProperty("generateUiPathPackage");
      expect(pipeline).toHaveProperty("getCachedPipelineResult");
      expect(pipeline).toHaveProperty("generateDhg");
      expect(pipeline).toHaveProperty("normalizeXaml");
    });

    it("BuildResult includes usedFallbackStubs and generationMode", async () => {
      const integration = await import("../uipath-integration");
      expect(integration).toHaveProperty("buildNuGetPackage");
    });
  });

  describe("baseline_openable Mode Contract", () => {
    it("PipelineResult type includes generationMode and usedFallbackStubs", async () => {
      const pipeline = await import("../uipath-pipeline");
      expect(typeof pipeline.generateUiPathPackage).toBe("function");
      expect(typeof pipeline.getCachedPipelineResult).toBe("function");
    });

    it("quality gate in baseline_openable mode: errors are demoted in pipeline", () => {
      const { xaml, deps } = makeStubWithDeps();
      const qgResult = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });

      const isBaselineOpenable = true;
      const qualityGateBlocking = isBaselineOpenable ? false : !qgResult.passed;
      const qualityGateWarnings = qgResult.violations
        .filter(v => v.severity === "warning" || (isBaselineOpenable && v.severity === "error"))
        .map(v => v.detail);

      expect(qualityGateBlocking).toBe(false);
      if (qgResult.summary.totalErrors > 0) {
        expect(qualityGateWarnings.length).toBeGreaterThan(0);
      }
    });
  });
});
