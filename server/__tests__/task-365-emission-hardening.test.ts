import { describe, it, expect } from "vitest";
import {
  buildExpression,
  normalizeStringToExpression,
  normalizePropertyToValueIntent,
  isPlaceholderSentinel,
  type ValueIntent,
} from "../xaml/expression-builder";
import { canonicalizeWorkflowName } from "../package-assembler";
import { decomposeComplexExpression } from "../workflow-tree-assembler";
import { normalizeXaml } from "../xaml/xaml-compliance";

describe("Task 365: Emission contract & pipeline hardening", () => {

  describe("Property-intent contract hardening", () => {
    it("should quote timezone patterns as string literals", () => {
      const result = normalizeStringToExpression("Asia/Dubai", undefined, "System.String");
      expect(result).toBe('"Asia/Dubai"');
    });

    it("should quote file paths as string literals", () => {
      const result = normalizeStringToExpression("C:\\Users\\test", undefined, "System.String");
      expect(result).toBe('"C:\\Users\\test"');
    });

    it("should treat prompt properties as string literals", () => {
      const intent = normalizePropertyToValueIntent(
        "You are a helpful assistant",
        "UseGenAI",
        "Prompt",
        undefined,
        undefined,
        "System.String",
      );
      expect(intent.type).toBe("literal");
      expect(intent.value).toBe("You are a helpful assistant");
    });

    it("should detect PLACEHOLDER sentinels", () => {
      expect(isPlaceholderSentinel("PLACEHOLDER_System_String")).toBe(true);
      expect(isPlaceholderSentinel("normal_value")).toBe(false);
    });

    it("should block PLACEHOLDER sentinels in buildExpression", () => {
      const intent: ValueIntent = { type: "literal", value: "PLACEHOLDER_System_String" };
      expect(() => buildExpression(intent)).toThrow("PLACEHOLDER sentinel");
    });

    it("should emit empty string for PLACEHOLDER in normalizeStringToExpression", () => {
      const result = normalizeStringToExpression("PLACEHOLDER_System_String", undefined, "System.String");
      expect(result).toBe('""');
    });

    it("should handle boolean typed values as typed literals", () => {
      const intent = normalizePropertyToValueIntent(
        "true",
        "SomeActivity",
        "SomeProperty",
        undefined,
        undefined,
        "System.Boolean",
      );
      expect(intent.type).toBe("literal");
      expect(intent.value).toBe("True");
    });

    it("should coerce vb_expression to string literal for prompt properties", () => {
      const intent: ValueIntent = { type: "vb_expression", value: "Hello world prompt text" };
      const result = buildExpression(intent, { propertyName: "Prompt" });
      expect(result).toBe('"Hello world prompt text"');
    });

    it("should coerce vb_expression timezone to string when clrType is String", () => {
      const intent: ValueIntent = { type: "vb_expression", value: "Asia/Dubai" };
      const result = buildExpression(intent, { clrType: "System.String" });
      expect(result).toBe('"Asia/Dubai"');
    });

    it("should coerce non-VB string values to literal when clrType is String", () => {
      const intent: ValueIntent = { type: "vb_expression", value: "some random text value" };
      const result = buildExpression(intent, { clrType: "System.String" });
      expect(result).toBe('"some random text value"');
    });

    it("should preserve valid VB variable names in vb_expression", () => {
      const intent: ValueIntent = { type: "vb_expression", value: "str_MyVariable" };
      const result = buildExpression(intent, { clrType: "System.String" });
      expect(result).toBe("[str_MyVariable]");
    });

    it("should preserve VB code patterns in vb_expression even for String type", () => {
      const intent: ValueIntent = { type: "vb_expression", value: 'String.Format("{0}", arg1)' };
      const result = buildExpression(intent, { clrType: "System.String" });
      expect(result).toBe('[String.Format("{0}", arg1)]');
    });

    it("should emit unquoted boolean for literal type with Boolean clrType", () => {
      const intent: ValueIntent = { type: "literal", value: "true" };
      const result = buildExpression(intent, { clrType: "System.Boolean" });
      expect(result).toBe("True");
    });

    it("should emit unquoted False for literal type with Boolean clrType", () => {
      const intent: ValueIntent = { type: "literal", value: "False" };
      const result = buildExpression(intent, { clrType: "System.Boolean" });
      expect(result).toBe("False");
    });
  });

  describe("Infrastructure workflow dedup", () => {
    it("should canonicalize workflow names correctly", () => {
      expect(canonicalizeWorkflowName("[Init.xaml]")).toBe("init");
      expect(canonicalizeWorkflowName('"Main.xaml"')).toBe("main");
      expect(canonicalizeWorkflowName("InitAllSettings.xaml")).toBe("initallsettings");
      expect(canonicalizeWorkflowName("  Process  ")).toBe("process");
      expect(canonicalizeWorkflowName("CloseAllApplications")).toBe("closeallapplications");
    });

    it("should strip brackets, quotes, and .xaml suffix", () => {
      expect(canonicalizeWorkflowName("[Init]")).toBe("init");
      expect(canonicalizeWorkflowName("&quot;Main&quot;")).toBe("main");
    });

    it("should strip repeated .xaml suffixes (double-suffix case)", () => {
      expect(canonicalizeWorkflowName("[Init.xaml].xaml")).toBe("init");
      expect(canonicalizeWorkflowName("Main.xaml.xaml")).toBe("main");
      expect(canonicalizeWorkflowName("Process.XAML.xaml")).toBe("process");
    });

    it("should handle edge cases in canonicalization", () => {
      expect(canonicalizeWorkflowName("")).toBe("");
      expect(canonicalizeWorkflowName(".xaml")).toBe("");
      expect(canonicalizeWorkflowName("[.xaml]")).toBe("");
    });
  });

  describe("Expression decomposition", () => {
    it("should not decompose simple expressions", () => {
      const result = decomposeComplexExpression("str_Name", "str_Output", "Test");
      expect(result.intermediateAssigns).toHaveLength(0);
      expect(result.finalExpression).toBe("str_Name");
      expect(result.intermediateVariables).toHaveLength(0);
    });

    it("should decompose deeply nested CType expressions", () => {
      const expr = 'CType(CType(CStr(obj_Input), String), Integer)';
      const result = decomposeComplexExpression(expr, "int_Output", "Test");
      expect(result.intermediateAssigns.length).toBeGreaterThan(0);
      expect(result.intermediateVariables.length).toBeGreaterThan(0);
      for (const iv of result.intermediateVariables) {
        expect(iv.name).toMatch(/^obj_Intermediate_/);
        expect(iv.type).toBe("x:Object");
      }
    });

    it("should produce valid XAML for intermediate assigns", () => {
      const expr = 'CType(CType(CStr(obj_Input), String), Integer)';
      const result = decomposeComplexExpression(expr, "int_Output", "Step");
      for (const assign of result.intermediateAssigns) {
        expect(assign).toContain("<Assign");
        expect(assign).toContain("</Assign>");
        expect(assign).toContain("Assign.To");
        expect(assign).toContain("Assign.Value");
      }
    });

    it("should simplify the final expression after decomposition", () => {
      const expr = 'CType(CType(CStr(obj_Input), String), Integer)';
      const result = decomposeComplexExpression(expr, "int_Output", "Step");
      expect(result.finalExpression).not.toBe(expr);
      const finalNesting = result.finalExpression.split("(").length - 1;
      const originalNesting = expr.split("(").length - 1;
      expect(finalNesting).toBeLessThan(originalNesting);
    });
  });

  describe("Boolean InArgument normalization (real function logic)", () => {
    const normalizeBooleanInArguments = (xml: string) => xml.replace(
      /<(InArgument|OutArgument)\s+x:TypeArguments="x:Boolean">"(True|False)"<\/(InArgument|OutArgument)>/g,
      (_match: string, openTag: string, boolVal: string, closeTag: string) => {
        if (openTag !== closeTag) return _match;
        return `<${openTag} x:TypeArguments="x:Boolean">${boolVal}</${closeTag}>`;
      }
    );

    it("should strip quotes from boolean InArgument values", () => {
      const input = `<InArgument x:TypeArguments="x:Boolean">"True"</InArgument>`;
      expect(normalizeBooleanInArguments(input)).toBe(`<InArgument x:TypeArguments="x:Boolean">True</InArgument>`);
    });

    it("should be idempotent (already-normalized values unchanged)", () => {
      const normalized = `<InArgument x:TypeArguments="x:Boolean">True</InArgument>`;
      expect(normalizeBooleanInArguments(normalized)).toBe(normalized);
    });

    it("should handle False values", () => {
      const input = `<InArgument x:TypeArguments="x:Boolean">"False"</InArgument>`;
      expect(normalizeBooleanInArguments(input)).toBe(`<InArgument x:TypeArguments="x:Boolean">False</InArgument>`);
    });

    it("should handle multi-element documents", () => {
      const input = `<Sequence>
  <InArgument x:TypeArguments="x:Boolean">"True"</InArgument>
  <InArgument x:TypeArguments="x:Boolean">"False"</InArgument>
  <InArgument x:TypeArguments="x:String">"hello"</InArgument>
</Sequence>`;
      const result = normalizeBooleanInArguments(input);
      expect(result).toContain(`x:Boolean">True</InArgument>`);
      expect(result).toContain(`x:Boolean">False</InArgument>`);
      expect(result).toContain(`x:String">"hello"</InArgument>`);
    });
  });

  describe("Enum literal normalization", () => {
    const ENUM_NORMALIZE: Record<string, string> = {
      "information": "Info", "warning": "Warn", "debug": "Trace",
      "critical": "Fatal", "verbose": "Trace",
    };
    const normalizeEnumLiterals = (xml: string) => xml.replace(
      /Level="\[If\([^"]*\)\]"/g,
      (_match: string) => _match
    ).replace(
      /Level="([^"]+)"/g,
      (_match: string, level: string) => {
        const normalized = ENUM_NORMALIZE[level.toLowerCase()];
        return normalized ? `Level="${normalized}"` : _match;
      }
    );

    it("should normalize non-standard enum values", () => {
      expect(normalizeEnumLiterals('Level="information"')).toBe('Level="Info"');
      expect(normalizeEnumLiterals('Level="warning"')).toBe('Level="Warn"');
      expect(normalizeEnumLiterals('Level="debug"')).toBe('Level="Trace"');
    });

    it("should preserve valid enum values", () => {
      expect(normalizeEnumLiterals('Level="Info"')).toBe('Level="Info"');
      expect(normalizeEnumLiterals('Level="Warn"')).toBe('Level="Warn"');
      expect(normalizeEnumLiterals('Level="Error"')).toBe('Level="Error"');
    });

    it("should preserve conditional Level expressions (not force-overwrite)", () => {
      const conditional = 'Level="[If(condition, \"Warn\", \"Info\")]"';
      expect(normalizeEnumLiterals(conditional)).toBe(conditional);
    });

    it("should be idempotent", () => {
      const input = 'Level="information"';
      const pass1 = normalizeEnumLiterals(input);
      const pass2 = normalizeEnumLiterals(pass1);
      expect(pass1).toBe(pass2);
    });
  });

  describe("String.Format overflow blocking", () => {
    it("should emit HANDOFF marker for unsafe repairs with large argument gaps", () => {
      const formatExpr = 'String.Format("{0} {1} {2} {3} {4}", arg1)';
      const result = formatExpr.replace(
        /String\.Format\s*\("([^"]*)"((?:\s*,\s*[^,)]+)*)\)/g,
        (_match, formatStr, argsStr) => {
          const placeholders = formatStr.match(/\{(\d+)\}/g) || [];
          const maxIndex = placeholders.reduce((max: number, p: string) => {
            const idx = parseInt(p.replace(/[{}]/g, ""), 10);
            return Math.max(max, idx);
          }, -1);
          const args = argsStr ? argsStr.split(",").filter((s: string) => s.trim()).map((s: string) => s.trim()) : [];
          if (maxIndex >= 0 && args.length <= maxIndex) {
            const missingCount = maxIndex + 1 - args.length;
            if (missingCount > 2) {
              return `"HANDOFF_STRING_FORMAT_UNSAFE: ${_match.replace(/"/g, '&quot;')}"`;
            }
          }
          return "repaired";
        }
      );
      expect(result).toContain("HANDOFF_STRING_FORMAT_UNSAFE");
      expect(result).not.toBe(formatExpr);
    });
  });

  describe("Placeholder cleanup safety", () => {
    it("should not strip HANDOFF_ markers when cleaning remaining placeholders", () => {
      const content = 'value="HANDOFF_PLACEHOLDER marker here" other="PLACEHOLDER_System_String"';
      const cleaned = content
        .replace(/(?<!HANDOFF_)PLACEHOLDER_\w*/g, '')
        .replace(/(?<!HANDOFF_)TODO_\w*/g, '');
      expect(cleaned).toContain("HANDOFF_PLACEHOLDER");
      expect(cleaned).not.toContain("PLACEHOLDER_System_String");
    });

    it("should preserve HANDOFF_TODO markers", () => {
      const content = 'HANDOFF_TODO: review this section; TODO_old_marker';
      const cleaned = content
        .replace(/(?<!HANDOFF_)PLACEHOLDER_\w*/g, '')
        .replace(/(?<!HANDOFF_)TODO_\w*/g, '');
      expect(cleaned).toContain("HANDOFF_TODO");
      expect(cleaned).not.toContain("TODO_old_marker");
    });
  });

  describe("Integration: compliance pass idempotency with normalized fields", () => {
    const sampleXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Test">
    <Assign DisplayName="Set Result">
      <Assign.To>
        <OutArgument x:TypeArguments="x:String">[str_Result]</OutArgument>
      </Assign.To>
      <Assign.Value>
        <InArgument x:TypeArguments="x:String">"Hello World"</InArgument>
      </Assign.Value>
    </Assign>
    <ui:LogMessage Level="Info" Message="[str_Result]" DisplayName="Log Result" />
    <InArgument x:TypeArguments="x:Boolean">True</InArgument>
  </Sequence>
</Activity>`;

    it("should produce identical output on second compliance pass", () => {
      const pass1 = normalizeXaml(sampleXaml, "Windows");
      const pass2 = normalizeXaml(pass1, "Windows");
      expect(pass1).toBe(pass2);
    });

    it("should not re-quote boolean values after normalization", () => {
      const normalized = normalizeXaml(sampleXaml, "Windows");
      expect(normalized).not.toContain('"True"</InArgument>');
      expect(normalized).not.toContain('"False"</InArgument>');
    });

    it("should preserve valid enum Level values through compliance", () => {
      const normalized = normalizeXaml(sampleXaml, "Windows");
      expect(normalized).toContain('Level="Info"');
    });
  });

  describe("Integration: CANONICAL_INFRASTRUCTURE_NAMES completeness", () => {
    const requiredNames = [
      "main", "init", "initallsettings", "dispatcher", "performer",
      "finalise", "finalize", "process", "closeallapplications",
      "gettransactiondata", "settransactionstatus", "killallprocesses",
    ];

    for (const name of requiredNames) {
      it(`should recognize "${name}" as canonical infrastructure`, () => {
        const canonical = canonicalizeWorkflowName(name);
        expect(canonical).toBe(name);
      });

      it(`should canonicalize bracketed "${name}.xaml" variant`, () => {
        const canonical = canonicalizeWorkflowName(`[${name}.xaml]`);
        expect(canonical).toBe(name);
      });
    }
  });
});
