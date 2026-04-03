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

      const latestRun = await storage.getLatestGenerationRunForIdea(ideaId);
      if (!latestRun) {
        return res.status(404).json({
          message: "No generation run found for this idea. Generate a package first.",
        });
      }

      const pipelineResult = getCachedPipelineResult(ideaId);

      const messages = await chatStorage.getMessagesByIdeaId(ideaId);
      const uipathMsg = findUiPathMessage(messages);
      let packageData: any = null;
      if (uipathMsg) {
        try {
          packageData = parseUiPathPackage(uipathMsg);
        } catch {}
      }

      const now = new Date().toISOString();

      const dhgContent = latestRun.dhgContent || pipelineResult?.dhgContent || null;
      const finalQualityReport = pipelineResult?.finalQualityReport || null;

      const artifactSources: Record<string, string> = {
        manifest: "generated",
        "pipeline-diagnostics": "database",
      };
      if (pipelineResult?.packageBuffer && pipelineResult.packageBuffer.length > 0) {
        artifactSources["nupkg"] = "cache";
      }
      if (dhgContent) {
        artifactSources["dhg"] = latestRun.dhgContent ? "database" : "cache";
      }
      if (pipelineResult?.qualityGateResult) {
        artifactSources["quality-gate-results"] = "cache";
      } else if (latestRun.outcomeReport) {
        artifactSources["quality-gate-results"] = "outcome-report-fallback";
      }
      if (pipelineResult?.metaValidationResult) {
        artifactSources["meta-validation-results"] = "cache";
      }
      if (latestRun.outcomeReport) {
        artifactSources["outcome-report"] = "database";
      }
      if (finalQualityReport) {
        artifactSources["final-quality-report"] = "cache";
      }
      if (latestRun.specSnapshot) {
        artifactSources["spec-snapshot"] = "database";
      }

      const manifest = {
        ideaId,
        ideaTitle: idea.title,
        ideaDescription: idea.description,
        generationRunId: latestRun.runId,
        generationMode: latestRun.generationMode,
        generationStatus: latestRun.status,
        triggeredBy: latestRun.triggeredBy,
        createdAt: latestRun.createdAt,
        completedAt: latestRun.completedAt,
        bundleGeneratedAt: now,
        projectName: packageData?.projectName || pipelineResult?.projectName || idea.title,
        cacheAvailable: !!pipelineResult,
        artifactSources,
      };

      let outcomeReport: any = null;
      if (latestRun.outcomeReport) {
        try {
          outcomeReport = JSON.parse(latestRun.outcomeReport);
        } catch {}
      }

      let qualityGateResults: any = null;
      if (pipelineResult?.qualityGateResult) {
        qualityGateResults = pipelineResult.qualityGateResult;
      } else if (outcomeReport?.pipelineOutcome) {
        qualityGateResults = {
          source: "outcome-report-fallback",
          qualityWarnings: outcomeReport.pipelineOutcome.qualityWarnings,
          remediations: outcomeReport.pipelineOutcome.remediations,
        };
      }

      let metaValidationResults: any = null;
      if (pipelineResult?.metaValidationResult) {
        metaValidationResults = pipelineResult.metaValidationResult;
      }

      let stageLog: any = null;
      if (latestRun.stageLog) {
        stageLog = latestRun.stageLog;
      }

      let phaseProgress: any = null;
      if (latestRun.phaseProgress) {
        try {
          phaseProgress = JSON.parse(latestRun.phaseProgress);
        } catch {}
      }

      const pipelineDiagnostics = {
        runId: latestRun.runId,
        status: latestRun.status,
        currentPhase: latestRun.currentPhase,
        errorMessage: latestRun.errorMessage,
        stageLog,
        phaseProgress,
        createdAt: latestRun.createdAt,
        completedAt: latestRun.completedAt,
      };

      const safeProjectName = (manifest.projectName || "VerificationBundle").replace(/[^a-zA-Z0-9_-]/g, "_");

      const serializedArtifacts: Array<{ data: string | Buffer; name: string }> = [];
      serializedArtifacts.push({ data: JSON.stringify(manifest, null, 2), name: "manifest.json" });

      if (pipelineResult?.packageBuffer && pipelineResult.packageBuffer.length > 0) {
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

      if (latestRun.specSnapshot) {
        serializedArtifacts.push({ data: JSON.stringify(latestRun.specSnapshot, null, 2), name: "spec-snapshot.json" });
      }

      archive = archiver("zip", { zlib: { level: 9 } });
      const zip = archive;
      let finalized = false;
      let settled = false;

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${safeProjectName}_verification_bundle.zip"`);

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
