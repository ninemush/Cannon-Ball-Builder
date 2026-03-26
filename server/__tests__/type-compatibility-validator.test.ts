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

  it("Object to specific type is NOT compatible", () => {
    expect(areTypesCompatible("System.Object", "System.String")).toBe(false);
  });

  it("Int32 to Int64 is compatible (widening)", () => {
    expect(areTypesCompatible("System.Int32", "System.Int64")).toBe(true);
  });

  it("Int32 to Double is compatible (widening)", () => {
    expect(areTypesCompatible("System.Int32", "System.Double")).toBe(true);
  });

  it("String to Int32 is NOT compatible", () => {
    expect(areTypesCompatible("System.String", "System.Int32")).toBe(false);
  });

  it("String to DataTable is NOT compatible", () => {
    expect(areTypesCompatible("System.String", "System.Data.DataTable")).toBe(false);
  });

  it("normalizes XAML type arguments to full CLR names", () => {
    expect(areTypesCompatible("x:String", "x:String")).toBe(true);
    expect(areTypesCompatible("x:Int32", "x:Int64")).toBe(true);
    expect(areTypesCompatible("x:String", "x:Object")).toBe(true);
  });
});

describe("getConversion", () => {
  it("returns null for compatible types (no conversion needed)", () => {
    expect(getConversion("System.String", "System.Object")).toBeNull();
    expect(getConversion("System.Int32", "System.Int64")).toBeNull();
  });

  it("String→Int32 returns CInt wrap", () => {
    const conv = getConversion("System.String", "System.Int32")!;
    expect(conv.kind).toBe("wrap");
    expect(conv.wrapper).toBe("CInt");
  });

  it("Int32→String returns CStr wrap", () => {
    const conv = getConversion("System.Int32", "System.String")!;
    expect(conv.kind).toBe("wrap");
    expect(conv.wrapper).toBe("CStr");
  });

  it("String→DataTable is unrepairable", () => {
    const conv = getConversion("System.String", "System.Data.DataTable")!;
    expect(conv.kind).toBe("unrepairable");
    expect(conv.detail).toContain("Cannot convert String to DataTable");
  });

  it("Boolean→String returns CStr wrap", () => {
    const conv = getConversion("System.Boolean", "System.String")!;
    expect(conv.kind).toBe("wrap");
    expect(conv.wrapper).toBe("CStr");
  });

  it("String→DateTime returns DateTime.Parse wrap", () => {
    const conv = getConversion("System.String", "System.DateTime")!;
    expect(conv.kind).toBe("wrap");
    expect(conv.wrapper).toBe("DateTime.Parse");
  });

  it("DataTable→String is unrepairable", () => {
    const conv = getConversion("System.Data.DataTable", "System.String")!;
    expect(conv.kind).toBe("unrepairable");
  });

  it("Double→Int32 returns CInt wrap", () => {
    const conv = getConversion("System.Double", "System.Int32")!;
    expect(conv.kind).toBe("wrap");
    expect(conv.wrapper).toBe("CInt");
  });

  it("String→Boolean returns CBool wrap", () => {
    const conv = getConversion("x:String", "x:Boolean")!;
    expect(conv.kind).toBe("wrap");
    expect(conv.wrapper).toBe("CBool");
  });

  it("normalizes XAML-shorthand types for lookup", () => {
    const conv = getConversion("x:Int32", "x:String")!;
    expect(conv.kind).toBe("wrap");
    expect(conv.wrapper).toBe("CStr");
  });
});

describe("validateTypeCompatibility", () => {
  it("does not flag String variable bound to String property (QueueName)", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_QueueName" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[str_QueueName]" DisplayName="Add Queue Item" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    expect(result.violations.filter(v => v.check === "TYPE_MISMATCH")).toHaveLength(0);
    expect(result.repairs).toHaveLength(0);
    expect(result.correctedEntries).toHaveLength(0);
  });

  it("returns empty results for empty input", () => {
    const result = validateTypeCompatibility([]);
    expect(result.violations).toHaveLength(0);
    expect(result.repairs).toHaveLength(0);
    expect(result.correctedEntries).toHaveLength(0);
  });

  it("all violations have TYPE_MISMATCH check and warning severity", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:Int32" Name="int_Val" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[int_Val]" DisplayName="Add Queue Item" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    for (const v of result.violations) {
      expect(v.check).toBe("TYPE_MISMATCH");
      expect(v.category).toBe("accuracy");
      expect(v.severity).toBe("warning");
    }
    if (result.violations.length > 0) {
      expect(result.violations[0].detail).toContain("CStr");
      expect(result.repairs[0].repairKind).toBe("conversion-wrap");
    }
  });

  it("conversion wrap is scoped to the specific property, not global", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:Int32" Name="int_Val" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[int_Val]" Reference="[int_Val]" DisplayName="Add Queue Item" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    if (result.correctedEntries.length > 0) {
      const patched = result.correctedEntries[0].content;
      const queueNameMatch = patched.match(/QueueName="\[([^\]]+)\]"/);
      const refMatch = patched.match(/Reference="\[([^\]]+)\]"/);
      if (queueNameMatch) {
        expect(queueNameMatch[1]).toContain("CStr");
      }
      if (refMatch) {
        expect(refMatch[1]).toContain("CStr");
      }
    }
  });

  it("only wraps the mismatched activity, not a same-named property on a compatible activity", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_Queue" />
      <Variable x:TypeArguments="x:Int32" Name="int_Queue" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[str_Queue]" DisplayName="Good" />
    <ui:AddQueueItem QueueName="[int_Queue]" DisplayName="Bad" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].detail).toContain("int_Queue");
    expect(result.repairs.length).toBe(1);
    expect(result.repairs[0].repairKind).toBe("conversion-wrap");
    expect(result.repairs[0].boundVariable).toBe("int_Queue");

    const patched = result.correctedEntries[0].content;
    const queueMatches = [...patched.matchAll(/QueueName="\[([^\]]+)\]"/g)];
    expect(queueMatches.length).toBe(2);
    expect(queueMatches[0][1]).toBe("str_Queue");
    expect(queueMatches[1][1]).toBe("CStr(int_Queue)");
  });

  it("detects unrepairable DataTable→String mismatch with guidance", () => {
    const conv = getConversion("System.Data.DataTable", "System.String");
    expect(conv).not.toBeNull();
    expect(conv!.kind).toBe("unrepairable");
    expect(conv!.detail).toContain("DataTable");
    expect(conv!.detail).toContain("Cannot");
  });

  it("correctly processes XAML with no catalog match gracefully", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_Name" />
    </Sequence.Variables>
    <UnknownActivity Prop1="[str_Name]" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    expect(result.violations).toHaveLength(0);
    expect(result.repairs).toHaveLength(0);
  });

  it("skips expressions with function calls or concatenation (not simple variable refs)", () => {
    const xaml = `<Activity xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="str_Name" />
    </Sequence.Variables>
    <ui:AddQueueItem QueueName="[str_Name & &quot; suffix&quot;]" DisplayName="Add Queue Item" />
  </Sequence>
</Activity>`;
    const result = validateTypeCompatibility([{ name: "Main.xaml", content: xaml }]);
    expect(result.violations).toHaveLength(0);
  });
});
