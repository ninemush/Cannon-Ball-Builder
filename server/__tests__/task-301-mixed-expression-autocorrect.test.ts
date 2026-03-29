import { describe, it, expect } from "vitest";
import { fixMixedLiteralExpressionSyntax } from "../package-assembler";

describe("fixMixedLiteralExpressionSyntax", () => {
  describe("single bracket segment in a literal string", () => {
    it("corrects Value with literal text before a bracket expression", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Hello [str_World]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<InArgument x:TypeArguments="x:String" Value="[&quot;Hello &quot; &amp; str_World]" />`
      );
    });

    it("corrects Message with literal text and a bracket expression", () => {
      const input = `<ui:LogMessage Message="Processing item [str_ItemName]" DisplayName="Log" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<ui:LogMessage Message="[&quot;Processing item &quot; &amp; str_ItemName]" DisplayName="Log" />`
      );
    });

    it("corrects Value with literal text after a bracket expression", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Result: [int_Count] items" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<InArgument x:TypeArguments="x:String" Value="[&quot;Result: &quot; &amp; int_Count &amp; &quot; items&quot;]" />`
      );
    });
  });

  describe("multiple bracket segments", () => {
    it("corrects value with two bracket expressions", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Hello [str_First] and [str_Second]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<InArgument x:TypeArguments="x:String" Value="[&quot;Hello &quot; &amp; str_First &amp; &quot; and &quot; &amp; str_Second]" />`
      );
    });

    it("corrects value with three bracket expressions", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Name: [str_First] [str_Middle] [str_Last]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<InArgument x:TypeArguments="x:String" Value="[&quot;Name: &quot; &amp; str_First &amp; &quot; &quot; &amp; str_Middle &amp; &quot; &quot; &amp; str_Last]" />`
      );
    });
  });

  describe("bracket at start/end of value", () => {
    it("handles expression at the end with trailing literal", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Total: [int_Count] units" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toContain(`&quot;Total: &quot; &amp; int_Count &amp; &quot; units&quot;`);
    });

    it("corrects expression at the start with trailing literal text", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="[str_Name] logged in" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<InArgument x:TypeArguments="x:String" Value="[str_Name &amp; &quot; logged in&quot;]" />`
      );
    });

    it("corrects Message with expression at start", () => {
      const input = `<ui:LogMessage Message="[str_Username] has logged out" DisplayName="Log" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<ui:LogMessage Message="[str_Username &amp; &quot; has logged out&quot;]" DisplayName="Log" />`
      );
    });

    it("corrects start-bracket + literal + end-bracket pattern", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="[str_First] and [str_Last]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<InArgument x:TypeArguments="x:String" Value="[str_First &amp; &quot; and &quot; &amp; str_Last]" />`
      );
    });

    it("is idempotent on start-position corrections", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="[str_Name] logged in" />`;
      const first = fixMixedLiteralExpressionSyntax(input);
      const second = fixMixedLiteralExpressionSyntax(first.content);
      expect(second.fixes.length).toBe(0);
      expect(second.content).toBe(first.content);
    });
  });

  describe("bracket in Message attributes", () => {
    it("corrects Message attribute with mixed syntax", () => {
      const input = `<ui:LogMessage Message="User [str_Username] logged in at [DateTime.Now.ToString()]" DisplayName="Log" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<ui:LogMessage Message="[&quot;User &quot; &amp; str_Username &amp; &quot; logged in at &quot; &amp; DateTime.Now.ToString()]" DisplayName="Log" />`
      );
    });
  });

  describe("already-correct expressions are not modified", () => {
    it("does not modify a fully bracketed expression", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="[str_Hello]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("does not modify a properly formed concatenation expression", () => {
      const input = `<ui:LogMessage Message="[&quot;Hello &quot; &amp; str_Name]" DisplayName="Log" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("does not modify plain literal text without brackets", () => {
      const input = `<ui:LogMessage Message="Hello world" DisplayName="Log" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("does not modify empty values", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });
  });

  describe("ambiguous patterns are not modified", () => {
    it("skips values with unbalanced brackets", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Hello [str_World" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips values starting with digit", () => {
      const input = `<InArgument x:TypeArguments="x:Int32" Value="3 [int_Count]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips values starting with True/False/Nothing", () => {
      const input1 = `<InArgument x:TypeArguments="x:String" Value="True [str_Suffix]" />`;
      const input2 = `<InArgument x:TypeArguments="x:String" Value="False [str_Suffix]" />`;
      const input3 = `<InArgument x:TypeArguments="x:String" Value="Nothing [str_Suffix]" />`;
      expect(fixMixedLiteralExpressionSyntax(input1).fixes.length).toBe(0);
      expect(fixMixedLiteralExpressionSyntax(input2).fixes.length).toBe(0);
      expect(fixMixedLiteralExpressionSyntax(input3).fixes.length).toBe(0);
    });

    it("skips values starting with PLACEHOLDER", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="PLACEHOLDER [str_Suffix]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips values with empty bracket expressions", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Hello []" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips values where literal parts already contain &quot;", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Say &quot;hello&quot; [str_Name]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips values where literal parts already contain &amp;", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Tom &amp; Jerry [str_Suffix]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips bracketed plain-word keyboard hints like [Enter]", () => {
      const input = `<ui:LogMessage Message="Press [Enter] to continue" DisplayName="Log" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips bracketed hyphenated tokens like [ABC-123]", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Code [ABC-123] found" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips bracketed text with spaces", () => {
      const input = `<ui:LogMessage Message="See [option A] or [option B]" DisplayName="Log" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips bracketed numeric-only tokens", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Step [1] complete" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips expression-like arithmetic: [int_Count] + 1", () => {
      const input = `<InArgument x:TypeArguments="x:Int32" Value="[int_Count] + 1" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips expression-like multiplication: [a_Val] * [b_Val]", () => {
      const input = `<InArgument x:TypeArguments="x:Int32" Value="[a_Val] * [b_Val]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips expression-like comparison: [int_X] = [int_Y]", () => {
      const input = `<InArgument x:TypeArguments="x:Boolean" Value="[int_X] = [int_Y]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips expression-like: prefix + [int_Offset]", () => {
      const input = `<InArgument x:TypeArguments="x:Int32" Value="base + [int_Offset]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });

    it("skips expression with less-than operator", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="value > [int_Threshold]" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(0);
      expect(result.content).toBe(input);
    });
  });

  describe("idempotency", () => {
    it("applying the correction twice produces the same result", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Hello [str_World]" />`;
      const first = fixMixedLiteralExpressionSyntax(input);
      const second = fixMixedLiteralExpressionSyntax(first.content);
      expect(second.fixes.length).toBe(0);
      expect(second.content).toBe(first.content);
    });

    it("is idempotent on multiple bracket expressions", () => {
      const input = `<InArgument x:TypeArguments="x:String" Value="Hello [str_First] and [str_Second]" />`;
      const first = fixMixedLiteralExpressionSyntax(input);
      const second = fixMixedLiteralExpressionSyntax(first.content);
      expect(second.fixes.length).toBe(0);
      expect(second.content).toBe(first.content);
    });
  });

  describe("multiple attributes in same content", () => {
    it("corrects multiple mixed-expression attributes in the same XAML content", () => {
      const input = `<ui:LogMessage Message="Start [str_Name]" DisplayName="Log1" />
<Assign>
  <Assign.Value><InArgument x:TypeArguments="x:String" Value="Result: [int_Count]" /></Assign.Value>
</Assign>`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(2);
      expect(result.content).toContain(`Message="[&quot;Start &quot; &amp; str_Name]"`);
      expect(result.content).toContain(`Value="[&quot;Result: &quot; &amp; int_Count]"`);
    });
  });

  describe("Default attribute", () => {
    it("corrects Default attribute with mixed syntax", () => {
      const input = `<Variable x:TypeArguments="x:String" Default="Prefix [str_Suffix]" Name="str_Test" />`;
      const result = fixMixedLiteralExpressionSyntax(input);
      expect(result.fixes.length).toBe(1);
      expect(result.content).toBe(
        `<Variable x:TypeArguments="x:String" Default="[&quot;Prefix &quot; &amp; str_Suffix]" Name="str_Test" />`
      );
    });
  });
});
