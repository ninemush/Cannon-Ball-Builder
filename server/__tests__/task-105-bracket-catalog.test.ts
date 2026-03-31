import { describe, it, expect, beforeAll } from "vitest";
import { smartBracketWrap, ensureBracketWrapped, looksLikeVariableRef, makeUiPathCompliant, renderActivity } from "../xaml-generator";
import { catalogService } from "../catalog/catalog-service";
import { resolveActivityTemplate } from "../workflow-tree-assembler";
import { join } from "path";

describe("Task 105 — Expression bracketing and catalog validation", () => {
  describe("smartBracketWrap", () => {
    it("brackets VB expressions with operators like <>", () => {
      expect(smartBracketWrap("int_SeverityCode <> 10")).toBe("[int_SeverityCode <> 10]");
    });

    it("brackets expressions with spaces and parentheses", () => {
      expect(smartBracketWrap("CInt(str_Value) + 1")).toBe("[CInt(str_Value) + 1]");
    });

    it("brackets expressions with comparison operators", () => {
      expect(smartBracketWrap("x > 5")).toBe("[x > 5]");
      expect(smartBracketWrap("count >= 0")).toBe("[count >= 0]");
    });

    it("brackets simple variable references", () => {
      expect(smartBracketWrap("myVariable")).toBe("[myVariable]");
    });

    it("brackets dotted variable references", () => {
      expect(smartBracketWrap("obj.Property")).toBe("[obj.Property]");
    });

    it("does not double-bracket already bracketed values", () => {
      expect(smartBracketWrap("[already_wrapped]")).toBe("[already_wrapped]");
    });

    it("preserves quoted string literals", () => {
      expect(smartBracketWrap('"Hello World"')).toBe('"Hello World"');
    });

    it("preserves &quot; escaped strings", () => {
      expect(smartBracketWrap("&quot;Hello&quot;")).toBe("&quot;Hello&quot;");
    });

    it("preserves safe literals", () => {
      expect(smartBracketWrap("True")).toBe("True");
      expect(smartBracketWrap("False")).toBe("False");
      expect(smartBracketWrap("Nothing")).toBe("Nothing");
      expect(smartBracketWrap("null")).toBe("null");
    });

    it("preserves empty strings", () => {
      expect(smartBracketWrap("")).toBe("");
      expect(smartBracketWrap("  ")).toBe("");
    });

    it("preserves numeric literals", () => {
      expect(smartBracketWrap("42")).toBe("42");
      expect(smartBracketWrap("0")).toBe("0");
    });

    it("preserves InArgument/OutArgument XML", () => {
      expect(smartBracketWrap("<InArgument x:TypeArguments=\"x:String\">[val]</InArgument>")).toBe("<InArgument x:TypeArguments=\"x:String\">[val]</InArgument>");
      expect(smartBracketWrap("<OutArgument x:TypeArguments=\"x:String\">[val]</OutArgument>")).toBe("<OutArgument x:TypeArguments=\"x:String\">[val]</OutArgument>");
    });
  });

  describe("makeUiPathCompliant — read-only compliance (no expression mutations)", () => {
    it("compliance rejects XAML fragments without namespace declarations", () => {
      const input = `<Assign DisplayName="Check" To="result" Value="int_SeverityCode &lt;&gt; 10" />`;
      expect(() => makeUiPathCompliant(input)).toThrow();
    });

    it("smartBracketWrap still brackets expressions correctly in isolation", () => {
      expect(smartBracketWrap("int_SeverityCode &lt;&gt; 10")).toBe("[int_SeverityCode &lt;&gt; 10]");
      expect(smartBracketWrap("x &lt;&gt; 5")).toBe("[x &lt;&gt; 5]");
      expect(smartBracketWrap("&quot;Hello&quot;")).toBe("&quot;Hello&quot;");
      expect(smartBracketWrap("True")).toBe("True");
      expect(smartBracketWrap("False")).toBe("False");
    });
  });

  describe("workflow-tree-assembler — resolveAssignTemplate (write point N)", () => {
    it("brackets VB expressions with operators in Assign value (XML-escaped)", () => {
      const node = {
        id: "1",
        template: "Assign",
        displayName: "Set severity check",
        properties: {
          To: "bool_IsSevere",
          Value: "int_SeverityCode <> 10",
        },
      };
      const result = resolveActivityTemplate(node as any, []);
      expect(result).toContain("[int_SeverityCode &lt;&gt; 10]");
      expect(result).toContain("[bool_IsSevere]");
    });

    it("preserves string literals in Assign value (in element content)", () => {
      const node = {
        id: "1",
        template: "Assign",
        displayName: "Set Name",
        properties: {
          To: "str_Name",
          Value: '"Hello World"',
        },
      };
      const result = resolveActivityTemplate(node as any, []);
      expect(result).toContain('"Hello World"');
      expect(result).not.toContain('["Hello World"]');
    });
  });

  describe("renderActivity catalog validation", () => {
    beforeAll(() => {
      const catalogPath = join(process.cwd(), "catalog", "activity-catalog.json");
      catalogService.load(catalogPath);
    });

    it("emits ui:Comment placeholder for unknown activity types", () => {
      const node = {
        id: "1",
        template: "FakeInventedActivity",
        displayName: "Do something fake",
        properties: {},
      };
      const result = resolveActivityTemplate(node as any, []);
      expect(result).toContain("ui:Comment");
      expect(result).toContain("Unknown");
      expect(result).toContain("FakeInventedActivity");
    });

    it("emits ui:Comment placeholder for TODO_ prefixed activity types", () => {
      const node = {
        id: "1",
        template: "TODO_SomeActivity",
        displayName: "Placeholder",
        properties: {},
      };
      const result = resolveActivityTemplate(node as any, []);
      expect(result).toContain("ui:Comment");
    });

    it("passes through known catalog activities normally", () => {
      const node = {
        id: "1",
        template: "LogMessage",
        displayName: "Log Info",
        properties: {
          Level: "Info",
          Message: "test message",
        },
      };
      const result = resolveActivityTemplate(node as any, []);
      expect(result).not.toContain("ui:Comment");
      expect(result).toContain("LogMessage");
    });

    it("passes through built-in activities like Assign without catalog check", () => {
      const node = {
        id: "1",
        template: "Assign",
        displayName: "Set Value",
        properties: {
          To: "str_Result",
          Value: "myVar",
        },
      };
      const result = resolveActivityTemplate(node as any, []);
      expect(result).toContain("Assign");
      expect(result).not.toContain("ui:Comment");
    });
  });

  describe("renderActivity (xaml-generator) — direct catalog validation", () => {
    beforeAll(() => {
      const catalogPath = join(process.cwd(), "catalog", "activity-catalog.json");
      catalogService.load(catalogPath);
    });

    it("emits ui:Comment for unknown activity type via renderActivity", () => {
      const result = renderActivity("ui:HallucinatedActivity", "Fake Step", {});
      expect(result).toContain("ui:Comment");
      expect(result).toContain("Unknown activity type");
      expect(result).toContain("HallucinatedActivity");
    });

    it("emits ui:Comment for TODO_ prefixed activity via renderActivity", () => {
      const result = renderActivity("ui:TODO_DoSomething", "Placeholder", {});
      expect(result).toContain("ui:Comment");
      expect(result).toContain("Unknown activity type");
    });

    it("passes through known catalog activity via renderActivity", () => {
      const result = renderActivity("ui:LogMessage", "Log Info", { Level: "Info", Message: "test" });
      expect(result).not.toContain("ui:Comment");
      expect(result).toContain("ui:LogMessage");
    });

    it("passes through built-in Assign via renderActivity without catalog check", () => {
      const result = renderActivity("Assign", "Set Value", { To: "str_Result", Value: "myVar" });
      expect(result).toContain("Assign");
      expect(result).not.toContain("ui:Comment");
    });

    it("brackets VB expressions with operators in Assign via renderActivity (point H)", () => {
      const result = renderActivity("Assign", "Check Severity", {
        To: "bool_Result",
        Value: "int_SeverityCode <> 10",
      });
      expect(result).toContain("[int_SeverityCode <> 10]");
      expect(result).toContain("[bool_Result]");
      expect(result).not.toContain("&lt;&gt;");
    });
  });

  describe("smartBracketWrap — &quot; full-match", () => {
    it("preserves fully &quot;-wrapped strings", () => {
      expect(smartBracketWrap("&quot;Hello World&quot;")).toBe("&quot;Hello World&quot;");
    });

    it("brackets values that only start with &quot; but don't end with it", () => {
      expect(smartBracketWrap("&quot;partial")).toBe("[&quot;partial]");
    });
  });
});
