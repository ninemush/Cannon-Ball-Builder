import { describe, it, expect, vi, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import { calculateConfidenceScore, AUTO_ENGAGE_THRESHOLD, type ConfidenceScorerInput } from "../meta-validation/confidence-scorer";
import { parseCorrectionResponse } from "../meta-validation/meta-validator";
import { applyCorrections } from "../meta-validation/correction-applier";
import type { CorrectionSet, Correction } from "../meta-validation/meta-validator";

vi.mock("../storage", () => {
  const settingsStore = new Map<string, string>();
  return {
    storage: {
      getAppSetting: vi.fn(async (key: string) => settingsStore.get(key)),
      setAppSetting: vi.fn(async (key: string, value: string) => { settingsStore.set(key, value); }),
    },
  };
});

import { calculateEstimatedCost, recordGenerationMetrics, getMetricsSummary, LLM_PRICING, type GenerationMetrics } from "../meta-validation/cost-tracker";

describe("Confidence Scorer", () => {
  it("returns low score for simple processes", () => {
    const input: ConfidenceScorerInput = {
      workflowCount: 2,
      activityCount: 8,
    };
    const result = calculateConfidenceScore(input);
    expect(result.score).toBeLessThan(AUTO_ENGAGE_THRESHOLD);
    expect(result.shouldEngage).toBe(false);
    expect(result.triggeredCategories).toContain("LITERAL_EXPRESSIONS");
  });

  it("returns high score for complex processes with violations", () => {
    const input: ConfidenceScorerInput = {
      workflowCount: 6,
      activityCount: 60,
      templateComplianceScore: 0.7,
      catalogViolationCount: 5,
      uncataloguedActivityCount: 3,
      hasReFramework: true,
      priorGenerationHadStubs: true,
      qualityGateWarningCount: 4,
    };
    const result = calculateConfidenceScore(input);
    expect(result.score).toBeGreaterThanOrEqual(AUTO_ENGAGE_THRESHOLD);
    expect(result.shouldEngage).toBe(true);
    expect(result.triggeredCategories.length).toBeGreaterThan(3);
  });

  it("always includes LITERAL_EXPRESSIONS in triggered categories", () => {
    const input: ConfidenceScorerInput = {
      workflowCount: 1,
      activityCount: 3,
    };
    const result = calculateConfidenceScore(input);
    expect(result.triggeredCategories).toContain("LITERAL_EXPRESSIONS");
  });

  it("identifies high complexity signal correctly", () => {
    const input: ConfidenceScorerInput = {
      workflowCount: 5,
      activityCount: 10,
    };
    const result = calculateConfidenceScore(input);
    const complexitySignal = result.signals.find(s => s.name === "high_complexity");
    expect(complexitySignal?.triggered).toBe(true);
  });

  it("detects ReFramework signal", () => {
    const input: ConfidenceScorerInput = {
      workflowCount: 2,
      activityCount: 10,
      hasReFramework: true,
    };
    const result = calculateConfidenceScore(input);
    const reframeworkSignal = result.signals.find(s => s.name === "reframework");
    expect(reframeworkSignal?.triggered).toBe(true);
    expect(result.triggeredCategories).toContain("UNDECLARED_VARIABLES");
  });

  it("generates reason string with triggered signal names", () => {
    const input: ConfidenceScorerInput = {
      workflowCount: 6,
      activityCount: 60,
      templateComplianceScore: 0.5,
      catalogViolationCount: 3,
      priorGenerationHadStubs: true,
      hasReFramework: true,
      qualityGateWarningCount: 5,
    };
    const result = calculateConfidenceScore(input);
    expect(result.shouldEngage).toBe(true);
    expect(result.reason).toContain("low_template_compliance");
    expect(result.reason).toContain("catalog_violations");
  });
});

describe("Correction Response Parser", () => {
  it("parses valid JSON array", () => {
    const raw = JSON.stringify([
      {
        workflowName: "Main",
        activityDisplayName: "Log Message",
        category: "ENUM_VIOLATIONS",
        confidence: "high",
        description: "Invalid log level",
        original: 'Level="Debug"',
        corrected: 'Level="Info"',
      },
    ]);
    const result = parseCorrectionResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("ENUM_VIOLATIONS");
    expect(result[0].confidence).toBe("high");
  });

  it("handles markdown-fenced JSON", () => {
    const raw = '```json\n[{"workflowName":"Main","activityDisplayName":"Test","category":"LITERAL_EXPRESSIONS","confidence":"medium","description":"bare var","original":"str_Var","corrected":"[str_Var]"}]\n```';
    const result = parseCorrectionResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("LITERAL_EXPRESSIONS");
  });

  it("returns empty array for invalid JSON", () => {
    const result = parseCorrectionResponse("This is not JSON at all");
    expect(result).toEqual([]);
  });

  it("returns empty array for non-array JSON", () => {
    const result = parseCorrectionResponse('{"notAnArray": true}');
    expect(result).toEqual([]);
  });

  it("filters out entries without category", () => {
    const raw = JSON.stringify([
      { description: "missing category" },
      { category: "ENUM_VIOLATIONS", description: "has category" },
    ]);
    const result = parseCorrectionResponse(raw);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("ENUM_VIOLATIONS");
  });

  it("defaults unknown confidence to low", () => {
    const raw = JSON.stringify([
      { category: "ENUM_VIOLATIONS", confidence: "super-high", description: "test" },
    ]);
    const result = parseCorrectionResponse(raw);
    expect(result[0].confidence).toBe("low");
  });

  it("extracts JSON array from surrounding text", () => {
    const raw = 'Here are the corrections:\n[{"category":"ENUM_VIOLATIONS","description":"test","workflowName":"Main","activityDisplayName":"Log","original":"x","corrected":"y","confidence":"high"}]\nDone!';
    const result = parseCorrectionResponse(raw);
    expect(result).toHaveLength(1);
  });
});

describe("Correction Applier", () => {
  const makeXaml = (body: string) => `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <Sequence.Variables />
    ${body}
  </Sequence>
</Activity>`;

  it("applies ENUM_VIOLATIONS correction", () => {
    const xaml = makeXaml('<ui:LogMessage Level="Debug" Message="[&quot;test&quot;]" DisplayName="Log Test" />');
    const entries = [{ name: "Main.xaml", content: xaml }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Log Test",
          category: "ENUM_VIOLATIONS",
          confidence: "high",
          description: 'Invalid log level Debug',
          original: 'Level="Debug"',
          corrected: 'Level="Info"',
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.updatedXamlEntries[0].content).toContain('Level="Info"');
    expect(result.updatedXamlEntries[0].content).not.toContain('Level="Debug"');
  });

  it("skips FLAT_STRUCTURE corrections", () => {
    const entries = [{ name: "Main.xaml", content: makeXaml("") }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Some Activity",
          category: "FLAT_STRUCTURE",
          confidence: "high",
          description: "Should be nested in TryCatch",
          original: "",
          corrected: "",
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.flatStructureWarnings).toBe(1);
    expect(result.details[0].status).toBe("skipped");
    expect(result.details[0].reason).toContain("FLAT_STRUCTURE");
  });

  it("skips low-confidence corrections", () => {
    const entries = [{ name: "Main.xaml", content: makeXaml("") }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Test",
          category: "ENUM_VIOLATIONS",
          confidence: "low",
          description: "Uncertain fix",
          original: "",
          corrected: "",
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.lowConfidenceSkipped).toBe(1);
  });

  it("applies NESTED_ARGUMENTS correction", () => {
    const xaml = makeXaml('<InArgument x:TypeArguments="x:String"><InArgument x:TypeArguments="x:String">someValue</InArgument></InArgument>');
    const entries = [{ name: "Main.xaml", content: xaml }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Test",
          category: "NESTED_ARGUMENTS",
          confidence: "high",
          description: "Doubled InArgument",
          original: "",
          corrected: "",
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(1);
    const content = result.updatedXamlEntries[0].content;
    expect(content).not.toMatch(/<InArgument[^>]*>\s*<InArgument/);
  });

  it("applies UNDECLARED_VARIABLES correction by inserting variable declaration", () => {
    const xaml = makeXaml('<ui:LogMessage Level="Info" Message="[str_Result]" DisplayName="Log Result" />');
    const entries = [{ name: "Main.xaml", content: xaml }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Log Result",
          category: "UNDECLARED_VARIABLES",
          confidence: "high",
          description: "str_Result is used but not declared",
          original: "",
          corrected: '<Variable x:TypeArguments="x:String" Name="str_Result" />',
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(1);
    expect(result.updatedXamlEntries[0].content).toContain('Name="str_Result"');
  });

  it("handles self-closing Sequence.Variables when inserting variable declaration", () => {
    const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <Sequence.Variables />
    <ui:LogMessage Level="Info" Message="[str_Test]" DisplayName="Log Test" />
  </Sequence>
</Activity>`;
    const entries = [{ name: "Main.xaml", content: xaml }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Log Test",
          category: "UNDECLARED_VARIABLES",
          confidence: "high",
          description: "str_Test is used but not declared",
          original: "",
          corrected: '<Variable x:TypeArguments="x:String" Name="str_Test" />',
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(1);
    const content = result.updatedXamlEntries[0].content;
    expect(content).toContain('Name="str_Test"');
    expect(content).not.toContain("<Sequence.Variables />");
    expect(content).toContain("<Sequence.Variables>");
    expect(content).toContain("</Sequence.Variables>");
  });

  it("corrected Main.xaml bytes are present in rebuilt nupkg archive", () => {
    const originalXaml = makeXaml(
      '<ui:LogMessage Level="Invalid" Message="test" DisplayName="Log Test" />',
    );

    const zip = new AdmZip();
    zip.addFile("Main.xaml", Buffer.from(originalXaml, "utf-8"));
    zip.addFile("project.json", Buffer.from("{}", "utf-8"));
    const originalBuffer = zip.toBuffer();

    const entries = [{ name: "Main.xaml", content: originalXaml }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Log Test",
          category: "ENUM_VIOLATIONS",
          confidence: "high",
          description: 'LogMessage Level should be "Info" not "Invalid"',
          original: 'Level="Invalid"',
          corrected: 'Level="Info"',
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 50,
      inputTokens: 300,
      outputTokens: 100,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(1);

    const archiveManifest = ["Main.xaml", "project.json"];
    const rebuildZip = new AdmZip(originalBuffer);
    for (const entry of result.updatedXamlEntries) {
      const archivePaths = archiveManifest.filter(
        (p) => p === entry.name || p.endsWith(`/${entry.name}`) || p.endsWith(`\\${entry.name}`),
      );
      for (const archivePath of archivePaths) {
        rebuildZip.updateFile(archivePath, Buffer.from(entry.content, "utf-8"));
      }
    }
    const rebuiltBuffer = rebuildZip.toBuffer();

    const verifyZip = new AdmZip(rebuiltBuffer);
    const mainEntry = verifyZip.getEntry("Main.xaml");
    expect(mainEntry).not.toBeNull();
    const rebuiltContent = mainEntry!.getData().toString("utf-8");
    expect(rebuiltContent).toContain('Level="Info"');
    expect(rebuiltContent).not.toContain('Level="Invalid"');
  });

  it("handles correction for non-existent workflow gracefully", () => {
    const entries = [{ name: "Main.xaml", content: makeXaml("") }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "NonExistent",
          activityDisplayName: "Test",
          category: "ENUM_VIOLATIONS",
          confidence: "high",
          description: "test",
          original: "x",
          corrected: "y",
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.failed).toBe(1);
    expect(result.details[0].status).toBe("failed");
  });

  it("applies correction scoped by DisplayName when multiple activities have same attribute", () => {
    const xaml = makeXaml(`
    <ui:LogMessage Level="Debug" Message="[&quot;first&quot;]" DisplayName="Log First" />
    <ui:LogMessage Level="Debug" Message="[&quot;second&quot;]" DisplayName="Log Second" />
    `);
    const entries = [{ name: "Main.xaml", content: xaml }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Log Second",
          category: "ENUM_VIOLATIONS",
          confidence: "high",
          description: "Invalid log level",
          original: 'Level="Debug"',
          corrected: 'Level="Warn"',
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(1);
    const content = result.updatedXamlEntries[0].content;
    expect(content).toMatch(/Level="Debug".*DisplayName="Log First"/s);
    expect(content).toMatch(/Level="Warn".*DisplayName="Log Second"/s);
  });

  it("handles multiple corrections across different categories", () => {
    const xaml = makeXaml('<ui:LogMessage Level="Debug" Message="str_Var" DisplayName="Log Test" />');
    const entries = [{ name: "Main.xaml", content: xaml }];
    const correctionSet: CorrectionSet = {
      corrections: [
        {
          workflowName: "Main",
          activityDisplayName: "Log Test",
          category: "ENUM_VIOLATIONS",
          confidence: "high",
          description: "Invalid log level",
          original: 'Level="Debug"',
          corrected: 'Level="Info"',
        },
        {
          workflowName: "Main",
          activityDisplayName: "Log Test",
          category: "LITERAL_EXPRESSIONS",
          confidence: "medium",
          description: "Bare variable reference",
          original: 'Message="str_Var"',
          corrected: 'Message="[str_Var]"',
        },
      ],
      totalReviewed: 1,
      reviewDurationMs: 100,
      inputTokens: 500,
      outputTokens: 200,
    };
    const result = applyCorrections(entries, correctionSet);
    expect(result.applied).toBe(2);
    expect(result.updatedXamlEntries[0].content).toContain('Level="Info"');
    expect(result.updatedXamlEntries[0].content).toContain('Message="[str_Var]"');
  });
});

describe("Cost Tracker", () => {
  it("calculates estimated cost for haiku model", () => {
    const cost = calculateEstimatedCost(6000, 2000, "haiku");
    const expected = (6000 / 1000) * LLM_PRICING.haiku.inputPer1KTokens + (2000 / 1000) * LLM_PRICING.haiku.outputPer1KTokens;
    expect(cost).toBeCloseTo(expected);
  });

  it("calculates estimated cost for unknown model using default pricing", () => {
    const cost = calculateEstimatedCost(1000, 500, "gpt-99");
    const expected = (1000 / 1000) * LLM_PRICING.default.inputPer1KTokens + (500 / 1000) * LLM_PRICING.default.outputPer1KTokens;
    expect(cost).toBeCloseTo(expected);
  });

  it("records and summarizes metrics", async () => {
    const metrics: GenerationMetrics = {
      id: "test-1",
      timestamp: new Date(),
      ideaId: "idea-1",
      decompositionTokens: { input: 1000, output: 500 },
      assemblyTokens: { input: 2000, output: 1000 },
      metaValidationTokens: { input: 6000, output: 2000 },
      totalTokens: { input: 9000, output: 3500 },
      estimatedCostUsd: 0.05,
      templateComplianceScore: 0.95,
      confidenceScore: 0.72,
      metaValidationEngaged: true,
      metaValidationMode: "Auto",
      correctionsApplied: 3,
      finalStatus: "READY",
    };
    await recordGenerationMetrics(metrics);

    const summary = await getMetricsSummary(30);
    expect(summary.totalGenerations).toBeGreaterThanOrEqual(1);
  });

  it("returns zeroed summary when no metrics exist for period", async () => {
    const summary = await getMetricsSummary(0);
    expect(summary.totalGenerations).toBe(0);
    expect(summary.averageCostUsd).toBe(0);
    expect(summary.metaValidationEngagementRate).toBe(0);
  });
});

describe("Bare < sanitizer in argument content", () => {
  const bareLtRegex = /(<(?:In|Out)Argument[^>]*>)([\s\S]*?)(<\/(?:In|Out)Argument>)/g;
  function sanitizeBareAngleBrackets(content: string): string {
    return content.replace(bareLtRegex, (_match: string, open: string, inner: string, close: string) => {
      const escapedInner = inner.replace(/<(?![\/a-zA-Z!?])/g, "&lt;").replace(/&lt;>/g, "&lt;&gt;");
      return open + escapedInner + close;
    });
  }

  it("escapes <> operator inside InArgument to &lt;&gt;", () => {
    const input = '<InArgument x:TypeArguments="x:Boolean">[int_Status <> 200]</InArgument>';
    const result = sanitizeBareAngleBrackets(input);
    expect(result).toContain("&lt;&gt;");
    expect(result).not.toContain("<>");
  });

  it("escapes & inside InArgument to &amp; (via ampersand sanitizer)", () => {
    const input = '<InArgument x:TypeArguments="x:String">[str_A & str_B]</InArgument>';
    const ampSanitized = input.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;");
    expect(ampSanitized).toContain("&amp;");
    expect(ampSanitized).toContain("[str_A &amp; str_B]");
  });

  it("does NOT escape < that starts a valid XML tag inside InArgument", () => {
    const input = '<InArgument x:TypeArguments="x:String"><SomeTag>value</SomeTag></InArgument>';
    const result = sanitizeBareAngleBrackets(input);
    expect(result).toContain("<SomeTag>");
    expect(result).toContain("</SomeTag>");
    expect(result).not.toContain("&lt;SomeTag");
  });

  it("escapes bare < inside OutArgument content", () => {
    const input = '<OutArgument x:TypeArguments="x:Int32">[int_Result <> 0]</OutArgument>';
    const result = sanitizeBareAngleBrackets(input);
    expect(result).toContain("&lt;&gt;");
  });

  it("does not modify content outside argument tags", () => {
    const input = '<If Condition="[x <> 0]"><InArgument>safe</InArgument></If>';
    const result = sanitizeBareAngleBrackets(input);
    expect(result).toContain('[x <> 0]');
  });
});
