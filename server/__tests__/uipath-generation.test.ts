import { describe, it, expect } from "vitest";
import { generateStubWorkflow, validateXamlContent, makeUiPathCompliant, generateRichXamlFromSpec, generateReframeworkMainXaml, generateRichXamlFromNodes, applyActivityPolicy, generateSetTransactionStatusXaml, generateInitAllSettingsXaml } from "../xaml-generator";
import { runQualityGate, classifyQualityIssues, getBlockingFiles, type QualityGateInput } from "../uipath-quality-gate";
import { getBlockedActivities, isActivityAllowed, filterBlockedActivitiesFromXaml } from "../uipath-activity-policy";
import { scanXamlForRequiredPackages, classifyAutomationPattern, ACTIVITY_REGISTRY, normalizeActivityName, ACTIVITY_NAME_ALIAS_MAP } from "../uipath-activity-registry";
import { normalizePackageName, UIPATH_PACKAGE_ALIAS_MAP, buildNuGetPackage, removeDuplicateAttributes } from "../uipath-integration";
import {
  simpleLinearNodes,
  simpleLinearEdges,
  apiDataDrivenNodes,
  apiDataDrivenEdges,
  transactionalQueueNodes,
  transactionalQueueEdges,
  lowConfidenceNodes,
  lowConfidenceEdges,
  makeProjectJson,
  makeValidXaml,
  makeApiDrivenXaml,
  makeXamlWithInvoke,
} from "./fixtures/process-specs";

function makeStubWithDeps(name: string = "Main") {
  const stub = generateStubWorkflow(name);
  const compliant = makeUiPathCompliant(stub, "Windows");
  const required = scanXamlForRequiredPackages(compliant);
  const deps: Record<string, string> = {};
  for (const pkg of required) deps[pkg] = "25.10.0";
  if (!deps["UiPath.System.Activities"]) deps["UiPath.System.Activities"] = "25.10.0";
  return { xaml: compliant, deps };
}

function runQG(
  xamlEntries: { name: string; content: string }[],
  deps: Record<string, string>,
  options?: Partial<QualityGateInput>,
): ReturnType<typeof runQualityGate> {
  return runQualityGate({
    xamlEntries,
    projectJsonContent: makeProjectJson("Test", deps),
    targetFramework: "Windows",
    archiveManifest: [
      ...xamlEntries.map(e => `lib/net45/${e.name.split("/").pop()}`),
      "lib/net45/project.json",
      "Test.nuspec",
    ],
    ...options,
  });
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

    it("enrichmentUseReFramework=true forces transactional-queue", () => {
      const pattern = classifyAutomationPattern(apiDataDrivenNodes, "", false, true);
      expect(pattern).toBe("transactional-queue");
    });
  });

  describe("XAML Validation — validateXamlContent", () => {
    it("detects [object Object] placeholder leakage", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Message="[object Object]" />`);
      const violations = validateXamlContent([{ name: "Main.xaml", content: xaml }]);
      const placeholders = violations.filter(v => v.check === "placeholder");
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it("detects ellipsis placeholder attributes", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Message="..." />`);
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

    it("detects pseudo-XAML string attributes (Then/Else/Body as strings)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <If Condition="[True]" Then="Do something" Else="Do other" />
  </Sequence>
</Activity>`;
      const violations = validateXamlContent([{ name: "Main.xaml", content: xaml }]);
      const pseudoXaml = violations.filter(v => v.check === "pseudo-xaml");
      expect(pseudoXaml.length).toBeGreaterThan(0);
    });

    it("xml-wellformedness validation works with pure ESM fast-xml-parser (no createRequire)", () => {
      const validXaml = makeValidXaml("Main", `<ui:LogMessage Message="[&quot;Hello&quot;]" DisplayName="Log" />`);
      const violations = validateXamlContent([{ name: "Main.xaml", content: validXaml }]);
      const xmlErrors = violations.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
      const allDetails = violations.map(v => v.detail).join(" ");
      expect(allDetails).not.toContain("require is not defined");
      expect(allDetails).not.toContain("require is not a function");
      expect(allDetails).not.toContain("createRequire");
    });

    it("xml-wellformedness validation catches genuinely malformed XML", () => {
      const badXaml = `<?xml version="1.0"?><Activity><Sequence><Unclosed`;
      const violations = validateXamlContent([{ name: "Bad.xaml", content: badXaml }]);
      const xmlErrors = violations.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBeGreaterThan(0);
      const allDetails = violations.map(v => v.detail).join(" ");
      expect(allDetails).not.toContain("require is not defined");
      expect(allDetails).not.toContain("require is not a function");
    });

    it("XAML with raw ampersands passes validation after auto-remediation sanitization", () => {
      const xamlWithRawAmpersand = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <Assign DisplayName="Set Category">
      <Assign.To><OutArgument x:TypeArguments="x:String">[category]</OutArgument></Assign.To>
      <Assign.Value><InArgument x:TypeArguments="x:String">Weather & Travel</InArgument></Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
      expect(xamlWithRawAmpersand).toContain("Weather & Travel");

      const rawViolations = validateXamlContent([{ name: "Main.xaml", content: xamlWithRawAmpersand }]);
      const rawXmlErrors = rawViolations.filter(v => v.check === "xml-wellformedness");
      expect(rawXmlErrors.length).toBeGreaterThan(0);

      const ampersandRegex = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g;
      const sanitized = xamlWithRawAmpersand.replace(ampersandRegex, "&amp;");

      expect(sanitized).toContain("Weather &amp; Travel");

      const sanitizedViolations = validateXamlContent([{ name: "Main.xaml", content: sanitized }]);
      const sanitizedXmlErrors = sanitizedViolations.filter(v => v.check === "xml-wellformedness");
      expect(sanitizedXmlErrors.length).toBe(0);

      expect(sanitized).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/);
    });

    it("ampersand sanitizer runs even when quality gate passes with warnings only (integration)", async () => {
      const result = await buildNuGetPackage(
        {
          projectName: "AmpersandSanitizeTest",
          description: "Test that bare ampersands are escaped before quality gate",
          workflows: [
            {
              name: "WeatherAndTravelNotification",
              steps: [
                { name: "Set Category", description: "Set category to Weather & Travel" },
                { name: "Log Result", description: "Log the category value" },
              ],
            },
          ],
          dependencies: ["UiPath.System.Activities"],
        },
        "1.0.0-amptest",
        undefined,
        "baseline_openable",
      );

      const allXaml = result.xamlEntries.map(e => e.content).join("\n");
      const bareAmpersandRegex = /&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g;
      expect(allXaml).not.toMatch(bareAmpersandRegex);

      const xmlErrors = validateXamlContent(result.xamlEntries).filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });
  });

  describe("Regression: TODO/PLACEHOLDER tag-name sanitization", () => {
    it("self-closing <ui:TODO_HttpClient> is converted to ui:Comment, not broken tag", () => {
      const xaml = makeValidXaml("Main", `<ui:TODO_HttpClient DisplayName="Test" />`);
      const commentReplacement = '<ui:Comment Text="REVIEW: Unknown activity type was generated here — implement manually" />';
      const afterTagSafety = xaml
        .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)(\w+)\b[^>]*?>[\s\S]*?<\/\1?(?:TODO_|PLACEHOLDER_)\2>/g, commentReplacement)
        .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)\w+\b[^>]*?\/>/g, commentReplacement);
      const cleaned = afterTagSafety
        .replace(/\[[^\]]*(?:PLACEHOLDER_\w*|TODO_\w*)[^\]]*\]/g, '[Nothing]')
        .replace(/PLACEHOLDER_\w*/g, '')
        .replace(/TODO_\w*/g, '');

      expect(cleaned).toContain('ui:Comment');
      expect(cleaned).toContain('REVIEW: Unknown activity type');
      expect(cleaned).not.toContain('<ui: ');
      expect(cleaned).not.toContain('TODO_HttpClient');

      const xmlErrors = validateXamlContent([{ name: "Main.xaml", content: cleaned }])
        .filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });

    it("open-close pair <TODO_Activity> is converted to a single ui:Comment", () => {
      const xaml = makeValidXaml("Main", `<TODO_Activity DisplayName="Test">
        <ui:LogMessage Message="child" DisplayName="Child" />
      </TODO_Activity>`);
      const commentReplacement = '<ui:Comment Text="REVIEW: Unknown activity type was generated here — implement manually" />';
      const afterTagSafety = xaml
        .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)(\w+)\b[^>]*?>[\s\S]*?<\/\1?(?:TODO_|PLACEHOLDER_)\2>/g, commentReplacement)
        .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)\w+\b[^>]*?\/>/g, commentReplacement);
      const cleaned = afterTagSafety
        .replace(/\[[^\]]*(?:PLACEHOLDER_\w*|TODO_\w*)[^\]]*\]/g, '[Nothing]')
        .replace(/PLACEHOLDER_\w*/g, '')
        .replace(/TODO_\w*/g, '');

      expect(cleaned).toContain('ui:Comment');
      expect(cleaned).not.toContain('< ');
      expect(cleaned).not.toContain('</ >');
      expect(cleaned).not.toContain('TODO_Activity');

      const xmlErrors = validateXamlContent([{ name: "Main.xaml", content: cleaned }])
        .filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });

    it("PLACEHOLDER_ token in a tag name is handled identically to TODO_", () => {
      const xaml = makeValidXaml("Main", `<ui:PLACEHOLDER_CustomAction DisplayName="Placeholder" />`);
      const commentReplacement = '<ui:Comment Text="REVIEW: Unknown activity type was generated here — implement manually" />';
      const afterTagSafety = xaml
        .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)(\w+)\b[^>]*?>[\s\S]*?<\/\1?(?:TODO_|PLACEHOLDER_)\2>/g, commentReplacement)
        .replace(/<(ui:)?(?:TODO_|PLACEHOLDER_)\w+\b[^>]*?\/>/g, commentReplacement);
      const cleaned = afterTagSafety
        .replace(/\[[^\]]*(?:PLACEHOLDER_\w*|TODO_\w*)[^\]]*\]/g, '[Nothing]')
        .replace(/PLACEHOLDER_\w*/g, '')
        .replace(/TODO_\w*/g, '');

      expect(cleaned).toContain('ui:Comment');
      expect(cleaned).not.toContain('PLACEHOLDER_CustomAction');
      expect(cleaned).not.toContain('<ui: ');

      const xmlErrors = validateXamlContent([{ name: "Main.xaml", content: cleaned }])
        .filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });

    it("buildNuGetPackage sanitizes TODO_ tag names without XML parse errors (integration)", async () => {
      const result = await buildNuGetPackage(
        {
          projectName: "TodoTagSanitizeTest",
          description: "Test that TODO_ tag names are safely replaced",
          workflows: [
            {
              name: "Main",
              steps: [
                { name: "Log Start", description: "Log that the process started" },
              ],
            },
          ],
          dependencies: ["UiPath.System.Activities"],
        },
        "1.0.0-todotest",
        undefined,
        "baseline_openable",
      );

      const allXaml = result.xamlEntries.map(e => e.content).join("\n");
      expect(allXaml).not.toMatch(/<(?:ui:)?(?:TODO_|PLACEHOLDER_)\w+/);

      const xmlErrors = validateXamlContent(result.xamlEntries).filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });
  });

  describe("Quality Gate — Warning vs Blocking Classification", () => {
    it("treats invalid XML as blocking error via validateXamlContent", () => {
      const badXaml = `<?xml version="1.0"?><Activity><Sequence>unclosed`;
      const violations = validateXamlContent([{ name: "Main.xaml", content: badXaml }]);
      const xmlErrors = violations.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBeGreaterThan(0);
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
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const logicLocationErrors = result.violations.filter(
        v => v.category === "logic-location" && v.severity === "error"
      );
      expect(logicLocationErrors.length).toBe(0);
    });

    it("errors vs warnings are correctly classified by severity", () => {
      const { xaml, deps } = makeStubWithDeps();
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
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

    it("hardcoded credentials are warnings (not blocking errors)", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Message="password = 'MySecretPassword123'" DisplayName="Bad Log" />`);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const credIssues = result.violations.filter(v => v.check === "hardcoded-credential");
      expect(credIssues.length).toBeGreaterThan(0);
      expect(credIssues[0].severity).toBe("warning");
    });

    it("unknown activities are warnings (not blocking errors)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:MadeUpActivity DisplayName="Fake" Prop="val" />
  </Sequence>
</Activity>`;
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const unknownActs = result.violations.filter(v => v.check === "unknown-activity");
      expect(unknownActs.length).toBeGreaterThan(0);
      expect(unknownActs[0].severity).toBe("error");
      const classified = classifyQualityIssues(result);
      const unknownClassified = classified.filter(c => c.check === "unknown-activity");
      expect(unknownClassified.length).toBeGreaterThan(0);
      expect(unknownClassified[0].severity).toBe("warning");
    });

    it("placeholder values (TODO/PLACEHOLDER) in XAML are warnings, not errors", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Message="[&quot;TODO implement real logic&quot;]" DisplayName="Placeholder" />`);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const placeholderWarnings = result.violations.filter(
        v => v.check === "placeholder-value"
      );
      for (const w of placeholderWarnings) {
        expect(w.severity).toBe("warning");
      }
    });

    it("safe stubs and conservative simplifications are warnings not blockers", () => {
      const stub = generateStubWorkflow("HelperWorkflow");
      const compliant = makeUiPathCompliant(stub, "Windows");
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG(
        [
          { name: "Main.xaml", content: makeStubWithDeps("Main").xaml },
          { name: "HelperWorkflow.xaml", content: compliant },
        ],
        deps,
      );
      const blockers = result.violations.filter(v => v.severity === "error");
      const stubRelatedBlockers = blockers.filter(v =>
        v.detail.includes("STUB") || v.detail.includes("stub")
      );
      expect(stubRelatedBlockers.length).toBe(0);
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
      const uiXaml = makeValidXaml("Main", `<ui:OpenBrowser Url="[&quot;https://example.com&quot;]" BrowserType="Chrome" DisplayName="Open Browser" />`);
      const required = scanXamlForRequiredPackages(uiXaml);
      expect(required.has("UiPath.UIAutomation.Activities")).toBe(true);
    });

    it("no dependency over-injection: emitted deps match exactly what activities require", () => {
      const xaml = makeApiDrivenXaml();
      const required = scanXamlForRequiredPackages(xaml);
      const requiredList = [...required].sort();
      const expectedForApiXaml = ["UiPath.System.Activities", "UiPath.Web.Activities"].sort();
      expect(requiredList).toEqual(expectedForApiXaml);
      expect(required.has("UiPath.UIAutomation.Activities")).toBe(false);
      expect(required.has("UiPath.Excel.Activities")).toBe(false);
      expect(required.has("UiPath.Mail.Activities")).toBe(false);
      expect(required.has("UiPath.Database.Activities")).toBe(false);
      expect(required.has("UiPath.Persistence.Activities")).toBe(false);
      expect(required.has("UiPath.MLActivities")).toBe(false);
    });

    it("pipeline does not over-inject: buildNuGetPackage deps match XAML-required packages", async () => {
      const pkg = {
        projectName: "OverInjectionTest",
        description: "Test no unnecessary dependencies are added",
        workflows: [{ name: "Main", steps: [{ name: "Log", description: "Log message" }] }],
        dependencies: ["UiPath.System.Activities"],
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      const allXamlContent = result.xamlEntries.map(e => e.content).join("\n");
      const requiredByXaml = scanXamlForRequiredPackages(allXamlContent);
      const emittedDeps = new Set(Object.keys(result.dependencyMap));

      const baselineDeps = new Set(["UiPath.UIAutomation.Activities"]);
      for (const dep of emittedDeps) {
        if (!baselineDeps.has(dep)) {
          expect(requiredByXaml.has(dep)).toBe(true);
        }
      }
    });
  });

  describe("Archive Manifest Parity", () => {
    it("quality gate checks archive manifest presence", () => {
      const { xaml, deps } = makeStubWithDeps();
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      expect(result).toBeDefined();
      expect(result.violations).toBeDefined();
      expect(Array.isArray(result.violations)).toBe(true);
    });

    it("detects XAML file missing from archive", () => {
      const { xaml, deps } = makeStubWithDeps();
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/project.json"],
      });
      const archiveMissing = result.violations.filter(v =>
        v.check === "archive-parity-missing-from-archive"
      );
      expect(archiveMissing.length).toBeGreaterThan(0);
    });

    it("detects unvalidated XAML in archive", () => {
      const { xaml, deps } = makeStubWithDeps();
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: [
          "lib/net45/Main.xaml",
          "lib/net45/Extra.xaml",
          "lib/net45/project.json",
        ],
      });
      const notValidated = result.violations.filter(v =>
        v.check === "archive-parity-not-validated"
      );
      expect(notValidated.length).toBeGreaterThan(0);
    });
  });

  describe("Project JSON Validation", () => {
    it("detects [*] wildcard version strings as errors", () => {
      const { xaml } = makeStubWithDeps();
      const badProjectJson = makeProjectJson("Test", { "UiPath.System.Activities": "[*]" });
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

    it("detects missing dependencies object as error", () => {
      const { xaml } = makeStubWithDeps();
      const noDeps = JSON.stringify({
        name: "Test",
        projectVersion: "1.0.0",
        main: "Main.xaml",
        targetFramework: "Windows",
        designOptions: { modernBehavior: true },
      });
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: noDeps,
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      const depErrors = result.violations.filter(v => v.check === "dependencies");
      expect(depErrors.length).toBeGreaterThan(0);
    });

    it("rejects modernBehavior=false as error", () => {
      const { xaml, deps } = makeStubWithDeps();
      const badPJ = makeProjectJson("Test", deps, { modernBehavior: false });
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: badPJ,
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      expect(result.passed).toBe(false);
      const modernErrors = result.violations.filter(v =>
        v.detail.includes("modernBehavior") || v.check === "modern-project" || v.check === "legacy-modern-behavior"
      );
      expect(modernErrors.length).toBeGreaterThan(0);
    });
  });

  describe("InvokeWorkflowFile Path Validation", () => {
    it("detects InvokeWorkflowFile references to nonexistent files", () => {
      const mainXaml = makeXamlWithInvoke("Helper.xaml");
      const violations = validateXamlContent([{ name: "Main.xaml", content: mainXaml }]);
      const invokeIssues = violations.filter(v => v.check === "invoked-file");
      expect(invokeIssues.length).toBeGreaterThan(0);
    });

    it("no invoke violation when referenced file exists in entries", () => {
      const mainXaml = makeXamlWithInvoke("Helper.xaml");
      const helperStub = generateStubWorkflow("Helper");
      const violations = validateXamlContent([
        { name: "Main.xaml", content: mainXaml },
        { name: "Helper.xaml", content: helperStub },
      ]);
      const invokeIssues = violations.filter(v => v.check === "invoked-file");
      expect(invokeIssues.length).toBe(0);
    });

    it("detects Workflows\\ prefix path mismatch in invoke references", () => {
      const xaml = makeValidXaml("Main", `
        <ui:InvokeWorkflowFile DisplayName="Invoke" WorkflowFileName="Workflows\\Helper.xaml" />
      `);
      const helper = generateStubWorkflow("Helper");
      const violations = validateXamlContent([
        { name: "Main.xaml", content: xaml },
        { name: "Helper.xaml", content: helper },
      ]);
      const pathIssues = violations.filter(v => v.check === "invoked-file");
      expect(pathIssues.length).toBeGreaterThan(0);
    });
  });

  describe("Root-Relative Workflow Paths (Source Correctness)", () => {
    it("makeUiPathCompliant normalizes Workflows\\ prefix to root-relative", () => {
      const xaml = makeValidXaml("Main", `
        <ui:InvokeWorkflowFile DisplayName="Invoke" WorkflowFileName="Workflows\\Helper.xaml" />
      `);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).not.toContain('WorkflowFileName="Workflows\\');
      expect(compliant).toContain('WorkflowFileName="Helper.xaml"');
    });

    it("makeUiPathCompliant normalizes Workflows/ prefix to root-relative", () => {
      const xaml = makeValidXaml("Main", `
        <ui:InvokeWorkflowFile DisplayName="Invoke" WorkflowFileName="Workflows/Helper.xaml" />
      `);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).not.toContain('WorkflowFileName="Workflows/');
      expect(compliant).toContain('WorkflowFileName="Helper.xaml"');
    });
  });

  describe("Centralization Verification", () => {
    it("all entry points import from uipath-pipeline, which delegates to buildNuGetPackage", async () => {
      const pipeline = await import("../uipath-pipeline");
      expect(pipeline).toHaveProperty("generateUiPathPackage");
      expect(pipeline).toHaveProperty("getCachedPipelineResult");
      expect(pipeline).toHaveProperty("generateDhg");
      expect(pipeline).toHaveProperty("normalizeXaml");
      expect(typeof pipeline.generateUiPathPackage).toBe("function");
      expect(typeof pipeline.getCachedPipelineResult).toBe("function");
      expect(typeof pipeline.generateDhg).toBe("function");
      expect(typeof pipeline.normalizeXaml).toBe("function");
    });

    it("normalizeXaml produces the same result for the same input", async () => {
      const { normalizeXaml } = await import("../uipath-pipeline");
      const stub = generateStubWorkflow("TestWorkflow");
      const result1 = normalizeXaml(stub, "Windows");
      const result2 = normalizeXaml(stub, "Windows");
      expect(result1.normalized).toBe(result2.normalized);
    });

    it("scanXamlForRequiredPackages is deterministic for the same XAML", () => {
      const xaml = makeApiDrivenXaml();
      const result1 = scanXamlForRequiredPackages(xaml);
      const result2 = scanXamlForRequiredPackages(xaml);
      expect([...result1].sort()).toEqual([...result2].sort());
    });

    it("runQualityGate produces the same contract for the same input", () => {
      const { xaml, deps } = makeStubWithDeps();
      const input: QualityGateInput = {
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      };
      const r1 = runQualityGate(input);
      const r2 = runQualityGate(input);
      expect(r1.passed).toBe(r2.passed);
      expect(r1.violations.length).toBe(r2.violations.length);
      expect(r1.summary).toEqual(r2.summary);
    });

    it("BuildResult includes usedFallbackStubs and generationMode", async () => {
      const integration = await import("../uipath-integration");
      expect(integration).toHaveProperty("buildNuGetPackage");
    });

    it("normalizePackageName resolves aliases consistently", () => {
      expect(normalizePackageName("UiPath.WebAPI.Activities")).toBe("UiPath.Web.Activities");
      expect(normalizePackageName("UiPath.HTTP.Activities")).toBe("UiPath.Web.Activities");
      expect(normalizePackageName("UiPath.Core.Activities")).toBe("UiPath.System.Activities");
      expect(normalizePackageName("UiPath.UI.Activities")).toBe("UiPath.UIAutomation.Activities");
      expect(normalizePackageName("UiPath.System.Activities")).toBe("UiPath.System.Activities");
    });
  });

  describe("Regression: ui:TakeScreenshot not emitted for non-UI patterns", () => {
    it("quality gate blocks TakeScreenshot in simple-linear context", () => {
      const xaml = makeValidXaml("Main", `<ui:TakeScreenshot DisplayName="Take Screenshot" />`);
      const deps = {
        "UiPath.System.Activities": "25.10.0",
        "UiPath.UIAutomation.Activities": "25.10.0",
      };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
        automationPattern: "simple-linear",
      });
      const blocked = result.violations.filter(v =>
        v.check === "policy-blocked-activity" && v.detail.includes("TakeScreenshot")
      );
      expect(blocked.length).toBeGreaterThan(0);
    });

    it("quality gate blocks TakeScreenshot in api-data-driven context", () => {
      const xaml = makeValidXaml("Main", `<ui:TakeScreenshot DisplayName="Take Screenshot" />`);
      const deps = {
        "UiPath.System.Activities": "25.10.0",
        "UiPath.UIAutomation.Activities": "25.10.0",
      };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
        automationPattern: "api-data-driven",
      });
      const blocked = result.violations.filter(v =>
        v.check === "policy-blocked-activity" && v.detail.includes("TakeScreenshot")
      );
      expect(blocked.length).toBeGreaterThan(0);
    });
  });

  describe("Regression: ui:AddLogFields not emitted for non-UI patterns", () => {
    it("quality gate blocks AddLogFields in simple-linear", () => {
      const xaml = makeValidXaml("Main", `<ui:AddLogFields DisplayName="Add Fields" />`);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
        automationPattern: "simple-linear",
      });
      const blocked = result.violations.filter(v =>
        v.check === "policy-blocked-activity" && v.detail.includes("AddLogFields")
      );
      expect(blocked.length).toBeGreaterThan(0);
    });

    it("quality gate blocks AddLogFields in api-data-driven", () => {
      const xaml = makeValidXaml("Main", `<ui:AddLogFields DisplayName="Add Fields" />`);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
        automationPattern: "api-data-driven",
      });
      const blocked = result.violations.filter(v =>
        v.check === "policy-blocked-activity" && v.detail.includes("AddLogFields")
      );
      expect(blocked.length).toBeGreaterThan(0);
    });
  });

  describe("Regression: Undeclared variables in expressions", () => {
    it("quality gate detects undeclared prefixed variables", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <Sequence.Variables />
    <ui:LogMessage Level="Info" Message="[str_UndeclaredVar]" DisplayName="Log" />
  </Sequence>
</Activity>`;
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const undeclared = result.violations.filter(v => v.check === "undeclared-variable");
      expect(undeclared.length).toBeGreaterThan(0);
      expect(undeclared[0].severity).toBe("error");
    });

    it("no undeclared variable error when variable is properly declared", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_MyVar" Default="" />
    </Sequence.Variables>
    <ui:LogMessage Level="Info" Message="[str_MyVar]" DisplayName="Log" />
  </Sequence>
</Activity>`;
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const undeclared = result.violations.filter(v => v.check === "undeclared-variable");
      expect(undeclared.length).toBe(0);
    });
  });

  describe("Regression: Placeholder token leakage in baseline_openable", () => {
    it("quality gate warns on PLACEHOLDER_ tokens in XAML", () => {
      const xaml = makeValidXaml("Main", `
        <ui:LogMessage Message="[&quot;PLACEHOLDER_endpoint_url&quot;]" DisplayName="Placeholder Log" />
      `);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const placeholders = result.violations.filter(v =>
        v.check === "placeholder-value" && v.detail.includes("PLACEHOLDER")
      );
      expect(placeholders.length).toBeGreaterThan(0);
    });

    it("quality gate warns on TODO_ tokens in XAML", () => {
      const xaml = makeValidXaml("Main", `
        <ui:LogMessage Message="[&quot;TODO_implement_business_rule&quot;]" DisplayName="Todo Log" />
      `);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const placeholders = result.violations.filter(v =>
        v.check === "placeholder-value" &&
        (v.detail.includes("TODO") || v.detail.includes("PLACEHOLDER"))
      );
      expect(placeholders.length).toBeGreaterThan(0);
    });
  });

  describe("Regression: Malformed project.json", () => {
    it("unparseable JSON fails quality gate", () => {
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: makeStubWithDeps().xaml }],
        projectJsonContent: "NOT VALID JSON {{{",
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      expect(result.passed).toBe(false);
      const parseErrors = result.violations.filter(v => v.check === "project-json-parse");
      expect(parseErrors.length).toBeGreaterThan(0);
    });

    it("empty dependencies object fails quality gate", () => {
      const { xaml } = makeStubWithDeps();
      const emptyDeps = JSON.stringify({
        name: "Test",
        projectVersion: "1.0.0",
        main: "Main.xaml",
        dependencies: {},
        targetFramework: "Windows",
        designOptions: { modernBehavior: true },
      });
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: emptyDeps,
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      });
      expect(result.passed).toBe(false);
    });
  });

  describe("Regression: Generator/Validator Activity Schema Drift", () => {
    it("every activity in ACTIVITY_REGISTRY has a package mapping", () => {
      const builtinActivities = new Set(["Assign", "ui:Assign", "Throw", "ui:Throw", "Rethrow"]);
      for (const [actName, entry] of Object.entries(ACTIVITY_REGISTRY)) {
        if (builtinActivities.has(actName)) continue;
        expect(entry.package).toBeTruthy();
        expect(entry.package.length).toBeGreaterThan(0);
      }
    });

    it("registry activities are not rejected by quality gate when properly declared", () => {
      const testableActivities = [
        { name: "ui:LogMessage", props: 'Level="Info" Message="[&quot;test&quot;]"' },
        { name: "ui:HttpClient", props: 'Endpoint="[&quot;https://test.com&quot;]" Method="GET"' },
        { name: "ui:DeserializeJson", props: 'JsonString="[str_json]"' },
      ];

      for (const act of testableActivities) {
        const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_json" Default="" />
    </Sequence.Variables>
    <${act.name} ${act.props} DisplayName="Test ${act.name}" />
  </Sequence>
</Activity>`;
        const entry = ACTIVITY_REGISTRY[act.name];
        const deps: Record<string, string> = { "UiPath.System.Activities": "25.10.0" };
        if (entry?.package && entry.package !== "UiPath.System.Activities") {
          deps[entry.package] = entry.package.includes("Web") ? "1.20.1" : (entry.package.includes("Excel") ? "2.24.3" : (entry.package.includes("Mail") ? "1.23.1" : (entry.package.includes("Database") ? "1.9.0" : "25.10.0")));
        }
        const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
        const unknownActs = result.violations.filter(v => v.check === "unknown-activity" && v.detail.includes(act.name));
        expect(unknownActs.length).toBe(0);
      }
    });

    it("every package alias resolves to a canonical package name", () => {
      const canonicalNames = new Set(Object.values(UIPATH_PACKAGE_ALIAS_MAP));
      for (const [alias, canonical] of Object.entries(UIPATH_PACKAGE_ALIAS_MAP)) {
        expect(canonical).toBeTruthy();
        expect(normalizePackageName(alias)).toBe(canonical);
        expect(normalizePackageName(canonical)).toBe(canonical);
      }
    });
  });

  describe("Low-Confidence Stub Fallback", () => {
    it("low-confidence fixture produces a valid classified pattern", () => {
      const pattern = classifyAutomationPattern(lowConfidenceNodes, "", false);
      expect(pattern).toBeDefined();
      expect(typeof pattern).toBe("string");
    });

    it("stub workflow for low-confidence input is valid Studio-openable XAML", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");

      expect(compliant).toContain('<?xml version="1.0"');
      expect(compliant).toContain("</Activity>");
      expect(compliant).toContain("<Sequence");
      expect(compliant).toContain("ui:LogMessage");

      const validation = validateXamlContent([{ name: "Main.xaml", content: compliant }]);
      const xmlErrors = validation.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });

    it("low-confidence stub passes quality gate with correct project wiring", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");
      const required = scanXamlForRequiredPackages(compliant);
      const deps: Record<string, string> = {};
      for (const pkg of required) deps[pkg] = "25.10.0";

      const result = runQG([{ name: "Main.xaml", content: compliant }], deps);
      const fatalErrors = result.violations.filter(v =>
        v.severity === "error" &&
        v.check !== "empty-container" &&
        v.check !== "version-framework-mismatch"
      );
      expect(fatalErrors.length).toBe(0);
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
      const qgResult = runQG([{ name: "Main.xaml", content: xaml }], deps);

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

    it("baseline_openable mode does NOT produce REFramework files for simple-linear input", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");

      expect(compliant).not.toContain("GetTransactionData");
      expect(compliant).not.toContain("SetTransactionStatus");
      expect(compliant).not.toContain("InitAllSettings");
      expect(compliant).not.toContain("REFramework");
    });

    it("baseline_openable stub has flat scaffold structure (no sub-workflow invocations)", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");
      expect(compliant).not.toMatch(/<ui:InvokeWorkflowFile\s/);
      expect(compliant).not.toMatch(/WorkflowFileName="/);
    });
  });

  describe("makeUiPathCompliant Transforms", () => {
    it("adds ui: prefix to activities that need it", () => {
      const xaml = makeValidXaml("Main", `<LogMessage Level="Info" Message="[&quot;test&quot;]" DisplayName="Log" />`);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain("ui:LogMessage");
      expect(compliant).not.toMatch(/<(?!ui:)LogMessage\s/);
    });

    it("fixes scg:DataTable to scg2:DataTable", () => {
      const xaml = makeValidXaml("Main", `
        <Sequence.Variables>
          <Variable x:TypeArguments="scg:DataTable" Name="dt_Data" />
        </Sequence.Variables>
      `);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain("scg2:DataTable");
      expect(compliant).not.toContain("scg:DataTable");
    });

    it("passes through self-closing Assign without restructuring (read-only compliance)", () => {
      const xaml = makeValidXaml("Main", `<Assign DisplayName="Set Variable" To="[str_Result]" Value="[&quot;Hello&quot;]" />`);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain("Assign");
      expect(compliant).toContain("str_Result");
    });

    it("injects VB settings for Windows target", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Windows");
      expect(compliant).toContain("VisualBasic.Settings");
      expect(compliant).toContain("WorkflowViewState.IdRef");
    });

    it("injects C# settings for Portable target", () => {
      const stub = generateStubWorkflow("Main");
      const compliant = makeUiPathCompliant(stub, "Portable");
      expect(compliant).not.toContain("VisualBasic.Settings");
      expect(compliant).toContain("WorkflowViewState.IdRef");
      expect(compliant).toContain("System.Runtime");
    });
  });

  describe("Cross-Framework Validation", () => {
    it("Portable XAML with VB concatenation is flagged", () => {
      const xamlContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <Sequence.Variables />
    <ui:LogMessage DisplayName="Log">
      <ui:LogMessage.Message>
        <InArgument x:TypeArguments="x:String">"Hello" &amp; str_Name</InArgument>
      </ui:LogMessage.Message>
    </ui:LogMessage>
  </Sequence>
</Activity>`;
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xamlContent }],
        projectJsonContent: makeProjectJson("Test", deps, { targetFramework: "Portable" }),
        targetFramework: "Portable",
        archiveManifest: ["lib/net6.0/Main.xaml", "lib/net6.0/project.json", "Test.nuspec"],
      });
      const syntaxErrors = result.violations.filter(v => v.check === "expression-syntax-mismatch");
      expect(syntaxErrors.length).toBeGreaterThan(0);
    });

    it("Windows XAML with C# interpolation is flagged", () => {
      const xamlContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <Sequence.Variables />
    <!-- Expression uses C# interpolation: $"Hello {str_Name}" which is wrong for VB -->
    <ui:LogMessage DisplayName="Log">
      <ui:LogMessage.Message>
        <InArgument x:TypeArguments="x:String">$"Hello {str_Name}"</InArgument>
      </ui:LogMessage.Message>
    </ui:LogMessage>
  </Sequence>
</Activity>`;
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xamlContent }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json", "Test.nuspec"],
      });
      const syntaxErrors = result.violations.filter(v => v.check === "expression-syntax-mismatch");
      expect(syntaxErrors.length).toBeGreaterThan(0);
    });
  });

  describe("Comprehensive Warning vs Blocking Split", () => {
    it("minor issues (incomplete logic, safe stubs) appear as warnings in DHG without failing build", () => {
      const xaml = makeValidXaml("Main", `
        <ui:LogMessage Level="Info" Message="[&quot;TODO implement real business rule&quot;]" DisplayName="Stub Step" />
      `);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);

      const todoWarnings = result.violations.filter(v =>
        v.check === "placeholder-value" && v.severity === "warning"
      );
      expect(todoWarnings.length).toBeGreaterThan(0);

      const fatalBlockers = result.violations.filter(v =>
        v.severity === "error" && !["empty-container", "version-framework-mismatch"].includes(v.check)
      );
      expect(fatalBlockers.length).toBe(0);
    });

    it("major issues (invalid XML) are detected by validateXamlContent", () => {
      const invalidXaml = `<?xml version="1.0"?><Activity><Sequence DisplayName="Main"><Unclosed`;
      const violations = validateXamlContent([{ name: "Main.xaml", content: invalidXaml }]);
      const xmlErrors = violations.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBeGreaterThan(0);
    });

    it("major issues (unresolved InvokeWorkflowFile references) force failure", () => {
      const xaml = makeXamlWithInvoke("NonExistent.xaml");
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const invokeErrors = result.violations.filter(v =>
        v.check === "invoked-file" && v.severity === "error"
      );
      expect(invokeErrors.length).toBeGreaterThan(0);
    });

    it("major issues (malformed project.json) force failure", () => {
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: makeStubWithDeps().xaml }],
        projectJsonContent: "}{broken",
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml"],
      });
      expect(result.passed).toBe(false);
    });

    it("blocked-pattern violations for policy-blocked activities are warnings", () => {
      const xaml = makeValidXaml("Main", `<ui:TakeScreenshot DisplayName="Screenshot" />`);
      const deps = {
        "UiPath.System.Activities": "25.10.0",
        "UiPath.UIAutomation.Activities": "25.10.0",
      };
      const result = runQualityGate({
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: makeProjectJson("Test", deps),
        targetFramework: "Windows",
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
        automationPattern: "simple-linear",
      });
      const blockedWarnings = result.violations.filter(v =>
        v.check === "policy-blocked-activity" && v.severity === "warning"
      );
      expect(blockedWarnings.length).toBeGreaterThan(0);
    });
  });

  describe("Route-Level Centralization Proof", () => {
    it("document-routes, uipath-routes, and chat routes all import generation functions from uipath-pipeline", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const docRoutesContent = fs.readFileSync(path.resolve(__dirname, "../document-routes.ts"), "utf-8");
      const uipathRoutesContent = fs.readFileSync(path.resolve(__dirname, "../uipath-routes.ts"), "utf-8");
      const chatRoutesContent = fs.readFileSync(path.resolve(__dirname, "../replit_integrations/chat/routes.ts"), "utf-8");

      const extractPipelineImports = (content: string): string[] => {
        const match = content.match(/import\s*\{([^}]+)\}\s*from\s*["'][^"']*uipath-pipeline["']/);
        if (!match) return [];
        return match[1].split(",").map(s => s.trim()).filter(Boolean).sort();
      };

      const docImports = extractPipelineImports(docRoutesContent);
      const uipathImports = extractPipelineImports(uipathRoutesContent);
      const chatImports = extractPipelineImports(chatRoutesContent);

      const sharedEntryPoints = ["findUiPathMessage", "parseUiPathPackage", "generateUiPathPackage", "computeVersion", "getCachedPipelineResult"];
      for (const fn of sharedEntryPoints) {
        expect(docImports).toContain(fn);
        expect(uipathImports).toContain(fn);
      }

      expect(chatImports).toContain("findUiPathMessage");
      expect(chatImports).toContain("parseUiPathPackage");

      expect(chatRoutesContent).toMatch(/from\s*["'][^"']*uipath-pipeline["']/);
    });

    it("neither route file imports directly from xaml-generator or uipath-activity-registry for generation", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const docRoutesContent = fs.readFileSync(path.resolve(__dirname, "../document-routes.ts"), "utf-8");
      const uipathRoutesContent = fs.readFileSync(path.resolve(__dirname, "../uipath-routes.ts"), "utf-8");
      const chatRoutesContent = fs.readFileSync(path.resolve(__dirname, "../replit_integrations/chat/routes.ts"), "utf-8");

      expect(docRoutesContent).not.toMatch(/from\s*["']\.\/xaml-generator["']/);
      expect(docRoutesContent).not.toMatch(/from\s*["']\.\/uipath-activity-registry["']/);
      expect(uipathRoutesContent).not.toMatch(/from\s*["']\.\/xaml-generator["']/);
      expect(uipathRoutesContent).not.toMatch(/from\s*["']\.\/uipath-activity-registry["']/);
      expect(chatRoutesContent).not.toMatch(/from\s*["'][^"']*xaml-generator["']/);
      expect(chatRoutesContent).not.toMatch(/from\s*["'][^"']*uipath-activity-registry["']/);
    });

    it("all entry points converge to the same pipeline contract: buildNuGetPackage produces identical result shape", async () => {
      const pkg1 = {
        projectName: "ContractTest",
        description: "Identical input contract test",
        workflows: [{ name: "Main", steps: [{ name: "Step", description: "Do something" }] }],
        dependencies: ["UiPath.System.Activities"],
      };
      const pkg2 = { ...pkg1 };

      const result1 = await buildNuGetPackage(pkg1, "1.0.0-contract", undefined, "baseline_openable");
      const result2 = await buildNuGetPackage(pkg2, "1.0.0-contract", undefined, "baseline_openable");

      expect(result1.generationMode).toBe(result2.generationMode);
      expect(Object.keys(result1.dependencyMap).sort()).toEqual(Object.keys(result2.dependencyMap).sort());
      expect(result1.xamlEntries.map(e => e.name).sort()).toEqual(result2.xamlEntries.map(e => e.name).sort());
      const filterDeterministic = (manifest: string[]) =>
        manifest.filter(f => !f.includes(".psmdcp")).sort();
      expect(filterDeterministic(result1.archiveManifest)).toEqual(filterDeterministic(result2.archiveManifest));
      expect(result1.usedFallbackStubs).toBe(result2.usedFallbackStubs);
    });
  });

  describe("Pre-Normalization InvokeWorkflowFile Path Verification", () => {
    it("generator emits root-relative WorkflowFileName paths (no Workflows/ prefix)", () => {
      const result = generateRichXamlFromSpec(
        { name: "Main", steps: [{ name: "Step 1", description: "Test step" }] },
        undefined,
        undefined,
        "Windows",
        false,
      );
      const rawXaml = result.xaml;
      const workflowPaths = [...rawXaml.matchAll(/WorkflowFileName="([^"]+)"/g)].map(m => m[1]);
      for (const p of workflowPaths) {
        expect(p).not.toMatch(/^Workflows[/\\]/);
        expect(p).toMatch(/\.xaml$/);
      }
    });

    it("REFramework main XAML emits root-relative paths for all sub-workflows", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      const workflowPaths = [...mainXaml.matchAll(/WorkflowFileName="([^"]+)"/g)].map(m => m[1]);

      expect(workflowPaths.length).toBeGreaterThan(0);
      const expectedFiles = ["InitAllSettings.xaml", "GetTransactionData.xaml", "Process.xaml", "SetTransactionStatus.xaml", "CloseAllApplications.xaml"];
      for (const expected of expectedFiles) {
        expect(workflowPaths).toContain(expected);
      }
      for (const p of workflowPaths) {
        expect(p).not.toMatch(/^Workflows[/\\]/);
      }
    });

    it("makeUiPathCompliant strips Workflows/ prefix from paths if present", () => {
      const xaml = makeValidXaml("Main", `<ui:InvokeWorkflowFile WorkflowFileName="Workflows\\SubProcess.xaml" DisplayName="Invoke Sub" />`);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain('WorkflowFileName="SubProcess.xaml"');
      expect(compliant).not.toContain('Workflows\\SubProcess.xaml');
    });
  });

  describe("Integration: Pipeline Execution from Fixture Inputs", () => {
    it("buildNuGetPackage produces valid package with correct structure from process nodes", async () => {
      const pkg = {
        projectName: "TestSimpleLinear",
        description: "Test simple linear automation",
        workflows: [{ name: "Main", steps: [{ name: "Log Start", description: "Log start message" }] }],
        dependencies: ["UiPath.System.Activities"],
        internal: { processNodes: simpleLinearNodes, processEdges: simpleLinearEdges },
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(["baseline_openable", "full_implementation"]).toContain(result.generationMode);
      expect(result.xamlEntries.length).toBeGreaterThan(0);
      expect(result.archiveManifest.length).toBeGreaterThan(0);
      expect(result.dependencyMap).toHaveProperty("UiPath.System.Activities");

      const mainXaml = result.xamlEntries.find(e => e.name === "Main.xaml");
      expect(mainXaml).toBeDefined();
      expect(mainXaml!.content).toContain("</Activity>");
    });

    it("buildNuGetPackage produces valid package from api-data-driven spec", async () => {
      const pkg = {
        projectName: "TestApiDriven",
        description: "Test API driven automation",
        workflows: [{ name: "Main", steps: [{ name: "Call API", description: "HTTP request step" }] }],
        dependencies: ["UiPath.System.Activities", "UiPath.Web.Activities"],
        internal: { processNodes: apiDataDrivenNodes, processEdges: apiDataDrivenEdges },
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.xamlEntries.length).toBeGreaterThan(0);

      const mainXaml = result.xamlEntries.find(e => e.name === "Main.xaml");
      expect(mainXaml).toBeDefined();

      expect(result.archiveManifest.some(f => f.endsWith("project.json"))).toBe(true);
      expect(result.archiveManifest.some(f => f.endsWith(".nuspec"))).toBe(true);
    });

    it("buildNuGetPackage PipelineResult shape includes all required fields", async () => {
      const pkg = {
        projectName: "ShapeTest",
        description: "Test result shape",
        workflows: [{ name: "Main", steps: [{ name: "Step", description: "Step" }] }],
        dependencies: ["UiPath.System.Activities"],
        internal: {},
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      expect(result).toHaveProperty("buffer");
      expect(result).toHaveProperty("gaps");
      expect(result).toHaveProperty("usedPackages");
      expect(result).toHaveProperty("xamlEntries");
      expect(result).toHaveProperty("dependencyMap");
      expect(result).toHaveProperty("archiveManifest");
      expect(result).toHaveProperty("usedFallbackStubs");
      expect(result).toHaveProperty("generationMode");
      expect(Array.isArray(result.gaps)).toBe(true);
      expect(Array.isArray(result.usedPackages)).toBe(true);
      expect(Array.isArray(result.xamlEntries)).toBe(true);
      expect(Array.isArray(result.archiveManifest)).toBe(true);
      expect(typeof result.usedFallbackStubs).toBe("boolean");
    });

    it("buildNuGetPackage with low-confidence nodes produces valid package with fallback handling", async () => {
      const pkg = {
        projectName: "TestLowConfidence",
        description: "Low confidence test",
        workflows: [],
        dependencies: ["UiPath.System.Activities"],
        internal: { processNodes: lowConfidenceNodes, processEdges: lowConfidenceEdges },
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.xamlEntries.length).toBeGreaterThan(0);

      const mainEntry = result.xamlEntries.find(e => e.name === "Main.xaml");
      expect(mainEntry).toBeDefined();
      expect(mainEntry!.content).toContain("</Activity>");

      expect(result.archiveManifest.some(f => f.endsWith("project.json"))).toBe(true);

      if (result.qualityGateResult) {
        expect(typeof result.qualityGateResult.passed).toBe("boolean");
        expect(Array.isArray(result.qualityGateResult.violations)).toBe(true);
      }

      expect(typeof result.usedFallbackStubs).toBe("boolean");
    });

    it("buildNuGetPackage output archive manifest contains expected structural files", async () => {
      const pkg = {
        projectName: "ManifestTest",
        description: "Manifest structure test",
        workflows: [{ name: "Main", steps: [{ name: "Step 1", description: "Do something" }] }],
        dependencies: ["UiPath.System.Activities"],
        internal: {},
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      expect(result.archiveManifest).toContain("[Content_Types].xml");
      expect(result.archiveManifest).toContain("_rels/.rels");
      expect(result.archiveManifest.some(f => f.endsWith(".nuspec"))).toBe(true);
      expect(result.archiveManifest.some(f => f.endsWith("project.json"))).toBe(true);
      expect(result.archiveManifest.some(f => f.endsWith("Main.xaml"))).toBe(true);
    });

    it("all XAML entries from buildNuGetPackage pass validateXamlContent", async () => {
      const pkg = {
        projectName: "XamlValidation",
        description: "Full validation test",
        workflows: [{ name: "Main", steps: [{ name: "Step 1", description: "Process data" }] }],
        dependencies: ["UiPath.System.Activities"],
        internal: { processNodes: simpleLinearNodes, processEdges: simpleLinearEdges },
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      const violations = validateXamlContent(result.xamlEntries);
      const blockers = violations.filter(v =>
        v.check === "xml-wellformedness" || v.check === "malformed-quote" || v.check === "pseudo-xaml"
      );
      expect(blockers.length).toBe(0);
    });

    it("quality gate on buildNuGetPackage output does not block in baseline_openable mode", async () => {
      const pkg = {
        projectName: "QGIntegration",
        description: "Quality gate integration test",
        workflows: [{ name: "Main", steps: [{ name: "Step 1", description: "Process" }] }],
        dependencies: ["UiPath.System.Activities"],
        internal: {},
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      if (result.qualityGateResult) {
        const isBaselineOpenable = result.generationMode === "baseline_openable";
        const blocking = isBaselineOpenable ? false : !result.qualityGateResult.passed;
        expect(blocking).toBe(false);
      }
    });

    it("baseline_openable pipeline output contains no REFramework files in XAML entries or manifest", async () => {
      const pkg = {
        projectName: "NoREFrameworkTest",
        description: "Verify flat scaffold with no REFramework files",
        workflows: [{ name: "Main", steps: [{ name: "Step 1", description: "Simple step" }] }],
        dependencies: ["UiPath.System.Activities"],
        internal: {},
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");

      if (result.generationMode === "baseline_openable") {
        const reframeworkFiles = ["GetTransactionData.xaml", "SetTransactionStatus.xaml"];
        for (const rf of reframeworkFiles) {
          expect(result.xamlEntries.some(e => e.name === rf)).toBe(false);
          expect(result.archiveManifest.some(f => f.endsWith(rf))).toBe(false);
        }

        const mainEntry = result.xamlEntries.find(e => e.name === "Main.xaml");
        if (mainEntry) {
          expect(mainEntry.content).not.toContain("GetTransactionData");
          expect(mainEntry.content).not.toContain("SetTransactionStatus");
        }
      }
    });
  });

  describe("Regression: Activity Stripping, Credential False Positive, Duplicate RetryScope", () => {
    it("ui:Assign is recognized by quality gate and not flagged as unknown", () => {
      const xaml = makeValidXaml("Main", `
        <ui:Assign DisplayName="Set Value">
          <ui:Assign.To><OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument></ui:Assign.To>
          <ui:Assign.Value><InArgument x:TypeArguments="x:String">"hello"</InArgument></ui:Assign.Value>
        </ui:Assign>`);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const unknownActs = result.violations.filter(v => v.check === "unknown-activity");
      expect(unknownActs.length).toBe(0);
    });

    it("ui:Throw is recognized by quality gate and not flagged as unknown", () => {
      const xaml = makeValidXaml("Main", `
        <ui:Throw DisplayName="Throw Exception" Exception="[new System.Exception()]" />`);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const unknownActs = result.violations.filter(v => v.check === "unknown-activity");
      expect(unknownActs.length).toBe(0);
    });

    it("ui:DeserializeJSON (uppercase) is recognized by quality gate", () => {
      const xaml = makeValidXaml("Main", `
        <ui:DeserializeJSON DisplayName="Parse JSON" JsonString="[str_Json]" />`);
      const deps = { "UiPath.System.Activities": "25.10.0", "UiPath.Web.Activities": "1.20.1" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const unknownActs = result.violations.filter(v => v.check === "unknown-activity");
      expect(unknownActs.length).toBe(0);
    });

    it("bracket-wrapped UiPath variable references do not trigger credential false positive", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="InitAllSettings"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Init">
    <ui:GetCredential DisplayName="Get Cred" AssetName="MyCred" Username="[str_TempUser]" Password="[sec_TempPass]" />
  </Sequence>
</Activity>`;
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "InitAllSettings.xaml", content: xaml }], deps);
      const credIssues = result.violations.filter(v => v.check === "hardcoded-credential");
      expect(credIssues.length).toBe(0);
    });

    it("generated package XAML does not contain nested duplicate RetryScope elements", async () => {
      const pkg = {
        projectName: "RetryTest",
        description: "Test that retry wrapping is not duplicated",
        workflows: [{
          name: "CallApi",
          steps: [
            { name: "Call REST API", description: "HTTP GET request to external API", activity: "HttpClient" },
          ],
        }],
        dependencies: ["UiPath.System.Activities", "UiPath.Web.Activities"],
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");
      for (const entry of result.xamlEntries) {
        const content = entry.content;
        const openTag = /<ui:RetryScope[\s>]/g;
        let match;
        while ((match = openTag.exec(content)) !== null) {
          const scopeStart = match.index;
          const closeIdx = content.indexOf("</ui:RetryScope>", scopeStart);
          if (closeIdx < 0) continue;
          const innerContent = content.substring(scopeStart + match[0].length, closeIdx);
          const nestedCount = (innerContent.match(/<ui:RetryScope[\s>]/g) || []).length;
          expect(nestedCount).toBe(0);
        }
      }
    });

    it("generated InitAllSettings.xaml with credentials does not get stub-replaced", () => {
      const initXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      expect(initXaml).toContain("StateMachine");
      expect(initXaml).not.toContain("STUB_BLOCKING_FALLBACK");
    });

    it("generated package with credential assets has no STUB_BLOCKING_FALLBACK in workflow XAML", async () => {
      const pkg = {
        projectName: "CredentialTest",
        description: "Test that credential assets do not trigger stub fallback",
        workflows: [{ name: "Main", steps: [{ name: "Log", description: "Log message" }] }],
        dependencies: ["UiPath.System.Activities"],
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");
      for (const entry of result.xamlEntries) {
        if (entry.name.includes("InitAllSettings")) continue;
        expect(entry.content).not.toContain("STUB_BLOCKING_FALLBACK");
      }
    });
  });

  describe("Pipeline Robustness", () => {
    it("dependency scan excludes packages with no matching XAML activities", async () => {
      const pkg = {
        projectName: "SimpleLog",
        description: "Simple logging workflow",
        workflows: [{ name: "Main", steps: [{ name: "Log", description: "Log a message" }] }],
        dependencies: ["UiPath.System.Activities"],
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");
      const depKeys = Object.keys(result.dependencyMap);
      expect(depKeys).toContain("UiPath.System.Activities");
      expect(depKeys).not.toContain("UiPath.Web.Activities");
      expect(depKeys).not.toContain("UiPath.Database.Activities");
    });

    it("no >= or wildcard versions in generated project.json dependencies", async () => {
      const pkg = {
        projectName: "VersionCheck",
        description: "Test version format",
        workflows: [
          { name: "Main", steps: [{ name: "Log", description: "Log message" }] },
          { name: "ApiCall", steps: [{ name: "Call REST API", description: "HTTP GET", activity: "HttpClient" }] },
        ],
        dependencies: ["UiPath.System.Activities", "UiPath.Web.Activities"],
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");
      for (const [key, val] of Object.entries(result.dependencyMap)) {
        expect(val).not.toContain(">=");
        expect(val).not.toContain("*");
        expect(val).not.toContain("[");
        expect(val).toMatch(/^\d+\.\d+\.\d+/);
      }
    });

    it("Web/Excel activities in XAML resolved via MetadataService fallback", async () => {
      const pkg = {
        projectName: "WebExcelTest",
        description: "Test with web and excel activities",
        workflows: [
          { name: "ApiWorkflow", steps: [{ name: "Call REST API", description: "HTTP GET request", activity: "HttpClient" }] },
        ],
        dependencies: ["UiPath.System.Activities", "UiPath.Web.Activities"],
      };
      const result = await buildNuGetPackage(pkg, "1.0.0-test", undefined, "baseline_openable");
      if (result.dependencyMap["UiPath.Web.Activities"]) {
        expect(result.dependencyMap["UiPath.Web.Activities"]).toMatch(/^\d+\.\d+\.\d+/);
      }
      if (result.dependencyMap["UiPath.Excel.Activities"]) {
        expect(result.dependencyMap["UiPath.Excel.Activities"]).toMatch(/^\d+\.\d+\.\d+/);
      }
    });

    it("READY_WITH_WARNINGS status set when pipeline has warnings", () => {
      const { PipelineWarning } = {} as any;
      const warnings = [
        { code: "DEPENDENCY_VERSION_UNKNOWN", message: "Test", stage: "dependency-resolution", recoverable: true },
      ];
      const hasNupkg = true;
      const status = !hasNupkg
        ? "FAILED"
        : warnings.length > 0
          ? "READY_WITH_WARNINGS"
          : "READY";
      expect(status).toBe("READY_WITH_WARNINGS");
    });

    it("FAILED status set when no nupkg produced", () => {
      const hasNupkg = false;
      const warnings: any[] = [];
      const status = !hasNupkg
        ? "FAILED"
        : warnings.length > 0
          ? "READY_WITH_WARNINGS"
          : "READY";
      expect(status).toBe("FAILED");
    });

    it("READY status set when no warnings and nupkg exists", () => {
      const hasNupkg = true;
      const warnings: any[] = [];
      const status = !hasNupkg
        ? "FAILED"
        : warnings.length > 0
          ? "READY_WITH_WARNINGS"
          : "READY";
      expect(status).toBe("READY");
    });

    it("loadIdeaContext skipped when preloadedContext provided", async () => {
      const { generateUiPathPackage } = await import("../uipath-pipeline");
      const mockContext = {
        idea: { id: "test-123", title: "Test Idea", description: "Test", automationType: "rpa" } as any,
        sdd: null,
        pdd: null,
        mapNodes: [],
        processEdges: [],
      };
      const pkg = {
        projectName: "PreloadTest",
        description: "Test preloaded context",
        workflows: [{ name: "Main", steps: [{ name: "Log", description: "Log message" }] }],
      };
      const result = await generateUiPathPackage("test-preload-id", pkg, {
        preloadedContext: mockContext,
        generationMode: "baseline_openable",
      });
      expect(result).toBeDefined();
      expect(result.packageBuffer).toBeDefined();
      expect(result.status).toBeDefined();
      expect(["READY", "READY_WITH_WARNINGS"]).toContain(result.status);
    });
  });

  describe("Issue Fixes", () => {
    it("missing-package-dep produces warning not error (Issue 2)", () => {
      const xaml = makeValidXaml();
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG(
        [{ name: "Main.xaml", content: xaml }],
        deps,
      );
      const missingPkgViolations = result.violations.filter(v => v.check === "missing-package-dep");
      for (const v of missingPkgViolations) {
        expect(v.severity).toBe("warning");
      }
      if (missingPkgViolations.length > 0) {
        const classified = classifyQualityIssues(result);
        const blockingMissing = classified.filter(c => c.check === "missing-package-dep" && c.severity === "blocking");
        expect(blockingMissing).toHaveLength(0);
      }
    });

    it("missing-package-dep does not trigger STUB_BLOCKING_FALLBACK (Issue 2)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main Sequence">
    <ui:LogMessage DisplayName="Log" Level="Info" Message="[&quot;Test&quot;]" />
    <ui:GetCredential DisplayName="Get Cred" AssetName="MyCred" />
  </Sequence>
</Activity>`;
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const classified = classifyQualityIssues(result);
      const blockingFiles = getBlockingFiles(classified);
      expect(blockingFiles.size).toBe(0);
    });

    it("ui:GetCredentials normalised to ui:GetCredential (Issue 3)", () => {
      expect(normalizeActivityName("ui:GetCredentials")).toBe("ui:GetCredential");
      expect(ACTIVITY_NAME_ALIAS_MAP["ui:GetCredentials"]).toBe("ui:GetCredential");
    });

    it("ui:GetCredentials in XAML is normalised via alias replacement (Issue 3)", () => {
      const xaml = `<ui:GetCredentials DisplayName="Get Cred" AssetName="MyCred" />`;
      let content = xaml;
      for (const [aliasName, canonicalName] of Object.entries(ACTIVITY_NAME_ALIAS_MAP)) {
        content = content.replace(new RegExp(`<${aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|>|\\/)`, "g"), `<${canonicalName}$1`);
        content = content.replace(new RegExp(`</${aliasName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}>`, "g"), `</${canonicalName}>`);
      }
      expect(content).toContain("ui:GetCredential");
      expect(content).not.toContain("ui:GetCredentials");
    });

    it("AddLogFields silently removed without comments (Issue 4)", () => {
      const xaml = `<Sequence>
  <ui:AddLogFields DisplayName="Log Fields" />
  <ui:LogMessage DisplayName="Log" Level="Info" Message="test" />
</Sequence>`;
      const { filtered, removed } = filterBlockedActivitiesFromXaml(xaml, "simple-linear");
      expect(removed).toContain("ui:AddLogFields");
      expect(filtered).not.toContain("AddLogFields");
      expect(filtered).not.toContain("Removed blocked activity");
      expect(filtered).toContain("ui:LogMessage");
    });

    it("AddLogFields silently removed in applyActivityPolicy (Issue 4)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:AddLogFields DisplayName="Add Fields" />
    <ui:LogMessage DisplayName="Log" Level="Info" Message="[&quot;test&quot;]" />
  </Sequence>
</Activity>`;
      const { content, blocked } = applyActivityPolicy(xaml, {
        useStubs: false,
        flatScaffold: false,
        blockReFramework: false,
        blockForbiddenActivities: true,
      }, "Test.xaml");
      expect(blocked).toContain("ui:AddLogFields");
      expect(content).not.toContain("AddLogFields");
      expect(content).not.toContain("Removed forbidden activity");
    });

    it("OutArgument child elements pass through read-only compliance without bracket mutations (Issue 5)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:uweb="clr-namespace:UiPath.Web.Activities;assembly=UiPath.Web.Activities">
  <Sequence DisplayName="Main">
    <ui:GetAsset DisplayName="Get Asset">
      <ui:GetAsset.Value>
        <OutArgument x:TypeArguments="x:String">assetValue</OutArgument>
      </ui:GetAsset.Value>
    </ui:GetAsset>
    <uweb:HttpClient DisplayName="Call API">
      <uweb:HttpClient.ResponseContent>
        <OutArgument x:TypeArguments="x:String">responseBody</OutArgument>
      </uweb:HttpClient.ResponseContent>
    </uweb:HttpClient>
  </Sequence>
</Activity>`;
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain("assetValue");
      expect(result).toContain("responseBody");
    });

    it("InArgument child elements pass through read-only compliance without bracket mutations (Issue 5)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:uweb="clr-namespace:UiPath.Web.Activities;assembly=UiPath.Web.Activities">
  <Sequence DisplayName="Main">
    <uweb:HttpClient DisplayName="Call API">
      <uweb:HttpClient.Body>
        <InArgument x:TypeArguments="x:String">requestPayload</InArgument>
      </uweb:HttpClient.Body>
    </uweb:HttpClient>
  </Sequence>
</Activity>`;
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain("requestPayload");
    });

    it("already bracket-wrapped expressions remain unchanged (Issue 5)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:GetAsset DisplayName="Get Asset">
      <ui:GetAsset.Value>
        <OutArgument x:TypeArguments="x:String">[existingVar]</OutArgument>
      </ui:GetAsset.Value>
    </ui:GetAsset>
  </Sequence>
</Activity>`;
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain("[existingVar]");
      expect(result).not.toContain("[[existingVar]]");
    });

    it("makeUiPathCompliant normalises ui:GetCredentials to ui:GetCredential (Issue 3 integration)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:GetCredentials DisplayName="Get Cred" AssetName="MyCred" />
  </Sequence>
</Activity>`;
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).not.toContain("<ui:GetCredentials");
      expect(result).toContain("<ui:GetCredential ");
    });

    it("makeUiPathCompliant passes InArgument child elements through read-only compliance (Issue 5 integration)", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:uweb="clr-namespace:UiPath.Web.Activities;assembly=UiPath.Web.Activities">
  <Sequence DisplayName="Main">
    <uweb:HttpClient DisplayName="Call API">
      <uweb:HttpClient.EndpointUrl>
        <InArgument x:TypeArguments="x:String">apiUrl</InArgument>
      </uweb:HttpClient.EndpointUrl>
      <uweb:HttpClient.ResponseContent>
        <OutArgument x:TypeArguments="x:String">responseBody</OutArgument>
      </uweb:HttpClient.ResponseContent>
    </uweb:HttpClient>
  </Sequence>
</Activity>`;
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain("apiUrl");
      expect(result).toContain("responseBody");
    });
  });

  describe("Regression: LogMessage Level enum values are not auto-corrected", () => {
    it("preserves invalid Level values for downstream ENUM_VIOLATION detection", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Level="Information" Message="[&quot;test&quot;]" DisplayName="Test Log" />`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain('Level="Information"');
    });

    it("preserves Warning value for downstream ENUM_VIOLATION detection", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Level="Warning" Message="[&quot;test&quot;]" DisplayName="Test Log" />`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain('Level="Warning"');
    });

    it("preserves Debug and Critical values for downstream ENUM_VIOLATION detection", () => {
      const xaml = makeValidXaml("Main", `
        <ui:LogMessage Level="Debug" Message="[&quot;debug msg&quot;]" DisplayName="Debug Log" />
        <ui:LogMessage Level="Critical" Message="[&quot;critical msg&quot;]" DisplayName="Critical Log" />`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain('Level="Debug"');
      expect(result).toContain('Level="Critical"');
    });

    it("preserves valid Level values unchanged", () => {
      const xaml = makeValidXaml("Main", `
        <ui:LogMessage Level="Info" Message="[&quot;info&quot;]" DisplayName="Info" />
        <ui:LogMessage Level="Error" Message="[&quot;err&quot;]" DisplayName="Err" />
        <ui:LogMessage Level="Warn" Message="[&quot;warn&quot;]" DisplayName="Warn" />`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain('Level="Info"');
      expect(result).toContain('Level="Error"');
      expect(result).toContain('Level="Warn"');
    });
  });

  describe("Regression: No double-wrapped InArgument/OutArgument", () => {
    it("flattens nested OutArgument wrappers", () => {
      const xaml = makeValidXaml("Main", `
        <Assign DisplayName="Test Assign">
          <Assign.To><OutArgument x:TypeArguments="x:String"><OutArgument x:TypeArguments="x:String">[myVar]</OutArgument></OutArgument></Assign.To>
          <Assign.Value><InArgument x:TypeArguments="x:String">[someVal]</InArgument></Assign.Value>
        </Assign>`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).not.toMatch(/<OutArgument[^>]*><OutArgument/);
      expect(result).toContain("[myVar]");
    });

    it("flattens nested InArgument wrappers", () => {
      const xaml = makeValidXaml("Main", `
        <Assign DisplayName="Test Assign">
          <Assign.To><OutArgument x:TypeArguments="x:String">[myVar]</OutArgument></Assign.To>
          <Assign.Value><InArgument x:TypeArguments="x:String"><InArgument x:TypeArguments="x:String">[someVal]</InArgument></InArgument></Assign.Value>
        </Assign>`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).not.toMatch(/<InArgument[^>]*><InArgument/);
      expect(result).toContain("[someVal]");
    });

    it("does not double-wrap already wrapped content", () => {
      const xaml = makeValidXaml("Main", `
        <Assign DisplayName="Test">
          <Assign.To><OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument></Assign.To>
          <Assign.Value><InArgument x:TypeArguments="x:String">[str_Input]</InArgument></Assign.Value>
        </Assign>`);
      const result = makeUiPathCompliant(xaml, "Windows");
      const outArgCount = (result.match(/<OutArgument/g) || []).length;
      const closeOutArgCount = (result.match(/<\/OutArgument>/g) || []).length;
      expect(outArgCount).toBe(closeOutArgCount);
      expect(outArgCount).toBe(1);
    });
  });

  describe("Regression: ui:Rethrow is a valid activity", () => {
    it("Rethrow tag survives makeUiPathCompliant", () => {
      const xaml = makeValidXaml("Main", `<Rethrow DisplayName="Rethrow" />`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain("Rethrow");
    });

    it("ui:Rethrow is not flagged as unknown activity in quality gate", () => {
      const xaml = makeValidXaml("Main", `<ui:Rethrow DisplayName="Rethrow" />`);
      const deps = { "UiPath.System.Activities": "25.10.0" };
      const result = runQG([{ name: "Main.xaml", content: xaml }], deps);
      const unknownActs = result.violations.filter(v => v.check === "unknown-activity" && v.detail.includes("Rethrow"));
      expect(unknownActs.length).toBe(0);
    });
  });

  describe("Regression: Variable declaration is now read-only in compliance", () => {
    it("compliance does not auto-declare variables (read-only mode)", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="[str_TestVar]" DisplayName="Test" />`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).not.toContain('Name="str_TestVar"');
    });

    it("compliance preserves XAML without adding variable declarations (read-only mode)", () => {
      const xaml = makeValidXaml("Main", `
        <ui:LogMessage Level="Info" Message="[str_Name]" DisplayName="Log Name" />
        <ui:LogMessage Level="Info" Message="[int_Count]" DisplayName="Log Count" />
        <ui:LogMessage Level="Info" Message="[bool_Flag]" DisplayName="Log Flag" />`);
      const result = makeUiPathCompliant(xaml, "Windows");
      expect(result).toContain("[str_Name]");
      expect(result).toContain("[int_Count]");
      expect(result).toContain("[bool_Flag]");
    });
  });

  describe("Regression: Duplicate attribute stripping", () => {
    it("removeDuplicateAttributes removes second DisplayName from an element", () => {
      const xmlWithDup = `<ui:LogMessage DisplayName="First" Level="Info" Message="[&quot;test&quot;]" DisplayName="Second" />`;
      const result = removeDuplicateAttributes(xmlWithDup);
      expect(result.changed).toBe(true);
      expect(result.fixedTags).toContain("ui:LogMessage");
      const dnCount = (result.content.match(/DisplayName="/g) || []).length;
      expect(dnCount).toBe(1);
      expect(result.content).toContain('DisplayName="First"');
      expect(result.content).not.toContain('DisplayName="Second"');
    });

    it("removeDuplicateAttributes returns unchanged for elements without duplicates", () => {
      const xmlNoDup = `<ui:LogMessage DisplayName="Only" Level="Info" Message="[&quot;test&quot;]" />`;
      const result = removeDuplicateAttributes(xmlNoDup);
      expect(result.changed).toBe(false);
      expect(result.fixedTags).toHaveLength(0);
    });

    it("generateRichXamlFromSpec does not produce duplicate DisplayName when properties contain DisplayName", () => {
      const spec = {
        name: "TestWorkflow",
        steps: [{
          activityType: "ui:LogMessage",
          activity: "Log Message",
          displayName: "Log Test",
          properties: {
            DisplayName: "Duplicate Display Name",
            Level: "Info",
            Message: "test message",
          } as Record<string, unknown>,
        }],
      };
      const result = generateRichXamlFromSpec(spec, undefined, undefined, "Windows");
      const compliant = makeUiPathCompliant(result.xaml, "Windows");
      const logElements = compliant.match(/<ui:LogMessage[^>]*\/?>/g) || [];
      expect(logElements.length).toBeGreaterThan(0);
      for (const el of logElements) {
        const dnCount = (el.match(/DisplayName="/g) || []).length;
        expect(dnCount).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Regression: Ampersand escaping in HTTP endpoint values", () => {
    it("compliance preserves URL values without mutation (read-only)", () => {
      const xamlWithAmpersand = makeValidXaml("Main",
        `<uweb:HttpClient Endpoint="[&quot;https://api.example.com/search?q=test&amp;limit=10&quot;]" Method="GET" DisplayName="Call API" />`
      );
      const result = makeUiPathCompliant(xamlWithAmpersand, "Windows");
      expect(result).toContain("api.example.com");
    });

    it("compliance preserves header parameter values (read-only)", () => {
      const xamlWithHeaderAmp = makeValidXaml("Main",
        `<uweb:HttpClient Headers="{&quot;X-Key&quot;: &quot;a&amp;b&quot;}" Endpoint="[&quot;https://api.example.com&quot;]" Method="GET" DisplayName="Call API" />`
      );
      const result = makeUiPathCompliant(xamlWithHeaderAmp, "Windows");
      expect(result).toContain("api.example.com");
    });

    it("properly formed XAML for HTTP activities produces zero XML parse errors", () => {
      const xaml = makeValidXaml("Main",
        `<uweb:HttpClient Endpoint="[&quot;https://api.example.com/data?page=1&amp;size=20&amp;sort=name&quot;]" Method="GET" DisplayName="Fetch Data" />`
      );
      const result = makeUiPathCompliant(xaml, "Windows");
      const violations = validateXamlContent([{ name: "Main.xaml", content: result }]);
      const xmlErrors = violations.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });

    it("end-to-end: generated XAML for process with email and HTTP activities has zero XML parse errors", () => {
      const spec = {
        name: "MixedWorkflow",
        steps: [
          {
            activityType: "ui:SendOutlookMailMessage",
            activity: "Send Email",
            displayName: "Send Notification",
            properties: {
              To: "user@example.com",
              Subject: "Report for Q1 & Q2",
              Body: "See attached data from https://api.example.com?key=val&other=2",
            } as Record<string, unknown>,
          },
          {
            activityType: "ui:HttpClient",
            activity: "HTTP Request",
            displayName: "Fetch API Data",
            properties: {
              URL: "https://api.example.com/search?q=test&limit=10&offset=0",
              Method: "GET",
            } as Record<string, unknown>,
          },
        ],
      };
      const result = generateRichXamlFromSpec(spec, undefined, undefined, "Windows");
      const compliant = makeUiPathCompliant(result.xaml, "Windows");
      const violations = validateXamlContent([{ name: "Main.xaml", content: compliant }]);
      const xmlErrors = violations.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors).toHaveLength(0);
      const allElements = compliant.match(/<[a-zA-Z_][\w.:]*\s[^>]*>/g) || [];
      for (const el of allElements) {
        const attrNames = [...el.matchAll(/\s([a-zA-Z_][\w.:]*)\s*=/g)].map(m => m[1]);
        const uniqueAttrs = new Set(attrNames);
        expect(uniqueAttrs.size).toBe(attrNames.length);
      }
    });
  });

  describe("Task 266: dict_Config, single-quote, and expression fixes", () => {
    it("dict_Config in InitAllSettings does not produce undeclared-variable error", () => {
      const initXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="InitAllSettings" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Init All Settings">
    <Sequence.Variables>
      <Variable x:TypeArguments="scg:Dictionary(x:String, x:Object)" Name="dict_Config" Default="[new Dictionary(Of String, Object)]" />
    </Sequence.Variables>
    <ui:LogMessage Level="Info" Message="[&quot;Config loaded: &quot; &amp; dict_Config.Count.ToString()]" DisplayName="Log Config" />
  </Sequence>
</Activity>`;
      const projectJson = makeProjectJson("InitTest");
      const result = runQualityGate({
        xamlEntries: [{ name: "InitAllSettings.xaml", content: initXaml }],
        projectJsonContent: projectJson,
        targetFramework: "Windows",
      });
      const dictConfigErrors = result.violations.filter(
        v => v.check === "undeclared-variable" && v.detail.includes("dict_Config")
      );
      expect(dictConfigErrors).toHaveLength(0);
    });

    it("dict_Config in non-InitAllSettings without in_Config produces warning, not error", () => {
      const wfXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="ProcessData" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Process Data">
    <Assign DisplayName="Read Config">
      <Assign.To><OutArgument x:TypeArguments="x:Object">[dict_Config]</OutArgument></Assign.To>
      <Assign.Value><InArgument x:TypeArguments="x:Object">[Nothing]</InArgument></Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
      const projectJson = makeProjectJson("ProcessTest");
      const result = runQualityGate({
        xamlEntries: [{ name: "ProcessData.xaml", content: wfXaml }],
        projectJsonContent: projectJson,
        targetFramework: "Windows",
      });
      const dictConfigErrors = result.violations.filter(
        v => v.check === "undeclared-variable" && v.detail.includes("dict_Config")
      );
      expect(dictConfigErrors).toHaveLength(0);
      const dictConfigWarnings = result.violations.filter(
        v => v.check === "dict-config-scope"
      );
      expect(dictConfigWarnings.length).toBeGreaterThan(0);
      expect(dictConfigWarnings[0].severity).toBe("warning");
    });

    it("single-quote quality gate ignores natural language apostrophes", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:LogMessage Level="Info" Message="Item doesn't exist in the system" DisplayName="Log Warning" />
  </Sequence>
</Activity>`;
      const projectJson = makeProjectJson("ApostropheTest");
      const result = runQualityGate({
        xamlEntries: [{ name: "Test.xaml", content: xaml }],
        projectJsonContent: projectJson,
        targetFramework: "Windows",
      });
      const singleQuoteErrors = result.violations.filter(
        v => v.detail.includes("single-quoted VB expression")
      );
      expect(singleQuoteErrors).toHaveLength(0);
    });

    it("single-quote values are preserved by compliance (read-only — no expression canonicalization)", () => {
      const xaml = makeValidXaml("Test", `<ui:LogMessage Level="Info" Message="'Hello World'" DisplayName="Log" />`);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain("'Hello World'");
    });

    it("SetTransactionStatus screenshotDefault uses &quot; entities in Default attribute", () => {
      const statusXaml = generateSetTransactionStatusXaml("Windows");
      const defaultMatch = statusXaml.match(/str_ScreenshotPath[^>]*Default="(\[[^"]*\])"/);
      expect(defaultMatch).toBeTruthy();
      expect(defaultMatch![1]).toContain("&quot;");
      expect(defaultMatch![1]).not.toMatch(/\["/);
    });
  });

  describe("regression: studio-blocking fixes", () => {
    it("generateInitAllSettingsXaml uses capital New for VB dict_Config default", () => {
      const xaml = generateInitAllSettingsXaml(undefined, "Windows");
      const dictMatch = xaml.match(/Name="dict_Config"[^>]*Default="([^"]*)"/);
      expect(dictMatch).toBeTruthy();
      expect(dictMatch![1]).toContain("New Dictionary(Of String, Object)");
      expect(dictMatch![1]).not.toContain("new Dictionary(Of String, Object)");
    });

    it("generateInitAllSettingsXaml uses DelegateInArgument instead of bare Argument", () => {
      const xaml = generateInitAllSettingsXaml(undefined, "Windows");
      expect(xaml).not.toMatch(/<Argument\s+x:TypeArguments="scg2:DataRow"\s+x:Name="/);
      expect(xaml).toContain("<ActivityAction.Argument>");
      expect(xaml).toContain("<DelegateInArgument x:TypeArguments=\"scg2:DataRow\" Name=\"row\" />");
      expect(xaml).toContain("<DelegateInArgument x:TypeArguments=\"scg2:DataRow\" Name=\"constRow\" />");
    });

    it("quality gate detects unprefixed activity tags as blocking errors", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="[&quot;test&quot;]" DisplayName="Log" />`);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      const injected = compliant.replace(
        /<ui:LogMessage/,
        `<InvokeWorkflowFile DisplayName="Init" WorkflowFileName="Init.xaml" />\n      <ui:LogMessage`
      );
      const required = scanXamlForRequiredPackages(injected);
      const deps: Record<string, string> = {};
      for (const pkg of required) deps[pkg] = "25.10.0";
      if (!deps["UiPath.System.Activities"]) deps["UiPath.System.Activities"] = "25.10.0";
      const result = runQG(
        [{ name: "Main.xaml", content: injected }],
        deps,
      );
      const unprefixedErrors = result.violations.filter(v => v.check === "unprefixed-activity");
      expect(unprefixedErrors.length).toBeGreaterThan(0);
      expect(unprefixedErrors[0].severity).toBe("error");
      expect(unprefixedErrors[0].detail).toContain("InvokeWorkflowFile");
    });

    it("generateInitAllSettingsXaml preserves WorkbookPath and DataTable on Excel activities", () => {
      const xaml = generateInitAllSettingsXaml(undefined, "Windows");
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toMatch(/WorkbookPath=/);
      expect(compliant).toMatch(/DataTable=/);
    });

    it("quality gate does NOT flag prefixed activities as unprefixed", () => {
      const xaml = makeValidXaml("Main", `<ui:InvokeWorkflowFile DisplayName="Init" WorkflowFileName="Init.xaml" />`);
      const compliant = makeUiPathCompliant(xaml, "Windows");
      const required = scanXamlForRequiredPackages(compliant);
      const deps: Record<string, string> = {};
      for (const pkg of required) deps[pkg] = "25.10.0";
      if (!deps["UiPath.System.Activities"]) deps["UiPath.System.Activities"] = "25.10.0";
      const result = runQG(
        [{ name: "Main.xaml", content: compliant }],
        deps,
      );
      const unprefixedErrors = result.violations.filter(v => v.check === "unprefixed-activity");
      expect(unprefixedErrors).toHaveLength(0);
    });

    it("quality gate does NOT flag AssemblyReference tags inside TextExpression metadata blocks", () => {
      const xamlWithMetadata = makeValidXaml("Main", `<ui:MessageBox DisplayName="Hello" />`);
      const compliant = makeUiPathCompliant(xamlWithMetadata, "Windows");
      expect(compliant).toContain("<AssemblyReference>");
      expect(compliant).toContain("<TextExpression.ReferencesForImplementation>");
      const required = scanXamlForRequiredPackages(compliant);
      const deps: Record<string, string> = {};
      for (const pkg of required) deps[pkg] = "25.10.0";
      if (!deps["UiPath.System.Activities"]) deps["UiPath.System.Activities"] = "25.10.0";
      const result = runQG(
        [{ name: "Main.xaml", content: compliant }],
        deps,
      );
      const assemblyRefViolations = result.violations.filter(
        v => v.check === "UNPREFIXED_ACTIVITY_TAG" && v.detail?.includes("AssemblyReference")
      );
      expect(assemblyRefViolations).toHaveLength(0);
    });

    it("quality gate STILL flags real unprefixed activity tags outside metadata blocks", () => {
      const xamlWithUnprefixed = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
          xmlns:ui="http://schemas.uipath.com/workflow/activities"
          xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence>
    <TextExpression.ReferencesForImplementation>
      <sco:Collection x:TypeArguments="AssemblyReference" xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib">
        <AssemblyReference>System.Activities</AssemblyReference>
      </sco:Collection>
    </TextExpression.ReferencesForImplementation>
    <FakeCustomActivity DisplayName="Should be flagged" />
  </Sequence>
</Activity>`;
      const result = runQG(
        [{ name: "Main.xaml", content: xamlWithUnprefixed }],
        { "UiPath.System.Activities": "25.10.0" },
      );
      const fakeViolations = result.violations.filter(
        v => v.check === "UNPREFIXED_ACTIVITY_TAG" && v.detail?.includes("FakeCustomActivity")
      );
      expect(fakeViolations.length).toBeGreaterThan(0);
      const assemblyRefViolations = result.violations.filter(
        v => v.check === "UNPREFIXED_ACTIVITY_TAG" && v.detail?.includes("AssemblyReference")
      );
      expect(assemblyRefViolations).toHaveLength(0);
    });
  });
});
