import { describe, it, expect } from "vitest";
import {
  canonicalizeInvokeBindings,
  canonicalizeTargetValueExpressions,
} from "../xaml/invoke-binding-canonicalizer";

function makeMinimalXaml(body: string, variables: string = ""): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      ${variables}
    </Sequence.Variables>
    ${body}
  </Sequence>
</Activity>`;
}

describe("Task 429 — Pre-archive canonicalization wiring regression", () => {

  describe("Malformed JSON expression in executable attribute", () => {
    it("should normalize JSON expression in Message attribute", () => {
      const xaml = makeMinimalXaml(
        `<ui:LogMessage Message="{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;StatusOK&quot;}" DisplayName="Log Status" Level="Info" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      const result = canonicalizeInvokeBindings(entries);

      expect(entries[0].content).not.toContain('{&quot;type&quot;');
      expect(result.invokeSerializationFixes.length).toBeGreaterThan(0);
    });
  });

  describe("JSON-like vb_expression payload inside LogMessage.Message", () => {
    it("should canonicalize JSON payload in Message attribute", () => {
      const xaml = makeMinimalXaml(
        `<ui:LogMessage Message="{&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;str_Status&quot;}" DisplayName="Log Status" Level="Info" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      canonicalizeInvokeBindings(entries);

      expect(entries[0].content).not.toContain('{&quot;type&quot;');
    });
  });

  describe("JSON-like variable payload in target/value-bearing slots", () => {
    it("should canonicalize JSON payload in Assign.Value child element", () => {
      const xaml = makeMinimalXaml(
        `<Assign DisplayName="Set Result">
          <Assign.To>
            <OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument>
          </Assign.To>
          <Assign.Value>
            <InArgument x:TypeArguments="x:String">{"type":"variable","name":"str_InputValue"}</InArgument>
          </Assign.Value>
        </Assign>`,
        `<Variable x:TypeArguments="x:String" Name="str_Result" />
         <Variable x:TypeArguments="x:String" Name="str_InputValue" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      canonicalizeTargetValueExpressions(entries);

      expect(entries[0].content).not.toContain('{"type":"variable"');
      expect(entries[0].content).toContain("[str_InputValue]");
    });

    it("should canonicalize JSON payload in Assign.To child element", () => {
      const xaml = makeMinimalXaml(
        `<Assign DisplayName="Set Output">
          <Assign.To>
            <OutArgument x:TypeArguments="x:String">{"type":"variable","name":"str_Output"}</OutArgument>
          </Assign.To>
          <Assign.Value>
            <InArgument x:TypeArguments="x:String">"hello"</InArgument>
          </Assign.Value>
        </Assign>`,
        `<Variable x:TypeArguments="x:String" Name="str_Output" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      canonicalizeTargetValueExpressions(entries);

      expect(entries[0].content).not.toContain('{"type":"variable"');
      expect(entries[0].content).toContain("[str_Output]");
    });
  });

  describe("Placeholder in required executable field", () => {
    it("should replace PLACEHOLDER sentinels in executable properties", () => {
      const xaml = makeMinimalXaml(
        `<ui:LogMessage Message="PLACEHOLDER_LogMessage" DisplayName="Log Placeholder" Level="Info" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.sentinelReplacements.length).toBeGreaterThan(0);
      expect(entries[0].content).not.toContain("PLACEHOLDER_LogMessage");
    });

    it("should replace TODO sentinels in executable properties", () => {
      const xaml = makeMinimalXaml(
        `<ui:LogMessage Message="TODO: implement logging" DisplayName="Log TODO" Level="Info" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.sentinelReplacements.length).toBeGreaterThan(0);
    });
  });

  describe("Canonicalization result diagnostics population", () => {
    it("should populate expressionCanonicalizationFixes for JSON child element payloads", () => {
      const xaml = makeMinimalXaml(
        `<Assign DisplayName="Assign JSON">
          <Assign.Value>
            <InArgument x:TypeArguments="x:String">{"type":"literal","value":"Hello World"}</InArgument>
          </Assign.Value>
          <Assign.To>
            <OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument>
          </Assign.To>
        </Assign>`,
        `<Variable x:TypeArguments="x:String" Name="str_Result" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.expressionCanonicalizationFixes.length).toBeGreaterThan(0);
      expect(result.summary).toContain("expression fix");
    });

    it("should populate symbolScopeDefects for undeclared variable references", () => {
      const xaml = makeMinimalXaml(
        `<ui:LogMessage Message="[undeclared_var_xyz]" DisplayName="Log Undeclared" Level="Info" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.symbolScopeDefects.length).toBeGreaterThan(0);
      const defect = result.symbolScopeDefects[0];
      expect(defect.referencedSymbol).toBe("undeclared_var_xyz");
      expect(defect.originalDefectClass).toBe("undeclared_variable_reference");
    });

    it("should produce summary for clean input", () => {
      const xaml = makeMinimalXaml(
        `<ui:LogMessage Message="&quot;Hello&quot;" DisplayName="Log Hello" Level="Info" />`,
        `<Variable x:TypeArguments="x:String" Name="str_Result" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      const result = canonicalizeTargetValueExpressions(entries);

      expect(result.summary).toBeTruthy();
    });
  });

  describe("Both canonicalization stages run and mutate the same entries", () => {
    it("should apply invoke canonicalization then target/value on the same entry array", () => {
      const xaml = makeMinimalXaml(
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" DisplayName="Invoke Child" in_Param1="someValue" />
         <ui:LogMessage Message="[undeclared_var_xyz]" DisplayName="Log Status" Level="Info" />`,
        `<Variable x:TypeArguments="x:String" Name="str_Result" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];

      const invokeResult = canonicalizeInvokeBindings(entries);
      expect(invokeResult.totalCanonicalizations).toBeGreaterThan(0);
      expect(entries[0].content).not.toContain('in_Param1="someValue"');

      const targetResult = canonicalizeTargetValueExpressions(entries);
      const undeclaredDefects = targetResult.symbolScopeDefects.filter(
        d => d.referencedSymbol === "undeclared_var_xyz"
      );
      expect(undeclaredDefects.length).toBeGreaterThan(0);
    });

    it("should apply both stages sequentially with child element JSON handled by invoke stage", () => {
      const xaml = makeMinimalXaml(
        `<ui:InvokeWorkflowFile WorkflowFileName="Child.xaml" DisplayName="Invoke Child" in_Param1="someValue" />
         <Assign DisplayName="Set Value">
          <Assign.Value>
            <InArgument x:TypeArguments="x:String">{"type":"literal","value":"test"}</InArgument>
          </Assign.Value>
          <Assign.To>
            <OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument>
          </Assign.To>
         </Assign>`,
        `<Variable x:TypeArguments="x:String" Name="str_Result" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];

      const invokeResult = canonicalizeInvokeBindings(entries);
      expect(invokeResult.totalCanonicalizations).toBeGreaterThan(0);
      expect(entries[0].content).not.toContain('in_Param1="someValue"');
      expect(entries[0].content).not.toContain('{"type":"literal"');

      canonicalizeTargetValueExpressions(entries);
    });
  });

  describe("Invoke binding canonicalization produces diagnostics", () => {
    it("should produce invokeSerializationFixes for attribute-style bindings", () => {
      const xaml = makeMinimalXaml(
        `<ui:InvokeWorkflowFile WorkflowFileName="Target.xaml" DisplayName="Invoke" in_Name="[str_Value]" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      const result = canonicalizeInvokeBindings(entries);

      expect(result.invokeSerializationFixes.length).toBeGreaterThan(0);
      expect(result.totalCanonicalizations).toBeGreaterThan(0);
    });
  });

  describe("JSON expression in Message attribute is normalized by invoke canonicalization", () => {
    it("should normalize JSON in residual expression scan", () => {
      const xaml = makeMinimalXaml(
        `<ui:LogMessage Message="{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;Processing complete&quot;}" DisplayName="Log Done" Level="Info" />`
      );
      const entries = [{ name: "lib/TestWorkflow.xaml", content: xaml }];
      canonicalizeInvokeBindings(entries);

      expect(entries[0].content).not.toContain('{&quot;type&quot;');
    });
  });
});
