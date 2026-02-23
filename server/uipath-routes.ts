import type { Express, Request, Response } from "express";
import { getUiPathConfig, saveUiPathConfig, testUiPathConnection, pushToUiPath, getLastTestedAt, fetchUiPathFolders, saveUiPathFolder, createProcess, listMachines, listRobots, listProcesses, startJob, getJobStatus, runHealthCheck, verifyUiPathScopes } from "./uipath-integration";
import { parseArtifactsFromSDD, extractArtifactsWithLLM, deployAllArtifacts, formatDeploymentReport } from "./uipath-deploy";
import { documentStorage } from "./document-storage";
import { chatStorage } from "./replit_integrations/chat/storage";
import { storage } from "./storage";

function requireAdmin(req: Request, res: Response): boolean {
  if (!req.session.userId) {
    res.status(401).json({ message: "Not authenticated" });
    return false;
  }
  const role = req.session.activeRole || "";
  if (role !== "Admin") {
    res.status(403).json({ message: "Admin access required" });
    return false;
  }
  return true;
}

export function registerUiPathRoutes(app: Express): void {
  app.get("/api/settings/uipath", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const config = await getUiPathConfig();
    const lastTestedAt = await getLastTestedAt();
    if (!config) {
      return res.json({ configured: false, lastTestedAt });
    }
    return res.json({
      configured: true,
      orgName: config.orgName,
      tenantName: config.tenantName,
      clientId: config.clientId,
      scopes: config.scopes,
      hasSecret: !!config.clientSecret,
      lastTestedAt,
      folderId: config.folderId || null,
      folderName: config.folderName || null,
    });
  });

  app.get("/api/settings/uipath/folders", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await fetchUiPathFolders();
    return res.json(result);
  });

  app.post("/api/settings/uipath/folder", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const { folderId, folderName } = req.body;
    await saveUiPathFolder(folderId || null, folderName || null);
    return res.json({ success: true });
  });

  app.post("/api/settings/uipath", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const { orgName, tenantName, clientId, clientSecret, scopes } = req.body;
    if (!orgName || !tenantName || !clientId) {
      return res.status(400).json({ message: "Organization, tenant, and client ID are required" });
    }
    const existingConfig = await getUiPathConfig();
    if (!clientSecret && !existingConfig) {
      return res.status(400).json({ message: "App Secret is required for initial configuration" });
    }
    await saveUiPathConfig({ orgName, tenantName, clientId, clientSecret: clientSecret || undefined, scopes: scopes || undefined });

    const testResult = await testUiPathConnection();
    return res.json({
      success: true,
      message: "UiPath configuration saved.",
      testResult,
    });
  });

  app.post("/api/settings/uipath/test", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await testUiPathConnection();
    return res.json(result);
  });

  app.get("/api/settings/uipath/verify-scopes", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await verifyUiPathScopes();
    return res.json(result);
  });

  app.get("/api/settings/uipath/status", async (_req: Request, res: Response) => {
    const config = await getUiPathConfig();
    return res.json({ configured: !!config });
  });

  app.get("/api/settings/uipath/machines", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await listMachines();
    return res.json(result);
  });

  app.get("/api/settings/uipath/robots", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await listRobots();
    return res.json(result);
  });

  app.get("/api/settings/uipath/processes", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await listProcesses();
    return res.json(result);
  });

  app.get("/api/settings/uipath/health-check", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const packageId = req.query.packageId as string | undefined;
    const result = await runHealthCheck(packageId || undefined);
    return res.json(result);
  });

  app.post("/api/ideas/:ideaId/create-process", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const ideaId = req.params.ideaId as string;
    const idea = await storage.getIdea(ideaId);
    if (!idea) return res.status(404).json({ message: "Idea not found" });

    const user = await storage.getUser(req.session.userId as string);
    if (!user) return res.status(401).json({ message: "User not found" });
    const activeRole = (req.session.activeRole || user.role) as string;
    if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { packageId, packageVersion, processName, description } = req.body;
    if (!packageId || !packageVersion || !processName) {
      return res.status(400).json({ message: "packageId, packageVersion, and processName are required" });
    }

    const result = await createProcess(packageId, packageVersion, processName, description);
    return res.json(result);
  });

  app.post("/api/ideas/:ideaId/start-job", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const ideaId = req.params.ideaId as string;
    const idea = await storage.getIdea(ideaId);
    if (!idea) return res.status(404).json({ message: "Idea not found" });

    const user = await storage.getUser(req.session.userId as string);
    if (!user) return res.status(401).json({ message: "User not found" });
    const activeRole = (req.session.activeRole || user.role) as string;
    if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { releaseKey, robotIds } = req.body;
    if (!releaseKey) {
      return res.status(400).json({ message: "releaseKey is required" });
    }

    const result = await startJob(releaseKey, robotIds);

    if (result.success) {
      await chatStorage.createMessage(
        ideaId,
        "assistant",
        `Job started in UiPath Orchestrator.\n\nJob ID: ${result.job?.id}\nState: ${result.job?.state}\n\nMonitor progress in Orchestrator > Jobs, or use the status check below.`
      );
    } else {
      await chatStorage.createMessage(ideaId, "assistant", `Failed to start job: ${result.message}`);
    }

    return res.json(result);
  });

  app.get("/api/ideas/:ideaId/job-status/:jobId", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const jobId = parseInt(req.params.jobId as string, 10);
    if (isNaN(jobId)) return res.status(400).json({ message: "Invalid job ID" });

    const result = await getJobStatus(jobId);
    return res.json(result);
  });

  app.post("/api/ideas/:ideaId/push-uipath", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const ideaId = req.params.ideaId as string;
    const idea = await storage.getIdea(ideaId);
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }

    const user = await storage.getUser(req.session.userId as string);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    const activeRole = (req.session.activeRole || user.role) as string;
    if (idea.ownerEmail !== user.email && activeRole !== "Admin" && activeRole !== "CoE") {
      return res.status(403).json({ message: "Access denied" });
    }

    const messages = await chatStorage.getMessagesByIdeaId(ideaId);
    const uipathMsg = [...messages].reverse().find((m) => m.content.startsWith("[UIPATH:"));
    if (!uipathMsg) {
      return res.status(404).json({ message: "No UiPath package found. Generate it first." });
    }

    let pkg;
    try {
      let jsonStr = uipathMsg.content.slice(8);
      if (jsonStr.endsWith("]")) jsonStr = jsonStr.slice(0, -1);
      const braceEnd = jsonStr.lastIndexOf("}");
      if (braceEnd !== -1) jsonStr = jsonStr.slice(0, braceEnd + 1);
      pkg = JSON.parse(jsonStr);
    } catch {
      return res.status(500).json({ message: "Invalid package data" });
    }

    const result = await pushToUiPath(pkg);

    if (result.success) {
      const details = result.details;
      const packageId = details?.packageId || pkg.projectName;
      const packageVersion = details?.version || "1.0.0";

      let processResult: { success: boolean; message: string; process?: any } = { success: false, message: "" };
      try {
        const processName = packageId.replace(/_/g, " ");
        processResult = await createProcess(packageId, packageVersion, processName, pkg.description);
        if (processResult.success && processResult.process) {
          result.details = {
            ...result.details,
            processId: processResult.process.Id || processResult.process.id,
            processName: processResult.process.Name || processResult.process.name,
            releaseKey: processResult.process.Key || processResult.process.key,
          };
        }
      } catch (err: any) {
        console.error("[UiPath] Auto-create process failed:", err.message);
      }

      const folderLine = details?.folderName
        ? `Folder: **${details.folderName}**`
        : `Location: Tenant feed`;
      const processLine = processResult.success
        ? `\n**Process created:** "${result.details?.processName}" — ready to run`
        : `\n**Process:** Could not auto-create (${processResult.message}). You may need to create it manually in Orchestrator.`;

      let deploymentReport = "";
      try {
        const sdd = await documentStorage.getLatestDocument(ideaId, "SDD");
        if (sdd?.content) {
          let artifacts = parseArtifactsFromSDD(sdd.content);

          if (!artifacts) {
            console.log("[UiPath] No artifacts block in SDD, attempting LLM extraction...");
            artifacts = await extractArtifactsWithLLM(sdd.content);
          }

          if (artifacts && (
            (artifacts.queues?.length || 0) > 0 ||
            (artifacts.assets?.length || 0) > 0 ||
            (artifacts.machines?.length || 0) > 0 ||
            (artifacts.triggers?.length || 0) > 0 ||
            (artifacts.storageBuckets?.length || 0) > 0 ||
            (artifacts.environments?.length || 0) > 0 ||
            (artifacts.actionCenter?.length || 0) > 0 ||
            (artifacts.documentUnderstanding?.length || 0) > 0 ||
            (artifacts.testCases?.length || 0) > 0
          )) {
            const releaseId = result.details?.processId || null;
            const releaseKey = result.details?.releaseKey || null;
            const releaseName = result.details?.processName || null;
            const totalArtifacts = (artifacts.queues?.length || 0) + (artifacts.assets?.length || 0) +
              (artifacts.machines?.length || 0) + (artifacts.triggers?.length || 0) +
              (artifacts.storageBuckets?.length || 0) + (artifacts.environments?.length || 0) +
              (artifacts.actionCenter?.length || 0) + (artifacts.documentUnderstanding?.length || 0) +
              (artifacts.testCases?.length || 0);
            console.log(`[UiPath] Found ${totalArtifacts} SDD artifacts, deploying... (releaseId=${releaseId}, releaseName=${releaseName})`);

            const deployResult = await deployAllArtifacts(artifacts, releaseId, releaseKey, releaseName);
            deploymentReport = formatDeploymentReport(deployResult.results);

            result.details = {
              ...result.details,
              deploymentResults: deployResult.results,
              deploymentSummary: deployResult.summary,
            };
          } else {
            console.warn("[UiPath] No artifacts could be extracted from SDD (content length:", sdd.content.length, ")");
            deploymentReport = "\n\n⚠️ No Orchestrator artifacts (queues, assets, triggers) could be extracted from the SDD. The SDD may be missing the deployment specification section. Ask me to **revise the SDD** and I will regenerate it with the full Orchestrator Deployment Specification including all artifacts.";
          }
        } else {
          console.warn("[UiPath] No SDD found for idea, skipping artifact provisioning");
          deploymentReport = "\n\nNo SDD found — artifact provisioning skipped. Generate and approve an SDD to enable automatic artifact provisioning.";
        }
      } catch (err: any) {
        console.error("[UiPath] Artifact deployment failed:", err.message);
        deploymentReport = `\n\nArtifact deployment encountered an error: ${err.message}`;
      }

      const chatMsg = [
        `Package pushed to UiPath Orchestrator successfully.`,
        ``,
        `**${packageId}** v${packageVersion}`,
        `Org: ${details?.orgName || "—"} / Tenant: ${details?.tenantName || "—"}`,
        folderLine,
        processLine,
        deploymentReport,
        ``,
        processResult.success
          ? `The automation is now deployed and ready. You can trigger a job from this workspace or from Orchestrator directly.`
          : `Create a Process from this package in Orchestrator to make it runnable.`,
      ].join("\n");

      await chatStorage.createMessage(ideaId, "assistant", chatMsg);
    } else {
      await chatStorage.createMessage(
        ideaId,
        "assistant",
        `Failed to push to UiPath Orchestrator. ${result.message}`
      );
    }

    return res.json(result);
  });
}
