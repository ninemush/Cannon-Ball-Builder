import { describe, it, expect, beforeAll } from "vitest";
import { scanSddForUnverifiedPackages, buildPromptGuidance, buildSddScanGuidance, type PromptGuidanceConfig } from "../catalog/prompt-guidance-filter";
import { catalogService, type FeedStatus, type CatalogPackage } from "../catalog/catalog-service";
import { join } from "path";

describe("Task 413: Catalog alignment, delisting, and prompt-guidance filter", () => {

  beforeAll(() => {
    const catalogPath = join(process.cwd(), "catalog", "activity-catalog.json");
    catalogService.load(catalogPath);
  });

  describe("FeedStatus type includes delisted", () => {
    it("should accept 'delisted' as a valid FeedStatus value", () => {
      const status: FeedStatus = "delisted";
      expect(status).toBe("delisted");
    });

    it("should accept 'verified' and 'unverified' as valid FeedStatus values", () => {
      const s1: FeedStatus = "verified";
      const s2: FeedStatus = "unverified";
      expect(s1).toBe("verified");
      expect(s2).toBe("unverified");
    });
  });

  describe("CatalogPackage generationApproved flag", () => {
    it("should allow generationApproved to be set on a package", () => {
      const pkg: CatalogPackage = {
        packageId: "UiPath.Test.Activities",
        activities: [],
        generationApproved: true,
      };
      expect(pkg.generationApproved).toBe(true);
    });

    it("should allow generationApproved to be false", () => {
      const pkg: CatalogPackage = {
        packageId: "UiPath.GenAI.Activities",
        activities: [],
        feedStatus: "delisted",
        generationApproved: false,
      };
      expect(pkg.generationApproved).toBe(false);
      expect(pkg.feedStatus).toBe("delisted");
    });
  });

  describe("buildPromptGuidance policy gates", () => {
    it("should exclude delisted packages", () => {
      const result = buildPromptGuidance();
      const delistedExclusions = result.diagnostics.excluded.filter(e => e.reasons.includes("delisted"));
      expect(delistedExclusions.some(e => e.packageId === "UiPath.GenAI.Activities")).toBe(true);
      expect(result.packageIds.has("UiPath.GenAI.Activities")).toBe(false);
    });

    it("should exclude packages with generationApproved=false", () => {
      const result = buildPromptGuidance();
      const notApproved = result.diagnostics.excluded.filter(e => e.reasons.includes("not generation-approved"));
      expect(notApproved.some(e => e.packageId === "UiPath.GenAI.Activities")).toBe(true);
    });

    it("should exclude packages with no emission-approved activities", () => {
      const result = buildPromptGuidance();
      const noEmission = result.diagnostics.excluded.filter(e => e.reasons.includes("no emission-approved activities"));
      expect(noEmission.length).toBeGreaterThan(0);
    });

    it("should exclude connector-only packages by default", () => {
      const result = buildPromptGuidance();
      const connectorOnly = result.diagnostics.excluded.filter(e => e.reasons.includes("connector-only"));
      expect(connectorOnly.some(e => e.packageId === "UiPath.IntegrationService.Activities")).toBe(true);
    });

    it("should exclude Windows-only packages when target is Portable", () => {
      const result = buildPromptGuidance({ targetFramework: "Portable" });
      const targetIncompat = result.diagnostics.excluded.filter(e => e.reasons.includes("target-incompatible (Windows-only)"));
      expect(targetIncompat.some(e => e.packageId === "UiPath.UIAutomation.Activities")).toBe(true);
    });

    it("should include Windows-only packages when target is Windows", () => {
      const result = buildPromptGuidance({ targetFramework: "Windows" });
      const targetIncompat = result.diagnostics.excluded.filter(e => e.reasons.includes("target-incompatible (Windows-only)"));
      expect(targetIncompat).toHaveLength(0);
    });

    it("should return diagnostics with considered/included/excluded counts", () => {
      const result = buildPromptGuidance();
      expect(result.diagnostics.totalConsidered).toBeGreaterThan(0);
      expect(result.diagnostics.totalIncluded).toBeGreaterThan(0);
      expect(result.diagnostics.totalExcluded).toBeGreaterThan(0);
      expect(result.diagnostics.totalConsidered).toBe(result.diagnostics.totalIncluded + result.diagnostics.totalExcluded);
    });

    it("should produce non-empty guidance block", () => {
      const result = buildPromptGuidance();
      expect(result.guidanceBlock.length).toBeGreaterThan(0);
      expect(result.guidanceBlock).toContain("UiPath.");
    });

    it("should produce packageIds set matching included entries", () => {
      const result = buildPromptGuidance();
      expect(result.packageIds.size).toBe(result.diagnostics.totalIncluded);
      for (const entry of result.diagnostics.included) {
        expect(result.packageIds.has(entry.packageId)).toBe(true);
      }
    });

    it("should respect budget constraints", () => {
      const result = buildPromptGuidance({ maxPackages: 3 });
      expect(result.diagnostics.totalIncluded).toBeLessThanOrEqual(3);
      expect(result.diagnostics.budgetApplied).toBe(true);
      expect(result.diagnostics.budgetTruncatedCount).toBeGreaterThan(0);
    });
  });

  describe("buildSddScanGuidance", () => {
    it("should return guidance with SDD-specific budget limits", () => {
      const result = buildSddScanGuidance();
      expect(result.diagnostics.totalIncluded).toBeLessThanOrEqual(40);
      expect(result.guidanceBlock.length).toBeLessThanOrEqual(3000);
    });

    it("should accept a studio profile for target filtering", () => {
      const result = buildSddScanGuidance({
        studioLine: "Community",
        studioVersion: "25.10",
        targetFramework: "Portable",
        projectType: "Process",
        expressionLanguage: "VisualBasic",
        minimumRequiredPackages: [],
      });
      expect(result.diagnostics.targetFramework).toBe("Portable");
    });
  });

  describe("scanSddForUnverifiedPackages", () => {
    it("should return empty array when all mentioned packages are verified", () => {
      const sddContent = "This SDD uses UiPath.UIAutomation.Activities and UiPath.System.Activities for automation.";
      const verified = new Set(["UiPath.UIAutomation.Activities", "UiPath.System.Activities"]);
      const result = scanSddForUnverifiedPackages(sddContent, verified);
      expect(result).toEqual([]);
    });

    it("should detect unverified package mentions", () => {
      const sddContent = "The process leverages UiPath.UIAutomation.Activities and UiPath.FakePackage.Activities for integration.";
      const verified = new Set(["UiPath.UIAutomation.Activities", "UiPath.System.Activities"]);
      const result = scanSddForUnverifiedPackages(sddContent, verified);
      expect(result).toEqual(["UiPath.FakePackage.Activities"]);
    });

    it("should detect multiple unverified packages", () => {
      const sddContent = `
        Using UiPath.Unknown1.Activities for step 1
        and UiPath.Unknown2.Activities for step 2
        plus verified UiPath.System.Activities
      `;
      const verified = new Set(["UiPath.System.Activities"]);
      const result = scanSddForUnverifiedPackages(sddContent, verified);
      expect(result).toEqual(["UiPath.Unknown1.Activities", "UiPath.Unknown2.Activities"]);
    });

    it("should deduplicate repeated mentions", () => {
      const sddContent = "UiPath.Fake.Activities is used here. Also UiPath.Fake.Activities again.";
      const verified = new Set(["UiPath.System.Activities"]);
      const result = scanSddForUnverifiedPackages(sddContent, verified);
      expect(result).toEqual(["UiPath.Fake.Activities"]);
    });

    it("should return sorted results", () => {
      const sddContent = "UiPath.Zebra.Activities and UiPath.Alpha.Activities are mentioned.";
      const verified = new Set<string>();
      const result = scanSddForUnverifiedPackages(sddContent, verified);
      expect(result).toEqual(["UiPath.Alpha.Activities", "UiPath.Zebra.Activities"]);
    });

    it("should ignore non-package UiPath references", () => {
      const sddContent = "UiPath.Studio is a development tool. UiPath.Robot runs automations.";
      const verified = new Set<string>();
      const result = scanSddForUnverifiedPackages(sddContent, verified);
      expect(result).toEqual([]);
    });

    it("should handle empty content", () => {
      const result = scanSddForUnverifiedPackages("", new Set());
      expect(result).toEqual([]);
    });

    it("should flag GenAI as unverified when scanned against guidance set", () => {
      const guidanceResult = buildPromptGuidance();
      const sddContent = "The automation uses UiPath.GenAI.Activities for LLM integration.";
      const unverified = scanSddForUnverifiedPackages(sddContent, guidanceResult.packageIds);
      expect(unverified).toContain("UiPath.GenAI.Activities");
    });
  });

  describe("GenAI removal from hardcoded patterns", () => {
    it("should not include GenAI in activity-definitions", async () => {
      const { readFileSync } = await import("fs");
      const defsPath = join(process.cwd(), "server", "catalog", "activity-definitions.ts");
      const content = readFileSync(defsPath, "utf-8");
      expect(content).not.toContain("GENAI_ACTIVITIES");
      expect(content).not.toContain("UiPath.GenAI.Activities");
    });

    it("should not include GenAI in catalog-enrichment hardcoded map", async () => {
      const { readFileSync } = await import("fs");
      const enrichPath = join(process.cwd(), "server", "catalog", "catalog-enrichment.ts");
      const content = readFileSync(enrichPath, "utf-8");
      expect(content).not.toMatch(/"UiPath\.GenAI\.Activities":\s*\{/);
    });
  });

  describe("Catalog JSON data integrity", () => {
    it("should have GenAI marked as delisted in activity-catalog.json", async () => {
      const { readFileSync } = await import("fs");
      const catalogPath = join(process.cwd(), "catalog", "activity-catalog.json");
      const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
      const genAiPkg = catalog.packages.find((p: any) => p.packageId === "UiPath.GenAI.Activities");
      if (genAiPkg) {
        expect(genAiPkg.feedStatus).toBe("delisted");
        expect(genAiPkg.generationApproved).toBe(false);
      }
    });

    it("should have GenAI marked as delisted in generation-metadata.json", async () => {
      const { readFileSync } = await import("fs");
      const metaPath = join(process.cwd(), "catalog", "generation-metadata.json");
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      const genAiEntry = meta.packageVersionRanges?.["UiPath.GenAI.Activities"];
      if (genAiEntry) {
        expect(genAiEntry.feedStatus).toBe("delisted");
        expect(genAiEntry.delistedAt).toBeTruthy();
      }
    });

    it("should have delisted as valid feedStatus in catalog validator", async () => {
      const { readFileSync } = await import("fs");
      const validatorPath = join(process.cwd(), "server", "catalog", "catalog-validator.ts");
      const content = readFileSync(validatorPath, "utf-8");
      expect(content).toContain('"delisted"');
    });
  });
});
