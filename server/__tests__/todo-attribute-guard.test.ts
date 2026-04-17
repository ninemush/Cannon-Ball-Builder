import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitizeAttributeNameKey,
  repairTodoAttributeNamesInXaml,
  drainTodoAttributeGuardDiagnostics,
  drainTodoAttributeGuardDiagnosticsForFile,
  buildEmitterTimeHandoffCommentBlock,
  resetTodoAttributeGuardDiagnostics,
  toDhgIssuesFromGuardDiagnostics,
  isValidXmlName,
  looksLikeTodoMarker,
} from "../lib/todo-attribute-guard";
import type { StubCause } from "../lib/stub-cause";

describe("TODO attribute guard (Task #529)", () => {
  beforeEach(() => {
    resetTodoAttributeGuardDiagnostics();
  });

  describe("isValidXmlName", () => {
    it("accepts NCName and QName forms", () => {
      expect(isValidXmlName("DisplayName")).toBe(true);
      expect(isValidXmlName("ui:Click")).toBe(true);
      expect(isValidXmlName("x_y-z.0")).toBe(true);
    });
    it("rejects empty, leading-digit, colon-only, or space-bearing names", () => {
      expect(isValidXmlName("")).toBe(false);
      expect(isValidXmlName("1Bad")).toBe(false);
      expect(isValidXmlName(":bad")).toBe(false);
      expect(isValidXmlName("has space")).toBe(false);
      expect(isValidXmlName("TODO:")).toBe(false);
    });
  });

  describe("looksLikeTodoMarker", () => {
    it("flags TODO-prefixed tokens with various separators", () => {
      expect(looksLikeTodoMarker("TODO:")).toBe(true);
      expect(looksLikeTodoMarker("todo_bind")).toBe(true);
      expect(looksLikeTodoMarker("TODO - thing")).toBe(true);
      expect(looksLikeTodoMarker("TODO")).toBe(true);
    });
    it("does not flag legitimate names that contain TODO mid-string", () => {
      expect(looksLikeTodoMarker("AutoTODO")).toBe(false);
      expect(looksLikeTodoMarker("DisplayName")).toBe(false);
    });
  });

  describe("sanitizeAttributeNameKey (emitter-side)", () => {
    it("passes through valid keys", () => {
      const r = sanitizeAttributeNameKey("DisplayName", { file: "f.xaml", emitter: "test" });
      expect(r.omitted).toBe(false);
      expect(r.safeKey).toBe("DisplayName");
      expect(drainTodoAttributeGuardDiagnostics()).toHaveLength(0);
    });
    it("omits TODO-marker keys and records a structured diagnostic", () => {
      const r = sanitizeAttributeNameKey("TODO:", {
        file: "Wf.xaml",
        emitter: "wta:resolveDynamicTemplate:Click",
        rawValue: "click the button",
        workflow: "Wf",
      });
      expect(r.omitted).toBe(true);
      expect(r.safeKey).toBeUndefined();
      const diags = drainTodoAttributeGuardDiagnostics();
      expect(diags).toHaveLength(1);
      expect(diags[0].source).toBe("todo-attribute-guard");
      expect(diags[0].contextType).toBe("attribute-name");
      // TODO marker → required-field omission → activity-handoff path.
      expect(diags[0].replacementPath).toBe("activity-handoff");
      expect(diags[0].requiredFieldOmitted).toBe(true);
      expect(diags[0].file).toBe("Wf.xaml");
      expect(diags[0].workflow).toBe("Wf");
      expect(diags[0].originalToken).toContain("TODO:");
      expect(diags[0].originalToken).toContain("click the button");
    });
    it("omits structurally invalid (non-NCName) keys too", () => {
      const r = sanitizeAttributeNameKey("has space", { file: "f.xaml", emitter: "t" });
      expect(r.omitted).toBe(true);
      const diags = drainTodoAttributeGuardDiagnostics();
      expect(diags[0].reason).toMatch(/not a valid XML NCName/);
    });
  });

  describe("repairTodoAttributeNamesInXaml (pre-compliance scan)", () => {
    it("is a no-op when no TODO tokens present", () => {
      const xml = `<ui:Click DisplayName="Click" Selector="&lt;wnd/&gt;" />`;
      const r = repairTodoAttributeNamesInXaml(xml, { file: "Wf.xaml" });
      expect(r.content).toBe(xml);
      expect(r.repairs).toHaveLength(0);
    });

    it("does NOT touch TODO text in attribute-VALUE position", () => {
      const xml = `<ui:Click DisplayName="TODO - implement selector" Selector="x" />`;
      const r = repairTodoAttributeNamesInXaml(xml, { file: "Wf.xaml" });
      expect(r.content).toBe(xml);
      expect(r.repairs).toHaveLength(0);
    });

    it("drops a TODO-named attribute and preserves siblings (smallest-scope local degradation)", () => {
      const xml = `<ui:Click DisplayName="Click Submit" TODO_bind="user_intent_capture" Selector="&lt;wnd/&gt;" />`;
      const r = repairTodoAttributeNamesInXaml(xml, { file: "Wf.xaml", workflow: "Wf" });
      // Strip XML comments AND injected LogMessage handoff (which carries
      // TODO_bind in its Message *value* for operator visibility) — TODO_bind
      // must not appear anywhere else.
      const stripped = r.content
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<ui:LogMessage[^>]*\/>/g, "");
      expect(stripped).not.toContain("TODO_bind");
      expect(r.content).toContain('DisplayName="Click Submit"');
      expect(r.content).toContain('Selector="&lt;wnd/&gt;"');
      // Comment+LogMessage handoff present in buffer (contract-safe degradation).
      expect(r.content).toMatch(/<ui:LogMessage[^>]*Level="Warn"[^>]*TODO-ATTR-GUARD/);
      expect(r.repairs).toHaveLength(1);
      expect(r.repairs[0].contextType).toBe("attribute-name");
      // TODO marker → activity-handoff (required-field semantics).
      expect(r.repairs[0].replacementPath).toBe("activity-handoff");
      expect(r.repairs[0].requiredFieldOmitted).toBe(true);
      // The captured-value field still preserves the original text for DHG.
      expect(r.repairs[0].replacement).toMatch(/TODO/);
      expect(r.repairs[0].activity).toBe("Click");
      // Localized handoff comment is injected before the activity in-buffer.
      expect(r.content).toMatch(/<!--\s*TODO-attribute-guard:/);
      expect(r.content).toContain("required-field omission");
    });

    it("handles the canonical 53b42526 defect class: literal `TODO:` attribute", () => {
      const xml = `<ui:TypeInto DisplayName="Type" TODO:="bind to user input" Text="x" />`;
      const r = repairTodoAttributeNamesInXaml(xml, { file: "Main.xaml", workflow: "Main" });
      // TODO:= must not survive in attribute-name position on the activity tag.
      const openTagMatch = /<ui:TypeInto[^>]*>/.exec(r.content);
      expect(openTagMatch).not.toBeNull();
      expect(openTagMatch![0]).not.toMatch(/\bTODO/);
      expect(r.content).toContain('DisplayName="Type"');
      expect(r.content).toContain('Text="x"');
      // Localized handoff comment is injected before the activity.
      expect(r.content).toMatch(/<!--\s*TODO-attribute-guard:/);
      expect(r.repairs.length).toBeGreaterThanOrEqual(1);
      expect(r.repairs[0].source).toBe("todo-attribute-guard");
    });

    it("repaired output is XML-parseable (no whole-workflow stub needed)", async () => {
      const xml = `<root xmlns:ui="http://x"><ui:Click DisplayName="Go" TODO:="bind" /></root>`;
      const r = repairTodoAttributeNamesInXaml(xml, { file: "Wf.xaml" });
      const { XMLValidator } = await import("fast-xml-parser");
      const validation = XMLValidator.validate(r.content, { allowBooleanAttributes: false });
      expect(validation).toBe(true);
    });

    it("emits diagnostics into the shared ledger that the run-artifact channel can drain", () => {
      const xml = `<ui:Click TODO:="x" DisplayName="ok" />`;
      repairTodoAttributeNamesInXaml(xml, { file: "Wf.xaml", workflow: "Wf" });
      const drained = drainTodoAttributeGuardDiagnostics();
      expect(drained.length).toBeGreaterThan(0);
      for (const d of drained) {
        expect(d.source).toBe("todo-attribute-guard");
        expect(typeof d.reason).toBe("string");
        expect(d.file).toBe("Wf.xaml");
      }
      // Ledger drained — second drain should be empty.
      expect(drainTodoAttributeGuardDiagnostics()).toHaveLength(0);
    });
  });

  describe("Contract-aware degradation (Task #529 review feedback)", () => {
    it("marks requiredFieldOmitted=true and selects activity-handoff when contract probe says required", () => {
      const r = sanitizeAttributeNameKey("TODO:", {
        file: "Wf.xaml",
        emitter: "wta:Click",
        rawValue: "click target",
        activity: "Click",
        isRequiredProperty: (act, prop) => act === "Click" && prop === "TODO:",
      });
      expect(r.omitted).toBe(true);
      expect(r.diagnostic?.requiredFieldOmitted).toBe(true);
      expect(r.diagnostic?.replacementPath).toBe("activity-handoff");
      expect(r.diagnostic?.reason).toMatch(/REQUIRED/);
    });
    it("plain attribute-omission for non-TODO invalid names when contract says optional or unknown", () => {
      const r = sanitizeAttributeNameKey("has space", {
        file: "Wf.xaml",
        emitter: "wta:Click",
        rawValue: "x",
        activity: "Click",
        isRequiredProperty: () => false,
      });
      expect(r.diagnostic?.requiredFieldOmitted).toBeFalsy();
      expect(r.diagnostic?.replacementPath).toBe("attribute-omission");
    });
  });

  describe("Dual-sink wiring: guard ledger -> DHG quality issues", () => {
    it("converts each diagnostic to a DhgQualityIssue with stubCause tag", () => {
      const xml = `<ui:Click DisplayName="X" TODO:="y" />`;
      const { repairs } = repairTodoAttributeNamesInXaml(xml, { file: "Wf.xaml", workflow: "Wf" });
      const dhgIssues = toDhgIssuesFromGuardDiagnostics(repairs);
      expect(dhgIssues.length).toBe(repairs.length);
      for (const issue of dhgIssues) {
        expect(issue.check).toBe("todo-attribute-guard");
        expect(issue.stubCause).toBe("todo-attribute");
        expect(issue.file).toBe("Wf.xaml");
        expect(issue.detail).toContain("TODO:");
      }
    });
    it("escalates severity to blocking when requiredFieldOmitted is true", () => {
      sanitizeAttributeNameKey("TODO:", {
        file: "Wf.xaml",
        emitter: "wta:Click",
        rawValue: "x",
        activity: "Click",
        isRequiredProperty: () => true,
      });
      const drained = drainTodoAttributeGuardDiagnostics();
      const dhgIssues = toDhgIssuesFromGuardDiagnostics(drained);
      expect(dhgIssues[0].severity).toBe("blocking");
      expect(dhgIssues[0].detail).toContain("REQUIRED");
    });
  });

  describe("Fixture regression — 53b42526 defect class (whole-workflow stubbing prevention)", () => {
    /**
     * Synthesizes the canonical malformed-XAML pattern that broke run
     * 53b42526: a `TODO:` token in attribute-name position inside a
     * <ui:Click> activity inside an otherwise valid Sequence. Asserts that
     * the guard repair leaves the surrounding workflow XAML well-formed and
     * Studio-openable, with NO whole-workflow stub needed.
     */
    it("repaired XAML for a 53b42526-shaped workflow is XML-parseable end-to-end", async () => {
      const xaml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:Click DisplayName="Click Submit" TODO:="bind to user_intent_capture" Selector="&lt;wnd/&gt;" />
    <ui:TypeInto DisplayName="Type" Text="x" TODO_bind="email_field" />
    <ui:Click DisplayName="Click OK" Selector="ok" />
  </Sequence>
</Activity>`;
      const r = repairTodoAttributeNamesInXaml(xaml, { file: "Main.xaml", workflow: "Main" });
      const { XMLValidator } = await import("fast-xml-parser");
      const validation = XMLValidator.validate(r.content, { allowBooleanAttributes: false });
      expect(validation).toBe(true);
      // All three activities preserved (smallest-scope local degradation).
      expect(r.content).toContain('DisplayName="Click Submit"');
      expect(r.content).toContain('DisplayName="Type"');
      expect(r.content).toContain('DisplayName="Click OK"');
      // Strip XML comments AND injected LogMessage handoff activities and
      // verify no TODO survives in any other active open tag.
      const stripped = r.content
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<ui:LogMessage[^>]*\/>/g, "");
      expect(stripped).not.toMatch(/\bTODO:\s*=/);
      expect(stripped).not.toContain("TODO_bind");
      // Comment+LogMessage handoff present (contract-safe degradation).
      const logMsgMatches = r.content.match(/<ui:LogMessage[^>]*TODO-ATTR-GUARD[^>]*\/>/g) || [];
      expect(logMsgMatches.length).toBe(2);
      // Repairs were recorded with proper origin tags.
      expect(r.repairs.length).toBe(2);
      for (const d of r.repairs) {
        expect(d.source).toBe("todo-attribute-guard");
        expect(d.workflow).toBe("Main");
      }
    });

    it("0a2318f3-shaped pattern: TODO marker as namespace-prefix is repaired", async () => {
      const xaml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Sequence>
    <Assign DisplayName="Set value" TODO:foo="bar" />
  </Sequence>
</Activity>`;
      const r = repairTodoAttributeNamesInXaml(xaml, { file: "Wf.xaml", workflow: "Wf" });
      const { XMLValidator } = await import("fast-xml-parser");
      expect(XMLValidator.validate(r.content, { allowBooleanAttributes: false })).toBe(true);
      expect(r.content).toContain('DisplayName="Set value"');
      expect(r.repairs.length).toBeGreaterThanOrEqual(1);
      expect(r.repairs[0].source).toBe("todo-attribute-guard");
    });

    it("cohort-style stress: multiple sibling activities, mixed TODO patterns, all preserved except offending attrs", async () => {
      const xaml = `<Activity><Sequence>
  <ui:Click TODO:="a" DisplayName="A" />
  <ui:Click DisplayName="B" />
  <ui:Click TODO_x="c" DisplayName="C" />
  <ui:Click DisplayName="D" Selector="ok" />
</Sequence></Activity>`;
      const r = repairTodoAttributeNamesInXaml(xaml, { file: "Wf.xaml", workflow: "Wf" });
      const { XMLValidator } = await import("fast-xml-parser");
      expect(XMLValidator.validate(r.content, { allowBooleanAttributes: false })).toBe(true);
      for (const dn of ["A", "B", "C", "D"]) {
        expect(r.content).toContain(`DisplayName="${dn}"`);
      }
      // Strip XML comments and re-check: no TODO-marker survives in
      // attribute-name position on any active activity tag.
      const stripped = r.content.replace(/<!--[\s\S]*?-->/g, "");
      const openTags = stripped.match(/<ui:Click[^>]*>/g) || [];
      expect(openTags.length).toBe(4);
      for (const tag of openTags) {
        expect(tag).not.toMatch(/\bTODO/);
      }
    });
  });

  describe("Hard-fail enforcement: element-name TODO violations throw", () => {
    it("throws TodoAttributeGuardHardFailError on a TODO-prefixed element name", async () => {
      const { TodoAttributeGuardHardFailError } = await import("../lib/todo-attribute-guard");
      const xaml = `<TODO:Activity DisplayName="bad" />`;
      expect(() => repairTodoAttributeNamesInXaml(xaml, { file: "Wf.xaml", workflow: "Wf" }))
        .toThrow(TodoAttributeGuardHardFailError);
      // The diagnostic was still recorded for DHG visibility.
      const drained = drainTodoAttributeGuardDiagnostics();
      expect(drained.length).toBe(1);
      expect(drained[0].contextType).toBe("element-name");
      expect(drained[0].replacementPath).toBe("hard-fail");
    });
  });

  describe("Comment+LogMessage activity handoff (contract-safe degradation)", () => {
    it("required-field omission injects BOTH a Comment and a real LogMessage activity in the buffer", () => {
      const xaml = `<Activity xmlns:ui="x"><Sequence><ui:Click DisplayName="Submit" TODO:bind="x" /></Sequence></Activity>`;
      const r = repairTodoAttributeNamesInXaml(xaml, { file: "Wf.xaml", workflow: "Wf" });
      // (1) Sibling XML comment carries the diagnostic.
      expect(r.content).toMatch(/<!--\s*TODO-attribute-guard:.*?required-field omission/s);
      expect(r.content).toMatch(/<!--[^]*ui:Click[^]*required-field omission/);
      // (2) Real `<ui:LogMessage>` activity is present immediately before
      //     the sanitized activity (operator-visible runtime handoff).
      expect(r.content).toMatch(/<ui:LogMessage[^>]*Level="Warn"[^>]*\[TODO-ATTR-GUARD\][^>]*\/>\s*<ui:Click/);
      // (3) Diagnostic carries the contract-safe routing path.
      expect(r.repairs[0].replacementPath).toBe("activity-handoff");
      expect(r.repairs[0].requiredFieldOmitted).toBe(true);
    });
  });

  describe("Canonical placeholder constructor routing (spy regression)", () => {
    it("repair path routes through the canonical placeholder-sanitizer constructor", async () => {
      // Spy on `makeTodoTextPlaceholder` to prove the offending repair
      // routes through the canonical constructor (no ad-hoc string
      // formatting). This is the v3 review's call-site spying requirement.
      const placeholderMod = await import("../lib/placeholder-sanitizer");
      const { vi } = await import("vitest");
      const spy = vi.spyOn(placeholderMod, "makeTodoTextPlaceholder");
      try {
        const xaml = `<ui:Click DisplayName="X" TODO_bind="payload value" />`;
        repairTodoAttributeNamesInXaml(xaml, { file: "Wf.xaml", workflow: "Wf" });
        expect(spy).toHaveBeenCalled();
        const callArgs = spy.mock.calls[0];
        // Constructor receives the original value text, a tagged origin,
        // and a human-readable reason (canonical 3-arg form).
        expect(callArgs[0]).toBe("payload value");
        expect(String(callArgs[1])).toContain("todo-attribute-guard");
        expect(String(callArgs[2])).toMatch(/TODO marker|DHG/);
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("StubCause taxonomy is shared (no redeclaration in #529)", () => {
    it("'todo-attribute' is a valid StubCause literal", () => {
      const cause: StubCause = "todo-attribute";
      expect(cause).toBe("todo-attribute");
    });
  });

  describe("end-to-end compliancePass-style replay: emitter-time + buffer dual-sink + DHG parity", () => {
    // Mirrors the precise wiring inside `package-assembler.ts:compliancePass`.
    // This is the integration regression demanded by the v2 review: the test
    // exercises the full emitter-time + pre-compliance buffer scan + DHG
    // dual-sink pipeline against a fixture-shaped XAML payload, then
    // mechanically asserts the three required invariants:
    //   (1) the resulting buffer is XML-parseable end-to-end,
    //   (2) localized degradation evidence (handoff comments) is present
    //       in the buffer for both emitter-time AND buffer-scan events,
    //   (3) DHG quality_issues mirror `final_quality_report.diagnostics`
    //       with parity (one DHG entry per ledger entry, both streams).
    function compliancePassReplay(rawXaml: string, fileName: string) {
      const wf = (fileName.split("/").pop() || fileName).replace(/\.xaml$/i, "");
      const dhgIssuesOut: any[] = [];
      const emitterTimeDiagnostics = drainTodoAttributeGuardDiagnosticsForFile(fileName);
      if (emitterTimeDiagnostics.length > 0) {
        const block = buildEmitterTimeHandoffCommentBlock(emitterTimeDiagnostics);
        if (block) {
          const decl = rawXaml.match(/^<\?xml[^?]*\?>\s*/);
          rawXaml = decl ? decl[0] + block + rawXaml.slice(decl[0].length) : block + rawXaml;
        }
      }
      const scan = repairTodoAttributeNamesInXaml(rawXaml, {
        file: fileName, emitter: "compliancePass:pre-scan", workflow: wf,
      });
      if (scan.repairs.length > 0) rawXaml = scan.content;
      const all = [...emitterTimeDiagnostics, ...scan.repairs];
      if (all.length > 0) {
        const dhg = toDhgIssuesFromGuardDiagnostics(all);
        for (const i of dhg) dhgIssuesOut.push({ ...i, stubCause: "todo-attribute" });
      }
      return { content: rawXaml, dhgIssues: dhgIssuesOut, allDiagnostics: all };
    }

    it("53b42526-shaped fixture: emitter-time + buffer events both surface in buffer & DHG", async () => {
      // Simulate emitter-time guard event from typed assembler (drops a
      // required attribute before any XAML existed).
      sanitizeAttributeNameKey("TODO:bind", {
        file: "Wf53b42526.xaml",
        workflow: "Wf53b42526",
        emitter: "workflow-tree-assembler:dynamic-property",
        activity: "Click Submit",
        isRequiredProperty: () => true,
      });
      // Buffer also carries an additional bypass-path TODO attribute.
      const xaml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:Click DisplayName="Click Submit" Selector="&lt;wnd/&gt;" />
    <ui:TypeInto DisplayName="Type" TODO_bind="email_field" Text="x" />
  </Sequence>
</Activity>`;
      const r = compliancePassReplay(xaml, "Wf53b42526.xaml");
      const { XMLValidator } = await import("fast-xml-parser");
      // (1) Buffer is XML-parseable end-to-end.
      expect(XMLValidator.validate(r.content, { allowBooleanAttributes: false })).toBe(true);
      // (2) Both events left visible localized degradation in buffer.
      expect(r.content).toContain("TODO-attribute-guard (emitter-time)");
      expect(r.content).toContain("TODO-attribute-guard:");
      expect(r.content).toContain('Click Submit"');
      // No TODO survives in any active open tag (strip comments AND the
      // injected LogMessage handoff activities first — those legitimately
      // reference the TODO token in the Message *value*).
      const stripped = r.content
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<ui:LogMessage[^>]*\/>/g, "");
      expect(stripped).not.toMatch(/<[^!?>][^>]*\bTODO[^>]*>/);
      // Comment+LogMessage handoff present in buffer.
      expect(r.content).toMatch(/<ui:LogMessage[^>]*Level="Warn"[^>]*TODO-ATTR-GUARD/);
      // (3) DHG mirrors diagnostics exactly: one DHG entry per diag.
      expect(r.dhgIssues.length).toBe(r.allDiagnostics.length);
      expect(r.dhgIssues.length).toBe(2);
      for (const issue of r.dhgIssues) {
        expect(issue.stubCause).toBe("todo-attribute");
        expect(issue.check).toBe("todo-attribute-guard");
      }
    });

    it("0a2318f3-shaped fixture: zero whole-workflow stubs; activity count preserved", async () => {
      const xaml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:Click DisplayName="A" TODO:bind="x" />
    <ui:Click DisplayName="B" TODO_bind="y" />
    <ui:Click DisplayName="C" Selector="ok" />
  </Sequence>
</Activity>`;
      const r = compliancePassReplay(xaml, "Wf0a2318f3.xaml");
      const { XMLValidator } = await import("fast-xml-parser");
      expect(XMLValidator.validate(r.content, { allowBooleanAttributes: false })).toBe(true);
      // All three activities preserved (no whole-workflow stubbing).
      const stripped = r.content.replace(/<!--[\s\S]*?-->/g, "");
      const clicks = stripped.match(/<ui:Click[^>]*>/g) || [];
      expect(clicks.length).toBe(3);
      // Per-activity DisplayName preserved.
      expect(stripped).toContain('DisplayName="A"');
      expect(stripped).toContain('DisplayName="B"');
      expect(stripped).toContain('DisplayName="C"');
      // DHG and ledger parity.
      expect(r.dhgIssues.length).toBe(r.allDiagnostics.length);
      expect(r.dhgIssues.length).toBe(2);
    });

    it("emitter-time entries consumed by compliancePass remain visible to FinalQualityReport.diagnostics drain (DHG ↔ diagnostics 1:1 parity)", () => {
      // This is the regression for the v3 review finding: per-file drain
      // must NOT make emitter-time entries invisible to the eventual
      // full-ledger drain that populates `final_quality_report.diagnostics`.
      sanitizeAttributeNameKey("TODO:bind", {
        file: "WfA.xaml", workflow: "WfA", emitter: "typed-assembler",
        activity: "Op1", isRequiredProperty: () => true,
      });
      sanitizeAttributeNameKey("TODO:input", {
        file: "WfB.xaml", workflow: "WfB", emitter: "typed-assembler",
        activity: "Op2", isRequiredProperty: () => true,
      });
      // compliancePass-style consumption for both files.
      const consumedA = drainTodoAttributeGuardDiagnosticsForFile("WfA.xaml");
      const consumedB = drainTodoAttributeGuardDiagnosticsForFile("WfB.xaml");
      expect(consumedA.length).toBe(1);
      expect(consumedB.length).toBe(1);
      // Now FinalQualityReport drains the full ledger — must see BOTH
      // emitter-time entries even though they were already consumed for
      // DHG/buffer evidence in compliancePass.
      const finalDrain = drainTodoAttributeGuardDiagnostics();
      expect(finalDrain.length).toBe(2);
      const files = finalDrain.map(d => d.file).sort();
      expect(files).toEqual(["WfA.xaml", "WfB.xaml"]);
      // Tuple invariants required by review: (source, contextType,
      // replacementPath) shape preserved.
      for (const d of finalDrain) {
        expect(d.source).toBe("todo-attribute-guard");
        expect(d.contextType).toBe("attribute-name");
        expect(d.replacementPath).toBe("activity-handoff");
        expect(d.requiredFieldOmitted).toBe(true);
      }
      // Ledger now fully empty (no double-counting on next run).
      expect(drainTodoAttributeGuardDiagnostics().length).toBe(0);
    });

    it("cohort replay (4 workflows): each workflow scoped to its own diagnostics", async () => {
      const cohort = ["WfA", "WfB", "WfC", "WfD"];
      const results = [];
      for (const wf of cohort) {
        // One emitter-time required-field omission per workflow.
        sanitizeAttributeNameKey("TODO:input", {
          file: `${wf}.xaml`, workflow: wf, emitter: "typed-assembler",
          activity: "Process", isRequiredProperty: () => true,
        });
        const xaml = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Sequence DisplayName="${wf}-Main"><ui:Activity DisplayName="Process" /></Sequence>
</Activity>`;
        results.push(compliancePassReplay(xaml, `${wf}.xaml`));
      }
      const { XMLValidator } = await import("fast-xml-parser");
      for (let i = 0; i < cohort.length; i++) {
        const r = results[i];
        // Each workflow saw exactly its own diagnostic — no cross-talk.
        expect(r.allDiagnostics.length).toBe(1);
        expect(r.allDiagnostics[0].workflow).toBe(cohort[i]);
        expect(r.dhgIssues.length).toBe(1);
        expect(XMLValidator.validate(r.content, { allowBooleanAttributes: false })).toBe(true);
        expect(r.content).toContain("TODO-attribute-guard (emitter-time)");
      }
    });
  });
});
