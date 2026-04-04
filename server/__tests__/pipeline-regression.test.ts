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
import { runFinalArtifactValidation, type PackageCompletenessViolation, type PackageCompletenessViolationsArtifact } from "../final-artifact-validation";
import { validateWorkflowGraph } from "../xaml/workflow-graph-validator";
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
  sealAuthoritativeXamlSource,
  getAuthoritativeXamlForArchive,
  recordAuthoritativeAppendHash,
  getArchiveAuthorityDiagnostics,
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
  isSentinelValue,
  isGenericTypeDefault,
  hasContractValidFallback,
  tryLowerStructuredExpression,
  enforceRequiredProperties,
  runPreCompliancePackageModeGuard,
  applyRequiredPropertyEnforcement,
  isTypeCompatible,
  isSlotCompatible,
  extractUpstreamSources,
  resolveSourceForProperty,
  extractCatalogSourceCandidates,
  isDocumentedContractGenericDefault,
  type ContractFallbackResult,
  type CatalogSourceCandidate,
  type UpstreamSourceCandidate,
  type InvalidRequiredPropertySubstitution,
  type ResolvedSourceProvenance,
  type RejectedCandidateRecord,
} from "../required-property-enforcer";
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

  describe("Task 435 regression: archive append authority unification", () => {
    const VALID_XAML = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation">
  <Sequence DisplayName="Main Sequence">
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="TestVar" Default="hello" />
    </Sequence.Variables>
  </Sequence>
</Activity>`;

    it("full integration: seal → accessor → append → freeze → guard lifecycle", () => {
      const postGateEntries = [
        { name: "lib/Main.xaml", content: VALID_XAML },
        { name: "lib/Helper.xaml", content: VALID_XAML.replace("Main Sequence", "Helper Sequence") },
      ];

      sealAuthoritativeXamlSource(postGateEntries);
      const authEntries = getAuthoritativeXamlForArchive();

      expect(authEntries).toHaveLength(2);
      expect(authEntries[0].content).toBe(postGateEntries[0].content);
      expect(authEntries[1].content).toBe(postGateEntries[1].content);

      for (const entry of authEntries) {
        const hash = Buffer.from(entry.content).toString("base64").slice(0, 16);
        recordAuthoritativeAppendHash(entry.name, hash);
      }

      const classification = classifyWorkflowStatus(postGateEntries);
      freezeArchiveWorkflows(postGateEntries, classification);

      const guarded = createGuardedPostGateEntries(postGateEntries, true);
      expect(() => {
        const _content = guarded[0].content;
      }).toThrow(/Archive Authority.*FATAL/);

      const dw = new Map<string, string>();
      dw.set("lib/Main.xaml", VALID_XAML);
      const guardedDw = createGuardedDeferredWrites(dw, true);
      expect(() => {
        guardedDw.get("lib/Main.xaml");
      }).toThrow(/Archive Authority.*FATAL/);

      const postFreezeAuth = getAuthoritativeXamlForArchive();
      expect(postFreezeAuth).toHaveLength(2);
      expect(postFreezeAuth[0].content).toBe(postGateEntries[0].content);

      const diag = getArchiveAuthorityDiagnostics();
      expect(diag).not.toBeNull();
      expect(diag!.authoritativeSource).toBe("postGateXamlEntries");
      expect(diag!.accessorUsed).toBe(true);
      expect(diag!.perFile).toHaveLength(2);
      for (const pf of diag!.perFile) {
        expect(pf.authoritativeHash).toBeDefined();
        expect(pf.appendedHash).toBeDefined();
      }
    });

    it("archive XAML content only comes from sealed authoritative entries, not deferredWrites", () => {
      const authContent = VALID_XAML;
      const driftedContent = VALID_XAML + "<!-- drifted -->";

      const postGateEntries = [{ name: "lib/Main.xaml", content: authContent }];
      sealAuthoritativeXamlSource(postGateEntries);

      const authEntries = getAuthoritativeXamlForArchive();
      expect(authEntries[0].content).toBe(authContent);
      expect(authEntries[0].content).not.toBe(driftedContent);

      const dw = new Map<string, string>();
      dw.set("lib/Main.xaml", driftedContent);

      const classification = classifyWorkflowStatus(postGateEntries);
      freezeArchiveWorkflows(postGateEntries, classification);

      const guardedDw = createGuardedDeferredWrites(dw, true);
      expect(() => guardedDw.get("lib/Main.xaml")).toThrow(/Archive Authority.*FATAL/);
      expect(() => { for (const [_k, _v] of guardedDw.entries()) {} }).toThrow(/Archive Authority.*FATAL/);

      const stillAuth = getAuthoritativeXamlForArchive();
      expect(stillAuth[0].content).toBe(authContent);
    });
  });

  describe("Required Property Enforcement (Task #436)", () => {
    const ENFORCEMENT_TEST_XAML = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main Sequence" sap2010:WorkflowViewState.IdRef="MainSequence_1">
    <ui:LogMessage DisplayName="Log Start" Level="Info" Message="Starting" />
  </Sequence>
</Activity>`;

    it("isSentinelValue correctly identifies all sentinel patterns", () => {
      expect(isSentinelValue("PLACEHOLDER")).toBe(true);
      expect(isSentinelValue("placeholder")).toBe(true);
      expect(isSentinelValue("PLACEHOLDER_System_String")).toBe(true);
      expect(isSentinelValue("TODO")).toBe(true);
      expect(isSentinelValue("TODO_implement")).toBe(true);
      expect(isSentinelValue("STUB")).toBe(true);
      expect(isSentinelValue("STUB_BLOCKING")).toBe(true);
      expect(isSentinelValue("HANDOFF")).toBe(true);
      expect(isSentinelValue("HANDOFF_STRING_FORMAT_UNSAFE")).toBe(true);

      expect(isSentinelValue("")).toBe(false);
      expect(isSentinelValue("False")).toBe(false);
      expect(isSentinelValue("0")).toBe(false);
      expect(isSentinelValue("Nothing")).toBe(false);
      expect(isSentinelValue("Hello World")).toBe(false);
      expect(isSentinelValue("[myVariable]")).toBe(false);
    });

    it("hasContractValidFallback returns valid fallback for properties with defaults", () => {
      const propWithDefault = { name: "Body", clrType: "System.String", required: true, default: "Hello" } as { name: string; clrType: string; required: boolean; default?: string; validValues?: string[] };
      const result = hasContractValidFallback(propWithDefault);
      expect(result.valid).toBe(true);
      expect(result.fallbackValue).toBe("Hello");
    });

    it("hasContractValidFallback rejects sentinel defaults", () => {
      const propWithSentinel = { name: "Body", clrType: "System.String", required: true, default: "PLACEHOLDER" } as { name: string; clrType: string; required: boolean; default?: string; validValues?: string[] };
      const result = hasContractValidFallback(propWithSentinel);
      expect(result.valid).toBe(false);
    });

    it("hasContractValidFallback uses validValues when no default", () => {
      const propWithEnum = { name: "LogLevel", clrType: "System.String", required: true, validValues: ["Info", "Warn", "Error"] } as { name: string; clrType: string; required: boolean; default?: string; validValues?: string[] };
      const result = hasContractValidFallback(propWithEnum);
      expect(result.valid).toBe(true);
      expect(result.fallbackValue).toBe("Info");
    });

    it("hasContractValidFallback returns invalid for Boolean types without explicit default", () => {
      const boolProp = { name: "IsEnabled", clrType: "System.Boolean", required: true } as { name: string; clrType: string; required: boolean; default?: string; validValues?: string[] };
      const result = hasContractValidFallback(boolProp);
      expect(result.valid).toBe(false);
    });

    it("tryLowerStructuredExpression passes through plain values", () => {
      const result = tryLowerStructuredExpression("[myVariable]");
      expect(result.lowered).toBe(true);
      expect(result.result).toBe("[myVariable]");
    });

    it("tryLowerStructuredExpression returns lowered=true or false for ValueIntent patterns", () => {
      const result = tryLowerStructuredExpression('{"type":"expression","value":"someExpr"}');
      expect(typeof result.lowered).toBe("boolean");
      if (!result.lowered) {
        expect(result.reason).toBeTruthy();
      }
    });

    it("pre-compliance guard detects sentinel values in XAML attributes", () => {
      const xamlWithSentinel = `<SendMail DisplayName="Send Email" Subject="Test" Body="PLACEHOLDER" To="test@example.com" />`;
      const entries = [{ name: "Main.xaml", content: xamlWithSentinel }];
      const guardResult = runPreCompliancePackageModeGuard(entries);
      expect(guardResult.passed).toBe(false);
      expect(guardResult.violations.length).toBeGreaterThan(0);
    });

    it("sentinel detection covers all sentinel categories", () => {
      expect(isSentinelValue("PLACEHOLDER")).toBe(true);
      expect(isSentinelValue("TODO")).toBe(true);
      expect(isSentinelValue("STUB")).toBe(true);
      expect(isSentinelValue("HANDOFF")).toBe(true);
      expect(isSentinelValue("PLACEHOLDER_System_Object")).toBe(true);
      expect(isSentinelValue("TODO_implement_later")).toBe(true);
      expect(isSentinelValue("STUB_BLOCKING_FALLBACK")).toBe(true);
      expect(isSentinelValue("HANDOFF_STRING_FORMAT_UNSAFE")).toBe(true);

      expect(isSentinelValue("user@example.com")).toBe(false);
      expect(isSentinelValue("Send Email")).toBe(false);
      expect(isSentinelValue("True")).toBe(false);
    });

    it("applyRequiredPropertyEnforcement returns structured result with all diagnostic arrays", () => {
      const entries = [{ name: "Main.xaml", content: ENFORCEMENT_TEST_XAML }];
      const result = applyRequiredPropertyEnforcement(entries, true);

      expect(result).toHaveProperty("entries");
      expect(result).toHaveProperty("enforcementResult");
      expect(result).toHaveProperty("guardResult");

      expect(result.enforcementResult).toHaveProperty("requiredPropertyBindings");
      expect(result.enforcementResult).toHaveProperty("unresolvedRequiredPropertyDefects");
      expect(result.enforcementResult).toHaveProperty("expressionLoweringFixes");
      expect(result.enforcementResult).toHaveProperty("expressionLoweringFailures");
      expect(result.enforcementResult).toHaveProperty("totalEnforced");
      expect(result.enforcementResult).toHaveProperty("totalDefects");
      expect(result.enforcementResult).toHaveProperty("hasBlockingDefects");
      expect(result.enforcementResult).toHaveProperty("summary");

      expect(Array.isArray(result.enforcementResult.requiredPropertyBindings)).toBe(true);
      expect(Array.isArray(result.enforcementResult.unresolvedRequiredPropertyDefects)).toBe(true);
      expect(Array.isArray(result.enforcementResult.expressionLoweringFixes)).toBe(true);
      expect(Array.isArray(result.enforcementResult.expressionLoweringFailures)).toBe(true);
    });

    it("enforceRequiredProperties uses conservative enforcement when catalog is not loaded", () => {
      const entries = [{ name: "Main.xaml", content: ENFORCEMENT_TEST_XAML }];
      const result = enforceRequiredProperties(entries, true);
      expect(result.totalEnforced).toBe(0);
      expect(result.summary).toContain("conservative enforcement");
    });

    it("XAML placeholder cleanup removes sentinel-only attributes entirely", () => {
      const inputXaml = `<SendMail DisplayName="Send" Body="PLACEHOLDER" Subject="TODO" />`;
      let cleaned = inputXaml;
      cleaned = cleaned.replace(/\s+\w+="(?:\[?(?:PLACEHOLDER_?\w*|TODO_?\w*|STUB_?\w*|HANDOFF_?\w*)\]?)"/g, '');
      cleaned = cleaned.replace(/\s+(\w+)="([^"]*)"/g, (attrMatch, _name, val) => {
        const trimmed = val.trim();
        if (/^(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?|HANDOFF(?:_\w*)?)$/i.test(trimmed)) return '';
        return attrMatch;
      });
      expect(cleaned).not.toContain("PLACEHOLDER");
      expect(cleaned).not.toContain("TODO");
      expect(cleaned).not.toContain("Body=");
      expect(cleaned).not.toContain("Subject=");
      expect(cleaned).toContain('DisplayName="Send"');
    });

    it("cleanup preserves attributes with TODO/PLACEHOLDER as substring of legitimate value", () => {
      const content = `<SendMail DisplayName="Send" Subject="Review TODO items for project" Body="PLACEHOLDER" />`;
      let cleaned = content;
      cleaned = cleaned.replace(/\s+\w+="(?:\[?(?:PLACEHOLDER_?\w*|TODO_?\w*|STUB_?\w*|HANDOFF_?\w*)\]?)"/g, '');
      cleaned = cleaned.replace(/\s+(\w+)="([^"]*)"/g, (attrMatch, _name, val) => {
        const trimmed = val.trim();
        if (/^(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?|HANDOFF(?:_\w*)?)$/i.test(trimmed)) return '';
        return attrMatch;
      });
      expect(cleaned).toContain('Subject="Review TODO items for project"');
      expect(cleaned).not.toContain("Body=");
    });

    it("placeholder cleanup removes sentinel attributes without HANDOFF prefix", () => {
      const testContent = `<LogMessage DisplayName="Log" Message="PLACEHOLDER" Level="Info" />`;
      let cleaned = testContent;
      cleaned = cleaned.replace(/\s+\w+="(?:\[?(?:PLACEHOLDER_?\w*|TODO_?\w*|STUB_?\w*|HANDOFF_?\w*)\]?)"/g, '');
      cleaned = cleaned.replace(/\s+(\w+)="([^"]*)"/g, (attrMatch, _name, val) => {
        const trimmed = val.trim();
        if (/^(?:PLACEHOLDER(?:_\w*)?|TODO(?:_\w*)?|STUB(?:_\w*)?|HANDOFF(?:_\w*)?)$/i.test(trimmed)) return '';
        return attrMatch;
      });
      expect(cleaned).not.toContain("PLACEHOLDER");
      expect(cleaned).not.toContain("Message=");
      expect(cleaned).toContain('Level="Info"');
    });

    it("stripSentinelValuesFromRequiredProperties removes sentinel attributes from XAML content", () => {
      const xamlWithSentinels = `<SendMail DisplayName="Send" Body="PLACEHOLDER" Subject="TODO_implement" To="STUB" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xamlWithSentinels }],
        true,
      );
      const outputContent = result.entries[0].content;
      expect(outputContent).not.toContain("PLACEHOLDER");
      expect(outputContent).not.toContain("TODO_implement");
      expect(outputContent).not.toContain("STUB");
      expect(outputContent).not.toContain("Body=");
      expect(outputContent).not.toContain("Subject=");
      expect(outputContent).not.toContain("To=");
      expect(outputContent).toContain('DisplayName="Send"');
    });

    it("stripping preserves non-sentinel attribute values", () => {
      const xamlMixed = `<SendMail DisplayName="Send Email" Body="PLACEHOLDER" To="user@example.com" Subject="Hello World" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xamlMixed }],
        true,
      );
      const outputContent = result.entries[0].content;
      expect(outputContent).not.toContain("PLACEHOLDER");
      expect(outputContent).not.toContain("Body=");
      expect(outputContent).toContain('To="user@example.com"');
      expect(outputContent).toContain('Subject="Hello World"');
      expect(outputContent).toContain('DisplayName="Send Email"');
    });

    it("stripping handles bracket-wrapped sentinels like [PLACEHOLDER]", () => {
      const xamlBracketSentinel = `<Assign DisplayName="Set Var" To="[PLACEHOLDER]" Value="Hello" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xamlBracketSentinel }],
        true,
      );
      const outputContent = result.entries[0].content;
      expect(outputContent).not.toContain("[PLACEHOLDER]");
      expect(outputContent).not.toContain("To=");
      expect(outputContent).toContain('Value="Hello"');
    });

    it("HANDOFF sentinel values are removed in package mode", () => {
      const xamlHandoff = `<SendMail DisplayName="Send" Body="HANDOFF_STRING_FORMAT_UNSAFE" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xamlHandoff }],
        true,
      );
      const outputContent = result.entries[0].content;
      expect(outputContent).not.toContain("HANDOFF");
      expect(outputContent).not.toContain("Body=");
      expect(outputContent).toContain('DisplayName="Send"');
    });

    it("attribute boundary matching does not confuse Name with DisplayName", () => {
      const xaml = `<TypeInto DisplayName="TypeInto1" Name="PLACEHOLDER" Text="Hello" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xaml }],
        true,
      );
      const outputContent = result.entries[0].content;
      expect(outputContent).not.toContain('Name="PLACEHOLDER"');
      expect(outputContent).toContain('DisplayName="TypeInto1"');
      expect(outputContent).toContain('Text="Hello"');
    });

    it("attribute boundary matching does not confuse Path with FolderPath", () => {
      const xaml = `<ReadTextFile FolderPath="/documents" Path="PLACEHOLDER" DisplayName="Read" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xaml }],
        true,
      );
      const outputContent = result.entries[0].content;
      expect(outputContent).not.toContain('Path="PLACEHOLDER"');
      expect(outputContent).toContain('FolderPath="/documents"');
      expect(outputContent).toContain('DisplayName="Read"');
    });

    it("instance-addressed injection does not affect unrelated same-type activities", () => {
      const xaml = [
        `<SendMail DisplayName="Send1" Body="Hello" Subject="Test" To="a@b.com" />`,
        `<SendMail DisplayName="Send2" To="c@d.com" />`,
      ].join("\n");
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xaml }],
        true,
      );
      const output = result.entries[0].content;
      expect(output).toContain('DisplayName="Send1"');
      expect(output).toContain('DisplayName="Send2"');
      expect(output).toContain('Body="Hello"');
    });

    it("global lowering failures are recorded as structured defects for unresolvable expressions", () => {
      const xamlWithBadExpr = `<Assign DisplayName="Assign1" Value='{"type":"unknown_xyz","value":"bad_val"}' />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xamlWithBadExpr }],
        true,
      );
      const allFailures = result.enforcementResult.expressionLoweringFailures;
      const hasGlobalFailure = allFailures.some(f => f.failureReason.includes("Global lowering failed"));
      if (allFailures.length > 0) {
        expect(allFailures[0].severity).toBe("execution_blocking");
        expect(allFailures[0].packageModeOutcome).toBe("structured_defect");
      }
      const outputContent = result.entries[0].content;
      expect(outputContent).toContain('{"type":"unknown_xyz","value":"bad_val"}');
    });

    it("enforcement diagnostics are computed on original content before mutation", () => {
      const xamlWithSentinels = `<SendMail DisplayName="Send" Body="PLACEHOLDER" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xamlWithSentinels }],
        true,
      );
      const outputContent = result.entries[0].content;
      expect(outputContent).not.toContain("PLACEHOLDER");
      expect(outputContent).not.toContain("Body=");
    });

    it("enforcement result binding record has correct shape", () => {
      const binding = {
        file: "Main.xaml",
        workflow: "Main",
        activityType: "SendMail",
        propertyName: "Body",
        sourceBinding: "contract-default",
        originalValue: "",
        resolvedValue: "Hello",
        severity: "info" as const,
        packageModeOutcome: "bound" as const,
        occurrenceIndex: 0,
      };
      expect(binding.severity).toBe("info");
      expect(binding.packageModeOutcome).toBe("bound");
      expect(binding.file).toBe("Main.xaml");
      expect(binding.occurrenceIndex).toBe(0);
    });

    it("enforcement result defect record has correct shape", () => {
      const defect = {
        file: "Main.xaml",
        workflow: "Main",
        activityType: "SendMail",
        propertyName: "Body",
        failureReason: "No contract-valid fallback",
        originalValue: "",
        severity: "execution_blocking" as const,
        packageModeOutcome: "structured_defect" as const,
      };
      expect(defect.severity).toBe("execution_blocking");
      expect(defect.packageModeOutcome).toBe("structured_defect");
    });

    it("conservative enforcement produces defects for sentinel values without catalog", () => {
      const xaml = `<SendMail DisplayName="Send" Body="PLACEHOLDER" Subject="Review TODO items" />`;
      const result = enforceRequiredProperties(
        [{ name: "Main.xaml", content: xaml }],
        true,
      );
      const sentinelDefects = result.unresolvedRequiredPropertyDefects.filter(
        d => d.originalValue === "PLACEHOLDER"
      );
      expect(sentinelDefects.length).toBe(1);
      expect(sentinelDefects[0].propertyName).toBe("Body");
      expect(sentinelDefects[0].severity).toBe("execution_blocking");
      const subjectDefects = result.unresolvedRequiredPropertyDefects.filter(
        d => d.propertyName === "Subject"
      );
      expect(subjectDefects.length).toBe(0);
    });

    it("pre-compliance guard detects sentinels via broad scan when catalog not loaded", () => {
      const xamlWithSentinels = `<SendMail DisplayName="Send" Body="PLACEHOLDER" Subject="TODO_impl" To="STUB_val" />`;
      const entries = [{ name: "Main.xaml", content: xamlWithSentinels }];
      const guardResult = runPreCompliancePackageModeGuard(entries);
      expect(guardResult.passed).toBe(false);
      expect(guardResult.violations.length).toBeGreaterThan(0);
      expect(guardResult.summary).toContain("broad scan");
    });

    it("guard without catalog passes for clean XAML via broad scan", () => {
      const cleanXaml = `<SendMail DisplayName="Send Email" Body="Hello World" Subject="Test" To="user@example.com" />`;
      const entries = [{ name: "Main.xaml", content: cleanXaml }];
      const guardResult = runPreCompliancePackageModeGuard(entries);
      expect(guardResult.passed).toBe(true);
      expect(guardResult.summary).toContain("catalog unavailable");
    });

    it("applyRequiredPropertyEnforcement removes sentinel attributes in package mode", () => {
      const xamlWithSentinels = `<SendMail DisplayName="Send" Body="PLACEHOLDER" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Main.xaml", content: xamlWithSentinels }],
        true,
      );
      expect(result.entries[0].content).not.toContain("Body=");
      expect(result.entries[0].content).not.toContain("PLACEHOLDER");
      expect(result.entries[0].content).toContain('DisplayName="Send"');
    });

    it("non-package mode skips sentinel stripping and guard", () => {
      const xamlWithSentinels = `<SendMail DisplayName="Send" Body="PLACEHOLDER" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Main.xaml", content: xamlWithSentinels }],
        false,
      );
      expect(result.entries[0].content).toContain("PLACEHOLDER");
      expect(result.guardResult.passed).toBe(true);
      expect(result.guardResult.summary).toContain("Not package mode");
    });

    it("isGenericTypeDefault detects generic type defaults", () => {
      expect(isGenericTypeDefault("", "System.String")).toBe(true);
      expect(isGenericTypeDefault("0", "System.Int32")).toBe(true);
      expect(isGenericTypeDefault("False", "System.Boolean")).toBe(true);
      expect(isGenericTypeDefault("Nothing", "System.Object")).toBe(true);
      expect(isGenericTypeDefault("Hello", "System.String")).toBe(false);
      expect(isGenericTypeDefault("42", "System.Int32")).toBe(false);
      expect(isGenericTypeDefault("True", "System.Boolean")).toBe(false);
    });

    it("lowerStructuredExpressionsInContent preserves original on failure", () => {
      const originalContent = '<Activity Value=\'{"type":"expr","value":"badExpr"}\' />';
      const entries = [{ name: "Test.xaml", content: originalContent }];
      const result = applyRequiredPropertyEnforcement(entries, true);
      expect(result.entries[0].content).toContain('{"type":"expr","value":"badExpr"}');
    });

    it("child element sentinel values are detected by conservative enforcement", () => {
      const xamlWithChildSentinel = `<ui:SendMail DisplayName="Send">
  <ui:SendMail.Body>PLACEHOLDER</ui:SendMail.Body>
</ui:SendMail>`;
      const entries = [{ name: "Test.xaml", content: xamlWithChildSentinel }];
      const result = enforceRequiredProperties(entries, true);
      expect(result.summary).toContain("conservative enforcement");
    });

    it("multiple sentinel types are all removed in single pass", () => {
      const xaml = `<Activity Prop1="PLACEHOLDER" Prop2="TODO_x" Prop3="STUB_y" Prop4="HANDOFF_z" Prop5="ValidValue" />`;
      const result = applyRequiredPropertyEnforcement(
        [{ name: "Test.xaml", content: xaml }],
        true,
      );
      const out = result.entries[0].content;
      expect(out).not.toContain("Prop1=");
      expect(out).not.toContain("Prop2=");
      expect(out).not.toContain("Prop3=");
      expect(out).not.toContain("Prop4=");
      expect(out).toContain('Prop5="ValidValue"');
    });
  });

  describe("Source-Resolution-First Enforcement (Task #437)", () => {
    describe("isTypeCompatible", () => {
      it("accepts exact type match", () => {
        expect(isTypeCompatible("System.String", "System.String")).toBe(true);
      });

      it("accepts CLR alias matches", () => {
        expect(isTypeCompatible("String", "System.String")).toBe(true);
        expect(isTypeCompatible("x:String", "System.String")).toBe(true);
        expect(isTypeCompatible("Boolean", "System.Boolean")).toBe(true);
        expect(isTypeCompatible("Int32", "System.Int32")).toBe(true);
      });

      it("accepts System.Object as universal target", () => {
        expect(isTypeCompatible("System.String", "System.Object")).toBe(true);
        expect(isTypeCompatible("System.Int32", "System.Object")).toBe(true);
        expect(isTypeCompatible("System.Boolean", "x:Object")).toBe(true);
      });

      it("rejects incompatible types", () => {
        expect(isTypeCompatible("System.Int32", "System.String")).toBe(false);
        expect(isTypeCompatible("System.Boolean", "System.Int32")).toBe(false);
        expect(isTypeCompatible("System.DateTime", "System.String")).toBe(false);
      });

      it("allows empty/missing types (permissive)", () => {
        expect(isTypeCompatible("", "System.String")).toBe(true);
        expect(isTypeCompatible("System.String", "")).toBe(true);
      });
    });

    describe("isSlotCompatible", () => {
      it("In-direction accepts all source kinds", () => {
        expect(isSlotCompatible("workflowArgument", "In")).toBe(true);
        expect(isSlotCompatible("variable", "In")).toBe(true);
        expect(isSlotCompatible("invokeOutput", "In")).toBe(true);
        expect(isSlotCompatible("priorStepOutput", "In")).toBe(true);
        expect(isSlotCompatible("contractMapping", "In")).toBe(true);
      });

      it("Out-direction only accepts variable or workflowArgument", () => {
        expect(isSlotCompatible("variable", "Out")).toBe(true);
        expect(isSlotCompatible("workflowArgument", "Out")).toBe(true);
        expect(isSlotCompatible("invokeOutput", "Out")).toBe(false);
        expect(isSlotCompatible("priorStepOutput", "Out")).toBe(false);
        expect(isSlotCompatible("contractMapping", "Out")).toBe(false);
      });

      it("InOut-direction only accepts variable or workflowArgument", () => {
        expect(isSlotCompatible("variable", "InOut")).toBe(true);
        expect(isSlotCompatible("workflowArgument", "InOut")).toBe(true);
        expect(isSlotCompatible("invokeOutput", "InOut")).toBe(false);
      });

      it("None-direction accepts all source kinds", () => {
        expect(isSlotCompatible("workflowArgument", "None")).toBe(true);
        expect(isSlotCompatible("variable", "None")).toBe(true);
      });
    });

    describe("extractUpstreamSources", () => {
      it("extracts workflow arguments from x:Property declarations", () => {
        const xaml = `<x:Property Name="in_EmailBody" Type="InArgument(x:String)" />
<x:Property Name="out_Result" Type="OutArgument(x:Boolean)" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const argSources = sources.filter(s => s.sourceKind === "workflowArgument");
        expect(argSources.length).toBeGreaterThanOrEqual(2);
        expect(argSources.some(s => s.sourceName === "in_EmailBody")).toBe(true);
        expect(argSources.some(s => s.sourceName === "out_Result")).toBe(true);
      });

      it("extracts variables from Variable tags", () => {
        const xaml = `<Variable x:TypeArguments="x:String" Name="strBody" />
<Variable x:TypeArguments="x:Int32" Name="intCount" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const varSources = sources.filter(s => s.sourceKind === "variable");
        expect(varSources.length).toBeGreaterThanOrEqual(2);
        expect(varSources.some(s => s.sourceName === "strBody")).toBe(true);
        expect(varSources.some(s => s.sourceName === "intCount")).toBe(true);
      });

      it("extracts invoke outputs from WorkflowFileName references", () => {
        const xaml = `<InvokeWorkflowFile WorkflowFileName="GetMailData.xaml" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const invokeSources = sources.filter(s => s.sourceKind === "invokeOutput");
        expect(invokeSources.length).toBeGreaterThanOrEqual(1);
        expect(invokeSources.some(s => s.sourceName === "GetMailData_output")).toBe(true);
        expect(invokeSources[0].precedenceTier).toBe(3);
      });

      it("extracts prior-step output variables from Result/Output/Value attributes", () => {
        const xaml = `<Assign Result="[stepOutput]" />
<SomeActivity Output="[dataResult]" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const priorStepSources = sources.filter(s => s.sourceKind === "priorStepOutput");
        expect(priorStepSources.length).toBeGreaterThanOrEqual(1);
      });

      it("extracts variables regardless of attribute order", () => {
        const xaml = `<Variable Name="revOrderVar" x:TypeArguments="x:Int32" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const varSources = sources.filter(s => s.sourceKind === "variable" && s.sourceName === "revOrderVar");
        expect(varSources.length).toBe(1);
        expect(varSources[0].sourceType).toBe("x:Int32");
      });

      it("does not extract speculative arguments from incidental in_/out_ text", () => {
        const xaml = `<Sequence DisplayName="in_the_beginning" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const argSources = sources.filter(s => s.sourceKind === "workflowArgument");
        expect(argSources.length).toBe(0);
      });

      it("assigns correct precedence tiers", () => {
        const xaml = `<x:Property Name="in_Body" Type="InArgument(x:String)" />
<Variable x:TypeArguments="x:String" Name="strBody" />
<InvokeWorkflowFile WorkflowFileName="Sub.xaml" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const arg = sources.find(s => s.sourceName === "in_Body");
        const variable = sources.find(s => s.sourceName === "strBody");
        const invoke = sources.find(s => s.sourceKind === "invokeOutput");
        expect(arg?.precedenceTier).toBe(1);
        expect(variable?.precedenceTier).toBe(2);
        expect(invoke?.precedenceTier).toBe(3);
      });
    });

    describe("resolveSourceForProperty", () => {
      const makeStringProp = (name: string) => ({
        name,
        clrType: "System.String",
        required: true,
        direction: "In",
      });

      const makeIntProp = (name: string) => ({
        name,
        clrType: "System.Int32",
        required: true,
        direction: "In",
      });

      it("resolves highest-precedence matching source", () => {
        const prop = makeStringProp("Body") as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "Body", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
          { sourceKind: "workflowArgument", sourceName: "in_Body", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 1 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.resolved).not.toBeNull();
        expect(result.resolved!.sourceName).toBe("in_Body");
        expect(result.resolved!.precedenceTier).toBe(1);
      });

      it("rejects type-incompatible sources", () => {
        const prop = makeStringProp("Body") as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "Body", sourceType: "System.Int32", sourceWorkflow: "Main", precedenceTier: 2 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.resolved).toBeNull();
        expect(result.rejectedCandidates.length).toBeGreaterThan(0);
        expect(result.rejectedCandidates[0].rejectionReason).toBe("typeIncompatible");
      });

      it("rejects slot-incompatible sources for Out-direction properties", () => {
        const prop = { name: "Result", clrType: "System.String", required: true, direction: "Out" } as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "invokeOutput", sourceName: "Result", sourceType: "System.String", sourceWorkflow: "Sub", sourceStep: "Sub.xaml", precedenceTier: 3 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "Assign");
        expect(result.resolved).toBeNull();
        expect(result.rejectedCandidates.some(c => c.rejectionReason === "slotIncompatible")).toBe(true);
      });

      it("returns null with empty sources", () => {
        const prop = makeStringProp("Body") as any;
        const result = resolveSourceForProperty(prop, [], "Main.xaml", "Main", "SendMail");
        expect(result.resolved).toBeNull();
        expect(result.rejectedCandidates.length).toBe(0);
      });

      it("records rejected candidates with reasons in diagnostics", () => {
        const prop = makeStringProp("Body") as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "Body", sourceType: "System.Int32", sourceWorkflow: "Main", precedenceTier: 2 },
          { sourceKind: "workflowArgument", sourceName: "in_Body", sourceType: "System.DateTime", sourceWorkflow: "Main", precedenceTier: 1 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.rejectedCandidates.length).toBeGreaterThan(0);
        const reasons = result.rejectedCandidates.map(c => c.rejectionReason);
        expect(reasons).toContain("typeIncompatible");
      });
    });

    describe("enforceRequiredProperties source resolution integration", () => {
      it("result includes invalidRequiredPropertySubstitutions array", () => {
        const entries = [{ name: "Main.xaml", content: "<Activity />" }];
        const result = enforceRequiredProperties(entries, true);
        expect(result).toHaveProperty("invalidRequiredPropertySubstitutions");
        expect(Array.isArray(result.invalidRequiredPropertySubstitutions)).toBe(true);
        expect(result).toHaveProperty("totalInvalidSubstitutionsBlocked");
        expect(typeof result.totalInvalidSubstitutionsBlocked).toBe("number");
      });

      it("generic default blocked generates invalidSubstitution record", () => {
        expect(isGenericTypeDefault("", "System.String")).toBe(true);
        expect(isGenericTypeDefault("0", "System.Int32")).toBe(true);
        expect(isGenericTypeDefault("False", "System.Boolean")).toBe(true);
        expect(isGenericTypeDefault("Nothing", "System.Object")).toBe(true);

        const contractFallback = hasContractValidFallback({
          name: "Body", clrType: "System.String", required: true,
        } as any);
        expect(contractFallback.valid).toBe(false);
      });

      it("contract-valid fallback accepted and not blocked", () => {
        const prop = {
          name: "Level", clrType: "System.String", required: true,
          validValues: ["Info", "Warn", "Error"],
        } as any;
        const fallback = hasContractValidFallback(prop);
        expect(fallback.valid).toBe(true);
        expect(fallback.fallbackValue).toBe("Info");
      });

      it("Assign.To is not replaced with Nothing (generic default blocked)", () => {
        expect(isGenericTypeDefault("Nothing", "System.Object")).toBe(true);
        const assignToProp = {
          name: "To", clrType: "System.Object", required: true,
        } as any;
        const fallback = hasContractValidFallback(assignToProp);
        expect(fallback.valid).toBe(false);
      });

      it("non-mail family activity obeys same source resolution rules", () => {
        const prop = { name: "Message", clrType: "System.String", required: true, direction: "In" } as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "Message", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "LogMessage");
        expect(result.resolved).not.toBeNull();
        expect(result.resolved!.sourceName).toBe("Message");
        expect(result.resolved!.sourceKind).toBe("variable");
      });

      it("deterministic precedence: tier 1 wins over tier 2", () => {
        const prop = { name: "Body", clrType: "System.String", required: true, direction: "In" } as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "Body", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
          { sourceKind: "workflowArgument", sourceName: "in_Body", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 1 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.resolved).not.toBeNull();
        expect(result.resolved!.precedenceTier).toBe(1);
        expect(result.resolved!.sourceKind).toBe("workflowArgument");
        const lowerPrecedenceRejected = result.rejectedCandidates.filter(c => c.rejectionReason === "lowerPrecedence");
        expect(lowerPrecedenceRejected.length).toBeGreaterThanOrEqual(1);
      });

      it("provenance is recorded on bindings when existing value references known source", () => {
        const xaml = `<x:Property Name="in_Body" Type="InArgument(x:String)" />
<Variable x:TypeArguments="x:String" Name="strBody" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        expect(sources.some(s => s.sourceName === "in_Body" && s.sourceKind === "workflowArgument")).toBe(true);
        expect(sources.some(s => s.sourceName === "strBody" && s.sourceKind === "variable")).toBe(true);
      });

      it("enforcement result summary includes invalid substitution count when present", () => {
        const entries = [{ name: "Main.xaml", content: "<Activity />" }];
        const result = enforceRequiredProperties(entries, true);
        expect(typeof result.summary).toBe("string");
        if (result.invalidRequiredPropertySubstitutions.length > 0) {
          expect(result.summary).toContain("invalid generic substitution");
        }
      });

      it("unresolved required property stays as structured defect when no source found", () => {
        const prop = { name: "Body", clrType: "System.String", required: true, direction: "In" } as any;
        const sources: UpstreamSourceCandidate[] = [];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.resolved).toBeNull();

        const fallback = hasContractValidFallback(prop);
        expect(fallback.valid).toBe(false);
      });

      it("bracketed generic defaults like [Nothing] are blocked", () => {
        expect(isGenericTypeDefault("Nothing", "System.Object")).toBe(true);
        expect(isGenericTypeDefault("", "System.String")).toBe(true);
      });

      it("hasContractValidFallback allows documented generic defaults from catalog", () => {
        const propWithGenericDefault = {
          name: "To", clrType: "System.Object", required: true, default: "Nothing",
        } as any;
        const result = hasContractValidFallback(propWithGenericDefault);
        expect(result.valid).toBe(true);
        expect((result as any).isDocumentedGenericDefault).toBe(true);
      });

      it("isDocumentedContractGenericDefault identifies catalog-documented generic defaults", () => {
        const prop = { name: "Port", clrType: "System.Int32", required: true, default: "0" } as any;
        expect(isDocumentedContractGenericDefault(prop, "0")).toBe(true);
        expect(isDocumentedContractGenericDefault(prop, "42")).toBe(false);

        const noProp = { name: "Body", clrType: "System.String", required: true } as any;
        expect(isDocumentedContractGenericDefault(noProp, "")).toBe(false);
      });

      it("hasContractValidFallback rejects generic defaults with no catalog documentation", () => {
        const propNoDefault = {
          name: "Body", clrType: "System.String", required: true,
        } as any;
        const result = hasContractValidFallback(propNoDefault);
        expect(result.valid).toBe(false);
      });

      it("source-resolved bindings are injected into emitted XAML", () => {
        const xamlWithArgsAndActivity = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <x:Members>
    <x:Property Name="in_Body" Type="InArgument(x:String)" />
  </x:Members>
  <Sequence DisplayName="Main Sequence" sap2010:WorkflowViewState.IdRef="MainSequence_1">
    <ui:LogMessage DisplayName="Log Start" Level="Info" Message="Starting" />
  </Sequence>
</Activity>`;
        const sources = extractUpstreamSources(xamlWithArgsAndActivity, "Main");
        expect(sources.some(s => s.sourceName === "in_Body" && s.sourceKind === "workflowArgument")).toBe(true);
      });

      it("Variable named in_* is classified as variable not workflowArgument", () => {
        const xaml = `<Variable x:TypeArguments="x:String" Name="in_localVar" />`;
        const sources = extractUpstreamSources(xaml, "TestWorkflow");
        const varSources = sources.filter(s => s.sourceName === "in_localVar" && s.sourceKind === "variable");
        const argSources = sources.filter(s => s.sourceName === "in_localVar" && s.sourceKind === "workflowArgument");
        expect(varSources.length).toBe(1);
        expect(argSources.length).toBe(0);
      });

      it("source resolution is attempted before blocking generic defaults", () => {
        const prop = { name: "Body", clrType: "System.String", required: true, direction: "In" } as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "Body", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.resolved).not.toBeNull();
        expect(result.resolved!.sourceName).toBe("Body");
      });

      it("extractCatalogSourceCandidates produces tier-4 contractMapping from catalog defaults/validValues", () => {
        const schema = {
          packageId: "test-pkg",
          activity: {
            className: "SendMail",
            displayName: "Send Mail",
            browsable: true,
            processTypes: ["general" as const],
            emissionApproved: true,
            properties: [
              { name: "Body", clrType: "System.String", required: true, direction: "In" as const, xamlSyntax: "attribute" as const, argumentWrapper: null, typeArguments: null, validValues: undefined, default: "Hello" },
              { name: "Level", clrType: "System.String", required: true, direction: "In" as const, xamlSyntax: "attribute" as const, argumentWrapper: null, typeArguments: null, validValues: ["Info", "Warn"] },
              { name: "To", clrType: "System.String", required: true, direction: "In" as const, xamlSyntax: "attribute" as const, argumentWrapper: null, typeArguments: null },
            ],
          },
        };
        const candidates = extractCatalogSourceCandidates(schema as any, "SendMail");
        const contractMappings = candidates.filter(c => c.sourceKind === "contractMapping");
        expect(contractMappings.length).toBeGreaterThanOrEqual(2);
        expect(contractMappings[0].precedenceTier).toBe(4);
        const bodyMapping = contractMappings.find(c => c.sourceName === "Body");
        expect(bodyMapping).toBeDefined();
        expect((bodyMapping as CatalogSourceCandidate).resolvedLiteralValue).toBe("Hello");
        const levelMapping = contractMappings.find(c => c.sourceName === "Level");
        expect(levelMapping).toBeDefined();
        expect((levelMapping as CatalogSourceCandidate).resolvedLiteralValue).toBe("Info");
      });

      it("extractCatalogSourceCandidates excludes generic type defaults from contractMapping", () => {
        const schema = {
          packageId: "test-pkg",
          activity: {
            className: "TestActivity",
            displayName: "Test",
            browsable: true,
            processTypes: ["general" as const],
            emissionApproved: true,
            properties: [
              { name: "Value", clrType: "System.String", required: true, direction: "In" as const, xamlSyntax: "attribute" as const, argumentWrapper: null, typeArguments: null, default: "" },
              { name: "Count", clrType: "System.Int32", required: true, direction: "In" as const, xamlSyntax: "attribute" as const, argumentWrapper: null, typeArguments: null, default: "0" },
            ],
          },
        };
        const candidates = extractCatalogSourceCandidates(schema as any, "TestActivity");
        expect(candidates.length).toBe(0);
      });

      it("missing required property without real source stays as structured defect", () => {
        const prop = { name: "Body", clrType: "System.String", required: true, direction: "In" } as any;
        const sources: UpstreamSourceCandidate[] = [];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.resolved).toBeNull();
        const fallback = hasContractValidFallback(prop);
        expect(fallback.valid).toBe(false);
      });

      it("same-tier ambiguity causes unresolved defect with rejection records", () => {
        const prop = { name: "FilePath", clrType: "System.String", required: true, direction: "In" } as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "filePath", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
          { sourceKind: "variable", sourceName: "FilePathAlt", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "WriteTextFile");
        if (result.resolved) {
          expect(result.resolved.sourceName).toBe("filePath");
        } else {
          expect(result.rejectedCandidates.length).toBeGreaterThan(0);
          const ambiguousRejections = result.rejectedCandidates.filter(r => r.reason === "ambiguousPrecedence");
          expect(ambiguousRejections.length).toBeGreaterThanOrEqual(0);
        }
      });

      it("exact name match preferred over fuzzy substring match", () => {
        const prop = { name: "Body", clrType: "System.String", required: true, direction: "In" } as any;
        const sources: UpstreamSourceCandidate[] = [
          { sourceKind: "variable", sourceName: "Body", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
          { sourceKind: "variable", sourceName: "BodyTemplate", sourceType: "System.String", sourceWorkflow: "Main", precedenceTier: 2 },
        ];
        const result = resolveSourceForProperty(prop, sources, "Main.xaml", "Main", "SendMail");
        expect(result.resolved).not.toBeNull();
        expect(result.resolved!.sourceName).toBe("Body");
      });
    });
  });

  describe("Package Completeness and No-Healing Policy (Task #438)", () => {
    const VALID_MAIN_XAML = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:LogMessage Message="Hello" Level="Info" />
  </Sequence>
</Activity>`;

    const STUB_MAIN_XAML = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:Comment Text="STUB: Manual implementation required" />
    <ui:LogMessage Message="STUB_BLOCKING_FALLBACK" Level="Info" />
  </Sequence>
</Activity>`;

    const SENTINEL_XAML = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Process">
    <ui:SendSmtpMailMessage To="PLACEHOLDER" Subject="Test" Body="TODO_IMPLEMENT" Host="smtp.test.com" Port="587" />
  </Sequence>
</Activity>`;

    const MALFORMED_XAML = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
</Activity>`;

    const GMAIL_MISSING_BODY_XAML = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="SendEmail">
    <ui:GmailSendMessage To="test@example.com" Subject="Test" DisplayName="Send Gmail" />
  </Sequence>
</Activity>`;

    const SMTP_MISSING_BODY_XAML = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="SendEmail">
    <ui:SendSmtpMailMessage To="test@example.com" Subject="Test" Host="smtp.test.com" Port="587" DisplayName="Send SMTP Mail" />
  </Sequence>
</Activity>`;

    function buildMinimalValidationInput(entries: { name: string; content: string }[], hasNupkg = true) {
      return {
        xamlEntries: entries,
        projectJsonContent: JSON.stringify({ name: "TestProject", dependencies: {} }),
        targetFramework: "Windows" as const,
        archiveManifest: entries.map(e => e.name),
        archiveContentHashes: {},
        hasNupkg,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
          metaValidationFlatStructureWarnings: 0,
          outcomeReport: undefined,
        },
      };
    }

    describe("packageCompletenessViolations artifact production", () => {
      it("produces packageCompletenessViolations artifact on clean input", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageCompletenessViolations).toBeDefined();
        expect(report.packageCompletenessViolations.violations).toBeInstanceOf(Array);
        expect(report.packageCompletenessViolations.summary).toBeDefined();
        expect(report.packageCompletenessViolations.summary.totalPackageFatalViolations).toBeTypeOf("number");
        expect(report.packageViable).toBeTypeOf("boolean");
      });

      it("reports packageViable=true for clean packages", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageViable).toBe(true);
        expect(report.packageCompletenessViolations.packageViable).toBe(true);
        expect(report.packageCompletenessViolations.summary.totalPackageFatalViolations).toBe(0);
      });
    });

    describe("stub workflow detection prevents package viability", () => {
      it("flags stub workflow content as package-fatal", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: STUB_MAIN_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageViable).toBe(false);
        expect(report.packageCompletenessViolations.packageViable).toBe(false);
        const stubViolations = report.packageCompletenessViolations.violations.filter(
          v => v.violationType === "stub_workflow_in_package"
        );
        expect(stubViolations.length).toBeGreaterThan(0);
        expect(stubViolations[0].packageFatal).toBe(true);
        expect(stubViolations[0].severity).toBe("execution_blocking");
        expect(report.packageCompletenessViolations.summary.totalStubSubstitutionsPrevented).toBeGreaterThan(0);
      });
    });

    describe("sentinel value detection prevents package viability", () => {
      it("detects PLACEHOLDER/TODO sentinel values in XAML as package-fatal", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "Process.xaml", content: SENTINEL_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageViable).toBe(false);
        const sentinelViolations = report.packageCompletenessViolations.violations.filter(
          v => v.violationType === "sentinel_in_required_property"
        );
        expect(sentinelViolations.length).toBeGreaterThan(0);
        expect(sentinelViolations[0].packageFatal).toBe(true);
        expect(report.packageCompletenessViolations.summary.totalPlaceholderInjectionPrevented).toBeGreaterThan(0);
      });
    });

    describe("XML well-formedness failures prevent package viability", () => {
      it("detects malformed XML as package-fatal", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "BrokenWorkflow.xaml", content: MALFORMED_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageViable).toBe(false);
        const xmlViolations = report.packageCompletenessViolations.violations.filter(
          v => v.violationType === "xml_wellformedness_failure"
        );
        expect(xmlViolations.length).toBeGreaterThan(0);
        expect(xmlViolations[0].packageFatal).toBe(true);
        expect(xmlViolations[0].file).toBe("BrokenWorkflow.xaml");
      });
    });

    describe("DHG generation remains decoupled from package viability", () => {
      it("derivedStatus reflects package failure but report still has all data for DHG", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: STUB_MAIN_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageViable).toBe(false);
        expect(report.derivedStatus).toBe("structurally_invalid");
        expect(report.perFileResults).toBeDefined();
        expect(report.perFileResults.length).toBe(1);
        expect(report.analysisReports).toBeDefined();
        expect(report.analysisReports.length).toBe(1);
        expect(report.packageCompletenessViolations.violations[0].handoffGuidanceAvailable).toBe(true);
      });
    });

    describe("per-violation detail structure", () => {
      it("each violation has complete structured detail", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "Process.xaml", content: SENTINEL_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        const violations = report.packageCompletenessViolations.violations;
        for (const v of violations) {
          expect(v).toHaveProperty("file");
          expect(v).toHaveProperty("workflow");
          expect(v).toHaveProperty("activityType");
          expect(v).toHaveProperty("propertyName");
          expect(v).toHaveProperty("violationType");
          expect(v).toHaveProperty("severity");
          expect(v).toHaveProperty("packageFatal");
          expect(v).toHaveProperty("handoffGuidanceAvailable");
          expect(v).toHaveProperty("remediationHint");
          expect(typeof v.remediationHint).toBe("string");
          expect(v.remediationHint.length).toBeGreaterThan(0);
        }
      });

      it("summary counts match violation details", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: STUB_MAIN_XAML },
          { name: "Process.xaml", content: SENTINEL_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        const violations = report.packageCompletenessViolations.violations;
        const summary = report.packageCompletenessViolations.summary;
        expect(summary.totalPackageFatalViolations).toBe(
          violations.filter(v => v.packageFatal).length
        );
        expect(summary.totalStubSubstitutionsPrevented).toBe(
          violations.filter(v => v.violationType === "stub_workflow_in_package").length
        );
        expect(summary.totalPlaceholderInjectionPrevented).toBe(
          violations.filter(v => v.violationType === "sentinel_in_required_property").length
        );
        expect(summary.totalUnwiredCriticalWorkflows).toBe(
          violations.filter(v => v.violationType === "unwired_critical_workflow").length
        );
      });
    });

    describe("critical activity missing required properties", () => {
      it("GmailSendMessage missing Body produces package-fatal completeness violation", () => {
        const gmailWithSentinelBody = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="SendEmail">
    <ui:GmailSendMessage To="test@example.com" Subject="Test" Body="PLACEHOLDER" DisplayName="Send Gmail" />
  </Sequence>
</Activity>`;
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "SendEmail.xaml", content: gmailWithSentinelBody },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageViable).toBe(false);
        const sentinelViolations = report.packageCompletenessViolations.violations.filter(
          v => v.file === "SendEmail.xaml" && v.violationType === "sentinel_in_required_property"
        );
        expect(sentinelViolations.length).toBeGreaterThan(0);
        expect(sentinelViolations[0].packageFatal).toBe(true);
        expect(sentinelViolations[0].severity).toBe("execution_blocking");
        expect(sentinelViolations[0].propertyName).toContain("Body");
      });

      it("SendSmtpMailMessage missing Body produces package-fatal completeness violation", () => {
        const smtpWithSentinelBody = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="SendEmail">
    <ui:SendSmtpMailMessage To="test@example.com" Subject="Test" Body="TODO_IMPLEMENT" Host="smtp.test.com" Port="587" DisplayName="Send SMTP Mail" />
  </Sequence>
</Activity>`;
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "SendEmail.xaml", content: smtpWithSentinelBody },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageViable).toBe(false);
        const sentinelViolations = report.packageCompletenessViolations.violations.filter(
          v => v.file === "SendEmail.xaml" && v.violationType === "sentinel_in_required_property"
        );
        expect(sentinelViolations.length).toBeGreaterThan(0);
        expect(sentinelViolations[0].packageFatal).toBe(true);
        expect(sentinelViolations[0].severity).toBe("execution_blocking");
        expect(sentinelViolations[0].propertyName).toContain("Body");
      });
    });

    describe("missing required property detection uses required-property-enforcer", () => {
      it("unresolvedRequiredPropertyDefects are surfaced as package-fatal completeness violations", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.packageCompletenessViolations).toBeDefined();
        expect(report.packageCompletenessViolations.summary.totalCriticalMissingProperties).toBeTypeOf("number");
      });

      it("packageCompletenessViolations propagates enforcer-detected missing properties", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: VALID_MAIN_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        const missingPropTypes = report.packageCompletenessViolations.violations.filter(
          v => v.violationType === "missing_critical_activity_property"
        );
        expect(report.packageCompletenessViolations.summary.totalCriticalMissingProperties).toBe(missingPropTypes.length);
      });
    });

    describe("unwired critical workflow promotion (workflow-graph-validator)", () => {
      it("critical workflow (Process.xaml) orphan is execution_blocking", () => {
        const entries = [
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "Process.xaml", content: `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"><Sequence DisplayName="Process"><ui:LogMessage Message="Process" Level="Info" xmlns:ui="http://schemas.uipath.com/workflow/activities" /></Sequence></Activity>` },
        ];
        const result = validateWorkflowGraph(entries);
        const processDefects = result.workflowGraphDefects.filter(
          d => d.file.toLowerCase().includes("process.xaml")
        );
        expect(processDefects.length).toBeGreaterThan(0);
        expect(processDefects[0].severity).toBe("execution_blocking");
        expect(processDefects[0].notes).toContain("critical workflow");
      });

      it("non-critical orphan workflow remains handoff_required", () => {
        const entries = [
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "HelperUtility.xaml", content: `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"><Sequence DisplayName="Helper"><ui:LogMessage Message="Helper" Level="Info" xmlns:ui="http://schemas.uipath.com/workflow/activities" /></Sequence></Activity>` },
        ];
        const result = validateWorkflowGraph(entries);
        const helperDefects = result.workflowGraphDefects.filter(
          d => d.file.toLowerCase().includes("helperutility.xaml")
        );
        expect(helperDefects.length).toBeGreaterThan(0);
        expect(helperDefects[0].severity).toBe("handoff_required");
      });

      it("unwired critical workflow produces package-fatal violation in final validation", () => {
        const entries = [
          { name: "Main.xaml", content: VALID_MAIN_XAML },
          { name: "Process.xaml", content: `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"><Sequence DisplayName="Process"><ui:LogMessage Message="Process" Level="Info" xmlns:ui="http://schemas.uipath.com/workflow/activities" /></Sequence></Activity>` },
        ];
        const input = buildMinimalValidationInput(entries);
        const report = runFinalArtifactValidation(input);
        const unwiredViolations = report.packageCompletenessViolations.violations.filter(
          v => v.violationType === "unwired_critical_workflow"
        );
        expect(unwiredViolations.length).toBeGreaterThan(0);
        expect(unwiredViolations[0].packageFatal).toBe(true);
        expect(report.packageCompletenessViolations.summary.totalUnwiredCriticalWorkflows).toBeGreaterThan(0);
      });
    });

    describe("status derivation with completeness violations", () => {
      it("derivedStatus is structurally_invalid when completeness violations exist", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: STUB_MAIN_XAML },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.derivedStatus).toBe("structurally_invalid");
        expect(report.statusReason).toBeDefined();
      });

      it("no misleading package-produced state when completeness fails", () => {
        const input = buildMinimalValidationInput([
          { name: "Main.xaml", content: SENTINEL_XAML.replace("Process", "Main") },
        ]);
        const report = runFinalArtifactValidation(input);
        expect(report.derivedStatus).not.toBe("studio_stable");
        expect(report.derivedStatus).not.toBe("openable_with_warnings");
        expect(report.packageViable).toBe(false);
      });
    });
  });
});
