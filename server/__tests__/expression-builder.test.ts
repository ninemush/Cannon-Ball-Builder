import { describe, it, expect } from "vitest";
import {
  buildExpression,
  buildUrlExpression,
  isValueIntent,
  ValueIntentSchema,
  type ValueIntent,
} from "../xaml/expression-builder";
import { resolvePropertyValue, resolvePropertyValueRaw, resolveActivityTemplate, assembleNode } from "../workflow-tree-assembler";
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
      expect(result).toContain('"&amp;"');
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
      expect(result).toBe("[int_StatusCode &lt;&gt; 200]");
    });

    it("builds a > comparison", () => {
      const result = buildExpression({
        type: "expression",
        left: "int_Count",
        operator: ">",
        right: "0",
      });
      expect(result).toBe("[int_Count &gt; 0]");
    });

    it("builds a >= comparison", () => {
      const result = buildExpression({
        type: "expression",
        left: "dbl_Amount",
        operator: ">=",
        right: "100.5",
      });
      expect(result).toBe("[dbl_Amount &gt;= 100.5]");
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

    it("falls back to escaped bracket-wrapping for complex left operand", () => {
      const result = buildExpression({
        type: "expression",
        left: "obj.GetValue(\"key\")",
        operator: "<>",
        right: "Nothing",
      });
      expect(result).toMatch(/^\[.*\]$/);
      expect(result).toContain("&lt;&gt;");
      expect(result).toContain("&quot;");
    });

    it("falls back to escaped bracket-wrapping for dotted left operand", () => {
      const result = buildExpression({
        type: "expression",
        left: "obj.Property",
        operator: "=",
        right: '"Active"',
      });
      expect(result).toMatch(/^\[.*\]$/);
      expect(result).toContain("obj.Property = &quot;Active&quot;");
    });

    it("falls back when right contains function call", () => {
      const result = buildExpression({
        type: "expression",
        left: "str_Value",
        operator: "<>",
        right: "CStr(obj_X)",
      });
      expect(result).toMatch(/^\[.*\]$/);
      expect(result).toContain("&lt;&gt;");
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
      expect(built).toBe("[x &lt;&gt; 5]");
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

  describe("buildExpression XML escaping", () => {
    it("expression type escapes <> to &lt;&gt; for not-equals", () => {
      const result = buildExpression({
        type: "expression",
        left: "int_StatusCode",
        operator: "<>",
        right: "200",
      });
      expect(result).toBe("[int_StatusCode &lt;&gt; 200]");
    });

    it("expression type escapes < to &lt; for less-than", () => {
      const result = buildExpression({
        type: "expression",
        left: "int_Count",
        operator: "<",
        right: "100",
      });
      expect(result).toBe("[int_Count &lt; 100]");
    });

    it("url type escapes & concatenation operators to &amp;", () => {
      const result = buildExpression({
        type: "url_with_params",
        baseUrl: "https://api.example.com/data",
        params: { city: "str_City", key: "str_Key" },
      });
      expect(result).toContain("&amp;");
      expect(result).not.toMatch(/(?<![&])&(?!amp;)/);
    });
  });
});
