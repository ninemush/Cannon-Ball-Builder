import { describe, it, expect } from "vitest";
import { validateExecutablePaths, type ExecutablePathDefect } from "../xaml/executable-path-validator";
import { runFinalArtifactValidation } from "../final-artifact-validation";
import { makeValidXaml } from "./fixtures/process-specs";

function makeSmtpXaml(toValue: string, ccValue?: string): string {
  const ccAttr = ccValue !== undefined ? ` Cc="${ccValue}"` : "";
  return makeValidXaml("SmtpWorkflow", `
    <ui:SendSmtpMailMessage DisplayName="Send Email" To="${toValue}" Subject="[&quot;Test Subject&quot;]" Body="[&quot;Test Body&quot;]" Host="[&quot;smtp.example.com&quot;]" Port="[25]"${ccAttr} />
  `);
}

function makeAddQueueItemXaml(queueName: string): string {
  return makeValidXaml("QueueWorkflow", `
    <ui:AddQueueItem DisplayName="Add Item" QueueName="${queueName}" ItemInformation="[New Dictionary(Of String, Object)]" />
  `);
}

function makeCreateFormTaskXaml(formData: string): string {
  return makeValidXaml("FormWorkflow", `
    <ui:CreateFormTask DisplayName="Create Task" Title="[&quot;Task Title&quot;]" FormData="${formData}" TaskCatalog="[&quot;MyCatalog&quot;]" />
  `);
}

function makeAssignXaml(toValue: string, assignValue: string): string {
  return makeValidXaml("AssignWorkflow", `
    <Assign DisplayName="Set Variable" To="${toValue}" Value="${assignValue}" />
  `);
}

function makeIfXaml(condition: string): string {
  return makeValidXaml("IfWorkflow", `
    <If DisplayName="Check Condition" Condition="${condition}">
      <If.Then>
        <ui:LogMessage Level="Info" Message="[&quot;True branch&quot;]" DisplayName="Log True" />
      </If.Then>
    </If>
  `);
}

function makeInvokeXaml(fileName: string): string {
  return makeValidXaml("InvokeWorkflow", `
    <ui:InvokeWorkflowFile DisplayName="Invoke Sub" WorkflowFileName="${fileName}" />
  `);
}

describe("executable-path-validator", () => {
  describe("defect class detection", () => {
    it("detects PLACEHOLDER in SendSmtpMailMessage To field as execution_blocking", () => {
      const xaml = makeSmtpXaml("PLACEHOLDER_EMAIL");
      const result = validateExecutablePaths([{ name: "SmtpWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      expect(result.executablePathDefects.length).toBeGreaterThanOrEqual(1);

      const defect = result.executablePathDefects.find(
        d => d.propertyName === "To" && d.defectType === "placeholder"
      );
      expect(defect).toBeDefined();
      expect(defect!.file).toBe("SmtpWorkflow.xaml");
      expect(defect!.workflow).toBe("SmtpWorkflow");
      expect(defect!.activityType).toContain("SendSmtpMailMessage");
      expect(defect!.severity).toBe("execution_blocking");
      expect(defect!.detectionMethod).toBe("regex_pattern");
      expect(defect!.offendingValue).toContain("PLACEHOLDER");
    });

    it("detects TODO marker in AddQueueItem QueueName as execution_blocking", () => {
      const xaml = makeAddQueueItemXaml("TODO: implement this expression");
      const result = validateExecutablePaths([{ name: "QueueWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const defect = result.executablePathDefects.find(
        d => d.propertyName === "QueueName" && d.defectType === "todo_marker"
      );
      expect(defect).toBeDefined();
      expect(defect!.severity).toBe("execution_blocking");
      expect(defect!.detectionMethod).toBe("regex_pattern");
    });

    it("detects leaked JSON expression in CreateFormTask FormData as execution_blocking", () => {
      const leakedJson = '{"type": "string", "value": "test", "kind": "expression"}';
      const escapedJson = leakedJson.replace(/"/g, "&quot;");
      const xaml = makeCreateFormTaskXaml(escapedJson);
      const result = validateExecutablePaths([{ name: "FormWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const defect = result.executablePathDefects.find(
        d => d.propertyName === "FormData" && d.defectType === "leaked_json_expression"
      );
      expect(defect).toBeDefined();
      expect(defect!.severity).toBe("execution_blocking");
      expect(defect!.detectionMethod).toBe("json_structure_analysis");
    });

    it("detects blank Value on Assign as execution_blocking", () => {
      const xaml = makeAssignXaml("[myVar]", "");
      const result = validateExecutablePaths([{ name: "AssignWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const defect = result.executablePathDefects.find(
        d => d.activityType === "Assign" && d.propertyName === "Value" && d.defectType === "blank_required_property"
      );
      expect(defect).toBeDefined();
      expect(defect!.severity).toBe("execution_blocking");
      expect(defect!.detectionMethod).toBe("registry_required_blank");
    });

    it("does not flag complex but valid VB expressions as malformed", () => {
      const xaml = makeIfXaml("[items.Where(Function(x) x.IsActive).Count() > 0]");
      const result = validateExecutablePaths([{ name: "IfWorkflow.xaml", content: xaml }]);

      const malformedDefect = result.executablePathDefects.find(
        d => d.activityType === "If" && d.defectType === "malformed_vb_expression"
      );
      expect(malformedDefect).toBeUndefined();
    });

    it("detects sentinel HANDOFF_ value in InvokeWorkflowFile WorkflowFileName as execution_blocking", () => {
      const xaml = makeInvokeXaml("HANDOFF_WORKFLOW_FILE");
      const result = validateExecutablePaths([{ name: "InvokeWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const defect = result.executablePathDefects.find(
        d => d.propertyName === "WorkflowFileName" && d.defectType === "sentinel_value"
      );
      expect(defect).toBeDefined();
      expect(defect!.severity).toBe("execution_blocking");
      expect(defect!.detectionMethod).toBe("regex_pattern");
      expect(defect!.offendingValue).toContain("HANDOFF_");
    });
  });

  describe("severity classification", () => {
    it("classifies PLACEHOLDER in optional SMTP Cc as handoff_required", () => {
      const xaml = makeSmtpXaml("[&quot;valid@test.com&quot;]", "PLACEHOLDER_CC");
      const result = validateExecutablePaths([{ name: "SmtpWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const ccDefect = result.executablePathDefects.find(
        d => d.propertyName === "Cc" && d.defectType === "placeholder"
      );
      expect(ccDefect).toBeDefined();
      expect(ccDefect!.severity).toBe("handoff_required");
    });

    it("same defect type yields different severities based on property criticality", () => {
      const xaml = makeSmtpXaml("PLACEHOLDER_TO", "PLACEHOLDER_CC");
      const result = validateExecutablePaths([{ name: "SmtpWorkflow.xaml", content: xaml }]);

      const toDefect = result.executablePathDefects.find(
        d => d.propertyName === "To" && d.defectType === "placeholder"
      );
      const ccDefect = result.executablePathDefects.find(
        d => d.propertyName === "Cc" && d.defectType === "placeholder"
      );

      expect(toDefect).toBeDefined();
      expect(ccDefect).toBeDefined();
      expect(toDefect!.severity).toBe("execution_blocking");
      expect(ccDefect!.severity).toBe("handoff_required");
    });
  });

  describe("clean XAML", () => {
    it("produces zero defects for clean XAML with valid expressions", () => {
      const xaml = makeValidXaml("CleanWorkflow", `
        <Assign DisplayName="Set Variable" To="[myVar]" Value="[&quot;Hello World&quot;]" />
        <If DisplayName="Check" Condition="[myVar IsNot Nothing]">
          <If.Then>
            <ui:LogMessage Level="Info" Message="[&quot;All good&quot;]" DisplayName="Log OK" />
          </If.Then>
        </If>
        <ui:InvokeWorkflowFile DisplayName="Invoke Sub" WorkflowFileName="SubWorkflow.xaml" />
      `);
      const result = validateExecutablePaths([{ name: "CleanWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(false);
      expect(result.executablePathDefects).toHaveLength(0);
    });

    it("does not flag DisplayName or annotation attributes", () => {
      const xaml = makeValidXaml("AnnotatedWorkflow", `
        <Assign DisplayName="PLACEHOLDER activity name" sap2010:Annotation.AnnotationText="TODO: update this annotation" To="[myVar]" Value="[&quot;test&quot;]" />
      `);
      const result = validateExecutablePaths([{ name: "AnnotatedWorkflow.xaml", content: xaml }]);

      const displayNameDefect = result.executablePathDefects.find(
        d => d.propertyName === "DisplayName"
      );
      const annotationDefect = result.executablePathDefects.find(
        d => d.propertyName.includes("Annotation")
      );
      expect(displayNameDefect).toBeUndefined();
      expect(annotationDefect).toBeUndefined();
    });

    it("does not flag non-runtime properties that are not in the registry", () => {
      const xaml = makeValidXaml("NonRuntimeWorkflow", `
        <ui:LogMessage Level="Info" Message="[&quot;test&quot;]" DisplayName="Log" SomeCustomProp="PLACEHOLDER_CUSTOM" UnknownField="TODO: fix this" AnotherField="HANDOFF_VALUE" />
      `);
      const result = validateExecutablePaths([{ name: "NonRuntimeWorkflow.xaml", content: xaml }]);

      const customDefect = result.executablePathDefects.find(
        d => d.propertyName === "SomeCustomProp"
      );
      const unknownDefect = result.executablePathDefects.find(
        d => d.propertyName === "UnknownField"
      );
      const anotherDefect = result.executablePathDefects.find(
        d => d.propertyName === "AnotherField"
      );
      expect(customDefect).toBeUndefined();
      expect(unknownDefect).toBeUndefined();
      expect(anotherDefect).toBeUndefined();
    });

    it("does not flag valid complex VB expressions in required executable slots", () => {
      const xaml = makeValidXaml("ComplexExprWorkflow", `
        <If DisplayName="Complex Check" Condition="[items.Where(Function(x) x.Status = &quot;Active&quot;).Count() > 0 AndAlso String.IsNullOrEmpty(str_Result) = False]">
          <If.Then>
            <Assign DisplayName="Set Result" To="[str_Output]" Value="[String.Format(&quot;Found {0} items in {1}&quot;, int_Count, str_Category)]" />
          </If.Then>
        </If>
      `);
      const result = validateExecutablePaths([{ name: "ComplexExprWorkflow.xaml", content: xaml }]);

      const conditionDefect = result.executablePathDefects.find(
        d => d.propertyName === "Condition" && d.defectType === "malformed_vb_expression"
      );
      expect(conditionDefect).toBeUndefined();
    });

    it("does not flag layout metadata or view-state properties", () => {
      const xaml = makeValidXaml("LayoutWorkflow", `
        <Assign DisplayName="Set Var" To="[myVar]" Value="[&quot;ok&quot;]" sap:VirtualizedContainerService.HintSize="PLACEHOLDER_SIZE" sap2010:WorkflowViewState.IdRef="PLACEHOLDER_ID" />
      `);
      const result = validateExecutablePaths([{ name: "LayoutWorkflow.xaml", content: xaml }]);

      const hintDefect = result.executablePathDefects.find(
        d => d.propertyName.includes("HintSize")
      );
      const viewStateDefect = result.executablePathDefects.find(
        d => d.propertyName.includes("WorkflowViewState")
      );
      expect(hintDefect).toBeUndefined();
      expect(viewStateDefect).toBeUndefined();
    });
  });

  describe("defect entry structure", () => {
    it("each defect entry has all required fields", () => {
      const xaml = makeSmtpXaml("PLACEHOLDER_EMAIL");
      const result = validateExecutablePaths([{ name: "SmtpWorkflow.xaml", content: xaml }]);

      expect(result.executablePathDefects.length).toBeGreaterThan(0);
      for (const defect of result.executablePathDefects) {
        expect(defect).toHaveProperty("file");
        expect(defect).toHaveProperty("workflow");
        expect(defect).toHaveProperty("activityType");
        expect(defect).toHaveProperty("propertyName");
        expect(defect).toHaveProperty("defectType");
        expect(defect).toHaveProperty("offendingValue");
        expect(defect).toHaveProperty("severity");
        expect(defect).toHaveProperty("detectionMethod");
        expect(typeof defect.file).toBe("string");
        expect(typeof defect.workflow).toBe("string");
        expect(typeof defect.activityType).toBe("string");
        expect(typeof defect.propertyName).toBe("string");
        expect(typeof defect.defectType).toBe("string");
        expect(typeof defect.severity).toBe("string");
        expect(typeof defect.detectionMethod).toBe("string");
      }
    });
  });

  describe("multiple files", () => {
    it("scans all XAML entries and reports defects across files", () => {
      const xaml1 = makeSmtpXaml("PLACEHOLDER_TO");
      const xaml2 = makeInvokeXaml("STUB_WORKFLOW");
      const result = validateExecutablePaths([
        { name: "Workflow1.xaml", content: xaml1 },
        { name: "Workflow2.xaml", content: xaml2 },
      ]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const files = new Set(result.executablePathDefects.map(d => d.file));
      expect(files.size).toBe(2);
    });
  });

  describe("child-element property detection", () => {
    it("detects defects in child-element argument properties", () => {
      const xaml = makeValidXaml("ChildElemWorkflow", `
        <ui:AddQueueItem DisplayName="Add Queue Item" QueueName="[&quot;TestQueue&quot;]">
          <ui:AddQueueItem.ItemInformation>
            <InArgument x:TypeArguments="s:Object">PLACEHOLDER_ITEM_DATA</InArgument>
          </ui:AddQueueItem.ItemInformation>
        </ui:AddQueueItem>
      `);
      const result = validateExecutablePaths([{ name: "ChildElemWorkflow.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const defect = result.executablePathDefects.find(
        d => d.propertyName === "ItemInformation" && d.defectType === "placeholder"
      );
      expect(defect).toBeDefined();
      expect(defect!.activityType).toContain("AddQueueItem");
      expect(defect!.severity).toBe("execution_blocking");
    });
  });

  describe("integration with final-artifact-validation", () => {
    it("contamination is reported in final quality report", () => {
      const xaml = makeSmtpXaml("PLACEHOLDER_EMAIL");
      const report = runFinalArtifactValidation({
        xamlEntries: [{ name: "SmtpWorkflow.xaml", content: xaml }],
        projectJsonContent: "{}",
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      });

      expect(report.hasExecutablePathContamination).toBe(true);
      expect(report.executablePathDefects.length).toBeGreaterThan(0);
      expect(["handoff_only", "structurally_invalid"]).toContain(report.derivedStatus);
    });

    it("clean XAML does not set contamination flag in final report", () => {
      const xaml = makeValidXaml("CleanWorkflow", `
        <Assign DisplayName="Set Variable" To="[myVar]" Value="[&quot;Hello World&quot;]" />
      `);
      const report = runFinalArtifactValidation({
        xamlEntries: [{ name: "CleanWorkflow.xaml", content: xaml }],
        projectJsonContent: "{}",
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      });

      expect(report.hasExecutablePathContamination).toBe(false);
      expect(report.executablePathDefects).toHaveLength(0);
    });
  });

  describe("sentinel variants", () => {
    it("detects STUB_ sentinel values", () => {
      const xaml = makeInvokeXaml("STUB_GENERATED_FILE");
      const result = validateExecutablePaths([{ name: "Test.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const defect = result.executablePathDefects.find(d => d.defectType === "sentinel_value");
      expect(defect).toBeDefined();
    });

    it("detects ASSEMBLY_FAILED sentinel values", () => {
      const xaml = makeInvokeXaml("ASSEMBLY_FAILED_workflow");
      const result = validateExecutablePaths([{ name: "Test.xaml", content: xaml }]);

      expect(result.hasExecutablePathContamination).toBe(true);
      const defect = result.executablePathDefects.find(d => d.defectType === "sentinel_value");
      expect(defect).toBeDefined();
    });
  });
});
