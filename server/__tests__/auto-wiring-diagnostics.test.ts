import { describe, it, expect } from "vitest";
import {
  classifyWorkflowRole,
  classifyAsRequired,
  buildRequiredByPath,
  computeSummary,
  computeUnwiredSeverity,
  collectAutoWiringDiagnostics,
  computeWorkflowSetHash,
  type AutoWiringCollectorContext,
  type WorkflowWiringDiagnosticEntry,
} from "../auto-wiring-diagnostics";

function makeContext(overrides: Partial<AutoWiringCollectorContext> = {}): AutoWiringCollectorContext {
  return {
    generatedWorkflowNames: new Set<string>(),
    deferredWrites: new Map<string, string>(),
    xamlEntries: [],
    libPath: "lib",
    reachable: new Set<string>(),
    unreachable: new Set<string>(),
    graph: new Map<string, string[]>(),
    specRetained: new Set<string>(),
    trulyOrphaned: new Set<string>(),
    injectedFiles: [],
    mainHadFallback: false,
    processHadFallback: false,
    mainStubInjectionAttempted: false,
    mainStubInjectionSucceeded: false,
    processStubInjectionAttempted: false,
    processStubInjectionSucceeded: false,
    reachabilitySkipped: false,
    perWorkflowRejections: new Map<string, string>(),
    wiringTimeHash: "",
    reachabilityTimeHash: "",
    ...overrides,
  };
}

describe("classifyWorkflowRole", () => {
  it("classifies Main.xaml as entrypoint", () => {
    const result = classifyWorkflowRole("Main.xaml", true);
    expect(result.role).toBe("entrypoint");
    expect(result.sourceRule).toContain("Main");
  });

  it("classifies Process.xaml as entrypoint", () => {
    const result = classifyWorkflowRole("Process.xaml", true);
    expect(result.role).toBe("entrypoint");
    expect(result.sourceRule).toContain("Process");
  });

  it("classifies GetTransactionData.xaml as transaction_handler", () => {
    const result = classifyWorkflowRole("GetTransactionData.xaml", false);
    expect(result.role).toBe("transaction_handler");
    expect(result.sourceRule).toContain("transaction_pattern_match");
  });

  it("classifies generated custom workflow as decomposed_child", () => {
    const result = classifyWorkflowRole("HandleLogin.xaml", false, true);
    expect(result.role).toBe("decomposed_child");
    expect(result.sourceRule).toContain("generated_by_spec_decomposition");
  });

  it("classifies non-generated custom workflow as helper", () => {
    const result = classifyWorkflowRole("HelperUtil.xaml", false, false);
    expect(result.role).toBe("helper");
    expect(result.sourceRule).toContain("non_generated_non_entrypoint");
  });
});

describe("classifyAsRequired", () => {
  it("entrypoints are always required", () => {
    expect(classifyAsRequired("Main.xaml", false, "entrypoint")).toBe(true);
  });

  it("transaction handlers are always required", () => {
    expect(classifyAsRequired("GetTransactionData.xaml", false, "transaction_handler")).toBe(true);
  });

  it("generated decomposed children are required", () => {
    expect(classifyAsRequired("HandleLogin.xaml", true, "decomposed_child")).toBe(true);
  });

  it("non-generated helpers are not required", () => {
    expect(classifyAsRequired("Utility.xaml", false, "helper")).toBe(false);
  });
});

describe("computeSummary", () => {
  it("counts generated and required workflows", () => {
    const entries: WorkflowWiringDiagnosticEntry[] = [
      {
        file: "Main.xaml",
        generated: false,
        required: true,
        workflowRole: "entrypoint",
        classificationSourceRule: "basename_match:Main",
        unwiredSeverity: "none",
        requiredByPath: "Main.xaml (entry point)",
        expectedCaller: null,
        callerCandidates: [],
        invokeAttempted: false,
        invokeSucceeded: false,
        invokeSkippedReason: "entrypoint workflow",
        invokeRejectedReason: null,
        actualCallers: [],
        reachableFromMain: true,
        finalWiringStatus: "wired_and_reachable",
        rootCauseCategory: "none",
        remediationHint: null,
      },
      {
        file: "HandleLogin.xaml",
        generated: true,
        required: true,
        workflowRole: "decomposed_child",
        classificationSourceRule: "generated_by_spec_decomposition",
        unwiredSeverity: "none",
        requiredByPath: "Main.xaml → Process.xaml → spec-decomposition:HandleLogin",
        expectedCaller: "Process.xaml",
        callerCandidates: ["Process.xaml", "Main.xaml"],
        invokeAttempted: true,
        invokeSucceeded: true,
        invokeSkippedReason: null,
        invokeRejectedReason: null,
        actualCallers: ["Process.xaml"],
        reachableFromMain: true,
        finalWiringStatus: "wired_and_reachable",
        rootCauseCategory: "none",
        remediationHint: null,
      },
    ];

    const summary = computeSummary(entries);
    expect(summary.totalGeneratedWorkflows).toBe(1);
    expect(summary.totalRequiredWorkflows).toBe(2);
    expect(summary.totalRequiredWorkflowsWired).toBe(2);
    expect(summary.totalGeneratedButUnwired).toBe(0);
    expect(summary.totalUnreachableFromMain).toBe(0);
  });

  it("counts generated-but-unwired workflows", () => {
    const entries: WorkflowWiringDiagnosticEntry[] = [
      {
        file: "Orphan.xaml",
        generated: true,
        required: true,
        workflowRole: "decomposed_child",
        classificationSourceRule: "generated_by_spec_decomposition",
        unwiredSeverity: "package_fatal",
        requiredByPath: "Main.xaml → Process.xaml → spec-decomposition:Orphan",
        expectedCaller: "Process.xaml",
        callerCandidates: ["Process.xaml", "Main.xaml"],
        invokeAttempted: false,
        invokeSucceeded: false,
        invokeSkippedReason: null,
        invokeRejectedReason: null,
        actualCallers: [],
        reachableFromMain: false,
        finalWiringStatus: "unwired_but_retained",
        rootCauseCategory: "invoke_emission_skipped_no_caller",
        remediationHint: "Orphan.xaml is generated but no caller emitted an InvokeWorkflowFile reference to it",
      },
    ];

    const summary = computeSummary(entries);
    expect(summary.totalGeneratedButUnwired).toBe(1);
    expect(summary.totalUnreachableFromMain).toBe(1);
  });
});

describe("collectAutoWiringDiagnostics", () => {
  it("produces entries for required wired workflow with correct diagnostics", () => {
    const ctx = makeContext({
      generatedWorkflowNames: new Set(["HandleLogin"]),
      deferredWrites: new Map([
        ["lib/Main.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="Process.xaml" /></Activity>'],
        ["lib/Process.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="HandleLogin.xaml" /></Activity>'],
        ["lib/HandleLogin.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "Process.xaml", "HandleLogin.xaml"]),
      unreachable: new Set(),
      graph: new Map([
        ["Main.xaml", ["Process.xaml"]],
        ["Process.xaml", ["HandleLogin.xaml"]],
        ["HandleLogin.xaml", []],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const handleLoginEntry = result.entries.find(e => e.file === "HandleLogin.xaml");
    expect(handleLoginEntry).toBeDefined();
    expect(handleLoginEntry!.generated).toBe(true);
    expect(handleLoginEntry!.required).toBe(true);
    expect(handleLoginEntry!.reachableFromMain).toBe(true);
    expect(handleLoginEntry!.finalWiringStatus).toBe("wired_and_reachable");
    expect(handleLoginEntry!.rootCauseCategory).toBe("none");
    expect(handleLoginEntry!.actualCallers).toContain("Process.xaml");
    expect(handleLoginEntry!.classificationSourceRule).toBe("generated_by_spec_decomposition");
    expect(handleLoginEntry!.unwiredSeverity).toBe("none");
    expect(handleLoginEntry!.workflowRole).toBe("decomposed_child");

    expect(result.summary.totalGeneratedWorkflows).toBe(1);
    expect(result.summary.totalRequiredWorkflowsWired).toBeGreaterThanOrEqual(1);
    expect(result.summary.totalGeneratedButUnwired).toBe(0);
  });

  it("produces exact cause for required unwired workflow with package_fatal severity", () => {
    const ctx = makeContext({
      generatedWorkflowNames: new Set(["SendReport"]),
      deferredWrites: new Map([
        ["lib/Main.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="Process.xaml" /></Activity>'],
        ["lib/Process.xaml", "<Activity><Sequence /></Activity>"],
        ["lib/SendReport.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "Process.xaml"]),
      unreachable: new Set(["SendReport.xaml"]),
      graph: new Map([
        ["Main.xaml", ["Process.xaml"]],
        ["Process.xaml", []],
        ["SendReport.xaml", []],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const entry = result.entries.find(e => e.file === "SendReport.xaml");
    expect(entry).toBeDefined();
    expect(entry!.generated).toBe(true);
    expect(entry!.required).toBe(true);
    expect(entry!.reachableFromMain).toBe(false);
    expect(entry!.finalWiringStatus).toBe("unwired_but_retained");
    expect(entry!.rootCauseCategory).not.toBe("none");
    expect(entry!.remediationHint).toBeTruthy();
    expect(entry!.unwiredSeverity).toBe("package_fatal");
    expect(entry!.classificationSourceRule).toBe("generated_by_spec_decomposition");

    expect(result.summary.totalGeneratedButUnwired).toBe(1);
    expect(result.summary.totalUnreachableFromMain).toBe(1);
  });

  it("optional non-generated helper gets no false-positive rootCause when unwired", () => {
    const ctx = makeContext({
      deferredWrites: new Map([
        ["lib/Main.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="Process.xaml" /></Activity>'],
        ["lib/Process.xaml", "<Activity><Sequence /></Activity>"],
        ["lib/OptionalUtil.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "Process.xaml"]),
      unreachable: new Set(["OptionalUtil.xaml"]),
      graph: new Map([
        ["Main.xaml", ["Process.xaml"]],
        ["Process.xaml", []],
        ["OptionalUtil.xaml", []],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const utilEntry = result.entries.find(e => e.file === "OptionalUtil.xaml");
    expect(utilEntry).toBeDefined();
    expect(utilEntry!.generated).toBe(false);
    expect(utilEntry!.required).toBe(false);
    expect(utilEntry!.workflowRole).toBe("helper");
    expect(utilEntry!.rootCauseCategory).toBe("none");
    expect(utilEntry!.finalWiringStatus).toBe("unwired_but_retained");
    expect(utilEntry!.unwiredSeverity).toBe("info");
    expect(utilEntry!.classificationSourceRule).toBe("non_generated_non_entrypoint");
  });

  it("allows optional helper workflow to remain unwired without marking as generated-unwired", () => {
    const ctx = makeContext({
      generatedWorkflowNames: new Set(["HandleLogin"]),
      deferredWrites: new Map([
        ["lib/Main.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="Process.xaml" /></Activity>'],
        ["lib/Process.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="HandleLogin.xaml" /></Activity>'],
        ["lib/HandleLogin.xaml", "<Activity><Sequence /></Activity>"],
        ["lib/HelperUtil.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "Process.xaml", "HandleLogin.xaml"]),
      unreachable: new Set(["HelperUtil.xaml"]),
      graph: new Map([
        ["Main.xaml", ["Process.xaml"]],
        ["Process.xaml", ["HandleLogin.xaml"]],
        ["HandleLogin.xaml", []],
        ["HelperUtil.xaml", []],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const helperEntry = result.entries.find(e => e.file === "HelperUtil.xaml");
    expect(helperEntry).toBeDefined();
    expect(helperEntry!.generated).toBe(false);
    expect(helperEntry!.required).toBe(false);

    expect(result.summary.totalGeneratedButUnwired).toBe(0);
  });

  it("invoke emission skip produces explicit rootCauseCategory", () => {
    const ctx = makeContext({
      generatedWorkflowNames: new Set(["ExportData"]),
      deferredWrites: new Map([
        ["lib/Main.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="Process.xaml" /></Activity>'],
        ["lib/Process.xaml", "<Activity><Sequence /></Activity>"],
        ["lib/ExportData.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "Process.xaml"]),
      unreachable: new Set(["ExportData.xaml"]),
      graph: new Map([
        ["Main.xaml", ["Process.xaml"]],
        ["Process.xaml", []],
        ["ExportData.xaml", []],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const entry = result.entries.find(e => e.file === "ExportData.xaml");
    expect(entry).toBeDefined();
    expect(entry!.rootCauseCategory).toBe("invoke_emission_skipped_no_caller");
    expect(entry!.remediationHint).toContain("ExportData.xaml");
    expect(entry!.remediationHint).toContain("no caller");
  });

  it("infrastructure workflows are classified as skipped_infrastructure", () => {
    const ctx = makeContext({
      deferredWrites: new Map([
        ["lib/Main.xaml", "<Activity><Sequence /></Activity>"],
        ["lib/InitAllSettings.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "InitAllSettings.xaml"]),
      graph: new Map([
        ["Main.xaml", ["InitAllSettings.xaml"]],
        ["InitAllSettings.xaml", []],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const initEntry = result.entries.find(e => e.file === "InitAllSettings.xaml");
    expect(initEntry).toBeDefined();
    expect(initEntry!.finalWiringStatus).toBe("skipped_infrastructure");
    expect(initEntry!.rootCauseCategory).toBe("none");
  });

  it("includes activePathProof with consistent hash when hashes match", () => {
    const ctx = makeContext({
      deferredWrites: new Map([
        ["lib/Main.xaml", "<Activity />"],
      ]),
      reachable: new Set(["Main.xaml"]),
      graph: new Map([["Main.xaml", []]]),
      wiringTimeHash: "abc123",
      reachabilityTimeHash: "abc123",
    });

    const result = collectAutoWiringDiagnostics(ctx);

    expect(result.activePathProof).not.toBeNull();
    expect(result.activePathProof!.consistent).toBe(true);
    expect(result.activePathProof!.workflowSetHashAtWiringTime).toBe("abc123");
    expect(result.activePathProof!.workflowSetHashAtReachabilityTime).toBe("abc123");
  });

  it("detects inconsistent activePathProof when hashes differ", () => {
    const ctx = makeContext({
      deferredWrites: new Map([
        ["lib/Main.xaml", "<Activity />"],
      ]),
      reachable: new Set(["Main.xaml"]),
      graph: new Map([["Main.xaml", []]]),
      wiringTimeHash: "hash_before",
      reachabilityTimeHash: "hash_after",
    });

    const result = collectAutoWiringDiagnostics(ctx);

    expect(result.activePathProof).not.toBeNull();
    expect(result.activePathProof!.consistent).toBe(false);
    expect(result.activePathProof!.workflowSetHashAtWiringTime).toBe("hash_before");
    expect(result.activePathProof!.workflowSetHashAtReachabilityTime).toBe("hash_after");
  });

  it("uses per-workflow live rejection reason for specRetained workflow not injected", () => {
    const ctx = makeContext({
      generatedWorkflowNames: new Set(["ExportData"]),
      deferredWrites: new Map([
        ["lib/Main.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="Process.xaml" /></Activity>'],
        ["lib/Process.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="ExportData.xaml" /><Sequence /></Activity>'],
        ["lib/ExportData.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "Process.xaml"]),
      unreachable: new Set(["ExportData.xaml"]),
      specRetained: new Set(["ExportData.xaml"]),
      graph: new Map([
        ["Main.xaml", ["Process.xaml"]],
        ["Process.xaml", ["ExportData.xaml"]],
        ["ExportData.xaml", []],
      ]),
      perWorkflowRejections: new Map([
        ["ExportData.xaml", 'already referenced in Process.xaml (matched WorkflowFileName="ExportData.xaml" or "ExportData" or "ExportData.xaml")'],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const entry = result.entries.find(e => e.file === "ExportData.xaml");
    expect(entry).toBeDefined();
    expect(entry!.invokeAttempted).toBe(true);
    expect(entry!.invokeSucceeded).toBe(false);
    expect(entry!.invokeRejectedReason).toContain("already referenced");
  });

  it("spec-retained workflow wired via injected Process.xaml edge shows correct callers from finalized graph", () => {
    const ctx = makeContext({
      generatedWorkflowNames: new Set(["ExportData"]),
      deferredWrites: new Map([
        ["lib/Main.xaml", '<Activity><InvokeWorkflowFile WorkflowFileName="Process.xaml" /></Activity>'],
        ["lib/Process.xaml", '<Activity><Sequence><ui:InvokeWorkflowFile WorkflowFileName="ExportData.xaml" /></Sequence></Activity>'],
        ["lib/ExportData.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml", "Process.xaml", "ExportData.xaml"]),
      unreachable: new Set(),
      specRetained: new Set(["ExportData.xaml"]),
      injectedFiles: ["ExportData.xaml"],
      graph: new Map([
        ["Main.xaml", ["Process.xaml"]],
        ["Process.xaml", ["ExportData.xaml"]],
        ["ExportData.xaml", []],
      ]),
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const entry = result.entries.find(e => e.file === "ExportData.xaml");
    expect(entry).toBeDefined();
    expect(entry!.actualCallers).toContain("Process.xaml");
    expect(entry!.reachableFromMain).toBe(true);
    expect(entry!.invokeAttempted).toBe(true);
    expect(entry!.invokeSucceeded).toBe(true);
    expect(entry!.finalWiringStatus).toBe("wired_and_reachable");
    expect(entry!.rootCauseCategory).toBe("none");
    expect(entry!.unwiredSeverity).toBe("none");
  });

  it("handles reachabilitySkipped scenario — uses graph-derived reachability, not forced true", () => {
    const ctx = makeContext({
      generatedWorkflowNames: new Set(["HandleLogin"]),
      deferredWrites: new Map([
        ["lib/Main.xaml", "<Activity><Sequence /></Activity>"],
        ["lib/Process.xaml", "<Activity><Sequence /></Activity>"],
        ["lib/HandleLogin.xaml", "<Activity><Sequence /></Activity>"],
      ]),
      reachable: new Set(["Main.xaml"]),
      graph: new Map([
        ["Main.xaml", []],
        ["Process.xaml", []],
        ["HandleLogin.xaml", []],
      ]),
      mainHadFallback: true,
      reachabilitySkipped: true,
    });

    const result = collectAutoWiringDiagnostics(ctx);

    const handleLoginEntry = result.entries.find(e => e.file === "HandleLogin.xaml");
    expect(handleLoginEntry).toBeDefined();
    expect(handleLoginEntry!.reachableFromMain).toBe(false);
    expect(handleLoginEntry!.rootCauseCategory).not.toBe("reachability_gap");
    expect(result.activePathProof!.reachabilityComputedOnFinalizedSet).toBe(true);
    expect(result.activePathProof!.reachabilityPruningSkipped).toBe(true);

    const mainEntry = result.entries.find(e => e.file === "Main.xaml");
    expect(mainEntry).toBeDefined();
    expect(mainEntry!.reachableFromMain).toBe(true);
  });
});

describe("computeUnwiredSeverity", () => {
  it("returns none for wired_and_reachable", () => {
    expect(computeUnwiredSeverity({
      generated: true, required: true, workflowRole: "decomposed_child",
      finalWiringStatus: "wired_and_reachable",
    })).toBe("none");
  });

  it("returns package_fatal for required+generated unwired", () => {
    expect(computeUnwiredSeverity({
      generated: true, required: true, workflowRole: "decomposed_child",
      finalWiringStatus: "unwired_but_retained",
    })).toBe("package_fatal");
  });

  it("returns warning for required but non-generated unwired", () => {
    expect(computeUnwiredSeverity({
      generated: false, required: true, workflowRole: "entrypoint",
      finalWiringStatus: "unwired_but_retained",
    })).toBe("warning");
  });

  it("returns info for non-required non-generated unwired", () => {
    expect(computeUnwiredSeverity({
      generated: false, required: false, workflowRole: "helper",
      finalWiringStatus: "unwired_but_retained",
    })).toBe("info");
  });
});

describe("computeWorkflowSetHash", () => {
  it("produces consistent hash for same workflows", () => {
    const dw = new Map([["lib/Main.xaml", "x"], ["lib/Process.xaml", "y"]]);
    const h1 = computeWorkflowSetHash(dw, []);
    const h2 = computeWorkflowSetHash(dw, []);
    expect(h1).toBe(h2);
  });

  it("produces different hash for different workflows", () => {
    const dw1 = new Map([["lib/Main.xaml", "x"]]);
    const dw2 = new Map([["lib/Main.xaml", "x"], ["lib/Extra.xaml", "y"]]);
    const h1 = computeWorkflowSetHash(dw1, []);
    const h2 = computeWorkflowSetHash(dw2, []);
    expect(h1).not.toBe(h2);
  });
});

describe("buildRequiredByPath", () => {
  it("returns entry point path for entrypoint role", () => {
    expect(buildRequiredByPath("Main.xaml", "entrypoint", null)).toBe("Main.xaml (entry point)");
  });

  it("returns state-machine path for transaction handler", () => {
    const result = buildRequiredByPath("GetTransactionData.xaml", "transaction_handler", "Main.xaml");
    expect(result).toContain("state-machine");
  });

  it("returns spec-decomposition path for child with caller", () => {
    const result = buildRequiredByPath("HandleLogin.xaml", "decomposed_child", "Process.xaml");
    expect(result).toContain("spec-decomposition");
    expect(result).toContain("HandleLogin");
  });
});
