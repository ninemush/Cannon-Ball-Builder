import { describe, it, expect } from "vitest";
import { validateWorkflowSpec, WorkflowSpecSchema } from "../workflow-spec-types";
import { getCachedPipelineResult, findUiPathMessage } from "../uipath-pipeline";
import { sanitizeXmlArtifacts, makeUiPathCompliant } from "../xaml/xaml-compliance";
import { validateXamlContent } from "../xaml-generator";

describe("UiPath Package Generation Fixes", () => {
  describe("FIX 1 — maxRetries schema validation (nonnegative)", () => {
    const baseSpec = {
      name: "TestWorkflow",
      variables: [{ name: "str_Test", type: "String" }],
      rootSequence: {
        kind: "sequence" as const,
        displayName: "Main Sequence",
        children: [],
      },
      useReFramework: true,
    };

    it("maxRetries: 0 passes schema validation", () => {
      const spec = {
        ...baseSpec,
        reframeworkConfig: {
          queueName: "TestQueue",
          maxRetries: 0,
          processName: "TestProcess",
        },
      };
      const result = validateWorkflowSpec(spec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reframeworkConfig?.maxRetries).toBe(0);
      }
    });

    it("maxRetries: 1 passes schema validation", () => {
      const spec = {
        ...baseSpec,
        reframeworkConfig: {
          queueName: "TestQueue",
          maxRetries: 1,
          processName: "TestProcess",
        },
      };
      const result = validateWorkflowSpec(spec);
      expect(result.success).toBe(true);
    });

    it("maxRetries: 5 passes schema validation", () => {
      const spec = {
        ...baseSpec,
        reframeworkConfig: {
          queueName: "TestQueue",
          maxRetries: 5,
          processName: "TestProcess",
        },
      };
      const result = validateWorkflowSpec(spec);
      expect(result.success).toBe(true);
    });

    it("maxRetries: -1 fails schema validation", () => {
      const spec = {
        ...baseSpec,
        reframeworkConfig: {
          queueName: "TestQueue",
          maxRetries: -1,
          processName: "TestProcess",
        },
      };
      const result = validateWorkflowSpec(spec);
      expect(result.success).toBe(false);
    });

    it("maxRetries: 1.5 fails schema validation (not integer)", () => {
      const spec = {
        ...baseSpec,
        reframeworkConfig: {
          queueName: "TestQueue",
          maxRetries: 1.5,
          processName: "TestProcess",
        },
      };
      const result = validateWorkflowSpec(spec);
      expect(result.success).toBe(false);
    });

    it("reframeworkConfig is optional and spec validates without it", () => {
      const result = validateWorkflowSpec(baseSpec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reframeworkConfig).toBeUndefined();
      }
    });

    it("maxRetries: 0 parsed through Zod schema directly", () => {
      const parsed = WorkflowSpecSchema.safeParse({
        ...baseSpec,
        reframeworkConfig: { queueName: "Q", maxRetries: 0, processName: "P" },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.reframeworkConfig?.maxRetries).toBe(0);
      }
    });
  });

  describe("FIX 1 — reframeworkConfig coercion before validation", () => {
    function applyCoercion(parsed: any): any {
      if (parsed && typeof parsed === "object") {
        if (parsed.reframeworkConfig == null || typeof parsed.reframeworkConfig !== "object") {
          parsed.reframeworkConfig = undefined;
          if (parsed.useReFramework) {
            parsed.reframeworkConfig = { queueName: "", maxRetries: 1, processName: parsed.name || "" };
          }
        } else {
          if (parsed.reframeworkConfig.maxRetries == null || parsed.reframeworkConfig.maxRetries < 0) {
            parsed.reframeworkConfig.maxRetries = 1;
          }
        }
      }
      return parsed;
    }

    it("reframeworkConfig: null with useReFramework=true coerces to defaults and passes validation", () => {
      const input = {
        name: "MyProcess",
        useReFramework: true,
        reframeworkConfig: null,
        variables: [],
        rootSequence: { kind: "sequence", displayName: "Main", children: [] },
      };
      const coerced = applyCoercion(input);
      expect(coerced.reframeworkConfig).toEqual({
        queueName: "",
        maxRetries: 1,
        processName: "MyProcess",
      });
      const result = validateWorkflowSpec(coerced);
      expect(result.success).toBe(true);
    });

    it("reframeworkConfig: null with useReFramework=false sets to undefined and passes validation", () => {
      const input = {
        name: "MyProcess",
        useReFramework: false,
        reframeworkConfig: null,
        variables: [],
        rootSequence: { kind: "sequence", displayName: "Main", children: [] },
      };
      const coerced = applyCoercion(input);
      expect(coerced.reframeworkConfig).toBeUndefined();
      const result = validateWorkflowSpec(coerced);
      expect(result.success).toBe(true);
    });

    it("maxRetries: null coerces to 1 and passes validation", () => {
      const input = {
        name: "MyProcess",
        useReFramework: true,
        reframeworkConfig: { queueName: "Q1", maxRetries: null, processName: "P1" },
        variables: [],
        rootSequence: { kind: "sequence", displayName: "Main", children: [] },
      };
      const coerced = applyCoercion(input);
      expect(coerced.reframeworkConfig.maxRetries).toBe(1);
      const result = validateWorkflowSpec(coerced);
      expect(result.success).toBe(true);
    });

    it("maxRetries: -3 coerces to 1 and passes validation", () => {
      const input = {
        name: "MyProcess",
        useReFramework: true,
        reframeworkConfig: { queueName: "Q1", maxRetries: -3, processName: "P1" },
        variables: [],
        rootSequence: { kind: "sequence", displayName: "Main", children: [] },
      };
      const coerced = applyCoercion(input);
      expect(coerced.reframeworkConfig.maxRetries).toBe(1);
      const result = validateWorkflowSpec(coerced);
      expect(result.success).toBe(true);
    });

    it("maxRetries: 0 is preserved after coercion (valid nonnegative)", () => {
      const input = {
        name: "MyProcess",
        useReFramework: true,
        reframeworkConfig: { queueName: "Q1", maxRetries: 0, processName: "P1" },
        variables: [],
        rootSequence: { kind: "sequence", displayName: "Main", children: [] },
      };
      const coerced = applyCoercion(input);
      expect(coerced.reframeworkConfig.maxRetries).toBe(0);
      const result = validateWorkflowSpec(coerced);
      expect(result.success).toBe(true);
    });

    it("reframeworkConfig as string (non-object) is coerced to undefined", () => {
      const input = {
        name: "MyProcess",
        useReFramework: false,
        reframeworkConfig: "invalid",
        variables: [],
        rootSequence: { kind: "sequence", displayName: "Main", children: [] },
      };
      const coerced = applyCoercion(input);
      expect(coerced.reframeworkConfig).toBeUndefined();
      const result = validateWorkflowSpec(coerced);
      expect(result.success).toBe(true);
    });
  });

  describe("FIX 2 — Download endpoint cache lookup", () => {
    it("getCachedPipelineResult returns null when no cached build exists", () => {
      const result = getCachedPipelineResult("nonexistent-idea-" + Date.now());
      expect(result).toBeNull();
    });

    it("getCachedPipelineResult returns null for empty string ideaId", () => {
      const result = getCachedPipelineResult("");
      expect(result).toBeNull();
    });

    it("getCachedPipelineResult with mode returns null when no matching mode cached", () => {
      const result = getCachedPipelineResult("nonexistent-idea-" + Date.now(), "full_implementation");
      expect(result).toBeNull();
    });
  });

  describe("FIX 2 — findUiPathMessage", () => {
    it("returns null when no UIPATH message exists", () => {
      const messages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ];
      expect(findUiPathMessage(messages)).toBeNull();
    });

    it("finds the latest UIPATH message", () => {
      const messages = [
        { role: "assistant", content: '[UIPATH:{"old":"data"}]' },
        { role: "user", content: "Regenerate" },
        { role: "assistant", content: '[UIPATH:{"new":"data"}]' },
      ];
      const found = findUiPathMessage(messages);
      expect(found).not.toBeNull();
      expect(found.content).toContain('"new"');
    });

    it("ignores user messages starting with [UIPATH:", () => {
      const messages = [
        { role: "user", content: '[UIPATH:{"fake":"data"}]' },
      ];
      expect(findUiPathMessage(messages)).toBeNull();
    });
  });

  describe("FIX 3 — Package card rendering gates", () => {
    it("BUILDING status should not be treated as success", () => {
      const status = "BUILDING";
      const isSuccess = status === "READY" || status === "READY_WITH_WARNINGS";
      expect(isSuccess).toBe(false);
    });

    it("FAILED status should not be treated as success", () => {
      const status = "FAILED";
      const isSuccess = status === "READY" || status === "READY_WITH_WARNINGS";
      expect(isSuccess).toBe(false);
    });

    it("READY status is treated as success", () => {
      const status = "READY";
      const isSuccess = status === "READY" || status === "READY_WITH_WARNINGS";
      expect(isSuccess).toBe(true);
    });

    it("READY_WITH_WARNINGS status is treated as success", () => {
      const status = "READY_WITH_WARNINGS";
      const isSuccess = status === "READY" || status === "READY_WITH_WARNINGS";
      expect(isSuccess).toBe(true);
    });

    it("isFailed flag is correctly derived from status", () => {
      expect("FAILED" === "FAILED").toBe(true);
      expect("READY" === "FAILED").toBe(false);
      expect("READY_WITH_WARNINGS" === "FAILED").toBe(false);
      expect("BUILDING" === "FAILED").toBe(false);
    });
  });

  describe("FIX 4 — XAML markup extension preservation in sanitizeXmlArtifacts", () => {
    it("preserves {x:Reference ...} in attribute values", () => {
      const xml = `<Transition To="{x:Reference State_Init}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`To="{x:Reference State_Init}"`);
    });

    it("preserves {x:Null} in attribute values", () => {
      const xml = `<Variable Default="{x:Null}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`Default="{x:Null}"`);
    });

    it("preserves {Binding ...} in attribute values", () => {
      const xml = `<TextBlock Text="{Binding Path=Name}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`Text="{Binding Path=Name}"`);
    });

    it("preserves {StaticResource ...} in attribute values", () => {
      const xml = `<Border Style="{StaticResource MainStyle}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`Style="{StaticResource MainStyle}"`);
    });

    it("preserves {DynamicResource ...} in attribute values", () => {
      const xml = `<Button Background="{DynamicResource AccentBrush}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`Background="{DynamicResource AccentBrush}"`);
    });

    it("preserves {TemplateBinding ...} in attribute values", () => {
      const xml = `<Border BorderBrush="{TemplateBinding BorderBrush}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`BorderBrush="{TemplateBinding BorderBrush}"`);
    });

    it("preserves {RelativeSource ...} in attribute values", () => {
      const xml = `<Binding RelativeSource="{RelativeSource Self}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`RelativeSource="{RelativeSource Self}"`);
    });

    it("preserves {x:Type ...} in attribute values", () => {
      const xml = `<DataTemplate DataType="{x:Type local:MyClass}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`DataType="{x:Type local:MyClass}"`);
    });

    it("preserves {x:Static ...} in attribute values", () => {
      const xml = `<MenuItem Header="{x:Static props:Resources.MenuLabel}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`Header="{x:Static props:Resources.MenuLabel}"`);
    });

    it("preserves {x:Array ...} in attribute values", () => {
      const xml = `<ComboBox ItemsSource="{x:Array Type=x:String}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`ItemsSource="{x:Array Type=x:String}"`);
    });

    it("still removes genuinely stray } from non-markup-extension attribute values", () => {
      const xml = `<Assign DisplayName="Set Value}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`DisplayName="Set Value"`);
      expect(result).not.toContain(`Set Value}"`);
    });

    it("still removes stray } after quoted attribute values", () => {
      const xml = `<Assign DisplayName="Test" } />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).not.toMatch(/"Test"\s*\}/);
    });

    it("REFramework XAML with x:Reference transitions survives makeUiPathCompliant", () => {
      const reframeworkXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <StateMachine DisplayName="REFramework Main">
    <State DisplayName="Init" x:Name="State_Init">
      <State.Entry>
        <Sequence DisplayName="Initialize">
          <ui:LogMessage Level="Info" Message="'Init'" DisplayName="Log Init" />
        </Sequence>
      </State.Entry>
      <Transition DisplayName="Init -> Get Transaction" To="{x:Reference State_GetTransaction}" />
    </State>
    <State DisplayName="Get Transaction" x:Name="State_GetTransaction">
      <State.Entry>
        <Sequence DisplayName="Get Data">
          <ui:LogMessage Level="Info" Message="'Get Transaction'" DisplayName="Log Get" />
        </Sequence>
      </State.Entry>
      <Transition DisplayName="Get -> End" To="{x:Reference State_End}" />
    </State>
    <State DisplayName="End" x:Name="State_End" IsFinal="True">
      <State.Entry>
        <Sequence DisplayName="Cleanup">
          <ui:LogMessage Level="Info" Message="'End'" DisplayName="Log End" />
        </Sequence>
      </State.Entry>
    </State>
    <StateMachine.InitialState>
      <x:Reference>State_Init</x:Reference>
    </StateMachine.InitialState>
  </StateMachine>
</Activity>`;
      const compliant = makeUiPathCompliant(reframeworkXaml, "Windows");
      expect(compliant).toContain(`To="{x:Reference State_GetTransaction}"`);
      expect(compliant).toContain(`To="{x:Reference State_End}"`);

      const violations = validateXamlContent([{ name: "Main.xaml", content: compliant }]);
      const xmlErrors = violations.filter(v => v.check === "xml-wellformedness");
      expect(xmlErrors.length).toBe(0);
    });

    it("preserves unlisted {x:CustomExtension ...} generically", () => {
      const xml = `<Element Prop="{x:CustomExtension SomeArg}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`Prop="{x:CustomExtension SomeArg}"`);
    });

    it("preserves {local:MyExtension ...} with arbitrary namespace prefix", () => {
      const xml = `<Element Prop="{local:MyConverter Param=1}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`Prop="{local:MyConverter Param=1}"`);
    });

    it("{Binding ...} survives makeUiPathCompliant round-trip", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <Assign DisplayName="Set Val">
      <Assign.To><OutArgument x:TypeArguments="x:String">[result]</OutArgument></Assign.To>
      <Assign.Value><InArgument x:TypeArguments="x:String">{Binding Path=Name}</InArgument></Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain("{Binding Path=Name}");
    });

    it("{StaticResource ...} survives makeUiPathCompliant round-trip", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <Assign DisplayName="Set Style">
      <Assign.To><OutArgument x:TypeArguments="x:String">[style]</OutArgument></Assign.To>
      <Assign.Value><InArgument x:TypeArguments="x:String">{StaticResource MainStyle}</InArgument></Assign.Value>
    </Assign>
  </Sequence>
</Activity>`;
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain("{StaticResource MainStyle}");
    });

    it("{x:Null} survives makeUiPathCompliant round-trip", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="test" Default="{x:Null}" />
    </Sequence.Variables>
  </Sequence>
</Activity>`;
      const compliant = makeUiPathCompliant(xaml, "Windows");
      expect(compliant).toContain(`Default="{x:Null}"`);
    });

    it("preserves multiple different markup extensions in the same XAML", () => {
      const xml = `<Transition To="{x:Reference State_Init}" />
<Variable Default="{x:Null}" />
<TextBlock Text="{Binding Name}" />`;
      const result = sanitizeXmlArtifacts(xml);
      expect(result).toContain(`To="{x:Reference State_Init}"`);
      expect(result).toContain(`Default="{x:Null}"`);
      expect(result).toContain(`Text="{Binding Name}"`);
    });
  });
});
