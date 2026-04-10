import { describe, it, expect } from "vitest";
import { canonicalizeWorkflowName, detectFinalDedupCollisions, runStudioResolutionSmokeTest } from "../package-assembler";
import { injectInArgumentTypeArguments } from "../xaml/xaml-compliance";
import { lintExpression, isComplexExpression } from "../xaml/vbnet-expression-linter";

describe("Task 366: Artifact Dependency Truth & Resolution Invariants", () => {

  describe("canonicalizeWorkflowName dedup for bracket-named files", () => {
    it("should strip brackets and quotes from workflow names", () => {
      expect(canonicalizeWorkflowName("[GetTodayBirthdays.xaml]")).toBe("gettodaybirthdays");
      expect(canonicalizeWorkflowName("GetTodayBirthdays")).toBe("gettodaybirthdays");
    });

    it("should produce same canonical for bracket-wrapped and plain names", () => {
      const plain = canonicalizeWorkflowName("GetTodayBirthdays");
      const bracketed = canonicalizeWorkflowName("[GetTodayBirthdays.xaml]");
      expect(plain).toBe(bracketed);
    });

    it("should handle double .xaml extensions", () => {
      const result = canonicalizeWorkflowName("[GetTodayBirthdays.xaml].xaml");
      expect(result).toBe("gettodaybirthdays");
    });

    it("should handle quoted names", () => {
      const result = canonicalizeWorkflowName('"SendBirthdayEmail"');
      expect(result).toBe("sendbirthdayemail");
    });

    it("should handle &quot; entity names", () => {
      const result = canonicalizeWorkflowName("&quot;ProcessBirthdays&quot;");
      expect(result).toBe("processbirthdays");
    });
  });

  describe("Final dedup gate collision detection", () => {
    it("should detect bracket-named duplicate and reject it", () => {
      const paths = [
        "lib/GetTodayBirthdays.xaml",
        "lib/[GetTodayBirthdays.xaml].xaml",
      ];
      const result = detectFinalDedupCollisions(paths);
      expect(result.dupsToRemove).toHaveLength(1);
      expect(result.dupsToRemove[0]).toBe("lib/[GetTodayBirthdays.xaml].xaml");
      expect(result.collisionDetails).toHaveLength(1);
      expect(result.collisionDetails[0]).toContain("Rejected bracket-named");
    });

    it("should prefer plain name over bracket-named when bracket comes first", () => {
      const paths = [
        "lib/[Init.xaml].xaml",
        "lib/Init.xaml",
      ];
      const result = detectFinalDedupCollisions(paths);
      expect(result.dupsToRemove).toHaveLength(1);
      expect(result.dupsToRemove[0]).toBe("lib/[Init.xaml].xaml");
      expect(result.collisionDetails[0]).toContain("Rejected bracket-named");
    });

    it("should detect quoted-name duplicates", () => {
      const paths = [
        'lib/Process.xaml',
        'lib/"Process".xaml',
      ];
      const result = detectFinalDedupCollisions(paths);
      expect(result.dupsToRemove).toHaveLength(1);
      expect(result.collisionDetails).toHaveLength(1);
    });

    it("should return empty for no collisions", () => {
      const paths = [
        "lib/Main.xaml",
        "lib/Process.xaml",
        "lib/Init.xaml",
      ];
      const result = detectFinalDedupCollisions(paths);
      expect(result.dupsToRemove).toHaveLength(0);
      expect(result.collisionDetails).toHaveLength(0);
    });

    it("should skip non-xaml files", () => {
      const paths = [
        "project.json",
        "lib/Main.xaml",
        "lib/Main.json",
      ];
      const result = detectFinalDedupCollisions(paths);
      expect(result.dupsToRemove).toHaveLength(0);
    });

    it("should detect &quot; entity name collisions", () => {
      const paths = [
        "lib/Process.xaml",
        "lib/&quot;Process&quot;.xaml",
      ];
      const result = detectFinalDedupCollisions(paths);
      expect(result.dupsToRemove).toHaveLength(1);
      expect(result.collisionDetails).toHaveLength(1);
    });
  });

  describe("Studio resolution smoke test", () => {
    it("should pass when all prefixes are declared and deps are present", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", `
        <Activity xmlns:ui="http://schemas.uipath.com/workflow/activities"
                  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
          <AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>
          <x:String>clr-namespace:UiPath.Core.Activities</x:String>
          <TextExpression.NamespacesForImplementation>
            <sco:Collection x:TypeArguments="x:String">
              <x:String>UiPath.Core.Activities</x:String>
            </sco:Collection>
          </TextExpression.NamespacesForImplementation>
          <TextExpression.ReferencesForImplementation>
            <sco:Collection x:TypeArguments="AssemblyReference">
              <AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>
            </sco:Collection>
          </TextExpression.ReferencesForImplementation>
          <ui:TypeInto />
        </Activity>
      `);
      const deps = { "UiPath.UIAutomation.Activities": "25.10.0" };
      const result = runStudioResolutionSmokeTest(deferredWrites, deps);
      expect(result.errors).toHaveLength(0);
    });

    it("should error when prefix is undeclared", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", `
        <Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
          <ui:TypeInto />
        </Activity>
      `);
      const deps = {};
      const result = runStudioResolutionSmokeTest(deferredWrites, deps);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes("undeclared namespace prefix"))).toBe(true);
    });

    it("should skip non-xaml files", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("project.json", '{"dependencies":{}}');
      const deps = {};
      const result = runStudioResolutionSmokeTest(deferredWrites, deps);
      expect(result.errors).toHaveLength(0);
    });

    it("should skip standard prefixes like x, sap, mc", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", `
        <Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
                  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation">
          <TextExpression.NamespacesForImplementation>
            <sco:Collection x:TypeArguments="x:String" />
          </TextExpression.NamespacesForImplementation>
          <TextExpression.ReferencesForImplementation>
            <sco:Collection x:TypeArguments="AssemblyReference" />
          </TextExpression.ReferencesForImplementation>
          <x:Property Name="test" />
          <sap:VirtualizedContainerService />
        </Activity>
      `);
      const deps = {};
      const result = runStudioResolutionSmokeTest(deferredWrites, deps);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("InArgument x:TypeArguments injection", () => {
    it("should add x:TypeArguments for bare integer InArgument", () => {
      const input = '<InArgument>0</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toContain('x:TypeArguments="x:Int32"');
      expect(result).toContain(">0</InArgument>");
    });

    it("should add x:TypeArguments for bare decimal InArgument", () => {
      const input = '<InArgument>3.14</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toContain('x:TypeArguments="x:Double"');
    });

    it("should add x:TypeArguments for boolean InArgument", () => {
      const input = '<InArgument>True</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toContain('x:TypeArguments="x:Boolean"');
    });

    it("should not double-inject x:TypeArguments when already present", () => {
      const input = '<InArgument x:TypeArguments="x:Int32">0</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toBe(input);
    });

    it("should not inject for string content", () => {
      const input = '<InArgument>[myVariable]</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toBe(input);
    });

    it("should handle OutArgument similarly", () => {
      const input = '<OutArgument>42</OutArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toContain('x:TypeArguments="x:Int32"');
    });

    it("should handle negative integers", () => {
      const input = '<InArgument>-5</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toContain('x:TypeArguments="x:Int32"');
    });

    it("should handle negative decimals", () => {
      const input = '<InArgument>-3.14</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toContain('x:TypeArguments="x:Double"');
    });

    it("should handle scientific notation", () => {
      const input = '<InArgument>1.5e10</InArgument>';
      const result = injectInArgumentTypeArguments(input);
      expect(result).toContain('x:TypeArguments="x:Double"');
    });
  });

  describe("VB expression complexity detection", () => {
    it("should detect lambda expressions as complex", () => {
      expect(isComplexExpression("Function(x) x.Name")).toBe(true);
    });

    it("should not detect simple C# arrow lambdas as complex (linter auto-fixes those)", () => {
      expect(isComplexExpression("(x) => x.Name")).toBe(false);
    });

    it("should detect LINQ expressions as complex", () => {
      expect(isComplexExpression("From item In collection Select item.Name")).toBe(true);
    });

    it("should not flag simple expressions as complex", () => {
      expect(isComplexExpression("myVariable")).toBe(false);
      expect(isComplexExpression("str_Name")).toBe(false);
      expect(isComplexExpression("CInt(str_Value)")).toBe(false);
    });

    it("should not flag simple comparisons as complex", () => {
      expect(isComplexExpression("x = 5")).toBe(false);
      expect(isComplexExpression("a > b")).toBe(false);
    });

    it("should detect nested function calls with multiple operators as complex", () => {
      expect(isComplexExpression("If(a > b AndAlso c < d, CStr(CInt(x) + y), result & suffix)")).toBe(true);
    });
  });

  describe("VB expression linter safe-by-default for complex expressions", () => {
    it("should pass through complex expressions without modification", () => {
      const complexExpr = "From row In dt_Birthdays.AsEnumerable() Where CDate(row(\"Birthday\")).Month = Today.Month Select row";
      const result = lintExpression(complexExpr);
      expect(result.corrected).toBeNull();
      expect(result.issues.some(i => i.code === "COMPLEX_EXPRESSION_PASSTHROUGH")).toBe(true);
    });

    it("should still lint simple expressions normally", () => {
      const simpleExpr = "myVar != null";
      const result = lintExpression(simpleExpr);
      expect(result.corrected).not.toBeNull();
      expect(result.issues.some(i => i.code === "CSHARP_NOT_EQUAL")).toBe(true);
    });

    it("should pass through lambda expressions unchanged", () => {
      const lambdaExpr = "Function(x) x.ToString()";
      const result = lintExpression(lambdaExpr);
      expect(result.corrected).toBeNull();
      expect(result.issues.some(i => i.code === "COMPLEX_EXPRESSION_PASSTHROUGH")).toBe(true);
    });
  });
});
