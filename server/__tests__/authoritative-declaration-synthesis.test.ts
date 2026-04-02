import { describe, it, expect, vi } from "vitest";
import { deriveRequiredDeclarationsForXaml, PACKAGE_NAMESPACE_MAP, insertBeforeClosingCollectionTag, normalizeXaml } from "../xaml/xaml-compliance";
import { generateReframeworkMainXaml } from "../xaml-generator";
import { runStudioResolutionSmokeTest } from "../package-assembler";

function buildMinimalXaml(bodyContent: string, extraXmlns: string = ""): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  ${extraXmlns}>
  <mva:VisualBasic.Settings>
    <x:Null />
  </mva:VisualBasic.Settings>
  <sap2010:WorkflowViewState.IdRef>TestWorkflow_1</sap2010:WorkflowViewState.IdRef>
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
      <AssemblyReference>UiPath.System.Activities</AssemblyReference>
      <AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>
  <Sequence DisplayName="Main Sequence">
    ${bodyContent}
  </Sequence>
</Activity>`;
}

describe("Authoritative Declaration Synthesis", () => {
  describe("deriveRequiredDeclarationsForXaml", () => {
    it("detects ui:LogMessage and resolves to UiPath.System.Activities", () => {
      const xaml = buildMinimalXaml('<ui:LogMessage Level="Info" Message="test" DisplayName="Log" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.activitiesDetected).toContain("ui:LogMessage");
      expect(result.neededPackages.has("UiPath.System.Activities")).toBe(true);
      expect(result.neededPackages.has("UiPath.UIAutomation.Activities")).toBe(true);
      expect(result.neededAssemblies.has("UiPath.System.Activities")).toBe(true);
      expect(result.neededAssemblies.has("UiPath.UIAutomation.Activities")).toBe(true);
      expect(result.neededNamespaces.has("UiPath.Core.Activities")).toBe(true);
    });

    it("detects ui:InvokeWorkflowFile and resolves to UiPath.System.Activities", () => {
      const xaml = buildMinimalXaml('<ui:InvokeWorkflowFile DisplayName="Invoke" WorkflowFileName="Sub.xaml" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.activitiesDetected).toContain("ui:InvokeWorkflowFile");
      expect(result.neededPackages.has("UiPath.System.Activities")).toBe(true);
    });

    it("detects ui:Comment and resolves to UiPath.System.Activities", () => {
      const xaml = buildMinimalXaml('<ui:Comment DisplayName="Comment" Text="A comment" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.activitiesDetected).toContain("ui:Comment");
      expect(result.neededPackages.has("UiPath.System.Activities")).toBe(true);
    });

    it("detects ui:GetTransactionItem and resolves to UiPath.System.Activities", () => {
      const xaml = buildMinimalXaml('<ui:GetTransactionItem DisplayName="Get Item" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.activitiesDetected).toContain("ui:GetTransactionItem");
      expect(result.neededPackages.has("UiPath.System.Activities")).toBe(true);
    });

    it("detects ui:SetTransactionStatus and resolves to UiPath.System.Activities", () => {
      const xaml = buildMinimalXaml('<ui:SetTransactionStatus DisplayName="Set Status" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.activitiesDetected).toContain("ui:SetTransactionStatus");
      expect(result.neededPackages.has("UiPath.System.Activities")).toBe(true);
    });

    it("detects uds:CreateEntity and resolves to UiPath.DataService.Activities", () => {
      const udsXmlns = 'xmlns:uds="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities"';
      const xaml = buildMinimalXaml('<uds:CreateEntity DisplayName="Create Entity" />', udsXmlns);
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.activitiesDetected).toContain("uds:CreateEntity");
      expect(result.neededPackages.has("UiPath.DataService.Activities")).toBe(true);
      expect(result.neededAssemblies.has("UiPath.DataService.Activities")).toBe(true);
      expect(result.neededNamespaces.has("UiPath.DataService.Activities")).toBe(true);
    });

    it("detects uds:QueryEntity and resolves to UiPath.DataService.Activities", () => {
      const udsXmlns = 'xmlns:uds="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities"';
      const xaml = buildMinimalXaml('<uds:QueryEntity DisplayName="Query Entity" />', udsXmlns);
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.activitiesDetected).toContain("uds:QueryEntity");
      expect(result.neededPackages.has("UiPath.DataService.Activities")).toBe(true);
    });

    it("when ui: activities present, ensures both System and UIAutomation packages are needed", () => {
      const xaml = buildMinimalXaml('<ui:Click DisplayName="Click Button" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.neededPackages.has("UiPath.System.Activities")).toBe(true);
      expect(result.neededPackages.has("UiPath.UIAutomation.Activities")).toBe(true);
    });

    it("handles mixed ui and uds activities", () => {
      const udsXmlns = 'xmlns:uds="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities"';
      const body = `
        <ui:LogMessage Level="Info" Message="test" DisplayName="Log" />
        <uds:CreateEntity DisplayName="Create Record" />
        <uds:QueryEntity DisplayName="Query Records" />
      `;
      const xaml = buildMinimalXaml(body, udsXmlns);
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.neededPackages.has("UiPath.System.Activities")).toBe(true);
      expect(result.neededPackages.has("UiPath.UIAutomation.Activities")).toBe(true);
      expect(result.neededPackages.has("UiPath.DataService.Activities")).toBe(true);
    });

    it("skips standard XML prefixes", () => {
      const xaml = buildMinimalXaml('<ui:LogMessage Level="Info" Message="test" DisplayName="Log" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      const skipPrefixes = ["xmlns", "xml", "x", "sap", "sap2010", "mc", "s", "scg", "sco", "mva", "sads", "scg2"];
      for (const activity of result.activitiesDetected) {
        const prefix = activity.split(":")[0];
        expect(skipPrefixes).not.toContain(prefix);
      }
    });
  });

  describe("REFramework Main.xaml template", () => {
    it("Windows template contains UiPath.System.Activities assembly reference", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      expect(mainXaml).toContain("<AssemblyReference>UiPath.System.Activities</AssemblyReference>");
    });

    it("Windows template contains UiPath.UIAutomation.Activities assembly reference", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      expect(mainXaml).toContain("<AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>");
    });

    it("Portable template contains UiPath.System.Activities assembly reference", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Portable");
      expect(mainXaml).toContain("<AssemblyReference>UiPath.System.Activities</AssemblyReference>");
    });

    it("Portable template contains UiPath.UIAutomation.Activities assembly reference", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Portable");
      expect(mainXaml).toContain("<AssemblyReference>UiPath.UIAutomation.Activities</AssemblyReference>");
    });

    it("contains required namespace imports for UiPath.Core.Activities", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      expect(mainXaml).toContain("<x:String>UiPath.Core.Activities</x:String>");
    });

    it("contains ui xmlns declaration", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      expect(mainXaml).toContain('xmlns:ui="http://schemas.uipath.com/workflow/activities"');
    });
  });

  describe("Studio Resolution Smoke Test passes for REFramework workflows", () => {
    it("passes for a REFramework Main.xaml with all required declarations", () => {
      const mainXaml = generateReframeworkMainXaml("TestProject", "TestQueue", "Windows");
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);

      const deps: Record<string, string> = {
        "UiPath.System.Activities": "25.10.0",
        "UiPath.UIAutomation.Activities": "25.10.0",
      };

      const result = runStudioResolutionSmokeTest(deferredWrites, deps);
      expect(result.errors.length).toBe(0);
    });

    it("passes for a Process.xaml with ui:InvokeWorkflowFile and ui:LogMessage", () => {
      const processXaml = buildMinimalXaml(`
        <ui:InvokeWorkflowFile DisplayName="Run Sub" WorkflowFileName="Sub.xaml" />
        <ui:LogMessage Level="Info" Message="[&quot;Done&quot;]" DisplayName="Log Done" />
      `);
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Process.xaml", processXaml);

      const deps: Record<string, string> = {
        "UiPath.System.Activities": "25.10.0",
        "UiPath.UIAutomation.Activities": "25.10.0",
      };

      const result = runStudioResolutionSmokeTest(deferredWrites, deps);
      expect(result.errors.length).toBe(0);
    });
  });

  describe("Studio Resolution Smoke Test passes for Data Service workflows", () => {
    it("passes for a workflow with uds:CreateEntity and uds:QueryEntity", () => {
      const udsXmlns = 'xmlns:uds="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities"';
      const body = `
        <uds:CreateEntity DisplayName="Create Record" />
        <uds:QueryEntity DisplayName="Query Records" />
      `;
      const xaml = buildMinimalXaml(body, udsXmlns);

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/DataServiceWorkflow.xaml", xaml);

      const udsInfo = PACKAGE_NAMESPACE_MAP["UiPath.DataService.Activities"];
      const deps: Record<string, string> = {
        "UiPath.System.Activities": "25.10.0",
        "UiPath.UIAutomation.Activities": "25.10.0",
        "UiPath.DataService.Activities": "25.10.0",
      };

      const declaredAssemblies = new Set<string>();
      const asmPattern = /<AssemblyReference>([^<]+)<\/AssemblyReference>/g;
      let m;
      while ((m = asmPattern.exec(xaml)) !== null) {
        declaredAssemblies.add(m[1].trim());
      }

      if (!declaredAssemblies.has("UiPath.DataService.Activities")) {
        let updated = xaml;
        const refsMatch = updated.match(/<\/sco:Collection>\s*<\/TextExpression\.ReferencesForImplementation>/);
        if (refsMatch && refsMatch.index !== undefined) {
          updated = updated.slice(0, refsMatch.index) +
            `      <AssemblyReference>UiPath.DataService.Activities</AssemblyReference>\n` +
            updated.slice(refsMatch.index);
        }
        const nsMatch = updated.match(/<\/sco:Collection>\s*<\/TextExpression\.NamespacesForImplementation>/);
        if (nsMatch && nsMatch.index !== undefined) {
          updated = updated.slice(0, nsMatch.index) +
            `      <x:String>UiPath.DataService.Activities</x:String>\n` +
            updated.slice(nsMatch.index);
        }
        deferredWrites.set("lib/DataServiceWorkflow.xaml", updated);
      }

      const result = runStudioResolutionSmokeTest(deferredWrites, deps);
      expect(result.errors.length).toBe(0);
    });
  });

  describe("Authoritative synthesis injects missing declarations", () => {
    it("deriveRequiredDeclarationsForXaml returns correct xmlns for uds activities", () => {
      const udsXmlns = 'xmlns:uds="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities"';
      const xaml = buildMinimalXaml('<uds:CreateEntity DisplayName="Create" />', udsXmlns);
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.neededXmlns.has("uds")).toBe(true);
      expect(result.neededXmlns.get("uds")).toBe("clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities");
    });

    it("deriveRequiredDeclarationsForXaml returns correct xmlns for ui activities", () => {
      const xaml = buildMinimalXaml('<ui:LogMessage Level="Info" Message="test" DisplayName="Log" />');
      const result = deriveRequiredDeclarationsForXaml(xaml);
      expect(result.neededXmlns.has("ui")).toBe(true);
      expect(result.neededXmlns.get("ui")).toBe("http://schemas.uipath.com/workflow/activities");
    });
  });

  describe("insertBeforeClosingCollectionTag", () => {
    it("succeeds with standard whitespace between closing tags", () => {
      const xml = `<sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System</AssemblyReference>
    </sco:Collection>
  </TextExpression.ReferencesForImplementation>`;
      const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.ReferencesForImplementation>", "      <AssemblyReference>NewRef</AssemblyReference>");
      expect(result.succeeded).toBe(true);
      expect(result.updated).toContain("<AssemblyReference>NewRef</AssemblyReference>");
      expect(result.updated).toContain("</sco:Collection>");
    });

    it("succeeds with non-standard content between closing tags (fallback path)", () => {
      const xml = `<sco:Collection x:TypeArguments="AssemblyReference">
      <AssemblyReference>System</AssemblyReference>
    </sco:Collection>
    <!-- some comment -->
    <SomeOtherElement />
  </TextExpression.ReferencesForImplementation>`;
      const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.ReferencesForImplementation>", "      <AssemblyReference>NewRef</AssemblyReference>");
      expect(result.succeeded).toBe(true);
      expect(result.updated).toContain("<AssemblyReference>NewRef</AssemblyReference>");
    });

    it("succeeds with no whitespace between closing tags", () => {
      const xml = `<sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
    </sco:Collection></TextExpression.NamespacesForImplementation>`;
      const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.NamespacesForImplementation>", "      <x:String>NewNs</x:String>");
      expect(result.succeeded).toBe(true);
      expect(result.updated).toContain("<x:String>NewNs</x:String>");
    });

    it("fails and returns succeeded=false when neither closing tag is present", () => {
      const xml = `<Activity><Sequence /></Activity>`;
      const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.ReferencesForImplementation>", "<AssemblyReference>X</AssemblyReference>");
      expect(result.succeeded).toBe(false);
      expect(result.updated).toBe(xml);
    });

    it("fails when parent closing tag exists but no sco:Collection closing tag before it", () => {
      const xml = `<TextExpression.ReferencesForImplementation>
    <SomeOther>content</SomeOther>
  </TextExpression.ReferencesForImplementation>`;
      const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.ReferencesForImplementation>", "<AssemblyReference>X</AssemblyReference>");
      expect(result.succeeded).toBe(false);
      expect(result.updated).toBe(xml);
    });

    it("does not target sco:Collection from a sibling block (cross-block protection)", () => {
      const xml = `<TextExpression.NamespacesForImplementation>
    <sco:Collection x:TypeArguments="x:String">
      <x:String>System</x:String>
    </sco:Collection>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <BrokenContainer>
      <AssemblyReference>System.Activities</AssemblyReference>
    </BrokenContainer>
  </TextExpression.ReferencesForImplementation>`;
      const result = insertBeforeClosingCollectionTag(xml, "</TextExpression.ReferencesForImplementation>", "<AssemblyReference>NewRef</AssemblyReference>");
      expect(result.succeeded).toBe(false);
      expect(result.updated).toBe(xml);
    });
  });

  describe("Insertion failure produces warnings", () => {
    it("insertBeforeClosingCollectionTag returns succeeded=false when target is missing", () => {
      const xmlWithNoTarget = `<Activity><Sequence /></Activity>`;
      const result = insertBeforeClosingCollectionTag(xmlWithNoTarget, "</TextExpression.ReferencesForImplementation>", "<AssemblyReference>Test</AssemblyReference>");
      expect(result.succeeded).toBe(false);
      expect(result.updated).toBe(xmlWithNoTarget);
    });

    it("compliance layer emits console.warn with file identity when injection target is missing", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const xmlWithBrokenDeclarationBlocks = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="TestWarningWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:mva="clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Collections.Generic;assembly=mscorlib"
  xmlns:scg2="clr-namespace:System.Data;assembly=System.Data"
  xmlns:sco="clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <mva:VisualBasic.Settings>
    <x:Null />
  </mva:VisualBasic.Settings>
  <sap2010:WorkflowViewState.IdRef>TestWarningWorkflow_1</sap2010:WorkflowViewState.IdRef>
  <TextExpression.NamespacesForImplementation>
    <BrokenContainer>
      <x:String>System</x:String>
    </BrokenContainer>
  </TextExpression.NamespacesForImplementation>
  <TextExpression.ReferencesForImplementation>
    <BrokenContainer>
      <AssemblyReference>System.Activities</AssemblyReference>
    </BrokenContainer>
  </TextExpression.ReferencesForImplementation>
  <Sequence DisplayName="Main Sequence">
    <ui:LogMessage Level="Info" Message="test" DisplayName="Log" />
  </Sequence>
</Activity>`;

      try {
        normalizeXaml(xmlWithBrokenDeclarationBlocks, "Windows");
      } catch {
      }

      const warnCalls = warnSpy.mock.calls.map(c => String(c[0]));
      const injectionWarnings = warnCalls.filter(msg =>
        msg.includes("[XAML Compliance] WARNING:") && msg.includes("Failed to inject")
      );
      expect(injectionWarnings.length).toBeGreaterThan(0);

      const hasFileIdentity = injectionWarnings.some(msg =>
        msg.includes("[TestWarningWorkflow]")
      );
      expect(hasFileIdentity).toBe(true);

      warnSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
