import { describe, it, expect, beforeAll } from "vitest";
import { validateCatalog } from "../catalog/catalog-validator";
import { catalogService, type ProcessType } from "../catalog/catalog-service";
import { validateWorkflowSpec, type SpecValidationReport } from "../catalog/spec-validator";
import { classifyProcessType } from "../ai-xaml-enricher";
import { classifyQualityIssues, getBlockingFiles } from "../uipath-quality-gate";
import { buildTemplateBlock, calculateTemplateCompliance, formatTemplateBlockForPrompt } from "../catalog/xaml-template-builder";
import { resolveActivityTemplate } from "../workflow-tree-assembler";
import { readFileSync } from "fs";
import { join } from "path";

const catalogPath = join(process.cwd(), "catalog", "activity-catalog.json");

describe("Activity Catalog", () => {
  let catalog: any;

  beforeAll(() => {
    catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
    catalogService.load(catalogPath);
  });

  describe("Catalog Validator", () => {
    it("validates the bootstrap catalog successfully", () => {
      const result = validateCatalog(catalog);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects a catalog with missing catalogVersion", () => {
      const bad = { ...catalog, catalogVersion: undefined };
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("catalogVersion"))).toBe(true);
    });

    it("rejects a catalog with empty packages", () => {
      const bad = { ...catalog, packages: [] };
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("non-empty array"))).toBe(true);
    });

    it("rejects a catalog with empty packageId", () => {
      const bad = JSON.parse(JSON.stringify(catalog));
      bad.packages[0].packageId = "";
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("must not be empty"))).toBe(true);
    });

    it("rejects a catalog with duplicate packageIds", () => {
      const bad = JSON.parse(JSON.stringify(catalog));
      bad.packages.push({ ...bad.packages[0] });
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("duplicate packageId"))).toBe(true);
    });

    it("rejects invalid argumentWrapper values", () => {
      const bad = JSON.parse(JSON.stringify(catalog));
      bad.packages[0].activities[0].properties[0].argumentWrapper = "BadWrapper";
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("argumentWrapper"))).toBe(true);
    });

    it("validates generatedAt as ISO 8601", () => {
      const bad = { ...catalog, generatedAt: "not-a-date" };
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("ISO 8601"))).toBe(true);
    });

    it("validates studioVersion as semver", () => {
      const bad = { ...catalog, studioVersion: "not-semver" };
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("semver"))).toBe(true);
    });

    it("rejects an activity with invalid direction", () => {
      const bad = JSON.parse(JSON.stringify(catalog));
      bad.packages[0].activities[0].properties[0].direction = "InvalidDir";
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("direction"))).toBe(true);
    });

    it("rejects an activity with invalid xamlSyntax", () => {
      const bad = JSON.parse(JSON.stringify(catalog));
      bad.packages[0].activities[0].properties[0].xamlSyntax = "invalid";
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("xamlSyntax"))).toBe(true);
    });

    it("rejects a null catalog", () => {
      const result = validateCatalog(null);
      expect(result.valid).toBe(false);
    });

    it("rejects a package with invalid version", () => {
      const bad = JSON.parse(JSON.stringify(catalog));
      bad.packages[0].version = "not-a-version";
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes("version format"))).toBe(true);
    });
  });

  describe("Catalog Service - getActivitySchema", () => {
    it("returns schema for Assign", () => {
      const schema = catalogService.getActivitySchema("Assign");
      expect(schema).not.toBeNull();
      expect(schema!.activity.className).toBe("Assign");
      expect(schema!.activity.properties.length).toBeGreaterThan(0);
    });

    it("returns schema for prefixed activity ui:Click -> Click", () => {
      const schema = catalogService.getActivitySchema("ui:Click");
      expect(schema).not.toBeNull();
      expect(schema!.activity.className).toBe("Click");
      expect(schema!.packageId).toBe("UiPath.UIAutomation.Activities");
    });

    it("returns schema for unprefixed className", () => {
      const schema = catalogService.getActivitySchema("HttpClient");
      expect(schema).not.toBeNull();
      expect(schema!.activity.className).toBe("HttpClient");
      expect(schema!.packageId).toBe("UiPath.WebAPI.Activities");
      const methodProp = schema!.activity.properties.find(p => p.name === "Method");
      expect(methodProp).toBeDefined();
      expect(methodProp!.required).toBe(true);
    });

    it("returns null for unknown activity", () => {
      const schema = catalogService.getActivitySchema("ui:NonexistentActivity");
      expect(schema).toBeNull();
    });

    it("returns correct properties for Assign with child-element syntax and typeArguments", () => {
      const schema = catalogService.getActivitySchema("Assign");
      expect(schema).not.toBeNull();
      const toProp = schema!.activity.properties.find(p => p.name === "To");
      expect(toProp).toBeDefined();
      expect(toProp!.xamlSyntax).toBe("child-element");
      expect(toProp!.argumentWrapper).toBe("OutArgument");
      expect(toProp!.typeArguments).toBe("x:Object");
    });
  });

  describe("Catalog Service - validateEmittedActivity", () => {
    it("detects Assign.To emitted as attribute instead of child-element", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        { To: "myVar", Value: "someValue" },
        []
      );
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.corrections.some(c => c.type === "move-to-child-element" && c.property === "To")).toBe(true);
      expect(result.corrections.some(c => c.type === "move-to-child-element" && c.property === "Value")).toBe(true);
    });

    it("returns valid for Assign with correct child-element usage", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        {},
        ["To", "Assign.To", "Value", "Assign.Value"]
      );
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("returns valid for Click with attribute properties", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:Click",
        { ClickType: "CLICK_SINGLE", TimeoutMS: "30000" },
        []
      );
      expect(result.valid).toBe(true);
    });

    it("returns valid for unknown activity", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:UnknownActivity",
        { SomeProp: "value" },
        []
      );
      expect(result.valid).toBe(true);
    });

    it("detects missing required properties", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:KillProcess",
        {},
        []
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes("ProcessName"))).toBe(true);
      expect(result.corrections.some(c => c.type === "add-missing-required")).toBe(true);
    });
  });

  describe("Catalog Service - buildActivityPalette", () => {
    it("returns activities for api-integration processType", () => {
      const palette = catalogService.buildActivityPalette("api-integration");
      expect(palette.length).toBeGreaterThan(0);
      const classNames = palette.map(p => p.className);
      expect(classNames).toContain("HttpClient");
      expect(classNames).toContain("DeserializeJson");
      expect(classNames).toContain("Assign");
    });

    it("returns UI activities for attended-ui processType", () => {
      const palette = catalogService.buildActivityPalette("attended-ui");
      expect(palette.length).toBeGreaterThan(0);
      const classNames = palette.map(p => p.className);
      expect(classNames).toContain("Click");
      expect(classNames).toContain("TypeInto");
    });

    it("returns document processing activities for document-processing type", () => {
      const palette = catalogService.buildActivityPalette("document-processing");
      const classNames = palette.map(p => p.className);
      expect(classNames).toContain("DigitizeDocument");
      expect(classNames).toContain("ClassifyDocument");
      expect(classNames).toContain("Assign");
    });

    it("returns orchestration activities for orchestration type", () => {
      const palette = catalogService.buildActivityPalette("orchestration");
      const classNames = palette.map(p => p.className);
      expect(classNames).toContain("AddQueueItem");
      expect(classNames).toContain("GetTransactionItem");
      expect(classNames).toContain("SetTransactionStatus");
    });

    it("general processType returns broad palette", () => {
      const palette = catalogService.buildActivityPalette("general");
      expect(palette.length).toBeGreaterThan(10);
    });

    it("each palette entry has required fields including xamlSyntax", () => {
      const palette = catalogService.buildActivityPalette("general");
      for (const entry of palette) {
        expect(entry.className).toBeTruthy();
        expect(entry.displayName).toBeTruthy();
        expect(Array.isArray(entry.properties)).toBe(true);
        for (const prop of entry.properties) {
          expect(["attribute", "child-element"]).toContain(prop.xamlSyntax);
        }
      }
    });
  });

  describe("Catalog Service - getConfirmedVersion", () => {
    it("returns version for known packages", () => {
      const version = catalogService.getConfirmedVersion("UiPath.System.Activities");
      expect(version).not.toBeNull();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("returns version for UiPath.UIAutomation.Activities", () => {
      const version = catalogService.getConfirmedVersion("UiPath.UIAutomation.Activities");
      expect(version).not.toBeNull();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("returns null for unknown packages", () => {
      const version = catalogService.getConfirmedVersion("UiPath.NonExistent.Package");
      expect(version).toBeNull();
    });

    it("returns version for System.Activities (Assign/Throw)", () => {
      const version = catalogService.getConfirmedVersion("System.Activities");
      expect(version).not.toBeNull();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("Catalog Service - getPackageForActivity", () => {
    it("returns package for Click", () => {
      const pkg = catalogService.getPackageForActivity("ui:Click");
      expect(pkg).toBe("UiPath.UIAutomation.Activities");
    });

    it("returns package for HttpClient", () => {
      const pkg = catalogService.getPackageForActivity("HttpClient");
      expect(pkg).toBe("UiPath.WebAPI.Activities");
    });

    it("returns null for unknown activity", () => {
      const pkg = catalogService.getPackageForActivity("ui:NonExistent");
      expect(pkg).toBeNull();
    });

    it("returns UiPath.Excel.Activities for ExcelReadRange (Task #447)", () => {
      const pkg = catalogService.getPackageForActivity("ExcelReadRange");
      expect(pkg).toBe("UiPath.Excel.Activities");
    });

    it("returns UiPath.Excel.Activities for ExcelApplicationScope (Task #447)", () => {
      const pkg = catalogService.getPackageForActivity("ExcelApplicationScope");
      expect(pkg).toBe("UiPath.Excel.Activities");
    });

    it("returns UiPath.Excel.Activities for ExcelWriteRange (Task #447)", () => {
      const pkg = catalogService.getPackageForActivity("ExcelWriteRange");
      expect(pkg).toBe("UiPath.Excel.Activities");
    });
  });

  describe("Catalog Service - getActivitiesForPackage", () => {
    it("returns activities for UiPath.UIAutomation.Activities", () => {
      const activities = catalogService.getActivitiesForPackage("UiPath.UIAutomation.Activities");
      expect(activities.length).toBeGreaterThan(0);
      const classNames = activities.map(a => a.className);
      expect(classNames).toContain("Click");
      expect(classNames).toContain("TypeInto");
    });

    it("returns empty for unknown package", () => {
      const activities = catalogService.getActivitiesForPackage("Unknown.Package");
      expect(activities).toHaveLength(0);
    });
  });

  describe("Process Type Classification", () => {
    it("classifies API-heavy content as api-integration", () => {
      const result = classifyProcessType(
        "This process uses REST API endpoints to fetch JSON data from the web service",
        []
      );
      expect(result).toBe("api-integration");
    });

    it("classifies document processing content", () => {
      const result = classifyProcessType(
        "Use intelligent OCR to digitize the document and extract data from PDF invoices",
        []
      );
      expect(result).toBe("document-processing");
    });

    it("classifies orchestration content", () => {
      const result = classifyProcessType(
        "Get transaction from queue and process each item using REFramework dispatcher performer pattern",
        []
      );
      expect(result).toBe("orchestration");
    });

    it("classifies unattended UI content", () => {
      const result = classifyProcessType(
        "Click the button and type into the field, get text from browser using selectors for scheduled background process",
        []
      );
      expect(result).toBe("unattended-ui");
    });

    it("defaults to general for non-specific content", () => {
      const result = classifyProcessType(
        "Process the data and generate a report",
        []
      );
      expect(result).toBe("general");
    });
  });

  describe("Catalog loading edge cases", () => {
    it("isLoaded returns true after successful load", () => {
      expect(catalogService.isLoaded()).toBe(true);
    });
  });

  describe("Framework attribute whitelist", () => {
    it("does not flag WorkflowViewState.IdRef as a violation", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        { "sap2010:WorkflowViewState.IdRef": "Assign_1", "WorkflowViewState.IdRef": "Assign_1" },
        ["Assign.To", "Assign.Value"]
      );
      expect(result.violations.filter(v => v.includes("WorkflowViewState"))).toHaveLength(0);
    });

    it("does not flag VirtualizedContainerService.HintSize as a violation", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        { "sap2010:VirtualizedContainerService.HintSize": "200,22" },
        ["Assign.To", "Assign.Value"]
      );
      expect(result.violations.filter(v => v.includes("VirtualizedContainerService"))).toHaveLength(0);
    });

    it("does not flag Variables as a child element violation", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        {},
        ["Assign.To", "Assign.Value", "Variables"]
      );
      expect(result.violations.filter(v => v.includes("Variables"))).toHaveLength(0);
    });

    it("does not flag xmlns declarations as violations", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        { "xmlns": "http://schemas.microsoft.com/netfx/2009/xaml/activities", "xmlns:x": "http://schemas.microsoft.com/winfx/2006/xaml" },
        ["Assign.To", "Assign.Value"]
      );
      expect(result.violations.filter(v => v.includes("xmlns"))).toHaveLength(0);
    });

    it("does not flag x:Class, x:TypeArguments, x:Name, mc:Ignorable as violations", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        { "x:Class": "MyClass", "x:TypeArguments": "x:String", "x:Name": "assign1", "mc:Ignorable": "sap sap2010" },
        ["Assign.To", "Assign.Value"]
      );
      expect(result.violations).toHaveLength(0);
    });

    it("does not flag VirtualizedContainerService.HintSize as a child element violation", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        {},
        ["Assign.To", "Assign.Value", "VirtualizedContainerService.HintSize"]
      );
      expect(result.violations.filter(v => v.includes("VirtualizedContainerService"))).toHaveLength(0);
    });

    it("does not flag sap:VirtualizedContainerService.HintSize as a violation", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        { "sap:VirtualizedContainerService.HintSize": "200,22" },
        ["Assign.To", "Assign.Value"]
      );
      expect(result.violations.filter(v => v.includes("VirtualizedContainerService"))).toHaveLength(0);
    });

    it("does not flag WorkflowViewState.IdRef as a child element violation", () => {
      const result = catalogService.validateEmittedActivity(
        "Assign",
        {},
        ["Assign.To", "Assign.Value", "WorkflowViewState.IdRef"]
      );
      expect(result.violations.filter(v => v.includes("WorkflowViewState"))).toHaveLength(0);
    });
  });

  describe("CATALOG_VIOLATION classification", () => {
    it("classifies CATALOG_VIOLATION as warning, not blocking", () => {
      const mockResult = {
        passed: true,
        violations: [{
          category: "accuracy" as const,
          severity: "warning" as const,
          check: "CATALOG_VIOLATION",
          file: "Main.xaml",
          detail: "Some catalog violation",
        }],
        positiveEvidence: [],
        typeRepairs: [],
        summary: {
          blockedPatterns: 0,
          completenessErrors: 0,
          completenessWarnings: 0,
          accuracyErrors: 0,
          accuracyWarnings: 1,
          runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0,
          logicLocationWarnings: 0,
          totalErrors: 0,
          totalWarnings: 1,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
    });

    it("CATALOG_VIOLATION does not produce blocking files (no STUB_BLOCKING_FALLBACK)", () => {
      const mockResult = {
        passed: true,
        violations: [
          {
            category: "accuracy" as const,
            severity: "warning" as const,
            check: "CATALOG_VIOLATION",
            file: "Main.xaml",
            detail: "Unrecognized attribute on SomeActivity",
          },
          {
            category: "accuracy" as const,
            severity: "warning" as const,
            check: "CATALOG_VIOLATION",
            file: "InitAllSettings.xaml",
            detail: "Another catalog violation",
          },
        ],
        positiveEvidence: [],
        typeRepairs: [],
        summary: {
          blockedPatterns: 0,
          completenessErrors: 0,
          completenessWarnings: 0,
          accuracyErrors: 0,
          accuracyWarnings: 2,
          runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0,
          logicLocationWarnings: 0,
          totalErrors: 0,
          totalWarnings: 2,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      const blockingFiles = getBlockingFiles(issues);
      expect(blockingFiles.size).toBe(0);
      expect(issues.every(i => i.severity === "warning")).toBe(true);
    });
  });

  describe("Catalog Service - package versions", () => {
    it("returns a valid version for UiPath.WebAPI.Activities", () => {
      const version = catalogService.getConfirmedVersion("UiPath.WebAPI.Activities");
      expect(version).not.toBeNull();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("returns a valid version for UiPath.Excel.Activities", () => {
      const version = catalogService.getConfirmedVersion("UiPath.Excel.Activities");
      expect(version).not.toBeNull();
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("Updated activity schemas", () => {
    it("HttpClient has EndpointUrl required and Method required", () => {
      const schema = catalogService.getActivitySchema("HttpClient");
      expect(schema).not.toBeNull();
      const endpointUrl = schema!.activity.properties.find(p => p.name === "EndpointUrl");
      expect(endpointUrl).toBeDefined();
      expect(endpointUrl!.required).toBe(true);
      const method = schema!.activity.properties.find(p => p.name === "Method");
      expect(method).toBeDefined();
      expect(method!.required).toBe(true);
    });

    it("HttpClient ResponseContent uses child-element with OutArgument", () => {
      const schema = catalogService.getActivitySchema("HttpClient");
      expect(schema).not.toBeNull();
      const rc = schema!.activity.properties.find(p => p.name === "ResponseContent");
      expect(rc).toBeDefined();
      expect(rc!.xamlSyntax).toBe("child-element");
      expect(rc!.argumentWrapper).toBe("OutArgument");
    });

    it("HttpClient ResponseStatusCode uses Int32 with child-element OutArgument", () => {
      const schema = catalogService.getActivitySchema("HttpClient");
      expect(schema).not.toBeNull();
      const rsc = schema!.activity.properties.find(p => p.name === "ResponseStatusCode");
      expect(rsc).toBeDefined();
      expect(rsc!.clrType).toBe("System.Int32");
      expect(rsc!.xamlSyntax).toBe("child-element");
      expect(rsc!.argumentWrapper).toBe("OutArgument");
    });

    it("HttpClient Headers uses attribute syntax", () => {
      const schema = catalogService.getActivitySchema("HttpClient");
      expect(schema).not.toBeNull();
      const headers = schema!.activity.properties.find(p => p.name === "Headers");
      expect(headers).toBeDefined();
      expect(headers!.xamlSyntax).toBe("attribute");
    });

    it("DeserializeJson has required JsonString and Result properties with child-element wrappers", () => {
      const schema = catalogService.getActivitySchema("DeserializeJson");
      expect(schema).not.toBeNull();
      const jsonString = schema!.activity.properties.find(p => p.name === "JsonString");
      expect(jsonString).toBeDefined();
      expect(jsonString!.required).toBe(true);
      expect(jsonString!.xamlSyntax).toBe("child-element");
      expect(jsonString!.argumentWrapper).toBe("InArgument");
      const result = schema!.activity.properties.find(p => p.name === "Result");
      expect(result).toBeDefined();
      expect(result!.required).toBe(true);
      expect(result!.xamlSyntax).toBe("child-element");
      expect(result!.argumentWrapper).toBe("OutArgument");
    });

    it("ExcelApplicationScope has required WorkbookPath with child-element InArgument", () => {
      const schema = catalogService.getActivitySchema("ExcelApplicationScope");
      expect(schema).not.toBeNull();
      const wp = schema!.activity.properties.find(p => p.name === "WorkbookPath");
      expect(wp).toBeDefined();
      expect(wp!.required).toBe(true);
      expect(wp!.xamlSyntax).toBe("child-element");
      expect(wp!.argumentWrapper).toBe("InArgument");
    });

    it("ExcelReadRange has required DataTable with child-element OutArgument", () => {
      const schema = catalogService.getActivitySchema("ExcelReadRange");
      expect(schema).not.toBeNull();
      const dt = schema!.activity.properties.find(p => p.name === "DataTable");
      expect(dt).toBeDefined();
      expect(dt!.required).toBe(true);
      expect(dt!.xamlSyntax).toBe("child-element");
      expect(dt!.argumentWrapper).toBe("OutArgument");
    });

    it("ReadRange (Workbook) has required DataTable with child-element OutArgument", () => {
      const schema = catalogService.getActivitySchema("ReadRange");
      expect(schema).not.toBeNull();
      const dt = schema!.activity.properties.find(p => p.name === "DataTable");
      expect(dt).toBeDefined();
      expect(dt!.required).toBe(true);
      expect(dt!.xamlSyntax).toBe("child-element");
      expect(dt!.argumentWrapper).toBe("OutArgument");
    });
  });

  describe("Template Builder - buildTemplateBlock", () => {
    it("returns templates for api-integration processType", () => {
      const block = buildTemplateBlock("api-integration");
      expect(block.processType).toBe("api-integration");
      expect(block.activityTemplates.length).toBeGreaterThan(0);
      expect(block.structuralTemplates.length).toBeGreaterThan(0);
      expect(block.variableTemplate).toBeDefined();
      expect(block.workflowHeaderTemplate).toBeDefined();
      const names = block.activityTemplates.map(t => t.name);
      expect(names).toContain("Assign");
      expect(names).toContain("LogMessage");
      expect(names).toContain("InvokeWorkflowFile");
      expect(names).toContain("RetryScope");
      expect(names).toContain("Rethrow");
      expect(names).toContain("Delay");
      expect(names).toContain("HttpClient");
    });

    it("returns templates for attended-ui processType with UI activities", () => {
      const block = buildTemplateBlock("attended-ui");
      const names = block.activityTemplates.map(t => t.name);
      expect(names).toContain("Click");
      expect(names).toContain("TypeInto");
      expect(names).toContain("Assign");
      expect(names).toContain("LogMessage");
    });

    it("returns templates for general processType", () => {
      const block = buildTemplateBlock("general");
      expect(block.activityTemplates.length).toBeGreaterThan(5);
      expect(block.templateNames.length).toBeGreaterThan(0);
    });

    it("LogMessage template has valid enum values for Level", () => {
      const block = buildTemplateBlock("general");
      const logMsg = block.activityTemplates.find(t => t.name === "LogMessage");
      expect(logMsg).toBeDefined();
      const levelPh = logMsg!.placeholders.find(p => p.key === "level");
      expect(levelPh).toBeDefined();
      expect(levelPh!.validValues).toContain("Info");
      expect(levelPh!.validValues).toContain("Warn");
      expect(levelPh!.validValues).toContain("Error");
      expect(levelPh!.validValues).toContain("Fatal");
      expect(levelPh!.validValues).toContain("Trace");
      expect(levelPh!.validValues).not.toContain("Information");
      expect(levelPh!.validValues).not.toContain("Warning");
      expect(levelPh!.validValues).not.toContain("Debug");
      expect(levelPh!.validValues).not.toContain("Critical");
    });

    it("templateNames includes all template names", () => {
      const block = buildTemplateBlock("general");
      expect(block.templateNames).toContain("Assign");
      expect(block.templateNames).toContain("LogMessage");
      expect(block.templateNames).toContain("TryCatch");
      expect(block.templateNames).toContain("IfThenElse");
      expect(block.templateNames).toContain("VariableDeclaration");
      expect(block.templateNames).toContain("WorkflowHeader");
    });

    it("formatTemplateBlockForPrompt produces valid prompt text", () => {
      const block = buildTemplateBlock("api-integration");
      const promptText = formatTemplateBlockForPrompt(block);
      expect(promptText).toContain("ACTIVITY TEMPLATES");
      expect(promptText).toContain("Activity Templates");
      expect(promptText).toContain("Structural Templates");
      expect(promptText).toContain("Variable Declaration Template");
      expect(promptText).toContain("Workflow Header Template");
      expect(promptText).toContain("Available template names:");
      expect(promptText).toContain("Info | Warn | Error | Fatal | Trace");
    });
  });

  describe("Template Compliance Scoring", () => {
    it("calculates perfect score for compliant XAML", () => {
      const goodXaml = `
        <Activity x:Class="TestWorkflow" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
          <Sequence DisplayName="Main">
            <ui:LogMessage Level="Info" Message="[&quot;Starting&quot;]" DisplayName="Log Start" />
            <Assign DisplayName="Set Value">
              <Assign.To><OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument></Assign.To>
              <Assign.Value><InArgument x:TypeArguments="x:String">[str_Input]</InArgument></Assign.Value>
            </Assign>
            <ui:LogMessage Level="Error" Message="[&quot;Done&quot;]" DisplayName="Log End" />
          </Sequence>
        </Activity>
      `;
      const result = calculateTemplateCompliance(goodXaml);
      expect(result.score).toBeGreaterThanOrEqual(0.9);
      expect(result.totalActivities).toBeGreaterThan(0);
      expect(result.violations.filter(v => v.severity === "error")).toHaveLength(0);
    });

    it("auto-corrects normalizable enum values so no violation for LogMessage Level=Information", () => {
      const badXaml = `
        <Activity x:Class="TestWorkflow" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
          <Sequence DisplayName="Main">
            <ui:LogMessage Level="Information" Message="[&quot;Bad level&quot;]" DisplayName="Log Bad" />
          </Sequence>
        </Activity>
      `;
      const result = calculateTemplateCompliance(badXaml);
      expect(result.violations.filter(v => v.issue.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });

    it("detects truly invalid enum values that cannot be normalized", () => {
      const badXaml = `
        <Activity x:Class="TestWorkflow" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
          <Sequence DisplayName="Main">
            <ui:LogMessage Level="Nonsense1" Message="[&quot;Bad level 1&quot;]" DisplayName="Log 1" />
            <ui:LogMessage Level="Nonsense2" Message="[&quot;Bad level 2&quot;]" DisplayName="Log 2" />
            <ui:LogMessage Level="Nonsense3" Message="[&quot;Bad level 3&quot;]" DisplayName="Log 3" />
          </Sequence>
        </Activity>
      `;
      const result = calculateTemplateCompliance(badXaml);
      expect(result.score).toBe(0);
      expect(result.compliantActivities).toBe(0);
      expect(result.totalActivities).toBe(3);
    });

    it("returns score of 1.0 for empty XAML", () => {
      const result = calculateTemplateCompliance("<Activity></Activity>");
      expect(result.score).toBe(1.0);
      expect(result.totalActivities).toBe(0);
    });

    it("detects double-wrapped arguments", () => {
      const badXaml = `
        <Activity x:Class="TestWorkflow" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
          <Sequence DisplayName="Main">
            <Assign DisplayName="Bad Assign">
              <Assign.To>
                <OutArgument x:TypeArguments="x:String">
                  <OutArgument x:TypeArguments="x:String">[str_Val]</OutArgument>
                </OutArgument>
              </Assign.To>
            </Assign>
          </Sequence>
        </Activity>
      `;
      const result = calculateTemplateCompliance(badXaml);
      expect(result.violations.some(v => v.issue.includes("Double-wrapped"))).toBe(true);
    });
  });

  describe("Enum Violation Handling", () => {
    it("auto-corrects normalizable enum values like Information → Info", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:LogMessage",
        { Level: "Information", Message: "test" },
        []
      );
      expect(result.valid).toBe(true);
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
      const correction = result.corrections.find(c => c.property === "Level");
      expect(correction).toBeDefined();
      expect(correction!.correctedValue).toBe("Info");
    });

    it("flags truly invalid enum values as ENUM_VIOLATION", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:LogMessage",
        { Level: "Nonsense", Message: "test" },
        []
      );
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes("ENUM_VIOLATION"))).toBe(true);
      const correction = result.corrections.find(c => c.property === "Level");
      expect(correction).toBeDefined();
      expect(correction!.correctedValue).toBeUndefined();
    });

    it("does not flag valid enum values", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:LogMessage",
        { Level: "Info", Message: "test" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });

    it("strips &quot; XML entities from enum values: &quot;GET&quot; → GET", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:HttpClientRequest",
        { Method: "&quot;GET&quot;", EndPoint: "http://example.com" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });

    it('strips surrounding double quotes from enum values: "POST" → POST', () => {
      const result = catalogService.validateEmittedActivity(
        "ui:HttpClientRequest",
        { Method: '"POST"', EndPoint: "http://example.com" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });

    it("strips &quot; from enum values and matches exact: &quot;Info&quot; → Info", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:LogMessage",
        { Level: "&quot;Info&quot;", Message: "test" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });

    it("strips &quot; from enum values via normalizeEnumValue synonym: &quot;Information&quot; → Info", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:LogMessage",
        { Level: "&quot;Information&quot;", Message: "test" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
      const correction = result.corrections.find(c => c.property === "Level");
      expect(correction).toBeDefined();
      expect(correction!.correctedValue).toBe("Info");
    });

    it("strips single quotes from enum values: 'GET' → GET", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:HttpClientRequest",
        { Method: "'GET'", EndPoint: "http://example.com" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });

    it("strips &quot; from Algorithm enum: &quot;SHA256&quot; → SHA256", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:HashText",
        { Algorithm: "&quot;SHA256&quot;", Input: "test" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });

    it("strips &quot; from Encoding enum: &quot;UTF-8&quot; → UTF-8", () => {
      const result = catalogService.validateEmittedActivity(
        "ui:HashText",
        { Encoding: "&quot;UTF-8&quot;", Input: "test", Algorithm: "SHA256" },
        []
      );
      expect(result.violations.filter(v => v.includes("ENUM_VIOLATION"))).toHaveLength(0);
    });
  });

  describe("ENUM_VIOLATION is a blocking quality gate error", () => {
    it("ENUM_VIOLATION is in BLOCKING_CHECKS and classifies as blocking", () => {
      const mockResult = {
        passed: false,
        violations: [{
          category: "accuracy" as const,
          severity: "error" as const,
          check: "ENUM_VIOLATION",
          file: "Main.xaml",
          detail: 'ENUM_VIOLATION: Invalid value "Information" for "Level" on ui:LogMessage',
        }],
        positiveEvidence: [],
        typeRepairs: [],
        summary: {
          blockedPatterns: 0,
          completenessErrors: 0,
          completenessWarnings: 0,
          accuracyErrors: 1,
          accuracyWarnings: 0,
          runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0,
          logicLocationWarnings: 0,
          totalErrors: 1,
          totalWarnings: 0,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("blocking");
    });

    it("ENUM_VIOLATION produces blocking files", () => {
      const mockResult = {
        passed: false,
        violations: [{
          category: "accuracy" as const,
          severity: "error" as const,
          check: "ENUM_VIOLATION",
          file: "Main.xaml",
          detail: 'ENUM_VIOLATION: Invalid value "Information" for "Level"',
        }],
        positiveEvidence: [],
        typeRepairs: [],
        summary: {
          blockedPatterns: 0,
          completenessErrors: 0,
          completenessWarnings: 0,
          accuracyErrors: 1,
          accuracyWarnings: 0,
          runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0,
          logicLocationWarnings: 0,
          totalErrors: 1,
          totalWarnings: 0,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      const blockingFiles = getBlockingFiles(issues);
      expect(blockingFiles).toContain("Main.xaml");
    });
  });

  describe("Catalog conformance at emission time (Task 149)", () => {
    it("LogMessage emits catalog-conformant XML (Message as attribute)", () => {
      const node = {
        kind: "activity" as const,
        template: "LogMessage",
        displayName: "Log Test",
        properties: { Level: "Info", Message: "Hello" },
      };
      const xml = resolveActivityTemplate(node, []);
      expect(xml).toContain("LogMessage");
      expect(xml).toContain('Level="Info"');
      expect(xml).toContain("Message=");
      expect(xml).not.toContain("LogMessage.Message");
    });

    it("HttpClient emits Body as child-element per catalog", () => {
      const node = {
        kind: "activity" as const,
        template: "HttpClient",
        displayName: "Call API",
        properties: { Endpoint: "https://example.com", Method: "POST", Body: "payload" },
        outputVar: "str_Response",
      };
      const xml = resolveActivityTemplate(node, []);
      expect(xml).toContain("HttpClient");
      if (xml.includes("HttpClient.Body")) {
        expect(xml).toContain("InArgument");
      }
    });

    it("DeserializeJson emits JsonString as child-element per catalog", () => {
      const node = {
        kind: "activity" as const,
        template: "DeserializeJson",
        displayName: "Parse JSON",
        properties: { JsonString: "str_Input" },
        outputVar: "obj_Result",
      };
      const xml = resolveActivityTemplate(node, []);
      expect(xml).toContain("DeserializeJson");
      expect(xml).toContain("DeserializeJson.Result");
      expect(xml).toContain("OutArgument");
      if (xml.includes("DeserializeJson.JsonString")) {
        expect(xml).toContain("InArgument");
      }
    });

    it("GetCredential emits catalog-conformant XML with child-element properties", () => {
      const node = {
        kind: "activity" as const,
        template: "GetCredential",
        displayName: "Get Cred",
        properties: { AssetName: "MyCred", Username: "str_User", Password: "sec_Pass" },
      };
      const xml = resolveActivityTemplate(node, []);
      expect(xml).toContain("GetCredential");
      expect(xml).toContain("GetCredential.Username");
      expect(xml).toContain("GetCredential.Password");
      expect(xml).toContain("OutArgument");
    });

    it("GetAsset emits catalog-conformant XML", () => {
      const node = {
        kind: "activity" as const,
        template: "GetAsset",
        displayName: "Get Asset",
        properties: { AssetName: "MyAsset" },
        outputVar: "str_Value",
      };
      const xml = resolveActivityTemplate(node, []);
      expect(xml).toContain("GetAsset");
      expect(xml).toContain("GetAsset.AssetValue");
      expect(xml).toContain("OutArgument");
    });

    it("Assign emits catalog-conformant XML with child-element To and Value", () => {
      const node = {
        kind: "activity" as const,
        template: "Assign",
        displayName: "Set Variable",
        properties: { To: "str_Result", Value: '"Hello"' },
      };
      const xml = resolveActivityTemplate(node, [{ name: "str_Result", type: "String" }]);
      expect(xml).toContain("Assign");
      expect(xml).toContain("Assign.To");
      expect(xml).toContain("Assign.Value");
      expect(xml).toContain("OutArgument");
      expect(xml).toContain("InArgument");
    });
  });

  describe("CATALOG_STRUCTURAL_VIOLATION classification (Task 149)", () => {
    it("classifies CATALOG_STRUCTURAL_VIOLATION as blocking", () => {
      const mockResult = {
        passed: false,
        violations: [{
          category: "accuracy" as const,
          severity: "error" as const,
          check: "CATALOG_STRUCTURAL_VIOLATION",
          file: "Main.xaml",
          detail: 'Property "Body" on ui:HttpClient must be a child element, not an attribute',
        }],
        positiveEvidence: [],
        typeRepairs: [],
        completenessLevel: "functional" as const,
        summary: {
          blockedPatterns: 0,
          completenessErrors: 0,
          completenessWarnings: 0,
          accuracyErrors: 1,
          accuracyWarnings: 0,
          runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0,
          logicLocationWarnings: 0,
          totalErrors: 1,
          totalWarnings: 0,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("blocking");
    });

    it("CATALOG_STRUCTURAL_VIOLATION produces blocking files", () => {
      const mockResult = {
        passed: false,
        violations: [{
          category: "accuracy" as const,
          severity: "error" as const,
          check: "CATALOG_STRUCTURAL_VIOLATION",
          file: "Main.xaml",
          detail: 'Property "Body" must be a child element, not an attribute',
        }],
        positiveEvidence: [],
        typeRepairs: [],
        completenessLevel: "functional" as const,
        summary: {
          blockedPatterns: 0,
          completenessErrors: 0,
          completenessWarnings: 0,
          accuracyErrors: 1,
          accuracyWarnings: 0,
          runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0,
          logicLocationWarnings: 0,
          totalErrors: 1,
          totalWarnings: 0,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      const blockingFiles = getBlockingFiles(issues);
      expect(blockingFiles).toContain("Main.xaml");
    });

    it("non-structural CATALOG_VIOLATION remains warning severity", () => {
      const mockResult = {
        passed: true,
        violations: [{
          category: "accuracy" as const,
          severity: "warning" as const,
          check: "CATALOG_VIOLATION",
          file: "Main.xaml",
          detail: "Unrecognized attribute on SomeActivity",
        }],
        positiveEvidence: [],
        typeRepairs: [],
        completenessLevel: "functional" as const,
        summary: {
          blockedPatterns: 0,
          completenessErrors: 0,
          completenessWarnings: 0,
          accuracyErrors: 0,
          accuracyWarnings: 1,
          runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0,
          logicLocationWarnings: 0,
          totalErrors: 0,
          totalWarnings: 1,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
    });
  });

  describe("Catalog Validator - duplicate packageId", () => {
    it("produces a validation error with message matching 'duplicate packageId \"...\"'", () => {
      const bad = JSON.parse(readFileSync(catalogPath, "utf-8"));
      const dupPkg = { ...bad.packages[0] };
      bad.packages.push(dupPkg);
      const result = validateCatalog(bad);
      expect(result.valid).toBe(false);
      const dupError = result.errors.find(e => /duplicate packageId "/.test(e));
      expect(dupError).toBeDefined();
      expect(dupError).toContain(dupPkg.packageId);
    });
  });

  describe("SpecValidationReport catalogLoaded signal", () => {
    it("sets catalogLoaded=true when catalog is loaded", () => {
      expect(catalogService.isLoaded()).toBe(true);
      const minimalSpec = {
        processName: "Test",
        rootSequence: { displayName: "Main", children: [], variables: [] },
        variables: [],
      };
      const { report } = validateWorkflowSpec(minimalSpec as any);
      expect(report.catalogLoaded).toBe(true);
    });

    it("sets catalogLoaded=false when catalog cannot be loaded (both initial and retry fail)", () => {
      const { renameSync, existsSync: localExistsSync } = require("fs");
      const backupPath = catalogPath + ".__test_backup";
      let renamed = false;

      try {
        renameSync(catalogPath, backupPath);
        renamed = true;

        catalogService.load("/nonexistent/__bad_catalog.json");
        expect(catalogService.isLoaded()).toBe(false);

        const minimalSpec = {
          processName: "Test",
          rootSequence: { displayName: "Main", children: [], variables: [] },
          variables: [],
        };
        const { report } = validateWorkflowSpec(minimalSpec as any);
        expect(report.catalogLoaded).toBe(false);
      } finally {
        if (renamed) {
          renameSync(backupPath, catalogPath);
        }
        catalogService.load(catalogPath);
      }
    });

    it("sticky-false: merged report has catalogLoaded=false if any individual report is false", () => {
      const reportA: SpecValidationReport = {
        totalActivities: 5,
        validActivities: 5,
        unknownActivities: 0,
        strippedProperties: 0,
        excessiveStrippingCount: 0,
        enumCorrections: 0,
        missingRequiredFilled: 0,
        commentConversions: 0,
        issues: [],
        catalogLoaded: true,
      };
      const reportB: SpecValidationReport = {
        totalActivities: 0,
        validActivities: 0,
        unknownActivities: 0,
        strippedProperties: 0,
        excessiveStrippingCount: 0,
        enumCorrections: 0,
        missingRequiredFilled: 0,
        commentConversions: 0,
        issues: [],
        catalogLoaded: false,
      };

      const merged = { ...reportA };
      merged.totalActivities += reportB.totalActivities;
      merged.catalogLoaded = (merged.catalogLoaded ?? true) && (reportB.catalogLoaded ?? true);

      expect(merged.catalogLoaded).toBe(false);
    });
  });

  describe("Pre-emission gate cause-aware validation", () => {
    function simulatePreEmissionGate(report: SpecValidationReport, deferredXamlCount: number, enrichmentCount: number): { code: string; message: string } | null {
      if (report.totalActivities === 0 && deferredXamlCount > 0 && enrichmentCount > 0) {
        if (report.catalogLoaded === false) {
          const reason = report.catalogLoadError || "unknown catalog load failure";
          return {
            code: "CATALOG_INTEGRITY_FAILURE",
            message: `[Pre-Emission Spec Validation] BLOCKED: catalog integrity failure (${reason}) — spec validation was blind, cannot certify build health`,
          };
        }
        return {
          code: "PRE_EMISSION_ZERO_COVERAGE",
          message: `[Pre-Emission Spec Validation] BLOCKED: validation ran but covered 0 activities across ${deferredXamlCount} XAML file(s) — cannot certify build health`,
        };
      }
      return null;
    }

    it("CATALOG_INTEGRITY_FAILURE: duplicate packageId in catalog triggers distinct cause code with reason", () => {
      const bad = JSON.parse(readFileSync(catalogPath, "utf-8"));
      const dupPkgId = bad.packages[0].packageId;
      bad.packages.push({ ...bad.packages[0] });
      const validation = validateCatalog(bad);
      expect(validation.valid).toBe(false);
      const dupError = validation.errors.find(e => /duplicate packageId "/.test(e));
      expect(dupError).toBeDefined();

      const catalogLoadError = `validation rejected: ${validation.errors.join("; ")}`;

      const report: SpecValidationReport = {
        totalActivities: 0,
        validActivities: 0,
        unknownActivities: 0,
        strippedProperties: 0,
        excessiveStrippingCount: 0,
        enumCorrections: 0,
        missingRequiredFilled: 0,
        commentConversions: 0,
        issues: [],
        catalogLoaded: false,
        catalogLoadError,
      };

      const result = simulatePreEmissionGate(report, 3, 2);
      expect(result).not.toBeNull();
      expect(result!.code).toBe("CATALOG_INTEGRITY_FAILURE");
      expect(result!.message).toContain("catalog integrity failure");
      expect(result!.message).toContain("duplicate packageId");
      expect(result!.message).toContain(dupPkgId);
    });

    it("PRE_EMISSION_ZERO_COVERAGE: healthy catalog with empty specs still uses existing cause code", () => {
      expect(catalogService.isLoaded()).toBe(true);

      const report: SpecValidationReport = {
        totalActivities: 0,
        validActivities: 0,
        unknownActivities: 0,
        strippedProperties: 0,
        excessiveStrippingCount: 0,
        enumCorrections: 0,
        missingRequiredFilled: 0,
        commentConversions: 0,
        issues: [],
        catalogLoaded: true,
        catalogLoadError: null,
      };

      const result = simulatePreEmissionGate(report, 3, 2);
      expect(result).not.toBeNull();
      expect(result!.code).toBe("PRE_EMISSION_ZERO_COVERAGE");
      expect(result!.message).not.toContain("CATALOG_INTEGRITY_FAILURE");
      expect(result!.message).not.toContain("catalog integrity failure");
    });

    it("no gate triggered when totalActivities > 0", () => {
      const report: SpecValidationReport = {
        totalActivities: 5,
        validActivities: 5,
        unknownActivities: 0,
        strippedProperties: 0,
        excessiveStrippingCount: 0,
        enumCorrections: 0,
        missingRequiredFilled: 0,
        commentConversions: 0,
        issues: [],
        catalogLoaded: true,
        catalogLoadError: null,
      };

      const result = simulatePreEmissionGate(report, 3, 2);
      expect(result).toBeNull();
    });

    it("end-to-end: duplicate packageId catalog load produces report with catalogLoaded=false and error reason", () => {
      const { writeFileSync, unlinkSync, renameSync } = require("fs");
      const bad = JSON.parse(readFileSync(catalogPath, "utf-8"));
      const dupPkgId = bad.packages[0].packageId;
      bad.packages.push({ ...bad.packages[0] });

      const backupPath = catalogPath + ".__test_e2e_backup";
      let swapped = false;

      try {
        renameSync(catalogPath, backupPath);
        writeFileSync(catalogPath, JSON.stringify(bad));
        swapped = true;

        catalogService.load(catalogPath);
        expect(catalogService.isLoaded()).toBe(false);

        const minimalSpec = {
          processName: "Test",
          rootSequence: { displayName: "Main", children: [], variables: [] },
          variables: [],
        };
        const { report } = validateWorkflowSpec(minimalSpec as any);
        expect(report.catalogLoaded).toBe(false);
        expect(report.catalogLoadError).toContain("duplicate packageId");
        expect(report.catalogLoadError).toContain(dupPkgId);

        const gateResult = simulatePreEmissionGate(report, 2, 1);
        expect(gateResult).not.toBeNull();
        expect(gateResult!.code).toBe("CATALOG_INTEGRITY_FAILURE");
        expect(gateResult!.message).toContain("duplicate packageId");
      } finally {
        if (swapped) {
          unlinkSync(catalogPath);
          renameSync(backupPath, catalogPath);
        }
        catalogService.load(catalogPath);
      }
    });
  });

  describe("CatalogService lastLoadError", () => {
    it("captures error when catalog validation fails due to duplicate packageId", () => {
      const bad = JSON.parse(readFileSync(catalogPath, "utf-8"));
      bad.packages.push({ ...bad.packages[0] });

      const tmpPath = join(process.cwd(), "catalog", "__test_dup_catalog.json");
      const { writeFileSync, unlinkSync } = require("fs");
      try {
        writeFileSync(tmpPath, JSON.stringify(bad));
        catalogService.load(tmpPath);
        expect(catalogService.isLoaded()).toBe(false);
        const lastError = catalogService.getLastLoadError();
        expect(lastError).not.toBeNull();
        expect(lastError).toContain("validation rejected");
        expect(lastError).toContain("duplicate packageId");
      } finally {
        try { unlinkSync(tmpPath); } catch {}
        catalogService.load(catalogPath);
      }
    });

    it("captures error when catalog file is not found", () => {
      try {
        catalogService.load("/nonexistent/path/catalog.json");
        expect(catalogService.isLoaded()).toBe(false);
        const lastError = catalogService.getLastLoadError();
        expect(lastError).not.toBeNull();
        expect(lastError).toContain("file not found");
      } finally {
        catalogService.load(catalogPath);
      }
    });

    it("clears lastLoadError on successful load", () => {
      catalogService.load(catalogPath);
      expect(catalogService.isLoaded()).toBe(true);
      expect(catalogService.getLastLoadError()).toBeNull();
    });
  });
});
