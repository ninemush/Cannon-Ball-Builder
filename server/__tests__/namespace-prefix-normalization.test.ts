import { describe, it, expect } from "vitest";
import { getActivityPrefixStrict, validateActivityTagSemantics, validateNamespacePrefixes, normalizeNamespaceAliases, makeUiPathCompliant, collectUsedPackages } from "../xaml/xaml-compliance";

describe("XAML namespace prefix normalization", () => {
  describe("getActivityPrefixStrict canonical prefix lookup", () => {
    it("returns 'ui' for Click", () => {
      expect(getActivityPrefixStrict("Click")).toBe("ui");
    });

    it("returns 'uweb' for HttpClient", () => {
      expect(getActivityPrefixStrict("HttpClient")).toBe("uweb");
    });

    it("returns '' (no prefix) for system activities like Assign", () => {
      expect(getActivityPrefixStrict("Assign")).toBe("");
    });

    it("returns null for unknown activities", () => {
      expect(getActivityPrefixStrict("CompletelyUnknownActivity")).toBeNull();
    });
  });

  describe("validateActivityTagSemantics prefix repair", () => {
    it("rewrites uia: prefix to ui: for known activities", () => {
      const xml = `<uia:Click DisplayName="Click Button" /><uia:TypeInto DisplayName="Type text" /></uia:TypeInto>`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<ui:Click ");
      expect(result.repairedXml).toContain("<ui:TypeInto ");
      expect(result.repairedXml).toContain("</ui:TypeInto>");
      expect(result.repairedXml).not.toContain("uia:");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.valid).toBe(true);
    });

    it("rewrites uipath: prefix to ui: for known activities", () => {
      const xml = `<uipath:GetText DisplayName="Get Text" />`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<ui:GetText ");
      expect(result.repairedXml).not.toContain("uipath:");
      expect(result.valid).toBe(true);
    });

    it("rewrites wrong prefix to correct non-ui prefix", () => {
      const xml = `<ui:HttpClient DisplayName="HTTP Request" />`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<uweb:HttpClient ");
      expect(result.valid).toBe(true);
    });

    it("removes prefix for system activities with wrong prefix", () => {
      const xml = `<ui:Assign DisplayName="Set value">
        <ui:Assign.To><OutArgument x:TypeArguments="x:String">test</OutArgument></ui:Assign.To>
        <ui:Assign.Value><InArgument x:TypeArguments="x:String">value</InArgument></ui:Assign.Value>
      </ui:Assign>`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<Assign ");
      expect(result.repairedXml).toContain("</Assign>");
      expect(result.repairedXml).toContain("<Assign.To>");
      expect(result.repairedXml).not.toContain("<ui:Assign");
      expect(result.valid).toBe(true);
    });

    it("does not modify correctly-prefixed activities", () => {
      const xml = `<ui:Click DisplayName="Click" />`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toBe(xml);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("semantic repair runs before namespace validation", () => {
    it("uia: prefix in tags would fail namespace validation but passes after semantic repair", () => {
      const xmlWithBadPrefix = `<uia:Click DisplayName="Click Button" />`;

      const nsResultBefore = validateNamespacePrefixes(xmlWithBadPrefix);
      expect(nsResultBefore.valid).toBe(false);
      expect(nsResultBefore.errors.some(e => e.includes("uia"))).toBe(true);

      const semanticResult = validateActivityTagSemantics(xmlWithBadPrefix);
      expect(semanticResult.repairedXml).toContain("<ui:Click ");

      const nsResultAfter = validateNamespacePrefixes(semanticResult.repairedXml);
      expect(nsResultAfter.errors.filter(e => e.includes("uia"))).toHaveLength(0);
    });
  });

  describe("normalizeNamespaceAliases — alias-to-canonical prefix mapping", () => {
    it("normalizes dataservice: to uds:", () => {
      const xml = `<dataservice:QueryRecords DisplayName="Query" /><dataservice:UpdateRecord DisplayName="Update" /></dataservice:UpdateRecord>`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<uds:QueryRecords ");
      expect(result.xml).toContain("<uds:UpdateRecord ");
      expect(result.xml).toContain("</uds:UpdateRecord>");
      expect(result.xml).not.toContain("dataservice:");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("dataservice");
      expect(result.warnings[0]).toContain("uds");
    });

    it("normalizes persistence: to upers:", () => {
      const xml = `<persistence:CreateBookmark DisplayName="Create Bookmark" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<upers:CreateBookmark ");
      expect(result.xml).not.toContain("persistence:");
    });

    it("normalizes excel: to uexcel:", () => {
      const xml = `<excel:ReadRange DisplayName="Read Range" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<uexcel:ReadRange ");
      expect(result.xml).not.toMatch(/(?<!u)excel:/);
    });

    it("normalizes mail: to umail:", () => {
      const xml = `<mail:SendMail DisplayName="Send" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<umail:SendMail ");
      expect(result.xml).not.toMatch(/(?<!u)mail:/);
    });

    it("normalizes database: to udb:", () => {
      const xml = `<database:ExecuteQuery DisplayName="Execute" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<udb:ExecuteQuery ");
      expect(result.xml).not.toContain("database:");
    });

    it("normalizes ds: abbreviation to uds:", () => {
      const xml = `<ds:QueryRecords DisplayName="Query" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<uds:QueryRecords ");
      expect(result.xml).not.toMatch(/(<\/?)ds:/);
    });

    it("normalizes datafabric: to uds:", () => {
      const xml = `<datafabric:QueryRecords DisplayName="Query" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<uds:QueryRecords ");
      expect(result.xml).not.toContain("datafabric:");
    });

    it("also normalizes xmlns declarations for aliased prefixes", () => {
      const xml = `xmlns:dataservice="clr-namespace:UiPath.DataService.Activities" <dataservice:QueryRecords />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("xmlns:uds=");
      expect(result.xml).toContain("<uds:QueryRecords ");
    });

    it("removes duplicate xmlns when canonical prefix already declared", () => {
      const xml = `<Activity xmlns:uds="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities" xmlns:dataservice="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities">
        <dataservice:QueryRecords DisplayName="Query" />
      </Activity>`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toContain("<uds:QueryRecords ");
      expect(result.xml).not.toContain("xmlns:dataservice");
      const xmlnsCount = (result.xml.match(/xmlns:uds=/g) || []).length;
      expect(xmlnsCount).toBe(1);
    });

    it("does not modify already-canonical prefixes", () => {
      const xml = `<uds:QueryRecords DisplayName="Query" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toBe(xml);
      expect(result.warnings).toHaveLength(0);
    });

    it("does not modify unknown prefixes with no package mapping", () => {
      const xml = `<randomprefix:SomeActivity DisplayName="Activity" />`;
      const result = normalizeNamespaceAliases(xml);
      expect(result.xml).toBe(xml);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("comment-orphan cleanup — XML comments stripped before namespace validation", () => {
    it("comment containing prefixed activity name does not cause namespace validation failure", () => {
      const xml = `<!-- UNKNOWN ACTIVITY: dataservice:QueryRecords -->
        <ui:Comment Text="Unknown activity" DisplayName="stub" />`;
      const nsResult = validateNamespacePrefixes(xml);
      expect(nsResult.errors.filter(e => e.includes("dataservice"))).toHaveLength(0);
    });

    it("comment with multiple prefixed names does not pollute usedPrefixes", () => {
      const xml = `<!-- UNKNOWN ACTIVITY: someprefix:SomeActivity -->
        <!-- UNKNOWN ACTIVITY: anotherprefix:AnotherActivity -->
        <ui:Click DisplayName="Click" />`;
      const nsResult = validateNamespacePrefixes(xml);
      expect(nsResult.errors.filter(e => e.includes("someprefix"))).toHaveLength(0);
      expect(nsResult.errors.filter(e => e.includes("anotherprefix"))).toHaveLength(0);
    });

    it("real tags outside comments still get validated", () => {
      const xml = `<!-- comment -->
        <unknownprefix:SomeActivity DisplayName="Activity" />`;
      const nsResult = validateNamespacePrefixes(xml);
      expect(nsResult.valid).toBe(false);
      expect(nsResult.errors.some(e => e.includes("unknownprefix"))).toBe(true);
    });
  });

  describe("truly unknown prefixes still fail validation", () => {
    it("unmappable prefix with no xmlns declaration fails namespace validation", () => {
      const xml = `<totallyunknown:SomeActivity DisplayName="Activity" />`;
      const nsResult = validateNamespacePrefixes(xml);
      expect(nsResult.valid).toBe(false);
      expect(nsResult.errors.some(e => e.includes("totallyunknown"))).toBe(true);
    });

    it("unmappable prefix is not affected by normalizeNamespaceAliases", () => {
      const xml = `<totallyunknown:SomeActivity DisplayName="Activity" />`;
      const aliasResult = normalizeNamespaceAliases(xml);
      expect(aliasResult.xml).toBe(xml);
      expect(aliasResult.warnings).toHaveLength(0);
    });
  });

  describe("combined scenario — aliased prefixes and comment stubs together", () => {
    it("XAML with aliased prefix tags and comment stubs processes without error", () => {
      const xml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
        xmlns:ui="http://schemas.uipath.com/workflow/activities"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:dataservice="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities">
        <Sequence>
          <dataservice:QueryRecords DisplayName="Query Records" />
          <!-- UNKNOWN ACTIVITY: dataservice:GetRobotAsset -->
          <ui:Comment Text="Unknown activity" DisplayName="GetRobotAsset (stub)" />
        </Sequence>
      </Activity>`;

      const aliasResult = normalizeNamespaceAliases(xml);
      expect(aliasResult.xml).toContain("<uds:QueryRecords ");
      expect(aliasResult.xml).toContain("xmlns:uds=");

      const nsResult = validateNamespacePrefixes(aliasResult.xml);
      expect(nsResult.errors).toHaveLength(0);
      expect(nsResult.valid).toBe(true);
    });

    it("makeUiPathCompliant handles XAML with aliased prefixes and comment stubs end-to-end", () => {
      const xml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:dataservice="clr-namespace:UiPath.DataService.Activities;assembly=UiPath.DataService.Activities">
  <Sequence DisplayName="Main">
    <dataservice:QueryRecords DisplayName="Query Records" />
    <!-- UNKNOWN ACTIVITY: dataservice:GetRobotAsset — "Get Asset" -->
    <ui:Comment Text="Unknown activity type: dataservice:GetRobotAsset. Manual implementation required." DisplayName="Get Asset (stub)" />
  </Sequence>
</Activity>`;

      const result = makeUiPathCompliant(xml);
      expect(result).toContain("<uds:QueryRecords ");
      expect(result).not.toMatch(/<dataservice:/);
      expect(result).toBeDefined();
    });
  });

  describe("collectUsedPackages — alias-aware package detection", () => {
    it("detects package from canonical prefix", () => {
      const xml = `<upers:CreateFormTask DisplayName="Create Task" />`;
      const packages = collectUsedPackages(xml);
      expect(packages.has("UiPath.Persistence.Activities")).toBe(true);
    });

    it("detects package from alias prefix (persistence: → UiPath.Persistence.Activities)", () => {
      const xml = `<persistence:CreateFormTask DisplayName="Create Task" />`;
      const packages = collectUsedPackages(xml);
      expect(packages.has("UiPath.Persistence.Activities")).toBe(true);
    });

    it("detects package from alias prefix (ds: → UiPath.DataService.Activities)", () => {
      const xml = `<ds:CreateEntity DisplayName="Create Entity" />`;
      const packages = collectUsedPackages(xml);
      expect(packages.has("UiPath.DataService.Activities")).toBe(true);
    });

    it("detects package from alias prefix (dataservice: → UiPath.DataService.Activities)", () => {
      const xml = `<dataservice:QueryRecords DisplayName="Query" />`;
      const packages = collectUsedPackages(xml);
      expect(packages.has("UiPath.DataService.Activities")).toBe(true);
    });
  });

  describe("alias-without-xmlns — end-to-end compliance", () => {
    it("persistence: tags without xmlns:persistence declaration pass makeUiPathCompliant", () => {
      const xml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <persistence:CreateFormTask DisplayName="Create Task" />
  </Sequence>
</Activity>`;

      const result = makeUiPathCompliant(xml);
      expect(result).toContain("<upers:CreateFormTask ");
      expect(result).not.toMatch(/<persistence:/);
      expect(result).toContain("xmlns:upers=");
      expect(result).toContain("UiPath.Persistence.Activities");
    });

    it("ds: tags without xmlns:ds declaration pass makeUiPathCompliant", () => {
      const xml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <ds:CreateEntity DisplayName="Create Entity" />
  </Sequence>
</Activity>`;

      const result = makeUiPathCompliant(xml);
      expect(result).toContain("<uds:CreateEntity ");
      expect(result).not.toMatch(/(<\/?)ds:/);
      expect(result).toContain("xmlns:uds=");
    });

    it("multiple alias prefixes without xmlns declarations all resolve correctly", () => {
      const xml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <persistence:CreateFormTask DisplayName="Create Task" />
    <dataservice:QueryRecords DisplayName="Query Records" />
  </Sequence>
</Activity>`;

      const result = makeUiPathCompliant(xml);
      expect(result).toContain("<upers:CreateFormTask ");
      expect(result).toContain("<uds:QueryRecords ");
      expect(result).toContain("xmlns:upers=");
      expect(result).toContain("xmlns:uds=");
      expect(result).not.toMatch(/<persistence:/);
      expect(result).not.toMatch(/<dataservice:/);
    });
  });
});
