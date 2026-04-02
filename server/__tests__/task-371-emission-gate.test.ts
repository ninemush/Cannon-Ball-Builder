import { describe, it, expect, beforeAll } from "vitest";
import { runEmissionGate, isWellFormedXamlType, validateMapClrTypeOutput, reportCriticalTypeDiagnostic, drainCriticalTypeDiagnostics } from "../emission-gate";
import { catalogService } from "../catalog/catalog-service";

function makeXaml(bodyXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010 sads" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:s="clr-namespace:System;assembly=mscorlib">
  <Sequence>
    ${bodyXml}
  </Sequence>
</Activity>`;
}

beforeAll(() => {
  if (!catalogService.isLoaded()) {
    try {
      catalogService.load();
    } catch (e) {
    }
  }
});

describe("Emission Gate — Activity Enforcement", () => {
  it("(a) detects and stubs an emissionApproved:false activity in a simple Sequence context", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping activity enforcement test");
      return;
    }

    const schema = catalogService.getActivitySchema("GoogleCalendarGetEvents");
    if (!schema) {
      console.warn("GoogleCalendarGetEvents not in catalog — skipping test");
      return;
    }
    expect(schema.activity.emissionApproved).toBe(false);

    const xaml = makeXaml(`
      <ui:LogMessage Level="Info" Message="&quot;Hello&quot;" />
      <ui:GoogleCalendarGetEvents CalendarId="primary" />
      <ui:LogMessage Level="Info" Message="&quot;Done&quot;" />
    `);

    const entries = [{ name: "Test.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBeGreaterThan(0);
    const stubbed = actViolations.filter(v => v.resolution === "stubbed");
    expect(stubbed.length).toBeGreaterThan(0);
    expect(entries[0].content).toContain("[STUBBED]");
    expect(entries[0].content).not.toMatch(/<ui:GoogleCalendarGetEvents\b/);
    expect(entries[0].content).toContain("ui:Comment");
    expect(entries[0].content).toContain("ui:LogMessage");
  });

  it("(b) blocks packaging when unapproved activity is inside a RetryScope container", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("GoogleCalendarGetEvents");
    if (!schema) {
      console.warn("GoogleCalendarGetEvents not in catalog — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <ui:RetryScope NumberOfRetries="3">
        <ui:RetryScope.ActivityBody>
          <ui:GoogleCalendarGetEvents CalendarId="primary" />
        </ui:RetryScope.ActivityBody>
      </ui:RetryScope>
    `);

    const entries = [{ name: "RetryTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBeGreaterThan(0);
    const blocked = actViolations.filter(v => v.resolution === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("(b) blocks packaging when unapproved activity is inside an If container", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("GoogleCalendarCreateEvent");
    if (!schema) {
      console.warn("GoogleCalendarCreateEvent not in catalog — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <If Condition="[True]">
        <If.Then>
          <Sequence>
            <ui:GoogleCalendarCreateEvent />
          </Sequence>
        </If.Then>
      </If>
    `);

    const entries = [{ name: "IfTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBeGreaterThan(0);
    const blocked = actViolations.filter(v => v.resolution === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("(f) blocks packaging when unapproved activity is an orchestration node", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <ui:FakeUnknownActivity DoSomething="yes" />
    `);

    const entries = [{ name: "UnknownTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBeGreaterThan(0);
    expect(actViolations[0].detail).toContain("not found in activity catalog");
  });

  it("allows emission-approved activities to pass without violations", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <ui:LogMessage Level="Info" Message="&quot;Hello&quot;" />
      <ui:Comment DisplayName="Test comment" />
    `);

    const entries = [{ name: "ApprovedTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBe(0);
  });
});

describe("Emission Gate — Type String Validation", () => {
  it("(c) corrects malformed type string in a non-critical context (local variable) to x:Object", () => {
    const xaml = makeXaml(`
      <Variable x:TypeArguments="clr-namespace:Bad[Type" Name="localVar" />
      <ui:LogMessage Level="Info" Message="&quot;test&quot;" />
    `);

    const entries = [{ name: "TypeTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const typeViolations = result.violations.filter(v => v.type === "malformed-type");
    expect(typeViolations.length).toBeGreaterThan(0);

    const corrected = typeViolations.filter(v => v.resolution === "corrected");
    expect(corrected.length).toBeGreaterThan(0);
    expect(entries[0].content).toContain('x:TypeArguments="x:Object"');
    expect(entries[0].content).not.toContain("clr-namespace:Bad[Type");
  });

  it("(d) blocks packaging for malformed type string in a critical context (x:Property argument)", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <x:Members>
    <x:Property Name="in_Config" Type="InArgument(clr-namespace:System[Collections)" />
  </x:Members>
  <Sequence>
    <Assign DisplayName="Test" />
  </Sequence>
</Activity>`;

    const entries = [{ name: "CriticalTypeTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const typeViolations = result.violations.filter(v => v.type === "malformed-type");
    expect(typeViolations.length).toBeGreaterThan(0);

    const blocked = typeViolations.filter(v => v.resolution === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("blocks packaging for malformed type in InArgument (critical context)", () => {
    const xaml = makeXaml(`
      <Assign>
        <Assign.Value>
          <InArgument x:TypeArguments="scg:Dictionary(x:String" />
        </Assign.Value>
      </Assign>
    `);

    const entries = [{ name: "InArgCritical.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const typeViolations = result.violations.filter(v => v.type === "malformed-type");
    expect(typeViolations.length).toBeGreaterThan(0);
    const blocked = typeViolations.filter(v => v.resolution === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("treats typed collections (scg:List, scg:Dictionary) as critical type context", () => {
    const xaml = makeXaml(`
      <Variable x:TypeArguments="scg:List(clr-namespace:Bad[Item" Name="typedList" />
    `);

    const entries = [{ name: "CollectionType.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const typeViolations = result.violations.filter(v => v.type === "malformed-type");
    expect(typeViolations.length).toBeGreaterThan(0);
  });
});

describe("Emission Gate — Sentinel Expression Cleanup", () => {
  it("(e) cleans sentinel expressions from XAML attributes", () => {
    const xaml = makeXaml(`
      <ui:LogMessage Level="Info" Message="HANDOFF_STRING_FORMAT_UNSAFE: something" />
      <Assign>
        <Assign.To><OutArgument x:TypeArguments="x:String">[result]</OutArgument></Assign.To>
        <Assign.Value><InArgument x:TypeArguments="x:String">"STUB_BLOCKING_FALLBACK placeholder"</InArgument></Assign.Value>
      </Assign>
      <ui:LogMessage Level="Warn" Message="&quot;ASSEMBLY_FAILED_LOOKUP result&quot;" />
    `);

    const entries = [{ name: "SentinelTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const sentinelViolations = result.violations.filter(v => v.type === "sentinel-expression");
    expect(sentinelViolations.length).toBeGreaterThan(0);
    expect(entries[0].content).not.toMatch(/HANDOFF_STRING_FORMAT_UNSAFE/);
    expect(entries[0].content).not.toMatch(/STUB_BLOCKING_FALLBACK/);
    expect(entries[0].content).not.toMatch(/ASSEMBLY_FAILED_LOOKUP/);
  });

  it("preserves XML well-formedness after sentinel cleanup", () => {
    const xaml = makeXaml(`
      <ui:LogMessage Level="Info" Message="HANDOFF_TEST: test sentinel" />
    `);

    const entries = [{ name: "WellFormed.xaml", content: xaml }];
    runEmissionGate(entries);

    expect(entries[0].content).not.toMatch(/HANDOFF_TEST/);
    expect(entries[0].content).toContain("<ui:LogMessage");
    expect(entries[0].content).toContain("/>");
  });
});

describe("Emission Gate — Summary Reporting", () => {
  it("reports correct counts in summary", () => {
    const xaml = makeXaml(`
      <Variable x:TypeArguments="clr-namespace:Bad[Type" Name="localVar" />
      <ui:LogMessage Level="Info" Message="HANDOFF_TEST sentinel" />
    `);

    const entries = [{ name: "SummaryTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    expect(result.summary.totalViolations).toBeGreaterThan(0);
    expect(result.summary.totalViolations).toBe(
      result.summary.stubbed + result.summary.corrected + result.summary.blocked
    );
  });
});

describe("isWellFormedXamlType", () => {
  it("accepts valid XAML types", () => {
    expect(isWellFormedXamlType("x:String")).toBe(true);
    expect(isWellFormedXamlType("x:Int32")).toBe(true);
    expect(isWellFormedXamlType("scg:Dictionary(x:String, x:Object)")).toBe(true);
    expect(isWellFormedXamlType("scg:List(x:String)")).toBe(true);
    expect(isWellFormedXamlType("s:DateTime")).toBe(true);
  });

  it("rejects malformed types", () => {
    expect(isWellFormedXamlType("clr-namespace:Bad[Type")).toBe(false);
    expect(isWellFormedXamlType("System[Collections")).toBe(false);
    expect(isWellFormedXamlType("scg:Dictionary(x:String")).toBe(false);
    expect(isWellFormedXamlType("")).toBe(false);
  });

  it("rejects unbalanced braces", () => {
    expect(isWellFormedXamlType("Dict{x:String")).toBe(false);
    expect(isWellFormedXamlType("List(x:String")).toBe(false);
  });
});

describe("validateMapClrTypeOutput", () => {
  it("validates well-formed output", () => {
    const result = validateMapClrTypeOutput("string", "x:String", "non-critical");
    expect(result.valid).toBe(true);
  });

  it("blocks malformed output in critical context", () => {
    const result = validateMapClrTypeOutput("bad[type", "bad[type", "critical");
    expect(result.valid).toBe(false);
    expect(result.diagnostic).toBeDefined();
    expect(result.fallback).toBeUndefined();
  });

  it("falls back to x:Object for malformed output in non-critical context", () => {
    const result = validateMapClrTypeOutput("bad[type", "bad[type", "non-critical");
    expect(result.valid).toBe(false);
    expect(result.fallback).toBe("x:Object");
  });

  it("detects clr-namespace with brackets in any context", () => {
    const critical = validateMapClrTypeOutput(
      "clr-namespace:Foo[Bar",
      "clr-namespace:Foo[Bar",
      "critical"
    );
    expect(critical.valid).toBe(false);
    expect(critical.diagnostic).toBeDefined();

    const nonCritical = validateMapClrTypeOutput(
      "clr-namespace:Foo[Bar",
      "clr-namespace:Foo[Bar",
      "non-critical"
    );
    expect(nonCritical.valid).toBe(false);
    expect(nonCritical.fallback).toBe("x:Object");
  });
});

describe("Emission Gate — Critical mapClrType Blocking Propagation", () => {
  it("critical type diagnostics reported via reportCriticalTypeDiagnostic are drained by runEmissionGate and block packaging", () => {
    drainCriticalTypeDiagnostics();

    reportCriticalTypeDiagnostic({
      inputType: "SomeUnknown[Type",
      resolvedType: "x:Object",
      reason: "clr-namespace type with leaked brackets",
      context: "critical",
      source: "xaml-generator",
    });

    reportCriticalTypeDiagnostic({
      inputType: "BadType(",
      resolvedType: "x:Object",
      reason: "unbalanced parentheses in type",
      context: "critical",
      source: "workflow-tree-assembler",
    });

    const entries = [{ name: "Test.xaml", content: makeXaml(`<Assign DisplayName="Test" />`) }];
    const result = runEmissionGate(entries);

    expect(result.blocked).toBe(true);
    expect(result.summary.blocked).toBeGreaterThanOrEqual(2);
    const criticalViolations = result.violations.filter(
      v => v.type === "malformed-type" && v.resolution === "blocked" && v.context === "mapClrType-critical"
    );
    expect(criticalViolations.length).toBe(2);
    expect(criticalViolations[0].detail).toContain("SomeUnknown[Type");
    expect(criticalViolations[1].detail).toContain("BadType(");
  });

  it("no critical diagnostics means no blocking from mapClrType path", () => {
    drainCriticalTypeDiagnostics();

    const entries = [{ name: "Clean.xaml", content: makeXaml(`<Assign DisplayName="Clean" />`) }];
    const result = runEmissionGate(entries);

    const criticalViolations = result.violations.filter(
      v => v.context === "mapClrType-critical"
    );
    expect(criticalViolations.length).toBe(0);
  });

  it("isWellFormedXamlType rejects unrecognized namespace prefixes", () => {
    expect(isWellFormedXamlType("x:String")).toBe(true);
    expect(isWellFormedXamlType("ui:QueueItem")).toBe(true);
    expect(isWellFormedXamlType("scg:Dictionary(x:String, x:Object)")).toBe(true);
    expect(isWellFormedXamlType("s:DateTime")).toBe(true);
    expect(isWellFormedXamlType("bogus:SomeType")).toBe(false);
    expect(isWellFormedXamlType("zz:Unknown")).toBe(false);
  });
});

describe("Emission Gate — Task 374: Safe-floor pipeline", () => {
  it("(a) baseline mode: unapproved activity in sequential context produces 'stubbed' not 'blocked'", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("GoogleCalendarGetEvents");
    if (!schema) {
      console.warn("GoogleCalendarGetEvents not in catalog — skipping test");
      return;
    }
    expect(schema.activity.emissionApproved).toBe(false);

    const xaml = makeXaml(`
      <ui:LogMessage Level="Info" Message="&quot;Hello&quot;" />
      <ui:GoogleCalendarGetEvents CalendarId="primary" />
      <ui:LogMessage Level="Info" Message="&quot;Done&quot;" />
    `);

    const entries = [{ name: "BaselineSeq.xaml", content: xaml }];
    const result = runEmissionGate(entries, "baseline");

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBeGreaterThan(0);
    const stubbed = actViolations.filter(v => v.resolution === "stubbed");
    expect(stubbed.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(false);
    expect(entries[0].content).toContain("[STUBBED]");
    expect(entries[0].content).not.toMatch(/<ui:GoogleCalendarGetEvents\b/);
  });

  it("(b) baseline mode: unapproved activity inside RetryScope produces 'degraded' with block-level replacement", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("GoogleCalendarGetEvents");
    if (!schema) {
      console.warn("GoogleCalendarGetEvents not in catalog — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <ui:RetryScope NumberOfRetries="3">
        <ui:RetryScope.ActivityBody>
          <Sequence>
            <ui:GoogleCalendarGetEvents CalendarId="primary" />
          </Sequence>
        </ui:RetryScope.ActivityBody>
      </ui:RetryScope>
    `);

    const entries = [{ name: "BaselineRetry.xaml", content: xaml }];
    const result = runEmissionGate(entries, "baseline");

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBeGreaterThan(0);
    const degraded = actViolations.filter(v => v.resolution === "degraded");
    expect(degraded.length).toBeGreaterThan(0);
    expect(degraded[0].containingBlockType).toBe("RetryScope");
    expect(result.blocked).toBe(false);
    expect(entries[0].content).toContain("[HANDOFF]");
    expect(entries[0].content).not.toMatch(/<ui:GoogleCalendarGetEvents\b/);
    expect(result.summary.degraded).toBeGreaterThan(0);
  });

  it("(c) baseline mode still hard-blocks on malformed types in critical context", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <x:Members>
    <x:Property Name="in_Config" Type="InArgument(clr-namespace:System[Collections)" />
  </x:Members>
  <Sequence>
    <Assign DisplayName="Test" />
  </Sequence>
</Activity>`;

    const entries = [{ name: "CriticalType.xaml", content: xaml }];
    const result = runEmissionGate(entries, "baseline");

    const typeViolations = result.violations.filter(v => v.type === "malformed-type");
    expect(typeViolations.length).toBeGreaterThan(0);
    const blocked = typeViolations.filter(v => v.resolution === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
    expect(result.blocked).toBe(true);
  });

  it("(d) ui:ShouldRetry with prefix is correctly skipped by the scanner", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <ui:RetryScope NumberOfRetries="3">
        <ui:RetryScope.ActivityBody>
          <Sequence>
            <ui:LogMessage Level="Info" Message="&quot;Trying...&quot;" />
          </Sequence>
        </ui:RetryScope.ActivityBody>
        <ui:RetryScope.RetryCondition>
          <ui:ShouldRetry />
        </ui:RetryScope.RetryCondition>
      </ui:RetryScope>
    `);

    const entries = [{ name: "ShouldRetryTest.xaml", content: xaml }];
    const result = runEmissionGate(entries, "strict");

    const shouldRetryViolations = result.violations.filter(
      v => v.type === "unapproved-activity" && v.detail.includes("ShouldRetry")
    );
    expect(shouldRetryViolations.length).toBe(0);
  });

  it("(e) DeserializeJSON (uppercase) resolves to uweb prefix", async () => {
    const { GUARANTEED_ACTIVITY_PREFIX_MAP } = await import("../xaml/xaml-compliance");
    expect(GUARANTEED_ACTIVITY_PREFIX_MAP["DeserializeJSON"]).toBe("uweb");
    expect(GUARANTEED_ACTIVITY_PREFIX_MAP["DeserializeJson"]).toBe("uweb");
  });

  it("(f) ShouldRetry with emissionApproved: true passes emission gate in strict mode", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("ShouldRetry");
    if (!schema) {
      console.warn("ShouldRetry not in catalog — skipping test");
      return;
    }
    expect(schema.activity.emissionApproved).toBe(true);

    const xaml = makeXaml(`
      <ui:RetryScope NumberOfRetries="3">
        <ui:RetryScope.ActivityBody>
          <Sequence>
            <ui:LogMessage Level="Info" Message="&quot;Trying...&quot;" />
          </Sequence>
        </ui:RetryScope.ActivityBody>
        <ui:RetryScope.RetryCondition>
          <ui:ShouldRetry />
        </ui:RetryScope.RetryCondition>
      </ui:RetryScope>
    `);

    const entries = [{ name: "ShouldRetryApproved.xaml", content: xaml }];
    const result = runEmissionGate(entries, "strict");

    expect(result.blocked).toBe(false);
    const shouldRetryViolations = result.violations.filter(
      v => v.detail.includes("ShouldRetry")
    );
    expect(shouldRetryViolations.length).toBe(0);
  });

  it("(g) baseline mode with RetryScope+GetAsset produces degraded handoff stub rather than hard failure", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("GetAsset");
    if (!schema) {
      console.warn("GetAsset not in catalog — skipping test");
      return;
    }
    expect(schema.activity.emissionApproved).toBe(false);

    const xaml = makeXaml(`
      <ui:RetryScope NumberOfRetries="3">
        <ui:RetryScope.ActivityBody>
          <Sequence>
            <ui:GetAsset AssetName="MyAsset" />
          </Sequence>
        </ui:RetryScope.ActivityBody>
        <ui:RetryScope.RetryCondition>
          <ui:ShouldRetry />
        </ui:RetryScope.RetryCondition>
      </ui:RetryScope>
    `);

    const entries = [{ name: "RetryGetAsset.xaml", content: xaml }];
    const result = runEmissionGate(entries, "baseline");

    expect(result.blocked).toBe(false);
    const degraded = result.violations.filter(v => v.resolution === "degraded");
    expect(degraded.length).toBeGreaterThan(0);
    expect(degraded[0].containingBlockType).toBe("RetryScope");
    expect(degraded[0].containedActivities).toContain("GetAsset");
    expect(entries[0].content).toContain("[HANDOFF]");
    expect(entries[0].content).toContain("RetryScope");
    expect(entries[0].content).not.toMatch(/<ui:GetAsset\b/);
  });

  it("strict mode still blocks on unapproved activity inside RetryScope", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("GetAsset");
    if (!schema) {
      console.warn("GetAsset not in catalog — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <ui:RetryScope NumberOfRetries="3">
        <ui:RetryScope.ActivityBody>
          <Sequence>
            <ui:GetAsset AssetName="MyAsset" />
          </Sequence>
        </ui:RetryScope.ActivityBody>
      </ui:RetryScope>
    `);

    const entries = [{ name: "StrictRetry.xaml", content: xaml }];
    const result = runEmissionGate(entries, "strict");

    expect(result.blocked).toBe(true);
    const blocked = result.violations.filter(v => v.resolution === "blocked");
    expect(blocked.length).toBeGreaterThan(0);
  });

  it("summary includes degraded count", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const xaml = makeXaml(`
      <If Condition="[True]">
        <If.Then>
          <Sequence>
            <ui:GoogleCalendarGetEvents CalendarId="primary" />
          </Sequence>
        </If.Then>
      </If>
    `);

    const entries = [{ name: "SummaryTest374.xaml", content: xaml }];
    const result = runEmissionGate(entries, "baseline");

    expect(result.summary.degraded).toBeDefined();
    expect(result.summary.totalViolations).toBe(
      result.summary.stubbed + result.summary.corrected + result.summary.blocked + result.summary.degraded
    );
  });

  it("baseline mode still hard-blocks when integrity failures (malformed types) are present alongside activity-approval issues", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    drainCriticalTypeDiagnostics();

    reportCriticalTypeDiagnostic({
      inputType: "System[Bad",
      resolvedType: "x:Object",
      reason: "leaked brackets in clr-namespace",
      context: "critical",
      source: "test-generator",
    });

    const xaml = makeXaml(`
      <ui:RetryScope NumberOfRetries="3">
        <ui:RetryScope.ActivityBody>
          <Sequence>
            <ui:GetAsset AssetName="MyAsset" />
          </Sequence>
        </ui:RetryScope.ActivityBody>
      </ui:RetryScope>
    `);

    const entries = [{ name: "MixedBlockers.xaml", content: xaml }];
    const result = runEmissionGate(entries, "baseline");

    expect(result.blocked).toBe(true);
    const integrityViolations = result.violations.filter(v => v.isIntegrityFailure === true);
    expect(integrityViolations.length).toBeGreaterThan(0);
  });

  it("isIntegrityFailure flag is set on malformed-type blocked violations", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <x:Members>
    <x:Property Name="in_Config" Type="InArgument(clr-namespace:Bad[Type)" />
  </x:Members>
  <Sequence>
    <Assign DisplayName="Test" />
  </Sequence>
</Activity>`;

    const entries = [{ name: "IntegrityFlag.xaml", content: xaml }];
    const result = runEmissionGate(entries, "baseline");

    const blockedMalformed = result.violations.filter(v => v.type === "malformed-type" && v.resolution === "blocked");
    expect(blockedMalformed.length).toBeGreaterThan(0);
    for (const v of blockedMalformed) {
      expect(v.isIntegrityFailure).toBe(true);
    }
    expect(result.blocked).toBe(true);
  });
});

describe("Emission Gate — Task 383: Declaration infrastructure protection", () => {
  function makeXamlWithDeclarations(bodyXml: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:s="clr-namespace:System;assembly=mscorlib">
  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
      <x:String>System.Collections.Generic</x:String>
      <x:String>UiPath.Core</x:String>
      <x:String>UiPath.Core.Activities</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Activities</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>
  <Sequence>
    ${bodyXml}
  </Sequence>
</Activity>`;
  }

  it("does not stub or mutate <AssemblyReference> tags", () => {
    const xaml = makeXamlWithDeclarations(`
      <ui:LogMessage Level="Info" Message="&quot;Hello&quot;" />
    `);

    const entries = [{ name: "DeclTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    expect(entries[0].content).toContain("<AssemblyReference>System.Activities</AssemblyReference>");
    expect(entries[0].content).toContain("<AssemblyReference>UiPath.Core</AssemblyReference>");
    expect(entries[0].content).toContain("<AssemblyReference>UiPath.Core.Activities</AssemblyReference>");
    const asmViolations = result.violations.filter(v => v.detail?.includes("AssemblyReference"));
    expect(asmViolations.length).toBe(0);
  });

  it("does not stub or mutate <sco:Collection> tags", () => {
    const xaml = makeXamlWithDeclarations(`
      <ui:LogMessage Level="Info" Message="&quot;Hello&quot;" />
    `);

    const entries = [{ name: "ScoTest.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    expect(entries[0].content).toContain('<sco:Collection x:TypeArguments="x:String">');
    expect(entries[0].content).toContain('<sco:Collection x:TypeArguments="AssemblyReference">');
    const scoViolations = result.violations.filter(v => v.detail?.includes("Collection"));
    expect(scoViolations.length).toBe(0);
  });

  it("declaration blocks under TextExpression.ReferencesForImplementation survive emission-gate processing intact", () => {
    const xaml = makeXamlWithDeclarations(`
      <ui:LogMessage Level="Info" Message="&quot;test&quot;" />
    `);

    const originalRefsBlock = `<TextExpression.ReferencesForImplementation>
    <sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System.Activities</AssemblyReference>
      <AssemblyReference>UiPath.Core</AssemblyReference>
      <AssemblyReference>UiPath.Core.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;

    const entries = [{ name: "RefsBlock.xaml", content: xaml }];
    runEmissionGate(entries);

    expect(entries[0].content).toContain(originalRefsBlock);
  });

  it("declaration blocks under TextExpression.NamespacesForImplementation survive emission-gate processing intact", () => {
    const xaml = makeXamlWithDeclarations(`
      <ui:LogMessage Level="Info" Message="&quot;test&quot;" />
    `);

    const originalNsBlock = `<TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
      <x:String>System.Collections.Generic</x:String>
      <x:String>UiPath.Core</x:String>
      <x:String>UiPath.Core.Activities</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>`;

    const entries = [{ name: "NsBlock.xaml", content: xaml }];
    runEmissionGate(entries);

    expect(entries[0].content).toContain(originalNsBlock);
  });

  it("baseline mode also preserves declaration infrastructure", () => {
    const xaml = makeXamlWithDeclarations(`
      <ui:LogMessage Level="Info" Message="&quot;test&quot;" />
    `);

    const entries = [{ name: "BaselineDecl.xaml", content: xaml }];
    runEmissionGate(entries, "baseline");

    expect(entries[0].content).toContain("<AssemblyReference>System.Activities</AssemblyReference>");
    expect(entries[0].content).toContain('<sco:Collection x:TypeArguments="x:String">');
    expect(entries[0].content).toContain('<sco:Collection x:TypeArguments="AssemblyReference">');
    expect(entries[0].content).toContain("TextExpression.ReferencesForImplementation");
    expect(entries[0].content).toContain("TextExpression.NamespacesForImplementation");
  });

  it("activities outside declaration blocks are still enforced normally", () => {
    if (!catalogService.isLoaded()) {
      console.warn("Catalog not loaded — skipping test");
      return;
    }

    const schema = catalogService.getActivitySchema("GoogleCalendarGetEvents");
    if (!schema) {
      console.warn("GoogleCalendarGetEvents not in catalog — skipping test");
      return;
    }
    expect(schema.activity.emissionApproved).toBe(false);

    const xaml = makeXamlWithDeclarations(`
      <ui:GoogleCalendarGetEvents CalendarId="primary" />
    `);

    const entries = [{ name: "MixedDecl.xaml", content: xaml }];
    const result = runEmissionGate(entries);

    const actViolations = result.violations.filter(v => v.type === "unapproved-activity");
    expect(actViolations.length).toBeGreaterThan(0);

    expect(entries[0].content).toContain("<AssemblyReference>System.Activities</AssemblyReference>");
    expect(entries[0].content).toContain('<sco:Collection x:TypeArguments="AssemblyReference">');
  });
});
