import { describe, it, expect, beforeEach } from "vitest";
import {
  traceRequiredPropertyThroughSpec,
  updateTraceAfterPreNormalization,
  updateTraceAfterLowering,
  updateTraceAfterEmission,
  updateTraceAfterCompliance,
  updateTraceAfterEnforcement,
  updateTraceAfterFinalXaml,
  buildDiagnosticsResult,
  detectPropertyNameMismatch,
  resetInstanceCounter,
} from "../required-property-diagnostics";
import { lowerCriticalActivityNode } from "../critical-activity-lowering";
import type { ActivityNode } from "../workflow-spec-types";

const ALL_PACKAGES = new Set([
  "UiPath.GSuite.Activities",
  "UiPath.Mail.Activities",
  "UiPath.System.Activities",
  "UiPath.Persistence.Activities",
  "UiPath.DataService.Activities",
]);

const WINDOWS_PROFILE = {
  studioLine: "StudioX" as const,
  studioVersion: "2024.10",
  targetFramework: "Windows" as const,
  projectType: "Process" as const,
  expressionLanguage: "VisualBasic" as const,
  minimumRequiredPackages: [],
};

beforeEach(() => {
  resetInstanceCounter();
});

describe("Required Property Diagnostics — UpdateEntity.EntityObject", () => {
  it("detects EntityObject as required in the catalog for UpdateEntity", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
      "Update Record",
    );
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject");
    expect(entityObjectTrace).toBeDefined();
    expect(entityObjectTrace!.specStagePresent).toBe(true);
    expect(entityObjectTrace!.specStageValue).toBe("[entityRecord]");
    expect(entityObjectTrace!.specSentinelTriggered).toBe(false);
    expect(entityObjectTrace!.lossStage).toBeNull();
    expect(entityObjectTrace!.lossType).toBeNull();
    expect(entityObjectTrace!.catalogXamlSyntax).toBe("child-element");
    expect(entityObjectTrace!.instanceId).toContain("UpdateEntity");
    expect(entityObjectTrace!.displayName).toBe("Update Record");
  });

  it("flags spec-generation loss when spec uses 'Entity' instead of 'EntityObject'", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", Entity: "[entityRecord]" },
      "Main.xaml",
    );
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject");
    expect(entityObjectTrace).toBeDefined();
    expect(entityObjectTrace!.specStagePresent).toBe(false);
    expect(entityObjectTrace!.lossStage).toBe("spec-generation");
    expect(entityObjectTrace!.rootCauseCategory).toBe("property-absent-at-spec");
  });

  it("detects partial-name-overlap mismatch between Entity and EntityObject", () => {
    const mismatches = detectPropertyNameMismatch("UpdateEntity", ["EntityType", "Entity"]);
    expect(mismatches.length).toBeGreaterThan(0);
    const entityMismatch = mismatches.find(m => m.catalogKey === "EntityObject");
    expect(entityMismatch).toBeDefined();
    expect(entityMismatch!.specKey).toBe("Entity");
    expect(entityMismatch!.mismatchType).toBe("partial-name-overlap");
  });

  it("reports no mismatch when spec uses correct property name EntityObject", () => {
    const mismatches = detectPropertyNameMismatch("UpdateEntity", ["EntityType", "EntityObject"]);
    expect(mismatches.length).toBe(0);
  });
});

describe("Required Property Diagnostics — CreateEntity.EntityObject", () => {
  it("detects EntityObject as required for CreateEntity", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "CreateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
    );
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject");
    expect(entityObjectTrace).toBeDefined();
    expect(entityObjectTrace!.specStagePresent).toBe(true);
    expect(entityObjectTrace!.lossStage).toBeNull();
  });

  it("flags loss when spec uses 'Entity' instead of 'EntityObject' for CreateEntity", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "CreateEntity",
      { EntityType: "[str_EntityName]", Entity: "[entityRecord]" },
      "Main.xaml",
    );
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject");
    expect(entityObjectTrace).toBeDefined();
    expect(entityObjectTrace!.specStagePresent).toBe(false);
    expect(entityObjectTrace!.lossStage).toBe("spec-generation");
  });
});

describe("Required Property Diagnostics — GmailSendMessage.Body", () => {
  it("marks Body as present when provided in spec", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "recipient@test.com", Subject: "Test", Body: "Hello World" },
      "Main.xaml",
    );
    const bodyTrace = traces.find(t => t.requiredProperty === "Body");
    expect(bodyTrace).toBeDefined();
    expect(bodyTrace!.specStagePresent).toBe(true);
    expect(bodyTrace!.specStageValue).toBe("Hello World");
    expect(bodyTrace!.lossStage).toBeNull();
    expect(bodyTrace!.catalogXamlSyntax).toBe("child-element");
  });

  it("marks Body as absent when not in spec", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "recipient@test.com", Subject: "Test" },
      "Main.xaml",
    );
    const bodyTrace = traces.find(t => t.requiredProperty === "Body");
    expect(bodyTrace).toBeDefined();
    expect(bodyTrace!.specStagePresent).toBe(false);
    expect(bodyTrace!.lossStage).toBe("spec-generation");
    expect(bodyTrace!.rootCauseCategory).toBe("property-absent-at-spec");
  });

  it("marks Body as placeholder when set to PLACEHOLDER_Body", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "recipient@test.com", Subject: "Test", Body: "PLACEHOLDER_Body" },
      "Main.xaml",
    );
    const bodyTrace = traces.find(t => t.requiredProperty === "Body");
    expect(bodyTrace).toBeDefined();
    expect(bodyTrace!.specStagePresent).toBe(false);
    expect(bodyTrace!.specSentinelTriggered).toBe(true);
    expect(bodyTrace!.rootCauseCategory).toBe("placeholder-value");
    expect(bodyTrace!.lossType).toBe("value-loss");
  });
});

describe("Required Property Diagnostics — GmailSendMessage.Body evidence-backed trace", () => {
  it("traces Body through full pipeline when present: spec → lowering → emission → compliance → enforcer → final", () => {
    const node: ActivityNode = {
      template: "GmailSendMessage",
      displayName: "Send Welcome Email",
      properties: {
        To: "user@example.com",
        Subject: "Welcome",
        Body: "Hello and welcome!",
      },
    };
    const traces = traceRequiredPropertyThroughSpec("GmailSendMessage", node.properties!, "Main.xaml", node.displayName);
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.specStagePresent).toBe(true);
    expect(bodyTrace.specSentinelTriggered).toBe(false);

    const lowerResult = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(lowerResult.contractSatisfied).toBe(true);

    updateTraceAfterPreNormalization(traces, node.properties!);
    updateTraceAfterLowering(traces, lowerResult.loweringOutcome, lowerResult.missingRequiredProperties);
    expect(bodyTrace.emissionGateDecision).toBe("accept");
    expect(bodyTrace.loweringStagePresent).toBe(true);

    const emittedXaml = `<ugs:GmailSendMessage DisplayName="Send Welcome Email" IsBodyHtml="False" To="[user@example.com]" Subject="[Welcome]">
  <ugs:GmailSendMessage.Body><InArgument x:TypeArguments="x:String">[Hello and welcome!]</InArgument></ugs:GmailSendMessage.Body>
</ugs:GmailSendMessage>`;
    updateTraceAfterEmission(traces, emittedXaml, "ugs:GmailSendMessage");
    expect(bodyTrace.emissionStagePresent).toBe(true);
    expect(bodyTrace.emissionStageForm).toBe("child-element");

    updateTraceAfterCompliance(traces, emittedXaml, "ugs:GmailSendMessage");
    expect(bodyTrace.complianceStagePresent).toBe(true);

    updateTraceAfterEnforcement(traces, [], []);
    expect(bodyTrace.enforcerStagePresent).toBe(true);
    expect(bodyTrace.enforcerStageOutcome).toBe("already-present");

    updateTraceAfterFinalXaml(traces, emittedXaml, "ugs:GmailSendMessage");
    expect(bodyTrace.finalXamlStagePresent).toBe(true);

    const result = buildDiagnosticsResult(traces);
    expect(result.summary.totalLost).toBe(0);
    expect(result.summary.totalPreserved).toBe(3);
    expect(bodyTrace.lossStage).toBeNull();
    expect(bodyTrace.lossType).toBeNull();
  });

  it("traces Body loss when absent from spec: identifies spec-generation as loss stage", () => {
    const node: ActivityNode = {
      template: "GmailSendMessage",
      displayName: "Send Email No Body",
      properties: {
        To: "user@example.com",
        Subject: "Subject Only",
      },
    };
    const traces = traceRequiredPropertyThroughSpec("GmailSendMessage", node.properties!, "Main.xaml", node.displayName);
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.specStagePresent).toBe(false);
    expect(bodyTrace.lossStage).toBe("spec-generation");
    expect(bodyTrace.lossType).toBe("value-loss");
    expect(bodyTrace.rootCauseCategory).toBe("property-absent-at-spec");

    const lowerResult = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(lowerResult.contractSatisfied).toBe(false);
    expect(lowerResult.missingRequiredProperties).toContain("Body");

    updateTraceAfterLowering(traces, lowerResult.loweringOutcome, lowerResult.missingRequiredProperties);
    expect(bodyTrace.emissionGateDecision).toBe("block");
    expect(bodyTrace.lossStage).toBe("spec-generation");
  });

  it("traces Body sentinel path: placeholder triggers enforcement resolution", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "user@example.com", Subject: "Test", Body: "PLACEHOLDER_Body" },
      "Main.xaml",
      "Send With Placeholder",
    );
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.specSentinelTriggered).toBe(true);
    expect(bodyTrace.specStagePresent).toBe(false);
    expect(bodyTrace.lossStage).toBe("spec-generation");

    updateTraceAfterEnforcement(
      traces,
      [{ activityType: "GmailSendMessage", propertyName: "Body", displayName: "Send With Placeholder" }],
      [],
    );
    expect(bodyTrace.enforcerStagePresent).toBe(true);
    expect(bodyTrace.enforcerStageOutcome).toBe("bound");
    expect(bodyTrace.enforcerSentinelResolved).toBe(true);
  });
});

describe("Required Property Diagnostics — Full Pipeline Stage Tracing", () => {
  it("traces property through all stages: spec → pre-norm → lowering → emission → compliance → enforcer → final", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "test@example.com", Subject: "Sub", Body: "Content" },
      "Main.xaml",
      "Send Email",
    );
    expect(traces.every(t => t.specStagePresent)).toBe(true);
    expect(traces.every(t => t.preNormalizationStagePresent)).toBe(true);

    updateTraceAfterPreNormalization(traces, { To: "test@example.com", Subject: "Sub", Body: "Content" });
    expect(traces.every(t => t.preNormalizationStagePresent)).toBe(true);

    updateTraceAfterLowering(traces, "lowered", []);
    expect(traces.every(t => t.loweringStagePresent)).toBe(true);
    expect(traces.every(t => t.loweringStageOutcome === "lowered")).toBe(true);
    expect(traces.every(t => t.emissionGateDecision === "accept")).toBe(true);

    const emittedXaml = `<ugs:GmailSendMessage DisplayName="Send Email" IsBodyHtml="False" To="[test@example.com]" Subject="[Sub]">
  <ugs:GmailSendMessage.Body><InArgument x:TypeArguments="x:String">[Content]</InArgument></ugs:GmailSendMessage.Body>
</ugs:GmailSendMessage>`;
    updateTraceAfterEmission(traces, emittedXaml, "ugs:GmailSendMessage");
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.emissionStagePresent).toBe(true);
    expect(bodyTrace.emissionStageForm).toBe("child-element");

    updateTraceAfterCompliance(traces, emittedXaml, "ugs:GmailSendMessage");
    expect(bodyTrace.complianceStagePresent).toBe(true);

    updateTraceAfterEnforcement(traces, [], []);
    expect(bodyTrace.enforcerStagePresent).toBe(true);
    expect(bodyTrace.enforcerStageOutcome).toBe("already-present");

    updateTraceAfterFinalXaml(traces, emittedXaml, "ugs:GmailSendMessage");
    expect(bodyTrace.finalXamlStagePresent).toBe(true);

    const result = buildDiagnosticsResult(traces);
    expect(result.summary.totalLost).toBe(0);
    expect(result.summary.totalPreserved).toBe(3);
    expect(result.summary.totalShapeChanged).toBe(0);
    expect(traces.every(t => t.lossStage === null)).toBe(true);
    expect(traces.every(t => t.shapeChangeStage === null)).toBe(true);
  });

  it("detects pre-normalization loss when property stripped during normalization", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "test@example.com", Subject: "Sub", Body: "Content" },
      "Main.xaml",
    );
    updateTraceAfterPreNormalization(traces, { To: "test@example.com", Subject: "Sub" });
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.preNormalizationStagePresent).toBe(false);
    expect(bodyTrace.lossStage).toBe("pre-lowering-normalization");
    expect(bodyTrace.rootCauseCategory).toBe("normalization-loss");
  });

  it("detects lowering-stage loss when property present in spec but flagged missing", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "test@example.com", Subject: "Sub", Body: "Content" },
      "Main.xaml",
    );
    updateTraceAfterLowering(traces, "rejected_incomplete_contract", ["Body"]);
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.loweringStagePresent).toBe(false);
    expect(bodyTrace.emissionGateDecision).toBe("block");
    expect(bodyTrace.lossStage).toBe("critical-activity-lowering");
    expect(bodyTrace.lossType).toBe("value-loss");
    expect(bodyTrace.rootCauseCategory).toBe("lowering-rejected-incomplete");
  });

  it("detects emission-stage loss when property survived lowering but not emitted", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
      "Update Record",
    );
    updateTraceAfterLowering(traces, "lowered", []);
    updateTraceAfterEmission(traces, `<ui:UpdateEntity DisplayName="Update Record" EntityType="[str_EntityName]" />`, "ui:UpdateEntity");
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject")!;
    expect(entityObjectTrace.emissionStagePresent).toBe(false);
    expect(entityObjectTrace.emissionStageForm).toBe("absent");
    expect(entityObjectTrace.lossStage).toBe("workflow-tree-assembler");
    expect(entityObjectTrace.rootCauseCategory).toBe("emission-shape-loss");
  });

  it("detects compliance-stage loss when emitted property stripped by compliance", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "test@example.com", Subject: "Sub", Body: "Content" },
      "Main.xaml",
      "Send Email",
    );
    updateTraceAfterLowering(traces, "lowered", []);
    const fullXaml = `<ugs:GmailSendMessage DisplayName="Send Email">
  <ugs:GmailSendMessage.Body><InArgument x:TypeArguments="x:String">[Content]</InArgument></ugs:GmailSendMessage.Body>
</ugs:GmailSendMessage>`;
    updateTraceAfterEmission(traces, fullXaml, "ugs:GmailSendMessage");
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.emissionStagePresent).toBe(true);

    const strippedXaml = `<ugs:GmailSendMessage DisplayName="Send Email" />`;
    updateTraceAfterCompliance(traces, strippedXaml, "ugs:GmailSendMessage");
    expect(bodyTrace.complianceStagePresent).toBe(false);
    expect(bodyTrace.lossStage).toBe("xaml-compliance");
    expect(bodyTrace.rootCauseCategory).toBe("compliance-stripping");
  });

  it("detects child-element emission form for EntityObject", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
      "Update Record",
    );
    updateTraceAfterLowering(traces, "lowered", []);
    const xaml = `<ui:UpdateEntity DisplayName="Update Record" EntityType="[str_EntityName]">
  <ui:UpdateEntity.EntityObject>
    <InArgument x:TypeArguments="x:Object">[entityRecord]</InArgument>
  </ui:UpdateEntity.EntityObject>
</ui:UpdateEntity>`;
    updateTraceAfterEmission(traces, xaml, "ui:UpdateEntity");
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject")!;
    expect(entityObjectTrace.emissionStagePresent).toBe(true);
    expect(entityObjectTrace.emissionStageForm).toBe("child-element");
    expect(entityObjectTrace.lossStage).toBeNull();
    expect(entityObjectTrace.shapeChangeStage).toBeNull();
  });

  it("detects shape change when child-element emitted as attribute", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
      "Update Record",
    );
    updateTraceAfterLowering(traces, "lowered", []);
    const xamlWithAttr = `<ui:UpdateEntity DisplayName="Update Record" EntityType="[str_EntityName]" EntityObject="[entityRecord]" />`;
    updateTraceAfterEmission(traces, xamlWithAttr, "ui:UpdateEntity");
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject")!;
    expect(entityObjectTrace.emissionStagePresent).toBe(true);
    expect(entityObjectTrace.emissionStageForm).toBe("attribute");
    expect(entityObjectTrace.catalogXamlSyntax).toBe("child-element");
    expect(entityObjectTrace.shapeChangeStage).toBe("workflow-tree-assembler");
  });

  it("detects enforcer-stage binding", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "test@example.com", Subject: "Sub", Body: "Content" },
      "Main.xaml",
    );
    updateTraceAfterLowering(traces, "lowered", []);
    const xaml = `<ugs:GmailSendMessage DisplayName="GmailSendMessage">
  <ugs:GmailSendMessage.Body>
    <InArgument x:TypeArguments="x:String">[str_EmailBody]</InArgument>
  </ugs:GmailSendMessage.Body>
</ugs:GmailSendMessage>`;
    updateTraceAfterEmission(traces, xaml, "ugs:GmailSendMessage");
    updateTraceAfterEnforcement(
      traces,
      [{ activityType: "GmailSendMessage", propertyName: "Body" }],
      [],
    );
    const bodyTrace = traces.find(t => t.requiredProperty === "Body")!;
    expect(bodyTrace.enforcerStagePresent).toBe(true);
    expect(bodyTrace.enforcerStageOutcome).toBe("bound");
  });
});

describe("Required Property Diagnostics — Instance-safe tracing", () => {
  it("generates unique instance IDs for different activity instances", () => {
    const traces1 = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "a@test.com", Subject: "S1", Body: "B1" },
      "Main.xaml",
      "Send Email 1",
    );
    const traces2 = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "b@test.com", Subject: "S2", Body: "B2" },
      "Main.xaml",
      "Send Email 2",
    );
    const allInstanceIds = [...traces1, ...traces2].map(t => t.instanceId);
    const uniqueIds = new Set(allInstanceIds);
    expect(uniqueIds.size).toBe(allInstanceIds.length);
  });

  it("scopes enforcement attribution to specific display name instance", () => {
    const traces1 = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "a@test.com", Subject: "S1", Body: "B1" },
      "Main.xaml",
      "Send Welcome Email",
    );
    const traces2 = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "b@test.com", Subject: "S2", Body: "B2" },
      "Main.xaml",
      "Send Goodbye Email",
    );
    updateTraceAfterLowering(traces1, "lowered", []);
    updateTraceAfterLowering(traces2, "lowered", []);

    updateTraceAfterEnforcement(
      [...traces1, ...traces2],
      [{ activityType: "GmailSendMessage", propertyName: "Body", displayName: "Send Welcome Email" }],
      [{ activityType: "GmailSendMessage", propertyName: "Body", displayName: "Send Goodbye Email" }],
    );

    const body1 = traces1.find(t => t.requiredProperty === "Body")!;
    expect(body1.enforcerStagePresent).toBe(true);
    expect(body1.enforcerStageOutcome).toBe("bound");

    const body2 = traces2.find(t => t.requiredProperty === "Body")!;
    expect(body2.enforcerStagePresent).toBe(false);
    expect(body2.enforcerStageOutcome).toBe("defect");
  });

  it("scopes emission detection to specific display name instance", () => {
    const traces1 = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "a@test.com", Subject: "S1", Body: "B1" },
      "Main.xaml",
      "Send Welcome Email",
    );
    const traces2 = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "b@test.com", Subject: "S2" },
      "Main.xaml",
      "Send Goodbye Email",
    );
    updateTraceAfterLowering(traces1, "lowered", []);
    updateTraceAfterLowering(traces2, "lowered", ["Body"]);

    const xaml = `<ugs:GmailSendMessage DisplayName="Send Welcome Email" IsBodyHtml="False">
  <ugs:GmailSendMessage.Body><InArgument x:TypeArguments="x:String">[B1]</InArgument></ugs:GmailSendMessage.Body>
</ugs:GmailSendMessage>
<ugs:GmailSendMessage DisplayName="Send Goodbye Email" IsBodyHtml="False">
</ugs:GmailSendMessage>`;

    updateTraceAfterEmission(traces1, xaml, "ugs:GmailSendMessage");
    updateTraceAfterEmission(traces2, xaml, "ugs:GmailSendMessage");

    const body1 = traces1.find(t => t.requiredProperty === "Body")!;
    expect(body1.emissionStagePresent).toBe(true);

    const body2 = traces2.find(t => t.requiredProperty === "Body")!;
    expect(body2.emissionStagePresent).toBe(false);
  });
});

describe("Required Property Diagnostics — buildDiagnosticsResult", () => {
  it("produces correct summary with mixed preserved/lost/shape-changed properties", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "test@example.com", Subject: "Sub" },
      "Main.xaml",
    );
    const result = buildDiagnosticsResult(traces);
    expect(result.summary.totalTracked).toBe(3);
    expect(result.summary.totalPreserved).toBe(2);
    expect(result.summary.totalLost).toBe(1);
    expect(result.summary.lossStageBreakdown["spec-generation"]).toBe(1);
    expect(result.summary.totalShapeChanged).toBe(0);
  });

  it("produces empty loss breakdown when all properties present", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "test@example.com", Subject: "Sub", Body: "Content" },
      "Main.xaml",
    );
    const result = buildDiagnosticsResult(traces);
    expect(result.summary.totalLost).toBe(0);
    expect(Object.keys(result.summary.lossStageBreakdown)).toHaveLength(0);
  });

  it("tracks shape changes in summary", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
      "Update",
    );
    updateTraceAfterLowering(traces, "lowered", []);
    updateTraceAfterEmission(
      traces,
      `<ui:UpdateEntity DisplayName="Update" EntityType="[str_EntityName]" EntityObject="[entityRecord]" />`,
      "ui:UpdateEntity",
    );
    const result = buildDiagnosticsResult(traces);
    expect(result.summary.totalShapeChanged).toBe(1);
    expect(result.summary.shapeChangeStageBreakdown["workflow-tree-assembler"]).toBe(1);
  });
});

describe("Required Property Diagnostics — xaml-generator Entity→EntityObject fix verification", () => {
  it("verifies xaml-generator source uses EntityObject (not Entity) for UpdateEntity", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const generatorPath = path.resolve(__dirname, "..", "xaml-generator.ts");
    const source = fs.readFileSync(generatorPath, "utf-8");

    const updateEntitySection = source.match(/activity:\s*"UpdateEntity"[\s\S]*?properties:\s*\{([^}]+)\}/);
    expect(updateEntitySection).not.toBeNull();
    const propsBlock = updateEntitySection![1];
    expect(propsBlock).toContain("EntityObject");
    expect(propsBlock).not.toMatch(/\bEntity\b(?!Object|Type)/);
  });

  it("verifies xaml-generator source uses EntityObject (not Entity) for CreateEntity", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const generatorPath = path.resolve(__dirname, "..", "xaml-generator.ts");
    const source = fs.readFileSync(generatorPath, "utf-8");

    const createEntitySection = source.match(/activity:\s*"CreateEntity"[\s\S]*?properties:\s*\{([^}]+)\}/);
    expect(createEntitySection).not.toBeNull();
    const propsBlock = createEntitySection![1];
    expect(propsBlock).toContain("EntityObject");
    expect(propsBlock).not.toMatch(/\bEntity\b(?!Object|Type)/);
  });

  it("confirms catalog and generator agree on required property names for UpdateEntity", () => {
    const specProps = { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" };
    const traces = traceRequiredPropertyThroughSpec("UpdateEntity", specProps, "Main.xaml");
    const mismatches = detectPropertyNameMismatch("UpdateEntity", Object.keys(specProps));
    expect(mismatches.length).toBe(0);
    expect(traces.every(t => t.specStagePresent)).toBe(true);
    expect(traces.every(t => t.lossStage === null)).toBe(true);
  });

  it("confirms catalog and generator agree on required property names for CreateEntity", () => {
    const specProps = { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" };
    const traces = traceRequiredPropertyThroughSpec("CreateEntity", specProps, "Main.xaml");
    const mismatches = detectPropertyNameMismatch("CreateEntity", Object.keys(specProps));
    expect(mismatches.length).toBe(0);
    expect(traces.every(t => t.specStagePresent)).toBe(true);
    expect(traces.every(t => t.lossStage === null)).toBe(true);
  });
});

describe("Required Property Diagnostics — pre-normalization integration", () => {
  it("updateTraceAfterPreNormalization detects property that was present in spec but removed during normalization", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
      "Update Record",
    );
    expect(traces.every(t => t.preNormalizationStagePresent)).toBe(true);

    updateTraceAfterPreNormalization(traces, { EntityType: "[str_EntityName]" });
    const entityObjectTrace = traces.find(t => t.requiredProperty === "EntityObject")!;
    expect(entityObjectTrace.preNormalizationStagePresent).toBe(false);
    expect(entityObjectTrace.lossStage).toBe("pre-lowering-normalization");
    expect(entityObjectTrace.rootCauseCategory).toBe("normalization-loss");

    const entityTypeTrace = traces.find(t => t.requiredProperty === "EntityType")!;
    expect(entityTypeTrace.preNormalizationStagePresent).toBe(true);
    expect(entityTypeTrace.lossStage).toBeNull();
  });

  it("updateTraceAfterPreNormalization with all properties intact does not set loss", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
    );
    updateTraceAfterPreNormalization(traces, { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" });
    expect(traces.every(t => t.preNormalizationStagePresent)).toBe(true);
    expect(traces.every(t => t.lossStage === null)).toBe(true);
  });
});

describe("Required Property Diagnostics — no parallel framework", () => {
  it("extends existing catalog infrastructure without duplicating property definitions", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "UpdateEntity",
      { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" },
      "Main.xaml",
    );
    expect(traces.every(t => t.activityType === "UpdateEntity")).toBe(true);
    const requiredProps = traces.map(t => t.requiredProperty);
    expect(requiredProps).toContain("EntityType");
    expect(requiredProps).toContain("EntityObject");
    expect(requiredProps.length).toBe(2);
  });

  it("reuses catalog definitions for GmailSendMessage required properties", () => {
    const traces = traceRequiredPropertyThroughSpec(
      "GmailSendMessage",
      { To: "a", Subject: "b", Body: "c" },
      "Main.xaml",
    );
    const requiredProps = traces.map(t => t.requiredProperty);
    expect(requiredProps).toContain("To");
    expect(requiredProps).toContain("Subject");
    expect(requiredProps).toContain("Body");
    expect(requiredProps.length).toBe(3);
  });
});

describe("Required Property Diagnostics — Integration with lowerCriticalActivityNode", () => {
  it("UpdateEntity with correct EntityObject passes lowering without missing properties", () => {
    const node: ActivityNode = {
      template: "UpdateEntity",
      displayName: "Update Record",
      properties: {
        EntityType: "[str_EntityName]",
        EntityObject: "[entityRecord]",
      },
    };
    const result = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.contractSatisfied).toBe(true);
    expect(result.missingRequiredProperties).toHaveLength(0);
    expect(result.loweringOutcome).toBe("lowered");

    const traces = traceRequiredPropertyThroughSpec("UpdateEntity", node.properties!, "Main.xaml", node.displayName);
    updateTraceAfterLowering(traces, result.loweringOutcome, result.missingRequiredProperties);
    const diagnostics = buildDiagnosticsResult(traces);
    expect(diagnostics.summary.totalLost).toBe(0);
  });

  it("UpdateEntity with old Entity key (pre-fix) fails lowering with EntityObject missing", () => {
    const node: ActivityNode = {
      template: "UpdateEntity",
      displayName: "Update Record",
      properties: {
        EntityType: "[str_EntityName]",
        Entity: "[entityRecord]",
      },
    };
    const result = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.contractSatisfied).toBe(false);
    expect(result.missingRequiredProperties).toContain("EntityObject");
    expect(result.loweringOutcome).toBe("rejected_incomplete_contract");

    const traces = traceRequiredPropertyThroughSpec("UpdateEntity", node.properties!, "Main.xaml", node.displayName);
    updateTraceAfterLowering(traces, result.loweringOutcome, result.missingRequiredProperties);
    const diagnostics = buildDiagnosticsResult(traces);
    expect(diagnostics.summary.totalLost).toBeGreaterThan(0);
    const entityObjectTrace = diagnostics.traces.find(t => t.requiredProperty === "EntityObject");
    expect(entityObjectTrace!.lossStage).toBe("spec-generation");
  });

  it("GmailSendMessage with all required properties passes lowering", () => {
    const node: ActivityNode = {
      template: "GmailSendMessage",
      displayName: "Send Email",
      properties: {
        To: "user@example.com",
        Subject: "Hello",
        Body: "Email body content",
      },
    };
    const result = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.contractSatisfied).toBe(true);
    expect(result.missingRequiredProperties).toHaveLength(0);
    expect(result.loweringOutcome).toBe("lowered");

    const traces = traceRequiredPropertyThroughSpec("GmailSendMessage", node.properties!, "Main.xaml", node.displayName);
    updateTraceAfterLowering(traces, result.loweringOutcome, result.missingRequiredProperties);
    const diagnostics = buildDiagnosticsResult(traces);
    expect(diagnostics.summary.totalLost).toBe(0);
    expect(diagnostics.summary.totalPreserved).toBe(3);
  });

  it("GmailSendMessage without Body fails lowering and diagnostics identify loss stage", () => {
    const node: ActivityNode = {
      template: "GmailSendMessage",
      displayName: "Send Email",
      properties: {
        To: "user@example.com",
        Subject: "Hello",
      },
    };
    const result = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.contractSatisfied).toBe(false);
    expect(result.missingRequiredProperties).toContain("Body");

    const traces = traceRequiredPropertyThroughSpec("GmailSendMessage", node.properties!, "Main.xaml", node.displayName);
    updateTraceAfterLowering(traces, result.loweringOutcome, result.missingRequiredProperties);
    const diagnostics = buildDiagnosticsResult(traces);
    const bodyTrace = diagnostics.traces.find(t => t.requiredProperty === "Body");
    expect(bodyTrace!.lossStage).toBe("spec-generation");
    expect(bodyTrace!.rootCauseCategory).toBe("property-absent-at-spec");
  });

  it("CreateEntity with correct EntityObject passes lowering", () => {
    const node: ActivityNode = {
      template: "CreateEntity",
      displayName: "Create Record",
      properties: {
        EntityType: "[str_EntityName]",
        EntityObject: "[entityRecord]",
      },
    };
    const result = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(result.contractSatisfied).toBe(true);
    expect(result.missingRequiredProperties).toHaveLength(0);
    expect(result.loweringOutcome).toBe("lowered");
  });
});

describe("Required Property Diagnostics — End-to-end preservation (UpdateEntity EntityObject fix)", () => {
  it("proves EntityObject survives spec → lowering → emission → compliance → enforcer → final with correct key", () => {
    const specProps = { EntityType: "[str_EntityName]", EntityObject: "[entityRecord]" };
    const traces = traceRequiredPropertyThroughSpec("UpdateEntity", specProps, "Main.xaml", "Update Customer");

    const node: ActivityNode = {
      template: "UpdateEntity",
      displayName: "Update Customer",
      properties: specProps,
    };
    const lowerResult = lowerCriticalActivityNode(node, "Main.xaml", "Main", WINDOWS_PROFILE, ALL_PACKAGES);
    expect(lowerResult.loweringOutcome).toBe("lowered");
    expect(lowerResult.missingRequiredProperties).toHaveLength(0);

    updateTraceAfterPreNormalization(traces, specProps);
    updateTraceAfterLowering(traces, lowerResult.loweringOutcome, lowerResult.missingRequiredProperties);

    const emittedXaml = `<ui:UpdateEntity DisplayName="Update Customer" EntityType="[str_EntityName]">
  <ui:UpdateEntity.EntityObject>
    <InArgument x:TypeArguments="x:Object">[entityRecord]</InArgument>
  </ui:UpdateEntity.EntityObject>
</ui:UpdateEntity>`;
    updateTraceAfterEmission(traces, emittedXaml, "ui:UpdateEntity");
    updateTraceAfterCompliance(traces, emittedXaml, "ui:UpdateEntity");
    updateTraceAfterEnforcement(traces, [], []);
    updateTraceAfterFinalXaml(traces, emittedXaml, "ui:UpdateEntity");

    const diagnostics = buildDiagnosticsResult(traces);
    expect(diagnostics.summary.totalLost).toBe(0);
    expect(diagnostics.summary.totalPreserved).toBe(2);

    const entityObjectTrace = diagnostics.traces.find(t => t.requiredProperty === "EntityObject")!;
    expect(entityObjectTrace.specStagePresent).toBe(true);
    expect(entityObjectTrace.preNormalizationStagePresent).toBe(true);
    expect(entityObjectTrace.loweringStagePresent).toBe(true);
    expect(entityObjectTrace.emissionStagePresent).toBe(true);
    expect(entityObjectTrace.emissionStageForm).toBe("child-element");
    expect(entityObjectTrace.complianceStagePresent).toBe(true);
    expect(entityObjectTrace.enforcerStagePresent).toBe(true);
    expect(entityObjectTrace.finalXamlStagePresent).toBe(true);
    expect(entityObjectTrace.lossStage).toBeNull();
    expect(entityObjectTrace.shapeChangeStage).toBeNull();
  });

  it("proves old Entity key (pre-fix) would cause spec-generation loss", () => {
    const oldSpecProps = { EntityType: "[str_EntityName]", Entity: "[entityRecord]" };
    const traces = traceRequiredPropertyThroughSpec("UpdateEntity", oldSpecProps, "Main.xaml", "Update Customer");

    const diagnostics = buildDiagnosticsResult(traces);
    expect(diagnostics.summary.totalLost).toBe(1);
    const entityObjectTrace = diagnostics.traces.find(t => t.requiredProperty === "EntityObject")!;
    expect(entityObjectTrace.lossStage).toBe("spec-generation");
    expect(entityObjectTrace.rootCauseCategory).toBe("property-absent-at-spec");

    const mismatches = detectPropertyNameMismatch("UpdateEntity", Object.keys(oldSpecProps));
    const mismatch = mismatches.find(m => m.catalogKey === "EntityObject")!;
    expect(mismatch.specKey).toBe("Entity");
    expect(mismatch.mismatchType).toBe("partial-name-overlap");
  });
});
