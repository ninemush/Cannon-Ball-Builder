/**
 * Task #560 — Unit tests for spec_merge auto-repair safety net.
 *
 * Coverage:
 *   - Orphan rewire eligibility (named-in-intent / zero-required-In)
 *   - Prune fallback when neither rewire condition is met
 *   - Deterministic missing-required-property fill
 *   - must-be-real-value: never silently defaulted
 *   - LLM call cap enforcement (cap=0 → never reaches LLM)
 *   - Cancellation via AbortSignal
 *   - Repair record schemaVersion + scaffoldOverrunSignal preservation
 */

import { describe, it, expect, vi } from "vitest";
import {
  runSpecMergeRepair,
  SPEC_MERGE_REPAIR_RECORD_SCHEMA_VERSION,
} from "../spec-merge-repair";
import type { TaggedSpecMergeError } from "../spec-graph-validator";
import type { UiPathPackageSpec } from "../types/uipath-package";

function pkg(overrides: Partial<UiPathPackageSpec> = {}): UiPathPackageSpec {
  return {
    projectName: "TestPkg",
    description: "",
    dependencies: [],
    workflows: [
      {
        name: "Main",
        description: "Entry workflow",
        variables: [],
        arguments: [],
        steps: [],
      },
    ],
    ...overrides,
  } as UiPathPackageSpec;
}

function orphanError(workflowName: string): TaggedSpecMergeError {
  return {
    class: "orphan",
    originatedAtStage: "scaffold",
    message: `Workflow ${workflowName} is not invoked from any other workflow`,
    detail: { workflow: workflowName },
  };
}

function missingPropError(
  workflow: string,
  activityType: string,
  property: string,
): TaggedSpecMergeError {
  return {
    class: "missing-required-property",
    originatedAtStage: "detail",
    message: `Activity ${activityType} in ${workflow} is missing required property ${property}`,
    detail: { workflow, activityType, property },
  };
}

describe("spec-merge-repair", () => {
  describe("orphan repair", () => {
    it("rewires a named-in-intent orphan only when its required In args can be bound from entry scope", async () => {
      const p = pkg({
        workflows: [
          { name: "Main", description: "Run ProcessInvoices then finish",
            variables: [{ name: "Required1", type: "String", defaultValue: "", scope: "workflow" }],
            arguments: [], steps: [] },
          { name: "ProcessInvoices", description: "",
            variables: [], arguments: [
              { name: "Required1", direction: "in", type: "String" },
            ], steps: [] },
        ],
      });
      const { repairedPackage, record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [orphanError("ProcessInvoices")],
        llmCallCap: 0,
      });
      expect(record.schemaVersion).toBe(SPEC_MERGE_REPAIR_RECORD_SCHEMA_VERSION);
      expect(record.orphanActions).toHaveLength(1);
      expect(record.orphanActions[0].action).toBe("rewired");
      // ProcessInvoices still present and Main has new InvokeWorkflowFile step
      // with deterministic argument binding to the matching entry-scope variable.
      expect(repairedPackage.workflows.find(w => w.name === "ProcessInvoices")).toBeDefined();
      const main = repairedPackage.workflows.find(w => w.name === "Main")!;
      expect(main.steps).toHaveLength(1);
      expect(main.steps[0].activityType).toBe("InvokeWorkflowFile");
      const props = main.steps[0].properties as any;
      expect(props.WorkflowFileName.value).toBe("ProcessInvoices.xaml");
      const argMap = JSON.parse(props.Arguments.value);
      expect(argMap.Required1).toEqual({ type: "variable", name: "Required1" });
    });

    it("refuses to rewire a named-in-intent orphan when required In args cannot be bound (contract-safety prune)", async () => {
      // Entry scope has NO matching variable/argument for Required1.
      const p = pkg({
        workflows: [
          { name: "Main", description: "Run ProcessInvoices then finish",
            variables: [], arguments: [], steps: [] },
          { name: "ProcessInvoices", description: "",
            variables: [], arguments: [
              { name: "Required1", direction: "in", type: "String" },
            ], steps: [] },
        ],
      });
      const { repairedPackage, record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [orphanError("ProcessInvoices")],
        llmCallCap: 0,
      });
      expect(record.orphanActions[0].action).toBe("pruned");
      expect(record.orphanActions[0].reason).toMatch(/cannot be bound from entry scope/i);
      expect(repairedPackage.workflows.find(w => w.name === "ProcessInvoices")).toBeUndefined();
      const main = repairedPackage.workflows.find(w => w.name === "Main")!;
      expect(main.steps).toHaveLength(0);
    });

    it("rewires an orphan with zero required In args even when not named in intent", async () => {
      const p = pkg({
        workflows: [
          { name: "Main", description: "Generic entry",
            variables: [], arguments: [], steps: [] },
          { name: "HelperA", description: "",
            variables: [], arguments: [], steps: [] },
        ],
      });
      const { record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [orphanError("HelperA")],
        llmCallCap: 0,
      });
      expect(record.orphanActions[0].action).toBe("rewired");
      expect(record.orphanActions[0].reason).toMatch(/zero required In/i);
    });

    it("prunes an orphan that is neither named in intent nor has zero required In args", async () => {
      const p = pkg({
        workflows: [
          { name: "Main", description: "Generic entry",
            variables: [], arguments: [], steps: [] },
          { name: "Mystery", description: "",
            variables: [], arguments: [
              { name: "MustBind", direction: "in", type: "String" },
            ], steps: [] },
        ],
      });
      const { repairedPackage, record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [orphanError("Mystery")],
        llmCallCap: 0,
      });
      expect(record.orphanActions[0].action).toBe("pruned");
      expect(repairedPackage.workflows.find(w => w.name === "Mystery")).toBeUndefined();
    });

    it("preserves scaffold-overrun signal in the repair record", async () => {
      const p = pkg({
        workflows: [
          { name: "Main", description: "Run X and Y",
            variables: [], arguments: [], steps: [] },
          { name: "X", description: "", variables: [], arguments: [], steps: [] },
          { name: "Y", description: "", variables: [], arguments: [], steps: [] },
        ],
      });
      const { record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [orphanError("X"), orphanError("Y")],
        llmCallCap: 0,
      });
      expect(record.scaffoldOverrunSignal.orphansBeforeRepair).toBe(2);
      expect(record.scaffoldOverrunSignal.orphansUnresolved).toBe(0);
    });

    it("reports a missing-required-property error in a pruned workflow as failed (not silently filled)", async () => {
      // Mystery is pruned (named in intent but unsatisfiable required In args
      // — actually here we use the not-named-in-intent + required-args path
      // for a clean prune). The same workflow also has a missing-required-
      // property error queued; after the prune, repair must surface that
      // property error as `failed` with the "workflow not found" reason
      // rather than silently fabricating a value into a now-deleted workflow.
      const p = pkg({
        workflows: [
          { name: "Main", description: "Generic entry",
            variables: [], arguments: [], steps: [] },
          { name: "Mystery", description: "",
            variables: [], arguments: [
              { name: "MustBind", direction: "in", type: "String" },
            ], steps: [{
              activity: "Add Queue Item",
              activityType: "ui:AddQueueItem",
              activityPackage: "UiPath.System.Activities",
              properties: { QueueName: { type: "literal", value: "Q" } },
              selectorHint: null,
              errorHandling: "none",
              notes: "",
            }] },
        ],
      });
      const { repairedPackage, record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [
          orphanError("Mystery"),
          missingPropError("Mystery", "ui:AddQueueItem", "QueueType"),
        ],
        llmCallCap: 0,
      });
      expect(repairedPackage.workflows.find(w => w.name === "Mystery")).toBeUndefined();
      expect(record.orphanActions[0].action).toBe("pruned");
      expect(record.requiredPropertyActions).toHaveLength(1);
      expect(record.requiredPropertyActions[0].action).toBe("failed");
      expect(record.requiredPropertyActions[0].reason).toMatch(/workflow not found/i);
    });
  });

  describe("missing-required-property repair", () => {
    it("fills a deterministic policy default without invoking the LLM", async () => {
      const p = pkg({
        workflows: [{
          name: "Main", description: "Add to queue",
          variables: [], arguments: [],
          steps: [{
            activity: "Add Queue Item",
            activityType: "ui:AddQueueItem",
            activityPackage: "UiPath.System.Activities",
            properties: { QueueName: { type: "literal", value: "MyQueue" } },
            selectorHint: null,
            errorHandling: "none",
            notes: "",
          }],
        }],
      });
      const llmSpy = vi.fn();
      const { repairedPackage, record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [missingPropError("Main", "ui:AddQueueItem", "QueueType")],
        llmCallCap: 3,
        llmOverride: { create: llmSpy as any },
      });
      expect(llmSpy).not.toHaveBeenCalled();
      expect(record.llmCallCount).toBe(0);
      expect(record.requiredPropertyActions[0].action).toBe("filled-default");
      expect(record.requiredPropertyActions[0].source).toBe("deterministic-policy");
      expect(record.requiredPropertyActions[0].nonDeterministic).toBe(false);
      const props = repairedPackage.workflows[0].steps[0].properties as any;
      expect(props.QueueType.value).toBe("Simple");
    });

    it("fails repair for must-be-real-value properties even when the LLM cap is generous (no fabrication)", async () => {
      const p = pkg({
        workflows: [{
          name: "Main", description: "Show form",
          variables: [], arguments: [],
          steps: [{
            activity: "Show Form",
            activityType: "ui:FormActivity",
            activityPackage: "UiPath.Form.Activities",
            properties: {},
            selectorHint: null,
            errorHandling: "none",
            notes: "",
          }],
        }],
      });
      // Even with cap=3 and an LLM that would happily return a value,
      // a must-be-real-value property must be refused (no fabrication).
      const llmSpy = vi.fn().mockResolvedValue({ text: '{"value":"/some/path.json"}', stopReason: "end" });
      const { record, repairedPackage } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [missingPropError("Main", "ui:FormActivity", "FormSchemaPath")],
        llmCallCap: 3,
        llmOverride: { create: llmSpy as any },
      });
      expect(llmSpy).not.toHaveBeenCalled();
      expect(record.llmCallCount).toBe(0);
      expect(record.requiredPropertyActions[0].action).toBe("failed");
      expect(record.requiredPropertyActions[0].source).toBe("deterministic-policy");
      expect(record.requiredPropertyActions[0].nonDeterministic).toBe(false);
      expect(record.requiredPropertyActions[0].reason).toMatch(/refuses to fabricate/i);
      // Property remains absent in the repaired package.
      const props = repairedPackage.workflows[0].steps[0].properties as Record<string, unknown>;
      expect(props.FormSchemaPath).toBeUndefined();
    });

    it("enforces the LLM call cap across multiple unknown properties", async () => {
      const p = pkg({
        workflows: [{
          name: "Main", description: "",
          variables: [], arguments: [],
          steps: [
            { activity: "A", activityType: "ui:Custom1", activityPackage: "UiPath.X",
              properties: {}, selectorHint: null, errorHandling: "none", notes: "" },
            { activity: "B", activityType: "ui:Custom2", activityPackage: "UiPath.X",
              properties: {}, selectorHint: null, errorHandling: "none", notes: "" },
            { activity: "C", activityType: "ui:Custom3", activityPackage: "UiPath.X",
              properties: {}, selectorHint: null, errorHandling: "none", notes: "" },
            { activity: "D", activityType: "ui:Custom4", activityPackage: "UiPath.X",
              properties: {}, selectorHint: null, errorHandling: "none", notes: "" },
          ],
        }],
      });
      const llmSpy = vi.fn().mockResolvedValue({ text: '{"value":"x"}', stopReason: "end" });
      const { record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [
          missingPropError("Main", "ui:Custom1", "PropA"),
          missingPropError("Main", "ui:Custom2", "PropB"),
          missingPropError("Main", "ui:Custom3", "PropC"),
          missingPropError("Main", "ui:Custom4", "PropD"),
        ],
        llmCallCap: 3,
        llmOverride: { create: llmSpy as any },
      });
      expect(llmSpy).toHaveBeenCalledTimes(3);
      expect(record.llmCallCount).toBe(3);
      const filled = record.requiredPropertyActions.filter(a => a.action === "filled-llm").length;
      const failed = record.requiredPropertyActions.filter(a => a.action === "failed").length;
      expect(filled).toBe(3);
      expect(failed).toBe(1);
      expect(record.requiredPropertyActions.find(a => a.action === "failed")?.reason)
        .toMatch(/cap/i);
    });

    it("marks LLM-sourced fills as nonDeterministic", async () => {
      const p = pkg({
        workflows: [{
          name: "Main", description: "",
          variables: [], arguments: [],
          steps: [{
            activity: "X", activityType: "ui:CustomZ", activityPackage: "UiPath.X",
            properties: {}, selectorHint: null, errorHandling: "none", notes: "",
          }],
        }],
      });
      const llmSpy = vi.fn().mockResolvedValue({ text: '{"value":"abc"}', stopReason: "end" });
      const { record } = await runSpecMergeRepair({
        pkg: p,
        taggedErrors: [missingPropError("Main", "ui:CustomZ", "Anything")],
        llmCallCap: 1,
        llmOverride: { create: llmSpy as any },
      });
      expect(record.requiredPropertyActions[0].nonDeterministic).toBe(true);
      expect(record.requiredPropertyActions[0].source).toBe("llm-repair");
    });
  });

  describe("cancellation", () => {
    it("respects an aborted signal before issuing any LLM call", async () => {
      const controller = new AbortController();
      controller.abort();
      const llmSpy = vi.fn();
      const { record } = await runSpecMergeRepair({
        pkg: pkg({
          workflows: [{
            name: "Main", description: "",
            variables: [], arguments: [],
            steps: [{
              activity: "X", activityType: "ui:CustomZ", activityPackage: "UiPath.X",
              properties: {}, selectorHint: null, errorHandling: "none", notes: "",
            }],
          }],
        }),
        taggedErrors: [missingPropError("Main", "ui:CustomZ", "Anything")],
        abortSignal: controller.signal,
        llmCallCap: 3,
        llmOverride: { create: llmSpy as any },
      });
      expect(llmSpy).not.toHaveBeenCalled();
      expect(record.cancelled).toBe(true);
    });
  });

  describe("repair record shape", () => {
    it("emits schemaVersion=1 and unrepairableErrors for unknown classes", async () => {
      const cycle: TaggedSpecMergeError = {
        class: "cycle",
        originatedAtStage: "scaffold",
        message: "Cycle detected: A -> B -> A",
        detail: { cycle: ["A", "B", "A"] },
      };
      const { record } = await runSpecMergeRepair({
        pkg: pkg(),
        taggedErrors: [cycle],
        llmCallCap: 0,
      });
      expect(record.schemaVersion).toBe(1);
      expect(record.unrepairableErrors).toHaveLength(1);
      expect(record.unrepairableErrors[0].class).toBe("cycle");
      expect(record.succeeded).toBe(false);
    });
  });
});
