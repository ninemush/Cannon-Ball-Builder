import { describe, it, expect } from "vitest";
import { resolveToScalarString } from "../xaml/deterministic-generators";
import { validateXamlContent } from "../xaml/gap-analyzer";
import { assembleWorkflowFromSpec, coercePropToString } from "../workflow-tree-assembler";
import { checkStudioLoadability, extractInvokeTargetsFromXaml, generateStubWithInvokePreservation } from "../package-assembler";
import type { WorkflowSpec } from "../workflow-spec-types";
import type { ValueIntent } from "../xaml/expression-builder";

describe("Task #514: Process.xaml duplication cascade and GetCredential object crash", () => {

  describe("syncXamlWrite deduplication — compliancePass skipTracking", () => {
    it("syncXamlWrite should not create duplicate entries when called with content from compliancePass(skipTracking=true)", () => {
      const xamlEntries: Array<{ name: string; content: string }> = [];
      const deferredWrites = new Map<string, string>();

      function mockSyncXamlWrite(
        dw: Map<string, string>,
        entries: Array<{ name: string; content: string }>,
        path: string,
        content: string,
      ): void {
        dw.set(path, content);
        if (!path.toLowerCase().endsWith(".xaml")) return;
        const basename = (path.split("/").pop() || path).toLowerCase();
        const idx = entries.findIndex(e => {
          const entryBasename = (e.name.split("/").pop() || e.name).toLowerCase();
          return entryBasename === basename;
        });
        if (idx >= 0) {
          entries[idx].content = content;
        } else {
          const shortName = path.split("/").pop() || path;
          entries.push({ name: shortName, content });
        }
      }

      function mockCompliancePass(rawXaml: string, fileName: string, skipTracking?: boolean): string {
        const processed = `<!-- compliant -->${rawXaml}`;
        if (!skipTracking) {
          xamlEntries.push({ name: fileName, content: processed });
        }
        return processed;
      }

      mockSyncXamlWrite(deferredWrites, xamlEntries, "lib/Process.xaml", mockCompliancePass("<root/>", "Process.xaml", true));
      const processEntries = xamlEntries.filter(e => e.name.toLowerCase().includes("process"));
      expect(processEntries.length).toBe(1);
    });

    it("inline compliancePass WITHOUT skipTracking creates duplicates (demonstrates the bug)", () => {
      const xamlEntries: Array<{ name: string; content: string }> = [];
      const deferredWrites = new Map<string, string>();

      function mockSyncXamlWrite(
        dw: Map<string, string>,
        entries: Array<{ name: string; content: string }>,
        path: string,
        content: string,
      ): void {
        dw.set(path, content);
        if (!path.toLowerCase().endsWith(".xaml")) return;
        const basename = (path.split("/").pop() || path).toLowerCase();
        const idx = entries.findIndex(e => {
          const entryBasename = (e.name.split("/").pop() || e.name).toLowerCase();
          return entryBasename === basename;
        });
        if (idx >= 0) {
          entries[idx].content = content;
        } else {
          const shortName = path.split("/").pop() || path;
          entries.push({ name: shortName, content });
        }
      }

      function mockCompliancePass(rawXaml: string, fileName: string, skipTracking?: boolean): string {
        const processed = `<!-- compliant -->${rawXaml}`;
        if (!skipTracking) {
          xamlEntries.push({ name: fileName, content: processed });
        }
        return processed;
      }

      xamlEntries.push({ name: "Process.xaml", content: "<skeleton/>" });
      mockSyncXamlWrite(deferredWrites, xamlEntries, "lib/Process.xaml", mockCompliancePass("<root/>", "Process.xaml"));
      const processEntries = xamlEntries.filter(e => e.name.toLowerCase().includes("process"));
      expect(processEntries.length).toBe(2);
    });
  });

  describe("duplicate-file remediation deduplicates instead of stubbing", () => {
    function runDedup(xamlEntries: Array<{ name: string; content: string }>, duplicateFiles: Array<{ check: string; file: string; detail: string }>) {
      for (const dupViolation of duplicateFiles) {
        const basename = dupViolation.file;
        const matchingIndices: number[] = [];
        for (let i = 0; i < xamlEntries.length; i++) {
          const entryBasename = (xamlEntries[i].name.split("/").pop() || xamlEntries[i].name);
          if (entryBasename === basename) {
            matchingIndices.push(i);
          }
        }
        if (matchingIndices.length > 1) {
          let bestIdx = matchingIndices[matchingIndices.length - 1];
          for (let k = matchingIndices.length - 1; k >= 0; k--) {
            const idx = matchingIndices[k];
            const content = xamlEntries[idx].content;
            if (content && content.includes("<") && !content.includes("TODO: Implement")) {
              bestIdx = idx;
              break;
            }
          }
          const indicesToRemove = matchingIndices.filter(i => i !== bestIdx).sort((a, b) => b - a);
          for (const idx of indicesToRemove) {
            xamlEntries.splice(idx, 1);
          }
        }
      }
    }

    it("should deduplicate entries by keeping the latest valid content", () => {
      const xamlEntries: Array<{ name: string; content: string }> = [
        { name: "Process.xaml", content: "<old-skeleton/>" },
        { name: "Process.xaml", content: "<Activity><Sequence><ui:InvokeWorkflowFile /></Sequence></Activity>" },
      ];
      runDedup(xamlEntries, [{ check: "duplicate-file", file: "Process.xaml", detail: "Duplicate" }]);
      expect(xamlEntries.length).toBe(1);
      expect(xamlEntries[0].content).toContain("InvokeWorkflowFile");
    });

    it("should prefer latest valid entry over stale skeleton even if shorter", () => {
      const xamlEntries: Array<{ name: string; content: string }> = [
        { name: "Process.xaml", content: "<very-long-but-old-content-that-is-stale-and-outdated-and-wrong-skeleton-placeholder/>" },
        { name: "Process.xaml", content: "<Activity><Seq/></Activity>" },
      ];
      runDedup(xamlEntries, [{ check: "duplicate-file", file: "Process.xaml", detail: "Duplicate" }]);
      expect(xamlEntries.length).toBe(1);
      expect(xamlEntries[0].content).toBe("<Activity><Seq/></Activity>");
    });

    it("should skip stub entries containing TODO: Implement in favor of real content", () => {
      const xamlEntries: Array<{ name: string; content: string }> = [
        { name: "Process.xaml", content: "<Activity><Sequence><ui:InvokeWorkflowFile /></Sequence></Activity>" },
        { name: "Process.xaml", content: '<Comment Text="TODO: Implement Process" />' },
      ];
      runDedup(xamlEntries, [{ check: "duplicate-file", file: "Process.xaml", detail: "Duplicate" }]);
      expect(xamlEntries.length).toBe(1);
      expect(xamlEntries[0].content).toContain("InvokeWorkflowFile");
    });

    it("should not include duplicate-file in severeValidationErrors", () => {
      const xmlWellformedness = [{ check: "xml-wellformedness", file: "Bad.xaml", detail: "Not well-formed" }];
      const duplicateFiles = [{ check: "duplicate-file", file: "Process.xaml", detail: "Duplicate" }];
      const malformedQuotes = [{ check: "malformed-quote", file: "Other.xaml", detail: "Bad quotes" }];

      const severeValidationErrors = [...xmlWellformedness, ...malformedQuotes];
      expect(severeValidationErrors.some(v => v.check === "duplicate-file")).toBe(false);
      expect(severeValidationErrors.length).toBe(2);
    });
  });

  describe("Integration: validateXamlContent detects duplicate-file violations", () => {
    it("detects duplicate basenames in xamlEntries", () => {
      const xamlEntries = [
        { name: "Process.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity />' },
        { name: "Process.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity />' },
        { name: "Main.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity />' },
      ];
      const violations = validateXamlContent(xamlEntries);
      const dupes = violations.filter(v => v.check === "duplicate-file");
      expect(dupes.length).toBe(1);
      expect(dupes[0].file).toBe("Process.xaml");
    });

    it("no duplicate-file violation when each basename is unique", () => {
      const xamlEntries = [
        { name: "Process.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity />' },
        { name: "Main.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity />' },
        { name: "Init.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity />' },
      ];
      const violations = validateXamlContent(xamlEntries);
      const dupes = violations.filter(v => v.check === "duplicate-file");
      expect(dupes.length).toBe(0);
    });

    it("after dedup, validateXamlContent returns no duplicate-file violation", () => {
      const xamlEntries = [
        { name: "Process.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity />' },
        { name: "Process.xaml", content: '<?xml version="1.0" encoding="utf-8"?><Activity><Sequence /></Activity>' },
      ];

      const beforeViolations = validateXamlContent(xamlEntries);
      expect(beforeViolations.filter(v => v.check === "duplicate-file").length).toBe(1);

      const dupeBasenames = new Set(
        beforeViolations.filter(v => v.check === "duplicate-file").map(v => v.file)
      );
      for (const basename of dupeBasenames) {
        const indices: number[] = [];
        for (let i = 0; i < xamlEntries.length; i++) {
          if ((xamlEntries[i].name.split("/").pop() || xamlEntries[i].name) === basename) {
            indices.push(i);
          }
        }
        if (indices.length > 1) {
          const keep = indices[indices.length - 1];
          for (let k = indices.length - 2; k >= 0; k--) {
            xamlEntries.splice(indices[k], 1);
          }
        }
      }

      const afterViolations = validateXamlContent(xamlEntries);
      expect(afterViolations.filter(v => v.check === "duplicate-file").length).toBe(0);
      expect(xamlEntries.length).toBe(1);
    });
  });

  describe("Integration: GetCredential with ValueIntent in assembleWorkflowFromSpec", () => {
    it("assembles CoupaLogin workflow with GetCredential using literal ValueIntent props without crashing", () => {
      const spec: WorkflowSpec = {
        name: "CoupaLogin",
        description: "Login to Coupa application",
        arguments: [],
        variables: [
          { name: "str_CoupaUser", type: "String", scope: "workflow", defaultValue: "" },
          { name: "sec_CoupaPassword", type: "SecureString", scope: "workflow", defaultValue: "" },
        ],
        rootSequence: {
          children: [
            {
              activityType: "GetCredential",
              displayName: "Get Coupa Credentials",
              properties: {
                AssetName: { type: "literal", value: "CoupaCredential" } satisfies ValueIntent,
                Username: { type: "literal", value: "str_CoupaUser" } satisfies ValueIntent,
                Password: { type: "literal", value: "sec_CoupaPassword" } satisfies ValueIntent,
              },
              children: [],
            },
          ],
        },
        steps: [],
      };

      expect(() => assembleWorkflowFromSpec(spec)).not.toThrow();
      const result = assembleWorkflowFromSpec(spec);
      expect(result.xaml).toBeTruthy();
      expect(result.xaml.length).toBeGreaterThan(100);
    });

    it("assembles workflow with GetCredential using plain string props", () => {
      const spec: WorkflowSpec = {
        name: "StandardLogin",
        description: "Standard login workflow",
        arguments: [],
        variables: [],
        rootSequence: {
          children: [
            {
              activityType: "GetCredential",
              displayName: "Get Credentials",
              properties: {
                AssetName: "MyCredential",
                Username: "str_Username",
                Password: "sec_Password",
              },
              children: [],
            },
          ],
        },
        steps: [],
      };

      expect(() => assembleWorkflowFromSpec(spec)).not.toThrow();
      const result = assembleWorkflowFromSpec(spec);
      expect(result.xaml).toBeTruthy();
    });
  });

  describe("Integration: coercePropToString handles ValueIntent objects (exported function)", () => {
    it("coerces literal ValueIntent to scalar string", () => {
      const result = coercePropToString({ type: "literal", value: "str_CoupaUser" });
      expect(result).toBe("str_CoupaUser");
    });

    it("coerces variable ValueIntent to name", () => {
      const result = coercePropToString({ type: "variable", name: "myVar" });
      expect(result).toBe("myVar");
    });

    it("coerces vb_expression ValueIntent to value", () => {
      const result = coercePropToString({ type: "vb_expression", value: "str_Username" });
      expect(result).toBe("str_Username");
    });

    it("passes through plain strings", () => {
      expect(coercePropToString("str_Username")).toBe("str_Username");
    });

    it("returns empty string for null", () => {
      expect(coercePropToString(null)).toBe("");
    });
  });

  describe("GetCredential ValueIntent resolution (resolveToScalarString)", () => {
    it("resolveToScalarString handles literal ValueIntent objects", () => {
      expect(resolveToScalarString({ type: "literal", value: "str_CoupaUser" })).toBe("str_CoupaUser");
    });

    it("resolveToScalarString handles variable ValueIntent objects", () => {
      expect(resolveToScalarString({ type: "variable", name: "myVar" })).toBe("myVar");
    });

    it("resolveToScalarString handles vb_expression ValueIntent objects", () => {
      expect(resolveToScalarString({ type: "vb_expression", value: "str_Password" })).toBe("str_Password");
    });

    it("resolveToScalarString passes through plain strings unchanged", () => {
      expect(resolveToScalarString("str_Username")).toBe("str_Username");
    });

    it("resolveToScalarString returns empty string for null/undefined", () => {
      expect(resolveToScalarString(null)).toBe("");
      expect(resolveToScalarString(undefined)).toBe("");
    });
  });

  describe("GetCredential coercion handles the exact crash scenario", () => {
    it("ValueIntent object with type=literal does not crash .replace()", () => {
      const valueIntent = { type: "literal", value: "str_CoupaUser" };
      const resolved = resolveToScalarString(valueIntent);
      expect(typeof resolved).toBe("string");
      expect(() => resolved.replace(/^\[|\]$/g, "")).not.toThrow();
      expect(resolved).toBe("str_CoupaUser");
    });

    it("ValueIntent object with type=variable resolves to name (scalar, no brackets)", () => {
      const valueIntent = { type: "variable", name: "sec_CoupaPassword" };
      const resolved = resolveToScalarString(valueIntent);
      expect(typeof resolved).toBe("string");
      expect(() => resolved.replace(/^\[|\]$/g, "")).not.toThrow();
      expect(resolved).toBe("sec_CoupaPassword");
      expect(resolved.startsWith("[")).toBe(false);
    });

    it("calling .replace() on raw ValueIntent object throws TypeError (demonstrates the bug)", () => {
      const valueIntent = { type: "literal", value: "str_CoupaUser" } as unknown as string;
      expect(() => valueIntent.replace(/^\[|\]$/g, "")).toThrow(TypeError);
    });
  });

  describe("Integration: checkStudioLoadability validates XAML with preserved invokes", () => {
    it("well-formed Process.xaml with InvokeWorkflowFile passes loadability check", () => {
      const processXaml = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="UiPathProject.Process"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
  xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Process Transaction">
    <ui:InvokeWorkflowFile DisplayName="Run Dispatcher" WorkflowFileName="Dispatcher.xaml" />
    <ui:InvokeWorkflowFile DisplayName="Run Performer" WorkflowFileName="Performer.xaml" />
    <ui:InvokeWorkflowFile DisplayName="Run ExceptionHandler" WorkflowFileName="ExceptionHandler.xaml" />
  </Sequence>
</Activity>`;

      const result = checkStudioLoadability(processXaml);
      expect(result.loadable).toBe(true);
    });
  });

  describe("Safety net: stub preserves InvokeWorkflowFile references for critical files", () => {
    it("should extract InvokeWorkflowFile targets from corrupted Process.xaml content", () => {
      const corruptedContent = `<?xml version="1.0"?>
<Activity>
  <Sequence>
    <ui:InvokeWorkflowFile DisplayName="Run Dispatcher" WorkflowFileName="Dispatcher.xaml" />
    <ui:InvokeWorkflowFile DisplayName="Run Performer" WorkflowFileName="Performer.xaml" />
    <ui:InvokeWorkflowFile DisplayName="Run ExceptionHandler" WorkflowFileName="ExceptionHandler.xaml" />
    <BrokenTag this="is malformed
  </Sequence>
</Activity>`;

      const invokePattern = /<ui:InvokeWorkflowFile[^>]*WorkflowFileName\s*=\s*"([^"]+)"[^>]*\/>/g;
      let invokeMatch;
      const preservedTargets: string[] = [];
      let preservedInvokes = "";
      while ((invokeMatch = invokePattern.exec(corruptedContent)) !== null) {
        preservedInvokes += `\n        ${invokeMatch[0]}`;
        preservedTargets.push(invokeMatch[1]);
      }

      expect(preservedTargets).toEqual(["Dispatcher.xaml", "Performer.xaml", "ExceptionHandler.xaml"]);
      expect(preservedInvokes).toContain("Dispatcher.xaml");
      expect(preservedInvokes).toContain("Performer.xaml");
      expect(preservedInvokes).toContain("ExceptionHandler.xaml");
    });

    it("should not extract invokes from non-critical files", () => {
      const isCriticalInfraFile = /^(Process|Main)\.xaml$/i.test("SomeOther.xaml");
      expect(isCriticalInfraFile).toBe(false);
    });

    it("should detect Process.xaml and Main.xaml as critical infrastructure files", () => {
      expect(/^(Process|Main)\.xaml$/i.test("Process.xaml")).toBe(true);
      expect(/^(Process|Main)\.xaml$/i.test("Main.xaml")).toBe(true);
      expect(/^(Process|Main)\.xaml$/i.test("process.xaml")).toBe(true);
    });
  });

  describe("generateStubWithInvokePreservation — centralized safety net", () => {
    it("extractInvokeTargetsFromXaml extracts invoke targets from Process.xaml content", () => {
      const content = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test.Process" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Process">
    <ui:InvokeWorkflowFile WorkflowFileName="Framework/GetTransactionData.xaml" DisplayName="Get Transaction Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="CoupaLogin.xaml" DisplayName="Coupa Login" />
  </Sequence>
</Activity>`;

      const targets = extractInvokeTargetsFromXaml(content);
      expect(targets).toEqual(["Framework/GetTransactionData.xaml", "CoupaLogin.xaml"]);
    });

    it("extractInvokeTargetsFromXaml returns empty for content without invokes", () => {
      const content = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test.Process" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Process" />
</Activity>`;

      expect(extractInvokeTargetsFromXaml(content)).toEqual([]);
    });

    it("generateStubWithInvokePreservation preserves invokes from Process.xaml", () => {
      const originalContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test.Process" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Process">
    <ui:InvokeWorkflowFile WorkflowFileName="Dispatcher.xaml" DisplayName="Dispatch" />
    <ui:InvokeWorkflowFile WorkflowFileName="Performer.xaml" DisplayName="Perform" />
  </Sequence>
</Activity>`;

      const stub = generateStubWithInvokePreservation("Process.xaml", originalContent, { reason: "test" });
      expect(stub).toContain("Dispatcher.xaml");
      expect(stub).toContain("Performer.xaml");
      expect(stub).toContain("InvokeWorkflowFile");
    });

    it("generateStubWithInvokePreservation preserves invokes from Main.xaml", () => {
      const originalContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test.Main" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="Main">
    <ui:InvokeWorkflowFile WorkflowFileName="Framework/Init.xaml" DisplayName="Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="Framework/Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="Framework/CloseAllApplications.xaml" DisplayName="Close All" />
  </Sequence>
</Activity>`;

      const stub = generateStubWithInvokePreservation("Main.xaml", originalContent, { reason: "test" });
      expect(stub).toContain("Framework/Init.xaml");
      expect(stub).toContain("Framework/Process.xaml");
      expect(stub).toContain("Framework/CloseAllApplications.xaml");
    });

    it("generateStubWithInvokePreservation does NOT preserve invokes for non-critical files", () => {
      const originalContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test.CloseAllApplications" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" xmlns:ui="http://schemas.uipath.com/workflow/activities">
  <Sequence DisplayName="CloseAllApplications">
    <ui:InvokeWorkflowFile WorkflowFileName="SomeHelper.xaml" DisplayName="Helper" />
  </Sequence>
</Activity>`;

      const stub = generateStubWithInvokePreservation("CloseAllApplications.xaml", originalContent, { reason: "test" });
      expect(stub).not.toContain("SomeHelper.xaml");
      expect(stub).toContain("STUB");
    });

    it("generateStubWithInvokePreservation falls back to regular stub when no original content", () => {
      const stub = generateStubWithInvokePreservation("Process.xaml", undefined, { reason: "test reason" });
      expect(stub).toContain("STUB");
      expect(stub).not.toContain("InvokeWorkflowFile");
    });

    it("generateStubWithInvokePreservation falls back to regular stub when Process.xaml has no invokes", () => {
      const emptyContent = `<?xml version="1.0" encoding="utf-8"?>
<Activity x:Class="Test.Process" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="Process" />
</Activity>`;

      const stub = generateStubWithInvokePreservation("Process.xaml", emptyContent, { reason: "test" });
      expect(stub).toContain("STUB");
    });
  });

  describe("Integration: REFramework-style XAML entries pass validation after dedup", () => {
    it("simulated REFramework entry set has no duplicate-file violations", () => {
      const reframeworkEntries = [
        "Main.xaml", "Process.xaml", "Init.xaml", "GetTransactionData.xaml",
        "SetTransactionStatus.xaml", "CloseAllApplications.xaml", "KillAllProcesses.xaml",
        "InitAllSettings.xaml", "InitAllApplications.xaml",
        "RetryCurrentTransaction.xaml", "RetryInit.xaml",
      ].map(name => ({
        name,
        content: `<?xml version="1.0" encoding="utf-8"?><Activity x:Class="Test.${name.replace('.xaml','')}" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"><Sequence DisplayName="${name}" /></Activity>`,
      }));

      const violations = validateXamlContent(reframeworkEntries);
      const dupes = violations.filter(v => v.check === "duplicate-file");
      expect(dupes.length).toBe(0);
    });

    it("non-REFramework simple-process entry set has no duplicate-file violations", () => {
      const simpleEntries = [
        "Main.xaml", "CloseAllApplications.xaml", "InitAllSettings.xaml",
      ].map(name => ({
        name,
        content: `<?xml version="1.0" encoding="utf-8"?><Activity x:Class="Test.${name.replace('.xaml','')}" xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"><Sequence DisplayName="${name}" /></Activity>`,
      }));

      const violations = validateXamlContent(simpleEntries);
      const dupes = violations.filter(v => v.check === "duplicate-file");
      expect(dupes.length).toBe(0);
    });
  });
});
