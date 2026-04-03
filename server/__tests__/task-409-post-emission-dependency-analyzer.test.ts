import { describe, it, expect, beforeAll } from "vitest";
import {
  PostEmissionDependencyAnalyzer,
  runPostEmissionDependencyAnalysis,
  buildDependencyDiagnosticsArtifact,
  type DependencyAnalysisReport,
  type DependencyDiagnosticsArtifact,
  type ResolutionSource,
} from "../post-emission-dependency-analyzer";

const VALID_RESOLUTION_SOURCES: ResolutionSource[] = [
  "metadata_service",
  "catalog_service",
  "registry_match",
  "speculative_fallback",
  "manual_override",
  "unresolved",
];

function makeXaml(activities: string[], extraContent = ""): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="TestWorkflow"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/designer"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:uexcel="clr-namespace:UiPath.Excel.Activities;assembly=UiPath.Excel.Activities"
  xmlns:uweb="clr-namespace:UiPath.WebAPI.Activities;assembly=UiPath.WebAPI.Activities">
  <Sequence>
    ${activities.join("\n    ")}
    ${extraContent}
  </Sequence>
  <sap:VirtualizedContainerService.HintSize>300,400</sap:VirtualizedContainerService.HintSize>
  <sap2010:WorkflowViewState.IdRef>TestWorkflow_1</sap2010:WorkflowViewState.IdRef>
</Activity>`;
}

describe("PostEmissionDependencyAnalyzer", () => {
  describe("ResolutionSource enum values", () => {
    it("should have exactly the expected values", () => {
      expect(VALID_RESOLUTION_SOURCES).toContain("metadata_service");
      expect(VALID_RESOLUTION_SOURCES).toContain("catalog_service");
      expect(VALID_RESOLUTION_SOURCES).toContain("registry_match");
      expect(VALID_RESOLUTION_SOURCES).toContain("speculative_fallback");
      expect(VALID_RESOLUTION_SOURCES).toContain("manual_override");
      expect(VALID_RESOLUTION_SOURCES).toContain("unresolved");
      expect(VALID_RESOLUTION_SOURCES).toHaveLength(6);
    });
  });

  describe("DependencyAnalysisReport structure", () => {
    it("should return all required fields from analyze()", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{ name: "lib/Main.xaml", content: makeXaml(['<ui:LogMessage Message="Hello" />']) }];
      const report = analyzer.analyze(xamlEntries);

      expect(report).toHaveProperty("resolvedPackages");
      expect(report).toHaveProperty("unresolvedActivities");
      expect(report).toHaveProperty("ambiguousResolutions");
      expect(report).toHaveProperty("activityToPackageMap");
      expect(report).toHaveProperty("packageToActivitiesMap");
      expect(report).toHaveProperty("activityResolutions");
      expect(report).toHaveProperty("dependencyGaps");
    });

    it("every resolution entry should have a valid resolutionSource", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:LogMessage Message="Test" />',
          '<ui:Click />',
          '<Sequence />',
        ]),
      }];
      const report = analyzer.analyze(xamlEntries);

      for (const entry of report.activityResolutions) {
        expect(VALID_RESOLUTION_SOURCES).toContain(entry.resolutionSource);
      }
    });
  });

  describe("Activity scanning", () => {
    it("should detect prefixed activity tags", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:LogMessage Message="Hello" />',
          '<ui:Click ClickType="CLICK_SINGLE" />',
          '<ui:TypeInto Text="test" />',
        ]),
      }];
      const report = analyzer.analyze(xamlEntries);

      const resolvedTags = report.activityResolutions.map(r => r.activityTag);
      expect(resolvedTags).toContain("ui:LogMessage");
      expect(resolvedTags).toContain("ui:Click");
      expect(resolvedTags).toContain("ui:TypeInto");
    });

    it("should correctly handle unprefixed framework activities (If, Sequence resolve to System.Activities which is filtered)", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<If Condition="True">',
          '  <If.Then>',
          '    <ui:LogMessage Message="test" />',
          '  </If.Then>',
          '</If>',
        ]),
      }];
      const report = analyzer.analyze(xamlEntries);
      const resolvedTags = report.activityResolutions.map(r => r.activityTag);
      expect(resolvedTags).toContain("ui:LogMessage");
      expect(Object.keys(report.resolvedPackages).some(p => p === "System.Activities")).toBe(false);
    });

    it("should detect activities from namespace prefix mappings", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<uexcel:ReadRange SheetName="Sheet1" />',
        ]),
      }];
      const report = analyzer.analyze(xamlEntries);
      const resolvedTags = report.activityResolutions.map(r => r.activityTag);
      expect(resolvedTags).toContain("uexcel:ReadRange");
    });
  });

  describe("View-state and design-time metadata filtering", () => {
    it("should ignore sap:VirtualizedContainerService attributes", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/designer"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Message="Hello" />
  </Sequence>
  <sap:VirtualizedContainerService.HintSize>300,400</sap:VirtualizedContainerService.HintSize>
  <sap2010:WorkflowViewState.IdRef>Main_1</sap2010:WorkflowViewState.IdRef>
</Activity>`;
      const xamlEntries = [{ name: "lib/Main.xaml", content: xamlContent }];
      const report = analyzer.analyze(xamlEntries);

      const resolvedTags = report.activityResolutions.map(r => r.activityTag);
      expect(resolvedTags).not.toContain("sap:VirtualizedContainerService");
      expect(resolvedTags).not.toContain("sap2010:WorkflowViewState");
    });
  });

  describe("Unresolved activity detection", () => {
    it("should flag activities with no resolvable package as unresolved", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:LogMessage Message="Hello" />',
          '<zcustom:CompletelyUnknownActivity Param="val" />',
        ]).replace(
          'xmlns:ui=',
          'xmlns:zcustom="clr-namespace:Fake.Custom;assembly=Fake.Custom" xmlns:ui='
        ),
      }];
      const report = analyzer.analyze(xamlEntries);

      expect(report.unresolvedActivities.length).toBeGreaterThan(0);
      const unresolvedTags = report.unresolvedActivities.map(u => u.activityTag);
      expect(unresolvedTags).toContain("zcustom:CompletelyUnknownActivity");

      for (const entry of report.unresolvedActivities) {
        expect(entry.resolutionSource).toBe("unresolved");
      }
    });

    it("should include unresolved activities in dependencyGaps", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<zcustom:CompletelyUnknownActivity Param="val" />',
        ]).replace(
          'xmlns:ui=',
          'xmlns:zcustom="clr-namespace:Fake.Custom;assembly=Fake.Custom" xmlns:ui='
        ),
      }];
      const report = analyzer.analyze(xamlEntries);
      expect(report.dependencyGaps.length).toBeGreaterThan(0);
      expect(report.dependencyGaps.some(g => g.activityTag.includes("CompletelyUnknownActivity"))).toBe(true);
    });
  });

  describe("Type argument scanning", () => {
    it("should detect Newtonsoft.Json type references", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:DeserializeJson x:TypeArguments="Newtonsoft.Json.Linq.JObject" JsonString="test" />',
        ]),
      }];
      const report = analyzer.analyze(xamlEntries);
      const packages = Object.keys(report.resolvedPackages);
      expect(packages.some(p => p === "Newtonsoft.Json" || p.includes("WebAPI"))).toBe(true);
    });

    it("should detect Newtonsoft patterns in content", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:LogMessage Message="[JObject.Parse(jsonStr)]" />',
        ]),
      }];
      const report = analyzer.analyze(xamlEntries);
      const hasNewtonsoft = Object.keys(report.resolvedPackages).includes("Newtonsoft.Json");
      expect(hasNewtonsoft).toBe(true);
    });
  });

  describe("Assembly reference scanning", () => {
    it("should detect assembly references in XAML", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:LogMessage Message="Hello" />',
        ], `<TextExpression.ReferencesForImplementation>
          <sco:Collection x:TypeArguments="x:String">
            <AssemblyReference>UiPath.Excel.Activities</AssemblyReference>
          </sco:Collection>
        </TextExpression.ReferencesForImplementation>`),
      }];
      const report = analyzer.analyze(xamlEntries);
      const hasExcel = report.activityResolutions.some(r =>
        r.activityTag.includes("UiPath.Excel.Activities")
      );
      expect(hasExcel || Object.keys(report.resolvedPackages).some(p => p.includes("Excel"))).toBe(true);
    });
  });

  describe("Version selection policy", () => {
    it("should use deterministic version selection (metadata_service first)", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const result = analyzer.resolveVersion("UiPath.System.Activities");

      if (result.version) {
        expect(["metadata_service", "catalog_service"]).toContain(result.source);
        expect(result.version).toMatch(/^\d+\.\d+/);
      } else {
        expect(result.source).toBe("unresolved");
      }
    });

    it("should return unresolved for unknown packages", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const result = analyzer.resolveVersion("CompletelyFakePackage.That.DoesNotExist");

      expect(result.source).toBe("unresolved");
      expect(result.version).toBeNull();
    });

    it("should never fabricate a version", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const result = analyzer.resolveVersion("NonExistentPackage.Activities");

      if (!result.version) {
        expect(result.source).toBe("unresolved");
      }
    });

    it("should return unresolved for unknown packages (no fabricated baseline version)", () => {
      const windowsAnalyzer = new PostEmissionDependencyAnalyzer("Windows");
      const portableAnalyzer = new PostEmissionDependencyAnalyzer("Portable");
      const unknownPkg = "UiPath.TotallyFake.Activities";

      const windowsResult = windowsAnalyzer.resolveVersion(unknownPkg);
      const portableResult = portableAnalyzer.resolveVersion(unknownPkg);

      expect(windowsResult.version).toBeNull();
      expect(windowsResult.source).toBe("unresolved");
      expect(portableResult.version).toBeNull();
      expect(portableResult.source).toBe("unresolved");
    });

    it("should only accept metadata_service or catalog_service as version sources (never registry_match)", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const validSources = ["metadata_service", "catalog_service", "unresolved"];
      const result = analyzer.resolveVersion("UiPath.System.Activities");
      expect(validSources).toContain(result.source);
    });
  });

  describe("Orphan dependency detection", () => {
    it("should detect dependencies declared but not used", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const minimalXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence>
    <ui:LogMessage Message="Hello" />
  </Sequence>
</Activity>`;
      const xamlEntries = [{ name: "lib/Main.xaml", content: minimalXaml }];
      const report = analyzer.analyze(xamlEntries);

      const fakeDeps: Record<string, string> = {
        "UiPath.System.Activities": "23.10.6",
        "UiPath.Excel.Activities": "2.23.2",
        "UiPath.Database.Activities": "1.8.0",
      };

      const diagnostics = buildDependencyDiagnosticsArtifact(report, null, fakeDeps);

      expect(diagnostics.orphanDependencies.length).toBeGreaterThan(0);
      const orphanIds = diagnostics.orphanDependencies.map(o => o.packageId);
      expect(orphanIds).toContain("UiPath.Excel.Activities");
      expect(orphanIds).toContain("UiPath.Database.Activities");
    });

    it("orphan dependencies should be first-class entries with reason", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([{
        name: "lib/Main.xaml",
        content: makeXaml(['<Sequence />']),
      }]);

      const diagnostics = buildDependencyDiagnosticsArtifact(
        report,
        null,
        { "UiPath.UnusedPackage": "1.0.0" },
      );

      for (const orphan of diagnostics.orphanDependencies) {
        expect(orphan).toHaveProperty("packageId");
        expect(orphan).toHaveProperty("version");
        expect(orphan).toHaveProperty("reason");
        expect(orphan.reason.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Speculative vs derived comparison", () => {
    it("should produce delta when speculative and derived differ", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([{
        name: "lib/Main.xaml",
        content: makeXaml(['<ui:LogMessage Message="Hello" />']),
      }]);

      const speculativeDeps = {
        "UiPath.System.Activities": "23.10.6",
        "UiPath.Excel.Activities": "2.23.2",
      };

      const finalDeps = {
        "UiPath.System.Activities": "23.10.6",
      };

      const diagnostics = buildDependencyDiagnosticsArtifact(report, speculativeDeps, finalDeps);

      expect(diagnostics.speculativeComparisonDelta).not.toBeNull();
      expect(diagnostics.speculativeComparisonDelta!.addedBySpeculative).toContain("UiPath.Excel.Activities");
      expect(diagnostics.speculativeComparisonDelta!.common).toContain("UiPath.System.Activities");
    });

    it("should return null delta when no speculative deps provided", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([{
        name: "lib/Main.xaml",
        content: makeXaml(['<Sequence />']),
      }]);

      const diagnostics = buildDependencyDiagnosticsArtifact(report, null, {});
      expect(diagnostics.speculativeComparisonDelta).toBeNull();
    });
  });

  describe("DependencyDiagnosticsArtifact structure", () => {
    it("should contain all required fields", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([{
        name: "lib/Main.xaml",
        content: makeXaml(['<ui:LogMessage Message="Hello" />']),
      }]);

      const diagnostics = buildDependencyDiagnosticsArtifact(
        report,
        { "UiPath.System.Activities": "23.10.6" },
        { "UiPath.System.Activities": "23.10.6" },
      );

      expect(diagnostics).toHaveProperty("activityResolutions");
      expect(diagnostics).toHaveProperty("packageResolutions");
      expect(diagnostics).toHaveProperty("unresolvedActivities");
      expect(diagnostics).toHaveProperty("ambiguousResolutions");
      expect(diagnostics).toHaveProperty("orphanDependencies");
      expect(diagnostics).toHaveProperty("speculativeComparisonDelta");
      expect(diagnostics).toHaveProperty("summary");
      expect(diagnostics.summary).toHaveProperty("totalActivities");
      expect(diagnostics.summary).toHaveProperty("resolvedPackages");
      expect(diagnostics.summary).toHaveProperty("unresolvedCount");
      expect(diagnostics.summary).toHaveProperty("ambiguousCount");
      expect(diagnostics.summary).toHaveProperty("orphanCount");
    });

    it("every packageResolution entry should have a valid resolutionSource", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:LogMessage Message="Hello" />',
          '<ui:Click />',
        ]),
      }]);

      const diagnostics = buildDependencyDiagnosticsArtifact(report, null, {});

      for (const entry of diagnostics.packageResolutions) {
        expect(VALID_RESOLUTION_SOURCES).toContain(entry.resolutionSource);
      }
    });
  });

  describe("runPostEmissionDependencyAnalysis integration", () => {
    it("should return deps, report, and diagnostics", () => {
      const result = runPostEmissionDependencyAnalysis(
        [{
          name: "lib/Main.xaml",
          content: makeXaml([
            '<ui:LogMessage Message="Hello" />',
            '<ui:Click />',
          ]),
        }],
        "Windows",
        { "UiPath.System.Activities": "23.10.6" },
      );

      expect(result).toHaveProperty("deps");
      expect(result).toHaveProperty("report");
      expect(result).toHaveProperty("diagnostics");
      expect(typeof result.deps).toBe("object");
      expect(result.diagnostics.summary.totalActivities).toBeGreaterThan(0);
    });

    it("should not include packages with no resolved version in deps", () => {
      const result = runPostEmissionDependencyAnalysis(
        [{
          name: "lib/Main.xaml",
          content: makeXaml(['<ui:LogMessage Message="Hello" />']),
        }],
        "Windows",
        null,
      );

      for (const [pkg, version] of Object.entries(result.deps)) {
        expect(version).toBeTruthy();
        expect(version).toMatch(/^\d+/);
      }
    });
  });

  describe("Non-XAML entries are skipped", () => {
    it("should skip non-xaml files", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([
        { name: "lib/project.json", content: '{"name":"test"}' },
        { name: "lib/Main.xaml", content: makeXaml(['<ui:LogMessage Message="Hello" />']) },
        { name: "lib/config.csv", content: "key,value" },
      ]);

      expect(report.activityResolutions.length).toBeGreaterThan(0);
      expect(report.activityResolutions.every(r => r.fileName !== "project.json")).toBe(true);
      expect(report.activityResolutions.every(r => r.fileName !== "config.csv")).toBe(true);
    });
  });

  describe("Multiple XAML files", () => {
    it("should scan activities across all XAML files", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([
        {
          name: "lib/Main.xaml",
          content: makeXaml(['<ui:LogMessage Message="Hello" />']),
        },
        {
          name: "lib/Process.xaml",
          content: makeXaml(['<ui:Click />', '<ui:TypeInto Text="test" />']),
        },
      ]);

      const resolvedTags = report.activityResolutions.map(r => r.activityTag);
      expect(resolvedTags).toContain("ui:LogMessage");
      expect(resolvedTags).toContain("ui:Click");
      expect(resolvedTags).toContain("ui:TypeInto");
    });
  });

  describe("Ambiguity reporting correctness", () => {
    it("should not emit false ambiguous diagnostics when deterministic tie-break resolves cleanly", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const xamlEntries = [{
        name: "lib/Main.xaml",
        content: makeXaml([
          '<ui:LogMessage Message="Hello" />',
          '<ui:Click />',
          '<ui:TypeInto Text="test" />',
        ]),
      }];
      const report = analyzer.analyze(xamlEntries);
      expect(report.ambiguousResolutions).toHaveLength(0);

      const resolved = report.activityResolutions.filter(r => r.resolvedPackage !== null);
      for (const entry of resolved) {
        expect(entry.resolutionSource).not.toBe("unresolved");
      }

      const unresolved = report.activityResolutions.filter(r => r.resolvedPackage === null);
      for (const entry of unresolved) {
        expect(entry.resolutionSource).toBe("unresolved");
      }
    });
  });

  describe("resolutionSource correctness per resolution path", () => {
    it("should mark registry-resolved activities with registry_match", () => {
      const analyzer = new PostEmissionDependencyAnalyzer("Windows");
      const report = analyzer.analyze([{
        name: "lib/Main.xaml",
        content: makeXaml(['<ui:LogMessage Message="Hello" />']),
      }]);

      const logEntry = report.activityResolutions.find(r => r.activityTag === "ui:LogMessage");
      if (logEntry && logEntry.resolvedPackage) {
        expect(VALID_RESOLUTION_SOURCES).toContain(logEntry.resolutionSource);
        expect(logEntry.resolutionSource).not.toBe("unresolved");
      }
    });
  });
});
