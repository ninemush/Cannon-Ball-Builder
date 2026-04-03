import type { Express, Request, Response } from "express";
import archiver from "archiver";
import * as fs from "fs";
import * as path from "path";
import { storage } from "./storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { documentStorage } from "./document-storage";
import { getCachedPipelineResult, findUiPathMessage, parseUiPathPackage } from "./uipath-pipeline";

async function verifyIdeaAccess(req: Request, res: Response): Promise<{ ideaId: string; isAdmin: boolean } | null> {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return null;
  }
  const ideaId = req.params.ideaId as string;
  const idea = await storage.getIdea(ideaId);
  if (!idea) {
    res.status(404).json({ message: "Idea not found" });
    return null;
  }
  const user = await storage.getUser(req.session.userId as string);
  if (!user) {
    res.status(401).json({ message: "User not found" });
    return null;
  }
  const activeRole = (req.session.activeRole || user.role) as string;
  if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
    res.status(403).json({ message: "Access denied" });
    return null;
  }
  return { ideaId, isAdmin: activeRole === "Admin" || activeRole === "CoE" };
}

function readCatalogFile(filename: string): any | null {
  try {
    const filePath = path.resolve("catalog", filename);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

export function registerVerificationBundleRoutes(app: Express): void {
  app.get("/api/verification-bundle/:ideaId/versions", async (req: Request, res: Response) => {
    const access = await verifyIdeaAccess(req, res);
    if (!access) return;
    const { ideaId } = access;

    try {
      const allRuns = await storage.getGenerationRunsForIdea(ideaId);
      if (allRuns.length === 0) {
        return res.json({ versions: [] });
      }

      const latestRun = allRuns[allRuns.length - 1];
      const pipelineResult = getCachedPipelineResult(ideaId);
      const cachedRunId = pipelineResult ? latestRun.runId : null;

      const versions = allRuns.map((run, index) => ({
        version: index + 1,
        versionLabel: `V${index + 1}`,
        runId: run.runId,
        status: run.status,
        generationMode: run.generationMode,
        createdAt: run.createdAt,
        completedAt: run.completedAt,
        cacheAvailable: run.runId === cachedRunId,
        isLatest: run.runId === latestRun.runId,
      }));

      versions.reverse();

      return res.json({ versions });
    } catch (err: any) {
      console.error(`[VerificationBundle] Error listing versions for idea ${ideaId}:`, err);
      return res.status(500).json({ message: err.message || "Failed to list bundle versions" });
    }
  });

  app.post("/api/verification-bundle/:ideaId", async (req: Request, res: Response) => {
    const access = await verifyIdeaAccess(req, res);
    if (!access) return;
    const { ideaId } = access;

    let archive: ReturnType<typeof archiver> | undefined;
    try {
      const idea = await storage.getIdea(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const requestedRunId = req.body?.runId as string | undefined;

      const allRuns = await storage.getGenerationRunsForIdea(ideaId);
      if (allRuns.length === 0) {
        return res.status(404).json({
          message: "No generation run found for this idea. Generate a package first.",
        });
      }

      let targetRun;
      let versionNumber: number;

      if (requestedRunId) {
        const runIndex = allRuns.findIndex(r => r.runId === requestedRunId);
        if (runIndex === -1) {
          return res.status(404).json({ message: "Generation run not found for this idea." });
        }
        targetRun = allRuns[runIndex];
        versionNumber = runIndex + 1;
      } else {
        targetRun = allRuns[allRuns.length - 1];
        versionNumber = allRuns.length;
      }

      const latestRun = allRuns[allRuns.length - 1];
      const isLatest = targetRun.runId === latestRun.runId;
      const pipelineResult = getCachedPipelineResult(ideaId);
      const isCachedRun = !!pipelineResult && isLatest;

      const messages = await chatStorage.getMessagesByIdeaId(ideaId);
      const uipathMsg = findUiPathMessage(messages);
      let packageData: any = null;
      if (uipathMsg) {
        try {
          packageData = parseUiPathPackage(uipathMsg);
        } catch {}
      }

      const now = new Date().toISOString();

      const dhgContent = targetRun.dhgContent || (isCachedRun ? pipelineResult?.dhgContent : null) || null;
      const finalQualityReport = (isCachedRun && pipelineResult?.finalQualityReport)
        ? pipelineResult.finalQualityReport
        : (targetRun.finalQualityReport || null);

      const wantSnapshotPdd = !isLatest && !!targetRun.pddDocumentId;
      const wantSnapshotSdd = !isLatest && !!targetRun.sddDocumentId;

      let pddDoc, sddDoc;
      let pddFromSnapshot = false;
      let sddFromSnapshot = false;

      const [rawPddDoc, rawSddDoc, pddApproval, sddApproval] = await Promise.all([
        wantSnapshotPdd
          ? documentStorage.getDocument(targetRun.pddDocumentId!)
          : documentStorage.getLatestDocument(ideaId, "PDD"),
        wantSnapshotSdd
          ? documentStorage.getDocument(targetRun.sddDocumentId!)
          : documentStorage.getLatestDocument(ideaId, "SDD"),
        documentStorage.getApproval(ideaId, "PDD"),
        documentStorage.getApproval(ideaId, "SDD"),
      ]);

      if (rawPddDoc) {
        pddDoc = rawPddDoc;
        pddFromSnapshot = wantSnapshotPdd;
      } else if (wantSnapshotPdd) {
        pddDoc = await documentStorage.getLatestDocument(ideaId, "PDD");
        pddFromSnapshot = false;
      }

      if (rawSddDoc) {
        sddDoc = rawSddDoc;
        sddFromSnapshot = wantSnapshotSdd;
      } else if (wantSnapshotSdd) {
        sddDoc = await documentStorage.getLatestDocument(ideaId, "SDD");
        sddFromSnapshot = false;
      }

      const activityCatalog = readCatalogFile("activity-catalog.json");
      const generationMetadata = readCatalogFile("generation-metadata.json");

      const artifactSources: Record<string, string> = {
        manifest: "generated",
        "pipeline-diagnostics": "database",
      };

      let nupkgBuffer: Buffer | null = null;
      if (isCachedRun && pipelineResult?.packageBuffer && pipelineResult.packageBuffer.length > 0) {
        nupkgBuffer = pipelineResult.packageBuffer;
        artifactSources["nupkg"] = "cache";
      } else if (packageData) {
        artifactSources["nupkg"] = "unavailable-metadata-only";
        artifactSources["package-metadata"] = "chat-message";
      } else {
        artifactSources["nupkg"] = "unavailable-cache-expired";
      }

      if (dhgContent) {
        artifactSources["dhg"] = targetRun.dhgContent ? "database" : "cache";
      }

      if (isCachedRun && pipelineResult?.qualityGateResult) {
        artifactSources["quality-gate-results"] = "cache";
      } else if (targetRun.qualityGateResults) {
        artifactSources["quality-gate-results"] = "database";
      } else if (targetRun.outcomeReport) {
        artifactSources["quality-gate-results"] = "outcome-report-fallback";
      } else if (!isCachedRun) {
        artifactSources["quality-gate-results"] = "unavailable-cache-expired";
      }

      if (isCachedRun && pipelineResult?.metaValidationResult) {
        artifactSources["meta-validation-results"] = "cache";
      } else if (targetRun.metaValidationResults) {
        artifactSources["meta-validation-results"] = "database";
      }

      if (targetRun.outcomeReport) {
        artifactSources["outcome-report"] = "database";
      }

      if (isCachedRun && pipelineResult?.finalQualityReport) {
        artifactSources["final-quality-report"] = "cache";
      } else if (targetRun.finalQualityReport) {
        artifactSources["final-quality-report"] = "database";
      } else {
        artifactSources["final-quality-report"] = isCachedRun ? "unavailable-not-generated" : "unavailable-cache-expired";
      }

      if (targetRun.specSnapshot) {
        artifactSources["spec-snapshot"] = "database";
      }

      if (pddDoc) {
        artifactSources["pdd"] = pddFromSnapshot ? "database-snapshot" : "database-latest";
      }
      if (sddDoc) {
        artifactSources["sdd"] = sddFromSnapshot ? "database-snapshot" : "database-latest";
      }
      if (pddApproval || sddApproval) {
        artifactSources["document-approvals"] = "database";
      }
      if (activityCatalog) {
        artifactSources["activity-catalog"] = "filesystem";
      }
      if (generationMetadata) {
        artifactSources["generation-metadata"] = "filesystem";
      }

      const manifest = {
        ideaId,
        ideaTitle: idea.title,
        ideaDescription: idea.description,
        generationRunId: targetRun.runId,
        generationMode: targetRun.generationMode,
        generationStatus: targetRun.status,
        triggeredBy: targetRun.triggeredBy,
        createdAt: targetRun.createdAt,
        completedAt: targetRun.completedAt,
        bundleGeneratedAt: now,
        projectName: packageData?.projectName || (isCachedRun ? pipelineResult?.projectName : null) || idea.title,
        version: `V${versionNumber}`,
        totalVersions: allRuns.length,
        isLatest,
        cacheAvailable: isCachedRun,
        documentSnapshots: {
          pdd: pddFromSnapshot
            ? { source: "snapshot", documentId: targetRun.pddDocumentId, version: pddDoc?.version ?? null }
            : { source: "latest", documentId: pddDoc?.id ?? null, version: pddDoc?.version ?? null },
          sdd: sddFromSnapshot
            ? { source: "snapshot", documentId: targetRun.sddDocumentId, version: sddDoc?.version ?? null }
            : { source: "latest", documentId: sddDoc?.id ?? null, version: sddDoc?.version ?? null },
        },
        artifactSources,
      };

      let outcomeReport: any = null;
      if (targetRun.outcomeReport) {
        try {
          outcomeReport = JSON.parse(targetRun.outcomeReport);
        } catch {}
      }

      let qualityGateResults: any = null;
      if (isCachedRun && pipelineResult?.qualityGateResult) {
        qualityGateResults = pipelineResult.qualityGateResult;
      } else if (targetRun.qualityGateResults) {
        qualityGateResults = targetRun.qualityGateResults;
      } else if (outcomeReport?.pipelineOutcome) {
        qualityGateResults = {
          source: "outcome-report-fallback",
          qualityWarnings: outcomeReport.pipelineOutcome.qualityWarnings,
          remediations: outcomeReport.pipelineOutcome.remediations,
        };
      }

      let metaValidationResults: any = null;
      if (isCachedRun && pipelineResult?.metaValidationResult) {
        metaValidationResults = pipelineResult.metaValidationResult;
      } else if (targetRun.metaValidationResults) {
        metaValidationResults = targetRun.metaValidationResults;
      } else if (outcomeReport?.pipelineOutcome) {
        const po = outcomeReport.pipelineOutcome;
        const metaSummary: Record<string, any> = {
          source: "outcome-report-fallback",
        };
        if (po.metaValidationEngaged !== undefined) metaSummary.engaged = po.metaValidationEngaged;
        if (po.correctionsApplied !== undefined) metaSummary.correctionsApplied = po.correctionsApplied;
        if (po.confidenceScore !== undefined) metaSummary.confidenceScore = po.confidenceScore;
        if (po.metaValidationMode !== undefined) metaSummary.mode = po.metaValidationMode;
        if (po.metaValidationDuration !== undefined) metaSummary.duration = po.metaValidationDuration;

        if (po.metaValidation) {
          if (po.metaValidation.engaged !== undefined) metaSummary.engaged = po.metaValidation.engaged;
          if (po.metaValidation.correctionsApplied !== undefined) metaSummary.correctionsApplied = po.metaValidation.correctionsApplied;
          if (po.metaValidation.confidenceScore !== undefined) metaSummary.confidenceScore = po.metaValidation.confidenceScore;
          if (po.metaValidation.mode !== undefined) metaSummary.mode = po.metaValidation.mode;
          if (po.metaValidation.duration !== undefined) metaSummary.duration = po.metaValidation.duration;
        }

        if (Object.keys(metaSummary).length > 1) {
          metaValidationResults = metaSummary;
          artifactSources["meta-validation-results"] = "outcome-report-fallback";
        }
      }

      if (!artifactSources["meta-validation-results"]) {
        artifactSources["meta-validation-results"] = isCachedRun ? "unavailable-not-generated" : "unavailable-cache-expired";
      }

      let propertySerializationTrace: any = null;
      if (isCachedRun && pipelineResult?.propertySerializationTrace && pipelineResult.propertySerializationTrace.length > 0) {
        propertySerializationTrace = pipelineResult.propertySerializationTrace;
        artifactSources["property-serialization-trace"] = "cache";
      } else if (outcomeReport?.pipelineOutcome?.propertySerializationTrace) {
        propertySerializationTrace = outcomeReport.pipelineOutcome.propertySerializationTrace;
        artifactSources["property-serialization-trace"] = "outcome-report-fallback";
      } else {
        artifactSources["property-serialization-trace"] = isCachedRun ? "unavailable-not-generated" : "unavailable-cache-expired";
      }

      let invokeContractTrace: any = null;
      if (isCachedRun && pipelineResult?.invokeContractTrace && pipelineResult.invokeContractTrace.length > 0) {
        invokeContractTrace = pipelineResult.invokeContractTrace;
        artifactSources["invoke-contract-trace"] = "cache";
      } else if (outcomeReport?.pipelineOutcome?.invokeContractTrace) {
        invokeContractTrace = outcomeReport.pipelineOutcome.invokeContractTrace;
        artifactSources["invoke-contract-trace"] = "outcome-report-fallback";
      } else {
        artifactSources["invoke-contract-trace"] = isCachedRun ? "unavailable-not-generated" : "unavailable-cache-expired";
      }

      let stageHashParity: any = null;
      if (isCachedRun && pipelineResult?.stageHashParity && pipelineResult.stageHashParity.length > 0) {
        stageHashParity = pipelineResult.stageHashParity;
        artifactSources["stage-hash-parity"] = "cache";
      } else if (outcomeReport?.pipelineOutcome?.stageHashParity) {
        stageHashParity = outcomeReport.pipelineOutcome.stageHashParity;
        artifactSources["stage-hash-parity"] = "outcome-report-fallback";
      } else {
        artifactSources["stage-hash-parity"] = isCachedRun ? "unavailable-not-generated" : "unavailable-cache-expired";
      }

      let stageLog: any = null;
      if (targetRun.stageLog) {
        stageLog = targetRun.stageLog;
      }

      let phaseProgress: any = null;
      if (targetRun.phaseProgress) {
        try {
          phaseProgress = JSON.parse(targetRun.phaseProgress);
        } catch {}
      }

      const pipelineDiagnostics = {
        runId: targetRun.runId,
        status: targetRun.status,
        currentPhase: targetRun.currentPhase,
        errorMessage: targetRun.errorMessage,
        stageLog,
        phaseProgress,
        createdAt: targetRun.createdAt,
        completedAt: targetRun.completedAt,
      };

      const safeProjectName = (manifest.projectName || "VerificationBundle").replace(/[^a-zA-Z0-9_-]/g, "_");
      const versionTag = `V${versionNumber}`;

      const serializedArtifacts: Array<{ data: string | Buffer; name: string }> = [];
      serializedArtifacts.push({ data: JSON.stringify(manifest, null, 2), name: "manifest.json" });

      if (nupkgBuffer && nupkgBuffer.length > 0) {
        serializedArtifacts.push({ data: nupkgBuffer, name: `${safeProjectName}.nupkg` });
      } else if (packageData) {
        const { internal, ...publicMetadata } = packageData;
        serializedArtifacts.push({
          data: JSON.stringify({
            source: "chat-message",
            note: "Binary .nupkg unavailable; reconstruction inputs (xamlEntries/archiveManifest) are not persisted to database. Package metadata from chat message is included instead.",
            ...publicMetadata,
          }, null, 2),
          name: "package-metadata.json",
        });
      }

      if (dhgContent) {
        serializedArtifacts.push({ data: dhgContent, name: "dhg.md" });
      }

      if (qualityGateResults) {
        serializedArtifacts.push({ data: JSON.stringify(qualityGateResults, null, 2), name: "quality-gate-results.json" });
      }

      if (metaValidationResults) {
        serializedArtifacts.push({ data: JSON.stringify(metaValidationResults, null, 2), name: "meta-validation-results.json" });
      }

      serializedArtifacts.push({ data: JSON.stringify(pipelineDiagnostics, null, 2), name: "pipeline-diagnostics.json" });

      if (outcomeReport) {
        serializedArtifacts.push({ data: JSON.stringify(outcomeReport, null, 2), name: "outcome-report.json" });
      }

      if (finalQualityReport) {
        serializedArtifacts.push({ data: JSON.stringify(finalQualityReport, null, 2), name: "final-quality-report.json" });
      }

      if (targetRun.specSnapshot) {
        serializedArtifacts.push({ data: JSON.stringify(targetRun.specSnapshot, null, 2), name: "spec-snapshot.json" });
      }

      if (pddDoc?.content) {
        serializedArtifacts.push({ data: pddDoc.content, name: "pdd.md" });
      }

      if (sddDoc?.content) {
        serializedArtifacts.push({ data: sddDoc.content, name: "sdd.md" });
      }

      const docApprovals: Record<string, any> = {};
      if (pddApproval) {
        docApprovals.pdd = {
          approvedBy: pddApproval.userName,
          userId: pddApproval.userId,
          role: pddApproval.userRole,
          approvedAt: pddApproval.approvedAt,
          documentId: pddApproval.documentId,
          version: pddDoc?.version ?? null,
        };
      }
      if (sddApproval) {
        docApprovals.sdd = {
          approvedBy: sddApproval.userName,
          userId: sddApproval.userId,
          role: sddApproval.userRole,
          approvedAt: sddApproval.approvedAt,
          documentId: sddApproval.documentId,
          version: sddDoc?.version ?? null,
        };
      }
      if (Object.keys(docApprovals).length > 0) {
        serializedArtifacts.push({ data: JSON.stringify(docApprovals, null, 2), name: "document-approvals.json" });
      }

      if (activityCatalog) {
        serializedArtifacts.push({
          data: JSON.stringify({
            snapshotAt: now,
            ...activityCatalog,
          }, null, 2),
          name: "activity-catalog.json",
        });
      }

      if (generationMetadata) {
        serializedArtifacts.push({ data: JSON.stringify(generationMetadata, null, 2), name: "generation-metadata.json" });
      }

      if (propertySerializationTrace) {
        serializedArtifacts.push({ data: JSON.stringify(propertySerializationTrace, null, 2), name: "property-serialization-trace.json" });
      }

      if (invokeContractTrace) {
        serializedArtifacts.push({ data: JSON.stringify(invokeContractTrace, null, 2), name: "invoke-contract-trace.json" });
      }

      if (stageHashParity) {
        serializedArtifacts.push({ data: JSON.stringify(stageHashParity, null, 2), name: "stage-hash-parity.json" });
      }

      archive = archiver("zip", { zlib: { level: 9 } });
      const zip = archive;
      let finalized = false;
      let settled = false;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeProjectName}_${versionTag}_verification_bundle.zip"`);

      await new Promise<void>((resolve, reject) => {
        const settle = (fn: typeof resolve | typeof reject, val?: any) => {
          if (settled) return;
          settled = true;
          fn(val);
        };

        zip.on("error", (err) => {
          console.error(`[VerificationBundle] Archive error for idea ${ideaId}:`, err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate verification bundle" });
          } else {
            zip.destroy();
            if (!res.writableEnded) res.end();
          }
          settle(reject, err);
        });

        res.on("close", () => {
          if (!finalized) {
            zip.abort();
          }
          settle(resolve);
        });

        res.on("finish", () => {
          settle(resolve);
        });

        zip.pipe(res);

        for (const artifact of serializedArtifacts) {
          zip.append(artifact.data, { name: artifact.name });
        }

        zip.finalize().then(() => {
          finalized = true;
        }).catch((err) => settle(reject, err));
      });
    } catch (err: any) {
      console.error(`[VerificationBundle] Error generating bundle for idea ${ideaId}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ message: err.message || "Failed to generate verification bundle" });
      } else {
        if (archive && !archive.destroyed) {
          archive.destroy();
        }
        if (!res.writableEnded) {
          res.end();
        }
      }
    }
  });
}
