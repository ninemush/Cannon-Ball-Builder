import { describe, it, expect } from "vitest";
import { normalizeStringToExpression, normalizePropertyToValueIntent } from "../xaml/expression-builder";
import { findUndeclaredVariables } from "../xaml/vbnet-expression-linter";
import { injectMissingNamespaceDeclarations, normalizeXaml, validateImplementationContainer } from "../xaml/xaml-compliance";

describe("Task 354 — Expression emission and Studio structural fixes", () => {
  describe("2-segment timezone paths treated as string literals", () => {
    it("Asia/Dubai is a string literal, not an expression", () => {
      const result = normalizeStringToExpression("Asia/Dubai");
      expect(result).toBe('"Asia/Dubai"');
    });

    it("America/New_York is a string literal", () => {
      const result = normalizeStringToExpression("America/New_York");
      expect(result).toBe('"America/New_York"');
    });

    it("Europe/London is a string literal", () => {
      const result = normalizeStringToExpression("Europe/London");
      expect(result).toBe('"Europe/London"');
    });

    it("normalizePropertyToValueIntent treats Asia/Dubai as literal", () => {
      const intent = normalizePropertyToValueIntent("Asia/Dubai");
      expect(intent.type).toBe("literal");
      expect(intent.type === "literal" && intent.value).toBe("Asia/Dubai");
    });

    it("3-segment paths also treated as string literals", () => {
      const result = normalizeStringToExpression("path/to/resource");
      expect(result).toBe('"path/to/resource"');
    });

    it("short single-char division a/b is NOT treated as string literal", () => {
      const result = normalizeStringToExpression("a/b");
      expect(result).toBe("[a/b]");
    });

    it("x/y is NOT treated as string literal (short vars = division)", () => {
      const result = normalizeStringToExpression("x/y");
      expect(result).toBe("[x/y]");
    });

    it("total/count is NOT treated as string literal (VB division)", () => {
      const result = normalizeStringToExpression("total/count");
      expect(result).toBe("[total/count]");
    });

    it("retryCount/maxRetries is NOT treated as string literal (VB division)", () => {
      const result = normalizeStringToExpression("retryCount/maxRetries");
      expect(result).toBe("[retryCount/maxRetries]");
    });

    it("US/Pacific is a string literal (IANA timezone)", () => {
      const result = normalizeStringToExpression("US/Pacific");
      expect(result).toBe('"US/Pacific"');
    });

    it("Total/Count PascalCase division is treated as expression", () => {
      const result = normalizeStringToExpression("Total/Count");
      expect(result).toBe('"Total/Count"');
    });
  });

  describe("URL property values treated as string literals", () => {
    it("https://example.com is a string literal", () => {
      const result = normalizeStringToExpression("https://example.com");
      expect(result).toBe('"https://example.com"');
    });

    it("http://api.example.com/v1/data is a string literal", () => {
      const result = normalizeStringToExpression("http://api.example.com/v1/data");
      expect(result).toBe('"http://api.example.com/v1/data"');
    });

    it("ftp://files.example.com is treated as string literal (contains ://)", () => {
      const result = normalizeStringToExpression("ftp://files.example.com");
      expect(result).toBe('"ftp://files.example.com"');
    });

    it("normalizePropertyToValueIntent treats URLs as literals", () => {
      const intent = normalizePropertyToValueIntent("https://api.example.com/endpoint");
      expect(intent.type).toBe("literal");
    });

    it("URL with dots in domain is not mistaken for member access", () => {
      const intent = normalizePropertyToValueIntent("https://api.uipath.com/v1/status");
      expect(intent.type).toBe("literal");
    });

    it("already-quoted URL is not re-quoted", () => {
      const result = normalizeStringToExpression('"https://example.com/api"');
      expect(result).toBe('"https://example.com/api"');
    });
  });

  describe("Yes/No → True/False normalization", () => {
    it("Yes normalizes to True for Boolean CLR types", () => {
      const intent = normalizePropertyToValueIntent("Yes", undefined, undefined, undefined, undefined, "System.Boolean");
      expect(intent.type).toBe("literal");
      expect(intent.type === "literal" && intent.value).toBe("True");
    });

    it("No normalizes to False for Boolean CLR types", () => {
      const intent = normalizePropertyToValueIntent("No", undefined, undefined, undefined, undefined, "System.Boolean");
      expect(intent.type).toBe("literal");
      expect(intent.type === "literal" && intent.value).toBe("False");
    });

    it("yes (lowercase) normalizes to True for Boolean CLR types", () => {
      const intent = normalizePropertyToValueIntent("yes", undefined, undefined, undefined, undefined, "Boolean");
      expect(intent.type).toBe("literal");
      expect(intent.type === "literal" && intent.value).toBe("True");
    });

    it("no (lowercase) normalizes to False for Boolean CLR types", () => {
      const intent = normalizePropertyToValueIntent("no", undefined, undefined, undefined, undefined, "Boolean");
      expect(intent.type).toBe("literal");
      expect(intent.type === "literal" && intent.value).toBe("False");
    });

    it("Yes without Boolean CLR type stays as literal string", () => {
      const intent = normalizePropertyToValueIntent("Yes");
      expect(intent.type).toBe("literal");
      expect(intent.type === "literal" && intent.value).toBe("Yes");
    });
  });

  describe("From keyword in dictionary initializers", () => {
    it("From is not flagged as undeclared variable", () => {
      const expr = 'New Dictionary(Of String, Object) From {{"key1", "value1"}, {"key2", 42}}';
      const declaredVars = new Set<string>();
      const undeclared = findUndeclaredVariables(expr, declaredVars);
      expect(undeclared).not.toContain("From");
    });

    it("From keyword recognized in VB Keywords set (case-insensitive)", () => {
      const expr = '[New Dictionary(Of String, String) From {{"name", str_Name}}]';
      const declaredVars = new Set(["str_Name"]);
      const undeclared = findUndeclaredVariables(expr, declaredVars);
      expect(undeclared).not.toContain("From");
    });
  });

  describe("Dictionary key names not flagged as undeclared", () => {
    it("dictionary keys inside New Dictionary From are not flagged", () => {
      const expr = 'New Dictionary(Of String, Object) From {{"firstName", "John"}, {"lastName", "Doe"}}';
      const declaredVars = new Set<string>();
      const undeclared = findUndeclaredVariables(expr, declaredVars);
      expect(undeclared).not.toContain("firstName");
      expect(undeclared).not.toContain("lastName");
    });

    it("JSON property names in string concatenation not flagged", () => {
      const expr = '"{""name"": """ & str_Value & """}"';
      const declaredVars = new Set(["str_Value"]);
      const undeclared = findUndeclaredVariables(expr, declaredVars);
      expect(undeclared).not.toContain("name");
    });
  });

  describe("Namespace declaration injection", () => {
    it("injects missing xmlns for used prefixes", () => {
      const xaml = `<?xml version="1.0"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence>
    <ui:LogMessage Level="Info" Message="Hello" />
    <uds:CreateEntity DisplayName="Create" />
  </Sequence>
</Activity>`;
      const result = injectMissingNamespaceDeclarations(xaml);
      expect(result.injected).toContain("ui");
      expect(result.injected).toContain("uds");
      expect(result.xml).toContain('xmlns:ui=');
      expect(result.xml).toContain('xmlns:uds=');
    });

    it("does not inject already-declared namespaces", () => {
      const xaml = `<?xml version="1.0"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence>
    <ui:LogMessage Level="Info" Message="Hello" />
  </Sequence>
</Activity>`;
      const result = injectMissingNamespaceDeclarations(xaml);
      expect(result.injected).toHaveLength(0);
    });

    it("injects DataService namespace for uds prefix", () => {
      const xaml = `<?xml version="1.0"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence>
    <uds:CreateEntity DisplayName="Create Entity" />
  </Sequence>
</Activity>`;
      const result = injectMissingNamespaceDeclarations(xaml);
      expect(result.injected).toContain("uds");
      expect(result.xml).toContain("xmlns:uds=");
    });
  });

  describe("DynamicActivity.Implementation structural validation", () => {
    it("XAML with root Sequence is valid", () => {
      const result = validateImplementationContainer(`<?xml version="1.0"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Sequence DisplayName="Main">
  </Sequence>
</Activity>`);
      expect(result.valid).toBe(true);
    });

    it("XAML with root Flowchart is valid", () => {
      const result = validateImplementationContainer(`<?xml version="1.0"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Flowchart DisplayName="Main">
  </Flowchart>
</Activity>`);
      expect(result.valid).toBe(true);
    });

    it("XAML with root StateMachine is valid", () => {
      const result = validateImplementationContainer(`<?xml version="1.0"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <StateMachine DisplayName="Main">
  </StateMachine>
</Activity>`);
      expect(result.valid).toBe(true);
    });

    it("XAML without root container is invalid (DynamicActivity.Implementation null)", () => {
      const result = validateImplementationContainer(`<?xml version="1.0"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <x:Members>
    <x:Property Name="in_Arg" Type="InArgument(x:String)" />
  </x:Members>
</Activity>`);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("DynamicActivity.Implementation");
    });

    it("empty XAML is invalid", () => {
      const result = validateImplementationContainer("");
      expect(result.valid).toBe(false);
    });
  });

  describe("StateMachine State namespace handling", () => {
    it("normalizeXaml injects System.Activities.Statements namespace for StateMachine XAML", () => {
      const xaml = `<Activity
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <mva:VisualBasic.Settings>
    <mva:VisualBasicSettings>
    </mva:VisualBasicSettings>
  </mva:VisualBasic.Settings>
  <sap2010:WorkflowViewState.IdRef>TEST_ID</sap2010:WorkflowViewState.IdRef>
  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <StateMachine DisplayName="Main">
    <State DisplayName="Init" x:Name="State_Init">
      <State.Entry>
        <Sequence DisplayName="Initialize">
          <ui:LogMessage Level="Info" Message="Init" DisplayName="Log" />
        </Sequence>
      </State.Entry>
    </State>
  </StateMachine>
</Activity>`;
      const result = normalizeXaml(xaml);
      expect(result).toContain("System.Activities.Statements");
      expect(result).toContain("xmlns:sads=");
    });

    it("StateMachine XAML passes implementation container validation", () => {
      const result = validateImplementationContainer(`<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <StateMachine DisplayName="Main">
    <State DisplayName="Init" x:Name="State_Init" />
  </StateMachine>
</Activity>`);
      expect(result.valid).toBe(true);
    });

    it("State references via x:Reference resolve with sads namespace", () => {
      const xaml = `<Activity
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <mva:VisualBasic.Settings>
    <mva:VisualBasicSettings>
    </mva:VisualBasicSettings>
  </mva:VisualBasic.Settings>
  <sap2010:WorkflowViewState.IdRef>TEST_ID</sap2010:WorkflowViewState.IdRef>
  <TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <StateMachine DisplayName="Main">
    <State DisplayName="Init" x:Name="State_Init">
      <State.Entry>
        <Sequence DisplayName="Initialize">
          <ui:LogMessage Level="Info" Message="Init" DisplayName="Log" />
        </Sequence>
      </State.Entry>
      <Transition DisplayName="Go Next" To="{x:Reference State_End}">
        <Transition.Condition>[True]</Transition.Condition>
      </Transition>
    </State>
    <State DisplayName="End" x:Name="State_End" IsFinal="True" />
    <StateMachine.InitialState>
      <x:Reference>State_Init</x:Reference>
    </StateMachine.InitialState>
  </StateMachine>
</Activity>`;
      const result = normalizeXaml(xaml);
      expect(result).toContain("xmlns:sads=");
      expect(result).toContain("System.Activities.Statements");
      expect(result).toContain("x:Reference");
      expect(result).toContain("State_Init");
    });
  });

  describe("Bare integer handling in expressions", () => {
    it("bare integers remain as numeric literals", () => {
      const result = normalizeStringToExpression("0");
      expect(result).toBe("0");
    });

    it("bare decimal numbers remain as numeric literals", () => {
      const result = normalizeStringToExpression("3.14");
      expect(result).toBe("3.14");
    });

    it("normalizePropertyToValueIntent treats bare integers as literals", () => {
      const intent = normalizePropertyToValueIntent("42");
      expect(intent.type).toBe("literal");
      expect(intent.type === "literal" && intent.value).toBe("42");
    });
  });

  describe("Encoding property mapping", () => {
    it("normalizePropertyToValueIntent treats encoding strings as literals", () => {
      const intent = normalizePropertyToValueIntent("UTF-8");
      expect(intent.type).toBe("literal");
    });

    it("normalizePropertyToValueIntent treats UTF8 (no hyphen) as literal", () => {
      const intent = normalizePropertyToValueIntent("UTF8");
      expect(intent.type).toBe("literal");
    });
  });
});
