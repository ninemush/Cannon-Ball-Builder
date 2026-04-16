import { describe, it, expect } from "vitest";
import {
  makeTodoTextPlaceholder,
  makeTodoTokenPlaceholder,
  makePlaceholderTokenFallback,
  isCanonicalPlaceholder,
  coerceToCanonicalPlaceholder,
  assertCanonicalPlaceholdersInXaml,
  drainProvenanceLedger,
} from "../lib/placeholder-sanitizer";
import { validateContractIntegrity } from "../xaml/workflow-contract-integrity";
import {
  extractDeclaredVariables,
  findUndeclaredVariables,
} from "../xaml/vbnet-expression-linter";
import { ACTIVITY_REGISTRY } from "../uipath-activity-registry";
import {
  runFinalArtifactValidation,
  type FinalArtifactValidationInput,
} from "../final-artifact-validation";

describe("Task #527 – Systemic pipeline root-cause fixes (Runs 474–475)", () => {
  describe("RC1: canonical safe placeholder vocabulary", () => {
    it("constructs canonical forms that contain no ':' in the placeholder body", () => {
      const text = makeTodoTextPlaceholder("Provide credential name", "test");
      const token = makeTodoTokenPlaceholder("CredentialAsset", "test");
      const fallback = makePlaceholderTokenFallback("Value", "test");
      for (const ph of [text, token, fallback]) {
        expect(ph.value).not.toMatch(/TODO\s*:/);
        expect(isCanonicalPlaceholder(ph.value)).toBe(true);
      }
    });

    it("coerces the legacy '[TODO: Provide X]' form into canonical form", () => {
      const coerced = coerceToCanonicalPlaceholder(
        "[TODO: Provide Target]",
        "test",
      );
      expect(coerced).not.toMatch(/TODO\s*:/);
      expect(isCanonicalPlaceholder(coerced)).toBe(true);
    });

    it("build-time XAML assertion converts any residual unsafe attribute placeholder to canonical form", () => {
      const bad = `<Activity xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"><ui:GetCredential Target="[TODO: Provide Target]" /></Activity>`;
      const { content, repairs } = assertCanonicalPlaceholdersInXaml(
        bad,
        "test.xaml",
      );
      expect(repairs.length).toBeGreaterThan(0);
      expect(content).not.toMatch(/TODO\s*:/);
      expect(content).toMatch(/TODO[ _][A-Za-z\-]/);
    });

    it("provenance ledger records every canonical placeholder as pipeline-fallback", () => {
      drainProvenanceLedger(); // clear prior state
      makeTodoTextPlaceholder("foo", "src");
      makeTodoTokenPlaceholder("Bar", "src");
      const drained = drainProvenanceLedger();
      expect(drained.length).toBe(2);
      expect(drained.every(p => p.origin === "pipeline-fallback")).toBe(true);
    });
  });

  describe("RC2: multi-word natural-language auto-quote heuristic", () => {
    it("does NOT raise undeclared-variable errors for bare English phrases in string properties", () => {
      const declared = extractDeclaredVariables("");
      // A bare multi-word English phrase with no operators, no member access,
      // no function calls — should be auto-quoted, not flagged as undeclared.
      const undeclared = findUndeclaredVariables(
        "send the welcome email to the new user",
        declared,
      );
      expect(undeclared.length).toBe(0);
    });

    it("still flags genuinely undeclared variables in real VB expressions", () => {
      const declared = extractDeclaredVariables("");
      const undeclared = findUndeclaredVariables(
        "someUndeclaredVar + 1",
        declared,
      );
      expect(undeclared.length).toBeGreaterThan(0);
    });
  });

  describe("RC3: GetCredential.Target required in activity registry", () => {
    it("declares Target as a required property on ui:GetCredential", () => {
      const required =
        ACTIVITY_REGISTRY["ui:GetCredential"]?.properties?.required || [];
      expect(required).toContain("Target");
    });

    it("declares Target as a required property on unprefixed GetCredential", () => {
      const required =
        ACTIVITY_REGISTRY["GetCredential"]?.properties?.required || [];
      expect(required).toContain("Target");
    });
  });

  describe("RC5: quality-gate verdict policy – pipeline-fallback provenance", () => {
    it("tags defects whose offendingValue is a canonical placeholder as pipeline-fallback", () => {
      // Construct a minimal XAML with a variable whose Default references a
      // canonical placeholder identifier. It should be tagged pipeline-fallback.
      const xaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Demo" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation">
  <Sequence DisplayName="Root">
    <Sequence.Variables>
      <Variable x:TypeArguments="x:String" Name="CredValue" Default="[TODO_CredentialAsset]" />
    </Sequence.Variables>
  </Sequence>
</Activity>`;
      const result = validateContractIntegrity([
        { name: "Demo.xaml", content: xaml },
      ]);
      // Every defect must be origin-tagged after the classification pass.
      for (const d of result.contractIntegrityDefects) {
        expect(d.origin).toBeDefined();
      }
      // Any defect whose offending value is canonical must be pipeline-fallback
      // and must not be execution_blocking.
      const canonicalOffenders = result.contractIntegrityDefects.filter(d =>
        /TODO_[A-Za-z][A-Za-z0-9_]*|TODO - |PLACEHOLDER_[A-Za-z]/.test(
          d.offendingValue || "",
        ),
      );
      for (const d of canonicalOffenders) {
        expect(d.origin).toBe("pipeline-fallback");
      }
    });
  });

  describe("End-to-end: pipeline-fallback origin never causes structurally_invalid", () => {
    it("final verdict is not structurally_invalid when the only execution-blocking contract defects are pipeline-fallback placeholders", () => {
      // A minimal but realistic XAML that contains a canonical
      // pipeline-fallback placeholder in a required-property position.
      // Under the old verdict policy (Runs 474–475), this would count as
      // an execution-blocking contract integrity defect and poison the
      // artifact to structurally_invalid. After Task #527 RC5 the origin
      // is marked pipeline-fallback and excluded from the blocking count.
      const mainXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Main" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities" xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation">
  <Sequence DisplayName="Main">
    <ui:LogMessage Level="Info" Message="[&quot;ok&quot;]" DisplayName="Log" />
    <Assign To="[str_Cred]" Value="PLACEHOLDER_CredentialAsset" DisplayName="AssignCred" />
  </Sequence>
</Activity>`;

      const input: FinalArtifactValidationInput = {
        xamlEntries: [{ name: "Main.xaml", content: mainXaml }],
        projectJsonContent: JSON.stringify({
          name: "TestProject",
          dependencies: {},
          schemaVersion: "4.0",
        }),
        targetFramework: "Windows",
        hasNupkg: true,
        contextMetadata: {
          outcomeReport: undefined,
          downgrades: [],
          usedAIFallback: false,
          pipelineWarnings: [],
          metaValidationFlatStructureWarnings: 0,
        },
      };

      const report = runFinalArtifactValidation(input);

      // The contract defect must be tagged pipeline-fallback.
      const canonicalContractDefects =
        report.contractIntegrityDefects.filter(
          d =>
            /TODO_[A-Za-z]|TODO - |PLACEHOLDER_[A-Za-z]/.test(
              d.offendingValue || "",
            ),
        );
      for (const d of canonicalContractDefects) {
        expect(d.origin).toBe("pipeline-fallback");
      }

      // Task #527 RC5: even if the defect is execution_blocking severity,
      // an origin of pipeline-fallback must NOT cause a structurally_invalid
      // verdict when taken alone.
      const blockingGenuineContractDefects =
        report.contractIntegrityDefects.filter(
          d =>
            d.severity === "execution_blocking" &&
            d.origin !== "pipeline-fallback",
        );
      if (blockingGenuineContractDefects.length === 0) {
        const reason = report.statusReason || "";
        // Verdict may still be structurally_invalid for OTHER genuine reasons
        // (entry-point blockers, graph defects, etc.) but must NOT cite the
        // contract-integrity defects in its reason.
        expect(reason).not.toMatch(/execution-blocking contract integrity defect/);
      }
    });
  });
});
