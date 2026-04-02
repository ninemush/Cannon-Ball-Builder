import { describe, it, expect } from "vitest";
import { wrapVariableDefault } from "../workflow-tree-assembler";
import { canonicalizeWorkflowName, detectFinalDedupCollisions, resolveDependencies, assertDhgArchiveParity } from "../package-assembler";
import { ACTIVITY_DEFINITIONS_REGISTRY } from "../catalog/activity-definitions";

describe("Task 388: Pipeline integrity — dependencies, namespaces, and package-DHG parity", () => {

  describe("wrapVariableDefault handles XML-escaped VB concatenation", () => {
    it("should bracket-wrap expressions containing &amp; (XML-escaped VB &)", () => {
      const input = '"screenshots/error_" &amp; DateTime.Now.ToString("yyyyMMdd_HHmmss") &amp; ".png"';
      const result = wrapVariableDefault(input, "String");
      expect(result.startsWith("[")).toBe(true);
      expect(result.endsWith("]")).toBe(true);
    });

    it("should bracket-wrap expressions containing literal VB & operator", () => {
      const input = '"Hello " & userName & "!"';
      const result = wrapVariableDefault(input, "String");
      expect(result.startsWith("[")).toBe(true);
      expect(result.endsWith("]")).toBe(true);
    });

    it("should not double-bracket already-bracketed expressions", () => {
      const input = '["screenshots/error_" & DateTime.Now.ToString("yyyyMMdd_HHmmss") & ".png"]';
      const result = wrapVariableDefault(input, "String");
      expect(result).toBe(input);
    });

    it("should return plain strings as quoted", () => {
      const result = wrapVariableDefault("hello world", "String");
      expect(result).toBe('"hello world"');
    });

    it("should return boolean literals as-is", () => {
      expect(wrapVariableDefault("True", "Boolean")).toBe("True");
      expect(wrapVariableDefault("False", "Boolean")).toBe("False");
    });

    it("should return numeric literals as-is", () => {
      expect(wrapVariableDefault("42", "Int32")).toBe("42");
      expect(wrapVariableDefault("3.14", "Double")).toBe("3.14");
    });
  });

  describe("canonicalizeWorkflowName handles ValueIntent patterns", () => {
    it("should extract value from unquoted ValueIntent {type:...,value:...}", () => {
      const result = canonicalizeWorkflowName("{type:literal,value:CalendarReader.xaml}");
      expect(result).toBe("calendarreader");
    });

    it("should extract value from JSON-quoted ValueIntent", () => {
      const result = canonicalizeWorkflowName('{"type":"literal","value":"CalendarReader.xaml"}');
      expect(result).toBe("calendarreader");
    });

    it("should extract value from JSON-quoted ValueIntent with .xaml suffix", () => {
      const result = canonicalizeWorkflowName('{"type":"literal","value":"CalendarReader.xaml"}.xaml');
      expect(result).toBe("calendarreader");
    });

    it("should extract value from HTML-escaped JSON ValueIntent", () => {
      const result = canonicalizeWorkflowName('{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}');
      expect(result).toBe("calendarreader");
    });

    it("should still handle plain names correctly", () => {
      expect(canonicalizeWorkflowName("CalendarReader")).toBe("calendarreader");
      expect(canonicalizeWorkflowName("CalendarReader.xaml")).toBe("calendarreader");
    });

    it("should still handle bracket-wrapped names", () => {
      expect(canonicalizeWorkflowName("[CalendarReader.xaml]")).toBe("calendarreader");
    });
  });

  describe("detectFinalDedupCollisions catches ValueIntent phantom duplicates", () => {
    it("should detect collision between ValueIntent-named and plain files", () => {
      const paths = [
        "lib/CalendarReader.xaml",
        'lib/{"type":"literal","value":"CalendarReader.xaml"}.xaml',
      ];
      const { dupsToRemove, collisionDetails } = detectFinalDedupCollisions(paths);
      expect(dupsToRemove.length).toBe(1);
      expect(collisionDetails.length).toBe(1);
    });

    it("should detect collision between unquoted ValueIntent and plain files", () => {
      const paths = [
        "lib/CalendarReader.xaml",
        "lib/{type:literal,value:CalendarReader.xaml}.xaml",
      ];
      const { dupsToRemove, collisionDetails } = detectFinalDedupCollisions(paths);
      expect(dupsToRemove.length).toBe(1);
    });

    it("should detect collision between HTML-escaped ValueIntent and plain files", () => {
      const paths = [
        "lib/CalendarReader.xaml",
        'lib/{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}.xaml',
      ];
      const { dupsToRemove, collisionDetails } = detectFinalDedupCollisions(paths);
      expect(dupsToRemove.length).toBe(1);
    });

    it("should not flag non-duplicate paths", () => {
      const paths = [
        "lib/CalendarReader.xaml",
        "lib/EmailSender.xaml",
      ];
      const { dupsToRemove } = detectFinalDedupCollisions(paths);
      expect(dupsToRemove.length).toBe(0);
    });
  });

  describe("BASELINE_PACKAGES enforcement is spec-driven", () => {
    it("resolveDependencies always includes UiPath.System.Activities", () => {
      const result = resolveDependencies(
        { workflows: [] },
        null,
        null,
        "Windows",
      );
      expect(result.deps["UiPath.System.Activities"]).toBeDefined();
    });

    it("resolveDependencies does NOT unconditionally add UiPath.Excel.Activities", () => {
      const result = resolveDependencies(
        { workflows: [] },
        null,
        null,
        "Windows",
      );
      expect(result.deps["UiPath.Excel.Activities"]).toBeUndefined();
    });

    it("resolveDependencies does NOT unconditionally add UiPath.UIAutomation.Activities", () => {
      const result = resolveDependencies(
        { workflows: [] },
        null,
        null,
        "Windows",
      );
      expect(result.deps["UiPath.UIAutomation.Activities"]).toBeUndefined();
    });
  });

  describe("GoogleCalendar activities are emission-approved in catalog", () => {
    it("GoogleCalendarGetEvents should be emissionApproved", () => {
      const gsuitePkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === "UiPath.GSuite.Activities");
      expect(gsuitePkg).toBeDefined();
      const activity = gsuitePkg!.activities.find(a => a.className === "GoogleCalendarGetEvents");
      expect(activity).toBeDefined();
      expect(activity!.emissionApproved).toBe(true);
    });

    it("GoogleCalendarCreateEvent should be emissionApproved", () => {
      const gsuitePkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === "UiPath.GSuite.Activities");
      const activity = gsuitePkg!.activities.find(a => a.className === "GoogleCalendarCreateEvent");
      expect(activity).toBeDefined();
      expect(activity!.emissionApproved).toBe(true);
    });

    it("GoogleContactsSearchContacts should be emissionApproved", () => {
      const gsuitePkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === "UiPath.GSuite.Activities");
      const activity = gsuitePkg!.activities.find(a => a.className === "GoogleContactsSearchContacts");
      expect(activity).toBeDefined();
      expect(activity!.emissionApproved).toBe(true);
    });

    it("GoogleContactsGetContact should be emissionApproved", () => {
      const gsuitePkg = ACTIVITY_DEFINITIONS_REGISTRY.find(p => p.packageId === "UiPath.GSuite.Activities");
      const activity = gsuitePkg!.activities.find(a => a.className === "GoogleContactsGetContact");
      expect(activity).toBeDefined();
      expect(activity!.emissionApproved).toBe(true);
    });
  });

  describe("assertDhgArchiveParity detects divergence", () => {
    const stubXaml = '<Activity>STUB_BLOCKING_FALLBACK: workflow stubbed</Activity>';
    const generatedXaml = '<Activity><Sequence DisplayName="Real logic"><Assign To="x" Value="1" /></Sequence></Activity>';

    it("should pass when DHG and archive agree on names and statuses", () => {
      const dhg = [
        "| # | Workflow | Status | Steps |",
        "|---|----------|--------|-------|",
        "| 1 | `Main.xaml` | Generated | 5 |",
        "| 2 | `Helper.xaml` | Stub | 1 |",
      ].join("\n");
      const result = assertDhgArchiveParity(
        dhg,
        ["Main", "Helper"],
        [
          { name: "lib/Main.xaml", content: generatedXaml },
          { name: "lib/Helper.xaml", content: stubXaml },
        ],
      );
      expect(result.passed).toBe(true);
      expect(result.divergences).toHaveLength(0);
    });

    it("should detect name divergence — workflow in archive but not DHG", () => {
      const dhg = [
        "| # | Workflow | Status | Steps |",
        "|---|----------|--------|-------|",
        "| 1 | `Main.xaml` | Generated | 5 |",
      ].join("\n");
      const result = assertDhgArchiveParity(
        dhg,
        ["Main", "Helper"],
        [
          { name: "lib/Main.xaml", content: generatedXaml },
          { name: "lib/Helper.xaml", content: generatedXaml },
        ],
      );
      expect(result.passed).toBe(false);
      expect(result.divergences.some(d => d.includes("In archive but not DHG"))).toBe(true);
    });

    it("should detect name divergence — workflow in DHG but not archive", () => {
      const dhg = [
        "| # | Workflow | Status | Steps |",
        "|---|----------|--------|-------|",
        "| 1 | `Main.xaml` | Generated | 5 |",
        "| 2 | `Ghost.xaml` | Generated | 3 |",
      ].join("\n");
      const result = assertDhgArchiveParity(
        dhg,
        ["Main"],
        [
          { name: "lib/Main.xaml", content: generatedXaml },
        ],
      );
      expect(result.passed).toBe(false);
      expect(result.divergences.some(d => d.includes("In DHG but not archive"))).toBe(true);
    });

    it("should detect status mismatch — DHG says Generated but archive is stub", () => {
      const dhg = [
        "| # | Workflow | Status | Steps |",
        "|---|----------|--------|-------|",
        "| 1 | `Main.xaml` | Generated | 5 |",
      ].join("\n");
      const result = assertDhgArchiveParity(
        dhg,
        ["Main"],
        [
          { name: "lib/Main.xaml", content: stubXaml },
        ],
      );
      expect(result.passed).toBe(false);
      expect(result.divergences.some(d => d.includes("Status mismatch") && d.includes("Generated") && d.includes("stub"))).toBe(true);
    });

    it("should detect status mismatch — DHG says Stub but archive is real", () => {
      const dhg = [
        "| # | Workflow | Status | Steps |",
        "|---|----------|--------|-------|",
        "| 1 | `Main.xaml` | Stub | 1 |",
      ].join("\n");
      const result = assertDhgArchiveParity(
        dhg,
        ["Main"],
        [
          { name: "lib/Main.xaml", content: generatedXaml },
        ],
      );
      expect(result.passed).toBe(false);
      expect(result.divergences.some(d => d.includes("Status mismatch") && d.includes("Stub") && d.includes("not a stub"))).toBe(true);
    });
  });
});
