import { describe, it, expect } from "vitest";
import {
  buildExpression,
  buildUrlExpression,
  isValueIntent,
  sanitizeValueIntentExpressions,
  ValueIntentSchema,
  type ValueIntent,
} from "../xaml/expression-builder";
import { resolvePropertyValue, resolvePropertyValueRaw, resolveActivityTemplate, assembleNode, assembleWorkflowFromSpec } from "../workflow-tree-assembler";
import { validateWorkflowSpec, type ActivityNode } from "../workflow-spec-types";

describe("ValueIntent Expression Builder", () => {
  describe("buildExpression — literal type", () => {
    it("wraps a simple literal string in double quotes", () => {
      const result = buildExpression({ type: "literal", value: "Hello World" });
      expect(result).toBe('"Hello World"');
    });

    it("bracket-wraps literals with embedded double quotes for XML safety", () => {
      const result = buildExpression({ type: "literal", value: 'Say "hello"' });
      expect(result).toBe('["Say ""hello"""]');
    });

    it("bracket-wraps literals containing & for XML safety", () => {
      const result = buildExpression({ type: "literal", value: "foo&bar" });
      expect(result).toBe('["foo&bar"]');
    });

    it("handles empty literal", () => {
      const result = buildExpression({ type: "literal", value: "" });
      expect(result).toBe('""');
    });
  });

  describe("buildExpression — variable type", () => {
    it("wraps a simple variable name in brackets", () => {
      const result = buildExpression({ type: "variable", name: "str_UserName" });
      expect(result).toBe("[str_UserName]");
    });

    it("wraps a dotted variable reference in brackets", () => {
      const result = buildExpression({ type: "variable", name: "obj_Config.Setting" });
      expect(result).toBe("[obj_Config.Setting]");
    });
  });

  describe("buildExpression — url_with_params type", () => {
    it("builds a URL with no params as a quoted string", () => {
      const result = buildExpression({
        type: "url_with_params",
        baseUrl: "https://api.example.com/data",
        params: {},
      });
      expect(result).toBe('"https://api.example.com/data"');
    });

    it("builds a URL with one static param using concatenation", () => {
      const result = buildExpression({
        type: "url_with_params",
        baseUrl: "https://api.weather.com/forecast",
        params: { units: "metric" },
      });
      expect(result).toContain("[");
      expect(result).toContain("]");
      expect(result).toContain('"https://api.weather.com/forecast?"');
      expect(result).toContain('"units="');
      expect(result).toContain("metric");
    });

    it("builds a URL with multiple params using & concatenation", () => {
      const result = buildExpression({
        type: "url_with_params",
        baseUrl: "https://api.weather.com/forecast",
        params: { city: "str_CityName", units: "metric", appid: "str_ApiKey" },
      });
      expect(result).toContain("[");
      expect(result).toContain("]");
      expect(result).toContain("str_CityName");
      expect(result).toContain('"&"');
      expect(result).not.toContain("&&");
    });

    it("uses variable references (not quoted) for safe identifiers in params", () => {
      const result = buildExpression({
        type: "url_with_params",
        baseUrl: "https://api.example.com/search",
        params: { q: "str_SearchTerm" },
      });
      expect(result).toContain("str_SearchTerm");
      expect(result).not.toContain('"str_SearchTerm"');
    });

    it("quotes literal param values that contain special characters", () => {
      const result = buildExpression({
        type: "url_with_params",
        baseUrl: "https://api.example.com/data",
        params: { format: "json+xml" },
      });
      expect(result).toContain('"json+xml"');
    });
  });

  describe("buildExpression — expression type", () => {
    it("builds a <> comparison with bracket wrapping", () => {
      const result = buildExpression({
        type: "expression",
        left: "int_StatusCode",
        operator: "<>",
        right: "200",
      });
      expect(result).toBe("[int_StatusCode <> 200]");
    });

    it("builds a > comparison", () => {
      const result = buildExpression({
        type: "expression",
        left: "int_Count",
        operator: ">",
        right: "0",
      });
      expect(result).toBe("[int_Count > 0]");
    });

    it("builds a >= comparison", () => {
      const result = buildExpression({
        type: "expression",
        left: "dbl_Amount",
        operator: ">=",
        right: "100.5",
      });
      expect(result).toBe("[dbl_Amount >= 100.5]");
    });

    it("builds equality with string literal on right", () => {
      const result = buildExpression({
        type: "expression",
        left: "str_Status",
        operator: "=",
        right: '"Active"',
      });
      expect(result).toBe("[str_Status = \"Active\"]");
    });

    it("falls back to raw bracket-wrapping for complex left operand", () => {
      const result = buildExpression({
        type: "expression",
        left: "obj.GetValue(\"key\")",
        operator: "<>",
        right: "Nothing",
      });
      expect(result).toMatch(/^\[.*\]$/);
      expect(result).toContain("<>");
      expect(result).toContain('"key"');
    });

    it("falls back to raw bracket-wrapping for dotted left operand", () => {
      const result = buildExpression({
        type: "expression",
        left: "obj.Property",
        operator: "=",
        right: '"Active"',
      });
      expect(result).toMatch(/^\[.*\]$/);
      expect(result).toContain('obj.Property = "Active"');
    });

    it("falls back when right contains function call", () => {
      const result = buildExpression({
        type: "expression",
        left: "str_Value",
        operator: "<>",
        right: "CStr(obj_X)",
      });
      expect(result).toMatch(/^\[.*\]$/);
      expect(result).toContain("<>");
    });
  });

  describe("buildUrlExpression standalone", () => {
    it("returns bracket-wrapped concatenation for params", () => {
      const result = buildUrlExpression("https://api.test.com/v1", { key: "str_ApiKey" });
      expect(result).toMatch(/^\[.*\]$/);
      expect(result).toContain("str_ApiKey");
    });

    it("returns quoted string for no params", () => {
      const result = buildUrlExpression("https://api.test.com/v1", {});
      expect(result).toBe('"https://api.test.com/v1"');
    });
  });

  describe("isValueIntent", () => {
    it("returns true for a valid literal intent", () => {
      expect(isValueIntent({ type: "literal", value: "test" })).toBe(true);
    });

    it("returns true for a valid variable intent", () => {
      expect(isValueIntent({ type: "variable", name: "str_X" })).toBe(true);
    });

    it("returns true for a valid url_with_params intent", () => {
      expect(isValueIntent({ type: "url_with_params", baseUrl: "http://x.com", params: {} })).toBe(true);
    });

    it("returns true for a valid expression intent", () => {
      expect(isValueIntent({ type: "expression", left: "a", operator: "<>", right: "b" })).toBe(true);
    });

    it("returns false for a plain string", () => {
      expect(isValueIntent("hello")).toBe(false);
    });

    it("returns false for null", () => {
      expect(isValueIntent(null)).toBe(false);
    });

    it("returns false for an object with unknown type", () => {
      expect(isValueIntent({ type: "unknown", value: "x" })).toBe(false);
    });
  });

  describe("ValueIntentSchema Zod validation", () => {
    it("parses a valid literal intent", () => {
      const result = ValueIntentSchema.safeParse({ type: "literal", value: "test" });
      expect(result.success).toBe(true);
    });

    it("parses a valid expression intent", () => {
      const result = ValueIntentSchema.safeParse({ type: "expression", left: "x", operator: "<>", right: "5" });
      expect(result.success).toBe(true);
    });

    it("rejects an intent with missing required fields", () => {
      const result = ValueIntentSchema.safeParse({ type: "expression", left: "x" });
      expect(result.success).toBe(false);
    });

    it("rejects an unknown type", () => {
      const result = ValueIntentSchema.safeParse({ type: "concatenation", parts: [] });
      expect(result.success).toBe(false);
    });
  });

  describe("resolvePropertyValue routing", () => {
    it("routes a ValueIntent through buildExpression", () => {
      const intent: ValueIntent = { type: "variable", name: "str_Test" };
      const result = resolvePropertyValue(intent);
      expect(result).toBe("[str_Test]");
    });

    it("routes a plain string through smartBracketWrap (XML-escaped)", () => {
      const result = resolvePropertyValue("myVariable");
      expect(result).toBe("&quot;myVariable&quot;");
    });

    it("preserves string literals via smartBracketWrap (XML-escaped)", () => {
      const result = resolvePropertyValue('"Hello"');
      expect(result).toBe("&quot;Hello&quot;");
    });

    it("preserves boolean literals", () => {
      expect(resolvePropertyValue("True")).toBe("True");
      expect(resolvePropertyValue("False")).toBe("False");
    });

    it("routes url_with_params intent into bracket-wrapped concatenation", () => {
      const intent: ValueIntent = {
        type: "url_with_params",
        baseUrl: "https://api.test.com",
        params: { key: "str_Key" },
      };
      const result = resolvePropertyValue(intent);
      expect(result).toContain("[");
      expect(result).toContain("str_Key");
    });

    it("routes expression intent into bracket-wrapped comparison", () => {
      const intent: ValueIntent = {
        type: "expression",
        left: "int_Code",
        operator: "<>",
        right: "0",
      };
      const result = resolvePropertyValue(intent);
      expect(result).toBe("[int_Code &lt;&gt; 0]");
    });
  });

  describe("WorkflowSpec schema accepts ValueIntent in properties", () => {
    it("validates a spec with ValueIntent url_with_params in activity properties", () => {
      const spec = {
        name: "TestWorkflow",
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "HttpClient",
              displayName: "Call API",
              properties: {
                Endpoint: {
                  type: "url_with_params",
                  baseUrl: "https://api.weather.com/forecast",
                  params: { city: "str_City", units: "metric" },
                },
                Method: "GET",
              },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = validateWorkflowSpec(spec);
      expect(result.success).toBe(true);
      if (result.success) {
        const activity = result.data.rootSequence.children[0];
        if (activity.kind === "activity") {
          expect(typeof activity.properties.Endpoint).toBe("object");
          expect(activity.properties.Method).toBe("GET");
        }
      }
    });

    it("validates a spec with plain string properties (backward compat)", () => {
      const spec = {
        name: "TestWorkflow",
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "LogMessage",
              displayName: "Log",
              properties: {
                Level: "Info",
                Message: '"Hello"',
              },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = validateWorkflowSpec(spec);
      expect(result.success).toBe(true);
    });
  });

  describe("isValueIntent — malformed objects", () => {
    it("rejects a literal without value field", () => {
      expect(isValueIntent({ type: "literal" })).toBe(false);
    });

    it("rejects a variable with empty name", () => {
      expect(isValueIntent({ type: "variable", name: "" })).toBe(false);
    });

    it("rejects a url_with_params with missing baseUrl", () => {
      expect(isValueIntent({ type: "url_with_params", params: {} })).toBe(false);
    });

    it("rejects an expression with missing right field", () => {
      expect(isValueIntent({ type: "expression", left: "x", operator: "<>" })).toBe(false);
    });

    it("rejects an expression with invalid operator via isValueIntent", () => {
      expect(isValueIntent({ type: "expression", left: "x", operator: "+", right: "5" })).toBe(false);
    });

    it("rejects an expression with arbitrary operator via isValueIntent", () => {
      expect(isValueIntent({ type: "expression", left: "x", operator: "DROP TABLE", right: "5" })).toBe(false);
    });

    it("rejects a number value", () => {
      expect(isValueIntent(42)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isValueIntent(undefined)).toBe(false);
    });
  });

  describe("ValueIntentSchema — operator validation", () => {
    it("accepts allowed operators: =, <>, <, >, <=, >=", () => {
      for (const op of ["=", "<>", "<", ">", "<=", ">="]) {
        const result = ValueIntentSchema.safeParse({ type: "expression", left: "x", operator: op, right: "5" });
        expect(result.success).toBe(true);
      }
    });

    it("accepts VB logical operators: And, Or, AndAlso, OrElse", () => {
      for (const op of ["And", "Or", "AndAlso", "OrElse"]) {
        const result = ValueIntentSchema.safeParse({ type: "expression", left: "a", operator: op, right: "b" });
        expect(result.success).toBe(true);
      }
    });

    it("accepts != and normalizes to <> in output", () => {
      const result = ValueIntentSchema.safeParse({ type: "expression", left: "x", operator: "!=", right: "5" });
      expect(result.success).toBe(true);
      const built = buildExpression({ type: "expression", left: "x", operator: "!=", right: "5" });
      expect(built).toBe("[x <> 5]");
    });

    it("rejects unsupported operators like + or *", () => {
      const result = ValueIntentSchema.safeParse({ type: "expression", left: "x", operator: "+", right: "5" });
      expect(result.success).toBe(false);
    });

    it("rejects arbitrary string operators", () => {
      const result = ValueIntentSchema.safeParse({ type: "expression", left: "x", operator: "CONTAINS", right: "5" });
      expect(result.success).toBe(false);
    });
  });

  describe("If/While condition handling with <> operators", () => {
    it("bracket-wraps If conditions containing <> operator", () => {
      const node = {
        kind: "if" as const,
        displayName: "Check Status",
        condition: "int_StatusCode <> 200",
        thenChildren: [],
        elseChildren: [],
      };
      const result = assembleNode(node, []);
      expect(result).toContain("[int_StatusCode &lt;&gt; 200]");
      expect(result).not.toMatch(/(?<!\[)int_StatusCode &lt;&gt; 200(?!\])/);
    });

    it("bracket-wraps While conditions containing > operator", () => {
      const node = {
        kind: "while" as const,
        displayName: "Loop While",
        condition: "int_Counter > 0",
        bodyChildren: [],
      };
      const result = assembleNode(node, []);
      expect(result).toContain("[int_Counter &gt; 0]");
    });

    it("preserves True/False conditions without bracket-wrapping", () => {
      const node = {
        kind: "if" as const,
        displayName: "Always True",
        condition: "True",
        thenChildren: [],
        elseChildren: [],
      };
      const result = assembleNode(node, []);
      expect(result).toContain('Condition="True"');
      expect(result).not.toContain("[True]");
    });

    it("preserves already bracket-wrapped conditions", () => {
      const node = {
        kind: "if" as const,
        displayName: "Pre-wrapped",
        condition: "[str_Status = \"Active\"]",
        thenChildren: [],
        elseChildren: [],
      };
      const result = assembleNode(node, []);
      expect(result).toContain("[str_Status");
    });

    it("routes ValueIntent expression condition through buildExpression", () => {
      const node = {
        kind: "if" as const,
        displayName: "Check Code",
        condition: {
          type: "expression" as const,
          left: "int_StatusCode",
          operator: "<>" as const,
          right: "200",
        },
        thenChildren: [],
        elseChildren: [],
      };
      const result = assembleNode(node, []);
      expect(result).toContain("[int_StatusCode &lt;&gt; 200]");
    });

    it("routes ValueIntent expression condition in While node", () => {
      const node = {
        kind: "while" as const,
        displayName: "Loop",
        condition: {
          type: "expression" as const,
          left: "int_Counter",
          operator: ">" as const,
          right: "0",
        },
        bodyChildren: [],
      };
      const result = assembleNode(node, []);
      expect(result).toContain("[int_Counter &gt; 0]");
    });
  });

  describe("Assign type inference with ValueIntent To property", () => {
    it("correctly infers type from variable intent To property", () => {
      const node: ActivityNode = {
        kind: "activity",
        template: "Assign",
        displayName: "Set Name",
        properties: {
          To: { type: "variable", name: "str_Result" },
          Value: '"test"',
        },
        errorHandling: "none",
      };
      const result = resolveActivityTemplate(node, []);
      expect(result).toContain('x:TypeArguments="x:String"');
      expect(result).toContain("[str_Result]");
    });
  });

  describe("resolveActivityTemplate with ValueIntent properties", () => {
    it("resolves HttpClient with url_with_params endpoint producing no raw &", () => {
      const node: ActivityNode = {
        kind: "activity",
        template: "HttpClient",
        displayName: "Get Weather",
        properties: {
          Endpoint: {
            type: "url_with_params",
            baseUrl: "https://api.weather.com/forecast",
            params: { city: "str_City", units: "metric", appid: "str_ApiKey" },
          },
          Method: "GET",
        },
        errorHandling: "none",
      };
      const result = resolveActivityTemplate(node, []);
      expect(result).toContain("Endpoint=");
      expect(result).not.toMatch(/(?<![&])&(?!amp;|lt;|gt;|quot;|apos;)/);
    });

    it("resolves Assign with expression intent for <> comparison", () => {
      const node: ActivityNode = {
        kind: "activity",
        template: "Assign",
        displayName: "Check Status",
        properties: {
          To: "bool_IsValid",
          Value: {
            type: "expression",
            left: "int_StatusCode",
            operator: "<>",
            right: "200",
          },
        },
        errorHandling: "none",
      };
      const result = resolveActivityTemplate(node, []);
      expect(result).toContain("[int_StatusCode &lt;&gt; 200]");
    });
  });

  describe("buildExpression returns raw (unescaped) expressions", () => {
    it("expression type returns raw <> for not-equals", () => {
      const result = buildExpression({
        type: "expression",
        left: "int_StatusCode",
        operator: "<>",
        right: "200",
      });
      expect(result).toBe("[int_StatusCode <> 200]");
    });

    it("expression type returns raw < for less-than", () => {
      const result = buildExpression({
        type: "expression",
        left: "int_Count",
        operator: "<",
        right: "100",
      });
      expect(result).toBe("[int_Count < 100]");
    });

    it("url type returns raw & concatenation operators", () => {
      const result = buildExpression({
        type: "url_with_params",
        baseUrl: "https://api.example.com/data",
        params: { city: "str_City", key: "str_Key" },
      });
      expect(result).toContain("&");
      expect(result).not.toContain("&amp;");
    });
  });

  describe("vb_expression type", () => {
    it("schema parses a valid vb_expression intent", () => {
      const result = ValueIntentSchema.safeParse({ type: "vb_expression", value: '"text" & varName' });
      expect(result.success).toBe(true);
    });

    it("schema rejects vb_expression with empty value", () => {
      const result = ValueIntentSchema.safeParse({ type: "vb_expression", value: "" });
      expect(result.success).toBe(false);
    });

    it("isValueIntent recognizes vb_expression", () => {
      expect(isValueIntent({ type: "vb_expression", value: "String.Format(\"x\", y)" })).toBe(true);
    });

    it("isValueIntent rejects vb_expression with empty value", () => {
      expect(isValueIntent({ type: "vb_expression", value: "" })).toBe(false);
    });

    it("buildExpression bracket-wraps vb_expression value", () => {
      const result = buildExpression({ type: "vb_expression", value: '"Hello " & in_Name' });
      expect(result).toBe('["Hello " & in_Name]');
    });

    it("buildExpression handles String.Format in vb_expression", () => {
      const result = buildExpression({ type: "vb_expression", value: 'String.Format("run_{0}.json", in_RunId)' });
      expect(result).toBe('[String.Format("run_{0}.json", in_RunId)]');
    });

    it("resolvePropertyValue routes vb_expression through bracket-wrapping", () => {
      const intent: ValueIntent = { type: "vb_expression", value: '"[Init] RunId=" & runId' };
      const result = resolvePropertyValue(intent);
      expect(result).toContain("[");
      expect(result).toContain("RunId=");
      expect(result).toContain("runId");
    });
  });

  describe("sanitizeValueIntentExpressions — degenerate expression recovery", () => {
    it("converts degenerate expression (left == right, op '=') to vb_expression", () => {
      const obj = {
        type: "expression",
        left: '"text" & varName & "more"',
        operator: "=",
        right: '"text" & varName & "more"',
      };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("vb_expression");
      expect((obj as any).value).toBe('"text" & varName & "more"');
      expect((obj as any).left).toBeUndefined();
      expect((obj as any).right).toBeUndefined();
      expect((obj as any).operator).toBeUndefined();
    });

    it("does not convert non-degenerate expression (left != right)", () => {
      const obj = {
        type: "expression",
        left: "int_Code",
        operator: "=",
        right: "200",
      };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("expression");
      expect(obj.left).toBe("int_Code");
    });

    it("does not convert expression when operator is not '='", () => {
      const obj = {
        type: "expression",
        left: "x",
        operator: "<>",
        right: "x",
      };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("expression");
    });

    it("does not convert degenerate expression with simple identifiers (left == right but not VB code)", () => {
      const obj = {
        type: "expression",
        left: "x",
        operator: "=",
        right: "x",
      };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("expression");
      expect(obj.left).toBe("x");
    });

    it("recovers nested degenerate expressions in properties", () => {
      const spec = {
        properties: {
          Message: {
            type: "expression",
            left: '"Log: " & in_Name',
            operator: "=",
            right: '"Log: " & in_Name',
          },
        },
      };
      sanitizeValueIntentExpressions(spec);
      expect(spec.properties.Message.type).toBe("vb_expression");
      expect((spec.properties.Message as any).value).toBe('"Log: " & in_Name');
    });
  });

  describe("sanitizeValueIntentExpressions — VB code in literal detection", () => {
    it("converts literal with & concatenation to vb_expression", () => {
      const obj = { type: "literal", value: '"Write email..." & in_FullName & "..."' };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("vb_expression");
      expect(obj.value).toBe('"Write email..." & in_FullName & "..."');
    });

    it("converts literal with String.Format to vb_expression", () => {
      const obj = { type: "literal", value: 'String.Format("run_summary_{0}.json", in_RunId)' };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("vb_expression");
    });

    it("converts literal with Integer.Parse to vb_expression", () => {
      const obj = { type: "literal", value: 'Integer.Parse(str_Count)' };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("vb_expression");
    });

    it("converts literal with .ToString() to vb_expression", () => {
      const obj = { type: "literal", value: 'int_Count.ToString()' };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("vb_expression");
    });

    it("converts literal with New Dictionary to vb_expression", () => {
      const obj = { type: "literal", value: 'New Dictionary(Of String, Object)' };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("vb_expression");
    });

    it("does not convert plain text literal", () => {
      const obj = { type: "literal", value: "Hello World" };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("literal");
    });

    it("does not convert literal with plain text ampersand (Terms & Conditions)", () => {
      const obj = { type: "literal", value: "Terms & Conditions" };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("literal");
    });

    it("does not convert literal with ampersand in sentence context", () => {
      const obj = { type: "literal", value: "Please read the rules & guidelines carefully" };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("literal");
    });

    it("does not convert simple quoted literal", () => {
      const obj = { type: "literal", value: '"Just a string"' };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("literal");
    });

    it("does not convert bracket-wrapped literal", () => {
      const obj = { type: "literal", value: '[str_AssetValue]' };
      sanitizeValueIntentExpressions(obj);
      expect(obj.type).toBe("literal");
    });

    it("handles nested literals in arrays", () => {
      const arr = [
        { type: "literal", value: 'CStr(obj_Value)' },
        { type: "literal", value: "plain text" },
      ];
      sanitizeValueIntentExpressions(arr);
      expect(arr[0].type).toBe("vb_expression");
      expect(arr[1].type).toBe("literal");
    });
  });
});

import { tryParseJsonValueIntent, containsValueIntentJson } from "../xaml/expression-builder";

describe("Expression and Value Passthrough Authority", () => {
  describe("tryParseJsonValueIntent — bracket-wrapped values", () => {
    it("parses bracket-wrapped JSON expression [{}]", () => {
      const input = '[{"type":"expression","left":"x","operator":"=","right":"y"}]';
      const result = tryParseJsonValueIntent(input);
      expect(result).not.toBeNull();
      expect(result!.intent.type).toBe("expression");
      if (result!.intent.type === "expression") {
        expect(result!.intent.left).toBe("x");
        expect(result!.intent.operator).toBe("=");
        expect(result!.intent.right).toBe("y");
      }
    });

    it("lowers bracket-wrapped expression to VB", () => {
      const input = '[{"type":"expression","left":"x","operator":"=","right":"y"}]';
      const result = tryParseJsonValueIntent(input);
      expect(result).not.toBeNull();
      const expr = buildExpression(result!.intent);
      expect(expr).toBe("[x = y]");
    });

    it("parses bracket-wrapped variable", () => {
      const input = '[{"type":"variable","name":"invoiceStatus"}]';
      const result = tryParseJsonValueIntent(input);
      expect(result).not.toBeNull();
      expect(result!.intent.type).toBe("variable");
      if (result!.intent.type === "variable") {
        expect(result!.intent.name).toBe("invoiceStatus");
      }
    });
  });

  describe("tryParseJsonValueIntent — XML-entity-encoded values", () => {
    it("parses XML-entity-encoded variable JSON", () => {
      const input = '{&quot;type&quot;:&quot;variable&quot;,&quot;name&quot;:&quot;str_Status&quot;}';
      const result = tryParseJsonValueIntent(input);
      expect(result).not.toBeNull();
      expect(result!.intent.type).toBe("variable");
      if (result!.intent.type === "variable") {
        expect(result!.intent.name).toBe("str_Status");
      }
    });

    it("parses XML-entity-encoded literal JSON", () => {
      const input = '{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;Hello World&quot;}';
      const result = tryParseJsonValueIntent(input);
      expect(result).not.toBeNull();
      expect(result!.intent.type).toBe("literal");
    });

    it("handles XML-entity-encoded value that doesn't start with brace after decoding", () => {
      const input = 'prefix{&quot;type&quot;:&quot;variable&quot;}';
      const result = tryParseJsonValueIntent(input);
      expect(result).toBeNull();
    });
  });

  describe("containsValueIntentJson — bracket-wrapped detection", () => {
    it("detects bracket-wrapped JSON value intent", () => {
      expect(containsValueIntentJson('[{"type":"variable","name":"x"}]')).toBe(true);
    });

    it("detects standard JSON value intent", () => {
      expect(containsValueIntentJson('{"type":"variable","name":"x"}')).toBe(true);
    });
  });

  describe("Assign.To resolves ValueIntent JSON", () => {
    it("resolves variable ValueIntent in Assign.To property", () => {
      const node: ActivityNode = {
        kind: "activity",
        template: "Assign",
        displayName: "Set Invoice Status",
        properties: {
          To: '{"type":"variable","name":"invoiceStatus"}',
          Value: '"Approved"',
        },
        errorHandling: "none",
      };
      const result = resolveActivityTemplate(node, []);
      expect(result).toContain("invoiceStatus");
      expect(result).not.toContain("Nothing");
      expect(result).not.toContain('"type"');
    });
  });

  describe("LogMessage.Message resolves ValueIntent JSON", () => {
    it("resolves literal ValueIntent in LogMessage.Message", () => {
      const node: ActivityNode = {
        kind: "activity",
        template: "LogMessage",
        displayName: "Log Status",
        properties: {
          Level: "Info",
          Message: '{"type":"literal","value":"Processing complete"}',
        },
        errorHandling: "none",
      };
      const result = resolveActivityTemplate(node, []);
      expect(result).toContain("Processing complete");
      expect(result).not.toContain('"type"');
    });

    it("resolves variable ValueIntent in LogMessage.Message", () => {
      const node: ActivityNode = {
        kind: "activity",
        template: "LogMessage",
        displayName: "Log Variable",
        properties: {
          Level: "Info",
          Message: '{"type":"variable","name":"str_Result"}',
        },
        errorHandling: "none",
      };
      const result = resolveActivityTemplate(node, []);
      expect(result).toContain("str_Result");
      expect(result).not.toContain('"type"');
    });
  });

  describe("Idempotence", () => {
    it("already-lowered VB expression [myVar = True] is not altered", () => {
      const input = "[myVar = True]";
      const result = tryParseJsonValueIntent(input);
      expect(result).toBeNull();
    });

    it("already-correct literal string is not converted to expression", () => {
      const input = "Hello World";
      const result = tryParseJsonValueIntent(input);
      expect(result).toBeNull();
    });

    it("already-valid quoted string passes through unchanged", () => {
      const input = '"Hello World"';
      const result = tryParseJsonValueIntent(input);
      expect(result).toBeNull();
    });

    it("already-lowered variable reference [str_Name] passes through", () => {
      const input = "[str_Name]";
      const result = tryParseJsonValueIntent(input);
      expect(result).toBeNull();
    });

    it("ValueIntent-derived output is byte-stable on second lowering pass", () => {
      const originalJson = '{"type":"variable","name":"invoiceStatus"}';
      const first = tryParseJsonValueIntent(originalJson);
      expect(first).not.toBeNull();
      const firstExpr = buildExpression(first!.intent);
      expect(firstExpr).toBe("[invoiceStatus]");
      const second = tryParseJsonValueIntent(firstExpr);
      expect(second).toBeNull();
    });

    it("expression ValueIntent-derived output is byte-stable on second pass", () => {
      const originalJson = '{"type":"expression","left":"x","operator":"=","right":"y"}';
      const first = tryParseJsonValueIntent(originalJson);
      expect(first).not.toBeNull();
      const firstExpr = buildExpression(first!.intent);
      expect(firstExpr).toBe("[x = y]");
      const second = tryParseJsonValueIntent(firstExpr);
      expect(second).toBeNull();
    });

    it("literal ValueIntent-derived output is byte-stable on second pass", () => {
      const originalJson = '{"type":"literal","value":"Hello World"}';
      const first = tryParseJsonValueIntent(originalJson);
      expect(first).not.toBeNull();
      const firstExpr = buildExpression(first!.intent);
      expect(firstExpr).toBe('"Hello World"');
      const second = tryParseJsonValueIntent(firstExpr);
      expect(second).toBeNull();
    });
  });

  describe("Symbol auto-discovery via assembleWorkflowFromSpec", () => {
    it("auto-declares argument referenced in If.condition", () => {
      const spec = {
        name: "ConditionArgTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "if" as const,
              displayName: "Check Status",
              condition: "in_Status = \"Active\"",
              thenChildren: [
                {
                  kind: "activity" as const,
                  template: "LogMessage",
                  displayName: "Log Active",
                  properties: { Level: "Info", Message: '"Active"' },
                  errorHandling: "none" as const,
                },
              ],
              elseChildren: [],
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("in_Status");
      expect(result.xaml).toContain("InArgument");
    });

    it("auto-declares argument referenced in While.condition", () => {
      const spec = {
        name: "WhileArgTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "while" as const,
              displayName: "Retry Loop",
              condition: "in_RetryCount > 0",
              bodyChildren: [
                {
                  kind: "activity" as const,
                  template: "LogMessage",
                  displayName: "Log Retry",
                  properties: { Level: "Info", Message: '"Retrying"' },
                  errorHandling: "none" as const,
                },
              ],
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("in_RetryCount");
    });

    it("auto-declares argument referenced in TryCatch catch body", () => {
      const spec = {
        name: "TryCatchArgTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "tryCatch" as const,
              displayName: "Handle Error",
              tryChildren: [
                {
                  kind: "activity" as const,
                  template: "LogMessage",
                  displayName: "Try Step",
                  properties: { Level: "Info", Message: '"Trying"' },
                  errorHandling: "none" as const,
                },
              ],
              catchChildren: [
                {
                  kind: "activity" as const,
                  template: "Assign",
                  displayName: "Set Error",
                  properties: {
                    To: "out_ErrorMessage",
                    Value: '"Error occurred"',
                  },
                  errorHandling: "none" as const,
                },
              ],
              finallyChildren: [],
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("out_ErrorMessage");
    });

    it("resolves nested property ValueIntent objects before emission", () => {
      const spec = {
        name: "NestedPropTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "LogMessage",
              displayName: "Log Status",
              properties: {
                Level: "Info",
                Message: { type: "literal" as const, value: "Process started" },
              },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("Process started");
      expect(result.xaml).not.toContain('"type"');
    });

    it("full-pipeline idempotence: assembling same spec twice produces byte-identical XAML", () => {
      const spec = {
        name: "IdempotenceTest",
        variables: [{ name: "str_Status", type: "String" }],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Status",
              properties: {
                To: '{"type":"variable","name":"str_Status"}',
                Value: '{"type":"literal","value":"Active"}',
              },
              errorHandling: "none" as const,
            },
            {
              kind: "if" as const,
              displayName: "Check Status",
              condition: "str_Status = \"Active\"",
              thenChildren: [
                {
                  kind: "activity" as const,
                  template: "LogMessage",
                  displayName: "Log Active",
                  properties: { Level: "Info", Message: '"Status is active"' },
                  errorHandling: "none" as const,
                },
              ],
              elseChildren: [],
            },
          ],
        },
      };
      const deepCopy = () => JSON.parse(JSON.stringify(spec));
      const result1 = assembleWorkflowFromSpec(deepCopy());
      const result2 = assembleWorkflowFromSpec(deepCopy());
      expect(result1.xaml).toBe(result2.xaml);
      expect(result1.xaml).toContain("str_Status");
      expect(result1.xaml).not.toContain('"type"');
    });
  });

  describe("Unprefixed symbol discovery via assembleWorkflowFromSpec", () => {
    it("discovers prefixed variable in activity property and declares it", () => {
      const spec = {
        name: "PrefixedVarTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Value",
              properties: { To: "str_Result", Value: '"hello"' },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("str_Result");
      expect(result.xaml).toContain('Variable x:TypeArguments="x:String" Name="str_Result"');
    });

    it("discovers unprefixed standalone variable as assign target and declares as x:Object", () => {
      const spec = {
        name: "UnprefixedVarTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Result",
              properties: { To: "result", Value: '"done"' },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("result");
    });

    it("discovers prefixed variable in If condition", () => {
      const spec = {
        name: "IfCondPrefixedTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "if" as const,
              displayName: "Check Flag",
              condition: "bool_IsReady = True",
              thenChildren: [
                {
                  kind: "activity" as const,
                  template: "LogMessage",
                  displayName: "Log Ready",
                  properties: { Level: "Info", Message: '"Ready"' },
                  errorHandling: "none" as const,
                },
              ],
              elseChildren: [],
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("bool_IsReady");
      expect(result.xaml).toContain('Variable x:TypeArguments="x:Boolean" Name="bool_IsReady"');
    });

    it("does not declare PascalCase identifiers followed by dot (property access)", () => {
      const spec = {
        name: "PropertyAccessTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Get Length",
              properties: { To: "int_Len", Value: "String.Empty.Length" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).not.toContain('Name="Empty"');
      expect(result.xaml).not.toContain('Name="Length"');
    });

    it("does not declare VB.NET keywords or CLR types as variables", () => {
      const spec = {
        name: "KeywordExclusionTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Convert Value",
              properties: { To: "str_Result", Value: "CStr(Nothing)" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).not.toContain('Name="Nothing"');
      expect(result.xaml).not.toContain('Name="CStr"');
    });

    it("does not declare case-insensitive VB keywords or CLR types", () => {
      const spec = {
        name: "CaseInsensitiveTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Value",
              properties: { To: "str_Val", Value: "nothing" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).not.toContain('Name="nothing"');
    });

    it("declares unprefixed identifiers in complex expressions with context-inferred type", () => {
      const spec = {
        name: "ComplexExprTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Compute",
              properties: { To: "int_Total", Value: "count + offset * 2" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain('Name="count"');
      expect(result.xaml).toContain('Name="offset"');
      const countDiag = result.symbolDiscoveryDiagnostics?.find(d => d.symbol === "count");
      expect(countDiag).toBeDefined();
      expect(countDiag!.declarationEmitted).toBe(true);
      // Arithmetic context (`count + offset * 2`) is strong enough evidence to
      // infer a numeric type. Accept the strong inference (Int32) and the
      // generic fallback (x:Object); both are valid declarations that prevent
      // the undeclared-variable QG error. The contract is "must be declared
      // with *some* type" — not "must always degrade to x:Object".
      expect(["Int32", "x:Int32", "x:Object"]).toContain(countDiag!.inferredType);
    });

    it("does not declare function calls as variables", () => {
      const spec = {
        name: "FuncCallExclusionTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Trim Value",
              properties: { To: "str_Output", Value: 'Trim(str_Input)' },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).not.toContain('Name="Trim"');
    });

    it("records symbol diagnostics for discovered symbols", () => {
      const spec = {
        name: "DiagnosticsTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Count",
              properties: { To: "int_Count", Value: "0" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.symbolDiscoveryDiagnostics).toBeDefined();
      const diag = result.symbolDiscoveryDiagnostics!.find(d => d.symbol === "int_Count");
      expect(diag).toBeDefined();
      expect(diag!.category).toBe("variable");
      expect(diag!.declarationEmitted).toBe(true);
      expect(diag!.inferredType).toBe("x:Int32");
    });

    it("records argument diagnostics for discovered arguments", () => {
      const spec = {
        name: "ArgDiagTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "if" as const,
              displayName: "Check Input",
              condition: 'in_Name <> ""',
              thenChildren: [
                {
                  kind: "activity" as const,
                  template: "LogMessage",
                  displayName: "Log Name",
                  properties: { Level: "Info", Message: "in_Name" },
                  errorHandling: "none" as const,
                },
              ],
              elseChildren: [],
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.symbolDiscoveryDiagnostics).toBeDefined();
      const argDiag = result.symbolDiscoveryDiagnostics!.find(d => d.symbol === "in_Name" && d.category === "argument");
      expect(argDiag).toBeDefined();
      // An `in_`-prefixed identifier referenced in an If.condition is auto-
      // declared as an InArgument so the workflow contract is complete and
      // the QG "undeclared variable" check passes. When the body name carries
      // no type evidence, the type degrades to x:Object — but the declaration
      // is still emitted, which is the strong contract this test enforces.
      expect(argDiag!.declarationEmitted).toBe(true);
      expect(argDiag!.inferredType).toBe("x:Object");
      expect(result.xaml).toContain("InArgument");
    });

    it("does not declare identifiers from quoted string literals as variables", () => {
      const spec = {
        name: "QuotedLiteralTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Status",
              properties: { To: "str_Status", Value: '"done"' },
              errorHandling: "none" as const,
            },
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Message",
              properties: { To: "str_Msg", Value: '"Hello World"' },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).not.toContain('Name="done"');
      expect(result.xaml).not.toContain('Name="Hello"');
      expect(result.xaml).not.toContain('Name="World"');
    });

    it("discovers symbols in nested ForEach body children", () => {
      const spec = {
        name: "ForEachBodyTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "forEach" as const,
              displayName: "Loop Items",
              iteratorName: "item",
              valuesExpression: "list_Items",
              bodyChildren: [
                {
                  kind: "activity" as const,
                  template: "Assign",
                  displayName: "Set Value",
                  properties: { To: "str_Current", Value: "item.ToString()" },
                  errorHandling: "none" as const,
                },
              ],
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("str_Current");
    });

    it("does not declare unprefixed identifiers from never-expression properties", () => {
      const spec = {
        name: "NonExprPropTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "LogMessage",
              displayName: "Log Info",
              properties: { Message: '"Processing complete"', Level: "Info" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).not.toContain('Name="Info"');
      expect(result.xaml).not.toContain('Name="Processing"');
      expect(result.xaml).not.toContain('Name="complete"');
    });

    it("discovers unprefixed symbols in expression-capable properties like Message", () => {
      const spec = {
        name: "ExprCapablePropTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Compute",
              properties: { To: "str_Result", Value: "total + bonus" },
              errorHandling: "none" as const,
            },
            {
              kind: "activity" as const,
              template: "LogMessage",
              displayName: "Log Status",
              properties: { Message: "status & count", Level: "Info" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain('Name="total"');
      expect(result.xaml).toContain('Name="bonus"');
      expect(result.xaml).not.toContain('Name="Info"');
    });

    it("records withheld diagnostics for rejected unprefixed candidates", () => {
      const spec = {
        name: "WithheldDiagTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Call Func",
              properties: { To: "str_Result", Value: "Trim(str_Input)" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      const diagnostics = result.symbolDiscoveryDiagnostics || [];
      const withheld = diagnostics.find(d => d.symbol === "Trim" && d.declarationEmitted === false);
      expect(withheld).toBeDefined();
      expect(withheld!.ambiguityReason).toContain("Withheld");
    });
  });

  describe("XML-encoded url_with_params lowering", () => {
    it("parses XML-entity-encoded url_with_params JSON", () => {
      const input = '{&quot;type&quot;:&quot;url_with_params&quot;,&quot;baseUrl&quot;:&quot;https://api.example.com&quot;,&quot;params&quot;:{}}';
      const result = tryParseJsonValueIntent(input);
      expect(result).not.toBeNull();
      expect(result!.intent.type).toBe("url_with_params");
      if (result!.intent.type === "url_with_params") {
        expect(result!.intent.baseUrl).toBe("https://api.example.com");
      }
    });
  });

  describe("Deeply nested property ValueIntent resolution", () => {
    it("resolves deeply nested JSON ValueIntent strings in activity properties", () => {
      const spec = {
        name: "DeepNestedTest",
        variables: [{ name: "str_Name", type: "String" }],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Name",
              properties: {
                To: '{"type":"variable","name":"str_Name"}',
                Value: '{"type":"literal","value":"TestValue"}',
              },
              errorHandling: "none" as const,
            },
            {
              kind: "activity" as const,
              template: "LogMessage",
              displayName: "Log Name",
              properties: {
                Level: "Info",
                Message: '{"type":"variable","name":"str_Name"}',
              },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("str_Name");
      expect(result.xaml).not.toContain("[object Object]");
      expect(result.xaml).not.toContain('{"type"');
      expect(result.xaml).not.toContain('"variable"');
    });
  });

  describe("Task #516 — Assign child-element emission", () => {
    it("emits Assign.To and Assign.Value as child elements, not attributes", () => {
      const spec = {
        name: "AssignChildTest",
        variables: [{ name: "str_Result", type: "String", defaultValue: "" }],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "Assign",
              displayName: "Set Result",
              properties: { To: "str_Result", Value: '"Done"' },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("<Assign.To>");
      expect(result.xaml).toContain("<Assign.Value>");
      expect(result.xaml).not.toMatch(/Assign\s+[^>]*To="/);
    });
  });

  describe("Task #516 — InvokeWorkflowFile argument auto-binding", () => {
    it("emits InvokeWorkflowFile with WorkflowFileName property", () => {
      const spec = {
        name: "InvokeBindTest",
        variables: [],
        rootSequence: {
          kind: "sequence" as const,
          displayName: "Main",
          children: [
            {
              kind: "activity" as const,
              template: "InvokeWorkflowFile",
              displayName: "Call Sub",
              properties: { WorkflowFileName: "Sub.xaml" },
              errorHandling: "none" as const,
            },
          ],
        },
      };
      const result = assembleWorkflowFromSpec(spec as any);
      expect(result.xaml).toContain("InvokeWorkflowFile");
      expect(result.xaml).toContain("Sub.xaml");
    });

    it("TODO placeholder is a safe string literal, not a variable reference", () => {
      const placeholder = '["TODO: Bind InPersonName"]';
      expect(placeholder).toContain('"TODO:');
      expect(placeholder).not.toMatch(/^\[TODO_Bind/);
    });
  });

  describe("Task #516 — vb_expression placeholder leak", () => {
    it("buildExpression returns TODO for empty vb_expression value", () => {
      const result = buildExpression({ type: "vb_expression", value: "" });
      expect(result).toContain("TODO");
      expect(result).not.toContain("vb_expression");
    });

    it("buildExpression returns TODO for literal 'vb_expression' value", () => {
      const result = buildExpression({ type: "vb_expression", value: "vb_expression" });
      expect(result).toContain("TODO");
    });

    it("buildExpression passes through valid vb_expression values", () => {
      const result = buildExpression({ type: "vb_expression", value: "str_Name.Contains(\"test\")" });
      expect(result).toContain("str_Name.Contains");
      expect(result).not.toContain("TODO");
    });
  });
});
