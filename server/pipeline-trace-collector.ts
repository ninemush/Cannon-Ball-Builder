import { createHash } from "crypto";
import { AsyncLocalStorage } from "async_hooks";

export interface PropertySerializationTraceEntry {
  workflowFile: string;
  activityType: string;
  propertyName: string;
  originalRawValue: string;
  parsedIntentType: string;
  normalizedOutput: string;
  fallbackUsed: boolean;
  finalValueHash: string;
}

export interface InvokeContractTraceEntry {
  callerWorkflow: string;
  targetWorkflow: string;
  targetDeclaredArguments: string[];
  providedBindings: Record<string, string>;
  unknownTargetArguments: string[];
  missingRequiredArguments: string[];
  undeclaredSymbols: string[];
}

export interface StageHashParityEntry {
  workflowFile: string;
  postGeneration?: string;
  postRepair?: string;
  postNormalization?: string;
  postFinalValidationInput?: string;
  preArchive?: string;
  archivedFile?: string;
}

interface TraceStore {
  propertySerializationTrace: PropertySerializationTraceEntry[];
  invokeContractTrace: InvokeContractTraceEntry[];
  stageHashParity: StageHashParityEntry[];
}

const traceContext = new AsyncLocalStorage<TraceStore>();

function getStore(): TraceStore {
  const store = traceContext.getStore();
  if (store) return store;
  return _fallbackStore;
}

const _fallbackStore: TraceStore = {
  propertySerializationTrace: [],
  invokeContractTrace: [],
  stageHashParity: [],
};

export function runWithTraceContext<T>(fn: () => T): T {
  const store: TraceStore = {
    propertySerializationTrace: [],
    invokeContractTrace: [],
    stageHashParity: [],
  };
  return traceContext.run(store, fn);
}

export function emitPropertySerializationTrace(entry: PropertySerializationTraceEntry): void {
  getStore().propertySerializationTrace.push(entry);
}

export function emitInvokeContractTrace(entry: InvokeContractTraceEntry): void {
  getStore().invokeContractTrace.push(entry);
}

export function emitStageHashParity(entry: StageHashParityEntry): void {
  const store = getStore();
  const existing = store.stageHashParity.find(e => e.workflowFile === entry.workflowFile);
  if (existing) {
    if (entry.postGeneration) existing.postGeneration = entry.postGeneration;
    if (entry.postRepair) existing.postRepair = entry.postRepair;
    if (entry.postNormalization) existing.postNormalization = entry.postNormalization;
    if (entry.postFinalValidationInput) existing.postFinalValidationInput = entry.postFinalValidationInput;
    if (entry.preArchive) existing.preArchive = entry.preArchive;
    if (entry.archivedFile) existing.archivedFile = entry.archivedFile;
  } else {
    store.stageHashParity.push(entry);
  }
}

export function updateStageHash(
  workflowFile: string,
  stage: keyof Omit<StageHashParityEntry, "workflowFile">,
  content: string,
): void {
  const hash = createHash("sha256").update(content).digest("hex");
  const store = getStore();
  const existing = store.stageHashParity.find(e => e.workflowFile === workflowFile);
  if (existing) {
    existing[stage] = hash;
  } else {
    const entry: StageHashParityEntry = { workflowFile };
    entry[stage] = hash;
    store.stageHashParity.push(entry);
  }
}

export function getAndClearPropertySerializationTrace(): PropertySerializationTraceEntry[] {
  const store = getStore();
  const trace = store.propertySerializationTrace;
  store.propertySerializationTrace = [];
  return trace;
}

export function getAndClearInvokeContractTrace(): InvokeContractTraceEntry[] {
  const store = getStore();
  const trace = store.invokeContractTrace;
  store.invokeContractTrace = [];
  return trace;
}

export function getAndClearStageHashParity(): StageHashParityEntry[] {
  const store = getStore();
  const trace = store.stageHashParity;
  store.stageHashParity = [];
  return trace;
}

export function getPropertySerializationTrace(): ReadonlyArray<PropertySerializationTraceEntry> {
  return getStore().propertySerializationTrace;
}

export function getInvokeContractTrace(): ReadonlyArray<InvokeContractTraceEntry> {
  return getStore().invokeContractTrace;
}

export function getStageHashParity(): ReadonlyArray<StageHashParityEntry> {
  return getStore().stageHashParity;
}

export function hasStageHash(workflowFile: string, stage: keyof Omit<StageHashParityEntry, "workflowFile">): boolean {
  const store = getStore();
  const existing = store.stageHashParity.find(e => e.workflowFile === workflowFile);
  return !!existing && !!existing[stage];
}

export function clearAllTraces(): void {
  const store = getStore();
  store.propertySerializationTrace = [];
  store.invokeContractTrace = [];
  store.stageHashParity = [];
}

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
