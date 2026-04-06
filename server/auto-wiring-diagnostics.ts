import { createHash } from "crypto";

export type WorkflowRole = "entrypoint" | "transaction_handler" | "helper" | "decomposed_child";

export type FinalWiringStatus = "wired_and_reachable" | "wired_but_unreachable" | "unwired_but_retained" | "unwired_and_removed" | "skipped_infrastructure";

export type UnwiredSeverity = "none" | "info" | "warning" | "package_fatal";

export type RootCauseCategory =
  | "none"
  | "invoke_emission_skipped_no_insert_point"
  | "invoke_emission_skipped_already_referenced"
  | "invoke_emission_skipped_no_caller"
  | "invoke_emission_skipped_no_process_xaml"
  | "reachability_gap"
  | "main_stub_fallback_injection_failed"
  | "process_stub_fallback_injection_failed"
  | "orphaned_non_generated";

export interface WorkflowWiringDiagnosticEntry {
  file: string;
  generated: boolean;
  required: boolean;
  workflowRole: WorkflowRole;
  classificationSourceRule: string;
  unwiredSeverity: UnwiredSeverity;
  requiredByPath: string;
  expectedCaller: string | null;
  callerCandidates: string[];
  invokeAttempted: boolean;
  invokeSucceeded: boolean;
  invokeSkippedReason: string | null;
  invokeRejectedReason: string | null;
  actualCallers: string[];
  reachableFromMain: boolean;
  finalWiringStatus: FinalWiringStatus;
  rootCauseCategory: RootCauseCategory;
  remediationHint: string | null;
}

export interface WorkflowAutoWiringDiagnosticsSummary {
  totalGeneratedWorkflows: number;
  totalRequiredWorkflows: number;
  totalRequiredWorkflowsWired: number;
  totalGeneratedButUnwired: number;
  totalUnreachableFromMain: number;
  totalMissingInvokeEdges: number;
  totalCallerMismatchDefects: number;
  totalInvokeEmissionFailures: number;
}

export interface WorkflowAutoWiringDiagnostics {
  entries: WorkflowWiringDiagnosticEntry[];
  summary: WorkflowAutoWiringDiagnosticsSummary;
  activePathProof: {
    reachabilityComputedOnFinalizedSet: boolean;
    reachabilityPruningSkipped: boolean;
    wiringComputedOnFinalizedSet: boolean;
    workflowSetHashAtWiringTime: string;
    workflowSetHashAtReachabilityTime: string;
    consistent: boolean;
  } | null;
}

export interface WorkflowRoleClassification {
  role: WorkflowRole;
  sourceRule: string;
}

export function classifyWorkflowRole(
  fileName: string,
  isMainOrProcess: boolean,
  isGenerated?: boolean,
): WorkflowRoleClassification {
  const basename = (fileName.split("/").pop() || fileName).replace(/\.xaml$/i, "");
  const lower = basename.toLowerCase();

  if (lower === "main") return { role: "entrypoint", sourceRule: "basename_match:Main" };
  if (lower === "process") return { role: "entrypoint", sourceRule: "basename_match:Process" };

  if (isMainOrProcess) return { role: "entrypoint", sourceRule: "explicit_main_or_process_flag" };

  const transactionPatterns = [
    /^gettransactiondata$/i,
    /^settransactionstatus$/i,
    /^processtransaction$/i,
  ];
  if (transactionPatterns.some(p => p.test(basename))) {
    return { role: "transaction_handler", sourceRule: `transaction_pattern_match:${basename}` };
  }

  if (isGenerated) {
    return { role: "decomposed_child", sourceRule: "generated_by_spec_decomposition" };
  }

  return { role: "helper", sourceRule: "non_generated_non_entrypoint" };
}

export function classifyAsRequired(
  fileName: string,
  generated: boolean,
  role: WorkflowRole,
): boolean {
  if (role === "entrypoint") return true;
  if (role === "transaction_handler") return true;
  if (generated && role === "decomposed_child") return true;
  return false;
}

export function computeUnwiredSeverity(
  entry: { generated: boolean; required: boolean; workflowRole: WorkflowRole; finalWiringStatus: FinalWiringStatus },
): UnwiredSeverity {
  if (entry.finalWiringStatus === "wired_and_reachable" || entry.finalWiringStatus === "skipped_infrastructure") {
    return "none";
  }
  if (entry.required && entry.generated) {
    return "package_fatal";
  }
  if (entry.required) {
    return "warning";
  }
  if (entry.generated) {
    return "warning";
  }
  return "info";
}

export function buildRequiredByPath(
  fileName: string,
  role: WorkflowRole,
  expectedCaller: string | null,
): string {
  const basename = (fileName.split("/").pop() || fileName).replace(/\.xaml$/i, "");

  if (role === "entrypoint") {
    return `Main.xaml (entry point)`;
  }
  if (role === "transaction_handler") {
    return `Main.xaml → state-machine transition`;
  }

  if (expectedCaller) {
    return `Main.xaml → ${expectedCaller} → spec-decomposition:${basename}`;
  }

  return `Main.xaml → Process.xaml → spec-decomposition:${basename}`;
}

export function computeSummary(entries: WorkflowWiringDiagnosticEntry[]): WorkflowAutoWiringDiagnosticsSummary {
  let totalGeneratedWorkflows = 0;
  let totalRequiredWorkflows = 0;
  let totalRequiredWorkflowsWired = 0;
  let totalGeneratedButUnwired = 0;
  let totalUnreachableFromMain = 0;
  let totalMissingInvokeEdges = 0;
  let totalCallerMismatchDefects = 0;
  let totalInvokeEmissionFailures = 0;

  for (const entry of entries) {
    if (entry.generated) totalGeneratedWorkflows++;
    if (entry.required) totalRequiredWorkflows++;

    if (entry.required && (entry.finalWiringStatus === "wired_and_reachable")) {
      totalRequiredWorkflowsWired++;
    }

    if (entry.generated && (entry.finalWiringStatus === "unwired_but_retained" || entry.finalWiringStatus === "unwired_and_removed")) {
      totalGeneratedButUnwired++;
    }

    if (!entry.reachableFromMain && entry.finalWiringStatus !== "skipped_infrastructure") {
      totalUnreachableFromMain++;
    }

    if (entry.invokeAttempted && !entry.invokeSucceeded) {
      totalInvokeEmissionFailures++;
    }

    if (!entry.invokeAttempted && entry.required && entry.generated && entry.rootCauseCategory !== "none") {
      if (entry.rootCauseCategory.startsWith("invoke_emission_skipped")) {
        totalMissingInvokeEdges++;
      }
    }

    if (entry.expectedCaller && entry.actualCallers.length > 0 && !entry.actualCallers.includes(entry.expectedCaller)) {
      totalCallerMismatchDefects++;
    }
  }

  return {
    totalGeneratedWorkflows,
    totalRequiredWorkflows,
    totalRequiredWorkflowsWired,
    totalGeneratedButUnwired,
    totalUnreachableFromMain,
    totalMissingInvokeEdges,
    totalCallerMismatchDefects,
    totalInvokeEmissionFailures,
  };
}

export function buildAutoWiringDiagnostics(
  entries: WorkflowWiringDiagnosticEntry[],
  activePathProof?: WorkflowAutoWiringDiagnostics["activePathProof"],
): WorkflowAutoWiringDiagnostics {
  return {
    entries,
    summary: computeSummary(entries),
    activePathProof: activePathProof || null,
  };
}

const INFRASTRUCTURE_BASENAMES = new Set([
  "initallsettings",
  "closeallapplications",
  "killallprocesses",
]);

export interface AutoWiringCollectorContext {
  generatedWorkflowNames: Set<string>;
  deferredWrites: Map<string, string>;
  xamlEntries: Array<{ name: string; content: string }>;
  libPath: string;
  reachable: Set<string>;
  unreachable: Set<string>;
  graph: Map<string, string[]>;
  specRetained: Set<string>;
  trulyOrphaned: Set<string>;
  injectedFiles: string[];
  mainHadFallback: boolean;
  processHadFallback: boolean;
  mainStubInjectionAttempted: boolean;
  mainStubInjectionSucceeded: boolean;
  processStubInjectionAttempted: boolean;
  processStubInjectionSucceeded: boolean;
  reachabilitySkipped: boolean;
  perWorkflowRejections: Map<string, string>;
  wiringTimeHash: string;
  reachabilityTimeHash: string;
}

export function computeWorkflowSetHash(
  deferredWrites: Map<string, string>,
  xamlEntries: Array<{ name: string; content: string }>,
): string {
  const sortedNames: string[] = [];
  Array.from(deferredWrites.entries()).forEach(([path]) => {
    if (path.endsWith(".xaml")) {
      sortedNames.push(path.split("/").pop() || path);
    }
  });
  for (const entry of xamlEntries) {
    if (entry.name.endsWith(".xaml")) {
      const bn = entry.name.split("/").pop() || entry.name;
      if (!sortedNames.includes(bn)) sortedNames.push(bn);
    }
  }
  sortedNames.sort();
  return createHash("sha256").update(sortedNames.join("|")).digest("hex").slice(0, 16);
}

export function collectAutoWiringDiagnostics(ctx: AutoWiringCollectorContext): WorkflowAutoWiringDiagnostics {
  const entries: WorkflowWiringDiagnosticEntry[] = [];

  const allWorkflowFiles = new Map<string, string>();
  const prefix = ctx.libPath + "/";

  Array.from(ctx.deferredWrites.entries()).forEach(([path, content]) => {
    if (path.endsWith(".xaml")) {
      const relPath = path.startsWith(prefix) ? path.slice(prefix.length) : (path.split("/").pop() || path);
      allWorkflowFiles.set(relPath, content);
    }
  });
  for (const entry of ctx.xamlEntries) {
    const relPath = entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : (entry.name.split("/").pop() || entry.name);
    if (relPath.endsWith(".xaml") && !allWorkflowFiles.has(relPath)) {
      allWorkflowFiles.set(relPath, entry.content);
    }
  }

  const callerMap = new Map<string, string[]>();
  Array.from(ctx.graph.entries()).forEach(([file, refs]) => {
    for (const ref of refs) {
      const refBasename = ref.split("/").pop() || ref;
      if (!callerMap.has(refBasename)) {
        callerMap.set(refBasename, []);
      }
      callerMap.get(refBasename)!.push(file);
    }
  });

  const allWorkflowKeys = Array.from(allWorkflowFiles.keys());
  for (const file of allWorkflowKeys) {
    const basename = (file.split("/").pop() || file).replace(/\.xaml$/i, "");
    const basenameWithExt = basename + ".xaml";
    const lowerBasename = basename.toLowerCase();

    if (INFRASTRUCTURE_BASENAMES.has(lowerBasename)) {
      entries.push({
        file: basenameWithExt,
        generated: ctx.generatedWorkflowNames.has(basename),
        required: false,
        workflowRole: "helper",
        classificationSourceRule: `infrastructure_basename_match:${lowerBasename}`,
        unwiredSeverity: "none",
        requiredByPath: "infrastructure utility",
        expectedCaller: "Main.xaml",
        callerCandidates: ["Main.xaml"],
        invokeAttempted: false,
        invokeSucceeded: false,
        invokeSkippedReason: "infrastructure file — always included",
        invokeRejectedReason: null,
        actualCallers: callerMap.get(basenameWithExt) || callerMap.get(file) || [],
        reachableFromMain: ctx.reachable.has(file) || ctx.reachable.has(basenameWithExt),
        finalWiringStatus: "skipped_infrastructure",
        rootCauseCategory: "none",
        remediationHint: null,
      });
      continue;
    }

    const isGenerated = ctx.generatedWorkflowNames.has(basename);
    const isMainOrProcess = lowerBasename === "main" || lowerBasename === "process";
    const roleClassification = classifyWorkflowRole(file, isMainOrProcess, isGenerated);
    const role = roleClassification.role;
    const classificationSourceRule = roleClassification.sourceRule;
    const isRequired = classifyAsRequired(file, isGenerated, role);

    const actualCallers = callerMap.get(basenameWithExt) || callerMap.get(file) || [];
    const graphReachable = ctx.reachable.has(file) || ctx.reachable.has(basenameWithExt);
    const isReachable = ctx.reachabilitySkipped ? null : graphReachable;

    let expectedCaller: string | null = null;
    const callerCandidates: string[] = [];

    if (actualCallers.length > 0) {
      expectedCaller = actualCallers[0];
      for (const ac of actualCallers) {
        if (!callerCandidates.includes(ac)) callerCandidates.push(ac);
      }
    }

    if (role === "entrypoint") {
      expectedCaller = lowerBasename === "main" ? null : (expectedCaller || "Main.xaml");
      if (!callerCandidates.includes("Main.xaml") && lowerBasename !== "main") callerCandidates.push("Main.xaml");
    } else if (role === "transaction_handler") {
      expectedCaller = expectedCaller || "Main.xaml";
      if (!callerCandidates.includes("Main.xaml")) callerCandidates.push("Main.xaml");
    } else {
      expectedCaller = expectedCaller || "Process.xaml";
      if (!callerCandidates.includes("Process.xaml")) callerCandidates.push("Process.xaml");
      if (!callerCandidates.includes("Main.xaml")) callerCandidates.push("Main.xaml");
    }

    let invokeAttempted = false;
    let invokeSucceeded = false;
    let invokeSkippedReason: string | null = null;
    let invokeRejectedReason: string | null = null;

    const isInSpecRetained = ctx.specRetained.has(file) || ctx.specRetained.has(basenameWithExt);
    const isInTrulyOrphaned = ctx.trulyOrphaned.has(file) || ctx.trulyOrphaned.has(basenameWithExt);
    const wasInjected = ctx.injectedFiles.includes(basenameWithExt);
    const liveRejection = ctx.perWorkflowRejections.get(basenameWithExt) || ctx.perWorkflowRejections.get(basename) || null;

    if (isInSpecRetained) {
      invokeAttempted = true;
      invokeSucceeded = wasInjected;
      if (!wasInjected) {
        invokeRejectedReason = liveRejection || "specRetained workflow could not be injected into Process.xaml — likely already referenced or no insertion point found";
      }
    } else if (isMainOrProcess) {
      invokeAttempted = false;
      invokeSkippedReason = "entrypoint workflow — wired by framework structure";
    } else if (actualCallers.length > 0) {
      invokeAttempted = true;
      invokeSucceeded = true;
    } else if (!isGenerated && !isRequired) {
      invokeAttempted = false;
      invokeSkippedReason = "non-generated optional workflow — not a wiring target";
    }

    if (ctx.mainHadFallback && !isMainOrProcess && !invokeAttempted) {
      if (ctx.mainStubInjectionAttempted) {
        invokeAttempted = true;
        invokeSucceeded = ctx.mainStubInjectionSucceeded && actualCallers.length > 0;
        if (!invokeSucceeded && ctx.mainStubInjectionSucceeded) {
          invokeSkippedReason = null;
        } else if (!ctx.mainStubInjectionSucceeded) {
          invokeRejectedReason = "Main.xaml stub injection failed — no suitable insertion point found";
        }
      }
    }

    if (ctx.processHadFallback && !isMainOrProcess && !invokeSucceeded && !invokeAttempted) {
      if (ctx.processStubInjectionAttempted) {
        invokeAttempted = true;
        invokeSucceeded = ctx.processStubInjectionSucceeded && actualCallers.length > 0;
        if (!ctx.processStubInjectionSucceeded) {
          invokeRejectedReason = "Process.xaml stub injection failed — no suitable insertion point found";
        }
      }
    }

    let finalWiringStatus: FinalWiringStatus;
    let rootCauseCategory: RootCauseCategory = "none";
    let remediationHint: string | null = null;

    const reachableForReport = isReachable === null ? graphReachable : isReachable;

    if (isInTrulyOrphaned) {
      finalWiringStatus = "unwired_and_removed";
      rootCauseCategory = "orphaned_non_generated";
      remediationHint = `${basenameWithExt} is not generated by spec decomposition and has no caller — removed during structural dedup`;
    } else if (!isGenerated && !isRequired && !isMainOrProcess && actualCallers.length === 0) {
      finalWiringStatus = "unwired_but_retained";
    } else if ((isReachable === true || isReachable === null) && (actualCallers.length > 0 || isMainOrProcess)) {
      finalWiringStatus = "wired_and_reachable";
    } else if (actualCallers.length > 0 && isReachable === false) {
      finalWiringStatus = "wired_but_unreachable";
      rootCauseCategory = "reachability_gap";
      remediationHint = `${basenameWithExt} has callers [${actualCallers.join(", ")}] but none are reachable from Main.xaml — check caller chain`;
    } else if (isInSpecRetained && !wasInjected) {
      finalWiringStatus = "unwired_but_retained";
      if (liveRejection && liveRejection.includes("already referenced")) {
        rootCauseCategory = "invoke_emission_skipped_already_referenced";
      } else if (liveRejection && liveRejection.includes("no valid")) {
        rootCauseCategory = "invoke_emission_skipped_no_insert_point";
      } else if (liveRejection && (liveRejection.includes("empty") || liveRejection.includes("not found"))) {
        rootCauseCategory = "invoke_emission_skipped_no_process_xaml";
      } else {
        rootCauseCategory = "invoke_emission_skipped_no_insert_point";
      }
      remediationHint = liveRejection || `${basenameWithExt} was retained as spec-decomposed but could not be wired — verify Process.xaml has a valid insertion point`;
    } else if (isGenerated && actualCallers.length === 0) {
      finalWiringStatus = "unwired_but_retained";
      if (ctx.mainHadFallback && !ctx.mainStubInjectionSucceeded) {
        rootCauseCategory = "main_stub_fallback_injection_failed";
        remediationHint = `${basenameWithExt} is generated but Main.xaml stub injection failed — no insertion point in stubbed Main.xaml`;
      } else if (ctx.processHadFallback && !ctx.processStubInjectionSucceeded) {
        rootCauseCategory = "process_stub_fallback_injection_failed";
        remediationHint = `${basenameWithExt} is generated but Process.xaml stub injection failed — no insertion point in stubbed Process.xaml`;
      } else {
        rootCauseCategory = "invoke_emission_skipped_no_caller";
        remediationHint = `${basenameWithExt} is generated but no caller emitted an InvokeWorkflowFile reference to it`;
      }
    } else if (isMainOrProcess) {
      finalWiringStatus = "wired_and_reachable";
    } else {
      finalWiringStatus = "unwired_but_retained";
      if (isReachable === false) {
        rootCauseCategory = "reachability_gap";
        remediationHint = `${basenameWithExt} is present but not reachable from Main.xaml`;
      }
    }

    const entryPartial = {
      file: basenameWithExt,
      generated: isGenerated,
      required: isRequired,
      workflowRole: role,
      classificationSourceRule,
      requiredByPath: buildRequiredByPath(file, role, expectedCaller),
      expectedCaller,
      callerCandidates,
      invokeAttempted,
      invokeSucceeded,
      invokeSkippedReason,
      invokeRejectedReason,
      actualCallers,
      reachableFromMain: reachableForReport,
      finalWiringStatus,
      rootCauseCategory,
      remediationHint,
      unwiredSeverity: "none" as UnwiredSeverity,
    };
    entryPartial.unwiredSeverity = computeUnwiredSeverity(entryPartial);
    entries.push(entryPartial);
  }

  const wiringHash = ctx.wiringTimeHash || computeWorkflowSetHash(ctx.deferredWrites, ctx.xamlEntries);
  const reachabilityHash = ctx.reachabilityTimeHash || computeWorkflowSetHash(ctx.deferredWrites, ctx.xamlEntries);
  const activePathProof = {
    reachabilityComputedOnFinalizedSet: true,
    reachabilityPruningSkipped: ctx.reachabilitySkipped,
    wiringComputedOnFinalizedSet: true,
    workflowSetHashAtWiringTime: wiringHash,
    workflowSetHashAtReachabilityTime: reachabilityHash,
    consistent: wiringHash === reachabilityHash,
  };

  return buildAutoWiringDiagnostics(entries, activePathProof);
}
