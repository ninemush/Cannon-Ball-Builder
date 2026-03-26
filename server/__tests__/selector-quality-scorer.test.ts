import { describe, it, expect } from "vitest";
import {
  extractUiContext,
  formatUiContextForPrompt,
  scoreSelector,
  computeTotalScore,
  isPlaceholderSelector,
  scoreSelectorQuality,
  generateSelectorWarnings,
  getResilienceDefaults,
  injectResilienceDefaults,
} from "../xaml/selector-quality-scorer";

describe("extractUiContext", () => {
  it("extracts application names from SDD text", () => {
    const sdd = "The user logs into the SAP ERP system and navigates to the Workday portal application.";
    const ctx = extractUiContext(sdd);
    expect(ctx.applicationNames.length).toBeGreaterThan(0);
  });

  it("extracts field labels from SDD text", () => {
    const sdd = 'The user enters the value into the "Invoice Number" field and fills in the "Amount" textbox.';
    const ctx = extractUiContext(sdd);
    expect(ctx.fieldLabels.length).toBeGreaterThan(0);
  });

  it("extracts button texts from SDD text", () => {
    const sdd = 'The user clicks the "Submit Invoice" button and presses the "Approve" button.';
    const ctx = extractUiContext(sdd);
    expect(ctx.buttonTexts.length).toBeGreaterThan(0);
    expect(ctx.buttonTexts.some(b => b.includes("Submit"))).toBe(true);
  });

  it("extracts URLs from SDD text", () => {
    const sdd = "Navigate to the portal at https://portal.company.com/login and process the data.";
    const ctx = extractUiContext(sdd);
    expect(ctx.urlPatterns.length).toBe(1);
    expect(ctx.urlPatterns[0]).toContain("portal.company.com");
  });

  it("filters out example.com URLs", () => {
    const sdd = "Navigate to https://example.com/test for instructions.";
    const ctx = extractUiContext(sdd);
    expect(ctx.urlPatterns.length).toBe(0);
  });

  it("extracts screen names from SDD text", () => {
    const sdd = "The user navigates to the Invoice Entry screen and opens the Payment Processing page.";
    const ctx = extractUiContext(sdd);
    expect(ctx.screenNames.length).toBeGreaterThan(0);
  });

  it("returns empty context for empty input", () => {
    const ctx = extractUiContext("");
    expect(ctx.applicationNames).toEqual([]);
    expect(ctx.screenNames).toEqual([]);
    expect(ctx.fieldLabels).toEqual([]);
    expect(ctx.buttonTexts).toEqual([]);
    expect(ctx.urlPatterns).toEqual([]);
    expect(ctx.formDescriptions).toEqual([]);
  });

  it("deduplicates extracted items", () => {
    const sdd = 'Click the "Save" button. Then click the "Save" button again.';
    const ctx = extractUiContext(sdd);
    const saveCount = ctx.buttonTexts.filter(b => b === "Save").length;
    expect(saveCount).toBeLessThanOrEqual(1);
  });
});

describe("formatUiContextForPrompt", () => {
  it("returns empty string for empty context", () => {
    const result = formatUiContextForPrompt({
      applicationNames: [],
      screenNames: [],
      fieldLabels: [],
      buttonTexts: [],
      urlPatterns: [],
      formDescriptions: [],
    });
    expect(result).toBe("");
  });

  it("includes section header and selector rules when context exists", () => {
    const result = formatUiContextForPrompt({
      applicationNames: ["SAP ERP"],
      screenNames: [],
      fieldLabels: ["Invoice Number"],
      buttonTexts: ["Submit"],
      urlPatterns: [],
      formDescriptions: [],
    });
    expect(result).toContain("SECTION 6: UI CONTEXT FROM SDD");
    expect(result).toContain("SAP ERP");
    expect(result).toContain("Invoice Number");
    expect(result).toContain("Submit");
    expect(result).toContain("SELECTOR RULES");
    expect(result).toContain("aaname=");
    expect(result).toContain("automationid=");
  });

  it("limits URLs to 5", () => {
    const result = formatUiContextForPrompt({
      applicationNames: [],
      screenNames: [],
      fieldLabels: [],
      buttonTexts: [],
      urlPatterns: Array(10).fill("https://test.com"),
      formDescriptions: [],
    });
    const urlLine = result.split("\n").find(l => l.startsWith("URLs:"));
    expect(urlLine).toBeDefined();
  });
});

describe("scoreSelector", () => {
  it("scores automationid highest", () => {
    const breakdown = scoreSelector("<webctrl automationid='btn_submit' />");
    expect(breakdown.automationId).toBe(5);
  });

  it("scores name attribute", () => {
    const breakdown = scoreSelector("<webctrl name='txtInvoice' />");
    expect(breakdown.name).toBe(4);
  });

  it("scores aaname attribute", () => {
    const breakdown = scoreSelector("<webctrl aaname='Submit Invoice' />");
    expect(breakdown.aaname).toBe(3);
  });

  it("scores tag attribute", () => {
    const breakdown = scoreSelector("<webctrl tag='INPUT' />");
    expect(breakdown.tag).toBe(2);
  });

  it("penalizes idx usage", () => {
    const breakdown = scoreSelector("<webctrl tag='TR' idx='3' />");
    expect(breakdown.idxPenalty).toBe(-2);
  });

  it("gives fallback bonus for multiple attributes", () => {
    const breakdown = scoreSelector("<webctrl tag='INPUT' name='txt' aaname='Amount' />");
    expect(breakdown.fallbackBonus).toBeGreaterThanOrEqual(2);
  });

  it("penalizes wildcard tags", () => {
    const breakdown = scoreSelector("<webctrl tag='*' />");
    expect(breakdown.wildcardPenalty).toBe(-1);
  });

  it("gives 4 points for standalone id attribute via specificityBonus", () => {
    const breakdown = scoreSelector("<webctrl id='main-form' />");
    expect(breakdown.specificityBonus).toBe(4);
  });

  it("gives 3 points for css_selector attribute via specificityBonus", () => {
    const breakdown = scoreSelector("<webctrl css_selector='#main-form' />");
    expect(breakdown.specificityBonus).toBe(3);
  });

  it("does not conflate aaname with name", () => {
    const breakdown = scoreSelector("<webctrl aaname='Submit' />");
    expect(breakdown.name).toBe(0);
    expect(breakdown.aaname).toBe(3);
  });

  it("does not give specificity bonus for automationid (only true id)", () => {
    const breakdown = scoreSelector("<webctrl automationid='btn_submit' />");
    expect(breakdown.automationId).toBe(5);
    expect(breakdown.specificityBonus).toBe(0);
  });

  it("gives 4 points for standalone id attribute", () => {
    const breakdown = scoreSelector("<webctrl id='main-form' />");
    expect(breakdown.specificityBonus).toBe(4);
  });
});

describe("computeTotalScore", () => {
  it("sums all breakdown fields", () => {
    const total = computeTotalScore({
      automationId: 5,
      name: 4,
      aaname: 3,
      tag: 2,
      idxPenalty: -2,
      fallbackBonus: 2,
      wildcardPenalty: -1,
      specificityBonus: 2,
    });
    expect(total).toBe(15);
  });

  it("returns 0 for empty breakdown", () => {
    const total = computeTotalScore({
      automationId: 0,
      name: 0,
      aaname: 0,
      tag: 0,
      idxPenalty: 0,
      fallbackBonus: 0,
      wildcardPenalty: 0,
      specificityBonus: 0,
    });
    expect(total).toBe(0);
  });
});

describe("isPlaceholderSelector", () => {
  it("detects TODO", () => {
    expect(isPlaceholderSelector("<webctrl name='TODO' />")).toBe(true);
  });

  it("detects PLACEHOLDER", () => {
    expect(isPlaceholderSelector("<webctrl name='placeholder_value' />")).toBe(true);
  });

  it("detects CHANGEME", () => {
    expect(isPlaceholderSelector("<webctrl name='CHANGEME' />")).toBe(true);
  });

  it("detects example.com", () => {
    expect(isPlaceholderSelector("<html url='https://example.com' />")).toBe(true);
  });

  it("returns false for real selectors", () => {
    expect(isPlaceholderSelector("<webctrl automationid='btn_submit' tag='BUTTON' />")).toBe(false);
  });
});

describe("scoreSelectorQuality", () => {
  it("scores selectors found in XAML entries", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:Click DisplayName="Click Submit" Selector="&lt;webctrl tag='BUTTON' aaname='Submit' /&gt;" />`,
      },
    ];
    const scores = scoreSelectorQuality(entries);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].activityTag).toContain("Click");
    expect(scores[0].score).toBeGreaterThan(0);
  });

  it("detects placeholder selectors", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:TypeInto DisplayName="Type TODO" Selector="&lt;webctrl name='TODO_field' /&gt;" />`,
      },
    ];
    const scores = scoreSelectorQuality(entries);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].isPlaceholder).toBe(true);
  });

  it("returns empty for XAML without selectors", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<Assign DisplayName="Set Variable" />`,
      },
    ];
    const scores = scoreSelectorQuality(entries);
    expect(scores.length).toBe(0);
  });

  it("handles multiline tags with DisplayName before Selector", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:Click
  DisplayName="Click Submit"
  Selector="&lt;webctrl tag='BUTTON' aaname='Submit' /&gt;">
</ui:Click>`,
      },
    ];
    const scores = scoreSelectorQuality(entries);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].displayName).toBe("Click Submit");
  });

  it("scores modern Target.Selector attributes", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:Click DisplayName="Click Submit" Target.Selector="&lt;webctrl tag='BUTTON' aaname='Submit' /&gt;" />`,
      },
    ];
    const scores = scoreSelectorQuality(entries);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].activityTag).toContain("Click");
    expect(scores[0].score).toBeGreaterThan(0);
    expect(scores[0].displayName).toBe("Click Submit");
  });

  it("detects placeholder in modern Target.Selector", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:TypeInto DisplayName="Type TODO" Target.Selector="&lt;webctrl name='TODO_field' /&gt;" Target.WaitForReady="INTERACTIVE" />`,
      },
    ];
    const scores = scoreSelectorQuality(entries);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].isPlaceholder).toBe(true);
  });

  it("handles multiline tags with Selector before DisplayName", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:TypeInto
  Selector="&lt;webctrl tag='INPUT' name='amount' /&gt;"
  DisplayName="Type Amount">
</ui:TypeInto>`,
      },
    ];
    const scores = scoreSelectorQuality(entries);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0].displayName).toBe("Type Amount");
  });
});

describe("generateSelectorWarnings", () => {
  it("generates placeholder warnings with businessContext", () => {
    const warnings = generateSelectorWarnings([
      {
        file: "Main.xaml",
        line: 10,
        activityTag: "ui:Click",
        displayName: "Click TODO",
        selector: "<webctrl name='TODO' />",
        score: 4,
        maxScore: 20,
        breakdown: { automationId: 0, name: 4, aaname: 0, tag: 0, idxPenalty: 0, fallbackBonus: 0, wildcardPenalty: 0, specificityBonus: 0 },
        isPlaceholder: true,
      },
    ]);
    expect(warnings.length).toBe(1);
    expect(warnings[0].check).toBe("SELECTOR_PLACEHOLDER");
    expect(warnings[0].severity).toBe("warning");
    expect(warnings[0].businessContext).toContain("Click action");
    expect(warnings[0].businessContext).toContain("placeholder");
  });

  it("generates low-quality warnings with businessContext for score <= 3", () => {
    const warnings = generateSelectorWarnings([
      {
        file: "Main.xaml",
        line: 5,
        activityTag: "ui:TypeInto",
        displayName: "Type Into",
        selector: "<webctrl tag='INPUT' />",
        score: 2,
        maxScore: 20,
        breakdown: { automationId: 0, name: 0, aaname: 0, tag: 2, idxPenalty: 0, fallbackBonus: 0, wildcardPenalty: 0, specificityBonus: 0 },
        isPlaceholder: false,
      },
    ]);
    expect(warnings.length).toBe(1);
    expect(warnings[0].check).toBe("SELECTOR_LOW_QUALITY");
    expect(warnings[0].businessContext).toContain("Text input");
    expect(warnings[0].businessContext).toContain("fragile");
  });

  it("does not warn for high-quality selectors", () => {
    const warnings = generateSelectorWarnings([
      {
        file: "Main.xaml",
        line: 5,
        activityTag: "ui:Click",
        displayName: "Click Submit",
        selector: "<webctrl automationid='btn' tag='BUTTON' aaname='Submit' />",
        score: 10,
        maxScore: 20,
        breakdown: { automationId: 5, name: 0, aaname: 3, tag: 2, idxPenalty: 0, fallbackBonus: 2, wildcardPenalty: 0, specificityBonus: 0 },
        isPlaceholder: false,
      },
    ]);
    expect(warnings.length).toBe(0);
  });
});

describe("getResilienceDefaults", () => {
  it("returns correct defaults", () => {
    const defaults = getResilienceDefaults();
    expect(defaults.waitForReady).toBe("INTERACTIVE");
    expect(defaults.timeout).toBe("30000");
  });
});

describe("injectResilienceDefaults", () => {
  it("injects WaitForReady and Timeout into UI activities", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:Click DisplayName="Click Submit" Selector="&lt;webctrl tag='BUTTON' /&gt;" />`,
      },
    ];
    const corrected = injectResilienceDefaults(entries);
    expect(corrected.length).toBe(1);
    expect(corrected[0].content).toContain('Target.WaitForReady="INTERACTIVE"');
    expect(corrected[0].content).toContain('Target.Timeout="30000"');
  });

  it("does not double-inject if already present", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:Click DisplayName="Click" Target.WaitForReady="INTERACTIVE" Target.Timeout="30000" />`,
      },
    ];
    const corrected = injectResilienceDefaults(entries);
    expect(corrected.length).toBe(0);
  });

  it("ignores non-UI activities", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<Assign DisplayName="Set Variable" />`,
      },
    ];
    const corrected = injectResilienceDefaults(entries);
    expect(corrected.length).toBe(0);
  });

  it("handles TypeInto activities", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: `<ui:TypeInto DisplayName="Enter Amount" Text="100" />`,
      },
    ];
    const corrected = injectResilienceDefaults(entries);
    expect(corrected.length).toBe(1);
    expect(corrected[0].content).toContain("Target.WaitForReady");
  });

  it("handles multiple UI activities in one file", () => {
    const entries = [
      {
        name: "Main.xaml",
        content: [
          `<ui:Click DisplayName="Click A" />`,
          `<ui:TypeInto DisplayName="Type B" />`,
          `<Assign DisplayName="Set C" />`,
        ].join("\n"),
      },
    ];
    const corrected = injectResilienceDefaults(entries);
    expect(corrected.length).toBe(1);
    const lines = corrected[0].content.split("\n");
    expect(lines[0]).toContain("Target.WaitForReady");
    expect(lines[1]).toContain("Target.WaitForReady");
    expect(lines[2]).not.toContain("Target.WaitForReady");
  });
});
