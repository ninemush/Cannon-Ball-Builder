import { describe, it, expect } from "vitest";
import {
  extractExpressions,
  lintExpression,
  extractDeclaredVariables,
  findUndeclaredVariables,
  lintXamlExpressions,
} from "../xaml/vbnet-expression-linter";
import { classifyQualityIssues, getBlockingFiles } from "../uipath-quality-gate";

describe("VB.NET Expression Linter", () => {
  describe("extractExpressions", () => {
    it("extracts bracket expressions from XAML attributes", () => {
      const xaml = `<Assign DisplayName="Set Value">
  <Assign.Value>
    <InArgument x:TypeArguments="x:String">[str_result]</InArgument>
  </Assign.Value>
</Assign>`;
      const results = extractExpressions(xaml, "Main.xaml");
      expect(results.length).toBeGreaterThan(0);
    });

    it("extracts expressions from attribute values", () => {
      const xaml = `<ui:LogMessage Message="[str_message]" Level="Info" />`;
      const results = extractExpressions(xaml, "Main.xaml");
      expect(results.length).toBe(1);
      expect(results[0].expression).toBe("str_message");
    });

    it("skips xmlns and framework attributes", () => {
      const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" />`;
      const results = extractExpressions(xaml, "Main.xaml");
      expect(results.length).toBe(0);
    });

    it("extracts multiple expressions from one line", () => {
      const xaml = `<If Condition="[str_name &lt;&gt; Nothing]" DisplayName="[str_label]" />`;
      const results = extractExpressions(xaml, "Main.xaml");
      expect(results.length).toBe(2);
    });
  });

  describe("lintExpression - C# to VB.NET conversions", () => {
    it("converts null to Nothing", () => {
      const result = lintExpression("str_value != null");
      expect(result.corrected).toContain("Nothing");
      expect(result.issues.some(i => i.code === "CSHARP_NULL")).toBe(true);
      expect(result.issues.some(i => i.code === "CSHARP_NOT_EQUAL")).toBe(true);
    });

    it("converts != to <>", () => {
      const result = lintExpression('str_status != "Active"');
      expect(result.corrected).toContain("<>");
      expect(result.corrected).not.toContain("!=");
    });

    it("converts && to AndAlso", () => {
      const result = lintExpression("bool_a && bool_b");
      expect(result.corrected).toContain("AndAlso");
      expect(result.corrected).not.toContain("&&");
    });

    it("converts || to OrElse", () => {
      const result = lintExpression("bool_a || bool_b");
      expect(result.corrected).toContain("OrElse");
      expect(result.corrected).not.toContain("||");
    });

    it("converts ! prefix to Not", () => {
      const result = lintExpression("!bool_isValid");
      expect(result.corrected).toContain("Not");
    });

    it("converts true/false to True/False", () => {
      const result = lintExpression("bool_flag = true");
      expect(result.corrected).toContain("True");
      expect(result.issues.some(i => i.code === "CSHARP_BOOL_TRUE")).toBe(true);
    });

    it("converts C# lambda to VB.NET Function()", () => {
      const result = lintExpression("(x) => x.ToString()");
      expect(result.corrected).toContain("Function(x)");
      expect(result.corrected).not.toContain("=>");
    });

    it("reports embedded lambda as unfixable", () => {
      const result = lintExpression("items.Where((x) => x.Name)");
      expect(result.issues.some(i => i.code === "CSHARP_LAMBDA_COMPLEX" && !i.autoFixed)).toBe(true);
    });

    it("converts + to & for string concatenation", () => {
      const result = lintExpression('"Hello " + str_name');
      expect(result.corrected).toContain("&");
    });

    it("converts C# new to VB.NET New", () => {
      const result = lintExpression("new List(Of String)()");
      expect(result.corrected).toContain("New List");
    });

    it("converts C# string interpolation to String.Format", () => {
      const result = lintExpression('$"Hello {str_name}, you are {int_age}"');
      expect(result.corrected).toContain("String.Format");
      expect(result.corrected).toContain("{0}");
      expect(result.corrected).toContain("{1}");
    });

    it("removes trailing semicolons", () => {
      const result = lintExpression("str_value.Trim();");
      expect(result.corrected).not.toContain(";");
      expect(result.issues.some(i => i.code === "CSHARP_SEMICOLON")).toBe(true);
    });

    it("fixes lowercase .tostring() to .ToString()", () => {
      const result = lintExpression("int_count.tostring()");
      expect(result.corrected).toContain(".ToString()");
    });
  });

  describe("lintExpression - parenthesis/quote balancing", () => {
    it("fixes missing closing parenthesis", () => {
      const result = lintExpression("CStr(str_value");
      expect(result.corrected).toMatch(/\)$/);
      expect(result.issues.some(i => i.code === "UNBALANCED_PARENS" && i.autoFixed)).toBe(true);
    });

    it("fixes extra closing parenthesis", () => {
      const result = lintExpression("CStr(str_value))");
      expect(result.corrected).toBe("CStr(str_value)");
    });

    it("reports deeply unbalanced parens as unfixable", () => {
      const result = lintExpression("CStr(CInt(CDbl(str_value");
      expect(result.issues.some(i => i.code === "UNBALANCED_PARENS" && !i.autoFixed)).toBe(true);
    });

    it("detects double-bracket wrapping", () => {
      const result = lintExpression("[[str_value]]");
      expect(result.issues.some(i => i.code === "DOUBLE_BRACKET")).toBe(true);
    });
  });

  describe("lintExpression - no false positives", () => {
    it("does not modify valid VB.NET expression", () => {
      const result = lintExpression('str_name & " " & str_lastName');
      expect(result.corrected).toBeNull();
      expect(result.issues).toHaveLength(0);
    });

    it("does not modify valid comparison", () => {
      const result = lintExpression('str_status <> "Inactive"');
      expect(result.corrected).toBeNull();
      expect(result.issues).toHaveLength(0);
    });

    it("does not modify valid CType expression", () => {
      const result = lintExpression("CType(obj_row, DataRow)");
      expect(result.corrected).toBeNull();
      expect(result.issues).toHaveLength(0);
    });

    it("does not modify Nothing comparison", () => {
      const result = lintExpression("str_value IsNot Nothing");
      expect(result.corrected).toBeNull();
      expect(result.issues).toHaveLength(0);
    });

    it("does not flag numeric addition as string concat", () => {
      const result = lintExpression("int_a + int_b");
      expect(result.issues.filter(i => i.code === "CSHARP_STRING_CONCAT")).toHaveLength(0);
    });
  });

  describe("extractDeclaredVariables", () => {
    it("extracts Variable declarations", () => {
      const xaml = `<Variable x:TypeArguments="x:String" Name="str_result" />
<Variable x:TypeArguments="x:Int32" Name="int_count" Default="0" />`;
      const vars = extractDeclaredVariables(xaml);
      expect(vars.has("str_result")).toBe(true);
      expect(vars.has("int_count")).toBe(true);
    });

    it("extracts x:Property arguments", () => {
      const xaml = `<x:Property Name="in_FilePath" Type="InArgument(x:String)" />`;
      const vars = extractDeclaredVariables(xaml);
      expect(vars.has("in_FilePath")).toBe(true);
    });

    it("extracts DelegateInArgument", () => {
      const xaml = `<DelegateInArgument x:TypeArguments="x:String" Name="item" />`;
      const vars = extractDeclaredVariables(xaml);
      expect(vars.has("item")).toBe(true);
    });
  });

  describe("findUndeclaredVariables", () => {
    it("finds undeclared variables", () => {
      const declared = new Set(["str_name", "int_count"]);
      const undeclared = findUndeclaredVariables("str_name & str_missing", declared);
      expect(undeclared).toContain("str_missing");
      expect(undeclared).not.toContain("str_name");
    });

    it("does not flag VB.NET keywords", () => {
      const declared = new Set<string>();
      const undeclared = findUndeclaredVariables("Nothing AndAlso True", declared);
      expect(undeclared).toHaveLength(0);
    });

    it("does not flag builtin types with method calls", () => {
      const declared = new Set<string>();
      const undeclared = findUndeclaredVariables("String.IsNullOrEmpty(str_val)", declared);
      expect(undeclared).not.toContain("String");
    });

    it("does not flag builtin functions", () => {
      const declared = new Set<string>();
      const undeclared = findUndeclaredVariables("CStr(CInt(42))", declared);
      expect(undeclared).toHaveLength(0);
    });

    it("does not flag member-access identifiers as undeclared", () => {
      const declared = new Set(["obj_row"]);
      const undeclared = findUndeclaredVariables('obj_row.Name.ToString()', declared);
      expect(undeclared).not.toContain("Name");
      expect(undeclared).not.toContain("ToString");
    });

    it("does not flag property chains as undeclared", () => {
      const declared = new Set(["dt_result"]);
      const undeclared = findUndeclaredVariables('dt_result.Rows.Count', declared);
      expect(undeclared).not.toContain("Rows");
      expect(undeclared).not.toContain("Count");
    });
  });

  describe("lintXamlExpressions - full pipeline", () => {
    it("lints multiple expressions across XAML entries", () => {
      const entries = [{
        name: "Main.xaml",
        content: `<Sequence>
  <Variable x:TypeArguments="x:String" Name="str_result" />
  <Assign DisplayName="Set Result">
    <Assign.To><OutArgument x:TypeArguments="x:String">[str_result]</OutArgument></Assign.To>
    <Assign.Value><InArgument x:TypeArguments="x:String">["test value"]</InArgument></Assign.Value>
  </Assign>
  <If Condition="[str_result != null]" DisplayName="Check Result" />
</Sequence>`,
      }];
      const result = lintXamlExpressions(entries);
      expect(result.totalExpressions).toBeGreaterThan(0);
      expect(result.violations.some(v => v.check === "EXPRESSION_SYNTAX")).toBe(true);
    });

    it("produces no violations for clean VB.NET expressions", () => {
      const entries = [{
        name: "Main.xaml",
        content: `<Sequence>
  <Variable x:TypeArguments="x:String" Name="str_result" />
  <ui:LogMessage Message="[str_result]" Level="Info" />
</Sequence>`,
      }];
      const result = lintXamlExpressions(entries);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("quality gate integration", () => {
    it("EXPRESSION_SYNTAX is classified as warning", () => {
      const mockResult = {
        passed: true,
        violations: [{
          category: "accuracy" as const,
          severity: "warning" as const,
          check: "EXPRESSION_SYNTAX",
          file: "Main.xaml",
          detail: "Line 5: C# 'null' should be VB.NET 'Nothing'",
        }],
        positiveEvidence: [],
        completenessLevel: "functional" as const,
        summary: {
          blockedPatterns: 0, completenessErrors: 0, completenessWarnings: 0,
          accuracyErrors: 0, accuracyWarnings: 1, runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0, logicLocationWarnings: 0,
          totalErrors: 0, totalWarnings: 1,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("warning");
      const blockingFiles = getBlockingFiles(issues);
      expect(blockingFiles.size).toBe(0);
    });

    it("EXPRESSION_SYNTAX_UNFIXABLE is classified as blocking", () => {
      const mockResult = {
        passed: false,
        violations: [{
          category: "accuracy" as const,
          severity: "error" as const,
          check: "EXPRESSION_SYNTAX_UNFIXABLE",
          file: "Main.xaml",
          detail: "Line 10: Unbalanced parentheses cannot be auto-fixed",
        }],
        positiveEvidence: [],
        completenessLevel: "structural" as const,
        summary: {
          blockedPatterns: 0, completenessErrors: 0, completenessWarnings: 0,
          accuracyErrors: 1, accuracyWarnings: 0, runtimeSafetyErrors: 0,
          runtimeSafetyWarnings: 0, logicLocationWarnings: 0,
          totalErrors: 1, totalWarnings: 0,
        },
      };
      const issues = classifyQualityIssues(mockResult);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe("blocking");
      const blockingFiles = getBlockingFiles(issues);
      expect(blockingFiles.has("Main.xaml")).toBe(true);
    });
  });

  describe("string-literal safety", () => {
    it("does not modify content inside string literals", () => {
      const result = lintExpression('"a != b"');
      expect(result.corrected).toBeNull();
      expect(result.issues).toHaveLength(0);
    });

    it("only fixes code outside strings, leaves string content intact", () => {
      const result = lintExpression('str_val != "null value"');
      expect(result.corrected).toContain("<>");
      expect(result.corrected).toContain('"null value"');
    });

    it("does not flag identifiers inside string literals as undeclared", () => {
      const declared = new Set<string>();
      const undeclared = findUndeclaredVariables('"hello world"', declared);
      expect(undeclared).toHaveLength(0);
    });
  });

  describe("multiline and VisualBasicValue extraction", () => {
    it("extracts expressions from multiline InArgument bodies", () => {
      const xaml = `<Assign.Value>
  <InArgument x:TypeArguments="x:String">
  [str_value <> Nothing]
</InArgument>`;
      const results = extractExpressions(xaml, "Main.xaml");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.expression.includes("str_value"))).toBe(true);
    });

    it("extracts expressions from VisualBasicValue elements", () => {
      const xaml = `<mva:VisualBasicValue x:TypeArguments="x:String" ExpressionText="str_name &amp; &quot; World&quot;" />`;
      const results = extractExpressions(xaml, "Main.xaml");
      expect(results.length).toBeGreaterThan(0);
    });

    it("extracts expressions from generic child-element bracket bodies", () => {
      const xaml = `<SomeElement>
>[str_status <> Nothing]<
</SomeElement>`;
      const results = extractExpressions(xaml, "Main.xaml");
      expect(results.some(r => r.expression.includes("str_status"))).toBe(true);
    });
  });

  describe("compound C# patterns", () => {
    it("handles multiple C# issues in one expression", () => {
      const result = lintExpression("str_a != null && str_b != null");
      expect(result.corrected).toContain("Nothing");
      expect(result.corrected).toContain("<>");
      expect(result.corrected).toContain("AndAlso");
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
    });

    it("handles C# var keyword detection", () => {
      const result = lintExpression('var result = "test"');
      expect(result.issues.some(i => i.code === "CSHARP_VAR" && !i.autoFixed)).toBe(true);
    });

    it("fixes String.IsNullOrEmpty casing", () => {
      const result = lintExpression("string.IsNullOrEmpty(str_val)");
      expect(result.corrected).toContain("String.IsNullOrEmpty");
    });
  });

  describe("bare angle bracket detection", () => {
    it("detects bare < operator needing XML escaping", () => {
      const result = lintExpression("int_count < 10");
      expect(result.issues.some(i => i.code === "BARE_ANGLE_BRACKET")).toBe(true);
    });

    it("does not flag already-escaped &lt;", () => {
      const result = lintExpression("int_count &lt; 10");
      expect(result.issues.filter(i => i.code === "BARE_ANGLE_BRACKET")).toHaveLength(0);
    });

    it("does not flag angle brackets inside string literals", () => {
      const result = lintExpression('str_xml.Contains("<tag>")');
      expect(result.issues.filter(i => i.code === "BARE_ANGLE_BRACKET")).toHaveLength(0);
    });

    it("does not flag > inside string literals", () => {
      const result = lintExpression('str_val.Replace(">", "")');
      expect(result.issues.filter(i => i.code === "BARE_ANGLE_BRACKET")).toHaveLength(0);
    });

    it("still flags bare < outside string even when string has angles", () => {
      const result = lintExpression('int_x < CInt("5")');
      expect(result.issues.some(i => i.code === "BARE_ANGLE_BRACKET")).toBe(true);
    });
  });

  describe("function-call validation", () => {
    it("detects CType with wrong argument count", () => {
      const result = lintExpression("CType(str_value)");
      expect(result.issues.some(i => i.code === "FUNC_ARG_COUNT" && i.message.includes("CType"))).toBe(true);
    });

    it("accepts CType with correct argument count", () => {
      const result = lintExpression("CType(obj_row, DataRow)");
      expect(result.issues.filter(i => i.code === "FUNC_ARG_COUNT")).toHaveLength(0);
    });

    it("detects CStr with too many arguments", () => {
      const result = lintExpression("CStr(str_a, str_b)");
      expect(result.issues.some(i => i.code === "FUNC_ARG_COUNT" && i.message.includes("CStr"))).toBe(true);
    });

    it("accepts CStr with one argument", () => {
      const result = lintExpression("CStr(int_value)");
      expect(result.issues.filter(i => i.code === "FUNC_ARG_COUNT")).toHaveLength(0);
    });

    it("detects unbalanced method call parentheses", () => {
      const result = lintExpression("str_val.ToString(");
      expect(result.issues.some(i => i.code === "METHOD_UNBALANCED" || i.code === "UNBALANCED_PARENS")).toBe(true);
    });

    it("validates String.Format argument count", () => {
      const result = lintExpression('String.Format("{0}")');
      expect(result.issues.some(i => i.code === "FUNC_ARG_COUNT" && i.message.includes("String.Format"))).toBe(true);
    });

    it("accepts String.Format with correct args", () => {
      const result = lintExpression('String.Format("{0}", str_name)');
      expect(result.issues.filter(i => i.code === "FUNC_ARG_COUNT" && i.message.includes("String.Format"))).toHaveLength(0);
    });

    it("validates Convert.ToInt32 argument count", () => {
      const result = lintExpression("Convert.ToInt32(str_a, str_b)");
      expect(result.issues.some(i => i.code === "FUNC_ARG_COUNT" && i.message.includes("Convert.ToInt32"))).toBe(true);
    });

    it("validates .Replace needs 2 args", () => {
      const result = lintExpression('str_val.Replace("a")');
      expect(result.issues.some(i => i.code === "FUNC_ARG_COUNT" && i.message.includes("Replace"))).toBe(true);
    });

    it("validates .ToUpper takes no args", () => {
      const result = lintExpression('str_val.ToUpper("en")');
      expect(result.issues.some(i => i.code === "FUNC_ARG_COUNT" && i.message.includes("ToUpper"))).toBe(true);
    });
  });

  describe("XAML content patching", () => {
    it("applies corrections back to XAML content", () => {
      const entries = [{
        name: "Main.xaml",
        content: `<Sequence>
  <Variable x:TypeArguments="x:String" Name="str_result" />
  <If Condition="[str_result != null]" DisplayName="Check" />
</Sequence>`,
      }];
      const result = lintXamlExpressions(entries);
      expect(result.corrections.length).toBeGreaterThan(0);
      expect(result.correctedEntries).toHaveLength(1);
      expect(result.correctedEntries[0].content).toContain("Nothing");
      expect(result.correctedEntries[0].content).toContain("<>");
      expect(result.correctedEntries[0].content).not.toContain("!= null");
    });
  });
});
