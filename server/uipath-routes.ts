import type { Express, Request, Response } from "express";
import { getUiPathConfig, getAccessToken, saveUiPathConfig, testUiPathConnection, pushToUiPath, getLastTestedAt, fetchUiPathFolders, saveUiPathFolder, createProcess, listMachines, listRobots, listProcesses, startJob, getJobStatus, runHealthCheck, verifyUiPathScopes, probeUiPathScopes, autoDetectUiPathScopes } from "./uipath-integration";
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

  app.get("/api/settings/uipath/probe-scopes", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await probeUiPathScopes();
    return res.json(result);
  });

  app.post("/api/settings/uipath/auto-detect-scopes", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const result = await autoDetectUiPathScopes();
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

      const deployResults = result.details?.deploymentResults || [];
      const createdCount = deployResults.filter((r: any) => r.status === "created").length;
      const failedCount = deployResults.filter((r: any) => r.status === "failed").length;
      const skippedCount = deployResults.filter((r: any) => r.status === "skipped").length;

      let statusLine = "";
      if (deployResults.length > 0) {
        if (failedCount > 0) {
          statusLine = `${createdCount} artifact(s) provisioned, ${failedCount} failed — see the deployment report for details.`;
        } else if (skippedCount > 0) {
          statusLine = `${createdCount} artifact(s) provisioned, ${skippedCount} skipped (service not available on tenant).`;
        } else if (createdCount > 0) {
          statusLine = `All ${createdCount} artifact(s) provisioned successfully.`;
        }
      } else if (deploymentReport) {
        statusLine = deploymentReport.replace(/^\n+/, "");
      }

      const chatMsg = [
        `Package deployed to UiPath Orchestrator.`,
        ``,
        `**${packageId}** v${packageVersion}`,
        processLine,
        statusLine,
        ``,
        processResult.success
          ? `The automation is ready. You can trigger a job from this workspace or from Orchestrator.`
          : `Create a Process from this package in Orchestrator to make it runnable.`,
      ].filter(Boolean).join("\n");

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

  app.get("/api/admin/uipath-diagnostic", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const config = await getUiPathConfig();
    if (!config) return res.json({ error: "UiPath not configured" });

    const ts = Date.now();
    const results: Record<string, any> = { timestamp: new Date().toISOString(), config: { orgName: config.orgName, tenantName: config.tenantName, folderId: config.folderId, folderName: config.folderName } };

    async function safeCall(label: string, url: string, opts: RequestInit = {}): Promise<{ status: number; text: string; data: any; ok: boolean; headers?: Record<string, string> }> {
      try {
        const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
        const text = await r.text();
        let data = null;
        try { data = JSON.parse(text); } catch {}
        return { status: r.status, text: text.slice(0, 2000), data, ok: r.ok };
      } catch (e: any) {
        return { status: 0, text: e.message, data: null, ok: false };
      }
    }

    try {
      const token = await getAccessToken(config);
      const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
      const hdrs: Record<string, string> = { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
      if (config.folderId) hdrs["X-UIPATH-OrganizationUnitId"] = config.folderId;
      results.tokenAcquired = true;

      // ── QUEUES ──
      {
        const sec: any = { artifact: "Queue", steps: [] };
        const list = await safeCall("list", `${base}/odata/QueueDefinitions?$top=3`, { headers: hdrs });
        sec.steps.push({ step: "list", url: `${base}/odata/QueueDefinitions?$top=3`, method: "GET", ...list });
        const body = { Name: `CB_Diag_Queue_${ts}`, Description: "CannonBall diagnostic test", MaxNumberOfRetries: 1, EnforceUniqueReference: false };
        const create = await safeCall("create", `${base}/odata/QueueDefinitions`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
        sec.steps.push({ step: "create", url: `${base}/odata/QueueDefinitions`, method: "POST", requestBody: body, ...create });
        sec.overallStatus = create.ok ? "working" : `failed (${create.status})`;
        if (create.ok && create.data?.Id) {
          const del = await safeCall("cleanup", `${base}/odata/QueueDefinitions(${create.data.Id})`, { method: "DELETE", headers: hdrs });
          sec.steps.push({ step: "cleanup", method: "DELETE", ...del });
        }
        results.queues = sec;
      }

      // ── ASSETS ──
      {
        const sec: any = { artifact: "Asset", steps: [] };
        const list = await safeCall("list", `${base}/odata/Assets?$top=3`, { headers: hdrs });
        sec.steps.push({ step: "list", url: `${base}/odata/Assets?$top=3`, method: "GET", ...list });
        const body = { Name: `CB_Diag_Asset_${ts}`, ValueType: "Text", StringValue: "diag_value", Description: "CannonBall diagnostic" };
        const create = await safeCall("create", `${base}/odata/Assets`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
        sec.steps.push({ step: "create", url: `${base}/odata/Assets`, method: "POST", requestBody: body, ...create });
        sec.overallStatus = create.ok ? "working" : `failed (${create.status})`;
        if (create.ok && create.data?.Id) {
          const del = await safeCall("cleanup", `${base}/odata/Assets(${create.data.Id})`, { method: "DELETE", headers: hdrs });
          sec.steps.push({ step: "cleanup", method: "DELETE", ...del });
        }
        results.assets = sec;
      }

      // ── MACHINES ──
      {
        const sec: any = { artifact: "Machine", steps: [] };
        const list = await safeCall("list", `${base}/odata/Machines?$top=3`, { headers: hdrs });
        sec.steps.push({ step: "list", url: `${base}/odata/Machines?$top=3`, method: "GET", ...list });
        const body = { Name: `CB_Diag_Machine_${ts}`, Type: "Standard", Description: "CannonBall diagnostic" };
        const create = await safeCall("create", `${base}/odata/Machines`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
        sec.steps.push({ step: "create", url: `${base}/odata/Machines`, method: "POST", requestBody: body, ...create });
        if (!create.ok) {
          const bodyTpl = { Name: `CB_Diag_MachineTpl_${ts}`, Description: "CannonBall diagnostic", NonProductionSlots: 0, UnattendedSlots: 1 };
          const createTpl = await safeCall("create_template", `${base}/odata/Machines`, { method: "POST", headers: hdrs, body: JSON.stringify(bodyTpl) });
          sec.steps.push({ step: "create_template", requestBody: bodyTpl, ...createTpl });
          sec.overallStatus = createTpl.ok ? "working (template)" : `failed (${create.status}, template ${createTpl.status})`;
        } else {
          sec.overallStatus = "working";
        }
        results.machines = sec;
      }

      // ── STORAGE BUCKETS ──
      {
        const sec: any = { artifact: "StorageBucket", steps: [] };
        const list = await safeCall("list", `${base}/odata/Buckets?$top=3`, { headers: hdrs });
        sec.steps.push({ step: "list", url: `${base}/odata/Buckets?$top=3`, method: "GET", ...list });

        function diagUuid() {
          const h = "0123456789abcdef";
          let u = "";
          for (let i = 0; i < 36; i++) {
            if (i === 8 || i === 13 || i === 18 || i === 23) u += "-";
            else if (i === 14) u += "4";
            else u += h[Math.floor(Math.random() * 16)];
          }
          return u;
        }
        const bucketVariants = [
          { Name: `CB_Diag_Bucket_${ts}`, Identifier: diagUuid(), Description: "CannonBall diagnostic", StorageProvider: "Orchestrator" },
          { Name: `CB_Diag_Bucket2_${ts}`, Identifier: diagUuid(), Description: "CannonBall diagnostic" },
        ];
        let bucketCreated = false;
        for (const body of bucketVariants) {
          const provLabel = (body as any).StorageProvider || "none";
          const create = await safeCall(`create_${provLabel}`, `${base}/odata/Buckets`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
          sec.steps.push({ step: `create_${provLabel}`, url: `${base}/odata/Buckets`, method: "POST", requestBody: body, ...create });
          if (create.ok) {
            sec.overallStatus = `working (StorageProvider=${provLabel})`;
            bucketCreated = true;
            if (create.data?.Id) {
              await safeCall("cleanup", `${base}/odata/Buckets(${create.data.Id})`, { method: "DELETE", headers: hdrs });
            }
            break;
          }
        }
        if (!bucketCreated) sec.overallStatus = `failed (all variants)`;
        results.storageBuckets = sec;
      }

      // ── ENVIRONMENTS ──
      {
        const sec: any = { artifact: "Environment", steps: [] };
        const list = await safeCall("list", `${base}/odata/Environments?$top=3`, { headers: hdrs });
        sec.steps.push({ step: "list", url: `${base}/odata/Environments?$top=3`, method: "GET", ...list });
        const body = { Name: `CB_Diag_Env_${ts}`, Description: "CannonBall diagnostic", Type: "Dev" };
        const create = await safeCall("create", `${base}/odata/Environments`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
        sec.steps.push({ step: "create", url: `${base}/odata/Environments`, method: "POST", requestBody: body, ...create });
        sec.overallStatus = create.ok ? "working" : `failed (${create.status})`;
        results.environments = sec;
      }

      // ── TRIGGERS (probe only, needs process) ──
      {
        const sec: any = { artifact: "Trigger", steps: [] };
        const list = await safeCall("list", `${base}/odata/ProcessSchedules?$top=3`, { headers: hdrs });
        sec.steps.push({ step: "list", url: `${base}/odata/ProcessSchedules?$top=3`, method: "GET", ...list });
        sec.overallStatus = list.ok ? "endpoint available (creation needs process)" : `endpoint unavailable (${list.status})`;
        results.triggers = sec;
      }

      // ── USERS / ROBOT ACCOUNTS ──
      {
        const sec: any = { artifact: "RobotAccount", steps: [] };
        const listUsers = await safeCall("list_users", `${base}/odata/Users?$top=5`, { headers: hdrs });
        sec.steps.push({ step: "list_users", url: `${base}/odata/Users?$top=5`, method: "GET", ...listUsers });

        let pmToken: string | null = null;
        try {
          const pmScopes = "PM.RobotAccount PM.RobotAccount.Read PM.RobotAccount.Write";
          const pmParams = new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret, scope: pmScopes });
          pmParams.append("acr_values", `tenantId:${config.orgName}`);
          const pmRes = await safeCall("pm_token", "https://cloud.uipath.com/identity_/connect/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: pmParams.toString() });
          sec.steps.push({ step: "pm_token", ...pmRes, scopesRequested: pmScopes, scopesGranted: pmRes.data?.scope || null });
          if (pmRes.ok && pmRes.data?.access_token) pmToken = pmRes.data.access_token;
        } catch {}

        if (pmToken) {
          const pmHdrs = { "Authorization": `Bearer ${pmToken}`, "Content-Type": "application/json" };
          const identityUrls = [
            `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/identity_/api/RobotAccount`,
            `https://cloud.uipath.com/${config.orgName}/identity_/api/RobotAccount`,
          ];
          const robotBody = { name: `CB_Diag_Robot_${ts}`, displayName: `CB_Diag_Robot_${ts}`, domain: "UiPath" };
          let robotCreated = false;
          let robotId: any = null;
          for (const idUrl of identityUrls) {
            const create = await safeCall("create_robot", idUrl, { method: "POST", headers: pmHdrs, body: JSON.stringify(robotBody) });
            sec.steps.push({ step: "create_robot", url: idUrl, method: "POST", requestBody: robotBody, ...create });
            const isHtml = create.text.trimStart().startsWith("<!") || create.text.trimStart().startsWith("<html");
            if (isHtml) {
              sec.steps[sec.steps.length - 1].note = "Response is HTML (web page, not API)";
              continue;
            }
            if (create.ok && create.data) {
              robotCreated = true;
              robotId = create.data?.id || create.data?.Id;
              if (robotId && config.folderId) {
                const assignBody = { assignments: { UserIds: [robotId], RolesPerFolder: [{ FolderId: parseInt(config.folderId, 10), Roles: [{ Name: "Executor" }] }] } };
                const assign = await safeCall("assign_folder", `${base}/odata/Folders/UiPath.Server.Configuration.OData.AssignUsers`, { method: "POST", headers: hdrs, body: JSON.stringify(assignBody) });
                sec.steps.push({ step: "assign_folder", requestBody: assignBody, ...assign });
              }
              break;
            }
          }
          if (!robotCreated) {
            const odataBody = { UserName: `CB_Diag_Robot_OData_${ts}`, Name: "CB_Diag", Surname: "Robot", RolesList: ["Robot"], Type: "Robot" };
            const odataCreate = await safeCall("create_via_odata", `${base}/odata/Users`, { method: "POST", headers: hdrs, body: JSON.stringify(odataBody) });
            sec.steps.push({ step: "create_via_odata_with_pm", url: `${base}/odata/Users`, requestBody: odataBody, ...odataCreate });
            if (odataCreate.ok) {
              robotCreated = true;
              robotId = odataCreate.data?.Id || odataCreate.data?.id;
            }
          }
          sec.overallStatus = robotCreated ? "working" : "pm_token_ok_but_all_approaches_failed";
        } else {
          const odataBody = { UserName: `CB_Diag_Robot_${ts}`, Name: "CB_Diag", Surname: "Robot", RolesList: ["Robot"], Type: "Robot" };
          const odataCreate = await safeCall("create_via_odata", `${base}/odata/Users`, { method: "POST", headers: hdrs, body: JSON.stringify(odataBody) });
          sec.steps.push({ step: "create_via_odata", url: `${base}/odata/Users`, requestBody: odataBody, ...odataCreate });
          sec.overallStatus = odataCreate.ok ? "working (odata fallback)" : `no_pm_token_and_odata_failed (${odataCreate.status})`;
        }
        results.robotAccounts = sec;
      }

      // ── ACTION CENTER ──
      {
        const sec: any = { artifact: "ActionCenter", steps: [] };
        const actionsBase = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/actions_/api/v1`;
        const probeActions = await safeCall("probe_actions", `${actionsBase}/TaskCatalogs?$top=1`, { headers: hdrs });
        sec.steps.push({ step: "probe_actions", url: `${actionsBase}/TaskCatalogs?$top=1`, ...probeActions });

        const probeOdata = await safeCall("probe_odata", `${base}/odata/TaskCatalogs?$top=1`, { headers: hdrs });
        sec.steps.push({ step: "probe_odata", url: `${base}/odata/TaskCatalogs?$top=1`, ...probeOdata });

        const catalogBody = { Name: `CB_Diag_Catalog_${ts}`, Description: "CannonBall diagnostic" };

        const isActionsGenuineApi = probeActions.ok && !probeActions.text.trimStart().startsWith("<!") && !probeActions.text.trimStart().startsWith("<html");
        let acCreated = false;

        if (isActionsGenuineApi) {
          const create = await safeCall("create_actions", `${actionsBase}/TaskCatalogs`, { method: "POST", headers: hdrs, body: JSON.stringify(catalogBody) });
          sec.steps.push({ step: "create_actions", requestBody: catalogBody, ...create });
          if (create.ok) { acCreated = true; sec.overallStatus = "working (actions microservice)"; }
        } else if (probeActions.ok) {
          sec.steps.push({ step: "probe_actions_note", note: "Actions probe returned 200 but with HTML (web UI, not API) — skipping Actions POST" });
        }

        if (!acCreated && probeOdata.ok && probeOdata.data?.["@odata.context"]) {
          const catalogBody2 = { Name: `CB_Diag_Catalog_OData_${ts}`, Description: "CannonBall diagnostic via OData" };
          const createOdata = await safeCall("create_odata", `${base}/odata/TaskCatalogs`, { method: "POST", headers: hdrs, body: JSON.stringify(catalogBody2) });
          sec.steps.push({ step: "create_odata", url: `${base}/odata/TaskCatalogs`, requestBody: catalogBody2, ...createOdata });
          if (createOdata.ok) {
            acCreated = true;
            sec.overallStatus = "working (odata)";
            if (createOdata.data?.Id) {
              await safeCall("cleanup", `${base}/odata/TaskCatalogs(${createOdata.data.Id})`, { method: "DELETE", headers: hdrs });
            }
          }
        }

        if (!acCreated) {
          const genericEndpoints = [
            { url: `${base}/tasks/GenericTasks/CreateTask`, body: { Title: `CB_Diag_Task_${ts}`, Priority: "Medium", TaskCatalogName: `CB_Diag_Catalog_${ts}`, Type: "ExternalTask" }, label: "create_generic_external" },
            { url: `${base}/tasks/GenericTasks/CreateTask`, body: { Title: `CB_Diag_Task2_${ts}`, Priority: "Medium", TaskCatalogName: `CB_Diag_Catalog2_${ts}`, Type: "ExternalAction" }, label: "create_generic_externalaction" },
            { url: `${base}/tasks/GenericTasks/CreateTask`, body: { Title: `CB_Diag_Task3_${ts}`, Priority: "Medium", TaskCatalogName: `CB_Diag_Catalog3_${ts}`, TaskType: "ExternalAction" }, label: "create_generic_tasktype" },
            { url: `${base}/tasks/GenericTasks/CreateTask`, body: { Title: `CB_Diag_Task4_${ts}`, Priority: "Medium", TaskCatalogName: `CB_Diag_Catalog4_${ts}` }, label: "create_generic_notype" },
          ];
          for (const ep of genericEndpoints) {
            const result = await safeCall(ep.label, ep.url, { method: "POST", headers: hdrs, body: JSON.stringify(ep.body) });
            sec.steps.push({ step: ep.label, url: ep.url, requestBody: ep.body, ...result });
            if (result.ok || result.status === 201) {
              acCreated = true;
              sec.overallStatus = `working (${ep.label})`;
              const checkResult = await safeCall("verify_catalog", `${base}/odata/TaskCatalogs?$top=5`, { headers: hdrs });
              sec.steps.push({ step: "verify_catalog_after_task", ...checkResult });
              break;
            }
          }
        }

        if (!acCreated) {
          sec.overallStatus = `all_approaches_failed`;
        }
        results.actionCenter = sec;
      }

      // ── TEST DATA QUEUES ──
      {
        const sec: any = { artifact: "TestDataQueue", steps: [] };
        const list = await safeCall("list", `${base}/odata/TestDataQueues?$top=3`, { headers: hdrs });
        sec.steps.push({ step: "list", url: `${base}/odata/TestDataQueues?$top=3`, method: "GET", ...list });

        const defaultSchema = JSON.stringify({ type: "object", properties: { TestInput: { type: "string" }, ExpectedOutput: { type: "string" } } });
        const tdqVariants = [
          { Name: `CB_Diag_TDQ_${ts}`, Description: "CannonBall diagnostic", ContentJsonSchema: defaultSchema },
          { Name: `CB_Diag_TDQ2_${ts}`, Description: "CannonBall diagnostic" },
        ];
        let tdqCreated = false;
        for (const body of tdqVariants) {
          const label = (body as any).ContentJsonSchema ? "with_schema" : "no_schema";
          const create = await safeCall(`create_${label}`, `${base}/odata/TestDataQueues`, { method: "POST", headers: hdrs, body: JSON.stringify(body) });
          sec.steps.push({ step: `create_${label}`, requestBody: body, ...create });
          if (create.ok) {
            sec.overallStatus = `working (${label})`;
            tdqCreated = true;
            break;
          }
        }
        if (!tdqCreated) sec.overallStatus = `failed (all variants)`;
        results.testDataQueues = sec;
      }

      // ── DOCUMENT UNDERSTANDING ──
      {
        const sec: any = { artifact: "DocumentUnderstanding", steps: [] };
        const duBases = [
          `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/du_/api/framework/projects`,
          `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/documentunderstanding_/api/framework/projects`,
        ];
        for (const duUrl of duBases) {
          const probe = await safeCall("probe", `${duUrl}?$top=1`, { headers: hdrs });
          sec.steps.push({ step: "probe", url: duUrl, ...probe });
          if (probe.ok) {
            sec.overallStatus = "available";
            break;
          }
        }
        if (!sec.overallStatus) sec.overallStatus = "not_available";
        results.documentUnderstanding = sec;
      }

      // ── TEST MANAGER ──
      {
        const sec: any = { artifact: "TestManager", steps: [] };
        let tmToken: string | null = null;
        const tmScopes = "TM.Projects TM.Projects.Read TM.Projects.Write TM.TestCases TM.TestCases.Read TM.TestCases.Write TM.TestSets TM.TestSets.Read TM.TestSets.Write";
        try {
          const tmParams = new URLSearchParams({ grant_type: "client_credentials", client_id: config.clientId, client_secret: config.clientSecret, scope: tmScopes });
          const tmRes = await safeCall("tm_token", "https://cloud.uipath.com/identity_/connect/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: tmParams.toString() });
          sec.steps.push({ step: "tm_token", scopesRequested: tmScopes, scopesGranted: tmRes.data?.scope || null, ...tmRes });
          if (tmRes.ok && tmRes.data?.access_token) tmToken = tmRes.data.access_token;
        } catch {}

        if (!tmToken) {
          sec.overallStatus = "no_tm_token";
          results.testManager = sec;
        } else {
          const tmHdrs: Record<string, string> = { "Authorization": `Bearer ${tmToken}`, "Content-Type": "application/json", "Accept": "application/json" };
          const tmBases = [
            `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/testmanager_`,
            `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/tmapi_`,
            `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/testmanager`,
          ];

          let activeTmBase: string | null = null;
          for (const tmBase of tmBases) {
            const probe = await safeCall("probe", `${tmBase}/api/v2/Projects?$top=10`, { headers: tmHdrs, redirect: "manual" });
            sec.steps.push({ step: "probe", url: `${tmBase}/api/v2/Projects?$top=10`, ...probe });
            if (probe.ok && !probe.text.startsWith("<")) {
              activeTmBase = tmBase;
              break;
            }
          }

          if (!activeTmBase) {
            sec.overallStatus = "no_active_base_url";
            results.testManager = sec;
          } else {
            let projectId: number | null = null;
            let projectPrefix: string | null = null;

            const listProj = await safeCall("list_projects", `${activeTmBase}/api/v2/Projects?$top=50`, { headers: tmHdrs });
            sec.steps.push({ step: "list_projects", url: `${activeTmBase}/api/v2/Projects?$top=50`, ...listProj });

            if (listProj.ok) {
              const projects = listProj.data?.data || listProj.data?.value || (Array.isArray(listProj.data) ? listProj.data : []);
              sec.projectsFound = projects.length;
              sec.projectFields = projects.length > 0 ? Object.keys(projects[0]) : [];
              sec.firstProject = projects.length > 0 ? projects[0] : null;
              if (projects.length > 0) {
                projectId = projects[0].id || projects[0].Id;
                projectPrefix = projects[0].prefix || projects[0].Prefix || projects[0].projectPrefix || projects[0].ProjectPrefix;
              }
            }

            if (!projectId) {
              const projBody = { name: `CB_Diag_Project_${ts}`, prefix: "CBDIAG", description: "CannonBall diagnostic" };
              const createProj = await safeCall("create_project", `${activeTmBase}/api/v2/Projects`, { method: "POST", headers: tmHdrs, body: JSON.stringify(projBody) });
              sec.steps.push({ step: "create_project", requestBody: projBody, ...createProj });
              if (createProj.ok && createProj.data) {
                projectId = createProj.data.id || createProj.data.Id;
                projectPrefix = createProj.data.prefix || createProj.data.Prefix;
                sec.createdProject = createProj.data;
              }
            }

            if (!projectId) {
              sec.overallStatus = "no_project_id";
              results.testManager = sec;
            } else {
              sec.usingProjectId = projectId;
              sec.usingProjectPrefix = projectPrefix;

              const verifyProj = await safeCall("verify_project", `${activeTmBase}/api/v2/Projects/${projectId}`, { headers: tmHdrs });
              sec.steps.push({ step: "verify_project", url: `${activeTmBase}/api/v2/Projects/${projectId}`, ...verifyProj });

              // Test case creation — try multiple approaches
              const tcApproaches = [
                { label: "v2_lowercase", url: `${activeTmBase}/api/v2/Projects/${projectId}/TestCases`, body: { name: `CB_Diag_TC_${ts}`, description: "Diagnostic test case" } },
                { label: "v2_uppercase", url: `${activeTmBase}/api/v2/Projects/${projectId}/TestCases`, body: { Name: `CB_Diag_TC_Upper_${ts}`, Description: "Diagnostic test case (uppercase)" } },
                { label: "v2_with_labels", url: `${activeTmBase}/api/v2/Projects/${projectId}/TestCases`, body: { name: `CB_Diag_TC_Labels_${ts}`, description: "With labels", labels: ["Diagnostic"], manualSteps: [{ stepDescription: "Test step", expectedResult: "Pass", order: 1 }] } },
                { label: "v1_lowercase", url: `${activeTmBase}/api/v1/Projects/${projectId}/TestCases`, body: { name: `CB_Diag_TC_V1_${ts}`, description: "V1 test" } },
                { label: "v2_testcases_direct", url: `${activeTmBase}/api/v2/TestCases`, body: { name: `CB_Diag_TC_Direct_${ts}`, description: "Direct endpoint", projectId: projectId } },
              ];

              for (const approach of tcApproaches) {
                const create = await safeCall(`create_tc_${approach.label}`, approach.url, { method: "POST", headers: tmHdrs, body: JSON.stringify(approach.body) });
                sec.steps.push({ step: `create_tc_${approach.label}`, url: approach.url, method: "POST", requestBody: approach.body, ...create });
                if (create.ok) {
                  sec.testCaseWorking = approach.label;
                  break;
                }
              }

              const listTc = await safeCall("list_testcases", `${activeTmBase}/api/v2/Projects/${projectId}/TestCases?$top=10`, { headers: tmHdrs });
              sec.steps.push({ step: "list_testcases", url: `${activeTmBase}/api/v2/Projects/${projectId}/TestCases?$top=10`, ...listTc });

              // Test sets
              const tsApproaches = [
                { label: "v2_testsets", url: `${activeTmBase}/api/v2/Projects/${projectId}/TestSets`, body: { name: `CB_Diag_TS_${ts}`, description: "Diagnostic test set" } },
                { label: "v1_testsets", url: `${activeTmBase}/api/v1/Projects/${projectId}/TestSets`, body: { name: `CB_Diag_TS_V1_${ts}`, description: "V1 test set" } },
              ];
              for (const approach of tsApproaches) {
                const create = await safeCall(`create_ts_${approach.label}`, approach.url, { method: "POST", headers: tmHdrs, body: JSON.stringify(approach.body) });
                sec.steps.push({ step: `create_ts_${approach.label}`, url: approach.url, requestBody: approach.body, ...create });
                if (create.ok) { sec.testSetWorking = approach.label; break; }
              }

              // Requirements
              const reqApproaches = [
                { label: "v2_requirements", url: `${activeTmBase}/api/v2/Projects/${projectId}/Requirements`, body: { name: `CB_Diag_Req_${ts}`, description: "Diagnostic requirement" } },
              ];
              for (const approach of reqApproaches) {
                const create = await safeCall(`create_req_${approach.label}`, approach.url, { method: "POST", headers: tmHdrs, body: JSON.stringify(approach.body) });
                sec.steps.push({ step: `create_req_${approach.label}`, url: approach.url, requestBody: approach.body, ...create });
                if (create.ok) { sec.requirementWorking = approach.label; break; }
              }

              sec.overallStatus = sec.testCaseWorking ? `working (${sec.testCaseWorking})` : "test_case_creation_failed";
              results.testManager = sec;
            }
          }
        }
      }

      results.summary = {
        queues: results.queues?.overallStatus,
        assets: results.assets?.overallStatus,
        machines: results.machines?.overallStatus,
        storageBuckets: results.storageBuckets?.overallStatus,
        environments: results.environments?.overallStatus,
        triggers: results.triggers?.overallStatus,
        robotAccounts: results.robotAccounts?.overallStatus,
        actionCenter: results.actionCenter?.overallStatus,
        testDataQueues: results.testDataQueues?.overallStatus,
        documentUnderstanding: results.documentUnderstanding?.overallStatus,
        testManager: results.testManager?.overallStatus,
      };

    } catch (e: any) {
      results.error = e.message;
    }

    return res.json(results);
  });
}
