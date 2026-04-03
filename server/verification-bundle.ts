import type { Express, Request, Response } from "express";
import archiver from "archiver";
import { storage } from "./storage";
import { chatStorage } from "./replit_integrations/chat/storage";
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
      const finalQualityReport = isCachedRun ? (pipelineResult?.finalQualityReport || null) : null;

      const artifactSources: Record<string, string> = {
        manifest: "generated",
        "pipeline-diagnostics": "database",
      };

      if (isCachedRun && pipelineResult?.packageBuffer && pipelineResult.packageBuffer.length > 0) {
        artifactSources["nupkg"] = "cache";
      } else if (!isCachedRun) {
        artifactSources["nupkg"] = "unavailable-cache-expired";
      }

      if (dhgContent) {
        artifactSources["dhg"] = targetRun.dhgContent ? "database" : "cache";
      }

      if (isCachedRun && pipelineResult?.qualityGateResult) {
        artifactSources["quality-gate-results"] = "cache";
      } else if (targetRun.outcomeReport) {
        artifactSources["quality-gate-results"] = "outcome-report-fallback";
      } else if (!isCachedRun) {
        artifactSources["quality-gate-results"] = "unavailable-cache-expired";
      }

      if (isCachedRun && pipelineResult?.metaValidationResult) {
        artifactSources["meta-validation-results"] = "cache";
      } else if (!isCachedRun) {
        artifactSources["meta-validation-results"] = "unavailable-cache-expired";
      }

      if (targetRun.outcomeReport) {
        artifactSources["outcome-report"] = "database";
      }

      if (finalQualityReport) {
        artifactSources["final-quality-report"] = "cache";
      } else if (!isCachedRun) {
        artifactSources["final-quality-report"] = "unavailable-cache-expired";
      }

      if (targetRun.specSnapshot) {
        artifactSources["spec-snapshot"] = "database";
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

      if (isCachedRun && pipelineResult?.packageBuffer && pipelineResult.packageBuffer.length > 0) {
        serializedArtifacts.push({ data: pipelineResult.packageBuffer, name: `${safeProjectName}.nupkg` });
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
