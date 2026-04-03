import { describe, it, expect } from "vitest";
import {
  canonicalizeInvokeBindings,
  postEmissionInvokeValidator,
  type InvokeSerializationFix,
  type ResidualExpressionSerializationDefect,
} from "../xaml/invoke-binding-canonicalizer";
import {
  validateContractIntegrity,
} from "../xaml/workflow-contract-integrity";
import { runFinalArtifactValidation, type FinalArtifactValidationInput } from "../final-artifact-validation";

function makeMinimalXaml(args: string = "", body: string = ""): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <x:Members>
    ${args}
  </x:Members>
  <Sequence>
    ${body}
  </Sequence>
</Activity>`;
}

function makeInvokeWithAttrsAndArgBlock(
  targetFile: string,
  attrBindings: string,
  argBlockContent: string,
): string {
  const body = argBlockContent
    ? `<ui:InvokeWorkflowFile WorkflowFileName="${targetFile}" DisplayName="Invoke ${targetFile}" ${attrBindings}>
        <ui:InvokeWorkflowFile.Arguments>
          ${argBlockContent}
        </ui:InvokeWorkflowFile.Arguments>
       </ui:InvokeWorkflowFile>`
    : `<ui:InvokeWorkflowFile WorkflowFileName="${targetFile}" DisplayName="Invoke ${targetFile}" ${attrBindings} />`;

  return makeMinimalXaml("", body);
}

function makeInvokeWithOnlyCanonical(
  targetFile: string,
  argBlockContent: string,
): string {
  return makeMinimalXaml("", `<ui:InvokeWorkflowFile WorkflowFileName="${targetFile}" DisplayName="Invoke ${targetFile}">
        <ui:InvokeWorkflowFile.Arguments>
          ${argBlockContent}
        </ui:InvokeWorkflowFile.Arguments>
       </ui:InvokeWorkflowFile>`);
}

describe("Task 426: Invoke Binding Canonicalization", () => {
  describe("canonicalizeInvokeBindings", () => {
    it("canonicalizes attribute-style argument bindings to argument block form", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'in_UserName="[str_User]" in_Password="[str_Pass]"',
            ""
          ),
        },
      ];

      const result = canonicalizeInvokeBindings(entries);

      expect(result.totalCanonicalizations).toBeGreaterThan(0);
      const attrToBlockFixes = result.invokeSerializationFixes.filter(
        f => f.normalizationType === "attr_to_argument_block"
      );
      expect(attrToBlockFixes.length).toBe(2);
      expect(attrToBlockFixes[0].propertyName).toBe("in_UserName");
      expect(attrToBlockFixes[1].propertyName).toBe("in_Password");

      expect(entries[0].content).toContain("InvokeWorkflowFile.Arguments");
      expect(entries[0].content).toContain('x:Key="in_UserName"');
      expect(entries[0].content).toContain('x:Key="in_Password"');
      expect(entries[0].content).not.toMatch(/\bin_UserName\s*=\s*"/);
      expect(entries[0].content).not.toMatch(/\bin_Password\s*=\s*"/);
    });

    it("removes pseudo-properties from invoke activities", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'Then="something" Body="test"',
            '<InArgument x:TypeArguments="x:String" x:Key="in_Value">[str_Value]</InArgument>'
          ),
        },
      ];

      const result = canonicalizeInvokeBindings(entries);

      const pseudoFixes = result.invokeSerializationFixes.filter(
        f => f.normalizationType === "pseudo_property_removal"
      );
      expect(pseudoFixes.length).toBe(2);
      expect(entries[0].content).not.toMatch(/\bThen\s*=\s*"/);
      expect(entries[0].content).not.toMatch(/\bBody\s*=\s*"/);
    });

    it("deduplicates equivalent attribute and body bindings", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'in_Value="[str_Value]"',
            '<InArgument x:TypeArguments="x:String" x:Key="in_Value">[str_Value]</InArgument>'
          ),
        },
      ];

      const result = canonicalizeInvokeBindings(entries);

      const dedupFixes = result.invokeSerializationFixes.filter(
        f => f.normalizationType === "dual_serialization_dedup"
      );
      expect(dedupFixes.length).toBe(1);
      expect(dedupFixes[0].propertyName).toBe("in_Value");
      expect(entries[0].content).not.toMatch(/\bin_Value\s*=\s*"\[str_Value\]"/);
      expect(entries[0].content).toContain('x:Key="in_Value"');
    });

    it("preserves conflicting dual-serialization as structured defect without dropping either value", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'in_Value="[str_Different]"',
            '<InArgument x:TypeArguments="x:String" x:Key="in_Value">[str_Value]</InArgument>'
          ),
        },
      ];

      const originalContent = entries[0].content;
      const result = canonicalizeInvokeBindings(entries);

      const conflictDefects = result.residualExpressionSerializationDefects.filter(
        d => d.defectType === "unresolvable_invoke_conflict"
      );
      expect(conflictDefects.length).toBe(1);
      expect(conflictDefects[0].severity).toBe("handoff_required");
      expect(conflictDefects[0].propertyName).toBe("in_Value");
      expect(entries[0].content).toContain("str_Different");
      expect(entries[0].content).toContain("str_Value");
    });

    it("normalizes JSON expression payloads in invoke bindings", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'in_Level="{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;Info&quot;}"',
            ""
          ),
        },
      ];

      const result = canonicalizeInvokeBindings(entries);

      const jsonFixes = result.invokeSerializationFixes.filter(
        f => f.normalizationType === "json_expression_normalize"
      );
      expect(jsonFixes.length).toBeGreaterThan(0);
    });

    it("passes clean with only canonical binding form", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithOnlyCanonical(
            "Child.xaml",
            '<InArgument x:TypeArguments="x:String" x:Key="in_Value">[str_Value]</InArgument>'
          ),
        },
      ];

      const result = canonicalizeInvokeBindings(entries);

      const attrFixes = result.invokeSerializationFixes.filter(
        f => f.normalizationType === "attr_to_argument_block"
      );
      expect(attrFixes.length).toBe(0);
      expect(result.residualExpressionSerializationDefects.length).toBe(0);
    });

    it("does not silently delete required executable values", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeMinimalXaml("", `
            <ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" DisplayName="Test">
              <ui:InvokeWorkflowFile.Arguments>
                <InArgument x:TypeArguments="x:String" x:Key="in_Important">[critical_value]</InArgument>
              </ui:InvokeWorkflowFile.Arguments>
            </ui:InvokeWorkflowFile>`),
        },
      ];

      const originalContent = entries[0].content;
      canonicalizeInvokeBindings(entries);

      expect(entries[0].content).toContain("in_Important");
      expect(entries[0].content).toContain("critical_value");
    });

    it("normalizes JSON expression payloads in generic executable properties", () => {
      const entries = [
        {
          name: "Test.xaml",
          content: makeMinimalXaml("", `
            <ui:LogMessage Level="Info" Message="{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;Hello World&quot;}" DisplayName="Log" />`),
        },
      ];

      const result = canonicalizeInvokeBindings(entries);

      const jsonFixes = result.invokeSerializationFixes.filter(
        f => f.normalizationType === "json_expression_normalize"
      );
      expect(jsonFixes.length).toBeGreaterThan(0);
      expect(entries[0].content).not.toContain("&quot;type&quot;");
    });
  });

  describe("postEmissionInvokeValidator", () => {
    it("detects surviving pseudo-properties after canonicalization", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeMinimalXaml("", `
            <ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" Then="bad" DisplayName="Test" />`),
        },
      ];

      const defects = postEmissionInvokeValidator(entries);
      const pseudoDefects = defects.filter(d => d.propertyName === "Then");
      expect(pseudoDefects.length).toBe(1);
      expect(pseudoDefects[0].severity).toBe("handoff_required");
    });

    it("reports no defects for clean canonical invoke", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithOnlyCanonical(
            "Child.xaml",
            '<InArgument x:TypeArguments="x:String" x:Key="in_Value">[str_Value]</InArgument>'
          ),
        },
      ];

      const defects = postEmissionInvokeValidator(entries);
      expect(defects.length).toBe(0);
    });
  });

  describe("canonicalization runs before contract integrity", () => {
    it("contract integrity sees post-canonicalization shapes", () => {
      const childXaml = makeMinimalXaml(
        '<x:Property Name="in_UserName" Type="InArgument(x:String)" />',
        '<ui:LogMessage Level="Info" Message="[in_UserName]" />'
      );

      const parentXaml = makeInvokeWithAttrsAndArgBlock(
        "Child.xaml",
        'in_UserName="[str_User]"',
        ""
      );

      const entries = [
        { name: "Main.xaml", content: parentXaml },
        { name: "Child.xaml", content: childXaml },
      ];

      const canonResult = canonicalizeInvokeBindings(entries);
      expect(canonResult.totalCanonicalizations).toBeGreaterThan(0);

      const contractResult = validateContractIntegrity(entries);

      const invalidInvokeDefs = contractResult.contractIntegrityDefects.filter(
        d => d.defectType === "invalid_invoke_serialization"
      );
      expect(invalidInvokeDefs.length).toBe(0);
    });
  });

  describe("regression guard: no alternate binding forms in final XAML", () => {
    it("no attribute-style argument pseudo-properties survive canonicalization", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'in_Name="[str_Name]" out_Result="[str_Result]" Then="oops" Body="bad"',
            ""
          ),
        },
      ];

      canonicalizeInvokeBindings(entries);

      const postDefects = postEmissionInvokeValidator(entries);
      const pseudoDefects = postDefects.filter(
        d => ["Then", "Body", "Catches", "Cases", "Finally", "Else", "Try"].includes(d.propertyName)
      );
      expect(pseudoDefects.length).toBe(0);
    });
  });

  describe("regression guard: converted args vs property binding conflicts", () => {
    it("detects duplicate argument keys when converted and property bindings conflict", () => {
      const entries = [
        {
          name: "Main.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'in_Name="[str_PropertyValue]"',
            '<InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_ConvertedValue]</InArgument>'
          ),
        },
      ];

      canonicalizeInvokeBindings(entries);

      const postDefects = postEmissionInvokeValidator(entries);
      const duplicateDefects = postDefects.filter(
        d => d.propertyName === "in_Name" && d.defectType === "invalid_invoke_serialization"
      );
      expect(duplicateDefects.length).toBeGreaterThan(0);
      expect(duplicateDefects.every(d => d.severity === "handoff_required")).toBe(true);
    });
  });

  describe("FinalQualityReport integration", () => {
    it("includes invokeSerializationFixes and residualExpressionSerializationDefects", () => {
      const mainXaml = makeInvokeWithAttrsAndArgBlock(
        "Child.xaml",
        'in_Value="[str_Value]"',
        ""
      );

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: mainXaml }],
        projectJsonContent: JSON.stringify({
          name: "TestProject",
          dependencies: {},
          schemaVersion: "4.0",
        }),
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          outcomeReport: undefined,
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
          metaValidationFlatStructureWarnings: 0,
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report.invokeSerializationFixes).toBeDefined();
      expect(Array.isArray(report.invokeSerializationFixes)).toBe(true);
      expect(report.residualExpressionSerializationDefects).toBeDefined();
      expect(Array.isArray(report.residualExpressionSerializationDefects)).toBe(true);

      if (report.invokeSerializationFixes.length > 0) {
        const fix = report.invokeSerializationFixes[0];
        expect(fix).toHaveProperty("originalForm");
        expect(fix).toHaveProperty("canonicalizedForm");
        expect(fix).toHaveProperty("normalizationType");
        expect(fix).toHaveProperty("file");
        expect(fix).toHaveProperty("workflow");
        expect(fix).toHaveProperty("activityType");
        expect(fix).toHaveProperty("propertyName");
        expect(fix).toHaveProperty("rationale");
      }
    });

    it("residual defects feed into degradation derivation", () => {
      const mainXaml = makeInvokeWithAttrsAndArgBlock(
        "Child.xaml",
        'in_Value="[str_Different]"',
        '<InArgument x:TypeArguments="x:String" x:Key="in_Value">[str_Value]</InArgument>'
      );

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: mainXaml }],
        projectJsonContent: JSON.stringify({
          name: "TestProject",
          dependencies: {},
          schemaVersion: "4.0",
        }),
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          outcomeReport: undefined,
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
          metaValidationFlatStructureWarnings: 0,
        },
      };

      const report = runFinalArtifactValidation(input);

      const invokeDefects = report.residualExpressionSerializationDefects.filter(
        d => d.defectType === "unresolvable_invoke_conflict" || d.defectType === "invalid_invoke_serialization"
      );
      expect(invokeDefects.length).toBeGreaterThan(0);
      expect(["structurally_invalid", "handoff_only"]).toContain(report.derivedStatus);
    });
  });

  describe("structured diagnostics", () => {
    it("invokeSerializationFixes contains before/after with all required fields", () => {
      const entries = [
        {
          name: "Workflow.xaml",
          content: makeInvokeWithAttrsAndArgBlock(
            "Child.xaml",
            'in_Data="[str_Data]"',
            ""
          ),
        },
      ];

      const result = canonicalizeInvokeBindings(entries);

      expect(result.invokeSerializationFixes.length).toBeGreaterThan(0);
      for (const fix of result.invokeSerializationFixes) {
        expect(fix.originalForm).toBeTruthy();
        expect(fix.canonicalizedForm).toBeTruthy();
        expect(fix.normalizationType).toBeTruthy();
        expect(fix.file).toBeTruthy();
        expect(fix.workflow).toBeTruthy();
        expect(fix.activityType).toBeTruthy();
        expect(fix.propertyName).toBeTruthy();
        expect(fix.rationale).toBeTruthy();
      }
    });
  });
});
