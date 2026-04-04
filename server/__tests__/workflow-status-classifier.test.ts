import { describe, it, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import {
  classifyWorkflowStatus,
  classifyFromArchiveBuffer,
  buildWorkflowStatusParity,
  normalizeClassifierFileName,
  resetMonotonicCounter,
  verifyAndReclassifyFromArchive,
  assertClassificationFreshness,
  recordArchiveFinalization,
  freezeArchiveWorkflows,
  isArchiveFrozen,
  getArchiveFreezePoint,
  resetArchiveFreeze,
  assertNoPostFreezeMutation,
  assertNoPostFreezeStatusMutation,
  checkPostFreezeDeferredWriteMutation,
  getMutationTrace,
  recordMutationAttempt,
  createGuardedDeferredWrites,
  createGuardedPostGateEntries,
  verifyFrozenArchiveBuffer,
  AUTHORITATIVE_STUB_PATTERNS,
  CLASSIFIER_VERSION,
  type WorkflowStatusClassifierResult,
} from "../workflow-status-classifier";
import { assertDhgArchiveParity } from "../package-assembler";

const VALID_GENERATED_XAML = `<Activity mc:Ignorable="sap sap2010" x:Class="Main"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Main Sequence">
    <Assign DisplayName="Set Variable" />
  </Sequence>
</Activity>`;

const STUB_XAML = `<Activity mc:Ignorable="sap sap2010" x:Class="Helper"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="STUB_BLOCKING_FALLBACK: workflow stubbed due to generation failure">
    <ui:Comment DisplayName="STUB: Manual implementation required" />
  </Sequence>
</Activity>`;

const MALFORMED_XAML = `<NotAnActivity>
  <SomeGarbage />
</NotAnActivity>`;

const EMPTY_XAML = "";

const BLOCKED_XAML = `<Activity mc:Ignorable="sap sap2010" x:Class="Blocked"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
</Activity>`;

function buildTestArchiveBuffer(files: Array<{ name: string; content: string }>): Buffer {
  const zip = new AdmZip();
  for (const f of files) {
    zip.addFile(f.name, Buffer.from(f.content, "utf-8"));
  }
  return zip.toBuffer();
}

describe("workflow-status-classifier", () => {
  beforeEach(() => {
    resetMonotonicCounter();
  });

  describe("classifyWorkflowStatus", () => {
    it("should classify a valid generated workflow as non-stub", () => {
      const result = classifyWorkflowStatus([
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
      ]);
      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].file).toBe("Main.xaml");
      expect(result.classifications[0].status).toBe("non-stub");
      expect(result.classifications[0].classifierVersion).toBe(CLASSIFIER_VERSION);
      expect(result.classifications[0].stageMarker).toBeGreaterThan(0);
      expect(result.classifications[0].contentHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should classify stub content as stub", () => {
      const result = classifyWorkflowStatus([
        { name: "lib/Helper.xaml", content: STUB_XAML },
      ]);
      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].status).toBe("stub");
      expect(result.classifications[0].rationale).toContain("stub patterns");
    });

    it("should classify malformed content as malformed", () => {
      const result = classifyWorkflowStatus([
        { name: "lib/Broken.xaml", content: MALFORMED_XAML },
      ]);
      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].status).toBe("malformed");
      expect(result.classifications[0].rationale).toContain("Missing root <Activity>");
    });

    it("should classify empty content as malformed", () => {
      const result = classifyWorkflowStatus([
        { name: "lib/Empty.xaml", content: EMPTY_XAML },
      ]);
      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].status).toBe("malformed");
    });

    it("should classify content with empty Activity as blocked (loadable but no implementation)", () => {
      const result = classifyWorkflowStatus([
        { name: "lib/Blocked.xaml", content: BLOCKED_XAML },
      ]);
      expect(result.classifications).toHaveLength(1);
      expect(result.classifications[0].status).toBe("blocked");
      expect(result.classifications[0].rationale).toContain("no implementation child");
    });

    it("should produce monotonic stage markers across calls", () => {
      const r1 = classifyWorkflowStatus([{ name: "A.xaml", content: VALID_GENERATED_XAML }]);
      const r2 = classifyWorkflowStatus([{ name: "B.xaml", content: VALID_GENERATED_XAML }]);
      expect(r2.stageMarker).toBeGreaterThan(r1.stageMarker);
    });

    it("should classify multiple workflows correctly in a single batch", () => {
      const result = classifyWorkflowStatus([
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
        { name: "lib/Broken.xaml", content: MALFORMED_XAML },
        { name: "lib/Blocked.xaml", content: BLOCKED_XAML },
      ]);
      expect(result.classifications).toHaveLength(4);
      const main = result.classifications.find(c => c.file === "Main.xaml");
      const helper = result.classifications.find(c => c.file === "Helper.xaml");
      const broken = result.classifications.find(c => c.file === "Broken.xaml");
      const blocked = result.classifications.find(c => c.file === "Blocked.xaml");
      expect(main?.status).toBe("non-stub");
      expect(helper?.status).toBe("stub");
      expect(broken?.status).toBe("malformed");
      expect(blocked?.status).toBe("blocked");
    });

    it("should detect all authoritative stub patterns", () => {
      for (const pattern of AUTHORITATIVE_STUB_PATTERNS) {
        const content = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities">
  <Sequence DisplayName="test">
    <ui:Comment DisplayName="${pattern}" />
  </Sequence>
</Activity>`;
        const result = classifyWorkflowStatus([{ name: "Test.xaml", content }]);
        expect(result.classifications[0].status).toBe("stub");
      }
    });
  });

  describe("workflow remains stub after final mutation and DHG agrees", () => {
    it("should agree when content is stub", () => {
      const entries = [{ name: "lib/StubWf.xaml", content: STUB_XAML }];
      const classification = classifyWorkflowStatus(entries);
      expect(classification.classifications[0].status).toBe("stub");

      const dhgTierMap = new Map([["stubwf", "Stub"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, entries);
      expect(parity.allPassed).toBe(true);
      expect(parity.divergenceCount).toBe(0);
    });
  });

  describe("workflow becomes non-stub after final mutation and DHG agrees", () => {
    it("should agree when content is generated", () => {
      const entries = [{ name: "lib/Process.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      expect(classification.classifications[0].status).toBe("non-stub");

      const dhgTierMap = new Map([["process", "Generated"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, entries);
      expect(parity.allPassed).toBe(true);
      expect(parity.divergenceCount).toBe(0);
    });
  });

  describe("workflow malformed/blocked and both sides agree", () => {
    it("should agree when content is malformed and DHG says Blocked", () => {
      const entries = [{ name: "lib/Bad.xaml", content: MALFORMED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      expect(classification.classifications[0].status).toBe("malformed");

      const dhgTierMap = new Map([["bad", "Blocked"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, entries);
      expect(parity.allPassed).toBe(true);
    });

    it("should agree when content is blocked (no implementation) and DHG says Blocked", () => {
      const entries = [{ name: "lib/NoImpl.xaml", content: BLOCKED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      expect(classification.classifications[0].status).toBe("blocked");

      const dhgTierMap = new Map([["noimpl", "Blocked"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, entries);
      expect(parity.allPassed).toBe(true);
    });
  });

  describe("parity failure when DHG is intentionally fed stale pre-mutation content", () => {
    it("should detect divergence when DHG input has different content hash", () => {
      const archiveEntries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const staleEntries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML + "<!-- mutated -->" }];
      const classification = classifyWorkflowStatus(archiveEntries);

      const dhgTierMap = new Map([["main", "Generated"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, staleEntries);

      const mainEntry = parity.entries.find(e => normalizeClassifierFileName(e.file) === "main");
      expect(mainEntry).toBeDefined();
      expect(mainEntry!.identicalContent).toBe(false);
      expect(mainEntry!.divergenceReason).toContain("Content hash mismatch");
    });
  });

  describe("normalized file naming edge case", () => {
    it("should match workflows with path prefixes and .xaml suffix", () => {
      const entries = [{ name: "ProjectName/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      expect(classification.classifications[0].file).toBe("Main.xaml");

      const dhgTierMap = new Map([["main", "Generated"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, entries);
      expect(parity.allPassed).toBe(true);
    });

    it("should handle case-insensitive matching", () => {
      const entries = [{ name: "lib/MyWorkflow.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);

      const dhgTierMap = new Map([["myworkflow", "Generated"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, entries);
      expect(parity.allPassed).toBe(true);
    });
  });

  describe("normalizeClassifierFileName", () => {
    it("should strip path prefix and .xaml suffix and lowercase", () => {
      expect(normalizeClassifierFileName("lib/Main.xaml")).toBe("main");
      expect(normalizeClassifierFileName("Main.xaml")).toBe("main");
      expect(normalizeClassifierFileName("Main")).toBe("main");
      expect(normalizeClassifierFileName("some/deep/path/MyWorkflow.XAML")).toBe("myworkflow");
    });
  });

  describe("buildWorkflowStatusParity", () => {
    it("should detect workflow in DHG but not in classifier", () => {
      const classification = classifyWorkflowStatus([
        { name: "Main.xaml", content: VALID_GENERATED_XAML },
      ]);
      const dhgTierMap = new Map([
        ["main", "Generated"],
        ["ghost", "Generated"],
      ]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, [
        { name: "Main.xaml", content: VALID_GENERATED_XAML },
      ]);
      expect(parity.allPassed).toBe(false);
      const ghostEntry = parity.entries.find(e => e.file === "ghost.xaml");
      expect(ghostEntry).toBeDefined();
      expect(ghostEntry!.divergenceReason).toContain("not in archive classifier");
    });

    it("should detect status divergence between classifier and DHG", () => {
      const entries = [{ name: "lib/Wf.xaml", content: STUB_XAML }];
      const classification = classifyWorkflowStatus(entries);
      expect(classification.classifications[0].status).toBe("stub");

      const dhgTierMap = new Map([["wf", "Generated"]]);
      const parity = buildWorkflowStatusParity(classification, dhgTierMap, entries);
      expect(parity.allPassed).toBe(false);
      const wfEntry = parity.entries.find(e => normalizeClassifierFileName(e.file) === "wf");
      expect(wfEntry!.identicalStatus).toBe(false);
      expect(wfEntry!.divergenceReason).toContain("Status mismatch");
    });
  });

  describe("assertDhgArchiveParity with authoritative classifier", () => {
    it("should pass when classifier=non-stub and DHG=Generated", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Main.xaml` | Generated | 5 |";
      const result = assertDhgArchiveParity(dhg, ["Main"], entries, classification);
      expect(result.passed).toBe(true);
    });

    it("should fail when classifier=stub and DHG=Generated", () => {
      const entries = [{ name: "lib/Main.xaml", content: STUB_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Main.xaml` | Generated | 5 |";
      const result = assertDhgArchiveParity(dhg, ["Main"], entries, classification);
      expect(result.passed).toBe(false);
      expect(result.divergences[0]).toContain("stub");
    });

    it("should fail when classifier=stub and DHG=Handoff", () => {
      const entries = [{ name: "lib/Main.xaml", content: STUB_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Main.xaml` | Handoff | 3 |";
      const result = assertDhgArchiveParity(dhg, ["Main"], entries, classification);
      expect(result.passed).toBe(false);
    });

    it("should fail when classifier=non-stub and DHG=Stub", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Main.xaml` | Stub | 1 |";
      const result = assertDhgArchiveParity(dhg, ["Main"], entries, classification);
      expect(result.passed).toBe(false);
      expect(result.divergences[0]).toContain("non-stub");
    });

    it("should fail when classifier=stub and DHG=Blocked", () => {
      const entries = [{ name: "lib/Main.xaml", content: STUB_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Main.xaml` | Blocked | 3 |";
      const result = assertDhgArchiveParity(dhg, ["Main"], entries, classification);
      expect(result.passed).toBe(false);
      expect(result.divergences[0]).toContain("stub");
    });

    it("should fail when classifier=non-stub and DHG=Blocked", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Main.xaml` | Blocked | 3 |";
      const result = assertDhgArchiveParity(dhg, ["Main"], entries, classification);
      expect(result.passed).toBe(false);
      expect(result.divergences[0]).toContain("non-stub");
    });

    it("should pass when classifier=malformed and DHG=Blocked", () => {
      const entries = [{ name: "lib/Bad.xaml", content: MALFORMED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Bad.xaml` | Blocked | 0 |";
      const result = assertDhgArchiveParity(dhg, ["Bad"], entries, classification);
      expect(result.passed).toBe(true);
    });

    it("should pass when classifier=blocked and DHG=Blocked", () => {
      const entries = [{ name: "lib/NoImpl.xaml", content: BLOCKED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      expect(classification.classifications[0].status).toBe("blocked");
      const dhg = "| 1 | `NoImpl.xaml` | Blocked | 0 |";
      const result = assertDhgArchiveParity(dhg, ["NoImpl"], entries, classification);
      expect(result.passed).toBe(true);
    });

    it("should fail when classifier=blocked and DHG=Generated", () => {
      const entries = [{ name: "lib/NoImpl.xaml", content: BLOCKED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `NoImpl.xaml` | Generated | 5 |";
      const result = assertDhgArchiveParity(dhg, ["NoImpl"], entries, classification);
      expect(result.passed).toBe(false);
    });

    it("should fail when classifier=malformed and DHG=Generated", () => {
      const entries = [{ name: "lib/Bad.xaml", content: MALFORMED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Bad.xaml` | Generated | 5 |";
      const result = assertDhgArchiveParity(dhg, ["Bad"], entries, classification);
      expect(result.passed).toBe(false);
    });

    it("should pass when classifier=stub and DHG=Stub", () => {
      const entries = [{ name: "lib/Helper.xaml", content: STUB_XAML }];
      const classification = classifyWorkflowStatus(entries);
      const dhg = "| 1 | `Helper.xaml` | Stub | 1 |";
      const result = assertDhgArchiveParity(dhg, ["Helper"], entries, classification);
      expect(result.passed).toBe(true);
    });

    it("should fall back to pattern matching when no authoritative classifier is provided", () => {
      const entries = [{ name: "lib/Main.xaml", content: STUB_XAML }];
      const dhg = "| 1 | `Main.xaml` | Generated | 5 |";
      const result = assertDhgArchiveParity(dhg, ["Main"], entries);
      expect(result.passed).toBe(false);
    });
  });

  describe("classifyFromArchiveBuffer", () => {
    it("should classify XAML from archive buffer bytes identically to in-memory classification", () => {
      const entries = [
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
        { name: "lib/Broken.xaml", content: MALFORMED_XAML },
        { name: "lib/NoImpl.xaml", content: BLOCKED_XAML },
      ];
      const archiveBuffer = buildTestArchiveBuffer(entries);
      const result = classifyFromArchiveBuffer(archiveBuffer);

      expect(result.classifications).toHaveLength(4);
      const statuses = new Map(result.classifications.map(c => [normalizeClassifierFileName(c.file), c.status]));
      expect(statuses.get("main")).toBe("non-stub");
      expect(statuses.get("helper")).toBe("stub");
      expect(statuses.get("broken")).toBe("malformed");
      expect(statuses.get("noimpl")).toBe("blocked");
    });

    it("should skip non-xaml entries in archive buffer", () => {
      const archiveBuffer = buildTestArchiveBuffer([
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "project.json", content: '{"name":"test"}' },
      ]);
      const result = classifyFromArchiveBuffer(archiveBuffer);
      expect(result.classifications).toHaveLength(1);
    });

    it("should produce same hashes as in-memory classification for identical content", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const inMemory = classifyWorkflowStatus(entries);
      const archiveBuffer = buildTestArchiveBuffer(entries);
      const fromArchive = classifyFromArchiveBuffer(archiveBuffer);

      expect(fromArchive.classifications[0].contentHash).toBe(inMemory.classifications[0].contentHash);
      expect(fromArchive.classifications[0].status).toBe(inMemory.classifications[0].status);
    });
  });

  describe("verifyAndReclassifyFromArchive", () => {
    it("should verify matching archive bytes pass with no divergence", () => {
      const entries = [
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
      ];
      const preClassification = classifyWorkflowStatus(entries);
      const archiveBuffer = buildTestArchiveBuffer([
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
      ]);

      const result = verifyAndReclassifyFromArchive(preClassification, archiveBuffer, "lib");
      expect(result.verified).toBe(true);
      expect(result.hashMismatches).toHaveLength(0);
      expect(result.statusChanges).toHaveLength(0);
      expect(result.reclassifiedCount).toBe(2);
      expect(result.finalClassification.stageMarker).toBeGreaterThan(preClassification.stageMarker);
    });

    it("should detect hash mismatch when archive bytes differ", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const preClassification = classifyWorkflowStatus(entries);
      const mutatedContent = VALID_GENERATED_XAML + "<!-- late mutation -->";
      const archiveBuffer = buildTestArchiveBuffer([
        { name: "lib/Main.xaml", content: mutatedContent },
      ]);

      const result = verifyAndReclassifyFromArchive(preClassification, archiveBuffer, "lib");
      expect(result.verified).toBe(false);
      expect(result.hashMismatches).toHaveLength(1);
      expect(result.hashMismatches[0].file).toBe("Main.xaml");
    });

    it("should detect status change when archive content changes classification", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const preClassification = classifyWorkflowStatus(entries);
      expect(preClassification.classifications[0].status).toBe("non-stub");

      const archiveBuffer = buildTestArchiveBuffer([
        { name: "lib/Main.xaml", content: STUB_XAML },
      ]);

      const result = verifyAndReclassifyFromArchive(preClassification, archiveBuffer, "lib");
      expect(result.verified).toBe(false);
      expect(result.statusChanges).toHaveLength(1);
      expect(result.statusChanges[0].preArchiveStatus).toBe("non-stub");
      expect(result.statusChanges[0].archiveStatus).toBe("stub");
    });

    it("should skip non-xaml entries in archive", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const preClassification = classifyWorkflowStatus(entries);
      const archiveBuffer = buildTestArchiveBuffer([
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "project.json", content: '{"name":"test"}' },
        { name: "README.md", content: "# Test" },
      ]);

      const result = verifyAndReclassifyFromArchive(preClassification, archiveBuffer, "lib");
      expect(result.verified).toBe(true);
      expect(result.reclassifiedCount).toBe(1);
    });

    it("should produce a finalClassification with fresh stageMarker", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const preClassification = classifyWorkflowStatus(entries);
      const archiveBuffer = buildTestArchiveBuffer([
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
      ]);

      const result = verifyAndReclassifyFromArchive(preClassification, archiveBuffer, "lib");
      expect(result.finalClassification.stageMarker).toBeGreaterThan(preClassification.stageMarker);
      expect(result.finalClassification.classifierVersion).toBe(CLASSIFIER_VERSION);
    });
  });

  describe("stage marker freshness enforcement", () => {
    it("should not throw when classification is fresh (no archive finalization yet)", () => {
      const result = classifyWorkflowStatus([{ name: "A.xaml", content: VALID_GENERATED_XAML }]);
      expect(() => assertClassificationFreshness(result)).not.toThrow();
    });

    it("should throw when classification predates archive finalization", () => {
      const result = classifyWorkflowStatus([{ name: "A.xaml", content: VALID_GENERATED_XAML }]);
      recordArchiveFinalization();
      expect(() => assertClassificationFreshness(result)).toThrow("STALE CLASSIFICATION");
    });

    it("should not throw when classification is newer than archive finalization", () => {
      recordArchiveFinalization();
      const result = classifyWorkflowStatus([{ name: "A.xaml", content: VALID_GENERATED_XAML }]);
      expect(() => assertClassificationFreshness(result)).not.toThrow();
    });

    it("should throw with descriptive message including marker values", () => {
      const result = classifyWorkflowStatus([{ name: "A.xaml", content: VALID_GENERATED_XAML }]);
      recordArchiveFinalization();
      expect(() => assertClassificationFreshness(result)).toThrow(/stageMarker=\d+/);
      expect(() => assertClassificationFreshness(result)).toThrow(/finalization marker=\d+/);
    });
  });

  describe("WorkflowStatus covers all four statuses", () => {
    it("should only produce stub, non-stub, malformed, or blocked statuses", () => {
      const entries = [
        { name: "A.xaml", content: VALID_GENERATED_XAML },
        { name: "B.xaml", content: STUB_XAML },
        { name: "C.xaml", content: MALFORMED_XAML },
        { name: "D.xaml", content: EMPTY_XAML },
        { name: "E.xaml", content: BLOCKED_XAML },
      ];
      const result = classifyWorkflowStatus(entries);
      for (const c of result.classifications) {
        expect(["stub", "non-stub", "malformed", "blocked"]).toContain(c.status);
      }
    });

    it("should produce all four statuses across representative inputs", () => {
      const entries = [
        { name: "A.xaml", content: VALID_GENERATED_XAML },
        { name: "B.xaml", content: STUB_XAML },
        { name: "C.xaml", content: MALFORMED_XAML },
        { name: "D.xaml", content: BLOCKED_XAML },
      ];
      const result = classifyWorkflowStatus(entries);
      const statuses = new Set(result.classifications.map(c => c.status));
      expect(statuses).toEqual(new Set(["non-stub", "stub", "malformed", "blocked"]));
    });
  });

  describe("archive freeze — post-classifier mutation elimination", () => {
    it("should freeze archive workflows after classification", () => {
      const entries = [
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
      ];
      const classification = classifyWorkflowStatus(entries);

      expect(isArchiveFrozen()).toBe(false);
      const freeze = freezeArchiveWorkflows(entries, classification);

      expect(isArchiveFrozen()).toBe(true);
      expect(freeze.frozenWorkflows.size).toBe(2);
      expect(freeze.frozenFilenames).toHaveLength(2);
      expect(freeze.classification).toBe(classification);

      const mainFrozen = freeze.frozenWorkflows.get("main");
      expect(mainFrozen).toBeDefined();
      expect(mainFrozen!.status).toBe("non-stub");
      expect(mainFrozen!.content).toBe(VALID_GENERATED_XAML);

      const helperFrozen = freeze.frozenWorkflows.get("helper");
      expect(helperFrozen).toBeDefined();
      expect(helperFrozen!.status).toBe("stub");
    });

    it("should trigger fatal failure on workflow bytes mutation after freeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const mutatedContent = VALID_GENERATED_XAML + "<!-- late mutation -->";
      expect(() => assertNoPostFreezeMutation(
        "late-stage-repair",
        "Main.xaml",
        mutatedContent,
        "xaml_bytes",
        "Attempted repair after freeze",
      )).toThrow("Post-Freeze Mutation Violation");
    });

    it("should trigger fatal failure on workflow status mutation after freeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      expect(() => assertNoPostFreezeStatusMutation(
        "dhg-status-inference",
        "Main.xaml",
        "stub",
        "DHG tried to override status",
      )).toThrow("Post-Freeze Mutation Violation");
    });

    it("should not throw when workflow bytes are unchanged after freeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      expect(() => assertNoPostFreezeMutation(
        "parity-check",
        "Main.xaml",
        VALID_GENERATED_XAML,
        "xaml_bytes",
        "Read-only check",
      )).not.toThrow();
    });

    it("should not throw when workflow status is unchanged after freeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      expect(() => assertNoPostFreezeStatusMutation(
        "parity-check",
        "Main.xaml",
        "non-stub",
        "Read-only check",
      )).not.toThrow();
    });

    it("should block deferredWrites mutation on frozen XAML in package mode", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const mutatedContent = VALID_GENERATED_XAML + "<!-- injected -->";
      expect(() => checkPostFreezeDeferredWriteMutation(
        "stub-injection",
        "lib/Main.xaml",
        mutatedContent,
        true,
      )).toThrow("Post-Freeze Mutation Violation");
    });

    it("should not block deferredWrites mutation on non-XAML files", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      expect(() => checkPostFreezeDeferredWriteMutation(
        "config-update",
        "lib/project.json",
        '{"updated": true}',
        true,
      )).not.toThrow();
    });

    it("should block stub injection after freeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const stubContent = `<Activity><Sequence DisplayName="STUB_BLOCKING_FALLBACK"></Sequence></Activity>`;
      expect(() => assertNoPostFreezeMutation(
        "stub-injection",
        "Main.xaml",
        stubContent,
        "stub_injection",
        "Attempted to inject stub after freeze",
      )).toThrow("Post-Freeze Mutation Violation");
    });

    it("should block placeholder injection after freeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const placeholderContent = VALID_GENERATED_XAML.replace("Set Variable", "PLACEHOLDER_VALUE");
      expect(() => assertNoPostFreezeMutation(
        "placeholder-injection",
        "Main.xaml",
        placeholderContent,
        "placeholder_injection",
        "Attempted placeholder injection after freeze",
      )).toThrow("Post-Freeze Mutation Violation");
    });

    it("should record mutation attempts in mutation trace", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      try {
        assertNoPostFreezeMutation(
          "late-repair",
          "Main.xaml",
          VALID_GENERATED_XAML + "<!-- mutation -->",
          "xaml_bytes",
          "test mutation",
        );
      } catch {}

      const trace = getMutationTrace();
      const preFreezeEntries = trace.entries.filter(e => e.stage === "pre-freeze-snapshot");
      const blockedEntries = trace.entries.filter(e => !e.allowed);
      expect(preFreezeEntries).toHaveLength(1);
      expect(blockedEntries).toHaveLength(1);
      expect(blockedEntries[0].stage).toBe("late-repair");
      expect(blockedEntries[0].file).toBe("Main.xaml");
      expect(blockedEntries[0].mutationType).toBe("xaml_bytes");
      expect(blockedEntries[0].allowed).toBe(false);
      expect(trace.summary.totalAttemptedMutations).toBe(2);
      expect(trace.summary.totalBlockedMutations).toBe(1);
      expect(trace.summary.totalAllowedPreFreezeMutations).toBe(1);
      expect(trace.summary.totalPostFreezeViolations).toBe(1);
    });

    it("should pass DHG generation from frozen content through parity", () => {
      const entries = [
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
      ];
      const classification = classifyWorkflowStatus(entries);
      const freeze = freezeArchiveWorkflows(entries, classification);

      const frozenEntries = Array.from(freeze.frozenWorkflows.values()).map(fw => ({
        name: fw.file,
        content: fw.content,
      }));
      const dhg = "| 1 | `Main.xaml` | Generated | 5 |\n| 2 | `Helper.xaml` | Stub | 1 |";
      const result = assertDhgArchiveParity(dhg, ["Main", "Helper"], frozenEntries, classification);
      expect(result.passed).toBe(true);
    });

    it("should detect parity failure when stale pre-freeze content is used", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const staleEntries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML + "<!-- stale -->" }];
      const dhg = "| 1 | `Main.xaml` | Generated | 5 |";
      const parity = buildWorkflowStatusParity(classification, new Map([["main", "Generated"]]), staleEntries);
      const mainEntry = parity.entries.find(e => normalizeClassifierFileName(e.file) === "main");
      expect(mainEntry!.identicalContent).toBe(false);
      expect(mainEntry!.divergenceReason).toContain("Content hash mismatch");
    });

    it("should reset freeze state on resetMonotonicCounter", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);
      expect(isArchiveFrozen()).toBe(true);

      resetMonotonicCounter();
      expect(isArchiveFrozen()).toBe(false);
      expect(getArchiveFreezePoint()).toBeNull();
    });

    it("should reset freeze state on resetArchiveFreeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);
      expect(isArchiveFrozen()).toBe(true);

      resetArchiveFreeze();
      expect(isArchiveFrozen()).toBe(false);
    });

    it("should not enforce freeze when no freeze has been established", () => {
      expect(isArchiveFrozen()).toBe(false);
      expect(() => assertNoPostFreezeMutation(
        "some-stage",
        "Main.xaml",
        "any content",
        "xaml_bytes",
        "no freeze yet",
      )).not.toThrow();
    });

    it("should include stage-attributed error details in mutation violation", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const mutated = VALID_GENERATED_XAML + "<!-- mutation -->";
      try {
        assertNoPostFreezeMutation("test-stage", "Main.xaml", mutated, "xaml_bytes", "test reason");
        expect.unreachable("Should have thrown");
      } catch (e: unknown) {
        const err = e as Error;
        expect(err.message).toContain("test-stage");
        expect(err.message).toContain("Main.xaml");
        expect(err.message).toContain("xaml_bytes");
        expect(err.message).toContain("preHash=");
        expect(err.message).toContain("postHash=");
      }
    });

    it("should produce compact mutation trace summary with per-file counts", () => {
      resetArchiveFreeze();
      const entries = [
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
      ];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      try { assertNoPostFreezeMutation("stage-a", "Main.xaml", VALID_GENERATED_XAML + "<!-- m1 -->", "xaml_bytes", "r1"); } catch {}
      try { assertNoPostFreezeStatusMutation("stage-b", "Helper.xaml", "non-stub", "r2"); } catch {}

      const trace = getMutationTrace();
      const preFreezeEntries = trace.entries.filter(e => e.stage === "pre-freeze-snapshot");
      const blockedEntries = trace.entries.filter(e => !e.allowed);
      expect(preFreezeEntries).toHaveLength(2);
      expect(blockedEntries).toHaveLength(2);
      expect(trace.summary.totalAttemptedMutations).toBe(4);
      expect(trace.summary.totalBlockedMutations).toBe(2);
      expect(trace.summary.totalPostFreezeViolations).toBe(2);
      expect(trace.summary.totalAllowedPreFreezeMutations).toBe(2);
      expect(trace.summary.totalUnexpectedPostFreezeMutations).toBe(1);
      expect(trace.summary.filesChangedAfterFreeze).toBe(1);
      expect(trace.perFileMutationCounts["Main.xaml"]).toBeGreaterThanOrEqual(2);
      expect(trace.filesChangedAfterFreeze).toContain("Main.xaml");
    });
  });

  describe("post-freeze mutation regression tests (Task #434)", () => {
    beforeEach(() => {
      resetMonotonicCounter();
      resetArchiveFreeze();
    });

    it("should block late mutation after freeze on Finalize.xaml", () => {
      const finalizeXaml = `<Activity mc:Ignorable="sap sap2010" x:Class="Finalize"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Finalize Sequence">
    <Assign DisplayName="Set Result" />
  </Sequence>
</Activity>`;
      const entries = [{ name: "lib/Finalize.xaml", content: finalizeXaml }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const mutated = finalizeXaml + "<!-- late change -->";
      expect(() => {
        assertNoPostFreezeMutation("late-stage", "Finalize.xaml", mutated, "xaml_bytes", "unauthorized edit");
      }).toThrow(/Post-Freeze Mutation Violation.*Finalize\.xaml/);
    });

    it("should block late mutation after freeze on Main.xaml", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const mutated = VALID_GENERATED_XAML + "<!-- late mutation -->";
      expect(() => {
        assertNoPostFreezeMutation("reporting-stage", "Main.xaml", mutated, "xaml_bytes", "reporting rewrite");
      }).toThrow(/Post-Freeze Mutation Violation.*Main\.xaml/);
    });

    it("should detect multiple files changing after freeze in mutation trace", () => {
      const secondXaml = VALID_GENERATED_XAML.replace("Main", "Helper");
      const entries = [
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: secondXaml },
      ];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      try { assertNoPostFreezeMutation("s1", "Main.xaml", VALID_GENERATED_XAML + "<!-- m -->", "xaml_bytes", "r"); } catch {}
      try { assertNoPostFreezeMutation("s2", "Helper.xaml", secondXaml + "<!-- m -->", "xaml_bytes", "r"); } catch {}

      const trace = getMutationTrace();
      expect(trace.filesChangedAfterFreeze).toHaveLength(2);
      expect(trace.filesChangedAfterFreeze).toContain("Main.xaml");
      expect(trace.filesChangedAfterFreeze).toContain("Helper.xaml");
      expect(trace.summary.filesChangedAfterFreeze).toBe(2);
    });

    it("should block deferredWrites mutation after freeze in package mode", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const dw = new Map<string, string>();
      dw.set("lib/Main.xaml", VALID_GENERATED_XAML);
      const guarded = createGuardedDeferredWrites(dw, true);

      expect(() => {
        guarded.set("lib/Main.xaml", VALID_GENERATED_XAML + "<!-- mutated -->");
      }).toThrow(/Post-Freeze Mutation Violation.*Main\.xaml/);
    });

    it("should block archive-buffer mutation detected by verifyFrozenArchiveBuffer", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const mutatedZip = new AdmZip();
      mutatedZip.addFile("lib/Main.xaml", Buffer.from(VALID_GENERATED_XAML + "<!-- corrupted -->", "utf-8"));
      const mutatedBuffer = mutatedZip.toBuffer();

      const result = verifyFrozenArchiveBuffer(mutatedBuffer, "lib");
      expect(result.verified).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].file).toBe("Main.xaml");
    });

    it("should block postGateXamlEntries content mutation after freeze in package mode", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const guarded = createGuardedPostGateEntries(entries, true);
      expect(() => {
        guarded[0].content = VALID_GENERATED_XAML + "<!-- post-freeze edit -->";
      }).toThrow(/Post-Freeze Mutation Violation.*Main\.xaml/);
    });

    it("should allow assigning same content to guarded postGateXamlEntries after freeze", () => {
      const entries = [{ name: "lib/Main.xaml", content: VALID_GENERATED_XAML }];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const guarded = createGuardedPostGateEntries(entries, true);
      expect(() => {
        guarded[0].content = VALID_GENERATED_XAML;
      }).not.toThrow();
    });

    it("should pass verifyFrozenArchiveBuffer when frozen hashes equal archived hashes", () => {
      const entries = [
        { name: "lib/Main.xaml", content: VALID_GENERATED_XAML },
        { name: "lib/Helper.xaml", content: STUB_XAML },
      ];
      const classification = classifyWorkflowStatus(entries);
      freezeArchiveWorkflows(entries, classification);

      const zip = new AdmZip();
      zip.addFile("lib/Main.xaml", Buffer.from(VALID_GENERATED_XAML, "utf-8"));
      zip.addFile("lib/Helper.xaml", Buffer.from(STUB_XAML, "utf-8"));
      const buffer = zip.toBuffer();

      const result = verifyFrozenArchiveBuffer(buffer, "lib");
      expect(result.verified).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });
  });
});
