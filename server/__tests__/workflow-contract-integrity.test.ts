import { describe, it, expect } from "vitest";
import {
  validateContractIntegrity,
  type ContractIntegrityDefect,
  type ContractNormalizationAction,
  type ContractExtractionExclusion,
} from "../xaml/workflow-contract-integrity";
import { runFinalArtifactValidation, type FinalArtifactValidationInput } from "../final-artifact-validation";
import type { InvokeSerializationFix } from "../xaml/invoke-binding-canonicalizer";

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

function makeMainWithInvoke(
  targetFile: string,
  argBindings: string = "",
  attrBindings: string = "",
): string {
  const body = argBindings
    ? `<ui:InvokeWorkflowFile WorkflowFileName="${targetFile}" ${attrBindings}>
        <ui:InvokeWorkflowFile.Arguments>
          ${argBindings}
        </ui:InvokeWorkflowFile.Arguments>
       </ui:InvokeWorkflowFile>`
    : `<ui:InvokeWorkflowFile WorkflowFileName="${targetFile}" ${attrBindings} />`;

  return makeMinimalXaml("", body);
}

describe("workflow-contract-integrity", () => {
  describe("parent-child contract validation", () => {
    it("detects invoke binding referencing nonexistent child argument", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_ValidArg" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_ValidArg]" />`
      );
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_NonExistentArg">[str_Value]</InArgument>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      expect(result.hasContractIntegrityIssues).toBe(true);
      const unknownArgDefect = result.contractIntegrityDefects.find(
        d => d.defectType === "unknown_target_argument"
      );
      expect(unknownArgDefect).toBeDefined();
      expect(unknownArgDefect!.targetArgument).toBe("in_NonExistentArg");
      expect(unknownArgDefect!.severity).toBe("execution_blocking");
    });

    it("detects child requiring argument caller doesn't provide", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_RequiredArg" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_RequiredArg]" />`
      );
      const parent = makeMainWithInvoke("Child.xaml");

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      expect(result.hasContractIntegrityIssues).toBe(true);
      const missingArgDefect = result.contractIntegrityDefects.find(
        d => d.defectType === "missing_required_target_argument"
      );
      expect(missingArgDefect).toBeDefined();
      expect(missingArgDefect!.targetArgument).toBe("in_RequiredArg");
      expect(missingArgDefect!.severity).toBe("handoff_required");
    });

    it("detects decomposed_workflow_missing_contract when target not in archive", () => {
      const parent = makeMainWithInvoke(
        "MissingWorkflow.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_SomeArg">[str_Value]</InArgument>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
      ]);

      expect(result.hasContractIntegrityIssues).toBe(true);
      const missingContract = result.contractIntegrityDefects.find(
        d => d.defectType === "decomposed_workflow_missing_contract"
      );
      expect(missingContract).toBeDefined();
    });

    it("detects invoke argument binding direction mismatch", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<OutArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Value]</OutArgument>`
      );
      const parentWithVar = parent.replace(
        "<Sequence>",
        `<Sequence><Sequence.Variables><Variable x:TypeArguments="x:String" Name="str_Value" /></Sequence.Variables>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parentWithVar },
        { name: "Child.xaml", content: child },
      ]);

      expect(result.hasContractIntegrityIssues).toBe(true);
      const mismatchDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "invoke_argument_binding_mismatch"
      );
      expect(mismatchDefects.length).toBeGreaterThan(0);
      expect(mismatchDefects[0].severity).toBe("execution_blocking");
      expect(mismatchDefects[0].targetArgument).toBe("in_Name");
    });

    it("clean parent/child contract pass", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />
         <x:Property Name="out_Result" Type="OutArgument(x:String)" />`,
        `<Assign>
           <Assign.To><OutArgument x:TypeArguments="x:String">[out_Result]</OutArgument></Assign.To>
           <Assign.Value><InArgument x:TypeArguments="x:String">[in_Name]</InArgument></Assign.Value>
         </Assign>`
      );
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_Name">["John"]</InArgument>
         <OutArgument x:TypeArguments="x:String" x:Key="out_Result">[str_Result]</OutArgument>`
      );

      const parentWithVar = parent.replace(
        "<Sequence>",
        `<Sequence><Sequence.Variables><Variable x:TypeArguments="x:String" Name="str_Result" /></Sequence.Variables>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parentWithVar },
        { name: "Child.xaml", content: child },
      ]);

      const contractDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" ||
             d.defectType === "missing_required_target_argument" ||
             d.defectType === "invoke_argument_binding_mismatch"
      );
      expect(contractDefects.length).toBe(0);
    });
  });

  describe("scope and symbol reference validation", () => {
    it("detects expression referencing undeclared variable", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="[str_UndeclaredVar]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const undeclaredVarDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "undeclared_variable_reference"
      );
      expect(undeclaredVarDefects.length).toBeGreaterThan(0);
    });

    it("detects expression referencing undeclared argument", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="[in_MissingArg]" />`
      );
      const withVars = workflow.replace(
        "<Sequence>",
        `<Sequence><Sequence.Variables><Variable x:TypeArguments="x:String" Name="str_Output" /></Sequence.Variables>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: withVars },
      ]);

      const undeclaredDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "undeclared_argument_reference"
      );
      expect(undeclaredDefects.length).toBeGreaterThan(0);
      expect(undeclaredDefects[0].referencedSymbol).toBe("in_MissingArg");
    });

    it("detects scope shadowing (same variable declared at multiple scope levels)", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Sequence>
           <Sequence.Variables>
             <Variable x:TypeArguments="x:String" Name="str_SharedVar" />
           </Sequence.Variables>
           <Sequence>
             <Sequence.Variables>
               <Variable x:TypeArguments="x:String" Name="str_SharedVar" />
             </Sequence.Variables>
             <Assign To="[str_SharedVar]" Value="&quot;inner&quot;" />
           </Sequence>
         </Sequence>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const scopeDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "invalid_expression_scope"
      );
      expect(scopeDefects.length).toBeGreaterThan(0);
      expect(scopeDefects[0].referencedSymbol).toBe("str_SharedVar");
    });

    it("clean scoped references pass", () => {
      const workflow = makeMinimalXaml(
        `<x:Property Name="in_InputArg" Type="InArgument(x:String)" />`,
        `<Sequence>
           <Sequence.Variables>
             <Variable x:TypeArguments="x:String" Name="str_LocalVar" />
           </Sequence.Variables>
           <Assign To="[str_LocalVar]" Value="[in_InputArg]" />
         </Sequence>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const scopeDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "undeclared_variable_reference" ||
             d.defectType === "undeclared_argument_reference"
      );
      expect(scopeDefects.length).toBe(0);
    });
  });

  describe("mixed literal/expression syntax detection", () => {
    it("detects mixed literal/expression syntax", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:LogMessage Level="Info" Message="Hello [str_Name] World" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const mixedDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "mixed_literal_expression_syntax"
      );
      expect(mixedDefects.length).toBeGreaterThan(0);
      expect(mixedDefects[0].severity).toBe("handoff_required");
    });

    it("does not flag properly quoted strings", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:LogMessage Level="Info" Message="&quot;Hello World&quot;" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const mixedDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "mixed_literal_expression_syntax"
      );
      expect(mixedDefects.length).toBe(0);
    });
  });

  describe("placeholder sentinel detection", () => {
    it("detects PLACEHOLDER in required property", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="PLACEHOLDER_VALUE" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const placeholderDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "placeholder_sentinel_in_property"
      );
      expect(placeholderDefects.length).toBeGreaterThan(0);
      // Severity is preserved; Task #527 RC5 adds origin tagging so the
      // final-artifact verdict can exclude pipeline-fallback defects from
      // the structurally_invalid count without losing the severity signal.
      expect(placeholderDefects[0].severity).toBe("execution_blocking");
      expect(placeholderDefects[0].origin).toBe("pipeline-fallback");
    });

    it("detects TODO sentinel", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="TODO implement this" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const sentinelDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "placeholder_sentinel_in_property"
      );
      expect(sentinelDefects.length).toBeGreaterThan(0);
    });

    it("detects HANDOFF sentinel", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="HANDOFF_MANUAL_REVIEW" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const sentinelDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "placeholder_sentinel_in_property"
      );
      expect(sentinelDefects.length).toBeGreaterThan(0);
    });

    it("detects STUB sentinel", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="STUB_BLOCKING_FALLBACK" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const sentinelDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "placeholder_sentinel_in_property"
      );
      expect(sentinelDefects.length).toBeGreaterThan(0);
    });
  });

  describe("invoke serialization validation", () => {
    it("detects pseudo-property on InvokeWorkflow (generic invocation support)", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflow WorkflowFileName="Child.xaml" Then="some value" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const pseudoDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "invalid_invoke_serialization" && d.activityType === "InvokeWorkflow"
      );
      expect(pseudoDefects.length).toBeGreaterThan(0);
    });

    it("detects missing contract for no-binding invocations", () => {
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="MissingWorkflow.xaml" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
      ]);

      const missingContract = result.contractIntegrityDefects.find(
        d => d.defectType === "decomposed_workflow_missing_contract"
      );
      expect(missingContract).toBeDefined();
      expect(missingContract!.severity).toBe("handoff_required");
    });

    it("detects pseudo-property on InvokeWorkflowFile as invalid_invoke_serialization", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" Then="some value" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const pseudoDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "invalid_invoke_serialization"
      );
      expect(pseudoDefects.length).toBeGreaterThan(0);
      expect(pseudoDefects[0].severity).toBe("execution_blocking");
    });

    it("detects invalid argument map serialization (missing x:Key)", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String">["value"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const mapDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "invalid_argument_map_serialization"
      );
      expect(mapDefects.length).toBeGreaterThan(0);
      expect(mapDefects[0].severity).toBe("execution_blocking");
    });

    it("detects invalid argument map serialization (missing x:TypeArguments)", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:Key="in_Name">["value"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const mapDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "invalid_argument_map_serialization"
      );
      expect(mapDefects.length).toBeGreaterThan(0);
      expect(mapDefects[0].propertyName).toBe("in_Name");
    });

    it("detects non-equivalent attribute+body conflict as execution_blocking", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" in_Name="[str_ValueA]">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_ValueB]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const conflictDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "conflicting_argument_serialization" && d.propertyName === "in_Name"
      );
      expect(conflictDefects.length).toBeGreaterThan(0);
      expect(conflictDefects[0].severity).toBe("execution_blocking");
    });

    it("detects duplicate/conflicting invoke argument serialization", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["John"]</InArgument>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["Jane"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const conflictDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "conflicting_argument_serialization"
      );
      expect(conflictDefects.length).toBeGreaterThan(0);
      expect(conflictDefects[0].severity).toBe("execution_blocking");
    });
  });

  describe("normalization allowlist enforcement", () => {
    it("only applies normalizations from the allowlist", () => {
      const result = validateContractIntegrity([
        { name: "Main.xaml", content: makeMinimalXaml("", `<ui:LogMessage Level="Info" Message="Hello" />`) },
      ]);

      for (const norm of result.contractNormalizationActions) {
        expect(["canonicalize_invoke_binding", "remove_duplicate_conflicting_serialization", "normalize_quoting_wrapping"]).toContain(norm.normalizationType);
      }
    });

    it("each normalization emits a structured record", () => {
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_Name">["John"]</InArgument>`,
        `in_Name="[str_Value]"`
      );
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      for (const norm of result.contractNormalizationActions) {
        expect(norm.beforeValue).toBeDefined();
        expect(norm.afterValue).toBeDefined();
        expect(norm.normalizationType).toBeDefined();
        expect(norm.file).toBeDefined();
        expect(norm.workflow).toBeDefined();
        expect(norm.property).toBeDefined();
        expect(norm.rationale).toBeDefined();
      }
    });
  });

  describe("defect persistence after normalization", () => {
    it("original defects remain in diagnostics even when normalization succeeds", () => {
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Value]</InArgument>`,
        `in_Name="[str_Value]"`
      );
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      expect(result.contractNormalizationActions.length).toBeGreaterThan(0);
      const normalizedProperties = result.contractNormalizationActions.map(n => n.property);
      for (const prop of normalizedProperties) {
        const relatedDefects = result.contractIntegrityDefects.filter(
          d => d.propertyName === prop || d.targetArgument === prop
        );
        expect(relatedDefects.length).toBeGreaterThan(0);
      }
      expect(result.hasContractIntegrityIssues).toBe(true);
    });
  });

  describe("no-silent-success rule", () => {
    it("normalization-required runs are not reported as perfectly clean", () => {
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Value]</InArgument>`,
        `in_Name="[str_Value]"`
      );
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      expect(result.contractNormalizationActions.length).toBeGreaterThan(0);
      expect(result.hasContractIntegrityIssues).toBe(true);
    });
  });

  describe("no silent deletion or fabrication", () => {
    it("does not invent missing symbols", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Missing]" Value="[str_AlsoMissing]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const fabricationNorms = result.contractNormalizationActions.filter(
        n => n.rationale.includes("invent") || n.rationale.includes("fabricat")
      );
      expect(fabricationNorms.length).toBe(0);
    });

    it("does not silently strip defects", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="PLACEHOLDER_VALUE" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      expect(result.contractIntegrityDefects.length).toBeGreaterThan(0);
      expect(result.hasContractIntegrityIssues).toBe(true);
    });
  });

  describe("defect structure completeness", () => {
    it("every defect has all required fields", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="PLACEHOLDER_VALUE" />
         <ui:InvokeWorkflowFile WorkflowFileName="Missing.xaml" Then="bad" />
         <ui:LogMessage Level="Info" Message="[in_UndeclaredArg]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      for (const defect of result.contractIntegrityDefects) {
        expect(defect.file).toBeDefined();
        expect(defect.workflow).toBeDefined();
        expect(defect.defectType).toBeDefined();
        expect(defect.activityType).toBeDefined();
        expect(typeof defect.propertyName).toBe("string");
        expect(typeof defect.referencedSymbol).toBe("string");
        expect(typeof defect.targetWorkflow).toBe("string");
        expect(typeof defect.targetArgument).toBe("string");
        expect(typeof defect.offendingValue).toBe("string");
        expect(["execution_blocking", "handoff_required"]).toContain(defect.severity);
        expect(defect.detectionMethod).toBeDefined();
        expect(defect.notes).toBeDefined();
      }
    });
  });

  describe("canonicalize_invoke_binding normalization", () => {
    it("canonicalizes attribute-style binding to argument block form", () => {
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" in_Name="[str_Value]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
      ]);

      const canonNorms = result.contractNormalizationActions.filter(
        n => n.normalizationType === "canonicalize_invoke_binding"
      );
      expect(canonNorms.length).toBeGreaterThan(0);
      expect(canonNorms[0].property).toBe("in_Name");
      expect(canonNorms[0].afterValue).toContain("InArgument");
      expect(canonNorms[0].afterValue).toContain('x:Key="in_Name"');

      const relatedDefects = result.contractIntegrityDefects.filter(
        d => d.propertyName === "in_Name" && d.defectType === "conflicting_argument_serialization"
      );
      expect(relatedDefects.length).toBeGreaterThan(0);
    });
  });

  describe("FinalQualityReport integration", () => {
    function makeMinimalProjectJson(): string {
      return JSON.stringify({
        name: "TestProject",
        projectVersion: "1.0.0",
        description: "Test",
        main: "Main.xaml",
        dependencies: {
          "UiPath.System.Activities": "[23.10.0]",
          "UiPath.UIAutomation.Activities": "[23.10.0]",
        },
        targetFramework: "Windows",
        schemaVersion: "4.0",
      });
    }

    it("contract integrity fields appear in FinalQualityReport", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="PLACEHOLDER_VALUE" />`
      );

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: workflow }],
        projectJsonContent: makeMinimalProjectJson(),
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report).toHaveProperty("contractIntegrityDefects");
      expect(report).toHaveProperty("hasContractIntegrityIssues");
      expect(report).toHaveProperty("contractNormalizationActions");
      expect(Array.isArray(report.contractIntegrityDefects)).toBe(true);
      expect(Array.isArray(report.contractNormalizationActions)).toBe(true);
    });

    it("contract integrity defects affect report status", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="PLACEHOLDER_VALUE" />
         <ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" Then="bad_value" />`
      );

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: workflow }],
        projectJsonContent: makeMinimalProjectJson(),
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report.hasContractIntegrityIssues).toBe(true);
      expect(report.contractIntegrityDefects.length).toBeGreaterThan(0);
    });

    it("normalization-required run populates invoke serialization fixes in report", () => {
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Value]</InArgument>`,
        `in_Name="[str_Value]"`
      );
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );

      const input: FinalArtifactValidationInput = {
        xamlEntries: [
          { name: "Main.xaml", content: parent },
          { name: "Child.xaml", content: child },
        ],
        projectJsonContent: makeMinimalProjectJson(),
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report.invokeSerializationFixes.length).toBeGreaterThan(0);
      const dedupFixes = report.invokeSerializationFixes.filter(
        (f: InvokeSerializationFix) => f.normalizationType === "dual_serialization_dedup"
      );
      expect(dedupFixes.length).toBeGreaterThan(0);
    });

    it("FinalQualityReport exposes contractExtractionExclusions", () => {
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap2010:WorkflowViewState.IdRef="InvokeWF_1" in_Name="[str_Value]">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Value]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );

      const input: FinalArtifactValidationInput = {
        xamlEntries: [
          { name: "Main.xaml", content: parent },
          { name: "Child.xaml", content: child },
        ],
        projectJsonContent: makeMinimalProjectJson(),
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report).toHaveProperty("contractExtractionExclusions");
      expect(Array.isArray(report.contractExtractionExclusions)).toBe(true);
      expect(report).toHaveProperty("contractIntegritySummaryMetrics");
    });
  });

  describe("non-contract property exclusion", () => {
    it("excludes designer metadata (sap2010:WorkflowViewState.IdRef) from contract matching", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap2010:WorkflowViewState.IdRef="InvokeWF_1">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["test"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      const unknownArgDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" && d.propertyName.includes("WorkflowViewState")
      );
      expect(unknownArgDefects.length).toBe(0);

      const exclusions = result.contractExtractionExclusions.filter(
        e => e.propertyName.includes("WorkflowViewState")
      );
      expect(exclusions.length).toBeGreaterThan(0);
      expect(exclusions[0].exclusionCategory).toBe("view_state");
    });

    it("excludes VirtualizedContainerService.HintSize from contract matching", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap:VirtualizedContainerService.HintSize="200,100">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["test"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      const unknownArgDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" && d.propertyName.includes("HintSize")
      );
      expect(unknownArgDefects.length).toBe(0);

      const exclusions = result.contractExtractionExclusions.filter(
        e => e.propertyName.includes("HintSize") || e.propertyName.includes("VirtualizedContainerService")
      );
      expect(exclusions.length).toBeGreaterThan(0);
      expect(exclusions[0].exclusionCategory).toBe("layout_hint");
    });

    it("excludes annotation fields from contract matching", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap2010:Annotation.AnnotationText="some note">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["test"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      const unknownArgDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" && d.propertyName.includes("Annotation")
      );
      expect(unknownArgDefects.length).toBe(0);

      const exclusions = result.contractExtractionExclusions.filter(
        e => e.propertyName.includes("Annotation")
      );
      expect(exclusions.length).toBeGreaterThan(0);
      expect(exclusions[0].exclusionCategory).toBe("annotation");
    });

    it("true unknown child argument still triggers unknown_target_argument", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_ValidArg" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_ValidArg]" />`
      );
      const parent = makeMainWithInvoke(
        "Child.xaml",
        `<InArgument x:TypeArguments="x:String" x:Key="in_TrulyNonexistent">[str_Value]</InArgument>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      const unknownArgDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" && d.targetArgument === "in_TrulyNonexistent"
      );
      expect(unknownArgDefects.length).toBeGreaterThan(0);
      expect(unknownArgDefects[0].severity).toBe("execution_blocking");
    });

    it("malformed invoke serialization triggers invalid_invoke_serialization", () => {
      const workflow = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" Then="some value" Body="another" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const invSerDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "invalid_invoke_serialization"
      );
      expect(invSerDefects.length).toBeGreaterThan(0);
      expect(invSerDefects[0].severity).toBe("execution_blocking");
    });

    it("undeclared variable/argument defects still fire", () => {
      const workflow = makeMinimalXaml(
        "",
        `<Assign To="[str_Output]" Value="[str_UndeclaredVar]" />
         <ui:LogMessage Level="Info" Message="[in_MissingArg]" />`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: workflow },
      ]);

      const undeclaredDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "undeclared_variable_reference" || d.defectType === "undeclared_argument_reference"
      );
      expect(undeclaredDefects.length).toBeGreaterThan(0);
    });

    it("summary metrics reflect exclusions separately from defects", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap2010:WorkflowViewState.IdRef="InvokeWF_1" sap:VirtualizedContainerService.HintSize="200,100">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["test"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      expect(result.contractIntegritySummaryMetrics).toBeDefined();
      expect(result.contractIntegritySummaryMetrics!.totalExcludedNonContractFields).toBeGreaterThan(0);
      expect(result.contractExtractionExclusions.length).toBe(
        result.contractIntegritySummaryMetrics!.totalExcludedNonContractFields
      );

      const viewStateExclusions = result.contractIntegritySummaryMetrics!.exclusionsByCategory.view_state;
      const layoutExclusions = result.contractIntegritySummaryMetrics!.exclusionsByCategory.layout_hint;
      expect(viewStateExclusions + layoutExclusions).toBeGreaterThan(0);
    });

    it("mixed real-plus-metadata regression: real bindings participate, metadata excluded", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />
         <x:Property Name="out_Result" Type="OutArgument(x:String)" />`,
        `<Assign>
           <Assign.To><OutArgument x:TypeArguments="x:String">[out_Result]</OutArgument></Assign.To>
           <Assign.Value><InArgument x:TypeArguments="x:String">[in_Name]</InArgument></Assign.Value>
         </Assign>`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap2010:WorkflowViewState.IdRef="InvokeWF_1" sap:VirtualizedContainerService.HintSize="300,200">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["John"]</InArgument>
             <OutArgument x:TypeArguments="x:String" x:Key="out_Result">[str_Result]</OutArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );
      const parentWithVar = parent.replace(
        "<Sequence>",
        `<Sequence><Sequence.Variables><Variable x:TypeArguments="x:String" Name="str_Result" /></Sequence.Variables>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parentWithVar },
        { name: "Child.xaml", content: child },
      ]);

      const unknownArgFromMetadata = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" &&
             (d.propertyName.includes("WorkflowViewState") || d.propertyName.includes("HintSize") || d.propertyName.includes("VirtualizedContainerService"))
      );
      expect(unknownArgFromMetadata.length).toBe(0);

      expect(result.contractExtractionExclusions.length).toBeGreaterThan(0);

      const contractMatchDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" ||
             d.defectType === "invoke_argument_binding_mismatch"
      );
      expect(contractMatchDefects.length).toBe(0);

      const missingArgDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "missing_required_target_argument"
      );
      expect(missingArgDefects.length).toBe(0);

      expect(result.contractIntegritySummaryMetrics).toBeDefined();
      expect(result.contractIntegritySummaryMetrics!.totalExcludedNonContractFields).toBeGreaterThan(0);
      expect(result.contractIntegritySummaryMetrics!.totalUnknownTargetArguments).toBe(0);
    });

    it("does not fabricate false positives or suppress genuine defects", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap2010:WorkflowViewState.IdRef="InvokeWF_1">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["test"]</InArgument>
             <InArgument x:TypeArguments="x:String" x:Key="in_FakeArg">["bogus"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      const unknownArgDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" && d.targetArgument === "in_FakeArg"
      );
      expect(unknownArgDefects.length).toBe(1);
      expect(unknownArgDefects[0].severity).toBe("execution_blocking");

      const viewStateExclusions = result.contractExtractionExclusions.filter(
        e => e.propertyName.includes("WorkflowViewState")
      );
      expect(viewStateExclusions.length).toBeGreaterThan(0);
    });

    it("exclusion records have all required fields", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" sap2010:WorkflowViewState.IdRef="InvokeWF_1" sap:VirtualizedContainerService.HintSize="200,100" sap2010:Annotation.AnnotationText="note">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["test"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      expect(result.contractExtractionExclusions.length).toBeGreaterThan(0);
      for (const excl of result.contractExtractionExclusions) {
        expect(excl.file).toBeDefined();
        expect(excl.workflow).toBeDefined();
        expect(excl.activityType).toBeDefined();
        expect(excl.propertyName).toBeDefined();
        expect(excl.exclusionCategory).toBeDefined();
        expect(excl.exclusionReason).toBeDefined();
        expect(["designer_metadata", "view_state", "layout_hint", "idref_reference", "annotation", "non_runtime_serialization"]).toContain(excl.exclusionCategory);
      }
    });

    it("unknown non-sap namespaced attribute on invoke is treated as binding candidate (not silently excluded)", () => {
      const child = makeMinimalXaml(
        `<x:Property Name="in_Name" Type="InArgument(x:String)" />`,
        `<ui:LogMessage Level="Info" Message="[in_Name]" />`
      );
      const parent = makeMinimalXaml(
        "",
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" CustomAttr="someValue">
           <ui:InvokeWorkflowFile.Arguments>
             <InArgument x:TypeArguments="x:String" x:Key="in_Name">["test"]</InArgument>
           </ui:InvokeWorkflowFile.Arguments>
         </ui:InvokeWorkflowFile>`
      );

      const result = validateContractIntegrity([
        { name: "Main.xaml", content: parent },
        { name: "Child.xaml", content: child },
      ]);

      const customExclusions = result.contractExtractionExclusions.filter(
        e => e.propertyName === "CustomAttr"
      );
      expect(customExclusions.length).toBe(0);

      const unknownArgDefects = result.contractIntegrityDefects.filter(
        d => d.defectType === "unknown_target_argument" && d.targetArgument === "CustomAttr"
      );
      expect(unknownArgDefects.length).toBe(1);
    });
  });
});

import {
  canonicalizeTargetValueExpressions,
} from "../xaml/invoke-binding-canonicalizer";

function makeAssignXaml(toValue: string, assignValue: string, variables: string = ""): string {
  const varBlock = variables ? `<Sequence.Variables>${variables}</Sequence.Variables>` : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    ${varBlock}
    <Assign>
      <Assign.To>
        <OutArgument x:TypeArguments="x:String">${toValue}</OutArgument>
      </Assign.To>
      <Assign.Value>
        <InArgument x:TypeArguments="x:String">${assignValue}</InArgument>
      </Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
}

describe("target-value-canonicalization", () => {
  describe("child-element JSON canonicalization", () => {
    it("canonicalizes Assign.To with JSON-like variable payload", () => {
      const json = '{"type":"variable","name":"str_Result"}';
      const xaml = makeAssignXaml(json, '"hello"', '<Variable x:TypeArguments="x:String" Name="str_Result" />');
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.expressionCanonicalizationFixes.length).toBeGreaterThan(0);
      const fix = result.expressionCanonicalizationFixes.find(
        f => f.propertyName === "To" && f.activityType === "Assign"
      );
      expect(fix).toBeDefined();
      expect(fix!.canonicalizationType).toBe("json_target_normalize");
      expect(fix!.canonicalizedValue).toBe("[str_Result]");
      expect(entries[0].content).not.toContain('{"type":"variable"');
      expect(entries[0].content).toContain("[str_Result]");
    });

    it("canonicalizes Assign.Value with JSON-like expression payload", () => {
      const json = '{"type":"literal","value":"hello world"}';
      const xaml = makeAssignXaml("[str_Target]", json);
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.expressionCanonicalizationFixes.length).toBeGreaterThan(0);
      const fix = result.expressionCanonicalizationFixes.find(
        f => f.propertyName === "Value" && f.activityType === "Assign"
      );
      expect(fix).toBeDefined();
      expect(fix!.canonicalizationType).toBe("json_value_normalize");
      expect(entries[0].content).not.toContain('{"type":"literal"');
    });

    it("canonicalizes LogMessage.Message with JSON-like expression payload", () => {
      const json = '{"type":"literal","value":"Processing complete"}';
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info">
      <ui:LogMessage.Message>
        <InArgument x:TypeArguments="x:String">${json}</InArgument>
      </ui:LogMessage.Message>
    </ui:LogMessage>
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.expressionCanonicalizationFixes.length).toBeGreaterThan(0);
      const fix = result.expressionCanonicalizationFixes.find(
        f => f.propertyName === "Message"
      );
      expect(fix).toBeDefined();
      expect(entries[0].content).not.toContain('{"type":"literal"');
    });

    it("final XAML contains no internal object-shaped payloads after canonicalization", () => {
      const json1 = '{"type":"variable","name":"str_Name"}';
      const json2 = '{"type":"literal","value":"test"}';
      const xaml = makeAssignXaml(json1, json2);
      const entries = [{ name: "Test.xaml", content: xaml }];

      canonicalizeTargetValueExpressions(entries);

      expect(entries[0].content).not.toMatch(/\{"type"\s*:/);
      expect(entries[0].content).not.toMatch(/\{&quot;type&quot;\s*:/);
    });
  });

  describe("symbol-scope enforcement", () => {
    it("replaces undeclared variable reference in expression property with safe value", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="[str_UndeclaredVar]" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.symbolScopeDefects.length).toBeGreaterThan(0);
      const defect = result.symbolScopeDefects.find(
        d => d.referencedSymbol === "str_UndeclaredVar"
      );
      expect(defect).toBeDefined();
      expect(defect!.replacementType).toBe("degradation_substitute");
      expect(defect!.originalDefectClass).toBe("undeclared_variable_reference");
      expect(defect!.safeReplacementValue).toBe('""');
    });

    it("replaces undeclared argument reference with safe value", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="[in_UndeclaredArg]" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.symbolScopeDefects.length).toBeGreaterThan(0);
      const defect = result.symbolScopeDefects.find(
        d => d.referencedSymbol === "in_UndeclaredArg"
      );
      expect(defect).toBeDefined();
      expect(defect!.replacementType).toBe("degradation_substitute");
      expect(defect!.originalDefectClass).toBe("undeclared_argument_reference");
    });

    it("does not fabricate missing symbols — replaces with safe value instead", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Assign To="[str_MissingVar]" Value="[str_AnotherMissing]" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(entries[0].content).not.toContain('<Variable Name="str_MissingVar"');
      expect(entries[0].content).not.toContain('<Variable Name="str_AnotherMissing"');
      if (result.symbolScopeDefects.length > 0) {
        for (const defect of result.symbolScopeDefects) {
          expect(defect.replacementType).toBe("degradation_substitute");
        }
      }
    });

    it("preserves declared variable references without modification", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_DeclaredVar" />
    </Sequence.Variables>
    <ui:LogMessage Level="Info" Message="[str_DeclaredVar]" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const wrongDefects = result.symbolScopeDefects.filter(
        d => d.referencedSymbol === "str_DeclaredVar"
      );
      expect(wrongDefects.length).toBe(0);
      expect(entries[0].content).toContain('[str_DeclaredVar]');
    });
  });

  describe("sentinel blocking", () => {
    it("replaces PLACEHOLDER sentinel in executable property with safe value", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="PLACEHOLDER_value_here" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.sentinelReplacements.length).toBeGreaterThan(0);
      const sentinel = result.sentinelReplacements.find(
        s => s.originalDefectClass === "placeholder_sentinel"
      );
      expect(sentinel).toBeDefined();
      expect(sentinel!.replacementType).toBe("degradation_substitute");
      expect(sentinel!.severity).toBe("execution_blocking");
      expect(entries[0].content).not.toContain("PLACEHOLDER");
    });

    it("replaces TODO sentinel in executable property", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Assign To="[TODO]" Value="[str_Val]" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.sentinelReplacements.length).toBeGreaterThan(0);
      expect(entries[0].content).not.toMatch(/To="\[TODO\]"/);
    });

    it("replaces HANDOFF_ sentinel in child element property", () => {
      const xaml = makeAssignXaml("HANDOFF_manual_fix", '"test"');
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.sentinelReplacements.length).toBeGreaterThan(0);
      const sentinel = result.sentinelReplacements.find(
        s => s.originalDefectClass === "handoff_sentinel"
      );
      expect(sentinel).toBeDefined();
      expect(entries[0].content).not.toContain("HANDOFF_manual_fix");
    });

    it("replaces STUB_ sentinel in executable property", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="STUB_BLOCKING_FALLBACK" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.sentinelReplacements.length).toBeGreaterThan(0);
      expect(entries[0].content).not.toContain("STUB_BLOCKING_FALLBACK");
    });

    it("does not introduce XML/XAML comment-based placeholders", () => {
      const xaml = makeAssignXaml("PLACEHOLDER_target", "PLACEHOLDER_value");
      const entries = [{ name: "Test.xaml", content: xaml }];

      canonicalizeTargetValueExpressions(entries);

      expect(entries[0].content).not.toContain("<!--");
      expect(entries[0].content).not.toContain("-->");
      expect(entries[0].content).not.toContain("PLACEHOLDER");
    });
  });

  describe("type-appropriate safe replacement values", () => {
    it("uses Nothing for target-bearing slots (Assign.To)", () => {
      const xaml = makeAssignXaml("PLACEHOLDER_target", '"hello"');
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const sentinel = result.sentinelReplacements.find(s => s.propertyName === "To");
      expect(sentinel).toBeDefined();
      expect(sentinel!.safeReplacementValue).toBe("Nothing");
    });

    it('uses "" for string-typed value properties (Message)', () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="PLACEHOLDER_msg" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const sentinel = result.sentinelReplacements.find(s => s.propertyName === "Message");
      expect(sentinel).toBeDefined();
      expect(sentinel!.safeReplacementValue).toBe('""');
    });

    it("uses False for Condition properties", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <If Condition="PLACEHOLDER_condition">
      <If.Then><Sequence /></If.Then>
    </If>
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const sentinel = result.sentinelReplacements.find(s => s.propertyName === "Condition");
      expect(sentinel).toBeDefined();
      expect(sentinel!.safeReplacementValue).toBe("False");
    });
  });

  describe("degradation substitute records", () => {
    it("preserves original defect class without suppression", () => {
      const xaml = makeAssignXaml("PLACEHOLDER_target", "PLACEHOLDER_value");
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      for (const sentinel of result.sentinelReplacements) {
        expect(sentinel.replacementType).toBe("degradation_substitute");
        expect(sentinel.originalDefectClass).toBeDefined();
        expect(["placeholder_sentinel", "todo_sentinel", "handoff_sentinel", "stub_sentinel"]).toContain(sentinel.originalDefectClass);
        expect(sentinel.severity).toBe("execution_blocking");
      }
    });

    it("includes safeReplacementValue in each defect record", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="[in_UndeclaredArg]" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      for (const defect of result.symbolScopeDefects) {
        expect(defect.safeReplacementValue).toBeDefined();
        expect(defect.safeReplacementValue.length).toBeGreaterThan(0);
      }
    });
  });

  describe("FinalQualityReport integration", () => {
    it("sentinel replacements trigger degradation in final validation", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="PLACEHOLDER_msg" />
  </Sequence>
</Activity>`;
      const projectJson = JSON.stringify({
        name: "TestProject",
        dependencies: {},
        studioVersion: "23.10.0",
      });

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: projectJson,
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report.expressionCanonicalizationFixes).toBeDefined();
      expect(report.symbolScopeDefects).toBeDefined();
      expect(report.targetValueCanonicalizationSummary).toBeDefined();
      expect(report.derivedStatus).not.toBe("studio_stable");
    });

    it("expressionCanonicalizationFixes populated for JSON child element payloads", () => {
      const json = '{"type":"literal","value":"test"}';
      const xaml = makeAssignXaml("[str_Target]", json, '<Variable x:TypeArguments="x:String" Name="str_Target" />');
      const entries = [{ name: "Main.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.expressionCanonicalizationFixes.length).toBeGreaterThan(0);
      const fix = result.expressionCanonicalizationFixes.find(f => f.propertyName === "Value");
      expect(fix).toBeDefined();
      expect(entries[0].content).not.toMatch(/\{"type"\s*:/);
    });

    it("FinalQualityReport includes new diagnostic arrays", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Level="Info" Message="test" />
  </Sequence>
</Activity>`;
      const projectJson = JSON.stringify({
        name: "TestProject",
        dependencies: {},
        studioVersion: "23.10.0",
      });

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: projectJson,
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report.expressionCanonicalizationFixes).toBeDefined();
      expect(Array.isArray(report.expressionCanonicalizationFixes)).toBe(true);
      expect(report.symbolScopeDefects).toBeDefined();
      expect(Array.isArray(report.symbolScopeDefects)).toBe(true);
      expect(report.unresolvableJsonDefects).toBeDefined();
      expect(Array.isArray(report.unresolvableJsonDefects)).toBe(true);
      expect(report.sentinelReplacements).toBeDefined();
      expect(Array.isArray(report.sentinelReplacements)).toBe(true);
      expect(report.targetValueCanonicalizationSummary).toBeDefined();
    });

    it("no silent deletion or fabrication — all changes tracked", () => {
      const json = '{"type":"variable","name":"str_Result"}';
      const xaml = makeAssignXaml(json, '"hello"');
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const totalChanges = result.expressionCanonicalizationFixes.length +
        result.symbolScopeDefects.length +
        result.sentinelReplacements.length;

      if (entries[0].content !== xaml) {
        expect(totalChanges).toBeGreaterThan(0);
      }
    });

    it("deterministic canonicalization success produces correct VB expression", () => {
      const json = '{"type":"variable","name":"str_Output"}';
      const xaml = makeAssignXaml(json, '"constant"');
      const entries = [{ name: "Test.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const fix = result.expressionCanonicalizationFixes.find(f => f.propertyName === "To");
      expect(fix).toBeDefined();
      expect(fix!.canonicalizedValue).toBe("[str_Output]");
    });
  });

  describe("unresolvable JSON defects", () => {
    it("ambiguous JSON payload produces unresolvable defect, not a fix", () => {
      const ambiguousJson = '{"type":"method_call","name":"DoSomething","value":{"args":[1,2]}}';
      const xaml = makeAssignXaml("[str_Target]", ambiguousJson, '<Variable x:TypeArguments="x:String" Name="str_Target" />');
      const entries = [{ name: "Main.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.unresolvableJsonDefects.length).toBeGreaterThan(0);
      const defect = result.unresolvableJsonDefects.find(d => d.propertyName === "Value");
      expect(defect).toBeDefined();
      expect(defect!.originalDefectClass).toBe("unresolvable_json_payload");
      expect(defect!.replacementType).toBe("degradation_substitute");
      expect(defect!.severity).toBe("execution_blocking");
      expect(defect!.safeReplacementValue).toBeDefined();
      expect(entries[0].content).not.toMatch(/method_call/);
    });

    it("unresolvable JSON triggers structurally_invalid in FinalQualityReport", () => {
      const ambiguousJson = '{"type":"method_call","name":"DoSomething","value":{"args":[1,2]}}';
      const xaml = makeAssignXaml("[str_Target]", ambiguousJson, '<Variable x:TypeArguments="x:String" Name="str_Target" />');
      const projectJson = JSON.stringify({
        name: "TestProject",
        dependencies: {},
        studioVersion: "23.10.0",
      });

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: xaml }],
        projectJsonContent: projectJson,
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
        },
      };

      const report = runFinalArtifactValidation(input);

      expect(report.unresolvableJsonDefects.length).toBeGreaterThan(0);
      expect(report.derivedStatus).toBe("structurally_invalid");
    });
  });

  describe("child-element symbol scope enforcement", () => {
    it("replaces undeclared variable in child-element InArgument body", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Assign>
      <Assign.To>
        <OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument>
      </Assign.To>
      <Assign.Value>
        <InArgument x:TypeArguments="x:String">[str_UndeclaredVar]</InArgument>
      </Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
      const entries = [{ name: "Main.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const defects = result.symbolScopeDefects.filter(d => d.propertyName === "Value");
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].referencedSymbol).toBe("str_UndeclaredVar");
      expect(defects[0].originalDefectClass).toBe("undeclared_variable_reference");
      expect(entries[0].content).not.toContain("[str_UndeclaredVar]");
    });

    it("replaces undeclared argument in child-element OutArgument body", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Assign>
      <Assign.To>
        <OutArgument x:TypeArguments="x:String">[out_MissingArg]</OutArgument>
      </Assign.To>
      <Assign.Value>
        <InArgument x:TypeArguments="x:String">"hello"</InArgument>
      </Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
      const entries = [{ name: "Main.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const defects = result.symbolScopeDefects.filter(d => d.referencedSymbol === "out_MissingArg");
      expect(defects.length).toBeGreaterThan(0);
      expect(defects[0].originalDefectClass).toBe("undeclared_argument_reference");
      expect(entries[0].content).not.toContain("[out_MissingArg]");
    });

    it("preserves declared variable in child-element body without modification", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_DeclaredVar" />
    </Sequence.Variables>
    <Assign>
      <Assign.Value>
        <InArgument x:TypeArguments="x:String">[str_DeclaredVar]</InArgument>
      </Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
      const entries = [{ name: "Main.xaml", content: xaml }];

      const result = canonicalizeTargetValueExpressions(entries);

      const defects = result.symbolScopeDefects.filter(d => d.referencedSymbol === "str_DeclaredVar");
      expect(defects.length).toBe(0);
      expect(entries[0].content).toContain("[str_DeclaredVar]");
    });
  });
});
