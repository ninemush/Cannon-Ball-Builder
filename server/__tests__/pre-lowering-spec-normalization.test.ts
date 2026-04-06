import { describe, it, expect } from "vitest";
import {
  normalizeWorkflowSpecCriticalOperations,
  runPreLoweringSpecNormalization,
  validateAdoptionTrace,
  markLoweringAdoptionResult,
  checkLoweringReceivedNormalizedOnly,
  type ActivePathAdoptionTraceEntry,
} from "../pre-lowering-spec-normalization";
import type { WorkflowSpec, WorkflowNode, ActivityNode, TryCatchNode } from "../workflow-spec-types";

function makeActivityNode(overrides: Partial<ActivityNode>): ActivityNode {
  return {
    kind: "activity",
    template: overrides.template || "LogMessage",
    displayName: overrides.displayName || "Test Activity",
    properties: overrides.properties || {},
    errorHandling: overrides.errorHandling || "none",
    outputVar: overrides.outputVar ?? null,
    outputType: overrides.outputType ?? null,
  };
}

function makeTryCatchNode(overrides: Partial<TryCatchNode>): TryCatchNode {
  return {
    kind: "tryCatch",
    displayName: overrides.displayName || "TryCatch",
    tryChildren: overrides.tryChildren || [],
    catchChildren: overrides.catchChildren || [],
    finallyChildren: overrides.finallyChildren || [],
    catchVariableName: overrides.catchVariableName,
  };
}

function makeWorkflowSpec(children: WorkflowNode[]): WorkflowSpec {
  return {
    name: "TestWorkflow",
    description: "Test workflow for normalization",
    variables: [],
    arguments: [],
    rootSequence: {
      kind: "sequence",
      displayName: "Root",
      children,
    },
    useReFramework: false,
    dhgNotes: [],
    decomposition: [],
  };
}

describe("Pre-lowering spec normalization", () => {
  describe("No duplicates — passthrough", () => {
    it("returns spec unchanged when no duplicate critical operations exist", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Email",
          properties: { To: "a@b.com", Subject: "Test", Body: "Hello" },
        }),
        makeActivityNode({
          template: "LogMessage",
          displayName: "Log Done",
          properties: { Level: "Info", Message: "Done" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(normalizedSpec.rootSequence.children).toHaveLength(2);
      expect(diagnostics.summary.totalClusters).toBe(0);
      expect(diagnostics.summary.duplicatesDetected).toBe(0);
    });
  });

  describe("Narrative TryCatch + concrete send → normalized to one", () => {
    it("removes narrative TryCatch and keeps concrete send step", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Send Email with error handling",
          tryChildren: [
            makeActivityNode({
              template: "LogMessage",
              displayName: "Log: sending email",
              properties: { Level: "Info", Message: "Sending email..." },
            }),
          ],
          catchChildren: [
            makeActivityNode({
              template: "LogMessage",
              displayName: "Log error",
              properties: { Level: "Error", Message: "Email failed" },
            }),
          ],
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "recipient@example.com", Subject: "Test Subject", Body: "Test Body Content" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(normalizedSpec.rootSequence.children).toHaveLength(1);
      const remaining = normalizedSpec.rootSequence.children[0];
      expect(remaining.kind).toBe("activity");
      expect((remaining as ActivityNode).template).toBe("GmailSendMessage");

      expect(diagnostics.summary.totalClusters).toBe(1);
      expect(diagnostics.summary.normalizedSuccessfully).toBe(1);
      expect(diagnostics.summary.narrativePseudoContainersRemoved).toBe(1);
    });

    it("preserves To, Subject, Body after normalization", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Mail Send error handler",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "user@test.com", Subject: "Important", Body: "Hello World" },
        }),
      ]);

      const { normalizedSpec } = normalizeWorkflowSpecCriticalOperations(spec);
      const gmailNode = normalizedSpec.rootSequence.children.find(
        (c): c is ActivityNode => c.kind === "activity" && (c as ActivityNode).template === "GmailSendMessage"
      );
      expect(gmailNode).toBeTruthy();
      expect(gmailNode!.properties.To).toBe("user@test.com");
      expect(gmailNode!.properties.Subject).toBe("Important");
      expect(gmailNode!.properties.Body).toBe("Hello World");
    });
  });

  describe("Conflicting property values cause rejection", () => {
    it("rejects narrative+concrete cluster when concrete representations have conflicting properties and preserves all nodes", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 1",
          properties: { To: "user1@test.com", Subject: "Subject A", Body: "Body A" },
        }),
        makeTryCatchNode({
          displayName: "Send email with retry",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 2",
          properties: { To: "user2@test.com", Subject: "Subject B", Body: "Body B" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(1);
      expect(diagnostics.summary.rejectedForConflict).toBe(1);
      expect(normalizedSpec.rootSequence.children).toHaveLength(3);
    });
  });

  describe("Downstream lowering input contains only normalized representation", () => {
    it("after normalization, only canonical representations remain for critical operations", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "LogMessage",
          displayName: "Log Start",
          properties: { Level: "Info", Message: "Starting" },
        }),
        makeTryCatchNode({
          displayName: "Send Email error handler",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "SendOutlookMailMessage",
          displayName: "Send Outlook Email",
          properties: { To: "mgr@co.com", Subject: "Report", Body: "Please review" },
        }),
        makeActivityNode({
          template: "LogMessage",
          displayName: "Log End",
          properties: { Level: "Info", Message: "Done" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.normalizedSuccessfully).toBe(1);
      expect(normalizedSpec.rootSequence.children).toHaveLength(3);

      const mailNodes = normalizedSpec.rootSequence.children.filter(
        c => c.kind === "activity" && MAIL_TEMPLATES.has((c as ActivityNode).template)
      );
      expect(mailNodes).toHaveLength(1);
      expect((mailNodes[0] as ActivityNode).template).toBe("SendOutlookMailMessage");
    });
  });

  describe("Active-path adoption trace", () => {
    it("initializes loweringSawOnlyNormalizedRepresentation: false before lowering confirms", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Mail send handler",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ]);

      const { adoptionTrace } = runPreLoweringSpecNormalization([
        { name: "TestWorkflow", spec },
      ]);

      expect(adoptionTrace).toHaveLength(1);
      expect(adoptionTrace[0].loweringSawOnlyNormalizedRepresentation).toBe(false);
      expect(adoptionTrace[0].preNormalizationRepresentationCount).toBeGreaterThanOrEqual(
        adoptionTrace[0].postNormalizationRepresentationCount
      );
    });

    it("becomes true after markLoweringAdoptionResult confirms clean input", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Mail send handler",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ]);

      const { normalizedSpecs, adoptionTrace } = runPreLoweringSpecNormalization([
        { name: "TestWorkflow", spec },
      ]);

      const normalizedChildren = normalizedSpecs[0].spec.rootSequence.children;
      const sawNormalized = checkLoweringReceivedNormalizedOnly(adoptionTrace, "TestWorkflow", normalizedChildren);
      markLoweringAdoptionResult(adoptionTrace, "TestWorkflow", sawNormalized);

      expect(adoptionTrace[0].loweringSawOnlyNormalizedRepresentation).toBe(true);
    });

    it("debug mode fails when lowering sees pre-normalized or mixed representations", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "TestWorkflow",
          preNormalizationRepresentationCount: 3,
          postNormalizationRepresentationCount: 1,
          normalizedOperationIds: ["TestWorkflow:mail-send:idx1"],
          loweringSawOnlyNormalizedRepresentation: false,
          droppedRepresentationNodeIndices: [0, 2],
        },
      ];

      expect(() => validateAdoptionTrace(trace, true)).toThrow(
        /adoption trace violations detected/
      );
    });

    it("non-debug mode reports violations without throwing", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "TestWorkflow",
          preNormalizationRepresentationCount: 3,
          postNormalizationRepresentationCount: 1,
          normalizedOperationIds: ["TestWorkflow:mail-send:idx1"],
          loweringSawOnlyNormalizedRepresentation: false,
          droppedRepresentationNodeIndices: [0, 2],
        },
      ];

      const result = validateAdoptionTrace(trace, false);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe("markLoweringAdoptionResult", () => {
    it("updates the trace entry for a given workflow", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 2,
          postNormalizationRepresentationCount: 1,
          normalizedOperationIds: ["Main:mail-send:idx0"],
          loweringSawOnlyNormalizedRepresentation: true,
          droppedRepresentationNodeIndices: [0],
        },
      ];

      markLoweringAdoptionResult(trace, "Main", false);
      expect(trace[0].loweringSawOnlyNormalizedRepresentation).toBe(false);
    });
  });

  describe("No new parallel family abstraction introduced", () => {
    it("normalization uses WorkflowSpec/WorkflowNode types only", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ]);

      const { normalizedSpec } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(normalizedSpec.rootSequence.kind).toBe("sequence");
      for (const child of normalizedSpec.rootSequence.children) {
        expect(["activity", "sequence", "tryCatch", "if", "while", "forEach", "retryScope"]).toContain(child.kind);
      }
    });
  });

  describe("Action center and data service operations", () => {
    it("normalizes duplicate action center representations", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Create Task error handling",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "CreateFormTask",
          displayName: "Create Approval Task",
          properties: { Title: "Approval", FormSchemaPath: "schema.json" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.normalizedSuccessfully).toBe(1);
      expect(normalizedSpec.rootSequence.children).toHaveLength(1);
      expect((normalizedSpec.rootSequence.children[0] as ActivityNode).template).toBe("CreateFormTask");
    });

    it("normalizes duplicate data service representations", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Update Entity error handling",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "UpdateEntity",
          displayName: "Update Customer Record",
          properties: { EntityType: "Customer", EntityObject: "[customerRecord]" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.normalizedSuccessfully).toBe(1);
      expect(normalizedSpec.rootSequence.children).toHaveLength(1);
    });
  });

  describe("Narrative pseudo-content in activity properties", () => {
    it("detects narrative pseudo-content in Body property and classifies as narrative-container", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Email with TryCatch",
          properties: {
            To: "a@b.com",
            Subject: "S",
            Body: 'TryCatch { Try: GmailSendMessage(To="a@b.com") Catches: Exception -> log error }',
          },
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail Clean",
          properties: { To: "a@b.com", Subject: "S", Body: "Actual email body content" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(1);
      expect(diagnostics.summary.normalizedSuccessfully).toBe(1);
      expect(normalizedSpec.rootSequence.children).toHaveLength(1);
      expect((normalizedSpec.rootSequence.children[0] as ActivityNode).properties.Body).toBe("Actual email body content");
    });
  });

  describe("runPreLoweringSpecNormalization multi-workflow", () => {
    it("processes multiple workflows independently", () => {
      const spec1 = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Send Email handler",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ]);

      const spec2 = makeWorkflowSpec([
        makeActivityNode({
          template: "LogMessage",
          displayName: "Log",
          properties: { Level: "Info", Message: "Hello" },
        }),
      ]);

      const { normalizedSpecs, allDiagnostics, adoptionTrace } = runPreLoweringSpecNormalization([
        { name: "Workflow1", spec: spec1 },
        { name: "Workflow2", spec: spec2 },
      ]);

      expect(normalizedSpecs).toHaveLength(2);
      expect(normalizedSpecs[0].spec.rootSequence.children).toHaveLength(1);
      expect(normalizedSpecs[1].spec.rootSequence.children).toHaveLength(1);
      expect(allDiagnostics.summary.totalClusters).toBe(1);
      expect(adoptionTrace).toHaveLength(2);
    });
  });

  describe("Proximity-based clustering — distinct same-type operations preserved", () => {
    it("does not conflate two distant mail-send operations of the same type", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Notification Email",
          properties: { To: "notify@co.com", Subject: "Notification", Body: "Event happened" },
        }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 1", properties: {} }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 2", properties: {} }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 3", properties: {} }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 4", properties: {} }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Report Email",
          properties: { To: "report@co.com", Subject: "Report", Body: "Monthly report" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(0);
      expect(normalizedSpec.rootSequence.children).toHaveLength(6);
    });

    it("clusters nearby same-type operations within proximity gap", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Gmail send error handling",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({ template: "LogMessage", displayName: "Log", properties: {} }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(1);
      expect(diagnostics.summary.normalizedSuccessfully).toBe(1);
      expect(normalizedSpec.rootSequence.children).toHaveLength(2);
    });
  });

  describe("Concrete+concrete duplicate clustering", () => {
    it("clusters and collapses nearby duplicate concrete operations with same properties", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 1",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 2",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(1);
      expect(diagnostics.summary.normalizedSuccessfully).toBe(1);
      expect(normalizedSpec.rootSequence.children).toHaveLength(1);
    });

    it("does not cluster nearby concrete operations with different property values (treats as distinct operations)", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 1",
          properties: { To: "a@b.com", Subject: "Subject A", Body: "B" },
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 2",
          properties: { To: "x@y.com", Subject: "Subject B", Body: "B" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(0);
      expect(diagnostics.summary.rejectedForConflict).toBe(0);
      expect(normalizedSpec.rootSequence.children).toHaveLength(2);
      expect((normalizedSpec.rootSequence.children[0] as ActivityNode).properties.To).toBe("a@b.com");
      expect((normalizedSpec.rootSequence.children[1] as ActivityNode).properties.To).toBe("x@y.com");
    });
  });

  describe("Nested duplicate normalization", () => {
    it("normalizes duplicates inside a TryCatch tryChildren block", () => {
      const spec = makeWorkflowSpec([
        makeTryCatchNode({
          displayName: "Main Error Handler",
          tryChildren: [
            makeTryCatchNode({
              displayName: "Gmail send error handling",
              tryChildren: [],
              catchChildren: [],
            }),
            makeActivityNode({
              template: "GmailSendMessage",
              displayName: "Send Gmail Nested",
              properties: { To: "a@b.com", Subject: "S", Body: "B" },
            }),
          ],
          catchChildren: [],
        }),
      ]);

      const { normalizedSpec } = normalizeWorkflowSpecCriticalOperations(spec);
      const outerTryCatch = normalizedSpec.rootSequence.children[0] as TryCatchNode;
      expect(outerTryCatch.tryChildren).toHaveLength(1);
      expect(outerTryCatch.tryChildren[0].kind).toBe("activity");
      expect((outerTryCatch.tryChildren[0] as ActivityNode).template).toBe("GmailSendMessage");
    });
  });

  describe("checkLoweringReceivedNormalizedOnly", () => {
    it("returns true when no narrative representations remain", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 2,
          postNormalizationRepresentationCount: 1,
          normalizedOperationIds: ["Main:mail-send:idx1"],
          loweringSawOnlyNormalizedRepresentation: true,
          droppedRepresentationNodeIndices: [0],
          hasRejectedClusters: false,
        },
      ];

      const children = [
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ];

      expect(checkLoweringReceivedNormalizedOnly(trace, "Main", children)).toBe(true);
    });

    it("returns false when duplicate concrete operations remain in proximity", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 3,
          postNormalizationRepresentationCount: 2,
          normalizedOperationIds: [],
          loweringSawOnlyNormalizedRepresentation: false,
          droppedRepresentationNodeIndices: [1],
          hasRejectedClusters: false,
        },
      ];

      const children = [
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 1",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 2",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ];

      expect(checkLoweringReceivedNormalizedOnly(trace, "Main", children)).toBe(false);
    });

    it("returns false when narrative TryCatch still present in children", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 2,
          postNormalizationRepresentationCount: 2,
          normalizedOperationIds: [],
          loweringSawOnlyNormalizedRepresentation: true,
          droppedRepresentationNodeIndices: [0],
          hasRejectedClusters: false,
        },
      ];

      const children = [
        makeTryCatchNode({
          displayName: "Send Email error handler",
          tryChildren: [],
          catchChildren: [],
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ];

      expect(checkLoweringReceivedNormalizedOnly(trace, "Main", children)).toBe(false);
    });

    it("returns false when hasRejectedClusters is true and unresolved duplicates exist", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 2,
          postNormalizationRepresentationCount: 2,
          normalizedOperationIds: [],
          loweringSawOnlyNormalizedRepresentation: false,
          droppedRepresentationNodeIndices: [],
          hasRejectedClusters: true,
        },
      ];

      const children = [
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 1",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 2",
          properties: { To: "x@y.com", Subject: "S2", Body: "B2" },
        }),
      ];

      expect(checkLoweringReceivedNormalizedOnly(trace, "Main", children)).toBe(false);
    });
  });

  describe("validateAdoptionTrace with rejected clusters", () => {
    it("reports violation when hasRejectedClusters is true", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 2,
          postNormalizationRepresentationCount: 2,
          normalizedOperationIds: [],
          loweringSawOnlyNormalizedRepresentation: false,
          droppedRepresentationNodeIndices: [],
          hasRejectedClusters: true,
        },
      ];

      const result = validateAdoptionTrace(trace);
      expect(result.valid).toBe(false);
      expect(result.violations.some(v => v.includes("rejected clusters"))).toBe(true);
    });

    it("throws in debug mode when rejected clusters exist", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 2,
          postNormalizationRepresentationCount: 2,
          normalizedOperationIds: [],
          loweringSawOnlyNormalizedRepresentation: false,
          droppedRepresentationNodeIndices: [],
          hasRejectedClusters: true,
        },
      ];

      expect(() => validateAdoptionTrace(trace, true)).toThrow("adoption trace violations");
    });

    it("does not report rejection violation when no rejected clusters", () => {
      const trace: ActivePathAdoptionTraceEntry[] = [
        {
          workflowName: "Main",
          preNormalizationRepresentationCount: 2,
          postNormalizationRepresentationCount: 1,
          normalizedOperationIds: ["Main:mail-send:idx0"],
          loweringSawOnlyNormalizedRepresentation: true,
          droppedRepresentationNodeIndices: [1],
          hasRejectedClusters: false,
        },
      ];

      const result = validateAdoptionTrace(trace);
      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("Legitimate distinct operations are not clustered", () => {
    it("does not cluster concrete operations with different templates", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
        makeActivityNode({
          template: "SendSmtpMailMessage",
          displayName: "Send SMTP",
          properties: { To: "a@b.com", Subject: "S", Body: "B" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(0);
      expect(normalizedSpec.rootSequence.children).toHaveLength(2);
    });

    it("does not cluster same-template operations that are far apart", () => {
      const spec = makeWorkflowSpec([
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 1",
          properties: { To: "a@b.com", Subject: "S1", Body: "B1" },
        }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 1", properties: {} }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 2", properties: {} }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 3", properties: {} }),
        makeActivityNode({ template: "LogMessage", displayName: "Log 4", properties: {} }),
        makeActivityNode({
          template: "GmailSendMessage",
          displayName: "Send Gmail 2",
          properties: { To: "x@y.com", Subject: "S2", Body: "B2" },
        }),
      ]);

      const { normalizedSpec, diagnostics } = normalizeWorkflowSpecCriticalOperations(spec);
      expect(diagnostics.summary.totalClusters).toBe(0);
      expect(normalizedSpec.rootSequence.children).toHaveLength(6);
    });
  });
});

const MAIL_TEMPLATES = new Set([
  "GmailSendMessage",
  "SendSmtpMailMessage",
  "SendOutlookMailMessage",
  "SendMail",
]);
