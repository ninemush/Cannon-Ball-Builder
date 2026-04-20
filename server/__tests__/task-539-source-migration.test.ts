import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildCanonicalTodoExpressionAttributeValue,
  resolvePropertyValueRaw,
  resolveValueIntentToXaml,
} from "../workflow-tree-assembler";
import { assertXamlStructuralIntegrity } from "../lib/xaml-structural-assertion";
import {
  ACTIVITY_REGISTRY,
  scanXamlForRequiredPackages,
} from "../uipath-activity-registry";
import { canonicalizeInvokeBindings } from "../xaml/invoke-binding-canonicalizer";
import { inferTypeFromPrefix } from "../shared/type-inference";
import { preserveStructureAndStubLeaves } from "../xaml/gap-analyzer";

describe("Task #539 Step 1 — source migration of un-migrated TODO emission sites", () => {
  it("buildCanonicalTodoExpressionAttributeValue returns canonical, XML-attribute-safe placeholder (no raw `\"` in value)", () => {
    const out = buildCanonicalTodoExpressionAttributeValue(
      "Implement expression",
      "task-539:test",
    );
    expect(out).not.toMatch(/^\["TODO - /);
    expect(out).not.toContain('"]');
    expect(out).toMatch(/&quot;/);
    expect(out).not.toContain("[TODO");
  });

  it("workflow-tree-assembler.ts contains zero unsanitized `[\"TODO - …\"]` literal emissions at the three named sites (lines 1835/1841/2515 region)", () => {
    const src = readFileSync(
      join(__dirname, "..", "workflow-tree-assembler.ts"),
      "utf8",
    );
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (/^\s*\/\//.test(ln) || /^\s*\*/.test(ln)) continue;
      const isReturnEmission = /\breturn\b/.test(ln) || /=\s*$/.test(ln);
      if (!isReturnEmission) continue;
      const bareLiteralBracketTodo = /["`]\["TODO - [^"`]*"\]["`]/;
      expect(
        bareLiteralBracketTodo.test(ln),
        `Line ${i + 1} re-introduced an un-migrated bracket-wrapped TODO literal: ${ln.trim()}`,
      ).toBe(false);
    }
  });

  it("resolvePropertyValueRaw on a value-intent that produces sentinel-output yields the canonical placeholder shape (smoke test for the migrated branch)", () => {
    const out = resolvePropertyValueRaw("vb_expression");
    expect(out).not.toContain('"]');
    expect(out).not.toMatch(/^\["TODO - /);
    expect(out).toContain("&quot;");
  });
});

describe("Task #539 Step 1c — build-time XAML structural assertion", () => {
  it("passes canonical XAML with escaped placeholder text in attribute-value position", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Sequence xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Assign>
    <Assign.To><OutArgument><PropertyReference><Argument /></PropertyReference></OutArgument></Assign.To>
    <Assign.Value><InArgument>[&quot;TODO_TOKEN&quot;]</InArgument></Assign.Value>
  </Assign>
</Sequence>`;
    const r = assertXamlStructuralIntegrity(xaml, "Test.xaml");
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("fails on parser-invalid XAML caused by un-escaped quote in placeholder-bearing attribute value", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Sequence xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Assign Value="["TODO - Implement expression"]" />
</Sequence>`;
    const r = assertXamlStructuralIntegrity(xaml, "Broken.xaml");
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.kind === "parser-invalid-placeholder-attribute")).toBe(true);
  });

  it("fails when a TODO token appears in attribute-NAME position (not value)", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Sequence xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Assign TODO="x" Value="ok" />
</Sequence>`;
    const r = assertXamlStructuralIntegrity(xaml, "BadName.xaml");
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.kind === "todo-token-in-attribute-name")).toBe(true);
  });

  it("Step 4 — canonicalizer strips attribute-form Arguments= from InvokeWorkflowFile (Pattern B)", () => {
    const xaml = `<Sequence xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <ui:InvokeWorkflowFile WorkflowFileName="Sub.xaml" Arguments="[dict_Config]" />
</Sequence>`;
    const r = canonicalizeInvokeBindings([{ name: "Main.xaml", content: xaml }]);
    const removed = r.invokeSerializationFixes.find(
      f => f.activityType === "InvokeWorkflowFile" && f.propertyName === "Arguments" && f.normalizationType === "pseudo_property_removal",
    );
    expect(removed).toBeDefined();
    expect(removed!.rationale).toMatch(/Pattern B no-double-emission/);
  });

  it("Step 5a — ui:GetCredential registry lists Target as required (and not AssetName)", () => {
    const entry = ACTIVITY_REGISTRY["ui:GetCredential"];
    expect(entry).toBeDefined();
    const required = (entry as any).properties?.required || [];
    expect(required).toContain("Target");
    expect(required).not.toContain("AssetName");
  });

  it("Step 5b — scanXamlForRequiredPackages adds UiPath.Credentials.Activities iff ui:GetCredential is emitted (usage-driven)", () => {
    const xamlWith = `<root xmlns:ui="http://schemas.uipath.com/workflow/activities"><ui:GetCredential Target="x" /></root>`;
    const pkgsWith = scanXamlForRequiredPackages(xamlWith);
    expect(pkgsWith.has("UiPath.Credentials.Activities")).toBe(true);

    const xamlWithout = `<root xmlns:ui="http://schemas.uipath.com/workflow/activities"><ui:LogMessage Level="Info" Message="hi" /></root>`;
    const pkgsWithout = scanXamlForRequiredPackages(xamlWithout);
    expect(pkgsWithout.has("UiPath.Credentials.Activities")).toBe(false);
  });

  it("Step 6 narrowing — auto-quote fires on hyphenated identifier-shaped names but NOT on signed numerics or short codes (no over-reach)", () => {
    // Hyphenated orchestrator-artifact name: SHOULD auto-quote.
    const queueName = resolveValueIntentToXaml({ type: "literal", value: "BDAYGREETINGS-DailyWorkQueue" } as any);
    expect(queueName).toContain("&quot;BDAYGREETINGS-DailyWorkQueue&quot;");

    // Signed numeric: must NOT be quoted (preserves typed-property semantics).
    const negInt = resolveValueIntentToXaml({ type: "literal", value: "-1" } as any);
    expect(negInt).toBe("-1");
    const negFloat = resolveValueIntentToXaml({ type: "literal", value: "-3.14" } as any);
    expect(negFloat).toBe("-3.14");

    // Short hyphenated token like UTF-8 (digit-trailing): must NOT be quoted
    // (the narrowing requires alpha runs on BOTH sides of the hyphen).
    const utf8 = resolveValueIntentToXaml({ type: "literal", value: "UTF-8" } as any);
    expect(utf8).not.toMatch(/^"/);

    // Pure boolean/null literals: must NOT be quoted.
    const trueLit = resolveValueIntentToXaml({ type: "literal", value: "True" } as any);
    expect(trueLit).toBe("True");
  });

  it("Step 3 — preserveStructureAndStubLeaves strips TODO attributes from structural wrappers and emits diagnostics", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main" SomeWrapperProp="[TODO_BindMe]">
    <ui:LogMessage Level="Info" Message="hello" />
  </Sequence>
</Activity>`;
    const r = preserveStructureAndStubLeaves(xaml, [], { isMainXaml: true });
    expect(r.parseableXml).toBe(true);
    expect(r.diagnostics.length).toBeGreaterThan(0);
    const diag = r.diagnostics.find(d => d.attribute === "SomeWrapperProp");
    expect(diag).toBeDefined();
    expect(diag!.kind).toBe("wrapper-todo-attribute-stripped");
    expect(diag!.tag).toBe("Sequence");
    expect(diag!.line).toBeGreaterThan(0);
    expect(diag!.reason).toMatch(/TODO/);
    // Wrapper preserved (no whole-tree stub) and offending attribute removed
    expect(r.content).not.toMatch(/SomeWrapperProp=/);
    expect(r.content).toMatch(/<Sequence /);
    expect(r.content).toMatch(/<ui:LogMessage /);
  });

  it("Step 7 — inferTypeFromPrefix retypes obj_TransactionItem to ui:QueueItem (Pattern C anti-downcast guard)", () => {
    expect(inferTypeFromPrefix("obj_TransactionItem")).toBe("ui:QueueItem");
    expect(inferTypeFromPrefix("obj_GenericThing")).toBe("x:Object");
    expect(inferTypeFromPrefix("qi_TransactionItem")).toBe("ui:QueueItem");
  });

  it("fails when InvokeWorkflowFile carries both attribute-form Arguments= and the typed child block (Pattern B no-double-emission)", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Sequence xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <ui:InvokeWorkflowFile WorkflowFileName="X.xaml" Arguments="[dict_Config]">
    <ui:InvokeWorkflowFile.Arguments>
      <InArgument x:TypeArguments="x:String" x:Key="in_Foo" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">[str_Foo]</InArgument>
    </ui:InvokeWorkflowFile.Arguments>
  </ui:InvokeWorkflowFile>
</Sequence>`;
    const r = assertXamlStructuralIntegrity(xaml, "DualArgs.xaml");
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.kind === "invoke-workflow-file-dual-arguments")).toBe(true);
  });
});
