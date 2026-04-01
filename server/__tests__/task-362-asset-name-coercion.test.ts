import { describe, it, expect } from "vitest";
import { assembleWorkflowFromSpec } from "../workflow-tree-assembler";
import type { WorkflowSpec } from "../workflow-spec-types";

describe("Task 362: GetAsset with non-string AssetName values", () => {
  it("handles AssetName as a ValueIntent object (literal)", () => {
    const spec: WorkflowSpec = {
      name: "TestValueIntentAsset",
      variables: [],
      arguments: [],
      rootSequence: {
        kind: "sequence",
        displayName: "Main",
        children: [
          {
            kind: "activity",
            template: "GetAsset",
            displayName: "Get My Asset",
            properties: {
              AssetName: { type: "literal", value: "MyAsset" } as any,
              AssetType: "String",
            },
            errorHandling: "none",
          },
        ],
      },
    };

    const result = assembleWorkflowFromSpec(spec);
    expect(result).toBeTruthy();
    expect(result.xaml).toContain("MyAsset");
  });

  it("handles AssetName as a ValueIntent object (variable)", () => {
    const spec: WorkflowSpec = {
      name: "TestValueIntentVariable",
      variables: [{ name: "str_AssetVar", type: "String" }],
      arguments: [],
      rootSequence: {
        kind: "sequence",
        displayName: "Main",
        children: [
          {
            kind: "activity",
            template: "GetAsset",
            displayName: "Get Variable Asset",
            properties: {
              AssetName: { type: "variable", name: "str_AssetVar" } as any,
              AssetType: "String",
            },
            errorHandling: "none",
          },
        ],
      },
    };

    const result = assembleWorkflowFromSpec(spec);
    expect(result).toBeTruthy();
    expect(result.xaml).toBeTruthy();
  });

  it("handles AssetName as null or undefined", () => {
    const spec: WorkflowSpec = {
      name: "TestNullAsset",
      variables: [],
      arguments: [],
      rootSequence: {
        kind: "sequence",
        displayName: "Main",
        children: [
          {
            kind: "activity",
            template: "GetAsset",
            displayName: "Get Null Asset",
            properties: {
              AssetName: null as any,
              AssetType: "String",
            },
            errorHandling: "none",
          },
        ],
      },
    };

    const result = assembleWorkflowFromSpec(spec);
    expect(result).toBeTruthy();
    expect(result.xaml).toContain("str_REVIEW_AssetOutput");
  });

  it("handles AssetName as a number", () => {
    const spec: WorkflowSpec = {
      name: "TestNumberAsset",
      variables: [],
      arguments: [],
      rootSequence: {
        kind: "sequence",
        displayName: "Main",
        children: [
          {
            kind: "activity",
            template: "GetAsset",
            displayName: "Get Number Asset",
            properties: {
              AssetName: 12345 as any,
              AssetType: "String",
            },
            errorHandling: "none",
          },
        ],
      },
    };

    const result = assembleWorkflowFromSpec(spec);
    expect(result).toBeTruthy();
    expect(result.xaml).toBeTruthy();
  });

  it("handles GetRobotAsset with ValueIntent AssetName", () => {
    const spec: WorkflowSpec = {
      name: "TestRobotAsset",
      variables: [],
      arguments: [],
      rootSequence: {
        kind: "sequence",
        displayName: "Main",
        children: [
          {
            kind: "activity",
            template: "GetRobotAsset",
            displayName: "Get Robot Asset",
            properties: {
              AssetName: { type: "literal", value: "RobotConfig" } as any,
              AssetType: "String",
            },
            errorHandling: "none",
          },
        ],
      },
    };

    const result = assembleWorkflowFromSpec(spec);
    expect(result).toBeTruthy();
    expect(result.xaml).toContain("RobotConfig");
  });

  it("handles AssetType as a ValueIntent object", () => {
    const spec: WorkflowSpec = {
      name: "TestValueIntentType",
      variables: [],
      arguments: [],
      rootSequence: {
        kind: "sequence",
        displayName: "Main",
        children: [
          {
            kind: "activity",
            template: "GetAsset",
            displayName: "Get Typed Asset",
            properties: {
              AssetName: { type: "literal", value: "Config.Setting" } as any,
              AssetType: { type: "literal", value: "Int32" } as any,
            },
            errorHandling: "none",
          },
        ],
      },
    };

    const result = assembleWorkflowFromSpec(spec);
    expect(result).toBeTruthy();
    expect(result.xaml).toBeTruthy();
  });
});
