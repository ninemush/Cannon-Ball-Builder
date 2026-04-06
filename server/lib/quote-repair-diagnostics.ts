import { createHash } from "crypto";
import type { QuoteRepairDetail } from "./xml-utils";

export interface QuoteRepairAttempt {
  file: string;
  workflow: string;
  attributePath: string;
  originalValue: string;
  repairedValue: string;
  repairApplied: boolean;
  repairReason: string;
  repairFailedReason?: string;
  savedFromStub: boolean;
  packageFatal: boolean;
}

export interface QuoteRepairDiagnosticsSummary {
  totalMalformedQuoteFindings: number;
  totalQuoteRepairsApplied: number;
  totalQuoteRepairsFailed: number;
  totalWorkflowsSavedFromStub: number;
  totalFilesStillStubbedAfterRepairAttempt: number;
}

export interface ActivePathProofEntry {
  file: string;
  workflow: string;
  stageWhereDetected: string;
  stageWhereApplied: string;
  preRepairHash: string;
  postRepairHash: string;
  downstreamConsumedRepairedVersion: boolean;
}

export interface QuoteRepairDiagnostics {
  attempts: QuoteRepairAttempt[];
  summary: QuoteRepairDiagnosticsSummary;
  activePathProof: ActivePathProofEntry[];
}

let _diagnostics: QuoteRepairDiagnostics = createEmptyDiagnostics();

export function createEmptyDiagnostics(): QuoteRepairDiagnostics {
  return {
    attempts: [],
    summary: {
      totalMalformedQuoteFindings: 0,
      totalQuoteRepairsApplied: 0,
      totalQuoteRepairsFailed: 0,
      totalWorkflowsSavedFromStub: 0,
      totalFilesStillStubbedAfterRepairAttempt: 0,
    },
    activePathProof: [],
  };
}

export function resetQuoteRepairDiagnostics(): void {
  _diagnostics = createEmptyDiagnostics();
}

export function getQuoteRepairDiagnostics(): QuoteRepairDiagnostics {
  return JSON.parse(JSON.stringify(_diagnostics));
}

export function markFilesSavedFromStub(files: string[]): void {
  const fileSet = new Set(files);
  const alreadyCounted = new Set<string>();
  for (const attempt of _diagnostics.attempts) {
    if (fileSet.has(attempt.file) && attempt.repairApplied && !attempt.savedFromStub) {
      attempt.savedFromStub = true;
      if (!alreadyCounted.has(attempt.file)) {
        alreadyCounted.add(attempt.file);
        _diagnostics.summary.totalWorkflowsSavedFromStub++;
      }
    }
  }
}

export function recordQuoteRepairAttempt(attempt: QuoteRepairAttempt): void {
  _diagnostics.attempts.push(attempt);
  _diagnostics.summary.totalMalformedQuoteFindings++;
  if (attempt.repairApplied) {
    _diagnostics.summary.totalQuoteRepairsApplied++;
  } else {
    _diagnostics.summary.totalQuoteRepairsFailed++;
  }
  if (attempt.savedFromStub) {
    _diagnostics.summary.totalWorkflowsSavedFromStub++;
  }
  if (!attempt.repairApplied && !attempt.savedFromStub) {
    _diagnostics.summary.totalFilesStillStubbedAfterRepairAttempt++;
  }
}

export function recordActivePathProof(entry: ActivePathProofEntry): void {
  _diagnostics.activePathProof.push(entry);
}

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex").substring(0, 16);
}

export function recordRepairsFromDetails(
  file: string,
  repairs: QuoteRepairDetail[],
): void {
  const workflow = file.replace(/\.xaml$/i, "");
  for (const repair of repairs) {
    recordQuoteRepairAttempt({
      file,
      workflow,
      attributePath: `Line ${repair.line}: ${repair.attributeName}`,
      originalValue: repair.originalValue,
      repairedValue: repair.repairedValue,
      repairApplied: true,
      repairReason: repair.repairReason,
      savedFromStub: false,
      packageFatal: false,
    });
  }
}

export function verifyActivePathProofIntegrity(
  file: string,
  consumedContentHash: string,
): { verified: boolean; mismatchDetail?: string } {
  const proofEntries = _diagnostics.activePathProof.filter(p => p.file === file);
  if (proofEntries.length === 0) {
    return { verified: true };
  }

  const finalProof = proofEntries[proofEntries.length - 1];

  if (finalProof.postRepairHash !== consumedContentHash) {
    const detail = `Active-path proof violation for ${file}: repaired hash ${finalProof.postRepairHash} != consumed hash ${consumedContentHash} (stage: ${finalProof.stageWhereApplied})`;
    finalProof.downstreamConsumedRepairedVersion = false;

    if (process.env.NODE_ENV === "test" || process.env.CANNONBALL_DEBUG === "true") {
      throw new Error(`[Quote Repair] ${detail}`);
    }

    console.error(`[Quote Repair] WARNING: ${detail}`);
    return { verified: false, mismatchDetail: detail };
  }

  for (const proof of proofEntries) {
    proof.downstreamConsumedRepairedVersion = true;
  }

  return { verified: true };
}

export function recordRepairFailure(
  file: string,
  attributePath: string,
  originalValue: string,
  failedReason: string,
): void {
  const workflow = file.replace(/\.xaml$/i, "");
  recordQuoteRepairAttempt({
    file,
    workflow,
    attributePath,
    originalValue,
    repairedValue: "",
    repairApplied: false,
    repairReason: "",
    repairFailedReason: failedReason,
    savedFromStub: false,
    packageFatal: true,
  });
}
