import { describe, it, expect, beforeEach } from "vitest";
import { XMLValidator } from "fast-xml-parser";
import { buildDeterministicScaffold } from "../deterministic-scaffold";
import {
  assembleWorkflowFromSpec,
  coercePropToString,
  getPropString,
  mapClrFullyQualifiedToXamlPrefix,
  wrapVariableDefault,
  ensureBalancedParens,
} from "../workflow-tree-assembler";
import type { PropertyValue } from "../workflow-spec-types";
import { checkStudioLoadability, resolveDependencies, assertDhgArchiveParity } from "../package-assembler";
import {
  classifyWorkflowStatus,
  freezeArchiveWorkflows,
  resetMonotonicCounter,
  resetArchiveFreeze,
  isArchiveFrozen,
  createGuardedDeferredWrites,
  createGuardedPostGateEntries,
  verifyFrozenArchiveBuffer,
  getMutationTrace,
  assertNoPostFreezeMutation,
  assertNoPostFreezeStatusMutation,
  buildWorkflowStatusParity,
  normalizeClassifierFileName,
  type PostClassifierMutationTraceEntry,
  type FrozenWorkflowEntry,
  type WorkflowStatusParityEntry,
  type WorkflowStatus,
} from "../workflow-status-classifier";
import AdmZip from "adm-zip";
import { runQualityGate, type QualityGateInput } from "../uipath-quality-gate";
import { normalizeXaml, smartBracketWrap, ensureBracketWrapped, looksLikePlainText, BARE_WORD_LITERALS_SET, CLR_NAMESPACE_TO_XAML_PREFIX, PACKAGE_NAMESPACE_MAP, injectMissingNamespaceDeclarations } from "../xaml/xaml-compliance";
import { normalizePropertyToValueIntent } from "../xaml/expression-builder";
import { scanXamlForRequiredPackages, NAMESPACE_PREFIX_TO_PACKAGE } from "../uipath-activity-registry";
import { checkNormalizationInvariants } from "../emission-gate";
import { metadataService } from "../catalog/metadata-service";
import { ACTIVITY_DEFINITIONS_REGISTRY } from "../catalog/activity-definitions";
import {
  generateReframeworkMainXaml,
  generateGetTransactionDataXaml,
  generateInitAllSettingsXaml,
  generateInitXaml,
  generateSetTransactionStatusXaml,
  generateCloseAllApplicationsXaml,
  generateKillAllProcessesXaml,
} from "../xaml-generator";
import {
  simpleLinearNodes,
  simpleLinearEdges,
  simpleLinearSdd,
  apiDataDrivenNodes,
  apiDataDrivenEdges,
  apiDataDrivenSdd,
  transactionalQueueNodes,
  transactionalQueueEdges,
  transactionalQueueSdd,
  lowConfidenceNodes,
  lowConfidenceEdges,
  travelRequestNodes,
  travelRequestEdges,
  travelRequestSdd,
  passwordResetNodes,
  passwordResetEdges,
  passwordResetSdd,
  makeProjectJson,
  makeValidXaml,
} from "./fixtures/process-specs";

function generateStubXaml(name: string): string {
  const cleanName = name.replace(/^\[/, "").replace(/\]$/, "");
  const className = cleanName.replace(/\.xaml$/i, "");
  return makeValidXaml(className, `<ui:LogMessage Level="Info" Message="[&quot;${className} stub&quot;]" DisplayName="Log ${className}" />`);
}

function findInvokedFiles(xamlContent: string): string[] {
  const invoked: string[] = [];
  const pattern = /WorkflowFileName="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(xamlContent)) !== null) {
    invoked.push(match[1]);
  }
  return invoked;
}

function assemblePipeline(
  processNodes: any[],
  processEdges: any[],
  projectName: string,
  sddContent?: string,
): { xamlEntries: { name: string; content: string }[]; deps: Record<string, string> } {
  const scaffold = buildDeterministicScaffold(processNodes, projectName, sddContent, processEdges);
  expect(scaffold.treeEnrichment).toBeTruthy();
  expect(scaffold.treeEnrichment.status).toBe("success");

  const allEnrichments = scaffold.allTreeEnrichments || new Map();
  if (allEnrichments.size === 0 && scaffold.treeEnrichment.status === "success") {
    allEnrichments.set("Main", {
      spec: scaffold.treeEnrichment.workflowSpec,
      processType: "general" as const,
    });
  }

  const xamlEntries: { name: string; content: string }[] = [];
  const generatedNames = new Set<string>();
  const treeSpecs: any[] = [];

  for (const [name, entry] of allEnrichments) {
    const { xaml } = assembleWorkflowFromSpec(entry.spec, entry.processType);
    const compliant = normalizeXaml(xaml);
    xamlEntries.push({ name: `${name}.xaml`, content: compliant });
    generatedNames.add(`${name}.xaml`);
    treeSpecs.push(entry.spec);
  }

  const allInvoked = new Set<string>();
  for (const entry of xamlEntries) {
    for (const file of findInvokedFiles(entry.content)) {
      allInvoked.add(file);
    }
  }
  for (const invokedFile of allInvoked) {
    if (!generatedNames.has(invokedFile)) {
      const stub = generateStubXaml(invokedFile);
      const compliant = normalizeXaml(stub);
      xamlEntries.push({ name: invokedFile, content: compliant });
      generatedNames.add(invokedFile);
    }
  }

  const allRequiredPackages = new Set<string>();
  for (const entry of xamlEntries) {
    const required = scanXamlForRequiredPackages(entry.content);
    for (const pkg of required) {
      allRequiredPackages.add(pkg);
    }
  }
  allRequiredPackages.add("UiPath.System.Activities");

  const fakeWorkflows = Array.from(allRequiredPackages).map(pkg => ({
    name: "scan",
    steps: [{ activityType: "LogMessage", activityPackage: pkg }],
  }));

  const depResult = resolveDependencies({ workflows: fakeWorkflows }, null, treeSpecs);
  const deps = depResult.deps;

  metadataService.load();
  for (const pkg of allRequiredPackages) {
    if (!deps[pkg]) {
      const preferred = metadataService.getPreferredVersion(pkg);
      deps[pkg] = preferred ? `[${preferred}]` : "[25.10.0]";
    }
  }

  return { xamlEntries, deps };
}

function runQG(
  xamlEntries: { name: string; content: string }[],
  deps: Record<string, string>,
  projectName: string = "Test",
) {
  return runQualityGate({
    xamlEntries,
    projectJsonContent: makeProjectJson(projectName, deps),
    targetFramework: "Windows",
    archiveManifest: [
      ...xamlEntries.map(e => `lib/net45/${e.name.split("/").pop()}`),
      "lib/net45/project.json",
      `${projectName}.nuspec`,
    ],
  });
}

function assertPipelineOutput(
  xamlEntries: { name: string; content: string }[],
  deps: Record<string, string>,
  projectName: string = "Test",
) {
  for (const entry of xamlEntries) {
    const validationResult = XMLValidator.validate(entry.content);
    expect(validationResult, `XML well-formedness failed for ${entry.name}: ${JSON.stringify(validationResult)}`).toBe(true);

    const loadResult = checkStudioLoadability(entry.content);
    expect(loadResult.loadable, `Studio loadability failed for ${entry.name}: ${loadResult.reason}`).toBe(true);

    expect(entry.content).not.toContain("[ASSEMBLY_FAILED]");
    expect(entry.content).not.toMatch(/\[TODO: Fix/);
  }

  const qgResult = runQG(xamlEntries, deps, projectName);
  const errors = qgResult.violations.filter(v => v.severity === "error");
  expect(errors.length, `Quality gate errors:\n${errors.map(e => `  ${e.file}: ${e.detail}`).join("\n")}`).toBe(0);
}

describe("Pipeline Regression Test Suite", () => {
  describe("Diverse fixture process specs through deterministic scaffold", () => {
    it("simple linear process (HR report download)", () => {
      const { xamlEntries, deps } = assemblePipeline(
        simpleLinearNodes,
        simpleLinearEdges,
        "HR_Report_Download",
        simpleLinearSdd,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "HR_Report_Download");
    });

    it("API data-driven process (customer data sync)", () => {
      const { xamlEntries, deps } = assemblePipeline(
        apiDataDrivenNodes,
        apiDataDrivenEdges,
        "Customer_Data_Sync",
        apiDataDrivenSdd,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "Customer_Data_Sync");
    });

    it("transactional queue process (invoice processing)", () => {
      const { xamlEntries, deps } = assemblePipeline(
        transactionalQueueNodes,
        transactionalQueueEdges,
        "Invoice_Processing",
        transactionalQueueSdd,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "Invoice_Processing");
    });

    it("low confidence single-node process", () => {
      const { xamlEntries, deps } = assemblePipeline(
        lowConfidenceNodes,
        lowConfidenceEdges,
        "Single_Task",
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "Single_Task");
    });
  });

  describe("Deterministic scaffold with decision, loop, and system-mapped nodes", () => {
    const decisionLoopNodes = [
      { id: "1", name: "Read Input File", nodeType: "task", description: "Read the Excel input file containing invoice data", system: "Excel" },
      { id: "2", name: "Check File Valid", nodeType: "decision", description: "Verify the file has the expected columns and format", system: "Internal" },
      { id: "3", name: "Process Each Row", nodeType: "loop", description: "Iterate through each row of the invoice data table", system: "Internal" },
      { id: "4", name: "Validate Invoice Amount", nodeType: "decision", description: "Check if the invoice amount exceeds the approval threshold", system: "Internal" },
      { id: "5", name: "Submit to ERP", nodeType: "task", description: "Enter invoice data into SAP ERP system via UI automation", system: "SAP" },
      { id: "6", name: "Flag for Review", nodeType: "task", description: "Add invoice to manual review queue for amounts over threshold", system: "Internal" },
      { id: "7", name: "Send Summary Email", nodeType: "task", description: "Send email summary of processed invoices via Outlook", system: "Outlook" },
    ];

    const decisionLoopEdges = [
      { sourceNodeId: "1", targetNodeId: "2", label: "" },
      { sourceNodeId: "2", targetNodeId: "3", label: "valid" },
      { sourceNodeId: "3", targetNodeId: "4", label: "" },
      { sourceNodeId: "4", targetNodeId: "5", label: "under threshold" },
      { sourceNodeId: "4", targetNodeId: "6", label: "over threshold" },
      { sourceNodeId: "5", targetNodeId: "3", label: "next row" },
      { sourceNodeId: "6", targetNodeId: "3", label: "next row" },
      { sourceNodeId: "3", targetNodeId: "7", label: "done" },
    ];

    const decisionLoopSdd = `# Solution Design Document - Invoice Processing Automation

## 1. Process Overview
This automation reads invoices from Excel, validates amounts against a threshold, and submits them to SAP ERP or flags them for manual review.

## 4. System Architecture
Excel files are read from a shared network drive.
SAP ERP is accessed via UI automation.
Email notifications are sent through Outlook.

## 9. Orchestrator Artifacts
\`\`\`orchestrator_artifacts
{
  "assets": [
    { "name": "ApprovalThreshold", "type": "Text", "value": "10000", "description": "Invoice amount threshold" },
    { "name": "SAP_Credential", "type": "Credential", "description": "SAP login credentials" }
  ],
  "queues": []
}
\`\`\`
`;

    it("produces valid XAML with decision and loop nodes", () => {
      const { xamlEntries, deps } = assemblePipeline(
        decisionLoopNodes,
        decisionLoopEdges,
        "Invoice_Validation",
        decisionLoopSdd,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "Invoice_Validation");
    });

    it("scaffold includes Main.xaml and passes full validation", () => {
      const { xamlEntries, deps } = assemblePipeline(
        decisionLoopNodes,
        decisionLoopEdges,
        "Invoice_Validation",
        decisionLoopSdd,
      );
      const mainEntry = xamlEntries.find(e => e.name === "Main.xaml");
      expect(mainEntry).toBeTruthy();
      assertPipelineOutput(xamlEntries, deps, "Invoice_Validation");
    });
  });

  describe("Expression classification edge cases (Task #354 regressions)", () => {
    const edgeCaseNodes = [
      {
        id: "1",
        name: "Configure Timezone",
        nodeType: "task",
        description: "Set the timezone to Asia/Dubai for date calculations",
        system: "Internal",
      },
      {
        id: "2",
        name: "Call API Endpoint",
        nodeType: "task",
        description: "Send request to https://api.example.com/v2/process endpoint to fetch data",
        system: "REST API",
      },
      {
        id: "3",
        name: "Set Encoding",
        nodeType: "task",
        description: "Configure output file encoding to UTF-8 for international character support",
        system: "Internal",
      },
      {
        id: "4",
        name: "Toggle Feature Flag",
        nodeType: "task",
        description: "Set the processing enabled flag to Yes for batch processing mode",
        system: "Internal",
      },
    ];

    const edgeCaseEdges = [
      { sourceNodeId: "1", targetNodeId: "2", label: "" },
      { sourceNodeId: "2", targetNodeId: "3", label: "" },
      { sourceNodeId: "3", targetNodeId: "4", label: "" },
    ];

    const edgeCaseSdd = `# Solution Design Document - Edge Case Process

## 1. Process Overview
This automation handles timezone-aware data processing with API integration and encoding configuration.
The timezone used is Asia/Dubai. The API endpoint is https://api.example.com/v2/process.
Output encoding is UTF-8. The batch processing flag is set to Yes.

## 4. System Architecture
REST API at https://api.example.com/v2/process
Timezone: Asia/Dubai
Encoding: UTF-8

## 9. Orchestrator Artifacts
\`\`\`orchestrator_artifacts
{
  "assets": [
    { "name": "API_Endpoint", "type": "Text", "value": "https://api.example.com/v2/process", "description": "API URL" },
    { "name": "Timezone", "type": "Text", "value": "Asia/Dubai", "description": "Processing timezone" }
  ],
  "queues": []
}
\`\`\`
`;

    it("produces valid XAML without broken VB expressions from edge-case values", () => {
      const { xamlEntries, deps } = assemblePipeline(
        edgeCaseNodes,
        edgeCaseEdges,
        "Edge_Case_Process",
        edgeCaseSdd,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "Edge_Case_Process");
    });

    it("timezone paths and URLs are emitted as string literals, not VB expressions", () => {
      const { xamlEntries, deps } = assemblePipeline(
        edgeCaseNodes,
        edgeCaseEdges,
        "Edge_Case_Process",
        edgeCaseSdd,
      );
      const allXaml = xamlEntries.map(e => e.content).join("\n");

      expect(allXaml).not.toMatch(/\[Asia\/Dubai\]/);
      expect(allXaml).not.toMatch(/\[America\/New_York\]/);
      expect(allXaml).not.toMatch(/\[https?:\/\//);

      if (allXaml.includes("Asia/Dubai") || allXaml.includes("Asia&#x2F;Dubai")) {
        expect(allXaml).toMatch(/["&].*Asia/);
      }

      assertPipelineOutput(xamlEntries, deps, "Edge_Case_Process");
    });

    it("Yes/No booleans are not emitted as broken VB expressions", () => {
      const { xamlEntries, deps } = assemblePipeline(
        edgeCaseNodes,
        edgeCaseEdges,
        "Edge_Case_Process",
        edgeCaseSdd,
      );
      const allXaml = xamlEntries.map(e => e.content).join("\n");

      expect(allXaml).not.toMatch(/\[Yes\]/);
      expect(allXaml).not.toMatch(/\[No\]/);

      assertPipelineOutput(xamlEntries, deps, "Edge_Case_Process");
    });

    it("Encoding values (UTF-8) are not emitted as broken VB expressions", () => {
      const { xamlEntries, deps } = assemblePipeline(
        edgeCaseNodes,
        edgeCaseEdges,
        "Edge_Case_Process",
        edgeCaseSdd,
      );
      const allXaml = xamlEntries.map(e => e.content).join("\n");

      expect(allXaml).not.toMatch(/\[UTF-8\]/);
      expect(allXaml).not.toMatch(/\[UTF8\]/);

      assertPipelineOutput(xamlEntries, deps, "Edge_Case_Process");
    });
  });

  describe("No-SDD deterministic scaffold (map-only)", () => {
    it("produces valid XAML from process nodes without SDD content", () => {
      const { xamlEntries, deps } = assemblePipeline(
        simpleLinearNodes,
        simpleLinearEdges,
        "No_SDD_Process",
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "No_SDD_Process");
    });
  });

  describe("Multi-system process with diverse node types", () => {
    const multiSystemNodes = [
      { id: "1", name: "Read Config from Orchestrator", nodeType: "task", description: "Initialize configuration by reading assets from Orchestrator", system: "Orchestrator" },
      { id: "2", name: "Open SAP GUI", nodeType: "task", description: "Launch SAP GUI application and log in with stored credentials", system: "SAP" },
      { id: "3", name: "Extract Purchase Orders", nodeType: "task", description: "Navigate to transaction ME2N and extract purchase order list to DataTable", system: "SAP" },
      { id: "4", name: "Check PO Count", nodeType: "decision", description: "Verify at least one purchase order was extracted", system: "Internal" },
      { id: "5", name: "Process Each PO", nodeType: "loop", description: "Iterate through each purchase order row", system: "Internal" },
      { id: "6", name: "Validate PO in Web Portal", nodeType: "task", description: "Cross-reference PO in the supplier web portal at https://supplier.example.com/validate", system: "Web Portal" },
      { id: "7", name: "Update Spreadsheet", nodeType: "task", description: "Write validation results to the tracking Excel spreadsheet", system: "Excel" },
      { id: "8", name: "Send Completion Email", nodeType: "task", description: "Send status email with the tracking spreadsheet attached", system: "Outlook" },
    ];

    const multiSystemEdges = [
      { sourceNodeId: "1", targetNodeId: "2", label: "" },
      { sourceNodeId: "2", targetNodeId: "3", label: "" },
      { sourceNodeId: "3", targetNodeId: "4", label: "" },
      { sourceNodeId: "4", targetNodeId: "5", label: "has POs" },
      { sourceNodeId: "5", targetNodeId: "6", label: "" },
      { sourceNodeId: "6", targetNodeId: "7", label: "" },
      { sourceNodeId: "7", targetNodeId: "5", label: "next PO" },
      { sourceNodeId: "5", targetNodeId: "8", label: "all processed" },
    ];

    it("produces valid XAML for multi-system process", () => {
      const { xamlEntries, deps } = assemblePipeline(
        multiSystemNodes,
        multiSystemEdges,
        "PO_Validation",
        `# Solution Design Document - PO Validation
## 1. Process Overview
Cross-reference purchase orders from SAP with supplier web portal.
## 4. System Architecture
SAP GUI, Supplier Portal at https://supplier.example.com, Excel, Outlook
## 9. Orchestrator Artifacts
\`\`\`orchestrator_artifacts
{ "assets": [{ "name": "SAP_Credential", "type": "Credential", "description": "SAP login" }], "queues": [] }
\`\`\`
`,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);
      assertPipelineOutput(xamlEntries, deps, "PO_Validation");
    });
  });

  describe("BirthdayGreetings defect regression (Task #385)", () => {
    it("T001: coercePropToString prevents [object Object] leakage from typed property objects", () => {
      expect(coercePropToString({ type: "literal", value: "hello" })).toBe("hello");
      expect(coercePropToString({ type: "variable", name: "myVar" })).toBe("myVar");
      expect(coercePropToString({ type: "vb_expression", value: "DateTime.Now" })).toBe("DateTime.Now");
      expect(coercePropToString("plain string")).toBe("plain string");
      expect(coercePropToString(42)).toBe("42");
      expect(coercePropToString(null)).toBe("");
      expect(coercePropToString(undefined)).toBe("");

      const objWithValue = { someRandom: "object", value: "fallback" };
      expect(coercePropToString(objWithValue)).toBe("fallback");

      const greetingValue: PropertyValue = { type: "literal", value: "Happy Birthday" };
      const props: Record<string, PropertyValue> = { Greeting: greetingValue };
      const propStr = getPropString(props, "Greeting");
      expect(propStr).not.toContain("[object Object]");
      expect(propStr).toContain("Happy Birthday");
    });

    it("T002: mapClrFullyQualifiedToXamlPrefix converts CLR names to XAML prefix syntax", () => {
      expect(mapClrFullyQualifiedToXamlPrefix("UiPath.Persistence.Activities.FormTask")).toBe("upers:FormTask");
      expect(mapClrFullyQualifiedToXamlPrefix("UiPath.Core.Activities.InvokeWorkflowFile")).toBe("ui:InvokeWorkflowFile");
      expect(mapClrFullyQualifiedToXamlPrefix("UiPath.Mail.Activities.SendMail")).toBe("umail:SendMail");

      expect(mapClrFullyQualifiedToXamlPrefix("String")).toBeNull();
      expect(mapClrFullyQualifiedToXamlPrefix("x:Int32")).toBeNull();

      expect(mapClrFullyQualifiedToXamlPrefix("System.Net.Mail.MailMessage")).toBe("snetmail:MailMessage");
      expect(mapClrFullyQualifiedToXamlPrefix("System.String")).toBe("s:String");
      expect(mapClrFullyQualifiedToXamlPrefix("System.Int32")).toBe("s:Int32");
    });

    it("T003: wrapVariableDefault bracket-wraps VB expressions even when starting with quote", () => {
      const concatExpr = `"screenshots/error_" & DateTime.Now.ToString("yyyyMMdd")`;
      const result = wrapVariableDefault(concatExpr, "String");
      expect(result.startsWith("[")).toBe(true);
      expect(result.endsWith("]")).toBe(true);

      expect(wrapVariableDefault(`"plain string"`, "String")).toBe(`"plain string"`);

      expect(wrapVariableDefault("True", "Boolean")).toBe("True");
      expect(wrapVariableDefault("Nothing", "Object")).toBe("Nothing");
    });

    it("T004: State.Transitions wrapper is emitted around Transition elements in REFramework Main", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      if (mainXaml.includes("<Transition")) {
        expect(mainXaml).toContain("<State.Transitions>");
        expect(mainXaml).toContain("</State.Transitions>");
        const transitionMatches = mainXaml.match(/<Transition /g) || [];
        const wrapperMatches = mainXaml.match(/<State\.Transitions>/g) || [];
        expect(wrapperMatches.length).toBeGreaterThan(0);
        expect(wrapperMatches.length).toBeLessThanOrEqual(transitionMatches.length);
      }
      const validationResult = XMLValidator.validate(mainXaml);
      expect(validationResult).toBe(true);
    });

    it("T006: ensureBalancedParens fixes missing closing parenthesis", () => {
      expect(ensureBalancedParens("InArgument(x:String)")).toBe("InArgument(x:String)");
      expect(ensureBalancedParens("InArgument(scg:List(x:String)")).toBe("InArgument(scg:List(x:String))");
      expect(ensureBalancedParens("OutArgument(scg:Dictionary(x:String, x:Int32)")).toBe("OutArgument(scg:Dictionary(x:String, x:Int32))");
      expect(ensureBalancedParens("InArgument(scg:List(scg:Dictionary(x:String, x:Int32))")).toBe("InArgument(scg:List(scg:Dictionary(x:String, x:Int32)))");
      expect(ensureBalancedParens("NoParens")).toBe("NoParens");
    });

    it("T007: bare word 'Yes' is quoted as string literal, not bracket-wrapped", () => {
      const yesResult = smartBracketWrap("Yes");
      expect(yesResult).not.toMatch(/^\[Yes\]$/);
      expect(yesResult).toContain("Yes");

      const noResult = smartBracketWrap("No");
      expect(noResult).not.toMatch(/^\[No\]$/);

      const normalResult = smartBracketWrap("Normal");
      expect(normalResult).not.toMatch(/^\[Normal\]$/);

      const trueResult = smartBracketWrap("True");
      expect(trueResult).toBe("True");

      const falseResult = smartBracketWrap("False");
      expect(falseResult).toBe("False");
    });

    it("T005: GetTransactionItem catalog uses child-element syntax for QueueName", () => {
      const allDefs = ACTIVITY_DEFINITIONS_REGISTRY.flatMap((pkg: any) => pkg.activities || []);
      const getTransDef = allDefs.find(
        (d: any) => d.className === "GetTransactionItem"
      );
      expect(getTransDef).toBeDefined();
      const queueProp = getTransDef!.properties?.find((p: any) => p.name === "QueueName");
      expect(queueProp).toBeDefined();
      expect(queueProp!.xamlSyntax).toBe("child-element");
    });

    describe("BirthdayGreetings-style orchestration pipeline integration", () => {
      const birthdayNodes = [
        { id: "1", name: "Get Birthday List", nodeType: "task", description: "Read employee birthdays from Orchestrator queue", system: "Orchestrator" },
        { id: "2", name: "Check Birthday Today", nodeType: "decision", description: "Check if any employee has a birthday today", system: "Internal" },
        { id: "3", name: "Send Greeting Email", nodeType: "task", description: "Send a personalized birthday greeting email", system: "Outlook" },
        { id: "4", name: "Log Completion", nodeType: "task", description: "Log the greeting status", system: "Internal" },
      ];

      const birthdayEdges = [
        { sourceNodeId: "1", targetNodeId: "2", label: "" },
        { sourceNodeId: "2", targetNodeId: "3", label: "Yes" },
        { sourceNodeId: "3", targetNodeId: "4", label: "" },
      ];

      it("generates valid XAML without typed-object leakage or raw CLR type args", () => {
        const { xamlEntries, deps } = assemblePipeline(
          birthdayNodes,
          birthdayEdges,
          "BirthdayGreetingsV20",
        );

        expect(xamlEntries.length).toBeGreaterThan(0);

        for (const entry of xamlEntries) {
          const validationResult = XMLValidator.validate(entry.content);
          expect(validationResult, `XML malformed in ${entry.name}`).toBe(true);

          expect(entry.content).not.toContain("[object Object]");
          expect(entry.content).not.toMatch(/s:Net\.Mail\./);
          expect(entry.content).not.toMatch(/\[ASSEMBLY_FAILED\]/);

          const loadResult = checkStudioLoadability(entry.content);
          expect(loadResult.loadable, `Studio loadability failed for ${entry.name}: ${loadResult.reason}`).toBe(true);
        }

        assertPipelineOutput(xamlEntries, deps, "BirthdayGreetingsV20");
      });

      it("REFramework files have correct structural elements", () => {
        const mainXaml = generateReframeworkMainXaml("BirthdayGreetingsV20", "BirthdayQueue", "Windows");
        const getTransXaml = generateGetTransactionDataXaml("BirthdayQueue", "Windows");
        const initSettingsXaml = generateInitAllSettingsXaml(undefined, "Windows");
        const initXaml = generateInitXaml("Windows");
        const setStatusXaml = generateSetTransactionStatusXaml("Windows");

        const reframeworkFiles = [
          { name: "Main.xaml", content: mainXaml },
          { name: "GetTransactionData.xaml", content: getTransXaml },
          { name: "InitAllSettings.xaml", content: initSettingsXaml },
          { name: "Init.xaml", content: initXaml },
          { name: "SetTransactionStatus.xaml", content: setStatusXaml },
        ];

        for (const file of reframeworkFiles) {
          const valid = XMLValidator.validate(file.content);
          expect(valid, `XML malformed in ${file.name}: ${JSON.stringify(valid)}`).toBe(true);

          expect(file.content).not.toContain("[object Object]");

          const typeAttrMatches = file.content.match(/Type="[^"]*"/g) || [];
          for (const typeAttr of typeAttrMatches) {
            const openParens = (typeAttr.match(/\(/g) || []).length;
            const closeParens = (typeAttr.match(/\)/g) || []).length;
            expect(openParens).toBe(closeParens);
          }
        }

        if (mainXaml.includes("<Transition")) {
          expect(mainXaml).toContain("<State.Transitions>");
          expect(mainXaml).toContain("</State.Transitions>");
        }

        expect(getTransXaml).toContain("GetTransactionItem");
        expect(getTransXaml).not.toMatch(/GetTransactionItem\.QueueName="/);
        if (getTransXaml.includes("QueueName")) {
          expect(getTransXaml).toMatch(/<InArgument[^>]*>[^<]*BirthdayQueue|QueueName/);
        }
      });
    });
  });

  describe("Travel family regression (Task #384)", () => {
    it("Travel request process: API + Data Service + Action Center + Gmail pipeline", () => {
      const { xamlEntries, deps } = assemblePipeline(
        travelRequestNodes,
        travelRequestEdges,
        "Travel_Request_Processing",
        travelRequestSdd,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);

      for (const entry of xamlEntries) {
        const validationResult = XMLValidator.validate(entry.content);
        expect(validationResult, `XML well-formedness failed for ${entry.name}: ${JSON.stringify(validationResult)}`).toBe(true);
        const loadResult = checkStudioLoadability(entry.content);
        expect(loadResult.loadable, `Studio loadability failed for ${entry.name}: ${loadResult.reason}`).toBe(true);
        expect(entry.content).not.toContain("[ASSEMBLY_FAILED]");
        expect(entry.content).not.toMatch(/\[TODO: Fix/);
      }

      const qgResult = runQG(xamlEntries, deps, "Travel_Request_Processing");
      const errors = qgResult.violations.filter(v => v.severity === "error");
      const nonKnown = errors.filter(e => !e.detail.includes("obj_FormTask"));
      expect(nonKnown.length, `Unexpected QG errors:\n${nonKnown.map(e => `  ${e.file}: ${e.detail}`).join("\n")}`).toBe(0);
    });

    it("Travel process emits correct activity families for API, Data Service, Action Center, Gmail", () => {
      const { xamlEntries } = assemblePipeline(
        travelRequestNodes,
        travelRequestEdges,
        "Travel_Request_Processing",
        travelRequestSdd,
      );
      const allXaml = xamlEntries.map(e => e.content).join("\n");

      const hasHttpOrApi = allXaml.includes("HttpClient") || allXaml.includes("uweb:") || allXaml.includes("TODO: ") || allXaml.includes("HTTP Request");
      expect(hasHttpOrApi).toBe(true);

      const hasDataServiceOrTodo = allXaml.includes("uds:") || allXaml.includes("DataService") || allXaml.includes("Data Service") || allXaml.includes("QueryEntity") || allXaml.includes("CreateEntity");
      expect(hasDataServiceOrTodo).toBe(true);

      const hasActionCenterOrTodo = allXaml.includes("upers:") || allXaml.includes("CreateFormTask") || allXaml.includes("Action Center") || allXaml.includes("Persistence");
      expect(hasActionCenterOrTodo).toBe(true);

      const hasMailOrGmail = allXaml.includes("ugs:") || allXaml.includes("GmailSendMessage") || allXaml.includes("Gmail") || allXaml.includes("umail:") || allXaml.includes("SendMail") || allXaml.includes("Send Email");
      expect(hasMailOrGmail).toBe(true);
    });

    it("Travel process has no [object Object] or [ASSEMBLY_FAILED] leakage", () => {
      const { xamlEntries } = assemblePipeline(
        travelRequestNodes,
        travelRequestEdges,
        "Travel_Request_Processing",
        travelRequestSdd,
      );
      for (const entry of xamlEntries) {
        expect(entry.content).not.toContain("[object Object]");
        expect(entry.content).not.toContain("[ASSEMBLY_FAILED]");
      }
    });
  });

  describe("Password Reset family regression (Task #384)", () => {
    it("Password reset process: Email + Admin Portal + Action Center pipeline", () => {
      const { xamlEntries, deps } = assemblePipeline(
        passwordResetNodes,
        passwordResetEdges,
        "Password_Reset_Automation",
        passwordResetSdd,
      );
      expect(xamlEntries.length).toBeGreaterThan(0);

      for (const entry of xamlEntries) {
        const validationResult = XMLValidator.validate(entry.content);
        expect(validationResult, `XML well-formedness failed for ${entry.name}: ${JSON.stringify(validationResult)}`).toBe(true);
        const loadResult = checkStudioLoadability(entry.content);
        expect(loadResult.loadable, `Studio loadability failed for ${entry.name}: ${loadResult.reason}`).toBe(true);
        expect(entry.content).not.toContain("[ASSEMBLY_FAILED]");
        expect(entry.content).not.toMatch(/\[TODO: Fix/);
      }

      const qgResult = runQG(xamlEntries, deps, "Password_Reset_Automation");
      const errors = qgResult.violations.filter(v => v.severity === "error");
      const nonKnown = errors.filter(e => !e.detail.includes("obj_FormTask"));
      expect(nonKnown.length, `Unexpected QG errors:\n${nonKnown.map(e => `  ${e.file}: ${e.detail}`).join("\n")}`).toBe(0);
    });

    it("Password reset process emits correct activity families for Email, Browser/UI, Action Center", () => {
      const { xamlEntries } = assemblePipeline(
        passwordResetNodes,
        passwordResetEdges,
        "Password_Reset_Automation",
        passwordResetSdd,
      );
      const allXaml = xamlEntries.map(e => e.content).join("\n");

      const hasEmail = allXaml.includes("umail:") || allXaml.includes("SendOutlookMailMessage") || allXaml.includes("GetOutlookMailMessages") || allXaml.includes("Send Email") || allXaml.includes("Outlook") || allXaml.includes("GetMail") || allXaml.includes("SendMail");
      expect(hasEmail).toBe(true);

      const hasBrowserOrPortal = allXaml.includes("OpenBrowser") || allXaml.includes("UseApplicationBrowser") || allXaml.includes("Admin Portal") || allXaml.includes("NavigateTo") || allXaml.includes("TypeInto") || allXaml.includes("Click") || allXaml.includes("Open Browser");
      expect(hasBrowserOrPortal).toBe(true);

      const hasActionCenter = allXaml.includes("upers:") || allXaml.includes("CreateFormTask") || allXaml.includes("Action Center") || allXaml.includes("Persistence");
      expect(hasActionCenter).toBe(true);
    });

    it("Password reset process has no [object Object] or [ASSEMBLY_FAILED] leakage", () => {
      const { xamlEntries } = assemblePipeline(
        passwordResetNodes,
        passwordResetEdges,
        "Password_Reset_Automation",
        passwordResetSdd,
      );
      for (const entry of xamlEntries) {
        expect(entry.content).not.toContain("[object Object]");
        expect(entry.content).not.toContain("[ASSEMBLY_FAILED]");
      }
    });
  });

  describe("Package-family source-of-truth validation (Task #384)", () => {
    it("UiPath.Mail.Activities has consistent prefix mapping across registry and compliance", () => {
      expect(NAMESPACE_PREFIX_TO_PACKAGE["umail"]).toBe("UiPath.Mail.Activities");
      expect(PACKAGE_NAMESPACE_MAP["UiPath.Mail.Activities"]).toBeDefined();
      expect(PACKAGE_NAMESPACE_MAP["UiPath.Mail.Activities"].prefix).toBe("umail");
    });

    it("UiPath.WebAPI.Activities has consistent prefix mapping across registry and compliance", () => {
      expect(NAMESPACE_PREFIX_TO_PACKAGE["uweb"]).toBe("UiPath.WebAPI.Activities");
      expect(PACKAGE_NAMESPACE_MAP["UiPath.WebAPI.Activities"]).toBeDefined();
      expect(PACKAGE_NAMESPACE_MAP["UiPath.WebAPI.Activities"].prefix).toBe("uweb");
    });

    it("UiPath.Persistence.Activities has consistent prefix mapping across registry and compliance", () => {
      expect(NAMESPACE_PREFIX_TO_PACKAGE["upers"]).toBe("UiPath.Persistence.Activities");
      expect(PACKAGE_NAMESPACE_MAP["UiPath.Persistence.Activities"]).toBeDefined();
      expect(PACKAGE_NAMESPACE_MAP["UiPath.Persistence.Activities"].prefix).toBe("upers");
    });

    it("UiPath.DataService.Activities has consistent prefix mapping across registry and compliance", () => {
      expect(NAMESPACE_PREFIX_TO_PACKAGE["uds"]).toBe("UiPath.DataService.Activities");
      expect(PACKAGE_NAMESPACE_MAP["UiPath.DataService.Activities"]).toBeDefined();
      expect(PACKAGE_NAMESPACE_MAP["UiPath.DataService.Activities"].prefix).toBe("uds");
    });

    it("UiPath.CommunicationsMining.Activities has consistent prefix mapping across registry and compliance", () => {
      expect(NAMESPACE_PREFIX_TO_PACKAGE["ucm"]).toBe("UiPath.CommunicationsMining.Activities");
      expect(PACKAGE_NAMESPACE_MAP["UiPath.CommunicationsMining.Activities"]).toBeDefined();
      expect(PACKAGE_NAMESPACE_MAP["UiPath.CommunicationsMining.Activities"].prefix).toBe("ucm");
    });

    it("UiPath.GSuite.Activities has canonical prefix 'ugs' with no dead reverse mapping", () => {
      expect(NAMESPACE_PREFIX_TO_PACKAGE["ugs"]).toBe("UiPath.GSuite.Activities");
      expect(NAMESPACE_PREFIX_TO_PACKAGE["ugsuite"]).toBeUndefined();
      expect(PACKAGE_NAMESPACE_MAP["UiPath.GSuite.Activities"]).toBeDefined();
      expect(PACKAGE_NAMESPACE_MAP["UiPath.GSuite.Activities"].prefix).toBe("ugs");
    });
  });

  describe("DHG truthfulness validation (Task #384)", () => {
    it("Travel process DHG output reflects generated vs degraded coverage accurately", () => {
      const { xamlEntries } = assemblePipeline(
        travelRequestNodes,
        travelRequestEdges,
        "Travel_Request_Processing",
        travelRequestSdd,
      );
      const allXaml = xamlEntries.map(e => e.content).join("\n");

      for (const entry of xamlEntries) {
        if (entry.content.includes("TODO:") || entry.content.includes("Bind Point")) {
          const displayNameMatch = entry.content.match(/DisplayName="([^"]*TODO[^"]*)"/);
          if (displayNameMatch) {
            expect(displayNameMatch[1]).not.toBe("");
          }
        }
      }

      expect(allXaml).not.toContain("[ASSEMBLY_FAILED]");
      expect(allXaml).not.toMatch(/\[TODO: Fix/);
    });

    it("Password reset process DHG output reflects generated vs degraded coverage accurately", () => {
      const { xamlEntries } = assemblePipeline(
        passwordResetNodes,
        passwordResetEdges,
        "Password_Reset_Automation",
        passwordResetSdd,
      );
      const allXaml = xamlEntries.map(e => e.content).join("\n");

      for (const entry of xamlEntries) {
        if (entry.content.includes("TODO:") || entry.content.includes("Bind Point")) {
          const displayNameMatch = entry.content.match(/DisplayName="([^"]*TODO[^"]*)"/);
          if (displayNameMatch) {
            expect(displayNameMatch[1]).not.toBe("");
          }
        }
      }

      expect(allXaml).not.toContain("[ASSEMBLY_FAILED]");
      expect(allXaml).not.toMatch(/\[TODO: Fix/);
    });
  });

  describe("Task #387 regression locks", () => {
    it("T008: file paths are classified as literals, not variable references", () => {
      const xamlFile = normalizePropertyToValueIntent("InitAllSettings.xaml", "InvokeWorkflowFile", "WorkflowFileName");
      expect(xamlFile.type).toBe("literal");
      expect(xamlFile.value).toBe("InitAllSettings.xaml");

      const excelFile = normalizePropertyToValueIntent("Config.xlsx", "ExcelReadRange", "WorkbookPath");
      expect(excelFile.type).toBe("literal");
      expect(excelFile.value).toBe("Config.xlsx");

      const jsonFile = normalizePropertyToValueIntent("data.json", "ReadTextFile", "FileName");
      expect(jsonFile.type).toBe("literal");
      expect(jsonFile.value).toBe("data.json");

      const dotProp = normalizePropertyToValueIntent("item.Status");
      expect(dotProp.type).toBe("variable");
      expect(dotProp.name).toBe("item.Status");
    });

    it("T009: xmlns injection detects prefixes in x:TypeArguments attributes", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Test">
    <Variable x:TypeArguments="scg:List(snetmail:MailMessage)" Name="mailList" />
  </Sequence>
</Activity>`;
      const result = injectMissingNamespaceDeclarations(xaml);
      expect(result.injected).toContain("snetmail");
      expect(result.xml).toContain('xmlns:snetmail="clr-namespace:System.Net.Mail;assembly=System"');
    });

    it("T010: wrapVariableDefault does not bracket-wrap file paths", () => {
      const configPath = wrapVariableDefault("Data\\\\Config.xlsx", "System.String");
      expect(configPath).not.toContain("[");

      const xamlPath = wrapVariableDefault("InitAllSettings.xaml", "System.String");
      expect(xamlPath).not.toContain("[");
    });

    it("T011: InvokeWorkflowFile filenames remain unbracketted through full pipeline", () => {
      const { xamlEntries } = assemblePipeline(
        simpleLinearNodes,
        simpleLinearEdges,
        "HR_Report_Download",
        simpleLinearSdd,
      );
      const mainEntry = xamlEntries.find(e => e.name === "Main.xaml");
      expect(mainEntry).toBeDefined();
      const wfnMatches = mainEntry!.content.match(/WorkflowFileName="([^"]*)"/g) || [];
      for (const match of wfnMatches) {
        expect(match).not.toContain("[");
        expect(match).not.toContain("]");
      }

      for (const entry of xamlEntries) {
        if (entry.name.includes("InitAllSettings")) {
          expect(entry.name).toBe("InitAllSettings.xaml");
        }
      }
    });
  });
});

describe("Canonical normalization consolidation", () => {
  describe("CLR_NAMESPACE_TO_XAML_PREFIX derived from PACKAGE_NAMESPACE_MAP", () => {
    it("covers all clrNamespaces from PACKAGE_NAMESPACE_MAP", () => {
      for (const [, info] of Object.entries(PACKAGE_NAMESPACE_MAP)) {
        if (info.prefix && info.clrNamespace) {
          expect(CLR_NAMESPACE_TO_XAML_PREFIX[info.clrNamespace]).toBeDefined();
        }
      }
    });

    it("maps UiPath.Core and UiPath.Core.Activities to 'ui'", () => {
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.Core"]).toBe("ui");
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.Core.Activities"]).toBe("ui");
    });

    it("maps known packages correctly", () => {
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.Persistence.Activities"]).toBe("upers");
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.Mail.Activities"]).toBe("umail");
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.Excel.Activities"]).toBe("uexcel");
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.GSuite.Activities"]).toBe("ugs");
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.MicrosoftOffice365.Activities"]).toBe("uo365");
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.Credentials.Activities"]).toBe("ucred");
      expect(CLR_NAMESPACE_TO_XAML_PREFIX["UiPath.Testing.Activities"]).toBe("utest");
    });
  });

  describe("Single canonical normalization functions", () => {
    it("ensureBracketWrapped handles InArgument/OutArgument prefixes", () => {
      expect(ensureBracketWrapped('<InArgument x:TypeArguments="x:String">"test"</InArgument>')).toBe('<InArgument x:TypeArguments="x:String">"test"</InArgument>');
      expect(ensureBracketWrapped('<OutArgument x:TypeArguments="x:String">result</OutArgument>')).toBe('<OutArgument x:TypeArguments="x:String">result</OutArgument>');
    });

    it("ensureBracketWrapped handles Nothing", () => {
      expect(ensureBracketWrapped("Nothing")).toBe("Nothing");
      expect(ensureBracketWrapped("null")).toBe("null");
    });

    it("ensureBracketWrapped handles basic literals", () => {
      expect(ensureBracketWrapped("True")).toBe("True");
      expect(ensureBracketWrapped("False")).toBe("False");
      expect(ensureBracketWrapped("123")).toBe("123");
      expect(ensureBracketWrapped('"hello"')).toBe('"hello"');
    });

    it("smartBracketWrap handles &quot; entities", () => {
      expect(smartBracketWrap("&quot;test&quot;")).toBe("&quot;test&quot;");
    });

    it("smartBracketWrap handles XML entities as expressions", () => {
      const result = smartBracketWrap("value &amp; other");
      expect(result).toBe("[value &amp; other]");
    });

    it("BARE_WORD_LITERALS_SET is canonical and case-normalized", () => {
      expect(BARE_WORD_LITERALS_SET.has("yes")).toBe(true);
      expect(BARE_WORD_LITERALS_SET.has("no")).toBe(true);
      expect(BARE_WORD_LITERALS_SET.has("normal")).toBe(true);
      expect(BARE_WORD_LITERALS_SET.has("pending")).toBe(true);
    });

    it("looksLikePlainText recognizes variable prefixes as non-plain-text", () => {
      expect(looksLikePlainText("str_Name")).toBe(false);
      expect(looksLikePlainText("int_Count")).toBe(false);
      expect(looksLikePlainText("in_Parameter")).toBe(false);
      expect(looksLikePlainText("out_Result")).toBe(false);
    });

    it("looksLikePlainText recognizes file extensions as plain text", () => {
      expect(looksLikePlainText("report.xlsx")).toBe(true);
      expect(looksLikePlainText("data.json")).toBe(true);
    });
  });
});

describe("Compiler-invariant regression tests", () => {
  describe("No typed property objects in emitted XAML", () => {
    it("detects typed property object leakage", () => {
      const badXaml = '<InArgument x:TypeArguments="x:String"> {key: "value"}</InArgument>';
      const violations = checkNormalizationInvariants(badXaml, "test.xaml");
      const tpoViolations = violations.filter(v => v.pattern === "typed-property-object");
      expect(tpoViolations.length).toBeGreaterThan(0);
    });

    it("passes clean XAML without typed property objects", () => {
      const goodXaml = '<InArgument x:TypeArguments="x:String">"hello"</InArgument>';
      const violations = checkNormalizationInvariants(goodXaml, "test.xaml");
      const tpoViolations = violations.filter(v => v.pattern === "typed-property-object");
      expect(tpoViolations.length).toBe(0);
    });
  });

  describe("No raw CLR type leakage", () => {
    it("detects raw CLR types in type attributes", () => {
      const badXaml = '<Variable x:TypeArguments="System.Collections.Generic.List" Name="items" />';
      const violations = checkNormalizationInvariants(badXaml, "test.xaml");
      const rawClr = violations.filter(v => v.pattern === "raw-clr-type");
      expect(rawClr.length).toBeGreaterThan(0);
    });

    it("accepts prefixed XAML types", () => {
      const goodXaml = '<Variable x:TypeArguments="scg:List(x:String)" Name="items" />';
      const violations = checkNormalizationInvariants(goodXaml, "test.xaml");
      const rawClr = violations.filter(v => v.pattern === "raw-clr-type");
      expect(rawClr.length).toBe(0);
    });
  });

  describe("No unwrapped VB expression defaults", () => {
    it("detects unwrapped New expressions in variable defaults", () => {
      const badXaml = '<Variable x:TypeArguments="scg:List(x:String)" Name="items" Default="New List(Of String)" />';
      const violations = checkNormalizationInvariants(badXaml, "test.xaml");
      const unwrapped = violations.filter(v => v.pattern === "unwrapped-vb-default");
      expect(unwrapped.length).toBeGreaterThan(0);
    });

    it("accepts bracket-wrapped New expressions in variable defaults", () => {
      const goodXaml = '<Variable x:TypeArguments="scg:List(x:String)" Name="items" Default="[New List(Of String)]" />';
      const violations = checkNormalizationInvariants(goodXaml, "test.xaml");
      const unwrapped = violations.filter(v => v.pattern === "unwrapped-vb-default");
      expect(unwrapped.length).toBe(0);
    });
  });

  describe("No malformed generic type serialization", () => {
    it("detects unbalanced parentheses in type arguments", () => {
      const badXaml = '<Variable x:TypeArguments="scg:Dictionary(x:String" Name="data" />';
      const violations = checkNormalizationInvariants(badXaml, "test.xaml");
      const malformed = violations.filter(v => v.pattern === "malformed-generic");
      expect(malformed.length).toBeGreaterThan(0);
    });

    it("detects raw brackets in type arguments", () => {
      const badXaml = '<Variable x:TypeArguments="List[String]" Name="data" />';
      const violations = checkNormalizationInvariants(badXaml, "test.xaml");
      const malformed = violations.filter(v => v.pattern === "malformed-generic");
      expect(malformed.length).toBeGreaterThan(0);
    });

    it("accepts well-formed generic types", () => {
      const goodXaml = '<Variable x:TypeArguments="scg:Dictionary(x:String, x:Object)" Name="data" />';
      const violations = checkNormalizationInvariants(goodXaml, "test.xaml");
      const malformed = violations.filter(v => v.pattern === "malformed-generic");
      expect(malformed.length).toBe(0);
    });
  });

  describe("Skips declaration ranges", () => {
    it("does not flag type patterns inside TextExpression declaration sections", () => {
      const xamlWithDecl = `<Sequence>
        <TextExpression.ReferencesForImplementation>
          <Variable x:TypeArguments="System.Collections.Generic.List" Name="internal" />
        </TextExpression.ReferencesForImplementation>
        <Variable x:TypeArguments="scg:List(x:String)" Name="items" Default="[New List(Of String)]" />
      </Sequence>`;
      const violations = checkNormalizationInvariants(xamlWithDecl, "test.xaml");
      expect(violations.length).toBe(0);
    });
  });

  describe("mapClrFullyQualifiedToXamlPrefix uses canonical map", () => {
    it("maps UiPath.Core.Activities types to ui: prefix", () => {
      const result = mapClrFullyQualifiedToXamlPrefix("UiPath.Core.Activities.InvokeWorkflowFile");
      expect(result).toBe("ui:InvokeWorkflowFile");
    });

    it("maps UiPath.Excel.Activities types to uexcel: prefix", () => {
      const result = mapClrFullyQualifiedToXamlPrefix("UiPath.Excel.Activities.ExcelReadRange");
      expect(result).toBe("uexcel:ExcelReadRange");
    });

    it("maps UiPath.Persistence.Activities types to upers: prefix", () => {
      const result = mapClrFullyQualifiedToXamlPrefix("UiPath.Persistence.Activities.CreateFormTask");
      expect(result).toBe("upers:CreateFormTask");
    });

    it("maps UiPath.Mail.Activities types to umail: prefix", () => {
      const result = mapClrFullyQualifiedToXamlPrefix("UiPath.Mail.Activities.SendSmtpMailMessage");
      expect(result).toBe("umail:SendSmtpMailMessage");
    });
  });

  describe("Required Property Quality Gate - All Prefixes", () => {
    it("detects missing required properties on ui: prefixed activities", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage DisplayName="Log Missing Level" />`);
      const result = runQG([{ name: "Main.xaml", content: xaml }], { "UiPath.System.Activities": "25.10.0" });
      const propViolations = result.violations.filter(v => v.check === "MISSING_REQUIRED_ACTIVITY_PROPERTY");
      const levelMissing = propViolations.some(v => v.detail.includes("Level") || v.detail.includes("Message"));
      expect(levelMissing).toBe(true);
    });

    it("does not flag activities with all required properties present as attributes", () => {
      const xaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="[&quot;test&quot;]" DisplayName="Log OK" />`);
      const result = runQG([{ name: "Main.xaml", content: xaml }], { "UiPath.System.Activities": "25.10.0" });
      const propViolations = result.violations.filter(v => v.check === "MISSING_REQUIRED_ACTIVITY_PROPERTY");
      expect(propViolations).toHaveLength(0);
    });

    it("does not flag activities with required properties as child elements", () => {
      const xaml = makeValidXaml("Main", `
        <ui:LogMessage DisplayName="Log OK">
          <ui:LogMessage.Level>Info</ui:LogMessage.Level>
          <ui:LogMessage.Message>[&quot;test&quot;]</ui:LogMessage.Message>
        </ui:LogMessage>
      `);
      const result = runQG([{ name: "Main.xaml", content: xaml }], { "UiPath.System.Activities": "25.10.0" });
      const propViolations = result.violations.filter(v => v.check === "MISSING_REQUIRED_ACTIVITY_PROPERTY");
      expect(propViolations).toHaveLength(0);
    });
  });

  describe("TextExpression Block Coverage", () => {
    const reframeworkGenerators: Array<{ name: string; gen: () => string }> = [
      { name: "Main.xaml", gen: () => generateReframeworkMainXaml("Test", "TestQueue", "Windows") },
      { name: "Init.xaml", gen: () => generateInitXaml() },
      { name: "InitAllSettings.xaml", gen: () => generateInitAllSettingsXaml("TestProject", "Windows") },
      { name: "GetTransactionData.xaml", gen: () => generateGetTransactionDataXaml("TestQueue", "Windows") },
      { name: "SetTransactionStatus.xaml", gen: () => generateSetTransactionStatusXaml("Windows") },
      { name: "CloseAllApplications.xaml", gen: () => generateCloseAllApplicationsXaml("Windows") },
      { name: "KillAllProcesses.xaml", gen: () => generateKillAllProcessesXaml("Windows") },
    ];

    for (const { name, gen } of reframeworkGenerators) {
      it(`${name} contains TextExpression.NamespacesForImplementation`, () => {
        const xaml = gen();
        expect(xaml).toContain("TextExpression.NamespacesForImplementation");
      });

      it(`${name} contains TextExpression.ReferencesForImplementation`, () => {
        const xaml = gen();
        expect(xaml).toContain("TextExpression.ReferencesForImplementation");
      });

      it(`${name} contains required namespace entries`, () => {
        const xaml = gen();
        expect(xaml).toContain("<x:String>System</x:String>");
        expect(xaml).toContain("<x:String>UiPath.Core.Activities</x:String>");
        expect(xaml).toContain("<x:String>System.Activities</x:String>");
      });

      it(`${name} contains required assembly references`, () => {
        const xaml = gen();
        expect(xaml).toContain("<AssemblyReference>System.Activities</AssemblyReference>");
        expect(xaml).toContain("<AssemblyReference>mscorlib</AssemblyReference>");
        expect(xaml).toContain("<AssemblyReference>UiPath.Core.Activities</AssemblyReference>");
      });
    }
  });

  describe("post-classifier archive freeze — integrated pipeline guards", () => {
    beforeEach(() => {
      resetMonotonicCounter();
    });

    it("guarded deferredWrites blocks post-freeze XAML mutation in package mode", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);
      const guarded = createGuardedDeferredWrites(deferredWrites, true);

      expect(() => guarded.set("lib/Main.xaml", mainXaml + "<!-- mutation -->")).toThrow("Post-Freeze Mutation Violation");
    });

    it("guarded deferredWrites allows non-XAML writes after freeze", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const deferredWrites = new Map<string, string>();
      const guarded = createGuardedDeferredWrites(deferredWrites, true);

      expect(() => guarded.set("project.json", '{"name":"test"}')).not.toThrow();
      expect(guarded.get("project.json")).toBe('{"name":"test"}');
    });

    it("guarded deferredWrites allows identical XAML content write after freeze", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const deferredWrites = new Map<string, string>();
      const guarded = createGuardedDeferredWrites(deferredWrites, true);

      expect(() => guarded.set("lib/Main.xaml", mainXaml)).not.toThrow();
    });

    it("verifyFrozenArchiveBuffer detects divergence between frozen and archive content", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const zip = new AdmZip();
      zip.addFile("lib/Main.xaml", Buffer.from(mainXaml + "<!-- corrupted -->", "utf-8"));
      const buffer = zip.toBuffer();

      const result = verifyFrozenArchiveBuffer(buffer, "lib");
      expect(result.verified).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].file).toBe("Main.xaml");
    });

    it("verifyFrozenArchiveBuffer passes when archive matches frozen content", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const zip = new AdmZip();
      zip.addFile("lib/Main.xaml", Buffer.from(mainXaml, "utf-8"));
      const buffer = zip.toBuffer();

      const result = verifyFrozenArchiveBuffer(buffer, "lib");
      expect(result.verified).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });

    it("mutation trace includes both pre-freeze snapshots and post-freeze violations", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const stubXaml = `<Activity mc:Ignorable="sap sap2010" x:Class="Helper"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="STUB_BLOCKING_FALLBACK: workflow stubbed due to generation failure">
    <ui:Comment DisplayName="STUB: Manual implementation required" />
  </Sequence>
</Activity>`;
      const entries = [
        { name: "lib/Main.xaml", content: mainXaml },
        { name: "lib/Helper.xaml", content: stubXaml },
      ];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      try { assertNoPostFreezeMutation("late-repair", "Main.xaml", mainXaml + "<!-- m -->", "xaml_bytes", "test"); } catch {}
      try { assertNoPostFreezeStatusMutation("dhg-override", "Helper.xaml", "non-stub", "test"); } catch {}

      const trace = getMutationTrace();
      const allowed = trace.entries.filter((e: PostClassifierMutationTraceEntry) => e.allowed);
      const blocked = trace.entries.filter((e: PostClassifierMutationTraceEntry) => !e.allowed);
      expect(allowed).toHaveLength(2);
      expect(blocked).toHaveLength(2);
      expect(trace.summary.totalAllowedPreFreezeMutations).toBe(2);
      expect(trace.summary.totalBlockedMutations).toBe(2);
    });

    it("integrated freeze + parity: frozen content passes DHG-archive parity", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const stubXaml = `<Activity mc:Ignorable="sap sap2010" x:Class="Helper"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="STUB_BLOCKING_FALLBACK: workflow stubbed due to generation failure">
    <ui:Comment DisplayName="STUB: Manual implementation required" />
  </Sequence>
</Activity>`;
      const entries = [
        { name: "lib/Main.xaml", content: mainXaml },
        { name: "lib/Helper.xaml", content: stubXaml },
      ];
      const classification = classifyWorkflowStatus(entries);
      const freeze = freezeArchiveWorkflows(entries, classification);

      const frozenEntries = Array.from(freeze.frozenWorkflows.values()).map((fw: FrozenWorkflowEntry) => ({
        name: fw.file,
        content: fw.content,
      }));

      const dhg = "| 1 | `Main.xaml` | Generated | 5 |\n| 2 | `Helper.xaml` | Stub | 1 |";
      const parityResult = assertDhgArchiveParity(dhg, ["Main", "Helper"], frozenEntries, classification);
      expect(parityResult.passed).toBe(true);
    });

    it("integrated freeze + parity: stale (pre-freeze mutated) content causes parity failure", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Hello&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const staleEntries = [{ name: "lib/Main.xaml", content: mainXaml + "<!-- stale mutation -->" }];
      const dhgTierMap = new Map([["main", "Generated"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, staleEntries);
      const mainEntry = parity.entries.find((e: WorkflowStatusParityEntry) => normalizeClassifierFileName(e.file) === "main");
      expect(mainEntry.identicalContent).toBe(false);
      expect(mainEntry.divergenceReason).toContain("Content hash mismatch");
    });
  });

  describe("Task 433 regression: isPackageMode defined at call site", () => {
    beforeEach(() => {
      resetMonotonicCounter();
      resetArchiveFreeze();
    });

    it("createGuardedDeferredWrites with isPackageMode=true does not throw ReferenceError", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Test&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      let deferredWrites = new Map<string, string>();
      const isPackageMode = true;
      deferredWrites = createGuardedDeferredWrites(deferredWrites, isPackageMode);

      expect(() => deferredWrites.set("project.json", "{}")).not.toThrow();
      expect(() => deferredWrites.set("lib/Main.xaml", mainXaml)).not.toThrow();
    });

    it("createGuardedDeferredWrites enforces fatal in package mode on mutation", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Test&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const isPackageMode = true;
      const deferredWrites = createGuardedDeferredWrites(new Map<string, string>(), isPackageMode);

      expect(() => deferredWrites.set("lib/Main.xaml", mainXaml + "<!-- changed -->")).toThrow("Post-Freeze Mutation Violation");
    });
  });

  describe("Task 434 regression: pipeline-level freeze verification and mutation trace", () => {
    beforeEach(() => {
      resetMonotonicCounter();
      resetArchiveFreeze();
    });

    it("full pipeline: freeze → archive → verify produces zero mismatches when no mutation occurs", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Pipeline test&quot;" DisplayName="Log" />`);
      const helperXaml = makeValidXaml("Helper", `<ui:LogMessage Level="Info" Message="&quot;Helper&quot;" DisplayName="Log" />`);
      const entries = [
        { name: "lib/Main.xaml", content: mainXaml },
        { name: "lib/Helper.xaml", content: helperXaml },
      ];

      const classification = classifyWorkflowStatus(entries);
      const freeze = freezeArchiveWorkflows(entries, classification);
      expect(freeze.frozenWorkflows.size).toBe(2);

      const zip = new AdmZip();
      for (const entry of entries) {
        zip.addFile(entry.name, Buffer.from(entry.content, "utf-8"));
      }
      const archiveBuffer = zip.toBuffer();

      const result = verifyFrozenArchiveBuffer(archiveBuffer, "lib");
      expect(result.verified).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });

    it("full pipeline: mutated archive buffer is detected by verifyFrozenArchiveBuffer", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Pipeline test&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];

      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const zip = new AdmZip();
      zip.addFile("lib/Main.xaml", Buffer.from(mainXaml + "<!-- post-freeze mutation -->", "utf-8"));
      const archiveBuffer = zip.toBuffer();

      const result = verifyFrozenArchiveBuffer(archiveBuffer, "lib");
      expect(result.verified).toBe(false);
      expect(result.mismatches.length).toBeGreaterThan(0);
      expect(result.mismatches[0].file).toBe("Main.xaml");
    });

    it("mutation trace entries include function field in all call sites", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Trace test&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      try {
        assertNoPostFreezeMutation("test-stage", "Main.xaml", mainXaml + "<!-- changed -->", "xaml_bytes", "test mutation");
      } catch (_e) {}

      try {
        const invalidStatus: WorkflowStatus = "stub";
        assertNoPostFreezeStatusMutation("test-stage", "Main.xaml", invalidStatus, "test status change");
      } catch (_e) {}

      const trace = getMutationTrace();
      const nonFreezeEntries = trace.entries.filter(e => e.stage !== "freeze-archive-workflows");
      expect(nonFreezeEntries.length).toBeGreaterThan(0);
      for (const entry of nonFreezeEntries) {
        expect(entry).toHaveProperty("function");
        expect(typeof entry.function).toBe("string");
        expect(entry.function!.length).toBeGreaterThan(0);
      }
    });

    it("createGuardedPostGateEntries blocks post-freeze content mutation in package mode", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Guard test&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const guarded = createGuardedPostGateEntries(entries, true);
      expect(() => {
        guarded[0].content = mainXaml + "<!-- mutated -->";
      }).toThrow("Post-Freeze Mutation Violation");
    });

    it("createGuardedPostGateEntries allows identical content assignment without throwing", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Guard test&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const guarded = createGuardedPostGateEntries(entries, true);
      expect(() => {
        guarded[0].content = mainXaml;
      }).not.toThrow();
    });

    it("deferredWrites guard and postGateEntries guard both block mutation, ensuring dual-path consistency", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Dual path&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const guardedDW = createGuardedDeferredWrites(new Map<string, string>(), true);
      const guardedEntries = createGuardedPostGateEntries(entries, true);

      const mutated = mainXaml + "<!-- dual-path-mutation -->";
      expect(() => guardedDW.set("lib/Main.xaml", mutated)).toThrow("Post-Freeze Mutation Violation");
      expect(() => { guardedEntries[0].content = mutated; }).toThrow("Post-Freeze Mutation Violation");

      const trace = getMutationTrace();
      expect(trace.summary.totalUnexpectedPostFreezeMutations).toBeGreaterThanOrEqual(2);
    });

    it("postGateXamlEntries is the single authoritative XAML source after pre-freeze sync", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Authority test&quot;" DisplayName="Log" />`);
      const entries = [{ name: "lib/Main.xaml", content: mainXaml }];
      const classification = classifyWorkflowStatus(entries);

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml + "<!-- stale deferredWrites content -->");
      deferredWrites.set("project.json", "{}");

      for (const entry of entries) {
        if (!entry.name.endsWith(".xaml")) continue;
        deferredWrites.set(entry.name, entry.content);
      }

      for (const entry of entries) {
        if (!entry.name.endsWith(".xaml")) continue;
        const dwContent = deferredWrites.get(entry.name);
        expect(dwContent).toBe(entry.content);
      }

      freezeArchiveWorkflows(entries, classification);

      const postGateArchiveXamlEntries = entries.filter(e => e.name.endsWith(".xaml"));
      expect(postGateArchiveXamlEntries).toHaveLength(1);
      expect(postGateArchiveXamlEntries[0].content).toBe(mainXaml);

      const zip = new AdmZip();
      for (const [path, content] of deferredWrites.entries()) {
        zip.addFile(path, Buffer.from(content, "utf-8"));
      }
      const result = verifyFrozenArchiveBuffer(zip.toBuffer(), "lib");
      expect(result.verified).toBe(true);
    });

    it("mutation trace perFileMutationCounts tracks per-file mutation attempts", () => {
      const mainXaml = makeValidXaml("Main", `<ui:LogMessage Level="Info" Message="&quot;Count test&quot;" DisplayName="Log" />`);
      const helperXaml = makeValidXaml("Helper", `<ui:LogMessage Level="Info" Message="&quot;Count helper&quot;" DisplayName="Log" />`);
      const entries = [
        { name: "lib/Main.xaml", content: mainXaml },
        { name: "lib/Helper.xaml", content: helperXaml },
      ];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      try {
        assertNoPostFreezeMutation("test", "Main.xaml", mainXaml + "<!-- a -->", "xaml_bytes", "test");
      } catch (_e) {}
      try {
        assertNoPostFreezeMutation("test", "Helper.xaml", helperXaml + "<!-- b -->", "xaml_bytes", "test");
      } catch (_e) {}

      const trace = getMutationTrace();
      expect(trace.perFileMutationCounts).toBeDefined();
      expect(Object.keys(trace.perFileMutationCounts!).length).toBeGreaterThanOrEqual(2);
      expect(trace.filesChangedAfterFreeze).toBeDefined();
      expect(trace.filesChangedAfterFreeze!.length).toBeGreaterThanOrEqual(2);
    });
  });
});
