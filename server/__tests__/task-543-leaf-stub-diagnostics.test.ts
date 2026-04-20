import { describe, it, expect } from "vitest";
import { preserveStructureAndStubLeaves } from "../xaml/gap-analyzer";

describe("Task #543 — leaf-stub transparency: every silent stub-out emits a structured diagnostic", () => {
  it("fires a leaf-stubbed diagnostic when a deliberately-blocked leaf activity is stubbed", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:LogMessage DisplayName="Greet" Level="Info" Message="hello" />
    <ui:LogMessage DisplayName="Bad" Level="Info" Message="boom" />
  </Sequence>
</Activity>`;

    const lines = xaml.split("\n");
    const badLineIdx = lines.findIndex(l => l.includes('DisplayName="Bad"'));
    expect(badLineIdx).toBeGreaterThan(0);

    const r = preserveStructureAndStubLeaves(
      xaml,
      [
        {
          file: "Main.xaml",
          check: "deliberate-stub",
          detail: `Deliberately stubbed for transparency test at Line ${badLineIdx + 1}`,
        },
      ],
      { isMainXaml: true },
    );

    expect(r.parseableXml).toBe(true);
    expect(r.stubbedActivities).toBeGreaterThan(0);
    expect(r.leafStubDiagnostics.length).toBeGreaterThan(0);

    const diag = r.leafStubDiagnostics[0];
    expect(diag.kind).toBe("leaf-stubbed");
    expect(diag.file).toBe("Main.xaml");
    expect(diag.tag).toMatch(/LogMessage/);
    expect(diag.displayName).toBe("Bad");
    expect(diag.activityPath).toMatch(/^line:\d+-\d+\//);
    expect(diag.startLine).toBeGreaterThan(0);
    expect(diag.endLine).toBeGreaterThanOrEqual(diag.startLine);
    expect(diag.originalExpressionHash).toMatch(/^[0-9a-f]{16}$/);
    expect(diag.check).toBe("deliberate-stub");
    expect(diag.reason).toMatch(/Deliberately stubbed/);

    // The XAML now contains a stub comment in place of the original leaf.
    expect(r.content).toContain("[STUB_STRUCTURAL_LEAF]");
    expect(r.content).not.toContain('Message="boom"');
    // Wrapper and the unrelated leaf are preserved.
    expect(r.content).toContain('DisplayName="Main"');
    expect(r.content).toContain('DisplayName="Greet"');
  });

  it("returns an empty leafStubDiagnostics array when no leaf is stubbed (no false positives)", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:LogMessage Level="Info" Message="hello" />
  </Sequence>
</Activity>`;
    const r = preserveStructureAndStubLeaves(xaml, [], { isMainXaml: true });
    expect(r.parseableXml).toBe(true);
    expect(r.stubbedActivities).toBe(0);
    expect(r.leafStubDiagnostics).toEqual([]);
  });

  it("emits one leafStubDiagnostic per stubbed leaf, each with a unique hash", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:LogMessage DisplayName="A" Level="Info" Message="alpha" />
    <ui:LogMessage DisplayName="B" Level="Info" Message="bravo" />
  </Sequence>
</Activity>`;
    const lines = xaml.split("\n");
    const aLine = lines.findIndex(l => l.includes('DisplayName="A"')) + 1;
    const bLine = lines.findIndex(l => l.includes('DisplayName="B"')) + 1;
    const r = preserveStructureAndStubLeaves(
      xaml,
      [
        { file: "Main.xaml", check: "test", detail: `Line ${aLine}` },
        { file: "Main.xaml", check: "test", detail: `Line ${bLine}` },
      ],
    );
    expect(r.parseableXml).toBe(true);
    expect(r.leafStubDiagnostics.length).toBe(2);
    const hashes = new Set(r.leafStubDiagnostics.map(d => d.originalExpressionHash));
    expect(hashes.size).toBe(2);
    const displayNames = r.leafStubDiagnostics.map(d => d.displayName).sort();
    expect(displayNames).toEqual(["A", "B"]);
  });
});
