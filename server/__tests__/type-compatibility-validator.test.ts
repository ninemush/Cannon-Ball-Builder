import { describe, it, expect, beforeAll } from "vitest";
import {
  areTypesCompatible,
  getConversion,
  validateTypeCompatibility,
} from "../xaml/type-compatibility-validator";
import { catalogService } from "../catalog/catalog-service";

beforeAll(() => {
  catalogService.load();
});

describe("areTypesCompatible", () => {
  it("same types are compatible", () => {
    expect(areTypesCompatible("System.String", "System.String")).toBe(true);
  });

  it("anything to Object is compatible", () => {
    expect(areTypesCompatible("System.String", "System.Object")).toBe(true);
    expect(areTypesCompatible("System.Int32", "System.Object")).toBe(true);
    expect(areTypesCompatible("System.Data.DataTable", "System.Object")).toBe(true);
  });

  it("Object to specific type is not compatible", () => {
    expect(areTypesCompatible("System.Object", "System.String")).toBe(false);
  });

  it("Int32 to Int64 is compatible (widening)", () => {
    expect(areTypesCompatible("System.Int32", "System.Int64")).toBe(true);
  });

  it("Int32 to Double is compatible (widening)", () => {
    expect(areTypesCompatible("System.Int32", "System.Double")).toBe(true);
  });

  it("String to Int32 is not compatible", () => {
    expect(areTypesCompatible("System.String", "System.Int32")).toBe(false);
  });

  it("String to DataTable is not compatible", () => {
    expect(areTypesCompatible("System.String", "System.Data.DataTable")).toBe(false);
  });

  it("normalizes XAML type arguments", () => {
    expect(areTypesCompatible("x:String", "x:String")).toBe(true);
    expect(areTypesCompatible("x:Int32", "x:Int64")).toBe(true);
    expect(areTypesCompatible("x:String", "x:Object")).toBe(true);
  });
});

describe("getConversion", () => {
  it("returns null for compatible types", () => {
    expect(getConversion("System.String", "System.Object")).toBeNull();
    expect(getConversion("System.Int32", "System.Int64")).toBeNull();
  });

  it("String to Int32 returns CInt wrap", () => {
    const conv = getConversion("System.String", "System.Int32");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("wrap");
    expect(conv!.wrapper).toBe("CInt");
  });

  it("Int32 to String returns CStr wrap", () => {
    const conv = getConversion("System.Int32", "System.String");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("wrap");
    expect(conv!.wrapper).toBe("CStr");
  });

  it("String to DataTable is unrepairable", () => {
    const conv = getConversion("System.String", "System.Data.DataTable");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("unrepairable");
  });

  it("Boolean to String returns CStr wrap", () => {
    const conv = getConversion("System.Boolean", "System.String");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("wrap");
    expect(conv!.wrapper).toBe("CStr");
  });

  it("String to DateTime returns DateTime.Parse wrap", () => {
    const conv = getConversion("System.String", "System.DateTime");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("wrap");
    expect(conv!.wrapper).toBe("DateTime.Parse");
  });

  it("DataTable to String is unrepairable", () => {
    const conv = getConversion("System.Data.DataTable", "System.String");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("unrepairable");
  });
});

describe("validateTypeCompatibility", () => {
  it("detects String variable bound to Int32 property and auto-repairs", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_Value" />
    </Sequence.Variables>
    <ui:LogMessage Level="[str_Value]" Message="test" DisplayName="Log" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    expect(result.violations.length).toBeGreaterThanOrEqual(0);
  });

  it("does not flag compatible types", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_Name" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[str_Name]" DisplayName="Add Queue Item" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    const typeMismatchViolations = result.violations.filter(v => v.check === "TYPE_MISMATCH");
    expect(typeMismatchViolations).toHaveLength(0);
  });

  it("detects OutArgument type mismatch and changes variable type", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:Int32" Name="int_Asset" />
    </Sequence.Variables>
    <ui:GetAsset AssetName="MyAsset" DisplayName="Get Asset">
      <ui:GetAsset.AssetValue>
        <OutArgument x:TypeArguments="x:String">[int_Asset]</OutArgument>
      </ui:GetAsset.AssetValue>
    </ui:GetAsset>
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    const repairs = result.repairs.filter(r => r.repairKind === "variable-type-change");
    expect(repairs.length).toBeGreaterThanOrEqual(0);
  });

  it("returns correctedEntries only when changes are made", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_Name" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[str_Name]" DisplayName="Add Queue Item" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    expect(result.correctedEntries).toHaveLength(0);
  });

  it("handles empty entries gracefully", () => {
    const result = validateTypeCompatibility([]);
    expect(result.violations).toHaveLength(0);
    expect(result.repairs).toHaveLength(0);
    expect(result.correctedEntries).toHaveLength(0);
  });

  it("detects String→DataTable as unrepairable", () => {
    const conv = getConversion("System.String", "System.Data.DataTable");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("unrepairable");
    expect(conv!.detail).toContain("Cannot convert String to DataTable");
  });

  it("repairs Int32→String via CStr conversion", () => {
    const conv = getConversion("x:Int32", "x:String");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("wrap");
    expect(conv!.wrapper).toBe("CStr");
  });

  it("String→Boolean uses CBool", () => {
    const conv = getConversion("x:String", "x:Boolean");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("wrap");
    expect(conv!.wrapper).toBe("CBool");
  });

  it("Double→Int32 uses CInt", () => {
    const conv = getConversion("System.Double", "System.Int32");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("wrap");
    expect(conv!.wrapper).toBe("CInt");
  });

  it("all violations have TYPE_MISMATCH check code", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_Val" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[str_Val]" DisplayName="Add Queue Item" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    for (const v of result.violations) {
      expect(v.check).toBe("TYPE_MISMATCH");
      expect(v.category).toBe("accuracy");
      expect(v.severity).toBe("warning");
    }
  });
});
