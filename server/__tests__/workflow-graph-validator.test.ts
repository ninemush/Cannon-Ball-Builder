import { describe, it, expect } from "vitest";
import { validateWorkflowGraph, type WorkflowGraphValidationResult } from "../xaml/workflow-graph-validator";
import { makeValidXaml } from "./fixtures/process-specs";

function makeXamlWithInvokes(className: string, invokedFiles: string[]): string {
  const invokes = invokedFiles
    .map(f => `<ui:InvokeWorkflowFile DisplayName="Invoke ${f}" WorkflowFileName="${f}" />`)
    .join("\n    ");
  return makeValidXaml(className, invokes);
}

function makeStateMachineMain(stateWorkflows: Record<string, string>): string {
  const states = Object.entries(stateWorkflows)
    .map(([stateName, invokedFile]) => `
      <State DisplayName="${stateName}">
        <State.Entry>
          <ui:InvokeWorkflowFile DisplayName="Run ${stateName}" WorkflowFileName="${invokedFile}" />
        </State.Entry>
        <Transition DisplayName="To Next" />
      </State>`)
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <StateMachine DisplayName="Main State Machine">
    ${states}
  </StateMachine>
</Activity>`;
}

describe("Workflow Graph Validator", () => {
  describe("Clean reachable chain", () => {
    it("reports no defects for a fully connected workflow graph", () => {
      const entries = [
        { name: "Main.xaml", content: makeXamlWithInvokes("Main", ["Child1.xaml"]) },
        { name: "Child1.xaml", content: makeXamlWithInvokes("Child1", ["Child2.xaml"]) },
        { name: "Child2.xaml", content: makeValidXaml("Child2") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(false);
      expect(result.workflowGraphDefects).toHaveLength(0);
      expect(result.workflowGraphSummary.reachableCount).toBe(3);
      expect(result.workflowGraphSummary.unreachableCount).toBe(0);
      expect(result.workflowGraphSummary.brokenReferenceCount).toBe(0);
      expect(result.workflowGraphSummary.rootEntrypoint.file).toBe("Main.xaml");
      expect(result.workflowGraphSummary.rootEntrypoint.resolution).toBe("inferred");
    });
  });

  describe("Orphaned workflow", () => {
    it("detects workflows not reachable from Main.xaml", () => {
      const entries = [
        { name: "Main.xaml", content: makeXamlWithInvokes("Main", ["Child1.xaml"]) },
        { name: "Child1.xaml", content: makeValidXaml("Child1") },
        { name: "Orphan.xaml", content: makeValidXaml("Orphan") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const orphanDefect = result.workflowGraphDefects.find(
        d => d.defectType === "orphan_workflow" && d.file === "Orphan.xaml",
      );
      expect(orphanDefect).toBeTruthy();
      expect(orphanDefect!.severity).toBe("handoff_required");
      expect(result.workflowGraphSummary.unreachableCount).toBe(1);
    });
  });

  describe("Broken InvokeWorkflowFile reference (attribute form)", () => {
    it("detects references to non-existent workflows", () => {
      const entries = [
        { name: "Main.xaml", content: makeXamlWithInvokes("Main", ["NonExistent.xaml"]) },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const missingDefect = result.workflowGraphDefects.find(
        d => d.defectType === "missing_target_workflow",
      );
      expect(missingDefect).toBeTruthy();
      expect(missingDefect!.referencedTarget).toBe("NonExistent.xaml");
      expect(missingDefect!.severity).toBe("execution_blocking");
      expect(result.workflowGraphSummary.brokenReferenceCount).toBe(1);
    });
  });

  describe("Broken InvokeWorkflowFile reference (element form)", () => {
    it("detects element-form serialized references to missing workflows", () => {
      const mainContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <ui:InvokeWorkflowFile DisplayName="Invoke Missing">
      <ui:InvokeWorkflowFile.WorkflowFileName>ElementFormMissing.xaml</ui:InvokeWorkflowFile.WorkflowFileName>
    </ui:InvokeWorkflowFile>
  </Sequence>
</Activity>`;

      const entries = [
        { name: "Main.xaml", content: mainContent },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const missingDefect = result.workflowGraphDefects.find(
        d => d.defectType === "missing_target_workflow" && d.referencedTarget === "ElementFormMissing.xaml",
      );
      expect(missingDefect).toBeTruthy();
    });
  });

  describe("Unparseable target workflow", () => {
    it("detects references containing expressions or malformed paths", () => {
      const mainContent = makeValidXaml("Main",
        `<ui:InvokeWorkflowFile DisplayName="Invoke Dynamic" WorkflowFileName="[New String(&quot;test&quot;)]" />`
      );

      const entries = [
        { name: "Main.xaml", content: mainContent },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const unparseableDefect = result.workflowGraphDefects.find(
        d => d.defectType === "unparseable_target_workflow",
      );
      expect(unparseableDefect).toBeTruthy();
      expect(unparseableDefect!.severity).toBe("execution_blocking");
    });
  });

  describe("REFramework missing state workflow (structural detection)", () => {
    it("detects missing REFramework workflows via state-machine analysis", () => {
      const mainXaml = makeStateMachineMain({
        "Initialization": "Init.xaml",
        "Get Transaction Data": "GetTransactionData.xaml",
        "Process Transaction": "Process.xaml",
        "Set Transaction Status": "SetTransactionStatus.xaml",
        "End Process": "EndProcess.xaml",
      });

      const entries = [
        { name: "Main.xaml", content: mainXaml },
        { name: "Init.xaml", content: makeValidXaml("Init") },
        { name: "GetTransactionData.xaml", content: makeValidXaml("GetTransactionData") },
        { name: "Process.xaml", content: makeValidXaml("Process") },
        { name: "SetTransactionStatus.xaml", content: makeValidXaml("SetTransactionStatus") },
        { name: "EndProcess.xaml", content: makeValidXaml("EndProcess") },
      ];

      const result = validateWorkflowGraph(entries);

      const reframeworkDefects = result.workflowGraphDefects.filter(
        d => d.defectType === "reframework_wiring_inconsistency",
      );
      expect(reframeworkDefects.length).toBeGreaterThan(0);
      const missingWorkflows = reframeworkDefects
        .filter(d => d.referencedTarget !== null)
        .map(d => d.referencedTarget);
      expect(missingWorkflows.some(t => t?.includes("InitAllSettings"))).toBe(true);
    });
  });

  describe("Decomposed-but-unwired workflow", () => {
    it("detects workflows matching decomposition patterns but not wired", () => {
      const entries = [
        { name: "Main.xaml", content: makeXamlWithInvokes("Main", ["Child.xaml"]) },
        { name: "Child.xaml", content: makeValidXaml("Child") },
        { name: "Dispatcher.xaml", content: makeValidXaml("Dispatcher") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const decomposedDefect = result.workflowGraphDefects.find(
        d => d.defectType === "decomposed_unwired_workflow" && d.file === "Dispatcher.xaml",
      );
      expect(decomposedDefect).toBeTruthy();
      expect(decomposedDefect!.severity).toBe("handoff_required");
    });
  });

  describe("Ambiguous reference", () => {
    it("detects when multiple files share the same basename", () => {
      const entries = [
        { name: "Main.xaml", content: makeXamlWithInvokes("Main", ["Helper.xaml"]) },
        { name: "sub1/Helper.xaml", content: makeValidXaml("Helper") },
        { name: "sub2/Helper.xaml", content: makeValidXaml("Helper") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const ambiguousDefect = result.workflowGraphDefects.find(
        d => d.defectType === "ambiguous_target_reference",
      );
      expect(ambiguousDefect).toBeTruthy();
    });
  });

  describe("Non-executable files routed to exclusions", () => {
    it("excludes DHG artifacts from defects and reports them as exclusions", () => {
      const entries = [
        { name: "Main.xaml", content: makeValidXaml("Main") },
        { name: "report.dhg.xaml", content: "DHG content" },
        { name: "dhg-summary.xaml", content: "DHG_ARTIFACT content" },
        { name: "template-base.xaml", content: "TEMPLATE_FILE content" },
        { name: "readme.md", content: "documentation" },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.workflowGraphSummary.exclusions.length).toBe(4);

      const dhgExclusions = result.workflowGraphSummary.exclusions.filter(
        e => e.reason === "dhg_artifact",
      );
      expect(dhgExclusions.length).toBe(2);

      const templateExclusions = result.workflowGraphSummary.exclusions.filter(
        e => e.reason === "template_file",
      );
      expect(templateExclusions.length).toBe(1);

      const nonExecExclusions = result.workflowGraphSummary.exclusions.filter(
        e => e.reason === "non_executable_support",
      );
      expect(nonExecExclusions.length).toBe(1);

      const defectFiles = result.workflowGraphDefects.map(d => d.file);
      expect(defectFiles).not.toContain("report.dhg.xaml");
      expect(defectFiles).not.toContain("dhg-summary.xaml");
      expect(defectFiles).not.toContain("template-base.xaml");
      expect(defectFiles).not.toContain("readme.md");
    });
  });

  describe("Path normalization edge cases", () => {
    it("resolves backslash paths in references", () => {
      const mainContent = makeValidXaml("Main",
        `<ui:InvokeWorkflowFile DisplayName="Invoke Sub" WorkflowFileName="Workflows\\SubProcess.xaml" />`
      );

      const entries = [
        { name: "Main.xaml", content: mainContent },
        { name: "Workflows/SubProcess.xaml", content: makeValidXaml("SubProcess") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.workflowGraphSummary.brokenReferenceCount).toBe(0);
      expect(result.workflowGraphSummary.reachableCount).toBe(2);
    });

    it("resolves relative prefix paths", () => {
      const mainContent = makeValidXaml("Main",
        `<ui:InvokeWorkflowFile DisplayName="Invoke Sub" WorkflowFileName=".\\SubProcess.xaml" />`
      );

      const entries = [
        { name: "Main.xaml", content: mainContent },
        { name: "SubProcess.xaml", content: makeValidXaml("SubProcess") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.workflowGraphSummary.brokenReferenceCount).toBe(0);
      expect(result.workflowGraphSummary.reachableCount).toBe(2);
    });

    it("resolves case-insensitive references", () => {
      const mainContent = makeXamlWithInvokes("Main", ["SUBPROCESS.XAML"]);

      const entries = [
        { name: "Main.xaml", content: mainContent },
        { name: "SubProcess.xaml", content: makeValidXaml("SubProcess") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.workflowGraphSummary.brokenReferenceCount).toBe(0);
      expect(result.workflowGraphSummary.reachableCount).toBe(2);
    });

    it("resolves references without .xaml extension", () => {
      const mainContent = makeValidXaml("Main",
        `<ui:InvokeWorkflowFile DisplayName="Invoke Sub" WorkflowFileName="SubProcess" />`
      );

      const entries = [
        { name: "Main.xaml", content: mainContent },
        { name: "SubProcess.xaml", content: makeValidXaml("SubProcess") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.workflowGraphSummary.brokenReferenceCount).toBe(0);
      expect(result.workflowGraphSummary.reachableCount).toBe(2);
    });
  });

  describe("Clean graph passes with no issues", () => {
    it("returns hasWorkflowGraphIntegrityIssues: false for a clean graph", () => {
      const entries = [
        { name: "Main.xaml", content: makeXamlWithInvokes("Main", ["Step1.xaml", "Step2.xaml"]) },
        { name: "Step1.xaml", content: makeXamlWithInvokes("Step1", ["Shared.xaml"]) },
        { name: "Step2.xaml", content: makeXamlWithInvokes("Step2", ["Shared.xaml"]) },
        { name: "Shared.xaml", content: makeValidXaml("Shared") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(false);
      expect(result.workflowGraphDefects).toHaveLength(0);
      expect(result.workflowGraphSummary.reachableCount).toBe(4);
      expect(result.workflowGraphSummary.unreachableCount).toBe(0);
      expect(result.workflowGraphSummary.brokenReferenceCount).toBe(0);
      expect(result.workflowGraphSummary.ambiguousReferenceCount).toBe(0);
    });
  });

  describe("Root entrypoint missing", () => {
    it("detects when Main.xaml is absent", () => {
      const entries = [
        { name: "Process.xaml", content: makeValidXaml("Process") },
        { name: "Helper.xaml", content: makeValidXaml("Helper") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const rootDefect = result.workflowGraphDefects.find(
        d => d.defectType === "root_entrypoint_missing",
      );
      expect(rootDefect).toBeTruthy();
      expect(rootDefect!.severity).toBe("execution_blocking");
    });
  });

  describe("Graph discontinuity", () => {
    it("detects disconnected components in the workflow graph", () => {
      const entries = [
        { name: "Main.xaml", content: makeXamlWithInvokes("Main", ["Connected.xaml"]) },
        { name: "Connected.xaml", content: makeValidXaml("Connected") },
        { name: "IslandA.xaml", content: makeXamlWithInvokes("IslandA", ["IslandB.xaml"]) },
        { name: "IslandB.xaml", content: makeXamlWithInvokes("IslandB", ["IslandA.xaml"]) },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(true);
      const discontinuityDefect = result.workflowGraphDefects.find(
        d => d.defectType === "graph_discontinuity",
      );
      expect(discontinuityDefect).toBeTruthy();
      expect(result.workflowGraphSummary.unreachableCount).toBe(2);
    });
  });

  describe("Single Main.xaml only", () => {
    it("validates clean with just Main.xaml and no invocations", () => {
      const entries = [
        { name: "Main.xaml", content: makeValidXaml("Main") },
      ];

      const result = validateWorkflowGraph(entries);

      expect(result.hasWorkflowGraphIntegrityIssues).toBe(false);
      expect(result.workflowGraphDefects).toHaveLength(0);
      expect(result.workflowGraphSummary.reachableCount).toBe(1);
    });
  });
});
