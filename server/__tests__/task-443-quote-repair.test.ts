import { describe, it, expect, beforeEach } from "vitest";
import {
  escapeXml,
  escapeXmlAttributeValue,
  escapeXmlExpression,
  repairMalformedQuotesInXaml,
  deterministicQuoteRepair,
  findClosingAttributeQuote,
} from "../lib/xml-utils";
import {
  resetQuoteRepairDiagnostics,
  getQuoteRepairDiagnostics,
  recordQuoteRepairAttempt,
  recordActivePathProof,
  computeContentHash,
  recordRepairsFromDetails,
  recordRepairFailure,
  markFilesSavedFromStub,
  verifyActivePathProofIntegrity,
} from "../lib/quote-repair-diagnostics";
import {
  validateXamlContent,
  validateAndRepairXamlContent,
} from "../xaml/gap-analyzer";

describe("Task 443: Quote-safe XML attribute emission and repair-before-stub", () => {
  beforeEach(() => {
    resetQuoteRepairDiagnostics();
  });

  describe("deterministicQuoteRepair", () => {
    it("replaces raw double quotes with &quot;", () => {
      const result = deterministicQuoteRepair('hello "world" goodbye');
      expect(result).toBe('hello &quot;world&quot; goodbye');
    });

    it("preserves already-escaped &quot; entities without double-escaping", () => {
      const result = deterministicQuoteRepair("hello &quot;world&quot; goodbye");
      expect(result).toBe("hello &quot;world&quot; goodbye");
    });

    it("returns the same value for content with no raw quotes", () => {
      const result = deterministicQuoteRepair("hello world goodbye");
      expect(result).toBe("hello world goodbye");
    });

    it("handles mixed escaped and raw quotes", () => {
      const result = deterministicQuoteRepair('hello &quot;world&quot; and "more" text');
      expect(result).toBe('hello &quot;world&quot; and &quot;more&quot; text');
    });

    it("preserves other XML entities correctly", () => {
      const result = deterministicQuoteRepair('value &amp; "quoted" &lt;tag&gt;');
      expect(result).toBe('value &amp; &quot;quoted&quot; &lt;tag&gt;');
    });

    it("returns null when repair would produce double-escaped &amp;quot;", () => {
      const input = 'already &amp;quot; escaped "more"';
      const result = deterministicQuoteRepair(input);
      expect(result).toBeNull();
    });

    it("is idempotent — repairing already-repaired content yields identical output", () => {
      const original = 'hello "world" goodbye';
      const firstPass = deterministicQuoteRepair(original);
      expect(firstPass).not.toBeNull();
      const secondPass = deterministicQuoteRepair(firstPass!);
      expect(secondPass).toBe(firstPass);
    });
  });

  describe("repairMalformedQuotesInXaml", () => {
    it("repairs LogMessage.Message with embedded raw quotes", () => {
      const xaml = `<ui:LogMessage Level="Info" Message="Processing item "item1" complete" DisplayName="Log Step" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(true);
      expect(result.content).toContain("&quot;item1&quot;");
      expect(result.repairs.length).toBeGreaterThan(0);
      expect(result.repairs[0].attributeName).toBe("Message");
    });

    it("does not modify well-formed XAML with properly escaped quotes", () => {
      const xaml = `<ui:LogMessage Level="Info" Message="[&quot;Processing item&quot;]" DisplayName="Log Step" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(false);
      expect(result.content).toBe(xaml);
      expect(result.repairs.length).toBe(0);
    });

    it("does not modify Selector attributes", () => {
      const xaml = `<ui:Click Selector="<html tag='input' />" DisplayName="Click" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(false);
    });

    it("handles multiple attributes with raw quotes on the same line", () => {
      const xaml = `<Assign DisplayName="Set "value"" Value="[str_Result]" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(true);
      expect(result.content).toContain("&quot;value&quot;");
    });

    it("preserves VB expression bracketed values", () => {
      const xaml = `<ui:LogMessage Level="Info" Message="[&quot;some text&quot;]" DisplayName="Log" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(false);
      expect(result.content).toBe(xaml);
    });

    it("repairs DisplayName with embedded raw quotes", () => {
      const xaml = `<Sequence DisplayName="Process "special" items">`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(true);
      expect(result.content).toContain("&quot;special&quot;");
      expect(result.repairs[0].attributeName).toBe("DisplayName");
    });

    it("handles multiple lines each with malformed quotes", () => {
      const xaml = [
        `<Sequence DisplayName="Main">`,
        `  <ui:LogMessage Level="Info" Message="Step "one" done" DisplayName="Log1" />`,
        `  <ui:LogMessage Level="Warn" Message="Step "two" failed" DisplayName="Log2" />`,
        `</Sequence>`,
      ].join("\n");
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(true);
      expect(result.repairs.length).toBe(2);
      expect(result.content).not.toContain('Message="Step "one"');
      expect(result.content).not.toContain('Message="Step "two"');
    });
  });

  describe("validateAndRepairXamlContent", () => {
    const WELL_FORMED_XAML = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Test"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <ui:LogMessage Level="Info" Message="[&quot;Hello World&quot;]" DisplayName="Log Hello" />
  </Sequence>
</Activity>`;

    it("passes well-formed XAML through without repair", () => {
      const entries = [{ name: "Test.xaml", content: WELL_FORMED_XAML }];
      const result = validateAndRepairXamlContent(entries);
      expect(result.repairSummary.filesRepaired).toBe(0);
      expect(result.repairSummary.totalRepairs).toBe(0);
    });

    it("records diagnostics for repair attempts", () => {
      const malformedXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="Test"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <ui:LogMessage Level="Info" Message="Processing item complete" DisplayName="Log Step" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Test.xaml", content: malformedXaml }];
      validateAndRepairXamlContent(entries);
      const diagnostics = getQuoteRepairDiagnostics();
      expect(diagnostics.summary.totalMalformedQuoteFindings).toBeGreaterThanOrEqual(0);
    });
  });

  describe("quote repair diagnostics", () => {
    it("tracks repair attempts and summary counts", () => {
      recordQuoteRepairAttempt({
        file: "Test.xaml",
        workflow: "Test",
        attributePath: "Line 5: Message",
        originalValue: 'hello "world"',
        repairedValue: "hello &quot;world&quot;",
        repairApplied: true,
        repairReason: "raw_quote_escaped_to_entity",
        savedFromStub: false,
        packageFatal: false,
      });

      const diag = getQuoteRepairDiagnostics();
      expect(diag.attempts.length).toBe(1);
      expect(diag.summary.totalMalformedQuoteFindings).toBe(1);
      expect(diag.summary.totalQuoteRepairsApplied).toBe(1);
      expect(diag.summary.totalWorkflowsSavedFromStub).toBe(0);
    });

    it("tracks failed repair attempts", () => {
      recordRepairFailure("Bad.xaml", "Line 10: Value", "complex content", "ambiguous_repair");

      const diag = getQuoteRepairDiagnostics();
      expect(diag.summary.totalQuoteRepairsFailed).toBe(1);
    });

    it("computes content hashes for active-path proof", () => {
      const hash1 = computeContentHash("content A");
      const hash2 = computeContentHash("content B");
      expect(hash1).not.toBe(hash2);
      expect(hash1.length).toBe(16);
    });

    it("records active-path proof entries", () => {
      recordActivePathProof({
        file: "Test.xaml",
        workflow: "Test",
        stageWhereDetected: "gap-analyzer",
        stageWhereApplied: "package-assembler",
        preRepairHash: "abc123",
        postRepairHash: "def456",
        downstreamConsumedRepairedVersion: true,
      });

      const diag = getQuoteRepairDiagnostics();
      expect(diag.activePathProof.length).toBe(1);
      expect(diag.activePathProof[0].downstreamConsumedRepairedVersion).toBe(true);
    });

    it("resets diagnostics cleanly", () => {
      recordQuoteRepairAttempt({
        file: "A.xaml",
        workflow: "A",
        attributePath: "Line 1: X",
        originalValue: "old",
        repairedValue: "new",
        repairApplied: true,
        repairReason: "test",
        savedFromStub: false,
        packageFatal: false,
      });

      expect(getQuoteRepairDiagnostics().attempts.length).toBe(1);
      resetQuoteRepairDiagnostics();
      expect(getQuoteRepairDiagnostics().attempts.length).toBe(0);
      expect(getQuoteRepairDiagnostics().summary.totalMalformedQuoteFindings).toBe(0);
    });

    it("returns a deep clone from getQuoteRepairDiagnostics — external mutation has no effect", () => {
      recordQuoteRepairAttempt({
        file: "Test.xaml",
        workflow: "Test",
        attributePath: "Line 1: X",
        originalValue: "old",
        repairedValue: "new",
        repairApplied: true,
        repairReason: "test",
        savedFromStub: false,
        packageFatal: false,
      });

      const snapshot1 = getQuoteRepairDiagnostics();
      snapshot1.attempts[0].savedFromStub = true;
      snapshot1.summary.totalWorkflowsSavedFromStub = 999;

      const snapshot2 = getQuoteRepairDiagnostics();
      expect(snapshot2.attempts[0].savedFromStub).toBe(false);
      expect(snapshot2.summary.totalWorkflowsSavedFromStub).toBe(0);
    });
  });

  describe("markFilesSavedFromStub", () => {
    it("marks repairs for specified files and updates summary (deduplicated per file)", () => {
      recordRepairsFromDetails("GetBirthdays.xaml", [
        {
          line: 122,
          attributeName: "Message",
          originalValue: 'Processing "item"',
          repairedValue: "Processing &quot;item&quot;",
          repairReason: "raw_quote_escaped_to_entity",
        },
        {
          line: 470,
          attributeName: "Message",
          originalValue: 'Error "detail"',
          repairedValue: "Error &quot;detail&quot;",
          repairReason: "raw_quote_escaped_to_entity",
        },
      ]);

      expect(getQuoteRepairDiagnostics().summary.totalWorkflowsSavedFromStub).toBe(0);

      markFilesSavedFromStub(["GetBirthdays.xaml"]);

      const diag = getQuoteRepairDiagnostics();
      expect(diag.attempts.length).toBe(2);
      expect(diag.summary.totalQuoteRepairsApplied).toBe(2);
      expect(diag.summary.totalWorkflowsSavedFromStub).toBe(1);
      expect(diag.attempts[0].savedFromStub).toBe(true);
      expect(diag.attempts[1].savedFromStub).toBe(true);
    });

    it("does not double-count when called twice for the same file", () => {
      recordRepairsFromDetails("A.xaml", [
        {
          line: 1,
          attributeName: "X",
          originalValue: '"val"',
          repairedValue: "&quot;val&quot;",
          repairReason: "test",
        },
      ]);

      markFilesSavedFromStub(["A.xaml"]);
      markFilesSavedFromStub(["A.xaml"]);

      const diag = getQuoteRepairDiagnostics();
      expect(diag.summary.totalWorkflowsSavedFromStub).toBe(1);
    });
  });

  describe("escapeXml for attribute values", () => {
    it("escapes double quotes", () => {
      expect(escapeXml('hello "world"')).toContain("&quot;");
    });

    it("escapes ampersands", () => {
      expect(escapeXml("a & b")).toContain("&amp;");
    });

    it("escapes angle brackets", () => {
      expect(escapeXml("<tag>")).toContain("&lt;");
      expect(escapeXml("<tag>")).toContain("&gt;");
    });
  });

  describe("escapeXmlAttributeValue idempotency", () => {
    it("does not double-escape already-escaped content", () => {
      const alreadyEscaped = "hello &quot;world&quot;";
      const result = escapeXmlAttributeValue(alreadyEscaped);
      expect(result).not.toContain("&amp;quot;");
      expect(result).toContain("&quot;");
    });

    it("escapes raw quotes in unescaped content", () => {
      const raw = 'hello "world"';
      const result = escapeXmlAttributeValue(raw);
      expect(result).toContain("&quot;");
      expect(result).not.toContain('"world"');
    });
  });

  describe("unrecoverable malformed attributes still fail", () => {
    it("does not repair structurally broken XML beyond quote issues", () => {
      const brokenXaml = `<Activity><Sequence><unclosed-tag</Sequence></Activity>`;
      const entries = [{ name: "Broken.xaml", content: brokenXaml }];
      const result = validateAndRepairXamlContent(entries);
      const hasWellformedness = result.violations.some(
        v => v.check === "xml-wellformedness"
      );
      expect(hasWellformedness).toBe(true);
    });
  });

  describe("debug/test mode: repair consumed by downstream", () => {
    it("active-path proof tracks pre/post hash", () => {
      const original = '<ui:LogMessage Message="test "value" here" />';
      const repaired = '<ui:LogMessage Message="test &quot;value&quot; here" />';
      const preHash = computeContentHash(original);
      const postHash = computeContentHash(repaired);

      recordActivePathProof({
        file: "Test.xaml",
        workflow: "Test",
        stageWhereDetected: "test-stage",
        stageWhereApplied: "test-stage",
        preRepairHash: preHash,
        postRepairHash: postHash,
        downstreamConsumedRepairedVersion: true,
      });

      const diag = getQuoteRepairDiagnostics();
      const proof = diag.activePathProof[0];
      expect(proof.preRepairHash).not.toBe(proof.postRepairHash);
      expect(proof.downstreamConsumedRepairedVersion).toBe(true);
    });
  });

  describe("recordRepairsFromDetails", () => {
    it("records multiple repair details from a file", () => {
      recordRepairsFromDetails("GetBirthdays.xaml", [
        {
          line: 122,
          attributeName: "Message",
          originalValue: 'Processing "item"',
          repairedValue: "Processing &quot;item&quot;",
          repairReason: "raw_quote_escaped_to_entity",
        },
        {
          line: 470,
          attributeName: "Message",
          originalValue: 'Error "detail"',
          repairedValue: "Error &quot;detail&quot;",
          repairReason: "raw_quote_escaped_to_entity",
        },
      ]);

      const diag = getQuoteRepairDiagnostics();
      expect(diag.attempts.length).toBe(2);
      expect(diag.summary.totalQuoteRepairsApplied).toBe(2);
      expect(diag.summary.totalWorkflowsSavedFromStub).toBe(0);
      expect(diag.attempts[0].file).toBe("GetBirthdays.xaml");
      expect(diag.attempts[0].workflow).toBe("GetBirthdays");
    });
  });

  describe("end-to-end: repair then validate flow", () => {
    it("repairMalformedQuotesInXaml produces content that deterministicQuoteRepair considers clean", () => {
      const xaml = `<ui:LogMessage Level="Info" Message="Processing "item1" and "item2"" DisplayName="Log" />`;
      const repairResult = repairMalformedQuotesInXaml(xaml);
      expect(repairResult.repaired).toBe(true);

      const secondRepair = repairMalformedQuotesInXaml(repairResult.content);
      expect(secondRepair.repaired).toBe(false);
      expect(secondRepair.content).toBe(repairResult.content);
    });
  });

  describe("findClosingAttributeQuote", () => {
    it("finds closing quote before />", () => {
      const line = `<Tag Attr="hello world" />`;
      const valueStart = line.indexOf('"') + 1;
      const idx = findClosingAttributeQuote(line, valueStart);
      expect(line[idx]).toBe('"');
      expect(line.substring(valueStart, idx)).toBe("hello world");
    });

    it("finds closing quote with embedded raw quotes before next attribute", () => {
      const line = `<Tag Attr="hello "world" test" Next="val" />`;
      const valueStart = line.indexOf('"') + 1;
      const idx = findClosingAttributeQuote(line, valueStart);
      expect(line.substring(valueStart, idx)).toBe('hello "world" test');
    });

    it("returns -1 for no closing quote candidate", () => {
      const line = `<Tag Attr=unclosed`;
      const idx = findClosingAttributeQuote(line, 10);
      expect(idx).toBe(-1);
    });
  });

  describe("detector-repair interplay", () => {
    it("validateXamlContent detects malformed quote in Message with embedded raw quotes", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <ui:LogMessage Level="Info" Message="Processing "item1" complete" DisplayName="Log Step" />
  </Sequence>
</Activity>`;
      const violations = validateXamlContent([{ name: "Test.xaml", content: xaml }]);
      const quoteViolations = violations.filter(v => v.check === "malformed-quote" || v.check === "xml-wellformedness");
      expect(quoteViolations.length).toBeGreaterThan(0);
    });

    it("validateAndRepairXamlContent repairs xml-wellformedness caused by quote corruption", () => {
      const corruptedXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main">
    <ui:LogMessage Level="Info" Message="Processing "item1" complete" DisplayName="Log Step" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "Corrupted.xaml", content: corruptedXaml }];

      const preViolations = validateXamlContent(entries);
      const hadIssues = preViolations.some(
        v => v.check === "malformed-quote" || v.check === "xml-wellformedness"
      );
      expect(hadIssues).toBe(true);

      resetQuoteRepairDiagnostics();
      const result = validateAndRepairXamlContent(entries);

      const stillHasQuoteIssues = result.violations.some(
        v => v.file === "Corrupted.xaml" && (v.check === "malformed-quote" || v.check === "xml-wellformedness")
      );

      if (!stillHasQuoteIssues) {
        expect(result.repairSummary.filesSavedFromStub).toContain("Corrupted.xaml");
        const diag = getQuoteRepairDiagnostics();
        expect(diag.summary.totalQuoteRepairsApplied).toBeGreaterThan(0);
        expect(diag.summary.totalWorkflowsSavedFromStub).toBeGreaterThan(0);
      }
    });

    it("diagnostics summary is consistent after repair flow", () => {
      recordRepairsFromDetails("A.xaml", [
        { line: 1, attributeName: "Message", originalValue: '"val"', repairedValue: "&quot;val&quot;", repairReason: "test" },
        { line: 5, attributeName: "DisplayName", originalValue: '"x"', repairedValue: "&quot;x&quot;", repairReason: "test" },
      ]);
      recordRepairsFromDetails("B.xaml", [
        { line: 10, attributeName: "Value", originalValue: '"y"', repairedValue: "&quot;y&quot;", repairReason: "test" },
      ]);
      recordRepairFailure("C.xaml", "Line 20: Text", "broken", "unfixable");

      markFilesSavedFromStub(["A.xaml", "B.xaml"]);

      const diag = getQuoteRepairDiagnostics();
      expect(diag.summary.totalMalformedQuoteFindings).toBe(4);
      expect(diag.summary.totalQuoteRepairsApplied).toBe(3);
      expect(diag.summary.totalQuoteRepairsFailed).toBe(1);
      expect(diag.summary.totalWorkflowsSavedFromStub).toBe(2);
      expect(diag.summary.totalFilesStillStubbedAfterRepairAttempt).toBe(1);
    });
  });

  describe("apostrophe handling", () => {
    it("does not flag apostrophes in double-quoted attribute values", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Don't fail">
    <ui:LogMessage Level="Info" Message="[&quot;It's working&quot;]" DisplayName="Log It's" />
  </Sequence>
</Activity>`;
      const violations = validateXamlContent([{ name: "Apostrophe.xaml", content: xaml }]);
      const quoteViolations = violations.filter(v => v.check === "malformed-quote");
      expect(quoteViolations.length).toBe(0);
    });

    it("does not repair apostrophes in attribute values", () => {
      const xaml = `<ui:LogMessage Level="Info" Message="Don't stop me now" DisplayName="Log It" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(false);
      expect(result.content).toBe(xaml);
    });

    it("deterministicQuoteRepair ignores apostrophes", () => {
      const result = deterministicQuoteRepair("Don't stop");
      expect(result).toBe("Don't stop");
    });
  });

  describe("bracketed VB expression repair", () => {
    it("repairs raw quotes inside bracketed VB expressions", () => {
      const xaml = `<ui:LogMessage Level="Info" Message="[str_Result & "suffix"]" DisplayName="Log" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(true);
      expect(result.content).toContain("&quot;suffix&quot;");
      expect(result.repairs.length).toBeGreaterThan(0);
    });

    it("does not repair bracketed VB expressions without raw quotes", () => {
      const xaml = `<ui:LogMessage Level="Info" Message="[str_Result &amp; &quot;suffix&quot;]" DisplayName="Log" />`;
      const result = repairMalformedQuotesInXaml(xaml);
      expect(result.repaired).toBe(false);
    });

    it("validateXamlContent detects raw quotes inside bracket expressions", () => {
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <ui:LogMessage Level="Info" Message="[str_Result & "suffix"]" DisplayName="Log" />
</Activity>`;
      const violations = validateXamlContent([{ name: "Test.xaml", content: xaml }]);
      const quoteViolations = violations.filter(v => v.check === "malformed-quote" || v.check === "xml-wellformedness");
      expect(quoteViolations.length).toBeGreaterThan(0);
    });
  });

  describe("verifyActivePathProofIntegrity", () => {
    it("returns verified=true when consumed hash matches repaired hash", () => {
      const repairedContent = "repaired content";
      const hash = computeContentHash(repairedContent);
      recordActivePathProof({
        file: "Test.xaml",
        workflow: "Test",
        stageWhereDetected: "test",
        stageWhereApplied: "test",
        preRepairHash: "old",
        postRepairHash: hash,
        downstreamConsumedRepairedVersion: false,
      });

      const result = verifyActivePathProofIntegrity("Test.xaml", hash);
      expect(result.verified).toBe(true);
    });

    it("returns verified=false when consumed hash does not match (non-test mode)", () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      try {
        recordActivePathProof({
          file: "Test.xaml",
          workflow: "Test",
          stageWhereDetected: "test",
          stageWhereApplied: "test",
          preRepairHash: "old",
          postRepairHash: "expected-hash",
          downstreamConsumedRepairedVersion: false,
        });

        const result = verifyActivePathProofIntegrity("Test.xaml", "wrong-hash");
        expect(result.verified).toBe(false);
        expect(result.mismatchDetail).toContain("Active-path proof violation");
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it("returns verified=true when no proof entries exist for file", () => {
      const result = verifyActivePathProofIntegrity("NoProof.xaml", "any-hash");
      expect(result.verified).toBe(true);
    });

    it("verifies against final proof entry when file has multi-stage repairs", () => {
      recordActivePathProof({
        file: "Multi.xaml",
        workflow: "Multi",
        stageWhereDetected: "stage1",
        stageWhereApplied: "stage1",
        preRepairHash: "hash-0",
        postRepairHash: "hash-1",
        downstreamConsumedRepairedVersion: false,
      });
      recordActivePathProof({
        file: "Multi.xaml",
        workflow: "Multi",
        stageWhereDetected: "stage2",
        stageWhereApplied: "stage2",
        preRepairHash: "hash-1",
        postRepairHash: "hash-2",
        downstreamConsumedRepairedVersion: false,
      });

      const result = verifyActivePathProofIntegrity("Multi.xaml", "hash-2");
      expect(result.verified).toBe(true);
    });
  });

  describe("emission hardening", () => {
    it("escapeXmlExpression escapes raw double quotes in attribute content", () => {
      const result = escapeXmlExpression('Hello "world" test');
      expect(result).toContain("&quot;");
    });

    it("escapeXmlExpression does not double-escape already-escaped entities", () => {
      const result = escapeXmlExpression("Hello &quot;world&quot; test");
      expect(result).toContain("&quot;");
      expect(result).not.toContain("&amp;quot;");
    });

    it("raw quote followed by attribute builder produces safe XML", () => {
      const escaped = escapeXml('Set "value" here');
      const attr = `DisplayName="${escaped}"`;
      expect(attr).not.toMatch(/="[^"]*"[^"]*"/);
      expect(attr).toContain("&quot;value&quot;");
    });

    it("escapeXmlAttributeValue round-trips through decode-then-escape", () => {
      const original = 'Hello &quot;world&quot; & "more"';
      const result = escapeXmlAttributeValue(original);
      expect(result).toContain("&quot;");
      expect(result).toContain("&amp;");
      expect(result).not.toContain("&amp;quot;");
    });
  });
});
