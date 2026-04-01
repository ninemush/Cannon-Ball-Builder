import { describe, it, expect } from "vitest";
import { XMLValidator } from "fast-xml-parser";
import { buildDeterministicScaffold } from "../deterministic-scaffold";
import { assembleWorkflowFromSpec } from "../workflow-tree-assembler";
import { checkStudioLoadability, resolveDependencies } from "../package-assembler";
import { runQualityGate, type QualityGateInput } from "../uipath-quality-gate";
import { normalizeXaml } from "../xaml/xaml-compliance";
import { scanXamlForRequiredPackages } from "../uipath-activity-registry";
import { metadataService } from "../catalog/metadata-service";
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
});
